/**
 * contenteditable 高亮工具函数
 */

const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function escapeHtmlForEditable(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function formatUrlHighlightHtml(plainText) {
  return escapeHtmlForEditable(plainText)
    .replace(/\n/g, '<br>')
    .replace(URL_REGEX, '<span class="url-link">$1</span>')
}

export function formatMentionHighlightsHtml(plainText) {
  return escapeHtmlForEditable(plainText)
    .replace(/\n/g, '<br>')
    .replace(
      /(^|[\s\u3000])(@\S+)/g,
      (_, pre, at) => `${pre}<span class="chat-input-mention">${at}</span>`,
    )
    .replace(URL_REGEX, '<span class="url-link">$1</span>')
}

export function getEditableCaretOffset(el) {
  if (!el) return 0
  if (el instanceof HTMLTextAreaElement) return el.selectionStart ?? 0
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return (el.innerText || '').length
  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return (el.innerText || '').length
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

export function setEditableCaretOffset(el, offset) {
  if (!el) return
  if (el instanceof HTMLTextAreaElement) {
    const n = el.value.length
    const pos = Math.min(Math.max(0, offset), n)
    el.setSelectionRange(pos, pos)
    return
  }
  const text = el.innerText || ''
  const o = Math.min(Math.max(0, offset), text.length)
  el.focus()
  const range = document.createRange()
  let count = 0
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length
      if (count + len >= o) {
        range.setStart(node, o - count)
        range.collapse(true)
        return true
      }
      count += len
    } else {
      for (const c of node.childNodes) {
        if (walk(c)) return true
      }
    }
    return false
  }
  if (!walk(el)) {
    range.selectNodeContents(el)
    range.collapse(false)
  }
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}
