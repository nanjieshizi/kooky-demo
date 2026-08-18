<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api, { getSsoToken } from '@/shared/services/api'
import { useFileStore } from '@/modules/file/store'
import { useUIStore } from '@/modules/space/uiStore'
import { usePreviewStore } from '@/modules/space/previewStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useUserStore } from '@/modules/auth/store'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { getOneEnv } from '@/shared/utils/oneEnv'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import codeTypeBg from '@/assets/chat/code_type.png'
import richTypeBg from '@/assets/chat/rich_type.png'
import txtTypeBg from '@/assets/chat/txt_type.png'
import mdTypeBg from '@/assets/chat/md_type.png'
import { onePersonTeamAttachmentApi } from '../../services/onePersonTeamAttachmentApi'

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  role: { type: String, default: 'human' },
  spaceId: { type: [String, Number], default: '' },
  messageTimestamp: { type: Number, default: 0 },
})

const uiStore = useUIStore()
const previewStore = usePreviewStore()
const sidePanelStore = useSidePanelStore()
const fileStore = useFileStore()
const userStore = useUserStore()
const connectionStore = useImConnectionStore()
const imageBlobUrls = ref({})
const imagePreviewVisible = ref(false)
const imagePreviewTitle = ref('')
const imagePreviewUrl = ref('')
const imagePreviewLoading = ref(false)
const imagePreviewActiveBlob = ref('')
const savingFileId = ref('')

function blobCacheKey(file) {
  if (!file) return ''
  return `${file.url || ''}\u0000${file.name || ''}`
}

function isThreadArtifactUrl(url) {
  return typeof url === 'string' && /\/api\/threads\/[^/]+\/artifacts\//.test(url)
}

function isLikelyAuthMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return false
  if (isThreadArtifactUrl(url)) return true
  if (/^https?:\/\//i.test(url)) return true
  return url.startsWith('/')
}

function getPreferredUrl(file) {
  return file?.url || file?.downloadUrl || file?.openUrl || file?.httpUrl || ''
}

function hasUsableUrl(file) {
  return Boolean(getPreferredUrl(file))
}

async function fetchBlobForFile(url) {
  if (!url) return null
  try {
    return await onePersonTeamAttachmentApi.fetchThreadArtifactBlob(url)
  } catch {
    return null
  }
}

async function ensureAuthImageBlob(file) {
  const key = blobCacheKey(file)
  const url = getPreferredUrl(file)
  if (!key || !url || imageBlobUrls.value[key]) return
  if (file.thumbnailUrl?.startsWith('blob:') || file.data) return
  if (!isLikelyAuthMediaUrl(url)) return
  try {
    const blob = await fetchBlobForFile(url)
    if (!blob || blob.size === 0) return
    imageBlobUrls.value = { ...imageBlobUrls.value, [key]: URL.createObjectURL(blob) }
  } catch {
    /* noop */
  }
}

function isImage(file) {
  if (!file) return false
  if (file.type === 'image') return true
  const mime = file.mimeType || file.type
  if (typeof mime === 'string' && mime.startsWith('image/')) return true
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|heic|heif)$/i.test(file.name || '')
}

function getImageSrc(file) {
  if (file.thumbnailUrl && !file.url) return file.thumbnailUrl
  if (file.data) return `data:${file.mediaType || file.mimeType || 'image/png'};base64,${file.data}`
  const key = blobCacheKey(file)
  if (imageBlobUrls.value[key]) return imageBlobUrls.value[key]
  if (file.thumbnailUrl?.startsWith('blob:')) return file.thumbnailUrl
  return getPreferredUrl(file) || file.thumbnailUrl || ''
}

async function handleImageError(file, event) {
  const key = blobCacheKey(file)
  const url = getPreferredUrl(file)
  if (!url || imageBlobUrls.value[key]) return
  try {
    const blob = await fetchBlobForFile(url)
    if (!blob) return
    const blobUrl = URL.createObjectURL(blob)
    imageBlobUrls.value = { ...imageBlobUrls.value, [key]: blobUrl }
    if (event?.target) event.target.src = blobUrl
  } catch {
    /* noop */
  }
}

watch(
  () => props.attachments,
  (attachments) => {
    if (!Array.isArray(attachments) || !attachments.length) return
    for (const attachment of attachments) {
      if (!isImage(attachment) || !attachment?.url) continue
      void ensureAuthImageBlob(attachment)
    }
  },
  { deep: true, immediate: true },
)

onUnmounted(() => {
  Object.values(imageBlobUrls.value).forEach((url) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  })
  revokePreviewBlob()
})

function resolveAttachmentIcon(file) {
  return getChatFileIconSrc(getChatFileTypeFromName(file?.name))
}

function getFileTypeBg(file) {
  const fileType = getChatFileTypeFromName(file?.name)
  if (['js', 'py', 'html', 'css', 'json', 'sql'].includes(fileType)) return codeTypeBg
  if (['word', 'excel', 'pdf'].includes(fileType)) return richTypeBg
  if (fileType === 'md') return mdTypeBg
  return txtTypeBg
}

function getFileTypeLabel(file) {
  const fileType = getChatFileTypeFromName(file?.name)
  const labels = {
    js: 'CODE',
    py: 'CODE',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    sql: 'SQL',
    word: 'WORD',
    excel: 'EXCEL',
    pdf: 'PDF',
    txt: 'TXT',
    md: 'MD',
    generic: 'FILE',
  }
  return labels[fileType] || 'FILE'
}

function formatFileTime() {
  if (!props.messageTimestamp) return ''
  const date = new Date(props.messageTimestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `创建时间：${month}月${day}日 ${hours}:${minutes}`
}

function formatFileSizeDisplay(file) {
  const size = Number(file?.size || 0)
  if (!Number.isFinite(size) || size <= 0) return formatFileTime() || ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getPreviewType(file) {
  const name = String(file?.name || '')
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex > 0 && dotIndex < name.length - 1) return name.slice(dotIndex + 1).toLowerCase()
  const type = file?.type
  if (typeof type === 'string' && type && !type.includes('/')) return type.toLowerCase()
  return ''
}

function toPreviewFileType(file) {
  if (file?.fileType) return file.fileType
  const ext = getPreviewType(file)
  if (ext === 'md') return 'md'
  if (['js', 'ts', 'py', 'json', 'vue', 'css', 'java', 'go', 'rs', 'sh', 'yaml', 'yml'].includes(ext)) return 'code'
  if (['txt', 'log'].includes(ext)) return 'txt'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (ext === 'html') return 'html'
  return 'other'
}

function openFilePreview(file) {
  // content 型（有正文，如员工产物 / 库内文件）→ 会话侧区多标签预览区（可编辑）
  if (file?.content || file?.fromLibrary || file?.mockPreview) {
    sidePanelStore.open('preview')
    previewStore.openFile({
      id: file.id || file.name,
      name: file.name,
      fileType: toPreviewFileType(file),
      content: file.content || '',
      placeholder: file.placeholder || '',
    })
    return
  }
  const preferredUrl = getPreferredUrl(file)
  if (!preferredUrl) return
  const previewInfo = {
    id: preferredUrl,
    name: file.name,
    type: getPreviewType(file),
    httpUrl: preferredUrl,
    size: file.size,
    mimeType: file.mimeType,
    spaceId: props.spaceId ? String(props.spaceId) : '',
    roomType: 'super_person_chat',
  }
  if (window.electronAPI?.openFilePreview) {
    window.electronAPI.openFilePreview(previewInfo)
    return
  }
  uiStore.openFilePreview(previewInfo)
}

async function downloadAttachment(file) {
  const preferredUrl = getPreferredUrl(file)
  if (!preferredUrl) return
  const name = file.name || 'download'
  try {
    const blob = await fetchBlobForFile(preferredUrl)
    if (blob && blob.size > 0) {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1200)
      return
    }
  } catch {
    /* fallback */
  }
  const a = document.createElement('a')
  a.href = preferredUrl
  a.download = name
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function saveToLibrary(file) {
  const preferredUrl = getPreferredUrl(file)
  if (!preferredUrl || !props.spaceId || savingFileId.value === preferredUrl) return
  savingFileId.value = preferredUrl
  try {
    let blob
    if (isLikelyAuthMediaUrl(preferredUrl)) {
      blob = await onePersonTeamAttachmentApi.fetchThreadArtifactBlob(preferredUrl)
    } else {
      const response = await fetch(preferredUrl)
      if (!response.ok) throw new Error('文件下载失败')
      blob = await response.blob()
    }
    if (!(blob instanceof Blob) || blob.size === 0) throw new Error('无法获取文件内容')

    const fileName = file.name || '未命名文件'
    const formData = new FormData()
    formData.append('file', blob, fileName)

    const env = getOneEnv()
    const userId = String(userStore.userInfo?.userId ?? '')
    const token = getSsoToken()
    await api.post(
      'kc-media/api/v1/team-files/upload',
      formData,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Business-Type': 'opt',
          'X-Business-Id': String(props.spaceId),
          'X-Env': env,
          'X-User-Id': userId,
          'X-Bind-Im-User-Id': String(connectionStore.userId || userId),
        },
      }
    )

    ElMessage.success('已保存到文件库')
    fileStore.refreshQuota(props.spaceId).catch(() => {})
    window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
      detail: { spaceId: String(props.spaceId), roomType: 'super_person_chat' }
    }))
  } catch (e) {
    const errMsg = e?.response?.data?.message || e?.message || '保存失败'
    ElMessage.error(errMsg)
  } finally {
    savingFileId.value = ''
  }
}

function revokePreviewBlob() {
  if (imagePreviewActiveBlob.value.startsWith('blob:')) {
    try { URL.revokeObjectURL(imagePreviewActiveBlob.value) } catch { /* noop */ }
  }
  imagePreviewActiveBlob.value = ''
  imagePreviewUrl.value = ''
}

async function openImagePreview(file) {
  if (!file) return
  const preferredUrl = getPreferredUrl(file)
  if (!preferredUrl) return
  const name = file.name || ''
  const dotIndex = name.lastIndexOf('.')
  const ext = dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : 'png'
  const previewInfo = {
    id: preferredUrl,
    name: file.name,
    type: ext,
    mxcUrl: preferredUrl,
    httpUrl: preferredUrl,
    size: file.size,
    mimeType: file.mimeType,
    spaceId: props.spaceId ? String(props.spaceId) : '',
    roomType: 'super_person_chat',
  }
  if (window.electronAPI?.openFilePreview) {
    window.electronAPI.openFilePreview(previewInfo)
    return
  }

  revokePreviewBlob()
  imagePreviewTitle.value = file.name || '图片预览'
  imagePreviewVisible.value = true
  imagePreviewLoading.value = true
  const key = blobCacheKey(file)
  let blobUrl =
    imageBlobUrls.value[key]
    || (file.data ? `data:${file.mediaType || file.mimeType || 'image/png'};base64,${file.data}` : '')
  if (!blobUrl && preferredUrl) {
    const blob = await fetchBlobForFile(preferredUrl)
    if (blob?.size > 0) {
      blobUrl = URL.createObjectURL(blob)
      imagePreviewActiveBlob.value = blobUrl
    }
  } else if (blobUrl && blobUrl.startsWith('blob:')) {
    imagePreviewActiveBlob.value = blobUrl
  }
  imagePreviewLoading.value = false
  if (!imagePreviewVisible.value) {
    revokePreviewBlob()
    return
  }
  imagePreviewUrl.value = blobUrl || file.thumbnailUrl || preferredUrl || ''
}

function onImagePreviewClosed() {
  revokePreviewBlob()
  imagePreviewLoading.value = false
}

const imageAttachments = computed(() => props.attachments.filter(isImage))
const fileAttachments = computed(() => props.attachments.filter(file => !isImage(file)))
</script>

<template>
  <div v-if="attachments.length" class="msg-attachments" :class="[`role-${role}`]">
    <div
      v-for="(img, idx) in imageAttachments"
      :key="blobCacheKey(img) || `img-${idx}`"
      class="file-card file-card--image"
    >
      <div
        class="assistant-image-preview"
        role="button"
        tabindex="0"
        @click.stop="openImagePreview(img)"
        @keydown.enter.prevent="openImagePreview(img)"
      >
        <img
          v-if="getImageSrc(img)"
          :src="getImageSrc(img)"
          :alt="img.name"
          class="assistant-thumb-img"
          loading="lazy"
          @error="handleImageError(img, $event)"
        />
        <img v-else :src="resolveAttachmentIcon(img)" class="assistant-file-icon" alt="" />
      </div>
      <div
        class="file-info file-info--image-actions"
        role="button"
        tabindex="0"
        @click.stop="openFilePreview(img)"
        @keydown.enter.prevent="openFilePreview(img)"
      >
        <span class="file-name">{{ img.name }}</span>
        <span class="file-size">{{ formatFileSizeDisplay(img) }}</span>
      </div>
      <div class="file-actions">
        <el-tooltip content="保存" placement="top" :show-arrow="false" :show-after="500">
          <button
            type="button"
            class="file-action-btn"
            :disabled="!hasUsableUrl(img) || savingFileId === getPreferredUrl(img)"
            @click.stop="saveToLibrary(img)"
          >
            <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
        <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
          <button
            type="button"
            class="file-action-btn"
            :disabled="!hasUsableUrl(img)"
            @click.stop="downloadAttachment(img)"
          >
            <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
      </div>
    </div>

    <div
      v-for="(file, index) in fileAttachments"
      :key="(file.url || '') + file.name + index"
      class="file-card"
      role="button"
      tabindex="0"
      @click="openFilePreview(file)"
      @keydown.enter.prevent="openFilePreview(file)"
    >
      <div class="file-card-left">
        <img :src="resolveAttachmentIcon(file)" class="assistant-file-icon" alt="" />
        <div class="file-info">
          <span class="file-name" :title="file.name">{{ file.name }}</span>
          <span class="file-time">{{ formatFileTime() || formatFileSizeDisplay(file) }}</span>
        </div>
      </div>
      <div class="file-card-right">
        <div class="file-type-bg" :style="{ backgroundImage: `url(${getFileTypeBg(file)})` }">
          <span class="file-type-label">{{ getFileTypeLabel(file) }}</span>
        </div>
        <div class="file-actions">
          <el-tooltip content="保存" placement="top" :show-arrow="false" :show-after="500">
            <button
              type="button"
              class="file-action-btn"
              :disabled="!hasUsableUrl(file) || savingFileId === getPreferredUrl(file)"
              @click.stop="saveToLibrary(file)"
            >
              <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
            </button>
          </el-tooltip>
          <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
            <button
              type="button"
              class="file-action-btn"
              :disabled="!hasUsableUrl(file)"
              @click.stop="downloadAttachment(file)"
            >
              <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
            </button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="imagePreviewVisible"
      :title="imagePreviewTitle"
      width="min(920px, 92vw)"
      class="one-person-attachment-image-preview-dialog"
      append-to-body
      align-center
      destroy-on-close
      @closed="onImagePreviewClosed"
    >
      <div class="image-preview-dialog-body">
        <div v-if="imagePreviewLoading" class="image-preview-dialog-loading">加载中…</div>
        <img
          v-else-if="imagePreviewUrl"
          :src="imagePreviewUrl"
          :alt="imagePreviewTitle"
          class="image-preview-dialog-img"
        />
        <div v-else class="image-preview-dialog-empty">无法加载预览</div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.msg-attachments {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.msg-attachments.role-human {
  align-items: flex-end;
}

.file-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 360px;
  height: 106px;
  padding: 16px 0 16px 16px;
  border-radius: 12px;
  background: #fff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  overflow: hidden;
}

.file-card:hover:not(.file-card--image) {
  background-image: url('@/assets/chat/fileBg.png');
  background-size: cover;
  background-position: center;
}

.file-card--image {
  flex-direction: column;
  align-items: stretch;
  width: auto;
  height: auto;
  min-width: 120px;
  max-width: 480px;
  padding: 10px 14px;
  cursor: default;
}

.assistant-image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 64px;
  background: #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
  cursor: zoom-in;
  outline: none;
}

.assistant-thumb-img {
  display: block;
  max-width: 100%;
  max-height: 220px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.file-card--image .file-info {
  margin-top: 8px;
}

.file-info--image-actions {
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 4px;
  margin: -2px -4px;
  outline: none;
}

.file-card-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.file-card-right {
  margin-top: 50px;
}

.assistant-file-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.file-name {
  max-width: 174px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-time {
  font-size: 12px;
  color: #8f959e;
}

.file-size {
  font-size: 11px;
  color: #9ca3af;
}

.file-type-bg {
  width: 139px;
  height: 120px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 3.29px 13.97px -3px #d0dbea;
  transition: transform 0.3s ease;
  padding-left: 14px;
  padding-top: 6px;
}

.file-card:hover .file-type-bg {
  transform: rotate(-10deg);
}

.file-type-label {
  font-family: PingFang SC, sans-serif;
  font-size: 9.86px;
  line-height: 11.51px;
  color: #606572;
}

.file-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
}

.file-card:hover .file-actions {
  opacity: 1;
  z-index: 2;
}

.file-action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.file-action-btn:hover {
  background: #f3f4f7;
}

.file-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>

<style lang="scss">
.one-person-attachment-image-preview-dialog .el-dialog__body {
  padding-top: 8px;
}

.image-preview-dialog-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  max-height: min(78vh, 720px);
}

.image-preview-dialog-img {
  display: block;
  max-width: 100%;
  max-height: min(78vh, 720px);
  width: auto;
  height: auto;
  object-fit: contain;
  margin: 0 auto;
}

.image-preview-dialog-loading,
.image-preview-dialog-empty {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  padding: 24px;
}
</style>
