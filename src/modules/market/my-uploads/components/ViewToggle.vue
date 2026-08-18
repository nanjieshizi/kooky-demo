<template>
  <div class="view-toggle">
    <el-tooltip content="列表视图" placement="top">
      <button
        class="toggle-btn"
        :class="{ active: modelValue === 'list' }"
        @click="$emit('update:modelValue', 'list')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="2.5" rx="1" />
          <rect x="1" y="6.75" width="14" height="2.5" rx="1" />
          <rect x="1" y="11.5" width="14" height="2.5" rx="1" />
        </svg>
      </button>
    </el-tooltip>
    <el-tooltip content="网格视图" placement="top">
      <button
        class="toggle-btn"
        :class="{ active: modelValue === 'grid' }"
        @click="$emit('update:modelValue', 'grid')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
      </button>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import type { ViewMode } from '../types'

defineProps<{
  modelValue: ViewMode
}>()

defineEmits<{
  'update:modelValue': [value: ViewMode]
}>()
</script>

<style lang="scss" scoped>
.view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  background: rgba(47, 53, 71, 0.05);
  border-radius: 8px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(47, 53, 71, 0.4);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: rgba(47, 53, 71, 0.7);
  }

  &.active {
    background: #fff;
    color: #8478fa;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}
</style>
