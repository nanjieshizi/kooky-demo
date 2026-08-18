<template>
  <div v-if="normalized.length" class="flow-executors">
    <span class="flow-executors__label">执行人</span>
    <el-popover
      placement="bottom-start"
      trigger="hover"
      :width="252"
      popper-class="flow-executors-popover"
    >
      <template #reference>
        <div class="flow-executors__avatars">
          <UserAvatar
            v-for="item in visibleExecutors"
            :key="item.participantId || item.username || item.name"
            :member="item.member"
            :size="20"
            disable-card
          />
          <span v-if="overflowCount > 0" class="flow-executors__more">+{{ overflowCount }}</span>
        </div>
      </template>
      <div class="flow-executors__popover">
        <div v-for="item in normalized" :key="item.participantId || item.username || item.name" class="flow-executors__person">
          <UserAvatar :member="item.member" :size="32" disable-card />
          <div class="flow-executors__person-main">
            <span class="flow-executors__name">{{ getExecutorDisplayName(item) }}</span>
            <span
              v-if="showStatus"
              class="flow-executors__status-text"
              :class="{ pending: item.executeStatus !== 'completed' }"
            >
              {{ getExecutorStatusText(item) }}
            </span>
          </div>
          <span v-if="showStatus && item.executeStatus === 'completed'" class="flow-executors__done-mark">✓</span>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UserAvatar } from '@/shared/components/user'
import { normalizeExecutor } from '../utils/flowNodePayload.mjs'
import { formatFlowDateTime } from '../utils/flowTime.mjs'

defineOptions({ name: 'FlowExecutors' })

const props = defineProps({
  executors: { type: Array, default: () => [] },
  showStatus: { type: Boolean, default: true },
})

const normalized = computed(() => props.executors.map(normalizeExecutor))
const visibleExecutors = computed(() => normalized.value.slice(0, 4))
const overflowCount = computed(() => Math.max(0, normalized.value.length - visibleExecutors.value.length))

function formatCompletedAt(value) {
  const text = formatFlowDateTime(value)
  return text ? text.slice(0, 10) : ''
}

function getExecutorDisplayName(item) {
  const name = item.name || ''
  const username = item.username || ''
  if (name && username && name !== username) return `${name} ${username}`
  return name || username || item.participantId
}

function getExecutorStatusText(item) {
  if (item.executeStatus !== 'completed') return '待完成'
  const completedAt = formatCompletedAt(item.completedAt)
  return completedAt ? `${completedAt} 完成` : '已完成'
}
</script>

<style scoped>
.flow-executors {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 20px;
  color: #91949E;
}

.flow-executors__label {
  flex-shrink: 0;
}

.flow-executors__avatars {
  display: flex;
  align-items: center;
  min-width: 0;
}

.flow-executors__avatars :deep(.user-avatar),
.flow-executors__more {
  margin-left: -4px;
}

.flow-executors__avatars :deep(.user-avatar:first-child) {
  margin-left: 0;
}

.flow-executors__more {
  height: 20px;
  min-width: 20px;
  padding: 0 4px;
  border-radius: 10px;
  background: #ECEEF3;
  color: #606572;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
}

.flow-executors__popover {
  max-height: 296px;
  overflow: auto;
  padding: 2px 0;
}

.flow-executors__person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
}

.flow-executors__person-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.flow-executors__name {
  font-size: 13px;
  line-height: 18px;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-executors__status-text {
  font-size: 12px;
  line-height: 17px;
  color: #91949E;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-executors__status-text.pending {
  color: #ED4543;
}

.flow-executors__done-mark {
  flex-shrink: 0;
  width: 14px;
  font-size: 14px;
  line-height: 18px;
  text-align: center;
  color: #91949E;
}
</style>
