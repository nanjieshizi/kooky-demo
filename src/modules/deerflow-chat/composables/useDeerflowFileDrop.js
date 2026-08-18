/**
 * DeerFlow 聊天区拖拽上传
 * 从 chat 模块迁移，去除 Matrix 依赖
 */
import { ref, computed, provide, inject, watch, unref } from 'vue'
import { DEERFLOW_FILE_DROP_KEY } from '@/shared/constants/injectionKeys'
import { batchGetRefs, getDownloadUrl } from '@/modules/file/service'

/**
 * 云端文件节点 → File 对象：通过 downloadUrl 拉取文件流，转为 File 走常规上传通道，
 * 让云端文件与本地文件在 deerflow 输入区表现完全一致。
 */
async function cloudNodeToFile(node) {
  let downloadUrl = null

  try {
    const refs = await batchGetRefs(node.businessId, [node.fileId])
    downloadUrl = refs?.[0]?.downloadUrl || null
  } catch (err) {
    console.warn('[Deerflow] batchGetRefs 失败，尝试 getDownloadUrl:', err)
  }

  // fallback: getDownloadUrl
  if (!downloadUrl) {
    try {
      const result = await getDownloadUrl(node.businessId, node.fileId)
      downloadUrl = result?.url || null
    } catch (err) {
      console.warn('[Deerflow] getDownloadUrl 也失败:', err)
    }
  }

  if (!downloadUrl) {
    console.error('[Deerflow] 无法获取云端文件下载链接 fileId=%s', node.fileId)
    return null
  }

  const resp = await fetch(downloadUrl)
  if (!resp.ok) throw new Error(`下载云端文件失败 (${resp.status})`)
  const blob = await resp.blob()
  const fileName = node.name || 'file'
  const mimeType = node.mimeType || blob.type || 'application/octet-stream'
  return new File([blob], fileName, { type: mimeType })
}

/**
 * 在 DeerflowChatPanel 中调用：provide 文件 ref + 拖拽事件处理器
 */
export function useDeerflowFileDropProvider() {
  const dragDepth = ref(0)
  const isDragging = computed(() => dragDepth.value > 0)
  const droppedFiles = ref(null)
  provide(DEERFLOW_FILE_DROP_KEY, droppedFiles)

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

    // 优先处理云端文件节点（拉取流转为 File，与本地文件交互一致）
    const cloudNodeData = e.dataTransfer?.getData('application/x-cloud-file-node')
    if (cloudNodeData) {
      console.log('[Deerflow] 云端文件 drop:', cloudNodeData)
      try {
        const node = JSON.parse(cloudNodeData)
        const file = await cloudNodeToFile(node)
        if (file) {
          console.log('[Deerflow] 云端文件转换成功: %s (%s)', file.name, file.type)
          droppedFiles.value = [file]
        }
      } catch (err) {
        console.error('[Deerflow] 云端文件拖入失败:', err)
      }
      return
    }

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
 * 在 DeerflowInput 中调用：监听面板拖入的文件
 * @param {Function} onFilesDropped - 接收文件数组的回调
 */
export function useDeerflowFileDropConsumer(onFilesDropped) {
  const droppedFiles = inject(DEERFLOW_FILE_DROP_KEY, null)
  watch(
    () => droppedFiles?.value,
    (files) => {
      if (!files?.length) return
      onFilesDropped?.(files)
      if (droppedFiles) droppedFiles.value = null
    },
  )
}
