<template>
  <div
    class="op-team-workspace"
    :class="{ 'is-conversation-dragging': isConversationDragging }"
    :style="workspaceStyle"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <Transition name="drag-fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-card">
          <img :src="uploadDragImg" class="drag-img" alt="" />
          <p class="drag-title">在此处拖放文件/图片</p>
          <p class="drag-hint">最多支持 5 个文件，每个 50MB，支持 MD、TXT、PDF、DOCX、ODT、JPG、PNG、代码文件等</p>
        </div>
      </div>
    </Transition>

    <MainConversationPane
      ref="mainPaneRef"
      :loading="loading || (mainThreadState?.loading && !mainThreadState?.loaded)"
      :main-thread="mainThread"
      :messages="mainMessages"
      :sending="mainThreadSending"
      :thinking="mainThreadThinking"
      :mention-members="mentionMembers"
      :tasks="groupTasks"
      :active-task-id="activeTask?.id || ''"
      :open-file-ids="openFileIds"
      :team-id="teamKey"
      :has-more="mainThreadState?.hasMore"
      :loading-more="mainThreadState?.loading && mainThreadState?.loaded"
      @send="sendMainMessage"
      @open-task="openTaskById"
      @open-file="emit('open-file', $event)"
      @dissolved="emit('dissolved')"
      @load-more="loadMoreMainMessages"
    />

    <!-- 子会话已迁入统一会话侧区 tasks 槽（OnePersonTasksSlot 下钻），不再占主区第二栏 -->
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useSoloTeamStore } from '../store'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useOnePersonFileDropProvider } from '../composables/useOnePersonFileDrop'
import MainConversationPane from './one-person-team/MainConversationPane.vue'
import TaskConversationPane from './one-person-team/TaskConversationPane.vue'
import uploadDragImg from '@/assets/home/uploadDrag.png'
import dragIcon from '@/assets/home/drag.svg'
import dragHoverIcon from '@/assets/home/dragHover.svg'

defineOptions({ name: 'OnePersonTeamChatPanel' })

const props = defineProps({
  teamId: { type: [String, Number], default: '' },
  openFileIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['open-file', 'dissolved'])

const soloTeamStore = useSoloTeamStore()
const sidePanel = useSidePanelStore()
const { isDragging, onDragEnter, onDragOver, onDragLeave, onDrop } = useOnePersonFileDropProvider()

const teamKey = computed(() => (props.teamId ? String(props.teamId) : ''))
const loading = computed(() => Boolean(
  teamKey.value
  && (soloTeamStore.onePersonHomeLoadingByTeamId[teamKey.value] || soloTeamStore.teamThreadsLoadingById[teamKey.value]),
))
const mainThread = computed(() => soloTeamStore.getOnePersonMainThread(teamKey.value))
const activeTask = computed(() => soloTeamStore.getOnePersonActiveTask(teamKey.value))
const groupTasks = computed(() => (teamKey.value ? soloTeamStore.getOnePersonTasks(teamKey.value) : []))
const mainMessages = computed(() => soloTeamStore.getOnePersonMainMessages(teamKey.value))
const activeTaskMessages = computed(() => activeTask.value ? soloTeamStore.getOnePersonTaskMessages(teamKey.value, activeTask.value.id) : [])
const mainThreadState = computed(() => mainThread.value?.id ? soloTeamStore.getOnePersonThreadState(mainThread.value.id) : null)
const mainThreadSending = computed(() => soloTeamStore.isOnePersonThreadSending(mainThread.value?.id))
const mainThreadThinking = computed(() => soloTeamStore.isOnePersonThreadThinking(mainThread.value?.id))
const activeTaskThreadId = computed(() => activeTask.value?.threadId || activeTask.value?.executionThreadId || '')
const activeTaskThreadState = computed(() => activeTaskThreadId.value ? soloTeamStore.getOnePersonThreadState(activeTaskThreadId.value) : null)
const activeTaskSending = computed(() => soloTeamStore.isOnePersonThreadSending(activeTaskThreadId.value))
const activeTaskThinking = computed(() => soloTeamStore.isOnePersonThreadThinking(activeTaskThreadId.value))
const mentionMembers = computed(() => soloTeamStore.getOnePersonMentionMembers(teamKey.value))
const conversationDividerWidth = 8
const conversationMinWidth = 360
const conversationMinWidthCss = `var(--one-person-conversation-min-width, ${conversationMinWidth}px)`
const defaultMainPaneRatio = 1
const defaultTaskPaneRatio = 0.9
const mainPaneRef = ref(null)
const taskPaneRef = ref(null)
const mainPaneRatio = ref(readStoredRatio('one-person-main-conversation-ratio', defaultMainPaneRatio))
const taskPaneRatio = ref(readStoredRatio('one-person-task-conversation-ratio', defaultTaskPaneRatio))
const isConversationDragging = ref(false)
// 子会话已迁入侧区，主区不再有第二栏，工作区恒为单列（不再按 activeTask 切三列 grid）
const workspaceStyle = computed(() => ({}))
let stopConversationDividerDrag = null

watch(
  () => props.teamId,
  (id, oldId) => {
    if (oldId && String(oldId) !== String(id)) {
      soloTeamStore.unsubscribeOnePersonTeamEvents(oldId)
      soloTeamStore.closeOnePersonTask(oldId)
    }
    if (id) {
      soloTeamStore.setCurrentOnePersonTeamId(id)
      void soloTeamStore.loadOnePersonTeamDetail(id, { force: false })
      void soloTeamStore.loadPrivateAgentsForTeam({ force: false })
      void soloTeamStore.loadOnePersonTeamRuntime(id, { force: false })
    }
  },
  { immediate: true },
)

watch(
  () => activeTaskThreadId.value,
  (threadId) => {
    if (teamKey.value && threadId && !soloTeamStore.onePersonRuntimeFallbackByTeamId[teamKey.value]) {
      void soloTeamStore.loadOnePersonThreadMessages(teamKey.value, threadId, {
        force: false,
        taskId: activeTask.value?.id,
      })
    }
  },
  { immediate: true },
)

watch(
  () => Boolean(activeTask.value),
  (hasTask) => {
    if (!hasTask && stopConversationDividerDrag) stopConversationDividerDrag(false)
  },
)

onBeforeUnmount(() => {
  if (stopConversationDividerDrag) stopConversationDividerDrag(false)
  document.removeEventListener('dragstart', blockDragStart, true)
  if (teamKey.value) soloTeamStore.unsubscribeOnePersonTeamEvents(teamKey.value)
})

function readStoredRatio(key, fallback) {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function resolveTaskId(taskRef) {
  const rawTaskId = taskRef && typeof taskRef === 'object'
    ? (taskRef.taskId ?? taskRef.task_id ?? taskRef.id)
    : taskRef
  if (rawTaskId) return rawTaskId

  const executionThreadId = taskRef && typeof taskRef === 'object'
    ? (taskRef.executionThreadId ?? taskRef.execution_thread_id ?? taskRef.threadId ?? taskRef.thread_id)
    : ''
  if (!executionThreadId) return ''
  const task = soloTeamStore.getOnePersonTasks(teamKey.value).find(item =>
    String(item.executionThreadId || item.threadId || '') === String(executionThreadId)
  )
  return task?.id || ''
}

function openTaskById(taskRef) {
  if (!teamKey.value || !taskRef) return
  const taskId = resolveTaskId(taskRef)
  // 子会话在侧区 tasks 槽下钻展示：打开该任务并把侧区切到 tasks
  if (taskId) {
    soloTeamStore.openOnePersonTask(teamKey.value, taskId)
    sidePanel.open('tasks')
  }
  if (!soloTeamStore.getOnePersonActiveTask(teamKey.value)) {
    void soloTeamStore.loadOnePersonTeamTasks(teamKey.value, { force: true }).then(() => {
      const nextTaskId = resolveTaskId(taskRef)
      if (nextTaskId) soloTeamStore.openOnePersonTask(teamKey.value, nextTaskId)
    })
  }
}

function closeTask() {
  soloTeamStore.closeOnePersonTask(teamKey.value)
}

function sendMainMessage(payload) {
  void soloTeamStore.sendOnePersonMainMessage(teamKey.value, payload)
}

function sendTaskMessage(payload) {
  if (!activeTask.value) return
  void soloTeamStore.sendOnePersonTaskMessage(teamKey.value, activeTask.value.id, payload)
}

function loadMoreMainMessages() {
  if (!teamKey.value || !mainThread.value?.id || !mainThreadState.value?.hasMore) return
  void soloTeamStore.loadOnePersonThreadMessages(teamKey.value, mainThread.value.id, {
    beforeSeq: mainThreadState.value.nextBeforeSeq,
  })
}

function loadMoreTaskMessages() {
  if (!teamKey.value || !activeTask.value || !activeTaskThreadId.value || !activeTaskThreadState.value?.hasMore) return
  void soloTeamStore.loadOnePersonThreadMessages(teamKey.value, activeTaskThreadId.value, {
    taskId: activeTask.value.id,
    beforeSeq: activeTaskThreadState.value.nextBeforeSeq,
  })
}

function paneElement(paneRef) {
  return paneRef.value?.$el || paneRef.value || null
}

function getConversationMinWidth() {
  const mainEl = paneElement(mainPaneRef)
  const cssMinWidth = Number.parseFloat(mainEl ? getComputedStyle(mainEl).minWidth : '')
  return Number.isFinite(cssMinWidth) && cssMinWidth > 0 ? cssMinWidth : conversationMinWidth
}

function blockDragStart(ev) {
  ev.preventDefault()
  ev.stopPropagation()
}

function startConversationDividerDrag(e) {
  e.preventDefault()
  if (!activeTask.value) return
  if (stopConversationDividerDrag) stopConversationDividerDrag(false)

  const mainEl = paneElement(mainPaneRef)
  const taskEl = paneElement(taskPaneRef)
  const minWidth = getConversationMinWidth()
  const startMainWidth = mainEl?.getBoundingClientRect?.().width || minWidth
  const startTaskWidth = taskEl?.getBoundingClientRect?.().width || minWidth
  const totalWidth = Math.max(minWidth * 2, startMainWidth + startTaskWidth)
  const startX = e.clientX
  let rafId = null
  isConversationDragging.value = true

  document.addEventListener('dragstart', blockDragStart, true)

  function onMouseMove(event) {
    if (rafId) return
    const clientX = event.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = clientX - startX
      const nextMainWidth = Math.max(
        minWidth,
        Math.min(totalWidth - minWidth, startMainWidth + delta),
      )
      const nextTaskWidth = Math.max(minWidth, totalWidth - nextMainWidth)
      mainPaneRatio.value = Number((nextMainWidth / totalWidth).toFixed(4))
      taskPaneRatio.value = Number((nextTaskWidth / totalWidth).toFixed(4))
    })
  }

  function onMouseUp(persist = true) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isConversationDragging.value = false
    if (persist) {
      localStorage.setItem('one-person-main-conversation-ratio', String(mainPaneRatio.value))
      localStorage.setItem('one-person-task-conversation-ratio', String(taskPaneRatio.value))
    }
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('dragstart', blockDragStart, true)
    stopConversationDividerDrag = null
  }

  stopConversationDividerDrag = onMouseUp
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
/* 子会话「弹出」动画：右侧滑入 + 轻微缩放，替代闪现 */
.task-pane-pop-enter-active {
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.24s ease;
}
.task-pane-pop-leave-active {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.task-pane-pop-enter-from {
  opacity: 0;
  transform: translateX(28px) scale(0.97);
}
.task-pane-pop-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.op-team-workspace {
  position: relative;
  flex: 1;
  min-width: var(--one-person-conversation-min-width, 360px);
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(var(--one-person-conversation-min-width, 360px), 1fr);
  overflow-x: hidden;
  overflow-y: hidden;
  background: #f5f6f8;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 48px;
  border-radius: 16px;
  background: #fff;
  min-width: 280px;
}

.drag-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.drag-title {
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
  margin: 0;
}

.drag-hint {
  font-size: 12px;
  color: #91949e;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
  opacity: 0;
}

.op-team-workspace.has-task-pane {
  min-width: var(--one-person-workspace-task-min-width, 728px);
  grid-template-columns: minmax(var(--one-person-conversation-min-width, 360px), 1fr) 8px minmax(var(--one-person-conversation-min-width, 360px), 0.9fr);
}

.op-team-workspace :deep(.conversation-pane) {
  min-width: var(--one-person-conversation-min-width, 360px);
}

.op-team-workspace.is-conversation-dragging *:not(.conversation-divider):not(.conversation-divider *) {
  pointer-events: none !important;
  user-select: none !important;
}

.conversation-divider {
  position: relative;
  width: 8px;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 10;
  background: #f5f6f8;
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

.conversation-divider:hover .divider-line:not(.dragging) {
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

.conversation-divider:hover .divider-handle {
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
