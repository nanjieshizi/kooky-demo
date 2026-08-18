<template>
  <div v-if="toolResults && toolResults.length" class="tool-results-section">
    <div v-for="(result, idx) in toolResults" :key="idx" class="tool-result-item" :class="{ error: result.isError }">
      <div class="result-header">
        <svg v-if="result.isError" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
        </svg>
        <span>{{ result.isError ? '执行失败' : '执行结果' }}</span>
      </div>
      <div class="result-content">
        <pre>{{ result.content }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ toolResults: { type: Array, default: () => [] } })
</script>

<style lang="scss" scoped>
.tool-results-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.tool-result-item {
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
  &.error { border-color: #fecaca; }
}
.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f0fdf4;
  font-size: 13px;
  font-weight: 500;
  color: #22c55e;
}
.tool-result-item.error .result-header {
  background: #fef2f2;
  color: #ef4444;
}
.result-content {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  max-height: 200px;
  overflow-y: auto;
}
.result-content pre {
  margin: 0;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary);
}
</style>
