<template>
  <Transition name="force-fade">
    <div v-if="visible" class="force-update-mask">
      <!-- 状态1：版本信息 + 立即更新 -->
      <div v-if="stage === 'info'" class="force-update-card">
        <div class="force-update-body">
          <div class="force-update-content">
            <h2 class="force-update-title">V{{ newVersion }} 新版本已就绪</h2>
            <p class="force-update-desc">
              当前版本V{{ currentVersion }}，为确保功能正常运行，请完成升级后继续使用。
            </p>
            <div class="force-update-changelog" :class="{ 'force-update-changelog--empty': !changelog }">
              <template v-if="changelog">
                <h4 class="changelog-title">版本更新说明</h4>
                <div class="changelog-md" v-html="renderedChangelog"></div>
              </template>
            </div>
            <button class="force-update-btn" @click="handleUpgrade">立即更新</button>
          </div>
        </div>
      </div>

      <!-- 状态2：下载中 -->
      <div v-else-if="stage === 'downloading'" class="force-download-card">
        <div class="force-download-bg"></div>
        <div class="force-download-bottom">
          <div class="force-download-bar">
            <div class="force-download-fill" :style="{ width: percent + '%' }"></div>
          </div>
          <div class="force-download-info">
            <span class="force-download-label">下载中 {{ Math.round(percent) }}%</span>
            <span class="force-download-note">{{ changelogBrief }}</span>
          </div>
        </div>
      </div>

      <!-- 状态3：下载成功 -->
      <div v-else-if="stage === 'downloaded'" class="force-success-card">
        <div class="force-success-bottom">
          <div class="force-success-status">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#52C41A"/><path d="M5.5 10.5l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            <span class="force-success-text">下载成功</span>
            <span class="force-success-version">版本:V {{ downloadVersion }}</span>
          </div>
          <button class="force-success-btn" @click="handleInstall">立即更新</button>
        </div>
      </div>

      <!-- 状态4：下载失败 -->
      <div v-else-if="stage === 'error'" class="force-error-card">
        <div class="force-error-bottom">
          <div class="force-error-status">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#F56C6C"/><path d="M10 5.5v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.5" r="1.2" fill="#fff"/></svg>
            <span class="force-error-text">下载失败</span>
            <span class="force-error-version">版本:V {{ downloadVersion }}</span>
          </div>
          <button class="force-error-btn" @click="handleRetry">重新下载</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, breaks: true })

const props = defineProps({
  visible: { type: Boolean, default: false },
  newVersion: { type: String, default: '' },
  currentVersion: { type: String, default: '' },
  changelog: { type: String, default: '' },
})

const emit = defineEmits(['upgrade', 'retry'])

// info | downloading | downloaded | error
const stage = ref('info')
const percent = ref(0)
const speed = ref(0)
const filePath = ref('')
const downloadVersion = ref('')
let downloadOpts = {}
let downloadStarted = false // 标记是否真正开始了下载
let downloadId = 0 // 每次下载递增，用于过滤过期事件

const renderedChangelog = computed(() => {
  if (!props.changelog) return ''
  return md.render(props.changelog)
})

// 取 changelog 第一行纯文本作为下载时的简要提示
const changelogBrief = computed(() => {
  const notes = props.changelog || ''
  if (!notes) return ''
  const lines = notes.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  const first = lines[0] || ''
  return first.replace(/^[-•*]\s*/, '').trim()
})

const cleanups = []

onMounted(() => {
  const updater = window.electronAPI?.updater
  if (!updater) return

  cleanups.push(
    updater.onProgress((data) => {
      if (stage.value !== 'downloading') return
      const p = data.percent || 0
      if (p >= percent.value) percent.value = p
      if (data.bytesPerSecond > 0) speed.value = data.bytesPerSecond
    }),
    updater.onDownloaded((data) => {
      if (stage.value !== 'downloading') return
      if (data?.filePath) filePath.value = data.filePath
      percent.value = 100
      stage.value = 'downloaded'
      saveDownloadRecord()
    }),
    updater.onError(() => {
      // 只在真正开始下载后才响应错误，避免 autoUpdater 自身检查失败或删除文件误触发
      if (stage.value !== 'downloading' || !downloadStarted) return
      // 忽略过期的错误事件（上一次下载的残留）
      stage.value = 'error'
    }),
  )
})

onUnmounted(() => {
  cleanups.forEach((off) => off?.())
})

function handleUpgrade() {
  emit('upgrade')
}

/**
 * 由父组件调用：开始下载，切换到下载中状态
 */
async function startDownload({ downloadUrl, fileName, versionCode, fileSize }) {
  downloadOpts = { downloadUrl, fileName, versionCode, fileSize }
  downloadVersion.value = versionCode
  percent.value = 0
  speed.value = 0
  stage.value = 'downloading'
  downloadStarted = false

  const thisDownloadId = ++downloadId
  const updater = window.electronAPI?.updater
  if (!updater?.downloadFromUrl) return

  try {
    // 下载前先清理可能存在的损坏缓存
    await clearDownloadCache(versionCode)

    // 删除同名安装包文件，确保重新下载
    if (fileName && updater.deleteFile) {
      const downloads = await window.electronAPI?.getPath?.('downloads')
      if (downloads) {
        await updater.deleteFile(`${downloads}/${fileName}`)
      }
    }

    // 如果在清理期间又触发了新的下载，放弃当前这次
    if (thisDownloadId !== downloadId) return

    downloadStarted = true
    const result = await updater.downloadFromUrl({ url: downloadUrl, fileName, fileSize })

    // 如果已经不是当前这次下载了，忽略结果
    if (thisDownloadId !== downloadId) return

    if (result.success && result.filePath) {
      filePath.value = result.filePath
      if (stage.value === 'downloading') {
        percent.value = 100
        stage.value = 'downloaded'
        saveDownloadRecord()
      }
    } else if (!result.success && stage.value !== 'error') {
      if (result.message === '下载已取消') return
      await clearDownloadCache(versionCode)
      stage.value = 'error'
    }
  } catch (error) {
    // 过期的下载，忽略
    if (thisDownloadId !== downloadId) return
    console.error('[ForceUpdate] 下载异常:', error)
    await clearDownloadCache(versionCode)
    if (stage.value !== 'error') {
      stage.value = 'error'
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

const DOWNLOAD_CACHE_KEY = 'kc-downloaded-version'

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
        console.log('[ForceUpdate] 已删除损坏的缓存文件:', record.filePath)
      }
      // 清理 localStorage 记录
      localStorage.removeItem(DOWNLOAD_CACHE_KEY)
      console.log('[ForceUpdate] 已清理下载缓存')
    }
  } catch (error) {
    console.warn('[ForceUpdate] 清理缓存失败:', error)
  }
}

function saveDownloadRecord() {
  if (!downloadVersion.value || !filePath.value) return
  localStorage.setItem(DOWNLOAD_CACHE_KEY, JSON.stringify({
    versionCode: downloadVersion.value,
    filePath: filePath.value,
  }))
}

/** 直接显示下载成功（命中缓存时由父组件调用） */
async function showDownloaded(versionCode, cachedFilePath, opts) {
  // 保存下载参数，供重试使用
  if (opts) {
    downloadOpts = opts
  }

  // 验证缓存文件是否真实存在且完整
  const updater = window.electronAPI?.updater
  if (updater?.fileExists) {
    const exists = await updater.fileExists(cachedFilePath)
    if (!exists) {
      console.warn('[ForceUpdate] 缓存文件已损坏，重新下载')
      // 缓存文件无效，清理并重新下载
      await clearDownloadCache(versionCode)
      stage.value = 'error'
      downloadVersion.value = versionCode
      return
    }
  }

  downloadVersion.value = versionCode
  filePath.value = cachedFilePath
  percent.value = 100
  stage.value = 'downloaded'
}

/** 重置为 info 状态 */
function reset() {
  stage.value = 'info'
  percent.value = 0
}

defineExpose({ startDownload, showDownloaded, reset })
</script>

<style scoped>
.force-update-mask {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========== 信息卡片（立即更新） ========== */
.force-update-card {
  width: 690px;
  min-height: 308px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: url('@/assets/home/force_update_bg.png') no-repeat center / cover;
  background-position: right;
}

.force-update-body {
  padding: 36px 32px 32px;
}

.force-update-content {
  flex: 1;
  min-width: 0;
}

.force-update-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.force-update-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: #888;
  line-height: 1.6;
}

.force-update-changelog {
  margin-bottom: 24px;
}

.force-update-changelog--empty {
  min-height: 120px;
}

.changelog-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.changelog-md {
  font-size: 13px;
  color: #555;
  line-height: 1.7;
  max-height: 120px;
  overflow-y: auto;
}

.changelog-md :deep(h1),
.changelog-md :deep(h2),
.changelog-md :deep(h3),
.changelog-md :deep(h4) {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin: 8px 0 4px;
}

.changelog-md :deep(ul),
.changelog-md :deep(ol) {
  margin: 0;
  padding-left: 18px;
}

.changelog-md :deep(li) {
  margin: 2px 0;
}

.changelog-md :deep(p) {
  margin: 4px 0;
}

.force-update-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 28px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #1a1a2e;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.force-update-btn:hover {
  background: #2d2d44;
}

/* ========== 下载卡片（下载中 / 成功 / 失败） ========== */
.force-download-card {
  width: 560px;
  height: 308px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: #fff;
  display: flex;
  flex-direction: column;
}

.force-download-bg {
  flex: 1;
  min-height: 200px;
  background: url('@/assets/home/force_download_bg.png') no-repeat center top / cover;
}

.force-download-bottom {
  padding: 0 28px 24px;
}

.force-download-bar {
  height: 6px;
  background: #e0e3e8;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}

.force-download-fill {
  height: 100%;
  background: #1a1a2e;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.force-download-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.force-download-label {
  font-size: 14px;
  color: #606572;
  font-weight: 500;
}

.force-download-note {
  font-size: 13px;
  color: #91949E;
}

/* ========== 下载成功 ========== */
.force-success-card {
  width: 560px;
  height: 308px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: url('@/assets/home/force_download_bg.png') no-repeat center top / cover;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.force-success-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 28px 53px;
  gap: 16px;
}

.force-success-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.force-success-text {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.force-success-version {
  font-size: 14px;
  color: #91949E;
}

.force-success-btn {
  padding: 10px 36px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #1a1a2e;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.force-success-btn:hover {
  background: #2d2d44;
}

/* ========== 下载失败 ========== */
.force-error-card {
  width: 560px;
  height: 308px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  background: url('@/assets/home/force_download_bg.png') no-repeat center top / cover;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.force-error-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 28px 53px;
  gap: 16px;
}

.force-error-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.force-error-text {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.force-error-version {
  font-size: 14px;
  color: #91949E;
}

.force-error-btn {
  padding: 10px 36px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #1a1a2e;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.force-error-btn:hover {
  background: #2d2d44;
}

/* ========== 动画 ========== */
.force-fade-enter-active {
  transition: opacity 0.3s ease;
}
.force-fade-leave-active {
  transition: opacity 0.2s ease;
}
.force-fade-enter-from,
.force-fade-leave-to {
  opacity: 0;
}
</style>
