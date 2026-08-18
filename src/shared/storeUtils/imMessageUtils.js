/**
 * im store 消息合并辅助函数（纯函数，无 store 依赖）
 */

/** 列表 :key 专用；合并 eventId 后仍不变，避免 Vue 整项重挂载闪烁 */
export function newClientMessageKey() {
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 群聊等：发送者 ID 的 localpart 以 `bot_` 开头视为机器人
 * @param {string} [senderId] 如 `@bot_xxx:domain` 或裸 localpart
 */
export function isSenderIdBotPrefixed(senderId) {
  if (senderId == null || senderId === '') return false
  const s = String(senderId).trim()
  let local = s
  if (s.startsWith('@')) {
    const colon = s.indexOf(':')
    local = colon > 1 ? s.slice(1, colon) : s.slice(1)
  }
  return local.toLowerCase().startsWith('bot_')
}

/**
 * 判断消息发送者是否为当前登录用户（portal userId 与 sender_name 对齐）
 * @param {{ senderName?: string, senderId?: string }} sender
 * @param {{ portalUserId?: string }} identity
 * @returns {boolean}
 */
export function isSelfMessageSender(sender, identity) {
  const name = String(sender?.senderName ?? '').trim()
  const portal = String(identity?.portalUserId ?? '').trim()
  if (name && portal && name === portal) return true
  return false
}

export function emptyRoomChat() {
  return {
    messages: [],
    loadingHistory: false,
    loadingMoreHistory: false,
    isContextWindow: false,
    anchorMessageId: null,
    hasMoreForward: false,
    loadingMoreForward: false,
    oldestSeq: null,
    newestSeq: null,
    droppedBefore: false,
    droppedAfter: false,
    sendingMessage: false,
    initialHistoryFetched: false,
    _activeStream: null,
    /** 当前房间内「正在输入」的成员 ID（不含自己） */
    remoteTypingUserIds: [],
    unreadCount: 0,
    hasUnreadDot: false,
    hasMentionDot: false,
    lastReadEventId: null,
    inviteBannerShown: false,
    /** 是否处于 TimelineWindow 窗口模式（@提及 定位时） */
    windowMode: false,
    /** 当前 @提及锚点 messageId（窗口模式下有效） */
    mentionAnchorMessageId: null,
    /** 当前普通未读锚点 messageId（窗口模式下有效） */
    unreadAnchorMessageId: null,
    /** 引用跳转锚点 messageId（窗口模式下有效） */
    quoteAnchorMessageId: null,
    /** 读标之后 @我 未读明细 */
    unreadMentionItems: [],
    unreadMentionDetailsUpdatedAt: 0,
  }
}

export const emptyConversationChat = emptyRoomChat
