<script setup>
import { computed } from 'vue'
import { stripMarkdown } from '../utils/stripMarkdown'

const props = defineProps({
  replyTo: { type: Object, required: true },
})

const emit = defineEmits(['scroll-to-quote'])

const previewLen = 60

const isFile = computed(() => {
  const a = props.replyTo.attachments
  return Array.isArray(a) && a.length > 0 && !props.replyTo.content
})

const previewText = computed(() => {
  if (isFile.value) {
    return props.replyTo.attachments[0]?.name || '附件'
  }
  if (!props.replyTo.content) return '原消息已不可见'
  const text = stripMarkdown(props.replyTo.content)
  return text.length > previewLen ? text.slice(0, previewLen) + '...' : text
})

const fullText = computed(() =>
  isFile.value ? null : stripMarkdown(props.replyTo.content || ''),
)

// 内容较多时使用宽版式（最大 444px），否则标准版（最大 280px）
const tooltipClass = computed(() => {
  const len = fullText.value?.length || 0
  return len > 120 ? 'quote-tooltip quote-tooltip--wide' : 'quote-tooltip'
})

const displayName = computed(() => {
  const role = props.replyTo.role
  return role === 'user' ? '我' : 'kooky'
})

function handleClick() {
  emit('scroll-to-quote', props.replyTo.id)
}
</script>

<template>
  <div class="quote-block" @click="handleClick">
    <span class="quote-accent" aria-hidden="true" />
    <span class="quote-sender">引用 {{ displayName }}：</span>
    <el-tooltip
      v-if="!isFile && fullText && fullText.length > previewLen"
      placement="top"
      :show-after="300"
      :popper-class="tooltipClass"
    >
      <template #content>
        <div class="quote-tooltip-content">{{ fullText }}</div>
      </template>
      <span class="quote-preview">{{ previewText }}</span>
    </el-tooltip>
    <span v-else-if="isFile" class="quote-preview quote-file">📎 {{ previewText }}</span>
    <span v-else class="quote-preview">{{ previewText }}</span>
  </div>
</template>

<style lang="scss" scoped>
.quote-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  background: #f5f6f9;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  color: #91949e;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  cursor: pointer;

  &:hover {
    background: #eef0f4;
  }

  .quote-accent {
    flex-shrink: 0;
    width: 2px;
    height: 14px;
    border-radius: 2px;
    background: #C2C3C9;
  }

  .quote-sender {
    flex-shrink: 0;
    white-space: nowrap;
    color: #91949e;
  }

  .quote-preview {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #91949e;
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