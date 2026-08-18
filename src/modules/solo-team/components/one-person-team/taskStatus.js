export function isTaskClosed(status) {
  return ['completed', 'cancelled', 'failed'].includes(status)
}

export function taskStatusText(status) {
  const map = {
    active: '进行中',
    blocked: '已阻塞',
    waiting_approval: '待确认',
    completed: '已完成',
    cancelled: '已取消',
    failed: '失败',
  }
  return map[status] || '进行中'
}
