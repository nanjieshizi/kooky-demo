<template>
  <div class="file-preview-strip">
    <div
      v-for="item in (uploadAreaRef?.pendingFiles ?? [])"
      :key="item.id"
      class="file-preview-card"
      :class="{ 'has-error': item.error }"
    >
      <div class="fp-icon-wrap">
        <img :src="getChatFileIconSrc(uploadAreaRef.getFileType(item.file.name))" class="fp-icon" alt="" />
        <div v-if="item.url === null && !item.error" class="fp-loading"></div>
      </div>
      <div class="fp-info">
        <span class="fp-name">{{ item.file.name }}</span>
        <span v-if="!item.error" class="fp-size">{{ uploadAreaRef.formatFileSize(item.file.size) }}</span>
        <span v-else class="fp-error">
          上传失败
          <button type="button" class="fp-retry" @click.stop="uploadAreaRef.retryFile(item)">重试</button>
        </span>
      </div>
      <button class="fp-remove" @click.stop="uploadAreaRef.removeFile(item.id)">
        <img src="@/assets/home/fp-remove.svg" width="16" height="16" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { getChatFileIconSrc } from '@/shared/utils/chatFileIcons'

defineProps({
  uploadAreaRef: { type: Object, required: true },
})
</script>

<style scoped>
.file-preview-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0px 4px 0px;
  margin-bottom: 4px;
  scrollbar-width: thin;
}

.file-preview-strip::-webkit-scrollbar {
  height: 4px;
}

.file-preview-strip::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.15);
  border-radius: 2px;
}

.file-preview-card {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: 200px;
  min-height: 48px;
  padding: 8px 28px 8px 10px;
  border-radius: 8px;
  background: #F7F8FA;
  position: relative;
  box-sizing: border-box;
}

.file-preview-card.has-error {
  border-color: #fca5a5;
  background: #fef2f2;
}

.fp-icon-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.fp-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: contain;
}

.fp-loading {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fp-loading::after {
  content: '';
  width: 14px;
  height: 14px;
  border: 2px solid #8478FA;
  border-top-color: transparent;
  border-radius: 50%;
  animation: fp-spin 0.7s linear infinite;
}

@keyframes fp-spin {
  to { transform: rotate(360deg); }
}

.fp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  line-height: 1.25;
}

.fp-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fp-size {
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fp-error {
  font-size: 11px;
  color: #ef4444;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.fp-retry {
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.fp-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 1;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.file-preview-card:hover .fp-remove,
.file-preview-card:focus-within .fp-remove {
  opacity: 1;
  pointer-events: auto;
}

.fp-remove:hover {
  opacity: 0.8;
}
</style>
