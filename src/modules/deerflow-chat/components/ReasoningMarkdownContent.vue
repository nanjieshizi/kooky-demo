<template>
  <div class="reasoning-md" v-html="rendered" />
</template>

<script setup>
import { ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import markdownItHighlightjs from 'markdown-it-highlightjs'
import 'highlight.js/styles/github.css'

const props = defineProps({
  content: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
})

// html: false 防止 LLM 思考内容中的 HTML 被执行
const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
}).use(markdownItHighlightjs, { hljs })

const rendered = ref('')
let _timer = null

function doRender(text) {
  let html = md.render(text || '')
  // 思考内容里所有链接都替换为纯文本，不应可点击
  html = html.replace(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi, '$1')
  rendered.value = html
}

watch(
  () => [props.content, props.isStreaming],
  ([content, isStreaming]) => {
    clearTimeout(_timer)
    if (isStreaming) {
      _timer = setTimeout(() => doRender(content), 80)
    } else {
      doRender(content)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.reasoning-md {
  font-size: 13px;
  line-height: 1.7;
  color: #5a6072;
  word-break: break-word;
}
.reasoning-md :deep(p) { margin: 0 0 6px; }
.reasoning-md :deep(p:last-child) { margin-bottom: 0; }
.reasoning-md :deep(code) {
  background: #f0f1f3;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.875em;
}
.reasoning-md :deep(pre) {
  background: #f0f1f3;
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
.reasoning-md :deep(pre code) {
  background: transparent;
  padding: 0;
}
.reasoning-md :deep(ul),
.reasoning-md :deep(ol) {
  padding-left: 18px;
  margin: 4px 0;
}
.reasoning-md :deep(li) { margin: 2px 0; }
.reasoning-md :deep(strong) { font-weight: 600; }
</style>
