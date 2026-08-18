import { ref, watch, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { highlightMentionsFromIds } from '@/shared/utils/highlightMentionsFromIds.js'

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
})

/**
 * 用户消息气泡：Markdown 渲染 + @ 高亮 + 流式节流
 * @param {() => object | undefined} getMessage
 * @param {{ memberProfileMap?: Object, currentUserId?: string }} [options]
 */
export function useUserBubbleMarkdown(getMessage, options = {}) {
  const renderedContent = ref('')
  let renderTimer = null

  function resolveOption(opt) {
    if (typeof opt === 'function') return opt()
    if (opt && typeof opt === 'object' && 'value' in opt) return opt.value
    return opt ?? {}
  }

  function runRender(text, mentions) {
    const html = md.render(text || '')
    const currentUserId = resolveOption(options.currentUserId) ?? ''
    const mentionList = Array.isArray(mentions) ? mentions : []

    renderedContent.value = mentionList.length > 0
      ? highlightMentionsFromIds(html, mentionList, currentUserId)
      : html
  }

  watch(
    () => {
      const m = getMessage()
      const content = m?.content && typeof m.content === 'object' ? m.content : { body: m?.content }
      return [content.body, m?.isStreaming, m?.role, content.mentions]
    },
    ([content, isStreaming, role, mentions]) => {
      const m = getMessage()
      if (!m || (role !== 'user' && role !== 'member')) return
      clearTimeout(renderTimer)
      if (isStreaming) {
        renderTimer = setTimeout(() => runRender(content, mentions), 80)
      } else {
        runRender(content, mentions)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => clearTimeout(renderTimer))

  return { renderedContent }
}
