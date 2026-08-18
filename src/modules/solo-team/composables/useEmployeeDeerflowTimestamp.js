export function messageTimestampMs(m) {
  const v = m?.timestamp
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
    const parsed = Date.parse(v)
    if (!Number.isNaN(parsed)) return parsed
  }
  const createdAt = m?.additional_kwargs?.created_at ?? m?.raw?.additional_kwargs?.created_at
  if (typeof createdAt === 'number' && !Number.isNaN(createdAt)) {
    return createdAt < 1e12 ? createdAt * 1000 : createdAt
  }
  if (typeof createdAt === 'string' && createdAt.trim()) {
    const n = Number(createdAt)
    if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n
  }
  return NaN
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatRelativeTime(input) {
  if (input == null || input === '') return ''
  let ts = typeof input === 'number' ? input : Number(input)
  if (Number.isNaN(ts)) {
    const parsed = Date.parse(input)
    if (Number.isNaN(parsed)) return ''
    ts = parsed
  }
  if (ts < 1e12) ts = ts * 1000

  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  if (diffDays === 0) {
    const diffHour = Math.floor(diffMs / 3600000)
    return `${diffHour}小时前`
  }
  if (diffDays === 1) return `昨天 ${timeStr}`
  if (diffDays < 7) return `${WEEKDAYS[date.getDay()]} ${timeStr}`
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatMessageTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const diffDays = Math.round((today.getTime() - msgDate.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return timeStr
  if (diffDays === 1) return `昨天 ${timeStr}`
  if (diffDays === 2) return `前天 ${timeStr}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
}

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

export function getDateSeparator(msgs, index) {
  if (index < 0 || !Array.isArray(msgs)) return null
  const t = messageTimestampMs(msgs[index])
  if (Number.isNaN(t)) return null
  if (index === 0) return formatDateLabel(t)
  const prevT = messageTimestampMs(msgs[index - 1])
  if (Number.isNaN(prevT)) return formatDateLabel(t)
  const d1 = new Date(prevT)
  const d2 = new Date(t)
  if (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  ) {
    return null
  }
  return formatDateLabel(t)
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - msgDate.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
