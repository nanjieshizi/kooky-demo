import { ref } from 'vue'

/** 文件库拖拽的自定义 MIME（避免和真实文件拖拽冲突）*/
export const LIB_FILE_MIME = 'application/x-kooky-libfile'

/** 在 dragstart 里写入文件库文件信息 */
export function setLibraryDragData(e, file) {
  if (!e.dataTransfer) return
  const payload = JSON.stringify({
    name: file.name,
    type: file.type,
    bytes: file.bytes || 0,
    fromLibrary: true,
  })
  e.dataTransfer.setData(LIB_FILE_MIME, payload)
  e.dataTransfer.setData('text/plain', file.name)
  e.dataTransfer.effectAllowed = 'copy'
}

/**
 * 会话输入框接收「文件库拖入」——只认自定义 MIME，不影响真实文件拖拽。
 * @param {(file:{name:string,type:string,bytes:number}) => void} onFile 收到文件的回调
 */
export function useLibraryFileDrop(onFile) {
  const isOver = ref(false)

  function hasLibFile(e) {
    return Array.from(e.dataTransfer?.types || []).includes(LIB_FILE_MIME)
  }
  function onDragOver(e) {
    if (!hasLibFile(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isOver.value = true
  }
  function onDragLeave(e) {
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
    isOver.value = false
  }
  function onDrop(e) {
    isOver.value = false
    const raw = e.dataTransfer?.getData(LIB_FILE_MIME)
    if (!raw) return
    e.preventDefault()
    e.stopPropagation()
    try {
      onFile(JSON.parse(raw))
    } catch (_) {
      /* ignore */
    }
  }
  return { isOver, onDragOver, onDragLeave, onDrop }
}
