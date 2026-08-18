// 群聊历史加载公共函数（replace 策略）

import { client } from '@/shared/im-client'
import { IM_MESSAGE_PAGE_SIZE } from '@/shared/storeUtils/messageHistory'
import {
  formatRoomMessage,
  mergeHistoryPageBeforeMessages,
  mergeInviteSystemMessages,
} from '@/shared/storeUtils/roomMessageFormat'

const LOAD_MORE_BUFFER_MS = 500

function toTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

// 按 timestamp 选最早消息的 server id，避免依赖数组顺序
function getEarliestServerEventId(messages) {
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

function sortMessages(messages) {
  return [...(Array.isArray(messages) ? messages : [])].sort((a, b) => {
    if (typeof a.seq === 'number' && typeof b.seq === 'number') return a.seq - b.seq
    return toTimestampMs(a.timestamp) - toTimestampMs(b.timestamp)
  })
}

function pickOldestSeq(messages) {
  let oldest = null
  for (const msg of messages || []) {
    if (typeof msg?.seq !== 'number') continue
    if (oldest === null || msg.seq < oldest) oldest = msg.seq
  }
  return oldest
}

function pickNewestSeq(messages) {
  let newest = null
  for (const msg of messages || []) {
    if (typeof msg?.seq !== 'number') continue
    if (newest === null || msg.seq > newest) newest = msg.seq
  }
  return newest
}

function setWindowBounds(rc) {
  rc.oldestSeq = pickOldestSeq(rc.messages)
  rc.newestSeq = pickNewestSeq(rc.messages)
}

function normalizeEventId(eventId) {
  if (eventId === undefined || eventId === null || eventId === '') return null
  return String(eventId)
}

function normalizeLookupId(value) {
  const normalized = normalizeEventId(value)
  return normalized?.replace(/^\$/, '') ?? null
}

function normalizeMessageLookupKeys(message) {
  return [
    message?.eventId,
    message?.eventPk,
    message?.id,
  ].map(normalizeLookupId).filter(Boolean)
}

function mergeForwardPage(currentMessages, newerMessages) {
  const seen = new Set()
  const merged = []
  for (const msg of [...(currentMessages || []), ...(newerMessages || [])]) {
    const id = normalizeEventId(msg?.eventId)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    merged.push(msg)
  }
  return sortMessages(merged)
}

export async function loadHistory(store, conversationId, logPrefix) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!conversationId || !rc) return
  if (rc.initialHistoryFetched) return
  if (rc._historyLoadPromise) return rc._historyLoadPromise

  rc._historyLoadPromise = (async () => {
    rc.loadingHistory = true
    try {
      const { messages: historyMessages, mentionAnchorMessageId, windowMode } =
        await client.getRoomMessages(conversationId, IM_MESSAGE_PAGE_SIZE)
      const formattedMessages = historyMessages.map((msg) => formatRoomMessage(msg))
      const mergedTimeline = mergeInviteSystemMessages(formattedMessages)

      if (windowMode && mentionAnchorMessageId) {
        rc.messages = mergedTimeline
        rc.windowMode = true
        rc.mentionAnchorMessageId = mentionAnchorMessageId
      } else {
        rc.messages = mergedTimeline
        rc.mentionAnchorMessageId = null
      }
      rc.isContextWindow = false
      rc.anchorMessageId = null
      rc.hasMoreForward = false
      setWindowBounds(rc)
    } catch (error) {
      console.error(`${logPrefix} 加载历史消息失败:`, error)
      throw error
    } finally {
      rc.loadingHistory = false
      rc.initialHistoryFetched = true
      delete rc._historyLoadPromise
    }
  })()

  return rc._historyLoadPromise
}

export async function loadMoreHistory(store, conversationId, pageLimit = IM_MESSAGE_PAGE_SIZE, options = {}, logPrefix) {
  const { skipLoadMoreBuffer = false, skipLoadingMoreFlag = false } = options
  const rc = store._ensureConversationMessages(conversationId)
  if (!conversationId || !rc || rc.loadingMoreHistory || !client.isConnected()) {
    return { added: 0, hasMore: false }
  }
  if (!client.canPaginateBackwards(conversationId)) {
    return { added: 0, hasMore: false }
  }

  const beforeId = getEarliestServerEventId(rc.messages)
  if (!beforeId) {
    return { added: 0, hasMore: false }
  }
  const beforeSeq = getEarliestServerSeq(rc.messages)

  const loadMoreStartedAt = Date.now()
  if (!skipLoadingMoreFlag) rc.loadingMoreHistory = true
  try {
    const raw = await client.paginateTimelineBackwards(conversationId, pageLimit, { beforeId, beforeSeq })
    const formatted = raw.map((msg) => formatRoomMessage(msg))
    const mergedOlder = mergeInviteSystemMessages(formatted)
    const beforeCount = rc.messages.length
    rc.messages = mergeHistoryPageBeforeMessages(mergedOlder, rc.messages)
    setWindowBounds(rc)
    return { added: rc.messages.length - beforeCount, hasMore: client.canPaginateBackwards(conversationId) }
  } catch (e) {
    console.error(`${logPrefix} loadMoreHistory 失败:`, e)
    return { added: 0, hasMore: client.canPaginateBackwards(conversationId) }
  } finally {
    if (!skipLoadMoreBuffer) {
      const elapsed = Date.now() - loadMoreStartedAt
      const remain = Math.max(0, LOAD_MORE_BUFFER_MS - elapsed)
      if (remain > 0) await new Promise((resolve) => setTimeout(resolve, remain))
    }
    if (!skipLoadingMoreFlag) rc.loadingMoreHistory = false
  }
}

export function findMessageInCurrentWindow(store, conversationId, messageId) {
  const rc = store._ensureConversationMessages(conversationId)
  const target = normalizeLookupId(messageId)
  if (!rc || !target) return null
  const list = rc.messages || []
  for (let i = list.length - 1; i >= 0; i--) {
    if (normalizeMessageLookupKeys(list[i]).includes(target)) {
      return { index: i, message: list[i] }
    }
  }
  return null
}

export function replaceWithContext(store, conversationId, ctxMessages, meta = {}) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc) return
  const formatted = (Array.isArray(ctxMessages) ? ctxMessages : []).map((msg) => formatRoomMessage(msg))
  const mergedTimeline = mergeInviteSystemMessages(sortMessages(formatted))
  rc.messages = mergedTimeline
  rc.initialHistoryFetched = true
  rc.isContextWindow = true
  rc.anchorMessageId = normalizeEventId(meta.targetMessageId)
  rc.quoteAnchorMessageId = normalizeEventId(meta.targetMessageId)
  rc.mentionAnchorMessageId = null
  rc.hasMoreForward = !meta.afterReachedEnd
  rc.droppedBefore = false
  rc.droppedAfter = false
  setWindowBounds(rc)
}

export function hasMoreForward(store, conversationId) {
  return !!store.conversationMessages?.[conversationId]?.hasMoreForward
}

export async function paginateForward(store, conversationId, pageLimit = IM_MESSAGE_PAGE_SIZE) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!conversationId || !rc || rc.loadingMoreForward || !rc.hasMoreForward) {
    return { added: 0, hasMore: !!rc?.hasMoreForward }
  }
  const newestSeq = rc.newestSeq ?? pickNewestSeq(rc.messages)
  if (!Number.isFinite(newestSeq)) return { added: 0, hasMore: false }

  rc.loadingMoreForward = true
  try {
    const events = await client.getConversationEvents(conversationId, {
      event_type: 'message.created',
      after_seq: newestSeq,
      limit: pageLimit,
    })
    const formatted = Array.isArray(events)
      ? events.flatMap((event) => client._convertConversationEvent
        ? client._convertConversationEvent(event, conversationId).map((msg) => formatRoomMessage(msg))
        : [formatRoomMessage(event)])
      : []
    const before = rc.messages.length
    rc.messages = mergeForwardPage(rc.messages, formatted)
    setWindowBounds(rc)
    rc.hasMoreForward = formatted.length >= pageLimit
    return { added: rc.messages.length - before, hasMore: rc.hasMoreForward }
  } finally {
    rc.loadingMoreForward = false
  }
}

export async function reloadLatest(store, conversationId, logPrefix) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!conversationId || !rc || rc.loadingHistory) return

  rc.loadingHistory = true
  try {
    const events = await client.getConversationEvents(conversationId, {
      event_type: 'message.created',
      limit: IM_MESSAGE_PAGE_SIZE,
    })
    const historyMessages = Array.isArray(events)
      ? events.flatMap((event) => client._convertConversationEvent
        ? client._convertConversationEvent(event, conversationId)
        : [event])
      : []
    const formattedMessages = historyMessages.map((msg) => formatRoomMessage(msg))
    rc.messages = mergeInviteSystemMessages(sortMessages(formattedMessages))
    rc.initialHistoryFetched = true
    rc.isContextWindow = false
    rc.anchorMessageId = null
    rc.quoteAnchorMessageId = null
    rc.mentionAnchorMessageId = null
    rc.hasMoreForward = false
    rc.droppedBefore = false
    rc.droppedAfter = false
    setWindowBounds(rc)
  } catch (error) {
    console.error(`${logPrefix} reloadLatest 失败:`, error)
    throw error
  } finally {
    rc.loadingHistory = false
  }
}

/**
 * 引用/@跳转定位：调 getMessageContext 拉取目标消息前后各若干条，
 * 填充 rc.messages 并置为 windowMode，UI 层滚到目标消息即可。
 */
export async function enterQuoteJumpMode(store, conversationId, messageId) {
  const rc = store._ensureConversationMessages(conversationId)
  if (!rc || !messageId) return { found: false }
  if (!client.isConnected()) return { found: false }

  try {
    const { messages: contextMessages, targetMessageId } =
      await client.getMessageContextConverted(conversationId, messageId, { before_limit: 20, after_limit: 20 })
    if (!contextMessages || contextMessages.length === 0 || !targetMessageId) {
      return { found: false }
    }

    const formatted = contextMessages.map((msg) => formatRoomMessage(msg))
    const mergedTimeline = mergeInviteSystemMessages(formatted)

    rc.messages = mergedTimeline
    rc.windowMode = true
    rc.quoteAnchorMessageId = targetMessageId
    rc.mentionAnchorMessageId = null
    rc.initialHistoryFetched = true
    return { found: true, targetMessageId }
  } catch (e) {
    console.error('[roomHistoryStrategy] enterQuoteJumpMode 失败:', e)
    return { found: false }
  }
}
