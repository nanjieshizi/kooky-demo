<template>
  <div class="factory-view">
    <!-- 空状态：全屏居中引导页 -->
    <FactoryEmptyState v-if="isEmptyState" />

    <!-- 正常工作状态：左右分栏 -->
    <div v-else ref="containerRef" class="factory-body">
      <!-- 左栏：Agent Creator 对话 -->
      <div class="factory-left" :style="{ width: `${leftPercent}%` }">
        <FactoryLeftPanel />
      </div>

      <!-- 分割线 -->
      <div
        class="factory-divider"
        :class="{ dragging: isDragging }"
        @mousedown="handleDragStart"
      >
        <div class="divider-line"></div>
      </div>

      <!-- 右栏：预览+运行 / 项目文件 -->
      <div class="factory-right" :style="{ width: `${100 - leftPercent}%` }">
        <FactoryRightPanel />
      </div>
    </div>

    <!-- 新建项目弹窗：Teleport 到 body，全局可见，由 store 控制显隐 -->
    <Teleport to="body">
      <FactoryCreateModal />
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useFactoryStore } from '../store'
import FactoryEmptyState from './FactoryEmptyState.vue'
import FactoryLeftPanel from './FactoryLeftPanel.vue'
import FactoryRightPanel from './FactoryRightPanel.vue'
import FactoryCreateModal from './FactoryCreateModal.vue'
import { useHorizontalResize } from '../composables/useResize'

const factoryStore = useFactoryStore()
const isEmptyState = computed(
  () => factoryStore.currentState === 'empty' || factoryStore.projects.length === 0,
)

const containerRef = ref(null)

const { leftPercent, isDragging, startDrag } = useHorizontalResize(40, 20, 80)

function handleDragStart(e) {
  if (containerRef.value) {
    startDrag(e, containerRef.value)
  }
}
</script>

<style lang="scss" scoped>
.factory-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.factory-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.factory-left {
  height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

.factory-left-content {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.factory-divider {
  width: 8px;
  height: 100%;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  background: var(--bg-primary);
  transition: background 0.2s;

  &:hover,
  &.dragging {
    background: var(--bg-hover);
  }

  .divider-line {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 40px;
    background: var(--border);
    border-radius: 1px;
  }
}

.factory-right {
  height: 100%;
  overflow: hidden;
}

.factory-right-content {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.placeholder-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
  gap: 8px;
}
</style>
