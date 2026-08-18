<template>
  <div
    class="collab-flow-card"
    :class="[`kind-${flowCard.kind}`, { 'is-clickable': canOpenTask }]"
    :role="canOpenTask ? 'button' : undefined"
    :tabindex="canOpenTask ? 0 : undefined"
    @click="openTask"
    @keydown.enter="onRootEnter"
  >
    <!-- 上行：标签 -->
    <div class="flow-tag" :class="`tag-${cardTone}`">
      <span class="tag-icon">{{ tagIcon }}</span>
      <span class="tag-text">{{ tagText }}</span>
    </div>

    <!-- 中行：标题（下一步/已完成步骤/回退到/任务名） -->
    <div v-if="titleText" class="flow-title">{{ titleText }}</div>

    <!-- 元信息（执行人/进度/等待人） -->
    <div v-if="metaText" class="flow-meta">{{ metaText }}</div>

    <!-- 交互提示（active 步骤的提交类型） -->
    <div v-if="actionHint" class="flow-action-hint">{{ actionHint }}</div>

    <!-- 投票选项（如果下一步是 vote 类型） -->
    <div v-if="voteOptionsView.length > 0" class="flow-vote-options">
      <!-- 未投票：可点击 -->
      <template v-if="!hasMyVote">
        <button
          v-for="opt in voteOptionsView"
          :key="opt.label"
          type="button"
          class="vote-opt"
          :disabled="voteSubmitting"
          @click.stop="onVoteOption(opt.label)"
        >
          <span class="vote-opt-text">{{ opt.label }}</span>
          <span v-if="opt.count > 0" class="vote-opt-count">{{ opt.count }} 票</span>
        </button>
      </template>
      <!-- 已投票：只读 + 横条进度 -->
      <template v-else>
        <div
          v-for="opt in voteOptionsView"
          :key="opt.label"
          class="vote-row"
          :class="{ 'is-mine': opt.isMine, 'is-winner': opt.isWinner }"
        >
          <span class="vote-row-label">
            {{ opt.label }}
            <span v-if="opt.isMine" class="vote-row-mine">✓ 我的</span>
          </span>
          <span class="vote-bar-wrap">
            <span class="vote-bar" :style="{ width: opt.percent + '%' }" />
          </span>
          <span class="vote-row-count">{{ opt.count }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'CollabFlowCard' })

import { computed, inject, ref } from 'vue'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { CURRENT_USER } from '@/dev-mocks/data/users'

const props = defineProps({
  /** flowCard payload */
  flowCard: { type: Object, required: true },
})

const taskStore = useCollabTaskStore()
const task = computed(() => taskStore.tasks[props.flowCard.taskId] || null)
const voteSubmitting = ref(false)
const collaborationBOpenTask = inject('collaborationBOpenTask', null)
const canOpenTask = computed(() => (
  typeof collaborationBOpenTask === 'function'
  && !!task.value?.id
  && !!task.value?.conversationId
))

function openTask() {
  if (!canOpenTask.value) return
  collaborationBOpenTask({
    conversationId: task.value.conversationId,
    taskId: task.value.id,
  })
}

function onRootEnter(event) {
  if (event.target !== event.currentTarget || !canOpenTask.value) return
  event.preventDefault()
  openTask()
}

/** 流转卡当前指向的 vote 步骤（含 active / done 都返回，已 done 也展示横条结果）*/
const voteStep = computed(() => {
  const fc = props.flowCard
  // 所有"涉及某个步骤"的 kind 都允许展示投票选项（如果该步骤是 vote 类型）
  if (!['created', 'advanced', 'skipped', 'back', 'next-step', 'edited', 'progress'].includes(fc.kind)) return null
  // 优先 nextStepId，否则用 editedStepId / doneStepId fallback
  const stepId = fc.nextStepId || fc.editedStepId || fc.doneStepId
  if (!stepId || !task.value) return null
  const step = task.value.steps.find((s) => s.id === stepId)
  if (!step || step.submit_type !== 'vote') return null
  // 必须有候选项才显示（没设置 vote_options 就不渲染选项区）
  if (!Array.isArray(step.vote_options) || step.vote_options.length === 0) return null
  return step
})

/** 当前用户是否已投票 */
const hasMyVote = computed(() => {
  const step = voteStep.value
  if (!step) return false
  const me = CURRENT_USER?.name
  return !!me && (step.completed_by || []).includes(me)
})

/** 每个选项的可视化数据：count / percent / isMine / isWinner */
const voteOptionsView = computed(() => {
  const step = voteStep.value
  if (!step || !Array.isArray(step.vote_options)) return []
  const counts = {}
  step.vote_options.forEach((o) => { counts[o] = 0 })
  ;(step.submissions || []).forEach((s) => {
    if (counts[s.content] !== undefined) counts[s.content]++
  })
  const total = (step.assignees || []).length || 1
  const maxVotes = Math.max(0, ...Object.values(counts))
  const me = CURRENT_USER?.name
  const myPick = (step.submissions || []).find((s) => s.by === me)?.content
  return step.vote_options.map((label) => ({
    label,
    count: counts[label] || 0,
    percent: Math.round((counts[label] / total) * 100),
    isMine: label === myPick,
    isWinner: step.status === 'done' && counts[label] === maxVotes && maxVotes > 0,
  }))
})

function onVoteOption(option) {
  if (voteSubmitting.value) return
  // 优先用 voteStep（兼容 next-step / edited / progress 等 kind 的不同字段名）
  const step = voteStep.value
  if (!step || !task.value) return
  if (step.status !== 'active') return
  voteSubmitting.value = true
  try {
    const conversationId = task.value.conversationId
    if (typeof window !== 'undefined' && window.__kookyMock?.quickVote) {
      window.__kookyMock.quickVote(conversationId, task.value.id, step.id, option)
    } else {
      taskStore.applySubmit({
        task: task.value,
        speaker: CURRENT_USER.name,
        targetStepId: step.id,
        content: option,
      })
    }
  } finally {
    voteSubmitting.value = false
  }
}

/** 4 色态映射：default / done / skip / back / abort */
const cardTone = computed(() => {
  switch (props.flowCard.kind) {
    case 'created':
    case 'advanced':
    case 'completed':
      return 'done'
    case 'skipped':
      return 'skip'
    case 'back':
      return 'back'
    case 'abort-pending':
    case 'aborted':
      return 'abort'
    case 'next-step':
    case 'progress':
    case 'edited':
    default:
      return 'default'
  }
})

const tagIcon = computed(() => {
  switch (props.flowCard.kind) {
    case 'created':   return '🚀'
    case 'advanced':  return '✅'
    case 'completed': return '🎉'
    case 'skipped':   return '⏭️'
    case 'back':      return '↩️'
    case 'abort-pending': return '⚠️'
    case 'aborted':   return '🛑'
    case 'edited':    return '✏️'
    case 'progress':  return '📍'
    case 'next-step': return '➡️'
    default:          return '➡️'
  }
})

const tagText = computed(() => {
  switch (props.flowCard.kind) {
    case 'created':   return '任务已创建'
    case 'advanced':  return '步骤已完成'
    case 'completed': return '任务已完成'
    case 'skipped':   return '步骤已跳过'
    case 'back':      return '已回退到'
    case 'abort-pending': return '终止确认'
    case 'aborted':   return '任务已取消'
    case 'edited':    return '已编辑步骤'
    case 'progress':  return '进度'
    case 'next-step': return '下一步'
    default:          return '下一步'
  }
})

/** 中部标题：根据 kind 选合适字段 */
const titleText = computed(() => {
  const fc = props.flowCard
  if (fc.kind === 'created') return task.value?.title || ''
  if (fc.kind === 'completed') return task.value?.title || ''
  if (fc.kind === 'aborted') return task.value?.title || ''
  if (fc.kind === 'abort-pending') return `确定要取消「${task.value?.title || '此任务'}」吗？`
  if (fc.kind === 'advanced' || fc.kind === 'skipped') return fc.nextStepNames || ''
  if (fc.kind === 'back') return fc.nextStepNames || ''
  if (fc.kind === 'progress') return fc.progressLabel || ''
  if (fc.kind === 'edited') return findStepName(fc.editedStepId) || ''
  if (fc.kind === 'next-step') return fc.nextStepNames || ''
  return fc.nextStepNames || ''
})

const metaText = computed(() => {
  const fc = props.flowCard
  if (fc.kind === 'created') return `共 ${task.value?.steps?.length || 0} 个步骤`
  if (fc.kind === 'completed') return '已归档'
  if (fc.kind === 'aborted') return '已归档，可在已归档列表查阅'
  if (fc.kind === 'abort-pending') return '回复【确认取消】或【不取消】'
  if (fc.kind === 'progress') {
    const remain = (fc.remainAssignees || []).map((a) => `@${a}`).join(' ')
    return remain ? `等待 ${remain}` : ''
  }
  if (fc.kind === 'edited') {
    const map = {
      assignees: '执行人已更新',
      deadline: '截止时间已更新',
      step_type: '提交类型已更新',
      vote_options: '投票选项已更新',
      name: '步骤名已更新',
      desc: '步骤描述已更新',
    }
    return map[fc.field] || `已修改：${fc.field || '?'}`
  }
  if (fc.kind === 'advanced' || fc.kind === 'skipped' || fc.kind === 'back' || fc.kind === 'next-step') {
    const list = (fc.assignees || []).map((a) => `@${a}`).join(' ')
    return list ? `执行人：${list}` : ''
  }
  return ''
})

/** 下一步的交互提示（按 submit_type） */
const actionHint = computed(() => {
  const fc = props.flowCard
  if (!['created', 'advanced', 'skipped', 'back', 'next-step'].includes(fc.kind)) return ''
  const stepId = fc.nextStepId
  if (!stepId || !task.value) return ''
  const step = task.value.steps.find((s) => s.id === stepId)
  if (!step) return ''
  // 投票场景下面会展示选项，不重复提示"请投票"
  if (step.submit_type === 'vote') return ''
  const hints = {
    confirm: '✅ 请回复确认完成',
    text: '📝 请输入具体内容',
    file: '📎 请上传相关文件',
  }
  return hints[step.submit_type] || ''
})

function findStepName(stepId) {
  if (!stepId || !task.value) return ''
  return task.value.steps.find((s) => s.id === stepId)?.name || ''
}
</script>

<style scoped>
.collab-flow-card {
  margin-top: 8px;
  padding: 10px 12px;
  background: #F7F9FF;
  border: 1px solid #D4E5FF;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  max-width: 480px;
}

.collab-flow-card.is-clickable {
  cursor: pointer;
}

.collab-flow-card.is-clickable:focus-visible {
  outline: 2px solid rgba(67, 111, 246, 0.45);
  outline-offset: 2px;
}

/* 4 色态背景 + 边框 */
.collab-flow-card.kind-created,
.collab-flow-card.kind-advanced,
.collab-flow-card.kind-completed {
  background: #F0F9F4;
  border-color: #D4E8DC;
}
.collab-flow-card.kind-skipped {
  background: #F7F8FA;
  border-color: #E5E6EB;
}
.collab-flow-card.kind-back {
  background: #FFF7F0;
  border-color: #FFD8B8;
}
.collab-flow-card.kind-abort-pending,
.collab-flow-card.kind-aborted {
  background: #FFF3F3;
  border-color: #FFCCCC;
}

.flow-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.flow-tag.tag-done    { color: #57BC66; }
.flow-tag.tag-skip    { color: #86909C; }
.flow-tag.tag-back    { color: #FF6B00; }
.flow-tag.tag-abort   { color: #F53F3F; }
.flow-tag.tag-default { color: #436FF6; }

.tag-icon {
  font-size: 12px;
}

.flow-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D2129;
  margin-top: 2px;
}

.flow-meta {
  font-size: 12px;
  color: #86909C;
  margin-top: 2px;
}

.flow-action-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #4E5969;
  padding: 4px 8px;
  background: rgba(67, 111, 246, 0.08);
  border-radius: 4px;
  display: inline-block;
}

/* ── 投票选项 ── */
.flow-vote-options {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vote-opt {
  padding: 8px 12px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 13px;
  color: #1D2129;
  cursor: pointer;
  font-weight: 500;
  text-align: left;
  transition: all 0.15s ease;
  font-family: inherit;
}
.vote-opt:hover:not(:disabled) {
  border-color: #436FF6;
  background: #F7F9FF;
  color: #436FF6;
}
.vote-opt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vote-opt-text {
  pointer-events: none;
  flex: 1;
}

.vote-opt-count {
  pointer-events: none;
  font-size: 11px;
  color: #86909C;
  font-weight: 400;
}

.vote-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* ── 已投票：横条结果 ── */
.vote-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.vote-row-label {
  flex: 1 1 0;
  font-size: 13px;
  color: #1D2129;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.vote-row.is-winner .vote-row-label {
  color: #57BC66;
  font-weight: 500;
}

.vote-row-mine {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #E8F2FE;
  color: #436FF6;
  font-weight: 500;
  flex-shrink: 0;
}

.vote-bar-wrap {
  flex: 1 1 0;
  height: 6px;
  background: #E5E6EB;
  border-radius: 3px;
  overflow: hidden;
  min-width: 60px;
}

.vote-bar {
  display: block;
  height: 100%;
  background: #436FF6;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.vote-row.is-winner .vote-bar {
  background: #57BC66;
}

.vote-row-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #86909C;
  min-width: 20px;
  text-align: right;
}
</style>
