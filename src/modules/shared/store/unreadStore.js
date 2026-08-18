import { defineStore } from 'pinia'
import { client, AppEventTypes } from '@/shared/im-client'

function normalizeEntry(entry = {}) {
  return {
    unreadCount: Math.max(0, Number(entry.unreadCount ?? entry.unread_count ?? entry.conv_count ?? 0) || 0),
    hasMention: Boolean(entry.hasMention ?? entry.has_mention),
    mentionInfo: entry.mentionInfo ?? entry.mention_info ?? null,
    lastReadEventPk: entry.lastReadEventPk ?? entry.last_read_event_pk ?? null,
  }
}

function normalizeSnapshot(payload = {}) {
  const conversationUnreads = {}
  const source = payload.conversationUnreads || {}
  for (const [conversationId, entry] of Object.entries(source)) {
    conversationUnreads[conversationId] = normalizeEntry(entry)
  }
  const total = Number(payload.totalUnread ?? payload.total_unread)
  return {
    totalUnread: Number.isFinite(total)
      ? Math.max(0, total)
      : Object.values(conversationUnreads).reduce((sum, item) => sum + item.unreadCount, 0),
    conversationUnreads,
  }
}

function getConversationUnreadEntry(conversationUnreads, conversationId) {
  if (conversationId == null) return null
  if (conversationUnreads?.[conversationId]) return conversationUnreads[conversationId]
  const hit = Object.entries(conversationUnreads || {}).find(([id]) => String(id) === String(conversationId))
  return hit?.[1] ?? null
}

function messageEventPk(message) {
  return message?.eventPk ?? message?.event_pk ?? message?.id ?? null
}


export const useUnreadStore = defineStore('unread', {
  state: () => ({
    totalUnread: 0,
    conversationUnreads: {},
    initialized: false,
    _unsubscribers: [],
  }),

  getters: {
    totalUnreadCount: (state) => state.totalUnread,
    getConversationUnreadCount: (state) => (conversationId) =>
      getConversationUnreadEntry(state.conversationUnreads, conversationId)?.unreadCount ?? 0,
    hasConversationMention: (state) => (conversationId) =>
      Boolean(getConversationUnreadEntry(state.conversationUnreads, conversationId)?.hasMention),
    getConversationMentionInfo: (state) => (conversationId) =>
      getConversationUnreadEntry(state.conversationUnreads, conversationId)?.mentionInfo ?? null,
  },

  actions: {
    attachClientListeners() {
      if (this._unsubscribers.length > 0) return
      this._unsubscribers.push(client.on(AppEventTypes.UnreadInitialized, (payload) => {
        this.applySnapshot(payload)
        this.initialized = true
      }))
      this._unsubscribers.push(client.on(AppEventTypes.UnreadUpdated, (payload) => {
        this.applyReadEvent(payload)
      }))
    },

    detachClientListeners() {
      this._unsubscribers.forEach((unsub) => unsub())
      this._unsubscribers = []
    },

    async initUnread() {
      this.attachClientListeners()
      if (this.initialized) {
        this.applySnapshot(client._unreadSnapshot || { totalUnread: 0, conversationUnreads: {} })
        return
      }
      try {
        const snapshot = await client.fetchUnreadCounts()
        this.applySnapshot(snapshot)
      } catch (error) {
        console.warn('[UnreadStore] 初始化未读失败:', error)
        this.applySnapshot({ totalUnread: 0, conversationUnreads: {} })
      } finally {
        this.initialized = true
      }
    },

    async refreshUnread() {
      const snapshot = await client.fetchUnreadCounts()
      this.applySnapshot(snapshot)
      return snapshot
    },

    applySnapshot(payload) {
      const snapshot = normalizeSnapshot(payload)
      this.totalUnread = snapshot.totalUnread
      this.conversationUnreads = snapshot.conversationUnreads
    },

    applyReadEvent(payload = {}) {
      const snapshot = payload.snapshot || client._unreadSnapshot
      if (snapshot) this.applySnapshot(snapshot)
    },

    incrementUnread(conversationId, options = {}) {
      if (!conversationId) return
      const current = normalizeEntry(this.conversationUnreads[conversationId])
      const next = {
        unreadCount: current.unreadCount + 1,
        hasMention: Boolean(options.hasMention || current.hasMention),
        mentionInfo: options.mentionInfo ?? current.mentionInfo,
      }
      this.conversationUnreads = {
        ...this.conversationUnreads,
        [conversationId]: next,
      }
      this.totalUnread += 1
      if (client._unreadSnapshot) {
        client._unreadSnapshot.conversationUnreads[conversationId] = next
        client._unreadSnapshot.totalUnread = this.totalUnread
      }
    },

    async markLatestMessageAsRead(conversationId, scope = 'group') {
      if (!conversationId) return null
      const messages = await this._getMessages(conversationId, scope)
      const lastMessage = [...(Array.isArray(messages) ? messages : [])]
        .reverse()
        .find((msg) => msg?.role !== 'system' && messageEventPk(msg) != null)
      if (!lastMessage) return null
      return this.markAsRead(conversationId, lastMessage)
    },

    async markAsRead(conversationId, message) {
      console.log(conversationId, message)
      if (!conversationId || !message) return null
      const eventPk = messageEventPk(message)
      if (eventPk == null) return null
      const response = await client.markMessageAsRead(conversationId, { event_pk: eventPk })
      await this.refreshUnread()
      return response
    },

    async _getMessages(conversationId, scope) {
      if (scope === 'private') {
        const { usePrivateStore } = await import('@/modules/private/store')
        return usePrivateStore().getMessagesByChatId(conversationId)
      }
      const { useGroupStore } = await import('@/modules/group/store')
      return useGroupStore().getMessagesByConversation(conversationId)
    },
  },
})
