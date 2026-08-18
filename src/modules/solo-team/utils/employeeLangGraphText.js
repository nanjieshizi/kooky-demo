/**
 * LangGraph 消息文本/推理提取（solo-team 内自包含副本，不引用 deerflow-chat）
 */

const THINK_TAG_RE = /<think>\s*([\s\S]*?)\s*<\/redacted_thinking>/g

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

function splitInlineReasoningFromAIMessage(message) {
  if (message.type !== 'ai') return null
  if (typeof message.content !== 'string') return null
  const { content, reasoning } = splitInlineReasoning(message.content)
  if (!reasoning) return null
  return { content, reasoning }
}

export function extractReasoningContentFromMessage(message) {
  if (message.type !== 'ai') return null
  const kw = message.additional_kwargs?.reasoning_content
  if (typeof kw === 'string' && kw.trim()) return kw.trim()
  if (Array.isArray(message.content)) {
    const parts = []
    for (const part of message.content) {
      if (part?.type === 'thinking' && typeof part.thinking === 'string') {
        parts.push(part.thinking.trim())
      } else if (part?.type === 'thinking' && typeof part.text === 'string') {
        parts.push(part.text.trim())
      }
    }
    if (parts.length > 0) return parts.join('\n\n')
  }
  if (typeof message.content === 'string') {
    const { reasoning } = splitInlineReasoning(message.content)
    if (reasoning) return reasoning
  }
  return null
}

export function extractTextFromMessage(message) {
  if (typeof message.content === 'string') {
    return (
      splitInlineReasoningFromAIMessage(message)?.content ??
      message.content.trim()
    )
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter(c => c?.type === 'text')
      .map(c => c.text || '')
      .join('\n')
      .trim()
  }
  return ''
}

export function extractContentBlocks(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text' || typeof c === 'string')
      .map(c => (typeof c === 'string' ? c : c.text || ''))
      .join('')
  }
  return ''
}
