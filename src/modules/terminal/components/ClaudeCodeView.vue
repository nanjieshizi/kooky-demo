<template>
  <div
    class="claude-code-view"
    :class="{ 'light-theme': currentThemeKey === 'light' }"
    :data-project-readonly="activeProjectPathInvalid ? 'true' : 'false'"
    :style="{ background: currentTheme.background, '--pane-title': currentTheme.paneTitle || 'rgba(255, 255, 255, 0.5)', '--tab-border': currentTheme.tabBorder }"
  >
    <!-- 搜索栏 -->
    <TerminalSearchBar
      v-show="searchVisible"
      ref="searchBarRef"
      :theme="currentTheme"
      :current-index="searchCurrentIndex"
      :result-count="searchResultCount"
      @close="closeSearch"
      @search="handleSearch"
      @find-next="findNext"
      @find-previous="findPrevious"
      @options-change="handleSearchOptionsChange"
    />

    <!-- 左右分栏内容区 -->
    <div class="claude-code-content">
      <WorkbenchSidebar
        :theme="currentTheme"
        :tooltip-effect="tooltipEffect"
        @switch-workbench="handleWorkbenchSwitch"
        @add-workbench="createWorkbench"
        @create-project="handleProjectCreate"
        @delete-workbench="handleWorkbenchDelete"
        @notification-navigate="handleNotificationNavigate"
      />
      <div class="claude-code-main">
        <!-- Tab 栏（遍历当前 workbench 的 tabs） -->
        <div class="tab-bar" :style="tabBarStyle">
          <div ref="tabBarLeftRef" class="tab-bar-left">
            <div
              v-for="tab in currentTabs"
              :key="tab.id"
              :ref="el => setTabItemRef(tab.id, el)"
              class="tab-item"
              :class="{
                active: isActiveTab(tab.id),
                'drag-over': dragOverTabId === tab.id,
              }"
              @mousedown="onTabItemMouseDown(tab, $event)"
              @mouseover="onTabBarMouseOver(tab.id)"
              @mouseleave="onTabBarMouseLeave(tab.id)"
              @contextmenu.prevent="onTabContextMenu($event, tab)"
            >
              <span class="tab-title">{{ getTabTitle(tab) }}</span>
              <span v-if="tabDotColor(tab)" class="tab-status-dot" :style="{ background: tabDotColor(tab) }" />
              <button class="tab-close" @click.stop="closeTab(tab.id)">✕</button>
            </div>
            <!-- 不溢出时，加号跟在最后一个 tab 后面 -->
            <el-tooltip v-if="!isTabOverflowing" content="新建标签" placement="bottom" :show-after="0" :effect="tooltipEffect">
              <button class="tab-add-btn" @click="addTab('shell')">+</button>
            </el-tooltip>
          </div>
          <!-- 溢出时，更多和加号固定在右侧 -->
          <div v-if="isTabOverflowing" class="tab-bar-overflow-actions">
            <button
              class="tab-overflow-btn"
              title="查看隐藏标签"
              @click.stop="refreshHiddenTabs(); tabOverflowVisible = !tabOverflowVisible"
            >···</button>
            <el-tooltip content="新建标签" placement="bottom" :show-after="0" :effect="tooltipEffect">
              <button class="tab-add-btn" @click="addTab('shell')">+</button>
            </el-tooltip>
          </div>
          <!-- Tab 溢出面板（仅显示隐藏的标签页） -->
          <Teleport to="body">
            <div v-if="tabOverflowVisible" class="tab-overflow-mask" @mousedown="tabOverflowVisible = false" />
            <Transition name="tab-overflow-fade">
              <div v-if="tabOverflowVisible" class="tab-overflow-panel" :style="tabOverflowPanelStyle">
                <div
                  v-for="tab in hiddenTabs"
                  :key="'overflow-' + tab.id"
                  class="tab-overflow-item"
                  :class="{ 'is-active': isActiveTab(tab.id) }"
                  @click="onTabOverflowClick(tab)"
                >
                  <span v-if="tabDotColor(tab)" class="tab-overflow-dot" :style="{ background: tabDotColor(tab) }" />
                  <span class="tab-overflow-title">{{ getTabTitle(tab) }}</span>
                  <span v-if="isActiveTab(tab.id)" class="tab-overflow-check">✓</span>
                </div>
              </div>
            </Transition>
          </Teleport>
          <div class="tab-bar-right">
            <!-- 分屏操作 -->
            <el-tooltip
              content="水平分屏（左右）"
              placement="bottom"
              :show-after="0"
              :effect="tooltipEffect"
              append-to="#app"
              strategy="fixed"
              :popper-options="terminalToolbarTooltipPopperOptions"
            >
              <button class="toolbar-btn" @click="splitVertical">
                <SvgIcon name="youfenping" :size="16" :color="iconColor" />
              </button>
            </el-tooltip>
            <el-tooltip
              content="垂直分屏（上下）"
              placement="bottom"
              :show-after="0"
              :effect="tooltipEffect"
              append-to="#app"
              strategy="fixed"
              :popper-options="terminalToolbarTooltipPopperOptions"
            >
              <button class="toolbar-btn" @click="splitHorizontal">
                <SvgIcon name="xiafenping" :size="16" :color="iconColor" />
              </button>
            </el-tooltip>
            <!-- <span class="tab-bar-separator" aria-hidden="true" />
            <el-tooltip
              content="文件"
              placement="bottom"
              :show-after="0"
              :effect="tooltipEffect"
              append-to="#app"
              strategy="fixed"
              :popper-options="terminalToolbarTooltipPopperOptions"
            >
              <button
                class="toolbar-btn"
                :class="{ active: isFilePanelActive }"
                aria-label="文件"
                @click="uiStore.setActiveToolTab('file')"
              >
                <SvgIcon name="icon-wenjian" :size="16" :color="fileIconColor" />
              </button>
            </el-tooltip> -->
          </div>
        </div>

        <!-- 主体区域（终端/编辑器） -->
        <div class="main-area">
          <!-- 右侧区域（终端 + 编辑器） -->
          <div class="right-area">
            <!-- 终端区域 -->
            <SplitLayout
              v-if="activeWorkbench"
              class="terminals-area"
              :root="activeLayoutRoot"
              :active-leaf-id="activeLeafId"
              :drag-state="globalDragState"
              :is-single-pane="activeTabIsSinglePane"
              :theme="currentTheme"
              @resize="(splitId, sizes) => activeManager?.resizeNode(splitId, sizes)"
              @move-leaf="onMoveLeaf"
              @set-active="handleSetActiveLeaf"
              @remove-leaf="removePanel"
              @start-drag="onStartDrag"
              @end-drag="onEndDrag"
            >
              <!--
                SplitNode 传递 node.terminalId（旧字段名），refactored 后 leaf 节点只有 panelId。
                因此这里用 leafId 桥接查找 terminalId。SplitNode 需在后续任务中更新 slot props。
              -->
              <template #pane-header="{ leafId, panelId }">
                <div class="pane-header-content" @contextmenu.prevent="onPaneHeaderContextMenu($event, leafId)">
                  <template v-if="getPaneHeaderTeamPresentation(panelId)">
	                    <span class="pane-title-group">
	                      <span class="pane-title">{{ getPaneHeaderTeamPresentation(panelId).title }}</span>
	                      <span class="pane-team-badge" :class="`is-${getPaneHeaderTeamPresentation(panelId).statusTone}`">
	                        {{ getPaneHeaderTeamPresentation(panelId).badgeLabel }}
	                      </span>
	                      <span class="pane-team-status" :class="`is-${getPaneHeaderTeamPresentation(panelId).statusTone}`">
	                        {{ getPaneHeaderTeamPresentation(panelId).statusLabel }}
	                      </span>
	                    </span>
                  </template>
                  <span v-else class="pane-title">
                    {{ getTerminalTitle(getTerminalIdForLeaf(leafId)) }}
                  </span>
                </div>
              </template>

              <!-- 仅挂载占位；真实终端在下方 Teleport，避免布局树重组时卸载 ClaudeCodeTerminal（PTY 被重建） -->
              <template #leaf="{ leafId }">
                <div class="terminal-pane-host" :ref="terminalHostRefFor(getTerminalIdForLeaf(leafId))" />
              </template>
            </SplitLayout>

            <!-- 编辑器面板 -->
            <div v-if="editorPanelVisible" class="editor-area">
              <EditorPanel ref="editorPanelRef" :theme="currentTheme" @close="editorPanelVisible = false" />
            </div>
          </div>
        </div>

        <!-- 快捷命令栏 -->
        <ShortcutBar
          :visible="true"
          :theme="currentTheme"
          :active-panel="activePanelForStatusBar"
          @send-command="handleShortcutSendCommand"
          @send-command-all="handleShortcutSendCommandAll"
        />
      </div>
    </div>

    <!-- 每终端独立屏外 dock，Teleport 始终有合法 to，避免 disabled/0×0 容器导致双份 DOM 或 xterm 布局错乱 -->
    <div class="terminal-staging-docks" aria-hidden="true">
      <div
        v-for="panel in allPanels"
        :key="'stg-' + panel.terminalId"
        :id="stagingDockId(panel.terminalId)"
        class="terminal-staging-dock"
      />
    </div>
    <Teleport
      v-for="panel in allPanels"
      :key="`${panel.id}:${isPanelReadonlyHistory(panel) ? 'readonly' : 'live'}`"
      :to="teleportTargetFor(panel.terminalId)"
    >
      <ClaudeCodeTerminal
        :key="panel.terminalId"
        :ref="termRefFor(panel.terminalId)"
        :term-id="panel.terminalId"
        :cwd="getPanelTerminalCwd(panel)"
        :mode="resolvePanelLaunchMode(panel)"
        :cli-brand="runtimeLaunchData[panel.terminalId]?.cliBrand ?? terminalRestoreData[panel.terminalId]?.cliBrand ?? 'claude-code'"
        :theme="currentTheme"
        :font-size="fontSize"
        :active="panel.terminalId === activeTerminalId"
        :visible="isTerminalVisible(panel.terminalId)"
        :defer-bootstrap="shouldDeferPanelRestoreBootstrap(panel)"
        :readonly-history="isPanelReadonlyHistory(panel)"
        :restoreScrollback="getPanelRestoreScrollback(panel)"
        :restoredSession="Boolean(terminalRestoreData[panel.terminalId]?.restoredSession)"
        :restore-telemetry-run-id="getPanelRestoreTelemetryRunId(panel)"
        :resumeSessionId="isPanelReadonlyHistory(panel) ? '' : (runtimeLaunchData[panel.terminalId]?.resumeSessionId ?? terminalRestoreData[panel.terminalId]?.resumeSessionId ?? '')"
        :forkSession="runtimeLaunchData[panel.terminalId]?.forkSession ?? false"
        :team-mode="runtimeLaunchData[panel.terminalId]?.teamMode ?? null"
        v-show="isTerminalVisible(panel.terminalId)"
        @ready="flushPendingTerminalWrites(panel.terminalId)"
        @shell-ready="flushPendingShellReadyWrites(panel.terminalId)"
        @exit="handleTerminalExit(panel.terminalId, $event)"
        @title-change="(val) => onTerminalTitleChange(panel.terminalId, val)"
        @search-results="(e) => onSearchResults(panel.terminalId, e)"
        @font-size-change="handleFontSizeChange"
        @start-team="handleStartTeamFromTerminal(panel)"
      />
    </Teleport>

    <!-- 右键上下文菜单：独立窗口 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="detach-context-menu"
        :style="{
          left: contextMenu.x + 'px',
          top: contextMenu.y + 'px',
          '--menu-bg': currentTheme.menuBg || 'rgba(20, 25, 35, 0.95)',
          '--menu-border': currentTheme.menuBorder || 'rgba(255, 255, 255, 0.1)',
          '--menu-text': currentTheme.menuItemText || 'rgba(255, 255, 255, 0.85)',
          '--menu-hover-bg': currentTheme.menuItemHoverBg || 'rgba(255, 255, 255, 0.1)',
        }"
        @click.stop
      >
        <div
          v-for="action in contextMenuActions"
          :key="action.key"
          class="detach-menu-item"
          :class="{ disabled: action.disabled }"
          @click="onContextMenuAction(action.key)"
        >
          {{ action.label }}
        </div>
      </div>
      <div
        v-if="contextMenu.visible"
        class="detach-context-overlay"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      />
    </Teleport>

    <!-- 重命名标签页弹框 -->
    <Teleport to="body">
      <div v-if="showRenameTabDialog" class="tab-rename-dialog-overlay" @click="closeRenameTabDialog">
        <div class="tab-rename-dialog" @click.stop>
          <div class="tab-rename-dialog__header">
            <span class="tab-rename-dialog__title">重命名标签页</span>
            <button class="tab-rename-dialog__close" @click="closeRenameTabDialog">
              <SvgIcon name="icon-guanbi" :size="14" color="currentColor" />
            </button>
          </div>
          <div class="tab-rename-dialog__body">
            <input
              v-model="renameTabName"
              class="tab-rename-dialog__input"
              placeholder="输入标签页名称"
              maxlength="20"
              @keyup.enter="confirmRenameTab"
              @keyup.esc="closeRenameTabDialog"
            />
            <div class="tab-rename-dialog__counter">{{ renameTabName.length }}/20</div>
            <div v-if="renameTabError" class="tab-rename-dialog__error">{{ renameTabError }}</div>
          </div>
          <div class="tab-rename-dialog__footer">
            <button class="tab-rename-dialog__btn tab-rename-dialog__btn--cancel" @click="closeRenameTabDialog">
              取消
            </button>
            <button class="tab-rename-dialog__btn tab-rename-dialog__btn--confirm" @click="confirmRenameTab">
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 通用确认弹框 -->
    <Teleport to="body">
      <div v-if="showConfirmDialog" class="tab-confirm-dialog-overlay" @click="closeConfirmDialog(false)">
        <div
          class="tab-confirm-dialog"
          :class="{ 'tab-confirm-dialog--danger': confirmDialogDanger }"
          @click.stop
        >
          <div class="tab-confirm-dialog__header">
            <span class="tab-confirm-dialog__title">{{ confirmDialogTitle }}</span>
            <button class="tab-confirm-dialog__close" @click="closeConfirmDialog(false)">
              <SvgIcon name="icon-guanbi" :size="14" color="currentColor" />
            </button>
          </div>
          <div class="tab-confirm-dialog__body">
            <p class="tab-confirm-dialog__content">{{ confirmDialogContent }}</p>
          </div>
          <div class="tab-confirm-dialog__footer">
            <button
              v-if="confirmDialogShowCancel"
              class="tab-confirm-dialog__btn tab-confirm-dialog__btn--cancel"
              @click="closeConfirmDialog(false)"
            >
              {{ confirmDialogCancelText }}
            </button>
            <button class="tab-confirm-dialog__btn tab-confirm-dialog__btn--confirm" @click="closeConfirmDialog(true)">
              {{ confirmDialogOkText }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <FeatureIntroOverlay
      :visible="featureIntro.visible.value"
      :pages="featureIntro.pages"
      @close="featureIntro.dismiss"
    />
    <ShortcutPanel
      v-model:visible="shortcutPanelVisible"
      :is-mac="isMac"
      :theme-key="currentThemeKey"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import ClaudeCodeTerminal from './ClaudeCodeTerminal.vue'
import TerminalSearchBar from './TerminalSearchBar.vue'
import WorkbenchSidebar from './ProjectSidebar.vue'
import { useUserStore } from '@/modules/auth/store'
import { useClaudeCodeStore } from '@/modules/terminal/store'
import { fetchClaudeApiKey, postClaudeCodeClientLoginStatus } from '@/modules/terminal/claudeKeyService'
import { useUIStore } from '@/modules/space/uiStore'
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { useTabStore } from '@/modules/terminal/stores/tab'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import {
  loadRecoveredState, saveSnapshot, debouncedSaveSnapshot, lifecycleSave,
  startPeriodicSave, stopPeriodicSave,
} from '@/modules/terminal/services/sessionService'
// useSplitLayout 现在由 tabStore 内部创建，不再在此直接使用
import SplitLayout from './split-layout/SplitLayout.vue'
import ShortcutBar from './shortcut-bar/shortcut-bar/ShortcutBar.vue'
import ShortcutPanel from './ShortcutPanel.vue'
import EditorPanel from '@/shared/components/EditorPanel.vue'
import { useTerminalShortcuts } from '@/composables/useTerminalShortcuts'
import { useFeatureIntro } from '@/composables/useFeatureIntro'
import { useOverflowDetect } from '@/composables/useOverflowDetect'
import FeatureIntroOverlay from './FeatureIntroOverlay.vue'
import { buildForkLaunchData, canForkSessionPanel, getPanelLaunchMode } from '@/modules/terminal/utils/forkSession'
import { themes, themeKeys } from './terminalThemes'
import { parseClaudeStatusPayload } from '@/modules/terminal/utils/claudeStatus'
import { PROJECT_PATH_STATUS, resolveProjectTerminalCwd } from '@/modules/terminal/utils/projectPathStatus'
import { createWorkbenchWithInitialTab, isProjectInteractive } from '@/modules/terminal/utils/projectSessionLifecycle.js'
import { getTabDisplayTitle, normalizeManualTabTitle } from '@/modules/terminal/utils/tabTitle.mjs'
import { getPaneContextActions } from '@/modules/terminal/utils/terminalContextMenu.mjs'
import {
  cloneTeamModePayload,
  resolveRecoveredTeamSurfaceId,
  shouldIgnoreTeamSendText,
} from '@/modules/terminal/utils/teamModePayload.mjs'
import { buildTeamTeammateBootstrapCommand } from '@/modules/terminal/utils/teamRuntimeBootstrap.mjs'
import { buildRestoredTeamLaunchPlan } from '@/modules/terminal/utils/teamRuntimeBootstrap.mjs'
import { getPaneHeaderTeamPresentation as buildPaneHeaderTeamPresentation } from '@/modules/terminal/utils/teamPanePresentation.mjs'
import { buildNotificationTeamMeta } from '@/modules/terminal/utils/panelRuntimeState.mjs'
import { buildStopNotification, buildNotificationHookNotification, buildOscNotification } from '@/modules/terminal/utils/claudeNotificationContent.mjs'
import { extractClaudeHookIdentifiers } from '@/modules/terminal/utils/claudeHookPayload.js'
import { planClaudeSessionIdUpdatesFromMain } from '@/modules/terminal/utils/mergeClaudeSessionIdsFromMain.mjs'
import {
  normalizeRestoredPanelRuntime,
  buildRestoredTerminalBootstrapPlan,
  shouldRestoreTerminalScrollback,
  sanitizeRestoredScrollbackForPanel,
} from '@/modules/terminal/utils/terminalRestore.mjs'
import { DEFAULT_RESTORE_POLICY } from '@/modules/terminal/utils/terminalRestorePolicy.mjs'
import { pickDetachedPanelReturnTarget } from '@/modules/terminal/utils/detachedPanelReturn.js'
import { observeTerminalBootstraps } from '@/modules/terminal/utils/terminalBootstrapQueue.mjs'
import { startTerminalRestoreTelemetryRun } from '@/modules/terminal/utils/terminalRestoreTelemetry.mjs'

defineOptions({ name: 'ClaudeCodeView' })
/** 仅隐藏分屏面板标题栏右键（Fork/导出/独立窗口等）；标签页右键重命名不受影响 */
const ENABLE_PANE_HEADER_CONTEXT_MENU = false

const emit = defineEmits(['close'])
const uiStore = useUIStore()
const projectStore = useProjectStore()
const workbenchStore = useWorkbenchStore()
const panelStore = usePanelStore()
const tabStore = useTabStore()
const notificationStore = useNotificationStore()
const featureIntro = useFeatureIntro()
const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
const terminalRestoreStrategy = DEFAULT_RESTORE_POLICY.terminalRestoreStrategy

// v-show 模式下，再次打开时重新上报登录状态
watch(() => uiStore.claudeCodeVisible, (visible) => {
  if (visible) {
    postClaudeCodeClientLoginStatus('in').catch(() => {})
  }
})

const claudeCodeStore = useClaudeCodeStore()

async function syncPanelGitStatus(termId, cwd) {
  if (!termId || !cwd) return
  const sessionApi = window.electronAPI?.session
  if (!sessionApi?.inspectGit) return
  try {
    const result = await sessionApi.inspectGit(cwd)
    if (!result?.success || !result.data) return
    panelStore.updateShellState(termId, {
      cwd,
      ...result.data,
    })
  } catch {
    // ignore
  }
}

async function syncPanelClaudeStats(termId, parsed) {
  if (!termId || !parsed?.transcriptPath || !parsed?.sessionId) return
  const sessionApi = window.electronAPI?.session
  if (!sessionApi?.inspectClaudeStats) return
  try {
    const [statsResult, configResult] = await Promise.all([
      sessionApi.inspectClaudeStats(parsed.transcriptPath, parsed.sessionId),
      sessionApi.inspectClaudeConfigCounts?.(parsed.cwd) ?? Promise.resolve(null),
    ])
    const merged = {}
    if (statsResult?.success && statsResult.data) Object.assign(merged, statsResult.data)
    if (configResult?.success && configResult.data) Object.assign(merged, configResult.data)
    if (Object.keys(merged).length > 0) {
      panelStore.updateAiStatus(termId, merged)
    }
  } catch {
    // ignore
  }
}

async function openHookTranscript() {
  const r = await claudeCodeStore.openLastTranscriptFile()
  if (!r.ok && r.error) ElMessage.warning(r.error)
}

async function revealHookTranscript() {
  const r = await claudeCodeStore.revealLastTranscriptInFolder()
  if (!r.ok && r.error) ElMessage.warning(r.error)
}

// ========================
// 主题预设（已从 terminalThemes.js 导入）
// ========================
const currentThemeKey = ref('dark')
const currentTheme = computed(() => themes[currentThemeKey.value])

const iconColor = computed(() => currentThemeKey.value === 'light' ? '#606572' : '#7B7B7B')
const activeIconColor = computed(() => currentThemeKey.value === 'light' ? '#30343B' : '#F2F2F2')
const isFilePanelActive = computed(
  () => uiStore.activeToolTab === 'file' && !uiStore.fileTreeCollapsed
)
const fileIconColor = computed(() => isFilePanelActive.value ? activeIconColor.value : iconColor.value)

const tooltipEffect = computed(() => currentThemeKey.value === 'light' ? 'light' : 'dark')

/** Win：避免贴近视口右侧的工具栏 tooltip 触发滚动条/重排抖动 */
const terminalToolbarTooltipPopperOptions = Object.freeze({
  modifiers: [{ name: 'preventOverflow', options: { padding: 10 } }],
})

const toolbarStyle = computed(() => ({
  background: currentTheme.value.toolbarBg,
  borderColor: currentTheme.value.toolbarBorder,
  '--btn-text': currentTheme.value.btnText,
  '--btn-hover-text': currentTheme.value.btnHoverText,
  '--btn-hover-bg': currentTheme.value.btnHoverBg,
  '--pane-title': currentTheme.value.paneTitle || 'rgba(255, 255, 255, 0.5)',
  '--kbd-bg': currentThemeKey.value === 'light' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.06)',
  '--kbd-border': currentThemeKey.value === 'light' ? 'rgba(19, 21, 29, 0.1)' : 'rgba(255, 255, 255, 0.1)',
}))

const tabBarStyle = computed(() => ({
  background: currentTheme.value.tabBg,
  '--tab-bg': currentTheme.value.tabBg,
  '--tab-hover-bg': currentTheme.value.tabHoverBg,
  '--tab-active-bg': currentTheme.value.tabActiveBg,
  '--tab-text': currentTheme.value.tabText,
  '--tab-hover-text': currentTheme.value.tabHoverText,
  '--tab-active-text': currentTheme.value.tabActiveText,
  '--tab-border': currentTheme.value.tabBorder,
  '--tab-close-text': currentTheme.value.tabCloseBtnText,
  '--tab-close-hover-bg': currentThemeKey.value === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
  '--tab-close-hover-text': currentThemeKey.value === 'light' ? '#333' : '#fff',
  '--tab-add-bg': currentThemeKey.value === 'light' ? '#EFF0F4' : 'rgba(255, 255, 255, 0.04)',
  '--tab-add-hover-bg': currentThemeKey.value === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
  '--btn-text': currentTheme.value.btnText,
  '--btn-hover-text': currentTheme.value.btnHoverText,
  '--btn-hover-bg': currentTheme.value.btnHoverBg,
  '--divider-color': currentThemeKey.value === 'light' ? '#D8D8D8' : '#333333',
}))

function cycleTheme() {
  const idx = themeKeys.indexOf(currentThemeKey.value)
  currentThemeKey.value = themeKeys[(idx + 1) % themeKeys.length]
  focusActiveTerminal()
}

// 同步 body 的 light-theme class，确保 Teleport 到 body 的弹框也能匹配浅色主题样式
watch(currentThemeKey, (key) => {
  document.body.classList.toggle('light-theme', key === 'light')
}, { immediate: true })

function toggleShortcutPanel() {
  shortcutPanelVisible.value = !shortcutPanelVisible.value
}

// ========================
// 四层模型：Project → Workbench → Tab → Panel
// ========================

function orderedWorkbenchesForProject(projectId) {
  const project = projectId ? projectStore.getProject(projectId) : null
  if (!project) return []

  return project.workbenchIds
    .map(id => workbenchStore.getWorkbench(id))
    .filter(Boolean)
}

const currentWorkbenches = computed(() => {
  const proj = projectStore.activeProject
  if (!proj) return []
  return orderedWorkbenchesForProject(proj.id)
})

function isLastTabInLastWorkbench(tab) {
  if (!tab?.workbenchId) return false
  const workbench = workbenchStore.getWorkbench(tab.workbenchId)
  return Boolean(workbench && workbench.tabIds.length <= 1 && currentWorkbenches.value.length <= 1)
}

async function showLastWorkbenchTabDeleteHint(workbenchName = '当前事项') {
  await openConfirmDialog({
    title: '提示',
    content: '当前已是最后一个事项下的最后一个标签，这里点击关闭不会删除该事项。\n\n如需删除该工作区，请在左侧事项面板的下拉菜单中执行删除。',
    okText: '我知道了',
    showCancel: false,
  })
}

const DEFAULT_PROJECT_NAME = 'kc_workspace'
const PROJECT_PATH_RECHECK_INTERVAL_MS = 30000
const defaultProjectContext = ref({
  name: DEFAULT_PROJECT_NAME,
  path: '',
})
const allowDefaultProjectBootstrap = ref(false)

const activeWorkbench = computed(() => workbenchStore.activeWorkbench)

// 当前 workbench 下的 tabs 列表
const currentTabs = computed(() => {
  const ws = activeWorkbench.value
  if (!ws) return []
  return ws.tabIds.map(id => tabStore.getTab(id)).filter(Boolean)
})

// 当前活跃 tab
const activeTab = computed(() => {
  const ws = activeWorkbench.value
  if (!ws?.activeTabId) return null
  return tabStore.getTab(ws.activeTabId)
})

// splitLayout manager 现在绑定到 activeTab
const activeManager = computed(() => {
  const tab = activeTab.value
  return tab ? tabStore.getManager(tab.id) : null
})

const activeLayoutRoot = computed(() => activeManager.value?.layoutRoot.value ?? null)

const activeLeafId = computed(() => activeManager.value?.activeLeafId.value ?? null)

const allPanels = computed(() => panelStore.panelList.filter(p => p.type === 'terminal' && !p.detached))

const activeTabIsSinglePane = computed(() => {
  const tab = activeTab.value
  if (!tab) return true
  const panels = panelStore.panelsByTab(tab.id)
  return panels.filter(p => !p.detached).length <= 1
})

// Panel list for current active tab (for split layout rendering)
const currentPanels = computed(() => {
  const tab = activeTab.value
  if (!tab) return []
  return panelStore.panelsByTab(tab.id).filter(p => !p.detached)
})

// Check if a tab is the active one in current workbench
function isActiveTab(tabId) {
  return activeWorkbench.value?.activeTabId === tabId
}

// Click tab → switch to that tab
function switchTab(tabId) {
  const ws = activeWorkbench.value
  if (ws) workbenchStore.switchTab(ws.id, tabId)
}

function handleSetActiveLeaf(leafId) {
  activeManager.value?.setActiveLeafId(leafId)

  const panel = getPanelForLeaf(leafId)
  if (panel?.id) {
    notificationStore.dismissPanelIndicator(panel.id)
  }
  recordLeafActivation(activeTab.value?.id ?? null, leafId)
}

// Check if a panel is the currently focused one (within active tab)
function isActivePanel(panelId) {
  if (!activeManager.value || !activeLeafId.value) return false
  const r = activeManager.value.findNode(activeManager.value.layoutRoot.value, activeLeafId.value)
  return r?.node?.panelId === panelId
}

// Click panel tab → focus that panel's leaf in the split layout
function focusPanel(panelId) {
  const mgr = activeManager.value
  if (!mgr) return
  const leaf = findLeafByPanelId(mgr.layoutRoot.value, panelId)
  if (leaf) {
    mgr.setActiveLeafId(leaf.id)
    notificationStore.dismissPanelIndicator(panelId)
    recordLeafActivation(activeTab.value?.id ?? null, leaf.id)
  }
}

function findLeafByPanelId(node, panelId) {
  if (!node) return null
  if (node.type === 'leaf' && node.panelId === panelId) return node
  if (node.type === 'split') {
    for (const child of node.children) {
      const r = findLeafByPanelId(child, panelId)
      if (r) return r
    }
  }
  return null
}

// Remove panel by panelId (for panel tab close button)
function removePanelByPanelId(panelId) {
  const mgr = activeManager.value
  if (!mgr) return
  const leaf = findLeafByPanelId(mgr.layoutRoot.value, panelId)
  if (leaf) removePanel(leaf.id)
}

const globalDragState = ref(null)  // { leafId, tabId }
const dragOverTabId = ref(null)
const dragHasMoved = ref(false)
const dragWasHandled = ref(false)
let lastDragScreenX = 0
let lastDragScreenY = 0
let lastDragClientX = 0
let lastDragClientY = 0
let dragGhostEl = null
let dragIsOutside = false
let cachedWindowBounds = null

const termRefs = ref({})
/** 各分屏格子上的宿主元素（Teleport 目标），布局重建时只换 target，不销毁终端组件 */
const terminalHostEls = reactive({})
const fontSize = ref(11)
const cwd = ref('')
const envStatus = ref('loading') // 'loading' | 'ready' | 'failed'
// 快捷键面板
const shortcutPanelVisible = ref(false)
// 搜索相关状态
const searchVisible = ref(false)
const searchCurrentIndex = ref(0)
const searchResultCount = ref(0)
const searchBarRef = ref(null)
let searchOptions = {
  caseSensitive: false,
  useRegex: false,
  wholeWord: false,
}

// 终端恢复数据：{ [termId]: { scrollback, resumeSessionId } }
const terminalRestoreData = ref({})
const terminalRestoreBootstrapPlan = ref(createEmptyRestoreBootstrapPlan())
const runtimeLaunchData = ref({})
const pendingTerminalWrites = reactive({})
const pendingShellReadyWrites = reactive({})
let terminalRestoreTelemetryRun = null

// 编辑器面板
const editorPanelVisible = ref(false)
const editorPanelRef = ref(null)

const projectContextReady = ref(false)

function createEmptyRestoreBootstrapPlan() {
  return {
    threshold: 0,
    activeProjectId: null,
    activeWorkbenchId: null,
    totalRecoveredSessions: 0,
    autoBootstrapTotal: 0,
    lazyMetadataOnlyCount: 0,
    shouldLazyRestoreOffscreenWorkbenches: false,
    eagerTerminalIds: [],
    lazyTerminalIds: [],
    lazyWorkbenchIds: [],
  }
}

function clearTerminalResumeData(termId) {
  if (!termId) return
  const existingRestoreData = terminalRestoreData.value[termId]
  if (existingRestoreData) {
    terminalRestoreData.value[termId] = {
      ...existingRestoreData,
      resumeSessionId: '',
    }
  }

  const existingLaunchData = runtimeLaunchData.value[termId]
  if (existingLaunchData) {
    runtimeLaunchData.value[termId] = {
      ...existingLaunchData,
      resumeSessionId: '',
      forkSession: false,
    }
  }
}

// ========================
// Teams: surface ID ↔ panel/leaf/term mapping
// ========================
const surfaceMap = reactive({})
let _surfaceCounter = 0

function registerSurface(surfaceId, panelId, leafId, termId) {
  surfaceMap[surfaceId] = { panelId, leafId, termId }
  const surfaceMatch = typeof surfaceId === 'string' ? surfaceId.trim().match(/^%(\d+)$/) : null
  if (surfaceMatch) {
    _surfaceCounter = Math.max(_surfaceCounter, Number.parseInt(surfaceMatch[1], 10) + 1)
  }
}

function findEntryBySurfaceId(surfaceId) {
  return surfaceMap[surfaceId] || null
}

function nextSurfaceId() {
  return `%${_surfaceCounter++}`
}

// Find leaf ID by panel ID in the layout tree (returns ID string)
function _findLeafIdByPanelId(mgr, panelId) {
  const leaf = findLeafByPanelId(mgr.layoutRoot.value, panelId)
  return leaf ? leaf.id : panelId
}

// Recursively equalize all split sizes
function _equalizeSplitSizes(node) {
  if (!node || node.type !== 'split') return
  if (node.children && node.sizes) {
    const equalSize = 100 / node.children.length
    node.sizes = node.children.map(() => equalSize)
  }
  if (node.children) {
    node.children.forEach(child => _equalizeSplitSizes(child))
  }
}

function equalizeTabLayout(tabId) {
  const mgr = tabId ? tabStore.getManager(tabId) : null
  if (!mgr?.layoutRoot?.value) return
  _equalizeSplitSizes(mgr.layoutRoot.value)
  recordTabStructure(tabId)
}

async function handleNotificationNavigate({ notificationId, projectId, workbenchId, panelId }) {
  const switchResult = await switchProjectWithPathValidation(projectId)
  if (!switchResult || switchResult.stale) return
  const resolvedWorkbenchId = workbenchId || switchResult?.resolvedWorkbenchId || null
  let shouldWarnMissingPanel = false
  let navigationSucceeded = false
  if (resolvedWorkbenchId) {
    projectStore.setActiveWorkbench(projectId, resolvedWorkbenchId)
    workbenchStore.switchWorkbench(resolvedWorkbenchId)
    navigationSucceeded = true
  }

  if (panelId) {
    const panel = panelStore.getPanel(panelId)
    if (panel?.tabId && resolvedWorkbenchId && !panel.detached) {
      workbenchStore.switchTab(resolvedWorkbenchId, panel.tabId)
      await nextTick()
      focusPanel(panelId)
      navigationSucceeded = true
    } else {
      shouldWarnMissingPanel = true
      navigationSucceeded = false
    }
  }

  if (navigationSucceeded && notificationId) {
    notificationStore.removeOne(notificationId)
  }
  notificationStore.setNotificationCenterOpen(false)
  if (shouldWarnMissingPanel) {
    ElMessage.warning('原面板已不存在或不在当前窗口')
  }
}

async function syncPanelClaudeSessionIds() {
  const sessionApi = window.electronAPI?.session
  if (!sessionApi?.collectSessionIds) return

  try {
    const sessionResult = await sessionApi.collectSessionIds()
    const sessionMap = sessionResult?.data ?? {}

    const updates = planClaudeSessionIdUpdatesFromMain(panelStore.panelList, sessionMap)
    for (const { panelId, sessionId } of updates) {
      const panel = panelStore.getPanel(panelId)
      if (!panel?.terminalId) continue
      const updated = panelStore.updateClaudeSessionId(panelId, sessionId)
      if (updated === false) continue
      terminalRestoreData.value[panel.terminalId] = {
        ...(terminalRestoreData.value[panel.terminalId] || {}),
        resumeSessionId: sessionId,
      }
    }
  } catch (error) {
    console.warn('[ClaudeCodeView] 同步 Claude sessionId 失败:', error)
  }
}

const displayCwd = computed(() => {
  if (!cwd.value) return '~/（点击选择目录）'
  const parts = cwd.value.split('/')
  if (parts.length > 3) return '.../' + parts.slice(-2).join('/')
  return cwd.value
})

const activeTerminalId = computed(() => {
  const mgr = activeManager.value
  if (!mgr) return null
  const root = mgr.layoutRoot.value
  const leafId = mgr.activeLeafId.value
  if (!root || !leafId) return null
  const r = mgr.findNode(root, leafId)
  if (r?.node?.type !== 'leaf') return null
  const panel = panelStore.getPanel(r.node.panelId)
  return panel?.terminalId ?? null
})

const activePanelForStatusBar = computed(() => {
  const termId = activeTerminalId.value
  if (!termId) return null
  return panelStore.panelList.find(p => p.terminalId === termId) ?? null
})

const activeProjectPathInvalid = computed(() => {
  return projectStore.activeProject?.pathStatus === PROJECT_PATH_STATUS.INVALID
})

function getPanelTerminalCwd(panel) {
  const project = projectStore.getProject(panel?.projectId)
  return resolveProjectTerminalCwd(project, panel?.cwd)
}

function isPanelReadonlyHistory(panel) {
  if (!panel?.projectId) return false
  return projectStore.isProjectPathInvalid(panel.projectId)
}

function ensureProjectInteractive(projectId, message = '项目目录不可用，当前仅支持查看历史内容') {
  if (isProjectInteractive(projectStore, projectId)) return true
  ElMessage.warning(message)
  return false
}

async function ensureProjectClaudeTrust(targetPath) {
  const nextPath = typeof targetPath === 'string' ? targetPath.trim() : ''
  if (!nextPath) return null

  try {
    return await window.electronAPI?.project?.ensureClaudeTrust?.(nextPath)
  } catch (error) {
    console.warn('[ClaudeCodeView] ensure project trust failed:', error)
    return null
  }
}

async function switchProjectWithPathValidation(projectId, options = {}) {
  const project = projectStore.getProject(projectId)
  if (!project) return null

  const switchResult = await projectStore.switchProjectWithValidation(projectId)
  if (!switchResult || switchResult.stale) return switchResult

  const resolvedWorkbenchId = syncProjectWorkbench(projectId, {
    createIfMissing: switchResult.readonly ? false : options.createIfMissing,
  })

  return {
    project: switchResult.project ?? project,
    resolvedWorkbenchId,
    readonly: !!switchResult.readonly,
    stale: false,
  }
}

// 切换终端时自动重新搜索
watch(activeTerminalId, (newId, oldId) => {
  if (!searchVisible.value || !newId || newId === oldId) return
  nextTick(() => {
    if (oldId) {
      termRefs.value[oldId]?.clearSearch?.()
    }
    const query = searchBarRef.value?.searchQuery
    if (query) {
      const termRef = termRefs.value[newId]
      if (termRef?.search) {
        termRef.search(query, searchOptions)
      } else {
        searchResultCount.value = 0
        searchCurrentIndex.value = 0
      }
    } else {
      searchResultCount.value = 0
      searchCurrentIndex.value = 0
    }
  })
})

watch(
  activeTerminalId,
  (newId, oldId) => {
    if (!newId || newId === oldId) return
    const panel = panelStore.panelList.find(item => item.terminalId === newId)
    if (!panel) return
    const panelCwd = getPanelTerminalCwd(panel)
    if (!panelCwd) return
    void syncPanelGitStatus(newId, panelCwd)
  },
  { immediate: true },
)

const pendingTerminalFocusTimers = new Set()
let pendingTerminalFocusToken = 0

function clearPendingTerminalFocusTimers() {
  pendingTerminalFocusToken += 1
  pendingTerminalFocusTimers.forEach((timerId) => window.clearTimeout(timerId))
  pendingTerminalFocusTimers.clear()
}

function scheduleTerminalFocusRestore(termId = activeTerminalId.value, delays = [0, 24, 96, 180]) {
  const targetTermId = typeof termId === 'string' ? termId.trim() : ''
  if (!targetTermId || typeof window === 'undefined') return

  clearPendingTerminalFocusTimers()
  const token = pendingTerminalFocusToken

  const attemptFocus = () => {
    if (token !== pendingTerminalFocusToken) return
    if (searchVisible.value) return
    if (activeTerminalId.value !== targetTermId) return

    const panel = panelStore.panelList.find((item) => item.terminalId === targetTermId)
    if (!panel || panel.detached || panel.shellState === 'exited') return
    if (!isTerminalVisible(targetTermId)) return

    termRefs.value[targetTermId]?.focus?.()
  }

  nextTick(() => {
    window.requestAnimationFrame(() => {
      delays.forEach((delay) => {
        const timerId = window.setTimeout(() => {
          pendingTerminalFocusTimers.delete(timerId)
          attemptFocus()
        }, delay)
        pendingTerminalFocusTimers.add(timerId)
      })
    })
  })
}

// 统一自动聚焦：activeTerminalId 变化时，自动 focus 对应终端。
// 切 tab / 切 workbench / 切分屏时，Teleport 与 v-show 可能让首次聚焦过早失效，因此这里做短时重试。
watch(activeTerminalId, (newId) => {
  if (!newId) return
  scheduleTerminalFocusRestore(newId)
})

watch(
  [
    () => activeWorkbench.value?.id ?? '',
    () => activeWorkbench.value?.activeTabId ?? '',
  ],
  ([workbenchId, tabId], [prevWorkbenchId, prevTabId]) => {
    if (!workbenchId || !tabId) return
    if (workbenchId === prevWorkbenchId && tabId === prevTabId) return
    scheduleTerminalFocusRestore()
  },
  { flush: 'post' },
)

watch(
  () => projectStore.activeProjectId,
  (projectId) => {
    if (!projectContextReady.value || !projectId) return
    syncProjectWorkbench(projectId, {
      createIfMissing: !projectStore.isProjectPathInvalid(projectId),
    })
  }
)

function generateTermId() {
  return `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

let projectPathRecheckTimer = null

function startProjectPathRechecks() {
  stopProjectPathRechecks()
  if (typeof window === 'undefined') return

  projectPathRecheckTimer = window.setInterval(() => {
    if (!projectContextReady.value) return
    void projectStore.refreshProjectPathStates({
      maxAgeMs: PROJECT_PATH_RECHECK_INTERVAL_MS,
    })
  }, PROJECT_PATH_RECHECK_INTERVAL_MS)
}

function stopProjectPathRechecks() {
  if (projectPathRecheckTimer != null && typeof window !== 'undefined') {
    window.clearInterval(projectPathRecheckTimer)
  }
  projectPathRecheckTimer = null
}

function generateTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

/** 每个 termId 固定一个 ref 回调，避免每次父组件更新传入新函数导致 ref 反复解绑 */
const termRefCallbacks = new Map()

function setTermRef(termId, el) {
  if (el) termRefs.value[termId] = el
  else delete termRefs.value[termId]
}

function termRefFor(termId) {
  if (!termRefCallbacks.has(termId)) {
    termRefCallbacks.set(termId, (el) => setTermRef(termId, el))
  }
  return termRefCallbacks.get(termId)
}

const terminalHostCallbacks = new Map()

function setTerminalHostEl(termId, el) {
  if (el) terminalHostEls[termId] = el
  else delete terminalHostEls[termId]
}

function terminalHostRefFor(termId) {
  if (!terminalHostCallbacks.has(termId)) {
    terminalHostCallbacks.set(termId, (el) => setTerminalHostEl(termId, el))
  }
  return terminalHostCallbacks.get(termId)
}

function stagingDockId(termId) {
  return `claude-tp-staging-${termId}`
}

/** 有分屏宿主则迁过去，否则落在独立 staging */
function teleportTargetFor(termId) {
  return terminalHostEls[termId] ?? `#${stagingDockId(termId)}`
}

/** 判断某终端是否在当前活跃 tab 中可见（非 detached） */
function isTerminalVisible(termId) {
  const panel = panelStore.panelList.find(p => p.terminalId === termId)
  if (!panel || panel.detached) return false
  return panel.tabId === activeTab.value?.id
}

function shouldDeferPanelRestoreBootstrap(panel) {
  if (!panel?.terminalId) return false
  const plan = terminalRestoreBootstrapPlan.value
  if (!plan.shouldLazyRestoreOffscreenWorkbenches) return false
  return panel.workbenchId !== plan.activeWorkbenchId
}

function getPanelRestoreTelemetryRunId(panel) {
  if (!panel?.terminalId) return ''
  const runId = terminalRestoreTelemetryRun?.runId ?? ''
  if (!runId) return ''
  return terminalRestoreBootstrapPlan.value.eagerTerminalIds.includes(panel.terminalId)
    ? runId
    : ''
}

/**
 * 根据 leafId 从当前布局树获取对应的 terminalId
 * （SplitNode 传递 node.terminalId 但 refactored 后 leaf 只有 panelId，
 *  故这里提供一个桥接函数供模板使用）
 */
function getTerminalIdForLeaf(leafId) {
  const mgr = activeManager.value
  if (!mgr) return null
  const result = mgr.findNode(mgr.layoutRoot.value, leafId)
  if (!result || result.node.type !== 'leaf') return null
  const panel = panelStore.getPanel(result.node.panelId)
  return panel?.terminalId ?? null
}

/** 根据 panelId 获取 terminalId（用于模板中的 slot 桥接） */
function getTerminalIdForPanel(panelId) {
  const panel = panelStore.getPanel(panelId)
  return panel?.terminalId ?? null
}

function getPanelForLeaf(leafId, tabId = activeTab.value?.id) {
  if (!leafId || !tabId) return null
  const mgr = tabStore.getManager(tabId)
  if (!mgr) return null
  const result = mgr.findNode(mgr.layoutRoot.value, leafId)
  if (!result || result.node.type !== 'leaf') return null
  return panelStore.getPanel(result.node.panelId)
}

// ========================
// 四层操作：Project → Workbench → Tab → Panel
// ========================

async function hydrateDefaultProjectContext() {
  const payload = await window.electronAPI?.project?.getDefaultContext?.().catch(() => null)

  defaultProjectContext.value = {
    name: typeof payload?.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : DEFAULT_PROJECT_NAME,
    path: typeof payload?.path === 'string'
      ? payload.path.trim()
      : '',
  }

  return defaultProjectContext.value
}

function ensureActiveProject() {
  if (!projectStore.activeProject && projectStore.projects[0]?.id) {
    projectStore.switchProject(projectStore.projects[0].id)
  }

  if (!projectStore.activeProject) {
    if (!allowDefaultProjectBootstrap.value) {
      return null
    }

    allowDefaultProjectBootstrap.value = false
    const defaultProjectPath = defaultProjectContext.value.path || ''
    projectStore.addProject(
      defaultProjectContext.value.name || DEFAULT_PROJECT_NAME,
      defaultProjectPath,
    )
    void ensureProjectClaudeTrust(defaultProjectPath)
  }
  return projectStore.activeProject
}

function syncProjectWorkbench(projectId, options = {}) {
  const { createIfMissing = true } = options
  const project = projectId ? projectStore.getProject(projectId) : null
  if (!project) {
    workbenchStore.activeWorkbenchId = null
    return null
  }

  project.workbenchIds = project.workbenchIds.filter(id => !!workbenchStore.getWorkbench(id))

  let targetWorkbenchId = project.activeWorkbenchId
  if (!targetWorkbenchId || !project.workbenchIds.includes(targetWorkbenchId)) {
    targetWorkbenchId = project.workbenchIds[0] ?? null
  }

  if (!targetWorkbenchId && createIfMissing) {
    const existingDefaultWorkbench = workbenchStore.findWorkbenchByName?.(project.id, '默认')
    if (existingDefaultWorkbench?.id) {
      projectStore.addWorkbenchToProject(project.id, existingDefaultWorkbench.id)
      targetWorkbenchId = existingDefaultWorkbench.id
    } else {
      targetWorkbenchId = createWorkbench('默认', 'shell', project.id)
    }
  }

  if (!targetWorkbenchId) {
    workbenchStore.activeWorkbenchId = null
    return null
  }

  projectStore.setActiveWorkbench(project.id, targetWorkbenchId)
  workbenchStore.switchWorkbench(targetWorkbenchId)
  return targetWorkbenchId
}

/** 创建新 workbench，内含一个 tab（内含一个终端面板），并切换到该 workbench */
function createWorkbench(name, mode = 'shell', projectId = null) {
  const proj = projectId ? projectStore.getProject(projectId) : ensureActiveProject()
  if (!proj) return null
  if (!ensureProjectInteractive(proj.id)) return null

  // 没传 name → 自动生成不重名的默认名（`新事项 N`）
  // 传了 name → 校验是否重名，重名则报错返回
  let finalName
  if (!name) {
    finalName = workbenchStore.pickAvailableDefaultName(proj.id, '新事项')
  } else {
    if (workbenchStore.isNameTaken(proj.id, name)) {
      // ElMessage.warning(`工作台"${name}"已存在`)
      return null
    }
    finalName = name
  }

  const wsId = createWorkbenchWithInitialTab({
    projectStore,
    workbenchStore,
    tabStore,
    panelStore,
    projectId: proj.id,
    name: finalName,
    mode,
    fallbackCwd: cwd.value,
    generateTermId,
  })
  if (!wsId) return null

  projectStore.setActiveWorkbench(proj.id, wsId)
  if (projectStore.activeProjectId === proj.id) {
    workbenchStore.switchWorkbench(wsId)
  }
  return wsId
}

/** 在指定 workbench 内新建一个 Tab（内含一个终端面板） */
function addTabToWorkbench(wsId, mode = 'shell') {
  const ws = workbenchStore.getWorkbench(wsId)
  if (!ws) return null
  if (!ensureProjectInteractive(ws.projectId)) return null
  const proj = projectStore.getProject(ws.projectId)
  const panelCwd = resolveProjectTerminalCwd(proj, cwd.value)

  const tabId = tabStore.addTab(wsId, '')
  workbenchStore.addTabToWorkbench(wsId, tabId)

  const termId = generateTermId()
  const panelId = panelStore.createPanel('terminal', wsId, proj?.id, {
    terminalId: termId,
    tabId,
    mode,
    title: '',
    cwd: panelCwd,
  })

  const mgr = tabStore.getManager(tabId)
  mgr.init(panelId)
  recordTabStructure(tabId)

  return tabId
}

/** 在当前 workbench 新建 Tab 并切换过去（Tab 栏 + 按钮） */
function addTab(mode = 'shell') {
  const ws = activeWorkbench.value
  if (!ws) return
  const tabId = addTabToWorkbench(ws.id, mode)
  if (!tabId) return

  workbenchStore.switchTab(ws.id, tabId)

  // 聚焦新 tab 的终端
  const panels = panelStore.panelsByTab(tabId)
  const termId = panels[0]?.terminalId
  if (termId) {
    nextTick(() => {
      setTimeout(() => termRefs.value[termId]?.focus(), 100)
    })
  }
}

async function handleWorkbenchSwitch(wsId) {
  const workbench = workbenchStore.getWorkbench(wsId)
  if (!workbench) return

  if (projectStore.activeProjectId !== workbench.projectId) {
    const switchResult = await switchProjectWithPathValidation(workbench.projectId)
    if (!switchResult || switchResult.stale) return
  }
  projectStore.setActiveWorkbench(workbench.projectId, wsId)
  workbenchStore.switchWorkbench(wsId)
}

async function handleProjectCreate({ name, path }) {
  const nextPath = typeof path === 'string' ? path.trim() : ''
  if (!nextPath) return

  const existingProject = projectStore.findProjectByPath(nextPath)
  if (existingProject) {
    await projectStore.switchProjectWithValidation(existingProject.id)
    return
  }

  const derivedName = (typeof name === 'string' && name.trim())
    ? name.trim()
    : nextPath.replace(/\/+$/, '').split('/').pop() || 'project'

  const projectId = projectStore.addProject(derivedName, nextPath)
  await ensureProjectClaudeTrust(nextPath)
  createWorkbench('默认', 'shell', projectId)
  syncProjectWorkbench(projectId, { createIfMissing: false })
}

/**
 * tab item mousedown：
 * - 始终切换到该 tab
 * - 单面板 tab：tab item 作为拖拽入口（pane header 已隐藏）
 */
function onTabItemMouseDown(tab, event) {
  switchTab(tab.id)
  const panels = panelStore.panelsByTab(tab.id).filter(p => !p.detached)
  if (panels.length !== 1) return  // 多面板由 pane header 处理

  const mgr = tabStore.getManager(tab.id)
  if (!mgr) return
  const leafId = mgr.activeLeafId.value
  const title = panels[0]?.title || tab.name || 'Terminal'
  startTabDrag(tab, leafId, title)

  function onGlobalMouseUp() {
    onEndDrag()
    document.removeEventListener('mouseup', onGlobalMouseUp)
  }
  document.addEventListener('mouseup', onGlobalMouseUp)
}

/** 关闭一个 Tab（删除其所有 panel） */
async function closeTab(tabId, { skipConfirm = false } = {}) {
  const tab = tabStore.getTab(tabId)
  if (!tab) return
  const wsId = tab.workbenchId
  const ws = workbenchStore.getWorkbench(wsId)

  // 最后一个事项下的最后一个标签不允许在标签栏直接删除，改为引导用户到事项面板删除。
  if (!skipConfirm && isLastTabInLastWorkbench(tab)) {
    await showLastWorkbenchTabDeleteHint(ws?.name)
    return
  }

  // 关闭工作台最后一个 tab 会连带销毁整个工作台：走「关闭标签」的静态提示，
  // 文案不随终端数量变化（与「删除终端」的随最后一终端变化的提示刻意区分开）。
  // skipConfirm 供 pane 级关闭自带提示时跳过二次弹框，避免双重确认。
  if (!skipConfirm && ws && ws.tabIds.length === 1) {
    const confirmed = await openConfirmDialog({
      title: '关闭标签',
      content: `关闭此标签会丢失”${ws.name}”中的所有终端会话，但不会删除本地目录。 是否继续？`,
      okText: '确定',
      cancelText: '取消',
      danger: true,
    })
    if (!confirmed) return
    // 确认后检查状态仍有效，避免在等待期间 ws/tab 已被其它路径清理
    if (!tabStore.getTab(tabId) || !workbenchStore.getWorkbench(wsId)) return
  }

  // 先清理 layout 再删 panel，避免 SplitNode 渲染已删除 panel 引发 null 组件错误
  const mgr = tabStore.getManager(tabId)
  if (mgr) {
    mgr.layoutRoot.value = null
    mgr.activeLeafId.value = null
    recordTabStructure(tabId)
  }

  const panels = panelStore.panelsByTab(tabId)
  panels.forEach(p => {
    cleanupTerminalRefs(p.terminalId)
    panelStore.removePanel(p.id)
  })

  workbenchStore.removeTabFromWorkbench(wsId, tabId)
  tabStore.removeTab(tabId)

  // 如果 workbench 没有 tab 了，关闭 workbench
  const updatedWs = workbenchStore.getWorkbench(wsId)
  if (updatedWs && updatedWs.tabIds.length === 0) {
    deleteWorkbench(wsId)
  }
}

function destroyWorkbench(wsId) {
  const ws = workbenchStore.getWorkbench(wsId)
  if (!ws) return

  const wasActiveWorkbench = workbenchStore.activeWorkbenchId === wsId
    || projectStore.getProject(ws.projectId)?.activeWorkbenchId === wsId

  // 关闭所有 tab 及其 panel（先清 layout 再删 panel，避免渲染已删除 panel）
  const tabIds = [...ws.tabIds]
  tabIds.forEach(tabId => {
    const mgr = tabStore.getManager(tabId)
    if (mgr) {
      mgr.layoutRoot.value = null
      mgr.activeLeafId.value = null
    }
    const panels = panelStore.panelsByTab(tabId)
    panels.forEach(p => {
      cleanupTerminalRefs(p.terminalId)
      panelStore.removePanel(p.id)
    })
    tabStore.removeTab(tabId)
  })

  if (ws.projectId) {
    projectStore.removeWorkbenchFromProject(ws.projectId, wsId)
  }
  workbenchStore.removeWorkbench(wsId)

  if (
    ws.projectId &&
    orderedWorkbenchesForProject(ws.projectId).length === 0 &&
    !projectStore.isProjectPathInvalid(ws.projectId)
  ) {
    createWorkbench('默认', 'shell', ws.projectId)
  }

  const activeProject = ws.projectId ? projectStore.getProject(ws.projectId) : null
  const activeWorkbenchExists = activeProject?.activeWorkbenchId
    ? !!workbenchStore.getWorkbench(activeProject.activeWorkbenchId)
    : false

  if (
    projectStore.activeProjectId === ws.projectId &&
    (wasActiveWorkbench || !activeWorkbenchExists)
  ) {
    syncProjectWorkbench(ws.projectId)
  }
}

function deleteWorkbench(wsId) {
  destroyWorkbench(wsId)
}

function handleWorkbenchDelete(wsId) {
  deleteWorkbench(wsId)
}

function cleanupTerminalRefs(terminalId) {
  if (!terminalId) return
  delete termRefs.value[terminalId]
  delete runtimeLaunchData.value[terminalId]
  termRefCallbacks.delete(terminalId)
  terminalHostCallbacks.delete(terminalId)
  delete terminalHostEls[terminalId]
}

function appendMetadataEvent(event) {
  try {
    const append = typeof window !== 'undefined'
      ? window.electronAPI?.session?.appendMetadataEvent
      : null
    if (typeof append === 'function') {
      Promise.resolve(append(event)).catch((error) => {
        console.warn('[ClaudeCodeView] appendMetadataEvent failed:', error?.message || error)
      })
    }
  } catch (error) {
    console.warn('[ClaudeCodeView] appendMetadataEvent threw:', error?.message || error)
  }
}

function cloneSerializable(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function recordTabStructure(tabId) {
  const tab = tabId ? tabStore.getTab(tabId) : null
  const mgr = tabId ? tabStore.getManager(tabId) : null
  if (!tab || !mgr) return
  appendMetadataEvent({
    type: 'split-tree-updated',
    payload: {
      workbenchId: tab.workbenchId,
      tabId,
      tree: cloneSerializable(mgr.layoutRoot.value),
      activeLeafId: mgr.activeLeafId.value ?? null,
    },
  })
}

function recordLeafActivation(tabId, leafId) {
  if (!tabId || !leafId) return
  const tab = tabStore.getTab(tabId)
  if (!tab) return
  appendMetadataEvent({
    type: 'leaf-activated',
    payload: {
      workbenchId: tab.workbenchId,
      tabId,
      activeLeafId: leafId,
    },
  })
}

function recordWorkbenchTabOrder(workbenchId, tabIds) {
  if (!workbenchId) return
  appendMetadataEvent({
    type: 'workbench-tab-order-updated',
    payload: {
      workbenchId,
      tabIds: Array.isArray(tabIds) ? [...tabIds] : [],
    },
  })
}

function cleanupEmptyTabIfNeeded(tabId) {
  const tab = tabId ? tabStore.getTab(tabId) : null
  if (!tab) return

  const remainingPanels = panelStore.panelsByTab(tabId).filter(p => !p.detached)
  if (remainingPanels.length > 0) return

  workbenchStore.removeTabFromWorkbench(tab.workbenchId, tabId)
  tabStore.removeTab(tabId)
}

function attachPanelToTabLayout(panel, targetTabId, options = {}) {
  if (!panel || !targetTabId) return null

  const mgr = tabStore.getManager(targetTabId)
  if (!mgr) return null

  const existingLeaf = findLeafByPanelId(mgr.layoutRoot.value, panel.id)
  if (existingLeaf) return existingLeaf.id

  const currentRoot = mgr.layoutRoot.value
  const focus = options.focus !== false
  if (!currentRoot) {
    const leafId = mgr.init(panel.id)
    if (!focus) {
      const fallbackLeafId = mgr.activeLeafId.value
      if (fallbackLeafId) {
        mgr.activeLeafId.value = fallbackLeafId
      }
    }
    return leafId
  }

  const anchorPanelId = options.anchorPanelId ?? null
  const direction = options.direction ?? 'right'
  const anchorLeafId = anchorPanelId
    ? findLeafByPanelId(currentRoot, anchorPanelId)?.id ?? null
    : (mgr.activeLeafId.value || currentRoot.id || null)

  if (!anchorLeafId) {
    const leafId = mgr.init(panel.id)
    if (!focus) {
      const fallbackLeafId = mgr.activeLeafId.value
      if (fallbackLeafId) {
        mgr.activeLeafId.value = fallbackLeafId
      }
    }
    return leafId
  }

  return mgr.addLeaf(anchorLeafId, direction, panel.id, { focus })
}

function updateSurfaceLeafIdsByPanelId(panelId, leafId) {
  if (!panelId || !leafId) return

  for (const entry of Object.values(surfaceMap)) {
    if (entry?.panelId === panelId) {
      entry.leafId = leafId
    }
  }
}

function reconcileTeamPanelsToLeaderTabs() {
  const teamPanels = panelStore.panelList.filter(panel => panel.teamId && !panel.detached)
  if (teamPanels.length === 0) return

  const panelsByTeamId = new Map()
  for (const panel of teamPanels) {
    const teamId = panel.teamId
    if (!panelsByTeamId.has(teamId)) {
      panelsByTeamId.set(teamId, [])
    }
    panelsByTeamId.get(teamId).push(panel)
  }

  for (const [, panels] of panelsByTeamId.entries()) {
    const leaderPanel = panels.find(panel => panel.teamRole === 'leader') || null
    if (!leaderPanel?.tabId) continue

    const leaderTab = tabStore.getTab(leaderPanel.tabId)
    if (!leaderTab) continue

    const leaderLeafId = attachPanelToTabLayout(leaderPanel, leaderTab.id, { focus: false })
    if (leaderLeafId) {
      updateSurfaceLeafIdsByPanelId(leaderPanel.id, leaderLeafId)
    }

    let anchorPanelId = leaderPanel.id

    const teammatePanels = panels
      .filter(panel => panel?.id && panel.id !== leaderPanel.id)
      .sort((left, right) => {
        const leftIndex = Number.isInteger(left?.teamPaneIndex) ? left.teamPaneIndex : Number.MAX_SAFE_INTEGER
        const rightIndex = Number.isInteger(right?.teamPaneIndex) ? right.teamPaneIndex : Number.MAX_SAFE_INTEGER
        if (leftIndex !== rightIndex) return leftIndex - rightIndex

        const leftLabel = String(left?.teamLabel || '')
        const rightLabel = String(right?.teamLabel || '')
        const labelCompare = leftLabel.localeCompare(rightLabel)
        if (labelCompare !== 0) return labelCompare

        return String(left?.id || '').localeCompare(String(right?.id || ''))
      })

    for (const panel of teammatePanels) {
      const previousTabId = panel.tabId
      const previousMgr = previousTabId ? tabStore.getManager(previousTabId) : null
      const previousLeaf = previousMgr ? findLeafByPanelId(previousMgr.layoutRoot.value, panel.id) : null

      if (previousLeaf && previousTabId !== leaderTab.id) {
        previousMgr.removeLeaf(previousLeaf.id)
      }

      panelStore.movePanelToTab(panel.id, leaderTab.id, leaderPanel.workbenchId)

      const leafId = attachPanelToTabLayout(panel, leaderTab.id, {
        anchorPanelId,
        direction: 'right',
        focus: false,
      })

      if (leafId) {
        updateSurfaceLeafIdsByPanelId(panel.id, leafId)
        anchorPanelId = panel.id
      }

      if (previousTabId && previousTabId !== leaderTab.id) {
        cleanupEmptyTabIfNeeded(previousTabId)
      }
    }

    equalizeTabLayout(leaderTab.id)
  }
}

/** 关闭当前 tab 内的某个分屏格子（删除终端语义） */
async function removePanel(leafId, { skipConfirm = false } = {}) {
  const tab = activeTab.value
  const mgr = activeManager.value
  if (!tab || !mgr) return

  const result = mgr.findNode(mgr.layoutRoot.value, leafId)
  if (!result) return
  const { panelId } = result.node

  // 如果是 tab 里最后一个面板，关闭整个 tab：
  // 1. 最后一个事项下的最后一个标签只弹引导提示，不允许在这里删除；
  // 2. 其余「工作台最后一个终端」场景保留单次强提示；
  // 3. 其它场景维持静默。
  // 交给 closeTab 时通过 skipConfirm 跳过「关闭标签」静态提示，避免双重确认。
  if (mgr.layoutRoot.value?.id === leafId) {
    if (!skipConfirm) {
      if (isLastTabInLastWorkbench(tab)) {
        const ws = workbenchStore.getWorkbench(tab.workbenchId)
        await showLastWorkbenchTabDeleteHint(ws?.name)
        return
      }

      const ws = workbenchStore.getWorkbench(tab.workbenchId)
      const isLastTerminalInWorkbench = !!(
        ws &&
        ws.tabIds.length === 1 &&
        panelStore.panelsByWorkbench(tab.workbenchId).length <= 1
      )
      if (isLastTerminalInWorkbench) {
        const confirmed = await openConfirmDialog({
          title: '删除终端',
          content: `删除最后一个终端将连带销毁事项”${ws.name}”，所有终端会话会丢失（本地目录不受影响）。\n\n是否继续？`,
          okText: '确认删除',
          cancelText: '取消',
          danger: true,
        })
        if (!confirmed) return
        if (!tabStore.getTab(tab.id)) return
      }
      // 非最后一终端的 pane 关闭维持原无提示语义（仅本 pane 消失；若是 tab 最后一个 pane
      // 则顺手关闭该 tab，不弹额外提示 — 与历史行为对齐）
    }
    await closeTab(tab.id, { skipConfirm: true })
    return
  }

  mgr.removeLeaf(leafId)
  const panel = panelStore.getPanel(panelId)
  const shouldEqualizeTeamLayout = Boolean(panel?.teamId)
  if (panel) {
    cleanupTerminalRefs(panel.terminalId)
    panelStore.removePanel(panelId)
  }
  if (shouldEqualizeTeamLayout) {
    equalizeTabLayout(tab.id)
    return
  }
  recordTabStructure(tab.id)
}

/** 在当前 tab 内新增分屏面板 */
function addSplitPanelDetailed(direction, mode = 'shell', panelOptions = {}, anchorLeafId = null, targetTabId = null, layoutOptions = {}) {
  const resolvedTabId = typeof targetTabId === 'string' && targetTabId.trim()
    ? targetTabId.trim()
    : activeTab.value?.id
  const tab = resolvedTabId ? tabStore.getTab(resolvedTabId) : null
  if (!tab) return null
  const ws = workbenchStore.getWorkbench(tab.workbenchId)
  if (!ws) return null
  const mgr = tabStore.getManager(tab.id)
  if (!mgr) return null
  if (!ensureProjectInteractive(ws.projectId)) return null
  const project = projectStore.getProject(ws.projectId)
  const fallbackCwd = typeof panelOptions.cwd === 'string' && panelOptions.cwd.trim()
    ? panelOptions.cwd
    : cwd.value
  const panelCwd = resolveProjectTerminalCwd(project, fallbackCwd)
  const focus = layoutOptions.focus !== false

  const termId = generateTermId()
  const panelId = panelStore.createPanel('terminal', ws.id, ws.projectId, {
    terminalId: termId,
    tabId: tab.id,
    mode,
    title: '',
    ...panelOptions,
    cwd: panelCwd,
  })

  let leafId = null
  const currentRoot = mgr.layoutRoot.value
  if (!currentRoot) {
    leafId = mgr.init(panelId)
  } else {
    const preferredAnchorLeafId = (
      anchorLeafId &&
      mgr.findNode(currentRoot, anchorLeafId)
    )
      ? anchorLeafId
      : (mgr.activeLeafId.value || currentRoot.id || null)

    if (preferredAnchorLeafId) {
      leafId = mgr.addLeaf(preferredAnchorLeafId, direction, panelId, { focus })
    }

    if (!leafId) {
      const fallbackAnchorLeafId = mgr.activeLeafId.value || currentRoot.id || null
      if (fallbackAnchorLeafId && fallbackAnchorLeafId !== preferredAnchorLeafId) {
        leafId = mgr.addLeaf(fallbackAnchorLeafId, direction, panelId, { focus })
      }
    }
  }

  if (!leafId) {
    panelStore.removePanel(panelId)
    return null
  }

  recordTabStructure(tab.id)

  return {
    panelId,
    leafId,
    terminalId: termId,
    tabId: tab.id,
    workbenchId: ws.id,
  }
}

function addSplitPanel(direction, mode = 'shell', panelOptions = {}, anchorLeafId = null, targetTabId = null) {
  const result = addSplitPanelDetailed(direction, mode, panelOptions, anchorLeafId, targetTabId)
  return result?.panelId ?? null
}

// ========================
// 跨 Workbench 拖拽
// ========================

function onDragMouseMove(e) {
  dragHasMoved.value = true
  lastDragScreenX = e.screenX
  lastDragScreenY = e.screenY
  lastDragClientX = e.clientX
  lastDragClientY = e.clientY

  // 更新 ghost 位置
  if (dragGhostEl) {
    dragGhostEl.style.left = (e.clientX + 12) + 'px'
    dragGhostEl.style.top = (e.clientY + 12) + 'px'

    // 检测是否在窗口外（用缓存的 bounds，避免频繁 IPC）
    if (cachedWindowBounds) {
      const b = cachedWindowBounds
      const threshold = 20
      const outside = (
        e.screenX < b.x - threshold || e.screenX > b.x + b.width + threshold ||
        e.screenY < b.y - threshold || e.screenY > b.y + b.height + threshold
      )
      if (outside !== dragIsOutside) {
        dragIsOutside = outside
        dragGhostEl.classList.toggle('window-preview', outside)
      }
    }
  }
}

function onStartDrag(leafId) {
  const tab = activeTab.value
  globalDragState.value = { leafId, tabId: tab?.id }
  dragHasMoved.value = false
  dragWasHandled.value = false
  dragIsOutside = false
  activeManager.value?.startDrag(leafId)
  document.addEventListener('mousemove', onDragMouseMove)

  // 获取拖拽的终端标题并创建 ghost
  const mgr = activeManager.value
  if (mgr) {
    const result = mgr.findNode(mgr.layoutRoot.value, leafId)
    const panelId = result?.node?.panelId
    const panel = panelId ? panelStore.getPanel(panelId) : null
    const title = panel?.terminalId ? getTerminalTitle(panel.terminalId) : 'Terminal'
    createDragGhost(title)
  }

  // 缓存窗口 bounds
  window.electronAPI?.getWindowBounds?.().then(b => { cachedWindowBounds = b }).catch(() => {})
}

/** 从 tab item 发起拖拽时调用 */
function startTabDrag(tab, leafId, title) {
  const mgr = tabStore.getManager(tab.id)
  globalDragState.value = { leafId, tabId: tab.id }
  dragHasMoved.value = false
  dragWasHandled.value = false
  dragIsOutside = false
  mgr?.startDrag(leafId)
  document.addEventListener('mousemove', onDragMouseMove)
  createDragGhost(title)
  window.electronAPI?.getWindowBounds?.().then(b => { cachedWindowBounds = b }).catch(() => {})
}

function createDragGhost(title) {
  removeDragGhost()
  const el = document.createElement('div')
  el.className = 'drag-ghost'
  el.innerHTML = `<span class="drag-ghost-title">${title}</span>`
  document.body.appendChild(el)
  dragGhostEl = el
}

function removeDragGhost() {
  if (dragGhostEl) {
    dragGhostEl.remove()
    dragGhostEl = null
  }
  dragIsOutside = false
  cachedWindowBounds = null
}

/** 落在同 workbench 内另一个 pane 上 → 分屏，标记已处理 */
function onMoveLeaf(fromId, toId, pos) {
  activeManager.value?.moveLeaf(fromId, toId, pos)
  dragWasHandled.value = true
}

function onEndDrag() {
  document.removeEventListener('mousemove', onDragMouseMove)
  const wasOutside = dragIsOutside
  removeDragGhost()

  if (dragOverTabId.value && globalDragState.value) {
    const { leafId, tabId: fromTabId } = globalDragState.value
    if (dragOverTabId.value !== fromTabId) {
      movePanelToTab(fromTabId, leafId, dragOverTabId.value)
    }
  } else if (dragHasMoved.value && !dragWasHandled.value && globalDragState.value) {
    const { leafId, tabId: fromTabId } = globalDragState.value

    if (wasOutside) {
      // 拖出主窗口边界 → 独立窗口
      detachToNewWindow(fromTabId, leafId, lastDragScreenX, lastDragScreenY)
    } else {
      // 拖出到空白区域 → 独立成新 tab（仅当当前 tab 有多个面板时）
      const panels = panelStore.panelsByTab(fromTabId).filter(p => !p.detached)
      if (panels.length > 1) {
        detachToNewTab(fromTabId, leafId)
      }
    }
  }

  globalDragState.value = null
  dragOverTabId.value = null
  dragHasMoved.value = false
  dragWasHandled.value = false
  // 结束所有 tab manager 的拖拽状态
  for (const tab of currentTabs.value) {
    tabStore.getManager(tab.id)?.endDrag()
  }
}

function onTabBarMouseOver(tabId) {
  if (globalDragState.value && tabId !== globalDragState.value.tabId) {
    dragOverTabId.value = tabId
  }
}

function onTabBarMouseLeave(tabId) {
  if (dragOverTabId.value === tabId) dragOverTabId.value = null
}

/** 将 fromTab 中 leafId 对应的面板移动到 toTab */
function movePanelToTab(fromTabId, leafId, toTabId) {
  const fromMgr = tabStore.getManager(fromTabId)
  const toMgr = tabStore.getManager(toTabId)
  if (!fromMgr || !toMgr) return

  const fromResult = fromMgr.findNode(fromMgr.layoutRoot.value, leafId)
  if (!fromResult) return
  const { panelId } = fromResult.node

  fromMgr.removeLeaf(leafId)
  recordTabStructure(fromTabId)
  const panel = panelStore.getPanel(panelId)
  if (!panel) return

  // 更新面板归属到目标 tab
  const toTab = tabStore.getTab(toTabId)
  panelStore.movePanelToTab(panelId, toTabId, toTab?.workbenchId)

  // 如果源 tab 没有面板了，关闭它
  const remainingPanels = panelStore.panelsByTab(fromTabId).filter(p => !p.detached)
  if (remainingPanels.length === 0) {
    const fromTab = tabStore.getTab(fromTabId)
    if (fromTab) {
      workbenchStore.removeTabFromWorkbench(fromTab.workbenchId, fromTabId)
      tabStore.removeTab(fromTabId)
    }
  }

  toMgr.addLeaf(toMgr.activeLeafId.value, 'right', panelId)
  recordTabStructure(toTabId)
  recordLeafActivation(toTabId, toMgr.activeLeafId.value)
  const toTab2 = tabStore.getTab(toTabId)
  if (toTab2) {
    workbenchStore.switchTab(toTab2.workbenchId, toTabId)
  }
}

/** 将 fromTab 中 leafId 对应的面板拆出，独立成新 tab */
function detachToNewTab(fromTabId, leafId) {
  const fromMgr = tabStore.getManager(fromTabId)
  if (!fromMgr) return

  const fromResult = fromMgr.findNode(fromMgr.layoutRoot.value, leafId)
  if (!fromResult) return
  const { panelId } = fromResult.node

  fromMgr.removeLeaf(leafId)
  recordTabStructure(fromTabId)

  const ws = activeWorkbench.value
  if (!ws) return

  const newTabId = tabStore.addTab(ws.id, '')
  workbenchStore.addTabToWorkbench(ws.id, newTabId)

  // 更新面板归属
  panelStore.movePanelToTab(panelId, newTabId, ws.id)

  const newMgr = tabStore.getManager(newTabId)
  newMgr.init(panelId)
  recordTabStructure(newTabId)
  recordLeafActivation(newTabId, newMgr.activeLeafId.value)
  workbenchStore.switchTab(ws.id, newTabId)
}

// ========================
// 独立窗口（detach to window）
// ========================

/** 将终端拖拽为独立窗口 */
async function detachToNewWindow(fromTabId, leafId, screenX, screenY) {
  const fromMgr = tabStore.getManager(fromTabId)
  if (!fromMgr) return

  const fromResult = fromMgr.findNode(fromMgr.layoutRoot.value, leafId)
  if (!fromResult) return
  const { panelId } = fromResult.node

  const panel = panelStore.getPanel(panelId)
  if (!panel) return
  const terminalId = panel.terminalId

  // 获取序列化的 scrollback
  const termRef = termRefs.value[terminalId]
  const scrollback = termRef?.getSerializedContent?.() || ''

  // 标记 detaching，防止 cleanup 时销毁 PTY
  termRef?.markDetaching?.()

  // 请求主进程创建独立窗口
  const result = await window.electronAPI?.terminal.detachToWindow({
    termId: terminalId,
    x: screenX || undefined,
    y: screenY || undefined,
    width: 800,
    height: 600,
    scrollback,
    theme: currentTheme.value,
    fontSize: fontSize.value,
    title: panel.title || 'Terminal',
    mode: panel.mode || 'shell',
    teamId: panel.teamId || null,
    readonlyHistory: isPanelReadonlyHistory(panel),
    panelState: JSON.parse(JSON.stringify(panel)),
  })

  if (!result?.success) return

  // 从当前 tab 布局中移除
  fromMgr.removeLeaf(leafId)
  recordTabStructure(fromTabId)

  // 标记面板为 detached
  panelStore.detachPanel(panelId, result.windowId ?? null)

  // 清理 refs
  cleanupTerminalRefs(terminalId)
}

// ========================
// 右键菜单（独立窗口）
// ========================
const contextMenu = ref({ visible: false, x: 0, y: 0, tabId: null, leafId: null, source: null })
const contextMenuPanel = computed(() => getPanelForLeaf(contextMenu.value.leafId, contextMenu.value.tabId))

// 重命名标签页弹框
const showRenameTabDialog = ref(false)
const renameTabId = ref(null)
const renameTabName = ref('')
const renameTabError = ref('')

// 通用确认弹框
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogContent = ref('')
const confirmDialogOkText = ref('确认')
const confirmDialogCancelText = ref('取消')
const confirmDialogShowCancel = ref(true)
const confirmDialogDanger = ref(false)
let _confirmDialogResolve = null
const contextMenuForkState = computed(() => canForkSessionPanel(contextMenuPanel.value))
const contextMenuActions = computed(() => {
  const panel = contextMenuPanel.value
  return getPaneContextActions({
    source: contextMenu.value.source,
    panel: panel
      ? {
        ...panel,
        readonlyHistory: isPanelReadonlyHistory(panel),
        isActivePane: activeLeafId.value === contextMenu.value.leafId,
      }
      : null,
    canFork: contextMenuForkState.value.canFork,
  }).map(action => ({
    ...action,
    disabled: action.key === 'fork-session' ? !contextMenuForkState.value.canFork : false,
  }))
})

function onPaneHeaderContextMenu(event, leafId) {
  if (!ENABLE_PANE_HEADER_CONTEXT_MENU) return
  const tab = activeTab.value
  if (!tab) return
  const panel = getPanelForLeaf(leafId, tab.id)
  const actions = getPaneContextActions({
    source: 'pane',
    panel: panel
      ? {
        ...panel,
        readonlyHistory: isPanelReadonlyHistory(panel),
        isActivePane: activeLeafId.value === leafId,
      }
      : null,
    canFork: canForkSessionPanel(panel).canFork,
  })
  if (actions.length === 0) return
  void syncPanelClaudeSessionIds()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    tabId: tab.id,
    leafId,
    source: 'pane',
  }
}

function onTabContextMenu(event, tab) {
  if (!tab) return
  const panels = panelStore.panelsByTab(tab.id).filter(p => !p.detached)
  if (panels.length === 0) return
  const mgr = tabStore.getManager(tab.id)
  const leafId = mgr?.activeLeafId.value
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    tabId: tab.id,
    leafId,
    source: 'tab',
  }
}

function closeContextMenu() {
  contextMenu.value = { visible: false, x: 0, y: 0, tabId: null, leafId: null, source: null }
}

function onContextMenuAction(actionKey) {
  if (!actionKey) return
  if (actionKey === 'rename-tab') {
    onContextMenuRenameTab()
    return
  }
  if (actionKey === 'fork-session') {
    onContextMenuFork()
    return
  }
  if (actionKey === 'ko-teams') {
    onContextMenuKoTeams()
    return
  }
  if (actionKey === 'export-session') {
    onContextMenuExportSession()
    return
  }
  if (actionKey === 'detach-window') {
    onContextMenuDetach()
  }
}

function onContextMenuDetach() {
  const { tabId, leafId } = contextMenu.value
  closeContextMenu()
  if (tabId && leafId) {
    detachToNewWindow(tabId, leafId, null, null)
  }
}

async function onContextMenuExportSession() {
  const panel = contextMenuPanel.value
  closeContextMenu()
  if (!panel?.claudeSessionId || !panel?.cwd) {
    ElMessage.warning('当前会话无可导出的 session')
    return
  }
  const result = await window.electronAPI?.session?.exportSession?.(panel.claudeSessionId, panel.cwd)
  if (result?.success) {
    ElMessage.success(`会话已导出到 ${result.filePath}`)
  } else if (result?.cancelled) {
    // 用户取消，不提示
  } else {
    ElMessage.error(result?.error || '导出失败')
  }
}

function onContextMenuFork() {
  if (!contextMenuForkState.value.canFork) return
  const { leafId } = contextMenu.value
  closeContextMenu()
  if (leafId) {
    forkSessionFromLeaf(leafId)
  }
}

async function onContextMenuRenameTab() {
  const { tabId } = contextMenu.value
  const tab = tabId ? tabStore.getTab(tabId) : null
  closeContextMenu()
  if (!tab) return

  const currentTitle = getTabTitle(tab)
  renameTabId.value = tab.id
  renameTabName.value = tab.titlePinned ? (tab.name || currentTitle) : currentTitle
  renameTabError.value = ''
  showRenameTabDialog.value = true
}

function closeRenameTabDialog() {
  showRenameTabDialog.value = false
  renameTabId.value = null
  renameTabName.value = ''
  renameTabError.value = ''
}

function confirmRenameTab() {
  const trimmed = normalizeManualTabTitle(renameTabName.value)
  if (!trimmed) {
    renameTabError.value = '标签页名称不能为空'
    return
  }
  const tab = tabStore.getTab(renameTabId.value)
  if (!tab) { closeRenameTabDialog(); return }
  if (tabStore.isNameTaken(tab.workbenchId, trimmed, tab.id)) {
    renameTabError.value = `当前工作台下已存在名为"${trimmed}"的标签页`
    return
  }
  tabStore.renameTab(tab.id, trimmed, { titlePinned: true })
  debouncedSaveSnapshot()
  closeRenameTabDialog()
}

function openConfirmDialog({
  title,
  content,
  okText = '确认',
  cancelText = '取消',
  showCancel = true,
  danger = false,
}) {
  confirmDialogTitle.value = title
  confirmDialogContent.value = content
  confirmDialogOkText.value = okText
  confirmDialogCancelText.value = cancelText
  confirmDialogShowCancel.value = showCancel
  confirmDialogDanger.value = danger
  showConfirmDialog.value = true
  return new Promise((resolve) => { _confirmDialogResolve = resolve })
}

function closeConfirmDialog(result = false) {
  showConfirmDialog.value = false
  confirmDialogShowCancel.value = true
  confirmDialogDanger.value = false
  if (_confirmDialogResolve) {
    _confirmDialogResolve(result)
    _confirmDialogResolve = null
  }
}

function onContextMenuKoTeams() {
  const panel = contextMenuPanel.value
  closeContextMenu()
  handleStartTeamFromTerminal(panel)
}

/** 从终端区域右键菜单启动团队（复用 onContextMenuKoTeams 的核心逻辑） */
function handleStartTeamFromTerminal(panel) {
  if (!panel?.terminalId) return
  if (!ensureProjectInteractive(panel.projectId)) return

  const termId = panel.terminalId
  const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const workspaceId = panel.tabId ?? ''
  const leaderSurfaceId = nextSurfaceId()

  panel.teamId = teamId
  panel.teamRole = 'leader'
  panel.teamName = ''
  panel.teamStatus = 'running'
  panel.teamStatusIcon = '⚡'
  panel.teamStatusColor = '#58A6FF'
  panel.mode = 'claude-code'
  panel.claudeSessionId = null
  panel.shellState = 'idle'
  panel.lastExitCode = null

  const mgr = activeManager.value
  const leafId = mgr ? _findLeafIdByPanelId(mgr, panel.id) : panel.id
  const newTermId = generateTermId()

  panel.terminalId = newTermId
  panelStore.updateTeamRuntimeBinding(panel.id, {
    teamId,
    teamRole: 'leader',
    teamSurfaceId: leaderSurfaceId,
    teamWorkspaceId: workspaceId,
    teamPaneIndex: 0,
    runtimeManaged: true,
  })
  registerSurface(leaderSurfaceId, panel.id, leafId, newTermId)
  const teamMode = cloneTeamModePayload({
    enabled: true,
    teamId,
    role: 'leader',
    workspaceId,
    surfaceId: leaderSurfaceId,
    paneIndex: 0,
  })

  runtimeLaunchData.value[newTermId] = {
    ...(runtimeLaunchData.value[newTermId] || {}),
    teamMode,
  }

  window.electronAPI.terminal.create({
    termId: newTermId,
    cwd: resolveProjectTerminalCwd(projectStore.getProject(panel.projectId), panel.cwd),
    mode: 'claude-code',
    teamMode,
  })

  window.setTimeout(() => {
    window.electronAPI.terminal.destroy(termId)
  }, 50)
}

function focusPanelTerminal(panelId) {
  if (!panelId) return
  focusPanel(panelId)
  const panel = panelStore.getPanel(panelId)
  const terminalId = panel?.terminalId
  if (!terminalId) return
  nextTick(() => {
    setTimeout(() => termRefs.value[terminalId]?.focus(), 100)
  })
}

function forkSessionFromLeaf(leafId) {
  const sourcePanel = getPanelForLeaf(leafId)
  const launchData = buildForkLaunchData(sourcePanel)
  if (!sourcePanel || !launchData) {
    ElMessage.warning('当前会话暂时还不能 Fork，请先完成一轮对话')
    return
  }

  const panelId = addSplitPanel('right', 'claude-code', {
    cwd: launchData.cwd,
  }, leafId)
  if (!panelId) return

  const panel = panelStore.getPanel(panelId)
  if (!panel?.terminalId) return

  runtimeLaunchData.value[panel.terminalId] = {
    resumeSessionId: launchData.resumeSessionId,
    forkSession: true,
  }

  focusPanelTerminal(panelId)
}

// 监听独立窗口关闭通知（清理可能的 stale 引用）
let unsubDetachedClosed = null
let unsubClaudeHookEvent = null

// ========================
// 辅助
// ========================

const STATUS_COLORS = {
  running: '#3fb950',
  'ai-busy': '#58a6ff',
  error: '#f85149',
  exited: '#484f58',
}

/** 获取一个 tab 的"代表性面板"（用于显示状态圆点和图标） */
function getTabLeadPanel(tab) {
  if (!tab) return null
  const panels = panelStore.panelsByTab(tab.id).filter(p => !p.detached)
  // 优先返回活跃面板，否则第一个
  const mgr = tabStore.getManager(tab.id)
  if (mgr?.activeLeafId.value) {
    const result = mgr.findNode(mgr.layoutRoot.value, mgr.activeLeafId.value)
    if (result?.node?.panelId) {
      const p = panelStore.getPanel(result.node.panelId)
      if (p) return p
    }
  }
  return panels[0] || null
}

/** 获取 tab 的标题 */
function getTabTitle(tab) {
  const panel = getTabLeadPanel(tab)
  return getTabDisplayTitle(tab, panel)
}

// 页签状态圆点：仅在该 tab 下任一 panel 有未读通知时显示
const TAB_UNREAD_DOT_COLOR_LIGHT = 'rgb(0,0,0,0.3)'
const TAB_UNREAD_DOT_COLOR_DARK = 'rgb(255,255,255,0.3)'
function tabHasUnread(tab) {
  if (!tab) return false
  const panels = panelStore.panelsByTab(tab.id)
  return panels.some(p => notificationStore.panelHasNotification(p.id))
}
function tabDotColor(tab) {
  if (!tabHasUnread(tab)) return null
  return currentThemeKey.value === 'light' ? TAB_UNREAD_DOT_COLOR_LIGHT : TAB_UNREAD_DOT_COLOR_DARK
}

// Tab 栏溢出检测
const tabBarLeftRef = ref(null)
const tabItemRefs = ref({})
const { isOverflowing: isTabOverflowing } = useOverflowDetect(tabBarLeftRef, computed(() => currentTabs.value.length))
const tabOverflowVisible = ref(false)

// 仅返回被容器裁剪（不可见）的标签页
const hiddenTabs = ref([])

function refreshHiddenTabs() {
  const container = tabBarLeftRef.value
  if (!container || !isTabOverflowing.value) {
    hiddenTabs.value = []
    return
  }
  const containerRect = container.getBoundingClientRect()
  hiddenTabs.value = currentTabs.value.filter(tab => {
    const el = tabItemRefs.value[tab.id]
    if (!el) return true
    const rect = el.getBoundingClientRect()
    return rect.right > containerRect.right + 1 || rect.left < containerRect.left - 1
  })
}
const tabOverflowPanelStyle = computed(() => {
  const el = tabBarLeftRef.value
  if (!el) return { top: '48px', right: '80px' }
  const rect = el.getBoundingClientRect()
  return {
    top: (rect.bottom + 4) + 'px',
    right: (window.innerWidth - rect.right) + 'px',
  }
})

function setTabItemRef(tabId, element) {
  if (!tabId) return
  if (element) {
    tabItemRefs.value[tabId] = element
  } else {
    delete tabItemRefs.value[tabId]
  }
}

function scrollTabIntoView(tabId, options = {}) {
  if (!tabId) return
  const {
    behavior = 'smooth',
    inline = 'nearest',
  } = options

  requestAnimationFrame(() => {
    const el = tabItemRefs.value[tabId]
    if (!el?.scrollIntoView) return
    el.scrollIntoView({
      behavior,
      inline,
      block: 'nearest',
    })
  })
}

function onTabOverflowClick(tab) {
  tabOverflowVisible.value = false
  switchTab(tab.id)
  nextTick(() => scrollTabIntoView(tab.id, { behavior: 'smooth', inline: 'center' }))
}

watch(
  [
    () => activeWorkbench.value?.id ?? '',
    () => activeWorkbench.value?.activeTabId ?? '',
    () => currentTabs.value.map(tab => tab.id).join('|'),
  ],
  ([, activeTabId]) => {
    if (!activeTabId) return
    nextTick(() => scrollTabIntoView(activeTabId))
  },
  { flush: 'post' }
)

function isClaudeStatusPanel(panel) {
  if (!panel) return false
  return !!(
    panel.mode === 'claude-code' ||
    panel.aiModel ||
    panel.aiContextPercent != null ||
    panel.aiCostUsd != null ||
    panel.claudeSessionId
  )
}

// Claude CLI 发的 OSC 标题是固定的 "✳ Claude Code"，没辨识度
// 优先级：aiSessionName（Claude 自动生成的对话摘要）→ 有意义的 OSC 标题 → shell + cwd fallback
const GENERIC_CLAUDE_TITLE_RE = /^[✳*]?\s*Claude(\s+Code)?\s*$/i
function normalizePanelTitle(panel) {
  if (!panel) return 'Terminal'

  // 1. Claude 自动总结的会话标题（customTitle / slug），最有辨识度
  const sessionName = (panel.aiSessionName || '').trim()
  if (sessionName) return sessionName

  // 2. 有意义的 OSC 标题（排除通用 "Claude Code"）
  const raw = (panel.title || '').trim()
  if (raw && !GENERIC_CLAUDE_TITLE_RE.test(raw)) return raw

  // 3. Fallback：基于 cwd 派生
  const cwd = panel.cwd || ''
  const lastDir = cwd.split(/[\\/]+/).filter(Boolean).pop() || ''
  const prefix = panel.claudeActive || panel.mode === 'claude-code' ? 'claude' : (panel.shell || 'shell')
  return lastDir ? `${prefix} ~/${lastDir}` : prefix
}

function getTerminalTitle(terminalId) {
  const panel = panelStore.panelList.find(p => p.terminalId === terminalId)
  return normalizePanelTitle(panel)
}

function getPaneHeaderTeamPresentation(panelId) {
  const panel = panelId ? panelStore.getPanel(panelId) : null
  if (!panel) return null
  const fallbackTitle = normalizePanelTitle(panel)
  return buildPaneHeaderTeamPresentation(panel, fallbackTitle)
}

function resolvePanelLaunchMode(panel) {
  if (!panel?.terminalId) return getPanelLaunchMode(panel)
  const launchData = runtimeLaunchData.value[panel.terminalId] || {}
  return launchData.launchMode || getPanelLaunchMode(panel)
}

function queuePendingTerminalWrite(termId, text) {
  if (typeof termId !== 'string' || !termId.trim()) return
  if (typeof text !== 'string' || !text) return
  if (!Array.isArray(pendingTerminalWrites[termId])) {
    pendingTerminalWrites[termId] = []
  }
  pendingTerminalWrites[termId].push(text)
}

function queuePendingShellReadyWrite(termId, text) {
  if (typeof termId !== 'string' || !termId.trim()) return
  if (typeof text !== 'string' || !text) return
  if (!Array.isArray(pendingShellReadyWrites[termId])) {
    pendingShellReadyWrites[termId] = []
  }
  pendingShellReadyWrites[termId].push(text)
}

async function seedRestoredTeammateInbox(panel) {
  const teammateName = typeof panel?.teamLabel === 'string' ? panel.teamLabel.trim() : ''
  const leadSessionId = typeof panel?.teamLeadSessionId === 'string' ? panel.teamLeadSessionId.trim() : ''
  if (!teammateName || !leadSessionId) {
    return
  }

  try {
    const result = await window.electronAPI?.teams?.seedRestoredTeammateInbox?.({
      leadSessionId,
      teammateName,
    })
    if (result?.ok !== true) {
      console.warn('[ClaudeCodeView] restored teammate inbox seed skipped', {
        panelId: panel?.id || null,
        teammateName,
        leadSessionId,
        reason: result?.reason || 'unknown',
      })
    }
  } catch (error) {
    console.warn('[ClaudeCodeView] restored teammate inbox seed failed', {
      panelId: panel?.id || null,
      teammateName,
      leadSessionId,
      error: error?.message || String(error),
    })
  }
}

async function flushPendingTerminalWrites(termId) {
  if (typeof termId !== 'string' || !termId.trim()) return

  try {
    await window.electronAPI?.terminal?.flushBuffer?.(termId)
  } catch (error) {
    console.warn('[ClaudeCodeView] flush terminal buffer failed:', error?.message || error)
  }

  const queuedWrites = pendingTerminalWrites[termId]
  if (!Array.isArray(queuedWrites) || queuedWrites.length === 0) return
  for (const payload of queuedWrites) {
    window.electronAPI?.terminal?.write?.(termId, payload)
  }
  delete pendingTerminalWrites[termId]
}

function flushPendingShellReadyWrites(termId) {
  if (typeof termId !== 'string' || !termId.trim()) return
  const queuedWrites = pendingShellReadyWrites[termId]
  if (!Array.isArray(queuedWrites) || queuedWrites.length === 0) return
  for (const payload of queuedWrites) {
    window.electronAPI?.terminal?.write?.(termId, payload)
  }
  delete pendingShellReadyWrites[termId]
}

function getPanelRestoreScrollback(panel) {
  if (!panel?.terminalId) return ''
  const launchData = runtimeLaunchData.value[panel.terminalId] || {}
  const restoreData = terminalRestoreData.value[panel.terminalId] || {}
  const shouldReplay = shouldRestoreTerminalScrollback({
    readonlyHistory: isPanelReadonlyHistory(panel),
    mode: resolvePanelLaunchMode(panel),
    resumeSessionId: launchData.resumeSessionId ?? restoreData.resumeSessionId ?? '',
    teamMode: launchData.teamMode ?? null,
    terminalRestoreStrategy,
  })

  if (!shouldReplay) return ''

  return sanitizeRestoredScrollbackForPanel({
    mode: panel.mode ?? 'shell',
    claudeSessionId: launchData.resumeSessionId ?? restoreData.resumeSessionId ?? panel.claudeSessionId ?? '',
    readonlyHistory: isPanelReadonlyHistory(panel),
    scrollback: restoreData.scrollback ?? '',
  })
}

function onTerminalTitleChange(termId, val) {
  const panel = panelStore.panelList.find(p => p.terminalId === termId)
  if (panel) {
    panelStore.updatePanelTitle(panel.id, val)
  }
}

async function handleTerminalExit(termId, exitCode) {
  const panel = Object.values(panelStore.panels).find(p => p.terminalId === termId)

  // 如果是 Claude Code 模式退出（包括 resume 模式），降级到 shell 模式并重新创建 shell PTY
  if ((panel?.mode === 'claude-code' || panel?.claudeSessionId) && panel?.claudeActive) {
    panelStore.demotePanelToShellMode(termId)
    clearTerminalResumeData(termId)
    if (exitCode != null) {
      panelStore.updateShellState(termId, {
        state: 'idle',
        exitCode,
      })
    }

    // 重新创建 shell PTY
    const api = window.electronAPI?.terminal
    if (api) {
      try {
        await api.create({
          termId,
          cols: panel.cols || 80,
          rows: panel.rows || 24,
          cwd: panel.cwd || undefined,
          mode: 'shell',
        })
      } catch (error) {
        console.error('[handleTerminalExit] Shell PTY 重新创建失败:', error)
      }
    }
  } else if (panel?.shellHostedClaude && panel.claudeActive) {
    // 保留原有的 shellHostedClaude 逻辑
    panelStore.demotePanelToShellMode(termId)
    clearTerminalResumeData(termId)
    if (exitCode != null) {
      panelStore.updateShellState(termId, {
        state: 'idle',
        exitCode,
      })
    }
  } else {
    // 普通 shell 退出才标记为 exited
    panelStore.markPanelExited(termId)
  }

  // Team-aware exit: update team status
  if (panel && panel.teamId) {
    if (exitCode !== 0) {
      panelStore.markTeamRuntimeFailed(termId, {
        cascadeToTeam: panel.teamRole === 'leader',
      })
    } else {
      panelStore.updateTeamStatus(termId, { teamStatus: 'idle', teamStatusIcon: '⏸', teamStatusColor: '#8E8E93' })
    }
  }
}

// ========================
// 快捷命令栏
// ========================

/** 发送命令到当前活跃终端 */
function handleShortcutSendCommand({ command, mode }) {
  const termId = activeTerminalId.value
  if (!termId) return
  if (!ensureProjectInteractive(activePanelForStatusBar.value?.projectId)) return
  const data = mode === 'execute' ? command + '\r' : command
  window.electronAPI?.terminal.write(termId, data)
  // 写入命令后聚焦终端，确保用户可直接按回车执行
  nextTick(() => termRefs.value[termId]?.focus())
}

/** 发送命令到所有终端视图（当前 tab 内） */
function handleShortcutSendCommandAll({ command, mode }) {
  const tab = activeTab.value
  if (!tab) return
  const panels = panelStore.panelsByTab(tab.id).filter(p => !p.detached)
  if (!ensureProjectInteractive(panels[0]?.projectId)) return
  const data = mode === 'execute' ? command + '\r' : command
  panels.forEach(p => {
    window.electronAPI?.terminal.write(p.terminalId, data)
  })
  // 写入命令后聚焦当前活跃终端
  const termId = activeTerminalId.value
  if (termId) nextTick(() => termRefs.value[termId]?.focus())
}

function splitHorizontal() {
  console.log('[splitHorizontal] 执行水平分屏 (下方)')
  const panelId = addSplitPanel('bottom', 'shell')
  if (panelId) {
    const panel = panelStore.getPanel(panelId)
    if (panel?.terminalId) {
      nextTick(() => {
        setTimeout(() => termRefs.value[panel.terminalId]?.focus(), 100)
      })
    }
  }
}

function splitVertical() {
  console.log('[splitVertical] 执行垂直分屏 (右侧)')
  const panelId = addSplitPanel('right', 'shell')
  if (panelId) {
    const panel = panelStore.getPanel(panelId)
    if (panel?.terminalId) {
      nextTick(() => {
        setTimeout(() => termRefs.value[panel.terminalId]?.focus(), 100)
      })
    }
  }
}

// ========================
// 快捷键：分屏切换
// ========================

/** 获取所有叶子节点（按树遍历顺序） */
function getAllLeaves(node) {
  if (!node) return []
  if (node.type === 'leaf') return [node]
  if (node.type === 'split') {
    return node.children.flatMap(child => getAllLeaves(child))
  }
  return []
}

/** 切换到下一个 pane */
function nextPane() {
  const mgr = activeManager.value
  if (!mgr) return
  const panels = panelStore.panelsByTab(activeTab.value?.id).filter(p => !p.detached)
  if (panels.length <= 1) return
  const leaves = getAllLeaves(mgr.layoutRoot.value)
  const idx = leaves.findIndex(l => l.id === mgr.activeLeafId.value)
  if (idx === -1) return
  const nextIdx = (idx + 1) % leaves.length
  const nextLeaf = leaves[nextIdx]
  mgr.setActiveLeafId(nextLeaf.id)
  recordLeafActivation(activeTab.value?.id ?? null, nextLeaf.id)

  // 聚焦到切换后的终端
  nextTick(() => {
    const panel = panelStore.getPanel(nextLeaf.panelId)
    const termRef = panel ? termRefs.value[panel.terminalId] : null
    termRef?.focus?.()
  })
}

/** 切换到上一个 pane */
function prevPane() {
  const mgr = activeManager.value
  if (!mgr) return
  const panels = panelStore.panelsByTab(activeTab.value?.id).filter(p => !p.detached)
  if (panels.length <= 1) return
  const leaves = getAllLeaves(mgr.layoutRoot.value)
  const idx = leaves.findIndex(l => l.id === mgr.activeLeafId.value)
  if (idx === -1) return
  const prevIdx = (idx - 1 + leaves.length) % leaves.length
  const prevLeaf = leaves[prevIdx]
  mgr.setActiveLeafId(prevLeaf.id)
  recordLeafActivation(activeTab.value?.id ?? null, prevLeaf.id)

  // 聚焦到切换后的终端
  nextTick(() => {
    const panel = panelStore.getPanel(prevLeaf.panelId)
    const termRef = panel ? termRefs.value[panel.terminalId] : null
    termRef?.focus?.()
  })
}

/** 按方向切换 pane */
function switchPaneByDirection(direction) {
  const mgr = activeManager.value
  if (!mgr) return
  const panels = panelStore.panelsByTab(activeTab.value?.id).filter(p => !p.detached)
  if (panels.length <= 1) return

  // 简化实现：上/左 = 上一个，下/右 = 下一个
  if (direction === 'up' || direction === 'left') {
    prevPane()
  } else if (direction === 'down' || direction === 'right') {
    nextPane()
  }
}

/** 关闭当前 pane（删除终端；若 tab 内只剩它则 removePanel 会顺带关闭 tab） */
async function closePane() {
  const tab = activeTab.value
  const mgr = activeManager.value
  if (!tab || !mgr) return
  // 统一交给 removePanel 处理：由它在"最后一终端"时弹"删除终端"强提示，
  // 其它情况保持静默（不再触发 tab 级「关闭标签」静态提示）
  const leafId = mgr.activeLeafId.value ?? mgr.layoutRoot.value?.id
  if (!leafId) return
  await removePanel(leafId)
}

// ========================
// 快捷键：标签页切换
// ========================

/** 切换到下一个标签页（tab） */
function nextTab() {
  const tabs = currentTabs.value
  if (tabs.length <= 1) return
  const idx = tabs.findIndex(t => t.id === activeTab.value?.id)
  if (idx === -1) return
  const nextIdx = (idx + 1) % tabs.length
  const ws = activeWorkbench.value
  if (ws) workbenchStore.switchTab(ws.id, tabs[nextIdx].id)
}

/** 切换到上一个标签页（tab） */
function prevTab() {
  const tabs = currentTabs.value
  if (tabs.length <= 1) return
  const idx = tabs.findIndex(t => t.id === activeTab.value?.id)
  if (idx === -1) return
  const prevIdx = (idx - 1 + tabs.length) % tabs.length
  const ws = activeWorkbench.value
  if (ws) workbenchStore.switchTab(ws.id, tabs[prevIdx].id)
}

/** 跳转到指定索引的标签页 */
function jumpToTab(index) {
  const tabs = currentTabs.value
  const ws = activeWorkbench.value
  if (ws && index >= 0 && index < tabs.length) {
    workbenchStore.switchTab(ws.id, tabs[index].id)
  }
}

/** 移动当前标签页位置（tab 排序通过 workbench.tabIds 控制） */
function moveTabPosition(direction) {
  const ws = activeWorkbench.value
  if (!ws || ws.tabIds.length <= 1) return
  const ids = ws.tabIds
  const idx = ids.indexOf(activeTab.value?.id)
  if (idx === -1) return

  let newIdx
  if (direction === 'left') {
    newIdx = idx - 1
    if (newIdx < 0) newIdx = ids.length - 1
  } else {
    newIdx = idx + 1
    if (newIdx >= ids.length) newIdx = 0
  }

  // 交换位置
  const tabId = ids[idx]
  ids.splice(idx, 1)
  ids.splice(newIdx, 0, tabId)
  recordWorkbenchTabOrder(ws.id, ids)
}

function increaseFontSize() {
  if (fontSize.value < 24) fontSize.value += 1
  focusActiveTerminal()
}

function decreaseFontSize() {
  if (fontSize.value > 10) fontSize.value -= 1
  focusActiveTerminal()
}

function resetFontSize() {
  fontSize.value = 11
  focusActiveTerminal()
}

function handleFontSizeChange(newSize) {
  fontSize.value = Math.max(10, Math.min(24, newSize))
  focusActiveTerminal()
}

function focusActiveTerminal() {
  nextTick(() => {
    const termId = activeTerminalId.value
    if (termId) termRefs.value[termId]?.focus()
  })
}

/** 后台注入 claude env，通过 envStatus 反映状态 */
async function setupClaudeEnv() {
  try {
    if (!window.electronAPI?.claudeCode?.setupEnv) {
      envStatus.value = 'failed'
      return
    }

    const userStore = useUserStore()
    if (!userStore.isLoggedIn || !userStore.userInfo) {
      const ready = await window.electronAPI?.claudeCode.isEnvReady()
      if (ready) {
        envStatus.value = 'ready'
        return
      }
      envStatus.value = 'failed'
      return
    }

    const keyInfo = await fetchClaudeApiKey(userStore.userInfo)
    await window.electronAPI.claudeCode.setupEnv(keyInfo.env, keyInfo.modelList)
    envStatus.value = 'ready'
  } catch (e) {
    console.error('[ClaudeCodeView] claude env 注入失败:', e)
    envStatus.value = 'failed'
  }
}

async function selectDirectory() {
  const dir = await window.electronAPI?.claudeCode.selectDirectory()
  if (dir) cwd.value = dir
}

async function notifyClientLogoutAndClose() {
  try {
    await postClaudeCodeClientLoginStatus('out')
  } catch (e) {
    console.error('[ClaudeCodeView] client-login-status 上报失败:', e)
  } finally {
    emit('close')
  }
}

function handleClose() {
  notifyClientLogoutAndClose()
}

/** 打开当前活跃终端的搜索框 */
function openSearch() {
  searchVisible.value = true
  nextTick(() => {
    searchBarRef.value?.focus()
  })
}

/** 关闭搜索框 */
function closeSearch() {
  searchVisible.value = false
  searchCurrentIndex.value = 0
  searchResultCount.value = 0
  // 清除所有终端的搜索高亮
  const tab = activeTab.value
  if (tab) {
    const panels = panelStore.panelsByTab(tab.id).filter(p => !p.detached)
    panels.forEach(p => {
      termRefs.value[p.terminalId]?.clearSearch?.()
    })
  }
  // 焦点回到当前活动终端
  scheduleTerminalFocusRestore()
}

/** 切换大小写敏感 */
function toggleCaseSensitive() {
  searchBarRef.value?.toggleCaseSensitive?.()
}

/** 切换正则表达式 */
function toggleRegex() {
  searchBarRef.value?.toggleRegex?.()
}

/** 处理搜索相关快捷键 */
function handleSearchKeydown(e) {
  if (!searchVisible.value) return

  const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
  const modKey = isMac ? e.metaKey : e.altKey

  // Esc 关闭搜索
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closeSearch()
    return
  }

  // Cmd/Alt+C 切换大小写
  if (modKey && e.key === 'c') {
    e.preventDefault()
    e.stopPropagation()
    toggleCaseSensitive()
    return
  }

  // Cmd/Alt+R 切换正则
  if (modKey && e.key === 'r') {
    e.preventDefault()
    e.stopPropagation()
    toggleRegex()
    return
  }
}

/** 执行搜索 */
function handleSearch({ query, caseSensitive, useRegex, wholeWord }) {
  searchOptions = { caseSensitive, useRegex, wholeWord }

  const termId = activeTerminalId.value
  if (!termId) return

  // 只在当前活动的终端中搜索
  // 真实的 count 和 index 通过 onSearchResults 回调更新
  const termRef = termRefs.value[termId]
  if (termRef?.search) {
    termRef.search(query, searchOptions)
  } else {
    searchResultCount.value = 0
    searchCurrentIndex.value = 0
  }
}

/** 搜索结果变化回调（来自 xterm SearchAddon） */
function onSearchResults(termId, { resultIndex, resultCount }) {
  // 只处理当前活动终端的搜索结果
  if (termId !== activeTerminalId.value) return
  searchResultCount.value = resultCount
  searchCurrentIndex.value = resultIndex >= 0 ? resultIndex : 0
}

/** 查找下一个 */
function findNext() {
  const termId = activeTerminalId.value
  if (!termId) return

  const termRef = termRefs.value[termId]
  if (termRef?.findNext) {
    termRef.findNext()
    // index 通过 onSearchResults 回调更新
  }
}

/** 查找上一个 */
function findPrevious() {
  const termId = activeTerminalId.value
  if (!termId) return

  const termRef = termRefs.value[termId]
  if (termRef?.findPrevious) {
    termRef.findPrevious()
    // index 通过 onSearchResults 回调更新
  }
}

/** 处理搜索选项变化 */
function handleSearchOptionsChange(options) {
  searchOptions = options
}

// Esc 键关闭（暂时隐藏，避免误触）
// function handleKeydown(e) {
//   if (e.key === 'Escape' && e.target.tagName !== 'INPUT') {
//     if (e.target.closest('.xterm')) return
//     notifyClientLogoutAndClose()
//   }
// }

// 注册快捷键
useTerminalShortcuts({
  isActive: () => uiStore.claudeCodeActive,
  splitVertical,
  splitHorizontal,
  nextPane,
  prevPane,
  switchPaneByDirection,
  closePane,
  newTab: () => addTab('shell'),
  nextTab,
  prevTab,
  jumpToTab,
  moveTabPosition,
  openSearch,
  cycleTheme,
  increaseFontSize,
  decreaseFontSize,
  resetFontSize,
  toggleShortcutPanel,
})

// 双击 Alt/Option 切换快捷键面板
let lastAltKeyDownTime = 0
const ALT_DOUBLE_CLICK_THRESHOLD = 300 // 毫秒

function handleAltKeyDown(e) {
  // 只在 KC 终端前台激活时处理。
  // claudeCodeVisible 在「切到我的分身/聊天」时仍可能为 true（组件保持挂载），
  // 这里必须使用 claudeCodeActive，避免后台页面也响应双击 Option。
  if (!uiStore.claudeCodeActive) {
    lastAltKeyDownTime = 0
    return
  }

  // 只监听单独的 Alt/Option 键按下（不与其他修饰键组合）
  // e.key 可能是 'Alt', 'AltLeft', 'AltRight'
  const isAltKey = e.key === 'Alt' || e.key === 'AltLeft' || e.key === 'AltRight'

  if (isAltKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const now = Date.now()
    if (now - lastAltKeyDownTime < ALT_DOUBLE_CLICK_THRESHOLD) {
      // 双击检测到
      e.preventDefault()
      e.stopPropagation()
      toggleShortcutPanel()
      lastAltKeyDownTime = 0 // 重置
    } else {
      lastAltKeyDownTime = now
    }
  }
}

// ========================
// 持久化
// ========================

function handleDetachedClosed(data) {
  console.log('[ClaudeCodeView] 独立终端窗口已关闭:', data?.termId)
  if (!data?.termId) return

  const panel = panelStore.panelList.find(p => p.terminalId === data.termId && p.detached)
  if (!panel) return

  const originalTabId = panel.tabId
  const originalWorkbenchId = panel.workbenchId
  const target = pickDetachedPanelReturnTarget({
    originalTabId,
    originalWorkbenchId,
    originalTabExists: Boolean(originalTabId && tabStore.getTab(originalTabId)),
    originalWorkbenchExists: Boolean(originalWorkbenchId && workbenchStore.getWorkbench(originalWorkbenchId)),
    activeTabId: activeTab.value?.id ?? '',
    activeWorkbenchId: activeWorkbench.value?.id ?? '',
    activeWorkbenchExists: Boolean(activeWorkbench.value?.id && workbenchStore.getWorkbench(activeWorkbench.value.id)),
  })

  if (!target?.workbenchId) return

  let targetTabId = target.tabId
  if (!targetTabId) {
    if (!workbenchStore.getWorkbench(target.workbenchId)) return
    const nextTabId = tabStore.addTab(target.workbenchId, '')
    workbenchStore.addTabToWorkbench(target.workbenchId, nextTabId)
    targetTabId = nextTabId
  }

  if (!targetTabId || !tabStore.getTab(targetTabId)) return

  if (panel.tabId !== targetTabId) {
    panel.tabId = targetTabId
  }
  if (panel.workbenchId !== target.workbenchId) {
    panel.workbenchId = target.workbenchId
  }

  const leafId = attachPanelToTabLayout(panel, targetTabId)
  if (!leafId) return

  panelStore.reattachPanel(panel.id, { runtimeManaged: true })
  updateSurfaceLeafIdsByPanelId(panel.id, leafId)
  recordTabStructure(targetTabId)

  const mgr = tabStore.getManager(targetTabId)
  const activeLeafId = mgr?.activeLeafId?.value ?? leafId
  if (activeLeafId) {
    recordLeafActivation(targetTabId, activeLeafId)
  }
}

onMounted(async () => {
  await postClaudeCodeClientLoginStatus('in').catch(e => {
    console.error('[ClaudeCodeView] 进入终端 client-login-status(in) 失败:', e)
  })

  await hydrateDefaultProjectContext()
  const snapshot = await loadRecoveredState()
  if (snapshot?.projects && snapshot?.panels && snapshot?.workbenches && snapshot?.tabs) {
    allowDefaultProjectBootstrap.value = false
    terminalRestoreBootstrapPlan.value = buildRestoredTerminalBootstrapPlan(snapshot)
    terminalRestoreTelemetryRun?.stop?.()
    terminalRestoreTelemetryRun = startTerminalRestoreTelemetryRun({
      appendMetadataEvent,
      observeTerminalBootstraps,
      plan: terminalRestoreBootstrapPlan.value,
    })
    if (snapshot?.diagnostics?.lastRestoreRuntime?.status === 'running') {
      console.warn('[ClaudeCodeView] 检测到上次恢复未完成:', snapshot.diagnostics.lastRestoreRuntime)
    }
    const snapshotPanels = Object.values(snapshot.panels).filter(p => p.terminalId && !p.detached)
    const recoveredTerminals = snapshot.terminals && typeof snapshot.terminals === 'object'
      ? snapshot.terminals
      : {}
    terminalRestoreData.value = Object.fromEntries(
      snapshotPanels.map((panel) => [
        panel.terminalId,
        {
          scrollback: recoveredTerminals[panel.terminalId]?.scrollback ?? '',
          restoredSession: true,
          resumeSessionId: recoveredTerminals[panel.terminalId]?.claudeSessionId ?? panel.claudeSessionId ?? '',
          degraded: recoveredTerminals[panel.terminalId]?.degraded === true,
          diagnostics: Array.isArray(recoveredTerminals[panel.terminalId]?.diagnostics)
            ? recoveredTerminals[panel.terminalId].diagnostics
            : [],
          cliBrand: recoveredTerminals[panel.terminalId]?.cliBrand ?? panel.cliBrand ?? 'claude-code',
        },
      ]),
    )

    const normalizedPanels = Object.fromEntries(
      Object.entries(snapshot.panels).map(([panelId, panel]) => {
        const project = snapshot.projects?.list?.find(item => item?.id === panel?.projectId) ?? null
        const readonlyHistory = project?.pathStatus === PROJECT_PATH_STATUS.INVALID

        return [
          panelId,
          normalizeRestoredPanelRuntime(panel, {
            readonlyHistory,
            terminalRestoreStrategy,
          }),
        ]
      }),
    )
    const restoredTeamLaunchData = {}
    for (const panel of Object.values(normalizedPanels)) {
      if (!panel?.teamId || !panel?.terminalId) continue
      const surfaceId = resolveRecoveredTeamSurfaceId({
        panel,
        nextSurfaceId,
      })
      const isRecoveredTeammate = panel.teamRole === 'teammate'
      const restoredLaunchPlan = buildRestoredTeamLaunchPlan({
        panel,
        restoreSessionId: recoveredTerminals[panel.terminalId]?.claudeSessionId ?? panel.claudeSessionId ?? '',
      })
      const project = snapshot.projects?.list?.find(item => item?.id === panel.projectId) ?? null
      restoredTeamLaunchData[panel.terminalId] = {
        ...(restoredTeamLaunchData[panel.terminalId] || {}),
        launchMode: restoredLaunchPlan.launchMode,
        resumeSessionId: restoredLaunchPlan.resumeSessionId,
        teamMode: cloneTeamModePayload({
          enabled: true,
          teamId: panel.teamId,
          role: panel.teamRole,
          workspaceId: panel.teamWorkspaceId ?? panel.tabId ?? '',
          surfaceId,
          paneIndex: panel.teamPaneIndex,
        }),
      }
      if (isRecoveredTeammate && restoredLaunchPlan.queueShellBootstrap) {
        queuePendingShellReadyWrite(
          panel.terminalId,
          buildTeamTeammateBootstrapCommand({
            cwd: panel.cwd || resolveProjectTerminalCwd(project, panel.cwd),
            teamName: panel.teamName || '',
            agentName: panel.teamLabel || '',
            agentId: panel.teamAgentId || '',
            agentType: panel.teamAgentType || '',
            agentColor: panel.teamColor || '',
            parentSessionId: panel.teamLeadSessionId || '',
            model: panel.teamModel || '',
            permissionMode: panel.aiPermissionMode || 'default',
            planModeRequired: panel.teamPlanModeRequired === true,
          }),
        )
        void seedRestoredTeammateInbox(panel)
      }
    }
    runtimeLaunchData.value = {
      ...runtimeLaunchData.value,
      ...restoredTeamLaunchData,
    }

    projectStore.loadProjects(snapshot.projects)
    panelStore.loadPanels(normalizedPanels)
    tabStore.loadTabs(snapshot.tabs)
    workbenchStore.loadWorkbenches(snapshot.workbenches)
    // Detached panels 归还
    for (const panel of panelStore.panelList) {
      if (panel.detached) {
        panelStore.reattachPanel(panel.id)
        const mgr = panel.tabId ? tabStore.getManager(panel.tabId) : null
        if (mgr && mgr.layoutRoot.value) {
          mgr.addLeaf(mgr.activeLeafId.value, 'right', panel.id)
        }
      }
    }
    reconcileTeamPanelsToLeaderTabs()
    // Rebuild surfaceMap for team panels restored from snapshot
    for (const panel of panelStore.panelList) {
      if (panel.teamId && panel.terminalId) {
        const restoredTeamMode = runtimeLaunchData.value[panel.terminalId]?.teamMode ?? null
        const surfaceId = restoredTeamMode?.surfaceId || resolveRecoveredTeamSurfaceId({
          panel,
          nextSurfaceId,
        })
        const paneIndex = Number.isInteger(panel.teamPaneIndex)
          ? panel.teamPaneIndex
          : (Number.parseInt(String(surfaceId).replace('%', ''), 10) || 0)
        const workspaceId = restoredTeamMode?.workspaceId ?? panel.teamWorkspaceId ?? panel.tabId ?? ''
        const mgr = panel.tabId ? tabStore.getManager(panel.tabId) : null
        const leafId = mgr ? _findLeafIdByPanelId(mgr, panel.id) : panel.id
        registerSurface(surfaceId, panel.id, leafId, panel.terminalId)
        panelStore.updateTeamRuntimeBinding(panel.id, {
          teamSurfaceId: surfaceId,
          teamWorkspaceId: workspaceId,
          teamPaneIndex: paneIndex,
          runtimeManaged: true,
        })
        runtimeLaunchData.value[panel.terminalId] = {
          ...(runtimeLaunchData.value[panel.terminalId] || {}),
          teamMode: restoredTeamMode ?? cloneTeamModePayload({
            enabled: true,
            teamId: panel.teamId,
            role: panel.teamRole,
            workspaceId,
            surfaceId,
            paneIndex,
          }),
        }
      }
    }

    syncProjectWorkbench(projectStore.activeProjectId)
  } else {
    terminalRestoreBootstrapPlan.value = createEmptyRestoreBootstrapPlan()
    terminalRestoreTelemetryRun?.stop?.()
    terminalRestoreTelemetryRun = null
    allowDefaultProjectBootstrap.value = true
    createWorkbench('默认', 'shell')
  }

  projectContextReady.value = true

  setupClaudeEnv()
  startPeriodicSave()
  startProjectPathRechecks()
  void projectStore.refreshProjectPathStates({
    force: true,
    onlyInvalid: true,
  })

  projectStore.$subscribe(() => debouncedSaveSnapshot())
  workbenchStore.$subscribe(() => debouncedSaveSnapshot())
  tabStore.$subscribe(() => debouncedSaveSnapshot())
  panelStore.$subscribe(() => debouncedSaveSnapshot())

  window.electronAPI?.onAppWillHide?.(() => lifecycleSave())
  window.electronAPI?.onAppWillQuit?.(async () => {
    try {
      await lifecycleSave()
    } finally {
      window.electronAPI?.session?.notifyLifecycleSaveComplete?.()
    }
  })

  // 添加搜索快捷键监听
  document.addEventListener('keydown', handleSearchKeydown, true)

  // 添加双击 Alt/Option 监听
  document.addEventListener('keydown', handleAltKeyDown, true)

  unsubDetachedClosed = window.electronAPI?.onDetachedTerminalClosed?.(handleDetachedClosed)

  // Hook 事件 → 通知消费（对齐 cmux 逻辑）
  // HMR 热重载时必须清理旧 listener，否则同一事件会被多个累积的 listener 处理，
  // 造成通知重复弹出（"所有消除的消息会全部重新弹一遍"）
  if (unsubClaudeHookEvent) {
    try { unsubClaudeHookEvent() } catch {}
    unsubClaudeHookEvent = null
  }
  if (window.electronAPI?.onClaudeHookEvent) {
    unsubClaudeHookEvent = window.electronAPI.onClaudeHookEvent((payload) => {
      // [DEBUG] 团队通知排查：完整 payload
      console.log('[HookEvent] 收到事件:', payload?.event, JSON.parse(JSON.stringify(payload || {})))

      if (!payload) {
        console.warn('[HookEvent] payload 为空，跳过')
        return
      }

      const termId = payload.data?.termId
      if (!termId) {
        console.warn('[HookEvent] termId 缺失，跳过', { event: payload.event, data: payload.data })
        return
      }

      // [DEBUG] 当前 panelStore 的 termId 列表
      const allTerms = panelStore.panelList.map(p => ({
        panelId: p.id,
        terminalId: p.terminalId,
        teamId: p.teamId,
        teamRole: p.teamRole,
        workbenchId: p.workbenchId,
      }))
      const panel = panelStore.panelList.find(p => p.terminalId === termId)
      if (!panel) {
        console.warn('[HookEvent] 未找到匹配 panel', {
          searchTermId: termId,
          event: payload.event,
          availablePanels: allTerms,
        })
        return
      }

      console.log('[HookEvent] 匹配到 panel', {
        event: payload.event,
        panelId: panel.id,
        teamId: panel.teamId,
        teamRole: panel.teamRole,
        workbenchId: panel.workbenchId,
      })

      // 缓存 sessionId 和 cwd
      const { sessionUuid: sessionId } = extractClaudeHookIdentifiers(payload)
      if (sessionId) {
        const shouldIgnoreEndedShellSession =
          payload.event === 'SessionEnd' &&
          panel.mode === 'shell' &&
          panel.claudeActive !== true

        if (shouldIgnoreEndedShellSession) {
          clearTerminalResumeData(panel.terminalId)
        } else {
          const updated = panelStore.updateClaudeSessionId(panel.id, sessionId)
          if (updated !== false) {
            terminalRestoreData.value[panel.terminalId] = {
              ...(terminalRestoreData.value[panel.terminalId] || {}),
              resumeSessionId: sessionId,
            }
          }
        }
      }
      const hookCwd = payload.data?.cwd
      if (hookCwd) {
        panelStore.updateCwd(panel.id, hookCwd)
        void syncPanelGitStatus(termId, hookCwd)
      }

      // 判断该面板是否为当前聚焦面板（cmux: 聚焦面板仍存储通知+光晕+音效，但不弹系统通知）
      const isFocusedPanel = (() => {
        if (!activeManager.value || !activeLeafId.value) return false
        const r = activeManager.value.findNode(activeManager.value.layoutRoot.value, activeLeafId.value)
        return r?.node?.panelId === panel.id
      })()

      // === cmux 对齐：事件 → 通知内容 ===
      // Stop: 创建 "Completed [in <proj>]" 通知，body 为 transcript 最后一条 assistant 消息
      if (payload.event === 'Stop') {
        const { title, subtitle, body } = buildStopNotification(payload.data || {}, payload.latestAssistantTurn, panel.cliBrand)
        console.log('[HookEvent] 推送 Stop 通知', { panelId: panel.id, isFocusedPanel, subtitle, body: body.slice(0, 60) })
        notificationStore.push({
          projectId: panel.projectId,
          workbenchId: panel.workbenchId,
          panelId: panel.id,
          type: 'agent_stop',
          title,
          subtitle,
          content: body,
          sound: !isFocusedPanel,
          isFocusedPanel,
          cooldownKey: `${panel.id}:Stop`,
          ...buildNotificationTeamMeta(panel),
        })
      }

      // SessionEnd: cmux 不创建通知（避免覆盖已有的 Stop 通知），仅清理状态
      // 不做任何 notificationStore.push

      // Notification: 按关键词分类 Permission/Error/Waiting/Attention
      if (payload.event === 'Notification') {
        const { title, subtitle, body } = buildNotificationHookNotification(payload.data || {}, panel.cliBrand)
        console.log('[HookEvent] 推送 Notification 通知', { panelId: panel.id, isFocusedPanel, subtitle, body: body.slice(0, 60) })
        notificationStore.push({
          projectId: panel.projectId,
          workbenchId: panel.workbenchId,
          panelId: panel.id,
          type: 'agent_notification',
          title,
          subtitle,
          content: body,
          sound: !isFocusedPanel,
          isFocusedPanel,
          cooldownKey: `${panel.id}:Notification`,
          ...buildNotificationTeamMeta(panel),
        })
      }

      // OSCNotification: 终端进程发的 OSC 9/99/777
      if (payload.event === 'OSCNotification') {
        const { title, subtitle, body } = buildOscNotification(payload.data || {})
        notificationStore.push({
          projectId: panel.projectId,
          workbenchId: panel.workbenchId,
          panelId: panel.id,
          type: 'osc_notification',
          title,
          subtitle,
          content: body,
          sound: !isFocusedPanel,
          isFocusedPanel,
          cooldownKey: `${panel.id}:OSCNotification`,
          ...buildNotificationTeamMeta(panel),
        })
      }
    })
  }

  // === Teams RPC listeners ===

  // surface.split — create new pane
  window.electronAPI?.teams?.onSplitRequest(({ reqId, params }) => {
    try {
      const { direction = 'right', mode = 'claude-code', focus = false, team_id, cwd: splitCwd } = params || {}
      const anchorSurfaceId = params?.surface_id
      const anchorEntry = anchorSurfaceId ? findEntryBySurfaceId(anchorSurfaceId) : null
      const anchorPanel = anchorEntry ? panelStore.panels[anchorEntry.panelId] : null
      const workspaceId = params?.workspace_id ?? params?.workspaceId ?? anchorPanel?.tabId ?? ''
      const anchorLeafId = anchorEntry?.leafId || null
      const surfaceId = nextSurfaceId()
      const paneIndex = Number.parseInt(String(surfaceId).replace('%', ''), 10) || 0
      const teamMode = cloneTeamModePayload({
        enabled: true,
        teamId: team_id || null,
        role: 'teammate',
        workspaceId,
        surfaceId,
        paneIndex,
      })

      const splitResult = addSplitPanelDetailed(direction, mode, {
        teamId: team_id || null,
        teamName: anchorPanel?.teamName || '',
        teamRole: 'teammate',
        teamStatus: 'running',
        teamStatusIcon: '⚡',
        teamStatusColor: '#58A6FF',
        teamLeadSessionId: anchorPanel?.teamLeadSessionId || anchorPanel?.claudeSessionId || '',
        teamSurfaceId: surfaceId,
        teamWorkspaceId: workspaceId,
        teamPaneIndex: paneIndex,
        runtimeManaged: true,
        cwd: splitCwd || undefined,
      }, anchorLeafId, workspaceId, { focus })

      if (!splitResult?.panelId) {
        window.electronAPI.teams.sendSplitResult({ reqId, error: 'Failed to create panel' })
        return
      }

      const panel = panelStore.panels[splitResult.panelId]
      registerSurface(surfaceId, splitResult.panelId, splitResult.leafId, panel?.terminalId)
      if (panel?.terminalId) {
        runtimeLaunchData.value[panel.terminalId] = {
          ...(runtimeLaunchData.value[panel.terminalId] || {}),
          teamMode,
        }
      }
      if (splitResult?.tabId) {
        equalizeTabLayout(splitResult.tabId)
      }

      window.electronAPI.teams.sendSplitResult({
        reqId,
        result: {
          surface_id: surfaceId,
          panel_id: splitResult.panelId,
          leaf_id: splitResult.leafId,
          term_id: panel?.terminalId,
        },
      })
    } catch (err) {
      window.electronAPI.teams.sendSplitResult({ reqId, error: err.message })
    }
  })

  // surface.send_text — write text to a pane's terminal
  window.electronAPI?.teams?.onSendTextRequest(({ reqId, params }) => {
    try {
      const { surface_id, text } = params || {}
      const entry = findEntryBySurfaceId(surface_id)
      if (!entry) {
        window.electronAPI.teams.sendSendTextResult({ reqId, error: `Unknown surface: ${surface_id}` })
        return
      }
      const panel = panelStore.panels[entry.panelId] || null
      if (shouldIgnoreTeamSendText({ panel, text })) {
        console.info('[ClaudeCodeView] 忽略 teammate bootstrap send-text', {
          surfaceId: surface_id,
          termId: entry.termId,
          teamId: panel?.teamId || null,
        })
        window.electronAPI.teams.sendSendTextResult({
          reqId,
          result: { ok: true, ignored: 'teammate-bootstrap' },
        })
        return
      }
      if (!entry.termId) {
        window.electronAPI.teams.sendSendTextResult({ reqId, error: `Surface has no terminal: ${surface_id}` })
        return
      }
      const termRef = termRefs.value?.[entry.termId]
      const isTerminalReady = typeof termRef?.isReady === 'function' ? termRef.isReady() : false
      if (!isTerminalReady) {
        queuePendingTerminalWrite(entry.termId, text)
      } else {
        window.electronAPI.terminal.write(entry.termId, text)
      }
      window.electronAPI.teams.sendSendTextResult({ reqId, result: { ok: true } })
    } catch (err) {
      window.electronAPI.teams.sendSendTextResult({ reqId, error: err.message })
    }
  })

  // surface.read_text — read terminal buffer content
  window.electronAPI?.teams?.onReadTextRequest(({ reqId, params }) => {
    try {
      const { surface_id } = params || {}
      const entry = findEntryBySurfaceId(surface_id)
      if (!entry) {
        window.electronAPI.teams.sendReadTextResult({ reqId, result: { text: '' } })
        return
      }
      // Find the xterm instance by termId
      const termRef = termRefs.value?.[entry.termId]
      if (!termRef || !termRef.terminal) {
        window.electronAPI.teams.sendReadTextResult({ reqId, result: { text: '' } })
        return
      }
      const buffer = termRef.terminal.buffer.active
      const lines = []
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (line) lines.push(line.translateToString(true))
      }
      window.electronAPI.teams.sendReadTextResult({ reqId, result: { text: lines.join('\n') } })
    } catch (err) {
      window.electronAPI.teams.sendReadTextResult({ reqId, result: { text: '' } })
    }
  })

  // surface.close — remove a pane
  window.electronAPI?.teams?.onCloseRequest(({ reqId, params }) => {
    try {
      const { surface_id } = params || {}
      const entry = findEntryBySurfaceId(surface_id)
      if (!entry) {
        window.electronAPI.teams.sendCloseResult({ reqId, error: `Unknown surface: ${surface_id}` })
        return
      }
      // 程序化关闭（teams runtime）跳过用户确认弹框，避免阻塞 IPC 流程
      removePanel(entry.leafId, { skipConfirm: true })
      delete surfaceMap[surface_id]
      window.electronAPI.teams.sendCloseResult({ reqId, result: { ok: true } })
    } catch (err) {
      window.electronAPI.teams.sendCloseResult({ reqId, error: err.message })
    }
  })

  // pane.list — list all panes in current tab
  window.electronAPI?.teams?.onPaneListRequest(({ reqId, params }) => {
    try {
      const workspaceId = params?.workspace_id ?? params?.workspaceId ?? ''
      const panes = []
      for (const [sid, entry] of Object.entries(surfaceMap)) {
        const panel = panelStore.panels[entry.panelId]
        if (!panel) continue
        if (workspaceId && panel.tabId !== workspaceId) continue
        panes.push({
          pane_id: sid,
          pane_index: parseInt(sid.replace('%', ''), 10) || 0,
          pane_width: panel.cols || 80,
          pane_height: panel.rows || 24,
          active: activeLeafId.value === entry.leafId,
        })
      }
      window.electronAPI.teams.sendPaneListResult({ reqId, result: { panes } })
    } catch (err) {
      window.electronAPI.teams.sendPaneListResult({ reqId, result: { panes: [] } })
    }
  })

  // pane.focus — focus a specific pane
  window.electronAPI?.teams?.onPaneFocusRequest(({ reqId, params }) => {
    try {
      const { surface_id, title } = params || {}
      const entry = findEntryBySurfaceId(surface_id)
      if (entry && activeManager.value) {
        activeManager.value.activeLeafId.value = entry.leafId
        recordLeafActivation(entry?.tabId ?? activeTab.value?.id ?? null, entry.leafId)
      }
      if (entry && typeof title === 'string' && title.trim()) {
        panelStore.updateTeamIdentity(entry.panelId, { teamLabel: title.trim() })
      }
      window.electronAPI.teams.sendPaneFocusResult({ reqId, result: { ok: true } })
    } catch (err) {
      window.electronAPI.teams.sendPaneFocusResult({ reqId, error: err.message })
    }
  })

  // pane.resize — resize a pane (best effort)
  window.electronAPI?.teams?.onPaneResizeRequest(({ reqId }) => {
    try {
      // Resize is complex with the split layout; acknowledge for now
      window.electronAPI.teams.sendPaneResizeResult({ reqId, result: { ok: true } })
    } catch (err) {
      window.electronAPI.teams.sendPaneResizeResult({ reqId, error: err.message })
    }
  })

  // workspace.equalize_splits — equalize pane sizes in split
  window.electronAPI?.teams?.onEqualizeSplitsRequest(({ reqId }) => {
    try {
      const mgr = activeManager.value
      if (mgr && mgr.layoutRoot.value) {
        _equalizeSplitSizes(mgr.layoutRoot.value)
      }
      window.electronAPI.teams.sendEqualizeSplitsResult({ reqId, result: { ok: true } })
    } catch (err) {
      window.electronAPI.teams.sendEqualizeSplitsResult({ reqId, error: err.message })
    }
  })

  // teams.start — start a team session (convert shell pane to leader)
  window.electronAPI?.teams?.onStartRequest(({ reqId, params }) => {
    try {
      const teamId = params?.teamId ?? params?.team_id ?? ''
      const termId = params?.termId ?? params?.term_id ?? ''
      const reqSurfaceId = params?.surfaceId ?? params?.surface_id ?? ''
      const panel = Object.values(panelStore.panels).find(p => p.terminalId === termId)
      if (!panel) {
        window.electronAPI.teams.sendStartResult({ reqId, error: 'Panel not found' })
        return
      }
      const workspaceId = params?.workspaceId ?? params?.workspace_id ?? panel.tabId ?? ''

      const leaderSurfaceId = reqSurfaceId || nextSurfaceId()
      window.electronAPI.teams.sendStartResult({
        reqId,
        result: { team_id: teamId, surface_id: leaderSurfaceId, status: 'starting' },
      })

      // Let `ko teams` receive its success response before tearing down the shell PTY,
      // otherwise the in-flight CLI process gets SIGHUP'd before it can exit cleanly.
      window.setTimeout(() => {
        try {
          const currentPanel = panelStore.panels[panel.id]
          if (!currentPanel || currentPanel.terminalId !== termId) {
            return
          }

          currentPanel.teamId = teamId
          currentPanel.teamRole = 'leader'
          currentPanel.teamStatus = 'running'
          currentPanel.teamStatusIcon = '⚡'
          currentPanel.teamStatusColor = '#58A6FF'
          currentPanel.mode = 'claude-code'
          currentPanel.claudeSessionId = null
          currentPanel.shellState = 'idle'
          currentPanel.lastExitCode = null

          const mgr = activeManager.value
          const leafId = mgr ? _findLeafIdByPanelId(mgr, currentPanel.id) : currentPanel.id
          const newTermId = generateTermId()

          currentPanel.terminalId = newTermId
          panelStore.updateTeamRuntimeBinding(currentPanel.id, {
            teamId,
            teamRole: 'leader',
            teamSurfaceId: leaderSurfaceId,
            teamWorkspaceId: workspaceId,
            teamPaneIndex: 0,
            runtimeManaged: true,
          })
          registerSurface(leaderSurfaceId, currentPanel.id, leafId, newTermId)
          const teamMode = cloneTeamModePayload({
            enabled: true,
            teamId,
            role: 'leader',
            workspaceId,
            surfaceId: leaderSurfaceId,
            paneIndex: 0,
          })

          window.electronAPI.terminal.create({
            termId: newTermId,
            cwd: resolveProjectTerminalCwd(projectStore.getProject(currentPanel.projectId), currentPanel.cwd),
            mode: 'claude-code',
            teamMode,
          })

          window.setTimeout(() => {
            window.electronAPI.terminal.destroy(termId)
          }, 0)
        } catch (error) {
          console.error('[ClaudeCodeView] teams.start transition failed:', error)
        }
      }, 50)
    } catch (err) {
      window.electronAPI.teams.sendStartResult({ reqId, error: err.message })
    }
  })

  // Panel status updates from hook handler
  unsubTeamsPanelStatus = window.electronAPI?.teams?.onPanelStatus?.(({ termId, teamStatus, teamStatusIcon, teamStatusColor }) => {
    panelStore.updateTeamStatus(termId, { teamStatus, teamStatusIcon, teamStatusColor })
  })

  // Notification from hook handler
  unsubTeamsNotification = window.electronAPI?.teams?.onNotification?.((notif) => {
    const panel = notif?.panelId
      ? panelStore.getPanel(notif.panelId)
      : panelStore.panelList.find((candidate) => candidate.terminalId === notif?.termId) || null
    const { title, subtitle, body } = buildNotificationHookNotification({
      ...notif,
      message: notif?.content ?? notif?.body ?? notif?.message ?? '',
    }, panel?.cliBrand)
    notificationStore.createNotification({
      ...notif,
      title,
      subtitle,
      content: body,
      panelId: panel?.id ?? notif?.panelId ?? null,
      workbenchId: panel?.workbenchId ?? notif?.workbenchId ?? null,
      ...(panel ? buildNotificationTeamMeta(panel) : {}),
    })
  })

  // 首次进入或 CLI_INTRO_VERSION bump 后展示功能介绍
  // 只在用户主动点击"命令行模式"进入时弹出，启动恢复不弹
  if (uiStore.claudeCodeUserEntered) {
    uiStore.claudeCodeUserEntered = false
    nextTick(() => featureIntro.checkAndShow())
  }
})

// Shell Integration 状态监听
let unsubShellState = null
let unsubClaudeStatus = null
let unsubTeamsPanelStatus = null
let unsubTeamsNotification = null

unsubShellState = window.electronAPI?.terminal.onShellStateChange?.((payload) => {
  if (payload?.termId) {
    panelStore.updateShellState(payload.termId, payload)
    if (payload.cwd) {
      void syncPanelGitStatus(payload.termId, payload.cwd)
    }
  }
})

unsubClaudeStatus = window.electronAPI?.terminal.onClaudeStatusChange?.((payload) => {
  if (!payload?.termId) return
  const parsed = parseClaudeStatusPayload(payload, { sessionKey: payload.termId })
  panelStore.updateAiStatus(payload.termId, parsed)
  if (parsed.cwd) {
    void syncPanelGitStatus(payload.termId, parsed.cwd)
  }
  void syncPanelClaudeStats(payload.termId, parsed)
})

onBeforeUnmount(() => {
  clearPendingTerminalFocusTimers()
  terminalRestoreTelemetryRun?.stop?.()
  terminalRestoreTelemetryRun = null
  stopPeriodicSave()
  stopProjectPathRechecks()
  lifecycleSave()
  document.removeEventListener('keydown', handleSearchKeydown, true)
  document.removeEventListener('keydown', handleAltKeyDown, true)
  unsubDetachedClosed?.()
  if (typeof unsubShellState === 'function') unsubShellState()
  if (typeof unsubClaudeStatus === 'function') unsubClaudeStatus()
  if (typeof unsubClaudeHookEvent === 'function') {
    try { unsubClaudeHookEvent() } catch {}
    unsubClaudeHookEvent = null
  }
  if (typeof unsubTeamsPanelStatus === 'function') {
    try { unsubTeamsPanelStatus() } catch {}
    unsubTeamsPanelStatus = null
  }
  if (typeof unsubTeamsNotification === 'function') {
    try { unsubTeamsNotification() } catch {}
    unsubTeamsNotification = null
  }
})
</script>

<style scoped>
.claude-code-view {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.claude-code-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.claude-code-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Tab 栏（面板标签） */
.tab-bar {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  user-select: none;
  -webkit-app-region: drag;
  background: var(--tab-bar-bg);
  /* border-bottom: 1px solid var(--tab-border, #282828); */
}

.tab-bar-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-app-region: no-drag;
}

.tab-bar-left::-webkit-scrollbar { display: none; }

.tab-bar-overflow-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
  -webkit-app-region: no-drag;
}

.tab-bar-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 8px;
  -webkit-app-region: no-drag;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px 0 12px;
  min-width: 100px;
  max-width: 200px;
  cursor: pointer;
  color: var(--tab-text, rgba(255, 255, 255, 0.45));
  font-size: 12px;
  background: transparent;
  border-radius: 8px;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
  box-sizing: border-box;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  flex-shrink: 0;
  box-sizing: border-box;
}

.tab-item:hover { color: var(--tab-hover-text, rgba(255, 255, 255, 0.75)); }
.tab-item.active { background: var(--tab-active-bg, #2C2C2C); color: var(--tab-active-text, rgba(255, 255, 255, 0.95)); }

.tab-item.drag-over { background: rgba(137, 180, 250, 0.2); color: #89b4fa; }
.tab-item.dragging { opacity: 0.4; }
.tab-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.tab-icon {
  font-size: 11px;
  color: var(--tab-icon-color, rgba(255, 165, 0, 0.8));
  flex-shrink: 0;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-feature-settings: normal;
  font-variant-emoji: text;
}

.tab-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--tab-close-text, rgba(255, 255, 255, 0.3));
  font-size: 11px;
  cursor: pointer;
  padding: 2px 3px;
  border-radius: 3px;
  line-height: 1;
  visibility: hidden;
}

.tab-item.active .tab-close,
.tab-item:hover .tab-close {
  visibility: visible;
}

.tab-close:hover { background: var(--tab-close-hover-bg, rgba(255, 255, 255, 0.1)); color: var(--tab-close-hover-text, #fff); }

.tab-overflow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #8b949e;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s;
}

.tab-overflow-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.tab-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: var(--tab-add-bg, rgba(255, 255, 255, 0.04));
  color: var(--tab-text, rgba(255, 255, 255, 0.45));
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s;
  align-self: center;
  margin-left: 4px;
}

.tab-add-btn:hover {
  background: var(--tab-add-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--tab-active-text, rgba(255, 255, 255, 0.95));
}

.toolbar-btn {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--btn-text, rgba(255, 255, 255, 0.7));
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  padding: 4px;
  border-radius: 4px;
}

.toolbar-btn:hover {
  background: var(--btn-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--btn-hover-text, rgba(255, 255, 255, 0.95));
}

.toolbar-btn.active {
  background: var(--tab-active-bg, rgba(255, 255, 255, 0.08));
  color: var(--tab-active-text, rgba(255, 255, 255, 0.95));
}

.tab-bar-separator {
  width: 1px;
  height: 16px;
  background: var(--divider-color);
  margin: 0 4px;
  flex-shrink: 0;
}

/* 终端区域 */
.terminals-area {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* 主体区域 */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  border-top: 1px solid var(--tab-border);
}

/* 右侧区域 */
.right-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 文件树面板 */
.file-panel {
  position: relative;
  flex-shrink: 0;
  display: flex;
  border-right: 1px solid #333;
  overflow: hidden;
}

.file-panel-resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 10;
}

.file-panel-resizer:hover {
  background: #0078d4;
}

/* 编辑器面板 */
.editor-area {
  flex: 1;
  overflow: hidden;
  border-top: 1px solid #333;
  min-height: 200px;
  max-height: 50%;
}


.terminals-area.split-horizontal {
  flex-direction: row;
}

.terminals-area.split-vertical {
  flex-direction: column;
}

.terminal-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.split-horizontal .terminal-pane + .terminal-pane {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.split-vertical .terminal-pane + .terminal-pane {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.active-pane {
  outline: 1px solid rgba(137, 180, 250, 0.3);
  outline-offset: -1px;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  background: var(--pane-title-bg, rgba(0, 0, 0, 0.2));
  min-height: 24px;
}

.pane-header-content {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-title-group {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pane-title {
  font-size: 11px;
  color: var(--pane-title, rgba(255, 255, 255, 0.5));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-variant-emoji: text;
}

.pane-team-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.pane-team-badge {
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.04);
}

.pane-team-status {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.03);
}

.pane-team-status.is-running {
  color: #58a6ff;
}

.pane-team-status.is-needs-input {
  color: #d29922;
}

.pane-team-status.is-error {
  color: #ff7b72;
}

.pane-team-status.is-idle {
  color: #8b949e;
}

.pane-team-badge.is-running {
  color: #58a6ff;
}

.pane-team-badge.is-needs-input {
  color: #d29922;
}

.pane-team-badge.is-error {
  color: #ff7b72;
}

.pane-team-badge.is-idle {
  color: #8b949e;
}

.terminal-pane-host {
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
}

.terminal-staging-docks {
  position: fixed;
  left: -12000px;
  top: 0;
  z-index: -1;
  visibility: hidden;
  pointer-events: none;
  width: 720px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.terminal-staging-dock {
  flex: 0 0 auto;
  width: 720px;
  height: 400px;
  min-height: 200px;
  box-sizing: border-box;
  overflow: hidden;
}

/* 搜索栏过渡动画 */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.search-slide-enter-from,
.search-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.search-slide-enter-to,
.search-slide-leave-from {
  max-height: 44px;
  opacity: 1;
}

/* Tab 溢出面板 */
.tab-overflow-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.tab-overflow-panel {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  max-width: 360px;
  max-height: 320px;
  overflow-y: auto;
  background: rgba(35, 35, 40, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.tab-overflow-panel::-webkit-scrollbar { width: 4px; }
.tab-overflow-panel::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 2px; }

.tab-overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.12s;
}

.tab-overflow-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tab-overflow-item.is-active {
  background: rgba(88, 166, 255, 0.1);
}

.tab-overflow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-overflow-title {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.tab-overflow-item.is-active .tab-overflow-title {
  color: #58a6ff;
}

.tab-overflow-check {
  color: #58a6ff;
  font-size: 12px;
  flex-shrink: 0;
}

.tab-overflow-fade-enter-active,
.tab-overflow-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.tab-overflow-fade-enter-from,
.tab-overflow-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

<style>
/* 拖拽 Ghost（跟随鼠标的副本） */
.drag-ghost {
  position: fixed;
  min-width: 120px;
  max-width: 200px;
  height: 32px;
  background: rgba(45, 45, 48, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  pointer-events: none;
  z-index: 10000;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  transition: transform 150ms ease-out, width 150ms ease-out, height 150ms ease-out,
              box-shadow 150ms ease-out, border-color 150ms ease-out;
  transform: scale(0.95);
}

.drag-ghost-title {
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 窗口外：变形为窗口预览模式 */
.drag-ghost.window-preview {
  width: 220px;
  height: 140px;
  background: rgba(37, 37, 38, 0.95);
  border-radius: 10px;
  border-color: #409eff;
  box-shadow: 0 0 0 2px #409eff, 0 8px 32px rgba(64, 158, 255, 0.3);
  transform: scale(0.75);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.drag-ghost.window-preview::before {
  content: '松开以创建独立窗口';
  font-size: 12px;
  color: #409eff;
  margin-bottom: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.drag-ghost.window-preview .drag-ghost-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

/* 右键菜单（Teleport 到 body，不能 scoped） */
.detach-context-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}

.detach-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 140px;
  padding: 4px 0;
  border-radius: 6px;
  background: var(--menu-bg);
  border: 1px solid var(--menu-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
}

.detach-menu-item {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--menu-text);
  cursor: pointer;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.detach-menu-item:hover {
  background: var(--menu-hover-bg);
}

.detach-menu-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.detach-menu-item.disabled:hover {
  background: transparent;
}

/* 重命名标签页弹框 */
.tab-rename-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.tab-rename-dialog {
  width: 520px;
  background: #2f2f2f;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.tab-rename-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.tab-rename-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.tab-rename-dialog__close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.tab-rename-dialog__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.tab-rename-dialog__body {
  margin-bottom: 24px;
  position: relative;
}

.tab-rename-dialog__input {
  width: 100%;
  height: 32px;
  background: #464646;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 14px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.tab-rename-dialog__input:focus {
  border-color: #606572;
}

.tab-rename-dialog__counter {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #999;
  pointer-events: none;
}

.tab-rename-dialog__error {
  margin-top: 8px;
  font-size: 12px;
  color: #f56c6c;
}

.tab-rename-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.tab-rename-dialog__btn {
  height: 32px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tab-rename-dialog__btn--cancel {
  background: transparent;
  color: #999;
}

.tab-rename-dialog__btn--cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tab-rename-dialog__btn--confirm {
  background: #606572;
  color: #fff;
}

.tab-rename-dialog__btn--confirm:hover {
  background: #4E525E;
}

/* 通用确认弹框 */
.tab-confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.tab-confirm-dialog {
  width: 520px;
  background: #2f2f2f;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.tab-confirm-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.tab-confirm-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.tab-confirm-dialog__close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.tab-confirm-dialog__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.tab-confirm-dialog__body {
  margin-bottom: 24px;
}

.tab-confirm-dialog__content {
  font-size: 14px;
  color: #ccc;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.tab-confirm-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.tab-confirm-dialog__btn {
  min-width: 80px;
  height: 32px;
  padding: 0 16px;
  border: 1px solid #383838;
  border-radius: 8px;
  background: transparent;
  color: #f2f2f2;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, opacity 0.2s;
}

.tab-confirm-dialog__btn--cancel {
  background: transparent;
  color: #f2f2f2;
}

.tab-confirm-dialog__btn--cancel:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.14);
}

.tab-confirm-dialog__btn--confirm {
  border: none;
  background: #4E525E;
  color: #fff;
}

.tab-confirm-dialog__btn--confirm:hover {
  background: #4E525E;
}

.light-theme .tab-rename-dialog__title,
.light-theme .tab-confirm-dialog__title {
  color: #606572;
}

.light-theme .tab-rename-dialog,
.light-theme .tab-confirm-dialog {
  background: #ffffff;
  border-color: #d0d7de;
}

.light-theme .tab-rename-dialog__close,
.light-theme .tab-confirm-dialog__close {
  color: #656d76;
}

.light-theme .tab-rename-dialog__close:hover,
.light-theme .tab-confirm-dialog__close:hover {
  color: #1f2328;
  background: rgba(0, 0, 0, 0.06);
}

.light-theme .tab-rename-dialog__input,
.light-theme .tab-confirm-dialog__input {
  background: #f6f8fa;
  color: #1f2328;
}

.light-theme .tab-rename-dialog__input:focus,
.light-theme .tab-confirm-dialog__input:focus {
  border-color: #0969da;
}

.light-theme .tab-rename-dialog__counter,
.light-theme .tab-confirm-dialog__counter {
  color: #656d76;
}

.light-theme .tab-rename-dialog__error,
.light-theme .tab-confirm-dialog__error {
  color: #d1242f;
}

.light-theme .tab-rename-dialog__content,
.light-theme .tab-confirm-dialog__content {
  color: #606572;
}

.light-theme .tab-rename-dialog__btn--cancel {
  color: #1f2328;
}

.light-theme .tab-rename-dialog__btn--cancel:hover {
  background: #f6f8fa;
  color: #1f2328;
}

.light-theme .tab-rename-dialog__btn--confirm {
  background: #4E525E;
  color: #fff;
}

.light-theme .tab-rename-dialog__btn--confirm:hover {
  background: #4E525E;
}

.light-theme .tab-confirm-dialog__btn--cancel {
  border-color: #d0d7de;
  color: #1f2328;
}

.light-theme .tab-confirm-dialog__btn--cancel:hover {
  background: #f6f8fa;
  border-color: #1f2328;
  color: #1f2328;
}

.light-theme .tab-confirm-dialog__btn--confirm {
  background: #4E525E;
  color: #fff;
}

.light-theme .tab-confirm-dialog__btn--confirm:hover {
  background: #4E525E;
}

.light-theme .tab-confirm-dialog--danger .tab-confirm-dialog__btn--confirm {
  background: #ED4543;
  border-color: #ED4543;
  color: #FFFFFF;
}

.light-theme .tab-confirm-dialog--danger .tab-confirm-dialog__btn--confirm:hover {
  background: #d93d3b;
  border-color: #d93d3b;
}
</style>
