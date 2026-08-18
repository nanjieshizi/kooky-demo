export const STATUS_META = {
  draft: {
    key: 'draft',
    text: '草稿',
    color: '#606572',
    background: '#ECEEF3',
    icon: 'wait',
  },
  completed: {
    key: 'completed',
    text: '已完成',
    color: '#07C160',
    background: '#E8F6EB',
    icon: 'success',
  },
  in_progress: {
    key: 'in_progress',
    text: '进行中',
    color: '#3490F9',
    background: '#F0F6FF',
    icon: 'catching',
  },
  pending: {
    key: 'pending',
    text: '待处理',
    color: '#606572',
    background: '#ECEEF3',
    icon: 'wait',
  },
  skipped: {
    key: 'skipped',
    text: '已跳过',
    color: '#91949E',
    background: '#ECEEF3',
    icon: 'skip',
  },
  expired: {
    key: 'expired',
    text: '已过期',
    color: '#ED4543',
    background: '#FFF0F0',
    icon: 'overdue',
  },
  cancelled: {
    key: 'cancelled',
    text: '已取消',
    color: '#606572',
    background: '#ECEEF3',
    icon: 'cancel',
  },
  terminated: {
    key: 'terminated',
    text: '已终止',
    color: '#91949E',
    background: '#ECEEF3',
    icon: 'terminate',
  },
  archived: {
    key: 'archived',
    text: '已归档',
    color: '#6072AA',
    background: '#EEF0F8',
    icon: 'terminate',
  },
  approaching: {
    key: 'approaching',
    text: '即将到期',
    color: '#F5B400',
    background: '#FFF8E5',
    icon: 'wait',
  },
  overdue: {
    key: 'overdue',
    text: '已逾期',
    color: '#ED4543',
    background: '#FFF0F0',
    icon: 'overdue',
  },
}

export function getStatusMeta(status) {
  const key = String(status || '').trim()
  return STATUS_META[key] || {
    key,
    text: key || '未知',
    color: '#606572',
    background: '#ECEEF3',
    icon: 'wait',
  }
}

export function getNodeStatusMeta(node) {
  const status = String(node?.nodeStatus || '').trim()
  if (status === 'in_progress') {
    const deadlineStatus = String(node?.deadlineStatus || '').trim()
    if (deadlineStatus === 'approaching') return STATUS_META.approaching
    if (deadlineStatus === 'overdue') return STATUS_META.overdue
  }
  return getStatusMeta(status)
}

export function sortFlowNodes(nodes = []) {
  return [...(Array.isArray(nodes) ? nodes : [])].sort((a, b) => {
    const left = Number.isFinite(Number(a?.nodeOrder)) ? Number(a.nodeOrder) : 0
    const right = Number.isFinite(Number(b?.nodeOrder)) ? Number(b.nodeOrder) : 0
    return left - right
  })
}

export function isParallelNode(node) {
  return node?.nodeType === 'parallel_node'
    || (Array.isArray(node?.subNodes) && node.subNodes.length > 0)
}

export function isCompletedLikeStatus(status) {
  return ['completed', 'skipped', 'cancelled'].includes(String(status || ''))
}

export function shouldDefaultExpandParallelNode(node) {
  if (!node) return false
  if ((node.subNodes || []).some((child) => child?.nodeStatus === 'expired' || child?.deadlineStatus === 'overdue' || child?.deadlineStatus === 'approaching')) {
    return true
  }
  return !isCompletedLikeStatus(node.nodeStatus)
}
