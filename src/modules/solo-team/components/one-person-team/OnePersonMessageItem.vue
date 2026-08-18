<template>
  <div v-if="message.role === 'task-card' && taskCard" class="task-card-message">
    <button type="button" class="task-card-head" @click="openTaskCard">
      <span class="task-card-swirl">◎</span>
      <span>{{ taskCardTitle }}</span>
      <span class="task-card-more">查看更多 👉</span>
    </button>
    <p v-if="taskCardPreview" class="task-card-preview">{{ taskCardPreview }}</p>
    <div class="task-card-body">
      <div v-for="member in taskCardMembers" :key="member.id" class="task-card-member">
        <img :src="member.avatar || defaultAgentAvatar" alt="" class="task-card-avatar" @error="onAvatarError" />
        <div class="task-card-member-main">
          <strong>{{ member.name || '数字员工' }}</strong>
          <p>{{ member.description || '协助完成团队任务' }}</p>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="teamProposal" class="message-row message-row--agent">
    <div class="message-avatar-wrap">
      <img :src="messageAvatar" alt="" class="message-avatar" @error="onAvatarError" />
    </div>
    <div class="message-main">
      <div class="message-head">
        <span class="message-author">{{ displayAuthor }}</span>
        <span v-if="showTimestamp && messageTime" class="message-time">{{ messageTime }}</span>
      </div>
      <OnePersonTeamProposalCard
        :payload="teamProposal"
        :team-id="teamId"
        :thread-id="message.threadId"
      />
    </div>
  </div>

  <div v-else class="message-row" :class="isHuman ? 'message-row--human' : 'message-row--agent'">
    <div v-if="!isHuman" class="message-avatar-wrap">
      <el-popover
        v-if="profileAgentId"
        v-model:visible="profileVisible"
        placement="right-start"
        trigger="click"
        :width="288"
        :show-arrow="false"
        popper-class="emp-mini-popover"
      >
        <template #reference>
          <img :src="messageAvatar" alt="" class="message-avatar message-avatar--clickable" @error="onAvatarError" />
        </template>
        <EmployeeMiniProfile :agent-id="profileAgentId" @close="profileVisible = false" />
      </el-popover>
      <img v-else :src="messageAvatar" alt="" class="message-avatar" @error="onAvatarError" />
    </div>
    <div class="message-main" :class="{ 'message-main--wide-card': welcomeCard }">
      <div v-if="!isHuman" class="message-head">
        <span class="message-author">{{ displayAuthor }}</span>
        <span v-if="showTimestamp && messageTime" class="message-time">{{ messageTime }}</span>
      </div>
      <div class="message-content-wrap">
        <div
          v-if="hasMessageBubble"
          class="message-bubble"
          :class="isHuman ? 'message-bubble--human' : 'message-bubble--agent'"
        >
          <MarkdownContent
            :content="message.content || ''"
            :is-streaming="!!message.isStreaming"
            enable-inline-svg-cards
            :svg-card-space-id="teamId"
            svg-card-room-type="super_person_chat"
          />
          <div v-if="message.status === 'failed'" class="message-status">发送失败</div>
        </div>
        <OnePersonAttachmentCards
          v-if="messageAttachments.length"
          :attachments="messageAttachments"
          :role="message.role"
          :space-id="teamId"
          :message-timestamp="message.timestamp || 0"
        />
        <OnePersonWorkCard v-if="workCard" :payload="workCard" :team-id="teamId" />
        <div v-if="welcomeCard" class="task-card-message welcome-card-message task-card-message--inline">
          <button type="button" class="task-card-head welcome-card-head" @click="openWelcomeCard">
            <img :src="welcomeTitleIcon" alt="" class="welcome-card-title-icon" />
            <span class="welcome-card-title">{{ welcomeCardTitle }}</span>
            <span class="task-card-more welcome-card-more">
              查看更多
              <img :src="welcomeMoreIcon" alt="" class="welcome-card-more-icon" />
            </span>
          </button>
          <div v-if="welcomeCardMembers.length" class="task-card-body welcome-card-body">
            <div v-for="member in welcomeCardMembers" :key="member.id" class="task-card-member welcome-card-member">
              <span class="welcome-card-avatar-shell">
                <img :src="member.avatar || defaultAgentAvatar" alt="" class="task-card-avatar welcome-card-avatar" @error="onAvatarError" />
              </span>
              <div class="task-card-member-main">
                <strong>{{ member.name || '数字员工' }}</strong>
                <p>{{ member.summary || member.description || member.roleTitle || '参与团队协作' }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hasMessageBubble" class="message-actions" :class="{ 'message-actions--human': isHuman }">
          <AssistantMessageActions
            :action-mode="isHuman ? 'user' : 'assistant'"
            :content="message.content || ''"
            :message="message"
            :is-streaming="!!message.isStreaming"
            :show-quote="false"
          />
        </div>
      </div>
      <div v-if="taskCard" class="task-card-message task-card-message--inline">
        <button type="button" class="task-card-head" @click="openTaskCard">
          <span class="task-card-swirl">◎</span>
          <span>{{ taskCardTitle }}</span>
          <span class="task-card-more">查看更多 👉</span>
        </button>
        <p v-if="taskCardPreview" class="task-card-preview">{{ taskCardPreview }}</p>
        <div class="task-card-body">
          <div v-for="member in taskCardMembers" :key="member.id" class="task-card-member">
            <img :src="member.avatar || defaultAgentAvatar" alt="" class="task-card-avatar" @error="onAvatarError" />
            <div class="task-card-member-main">
              <strong>{{ member.name || '数字员工' }}</strong>
              <p>{{ member.description || '协助完成团队任务' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="isHuman" class="message-avatar-wrap message-avatar-wrap--human">
      <img :src="humanAvatar" alt="" class="message-avatar" @error="onUserAvatarError" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElPopover } from 'element-plus'
import EmployeeMiniProfile from '@/modules/contacts/components/EmployeeMiniProfile.vue'
import AssistantMessageActions from '@/shared/components/AssistantMessageActions.vue'
import MarkdownContent from '@/shared/components/MarkdownContent.vue'
import { useUserStore } from '@/modules/auth/store'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import userAvatarFallback from '@/assets/default-avatar.svg'
import teamAssistantAvatar from '@/assets/crab-pixel.png'
import welcomeMoreIcon from '@/assets/soloTeam/shou.svg'
import welcomeTitleIcon from '@/assets/soloTeam/tilte_left_icon.svg'
import { taskStatusText } from './taskStatus'
import OnePersonAttachmentCards from './OnePersonAttachmentCards.vue'
import OnePersonTeamProposalCard from './OnePersonTeamProposalCard.vue'
import OnePersonWorkCard from './OnePersonWorkCard.vue'
import { formatRelativeTime, messageTimestampMs } from '../../composables/useOnePersonMessageTimestamp'
import { isTeamUpgraded } from '../../demo/onePersonDirector'

defineOptions({ name: 'OnePersonMessageItem' })

const props = defineProps({
  message: { type: Object, required: true },
  teamId: { type: [String, Number], default: '' },
  showTimestamp: { type: Boolean, default: true },
})

const emit = defineEmits(['open-task'])

/**
 * 点头像看档案：员工消息用它自己的 agentId；
 * 分身的消息（欢迎语/系统播报）往往不带 agentId，用 'assistant' 别名兜住，
 * 否则最常见的那个头像反而点不开。
 */
const profileVisible = ref(false)
const profileAgentId = computed(() => {
  if (isHuman.value) return ''
  const id = props.message.agentId ?? props.message.agent_id ?? ''
  if (id) return String(id)
  return isAssistantMessage.value ? 'assistant' : ''
})
const userStore = useUserStore()

const isHuman = computed(() => props.message.role === 'human')
const messageTime = computed(() => formatRelativeTime(messageTimestampMs(props.message)))
const humanAvatar = computed(() => userStore.avatar || props.message.avatar || userAvatarFallback)
// 分身消息强制用蟹头像（不受旧 mock 里 baked 的头像影响）；员工消息保留各自头像
const GENERIC_ASSISTANT_NAMES = new Set(['我的分身', '团队助理', '团队助手', 'Kooky', '我的分身（指挥）'])
const isAssistantMessage = computed(() => {
  if (isHuman.value) return false
  const name = String(props.message.authorName || '').trim()
  return !name || GENERIC_ASSISTANT_NAMES.has(name)
})
const messageAvatar = computed(() => (isAssistantMessage.value ? teamAssistantAvatar : (props.message.avatar || teamAssistantAvatar)))
// 分身命名：升级成多人会话后没有独立「团队助理」，分身即指挥 →「我的分身（指挥）」；否则「我的分身」
const isGroupConversation = computed(() => {
  try { return isTeamUpgraded(props.teamId) } catch { return false }
})
const assistantName = computed(() => (isGroupConversation.value ? '我的分身（指挥）' : '我的分身'))
const displayAuthor = computed(() => (isAssistantMessage.value ? assistantName.value : (props.message.authorName || assistantName.value)))
const hasMessageBubble = computed(() => Boolean(String(props.message.content || '').trim()) || props.message.status === 'failed')
const messageAttachments = computed(() => {
  const result = []
  const seen = new Set()
  const append = (items) => {
    if (!Array.isArray(items)) return
    items.forEach((item) => {
      if (!item) return
      const key = `${item.url || item.downloadUrl || item.openUrl || item.path || ''}\u0000${item.name || ''}\u0000${item.size || 0}`
      if (seen.has(key)) return
      seen.add(key)
      result.push(item)
    })
  }
  append(props.message.attachments)
  append(props.message.artifacts)
  return result
})
const taskCard = computed(() => {
  if (props.message.taskCard) return props.message.taskCard
  if (props.message.role !== 'task-card') return null
  return {
    taskId: props.message.taskId,
    executionThreadId: props.message.executionThreadId,
    title: props.message.title,
    members: props.message.members || [],
    status: props.message.status,
    preview: props.message.preview,
    progress: props.message.progress || null,
  }
})
const welcomeCard = computed(() => props.message.welcomeCard || null)
const teamProposal = computed(() => props.message.teamProposal || null)
const workCard = computed(() => props.message.workCard || null)
const taskCardTitle = computed(() => taskCard.value?.title || props.message.title || '任务')
const taskCardPreview = computed(() => {
  const card = taskCard.value
  if (!card) return ''
  const parts = []
  const progress = card.progress
  if (progress && Number.isFinite(Number(progress.total)) && Number(progress.total) > 0) {
    parts.push(`已完成：${Number(progress.completed || 0)}/${Number(progress.total)}`)
  }
  if (card.status) parts.push(taskStatusText(card.status))
  if (card.preview) parts.push(card.preview)
  return parts.filter(Boolean).join('。')
})
const taskCardMembers = computed(() => {
  const members = taskCard.value?.members || props.message.members || []
  return members.length ? members : [{ id: 'assistant', name: '我的分身', avatar: teamAssistantAvatar, description: '牵头拆解和调度任务' }]
})
const welcomeCardTitle = computed(() => {
  const title = String(welcomeCard.value?.title || '').trim()
  if (!title || title === '成员相互介绍') return '新人介绍'
  return title
})
const welcomeCardMembers = computed(() => welcomeCard.value?.members || [])

function onAvatarError(e) {
  if (e?.target) e.target.src = defaultAgentAvatar
}

function onUserAvatarError(e) {
  if (e?.target) e.target.src = userAvatarFallback
}

function openTaskCard() {
  const taskRef = {
    taskId: taskCard.value?.taskId || taskCard.value?.task_id || props.message.taskId,
    executionThreadId: taskCard.value?.executionThreadId || taskCard.value?.execution_thread_id || props.message.executionThreadId,
  }
  if (taskRef.taskId || taskRef.executionThreadId) emit('open-task', taskRef)
}

function openWelcomeCard() {
  const taskRef = {
    taskId: welcomeCard.value?.taskId || welcomeCard.value?.task_id || props.message.taskId,
    executionThreadId: welcomeCard.value?.executionThreadId || welcomeCard.value?.execution_thread_id || props.message.executionThreadId,
  }
  if (taskRef.taskId || taskRef.executionThreadId) emit('open-task', taskRef)
}
</script>

<style scoped>
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 24px 0;
  animation: msgAppear 0.24s ease-out;
}

.message-row--human {
  justify-content: flex-end;
}

.message-avatar-wrap {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.message-avatar--clickable {
  cursor: pointer;
  transition: filter 0.15s;
}

.message-avatar--clickable:hover {
  filter: brightness(1.05);
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #f2f4f7;
}

.message-avatar--human {
  margin-left: 8px;
}

.message-main {
  max-width: min(720px, calc(100% - 58px));
  min-width: 0;
}

.message-main--wide-card {
  width: min(1000px, calc(100% - 52px));
  max-width: min(1000px, calc(100% - 52px));
}

.message-row--human .message-main {
  max-width: min(70%, 1000px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-head {
  display: flex;
  align-items: center;
  min-height: 34px;
  margin-bottom: 8px;
}

.message-head--human {
  justify-content: flex-end;
  margin-bottom: 8px;
}

.message-author {
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
}

.message-time {
  margin-left: 6px;
  font-size: 12px;
  color: #91949e;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-head--human .message-time {
  margin-left: 0;
}

.message-row:hover .message-time {
  opacity: 1;
}

.message-content-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.message-row--human .message-content-wrap {
  align-items: flex-end;
}

.message-bubble {
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message-bubble--agent {
  padding: 0;
  color: #2f3547;
}

.message-bubble--human {
  padding: 13px 16px;
  color: #2f3547;
  background: #F3F5F7;
  border-radius: 8px 0 8px 8px;
}

.message-bubble :deep(p) {
  margin: 0 0 8px;
}

.message-bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.message-actions {
  margin-top: 4px;
}

.message-actions--human {
  display: flex;
  justify-content: flex-end;
}

.message-actions :deep(.msg-actions) {
  visibility: hidden;
}

.message-row:hover .message-actions :deep(.msg-actions) {
  visibility: visible;
}

.task-card-message {
  margin: 16px 0 18px 42px;
  width: min(100%, 560px);
  border-radius: 12px;
  background: #f3f5f9;
  padding: 14px 18px 18px;
}

.task-card-message--inline {
  width: 100%;
  margin: 12px 0 0;
}

.task-card-head {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 32px;
  border: 0;
  outline: 0;
  background: transparent;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 0;
  cursor: pointer;
  color: #2f3547;
  font-size: 16px;
  font-weight: 700;
  text-align: left;
  font: inherit;
  box-shadow: none;
}

.task-card-swirl {
  color: #2d7dff;
  font-weight: 900;
}

.task-card-more {
  color: #2f3547;
  font-size: 14px;
  font-weight: 500;
}

.welcome-card-message {
  padding: 12px 13px 16px 16px;
  border-radius: 12px;
  background: #F5F6F9;
}

.welcome-card-message.task-card-message--inline {
  width: 100%;
  margin-top: 14px;
}

.welcome-card-head {
  height: 22px;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 7px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #2f3547;
}

.welcome-card-title-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.welcome-card-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #2f3547;
}

.welcome-card-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  text-align: justify;
  letter-spacing: normal;
  color: #2f3547;
}

.welcome-card-more-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
}

.task-card-preview {
  margin: 6px 0 0;
  color: #6d7384;
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.task-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.welcome-card-body {
  gap: 8px;
  margin-top: 12px;
}

.task-card-member {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 62px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
}

.welcome-card-member {
  min-height: 74px;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  align-items: flex-start;
}

.welcome-card-avatar-shell {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.task-card-avatar {
  width: 24px;
  height: 24px;
  /* border-radius: 9px; */
  object-fit: cover;
  flex-shrink: 0;
}

.welcome-card-avatar {
  border-radius: 8px;
}

.task-card-member-main {
  min-width: 0;
}

.task-card-member-main strong {
  display: block;
  color: #2F3547;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.welcome-card-member .task-card-member-main strong {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #2f3547;
}

.task-card-member-main p {
  margin: 0;
  color: #606572;
  font-size: 14px;
  line-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.welcome-card-member .task-card-member-main p {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: #606572;
}

.message-status {
  margin-top: 6px;
  color: #ff4d4f;
  font-size: 12px;
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
</style>
