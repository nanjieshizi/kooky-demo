// 消息历史加载公共函数（chat / group 模块共用）

import { client } from '@/shared/im-client'
import { findMentionMessageForScroll } from '@/shared/utils/mentionScroll.js'
import {
  formatRoomMessage,
  mergeHistoryPageBeforeMessages,
  mergeInviteSystemMessages,
} from '@/shared/storeUtils/roomMessageFormat'

export const IM_MESSAGE_PAGE_SIZE = 20

export async function loadOlderHistoryForMentionScroll(store, conversationId, { myUserId, lastReadEventId = null, maxPages = 300 } = {}) {
  if (!conversationId || !myUserId) return { pages: 0, found: false }
  let msgs = store.getMessagesByConversation(conversationId)
  if (findMentionMessageForScroll(msgs, myUserId, lastReadEventId)) {
    return { pages: 0, found: true }
  }
  let pages = 0
  while (client.canPaginateBackwards(conversationId) && pages < maxPages) {
    await store.loadMoreHistory(conversationId, IM_MESSAGE_PAGE_SIZE, { skipLoadMoreBuffer: true, skipLoadingMoreFlag: true })
    pages += 1
    msgs = store.getMessagesByConversation(conversationId)
    if (findMentionMessageForScroll(msgs, myUserId, lastReadEventId)) {
      return { pages, found: true }
    }
  }
  return { pages, found: false }
}

function toTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

// 按 timestamp 选最早消息的 server id，避免依赖数组顺序
function getEarliestServerId(messages) {
  let earliestId = null
  let earliestTs = Number.POSITIVE_INFINITY
  for (const m of messages) {
    const id = m?.eventId
    if (typeof id !== 'string' || !id) continue
    const ts = toTimestampMs(m?.timestamp)
    if (ts < earliestTs) {
      earliestTs = ts
      earliestId = id.startsWith('$') ? id.slice(1) : id
    }
  }
  return earliestId
}

// 按 timestamp 选最早消息的 server seq（HTTP IM /events 接口分页游标）
function getEarliestServerSeq(messages) {
  let earliestSeq = null
  let earliestTs = Number.POSITIVE_INFINITY
  for (const m of messages) {
    const seq = m?.seq
    if (typeof seq !== 'number') continue
    const ts = toTimestampMs(m?.timestamp)
    if (ts < earliestTs) {
      earliestTs = ts
      earliestSeq = seq
    }
  }
  return earliestSeq
}

/**
 * 窗口模式下向更早分页（用于跳转定位后继续往上滚）
 * 复用 client.paginateTimelineBackwards（基于 before_id 游标）
 */
export async function paginateWindowHistory(store, conversationId) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc || !rc.windowMode) return { added: 0, hasMore: false }
  if (rc.loadingMoreHistory || !client.isConnected()) {
    return { added: 0, hasMore: client.canPaginateBackwards(conversationId) }
  }

  const beforeId = getEarliestServerId(rc.messages)
  if (!beforeId) return { added: 0, hasMore: false }
  const beforeSeq = getEarliestServerSeq(rc.messages)

  rc.loadingMoreHistory = true
  try {
    const raw = await client.paginateTimelineBackwards(conversationId, IM_MESSAGE_PAGE_SIZE, { beforeId, beforeSeq })
    if (!raw || raw.length === 0) {
      return { added: 0, hasMore: client.canPaginateBackwards(conversationId) }
    }
    const formatted = raw.map((msg) => formatRoomMessage(msg))
    const mergedOlder = mergeInviteSystemMessages(formatted)
    const beforeCount = rc.messages.length
    rc.messages = mergeHistoryPageBeforeMessages(mergedOlder, rc.messages)
    return { added: rc.messages.length - beforeCount, hasMore: client.canPaginateBackwards(conversationId) }
  } catch (e) {
    console.error('[messageHistory] paginateWindowHistory 失败:', e)
    return { added: 0, hasMore: client.canPaginateBackwards(conversationId) }
  } finally {
    rc.loadingMoreHistory = false
  }
}

export async function exitWindowMode(store, conversationId) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc.windowMode) return
  rc.windowMode = false
  rc.mentionAnchorMessageId = null
  rc.quoteAnchorMessageId = null
  rc.messages = []
  rc.initialHistoryFetched = false
  await store.loadHistory(conversationId)
}
