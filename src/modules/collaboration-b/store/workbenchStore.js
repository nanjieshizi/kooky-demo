import { defineStore } from 'pinia'

const DEFAULT_TAB = 'project'
const VALID_TABS = new Set(['project', 'board', 'tasks', 'files'])
const VALID_PROJECT_TABS = new Set(['project', 'board', 'tasks'])

function keyOf(conversationId) {
  return conversationId == null ? '' : String(conversationId)
}

export const useCollaborationBWorkbenchStore = defineStore('collaborationBWorkbench', {
  state: () => ({
    expandedByConversation: {},
    initializedByConversation: {},
    manuallyCollapsedByConversation: {},
    activeTabByConversation: {},
    lastProjectTabByConversation: {},
    widthByConversation: {},
    previewRequestByConversation: {},
    previewSerial: 0,
    taskRevealRequestByConversation: {},
    taskRevealSerial: 0,
  }),

  getters: {
    isExpanded: (state) => (conversationId) => (
      !!state.expandedByConversation[keyOf(conversationId)]
    ),
    activeTab: (state) => (conversationId) => (
      state.activeTabByConversation[keyOf(conversationId)] || DEFAULT_TAB
    ),
    lastProjectTab: (state) => (conversationId) => (
      state.lastProjectTabByConversation[keyOf(conversationId)] || DEFAULT_TAB
    ),
    width: (state) => (conversationId) => (
      Number(state.widthByConversation[keyOf(conversationId)]) || 0
    ),
    previewRequest: (state) => (conversationId) => (
      state.previewRequestByConversation[keyOf(conversationId)] || null
    ),
    taskRevealRequest: (state) => (conversationId) => (
      state.taskRevealRequestByConversation[keyOf(conversationId)] || null
    ),
  },

  actions: {
    ensure(conversationId, { hasCollaborationData = false, preferredTab = DEFAULT_TAB } = {}) {
      const key = keyOf(conversationId)
      if (!key || this.initializedByConversation[key]) return
      this.initializedByConversation[key] = true
      const initialTab = VALID_TABS.has(preferredTab) ? preferredTab : DEFAULT_TAB
      this.activeTabByConversation[key] = initialTab
      if (VALID_PROJECT_TABS.has(initialTab)) this.lastProjectTabByConversation[key] = initialTab
      this.expandedByConversation[key] = !!hasCollaborationData
    },

    open(conversationId, tab = null) {
      const key = keyOf(conversationId)
      if (!key) return
      this.initializedByConversation[key] = true
      this.expandedByConversation[key] = true
      this.manuallyCollapsedByConversation[key] = false
      if (VALID_TABS.has(tab)) {
        this.activeTabByConversation[key] = tab
        if (VALID_PROJECT_TABS.has(tab)) this.lastProjectTabByConversation[key] = tab
      }
      else if (!this.activeTabByConversation[key]) this.activeTabByConversation[key] = DEFAULT_TAB
    },

    close(conversationId) {
      const key = keyOf(conversationId)
      if (!key) return
      this.initializedByConversation[key] = true
      this.expandedByConversation[key] = false
      this.manuallyCollapsedByConversation[key] = true
    },

    toggle(conversationId, tab = null) {
      if (this.isExpanded(conversationId)) this.close(conversationId)
      else this.open(conversationId, tab)
    },

    toggleProject(conversationId) {
      const key = keyOf(conversationId)
      if (!key) return
      const currentTab = this.activeTab(key)
      if (this.isExpanded(key) && VALID_PROJECT_TABS.has(currentTab)) {
        this.close(key)
        return
      }
      this.open(key, this.lastProjectTab(key))
    },

    toggleFiles(conversationId) {
      const key = keyOf(conversationId)
      if (!key) return
      if (this.isExpanded(key) && this.activeTab(key) === 'files') {
        this.close(key)
        return
      }
      this.open(key, 'files')
    },

    setTab(conversationId, tab) {
      const key = keyOf(conversationId)
      if (!key || !VALID_TABS.has(tab)) return
      this.activeTabByConversation[key] = tab
      this.open(conversationId, tab)
    },

    setWidth(conversationId, width) {
      const key = keyOf(conversationId)
      if (!key) return
      this.widthByConversation[key] = Math.round(Number(width) || 0)
    },

    revealForNewData(conversationId, preferredTab = DEFAULT_TAB) {
      const key = keyOf(conversationId)
      if (!key || this.manuallyCollapsedByConversation[key]) return
      // 用户已经展开并在查看某个 Tab 时，不因 demo seed / 异步数据回填抢走当前视线。
      if (this.expandedByConversation[key]) return
      this.open(key, preferredTab)
    },

    openFile(conversationId, file = {}) {
      const key = keyOf(conversationId)
      if (!key) return
      const rawName = String(file?.name || '未命名文件')
      const extension = rawName.includes('.') ? rawName.split('.').pop().toLowerCase() : ''
      const url = String(file?.httpUrl || file?.url || '')
      this.open(key, 'files')
      this.previewSerial += 1
      this.previewRequestByConversation[key] = {
        serial: this.previewSerial,
        file: {
          ...file,
          id: String(file?.id || url || `${key}-${this.previewSerial}`),
          name: rawName,
          type: file?.type || extension,
          url,
          httpUrl: file?.httpUrl || (/^https?:|^data:|^blob:/i.test(url) ? url : ''),
          conversationId: key,
        },
      }
    },

    openTask(conversationId, taskId) {
      const key = keyOf(conversationId)
      const id = String(taskId || '')
      if (!key || !id) return
      this.open(key, 'tasks')
      this.taskRevealSerial += 1
      this.taskRevealRequestByConversation[key] = {
        serial: this.taskRevealSerial,
        taskId: id,
        directDetail: true,
      }
    },

    clearPreview(conversationId) {
      const key = keyOf(conversationId)
      if (!key) return
      delete this.previewRequestByConversation[key]
    },
  },
})
