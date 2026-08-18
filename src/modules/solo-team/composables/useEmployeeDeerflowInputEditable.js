import { ref, nextTick } from 'vue'

export function useEmployeeDeerflowInputEditable(textareaRef, options = {}) {
  const { maxHeight = 120, onPasteFiles } = options
  const inputText = ref('')
  const isComposing = ref(false)

  function onEditableInput(e) {
    inputText.value = e.target.innerText || ''
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }

  function onCompositionStart() {
    isComposing.value = true
  }

  function onCompositionEnd(e) {
    isComposing.value = false
    inputText.value = e.target.innerText || ''
  }

  function handlePaste(e) {
    const files = Array.from(e.clipboardData?.files || [])
    if (files.length > 0) {
      e.preventDefault()
      onPasteFiles?.(files)
      return
    }
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
