/**
 * 员工会话消息展示用：从 deerflow-chat/utils/messageUtils 复制的最小子集（仅 splitInlineReasoning）。
 */
const THINK_TAG_RE = /<think>\s*([\s\S]*?)\s*<\/think>/g

export function splitInlineReasoning(content) {
  const reasoningParts = []
  const cleaned = (content || '')
    .replace(THINK_TAG_RE, (_, reasoning) => {
      const normalized = reasoning.trim()
      if (normalized) reasoningParts.push(normalized)
      return ''
    })
    .trim()
  return {
    content: cleaned,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n\n') : null,
  }
}
