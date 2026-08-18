import api, { getAuthHeaders } from '@/shared/services/api'
import { getOneEnv } from '@/shared/utils/oneEnv'
import { absoluteKookyPublicUrl } from '@/shared/utils/kookyGateway'

/**
 * kc-media 业务头：与 deer-flow `thread-files/api.ts` buildKcMediaHeaders 字段一致。
 * X-Business-Id 须为 **langgraph_thread_id**（UUID），与 LangGraph 后端 thread 路径中的 id 相同。
 * 路由 `/deerflow-chats/:threadId` 里的是 personal thread 数字 id，二者不可混用。
 * Web 端对 X-User-Id / X-Bind-Im-User-Id 使用同一 getMvpUserId()；端侧用 identity 里第一个有效值，两者相同。
 *
 * @param {string} langgraphThreadId LangGraph thread id（写入 X-Business-Id）
 * @param {{ userId?: string, imBindUserId?: string }} [identity]
 * @returns {Record<string, string>}
 */
function buildConversationKcMediaHeaders(langgraphThreadId, identity = {}) {
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

/**
 * 与 deer-flow Web `resolveArtifactURL` 一致：GET 可走网关 artifacts 路由。
 * 返回绝对 URL（云端含 /kooky-api；devlocal 直连网关无此前缀）
 * @param {string} threadId LangGraph thread id
 * @param {string} absolutePath 虚拟绝对路径，如 `/mnt/user-data/uploads/foo.jpg`
 */
export function resolveArtifactURL(threadId, absolutePath) {
  if (!threadId || !absolutePath) return ''
  const p = String(absolutePath).trim()
  if (!p) return ''
  const pathSeg = p.startsWith('/') ? p : `/${p}`
  return absoluteKookyPublicUrl(`/kooky-api/api/threads/${threadId}/artifacts${pathSeg}`)
}

/**
 * 与后端 `upload_artifact_url` 一致：用户上传到线程目录后的下载地址（绝对 URL）
 * @see deer-flow/backend/packages/harness/deerflow/uploads/manager.py upload_artifact_url
 */
export function buildUserUploadArtifactUrl(threadId, filename) {
  if (!threadId || !filename) return ''
  const enc = encodeURIComponent(filename)
  return absoluteKookyPublicUrl(`/kooky-api/api/threads/${threadId}/artifacts/mnt/user-data/uploads/${enc}`)
}

/**
 * 将 `/api/...`、`/kooky-api/...` 或完整 http(s) 规整为绝对 URL。
 * 相对路径统一补上 one 域名 + `/kooky-api` 前缀。
 */
export function toAbsoluteDeerflowMediaUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return absoluteKookyPublicUrl(p)
}

export const threadApi = {
  /**
   * 获取线程列表 GET /personal/threads
   * @param {Object} options - 查询选项
   * @param {number} options.agentId - 过滤特定智能体的会话
   * @param {string} options.threadType - 过滤线程类型 (personal / one_person_main / one_person_sub)
   * @param {number} options.teamId - 过滤一人团队 ID
   * @param {number} [options.page=1] - 页码
   * @param {number} [options.pageSize=10] - 每页条数
   * 返回: [{ id, title, langgraph_thread_id, agent_id, thread_type, one_person_team_id, created_at, updated_at }]
   */
  async getThreads(options = {}) {
    const { agentId, threadType = 'personal', teamId, page = 1, pageSize = 20 } = options
    const params = new URLSearchParams()
    params.append('thread_type', threadType)
    if (agentId !== undefined) params.append('agent_id', agentId)
    if (teamId !== undefined) params.append('team_id', teamId)
    if (page > 0) params.append('page', page)
    if (pageSize > 0) params.append('page_size', pageSize)
    return api.get(`/kooky-api/api/personal/threads?${params.toString()}`, { headers: getAuthHeaders() })
  },

  /**
   * 创建线程：后端统一创建 LangGraph thread 和 personal thread
   * @param {string} title - 线程标题
   * @param {number|null} agentId - 智能体 ID（数字类型）
   */
  async createThread(title = 'New Chat', agentId = null) {
    return api.post(`/kooky-api/api/personal/threads`, {
      title,
      agent_id: agentId
    }, { headers: getAuthHeaders() })
  },

  /**
   * 获取线程消息历史（通过 LangGraph thread ID）
   * 走 BFF 代理层
   */
  async getThreadState(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/state`, { headers: getAuthHeaders() })
  },

  /**
   * 删除线程：软删除（后端设置 deleted_at 时间戳）
   */
  async deleteThread(personalThreadId) {
    return api.delete(`/kooky-api/api/personal/threads/${personalThreadId}`, { headers: getAuthHeaders() })
  },

  /**
   * 重命名线程：更新 personal thread 记录
   * @param {number} personalThreadId - 线程 ID
   * @param {string} title - 新标题
   * @param {string|null} langgraphThreadId - 可选，用于首次绑定 LangGraph thread
   */
  async renameThread(personalThreadId, title, langgraphThreadId = null) {
    const body = { title }
    if (langgraphThreadId) {
      body.langgraph_thread_id = langgraphThreadId
    }
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}`, body, { headers: getAuthHeaders() })
  },

  /**
   * 上传文件（走 BFF 代理）
   */
  async uploadFiles(langgraphThreadId, files) {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post(`/kooky-api/api/threads/${langgraphThreadId}/uploads`, formData, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
    })
  },

  /**
   * GET 线程 artifacts / 兼容路径（二进制，deer-flow gateway：Bearer）
   * @param {string} absoluteOrRelativeUrl resolveArtifactURL / artifact_url / 完整 http URL
   */
  async fetchThreadArtifactBlob(absoluteOrRelativeUrl) {
    const url = toAbsoluteDeerflowMediaUrl(absoluteOrRelativeUrl)
    if (!url) return null
    const res = await api.get(url, {
      headers: getAuthHeaders(),
      responseType: 'blob',
    })
    const data = res?.data ?? res
    return data instanceof Blob ? data : null
  },

  /**
   * 会话内文件保存到 kc-media（与 deer-flow `saveLocalFileToLibrary` 一致：GET artifact blob → POST …/team-files/upload）
   * @param {string} langgraphThreadId LangGraph thread id（UUID），写入 X-Business-Id
   * @param {string} sourceUrl artifact 或已解析的可 GET 地址
   * @param {string} fileName 保存文件名
   * @param {{ userId?: string, imBindUserId?: string }} [identity] 业务头，由调用方注入端上用户标识
   */
  async saveThreadArtifactToKcMedia(langgraphThreadId, sourceUrl, fileName, identity) {
    const blob = await threadApi.fetchThreadArtifactBlob(sourceUrl)
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
          ...buildConversationKcMediaHeaders(langgraphThreadId, identity),
        },
      },
    )
    return res?.data ?? res
  },

  /**
   * @提及数字人
   */
  async mentionAgent(personalThreadId, content, agentName) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/mention`, {
      content,
      agent_name: agentName
    }, { headers: getAuthHeaders() })
  },

  /**
   * 切换会话绑定的数字人/智能体
   * @param {number} personalThreadId - 线程 ID
   * @param {number} agentId - 智能体 ID
   * @returns {Promise<{ok: boolean, agent: {id: number, name: string}}>}
   */
  async switchDigitalHuman(personalThreadId, agentId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/switch-digital-human`, {
      agent_id: agentId
    }, { headers: getAuthHeaders() })
  },

  /**
   * 转发消息到团队（API 定义，暂未实现 UI）
   */
  async forwardToTeam(personalThreadId, messageIds, targetTeamId, options = {}) {
    const { injectAsContext = false, mode = 'sticky' } = options
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/forward-to-team`, {
      message_ids: messageIds,
      target_team_id: targetTeamId,
      inject_as_context: injectAsContext,
      mode
    }, { headers: getAuthHeaders() })
  },

  /**
   * 创建后台运行（走 BFF 代理）
   */
  async createRun(langgraphThreadId, input, context = {}) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs`, {
      input,
      context,
      stream_mode: ['values'],
      on_disconnect: 'continue'
    }, { headers: getAuthHeaders() })
  },

  /**
   * 创建同步运行（等待完成，走 BFF 代理）
   */
  async createRunWait(langgraphThreadId, input, context = {}) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/wait`, {
      input,
      context
    }, { headers: getAuthHeaders() })
  },

  /**
   * 获取运行列表（走 BFF 代理）
   */
  async getRuns(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs`, { headers: getAuthHeaders() })
  },

  /**
   * 获取运行详情（走 BFF 代理）
   */
  async getRun(langgraphThreadId, runId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}`, { headers: getAuthHeaders() })
  },

  /**
   * 取消运行（走 BFF 代理）
   */
  async cancelRun(langgraphThreadId, runId, options = {}) {
    const { wait = false, action = 'interrupt' } = options
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}/cancel`, null, {
      headers: getAuthHeaders(),
      params: { wait, action }
    })
  },

  /**
   * 加入已有运行的 SSE 流（走 BFF 代理）
   */
  async joinRun(langgraphThreadId, runId) {
    return `/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}/join`
  },

  /**
   * 更新会话状态（走 BFF 代理）
   */
  async updateThreadState(langgraphThreadId, values, asNode = null) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/state`, {
      values,
      as_node: asNode
    }, { headers: getAuthHeaders() })
  },

  /**
   * 获取个人会话消息（账本游标分页，对齐 deer-flow Web）。
   * @param {number} personalThreadId DB `Thread.id`（不是 langgraph_thread_id）
   * @param {{ beforeSeq?: number, pageSize?: number }} [options]
   *   - beforeSeq: 加载更早消息（返回 seq < beforeSeq 的一页）；缺省加载最新一页
   *   - pageSize:  每页条数，默认 20，上限 100
   * @returns {Promise<{
   *   history_messages: Array,           // LangGraph Message JSON（按 seq 升序）
   *   pageSize: number,
   *   hasMore: boolean,
   *   nextBeforeSeq: number | null,
   *   latestSeq: number,
   *   ledgerBackfillPending?: boolean    // 老会话首次访问账本回填中
   * }>}
   */
  async getThreadMessagesPage(personalThreadId, { beforeSeq, pageSize = 20 } = {}) {
    const params = new URLSearchParams()
    if (beforeSeq != null) params.append('beforeSeq', String(beforeSeq))
    params.append('pageSize', String(pageSize))
    const res = await api.get(
      `/kooky-api/api/v1/threads/${encodeURIComponent(String(personalThreadId))}/messages?${params.toString()}`,
      { headers: getAuthHeaders() },
    )
    // 在 service 层归一化 schema：调用方就不必再写一堆 Array.isArray / Number(... ?? 0) 防御。
    // 后端字段缺失或类型异常时降级为安全默认值，避免污染 store 中的游标 / latestSeq。
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

  /**
   * 获取上下文大小（走 BFF 代理）
   */
  async getContextSize(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/context-size`, { headers: getAuthHeaders() })
  },

  /**
   * 手动触发上下文压缩（走 BFF 代理）
   */
  async summarizeContext(langgraphThreadId, force = false) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/summarize`, {
      force
    }, { headers: getAuthHeaders() })
  },

  /**
   * 获取上传文件列表（走 BFF 代理）
   */
  async getUploadedFiles(langgraphThreadId) {
    return api.get(`/kooky-api/api/threads/${langgraphThreadId}/uploads/list`, { headers: getAuthHeaders() })
  },

  /**
   * 删除上传文件（走 BFF 代理）
   */
  async deleteUploadedFile(langgraphThreadId, filename) {
    return api.delete(`/kooky-api/api/threads/${langgraphThreadId}/uploads/${encodeURIComponent(filename)}`, { headers: getAuthHeaders() })
  },

  /**
   * 获取我的统一智能体列表
   * @param {Object} options - 查询选项
   * @param {boolean} options.stateful - 是否只返回有状态的智能体
   * @returns {Promise<Array>}
   */
  async listMyAgents(options = {}) {
    const { stateful } = options
    const params = new URLSearchParams()
    if (stateful !== undefined) params.append('stateful', stateful)

    const query = params.toString()
    const url = `/kooky-api/api/v1/agents/my${query ? '?' + query : ''}`
    return api.get(url, { headers: getAuthHeaders() })
  },

  /**
   * 获取数字真人列表
   * @returns {Promise<Array>}
   */
  async listDigitalHumans() {
    return api.get(`/kooky-api/api/personal/digital-humans`, { headers: getAuthHeaders() })
  },

  /**
   * 更新统一智能体基本信息和配置
   * PUT /api/v1/agents/{id}
   * @param {number} agentId - 智能体 ID
   * @param {Object} body - 更新内容
   * @param {string} [body.name] - 名称
   * @param {string|null} [body.description] - 描述
   * @param {string|null} [body.avatar_url] - 头像 URL
   * @param {Object|null} [body.agent_config] - 智能体配置（与存量 shallow merge）
   * @param {string|null} [body.personality] - 个性描述
   */
  async updateAgent(agentId, body) {
    return api.put(`/kooky-api/api/v1/agents/${agentId}`, body, { headers: getAuthHeaders() })
  },

  /**
   * 置顶会话
   * @param {number} personalThreadId - 线程 ID
   * @returns {Promise}
   */
  async pinThread(personalThreadId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/pin`, {}, { headers: getAuthHeaders() })
  },

  /**
   * 取消置顶会话
   * @param {number} personalThreadId - 线程 ID
   * @returns {Promise}
   */
  async unpinThread(personalThreadId) {
    return api.post(`/kooky-api/api/personal/threads/${personalThreadId}/unpin`, {}, { headers: getAuthHeaders() })
  }
}
