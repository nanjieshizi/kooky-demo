/**
 * 历史消息加载功能
 */

import { getConversationEvents } from '../services/group.js'

const _hasMoreByRoom = new Map()

function fetchMessages(conversationId, params) {
  const apiParams = {}
  if (params.limit !== undefined) apiParams.limit = params.limit
  if (params.before_seq !== undefined) apiParams.before_seq = params.before_seq
  return getConversationEvents(conversationId, apiParams)
}

function toTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

// 取最早 message.created 事件（用于 isFirstMessage 判定）
function pickEarliestMessageEvent(events) {
  let earliest = null
  let earliestTs = Number.POSITIVE_INFINITY
  for (const ev of events) {
    if (!ev) continue
    const t = ev.event_type ?? ev.type
    if (t !== 'message.created') continue
    const ts = toTimestampMs(ev.created_at)
    if (ts < earliestTs) {
      earliestTs = ts
      earliest = ev
    }
  }
  return earliest
}

function normalizeIsFirstResponse(response) {
  const value = response?.is_first ?? response?.isFirst ?? response?.data?.is_first ?? response?.data?.isFirst
  return value === true
}

async function updateHasMoreByEarliestMessage(client, conversationId, events, limit) {
  const roomKey = String(conversationId)
  if (!Array.isArray(events) || events.length === 0) {
    _hasMoreByRoom.set(roomKey, false)
    return false
  }

  const earliestEvent = pickEarliestMessageEvent(events)
  // 整页都是系统事件（极端情况）：无法用 isFirstMessage 判定，退回页大小判断
  if (!earliestEvent) {
    const fallbackHasMore = events.length >= limit
    _hasMoreByRoom.set(roomKey, fallbackHasMore)
    return fallbackHasMore
  }

  const earliestSeq = earliestEvent.seq ?? earliestEvent.event_json?.seq
  if (typeof earliestSeq !== 'number') {
    const fallbackHasMore = events.length >= limit
    _hasMoreByRoom.set(roomKey, fallbackHasMore)
    return fallbackHasMore
  }

  try {
    const result = await client.isFirstMessage(conversationId, earliestSeq)
    const hasMore = !normalizeIsFirstResponse(result)
    _hasMoreByRoom.set(roomKey, hasMore)
    return hasMore
  } catch (error) {
    console.warn('[HttpIMClient] 检查最早消息失败，回退到分页数量判断:', error)
    const fallbackHasMore = events.length >= limit
    _hasMoreByRoom.set(roomKey, fallbackHasMore)
    return fallbackHasMore
  }
}

/**
 * 获取房间消息
 */
export async function getRoomMessages(client, conversationId, limit = 20) {
  client._checkInitialized()

  try {
    const events = (await fetchMessages(conversationId, { limit })) || []
    await updateHasMoreByEarliestMessage(client, conversationId, events, limit)
    return {
      messages: events.flatMap(ev => client._convertConversationEvent(ev, conversationId)),
      mentionAnchorMessageId: null,
      windowMode: false,
    }
  } catch (error) {
    console.error('[HttpIMClient] 获取房间消息失败:', error)
    return { messages: [], mentionAnchorMessageId: null, windowMode: false }
  }
}

/**
 * 向后分页加载历史消息
 * @param {object} options
 * @param {string|number} [options.beforeId] 当前消息列表中最早一条的 event_id（兼容字段，HTTP IM 路径已不使用）
 * @param {number} [options.beforeSeq] 当前消息列表中最早一条的 seq（HTTP IM /events 接口分页游标）
 */
export async function paginateTimelineBackwards(client, conversationId, limit = 20, options = {}) {
  client._checkInitialized()
  const { beforeSeq } = options

  try {
    const params = { limit }
    if (beforeSeq !== undefined && beforeSeq !== null) {
      params.before_seq = beforeSeq
    }
    const events = (await fetchMessages(conversationId, params)) || []
    await updateHasMoreByEarliestMessage(client, conversationId, events, limit)
    return events.flatMap(ev => client._convertConversationEvent(ev, conversationId))
  } catch (error) {
    console.error('[HttpIMClient] 分页加载历史消息失败:', error)
    return []
  }
}

/**
 * 是否还能向更早分页：由当前最早消息的 is-first 接口结果缓存得出
 */
export function canPaginateBackwards(_client, conversationId) {
  const v = _hasMoreByRoom.get(String(conversationId))
  return v !== false
}

export function getAllTimelineMessages(_client, _conversationId) {
  return []
}
