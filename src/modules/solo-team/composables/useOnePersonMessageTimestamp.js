export function messageTimestampMs(m) {
  const direct = parseTimestamp(m?.timestamp)
  if (Number.isFinite(direct)) return direct

  const createdAt = m?.additional_kwargs?.created_at
    ?? m?.additionalKwargs?.createdAt
    ?? m?.raw?.additional_kwargs?.created_at
    ?? m?.raw?.additionalKwargs?.createdAt
    ?? m?.raw?.created_at
    ?? m?.raw?.createdAt
    ?? m?.createdAt
  return parseTimestamp(createdAt)
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatRelativeTime(input) {
  const ts = parseTimestamp(input)
  if (!Number.isFinite(ts)) return ''

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
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function getDateSeparator(msgs, index) {
  if (index < 0 || !Array.isArray(msgs)) return null
  const current = messageTimestampMs(msgs[index])
  if (!Number.isFinite(current)) return null
  if (index === 0) return formatDateLabel(current)

  const previous = messageTimestampMs(msgs[index - 1])
  if (!Number.isFinite(previous)) return formatDateLabel(current)

  const d1 = new Date(previous)
  const d2 = new Date(current)
  if (
    d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate()
  ) {
    return null
  }
  return formatDateLabel(current)
}

function parseTimestamp(value) {
  if (value == null || value === '') return NaN
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return NaN
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - msgDate.getTime()) / 86400000)

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
