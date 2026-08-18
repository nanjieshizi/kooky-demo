<template>
  <div
    class="message-item"
    :class="[message.role]"
    :data-event-id="message.eventId"
    @click.capture="handleMessageContentLinkClick"
  >
    <!-- 系统通知：居中小字；人名来自消息内同步的 displayname 字段，样式 #6072AA -->
    <template v-if="message.role === 'system'">
      <div class="system-notice-stack">
        <div v-if="systemNoticeSegments.length" class="system-notice">
          <template v-for="(seg, idx) in systemNoticeSegments" :key="idx">
            <UserProfileCard
              v-if="seg.type === 'person'"
              :account="seg.text"
              :member-type="seg.memberType"
              :agent-id="seg.agentId"
              :version-id="seg.versionId"
              placement="top"
              :hide-actions="isSystemNoticeSelfPerson(seg)"
            >
              <span class="system-notice-name">{{ seg.text }}</span>
            </UserProfileCard>
            <template v-else>{{ seg.text }}</template>
          </template>
        </div>
        <div v-if="inviteGroup" class="system-notice">
          <template v-if="inviteGroup.actor">
            <UserProfileCard
              :account="inviteGroup.actor.name"
              :member-type="inviteGroup.actor.type"
              :agent-id="inviteGroup.actor.agentId"
              :version-id="inviteGroup.actor.versionId"
              placement="top"
              :hide-actions="isSystemNoticeSelfPerson(inviteGroup.actor)"
            >
              <span class="system-notice-name">{{ inviteGroup.actor.name }}</span>
            </UserProfileCard>
            <span> 邀请 </span>
          </template>
          <span v-else>邀请 </span>
          <template v-for="(p, i) in inviteGroup.invitees" :key="i">
            <span v-if="i > 0">、</span>
            <UserProfileCard
              :account="p.name"
              :member-type="p.type"
              :agent-id="p.agentId"
              :version-id="p.versionId"
              placement="top"
              :hide-actions="isSystemNoticeSelfPerson(p)"
            >
              <span class="system-notice-name">{{ p.name }}</span>
            </UserProfileCard>
          </template>
          <span> 进入群聊</span>
        </div>
      </div>
    </template>

    <!-- Assistant message -->
    <template v-else-if="message.role === 'assistant'">
      <div class="assistant-block">
        <div class="assistant-aside">
          <div
            class="assistant-avatar"
            :class="{
              'is-thinking': message.isStreaming,
              'assistant-avatar--human-face': !isAvatarDigitalHuman,
            }"
          >
            <div v-if="message.isStreaming" class="avatar-ring" aria-hidden="true" />
            <UserAvatar
              :member="senderMember"
              :size="40"
              placement="right-start"
              :class="['avatar-img', isAvatarDigitalHuman ? 'avatar-img--digital' : 'avatar-img--human']"
            />
            <span class="avatar-name">{{ avatarName }}</span>
            <span v-if="messageTime && !isWelcomeEchoMessage" class="assistant-time">{{ messageTime }}</span>
          </div>
        </div>
        <div class="msg-body assistant-body">

        <!-- Thinking 内容展示（暂时隐藏） -->
        <!-- <div v-if="message.thinking" class="thinking-section"> ... </div> -->
        <!-- <div v-else-if="message.thinkingTime" class="thinking-bar"> ... </div> -->

        <!-- Tool Uses (工具调用) -->
        <ToolUsesSection :tool-uses="message.toolUses || []" />

        <!-- Tool Results (工具结果) -->
        <ToolResultsSection :tool-results="message.toolResults || []" />

        <!-- 主文本内容 -->
        <MessageQuoteBlock
          v-if="message.content?.reply_to"
          style="padding: 5px 10px;"
          :reply-to="message.content.reply_to"
          :sender-display-name="getReplyToSenderName(message.content.reply_to)"
          @scroll-to-quote="emit('scroll-to-quote', $event)"
        />
        <!-- 协作任务：拆解中高光态（替代 markdown 渲染） -->
        <CollabThinkingIndicator
          v-if="message.content?.isThinking"
          :text="messageBody || '团队助手正在思考…'"
        />
        <MarkdownContent
          v-else-if="messageBody"
          :content="messageBody"
          :is-streaming="!!message.isStreaming"
        />
        <!-- 流式生成中：闪烁光标 -->
        <span v-if="message.isStreaming && messageBody" class="streaming-cursor" />

        <!-- 协作任务：单张流转卡片 -->
        <CollabFlowCard
          v-if="message.content?.flowCard"
          :flow-card="message.content.flowCard"
        />
        <!-- 协作任务：多张流转卡片（并行场景：一张主卡 + 多张下一步子卡） -->
        <CollabFlowCard
          v-for="(fc, fcIdx) in message.content?.flowCards || []"
          :key="`fc-${fcIdx}`"
          :flow-card="fc"
        />

        <!-- Images (图片) -->
        <div v-if="message.images && message.images.length" class="images-section">
          <div v-for="(img, idx) in message.images" :key="idx" class="image-item">
            <img
              v-if="img.data"
              :src="`data:${img.mediaType || 'image/png'};base64,${img.data}`"
              alt="图片"
              class="msg-image"
            />
            <img
              v-else-if="img.url"
              :src="img.url"
              alt="图片"
              class="msg-image"
            />
          </div>
        </div>

        <!-- Steps (multi-step execution) -->
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

        <MessageAssistantAttachmentCards
          :attachments="attachmentsWithContent"
          :message-timestamp="message.timestamp"
          :space-id="conversationId"
        />

        <AssistantMessageActions
          :content="messageBody"
          :message-id="assistantMessageFeedbackId"
          :conversation-id="conversationId"
          :is-streaming="!!message.isStreaming"
          :show-always="showAssistantActionsAlways"
          :message="message"
          :show-ai-draft="true"
          @quote="emit('quote', $event)"
          @ai-draft="onAiDraft"
        />
        </div>
      </div>
    </template>

    <!-- 非 assistant 消息（user / member 等） -->
    <template v-else>
      <!-- 群聊：member 角色消息 — 与 assistant 同款左对齐布局，但显示发送者头像+昵称 -->
      <template v-if="message.role === 'member'">
        <div class="assistant-block">
          <div class="assistant-aside">
            <div class="assistant-avatar">
              <UserAvatar
                :member="senderMember"
                :size="34"
                placement="right-start"
                :class="['avatar-img', isAvatarDigitalHuman ? 'avatar-img--digital' : 'avatar-img--human']"
              />
              <span class="avatar-name">{{ senderDisplayName || message.senderId }}</span>
              <span v-if="messageTime" class="assistant-time">{{ messageTime }}</span>
            </div>
          </div>
          <div class="msg-body assistant-body">
            <MessageQuoteBlock
              v-if="message.content?.reply_to"
              :reply-to="message.content.reply_to"
              style="padding: 5px 10px;"
              :sender-display-name="getReplyToSenderName(message.content.reply_to)"
              @scroll-to-quote="emit('scroll-to-quote', $event)"
            />
            <div v-if="messageBody" class="member-bubble-content" v-html="renderedContent" />
            <MessageAssistantAttachmentCards
              :attachments="attachmentsWithContent"
              :message-timestamp="message.timestamp"
              :space-id="conversationId"
            />
            <AssistantMessageActions
              action-mode="member"
              :content="messageBody"
              :message="message"
              :show-ai-draft="true"
              class="member-message-actions"
              @quote="emit('quote', $event)"
              @ai-draft="onAiDraft"
            />
          </div>
        </div>
      </template>

      <!-- user 角色：时间与操作栏依赖 .user-bubble-wrapper:hover；附件放在文字下方且同 wrapper 内，悬停附件也显示时间与按钮，并与文字右对齐 -->
      <template v-else>
        <div class="msg-body user-body">
          <div class="user-bubble-wrapper">
            <div class="user-header">
              <span v-if="messageTime" class="user-time">{{ messageTime }}</span>
              <div class="user-avatar-wrapper">
                <UserAvatar
                  :member="selfMember"
                  :size="34"
                  placement="left-start"
                />
              </div>
            </div>
            <div class="user-content-wrapper">
              <div v-if="hasUserTextContent" class="user-bubble">
                <MessageQuoteBlock
                  v-if="message.content?.reply_to"
                  :reply-to="message.content.reply_to"
                  :sender-display-name="getReplyToSenderName(message.content.reply_to)"
                  @scroll-to-quote="emit('scroll-to-quote', $event)"
                />
                <div v-if="message.content?.matterReference" class="sent-matter-reference">
                  <span>引用事项</span>
                  <strong>{{ message.content.matterReference.title || '未命名事项' }}</strong>
                </div>
                <div class="user-bubble-content" v-html="renderedContent" />
              </div>
              <MessageAssistantAttachmentCards
                class="chat-user-msg-attachments"
                :message-timestamp="message.timestamp"
                :attachments="attachmentsWithContent"
                :space-id="conversationId"
              />
              <div
                v-if="showUserMessageActions"
                class="user-bubble-actions"
              >
                <AssistantMessageActions
                  action-mode="user"
                  :content="messageBody"
                  :message="message"
                  @quote="emit('quote', $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MessageAssistantAttachmentCards from '@/shared/components/MessageAssistantAttachmentCards.vue'
import AssistantMessageActions from '@/shared/components/AssistantMessageActions.vue'
import MarkdownContent from '@/shared/components/MarkdownContent.vue'
import MessageQuoteBlock from '@/shared/components/MessageQuoteBlock.vue'
import { formatMessageTime } from '@/shared/chatComposables/useMessageTimestamp'
import { useGroupStore } from '@/modules/group/store'
import { useUserStore } from '@/modules/auth/store'
import { useGroupMessageSystemNotice } from '@/modules/group/useGroupMessageSystemNotice'
import { useUserBubbleMarkdown } from '@/shared/chatComposables/useUserBubbleMarkdown'
import { handleMessageContentLinkClick } from '@/shared/utils/messageContentLinkClick'
import { isRoomMemberBot } from '@/shared/utils/memberType.js'
import { getPortalUserId } from '@/shared/utils/userInfoStorage.js'
import ToolUsesSection from '@/shared/components/message/ToolUsesSection.vue'
import ToolResultsSection from '@/shared/components/message/ToolResultsSection.vue'
// 协作任务：流转卡片 + 拆解中高光态
import CollabFlowCard from '@/modules/collaboration/components/CollabFlowCard.vue'
import CollabThinkingIndicator from '@/modules/collaboration/components/CollabThinkingIndicator.vue'

/** 🦀 帮我回复：触发 dev-mocks 的 startAiDraft helper */
function onAiDraft(sourceMessage) {
  const cid = props.message?.conversationId || props.conversationId
  if (!cid || !sourceMessage) return
  if (typeof window !== 'undefined' && window.__kookyMock?.startAiDraft) {
    window.__kookyMock.startAiDraft(cid, sourceMessage)
  } else {
    console.warn('[GroupMessageItem] __kookyMock.startAiDraft 不可用')
  }
}
import { UserAvatar } from '@/shared/components/user'
import UserProfileCard from '@/shared/components/user/UserProfileCard.vue'
import { useSenderMember } from '@/modules/group/useSenderMember.js'

const emit = defineEmits(['quote', 'scroll-to-quote'])

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  conversationId: { type: String, default: 'personal' },
  /** 为 true 时助手消息操作栏常显；否则默认 visibility:hidden，仅在助手内容区 hover 时显示 */
  showAssistantActionsAlways: { type: Boolean, default: false },
  /** 发送者展示名称（由父组件传入） */
  senderDisplayName: { type: String, default: '' },
  /** 发送者头像 HTTP URL（空时显示首字母占位） */
  senderAvatarUrl: { type: String, default: '' },
  /** 成员 profile map，用于系统通知显示名解析 { [userId]: { displayName, avatarHttpUrl } } */
  memberProfileMap: { type: Object, default: () => ({}) },
})

const groupStore = useGroupStore()
const userStore = useUserStore()
const { systemNoticeSegments, inviteGroup } = useGroupMessageSystemNotice(props)
const { renderedContent } = useUserBubbleMarkdown(
  () => props.message,
  {
    memberProfileMap: () => props.memberProfileMap,
    currentUserId: () => getPortalUserId(),
  }
)

function resolveSenderRoomMemberRow() {
  const uid = props.message?.senderId
  const rid = props.message?.conversationId
  if (!uid || !rid) return null
  const list = groupStore.conversationMembers[rid] ?? []
  return (
    list.find(
      (x) => x?.userId && String(x.userId).toLowerCase() === String(uid).toLowerCase(),
    ) || null
  )
}

const senderMember = useSenderMember(
  () => props.message?.senderId,
  () => props.message?.conversationId,
  () => ({
    name: props.senderDisplayName,
    avatar: props.senderAvatarUrl || props.message?.senderAvatar,
  }),
)

/** 企业数字人 / 机器人：40×40 方角；真人：34×34 圆形 */
const isAvatarDigitalHuman = computed(() => {
  const role = props.message?.role
  if (role !== 'assistant' && role !== 'member') return false
  const uid = props.message?.senderId
  return isRoomMemberBot(resolveSenderRoomMemberRow() || { userId: uid })
})

function getReplyToSenderName(replyTo) {
  const senderId = replyTo?.sender_id ?? replyTo?.sender?.id
  const replySenderName = String(replyTo?.sender_name ?? replyTo?.sender?.name ?? '').trim()
  if (!senderId && !replySenderName) return '未知用户'
  const portal = getPortalUserId()
  if (portal && replySenderName && replySenderName === portal) return '我'
  if (senderId) {
    return (
      props.memberProfileMap?.[senderId]?.displayName ||
      replySenderName ||
      senderId
    )
  }
  return replySenderName
}

function isSystemNoticeSelfPerson(person) {
  if (!person) return false
  const info = userStore.userInfo || {}
  const selfKeys = [
    getPortalUserId(),
    info.userId,
    info.account,
    info.username,
    info.userName,
    info.name,
  ].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)
  if (selfKeys.length === 0) return false

  const personKeys = [
    person.id,
    person.userId,
    person.account,
    person.username,
    person.name,
    person.text,
  ].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)

  return personKeys.some((key) => selfKeys.includes(key))
}

/** 助手头像旁名称：与 GroupMessageList 传入的 senderDisplayName 一致，空则回退 senderId，再无则默认 */
const avatarName = computed(() => {
  const d = String(props.senderDisplayName || '').trim()
  if (d) return d
  const sid = props.message?.senderId
  if (sid != null && String(sid).trim()) return String(sid)
  return '团队助理'
})

/** 点赞接口用：优先 eventId */
const assistantMessageFeedbackId = computed(() => {
  const m = props.message
  if (!m) return ''
  if (m.eventId != null && String(m.eventId).length > 0) return String(m.eventId)
  if (m.id != null && String(m.id).length > 0) return String(m.id)
  return ''
})

const messageTime = computed(() => formatMessageTime(props.message?.timestamp))

/** MessageList 置顶欢迎语：eventId 为 welcome_echo_*，不展示时间 */
const isWelcomeEchoMessage = computed(() => {
  const id = props.message?.eventId
  return typeof id === 'string' && id.startsWith('welcome_echo_')
})

const messageBody = computed(() => (
  props.message?.content && typeof props.message.content === 'object'
    ? props.message.content.body || ''
    : String(props.message?.content ?? '')
))

const attachmentsWithContent = computed(() => {
  const content = props.message?.content
  const list = Array.isArray(content?.attachments) ? content.attachments : []
  return list.map((att) => ({ ...att, _messageContent: content }))
})

/** 用户气泡：仅在有非空正文时渲染（纯附件消息不渲染空气泡） */
const hasUserTextContent = computed(
  () => messageBody.value.trim().length > 0,
)

/** 有正文或附件时显示引用/复制（自己发的纯附件消息也要出操作栏） */
const hasUserAttachments = computed(
  () => Array.isArray(props.message?.content?.attachments) && props.message.content.attachments.length > 0,
)

const showUserMessageActions = computed(
  () => hasUserTextContent.value || hasUserAttachments.value,
)

/** 当前登录用户作为 UserAvatar 的 member 入参，驱动资料卡 hover 弹窗 */
const selfMember = computed(() => {
  const info = userStore.userInfo || {}
  return {
    id: info.userId || info.account || info.username || '',
    username: info.username || info.account || '',
    name: info.name || info.userName || info.account || info.username || '',
    avatarUrl: userStore.avatar || '',
  }
})

</script>

<style lang="scss" scoped>
.message-item {
  display: flex;
  gap: 10px;
  animation: msgAppear 0.3s ease-out;
}

.message-item.user {
  justify-content: flex-end;
  width: 100%;
  margin-top: 28px;
}

.message-item.assistant {
  align-items: flex-start;
}

/* 头像区 + 正文同一列：正文与头像图左对齐，距上 16px */
.assistant-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-top: 24px;
}

.assistant-block > .assistant-body {
  margin-top: 12px;
  align-self: stretch;
}

/* 头像 + 名称一行，loading 在下方且与图片左对齐 */
.assistant-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 16px;
}

/* Assistant avatar with name tag */
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
  letter-spacing: normal;
  color: #2F3547;
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

.avatar-ring {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 25px;
  height: 25px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    #F386BE 25%,
    #8478FA 50%,
    #77C9FB 75%,
    transparent 100%
  );
  -webkit-mask: radial-gradient(transparent 10.5px, #000 10.75px, #000 12px, transparent 12.25px);
  mask: radial-gradient(transparent 10.5px, #000 10.75px, #000 12px, transparent 12.25px);
}

.assistant-avatar.is-thinking .avatar-ring {
  opacity: 1;
  animation: avatarSpin 1.2s linear infinite;
}

/* 34×34 真人头像时思考环对准圆心 */
.assistant-avatar--human-face .avatar-ring {
  top: 17px;
  left: 17px;
}

@keyframes avatarSpin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.avatar-img {
  position: relative;
  // z-index: 1;
  flex-shrink: 0;
  object-fit: cover;
}

/* 数字人：40×40，无圆角 */
.avatar-img--digital {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 0;
}

/* 非数字人：34×34，圆形 */
.avatar-img--human {
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
}

/* Message body */
.msg-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  margin-left: 4px;
}

/* Assistant text: no bubble background */
.assistant-body .msg-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-break: break-word;
}

/* User bubble: gray rounded */
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

.user-avatar-wrapper {
  flex-shrink: 0;
}

.user-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.user-time {
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-item.user:hover .user-time {
  opacity: 1;
}

.user-bubble-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-top: 6px;
}

.user-bubble-wrapper:hover .user-bubble-actions :deep(.msg-actions),
.message-item.user:hover .user-bubble-actions :deep(.msg-actions) {
  visibility: visible;
}

.member-message-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.message-item.member .assistant-block:hover .member-message-actions :deep(.msg-actions),
.message-item.member:hover .member-message-actions :deep(.msg-actions) {
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
  height: auto;
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
  line-height: 20px;
  letter-spacing: normal;
  color: #2F3547;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  min-width: 0;
}

.sent-matter-reference {
  min-width: 220px;
  max-width: 440px;
  padding: 7px 10px;
  border-left: 3px solid #ff7a45;
  border-radius: 5px;
  background: rgba(255,255,255,.72);
  box-sizing: border-box;
}
.sent-matter-reference span,
.sent-matter-reference strong { display: block; }
.sent-matter-reference span { color: #9a7b6f; font-size: 10px; line-height: 15px; }
.sent-matter-reference strong { overflow: hidden; color: #394052; font-size: 12px; font-weight: 600; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }

.user-bubble-content :deep(.mention-tag) {
  color: #4f6ef7;
  font-weight: 500;
}

.user-bubble-content :deep(.mention-at) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: calc(1em - 2px);
  line-height: 1;
}

/* Thinking status bar */
.thinking-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-secondary);
  width: fit-content;
}

.thinking-label {
  font-weight: 500;
  color: var(--text-primary);
}

.thinking-time {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--text-muted);
}

.thinking-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s;
}

.thinking-expand:hover {
  background: var(--border);
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

/* 助手操作栏：hover 显示（子组件默认 visibility:hidden） */
.assistant-body:hover :deep(.msg-actions),
.message-item.assistant:hover :deep(.msg-actions) {
  visibility: visible;
}

@keyframes msgAppear {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 流式生成闪烁光标 */
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

/* Loading indicator */
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(180deg, #FF7809 0%, #FF9E43 99%);;
  animation: loadingBounce 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loadingBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}

.loading-text {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

/* Thinking section */
.thinking-section {
  margin-bottom: 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.thinking-header:hover {
  background: var(--bg-tertiary);
}

.thinking-header .expand-icon {
  margin-left: auto;
  transition: transform 0.2s;
}

.thinking-header .expand-icon.expanded {
  transform: rotate(180deg);
}

.thinking-content {
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
}


/* Images section */
.images-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.image-item {
  max-width: 100%;
}

.msg-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  object-fit: contain;
}

/* Markdown content styles */
.msg-text :deep(strong),
.user-bubble :deep(strong) {
  font-weight: 700;
  color: inherit;
}

.msg-text :deep(ul),
.user-bubble :deep(ul) {
  list-style: disc;
  padding-left: 20px;
  margin: 4px 0;
}

.msg-text :deep(li),
.user-bubble :deep(li) {
  padding-left: 4px;
  margin: 2px 0;
}

/* 用户消息的代码块样式（简单样式，不需要复制按钮） */
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

.user-bubble :deep(p) {
  margin: 4px 0;
}

.user-bubble :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.user-bubble :deep(a:hover) {
  text-decoration: underline;
}

.user-bubble :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.user-bubble :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.user-bubble :deep(ol li) {
  padding-left: 4px;
  margin: 2px 0;
}

.user-bubble :deep(ul) {
  list-style: disc;
  padding-left: 20px;
  margin: 4px 0;
}

.user-bubble :deep(ul li) {
  padding-left: 4px;
  margin: 2px 0;
}

.user-bubble :deep(ul li)::before {
  content: none;
}

/* member 发送者头像占位（无图时显示首字母） */
.avatar-placeholder {
  background: var(--el-color-primary-light-7, #e0d9ff);
  color: var(--el-color-primary, #8478fa);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

/* 系统通知小字（居中灰色，无气泡，类微信效果） */
.message-item.system {
  justify-content: center;
  margin: 4px 0;
  animation: none;
}

.system-notice-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.system-notice {
  text-align: center;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
  padding: 2px 16px;
  user-select: none;
}

.system-notice-name {
  color: #6072aa;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.member-bubble-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-break: break-word;

  :deep(.mention-tag) {
    color: #4f6ef7;
    font-weight: 500;
  }

  :deep(.mention-at) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: calc(1em - 2px);
    line-height: 1;
  }
}




</style>
