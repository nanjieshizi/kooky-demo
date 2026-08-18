import { ref, watch, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { highlightMentionsFromIds } from '@/shared/utils/highlightMentionsFromIds.js'

const md = new MarkdownIt({
  // 用户输入禁止解析 HTML，防止 <script> 等标签破坏气泡布局或引入 XSS 风险
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

// 禁用 blockquote 渲染，改用 DeerflowQuoteBlock 组件化方式
md.disable(['blockquote'])

/**
 * Deerflow 用户消息气泡：Markdown 渲染 + @ 高亮 + 流式节流 + 引用块提取
 * 在公共 useUserBubbleMarkdown 基础上增加：
 *   1. 禁用 blockquote 渲染
 *   2. 从 Markdown 内容中提取 `>` 引用块，供 DeerflowQuoteBlock 组件渲染
 * @param {() => object | undefined} getMessage
 * @param {{ memberProfileMap?: Object, currentUserId?: string }} [options]
 */
export function useDeerflowUserBubbleMarkdown(getMessage, options = {}) {
  const renderedContent = ref('')
  const extractedQuotes = ref([])
  let renderTimer = null

  function extractQuotesFromMarkdown(text) {
    const quotes = []
    const lines = text.split('\n')
    const cleanLines = []
    let currentQuote = []

    for (const line of lines) {
      if (line.startsWith('> ')) {
        currentQuote.push(line.slice(2))
      } else if (line.startsWith('>')) {
        currentQuote.push(line.slice(1))
      } else {
        if (currentQuote.length > 0) {
          quotes.push(currentQuote.join('\n').trim())
          currentQuote = []
        }
        cleanLines.push(line)
      }
    }

    if (currentQuote.length > 0) {
      quotes.push(currentQuote.join('\n').trim())
    }

    return { quotes, cleanContent: cleanLines.join('\n') }
  }

  function resolveOption(opt) {
    if (typeof opt === 'function') return opt()
    if (opt && typeof opt === 'object' && 'value' in opt) return opt.value
    return opt ?? {}
  }

  function runRender(text, mentionedUserIds) {
    // 提取引用块
    const m = getMessage()
    const msgId = m?.id || 'unknown'

    // 剥离 <skill_activation>...</skill_activation> 块（后端拼接的技能激活指令，不应展示给用户）
    const strippedText = (text || '').replace(/<skill_activation>[\s\S]*?<\/skill_activation>/g, '').trim()

    const { quotes, cleanContent } = extractQuotesFromMarkdown(strippedText)
    extractedQuotes.value = quotes.map((content, idx) => ({
      id: `${msgId}-quote-${idx}`,
      content,
      role: 'assistant',
    }))

    const html = md.render(cleanContent)
    const memberProfileMap = resolveOption(options.memberProfileMap)
    const currentUserId = resolveOption(options.currentUserId) ?? ''

    renderedContent.value = (Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0)
      ? highlightMentionsFromIds(html, mentionedUserIds, memberProfileMap, currentUserId)
      : html
  }

  watch(
    () => {
      const m = getMessage()
      const memberProfileMap = resolveOption(options.memberProfileMap)
      return [m?.content, m?.isStreaming, m?.role, m?.mentionedUserIds, memberProfileMap]
    },
    ([content, isStreaming, role, mentionedUserIds]) => {
      const m = getMessage()
      if (!m || (role !== 'user' && role !== 'member')) return
      clearTimeout(renderTimer)
      if (isStreaming) {
        renderTimer = setTimeout(() => runRender(content, mentionedUserIds), 80)
      } else {
        runRender(content, mentionedUserIds)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => clearTimeout(renderTimer))

  return { renderedContent, extractedQuotes }
}
