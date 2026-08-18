/** 列表卡标签：超过此字数显示省略，Tooltip 展示全文 */
const TAG_MAX_DISPLAY_LEN = 12

export function formatTagText(tag) {
  const s = String(tag ?? '')
  if (s.length <= TAG_MAX_DISPLAY_LEN) return s
  return `${s.slice(0, TAG_MAX_DISPLAY_LEN)}...`
}

export function isTagTruncated(tag) {
  return String(tag ?? '').length > TAG_MAX_DISPLAY_LEN
}

/** 「+n」浮层：展示从第二个标签起的全部标签名 */
export function formatExtraTagsTooltip(tags) {
  const t = Array.isArray(tags) ? tags : []
  if (t.length <= 1) return ''
  return t.slice(1).join('、')
}
