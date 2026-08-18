import { defineStore } from 'pinia'
import {
  FILE_LIBRARY_FOLDERS,
  FILE_LIBRARY_FILES,
} from '@/modules/file/demo/fileLibraryDemo'

/** 工具栏「文件」库（可转存新增）*/
export const useFileLibraryStore = defineStore('fileLibrary', {
  state: () => ({
    folders: JSON.parse(JSON.stringify(FILE_LIBRARY_FOLDERS)),
    files: JSON.parse(JSON.stringify(FILE_LIBRARY_FILES)),
  }),
  actions: {
    /** 转存：把一个文件加入库根目录（同名则跳过）*/
    addFile(file) {
      const name = file?.name
      if (!name) return false
      const exists = this.files.some((f) => f.name === name)
      if (exists) return false
      this.files.unshift({
        id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        type: file.type || file.previewType || 'other',
        size: file.size || '—',
        bytes: file.bytes || 0,
        previewType: file.previewType || file.type,
        content: file.content || '',
      })
      return true
    },
  },
})
