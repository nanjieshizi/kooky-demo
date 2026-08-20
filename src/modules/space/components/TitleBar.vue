<template>
  <div class="title-bar" :class="{ 'is-mac': isMac }">
    <!-- 左侧：logo -->
    <div class="title-bar-left">
      <img :src="logoSvg" class="title-logo" alt="Kooky" />
    </div>

    <!-- 中间：搜索框 + 拖拽区域 -->
    <div class="title-bar-center">
      <!-- 未激活：正常搜索框 -->
      <div v-if="!searchStore.visible" ref="searchBoxRef" class="title-search-box" @click="searchStore.show()">
        <svg class="title-search-icon iconfont" aria-hidden="true" width="16" height="16">
          <use xlink:href="#icon-sousuo1"></use>
        </svg>
        <div class="title-search-divider"></div>
        <span class="title-search-placeholder">搜索任何你想的东西</span>
      </div>
      <!-- 激活：占位保持布局 -->
      <div v-else class="title-search-box title-search-ghost"></div>
    </div>
    <div class="title-bar-drag"></div>

    <!-- 激活态搜索框：Teleport 到 body，脱离 TitleBar 层叠上下文 -->
    <Teleport to="body">
      <div v-if="searchStore.visible" class="title-search-box-teleported" :style="teleportedStyle">
        <svg class="title-search-icon iconfont" aria-hidden="true" width="16" height="16">
          <use xlink:href="#icon-sousuo1"></use>
        </svg>
        <div class="title-search-divider"></div>
        <input
          ref="titleSearchInputRef"
          v-model="searchStore.keyword"
          class="title-search-input"
          placeholder="搜索任何你想的东西"
        />
        <button class="title-search-close" @click="searchStore.hide()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#C0C4CC"/>
            <path d="M10.5 5.5L5.5 10.5M5.5 5.5L10.5 10.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </Teleport>

    <!-- 右侧：系统更新 + 问题反馈 + 用户头像 + Windows 窗口控制占位 -->
    <div class="title-bar-right">
      <UpdateNotification

        :update-status="updateStatus"
        :current-version="currentVersion"
        :new-version="newVersionCode"
        :downloading="showDownloadCard"
        :force-update="showForceUpdate"
        @check-update="silentCheckUpdate"
        @upgrade="handleUpgrade"
      >
        <template #download-bar>
          <UpdateNotifier
            v-if="showDownloadCard"
            ref="updateNotifierRef"
            :show="showDownloadCard"
            @close="showDownloadCard = false"
            @retry="handleRetryDownload"
          />
        </template>
      </UpdateNotification>
      <el-tooltip content="问题反馈" placement="bottom" :show-after="300">
        <div class="feedback-icon-wrap" @click="toggleFeedback">
          <img src="@/assets/navigation/feedback_icon.png" alt="feedback" class="feedback-icon" />
        </div>
      </el-tooltip>
      <el-tooltip content="设置" placement="bottom" :show-after="300">
        <div class="feedback-icon-wrap settings-icon-wrap" @click="toggleSet">
         <img src="@/assets/settings/set_icon.svg" alt="feedback" class="feedback-icon-settings" />
        </div>
      </el-tooltip>
      <el-dropdown
        ref="userDropdownRef"
        trigger="click"
        placement="bottom-end"
        :offset="8"
        :persistent="true"
        popper-class="user-dropdown-popper"
        @command="handleCommand"
        @visible-change="onDropdownVisible"
      >
        <div class="user-avatar-wrap">
          <div class="user-avatar" :class="{ 'has-initial': !userStore.avatar }">
            <img :src="topAvatar" alt="avatar" />
          </div>
        </div>
        <template #dropdown>
          <el-dropdown-menu class="user-dropdown-menu">
            <div class="user-info-header">
              <div class="user-info-avatar">
                <img :src="topAvatar" alt="avatar" />
              </div>
              <div class="user-info-text">
                <div class="user-info-name">{{ displayUserName }}</div>
                <div class="user-info-org">科大讯飞</div>
              </div>
            </div>
            <div class="user-dropdown-divider"></div>
            <div class="update-menu-container">
              <div class="update-menu-row" @click="handleCommand('logout')">
                <img src="@/assets/home/loginout_icon.svg" alt="logout" class="logout-icon" />
                退出登录
              </div>
            </div>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <!-- Windows：窗口控制按钮占位 -->
      <div v-if="!isMac" class="win-controls-placeholder"></div>
    </div>
  </div>

  <!-- 强制更新弹窗 -->
  <ForceUpdateDialog
    v-if="showForceUpdate"
    ref="forceUpdateRef"
    :visible="showForceUpdate"
    :new-version="forceUpdateVersion"
    :current-version="currentVersion"
    :changelog="forceUpdateChangelog"
    @upgrade="handleForceUpgrade"
    @retry="handleForceUpgrade"
  />

  <!-- 问题反馈弹窗 -->
  <FeedbackDialog v-model:visible="showFeedback" />

  <!-- 设置弹窗（新版：模型与用量 + 申请额度） -->
  <SettingsDialogNew v-model="showSettings" />
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import logoSvg from '@/assets/navigation/logo-custom.png'
import topAvatar from '@/assets/avatar-wang-jingbo.webp'
import UpdateNotification from './UpdateNotification.vue'
import UpdateNotifier from '@/modules/updater/components/UpdateNotifier.vue'
import ForceUpdateDialog from '@/modules/updater/components/ForceUpdateDialog.vue'
import FeedbackDialog from '@/shared/components/FeedbackDialog.vue'
import SettingsDialogNew from '@/modules/space/components/SettingsDialogNew.vue'
import { useUserStore } from '@/modules/auth/store'
import { useAgentStore } from '@/modules/agent/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { useSearchStore } from '@/modules/search/store'
import { IS_DEMO } from '@/shared/utils/buildMode'
import {
  logoutClaudeCode,
  clearLocalClaudeCodeConfig,
  postClaudeCodeClientLoginStatus,
} from '@/modules/terminal/claudeKeyService'
import { checkUpdate } from '@/modules/updater/service'
import SvgIcon from '@/shared/components/SvgIcon.vue'
const userStore = useUserStore()
const agentStore = useAgentStore()
const uiStore = useUIStore()
const connectionStore = useImConnectionStore()
const searchStore = useSearchStore()
const displayUserName = '王靖博'

const isMac = window.electronAPI?.platform === 'darwin'
// const isMac = navigator.platform.includes('Mac') ? true : false

const titleSearchInputRef = ref(null)
const searchBoxRef = ref(null)
const teleportedStyle = ref({ top: '14px', left: '50%', transform: 'translateX(-50%)' })

// 搜索弹窗打开时自动聚焦搜索框，并对齐位置
watch(() => searchStore.visible, async (val) => {
  if (val) {
    if (searchBoxRef.value) {
      const rect = searchBoxRef.value.getBoundingClientRect()
      teleportedStyle.value = {
        top: rect.top + 'px',
        left: '50%',
        transform: 'translateX(-50%)',
      }
    }
    await nextTick()
    titleSearchInputRef.value?.focus()
  } else {
    searchStore.setKeyword('')
  }
})

const userInitial = computed(() => {
  const name = userStore.userName || ''
  return name.charAt(0).toUpperCase() || 'U'
})

// 更新相关
const updateStatus = ref('idle')
const currentVersion = ref('')
const updateData = ref(null)
const hasUpdate = ref(false)
const upgrading = ref(false)
const showDownloadCard = ref(false)
const updateNotifierRef = ref(null)
const userDropdownRef = ref(null)
const forceUpdateRef = ref(null)
const showForceUpdate = ref(false)
const forceUpdateVersion = ref('')
const forceUpdateChangelog = ref('')
const showFeedback = ref(false)
const showSettings = ref(false)

// ─── 三个弹窗互斥 ─────────────────────────────────────────────────────────────
function closeAllPopups() {
  showFeedback.value = false
  showSettings.value = false
  if (userDropdownRef.value?.handleClose) userDropdownRef.value.handleClose()
}

function toggleFeedback() {
  const next = !showFeedback.value
  closeAllPopups()
  showFeedback.value = next
}

function toggleSet() {
  const next = !showSettings.value
  closeAllPopups()
  showSettings.value = next
}

function onUpdatePopoverVisibleChange(visible) {
  if (visible) {
    showFeedback.value = false
    showSettings.value = false
    if (userDropdownRef.value?.handleClose) userDropdownRef.value.handleClose()
  }
}

function onDropdownVisible(visible) {
  if (visible) {
    showFeedback.value = false
    showSettings.value = false
  }
}

const newVersionCode = computed(() => updateData.value?.version?.versionCode || '')

async function initUpdateCheck() {
  // dev / demo 模式跳过更新检查 —— 避免本地 demo 被强制更新弹窗卡死
  if (IS_DEMO) {
    console.log('[更新检查] dev / demo 模式跳过')
    return
  }
  if (window.electronAPI?.updater) {
    currentVersion.value = await window.electronAPI.updater.getVersion()
  }
  silentCheckUpdate()
}

onMounted(() => {
  if (userStore.isLoggedIn) initUpdateCheck()
})

watch(() => userStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) initUpdateCheck()
})

async function silentCheckUpdate() {
  // demo 包屏蔽手动检查（避免 UED 误点设置里的"检查更新"按钮拉到生产版）
  if (IS_DEMO) {
    console.log('[更新检查] demo 模式跳过手动检查')
    return
  }
  try {
    const platform = navigator.platform.includes('Mac') ? 'mac' : 'windows'
    const data = await checkUpdate({ currentVersion: currentVersion.value, platform })
    console.log('[更新检查] API 返回数据:', data)

    // 先检查是否强制更新（优先级最高）
    const ver = data?.version || {}
    if (ver.forceUpdate || ver.forceByMinVersion) {
      console.log('[更新检查] 检测到强制更新:', { forceUpdate: ver.forceUpdate, forceByMinVersion: ver.forceByMinVersion })
      updateData.value = data
      forceUpdateVersion.value = ver.versionCode || ''
      forceUpdateChangelog.value = ver.changelog || ''
      showForceUpdate.value = true
      hasUpdate.value = true
      updateStatus.value = 'available'
      return
    }

    // 普通更新检查
    hasUpdate.value = !!(data && data.hasUpdate)
    if (hasUpdate.value) {
      updateData.value = data
      updateStatus.value = 'available'
    }
  } catch (err) {
    console.error('[更新检查] 失败:', err)
  }
}

const DOWNLOAD_CACHE_KEY = 'kc-downloaded-version'

async function checkDownloadCache(versionCode, fileSize) {
  try {
    const raw = localStorage.getItem(DOWNLOAD_CACHE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw)
    if (record.versionCode !== versionCode) {
      localStorage.removeItem(DOWNLOAD_CACHE_KEY)
      return null
    }
    const exists = await window.electronAPI?.updater?.fileExists(record.filePath, fileSize)
    if (!exists) {
      localStorage.removeItem(DOWNLOAD_CACHE_KEY)
      try { await window.electronAPI?.updater?.deleteFile(record.filePath) } catch { /* ignore */ }
      return null
    }
    return record.filePath
  } catch { return null }
}

/**
 * 重新获取最新的下载 URL（预签名 URL 有效期仅 10 分钟）
 */
async function refreshDownloadUrl() {
  const platform = navigator.platform.includes('Mac') ? 'mac' : 'windows'
  const data = await checkUpdate({ currentVersion: currentVersion.value, platform })
  if (data?.packageInfo?.downloadUrl) {
    updateData.value = data
    return data
  }
  return null
}

async function handleRetryDownload() {
  // 重新获取下载 URL（预签名 URL 可能已过期）
  try {
    await refreshDownloadUrl()
  } catch (err) {
    console.error('[更新] 重新获取下载 URL 失败:', err)
    ElMessage.error('获取下载地址失败，请稍后重试')
    return
  }

  const pkg = updateData.value?.packageInfo
  const ver = updateData.value?.version
  if (!pkg?.downloadUrl) {
    ElMessage.error('下载地址无效')
    return
  }

  // 重新开始下载
  const downloadOpts = {
    downloadUrl: pkg.downloadUrl,
    fileName: pkg.fileName || '',
    versionCode: ver?.versionCode || '',
    fileSize: pkg.fileSize || 0,
  }
  await nextTick()
  updateNotifierRef.value?.startDownload(downloadOpts)
}

async function handleUpgrade() {
  // 已经在下载中，不重复触发
  if (showDownloadCard.value) return

  upgrading.value = true
  setTimeout(() => { upgrading.value = false }, 3000)

  // 重新获取下载 URL，避免预签名过期
  try {
    await refreshDownloadUrl()
  } catch { /* 使用已有的 URL */ }

  const pkg = updateData.value?.packageInfo
  const ver = updateData.value?.version
  if (!pkg?.downloadUrl) return
  if (userDropdownRef.value?.handleClose) userDropdownRef.value.handleClose()
  const versionCode = ver?.versionCode || ''
  const downloadOpts = {
    downloadUrl: pkg.downloadUrl,
    fileName: pkg.fileName || '',
    versionCode,
    fileSize: pkg.fileSize || 0,
  }
  const cached = await checkDownloadCache(versionCode, pkg.fileSize)
  if (cached) {
    showDownloadCard.value = true
    await nextTick()
    updateNotifierRef.value?.showCachedResult(versionCode, cached, downloadOpts)
    return
  }
  showDownloadCard.value = true
  await nextTick()
  updateNotifierRef.value?.startDownload(downloadOpts)
}

async function handleForceUpgrade() {
  // 重新获取下载 URL，避免预签名过期
  try {
    await refreshDownloadUrl()
  } catch { /* 使用已有的 URL */ }

  const pkg = updateData.value?.packageInfo
  const ver = updateData.value?.version
  if (!pkg?.downloadUrl) return
  forceUpdateRef.value?.startDownload({
    downloadUrl: pkg.downloadUrl,
    fileName: pkg.fileName || '',
    versionCode: ver?.versionCode || '',
    fileSize: pkg.fileSize || 0,
  })
}

async function handleCommand(cmd) {
  if (cmd === 'feedback') {
    if (userDropdownRef.value?.handleClose) userDropdownRef.value.handleClose()
    showFeedback.value = true
    return
  }
  if (cmd === 'logout') {
    if (userDropdownRef.value?.handleClose) userDropdownRef.value.handleClose()
    uiStore.imConnecting = false
    uiStore.imReady = false
    uiStore.setActivated(false)
    uiStore.setAuthorizationResolved(false)
    uiStore.setActiveNavigation('deerflow', null)
    uiStore.claudeCodeActive = false
    // 暂停 snapshot 保存，防止清空 store 后 onBeforeUnmount 中的 lifecycleSave 覆盖有效数据
    try {
      const { suspendSnapshot } = await import('@/modules/terminal/services/sessionService')
      suspendSnapshot()
    } catch (_) {
      /* noop */
    }
    // 先清空 terminal store（让 allPanels 变空），再卸载 ClaudeCodeView，
    // 避免卸载过程中子组件引用已销毁的 VNode 导致 emitsOptions null 错误
    try {
      const { useTabStore } = await import('@/modules/terminal/stores/tab')
      const { usePanelStore } = await import('@/modules/terminal/stores/panel')
      const { useWorkbenchStore } = await import('@/modules/terminal/stores/workbench')
      usePanelStore().$reset()
      useTabStore().resetAll()
      useWorkbenchStore().$reset()
    } catch (_) {
      /* noop */
    }
    uiStore.claudeCodeVisible = false
    agentStore.$reset()
    await connectionStore.disconnect()
    postClaudeCodeClientLoginStatus('out').catch(() => {})
    logoutClaudeCode().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 1000))
    clearLocalClaudeCodeConfig()
    await userStore.logout()
    window.electronAPI?.claudeCode.cleanupEnv().catch(() => {})
    window.electronAPI?.openCode?.cleanupEnv().catch(() => {})
  }
}
</script>

<style scoped>
.title-bar {
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  background: var(--bg-primary, #F4F5F5);
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
  position: relative;
  z-index: 200;
}

.title-bar-center {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
  margin-left: 20px;
  flex: 1;
}

.title-banner {
  width: 340px;
  height: 38px;
  object-fit: contain;
}

.title-bar-drag {
  justify-content: center;
  flex: 1;
  height: 100%;
}

.title-search-box {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  width: 440px;
  height: 36px;
  background: #FFFFFF;
  border: none;
  border-radius: 100px;
  box-shadow: 0px 0px 1px 0px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.title-search-box:hover {
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.15);
}

.title-search-ghost {
  pointer-events: none;
  opacity: 0;
}

.title-search-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #2F3547;
  fill: #2F3547;
}

.title-search-divider {
  width: 1px;
  height: 14px;
  background: #DFE2EA;
  flex-shrink: 0;
  margin: 0 10px;
}

.title-search-placeholder {
  flex: 1;
  font-size: 14px;
  color: #999999;
  user-select: none;
}

.title-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #262626;

  &::placeholder {
    color: #999999;
  }
}

.title-search-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.8;
  }
}

.title-bar-drag {
  flex: 0;
  height: 100%;
}

.title-bar-left,
.title-bar-right {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 6px;
  padding: 0 20px;
  -webkit-app-region: no-drag;
  position: relative;
  flex-shrink: 0;
}

/* macOS：为红绿灯按钮（关闭/最小化/全屏）预留左侧空间，避免 Logo 覆盖 */
.title-bar.is-mac .title-bar-left {
  padding-left: 92px;
}

.title-bar.is-mac .title-bar-right {
  /* padding-right: 20px; */
}

.title-logo {
  height: 52px;
  width: 122px;
  display: block;
  object-fit: contain;
  filter: contrast(1.12);
}

/* 顶栏问题反馈入口 */
.feedback-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  -webkit-app-region: no-drag;
  /* margin-right: -14px; */
}
.settings-icon-wrap{
  margin-right: 4px;
}

.feedback-icon-wrap:hover {
  background: #E0E2E4;
}

.feedback-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.feedback-icon-settings{
  width: 18px;
  height: 18px;
  object-fit: contain;
}

/* 用户头像 */
.user-avatar-wrap {
  position: relative;
  cursor: pointer;
  -webkit-app-region: no-drag;
  outline: none;
  /* margin-left: 16px; */
}

.user-avatar-wrap:focus,
.user-avatar-wrap:focus-visible {
  outline: none;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(47, 53, 71, 0.12);
  /* margin-right: 8px; */
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar.has-initial {
  background: linear-gradient(135deg, #8478fa, #77c9fb);
}

.avatar-initial {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

/* Windows 窗口控制按钮占位 */
.win-controls-placeholder {
  width: 80px;
  flex-shrink: 0;
}


</style>

<!-- 冒泡框样式：el-dropdown teleport 到 body，必须用非 scoped 全局样式 -->
<style>
.user-dropdown-menu {
  min-width: 200px;
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden;
}

.user-dropdown-menu .user-info-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 12px;
  border-bottom: none;
}

.user-dropdown-menu .user-info-avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-dropdown-menu .user-info-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-dropdown-menu .info-avatar-initial {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.user-dropdown-menu .user-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-dropdown-menu .user-info-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
}

.user-dropdown-menu .user-info-org {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.user-dropdown-menu .user-dropdown-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 12px;
}

.user-dropdown-menu .update-menu-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}

.user-dropdown-menu .update-menu-row:hover {
  background: #f5f5f5;
} 
.user-dropdown-menu .update-menu-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px 0;
}

.user-dropdown-menu .update-menu-row {
  display: flex;
  align-items: center;
  padding: 6px 4px;
  font-size: 13px;
  color: #606572;
  line-height: 1.5;
  border-radius: 8px;
  margin: 0 8px;
  cursor: pointer;
}

.user-dropdown-menu .update-menu-row:hover {
  background: #F5F5F5;
}

.user-dropdown-menu .menu-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 8px;
}

.user-dropdown-menu .logout-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-right: 8px;
}

.user-dropdown-menu .update-text {
  flex: 1;
  color: #606572;
  white-space: nowrap;
}

.user-dropdown-menu .update-action-btn {
  color: #436FF6;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  margin-right: 6px;
}

.user-dropdown-popper .el-popper__arrow {
  display: none !important;
}

.title-search-box-teleported {
  position: fixed;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  width: 440px;
  height: 36px;
  background: #FFFFFF;
  border: 1px solid #FF7D00;
  border-radius: 100px;
  box-shadow: 0px 0px 1px 0px rgba(0, 0, 0, 0.08);
}

.title-search-box-teleported .title-search-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.title-search-box-teleported .title-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #262626;
}

.title-search-box-teleported .title-search-input::placeholder {
  color: #999999;
}

.title-search-box-teleported .title-search-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.title-search-box-teleported .title-search-close:hover {
  opacity: 0.8;
}

</style>
