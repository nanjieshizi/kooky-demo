<script setup>
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { stripMarkdown } from '../utils/stripMarkdown'

const props = defineProps({
  quotingMessage: { type: Object, required: true },
})

const emit = defineEmits(['cancel'])

const previewText = computed(() => {
  const text = stripMarkdown(props.quotingMessage.content || '')
  return text.length > 60 ? text.slice(0, 60) + '...' : text
})

const fullText = computed(() => stripMarkdown(props.quotingMessage.content || ''))

// 内容较多时使用宽版式（最大 444px），否则标准版（最大 280px）
const tooltipClass = computed(() => {
  const len = fullText.value?.length || 0
  return len > 120 ? 'quote-tooltip quote-tooltip--wide' : 'quote-tooltip'
})

const displayName = computed(() => {
  const role = props.quotingMessage.role
  return role === 'user' ? '我' : 'kooky'
})
</script>

<template>
  <div class="quote-bar">
    <button type="button" class="cancel-btn" aria-label="关闭" @click="emit('cancel')">
      <el-icon :size="14"><Close /></el-icon>
    </button>
    <span class="quote-label">回复</span>
    <span class="quote-sender">{{ displayName }}:</span>
    <el-divider direction="vertical" class="quote-bar-divider" />
    <el-tooltip
      v-if="fullText && fullText.length > 60"
      placement="top"
      :show-after="300"
      :popper-class="tooltipClass"
    >
      <template #content>
        <div class="quote-tooltip-content">{{ fullText }}</div>
      </template>
      <span class="quote-preview">{{ previewText }}</span>
    </el-tooltip>
    <span v-else class="quote-preview">{{ previewText }}</span>
  </div>
</template>

<style lang="scss" scoped>
.quote-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 0;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: #F5F6F9;
  border-radius: 8px;
  font-size: 14px;
  color: #91949E;
  min-height: 26px;

  .cancel-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: #91949e;
    padding: 2px;
    border-radius: 4px;
    line-height: 1;

    &:hover {
      color: #303133;
      background: rgba(0, 0, 0, 0.06);
    }
  }

  .quote-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    color: #91949E;
  }

  :deep(.quote-bar-divider.el-divider--vertical) {
    margin: 0 4px;
    height: 14px;
    border-left-color: #d8d8d8;
  }
}
</style>

<style>
.quote-tooltip.el-popper {
  --line-height: 20px;
  --max-lines: 6;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  max-width: 280px;
}

.quote-tooltip.el-popper .quote-tooltip-content {
  font-size: 14px;
  line-height: var(--line-height);
  word-break: break-word;
  white-space: pre-wrap;
  max-height: calc(var(--line-height) * var(--max-lines));
  overflow-y: auto;
  scrollbar-width: thin;
}

.quote-tooltip.el-popper .quote-tooltip-content::-webkit-scrollbar {
  width: 4px;
}

.quote-tooltip.el-popper .quote-tooltip-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.quote-tooltip--wide.el-popper {
  max-width: 444px;
}
</style>