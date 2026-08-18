/**
 * 与 AvatarDetailView 版本历史 `versionItemStatusMeta` 文案/档位一致，用于「我的上传」列表卡片状态标签
 */
export type ListCardStatusMod =
  | 'unpublished'
  | 'published'
  | 'reviewing'
  | 'rejected'
  | 'default'

export interface StatusMetaItem {
  text: string
  mod: ListCardStatusMod
  /** 状态颜色（文字颜色） */
  color?: string
  /** 状态背景颜色 */
  bgColor?: string
  /** 驳回原因（仅 mod === 'rejected' 时有值） */
  rejection?: string
}

export function getListCardStatusMeta(item: {
  status?: string
  reviewStatus?: string
  /** 状态标签（中文） */
  statusLabel?: string
  /** 状态颜色 */
  statusColor?: string
  /** 状态背景颜色 */
  statusBgColor?: string
  /** 驳回原因 */
  rejection?: string
}): StatusMetaItem {
  // 优先使用接口返回的动态值
  if (item.statusLabel) {
    // 根据接口返回的状态标签确定 mod
    let mod: ListCardStatusMod = 'default'
    if (item.statusLabel.includes('未通过') || item.statusLabel.includes('拒绝')) {
      mod = 'rejected'
    } else if (item.statusLabel.includes('发布') && !item.statusLabel.includes('未发布')) {
      mod = 'published'
    } else if (item.statusLabel.includes('未发布') || item.statusLabel.includes('草稿')) {
      mod = 'unpublished'
    } else if (item.statusLabel.includes('审核')) {
      mod = 'reviewing'
    }
    return {
      text: item.statusLabel,
      mod,
      color: item.statusColor,
      bgColor: item.statusBgColor,
      rejection: mod === 'rejected' ? item.rejection : undefined,
    }
  }

  // 回退到原有逻辑
  if (item.reviewStatus === 'rejected') {
    return { text: '审核未通过', mod: 'rejected', rejection: item.rejection }
  }
  if (item.status === 'active') {
    return { text: '已发布', mod: 'published' }
  }
  if (item.status === 'draft' && (item.reviewStatus === undefined || item.reviewStatus === 'draft')) {
    return { text: '未发布', mod: 'unpublished' }
  }
  if (item.reviewStatus === 'reviewing') {
    return { text: '审核中', mod: 'reviewing' }
  }
  if (item.reviewStatus === 'published') {
    return { text: '已发布', mod: 'published' }
  }
  if (item.reviewStatus === 'draft') {
    return { text: '未发布', mod: 'unpublished' }
  }
  if (item.status === 'published') {
    return { text: '已发布', mod: 'published' }
  }
  if (item.status === 'draft') {
    return { text: '未发布', mod: 'unpublished' }
  }
  return { text: String(item.status ?? '—'), mod: 'default' }
}
