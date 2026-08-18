<template>
  <div class="file-preview-window">
    <div v-if="!fileInfo" class="preview-placeholder">
      <p>等待文件数据...</p>
    </div>
    <TeamFilePreview
      v-else
      :node="fileInfo"
      :space-id="fileInfo.spaceId ?? null"
      :room-type="fileInfo.roomType ?? null"
      :standalone="true"
      class="preview-fill"
      @close="handleClose"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TeamFilePreview from './TeamFilePreview.vue'

const fileInfo = ref(null)

let unsubscribe = null

const MIME_TO_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
  'application/pdf': 'pdf', 'text/markdown': 'md', 'text/plain': 'txt',
  'text/html': 'html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

function normalizeFileInfo(data) {
  if (!data) return data
  const name = data.name || ''
  const dotIdx = name.lastIndexOf('.')
  const extFromName = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : ''
  let type = data.type || ''
  if (!type || type.includes('/') || type === 'image' || type === 'file') {
    type = extFromName || MIME_TO_EXT[data.mimeType] || ''
  }
  return {
    ...data,
    spaceId: data.spaceId != null ? String(data.spaceId) : '',
    type,
  }
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1])
  const dataParam = urlParams.get('data')
  if (dataParam) {
    try {
      fileInfo.value = normalizeFileInfo(JSON.parse(decodeURIComponent(dataParam)))
    } catch (e) {
      console.error('Failed to parse file data from URL:', e)
    }
  }

  if (window.electronAPI?.onFilePreviewData) {
    unsubscribe = window.electronAPI.onFilePreviewData((data) => {
      fileInfo.value = normalizeFileInfo(data)
    })
  }
})

onUnmounted(() => {
  unsubscribe?.()
})

function handleClose() {
  window.electronAPI?.windowClose?.()
}
</script>

<style scoped>
.file-preview-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8C93A6;
  font-size: 14px;
}

.preview-fill {
  flex: 1;
  min-height: 0;
}
</style>
