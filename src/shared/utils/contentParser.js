/**
 * 消息内容解析工具
 * 将 OpenClaw / Anthropic 格式的消息对象解析为统一的结构化格式
 */

/**
 * 解析消息对象，支持 content 为字符串或内容块数组
 * @param {Object} message - 消息对象 { role, content }
 * @returns {{ role: string, text: string, toolUses: Array, toolResults: Array, images: Array, thinking: string, rawBlocks: Array } | null}
 */
export function parseMessage(message) {
  if (!message || typeof message !== 'object') return null

  const role = message.role || 'assistant'
  const content = message.content

  // content 为字符串，直接返回
  if (typeof content === 'string') {
    return {
      role,
      text: content,
      toolUses: [],
      toolResults: [],
      images: [],
      thinking: '',
      rawBlocks: [],
    }
  }

  // content 为数组（Anthropic 内容块格式）
  if (Array.isArray(content)) {
    const textParts = []
    const toolUses = []
    const toolResults = []
    const images = []
    let thinking = ''
    const rawBlocks = content

    for (const block of content) {
      if (!block || typeof block !== 'object') continue

      switch (block.type) {
        case 'text':
          if (block.text) {
            // 剥离 <think>...</think> 标签（部分模型将思考过程嵌入 text 块）
            const stripped = block.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()
            if (stripped) textParts.push(stripped)
          }
          break

        case 'tool_use':
          toolUses.push({
            id: block.id,
            name: block.name,
            input: block.input,
          })
          break

        case 'tool_result':
          toolResults.push({
            toolUseId: block.tool_use_id,
            content: block.content,
            isError: block.is_error || false,
          })
          break

        case 'image':
          images.push({
            type: block.source?.type || 'base64',
            mediaType: block.source?.media_type || 'image/png',
            data: block.source?.data || '',
          })
          break

        case 'thinking':
        case 'redacted_thinking':
          if (block.thinking) thinking += block.thinking
          break

        default:
          // 未知类型不提取文本，避免 thinking 等内容混入
          break
      }
    }

    return {
      role,
      text: textParts.join('\n'),
      toolUses,
      toolResults,
      images,
      thinking,
      rawBlocks,
    }
  }

  // content 为空或其他类型
  return {
    role,
    text: content != null ? String(content) : '',
    toolUses: [],
    toolResults: [],
    images: [],
    thinking: '',
    rawBlocks: [],
  }
}
