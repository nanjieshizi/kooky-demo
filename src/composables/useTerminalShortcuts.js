/**
 * KC 终端快捷键处理
 * 支持分屏管理和标签页管理
 * 参考 iTerm 设计，快捷键在终端内也可触发
 */
import { onMounted, onBeforeUnmount } from 'vue'

export function useTerminalShortcuts(handlers) {
  const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')

  function handleKeydown(e) {
    if (typeof handlers.isActive === 'function' && !handlers.isActive()) return

    const modKey = isMac ? e.metaKey : e.ctrlKey
    const shift = e.shiftKey
    const alt = e.altKey

    // 只处理带修饰键的快捷键
    if (!modKey && !alt) return

    let handled = false

    // ========== 分屏管理 ==========
    // 垂直分屏（左右）：Cmd/Ctrl + D
    if (modKey && !shift && !alt && (e.key === 'd' || e.key === 'D')) {
      console.log('[快捷键] 触发垂直分屏 (左右)')
      handlers.splitVertical?.()
      handled = true
    }

    // 水平分屏（上下）：Cmd/Ctrl + Shift + D
    else if (modKey && shift && !alt && (e.key === 'd' || e.key === 'D')) {
      console.log('[快捷键] 触发水平分屏 (上下)', { shift, key: e.key })
      handlers.splitHorizontal?.()
      handled = true
    }

    // 切换到下一个 pane：Cmd/Ctrl + ]
    else if (modKey && !shift && !alt && e.key === ']') {
      handlers.nextPane?.()
      handled = true
    }

    // 切换到上一个 pane：Cmd/Ctrl + [
    else if (modKey && !shift && !alt && e.key === '[') {
      handlers.prevPane?.()
      handled = true
    }

    // 方向切换 pane：Cmd/Ctrl + Option/Alt + 方向键
    else if (modKey && alt && !shift && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const direction = e.key.replace('Arrow', '').toLowerCase()
      handlers.switchPaneByDirection?.(direction)
      handled = true
    }

    // 关闭当前 pane：Cmd/Ctrl + W
    else if (modKey && !shift && !alt && e.key === 'w') {
      handlers.closePane?.()
      handled = true
    }

    // ========== 标签页管理 ==========
    // 新建标签页：Cmd/Ctrl + T
    else if (modKey && !shift && !alt && e.key === 't') {
      handlers.newTab?.()
      handled = true
    }

    // 切换到下一个标签页：Cmd/Ctrl + Shift + ] 或 Ctrl + Tab
    else if ((modKey && shift && (e.key === '}' || e.key === ']')) || (e.ctrlKey && !shift && e.key === 'Tab' && !isMac)) {
      handlers.nextTab?.()
      handled = true
    }

    // 切换到上一个标签页：Cmd/Ctrl + Shift + [ 或 Ctrl + Shift + Tab
    else if ((modKey && shift && (e.key === '{' || e.key === '[')) || (e.ctrlKey && shift && e.key === 'Tab' && !isMac)) {
      handlers.prevTab?.()
      handled = true
    }

    // 跳转到指定标签页：Cmd/Ctrl + 1~9
    else if (modKey && !shift && !alt && /^[1-9]$/.test(e.key)) {
      handlers.jumpToTab?.(parseInt(e.key) - 1)
      handled = true
    }

    // 移动标签页位置：Cmd/Ctrl + Shift + ←/→ 或 Ctrl + Shift + PageUp/PageDown
    else if (modKey && shift && !alt) {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlers.moveTabPosition?.('left')
        handled = true
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handlers.moveTabPosition?.('right')
        handled = true
      }
    }

    // ========== 搜索功能 ==========
    // 打开搜索：Cmd/Ctrl + F
    else if (modKey && !shift && !alt && e.key === 'f') {
      handlers.openSearch?.()
      handled = true
    }

    // ========== 终端字号管理 ==========
    // 放大字号：Cmd/Ctrl + +
    else if (modKey && !alt && (e.key === '=' || e.key === '+')) {
      handlers.increaseFontSize?.()
      handled = true
    }

    // 缩小字号：Cmd/Ctrl + -
    else if (modKey && !alt && (e.key === '-' || e.key === '_')) {
      handlers.decreaseFontSize?.()
      handled = true
    }

    // 重置字号：Cmd/Ctrl + 0
    else if (modKey && !shift && !alt && e.key === '0') {
      handlers.resetFontSize?.()
      handled = true
    }

    // ========== 换肤 ==========
    // 换肤：Cmd/Ctrl + I
    else if (modKey && !shift && !alt && (e.key === 'i' || e.key === 'I')) {
      handlers.cycleTheme?.()
      handled = true
    }

    // ========== 快捷键面板 ==========
    // 打开快捷键面板：Cmd/Ctrl + /
    else if (modKey && !shift && !alt && (e.key === '/' || e.key === '?')) {
      handlers.toggleShortcutPanel?.()
      handled = true
    }

    // 如果快捷键被处理，阻止默认行为和事件传播
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  onMounted(() => {
    // 使用捕获阶段，确保在 xterm.js 之前拦截
    document.addEventListener('keydown', handleKeydown, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown, true)
  })
}
