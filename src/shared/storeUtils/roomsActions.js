// 会话列表管理公共函数（group 模块专用）

import { client } from '@/shared/im-client'
import { useUIStore } from '@/modules/space/uiStore.js'
import { useFileStore } from '@/modules/file/store.js'
import { clearLegacyTeamSpacesLocalStorage } from '@/shared/utils/storageKey.js'
import { useUnreadStore } from '@/modules/shared/store/unreadStore.js'

function getConversations(store) {
  return store.conversations ?? []
}

function setConversations(store, conversations) {
  store.conversations = conversations
}

function getConversationId(conversation) {
  return conversation?.conversationId
}

function sameConversationId(a, b) {
  return String(a) === String(b)
}

function isLeftConversation(store, conversationId) {
  return new Set(store._leftConversationIds ?? []).has(conversationId)
}

function dropLeftConversation(store, conversationId) {
  if (store._leftConversationIds) {
    store._leftConversationIds = store._leftConversationIds.filter((id) => id !== conversationId)
  }
}

function pushLeftConversation(store, conversationId) {
  if (!store._leftConversationIds) store._leftConversationIds = []
  if (!store._leftConversationIds.includes(conversationId)) store._leftConversationIds.push(conversationId)
}

export function sortConversationsByLatestTimeline(store) {
  getConversations(store).sort((a, b) => {
    const tsA = a.lastTimelineTs ?? 0
    const tsB = b.lastTimelineTs ?? 0
    return tsB - tsA
  })
}

export function upsertConversation(store, conversation) {
  const conversationId = getConversationId(conversation)
  if (!conversationId) return null
  if (isLeftConversation(store, conversationId)) dropLeftConversation(store, conversationId)

  const conversations = getConversations(store)
  const idx = conversations.findIndex((item) => sameConversationId(getConversationId(item), conversationId))
  if (idx === -1) {
    conversations.unshift(conversation)
  } else {
    conversations.splice(idx, 1, {
      ...conversations[idx],
      ...conversation,
      raw: conversation.raw ?? conversations[idx].raw,
    })
  }

  const rc = store._ensureConversationMessages?.(conversationId)
  if (rc) {
    const { unreadCount, hasMention } = client.getRoomUnreadCounts(conversationId)
    rc.unreadCount = unreadCount
    rc.hasUnreadDot = unreadCount > 0
    rc.hasMentionDot = unreadCount > 0 && hasMention
  }

  sortConversationsByLatestTimeline(store)
  return getConversations(store).find((item) => sameConversationId(getConversationId(item), conversationId)) || null
}

export function updateConversationName(store, conversationId, name) {
  if (!conversationId || !name) return null
  const conversation = getConversations(store).find((item) => sameConversationId(getConversationId(item), conversationId))
  if (!conversation) return null
  conversation.name = name
  conversation.raw = {
    ...(conversation.raw || {}),
    name,
    conv_name: name,
  }
  return conversation
}

export function updateConversationMemberCount(store, conversationId, options = {}) {
  if (!conversationId) return null
  const conversation = getConversations(store).find((item) => sameConversationId(getConversationId(item), conversationId))
  if (!conversation) return null

  const explicitCount = Number(options.memberCount)
  const currentCount = Number(conversation.memberCount ?? conversation.raw?.member_count ?? conversation.raw?.memberCount ?? 0)
  const memberDelta = Number(options.memberDelta)
  const nextCount = Number.isFinite(explicitCount)
    ? Math.max(0, explicitCount)
    : Math.max(0, (Number.isFinite(currentCount) ? currentCount : 0) + (Number.isFinite(memberDelta) ? memberDelta : 0))

  conversation.memberCount = nextCount
  conversation.raw = {
    ...(conversation.raw || {}),
    member_count: nextCount,
    memberCount: nextCount,
  }
  return conversation
}

export function syncActiveSpaceWithConversations(store, pendingConversationId) {
  if (!store.currentSpaceId) return
  if (pendingConversationId && store.currentSpaceId === pendingConversationId) return
  const exists = getConversations(store).some((item) => getConversationId(item) === store.currentSpaceId)
  if (!exists) store.currentSpaceId = null
}

export async function loadConversations(store, pendingConversationId, config) {
  const { conversationType, logPrefix, onLoadConversationsFilter } = config

  try {
    const allConversations = await client.fetchGroupRooms()
    let filteredConversations = allConversations.filter(
      (item) => item.createRoomType === conversationType && !isLeftConversation(store, getConversationId(item)),
    )

    if (onLoadConversationsFilter) {
      filteredConversations = onLoadConversationsFilter.call(store, filteredConversations, {
        allConversations,
        pendingConversationId,
      })
    }

    setConversations(store, filteredConversations)
    sortConversationsByLatestTimeline(store)
    syncActiveSpaceWithConversations(store, pendingConversationId)

    for (const conversation of getConversations(store)) {
      const conversationId = getConversationId(conversation)
      if (!conversationId || conversationId === store.currentConversationId) continue
      const rc = store._ensureConversationMessages(conversationId)
      if (!rc) continue
      const { unreadCount, hasMention } = client.getRoomUnreadCounts(conversationId)
      rc.unreadCount = unreadCount
      rc.hasUnreadDot = unreadCount > 0
      rc.hasMentionDot = unreadCount > 0 && hasMention
    }

    if (client.isConnected()) client.refreshAllUnreadMentionDetails()
  } catch (error) {
    console.error(`${logPrefix} 加载会话列表失败:`, error)
  }
}

export async function selectConversation(store, conversationId, logPrefix) {
  if (store.currentConversationId === conversationId) return

  store.currentConversationId = conversationId

  await store.loadHistory(conversationId)

  const rc = store.conversationMessages?.[conversationId]
  if (rc && (rc.unreadCount > 0 || rc.hasUnreadDot || rc.hasMentionDot)) {
    rc.entryHadMention = rc.hasMentionDot
    rc.unreadCount = 0
    rc.hasUnreadDot = false
    rc.hasMentionDot = false
    rc.unreadMentionItems = []
    useUIStore().setNotificationMentionRead(conversationId, Date.now())
  }
  const unreadStoreInstance = useUnreadStore()
  unreadStoreInstance.markLatestMessageAsRead(conversationId, 'group').catch((e) => {
    console.warn(`${logPrefix} markLatestMessageAsRead 失败:`, e?.message)
  })
}

export function bumpConversationTimelineTs(store, conversationId, ts) {
  const conversation = getConversations(store).find((item) => getConversationId(item) === conversationId)
  if (!conversation) return
  conversation.lastTimelineTs = ts
  sortConversationsByLatestTimeline(store)
}

export function updateTeamMembers(store, conversationId, memberAgentIds) {
  store.teamMemberAgentIdsByConversationId = {
    ...store.teamMemberAgentIdsByConversationId,
    [conversationId]: memberAgentIds,
  }
}

export function completeTeamIntro(store, conversationId) {
  store.teamIntroCompletedByConversationId = {
    ...store.teamIntroCompletedByConversationId,
    [conversationId]: true,
  }
}

export function setCurrentSpaceId(store, id) {
  store.currentSpaceId = id
  store.isCreatingTeam = false
}

export function startCreatingTeam(store) {
  store.isCreatingTeam = true
}

export function cancelCreatingTeam(store) {
  store.isCreatingTeam = false
}

export function resetChatNavigation(store) {
  clearLegacyTeamSpacesLocalStorage()
  store.currentSpaceId = null
  store.isCreatingTeam = false
  store.teamIntroCompletedByConversationId = {}
  store.teamMemberAgentIdsByConversationId = {}
}

export function onConversationLeft(store, { conversationId, conversationName, cardType }, logPrefix) {
  const id = conversationId
  if (!id) return
  const name = conversationName || id

  console.log(`${logPrefix} ConversationLeft 事件:`, { conversationId: id, conversationName: name, cardType })

  if ((cardType === 'kicked' || cardType === 'dissolved') && !isLeftConversation(store, id)) {
    const existing = store.leftConversationMentionSnapshots?.[id]
    if (existing) {
      store.leftConversationMentionSnapshots = {
        ...store.leftConversationMentionSnapshots,
        [id]: { ...existing, cardType, conversationName: existing.conversationName || name },
      }
    } else {
      const rc = store.conversationMessages?.[id]
      const conversation = getConversations(store).find((item) => getConversationId(item) === id)
      let items = Array.isArray(rc?.unreadMentionItems) ? rc.unreadMentionItems.map((i) => ({ ...i })) : []
      const cachedDetails = client.getUnreadMentionDetails?.(id)
      if (items.length === 0 && Array.isArray(cachedDetails?.items) && cachedDetails.items.length > 0) {
        items = cachedDetails.items.map((i) => ({ ...i }))
      }
      if (store.leftConversationMentionSnapshots !== undefined) {
        store.leftConversationMentionSnapshots = {
          ...store.leftConversationMentionSnapshots,
          [id]: {
            conversationId: id,
            conversationName: conversation?.name || name,
            items,
            updatedAt: rc?.unreadMentionDetailsUpdatedAt ?? Date.now(),
            cardType,
          },
        }
      }
    }
  }

  useUIStore().addNotificationLeaveCard({
    conversationId: id,
    conversationName: name,
    cardType: cardType || 'kicked',
    lastMessageTimestamp: Date.now(),
    unreadCount: 0,
    hasMention: false,
    avatar: null,
  })

  pushLeftConversation(store, id)
  setConversations(store, getConversations(store).filter((item) => getConversationId(item) !== id))

  if (store.currentSpaceId === id) store.currentSpaceId = null
  if (store.currentConversationId === id) store.currentConversationId = null

  delete store.conversationMessages?.[id]
  delete store.conversationMembers?.[id]
  delete store.conversationMembersLoading?.[id]

  if (cardType === 'dissolved') useFileStore().clearTeamFiles(id)
}

export function onConversationInvite(store, { conversationId }, logPrefix) {
  client.joinRoom(conversationId).catch((e) => {
    console.warn(`${logPrefix} 自动接受邀请失败:`, e?.message)
  })
}

export function onPostConnect(store, config) {
  return loadConversations(store, undefined, config)
}

export function onConversationsUpdated(store, conversations, config) {
  return loadConversations(store, undefined, config)
}
