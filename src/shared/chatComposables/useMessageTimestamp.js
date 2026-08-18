/**
 * 消息时间格式化工具 composable
 * 供 MessageList 和 GroupMessageList 共用
 */

/**
 * 将消息时间戳解析为毫秒数（兼容 number / 数字字符串 / ISO 字符串）
 */
export function messageTimestampMs(m) {
  const v = m?.timestamp
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
    const parsed = Date.parse(v)
    if (!Number.isNaN(parsed)) return parsed
  }
  return NaN
}

/**
 * 格式化消息时间戳为可读字符串
 * - 今天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 今年：M月D日 HH:mm
 * - 更早：YYYY年M月D日 HH:mm
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  const diffDays = Math.round((today.getTime() - msgDate.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) {
    return timeStr
  }

  if (diffDays === 1) {
    return `昨天 ${timeStr}`
  }

  if (diffDays === 2) {
    return `前天 ${timeStr}`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
}

/**
 * 判断当前消息与上一条是否在同一自然分钟（本地时区），
 * 用于缩小连续发送时的纵向间距
 */
export function sameCalendarMinuteAsPrevious(msgs, index) {
  if (index <= 0 || !Array.isArray(msgs)) return false
  const t1 = messageTimestampMs(msgs[index - 1])
  const t2 = messageTimestampMs(msgs[index])
  if (Number.isNaN(t1) || Number.isNaN(t2)) return false
  const d1 = new Date(t1)
  const d2 = new Date(t2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate() &&
    d1.getHours() === d2.getHours() &&
    d1.getMinutes() === d2.getMinutes()
  )
}

/**
 * 群聊系统通知（创建群 / 邀请）时间条文案：精确到分
 * - 当天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 前天：前天 HH:mm
 * - 更早（同年）：M月D日 HH:mm
 * - 跨年：YYYY年M月D日 HH:mm
 * @param {number} timestampMs
 * @returns {string}
 */
export function formatGroupSystemTimeLabel(timestampMs) {
  const t = typeof timestampMs === 'number' ? timestampMs : Number(timestampMs)
  if (!t || Number.isNaN(t)) return ''
  const date = new Date(t)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((todayStart - msgDayStart) / (24 * 60 * 60 * 1000))

  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (diffDays < 0) {
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hm}`
  }
  if (diffDays === 0) return hm
  if (diffDays === 1) return `昨天 ${hm}`
  if (diffDays === 2) return `前天 ${hm}`

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hm}`
}
