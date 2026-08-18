<template>
    <div class="shortcut-bar" :class="{ 'no-status': !showStatusInfo }" :style="barStyle">
      <!-- + 按钮 -->
      <button
        ref="addBtnRef"
        class="add-btn"
        :class="{ disabled: isAtLimit }"
        :disabled="isAtLimit"
        :title="isAtLimit ? `已达到上限（${MAX_COUNT} 条）` : '添加快捷命令'"
        @click="openAddDialog"
      >+</button>

      <!-- 命令按钮列表 -->
      <div ref="listRef" class="btn-list">
        <template v-if="commands.length === 0">
          <span class="empty-hint">添加常用命令，一键发送到终端</span>
        </template>
        <template v-else>
          <ShortcutButton
            v-for="(cmd, idx) in commands"
            :key="cmd.id"
            :item="cmd"
            :dragging="dragIdx === idx"
            :drag-over="dragOverIdx === idx"
            @click="handleClick"
            @contextmenu="handleContextMenu"
            @delete="handleDelete"
            @drag-start="onDragStart(idx)"
            @drag-over="onDragOver(idx)"
            @drop="onDrop(idx)"
          />
        </template>
      </div>

      <!-- 溢出按钮 -->
      <button
        v-if="isOverflowing"
        class="overflow-btn"
        title="查看全部快捷命令"
        @click="toggleOverflowPanel"
      >···</button>

      <!-- 溢出面板 -->
      <ShortcutOverflowPanel
        v-model:visible="overflowPanelVisible"
        :commands="commands"
        @click="handleClick"
        @delete="handleDelete"
        @reorder="reorder"
      />

      <!-- 右侧状态信息 -->
      <div v-if="showStatusInfo && activePanel" class="status-info">
        <template v-if="isClaudeMode">
          <!-- 权限模式徽章（可点击切换） -->
          <span
            class="status-field status-perm-badge is-clickable"
            :class="`perm-${activePanel.aiPermissionMode || 'default'}`"
            :title="'当前权限模式：' + permissionModeLabel + '，点击切换'"
            @click.stop="togglePermMenu"
          >{{ permissionModeLabel }}</span>
          <!-- 模型名（可点击切换） -->
          <span
            v-if="modelShortName"
            class="status-field status-model status-priority-8 is-clickable"
            title="点击切换模型"
            @click.stop="toggleModelMenu"
          >{{ modelShortName }}</span>
          <!-- context 进度：圆环显示，节约横向空间 -->
          <span
            v-if="activePanel.aiContextPercent != null"
            class="status-field status-context-ring status-priority-7"
            :title="`Context: ${activePanel.aiContextPercent}%`"
          >
            <svg class="context-ring-svg" viewBox="0 0 20 20" aria-hidden="true">
              <circle class="context-ring-bg" cx="10" cy="10" r="8" fill="none" stroke-width="2.5" />
              <circle
                class="context-ring-fg"
                cx="10"
                cy="10"
                r="8"
                fill="none"
                stroke-width="2.5"
                :stroke="contextBarColor"
                :stroke-dasharray="contextRingDash"
                stroke-linecap="round"
                transform="rotate(-90 10 10)"
              />
            </svg>
            <span class="context-ring-label" :style="{ color: contextBarColor }">{{ activePanel.aiContextPercent }}%</span>
          </span>
          <span v-if="taskStatusLabel" class="status-field status-priority-6">{{ taskStatusLabel }}</span>
          <span v-if="subagentDisplay" class="status-field status-priority-5">{{ subagentDisplay }}</span>
          <span v-if="teamRoleLabel" class="team-role-badge status-priority-5" :class="teamStatusClass">{{ teamRoleLabel }}</span>
          <!-- 配置资源计数（仅 MCPs） -->
          <template v-for="(item, i) in configCountsDisplay" :key="'cfg-' + i">
            <span class="status-field status-config status-priority-5">{{ item }}</span>
          </template>
          <!-- claude-hud 对齐：正在运行的 tools -->
          <template v-for="(t, i) in runningToolsDisplay" :key="'run-' + i">
            <span class="status-field status-tool-running status-priority-4">
              <span class="tool-icon tool-icon-running">{{ t.icon }}</span>
              <span class="tool-name">{{ t.name }}</span>
              <span v-if="t.target" class="tool-target">: {{ t.target }}</span>
            </span>
          </template>
          <!-- 已完成 tool 计数暂时整块隐藏（数据仍采集） -->
          <!--
          <template v-for="(t, i) in completedToolsDisplay" :key="'done-' + i">
            <span class="status-field status-tool-done">
              <span class="tool-icon tool-icon-done">{{ t.icon }}</span>
              <span class="tool-name">{{ t.name }}</span>
              <span class="tool-count">×{{ t.count }}</span>
            </span>
          </template>
          -->

          <!-- claude-hud 对齐：todos -->
          <span v-if="todosDisplay" class="status-field status-todos status-priority-4">
            <span class="tool-icon" :class="todosDisplay.done ? 'tool-icon-done' : 'tool-icon-running'">{{ todosDisplay.icon }}</span>
            <span>{{ todosDisplay.text }}</span>
            <span class="tool-count">{{ todosDisplay.progress }}</span>
          </span>
          <!-- tokenSpeed / cost 均已隐藏（数据仍采集） -->
          <span v-if="showClaudeInfoDivider" class="status-divider status-priority-3" />
          <span v-if="shortCwd" class="status-field status-priority-3">{{ shortCwd }}</span>
          <span v-if="gitDisplay" class="status-field status-git status-priority-2">{{ gitDisplay }}</span>
          <span v-if="elapsed" class="status-field status-priority-1">⏱{{ elapsed }}</span>
        </template>
        <template v-else>
          <span v-if="activePanel.shell" class="status-field">{{ activePanel.shell }}</span>
          <span v-if="shortCwd" class="status-field status-priority-3">{{ shortCwd }}</span>
          <span v-if="gitDisplay" class="status-field status-git status-priority-2">{{ gitDisplay }}</span>
          <span v-if="elapsed" class="status-field status-priority-1">⏱{{ elapsed }}</span>
        </template>
      </div>

      <!-- 添加/编辑弹窗 -->
      <ShortcutDialog
        :visible="dialogVisible"
        :edit-item="editingItem"
        :anchor-rect="addBtnRect"
        :theme="theme"
        @update:visible="dialogVisible = $event"
        @confirm="handleDialogConfirm"
      />

      <!-- 右键菜单 -->
      <ShortcutContextMenu
        :visible="contextMenuVisible"
        :position="contextMenuPos"
        :item="contextMenuItem"
        :theme="theme"
        @update:visible="contextMenuVisible = $event"
        @edit="openEditDialog"
        @send-to-all="handleSendToAll"
        @delete="handleDelete"
      />

      <!-- 权限模式弹出菜单 -->
      <Teleport to="body">
        <div
          v-if="permMenuVisible"
          class="perm-menu-overlay"
          @click.self="permMenuVisible = false"
        >
          <div class="perm-menu" :style="permMenuStyle">
            <div class="perm-menu__title">权限模式</div>
            <div
              v-for="opt in PERMISSION_MODES"
              :key="opt.value"
              class="perm-menu__item"
              :class="{ 'is-active': (activePanel?.aiPermissionMode || 'default') === opt.value }"
              @click.stop="selectPermissionMode(opt.value)"
            >
              <span class="perm-menu__dot" :class="`perm-${opt.value}`" />
              <span class="perm-menu__label">{{ opt.label }}</span>
              <span v-if="(activePanel?.aiPermissionMode || 'default') === opt.value" class="perm-menu__check">✓</span>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 模型弹出菜单 -->
      <Teleport to="body">
        <div
          v-if="modelMenuVisible"
          class="perm-menu-overlay"
          @click.self="modelMenuVisible = false"
        >
          <div class="perm-menu" :style="modelMenuStyle">
            <div class="perm-menu__title">模型</div>
            <div
              v-for="opt in modelOptions"
              :key="opt.id"
              class="perm-menu__item"
              :class="{ 'is-active': (activePanel?.claudeModelStrategy || 'opusplan') === opt.id }"
              @click.stop="selectModel(opt)"
            >
              <span class="perm-menu__label">{{ opt.label }}</span>
              <span v-if="(activePanel?.claudeModelStrategy || 'opusplan') === opt.id" class="perm-menu__check">✓</span>
            </div>
          </div>
        </div>
      </Teleport>

    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import ShortcutButton from './ShortcutButton.vue'
import ShortcutDialog from './ShortcutDialog.vue'
import ShortcutContextMenu from './ShortcutContextMenu.vue'
import ShortcutOverflowPanel from './ShortcutOverflowPanel.vue'
import { useShortcutCommands } from './useShortcutCommands'
import { useOverflowDetect } from '@/composables/useOverflowDetect'
import { getTeamStatusBarPresentation } from '@/modules/terminal/utils/teamPanePresentation.mjs'
import { getPanelRuntimeState } from '@/modules/terminal/utils/panelRuntimeState.mjs'
import { resolvePermissionModeRespawnUiPlan } from '@/modules/terminal/utils/terminalRespawnUiPlan.mjs'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { useClaudeModels } from '@/modules/terminal/useClaudeModels'

const props = defineProps({
  theme: { type: Object, default: null },
  activePanel: { type: Object, default: null },
})

const panelStore = usePanelStore()
const { loadSettings: loadClaudeModels, modelOptions } = useClaudeModels()
const showStatusInfo = false

const barStyle = computed(() => {
  const t = props.theme
  if (!t) return {}
  return {
    background: t.barBg,
    borderColor: t.barBorder,
    '--bar-btn-bg': t.barBtnBg,
    '--bar-btn-border': t.barBtnBorder,
    '--bar-btn-text': t.barBtnText,
    '--bar-btn-hover-bg': t.barBtnHoverBg,
    '--bar-btn-active-bg': t.barBtnActiveBg || t.barBtnBg,
    '--bar-add-btn-bg': t.barAddBtnBg,
    '--bar-add-btn-text': t.barAddBtnText,
    '--bar-empty-hint': t.barEmptyHint,
  }
})

// 状态信息区
const runtimeState = computed(() => getPanelRuntimeState(props.activePanel))
const statusDotColor = computed(() => runtimeState.value.dotColor)
// claude-hud 对齐：仅当 Claude 当前正在运行时才显示 Claude 区块（退出后整块消失）
const isClaudeMode = computed(() => !!props.activePanel?.claudeActive)

// 圆环周长（r=8 → 2πr ≈ 50.27）
const CONTEXT_RING_CIRCUMFERENCE = 2 * Math.PI * 8
const contextRingDash = computed(() => {
  const pct = Math.max(0, Math.min(100, props.activePanel?.aiContextPercent ?? 0))
  const filled = (pct / 100) * CONTEXT_RING_CIRCUMFERENCE
  return `${filled} ${CONTEXT_RING_CIRCUMFERENCE}`
})

const contextBarColor = computed(() => {
  const pct = props.activePanel?.aiContextPercent
  if (pct == null) return '#3fb950'
  if (pct >= 85) return '#f85149'
  if (pct >= 70) return '#d29922'
  return '#3fb950'
})

const shortCwd = computed(() => {
  const cwd = props.activePanel?.cwd || ''
  if (!cwd) return ''
  const parts = cwd.split('/').filter(Boolean)
  const last = parts.pop() || ''
  return last ? `~/${last}` : ''
})

const gitDisplay = computed(() => {
  const branch = props.activePanel?.gitBranch
  if (!branch) return ''
  return branch + (props.activePanel?.gitDirty ? '*' : '')
})

const elapsed = ref('')
let elapsedTimer = null
function updateElapsed() {
  const start = props.activePanel?.ptySpawnedAt
  if (!start) { elapsed.value = ''; return }
  const diff = Math.floor((Date.now() - start) / 1000)
  if (diff < 60) elapsed.value = `${diff}s`
  else if (diff < 3600) elapsed.value = `${Math.floor(diff / 60)}m`
  else elapsed.value = `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}m`
}
onMounted(() => { updateElapsed(); elapsedTimer = setInterval(updateElapsed, 10000) })
onBeforeUnmount(() => { if (elapsedTimer) clearInterval(elapsedTimer) })

const modelShortName = computed(() => {
  const strategy = props.activePanel?.claudeModelStrategy
  if (!strategy) return ''
  // 从动态模型列表中查找对应的 label
  const option = modelOptions.value.find(opt => opt.id === strategy)
  if (option) {
    return option.label.replace('Claude ', '').replace(' (默认)', '')
  }
  // 降级：从 aiModel 解析
  const name = props.activePanel?.aiModel || ''
  const match = name.match(/Claude\s+(\w+)/i)
  return match ? match[1] : name || ''
})

const tokenSpeed = computed(() => {
  const s = props.activePanel?.aiTokenSpeed
  return s != null ? `out: ${s.toFixed(1)} tok/s` : ''
})

const costDisplay = computed(() => {
  const c = props.activePanel?.aiCostUsd
  return c != null ? `$${c.toFixed(2)}` : ''
})

const teamStatusPresentation = computed(() => getTeamStatusBarPresentation(props.activePanel))

const taskStatusLabel = computed(() => {
  if (teamStatusPresentation.value?.statusLabel) return teamStatusPresentation.value.statusLabel
  return runtimeState.value.statusFieldLabel || ''
})

const subagentDisplay = computed(() => {
  const count = props.activePanel?.aiSubagentCount ?? 0
  return count > 0 ? `Agent:${count}` : ''
})

// 配置资源数暂时全部隐藏（CLAUDE.md / MCPs / hooks 数据仍采集）
const configCountsDisplay = computed(() => [])

// claude-hud 对齐：Running tools（最多 2 个）+ 已完成 tool counts（Top 4）
function truncatePath(p, maxLen = 20) {
  if (!p) return ''
  const s = String(p).replace(/\\/g, '/')
  if (s.length <= maxLen) return s
  const parts = s.split('/')
  const file = parts.pop() || s
  if (file.length >= maxLen) return file.slice(0, maxLen - 3) + '...'
  return '.../' + file
}

// 底部栏隐藏（数据仍采集）：Bash / Skill
const HIDDEN_TOOL_NAMES = new Set(['Bash', 'Skill'])

const runningToolsDisplay = computed(() => {
  const list = props.activePanel?.aiRunningTools || []
  return list
    .filter(t => !HIDDEN_TOOL_NAMES.has(t.name))
    .slice(-2)
    .map(t => ({
      icon: '◐',
      name: t.name || '',
      target: t.target ? truncatePath(t.target) : '',
    }))
})

const completedToolsDisplay = computed(() => {
  const map = props.activePanel?.aiToolCountsByName || {}
  const entries = Object.entries(map).filter(([name, c]) => c > 0 && !HIDDEN_TOOL_NAMES.has(name))
  entries.sort((a, b) => b[1] - a[1])
  return entries.slice(0, 4).map(([name, count]) => ({ icon: '✓', name, count }))
})

// claude-hud 对齐：todos
const todosDisplay = computed(() => {
  const todos = props.activePanel?.aiTodos || []
  if (todos.length === 0) return null
  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  const inProgress = todos.find(t => t.status === 'in_progress')
  if (inProgress) {
    const content = inProgress.content.length > 50
      ? inProgress.content.slice(0, 47) + '...'
      : inProgress.content
    return { icon: '▸', text: content, progress: `(${completed}/${total})`, done: false }
  }
  if (completed === total && total > 0) {
    return { icon: '✓', text: 'All todos complete', progress: `(${completed}/${total})`, done: true }
  }
  return null
})

const teamRoleLabel = computed(() => {
  return teamStatusPresentation.value?.roleLabel || ''
})

const teamStatusClass = computed(() => {
  const status = teamStatusPresentation.value?.statusTone || runtimeState.value.tone
  if (status === 'running') return 'team-running'
  if (status === 'needs-input') return 'team-input'
  if (status === 'error') return 'team-error'
  return 'team-idle'
})

const showClaudeInfoDivider = computed(() => {
  const hasClaudeFields = !!(
    modelShortName.value ||
    props.activePanel?.aiContextPercent != null ||
    taskStatusLabel.value ||
    subagentDisplay.value ||
    runningToolsDisplay.value.length > 0 ||
    todosDisplay.value
  )
  const hasEnvFields = !!(shortCwd.value || gitDisplay.value || elapsed.value)
  return hasClaudeFields && hasEnvFields
})

// ========== 权限模式 + 模型切换 ==========
const PERMISSION_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'plan', label: 'Plan Mode' },
  { value: 'bypassPermissions', label: 'Bypass Permissions' },
]

// 对应显示徽章文案
const permissionModeLabel = computed(() => {
  const mode = props.activePanel?.aiPermissionMode || 'default'
  const m = PERMISSION_MODES.find(x => x.value === mode)
  return m?.label || 'Default'
})

// 模型列表从 settings.json 动态读取（useClaudeModels），不再硬编码

const permMenuVisible = ref(false)
const permMenuStyle = ref({ left: '0px', top: '0px' })
const modelMenuVisible = ref(false)
const modelMenuStyle = ref({ left: '0px', top: '0px' })

function togglePermMenu(e) {
  if (permMenuVisible.value) {
    permMenuVisible.value = false
    return
  }
  modelMenuVisible.value = false
  const rect = e.currentTarget.getBoundingClientRect()
  permMenuStyle.value = {
    left: rect.left + 'px',
    top: (rect.top - 8) + 'px',
    transform: 'translateY(-100%)',
  }
  permMenuVisible.value = true
}

function toggleModelMenu(e) {
  if (modelMenuVisible.value) {
    modelMenuVisible.value = false
    return
  }
  permMenuVisible.value = false
  const rect = e.currentTarget.getBoundingClientRect()
  modelMenuStyle.value = {
    left: rect.left + 'px',
    top: (rect.top - 8) + 'px',
    transform: 'translateY(-100%)',
  }
  modelMenuVisible.value = true
}

// Shift+Tab 对应 ANSI: ESC [ Z
const SHIFT_TAB = '\x1b[Z'
const CR = '\r'

function sendToPty(data) {
  const termId = props.activePanel?.terminalId
  if (!termId) return
  window.electronAPI?.terminal?.write?.(termId, data)
}

function syncPermissionModeBadge(termId, targetMode) {
  if (!termId || !targetMode) return
  panelStore.updateAiPermissionMode(termId, targetMode)
}

async function resolveResumableSessionId(termId, preferredSessionId, cwd, options = {}) {
  const sessionApi = window.electronAPI?.session
  if (!sessionApi?.resolveResumableSessionId || !termId) {
    return preferredSessionId || ''
  }

  try {
    const result = await sessionApi.resolveResumableSessionId(termId, preferredSessionId || '', cwd || '', options)
    return result?.data?.sessionId || ''
  } catch (error) {
    console.warn('[ShortcutBar] 解析可恢复 sessionId 失败:', error)
    return preferredSessionId || ''
  }
}

// 权限模式切换
// - default / acceptEdits / plan: 通过 Shift+Tab 循环（Claude CLI 内置键盘快捷键，无需 confirm）
// - bypassPermissions: 必须在启动时带 --dangerously-skip-permissions
//   → 需要用户确认（会打断当前 Claude 会话进程），然后 kill PTY + resume 重建
async function selectPermissionMode(targetMode) {
  permMenuVisible.value = false
  const current = props.activePanel?.aiPermissionMode || 'default'
  if (current === targetMode) return

  const panel = props.activePanel
  const termId = panel?.terminalId
  const sessionId = panel?.claudeSessionId

  // 切换到 bypass 或从 bypass 切出：都需要 respawn（中断 + 重启 + resume）
  const needsRespawn = targetMode === 'bypassPermissions' || current === 'bypassPermissions'

  if (needsRespawn) {
    if (!termId) return
    // 解析可恢复的 sessionId（hook 绑定 → preferred 校验 → cwd 磁盘扫描）
    const resumableSessionId = await resolveResumableSessionId(termId, sessionId, panel?.cwd, {
      strictTermBinding: true,
    })
    if (resumableSessionId && resumableSessionId !== sessionId) {
      panelStore.updateClaudeSessionId(panel?.id, resumableSessionId)
    } else if (!resumableSessionId && sessionId) {
      panelStore.updateClaudeSessionId(panel?.id, null)
    }

    // 二次确认
    const isEnteringBypass = targetMode === 'bypassPermissions'
    const title = isEnteringBypass ? '切换到高权限模式' : '退出高权限模式'
    let content
    if (resumableSessionId) {
      content = isEnteringBypass
        ? '切换到 Bypass Permissions 会打断当前 Claude 会话进程（正在执行的任务会被中断），重启后会自动 resume 恢复会话历史。\n\n是否确认？'
        : '退出 Bypass Permissions 会打断当前 Claude 会话进程（正在执行的任务会被中断），重启后会自动 resume 恢复会话历史。\n\n是否确认？'
    } else {
      content = '当前 Claude 会话还没有生成可恢复的 sessionId。继续切换会启动一个全新的 Claude 会话，当前内容将不会保留。\n\n是否确认？'
    }

    try {
      await ElMessageBox.confirm(content, title, {
        confirmButtonText: isEnteringBypass ? '确认切换' : '确认退出',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'perm-confirm-dialog',
      })
    } catch {
      // 用户取消 — 什么都不做，模式显示保持原值
      return
    }

    const res = await window.electronAPI?.terminal?.respawnClaude?.({
      termId,
      cwd: panel?.cwd || undefined,
      cliBrand: panel?.cliBrand || undefined,
      resumeSessionId: resumableSessionId || undefined,
      dangerousMode: isEnteringBypass,
    })
    if (!res?.success) {
      ElMessage.error('切换失败：' + (res?.error || '未知错误'))
    } else {
      panelStore.promotePanelToClaudeMode(termId, {
        preserveShellHost: panel?.mode === 'shell' || panel?.shellHostedClaude === true,
      })
      const uiPlan = resolvePermissionModeRespawnUiPlan({
        currentMode: current,
        targetMode,
      })
      if (uiPlan?.optimisticPermissionMode) {
        syncPermissionModeBadge(termId, uiPlan.optimisticPermissionMode)
      }
      if (uiPlan?.eventName) {
        window.dispatchEvent(new CustomEvent(uiPlan.eventName, {
          detail: {
            termId,
            clearViewport: uiPlan.clearViewport,
            suppressSyntheticFocusInput: uiPlan.suppressSyntheticFocusInput,
            suppressSyntheticFocusInputMs: uiPlan.suppressSyntheticFocusInputMs,
            suppressExitBannerMs: uiPlan.suppressExitBannerMs,
            suppressExitBannerCodes: uiPlan.suppressExitBannerCodes,
          },
        }))
      }
      if (uiPlan?.messageText && uiPlan?.messageType && typeof ElMessage[uiPlan.messageType] === 'function') {
        ElMessage[uiPlan.messageType](uiPlan.messageText)
      }
    }
    return
  }

  // default / acceptEdits / plan 之间通过 Shift+Tab 循环，无需确认
  const order = ['default', 'acceptEdits', 'plan']
  const curIdx = order.indexOf(current)
  const tgtIdx = order.indexOf(targetMode)
  if (curIdx === -1 || tgtIdx === -1) return

  const steps = (tgtIdx - curIdx + order.length) % order.length
  for (let i = 0; i < steps; i++) {
    sendToPty(SHIFT_TAB)
    await new Promise(r => setTimeout(r, 30))
  }
  syncPermissionModeBadge(termId, targetMode)
}

function selectModel(opt) {
  modelMenuVisible.value = false
  // Claude CLI 的 /model 支持直接传参
  sendToPty(`/model ${opt.id}`)
  sendToPty(CR)
  // 同步记录策略到 panelStore，用于 ShortcutBar 显示与 snapshot 持久化
  const termId = props.activePanel?.terminalId
  if (termId) panelStore.updateClaudeModelStrategy(termId, opt.id)
}

// 点击外部关闭菜单
function onDocClickPerm(e) {
  if (!permMenuVisible.value && !modelMenuVisible.value) return
  const isInMenu = e.target?.closest?.('.perm-menu') || e.target?.closest?.('.status-perm-badge') || e.target?.closest?.('.status-model')
  if (!isInMenu) {
    permMenuVisible.value = false
    modelMenuVisible.value = false
  }
}

function handleTransientUiEscape(event) {
  if (event.key !== 'Escape') return

  const hasTransientUi =
    permMenuVisible.value ||
    modelMenuVisible.value ||
    overflowPanelVisible.value ||
    contextMenuVisible.value

  if (!hasTransientUi) return

  permMenuVisible.value = false
  modelMenuVisible.value = false
  overflowPanelVisible.value = false
  contextMenuVisible.value = false
  event.preventDefault()
  event.stopPropagation()
}

const emit = defineEmits(['send-command', 'send-command-all'])

const {
  commands,
  isAtLimit,
  MAX_COUNT,
  load,
  addCommand,
  updateCommand,
  removeCommand,
  reorder,
} = useShortcutCommands()

const listRef = ref(null)
const addBtnRef = ref(null)

// 溢出检测
const { isOverflowing } = useOverflowDetect(listRef, computed(() => commands.value.length))
const overflowPanelVisible = ref(false)
function toggleOverflowPanel() {
  overflowPanelVisible.value = !overflowPanelVisible.value
}

onMounted(() => {
  load()
  loadClaudeModels()
  document.addEventListener('click', onDocClickPerm, true)
  document.addEventListener('keydown', handleTransientUiEscape, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClickPerm, true)
  document.removeEventListener('keydown', handleTransientUiEscape, true)
})

// ========================
// 添加/编辑弹窗
// ========================
const dialogVisible = ref(false)
const editingItem = ref(null)
const addBtnRect = ref(null)

function openAddDialog() {
  if (isAtLimit.value) return
  editingItem.value = null
  addBtnRect.value = addBtnRef.value?.getBoundingClientRect() ?? null
  dialogVisible.value = true
}

function openEditDialog(item) {
  editingItem.value = item
  addBtnRect.value = addBtnRef.value?.getBoundingClientRect() ?? null
  dialogVisible.value = true
}

function handleDialogConfirm(data) {
  if (data.id) {
    updateCommand(data.id, data)
  } else {
    addCommand(data)
  }
}

// ========================
// 右键菜单
// ========================
const contextMenuVisible = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuItem = ref(null)

function handleContextMenu({ event, item }) {
  const rect = event.target.closest('.shortcut-btn-wrapper')?.getBoundingClientRect()
  contextMenuPos.value = {
    x: rect ? rect.left + rect.width / 2 - 80 : event.clientX,
    y: rect ? rect.top : event.clientY,
  }
  contextMenuItem.value = item
  contextMenuVisible.value = true
}

// ========================
// 命令操作
// ========================

function handleClick(item) {
  emit('send-command', { command: item.command, mode: item.mode })
}

function handleSendToAll(item) {
  emit('send-command-all', { command: item.command, mode: item.mode })
}

function handleDelete(item) {
  removeCommand(item.id)
}

// ========================
// 拖拽排序
// ========================
const dragIdx = ref(-1)
const dragOverIdx = ref(-1)

function onDragStart(idx) {
  dragIdx.value = idx
}

function onDragOver(idx) {
  dragOverIdx.value = idx
}

function onDrop(idx) {
  if (dragIdx.value === -1 || dragIdx.value === idx) return
  const list = [...commands.value]
  const [moved] = list.splice(dragIdx.value, 1)
  list.splice(idx, 0, moved)
  reorder(list)
  dragIdx.value = -1
  dragOverIdx.value = -1
}
</script>

<style scoped>
.shortcut-bar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding-left: 20px;
  padding-right: 20px;
  border-width: 1px 0px 0px 0px;
  border-style: solid;
  user-select: none;
  overflow: visible;
  /* Windows 渲染优化：强制 GPU 层独立，避免残留 */
  will-change: opacity;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.add-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--bar-add-btn-bg, #2B2B2C);
  color: var(--bar-add-btn-text, #8C8C8C);
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
}

.add-btn:hover:not(.disabled) {
  background: var(--bar-btn-hover-bg, rgba(255, 255, 255, 0.12));
  color: var(--bar-btn-text, rgba(255, 255, 255, 0.95));
}

.add-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-list {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
}

.shortcut-bar.no-status .btn-list {
  flex: 1 1 auto;
}

.btn-list::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.overflow-btn {
  flex-shrink: 0;
  width: 28px;
  height: 26px;
  border-radius: 6px;
  background: var(--bar-btn-bg, rgba(255, 255, 255, 0.06));
  color: #8b949e;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.overflow-btn:hover {
  background: var(--bar-btn-hover-bg, rgba(255, 255, 255, 0.12));
  color: rgba(255, 255, 255, 0.95);
}

.empty-hint {
  color: var(--bar-empty-hint, rgba(255, 255, 255, 0.3));
  font-size: 13px;
  white-space: nowrap;
}

.status-info {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-size: 10px;
  color: #6e7681;
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(46vw, 760px);
  margin-left: auto;
  padding-left: 12px;
  border-left: 1px solid var(--bar-btn-border, #21262d);
  white-space: nowrap;
  overflow: hidden;
  container-type: inline-size;
}
.status-field,
.team-role-badge,
.status-divider {
  flex-shrink: 0;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-model {
  color: #79c0ff;
}
.status-context {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.status-divider {
  width: 1px;
  height: 12px;
  background: var(--bar-btn-border, #21262d);
  margin: 0 2px;
  flex-shrink: 0;
}
.status-git {
  color: #FF6B35;
}
/* claude-hud 对齐：配置 / tools / todos */
.status-config {
  color: #9e9e9e;
}
.status-tool-running, .status-tool-done, .status-todos {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tool-icon {
  font-size: 11px;
  line-height: 1;
}
.tool-icon-running {
  color: #EAB308;
}
.tool-icon-done {
  color: #22C55E;
}
.tool-name {
  color: #3BB9C9;
}
.tool-target {
  color: #6B7280;
}
.tool-count {
  color: #6B7280;
  font-size: 10px;
}

/* 可点击字段：模型 / 权限模式 */
.is-clickable {
  cursor: pointer;
  transition: background 0.15s ease;
  border-radius: 4px;
  padding: 1px 6px;
}
.is-clickable:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 权限模式徽章 */
.status-perm-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}
.status-perm-badge.perm-default { color: #8b949e; }
.status-perm-badge.perm-acceptEdits { color: #d29922; }
.status-perm-badge.perm-plan { color: #58a6ff; }
.status-perm-badge.perm-bypassPermissions { color: #FF6B35; }

/* 弹出菜单 */
.perm-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: auto;
}
.perm-menu {
  position: fixed;
  min-width: 180px;
  background: #1c2128;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 6px;
  font-size: 12px;
}
.perm-menu__title {
  padding: 6px 10px 8px;
  color: #6e7681;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #30363d;
  margin-bottom: 4px;
}
.perm-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  color: #c9d1d9;
  cursor: pointer;
  transition: background 0.12s;
}
.perm-menu__item:hover {
  background: #21262d;
}
.perm-menu__item.is-active {
  background: rgba(88, 166, 255, 0.1);
  color: #58a6ff;
}
.perm-menu__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.perm-menu__dot.perm-default { background: #8b949e; }
.perm-menu__dot.perm-acceptEdits { background: #d29922; }
.perm-menu__dot.perm-plan { background: #58a6ff; }
.perm-menu__dot.perm-bypassPermissions { background: #FF6B35; }
.perm-menu__label {
  flex: 1;
}
.perm-menu__check {
  color: #58a6ff;
  font-weight: 700;
}

@container (max-width: 560px) {
  .status-priority-1 {
    display: none !important;
  }
}

@container (max-width: 500px) {
  .status-priority-2 {
    display: none !important;
  }
}

@container (max-width: 440px) {
  .status-priority-3 {
    display: none !important;
  }
}

@container (max-width: 380px) {
  .status-priority-4 {
    display: none !important;
  }
}

@container (max-width: 330px) {
  .status-priority-5 {
    display: none !important;
  }
}

@container (max-width: 290px) {
  .status-priority-6 {
    display: none !important;
  }
}

@container (max-width: 250px) {
  .status-priority-7 {
    display: none !important;
  }
}

@container (max-width: 210px) {
  .status-priority-8 {
    display: none !important;
  }
}
.context-bar {
  display: inline-block;
  width: 36px;
  height: 4px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
  vertical-align: middle;
}
.context-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}
/* context 圆环进度 — 节约横向空间 */
.status-context-ring {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.context-ring-svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.context-ring-bg {
  stroke: #21262d;
}
.context-ring-fg {
  transition: stroke-dasharray 0.3s ease, stroke 0.3s ease;
}
.context-ring-label {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.team-role-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  margin-left: 4px;
}
.team-role-badge.team-running { background: rgba(76, 141, 255, 0.15); color: #4C8DFF; }
.team-role-badge.team-input { background: rgba(255, 149, 0, 0.15); color: #FF9500; }
.team-role-badge.team-error { background: rgba(255, 59, 48, 0.15); color: #FF3B30; }
.team-role-badge.team-idle { background: rgba(142, 142, 147, 0.15); color: #8E8E93; }

</style>
