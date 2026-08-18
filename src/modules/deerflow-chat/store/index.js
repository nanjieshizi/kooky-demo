import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import {
  threadApi,
  resolveArtifactURL,
  buildUserUploadArtifactUrl,
  toAbsoluteDeerflowMediaUrl,
} from '../services/threadApi'
import { stripUploadedFilesBlock, parseUploadedFilesFromContent } from '../utils/uploadedFilesMarkup'
import {
  extractPresentFilesPathsFromToolCalls,
  attachmentsFromPresentFilePaths,
  mimeToExt as deerflowMimeToExt,
} from '../utils/presentFilesAttachments'
import { extractTextFromMessage, extractReasoningContentFromMessage } from '../utils/messageUtils'
import { watch, nextTick } from 'vue'
import { hasToolCalls, convertToSteps } from '../utils/toolCallsUtils'
import { useStreamManager, resetStreamClient, getStoredRunId, clearStoredRunId } from '../services/useStreamManager'
import { fetchChatModels, updateModelSelection } from '../services/modelApi'

const WELCOME_MESSAGE = '你好，你可以叫我kooky，也可以给我起一个心仪的名字；你希望我是什么样的合作者？'

/**
 * DeerFlow 聊天 Store
 */
export const useDeerflowChatStore = defineStore('deerflow-chat', {
  state: () => ({
    // 线程列表
    threads: [],
    currentThreadId: null,
    loadingThreads: false,

    // 线程列表分页状态
    threadPagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      hasMore: true,
    },

    // 当前对话视图（从 threadStates 同步）
    // - 这些字段保留以兼容现有组件读取
    // - 真正的数据源是 threadStates Map，按 personalThreadId 隔离
    messages: [],
    loadingMessages: false,
    sendingMessage: false,
    uploadingFiles: false,
    isStreaming: false,
    streamingMessageId: null,
    error: null,
    todos: [],  // 当前对话的任务列表（从 threadStates 同步）

    // —— 账本游标分页（从当前对话的 threadState 同步，供 UI 直接读取）——
    hasMore: false,                 // 当前对话是否还有更早一页（账本）
    loadingOlderPage: false,        // 当前对话正在拉旧页
    ledgerBackfillPending: false,   // 当前对话账本仍在后台回填
    persistedMessageCount: 0,       // 当前对话已落账本的消息条数（含本次首屏）
    scrollAnchor: null,             // 上滑加载请求前快照 { scrollHeight, scrollTop }，由 sentinel 写入读取

    // 按对话隔离的状态缓存：Map<personalThreadId, { messages, isStreaming, ... }>
    // 非响应式（避免 Pinia 深代理 Map 的性能问题），需要响应的字段同步到顶层
    threadStates: new Map(),

    // 引用状态
    quotingMessage: null,

    // 待发消息（从引导页携带）
    pendingIntroMessage: null,

    // 预填输入框文本（从外部触发，如"通过对话创建技能"）
    pendingPrefillText: null,

    // 正在创建新对话（点击"+"后，引导页提交前）
    isCreatingNewThread: false,

    // 模型列表
    selectedModelName: null,
    userSelectedModelName: null,   // 用户手动选择的模型（优先级最高，切换会话不重置）
    userSelectedMode: null,        // 用户手动选择的模式（切换会话不重置）

    // 对话模型（/api/chat/models）
    chatCurrentModel: null,        // 当前选中的模型（服务端记录）
    chatAvailableModels: [],       // 可用模型列表
    loadingChatModels: false,
    channel: 'kc-oc',              // 渠道标识

    // 智能体列表
    agents: [],
    loadingAgents: false,
    selectedAgentId: null,

    // 数字真人列表
    digitalHumans: [],
    loadingDigitalHumans: false,
  }),

  getters: {
    /**
     * 当前线程（personal thread 对象，含 id / title / langgraph_thread_id）
     */
    currentThread: (state) => {
      return state.threads.find(t => t.id === state.currentThreadId)
    },

    /**
     * 排序后的线程列表：置顶会话排在前面，然后按更新时间排序
     */
    sortedThreads: (state) => {
      return [...state.threads].sort((a, b) => {
        // 置顶的排在前面
        const aPinned = a.is_pinned || a.pinned_at ? 1 : 0
        const bPinned = b.is_pinned || b.pinned_at ? 1 : 0
        if (aPinned !== bPinned) return bPinned - aPinned
        // 都置顶或都不置顶时按时间排序
        return new Date(b.updated_at) - new Date(a.updated_at)
      })
    },

    /**
     * 分组后的消息
     */
    groupedMessages: (state) => {
      const groups = []
      let currentGroup = null

      for (const msg of state.messages) {
        const msgType = msg.role

        if (!currentGroup || currentGroup.role !== msgType) {
          currentGroup = {
            id: `group-${groups.length}`,
            role: msgType,
            messages: []
          }
          groups.push(currentGroup)
        }

        currentGroup.messages.push(msg)
      }

      return groups
    },

    /** 欢迎语文案（不入库，仅列表回显） */
    getWelcomeMessageCopy: () => () => {
      return WELCOME_MESSAGE
    },

    /**
     * 获取当前选中的模型对象
     */
    currentModel: (state) => {
      return state.chatAvailableModels.find(m => m.model_name === state.selectedModelName) || null
    },

    /**
     * 当前模型是否支持 thinking
     */
    currentModelSupportsThinking: (state) => {
      return state.chatCurrentModel?.supports_thinking ?? false
    },

    /**
     * 当前会话的 Todo 列表（来自 StreamManager 的 values.todos，通过顶层 todos 字段同步）
     */
    currentTodos(state) {
      return state.todos ?? []
    },
  },

  actions: {
    /**
     * 检查是否已登录（避免登出后 keep-alive 重新激活组件触发 401）
     * @returns {boolean}
     */
    _isAuthenticated() {
      return !!this._getUserInfo()?.access_token
    },

    _getUserInfo() {
      try {
        return JSON.parse(localStorage.getItem('super-assistant-userInfo') || '{}')
      } catch {
        return {}
      }
    },

    _getUserId() {
      return this._getUserInfo()?.userId
    },

    /**
     * 将 skills 数组转换为后端 skill_id 字段格式
     */
    _buildSkillItems(skills) {
      if (!skills || skills.length === 0) return null
      const items = skills
        .map(s => ({
          slug: s.slug,
          name: s.displayName || s.name || s.slug,
          avatar: s.avatar || s.image || '',
        }))
        .filter(item => item.slug)
      if (items.length === 0) return null
      return items.length === 1 ? items[0] : items
    },

    /**
     * 构建 SSE 流的 context payload
     */
    _buildContextPayload(mode, model, lgId) {
      const activeModel = this.chatAvailableModels.find(m => m.model_name === model) || this.chatCurrentModel
      return {
        mode: mode || 'flash',
        model_name: model || 'claude-sonnet-4-6',
        thinking_enabled: mode !== 'flash',
        is_plan_mode: mode === 'pro' || mode === 'ultra',
        subagent_enabled: mode === 'ultra',
        reasoning_effort: mode === 'ultra' ? 'high' : mode === 'pro' ? 'medium' : mode === 'thinking' ? 'low' : undefined,
        thread_id: lgId,
        user_id: this._getUserId(),
        ...(activeModel?.llm_base_url ? { llm_base_url: activeModel.llm_base_url } : {}),
        ...(activeModel?.llm_api_key ? { llm_api_key: activeModel.llm_api_key } : {}),
        ...(activeModel?.upstream_model ? { upstream_model: activeModel.upstream_model } : {}),
      }
    },

    // ========== 对话状态隔离：核心辅助 ==========

    /**
     * 获取指定对话的状态对象（不存在则创建）
     * 返回的是 Map 里的对象引用，可直接读写（推 messages、改 isStreaming 等）
     * 写入后如果该对话正是当前视图，需要调用 _syncViewFromThreadState(threadId) 同步到顶层
     */
    _getThreadState(personalThreadId) {
      if (!personalThreadId) return null
      let state = this.threadStates.get(personalThreadId)
      if (!state) {
        state = {
          // —— 视图源（合并后） ——
          messages: [],                 // 提供给视图：persistedMessages + streamMessages 合并去重后的最终列表
          // —— 账本（持久化）来源 ——
          pages: [],                    // [{ history_messages, hasMore, nextBeforeSeq, latestSeq, ledgerBackfillPending }]
          persistedMessages: [],        // 由 pages 反转 flatMap 后通过 _rawMessagesToUiMessages 转出（旧→新）
          hasMore: false,               // 是否还有更早一页
          nextBeforeSeq: null,          // 下一页游标（当前所有页中最小的 seq）
          latestSeq: 0,                 // = thread.last_msg_seq
          ledgerBackfillPending: false, // 后端账本仍在 checkpoint 回填中
          loadingFirstPage: false,
          firstPageInitialLoading: false,  // 仅首次加载时为 true；轮询期不置位，避免列表骨架屏闪烁
          loadingOlderPage: false,
          firstPageLoaded: false,
          backfillPollAttempts: 0,
          backfillPollTimer: null,
          // —— 流式（当前 run）来源 ——
          streamMessages: [],           // 由 streamManager.rawMessages 转出 + 未被替换的 optimisticMsgs（按 _rawMessagesToUiMessages 输出）
          // —— 滚动锚点（由 UI 在请求前写入，请求完成后由组件读取并恢复） ——
          scrollAnchor: null,           // { scrollHeight, scrollTop }
          // —— 流式状态 ——
          isStreaming: false,
          streamingMessageId: null,
          sendingMessage: false,
          uploadingFiles: false,
          error: null,
          streamManager: null,
          streamManagerWatchers: [],
          stoppedByUser: false,
          todos: [],
          _initialLastAiId: null,
        }
        this.threadStates.set(personalThreadId, state)
      }
      return state
    },

    /**
     * 把某对话的状态同步到顶层响应式字段（当该对话为当前视图时）
     * 注意：state.messages 现在是 persistedMessages + streamMessages 的合并结果
     * （由 _recomputeDisplayMessages 维护），_rawMessagesToUiMessages 已过滤掉 tool 消息，
     * 此处保留 tool 兜底过滤是为了对齐旧逻辑。
     */
    _syncViewFromThreadState(personalThreadId) {
      if (personalThreadId !== this.currentThreadId) return
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      this.messages = state.messages.filter(msg => {
        if (msg.type === 'tool') return false
        if (msg.role === 'tool') return false
        if (msg.raw?.type === 'tool') return false
        return true
      })
      this.isStreaming = state.isStreaming
      this.streamingMessageId = state.streamingMessageId
      this.sendingMessage = state.sendingMessage
      this.uploadingFiles = state.uploadingFiles
      // 仅初次首屏加载（非轮询）显示骨架屏，避免回填轮询期间闪烁
      this.loadingMessages = !!state.firstPageInitialLoading
      this.error = state.error
      this.todos = state.todos ?? []
      // 账本分页字段同步到顶层（threadStates Map 内嵌字段不保证在组件中响应）
      this.hasMore = !!state.hasMore
      this.loadingOlderPage = !!state.loadingOlderPage
      this.ledgerBackfillPending = !!state.ledgerBackfillPending
      this.persistedMessageCount = (state.persistedMessages || []).length
      this.scrollAnchor = state.scrollAnchor
    },

    /**
     * 切换当前对话视图到指定 threadId
     * - 不清空任何对话的 state
     * - 目标对话若无缓存则新建空 state，调用方决定是否 loadFirstPage
     */
    _switchViewTo(personalThreadId) {
      this.currentThreadId = personalThreadId
      if (!personalThreadId) {
        this.messages = []
        this.isStreaming = false
        this.streamingMessageId = null
        this.sendingMessage = false
        this.uploadingFiles = false
        this.loadingMessages = false
        this.error = null
        this.todos = []
        this.hasMore = false
        this.loadingOlderPage = false
        this.ledgerBackfillPending = false
        this.persistedMessageCount = 0
        this.scrollAnchor = null
        return
      }
      this._getThreadState(personalThreadId)
      this._syncViewFromThreadState(personalThreadId)
    },

    /**
     * 给某对话的 state 写入字段，并在其为当前视图时同步到顶层
     */
    _updateThreadState(personalThreadId, patch) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      Object.assign(state, patch)
      this._syncViewFromThreadState(personalThreadId)
    },


    /**
     * 重置 store 所有状态（用于登出时清理）
     */
    resetState() {
      this.threads = []
      this.threadPagination = { page: 1, pageSize: 20, total: 0, hasMore: true }
      this.currentThreadId = null
      this.messages = []
      this.loadingThreads = false
      this.loadingMessages = false
      this.sendingMessage = false
      this.uploadingFiles = false
      this.isStreaming = false
      this.streamingMessageId = null
      this.todos = []
      this.hasMore = false
      this.loadingOlderPage = false
      this.ledgerBackfillPending = false
      this.persistedMessageCount = 0
      this.scrollAnchor = null
      for (const [, ts] of this.threadStates) {
        if (ts.streamManagerWatchers) {
          ts.streamManagerWatchers.forEach(stop => stop())
        }
        if (ts.streamManager) {
          ts.streamManager.reset()
        }
        if (ts.backfillPollTimer) {
          clearTimeout(ts.backfillPollTimer)
          ts.backfillPollTimer = null
        }
      }
      this.threadStates = new Map()
      resetStreamClient()
      this.error = null
      this.quotingMessage = null
      this.pendingIntroMessage = null
      this.isCreatingNewThread = false
      this.selectedModelName = null
      this.userSelectedModelName = null
      this.userSelectedMode = null
      this.chatCurrentModel = null
      this.chatAvailableModels = []
      this.loadingChatModels = false
      this.agents = []
      this.loadingAgents = false
      this.selectedAgentId = null
      this.digitalHumans = []
      this.loadingDigitalHumans = false
    },

    /**
     * 获取线程列表
     * @param {Object} options
     * @param {boolean} [options.reset=true] true=重置到第1页并替换列表；false=加载下一页并追加
     */
    async fetchThreads(options = {}) {
      const { reset = true } = options
      if (!this._isAuthenticated()) return
      if (this.loadingThreads) return
      this.loadingThreads = true
      this.error = null

      try {
        const page = reset ? 1 : this.threadPagination.page + 1
        const apiOptions = { page, pageSize: this.threadPagination.pageSize }
        if (this.selectedAgentId) {
          apiOptions.agentId = this.selectedAgentId
        }
        const data = await threadApi.getThreads(apiOptions)

        let items = []
        let total = 0
        if (Array.isArray(data)) {
          items = data
          total = data.length
        } else if (Array.isArray(data?.items)) {
          items = data.items
          total = data.total ?? data.items.length
        } else if (Array.isArray(data?.threads)) {
          items = data.threads
          total = data.total ?? data.threads.length
        } else if (Array.isArray(data?.data)) {
          items = data.data
          total = data.total ?? data.data.length
        }

        if (reset) {
          this.threadPagination.hasMore = true
          // 默认列表为 personal；保留已 seed 的一人团队主/子会话，避免被全量替换后 loadFirstPage 丢失 langgraph_thread_id
          const onePersonRows = (this.threads || []).filter((t) => {
            const tt = String(t?.thread_type || t?.threadType || '').toLowerCase()
            if (tt !== 'one_person_main' && tt !== 'one_person_sub') return false
            return !items.some((i) => Number(i?.id) === Number(t?.id))
          })
          this.threads = [...onePersonRows, ...items]
        } else {
          const existingIds = new Set(this.threads.map(t => t.id))
          const newItems = items.filter(t => !existingIds.has(t.id))
          this.threads = [...this.threads, ...newItems]
        }

        this.threadPagination.page = page
        this.threadPagination.total = total
        // 裸数组时用 pageSize 判断是否还有更多，有 total 时用累计长度判断
        if (Array.isArray(data)) {
          this.threadPagination.hasMore = items.length >= this.threadPagination.pageSize
        } else {
          this.threadPagination.hasMore = this.threads.length < total
        }
      } catch (err) {
        this.error = err.message
        console.error('[DeerFlow] Failed to fetch threads:', err)
      } finally {
        this.loadingThreads = false
      }
    },

    /**
     * 加载下一页线程（由 IntersectionObserver 触发）
     */
    async loadMoreThreads() {
      if (this.loadingThreads || !this.threadPagination.hasMore) return
      await this.fetchThreads({ reset: false })
    },

    /**
     * 创建线程
     */
    async createThread(title = 'New Chat') {
      try {
        const thread = await threadApi.createThread(title, this.selectedAgentId)
        this.threads.unshift(thread)
        return thread
      } catch (err) {
        console.error('[DeerFlow] Failed to create thread:', err)
        // 提取并抛出详细的错误信息
        const errorDetail = err?.response?.data?.detail || err?.detail || err?.message || '创建会话失败'
        const enhancedError = new Error(errorDetail)
        enhancedError.originalError = err
        enhancedError.detail = errorDetail
        throw enhancedError
      }
    },

    /**
     * 删除线程（personalThreadId 为 personal thread 的数字 id）
     */
    async deleteThread(personalThreadId) {
      const deletedState = this.threadStates.get(personalThreadId)
      try {
        await threadApi.deleteThread(personalThreadId)
        this.threads = this.threads.filter(t => t.id !== personalThreadId)
        if (this.currentThreadId === personalThreadId) {
          const first = this.sortedThreads[0]
          const nextId = first ? first.id : null
          this._switchViewTo(nextId)
          if (nextId) {
            const nextState = this._getThreadState(nextId)
            if (!nextState.firstPageLoaded) {
              this.loadFirstPage(nextId)
            }
          }
        }
      } catch (err) {
        console.error('[DeerFlow] Failed to delete thread:', err)
        throw err
      } finally {
        // 无论 API 成功与否都停止 watcher，防止已删对话的 streamManager 持续推送
        deletedState?.streamManagerWatchers?.forEach(stop => stop())
        deletedState?.streamManager?.reset()
        if (deletedState?.backfillPollTimer) {
          clearTimeout(deletedState.backfillPollTimer)
          deletedState.backfillPollTimer = null
        }
        this.threadStates.delete(personalThreadId)
      }
    },

    /**
     * 重命名线程（personalThreadId 为 personal thread 的数字 id）
     */
    async renameThread(personalThreadId, newTitle) {
      try {
        await threadApi.renameThread(personalThreadId, newTitle)
        const thread = this.threads.find(t => t.id === personalThreadId)
        if (thread) {
          thread.title = newTitle
        }
      } catch (err) {
        console.error('[DeerFlow] Failed to rename thread:', err)
        throw err
      }
    },

    /**
     * 设置当前线程
     */
    setCurrentThread(threadId) {
      this._switchViewTo(threadId)
      // 切换会话时尝试恢复未完成的流式（页面刷新场景）
      if (threadId) this.tryReconnectStreaming(threadId)
    },

    /**
     * 尝试断线重连：如果 sessionStorage 中有未完成的 run_id，恢复流式
     * 只在用户进入会话时主动调用，不在 _getOrCreateStreamManager 中自动触发，
     * 避免与 sendMessage 的 submit 竞争同一个 thread 的 active run
     */
    tryReconnectStreaming(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state || state.isStreaming || state.sendingMessage) return

      const thread = this.threads.find(t => t.id === personalThreadId)
      const lgId = thread?.langgraph_thread_id
      if (!lgId) return

      const storedRunId = getStoredRunId(lgId)
      if (!storedRunId) return

      const mgr = this._getOrCreateStreamManager(personalThreadId)
      if (!mgr) return

      state.isStreaming = true
      state.sendingMessage = true
      // reconnect 时记录当前最后一条 AI 的 ID，避免 watch 回调误标记旧消息
      const currentRawMsgs = mgr.rawMessages?.value || []
      const lastAiInRaw = [...currentRawMsgs].reverse().find(m => m.type === 'ai')
      state._initialLastAiId = lastAiInRaw?.id || null
      this._syncViewFromThreadState(personalThreadId)
      mgr.reconnect(storedRunId, {
        onFinish: () => {
          state.sendingMessage = false
          this._finishStreaming(personalThreadId)
          this.fetchThreads()
          // reconnect 完成后也刷新一次首屏账本（同样使用安全刷新）
          this._safeRefreshLedgerOnRunSettled(personalThreadId)
        },
        onError: () => {
          clearStoredRunId(lgId)
          state.isStreaming = false
          state.sendingMessage = false
          state.streamingMessageId = null
          state._initialLastAiId = null
          this._syncViewFromThreadState(personalThreadId)
        },
      }).catch(() => {
        clearStoredRunId(lgId)
        state.isStreaming = false
        state.sendingMessage = false
        state.streamingMessageId = null
        state._initialLastAiId = null
        this._syncViewFromThreadState(personalThreadId)
      })
    },

    /**
     * 将一人团队主会话等未包含在默认 personal 列表中的线程并入 `threads`，
     * 以便 `loadFirstPage` 能解析 `langgraph_thread_id`。
     * @param {Record<string, unknown>} row — `one-person-teams` 返回的 thread 对象
     */
    seedThreadRowIfMissing(row) {
      if (!row?.id || !row?.langgraph_thread_id) return
      const id = Number(row.id)
      if (!Number.isFinite(id)) return
      if (this.threads.some((t) => Number(t.id) === id)) return
      this.threads = [{ ...row, id }, ...this.threads]
    },

    /**
     * 将后端原始消息（checkpoint values.messages 或 history_messages）转为 UI 气泡数组
     * - 过滤 hide_from_ui / todo_reminder / tool
     * - 按 human 边界分段为 turns
     * - 每轮合并 attachments / reasoning，挑 anchor AI 作可见气泡
     * - 与 deer-flow groupMessages 思路对齐：每轮只保留一个 assistant 气泡
     * @param {Array} rawMessages 原始消息数组
     * @param {string} lgId LangGraph thread id（用于 _extractAttachments 解析路径）
     * @returns {Array} UI 消息数组（含 id / role / content / timestamp / attachments? / reasoning? / raw）
     */
    _rawMessagesToUiMessages(rawMessages, lgId) {
      const cleanedRaw = (rawMessages || []).filter((msg) => {
        if (msg.additional_kwargs?.hide_from_ui) return false
        if (msg.name === 'todo_reminder') return false
        return msg.type === 'human' || msg.type === 'ai'
      })

      const turns = []
      let currentTurn = { user: null, ais: [] }
      for (const msg of cleanedRaw) {
        if (msg.type === 'human') {
          if (currentTurn.user || currentTurn.ais.length > 0) {
            turns.push(currentTurn)
          }
          currentTurn = { user: msg, ais: [] }
        } else {
          currentTurn.ais.push(msg)
        }
      }
      if (currentTurn.user || currentTurn.ais.length > 0) {
        turns.push(currentTurn)
      }

      const uiMessages = []
      let baseTimestamp = Date.now() - cleanedRaw.length * 1000
      // 优先使用后端 additional_kwargs.created_at（Unix 秒），否则回退到合成时间戳
      const pickTimestamp = (msg) => {
        const c = msg?.additional_kwargs?.created_at
        if (typeof c === 'number' && !Number.isNaN(c)) {
          return c < 1e12 ? c * 1000 : c
        }
        if (typeof c === 'string' && c.trim()) {
          const n = Number(c)
          if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n
        }
        return null
      }
      for (const turn of turns) {
        if (turn.user) {
          const u = turn.user
          const rawText = extractTextFromMessage(u)
          const userAttachments = this._extractAttachments(u, lgId)
          const content = stripUploadedFilesBlock(rawText)
          const skills = this._extractSkills(u)
          const userTs = pickTimestamp(u)
          uiMessages.push({
            id: u.id || `msg_u_${Date.now()}_${uiMessages.length}`,
            role: 'user',
            content,
            timestamp: userTs ?? baseTimestamp,
            ...(userAttachments.length > 0 ? { attachments: userAttachments } : {}),
            ...(skills.length > 0 ? { skills } : {}),
            raw: u,
          })
          if (userTs == null) baseTimestamp += 1000
        }

        if (turn.ais.length === 0) continue

        const mergedAttachments = []
        let mergedReasoning = null
        for (const a of turn.ais) {
          mergedAttachments.push(...this._extractAttachments(a, lgId))
          if (!mergedReasoning) {
            const r = extractReasoningContentFromMessage(a)
            if (r) mergedReasoning = r
          }
        }
        const dedupedAttachments = this._dedupeAttachments(mergedAttachments)

        let anchorAi = null
        for (let i = turn.ais.length - 1; i >= 0; i--) {
          const msg = turn.ais[i]
          // 对齐 deer-flow：有 tool_calls 的 AI 消息不渲染正文气泡（只渲染工具卡片）
          // 例外：ask_clarification 工具的结果消息就是要展示给用户的内容，需要渲染为正文
          if (hasToolCalls(msg)) {
            const clarificationCall = msg.tool_calls?.find(tc => tc.name === 'ask_clarification')
            if (clarificationCall) {
              // 从 rawMessages 中找到对应的 tool 结果消息
              const toolResultMsg = rawMessages.find(
                m => m.type === 'tool' && m.tool_call_id === clarificationCall.id
              )
              if (toolResultMsg) {
                const toolContent = typeof toolResultMsg.content === 'string'
                  ? toolResultMsg.content
                  : this._extractContent(toolResultMsg.content)
                if (toolContent.trim()) {
                  anchorAi = { ai: msg, content: toolContent }
                  break
                }
              }
            }
            continue
          }
          const rawText = extractTextFromMessage(msg)
          if (stripUploadedFilesBlock(rawText).trim()) {
            anchorAi = { ai: msg, content: stripUploadedFilesBlock(rawText) }
            break
          }
        }
        if (!anchorAi) {
          // 找最后一条没有 tool_calls 的 AI 消息作为锚点
          const last = [...turn.ais].reverse().find(m => !hasToolCalls(m)) || turn.ais[turn.ais.length - 1]
          anchorAi = { ai: last, content: '' }
        }

        // 生成带 result 的 toolSteps（传完整 rawMessages 以关联 tool 结果）
        const toolSteps = convertToSteps(rawMessages || [])
          .filter(s => s.type === 'toolCall' && turn.ais.some(a => a.id === s.messageId))

        // 提取 subtask（task 工具调用）信息
        const subtasks = []
        for (const ai of turn.ais) {
          if (!ai.tool_calls) continue
          for (const tc of ai.tool_calls) {
            if (tc.name !== 'task') continue
            const subtask = {
              id: tc.id,
              description: tc.args?.description || '',
              prompt: tc.args?.prompt || '',
              subagentType: tc.args?.subagent_type || '',
              status: 'in_progress',
              result: null,
              error: null,
            }
            const toolResult = rawMessages.find(m => m.type === 'tool' && m.tool_call_id === tc.id)
            if (toolResult) {
              const text = typeof toolResult.content === 'string'
                ? toolResult.content
                : this._extractContent(toolResult.content)
              if (text.startsWith('Task Succeeded. Result:')) {
                subtask.status = 'completed'
                subtask.result = text.split('Task Succeeded. Result:')[1]?.trim() || ''
              } else if (text.startsWith('Task failed.')) {
                subtask.status = 'failed'
                subtask.error = text.split('Task failed.')[1]?.trim() || ''
              } else if (text.startsWith('Task timed out')) {
                subtask.status = 'failed'
                subtask.error = text
              }
            }
            subtasks.push(subtask)
          }
        }

        const hasAnything =
          anchorAi.content.trim() ||
          dedupedAttachments.length > 0 ||
          mergedReasoning ||
          toolSteps.length > 0 ||
          subtasks.length > 0
        if (!hasAnything) continue

        const aiTs = pickTimestamp(anchorAi.ai)
        uiMessages.push({
          id: anchorAi.ai.id || `msg_a_${Date.now()}_${uiMessages.length}`,
          role: 'assistant',
          content: anchorAi.content,
          timestamp: aiTs ?? baseTimestamp,
          ...(toolSteps.length > 0 ? { toolSteps } : {}),
          ...(subtasks.length > 0 ? { subtasks } : {}),
          ...(dedupedAttachments.length > 0 ? { attachments: dedupedAttachments } : {}),
          ...(mergedReasoning ? { reasoning: mergedReasoning } : {}),
          raw: anchorAi.ai,
        })
        if (aiTs == null) baseTimestamp += 1000
      }

      return uiMessages
    },

    /**
     * 合并 persistedMessages（账本）和 streamMessages（当前 run）为视图源 state.messages。
     *
     * 合并规则（账本为真相之源 + 流式仅覆盖当前条目）：
     *  - 账本中已持久化的所有 id：以 persisted 内容为准，不被 stream 覆盖。
     *  - 例外：当前正在流式的那一条（id === streamingMessageId）以 stream 为准，
     *    这样流式 token 才能实时显示在该气泡上。
     *  - stream 中未入账的消息（id 不在 persisted 中）追加到尾部，覆盖：
     *      * 未被 SDK 真消息替换的乐观气泡（前端临时 id）
     *      * 当前 run 的新 ai 消息（持久化前）
     *
     * 这套规则解决了之前的问题：SDK rawMessages 内部为整个会话保留快照，
     * 在 regenerate / 历史压缩 / 切换会话等场景下可能含过期版本；
     * 让 stream 无差别覆盖 persisted 会导致页面显示与账本不一致。
     *
     * 不变量（必须满足，否则同一条消息会以两条气泡出现）：
     *  - streamMessages 中由 streamManager.rawMessages 推出的 ai/user 消息，其 id
     *    必须等于该消息最终在账本中持久化的 id。
     *  - 仅未被真消息替换的乐观气泡允许使用前端生成的临时 id；这些 id 不会出现在 persistedMessages 中。
     *  - finishStreaming 必须清掉空内容的乐观占位，避免遗留。
     */
    _recomputeDisplayMessages(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      const persisted = state.persistedMessages || []
      const stream = state.streamMessages || []
      const streamingId = state.streamingMessageId || null
      const persistedIds = new Set(persisted.map(m => m && m.id).filter(Boolean))
      // 账本部分：仅当前流式的那条用 stream 覆盖，其余全部以 persisted 为准
      const merged = persisted.map((m) => {
        if (!m || !m.id) return m
        if (streamingId && m.id === streamingId) {
          const sm = stream.find(x => x && x.id === streamingId)
          return sm || m
        }
        return m
      })
      // tail：保留 streamMessages 中"账本未表达"的条目，包括：
      //   - 当前流式的那条（id === streamingId）：流式 token 实时显示
      //   - 乐观气泡（isOptimistic）：等 SDK 真消息推过来再替换
      //   - 当前 run 推过但账本还未持久化的 ai/user：onFinish→loadFirstPage 之间的窗口期
      // 不会出现"过期 SDK 影子"：watch 回调已经在写入 streamMessages 前剔除了
      // SDK rawMessages 中"账本已表达且非当前流式"的条目，保证 streamMessages 中
      // 不含过期版本。
      const tail = stream.filter((m) => {
        if (!m) return false
        if (m.id && persistedIds.has(m.id)) return false
        return true
      })
      state.messages = [...merged, ...tail]
      this._syncViewFromThreadState(personalThreadId)
    },

    /**
     * 在账本拉取完成、且当前不在流式中时，把 streamMessages 收敛到"只剩乐观气泡和当前流式条目"。
     *
     * 背景：streamManager.rawMessages 内部按 SDK 协议为整个会话维护快照，
     * regenerate / 历史压缩 / 切换会话等场景下可能含过期版本，会与账本最新数据冲突。
     * 既然账本是真相之源，且当前没有流式 token 在写入，就把这些 SDK 影子全部清掉，
     * 让 _recomputeDisplayMessages 完全以 persistedMessages 为唯一来源。
     *
     * 保留的条目：
     *   - 乐观气泡（isOptimistic === true）：等 SDK 推真消息时由 watch 自然替换
     *   - 当前正在流式的那一条（id === streamingMessageId）：让 token 持续覆盖
     */
    _pruneStreamShadowsOfPersisted(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      if (state.isStreaming) return
      const before = state.streamMessages?.length ?? 0
      if (before === 0) return
      state.streamMessages = (state.streamMessages || []).filter((m) => {
        if (!m) return false
        if (m.isOptimistic) return true
        if (state.streamingMessageId && m.id === state.streamingMessageId) return true
        return false
      })
      if ((state.streamMessages.length ?? 0) !== before) {
        this._recomputeDisplayMessages(personalThreadId)
      }
    },

    /**
     * 把一组 page 重新展开为 persistedMessages（旧→新），保持时间戳方案不变：
     * page.history_messages 已是按 seq 升序，pages 自身按"旧页在前"维护。
     */
    _rebuildPersistedFromPages(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      const thread = this.threads.find(t => t.id === personalThreadId)
      const lgId = thread?.langgraph_thread_id || ''
      // 同 id 的 raw 消息去重：保留 first-seen 的位置（即最早出现的页中那条消息的位置），
      // 但 value 取最后写入的版本（force 重拉的新数据可能含更新后的 attachments / reasoning 等）。
      // 与 deer-flow `mergeLedgerAndStreamMessages` 的"后写覆盖前写"语义一致。
      const order = []
      const byId = new Map()
      let anonIdx = 0
      for (const p of state.pages || []) {
        if (!Array.isArray(p?.history_messages)) continue
        for (const msg of p.history_messages) {
          const id = msg && msg.id
          if (id) {
            if (!byId.has(id)) order.push(id)
            byId.set(id, msg)
          } else {
            // 没有 id 的消息（极少见）按出现顺序保留，不参与去重
            const key = `__anon__${anonIdx++}`
            order.push(key)
            byId.set(key, msg)
          }
        }
      }
      const flat = order.map(k => byId.get(k)).filter(Boolean)
      state.persistedMessages = this._rawMessagesToUiMessages(flat, lgId)
      this._recomputeDisplayMessages(personalThreadId)
    },

    /**
     * 把 pages 数组紧凑化为单页：按 id 去重（后写覆盖前写），保留首页的 nextBeforeSeq / hasMore
     * 作为对外游标，latestSeq 取所有页中的最大值，ledgerBackfillPending 取最新页的值。
     * 仅由 loadFirstPage 在 pages 累积过多时调用。
     */
    _compactPages(pages) {
      if (!Array.isArray(pages) || pages.length === 0) return pages
      const order = []
      const byId = new Map()
      let anonIdx = 0
      let maxLatest = 0
      for (const p of pages) {
        if (Number.isFinite(p?.latestSeq) && p.latestSeq > maxLatest) maxLatest = p.latestSeq
        if (!Array.isArray(p?.history_messages)) continue
        for (const msg of p.history_messages) {
          const id = msg && msg.id
          if (id) {
            if (!byId.has(id)) order.push(id)
            byId.set(id, msg)
          } else {
            const key = `__anon__${anonIdx++}`
            order.push(key)
            byId.set(key, msg)
          }
        }
      }
      const merged = order.map(k => byId.get(k)).filter(Boolean)
      const head = pages[0]
      const tail = pages[pages.length - 1]
      return [{
        history_messages: merged,
        hasMore: !!head?.hasMore,
        nextBeforeSeq: head?.nextBeforeSeq ?? null,
        latestSeq: maxLatest,
        ledgerBackfillPending: !!tail?.ledgerBackfillPending,
      }]
    },

    /**
     * 启动账本回填轮询：每 2s 重拉首屏，最多 30 次或 ledgerBackfillPending=false / 出错时停止。
     * 与 deer-flow `usePersonalThreadMessagesInfinite.refetchInterval` 对齐。
     */
    _scheduleBackfillPoll(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      if (state.backfillPollTimer) {
        clearTimeout(state.backfillPollTimer)
        state.backfillPollTimer = null
      }
      const tick = async () => {
        const s = this.threadStates.get(personalThreadId)
        if (!s) return
        // 达到上限：解除回填阻塞状态，避免 sentinel 永远显示"回填中…"且 loadOlderPage 永久被拦截
        if (s.backfillPollAttempts >= 30) {
          s.backfillPollTimer = null
          s.ledgerBackfillPending = false
          console.warn('[DeerFlow] ledger backfill polling timed out (30 attempts), giving up for thread=%s', personalThreadId)
          this._syncViewFromThreadState(personalThreadId)
          return
        }
        s.backfillPollAttempts += 1
        try {
          await this.loadFirstPage(personalThreadId, { force: true, _internalPoll: true })
        } catch (err) {
          // 网络抖动或临时错误时打印日志而非静默吞掉，避免无线索排查
          console.warn('[DeerFlow] backfill poll iteration failed for thread=%s:', personalThreadId, err)
          s.backfillPollTimer = null
          return
        }
        const fresh = this.threadStates.get(personalThreadId)
        if (!fresh) return
        if (!fresh.ledgerBackfillPending) {
          fresh.backfillPollTimer = null
          return
        }
        fresh.backfillPollTimer = setTimeout(tick, 2000)
      }
      state.backfillPollTimer = setTimeout(tick, 2000)
    },

    /**
     * 加载账本首屏（最新一页）。
     * @param {number} personalThreadId
     * @param {object} [options]
     * @param {boolean} [options.force=false]      已加载过且非强制 → 复用缓存
     * @param {boolean} [options._internalPoll]    内部轮询调用，不重置 attempts
     */
    async loadFirstPage(personalThreadId, options = {}) {
      const { force = false, _internalPoll = false } = options
      if (!this._isAuthenticated()) return
      if (!personalThreadId) return

      const state = this._getThreadState(personalThreadId)
      if (state.loadingFirstPage && !force) return
      // 流式期间允许并行刷新首屏（账本与 stream 按 id 合并），但仍跳过重复并发
      if (state.firstPageLoaded && !force) return

      state.loadingFirstPage = true
      // 仅首次加载（非轮询、未加载过）才置 firstPageInitialLoading；
      // 轮询期间不闪 skeleton。
      if (!_internalPoll && !state.firstPageLoaded) {
        state.firstPageInitialLoading = true
      }
      state.error = null
      this._syncViewFromThreadState(personalThreadId)

      try {
        // service 层已做 schema 归一化，这里直接使用即可
        const page = await threadApi.getThreadMessagesPage(personalThreadId, { pageSize: 20 })
        // force 重拉（流式结束 / regenerate / reconnect / 外部刷新）时，
        // 把新页 append 到 pages 末尾而非替换：
        //   反例（替换末位）：旧 page0=seq[81..100]，新页=seq[91..110]，
        //   替换会让 seq[81..90] 在窗口"滚出"后永久丢失。
        // append 后由 _rebuildPersistedFromPages 按 id 去重得到 seq[81..110] 的并集。
        // 首次加载（pages 为空）仍是"放入单页"。
        if (state.pages.length > 0) {
          state.pages = [...state.pages, page]
          // nextBeforeSeq 取最早一页的（首页）；新页只代表"最新端"
          const firstPage = state.pages[0]
          state.hasMore = !!(firstPage?.hasMore && firstPage?.nextBeforeSeq != null)
          state.nextBeforeSeq = firstPage?.nextBeforeSeq ?? null
        } else {
          state.pages = [page]
          state.hasMore = !!(page.hasMore && page.nextBeforeSeq != null)
          state.nextBeforeSeq = page.nextBeforeSeq
        }
        // 紧凑化：当 pages 数超过阈值时合并成单页，防止长会话累积 N 次 force append
        // 后导致数组无限增长。压缩后保留首页的 nextBeforeSeq 与 hasMore 作为对外游标。
        if (state.pages.length > 5) {
          state.pages = this._compactPages(state.pages)
        }
        // latestSeq 不回退：取较大值
        if (page.latestSeq > (state.latestSeq || 0)) state.latestSeq = page.latestSeq
        state.ledgerBackfillPending = page.ledgerBackfillPending
        state.firstPageLoaded = true
        if (!_internalPoll) state.backfillPollAttempts = 0

        this._rebuildPersistedFromPages(personalThreadId)
        // 账本到位后，剪掉 streamMessages 中已被账本表达的旧 SDK 影子条目，
        // 避免 regenerate 等场景下页面显示与账本不一致。
        this._pruneStreamShadowsOfPersisted(personalThreadId)

        // 内部轮询调用时，由 tick 自身负责下一次 setTimeout，避免双调度。
        if (!_internalPoll) {
          if (state.ledgerBackfillPending && !state.backfillPollTimer) {
            this._scheduleBackfillPoll(personalThreadId)
          } else if (!state.ledgerBackfillPending && state.backfillPollTimer) {
            clearTimeout(state.backfillPollTimer)
            state.backfillPollTimer = null
          }
        }
      } catch (err) {
        state.error = err?.message || '加载消息失败'
        console.error('[DeerFlow] Failed to load first page:', err)
        if (err?.response?.status === 404) {
          ElMessage.error('该对话不存在或已损坏，请创建新对话')
          state.pages = []
          state.persistedMessages = []
          state.firstPageLoaded = true
          this._recomputeDisplayMessages(personalThreadId)
          if (this.currentThreadId === personalThreadId) {
            this.currentThreadId = null
          }
        } else if (!_internalPoll) {
          ElMessage.error('加载消息失败，请刷新重试')
        }
        if (!_internalPoll && state.backfillPollTimer) {
          clearTimeout(state.backfillPollTimer)
          state.backfillPollTimer = null
        }
        // 内部轮询出错时，不在此 stop timer：tick 函数自己会按返回值停止
      } finally {
        state.loadingFirstPage = false
        state.firstPageInitialLoading = false
        this._syncViewFromThreadState(personalThreadId)
      }
    },

    /**
     * 上滑加载更早一页（游标 seq < nextBeforeSeq）。
     * 由 UI 在请求前写入 state.scrollAnchor，请求完成后由组件读取并恢复滚动位置。
     */
    async loadOlderPage(personalThreadId) {
      if (!this._isAuthenticated()) return
      if (!personalThreadId) return
      const state = this._getThreadState(personalThreadId)
      if (!state || !state.hasMore) return
      if (state.loadingOlderPage) return
      if (state.ledgerBackfillPending) return
      const cursor = state.nextBeforeSeq
      if (cursor == null) return

      state.loadingOlderPage = true
      try {
        const page = await threadApi.getThreadMessagesPage(personalThreadId, {
          beforeSeq: cursor,
          pageSize: 20,
        })
        // 旧页放最前面
        state.pages = [page, ...state.pages]
        state.hasMore = !!(page.hasMore && page.nextBeforeSeq != null)
        state.nextBeforeSeq = page.nextBeforeSeq
        // latestSeq 不回退
        if (page.latestSeq > state.latestSeq) state.latestSeq = page.latestSeq

        this._rebuildPersistedFromPages(personalThreadId)
        this._pruneStreamShadowsOfPersisted(personalThreadId)
      } catch (err) {
        console.warn('[DeerFlow] loadOlderPage failed:', err)
      } finally {
        state.loadingOlderPage = false
        this._syncViewFromThreadState(personalThreadId)
      }
    },

    /**
     * 安全地刷新账本首屏：仅当 streamMessages 中没有"未被 SDK 真消息替换的乐观气泡"时才执行。
     *
     * 背景：sendMessage / regenerate 推入的乐观气泡（id 形如 usr_xxx / ai_xxx，无 raw）会在
     * SDK 收到首个 messages-tuple 事件时由 watch 滤掉。如果在此之前调用 loadFirstPage(force)
     * 拉到的账本消息（id 是后端真实 id）会与乐观气泡按 id 不等而双显。
     *
     * 判据：SDK 推过的真消息都带 raw，纯乐观气泡没有 raw 仅有 isOptimistic 标记。
     * 没有未替换乐观气泡 → 安全刷账本；否则跳过本次刷新（数据一致性由后续路径兜底）。
     *
     * @param {number} personalThreadId
     */
    _safeRefreshLedgerOnRunSettled(personalThreadId) {
      const state = this.threadStates.get(personalThreadId)
      if (!state) return
      const hasUnreplacedOptimistic = (state.streamMessages || []).some(m => m?.isOptimistic && !m?.raw)
      if (hasUnreplacedOptimistic) return
      void this.loadFirstPage(personalThreadId, { force: true })
    },

    /**
     * 让某对话的账本缓存失效，下次进入会重新拉首屏。
     */
    invalidateLedger(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return
      state.pages = []
      state.persistedMessages = []
      state.firstPageLoaded = false
      state.hasMore = false
      state.nextBeforeSeq = null
      state.ledgerBackfillPending = false
      if (state.backfillPollTimer) {
        clearTimeout(state.backfillPollTimer)
        state.backfillPollTimer = null
      }
      state.backfillPollAttempts = 0
      this._recomputeDisplayMessages(personalThreadId)
    },

    /**
     * 发送消息
     */
    async sendMessage(personalThreadId, text, files = [], options = {}) {
      const {
        mode = 'flash',
        model = this.selectedModelName || 'claude-sonnet-4-6',
        replyTo = null,
        skills = [],
      } = options
      if (!text.trim() && files.length === 0 && (!skills || skills.length === 0)) return

      // 取目标对话的独立 state，后续所有流式/乐观写入都走这里
      const state = this._getThreadState(personalThreadId)
      if (state.sendingMessage || state.isStreaming) return

      const thread = this.threads.find(t => t.id === personalThreadId)
      const lgId = thread?.langgraph_thread_id
      if (!lgId) {
        state.error = '该对话尚未关联 LangGraph 线程，请刷新后重试'
        this._syncViewFromThreadState(personalThreadId)
        return
      }

      // —— 阶段 1：立刻显示用户气泡 ——
      // 把构造乐观 user 消息、写入 streamMessages 这类同步操作，放到任何 await 之前，
      // 保证用户点击"发送"后第一时间在视图里看到自己的气泡。
      const userMsgId = `user_${Date.now()}`
      const userMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: Date.now(),
        isOptimistic: true,
        skills: skills && skills.length > 0 ? skills : [],
        replyTo: replyTo ? {
          id: replyTo.id,
          role: replyTo.role,
          content: replyTo.content,
          timestamp: replyTo.timestamp,
        } : null,
      }
      if (files.length > 0) {
        userMessage.attachments = files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          mimeType: file.type,
          url: '', // 上传完成后会替换为服务端 URL
          thumbnailUrl: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '',
        }))
      }
      state.streamMessages.push(userMessage)
      state.sendingMessage = true
      this._recomputeDisplayMessages(personalThreadId)

      // —— 阶段 2：后台 touch / 自动标题（保留 await，因为它可能承担 lgId 绑定职责）——
      // 注意：用户气泡已经在阶段 1 推入视图，await 期间用户能看到自己的气泡，
      //       而 AI 的"思考中"占位会在阶段 3 后才出现。原本 await 在 push 之前会让
      //       两者都被网络耗时挡住，看上去"用户气泡和思考中同时出现"。
      try {
        const isDefaultTitle = !thread.title || thread.title === '新对话' || thread.title === 'New Chat'
        const titleText = stripUploadedFilesBlock(text.trim())
        const autoTitle = isDefaultTitle
          ? (titleText.slice(0, 8) + (titleText.length > 8 ? '...' : '')) || '新对话'
          : thread.title
        await threadApi.renameThread(personalThreadId, autoTitle, lgId)
        if (isDefaultTitle && thread.title !== autoTitle) {
          thread.title = autoTitle
        }
      } catch (err) {
        console.warn('[DeerFlow] Failed to touch thread before sending:', err)
      }
      void this.fetchThreads()

      // —— 阶段 3：让浏览器先绘制用户气泡，再推 AI 占位 ——
      // 等一次 nextTick + requestAnimationFrame，确保用户气泡确实落到屏幕上，
      // 之后再插入 AI"思考中"占位，视觉上呈现为"先用户后 AI"。
      await nextTick()
      await new Promise(resolve => requestAnimationFrame(() => resolve()))

      const aiMsgId = `ai_${Date.now()}`
      state.streamMessages.push({
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        isOptimistic: true,
        reasoningStartTime: null,
        reasoningDuration: null,
      })

      state.streamingMessageId = aiMsgId
      state.isStreaming = true
      this._recomputeDisplayMessages(personalThreadId)

      try {
        // 1. 上传文件（如果有）
        let uploadedFiles = []
        if (files.length > 0) {
          state.uploadingFiles = true
          this._syncViewFromThreadState(personalThreadId)
          const result = await threadApi.uploadFiles(lgId, files)
          uploadedFiles = result.files || []
          state.uploadingFiles = false
          this._syncViewFromThreadState(personalThreadId)

          // 更新用户消息的 attachments URL（上传完成后用服务端 URL 替换 blob）
          const userMsg = state.streamMessages.find(m => m.id === userMsgId)
          if (userMsg && userMsg.attachments) {
            const prevThumbs = userMsg.attachments.map(a => a.thumbnailUrl || '')
            userMsg.attachments = uploadedFiles.map((file, idx) => {
              const name = file.name || file.filename || '未命名文件'
              const fromApi = file.artifact_url || file.url || file.file_url
              let url = ''
              if (fromApi) url = toAbsoluteDeerflowMediaUrl(fromApi)
              else if (file.virtual_path) url = resolveArtifactURL(lgId, file.virtual_path)
              else url = buildUserUploadArtifactUrl(lgId, name)
              const mimeType = file.mime_type || file.type || ''
              const localThumb = prevThumbs[idx] || ''
              // 上传完成后回收 blob URL，避免内存积累
              if (localThumb.startsWith('blob:')) URL.revokeObjectURL(localThumb)
              return {
                name,
                url,
                thumbnailUrl: url || localThumb,
                size: Number(file.size) || 0,
                type: file.type || file.mime_type || '',
                mimeType,
              }
            })
            this._recomputeDisplayMessages(personalThreadId)
          }
        }

        // 2. 连接 SSE 流（通过 StreamManager，自动过滤子图 token）
        const streamMgr = this._getOrCreateStreamManager(personalThreadId)
        if (!streamMgr) {
          // 回滚乐观消息，避免永久空气泡残留
          state.streamMessages = state.streamMessages.filter(m => m.id !== userMsgId && m.id !== aiMsgId)
          state.error = '无法创建流式连接，请刷新后重试'
          state.sendingMessage = false
          state.isStreaming = false
          state.streamingMessageId = null
          this._recomputeDisplayMessages(personalThreadId)
          return
        }

        let sendText = text
        if (replyTo && replyTo.content) {
          const quotedLines = String(replyTo.content)
            .split('\n')
            .map(line => `> ${line}`)
            .join('\n')
          sendText = `${quotedLines}\n\n${text}`
        }

        const userAdditionalKwargs = {}
        if (uploadedFiles.length > 0) {
          userAdditionalKwargs.files = uploadedFiles
        }
        if (skills && skills.length > 0) {
          const skillId = this._buildSkillItems(skills)
          if (skillId !== null) userAdditionalKwargs.skill_id = skillId
        }

        // 提交给 streamManager 的 initialMessages 用账本（已持久化的历史）+ 当前 stream 中已落库的 raw
        const rawHistory = [
          ...(state.persistedMessages || []).filter(m => m.raw).map(m => m.raw),
          ...(state.streamMessages || []).filter(m => m.raw).map(m => m.raw),
        ]
        streamMgr.setInitialMessages(rawHistory)

        // 记录 initialMessages 中最后一条 AI 的 ID，用于 watch 回调区分新旧 AI 消息
        const lastInitialAi = [...rawHistory].reverse().find(m => m.type === 'ai')
        state._initialLastAiId = lastInitialAi?.id || null

        const contextPayload = this._buildContextPayload(mode, model, lgId)

        console.log('[SSE] submit thread=%s lgId=%s model=%s mode=%s files=%d',
          personalThreadId, lgId, model, mode, uploadedFiles.length)

        await streamMgr.submit(
          {
            messages: [{
              type: 'human',
              content: [{ type: 'text', text: sendText }],
              additional_kwargs: userAdditionalKwargs,
            }],
          },
          contextPayload,
          {
            onFinish: () => {
              console.log('[SSE] finish thread=%s', personalThreadId)
              this._finishStreaming(personalThreadId)
              this.fetchThreads()
              // 流式结束后刷账本：把刚结束的 run 收入持久化历史并按 id 合并
              this._safeRefreshLedgerOnRunSettled(personalThreadId)
            },
            onError: (err) => {
              console.error('[SSE] error thread=%s', personalThreadId, err)
              this._handleStreamError(err, personalThreadId)
              // 错误期间服务端可能已部分落库，与 onFinish 对称地刷一次账本（避开乐观气泡场景）
              this._safeRefreshLedgerOnRunSettled(personalThreadId)
            },
            // updates 事件：实时同步线程标题
            onUpdateEvent: (data) => {
              const updates = Object.values(data || {})
              for (const update of updates) {
                if (update && typeof update === 'object' && 'title' in update && update.title) {
                  const thread = this.threads.find(t => t.id === personalThreadId)
                  if (thread) thread.title = update.title
                  console.log('[SSE] title update thread=%s title=%s', personalThreadId, update.title)
                }
              }
            },
            // custom 事件：llm_retry 提示
            onCustomEvent: (event) => {
              if (event?.type === 'llm_retry' && event?.message) {
                console.warn('[SSE] llm_retry thread=%s msg=%s', personalThreadId, event.message)
              }
            },
            // LangChain 事件：on_tool_end（events 模式）
            onLangChainEvent: (event) => {
              if (event?.event === 'on_tool_end') {
                console.log('[SSE] tool_end name=%s', event.name)
              }
            },
          },
        )

      } catch (err) {
        console.error('[DeerFlow] Send message failed:', err)
        this._handleStreamError(err, personalThreadId)
      } finally {
        state.sendingMessage = false
        this._syncViewFromThreadState(personalThreadId)
      }
    },

    /**
     * 重新生成最后一条 AI 消息（与 deer-flow 对齐）
     * 机制：发送 type: 'remove' 删除旧 AI 消息后，后端会基于之前对话重新生成
     * @param {number} personalThreadId - personal thread ID
     * @param {Object} [options] - 选项（mode/model 等）
     */
    async regenerateLastMessage(personalThreadId, options = {}) {
      if (!personalThreadId) return
      const state = this._getThreadState(personalThreadId)
      if (state.sendingMessage || state.isStreaming) return

      const thread = this.threads.find(t => t.id === personalThreadId)
      const lgId = thread?.langgraph_thread_id
      if (!lgId) {
        state.error = '该对话尚未关联 LangGraph 线程，请刷新后重试'
        this._syncViewFromThreadState(personalThreadId)
        return
      }

      // 找到最后一条 AI 消息（从目标对话的合并视图找）
      const viewMessages = state.messages || []
      const lastAiIdx = [...viewMessages].reverse().findIndex(m => m.role === 'assistant')
      if (lastAiIdx === -1) {
        ElMessage.warning('没有可重新生成的消息')
        return
      }
      const actualIdx = viewMessages.length - 1 - lastAiIdx
      const lastAi = viewMessages[actualIdx]
      // raw.id 是后端的真实 id，优先使用
      const lastAiId = lastAi?.raw?.id || lastAi?.id
      if (!lastAiId) {
        ElMessage.warning('消息 ID 缺失，无法重新生成')
        return
      }

      const {
        mode = 'flash',
        model = this.selectedModelName || 'claude-sonnet-4-6',
        skills = [],
      } = options

      // 与 sendMessage 保持一致的视觉反馈：先把旧 AI 气泡替换为"思考中"占位让用户立刻
      // 看到响应，再去 await renameThread / 启 SSE。否则用户点重新生成后会先空等网络往返。
      const aiMsgId = lastAi.id
      state.persistedMessages = (state.persistedMessages || []).filter(m => m.id !== lastAiId)
      state.pages = (state.pages || []).map(p => ({
        ...p,
        history_messages: (p.history_messages || []).filter(rm => rm.id !== lastAiId),
      }))
      const placeholder = {
        ...lastAi,
        content: '',
        isStreaming: true,
        isOptimistic: true,
        hasError: false,
      }
      const existIdx = state.streamMessages.findIndex(m => m.id === aiMsgId)
      if (existIdx >= 0) state.streamMessages[existIdx] = placeholder
      else state.streamMessages.push(placeholder)

      state.streamingMessageId = aiMsgId
      state.sendingMessage = true
      state.isStreaming = true
      this._recomputeDisplayMessages(personalThreadId)

      // 在历史对话中重新生成前，调用 renameThread 接口触发 updated_at 更新
      try {
        await threadApi.renameThread(personalThreadId, thread.title || '新对话', lgId)
      } catch (err) {
        console.warn('[DeerFlow] Failed to touch thread before regenerating:', err)
      }
      void this.fetchThreads()

      try {
        // 构建 additional_kwargs：包含技能ID
        const removeKwargs = {}
        const skillId = this._buildSkillItems(skills)
        if (skillId !== null) removeKwargs.skill_id = skillId

        // 发送 remove 消息（通过 StreamManager）
        const streamMgr = this._getOrCreateStreamManager(personalThreadId)
        if (!streamMgr) {
          state.error = '无法创建流式连接，请刷新后重试'
          state.sendingMessage = false
          state.isStreaming = false
          state.streamingMessageId = null
          this._syncViewFromThreadState(personalThreadId)
          return
        }

        // initialMessages = persisted + stream 中的 raw，去掉被重新生成的那条
        const rawHistory = [
          ...(state.persistedMessages || []).filter(m => m.raw).map(m => m.raw),
          ...(state.streamMessages || []).filter(m => m.raw).map(m => m.raw),
        ].filter(m => m.id !== lastAiId)
        streamMgr.setInitialMessages(rawHistory)

        // 记录 initialMessages 中最后一条 AI 的 ID（已排除被重新生成的那条）
        const lastInitialAi = [...rawHistory].reverse().find(m => m.type === 'ai')
        state._initialLastAiId = lastInitialAi?.id || null

        const contextPayload = this._buildContextPayload(mode, model, lgId)

        console.log('[SSE] regenerate thread=%s lgId=%s model=%s mode=%s',
          personalThreadId, lgId, model, mode)

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
              console.log('[SSE] finish thread=%s (regenerate)', personalThreadId)
              this._finishStreaming(personalThreadId)
              this.fetchThreads()
              this._safeRefreshLedgerOnRunSettled(personalThreadId)
            },
            onError: (err) => {
              console.error('[SSE] error thread=%s (regenerate)', personalThreadId, err)
              this._handleStreamError(err, personalThreadId)
              this._safeRefreshLedgerOnRunSettled(personalThreadId)
            },
            onUpdateEvent: (data) => {
              const updates = Object.values(data || {})
              for (const update of updates) {
                if (update && typeof update === 'object' && 'title' in update && update.title) {
                  const thread = this.threads.find(t => t.id === personalThreadId)
                  if (thread) thread.title = update.title
                  console.log('[SSE] title update thread=%s title=%s', personalThreadId, update.title)
                }
              }
            },
            onCustomEvent: (event) => {
              if (event?.type === 'llm_retry' && event?.message) {
                console.warn('[SSE] llm_retry thread=%s msg=%s', personalThreadId, event.message)
              }
            },
            onLangChainEvent: (event) => {
              if (event?.event === 'on_tool_end') {
                console.log('[SSE] tool_end name=%s', event.name)
              }
            },
          },
        )
      } catch (err) {
        console.error('[DeerFlow] Regenerate failed:', err)
        this._handleStreamError(err, personalThreadId)
      } finally {
        state.sendingMessage = false
        this._syncViewFromThreadState(personalThreadId)
      }
    },

    /**
     * 完成流式输出
     */
    _finishStreaming(personalThreadId) {
      const tid = personalThreadId ?? this.currentThreadId
      const state = this._getThreadState(tid)
      if (!state) return
      // 清除流式占位消息的 isStreaming 标记，防止后端无内容返回时永久显示"思考中..."
      if (state.streamingMessageId) {
        const streamingMsg = (state.streamMessages || []).find(m => m.id === state.streamingMessageId)
          || (state.messages || []).find(m => m.id === state.streamingMessageId)
        if (streamingMsg) {
          streamingMsg.isStreaming = false
          // 后端无任何输出（content/toolSteps/attachments/reasoning 都为空）时直接移除占位气泡
          // 否则会看到只有头像 + 名字的空 AI 消息，体验像 bug
          const isEmpty =
            !String(streamingMsg.content || '').trim()
            && !(streamingMsg.toolSteps && streamingMsg.toolSteps.length)
            && !(streamingMsg.attachments && streamingMsg.attachments.length)
            && !streamingMsg.reasoning
          if (isEmpty) {
            state.streamMessages = (state.streamMessages || []).filter(m => m.id !== state.streamingMessageId)
          }
        }
      }
      state.isStreaming = false
      state.streamingMessageId = null
      state.stoppedByUser = false
      state._initialLastAiId = null
      this._recomputeDisplayMessages(tid)
    },

    /**
     * 处理流式错误
     */
    _handleStreamError(error, personalThreadId) {
      const tid = personalThreadId ?? this.currentThreadId
      const state = this._getThreadState(tid)
      if (!state) return
      if (state.streamingMessageId) {
        const streamingMsg = (state.streamMessages || []).find(m => m.id === state.streamingMessageId)
          || (state.messages || []).find(m => m.id === state.streamingMessageId)
        if (streamingMsg) {
          streamingMsg.isStreaming = false
          const isEmpty =
            !String(streamingMsg.content || '').trim()
            && !(streamingMsg.toolSteps && streamingMsg.toolSteps.length)
            && !(streamingMsg.attachments && streamingMsg.attachments.length)
            && !streamingMsg.reasoning
          if (isEmpty) {
            state.streamMessages = (state.streamMessages || []).filter(m => m.id !== state.streamingMessageId)
          }
        }
      }
      state.isStreaming = false
      state.streamingMessageId = null
      state._initialLastAiId = null
      state.error = error?.message || String(error)
      this._recomputeDisplayMessages(tid)
    },

    /**
     * 停止生成（中断流式请求 + 调用后端 cancel API）
     * @param {number} [personalThreadId] 不传则停止当前对话
     */
    stopStreaming(personalThreadId) {
      const tid = personalThreadId ?? this.currentThreadId
      const state = this._getThreadState(tid)
      if (!state || !state.isStreaming) return

      const streamMgr = state.streamManager
      if (streamMgr) streamMgr.stop()
      state.stoppedByUser = true

      // 调用后端 cancel API 确保 agent 立即中断
      const thread = this.threads.find(t => t.id === tid)
      const lgId = thread?.langgraph_thread_id
      if (lgId) {
        const runId = getStoredRunId(lgId)
        if (runId) {
          threadApi.cancelRun(lgId, runId, { wait: false, action: 'interrupt' }).catch(() => {})
          clearStoredRunId(lgId)
        }
      }

      const aiMsgId = state.streamingMessageId
      if (aiMsgId) {
        const aiMsg = (state.streamMessages || []).find(m => m.id === aiMsgId)
          || (state.messages || []).find(m => m.id === aiMsgId)
        if (aiMsg) {
          aiMsg.isStreaming = false
          aiMsg.isOptimistic = false
          if (!aiMsg.content.trim()) {
            aiMsg.content = '[已停止生成]'
          }
        }
      }

      state.isStreaming = false
      state.streamingMessageId = null
      state.sendingMessage = false
      state._initialLastAiId = null
      this._recomputeDisplayMessages(tid)
      // 中断后服务端可能已落库部分内容（cancel 之前生成的 token / 工具调用结果）。
      // 与 onFinish / onError 对称，刷一次账本以确保前端与后端同步。
      // _safeRefreshLedgerOnRunSettled 内部会跳过仍有未替换乐观气泡的情况，
      // 不会引入重复气泡。
      this._safeRefreshLedgerOnRunSettled(tid)
    },

    /**
     * 从 LangGraph 消息的 additional_kwargs.skill_id 中提取技能对象
     * 发送时结构：{ slug, name }（单个）或 [{ slug, name }, ...]（多个）
     * 兼容老数据：skill_id 为字符串（仅 slug）或字符串数组时，降级为 { slug, name: slug }
     */
    _extractSkills(msg) {
      const raw = msg?.additional_kwargs?.skill_id
      if (!raw) return []
      const list = Array.isArray(raw) ? raw : [raw]
      return list
        .map(item => {
          // 老数据：纯 slug 字符串
          if (typeof item === 'string') {
            const slug = item.trim()
            return slug ? { slug, displayName: slug } : null
          }
          // 新结构：{ slug, name, avatar }
          if (item && typeof item === 'object') {
            const slug = item.slug || item.id
            if (!slug) return null
            const name = item.name || item.displayName || slug
            const avatar = item.avatar || ''
            return { slug, name, displayName: name, avatar }
          }
          return null
        })
        .filter(Boolean)
    },

    /**
     * 提取消息内容
     */
    _extractContent(content) {
      if (typeof content === 'string') {
        return content
      }
      if (Array.isArray(content)) {
        return content
          .filter(c => c.type === 'text' || typeof c === 'string')
          .map(c => (typeof c === 'string' ? c : c.text || ''))
          .join('')
      }
      return ''
    },

    _deriveUiMessagesFromRaw(rawMessages, lgId) {
      return this._rawMessagesToUiMessages(rawMessages, lgId)
    },

    _getOrCreateStreamManager(personalThreadId) {
      const state = this._getThreadState(personalThreadId)
      if (!state) return null
      if (state.streamManager) return state.streamManager

      const thread = this.threads.find(t => t.id === personalThreadId)
      const lgId = thread?.langgraph_thread_id
      if (!lgId) return null

      const mgr = useStreamManager(lgId)
      state.streamManager = mgr

      const stopRaw = watch(
        mgr.rawMessages,
        (msgs) => {
          // 由 streamManager.rawMessages 转出 streamMessages（与 persistedMessages 同结构）
          const sdkMessages = this._deriveUiMessagesFromRaw(msgs, lgId)
          // 直接检查原始 msgs（未过滤），判断 SDK 是否已有对应 role 的消息
          const rawMsgs = msgs || []
          const sdkHasUser = rawMsgs.some(m => m.type === 'human')
          // 判断 SDK 是否返回了新的 AI 消息（不同于 initialMessages 中的最后一条）
          const lastSdkAi = [...rawMsgs].reverse().find(m => m.type === 'ai')
          const sdkHasNewAssistant = lastSdkAi && lastSdkAi.id !== state._initialLastAiId
          // 保留尚未被真消息替换的乐观气泡（来自 streamMessages 自己保留的乐观条目）
          const optimisticMsgs = (state.streamMessages || []).filter(m => {
            if (!m.isOptimistic) return false
            if (m.role === 'user') return !sdkHasUser
            if (m.role === 'assistant') return !sdkHasNewAssistant
            return false
          })

          // 取最后一条 AI 消息，打印流式内容片段
          if (lastSdkAi) {
            const rawContent = typeof lastSdkAi.content === 'string'
              ? lastSdkAi.content
              : Array.isArray(lastSdkAi.content)
                ? lastSdkAi.content.filter(c => c.type === 'text').map(c => c.text).join('')
                : ''
            const toolNames = lastSdkAi.tool_calls?.map(tc => tc.name).join(', ') || ''
            console.log('[SSE] token thread=%s content(%d)="%s"%s',
              personalThreadId,
              rawContent.length,
              rawContent.slice(-80),
              toolNames ? ` tool_calls=[${toolNames}]` : '',
            )
          }

          // 流式期间，将最后一条 assistant 消息标记为 isStreaming，触发光标/禁用 actions
          // 只有当 SDK 返回了新的 AI 消息（不同于 initialMessages 中的旧消息）时才标记
          if (state.isStreaming && sdkHasNewAssistant) {
            for (let i = sdkMessages.length - 1; i >= 0; i--) {
              if (sdkMessages[i].role === 'assistant') {
                sdkMessages[i] = { ...sdkMessages[i], isStreaming: true }
                state.streamingMessageId = sdkMessages[i].id
                break
              }
            }
          }

          // SDK rawMessages 内含整个会话历史快照（包含账本已表达的所有消息）。
          // 直接灌入 streamMessages 会与账本形成"全量影子"——含过期版本时会盖住
          // 账本最新数据，引发"页面与接口不一致 / 用户发新消息后历史顺序混乱"。
          //
          // 写入策略：仅保留 SDK 中"账本尚未表达的部分"。
          //   - 当前流式那条（id === streamingId）：保留，让 token 实时显示
          //   - id 在 persistedIds 中：跳过，账本权威
          //   - id 不在 persistedIds 但有 raw（说明是当前 run 新消息）：保留
          //   - 没有 id 的（极少）：保留以防丢失
          //
          // 注意：sdkMessages 是 _rawMessagesToUiMessages 转出的"按 turn 合并的 ui 气泡"。
          // 一个 ui 气泡的 id 是 anchor ai 的 id（或 user 的 id）。我们用 anchor id 判断，
          // 与账本里 ui 气泡的 id 比较——后者也是 _rawMessagesToUiMessages 转出，id 计算方式一致。
          const persistedIdsForFilter = new Set(
            (state.persistedMessages || []).map(m => m?.id).filter(Boolean)
          )
          const filteredSdk = sdkMessages.filter((m) => {
            if (!m) return false
            if (!m.id) return true
            if (state.streamingMessageId && m.id === state.streamingMessageId) return true
            return !persistedIdsForFilter.has(m.id)
          })

          state.streamMessages = [...filteredSdk, ...optimisticMsgs]
          this._recomputeDisplayMessages(personalThreadId)
        },
        { deep: false },
      )

      const stopLoading = watch(mgr.isLoading, (loading) => {
        console.log('[SSE] loading=%s thread=%s', loading, personalThreadId)
        state.isStreaming = loading
        this._syncViewFromThreadState(personalThreadId)
      })

      const stopTodos = watch(mgr.todos, (newTodos) => {
        state.todos = newTodos ?? []
        this._syncViewFromThreadState(personalThreadId)
      }, { deep: false })

      state.streamManagerWatchers = [stopRaw, stopLoading, stopTodos]
      return mgr
    },

    _dedupeAttachments(attachments) {
      const seen = new Set()
      const deduped = []
      for (const a of attachments) {
        const k = `${a.url || ''}\u0000${a.name || ''}`
        if (!k.trim() || seen.has(k)) continue
        seen.add(k)
        deduped.push(a)
      }
      return deduped
    },

    /** 本轮用户消息之后的所有 AI 条目的附件合并（与 Web 「尾部 AI 段落」对齐，含多分片 present_files） */
    _collectAiAttachmentsAfterHuman(messages, lastHumanIdx, langgraphThreadId) {
      if (!langgraphThreadId || !Array.isArray(messages) || lastHumanIdx < -1) return []
      const out = []
      for (let i = lastHumanIdx + 1; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.type !== 'ai' && msg.role !== 'assistant') continue
        out.push(...this._extractAttachments(msg, langgraphThreadId))
      }
      return this._dedupeAttachments(out)
    },

    /**
     * 从 LangGraph 消息中提取附件
     * @param {object} msg
     * @param {string} [langgraphThreadId] 用于解析正文里 <uploaded_files> 并拼出 GET /uploads/ 地址
     */
    _extractAttachments(msg, langgraphThreadId) {
      const attachments = []

      // 从 additional_kwargs.files 提取
      if (msg.additional_kwargs?.files && Array.isArray(msg.additional_kwargs.files)) {
        attachments.push(...msg.additional_kwargs.files.map(file => {
          const name = file.name || file.filename || '未命名文件'
          const fromApi = file.artifact_url || file.url || file.file_url || file.download_url
          let url = ''
          if (fromApi) url = toAbsoluteDeerflowMediaUrl(fromApi)
          else if (file.virtual_path && langgraphThreadId) {
            url = resolveArtifactURL(langgraphThreadId, file.virtual_path)
          } else if (langgraphThreadId && typeof file.path === 'string' && file.path.includes('/mnt/user-data')) {
            url = resolveArtifactURL(langgraphThreadId, file.path)
          } else if (langgraphThreadId) {
            url = buildUserUploadArtifactUrl(langgraphThreadId, name)
          }
          return {
            name,
            url,
            thumbnailUrl: file.thumbnail_url || file.preview_url || url || '',
            size: file.size || 0,
            type: (() => {
              const dotIdx = name.lastIndexOf('.')
              if (dotIdx > 0) return name.slice(dotIdx + 1).toLowerCase()
              const rawType = file.type || file.mime_type || file.content_type || ''
              return rawType.includes('/') ? deerflowMimeToExt(rawType) : rawType.toLowerCase()
            })(),
            mimeType: file.mime_type || file.type || file.content_type || '',
          }
        }))
      }

      // 从 content 数组中提取图片（如果 content 是数组且包含 image 类型）
      if (Array.isArray(msg.content)) {
        msg.content.forEach(item => {
          if (item.type === 'image' || item.type === 'image_url') {
            const url = item.url || item.image_url?.url || ''
            attachments.push({
              name: item.name || '图片',
              url: url,
              thumbnailUrl: url,
              type: 'image',
              mimeType: item.mime_type || 'image/png',
              size: item.size || 0,
            })
          }
        })
      }

      // AI present_files tool：/mnt/user-data/outputs/hello.md（与 Web ArtifactFileList 同源）
      if (langgraphThreadId) {
        const pPaths = extractPresentFilesPathsFromToolCalls(msg)
        if (pPaths.length) {
          attachments.push(...attachmentsFromPresentFilePaths(langgraphThreadId, pPaths))
        }
      }

      // history / checkpoint：附件写在正文 <uploaded_files> 中（Path: /mnt/user-data/uploads/...）
      // 仅当 additional_kwargs.files 未提供时才从正文解析，避免同一文件重复出现
      if (attachments.length === 0) {
        const flatText = this._extractContent(msg.content)
        if (langgraphThreadId && flatText) {
          attachments.push(...parseUploadedFilesFromContent(flatText, langgraphThreadId))
        }
      }

      return this._dedupeAttachments(attachments)
    },

    // ─── 引用管理 ───────────────────────────────────────────

    setQuotingMessage(message) {
      this.quotingMessage = message ? {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      } : null
    },

    clearQuotingMessage() {
      this.quotingMessage = null
    },

    // ─── 消息反馈 ───────────────────────────────────────────

    async submitFeedback(messageId, type) {
      const msg = this.messages.find(m => m.id === messageId)
      if (msg) {
        msg.feedback = type
      }
    },

    // ─── 模型管理 ───────────────────────────────────────────

    /**
     * 加载对话模型列表
     * @param {string} agentId - 智能体 ID
     * @param {string} channel - 渠道标识，默认 'kc-oc'
     */
    async loadChatModels(agentId, channel = 'kc-oc') {
      if (!agentId) return
      if (!this._isAuthenticated()) return
      if (this.loadingChatModels) return
      this.loadingChatModels = true
      this.error = null

      try {
        const data = await fetchChatModels(agentId, channel)
        this.chatCurrentModel = data.current_model
        this.chatAvailableModels = data.available_models

        // 用户手动选择过模型时，不覆盖（切换会话保持用户选择）
        if (this.userSelectedModelName) {
          this.selectedModelName = this.userSelectedModelName
        } else if (data.current_model?.model_name) {
          this.selectedModelName = data.current_model.model_name
        } else if (this.chatAvailableModels.length > 0) {
          this.selectedModelName = this.chatAvailableModels[0].model_name
        }
      } catch (err) {
        console.error('[DeerFlow] Failed to load chat models:', err)
        this.error = err.message
        if (!this.selectedModelName) {
          this.selectedModelName = 'claude-sonnet-4-6'
        }
      } finally {
        this.loadingChatModels = false
      }
    },

    /**
     * 切换模型
     */
    setSelectedModel(modelName) {
      const inChat = this.chatAvailableModels.find(m => m.model_name === modelName)
      if (inChat) {
        this.selectedModelName = modelName
        this.userSelectedModelName = modelName
      }
    },

    /**
     * 用户手动选择模式（切换会话不重置）
     */
    setSelectedMode(mode) {
      this.userSelectedMode = mode
    },

    /**
     * 更新模型选择并持久化到后端（与 deer-flow 对齐）
     * @param {Object} params
     * @param {number|null} params.provider_config_id
     * @param {number|null} params.model_config_id
     * @param {string} [params.agent_id] - 可选的 agent ID
     */
    async updateModelSelection(params) {
      try {
        await updateModelSelection({
          channel: this.channel,
          ...params,
        })

        // 更新成功后，重新加载对话模型
        if (this.selectedAgentId) {
          await this.loadChatModels(this.selectedAgentId, this.channel)
        }
      } catch (err) {
        console.error('[DeerFlow] Failed to update model selection:', err)
        ElMessage.error('切换模型失败，请重试')
        throw err
      }
    },

    /**
     * 加载智能体列表（仅使用默认智能体）
     * 选择逻辑与 deer-flow 对齐：
     * 1. 先过滤 stateful=true（有记忆的 agent）
     * 2. 在 stateful agents 中找 is_default=true
     * 3. 如果没有 default，取第一个 stateful agent
     * @param {Object} options - 查询选项
     * @param {boolean} options.stateful - 是否只返回有状态的智能体
     */
    async loadAgents(options = {}) {
      // 未登录时跳过
      if (!this._isAuthenticated()) return
      if (this.loadingAgents) return
      this.loadingAgents = true

      try {
        const data = await threadApi.listMyAgents(options)
        // 后端返回结构可能是：数组 / { items: [...] } / { agents: [...] } / { data: [...] } / { data: { agents: [...] } }
        let allAgents = []
        if (Array.isArray(data)) {
          allAgents = data
        } else if (Array.isArray(data?.items)) {
          allAgents = data.items
        } else if (Array.isArray(data?.agents)) {
          allAgents = data.agents
        } else if (Array.isArray(data?.data)) {
          allAgents = data.data
        } else if (Array.isArray(data?.data?.agents)) {
          allAgents = data.data.agents
        }

        // ① 先过滤 stateful=true（与 deer-flow 对齐，兼容布尔/字符串/数字类型）
        const statefulAgents = allAgents.filter(a => !!a.stateful)

        // ② 在 stateful agents 中找 is_default=true，否则取第一个
        const selectedAgent = statefulAgents.find(a => a.is_default === true) ?? statefulAgents[0]

        if (selectedAgent) {
          // 只保存选中的智能体
          this.agents = [selectedAgent]
          this.selectedAgentId = selectedAgent.id
        } else {
          // 没有任何 stateful 智能体
          this.agents = []
          this.selectedAgentId = null
        }
      } catch (err) {
        console.error('[DeerFlow] Failed to load agents:', err)
        this.agents = []
        this.selectedAgentId = null
      } finally {
        this.loadingAgents = false
      }
    },

    /**
     * 加载数字真人列表
     */
    async loadDigitalHumans() {
      // 未登录时跳过
      if (!this._isAuthenticated()) return
      if (this.loadingDigitalHumans) return
      this.loadingDigitalHumans = true

      try {
        const data = await threadApi.listDigitalHumans()
        this.digitalHumans = data || []
      } catch (err) {
        console.error('[DeerFlow] Failed to load digital humans:', err)
      } finally {
        this.loadingDigitalHumans = false
      }
    },

    /**
     * 切换智能体
     * @param {number} agentId - 智能体 ID
     */
    async switchAgent(agentId) {
      if (!this.currentThreadId) {
        console.warn('[DeerFlow] No current thread to switch agent')
        return
      }

      try {
        await threadApi.switchDigitalHuman(this.currentThreadId, agentId)
        this.selectedAgentId = agentId

        // 刷新线程列表
        await this.fetchThreads()

        ElMessage.success('已切换智能体')
      } catch (err) {
        console.error('[DeerFlow] Failed to switch agent:', err)
        ElMessage.error('切换智能体失败')
      }
    },

    /**
     * 置顶会话
     * @param {number} personalThreadId - 线程 ID
     */
    async pinThread(personalThreadId) {
      try {
        await threadApi.pinThread(personalThreadId)
        const thread = this.threads.find(t => t.id === personalThreadId)
        if (thread) {
          thread.is_pinned = true
          thread.pinned_at = new Date().toISOString()
        }
        ElMessage.success('已置顶')
      } catch (err) {
        console.error('[DeerFlow] Failed to pin thread:', err)
        ElMessage.error('置顶失败')
        throw err
      }
    },

    /**
     * 取消置顶会话
     * @param {number} personalThreadId - 线程 ID
     */
    async unpinThread(personalThreadId) {
      try {
        await threadApi.unpinThread(personalThreadId)
        const thread = this.threads.find(t => t.id === personalThreadId)
        if (thread) {
          thread.is_pinned = false
          thread.pinned_at = null
        }
        ElMessage.success('已取消置顶')
      } catch (err) {
        console.error('[DeerFlow] Failed to unpin thread:', err)
        ElMessage.error('取消置顶失败')
        throw err
      }
    },
  }
})
