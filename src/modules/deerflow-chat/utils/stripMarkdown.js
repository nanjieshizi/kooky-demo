/**
 * 去除 markdown 符号，返回纯文本
 * 用于引用块等需要显示简洁文本的场景
 * @param {string} markdown - markdown 文本
 * @returns {string} 纯文本
 */
export function stripMarkdown(markdown) {
  if (!markdown) return ''

  let text = markdown

  // 去除代码块
  text = text.replace(/```[\s\S]*?```/g, '[代码块]')
  text = text.replace(/`([^`]+)`/g, '$1')

  // 去除标题符号
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 去除粗体和斜体
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/\*(.+?)\*/g, '$1')
  text = text.replace(/___(.+?)___/g, '$1')
  text = text.replace(/__(.+?)__/g, '$1')
  text = text.replace(/_(.+?)_/g, '$1')

  // 去除链接，保留文本
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 去除图片
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[图片]')

  // 去除引用符号
  text = text.replace(/^>\s+/gm, '')

  // 去除无序列表符号，保留有序列表序号
  text = text.replace(/^[\*\-\+]\s+/gm, '')

  // 去除水平线
  text = text.replace(/^[\*\-_]{3,}$/gm, '')

  // 去除多余的空行
  text = text.replace(/\n{3,}/g, '\n\n')

  // 去除首尾空白
  text = text.trim()

  return text
}
