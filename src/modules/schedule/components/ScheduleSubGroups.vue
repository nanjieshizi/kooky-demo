<template>
  <section class="schedule-group">
    <header class="group-header" @click="collapsed = !collapsed">
      <svg class="caret" :class="{ expanded: !collapsed }" width="10" height="10" viewBox="0 0 10 10">
        <path d="M3 1 L7 5 L3 9" stroke="#86909C" stroke-width="1.5" fill="none" stroke-linecap="round" />
      </svg>
      <span class="group-icon">{{ icon }}</span>
      <span class="group-label">{{ label }}</span>
    </header>
    <div v-show="!collapsed" class="group-body">
      <div v-for="(sub, key) in subGroups" :key="key" class="sub-group">
        <header class="sub-header">
          <span class="sub-icon">📂</span>
          <span class="sub-label">{{ sub.label }}</span>
        </header>
        <ScheduleTaskRow
          v-for="task in sub.tasks"
          :key="task.id"
          :task="task"
          :active="activeId === task.id"
          @click="$emit('select', task.id)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'ScheduleSubGroups' })
import { ref } from 'vue'
import ScheduleTaskRow from './ScheduleTaskRow.vue'

defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: '📁' },
  subGroups: { type: Object, default: () => ({}) },
  activeId: { type: String, default: null },
})

defineEmits(['select'])

const collapsed = ref(false)
</script>

<style scoped>
.schedule-group {
  padding: 4px 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  color: #4E5969;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.group-header:hover {
  background: #FAFBFC;
}

.caret {
  transition: transform 0.2s ease;
}
.caret.expanded {
  transform: rotate(90deg);
}

.group-icon { font-size: 14px; }

.group-body {
  padding: 0 6px;
}

.sub-group {
  margin: 2px 0 6px;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 14px;
  font-size: 11px;
  color: #86909C;
  font-weight: 500;
}

.sub-icon { font-size: 12px; }
</style>
