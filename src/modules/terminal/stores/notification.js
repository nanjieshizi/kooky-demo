import { defineStore } from 'pinia'
import { playNotificationSound } from '../utils/notificationSound.js'

let _notifSeq = 0
const NOTIFICATION_SOUND_STORAGE_KEY = 'kc-notification-sound-enabled'

function genNotifId() {
  return `notif_${Date.now()}_${++_notifSeq}`
}

// cooldown 限流：cooldownKey → 上次通知时间戳
const _cooldownMap = new Map()
const DEFAULT_COOLDOWN_MS = 5000

function loadSoundEnabledPreference() {
  if (typeof localStorage === 'undefined') return true
  try {
    const stored = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY)
    if (stored == null) return true
    return stored !== 'false'
  } catch (_error) {
    return true
  }
}

function persistSoundEnabledPreference(value) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, value ? 'true' : 'false')
  } catch (_error) {
    // ignore storage failures and keep in-memory preference usable
  }
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    soundEnabled: loadSoundEnabledPreference(),
    focusedTarget: {
      windowId: null,
      workspaceId: null,
      paneId: null,
      surfaceId: null,
    },
    // cmux 对齐：聚焦 pane 收到通知时的"刚来过"标记，panelId → timestamp
    // 独立于 unread，仅影响 pane ring 显示，不进入 workbench/project 角标计数
    focusedReadIndicators: {},
    workbenchStatus: {},
    workbenchProgress: {},
    workbenchLogs: {},
    /** 终端模块右侧「通知中心」抽屉是否打开（由 ProjectDropdown / ClaudeCodeView 共用） */
    notificationCenterOpen: false,
  }),

  getters: {
    allUnread: (state) => {
      return state.notifications.filter(n => !n.read)
    },
    unreadCount: (state) => {
      return state.notifications.filter(n => !n.read).length
    },
    unreadByProject: (state) => (projectId) => {
      return state.notifications.filter(n => !n.read && n.projectId === projectId).length
    },
    projectHasUnread: (state) => (projectId) => {
      return state.notifications.some(n => !n.read && n.projectId === projectId)
    },
    unreadByWorkbench: (state) => (workbenchId) => {
      return state.notifications.filter(n => !n.read && n.workbenchId === workbenchId).length
    },
    workbenchHasUnread: (state) => (workbenchId) => {
      return state.notifications.some(n => !n.read && n.workbenchId === workbenchId)
    },
    panelHasNotification: (state) => (panelId) => {
      return state.notifications.some(n => !n.read && n.panelId === panelId)
    },
    // cmux 对齐：蓝环显示条件 — 真正未读 OR focused-read indicator
    panelHasVisibleIndicator: (state) => (panelId) => {
      const hasUnread = state.notifications.some(n => !n.read && n.panelId === panelId)
      const hasIndicator = !!state.focusedReadIndicators[panelId]
      return hasUnread || hasIndicator
    },
    notificationsByProject: (state) => (projectId) => {
      return state.notifications.filter(n => n.projectId === projectId)
    },
    notificationsByWorkspace: (state) => (workspaceId) => {
      return state.notifications.filter(n => n.workspaceId === workspaceId)
    },
  },

  actions: {
    _normalizeNotificationPayload(payload = {}) {
      const target = payload.target && typeof payload.target === 'object'
        ? { ...payload.target }
        : {}
      const windowId = payload.windowId ?? target.windowId ?? target.window_id ?? null
      const projectId = payload.projectId ?? target.projectId ?? target.project_id ?? null
      const workbenchId = payload.workbenchId ?? target.workbenchId ?? target.workbench_id ?? null
      const workspaceId = payload.workspaceId ?? target.workspaceId ?? target.workspace_id ?? null
      const paneId = payload.paneId ?? payload.panelId ?? target.paneId ?? target.pane_id ?? null
      const surfaceId = payload.surfaceId ?? target.surfaceId ?? target.surface_id ?? null
      const suppressed = Boolean(payload.suppressed)

      return {
        id: genNotifId(),
        windowId,
        projectId,
        workbenchId,
        workspaceId,
        paneId,
        panelId: paneId,
        surfaceId,
        target: {
          windowId,
          projectId,
          workbenchId,
          workspaceId,
          paneId,
          surfaceId,
          kind: payload.targetKind ?? target.kind ?? null,
        },
        type: payload.type ?? 'info',
        title: payload.title ?? '',
        subtitle: payload.subtitle ?? '',
        content: payload.content ?? payload.body ?? '',
        teamId: payload.teamId ?? null,
        teamRole: payload.teamRole ?? null,
        teamLabel: typeof payload.teamLabel === 'string' ? payload.teamLabel.trim() : '',
        teamStatus: payload.teamStatus ?? null,
        statusTone: payload.statusTone ?? null,
        statusLabel: payload.statusLabel ?? '',
        roleLabel: payload.roleLabel ?? '',
        cooldownKey: payload.cooldownKey ?? null,
        timestamp: Date.now(),
        read: suppressed || Boolean(payload.read),
        suppressed,
        sound: payload.sound !== false,
      }
    },

    _ensureWorkbenchStatusBucket(workbenchId) {
      if (!workbenchId) return null
      if (!this.workbenchStatus[workbenchId]) {
        this.workbenchStatus[workbenchId] = {}
      }
      return this.workbenchStatus[workbenchId]
    },

    _ensureWorkbenchLogBucket(workbenchId) {
      if (!workbenchId) return null
      if (!Array.isArray(this.workbenchLogs[workbenchId])) {
        this.workbenchLogs[workbenchId] = []
      }
      return this.workbenchLogs[workbenchId]
    },

    /**
     * 推送通知（cmux 风格：同面板新通知替换旧的未读通知）
     */
    push(payload = {}) {
      const {
        projectId,
        workbenchId,
        panelId,
        type,
        title,
        content,
        sound = true,
        isFocusedPanel = false,
        ...rest
      } = payload

      this.createNotification({
        projectId,
        workbenchId,
        paneId: panelId,
        type,
        title,
        content,
        sound,
        isFocusedPanel,
        ...rest,
      })
    },

    createNotification(payload = {}) {
      const notification = this._normalizeNotificationPayload(payload)

      // cooldown 限流：相同 cooldownKey 在间隔内不重复推送
      if (notification.cooldownKey) {
        const cooldownMs = payload.cooldownInterval ?? DEFAULT_COOLDOWN_MS
        const lastTime = _cooldownMap.get(notification.cooldownKey) ?? 0
        if (Date.now() - lastTime < cooldownMs) {
          return null
        }
        _cooldownMap.set(notification.cooldownKey, Date.now())
      }

      // cmux 对齐：聚焦 pane 收到通知 → 立即标记 read，但记录 focused-read indicator
      // 这样不会进入 workbench/project 角标计数，但 pane ring 仍会亮
      if (payload.isFocusedPanel) {
        notification.read = true
        if (notification.panelId) {
          this.focusedReadIndicators[notification.panelId] = Date.now()
        }
      }

      // cmux 行为：同 target 的最新未读通知覆盖旧未读
      if (notification.surfaceId || notification.panelId) {
        this.notifications
          .filter((entry) => !entry.read && (
            (notification.surfaceId && entry.surfaceId === notification.surfaceId) ||
            (notification.panelId && entry.panelId === notification.panelId)
          ))
          .forEach((entry) => { entry.read = true })
      }

      this.notifications.push(notification)
      if (!notification.suppressed && notification.sound && this.soundEnabled) {
        playNotificationSound()
      }
      return notification
    },

    /**
     * cmux 对齐：用户交互（点击/聚焦）清除 pane 的 indicator
     * 同时标记该 pane 所有未读为已读，并移除该 pane 的所有通知
     */
    dismissPanelIndicator(panelId) {
      if (!panelId) return
      // 移除该面板的所有通知（包括已读和未读）
      this.notifications = this.notifications.filter(n => n.panelId !== panelId)
      delete this.focusedReadIndicators[panelId]
    },

    _matchesFilters(notification, filters = {}) {
      if (filters.windowId && notification.windowId !== filters.windowId) return false
      if (filters.projectId && notification.projectId !== filters.projectId) return false
      if (filters.workbenchId && notification.workbenchId !== filters.workbenchId) return false
      if (filters.workspaceId && notification.workspaceId !== filters.workspaceId) return false
      if (filters.paneId && notification.paneId !== filters.paneId) return false
      if (filters.panelId && notification.panelId !== filters.panelId) return false
      if (filters.surfaceId && notification.surfaceId !== filters.surfaceId) return false
      if (filters.read === true && !notification.read) return false
      if (filters.read === false && notification.read) return false
      return true
    },

    _clearFocusedIndicators(panelIds = []) {
      panelIds.forEach((panelId) => {
        if (panelId) delete this.focusedReadIndicators[panelId]
      })
    },

    listNotifications(filters = {}) {
      return this.notifications.filter((notification) => {
        return this._matchesFilters(notification, filters)
      })
    },

    clearNotifications(filters = {}) {
      if (!filters || Object.keys(filters).length === 0) {
        const cleared = this.notifications.length
        this.notifications = []
        this.focusedReadIndicators = {}
        return cleared
      }

      const before = this.notifications.length
      const removedPanelIds = new Set()
      this.notifications = this.notifications.filter((notification) => {
        if (!this._matchesFilters(notification, filters)) return true
        if (notification.panelId) removedPanelIds.add(notification.panelId)
        if (notification.paneId) removedPanelIds.add(notification.paneId)
        return false
      })
      this._clearFocusedIndicators(removedPanelIds)
      return before - this.notifications.length
    },

    clearPanelNotifications(panelId, options = {}) {
      if (!panelId) return 0
      const before = this.notifications.length
      const surfaceId = options.surfaceId ?? null
      this.notifications = this.notifications.filter((notification) => {
        const matchedPanel = notification.panelId === panelId || notification.paneId === panelId
        const matchedSurface = surfaceId && notification.surfaceId === surfaceId
        return !(matchedPanel || matchedSurface)
      })
      this._clearFocusedIndicators([panelId])
      return before - this.notifications.length
    },

    markRead(notifId) {
      const n = this.notifications.find(n => n.id === notifId)
      if (n) n.read = true
    },

    removeOne(notifId) {
      const idx = this.notifications.findIndex(n => n.id === notifId)
      if (idx !== -1) {
        this.notifications[idx].read = true
        this.notifications.splice(idx, 1)
      }
    },

    markUnread(notifId) {
      const n = this.notifications.find(n => n.id === notifId)
      if (n) n.read = false
    },

    markPanelRead(panelId) {
      this.notifications
        .filter(n => !n.read && n.panelId === panelId)
        .forEach(n => { n.read = true })
    },

    markTargetRead(target = {}) {
      this.notifications
        .filter((notification) => !notification.read)
        .forEach((notification) => {
          if (target.surfaceId && notification.surfaceId === target.surfaceId) {
            notification.read = true
            return
          }
          if (target.paneId && notification.paneId === target.paneId) {
            notification.read = true
            return
          }
          if (target.workspaceId && notification.workspaceId === target.workspaceId) {
            notification.read = true
            return
          }
          if (target.windowId && notification.windowId === target.windowId) {
            notification.read = true
          }
        })
    },

    setFocusedTarget(target = {}) {
      this.focusedTarget = {
        windowId: target.windowId ?? null,
        workspaceId: target.workspaceId ?? null,
        paneId: target.paneId ?? null,
        surfaceId: target.surfaceId ?? null,
      }
    },

    syncNotificationsForFocusedWindow(windowId) {
      this.setFocusedTarget({ ...this.focusedTarget, windowId })
      this.markTargetRead({ windowId })
    },

    syncNotificationsForFocusedWorkspace(workspaceId) {
      this.setFocusedTarget({ ...this.focusedTarget, workspaceId })
      this.markTargetRead({ workspaceId })
    },

    syncNotificationsForFocusedSurface(surfaceId, paneId = null, workspaceId = null) {
      this.setFocusedTarget({
        ...this.focusedTarget,
        surfaceId,
        ...(paneId ? { paneId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      })
      this.markTargetRead({
        surfaceId,
        ...(paneId ? { paneId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      })
    },

    markAllRead(scope, id) {
      let targets
      if (scope === 'all') {
        targets = this.notifications.filter(n => !n.read)
      } else if (scope === 'project') {
        targets = this.notifications.filter(n => !n.read && n.projectId === id)
      } else if (scope === 'workbench') {
        targets = this.notifications.filter(n => !n.read && n.workbenchId === id)
      } else if (scope === 'workspace') {
        targets = this.notifications.filter(n => !n.read && n.workspaceId === id)
      }
      targets?.forEach(n => { n.read = true })
    },

    clearAllAfterRead() {
      this.markAllRead('all')
      this.notifications = []
    },

    clearAll() {
      this.notifications = []
    },

    setStatus(workbenchId, key, value) {
      if (!workbenchId || !key) return null
      const bucket = this._ensureWorkbenchStatusBucket(workbenchId)
      bucket[key] = {
        key,
        value,
        updatedAt: Date.now(),
      }
      return bucket[key]
    },

    clearStatus(workbenchId, key) {
      const bucket = this.workbenchStatus[workbenchId]
      if (!bucket) return false
      if (key) {
        delete bucket[key]
      } else {
        delete this.workbenchStatus[workbenchId]
      }
      return true
    },

    listStatus(workbenchId) {
      const bucket = this.workbenchStatus[workbenchId]
      return bucket ? Object.values(bucket) : []
    },

    setProgress(workbenchId, progress, label = '') {
      if (!workbenchId) return null
      this.workbenchProgress[workbenchId] = {
        progress,
        label,
        updatedAt: Date.now(),
      }
      return this.workbenchProgress[workbenchId]
    },

    clearProgress(workbenchId) {
      if (!workbenchId) return false
      delete this.workbenchProgress[workbenchId]
      return true
    },

    appendLog(workbenchId, level, message) {
      if (!workbenchId || !message) return null
      const bucket = this._ensureWorkbenchLogBucket(workbenchId)
      const entry = {
        id: genNotifId(),
        level: level ?? 'info',
        message,
        timestamp: Date.now(),
      }
      bucket.push(entry)
      return entry
    },

    listLog(workbenchId, { limit } = {}) {
      const bucket = Array.isArray(this.workbenchLogs[workbenchId]) ? this.workbenchLogs[workbenchId] : []
      if (!limit || limit <= 0) {
        return bucket.slice()
      }
      return bucket.slice(-limit)
    },

    clearLog(workbenchId) {
      if (!workbenchId) return false
      delete this.workbenchLogs[workbenchId]
      return true
    },

    getSidebarState(workbenchId) {
      const statusItems = this.listStatus(workbenchId)
      const progress = this.workbenchProgress[workbenchId] ?? null
      const recentLogs = this.listLog(workbenchId, { limit: 5 })
      return {
        status_count: statusItems.length,
        status_items: statusItems,
        progress: progress?.progress ?? null,
        progress_label: progress?.label ?? '',
        log_count: Array.isArray(this.workbenchLogs[workbenchId]) ? this.workbenchLogs[workbenchId].length : 0,
        recent_logs: recentLogs,
      }
    },

    setSoundEnabled(val) {
      this.soundEnabled = val
      persistSoundEnabledPreference(val)
    },

    setNotificationCenterOpen(open) {
      this.notificationCenterOpen = Boolean(open)
    },

    toggleNotificationCenter() {
      this.notificationCenterOpen = !this.notificationCenterOpen
    },
  },
})
