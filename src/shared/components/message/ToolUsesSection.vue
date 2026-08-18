<template>
  <div v-if="toolUses && toolUses.length" class="tool-uses-section">
    <div v-for="tool in toolUses" :key="tool.id" class="tool-use-item">
      <div class="tool-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span class="tool-name">{{ getAssistantToolDisplayName(tool.name) }}</span>
      </div>
      <div v-if="tool.input" class="tool-input">
        <pre>{{ formatAssistantToolInput(tool.input) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  getAssistantToolDisplayName as _getAssistantToolDisplayName,
  formatAssistantToolInput as _formatAssistantToolInput,
} from '@/shared/utils/assistantToolDisplay.js'

defineProps({ toolUses: { type: Array, default: () => [] } })

const getAssistantToolDisplayName = (name) => _getAssistantToolDisplayName(name)
const formatAssistantToolInput = (input) => _formatAssistantToolInput(input)
</script>

<style lang="scss" scoped>
.tool-uses-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.tool-use-item {
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
}
.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #eff6ff;
  font-size: 13px;
  font-weight: 500;
  color: #3b82f6;
}
.tool-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.tool-input {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}
.tool-input pre {
  margin: 0;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
}
</style>
