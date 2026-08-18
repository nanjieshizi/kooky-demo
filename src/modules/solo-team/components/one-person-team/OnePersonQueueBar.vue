<template>
  <div v-if="items.length" class="queue-bar" :class="{ 'queue-bar--stopped': stopped }">
    <div v-if="stopped" class="queue-bar__status">
      <strong>由于你中断了当前响应，队列已停止</strong>
      <button type="button" class="queue-bar__continue" @click="emit('continue')">继续</button>
    </div>
    <ul class="queue-bar__list">
      <li v-for="item in items" :key="item.messageId" class="queue-bar__item">
        <span class="queue-bar__preview" :title="item.preview">{{ item.preview || '排队消息' }}</span>
        <button
          v-if="!item.pending"
          type="button"
          class="queue-bar__remove"
          aria-label="删除排队消息"
          :disabled="removingIds.includes(item.messageId)"
          @click="emit('remove', item.messageId)"
        >
          <SvgIcon name="icon-shanchu2" :size="16" />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import SvgIcon from '@/shared/components/SvgIcon.vue'

defineOptions({ name: 'OnePersonQueueBar' })

defineProps({
  // 排队 chip [{ messageId, position, preview, pending? }];pending=乐观项(权威快照未到),不可删。
  // 由父 Pane 经 buildQueueBarItems 组装(权威排队项 + 乐观 pending 项)。
  items: { type: Array, default: () => [] },
  // 正在删除中的 messageId(乐观 UI,禁重复点)
  removingIds: { type: Array, default: () => [] },
  stopped: { type: Boolean, default: false },
})

const emit = defineEmits(['remove', 'continue'])
</script>

<style scoped>
.queue-bar {
  flex-shrink: 0;
  width: calc(100% - 72px);
  max-width: 976px;
  max-height: 142px;
  margin: 0 auto 0;
  padding: 12px 16px;
  border: 1px solid #ededed;
  border-radius: 16px 16px 0 0;
  background: #fbfbfb;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
}

.queue-bar__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.queue-bar__status strong {
  min-width: 0;
  font-family: 'PingFang SC', '苹方-简', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #2f3547;
}

.queue-bar__continue {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-family: '苹方-简', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #0a0e23;
  cursor: pointer;
}

.queue-bar__continue:hover {
  color: #2d8cff;
}

.queue-bar__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 86px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.queue-bar__list::-webkit-scrollbar {
  width: 4px;
}

.queue-bar__list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(143, 150, 163, 0.32);
}

.queue-bar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  min-height: 26px;
}

.queue-bar__preview {
  flex: 1;
  min-width: 0;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #606572;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-bar__remove {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8f96a3;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.queue-bar__remove:hover:not(:disabled) {
  background: rgba(47, 53, 71, 0.06);
  color: #2f3547;
}

.queue-bar__remove:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
