<template>
  <div class="app-root">
    <LoginDialog
      v-if="!isPreviewWindow && !isDevlocalNoLoginUi && !isDevNoLoginUi"
      :visible="!userStore.isLoggedIn"
      @login-success="handleLoginSuccess"
    />
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <!-- 登录后 Matrix IM 初始化中 / 未就绪时显示 loading -->
    <ConnectingOverlay
      v-if="!isPreviewWindow"
      :visible="
        userStore.isLoggedIn &&
        (uiStore.imConnecting || !uiStore.imReady)
      "
    />
    <!-- 窗口控制按钮：固定在最顶层，遮罩层之上始终可点击（Mac 不显示；预览窗口不显示） -->
    <div v-if="!isMac && !isPreviewWindow" class="app-win-controls">
      <button class="app-win-btn" title="收起" @click="minimize">
        <img :src="foldIcon" class="app-win-icon" alt="收起" />
      </button>
      <button class="app-win-btn" title="全屏" @click="toggleMaximize">
        <img :src="screenIcon" class="app-win-icon" alt="全屏" />
      </button>
      <button class="app-win-btn app-win-close" title="关闭" @click="closeWindow" @mouseenter="closeHover = true" @mouseleave="closeHover = false">
        <img :src="closeHover ? hoverCloseIcon : closeIcon" class="app-win-icon" alt="关闭" />
      </button>
    </div>
    <!-- 全局搜索弹窗 -->
    <GlobalSearchDialog />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'
import ConnectingOverlay from '@/modules/space/components/ConnectingOverlay.vue'
import LoginDialog from '@/modules/auth/components/LoginDialog.vue'
import GlobalSearchDialog from '@/modules/search/components/GlobalSearchDialog.vue'
import { useSearchStore } from '@/modules/search/store'
import { useClaudeCodeStore } from '@/modules/terminal/store'
import { extractClaudeHookIdentifiers } from '@/shared/utils/claudeHookPayload'
import { useSessionGate } from '@/modules/auth/useSessionGate'
import { clearAllMatrixSessionStorage } from '@/shared/utils/storageKey'
import foldIcon from '@/assets/navigation/fold.png'
import screenIcon from '@/assets/navigation/screen.png'
import closeIcon from '@/assets/navigation/close.png'
import hoverCloseIcon from '@/assets/navigation/hoverClose.png'
import { IS_DEMO } from '@/shared/utils/buildMode'

/** devlocal：不挂载登录弹层（登录态由 main 内存注入 + 环境变量 token） */
const isDevlocalNoLoginUi = import.meta.env.MODE === 'devlocal'
/** dev / demo 模式：不挂载登录弹层（dev-mocks 注入 mock 登录态，本地无需登录） */
const isDevNoLoginUi = IS_DEMO

const userStore = useUserStore()
const uiStore = useUIStore()
const searchStore = useSearchStore()
const claudeCodeStore = useClaudeCodeStore()
const { handleLoginSuccess } = useSessionGate()
const route = useRoute()
const isPreviewWindow = computed(() => route.name === 'FilePreview')
if (import.meta.env.MODE !== 'devlocal') {
  userStore.initFromStorage()
}
// 无应用登录态时不保留 Matrix 会话缓存，避免误用上一用户的 HS token
if (!userStore.isLoggedIn) {
  clearAllMatrixSessionStorage()
}

const isMac = window.electronAPI?.platform === 'darwin'
const closeHover = ref(false)

function minimize() { window.electronAPI?.windowMinimize?.() }
function toggleMaximize() { window.electronAPI?.windowMaximize?.() }
function closeWindow() { window.electronAPI?.windowClose?.() }

function handleGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchStore.visible ? searchStore.hide() : searchStore.show()
  }
  // Cmd+Shift+. 切换隐藏文件显示（非 Electron 环境 fallback，或 Electron 中菜单未拦截时）
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '.' || e.key === '>' || e.code === 'Period')) {
    e.preventDefault()
    uiStore.toggleShowHiddenFiles()
  }
}

/** Claude Code HTTP hook：仅同步 store，无控制台日志、无页面提示 */
function onClaudeHookPayload(payload) {
  claudeCodeStore.setLastHookPayload(payload)
  const ids = extractClaudeHookIdentifiers(payload)
  claudeCodeStore.mergeHookIdentifiers(ids)
}
let offClaudeHook = null
let offToggleHidden = null
onMounted(() => {
  if (userStore.isLoggedIn) handleLoginSuccess()
  if (typeof window !== 'undefined' && window.electronAPI?.onClaudeHookEvent) {
    offClaudeHook = window.electronAPI.onClaudeHookEvent(onClaudeHookPayload)
  }
  if (typeof window !== 'undefined' && window.electronAPI?.onToggleHiddenFiles) {
    offToggleHidden = window.electronAPI.onToggleHiddenFiles(() => {
      uiStore.toggleShowHiddenFiles()
    })
  }
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (typeof offClaudeHook === 'function') offClaudeHook()
  if (typeof offToggleHidden === 'function') offToggleHidden()
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style>
.app-root {
  position: relative;
  min-height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Windows 窗口控制按钮：始终在最顶层 */
.app-win-controls {
  position: fixed;
  top: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 6px;
  z-index: 9999;
  -webkit-app-region: no-drag;
}

.app-win-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.app-win-btn:hover {
  background: rgba(47, 53, 71, 0.1);
}

.app-win-close:hover {
  background: #E02200;
}

.app-win-icon {
  width: 12px;
  height: auto;
}
</style>
