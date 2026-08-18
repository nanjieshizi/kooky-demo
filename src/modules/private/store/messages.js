/**
 * IM Store 子模块 - 私聊消息接收（WebSocket 事件处理）
 *
 * 处理的 AppEventTypes：
 * - PrivateMessageReceived  收到私聊消息
 * - PrivateMessageRecalled  私聊消息被撤回
 * - PrivateChatCreated      新私聊创建
 */

import { isPrivateMessageSenderSelf } from '../utils/privateMessageFormat.js'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import { useUIStore } from '@/modules/space/uiStore'
import { isCollaborationNavKey } from '@/modules/navigation/config'

const LOG_PREFIX = '[PrivateStore:messages]'

/**
 * 将 httpIMClient._convertMessage 产出的消息对象映射为私聊 Store 内部格式
 * @param {object} msg
 * @param {string|number} currentUserId
 * @returns {object}
 */
function formatLiveMessage(msg, currentUserId) {
  const { senderId, senderName = '' } = msg
  const isMe = isPrivateMessageSenderSelf({ senderId, senderName }, currentUserId)

  return {
    id: msg.id,
    eventId: msg.eventId,
    eventPk: msg.eventPk ?? null,
    conversationId: msg.conversationId,
    role: isMe ? 'user' : 'peer',
    senderId: senderId != null ? String(senderId) : '',
    senderName,
    senderDisplayName: msg.senderDisplayName ?? '',
    senderAvatar: msg.senderAvatar ?? null,
    senderType: msg.senderType ?? 'user',
    content: msg.content && typeof msg.content === 'object'
      ? { ...msg.content }
      : { msgtype: msg.msgtype || 'text', body: msg.content || '' },
    contentType: msg.contentType,
    timestamp: msg.timestamp ?? Date.now(),
    seq: msg.seq,
    status: msg.status || 'normal',
    readedUsernames: Array.isArray(msg.readedUsernames) ? [...msg.readedUsernames] : [],
    isHistory: false,
  }
}

function shouldGateIncomingMessage(chatState, appMessage) {
  return (
    chatState?.isContextWindow &&
    chatState?.hasMoreForward &&
    appMessage?.role !== 'user'
  )
}

function findPeerAvatarForConversation(privateChats, conversationId) {
  const chat = (Array.isArray(privateChats) ? privateChats : []).find(
    (item) => String(item.conversationId) === String(conversationId),
  )
  return chat?.peerAvatarUrl || null
}

export const privateMessagesActions = {
  /**
   * 处理收到的私聊消息（来自 WebSocket）
   * @param {object} message  httpIMClient._convertMessage 输出的消息对象
   */
  _handleMessageReceived(message) {
    const { conversationId } = message ?? {}
    if (!conversationId) return

    const chatState = this._ensureChatMessages(conversationId)
    const { eventId } = message

    // 已存在则跳过
    if (eventId && chatState.messages.some((m) => m.eventId === eventId)) {
      return
    }

    const appMessage = formatLiveMessage(message, this.currentUserId)

    let isActiveChat = false
    if (appMessage.role === 'peer') {
      if (!appMessage.senderAvatar) {
        appMessage.senderAvatar = findPeerAvatarForConversation(this.privateChats, conversationId)
      }
      this.openIncomingPrivateChatIfNeeded(message).catch((err) => {
        console.error(`${LOG_PREFIX} 恢复并进入私聊失败:`, err)
      })
      isActiveChat = isCollaborationNavKey(useUIStore().activePrimaryNav) &&
        useUIStore().activeSecondaryNav === `private-${conversationId}`
      if (!isActiveChat) {
        useUnreadStore().incrementUnread(conversationId)
      }
    }

    // 更新列表预览 & 排序依据
    this._updateChatLastMessage(conversationId, {
      lastMessageAt: new Date(appMessage.timestamp).toISOString(),
      lastMessagePreview: appMessage.content?.body || '',
      lastSeq: appMessage.seq,
    })

    // 若消息来自对方，清理 typing 状态
    if (appMessage.role === 'peer' && chatState.remoteTypingUserIds?.length) {
      const sid = String(appMessage.senderId).toLowerCase()
      chatState.remoteTypingUserIds = chatState.remoteTypingUserIds.filter(
        (id) => String(id).toLowerCase() !== sid,
      )
    }

    if (shouldGateIncomingMessage(chatState, appMessage)) {
      return
    }

    chatState.messages.push(appMessage)
    if (typeof appMessage.seq === 'number') {
      if (chatState.oldestSeq == null || appMessage.seq < chatState.oldestSeq) {
        chatState.oldestSeq = appMessage.seq
      }
      if (chatState.newestSeq == null || appMessage.seq > chatState.newestSeq) {
        chatState.newestSeq = appMessage.seq
      }
    }

    if (appMessage.role === 'peer' && isActiveChat) {
      useUnreadStore().markAsRead(conversationId, appMessage).catch((error) => {
        console.warn(`${LOG_PREFIX} markAsRead 失败:`, error?.message)
      })
    }
  },

  /**
   * 处理消息撤回事件
   * @param {{ conversationId: number|string, eventId: string|null, recallType?: string }} data
   */
  _handleMessageRecalled(data) {
    const { conversationId, eventId } = data || {}
    if (!conversationId || !eventId) return

    const chatState = this.chatMessages[conversationId]
    if (!chatState) return

    const msg = chatState.messages.find((m) => m.eventId === eventId)
    if (!msg) return

    msg.status = 'recalled'
    msg.content = { ...(msg.content && typeof msg.content === 'object' ? msg.content : {}), body: '[消息已撤回]' }
    console.log(`${LOG_PREFIX} 消息已撤回:`, eventId)
  },

  /**
   * 处理新私聊创建事件
   * @param {object} data
   */
  _handleChatCreated(data) {
    if (!data?.conversationId) return

    const exists = this.privateChats.some((c) => c.conversationId === data.conversationId)
    if (exists) return

    const chat = this.upsertPrivateChatFromEvent(data)
    if (chat) return

    this.loadPrivateChats().catch((err) => {
      console.error(`${LOG_PREFIX} 私聊创建事件缺少关键信息，刷新列表失败:`, err)
    })
  },

  // ─── WebSocket 事件钩子（供 imConnection 订阅时调用） ──────────

  /** 收到私聊消息 */
  _onMessageReceived(msg) {
    this._handleMessageReceived(msg)
  },

  /** 私聊消息撤回 */
  _onMessageRecalled(data) {
    this._handleMessageRecalled(data)
  },

  /** 新私聊创建 */
  _onChatCreated(data) {
    this._handleChatCreated(data)
  },
}

export { formatLiveMessage }
