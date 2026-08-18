<template>
  <div class="subtask-card" :class="[`status-${subtask.status}`]">
    <div class="subtask-header" @click="collapsed = !collapsed">
      <span class="subtask-icon" v-html="statusIcon" />
      <span class="subtask-description">{{ subtask.description }}</span>
      <span class="subtask-toggle" :class="{ expanded: !collapsed }">▸</span>
    </div>
    <div v-if="!collapsed" class="subtask-body">
      <div v-if="subtask.prompt" class="subtask-prompt">{{ subtask.prompt }}</div>
      <div v-if="subtask.status === 'completed' && subtask.result" class="subtask-result">
        <DeerflowMarkdownContent :content="subtask.result" :is-streaming="false" />
      </div>
      <div v-if="subtask.status === 'failed' && subtask.error" class="subtask-error">
        {{ subtask.error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import DeerflowMarkdownContent from './DeerflowMarkdownContent.vue'

const props = defineProps({
  subtask: { type: Object, required: true },
  isLoading: { type: Boolean, default: false },
})

const collapsed = ref(true)

const statusIcon = computed(() => {
  switch (props.subtask.status) {
    case 'completed':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22c55e"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    case 'failed':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ef4444"/><path d="M15 9l-6 6M9 9l6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="2"/><path d="M12 6v6l4 2" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/></svg>'
  }
})
</script>

<style lang="scss" scoped>
.subtask-card {
  margin: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.subtask-card.status-in_progress {
  border-color: #93c5fd;
}

.subtask-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #f9fafb; }
}

.subtask-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.subtask-card.status-in_progress .subtask-icon :deep(svg) {
  animation: spin 1.5s linear infinite;
}

.subtask-description {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtask-toggle {
  font-size: 10px;
  color: #9ca3af;
  transition: transform 0.2s;

  &.expanded { transform: rotate(90deg); }
}

.subtask-body {
  padding: 0 14px 12px;
  border-top: 1px solid #f3f4f6;
}

.subtask-prompt {
  font-size: 12px;
  color: #6b7280;
  margin-top: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.subtask-result {
  margin-top: 10px;
  font-size: 13px;
}

.subtask-error {
  margin-top: 10px;
  font-size: 12px;
  color: #ef4444;
  line-height: 1.5;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
