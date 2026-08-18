<template>
  <div
    class="solo-team-view"
    :class="{
      'solo-team-view--one-person': isOnePersonTeamWorkspace,
      'solo-team-view--one-person-task-tool-open': isOnePersonTeamWorkspace && showGlobalTaskPanel,
    }"
  >
    <PersonalTaskChat
      v-if="taskBridgePersonalTask"
      :project="taskBridgePersonalTask.project"
      :task="taskBridgePersonalTask.task"
    />

    <!-- 选中我的员工：展示员工独立多会话对话 -->
    <template v-else-if="showEmployeeChat">
      <div class="solo-team-main">
        <div ref="soloTeamHeaderRef">
          <EmployeeChatSessionHeader variant="solo-team" />
        </div>
        <EmployeeChatPanel class="chat-area" />
      </div>
    </template>

    <!-- 选中一人团队：使用新版会话面板 + 团队管理 -->
    <template v-else-if="hasTeam && activeOnePersonTeam">
      <div
        class="solo-team-main"
        :class="{
          'solo-team-main--one-person': true,
        }"
      >
        <OnePersonTeamChatPanel
          :key="activeOnePersonTeam.id"
          :team-id="activeOnePersonTeam.id"
          class="chat-area"
          @open-file="openPreviewFile"
          @dissolved="handleOnePersonDissolved"
        />
      </div>

    </template>

    <!-- 无团队数据：展示创建引导页 -->
    <CreateSoloTeamView
      v-else
      @create="showCreateDialog = true"
    />

    <!-- 创建数字员工弹框 -->
    <CreateDigitalEmployeeDialog
      :visible="showCreateDialog"
      @close="showCreateDialog = false"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'SoloTeamView' })
import { ref, computed, watch, provide } from 'vue'
import { useSoloTeamStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY, SOLO_TEAM_HEADER_REF_KEY } from '@/shared/constants/injectionKeys'
import CreateSoloTeamView from './CreateSoloTeamView.vue'
import CreateDigitalEmployeeDialog from './CreateDigitalEmployeeDialog.vue'
import OnePersonTeamChatPanel from './OnePersonTeamChatPanel.vue'
import EmployeeChatPanel from './EmployeeChatPanel.vue'
import EmployeeChatSessionHeader from './EmployeeChatSessionHeader.vue'
import { usePreviewStore } from '@/modules/space/previewStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import PersonalTaskChat from '@/modules/task-bridge/components/PersonalTaskChat.vue'

const soloTeamStore = useSoloTeamStore()
const uiStore = useUIStore()
const previewStore = usePreviewStore()
const sidePanelStore = useSidePanelStore()
const taskBridgeStore = useTaskBridgeStore()

/** 与协作区 DigitalHumanPanel 对称：子树内员工会话统一走 solo-team Pinia，避免误用默认 inject */
provide(EMPLOYEE_CHAT_SESSION_STORE_KEY, soloTeamStore)

const showCreateDialog = ref(false)
const soloTeamHeaderRef = ref(null)
provide(SOLO_TEAM_HEADER_REF_KEY, soloTeamHeaderRef)

// 一人团队列表与选中
const onePersonTeams = computed(() => soloTeamStore.onePersonTeams)
const hasTeam = computed(() => onePersonTeams.value.length > 0)
const activeOnePersonTeam = computed(() => {
  if (!soloTeamStore.currentTeamId) return null
  return onePersonTeams.value.find((item) => String(item.id) === String(soloTeamStore.currentTeamId)) || null
})
const activeOnePersonTask = computed(() => (
  soloTeamStore.currentTeamId
    ? soloTeamStore.getOnePersonActiveTask(soloTeamStore.currentTeamId)
    : null
))
const taskBridgePersonalTask = computed(() => {
  const match = /^task-bridge:([^:]+):(.+)$/.exec(String(uiStore.activeSecondaryNav || ''))
  if (!match) return null
  const [, projectId, taskId] = match
  const project = taskBridgeStore.projectFor(projectId)
  const task = project?.tasks.find((item) => item.id === taskId)
  return project && task ? { project, task } : null
})

const showEmployeeChat = computed(() => soloTeamStore.isEmployeeChatActive && !!soloTeamStore.currentEmployeeThread)
const isOnePersonTeamWorkspace = computed(() => !showEmployeeChat.value && hasTeam.value && Boolean(activeOnePersonTeam.value))
const showGlobalTaskPanel = computed(() => uiStore.activeToolTab === 'task')

// 个人任务是独立执行对话，不沿用一人团队会话中的“专项作战室”侧栏。
watch(
  taskBridgePersonalTask,
  (task) => {
    if (task) sidePanelStore.close()
  },
  { immediate: true },
)

/** 与模板 v-else 一致：展示创建引导页时收起数字员工管理侧栏 */
const showCreateSoloTeamGuide = computed(
  () => !showEmployeeChat.value && !(hasTeam.value && activeOnePersonTeam.value),
)

watch(
  showCreateSoloTeamGuide,
  (show) => {
    if (show) uiStore.closeDigitalEmployeePanel()
  },
  { immediate: true },
)

watch(
  () => onePersonTeams.value,
  (teams, prevTeams) => {
    if (teams.length > 0 && (!prevTeams || prevTeams.length === 0)) {
      uiStore.expandSidebar()
    }
    if (!showEmployeeChat.value && soloTeamStore.currentTeamId && !teams.find((t) => String(t.id) === String(soloTeamStore.currentTeamId))) {
      const next = teams[0]
      soloTeamStore.setCurrentOnePersonTeamId(next?.id || null)
    }
  },
  { deep: true },
)

// 预览区：点群内文件/任务产物 → 塞进全局共享预览区（HomeView 渲染，整个 kooky 共用）
function openPreviewFile(file) {
  previewStore.openFile(file)
}

// 解散团队后清空预览区
function handleOnePersonDissolved() {
  previewStore.close()
}
</script>

<style lang="scss" scoped>
.solo-team-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  gap: 0;
  overflow: hidden;
  background: #f5f6f8;
}

.solo-team-view--one-person {
  overflow-x: auto;
  overflow-y: hidden;
}

.solo-team-view--one-person-task-tool-open {
  --one-person-conversation-min-width: 340px;
  --one-person-workspace-task-min-width: 688px;
}

.solo-team-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
}

.solo-team-main--one-person {
  flex: 1 0 var(--one-person-conversation-min-width, 360px);
  min-width: var(--one-person-conversation-min-width, 360px);
}

.solo-team-main--one-person.has-one-person-task-pane {
  flex-basis: var(--one-person-workspace-task-min-width, 728px);
  min-width: var(--one-person-workspace-task-min-width, 728px);
}

.chat-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.one-person-roster-shell {
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  overflow: visible;
}

.one-person-preview-shell {
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
  width: 480px;
  margin-left: 8px;
  display: flex;
}

.one-person-preview-shell > * {
  flex: 1;
  min-width: 0;
}

.one-person-roster-shell.is-dragging *:not(.left-divider):not(.left-divider *) {
  pointer-events: none !important;
  user-select: none !important;
}

.left-divider {
  overflow: visible;
  z-index: 1600;
}

.left-divider .divider-handle {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1600;
}

.divider {
  position: relative;
  width: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 10;
  background: var(--bg-primary);
  margin-bottom: 10px;
  margin-top: 5px;
}

.divider-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
  transition: background 0.15s;
}

.divider-line.dragging {
  background: linear-gradient(
    180deg,
    rgba(67, 111, 246, 0) 0%,
    rgba(67, 111, 246, 0.6) 21%,
    #436FF6 51%,
    rgba(67, 111, 246, 0.6) 82%,
    rgba(67, 111, 246, 0) 100%
  );
}

.divider:hover .divider-line:not(.dragging) {
  background: #E8EBF0;
}

.divider-handle {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 32px;
  background: #fff;
  border: 1px solid #E8EBF0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.drag-icon {
  width: 14px;
  height: 21.58px;
  object-fit: contain;
}

.drag-icon-hover {
  display: none;
}

.divider:hover .divider-handle {
  opacity: 1;
}

.divider-handle.dragging {
  opacity: 1;
  border-color: #436FF6;
  box-shadow: 0 0 0 2px rgba(67, 111, 246, 0.15);
}

.divider-handle.dragging .drag-icon-default {
  display: none;
}

.divider-handle.dragging .drag-icon-hover {
  display: block;
}
</style>

<!-- 与协作数字人一致：欢迎全铺背景时覆盖含 solo-team-header 的整栏（一人团队「我的员工」新对话同） -->
<style lang="scss">
.solo-team-view .solo-team-main:has(.message-list-scroll--employee-welcome-full-bleed-bg) {
  background-color: transparent;
  background-image: url('@/assets/soloTeam/bg1.png');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.solo-team-view .solo-team-main:has(.message-list-scroll--employee-welcome-full-bleed-bg) .solo-team-header {
  background: transparent;
}

.solo-team-view .solo-team-main:has(.message-list-scroll--employee-welcome-full-bleed-bg) .employee-chat-panel {
  background: transparent;
}
</style>
