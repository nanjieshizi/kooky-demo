/**
 * 群聊 @ 滚动定位：读取消息 content.mentions。
 */

/**
 * @param {object} m 应用层消息
 * @param {string} myUserId
 */
export function messageMentionsUser(m, myUserId) {
  const mentions = m?.content?.mentions
  if (!Array.isArray(mentions) || !mentions.length || !myUserId) return false
  const low = String(myUserId).toLowerCase()
  return mentions.some((item) => {
    const id = item?.participant_id ?? item?.id ?? item?.user_id ?? item
    return id && String(id).toLowerCase() === low
  })
}

/**
 * 优先「读标线 eventId 之后」第一条 @我（lastReadEventId 来自读回执，须为某条消息的 eventId）；
 * 若 lastReadEventId 为空/未命中则全列表时间序第一条 @我。
 * @param {Array<object>} msgs 已按时间排序
 * @param {string} myUserId
 * @param {string | null | undefined} lastReadEventId
 * @returns {object | undefined}
 */
export function findMentionMessageForScroll(msgs, myUserId, lastReadEventId) {
  if (!Array.isArray(msgs) || !myUserId) return undefined
  let startIdx = 0
  if (lastReadEventId) {
    const idx = msgs.findIndex((m) => m.eventId === lastReadEventId)
    if (idx !== -1) startIdx = idx + 1
  }
  const after = msgs.slice(startIdx).find((m) => messageMentionsUser(m, myUserId))
  if (after) return after
  return msgs.find((m) => messageMentionsUser(m, myUserId))
}
