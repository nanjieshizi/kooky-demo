/** 从 mentions 条目解析展示名（与正文 @ 后文本对齐） */
function resolveMentionDisplayName(item) {
  if (item == null || typeof item !== 'object') return ''
  return String(
    item.name ?? item.username ?? item.user_name ?? item.display_name ?? '',
  ).trim()
}

/**
 * 基于 mentions 数据精确高亮 @提及
 * 支持两种调用方式：
 *   1. mentions 为服务端对象数组 [{ id, name, username, participant_id, user_name }] — 用展示名匹配正文
 *   2. mentions 为纯 ID 数组 + memberProfileMap — 通过 map 查找 displayName（兼容旧调用）
 *
 * @param {string} html - 已渲染的 HTML 内容
 * @param {Array} mentions - mentions 对象数组或纯 ID 数组
 * @param {Object|string} memberProfileMapOrCurrentUserId - memberProfileMap（旧）或 currentUserId（新）
 * @param {string} [currentUserId] - 当前用户 ID
 * @returns {string} 高亮后的 HTML
 */
export function highlightMentionsFromIds(
  html,
  mentions = [],
  memberProfileMapOrCurrentUserId = '',
  currentUserId = ''
) {
  if (!html || !Array.isArray(mentions) || mentions.length === 0) {
    return html
  }

  const isObjectArray = mentions.length > 0 && typeof mentions[0] === 'object' && mentions[0] !== null
  let resolvedCurrentUserId = currentUserId
  let memberProfileMap = {}

  if (typeof memberProfileMapOrCurrentUserId === 'string') {
    resolvedCurrentUserId = memberProfileMapOrCurrentUserId
  } else if (memberProfileMapOrCurrentUserId && typeof memberProfileMapOrCurrentUserId === 'object') {
    memberProfileMap = memberProfileMapOrCurrentUserId
  }

  const names = []

  if (isObjectArray) {
    for (const m of mentions) {
      const name = resolveMentionDisplayName(m)
      if (name) names.push(name)
    }
  } else {
    for (const userId of mentions) {
      const uid = String(userId).toLowerCase()
      const isMe = resolvedCurrentUserId && uid === String(resolvedCurrentUserId).toLowerCase()
      const displayName = isMe
        ? (memberProfileMap[userId]?.displayName || '我')
        : memberProfileMap[userId]?.displayName
      if (displayName) names.push(displayName)
    }
  }

  if (names.length === 0) return html

  // 长名优先，避免「代码」误匹配「@代码助手」中的前缀
  const uniqueNames = [...new Set(names)].sort((a, b) => b.length - a.length)
  const namesPattern = uniqueNames.map((n) => escapeRegExp(n)).join('|')
  const mentionRegex = new RegExp(
    `(<[^>]*>)|(?:@|＠)(${namesPattern})(?=\\s|$|[^\\w\u4e00-\u9fa5\u3400-\u4dbf·])`,
    'g',
  )

  return html.replace(mentionRegex, (match, tag, name) => {
    if (tag) return tag
    return `<span class="mention-tag"><span class="mention-at">@</span>${name}</span>`
  })
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
