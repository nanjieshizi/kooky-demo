import { defineStore } from 'pinia'

// 全局共享预览区：整个 kooky 共用一个预览区，统一在模块右侧出现。
// 任何模块（一人团队 / Kode / …）调 openFile(file) 往里塞标签。
//
// 标签路由：web / html → 浏览器标签（单例，最多 1 个）；其它 → 文件标签（不限）。
// file 形状：{ id, name, fileType, content?, localUrl?, web?, placeholder?, source? }
//   fileType: md | code | txt | image | html | web | other

let fileSeq = 0

export const usePreviewStore = defineStore('preview', {
  state: () => ({
    visible: false,
    tabs: [],
    activeId: '',
  }),

  getters: {
    activeTab: (state) => state.tabs.find((t) => t.id === state.activeId) || null,
  },

  actions: {
    openFile(file) {
      if (!file) return
      if (file.fileType === 'web') {
        this.openBrowser({ mode: 'web', title: file.name, url: file.web?.url || '', web: file.web, placeholder: file.placeholder })
      } else if (file.fileType === 'html') {
        this.openBrowser({ mode: 'html', title: file.name, html: file.content || '' })
      } else {
        this.openFileTab(file)
      }
    },

    openBrowser(payload) {
      this.visible = true
      const tab = { id: 'browser', kind: 'browser', urlDraft: payload.url || '', ...payload }
      const idx = this.tabs.findIndex((t) => t.kind === 'browser')
      if (idx >= 0) this.tabs.splice(idx, 1, tab)
      else this.tabs.push(tab)
      this.activeId = 'browser'
    },

    openBrowserBlank() {
      this.openBrowser({ mode: 'empty', title: '新选项卡' })
    },

    openFileTab(file) {
      this.visible = true
      const id = file.id || `local-file-${fileSeq++}`
      if (!this.tabs.some((t) => t.id === id)) {
        this.tabs.push({
          id, kind: 'file',
          name: file.name, fileType: file.fileType, content: file.content,
          localUrl: file.localUrl, source: file.source, placeholder: file.placeholder,
        })
      }
      this.activeId = id
    },

    setActive(id) {
      this.activeId = id
    },

    // 编辑：把某个文件标签的正文更新回去（预览区编辑态保存用）
    updateTabContent(id, content) {
      const tab = this.tabs.find((t) => t.id === id)
      if (tab && tab.kind === 'file') tab.content = content
    },

    navigate(id, url) {
      const tab = this.tabs.find((t) => t.id === id)
      if (!tab || tab.kind !== 'browser') return
      const full = /^https?:\/\//.test(url) ? url : `https://${url}`
      tab.url = full
      tab.urlDraft = full
      tab.mode = 'url'
    },

    closeTab(id) {
      const idx = this.tabs.findIndex((t) => t.id === id)
      if (idx === -1) return
      this.tabs.splice(idx, 1)
      if (!this.tabs.length) { this.activeId = ''; this.visible = false; return }
      if (this.activeId === id) this.activeId = (this.tabs[idx] || this.tabs[idx - 1]).id
    },

    close() {
      this.visible = false
      this.tabs = []
      this.activeId = ''
    },
  },
})
