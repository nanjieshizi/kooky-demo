<template>
  <Transition name="card-fade">
    <div
      v-if="!dismissed"
      class="notification-card"
      :class="[`card-${card.cardType}`, { 'card-suppress': card.suppressAction }]"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
    <div class="card-content" flex>
      <div
        class="card-avatar"
        :style="avatarStyle"
      >
        <span class="card-avatar__text">{{ avatarText }}</span>
      </div>
      <div class="card-head" ml-12px>
          <div class="card-top-row">
            <span class="card-room-name">{{ cardTitle }}</span>
            <span v-if="card.cardType === 'normal' && card.unreadCount > 0" class="unread-count">{{ card.unreadCount }}</span>
          </div>
          <div v-if="card.cardType === 'normal' && card.lastMessageSender" class="card-sender">
            {{ senderName }}@你
          </div>
          <div v-else class="card-system-label">系统通知</div>
      </div>
    </div>


      <div class="card-body">
      

        <div class="card-desc">
          <template v-if="card.cardType === 'normal'">
            <span class="content">{{ quotedContent }}</span>
          </template>
          <template v-else-if="card.cardType === 'kicked'">
            <span class="system-tip">你已被移出"{{ conversationName }}"，请知悉。</span>
          </template>
          <template v-else-if="card.cardType === 'dissolved'">
            <span class="system-tip">"{{ conversationName }}"已解散，请知悉。</span>
          </template>
        </div>

        <div class="card-footer" justify-between>
          <span class="card-time">{{ timeLabel }}</span>
          <span v-if="!hovered && card.isKicked" class="kicked-tip">你已被移出该团队</span>
          <span v-if="!hovered && card.isDissolved" class="kicked-tip">该团队已解散</span>
          <div v-if="hovered" class="card-actions">
            <button class="action-btn" @click.stop="handleMarkRead">已读</button>
            <button
              v-if="card.cardType === 'normal' && !card.suppressAction"
              class="action-btn action-view"
              @click.stop="handleView"
            >查看</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { getPortalUserId } from '@/shared/utils/userInfoStorage.js'

const teamColorPalette = [
  { color: '#F67C43', border: 'rgba(246, 124, 67, 0.2)' },
  { color: '#E9628B', border: 'rgba(233, 98, 139, 0.2)' },
  { color: '#9F73F9', border: 'rgba(159, 115, 249, 0.2)' },
  { color: '#57CFDE', border: 'rgba(87, 207, 222, 0.2)' },
  { color: '#659EFF', border: 'rgba(101, 158, 255, 0.2)' },
]

const groupStore = useGroupStore()

const props = defineProps({
  card: { type: Object, required: true },
})
const emit = defineEmits(['mark-read', 'view'])

const hovered = ref(false)
const dismissed = ref(false)

const conversationId = computed(() => props.card.conversationId ?? '')
const conversationName = computed(() => props.card.conversationName ?? '')

const avatarText = computed(() => {
  const name = (conversationName.value && String(conversationName.value).trim()) || '?'
  return name.length >= 2 ? name.substring(0, 2) : name.charAt(0) || '?'
})

const avatarStyle = computed(() => {
  // 优先用 groupConversations 索引取色，找不到时用 conversationId 哈希取色
  let idx = groupStore.groupConversations.findIndex(g => g.conversationId === conversationId.value)
  if (idx < 0) {
    const id = conversationId.value || ''
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    idx = hash
  }
  const palette = teamColorPalette[idx % teamColorPalette.length]
  return {
    borderColor: palette.border,
    color: palette.color,
  }
})

/** kicked 类型标题显示"移出团队通知"，dissolved 类型显示"群解散通知"，其他类型显示群名 */
const cardTitle = computed(() => {
  if (props.card.cardType === 'kicked') return '移出团队通知'
  if (props.card.cardType === 'dissolved') return '团队解散通知'
  return conversationName.value
})

const senderName = computed(() => {
  const s = props.card.lastMessageSender || ''
  // 优先从会话成员缓存中查找显示名
  if (conversationId.value && s) {
    const members = groupStore.conversationMembers?.[conversationId.value]
    if (Array.isArray(members)) {
      const member = members.find(m => m.userId === s)
      if (member?.displayName) return member.displayName
    }
  }
  // 兜底：提取域账号
  if (s.startsWith('@')) {
    const local = s.slice(1).split(':')[0]
    return local || s
  }
  return s
})

const quotedContent = computed(() => {
  const raw = String(props.card.lastMessageContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[“"'`]+|[”"'`]+$/g, '')
    .trim()
  const myLocalPart = getPortalUserId()

  let text = raw
  if (myLocalPart) {
    const escapedLocalPart = myLocalPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`^[@＠]${escapedLocalPart}(?:\\b|\\s|[,:：，])\\s*`, 'i'), '')
  }
  text = text.replace(/^([@＠][^\s"'“”,:：，]+[\s,:：，]*)+/u, '').trim()

  if (!text) text = '新消息'
  return text
})

const timeLabel = computed(() => {
  const ts = props.card.lastMessageTimestamp
  if (!ts) return ''
  const now = Date.now()
  const diffMs = now - ts
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin <= 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 2) return '昨天'
  if (diffDay <= 7) return `${diffDay}天前`
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})

function handleMarkRead() {
  dismissed.value = true
  emit('mark-read', props.card)
}

function handleView() {
  dismissed.value = true
  emit('view', props.card)
}
</script>

<style lang="scss" scoped>
.card-fade-leave-active {
  transition: opacity 0.25s ease, max-height 0.3s ease, margin 0.3s ease, padding 0.3s ease;
  overflow: hidden;
  max-height: 122px;
}

.card-fade-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.notification-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
  margin: 0 16px 8px;
  padding: 12px;
  border-radius: 12px;
  background: #F5F6F9;
  transition: background 0.15s, box-shadow 0.15s, transform 0.15s;

  &:hover {
    // background: #F1F3F7;
    // box-shadow: 0 8px 20px rgba(47, 53, 71, 0.08);
    // transform: translateY(-1px);
  }

  &.card-kicked,
  &.card-dissolved {
    opacity: 0.92;
  }

  &.card-suppress {
    cursor: default;
  }
}

.card-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-avatar__text {
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.card-body {
  flex: 1;
  width: 100%;

  display: flex;
  flex-direction: column;
}

.card-head {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.card-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 20px;
}

.card-room-name {
  max-width: 124px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: normal;
  color: #2F3547;
}

.unread-count {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  color: #5A6072;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(90, 96, 114, 0.08);
}

.card-sender,
.card-system-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: normal;
  text-align: left;
}

.card-sender {
  color: #91949E;
}

.card-system-label {
  color: #91949E;
}

.card-desc {
  margin-top: 8px;
  margin-bottom: 9px;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  letter-spacing: normal;
  text-align: left;

  .content,
  .system-tip {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .content {
    color: #606572;
  }

  .system-tip {
    color: #606572;
  }
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 0;
  min-height: 24px;
}

.card-time {
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  letter-spacing: normal;
  text-align: left;
  color: #91949E;
  white-space: nowrap;
}

.kicked-tip {
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  letter-spacing: normal;
  color: #ED4543;
  white-space: nowrap;
  margin-left: auto;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.action-btn {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: normal;
  letter-spacing: normal;
  border: none;
  /* 主题色/--color-primary */
  /* 样式描述：品牌主色 */
  color: #436FF6;
  cursor: pointer;
}

.action-view {
  color: #2F6BFF;
}
</style>
