function cleanText(value) {
  return String(value ?? '').trim()
}

export function formatChat(raw, profile = {}) {
  const peer = raw?.peer || raw?.target || {}
  const peerUsername = peer.username || ''
  const peerDisplayName = cleanText(profile.name) || peer.display_name || peerUsername
  const peerAvatarUrl = cleanText(profile.avatar) || peer.avatar_url || peer.avatar || null
  return {
    conversationId: raw?.conversation_id,
    participantId: peer.participant_id,
    peerUsername,
    peerDisplayName,
    peerAvatarUrl,
    lastMessageAt: raw?.last_message_at || raw?.created_at || null,
    lastMessagePreview: raw?.last_message_preview || '',
    lastSeq: raw?.last_seq ?? 0,
    createdAt: raw?.created_at || null,
  }
}
