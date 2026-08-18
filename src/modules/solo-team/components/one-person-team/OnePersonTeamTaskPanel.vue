<template>
  <div
    class="one-person-task-panel"
    :class="{ 'is-dragging': isLeftDragging }"
    :style="panelStyle"
  >
    <div
      class="divider left-divider"
      :class="{ dragging: isLeftDragging }"
      @mousedown="startLeftDividerDrag"
    >
      <div class="divider-line" :class="{ dragging: isLeftDragging }"></div>
      <div class="divider-handle" :class="{ dragging: isLeftDragging }">
        <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
        <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
      </div>
    </div>

    <aside class="task-panel-body" aria-label="一人团队任务">
      <header class="panel-header">
        <span class="panel-title">任务</span>
        <el-tooltip content="关闭" placement="top">
          <button
            type="button"
            class="panel-icon-btn close-panel-btn"
            aria-label="关闭任务面板"
            @click="uiStore.setActiveToolTab('task')"
          >
            <img :src="closeIcon" width="16" height="16" alt="" />
          </button>
        </el-tooltip>
      </header>

      <div v-if="loading" class="task-panel-state">
        <span class="state-spinner" />
        <span>加载任务...</span>
      </div>

      <div v-else-if="error" class="task-panel-state task-panel-state--error">
        <span>{{ error }}</span>
        <button type="button" class="retry-btn" @click="loadTaskSidebar(true)">重新加载</button>
      </div>

      <div v-else class="task-tree">
        <div
          class="root-row"
          role="button"
          tabindex="0"
          :aria-expanded="rootExpanded"
          @click="toggleRoot"
          @keydown.enter.prevent="toggleRoot"
          @keydown.space.prevent="toggleRoot"
        >
          <img :src="teamAssistantAvatar" alt="" class="root-avatar" />
          <span class="text-13px font-600 text-#2F3547">一人团队</span>
          <img
            :src="cloudCategoryIcon"
            class="root-caret"
            :class="{ expanded: rootExpanded }"
            width="8"
            height="8"
            alt=""
          />
        </div>

        <template v-if="rootExpanded">
          <div v-if="groups.length === 0" class="task-empty task-empty--root">暂无任务</div>
          <template v-else>
            <section v-for="group in groups" :key="group.id" class="team-task-group">
              <div class="team-row">
                <button
                  type="button"
                  class="team-row-toggle"
                  :aria-label="expandedGroups[group.id] ? '折叠团队任务' : '展开团队任务'"
                  @click="toggleGroup(group.id)"
                >
                  <img
                    :src="expandedGroups[group.id] ? expandIcon : collapseIcon"
                    class="team-row-caret"
                    width="14"
                    height="14"
                    alt=""
                  />
                </button>
                <button
                  type="button"
                  class="team-row-main"
                  @click="toggleGroup(group.id)"
                >
                  <img
                    :src="folderIcon"
                    class="team-row-folder"
                    width="16"
                    height="16"
                    alt=""
                  />
                  <span class="text-13px font-400 text-#2F3547">{{ group.name }}</span>
                </button>
              </div>

              <div v-if="expandedGroups[group.id]" class="task-list">
                <div v-if="group.tasks.length === 0" class="task-empty">暂无任务</div>
                <template v-else>
                  <button
                    v-for="(task, taskIndex) in group.tasks"
                    :key="task.id"
                    type="button"
                    class="task-row"
                    :class="{ active: isTaskActive(group, task) }"
                    @click="openTask(group, task)"
                  >
                    <span class="task-emoji">{{ taskListEmoji(task, taskIndex) }}</span>
                    <span class="task-title">{{ task.title }}</span>
                    <TaskStatusIcon v-if="task.status" :status="task.status" />
                  </button>
                </template>
              </div>
            </section>
          </template>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import closeIcon from '@/assets/home/close.svg'
import dragIcon from '@/assets/home/drag.svg'
import dragHoverIcon from '@/assets/home/dragHover.svg'
import cloudCategoryIcon from '@/assets/home/cloud-category.svg'
import collapseIcon from '@/assets/home/collapse.svg'
import expandIcon from '@/assets/home/expand.svg'
import folderIcon from '@/assets/home/folderTree.svg'
import teamAssistantAvatar from '@/assets/home/one-team.png'
import TaskStatusIcon from './TaskStatusIcon.vue'

defineOptions({ name: 'OnePersonTeamTaskPanel' })

const emit = defineEmits(['width-change'])
const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()

const expandedGroups = reactive({})
const rootExpanded = ref(false)
const groups = computed(() => soloTeamStore.getOnePersonTaskSidebarGroups())
const loading = computed(() => soloTeamStore.onePersonTaskSidebarLoading)
const error = computed(() => soloTeamStore.onePersonTaskSidebarError)
const activeTaskCategoryKey = computed(() => (uiStore.activePrimaryNav === 'solo-team' ? 'solo-team' : null))
const taskEmojiOptions = ['📋', '🚚', '🎨', '🧩', '💭', '⏳']
const dividerWidth = 8
const minPanelWidth = 260
const maxPanelWidth = 600
const panelWidth = ref(Math.max(minPanelWidth, Number(localStorage.getItem('one-person-task-panel-width')) || minPanelWidth))
const isLeftDragging = ref(false)
const panelTotalWidth = computed(() => panelWidth.value + dividerWidth)
const panelStyle = computed(() => ({
  width: `${panelTotalWidth.value}px`,
}))
let stopLeftDividerDrag = null

onMounted(() => {
  void loadTaskSidebar(true)
})

watch(
  groups,
  (list) => {
    for (const group of list) {
      if (expandedGroups[group.id] === undefined) expandedGroups[group.id] = false
    }
  },
  { immediate: true },
)

watch(
  activeTaskCategoryKey,
  (key) => {
    rootExpanded.value = key === 'solo-team'
    if (key === 'solo-team') void loadTaskSidebar(false)
  },
  { immediate: true },
)

watch(
  panelTotalWidth,
  (width) => emit('width-change', width),
  { immediate: true },
)

async function loadTaskSidebar(force = false) {
  await soloTeamStore.loadOnePersonTaskSidebar({ force })
}

function toggleGroup(groupId) {
  expandedGroups[groupId] = !expandedGroups[groupId]
}

function toggleRoot() {
  rootExpanded.value = !rootExpanded.value
}

function openTeam(group) {
  if (!group?.teamId) return
  soloTeamStore.activateOnePersonTeamRuntime(group.teamId)
  soloTeamStore.closeOnePersonTask(group.teamId)
  uiStore.expandSidebar()
  uiStore.setActiveNavigation('solo-team', `team:${group.teamId}`)
  void soloTeamStore.loadOnePersonTeamRuntime(group.teamId, { force: false })
}

function openTask(group, task) {
  if (!group?.teamId || !task?.id) return
  soloTeamStore.activateOnePersonTeamRuntime(group.teamId)
  soloTeamStore.openOnePersonTask(group.teamId, task.id)
  uiStore.expandSidebar()
  uiStore.setActiveNavigation('solo-team', `team:${group.teamId}`)
  void soloTeamStore.loadOnePersonTeamRuntime(group.teamId, { force: false })
}

function isTaskActive(group, task) {
  if (!group?.teamId || !task?.id) return false
  return String(soloTeamStore.currentTeamId) === String(group.teamId)
    && String(soloTeamStore.onePersonActiveTaskIdByTeamId[String(group.teamId)] || '') === String(task.id)
}

function taskListEmoji(task, index = 0) {
  const key = `${task?.id ?? ''}:${task?.title ?? ''}:${index}`
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i)
    hash |= 0
  }
  return taskEmojiOptions[Math.abs(hash) % taskEmojiOptions.length]
}

function blockDragStart(ev) {
  ev.preventDefault()
  ev.stopPropagation()
}

function startLeftDividerDrag(e) {
  e.preventDefault()
  if (stopLeftDividerDrag) stopLeftDividerDrag(false)
  isLeftDragging.value = true
  const startX = e.clientX
  const startWidth = panelWidth.value
  let rafId = null

  document.addEventListener('dragstart', blockDragStart, true)

  function onMouseMove(event) {
    if (rafId) return
    const clientX = event.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = startX - clientX
      panelWidth.value = Math.max(minPanelWidth, Math.min(maxPanelWidth, startWidth + delta))
    })
  }

  function onMouseUp(persist = true) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isLeftDragging.value = false
    if (persist) localStorage.setItem('one-person-task-panel-width', panelWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('dragstart', blockDragStart, true)
    stopLeftDividerDrag = null
  }

  stopLeftDividerDrag = onMouseUp
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

onBeforeUnmount(() => {
  if (stopLeftDividerDrag) stopLeftDividerDrag(false)
  document.removeEventListener('dragstart', blockDragStart, true)
})
</script>

<style scoped>
.one-person-task-panel {
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: visible;
  background: var(--bg-primary);
}

.one-person-task-panel.is-dragging *:not(.left-divider):not(.left-divider *) {
  pointer-events: none !important;
  user-select: none !important;
}

.task-panel-body {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px 0 0 12px;
  background: #fff;
  border-right: 1.5px solid var(--bg-primary, #F4F5F5);
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

.panel-header {
  height: 48px;
  min-height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  font-family: PingFang SC, sans-serif;
}

.panel-icon-btn {
  appearance: none;
  -webkit-appearance: none;
  width: 28px;
  height: 28px;
  margin: 0;
  border: 0;
  outline: 0;
  border-radius: 6px;
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  box-shadow: none;
  font: inherit;
}

.panel-icon-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.task-tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 10px 16px;
}

.task-tree::-webkit-scrollbar {
  width: 4px;
}

.task-tree::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}

.task-panel-state {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #8d93a6;
  font-size: 14px;
  text-align: center;
}

.task-panel-state p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #a2a8b8;
}

.task-panel-state--error {
  color: #ff4d4f;
}

.state-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #dbe3f2;
  border-top-color: #2f8fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.retry-btn {
  appearance: none;
  -webkit-appearance: none;
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e1e5ee;
  border-radius: 7px;
  background: #fff;
  color: #2f3547;
  cursor: pointer;
  font-size: 13px;
}

.root-row,
.team-row,
.task-row,
.team-row-toggle,
.team-row-main {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #2F3547;
  cursor: pointer;
  text-align: left;
  width: 100%;
  box-shadow: none;
  box-sizing: border-box;
  font: inherit;
  user-select: none;
}

.root-row:focus,
.team-row:focus,
.task-row:focus,
.team-row-toggle:focus,
.team-row-main:focus,
.panel-icon-btn:focus {
  outline: 0;
  box-shadow: none;
}

.root-row {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 4px;
  border-radius: 6px;
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.root-row:hover,
.team-row:hover,
.task-row:hover {
  background: rgba(47, 53, 71, 0.06);
  border-radius: 8px;
}

.root-avatar {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.root-caret {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.root-caret.expanded {
  transform: rotate(180deg);
}

.team-task-group {
  margin-bottom: 2px;
}

.team-row {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 0 0 21px;
  margin: 0;
}

.team-row-toggle {
  width: 20px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.team-row-main {
  min-width: 0;
  height: 32px;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px 0 2px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 400;
}

.team-row-caret,
.team-row-folder {
  flex-shrink: 0;
}

.team-row-main span,
.task-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #2F3547;
}

.task-list {
  margin-top: 2px;
}

.task-empty {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 10px 0 66px;
  box-sizing: border-box;
  font-size: 12px;
  color: #8C93A6;
}

.task-empty--root {
  padding-left: 24px;
}

.task-row {
  height: 32px;
  display: grid;
  grid-template-columns: max-content 1fr 22px;
  align-items: center;
  column-gap: 6px;
  padding: 0 10px 0 66px;
  border-radius: 8px;
}

.task-row.active {
  background: #FFF1E8;
}

.task-emoji {
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
}

.task-title {
  font-size: 13px;
  font-weight: 400;
  color: #2F3547;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
