import { ref, watch, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { highlightMentionsFromIds } from '@/shared/utils/highlightMentionsFromIds.js'
import { stripMessageDownloadLinks } from '@/shared/utils/messageLinkSanitizer.js'

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

md.disable(['blockquote'])

/**
 * 一人团队员工对话：用户气泡 Markdown（从 deerflow useDeerflowUserBubbleMarkdown 复制）。
 * @param {() => object | undefined} getMessage
 * @param {{ memberProfileMap?: Object, currentUserId?: string }} [options]
 */
export function useEmployeeChatUserBubbleMarkdown(getMessage, options = {}) {
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

  function runRender(text, mentionedUserIds, hasSkills) {
    let cleaned = hasSkills ? (text || '').replace(/^使用.+?技能\n?/, '') : (text || '')
    cleaned = cleaned.replace(/<skill_activation>[\s\S]*?<\/skill_activation>/g, '')

    const m = getMessage()
    const msgId = m?.id || 'unknown'
    const { quotes, cleanContent } = extractQuotesFromMarkdown(cleaned)
    extractedQuotes.value = quotes.map((content, idx) => ({
      id: `${msgId}-quote-${idx}`,
      content,
      role: 'assistant',
    }))

    const html = stripMessageDownloadLinks(md.render(cleanContent))
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
      return [m?.content, m?.isStreaming, m?.role, m?.mentionedUserIds, m?.custom_data?.skills, memberProfileMap]
    },
    ([content, isStreaming, role, mentionedUserIds, skills]) => {
      const m = getMessage()
      if (!m || (role !== 'user' && role !== 'member')) return
      clearTimeout(renderTimer)
      const hasSkills = Array.isArray(skills) && skills.length > 0
      if (isStreaming) {
        renderTimer = setTimeout(() => runRender(content, mentionedUserIds, hasSkills), 80)
      } else {
        runRender(content, mentionedUserIds, hasSkills)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => clearTimeout(renderTimer))

  return { renderedContent, extractedQuotes }
}
