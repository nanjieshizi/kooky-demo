<template>
  <div class="notification-panel-layout">
    <div class="panel-header">
      <!-- <span class="panel-title">通知<span v-if="totalCount > 0" class="panel-count">（{{ totalCount }}条消息）</span></span> -->
      <span class="panel-title"><span class="panel-count">{{ totalCount }}条消息</span></span>
      <div class="header-actions">
        <button v-if="cards.length > 0" class="clear-btn" title="全部清除" @click="handleClearAll">
          <img :src="clearIcon" alt="全部清除" class="clear-icon" />
        </button>
        <button class="close-btn" @click="uiStore.closeNotificationPanel()">
          <SvgIcon name="guanbi" :size="16" color="#000000" />
        </button>
      </div>
    </div>

    <div class="panel-body">
      <template v-if="cards.length > 0">
        <NotificationCard
          v-for="card in cards"
          :key="card.conversationId + card.cardType"
          :card="card"
          @mark-read="handleMarkRead"
          @view="handleView"
        />
      </template>
      <div v-else class="panel-empty">
        <img :src="zhanweiIcon" alt="暂无通知" class="empty-img" />
        <div class="empty-text">暂无新通知</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import NotificationCard from './NotificationCard.vue'
import { getVisibleUnreadMentionItems } from '@/shared/utils/notification.js'
import { ROOM_TYPES } from '@/shared/im-client'
import zhanweiIcon from '@/assets/home/preview.png'
import clearIcon from '@/assets/chat/clear.svg'

const props = defineProps({
  extraCards: { type: Array, default: () => [] },
})
const emit = defineEmits(['navigate'])

const groupStore = useGroupStore()
const uiStore = useUIStore()

function getCardConversationId(card) {
  return card?.conversationId
}

// @我 的群通知卡片
const mentionCards = computed(() => {
  const result = []
  const dissolvedRoomIds = new Set(
    (props.extraCards || [])
      .filter((card) => card.cardType === 'dissolved')
      .map(getCardConversationId),
  )
  const kickedRoomIds = new Set(
    (props.extraCards || [])
      .filter((card) => card.cardType === 'kicked')
      .map(getCardConversationId),
  )

  // 在线会话的 @mention 卡片
  for (const conversation of groupStore.conversations) {
    if (conversation.createRoomType !== ROOM_TYPES.GROUP_CHAT) continue
    const conversationId = conversation.conversationId
    const rc = groupStore.conversationMessages[conversationId]
    if (!rc) continue

    const mentionItems = getVisibleUnreadMentionItems(
      rc,
      uiStore.notificationMentionReadAt,
      conversationId,
    )
    if (mentionItems.length === 0) continue
    const latest = mentionItems.length > 0 ? mentionItems[mentionItems.length - 1] : null
    const messages = rc.messages || []
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null

    // 预加载会话成员列表，确保 NotificationCard 能获取到 displayName
    if (!groupStore.conversationMembers[conversationId]) {
      groupStore.loadConversationMembers(conversationId)
    }

    result.push({
      conversationId,
      conversationName: conversation.name || conversationId,
      cardType: 'normal',
      lastMessageContent: latest?.preview || lastMsg?.content || '',
      lastMessageSender: latest?.senderId || lastMsg?.senderId || '',
      lastMessageTimestamp: latest?.timestamp || lastMsg?.timestamp || 0,
      unreadCount: mentionItems.length || 1,
      hasMention: true,
      avatar: null,
      suppressAction: dissolvedRoomIds.has(conversationId) || kickedRoomIds.has(conversationId),
      isKicked: kickedRoomIds.has(conversationId),
      isDissolved: dissolvedRoomIds.has(conversationId),
    })
  }

  // 被踢出/解散会话的冻结 @mention 卡片（conversationMessages 已清除，从快照恢复）
  const readAtMap = uiStore.notificationMentionReadAt || {}
  for (const [conversationId, snapshot] of Object.entries(groupStore.leftConversationMentionSnapshots || {})) {
    const readAt = readAtMap[conversationId] || 0
    const visibleItems = (snapshot.items || []).filter((i) => (i.timestamp || 0) > readAt)
    if (visibleItems.length === 0) continue
    const latest = visibleItems[visibleItems.length - 1]
    const isKicked = snapshot.cardType === 'kicked'
    const isDissolved = snapshot.cardType === 'dissolved'
    result.push({
      conversationId,
      conversationName: snapshot.conversationName || conversationId,
      cardType: 'normal',
      lastMessageContent: latest?.preview || '',
      lastMessageSender: latest?.senderId || '',
      lastMessageTimestamp: latest?.timestamp || 0,
      unreadCount: visibleItems.length,
      hasMention: true,
      avatar: null,
      suppressAction: true,
      isKicked,
      isDissolved,
    })
  }

  result.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))
  return result
})

// 已离开群的通知卡片：当前已重新加入的群，不再展示历史 kicked 卡片
const visibleExtraCards = computed(() => {
  const joinedConversationIds = new Set(
    groupStore.conversations
      .filter((conversation) => conversation.createRoomType === ROOM_TYPES.GROUP_CHAT)
      .map((conversation) => conversation.conversationId),
  )
  return (props.extraCards || []).filter((ec) => {
    if (ec.cardType !== 'kicked') return true
    return !joinedConversationIds.has(getCardConversationId(ec))
  })
})

const cards = computed(() => {
  const extra = visibleExtraCards.value
  return [...mentionCards.value, ...extra].sort(
    (a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0),
  )
})

// 面板标题显示的总条数：@mention 未读数之和 + 离开通知数
const totalCount = computed(() => {
  let count = 0
  for (const card of mentionCards.value) {
    count += card.unreadCount || 1
  }
  count += visibleExtraCards.value.length
  return count
})

function handleMarkRead(card) {
  const conversationId = getCardConversationId(card)
  if (card.cardType === 'normal') {
    uiStore.setNotificationMentionRead(conversationId, card.lastMessageTimestamp || Date.now())
    // 被踢出/解散会话的冻结 mention 卡片已读时，清除快照
    if (card.isKicked || card.isDissolved) {
      const next = { ...(groupStore.leftConversationMentionSnapshots || {}) }
      delete next[conversationId]
      groupStore.leftConversationMentionSnapshots = next
    }
  } else {
    // kicked / dissolved：从离开通知缓存中移除
    uiStore.notificationLeaveCards = uiStore.notificationLeaveCards.filter(
      (c) => !(getCardConversationId(c) === conversationId && c.cardType === card.cardType),
    )
    try {
      localStorage.setItem('notification_leave_cards', JSON.stringify(uiStore.notificationLeaveCards))
    } catch { /* ignore */ }
  }
}

function handleView(card) {
  if (card.suppressAction) return
  uiStore.setNotificationMentionRead(getCardConversationId(card), card.lastMessageTimestamp || Date.now())
  emit('navigate', card)
}

function handleClearAll() {
  // 清除离开通知
  uiStore.clearAllNotificationLeaveCards()
  // 清除所有被踢出会话的 mention 快照
  groupStore.leftConversationMentionSnapshots = {}
  // 批量标记当前通知面板里的 @我 卡片已读
  for (const card of mentionCards.value) {
    uiStore.setNotificationMentionRead(card.conversationId, card.lastMessageTimestamp || Date.now())
  }
}
</script>

<style lang="scss" scoped>
.notification-panel-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 9px;
  flex-shrink: 0;
}

.panel-title {
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: normal;
  color: #2F3547;

  .panel-count {
    font-weight: 500;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;

  &:hover {
    background: #F0F2F5;
  }
}

.clear-icon {
  width: 16px;
  height: 16px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;

  &:hover {
    background: #F0F2F5;
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-top: 12px;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 40px 0;
}

.empty-img {
  width: 100px;
  height: auto;
}

.empty-text {
  font-size: 14px;
  color: #2F3547;
}
</style>
