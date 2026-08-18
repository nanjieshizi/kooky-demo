<template>
  <div class="proposal-card">
    <div class="proposal-understanding">
      我理解你要做的是 <b>{{ payload.understanding }}</b>。我打算这样组队：
    </div>

    <div class="proposal-label">拟拉成员</div>
    <div class="proposal-members">
      <div
        v-for="m in members"
        :key="m.agent_id"
        class="proposal-member"
        :class="{ 'proposal-member--hire': m.status === 'need_hire' }"
      >
        <img class="proposal-avatar" :src="m.avatar || defaultAgentAvatar" alt="" @error="onAvatarError" />
        <div class="proposal-member-main">
          <span class="proposal-member-name">{{ m.name }}</span>
          <span class="proposal-member-role">{{ m.role }}</span>
        </div>
        <span v-if="m.status === 'in_team'" class="proposal-tag proposal-tag--in">在队</span>
        <span v-else-if="m.status === 'hired'" class="proposal-tag proposal-tag--hired">已聘 · 在队</span>
        <button
          v-else
          type="button"
          class="proposal-hire-btn"
          @click="onHire(m)"
        >
          <el-icon :size="13"><ShoppingCart /></el-icon>
          市场聘用
        </button>
      </div>
    </div>

    <div v-if="hasUnhired" class="proposal-hire-hint">
      <el-icon :size="12"><InfoFilled /></el-icon>
      缺一位数字分析师，聘用后即可开工
    </div>

    <div class="proposal-actions">
      <button
        type="button"
        class="proposal-confirm"
        :disabled="confirmed"
        @click="onConfirm"
      >{{ confirmed ? '已开工' : '确认开工' }}</button>
      <button
        type="button"
        class="proposal-revise"
        :disabled="confirmed"
        @click="onRevise"
      >再改改</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ShoppingCart, InfoFilled } from '@element-plus/icons-vue'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import { hireRecommendedMember, confirmTeamProposal } from '../../demo/onePersonDirector'

defineOptions({ name: 'OnePersonTeamProposalCard' })

const props = defineProps({
  payload: { type: Object, default: () => ({}) },
  teamId: { type: [String, Number], default: '' },
  threadId: { type: [String, Number], default: '' },
})

const members = computed(() => props.payload?.members || [])
const hasUnhired = computed(() => members.value.some((m) => m.status === 'need_hire'))
const confirmed = ref(false)

function onAvatarError(e) {
  e.target.src = defaultAgentAvatar
}
function onHire(m) {
  hireRecommendedMember(props.teamId, props.threadId, m.agent_id)
}
function onConfirm() {
  if (confirmed.value) return
  confirmed.value = true
  confirmTeamProposal(props.teamId, props.threadId)
}
function onRevise() {
  // demo：提示用户在输入框继续补充需求
}
</script>

<style scoped>
.proposal-card {
  max-width: 460px;
  background: #fff;
  border: 0.5px solid #eceef3;
  border-radius: 12px;
  padding: 14px;
}

.proposal-understanding {
  font-size: 13px;
  line-height: 1.6;
  color: #2f3547;
  margin-bottom: 12px;
}
.proposal-understanding b {
  font-weight: 600;
}

.proposal-label {
  font-size: 11px;
  color: #91949e;
  margin-bottom: 6px;
}

.proposal-members {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.proposal-member {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: #f7f8fb;
}
.proposal-member--hire {
  background: #fff5ef;
  border: 1px dashed #ffb493;
}

.proposal-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.proposal-member-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.proposal-member-name {
  font-size: 12px;
  font-weight: 500;
  color: #2f3547;
}
.proposal-member-role {
  font-size: 11px;
  color: #8c93a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proposal-tag {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
}
.proposal-tag--in {
  color: #07c160;
  background: #e9f8f0;
}
.proposal-tag--hired {
  color: #436ff6;
  background: #eaf0ff;
}

.proposal-hire-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 0.5px solid #ff9d6c;
  background: #fff;
  color: #ff621f;
  cursor: pointer;
  transition: background 0.15s ease;
}
.proposal-hire-btn:hover {
  background: #fff1ea;
}

.proposal-hire-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: #ff8a4c;
}

.proposal-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.proposal-confirm {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: #1c1a21;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
}
.proposal-confirm:hover:not(:disabled) {
  background: #2e323c;
}
.proposal-confirm:disabled {
  background: #c8cbd2;
  cursor: default;
}

.proposal-revise {
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 0.5px solid #dfe2ea;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
}
.proposal-revise:hover:not(:disabled) {
  background: #f5f6f9;
}
.proposal-revise:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
