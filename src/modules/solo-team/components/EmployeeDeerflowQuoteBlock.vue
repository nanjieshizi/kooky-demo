<script setup>
import { computed } from 'vue'
import { resolveAssistantDisplayName } from '../utils/assistantDisplayName.mjs'

const props = defineProps({
  replyTo: { type: Object, required: true },
  assistantName: { type: String, default: '' },
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
  const text = props.replyTo.content
  return text.length > previewLen ? text.slice(0, previewLen) + '...' : text
})

const fullText = computed(() =>
  isFile.value ? null : (props.replyTo.content || ''),
)

const displayName = computed(() => resolveAssistantDisplayName(props.replyTo, props.assistantName))

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
      :content="fullText"
      placement="top"
      :show-after="300"
      popper-class="quote-tooltip"
    >
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
  padding: 5px 10px;
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
  max-width: 320px;
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
