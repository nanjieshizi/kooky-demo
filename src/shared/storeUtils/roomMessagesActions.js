// 房间消息接收逻辑公共函数

import { client } from '@/shared/im-client'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import { useUIStore } from '@/modules/space/uiStore.js'
import { isCollaborationNavKey } from '@/modules/navigation/config'
import { getPortalUserId } from '@/shared/utils/userInfoStorage.js'
import {
  isSelfMessageSender,
  isSenderIdBotPrefixed,
} from '@/shared/storeUtils/imMessageUtils'

function shouldGateIncomingConversationMessage(rc, isMe) {
  return !!(rc?.isContextWindow && rc?.hasMoreForward && !isMe)
}

export function handleConversationMessageReceived(store, message, config) {
  const { bumpTimelineFn } = config

  const { conversationId } = message
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc) return

  const portalUserId = getPortalUserId()
  const sender = message.senderId
  const senderName = String(message.senderName ?? '').trim()
  const senderType = message.senderType
  const isMe = isSelfMessageSender({ senderId: sender, senderName }, { portalUserId })

  const serverEventId = message.eventId
  if (serverEventId && rc.messages.some((m) => m.eventId === serverEventId)) return

  if (message.role === 'system') {
    if (shouldGateIncomingConversationMessage(rc, false)) {
      store[bumpTimelineFn](conversationId, message.timestamp ?? Date.now())
      return
    }

    const systemMsg = {
      id: message.id,
      eventId: serverEventId,
      conversationId,
      role: 'system',
      contentType: message.contentType ?? 'system',
      type: message.type,
      sender: message.sender ?? null,
      content: message.content && typeof message.content === 'object' ? { ...message.content } : {},
      timestamp: message.timestamp,
      seq: message.seq,
    }

    rc.messages.push(systemMsg)
    store[bumpTimelineFn](conversationId, message.timestamp ?? Date.now())
    return
  }

  let role = 'member'
  if (isMe) {
    role = 'user'
  } else if (
    typeof senderType === 'string' &&
    senderType.toLowerCase() === 'agent'
  ) {
    role = 'assistant'
  } else if (isSenderIdBotPrefixed(sender)) {
    role = 'assistant'
  }

  const appMessage = {
    id: message.id,
    eventId: serverEventId,
    eventPk: message.eventPk ?? null,
    conversationId,
    role,
    content: message.content && typeof message.content === 'object'
      ? { ...message.content }
      : { msgtype: message.msgtype || 'text', body: message.content || '' },
    senderId: sender,
    senderName,
    senderDisplayName: message.senderDisplayName ?? '',
    senderAvatar: message.senderAvatar ?? null,
    senderType: senderType || null,
    timestamp: message.timestamp,
    contentType: message.contentType,
    seq: message.seq,
    status: message.status || 'normal',
    readedUsernames: Array.isArray(message.readedUsernames) ? [...message.readedUsernames] : [],
  }

  if (appMessage.timestamp != null) {
    store[bumpTimelineFn](conversationId, appMessage.timestamp)
  }

  const isActiveConversation = isCollaborationNavKey(useUIStore().activePrimaryNav) &&
    String(useUIStore().activeSecondaryNav) === String(conversationId)
  if (!isMe && !isActiveConversation) {
    const { unreadCount, hasMention } = client.getRoomUnreadCounts(conversationId)
    rc.unreadCount = unreadCount
    rc.hasUnreadDot = unreadCount > 0
    rc.hasMentionDot = unreadCount > 0 && hasMention
  }

  if (shouldGateIncomingConversationMessage(rc, isMe)) {
    return
  }

  rc.messages.push(appMessage)
  if (typeof appMessage.seq === 'number') {
    if (rc.oldestSeq == null || appMessage.seq < rc.oldestSeq) rc.oldestSeq = appMessage.seq
    if (rc.newestSeq == null || appMessage.seq > rc.newestSeq) rc.newestSeq = appMessage.seq
  }
  console.log(isMe, isActiveConversation)
  if (!isMe && isActiveConversation) {
    useUnreadStore().markAsRead(conversationId, appMessage).catch((e) => {
      console.warn('[GroupStore] markAsRead 失败:', e?.message)
    })
  }
}

export function appendConversationMessageIfNew(store, conversationId, appMessage, bumpTimelineFn) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc || !appMessage) return
  const { eventId } = appMessage
  if (eventId && rc.messages.some((m) => m.eventId === eventId)) return
  const isMe = appMessage.role === 'user'
  if (typeof appMessage.timestamp === 'number') {
    store[bumpTimelineFn](conversationId, appMessage.timestamp)
  }
  if (shouldGateIncomingConversationMessage(rc, isMe)) return
  rc.messages.push(appMessage)
  if (typeof appMessage.seq === 'number') {
    if (rc.oldestSeq == null || appMessage.seq < rc.oldestSeq) rc.oldestSeq = appMessage.seq
    if (rc.newestSeq == null || appMessage.seq > rc.newestSeq) rc.newestSeq = appMessage.seq
  }
}

export function onConversationMessageReceived(store, msg, config) {
  handleConversationMessageReceived(store, msg, config)
  const conversationId = msg?.conversationId
  const senderId = msg?.senderId
  if (conversationId && senderId && store.conversationMessages?.[conversationId]?.remoteTypingUserIds?.length > 0) {
    const sid = String(senderId).toLowerCase()
    const rc = store.conversationMessages[conversationId]
    rc.remoteTypingUserIds = rc.remoteTypingUserIds.filter(
      (id) => String(id).toLowerCase() !== sid,
    )
  }
}

export function onConversationReadMarkerUpdated(store, { conversationId }) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc) return
  rc.unreadCount = 0
  rc.hasUnreadDot = false
  rc.hasMentionDot = false
}

export function onGroupMessageRecalled(store, data) {
  const { conversationId, eventId } = data || {}
  if (!conversationId || !eventId) return

  const rc = store.conversationMessages[conversationId]
  if (!rc) return

  const msg = rc.messages.find((m) => m.eventId === eventId)
  if (!msg) return

  msg.status = 'recalled'
  msg.content = { ...(msg.content && typeof msg.content === 'object' ? msg.content : {}), body: '[消息已撤回]' }
  console.log('[GroupStore] 消息已撤回:', eventId)
}

export function onConversationUnreadMentionDetailsUpdated(store, { conversationId, details }) {
  if (!conversationId || !details) return
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc) return
  rc.mentionDetails = details ?? null
}
