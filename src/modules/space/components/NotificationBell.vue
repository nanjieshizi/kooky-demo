<template>
  <button
    class="icon-btn"
    :class="{ active: uiStore.notificationPanelOpen }"
    title="消息通知"
    @click="uiStore.toggleNotificationPanel()"
  >
    <img :src="bellIcon" alt="通知" class="bell-icon" />
    <span v-if="totalBadge > 0" class="unread-badge">
      {{ totalBadge > 99 ? '99+' : totalBadge }}
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { getVisibleUnreadMentionItems } from '@/shared/utils/notification.js'
import { ROOM_TYPES } from '@/shared/im-client'
import bellIcon from '@/assets/chat/tongzhi_iocn.svg'

const groupStore = useGroupStore()
const uiStore = useUIStore()

// 角标 = 所有群 @我 的未读消息数之和 + 缓存的离开通知数
const totalBadge = computed(() => {
  let count = 0
  const joinedConversationIds = new Set(
    groupStore.conversations
      .filter((conversation) => conversation.createRoomType === ROOM_TYPES.GROUP_CHAT)
      .map((conversation) => conversation.conversationId),
  )
  for (const conversation of groupStore.conversations) {
    if (conversation.createRoomType !== ROOM_TYPES.GROUP_CHAT) continue
    const conversationId = conversation.conversationId
    const rc = groupStore.conversationMessages[conversationId]
    const visibleMentionItems = getVisibleUnreadMentionItems(
      rc,
      uiStore.notificationMentionReadAt,
      conversationId,
    )
    if (visibleMentionItems.length > 0) {
      count += visibleMentionItems.length
    }
  }
  // 被踢出会话的冻结 @mention 快照（conversationMessages 已清除，单独计数）
  const readAtMap = uiStore.notificationMentionReadAt || {}
  for (const [conversationId, snapshot] of Object.entries(groupStore.leftConversationMentionSnapshots || {})) {
    const readAt = readAtMap[conversationId] || 0
    const visibleCount = (snapshot.items || []).filter((i) => (i.timestamp || 0) > readAt).length
    count += visibleCount
  }
  count += uiStore.notificationLeaveCards.filter((card) => {
    if (card.cardType !== 'kicked') return true
    return !joinedConversationIds.has(card.conversationId)
  }).length
  return count
})
</script>

<style lang="scss" scoped>
.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary, #F0F2F5);
  }

  &.active {
    background: var(--accent-light, #EBF3FF);
  }
}

.bell-icon {
  width: 16px;
  height: 16px;
}

.unread-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 8px;
  background: #F04040;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  pointer-events: none;
}
</style>
