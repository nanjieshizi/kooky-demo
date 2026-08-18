<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MiniMessageList from './MiniMessageList.vue'
import MiniChatInput from './MiniChatInput.vue'

const emit = defineEmits(['collapse', 'restore'])

const messages = ref([])
const isStreaming = ref(false)
let currentAssistantId = null
let unsubChatEvent = null
let unsubHistory = null

onMounted(() => {
  if (!window.bubbleAPI) return

  // 接收历史消息
  unsubHistory = window.bubbleAPI.onMessageHistory((history) => {
    messages.value = history.map((msg) => ({
      id: msg.id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : extractText(msg.content),
    }))
  })

  // 接收聊天事件
  unsubChatEvent = window.bubbleAPI.onChatEvent((payload) => {
    if (!payload?.message) return

    const text = typeof payload.message.content === 'string'
      ? payload.message.content
      : extractText(payload.message.content)

    if (payload.state === 'streaming' || payload.state === 'final') {
      if (!currentAssistantId) {
        currentAssistantId = `bubble_${Date.now()}`
        messages.value.push({
          id: currentAssistantId,
          role: 'assistant',
          content: text,
        })
        isStreaming.value = true
      } else {
        // 更新已有助手消息
        const msg = messages.value.find((m) => m.id === currentAssistantId)
        if (msg) {
          msg.content = text
        }
      }
    }

    if (payload.state === 'final') {
      isStreaming.value = false
      currentAssistantId = null
    }
  })
})

onUnmounted(() => {
  if (unsubChatEvent) unsubChatEvent()
  if (unsubHistory) unsubHistory()
})

function extractText(content) {
  if (Array.isArray(content)) {
    return content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }
  return String(content || '')
}

async function handleSend(text) {
  // 添加用户消息
  messages.value.push({
    id: `user_${Date.now()}`,
    role: 'user',
    content: text,
  })

  // 重置当前助手消息 ID，准备接收新回复
  currentAssistantId = null

  if (window.bubbleAPI) {
    try {
      await window.bubbleAPI.sendMessage(text)
    } catch (error) {
      console.error('发送失败', error)
    }
  }
}
</script>

<template>
  <div class="mini-chat-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <span class="panel-title">Kooky</span>
      <div class="panel-actions">
        <button class="action-btn" title="恢复主窗口" @click="emit('restore')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M5 3V2a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
        </button>
        <button class="action-btn" title="收起" @click="emit('collapse')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 消息列表 -->
    <MiniMessageList :messages="messages" :is-streaming="isStreaming" />

    <!-- 输入框 -->
    <MiniChatInput :disabled="isStreaming" @send="handleSend" />
  </div>
</template>

<style scoped>
.mini-chat-panel {
  width: 320px;
  height: 480px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #fff5f5, #ffe4e6);
  -webkit-app-region: drag;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.panel-actions {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}
</style>
