/**
 * useChatInputEditable
 * 封装 contenteditable div 的通用编辑器能力：
 *   - IME composition 状态（isComposing）
 *   - 粘贴处理（纯文本强制插入 + Feishu doc 检测）
 *   - auto-resize
 *   - inputText 同步
 *   - clearEditable 工具
 *
 * @param {import('vue').Ref} editableRef - ref(null)，指向 contenteditable el
 * @param {{ maxHeight?: number, onAfterInput?: () => void }} options
 *   maxHeight: auto-resize 上限（px），ChatInput 传 88，GroupChatInput 默认 108
 *   onAfterInput: 每次 input 事件后的额外回调（GroupChatInput 用于 mention 高亮 + picker 触发）
 */
import { ref } from 'vue'
import { useFeishuDocAuth } from '@/modules/auth/useFeishuDocAuth'

export function useChatInputEditable(editableRef, options = {}) {
  const { maxHeight = 108, onAfterInput = null, onPasteFiles = null } = options
  const { checkAndAuthFeishu } = useFeishuDocAuth()

  const inputText = ref('')
  const isComposing = ref(false)

  function readEditablePlainText(el) {
    if (!el) return ''
    const raw = el.innerText != null ? el.innerText : (el.textContent ?? '')
    return String(raw).replace(/\r\n/g, '\n')
  }

  function autoResize() {
    const el = editableRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    el.scrollTop = el.scrollHeight
  }

  function onEditableInput() {
    const el = editableRef.value
    if (!el) return
    inputText.value = readEditablePlainText(el)
    autoResize()
    onAfterInput?.()
  }

  function onCompositionStart() {
    isComposing.value = true
  }

  function onCompositionEnd() {
    isComposing.value = false
    onEditableInput()
  }

  function handlePaste(e) {
    const dt = e.clipboardData
    if (!dt) return

    // 检测文件（kind==='file' 且有文件名，排除截图 Blob）
    const filteredFiles = Array.from(dt.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(f => f && f.name)

    if (filteredFiles.length > 0) {
      e.preventDefault()
      onPasteFiles?.(filteredFiles)
      return
    }

    // 原有文本逻辑不变
    e.preventDefault()
    const plain = (dt.getData('text/plain') || dt.getData('text') || '').replace(/\r\n/g, '\n')
    checkAndAuthFeishu(plain)
    document.execCommand('insertText', false, plain)
  }

  function clearEditable() {
    const el = editableRef.value
    if (!el) return
    el.textContent = ''
    el.style.height = 'auto'
    inputText.value = ''
  }

  return {
    inputText,
    isComposing,
    onCompositionStart,
    onCompositionEnd,
    handlePaste,
    onEditableInput,
    readEditablePlainText,
    clearEditable,
  }
}
