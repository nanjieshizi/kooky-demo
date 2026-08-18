/**
 * 未读管理功能
 */
import {
  getConversationMentionApi,
  getConversationUnreadApi,
  markConversationMessageReadApi,
} from '@/shared/services/imApi.js'

function normalizeConversationUnread(item = {}) {
  const conversationId = item.conv_id ?? item.conversation_id ?? item.conversationId
  if (conversationId == null) return null
  const unreadCount = Number(item.unread_count ?? item.unreadCount ?? item.conv_count ?? 0)
  return {
    conversationId,
    unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
    hasMention: Boolean(item.has_mention ?? item.hasMention),
    mentionInfo: item.mention_info ?? item.mentionInfo ?? null,
    lastReadEventPk: item.last_read_event_pk ?? item.lastReadEventPk ?? null,
  }
}

export function normalizeUnreadPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return { totalUnread: 0, conversationUnreads: {} }
  }

  const conversationUnreads = {}
  const list = Array.isArray(payload.unread_conversations)
    ? payload.unread_conversations
    : (Array.isArray(payload.conversations) ? payload.conversations : [])

  for (const item of list) {
    const normalized = normalizeConversationUnread(item)
    if (!normalized) continue
    conversationUnreads[normalized.conversationId] = {
      unreadCount: normalized.unreadCount,
      hasMention: normalized.hasMention,
      mentionInfo: normalized.mentionInfo,
      lastReadEventPk: normalized.lastReadEventPk,
    }
  }

  const single = normalizeConversationUnread(payload)
  if (single) {
    conversationUnreads[single.conversationId] = {
      unreadCount: single.unreadCount,
      hasMention: single.hasMention,
      mentionInfo: single.mentionInfo,
      lastReadEventPk: single.lastReadEventPk,
    }
  }

  const explicitTotal = Number(payload.total_unread ?? payload.totalUnread)
  const totalUnread = Number.isFinite(explicitTotal)
    ? Math.max(0, explicitTotal)
    : Object.values(conversationUnreads).reduce((sum, item) => sum + (item.unreadCount || 0), 0)

  return { totalUnread, conversationUnreads }
}

export function applyUnreadSnapshot(client, payload = {}) {
  const normalized = normalizeUnreadPayload(payload)
  client._unreadSnapshot = normalized
  return normalized
}

export function applyReadUnreadUpdate(client, payload = {}) {
  if (!client._unreadSnapshot) {
    client._unreadSnapshot = { totalUnread: 0, conversationUnreads: {} }
  }
  const conversationId = payload.conversation_id ?? payload.conversationId ?? payload.conv_id
  const unread = payload.unread && typeof payload.unread === 'object' ? payload.unread : payload
  if (conversationId != null) {
    const convCount = Number(unread.conv_count ?? unread.unread_count ?? unread.unreadCount ?? 0)
    client._unreadSnapshot.conversationUnreads[conversationId] = {
      ...(client._unreadSnapshot.conversationUnreads[conversationId] || {}),
      unreadCount: Number.isFinite(convCount) ? Math.max(0, convCount) : 0,
      hasMention: Boolean(unread.has_mention ?? unread.hasMention),
      mentionInfo: unread.mention_info ?? unread.mentionInfo ?? null,
      lastReadEventPk: unread.last_read_event_pk ?? unread.lastReadEventPk ?? client._unreadSnapshot.conversationUnreads[conversationId]?.lastReadEventPk ?? null,
    }
  }
  const total = Number(unread.total_count ?? unread.total_unread ?? unread.totalUnread)
  client._unreadSnapshot.totalUnread = Number.isFinite(total)
    ? Math.max(0, total)
    : Object.values(client._unreadSnapshot.conversationUnreads).reduce((sum, item) => sum + (item.unreadCount || 0), 0)
  return client._unreadSnapshot
}

export async function fetchUnreadCounts(client) {
  client._checkInitialized()
  const result = await getConversationUnreadApi()
  return applyUnreadSnapshot(client, result)
}

export async function fetchConversationUnread(client, conversationId) {
  client._checkInitialized()
  const result = await getConversationUnreadApi({ conv_id: conversationId })
  const normalized = normalizeUnreadPayload(result)
  const entry = normalized.conversationUnreads[conversationId] || Object.values(normalized.conversationUnreads)[0] || {
    unreadCount: 0,
    hasMention: false,
    mentionInfo: null,
    lastReadEventPk: null,
  }
  if (!client._unreadSnapshot) client._unreadSnapshot = { totalUnread: 0, conversationUnreads: {} }
  client._unreadSnapshot.conversationUnreads[conversationId] = entry
  client._unreadSnapshot.totalUnread = Object.values(client._unreadSnapshot.conversationUnreads)
    .reduce((sum, item) => sum + (item.unreadCount || 0), 0)
  return entry
}

export async function fetchMentionInfo(client, conversationId) {
  client._checkInitialized()
  const result = await getConversationMentionApi(conversationId)
  return {
    hasMention: Boolean(result?.has_mention ?? result?.hasMention),
    mentionInfo: result?.mention_info ?? result?.mentionInfo ?? null,
  }
}

export async function markMessageAsRead(client, conversationId, payload) {
  client._checkInitialized()
  return markConversationMessageReadApi(conversationId, payload)
}

function getConversationUnreadEntry(client, conversationId) {
  const entries = client._unreadSnapshot?.conversationUnreads || {}
  if (conversationId == null) return null
  if (entries[conversationId]) return entries[conversationId]
  const hit = Object.entries(entries).find(([id]) => String(id) === String(conversationId))
  return hit?.[1] ?? null
}

/**
 * 获取会话未读数
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 会话 ID
 */
export function getRoomUnreadCounts(client, conversationId) {
  const entry = getConversationUnreadEntry(client, conversationId)
  return {
    unreadCount: entry?.unreadCount ?? 0,
    hasMention: Boolean(entry?.hasMention)
  }
}

/**
 * 获取未读 @提及 详情
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 会话 ID
 */
export function getUnreadMentionDetails(client, conversationId) {
  const entry = getConversationUnreadEntry(client, conversationId)
  return {
    items: entry?.mentionInfo ? [entry.mentionInfo] : [],
    updatedAt: Date.now()
  }
}

/**
 * 刷新未读 @提及 详情
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 会话 ID
 */
export async function refreshUnreadMentionDetails(client, conversationId) {
  return fetchMentionInfo(client, conversationId)
}

/**
 * 刷新所有会话的未读 @提及 详情
 * @param {Object} client - HttpIMClient 实例
 */
export async function refreshAllUnreadMentionDetails(client) {
  return fetchUnreadCounts(client)
}
