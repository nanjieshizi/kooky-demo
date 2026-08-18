<template>
  <div v-if="attachments.length" class="flow-attachments">
    <div
      v-for="file in attachments"
      :key="getFileKey(file)"
      class="flow-attachment"
      role="button"
      tabindex="0"
      @click="openFilePreview(file)"
      @keydown.enter.prevent="openFilePreview(file)"
    >
      <img :src="resolveAttachmentIcon(file)" class="flow-attachment__icon" alt="" />
      <span class="flow-attachment__main">
        <span class="flow-attachment__name">{{ getFileName(file) }}</span>
        <span class="flow-attachment__meta">
          {{ formatSize(file.size) }}
        </span>
      </span>
      <span class="flow-attachment__actions">
        <el-tooltip content="保存" placement="top" popper-class="chat-tooltip" :offset="12" :show-after="500">
          <button
            type="button"
            class="flow-attachment__action"
            :disabled="savingFileKey === getFileKey(file)"
            @click.stop="saveToLibrary(file)"
          >
            <SvgIcon name="icon-baocun" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
        <el-tooltip content="下载" placement="top" popper-class="chat-tooltip" :offset="12" :show-after="500">
          <button type="button" class="flow-attachment__action" @click.stop="downloadFile(file)">
            <SvgIcon name="icon-xiazai" :size="14" color="#2F3547" />
          </button>
        </el-tooltip>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import {
  buildTeamFilePanelPreviewInfo,
  getTeamFileAttachmentId,
  getTeamFileAttachmentUrl,
} from '@/shared/utils/teamFileAttachmentAction.mjs'
import { useFileStore } from '@/modules/file/store'
import { fetchPreviewBlob, getDownloadUrl } from '@/modules/file/service'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'

defineOptions({ name: 'FlowAttachmentList' })

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  spaceId: { type: [String, Number], default: '' },
})

const fileStore = useFileStore()
const uiStore = useUIStore()
const groupStore = useGroupStore()
const savingFileKey = ref('')

function getRoomType() {
  const room = (groupStore.conversations ?? []).find((item) => item.conversationId === props.spaceId)
  return room?.createRoomType || 'group_chat'
}

function roomTypeToBusinessType(roomType) {
  if (roomType === 'super_person_chat') return 'opt'
  if (roomType === 'bot_person_chat') return 'person'
  if (roomType === 'employee_chat') return 'employee'
  return 'team'
}

function getFileName(file) {
  return file?.name || file?.displayName || '未命名文件'
}

function getFileUrl(file) {
  return getTeamFileAttachmentUrl(file)
}

function getFileKey(file) {
  return getFileUrl(file) || getTeamFileAttachmentId(file) || getFileName(file)
}

function resolveAttachmentIcon(file) {
  return getChatFileIconSrc(getChatFileTypeFromName(getFileName(file)))
}

function formatSize(size) {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

function buildPreviewInfo(file) {
  return buildTeamFilePanelPreviewInfo(file, {
    spaceId: props.spaceId,
    roomType: getRoomType(),
  })
}

function isPresignedS3Url(url) {
  return typeof url === 'string' && /[?&]X-Amz-Signature=/i.test(url)
}

async function resolvePreviewInfoForPresignedUrl(file, previewInfo) {
  const teamFileId = getTeamFileAttachmentId(file)
  if (!previewInfo.httpUrl || !isPresignedS3Url(previewInfo.httpUrl)) return previewInfo

  if (teamFileId) {
    return {
      ...previewInfo,
      id: teamFileId,
      httpUrl: null,
    }
  }

  const localPreview = await window.electronAPI?.fs?.downloadToTemp?.(
    previewInfo.httpUrl,
    previewInfo.name || getFileName(file),
  )
  if (!localPreview?.tempFilePath) {
    throw new Error('文件预览加载失败')
  }
  return {
    ...previewInfo,
    id: localPreview.tempFilePath,
    httpUrl: null,
    localPath: localPreview.tempFilePath,
  }
}

async function openFilePreview(file) {
  const previewInfo = buildPreviewInfo(file)
  if (!previewInfo.id && !previewInfo.httpUrl) {
    ElMessage.warning('暂无可预览的文件地址')
    return
  }

  try {
    const resolvedPreviewInfo = await resolvePreviewInfoForPresignedUrl(file, previewInfo)
    if (window.electronAPI?.openFilePreview) {
      window.electronAPI.openFilePreview(resolvedPreviewInfo)
      return
    }
    uiStore.openFilePreview(resolvedPreviewInfo)
  } catch (error) {
    console.warn('[FlowAttachmentList] 文件预览失败:', error)
    ElMessage.warning('预览失败，请稍后重试')
  }
}

function notifyFileSavedToTree() {
  window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
    detail: { spaceId: props.spaceId, roomType: getRoomType() },
  }))
}

async function fetchBlobFromUrl(url) {
  if (!url) throw new Error('无法获取文件地址')
  const response = await fetch(url)
  if (!response.ok) throw new Error('文件下载失败')
  return response.blob()
}

async function fetchTeamFilePanelBlob(file, previewInfo) {
  if (previewInfo.httpUrl) {
    return fetchBlobFromUrl(previewInfo.httpUrl)
  }

  const fileId = getTeamFileAttachmentId(file)
  if (fileId && props.spaceId) {
    const { blobUrl, revoke } = await fetchPreviewBlob(props.spaceId, fileId)
    try {
      return await fetchBlobFromUrl(blobUrl)
    } finally {
      revoke?.()
    }
  }

  throw new Error('无法获取文件地址')
}

async function saveToLibrary(file) {
  const key = getFileKey(file)
  if (!key) {
    ElMessage.warning('暂无可保存的文件地址')
    return
  }
  if (!props.spaceId) {
    ElMessage.warning('缺少会话信息，暂无法保存')
    return
  }
  if (savingFileKey.value === key) return

  savingFileKey.value = key
  try {
    const previewInfo = buildPreviewInfo(file)
    const blob = await fetchTeamFilePanelBlob(file, previewInfo)
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('无法获取文件内容')
    }
    await fileStore.saveBlobToLibrary(
      props.spaceId,
      blob,
      previewInfo.name || getFileName(file),
      roomTypeToBusinessType(getRoomType()),
    )
    ElMessage.success('已保存到文件库')
    notifyFileSavedToTree()
    const filePanelFullyOpen =
      uiStore.activeToolTab === 'file'
      && uiStore.toolFileContentVisible
      && !uiStore.fileTreeCollapsed
    if (!filePanelFullyOpen) {
      uiStore.setActiveToolTab('file')
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败')
  } finally {
    savingFileKey.value = ''
  }
}

function triggerHrefDownload(url, name) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name || 'download'
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function resolveDownloadUrl(file, previewInfo) {
  if (previewInfo.httpUrl) return previewInfo.httpUrl

  const fileId = getTeamFileAttachmentId(file)
  if (!fileId || !props.spaceId) return ''
  const result = await getDownloadUrl(props.spaceId, fileId)
  return typeof result === 'string' ? result : result?.url || ''
}

async function downloadFile(file) {
  try {
    const previewInfo = buildPreviewInfo(file)
    const url = await resolveDownloadUrl(file, previewInfo)
    if (!url) {
      ElMessage.warning('暂无可下载的文件地址')
      return
    }
    triggerHrefDownload(url, previewInfo.name || getFileName(file))
  } catch (error) {
    console.warn('[FlowAttachmentList] 文件下载失败:', error)
    ElMessage.warning('下载失败，请稍后重试')
  }
}
</script>

<style scoped>
.flow-attachments {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0;
}

.flow-attachment {
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  background: #F5F6FA;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.flow-attachment:hover {
  background: #EEF1F7;
}

.flow-attachment__icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.flow-attachment__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.flow-attachment__name {
  font-size: 12px;
  line-height: 18px;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-attachment__meta {
  font-size: 11px;
  line-height: 16px;
  color: #91949E;
}

.flow-attachment__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.flow-attachment:hover .flow-attachment__actions {
  opacity: 1;
  pointer-events: auto;
}

.flow-attachment__action {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
}

.flow-attachment__action:hover {
  background: #E6EAF2;
}

.flow-attachment__action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
