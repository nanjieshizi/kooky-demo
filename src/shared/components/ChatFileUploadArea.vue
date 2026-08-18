<template>
  <!-- 隐藏的文件选择 input -->
  <input
    ref="fileInputRef"
    type="file"
    :accept="CHAT_UPLOAD_ACCEPT"
    style="display: none"
    @change="onFileChange"
  />

  <!-- 上传按钮 -->
  <el-tooltip
    :content="uploadTooltipText"
    placement="top"
    effect="dark"
    :show-after="400"
  >
    <button type="button" class="upload-btn" @click="openFilePicker">
      <img :src="fileUploadIcon" alt="upload" class="upload-icon" />
    </button>
  </el-tooltip>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import fileUploadIcon from '@/assets/home/fileUpload.svg'
import { getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import { useFileStore } from '@/modules/file/store'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { deleteFiles } from '@/modules/file/service'

const props = defineProps({
  spaceId: { type: String, required: true },
  conversationId: { type: [String, Number], default: '' },
})

const fileStore = useFileStore()
const imConnectionStore = useImConnectionStore()

// ──── 常量 ────
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const MAX_PENDING_FILES = 5
const uploadTooltipText = '上传附件（单次最多 5 个）'

const CHAT_UPLOAD_ALLOWED_EXT = [
  'md', 'txt',
  'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'html', 'htm', 'css', 'json', 'sql',
  'vue', 'svelte', 'yaml', 'yml', 'xml', 'toml', 'ini', 'sh', 'bash', 'zsh',
  'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts', 'dart', 'scala', 'cs',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx', 'r', 'lua', 'pl', 'pm', 'ex', 'exs',
  'less', 'scss', 'sass', 'graphql', 'gql',
  'docx', 'odt', 'pdf',
  'png', 'jpg', 'jpeg',
]
const CHAT_UPLOAD_ALLOWED_EXT_SET = new Set(CHAT_UPLOAD_ALLOWED_EXT)
const CHAT_UPLOAD_ACCEPT = CHAT_UPLOAD_ALLOWED_EXT.map(e => `.${e}`).join(',')

// ──── 状态 ────
const fileInputRef = ref(null)
const pendingFiles = ref([]) // [{ id, file, progress, url, error, fileId, fileInfo }]

const allUploaded = computed(() =>
  pendingFiles.value.length === 0 ||
  pendingFiles.value.every(f => f.url !== null || f.error !== null)
)

const hasFiles = computed(() => pendingFiles.value.length > 0)

// ──── 工具 ────
function chatUploadFileExtension(filename) {
  const base = (filename || '').split(/[/\\]/).pop() || ''
  const i = base.lastIndexOf('.')
  if (i <= 0) return ''
  return base.slice(i + 1).toLowerCase()
}

function isAllowedChatUploadFile(file) {
  const ext = chatUploadFileExtension(file.name)
  return ext.length > 0 && CHAT_UPLOAD_ALLOWED_EXT_SET.has(ext)
}

function pendingFileRow(id) {
  return pendingFiles.value.find(f => f.id === id) ?? null
}

function getFileType(filename) {
  return getChatFileTypeFromName(filename)
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ──── 操作 ────
function openFilePicker() {
  if (pendingFiles.value.length >= MAX_PENDING_FILES) {
    ElMessage.warning(`最多支持 ${MAX_PENDING_FILES} 个文件`)
    return
  }
  fileInputRef.value?.click()
}

function onFileChange(e) {
  addFiles(Array.from(e.target.files || []))
  e.target.value = ''
}

function addFiles(files) {
  if (!files?.length) return
  const remaining = MAX_PENDING_FILES - pendingFiles.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多支持 ${MAX_PENDING_FILES} 个文件`)
    return
  }
  const typeRejected = files.filter(f => !isAllowedChatUploadFile(f))
  if (typeRejected.length) {
    ElMessage.warning('仅支持 Markdown(.md)、纯文本(.txt)、常见代码(如 .py/.js/.html/.css/.json/.sql 等)、Word(.docx)/ODT/PDF、图片(.png/.jpg/.jpeg)')
  }
  const typeOk = files.filter(f => isAllowedChatUploadFile(f))
  if (!typeOk.length) return
  const oversized = typeOk.filter(f => f.size > MAX_UPLOAD_BYTES)
  if (oversized.length) {
    ElMessage.warning(`单个文件不可超过 50MB，已跳过：${oversized.map(f => f.name).join('、')}`)
  }
  const withinLimit = typeOk.filter(f => f.size <= MAX_UPLOAD_BYTES)
  if (!withinLimit.length) return
  const toAdd = withinLimit.slice(0, remaining)
  if (withinLimit.length > remaining) {
    ElMessage.warning(`已选 ${withinLimit.length} 个有效文件，超出上限，仅添加前 ${remaining} 个`)
  }
  toAdd.forEach(file => {
    const item = { id: `${Date.now()}-${Math.random()}`, file, progress: 0, url: null, error: null }
    pendingFiles.value.push(item)
    _uploadFile(item)
  })
}

/**
 * 添加文件树引用（已有 downloadUrl，不需要上传）
 * @param {object} ref - { id, displayName, downloadUrl, size, mimeType }
 */
function addTeamFileRef(ref) {
  if (!ref?.httpUrl && !ref?.downloadUrl) return
  const url = ref.httpUrl || ref.downloadUrl

  const mockFile = {
    name: ref.displayName || 'file',
    size: ref.size || 0,
    type: ref.mimeType || 'application/octet-stream',
  }

  // 已存在文件树引用 → 直接替换（切换引用文件）
  const existingIndex = pendingFiles.value.findIndex(item => item.isTeamFileRef)
  if (existingIndex > -1) {
    pendingFiles.value[existingIndex] = {
      id: `team-${ref.id}-${Date.now()}`,
      file: mockFile,
      progress: 1,
      url,
      error: null,
      isTeamFileRef: true,
    }
    return
  }

  const remaining = MAX_PENDING_FILES - pendingFiles.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多支持 ${MAX_PENDING_FILES} 个文件`)
    return
  }

  pendingFiles.value.push({
    id: `team-${ref.id}-${Date.now()}`,
    file: mockFile,
    progress: 1,
    url,
    error: null,
    isTeamFileRef: true,
  })
}

async function _uploadFile(item) {
  const id = item.id
  if (!imConnectionStore.isClientConnected()) {
    const row = pendingFileRow(id)
    if (row) row.error = '未连接到服务，请稍后重试'
    return
  }
  try {
    const result = await imConnectionStore.uploadContent(item.file, (p) => {
      const row = pendingFileRow(id)
      if (row) row.progress = p
    }, props.conversationId ? { threadId: props.conversationId } : {})

    const row = pendingFileRow(id)
    if (row) {
      row.url = result.downloadUrl
      row.fileId = result.fileId
      row.fileInfo = result.fileInfo
      row.progress = 1
    }

    // 注意：不在此处保存到文件树，等待发送成功后再保存
  } catch (e) {
    const row = pendingFileRow(id)
    if (row) row.error = e?.message || '上传失败'
    console.error('[ChatFileUploadArea] 文件上传失败:', e)
  }
}

function removeFile(id) {
  const idx = pendingFiles.value.findIndex(f => f.id === id)
  if (idx === -1) return
  const row = pendingFiles.value[idx]
  pendingFiles.value.splice(idx, 1)
  // 已上传成功的新文件需要同步删除服务端（文件树引用不删除）
  if (row?.fileId && !row.isTeamFileRef) {
    deleteFiles(props.spaceId, [row.fileId]).catch(e => {
      console.warn('[ChatFileUploadArea] 删除已上传文件失败:', e)
    })
  }
}

function retryFile(item) {
  const row = pendingFileRow(item.id)
  if (!row) return
  row.error = null
  row.progress = 0
  row.url = null
  _uploadFile(row)
}

function clearFiles() {
  pendingFiles.value = []
}

defineExpose({
  pendingFiles,
  hasFiles,
  allUploaded,
  clearFiles,
  addFiles,
  removeFile,
  retryFile,
  getFileType,
  formatFileSize,
  addTeamFileRef,
})
</script>

<style scoped>
.upload-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
}

.upload-btn:hover {
  background: #F7F8FA;
}

.upload-icon {
  width: 14px;
  height: 14px;
}
</style>
