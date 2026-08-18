import { ref } from 'vue'
import { Client } from '@langchain/langgraph-sdk/client'
import { StreamManager, MessageTupleManager } from '@langchain/langgraph-sdk/ui'
import { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

// SDK Client 单例（模块级，不随 composable 重建）
let _client = null
function getClient() {
  if (_client) return _client
  _client = new Client({
    apiUrl: `${getOneBaseUrl()}/kooky-api/api/langgraph-compat`,
    onRequest: (url, init) => {
      const token = getSsoToken()
      const headers = new Headers(init.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return { ...init, headers }
    },
  })
  return _client
}

/** 登出时调用，清除缓存的 Client 单例（防止 URL/token 过期后仍使用旧实例） */
export function resetStreamClient() {
  _client = null
}

// sessionStorage key 格式：lg:stream:{threadId}
function getRunStorageKey(threadId) {
  return `lg:stream:${threadId}`
}

/** 获取指定线程的活跃 run_id */
export function getStoredRunId(threadId) {
  try {
    return sessionStorage.getItem(getRunStorageKey(threadId)) || null
  } catch { return null }
}

/** 清除指定线程的 run_id */
export function clearStoredRunId(threadId) {
  try { sessionStorage.removeItem(getRunStorageKey(threadId)) } catch {}
}

/**
 * Vue composable：封装 SDK StreamManager，管理单个对话的流式生命周期。
 * @param {string} lgThreadId  LangGraph thread id
 */
export function useStreamManager(lgThreadId) {
  const rawMessages = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const todos = ref([])

  const manager = new StreamManager(new MessageTupleManager(), {
    filterSubagentMessages: true,
    throttle: false,
  })

  const unsubscribe = manager.subscribe(() => {
    const msgs = manager.values?.messages
    rawMessages.value = msgs ? [...msgs] : []
    isLoading.value = manager.isLoading
    error.value = manager.error ?? null
    const todosArr = manager.values?.todos
    todos.value = todosArr ? [...todosArr] : []

    // 从 metadata 中捕获 run_id 并存入 sessionStorage
    const runId = manager.metadata?.run_id
    if (runId) {
      try { sessionStorage.setItem(getRunStorageKey(lgThreadId), runId) } catch {}
    }
  })

  let _pendingInitial = null

  /**
   * 设置下次 submit 的 initialMessages。
   *
   * 关键：除了缓存到 _pendingInitial（提供给 manager.start 的 initialValues），
   * 还要把 SDK 内部 state.values 主动同步成我们传的 messages。
   *
   * 为什么不能不同步：SDK 的 enqueue 在处理 messages-tuple 事件时执行
   *   const values = { ...options.initialValues, ...streamValues }
   * streamValues 来自上一次 run 累积的 SDK 内部状态，若不同步则会覆盖
   * 我们传的 initialValues，导致跨 run 出现：
   *   - SDK rawMessages 仍含上一轮历史快照
   *   - regenerate 后旧 ai 内容继续残留
   *   - 表现为发新消息后历史 ai 错位甚至消失
   *
   * 为什么不能用 manager.clear()：clear 会 abort 当前任何挂起的 run、
   * 并瞬间把 rawMessages 置为 []，造成 streamMessages 也被清空——
   * 如果用户在前一次 onFinish 的 loadFirstPage 还没回来时立刻发下一条，
   * 上一条 ai 的 ui 气泡会从视图中消失。
   *
   * 用 setStreamValues 是非破坏性的：它只覆盖 state.values（含 messages），
   * 不影响 abortRef / isLoading / messages 缓存等其他状态。
   */
  function setInitialMessages(messages) {
    const arr = Array.isArray(messages) ? messages.slice() : []
    _pendingInitial = arr
    // 把 SDK 内部 state.values.messages 强制同步到 arr，避免跨 run 时
    // 旧的 streamValues 覆盖新的 initialValues。
    manager.setStreamValues({ messages: arr })
  }

  const _streamOptions = {
    getMessages: (v) => v?.messages ?? [],
    setMessages: (v, msgs) => ({ ...v, messages: msgs }),
  }

  async function submit(input, context, callbacks = {}) {
    const initialMsgs = _pendingInitial !== null ? _pendingInitial : rawMessages.value.slice()
    _pendingInitial = null
    await manager.start(
      (signal) =>
        getClient().runs.stream(lgThreadId, 'lead_agent', {
          input,
          context,
          streamMode: ['messages-tuple', 'values', 'updates', 'events', 'custom'],
          streamSubgraphs: true,
          streamResumable: true,
          onDisconnect: 'cancel',
          config: { recursion_limit: 1000 },
          signal,
        }),
      {
        initialValues: { messages: initialMsgs },
        ..._streamOptions,
        onFinish: () => {
          clearStoredRunId(lgThreadId)
          callbacks.onFinish?.()
        },
        onError: (err) => {
          clearStoredRunId(lgThreadId)
          callbacks.onError?.(err)
        },
        callbacks: {
          onUpdateEvent: callbacks.onUpdateEvent,
          onCustomEvent: callbacks.onCustomEvent,
          onLangChainEvent: callbacks.onLangChainEvent,
        },
      },
      { abortPrevious: true },
    )
  }

  async function reconnect(runId, callbacks = {}) {
    await manager.start(
      (signal) =>
        getClient().runs.joinStream(lgThreadId, runId, { signal }),
      {
        initialValues: { messages: rawMessages.value.slice() },
        ..._streamOptions,
        onFinish: () => {
          clearStoredRunId(lgThreadId)
          callbacks.onFinish?.()
        },
        onError: (err) => {
          clearStoredRunId(lgThreadId)
          callbacks.onError?.(err)
        },
        callbacks: {
          onUpdateEvent: callbacks.onUpdateEvent,
          onCustomEvent: callbacks.onCustomEvent,
          onLangChainEvent: callbacks.onLangChainEvent,
        },
      },
      { abortPrevious: true },
    )
  }

  function stop() {
    manager.stop({}, {})
  }

  function reset() {
    clearStoredRunId(lgThreadId)
    unsubscribe?.()
    manager.clear()
    rawMessages.value = []
    isLoading.value = false
    error.value = null
    todos.value = []
  }

  return { rawMessages, isLoading, error, todos, submit, reconnect, stop, reset, setInitialMessages }
}