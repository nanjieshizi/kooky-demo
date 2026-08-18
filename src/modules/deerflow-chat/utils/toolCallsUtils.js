/**
 * 工具调用处理工具函数
 * 用于从 LangGraph 消息中提取和关联 tool_calls
 * 与 deer-flow 的 core/messages/utils.ts 和 message-group.tsx 对齐
 */

/**
 * 判断 AI 消息是否包含工具调用
 * @param {object} message - LangGraph 风格消息
 * @returns {boolean}
 */
export function hasToolCalls(message) {
  if (!message) return false

  return (
    (message.type === 'ai' || message.role === 'assistant') &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  )
}

/**
 * 将消息列表转换为步骤列表（与 deer-flow convertToSteps 对齐）
 * 每个步骤可以是 reasoning 或 toolCall 类型
 * @param {Array} messages - 完整 LangGraph 消息列表（含 type==='tool' 的结果消息）
 * @returns {Array<{id: string, type: 'reasoning'|'toolCall', name?: string, args?: object, result?: string}>}
 */
export function convertToSteps(messages) {
  if (!Array.isArray(messages)) return []

  const steps = []
  for (const message of messages) {
    if (message.type === 'ai' || message.role === 'assistant') {
      // 提取 reasoning 内容
      const reasoning = extractReasoningFromMessage(message)
      if (reasoning) {
        steps.push({
          id: message.id || `reasoning_${steps.length}`,
          messageId: message.id,
          type: 'reasoning',
          reasoning
        })
      }

      // 处理 tool_calls
      for (const tool_call of message.tool_calls || []) {
        // 兼容 LangChain model_dump() 格式（name/args 直接在对象上）
        // 和 OpenAI function 格式（function.name / function.arguments 字符串）
        const name = tool_call.name || tool_call.function?.name || 'unknown'
        // 跳过 "task" 工具（子代理，单独处理）
        if (name === 'task') continue

        let args = tool_call.args
        if (args === undefined || args === null) {
          const rawArgs = tool_call.function?.arguments
          if (typeof rawArgs === 'string') {
            try { args = JSON.parse(rawArgs) } catch { args = {} }
          } else {
            args = rawArgs || {}
          }
        }
        if (typeof args === 'string') {
          try { args = JSON.parse(args) } catch { args = {} }
        }

        const result = findToolCallResult(tool_call.id, messages)
        steps.push({
          id: tool_call.id || `tool_${steps.length}`,
          messageId: message.id,
          type: 'toolCall',
          name,
          args,
          result: result || null,
        })
      }
    }
  }
  return steps
}

/**
 * 从消息中提取 reasoning 内容
 * @param {object} message
 * @returns {string|null}
 */
function extractReasoningFromMessage(message) {
  // 1) additional_kwargs.reasoning_content
  const kw = message.additional_kwargs?.reasoning_content
  if (typeof kw === 'string' && kw.trim()) return kw.trim()

  // 2) content 数组中的 thinking 块
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === 'thinking' && typeof part.thinking === 'string') {
        return part.thinking.trim()
      }
      if (part?.type === 'thinking' && typeof part.text === 'string') {
        return part.text.trim()
      }
    }
  }

  return null
}

/**
 * 从工具参数中提取 description 字段
 * @param {object} args - 工具参数
 * @returns {string|undefined}
 */
export function getToolDescription(args) {
  if (!args || typeof args !== 'object') return undefined
  return args.description
}

/**
 * 从工具参数中提取 path 字段
 * @param {object} args - 工具参数
 * @returns {string|undefined}
 */
export function getToolPath(args) {
  if (!args || typeof args !== 'object') return undefined
  return args.path
}

/**
 * 从工具参数中提取 command 字段（bash 工具）
 * @param {object} args - 工具参数
 * @returns {string|undefined}
 */
export function getToolCommand(args) {
  if (!args || typeof args !== 'object') return undefined
  return args.command
}

/**
 * 从工具参数中提取 query 字段（搜索工具）
 * @param {object} args - 工具参数
 * @returns {string|undefined}
 */
export function getToolQuery(args) {
  if (!args || typeof args !== 'object') return undefined
  return args.query
}

/**
 * 从工具参数中提取 url 字段
 * @param {object} args - 工具参数
 * @returns {string|undefined}
 */
export function getToolUrl(args) {
  if (!args || typeof args !== 'object') return undefined
  return args.url
}

/**
 * 工具类型枚举
 */
export const ToolType = {
  WEB_SEARCH: 'web_search',
  IMAGE_SEARCH: 'image_search',
  WEB_FETCH: 'web_fetch',
  LS: 'ls',
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  STR_REPLACE: 'str_replace',
  BASH: 'bash',
  ASK_CLARIFICATION: 'ask_clarification',
  WRITE_TODOS: 'write_todos',
  PRESENT_FILES: 'present_files'
}

/**
 * 判断是否为文件操作工具
 * @param {string} toolName
 * @returns {boolean}
 */
export function isFileTool(toolName) {
  return [ToolType.LS, ToolType.READ_FILE, ToolType.WRITE_FILE, ToolType.STR_REPLACE].includes(toolName)
}

/**
 * 判断是否为搜索工具
 * @param {string} toolName
 * @returns {boolean}
 */
export function isSearchTool(toolName) {
  return [ToolType.WEB_SEARCH, ToolType.IMAGE_SEARCH].includes(toolName)
}

/**
 * 从 AI 消息中提取工具调用列表（用于历史消息加载）
 * @param {object} message - LangGraph 风格消息
 * @returns {Array<{id: string, name: string, args: object}>}
 */
export function extractToolCalls(message) {
  if (!hasToolCalls(message)) return []

  return message.tool_calls.map(tc => {
    const name = tc.name || tc.function?.name || 'unknown'
    let args = tc.args
    if (args === undefined || args === null) {
      const rawArgs = tc.function?.arguments
      if (typeof rawArgs === 'string') {
        try { args = JSON.parse(rawArgs) } catch { args = {} }
      } else {
        args = rawArgs || {}
      }
    }
    if (typeof args === 'string') {
      try { args = JSON.parse(args) } catch { args = {} }
    }
    return {
      id: tc.id || `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      args,
    }
  })
}

/**
 * 在消息列表中查找 tool_call 对应的结果
 * @param {string} toolCallId - 工具调用 ID
 * @param {Array} messages - LangGraph 消息列表
 * @returns {string|undefined}
 */
export function findToolCallResult(toolCallId, messages) {
  if (!toolCallId || !Array.isArray(messages)) return undefined

  for (const msg of messages) {
    if (msg.type === 'tool' && msg.tool_call_id === toolCallId) {
      return extractToolResultContent(msg.content)
    }
    if (msg.role === 'tool' && msg.tool_call_id === toolCallId) {
      return extractToolResultContent(msg.content)
    }
  }
  return undefined
}

/**
 * 提取工具结果内容
 */
function extractToolResultContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c
        if (c?.type === 'text') return c.text || ''
        return ''
      })
      .join('\n')
  }
  return ''
}

/**
 * 将 AI 消息的 tool_calls 转换为步骤列表（用于渲染）
 * 与 deer-flow 对齐：只展示输入参数，不展示输出结果
 * @param {object} aiMessage - AI 消息
 * @returns {Array<{id: string, name: string, args: object}>}
 */
export function buildToolCallSteps(aiMessage) {
  return extractToolCalls(aiMessage)
}
