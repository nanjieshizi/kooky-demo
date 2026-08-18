import { escapeHtmlForEditable } from '@/shared/utils/contentEditableHighlight'

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @ 提及高亮逻辑（仅高亮已确认的成员名称）
 * @param {Object} options
 * @param {Function} options.getRoomMembers - 返回当前房间成员列表的函数
 * @param {Ref<string[]>} options.pendingMentionUserIds - 已确认的 @ 用户 ID 列表
 * @returns {{ formatMentionHighlightsHtml: Function }}
 */
export function useMentionHighlight({ getRoomMembers, pendingMentionUserIds }) {
  function formatMentionHighlightsHtml(plainText) {
    let escaped = escapeHtmlForEditable(plainText).replace(/\n/g, '<br>')

    // 构建已确认的成员显示名集合
    const confirmedNames = new Set()
    const roomMemberList = getRoomMembers()
    for (const uid of pendingMentionUserIds.value) {
      const member = roomMemberList.find(
        m => m?.userId && String(m.userId).toLowerCase() === String(uid).toLowerCase()
      )
      if (member) {
        const displayName = member.displayName || member.userId
        if (displayName) confirmedNames.add(displayName)
      }
    }

    // 仅高亮已确认的成员名称
    if (confirmedNames.size > 0) {
      const names = Array.from(confirmedNames).map(n => escapeRegExp(n)).join('|')
      const mentionRegex = new RegExp(
        `(^|[\\s\\u3000])@(${names})(?=\\s|$|[^\\w\\u4e00-\\u9fa5])`,
        'g'
      )
      escaped = escaped.replace(mentionRegex, (_, pre, name) => {
        return `${pre}<span class="chat-input-mention">@${name}</span>`
      })
    }

    return escaped.replace(URL_REGEX, '<span class="url-link">$1</span>')
  }

  return { formatMentionHighlightsHtml }
}
