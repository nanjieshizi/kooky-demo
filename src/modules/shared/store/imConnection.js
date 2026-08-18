/**
 * IM 全局连接 Store
 * 唯一负责 IM 连接生命周期，连接成功后调 group Store 钩子分发业务。
 */
import { defineStore } from 'pinia'
import { client } from '@/shared/im-client'
import { AppEventTypes } from '@/shared/im-client'
import { buildImClientInitOptions } from '@/shared/im-client/initOptions.js'
import { useGroupStore } from '@/modules/group/store'
import { usePrivateStore } from '@/modules/private/store'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'

export const useImConnectionStore = defineStore('imConnection', {
  state: () => ({
    isConnected: false,
    isRealtimeConnected: false,
    isSyncing: false,
    syncState: null,
    userId: null,
    accessToken: null,
    deviceId: null,
    _unsubscribers: [],
    _initPromise: null,
    _listenersAttached: false,
  }),

  actions: {
    async connect(options = {}) {
      if (this._initPromise) return this._initPromise
      if (this.isConnected) {
        console.log('[ImConnection] 已连接，跳过重复连接')
        return Promise.resolve()
      }

      this._initPromise = (async () => {
        let unsubConnectedLog = null
        try {
          this.accessToken = options.accessToken
          this.userId = options.userId

          this._setupEventListeners()
          useUnreadStore().attachClientListeners()

          unsubConnectedLog = client.on(AppEventTypes.Connected, () => {
            this.isConnected = true
            if (unsubConnectedLog) { unsubConnectedLog(); unsubConnectedLog = null }
          })

          const { initParams } = buildImClientInitOptions(
            {
              ...options,
              userId: options.userId || this.userId,
            },
            window.BASEDB,
          )

          console.log('[ImConnection] IM 初始化参数:', { baseUrl: initParams.baseUrl, wsUrl: initParams.wsUrl })

          const initRes = await client.init(initParams)

          if (initRes?.userId) this.userId = initRes.userId
          if (initRes?.deviceId) this.deviceId = initRes.deviceId

          // isConnected 已在 Connected 事件中提前设置，此处确保兜底
          if (!this.isConnected) this.isConnected = true
          this.isRealtimeConnected = client.isRealtimeConnected?.() ?? this.isConnected

          // 建连成功后通知业务层
          const groupStore = useGroupStore()
          groupStore.userId = this.userId
          groupStore._onPostConnect()

          const privateStore = usePrivateStore()
          privateStore._onPostConnect()
          privateStore.loadPrivateChats().catch((e) => {
            console.warn('[ImConnection] 加载私聊列表失败:', e?.message)
          })

          const collaborationStore = useCollaborationEmployeeChatStore()
          collaborationStore.loadEmployeeItems().catch((e) => {
            console.warn('[ImConnection] 加载数字人列表失败:', e?.message)
          })

          await useUnreadStore().initUnread()
        } catch (error) {
          if (unsubConnectedLog) { unsubConnectedLog(); unsubConnectedLog = null }
          this._unsubscribers.forEach((unsub) => unsub())
          this._unsubscribers = []
          this._listenersAttached = false
          console.error('[ImConnection] IM 连接失败:', error)
          throw error
        } finally {
          this._initPromise = null
        }
      })()

      return this._initPromise
    },

    async disconnect() {
      this._unsubscribers.forEach((unsub) => unsub())
      this._unsubscribers = []
      await client.disconnect()
      this._initPromise = null
      this._listenersAttached = false
      this.isConnected = false
      this.isRealtimeConnected = false
      this.isSyncing = false
      this.syncState = null
      this.userId = null
      this.accessToken = null
      this.deviceId = null

      // 通知业务层清理
      useGroupStore()._onDisconnectCleanup()
      usePrivateStore()._onDisconnectCleanup()
      const unreadStore = useUnreadStore()
      unreadStore.detachClientListeners()
      unreadStore.$reset()

      console.log('[ImConnection] IM 已断开')
    },

    _setupEventListeners() {
      if (this._listenersAttached) return
      this._listenersAttached = true

      const push = (unsub) => this._unsubscribers.push(unsub)

      push(client.on(AppEventTypes.Sync, ({ state }) => {
        this.syncState = state
        this.isSyncing = state === 'SYNCING'
      }))

      push(client.on(AppEventTypes.SyncPrepared, ({ state }) => {
        this.syncState = state || 'PREPARED'
        this.isSyncing = false
      }))

      push(client.on(AppEventTypes.SyncStopped, ({ state }) => {
        this.syncState = state || 'STOPPED'
        this.isSyncing = false
      }))

      push(client.on(AppEventTypes.Disconnected, () => {
        this.isConnected = false
        this.isRealtimeConnected = false
      }))

      push(client.on(AppEventTypes.ConnectError, (error) => {
        console.error('[ImConnection] IM 错误:', error)
      }))

      // 以下全部路由给 group store，惰性解析避免循环依赖
      const group = () => useGroupStore()

      push(client.on(AppEventTypes.RoomsUpdated, ({ rooms }) => {
        group()._onConversationsUpdated(rooms)
      }))

      push(client.on(AppEventTypes.RoomInvite, ({ conversationId, roomId }) => {
        group()._onConversationInvite({ conversationId: conversationId ?? roomId })
      }))

      push(client.on(AppEventTypes.GroupMessageReceived, (msg) => {
        group()._onGroupMessageReceived(msg)
      }))

      push(client.on(AppEventTypes.GroupMessageRecalled, (data) => {
        group()._onGroupMessageRecalled(data)
      }))

      push(client.on(AppEventTypes.RoomMemberTyping, (payload) => {
        group()._onConversationMemberTyping(payload)
      }))

      push(client.on(AppEventTypes.RoomTypingSnapshot, (payload) => {
        group()._onConversationTypingSnapshot(payload)
      }))

      push(client.on(AppEventTypes.ReadMarkerUpdated, ({ conversationId, roomId }) => {
        group()._onConversationReadMarkerUpdated({ conversationId: conversationId ?? roomId })
      }))

      push(client.on(AppEventTypes.UnreadUpdated, ({ conversationId, roomId }) => {
        group()._onUnreadUpdated({ conversationId: conversationId ?? roomId })
      }))

      push(client.on(AppEventTypes.UnreadMentionDetailsUpdated, ({ conversationId, roomId, details }) => {
        group()._onConversationUnreadMentionDetailsUpdated({ conversationId: conversationId ?? roomId, details })
      }))

      push(client.on(AppEventTypes.RoomMembersUpdated, ({ conversationId, roomId }) => {
        const id = conversationId ?? roomId
        if (id) group()._onConversationMembersUpdated(id)
      }))

      push(client.on(AppEventTypes.RoomLeft, ({ conversationId, roomId, conversationName, roomName, cardType }) => {
        const id = conversationId ?? roomId
        if (!id) return
        group()._onConversationLeft({ conversationId: id, conversationName: conversationName ?? roomName, cardType })
      }))

      push(client.on(AppEventTypes.RoomCreated, (payload) => {
        group()._onConversationCreated(payload)
      }))

      // ─── 私聊事件（与群聊完全独立） ──────────────────────────
      const priv = () => usePrivateStore()
      const unread = () => useUnreadStore()

      push(client.on(AppEventTypes.PrivateMessageReceived, (msg) => {
        priv()._onMessageReceived(msg)
      }))

      push(client.on(AppEventTypes.PrivateMessageRecalled, (data) => {
        priv()._onMessageRecalled(data)
      }))

      push(client.on(AppEventTypes.PrivateChatCreated, (data) => {
        priv()._onChatCreated(data)
      }))

      push(client.on(AppEventTypes.PrivateChatsUpdated, () => {
        priv().loadPrivateChats()
      }))

      push(client.on(AppEventTypes.UnreadInitialized, (payload) => {
        unread().applySnapshot(payload)
      }))
    },

    isClientConnected() {
      return client.isConnected()
    },

    isConversationJoined(conversationId) {
      if (!conversationId) return false
      return client.hasJoinedRoom?.(conversationId) ?? false
    },

    canPaginateBackwards(roomId) {
      if (!roomId || !client.isConnected()) return false
      return client.canPaginateBackwards(roomId)
    },

    async uploadContent(file, onProgress, options = {}) {
      if (!client.isConnected()) {
        throw new Error('未连接到服务，请稍后重试')
      }
      if (typeof client.uploadContent !== 'function') {
        throw new Error('当前 IM 实现暂不支持文件上传')
      }
      return client.uploadContent(file, onProgress, options)
    },

    waitForSyncPrepared(timeoutMs = 5000) {
      if (client.isConnected() && client.getSyncState?.() === 'PREPARED') {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const unsubscribe = client.on(AppEventTypes.SyncPrepared, () => {
          unsubscribe()
          resolve()
        })
        setTimeout(() => {
          unsubscribe()
          resolve()
        }, timeoutMs)
      })
    },
  },
})
