import {
  fetchPrivateAgents,
  pinPrivateAgent,
  removePrivateAgent,
  updatePrivateAgent,
  unpinPrivateAgent,
  ensureOnePersonTeamMainThread,
} from '../service'
import {
  buildEmployeeUploadArtifactUrl,
  employeeThreadApi,
  normalizePersonalThread,
  resolveEmployeeArtifactURL,
  toAbsoluteEmployeeMediaUrl,
} from '../services/employeeThreadApi'
import {
  useEmployeeLangGraphStreamManager,
  resetEmployeeLangGraphStreamClient,
  getStoredEmployeeRunId,
  clearStoredEmployeeRunId,
} from '../services/employeeLangGraphStreamManager'
import { employeeRunApi } from '../services/employeeRunApi'
import { fetchEmployeeModels, fetchEmployeeChatModels, updateEmployeeModelSelection } from '../services/employeeModelApi'
import { useUIStore } from '@/modules/space/uiStore'
import { ElMessage } from 'element-plus'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'
import { digitalHumanApi } from '@/modules/private/services/digitalHumanApi'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { ref, watch } from 'vue'
import { buildEmployeeUiMessagesFromRaw, dedupeEmployeeAttachments } from '../utils/employeeRawMessagesToUi'
import { extractTextFromMessage } from '../utils/employeeLangGraphText'
import { stripUploadedFilesBlock, parseUploadedFilesFromContent } from '../utils/employeeUploadedMarkup'
import {
  extractPresentFilesPathsFromToolCalls,
  attachmentsFromPresentEmployeePaths,
} from '../utils/employeePresentFiles'
import { resolveEmployeePresence } from '../utils/employeePresence'
import { buildEmployeeSkillItems } from '../utils/employeeSkillFormat'

/**
 * 基于当前内存中的 employeeChatEmployees，选中首位员工的会话（无则创建）。
 * @param {import('pinia').Store} store solo-team store 实例
 * @returns {Promise<{ employeeId: string, threadId: string } | null>}
 */
async function selectFirstEmployeeFromLoadedList(store) {
  const employees = store.employeeChatEmployees
  if (!employees?.length) return null
  const emp = employees[0]
  await store.fetchEmployeeThreads(emp.id)
  const threads = store.getEmployeeThreads(emp.id)
  const existingId = threads[0]?.id
  if (existingId) {
    await store.selectEmployeeThread(emp.id, existingId)
    return { employeeId: emp.id, threadId: existingId }
  }
  const thread = await store.createEmployeeThread(emp.id)
  if (!thread?.id) return null
  return { employeeId: emp.id, threadId: thread.id }
}

function nowTs() {
  return Date.now()
}

function buildThreadStateKey(employeeId, threadId) {
  return `${employeeId || ''}:${threadId || ''}`
}

function createEmptyThreadState() {
  return {
    messages: [],
    isStreaming: false,
    streamingMessageId: null,
    sendingMessage: false,
    uploadingFiles: false,
    loadingMessages: false,
    error: null,
    loaded: false,
    todos: [],
    streamManager: null,
    streamManagerWatchers: [],
    // 账本游标分页
    hasMore: false,
    loadingOlderPage: false,
    ledgerBackfillPending: false,
    persistedMessageCount: 0,
    scrollAnchor: null,
    nextBeforeSeq: null,
  }
}

function createEmptyModelState() {
  return {
    currentModel: null,
    availableModels: [],
    selectedModelName: null,
    loading: false,
    loaded: false,
    loadingPromise: null,
  }
}

function resolveUserId() {
  try {
    return JSON.parse(localStorage.getItem('super-assistant-userInfo') || '{}')?.userId
  } catch { return undefined }
}

/**
 * 构建 SSE 流的 context payload（对齐 deerflow _buildContextPayload）。
 * sendEmployeeMessage / regenerateEmployeeLastMessage 共用。
 */
function buildEmployeeStreamContext({ mode, modelName, lgId, currentModel }) {
  const runMode = mode || 'flash'
  return {
    mode: runMode,
    model_name: modelName || 'claude-sonnet-4-6',
    thinking_enabled: runMode !== 'flash',
    is_plan_mode: runMode === 'pro' || runMode === 'ultra',
    subagent_enabled: runMode === 'ultra',
    reasoning_effort: runMode === 'ultra' ? 'high' : runMode === 'pro' ? 'medium' : runMode === 'thinking' ? 'low' : 'minimal',
    thread_id: lgId,
    user_id: resolveUserId(),
    ...(currentModel?.llm_base_url ? { llm_base_url: currentModel.llm_base_url } : {}),
    ...(currentModel?.llm_api_key ? { llm_api_key: currentModel.llm_api_key } : {}),
    ...(currentModel?.upstream_model ? { upstream_model: currentModel.upstream_model } : {}),
  }
}

function normalizeEmployeeItem(employee) {
  const id = String(employee?.id ?? employee?.agent_id ?? employee?.agentId ?? '')
  if (!id) return null
  const raw = employee?.raw || employee
  return {
    id,
    name: String(employee?.display_name || employee?.name || employee?.agent_name || '未命名员工').trim(),
    title:
      employee?.job_title
      || employee?.jobTitle
      || employee?.title
      || employee?.team_name
      || employee?.teamName
      || '',
    description: String(employee?.description || employee?.summary || '').trim(),
    avatar:
      employee?.avatar
      || employee?.avatar_url
      || employee?.avatarUrl
      || employee?.icon
      || employee?.agent_avatar_url
      || raw?.agent_avatar_url
      || raw?.avatar_url
      || raw?.avatarUrl
      || '',
    conversationScope: employee?.conversationScope || 'employee',
    isDefault: Boolean(employee?.isDefault ?? raw?.is_default),
    pinned: Boolean(employee?.pinned ?? raw?.pinned),
    pinnedAt: employee?.pinnedAt ?? raw?.pinned_at ?? null,
    presence: resolveEmployeePresence(employee, 'idle'),
    raw,
  }
}

function parseAgentSortId(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 对齐文档 GET /api/v1/agents/my：is_default DESC > pinned_at DESC NULLS LAST > id ASC */
function sortEmployeesLikeAgentsMy(employees) {
  return [...employees].sort((a, b) => {
    const rawA = a.raw || {}
    const rawB = b.raw || {}
    const defA = Boolean(rawA.is_default ?? a.isDefault)
    const defB = Boolean(rawB.is_default ?? b.isDefault)
    if (defA !== defB) return (defB ? 1 : 0) - (defA ? 1 : 0)

    const pinnedAtOf = (e) => {
      const r = e.raw || {}
      const ts = r.pinned_at ?? e.pinnedAt
      if (ts == null || ts === '') return null
      const t = Date.parse(ts)
      return Number.isFinite(t) ? t : null
    }
    const pa = pinnedAtOf(a)
    const pb = pinnedAtOf(b)
    if (pa !== pb) {
      if (pa == null && pb == null) return 0
      if (pa == null) return 1
      if (pb == null) return -1
      return pb - pa
    }
    return parseAgentSortId(a.id) - parseAgentSortId(b.id)
  })
}

/** 解析 GET /api/personal/agent-usage 列表体（与 digitalHumanStore.fetchAgents 一致） */
function parseAgentUsageListResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data?.items)) return data.data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

/** 协作数字人列表排序：置顶优先，再按 last_used_at 倒序（对齐 digitalHumanStore.sortedAgents） */
function sortCollaborationDigitalHumanEmployees(employees) {
  return [...employees].sort((a, b) => {
    const ap = a.pinned ? 1 : 0
    const bp = b.pinned ? 1 : 0
    if (ap !== bp) return bp - ap
    const ra = a.raw || {}
    const rb = b.raw || {}
    const at = new Date(ra.last_used_at || ra.first_used_at || 0).getTime()
    const bt = new Date(rb.last_used_at || rb.first_used_at || 0).getTime()
    return bt - at
  })
}

/**
 * 协作模块专用：从 GET /api/personal/agent-usage 拉数字人列表，写入 store.employeeChatEmployees。
 * 与一人团队 loadEmployeeItems（GET /api/v1/agents/my）严格区分，禁止混用。
 * @param {import('pinia').Store} store collaboration-employee-chat 实例
 */
export async function loadCollaborationDigitalHumanEmployeeList(store, { force = false } = {}) {
  if (store.employeeChatHost !== 'collaboration') {
    return store.employeeChatEmployees
  }
  if (!force && store.employeeLoadingItems) {
    return store.employeeChatEmployees
  }
  if (!force && store.employeeItemsLoaded) {
    return store.employeeChatEmployees
  }
  store.employeeLoadingItems = true
  try {
    const data = await digitalHumanApi.listAgents({ page: 1, pageSize: 50, includeHidden: false })
    const items = parseAgentUsageListResponse(data)
    const normalized = items
      .map((agent) =>
        normalizeEmployeeItem({
          id: agent.agent_id ?? agent.agentId,
          name: agent.agent_display_name || agent.agent_name,
          avatar: agent.agent_avatar_url,
          pinned: agent.pinned,
          pinnedAt: agent.pinned_at,
          conversationScope: 'employee',
          raw: agent,
        }),
      )
      .filter(Boolean)
    store.employeeChatEmployees = normalized.length ? sortCollaborationDigitalHumanEmployees(normalized) : []
    store.employeeItemsLoaded = true
    try {
      const dhs = useDigitalHumanStore()
      dhs.agents = Array.isArray(items) ? [...items] : []
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.error('[CollaborationDigitalHuman] Failed to load agent-usage list:', err)
    ElMessage.error(soloTeamApiErrorMessage(err, '加载协作数字人列表失败'))
    store.employeeChatEmployees = store.employeeChatEmployees || []
    store.employeeItemsLoaded = true
  } finally {
    store.employeeLoadingItems = false
  }
  return store.employeeChatEmployees
}

function createMessage(role, content, extra = {}) {
  return {
    id: `${role}_${nowTs()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: nowTs(),
    ...extra,
  }
}

/**
 * 将 LangGraph StreamManager 的 raw messages 同步到 Pinia 中的 UI 列表。
 * SDK 可能在初始化或 run 切换时短暂上报空 messages；若用「仅 sdk + 乐观」覆盖，
 * 会清空已加载的整段对话，出现历史气泡消失、仅余「正在思考」等现象。
 */
function mergeEmployeeStreamSdkIntoMessages(state, rawMsgs, sdkMessages) {
  const rawArr = Array.isArray(rawMsgs) ? rawMsgs : []
  if (rawArr.length === 0) {
    const committed = state.messages.filter((m) => !m.isOptimistic)
    const optimistics = state.messages.filter((m) => m.isOptimistic)
    if (committed.length > 0) {
      return [...committed, ...optimistics]
    }
  }

  const lastHuman = [...rawArr].reverse().find((r) => r.type === 'human')
  // 去掉引用前缀行（> ...），再与乐观消息的原始文本比较，避免引用发送时乐观消息被误判为仍在等待
  const lastHumanText = lastHuman
    ? stripUploadedFilesBlock(extractTextFromMessage(lastHuman) || '')
        .split('\n')
        .filter(line => !line.startsWith('> ') && line !== '>')
        .join('\n')
        .trim()
    : ''

  const userOptimisticStillPending = (m) => {
    if (!m.isOptimistic || m.role !== 'user') return false
    const text = stripUploadedFilesBlock(String(m.content || '')).trim()
    if (!text) return false
    const rawHumanCount = rawArr.filter((r) => r.type === 'human').length
    const committedHumanCount = state.messages.filter(
      (u) => !u.isOptimistic && u.role === 'user',
    ).length
    if (rawHumanCount <= committedHumanCount) return true
    return lastHumanText !== text
  }

  const optimisticMsgs = state.messages.filter((m) => {
    if (!m.isOptimistic) return false
    if (m.role === 'user') {
      return userOptimisticStillPending(m)
    }
    if (m.role === 'assistant') {
      if (m.raw?.id) {
        const coveredById = rawArr.some((r) => r.type === 'ai' && r.id && r.id === m.raw.id)
        if (coveredById) return false
      }
      if (m.isStreaming) {
        if (state.messages.some((u) => userOptimisticStillPending(u))) {
          return true
        }
        const lastAi = [...rawArr].reverse().find((r) => r.type === 'ai')
        if (!lastAi) return true
        const inSdk = sdkMessages.some((s) => s.role === 'assistant' && s.raw?.id === lastAi.id)
        return !inSdk
      }
      return !rawArr.some((r) => r.type === 'ai')
    }
    return false
  })

  // 保留已落库消息的原有时间戳和元数据，只让 SDK 补充新消息。
  // sdkMessages 每次流推送都会重建并重新计算 baseTimestamp（Date.now()），
  // 若直接覆盖会导致所有历史消息时间戳不断跳跃。
  const committedById = new Map()
  for (const m of state.messages) {
    if (!m.isOptimistic && m.id) committedById.set(m.id, m)
  }
  const mergedSdk = sdkMessages.map((sdk) => {
    const existing = sdk.id ? committedById.get(sdk.id) : null
    if (existing) {
      // 保留原有 timestamp、feedback 等运行时元数据，仅更新流式字段
      return {
        ...sdk,
        timestamp: existing.timestamp,
        ...(existing.feedback !== undefined ? { feedback: existing.feedback } : {}),
      }
    }
    return sdk
  })

  return [...mergedSdk, ...optimisticMsgs]
}

function makeAutoTitle(text) {
  const value = String(stripUploadedFilesBlock(String(text || ''))).trim()
  if (!value) return '新对话'
  return value.slice(0, 8) + (value.length > 8 ? '...' : '')
}

export function createInitialEmployeeThreads() {
  return {}
}

export function createInitialEmployeeThreadStates() {
  return {}
}

export const employeeChatsState = () => ({
  employeeChatMode: 'room',
  employeeChatEmployees: [],
  employeeLoadingItems: false,
  employeeItemsLoaded: false,
  employeeThreadsByEmployeeId: createInitialEmployeeThreads(),
  employeeThreadStates: createInitialEmployeeThreadStates(),
  employeeModelStateByThreadKey: {},
  loadingEmployeeThreadsByEmployeeId: {},
  employeeModels: [],
  employeeLoadingModels: false,
  employeeSelectedModelName: null,
  employeeUserSelectedModelName: null,   // 用户手动选择的模型（优先级最高，切换会话不重置）
  employeeUserSelectedMode: null,        // 用户手动选择的模式（切换会话不重置）
  employeeChatCurrentModel: null,
  employeeChatAvailableModels: [],
  employeeLoadingChatModels: false,
  employeeModelChannel: 'kc-oc',
  currentEmployeeId: null,
  currentEmployeeThreadId: null,
  employeeQuotingMessage: null,
  employeePendingPrefillText: null,
  /** DeerFlow 一人团队主会话：与「我的员工」共用 EmployeeChatPanel，内部用 optTeam_${id} 作为线程桶 key */
  optTeamChatContext: null,
  /** null：一人团队 store | 'collaboration'：协作数字人独立 store */
  employeeChatHost: null,
  /**
   * 协作侧栏数字人点击 loading（与 digitalHumanStore.openingAgentId 隔离）
   * 一人团队「我的员工」不使用该字段。
   */
  collaborationDigitalHumanOpeningAgentId: null,
})

export const employeeChatsGetters = {
  employeeItems: (state) => state.employeeChatEmployees,

  isEmployeeChatActive: (state) =>
    state.employeeChatMode === 'employee' || state.employeeChatMode === 'one_person_team',

  currentEmployee: (state) => {
    if (state.employeeChatMode === 'one_person_team' && state.optTeamChatContext) {
      const c = state.optTeamChatContext
      return {
        id: String(c.coordinatorAgentId ?? ''),
        name: c.teamName || '一人团队',
        icon: '',
        avatar: '',
        description: '',
        raw: {},
      }
    }
    if (!state.currentEmployeeId) return null
    return state.employeeChatEmployees.find((employee) => employee.id === state.currentEmployeeId) || null
  },

  currentEmployeeThread: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return null
    const threads = state.employeeThreadsByEmployeeId[state.currentEmployeeId] || []
    return threads.find((thread) => String(thread.id) === String(state.currentEmployeeThreadId)) || null
  },

  currentEmployeeMessages: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return []
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.messages || []
  },

  /** 当前员工会话 Todo（来自流式 values.todos） */
  currentEmployeeTodos: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return []
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.todos || []
  },

  getEmployeeThreads: (state) => (employeeId) => {
    if (!employeeId) return []
    return state.employeeThreadsByEmployeeId[employeeId] || []
  },

  getEmployeeThreadState: (state) => (employeeId, threadId) => {
    if (!employeeId || !threadId) return null
    return state.employeeThreadStates[buildThreadStateKey(employeeId, threadId)] || null
  },

  currentEmployeeNavKey: (state) => {
    if (state.employeeChatMode === 'one_person_team' && state.optTeamChatContext && state.currentEmployeeThreadId) {
      return `one-person-team:${state.optTeamChatContext.teamId}:${state.currentEmployeeThreadId}`
    }
    if (state.employeeChatMode !== 'employee' || !state.currentEmployeeId || !state.currentEmployeeThreadId) return null
    return `employee:${state.currentEmployeeId}:${state.currentEmployeeThreadId}`
  },

  /** 当前线程账本分页状态 */
  currentEmployeeHasMore: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return false
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.hasMore || false
  },

  currentEmployeeLoadingOlderPage: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return false
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.loadingOlderPage || false
  },

  currentEmployeeLedgerBackfillPending: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return false
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.ledgerBackfillPending || false
  },

  currentEmployeePersistedMessageCount: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return 0
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.persistedMessageCount || 0
  },

  currentEmployeeScrollAnchor: (state) => {
    if (!state.currentEmployeeId || !state.currentEmployeeThreadId) return null
    const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
    return state.employeeThreadStates[key]?.scrollAnchor || null
  },

  /** SkillSelector / 模型绑定：一人团队用协调者 agent id，会话状态仍挂在 optTeam_* 桶上 */
  employeeSkillBindingAgentId: (state) => {
    if (state.employeeChatMode === 'one_person_team' && state.optTeamChatContext?.coordinatorAgentId != null) {
      return String(state.optTeamChatContext.coordinatorAgentId)
    }
    return state.currentEmployeeId != null ? String(state.currentEmployeeId) : ''
  },

  currentEmployeeModelSupportsThinking: (state) => {
    if (state.currentEmployeeId && state.currentEmployeeThreadId) {
      const key = buildThreadStateKey(state.currentEmployeeId, state.currentEmployeeThreadId)
      const modelState = state.employeeModelStateByThreadKey[key]
      if (modelState?.currentModel) {
        return modelState.currentModel.supports_thinking ?? false
      }
    }
    if (state.employeeChatCurrentModel) return state.employeeChatCurrentModel.supports_thinking ?? false
    return false
  },
}

export const employeeChatsActions = {
  _buildEmployeeThreadStateKey(employeeId, threadId) {
    return buildThreadStateKey(employeeId, threadId)
  },

  _ensureEmployeeThreads(employeeId) {
    if (!employeeId) return []
    if (!this.employeeThreadsByEmployeeId[employeeId]) {
      this.employeeThreadsByEmployeeId[employeeId] = []
    }
    return this.employeeThreadsByEmployeeId[employeeId]
  },

  _getEmployeeConfig(employeeId) {
    return this.employeeChatEmployees.find(employee => String(employee.id) === String(employeeId)) || null
  },

  _usesSharedPersonalThreads(employeeId) {
    const employee = this._getEmployeeConfig(employeeId)
    // 未在列表中解析到员工时禁止走「共享 personal」分支，否则会不带 agent_id 请求全量线程
    if (!employee) return false
    return employee.conversationScope !== 'employee'
  },

  _attachEmployeeOwner(thread, employeeId) {
    return {
      ...thread,
      employeeId,
      employee_owner_id: employeeId,
    }
  },

  _ensureEmployeeThreadState(employeeId, threadId) {
    if (!employeeId || !threadId) return null
    const key = this._buildEmployeeThreadStateKey(employeeId, threadId)
    if (!this.employeeThreadStates[key]) {
      this.employeeThreadStates[key] = createEmptyThreadState()
    }
    return this.employeeThreadStates[key]
  },

  _ensureEmployeeModelState(employeeId, threadId) {
    if (!employeeId || !threadId) return null
    const key = this._buildEmployeeThreadStateKey(employeeId, threadId)
    if (!this.employeeModelStateByThreadKey[key]) {
      this.employeeModelStateByThreadKey[key] = createEmptyModelState()
    }
    return this.employeeModelStateByThreadKey[key]
  },

  _getEmployeeModelState(employeeId, threadId) {
    if (!employeeId || !threadId) return null
    return this.employeeModelStateByThreadKey[this._buildEmployeeThreadStateKey(employeeId, threadId)] || null
  },

  _disposeEmployeeStreamForState(state) {
    if (!state) return
    if (state.streamManagerWatchers?.length) {
      state.streamManagerWatchers.forEach((stop) => stop())
      state.streamManagerWatchers = []
    }
    if (state.streamManager) {
      state.streamManager.reset()
      state.streamManager = null
    }
  },

  _buildEmployeeUiMessagesFromRaw(rawMessages, lgId) {
    return buildEmployeeUiMessagesFromRaw(rawMessages, lgId, (msg, id) => this._extractEmployeeAttachmentsForUi(msg, id))
  },

  _extractEmployeeAttachmentsForUi(msg, lgId) {
    const attachments = []
    if (msg?.additional_kwargs?.files && Array.isArray(msg.additional_kwargs.files)) {
      attachments.push(...msg.additional_kwargs.files.map((file) => {
        const name = file.name || file.filename || '未命名文件'
        const fromApi = file.artifact_url || file.url || file.file_url || file.download_url
        let url = ''
        if (fromApi) url = toAbsoluteEmployeeMediaUrl(fromApi)
        else if (file.virtual_path && lgId) url = resolveEmployeeArtifactURL(lgId, file.virtual_path)
        else if (lgId && typeof file.path === 'string' && file.path.includes('/mnt/user-data')) {
          url = resolveEmployeeArtifactURL(lgId, file.path)
        } else if (lgId) {
          url = buildEmployeeUploadArtifactUrl(lgId, name)
        }
        return {
          name,
          url,
          thumbnailUrl: file.thumbnail_url || file.preview_url || url || '',
          size: Number(file.size || 0),
          type: file.type || file.mime_type || file.content_type || '',
          mimeType: file.mime_type || file.type || file.content_type || '',
        }
      }))
    }
    if (Array.isArray(msg?.content)) {
      msg.content.forEach((item) => {
        if (item.type === 'image' || item.type === 'image_url') {
          const url = item.url || item.image_url?.url || ''
          attachments.push({
            name: item.name || '图片',
            url,
            thumbnailUrl: url,
            type: 'image',
            mimeType: item.mime_type || 'image/png',
            size: Number(item.size || 0),
          })
        }
      })
    }
    if (lgId) {
      const pPaths = extractPresentFilesPathsFromToolCalls(msg)
      if (pPaths.length) {
        attachments.push(...attachmentsFromPresentEmployeePaths(lgId, pPaths))
      }
    }
    // history / checkpoint：附件写在正文 <uploaded_files> 中；仅当 additional_kwargs.files
    // 与 content 图片等未提供附件时才解析，避免同一文件重复出现（对齐 deerflow _extractAttachments）
    if (attachments.length === 0) {
      const flatText = typeof msg?.content === 'string' ? msg.content : extractTextFromMessage(msg)
      if (lgId && flatText) {
        attachments.push(...parseUploadedFilesFromContent(flatText, lgId))
      }
    }
    return dedupeEmployeeAttachments(attachments)
  },

  _getOrCreateEmployeeStreamManager(employeeId, threadId) {
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state) return null
    if (state.streamManager) return state.streamManager

    const thread = this._ensureEmployeeThreads(employeeId).find((item) => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return null

    const mgr = useEmployeeLangGraphStreamManager(lgId, buildThreadStateKey(employeeId, threadId))
    state.streamManager = mgr

    const stopRaw = watch(
      mgr.rawMessages,
      (msgs) => {
        const rawMsgs = msgs || []
        const sdkMessages = this._buildEmployeeUiMessagesFromRaw(rawMsgs, lgId)
        state.messages = mergeEmployeeStreamSdkIntoMessages(state, rawMsgs, sdkMessages)
      },
      { deep: false },
    )

    const stopLoading = watch(mgr.isLoading, (loading) => {
      state.isStreaming = loading
      if (!loading) state.streamingMessageId = null
    })

    const stopTodos = watch(mgr.todos, (newTodos) => {
      state.todos = newTodos ?? []
    }, { deep: false })

    state.streamManagerWatchers = [stopRaw, stopLoading, stopTodos]
    return mgr
  },

  _finishEmployeeStreamSession(employeeId, threadId) {
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state) return
    state.isStreaming = false
    state.streamingMessageId = null
    state.sendingMessage = false
    for (const m of state.messages) {
      if (m.isStreaming) {
        m.isStreaming = false
        m.isOptimistic = false
        if (m.role === 'assistant' && !String(m.content || '').trim()) {
          m.content = '已完成。'
        }
      }
    }
  },

  async loadEmployeeItems({ force = false } = {}) {
    if (this.employeeLoadingItems || (this.employeeItemsLoaded && !force)) return this.employeeChatEmployees
    this.employeeLoadingItems = true
    try {
      const employees = await fetchPrivateAgents({ is_default: false })
      const normalized = employees
        .map(employee => normalizeEmployeeItem(employee))
        .filter(Boolean)
      let list = normalized
      if (normalized.length) {
        list = sortEmployeesLikeAgentsMy(list)
      }
      this.employeeChatEmployees = list
      this.employeeItemsLoaded = true
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to load employee items:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '加载员工列表失败'))
      // force 刷新失败时保留内存中已有列表（例如移除员工后已本地过滤），避免整表被清空
      if (!force) this.employeeChatEmployees = []
      this.employeeItemsLoaded = true
    } finally {
      this.employeeLoadingItems = false
    }
    return this.employeeChatEmployees
  },

  async renameEmployee(employeeId, name) {
    const value = String(name || '').trim()
    if (!employeeId || !value) return null
    const updated = await updatePrivateAgent(employeeId, { name: value })
    const idx = this.employeeChatEmployees.findIndex(employee => String(employee.id) === String(employeeId))
    if (idx >= 0) {
      const normalized = normalizeEmployeeItem(updated)
      this.employeeChatEmployees[idx] = {
        ...this.employeeChatEmployees[idx],
        ...(normalized || {}),
        name: value,
      }
      this.employeeChatEmployees = sortEmployeesLikeAgentsMy(this.employeeChatEmployees)
    }
    return this.employeeChatEmployees[idx] || updated
  },

  /**
   * 更新数字员工展示信息（名称、描述、职位、头像等），与「数字员工管理」侧栏保存一致
   * @param {string} employeeId
   * @param {{ name?: string, description?: string, jobTitle?: string, avatarUrl?: string }} fields
   */
  async updateEmployeeDetails(employeeId, fields = {}) {
    if (!employeeId) return null
    const payload = {}
    if (fields.name !== undefined) {
      const v = String(fields.name || '').trim()
      if (v) payload.name = v
    }
    if (fields.description !== undefined) {
      payload.description = String(fields.description ?? '').trim() || null
    }
    if (fields.jobTitle !== undefined) {
      payload.jobTitle = String(fields.jobTitle ?? '').trim() || null
    }
    if (fields.avatarUrl !== undefined) {
      payload.avatarUrl = String(fields.avatarUrl ?? '').trim() || null
    }
    if (Object.keys(payload).length === 0) return null
    const updated = await updatePrivateAgent(employeeId, payload)
    const idx = this.employeeChatEmployees.findIndex(employee => String(employee.id) === String(employeeId))
    if (idx >= 0) {
      const normalized = normalizeEmployeeItem(updated)
      if (normalized) {
        this.employeeChatEmployees[idx] = {
          ...this.employeeChatEmployees[idx],
          ...normalized,
        }
      } else {
        if (payload.name) this.employeeChatEmployees[idx].name = payload.name
        if (fields.description !== undefined) {
          this.employeeChatEmployees[idx].description = String(fields.description ?? '').trim()
        }
        if (fields.jobTitle !== undefined) {
          this.employeeChatEmployees[idx].title = String(fields.jobTitle ?? '').trim()
        }
        if (fields.avatarUrl !== undefined) {
          const av = String(fields.avatarUrl ?? '').trim()
          this.employeeChatEmployees[idx].avatar = av
        }
      }
      if (this.employeeChatHost === 'collaboration') {
        this.employeeChatEmployees = sortCollaborationDigitalHumanEmployees(this.employeeChatEmployees)
      } else {
        this.employeeChatEmployees = sortEmployeesLikeAgentsMy(this.employeeChatEmployees)
      }
    }
    return this.employeeChatEmployees[idx] || updated
  },

  async pinEmployee(employeeId) {
    if (!employeeId) return null
    if (this.employeeChatHost === 'collaboration') {
      await digitalHumanApi.pinAgentUsage(employeeId)
      await loadCollaborationDigitalHumanEmployeeList(this, { force: true })
      return { pinned: true }
    }
    const updated = await pinPrivateAgent(employeeId)
    const idx = this.employeeChatEmployees.findIndex(employee => String(employee.id) === String(employeeId))
    if (idx >= 0) {
      const normalized = normalizeEmployeeItem(updated)
      if (normalized) {
        this.employeeChatEmployees[idx] = {
          ...this.employeeChatEmployees[idx],
          ...normalized,
        }
      }
      this.employeeChatEmployees = sortEmployeesLikeAgentsMy(this.employeeChatEmployees)
    }
    return updated
  },

  async unpinEmployee(employeeId) {
    if (!employeeId) return null
    if (this.employeeChatHost === 'collaboration') {
      await digitalHumanApi.unpinAgentUsage(employeeId)
      await loadCollaborationDigitalHumanEmployeeList(this, { force: true })
      return { pinned: false }
    }
    const updated = await unpinPrivateAgent(employeeId)
    const idx = this.employeeChatEmployees.findIndex(employee => String(employee.id) === String(employeeId))
    if (idx >= 0) {
      const normalized = normalizeEmployeeItem(updated)
      if (normalized) {
        this.employeeChatEmployees[idx] = {
          ...this.employeeChatEmployees[idx],
          ...normalized,
        }
      }
      this.employeeChatEmployees = sortEmployeesLikeAgentsMy(this.employeeChatEmployees)
    }
    return updated
  },

  async removeEmployee(employeeId) {
    if (!employeeId) return
    if (this.employeeChatHost === 'collaboration') {
      await digitalHumanApi.hideAgentUsage(employeeId)
      this.employeeChatEmployees = this.employeeChatEmployees.filter(item => String(item.id) !== String(employeeId))
      delete this.employeeThreadsByEmployeeId[employeeId]
      delete this.loadingEmployeeThreadsByEmployeeId[employeeId]
      Object.keys(this.employeeThreadStates).forEach((key) => {
        if (key.startsWith(`${employeeId}:`)) {
          this._disposeEmployeeStreamForState(this.employeeThreadStates[key])
          delete this.employeeThreadStates[key]
        }
      })
      Object.keys(this.employeeModelStateByThreadKey).forEach((key) => {
        if (key.startsWith(`${employeeId}:`)) delete this.employeeModelStateByThreadKey[key]
      })
      await loadCollaborationDigitalHumanEmployeeList(this, { force: true })
      const wasCurrent = String(this.currentEmployeeId) === String(employeeId)
      if (wasCurrent) {
        const ui = useUIStore()
        if (this.employeeChatEmployees.length > 0) {
          const picked = await selectFirstEmployeeFromLoadedList(this)
          if (picked && ui.activePrimaryNav === 'collaboration') {
            ui.setActiveNavigation(
              'collaboration',
              `digital-human-${picked.employeeId}`,
            )
          }
        } else {
          this.activateRoomChat()
          if (ui.activePrimaryNav === 'collaboration') {
            const { useGroupStore } = await import('@/modules/group/store')
            const groupStore = useGroupStore()
            const nextConversationId = groupStore.groupConversations[0]?.conversationId ?? null
            ui.setActiveNavigation('collaboration', nextConversationId)
            if (nextConversationId) {
              await groupStore.selectConversation(nextConversationId)
            }
          }
        }
      }
      return
    }

    const employee = this._getEmployeeConfig(employeeId)
    if (!employee) return
    await removePrivateAgent(employee)
    this.employeeChatEmployees = this.employeeChatEmployees.filter(item => String(item.id) !== String(employeeId))
    delete this.employeeThreadsByEmployeeId[employeeId]
    delete this.loadingEmployeeThreadsByEmployeeId[employeeId]
    Object.keys(this.employeeThreadStates).forEach((key) => {
      if (key.startsWith(`${employeeId}:`)) {
        this._disposeEmployeeStreamForState(this.employeeThreadStates[key])
        delete this.employeeThreadStates[key]
      }
    })
    Object.keys(this.employeeModelStateByThreadKey).forEach((key) => {
      if (key.startsWith(`${employeeId}:`)) delete this.employeeModelStateByThreadKey[key]
    })
    await this.loadEmployeeItems({ force: true })
    const wasCurrent = String(this.currentEmployeeId) === String(employeeId)
    if (wasCurrent) {
      const ui = useUIStore()
      if (this.employeeChatHost === 'collaboration') {
        if (this.employeeChatEmployees.length > 0) {
          const picked = await selectFirstEmployeeFromLoadedList(this)
          if (picked && ui.activePrimaryNav === 'collaboration') {
            ui.setActiveNavigation(
              'collaboration',
              `digital-human-${picked.employeeId}`,
            )
          }
        } else {
          this.activateRoomChat()
          if (ui.activePrimaryNav === 'collaboration') {
            const { useGroupStore } = await import('@/modules/group/store')
            const groupStore = useGroupStore()
            const nextConversationId = groupStore.groupConversations[0]?.conversationId ?? null
            ui.setActiveNavigation('collaboration', nextConversationId)
            if (nextConversationId) {
              await groupStore.selectConversation(nextConversationId)
            }
          }
        }
        return
      }

      if (this.employeeChatEmployees.length > 0) {
        const picked = await selectFirstEmployeeFromLoadedList(this)
        if (picked && ui.activePrimaryNav === 'solo-team') {
          ui.setActiveNavigation(
            'solo-team',
            `employee:${picked.employeeId}:${picked.threadId}`,
          )
        }
      } else {
        if (ui.activePrimaryNav === 'solo-team') {
          const currentTeamId = this.currentTeamId
          const nextTeam =
            this.onePersonTeams.find((team) => String(team.id) === String(currentTeamId))
            || this.onePersonTeams[0]
          const nextTeamId = nextTeam?.id ?? nextTeam?.teamId
          if (nextTeamId != null) {
            this.activateOnePersonTeamRuntime(nextTeamId)
            ui.setActiveNavigation('solo-team', `team:${nextTeamId}`)
          } else {
            this.employeeChatMode = 'one_person_runtime'
            this.currentEmployeeId = null
            this.currentEmployeeThreadId = null
            ui.setActiveNavigation('solo-team', null)
          }
        }
      }
    }
  },

  /**
   * 进入 DeerFlow 一人团队主会话（与「我的员工」同一套 Employee UI）
   * @param {string|number} teamId
   * @param {object} mainThreadRaw createOnePersonMainThread / ensure 返回体
   * @param {{ teamName?: string, coordinatorAgentId?: string|number }} meta
   */
  async selectOnePersonTeamMainSession(teamId, mainThreadRaw, meta = {}) {
    const tid = String(teamId ?? '').trim()
    if (!tid || !mainThreadRaw) return
    const thread = normalizePersonalThread(mainThreadRaw)
    if (!thread?.id || !thread.langgraph_thread_id) {
      console.warn('[SoloTeam] selectOnePersonTeamMainSession: invalid thread', mainThreadRaw)
      return
    }
    const sid = `optTeam_${tid}`
    const threads = this._ensureEmployeeThreads(sid)
    const idx = threads.findIndex((t) => String(t.id) === String(thread.id))
    if (idx >= 0) threads[idx] = { ...threads[idx], ...thread }
    else threads.unshift(thread)

    const coord = meta.coordinatorAgentId ?? thread.agent_id ?? thread.agentId ?? thread.digital_human_id
    this.optTeamChatContext = {
      teamId: tid,
      teamName: String(meta.teamName || thread.title || '一人团队').trim() || '一人团队',
      coordinatorAgentId: coord != null ? String(coord) : '',
    }
    this.employeeChatMode = 'one_person_team'
    this.currentEmployeeId = sid
    this.currentEmployeeThreadId = thread.id
    this.employeeQuotingMessage = null

    this._ensureEmployeeThreadState(sid, thread.id)
    await this.loadEmployeeMessages(sid, thread.id, { force: true })
    await this.loadEmployeeChatModels(sid, thread.id)
  },

  /**
   * 从侧栏进入：确保主会话存在后选中（与 ensureOnePersonTeamMainThread 对齐）
   */
  async openOnePersonTeamFromSidebar(teamId, title = '主会话', meta = {}) {
    const main = await ensureOnePersonTeamMainThread(teamId, title)
    await this.selectOnePersonTeamMainSession(teamId, main, meta)
  },

  activateRoomChat() {
    this.employeeChatMode = 'room'
    this.currentEmployeeId = null
    this.currentEmployeeThreadId = null
    this.optTeamChatContext = null
    this.employeeQuotingMessage = null
    this.employeePendingPrefillText = null
    if (this.employeeChatHost === 'collaboration') {
      this.collaborationDigitalHumanOpeningAgentId = null
    }
  },

  /**
   * 一人团队默认进入「我的员工」：选中列表首位员工的会话（无会话则创建）。
   * @returns {Promise<{ employeeId: string, threadId: string } | null>}
   */
  async selectFirstEmployeeConversation() {
    await this.loadEmployeeItems({ force: true })
    return selectFirstEmployeeFromLoadedList(this)
  },

  /**
   * 在 employeeChatEmployees 已是最新时使用：仅对首位员工 GET personal/threads 并选中（不重复拉 agents/my）
   * @returns {Promise<{ employeeId: string, threadId: string } | null>}
   */
  async selectFirstEmployeeFromLoadedListOnly() {
    return selectFirstEmployeeFromLoadedList(this)
  },

  async selectEmployeeThread(employeeId, threadId) {
    if (!employeeId) return
    const isOptTeam = String(employeeId).startsWith('optTeam_')
    if (!isOptTeam) {
      this.optTeamChatContext = null
    }
    let threads = this._ensureEmployeeThreads(employeeId)
    const tid = threadId != null && threadId !== '' ? String(threadId) : ''
    const hasThread = Boolean(tid && threads.some((t) => String(t.id) === tid))
    if (!threads.length || (tid && !hasThread)) {
      await this.fetchEmployeeThreads(employeeId)
      threads = this._ensureEmployeeThreads(employeeId)
    }
    let targetThreadId = threadId || threads[0]?.id

    if (!targetThreadId) {
      if (isOptTeam) return
      const thread = await this.createEmployeeThread(employeeId)
      targetThreadId = thread?.id
    }
    if (!targetThreadId) return

    if (isOptTeam && !this.optTeamChatContext) {
      const tid = String(employeeId).slice('optTeam_'.length)
      this.optTeamChatContext = {
        teamId: tid,
        teamName: '一人团队',
        coordinatorAgentId: '',
      }
    }

    // 切走时清理未发送消息的占位会话
    const prevId = this.currentEmployeeId
    const prevThreadId = this.currentEmployeeThreadId
    if (prevId && prevThreadId && (prevId !== employeeId || prevThreadId !== targetThreadId)) {
      const prevThreads = this._ensureEmployeeThreads(prevId)
      const prevThread = prevThreads.find(t => t.id === prevThreadId)
      if (prevThread?._pending) {
        const prevState = this.getEmployeeThreadState(prevId, prevThreadId)
        const hasUserMessage = prevState?.messages?.some(m => m.role === 'user')
        if (!hasUserMessage) {
          this._removePendingThread(prevId, prevThreadId)
        }
      }
    }

    this._ensureEmployeeThreadState(employeeId, targetThreadId)
    this.employeeChatMode = isOptTeam ? 'one_person_team' : 'employee'
    this.currentEmployeeId = employeeId
    this.currentEmployeeThreadId = targetThreadId
    this.employeeQuotingMessage = null
    await this.loadEmployeeMessages(employeeId, targetThreadId)
    await this.loadEmployeeChatModels(employeeId, targetThreadId)
  },

  /**
   * 协作模块「数字人」创建 personal thread 后写入本 store 并选中会话
   *（协作侧使用 useCollaborationEmployeeChatStore，与一人团队 store 隔离）。
   * 不调用 GET /api/v1/agents/my：先拉协作数字人列表（agent-usage），再 GET personal/threads 拉全会话。
   * @param {string|number} agentId
   * @param {object} threadRaw createThread 返回体
   * @param {object|null} agentMeta digitalHumanStore.currentAgent 或资料卡补全字段
   */
  async applyCollaborationDigitalHumanSession(agentId, threadRaw, agentMeta = null) {
    const aid = String(agentId ?? '').trim()
    if (!aid || !threadRaw) return

    if (this.employeeChatHost === 'collaboration') {
      await loadCollaborationDigitalHumanEmployeeList(this, { force: true })
    }

    let employee = this.employeeChatEmployees.find((e) => String(e.id) === aid)
    if (!employee) {
      if (agentMeta) {
        const normalized = normalizeEmployeeItem({
          id: agentMeta.agent_id ?? agentMeta.agentId ?? aid,
          name: agentMeta.agent_display_name || agentMeta.agent_name,
          avatar: agentMeta.agent_avatar_url || agentMeta.avatar,
          raw: agentMeta,
        })
        if (normalized) {
          this.employeeChatEmployees = [...this.employeeChatEmployees, normalized]
          employee = normalized
        }
      }
      if (!employee) {
        const normalized = normalizeEmployeeItem({
          id: aid,
          name: `Agent ${aid}`,
        })
        if (normalized) {
          this.employeeChatEmployees = [...this.employeeChatEmployees, normalized]
          employee = normalized
        }
      }
    }
    if (!employee) {
      console.warn('[CollaborationEmployeeChat] applyCollaborationDigitalHumanSession: unknown agent', aid)
      return
    }

    const thread = normalizePersonalThread(threadRaw)
    if (!thread?.id) return

    await this.fetchEmployeeThreads(employee.id)

    const threads = this._ensureEmployeeThreads(employee.id)
    const idx = threads.findIndex((t) => String(t.id) === String(thread.id))
    if (idx >= 0) {
      threads[idx] = { ...threads[idx], ...thread }
    } else {
      threads.unshift(thread)
    }

    await this.selectEmployeeThread(employee.id, thread.id)
  },

  /**
   * 协作侧栏「数字人」点击：与一人团队「我的员工」一致——有历史则进入最近一条，否则创建新会话。
   * @param {string|number} agentId
   * @param {object|null} agentMeta 侧栏列表项（含 agent_id、名称、头像等）
   * @returns {Promise<object|null>} 选中的 thread；无法打开时为 null
   */
  async enterCollaborationDigitalHumanExistingSession(agentId, agentMeta = null) {
    if (this.employeeChatHost !== 'collaboration') return null
    const aid = String(agentId ?? '').trim()
    if (!aid) return null

    const digitalHumanStore = useDigitalHumanStore()
    const openingKey = agentMeta?.agent_id ?? agentMeta?.agentId ?? agentId
    if (this.collaborationDigitalHumanOpeningAgentId) return null
    this.collaborationDigitalHumanOpeningAgentId = openingKey

    try {
      await loadCollaborationDigitalHumanEmployeeList(this, { force: false })

      let employee = this.employeeChatEmployees.find((e) => String(e.id) === aid)
      if (!employee) {
        const meta = agentMeta || digitalHumanStore.agents.find((a) => String(a.agent_id ?? a.agentId) === aid)
        if (meta) {
          const normalized = normalizeEmployeeItem({
            id: meta.agent_id ?? meta.agentId ?? aid,
            name: meta.agent_display_name || meta.agent_name,
            avatar: meta.agent_avatar_url,
            pinned: meta.pinned,
            pinnedAt: meta.pinned_at,
            conversationScope: 'employee',
            raw: meta,
          })
          if (normalized) {
            this.employeeChatEmployees = [...this.employeeChatEmployees, normalized]
            employee = normalized
          }
        }
      }
      if (!employee) {
        ElMessage.warning('未找到该数字人')
        this.activateRoomChat()
        return null
      }

      await this.fetchEmployeeThreads(employee.id)
      const threads = this.getEmployeeThreads(employee.id)
      if (!threads.length) {
        try {
          await digitalHumanStore.openAgent(Number(aid), '新对话')
          const payload = digitalHumanStore.currentThreadPayload
          if (!payload?.id) throw new Error('创建会话失败')
          await this.applyCollaborationDigitalHumanSession(agentId, payload, agentMeta)
          return payload
        } catch {
          this.activateRoomChat()
          return null
        }
      }

      const latest = threads[0]
      await this.selectEmployeeThread(employee.id, latest.id)

      return latest
    } catch (err) {
      console.error('[CollaborationDigitalHuman] enter existing session failed:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '打开数字人失败'))
      throw err
    } finally {
      this.collaborationDigitalHumanOpeningAgentId = null
    }
  },

  async loadEmployeeModels() {
    if (this.employeeLoadingModels) return
    this.employeeLoadingModels = true
    try {
      const data = await fetchEmployeeModels()
      this.employeeModels = data.models || []
      if (!this.employeeSelectedModelName && this.employeeModels.length > 0) {
        this.employeeSelectedModelName = this.employeeModels[0].name
      }
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to load models:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '加载模型列表失败'))
      if (!this.employeeSelectedModelName) this.employeeSelectedModelName = 'qwen-plus-default'
    } finally {
      this.employeeLoadingModels = false
    }
  },

  /**
   * GET/PUT 对话模型接口使用的 agent_id：一人团队桶 optTeam_* 用协调者 id，其余用员工 id
   */
  _resolveEmployeeChatModelAgentId(employeeId) {
    if (String(employeeId ?? '').startsWith('optTeam_')) {
      return String(this.optTeamChatContext?.coordinatorAgentId ?? '').trim()
    }
    return String(employeeId ?? '').trim()
  },

  async loadEmployeeChatModels(employeeId, threadId, channel = this.employeeModelChannel) {
    const modelState = this._ensureEmployeeModelState(employeeId, threadId)
    if (!modelState || !employeeId) return modelState
    if (modelState.loading) return modelState.loadingPromise || modelState
    modelState.loading = true
    this.employeeLoadingChatModels = true
    modelState.loadingPromise = (async () => {
      const agentId = this._resolveEmployeeChatModelAgentId(employeeId)
      if (!agentId) {
        console.warn('[SoloTeamEmployee] loadEmployeeChatModels: missing agent id for', employeeId)
        modelState.currentModel = null
        modelState.availableModels = []
        modelState.loaded = true
        return modelState
      }
      const data = await fetchEmployeeChatModels(agentId, channel)
      modelState.currentModel = data.current_model
      modelState.availableModels = data.available_models || []
      modelState.loaded = true
      // 用户手动选择过模型时，不覆盖（切换会话保持用户选择）
      if (this.employeeUserSelectedModelName) {
        modelState.selectedModelName = this.employeeUserSelectedModelName
        const matchedModel = modelState.availableModels.find(
          m => m.model_name === this.employeeUserSelectedModelName
        )
        if (matchedModel) {
          modelState.currentModel = matchedModel
        }
      } else if (data.current_model?.model_name) {
        modelState.selectedModelName = data.current_model.model_name
      } else if (modelState.availableModels.length > 0) {
        modelState.selectedModelName = modelState.availableModels[0].model_name
      } else if (this.employeeSelectedModelName) {
        modelState.selectedModelName = this.employeeSelectedModelName
      }
      this.employeeChatCurrentModel = modelState.currentModel
      this.employeeChatAvailableModels = modelState.availableModels
      this.employeeSelectedModelName = modelState.selectedModelName || this.employeeSelectedModelName
      return modelState
    })()
    try {
      await modelState.loadingPromise
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to load chat models:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '加载对话模型失败'))
      if (!modelState.selectedModelName && this.employeeSelectedModelName) {
        modelState.selectedModelName = this.employeeSelectedModelName
      }
    } finally {
      modelState.loading = false
      modelState.loadingPromise = null
      this.employeeLoadingChatModels = false
    }
    return modelState
  },

  /**
   * 用户切换当前员工线程所用模型（写入线程 modelState，保证 send 时 currentModel 与 model_name 一致）
   */
  setEmployeeSelectedModel(employeeId, threadId, modelName) {
    if (!employeeId || !threadId) return
    const name = String(modelName || '').trim()
    if (!name) return
    const modelState = this._ensureEmployeeModelState(employeeId, threadId)
    modelState.selectedModelName = name
    const avail = modelState.availableModels || []
    const picked = avail.find(m => m.model_name === name || m.name === name)
    if (picked) {
      modelState.currentModel = picked
    }
    this.employeeSelectedModelName = name
    this.employeeUserSelectedModelName = name
    if (
      String(this.currentEmployeeId) === String(employeeId)
      && String(this.currentEmployeeThreadId) === String(threadId)
    ) {
      this.employeeChatCurrentModel = modelState.currentModel
      this.employeeChatAvailableModels = avail
    }
  },

  /**
   * 用户手动选择模式（切换会话不重置）
   */
  setEmployeeSelectedMode(mode) {
    this.employeeUserSelectedMode = mode
  },

  /**
   * 切换对话模型并持久化（与「我的分身」Deerflow updateModelSelection 对齐）
   */
  async updateEmployeeChatModelSelection(employeeId, threadId, modelName) {
    const eid = String(employeeId ?? '').trim()
    const tid = String(threadId ?? '').trim()
    const name = String(modelName ?? '').trim()
    if (!eid || !tid || !name) return

    const agentId = this._resolveEmployeeChatModelAgentId(eid)
    if (!agentId) {
      console.warn('[SoloTeamEmployee] updateEmployeeChatModelSelection: missing agent id')
      return
    }

    const modelState = this._getEmployeeModelState(eid, tid) || this._ensureEmployeeModelState(eid, tid)
    const avail = modelState?.availableModels || []
    const modelConfig = avail.find(m => m.model_name === name || m.name === name)
    if (!modelConfig) {
      console.warn('[SoloTeamEmployee] Model config not found for:', name)
      return
    }

    try {
      await updateEmployeeModelSelection({
        channel: this.employeeModelChannel,
        provider_config_id: modelConfig.provider_config_id ?? null,
        model_config_id: modelConfig.model_config_id ?? null,
        agent_id: agentId,
      })
      await this.loadEmployeeChatModels(eid, tid)
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to update model selection:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '切换模型失败，请重试'))
      throw err
    }
  },

  async fetchEmployeeThreads(employeeId, { selectFirst = false } = {}) {
    if (!employeeId) return []
    if (String(employeeId).startsWith('optTeam_')) {
      return this.employeeThreadsByEmployeeId[employeeId] || []
    }
    if (this.loadingEmployeeThreadsByEmployeeId[employeeId]) {
      return this.employeeThreadsByEmployeeId[employeeId] || []
    }
    this.loadingEmployeeThreadsByEmployeeId[employeeId] = true
    try {
      const requestEmployeeId = this._usesSharedPersonalThreads(employeeId) ? null : employeeId
      const res = await employeeThreadApi.getThreads({ employeeId: requestEmployeeId })
      const list = Array.isArray(res) ? res : (res?.items || [])
      const threads = [...list]
        .map(thread => this._attachEmployeeOwner(thread, employeeId))
        .sort((a, b) => {
          const aPinned = a.is_pinned ? 1 : 0
          const bPinned = b.is_pinned ? 1 : 0
          if (aPinned !== bPinned) return bPinned - aPinned
          return new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0)
        })
      // 保留尚未通过 API 创建的本地占位会话
      const existing = this.employeeThreadsByEmployeeId[employeeId] || []
      const pending = existing.filter(t => t._pending)
      this.employeeThreadsByEmployeeId[employeeId] = [...threads, ...pending]
      if (selectFirst && threads[0]) {
        await this.selectEmployeeThread(employeeId, threads[0].id)
      }
      return threads
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to fetch threads:', err)
      ElMessage.error(soloTeamApiErrorMessage(err, '加载会话列表失败'))
      this.employeeThreadsByEmployeeId[employeeId] = this.employeeThreadsByEmployeeId[employeeId] || []
      return this.employeeThreadsByEmployeeId[employeeId]
    } finally {
      this.loadingEmployeeThreadsByEmployeeId[employeeId] = false
    }
  },

  async createEmployeeThread(employeeId, title = '新对话') {
    if (String(employeeId).startsWith('optTeam_')) {
      ElMessage.info('一人团队子会话请从团队助理内创建')
      return null
    }
    const threads = this._ensureEmployeeThreads(employeeId)
    const placeholder = {
      id: `pending_${employeeId}_${Date.now()}`,
      title: title || '新对话',
      langgraph_thread_id: null,
      thread_type: 'personal',
      agent_id: String(employeeId),
      employeeId: String(employeeId),
      employee_owner_id: String(employeeId),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    }
    threads.unshift(placeholder)
    this._ensureEmployeeThreadState(employeeId, placeholder.id)
    await this.selectEmployeeThread(employeeId, placeholder.id)
    return placeholder
  },

  async renameEmployeeThread(employeeId, threadId, title) {
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find((item) => item.id === threadId)
    if (!thread) return
    const value = String(title || '').trim()
    if (!value) return
    if (!thread._pending) {
      await employeeThreadApi.renameThread(threadId, value, thread.langgraph_thread_id)
    }
    thread.title = value
    thread.updated_at = new Date().toISOString()
  },

  _removePendingThread(employeeId, threadId) {
    const threads = this._ensureEmployeeThreads(employeeId)
    const idx = threads.findIndex((item) => item.id === threadId)
    if (idx < 0) return
    threads.splice(idx, 1)
    delete this.employeeThreadStates[this._buildEmployeeThreadStateKey(employeeId, threadId)]
    delete this.employeeModelStateByThreadKey[this._buildEmployeeThreadStateKey(employeeId, threadId)]
  },

  async deleteEmployeeThread(employeeId, threadId) {
    const threads = this._ensureEmployeeThreads(employeeId)
    const idx = threads.findIndex((item) => item.id === threadId)
    if (idx < 0) return

    const thread = threads[idx]
    const st = this.employeeThreadStates[this._buildEmployeeThreadStateKey(employeeId, threadId)]
    this._disposeEmployeeStreamForState(st)

    if (!thread._pending) {
      await employeeThreadApi.deleteThread(threadId)
    }
    threads.splice(idx, 1)
    delete this.employeeThreadStates[this._buildEmployeeThreadStateKey(employeeId, threadId)]
    delete this.employeeModelStateByThreadKey[this._buildEmployeeThreadStateKey(employeeId, threadId)]

    if (this.currentEmployeeId === employeeId && this.currentEmployeeThreadId === threadId) {
      const nextThread = threads[Math.max(0, idx - 1)] || threads[0]
      if (nextThread) await this.selectEmployeeThread(employeeId, nextThread.id)
      else {
        this.currentEmployeeThreadId = null
      }
    }
  },

  async pinEmployeeThread(employeeId, threadId) {
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    if (!thread || thread._pending) return
    await employeeThreadApi.pinThread(threadId)
    thread.is_pinned = true
    thread.updated_at = new Date().toISOString()
    this.employeeThreadsByEmployeeId[employeeId] = [...threads].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0
      const bPinned = b.is_pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    })
  },

  async unpinEmployeeThread(employeeId, threadId) {
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    if (!thread || thread._pending) return
    await employeeThreadApi.unpinThread(threadId)
    thread.is_pinned = false
    thread.updated_at = new Date().toISOString()
    this.employeeThreadsByEmployeeId[employeeId] = [...threads].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0
      const bPinned = b.is_pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    })
  },

  /** 对齐 deerflow touchThread：首条消息自动生成标题并持久化（乐观更新） */
  async touchEmployeeThread(employeeId, threadId, text) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    if (!thread) return
    const isDefaultTitle = !thread.title || thread.title === '新对话' || thread.title === 'New Chat'
    if (!isDefaultTitle) return
    const newTitle = makeAutoTitle(text)
    if (!newTitle || newTitle === thread.title) return
    thread.title = newTitle
    const lgId = thread.langgraph_thread_id
    employeeThreadApi.renameThread(threadId, newTitle, lgId).catch(() => {})
  },

  submitEmployeeFeedback(employeeId, threadId, messageId, type) {
    if (!employeeId || !threadId || !messageId) return
    const state = this.getEmployeeThreadState(employeeId, threadId)
    if (!state?.messages) return
    const msg = state.messages.find(m => m.id === messageId)
    if (msg) msg.feedback = type
  },

  async loadEmployeeMessages(employeeId, threadId, { force = false } = {}) {
    if (!employeeId || !threadId) return
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state || (state.loaded && !force) || state.loadingMessages || state.isStreaming) return

    const thread = this._ensureEmployeeThreads(employeeId).find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) {
      state.messages = []
      state.loaded = true
      return
    }

    state.loadingMessages = true
    state.error = null
    try {
      const page = await employeeThreadApi.getThreadMessagesPage(threadId)
      let rawMessages = page.history_messages || []
      const uiMessages = this._buildEmployeeUiMessagesFromRaw(rawMessages, lgId)

      state.messages = uiMessages
      state.hasMore = page.hasMore || false
      state.nextBeforeSeq = page.nextBeforeSeq
      state.ledgerBackfillPending = rawMessages.length === 0 && !page.hasMore ? false : (page.ledgerBackfillPending || false)
      state.persistedMessageCount = uiMessages.length
      state.loaded = true
    } catch (err) {
      console.error('[SoloTeamEmployee] Failed to load messages:', err)
      state.error = soloTeamApiErrorMessage(err, '加载消息失败')
    } finally {
      state.loadingMessages = false
    }
  },

  async loadEmployeeOlderPage(employeeId, threadId) {
    if (!employeeId || !threadId) return
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state || state.loadingOlderPage || state.ledgerBackfillPending || !state.hasMore) return

    const thread = this._ensureEmployeeThreads(employeeId).find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return

    state.loadingOlderPage = true
    try {
      const page = await employeeThreadApi.getThreadMessagesPage(threadId, {
        beforeSeq: state.nextBeforeSeq,
      })
      const rawMessages = page.history_messages || []
      if (rawMessages.length > 0) {
        const olderUi = this._buildEmployeeUiMessagesFromRaw(rawMessages, lgId)
        state.messages = [...olderUi, ...state.messages]
      }
      state.hasMore = page.hasMore || false
      state.nextBeforeSeq = page.nextBeforeSeq
      state.ledgerBackfillPending = rawMessages.length === 0 && !page.hasMore ? false : (page.ledgerBackfillPending || false)
      state.persistedMessageCount = state.messages.length
    } catch (err) {
      console.warn('[SoloTeamEmployee] loadOlderPage failed:', err)
    } finally {
      state.loadingOlderPage = false
    }
  },

  async sendEmployeeMessage(employeeId, threadId, text, files = [], options = {}) {
    const content = String(text || '').trim()
    const skills = options.skills || []
    if (!content && files.length === 0 && (!skills || skills.length === 0)) return

    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state || state.sendingMessage || state.isStreaming) return

    const threads = this._ensureEmployeeThreads(employeeId)
    let thread = threads.find((item) => item.id === threadId)
    if (!thread) return

    let lgId = thread.langgraph_thread_id
    if (!lgId) {
      try {
        const requestEmployeeId = this._usesSharedPersonalThreads(employeeId) ? null : employeeId
        const created = await employeeThreadApi.createThread(thread.title || '新对话', requestEmployeeId)
        const realThread = this._attachEmployeeOwner(created, employeeId)

        const idx = threads.findIndex(t => t.id === threadId)
        if (idx >= 0) threads[idx] = realThread
        else threads.unshift(realThread)

        const oldKey = this._buildEmployeeThreadStateKey(employeeId, threadId)
        const newKey = this._buildEmployeeThreadStateKey(employeeId, realThread.id)
        if (this.employeeThreadStates[oldKey]) {
          this.employeeThreadStates[newKey] = this.employeeThreadStates[oldKey]
          delete this.employeeThreadStates[oldKey]
        }
        if (this.employeeModelStateByThreadKey[oldKey]) {
          this.employeeModelStateByThreadKey[newKey] = this.employeeModelStateByThreadKey[oldKey]
          delete this.employeeModelStateByThreadKey[oldKey]
        }

        if (this.currentEmployeeThreadId === threadId) {
          this.currentEmployeeThreadId = realThread.id
        }

        const uiStore = useUIStore()
        const navSection = this.employeeChatHost === 'collaboration' ? 'collaboration' : 'solo-team'
        const navValue = this.employeeChatHost === 'collaboration'
          ? `digital-human-${employeeId}`
          : `employee:${employeeId}:${realThread.id}`
        uiStore.setActiveNavigation(navSection, navValue)

        threadId = realThread.id
        thread = realThread
        lgId = realThread.langgraph_thread_id

        if (!lgId) {
          state.error = '创建会话失败，请稍后重试'
          return
        }
      } catch (err) {
        console.error('[SoloTeamEmployee] Failed to create thread on first send:', err)
        state.error = '创建会话失败，请稍后重试'
        return
      }
    }

    this.touchEmployeeThread(employeeId, threadId, content)

    state.error = null
    state.sendingMessage = true
    state.isStreaming = true

    const userMsgId = `user_${nowTs()}`
    const replyTo = options.replyTo || null
    state.messages.push(createMessage('user', content, {
      id: userMsgId,
      isOptimistic: true,
      ...(replyTo ? { replyTo: { id: replyTo.id, role: replyTo.role, content: replyTo.content, timestamp: replyTo.timestamp } } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      attachments: files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        mimeType: file.type,
        url: '',
        thumbnailUrl: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '',
      })),
    }))

    const aiMsgId = `ai_${nowTs()}`
    state.messages.push(createMessage('assistant', '', {
      id: aiMsgId,
      isOptimistic: true,
      isStreaming: true,
    }))
    state.streamingMessageId = aiMsgId

    let uploadedFiles = []
    try {
      if (files.length > 0) {
        state.uploadingFiles = true
        const result = await employeeThreadApi.uploadFiles(lgId, files)
        uploadedFiles = result?.files || result?.data?.files || []
        state.uploadingFiles = false
        const userMsg = state.messages.find(item => item.id === userMsgId)
        if (userMsg?.attachments) {
          const prevThumbs = userMsg.attachments.map(a => a.thumbnailUrl || '')
          userMsg.attachments = uploadedFiles.map((file, idx) => {
            const name = file.name || file.filename || files[idx]?.name || '未命名文件'
            const fromApi = file.artifact_url || file.url || file.file_url
            let url = ''
            if (fromApi) url = toAbsoluteEmployeeMediaUrl(fromApi)
            else if (file.virtual_path) url = resolveEmployeeArtifactURL(lgId, file.virtual_path)
            else url = buildEmployeeUploadArtifactUrl(lgId, name)
            const mimeType = file.mime_type || file.type || files[idx]?.type || ''
            const localThumb = prevThumbs[idx] || ''
            if (localThumb.startsWith('blob:')) {
              try { URL.revokeObjectURL(localThumb) } catch { /* noop */ }
            }
            return {
              name,
              url,
              thumbnailUrl: url || localThumb,
              size: Number(file.size || files[idx]?.size || 0),
              type: file.type || file.mime_type || files[idx]?.type || '',
              mimeType,
            }
          })
        }
      }

      const additionalKwargs = {}
      if (uploadedFiles.length > 0) additionalKwargs.files = uploadedFiles
      if (options.skills?.length) {
        const skillIdPayload = buildEmployeeSkillItems(options.skills)
        if (skillIdPayload) additionalKwargs.skill_id = skillIdPayload
      }

      const runMode = options.mode || 'flash'
      let modelState = this._getEmployeeModelState(employeeId, threadId)
      if (!modelState?.loaded) {
        modelState = await this.loadEmployeeChatModels(employeeId, threadId)
      }
      const selectedModelName = modelState?.selectedModelName || this.employeeSelectedModelName
      const currentModel = modelState?.currentModel || this.employeeChatCurrentModel
      const modelName = options.model || selectedModelName || 'qwen-plus-default'
      const streamMgr = this._getOrCreateEmployeeStreamManager(employeeId, threadId)
      if (!streamMgr) {
        state.error = '无法创建流式连接，请刷新后重试'
        state.messages = state.messages.filter(m => m.id !== userMsgId && m.id !== aiMsgId)
        state.isStreaming = false
        state.streamingMessageId = null
        return
      }
      const rawHistory = state.messages
        .filter(m => m.raw)
        .map(m => m.raw)
      streamMgr.setInitialMessages(rawHistory)

      const sendText = this._buildEmployeeSendText(content, options.replyTo)

      const contextPayload = buildEmployeeStreamContext({
        mode: runMode,
        modelName,
        lgId,
        currentModel,
      })

      await streamMgr.submit(
        {
          messages: [{
            type: 'human',
            content: [{ type: 'text', text: sendText }],
            additional_kwargs: additionalKwargs,
          }],
        },
        contextPayload,
        {
          onFinish: () => {
            this._finishEmployeeStreamSession(employeeId, threadId)
            this.fetchEmployeeThreads(employeeId)
          },
          onError: (error) => {
            this._handleEmployeeStreamError(employeeId, threadId, aiMsgId, error)
          },
          onUpdateEvent: (data) => {
            const updates = Object.values(data || {})
            for (const update of updates) {
              if (update && typeof update === 'object' && 'title' in update && update.title) {
                const t = threads.find((item) => item.id === threadId)
                if (t) t.title = update.title
              }
            }
          },
          onCustomEvent: (event) => {
            if (event?.type === 'llm_retry' && event?.message) {
              console.warn('[EmployeeStream] LLM retry:', event.message)
            }
          },
          onLangChainEvent: (event) => {
            if (event?.event === 'on_tool_end') {
              console.log('[EmployeeStream] tool_end:', event.name, event.data)
            }
          },
        },
      )
    } catch (err) {
      this._handleEmployeeStreamError(employeeId, threadId, aiMsgId, err)
    } finally {
      state.sendingMessage = false
      state.uploadingFiles = false
      if (state.isStreaming) {
        state.isStreaming = false
        state.streamingMessageId = null
      }
    }
  },

  /**
   * 重新生成最后一条助手回复（与「我的分身」Deerflow 一致：type remove + 同一路径流式）
   */
  async regenerateEmployeeLastMessage(employeeId = this.currentEmployeeId, threadId = this.currentEmployeeThreadId, options = {}) {
    if (!employeeId || !threadId) return
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state || state.sendingMessage || state.isStreaming) return

    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find((item) => item.id === threadId)
    if (!thread) return

    const lgId = thread.langgraph_thread_id
    if (!lgId) {
      state.error = '该会话尚未关联 LangGraph 线程，请重新创建会话'
      return
    }

    const lastAiIdx = [...state.messages].reverse().findIndex(m => m.role === 'assistant')
    if (lastAiIdx === -1) {
      ElMessage.warning('没有可重新生成的消息')
      return
    }
    const actualIdx = state.messages.length - 1 - lastAiIdx
    const lastAi = state.messages[actualIdx]
    const lastAiId = lastAi?.raw?.id || lastAi?.id
    if (!lastAiId) {
      ElMessage.warning('消息 ID 缺失，无法重新生成')
      return
    }

    const {
      mode = 'flash',
      model: optionModel,
      skills = [],
    } = options

    try {
      await employeeThreadApi.renameThread(threadId, thread.title || '新对话', lgId)
    } catch (err) {
      console.warn('[SoloTeamEmployee] Failed to touch thread before regenerating:', err)
    }
    await this.fetchEmployeeThreads(employeeId)

    const aiMsgId = lastAi.id
    lastAi.content = ''
    lastAi.isStreaming = true
    lastAi.isOptimistic = true
    lastAi.hasError = false

    state.streamingMessageId = aiMsgId
    state.sendingMessage = true
    state.isStreaming = true

    const removeKwargs = {}
    if (skills && skills.length > 0) {
      const skillIdPayload = buildEmployeeSkillItems(skills)
      if (skillIdPayload) removeKwargs.skill_id = skillIdPayload
    }

    let modelState = this._getEmployeeModelState(employeeId, threadId)
    if (!modelState?.loaded) {
      modelState = await this.loadEmployeeChatModels(employeeId, threadId)
    }
    const selectedModelName = modelState?.selectedModelName || this.employeeSelectedModelName
    const currentModel = modelState?.currentModel || this.employeeChatCurrentModel
    const modelName = optionModel || selectedModelName || 'qwen-plus-default'
    const runMode = mode || 'flash'

    try {
      const streamMgr = this._getOrCreateEmployeeStreamManager(employeeId, threadId)
      if (!streamMgr) {
        state.error = '无法创建流式连接，请刷新后重试'
        await this.loadEmployeeMessages(employeeId, threadId, { force: true })
        state.sendingMessage = false
        state.isStreaming = false
        state.streamingMessageId = null
        return
      }
      const rawHistory = state.messages
        .filter(m => m.raw)
        .map(m => m.raw)
        .filter(m => m.id !== lastAiId)
      streamMgr.setInitialMessages(rawHistory)

      const contextPayload = buildEmployeeStreamContext({
        mode: runMode,
        modelName,
        lgId,
        currentModel,
      })

      await streamMgr.submit(
        {
          messages: [{
            type: 'remove',
            id: lastAiId,
            content: '',
            additional_kwargs: removeKwargs,
          }],
        },
        contextPayload,
        {
          onFinish: () => {
            this._finishEmployeeStreamSession(employeeId, threadId)
            this.fetchEmployeeThreads(employeeId)
          },
          onError: (error) => {
            this._handleEmployeeStreamError(employeeId, threadId, aiMsgId, error)
          },
          onUpdateEvent: () => {},
          onCustomEvent: () => {},
          onLangChainEvent: () => {},
        },
      )
    } catch (err) {
      this._handleEmployeeStreamError(employeeId, threadId, aiMsgId, err)
    } finally {
      state.sendingMessage = false
      if (state.isStreaming) {
        state.isStreaming = false
        state.streamingMessageId = null
      }
    }
  },

  stopEmployeeStreaming(employeeId = this.currentEmployeeId, threadId = this.currentEmployeeThreadId) {
    const state = this.getEmployeeThreadState(employeeId, threadId)
    if (state?.streamManager) {
      state.streamManager.stop()
    }
    if (state) {
      const aiMsgId = state.streamingMessageId
      if (aiMsgId) {
        const aiMsg = state.messages.find(m => m.id === aiMsgId)
        if (aiMsg) {
          aiMsg.isStreaming = false
          aiMsg.isOptimistic = false
          if (!String(aiMsg.content || '').trim()) {
            aiMsg.content = '[已停止生成]'
          }
        }
      }
      state.isStreaming = false
      state.streamingMessageId = null
      state.sendingMessage = false
    }
  },

  setEmployeeQuotingMessage(message) {
    this.employeeQuotingMessage = message
  },

  clearEmployeeQuotingMessage() {
    this.employeeQuotingMessage = null
  },

  setEmployeePendingPrefillText(text) {
    const value = String(text || '').trim()
    this.employeePendingPrefillText = value || null
  },

  clearEmployeePendingPrefillText() {
    this.employeePendingPrefillText = null
  },

  _buildEmployeeSendText(text, replyTo) {
    if (!replyTo?.content) return text
    const quoted = String(replyTo.content).split('\n').map(line => `> ${line}`).join('\n')
    return `${quoted}\n\n${text}`
  },

  _handleEmployeeStreamError(employeeId, threadId, aiMsgId, error) {
    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    let aiMsg = state?.messages.find(item => item.id === aiMsgId)
    if (!aiMsg && state) {
      aiMsg = [...state.messages].reverse().find(
        m => m.role === 'assistant' && (m.isStreaming || m.isOptimistic),
      )
    }
    if (aiMsg) {
      aiMsg.isStreaming = false
      aiMsg.hasError = true
      aiMsg.content = aiMsg.content || '消息发送失败，请稍后重试。'
    }
    if (state) {
      state.error = soloTeamApiErrorMessage(error, '发送失败')
      state.isStreaming = false
      state.streamingMessageId = null
      state.sendingMessage = false
    }
  },

  // ─── 流重连 ──────────────────────────────────────────────

  /**
   * 尝试重连活跃的 run 流（页面刷新/断线后恢复）。
   * 检查 sessionStorage 中是否有活跃 run_id，有则走 joinStream 恢复。
   * @returns {Promise<boolean>} 是否成功触发重连
   */
  async tryReconnectEmployeeStream(employeeId = this.currentEmployeeId, threadId = this.currentEmployeeThreadId) {
    if (!employeeId || !threadId) return false
    const threadKey = buildThreadStateKey(employeeId, threadId)
    const runId = getStoredEmployeeRunId(threadKey)
    if (!runId) return false

    const state = this._ensureEmployeeThreadState(employeeId, threadId)
    if (!state || state.isStreaming) return false

    const thread = this._ensureEmployeeThreads(employeeId).find((item) => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) {
      clearStoredEmployeeRunId(threadKey)
      return false
    }

    try {
      const streamMgr = this._getOrCreateEmployeeStreamManager(employeeId, threadId)
      if (!streamMgr) return false

      state.isStreaming = true
      await streamMgr.reconnect(runId, {
        onFinish: () => {
          this._finishEmployeeStreamSession(employeeId, threadId)
          this.fetchEmployeeThreads(employeeId)
        },
        onError: (err) => {
          this._handleEmployeeStreamError(employeeId, threadId, null, err)
        },
      })
      return true
    } catch (err) {
      clearStoredEmployeeRunId(threadKey)
      console.warn('[SoloTeamEmployee] Reconnect failed:', err)
      return false
    }
  },

  // ─── 数字人切换 ──────────────────────────────────────────

  /** 切换当前会话绑定的数字人/智能体 */
  async switchEmployeeAgent(employeeId, threadId, agentId) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    if (!thread || thread._pending) return
    await employeeThreadApi.switchDigitalHuman(threadId, agentId)
    thread.agent_id = agentId
    thread.updated_at = new Date().toISOString()
    this.employeeThreadsByEmployeeId[employeeId] = [...threads]
  },

  // ─── @提及 ────────────────────────────────────────────────

  /** @提及数字人 */
  async mentionAgentInEmployeeChat(employeeId, threadId, content, agentName) {
    if (!employeeId || !threadId || !content) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    if (!thread || thread._pending) return
    return employeeThreadApi.mentionAgent(threadId, content, agentName)
  },

  // ─── 上下文管理 ──────────────────────────────────────────

  /** 获取当前线程上下文大小 */
  async getEmployeeChatContextSize(employeeId, threadId) {
    if (!employeeId || !threadId) return null
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return null
    return employeeThreadApi.getContextSize(lgId)
  },

  /** 手动触发上下文压缩 */
  async summarizeEmployeeChatContext(employeeId, threadId, force = false) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeThreadApi.summarizeContext(lgId, force)
  },

  // ─── 文件管理 ────────────────────────────────────────────

  /** 获取线程上传文件列表 */
  async fetchEmployeeThreadUploadedFiles(employeeId, threadId) {
    if (!employeeId || !threadId) return []
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return []
    return employeeThreadApi.getUploadedFiles(lgId)
  },

  /** 删除线程上传文件 */
  async deleteEmployeeThreadUploadedFile(employeeId, threadId, filename) {
    if (!employeeId || !threadId || !filename) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeThreadApi.deleteUploadedFile(lgId, filename)
  },

  /** 会话文件保存到 kc-media */
  async saveEmployeeThreadArtifact(employeeId, threadId, sourceUrl, fileName, identity = {}) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeThreadApi.saveThreadArtifactToKcMedia(lgId, sourceUrl, fileName, identity)
  },

  // ─── Run 生命周期 ────────────────────────────────────────

  /** 创建后台 run */
  async createEmployeeRun(employeeId, threadId, input, context = {}) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeRunApi.createRun(lgId, input, context)
  },

  /** 取消活跃 run */
  async cancelEmployeeRun(employeeId, threadId, runId, options = {}) {
    if (!employeeId || !threadId || !runId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeRunApi.cancelRun(lgId, runId, options)
  },

  /** 获取 run 列表 */
  async getEmployeeRuns(employeeId, threadId) {
    if (!employeeId || !threadId) return []
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return []
    return employeeRunApi.getRuns(lgId)
  },

  /** 获取 run 详情 */
  async getEmployeeRun(employeeId, threadId, runId) {
    if (!employeeId || !threadId || !runId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeRunApi.getRun(lgId, runId)
  },

  // ─── Thread State ─────────────────────────────────────────

  /** 获取线程状态 */
  async getEmployeeThreadState(employeeId, threadId) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeThreadApi.getThreadState(lgId)
  },

  /** 更新线程状态 */
  async updateEmployeeThreadState(employeeId, threadId, values, asNode = null) {
    if (!employeeId || !threadId) return
    const threads = this._ensureEmployeeThreads(employeeId)
    const thread = threads.find(item => item.id === threadId)
    const lgId = thread?.langgraph_thread_id
    if (!lgId) return
    return employeeThreadApi.updateThreadState(lgId, values, asNode)
  },
}
