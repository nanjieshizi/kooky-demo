export function getVisibleUnreadMentionItems(roomChat, mentionReadAtByRoomId, roomId) {
  if (!roomChat?.hasMentionDot) return []
  // 优先使用 mentionDetails.items（新架构），回退到 unreadMentionItems（旧架构兼容）
  const items = Array.isArray(roomChat?.mentionDetails?.items)
    ? roomChat.mentionDetails.items
    : Array.isArray(roomChat?.unreadMentionItems)
      ? roomChat.unreadMentionItems
      : []
  const readAt = Number(mentionReadAtByRoomId?.[roomId] || 0)
  if (!readAt) return items
  return items.filter((item) => Number(item?.timestamp || 0) > readAt)
}
