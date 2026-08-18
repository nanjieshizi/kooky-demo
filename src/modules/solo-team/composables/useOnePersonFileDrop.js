import { computed, inject, provide, ref, watch } from 'vue'
import { batchGetRefs, getDownloadUrl } from '@/modules/file/service'

const ONE_PERSON_FILE_DROP_KEY = Symbol('one-person-file-drop')

function hasSupportedDragPayload(dataTransfer) {
  const types = dataTransfer?.types || []
  return types.includes('Files')
    || types.includes('application/x-file-tree-nodes')
    || types.includes('application/x-cloud-file-node')
}

async function cloudNodeToFile(node) {
  let downloadUrl = null

  try {
    const refs = await batchGetRefs(node.businessId, [node.fileId], node.businessType)
    downloadUrl = refs?.[0]?.downloadUrl || null
  } catch (error) {
    console.warn('[OnePersonTeam] batchGetRefs failed, fallback to getDownloadUrl:', error)
  }

  if (!downloadUrl) {
    try {
      const result = await getDownloadUrl(node.businessId, node.fileId, node.businessType)
      downloadUrl = result?.url || null
    } catch (error) {
      console.warn('[OnePersonTeam] getDownloadUrl failed:', error)
    }
  }

  if (!downloadUrl) {
    console.error('[OnePersonTeam] cloud file has no download url:', node)
    return null
  }

  const response = await fetch(downloadUrl)
  if (!response.ok) throw new Error(`下载云端文件失败 (${response.status})`)
  const blob = await response.blob()
  const fileName = node.name || 'file'
  const mimeType = node.mimeType || blob.type || 'application/octet-stream'
  return new File([blob], fileName, { type: mimeType })
}

export function useOnePersonFileDropProvider() {
  const dragDepth = ref(0)
  const isDragging = computed(() => dragDepth.value > 0)
  const droppedFiles = ref(null)
  provide(ONE_PERSON_FILE_DROP_KEY, droppedFiles)

  function onDragEnter(event) {
    if (!hasSupportedDragPayload(event.dataTransfer)) return
    event.preventDefault()
    dragDepth.value += 1
  }

  function onDragOver(event) {
    if (!hasSupportedDragPayload(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave() {
    dragDepth.value = Math.max(0, dragDepth.value - 1)
  }

  async function onDrop(event) {
    event.preventDefault()
    dragDepth.value = 0

    const cloudNodeData = event.dataTransfer?.getData('application/x-cloud-file-node')
    if (cloudNodeData) {
      try {
        const node = JSON.parse(cloudNodeData)
        const file = await cloudNodeToFile(node)
        if (file) droppedFiles.value = [file]
      } catch (error) {
        console.error('[OnePersonTeam] cloud file drop failed:', error)
      }
      return
    }

    const fileTreeNodesData = event.dataTransfer?.getData('application/x-file-tree-nodes')
    if (fileTreeNodesData) {
      try {
        const nodes = JSON.parse(fileTreeNodesData)
        const filePaths = nodes.filter(node => node.type === 'file').map(node => node.path)
        const files = await Promise.all(filePaths.map(async (path) => {
          try {
            const buffer = await window.electronAPI.fs.readFile(path)
            const fileName = path.split(/[/\\]/).pop()
            return new File([buffer], fileName, { type: '' })
          } catch (error) {
            console.error(`[OnePersonTeam] read dropped file failed: ${path}`, error)
            return null
          }
        }))
        const validFiles = files.filter(Boolean)
        if (validFiles.length) droppedFiles.value = validFiles
      } catch (error) {
        console.error('[OnePersonTeam] parse file tree nodes failed:', error)
      }
      return
    }

    const files = Array.from(event.dataTransfer?.files || [])
    if (files.length) droppedFiles.value = files
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

export function useOnePersonFileDropConsumer(onFilesDropped) {
  const droppedFiles = inject(ONE_PERSON_FILE_DROP_KEY, null)
  watch(
    () => droppedFiles?.value,
    (files) => {
      if (!files?.length) return
      onFilesDropped?.(files)
      if (droppedFiles) droppedFiles.value = null
    },
  )
}
