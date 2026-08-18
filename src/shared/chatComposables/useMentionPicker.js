import { ref, watch, onUnmounted, nextTick } from 'vue'
import { getEditableCaretOffset, setEditableCaretOffset } from '@/shared/utils/contentEditableHighlight'

/**
 * @ 提及选择器逻辑
 * @param {Object} options
 * @param {Ref} options.textareaRef - 输入框 ref
 * @param {Ref} options.mentionPickerRef - 提及选择器 ref
 * @param {Ref} options.inputText - 输入文本
 * @param {Function} options.formatHighlightHtml - 格式化高亮 HTML 的函数
 */
export function useMentionPicker(options) {
  const { textareaRef, mentionPickerRef, inputText, formatHighlightHtml, onSelect, findActiveMention } = options

  const showMentionPicker = ref(false)
  const mentionQuery = ref('')
  const mentionActiveIndex = ref(0)

  function findDefaultMentionRange(text, cursor) {
    const before = text.slice(0, cursor)
    const match = before.match(/@([^@]*)$/)
    if (!match) return null
    return {
      start: cursor - match[0].length,
      end: cursor,
      query: match[1],
    }
  }

  function getActiveMentionRange(text, cursor) {
    const finder = typeof findActiveMention === 'function' ? findActiveMention : findDefaultMentionRange
    return finder(text, cursor)
  }

  function processMentionAfterInput() {
    const text = inputText.value
    const el = textareaRef.value
    const cursor = el ? getEditableCaretOffset(el) : text.length
    const range = getActiveMentionRange(text, cursor)
    if (range) {
      const q = range.query || ''
      mentionQuery.value = q
      const flat = mentionPickerRef.value?.getFlatList?.(q) ?? []
      const hasMembers = flat.length > 0
      if (hasMembers && !showMentionPicker.value) mentionActiveIndex.value = 0
      showMentionPicker.value = hasMembers
    } else {
      showMentionPicker.value = false
      mentionQuery.value = ''
    }
  }

  function selectMemberMention(member, pendingMentionUserIds) {
    const el = textareaRef.value
    const text = inputText.value
    const cursor = el ? getEditableCaretOffset(el) : text.length
    const range = getActiveMentionRange(text, cursor)
    if (!range) return
    const newBefore = `${text.slice(0, range.start)}@${member.displayName || member.userId} `
    const after = text.slice(range.end)
    const newText = newBefore + after
    inputText.value = newText

    if (pendingMentionUserIds && !pendingMentionUserIds.value.includes(member.userId)) {
      pendingMentionUserIds.value = [...pendingMentionUserIds.value, member.userId]
    }

    showMentionPicker.value = false
    mentionQuery.value = ''

    nextTick(() => {
      if (!el) return
      el.innerHTML = formatHighlightHtml(newText)
      setEditableCaretOffset(el, newBefore.length)
    })
  }

  function isInsideMentionPicker(target) {
    const root = mentionPickerRef.value?.$el
    return root && root.nodeType === Node.ELEMENT_NODE && root.contains(target)
  }

  function onDocumentMousedownCapture(e) {
    if (!showMentionPicker.value) return
    const t = e.target
    if (!t || !(t instanceof Node)) return
    if (textareaRef.value && (textareaRef.value === t || textareaRef.value.contains(t))) return
    if (isInsideMentionPicker(t)) return
    showMentionPicker.value = false
  }

  watch(showMentionPicker, (open) => {
    if (open) {
      document.addEventListener('mousedown', onDocumentMousedownCapture, true)
    } else {
      document.removeEventListener('mousedown', onDocumentMousedownCapture, true)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', onDocumentMousedownCapture, true)
  })

  function handleMentionKeydown(e) {
    const mentionFlat = showMentionPicker.value
      ? (mentionPickerRef.value?.getFlatList?.(mentionQuery.value) ?? [])
      : []

    if (!showMentionPicker.value || !mentionFlat.length) return false

    const len = mentionFlat.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionActiveIndex.value = (mentionActiveIndex.value + 1) % len
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionActiveIndex.value = (mentionActiveIndex.value - 1 + len) % len
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const member = mentionFlat[mentionActiveIndex.value]
      if (onSelect) {
        onSelect(member)
      } else {
        selectMemberMention(member)
      }
      return true
    }
    if (e.key === 'Escape') {
      showMentionPicker.value = false
      return true
    }
    return false
  }

  return {
    showMentionPicker,
    mentionQuery,
    mentionActiveIndex,
    processMentionAfterInput,
    selectMemberMention,
    handleMentionKeydown,
  }
}
