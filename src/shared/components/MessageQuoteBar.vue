<script setup>
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = defineProps({
  quotingMessage: { type: Object, required: true },
  senderDisplayName: { type: String, default: '' },
})

const emit = defineEmits(['cancel'])

const isFile = computed(() =>
  props.quotingMessage.content?.attachments?.length > 0
)

const previewText = computed(() => {
  if (isFile.value) {
    const name = props.quotingMessage.content?.attachments?.[0]?.name || '附件'
    return name
  }
  const text = props.quotingMessage.content?.body || ''
  return text.length > 60 ? text.slice(0, 60) + '...' : text
})

const fullText = computed(() =>
  isFile.value ? null : (props.quotingMessage.content?.body || '')
)

const displayName = computed(() =>
  props.senderDisplayName || props.quotingMessage.senderId || '未知用户'
)
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
      :content="fullText"
      placement="top"
      :show-after="300"
    >
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
