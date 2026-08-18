/**
 * IM Store 子模块 - 私聊列表管理（usePrivateStore 专属）
 *
 * 负责：
 * - 加载私聊列表
 * - 开始/获取私聊（幂等）
 * - 选中私聊
 * - 删除私聊（本地删除，预留后端 API 接口）
 */

import { client } from '@/shared/im-client'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import { fetchUserProfile } from '@/shared/services/userProfileApi.js'
import {
  buildPrivateChatFromEvent,
  buildPrivateChatFromMessage,
} from '@/shared/im-http/utils/conversationListItems.mjs'
import { formatChat } from '../utils/privateChatFormat.js'
import {
  findPrivateChatForIncomingMessage,
  getIncomingConversationId,
  shouldReopenIncomingPrivateChat,
} from '../utils/privateIncomingChat.mjs'

const LOG_PREFIX = '[PrivateStore]'

export const privateChatsState = () => ({
  /** 私聊列表，按最后消息时间降序 */
  privateChats: [],
  /** 当前选中的私聊 conversationId */
  currentChatId: null,
  /** 已本地删除的私聊 ID 列表，防止 loadPrivateChats 再次拉回来 */
  _leftChatIds: [],
  /** 列表是否正在加载 */
  loadingChats: false,
  /** 私聊列表是否已经至少加载过一次 */
  privateChatsLoaded: false,
  /** 正在处理恢复可见性的会话，避免同一会话多条 WS 消息重复调用 */
  _reopeningChatIds: [],
})

export const privateChatsActions = {
  /**
   * 加载私聊列表（会过滤已本地删除的项）
   */
  async loadPrivateChats() {
    if (this.loadingChats) return
    this.loadingChats = true
    try {
      const list = await client.getPrivateChats({ limit: 100 })
      const arr = Array.isArray(list) ? list : []
      this.privateChats = arr
        .filter((item) => !this._leftChatIds.includes(item.conversation_id ?? item.conversationId))
        .map((item) => formatChat(item))
      this.privateChatsLoaded = true
      console.log(`${LOG_PREFIX} 加载私聊列表成功:`, this.privateChats.length)
    } catch (error) {
      console.error(`${LOG_PREFIX} 加载私聊列表失败:`, error)
      throw error
    } finally {
      this.loadingChats = false
    }
  },

  async loadPrivateChatsOnce() {
    if (this.privateChatsLoaded || this.loadingChats) return
    await this.loadPrivateChats()
  },

  upsertPrivateChatFromEvent(event) {
    const chat = buildPrivateChatFromEvent(event)
    if (!chat) return null

    this._leftChatIds = this._leftChatIds.filter(
      (id) => String(id) !== String(chat.conversationId),
    )

    const idx = this.privateChats.findIndex(
      (item) => String(item.conversationId) === String(chat.conversationId),
    )
    if (idx === -1) {
      this.privateChats.unshift(chat)
    } else {
      this.privateChats.splice(idx, 1, {
        ...this.privateChats[idx],
        ...chat,
        peerAvatarUrl: chat.peerAvatarUrl || this.privateChats[idx].peerAvatarUrl,
      })
    }

    this.privateChatsLoaded = true
    return this.privateChats.find(
      (item) => String(item.conversationId) === String(chat.conversationId),
    ) || null
  },

  upsertPrivateChatFromMessage(message) {
    const chat = buildPrivateChatFromMessage(message)
    if (!chat) return null

    this._leftChatIds = this._leftChatIds.filter(
      (id) => String(id) !== String(chat.conversationId),
    )

    const idx = this.privateChats.findIndex(
      (item) => String(item.conversationId) === String(chat.conversationId),
    )
    if (idx === -1) {
      this.privateChats.unshift(chat)
    } else {
      this.privateChats.splice(idx, 1, {
        ...this.privateChats[idx],
        ...chat,
        peerAvatarUrl: chat.peerAvatarUrl || this.privateChats[idx].peerAvatarUrl,
      })
    }

    this.privateChatsLoaded = true
    return this.privateChats.find(
      (item) => String(item.conversationId) === String(chat.conversationId),
    ) || null
  },

  /**
   * 开始私聊（幂等）
   * @param {{ targetUserName: string }} params
   * @returns {Promise<object>} 私聊对象
   */
  async startPrivateChat(params) {
    const { targetUserName } = params
    if (!targetUserName) {
      throw new Error(`${LOG_PREFIX} targetUserName 不能为空`)
    }

    // 先查本地
    const local = this.privateChats.find((c) => c.peerUsername === targetUserName)
    if (local) {
      console.log(`${LOG_PREFIX} 命中本地私聊:`, local.conversationId)
      return local
    }

    // 调用后端 API
    const resp = await client.startPrivateChat(params)
    const chat = formatChat(resp)

    // 如果后端返回的会话本地还没有，追加进列表
    const existsIdx = this.privateChats.findIndex(
      (c) => c.conversationId === chat.conversationId,
    )
    if (existsIdx === -1) {
      this.privateChats.unshift(chat)
      console.log(`${LOG_PREFIX} 新增私聊:`, chat.conversationId, '(created:', resp.created, ')')
    }

    // 清除删除标记（用户主动开始会话视为恢复）
    if (this._leftChatIds.includes(chat.conversationId)) {
      this._leftChatIds = this._leftChatIds.filter((id) => id !== chat.conversationId)
    }

    return chat
  },

  /**
   * 选中私聊（自动确保消息状态 + 触发首次历史加载）
   * @param {number|null} conversationId
   */
  async selectChat(conversationId) {
    if (!conversationId) {
      this.currentChatId = null
      return
    }

    const chat = this.privateChats.find((c) => c.conversationId === conversationId)
    if (!chat) {
      console.warn(`${LOG_PREFIX} 私聊不存在，无法选中:`, conversationId)
      return
    }

    this.currentChatId = conversationId
    this._ensureChatMessages(conversationId)

    const chatState = this.chatMessages[conversationId]
    if (!chatState.initialHistoryFetched) {
      await this.loadHistory(conversationId)
    }

    if (chat.peerUsername) {
      fetchUserProfile(chat.peerUsername).then((profile) => {
        if (!profile || !Object.keys(profile).length) return
        if (profile.name) chat.peerDisplayName = profile.name
        if (profile.avatar) chat.peerAvatarUrl = profile.avatar
      }).catch(() => {})
    }

    const unreadStoreInstance = useUnreadStore()
    unreadStoreInstance.markLatestMessageAsRead(conversationId, 'private').catch((error) => {
      console.warn(`${LOG_PREFIX} markLatestMessageAsRead 失败:`, error?.message)
    })
  },

  _removePrivateChatLocally(conversationId) {
    if (!conversationId) return

    const idx = this.privateChats.findIndex(
      (c) => String(c.conversationId) === String(conversationId),
    )
    if (idx !== -1) {
      this.privateChats.splice(idx, 1)
    }

    if (this.chatMessages[conversationId]) {
      delete this.chatMessages[conversationId]
    }

    if (!this._leftChatIds.includes(conversationId)) {
      this._leftChatIds.push(conversationId)
    }

    if (String(this.currentChatId) === String(conversationId)) {
      this.currentChatId = null
    }
  },

  /**
   * 关闭私聊
   *
   * 后端会将当前用户在该私聊中的 visibility 置为 false；
   * 本地立即移除列表项，下一次 loadPrivateChats 也不会再返回该会话。
   * @param {number|string} conversationId
   */
  async closePrivateChat(conversationId) {
    if (!conversationId) return

    await client.closePrivateChat(conversationId)
    this._removePrivateChatLocally(conversationId)

    console.log(`${LOG_PREFIX} 关闭私聊:`, conversationId)
  },

  /**
   * 兼容旧调用名：现在语义为关闭私聊。
   * @param {number|string} conversationId
   */
  async deletePrivateChat(conversationId) {
    await this.closePrivateChat(conversationId)
  },

  /**
   * 恢复私聊可见性并刷新列表。
   * @param {number|string} conversationId
   * @returns {Promise<object|null>}
   */
  async reopenPrivateChat(conversationId, message = null) {
    if (!conversationId) return null

    await client.reopenPrivateChat(conversationId)
    this._leftChatIds = this._leftChatIds.filter(
      (id) => String(id) !== String(conversationId),
    )
    if (message) {
      const chat = this.upsertPrivateChatFromMessage({
        ...message,
        conversationId,
      })
      if (chat) return chat
    }

    await this.loadPrivateChats()

    return this.privateChats.find(
      (chat) => String(chat.conversationId) === String(conversationId),
    ) || null
  },

  /**
   * WS 收到已关闭会话的新消息时，恢复私聊可见性，但不自动切换 tab。
   * @param {object} message
   */
  async openIncomingPrivateChatIfNeeded(message) {
    if (!shouldReopenIncomingPrivateChat(this.privateChats, message, this.currentUserId)) {
      return findPrivateChatForIncomingMessage(this.privateChats, message)
    }

    const conversationId = getIncomingConversationId(message)
    if (!conversationId) {
      console.warn(`${LOG_PREFIX} 私聊消息缺少 conversationId，无法恢复:`, message)
      return null
    }

    const key = String(conversationId)
    if (this._reopeningChatIds.includes(key)) return null
    this._reopeningChatIds.push(key)

    try {
      await this.reopenPrivateChat(conversationId, message)
      const chat = findPrivateChatForIncomingMessage(this.privateChats, message)
      if (!chat) return null

      // 移除自动切换 tab 的逻辑，只恢复私聊可见性
      // 消息会通过 _updateChatLastMessage 自动置顶
      return chat
    } finally {
      this._reopeningChatIds = this._reopeningChatIds.filter((id) => id !== key)
    }
  },

  /**
   * 更新私聊在列表中的最新消息信息，用于列表排序和预览
   * @param {number} conversationId
   * @param {{ lastMessageAt?: string, lastMessagePreview?: string, lastSeq?: number }} info
   */
  _updateChatLastMessage(conversationId, info) {
    const chat = this.privateChats.find((c) => c.conversationId === conversationId)
    if (!chat) return

    if (info.lastMessageAt) chat.lastMessageAt = info.lastMessageAt
    if (info.lastMessagePreview !== undefined) chat.lastMessagePreview = info.lastMessagePreview
    if (info.lastSeq !== undefined) chat.lastSeq = info.lastSeq

    // 收到新消息后，按最后消息时间降序排序，将该会话置顶
    this.privateChats.sort((a, b) => {
      const tsA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tsB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tsB - tsA
    })
  },
}

export { formatChat }
