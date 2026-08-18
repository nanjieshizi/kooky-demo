<template>
  <div class="factory-build-steps">
    <div
      v-for="(step, idx) in steps"
      :key="idx"
      class="build-step"
      :class="step.status"
    >
      <span class="step-icon">
        <svg v-if="step.status === 'done'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span v-else-if="step.status === 'running'" class="spinner"></span>
        <span v-else class="dot"></span>
      </span>
      <span class="step-text">{{ step.text }}</span>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'FactoryBuildSteps' })
defineProps({
  steps: { type: Array, default: () => [] },
})
</script>

<style scoped lang="scss">
.factory-build-steps {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: #fbfbff;
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 10px;
}

.build-step {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: #9ca3af;
  transition: color 0.2s;

  &.done { color: #4b5563; }
  &.running { color: #4f46e5; font-weight: 500; }
}

.step-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  .build-step.done & { background: #6366f1; color: #fff; }
  .build-step.running & { background: #eef2ff; color: #6366f1; }
  .build-step.pending & { background: #f1f2f4; }
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c7cad1;
}

.spinner {
  width: 11px;
  height: 11px;
  border: 2px solid #c7d2fe;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
