import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const LOAD_MORE_TOP_PX = 80

export function useEmployeeDeerflowScroll(listRef) {
  const userScrolledUp = ref(false)
  const showScrollToBottom = computed(() => userScrolledUp.value)

  function scheduleReliableScrollToBottom() {
    const nudge = () => {
      const el = listRef.value
      if (!el || userScrolledUp.value) return
      el.scrollTop = el.scrollHeight
    }
    nextTick(() => {
      nextTick(() => {
        nudge()
        requestAnimationFrame(() => {
          nudge()
          requestAnimationFrame(() => {
            nudge()
            setTimeout(nudge, 100)
            setTimeout(nudge, 340)
            setTimeout(nudge, 560)
          })
        })
      })
    })
  }

  function scrollToBottom() {
    if (userScrolledUp.value) return
    scheduleReliableScrollToBottom()
  }

  function forceScrollToBottom() {
    userScrolledUp.value = false
    scheduleReliableScrollToBottom()
  }

  function attachScrollTriggers(messageCount, streamingContent, onScrollTop, loadingOlderPage) {
    function onScroll() {
      if (!listRef.value) return
      const { scrollTop, scrollHeight, clientHeight } = listRef.value
      userScrolledUp.value = scrollHeight - scrollTop - clientHeight > 60
      if (scrollTop <= LOAD_MORE_TOP_PX) onScrollTop?.()
    }

    // 消息条数变化（发送、收到新消息、切换会话）：条数增加视为强意图，强制置底
    // 加载更早历史消息时跳过，由 EmployeeLoadOlderSentinel 负责恢复滚动位置
    watch(messageCount, (newLen, oldLen) => {
      if (loadingOlderPage?.value) return
      if (newLen > (oldLen ?? 0)) {
        forceScrollToBottom()
      } else {
        scrollToBottom()
      }
    })

    // 流式 token 更新：尊重用户滚动位置（向上读历史时不打断）
    watch(streamingContent, () => {
      scrollToBottom()
    })

    onMounted(() => {
      nextTick(() => {
        listRef.value?.addEventListener('scroll', onScroll, { passive: true })
        scrollToBottom()
      })
    })

    onUnmounted(() => {
      listRef.value?.removeEventListener('scroll', onScroll)
    })
  }

  return {
    userScrolledUp,
    showScrollToBottom,
    scrollToBottom,
    forceScrollToBottom,
    attachScrollTriggers,
  }
}
