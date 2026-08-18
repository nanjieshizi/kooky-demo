<template>
  <div
    ref="el"
    class="markdown-content markdown-body"
    :class="{ 'is-streaming': isStreaming }"
    v-html="renderedHtml"
    @click.capture="handleClick"
  />
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import markdownItHighlightjs from 'markdown-it-highlightjs'
import 'highlight.js/styles/github.css'
import markdownItKatex from '@vscode/markdown-it-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { ElMessage } from 'element-plus'
import copyIcon from '@/assets/home/refresh.svg'
import { highlightMentionsInHtml } from '@/shared/utils/highlightMentionsInHtml.js'

// 模块级单例，避免多组件实例重复初始化
let _mermaidReady = false
function ensureMermaid() {
  if (_mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
  })
  _mermaidReady = true
}

const props = defineProps({
  content: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
})

const el = ref(null)

function handleClick(e) {
  const anchor = e.target.closest('a')
  if (!anchor) return
  // 流式渲染期间屏蔽所有链接
  if (props.isStreaming) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  // 锚点链接（#xxx）阻止路由跳转，避免白屏
  const href = anchor.getAttribute('href') || ''
  if (href.startsWith('#')) {
    e.preventDefault()
    e.stopPropagation()
  }
}

// markdown-it 实例：集成 highlight.js
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
}).use(markdownItHighlightjs, { hljs }).use(markdownItKatex)

// 保存默认 fence 规则（highlight.js 已经注册了它）
const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules) ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

// 检测内容是否为 Markdown 表格（无语言标记的 fence 中包含表格语法）
function isMarkdownTable(content) {
  const lines = content.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  // 至少有表头行和分隔行，且都包含 |
  const hasHeaderSep = lines.some(l => /^\|?\s*[-:]+[-| :]*$/.test(l.trim()))
  const pipeLines = lines.filter(l => l.includes('|'))
  return hasHeaderSep && pipeLines.length === lines.length
}

// 用于解析被 fence 包裹的表格（独立实例，避免递归）
const tableMd = new MarkdownIt({ html: true, breaks: false })

// 重写 fence 规则：mermaid 块输出占位 div，表格重新解析，其余走默认高亮路径 + 复制按钮
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = token.info.trim()

  if (lang === 'mermaid') {
    const encoded = btoa(encodeURIComponent(token.content).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(Number('0x' + p1))))
    return `<div class="mermaid-block" data-src="${encoded}"></div>\n`
  }

  // 无语言标记且内容是表格，则作为 Markdown 表格渲染，并包装复制按钮
  if (!lang && isMarkdownTable(token.content)) {
    const tableHtml = tableMd.render(token.content)
    return `<div class="table-wrapper">
      <div class="table-header">
        <button class="table-copy-btn" aria-label="复制表格">
          <img src="${copyIcon}" alt="" />
        </button>
      </div>
      ${tableHtml}
    </div>`
  }

  // 验证语言标识符是否有效，避免 highlight.js 警告
  if (lang && !hljs.getLanguage(lang)) {
    // 无效语言标识符，作为纯文本处理
    const escaped = md.utils.escapeHtml(token.content)
    return `<div class="code-block-wrapper">
      <div class="code-header">
        <span class="code-language-label">${md.utils.escapeHtml(lang)}</span>
        <div class="code-actions">
          <button class="code-copy-btn" aria-label="复制代码">
            <img src="${copyIcon}" alt="" />
          </button>
          <button class="code-download-btn" data-lang="${md.utils.escapeHtml(lang)}" aria-label="下载代码">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 1V10M7 10L10 7M7 10L4 7M1 13H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <pre><code>${escaped}</code></pre>
    </div>`
  }

  // 走默认高亮渲染，然后包一层工具栏（语言标签 + 复制 + 下载）
  const highlighted = defaultFence(tokens, idx, options, env, self)
  const langLabel = lang || 'text'

  // 检测是否为单行内容（无换行符）
  const isSingleLine = !token.content.includes('\n')
  const wrapperClass = isSingleLine && !lang ? 'code-block-wrapper code-block-single-line' : 'code-block-wrapper'

  return `<div class="${wrapperClass}">
    <div class="code-header">
      <span class="code-language-label">${md.utils.escapeHtml(langLabel)}</span>
      <div class="code-actions">
        <button class="code-copy-btn" aria-label="复制代码">
          <img src="${copyIcon}" alt="" />
        </button>
        <button class="code-download-btn" data-lang="${md.utils.escapeHtml(langLabel)}" aria-label="下载代码">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1V10M7 10L10 7M7 10L4 7M1 13H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    ${highlighted}
  </div>`
}

// 自定义 blockquote 渲染，添加复制按钮
md.renderer.rules.blockquote_open = function() {
  return `<div class="blockquote-wrapper">
    <button class="blockquote-copy-btn" aria-label="复制引用">
      <img src="${copyIcon}" alt="" />
    </button>
    <blockquote>`
}

md.renderer.rules.blockquote_close = function() {
  return `</blockquote></div>`
}

// 自定义 code_inline 渲染，识别文件路径并添加复制按钮
const defaultCodeInline = md.renderer.rules.code_inline || function(tokens, idx, options, env, slf) {
  return slf.renderToken(tokens, idx, options)
}

md.renderer.rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx]
  const content = token.content

  // 检测是否为文件路径（Unix 或 Windows 路径）
  const isFilePath = /^([\/~]|[A-Za-z]:\\).+/.test(content) || /\.(js|ts|vue|jsx|tsx|py|java|go|rs|md|txt|json|yaml|yml|xml|html|css|scss|sh)$/.test(content)

  if (isFilePath) {
    return `<span class="file-path-wrapper">
      <button class="file-path-copy-btn" aria-label="复制路径">
        <img src="${copyIcon}" alt="" />
      </button>
      <code class="file-path">${md.utils.escapeHtml(content)}</code>
    </span>`
  }

  return defaultCodeInline(tokens, idx, options, env, slf)
}

// 全局复制函数（通过事件委托绑定到容器，避免 window 污染）
function copyCode(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  const code = wrapper.querySelector('pre code')?.textContent || wrapper.querySelector('pre')?.textContent || ''
  navigator.clipboard.writeText(code).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function downloadCode(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  const code = wrapper.querySelector('pre code')?.textContent || wrapper.querySelector('pre')?.textContent || ''
  const lang = btn.dataset.lang || 'txt'

  // 根据语言生成文件扩展名
  const extMap = {
    javascript: 'js', typescript: 'ts', python: 'py', java: 'java',
    cpp: 'cpp', c: 'c', csharp: 'cs', go: 'go', rust: 'rs',
    php: 'php', ruby: 'rb', swift: 'swift', kotlin: 'kt',
    html: 'html', css: 'css', scss: 'scss', json: 'json',
    yaml: 'yaml', xml: 'xml', sql: 'sql', shell: 'sh',
    bash: 'sh', markdown: 'md', text: 'txt'
  }
  const ext = extMap[lang.toLowerCase()] || lang.toLowerCase() || 'txt'
  const filename = `code.${ext}`

  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function copyBlockquote(btn) {
  const wrapper = btn.closest('.blockquote-wrapper')
  const text = wrapper.querySelector('blockquote')?.textContent || ''
  navigator.clipboard.writeText(text.trim()).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function copyFilePath(btn) {
  const wrapper = btn.closest('.file-path-wrapper')
  const path = wrapper.querySelector('.file-path')?.textContent || ''
  navigator.clipboard.writeText(path).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function copyTable(btn) {
  const wrapper = btn.closest('.table-wrapper')
  const table = wrapper.querySelector('table')
  if (!table) return

  const rows = Array.from(table.querySelectorAll('tr'))
  const text = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'))
    return cells.map(cell => cell.textContent.trim()).join('\t')
  }).join('\n')

  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// 事件委托：统一处理容器内所有按钮的点击
function handleCopyClick(e) {
  const btn = e.target.closest(
    '.code-copy-btn, .code-download-btn, .blockquote-copy-btn, .file-path-copy-btn, .table-copy-btn'
  )
  if (!btn) return
  e.stopPropagation()
  if (btn.classList.contains('code-copy-btn')) copyCode(btn)
  else if (btn.classList.contains('code-download-btn')) downloadCode(btn)
  else if (btn.classList.contains('blockquote-copy-btn')) copyBlockquote(btn)
  else if (btn.classList.contains('file-path-copy-btn')) copyFilePath(btn)
  else if (btn.classList.contains('table-copy-btn')) copyTable(btn)
}

const renderedHtml = ref('')
let _timer = null

function doRender(text) {
  let html = highlightMentionsInHtml(md.render(text || ''))
  // 与 deer-flow 对齐：非外部链接、下载类链接、文件名链接都替换为纯文本
  html = html.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, content) => {
    // 非 http/https 链接（容器路径等）
    if (!href.startsWith('http://') && !href.startsWith('https://')) return content
    // 含 /artifacts/ 或 /uploads/ 的下载链接
    if (/\/(artifacts|uploads)\//i.test(href)) return content
    // href 指向文件（以常见扩展名结尾）
    if (/\.(md|txt|pdf|docx?|xlsx?|csv|json|yaml|yml|xml|py|js|ts|html|css|sh|png|jpg|jpeg|gif|svg|zip|tar|gz)(\?.*)?$/i.test(href)) return content
    return match
  })
  renderedHtml.value = html
}

async function renderMermaid() {
  if (props.isStreaming) return
  ensureMermaid()
  const nodes = el.value?.querySelectorAll('.mermaid-block[data-src]')
  if (!nodes?.length) return

  for (const node of nodes) {
    try {
      const code = decodeURIComponent(
        atob(node.dataset.src).split('').map(c =>
          '%' + c.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('')
      )
      node.textContent = code
      node.removeAttribute('data-src')
    } catch {
      // 解码失败跳过
    }
  }

  try {
    await mermaid.run({
      nodes: Array.from(el.value.querySelectorAll('.mermaid-block')),
    })
  } catch {
    el.value?.querySelectorAll('.mermaid-block').forEach(node => {
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      code.textContent = node.textContent
      pre.appendChild(code)
      node.replaceWith(pre)
    })
  }
}

watch(
  () => [props.content, props.isStreaming],
  ([content, isStreaming]) => {
    clearTimeout(_timer)
    if (isStreaming) {
      _timer = setTimeout(() => doRender(content), 80)
    } else {
      doRender(content)
      nextTick(() => renderMermaid())
    }
  },
  { immediate: true }
)

// 挂载后绑定事件委托，卸载时移除，避免 window 污染
watch(el, (container, oldContainer) => {
  if (oldContainer) oldContainer.removeEventListener('click', handleCopyClick)
  if (container) container.addEventListener('click', handleCopyClick)
})

onUnmounted(() => {
  clearTimeout(_timer)
  el.value?.removeEventListener('click', handleCopyClick)
})
</script>

<style scoped>
.markdown-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-break: break-word;
}

/* 代码块包装器（含复制按钮） */
.markdown-content :deep(.code-block-wrapper) {
  position: relative;
  margin: 6px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
}

/* 单行代码块：更紧凑的样式，类似行内代码 */
.markdown-content :deep(.code-block-single-line) {
  display: inline-block;
  max-width: 100%;
  margin: 2px 0;
}

.markdown-content :deep(.code-block-single-line .code-header) {
  padding: 4px 8px;
  background: transparent;
  border-bottom: none;
}

.markdown-content :deep(.code-block-single-line .code-language-label) {
  display: none;
}

.markdown-content :deep(.code-block-single-line pre) {
  padding: 4px 8px;
  display: inline-block;
}

.markdown-content :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
}

.markdown-content :deep(.code-language-label) {
  font-size: 12px;
  font-weight: 500;
  color: #57606a;
  text-transform: lowercase;
  user-select: none;
}

.markdown-content :deep(.code-actions) {
  display: flex;
  align-items: center;
  gap: 4px;
}

.markdown-content :deep(.code-copy-btn),
.markdown-content :deep(.code-download-btn) {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
  color: #57606a;
}

.markdown-content :deep(.code-copy-btn:hover),
.markdown-content :deep(.code-download-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.code-copy-btn img),
.markdown-content :deep(.code-download-btn svg) {
  width: 16px;
  height: 16px;
}
.markdown-content :deep(.markdown-body hr) {
  border: 1px solid #DFE2EA;
  margin: 0 20px;
}

/* code-block-wrapper 内部的 pre 不需要额外 margin/border */
.markdown-content :deep(.code-block-wrapper pre) {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 12px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
}

/* 单行代码块：更紧凑的内边距 */
.markdown-content :deep(.code-block-wrapper pre:has(code)) {
  padding: 10px 16px;
}

.markdown-content :deep(.code-block-wrapper pre code) {
  display: block;
  background: transparent;
  padding: 0;
  border: none;
  border-radius: 0;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

/* 独立代码块（非 wrapper 内） */
.markdown-content :deep(pre) {
  margin: 6px 0;
  padding: 16px;
  border-radius: 8px;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  border: none;
  border-radius: 0;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

/* 行内代码 */
.markdown-content :deep(code) {
  background: #F9FAFB;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #d0d7de;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.875em;
  color: #1f2328;
}

/* 标题 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 12px 0 8px;
  font-weight: 600;
  line-height: 1.4;
}
.markdown-content :deep(h1) { font-size: 1.5em; }
.markdown-content :deep(h2) { font-size: 1.3em; }
.markdown-content :deep(h3) { font-size: 1.15em; }

/* 段落 */
.markdown-content :deep(p) { margin: 4px 0; color: #2F3547; }

/* 链接 */
.markdown-content :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.markdown-content :deep(a:hover) { text-decoration: underline; }

/* 流式渲染期间禁用链接点击 */
.markdown-content.is-streaming :deep(a) {
  pointer-events: none;
  cursor: default;
}

/* @提及 */
.markdown-content :deep(.mention-tag) {
  color: #4f6ef7;
  font-weight: 500;
}

.markdown-content :deep(.mention-at) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: calc(1em - 2px);
  line-height: 1;
}

/* 列表 */
.markdown-content :deep(ul) {
  list-style: disc;
  padding-left: 20px;
  margin: 4px 0;
}
.markdown-content :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}
.markdown-content :deep(li) {
  padding-left: 4px;
  margin: 2px 0;
}
.markdown-content :deep(ul li)::before { content: none; }

/* 引用块 */
.markdown-content :deep(.blockquote-wrapper) {
  position: relative;
  margin: 8px 0;
}

.markdown-content :deep(.blockquote-copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
  z-index: 1;
}

.markdown-content :deep(.blockquote-wrapper:hover .blockquote-copy-btn) {
  opacity: 0.6;
}

.markdown-content :deep(.blockquote-copy-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.blockquote-copy-btn img) {
  width: 16px;
  height: 16px;
}

.markdown-content :deep(blockquote) {
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

/* 文件路径（行内样式，类似普通行内代码） */
.markdown-content :deep(.file-path-wrapper) {
  display: inline-flex;
  align-items: center;
  position: relative;
  background: #F9FAFB;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.875em;
  vertical-align: middle;
}

.markdown-content :deep(.file-path) {
  display: inline;
  background: transparent;
  padding: 0;
  margin: 0 4px 0 0;
  border: none;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  font-size: inherit;
  color: #1f2328;
  word-break: break-all;
}

.markdown-content :deep(.file-path-copy-btn) {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.markdown-content :deep(.file-path-wrapper:hover .file-path-copy-btn) {
  opacity: 0.6;
}

.markdown-content :deep(.file-path-copy-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.file-path-copy-btn img) {
  width: 12px;
  height: 12px;
}

/* 强调 */
.markdown-content :deep(strong) {
  font-weight: 700;
  color: inherit;
}

/* 表格 */
.markdown-content :deep(.table-wrapper) {
  position: relative;
  margin: 8px 0;
}

.markdown-content :deep(.table-header) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 0 4px 0;
}

.markdown-content :deep(.table-copy-btn) {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.markdown-content :deep(.table-wrapper:hover .table-copy-btn) {
  opacity: 0.6;
}

.markdown-content :deep(.table-copy-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.table-copy-btn img) {
  width: 16px;
  height: 16px;
}

.markdown-content :deep(.table-wrapper table),
.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  margin: 8px 0;
  font-size: 13px;
}

.markdown-content :deep(.table-wrapper table) {
  margin: 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
  word-break: break-word;
  overflow-wrap: break-word;
}

.markdown-content :deep(th) {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even) td) {
  background: var(--bg-secondary);
}

/* mermaid 图表容器 */
.markdown-content :deep(.mermaid-block) {
  margin: 8px 0;
  overflow-x: auto;
  text-align: center;
}

.markdown-content :deep(.mermaid-block svg) {
  max-width: 100%;
  height: auto;
}
</style>