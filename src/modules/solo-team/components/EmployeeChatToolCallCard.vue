<script setup>
import { ref } from 'vue'

const props = defineProps({
  toolUses: { type: Array, default: () => [] },
  toolResults: { type: Array, default: () => [] },
})

const expandedTools = ref(new Set())

function toggleTool(index) {
  if (expandedTools.value.has(index)) {
    expandedTools.value.delete(index)
  } else {
    expandedTools.value.add(index)
  }
}

function getStatusIcon(status) {
  if (status === 'done' || status === 'success') return '✓'
  if (status === 'running') return '⟳'
  if (status === 'error') return '✗'
  return '•'
}

function getStatusClass(status) {
  if (status === 'done' || status === 'success') return 'status-done'
  if (status === 'running') return 'status-running'
  if (status === 'error') return 'status-error'
  return ''
}

function formatInput(input) {
  if (!input) return ''
  if (typeof input === 'string') return input
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}
</script>

<template>
  <div v-if="toolUses.length || toolResults.length" class="tool-call-cards">
    <div
      v-for="(tool, idx) in toolUses"
      :key="`use-${idx}`"
      class="tool-card"
      :class="getStatusClass(tool.status)"
    >
      <div class="tool-header" @click="toggleTool(idx)">
        <span class="tool-status-icon" :class="getStatusClass(tool.status)">
          {{ getStatusIcon(tool.status) }}
        </span>
        <span class="tool-name">{{ tool.name }}</span>
        <span class="tool-toggle">{{ expandedTools.has(idx) ? '▾' : '▸' }}</span>
      </div>

      <div v-if="expandedTools.has(idx)" class="tool-body">
        <!-- 输入参数 -->
        <div v-if="tool.input" class="tool-section">
          <div class="tool-section-label">输入</div>
          <pre class="tool-code">{{ formatInput(tool.input) }}</pre>
        </div>

        <!-- 对应的结果 -->
        <div v-if="toolResults[idx]" class="tool-section">
          <div class="tool-section-label">输出</div>
          <pre class="tool-code" :class="{ 'is-error': toolResults[idx].status === 'error' }">{{ toolResults[idx].output }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-call-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
}

.tool-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.tool-card.status-running {
  border-color: #93c5fd;
}

.tool-card.status-error {
  border-color: #fca5a5;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.tool-header:hover {
  background: #f3f4f6;
}

.tool-status-icon {
  font-size: 12px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.tool-status-icon.status-done {
  color: #22c55e;
  background: #dcfce7;
}

.tool-status-icon.status-running {
  color: #3b82f6;
  background: #dbeafe;
  animation: spin 1s linear infinite;
}

.tool-status-icon.status-error {
  color: #ef4444;
  background: #fee2e2;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-toggle {
  font-size: 12px;
  color: #9ca3af;
}

.tool-body {
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
}

.tool-section {
  margin-bottom: 8px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.tool-section-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #374151;
  background: #f3f4f6;
  padding: 8px 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.tool-code.is-error {
  color: #dc2626;
  background: #fef2f2;
}
</style>
