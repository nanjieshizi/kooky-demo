<template>
  <div v-if="plan && plan.steps.length" class="plan-card">
    <div class="plan-card__head">
      <span class="plan-card__icon">
        <img :src="planIcon" />
      </span>
      <span class="plan-card__title">执行计划</span>
      <span class="plan-card__count">{{ plan.progress.completed }}/{{ plan.progress.total }}</span>
    </div>
    <button type="button" class="plan-card__close" aria-label="关闭" @click.stop="$emit('close')">
      <el-icon :size="16"><Close /></el-icon>
    </button>
    <div class="plan-card__body">
      <div v-if="plan.revisionNote" class="plan-card__revision-note" :title="plan.revisionNote">
        {{ plan.revisionNote }}
      </div>
      <ul class="plan-card__steps">
        <li
          v-for="step in plan.steps"
          :key="step.id"
          class="plan-step"
          :class="`plan-step--${step.status}`"
        >
          <span class="plan-step__icon">
            <!-- 步状态取值来自任务图契约:pending/running/completed/failed/skipped(无 in_progress) -->
            <svgIcon name="icon-wanchengrenwu" class="svg-icon" :size="16" v-if="step.status === 'completed'" color="#07C160"/>
            <svgIcon name="icon-runing" class="svg-icon plan-step__icon--spinning" :size="16" v-else-if="step.status === 'running'" color="#436FF6"/>
            <!-- 待处理：icon-waitting 在小尺寸渲染不出，改用 CSS 空心灰圈 -->
            <span v-else class="plan-step__pending-dot" aria-hidden="true"></span>
          </span>
          <span class="plan-step__title" :title="step.title">{{ step.title }}</span>
          <img
            v-if="step.assignee"
            class="plan-step__avatar"
            :src="getAssigneeAvatar(step.assignee)"
            :alt="step.displayName"
            :title="step.displayName"
          />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// 执行计划卡:进度行(完成数/总数)+步骤打勾清单(状态图标+步骤名+承接人头像)。
// 数据源=计划快照(修订号单调,整对象替换),无步骤的任务不渲染。
import { Close } from '@element-plus/icons-vue'
import planIcon from '@/assets/soloTeam/plan.svg'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'

defineOptions({ name: 'OnePersonPlanCard' })

const props = defineProps({
  plan: { type: Object, default: null },
  memberCards: { type: Array, default: () => [] },
})

defineEmits(['close'])

function getAssigneeAvatar(assigneeId) {
  if (!assigneeId) return defaultAgentAvatar
  // 从 memberCards 中查找对应成员的头像
  const member = props.memberCards.find(card => String(card.agentId) === String(assigneeId))
  return member?.avatarUrl || defaultAgentAvatar
}

</script>

<style scoped>
.plan-card {
  /* position: relative; */
  flex: none;
  margin: 0;
  border: 1px solid #ECEEF3;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.plan-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 10px;
  background: #F5F6F950;
  height: 30px;
}

.plan-card__icon {
  flex: none;
  display: flex;
  align-items: center;
  color: #2F3547;
  img {
    width: 14px;
    height: 14px;
  }
}

.plan-card__title {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: #2f3547;
  line-height: 22px;
}

.plan-card__count {
  flex: none;
  font-size: 12px;
  color: #FF7D00;
  font-weight: 500;
  padding: 0px 6px;
  background: #fff5f4;
  border-radius: 12px;
  line-height: 20px;
}

.plan-card__close {
  position: absolute;
  top: 8px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: #91949E;
  cursor: pointer;
  border-radius: 4px;
}

.plan-card__close:hover {
  background: rgba(47, 53, 71, 0.06);
}

.plan-card__body {
  padding: 10px;
}

.plan-card__revision-note {
  padding: 4px 0 6px;
  font-size: 12px;
  color: #8c93a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-card__steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  height: 20px;
  color: #2f3547;
}

.plan-step__icon {
  flex: none;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.plan-step__icon--spinning {
  animation: plan-step-spin 1.5s linear infinite;
}

.plan-step__pending-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #c2c3c9;
  box-sizing: border-box;
}

@keyframes plan-step-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.plan-step__title {
  /* flex: 1; */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 16px;
  color: #2f3547;
}

.plan-step__avatar {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
