<template>
  <div v-if="attachments?.length" class="user-attachments">
    <div
      v-for="(file, fIdx) in attachments"
      :key="(file.url || '') + file.name + fIdx"
      class="user-file-card"
      :class="{
        'user-file-card--image': isImageAttachment(file),
      }"
      :role="isImageAttachment(file) ? undefined : 'button'"
      :tabindex="isImageAttachment(file) ? undefined : 0"
      @click="!isImageAttachment(file) && openFilePreview(file)"
      @keydown.enter.prevent="!isImageAttachment(file) && openFilePreview(file)"
    >
      <template v-if="isImageAttachment(file)">
        <div
          class="user-image-preview"
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
            class="user-file-icon"
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
        <button
          class="save-to-lib-btn save-to-lib-btn--image"
          title="保存到文件库"
          @click.stop="saveToLibrary(file)"
        >
          <img :src="saveIcon" width="14" height="14" alt="保存" />
        </button>
      </template>
      <template v-else>
        <div class="file-card-left">
          <img :src="resolveAttachmentIcon(file)" class="user-file-icon" alt="" />
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-time">{{ formatFileTime() }}</span>
          </div>
        </div>
        <div class="file-card-right">
          <div class="file-type-bg" :style="{ backgroundImage: `url(${getFileTypeBg(file)})` }">
            <span class="file-type-label">{{ getFileTypeLabel(file) }}</span>
          </div>
          <button
            class="save-to-lib-btn"
            title="保存到文件库"
            @click.stop="saveToLibrary(file)"
          >
            <img :src="saveIcon" width="14" height="14" alt="保存" />
          </button>
        </div>
      </template>
    </div>

    <el-dialog
      v-model="imagePreviewVisible"
      :title="imagePreviewTitle"
      width="min(920px, 92vw)"
      class="user-attachment-image-preview-dialog"
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
import { useMatrixAttachmentDownload } from '@/modules/chat/useMatrixAttachmentDownload'
import { useFileStore } from '@/modules/file/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useChatStore } from '@/modules/chat/store'
import { useGroupStore } from '@/modules/group/store'
import { matrixClient } from '@/shared/im'
import MatrixAttachmentImagePreview from './MatrixAttachmentImagePreview.vue'
import saveIcon from '@/assets/chat/downFile.svg'
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
const chatStore = useChatStore()
const groupStore = useGroupStore()
const collaborationBOpenFilePreview = inject('collaborationBOpenFilePreview', null)

const computedRoomType = computed(() => {
  const nav = uiStore.activePrimaryNav
  const id = props.spaceId
  if (!id) return 'group_chat'
  if (nav === 'avatar') {
    const room = chatStore.currentRoomId
    const type = room?.createRoomType || 'private_chat'
    return type === 'private_chat' ? 'bot_person_chat' : type
  }
  if (nav === 'solo-team') {
    return 'super_person_chat'
  }
  if (nav === 'collaboration' || nav === 'collaboration-b') {
    const room = (groupStore.rooms ?? []).find(r => r.roomId === id)
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

function openFilePreview(file) {
  if (!file?.url) return
  if (typeof collaborationBOpenFilePreview === 'function') {
    const consumed = collaborationBOpenFilePreview({ conversationId: props.spaceId, file })
    if (consumed === true) return
  }
  const isMxc = file.url.startsWith('mxc://')
  const name = file.name || ''
  const dotIdx = name.lastIndexOf('.')
  const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : (file.type || '')
  window.electronAPI?.openFilePreview?.({
    id: file.url,
    name: file.name,
    type: ext,
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
  const isMxc = file.url.startsWith('mxc://')
  const name = file.name || ''
  const dotIdx = name.lastIndexOf('.')
  const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : 'png'
  window.electronAPI?.openFilePreview?.({
    id: file.url,
    name: file.name,
    type: ext,
    mxcUrl: isMxc ? '' : file.url,
    httpUrl: isMxc ? '' : file.url,
    size: file.size,
    mimeType: file.mimeType,
    spaceId: props.spaceId,
    roomType: computedRoomType.value,
  })
}

function onImagePreviewDialogClosed() {
  revokeImagePreviewBlob()
  imagePreviewLoading.value = false
}

function getFileExt(filename) {
  return (filename || '').split('.').pop()?.toUpperCase() || ''
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
</script>

<style scoped>
/* 多附件竖直间距与 MessageList .messages-wrapper 消息间距 24px 一致 */
.user-attachments {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
}

.user-file-card {
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

.user-file-card--image {
  flex-direction: column;
  align-items: stretch;
  width: auto;
  height: auto;
  min-width: 120px;
  max-width: 480px;
  padding: 10px 14px;
  cursor: default;
}

.user-image-preview {
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

.user-file-card--image .file-info {
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

.user-file-card:hover:not(.user-file-card--image) {
  border-color: #d1d5db;
  background: #fafafa;
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

.user-file-icon {
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
  color: #9ca3af;
}

.file-type-bg {
  width: 139px;
  height: 120px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0px 3.29px 13.97px -3px #D0DBEA;
  transition: transform 0.3s ease;
}

.file-type-bg:hover {
  transform: rotate(-15deg);
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

.save-to-lib-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
  padding: 0;
  z-index: 1;
}

.save-to-lib-btn:hover {
  background: #ffffff;
  border-color: #d1d5db;
}

.user-file-card:hover .save-to-lib-btn,
.file-type-bg:hover .save-to-lib-btn {
  opacity: 1;
}

.save-to-lib-btn--image {
  top: 4px;
  right: 4px;
}
</style>

<style lang="scss">
.user-attachment-image-preview-dialog .el-dialog__body {
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
