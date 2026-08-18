import { normalizeMessageAttachments } from '../../../shared/utils/messageAttachmentFormat.js'

function normalizeTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return Date.now()
  const parsed = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function getEventJson(event) {
  return event?.event_json && typeof event.event_json === 'object' ? event.event_json : null
}

function getSender(event) {
  const eventJson = getEventJson(event)
  if (event?.sender && typeof event.sender === 'object') return event.sender
  if (eventJson?.sender && typeof eventJson.sender === 'object') return eventJson.sender
  return {}
}

function getContent(event) {
  const topContent = event?.content && typeof event.content === 'object' ? event.content : null
  const eventJson = getEventJson(event)
  const jsonContent = eventJson?.content && typeof eventJson.content === 'object'
    ? eventJson.content
    : null
  return topContent || jsonContent || {}
}

function sameIdentity(a, b) {
  if (a == null || b == null) return false
  const left = String(a).trim().toLowerCase()
  const right = String(b).trim().toLowerCase()
  return !!left && left === right
}

export function isPrivateMessageSenderSelf({ senderId, senderName, sender_id, sender_name } = {}, currentUserId) {
  return sameIdentity(senderName ?? sender_name, currentUserId) || sameIdentity(senderId ?? sender_id, currentUserId)
}

/**
 * 将后端事件转为应用层消息对象（历史消息）
 * @param {object} event
 * @param {string|number} currentUserId 当前登录用户 ID，用于判定 role
 * @returns {object}
 */
export function formatPrivateHistoryMessage(event, currentUserId) {
  const content = getContent(event)
  const sender = getSender(event)
  const eventJson = getEventJson(event)

  const senderId = event.sender_id ?? sender.id
  const senderName = event.sender_name ?? sender.name ?? ''
  const senderDisplayName = event.sender_display_name ?? sender.display_name ?? ''
  const senderAvatar = event.sender_avatar_url ?? sender.avatar_url ?? sender.avatar ?? sender.logo
  const senderType = event.sender_type ?? sender.type ?? 'user'

  const isMe = isPrivateMessageSenderSelf({ senderId, senderName }, currentUserId)

  const eventIdSource = event.event_id ?? eventJson?.event_id ?? event.id
  const timestamp = normalizeTimestamp(event.created_at ?? eventJson?.created_at)

  const attachments = normalizeMessageAttachments(content.attachments)
  const messageContent = {
    msgtype: content.msgtype || content.msg_type || 'text',
    body: content.body || '',
    ...(attachments ? { attachments } : {}),
    ...(content.reply_to ? { reply_to: content.reply_to } : {}),
    ...(Array.isArray(content.mentions) && content.mentions.length ? { mentions: content.mentions } : {}),
  }

  return {
    id: event.id,
    eventId: eventIdSource != null ? String(eventIdSource) : null,
    eventPk: event.event_pk ?? event.id,
    conversationId: event.conversation_id ?? eventJson?.conversation_id,
    role: isMe ? 'user' : 'peer',
    senderId: senderId != null ? String(senderId) : '',
    senderName: senderName || '',
    senderDisplayName: senderDisplayName || '',
    senderAvatar: senderAvatar || null,
    senderType,
    content: messageContent,
    contentType: event.content_type,
    timestamp,
    seq: event.seq ?? eventJson?.seq,
    status: event.status || 'normal',
    isHistory: true,
  }
}
