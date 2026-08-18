<template>
  <div class="message-list-root">
    <div
      ref="listRef"
      class="message-list-scroll custom-scrollbar"
      :class="{ 'is-streaming': isStreaming, 'is-scrolling': isScrolling  }"
    >
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <img src="@/assets/home/heade_icon.svg" alt="" class="empty-crab" />
        <p class="empty-text">正在载入消息…</p>
      </div>

      <!-- 空状态：欢迎语 -->
      <div v-else-if="messages.length === 0" class="empty-state">
        <img src="@/assets/home/heade_icon.svg" alt="" class="empty-crab" />
        <p v-if="welcomeMessage" class="welcome-text">{{ welcomeMessage }}</p>
        <p v-else class="empty-text">暂无消息，开始对话吧</p>
      </div>

      <!-- 消息列表 -->
      <TransitionGroup
        v-else
        :name="ready ? 'msg' : ''"
        tag="div"
        class="messages-wrapper"
      >
        <!-- 上滑加载更早消息：IntersectionObserver 哨兵（对齐 deer-flow） -->
        <DeerflowLoadOlderSentinel
          key="load-older-sentinel"
          :list-ref="listRef"
          :has-more="hasMore"
          :loading-older="loadingOlder"
          :ledger-backfill-pending="ledgerBackfillPending"
          :thread-db-id="threadDbId"
          :persisted-count="persistedCount"
          :scroll-anchor-ref="scrollAnchorRef"
          :on-fetch-older="handleFetchOlder"
          :on-after-restore="handleAfterRestore"
        />
        <template v-for="(msg, index) in messages" :key="msg.id">
          <div v-if="getDateLabel(index)" class="date-separator">
            <span class="date-label">{{ getDateLabel(index) }}</span>
          </div>
          <DeerflowMessageItem
            :message="msg"
            :space-id="spaceId"
            :message-timestamp="msg.timestamp"
            :global-is-streaming="isStreaming"
            :is-last-assistant-message="msg.id === lastAssistantMessageId"
            @quote="handleQuote"
            @copy="handleCopy"
            @feedback="handleFeedback"
            @scroll-to-quote="handleScrollToQuote"
            @scroll-to-quote-by-content="handleScrollToQuoteByContent"
            @regenerate="handleRegenerate"
          />
        </template>
      </TransitionGroup>

      <!-- 流式输入指示 -->
      <div v-if="isStreaming && !hasStreamingMessage" class="typing-indicator">
        <div class="typing-dots">
          <span /><span /><span />
        </div>
        <span class="typing-text">正在思考…</span>
      </div>
    </div>

    <!-- 快速到底部按钮 -->
    <Transition name="fade">
      <button
        v-if="showScrollToBottom"
        class="scroll-to-bottom-btn"
        aria-label="回到底部"
        @click="forceScrollToBottom"
      >
        <img src="@/assets/chat/down.svg" alt="" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import DeerflowMessageItem from './DeerflowMessageItem.vue'
import DeerflowLoadOlderSentinel from './DeerflowLoadOlderSentinel.vue'
import { useDeerflowScroll } from '../composables/useDeerflowScroll'
import { getDateSeparator } from '../composables/useDeerflowTimestamp'
import { useScrollbar } from '@/composables/useScrollbar'
import { useDeerflowChatStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'

const props = defineProps({
  messages: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  welcomeMessage: { type: String, default: '' },
})

const emit = defineEmits(['quote', 'copy', 'feedback', 'regenerate'])

const deerflowStore = useDeerflowChatStore()
const uiStore = useUIStore()

// 获取当前 deerflow 会话的 spaceId（用于文件库隔离）
const spaceId = computed(() => {
  const threadId = deerflowStore.currentThreadId ?? uiStore.activeSecondaryNav
  return threadId == null ? null : String(threadId)
})

const listRef = ref(null)
const ready = ref(false)

// 滚动条显示控制
const { isScrolling } = useScrollbar({ scrollContainer: listRef, hideDelay: 1000 })

onMounted(() => nextTick(() => { ready.value = true }))

const { showScrollToBottom, forceScrollToBottom, attachScrollTriggers } = useDeerflowScroll(listRef)

const messageCount = computed(() => props.messages.length)
const streamingContent = computed(() => {
  const last = props.messages[props.messages.length - 1]
  return last?.isStreaming ? last.content : null
})

// 不再使用客户端虚拟滚动：上滑加载由 DeerflowLoadOlderSentinel 触发账本游标分页（与 deer-flow 一致）
attachScrollTriggers(messageCount, streamingContent)

const hasStreamingMessage = computed(() => {
  return props.messages.some(m => m.isStreaming && m.content)
})

// 找到最后一条 assistant 消息的 ID（用于默认展示工具栏）
const lastAssistantMessageId = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const msg = props.messages[i]
    if (msg.role === 'assistant' && !msg.isStreaming) {
      return msg.id
    }
  }
  return null
})

// —— 账本分页（直接从 store 顶层读取，已由 _syncViewFromThreadState 同步）——
const threadDbId = computed(() => deerflowStore.currentThreadId ?? null)
const hasMore = computed(() => deerflowStore.hasMore)
const loadingOlder = computed(() => deerflowStore.loadingOlderPage)
const ledgerBackfillPending = computed(() => deerflowStore.ledgerBackfillPending)
const persistedCount = computed(() => deerflowStore.persistedMessageCount)
const scrollAnchorRef = computed(() => deerflowStore.scrollAnchor)

async function handleFetchOlder(anchor) {
  const id = threadDbId.value
  if (id == null) return
  // 在 store 里写入锚点（顶层 + 内嵌 thread state，确保 sentinel computed 与 store 内部都可见）
  const state = deerflowStore.threadStates.get(id)
  if (state) state.scrollAnchor = anchor
  deerflowStore.scrollAnchor = anchor
  await deerflowStore.loadOlderPage(id)
}

function handleAfterRestore() {
  const id = threadDbId.value
  if (id == null) return
  const state = deerflowStore.threadStates.get(id)
  if (state) state.scrollAnchor = null
  deerflowStore.scrollAnchor = null
}

function getDateLabel(index) {
  return getDateSeparator(props.messages, index)
}

function handleQuote(message) {
  emit('quote', message)
}

function handleCopy(content) {
  emit('copy', content)
}

function handleFeedback(messageId, type) {
  emit('feedback', messageId, type)
}

function handleRegenerate(message) {
  emit('regenerate', message)
}

function handleScrollToQuote(messageId) {
  if (!listRef.value || !messageId) return
  const el = listRef.value.querySelector(`[data-message-id="${messageId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('highlight-quote')
    setTimeout(() => el.classList.remove('highlight-quote'), 2000)
    return
  }
  // 找不到对应消息（历史会话中 id 可能失效），尝试按 replyTo.content 匹配
  const current = props.messages.find(m => m.replyTo && m.replyTo.id === messageId)
  if (current?.replyTo?.content) {
    handleScrollToQuoteByContent(current.replyTo.content)
  }
}

function handleScrollToQuoteByContent(quoteContent) {
  if (!listRef.value || !quoteContent) return
  const normalized = String(quoteContent).trim()
  const matched = [...props.messages]
    .reverse()
    .find(m => m.role === 'assistant' && String(m.content || '').trim().includes(normalized))
  if (!matched) return
  const el = listRef.value.querySelector(`[data-message-id="${matched.id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('highlight-quote')
    setTimeout(() => el.classList.remove('highlight-quote'), 2000)
  }
}
</script>

<style scoped>
.message-list-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  background: #fff;
}

.message-list-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 24px;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-crab {
  width: 64px;
  height: 64px;
  opacity: 0.4;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.welcome-text {
  font-size: 15px;
  color: #374151;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.messages-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.msg-enter-active { animation: msg-enter 0.3s ease; }
.msg-enter-active.user { animation: none; }
.msg-leave-active { display: none; }

@keyframes msg-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 引用跳转高亮 */
:deep(.highlight-quote) {
  animation: quoteHighlight 2s ease;
}

/* 输入指示 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  animation: typingFadeIn 0.25s ease 0.35s both;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(180deg, #FF7809 0%, #FF9E43 99%);
  animation: typingBounce 1.4s ease-in-out infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

.typing-text {
  font-size: 13px;
  color: #91949e;
  font-style: italic;
}

@keyframes typingFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-list-scroll.is-streaming {
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
  mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
}

/* 日期分隔线 */
.date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.date-label {
  font-size: 12px;
  color: #91949e;
  background: #fff;
  padding: 0 12px;
  position: relative;
}

.date-separator::before,
.date-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.date-separator::before { margin-right: 12px; }
.date-separator::after { margin-left: 12px; }

@keyframes quoteHighlight {
  0%, 30% { background: rgba(64, 158, 255, 0.1); }
  100% { background: transparent; }
}

.scroll-to-bottom-btn {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  border: 1px solid #DFE2EA;
  border-radius: 50%;
  background: #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s;
  z-index: 10;
}

.scroll-to-bottom-btn:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.scroll-to-bottom-btn img {
  width: 20px;
  height: 20px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
