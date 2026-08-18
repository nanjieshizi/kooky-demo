<template>
  <div
    class="message-item"
    :class="[message.role]"
    :data-event-id="message.eventId"
    @click.capture="handleMessageContentLinkClick"
  >
    <!-- 对方消息：左侧头像 + 内容 -->
    <template v-if="message.role === 'peer'">
      <div class="peer-block">
        <div class="peer-aside">
          <div class="peer-avatar">
            <UserAvatar :member="senderMember" :size="34" placement="right-start" class="avatar-img avatar-img--human" />
            <span class="avatar-name">{{ senderDisplayName }}</span>
            <span v-if="messageTime" class="peer-time">{{ messageTime }}</span>
          </div>
        </div>
        <div class="msg-body peer-body">
          <MessageQuoteBlock
            v-if="message.content?.reply_to"
            style="padding: 5px 10px;"
            :reply-to="message.content.reply_to"
            :sender-display-name="getReplyToSenderName(message.content.reply_to)"
            @scroll-to-quote="emit('scroll-to-quote', $event)"
          />
          <div v-if="isRecalled" class="recalled-tip">[消息已撤回]</div>
          <template v-else>
            <MarkdownContent
              v-if="messageBody"
              :content="messageBody"
              :is-streaming="false"
            />
            <MessageAssistantAttachmentCards
              :attachments="attachmentsWithContent"
              :message-timestamp="message.timestamp"
              :space-id="String(conversationId)"
            />
            <div class="peer-message-actions">
              <AssistantMessageActions
                action-mode="member"
                :content="messageBody"
                :message="message"
                @quote="emit('quote', $event)"
              />
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 自己消息：右侧气泡 -->
    <template v-else>
      <div class="msg-body user-body">
        <div class="user-bubble-wrapper">
          <div class="user-header">
            <span v-if="messageTime" class="user-time">{{ messageTime }}</span>
            <div class="user-avatar-wrapper">
              <UserAvatar :member="selfMember" :size="34" placement="left-start" />
            </div>
          </div>
          <div class="user-content-wrapper">
            <div v-if="isRecalled" class="recalled-tip">[消息已撤回]</div>
            <template v-else>
              <div v-if="hasUserTextContent" class="user-bubble">
                <MessageQuoteBlock
                  v-if="message.content?.reply_to"
                  :reply-to="message.content.reply_to"
                  :sender-display-name="getReplyToSenderName(message.content.reply_to)"
                  @scroll-to-quote="emit('scroll-to-quote', $event)"
                />
                <div class="user-bubble-content" v-html="renderedContent" />
              </div>
              <MessageAssistantAttachmentCards
                class="chat-user-msg-attachments"
                :message-timestamp="message.timestamp"
                :attachments="attachmentsWithContent"
                :space-id="String(conversationId)"
              />
              <div v-if="showUserMessageActions" class="user-bubble-actions">
                <AssistantMessageActions
                  action-mode="user"
                  :content="messageBody"
                  :message="message"
                  @quote="emit('quote', $event)"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
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
import { useUserStore } from '@/modules/auth/store'
import { useUserBubbleMarkdown } from '@/shared/chatComposables/useUserBubbleMarkdown'
import { handleMessageContentLinkClick } from '@/shared/utils/messageContentLinkClick'
import { getPortalUserId } from '@/shared/utils/userInfoStorage.js'
import { UserAvatar } from '@/shared/components/user'

defineOptions({ name: 'PrivateMessageItem' })

const emit = defineEmits(['quote', 'scroll-to-quote'])

const props = defineProps({
  message: { type: Object, required: true },
  conversationId: { type: [String, Number], required: true },
})

const userStore = useUserStore()

const { renderedContent } = useUserBubbleMarkdown(
  () => props.message,
  {
    memberProfileMap: () => ({}),
    currentUserId: () => getPortalUserId(),
  },
)

const messageTime = computed(() => formatMessageTime(props.message?.timestamp))

const isRecalled = computed(() => props.message?.status === 'recalled')

const messageBody = computed(() => {
  const content = props.message?.content
  if (content && typeof content === 'object') return content.body || ''
  return String(content ?? '')
})

const attachmentsWithContent = computed(() => {
  const content = props.message?.content
  const list = Array.isArray(content?.attachments) ? content.attachments : []
  return list.map((att) => ({ ...att, _messageContent: content }))
})

const hasUserTextContent = computed(
  () => messageBody.value.trim().length > 0,
)

const hasUserAttachments = computed(
  () => Array.isArray(props.message?.content?.attachments) && props.message.content.attachments.length > 0,
)

const showUserMessageActions = computed(
  () => (hasUserTextContent.value || hasUserAttachments.value) && !isRecalled.value,
)

const senderDisplayName = computed(
  () => String(props.message?.senderDisplayName || '').trim() || '',
)

const senderMember = computed(() => ({
  userId: props.message?.senderId || '',
  username: props.message?.senderName || '',
  avatarHttpUrl: props.message?.senderAvatar || '',
  type: props.message?.senderType || 'user',
}))

const selfMember = computed(() => {
  const info = userStore.userInfo || {}
  return {
    id: info.userId || info.account || info.username || '',
    username: info.username || info.account || info.userId || '',
    name: info.name || info.userName || info.account || info.username || '',
    avatarUrl: userStore.avatar || '',
  }
})

function getReplyToSenderName(replyTo) {
  const senderId = replyTo?.sender_id ?? replyTo?.sender?.id
  const replySenderName = String(replyTo?.sender_name ?? replyTo?.sender?.name ?? '').trim()
  if (!senderId && !replySenderName) return '未知用户'
  const portal = getPortalUserId()
  if (portal && replySenderName && replySenderName === portal) return '我'
  return replySenderName || senderDisplayName.value || senderId
}
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

.message-item.peer {
  align-items: flex-start;
}

.peer-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-top: 24px;
}

.peer-block > .peer-body {
  margin-top: 12px;
  align-self: stretch;
}

.peer-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 16px;
}

.peer-avatar {
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
  color: #2F3547;
}

.peer-time {
  margin-left: 4px;
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-item:hover .peer-time {
  opacity: 1;
}

.avatar-img {
  position: relative;
  flex-shrink: 0;
  object-fit: cover;
}

.avatar-img--human {
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
}

.msg-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.user-bubble-wrapper:hover .user-time {
  opacity: 1;
}

.user-bubble {
  background: #F2F4F7;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  color: #2F3547;
  word-break: break-word;
}

.user-bubble-content :deep(p) {
  margin: 0;
}

.recalled-tip {
  font-size: 12px;
  color: #91949E;
  padding: 4px 0;
}

.peer-message-actions {
  margin-top: 4px;
}

.peer-block:hover .peer-message-actions :deep(.msg-actions),
.message-item.peer:hover .peer-message-actions :deep(.msg-actions),
.user-bubble-wrapper:hover .user-bubble-actions :deep(.msg-actions),
.message-item.user:hover .user-bubble-actions :deep(.msg-actions) {
  visibility: visible;
}

.user-bubble-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@keyframes msgAppear {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
