<template>
  <section class="collab-files" aria-label="会话文件">
    <template v-if="previewFile">
      <header class="collab-files__header collab-files__header--preview">
        <button type="button" class="icon-button back-button" aria-label="返回文件列表" @click="closePreview">
          <span aria-hidden="true">‹</span>
        </button>
        <img :src="fileIcon(previewFile)" class="preview-file-icon" alt="" />
        <span class="collab-files__title" :title="previewFile.name">{{ previewFile.name }}</span>
        <div class="preview-actions">
          <button
            type="button"
            class="icon-button"
            :disabled="downloadingId === previewFile.id"
            title="下载"
            @click="downloadFile(previewFile)"
          >↓</button>
          <button
            type="button"
            class="icon-button"
            :disabled="savingId === previewFile.id"
            title="保存到文件库"
            @click="saveFile(previewFile)"
          >⌑</button>
          <button
            v-if="!props.embedded"
            type="button"
            class="icon-button close-button"
            aria-label="关闭会话文件"
            @click="closePanel"
          >×</button>
        </div>
      </header>

      <div class="collab-files__preview">
        <div v-if="previewLoading" class="state-view">
          <span class="spinner" aria-hidden="true"></span>
          <span>正在加载预览…</span>
        </div>
        <div v-else-if="previewError" class="state-view state-view--error">
          <span class="state-icon">!</span>
          <strong>预览失败</strong>
          <p>{{ previewError }}</p>
          <button type="button" class="secondary-button" @click="openPreview(previewFile)">重新加载</button>
        </div>
        <img
          v-else-if="previewMode === 'image'"
          :src="previewObjectUrl"
          :alt="previewFile.name"
          class="image-preview"
        />
        <iframe
          v-else-if="previewMode === 'pdf'"
          :src="previewObjectUrl"
          :title="previewFile.name"
          class="document-preview"
        />
        <iframe
          v-else-if="previewMode === 'html' || previewMode === 'markdown'"
          :srcdoc="previewHtml"
          :title="previewFile.name"
          class="document-preview"
          sandbox="allow-popups"
        />
        <pre v-else-if="previewMode === 'text'" class="text-preview"><code>{{ previewText }}</code></pre>
        <div v-else class="state-view">
          <img :src="fileIcon(previewFile)" class="unsupported-icon" alt="" />
          <strong>当前文件不支持在线预览</strong>
          <p>可以下载到本地，或保存到「文件」后查看。</p>
          <div class="state-actions">
            <button type="button" class="secondary-button" @click="downloadFile(previewFile)">下载</button>
            <button type="button" class="primary-button" @click="saveFile(previewFile)">保存到文件库</button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <header v-if="!props.embedded" class="collab-files__header">
        <div class="header-copy">
          <span class="collab-files__title">会话文件</span>
          <span v-if="total > 0" class="file-count">{{ total }}</span>
        </div>
        <button type="button" class="icon-button close-button" aria-label="关闭会话文件" @click="closePanel">×</button>
      </header>

      <form class="search-box" role="search" @submit.prevent="submitSearch">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchKeyword"
          type="search"
          placeholder="搜索文件"
          aria-label="搜索会话文件"
          @input="scheduleSearch"
        />
        <button v-if="searchKeyword" type="button" class="search-clear" aria-label="清空搜索" @click="clearSearch">×</button>
      </form>

      <div v-if="fallbackMessage" class="fallback-notice" role="status">
        <span class="fallback-notice__tag">演示数据</span>
        <span>{{ fallbackMessage }}</span>
      </div>

      <div class="collab-files__body" @scroll.passive="handleScroll">
        <div v-if="initialLoading" class="state-view">
          <span class="spinner" aria-hidden="true"></span>
          <span>正在加载会话文件…</span>
        </div>

        <div v-else-if="loadError" class="state-view state-view--error">
          <span class="state-icon">!</span>
          <strong>会话文件加载失败</strong>
          <p>{{ loadError }}</p>
          <button type="button" class="secondary-button" @click="loadFiles()">重新加载</button>
        </div>

        <div v-else-if="files.length === 0" class="state-view">
          <div class="empty-folder" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <path d="M6 13a4 4 0 0 1 4-4h10l4 5h14a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V13Z" fill="#F2F3F5" stroke="#C9CDD4" />
              <path d="M7 18h34" stroke="#C9CDD4" />
            </svg>
          </div>
          <strong>{{ searchKeyword ? '没有找到匹配文件' : '暂无会话文件' }}</strong>
          <p>{{ searchKeyword ? '换个关键词试试' : '群内上传和数字人产出的文件会汇总在这里' }}</p>
        </div>

        <template v-else>
          <div class="file-list">
            <div
              v-for="file in files"
              :key="file.id"
              class="file-row"
              role="button"
              tabindex="0"
              @click="openPreview(file)"
              @keydown.enter.prevent="openPreview(file)"
            >
              <img :src="fileIcon(file)" class="file-row__icon" alt="" />
              <span class="file-row__content">
                <span class="file-row__name" :title="file.name">{{ file.name }}</span>
                <span class="file-row__meta">
                  <span v-if="file.sender">{{ file.sender }}</span>
                  <span>{{ formatFileTime(file.sendTime) }}</span>
                  <span v-if="file.size">{{ formatFileSize(file.size) }}</span>
                </span>
              </span>
              <span class="file-row__actions">
                <button
                  type="button"
                  class="row-action"
                  title="保存到文件库"
                  :disabled="savingId === file.id"
                  @click.stop="saveFile(file)"
                >⌑</button>
                <button
                  type="button"
                  class="row-action"
                  title="下载"
                  :disabled="downloadingId === file.id"
                  @click.stop="downloadFile(file)"
                >↓</button>
              </span>
              <span class="file-row__arrow" aria-hidden="true">›</span>
            </div>
          </div>

          <div class="pagination-state">
            <span v-if="loadingMore" class="loading-more"><span class="spinner spinner--small"></span>正在加载…</span>
            <button v-else-if="hasMore" type="button" class="load-more-button" @click="loadFiles({ append: true })">加载更多</button>
            <span v-else-if="files.length > 0" class="all-loaded">已加载全部文件</span>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { useGroupStore } from '@/modules/group/store'
import { useFileStore } from '@/modules/file/store'
import { useFileLibraryStore } from '@/modules/file/store/fileLibraryStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import {
  COLLAB_CONVERSATION_FILE_PAGE_SIZE,
  fetchCollabConversationFileBlob,
  fetchCollabConversationFiles,
  triggerCollabConversationFileDownload,
} from '@/modules/collaboration/services/conversationFiles'

defineOptions({ name: 'CollabConversationFilesPanel' })

const props = defineProps({
  conversationId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  previewRequest: { type: Object, default: null },
})
const emit = defineEmits(['close', 'preview-change'])

const groupStore = useGroupStore()
const cloudFileStore = useFileStore()
const localFileLibrary = useFileLibraryStore()
const sidePanel = useSidePanelStore()
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true })

const conversationId = computed(() => (
  props.conversationId
  || groupStore.currentSpaceId
  || groupStore.currentConversationId
  || ''
))
const conversationMessages = computed(() => (
  groupStore.conversationMessages?.[conversationId.value]?.messages || []
))

const files = ref([])
const total = ref(0)
const currentPage = ref(1)
const hasMore = ref(false)
const initialLoading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const fallbackMessage = ref('')
const searchKeyword = ref('')
const savingId = ref('')
const downloadingId = ref('')
const previewFile = ref(null)
const previewLoading = ref(false)
const previewError = ref('')
const previewMode = ref('unsupported')
const previewText = ref('')
const previewHtml = ref('')
const previewObjectUrl = ref('')
let requestSerial = 0
let searchTimer = null

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
const TEXT_EXTENSIONS = new Set([
  'txt', 'json', 'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'less',
  'py', 'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'sql', 'yaml', 'yml',
  'xml', 'csv', 'sh', 'bash', 'toml', 'ini', 'log',
])

function extensionOf(file) {
  if (file?.type) return String(file.type).replace(/^\./, '').toLowerCase()
  const name = String(file?.name || '')
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index + 1).toLowerCase() : ''
}

function previewModeOf(file) {
  const extension = extensionOf(file)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (TEXT_EXTENSIONS.has(extension) || String(file?.mimeType || '').startsWith('text/')) return 'text'
  return 'unsupported'
}

function fileIcon(file) {
  return getChatFileIconSrc(getChatFileTypeFromName(file?.name || ''))
}

function mergeFiles(current, incoming) {
  const merged = new Map(current.map((file) => [String(file.id), file]))
  for (const file of incoming) merged.set(String(file.id), file)
  return [...merged.values()]
}

function readableError(error, fallback) {
  const status = error?.response?.status ?? error?.status
  if (status === 403 || status === 404) return '文件已过期或无权访问'
  return error?.response?.data?.message
    || error?.response?.data?.msg
    || error?.message
    || fallback
}

async function loadFiles({ append = false } = {}) {
  const id = conversationId.value
  if (!id) {
    files.value = []
    total.value = 0
    loadError.value = '请先选择一个群聊'
    return
  }
  if (append && (loadingMore.value || !hasMore.value)) return
  const serial = ++requestSerial
  const page = append ? currentPage.value + 1 : 1
  if (append) loadingMore.value = true
  else initialLoading.value = true
  loadError.value = ''

  try {
    const result = await fetchCollabConversationFiles({
      conversationId: id,
      filename: searchKeyword.value,
      page,
      size: COLLAB_CONVERSATION_FILE_PAGE_SIZE,
      messages: conversationMessages.value,
    })
    if (serial !== requestSerial) return
    files.value = append ? mergeFiles(files.value, result.items) : result.items
    currentPage.value = result.page
    total.value = result.total
    hasMore.value = result.hasMore
    fallbackMessage.value = result.fallbackMessage || ''
  } catch (error) {
    if (serial !== requestSerial) return
    if (!append) {
      files.value = []
      total.value = 0
      hasMore.value = false
      fallbackMessage.value = ''
      loadError.value = readableError(error, '加载失败，请重试')
    } else {
      ElMessage.error(readableError(error, '加载更多失败'))
    }
  } finally {
    if (serial === requestSerial) {
      initialLoading.value = false
      loadingMore.value = false
    }
  }
}

function submitSearch() {
  clearTimeout(searchTimer)
  searchTimer = null
  void loadFiles()
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    void loadFiles()
  }, 320)
}

function clearSearch() {
  searchKeyword.value = ''
  submitSearch()
}

function handleScroll(event) {
  if (!hasMore.value || loadingMore.value || initialLoading.value) return
  const target = event.currentTarget
  if (target.scrollHeight - target.scrollTop - target.clientHeight <= 80) {
    void loadFiles({ append: true })
  }
}

function revokePreviewUrl() {
  if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value)
  previewObjectUrl.value = ''
}

function buildMarkdownDocument(content) {
  const body = markdown.render(content)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:24px 28px;color:#2f3547;font:14px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    h1,h2,h3{line-height:1.35}pre{padding:12px;overflow:auto;border-radius:8px;background:#f7f8fa}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}blockquote{margin-left:0;padding-left:12px;border-left:3px solid #d9dce3;color:#6f7583}
    table{border-collapse:collapse;width:100%}th,td{padding:7px 10px;border:1px solid #e5e6eb}img{max-width:100%}a{color:#ff621f}
  </style></head><body>${body}</body></html>`
}

function assertCurrentConversationFile(file) {
  const currentId = String(conversationId.value || '')
  const sourceId = String(file?.conversationId || '')
  if (currentId && sourceId && currentId !== sourceId) {
    throw new Error('会话已经切换，请在当前群重新打开文件')
  }
}

async function openPreview(file) {
  if (!file) return
  try {
    assertCurrentConversationFile(file)
  } catch (error) {
    ElMessage.error(readableError(error, '无法预览该文件'))
    return
  }
  previewFile.value = file
  previewMode.value = previewModeOf(file)
  previewError.value = ''
  previewText.value = ''
  previewHtml.value = ''
  revokePreviewUrl()
  if (!props.embedded) sidePanel.setWide(true)
  emit('preview-change', file)
  if (previewMode.value === 'unsupported') return

  previewLoading.value = true
  try {
    const blob = await fetchCollabConversationFileBlob(file, {
      conversationId: conversationId.value,
    })
    if (previewFile.value?.id !== file.id) return
    if (previewMode.value === 'image' || previewMode.value === 'pdf') {
      previewObjectUrl.value = URL.createObjectURL(blob)
      return
    }
    const text = await blob.text()
    if (previewMode.value === 'markdown') previewHtml.value = buildMarkdownDocument(text)
    else if (previewMode.value === 'html') previewHtml.value = text
    else previewText.value = text
  } catch (error) {
    if (previewFile.value?.id === file.id) {
      previewError.value = readableError(error, '无法预览该文件')
    }
  } finally {
    if (previewFile.value?.id === file.id) previewLoading.value = false
  }
}

function closePreview() {
  previewFile.value = null
  previewLoading.value = false
  previewError.value = ''
  revokePreviewUrl()
  if (!props.embedded) sidePanel.setWide(false)
  emit('preview-change', null)
}

function closePanel() {
  closePreview()
  if (props.embedded) {
    emit('close')
    return
  }
  sidePanel.close()
}

async function downloadFile(file) {
  if (!file || downloadingId.value) return
  downloadingId.value = file.id
  try {
    assertCurrentConversationFile(file)
    const blob = await fetchCollabConversationFileBlob(file, {
      conversationId: conversationId.value,
    })
    triggerCollabConversationFileDownload(blob, file.name)
    ElMessage.success(`已下载「${file.name}」`)
  } catch (error) {
    ElMessage.error(readableError(error, '下载失败，请重试'))
  } finally {
    downloadingId.value = ''
  }
}

async function saveFile(file) {
  if (!file || savingId.value) return
  savingId.value = file.id
  try {
    assertCurrentConversationFile(file)
    if (file.isLocalFallback || file.inlineContent) {
      const added = localFileLibrary.addFile({
        name: file.name,
        type: file.type || 'other',
        previewType: file.type || 'other',
        content: file.inlineContent || '',
        size: formatFileSize(file.size),
        bytes: file.size || 0,
      })
      ElMessage[added ? 'success' : 'info'](
        added ? `已保存「${file.name}」到文件库` : `「${file.name}」已在文件库中`,
      )
      return
    }
    if (!file.httpUrl) throw new Error('该文件暂无可用保存地址')
    await cloudFileStore.saveFileFromUrl(conversationId.value, file.httpUrl, file.name)
    ElMessage.success(`已保存「${file.name}」到文件库`)
    window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
      detail: { spaceId: conversationId.value, roomType: 'group_chat' },
    }))
  } catch (error) {
    ElMessage.error(readableError(error, '保存失败，请重试'))
  } finally {
    savingId.value = ''
  }
}

function formatFileSize(value) {
  const bytes = Number(value) || 0
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatFileTime(value) {
  if (!value) return ''
  const timestamp = typeof value === 'number' ? value : new Date(String(value).replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) return String(value)
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

watch(conversationId, () => {
  searchKeyword.value = ''
  closePreview()
  void loadFiles()
}, { immediate: true })

watch(
  () => props.previewRequest?.serial,
  () => {
    const file = props.previewRequest?.file
    if (file) void openPreview(file)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  requestSerial += 1
  clearTimeout(searchTimer)
  revokePreviewUrl()
  if (!props.embedded) sidePanel.setWide(false)
})
</script>

<style scoped>
.collab-files {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  color: #2f3547;
}

.collab-files__header {
  height: 50px;
  min-height: 50px;
  padding: 0 14px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.collab-files__header--preview {
  border-bottom: 1px solid #f2f3f5;
}

.header-copy,
.preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-copy {
  min-width: 0;
}

.preview-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.collab-files__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}

.file-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.icon-button,
.row-action {
  border: 0;
  background: transparent;
  color: #606572;
  cursor: pointer;
}

.icon-button {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 17px;
}

.icon-button:hover:not(:disabled),
.row-action:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.icon-button:disabled,
.row-action:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.back-button {
  flex-shrink: 0;
  font-size: 24px;
}

.close-button {
  font-size: 18px;
}

.preview-file-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}

.search-box {
  height: 34px;
  margin: 2px 14px 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f5f6f7;
  color: #86909c;
}

.search-box:focus-within {
  border-color: rgba(255, 98, 31, .35);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(255, 98, 31, .06);
}

.search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #2f3547;
  font: inherit;
  font-size: 13px;
}

.search-box input::-webkit-search-cancel-button {
  display: none;
}

.search-clear {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9aa0aa;
  cursor: pointer;
}

.fallback-notice {
  margin: 0 14px 10px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 98, 31, .14);
  border-radius: 8px;
  background: rgba(255, 98, 31, .04);
  color: #8a5a46;
  font-size: 11px;
  line-height: 1.5;
}

.fallback-notice__tag {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(255, 98, 31, .1);
  color: #e95a1d;
  line-height: 17px;
}

.collab-files__body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 14px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-row {
  min-height: 58px;
  padding: 7px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 9px;
  cursor: pointer;
  outline: none;
}

.file-row:hover,
.file-row:focus-visible {
  background: #f7f8fa;
}

.file-row__icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex-shrink: 0;
}

.file-row__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2f3547;
  font-size: 13px;
}

.file-row__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  color: #a0a5b0;
  font-size: 11px;
  white-space: nowrap;
}

.file-row__meta span + span::before {
  content: '·';
  margin-right: 7px;
  color: #d3d6dc;
}

.file-row__actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.file-row:hover .file-row__actions,
.file-row:focus-within .file-row__actions {
  display: flex;
}

.file-row:hover .file-row__arrow,
.file-row:focus-within .file-row__arrow {
  display: none;
}

.row-action {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  font-size: 15px;
}

.file-row__arrow {
  color: #c9cdd4;
  font-size: 18px;
}

.state-view {
  min-height: 220px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9aa0aa;
  text-align: center;
  font-size: 12px;
}

.state-view strong {
  color: #606572;
  font-size: 13px;
}

.state-view p {
  max-width: 300px;
  margin: 0;
  line-height: 1.6;
}

.state-view--error .state-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff2f0;
  color: #f53f3f;
  font-size: 18px;
  line-height: 32px;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #e5e6eb;
  border-top-color: #ff621f;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.spinner--small {
  width: 13px;
  height: 13px;
  border-width: 1.5px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.secondary-button,
.primary-button,
.load-more-button {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
}

.secondary-button,
.load-more-button {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
}

.primary-button {
  border: 1px solid #ff621f;
  background: #ff621f;
  color: #fff;
}

.state-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.pagination-state {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b0b4bc;
  font-size: 11px;
}

.loading-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.load-more-button {
  height: 28px;
}

.collab-files__preview {
  min-height: 0;
  flex: 1;
  overflow: auto;
  display: flex;
  background: #fafbfc;
}

.collab-files__preview > .state-view {
  min-height: 0;
  flex: 1;
}

.image-preview {
  max-width: calc(100% - 40px);
  max-height: calc(100% - 40px);
  margin: auto;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(31, 35, 41, .08);
}

.document-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}

.text-preview {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 22px 24px;
  overflow: auto;
  background: #fff;
  color: #2f3547;
  font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.unsupported-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
</style>
