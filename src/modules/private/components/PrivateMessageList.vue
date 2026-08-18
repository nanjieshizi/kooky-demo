<template>
  <div class="message-list-root">
    <div class="message-list-scroll" ref="listRef">
      <div v-if="showLoadMoreHint" class="load-more-hint load-more-hint--loading" aria-live="polite">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载更多消息...
      </div>

      <TransitionGroup
        v-if="listMessagesForRender.length > 0"
        :name="ready ? 'msg' : ''"
        tag="div"
        class="messages-wrapper messages-wrapper--message-stack"
      >
        <div
          v-for="msg in listMessagesForRender"
          :key="stableMessageId(msg)"
          class="msg-row-anchor"
          :data-event-id="msg.eventId || ''"
        >
          <PrivateMessageItem
            :message="msg"
            :conversation-id="frozenConversationId"
            @quote="handleQuote"
            @scroll-to-quote="handleScrollToQuote"
          />
        </div>
      </TransitionGroup>

      <div
        v-if="messages.length === 0 && showHistoryLoading"
        class="empty-state"
      >
        <img src="@/assets/home/heade_icon.svg" alt="" class="empty-crab" />
        <p class="empty-text">正在载入消息…</p>
      </div>

      <div
        v-else-if="messages.length === 0 && !showHistoryLoading"
        class="empty-state"
      >
        <img src="@/assets/home/heade_icon.svg" alt="" class="empty-crab" />
        <p class="empty-text">暂无消息</p>
      </div>
    </div>

    <Transition name="fade">
      <button
        v-if="showScrollToBottom"
        class="scroll-to-bottom-btn"
        aria-label="回到底部"
        :disabled="scrollingToBottom"
        @click="handleScrollToBottom"
      >
        <el-icon v-if="scrollingToBottom" class="is-loading"><Loading /></el-icon>
        <img v-else src="@/assets/chat/down.svg" alt="" />
      </button>
    </Transition>

    <div ref="composerTopAnchorRef" class="chat-composer-top-anchor chat-composer-footer">
      <PrivateChatInput
        :conversation-id="frozenConversationId"
        :quote-request-serial="quoteRequestSerial"
        :quoting-message="quotingMessage"
        :quoting-sender-name="quotingSenderNameComputed"
        @cancel-quote="quotingMessage = null"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted, provide, watch } from 'vue'
import { ElIcon } from 'element-plus'
import { usePrivateStore } from '@/modules/private/store'
import {
  CHAT_COMPOSER_TOP_ANCHOR_KEY,
  CHAT_COMPOSER_INPUT_BOX_KEY,
  FORCE_SCROLL_TO_BOTTOM_KEY,
} from '@/shared/constants/injectionKeys'
import { useMessageListScroll } from '@/shared/chatComposables/useMessageListScroll'
import { useMessageLocate } from '@/shared/chatComposables/useMessageLocate'
import { usePrivateMessageListCore } from '@/modules/private/usePrivateMessageListCore'
import PrivateMessageItem from './PrivateMessageItem.vue'
import PrivateChatInput from './PrivateChatInput.vue'

defineOptions({ name: 'PrivateMessageList' })

const props = defineProps({
  conversationId: { type: [String, Number], required: true },
})

const privateStore = usePrivateStore()
const frozenConversationId = props.conversationId

const listRef = ref(null)
const composerTopAnchorRef = ref(null)
const composerInputBoxRef = ref(null)
provide(CHAT_COMPOSER_TOP_ANCHOR_KEY, composerTopAnchorRef)
provide(CHAT_COMPOSER_INPUT_BOX_KEY, composerInputBoxRef)
provide(FORCE_SCROLL_TO_BOTTOM_KEY, () => handleScrollToBottom())

const ready = ref(false)
onMounted(() => {
  nextTick(() => { ready.value = true })
})

const {
  messages, messageCount, streamingContent, remoteTypingCount,
  showHistoryLoading, suppressScrollToBottomForPrepend,
  stableMessageId, resolveListConversationId,
} = usePrivateMessageListCore(frozenConversationId)

const listMessagesForRender = computed(() => messages.value)

const quotingMessage = ref(null)
const quoteRequestSerial = ref(0)
const quotingSenderNameComputed = computed(() => {
  const q = quotingMessage.value
  if (!q) return ''
  if (q.role === 'peer') return q.senderDisplayName || ''
  return '我'
})

function handleQuote(message) {
  quotingMessage.value = message
  quoteRequestSerial.value += 1
}

async function handleScrollToQuote(messageId) {
  await locate(messageId)
}

const {
  locate,
  isLocatingRequest,
  shouldSkipAutoScrollOnActivate,
  exitLocating,
} = useMessageLocate({ scope: 'private', id: frozenConversationId, listRef })

const scrollingToBottom = ref(false)

async function handleScrollToBottom() {
  if (scrollingToBottom.value) return
  scrollingToBottom.value = true
  try {
    exitLocating()
    const cs = privateStore.chatMessages[frozenConversationId]
    if (cs?.isContextWindow || privateStore.hasMoreForward(frozenConversationId)) {
      await privateStore.reloadLatest(frozenConversationId)
    }
    forceScrollToBottom()
  } finally {
    scrollingToBottom.value = false
  }
}

watch(messages, (newMsgs, oldMsgs) => {
  const cs = privateStore.chatMessages[frozenConversationId]
  if (!cs?.isContextWindow) return
  if (newMsgs.length <= oldMsgs.length) return
  const last = newMsgs[newMsgs.length - 1]
  if (last?.role === 'user') {
    handleScrollToBottom()
  }
})

const {
  showScrollToBottom, forceScrollToBottom,
  applyPrependScrollAnchor, attachScrollTriggers,
} = useMessageListScroll(listRef, suppressScrollToBottomForPrepend, isLocatingRequest)

const localLoadMoreHintVisible = ref(false)
let loadMoreHintTimer = null
const LOAD_MORE_HINT_MIN_MS = 500

const showLoadMoreHint = computed(() => {
  const cs = privateStore.chatMessages[frozenConversationId]
  return !!(cs?.loadingMoreHistory) || localLoadMoreHintVisible.value
})

function beginLoadMoreHint() {
  if (loadMoreHintTimer) {
    clearTimeout(loadMoreHintTimer)
    loadMoreHintTimer = null
  }
  localLoadMoreHintVisible.value = true
  return Date.now()
}

function endLoadMoreHint(startedAt) {
  const elapsed = Date.now() - startedAt
  const remain = Math.max(0, LOAD_MORE_HINT_MIN_MS - elapsed)
  if (loadMoreHintTimer) clearTimeout(loadMoreHintTimer)
  loadMoreHintTimer = setTimeout(() => {
    localLoadMoreHintVisible.value = false
    loadMoreHintTimer = null
  }, remain)
}

const loadOlderLocked = ref(false)

attachScrollTriggers(
  messageCount, streamingContent, remoteTypingCount,
  () => {
    const id = resolveListConversationId()
    if (!id || loadOlderLocked.value) return
    const el = listRef.value
    if (!el) return
    const cs = privateStore.chatMessages[id]
    if (cs?.loadingMoreHistory) return
    if (cs?.hasMoreHistory === false) return

    loadOlderLocked.value = true
    const hintStartedAt = beginLoadMoreHint()
    suppressScrollToBottomForPrepend.value = true
    const prevScrollHeight = el.scrollHeight
    const prevScrollTop = el.scrollTop

    privateStore
      .loadMoreHistory(id)
      .then(() => {
        const anchor = () =>
          applyPrependScrollAnchor(listRef.value, prevScrollHeight, prevScrollTop)
        nextTick().then(() =>
          nextTick().then(() => {
            anchor()
            requestAnimationFrame(() => {
              anchor()
              requestAnimationFrame(() => {
                anchor()
                setTimeout(anchor, 340)
                setTimeout(anchor, 720)
              })
            })
          }),
        )
      })
      .finally(() => {
        endLoadMoreHint(hintStartedAt)
        loadOlderLocked.value = false
        nextTick().then(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              suppressScrollToBottomForPrepend.value = false
            }),
          ),
        )
      })
  },
)

function onActivate() {
  if (shouldSkipAutoScrollOnActivate.value) return
  forceScrollToBottom()
}

onUnmounted(() => {
  if (loadMoreHintTimer) {
    clearTimeout(loadMoreHintTimer)
    loadMoreHintTimer = null
  }
})

defineExpose({ onActivate })
</script>

<style scoped>
.message-list-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}

.chat-composer-top-anchor.chat-composer-footer {
  flex-shrink: 0;
}

.load-more-hint {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 2;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 12px 10px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    var(--bg-primary) 40%,
    rgba(255, 255, 255, 0) 100%
  );
}

.load-more-hint--loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: none;
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

.messages-wrapper--message-stack {
  gap: 0;
}

.messages-wrapper--message-stack :deep(.message-item.peer) {
  margin-top: 16px;
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
}

.msg-enter-active {
  transition: all 0.3s ease-out;
}

.msg-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scroll-to-bottom-btn {
  position: absolute;
  bottom: 190px;
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
</style>

<style>
@keyframes highlight-flash {
  0%, 100% { background: transparent; }
  30% { background: rgba(64, 158, 255, 0.15); }
}

.highlight-flash {
  animation: highlight-flash 1.5s ease;
  border-radius: 8px;
}
</style>
