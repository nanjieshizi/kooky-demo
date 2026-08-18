/**
 * HTTP IM 客户端封装
 * 只负责 HTTP/WS 数据交互与应用事件派发。
 */

import { AppEventTypes, HttpEventTypes, ConversationTypes } from './eventTypes.js'
import { WebSocketManager } from './client/websocket.js'
import { httpClient } from './services/httpClient.js'
import {
  uploadGroupFile,
  getGroupDetail as getGroupDetailApi,
  getConversationEvents as getConversationEventsApi,
  isFirstMessage as isFirstMessageApi,
  isLastMessage as isLastMessageApi,
  getMessageContext as getMessageContextApi,
  forwardSingleMessage as forwardSingleMessageApi,
  forwardBatchMessages as forwardBatchMessagesApi,
  getGroupTasks as getGroupTasksApi,
  bindGroupAgent as bindGroupAgentApi,
  unbindGroupAgent as unbindGroupAgentApi,
} from './services/group.js'
import {
  startPrivateChat as startPrivateChatApi,
  getPrivateChats as getPrivateChatsApi,
  closePrivateChat as closePrivateChatApi,
  reopenPrivateChat as reopenPrivateChatApi,
  getPrivateChatDetail as getPrivateChatDetailApi,
  sendPrivateMessage as sendPrivateMessageApi,
  recallPrivateMessage as recallPrivateMessageApi,
} from './services/private.js'
import * as sendingModule from './client/sending.js'
import * as historyModule from './client/history.js'
import * as roomsModule from './client/rooms.js'
import * as membersModule from './client/members.js'
import * as unreadModule from './client/unread.js'
import * as syncModule from './client/sync.js'
import { normalizeMessageAttachments } from '../utils/messageAttachmentFormat.js'

function normalizeHttpEventType(type) {
  return String(type || '').trim().toLowerCase().replace(/_/g, '.')
}

class HttpIMClient {
  constructor() {
    // 连接状态
    this._initialized = false
    this._userId = null
    this._token = null
    this._baseUrl = null
    this._wsUrl = null

    // WebSocket 管理器
    this._wsManager = null

    // 事件监听器
    this._eventListeners = new Map()

    // 状态标记
    this._syncState = null

    // 未读快照（由 unread client 与 unreadStore 共享）
    this._unreadSnapshot = { totalUnread: 0, conversationUnreads: {} }
  }

  // ═══════════════════════════════════════════════════════
  // § 1  初始化 & 生命周期
  // ═══════════════════════════════════════════════════════

  /**
   * 初始化客户端
   * @param {Object} options
   * @param {string} options.baseUrl - API 基础地址
   * @param {string} options.wsUrl - WebSocket 地址
   * @param {string} options.token - JWT Token
   * @param {string} options.userId - 用户 ID
   * @param {boolean} options.enableWebSocket - 是否启用 WebSocket（默认 false，暂时禁用）
   */
  async init(options = {}) {
    const { baseUrl, wsUrl, token, userId, enableWebSocket = false } = options

    if (!baseUrl || !token || !userId) {
      throw new Error('[HttpIMClient] 初始化失败：缺少必要参数')
    }

    console.log('[HttpIMClient] 开始初始化...', { enableWebSocket })

    this._baseUrl = baseUrl
    this._wsUrl = wsUrl
    this._token = token
    this._userId = userId

    // 配置 HTTP 客户端
    httpClient.setConfig(baseUrl, token)

    // 如果启用 WebSocket，则创建连接
    if (enableWebSocket && wsUrl) {
      // 创建 WebSocket 管理器
      this._wsManager = new WebSocketManager(this)

      try {
        // 建立 WebSocket 连接
        await this._wsManager.connect(wsUrl, token)
      } catch (error) {
        console.warn('[HttpIMClient] WebSocket 连接失败，继续使用 HTTP 轮询:', error)
        // WebSocket 失败不影响整体初始化
      }
    } else {
      console.log('[HttpIMClient] WebSocket 已禁用，仅使用 HTTP API')
    }

    this._initialized = true
    this._syncState = 'PREPARED'

    try {
      const unread = await this.fetchUnreadCounts()
      this._emit(AppEventTypes.UnreadInitialized, unread)
    } catch (error) {
      console.warn('[HttpIMClient] 初始化未读数据失败，继续启动:', error)
      this._emit(AppEventTypes.UnreadInitialized, this._unreadSnapshot)
    }

    // 触发连接成功事件
    this._emit(AppEventTypes.Connected, { userId })
    this._emit(AppEventTypes.SyncPrepared, { state: 'PREPARED' })

    console.log('[HttpIMClient] 初始化成功')
  }

  /**
   * 断开连接
   */
  async disconnect(options = {}) {
    console.log('[HttpIMClient] 断开连接...')

    if (this._wsManager) {
      this._wsManager.disconnect()
      this._wsManager = null
    }

    this._initialized = false
    this._syncState = 'STOPPED'

    this._emit(AppEventTypes.Disconnected, {})
    this._emit(AppEventTypes.SyncStopped, { state: 'STOPPED' })
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this._initialized
  }

  /**
   * 检查实时 WebSocket 是否已连接
   */
  isRealtimeConnected() {
    return !!this._wsManager?.isConnected()
  }

  /**
   * 获取同步状态
   */
  getSyncState() {
    return this._syncState
  }

  /**
   * 检查是否已初始化
   * @private
   */
  _checkInitialized() {
    if (!this._initialized) {
      throw new Error('[HttpIMClient] 客户端未初始化')
    }
  }

  // ═══════════════════════════════════════════════════════
  // § 2  事件系统
  // ═══════════════════════════════════════════════════════

  /**
   * 注册事件监听器
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   * @returns {Function} unsubscribe 函数
   */
  on(event, callback) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, [])
    }
    this._eventListeners.get(event).push(callback)
    return () => this.off(event, callback)
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    const listeners = this._eventListeners.get(event)
    if (!listeners) return
    const idx = listeners.indexOf(callback)
    if (idx > -1) listeners.splice(idx, 1)
  }

  /**
   * 触发事件
   * @private
   */
  _emit(event, data) {
    const listeners = this._eventListeners.get(event)
    if (!listeners) return
    listeners.forEach(cb => {
      try {
        cb(data)
      } catch (e) {
        console.error(`[HttpIMClient] 事件处理器错误 (${event}):`, e)
      }
    })
  }

  // ═══════════════════════════════════════════════════════
  // § 3  WebSocket 事件处理
  // ═══════════════════════════════════════════════════════

  /**
   * 处理 WebSocket 事件
   * 根据 conv_type 分发到群聊或私聊专属处理器
   * @private
   */
  _handleWebSocketEvent(data) {
    const rawType = data.event_type ?? data.type
    const type = normalizeHttpEventType(rawType)
    const convType = data.conv_type

    // 根据会话类型分发到专属处理器（私聊与群聊完全独立）
    if (convType === ConversationTypes.Private) {
      this._handlePrivateEvent(type, data)
    } else if (convType === ConversationTypes.Group) {
      this._handleGroupEvent(type, data)
    } else {
      // 兜底：conv_type 缺失时的处理（向后兼容）
      this._handleLegacyEvent(type, data, rawType)
    }
  }

  /**
   * 处理群聊事件（与私聊完全独立）
   * @private
   */
  _handleGroupEvent(type, data) {
    switch (type) {
      case normalizeHttpEventType(HttpEventTypes.MessageCreated):
        this._handleGroupMessageCreated(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MessageRecall):
        this._handleGroupMessageRecall(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MessageRead):
        this._handleMessageRead(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MemberJoined):
        this._handleGroupSystemEvent(data)
        this._handleMemberJoined(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MemberKicked):
        this._handleGroupSystemEvent(data)
        this._handleMemberKicked(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MemberLeft):
        this._handleGroupSystemEvent(data)
        this._handleMemberLeft(data)
        break
      case normalizeHttpEventType(HttpEventTypes.GroupCreated):
        this._handleGroupSystemEvent(data)
        this._handleGroupCreated(data)
        break
      case normalizeHttpEventType(HttpEventTypes.GroupRenamed):
        this._handleGroupRenamed(data)
        break
      case normalizeHttpEventType(HttpEventTypes.GroupDissolved):
        this._handleGroupDissolved(data)
        break
      default:
        console.warn('[HttpIMClient] 未处理的群聊事件:', type)
    }
  }

  /**
   * 处理私聊事件（与群聊完全独立）
   * @private
   */
  _handlePrivateEvent(type, data) {
    switch (type) {
      case normalizeHttpEventType(HttpEventTypes.MessageCreated):
        this._handlePrivateMessageCreated(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MessageRecall):
        this._handlePrivateMessageRecall(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MessageRead):
        this._handleMessageRead(data)
        break
      case normalizeHttpEventType(HttpEventTypes.PrivateCreated):
        this._handlePrivateChatCreated(data)
        break
      default:
        console.warn('[HttpIMClient] 未处理的私聊事件:', type)
    }
  }

  /**
   * 兜底处理器（向后兼容，仅在 conv_type 缺失时使用）
   * @private
   */
  _handleLegacyEvent(type, data, rawType) {
    console.warn('[HttpIMClient] 事件缺少 conv_type，使用兜底处理:', rawType)

    switch (type) {
      case normalizeHttpEventType(HttpEventTypes.MessageCreated):
        this._handleGroupMessageCreated(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MessageRead):
        this._handleMessageRead(data)
        break
      case normalizeHttpEventType(HttpEventTypes.MemberJoined):
      case normalizeHttpEventType(HttpEventTypes.MemberKicked):
      case normalizeHttpEventType(HttpEventTypes.MemberLeft):
      case normalizeHttpEventType(HttpEventTypes.GroupCreated):
      case normalizeHttpEventType(HttpEventTypes.GroupRenamed):
      case normalizeHttpEventType(HttpEventTypes.GroupDissolved):
        this._handleGroupEvent(type, data)
        break
      default:
        console.warn('[HttpIMClient] 未处理的事件类型:', rawType)
    }
  }

  /**
   * 处理群聊消息创建事件
   * @private
   */
  _handleGroupMessageCreated(data) {
    const { conversation_id } = data
    const appMessage = this._convertMessage(data, conversation_id)
    this._emit(AppEventTypes.GroupMessageReceived, appMessage)
    this._applyUnreadFromMessageCreated(data)
  }

  _applyUnreadFromMessageCreated(data) {
    if (!data?.unread || typeof data.unread !== 'object') return
    const conversationId = data?.conversation_id ?? data?.conversationId ?? data?.conv_id
    if (conversationId == null) return
    const snapshot = unreadModule.applyReadUnreadUpdate(this, data)
    this._emit(AppEventTypes.UnreadUpdated, {
      conversationId,
      snapshot,
    })
  }

  /**
   * 处理群聊消息撤回事件
   * @private
   */
  _handleGroupMessageRecall(data) {
    const { conversation_id, content = {} } = data
    const recalledEventId = content.recalled_event_id

    this._emit(AppEventTypes.GroupMessageRecalled, {
      conversationId: conversation_id,
      eventId: recalledEventId != null ? String(recalledEventId) : null,
      recalledSeq: content.recalled_seq,
      recallType: content.recall_type || 'user_recall',
    })
  }

  /**
   * 处理私聊消息创建事件
   * @private
   */
  _handlePrivateMessageCreated(data) {
    const { conversation_id } = data
    const appMessage = this._convertMessage(data, conversation_id)
    this._emit(AppEventTypes.PrivateMessageReceived, appMessage)
  }

  /**
   * 处理私聊消息撤回事件
   * @private
   */
  _handlePrivateMessageRecall(data) {
    const { conversation_id, content = {} } = data
    const recalledEventId = content.recalled_event_id

    this._emit(AppEventTypes.PrivateMessageRecalled, {
      conversationId: conversation_id,
      eventId: recalledEventId != null ? String(recalledEventId) : null,
      recalledSeq: content.recalled_seq,
      recallType: content.recall_type || 'user_recall',
    })
  }

  /**
   * 处理私聊创建事件
   * @private
   */
  _handlePrivateChatCreated(data) {
    const { conversation_id, conv_name, content = {} } = data

    this._emit(AppEventTypes.PrivateChatCreated, {
      conversationId: conversation_id,
      name: conv_name || data.name,
      peer: content.peer || data.peer,
      creator: content.creator || data.creator,
      createdAt: data.created_at,
    })
  }

  /**
   * 处理已读事件
   * @private
   */
  _handleMessageRead(data) {
    const snapshot = unreadModule.applyReadUnreadUpdate(this, data)
    const conversationId = data?.conversation_id ?? data?.conversationId ?? data?.conv_id
    this._emit(AppEventTypes.UnreadUpdated, {
      ...data,
      conversationId,
      snapshot,
    })
    this._emit(AppEventTypes.ReadMarkerUpdated, {
      conversationId,
      eventPk: data?.content?.event_pk ?? data?.event_pk,
      seq: data?.content?.seq ?? data?.seq,
      participantId: data?.content?.participant_id,
    })
  }

  // ═══════════════════════════════════════════════════════
  // § 4  数据转换
  // ═══════════════════════════════════════════════════════

  /**
   * 处理群聊系统事件（group.created / member.joined / member.left / member.kicked）
   * 转换为系统消息后 emit GroupMessageReceived，让 store 复用 role==='system' 处理路径
   * @private
   */
  _handleGroupSystemEvent(data) {
    const { conversation_id } = data
    const appMessages = this._convertSystemEvent(data, conversation_id)
    if (!Array.isArray(appMessages) || appMessages.length === 0) return
    for (const msg of appMessages) {
      this._emit(AppEventTypes.GroupMessageReceived, msg)
    }
  }

  /**
   * 处理成员加入事件
   * @private
   */
  _handleMemberJoined(data) {
    const { conversation_id, content = {} } = data

    const joinedMemberId = content.member?.id
    if (joinedMemberId && this._userId && String(joinedMemberId) === String(this._userId)) {
      this._emit(AppEventTypes.RoomsUpdated, {
        conversationId: conversation_id,
        action: 'upsert',
        event: data,
      })
    }

    this._emitGroupMembersChanged(data, 'join')
    this._emit(AppEventTypes.RoomMembersUpdated, {
      conversationId: conversation_id
    })
  }

  /**
   * 处理成员被踢出事件
   * @private
   */
  _handleMemberKicked(data) {
    const { conversation_id, content = {} } = data

    // 检查被踢出的成员是否是当前用户
    const kickedMemberId = content.member?.id
    const currentUserId = this._userId

    if (kickedMemberId && currentUserId && String(kickedMemberId) === String(currentUserId)) {
      // 当前用户被踢出，触发会话离开事件和会话列表更新
      this._emit(AppEventTypes.RoomLeft, {
        conversationId: conversation_id,
        conversationName: data.conv_name,
        cardType: 'kicked',
      })
    } else {
      // 其他成员被踢出，只触发成员更新事件
      this._emitGroupMembersChanged(data, 'kick')
      this._emit(AppEventTypes.RoomMembersUpdated, {
        conversationId: conversation_id
      })
    }
  }

  /**
   * 处理成员离开事件
   * @private
   */
  _handleMemberLeft(data) {
    const { conversation_id } = data

    // 触发成员更新事件
    this._emitGroupMembersChanged(data, 'leave')
    this._emit(AppEventTypes.RoomMembersUpdated, {
      conversationId: conversation_id
    })
  }

  _emitGroupMembersChanged(data, changeType) {
    const conversationId = data?.conversation_id ?? data?.conversationId
    if (!conversationId) return
    const content = data.content && typeof data.content === 'object' ? data.content : {}
    const rawMemberCount = content.member_count ?? content.memberCount ?? data.member_count ?? data.memberCount
    const memberCount = Number(rawMemberCount)
    const memberDelta = changeType === 'join' ? 1 : -1
    this._emit(AppEventTypes.RoomsUpdated, {
      conversationId,
      action: 'members_changed',
      changeType,
      memberDelta,
      memberCount: Number.isFinite(memberCount) ? Math.max(0, memberCount) : null,
      event: data,
    })
  }

  /**
   * 处理群聊创建事件
   * @private
   */
  _handleGroupCreated(data) {
    const { conversation_id, conv_name, content = {} } = data
    const groupName = content.conv_name || conv_name || data.name

    // 触发会话创建事件
    this._emit(AppEventTypes.RoomCreated, {
      conversationId: conversation_id,
      name: groupName,
      event: data,
    })
  }

  /**
   * 处理群聊改名事件
   * @private
   */
  _handleGroupRenamed(data) {
    const { conversation_id, conv_name, content = {} } = data
    const groupName = content.new_name || content.conv_name || conv_name || data.name

    // 触发会话列表更新
    this._emit(AppEventTypes.RoomsUpdated, {
      conversationId: conversation_id,
      name: groupName,
      action: 'rename',
      event: data,
    })
  }

  /**
   * 处理群聊解散事件
   * @private
   */
  _handleGroupDissolved(data) {
    const { conversation_id } = data

    // 触发会话离开事件
    this._emit(AppEventTypes.RoomLeft, {
      conversationId: conversation_id,
      conversationName: data.conv_name,
      cardType: 'dissolved',
    })
  }

  // ═══════════════════════════════════════════════════════
  // § 4  数据转换
  // ═══════════════════════════════════════════════════════

  /**
   * 转换消息格式（新 API → 应用层）
   * 兼容两种入参：
   *  - 列表 / 直发消息格式：content 是字符串，message_type / sender_* 等平铺
   *  - 事件接口格式（/events、/context）：content 是对象 {msgtype, body, attachments, mentions, reply_to}
   * @private
   */

  /**
   * 转换系统事件 → 应用层系统消息数组
   * 系统事件保持 1 条上游事件对应 1 条应用层消息；initial_members 保留在 content 中由渲染层消费。
   * 兼容两种入参格式：
   *  - WS 推送格式：sender 为对象，content 含嵌套 member/inviter/kicker/initial_members
   *  - 历史 /events 格式：sender_id/sender_name 平铺，content 含 member_id/inviter_id 等扁平字段，event_json 含完整嵌套
   * 未识别 event_type 返回 []
   * @private
   * @returns {Array<object>}
   */
  _convertSystemEvent(event, conversationId) {
    const type = event?.event_type ?? event?.type
    if (![
      'group.created',
      'member.joined',
      'member.left',
      'member.kicked',
    ].includes(type)) return []

    const eventId = event?.event_id ?? event?.id
    const ts = this._timestampToMs(event?.created_at)
    const seq = event?.seq ?? event?.event_json?.seq
    const eventJson = event?.event_json
    const sender = eventJson?.sender ?? (event?.sender && typeof event.sender === 'object' ? event.sender : null)
    const content = eventJson?.content ?? (event?.content && typeof event.content === 'object' ? event.content : {})

    const baseEventId = eventId != null ? String(eventId) : null
    return [{
      eventId: baseEventId,
      conversationId,
      role: 'system',
      contentType: event?.content_type ?? 'system',
      type,
      sender,
      content,
      timestamp: ts,
      seq,
    }]
  }

  /**
   * 通用会话事件转换门面：根据 event_type 路由到 _convertMessage 或 _convertSystemEvent
   * 始终返回 Array<appMessage>（消息：1 条；系统事件：0~N 条）。调用方需展开/过滤
   * @private
   * @returns {Array<object>}
   */
  _convertConversationEvent(event, conversationId) {
    const type = event?.event_type ?? event?.type
    if (!type) return []
    if (type === 'message.created') {
      const msg = this._convertMessage(event, conversationId)
      return msg ? [msg] : []
    }
    return this._convertSystemEvent(event, conversationId)
  }

  _convertMessage(message, conversationId) {
    const isEventShape = message.content && typeof message.content === 'object'

    const contentObj = isEventShape ? message.content : null
    const bodyText = isEventShape ? (contentObj?.body ?? '') : (message.content ?? '')
    const msgtype = isEventShape
      ? (contentObj?.msgtype || contentObj?.msg_type || 'text')
      : (message.message_type || 'text')

    const eventIdSource = message.event_id ?? message.id
    const eventJson = message.event_json && typeof message.event_json === 'object'
      ? message.event_json
      : null
    const senderObj = message.sender && typeof message.sender === 'object'
      ? message.sender
      : (eventJson?.sender && typeof eventJson.sender === 'object' ? eventJson.sender : null)
    const senderId = message.sender_id ?? senderObj?.id
    const senderName = message.sender_name ?? senderObj?.name ?? ''
    const senderDisplayName = message.sender_display_name ?? senderObj?.display_name ?? ''
    const senderAvatar = message.sender_avatar_url
      ?? message.senderAvatar
      ?? message.avatar_url
      ?? message.avatar
      ?? senderObj?.avatar_url
      ?? senderObj?.avatarUrl
      ?? senderObj?.avatar
      ?? senderObj?.logo
      ?? null
    const senderType = message.sender_type ?? senderObj?.type ?? null
    const normalizedSenderId = senderId != null ? String(senderId) : ''

    const rawMentions = isEventShape
      ? (contentObj?.mentions ?? message.mentions)
      : message.mentions
    const rawReplyTo = isEventShape
      ? (contentObj?.reply_to ?? message.reply_to)
      : message.reply_to

    const rawAttachments = isEventShape
      ? (contentObj?.attachments ?? message.attachments)
      : message.attachments
    const attachments = normalizeMessageAttachments(rawAttachments)
    const content = isEventShape
      ? { ...contentObj }
      : {
          msgtype,
          body: bodyText,
        }
    if (!content.msgtype) content.msgtype = msgtype
    if (content.body == null) content.body = bodyText
    if (attachments) content.attachments = attachments
    if (Array.isArray(rawMentions) && rawMentions.length > 0 && !Array.isArray(content.mentions)) {
      content.mentions = rawMentions
    }
    if (rawReplyTo && !content.reply_to) {
      content.reply_to = rawReplyTo
    }

    return {
      id: message.id,
      eventId: eventIdSource != null ? String(eventIdSource) : null,
      eventPk: message.event_pk ?? message.eventPk ?? message.pk ?? (typeof message.id === 'number' ? message.id : null),
      conversationId,
      senderId: normalizedSenderId,
      senderName,
      senderDisplayName,
      senderAvatar: senderAvatar || null,
      senderType,
      createdAt: message.created_at,
      timestamp: this._timestampToMs(message.created_at),
      content,
      contentType: message.content_type,
      status: message.status || 'normal',
      seq: message.seq,
      readedUsernames: Array.isArray(message.readed_username)
        ? [...message.readed_username]
        : (Array.isArray(message.readedUsernames)
            ? [...message.readedUsernames]
            : (Array.isArray(message.readed_participant_ids) ? [...message.readed_participant_ids] : [])),
    }
  }

  _getMessageCacheId(message) {
    if (!message) return null
    return message.eventId
  }

  _timestampToMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (!value) return Date.now()
    const parsed = Date.parse(String(value).replace(' ', 'T'))
    return Number.isFinite(parsed) ? parsed : Date.now()
  }

  // ═══════════════════════════════════════════════════════
  // § 5  消息发送（委托给 sending 模块）
  // ═══════════════════════════════════════════════════════

  async sendTextMessage(conversationId, content, options = {}) {
    return sendingModule.sendTextMessage(this, conversationId, content, options)
  }

  async sendMessage(conversationId, content, options) {
    return sendingModule.sendMessage(this, conversationId, content, options)
  }

  previewOutgoingTextBody(conversationId, content, options = {}) {
    return sendingModule.previewOutgoingTextBody(this, conversationId, content, options)
  }

  async markRoomRead(conversationId) {
    return sendingModule.markRoomRead(this, conversationId)
  }

  // ═══════════════════════════════════════════════════════
  // § 6  历史消息（委托给 history 模块）
  // ═══════════════════════════════════════════════════════

  async getRoomMessages(conversationId, limit = 20) {
    return historyModule.getRoomMessages(this, conversationId, limit)
  }

  async paginateTimelineBackwards(conversationId, limit = 20, options = {}) {
    return historyModule.paginateTimelineBackwards(this, conversationId, limit, options)
  }

  canPaginateBackwards(conversationId) {
    return historyModule.canPaginateBackwards(this, conversationId)
  }

  getAllTimelineMessages(conversationId) {
    return historyModule.getAllTimelineMessages(this, conversationId)
  }

  // ═══════════════════════════════════════════════════════
  // § 7  房间管理（委托给 rooms 模块）
  // ═══════════════════════════════════════════════════════

  getRooms() {
    return roomsModule.getRooms(this)
  }

  async fetchGroupRooms() {
    return roomsModule.fetchGroupRooms(this)
  }

  hasJoinedRoom(conversationId) {
    return roomsModule.hasJoinedRoom(this, conversationId)
  }

  async joinRoom(conversationId) {
    return roomsModule.joinRoom(this, conversationId)
  }

  async leaveRoom(conversationId) {
    return roomsModule.leaveRoom(this, conversationId)
  }

  async createGroupRoom(name, accounts = [], botIds = [], options = {}) {
    this._checkInitialized()

    return roomsModule.createGroupRoom(name, accounts, botIds, options)
  }

  async changeRoomMembers(name, conversationId, leftAccounts, leftBotIds = []) {
    return roomsModule.changeRoomMembers(this, name, conversationId, leftAccounts, leftBotIds)
  }

  /**
   * 邀请成员加入群聊（增量）
   * @param {string|number} conversationId
   * @param {{ usernames?: string[], agentParticipantIds?: number[] }} payload
   */
  async inviteMembers(conversationId, payload = {}) {
    return roomsModule.inviteMembers(this, conversationId, payload)
  }

  /**
   * 移除群聊成员（增量）
   * @param {string|number} conversationId
   * @param {{ usernames?: string[], agentParticipantIds?: number[] }} payload
   */
  async removeMembers(conversationId, payload = {}) {
    return roomsModule.removeMembers(this, conversationId, payload)
  }

  /**
   * 更新群聊名称
   * @param {string|number} conversationId
   * @param {string} name
   */
  async renameGroup(conversationId, name) {
    return roomsModule.renameGroup(this, conversationId, name)
  }

  async dissolveGroup(conversationId) {
    return roomsModule.dissolveGroup(this, conversationId)
  }

  async clearRooms(options = {}) {
    return roomsModule.clearRooms(this, options)
  }

  // ═══════════════════════════════════════════════════════
  // § 8  成员管理（委托给 members 模块）
  // ═══════════════════════════════════════════════════════

  async getRoomMembers(conversationId) {
    return membersModule.getRoomMembers(this, conversationId)
  }

  getRoomMemberProfiles(conversationId) {
    return membersModule.getRoomMemberProfiles(this, conversationId)
  }

  // ═══════════════════════════════════════════════════════
  // § 8.1  通用会话事件 / 消息位置检查 / 上下文（新接口）
  // ═══════════════════════════════════════════════════════

  /** 获取群聊详情，支持按 display_name / username 过滤成员 */
  async getGroupDetail(conversationId, params = {}) {
    this._checkInitialized()
    return getGroupDetailApi(conversationId, params)
  }

  /**
   * 会话事件流（适用于群聊 / 私聊）
   * 支持事件类型过滤、before_seq / after_seq 分页、限制条数
   */
  async getConversationEvents(conversationId, params = {}) {
    this._checkInitialized()
    return getConversationEventsApi(conversationId, params)
  }

  /** 判定指定消息是否是会话中最早的一条 */
  async isFirstMessage(conversationId, eventId) {
    this._checkInitialized()
    return isFirstMessageApi(conversationId, eventId)
  }

  /** 判定指定消息是否是会话中最新的一条 */
  async isLastMessage(conversationId, eventId) {
    this._checkInitialized()
    return isLastMessageApi(conversationId, eventId)
  }

  /** 获取消息上下文（before / target / after） */
  async getMessageContext(conversationId, messageId, params = {}) {
    this._checkInitialized()
    return getMessageContextApi(conversationId, messageId, params)
  }

  /**
   * 跳转定位专用：获取消息上下文并转为应用层消息格式
   * @param {string|number} conversationId 会话 ID
   * @param {string} messageId 目标消息 event_id（允许带 `$` 前缀，内部会剥掉）
   * @param {{ before_limit?: number, after_limit?: number }} [params]
   * @returns {Promise<{ messages: any[], targetMessageId: string, conversationId: number, beforeCount: number, afterCount: number }>}
   */
  async getMessageContextConverted(conversationId, messageId, params = {}) {
    const raw = String(messageId ?? '').replace(/^\$/, '')
    if (!conversationId || !raw) {
      return { messages: [], targetMessageId: null, conversationId: null, beforeCount: 0, afterCount: 0 }
    }

    const resp = await this.getMessageContext(conversationId, raw, params)
    const resolvedConversationId = resp?.conversation_id ?? conversationId ?? null
    if (!resp || !resp.target) {
      return { messages: [], targetMessageId: null, conversationId: resolvedConversationId, beforeCount: 0, afterCount: 0 }
    }

    // before 是按 seq DESC 返回，需反转后与 target + after 拼接
    const beforeRaw = Array.isArray(resp.before) ? [...resp.before].reverse() : []
    const afterRaw = Array.isArray(resp.after) ? resp.after : []
    const timeline = [...beforeRaw, resp.target, ...afterRaw]
      .map((m) => this._convertMessage(m, resolvedConversationId))

    const target = this._convertMessage(resp.target, resolvedConversationId)
    return {
      messages: timeline,
      targetMessageId: target.eventId,
      conversationId: resolvedConversationId,
      beforeCount: beforeRaw.length,
      afterCount: afterRaw.length,
    }
  }

  // ═══════════════════════════════════════════════════════
  // § 8.2  消息转发（新接口）
  // ═══════════════════════════════════════════════════════

  async forwardSingleMessage(payload) {
    this._checkInitialized()
    return forwardSingleMessageApi(payload)
  }

  async forwardBatchMessages(payload) {
    this._checkInitialized()
    return forwardBatchMessagesApi(payload)
  }

  // ═══════════════════════════════════════════════════════
  // § 8.3  群聊 Agent 绑定 / 协作任务
  // ═══════════════════════════════════════════════════════

  async bindGroupAgent(conversationId, agentParticipantId) {
    this._checkInitialized()
    return bindGroupAgentApi(conversationId, agentParticipantId)
  }

  async unbindGroupAgent(conversationId, agentParticipantId) {
    this._checkInitialized()
    return unbindGroupAgentApi(conversationId, agentParticipantId)
  }

  async getGroupTasks(conversationId) {
    this._checkInitialized()
    return getGroupTasksApi(conversationId)
  }

  // ═══════════════════════════════════════════════════════
  // § 9  未读管理（委托给 unread 模块）
  // ═══════════════════════════════════════════════════════

  getRoomUnreadCounts(conversationId) {
    return unreadModule.getRoomUnreadCounts(this, conversationId)
  }

  async fetchUnreadCounts() {
    return unreadModule.fetchUnreadCounts(this)
  }

  async fetchConversationUnread(conversationId) {
    return unreadModule.fetchConversationUnread(this, conversationId)
  }

  async fetchMentionInfo(conversationId) {
    return unreadModule.fetchMentionInfo(this, conversationId)
  }

  async markMessageAsRead(conversationId, payload) {
    return unreadModule.markMessageAsRead(this, conversationId, payload)
  }

  getUnreadMentionDetails(conversationId) {
    return unreadModule.getUnreadMentionDetails(this, conversationId)
  }

  refreshUnreadMentionDetails(conversationId) {
    return unreadModule.refreshUnreadMentionDetails(this, conversationId)
  }

  refreshAllUnreadMentionDetails() {
    return unreadModule.refreshAllUnreadMentionDetails(this)
  }

  // ═══════════════════════════════════════════════════════
  // § 10  增量同步（委托给 sync 模块）
  // ═══════════════════════════════════════════════════════

  async syncConversation(conversationId) {
    return syncModule.syncConversation(this, conversationId)
  }

  async syncAllConversations() {
    return syncModule.syncAllConversations(this)
  }

  /**
   * 发送文件消息
   * @param {string|number} conversationId
   * @param {{ url: string, name: string, size: number, mimeType: string, body?: string }} fileInfo
   * @param {Object} options
   */
  async sendFileMessage(conversationId, fileInfo, options = {}) {
    return sendingModule.sendFileMessage(this, conversationId, fileInfo, options)
  }

  /**
   * 上传文件（新接口：POST /kc-media/api/v1/team-files/upload）
   * @param {File} file
   * @param {(progress:number)=>void} [onProgress]
   * @param {{ threadId?: string|number }} [options]
   *        threadId 缺省时回退为 currentConversationId
   * @returns {Promise<{ fileId: string, fileInfo: object, downloadUrl: string }>}
   */
  async uploadContent(file, onProgress, options = {}) {
    this._checkInitialized()

    const threadId = options.threadId ?? this._currentConversationId
    if (!threadId) {
      throw new Error('[HttpIMClient] 缺少 threadId/conversationId，无法上传文件')
    }

    // 获取当前用户 ID 和环境
    const userId = this._getUserId()
    const env = this._getEnv()

    const result = await uploadGroupFile(threadId, file, {
      baseUrl: this._baseUrl || '',
      token: this._token || '',
      userId,
      env,
      onProgress,
    })

    // result: { fileId, fileInfo, downloadUrl }
    return result
  }

  /**
   * 获取当前用户 ID（从 localStorage 读取）
   */
  _getUserId() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('super-assistant-userInfo') : null
      if (raw) {
        const userInfo = JSON.parse(raw)
        return String(userInfo?.userId ?? '').trim()
      }
    } catch (e) {
      // ignore
    }
    return ''
  }

  /**
   * 获取当前环境（dev/test/prod）
   */
  _getEnv() {
    try {
      if (typeof localStorage !== 'undefined') {
        const env = localStorage.getItem('one_env')
        if (env && ['dev', 'test', 'prod'].includes(env)) {
          return env
        }
      }
    } catch (e) {
      // ignore
    }
    return 'dev'
  }

  /** 设置当前活跃房间，供 uploadContent 在未显式传入 threadId 时回退 */
  setCurrentRoomId(conversationId) {
    this._currentConversationId = conversationId ?? null
  }

  // ═══════════════════════════════════════════════════════
  // § 11  私聊管理（Private Chat API）
  // ═══════════════════════════════════════════════════════

  /**
   * 开始私聊（幂等）
   * @param {{ targetUserName: string }} params
   */
  async startPrivateChat(params) {
    this._checkInitialized()
    return startPrivateChatApi(params)
  }

  /**
   * 获取私聊列表
   * @param {{ limit?: number, offset?: number }} [params]
   * @returns {Promise<Array>}
   */
  async getPrivateChats(params = {}) {
    this._checkInitialized()
    return getPrivateChatsApi(params)
  }

  /**
   * 关闭私聊（仅隐藏当前用户列表中的会话）
   * @param {number|string} conversationId - 私聊会话 ID
   * @returns {Promise<object>}
   */
  async closePrivateChat(conversationId) {
    this._checkInitialized()
    return closePrivateChatApi(conversationId)
  }

  /**
   * 恢复私聊可见性
   * @param {number|string} conversationId - 私聊会话 ID
   * @returns {Promise<object>}
   */
  async reopenPrivateChat(conversationId) {
    this._checkInitialized()
    return reopenPrivateChatApi(conversationId)
  }

  /**
   * 获取私聊详情
   * @param {number} conversationId - 私聊会话 ID
   * @returns {Promise<object>}
   */
  async getPrivateChatDetail(conversationId) {
    this._checkInitialized()
    return getPrivateChatDetailApi(conversationId)
  }

  /**
   * 发送私聊消息
   * @param {number} conversationId - 私聊会话 ID
   * @param {object} data - 消息数据
   * @returns {Promise<{ message_id: number, seq: number, created_at: string }>}
   */
  async sendPrivateMessage(conversationId, data) {
    this._checkInitialized()
    return sendPrivateMessageApi(conversationId, data)
  }

  /**
   * 撤回私聊消息
   * @param {number} conversationId - 私聊会话 ID
   * @param {number|string} eventId - 要撤回的事件 ID
   * @returns {Promise<{ ok: boolean, event_id: number, status: string }>}
   */
  async recallPrivateMessage(conversationId, eventId) {
    this._checkInitialized()
    return recallPrivateMessageApi(conversationId, eventId)
  }

}

// 导出单例
export const httpIMClient = new HttpIMClient()
