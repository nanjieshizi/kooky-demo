import { ref, computed, provide, inject, watch } from 'vue'
import { batchGetRefs, getDownloadUrl } from '@/modules/file/service'

const EMPLOYEE_DEERFLOW_FILE_DROP_KEY = Symbol('employee-deerflow-file-drop')

/** 云端文件节点 → File（与「我的分身」useDeerflowFileDrop 一致） */
async function cloudNodeToFile(node) {
  let downloadUrl = null

  try {
    const refs = await batchGetRefs(node.businessId, [node.fileId], node.businessType)
    downloadUrl = refs?.[0]?.downloadUrl || null
  } catch (err) {
    console.warn('[EmployeeChat] batchGetRefs 失败，尝试 getDownloadUrl:', err)
  }

  if (!downloadUrl) {
    try {
      const result = await getDownloadUrl(node.businessId, node.fileId, node.businessType)
      downloadUrl = result?.url || null
    } catch (err) {
      console.warn('[EmployeeChat] getDownloadUrl 也失败:', err)
    }
  }

  if (!downloadUrl) {
    console.error('[EmployeeChat] 无法获取云端文件下载链接 fileId=%s', node.fileId)
    return null
  }

  const resp = await fetch(downloadUrl)
  if (!resp.ok) throw new Error(`下载云端文件失败 (${resp.status})`)
  const blob = await resp.blob()
  const fileName = node.name || 'file'
  const mimeType = node.mimeType || blob.type || 'application/octet-stream'
  return new File([blob], fileName, { type: mimeType })
}

export function useEmployeeDeerflowFileDropProvider() {
  const dragDepth = ref(0)
  const isDragging = computed(() => dragDepth.value > 0)
  const droppedFiles = ref(null)
  provide(EMPLOYEE_DEERFLOW_FILE_DROP_KEY, droppedFiles)

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

    const cloudNodeData = e.dataTransfer?.getData('application/x-cloud-file-node')
    if (cloudNodeData) {
      try {
        const node = JSON.parse(cloudNodeData)
        const file = await cloudNodeToFile(node)
        if (file) droppedFiles.value = [file]
      } catch (err) {
        console.error('[EmployeeChat] 云端文件拖入失败:', err)
      }
      return
    }

    const fileTreeNodesData = e.dataTransfer?.getData('application/x-file-tree-nodes')
    if (fileTreeNodesData) {
      try {
        const nodes = JSON.parse(fileTreeNodesData)
        const filePaths = nodes.filter(n => n.type === 'file').map(n => n.path)
        const files = await Promise.all(filePaths.map(async (path) => {
          try {
            const buffer = await window.electronAPI.fs.readFile(path)
            const fileName = path.split(/[/\\]/).pop()
            return new File([buffer], fileName, { type: '' })
          } catch (err) {
            console.error(`读取文件失败: ${path}`, err)
            return null
          }
        }))
        const validFiles = files.filter(Boolean)
        if (validFiles.length > 0) droppedFiles.value = validFiles
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

export function useEmployeeDeerflowFileDropConsumer(onFilesDropped) {
  const droppedFiles = inject(EMPLOYEE_DEERFLOW_FILE_DROP_KEY, null)
  watch(
    () => droppedFiles?.value,
    (files) => {
      if (!files?.length) return
      onFilesDropped?.(files)
      if (droppedFiles) droppedFiles.value = null
    },
  )
}
