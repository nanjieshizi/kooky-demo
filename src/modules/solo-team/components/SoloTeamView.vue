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

    <!-- 无任务时展示普通对话空白页，不再显示封面式创建引导 -->
    <section v-else class="solo-empty-chat" aria-label="个人对话">
      <header class="solo-empty-chat__header"><strong>个人</strong></header>
      <div class="solo-empty-chat__body">
        <div class="solo-empty-chat__welcome" role="status">
          <strong>从一句话开始</strong>
          <span>描述你想完成的事情，我会帮你梳理并继续推进。</span>
        </div>
      </div>
      <form class="solo-empty-chat__composer" @submit.prevent>
        <textarea rows="2" readonly placeholder="你可以输入任何你想做的事情"></textarea>
        <div class="solo-empty-chat__footer">
          <div><button type="button" aria-label="添加附件">⌕</button><button type="button" aria-label="技能">✣</button></div>
          <div><button type="button" class="solo-empty-chat__pill">♧ 思考⌄</button><button type="button" class="solo-empty-chat__pill">✳ Claude Opus 4.5⌄</button><button type="submit" aria-label="发送">➤</button></div>
        </div>
      </form>
      <p class="solo-empty-chat__disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
    </section>

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

.solo-empty-chat {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
}

.solo-empty-chat__header {
  height: 54px;
  flex: 0 0 54px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: #303746;
  font-size: 14px;
  font-weight: 400;
}

.solo-empty-chat__header strong {
  font-weight: 400;
}

.solo-empty-chat__body { flex: 1; min-height: 0; display:flex; align-items:center; justify-content:center; padding:0 24px 54px; box-sizing:border-box; }
.solo-empty-chat__welcome { display:flex; max-width:360px; flex-direction:column; align-items:center; gap:7px; color:#969daa; text-align:center; }
.solo-empty-chat__welcome strong { color:#3d4552; font-size:16px; font-weight:600; letter-spacing:-.01em; }
.solo-empty-chat__welcome span { font-size:12px; line-height:1.6; }
.solo-empty-chat__composer { margin: 0 32px; padding: 11px 14px 9px; border: 1.5px solid #dce2eb; border-radius: 15px; background: #fff; box-shadow: 0 8px 22px rgba(82,98,122,.10); }
.solo-empty-chat__composer textarea { display: block; width: 100%; min-height: 38px; box-sizing: border-box; resize: none; border: 0; outline: 0; background: transparent; color: #303746; font: 13px/1.55 PingFang SC, sans-serif; }
.solo-empty-chat__composer textarea::placeholder { color: #a1a8b4; }
.solo-empty-chat__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 7px; }
.solo-empty-chat__footer > div { display: flex; align-items: center; gap: 7px; }
.solo-empty-chat__footer button { display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 8px; border: 1px solid #e0e5ee; border-radius: 8px; background: #fff; color: #647084; cursor: pointer; transition: transform .16s ease, background .18s ease; }
.solo-empty-chat__footer button:hover { background: #f5f7fb; }
.solo-empty-chat__footer button:active { transform: scale(.96); }
.solo-empty-chat__footer .solo-empty-chat__pill { border: 0; background: #f5f7fb; color: #344055; font-size: 12px; }
.solo-empty-chat__footer > div:last-child button:last-child { width: 32px; border: 0; border-radius: 50%; background: #aab1bd; color: #fff; font-size: 15px; }
.solo-empty-chat__disclaimer { margin: 8px 0 20px; color: #a6acb9; text-align: center; font-size: 11px; line-height: 16px; }

@media (prefers-reduced-motion: reduce) {
  .solo-empty-chat__footer button { transition: none; }
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
