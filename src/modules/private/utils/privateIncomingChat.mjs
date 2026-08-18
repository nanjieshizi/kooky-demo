function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function getIncomingConversationId(message = {}) {
  return message.conversationId ?? message.conversation_id ?? null
}

export function getIncomingSenderName(message = {}) {
  return message.senderName ?? message.sender_name ?? ''
}

export function findPrivateChatForIncomingMessage(chats = [], message = {}) {
  const conversationId = getIncomingConversationId(message)
  if (conversationId != null && conversationId !== '') {
    const byConversation = chats.find(
      (chat) => normalizeKey(chat?.conversationId) === normalizeKey(conversationId),
    )
    if (byConversation) return byConversation
  }

  const senderName = normalizeKey(getIncomingSenderName(message))
  if (!senderName) return null

  return chats.find((chat) => normalizeKey(chat?.peerUsername) === senderName) || null
}

export function isIncomingPrivateMessageFromSelf(message = {}, currentUserId) {
  const current = normalizeKey(currentUserId)
  if (!current) return false

  const senderId = normalizeKey(message.senderId ?? message.sender_id)
  const senderName = normalizeKey(getIncomingSenderName(message))
  return senderId === current || senderName === current
}

export function shouldReopenIncomingPrivateChat(chats = [], message = {}, currentUserId) {
  if (!message || isIncomingPrivateMessageFromSelf(message, currentUserId)) return false
  return !findPrivateChatForIncomingMessage(chats, message)
}
