<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
})

const listRef = ref(null)

// 自动滚动到底部
watch(
  () => props.messages.length,
  () => {
    nextTick(() => scrollToBottom())
  }
)

watch(
  () => {
    const last = props.messages[props.messages.length - 1]
    return last?.content
  },
  () => {
    nextTick(() => scrollToBottom())
  }
)

function scrollToBottom() {
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight
  }
}
</script>

<template>
  <div ref="listRef" class="mini-message-list">
    <div v-if="messages.length === 0" class="empty-hint">
      有什么可以帮你的？
    </div>
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="message-item"
      :class="[`message-${msg.role}`]"
    >
      <div class="message-bubble" :class="[`bubble-${msg.role}`]">
        {{ msg.content }}
      </div>
    </div>
    <div v-if="isStreaming" class="typing-indicator">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>
</template>

<style scoped>
.mini-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
}

.message-item {
  display: flex;
}

.message-user {
  justify-content: flex-end;
}

.message-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-user {
  background: #f97316;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble-assistant {
  background: #f5f5f5;
  color: #333;
  border-bottom-left-radius: 4px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ccc;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
