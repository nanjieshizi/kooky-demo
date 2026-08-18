<template>
  <section v-if="task" class="conversation-pane conversation-pane--task">
    <header class="conversation-head conversation-head--task">
      <div class="conversation-title conversation-title--task">
        <span class="conversation-title-text">{{ task.title || '任务会话' }}</span>
        <span class="status-pill" :class="`status-pill--${task.status}`">
          {{ taskStatusText(task.status) }}
        </span>
        <el-tooltip v-if="goal" :content="goal" placement="bottom-start" :show-after="120" effect="light">
          <span class="task-goal-chip" tabindex="0">
            <el-icon :size="13"><Aim /></el-icon>
            <span>目标</span>
          </span>
        </el-tooltip>
      </div>
      <button type="button" class="head-icon-btn" aria-label="关闭任务会话" @click="emit('close')">
        <el-icon :size="20"><Close /></el-icon>
      </button>
    </header>

    <!-- 成员条：生产的 OnePersonTaskMemberStrip（自带执行计划卡浮层）。
         cards / plan 均由 demo 剧本经 planFromDirector 投影。 -->
    <OnePersonTaskMemberStrip
      v-if="assignees.length"
      :cards="demoMemberCards"
      :collapsed="!membersExpanded"
      :goal="goal"
      :show-plan="planVisible"
      :plan="demoPlan"
      :selected-member-id="selectedMemberId"
      @open-member="onOpenMember"
      @toggle-collapsed="membersExpanded = !membersExpanded"
      @toggle-plan="planVisible = !planVisible"
      @close-plan="planVisible = false"
    />

    <div v-if="activeTrace" class="exec-trace">
      <div class="exec-trace-head">
        <button type="button" class="exec-trace-back" @click="activeTrace = null">
          <el-icon :size="16"><ArrowLeft /></el-icon>
          <span>返回会话</span>
        </button>
        <span class="exec-trace-title">{{ activeTrace.name }} 的执行轨迹</span>
        <span class="exec-trace-readonly">只读</span>
      </div>
      <div class="exec-trace-body">
        <!-- 有编排剧本产生的真实轨迹：复用「我的员工」单聊的只读组件，视觉一致 -->
        <template v-if="liveTrace">
          <EmployeeChatReasoningBlock
            v-if="liveTrace.reasoning"
            :content="liveTrace.reasoning"
            :is-streaming="liveTrace.isReasoningStreaming"
            :default-open="true"
          />
          <EmployeeStreamToolCallCard
            v-if="liveTrace.toolSteps && liveTrace.toolSteps.length"
            :steps="liveTrace.toolSteps"
            :is-loading="liveTrace.toolsLoading"
          />
          <EmployeeTodoList :todos="liveTrace.todos" />
          <div class="exec-trace-hint">
            {{ liveTrace.done ? '执行已完成 · 需对话请返回会话' : '正在执行中 · 只读围观，需对话请返回会话' }}
          </div>
        </template>
        <!-- 无剧本轨迹（其它预置团队）：保留静态占位，避免空面板 -->
        <template v-else>
          <template v-for="(item, i) in mockTrace" :key="i">
            <div v-if="item.type === 'reasoning'" class="trace-reasoning">{{ item.text }}</div>
            <div v-else-if="item.type === 'tool'" class="trace-tool">
              <span class="trace-tool-icon" aria-hidden="true">🔧</span>
              <span class="trace-tool-name">{{ item.name }}</span>
              <span class="trace-tool-args">{{ item.args }}</span>
              <span class="trace-tool-ok" aria-hidden="true">✓</span>
            </div>
            <div v-else-if="item.type === 'todo'" class="trace-todo">
              <div v-for="(t, j) in item.items" :key="j" class="trace-todo-item" :class="{ done: t.done }">
                <span class="trace-todo-box" aria-hidden="true">{{ t.done ? '☑' : '☐' }}</span>{{ t.text }}
              </div>
            </div>
          </template>
          <div class="exec-trace-hint">仅展示执行过程（demo 占位）· 需对话请返回会话</div>
        </template>
      </div>
    </div>

    <template v-else>
      <OnePersonMessageList
        :loading="loading"
        :messages="messages"
        :thinking="thinking"
        :team-id="teamId"
        :thread-id="task?.threadId || task?.executionThreadId || task?.raw?.execution_thread_id || ''"
        :has-more="hasMore"
        :loading-more="loadingMore"
        empty-text="暂无任务会话消息"
        @load-more="emit('load-more')"
      />

      <!-- 排队条：生产的 OnePersonQueueBar，数据由 demo 的本地排队队列投影 -->
      <OnePersonQueueBar :items="queueItems" @remove="removeQueued" />

      <OnePersonComposer
        v-model="draft"
        :mention-members="mentionMembers"
        :disabled="sending"
        :disabled-text="sending ? '正在发送中…' : ''"
        :placeholder="isExecuting ? '执行中 · 发送将进入队列，当前执行后处理' : '继续补充这个任务'"
        @submit="send"
      />
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, Close, Aim } from '@element-plus/icons-vue'
import OnePersonComposer from './OnePersonComposer.vue'
import OnePersonMessageList from './OnePersonMessageList.vue'
import { taskStatusText } from './taskStatus'
import EmployeeChatReasoningBlock from '../EmployeeChatReasoningBlock.vue'
import EmployeeStreamToolCallCard from '../EmployeeStreamToolCallCard.vue'
import EmployeeTodoList from '../EmployeeTodoList.vue'
import { getExecTrace, demoState } from '../../demo/onePersonDirector'
import { memberCardsFromDirector } from '../../demo/planFromDirector.mjs'
import OnePersonTaskMemberStrip from './OnePersonTaskMemberStrip.vue'
import OnePersonQueueBar from './OnePersonQueueBar.vue'

defineOptions({ name: 'TaskConversationPane' })

const props = defineProps({
  task: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  thinking: { type: Boolean, default: false },
  mentionMembers: { type: Array, default: () => [] },
  teamId: { type: [String, Number], default: '' },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
})

const emit = defineEmits(['send', 'close', 'load-more'])
const draft = ref('')

const assignees = computed(() => (Array.isArray(props.task?.participants) ? props.task.participants : []))
// 执行计划卡：只在剧本正在演这个任务时露出（剧本 plan 快照整对象替换）
const planVisible = ref(false)
const demoPlan = computed(() => (String(demoState.taskId) === String(props.task?.id) ? demoState.plan : null))
// 一份 cards 同时喂成员条和它内部透传的计划卡
const demoMemberCards = computed(() => memberCardsFromDirector(assignees.value, memberStatus))
// 成员条按 String 严格比对，activeTrace 存的是原始 member
const selectedMemberId = computed(() => (activeTrace.value ? String(activeTrace.value.agent_id ?? activeTrace.value.id) : ''))

// 成员条 emit 的是 card（不是 id），换回原始 member 再交给既有的围观逻辑
function onOpenMember(card) {
  const m = assignees.value.find((x) => String(x.agent_id ?? x.id) === String(card?.agentId))
  if (m) toggleTrace(m)
}
const goal = computed(() => String(props.task?.goal || '').trim())
// demo：任务 active 或 thread 在跑都视为「执行中」，体现成员在干活 + 发送进队列
const isExecuting = computed(() => props.thinking || props.task?.status === 'active')
// 排队消息：{ messageId, preview }。messageId 是稳定合成 id（生产按 messageId 做 key 和删除）
const queued = ref([])
let queueSeq = 0
const queueItems = computed(() => queued.value.map((q, i) => ({ ...q, position: i + 1 })))
function removeQueued(messageId) {
  const i = queued.value.findIndex((q) => q.messageId === messageId)
  if (i >= 0) queued.value.splice(i, 1)
}
// 围观：点顶部成员头像 → 就地展开该成员只读执行轨迹（demo 占位，真实接 EmployeeChat 组件 + 后端 reasoning/tool 数据）
const activeTrace = ref(null)
const mockTrace = [
  { type: 'reasoning', text: '正在对照任务目标拆解执行步骤，并梳理已有上下文…' },
  { type: 'tool', name: 'read_file', args: 'draft-ch4.md' },
  { type: 'tool', name: 'web_search', args: 'AI agent 企业应用 2025 趋势' },
  { type: 'reasoning', text: '已收集关键资料，开始按目标契约组织结构与要点。' },
  {
    type: 'todo',
    items: [
      { text: '提取关键要点', done: true },
      { text: '组织结构草稿', done: false },
      { text: '按目标产出交付物', done: false },
    ],
  },
]

// 编排剧本产生的真实执行轨迹（demo）。命中则用真组件渲染，未命中回退静态占位。
const liveTrace = computed(() => {
  const m = activeTrace.value
  if (!m) return null
  const tid = props.task?.id
  return getExecTrace(tid, m.id) || getExecTrace(tid, m.agent_id) || getExecTrace(tid, m.agentId)
})

function toggleTrace(member) {
  // 剧本建的 participants 只有 agent_id、没有 id，只比 .id 会让两边都是 undefined
  // 而恒等 —— 点另一个成员会误关而非切换
  const key = (m) => String(m?.agent_id ?? m?.id ?? '')
  activeTrace.value = activeTrace.value && key(activeTrace.value) === key(member) ? null : member
}

const membersExpanded = ref(false)

// 成员状态：优先读编排剧本 trace（busy=执行中 / done=已完成 / 其余=待执行）；
// 无 trace（预置团队）回退到任务是否在执行。
function memberStatus(member) {
  const t = getExecTrace(props.task?.id, member?.id) || getExecTrace(props.task?.id, member?.agent_id)
  if (t) {
    if (t.busy) return 'busy'
    if (t.done) return 'done'
    return 'pending'
  }
  return isExecuting.value || member?.presence === 'busy' ? 'busy' : 'idle'
}

function send(payload) {
  if (isExecuting.value) {
    const t = String(payload?.text || '').trim()
    if (t) queued.value.push({ messageId: `demo-queued-${++queueSeq}`, preview: t })
    draft.value = ''
    return
  }
  emit('send', payload)
  draft.value = ''
}

</script>

<style scoped>
.conversation-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 8px 8px, rgba(255, 183, 180, 0.24) 1.2px, transparent 1.4px) 0 0 / 22px 22px,
    #fff;
  border-radius: 12px;
}

.conversation-head {
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  color: #2f3547;
}

.conversation-title {
  font-size: 14px;
  font-weight: 700;
}

.conversation-title--task {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.conversation-title--task > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.head-icon-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.status-pill {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: #2f76ff;
  background: #e9f2ff;
}

.status-pill--blocked {
  color: #8b95a5;
  background: #f1f3f6;
}

.status-pill--waiting_approval {
  color: #f58138;
  background: #fff1e8;
}

.status-pill--completed {
  color: #17a66a;
  background: #e9f8f0;
}

.status-pill--failed {
  color: #ff4d4f;
  background: #fff0f0;
}

.status-pill--cancelled {
  color: #ff4d4f;
  background: #fff0f0;
}

.conversation-head--task {
  border-bottom: 1px solid #f0f1f5;
}

.conversation-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.conversation-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.task-assignees {
  display: flex;
  align-items: center;
}

.task-assignee {
  position: relative;
  width: 26px;
  height: 26px;
  margin-left: -6px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
}

.task-assignee:first-child {
  margin-left: 0;
}

.task-assignee.is-active .task-assignee-avatar {
  box-shadow: 0 0 0 2px #2f76ff;
}

.task-assignee-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  background: #f2f4f7;
  border: 1.5px solid #fff;
  display: block;
}

.task-assignee-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #fff;
}

.task-assignee-dot.is-busy {
  background: #ff621f;
}

.task-assignee-dot.is-idle {
  background: #07c160;
}

.task-goal {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: #f5f7fb;
}

.task-goal-label {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  color: #2f76ff;
  background: #e9f2ff;
}

.task-goal-text {
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #4a5163;
}

/* 目标 chip：跟在标题+状态后，hover 出全文（el-tooltip） */
.task-goal-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px 2px 7px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  color: #6d7384;
  background: #f1f3f6;
  border: 0.5px solid #e3e5ea;
  cursor: default;
  outline: none;
}
.task-goal-chip .el-icon {
  color: #9aa1ad;
}
.task-goal-chip:hover,
.task-goal-chip:focus-visible {
  background: #e8eaef;
  color: #4a5163;
}

/* 任务信息面板：成员状态一行，常驻会话顶部 */
.exec-trace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.exec-trace-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 0.5px solid #eef0f4;
  flex-shrink: 0;
}

.exec-trace-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #2f76ff;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.exec-trace-title {
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
}

.exec-trace-readonly {
  margin-left: auto;
  font-size: 11px;
  color: #8b95a5;
  background: #f1f3f6;
  border-radius: 4px;
  padding: 1px 7px;
}

.exec-trace-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trace-reasoning {
  font-size: 13px;
  line-height: 1.6;
  color: #8a8f9c;
  font-style: italic;
  padding-left: 10px;
  border-left: 2px solid #e3e6ee;
}

.trace-tool {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f5f7fb;
  font-size: 13px;
}

.trace-tool-name {
  font-weight: 500;
  color: #2f3547;
}

.trace-tool-args {
  flex: 1;
  min-width: 0;
  color: #6d7384;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-tool-ok {
  color: #17a66a;
}

.trace-todo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f5f7fb;
}

.trace-todo-item {
  font-size: 13px;
  color: #2f3547;
}

.trace-todo-item.done {
  color: #8b95a5;
  text-decoration: line-through;
}

.trace-todo-box {
  margin-right: 6px;
}

.exec-trace-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #aab1bf;
  text-align: center;
}

</style>
