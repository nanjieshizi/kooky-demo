import { ref, nextTick } from 'vue'

/**
 * contenteditable 输入框逻辑
 * @param {Ref} textareaRef - contenteditable 元素的 ref
 * @param {object} options
 * @param {number} options.maxHeight - 最大高度（px）
 * @param {function} options.onPasteFiles - 粘贴文件时的回调
 */
export function useDeerflowInputEditable(textareaRef, options = {}) {
  const { maxHeight = 120, onPasteFiles } = options

  const inputText = ref('')
  const isComposing = ref(false)

  function onEditableInput(e) {
    inputText.value = e.target.innerText || ''

    // 自动调整高度
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }

  function onCompositionStart() {
    isComposing.value = true
  }

  function onCompositionEnd(e) {
    isComposing.value = false
    inputText.value = e.target.innerText || ''
  }

  function handlePaste(e) {
    // 处理粘贴的文件
    const files = Array.from(e.clipboardData?.files || [])
    if (files.length > 0) {
      e.preventDefault()
      onPasteFiles?.(files)
      return
    }

    // 纯文本粘贴，去除富文本格式
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
  }

  function clearEditable() {
    inputText.value = ''
    nextTick(() => {
      const el = textareaRef.value
      if (!el) return
      el.innerText = ''
      el.style.height = 'auto'
    })
  }

  return {
    inputText,
    isComposing,
    onCompositionStart,
    onCompositionEnd,
    handlePaste,
    onEditableInput,
    clearEditable,
  }
}
