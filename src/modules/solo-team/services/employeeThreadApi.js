import api, { getSsoToken } from '@/shared/services/api'
import { absoluteKookyPublicUrl } from '@/shared/utils/kookyGateway'
import { getOneEnv } from '@/shared/utils/oneEnv'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function toAgentIdValue(employeeId) {
  if (employeeId == null || employeeId === '') return null
  return /^\d+$/.test(String(employeeId)) ? Number(employeeId) : String(employeeId)
}

function unwrapThreadBody(res) {
  return res?.data ?? res ?? {}
}

export function normalizePersonalThread(thread) {
  if (!thread) return null
  return {
    ...thread,
    id: String(thread.id ?? thread.thread_id ?? ''),
    title: thread.title || '新对话',
    langgraph_thread_id: thread.langgraph_thread_id || thread.langgraphThreadId || '',
    agent_id: thread.agent_id ?? thread.agentId ?? null,
    thread_type: thread.thread_type || thread.threadType || 'personal',
    one_person_team_id: thread.one_person_team_id ?? thread.onePersonTeamId ?? null,
    created_at: thread.created_at || thread.createdAt || '',
    updated_at: thread.updated_at || thread.updatedAt || '',
  }
}

function normalizeThreadList(res) {
  const body = unwrapThreadBody(res)
  const items = body.items || body.threads || body.results || (Array.isArray(body) ? body : [])
  const normalizedItems = items.map(normalizePersonalThread).filter(thread => thread?.id)
  return {
    items: normalizedItems,
    total: Number(body.total ?? normalizedItems.length),
    page: Number(body.page ?? 1),
    pageSize: Number(body.page_size ?? body.pageSize ?? normalizedItems.length),
    raw: body,
  }
}

export function toAbsoluteEmployeeMediaUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return absoluteKookyPublicUrl(p)
}

export function resolveEmployeeArtifactURL(threadId, absolutePath) {
  if (!threadId || !absolutePath) return ''
  const pathSeg = String(absolutePath).startsWith('/') ? String(absolutePath) : `/${absolutePath}`
  return absoluteKookyPublicUrl(`/kooky-api/api/threads/${threadId}/artifacts${pathSeg}`)
}

export function buildEmployeeUploadArtifactUrl(threadId, filename) {
  if (!threadId || !filename) return ''
  return absoluteKookyPublicUrl(
    `/kooky-api/api/threads/${threadId}/artifacts/mnt/user-data/uploads/${encodeURIComponent(filename)}`
  )
}

/**
 * kc-media 业务头：与 deer-flow buildConversationKcMediaHeaders 字段一致。
 * X-Business-Id 须为 langgraph_thread_id（UUID）。
 * @param {string} langgraphThreadId
 * @param {{ userId?: string, imBindUserId?: string }} [identity]
 */
function buildEmployeeKcMediaHeaders(langgraphThreadId, identity = {}) {
  const { userId = '', imBindUserId = '' } = identity
  const raw = [imBindUserId, userId].find((v) => v != null && String(v).trim() !== '')
  const uid = raw != null ? String(raw) : ''
  const env = getOneEnv() === 'prod' ? 'prod' : 'dev'
  return {
    ...getAuthHeaders(),
    'X-Business-Type': 'conversation',
    'X-Business-Id': String(langgraphThreadId),
    'X-Env': env,
    'X-User-Id': uid,
    'X-Bind-Im-User-Id': uid,
  }
}

export const employeeThreadApi = {
  async getThreads({ employeeId, threadType = 'personal', teamId, page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams()
    params.append('thread_type', threadType)
    params.append('page', String(page))
    params.append('page_size', String(pageSize))
    if (employeeId) {
      params.append('agent_id', String(employeeId))
    }
    if (teamId !== undefined && teamId !== null) {
      params.append('team_id', String(teamId))
    }
    const res = await api.get(`/kooky-api/api/personal/threads?${params.toString()}`, { headers: getAuthHeaders() })
    return normalizeThreadList(res)
  },

  async createThread(title = 'New Chat', employeeId = null, { threadType = 'personal', teamId } = {}) {
    const body = { title, thread_type: threadType }
    if (employeeId) {
      body.agent_id = toAgentIdValue(employeeId)
    }
    if (teamId !== undefined && teamId !== null) {
      body.team_id = toAgentIdValue(teamId)
    }
    const res = await api.post('/kooky-api/api/personal/threads', body, { headers: getAuthHeaders() })
    const bodyRes = unwrapThreadBody(res)
    return normalizePersonalThread(bodyRes.item || bodyRes.thread || bodyRes)
  },

  async renameThread(personalThreadId, title, langgraphThreadId = null) {
    const body = { title }
    if (langgraphThreadId) body.langgraph_thread_id = langgraphThreadId
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}`, body, { headers: getAuthHeaders() })
  },

  async deleteThread(personalThreadId) {
    return api.delete(`/kooky-api/api/personal/threads/${personalThreadId}`, { headers: getAuthHeaders() })
  },

  async pinThread(personalThreadId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/pin`, {}, { headers: getAuthHeaders() })
  },

  async unpinThread(personalThreadId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/unpin`, {}, { headers: getAuthHeaders() })
  },

  async getHistory(langgraphThreadId, limit = 1, before = null) {
    const body = { limit }
    if (before) body.before = before
    return api.post(`/kooky-api/api/langgraph-compat/threads/${langgraphThreadId}/history`, body, {
      headers: getAuthHeaders(),
    })
  },

  /**
   * 获取个人会话消息（账本游标分页）。
   * @param {number} personalThreadId
   * @param {{ beforeSeq?: number, pageSize?: number }} [options]
   */
  async getThreadMessagesPage(personalThreadId, { beforeSeq, pageSize = 20 } = {}) {
    const params = new URLSearchParams()
    if (beforeSeq != null) params.append('beforeSeq', String(beforeSeq))
    params.append('pageSize', String(pageSize))
    const res = await api.get(
      `/kooky-api/api/v1/threads/${encodeURIComponent(String(personalThreadId))}/messages?${params.toString()}`,
      { headers: getAuthHeaders() },
    )
    const toFiniteOr = (v, fallback) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    return {
      history_messages: Array.isArray(res?.history_messages) ? res.history_messages : [],
      pageSize: toFiniteOr(res?.pageSize, pageSize),
      hasMore: !!res?.hasMore,
      nextBeforeSeq: res?.nextBeforeSeq == null
        ? null
        : (Number.isFinite(Number(res.nextBeforeSeq)) ? Number(res.nextBeforeSeq) : null),
      latestSeq: toFiniteOr(res?.latestSeq, 0),
      ledgerBackfillPending: !!res?.ledgerBackfillPending,
    }
  },

  async uploadFiles(langgraphThreadId, files) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post(`/kooky-api/api/threads/${langgraphThreadId}/uploads`, formData, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
    })
  },

  /**
   * GET 线程 artifacts（二进制，Bearer），与 deerflow threadApi.fetchThreadArtifactBlob 行为一致。
   * @param {string} absoluteOrRelativeUrl
   */
  async fetchThreadArtifactBlob(absoluteOrRelativeUrl) {
    const url = toAbsoluteEmployeeMediaUrl(absoluteOrRelativeUrl)
    if (!url) return null
    const res = await api.get(url, {
      headers: getAuthHeaders(),
      responseType: 'blob',
    })
    const data = res?.data ?? res
    return data instanceof Blob ? data : null
  },

  /** GET /kooky-api/api/langgraph/threads/${id}/state */
  async getThreadState(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/state`, { headers: getAuthHeaders() })
  },

  /** POST /kooky-api/api/langgraph/threads/${id}/state */
  async updateThreadState(langgraphThreadId, values, asNode = null) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/state`, {
      values,
      as_node: asNode,
    }, { headers: getAuthHeaders() })
  },

  /** GET /kooky-api/api/langgraph/threads/${id}/context-size */
  async getContextSize(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/context-size`, { headers: getAuthHeaders() })
  },

  /** POST /kooky-api/api/langgraph/threads/${id}/summarize */
  async summarizeContext(langgraphThreadId, force = false) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/summarize`, {
      force,
    }, { headers: getAuthHeaders() })
  },

  /** GET /kooky-api/api/threads/${id}/uploads/list */
  async getUploadedFiles(langgraphThreadId) {
    return api.get(`/kooky-api/api/threads/${langgraphThreadId}/uploads/list`, { headers: getAuthHeaders() })
  },

  /** DELETE /kooky-api/api/threads/${id}/uploads/${filename} */
  async deleteUploadedFile(langgraphThreadId, filename) {
    return api.delete(`/kooky-api/api/threads/${langgraphThreadId}/uploads/${encodeURIComponent(filename)}`, {
      headers: getAuthHeaders(),
    })
  },

  /** POST /kooky-api/api/personal/threads/${id}/switch-digital-human */
  async switchDigitalHuman(personalThreadId, agentId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/switch-digital-human`, {
      agent_id: agentId,
    }, { headers: getAuthHeaders() })
  },

  /** POST /kooky-api/api/personal/threads/${id}/mention */
  async mentionAgent(personalThreadId, content, agentName) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/mention`, {
      content,
      agent_name: agentName,
    }, { headers: getAuthHeaders() })
  },

  /**
   * 会话内文件保存到 kc-media（与 deer-flow saveLocalFileToLibrary 一致）
   * @param {string} langgraphThreadId LangGraph thread id（UUID），写入 X-Business-Id
   * @param {string} sourceUrl artifact 或已解析的可 GET 地址
   * @param {string} fileName 保存文件名
   * @param {{ userId?: string, imBindUserId?: string }} [identity] 业务头
   */
  async saveThreadArtifactToKcMedia(langgraphThreadId, sourceUrl, fileName, identity) {
    const blob = await this.fetchThreadArtifactBlob(sourceUrl)
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('无法获取文件内容')
    }
    const safeName = fileName && String(fileName).trim() ? String(fileName).trim() : 'download.bin'
    const formData = new FormData()
    formData.append('file', blob, safeName)
    const res = await api.post(
      '/kooky-api/api/kc-media/api/v1/team-files/upload',
      formData,
      {
        headers: {
          ...buildEmployeeKcMediaHeaders(langgraphThreadId, identity),
        },
      },
    )
    return res?.data ?? res
  },
}
