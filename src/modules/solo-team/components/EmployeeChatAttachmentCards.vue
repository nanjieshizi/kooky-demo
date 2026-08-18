<script setup>
import { computed, inject, ref, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { useSoloTeamStore } from '../store'
import { useFileStore } from '@/modules/file/store'
import api from '@/shared/services/api'
import { employeeThreadApi } from '../services/employeeThreadApi'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import codeTypeBg from '@/assets/chat/code_type.png'
import richTypeBg from '@/assets/chat/rich_type.png'
import txtTypeBg from '@/assets/chat/txt_type.png'
import mdTypeBg from '@/assets/chat/md_type.png'

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  role: { type: String, default: 'user' },
  spaceId: { type: String, default: '' },
  messageTimestamp: { type: Number, default: 0 },
})

const uiStore = useUIStore()
const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const employeeSessionStore = injectedSessionStore ?? useSoloTeamStore()
const fileStore = useFileStore()

/** 与 DeerflowAttachmentCards 一致：kc-media / 独立预览窗使用智能体 businessId，不用 LangGraph id */
const kcMediaSpaceIdForPreview = computed(() => {
  const id = employeeSessionStore.employeeSkillBindingAgentId
  if (id != null && String(id).trim() !== '') return String(id)
  return props.spaceId || ''
})

/** 一人团队用 super_person_chat，我的员工用 employee_chat */
const kcMediaRoomType = computed(() =>
  employeeSessionStore.employeeChatMode === 'one_person_team' ? 'super_person_chat' : 'employee_chat'
)

const imageBlobUrls = ref({})
const savingFileId = ref('')

function blobCacheKey(img) {
  if (!img) return ''
  return `${img.url || ''}\u0000${img.name || ''}`
}

function isDeerflowThreadArtifactUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /\/api\/threads\/[^/]+\/artifacts\//.test(url)
}

function isLikelyAuthMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (isDeerflowThreadArtifactUrl(url)) return true
  if (/^https?:\/\//i.test(url)) return true
  return url.startsWith('/')
}

function getPreferredUrl(file) {
  return file?.url || ''
}

function hasUsableUrl(file) {
  return !!getPreferredUrl(file)
}

async function fetchBlobForFile(url) {
  if (!url) return null
  if (isDeerflowThreadArtifactUrl(url)) {
    return employeeThreadApi.fetchThreadArtifactBlob(url)
  }
  try {
    const res = await api.get(url, { responseType: 'blob' })
    const blob = res?.data ?? res
    return blob instanceof Blob ? blob : null
  } catch {
    return null
  }
}

async function fetchImageBlobViaApi(url) {
  return fetchBlobForFile(url)
}

async function ensureAuthImageBlob(img) {
  const key = blobCacheKey(img)
  const url = getPreferredUrl(img)
  if (!key || !url || imageBlobUrls.value[key]) return
  if (img.thumbnailUrl?.startsWith('blob:') || img.data) return
  if (!isLikelyAuthMediaUrl(url)) return
  try {
    const blob = await fetchImageBlobViaApi(url)
    if (!blob || blob.size === 0) return
    imageBlobUrls.value = { ...imageBlobUrls.value, [key]: URL.createObjectURL(blob) }
  } catch {
    /* noop */
  }
}

function getImageSrc(img) {
  if (img.thumbnailUrl && !img.url) return img.thumbnailUrl
  if (img.data) return `data:${img.mediaType || img.mimeType || 'image/png'};base64,${img.data}`
  const key = blobCacheKey(img)
  if (imageBlobUrls.value[key]) return imageBlobUrls.value[key]
  if (img.thumbnailUrl?.startsWith('blob:')) return img.thumbnailUrl
  const preferredUrl = getPreferredUrl(img)
  if (preferredUrl) return preferredUrl
  if (img.url) return img.url
  if (img.thumbnailUrl) return img.thumbnailUrl
  return ''
}

async function handleImageError(img, event) {
  const key = blobCacheKey(img)
  const url = getPreferredUrl(img)
  if (!url || imageBlobUrls.value[key]) return
  try {
    const blob = await fetchImageBlobViaApi(url)
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
  (atts) => {
    if (!Array.isArray(atts) || !atts.length) return
    for (const a of atts) {
      if (!isImage(a) || !a?.url) continue
      void ensureAuthImageBlob(a)
    }
  },
  { deep: true, immediate: true },
)

onUnmounted(() => {
  Object.values(imageBlobUrls.value).forEach(url => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  })
})

function isImage(file) {
  if (!file) return false
  if (file.type === 'image') return true
  const mime = file.mimeType || file.type
  if (typeof mime === 'string' && mime.startsWith('image/')) return true
  if (typeof file.type === 'string' && file.type.startsWith('image/')) return true
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|heic|heif)$/i.test(file.name || '')
}

function resolveAttachmentIcon(file) {
  return getChatFileIconSrc(getChatFileTypeFromName(file?.name))
}

function getFileTypeBg(file) {
  const fileType = getChatFileTypeFromName(file?.name)
  const codeTypes = ['js', 'py', 'html', 'css', 'json', 'sql']
  const richTypes = ['word', 'excel', 'pdf']
  const txtTypes = ['txt', 'generic']
  const mdTypes = ['md']
  if (codeTypes.includes(fileType)) return codeTypeBg
  if (richTypes.includes(fileType)) return richTypeBg
  if (txtTypes.includes(fileType)) return txtTypeBg
  if (mdTypes.includes(fileType)) return mdTypeBg
  return txtTypeBg
}

function getFileTypeLabel(file) {
  const fileType = getChatFileTypeFromName(file?.name)
  const typeLabels = {
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
  return typeLabels[fileType] || 'FILE'
}

function formatFileTime() {
  const timestamp = props.messageTimestamp
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `创建时间：${month}月${day}日 ${hours}:${minutes}`
}

function formatFileSizeDisplay(file) {
  const bytes = file?.size
  if (bytes === undefined || bytes === null || bytes === '') return formatFileTime() || ''
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return formatFileTime() || ''
  const k = 1024
  if (n < k) return `${n} B`
  if (n < k * k) return `${(n / k).toFixed(1)} KB`
  return `${(n / (k * k)).toFixed(1)} MB`
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

function getAttachmentSaveKey(file) {
  return getPreferredUrl(file) || file?.name || ''
}

function notifyFileSavedToTree() {
  window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
    detail: { spaceId: kcMediaSpaceIdForPreview.value, roomType: kcMediaRoomType.value },
  }))
}

function roomTypeToBusinessType(roomType) {
  if (roomType === 'super_person_chat') return 'opt'
  if (roomType === 'employee_chat') return 'employee'
  return 'team'
}

async function saveToLibrary(file) {
  const saveKey = getAttachmentSaveKey(file)
  if (!saveKey || !kcMediaSpaceIdForPreview.value || savingFileId.value === saveKey) return
  savingFileId.value = saveKey
  try {
    const preferredUrl = getPreferredUrl(file)
    if (!preferredUrl) throw new Error('无法解析文件地址')

    const blob = await fetchBlobForFile(preferredUrl)
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('无法获取文件内容')
    }

    const businessType = roomTypeToBusinessType(kcMediaRoomType.value)
    await fileStore.saveBlobToLibrary(kcMediaSpaceIdForPreview.value, blob, file.name || '未命名文件', businessType)
    ElMessage.success('已保存到文件库')
    notifyFileSavedToTree()

    const filePanelFullyOpen =
      uiStore.activeToolTab === 'file'
      && uiStore.toolFileContentVisible
      && !uiStore.fileTreeCollapsed
    if (!filePanelFullyOpen) {
      uiStore.setActiveToolTab('file')
    }
  } catch (e) {
    const errMsg = e?.response?.data?.message || e?.message || '保存失败'
    ElMessage.error(errMsg)
  } finally {
    savingFileId.value = ''
  }
}

function getPreviewType(file) {
  const name = String(file?.name || '')
  const i = name.lastIndexOf('.')
  if (i > 0 && i < name.length - 1) {
    return name.slice(i + 1).toLowerCase()
  }
  const t = file?.type
  if (typeof t === 'string' && t && !t.includes('/')) return t.toLowerCase()
  return ''
}

function openFilePreview(file) {
  const preferredUrl = getPreferredUrl(file)
  if (!preferredUrl) return
  const spaceId = kcMediaSpaceIdForPreview.value
  if (window.electronAPI?.openFilePreview) {
    window.electronAPI.openFilePreview({
      id: preferredUrl,
      name: file.name,
      type: getPreviewType(file),
      httpUrl: preferredUrl,
      size: file.size,
      mimeType: file.mimeType,
      spaceId,
      roomType: kcMediaRoomType.value,
    })
    return
  }
  uiStore.openFilePreview({
    id: preferredUrl,
    name: file.name,
    type: getPreviewType(file),
    httpUrl: preferredUrl,
    size: file.size,
    mimeType: file.mimeType,
    spaceId,
  })
}

const imageAttachments = computed(() => props.attachments.filter(isImage))
const fileAttachments = computed(() => props.attachments.filter(f => !isImage(f)))

const imagePreviewVisible = ref(false)
const imagePreviewTitle = ref('')
const imagePreviewUrl = ref('')
const imagePreviewLoading = ref(false)
const imagePreviewActiveBlob = ref('')

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
  const dotIdx = name.lastIndexOf('.')
  const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : 'png'
  const spaceId = kcMediaSpaceIdForPreview.value

  if (window.electronAPI?.openFilePreview) {
    window.electronAPI.openFilePreview({
      id: preferredUrl,
      name: file.name,
      type: ext,
      mxcUrl: preferredUrl,
      httpUrl: preferredUrl,
      size: file.size,
      mimeType: file.mimeType,
      spaceId,
      roomType: kcMediaRoomType.value,
    })
    return
  }

  revokePreviewBlob()
  imagePreviewTitle.value = file.name || '图片预览'
  imagePreviewVisible.value = true
  imagePreviewLoading.value = true
  const key = blobCacheKey(file)
  let blobUrl =
    imageBlobUrls.value[key] ||
    (file.data
      ? `data:${file.mediaType || file.mimeType || 'image/png'};base64,${file.data}`
      : '')
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
  imagePreviewUrl.value = blobUrl || file.thumbnailUrl || preferredUrl || file.url || ''
}

function onImagePreviewClosed() {
  revokePreviewBlob()
  imagePreviewLoading.value = false
}
</script>

<template>
  <div v-if="attachments.length" class="msg-attachments" :class="[`role-${role}`]">
    <!-- 图片：结构与 dev MessageAssistantAttachmentCards 一致，src 仍走 deer-flow 鉴权 blob -->
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
        <img
          v-else
          :src="resolveAttachmentIcon(img)"
          class="assistant-file-icon"
          alt=""
        />
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
            class="file-action-btn"
            :disabled="!hasUsableUrl(img) || savingFileId === getAttachmentSaveKey(img)"
            @click.stop="saveToLibrary(img)"
          >
            <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
        <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
          <button
            class="file-action-btn"
            :disabled="!hasUsableUrl(img)"
            @click.stop="downloadAttachment(img)"
          >
            <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
      </div>
    </div>

    <!-- 非图片文件：完全对齐 dev 卡片 -->
    <div
      v-for="(file, fIdx) in fileAttachments"
      :key="(file.url || '') + file.name + fIdx"
      class="file-card"
      role="button"
      tabindex="0"
      @click="openFilePreview(file)"
      @keydown.enter.prevent="openFilePreview(file)"
    >
      <div class="file-card-left">
        <img :src="resolveAttachmentIcon(file)" class="assistant-file-icon" alt="" />
        <div class="file-info">
          <span style="max-width: 174px;" class="file-name" :title="file.name">{{ file.name }}</span>
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
              class="file-action-btn"
              :disabled="!hasUsableUrl(file) || savingFileId === getAttachmentSaveKey(file)"
              @click.stop="saveToLibrary(file)"
            >
              <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
            </button>
          </el-tooltip>
          <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
            <button
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
      class="deerflow-attachment-image-preview-dialog"
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
/* 与 MessageAssistantAttachmentCards（dev）一致；用户消息右对齐 */
.msg-attachments {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  width: 100%;
}

.msg-attachments.role-user {
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
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  overflow: hidden;
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

.file-info--image-actions:focus-visible {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.45);
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
  color: var(--text-muted, #9ca3af);
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
  box-shadow: 0px 3.29px 13.97px -3px #d0dbea;
  transition: transform 0.3s ease;
  padding-left: 14px;
  padding-top: 6px;
}

.file-card:hover .file-type-bg {
  transform: rotate(-10deg);
}

.file-card:hover:not(.file-card--image) {
  background-image: url('@/assets/chat/fileBg.png');
  background-size: cover;
  background-position: center;
}

.file-type-label {
  font-family: PingFang SC, sans-serif;
  font-size: 9.86px;
  font-weight: normal;
  line-height: 11.51px;
  color: #606572;
}

.file-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
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
.deerflow-attachment-image-preview-dialog .el-dialog__body {
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
