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
export function resetEmployeeLangGraphStreamClient() {
  _client = null
}

// sessionStorage key 格式：lg:stream:${employeeId}:${threadId}
function getRunStorageKey(threadKey) {
  return `lg:stream:${threadKey}`
}

/** 获取指定线程的活跃 run_id */
export function getStoredEmployeeRunId(threadKey) {
  try {
    return sessionStorage.getItem(getRunStorageKey(threadKey)) || null
  } catch { return null }
}

/** 清除指定线程的 run_id */
export function clearStoredEmployeeRunId(threadKey) {
  try { sessionStorage.removeItem(getRunStorageKey(threadKey)) } catch {}
}

/**
 * 与 LangGraph SDK StreamManager 对齐的流式封装（solo-team 独立副本）
 * @param {string} lgThreadId  LangGraph thread id
 * @param {string} threadKey   复合键，用于 run_id sessionStorage（如 `${employeeId}:${threadId}`）
 */
export function useEmployeeLangGraphStreamManager(lgThreadId, threadKey = '') {
  const rawMessages = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const todos = ref([])
  const storageKey = threadKey || lgThreadId

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
      try { sessionStorage.setItem(getRunStorageKey(storageKey), runId) } catch {}
    }
  })

  let _pendingInitial = null

  /**
   * 设置下次 submit 的 initialMessages。
   *
   * 除了缓存到 _pendingInitial（提供给 manager.start 的 initialValues），
   * 还要把 SDK 内部 state.values 主动同步成我们传的 messages，防止跨 run 时
   * 旧的 streamValues 覆盖新的 initialValues。
   */
  function setInitialMessages(messages) {
    const arr = Array.isArray(messages) ? messages.slice() : []
    _pendingInitial = arr
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
          clearStoredEmployeeRunId(storageKey)
          callbacks.onFinish?.()
        },
        onError: (err) => {
          clearStoredEmployeeRunId(storageKey)
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

  /**
   * 重连已有 run 的 SSE 流（页面刷新/断线后恢复）
   */
  async function reconnect(runId, callbacks = {}) {
    await manager.start(
      (signal) =>
        getClient().runs.joinStream(lgThreadId, runId, { signal }),
      {
        initialValues: { messages: rawMessages.value.slice() },
        ..._streamOptions,
        onFinish: () => {
          clearStoredEmployeeRunId(storageKey)
          callbacks.onFinish?.()
        },
        onError: (err) => {
          clearStoredEmployeeRunId(storageKey)
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
    clearStoredEmployeeRunId(storageKey)
    unsubscribe?.()
    manager.clear()
    rawMessages.value = []
    isLoading.value = false
    error.value = null
    todos.value = []
  }

  return { rawMessages, isLoading, error, todos, submit, reconnect, stop, reset, setInitialMessages }
}
