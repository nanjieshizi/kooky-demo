<template>
  <button
    type="button"
    class="schedule-row"
    :class="[`status-${task.status}`, { active: active }]"
    @click="$emit('click')"
  >
    <span class="row-leading">📋</span>
    <span class="row-body">
      <span class="row-name">{{ task.name }}</span>
      <span class="row-meta">
        <span class="row-executor">{{ executorShort }}</span>
        <span class="row-sep">·</span>
        <span class="row-cycle">{{ cycleShort }}</span>
      </span>
    </span>
    <span class="row-status" :title="statusLabel">
      <!-- 运行中 -->
      <svg v-if="task.status === 'running'" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#57BC66" />
        <path d="M12 7.5v5l3 2" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      </svg>
      <!-- 已暂停 -->
      <svg v-else-if="task.status === 'paused'" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#C9CDD4" />
        <path d="M8 8h2v8H8zM14 8h2v8h-2z" fill="#fff" />
      </svg>
      <!-- 已失效 -->
      <svg v-else-if="task.status === 'invalid'" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#F53F3F" />
        <path d="M12 7v6M12 16v.5" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      </svg>
    </span>
  </button>
</template>

<script setup>
defineOptions({ name: 'ScheduleTaskRow' })

import { computed } from 'vue'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'

const props = defineProps({
  task: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

defineEmits(['click'])

const store = useScheduleStore()
const statusLabel = computed(() => store.statusLabel(props.task.status))

const executorShort = computed(() => {
  return props.task.executor?.agentName || '—'
})

const cycleShort = computed(() => {
  return props.task.cycle?.description || cycleDefaultLabel(props.task.cycle)
})

function cycleDefaultLabel(cycle) {
  if (!cycle) return ''
  if (cycle.type === 'daily') {
    const wd = (cycle.weekdays || []).join('')
    return `${cycle.time || ''} ${wd}`.trim()
  }
  if (cycle.type === 'interval') return `每 ${cycle.value} ${cycle.unit}`
  if (cycle.type === 'once') return `单次 ${cycle.time || ''}`
  if (cycle.type === 'cron') return `Cron`
  return ''
}
</script>

<style scoped>
.schedule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  margin: 1px 0;
  transition: background 0.15s ease;
}
.schedule-row:hover {
  background: #FAFBFC;
}
.schedule-row.active {
  background: #FFF1ED;
}

.schedule-row.status-invalid {
  opacity: 0.6;
}

.row-leading {
  flex-shrink: 0;
  font-size: 14px;
}

.row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-name {
  font-size: 13px;
  color: #1D2129;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-row.status-invalid .row-name {
  text-decoration: line-through;
  color: #86909C;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #86909C;
  margin-top: 2px;
  overflow: hidden;
}

.row-executor,
.row-cycle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-sep {
  flex-shrink: 0;
}

.row-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
</style>
