/**
 * 私聊 Store（Pinia）
 *
 * 负责私聊会话列表、消息管理、发送接收等全部私聊业务逻辑。
 * 与 groupStore 平级，完全独立。
 */

import { defineStore } from 'pinia'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { privateChatsState, privateChatsActions } from './store/chats'
import { privateHistoryActions } from './store/history'
import { privateMessagesActions } from './store/messages'
import { privateSendingActions } from './store/sending'

export const usePrivateStore = defineStore('private', {
  state: () => ({
    // 当前登录用户 ID（从 imConnectionStore 同步）
    currentUserId: null,

    // 私聊列表状态
    ...privateChatsState(),

    // 按 conversationId 隔离的消息状态
    chatMessages: {},
  }),

  getters: {
    /**
     * 私聊列表（按最后消息时间降序排序）
     */
    sortedPrivateChats: (state) => {
      return [...state.privateChats].sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || a.createdAt).getTime()
        const timeB = new Date(b.lastMessageAt || b.createdAt).getTime()
        return timeB - timeA
      })
    },

    /**
     * 当前选中的私聊对象
     */
    currentChat: (state) => {
      if (!state.currentChatId) return null
      return state.privateChats.find((c) => c.conversationId === state.currentChatId)
    },

    /**
     * 通过 participant_id 查找私聊
     * @param {number} participantId
     * @returns {object|undefined}
     */
    getChatByParticipantId: (state) => (participantId) => {
      return state.privateChats.find((c) => c.participantId === participantId)
    },

    /**
     * 通过 conversation_id 查找私聊
     * @param {number} conversationId
     * @returns {object|undefined}
     */
    getChatById: (state) => (conversationId) => {
      return state.privateChats.find((c) => c.conversationId === conversationId)
    },

    /**
     * 获取指定私聊的消息列表（已按时间戳排序）
     * @param {number} conversationId
     * @returns {Array<object>}
     */
    getMessagesByChatId: (state) => (conversationId) => {
      if (!conversationId) return []
      const chat = state.chatMessages[conversationId]
      if (!chat) return []
      const list = chat.messages || []
      if (list.length <= 1) return list
      return [...list].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    },

    /**
     * 指定私聊是否已加载历史
     * @param {number} conversationId
     * @returns {boolean}
     */
    hasLoadedHistory: (state) => (conversationId) => {
      if (!conversationId) return false
      const chat = state.chatMessages[conversationId]
      return chat?.messages?.some((m) => m.isHistory) ?? false
    },

    /**
     * 指定私聊是否正在加载更多历史
     * @param {number} conversationId
     * @returns {boolean}
     */
    isLoadingMoreHistory: (state) => (conversationId) => {
      if (!conversationId) return false
      return state.chatMessages[conversationId]?.loadingMoreHistory ?? false
    },

    /**
     * 指定私聊是否已完成首次历史拉取
     * @param {number} conversationId
     * @returns {boolean}
     */
    hasInitialFetchDone: (state) => (conversationId) => {
      if (!conversationId) return false
      return state.chatMessages[conversationId]?.initialHistoryFetched ?? false
    },

    /**
     * 指定私聊的正在输入人数
     * @param {number} conversationId
     * @returns {number}
     */
    typingCountForChat: (state) => (conversationId) => {
      if (!conversationId) return 0
      return state.chatMessages[conversationId]?.remoteTypingUserIds?.length ?? 0
    },
  },

  actions: {
    // 合并所有子模块的 actions
    ...privateChatsActions,
    ...privateHistoryActions,
    ...privateMessagesActions,
    ...privateSendingActions,

    // ─── 内部工具方法 ──────────────────────────────────────

    /**
     * 确保指定私聊的消息状态存在
     * @param {number} conversationId
     * @returns {object|null}
     */
    _ensureChatMessages(conversationId) {
      if (!conversationId) return null
      if (!this.chatMessages[conversationId]) {
        this.chatMessages[conversationId] = {
          messages: [],
          loadingHistory: false,
          loadingMoreHistory: false,
          hasMoreHistory: true,
          isContextWindow: false,
          anchorMessageId: null,
          hasMoreForward: false,
          loadingMoreForward: false,
          oldestSeq: null,
          newestSeq: null,
          droppedBefore: false,
          droppedAfter: false,
          sendingMessage: false,
          initialHistoryFetched: false,
          remoteTypingUserIds: [],
          _historyLoadPromise: null,
        }
      }
      return this.chatMessages[conversationId]
    },

    /**
     * 在所有私聊中查找消息
     * @param {string} eventId
     * @returns {{ conversationId: number, chat: object, msg: object }|null}
     */
    _findMessageCtx(eventId) {
      for (const conversationId of Object.keys(this.chatMessages)) {
        const chat = this.chatMessages[conversationId]
        const msg = chat.messages.find((m) => (m.eventId ?? m.event_id) === eventId)
        if (msg) return { conversationId: Number(conversationId), chat, msg }
      }
      return null
    },

    /**
     * 连接建立后的初始化钩子（由 imConnection 调用）
     */
    _onPostConnect() {
      const imConn = useImConnectionStore()
      this.currentUserId = imConn.userId
    },

    /**
     * 断开连接时的清理钩子（由 imConnection 调用）
     */
    _onDisconnectCleanup() {
      this.currentChatId = null
      // 保留消息缓存，重连后可继续使用
    },
  },
})
