<template>
  <div class="detached-terminal" :style="{ background: theme.background || '#0d1117' }">
    <div class="detached-toolbar" :style="toolbarStyle">
      <span class="detached-title">{{ title }}</span>
    </div>
    <div class="terminal-with-feedback">
      <TerminalSearchBar
        v-if="showSearchBar"
        :theme="theme"
        :current-index="searchResultIndex"
        :result-count="searchResultCount"
        @search="handleSearch"
        @find-next="handleSearchNext"
        @find-previous="handleSearchPrev"
        @close="closeSearchBar"
      />
      <div class="terminal-container" ref="containerRef"></div>
      <ClaudeCodeStopFeedbackBar
        v-if="showFeedbackBar"
        :reply-text="feedbackReplyText"
        :response-id="feedbackResponseId"
        :session-id="feedbackSessionId"
        :term-id="termId"
        :theme="theme"
        @dismiss="onFeedbackBarDismiss"
        @layout="fitTerminal"
      />
      <Teleport to="body">
        <div
          v-if="contextMenu.visible"
          class="terminal-context-menu"
          :style="contextMenuStyle"
          @click.stop
        >
          <div
            v-for="action in terminalContextActions"
            :key="action.key"
            class="terminal-context-menu-item"
            :class="{ disabled: action.disabled }"
            @click="handleContextMenuAction(action)"
          >
            {{ action.label }}
          </div>
        </div>
        <div
          v-if="contextMenu.visible"
          class="terminal-context-overlay"
          @click="closeContextMenu"
          @contextmenu.prevent="closeContextMenu"
        />
      </Teleport>
    </div>
    <ShortcutBar
      :theme="theme"
      :active-panel="activePanel"
      @send-command="handleShortcutSendCommand"
      @send-command-all="handleShortcutSendCommand"
    />
  </div>
</template>

<script setup>
/**
 * 独立终端窗口中的终端组件
 * 连接到已有的 PTY 进程（不创建新的 PTY）
 * 通过主进程 IPC 接收初始化参数
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { useTerminalShortcuts } from '@/composables/useTerminalShortcuts'
import { extractStopHookReplyContext } from '@/modules/terminal/utils/claudeHookPayload'
import { getSubmittedFeedbackRecord } from '@/modules/terminal/services/persistentUserDataService'
import {
  initializeFeedbackStrategyState,
  recordFeedbackHookEvent,
  shouldShowFeedback,
} from '@/shared/utils/feedbackTriggerStrategy'
import { getTerminalContextActions } from '@/modules/terminal/utils/terminalContextMenu.mjs'
import { normalizeTerminalExitPayload } from '@/modules/terminal/utils/terminalResumeMonitor.mjs'
import { parseClaudeStatusPayload } from '@/modules/terminal/utils/claudeStatus'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import ClaudeCodeStopFeedbackBar from './ClaudeCodeStopFeedbackBar.vue'
import TerminalSearchBar from './TerminalSearchBar.vue'
import ShortcutBar from './shortcut-bar/ShortcutBar.vue'

const containerRef = ref(null)
const title = ref('终端')
const theme = ref({})
const termId = ref('')
const mode = ref('shell')
const teamId = ref(null)
const readonlyHistory = ref(false)
const panelId = ref('')
const panelStore = usePanelStore()
const activePanel = computed(() => {
  if (!panelId.value) return null
  return panelStore.getPanel(panelId.value)
})

let terminal = null
let fitAddon = null
let searchAddon = null
let unsubData = null
let unsubExit = null
let unsubShellState = null
let unsubClaudeStatus = null
let unsubTeamsPanelStatus = null
let offClaudeHook = null
let resizeObserver = null
let ptyResizeDebounceTimer = null
let resizeObserverDebounceTimer = null
let terminalPasteHandler = null
let lastPtyCols = null
let lastPtyRows = null
const PTY_RESIZE_DEBOUNCE_MS = 400
const RESIZE_OBSERVER_DEBOUNCE_MS = 80

const toolbarStyle = ref({})
const contextMenu = ref({ visible: false, x: 0, y: 0 })
const hasTerminalSelection = ref(false)
const detachedPanelContext = computed(() => ({
  mode: mode.value,
  teamId: teamId.value,
  readonlyHistory: readonlyHistory.value,
}))
const terminalContextActions = computed(() => getTerminalContextActions({
  panel: detachedPanelContext.value,
  hasSelection: hasTerminalSelection.value,
  canPaste: true,
}))
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
  '--menu-bg': theme.value?.menuBg || 'rgba(20, 25, 35, 0.95)',
  '--menu-border': theme.value?.menuBorder || 'none',
  '--menu-box-shadow': theme.value?.menuBoxShadow || 'none',
  '--menu-text': theme.value?.menuItemText || 'rgba(255, 255, 255, 0.85)',
  '--menu-hover-bg': theme.value?.menuItemHoverBg || 'rgba(255, 255, 255, 0.1)',
}))

// 点赞点踩相关
const showFeedbackBar = ref(false)
const feedbackReplyText = ref('')
const feedbackResponseId = ref('')
const feedbackSessionId = ref('')

function onFeedbackBarDismiss() {
  showFeedbackBar.value = false
}

// 搜索相关
const showSearchBar = ref(false)
const searchResultIndex = ref(-1)
const searchResultCount = ref(0)
let currentSearchQuery = ''
let currentSearchOptions = { caseSensitive: false, regex: false, wholeWord: false }
const searchDecorationOptions = {
  matchBackground: '#DCB47E',           // 所有匹配项背景色（配合 CSS opacity: 0.2）
  matchBorder: '',
  matchOverviewRuler: '#DCB47E',
  activeMatchBackground: '#FF7809',     // 当前匹配项背景色（配合 CSS rgba）
  activeMatchBorder: '',
  activeMatchColorOverviewRuler: '#FF7809',
}

// 注册快捷键（必须在 setup 顶层调用，不能在 onMounted 内）
useTerminalShortcuts({
  closePane: () => {
    window.close()
  },
  openSearch: () => {
    showSearchBar.value = !showSearchBar.value
    if (!showSearchBar.value) {
      closeSearchBar()
    }
  }
})

async function handleClaudeHook(payload) {
  console.log('[DetachedTerminal] 收到 hook 事件:', payload?.event, 'payload termId:', payload?.data?.termId, '本窗口 termId:', termId.value)
  if (!payload) return
  if (payload.data?.termId && payload.data.termId !== termId.value) return
  recordFeedbackHookEvent(payload)
  if (payload.event !== 'Stop') return
  console.log('[DetachedTerminal] 显示点赞点踩条')
  const ctx = extractStopHookReplyContext(payload)
  feedbackReplyText.value = ctx.replyText
  feedbackResponseId.value = ctx.responseId
  feedbackSessionId.value = ctx.sessionId
  const existingRecord = await getSubmittedFeedbackRecord({
    source: 'terminal-stop',
    sessionId: ctx.sessionId,
    responseId: ctx.responseId,
  }).catch(() => null)
  if (existingRecord) {
    showFeedbackBar.value = false
    return
  }
  showFeedbackBar.value = shouldShowFeedback({
    replyText: ctx.replyText,
    sessionId: ctx.sessionId,
    hookData: payload.data,
    timestamp: payload.timestamp,
  })
}

watch(showFeedbackBar, async () => {
  await nextTick()
  fitTerminal()
})

function buildFallbackPanelState(initData = {}) {
  const state = initData.panelState && typeof initData.panelState === 'object'
    ? initData.panelState
    : {}
  return {
    id: state.id || `detached-${initData.termId || 'panel'}`,
    projectId: state.projectId || '__detached__',
    workbenchId: state.workbenchId || '__detached__',
    tabId: state.tabId || '__detached__',
    terminalId: initData.termId || state.terminalId || '',
    mode: state.mode || initData.mode || 'shell',
    title: state.title || initData.title || '终端',
    detached: true,
    detachedWindowId: state.detachedWindowId ?? null,
    cwd: state.cwd || '',
    shell: state.shell || '',
    shellState: state.shellState || 'idle',
    claudeActive: state.claudeActive === true,
    shellHostedClaude: state.shellHostedClaude === true,
    claudeSessionId: state.claudeSessionId ?? null,
    aiModel: state.aiModel || '',
    aiContextPercent: state.aiContextPercent ?? null,
    aiPermissionMode: state.aiPermissionMode || 'default',
    claudeModelStrategy: state.claudeModelStrategy || 'opusplan',
    aiRunningTools: Array.isArray(state.aiRunningTools) ? state.aiRunningTools : [],
    aiToolCountsByName: state.aiToolCountsByName || {},
    aiTodos: Array.isArray(state.aiTodos) ? state.aiTodos : [],
    aiSubagentCount: state.aiSubagentCount ?? 0,
    teamId: state.teamId || initData.teamId || null,
    teamRole: state.teamRole || null,
    teamStatus: state.teamStatus ?? null,
    teamStatusIcon: state.teamStatusIcon ?? null,
    teamStatusColor: state.teamStatusColor ?? null,
    gitBranch: state.gitBranch || '',
    gitDirty: state.gitDirty === true,
    ptySpawnedAt: state.ptySpawnedAt ?? Date.now(),
    rows: state.rows ?? 24,
    cols: state.cols ?? 80,
  }
}

function hydrateDetachedPanelState(initData = {}) {
  const nextPanelState = buildFallbackPanelState(initData)
  panelStore.loadPanels({
    [nextPanelState.id]: nextPanelState,
  })
  panelId.value = nextPanelState.id
}

function handleShortcutSendCommand({ command, mode: sendMode }) {
  if (!termId.value || readonlyHistory.value) return
  const payload = sendMode === 'execute' ? `${command}\r` : command
  window.electronAPI?.terminal.write(termId.value, payload)
  terminal?.focus()
}

const defaultTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
}

function isWindowsPlatform() {
  return navigator.userAgent?.includes('Windows') || navigator.platform?.includes('Win')
}

function normalizeTextForTerminalPaste(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

function buildTerminalPastePayload(text) {
  const normalizedText = normalizeTextForTerminalPaste(text)
  if (!normalizedText) return ''
  if (terminal?.modes?.bracketedPasteMode) {
    return `\x1b[200~${normalizedText}\x1b[201~`
  }
  return normalizedText
}

function forwardTerminalInput(data) {
  if (readonlyHistory.value) return
  window.electronAPI?.terminal.write(termId.value, data)
}

function handleTerminalPaste(e) {
  if (readonlyHistory.value) return

  const text = e.clipboardData?.getData('text/plain') || ''
  if (text) {
    e.preventDefault()
    e.stopPropagation()
    const payload = buildTerminalPastePayload(text)
    if (payload) forwardTerminalInput(payload)
    return
  }

  const items = Array.from(e.clipboardData?.items || [])
  const hasImage = items.some(item => item.type?.startsWith('image/'))
  if (!hasImage) return

  e.preventDefault()
  e.stopPropagation()
  if (isWindowsPlatform()) {
    window.electronAPI?.terminal.prepareClipboardImage()
      .catch(() => {})
      .finally(() => {
        forwardTerminalInput('\x1bv')
      })
  } else {
    forwardTerminalInput('\x16')
  }
}

onMounted(async () => {
  // 监听主进程发来的初始化参数
  const api = window.electronAPI
  if (!api) return

  api.onTerminalWindowInit((initData) => {
    termId.value = initData.termId
    title.value = initData.title || '终端'
    theme.value = initData.theme || {}
    mode.value = initData.mode || 'shell'
    teamId.value = initData.teamId || null
    readonlyHistory.value = Boolean(initData.readonlyHistory)
    hydrateDetachedPanelState(initData)
    const fontSize = initData.fontSize || 14
    const scrollback = initData.scrollback || ''

    updateToolbarStyle()
    initTerminal(fontSize, scrollback)
  })

  unsubShellState = api.terminal?.onShellStateChange?.((payload) => {
    if (payload?.termId !== termId.value) return
    panelStore.updateShellState(payload.termId, payload)
  })
  unsubClaudeStatus = api.terminal?.onClaudeStatusChange?.((payload) => {
    if (payload?.termId !== termId.value) return
    const parsed = parseClaudeStatusPayload(payload, { sessionKey: payload.termId })
    panelStore.updateAiStatus(payload.termId, parsed)
  })
  unsubTeamsPanelStatus = api.teams?.onPanelStatus?.(({ termId: statusTermId, teamStatus, teamStatusIcon, teamStatusColor }) => {
    if (statusTermId !== termId.value) return
    panelStore.updateTeamStatus(statusTermId, { teamStatus, teamStatusIcon, teamStatusColor })
  })

  // 监听 Claude Hook 事件（点赞点踩）
  await initializeFeedbackStrategyState()
  if (window.electronAPI?.onClaudeHookEvent) {
    offClaudeHook = window.electronAPI.onClaudeHookEvent(handleClaudeHook)
  }

  // 注册快捷键
  useTerminalShortcuts({
    closePane: () => {
      window.close()
    },
    openSearch: () => {
      showSearchBar.value = !showSearchBar.value
      if (!showSearchBar.value) {
        closeSearchBar()
      }
    }
  })
})

onBeforeUnmount(() => {
  cleanup()
})

function updateToolbarStyle() {
  const t = theme.value
  toolbarStyle.value = {
    background: t.toolbarBg || t.background || '#0d1117',
    borderColor: t.toolbarBorder || '#1b2230',
    color: t.btnText || 'rgba(255, 255, 255, 0.7)',
  }
}

function initTerminal(fontSize, scrollback) {
  if (terminal) return
  if (!containerRef.value) return

  const mergedTheme = { ...defaultTheme, ...theme.value }

  terminal = new Terminal({
    theme: mergedTheme,
    fontSize,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 10000,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)

  searchAddon.onDidChangeResults((e) => {
    if (e) {
      searchResultIndex.value = e.resultIndex
      searchResultCount.value = e.resultCount
    }
  })

  terminal.loadAddon(new WebLinksAddon((_, uri) => {
    window.electronAPI?.openExternal(uri)
  }))

  terminal.open(containerRef.value)
  terminalPasteHandler = handleTerminalPaste
  containerRef.value.addEventListener('paste', terminalPasteHandler, true)

  // macOS 系统快捷键处理
  const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
  terminal.attachCustomKeyEventHandler((e) => {
    if (isMac) {
      if (e.metaKey && ['c', 'v', 'x', 'a', 'f'].includes(e.key)) return false
    } else {
      if (e.ctrlKey && e.key === 'c') {
        if (terminal.hasSelection()) return false
        return true
      }
      if (e.ctrlKey && ['v', 'x', 'a', 'f'].includes(e.key)) return false
    }
    return true
  })

  fitTerminal()

  // 标题变化同步到窗口
  terminal.onTitleChange((newTitle) => {
    title.value = newTitle
    document.title = `Kooky - ${newTitle}`
  })

  // 选中文本自动复制
  terminal.onSelectionChange(() => {
    const selection = terminal.getSelection()
    hasTerminalSelection.value = Boolean(selection)
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {})
    }
  })

  // 右键菜单
  containerRef.value.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    contextMenu.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
    }
  })

  // 写入历史 scrollback
  if (scrollback) {
    terminal.write(scrollback)
  }

  // 连接 PTY 数据流（不创建 PTY）
  const api = window.electronAPI?.terminal
  if (api) {
    unsubData = api.onData(termId.value, (data) => {
      if (terminal) terminal.write(data)
    })
    unsubExit = api.onExit(termId.value, async (rawExitPayload) => {
      const { exitCode } = normalizeTerminalExitPayload(rawExitPayload)
      const shouldShowExitBanner =
        !((activePanel.value?.mode === 'claude-code' || activePanel.value?.claudeSessionId) && activePanel.value?.claudeActive)

      // 如果是 Claude Code 模式退出（包括 resume 模式），降级到 shell 模式并重新创建 shell PTY
      if ((activePanel.value?.mode === 'claude-code' || activePanel.value?.claudeSessionId) && activePanel.value?.claudeActive) {
        panelStore.demotePanelToShellMode(termId.value)
        panelStore.updateShellState(termId.value, {
          state: 'idle',
          exitCode,
        })

        // 重新创建 shell PTY
        try {
          await api.create({
            termId: termId.value,
            cols: terminal?.cols || 80,
            rows: terminal?.rows || 24,
            cwd: activePanel.value?.cwd || undefined,
            mode: 'shell',
          })
        } catch (error) {
          console.error('[DetachedTerminal] Shell PTY 重新创建失败:', error)
        }
      } else if (activePanel.value?.shellHostedClaude && activePanel.value?.claudeActive) {
        // 保留原有的 shellHostedClaude 逻辑
        panelStore.demotePanelToShellMode(termId.value)
        panelStore.updateShellState(termId.value, {
          state: 'idle',
          exitCode,
        })
      } else {
        // 普通 shell 退出才标记为 exited
        panelStore.markPanelExited(termId.value)
      }

      if (shouldShowExitBanner) {
        terminal?.write(`\r\n\x1b[90m[进程已退出，代码: ${exitCode}]\x1b[0m\r\n`)
      }
    })
  }

  // 用户输入 → PTY
  terminal.onData((data) => {
    forwardTerminalInput(data)
  })

  // 通知主进程 flush 缓冲数据
  window.electronAPI?.terminal.flushBuffer(termId.value)

  // 监听容器尺寸变化
  resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeObserverDebounceTimer)
    resizeObserverDebounceTimer = setTimeout(() => {
      resizeObserverDebounceTimer = null
      nextTick(() => {
        fitTerminal()
      })
    }, RESIZE_OBSERVER_DEBOUNCE_MS)
  })
  resizeObserver.observe(containerRef.value)
}

function sendPtyResizeToMain(force) {
  if (!terminal || !termId.value) return
  const api = window.electronAPI?.terminal
  if (!api?.resize) return
  const cols = terminal.cols
  const rows = terminal.rows
  if (!force && lastPtyCols === cols && lastPtyRows === rows) return
  lastPtyCols = cols
  lastPtyRows = rows
  try {
    api.resize(termId.value, cols, rows)
  } catch {
    // ignore
  }
}

function schedulePtyResize() {
  if (!terminal || !termId.value) return
  clearTimeout(ptyResizeDebounceTimer)
  ptyResizeDebounceTimer = setTimeout(() => {
    ptyResizeDebounceTimer = null
    sendPtyResizeToMain(false)
  }, PTY_RESIZE_DEBOUNCE_MS)
}

function fitTerminal() {
  if (!fitAddon || !terminal || !containerRef.value) return
  const { clientWidth, clientHeight } = containerRef.value
  if (clientWidth < 50 || clientHeight < 50) return
  requestAnimationFrame(() => {
    try {
      fitAddon.fit()
      sendPtyResizeToMain(true)
    } catch {
      // ignore fit errors during transitions
    }
  })
}

function closeContextMenu() {
  contextMenu.value = { visible: false, x: 0, y: 0 }
}

async function handleContextMenuAction(action) {
  if (!action || action.disabled) return

  if (action.key === 'copy') {
    const selection = terminal?.getSelection()
    if (selection) {
      await navigator.clipboard.writeText(selection).catch(() => {})
    }
  } else if (readonlyHistory.value) {
    closeContextMenu()
    terminal?.focus()
    return
  } else if (action.key === 'paste') {
    const text = await navigator.clipboard.readText().catch(() => '')
    if (text) {
      const payload = buildTerminalPastePayload(text)
      if (payload) forwardTerminalInput(payload)
    }
  } else if (action.key === 'ko-teams') {
    // 独立窗口中不支持启动团队，忽略
  }

  closeContextMenu()
  terminal?.focus()
}

function cleanup() {
  clearTimeout(ptyResizeDebounceTimer)
  clearTimeout(resizeObserverDebounceTimer)
  resizeObserver?.disconnect()
  unsubData?.()
  unsubExit?.()
  unsubShellState?.()
  unsubClaudeStatus?.()
  unsubTeamsPanelStatus?.()
  disposeFeedbackDecoration()
  if (containerRef.value && terminalPasteHandler) {
    containerRef.value.removeEventListener('paste', terminalPasteHandler, true)
    terminalPasteHandler = null
  }
  if (typeof offClaudeHook === 'function') {
    offClaudeHook()
    offClaudeHook = null
  }
  // 不销毁 PTY — 关窗由主进程处理
  terminal?.dispose()
  terminal = null
  fitAddon = null
  searchAddon = null
  closeContextMenu()
}

// 搜索方法
function handleSearch({ query, caseSensitive, useRegex, wholeWord }) {
  if (!searchAddon || !query) {
    searchAddon?.clearDecorations()
    currentSearchQuery = ''
    searchResultIndex.value = -1
    searchResultCount.value = 0
    return
  }

  // 清除之前的搜索装饰，确保使用新的搜索选项重新搜索
  searchAddon.clearDecorations()

  currentSearchQuery = query
  currentSearchOptions = { caseSensitive, regex: useRegex, wholeWord }
  searchAddon.findNext(query, {
    caseSensitive,
    regex: useRegex,
    wholeWord,
    decorations: searchDecorationOptions,
  })
}

function handleSearchNext() {
  if (!searchAddon || !currentSearchQuery) return
  searchAddon.findNext(currentSearchQuery, {
    ...currentSearchOptions,
    decorations: searchDecorationOptions,
  })
}

function handleSearchPrev() {
  if (!searchAddon || !currentSearchQuery) return
  searchAddon.findPrevious(currentSearchQuery, {
    ...currentSearchOptions,
    decorations: searchDecorationOptions,
  })
}

function closeSearchBar() {
  showSearchBar.value = false
  searchAddon?.clearDecorations()
  currentSearchQuery = ''
  searchResultIndex.value = -1
  searchResultCount.value = 0
  terminal?.focus()
}
</script>

<style scoped>
.detached-terminal {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.detached-toolbar {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid;
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
}

.detached-title {
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  opacity: 0.8;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.terminal-with-feedback {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal-feedback-accessory {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 4px 12px 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
}

.terminal-container :deep(.xterm) {
  height: 100%;
  padding: 4px 8px;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
  background: transparent;
}

/* 搜索匹配项样式 */
.terminal-container :deep(.xterm-find-result-decoration) {
  outline: none !important;
  background: rgba(220, 180, 126, 0.2) !important;
  border-bottom: 2px solid #E5AC5F !important;
}

.terminal-container :deep(.xterm-find-active-result-decoration) {
  outline: none !important;
  background: rgba(255, 120, 9, 0.2) !important;
  border-bottom: 2px solid #FF7809 !important;
}
</style>

<style>
.terminal-context-menu {
  position: fixed;
  min-width: 144px;
  padding: 6px;
  border-radius: 10px;
  border: none;
  background: var(--menu-bg, rgba(20, 25, 35, 0.95));
  box-shadow: var(--menu-box-shadow, none);
  z-index: 5000;
}

.terminal-context-menu-item {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--menu-text, rgba(255, 255, 255, 0.85));
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.terminal-context-menu-item:hover {
  background: var(--menu-hover-bg, rgba(255, 255, 255, 0.1));
}

.terminal-context-menu-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.terminal-context-menu-item.disabled:hover {
  background: transparent;
}

.terminal-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 4999;
}
</style>
