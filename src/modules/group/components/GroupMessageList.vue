<template>
  <div class="message-list-root">
    <div
      v-if="!props.hideMessages"
      class="message-list-scroll"
      ref="listRef"
      :class="{ 'is-streaming': !!streamingContent }"
    >
      <!-- 不占文档流，避免显示/隐藏时 scrollHeight 突变导致视口下跳 -->
      <div v-if="showLoadMoreHint" class="load-more-hint load-more-hint--loading" aria-live="polite">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载更多消息...
      </div>

      <TransitionGroup
        v-if="messageRowsForRender.length > 0"
        :name="ready ? 'msg' : ''"
        tag="div"
        class="messages-wrapper messages-wrapper--message-stack"
      >
        <!-- 锚点滚动用：data-event-id 放在原生 div 上，避免经子组件透传 + TransitionGroup 时偶发挂不到 DOM -->
        <div
          v-for="row in messageRowsForRender"
          :key="row.key"
          class="msg-row-anchor"
          :data-event-id="row.message.eventId || ''"
          :class="{ 'msg-stack-tight': row.isTight }"
        >
          <div v-if="row.systemTimeLabel" class="group-system-time">
            {{ row.systemTimeLabel }}
          </div>
          <GroupMessageItem
            :message="row.message"
            :conversation-id="frozenConversationId"
            :show-assistant-actions-always="
              row.key === latestFinishedAssistantMessageId
            "
            :sender-display-name="row.senderDisplayName"
            :sender-avatar-url="row.senderAvatarUrl"
            :member-profile-map="memberProfileMapAsObject"
            @quote="handleQuote"
            @scroll-to-quote="handleScrollToQuote"
          />
        </div>
      </TransitionGroup>

      <!-- 正在输入状态：多个思考进程并行展示 -->
      <RemoteTypingIndicator
        v-for="item in typingUserList"
        :key="item.uid"
        :show="true"
        :avatar-src="item.avatarSrc"
        :avatar-name="item.displayName"
        :is-digital="true"
        @avatar-error="onTypingAssistantAvatarError"
      />

      <div
        v-if="messages.length === 0 && showHistoryLoading && !showRemoteTyping"
        class="empty-state"
      >
        <img src="@/assets/home/heade_icon.svg" alt="crab" class="empty-crab" />
        <p class="empty-text">正在载入消息…</p>
      </div>

      <div
        v-else-if="messages.length === 0 && !showHistoryLoading && !showRemoteTyping"
        class="empty-state"
      >
        <img src="@/assets/home/heade_icon.svg" alt="crab" class="empty-crab" />
        <p class="empty-text">暂无消息</p>
      </div>
    </div>

    <!-- 快速到底部按钮 -->
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

    <!-- 群聊输入框：外层 ref 供 AssistantMessageActions 等注入定位（与个人对话一致） -->
    <div ref="composerTopAnchorRef" class="chat-composer-top-anchor chat-composer-footer">
      <GroupChatInput
        :conversation-id="frozenConversationId"
        :group-id="frozenGroupId"
        :member-agent-ids="memberAgentIds"
        :quote-request-serial="quoteRequestSerial"
        :quoting-message="quotingMessage"
        :quoting-sender-name="
          quotingMessage
            ? (() => {
                const senderProfile = memberProfileMap.get(quotingMessage.senderId)
                const digitalHuman = digitalHumanMap.get(String(quotingMessage.senderId))
                // 与消息列表显示逻辑保持一致
                return (quotingMessage.senderDisplayName && String(quotingMessage.senderDisplayName).trim()) ||
                       (digitalHuman?.name && String(digitalHuman.name).trim()) ||
                       senderProfile?.displayName ||
                       (quotingMessage.senderName && String(quotingMessage.senderName).trim()) ||
                       ''
              })()
            : ''
        "
        @cancel-quote="quotingMessage = null"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted, provide, watch } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import {
  CHAT_COMPOSER_TOP_ANCHOR_KEY,
  CHAT_COMPOSER_INPUT_BOX_KEY,
  FORCE_SCROLL_TO_BOTTOM_KEY
} from '@/shared/constants/injectionKeys'
import { useGroupMessageListCore } from '@/modules/group/useGroupMessageListCore'
import { useMessageListScroll } from '@/shared/chatComposables/useMessageListScroll'
import { useMessageLocate } from '@/shared/chatComposables/useMessageLocate'
import {
  sameCalendarMinuteAsPrevious,
  messageTimestampMs,
  formatGroupSystemTimeLabel,
} from '@/shared/chatComposables/useMessageTimestamp'
import GroupMessageItem from './GroupMessageItem.vue'
import GroupChatInput from '@/modules/group/components/GroupChatInput.vue'
import teamTypingImg from '@/assets/home/team_agent.svg'
import { defaultMemberAvatar } from '@/shared/utils/memberAvatar.js'
import RemoteTypingIndicator from '@/shared/components/message/RemoteTypingIndicator.vue'
import { fetchDigitalHumans } from '@/shared/services/orgApi'

const props = defineProps({
  conversationId: { type: String, required: true },
  groupId: { type: String, required: true },
  memberAgentIds: { type: Array, default: () => [] },
  hideMessages: { type: Boolean, default: false },
})

const groupStore = useGroupStore()
const listRef = ref(null)
const localLoadMoreHintVisible = ref(false)
let loadMoreHintTimer = null
const LOAD_MORE_HINT_MIN_MS = 500

/** 底部输入区外层，反馈条竖直方向的兜底锚点（与 MessageList 一致） */
const composerTopAnchorRef = ref(null)
/** 实际输入框壳（.input-wrapper），由 GroupChatInput watchEffect 写入 */
const composerInputBoxRef = ref(null)
provide(CHAT_COMPOSER_TOP_ANCHOR_KEY, composerTopAnchorRef)
provide(CHAT_COMPOSER_INPUT_BOX_KEY, composerInputBoxRef)
provide(FORCE_SCROLL_TO_BOTTOM_KEY, () => handleScrollToBottom())

// 冻结 conversationId/groupId：父组件通过 :key 切换群组时会创建新实例
const frozenConversationId = props.conversationId
const frozenGroupId = props.groupId
const memberAgentIds = props.memberAgentIds

// 初始加载期间关闭 TransitionGroup 动画，避免历史消息批量飞入
const ready = ref(false)
// imBotId → { name, avatar } 映射，用于助手消息优先展示数字人信息
const digitalHumanMap = ref(new Map())
onMounted(() => {
  nextTick(() => { ready.value = true })
  fetchDigitalHumans({ status: 'online' }).then(list => {
    const map = new Map()
    for (const dh of list) {
      if (dh.imBotId) map.set(String(dh.imBotId), dh)
    }
    digitalHumanMap.value = map
  }).catch(() => {})
})

const {
  messages, messageCount, streamingContent, remoteTypingCount,
  showHistoryLoading,
  latestFinishedAssistantMessageId, showRemoteTyping, suppressScrollToBottomForPrepend,
  stableMessageId, resolveListConversationId,
} = useGroupMessageListCore(frozenGroupId)

/** 群聊不展示团队助理欢迎语，与 store 时间线一致 */
const messageRowsForRender = computed(() => {
  const msgs = messages.value
  return msgs.map((msg, idx) => {
    const senderProfile = memberProfileMap.value.get(msg.senderId)
    const digitalHuman = digitalHumanMap.value.get(String(msg.senderId))
    return {
      key: stableMessageId(msg),
      message: msg,
      senderDisplayName: (msg.senderDisplayName && String(msg.senderDisplayName).trim()) ||
                    (digitalHuman?.name && String(digitalHuman.name).trim()) ||
                    senderProfile?.displayName ||
                    (msg.senderName && String(msg.senderName).trim()) ||
                    '',
      senderAvatarUrl: (digitalHuman?.avatar && String(digitalHuman.avatar).trim()) ||
                  senderProfile?.avatarHttpUrl ||
                  (msg.senderAvatar && String(msg.senderAvatar).trim()) ||
                  '',
      systemTimeLabel: groupSystemTimeLabel(msgs, idx),
      isTight: idx > 0 && sameCalendarMinuteAsPrevious(msgs, idx),
    }
  })
})

/** 创建群聊 / 邀请 / 加入 / 移除（kick）/ 退出（leave）：同自然分钟只首条上方显示时间 */
function isGroupSystemTimeRowMsg(msg) {
  const type = msg?.type
  return (
    msg?.role === 'system' &&
    (type === 'group.created' ||
      type === 'member.joined' ||
      type === 'member.kicked' ||
      type === 'member.left')
  )
}

function groupSystemTimeLabel(list, idx) {
  const msg = list[idx]
  if (!isGroupSystemTimeRowMsg(msg)) return ''
  const t = messageTimestampMs(msg)
  if (Number.isNaN(t)) return ''
  // 去除按时间合并逻辑，每条系统消息都显示时间标签
  return formatGroupSystemTimeLabel(t)
}

// 引用消息状态
const quotingMessage = ref(null)
/** 每次点击引用递增，确保子组件 watch 必触发（避免与上条为同一对象引用时 Object.is 跳过） */
const quoteRequestSerial = ref(0)
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
} = useMessageLocate({ scope: 'group', id: frozenGroupId, listRef })

const scrollingToBottom = ref(false)

async function handleScrollToBottom() {
  if (scrollingToBottom.value) return
  scrollingToBottom.value = true
  try {
    exitLocating()
    const rc = groupStore.conversationMessages[frozenGroupId]
    if (rc?.isContextWindow || groupStore.hasMoreForward(frozenGroupId)) {
      await groupStore.reloadLatest(frozenGroupId)
    }
    forceScrollToBottom()
  } finally {
    scrollingToBottom.value = false
  }
}

watch(messages, (newMsgs, oldMsgs) => {
  const rc = groupStore.conversationMessages[frozenGroupId]
  if (!rc?.isContextWindow) return
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

const showLoadMoreHint = computed(() =>
  groupStore.isConversationLoadingMoreHistory(frozenGroupId) || localLoadMoreHintVisible.value,
)

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

// 群聊成员 profile 映射：从 store.conversationMembers 派生
const memberProfileMap = computed(() => {
  const members = groupStore.conversationMembers[frozenGroupId] ?? []
  const map = new Map()
  for (const m of members) {
    map.set(m.userId, m)
  }
  return map
})

// 系统通知用：将 Map 转为普通对象，供 GroupMessageItem.memberProfileMap 使用
const memberProfileMapAsObject = computed(() => {
  const obj = {}
  memberProfileMap.value.forEach((v, k) => { obj[k] = v })
  return obj
})




/** 所有正在 typing 的用户展示信息列表，支持多个思考进程并行 */
const typingUserList = computed(() => {
  const ids = groupStore.conversationMessages[frozenGroupId]?.remoteTypingUserIds ?? []
  return ids.map(uid => {
    const p = memberProfileMap.value.get(uid)
    const displayName = String(p?.displayName || uid).trim() || String(uid)
    const avatarSrc = (p?.avatarHttpUrl ?? p?.avatarUrl ?? defaultMemberAvatar) || defaultMemberAvatar
    return { uid, displayName, avatarSrc }
  })
})

function onTypingAssistantAvatarError(e) {
  const el = e.target
  if (el?.dataset?.avatarFallback === '1') {
    el.style.display = 'none'
    return
  }
  el.dataset.avatarFallback = '1'
  el.src = teamTypingImg
}

/** 防止上滑分页连续触发两次请求 */
const loadOlderLocked = ref(false)

onUnmounted(() => {
  if (loadMoreHintTimer) {
    clearTimeout(loadMoreHintTimer)
    loadMoreHintTimer = null
  }
})

attachScrollTriggers(
  messageCount, streamingContent, remoteTypingCount,
  () => {
    const conversationId = resolveListConversationId()
    if (!conversationId || loadOlderLocked.value) return
    const el = listRef.value
    if (!el) return

    if (groupStore.isConversationLoadingMoreHistory(conversationId) ||
        !groupStore.canLoadMoreHistory(conversationId)) return
    loadOlderLocked.value = true
    const hintStartedAt = beginLoadMoreHint()
    suppressScrollToBottomForPrepend.value = true
    const prevScrollHeight = el.scrollHeight
    const prevScrollTop = el.scrollTop
    groupStore.loadMoreHistory(conversationId).then(({ added }) => {
      if (added > 0) {
        const anchor = () => applyPrependScrollAnchor(listRef.value, prevScrollHeight, prevScrollTop)
        nextTick().then(() => nextTick().then(() => {
          anchor()
          requestAnimationFrame(() => { anchor(); requestAnimationFrame(() => { anchor(); setTimeout(anchor, 340); setTimeout(anchor, 720) }) })
        }))
      }
    }).finally(() => {
      endLoadMoreHint(hintStartedAt)
      loadOlderLocked.value = false
      nextTick().then(() => requestAnimationFrame(() => requestAnimationFrame(() => { suppressScrollToBottomForPrepend.value = false })))
    })
  }
)

function onActivate() {
  if (shouldSkipAutoScrollOnActivate.value) return
  forceScrollToBottom()
}

defineExpose({ onActivate })
</script>

<style scoped>
.message-list-root {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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

.message-list-scroll.is-streaming {
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
  mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
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

.messages-wrapper--message-stack :deep(.message-item.assistant) {
  margin-top: 24px;
}

/* .messages-wrapper--message-stack :deep(.message-item.user) {
  margin-top: 10px;
} */

.messages-wrapper--message-stack :deep(.message-item.member) {
  margin-top: 16px;
}

/* .messages-wrapper--message-stack :deep(.message-item:first-child) {
  margin-top: 0;
} */

.group-system-time {
  text-align: center;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  padding: 8px 16px 2px;
  user-select: none;
}


.messages-wrapper--message-stack :deep(.message-item.system) {
  margin-top: 2px;
}

/* RemoteTypingIndicator 边距控制 */
:deep(.remote-typing-block) {
  margin-top: 12px !important;
  margin-bottom: 16px !important;
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

/* Message transitions */
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

/* 快速到底部按钮 */
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
