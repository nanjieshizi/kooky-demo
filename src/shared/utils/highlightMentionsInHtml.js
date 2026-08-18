/**
 * 将 HTML 中的 @提及 包装为 .mention-tag（与群聊用户气泡样式一致）。
 * 支持 ASCII @ 与全角 ＠（U+FF20，中文输入法常见）。
 * 第一分支跳过标签，避免破坏属性里的 @。
 */
const MENTION_IN_HTML =
  /(<[^>]*>)|(?:@|\uff20)([\w\u4e00-\u9fa5\u3400-\u4dbf·]+)/g

/**
 * @param {string} html
 * @returns {string}
 */
export function highlightMentionsInHtml(html) {
  return String(html || '').replace(MENTION_IN_HTML, (match, tag, name) => {
    if (tag) return tag
    return `<span class="mention-tag"><span class="mention-at">@</span>${name}</span>`
  })
}
