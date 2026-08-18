<template>
  <div
    class="message-list-root"
    :class="{ 'message-list-root--employee-welcome-full-bleed-bg': showEmployeeWelcomeFullBleedBg }"
  >
    <div
      ref="listRef"
      class="message-list-scroll custom-scrollbar"
      :class="{
        'is-streaming': isStreaming,
        'message-list-scroll--employee-welcome-full-bleed-bg': showEmployeeWelcomeFullBleedBg,
      }"
    >
      <div v-if="loading" class="empty-state">
        <img src="@/assets/chat/no_message.png" alt="" class="empty-crab" />
        <p class="empty-text">正在载入消息…</p>
      </div>

      <div
        v-else-if="!messages.length && !sending && !isStreaming"
        class="empty-state empty-state--welcome"
      >
        <div
          class="welcome-panel"
          :class="{ 'welcome-panel--employee-welcome-full-bleed': showEmployeeWelcomeFullBleedBg }"
          :style="welcomePanelComputedStyle"
        >
          <div class="welcome-hero-block">
            <div class="welcome-hero">
              <div class="welcome-hero__avatar-wrap">
                <img :src="welcomeAvatarSrc" alt="" class="welcome-hero__avatar" />
              </div>
              <p class="welcome-hero__title">{{ employee?.name || '专属数字员工' }}</p>
            </div>
            <p class="welcome-hero__desc">{{ truncateWelcomeDesc(employeeDescription) }}</p>
          </div>

          <div v-if="displayedWelcomeActions.length" class="welcome-actions">
            <div v-if="showWelcomePromptRotate" class="welcome-actions__header">
              <button type="button" class="welcome-actions__refresh" @click="rotateWelcomeActions">
                <img :src="refreshIcon" alt="" class="welcome-actions__refresh-icon" width="14" height="14" />
                <span>换一换</span>
              </button>
            </div>

            <div
              class="welcome-actions__list"
              :class="{
                // 与输入框欢迎条一致：按「当前这一屏展示的条数」决定单行/多列样式（总条数>1 但分页后仅 1 条时也应居中宽卡）
                'welcome-actions__list--single': displayedWelcomeActions.length === 1,
                'welcome-actions__list--equal': displayedWelcomeActions.length > 1,
              }"
            >
              <button
                v-for="item in displayedWelcomeActions"
                :key="`${welcomeBatchIndex}-${item.id}`"
                type="button"
                class="welcome-action-card"
                :class="`welcome-action-card--${item.tone}`"
                @click="handleWelcomePromptCardClick(item)"
              >
                <div class="welcome-action-card__title">
                  <img
                    v-if="item.iconUrl"
                    :src="item.iconUrl"
                    alt=""
                    class="welcome-action-card__icon"
                  />
                  <span v-else class="welcome-action-card__emoji">{{ item.emoji }}</span>
                  <span>{{ item.title }}</span>
                </div>
                <p class="welcome-action-card__desc">{{ item.desc }}</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      <TransitionGroup
        v-else-if="messages.length > 0"
        name="msg"
        tag="div"
        class="messages-wrapper"
      >
        <EmployeeLoadOlderSentinel
          key="load-older-sentinel"
          :list-ref="listRef"
          :has-more="hasMore"
          :loading-older="loadingOlderPage"
          :ledger-backfill-pending="ledgerBackfillPending"
          :thread-db-id="threadDbId"
          :persisted-count="persistedCount"
          :scroll-anchor-ref="scrollAnchorRef"
          :on-fetch-older="handleFetchOlder"
          :on-after-restore="handleAfterRestore"
        />
        <div
          v-if="isVirtualEnabled && renderStart > 0"
          key="load-more-top"
          class="load-more-top"
          @click="handleVirtualLoadMore"
        >
          加载更早的消息
        </div>
        <template v-for="(message, index) in visibleItems" :key="message.id">
          <div v-if="getDateLabel(index)" class="date-separator">
            <span class="date-label">{{ getDateLabel(index) }}</span>
          </div>
          <component
            :is="EmployeeDeerflowMessageItem"
            :message="message"
            :assistant-name="employee?.name || ''"
            :assistant-avatar-src="employeeAvatarDisplaySrc"
            :space-id="spaceId"
            :svg-card-space-id="svgCardSpaceId"
            :message-timestamp="message.timestamp"
            :global-is-streaming="isStreaming"
            :is-last-assistant-message="message.id === lastAssistantMessageId"
            @quote="emit('quote', $event)"
            @copy="emit('copy', $event)"
            @feedback="(id, type) => emit('feedback', id, type)"
            @scroll-to-quote="handleScrollToQuote"
            @scroll-to-quote-by-content="handleScrollToQuoteByContent"
            @regenerate="emit('regenerate', $event)"
            @forward-to-kode="emit('forward-to-kode', $event)"
          />
        </template>
      </TransitionGroup>

      <div v-if="isStreaming && !hasStreamingContent" class="typing-indicator">
        <!-- <div class="typing-dots">
          <span /><span /><span />
        </div> -->
        <span class="typing-text">正在思考…</span>
      </div>
    </div>

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
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import EmployeeDeerflowMessageItem from './EmployeeDeerflowMessageItem.vue'
import EmployeeLoadOlderSentinel from './EmployeeLoadOlderSentinel.vue'
import { useEmployeeDeerflowScroll } from '../composables/useEmployeeDeerflowScroll'
import { useEmployeeDeerflowVirtualScroll } from '../composables/useEmployeeDeerflowVirtualScroll'
import { getDateSeparator } from '../composables/useEmployeeDeerflowTimestamp'
import { useEmployeeWelcomePrompts } from '../composables/useEmployeeWelcomePrompts'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { useSoloTeamStore } from '../store'
import welcomeCollaborationWelcomeBgUrl from '@/assets/soloTeam/bg1.png'
import refreshIcon from '@/assets/soloTeam/refresh_icon.svg'
import { resolveEmployeeAvatarSrc } from '../utils/employeeChatAvatar'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'

defineOptions({ name: 'EmployeeMessageList' })

const props = defineProps({
  messages: { type: Array, default: () => [] },
  employee: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  /** 发送中（含流式整段生命周期），用于避免短暂空列表时闪现欢迎页 */
  sending: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  welcomeMessage: { type: String, default: '' },
  spaceId: { type: String, default: '' },
  /** false：一人团队 / 我的员工不请求提示词接口；协作数字人传 true */
  fetchWelcomePrompts: { type: Boolean, default: true },
})

const emit = defineEmits(['quote', 'copy', 'feedback', 'regenerate', 'welcome-prompt-pick', 'forward-to-kode'])
const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const chatStore = injectedSessionStore ?? useSoloTeamStore()

const listRef = ref(null)
const hasStreamingContent = computed(() => props.messages.some(message => message.isStreaming && message.content))
const messagesRef = computed(() => props.messages)
const { showScrollToBottom, forceScrollToBottom, attachScrollTriggers } = useEmployeeDeerflowScroll(listRef)
const { visibleItems, isVirtualEnabled, renderStart, loadMoreTop } = useEmployeeDeerflowVirtualScroll({
  items: messagesRef,
  listRef,
  threshold: 50,
})

const threadDbId = computed(() => chatStore.currentEmployeeThreadId ?? null)
const svgCardSpaceId = computed(() => chatStore.employeeSkillBindingAgentId || props.spaceId || 'solo-team-employee')
const hasMore = computed(() => chatStore.currentEmployeeHasMore)
const loadingOlderPage = computed(() => chatStore.currentEmployeeLoadingOlderPage)
const ledgerBackfillPending = computed(() => chatStore.currentEmployeeLedgerBackfillPending)
const persistedCount = computed(() => chatStore.currentEmployeePersistedMessageCount)
const scrollAnchorRef = computed(() => chatStore.currentEmployeeScrollAnchor)

const lastAssistantMessageId = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const msg = props.messages[i]
    if (msg.role === 'assistant' && !msg.isStreaming) {
      return msg.id
    }
  }
  return null
})

async function handleFetchOlder(anchor) {
  const eid = chatStore.currentEmployeeId
  const tid = threadDbId.value
  if (!eid || tid == null) return
  const state = chatStore.getEmployeeThreadState(eid, tid)
  if (state) state.scrollAnchor = anchor
  await chatStore.loadEmployeeOlderPage(eid, tid)
}

function handleAfterRestore() {
  const eid = chatStore.currentEmployeeId
  const tid = threadDbId.value
  if (!eid || tid == null) return
  const state = chatStore.getEmployeeThreadState(eid, tid)
  if (state) state.scrollAnchor = null
}

function handleVirtualLoadMore() {
  const eid = chatStore.currentEmployeeId
  const tid = threadDbId.value
  if (!eid || tid == null) return
  chatStore.loadEmployeeOlderPage(eid, tid)
}

const messageCount = computed(() => props.messages.length)
const streamingContent = computed(() => {
  const last = props.messages[props.messages.length - 1]
  return last?.isStreaming ? last.content : null
})
const employeeAgentIdForPrompts = computed(() => {
  const id = props.employee?.id ?? props.employee?.agent_id ?? props.employee?.agentId
  if (id == null || id === '') return ''
  return String(id).trim()
})
const {
  welcomeInputWidth,
  welcomeBatchIndex,
  displayedWelcomeActions,
  rotateWelcomeActions,
  showWelcomePromptRotate,
} = useEmployeeWelcomePrompts(employeeAgentIdForPrompts, {
  fetchWelcomePrompts: toRef(props, 'fetchWelcomePrompts'),
})

/** 数字员工欢迎空态（一人团队 / 协作）：铺 bg1 至 shell（含 solo-team-header） */
const showEmployeeWelcomeFullBleedBg = computed(() => {
  if (props.loading) return false
  if (props.messages.length || props.sending || props.isStreaming) return false
  return true
})

const welcomePanelComputedStyle = computed(() => {
  const maxW = Math.max(240, Math.round(welcomeInputWidth.value || 760))
  const base = { maxWidth: `${maxW}px` }
  if (props.fetchWelcomePrompts && !showEmployeeWelcomeFullBleedBg.value) {
    return {
      ...base,
      backgroundImage: `url(${welcomeCollaborationWelcomeBgUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center top',
      backgroundSize: 'cover',
      borderRadius: '12px',
      padding: '24px 20px 28px',
      boxSizing: 'border-box',
    }
  }
  return base
})
const employeeDescription = computed(() => {
  return props.employee?.description || props.welcomeMessage || '暂无消息，开始对话吧'
})

/** 欢迎页名称（兼容 API number 等类型） */
const welcomeEmployeeName = computed(() => {
  const n = props.employee?.name
  if (n == null || n === '') return '专属数字员工'
  return String(n).trim() || '专属数字员工'
})

const employeeAvatarDisplaySrc = computed(() => resolveEmployeeAvatarSrc(props.employee))
const welcomeAvatarSrc = employeeAvatarDisplaySrc

watch(
  () => props.messages.length,
  () => {
    if (loadingOlderPage.value) return
    nextTick(() => {
      const el = listRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
)

const spaceId = computed(() => props.spaceId || 'solo-team-employee')

attachScrollTriggers(messageCount, streamingContent, () => {
  loadMoreTop()
}, loadingOlderPage)

let welcomeInputResizeObserver = null

onMounted(() => {
  nextTick(() => {
    const host = listRef.value?.closest('.employee-chat-panel')
    const inputWrapper = host?.querySelector('.deerflow-input-wrapper .input-wrapper')
    if (!inputWrapper) return
    welcomeInputWidth.value = inputWrapper.getBoundingClientRect().width || 760
    welcomeInputResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = entry?.contentRect?.width
      if (width) {
        welcomeInputWidth.value = width
      }
    })
    welcomeInputResizeObserver.observe(inputWrapper)
  })
})

onBeforeUnmount(() => {
  welcomeInputResizeObserver?.disconnect()
  welcomeInputResizeObserver = null
})

function getDateLabel(index) {
  const actualIndex = isVirtualEnabled.value ? renderStart.value + index : index
  return getDateSeparator(props.messages, actualIndex)
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
  const current = props.messages.find(m => m.replyTo && m.replyTo.id === messageId)
  if (current?.replyTo?.content) {
    handleScrollToQuoteByContent(current.replyTo.content)
  }
}

function handleScrollToQuoteByContent(content) {
  if (!listRef.value || !content) return
  const normalized = String(content).trim()
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

const WELCOME_DESC_MAX_CHARS = 40

/** 按 Unicode 码位截断，最多 max 个字符；超出加省略号（与容器宽度无关） */
function truncateWelcomeDesc(text, max = WELCOME_DESC_MAX_CHARS) {
  const s = String(text ?? '')
  const chars = [...s]
  if (chars.length <= max) return s
  return `${chars.slice(0, max).join('')}…`
}

function handleWelcomePromptCardClick(item) {
  const text = String(item?.content ?? '').trim()
  if (!text) return
  emit('welcome-prompt-pick', { content: text })
}

</script>

<style lang="scss" scoped>
.message-list-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  background: #fff;
}

.message-list-root--employee-welcome-full-bleed-bg {
  background: transparent;
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
  // justify-content: center;
  gap: 8px;
}

.empty-state--welcome {
  padding: 20px 24px 20px;
  box-sizing: border-box;
}

.message-list-scroll--employee-welcome-full-bleed-bg .empty-state--welcome {
  padding: 20px 24px 28px;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
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

.welcome-panel {
  width: 100%;
  max-width: 760px;
  // display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.welcome-panel--employee-welcome-full-bleed {
  width: 100%;
}

.welcome-hero-block {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.welcome-hero {
  box-sizing: border-box;
  width: 370px;
  max-width: 100%;
  height: 370px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  padding: 24px 16px;
  padding-top: 103px;
  border-radius: 4px;
  overflow: hidden;
  background-image: url('@/assets/soloTeam/welcome-bg.png');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
  display: flex;
  flex-direction: column;
  align-items: center;
  // justify-content: center;
}

.welcome-hero__avatar-wrap {
  width: 148px;
  height: 148px;
  margin-bottom: 24px;
  border-radius: 50%;
  flex: 0 0 148px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.welcome-hero__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.welcome-hero :deep(.overflow-tooltip) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.welcome-hero__title {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 22px;
  height: 33px;
  font-weight: 600;
  color: #2f3547;
  width: 100%;
  max-width: 100%;
  padding: 0 8px;
  box-sizing: border-box;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.welcome-hero__desc {
  max-width: 370px;
  margin: -61px auto 0;
  padding: 0 6px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 20px;
  color: #7d8493;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.welcome-actions {
  margin-top: 12px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.welcome-actions__header {
  display: flex;
  justify-content: flex-end;
}

.welcome-actions__refresh {
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;
}

.welcome-actions__refresh-icon {
  display: block;
  flex-shrink: 0;
}

.welcome-actions__list {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.welcome-actions__list--single {
  justify-content: center;
}

.welcome-actions__list--single .welcome-action-card {
  flex: 0 0 auto;
  width: 480px;
  max-width: 100%;
}

.welcome-actions__list--equal .welcome-action-card {
  flex: 1 1 0;
  min-width: 0;
  width: 0;
  max-width: none;
}

.welcome-action-card {
  flex: 1 1 0;
  min-width: 0;
  text-align: left;
  border: 1px solid #eceef3;
  border-radius: 12px;
  padding: 12px 12px 10px;
  background: #fff;
  min-height: 78px;
  cursor: pointer;
}

.welcome-action-card--gold {
  background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
}

.welcome-action-card--green {
  background: linear-gradient(180deg, #f5fbf2 0%, #fbfdf9 100%);
}

.welcome-action-card--blue {
  background: linear-gradient(180deg, #f4f8ff 0%, #fbfcff 100%);
}

.welcome-action-card--purple {
  background: linear-gradient(180deg, #faf5ff 0%, #fdfbff 100%);
}

.welcome-action-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 18px;
  color: #4b5563;
  font-weight: 600;
}

.welcome-action-card__emoji {
  font-size: 14px;
  line-height: 1;
}

.welcome-action-card__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: cover;
}

.welcome-action-card__desc {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #9aa0ad;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 640px) {
  .empty-state--welcome {
    padding-left: 16px;
    padding-right: 16px;
  }

  .welcome-panel {
    gap: 20px;
  }

  .welcome-hero,
  .welcome-hero__desc {
    width: min(100%, 370px);
    max-width: 370px;
  }
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

.load-more-top {
  text-align: center;
  padding: 8px;
  font-size: 13px;
  color: #3b82f6;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  border-radius: 6px;
}

.load-more-top:hover {
  background: rgba(59, 130, 246, 0.06);
}

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


:deep(.highlight-quote) {
  animation: quoteHighlight 2s ease;
}

@keyframes quoteHighlight {
  0%, 30% { background: rgba(64, 158, 255, 0.1); }
  100% { background: transparent; }
}

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

@keyframes typingFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.typing-text {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  background: linear-gradient(270deg, rgba(47, 53, 71, 0.5) 17%, #2F3547 54%, rgba(47, 53, 71, 0.3) 94%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
}

.message-list-scroll.is-streaming {
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
  mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent 100%);
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
