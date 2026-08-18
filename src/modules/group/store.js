/**
 * IM Group Store（群组频道）
 *
 * 组合以下子模块：
 *   store/rooms.js              - group 会话列表管理
 *   store/history.js            - 消息历史 & 分页（group）
 *   store/messages.js           - 消息接收（消息事件处理，群聊）
 *   store/members.js            - 成员 & 打字状态
 *   store/sending.js            - 消息发送 & 流式输出（group）
 *
 * 连接生命周期由 useImConnectionStore 统一管理，本 store 仅实现 _onXxx 业务钩子。
 */

import { defineStore } from 'pinia'
import { emptyConversationChat } from '@/shared/storeUtils/imMessageUtils'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { groupConversationsState, groupConversationsActions } from './store/rooms'
import { groupHistoryActions } from './store/history'
import { groupMessagesActions } from './store/messages'
import { membersActions } from './store/members'
import { groupSendingActions } from './store/sending'

export const useGroupStore = defineStore('group', {
  state: () => ({
    // 当前登录用户 ID，由 useImConnectionStore 建连后写入
    userId: null,
    // group 会话列表状态
    ...groupConversationsState(),
    // group 专属状态：按 conversationId 隔离的会话状态
    /**
     * 按 conversationId 隔离的会话状态
     * @type {Record<string, import('@/shared/storeUtils/imMessageUtils').ConversationChatState>}
     */
    conversationMessages: {},
    // 成员列表缓存：conversationId -> 成员数组
    conversationMembers: {},
    // 成员加载中标志：conversationId -> boolean
    conversationMembersLoading: {},
    // 成员防抖刷新计时器：conversationId -> timerId（非响应式，仅供内部使用）
    _membersRefreshTimers: {},
    // 已离开会话的黑名单（被踢/解散/退出），阻止 ConversationsUpdated 把未及时同步的会话写回来
    _leftConversationIds: [],
  }),

  getters: {
    /** 当前登录用户 ID，与 imConnectionStore.userId 一致（供组件与本人消息判定） */
    currentUserId: () => useImConnectionStore().userId,

    groupConversations: (state) => state.conversations,

    /** 所有 group 会话的未读数总和 */
    totalUnreadCount: (state) =>
      state.conversations.reduce(
        (sum, conversation) => sum + (state.conversationMessages[conversation.conversationId]?.unreadCount ?? 0),
        0,
      ),

    currentConversation: (state) => {
      if (!state.currentConversationId) return null
      return state.conversations.find((conversation) => conversation.conversationId === state.currentConversationId)
    },

    getMessagesByConversation: (state) => (conversationId) => {
      if (!conversationId) return []
      const list = state.conversationMessages[conversationId]?.messages ?? []
      if (list.length <= 1) return list
      return [...list].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    },

    hasLoadedHistory: (state) => (conversationId) => {
      if (!conversationId) return false
      const list = state.conversationMessages[conversationId]?.messages ?? []
      return list.some((m) => m.isHistory)
    },

    /** 指定会话内正在输入的人数（不含自己） */
    activeStreamsCountForConversation: (state) => (conversationId) => {
      if (!conversationId) return 0
      return state.conversationMessages[conversationId]?.remoteTypingUserIds?.length ?? 0
    },

    isConversationLoadingMoreHistory: (state) => (conversationId) => {
      if (!conversationId) return false
      return !!state.conversationMessages[conversationId]?.loadingMoreHistory
    },

    /** 该会话是否已完成首次历史拉取（含空会话） */
    hasConversationInitialFetchDone: (state) => (conversationId) => {
      if (!conversationId) return false
      return !!state.conversationMessages[conversationId]?.initialHistoryFetched
    },
  },

  actions: {
    // ─── 合并子模块 ───────────────────────────────────────────
    ...groupConversationsActions,
    ...groupHistoryActions,
    ...groupMessagesActions,
    ...membersActions,
    ...groupSendingActions,

    // ─── 内部工具 ─────────────────────────────────────────────

    /**
     * 确保指定 conversationId 的 conversationMessages 条目存在，若不存在则初始化。
     * @param {string} conversationId
     * @returns {object | null}
     */
    _ensureConversationMessages(conversationId) {
      if (!conversationId) return null
      if (!this.conversationMessages[conversationId]) {
        this.conversationMessages[conversationId] = emptyConversationChat()
      }
      return this.conversationMessages[conversationId]
    },

    /**
     * 在所有 conversationMessages 中查找指定 messageId 的消息及其上下文。
     * @param {string} messageId
     * @returns {{ conversationId: string, rc: object, msg: object } | null}
     */
    _findMessageCtx(messageId) {
      for (const conversationId of Object.keys(this.conversationMessages)) {
        const rc = this.conversationMessages[conversationId]
        const msg = rc.messages.find((m) => m.eventId === messageId)
        if (msg) return { conversationId, rc, msg }
      }
      return null
    },

    canLoadMoreHistory(conversationId) {
      if (!conversationId) return false
      return useImConnectionStore().canPaginateBackwards(conversationId)
    },

    isConversationJoined(conversationId) {
      if (!conversationId) return false
      return useImConnectionStore().isConversationJoined(conversationId)
    },
  },
})
