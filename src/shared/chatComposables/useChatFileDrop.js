/**
 * 聊天区拖拽上传：ChatPanel 提供拖放目标 + inject 通道，ChatInput / GroupChatInput 消费并交给 ChatFileUploadArea。
 */
import { ref, computed, provide, inject, watch, unref } from 'vue'
import { CHAT_FILE_DROP_KEY } from '@/shared/constants/injectionKeys'
import { batchGetRefs } from '@/modules/file/service'
import { referenceMediaFile } from '@/shared/services/imApi'

/**
 * 在 ChatPanel（或任意包裹聊天区的根）setup 中调用一次：provide 文件 ref + 拖拽事件处理器状态。
 * @returns {{ droppedFiles: import('vue').Ref<File[]|null>, isDragging: import('vue').ComputedRef<boolean>, onDragEnter: Function, onDragOver: Function, onDragLeave: Function, onDrop: Function }}
 */
export function useChatPanelFileDropProvider() {
  const dragDepth = ref(0)
  const isDragging = computed(() => dragDepth.value > 0)
  const droppedFiles = ref(null)
  provide(CHAT_FILE_DROP_KEY, droppedFiles)

  function onDragEnter(e) {
    const hasFiles = e.dataTransfer?.types?.includes('Files')
    const hasFileTreeNodes = e.dataTransfer?.types?.includes('application/x-file-tree-nodes')
    const hasCloudNode = e.dataTransfer?.types?.includes('application/x-cloud-file-node')
    if (!hasFiles && !hasFileTreeNodes && !hasCloudNode) return
    e.preventDefault()
    dragDepth.value++
  }

  function onDragOver(e) {
    const hasFiles = e.dataTransfer?.types?.includes('Files')
    const hasFileTreeNodes = e.dataTransfer?.types?.includes('application/x-file-tree-nodes')
    const hasCloudNode = e.dataTransfer?.types?.includes('application/x-cloud-file-node')
    if (!hasFiles && !hasFileTreeNodes && !hasCloudNode) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave() {
    dragDepth.value = Math.max(0, dragDepth.value - 1)
  }

  async function onDrop(e) {
    e.preventDefault()
    dragDepth.value = 0

    // 优先处理云端文件节点（不上传，走 downloadUrl 引用）
    const cloudNodeData = e.dataTransfer?.getData('application/x-cloud-file-node')
    if (cloudNodeData) {
      try {
        const node = JSON.parse(cloudNodeData)
        const refs = await batchGetRefs(node.businessId, [node.fileId])
        if (refs?.[0]) {
          let httpUrl = null
          if (refs[0].downloadUrl) {
            try {
              const result = await referenceMediaFile(null, {
                mimeType: node.mimeType || refs[0].mimeType || 'application/octet-stream',
                fileName: node.name || refs[0].displayName || '',
                downloadUrl: refs[0].downloadUrl,
              })
              httpUrl = result?.contentUri ?? null
            } catch (refErr) {
              console.warn('[useChatFileDrop] referenceMediaFile 失败，回退到 downloadUrl:', refErr)
            }
          }
          window.dispatchEvent(new CustomEvent('team-file-ref', { detail: { ...refs[0], httpUrl } }))
        }
      } catch (err) {
        console.error('云端文件引用失败:', err)
      }
      return
    }

    // 优先处理文件树节点
    const fileTreeNodesData = e.dataTransfer?.getData('application/x-file-tree-nodes')
    if (fileTreeNodesData) {
      try {
        const nodes = JSON.parse(fileTreeNodesData)
        const filePaths = nodes.filter(n => n.type === 'file').map(n => n.path)
        if (filePaths.length > 0) {
          const files = await Promise.all(
            filePaths.map(async (path) => {
              try {
                const buffer = await window.electronAPI.fs.readFile(path)
                const fileName = path.split(/[/\\]/).pop()
                return new File([buffer], fileName, { type: '' })
              } catch (err) {
                console.error(`读取文件失败: ${path}`, err)
                return null
              }
            })
          )
          const validFiles = files.filter(f => f !== null)
          if (validFiles.length > 0) droppedFiles.value = validFiles
        }
      } catch (err) {
        console.error('解析文件树节点失败:', err)
      }
      return
    }

    // 处理系统文件
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length > 0) droppedFiles.value = files
  }

  return {
    droppedFiles,
    isDragging,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }
}

/**
 * 在含 ChatFileUploadArea 的输入组件中调用：监听面板拖入的文件并 addFiles。
 * @param {import('vue').Ref<{ addFiles?: (files: File[]) => void }|null|undefined>} uploadAreaRef
 */
export function useChatFileDropConsumer(uploadAreaRef) {
  const droppedFiles = inject(CHAT_FILE_DROP_KEY, null)
  watch(
    () => droppedFiles?.value,
    (files) => {
      if (!files?.length) return
      const area = unref(uploadAreaRef)
      area?.addFiles?.(files)
      if (droppedFiles) droppedFiles.value = null
    },
  )
}
