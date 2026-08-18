/**
 * 群聊消息列表数据层 composable（群聊专用）
 * 与 useMessageListCore 对应，但数据源来自 groupStore（按 conversationId 隔离的 conversationMessages 字典）
 *
 * @param {string} frozenGroupId - 冻结的群聊会话 ID
 */
import { computed, ref, nextTick } from 'vue'
import { useGroupStore } from '@/modules/group/store'

export function useGroupMessageListCore(frozenGroupId) {
  const groupStore = useGroupStore()

  const listConversationId = computed(() => frozenGroupId)

  const loadingMoreForList = computed(() => groupStore.isConversationLoadingMoreHistory(frozenGroupId))

  const messages = computed(() => {
    if (!frozenGroupId) return []
    return groupStore.getMessagesByConversation(frozenGroupId)
  })

  const messageCount = computed(() => messages.value.length)

  const streamingContent = computed(() => {
    const last = messages.value[messages.value.length - 1]
    const content = last?.content && typeof last.content === 'object' ? last.content.body : last?.content
    return last?.isStreaming ? content : null
  })

  /** 跟踪 conversationMessages 内 loading 标记变化，以便 canPaginate 变化后重新计算 */
  const conversationMessagesSync = computed(() => {
    const rc = groupStore.conversationMessages[frozenGroupId]
    if (!rc) return 0
    return (
      (rc.initialHistoryFetched ? 1 : 0) +
      (rc.loadingHistory ? 2 : 0) +
      (rc.loadingMoreHistory ? 4 : 0) +
      (rc.remoteTypingUserIds?.length ?? 0) * 8
    )
  })

  const remoteTypingCount = computed(() => {
    if (!frozenGroupId) return 0
    return groupStore.conversationMessages[frozenGroupId]?.remoteTypingUserIds?.length ?? 0
  })

  const showRemoteTyping = computed(() => remoteTypingCount.value > 0)

  const showHistoryLoading = computed(() => {
    void conversationMessagesSync.value
    if (!frozenGroupId || messages.value.length > 0) return false
    const rc = groupStore.conversationMessages[frozenGroupId]
    if (!rc?.initialHistoryFetched) return true
    if (rc.loadingHistory || rc.loadingMoreHistory) return true
    if (!groupStore.isConversationJoined(frozenGroupId)) return false
    return groupStore.canLoadMoreHistory(frozenGroupId)
  })

  /** 最后一条「已结束且有内容」的助手消息，用于操作栏常显判定 */
  const latestFinishedAssistantMessageId = computed(() => {
    const msgs = messages.value
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      const content = m?.content && typeof m.content === 'object' ? m.content.body : m?.content
      if (m.role === 'assistant' && content && !m.isStreaming) {
        return stableMessageId(m)
      }
    }
    return null
  })

  /** 上滑加载更早消息时抑制「条数变化 → 滚到底」，避免打断阅读位置 */
  const suppressScrollToBottomForPrepend = ref(false)

  /** 与 MessageItem :key、最后一条助手判定一致 */
  function stableMessageId(m) {
    if (m?.clientMessageKey != null && String(m.clientMessageKey).length > 0) {
      return String(m.clientMessageKey)
    }
    const { eventId } = m ?? {}
    if (eventId != null && String(eventId).length > 0) {
      return String(eventId)
    }
    return `im_${m.timestamp}_${m.conversationId}_${m.role}`
  }

  function resolveListConversationId() {
    return frozenGroupId
  }

  async function tryLoadOlderMessages(listRef, loadOlderLockedRef, applyPrependScrollAnchor) {
    const conversationId = frozenGroupId
    if (
      !conversationId ||
      loadOlderLockedRef.value ||
      groupStore.isConversationLoadingMoreHistory(conversationId) ||
      !groupStore.canLoadMoreHistory(conversationId)
    ) {
      return
    }
    const el = listRef.value
    if (!el) return
    loadOlderLockedRef.value = true
    suppressScrollToBottomForPrepend.value = true
    const prevScrollHeight = el.scrollHeight
    const prevScrollTop = el.scrollTop
    try {
      const { added } = await groupStore.loadMoreHistory(conversationId)
      if (added > 0) {
        const anchor = () =>
          applyPrependScrollAnchor(listRef.value, prevScrollHeight, prevScrollTop)
        await nextTick()
        await nextTick()
        anchor()
        requestAnimationFrame(() => {
          anchor()
          requestAnimationFrame(() => {
            anchor()
            setTimeout(anchor, 340)
            setTimeout(anchor, 720)
          })
        })
      }
    } finally {
      loadOlderLockedRef.value = false
      await nextTick()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressScrollToBottomForPrepend.value = false
        })
      })
    }
  }

  return {
    listConversationId,
    messages,
    messageCount,
    streamingContent,
    remoteTypingCount,
    loadingMoreForList,
    showHistoryLoading,
    latestFinishedAssistantMessageId,
    showRemoteTyping,
    suppressScrollToBottomForPrepend,
    stableMessageId,
    tryLoadOlderMessages,
    resolveListConversationId,
  }
}
