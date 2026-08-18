<template>
  <div
    class="terminal-with-feedback"
    ref="wrapperRef"
    @dragenter="handleTerminalDragEnter"
    @dragover="handleTerminalDragOver"
    @dragleave="handleTerminalDragLeave"
    @drop="handleTerminalDrop"
  >
    <!-- 欢迎卡片（正常流式布局，在终端上方） -->
    <Transition name="welcome-fade" @after-leave="fitTerminal">
      <div v-if="showWelcome" class="welcome-section">
        <div class="welcome-card" :class="{ 'is-light': isLightTheme }">
          <div class="welcome-left">
            <img :src="crabSvgUrl" class="welcome-crab" alt="Kooky Crab" />
          </div>
          <div class="welcome-divider"></div>
          <div class="welcome-right">
            <h2 class="welcome-heading">Kooky CLI</h2>
            <p class="welcome-subtitle">{{ welcomeSubtitle }}</p>
            <template v-if="isWelcomeLoading">
              <div class="welcome-copy">
                <p class="welcome-line">正在连接终端环境，请稍候片刻。</p>
                <p class="welcome-line">环境准备完成后会自动聚焦到输入区。</p>
              </div>
            </template>
            <template v-else>
              <div class="welcome-copy">
                <p class="welcome-line">Kooky cli 已就绪 <span class="welcome-emoji">🦀</span> 你的终端，一屏尽览</p>
                <p class="welcome-line">双击 <span class="welcome-accent">option</span> 探索隐藏捷径，输入 <span class="welcome-accent">ko</span> 回车，畅用AI</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <div class="terminal-wrapper" ref="containerRef"></div>
    <div v-if="isDragOverTerminal" class="terminal-drop-overlay"></div>
    <ClaudeCodeStopFeedbackBar
      v-if="showFeedbackBar"
      :reply-text="feedbackReplyText"
      :response-id="feedbackResponseId"
      :session-id="feedbackSessionId"
      :term-id="props.termId"
      :theme="theme"
      @dismiss="onFeedbackBarDismiss"
      @stop-feedback="emit('stop-feedback', $event)"
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
</template>

<script setup>
/**
 * 单个 xterm.js 终端实例
 * 通过 IPC 连接后端 node-pty 伪终端
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { extractStopHookReplyContext } from '@/modules/terminal/utils/claudeHookPayload'
import { getSubmittedFeedbackRecord } from '@/modules/terminal/services/persistentUserDataService'
import {
  initializeFeedbackStrategyState,
  recordFeedbackHookEvent,
  shouldShowFeedback,
} from '@/shared/utils/feedbackTriggerStrategy'
import ClaudeCodeStopFeedbackBar from './ClaudeCodeStopFeedbackBar.vue'
import crabSvgUrl from '@/assets/crab-pixel.png'
import { tip } from './tip'
import { registerTerminalRef, unregisterTerminalRef, markInputActive } from '@/modules/terminal/services/sessionService'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { getTerminalContextActions } from '@/modules/terminal/utils/terminalContextMenu.mjs'
import { cloneTeamModePayload } from '@/modules/terminal/utils/teamModePayload.mjs'
import { shouldSuppressTerminalExitFeedback } from '@/modules/terminal/utils/terminalExitFeedback.mjs'
import {
  createTerminalPermissionModeTracker,
  detectPermissionModeFromTerminalLines,
} from '@/modules/terminal/utils/terminalPermissionMode.mjs'
import { shouldSuppressSyntheticTerminalInput } from '@/modules/terminal/utils/terminalSyntheticInput.mjs'
import {
  createInitialWelcomeState,
  getRemainingLoadingWelcomeMs,
  resolveWelcomeReadyState,
  shouldAutoAdvanceLoadingWelcomeOnClaudeStatus,
  shouldAutoAdvanceLoadingWelcomeOnPtyData,
  shouldAutoAdvanceLoadingWelcomeOnResumeSettled,
  shouldDismissReadyWelcomeOnInput,
  TERMINAL_WELCOME_PHASE,
} from '@/modules/terminal/utils/terminalWelcomeState.mjs'
import {
  normalizeTerminalExitPayload,
  shouldTreatExitAsResumeFailure,
} from '@/modules/terminal/utils/terminalResumeMonitor.mjs'
import { isTerminalContainerReady, settleTerminalFit } from '@/modules/terminal/utils/terminalFit.mjs'
import { shouldReuseRuntimeManagedTerminal } from '@/modules/terminal/utils/teamRuntimeBootstrap.mjs'
import { resolveTeamRestoreViewportPlan } from '@/modules/terminal/utils/teamRestoreViewportPlan.mjs'
import { enqueueTerminalBootstrap } from '@/modules/terminal/utils/terminalBootstrapQueue.mjs'

defineOptions({ name: 'ClaudeCodeTerminal' })

const SPLIT_DIVIDER_DRAG_START = 'claude-split-divider-drag-start'
const SPLIT_DIVIDER_DRAG_END = 'claude-split-divider-drag-end'
const LEAF_PANE_DRAG_START = 'claude-split-leaf-pane-drag-start'
const LEAF_PANE_DRAG_END = 'claude-split-leaf-pane-drag-end'
const TERMINAL_RESET_EVENT = 'kc-terminal-reset'
const TERMINAL_FOCUS_EVENT = 'kc-terminal-focus'
const DEFAULT_WELCOME_SUBTITLE = '放轻松一点，事情会慢慢变简单的~'

const props = defineProps({
  termId: { type: String, required: true },
  cwd: { type: String, default: '' },
  mode: { type: String, default: 'claude-code' },
  cliBrand: { type: String, default: 'claude-code' },
  theme: { type: Object, default: () => ({}) },
  fontSize: { type: Number, default: 14 },
  active: { type: Boolean, default: true },
  visible: { type: Boolean, default: true },
  deferBootstrap: { type: Boolean, default: false },
  readonlyHistory: { type: Boolean, default: false },
  restoreScrollback: { type: String, default: '' },
  restoredSession: { type: Boolean, default: false },
  restoreTelemetryRunId: { type: String, default: '' },
  resumeSessionId: { type: String, default: '' },
  forkSession: { type: Boolean, default: false },
  teamMode: { type: Object, default: null },
})

const emit = defineEmits(['exit', 'title-change', 'stop-feedback', 'search-results', 'ready', 'shell-ready', 'font-size-change', 'start-team'])

const containerRef = ref(null)
const wrapperRef = ref(null)
const welcomeState = ref(createInitialWelcomeState({
  mode: props.mode,
  readonlyHistory: props.readonlyHistory,
  restoredSession: props.restoredSession,
  resumeSessionId: props.resumeSessionId,
  teamMode: props.teamMode,
}))
const welcomeSubtitle = ref(getRandomWelcomeSubtitle())
const showWelcome = computed(() => welcomeState.value.visible)
const isWelcomeLoading = computed(() => welcomeState.value.phase === TERMINAL_WELCOME_PHASE.LOADING)
const isLightTheme = computed(() => {
  const themeName = props.theme?.name
  const background = String(props.theme?.background || '').trim().toLowerCase()
  return themeName === '白色' || background === '#f7f8fa' || background === 'rgb(247, 248, 250)'
})
let terminal = null
let fitAddon = null
let serializeAddon = null
let searchAddon = null
let isDetaching = false
let unsubData = null
let unsubExit = null
let unsubShellState = null
let unsubClaudeStatus = null
let unsubMissing = null
// Resume 状态机
const RESUME_FAIL_PATTERNS = [
  /no session found/i,
  /session not found/i,
  /no conversation found/i,
  /invalid session/i,
  /error.*resume/i,
]
const RESUME_TIMEOUT_MS = 10000
let resumeState = 'NONE' // NONE | RESUMING | SUCCESS | FAILED
let resumeOutputBuffer = ''
let resumeTimeoutId = null
let resumeMonitorPid = null
let offClaudeHook = null
let resizeObserver = null
let created = false
let suppressPtyResizeDuringSplitUI = false
let lastPtyCols = null
let lastPtyRows = null
let restoredScrollbackApplied = false
let ptyResizeDebounceTimer = null
let postSpawnFitValidationTimer = null
let savedViewportY = null
let resizeObserverDebounceTimer = null
let welcomeReadyTimer = null
const PTY_RESIZE_DEBOUNCE_MS = 400
const RESIZE_OBSERVER_DEBOUNCE_MS = 80
// 焦点管理：追踪用户是否点击了终端，以及焦点恢复定时器
let userActivatedTerminal = false
let focusRestoreTimer = null
let docMousedownHandler = null
let docKeydownHandler = null
let containerWheelHandler = null
let terminalPasteHandler = null
let missingTerminalRecoveryPromise = null
let suppressExitFeedbackUntil = 0
let suppressExitFeedbackCodes = []
let suppressSyntheticFocusInputUntil = 0
let permissionModeTracker = createTerminalPermissionModeTracker()
let pendingTeamRestoreViewportPlan = null
let pendingTeamRestoreViewportTimer = null
let initTerminalPromise = null
let terminalBootstrapHandle = null
// 螃蟹动画已屏蔽（bug 较多），仅保留静态欢迎页

function getRandomWelcomeSubtitle() {
  const availableTips = Array.isArray(tip)
    ? tip.filter(item => typeof item === 'string' && item.trim())
    : []
  if (!availableTips.length) return DEFAULT_WELCOME_SUBTITLE

  const index = Math.floor(Math.random() * availableTips.length)
  return availableTips[index]
}
const panelStore = usePanelStore()
const contextMenu = ref({ visible: false, x: 0, y: 0 })
const hasTerminalSelection = ref(false)
const terminalInputLocked = ref(false)
const currentPanel = computed(() => panelStore.panelList.find(panel => panel.terminalId === props.termId) || null)
const terminalContextActions = computed(() => getTerminalContextActions({
  panel: currentPanel.value
    ? {
      ...currentPanel.value,
      readonlyHistory: props.readonlyHistory,
      isActivePane: props.active,
    }
    : {
      readonlyHistory: props.readonlyHistory,
      isActivePane: props.active,
    },
  hasSelection: hasTerminalSelection.value,
  canPaste: true,
}))
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
  '--menu-bg': props.theme?.menuBg || 'rgba(20, 25, 35, 0.95)',
  '--menu-border': props.theme?.menuBorder || 'none',
  '--menu-box-shadow': props.theme?.menuBoxShadow || 'none',
  '--menu-text': props.theme?.menuItemText || 'rgba(255, 255, 255, 0.85)',
  '--menu-hover-bg': props.theme?.menuItemHoverBg || 'rgba(255, 255, 255, 0.1)',
}))

// 搜索相关
let currentSearchQuery = ''
let currentSearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
}
let searchDecorationOptions = {
  matchBackground: '#DCB47E',           // 所有匹配项背景色（配合 CSS opacity: 0.2）
  matchBorder: '',
  matchOverviewRuler: '#DCB47E',
  activeMatchBackground: '#FF7809',     // 当前匹配项背景色（配合 CSS rgba）
  activeMatchBorder: '',
  activeMatchColorOverviewRuler: '#FF7809',
}

const showFeedbackBar = ref(false)
const isDragOverTerminal = ref(false)
let dragOverCounter = 0
/** 完整回复正文（tooltip / 接口 comment） */
const feedbackReplyText = ref('')
/** 点赞接口：与 hook / transcript 对齐的 response_id、session_id */
const feedbackResponseId = ref('')
const feedbackSessionId = ref('')

function onFeedbackBarDismiss() {
  showFeedbackBar.value = false
}

async function handleClaudeHook(payload) {
  if (!payload) return
  // 有 termId 时精确匹配，无 termId 时降级为旧行为（兼容）
  if (payload.data?.termId && payload.data.termId !== props.termId) return
  recordFeedbackHookEvent(payload)
  if (payload.event !== 'Stop') return
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

const defaultTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  selectionForeground: '#cdd6f4',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
}

function onSplitUiDragStart() {
  suppressPtyResizeDuringSplitUI = true
  clearTimeout(ptyResizeDebounceTimer)
  ptyResizeDebounceTimer = null
}

function onSplitUiDragEnd() {
  suppressPtyResizeDuringSplitUI = false
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitTerminalNow(false)
      })
    })
  })
}

// ShortcutBar 切换 bypass 后的终端后置动作
function handleTerminalReset(event) {
  if (event.detail?.termId !== props.termId) return
  if (!terminal) return
  try {
    terminal.reset()
    terminal.write('\x1b[0m')
  } catch {}
  nextTick(() => {
    userActivatedTerminal = true
    terminal?.focus()
  })
}

function handleTerminalFocus(event) {
  if (event.detail?.termId !== props.termId) return
  if (!terminal) return
  if (Number.isFinite(event.detail?.suppressExitBannerMs) && event.detail.suppressExitBannerMs > 0) {
    suppressExitFeedbackUntil = Date.now() + event.detail.suppressExitBannerMs
    suppressExitFeedbackCodes = Array.isArray(event.detail?.suppressExitBannerCodes)
      ? [...event.detail.suppressExitBannerCodes]
      : []
  }
  if (event.detail?.clearViewport) {
    try {
      terminal.write('\x1b[0m\x1b[3J\x1b[2J\x1b[H')
    } catch {}
    permissionModeTracker.reset()
  }
  if (event.detail?.suppressSyntheticFocusInput) {
    const suppressMs = Number.isFinite(event.detail?.suppressSyntheticFocusInputMs)
      ? Math.max(0, event.detail.suppressSyntheticFocusInputMs)
      : 0
    suppressSyntheticFocusInputUntil = suppressMs > 0 ? Date.now() + suppressMs : 0
  }
  nextTick(() => {
    userActivatedTerminal = true
    terminal?.focus()
  })
}

function schedulePendingTeamRestoreViewportCleanup() {
  if (!pendingTeamRestoreViewportPlan || !terminal) return

  const plan = pendingTeamRestoreViewportPlan
  pendingTeamRestoreViewportPlan = null

  clearTimeout(pendingTeamRestoreViewportTimer)
  pendingTeamRestoreViewportTimer = window.setTimeout(() => {
    pendingTeamRestoreViewportTimer = null
    if (!terminal) return

    if (plan.clearViewport) {
      try {
        terminal.write('\x1b[0m\x1b[3J\x1b[2J\x1b[H')
      } catch {}
      permissionModeTracker.reset()
    }

    if (plan.suppressSyntheticFocusInput) {
      const suppressMs = Number.isFinite(plan.suppressSyntheticFocusInputMs)
        ? Math.max(0, plan.suppressSyntheticFocusInputMs)
        : 0
      suppressSyntheticFocusInputUntil = suppressMs > 0 ? Date.now() + suppressMs : 0
    }

    nextTick(() => {
      if (plan.focusTerminal) {
        userActivatedTerminal = true
        terminal?.focus()
      }
    })
  }, 120)
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener(SPLIT_DIVIDER_DRAG_START, onSplitUiDragStart)
    window.addEventListener(SPLIT_DIVIDER_DRAG_END, onSplitUiDragEnd)
    window.addEventListener(LEAF_PANE_DRAG_START, onSplitUiDragStart)
    window.addEventListener(LEAF_PANE_DRAG_END, onSplitUiDragEnd)
    window.addEventListener(TERMINAL_RESET_EVENT, handleTerminalReset)
    window.addEventListener(TERMINAL_FOCUS_EVENT, handleTerminalFocus)
  }
  await initializeFeedbackStrategyState()
  if (typeof window !== 'undefined' && window.electronAPI?.onClaudeHookEvent) {
    offClaudeHook = window.electronAPI.onClaudeHookEvent(handleClaudeHook)
  }
  await nextTick()
  if (props.restoredSession && props.deferBootstrap && !props.visible && !props.active) {
    return
  }
  await ensureTerminalInitialized()
})

onBeforeUnmount(() => {
  unregisterTerminalRef(props.termId)
  terminalBootstrapHandle?.cancel?.()
  terminalBootstrapHandle = null
  clearResumeMonitor()
  if (typeof window !== 'undefined') {
    window.removeEventListener(TERMINAL_RESET_EVENT, handleTerminalReset)
    window.removeEventListener(TERMINAL_FOCUS_EVENT, handleTerminalFocus)
  }
  cleanup()
})

// 当 active 变化时重新 fit（分屏/标签页切换时需要）
// 标签页切换时 Teleport 迁移可能导致容器尺寸暂时为 0，需要重试
watch(() => props.active, async (val) => {
  if (val) {
    await ensureTerminalInitialized()
    await nextTick()
    fitTerminalWithRetry()
  } else {
    // 终端变为非激活状态时，保存当前滚动位置
    saveViewportScrollPosition()
  }
})

watch(() => props.visible, async (visible) => {
  if (!visible) return
  await ensureTerminalInitialized()
  applyRestoredScrollback(props.restoreScrollback, { force: true })
  await nextTick()
  fitTerminalWithRetry({ immediate: false, restoreScroll: false })
})

// 主题变化时实时更新
watch(() => props.theme, (newTheme) => {
  if (terminal) {
    terminal.options.theme = { ...defaultTheme, ...newTheme }
  }
}, { deep: true })

// 字体变化防抖：快速连续调整时只执行最后一次
let fontSizeChangeTimer = null
const FONT_SIZE_CHANGE_DEBOUNCE_MS = 50

watch(() => props.fontSize, (size) => {
  if (terminal) {
    terminal.options.fontSize = size
    // 防抖 fit，避免快速连续点击时每次都触发重渲染
    clearTimeout(fontSizeChangeTimer)
    fontSizeChangeTimer = setTimeout(() => {
      fontSizeChangeTimer = null
      // 立即同步 fit，不使用 requestAnimationFrame
      try {
        if (fitAddon && containerRef.value) {
          const { clientWidth, clientHeight } = containerRef.value
          if (clientWidth >= 50 && clientHeight >= 50) {
            fitAddon.fit()
            // 强制刷新终端渲染层，清除 canvas 缓存避免重影
            // 双帧刷新确保 Windows conpty 渲染层完全更新
            terminal.refresh(0, terminal.rows - 1)
            requestAnimationFrame(() => {
              terminal?.refresh(0, terminal.rows - 1)
            })
            if (created) sendPtyResizeToMain(true)
          }
        }
      } catch {
        // ignore
      }
    }, FONT_SIZE_CHANGE_DEBOUNCE_MS)
  }
})

watch(() => props.teamMode?.enabled, (enabled) => {
  if (enabled) {
    if (currentPanel.value?.runtimeManaged) {
      hideWelcomeCard()
      return
    }
    welcomeState.value = createInitialWelcomeState({
      mode: props.mode,
      readonlyHistory: props.readonlyHistory,
      restoredSession: props.restoredSession,
      resumeSessionId: props.resumeSessionId,
      teamMode: { enabled },
    })
  }
})

watch(() => currentPanel.value?.runtimeManaged, (runtimeManaged) => {
  // runtime-managed 表示这个终端已经由现有运行时托管，不该再展示“新终端加载”欢迎页。
  if (!runtimeManaged) return
  hideWelcomeCard()
}, { immediate: true })

watch(() => props.restoreScrollback, (content) => {
  applyRestoredScrollback(content)
})

watch(showFeedbackBar, async () => {
  await nextTick()
  fitTerminalWithRetry({ immediate: false, restoreScroll: false })
})

function applyWelcomeReadyState() {
  const nextState = resolveWelcomeReadyState(welcomeState.value)
  const remainingLoadingMs = getRemainingLoadingWelcomeMs(welcomeState.value)
  if (remainingLoadingMs > 0) {
    clearTimeout(welcomeReadyTimer)
    welcomeReadyTimer = window.setTimeout(() => {
      welcomeReadyTimer = null
      applyWelcomeReadyState()
    }, remainingLoadingMs)
    return
  }

  if (nextState === welcomeState.value) return

  clearTimeout(welcomeReadyTimer)
  welcomeReadyTimer = null
  welcomeState.value = nextState

  if (!nextState.visible || nextState.phase !== TERMINAL_WELCOME_PHASE.READY) {
    return
  }

  nextTick(() => {
    userActivatedTerminal = true
    terminal?.focus()
  })
}

function hideWelcomeCard() {
  clearTimeout(welcomeReadyTimer)
  welcomeReadyTimer = null
  welcomeState.value = {
    visible: false,
    phase: TERMINAL_WELCOME_PHASE.HIDDEN,
    dismissOnInput: false,
    minVisibleUntil: 0,
  }
}

function shouldDeferRestoredScrollback(content) {
  return Boolean(
    props.restoredSession &&
    typeof content === 'string' &&
    content &&
    !props.visible &&
    !props.active
  )
}

function applyRestoredScrollback(content, options = {}) {
  if (restoredScrollbackApplied) return
  if (!terminal || typeof content !== 'string' || !content) return
  if (!options.force && shouldDeferRestoredScrollback(content)) return
  terminal.write(content)
  restoredScrollbackApplied = true
}

function getTerminalBootstrapPriority() {
  if (props.active) return 3
  if (props.visible) return 2
  return 0
}

async function ensureTerminalInitialized() {
  if (terminal) return terminal
  if (initTerminalPromise) {
    terminalBootstrapHandle?.reprioritize?.(getTerminalBootstrapPriority())
    return initTerminalPromise
  }

  if (props.restoredSession) {
    const bootstrapMeta = {
      termId: props.termId,
      panelId: currentPanel.value?.id ?? '',
      workbenchId: currentPanel.value?.workbenchId ?? '',
      restoreRunId: props.restoreTelemetryRunId || '',
    }
    terminalBootstrapHandle = enqueueTerminalBootstrap(
      () => initTerminalNow(),
      {
        priority: getTerminalBootstrapPriority(),
        meta: bootstrapMeta,
      },
    )
    initTerminalPromise = terminalBootstrapHandle.promise
      .then((result) => result || terminal)
      .finally(() => {
        terminalBootstrapHandle = null
      })
  } else {
    initTerminalPromise = initTerminalNow()
  }

  return initTerminalPromise
}

function syncPermissionModeFromVisibleTerminal() {
  if (!terminal) return
  const buffer = terminal.buffer?.active
  if (!buffer) return

  const cursorRow = Math.max(0, Math.min(
    buffer.length - 1,
    (buffer.baseY ?? 0) + (buffer.cursorY ?? 0),
  ))
  const startRow = Math.max(0, cursorRow - 10)
  const lines = []

  for (let row = startRow; row <= cursorRow; row += 1) {
    const line = buffer.getLine(row)
    if (!line) continue
    const text = line.translateToString(true).trim()
    if (text) lines.push(text)
  }

  const permissionMode = detectPermissionModeFromTerminalLines(lines)
  if (permissionMode) {
    panelStore.updateAiPermissionMode(props.termId, permissionMode)
  }
}

function handleTerminalDragEnter(e) {
  if (!e.dataTransfer?.types?.includes('application/x-file-tree-nodes')) return
  e.preventDefault()
  dragOverCounter += 1
  isDragOverTerminal.value = true
  e.dataTransfer.dropEffect = 'copy'
}

function handleTerminalDragOver(e) {
  if (!e.dataTransfer?.types?.includes('application/x-file-tree-nodes')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

function handleTerminalDragLeave(e) {
  if (!e.dataTransfer?.types?.includes('application/x-file-tree-nodes')) return
  dragOverCounter -= 1
  if (dragOverCounter <= 0) {
    dragOverCounter = 0
    isDragOverTerminal.value = false
  }
}

function handleTerminalDrop(e) {
  if (!e.dataTransfer?.types?.includes('application/x-file-tree-nodes')) return
  e.preventDefault()
  dragOverCounter = 0
  isDragOverTerminal.value = false

  const pathsText = e.dataTransfer.getData('text/plain')
  if (pathsText) {
    window.electronAPI?.terminal.write(props.termId, ` ${pathsText}`)
  }

  nextTick(() => terminal?.focus())
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
  if (props.readonlyHistory || terminalInputLocked.value) return
  if (shouldSuppressSyntheticTerminalInput(data, suppressSyntheticFocusInputUntil)) {
    suppressSyntheticFocusInputUntil = 0
    return
  }
  if (suppressSyntheticFocusInputUntil && Date.now() > suppressSyntheticFocusInputUntil) {
    suppressSyntheticFocusInputUntil = 0
  }
  if (shouldDismissReadyWelcomeOnInput(welcomeState.value, data)) {
    welcomeState.value = {
      visible: false,
      phase: TERMINAL_WELCOME_PHASE.HIDDEN,
      dismissOnInput: false,
    }
  }
  markInputActive()
  window.electronAPI?.terminal.write(props.termId, data)
}

function handleTerminalPaste(e) {
  if (props.readonlyHistory || terminalInputLocked.value) return

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

/**
 * 将 DOM KeyboardEvent 转换为终端转义序列
 * 用于 xterm.js textarea 丢失焦点时的键盘兜底桥接
 */
function keyEventToTerminalData(e) {
  // 修饰键本身不产生数据
  if (['Meta', 'Control', 'Shift', 'Alt', 'CapsLock', 'NumLock'].includes(e.key)) return null
  // Ctrl+字母 → 控制码（Ctrl+A=0x01, Ctrl+C=0x03, ...）
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
    const code = e.key.toUpperCase().charCodeAt(0)
    if (code >= 65 && code <= 90) return String.fromCharCode(code - 64)
  }
  // Alt+字母 → ESC前缀
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
    return '\x1b' + e.key
  }
  // 特殊键
  switch (e.key) {
    case 'Enter': return '\r'
    case 'Backspace': return '\x7f'
    case 'Tab': return e.shiftKey ? '\x1b[Z' : '\t'
    case 'Escape': return '\x1b'
    case 'ArrowUp': return e.shiftKey ? '\x1b[1;2A' : '\x1b[A'
    case 'ArrowDown': return e.shiftKey ? '\x1b[1;2B' : '\x1b[B'
    case 'ArrowRight': return e.shiftKey ? '\x1b[1;2C' : '\x1b[C'
    case 'ArrowLeft': return e.shiftKey ? '\x1b[1;2D' : '\x1b[D'
    case 'Home': return '\x1b[H'
    case 'End': return '\x1b[F'
    case 'PageUp': return '\x1b[5~'
    case 'PageDown': return '\x1b[6~'
    case 'Delete': return '\x1b[3~'
    case 'Insert': return '\x1b[2~'
    case 'F1': return '\x1bOP'
    case 'F2': return '\x1bOQ'
    case 'F3': return '\x1bOR'
    case 'F4': return '\x1bOS'
    case 'F5': return '\x1b[15~'
    case 'F6': return '\x1b[17~'
    case 'F7': return '\x1b[18~'
    case 'F8': return '\x1b[19~'
    case 'F9': return '\x1b[20~'
    case 'F10': return '\x1b[21~'
    case 'F11': return '\x1b[23~'
    case 'F12': return '\x1b[24~'
  }
  // 普通可打印字符
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    return e.key
  }
  return null
}

async function initTerminalNow() {
  if (terminal) return
  if (!containerRef.value) return
  let bootstrapFailed = false

  const mergedTheme = { ...defaultTheme, ...props.theme }

  terminal = new Terminal({
    theme: mergedTheme,
    fontSize: props.fontSize,
    fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace",
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 10000,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  serializeAddon = new SerializeAddon()
  searchAddon = new SearchAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(serializeAddon)
  terminal.loadAddon(searchAddon)

  // 监听搜索结果变化，获取真实的匹配总数和当前索引
  searchAddon.onDidChangeResults((e) => {
    if (e) {
      emit('search-results', { resultIndex: e.resultIndex, resultCount: e.resultCount })
    }
  })
  terminal.loadAddon(new WebLinksAddon((_, uri) => {
    // 检查是否是本地文件路径
    const isLocalFile = uri.startsWith('file://') ||
                        /^[a-zA-Z]:[\\\/]/.test(uri) || // Windows 绝对路径
                        uri.startsWith('/') || // Unix 绝对路径
                        uri.startsWith('./') || uri.startsWith('../') // 相对路径

    if (isLocalFile) {
      // 处理 file:// 协议
      let filePath = uri.startsWith('file://') ? uri.slice(7) : uri

      // 导入 uiStore 并调用打开文件方法
      import('@/modules/space/uiStore').then(({ useUIStore }) => {
        const uiStore = useUIStore()
        uiStore.openFileInTree(filePath)
      })
    } else {
      // 非文件路径，用系统浏览器打开
      window.electronAPI?.openExternal(uri)
    }
  }))

  terminal.open(containerRef.value)

  containerWheelHandler = (e) => {
    const isMacPlatform = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
    const isZoomGesture = (isMacPlatform && (e.metaKey || e.ctrlKey)) || (!isMacPlatform && e.ctrlKey)

    if (!isZoomGesture || e.deltaY === 0) return

    e.preventDefault()
    e.stopPropagation()

    if (e.deltaY < 0) {
      emit('font-size-change', Math.min(24, props.fontSize + 1))
    } else {
      emit('font-size-change', Math.max(10, props.fontSize - 1))
    }
  }
  containerRef.value.addEventListener('wheel', containerWheelHandler, { passive: false })
  terminalPasteHandler = handleTerminalPaste
  containerRef.value.addEventListener('paste', terminalPasteHandler, true)

  // OSC 9 / 99 / 777 通知 — 在渲染侧解析，不阻塞主进程
  for (const oscId of [9, 99, 777]) {
    terminal.parser.registerOscHandler(oscId, (data) => {
      window.dispatchEvent(new CustomEvent('kc-osc-notification', {
        detail: { termId: props.termId, content: data },
      }))
      return false // 不阻止 xterm 默认处理
    })
  }

  // 恢复 scrollback（在 PTY 启动前写入，用户立即看到历史）
  applyRestoredScrollback(props.restoreScrollback)

  if (props.readonlyHistory) {
    terminal.write('\x1b[33m[项目目录不可用，当前仅显示已保存的历史内容]\x1b[0m\r\n')
  }

  // macOS: 只让 Cmd+C/V/X/A 交给 Electron 做系统复制粘贴
  // Ctrl+C 等需要保留给终端（发送 SIGINT / 控制码），不能拦截
  const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
  terminal.attachCustomKeyEventHandler((e) => {
    if (isMac) {
      // macOS: 仅 Cmd+key 触发系统快捷键
      if (e.metaKey && ['c', 'v', 'x', 'a', 'f'].includes(e.key)) return false
    } else {
      // Windows/Linux: Ctrl+C → 有选中文本时复制，否则保留给终端（SIGINT）
      if (e.ctrlKey && e.key === 'c') {
        if (terminal.hasSelection()) return false
        return true
      }
      // Ctrl+V/X/A/F → 交给系统
      if (e.ctrlKey && ['v', 'x', 'a', 'f'].includes(e.key)) return false
    }
    return true
  })

  await fitTerminalWithRetry({ immediate: false, restoreScroll: false })

  // 监听终端标题变化
  terminal.onTitleChange((title) => {
    emit('title-change', title)
  })

  // ========== 焦点管理 ==========
  // 追踪用户是否点击了终端区域（用于判断焦点应属于终端）
  containerRef.value.addEventListener('mousedown', () => {
    userActivatedTerminal = true
    nextTick(() => terminal?.focus())
  })

  // 选中文本自动复制到剪贴板
  terminal.onSelectionChange(() => {
    const selection = terminal.getSelection()
    hasTerminalSelection.value = Boolean(selection)
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {})
    }
  })

  // 终端右键菜单
  containerRef.value.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    contextMenu.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
    }
  })

  // 点击终端区域外时释放焦点所有权
  docMousedownHandler = (e) => {
    if (containerRef.value && !containerRef.value.contains(e.target)) {
      userActivatedTerminal = false
    }
  }
  document.addEventListener('mousedown', docMousedownHandler)

  // ========== 键盘兜底桥接 ==========
  // 当 xterm.js 的 textarea 丢失焦点（如 vim 切换备用屏幕缓冲区导致 DOM 更新），
  // 按键事件不再被 xterm 捕获。此 document 级 keydown 监听作为兜底：
  // - 恢复 textarea 焦点（修复后续按键）
  // - 将当前丢失的按键手动转发给 PTY（修复当前按键）
  //
  // 注意：此 handler 只应在"焦点真的漂没了（body/null）"时兜底，不应在"用户
  // 合法地把焦点移到别处（ElMessageBox 按钮、下拉菜单、搜索框、通知中心等）"
  // 时抢回，否则会把按键写进 PTY 同时让对话框按钮收不到键盘事件。
  // 典型事故：切换 Bypass Permissions 的二次确认弹窗，用户按 Enter 选项
  // 无效，且终端里出现 `^[` 之类的 ANSI 残留（见 handoff Bug 8）。
  docKeydownHandler = (e) => {
    if (!terminal || !props.active || !userActivatedTerminal || props.readonlyHistory || terminalInputLocked.value) return

    const ae = document.activeElement
    const container = containerRef.value
    const textarea = container?.querySelector('.xterm-helper-textarea')

    // textarea 有焦点时 xterm.js 正常处理，无需兜底
    if (ae === textarea) return

    // 焦点在合法的交互元素上 → 不要抢，也不要把按键转发给 PTY。
    // 覆盖以下场景：
    //   1. ElMessageBox / ElDialog / ElDropdown 的按钮（容器外的 BUTTON/SELECT/...）
    //   2. TerminalSearchBar 的 <input class="search-input">（位于 .terminal-wrapper 内部，INPUT）
    //   3. ProjectDropdown / NotificationCenter / 其他搜索框（容器外的 INPUT/TEXTAREA）
    //   4. contenteditable 元素（如富文本）
    // 不能触发早退的情况（保留原 drift 兜底行为）：
    //   - ae === document.body 或 null（xterm 的 textarea 因为 DOM reactivity 丢焦点）
    if (ae && ae !== document.body && ae !== document.documentElement) {
      const tag = ae.tagName
      const isFormElement =
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        (tag === 'TEXTAREA' && ae !== textarea) ||
        ae.isContentEditable === true
      const outsideTerminalContainer = container && !container.contains(ae)
      if (isFormElement || outsideTerminalContainer) {
        return
      }
    }

    // 焦点丢失但终端应持有焦点 → 恢复焦点（修复后续按键）
    terminal.focus()

    // 修饰键本身不需要转发
    if (['Meta', 'Control', 'Shift', 'Alt', 'CapsLock'].includes(e.key)) return
    // 系统快捷键交给 Electron
    if (isMac) {
      if (e.metaKey && ['c', 'v', 'x', 'a'].includes(e.key)) return
    } else {
      if (e.ctrlKey && ['c', 'v', 'x', 'a'].includes(e.key)) return
    }

    // 将当前按键手动转发给 PTY
    const data = keyEventToTerminalData(e)
    if (data) {
      window.electronAPI?.terminal.write(props.termId, data)
      e.preventDefault()
      e.stopPropagation()
    }
  }
  document.addEventListener('keydown', docKeydownHandler, true)

  // 用户输入 → IPC → PTY
  terminal.onData((data) => {
    forwardTerminalInput(data)
  })

  // PTY 输出 → 终端
  const api = window.electronAPI?.terminal
  if (api && !props.readonlyHistory) {
    unsubData?.()
    unsubExit?.()
    unsubShellState?.()
    unsubData = api.onData(props.termId, (data) => {
      if (terminal) {
        terminal.write(data, () => {
          syncPermissionModeFromVisibleTerminal()
        })
      }
      const permissionMode = permissionModeTracker.push(data)
      if (permissionMode) {
        panelStore.updateAiPermissionMode(props.termId, permissionMode)
      }
      if (shouldAutoAdvanceLoadingWelcomeOnPtyData({
        currentState: welcomeState.value,
        mode: props.mode,
        resumeSessionId: props.resumeSessionId,
      })) {
        applyWelcomeReadyState()
      }
      // Resume 状态机：监听 PTY 输出检测 resume 失败
      if (resumeState === 'RESUMING') {
        resumeOutputBuffer += data
        if (resumeOutputBuffer.length > 2000) {
          // 超过 2000 字符仍无错误，视为成功
          clearResumeMonitor()
        } else {
          for (const pattern of RESUME_FAIL_PATTERNS) {
            if (pattern.test(resumeOutputBuffer)) {
              console.warn('[ClaudeCodeTerminal] resume 失败，检测到:', pattern.source)
              handleResumeFailed()
              return
            }
          }
        }
      }
      // 收到 PTY 数据后检查焦点（vim 切屏、大量输出可能导致焦点丢失）
      if (props.active && userActivatedTerminal) {
        clearTimeout(focusRestoreTimer)
        focusRestoreTimer = setTimeout(() => {
          if (!terminal || !props.active || !userActivatedTerminal) return
          const ta = containerRef.value?.querySelector('.xterm-helper-textarea')
          if (ta && document.activeElement !== ta &&
              (document.activeElement === document.body || !document.activeElement)) {
            terminal.focus()
          }
        }, 50)
      }
    })
    unsubShellState = api.onShellStateChange?.((payload) => {
      if (!payload || payload.termId !== props.termId) return
      if (props.mode !== 'shell') return
      if (payload.state === 'idle') {
        applyWelcomeReadyState()
        emit('shell-ready')
      }
    }) || null
    unsubClaudeStatus = api.onClaudeStatusChange?.((payload) => {
      if (!payload || payload.termId !== props.termId) return
      if (shouldAutoAdvanceLoadingWelcomeOnClaudeStatus({
        currentState: welcomeState.value,
        mode: props.mode,
        resumeSessionId: props.resumeSessionId,
        statusPayload: payload,
      })) {
        applyWelcomeReadyState()
      }
    }) || null
    unsubExit = api.onExit(props.termId, (rawExitPayload) => {
      const exitPayload = normalizeTerminalExitPayload(rawExitPayload)
      const exitCode = exitPayload.exitCode
      const shouldShowExitBanner = !(props.mode === 'claude-code' && !props.forkSession)
      const suppressExitFeedback = shouldSuppressTerminalExitFeedback({
        exitCode,
        suppressUntil: suppressExitFeedbackUntil,
        suppressCodes: suppressExitFeedbackCodes,
      })
      if (suppressExitFeedback) {
        suppressExitFeedbackUntil = 0
        suppressExitFeedbackCodes = []
      }
      // Resume 状态机：PTY 在 RESUMING 期间退出 → 视为失败
      if (shouldTreatExitAsResumeFailure({
        resumeState,
        expectedPid: resumeMonitorPid,
        exitPayload,
      })) {
        console.warn('[ClaudeCodeTerminal] resume PTY 提前退出:', exitCode)
        handleResumeFailed()
        if (props.forkSession) {
          if (!suppressExitFeedback) {
            terminal?.write(`\r\n\x1b[90m[进程已退出，代码: ${exitCode}]\x1b[0m\r\n`)
          }
          emit('exit', exitCode)
        }
        return
      }
      if (resumeState === 'RESUMING') {
        console.info('[ClaudeCodeTerminal] 忽略旧 PTY 迟到退出:', exitPayload)
        return
      }
      if (shouldShowExitBanner && !suppressExitFeedback) {
        terminal?.write(`\r\n\x1b[90m[进程已退出，代码: ${exitCode}]\x1b[0m\r\n`)
      }
      emit('exit', exitCode)
    })
  }

  if (props.readonlyHistory) {
    created = false
    registerTerminalRef(props.termId, { getSerializedContent })
  } else {
    // 创建后端 PTY
    const bootstrapSucceeded = await createPty()
    if (bootstrapSucceeded === false) {
      bootstrapFailed = true
    }
  }

  // 监听容器尺寸变化（防抖，避免 v-show 切换时中间态尺寸导致闪烁）
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

  return bootstrapFailed ? false : terminal
}


async function createPty(welcomeContent) {
  const api = window.electronAPI?.terminal
  if (!api) return false
  permissionModeTracker.reset()
  terminalInputLocked.value = false

  if (props.mode === 'claude-code' && !props.resumeSessionId && !props.forkSession) {
    if (currentPanel.value?.id) {
      panelStore.updateClaudeSessionId(currentPanel.value.id, null)
    }
  }

  const existingPanel = panelStore.panelList.find((panel) => panel.terminalId === props.termId)
  let liveCwdMap = null
  if (existingPanel?.runtimeManaged && typeof window.electronAPI?.session?.collectCwd === 'function') {
    try {
      const collectResult = await window.electronAPI.session.collectCwd()
      if (collectResult?.success && collectResult.data && typeof collectResult.data === 'object') {
        liveCwdMap = collectResult.data
      }
    } catch (error) {
      console.warn('[ClaudeCodeTerminal] collectCwd before runtime-managed reuse failed:', error?.message || error)
    }
  }

  if (shouldReuseRuntimeManagedTerminal({
    runtimeManaged: existingPanel?.runtimeManaged,
    termId: props.termId,
    liveCwdMap,
  })) {
    existingPanel.runtimeManaged = false
    hideWelcomeCard()
    created = true
    sendPtyResizeToMain(true)
    registerTerminalRef(props.termId, { getSerializedContent })
    emit('ready')
    return true
  }

  const cols = terminal?.cols || 80
  const rows = terminal?.rows || 24
  const teamModePayload = props.teamMode?.enabled
    ? cloneTeamModePayload(props.teamMode)
    : undefined
  const callerContext = currentPanel.value?.id
    ? {
        pane: { id: currentPanel.value.id },
        workspace: { id: teamModePayload?.workspaceId || currentPanel.value.tabId || '' },
        surface: { id: teamModePayload?.surfaceId || '' },
      }
    : undefined
  const dangerousMode =
    props.mode === 'claude-code' &&
    currentPanel.value?.aiPermissionMode === 'bypassPermissions'
  const historySeed =
    props.restoredSession && typeof props.restoreScrollback === 'string' && props.restoreScrollback
      ? props.restoreScrollback
      : undefined

  let result
  try {
    result = await api.create({
      termId: props.termId,
      cols,
      rows,
      cwd: props.cwd || undefined,
      mode: props.mode,
      cliBrand: props.cliBrand || undefined,
      welcomeContent,
      resumeSessionId: (props.mode === 'claude-code' && props.resumeSessionId) ? props.resumeSessionId : undefined,
      forkSession: (props.mode === 'claude-code' && props.forkSession) ? true : undefined,
      dangerousMode,
      teamMode: teamModePayload,
      callerContext,
      historySeed,
    })
  } catch (error) {
    const errorMsg = error?.message || '终端创建请求失败'
    terminal?.write(`\x1b[31m[终端创建失败] ${errorMsg}\x1b[0m\r\n`)
    console.error('[ClaudeCodeTerminal] terminal.create 调用失败:', {
      termId: props.termId,
      mode: props.mode,
      cwd: props.cwd,
      teamMode: teamModePayload,
      error: errorMsg,
    })
    return false
  }

  // 保存 shell 类型到 panelStore
  if (result.success && result.shell) {
    const { usePanelStore } = await import('@/modules/terminal/stores/panel')
    const ps = usePanelStore()
    const p = ps.panelList.find(p => p.terminalId === props.termId)
    if (p) p.shell = result.shell
    if (props.mode === 'shell') {
      ps.markShellRuntimeReady(props.termId)
    }
  }

  if (!result.success) {
    const errorMsg = result.error || '未知错误'
    terminal?.write(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`)
    terminal?.write(`\x1b[31m✗ 终端启动失败\x1b[0m\r\n`)
    terminal?.write(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`)
    terminal?.write(`\r\n`)
    terminal?.write(`\x1b[33m错误信息:\x1b[0m\r\n`)
    terminal?.write(`  ${errorMsg}\r\n`)
    terminal?.write(`\r\n`)

    // 如果是文件不存在错误，提供更详细的帮助信息
    if (errorMsg.includes('不存在') || errorMsg.includes('File not found')) {
      terminal?.write(`\x1b[36m可能的原因:\x1b[0m\r\n`)
      terminal?.write(`  1. 应用安装不完整，请尝试重新安装\r\n`)
      terminal?.write(`  2. 文件被杀毒软件隔离，请检查杀毒软件日志\r\n`)
      terminal?.write(`  3. 磁盘空间不足或文件系统错误\r\n`)
      terminal?.write(`\r\n`)
      terminal?.write(`\x1b[36m解决方案:\x1b[0m\r\n`)
      terminal?.write(`  1. 完全卸载后重新安装应用\r\n`)
      terminal?.write(`  2. 将应用添加到杀毒软件白名单\r\n`)
      terminal?.write(`  3. 按 Ctrl+Shift+I 打开开发者工具查看详细日志\r\n`)
      terminal?.write(`\r\n`)
    }

    terminal?.write(`\x1b[90m如需帮助，请联系技术支持并提供上述错误信息\x1b[0m\r\n`)
    terminal?.write(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`)

    // 同时在控制台输出详细错误
    console.error('[ClaudeCodeTerminal] 终端创建失败:', {
      termId: props.termId,
      mode: props.mode,
      cwd: props.cwd,
      forkSession: props.forkSession,
      error: errorMsg,
    })
    return false
  }
  pendingTeamRestoreViewportPlan = resolveTeamRestoreViewportPlan({
    mode: props.mode,
    resumeSessionId: props.resumeSessionId,
    teamMode: props.teamMode,
    restoreHints: result.restoreHints,
  })
  created = true
  if (shouldDeferImmediatePostSpawnResize()) {
    // Kooky resume 对启动阶段连续 resize 很敏感，先认定 spawn 尺寸有效，等布局稳定后再补一次校准。
    syncSpawnedPtySizeFromTerminal()
    schedulePostSpawnFitValidation()
  } else {
    sendPtyResizeToMain(true)
    if (props.restoredSession) {
      schedulePostSpawnFitValidation()
    }
  }
  // 注册到 sessionService，供 scrollback 定期采集
  registerTerminalRef(props.termId, { getSerializedContent })
  emit('ready')

  // 启动 resume 监控（如果是 resume 模式）
  if (props.mode === 'claude-code' && props.resumeSessionId && result.success) {
    startResumeMonitor(result.pid ?? null)
  }

  return true
}

async function recoverMissingTerminal(replayData = '') {
  if (missingTerminalRecoveryPromise || props.readonlyHistory) return

  const api = window.electronAPI?.terminal
  if (!api) return

  const cols = terminal?.cols || 80
  const rows = terminal?.rows || 24
  const dangerousMode = currentPanel.value?.aiPermissionMode === 'bypassPermissions'
  const teamModePayload = props.teamMode?.enabled
    ? cloneTeamModePayload(props.teamMode)
    : undefined

  missingTerminalRecoveryPromise = (async () => {
    try {
      if (props.mode === 'claude-code') {
        const result = await api.respawnClaude({
          termId: props.termId,
          cwd: props.cwd || undefined,
          cliBrand: props.cliBrand || currentPanel.value?.cliBrand || undefined,
          resumeSessionId: props.resumeSessionId || currentPanel.value?.claudeSessionId || undefined,
          dangerousMode,
          teamMode: teamModePayload,
        })
        if (!result?.success) {
          terminal?.write(`\r\n\x1b[31m[终端恢复失败] ${result?.error || '未知错误'}\x1b[0m\r\n`)
          return
        }
      } else {
        const result = await api.create({
          termId: props.termId,
          cols,
          rows,
          cwd: props.cwd || undefined,
          mode: props.mode,
          cliBrand: props.cliBrand || undefined,
          teamMode: teamModePayload,
        })
        if (!result?.success) {
          terminal?.write(`\r\n\x1b[31m[终端恢复失败] ${result?.error || '未知错误'}\x1b[0m\r\n`)
          return
        }
        emit('ready')
      }

      if (replayData) {
        window.setTimeout(() => {
          window.electronAPI?.terminal?.write?.(props.termId, replayData)
        }, 120)
      }
    } finally {
      missingTerminalRecoveryPromise = null
    }
  })()

  return missingTerminalRecoveryPromise
}

/**
 * Resume 状态机：启动监控
 */
function startResumeMonitor(expectedPid = null) {
  resumeState = 'RESUMING'
  resumeOutputBuffer = ''
  resumeMonitorPid = Number.isInteger(expectedPid) && expectedPid > 0 ? expectedPid : null
  resumeTimeoutId = setTimeout(() => {
    // 超时未检测到失败 → 视为成功
    clearResumeMonitor()
  }, RESUME_TIMEOUT_MS)
}

/**
 * Resume 状态机：清除监控（成功）
 */
function clearResumeMonitor() {
  resumeState = 'SUCCESS'
  resumeOutputBuffer = ''
  resumeMonitorPid = null
  if (resumeTimeoutId) {
    clearTimeout(resumeTimeoutId)
    resumeTimeoutId = null
  }
  if (shouldAutoAdvanceLoadingWelcomeOnResumeSettled({
    currentState: welcomeState.value,
    mode: props.mode,
    resumeSessionId: props.resumeSessionId,
  })) {
    applyWelcomeReadyState()
  }
  schedulePendingTeamRestoreViewportCleanup()
}

/**
 * Resume 状态机：处理失败，销毁旧 PTY 并全新启动
 */
async function handleResumeFailed() {
  clearResumeMonitor()
  resumeState = 'FAILED'
  pendingTeamRestoreViewportPlan = null
  clearTimeout(pendingTeamRestoreViewportTimer)
  pendingTeamRestoreViewportTimer = null
  const api = window.electronAPI?.terminal

  if (props.forkSession) {
    terminalInputLocked.value = true
    try {
      await api?.destroy?.(props.termId)
    } catch { /* ignore */ }
    created = false
    terminal?.write('\r\n\x1b[33m[Fork 未完成，请检查上方原因后重试]\x1b[0m\r\n')
    return
  }

  if (!api) return

  // 销毁失败的 PTY
  try {
    await api.destroy(props.termId)
  } catch { /* ignore */ }

  created = false
  const panel = panelStore.panelList.find(p => p.terminalId === props.termId)
  const failedResumeSessionId = props.resumeSessionId || panel?.claudeSessionId || ''
  const cols = terminal?.cols || 80
  const rows = terminal?.rows || 24
  const teamModePayload = (props.mode === 'claude-code' && props.teamMode?.enabled)
    ? cloneTeamModePayload(props.teamMode)
    : undefined

  if (panel?.teamId && teamModePayload?.enabled) {
    terminal?.write('\r\n\x1b[33m[team runtime 恢复失败，正在重建...]\x1b[0m\r\n')
    panelStore.updateClaudeSessionId(panel.id, null)
    const result = await api.create({
      termId: props.termId,
      cols,
      rows,
      cwd: props.cwd || undefined,
      mode: 'claude-code',
      teamMode: teamModePayload,
      blockedSessionIds: failedResumeSessionId ? [failedResumeSessionId] : [],
      callerContext: {
        pane: { id: panel.id },
        workspace: { id: teamModePayload.workspaceId || panel.tabId || '' },
        surface: { id: teamModePayload.surfaceId || '' },
      },
    })
    if (result.success) {
      created = true
      panelStore.updateTeamStatus(props.termId, {
        teamStatus: 'running',
        teamStatusIcon: '⚡',
        teamStatusColor: '#58A6FF',
      })
      sendPtyResizeToMain(true)
      return
    }

    panelStore.markTeamRuntimeFailed(props.termId, {
      cascadeToTeam: panel.teamRole === 'leader',
    })
    terminal?.write(`\r\n\x1b[31m[team runtime 恢复失败] ${result?.error || '未知错误'}\x1b[0m\r\n`)
    return
  }

  terminal?.write('\r\n\x1b[33m[resume 失败，正在全新启动...]\x1b[0m\r\n')
  panelStore.demotePanelToShellMode(props.termId)

  // 全新启动（不带 resumeSessionId），回退为 shell 模式
  const result = await api.create({
    termId: props.termId,
    cols,
    rows,
    cwd: props.cwd || undefined,
    mode: 'shell',
    blockedSessionIds: failedResumeSessionId ? [failedResumeSessionId] : [],
  })
  if (result.success) {
    created = true
    sendPtyResizeToMain(true)
  }
}

function sendPtyResizeToMain(force) {
  if (!created || !terminal) return
  const api = window.electronAPI?.terminal
  if (!api?.resize) return
  const cols = terminal.cols
  const rows = terminal.rows
  if (!force && lastPtyCols === cols && lastPtyRows === rows) return
  lastPtyCols = cols
  lastPtyRows = rows
  try {
    api.resize(props.termId, cols, rows)
  } catch {
    // ignore
  }
}

function shouldDeferImmediatePostSpawnResize() {
  return Boolean(
    props.restoredSession &&
    typeof props.resumeSessionId === 'string' &&
    props.resumeSessionId.trim() &&
    props.cliBrand === 'kooky'
  )
}

function syncSpawnedPtySizeFromTerminal() {
  if (!terminal) return
  lastPtyCols = terminal.cols
  lastPtyRows = terminal.rows
}

function schedulePostSpawnFitValidation() {
  if (!terminal || !fitAddon) return
  clearTimeout(postSpawnFitValidationTimer)
  postSpawnFitValidationTimer = setTimeout(() => {
    postSpawnFitValidationTimer = null
    void fitTerminalWithRetry({ immediate: true, restoreScroll: false })
  }, 220)
}

function schedulePtyResize() {
  if (!created || !terminal || suppressPtyResizeDuringSplitUI) return
  const api = window.electronAPI?.terminal
  if (!api?.resize) return
  clearTimeout(ptyResizeDebounceTimer)
  ptyResizeDebounceTimer = setTimeout(() => {
    ptyResizeDebounceTimer = null
    sendPtyResizeToMain(false)
  }, PTY_RESIZE_DEBOUNCE_MS)
}

function fitTerminalNow(immediate) {
  if (!fitAddon || !terminal) return false
  if (!isTerminalContainerReady(containerRef.value)) return false
  try {
    fitAddon.fit()
    if (created && !suppressPtyResizeDuringSplitUI) {
      if (immediate) {
        clearTimeout(ptyResizeDebounceTimer)
        ptyResizeDebounceTimer = null
        sendPtyResizeToMain(true)
      } else {
        schedulePtyResize()
      }
    }
    return true
  } catch {
    return false
  }
}

function fitTerminal(immediate) {
  if (!fitAddon || !terminal || !containerRef.value) return
  if (!isTerminalContainerReady(containerRef.value)) return
  requestAnimationFrame(() => {
    fitTerminalNow(immediate)
  })
}

// 标签页切换时带重试的 fit，确保 Teleport 迁移完成后容器尺寸可用
async function fitTerminalWithRetry({
  immediate = true,
  restoreScroll = true,
} = {}) {
  const settled = await settleTerminalFit({
    measure: () => containerRef.value,
    fit: () => {
      fitTerminalNow(immediate)
    },
  })

  if (settled && restoreScroll) {
    restoreViewportScrollPosition()
  }
}

/** 保存终端当前滚动位置 */
function saveViewportScrollPosition() {
  if (terminal) {
    savedViewportY = terminal.buffer.active.viewportY
  }
}

/** 恢复终端滚动位置 */
function restoreViewportScrollPosition() {
  if (terminal && savedViewportY !== null) {
    const pos = savedViewportY
    savedViewportY = null
    // 延迟到下一帧恢复，确保 fit 和 DOM 迁移完成
    requestAnimationFrame(() => {
      terminal?.scrollToLine(pos)
    })
  }
}

// ========== 搜索功能 ==========

/**
 * 执行搜索
 * @param {string} query - 搜索词
 * @param {object} options - 搜索选项
 * @returns {object} - 搜索结果 { count: number }
 */
function search(query, options = {}) {
  if (!searchAddon || !query) {
    searchAddon?.clearDecorations()
    currentSearchQuery = ''
    currentSearchOptions = {
      caseSensitive: false,
      regex: false,
      wholeWord: false,
    }
    return { count: 0 }
  }

  // 清除之前的搜索装饰，确保使用新的搜索选项重新搜索
  searchAddon.clearDecorations()

  currentSearchQuery = query
  currentSearchOptions = {
    caseSensitive: options.caseSensitive || false,
    regex: options.useRegex || false,
    wholeWord: options.wholeWord || false,
  }

  searchAddon.findNext(query, {
    caseSensitive: currentSearchOptions.caseSensitive,
    regex: currentSearchOptions.regex,
    wholeWord: currentSearchOptions.wholeWord,
    decorations: searchDecorationOptions,
  })

  // 真实的 count 和 index 通过 onDidChangeResults 事件回调获取
  return { count: -1 }
}

/**
 * 查找下一个
 */
function findNext() {
  if (!searchAddon || !currentSearchQuery) return false

  const result = searchAddon.findNext(currentSearchQuery, {
    caseSensitive: currentSearchOptions.caseSensitive,
    regex: currentSearchOptions.regex,
    wholeWord: currentSearchOptions.wholeWord,
    decorations: searchDecorationOptions,
  })

  return result
}

/**
 * 查找上一个
 */
function findPrevious() {
  if (!searchAddon || !currentSearchQuery) return false

  const result = searchAddon.findPrevious(currentSearchQuery, {
    caseSensitive: currentSearchOptions.caseSensitive,
    regex: currentSearchOptions.regex,
    wholeWord: currentSearchOptions.wholeWord,
    decorations: searchDecorationOptions,
  })

  return result
}

/**
 * 清除搜索高亮
 */
function clearSearch() {
  searchAddon?.clearDecorations()
  currentSearchQuery = ''
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
  } else if (props.readonlyHistory) {
    closeContextMenu()
    terminal?.focus()
    return
  } else if (terminalInputLocked.value) {
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
    emit('start-team')
  }

  closeContextMenu()
  terminal?.focus()
}

function cleanup() {
  if (typeof window !== 'undefined') {
    window.removeEventListener(SPLIT_DIVIDER_DRAG_START, onSplitUiDragStart)
    window.removeEventListener(SPLIT_DIVIDER_DRAG_END, onSplitUiDragEnd)
    window.removeEventListener(LEAF_PANE_DRAG_START, onSplitUiDragStart)
    window.removeEventListener(LEAF_PANE_DRAG_END, onSplitUiDragEnd)
  }
  if (typeof offClaudeHook === 'function') {
    offClaudeHook()
    offClaudeHook = null
  }
  // 清理焦点管理的 document 级事件监听
  if (docMousedownHandler) {
    document.removeEventListener('mousedown', docMousedownHandler)
    docMousedownHandler = null
  }
  if (docKeydownHandler) {
    document.removeEventListener('keydown', docKeydownHandler, true)
    docKeydownHandler = null
  }
  if (containerRef.value && containerWheelHandler) {
    containerRef.value.removeEventListener('wheel', containerWheelHandler)
    containerWheelHandler = null
  }
  if (containerRef.value && terminalPasteHandler) {
    containerRef.value.removeEventListener('paste', terminalPasteHandler, true)
    terminalPasteHandler = null
  }
  clearTimeout(fontSizeChangeTimer)
  fontSizeChangeTimer = null
  clearTimeout(focusRestoreTimer)
  focusRestoreTimer = null
  clearTimeout(welcomeReadyTimer)
  welcomeReadyTimer = null
  clearTimeout(pendingTeamRestoreViewportTimer)
  pendingTeamRestoreViewportTimer = null
  userActivatedTerminal = false
  dragOverCounter = 0
  isDragOverTerminal.value = false
  suppressExitFeedbackUntil = 0
  suppressExitFeedbackCodes = []
  suppressSyntheticFocusInputUntil = 0
  permissionModeTracker.reset()
  pendingTeamRestoreViewportPlan = null
  clearTimeout(ptyResizeDebounceTimer)
  ptyResizeDebounceTimer = null
  clearTimeout(postSpawnFitValidationTimer)
  postSpawnFitValidationTimer = null
  clearTimeout(resizeObserverDebounceTimer)
  resizeObserverDebounceTimer = null
  resizeObserver?.disconnect()
  unsubData?.()
  unsubExit?.()
  if (typeof unsubShellState === 'function') {
    unsubShellState()
    unsubShellState = null
  }
      if (typeof unsubClaudeStatus === 'function') {
        unsubClaudeStatus()
        unsubClaudeStatus = null
      }
      if (created && !isDetaching) {
        window.electronAPI?.terminal.destroy(props.termId)
      }
  terminal?.dispose()
  terminal = null
  fitAddon = null
  serializeAddon = null
  searchAddon = null
  closeContextMenu()
}

/**
 * 聚焦终端
 */
function focus() {
  userActivatedTerminal = true
  nextTick(() => {
    terminal?.focus()
  })
}

/**
 * 获取序列化的终端内容（用于 detach 到新窗口时传递 scrollback）
 */
function getSerializedContent() {
  if (!serializeAddon || !terminal) return ''
  try {
    return serializeAddon.serialize()
  } catch {
    return ''
  }
}

/**
 * 标记终端即将 detach 到独立窗口，cleanup 时不销毁 PTY
 */
function markDetaching() {
  isDetaching = true
}

defineExpose({
  focus,
  fitTerminal,
  getSerializedContent,
  markDetaching,
  search,
  findNext,
  findPrevious,
  clearSearch,
  isReady: () => created,
})
</script>

<style scoped>
.terminal-with-feedback {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.terminal-wrapper {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 0;
  overflow: hidden;
  position: relative;
}

.terminal-feedback-accessory {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 4px 12px 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
}

.terminal-wrapper :deep(.xterm) {
  height: 100%;
  padding: 4px 8px;
}

.terminal-wrapper :deep(.xterm-viewport) {
  overflow-y: auto !important;
  background: transparent;
}

.terminal-drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(67, 111, 246, 0.12);
  border-radius: 4px;
  z-index: 10;
  pointer-events: none;
}

/* 搜索匹配项样式 */
.terminal-wrapper :deep(.xterm-find-result-decoration) {
  outline: none !important;
  background: rgba(220, 180, 126, 0.2) !important;
  border-bottom: 2px solid #E5AC5F !important;
}

.terminal-wrapper :deep(.xterm-find-active-result-decoration) {
  outline: none !important;
  background: rgba(255, 120, 9, 0.2) !important;
  border-bottom: 2px solid #FF7809 !important;
}

/* 欢迎卡片（正常流式布局，在终端上方） */
.welcome-section {
  flex-shrink: 0;
  padding: 12px 16px 8px;
}

.welcome-card {
  box-sizing: border-box;
  display: flex;
  width: min(473px, 100%);
  min-height: 120px;
  border: 1px solid #FF8670;
  border-radius: 16px;
  padding: 14px 18px;
  gap: 0;
  background: #1B1B1B;
  color: rgba(255, 255, 255, 0.92);
  --welcome-accent-color: #FF8670;
  --welcome-muted-color: rgba(255, 255, 255, 0.42);
  --welcome-divider-color: rgba(255, 134, 112, 0.4);
}

.welcome-card.is-light {
  background: #FCFCFD;
  color: #2F3547;
  --welcome-accent-color: #FF8670;
  --welcome-muted-color: #7B7B7B;
  --welcome-divider-color: rgba(255, 134, 112, 0.4);
}

.welcome-left {
  display: flex;
  flex: 0 0 110px;
  align-items: center;
  justify-content: center;
  min-width: 110px;
  padding-right: 16px;
}

.welcome-crab {
  width: 94px;
  height: 94px;
  object-fit: contain;
}

.welcome-divider {
  width: 0;
  border-left: 1px dashed var(--welcome-divider-color);
  margin: 4px 0;
  align-self: stretch;
  flex-shrink: 0;
}

.welcome-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  padding-left: 16px;
  gap: 6px;
  min-width: 0;
}

.welcome-heading {
  margin: 0;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.01em;
  color: currentColor;
}

.welcome-subtitle {
  margin: 0;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--welcome-muted-color);
}

.welcome-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.welcome-line {
  margin: 0;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  color: currentColor;
  word-break: break-word;
}

.welcome-accent {
  color: var(--welcome-accent-color);
}

.welcome-emoji {
  display: inline-block;
  transform: translateY(1px);
}

@media (max-width: 1180px) {
  .welcome-card {
    width: min(473px, 100%);
  }
}

@media (max-width: 820px) {
  .welcome-card {
    height: auto;
    min-height: 120px;
    padding: 10px 16px;
    border-radius: 14px;
  }

  .welcome-left {
    flex-basis: 88px;
    min-width: 88px;
    padding-right: 12px;
  }

  .welcome-right {
    padding-left: 12px;
    gap: 6px;
  }

  .welcome-crab {
    width: 74px;
    height: 74px;
  }
}

@media (max-width: 640px) {
  .welcome-section {
    padding: 16px 12px 8px;
  }

  .welcome-card {
    flex-direction: column;
    gap: 12px;
    height: auto;
    padding: 16px;
    border-radius: 14px;
  }

  .welcome-left {
    min-width: 0;
    padding-right: 0;
  }

  .welcome-divider {
    width: 100%;
    height: 0;
    margin: 0;
    border-left: 0;
    border-top: 3px dashed var(--welcome-divider-color);
  }

  .welcome-right {
    padding-left: 0;
  }
}

/* 淡出动画 */
.welcome-fade-leave-active {
  transition: opacity 0.4s ease;
}
.welcome-fade-leave-to {
  opacity: 0;
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
