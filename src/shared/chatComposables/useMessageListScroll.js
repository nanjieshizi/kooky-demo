/**
 * 消息列表滚动管理 composable
 *
 * @param {Ref<HTMLElement|null>} listRef - 消息列表滚动容器引用
 * @param {Ref<boolean>} suppressScrollToBottomForPrepend - 上滑分页时抑制自动滚底
 * @param {import('vue').Ref<boolean>|import('vue').ComputedRef<boolean>} [anchoredToMention] - 可选：为 true 时抑制自动滚底
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const LOAD_MORE_TOP_PX = 80

export function useMessageListScroll(listRef, suppressScrollToBottomForPrepend, anchoredToMention) {
  const userScrolledUp = ref(false)
  const showScrollToBottom = computed(() => userScrolledUp.value)

  function applyPrependScrollAnchor(wrap, prevScrollHeight, prevScrollTop) {
    if (!wrap) return
    const delta = wrap.scrollHeight - prevScrollHeight
    wrap.scrollTop = prevScrollTop + delta
  }

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

  function attachScrollTriggers(messageCount, streamingContent, remoteTypingCount, onScrollTop) {
    function onScroll() {
      if (!listRef.value) return
      const { scrollTop, scrollHeight, clientHeight } = listRef.value
      userScrolledUp.value = scrollHeight - scrollTop - clientHeight > 60
      if (scrollTop <= LOAD_MORE_TOP_PX) {
        onScrollTop?.()
      }
    }

    watch(messageCount, () => {
      if (suppressScrollToBottomForPrepend.value) return
      if (anchoredToMention?.value) return
      scrollToBottom()
    })

    watch(streamingContent, () => {
      if (suppressScrollToBottomForPrepend.value) return
      if (anchoredToMention?.value) return
      scrollToBottom()
    })

    watch(remoteTypingCount, () => {
      if (suppressScrollToBottomForPrepend.value) return
      if (anchoredToMention?.value) return
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
    applyPrependScrollAnchor,
    attachScrollTriggers,
  }
}
