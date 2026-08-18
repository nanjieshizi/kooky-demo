<script setup>
import { computed } from 'vue'

const props = defineProps({
  replyTo: { type: Object, required: true },
  senderDisplayName: { type: String, default: '' },
})

const emit = defineEmits(['scroll-to-quote'])

const isFile = computed(() =>
  props.replyTo.msgtype === 'm.file' || props.replyTo.msgtype === 'm.image',
)

const previewLen = 60

const previewText = computed(() => {
  if (isFile.value) {
    return props.replyTo.attachmentName || '附件'
  }
  const raw = props.replyTo.content || props.replyTo.body_preview || props.replyTo.bodyPreview
  if (!raw) return '原消息已不可见'
  return raw.length > previewLen ? raw.slice(0, previewLen) + '...' : raw
})

const fullText = computed(() =>
  isFile.value ? null : (props.replyTo.content || props.replyTo.body_preview || props.replyTo.bodyPreview || ''),
)

const displayName = computed(() =>
  props.senderDisplayName ||
  props.replyTo.sender_name ||
  props.replyTo.sender?.name ||
  props.replyTo.sender_id ||
  props.replyTo.sender?.id ||
  '未知用户',
)

function handleClick() {
  emit('scroll-to-quote', props.replyTo.event_id ?? props.replyTo.eventId ?? props.replyTo.id)
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
    <span v-else-if="isFile" class="quote-preview">{{ previewText }}</span>
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
  // padding: 5px 10px;
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

  /* 与文字行高对齐，避免整框 border-left 比字「高出一截」 */
  .quote-accent {
    flex-shrink: 0;
    width: 2px;
    height: 14px;
    border-radius: 2px;
    background: #C2C3C9;
  }

  @supports not (height: 1lh) {
    .quote-accent {
      height: 1em;
    }
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
