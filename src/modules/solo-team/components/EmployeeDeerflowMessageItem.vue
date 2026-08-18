<template>
  <div
    class="message-item"
    :class="[message.role]"
    :data-message-id="message.id || ''"
    @click.capture="handleLinkClick"
  >
    <!-- Assistant message -->
    <template v-if="message.role === 'assistant'">
      <div v-if="!isEmptyStreamingPlaceholder" class="assistant-block">
        <div class="assistant-aside">
          <div class="assistant-avatar" :class="{ 'is-thinking': message.isStreaming }">
            <img
              :src="avatarImg"
              alt="assistant"
              class="avatar-img"
              @error="onAssistantAvatarError"
            />
            <OverflowTooltipText :text="avatarName" custom-class="avatar-name" />
            <span v-if="messageTime" class="assistant-time">{{ messageTime }}</span>
          </div>
        </div>
        <div class="msg-body assistant-body">
          <!-- 工具调用卡片 -->
          <EmployeeStreamToolCallCard
            v-if="message.toolSteps && message.toolSteps.length"
            :steps="message.toolSteps"
            :is-loading="!!message.isStreaming"
          />

          <!-- 子任务卡片 -->
          <EmployeeSubtaskCard
            v-for="subtask in (message.subtasks || [])"
            :key="subtask.id"
            :subtask="subtask"
          />

          <!-- 引用块 -->
          <EmployeeDeerflowQuoteBlock
            v-if="showReplyQuote"
            style="padding: 5px 10px;"
            :reply-to="message.replyTo"
            :assistant-name="assistantName"
            @scroll-to-quote="emit('scroll-to-quote', $event)"
          />

          <!-- 推理块：有推理内容，或流式中尚无正文/工具步骤时显示「思考中…」占位 -->
          <EmployeeStreamReasoningBlock
            v-if="assistantDisplay.reasoning || (message.isStreaming && !assistantDisplay.content && !(message.toolSteps && message.toolSteps.length))"
            :content="assistantDisplay.reasoning || ''"
            :is-streaming="!!message.isStreaming && !assistantDisplay.content"
            :duration="message.reasoningDuration || 0"
          />

          <!-- 主文本内容（已剥离 <think>） -->
          <EmployeeChatMarkdownContent
            v-if="assistantDisplay.content"
            :content="assistantDisplay.content"
            :is-streaming="!!message.isStreaming"
            enable-inline-svg-cards
            :svg-card-space-id="svgCardSpaceId || spaceId"
            :svg-card-room-type="kcMediaRoomType"
          />

          <!-- 流式生成中：闪烁光标 -->
          <span v-if="message.isStreaming && assistantDisplay.content" class="streaming-cursor" />

          <!-- Images (图片) -->
          <div v-if="message.images && message.images.length" class="images-section">
            <div v-for="(img, idx) in message.images" :key="idx" class="image-item">
              <img
                v-if="img.data"
                :src="`data:${img.mediaType || 'image/png'};base64,${img.data}`"
                alt="图片"
                class="msg-image"
              />
              <img v-else-if="img.url" :src="img.url" alt="图片" class="msg-image" />
            </div>
          </div>

          <!-- Steps (多步执行) -->
          <div v-if="message.steps && message.steps.length" class="msg-steps">
            <div v-for="(step, i) in message.steps" :key="i" class="step-item">
              <span class="step-icon" :class="step.status">
                <template v-if="step.status === 'done'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22c55e"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </template>
                <template v-else>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="2"/></svg>
                </template>
              </span>
              <span class="step-text">{{ step.text }}</span>
            </div>
          </div>

          <!-- 附件卡片 -->
          <EmployeeChatAttachmentCards
            v-if="message.attachments && message.attachments.length"
            :attachments="message.attachments"
            :space-id="spaceId"
            :message-timestamp="messageTimestamp"
            role="assistant"
          />

          <!-- 操作栏：线程级流式进行中时仅当前正在输出的消息显示操作区（与分身 Deerflow 一致） -->
          <EmployeeChatMessageActions
            v-if="!globalIsStreaming || message.isStreaming"
            :content="assistantDisplay.content || ''"
            :message="message"
            :is-streaming="!!message.isStreaming"
            :show-always="isLastAssistantMessage"
            :show-forward-to-kode="isYunfanAgent"
            @quote="emit('quote', $event)"
            @copy="emit('copy', $event)"
            @feedback="(id, type) => emit('feedback', id, type)"
            @regenerate="emit('regenerate', $event)"
            @forward-to-kode="emit('forward-to-kode', $event)"
          />
        </div>
      </div>
    </template>

    <!-- Tool message: 不单独渲染（已合并到 AI 消息的 toolSteps） -->
    <template v-else-if="message.type === 'tool' || message.role === 'tool'" />

    <!-- User message -->
    <template v-else>
      <div class="msg-body user-body">
        <div class="user-bubble-wrapper">
          <div class="user-header">
            <span v-if="messageTime" class="user-time">{{ messageTime }}</span>
            <div class="user-avatar-wrapper">
              <img :src="userAvatarSrc" alt="用户头像" class="user-avatar" @error="onUserAvatarError" />
            </div>
          </div>
          <div class="user-content-wrapper">
            <div v-if="hasUserTextContent" class="user-bubble">
              <!-- 技能标签 -->
              <div v-if="messageSkills.length > 0" class="user-message-skills">
                <SkillTag
                  v-for="skill in messageSkills"
                  :key="skill.id || skill.slug"
                  :skill="skill"
                  :readonly="true"
                  class="user-message-skill-tag"
                />
              </div>
              <!-- 引用块：优先使用 replyTo（新发消息），否则从 Markdown 提取（历史消息） -->
              <EmployeeDeerflowQuoteBlock
                v-if="showReplyQuote"
                style="margin: 5px 10px;"
                :reply-to="message.replyTo"
                :assistant-name="assistantName"
                @scroll-to-quote="emit('scroll-to-quote', $event)"
              />
              <template v-else>
                <EmployeeDeerflowQuoteBlock
                  v-for="(quote, idx) in extractedQuotes"
                  :key="`quote-${idx}`"
                  style="margin: 5px 10px;"
                  :reply-to="quote"
                  :assistant-name="assistantName"
                  @scroll-to-quote="emit('scroll-to-quote-by-content', quote.content)"
                />
              </template>
              <div class="user-bubble-content" v-html="renderedContent" />
            </div>
            <!-- 用户附件 -->
            <EmployeeChatAttachmentCards
              v-if="message.attachments && message.attachments.length"
              :attachments="message.attachments"
              :space-id="spaceId"
              :message-timestamp="messageTimestamp"
              role="user"
            />
            <div v-if="showUserMessageActions" class="user-bubble-actions">
              <EmployeeChatMessageActions
                action-mode="user"
                :content="message.content || ''"
                :message="message"
                @quote="emit('quote', $event)"
                @copy="emit('copy', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'
import defaultAgentAvatar from '@/assets/soloTeam/default_agent.svg'
import EmployeeChatMarkdownContent from './EmployeeChatMarkdownContent.vue'
import EmployeeStreamToolCallCard from './EmployeeStreamToolCallCard.vue'
import EmployeeStreamReasoningBlock from './EmployeeStreamReasoningBlock.vue'
import EmployeeSubtaskCard from './EmployeeSubtaskCard.vue'
import EmployeeChatMessageActions from './EmployeeChatMessageActions.vue'
import EmployeeDeerflowQuoteBlock from './EmployeeDeerflowQuoteBlock.vue'
import EmployeeChatAttachmentCards from './EmployeeChatAttachmentCards.vue'
import SkillTag from '@/shared/components/skill/SkillTag.vue'
import { handleMessageContentLinkClick as handleLinkClick } from '@/shared/utils/messageContentLinkClick'
import { useUserStore } from '@/modules/auth/store'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { useEmployeeChatUserBubbleMarkdown } from '../composables/useEmployeeChatUserBubbleMarkdown'
import { defaultMemberAvatar } from '@/shared/utils/memberAvatar.js'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { useSoloTeamStore } from '../store'
import { formatRelativeTime } from '../composables/useEmployeeDeerflowTimestamp'
import { splitInlineReasoning } from '../utils/employeeChatMessageUtils.js'
import { resolveAssistantDisplayName } from '../utils/assistantDisplayName.mjs'

defineOptions({ name: 'EmployeeDeerflowMessageItem' })

const emit = defineEmits(['quote', 'copy', 'feedback', 'scroll-to-quote', 'scroll-to-quote-by-content', 'regenerate', 'forward-to-kode'])

const userStore = useUserStore()
const collabEmployeeStore = useCollaborationEmployeeChatStore()
// 仅当当前对话的协作数字人 = 云帆数字人（agent_id 1007）时显示「📥 转发到 Kode」
const isYunfanAgent = computed(() => {
  const emp = collabEmployeeStore?.currentEmployee
  return Number(emp?.id ?? emp?.agent_id) === 1007
})
const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const employeeSessionStore = injectedSessionStore ?? useSoloTeamStore()

/** 一人团队用 super_person_chat，我的员工用 employee_chat */
const kcMediaRoomType = computed(() =>
  employeeSessionStore.employeeChatMode === 'one_person_team' ? 'super_person_chat' : 'employee_chat'
)

const props = defineProps({
  message: { type: Object, required: true },
  spaceId: { type: String, default: '' },
  messageTimestamp: { type: Number, default: 0 },
  assistantName: { type: String, default: '' },
  /** 数字人头像（已由列表解析接口 URL + 默认图）；缺省时用 default_agent.svg */
  assistantAvatarSrc: { type: String, default: '' },
  /** 当前线程是否在流式输出（用于与分身一致：非当前输出中的助手消息隐藏操作栏） */
  globalIsStreaming: { type: Boolean, default: false },
  isLastAssistantMessage: { type: Boolean, default: false },
  svgCardSpaceId: { type: [String, Number], default: '' },
})

const avatarImg = computed(() => {
  const s = String(props.assistantAvatarSrc || '').trim()
  return s || defaultAgentAvatar
})

function onAssistantAvatarError(e) {
  const el = e?.target
  if (!el || el.dataset?.avatarFallback === '1') return
  el.dataset.avatarFallback = '1'
  el.src = defaultAgentAvatar
}
const avatarName = computed(() => resolveAssistantDisplayName(props.message, props.assistantName))

const showReplyQuote = computed(() => {
  const rt = props.message?.replyTo
  return rt && typeof rt === 'object' && rt.id
})

const isEmptyStreamingPlaceholder = computed(() => {
  if (props.message?.role !== 'assistant' || !props.message?.isStreaming) return false
  if (props.message?.content) return false
  if (props.message?.toolSteps?.length) return false
  if (props.message?.subtasks?.length) return false
  return true
})

/**
 * 助手消息的展示内容与推理内容（兼容流式 & 历史消息）：
 * - 历史消息：loadMessages 时已将 reasoning 提到 message.reasoning，content 已剥离
 * - 流式中：content 可能还包含 <think>...</think>，用计算属性实时剥离展示
 */
const assistantDisplay = computed(() => {
  if (props.message?.role !== 'assistant') {
    return { content: props.message?.content || '', reasoning: null }
  }
  const raw = String(props.message?.content || '')
  // 若 store 已提取 reasoning，则 content 不再含 <think>；否则实时剥离
  if (props.message?.reasoning) {
    return { content: raw, reasoning: props.message.reasoning }
  }
  const { content, reasoning } = splitInlineReasoning(raw)
  return { content, reasoning }
})

const hasUserTextContent = computed(() => {
  if (messageSkills.value.length > 0) return true
  const raw = String(props.message?.content ?? '').trim()
  if (!raw) return false
  const stripped = raw.replace(/<skill_activation>[\s\S]*?<\/skill_activation>/g, '').trim()
  return stripped.length > 0
})

const hasUserAttachments = computed(
  () => Array.isArray(props.message?.attachments) && props.message.attachments.length > 0,
)

const showUserMessageActions = computed(
  () => hasUserTextContent.value || hasUserAttachments.value,
)

const { renderedContent, extractedQuotes } = useEmployeeChatUserBubbleMarkdown(() => props.message)

const userAvatarSrc = computed(() => userStore.avatar || defaultMemberAvatar)

function onUserAvatarError(e) {
  e.target.src = defaultMemberAvatar
}

const messageSkills = computed(() => props.message?.skills || [])

const messageTime = computed(() => {
  const ts = props.message?.timestamp
    ?? props.message?.additional_kwargs?.created_at
    ?? props.message?.raw?.additional_kwargs?.created_at
  return formatRelativeTime(ts)
})
</script>

<style lang="scss" scoped>
.message-item {
  display: flex;
  gap: 10px;
}

.message-item.user {
  justify-content: flex-end;
  width: 100%;
  animation: none;
}

.message-item.assistant {
  align-items: flex-start;
}

.assistant-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-top: 2px;
}

.assistant-block > .assistant-body {
  margin-top: 8px;
  align-self: stretch;
}

.assistant-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 16px;
}

.assistant-avatar {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

:deep(.avatar-name) {
  margin-left: 10px;
  white-space: nowrap;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
  color: #2F3547;
}

.assistant-time {
  flex-shrink: 0;
  margin-left: 4px;
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-item:hover .assistant-time {
  opacity: 1;
}

.avatar-img {
  position: relative;
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.msg-body {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  margin-left: 4px;
}

.user-body {
  align-items: flex-end;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.user-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: min(70%, 1000px);
  min-width: 0;
  box-sizing: border-box;
}

.user-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.user-avatar-wrapper { flex-shrink: 0; }

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.user-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.user-message-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  position: relative;
  top: 3px;
}

.user-message-skill-tag { pointer-events: none; }

.user-time {
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-item.user:hover .user-time { opacity: 1; }

.user-bubble-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.user-bubble-wrapper:hover .user-bubble-actions :deep(.msg-actions),
.message-item.user:hover .user-bubble-actions :deep(.msg-actions) {
  visibility: visible;
}

.user-bubble {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 13px 16px;
  gap: 8px;
  border-radius: 8px 0px 8px 8px;
  background: #F3F5F7;
  min-height: 38px;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.user-bubble-content {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  // line-height: 20px;
  color: #2F3547;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  min-width: 0;
}

.user-bubble-content :deep(p) {
  margin: 0;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 助手操作栏 hover 显示 */
.assistant-body:hover :deep(.msg-actions),
.message-item.assistant:hover :deep(.msg-actions) {
  visibility: visible;
}

/* Steps */
.msg-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.step-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Images */
.images-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.msg-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  object-fit: contain;
}

/* 流式光标 */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--text-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursorBlink 0.8s step-start infinite;
}

@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 用户气泡 Markdown 样式 */
.user-bubble :deep(pre) {
  background: var(--bg-secondary);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin: 6px 0;
  overflow-x: auto;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.user-bubble :deep(pre code) {
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
}

.user-bubble :deep(code) {
  background: var(--bg-secondary);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.user-bubble :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.user-bubble :deep(a:hover) {
  text-decoration: underline;
}

.user-bubble :deep(blockquote) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 10px;
  padding: 0;
  border: none;
  background: #f5f6f9;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  color: #91949e;
  cursor: pointer;

  &:hover {
    background: #eef0f4;
  }

  &::before {
    content: '';
    flex-shrink: 0;
    width: 2px;
    height: 14px;
    border-radius: 2px;
    background: #C2C3C9;
    margin-left: 8px;
  }
}
.user-bubble p {
  margin: 4px 0px;
}
.user-bubble :deep(ul) {
  list-style: disc;
  padding-left: 20px;
  margin: 4px 0;
}

.user-bubble :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.user-bubble :deep(li) {
  padding-left: 4px;
  margin: 2px 0;
}
</style>
