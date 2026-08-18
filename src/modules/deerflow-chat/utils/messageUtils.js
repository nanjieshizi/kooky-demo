/**
 * 消息处理工具函数（与 deer-flow 的 core/messages/utils.ts 对齐）
 *
 * 职责：统一封装对 LangGraph 消息的判断 & 过滤逻辑，
 * 供 loadMessages / sendMessage 使用。
 */

import { hasToolCalls } from './toolCallsUtils'

// 仅通过 String.replace 调用，replace 会自动重置 lastIndex，g 标志安全
const THINK_TAG_RE = /<think>\s*([\s\S]*?)\s*<\/think>/g

/**
 * 从字符串内容里分离 <think>...</think> 推理部分
 */
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

/**
 * 从 AI 消息中分离内容和推理（兼容 <think> 标签）
 */
export function splitInlineReasoningFromAIMessage(message) {
  if (message.type !== 'ai') return null
  if (typeof message.content !== 'string') return null
  const { content, reasoning } = splitInlineReasoning(message.content)
  if (!reasoning) return null
  return { content, reasoning }
}

/**
 * 提取消息的推理内容（多种来源兼容）
 * 返回：string | null
 */
export function extractReasoningContentFromMessage(message) {
  if (message.type !== 'ai') return null

  // 1) additional_kwargs.reasoning_content（OpenAI o1 系列 / 网关统一透传）
  const kw = message.additional_kwargs?.reasoning_content
  if (typeof kw === 'string' && kw.trim()) return kw.trim()

  // 2) content 是数组且包含 thinking 块（Anthropic 风格）
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

  // 3) content 是字符串且包含 <think>...</think> 标签
  if (typeof message.content === 'string') {
    const { reasoning } = splitInlineReasoning(message.content)
    if (reasoning) return reasoning
  }

  return null
}

/**
 * 判断消息是否有文本内容
 */
export function hasContent(message) {
  if (typeof message.content === 'string') {
    return (
      (
        splitInlineReasoningFromAIMessage(message)?.content ??
        message.content.trim()
      ).length > 0
    )
  }
  if (Array.isArray(message.content)) {
    // 只统计文本块
    return message.content.some(
      (c) => c?.type === 'text' && typeof c.text === 'string' && c.text.trim()
    )
  }
  return false
}

/**
 * 判断 AI 消息是否包含推理（思考过程）
 */
export function hasReasoning(message) {
  return extractReasoningContentFromMessage(message) !== null
}

/**
 * 判断 AI 消息是否包含 present_files 工具调用
 */
export function hasPresentFiles(message) {
  return (
    message.type === 'ai' &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.some((tc) => tc.name === 'present_files')
  )
}

/**
 * 从 AI 消息里提取 present_files 工具调用中声明的文件路径
 */
export function extractPresentFilesFromMessage(message) {
  if (!hasPresentFiles(message)) return []
  const files = []
  for (const tc of message.tool_calls || []) {
    if (tc.name === 'present_files' && Array.isArray(tc.args?.filepaths)) {
      files.push(...tc.args.filepaths)
    }
  }
  return files
}

/**
 * 判断 AI 消息是否包含 subagent (task) 工具调用
 */
export function hasSubagent(message) {
  if (message.type !== 'ai') return false
  return !!message.tool_calls?.some((tc) => tc.name === 'task')
}

/**
 * 判断 tool 消息是否为 ask_clarification（澄清提问）
 */
export function isClarificationToolMessage(message) {
  return message.type === 'tool' && message.name === 'ask_clarification'
}

/**
 * 判断消息是否应对用户隐藏（additional_kwargs.hide_from_ui）
 */
export function isHiddenFromUIMessage(message) {
  return message.additional_kwargs?.hide_from_ui === true
}

/**
 * 从消息中提取文本内容（与 deer-flow extractTextFromMessage 对齐）
 * 会自动剥离 <think>...</think> 推理标签
 */
export function extractTextFromMessage(message) {
  if (typeof message.content === 'string') {
    return (
      splitInlineReasoningFromAIMessage(message)?.content ??
      message.content.trim()
    )
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c) => c?.type === 'text')
      .map((c) => c.text || '')
      .join('\n')
      .trim()
  }
  return ''
}

/**
 * 判断消息是否应该显示在 UI 列表中（用户可见）
 *
 * 规则（与 deer-flow 的 groupMessages 可见结果对齐）：
 * - 隐藏标记 (hide_from_ui) → 过滤
 * - todo_reminder 系统消息 → 过滤
 * - human 消息 → 保留
 * - ai 消息：有内容 或 有推理 或 有 tool_calls → 保留
 * - tool 消息 → 过滤（已合并到 AI 消息的 toolResults）
 */
export function isVisibleInUI(message) {
  if (isHiddenFromUIMessage(message)) return false
  if (message.name === 'todo_reminder') return false
  if (message.type === 'human') return true
  if (message.type === 'ai') {
    // 有正文 / 有推理 / 有 tool_calls 都需要展示
    return hasContent(message) || hasReasoning(message) || hasToolCalls(message)
  }
  return false
}
