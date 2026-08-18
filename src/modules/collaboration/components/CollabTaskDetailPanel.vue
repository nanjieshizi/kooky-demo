<template>
  <div
    v-if="task"
    class="collab-task-detail-panel"
    :class="{
      'collab-task-detail-panel--embedded': props.embedded,
      'collab-task-detail-panel--inline': props.inline,
      'collab-task-detail-panel--split': props.split,
    }"
  >
    <header v-if="!props.inline" class="panel-header">
      <div class="header-title">
        <span class="task-emoji">{{ task.emoji || '📋' }}</span>
        <h3 class="task-title">{{ displayTaskTitle }}</h3>
        <span class="task-status-tag" :class="`tag-${task.status}`">
          {{ statusLabel(task.status) }}
        </span>
      </div>
      <button v-if="!props.split" class="panel-close" :aria-label="props.embedded ? '返回协作任务列表' : '关闭'" @click="close">
        <svg v-if="props.embedded" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="#86909C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="panel-scroll custom-scrollbar">
      <!-- 协作流程时间线：复用生产 collaboration-flow 组件，喂 flowFromTask 适配后的数据 -->
      <FlowTimeline :nodes="flow.nodes" :conversation-id="flow.conversationId">
        <!-- demo 增量：在每个「当前用户可执行」的节点下挂「⚡ 分派到 Kode」按钮 -->
        <template #actions="{ node }">
          <button
            v-if="canDispatchNode(node)"
            type="button"
            class="btn-create-task"
            @click.stop="openDispatch(stepForNode(node))"
          >
            <span class="btn-icon">⚡</span>
            <span>分派到 Kode</span>
          </button>
        </template>
      </FlowTimeline>
    </div>

    <!-- 分派弹窗（分派到一人团队 / Kode） -->
    <CollabDispatchDialog
      v-model:visible="dispatchVisible"
      :task="task"
      :step="dispatchStep"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'CollabTaskDetailPanel' })

import { computed, ref } from 'vue'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useGroupStore } from '@/modules/group/store'
import CollabDispatchDialog from './CollabDispatchDialog.vue'
import FlowTimeline from '@/modules/collaboration-flow/components/FlowTimeline.vue'
import { flowFromTask } from '@/modules/collaboration/utils/flowFromTask.mjs'
import { CURRENT_USER, COLLEAGUES } from '@/dev-mocks/data/users'

const props = defineProps({
  conversationId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
  split: { type: Boolean, default: false },
})

const taskStore = useCollabTaskStore()
const groupStore = useGroupStore()

const currentGroupId = computed(() =>
  props.conversationId
  || groupStore.currentSpaceId
  || groupStore.currentConversationId
  || ''
)

const task = computed(() => {
  const cid = currentGroupId.value
  return cid ? taskStore.currentTaskByGroup(cid) : null
})

const displayTaskTitle = computed(() => {
  const title = String(task.value?.title || '未命名任务').trim()
  const emoji = String(task.value?.emoji || '').trim()
  return emoji && title.startsWith(emoji)
    ? title.slice(emoji.length).trimStart()
    : title
})

/** 执行人名 → 生产 executor member 形状（带真实头像，跟 demo 用户池对齐） */
const userByName = computed(() => {
  const map = new Map()
  for (const u of [CURRENT_USER, ...COLLEAGUES]) {
    if (u?.name) map.set(u.name, u)
  }
  return map
})

function resolveMember(name) {
  const u = userByName.value.get(name)
  if (!u) return { participantId: name, username: name, name, avatar: '' }
  return {
    participantId: u.userId || name,
    username: u.userName || name,
    name: u.name || name,
    avatar: u.avatar || '',
  }
}

/** taskStore.task → 生产标准化 flow（详情面板渲染源，taskStore 仍是唯一真相） */
const flow = computed(() => {
  if (!task.value) return { nodes: [], conversationId: '' }
  return flowFromTask(task.value, { resolveMember })
})

/** 流程节点回指原 step（节点带 __stepId） */
function stepForNode(node) {
  const id = node?.__stepId
  if (!id || !task.value) return null
  return task.value.steps.find((s) => s.id === id) || null
}

/* ── 分派到 Kode（demo 专属，生产无此按钮） ── */
const dispatchVisible = ref(false)
const dispatchStep = ref(null)

/** 当前用户能否对此步骤发起"分派"：步骤 active + 我是执行人 + 我还没响应 */
function canCreateTaskFor(step) {
  if (!step) return false
  if (step.status !== 'active') return false
  const me = CURRENT_USER?.name
  if (!me) return false
  if (!(step.assignees || []).includes(me)) return false
  if ((step.completed_by || []).includes(me)) return false
  if ((step.skipped_by || []).includes(me)) return false
  return true
}

function canDispatchNode(node) {
  return canCreateTaskFor(stepForNode(node))
}

function openDispatch(step) {
  if (!step) return
  dispatchStep.value = step
  dispatchVisible.value = true
}

function statusLabel(status) {
  switch (status) {
    case 'in_progress': return '进行中'
    case 'completed': return '已完成'
    case 'aborted': return '已取消'
    default: return status || '—'
  }
}

function close() {
  const cid = currentGroupId.value
  if (cid) taskStore.toggleDetailPanel(cid, false)
}
</script>

<style scoped>
.collab-task-detail-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #FFFFFF;
  overflow: hidden;
}
.collab-task-detail-panel--inline {
  height: auto;
  overflow: visible;
  background: transparent;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #F2F3F5;
  gap: 8px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.task-emoji {
  font-size: 16px;
  flex-shrink: 0;
}

.task-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #E8F2FE;
  color: #436FF6;
}
.task-status-tag.tag-completed { background: #E8F5E9; color: #57BC66; }
.task-status-tag.tag-aborted   { background: #F2F3F5; color: #86909C; }

.panel-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  flex-shrink: 0;
}
.panel-close:hover { background: #F7F8FA; }

.panel-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 20px 16px;
}
.collab-task-detail-panel--inline .panel-scroll {
  flex: none;
  min-height: auto;
  overflow: visible;
  padding: 7px 14px 14px 30px;
}
.collab-task-detail-panel--inline :deep(.flow-timeline) {
  flex: none;
  min-height: auto;
  margin-right: 0;
  padding-top: 6px;
  padding-right: 0;
  overflow: visible;
}

/* ── 分派按钮（轻量、挂在节点下方） ── */
.btn-create-task {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  padding: 2px 8px;
  background: rgba(123, 91, 255, 0.08);
  color: #7B5BFF;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  white-space: nowrap;
  height: 22px;
}
.btn-create-task:hover {
  background: rgba(123, 91, 255, 0.16);
  color: #5E3FD9;
}

.btn-icon {
  font-size: 11px;
  line-height: 1;
}
</style>
