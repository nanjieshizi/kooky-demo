<template>
  <Transition name="update-slide">
    <div v-if="visible" class="update-bar">
      <!-- 下载中 -->
      <template v-if="status === 'downloading'">
        <img class="update-bar__spinner" src="@/assets/home/loading_spinner.png" width="16" height="16" />
        <span class="update-bar__text">下载中...<span class="update-bar__percent">{{ Math.round(percent) }}%</span></span>
        <span class="update-bar__action update-bar__action--disabled">立即更新</span>
      </template>

      <!-- 下载成功 -->
      <template v-else-if="status === 'downloaded'">
        <svg class="update-bar__icon" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#52C41A"/><path d="M6.5 12.5l4 4 7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <span class="update-bar__text">下载成功</span>
        <span class="update-bar__action update-bar__action--red" @click="handleInstall">立即重启</span>
      </template>

      <!-- 下载失败 -->
      <template v-else-if="status === 'error'">
        <svg class="update-bar__icon" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#F56C6C"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
        <span class="update-bar__text">下载失败</span>
        <span class="update-bar__action update-bar__action--red" @click="handleRetry">重新下载</span>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  sidebarExpanded: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'retry'])

// idle | downloading | downloaded | error
const status = ref('idle')
const version = ref('')
const percent = ref(0)
const speed = ref(0)
const filePath = ref('')
let lastDownloadOpts = {}

const visible = computed(() => props.show && status.value !== 'idle')

const cleanups = []

onMounted(() => {
  const updater = window.electronAPI?.updater
  if (!updater) return

  cleanups.push(
    updater.onProgress((data) => {
      if (status.value !== 'downloading') return
      const p = data.percent || 0
      if (p >= percent.value) percent.value = p
      if (data.bytesPerSecond > 0) speed.value = data.bytesPerSecond
    }),
    updater.onDownloaded((data) => {
      if (status.value !== 'downloading') return
      if (data?.filePath) filePath.value = data.filePath
      percent.value = 100
      status.value = 'downloaded'
      saveDownloadRecord()
    }),
    updater.onError(() => {
      if (status.value !== 'downloading') return
      status.value = 'error'
    }),
  )
})

onUnmounted(() => {
  cleanups.forEach((off) => off?.())
})

/**
 * 开始下载（由父组件调用）
 * @param {{ downloadUrl: string, fileName: string, versionCode: string, fileSize: number }} opts
 */
async function startDownload({ downloadUrl, fileName, versionCode, fileSize }) {
  lastDownloadOpts = { downloadUrl, fileName, versionCode, fileSize }
  version.value = versionCode
  percent.value = 0
  speed.value = 0
  status.value = 'downloading'

  const updater = window.electronAPI?.updater
  if (!updater?.downloadFromUrl) return

  try {
    // 下载前先清理可能存在的损坏缓存
    await clearDownloadCache(versionCode)

    const result = await updater.downloadFromUrl({ url: downloadUrl, fileName, fileSize })
    if (result.success && result.filePath) {
      filePath.value = result.filePath
      if (status.value === 'downloading') {
        percent.value = 100
        status.value = 'downloaded'
        saveDownloadRecord()
      }
    } else if (!result.success && status.value !== 'error') {
      // 下载失败，清理缓存
      await clearDownloadCache(versionCode)
      status.value = 'error'
    }
  } catch (error) {
    console.error('[UpdateNotifier] 下载异常:', error)
    // 异常时清理缓存
    await clearDownloadCache(versionCode)
    if (status.value !== 'error') {
      status.value = 'error'
    }
  }
}

function handleInstall() {
  if (window.electronAPI?.updater) {
    window.electronAPI.updater.install(filePath.value)
  }
}

function handleRetry() {
  // 通知父组件重新获取下载 URL 后重试（预签名 URL 可能已过期）
  emit('retry')
}

function dismiss() {
  // 如果正在下载，先取消主进程的下载任务
  if (status.value === 'downloading') {
    window.electronAPI?.updater?.cancelDownload?.()
  }
  status.value = 'idle'
  emit('close')
}

const DOWNLOAD_CACHE_KEY = 'kc-downloaded-version'

function saveDownloadRecord() {
  if (!version.value || !filePath.value) return
  localStorage.setItem(DOWNLOAD_CACHE_KEY, JSON.stringify({
    versionCode: version.value,
    filePath: filePath.value,
  }))
}

function clearDownloadRecord() {
  localStorage.removeItem(DOWNLOAD_CACHE_KEY)
}

/**
 * 清理指定版本的下载缓存
 */
async function clearDownloadCache(versionCode) {
  try {
    const raw = localStorage.getItem(DOWNLOAD_CACHE_KEY)
    if (!raw) return

    const record = JSON.parse(raw)
    // 只清理匹配的版本
    if (record.versionCode === versionCode) {
      // 删除缓存的文件
      if (record.filePath && window.electronAPI?.updater?.deleteFile) {
        await window.electronAPI.updater.deleteFile(record.filePath)
        console.log('[UpdateNotifier] 已删除损坏的缓存文件:', record.filePath)
      }
      // 清理 localStorage 记录
      clearDownloadRecord()
      console.log('[UpdateNotifier] 已清理下载缓存')
    }
  } catch (error) {
    console.warn('[UpdateNotifier] 清理缓存失败:', error)
  }
}

/**
 * 检查是否已有该版本的下载缓存，如果文件还在则直接显示下载成功
 * @param {string} versionCode
 * @returns {Promise<boolean>} 是否命中缓存
 */
async function checkCached(versionCode) {
  try {
    const raw = localStorage.getItem(DOWNLOAD_CACHE_KEY)
    if (!raw) return false
    const record = JSON.parse(raw)
    if (record.versionCode !== versionCode) {
      clearDownloadRecord()
      return false
    }
    // 检查文件是否还在
    const exists = await window.electronAPI?.updater?.fileExists(record.filePath)
    if (!exists) {
      clearDownloadRecord()
      return false
    }
    // 命中缓存，直接显示下载成功
    version.value = record.versionCode
    filePath.value = record.filePath
    percent.value = 100
    status.value = 'downloaded'
    return true
  } catch {
    return false
  }
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return '下载中...'
  if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s'
  if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(0) + ' KB/s'
  return (bytesPerSecond / 1024 / 1024).toFixed(1) + ' MB/s'
}

/**
 * 直接显示下载成功（命中缓存时由父组件调用）
 */
async function showCachedResult(versionCode, cachedFilePath, opts) {
  // 保存下载参数，供重试使用
  if (opts) {
    lastDownloadOpts = opts
  }

  // 验证缓存文件是否真实存在且完整
  const updater = window.electronAPI?.updater
  if (updater?.fileExists) {
    const exists = await updater.fileExists(cachedFilePath)
    if (!exists) {
      console.warn('[UpdateNotifier] 缓存文件已损坏，重新下载')
      // 缓存文件无效，清理并标记为错误，让用户点击重试
      await clearDownloadCache(versionCode)
      version.value = versionCode
      status.value = 'error'
      return
    }
  }

  version.value = versionCode
  filePath.value = cachedFilePath
  percent.value = 100
  status.value = 'downloaded'
}

defineExpose({ startDownload, checkCached, showCachedResult })
</script>

<style scoped>
.update-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 16px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.update-bar__spinner {
  flex-shrink: 0;
  animation: update-spin 1s linear infinite;
}

@keyframes update-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.update-bar__icon {
  flex-shrink: 0;
}

.update-bar__text {
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  white-space: nowrap;
}

.update-bar__percent {
  display: inline-block;
  width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.update-bar__action {
  font-family: PingFang SC;
  font-size: 13px;
  font-weight: 500;
  line-height: 22px;
  display: flex;
  align-items: center;
  letter-spacing: normal;
  /* 主色/橘-02 */
  color: #FFDCD6;
  margin-left: 6px;
  cursor: pointer;
}


.update-bar__action--disabled {
  cursor: not-allowed;
}

.update-bar__action--red {
  color: #FF5233;
}

/* ========== 动画 ========== */
.update-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}
.update-slide-leave-active {
  transition: all 0.2s ease;
}
.update-slide-enter-from,
.update-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
