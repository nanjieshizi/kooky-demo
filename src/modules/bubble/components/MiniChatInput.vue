<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['send'])
const inputText = ref('')
const textareaRef = ref(null)

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  inputText.value = ''
  // 重置输入框高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleInput() {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    const maxH = 80
    if (el.scrollHeight > maxH) {
      el.style.height = maxH + 'px'
      el.style.overflow = 'auto'
    } else {
      el.style.height = el.scrollHeight + 'px'
      el.style.overflow = 'hidden'
    }
  }
}
</script>

<template>
  <div class="mini-chat-input">
    <textarea
      ref="textareaRef"
      v-model="inputText"
      class="input-area"
      placeholder="输入消息..."
      rows="1"
      :disabled="disabled"
      @keydown="handleKeydown"
      @input="handleInput"
    />
    <button
      class="send-btn"
      :disabled="disabled || !inputText.trim()"
      @click="handleSend"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M14 2L7 9M14 2L10 14L7 9M14 2L2 6L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.mini-chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.input-area {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.4;
  resize: none;
  outline: none;
  overflow: hidden;
  font-family: inherit;
  background: #fff;
  max-height: 80px;
  transition: border-color 0.15s;
}

.input-area:focus {
  border-color: #f97316;
}

.input-area:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #f97316;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: #ea580c;
}

.send-btn:disabled {
  background: #ddd;
  color: #999;
  cursor: not-allowed;
}
</style>
