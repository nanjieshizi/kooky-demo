/**
 * 私聊消息列表数据层 composable
 * 与 useGroupMessageListCore 对应，但数据源来自 privateStore（按 conversationId 隔离的 chatMessages）
 *
 * @param {string|number} frozenConversationId
 */
import { computed, ref } from 'vue'
import { usePrivateStore } from '@/modules/private/store'

export function usePrivateMessageListCore(frozenConversationId) {
  const privateStore = usePrivateStore()

  const listConversationId = computed(() => frozenConversationId)

  const messages = computed(() => {
    if (!frozenConversationId) return []
    return privateStore.getMessagesByChatId(frozenConversationId)
  })

  const messageCount = computed(() => messages.value.length)

  const streamingContent = computed(() => null)

  const chatStateSync = computed(() => {
    const cs = privateStore.chatMessages[frozenConversationId]
    if (!cs) return 0
    return (
      (cs.initialHistoryFetched ? 1 : 0) +
      (cs.loadingHistory ? 2 : 0) +
      (cs.loadingMoreHistory ? 4 : 0) +
      (cs.remoteTypingUserIds?.length ?? 0) * 8
    )
  })

  const remoteTypingCount = computed(() => {
    void chatStateSync.value
    return privateStore.chatMessages[frozenConversationId]?.remoteTypingUserIds?.length ?? 0
  })

  const showRemoteTyping = computed(() => remoteTypingCount.value > 0)

  const showHistoryLoading = computed(() => {
    void chatStateSync.value
    if (!frozenConversationId || messages.value.length > 0) return false
    const cs = privateStore.chatMessages[frozenConversationId]
    if (!cs?.initialHistoryFetched) return true
    return !!(cs.loadingHistory || cs.loadingMoreHistory)
  })

  const suppressScrollToBottomForPrepend = ref(false)

  function stableMessageId(m) {
    if (m?.clientMessageKey != null && String(m.clientMessageKey).length > 0) {
      return String(m.clientMessageKey)
    }
    const eventId = m?.eventId ?? m?.event_id
    if (eventId != null && String(eventId).length > 0) {
      return String(eventId)
    }
    return `pm_${m.timestamp}_${m.conversationId ?? m.conversation_id}_${m.role}`
  }

  function resolveListConversationId() {
    return frozenConversationId
  }

  return {
    listConversationId,
    messages,
    messageCount,
    streamingContent,
    remoteTypingCount,
    showHistoryLoading,
    showRemoteTyping,
    suppressScrollToBottomForPrepend,
    stableMessageId,
    resolveListConversationId,
  }
}
