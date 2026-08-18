<template>
  <section class="schedule-group">
    <header class="group-header">
      <span class="group-icon">{{ icon }}</span>
      <span class="group-label">{{ label }}</span>
    </header>
    <div class="group-body">
      <ScheduleTaskRow
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :active="activeId === task.id"
        @click="$emit('select', task.id)"
      />
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'ScheduleGroupSection' })
import ScheduleTaskRow from './ScheduleTaskRow.vue'

defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: '📋' },
  tasks: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
})

defineEmits(['select'])
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
}

.group-icon { font-size: 14px; }
.group-label { letter-spacing: 0.2px; }

.group-body {
  padding: 0 6px;
}
</style>
