// 房间成员管理公共函数

import { client } from '@/shared/im-client'

function isMemberEqual(a, b) {
  if (a.userId !== b.userId) return false
  if (a.displayName !== b.displayName) return false
  if (a.isOwner !== b.isOwner) return false
  if (a.account !== b.account) return false
  if (a.avatarUrl !== b.avatarUrl) return false
  if (a.avatarHttpUrl !== b.avatarHttpUrl) return false
  if (a.department !== b.department) return false
  if (a.departmentFull !== b.departmentFull) return false
  const deptA = JSON.stringify(a.departments ?? a.departments_list ?? null)
  const deptB = JSON.stringify(b.departments ?? b.departments_list ?? null)
  return deptA === deptB
}

export function applyConversationMembersDiff(store, conversationId, incoming) {
  const next = Array.isArray(incoming) ? incoming : []
  const existing = store.conversationMembers[conversationId]

  if (!existing) {
    store.conversationMembers[conversationId] = next
    return
  }

  const incomingMap = new Map(next.map((m) => [m.userId, m]))

  for (let i = existing.length - 1; i >= 0; i--) {
    if (!incomingMap.has(existing[i].userId)) {
      existing.splice(i, 1)
    }
  }

  const existingIdxMap = new Map(existing.map((m, i) => [m.userId, i]))

  for (const [userId, newMember] of incomingMap) {
    const idx = existingIdxMap.get(userId)
    if (idx === undefined) {
      existing.push(newMember)
    } else if (!isMemberEqual(existing[idx], newMember)) {
      existing.splice(idx, 1, newMember)
    }
  }
}

export async function loadConversationMembers(store, conversationId, options, logPrefix) {
  const { force = false } = options || {}
  if (!conversationId) return
  if (store.conversationMembersLoading[conversationId]) return
  if (!force && store.conversationMembers[conversationId]) return
  store.conversationMembersLoading[conversationId] = true
  try {
    const list = await client.getRoomMembers(conversationId)
    applyConversationMembersDiff(store, conversationId, list)
  } catch (e) {
    console.error(`${logPrefix} loadConversationMembers 失败:`, e?.message)
    store.conversationMembers[conversationId] = []
  } finally {
    store.conversationMembersLoading[conversationId] = false
  }
}

export async function refreshConversationMembers(store, conversationId, logPrefix) {
  if (!conversationId) return
  if (store.conversationMembersLoading[conversationId]) return
  store.conversationMembersLoading[conversationId] = true
  try {
    const list = await client.getRoomMembers(conversationId)
    applyConversationMembersDiff(store, conversationId, list)
  } catch (e) {
    console.error(`${logPrefix} _refreshConversationMembers 失败:`, e?.message)
    store.conversationMembers[conversationId] = []
  } finally {
    store.conversationMembersLoading[conversationId] = false
  }
}

export function debouncedRefreshConversationMembers(store, conversationId, debounceDelay, logPrefix) {
  if (!conversationId) return
  if (!store.conversationMembers[conversationId]) return
  if (store._membersRefreshTimers[conversationId]) {
    clearTimeout(store._membersRefreshTimers[conversationId])
  }
  store._membersRefreshTimers[conversationId] = setTimeout(() => {
    delete store._membersRefreshTimers[conversationId]
    refreshConversationMembers(store, conversationId, logPrefix)
  }, debounceDelay)
}

export function applyConversationMemberTyping(store, payload) {
  const { conversationId, userId, typing } = payload || {}
  if (!conversationId || !userId) return
  const my = store.userId
  if (my && String(userId).toLowerCase() === String(my).toLowerCase()) return
  const rc = store._ensureConversationMessages(conversationId)
  const cur = [...(rc.remoteTypingUserIds || [])]
  const idx = cur.findIndex((id) => String(id).toLowerCase() === String(userId).toLowerCase())
  if (typing) {
    if (idx < 0) cur.push(userId)
  } else if (idx >= 0) {
    cur.splice(idx, 1)
  }
  rc.remoteTypingUserIds = cur
}

export function applyConversationTypingSnapshot(store, payload) {
  const snap = payload?.snapshot
  if (!snap || typeof snap !== 'object') return
  for (const [conversationId, userIds] of Object.entries(snap)) {
    if (!conversationId) continue
    const rc = store._ensureConversationMessages(conversationId)
    rc.remoteTypingUserIds = Array.isArray(userIds) ? [...userIds] : []
  }
}

export function onConversationMemberTyping(store, payload) {
  applyConversationMemberTyping(store, payload)
}

export function onConversationTypingSnapshot(store, payload) {
  applyConversationTypingSnapshot(store, payload)
}

export function onConversationMembersUpdated(store, conversationId, debounceDelay, logPrefix) {
  debouncedRefreshConversationMembers(store, conversationId, debounceDelay, logPrefix)
}

export const applyMembersDiff = applyConversationMembersDiff
export const loadRoomMembers = loadConversationMembers
export const refreshRoomMembers = refreshConversationMembers
export const debouncedRefreshRoomMembers = debouncedRefreshConversationMembers
export const applyRoomMemberTyping = applyConversationMemberTyping
export const applyRoomTypingSnapshot = applyConversationTypingSnapshot
export const onRoomMemberTyping = onConversationMemberTyping
export const onRoomTypingSnapshot = onConversationTypingSnapshot
export const onRoomMembersUpdated = onConversationMembersUpdated
