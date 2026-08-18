export const PRIMARY_NAV_ITEMS = Object.freeze([
  // 「个人」= 我的分身 + 一人团队合并后的唯一入口（骨架沿用 solo-team）。
  // deerflow(我的分身) 独立入口已并入，其能力作为「分身中枢」融进团队群聊。
  { key: 'solo-team', label: '个人' },
  { key: 'collaboration', label: '协作' },
  // 其余模块暂不作为一级导航展示，相关路由与组件保留供内部跳转使用。
  // { key: 'community', label: '社区' },
])

export const COLLABORATION_NAV_KEYS = Object.freeze(['collaboration', 'collaboration-b'])

export function isCollaborationNavKey(primaryKey) {
  return COLLABORATION_NAV_KEYS.includes(primaryKey)
}

// 通讯录：我的数字员工（管理）+ 组织目录（真人 + 数字同事）
export const CONTACTS_NAV_ITEMS = Object.freeze([
  {
    key: 'contacts-employees',
    label: '我的员工',
    route: '/contacts/employees',
    icon: 'employee',
  },
  {
    key: 'contacts-org',
    label: '组织目录',
    route: '/contacts/org',
    icon: 'org',
  },
])

export const MARKET_NAV_ITEMS = Object.freeze([
  {
    key: 'market-group-header',
    label: '市场',
    type: 'group-header',
    icon: 'market',
  },
  {
    key: 'market-skill',
    label: 'Skill 市场',
    route: '/market/skill',
  },
  {
    key: 'market-avatar',
    label: '数字人市场',
    route: '/market/avatar',
  },
  {
    key: 'my-uploads-group-header',
    label: '我的资产',
    type: 'group-header',
    icon: 'my',
  },
  {
    key: 'my-uploads-skill',
    label: 'Skill',
    route: '/market/my-uploads?type=skill',
  },
  {
    key: 'my-uploads-avatar',
    label: '数字人',
    route: '/market/my-uploads?type=avatar',
  },
])

/**
 * 通讯录 B（演示版）：二级菜单只有「组织目录」一项，
 * 「我的员工」不是页面、而是**平铺在二级栏里的一组对象入口**（见 ContactsSubmenu），
 * 点某个员工 → 主区整页管理（/contacts-b/employee/:id）。
 */
export const CONTACTS_B_NAV_ITEMS = Object.freeze([
  {
    key: 'contacts-b-org',
    label: '组织目录',
    route: '/contacts-b/org',
    icon: 'org',
  },
])

/** B 版：某个员工被选中时的二级 key */
export function contactsBEmployeeNavKey(id) {
  return `contacts-b-employee:${id}`
}

export function hasSecondaryNav(primaryKey) {
  return ['solo-team', 'market', 'deerflow', 'contacts', 'contacts-b'].includes(primaryKey)
    || isCollaborationNavKey(primaryKey)
}

export function getSecondaryNavItems(
  primaryKey,
  secondaryItems = [],
  deerflowThreads = [],
  privateChats = [],
  digitalHumanAgents = [],
) {
  if (primaryKey === 'solo-team') return []
  if (primaryKey === 'market') return MARKET_NAV_ITEMS
  if (primaryKey === 'contacts') return CONTACTS_NAV_ITEMS
  if (primaryKey === 'contacts-b') return CONTACTS_B_NAV_ITEMS
  if (isCollaborationNavKey(primaryKey)) {
    return [
      // 群聊分组 header
      {
        key: 'group-chat-header',
        label: '团队群聊',
        type: 'category-header',
        categoryId: 'group',
      },
      // 群聊会话项
      ...secondaryItems.map((conversation) => ({
        key: conversation.conversationId,
        label: conversation.name || conversation.conversationId,
        conversationId: conversation.conversationId,
        type: 'group-conversation',
        categoryId: 'group',
      })),
      // 私聊分组 header
      {
        key: 'private-chat-header',
        label: '私聊',
        type: 'category-header',
        categoryId: 'private',
      },
      // 私聊会话项
      ...privateChats.map((chat) => ({
        key: `private-${chat.conversationId}`,
        label: chat.peerDisplayName || chat.peerUsername,
        avatarUrl: chat.peerAvatarUrl || '',
        account: chat.peerUsername || '',
        conversationId: chat.conversationId,
        type: 'private-chat',
        categoryId: 'private',
      })),
      // 数字人分组 header
      {
        key: 'digital-human-header',
        label: '企业数字人',
        type: 'category-header',
        categoryId: 'digitalHuman',
      },
      // 数字人（无状态 Agent）项
      ...digitalHumanAgents.map((agent) => ({
        key: `digital-human-${agent.agent_id}`,
        label: agent.agent_display_name || agent.agent_name || `Agent ${agent.agent_id}`,
        avatarUrl: agent.agent_avatar_url || '',
        agentId: agent.agent_id,
        type: 'digital-human-agent',
        categoryId: 'digitalHuman',
      })),
    ]
  }
  if (primaryKey === 'deerflow') {
    return deerflowThreads.map((thread) => ({
      key: thread.id,
      label: thread.title || 'New Chat',
      threadId: thread.id,
      type: 'deerflow-thread',
    }))
  }
  return []
}

export function getDefaultSecondaryKey(primaryKey, secondaryItems = [], deerflowThreads = [], privateChats = [], digitalHumanAgents = []) {
  if (primaryKey === 'solo-team') return null
  if (primaryKey === 'market') {
    const firstItem = MARKET_NAV_ITEMS.find((item) => item.type !== 'group-header')
    return firstItem?.key ?? null
  }
  if (primaryKey === 'contacts') return CONTACTS_NAV_ITEMS[0].key
  if (primaryKey === 'contacts-b') return CONTACTS_B_NAV_ITEMS[0].key
  if (isCollaborationNavKey(primaryKey)) {
    if (secondaryItems[0]?.conversationId) return secondaryItems[0].conversationId
    if (privateChats[0]?.conversationId) return `private-${privateChats[0].conversationId}`
    const firstAgentId = digitalHumanAgents[0]?.agent_id ?? digitalHumanAgents[0]?.agentId
    if (firstAgentId) return `digital-human-${firstAgentId}`
    return null
  }
  if (primaryKey === 'deerflow') return deerflowThreads[0]?.id ?? null

  return null
}

export function getSecondaryMeta(primaryKey, secondaryKey) {
  if (primaryKey === 'solo-team') return null
  if (primaryKey === 'market') {
    const found = MARKET_NAV_ITEMS.find((item) => item.key === secondaryKey && item.type !== 'group-header')
    return found ?? MARKET_NAV_ITEMS.find((item) => item.type !== 'group-header')
  }
  if (primaryKey === 'contacts') {
    return CONTACTS_NAV_ITEMS.find((item) => item.key === secondaryKey) ?? CONTACTS_NAV_ITEMS[0]
  }
  if (primaryKey === 'contacts-b') {
    return CONTACTS_B_NAV_ITEMS.find((item) => item.key === secondaryKey) ?? CONTACTS_B_NAV_ITEMS[0]
  }
  return null
}
