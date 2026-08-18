import { defineStore } from 'pinia'
import { clearAllMatrixSessionStorage } from '@/shared/utils/storageKey'
import { updateSentryUser } from '@/app/sentry'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { clearUserProfileCache } from '@/shared/im-http/services/userProfile.js'

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null,
    onboardingCompleted: localStorage.getItem('onboardingCompleted') === 'true',
    assistantRole: localStorage.getItem('assistantRole') || '',
    hasLoggedInBefore: localStorage.getItem('hasLoggedInBefore') === 'true'
  }),

  getters: {
    isLoggedIn(state) {
      return state.userInfo?.access_token && state.userInfo?.access_token !== ''
    },
    needsOnboarding(state) {
      return !state.onboardingCompleted
    },
    userName(state) {
      return state.userInfo?.name || state.userInfo?.userName || ''
    },
    avatar(state) {
      return state.userInfo?.avatar || state.userInfo?.headUrl || ''
    },
    /** portal OAuth token（存在 userInfo.portalToken 中） */
    portalToken(state) {
      return state.userInfo?.portalToken ?? null
    }
  },

  actions: {
    setUserInfo(data) {
      const prevUserId = this.userInfo?.userId || this.userInfo?.userName
      const nextUserId = data?.userId || data?.userName
      this.userInfo = data
      localStorage.setItem('super-assistant-userInfo', JSON.stringify(data))
      this.hasLoggedInBefore = true
      localStorage.setItem('hasLoggedInBefore', 'true')

      // 切换账号时清空云端文件树缓存，防止新账号看到旧账号数据
      if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        import('@/modules/file/store').then(({ useFileStore }) => {
          const fileStore = useFileStore()
          fileStore.cloudTree.nodeCache = {}
          fileStore.cloudTree.expandedNodeIds = []
          fileStore.cloudTree.loadingNodeIds = []
          fileStore.quotaInfo = {}
        }).catch(() => {})
      }

      // 更新 Sentry 用户信息
      updateSentryUser(data)

      // 同步 Token 到主进程（用于 stc-market）
      this.syncTokenToMainProcess()
    },

    completeOnboarding(role) {
      this.assistantRole = role
      this.onboardingCompleted = true
      localStorage.setItem('assistantRole', role)
      localStorage.setItem('onboardingCompleted', 'true')
    },

    initFromStorage() {
      const stored = localStorage.getItem('super-assistant-userInfo')
      if (stored) {
        try {
          this.userInfo = JSON.parse(stored)
          // 恢复时也同步 Token
          this.syncTokenToMainProcess()
        } catch {
          localStorage.removeItem('super-assistant-userInfo')
        }
      }
    },

    async logout() {
      this.userInfo = null
      clearUserProfileCache()
      this.onboardingCompleted = false
      this.assistantRole = ''
      localStorage.removeItem('super-assistant-userInfo')
      localStorage.removeItem('onboardingCompleted')
      localStorage.removeItem('assistantRole')

      // 与系统登录态一致：清空 Matrix 本地会话，下次须重新 /login
      clearAllMatrixSessionStorage()

      // 重置导航状态为默认值（个人助理）
      try {
        const { useUIStore } = await import('@/modules/space/uiStore')
        const uiStore = useUIStore()
        uiStore.setActiveNavigation('deerflow', null)
      } catch (_) {
        /* noop */
      }

      // 断开 Matrix 连接（内含 resetChatNavigation）
      try {
        const { useImConnectionStore } = await import('@/modules/shared/store/imConnection')
        await useImConnectionStore().disconnect()
      } catch (_) {
        /* noop */
      }

      // 清空所有业务 store 的用户数据
      try {
        const { useGroupStore } = await import('@/modules/group/store')
        const groupStore = useGroupStore()
        groupStore.conversations = []
        groupStore.currentSpaceId = 'personal'
        groupStore.isCreatingTeam = false
      } catch (_) {
        /* noop */
      }

      try {
        const { useCollaborationEmployeeChatStore } = await import('@/modules/collaboration/store/employeeChatStore')
        useCollaborationEmployeeChatStore().$reset()
      } catch (_) {
        /* noop */
      }

      try {
        const { useFileStore } = await import('@/modules/file/store')
        const fileStore = useFileStore()
        fileStore.fileTree = []
        fileStore.expandedKeys = []
        fileStore.selectedKey = null
        fileStore.cloudTree.nodeCache = {}
        fileStore.cloudTree.expandedNodeIds = []
        fileStore.cloudTree.loadingNodeIds = []
        fileStore.quotaInfo = {}
      } catch (_) {
        /* noop */
      }

      try {
        const { useUIStore } = await import('@/modules/space/uiStore')
        const uiStore = useUIStore()
        uiStore.activeToolTab = null
        uiStore.toolFileContentVisible = false
        uiStore.fileTreeCollapsed = false
      } catch (_) {
        /* noop */
      }

      // 清空 deerflow-chat store（智能体、对话、消息、模型等所有状态）
      try {
        const { useDeerflowChatStore } = await import('@/modules/deerflow-chat/store')
        useDeerflowChatStore().resetState()
      } catch (_) {
        /* noop */
      }

      // 重置 CLI 终端：暂停 snapshot → 清 store → 卸载组件
      try {
        const { suspendSnapshot } = await import('@/modules/terminal/services/sessionService')
        suspendSnapshot()
      } catch (_) {
        /* noop */
      }
      try {
        const { useTabStore } = await import('@/modules/terminal/stores/tab')
        const { usePanelStore } = await import('@/modules/terminal/stores/panel')
        const { useWorkbenchStore } = await import('@/modules/terminal/stores/workbench')
        usePanelStore().$reset()
        useTabStore().resetAll()
        useWorkbenchStore().$reset()
      } catch (_) {
        /* noop */
      }
      try {
        const { useUIStore } = await import('@/modules/space/uiStore')
        const uiStore = useUIStore()
        uiStore.claudeCodeVisible = false
        uiStore.claudeCodeActive = false
      } catch (_) {
        /* noop */
      }

      updateSentryUser(null)
      this.syncTokenToMainProcess()
    },

    syncTokenToMainProcess() {
      const token = this.userInfo?.access_token
      const baseUrl = getOneBaseUrl()
      const stcMarket = window.electronAPI?.stcMarket

      if (stcMarket) {
        stcMarket.setBaseUrl(baseUrl).catch((err) => {
          console.error('[Auth] Failed to sync base url:', err)
        })
        stcMarket.setToken(token || null).catch((err) => {
          console.error('[Auth] Failed to sync token:', err)
        })
      }
    }
  }
})
