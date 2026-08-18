<template>
  <div class="team-file-preview">
    <!-- 头部 -->
    <div class="preview-header">
      <div class="preview-header-left">
        <img :src="fileIconSrc" class="preview-header-icon" alt="" />
        <span class="preview-header-name" :title="node.name">{{ node.name }}</span>
      </div>
      <div class="preview-header-actions">
        <slot name="header-extra" />
        <button v-if="!isLocalFile" class="preview-download-btn" title="下载" @click="handleDownload">
          <img :src="downloadIcon" width="16" height="16" alt="下载" />
        </button>
        <button
          v-if="(node.mxcUrl || node.httpUrl) && (standalone || showSaveToLibrary)"
          class="preview-save-btn"
          :disabled="savingToLib"
          title="保存到文件库"
          @click="saveToLibrary"
        >
          <img :src="saveIcon" width="16" height="16" alt="保存到文件库" />
        </button>
        <button v-if="!standalone" class="preview-close-btn" @click="$emit('close')">
          <img :src="closeIcon" width="16" height="16" alt="关闭" />
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <slot name="selector-bar" />

    <!-- 源文件 / 预览 tab（仅对 md/html/css/js 显示） -->
    <div v-if="isPreviewable && !loading && !error" class="preview-tab-bar">
      <button class="preview-tab" :class="{ active: previewTab === 'source' }" @click="previewTab = 'source'">源文件</button>
      <button class="preview-tab" :class="{ active: previewTab === 'preview' }" @click="previewTab = 'preview'">预览</button>
    </div>

    <div class="preview-body">
      <div v-if="loading" class="preview-loading">
        <div class="preview-spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="error" class="preview-unsupported">
        <img src="@/assets/home/noPreview.png" class="preview-unsupported-img" alt="" />
        <p class="preview-unsupported-name">{{ error }}</p>
      </div>

      <!-- 大文件虚拟滚动模式 -->
      <VirtualFileViewer
        v-else-if="useLargeFileMode && tempFilePath"
        :file-path="tempFilePath"
        :visible="true"
        @close="$emit('close')"
      />

      <!-- 图片 -->
      <div v-else-if="isImage" class="preview-image-wrap">
        <img :src="previewSrc" class="preview-image" :alt="node.name" />
      </div>

      <!-- Markdown / HTML：预览 tab 显示渲染结果，源文件 tab 显示原始文本 -->
      <iframe
        v-else-if="(ext === 'md' || isHtml) && previewTab === 'preview'"
        :srcdoc="mdHtml"
        class="preview-iframe"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      <div v-else-if="(ext === 'md' || isHtml) && previewTab === 'source'" class="preview-text-wrap">
        <pre class="preview-code"><code>{{ textContent }}</code></pre>
        <div v-if="hasMoreLines" class="preview-load-more">
          <span class="preview-load-more-hint">已显示 {{ loadedLines }} 行，共 {{ fullTextContent.split('\n').length }} 行</span>
          <button class="preview-load-more-btn" @click="loadMoreLines">加载更多</button>
        </div>
      </div>

      <!-- PDF -->
      <iframe
        v-else-if="isPdf"
        :src="previewSrc"
        class="preview-iframe"
      />

      <!-- DOCX / ODT -->
      <div
        v-else-if="isDocx"
        ref="docxContainerRef"
        class="preview-docx-wrap"
      />

      <!-- 纯文本 / 代码 -->
      <div v-else-if="isText" class="preview-text-wrap">
        <pre class="preview-code"><code>{{ textContent }}</code></pre>
        <div v-if="hasMoreLines" class="preview-load-more">
          <span class="preview-load-more-hint">已显示 {{ loadedLines }} 行，共 {{ fullTextContent.split('\n').length }} 行</span>
          <button class="preview-load-more-btn" @click="loadMoreLines">加载更多</button>
        </div>
      </div>

      <!-- 不支持 -->
      <div v-else class="preview-unsupported">
        <img src="@/assets/home/noPreview.png" class="preview-unsupported-img" alt="" />
        <p class="preview-unsupported-name">
          <!-- {{ node.name }} -->
          当前文件不可预览
        </p>
        <!-- <p class="preview-unsupported-meta">
          {{ node.mimeType || '未知类型' }}<span v-if="node.size"> · {{ formatSize(node.size) }}</span>
        </p> -->
        <button v-if="!isLocalFile" class="preview-download-action" @click="handleDownload">下载文件</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import api from '@/shared/services/api'
import { getSsoToken } from '@/shared/services/api'
import { fetchPreviewBlob, getFileUrl, getDownloadUrl } from '@/modules/file/service'
import { useFileStore } from '@/modules/file/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useUserStore } from '@/modules/auth/store'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { threadApi } from '@/modules/deerflow-chat/services/threadApi'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { getOneEnv } from '@/shared/utils/oneEnv'
import { getMatrixHomeserverBaseUrl } from '@/shared/utils/matrixHomeserverUrl'
import { renderAsync } from 'docx-preview'
import VirtualFileViewer from './VirtualFileViewer.vue'
import closeIcon from '@/assets/home/close.svg'
import downloadIcon from '@/assets/home/down.png'
import saveIcon from '@/assets/home/save.png'
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'

const props = defineProps({
  node: { type: Object, required: true },
  spaceId: { type: String, default: '' },
  roomType: { type: String, default: 'group_chat' },
  standalone: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const fileStore = useFileStore()
const uiStore = useUIStore()
const userStore = useUserStore()
const connectionStore = useImConnectionStore()
const deerflowStore = useDeerflowChatStore()
const savingToLib = ref(false)

/** 分身：kc-media 头需已绑定 agent_id */
const showSaveToLibrary = computed(() => {
  if (!props.node?.mxcUrl && !props.node?.httpUrl) return false
  if (uiStore.activePrimaryNav === 'deerflow') {
    const pid = deerflowStore.currentThreadId ?? uiStore.activeSecondaryNav ?? props.spaceId
    if (pid == null) return false
    const row = deerflowStore.threads.find((t) => Number(t.id) === Number(pid))
    return !!row?.agent_id
  }
  return !!props.spaceId
})

// 监听文件切换，重置保存状态（文件A的保存操作在后台继续，不受影响）
watch(() => props.node?.id, (newId, oldId) => {
  if (newId !== oldId && oldId !== undefined) {
    savingToLib.value = false
  }
})

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
const TEXT_EXTS = new Set([
  'md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'vue', 'svelte',
  'py', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'java', 'cs',
  'c', 'cpp', 'h', 'hpp', 'sh', 'bash', 'json', 'yaml', 'yml',
  'toml', 'ini', 'xml', 'css', 'scss', 'less',
  'sql', 'graphql', 'gql', 'r', 'lua', 'pl',
])

const loading = ref(false)
const error = ref('')
const previewSrc = ref('')
const textContent = ref('')
const mdHtml = ref('')
let currentRevoke = null

// docx 渲染容器
const docxContainerRef = ref(null)
const isDocx = computed(() => ext.value === 'docx' || ext.value === 'odt')
let pendingDocxBlob = null

// 源文件/预览 tab（仅对可预览文件类型生效）
const PREVIEWABLE_EXTS = new Set(['md', 'html', 'htm', 'css', 'js'])
const isPreviewable = computed(() => PREVIEWABLE_EXTS.has(ext.value))
const previewTab = ref('source')

// 文件大小限制（字节）
const MAX_PREVIEW_SIZE = 50 * 1024 * 1024  // 统一限制：50MB
const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024  // 2MB 触发虚拟滚动

// 分块加载相关
const LINES_PER_CHUNK = 1000  // 每次加载的行数
const fullTextContent = ref('')  // 完整文本内容
const loadedLines = ref(0)  // 已加载的行数
const hasMoreLines = ref(false)  // 是否还有更多行

// 大文件虚拟滚动模式
const useLargeFileMode = ref(false)
const tempFilePath = ref('')

const hasHttpUrl = computed(() => !!(props.node?.httpUrl || props.node?.mxcUrl))

// node.type = suffix（后端返回的扩展名），优先用它；name 里可能没有扩展名（displayName）
const MIME_TO_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/markdown': 'md',
  'text/plain': 'txt', 'text/html': 'html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

const ext = computed(() => {
  const t = props.node?.type || ''
  if (t && t !== 'folder' && t !== 'file') return t.toLowerCase()
  const name = props.node?.name || ''
  const i = name.lastIndexOf('.')
  if (i > 0) return name.slice(i + 1).toLowerCase()
  // 兜底：从 mimeType 推断
  return MIME_TO_EXT[props.node?.mimeType] || ''
})

const isImage = computed(() => IMAGE_EXTS.has(ext.value))
const isText = computed(() => TEXT_EXTS.has(ext.value))
const isHtml = computed(() => ext.value === 'html' || ext.value === 'htm')
const isPdf = computed(() => ext.value === 'pdf')

// 本地文件（来自本地文件树，仅带 localPath，无云端 id / mxcUrl）：不展示下载按钮
const isLocalFile = computed(() => !!props.node?.localPath)

const fileIconSrc = computed(() => {
  if (!props.node || props.node.type === 'folder') return folderIcon
  const e = ext.value
  if (e === 'md') return mdIcon
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'sh', 'php', 'rb', 'swift', 'kt', 'html', 'css', 'scss', 'json']
  if (codeExts.includes(e)) return codeIcon
  const richTextExts = ['docx', 'doc', 'pdf', 'rtf', 'odt']
  if (richTextExts.includes(e)) return richTextIcon
  if (IMAGE_EXTS.has(e)) return pictureIcon
  return textIcon
})

function revokeOld() {
  if (currentRevoke) { currentRevoke(); currentRevoke = null }
  previewSrc.value = ''
  textContent.value = ''
  fullTextContent.value = ''
  loadedLines.value = 0
  hasMoreLines.value = false
  mdHtml.value = ''
  error.value = ''
  useLargeFileMode.value = false
  previewTab.value = 'source'
  pendingDocxBlob = null
  if (docxContainerRef.value) docxContainerRef.value.innerHTML = ''

  // 清理临时文件
  if (tempFilePath.value) {
    window.electronAPI.fs.deleteTemp(tempFilePath.value).catch(() => {})
    tempFilePath.value = ''
  }
}

// 拉取 mxc 为 Blob：直接走降级策略（Bearer token + httpUrl 兜底）
async function fetchMxcAsBlob(mxcUrl) {
  return fetchMxcAsBlobStandalone(mxcUrl)
}

// 独立窗口降级：mxc:// → v1 Bearer → v3 Bearer → v3 access_token query
// 对齐 fetchMxcBlob（sending.js）的三级降级策略
async function fetchMxcAsBlobStandalone(mxcUrl) {
  if (typeof mxcUrl !== 'string' || !mxcUrl.startsWith('mxc://')) {
    throw new Error('[TeamFilePreview] 无效的 mxc 地址')
  }
  const baseUrl = getMatrixHomeserverBaseUrl().replace(/\/$/, '')
  const token = connectionStore.accessToken || userStore.userInfo?.access_token || ''
  const path = mxcUrl.slice('mxc://'.length)

  const attempts = []
  if (token) {
    attempts.push({ url: `${baseUrl}/_matrix/client/v1/media/download/${path}`, headers: { Authorization: `Bearer ${token}` } })
    attempts.push({ url: `${baseUrl}/_matrix/media/v3/download/${path}`, headers: { Authorization: `Bearer ${token}` } })
  }
  const httpUrl = props.node.httpUrl
  if (httpUrl) attempts.push({ url: httpUrl, headers: {} })

  for (const { url, headers } of attempts) {
    try {
      const res = await fetch(url, { headers })
      if (res.ok) return res.blob()
    } catch { /* fall through */ }
  }
  throw new Error('[TeamFilePreview] 无可用下载策略')
}

// 触发大文件模式（下载到临时文件 + 虚拟滚动）
async function activateLargeFileMode(node) {
  loading.value = true
  try {
    let downloadUrl
    if (hasHttpUrl.value) {
      downloadUrl = node.httpUrl
    } else {
      downloadUrl = await getDownloadUrl(props.spaceId, node.id)
    }
    const result = await window.electronAPI.fs.downloadToTemp(downloadUrl, node.name)
    tempFilePath.value = result.tempFilePath
    useLargeFileMode.value = true
  } catch (e) {
    error.value = '下载文件失败：' + (e?.message || '未知错误')
  } finally {
    loading.value = false
  }
}

async function fetchContent(node) {
  if (!node) return
  revokeOld()

  // ext 为空时，下载文件推断类型并缓存 blob 避免重复下载
  if (!ext.value) {
    const probeUrl = node.httpUrl || node.mxcUrl
    if (probeUrl && /^https?:\/\//i.test(probeUrl)) {
      try {
        let blob = null
        if (/\/api\/threads\/[^/]+\/artifacts\//.test(probeUrl)) {
          blob = await threadApi.fetchThreadArtifactBlob(probeUrl)
        } else {
          const ssoToken = getSsoToken()
          const headers = ssoToken ? { Authorization: `Bearer ${ssoToken}` } : {}
          const res = await fetch(probeUrl, { headers })
          if (res.ok) blob = await res.blob()
        }
        if (blob && blob.size > 0) {
          const ct = blob.type.split(';')[0].trim()
          const inferredExt = MIME_TO_EXT[ct] || ''
          if (inferredExt) {
            node.type = inferredExt
            node._cachedBlob = blob
            await new Promise(r => setTimeout(r, 0))
          }
        }
      } catch { /* 探测失败，继续走原有逻辑 */ }
    }
  }

  const fileSize = node.size || 0

  // 超过 50MB 直接拒绝
  if (fileSize > MAX_PREVIEW_SIZE) {
    error.value = `文件过大（${formatSize(fileSize)}），无法预览。请下载后查看。`
    return
  }

  // 已知大小 >= 2MB 的文本文件 → 大文件模式
  if (fileSize >= LARGE_FILE_THRESHOLD && isText.value && ext.value !== 'md') {
    await activateLargeFileMode(node)
    return
  }

  // 已知大小 >= 2MB 的非文本文件（PDF/图片等）→ 拒绝预览，避免大 blob 撑爆内存
  if (fileSize >= LARGE_FILE_THRESHOLD) {
    error.value = `文件过大（${formatSize(fileSize)}），无法预览。请下载后查看。`
    return
  }

  // size 未知（0）时，对非 mxc 文件先用 HEAD 探测实际大小，防止意外加载超大文件
  if (fileSize === 0 && !hasHttpUrl.value && props.spaceId && node.id) {
    try {
      const downloadUrl = await getDownloadUrl(props.spaceId, node.id)
      const headRes = await fetch(downloadUrl, { method: 'HEAD' })
      const contentLength = parseInt(headRes.headers.get('content-length') || '0')
      if (contentLength > MAX_PREVIEW_SIZE) {
        error.value = `文件过大（${formatSize(contentLength)}），无法预览。请下载后查看。`
        return
      }
      if (contentLength >= LARGE_FILE_THRESHOLD) {
        if (isText.value && ext.value !== 'md') {
          loading.value = true
          try {
            const result = await window.electronAPI.fs.downloadToTemp(downloadUrl, node.name)
            tempFilePath.value = result.tempFilePath
            useLargeFileMode.value = true
          } catch (e) {
            error.value = '下载文件失败：' + (e?.message || '未知错误')
          } finally {
            loading.value = false
          }
        } else {
          error.value = `文件过大（${formatSize(contentLength)}），无法预览。请下载后查看。`
        }
        return
      }
      // contentLength < LARGE_FILE_THRESHOLD → 继续普通预览
    } catch {
      // HEAD 失败：文本文件走安全的 downloadToTemp，非文本拒绝预览
      if (isText.value && ext.value !== 'md') {
        await activateLargeFileMode(node)
      } else {
        error.value = '无法确认文件大小，请下载后查看。'
      }
      return
    }
  }

  loading.value = true
  try {
    if (hasHttpUrl.value) {
      await fetchMxcContent(node)
    } else if (isLocalFile.value) {
      await fetchLocalContent(node)
    } else {
      await fetchTeamContent(node)
    }
  } catch (e) {
    error.value = '预览失败：' + (e?.message || '未知错误')
  } finally {
    loading.value = false
  }
}

async function fetchLocalContent(node) {
  const localUrl = `file://${node.localPath}`
  if (isImage.value) {
    previewSrc.value = localUrl
  } else if (isHtml.value) {
    const raw = await window.electronAPI.fs.readFile(node.localPath, 'utf8')
    mdHtml.value = raw
    loadTextContent(raw)
  } else if (ext.value === 'md') {
    const raw = await window.electronAPI.fs.readFile(node.localPath, 'utf8')
    mdHtml.value = buildMdHtml(raw)
    loadTextContent(raw)
  } else if (isPdf.value) {
    previewSrc.value = localUrl
  } else if (isDocx.value) {
    const arrayBuffer = await window.electronAPI.fs.readFile(node.localPath)
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    await renderDocxBlob(blob)
  } else if (isText.value) {
    const raw = await window.electronAPI.fs.readFile(node.localPath, 'utf8')
    loadTextContent(raw)
  }
}

async function fetchMxcContent(node) {
  // 优先使用 mxcUrl（可能是真正的 mxc:// 或业务直链），兼容只传 httpUrl 的场景
  const resourceUrl = node.mxcUrl || node.httpUrl

  async function fetchBlob(url) {
    if (!url) throw new Error('无法获取文件地址')
    if (node._cachedBlob) {
      const b = node._cachedBlob
      node._cachedBlob = null
      return b
    }
    if (url.startsWith('mxc://')) return fetchMxcAsBlob(url)
    const ssoToken = getSsoToken()
    const headers = ssoToken ? { Authorization: `Bearer ${ssoToken}` } : {}
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.blob()
  }

  if (isImage.value) {
    const blob = await fetchBlob(resourceUrl)
    const url = URL.createObjectURL(blob)
    currentRevoke = () => URL.revokeObjectURL(url)
    previewSrc.value = url
  } else if (isHtml.value) {
    const blob = await fetchBlob(resourceUrl)
    const raw = await blob.text()
    mdHtml.value = raw
    loadTextContent(raw)
  } else if (isText.value) {
    const blob = await fetchBlob(resourceUrl)

    // 兜底保护：即使前置 size 检测失效，也禁止在渲染进程里把大文本一次性转成字符串
    if (ext.value !== 'md' && blob.size >= LARGE_FILE_THRESHOLD) {
      const url = /^https?:\/\//i.test(resourceUrl)
        ? resourceUrl
        : `${getMatrixHomeserverBaseUrl().replace(/\/$/, '')}/_matrix/media/v3/download/${resourceUrl.slice('mxc://'.length)}`
      const result = await window.electronAPI.fs.downloadToTemp(url, node.name)
      tempFilePath.value = result.tempFilePath
      useLargeFileMode.value = true
      return
    }

    const raw = await blob.text()
    if (ext.value === 'md') {
      mdHtml.value = buildMdHtml(raw)
      loadTextContent(raw)
    } else {
      loadTextContent(raw)
    }
  } else if (isPdf.value) {
    const blob = await fetchBlob(resourceUrl)
    const url = URL.createObjectURL(blob)
    currentRevoke = () => URL.revokeObjectURL(url)
    previewSrc.value = url
  } else if (isDocx.value) {
    const blob = await fetchBlob(resourceUrl)
    await renderDocxBlob(blob)
  }
}

async function fetchTeamContent(node) {
  if (isImage.value) {
    const { blobUrl, revoke } = await fetchPreviewBlob(props.spaceId, node.id)
    currentRevoke = revoke
    previewSrc.value = blobUrl
  } else if (isText.value || isHtml.value) {
    // 到达此处时，fetchContent 已确认文件大小安全（< 2MB 或 size 未知但 HEAD 确认小）
    const { blobUrl, revoke } = await fetchPreviewBlob(props.spaceId, node.id)
    currentRevoke = revoke
    const res = await fetch(blobUrl)
    const raw = await res.text()
    revoke(); currentRevoke = null

    if (isHtml.value) {
      mdHtml.value = raw
      loadTextContent(raw)
    } else if (ext.value === 'md') {
      mdHtml.value = buildMdHtml(raw)
      loadTextContent(raw)
    } else {
      loadTextContent(raw)
    }
  } else if (isPdf.value) {
    const { blobUrl, revoke } = await fetchPreviewBlob(props.spaceId, node.id)
    currentRevoke = revoke
    previewSrc.value = blobUrl
  } else if (isDocx.value) {
    const { blobUrl, revoke } = await fetchPreviewBlob(props.spaceId, node.id)
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    revoke()
    await renderDocxBlob(blob)
  }
}

// 分块加载文本内容
function loadTextContent(raw) {
  fullTextContent.value = raw
  const lines = raw.split('\n')
  const totalLines = lines.length

  // 只显示前 N 行
  const initialLines = Math.min(LINES_PER_CHUNK, totalLines)
  textContent.value = lines.slice(0, initialLines).join('\n')
  loadedLines.value = initialLines
  hasMoreLines.value = initialLines < totalLines
}

// 加载更多行
function loadMoreLines() {
  if (!hasMoreLines.value || !fullTextContent.value) return

  const lines = fullTextContent.value.split('\n')
  const totalLines = lines.length
  const nextLines = Math.min(loadedLines.value + LINES_PER_CHUNK, totalLines)

  textContent.value = lines.slice(0, nextLines).join('\n')
  loadedLines.value = nextLines
  hasMoreLines.value = nextLines < totalLines
}

async function renderDocxBlob(blob) {
  pendingDocxBlob = blob
}

function buildMdHtml(raw) {
  const body = md.render(raw)
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #2F3547; line-height: 1.7; }
  pre { background: #F7F8FA; border-radius: 6px; padding: 12px; overflow-x: auto; }
  code { font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace; font-size: 13px; }
  img { max-width: 100%; }
  a { color: #436FF6; }
  blockquote { border-left: 3px solid #D0D5DD; margin: 0; padding-left: 12px; color: #6B7280; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #E5E7EB; padding: 6px 12px; }
  th { background: #F9FAFB; }
</style>
</head><body>${body}
<script>
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a')
    if (!a) return
    var href = a.getAttribute('href')
    if (!href || href.startsWith('#')) return
    e.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
  })
<\/script>
</body></html>`
}

async function handleDownload() {
  try {
    let url = props.node?.httpUrl

    if (!url) {
      const result = await getDownloadUrl(props.spaceId, props.node.id)
      url = typeof result === 'string' ? result : result?.url
    }

    if (!url) {
      ElMessage.warning('下载失败，未获取到下载地址')
      return
    }

    const a = document.createElement('a')
    a.href = url
    a.download = props.node?.name || 'download'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e) {
    console.warn('[TeamFilePreview] 文件下载失败:', e)
    ElMessage.warning('下载失败，请稍后重试')
  }
}

async function saveToLibrary() {
  if ((!props.node?.mxcUrl && !props.node?.httpUrl) || savingToLib.value) return

  // 确保 store 已从 localStorage 初始化（standalone 窗口中 store 初始为空）
  if (!userStore.userInfo) userStore.initFromStorage()

  // 独立预览窗口模式：根据 roomType 设置正确的 businessType
  if (props.standalone) {
    if (!props.spaceId) {
      ElMessage.error('无法保存：缺少会话信息')
      return
    }
    savingToLib.value = true
    try {
      const fileName = props.node.name || props.node.displayName || 'file'

      // 获取文件 Blob
      let blob
      const mxcUrl = props.node.mxcUrl
      const httpUrl = props.node.httpUrl

      // 优先使用 mxc:// URL
      if (mxcUrl && mxcUrl.startsWith('mxc://')) {
        blob = await fetchMxcAsBlobStandalone(mxcUrl)
      } else if (httpUrl) {
        // 使用 HTTP URL
        const response = await fetch(httpUrl)
        if (!response.ok) {
          throw new Error('文件下载失败')
        }
        blob = await response.blob()
      } else if (mxcUrl) {
        // mxcUrl 不是 mxc:// 格式，可能是 HTTP URL
        const response = await fetch(mxcUrl)
        if (!response.ok) {
          throw new Error('文件下载失败')
        }
        blob = await response.blob()
      } else {
        throw new Error('无法获取文件地址')
      }

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('无法获取文件内容')
      }

      // 构建 FormData
      const formData = new FormData()
      formData.append('file', blob, fileName)

      // 根据 roomType 设置 businessType
      let businessType = 'team'
      if (props.roomType === 'bot_person_chat') {
        businessType = 'person'
      } else if (props.roomType === 'super_person_chat') {
        businessType = 'opt'
      } else if (props.roomType === 'group_chat') {
        businessType = 'team'
      }

      // 调用上传接口
      const env = getOneEnv()
      
      const userId = String(userStore.userInfo?.userId ?? '')
      const token = getSsoToken()
      await api.post(
        'kc-media/api/v1/team-files/upload',
        formData,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Business-Type': businessType,
            'X-Business-Id': String(props.spaceId),
            'X-Env': env,
            'X-User-Id': userId,
            'X-Bind-Im-User-Id': String(connectionStore.userId || userId),
          },
        }
      )

      ElMessage.success('已保存到文件库')
      fileStore.refreshQuota(props.spaceId).catch(() => {})
      window.electronAPI?.notifyFileSaved?.({ spaceId: props.spaceId, roomType: props.roomType })
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || '保存失败'
      ElMessage.error(errMsg)
    } finally {
      savingToLib.value = false
    }
    return
  }

  // 非独立窗口模式：使用原有逻辑
  const isDeerflow = uiStore.activePrimaryNav === 'deerflow'
  const deerflowPersonalId = isDeerflow
    ? (deerflowStore.currentThreadId ?? uiStore.activeSecondaryNav ?? props.spaceId ?? null)
    : null
  if (isDeerflow) {
    if (deerflowPersonalId == null) {
      ElMessage.error('未选择会话，无法保存')
      return
    }
    const threadRow = deerflowStore.threads.find((t) => Number(t.id) === Number(deerflowPersonalId))
    const agentId = threadRow?.agent_id
    if (!agentId) {
      ElMessage.error('会话未就绪，请稍后再试')
      return
    }
  } else if (!props.spaceId) {
    return
  }
  savingToLib.value = true
  try {
    const fileName = props.node.name || props.node.displayName || 'file'
    if (isDeerflow) {
      const threadRow = deerflowStore.threads.find((t) => Number(t.id) === Number(deerflowPersonalId))
      const agentId = threadRow?.agent_id
      await threadApi.saveThreadArtifactToKcMedia(String(agentId), props.node.mxcUrl || props.node.httpUrl, fileName, {
        userId: String(userStore.userInfo?.userId ?? ''),
        imBindUserId: String(connectionStore.userId || userStore.userInfo?.userId || ''),
      })
    } else {
      await fileStore.saveFileFromUrl(props.spaceId, props.node.mxcUrl || props.node.httpUrl, fileName)
    }
    ElMessage.success('已保存到文件库')
    const quotaSpaceId = isDeerflow ? String(deerflowPersonalId) : props.spaceId
    fileStore.refreshQuota(quotaSpaceId).catch(() => {})  // 保存成功后刷新容量信息

    // 检测是否在独立预览窗口中（通过 URL hash 判断）
    const isInStandaloneWindow = window.location.hash.includes('/file-preview')

    // 独立预览窗口：通过 IPC 通知主窗口刷新文件树
    // 主窗口内嵌预览：直接派发 DOM 事件，TeamFilePanel 监听刷新
    if (isInStandaloneWindow) {
      window.electronAPI?.notifyFileSaved?.({ spaceId: props.spaceId, roomType: props.roomType })
    } else {
      const isFileTreeOpen =
        uiStore.activeToolTab === 'file' &&
        uiStore.toolFileContentVisible &&
        !uiStore.fileTreeCollapsed

      window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', { detail: { spaceId: props.spaceId, roomType: props.roomType } }))
      if (!isFileTreeOpen) {
        uiStore.setActiveToolTab('file')
      }
    }
  } catch (e) {
    const errMsg = e?.response?.data?.message || e?.message || '保存失败'
    ElMessage.error(errMsg)
  } finally {
    savingToLib.value = false
  }
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

watch(() => props.node, (node) => fetchContent(node), { immediate: true })

watch(loading, async (val) => {
  if (val || !pendingDocxBlob || !isDocx.value) return
  const blob = pendingDocxBlob
  pendingDocxBlob = null
  await nextTick()
  if (!docxContainerRef.value) return
  docxContainerRef.value.innerHTML = ''
  await renderAsync(blob, docxContainerRef.value, undefined, {
    className: 'docx-preview-content',
    inWrapper: false,
    ignoreWidth: true,
    ignoreHeight: true,
    ignoreFonts: false,
    breakPages: true,
    useBase64URL: true,
  })
})

onUnmounted(() => revokeOld())
</script>

<style scoped>
.team-file-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.preview-tab-bar {
  display: flex;
  gap: 4px;
  padding: 2px;
  background: rgba(47, 53, 71, 0.06);
  border-radius: 8px;
  margin: 0 16px 8px;
  flex-shrink: 0;
  width: 156px;
}

.preview-tab {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: #2F3547;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-tab.active {
  background: #fff;
  color: #FF621F;
  font-weight: 600;
  border: 1px solid #ECEEF3;
  box-sizing: border-box;
}

.preview-header {
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  /* border-bottom: 1px solid #F0F2F5; */
  flex-shrink: 0;
}

.preview-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
}

.preview-header-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.preview-header-name {
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.preview-download-btn,
.preview-save-btn,
.preview-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #8C93A6;
  border-radius: 6px;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.preview-download-btn:hover,
.preview-save-btn:hover:not(:disabled),
.preview-close-btn:hover {
  background: rgba(47, 53, 71, 0.06);
  color: #2F3547;
}

.preview-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9CA3AF;
  font-size: 13px;
}

.preview-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #E5E7EB;
  border-top-color: #436FF6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.preview-image-wrap {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
}

.preview-docx-wrap {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
  background: #f5f5f5;
}

:deep(.docx-preview-content) {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  padding: 40px 48px;
  min-height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.preview-code {
  flex: 1;
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #2F3547;
  background: #FAFAFA;
  white-space: pre-wrap;
  word-break: break-all;
}

.preview-text-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-text-wrap .preview-code {
  flex: 1;
  overflow: auto;
}

.preview-load-more {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: #F7F8FA;
  border-top: 1px solid #E5E7EB;
}

.preview-load-more-hint {
  font-size: 12px;
  color: #6B7280;
}

.preview-load-more-btn {
  padding: 6px 16px;
  font-size: 13px;
  color: #436FF6;
  background: #fff;
  border: 1px solid #436FF6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-load-more-btn:hover {
  background: rgba(67, 111, 246, 0.06);
}

.preview-unsupported {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9CA3AF;
  font-size: 13px;
}

.preview-unsupported-img {
  width: 100px;
  height: 100px;
  opacity: 0.5;
}

.preview-unsupported-name {
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.preview-unsupported-meta {
  font-size: 12px;
  color: #9CA3AF;
  text-align: center;
}

.preview-download-action {
  margin-top: 4px;
  padding: 6px 16px;
  font-size: 13px;
  color: #436FF6;
  background: transparent;
  border: 1px solid #436FF6;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.preview-download-action:hover {
  background: rgba(67, 111, 246, 0.06);
}
</style>
