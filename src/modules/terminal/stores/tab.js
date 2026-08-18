// src/stores/tab.js
// Tab 层：Project → Workbench → Tab → Panel
// 每个 Tab 持有独立的 splitLayout manager，对齐 cmux 的 Workspace/BonsplitController 模型
import { defineStore } from 'pinia'
import { useSplitLayout } from '../components/split-layout/useSplitLayout'
import { useNotificationStore } from './notification'

let _tabSeq = 0
function genTabId() {
  return `tab_${Date.now()}_${++_tabSeq}`
}

function cloneSerializable(value) {
  if (value == null) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function appendMetadataEvent(event) {
  try {
    const append = typeof window !== 'undefined'
      ? window.electronAPI?.session?.appendMetadataEvent
      : null
    if (typeof append === 'function') {
      Promise.resolve(append(event)).catch((error) => {
        console.warn('[tabStore] appendMetadataEvent failed:', error?.message || error)
      })
    }
  } catch (error) {
    console.warn('[tabStore] appendMetadataEvent threw:', error?.message || error)
  }
}

function findFirstLeafId(node) {
  if (!node) return null
  if (node.type === 'leaf') return node.id ?? null
  if (node.type === 'split' && Array.isArray(node.children)) {
    for (const child of node.children) {
      const leafId = findFirstLeafId(child)
      if (leafId) {
        return leafId
      }
    }
  }
  return null
}

// 模块级变量，不放入 Pinia state。
// 原因：useSplitLayout 返回的对象含 ref（layoutRoot, activeLeafId），
// 若放入 Pinia state（reactive），Vue 会自动解包 ref，
// 导致 mgr.layoutRoot.value 变为 undefined。
const _managers = {}

export const useTabStore = defineStore('tab', {
  state: () => ({
    tabs: {},
  }),

  getters: {
    tabList: (state) => Object.values(state.tabs),

    tabsByWorkbench: (state) => (workbenchId) => {
      return Object.values(state.tabs).filter(t => t.workbenchId === workbenchId)
    },

    getTab: (state) => (tabId) => {
      return state.tabs[tabId] ?? null
    },

    // 工作台内同名标签页校验（只检查 pinned 用户命名，auto title 不参与）
    isNameTaken: (state) => (workbenchId, name, excludeId = null) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return false
      return Object.values(state.tabs).some(t =>
        t.workbenchId === workbenchId &&
        t.id !== excludeId &&
        t.titlePinned &&
        (t.name || '').trim() === trimmed
      )
    },

    // 生成工作台下不重名的默认标签名：`${prefix} N`
    pickAvailableDefaultName: (state) => (workbenchId, prefix = '新标签') => {
      const existing = new Set(
        Object.values(state.tabs)
          .filter(t => t.workbenchId === workbenchId && t.titlePinned)
          .map(t => (t.name || '').trim())
      )
      for (let n = 1; n < 10000; n++) {
        const candidate = `${prefix} ${n}`
        if (!existing.has(candidate)) return candidate
      }
      return `${prefix} ${Date.now()}`
    },
  },

  actions: {
    addTab(workbenchId, name, options = {}) {
      const explicitId = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : null
      const id = explicitId || genTabId()
      const mgr = useSplitLayout()
      if (options.layoutRoot) {
        mgr.layoutRoot.value = cloneSerializable(options.layoutRoot)
      }
      const activeLeafId = options.activeLeafId ?? findFirstLeafId(mgr.layoutRoot.value)
      if (activeLeafId) {
        mgr.activeLeafId.value = activeLeafId
      }
      _managers[id] = mgr
      this.tabs[id] = {
        id,
        workbenchId,
        name: name || '',
        titlePinned: Boolean(options.titlePinned),
      }
      appendMetadataEvent({
        type: 'tab-created',
        payload: {
          tabId: id,
          workbenchId,
          title: this.tabs[id].name,
          titlePinned: this.tabs[id].titlePinned,
        },
      })
      return id
    },

    renameTab(id, name, options = {}) {
      const tab = this.tabs[id]
      if (!tab) return false
      const nextName = typeof name === 'string' ? name.trim() : ''
      // 重名校验（只对 pinned 生效 — 自动派生标题不参与校验）
      if (nextName && options.titlePinned && this.isNameTaken(tab.workbenchId, nextName, id)) {
        return false
      }
      tab.name = nextName
      if (Object.prototype.hasOwnProperty.call(options, 'titlePinned')) {
        tab.titlePinned = Boolean(options.titlePinned)
      }
      appendMetadataEvent({
        type: 'tab-renamed',
        payload: {
          tabId: id,
          workbenchId: tab.workbenchId,
          title: tab.name,
          titlePinned: tab.titlePinned,
        },
      })
      return true
    },

    removeTab(id) {
      const tab = this.tabs[id]
      const notificationStore = useNotificationStore()
      notificationStore.clearNotifications({ workspaceId: id })
      if (tab) {
        appendMetadataEvent({
          type: 'tab-removed',
          payload: {
            tabId: id,
            workbenchId: tab.workbenchId,
          },
        })
      }
      delete this.tabs[id]
      delete _managers[id]
    },

    getManager(tabId) {
      return _managers[tabId] ?? null
    },

    snapshotLayouts() {
      for (const [tabId, mgr] of Object.entries(_managers)) {
        const tab = this.tabs[tabId]
        if (tab && mgr.layoutRoot.value) {
          tab.layoutRoot = JSON.parse(JSON.stringify(mgr.layoutRoot.value))
          tab.activeLeafId = mgr.activeLeafId.value
        }
      }
    },

    loadTabs(tabsObj) {
      this.tabs = tabsObj
      for (const [tabId, tab] of Object.entries(tabsObj)) {
        const mgr = useSplitLayout()
        if (tab.layoutRoot) {
          mgr.layoutRoot.value = cloneSerializable(tab.layoutRoot)
          mgr.activeLeafId.value = tab.activeLeafId
        }
        _managers[tabId] = mgr
      }
    },

    exportTabs() {
      this.snapshotLayouts()
      const data = {}
      for (const [id, tab] of Object.entries(this.tabs)) {
        data[id] = { ...tab }
      }
      return data
    },

    /** 清空所有 tab 及其 layout manager（用于登出时重置） */
    resetAll() {
      for (const id of Object.keys(_managers)) {
        delete _managers[id]
      }
      this.tabs = {}
    },
  },
})
