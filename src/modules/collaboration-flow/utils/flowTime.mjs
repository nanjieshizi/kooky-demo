function pad(value) {
  return String(value).padStart(2, '0')
}

function parseDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDuration(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatFlowDateTime(value) {
  const date = parseDate(value)
  if (!date) return ''
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':')
}

export function getNodeTimeDisplay(node, nowValue = new Date()) {
  const status = String(node?.nodeStatus || '')
  const deadlineStatus = String(node?.deadlineStatus || '')
  const now = parseDate(nowValue) || new Date()

  if (status === 'completed' && node?.completedAt) {
    return { label: '完成时间', text: formatFlowDateTime(node.completedAt), tone: 'muted', dynamic: false }
  }

  if (status === 'skipped' && node?.skippedAt) {
    return { label: '跳过时间', text: formatFlowDateTime(node.skippedAt), tone: 'muted', dynamic: false }
  }

  if (status === 'cancelled' && node?.updatedAt) {
    return { label: '操作时间', text: formatFlowDateTime(node.updatedAt), tone: 'muted', dynamic: false }
  }

  const deadline = parseDate(node?.deadline)
  if (deadline) {
    const diff = deadline.getTime() - now.getTime()
    if (diff < 0 || status === 'expired' || deadlineStatus === 'overdue') {
      return { label: '已超时', text: formatDuration(Math.abs(diff)), tone: 'danger', dynamic: true }
    }
    const tone = status === 'in_progress' && deadlineStatus === 'approaching' ? 'warning' : 'muted'
    return { label: '截止剩余', text: formatDuration(diff), tone, dynamic: true }
  }

  const activatedAt = parseDate(node?.activatedAt) || parseDate(node?.createdAt)
  if (activatedAt && status === 'in_progress') {
    return {
      label: '已等待',
      text: formatDuration(now.getTime() - activatedAt.getTime()),
      tone: 'warning',
      dynamic: true,
    }
  }

  return { label: '', text: '', tone: 'muted', dynamic: false }
}
