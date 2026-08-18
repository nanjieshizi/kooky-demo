import { defineStore } from 'pinia'
import { useNotificationStore } from './notification'

let _wbSeq = 0
function genWorkbenchId() {
  return `wb_${Date.now()}_${++_wbSeq}`
}

function appendMetadataEvent(event) {
  try {
    const append = typeof window !== 'undefined'
      ? window.electronAPI?.session?.appendMetadataEvent
      : null
    if (typeof append === 'function') {
      Promise.resolve(append(event)).catch(() => {})
    }
  } catch {}
}

function appendTabOrderEvent(workbench) {
  if (!workbench?.id) return
  appendMetadataEvent({
    type: 'workbench-tab-order-updated',
    payload: {
      workbenchId: workbench.id,
      tabIds: Array.isArray(workbench.tabIds) ? [...workbench.tabIds] : [],
    },
  })
}

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    workbenches: {},
    activeWorkbenchId: null,
  }),

  getters: {
    activeWorkbench: (state) => {
      return state.workbenches[state.activeWorkbenchId] ?? null
    },
    workbenchesByProject: (state) => (projectId) => {
      return Object.values(state.workbenches).filter(wb => wb.projectId === projectId)
    },
    getWorkbench: (state) => (id) => {
      return state.workbenches[id] ?? null
    },
    findWorkbenchByName: (state) => (projectId, name) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return null
      return Object.values(state.workbenches).find((wb) =>
        wb.projectId === projectId &&
        (wb.name || '').trim() === trimmed
      ) ?? null
    },
    // 检查项目下是否已存在同名工作台（excludeId 用于重命名时跳过自己）
    isNameTaken: (state) => (projectId, name, excludeId = null) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return false
      return Object.values(state.workbenches).some(wb =>
        wb.projectId === projectId &&
        wb.id !== excludeId &&
        (wb.name || '').trim() === trimmed
      )
    },
    // 生成项目下不重名的默认名称：`新事项`、`新事项 2`、`新事项 3`...
    pickAvailableDefaultName: (state) => (projectId, prefix = '新事项') => {
      const existing = new Set(
        Object.values(state.workbenches)
          .filter(wb => wb.projectId === projectId)
          .map(wb => (wb.name || '').trim())
      )
      if (!existing.has(prefix)) {
        return prefix
      }
      for (let n = 2; n < 10000; n++) {
        const candidate = `${prefix} ${n}`
        if (!existing.has(candidate)) return candidate
      }
      return `${prefix} ${Date.now()}`
    },
  },

  actions: {
    addWorkbench(projectId, name, options = {}) {
      const explicitId = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : null
      const id = explicitId || genWorkbenchId()
      this.workbenches[id] = {
        id,
        projectId,
        name,
        tabIds: [],
        activeTabId: null,
      }
      appendMetadataEvent({
        type: 'workbench-created',
        payload: {
          workbenchId: id,
          ...this.workbenches[id],
        },
      })
      return id
    },

    removeWorkbench(id) {
      const workbench = this.workbenches[id]
      const notificationStore = useNotificationStore()
      notificationStore.clearNotifications({ workbenchId: id })
      if (workbench) {
        appendMetadataEvent({
          type: 'workbench-removed',
          payload: {
            workbenchId: id,
            projectId: workbench.projectId,
          },
        })
      }
      if (this.activeWorkbenchId === id) {
        const remainingIds = Object.keys(this.workbenches).filter((workbenchId) => workbenchId !== id)
        this.activeWorkbenchId = remainingIds[0] ?? null
      }
      delete this.workbenches[id]
    },

    switchWorkbench(id) {
      if (this.workbenches[id]) {
        this.activeWorkbenchId = id
        appendMetadataEvent({
          type: 'workbench-activated',
          payload: {
            projectId: this.workbenches[id].projectId,
            workbenchId: id,
          },
        })
      }
    },

    renameWorkbench(id, name) {
      const wb = this.workbenches[id]
      const nextName = typeof name === 'string' ? name.trim() : ''
      if (!wb || !nextName) return false
      // 重名校验：同项目内不允许重名（排除自己）
      if (this.isNameTaken(wb.projectId, nextName, id)) return false

      wb.name = nextName
      appendMetadataEvent({
        type: 'workbench-updated',
        payload: {
          workbenchId: id,
          projectId: wb.projectId,
          name: nextName,
        },
      })
      return true
    },

    addTabToWorkbench(wbId, tabId) {
      const wb = this.workbenches[wbId]
      if (wb) {
        wb.tabIds.push(tabId)
        if (!wb.activeTabId) {
          wb.activeTabId = tabId
        }
        appendTabOrderEvent(wb)
      }
    },

    removeTabFromWorkbench(wbId, tabId) {
      const wb = this.workbenches[wbId]
      if (!wb) return
      const idx = wb.tabIds.indexOf(tabId)
      if (idx !== -1) wb.tabIds.splice(idx, 1)
      if (wb.activeTabId === tabId) {
        wb.activeTabId = wb.tabIds[0] ?? null
      }
      appendTabOrderEvent(wb)
    },

    switchTab(wbId, tabId) {
      const wb = this.workbenches[wbId]
      if (wb && wb.tabIds.includes(tabId)) {
        wb.activeTabId = tabId
        appendMetadataEvent({
          type: 'tab-activated',
          payload: {
            workbenchId: wbId,
            tabId,
          },
        })
      }
    },

    loadWorkbenches(workbenchesObj) {
      this.workbenches = workbenchesObj
    },

    exportWorkbenches() {
      const data = {}
      for (const [id, wb] of Object.entries(this.workbenches)) {
        data[id] = { ...wb }
      }
      return data
    },
  },
})
