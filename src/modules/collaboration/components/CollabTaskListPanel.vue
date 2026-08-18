<template>
  <div class="collab-task-list-panel">
    <header class="panel-header">
      <h3 class="panel-title">任务</h3>
      <button class="panel-close" aria-label="关闭" @click="close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="panel-scroll custom-scrollbar">
      <!-- 一人团队组（占位，未来扩展）-->
      <section class="task-group">
        <header class="group-header" @click="soloOpen = !soloOpen">
          <svg class="group-caret" :class="{ expanded: soloOpen }" width="10" height="10" viewBox="0 0 10 10">
            <path d="M3 1 L7 5 L3 9" stroke="#86909C" stroke-width="1.5" fill="none" stroke-linecap="round" />
          </svg>
          <span class="group-icon">🧑</span>
          <span class="group-name">一人团队</span>
        </header>
        <div v-if="soloOpen" class="group-empty">尚无一人团队任务</div>
      </section>

      <!-- 协作组 -->
      <section class="task-group">
        <header class="group-header" @click="collabOpen = !collabOpen">
          <svg class="group-caret" :class="{ expanded: collabOpen }" width="10" height="10" viewBox="0 0 10 10">
            <path d="M3 1 L7 5 L3 9" stroke="#86909C" stroke-width="1.5" fill="none" stroke-linecap="round" />
          </svg>
          <span class="group-icon">🤝</span>
          <span class="group-name">协作</span>
        </header>

        <div v-if="collabOpen" class="group-body">
          <!-- 进行中 -->
          <div v-if="activeTasks.length > 0" class="sub-section">
            <div class="sub-header">进行中</div>
            <button
              v-for="task in activeTasks"
              :key="task.id"
              type="button"
              class="task-item"
              :class="{ active: isActiveTask(task) }"
              @click="selectTask(task)"
            >
              <span class="task-emoji">{{ task.emoji || '📋' }}</span>
              <span class="task-title">{{ task.title }}</span>
              <span class="task-status status-in-progress" title="进行中">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#86909C" stroke-width="1.5" />
                  <path d="M12 7v5l3 2" stroke="#86909C" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </span>
            </button>
          </div>

          <!-- 已归档 -->
          <div v-if="archivedTasks.length > 0" class="sub-section">
            <div class="sub-header">已归档</div>
            <button
              v-for="task in archivedTasks"
              :key="task.id"
              type="button"
              class="task-item"
              :class="{ active: isActiveTask(task) }"
              @click="selectTask(task)"
            >
              <span class="task-emoji">{{ task.emoji || '📋' }}</span>
              <span class="task-title">{{ task.title }}</span>
              <span class="task-status status-archived" :title="task.status === 'aborted' ? '已取消' : '已完成'">
                <svg v-if="task.status === 'aborted'" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#C9CDD4" />
                  <path d="M7 12h10" stroke="#fff" stroke-width="2" stroke-linecap="round" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#57BC66" />
                  <path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </button>
          </div>

          <!-- 空态 -->
          <div v-if="activeTasks.length === 0 && archivedTasks.length === 0" class="group-empty">
            在协作群里 @团队助手 创建第一个任务
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'CollabTaskListPanel' })

import { ref, computed } from 'vue'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'

const taskStore = useCollabTaskStore()
const uiStore = useUIStore()
const groupStore = useGroupStore()

const soloOpen = ref(false)
const collabOpen = ref(true)

// 协作组任务来自 collabTaskStore 全局
const activeTasks = computed(() => taskStore.activeTasksAll)
const archivedTasks = computed(() => taskStore.archivedTasksAll)

const currentGroupId = computed(() => groupStore.currentSpaceId || groupStore.currentConversationId)
const activeTaskId = computed(() =>
  currentGroupId.value ? taskStore.activeTaskByGroup[currentGroupId.value] : null
)

function isActiveTask(task) {
  return activeTaskId.value === task.id
}

function selectTask(task) {
  if (!task) return
  // 切到任务所属群 + 选中
  if (task.conversationId && task.conversationId !== currentGroupId.value) {
    uiStore.setActiveNavigation('collaboration', task.conversationId)
  }
  taskStore.setActiveTask(task.conversationId, task.id)
  taskStore.toggleDetailPanel(task.conversationId, true)
}

function close() {
  uiStore.setActiveToolTab(null)
}

function submitTypeLabel(type) {
  switch (type) {
    case 'confirm': return '✅ 确认'
    case 'text': return '📝 提交文本'
    case 'file': return '📎 上传文件'
    case 'vote': return '🗳️ 投票'
    default: return type || '—'
  }
}
</script>

<style scoped>
.collab-task-list-panel {
  display: flex;
  flex-direction: column;
  width: 280px;
  height: 100%;
  background: #FFFFFF;
  border-left: 1px solid #E5E6EB;
  border-radius: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #F2F3F5;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
}

.panel-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}
.panel-close:hover {
  background: #F7F8FA;
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.task-group {
  padding: 4px 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: #4E5969;
  font-weight: 500;
}
.group-header:hover {
  background: #FAFBFC;
}

.group-caret {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.group-caret.expanded {
  transform: rotate(90deg);
}

.group-icon {
  font-size: 14px;
}

.group-body {
  padding: 0 6px;
}

.sub-section {
  margin: 8px 0;
}

.sub-header {
  padding: 4px 12px;
  font-size: 11px;
  color: #86909C;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: #1D2129;
  margin: 1px 0;
}
.task-item:hover {
  background: #FAFBFC;
}
.task-item.active {
  background: #FFF1ED;
}

.task-emoji {
  font-size: 14px;
  flex-shrink: 0;
}

.task-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.group-empty {
  padding: 16px 24px;
  color: #C9CDD4;
  font-size: 12px;
  line-height: 1.6;
}

/* ── 选中任务 inline 展开的步骤详情 ── */
.task-detail-inline {
  margin: 4px 8px 12px;
  padding: 12px;
  background: #FAFBFC;
  border-radius: 8px;
  border: 1px solid #F2F3F5;
}

.task-detail-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #F2F3F5;
}

.task-detail-emoji {
  font-size: 16px;
}

.task-detail-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #1D2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #E8F2FE;
  color: #436FF6;
}

.step-row {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px dashed #F2F3F5;
}

.step-row:first-of-type {
  border-top: none;
}

.step-icon-col {
  flex-shrink: 0;
  width: 16px;
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

.step-body {
  flex: 1;
  min-width: 0;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
  color: #1D2129;
  line-height: 1.4;
}

.step-row.step-pending .step-name {
  color: #4E5969;
}

.step-row.step-done .step-name {
  color: #57BC66;
}

.step-row.step-active .step-name {
  color: #436FF6;
}

.step-desc {
  font-size: 12px;
  color: #86909C;
  margin-top: 2px;
  line-height: 1.5;
}

.step-assignees,
.step-deadline {
  font-size: 11px;
  color: #86909C;
  margin-top: 4px;
}

.step-assignees .assignees {
  color: #4E5969;
}

.step-meta {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #F2F3F5;
  color: #4E5969;
}

.meta-chip.chip-confirm { background: #E8F5E9; color: #57BC66; }
.meta-chip.chip-text    { background: #E8F2FE; color: #436FF6; }
.meta-chip.chip-file    { background: #FFF1ED; color: #FF6B00; }
.meta-chip.chip-vote    { background: #F3E8FF; color: #9333EA; }
.meta-chip.chip-parallel { background: #FFF7E6; color: #FF8800; }
</style>
