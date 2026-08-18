import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 监听 Claude Code Hook 事件的 composable
 *
 * 使用方式:
 *   const { hookEvents, lastEvent, isServerRunning, clearEvents } = useClaudeHooks()
 *
 * hookEvents: 所有收到的 hook 事件数组（最新在前）
 * lastEvent: 最近一条事件
 * isServerRunning: hook server 是否在运行
 */
export function useClaudeHooks({ maxEvents = 200 } = {}) {
  const hookEvents = ref([])
  const lastEvent = ref(null)
  const isServerRunning = ref(false)

  function handleHookEvent(payload) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      ...payload,
    }
    lastEvent.value = entry
    hookEvents.value.unshift(entry)
    if (hookEvents.value.length > maxEvents) {
      hookEvents.value = hookEvents.value.slice(0, maxEvents)
    }
  }

  async function checkServerStatus() {
    if (!window.electronAPI?.getHookServerStatus) return
    try {
      const status = await window.electronAPI.getHookServerStatus()
      isServerRunning.value = status?.running ?? false
    } catch {
      isServerRunning.value = false
    }
  }

  function clearEvents() {
    hookEvents.value = []
    lastEvent.value = null
  }

  let offHook = null
  onMounted(() => {
    if (window.electronAPI?.onClaudeHookEvent) {
      offHook = window.electronAPI.onClaudeHookEvent(handleHookEvent)
    }
    checkServerStatus()
  })

  onUnmounted(() => {
    if (typeof offHook === 'function') offHook()
  })

  return {
    hookEvents,
    lastEvent,
    isServerRunning,
    clearEvents,
    checkServerStatus,
  }
}
