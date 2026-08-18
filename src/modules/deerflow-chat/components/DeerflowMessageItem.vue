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
            <img :src="avatarImg" alt="assistant" class="avatar-img" />
            <span class="avatar-name">{{ avatarName }}</span>
            <span v-if="messageTime" class="assistant-time">{{ messageTime }}</span>
          </div>
        </div>
        <div class="msg-body assistant-body">
          <!-- 工具调用卡片（与 deer-flow 对齐：只展示输入参数） -->
          <DeerflowToolCallCard
            v-if="message.toolSteps && message.toolSteps.length"
            :steps="message.toolSteps"
            :is-loading="message.isStreaming"
          />

          <!-- 子代理任务卡片（ultra 模式） -->
          <DeerflowSubtaskCard
            v-for="subtask in (message.subtasks || [])"
            :key="subtask.id"
            :subtask="subtask"
            :is-loading="!!message.isStreaming"
          />

          <!-- 引用块 -->
          <DeerflowQuoteBlock
            v-if="showReplyQuote"
            style="padding: 5px 10px;"
            :reply-to="message.replyTo"
            @scroll-to-quote="emit('scroll-to-quote', $event)"
          />

          <!-- 推理块（思考过程，可折叠）：仅在有实际推理内容时显示，等待阶段由底部 typing indicator 承担 -->
          <DeerflowReasoningBlock
            v-if="assistantDisplay.reasoning"
            :content="assistantDisplay.reasoning"
            :is-streaming="!!message.isStreaming && !assistantDisplay.content"
            :duration="message.reasoningDuration || 0"
          />

          <!-- 主文本内容（已剥离 <think>） -->
          <DeerflowMarkdownContent
            v-if="assistantDisplay.content"
            :content="assistantDisplay.content"
            :is-streaming="!!message.isStreaming"
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
          <DeerflowAttachmentCards
            v-if="message.attachments && message.attachments.length"
            :attachments="message.attachments"
            :space-id="spaceId"
            :message-timestamp="messageTimestamp"
            role="assistant"
          />

          <!-- 演示用：分身文件产物卡片（剧本注入，样式复刻 DeerflowAttachmentCards.file-card） -->
          <div
            v-if="message.demoArtifact"
            class="demo-artifact-card"
            role="button"
            tabindex="0"
            @click="onDemoArtifactPreview"
            @keydown.enter.prevent="onDemoArtifactPreview"
          >
            <div class="demo-artifact-left">
              <img :src="mdFileIcon" class="demo-artifact-icon" alt="md" />
              <div class="demo-artifact-info">
                <span class="demo-artifact-name" :title="message.demoArtifact.name">{{ message.demoArtifact.name }}</span>
                <span class="demo-artifact-time">{{ message.demoArtifact.createdAt || demoArtifactDefaultTime }}</span>
              </div>
            </div>
            <div class="demo-artifact-right">
              <div class="demo-artifact-thumb" :style="{ backgroundImage: `url(${mdTypeBgImg})` }">
                <span class="demo-artifact-type-label">MD</span>
              </div>
              <button
                type="button"
                class="demo-artifact-save"
                title="保存到文件库"
                @click.stop="onDemoArtifactSave"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" stroke="#2F3547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 操作栏：流式进行中时隐藏（避免在中间消息上显示操作按钮） -->
          <DeerflowMessageActions
            v-if="!globalIsStreaming || message.isStreaming"
            :content="assistantDisplay.content || ''"
            :message="message"
            :is-streaming="!!message.isStreaming"
            :show-always="isLastAssistantMessage"
            @quote="emit('quote', $event)"
            @copy="emit('copy', $event)"
            @feedback="(id, type) => emit('feedback', id, type)"
            @regenerate="emit('regenerate', $event)"
          />
        </div>
      </div>
    </template>

    <!-- Tool message: 不单独渲染（已合并到 AI 消息的 toolSteps） -->
    <template v-else-if="message.type === 'tool' || message.role === 'tool'">
      <!-- tool 消息不渲染 -->
    </template>

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
              <DeerflowQuoteBlock
                v-if="showReplyQuote"
                style="margin: 5px 10px;"
                :reply-to="message.replyTo"
                @scroll-to-quote="emit('scroll-to-quote', $event)"
              />
              <template v-else>
                <DeerflowQuoteBlock
                  v-for="(quote, idx) in extractedQuotes"
                  :key="`quote-${idx}`"
                  style="margin: 5px 10px;"
                  :reply-to="quote"
                  @scroll-to-quote="emit('scroll-to-quote-by-content', quote.content)"
                />
              </template>
              <div v-if="renderedContent" class="user-bubble-content" v-html="renderedContent" />
            </div>
            <!-- 用户附件 -->
            <DeerflowAttachmentCards
              v-if="message.attachments && message.attachments.length"
              :attachments="message.attachments"
              :space-id="spaceId"
              :message-timestamp="messageTimestamp"
              role="user"
            />
            <div v-if="showUserMessageActions" class="user-bubble-actions">
              <DeerflowMessageActions
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
import { computed } from 'vue'
import individualImg from '@/assets/home/person_chat_head.png'
import DeerflowMarkdownContent from './DeerflowMarkdownContent.vue'
import DeerflowToolCallCard from './DeerflowToolCallCard.vue'
import DeerflowMessageActions from './DeerflowMessageActions.vue'
import DeerflowQuoteBlock from './DeerflowQuoteBlock.vue'
import DeerflowAttachmentCards from './DeerflowAttachmentCards.vue'
import mdFileIcon from '@/assets/file/md@2x.png'
import mdTypeBgImg from '@/assets/chat/md_type.png'
import DeerflowReasoningBlock from './DeerflowReasoningBlock.vue'
import DeerflowSubtaskCard from './DeerflowSubtaskCard.vue'
import SkillTag from '@/shared/components/skill/SkillTag.vue'
import { handleMessageContentLinkClick as handleLinkClick } from '@/shared/utils/messageContentLinkClick'
import { useUserStore } from '@/modules/auth/store'
import { useDeerflowChatStore } from '../store'
import { useDeerflowUserBubbleMarkdown } from '../composables/useDeerflowUserBubbleMarkdown'
import { defaultMemberAvatar } from '@/shared/utils/memberAvatar.js'
import { formatRelativeTime } from '../composables/useDeerflowTimestamp'
import { splitInlineReasoning } from '../utils/messageUtils'

const emit = defineEmits(['quote', 'copy', 'feedback', 'scroll-to-quote', 'scroll-to-quote-by-content', 'regenerate'])

const userStore = useUserStore()
const chatStore = useDeerflowChatStore()

const props = defineProps({
  message: { type: Object, required: true },
  spaceId: { type: String, default: '' },
  messageTimestamp: { type: Number, default: 0 },
  globalIsStreaming: { type: Boolean, default: false },
  isLastAssistantMessage: { type: Boolean, default: false },
})

const avatarImg = computed(() => individualImg)
const avatarName = computed(() => {
  // 优先从当前线程的 agent_id 获取智能体名字
  const thread = chatStore.currentThread
  if (thread?.agent_id) {
    const agent = chatStore.agents.find(a => a.id === thread.agent_id)
    if (agent?.name) return agent.name
  }
  // 回退到选中的智能体
  if (chatStore.selectedAgentId) {
    const agent = chatStore.agents.find(a => a.id === chatStore.selectedAgentId)
    if (agent?.name) return agent.name
  }
  // 最终回退到默认名字
  return 'Kooky'
})

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
  // 有技能标签时始终显示气泡
  if (messageSkills.value.length > 0) return true
  const raw = String(props.message?.content ?? '').trim()
  if (!raw) return false
  // 剥离后端拼接的 <skill_activation> 块后判断是否还有实际文本
  const stripped = raw.replace(/<skill_activation>[\s\S]*?<\/skill_activation>/g, '').trim()
  return stripped.length > 0
})

const hasUserAttachments = computed(
  () => Array.isArray(props.message?.attachments) && props.message.attachments.length > 0,
)

const showUserMessageActions = computed(
  () => hasUserTextContent.value || hasUserAttachments.value,
)

const { renderedContent, extractedQuotes } = useDeerflowUserBubbleMarkdown(() => props.message)

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

function onDemoArtifactPreview() {
  if (typeof window !== 'undefined' && window.__deerflowChat?.openArtifactPreview) {
    window.__deerflowChat.openArtifactPreview(props.message.demoArtifact)
  }
}

function onDemoArtifactSave() {
  if (typeof window !== 'undefined' && window.__deerflowChat?.saveArtifact) {
    window.__deerflowChat.saveArtifact(props.message.demoArtifact)
  }
}

const demoArtifactDefaultTime = computed(() => {
  const d = new Date()
  return `创建时间：${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

.avatar-name {
  margin-left: 10px;
  white-space: nowrap;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  color: #3D3D3D;
}

.assistant-time {
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
  padding: 9px 16px;
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
  // font-size: 14px;
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

/* ====== 演示用文件产物卡片（样式复刻 DeerflowAttachmentCards.file-card） ====== */
.demo-artifact-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 360px;
  height: 106px;
  margin-top: 12px;
  padding: 16px 0 16px 16px;
  border-radius: 12px;
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  overflow: hidden;
}
.demo-artifact-card:hover {
  background-image: url('@/assets/chat/fileBg.png');
  background-size: cover;
  background-position: center;
}

.demo-artifact-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.demo-artifact-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
}

.demo-artifact-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.demo-artifact-name {
  max-width: 174px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-artifact-time {
  font-size: 12px;
  color: #8f959e;
}

.demo-artifact-right {
  margin-top: 50px;
  position: relative;
}

.demo-artifact-thumb {
  width: 139px;
  height: 120px;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 3.29px 13.97px -3px #d0dbea;
  transition: transform 0.3s ease;
  padding-left: 14px;
  padding-top: 6px;
}
.demo-artifact-card:hover .demo-artifact-thumb {
  transform: rotate(-10deg);
}

.demo-artifact-type-label {
  font-family: PingFang SC, sans-serif;
  font-size: 9.86px;
  font-weight: normal;
  line-height: 11.51px;
  color: #606572;
}

.demo-artifact-save {
  position: absolute;
  top: -38px;
  right: 12px;
  width: 28px;
  height: 28px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}
.demo-artifact-card:hover .demo-artifact-save {
  opacity: 1;
}
.demo-artifact-save:hover {
  background: #f5f6f9;
}
</style>
