// 群聊消息格式化公共工具

import { isSenderIdBotPrefixed, isSelfMessageSender } from './imMessageUtils.js'
import { getPortalUserId } from '../utils/userInfoStorage.js'

export function formatRoomMessage(msg) {
  if (msg.role === 'system') {
    return {
      id: msg.id,
      eventId: msg.eventId,
      eventPk: msg.eventPk ?? msg.id ?? null,
      conversationId: msg.conversationId,
      role: 'system',
      contentType: msg.contentType ?? 'system',
      type: msg.type,
      sender: msg.sender ?? null,
      content: msg.content && typeof msg.content === 'object' ? { ...msg.content } : {},
      timestamp: msg.timestamp,
      seq: msg.seq,
      readedUsernames: Array.isArray(msg.readedUsernames) ? [...msg.readedUsernames] : [],
      isHistory: true,
    }
  }
  const { senderId, senderType } = msg
  const senderName = String(msg.senderName ?? '').trim()
  const senderAvatar = msg.senderAvatar ?? null
  const portalUserId = getPortalUserId()
  const content = msg.content && typeof msg.content === 'object'
    ? { ...msg.content }
    : { msgtype: msg.msgtype || 'text', body: msg.content || '' }
  return {
    id: msg.id,
    eventId: msg.eventId,
    eventPk: msg.eventPk ?? msg.id ?? null,
    conversationId: msg.conversationId,
    role: (() => {
      if (isSelfMessageSender({ senderId, senderName }, { portalUserId })) return 'user'
      const st = typeof senderType === 'string' ? senderType.toLowerCase() : ''
      if (st === 'agent') return 'assistant'
      if (st === 'user' || st === 'human') return 'member'
      if (isSenderIdBotPrefixed(senderId)) return 'assistant'
      return 'member'
    })(),
    senderId,
    senderName,
    senderDisplayName: msg.senderDisplayName ?? '',
    senderAvatar,
    senderType: senderType || null,
    content,
    contentType: msg.contentType,
    timestamp: msg.timestamp,
    seq: msg.seq,
    status: msg.status || 'normal',
    readedUsernames: Array.isArray(msg.readedUsernames) ? [...msg.readedUsernames] : [],
    isHistory: true,
  }
}

export function mergeInviteSystemMessages(messages) {
  return Array.isArray(messages) ? messages : []
}

function normalizeEventIdForDedupe(eventId) {
  if (eventId === undefined || eventId === null || eventId === '') return null
  const raw = String(eventId)
  return raw.startsWith('$') ? raw.slice(1) : raw
}

export function mergeHistoryPageBeforeMessages(olderMessages, currentMessages) {
  const seen = new Set()
  const current = Array.isArray(currentMessages) ? currentMessages : []
  const older = Array.isArray(olderMessages) ? olderMessages : []

  for (const msg of current) {
    const id = normalizeEventIdForDedupe(msg?.eventId)
    if (id) seen.add(id)
  }

  const uniqueOlder = []
  for (const msg of older) {
    const id = normalizeEventIdForDedupe(msg?.eventId)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    uniqueOlder.push(msg)
  }

  return [...uniqueOlder, ...current]
}
