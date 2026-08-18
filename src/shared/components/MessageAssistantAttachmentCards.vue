<template>
  <div v-if="attachments?.length" class="msg-attachments">
    <div
      v-for="(file, fIdx) in attachments"
      :key="(file.url || '') + file.name + fIdx"
      class="file-card"
      :class="{
        'file-card--image': isImageAttachment(file),
      }"
      :role="isImageAttachment(file) ? undefined : 'button'"
      :tabindex="isImageAttachment(file) ? undefined : 0"
      @click="!isImageAttachment(file) && openFilePreview(file)"
      @keydown.enter.prevent="!isImageAttachment(file) && openFilePreview(file)"
    >
      <template v-if="isImageAttachment(file)">
        <div
          class="assistant-image-preview"
          role="button"
          tabindex="0"
          @click.stop="openImagePreview(file)"
          @keydown.enter.prevent="openImagePreview(file)"
        >
          <MatrixAttachmentImagePreview
            v-if="file?.url"
            :file="file"
            :fallback-src="resolveAttachmentIcon(file)"
          />
          <img
            v-else
            :src="resolveAttachmentIcon(file)"
            class="assistant-file-icon"
            alt=""
          />
        </div>
        <div
          class="file-info file-info--image-actions"
          role="button"
          tabindex="0"
          @click.stop="openFilePreview(file)"
          @keydown.enter.prevent="openFilePreview(file)"
        >
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ file.size }}</span>
        </div>
        <div class="file-actions">
          <el-tooltip content="保存" placement="top" :show-arrow="false" :show-after="500">
            <button
              class="file-action-btn"
              :disabled="savingFileId === file.url"
              @click.stop="saveToLibrary(file)"
            >
              <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
            </button>
          </el-tooltip>
          <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
            <button
              class="file-action-btn"
              @click.stop="downloadAttachment(file)"
            >
              <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
            </button>
          </el-tooltip>
        </div>
      </template>
      <template v-else>
        <div class="file-card-left">
          <img :src="resolveAttachmentIcon(file)" class="assistant-file-icon" alt="" />
          <div class="file-info">
            <span style="max-width: 174px;" class="file-name" :title="file.name">{{ file.name }}</span>
            <span class="file-time">{{ formatFileTime(file) }}</span>
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
                :disabled="savingFileId === file.url"
                @click.stop="saveToLibrary(file)"
              >
                <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
              </button>
            </el-tooltip>
            <el-tooltip content="下载" placement="top" :show-arrow="false" :show-after="500">
              <button
                class="file-action-btn"
                @click.stop="downloadAttachment(file)"
              >
                <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
              </button>
            </el-tooltip>
          </div>
        </div>
      </template>
    </div>

    <el-dialog
      v-model="imagePreviewVisible"
      :title="imagePreviewTitle"
      width="min(920px, 92vw)"
      class="assistant-attachment-image-preview-dialog"
      append-to-body
      align-center
      destroy-on-close
      @closed="onImagePreviewDialogClosed"
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

<script setup>
import { ref, computed, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import { useMatrixAttachmentDownload } from '@/shared/chatComposables/useMatrixAttachmentDownload'
import { useFileStore } from '@/modules/file/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'
import MatrixAttachmentImagePreview from '@/shared/components/MatrixAttachmentImagePreview.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import codeTypeBg from '@/assets/chat/code_type.png'
import richTypeBg from '@/assets/chat/rich_type.png'
import txtTypeBg from '@/assets/chat/txt_type.png'
import mdTypeBg from '@/assets/chat/md_type.png'

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  spaceId: { type: String, default: '' },
  messageTimestamp: { type: Number, default: 0 },
})

const fileStore = useFileStore()
const uiStore = useUIStore()
const groupStore = useGroupStore()
const collaborationBOpenFilePreview = inject('collaborationBOpenFilePreview', null)

const computedRoomType = computed(() => {
  const nav = uiStore.activePrimaryNav
  const id = props.spaceId
  if (!id) return 'group_chat'
  if (nav === 'solo-team') {
    return 'super_person_chat'
  }
  if (nav === 'collaboration' || nav === 'collaboration-b') {
    const room = (groupStore.conversations ?? []).find(r => r.conversationId === id)
    return room?.createRoomType || 'group_chat'
  }
  return 'group_chat'
})

const {
  attachmentDownloadHref,
  downloadAttachment,
  isImageAttachment,
  fetchAttachmentPreviewObjectUrl,
  revokeAttachmentPreviewUrl,
} = useMatrixAttachmentDownload()

const imagePreviewVisible = ref(false)
const imagePreviewTitle = ref('')
const imagePreviewUrl = ref('')
const imagePreviewLoading = ref(false)
let imagePreviewActiveBlob = ''
const savingFileId = ref('')

function revokeImagePreviewBlob() {
  revokeAttachmentPreviewUrl(imagePreviewActiveBlob)
  imagePreviewActiveBlob = ''
  imagePreviewUrl.value = ''
}

async function saveToLibrary(file) {
  if (!file?.url || !props.spaceId || savingFileId.value === file.url) return
  savingFileId.value = file.url
  try {
    await fileStore.saveFileFromUrl(props.spaceId, file.url, file.name)
    ElMessage.success('已保存到文件库')
    uiStore.setActiveToolTab('file')
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
  if (i > 0 && i < name.length - 1) return name.slice(i + 1).toLowerCase()
  const t = file?.type
  if (typeof t === 'string' && t && !t.includes('/')) return t.toLowerCase()
  return ''
}

function openFilePreview(file) {
  if (!file?.url) return
  if (typeof collaborationBOpenFilePreview === 'function') {
    const consumed = collaborationBOpenFilePreview({ conversationId: props.spaceId, file })
    if (consumed === true) return
  }
  const isMxc = file.url.startsWith('mxc://')
  window.electronAPI?.openFilePreview?.({
    id: file.url,
    name: file.name,
    type: getPreviewType(file),
    mxcUrl: isMxc ? '' : file.url,
    httpUrl: isMxc ? '' : file.url,
    size: file.size,
    mimeType: file.mimeType,
    spaceId: props.spaceId,
    roomType: computedRoomType.value,
  })
}

async function openImagePreview(file) {
  if (!file?.url) return
  if (typeof collaborationBOpenFilePreview === 'function') {
    const consumed = collaborationBOpenFilePreview({ conversationId: props.spaceId, file })
    if (consumed === true) return
  }
  revokeImagePreviewBlob()
  imagePreviewTitle.value = file.name || '图片预览'
  imagePreviewVisible.value = true
  imagePreviewLoading.value = true
  const blobUrl = await fetchAttachmentPreviewObjectUrl(file)
  imagePreviewLoading.value = false
  if (!imagePreviewVisible.value) {
    revokeAttachmentPreviewUrl(blobUrl)
    return
  }
  if (blobUrl) {
    imagePreviewActiveBlob = blobUrl
    imagePreviewUrl.value = blobUrl
  }
}

function onImagePreviewDialogClosed() {
  revokeImagePreviewBlob()
  imagePreviewLoading.value = false
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
    generic: 'FILE'
  }
  return typeLabels[fileType] || 'FILE'
}

function formatFileTime(file) {
  const timestamp = props.messageTimestamp
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `创建时间：${month}月${day}日 ${hours}:${minutes}`
}
</script>

<style scoped>
/* 多附件竖直间距与 MessageList .messages-wrapper 消息间距 24px 一致 */
.msg-attachments {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  width: 100%;
}

.file-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 360px;
  height: 106px;
  padding: 16px 0 16px 16px;
  border-radius: 12px;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 1px solid #ECEEF3;
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

/* .file-card:hover:not(.file-card--disabled) {
  border-color: #d1d5db;
  background: #fafafa;
} */

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
  color: #1F2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-time {
  font-size: 12px;
  color: #8F959E;
}

.file-size {
  font-size: 11px;
  color: var(--text-muted);
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
  box-shadow: 0px 3.29px 13.97px -3px #D0DBEA;
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
  font-family: PingFang SC;
  font-size: 9.86px;
  font-weight: normal;
  line-height: 11.51px;
  letter-spacing: normal;
  /* 二级文本色 */
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
.assistant-attachment-image-preview-dialog .el-dialog__body {
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
