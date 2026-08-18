<template>
  <div class="factory-trace-panel">

    <!-- 主体：调用树 + 详情 -->
    <div v-if="hasRun" class="trace-body">
      <FactoryTraceTree />
      <FactoryTraceDetail :node="selectedTraceNode" />
    </div>
    <div v-else class="trace-empty">
      <div class="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
      <div class="empty-text">在上方对话后，这里会展示执行链路</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFactoryStore } from '../store'
import FactoryTraceTree from './FactoryTraceTree.vue'
import FactoryTraceDetail from './FactoryTraceDetail.vue'

defineOptions({ name: 'FactoryTracePanel' })

const factoryStore = useFactoryStore()
const { traceNodes, selectedTraceNode } = storeToRefs(factoryStore)

const hasRun = computed(() => (traceNodes.value?.length || 0) > 0)
const rootDuration = computed(() => traceNodes.value?.[0]?.duration || '—')

function onClose() {
  factoryStore.setShowTrace(false)
}
</script>

<style lang="scss" scoped>
.factory-trace-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.trace-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.trace-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #fff;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f3f4f6;
  color: #9ca3af;
}

.empty-text {
  font-size: 12px;
  color: #9ca3af;
}
</style>
