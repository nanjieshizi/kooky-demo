<template>
  <div class="opts">
    <!-- 下钻态：子会话（复用 TaskConversationPane，自带头部，其 close = 返回列表）-->
    <TaskConversationPane
      v-if="activeTask"
      class="opts-detail"
      :task="activeTask"
      :loading="!!(activeTaskThreadState && activeTaskThreadState.loading && !activeTaskThreadState.loaded)"
      :messages="activeTaskMessages"
      :sending="activeTaskSending"
      :thinking="activeTaskThinking"
      :mention-members="[]"
      :team-id="teamId"
      :has-more="!!activeTaskThreadState?.hasMore"
      :loading-more="!!(activeTaskThreadState && activeTaskThreadState.loading && activeTaskThreadState.loaded)"
      @send="sendTaskMessage"
      @close="backToList"
      @load-more="loadMoreTaskMessages"
    />

    <!-- 列表态：本团队子任务 -->
    <template v-else>
      <header class="opts-head">
        <h3 class="opts-title">任务</h3>
        <button class="opts-close" aria-label="收起" @click="sidePanel.close()">✕</button>
      </header>
      <div class="opts-scroll">
        <template v-if="tasks.length">
          <button
            v-for="t in tasks"
            :key="t.id"
            type="button"
            class="task-card"
            @click="openTask(t)"
          >
            <span class="tc-dot" :class="'st-' + t.status"></span>
            <span class="tc-main">
              <span class="tc-title">{{ t.title || t.name || '未命名任务' }}</span>
              <span class="tc-status" :class="'st-' + t.status">{{ statusLabel(t.status) }}</span>
            </span>
            <span class="tc-arrow">›</span>
          </button>
        </template>
        <div v-else class="opts-empty">
          还没有子任务。<br />在主会话里给团队派活，会拆成子任务（子会话）。
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import TaskConversationPane from './TaskConversationPane.vue'

const soloTeamStore = useSoloTeamStore()
const sidePanel = useSidePanelStore()

const teamId = computed(() => soloTeamStore.currentOnePersonTeam?.id || '')
const tasks = computed(() => (teamId.value ? soloTeamStore.getOnePersonTasks(teamId.value) : []))
const activeTask = computed(() =>
  teamId.value ? soloTeamStore.getOnePersonActiveTask(teamId.value) : null,
)

const activeTaskMessages = computed(() =>
  activeTask.value ? soloTeamStore.getOnePersonTaskMessages(teamId.value, activeTask.value.id) : [],
)
const activeTaskThreadId = computed(
  () => activeTask.value?.threadId || activeTask.value?.executionThreadId || '',
)
const activeTaskThreadState = computed(() =>
  activeTaskThreadId.value ? soloTeamStore.getOnePersonThreadState(activeTaskThreadId.value) : null,
)
const activeTaskSending = computed(() => soloTeamStore.isOnePersonThreadSending(activeTaskThreadId.value))
const activeTaskThinking = computed(() => soloTeamStore.isOnePersonThreadThinking(activeTaskThreadId.value))

const STATUS = {
  active: '执行中',
  blocked: '受阻',
  waiting_approval: '待确认',
  completed: '已完成',
  cancelled: '已取消',
  failed: '失败',
}
function statusLabel(s) {
  return STATUS[s] || s || ''
}
function openTask(t) {
  if (teamId.value) soloTeamStore.openOnePersonTask(teamId.value, t.id)
}
function backToList() {
  if (teamId.value) soloTeamStore.closeOnePersonTask(teamId.value)
}
function sendTaskMessage(payload) {
  if (activeTask.value) {
    void soloTeamStore.sendOnePersonTaskMessage(teamId.value, activeTask.value.id, payload)
  }
}
function loadMoreTaskMessages() {
  if (!teamId.value || !activeTask.value || !activeTaskThreadId.value) return
  if (!activeTaskThreadState.value?.hasMore) return
  void soloTeamStore.loadOnePersonThreadMessages(teamId.value, activeTaskThreadId.value, {
    taskId: activeTask.value.id,
    beforeSeq: activeTaskThreadState.value.nextBeforeSeq,
  })
}

// 列表=窄、下钻子会话=宽（各记各的宽，平滑过渡）
watch(
  () => !!activeTask.value,
  (drilled) => sidePanel.setWide(drilled),
  { immediate: true },
)
</script>

<style scoped>
.opts {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.opts-detail {
  flex: 1;
  min-height: 0;
}
.opts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.opts-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.opts-close {
  border: none;
  background: transparent;
  color: var(--kk-ink-400, #9aa0aa);
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.opts-close:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}
.opts-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 16px;
}
.task-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.task-card:hover {
  border-color: var(--kk-orange-400, #ff621f);
  background: var(--kk-orange-50, rgba(255, 98, 31, 0.04));
}
.tc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--kk-ink-300, #c4c8ce);
}
.tc-dot.st-active {
  background: #ff621f;
}
.tc-dot.st-completed {
  background: #07c160;
}
.tc-dot.st-failed {
  background: #f5222d;
}
.tc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tc-title {
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tc-status {
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
}
.tc-status.st-active {
  color: #ff621f;
}
.tc-status.st-completed {
  color: #07c160;
}
.tc-status.st-failed {
  color: #f5222d;
}
.tc-arrow {
  color: var(--kk-ink-300, #c4c8ce);
  font-size: 16px;
  flex-shrink: 0;
}
.opts-empty {
  margin-top: 40px;
  text-align: center;
  font-size: 12px;
  line-height: 1.8;
  color: var(--kk-ink-400, #9aa0aa);
}
</style>
