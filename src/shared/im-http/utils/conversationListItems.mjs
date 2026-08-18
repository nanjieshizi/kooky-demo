import { ConversationTypes, ROOM_TYPES } from '../eventTypes.js'

function timestampToMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function getEventContent(event) {
  return event?.content && typeof event.content === 'object' ? event.content : {}
}

export function buildGroupConversationFromApi(group = {}) {
  const conversationId = group.conversation_id ?? group.id ?? group.team_id
  return {
    conversationId,
    name: group.name || group.conv_name || '未命名群聊',
    createRoomType: ROOM_TYPES.GROUP_CHAT,
    memberCount: group.member_count ?? group.memberCount ?? 0,
    lastTimelineTs: timestampToMs(group.last_message_at || group.updated_at || group.created_at),
    type: ConversationTypes.Group,
    raw: group,
  }
}

export function buildGroupConversationFromEvent(event = {}) {
  const content = getEventContent(event)
  const conversationId = event.conversationId ?? event.conversation_id
  if (conversationId == null || conversationId === '') return null

  return {
    conversationId,
    name: content.conv_name || event.conv_name || event.name || '未命名群聊',
    createRoomType: ROOM_TYPES.GROUP_CHAT,
    memberCount: content.member_count ?? content.memberCount ?? content.initial_members?.length ?? 0,
    lastTimelineTs: timestampToMs(event.created_at) || Date.now(),
    type: ConversationTypes.Group,
    raw: event,
  }
}

export const buildGroupRoomFromApi = buildGroupConversationFromApi
export const buildGroupRoomFromEvent = buildGroupConversationFromEvent

export function buildPrivateChatFromEvent(event = {}) {
  const content = getEventContent(event)
  const peer = event.peer || content.peer || event.target || {}
  const conversationId = event.conversationId ?? event.conversation_id
  if (conversationId == null || conversationId === '') return null

  const peerUsername = cleanText(peer.username || peer.name)
  const peerDisplayName = cleanText(peer.display_name) || peerUsername

  return {
    conversationId,
    participantId: peer.participant_id ?? peer.id,
    peerUsername,
    peerDisplayName,
    peerAvatarUrl: cleanText(peer.avatar_url || peer.avatar) || null,
    lastMessageAt: event.lastMessageAt || event.last_message_at || event.createdAt || event.created_at || null,
    lastMessagePreview: event.last_message_preview || '',
    lastSeq: event.last_seq ?? 0,
    createdAt: event.createdAt || event.created_at || null,
  }
}

export function buildPrivateChatFromMessage(message = {}) {
  const conversationId = message.conversationId ?? message.conversation_id
  if (conversationId == null || conversationId === '') return null

  const senderName = cleanText(message.senderName ?? message.sender_name)
  const senderDisplayName = cleanText(message.senderDisplayName ?? message.sender_display_name) || senderName
  if (!senderName && !senderDisplayName) return null

  const timestamp = message.timestamp ?? Date.now()
  const lastMessageAt = typeof timestamp === 'number'
    ? new Date(timestamp).toISOString()
    : (message.created_at || null)

  return {
    conversationId,
    participantId: message.senderId ?? message.sender_id ?? null,
    peerUsername: senderName,
    peerDisplayName: senderDisplayName,
    peerAvatarUrl: cleanText(message.senderAvatar ?? message.sender_avatar_url ?? message.avatar) || null,
    lastMessageAt,
    lastMessagePreview: message.content?.body || '',
    lastSeq: message.seq ?? 0,
    createdAt: message.created_at || lastMessageAt,
  }
}
