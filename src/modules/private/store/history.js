/**
 * IM Store 子模块 - 私聊消息历史 & 分页
 *
 * 使用通用事件接口 /api/conversations/{id}/events 拉取 message.created 事件。
 */

import { httpIMClient as client } from '../../../shared/im-http/httpClient.js'
import {
  formatPrivateHistoryMessage,
  isPrivateMessageSenderSelf,
} from '../utils/privateMessageFormat.js'

const LOG_PREFIX = '[PrivateStore:history]'
const PAGE_SIZE = 50

function normalizeEventId(eventId) {
  if (eventId === undefined || eventId === null || eventId === '') return null
  return String(eventId).replace(/^\$/, '')
}

function normalizeMessageLookupKeys(message) {
  return [
    message?.eventId,
    message?.eventPk,
    message?.id,
  ].map(normalizeEventId).filter(Boolean)
}

function sortMessages(messages) {
  return [...(Array.isArray(messages) ? messages : [])].sort((a, b) => {
    if (typeof a.seq === 'number' && typeof b.seq === 'number') return a.seq - b.seq
    return (a.timestamp ?? 0) - (b.timestamp ?? 0)
  })
}

function pickOldestSeq(messages) {
  let oldest = null
  for (const msg of messages || []) {
    if (typeof msg?.seq !== 'number') continue
    if (oldest === null || msg.seq < oldest) oldest = msg.seq
  }
  return oldest
}

function pickNewestSeq(messages) {
  let newest = null
  for (const msg of messages || []) {
    if (typeof msg?.seq !== 'number') continue
    if (newest === null || msg.seq > newest) newest = msg.seq
  }
  return newest
}

function normalizePrivateMessage(msg, currentUserId) {
  const { senderId, senderName = '' } = msg ?? {}
  const isMe = isPrivateMessageSenderSelf({ senderId, senderName }, currentUserId)
  const content = msg?.content && typeof msg.content === 'object'
    ? { ...msg.content }
    : { msgtype: msg?.msgtype || 'text', body: msg?.content || '' }
  return {
    id: msg?.id,
    eventId: normalizeEventId(msg?.eventId),
    eventPk: msg?.eventPk ?? msg?.id ?? null,
    conversationId: msg?.conversationId,
    role: msg?.role === 'user' || msg?.role === 'peer' ? msg.role : (isMe ? 'user' : 'peer'),
    senderId: senderId != null ? String(senderId) : '',
    senderName: senderName || '',
    senderDisplayName: msg?.senderDisplayName ?? '',
    senderAvatar: msg?.senderAvatar ?? null,
    senderType: msg?.senderType ?? 'user',
    content,
    contentType: msg?.contentType,
    timestamp: msg?.timestamp ?? Date.now(),
    seq: msg?.seq,
    status: msg?.status || 'normal',
    readedUsernames: Array.isArray(msg?.readedUsernames) ? [...msg.readedUsernames] : [],
    isHistory: msg?.isHistory ?? true,
  }
}

function mergeMessagePage(existingMessages, incomingMessages) {
  const seen = new Set()
  const merged = []
  for (const msg of [...(existingMessages || []), ...(incomingMessages || [])]) {
    const eventId = normalizeEventId(msg?.eventId)
    if (eventId && seen.has(eventId)) continue
    if (eventId) seen.add(eventId)
    merged.push(eventId ? { ...msg, eventId } : msg)
  }
  return sortMessages(merged)
}

function setWindowBounds(chatState) {
  chatState.oldestSeq = pickOldestSeq(chatState.messages)
  chatState.newestSeq = pickNewestSeq(chatState.messages)
}

export const privateHistoryActions = {
  /**
   * 刷新最近消息，用于发送成功后从服务端读取真实消息。
   * @param {number} conversationId
   */
  async refreshLatestHistory(conversationId) {
    if (!conversationId) return
    const chatState = this._ensureChatMessages(conversationId)
    try {
      const events = await client.getConversationEvents(conversationId, {
        event_type: 'message.created',
        limit: PAGE_SIZE,
      })
      const ordered = Array.isArray(events) ? [...events].reverse() : []
      const messages = ordered.map((e) => formatPrivateHistoryMessage(e, this.currentUserId))
      this._mergeHistoryMessages(conversationId, messages)
      chatState.initialHistoryFetched = true
    } catch (error) {
      console.error(`${LOG_PREFIX} 刷新最近消息失败:`, error)
      throw error
    }
  },

  /**
   * 首次加载历史消息
   * @param {number} conversationId
   */
  async loadHistory(conversationId) {
    if (!conversationId) return
    const chatState = this._ensureChatMessages(conversationId)
    if (chatState.initialHistoryFetched) return
    if (chatState._historyLoadPromise) return chatState._historyLoadPromise

    chatState._historyLoadPromise = (async () => {
      chatState.loadingHistory = true
      try {
        const events = await client.getConversationEvents(conversationId, {
          event_type: 'message.created',
          limit: PAGE_SIZE,
        })
        // 后端返回 DESC（最新在前），转为 ASC 方便追加
        const ordered = Array.isArray(events) ? [...events].reverse() : []
        const messages = ordered.map((e) => formatPrivateHistoryMessage(e, this.currentUserId))
        this._mergeHistoryMessages(conversationId, messages)
        chatState.isContextWindow = false
        chatState.anchorMessageId = null
        chatState.hasMoreForward = false
        setWindowBounds(chatState)
        chatState.initialHistoryFetched = true
        console.log(`${LOG_PREFIX} 首次加载成功:`, conversationId, messages.length)
      } catch (error) {
        console.error(`${LOG_PREFIX} 首次加载失败:`, error)
        throw error
      } finally {
        chatState.loadingHistory = false
        chatState._historyLoadPromise = null
      }
    })()

    return chatState._historyLoadPromise
  },

  /**
   * 向上滚动加载更早的历史消息
   * @param {number} conversationId
   */
  async loadMoreHistory(conversationId) {
    if (!conversationId) return
    const chatState = this.chatMessages[conversationId]
    if (!chatState || chatState.loadingMoreHistory) return
    if (chatState.hasMoreHistory === false) return

    const msgs = chatState.messages || []
    if (!msgs.length) return

    const oldestSeq = msgs.reduce((min, m) => {
      const s = typeof m.seq === 'number' ? m.seq : Number.MAX_SAFE_INTEGER
      return s < min ? s : min
    }, Number.MAX_SAFE_INTEGER)

    if (!Number.isFinite(oldestSeq) || oldestSeq === Number.MAX_SAFE_INTEGER) {
      console.warn(`${LOG_PREFIX} 无法确定起始 seq，放弃加载更多`)
      return
    }

    chatState.loadingMoreHistory = true
    try {
      const events = await client.getConversationEvents(conversationId, {
        event_type: 'message.created',
        before_seq: oldestSeq,
        limit: PAGE_SIZE,
      })
      if (!Array.isArray(events) || !events.length) {
        chatState.hasMoreHistory = false
        console.log(`${LOG_PREFIX} 无更早历史:`, conversationId)
        return
      }
      const ordered = [...events].reverse()
      const messages = ordered.map((e) => formatPrivateHistoryMessage(e, this.currentUserId))
      this._mergeHistoryMessages(conversationId, messages)
      setWindowBounds(chatState)
      console.log(`${LOG_PREFIX} 加载更多成功:`, conversationId, messages.length)
    } catch (error) {
      console.error(`${LOG_PREFIX} 加载更多失败:`, error)
      throw error
    } finally {
      chatState.loadingMoreHistory = false
    }
  },

  /**
   * 合并历史消息到消息列表，按 eventId 去重
   * @param {number} conversationId
   * @param {Array<object>} newMessages ASC 顺序（旧→新）
   */
  _mergeHistoryMessages(conversationId, newMessages) {
    const chatState = this.chatMessages[conversationId]
    if (!chatState) return
    if (!Array.isArray(newMessages) || !newMessages.length) return

    const existing = new Set(chatState.messages.map((m) => normalizeEventId(m.eventId)).filter(Boolean))
    const unique = newMessages.filter((m) => {
      const eventId = normalizeEventId(m.eventId)
      return eventId && !existing.has(eventId)
    })
    if (!unique.length) return

    // 历史消息按 seq 升序插入到最前面
    chatState.messages.unshift(...unique)
    // 保证整体按 timestamp / seq 升序
    chatState.messages.sort((a, b) => {
      if (typeof a.seq === 'number' && typeof b.seq === 'number') return a.seq - b.seq
      return (a.timestamp ?? 0) - (b.timestamp ?? 0)
    })
    setWindowBounds(chatState)
  },

  findMessageInCurrentWindow(conversationId, messageId) {
    const chatState = this.chatMessages[conversationId]
    const target = normalizeEventId(messageId)
    if (!chatState || !target) return null
    const list = chatState.messages || []
    for (let i = list.length - 1; i >= 0; i--) {
      if (normalizeMessageLookupKeys(list[i]).includes(target)) {
        return { index: i, message: list[i] }
      }
    }
    return null
  },

  replaceWithContext(conversationId, ctxMessages, meta = {}) {
    const chatState = this._ensureChatMessages(conversationId)
    if (!chatState) return
    const messages = sortMessages(
      (Array.isArray(ctxMessages) ? ctxMessages : [])
        .map((msg) => normalizePrivateMessage(msg, this.currentUserId)),
    )
    chatState.messages = messages
    chatState.initialHistoryFetched = true
    chatState.isContextWindow = true
    chatState.anchorMessageId = normalizeEventId(meta.targetMessageId)
    chatState.hasMoreForward = !meta.afterReachedEnd
    chatState.hasMoreHistory = !meta.beforeReachedStart
    chatState.droppedBefore = false
    chatState.droppedAfter = false
    setWindowBounds(chatState)
  },

  hasMoreForward(conversationId) {
    return !!this.chatMessages[conversationId]?.hasMoreForward
  },

  async paginateForward(conversationId) {
    const chatState = this._ensureChatMessages(conversationId)
    if (!chatState || chatState.loadingMoreForward || !chatState.hasMoreForward) {
      return { added: 0, hasMore: !!chatState?.hasMoreForward }
    }
    const newestSeq = chatState.newestSeq ?? pickNewestSeq(chatState.messages)
    if (!Number.isFinite(newestSeq)) return { added: 0, hasMore: false }

    chatState.loadingMoreForward = true
    try {
      const events = await client.getConversationEvents(conversationId, {
        event_type: 'message.created',
        after_seq: newestSeq,
        limit: PAGE_SIZE,
      })
      const formatted = Array.isArray(events)
        ? events.map((e) => formatPrivateHistoryMessage(e, this.currentUserId))
        : []
      const before = chatState.messages.length
      chatState.messages = mergeMessagePage(chatState.messages, formatted)
      setWindowBounds(chatState)
      chatState.hasMoreForward = formatted.length >= PAGE_SIZE
      return { added: chatState.messages.length - before, hasMore: chatState.hasMoreForward }
    } finally {
      chatState.loadingMoreForward = false
    }
  },

  async reloadLatest(conversationId) {
    if (!conversationId) return
    const chatState = this._ensureChatMessages(conversationId)
    if (!chatState || chatState.loadingHistory) return

    chatState.loadingHistory = true
    try {
      const events = await client.getConversationEvents(conversationId, {
        event_type: 'message.created',
        limit: PAGE_SIZE,
      })
      const ordered = Array.isArray(events) ? [...events].reverse() : []
      const messages = ordered.map((e) => formatPrivateHistoryMessage(e, this.currentUserId))
      chatState.messages = sortMessages(messages)
      chatState.initialHistoryFetched = true
      chatState.isContextWindow = false
      chatState.anchorMessageId = null
      chatState.hasMoreForward = false
      chatState.droppedBefore = false
      chatState.droppedAfter = false
      setWindowBounds(chatState)
    } finally {
      chatState.loadingHistory = false
    }
  },
}

export { formatPrivateHistoryMessage }
