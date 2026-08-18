/**
 * 从 Matrix live timeline 事件中查找读标之后第一条非本人房间消息。
 * @param {Array<object>} events
 * @param {string | null} lastReadEventId
 * @param {string} myUserId
 * @returns {string | null}
 */
export function findFirstUnreadMessageEventIdFromEvents(events = [], lastReadEventId = null, myUserId = '') {
  const myLower = String(myUserId || '').toLowerCase()
  let pastReadMarker = !lastReadEventId

  for (const ev of events) {
    const eventId = ev?.getId?.()
    if (!pastReadMarker) {
      if (eventId === lastReadEventId) pastReadMarker = true
      continue
    }

    if (ev?.getType?.() !== 'm.room.message') continue
    if (myLower && String(ev?.getSender?.() || '').toLowerCase() === myLower) continue
    if (eventId) return eventId
  }

  return null
}
