import { defineStore } from 'pinia'

/** 全局文件预览弹窗：文件库 / 分身会话文件卡 共用 */
export const useFilePreviewStore = defineStore('filePreview', {
  state: () => ({ file: null }),
  actions: {
    open(file) {
      this.file = file
    },
    close() {
      this.file = null
    },
  },
})
