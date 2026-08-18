import { defineStore } from 'pinia'
import { isCollaborationNavKey } from '@/modules/navigation/config'

function isSoloTeamEmployeeSecondaryNav(secondaryNav) {
  return typeof secondaryNav === 'string' && secondaryNav.startsWith('employee:')
}

function isCollaborationDigitalEmployeeSecondaryNav(secondaryNav) {
  return typeof secondaryNav === 'string' && secondaryNav.startsWith('digital-human-')
}

function isDigitalEmployeeManageNav(primaryNav, secondaryNav) {
  return (
    (primaryNav === 'solo-team' && isSoloTeamEmployeeSecondaryNav(secondaryNav))
    || (isCollaborationNavKey(primaryNav) && isCollaborationDigitalEmployeeSecondaryNav(secondaryNav))
    // 通讯录「我的数字员工」页：卡片点开的就是这块管理面板，别在页内点二级时被收掉
    || (primaryNav === 'contacts' && secondaryNav === 'contacts-employees')
    || (primaryNav === 'contacts-b' && secondaryNav === 'contacts-b-employees')
  )
}

export const useUIStore = defineStore('ui', {
  state: () => ({
    // Right panel: null | 'file' | 'agent'
    rightPanelMode: null,
    // 全局文件树面板
    globalFilePanelVisible: true,
    // 全局文件预览是否激活
    globalFilePreviewActive: false,
    // 全局文件面板实际宽度（由 GlobalFilePanel 写入，供 HomeView 主区 margin 等布局使用）
    globalFilePanelTotalWidth: 0,
    // 当前窗口宽度（由文件面板组件写入，用于响应式布局）
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
    // 聊天模式: 'solo' | 'group'
    chatMode: 'solo',
    // Claude Code 全屏终端：是否已挂载（组件存活）
    claudeCodeVisible: false,
    // Claude Code 是否在前台显示（false = 后台运行，终端不销毁）
    claudeCodeActive: false,
    // Matrix IM 正在连接（useSessionGate 中 connect 前后）
    imConnecting: false,
    // Matrix 会话与登录后初始化完成（agent 加载等），用于控制 Home 内聊天区等挂载时机
    imReady: false,
    // 左侧二级导航是否展开
    sidebarExpanded: true,
    // 左侧导航栏是否可见（false = 完全隐藏，宽度为0）
    navRailVisible: true,
    // 收起导航栏前的二级导航展开状态（用于恢复）
    _sidebarExpandedBeforeCollapse: true,
    // 当前一级导航：solo-team(个人) | cli | collaboration | market
    // 「个人」= 分身+一人团队合并后的默认入口（骨架沿用 solo-team key）
    activePrimaryNav: 'solo-team',
    // 当前二级导航（不同一级目录下含义不同）
    activeSecondaryNav: null,
    // 关闭命令行后恢复到上一个内容态
    lastNonCliPrimaryNav: 'solo-team',
    lastNonCliSecondaryNav: null,
    /** 离开一人团队前最后选中的「我的员工」二级 key：employee:{id}:{threadId}，切回一人团队时优先恢复（与 localStorage 同步） */
    lastSoloTeamEmployeeSecondaryNav: (() => {
      try {
        const v = localStorage.getItem('last_solo_team_employee_secondary_nav')
        return typeof v === 'string' && v.startsWith('employee:') ? v : null
      } catch {
        return null
      }
    })(),
    /** 离开协作前最后选中的二级 key（群房间 id / private-xxx / digital-human-xxx），仅内存缓存，登出/刷新自然失效 */
    lastCollaborationSecondaryNav: null,
    /** 协作 B 独立记住最后选中的会话，避免与现有协作串台 */
    lastCollaborationBSecondaryNav: null,
    // 来自消息附件的待预览文件（MXC）：{ id, name, type, httpUrl, size, mimeType }
    pendingPreviewFile: null,
    // 个人空间通知面板是否展开
    notificationPanelOpen: false,
    /** 群组右侧名单：null 关闭 | 'human' 成员 | 'bot' 机器人 */
    groupRosterTab: null,
    // 被踢出/群解散的通知缓存（响应式，与 localStorage 同步）
    notificationLeaveCards: (() => {
      try {
        const raw = localStorage.getItem('notification_leave_cards')
        return raw ? JSON.parse(raw) : []
      } catch { return [] }
    })(),
    // 群 @我 通知的本地”已读”水位；仅影响通知面板/角标，不改 IM 原始未读状态
    notificationMentionReadAt: (() => {
      try {
        const raw = localStorage.getItem('notification_mention_read_at')
        return raw ? JSON.parse(raw) : {}
      } catch { return {} }
    })(),
    // 工具区状态（四区布局）
    toolPanelVisible: true, // 工具区常驻
    activeToolTab: null, // 'file' | 'task' | 'persona' | 'digitalEmployee' | null
    toolFileContentVisible: false, // 文件内容区是否展开
    fileTreeCollapsed: false, // 文件树列是否收起（用于响应式布局自动收起）
    fileTabClickSerial: 0, // 文件按钮点击序列号（用于每次点击触发刷新）
    activeFileTab: 'team', // 'team' | 'global'（云端文件 / 本地文件 Tab）
    showHiddenFiles: localStorage.getItem('file-panel-show-hidden') === 'true', // 是否显示隐藏文件
    // 分身管理面板状态
    personaPanelVisible: false, // 分身管理面板是否展开
    /** 一人团队 · 我的员工：数字员工管理侧栏 */
    digitalEmployeePanelVisible: false,
    // DeerFlow 对话面板是否打开
    deerflowThreadPanelOpen: false,
  }),

  getters: {
    isRightPanelOpen: (state) => state.rightPanelMode !== null,
    isFilePanelOpen: (state) => state.rightPanelMode === 'file',
    isAgentPanelOpen: (state) => state.rightPanelMode === 'agent',
    isGroupRosterOpen: (state) => state.groupRosterTab !== null,
    /** 命令行模式终端处于前台（用于侧栏高亮、主区遮罩） */
    anyCliForeground: (state) => state.claudeCodeActive,
    /**
     * 文件面板显示模式（基于窗口宽度扣除侧边栏后的可用宽度）：
     * 'normal'   可用宽度 >= 侧边栏+对话框300px+预览区300px+文件树260px：文件树与预览并排
     * 'dropdown' 可用宽度 < 侧边栏+对话框300px+预览区300px+文件树260px：文件树收进预览区下拉框
     */
    filePanelDisplayMode: (state) => {
      // const sidebarWidth = state.navRailVisible
      //   ? (state.sidebarExpanded ? 312 : 80)
      //   : 0
      // const availableWidth = state.windowWidth - sidebarWidth
      // const minChatWidth = 300
      // const minPreviewWidth = 300
      // const minTreeWidth = 260

      // // dropdown: 空间不足时用下拉框而非悬浮覆盖
      // if (availableWidth < minChatWidth + minPreviewWidth + minTreeWidth) return 'dropdown'
      // normal: 都能放下
      return 'normal'
    },
    shouldAutoCollapseNav: (state) => state.windowWidth <= 960,
    hasExpandedSidebar: (state) =>
      state.sidebarExpanded && (
        ['solo-team', 'market'].includes(state.activePrimaryNav)
        || isCollaborationNavKey(state.activePrimaryNav)
      ),
    isToolFileTabActive: (state) => state.activeToolTab === 'file',
    isToolTaskTabActive: (state) => state.activeToolTab === 'task',
    isToolPersonaTabActive: (state) => state.activeToolTab === 'persona',
    isToolDigitalEmployeeTabActive: (state) => state.activeToolTab === 'digitalEmployee',
    isDeerflowThreadPanelOpen: (state) => state.deerflowThreadPanelOpen,
    isGlobalFileTabActive: (state) => state.activeFileTab === 'global',
  },

  actions: {
    setWindowWidth(w) {
      this.windowWidth = w

      const panelOpen = this.notificationPanelOpen || this.groupRosterTab !== null

      if (panelOpen) {
        if (w >= 960 && w < 1200) {
          // 960-1200px：收起二级导航和文件树，保留一级导航入口
          if (this.globalFilePreviewActive && (this.sidebarExpanded || !this.fileTreeCollapsed)) {
            this.collapseFileTree()
            this.collapseSidebar()
          }
          if (this.sidebarExpanded || !this.navRailVisible) {
            this.showPrimaryNavOnly()
          }
        } else if (w >= 1200) {
          // >= 1200px：仅对通知面板做自动展开，group-roster 保持原状态
          if (this.notificationPanelOpen) {
            if (!this.navRailVisible) {
              this.showNavRail()
            }
            // 移除自动展开文件树逻辑（与通知面板互斥）
          }
        }
      }
    },
    toggleRightPanel(mode) {
      if (this.rightPanelMode === mode) {
        this.rightPanelMode = null
      } else {
        this.rightPanelMode = mode
      }
    },

    toggleGlobalFilePanel() {
      if (!this.globalFilePanelVisible) {
        this.globalFilePanelVisible = true
        this.fileTreeCollapsed = false
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      } else {
        this.fileTreeCollapsed = !this.fileTreeCollapsed
        if (!this.fileTreeCollapsed && this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      }
    },

    closeGlobalFilePanel() {
      this.globalFilePanelVisible = false
      this.toolFileContentVisible = false
      this.activeToolTab = null
    },

    closeRightPanel() {
      this.rightPanelMode = null
    },

    closeDigitalEmployeePanel() {
      this.digitalEmployeePanelVisible = false
      if (this.activeToolTab === 'digitalEmployee') {
        this.activeToolTab = null
      }
    },

    /** 关闭分身管理 / 数字员工管理侧栏，并取消工具栏对应高亮（与切换一级导航行为一致） */
    closePersonaAndDigitalEmployeeSidePanels() {
      this.personaPanelVisible = false
      this.digitalEmployeePanelVisible = false
      if (this.activeToolTab === 'persona' || this.activeToolTab === 'digitalEmployee') {
        this.activeToolTab = null
      }
    },

    /** @param {'human'|'bot'} tab */
    toggleGroupRosterTab(tab) {
      if (this.groupRosterTab === tab) {
        this.groupRosterTab = null
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.showNavRail()
          this.expandFileTree()
        }
        return
      }
      this.groupRosterTab = tab
      if (this.windowWidth >= 960 && this.windowWidth < 1200) {
        if (this.sidebarExpanded || !this.navRailVisible) {
          this.showPrimaryNavOnly()
        }
        this.collapseFileTree()
      }
    },

    closeGroupRosterSidebar() {
      if (this.groupRosterTab === null) return
      this.groupRosterTab = null
      if (this.windowWidth >= 960 && this.windowWidth < 1200) {
        this.showNavRail()
        this.expandFileTree()
      }
    },

    toggleNotificationPanel() {
      this.notificationPanelOpen = !this.notificationPanelOpen

      if (!this.notificationPanelOpen) {
        return
      }

      // 打开消息面板：保持 toolFileContentVisible，但折叠文件树列（通知面板替代文件树显示）
      this.fileTreeCollapsed = true

      // 响应式布局：960-1200px 时收起侧边栏
      if (
        this.windowWidth >= 960 &&
        this.windowWidth < 1200 &&
        (this.sidebarExpanded || !this.fileTreeCollapsed)
      ) {
        this.collapseSidebar()
      }
    },

    closeNotificationPanel() {
      this.notificationPanelOpen = false
    },

    addNotificationLeaveCard(card) {
      const MAX = 50
      const conversationId = card?.conversationId
      if (!conversationId) return
      const nextCard = {
        ...card,
        conversationId,
        conversationName: card.conversationName ?? conversationId,
      }
      if (this.notificationLeaveCards.find((c) => c.conversationId === conversationId)) return
      this.notificationLeaveCards.unshift(nextCard)
      if (this.notificationLeaveCards.length > MAX) {
        this.notificationLeaveCards = this.notificationLeaveCards.slice(0, MAX)
      }
      try {
        localStorage.setItem('notification_leave_cards', JSON.stringify(this.notificationLeaveCards))
      } catch { /* ignore */ }
    },

    clearAllNotificationLeaveCards() {
      this.notificationLeaveCards = []
      try {
        localStorage.removeItem('notification_leave_cards')
      } catch { /* ignore */ }
    },

    setNotificationMentionRead(conversationId, timestamp) {
      if (!conversationId || !Number.isFinite(timestamp) || timestamp <= 0) return
      this.notificationMentionReadAt = {
        ...this.notificationMentionReadAt,
        [conversationId]: timestamp,
      }
      try {
        localStorage.setItem('notification_mention_read_at', JSON.stringify(this.notificationMentionReadAt))
      } catch { /* ignore */ }
    },

    clearNotificationMentionRead(conversationId) {
      if (!conversationId || !this.notificationMentionReadAt[conversationId]) return
      const next = { ...this.notificationMentionReadAt }
      delete next[conversationId]
      this.notificationMentionReadAt = next
      try {
        if (Object.keys(next).length > 0) {
          localStorage.setItem('notification_mention_read_at', JSON.stringify(next))
        } else {
          localStorage.removeItem('notification_mention_read_at')
        }
      } catch { /* ignore */ }
    },

    clearAllNotificationMentionRead() {
      this.notificationMentionReadAt = {}
      try {
        localStorage.removeItem('notification_mention_read_at')
      } catch { /* ignore */ }
    },

    /**
     * 设置聊天模式
     * @param {'solo'|'group'} mode
     */
    setChatMode(mode) {
      this.chatMode = mode
    },

    setActiveNavigation(primaryKey, secondaryKey = undefined) {
      const nextSecondaryNav = secondaryKey !== undefined ? secondaryKey : this.activeSecondaryNav
      // 切换一级导航时，关闭分身管理面板 / 数字员工管理面板
      if (primaryKey !== this.activePrimaryNav) {
        // 离开协作时缓存最后选中的二级 key（切到其他一级后 activeSecondaryNav 会被覆盖）
        if (isCollaborationNavKey(this.activePrimaryNav)) {
          const leaving = this.activeSecondaryNav
          if (leaving != null && leaving !== '') {
            const cacheKey = this.activePrimaryNav === 'collaboration-b'
              ? 'lastCollaborationBSecondaryNav'
              : 'lastCollaborationSecondaryNav'
            this[cacheKey] = leaving
          }
        }
        // 离开一人团队时缓存「我的员工」会话（切到其他一级后 activeSecondaryNav 会被覆盖）
        if (this.activePrimaryNav === 'solo-team') {
          const leaving = this.activeSecondaryNav
          if (typeof leaving === 'string' && leaving.startsWith('employee:')) {
            this.lastSoloTeamEmployeeSecondaryNav = leaving
            try {
              localStorage.setItem('last_solo_team_employee_secondary_nav', leaving)
            } catch { /* ignore */ }
          }
        }
        this.closePersonaAndDigitalEmployeeSidePanels()
      } else if (
        this.digitalEmployeePanelVisible
        && !isDigitalEmployeeManageNav(primaryKey, nextSecondaryNav)
      ) {
        this.closeDigitalEmployeePanel()
      }

      this.activePrimaryNav = primaryKey
      if (secondaryKey !== undefined) {
        this.activeSecondaryNav = secondaryKey
      }

      // 停在一人团队且二级为「我的员工」时始终同步缓存（含仅改 secondary、不经「切换一级」分支的情况）
      if (this.activePrimaryNav === 'solo-team') {
        const sec = this.activeSecondaryNav
        if (typeof sec === 'string' && sec.startsWith('employee:')) {
          this.lastSoloTeamEmployeeSecondaryNav = sec
          try {
            localStorage.setItem('last_solo_team_employee_secondary_nav', sec)
          } catch { /* ignore */ }
        }
      }

      // 停在协作时始终同步缓存最后选中的二级 key（用于其他一级切回时恢复）
      if (isCollaborationNavKey(this.activePrimaryNav)) {
        const sec = this.activeSecondaryNav
        if (typeof sec === 'string' && sec) {
          const cacheKey = this.activePrimaryNav === 'collaboration-b'
            ? 'lastCollaborationBSecondaryNav'
            : 'lastCollaborationSecondaryNav'
          this[cacheKey] = sec
        }
      }

      if (primaryKey !== 'cli') {
        this.lastNonCliPrimaryNav = primaryKey
        this.lastNonCliSecondaryNav = this.activeSecondaryNav
      }
    },

    openClaudeCode() {
      this.closeNotificationPanel()
      this.closeGroupRosterSidebar()
      if (this.activePrimaryNav !== 'cli') {
        this.lastNonCliPrimaryNav = this.activePrimaryNav
        this.lastNonCliSecondaryNav = this.activeSecondaryNav
        // 切换一级导航时，关闭分身管理面板 / 数字员工管理面板
        this.personaPanelVisible = false
        this.digitalEmployeePanelVisible = false
        if (this.activeToolTab === 'persona' || this.activeToolTab === 'digitalEmployee') {
          this.activeToolTab = null
        }
      }
      // 进入 Kode（cli）与切换其他一级菜单一致：收起数字员工 / 分身管理侧栏
      this.closePersonaAndDigitalEmployeeSidePanels()
      this.claudeCodeVisible = true
      this.claudeCodeActive = true
      this.activePrimaryNav = 'cli'
    },

    closeClaudeCode() {
      this.claudeCodeVisible = false
      this.claudeCodeActive = false
      this.restoreLastNavigation()
    },

    // 将终端切到后台：保持组件挂载（终端不销毁），仅隐藏前台覆盖层
    backgroundClaudeCode() {
      this.claudeCodeActive = false
      this.restoreLastNavigation()
    },

    toggleClaudeCode() {
      this.closeNotificationPanel()
      this.closeGroupRosterSidebar()
      if (this.activePrimaryNav !== 'cli') {
        this.lastNonCliPrimaryNav = this.activePrimaryNav
        this.lastNonCliSecondaryNav = this.activeSecondaryNav
        // 切换一级导航时，关闭分身管理面板 / 数字员工管理面板
        this.personaPanelVisible = false
        this.digitalEmployeePanelVisible = false
        if (this.activeToolTab === 'persona' || this.activeToolTab === 'digitalEmployee') {
          this.activeToolTab = null
        }
      }
      this.closePersonaAndDigitalEmployeeSidePanels()
      this.claudeCodeVisible = true
      this.claudeCodeActive = true
      this.activePrimaryNav = 'cli'
    },

    /** 从聊天等入口进入时，收起命令行模式前台态 */
    backgroundAllCli() {
      this.claudeCodeActive = false
      this.restoreLastNavigation()
    },

    toggleSidebar() {
      this.sidebarExpanded = !this.sidebarExpanded

      if (this.sidebarExpanded && this.windowWidth >= 960 && this.windowWidth < 1200) {
        this.groupRosterTab = null
        this.closeToolFileContent()
      }
    },

    expandSidebar() {
      this.sidebarExpanded = true
      if (this.windowWidth >= 960 && this.windowWidth < 1200) {
        this.groupRosterTab = null
      }
    },

    collapseSidebar() {
      this.sidebarExpanded = false
    },

    toggleNavRail() {
      this.navRailVisible = !this.navRailVisible
      if (!this.navRailVisible) {
        this._sidebarExpandedBeforeCollapse = this.sidebarExpanded
        this.sidebarExpanded = false
      } else {
        this.sidebarExpanded = this._sidebarExpandedBeforeCollapse
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      }
    },

    showNavRail() {
      this.navRailVisible = true
      const hasSecondary = ['solo-team', 'market'].includes(this.activePrimaryNav)
        || isCollaborationNavKey(this.activePrimaryNav)
      // 有二级导航时，无论收起前状态如何都强制展开
      this.sidebarExpanded = hasSecondary ? true : this._sidebarExpandedBeforeCollapse
      if (this.windowWidth >= 960 && this.windowWidth < 1200) {
        this.groupRosterTab = null
      }
    },

    showPrimaryNavOnly() {
      if (this.navRailVisible) {
        this._sidebarExpandedBeforeCollapse = this.sidebarExpanded
      }
      this.navRailVisible = true
      this.sidebarExpanded = false
    },

    hideNavRail() {
      this.navRailVisible = false
      this._sidebarExpandedBeforeCollapse = this.sidebarExpanded
      this.sidebarExpanded = false
    },

    restoreLastNavigation() {
      if (this.activePrimaryNav !== 'cli') return
      this.activePrimaryNav = this.lastNonCliPrimaryNav || 'collaboration'
      this.activeSecondaryNav = this.lastNonCliSecondaryNav
      // 从 CLI 恢复时未走 setActiveNavigation，需单独同步「我的员工」缓存
      if (this.activePrimaryNav === 'solo-team') {
        const sec = this.activeSecondaryNav
        if (typeof sec === 'string' && sec.startsWith('employee:')) {
          this.lastSoloTeamEmployeeSecondaryNav = sec
          try {
            localStorage.setItem('last_solo_team_employee_secondary_nav', sec)
          } catch { /* ignore */ }
        }
      }
    },

    /**
     * 从消息附件触发文件预览，直接打开文件面板并展示该文件
     * @param {{ id, name, type, httpUrl, size, mimeType }} file
     */
    openFilePreview(file) {
      this.pendingPreviewFile = { ...file }
      this.toolFileContentVisible = true
      this.globalFilePanelVisible = true
      this.rightPanelMode = 'file'
    },

    setImConnecting(val) {
      this.imConnecting = val
    },

    setImReady(val) {
      this.imReady = val
    },

    /** @param {boolean} val 对应接口 authorized */
    setActivated(val) {
      this.isActivated = val
    },

    setAuthorizationResolved(val) {
      this.authorizationResolved = val
    },

    // 工具区 actions
    setActiveToolTab(tab) {
      // 打开文件 / 任务 / 待办时关闭消息面板
      if (tab === 'file' || tab === 'task' || tab === 'todo') {
        this.closeNotificationPanel()
      }

      // 打开分身管理时关闭消息面板（但不关闭文件面板）
      if (tab === 'persona') {
        this.closeNotificationPanel()
        this.digitalEmployeePanelVisible = false
      }

      // 打开数字员工管理时关闭消息面板，并与分身面板互斥
      if (tab === 'digitalEmployee') {
        this.closeNotificationPanel()
        this.personaPanelVisible = false
      }

      // 文件再点 = 收起（新文件库不再有文件树折叠逻辑）
      if (this.activeToolTab === tab && tab === 'file') {
        this.activeToolTab = null
        this.toolFileContentVisible = false
        this.globalFilePanelVisible = false
        return
      }

      if (this.activeToolTab === tab && (tab === 'task' || tab === 'todo')) {
        this.activeToolTab = null
        return
      }

      // 处理分身管理面板切换
      if (this.activeToolTab === tab && tab === 'persona') {
        this.personaPanelVisible = !this.personaPanelVisible
        if (this.personaPanelVisible && this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
        return
      }

      // 处理数字员工管理面板切换（与分身一致：再次点击可收起）
      if (this.activeToolTab === tab && tab === 'digitalEmployee') {
        this.digitalEmployeePanelVisible = !this.digitalEmployeePanelVisible
        if (this.digitalEmployeePanelVisible && this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
        return
      }

      this.activeToolTab = tab
      // 互斥：切到非文件 tab 时收起文件库（文件走 toolFileContentVisible 独立标志，需手动重置）
      if (tab !== 'file') {
        this.toolFileContentVisible = false
        this.globalFilePanelVisible = false
      }
      if (tab === 'file') {
        this.personaPanelVisible = false
        this.digitalEmployeePanelVisible = false
        this.toolFileContentVisible = true
        this.globalFilePanelVisible = true
        this.fileTreeCollapsed = false
        // 首次打开文件标签时触发刷新
        this.fileTabClickSerial++
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      } else if (tab === 'task') {
        this.personaPanelVisible = false
        this.digitalEmployeePanelVisible = false
        this.toolFileContentVisible = false
        this.fileTreeCollapsed = true
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      } else if (tab === 'persona') {
        this.personaPanelVisible = true
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      } else if (tab === 'digitalEmployee') {
        this.digitalEmployeePanelVisible = true
        if (this.windowWidth >= 960 && this.windowWidth < 1200) {
          this.groupRosterTab = null
        }
      }
    },
    closeToolFileContent() {
      this.toolFileContentVisible = false
      this.globalFilePanelVisible = false
      // activeToolTab 保持不变，tabs 仍高亮
    },

    collapseFileTree() {
      this.fileTreeCollapsed = true
      // 只收起文件树列（file-tree-col），不关闭预览面板
    },

    expandFileTree() {
      this.fileTreeCollapsed = false
    },

    // 从终端打开文件：展开文件树并定位到指定路径
    openFileInTree(filePath) {
      // 确保文件面板打开
      this.activeToolTab = 'file'
      this.toolFileContentVisible = true
      this.globalFilePanelVisible = true

      // 触发文件树展开事件（通过自定义事件）
      window.dispatchEvent(new CustomEvent('reveal-file-in-tree', { detail: { filePath } }))
    },

    toggleDeerflowThreadPanel() {
      this.deerflowThreadPanelOpen = !this.deerflowThreadPanelOpen
    },

    closeDeerflowThreadPanel() {
      this.deerflowThreadPanelOpen = false
    },

    setFileTab(tab) {
      this.activeFileTab = tab
    },

    toggleShowHiddenFiles() {
      this.showHiddenFiles = !this.showHiddenFiles
      localStorage.setItem('file-panel-show-hidden', String(this.showHiddenFiles))
    },
  }
})
