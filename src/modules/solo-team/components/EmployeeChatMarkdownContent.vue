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
/**
 * 员工对话助手正文 Markdown（solo-team 独立副本，行为对齐分身 DeerflowMarkdownContent：流式禁链、# 锚点、mermaid、代码/表格复制等；不引用 deerflow-chat）。
 */
defineOptions({ name: 'EmployeeChatMarkdownContent' })

import { ref, watch, nextTick, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import markdownItHighlightjs from 'markdown-it-highlightjs'
import 'highlight.js/styles/github.css'
import mermaid from 'mermaid'
import { ElMessage } from 'element-plus'
import copyIcon from '@/assets/home/refresh.svg'
import { highlightMentionsInHtml } from '@/shared/utils/highlightMentionsInHtml.js'
import { stripMessageDownloadLinks } from '@/shared/utils/messageLinkSanitizer.js'
import { useInlineSvgImageCards } from '@/shared/chatComposables/useInlineSvgImageCards'

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
  enableInlineSvgCards: { type: Boolean, default: false },
  svgCardSpaceId: { type: [String, Number], default: '' },
  svgCardRoomType: { type: String, default: 'super_person_chat' },
})

const el = ref(null)
const {
  renderInlineSvgCards,
  cleanupInlineSvgCards,
} = useInlineSvgImageCards({
  containerRef: el,
  enabled: () => props.enableInlineSvgCards && !props.isStreaming,
  spaceId: () => props.svgCardSpaceId,
  roomType: () => props.svgCardRoomType,
})

function prepareMermaidLayout(node) {
  if (!props.enableInlineSvgCards) return
  node.style.width = '960px'
  node.style.minWidth = '960px'
  node.style.maxWidth = 'none'
}

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
}).use(markdownItHighlightjs, { hljs })

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
        <button class="table-copy-btn" onclick="copyTable(this)" aria-label="复制表格">
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
        <button class="code-copy-btn" onclick="copyCode(this)" aria-label="复制代码">
          <img src="${copyIcon}" alt="" />
        </button>
      </div>
      <pre><code>${escaped}</code></pre>
    </div>`
  }

  // 走默认高亮渲染，然后包一层复制按钮
  const highlighted = defaultFence(tokens, idx, options, env, self)
  return `<div class="code-block-wrapper">
    <div class="code-header">
      <button class="code-copy-btn" onclick="copyCode(this)" aria-label="复制代码">
        <img src="${copyIcon}" alt="" />
      </button>
    </div>
    ${highlighted}
  </div>`
}

// 自定义 blockquote 渲染，添加复制按钮
md.renderer.rules.blockquote_open = function() {
  return `<div class="blockquote-wrapper">
    <button class="blockquote-copy-btn" onclick="copyBlockquote(this)" aria-label="复制引用">
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
    return `<div class="file-path-wrapper">
      <div class="file-path-header">
        <button class="file-path-copy-btn" onclick="copyFilePath(this)" aria-label="复制路径">
          <img src="${copyIcon}" alt="" />
        </button>
      </div>
      <code class="file-path">${md.utils.escapeHtml(content)}</code>
    </div>`
  }

  return defaultCodeInline(tokens, idx, options, env, slf)
}

// 全局复制函数
window.copyCode = function(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  const code = wrapper.querySelector('pre code')?.textContent || wrapper.querySelector('pre')?.textContent || ''
  navigator.clipboard.writeText(code).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

window.copyBlockquote = function(btn) {
  const wrapper = btn.closest('.blockquote-wrapper')
  const text = wrapper.querySelector('blockquote')?.textContent || ''
  navigator.clipboard.writeText(text.trim()).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

window.copyFilePath = function(btn) {
  const wrapper = btn.closest('.file-path-wrapper')
  const path = wrapper.querySelector('.file-path')?.textContent || ''
  navigator.clipboard.writeText(path).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

window.copyTable = function(btn) {
  const wrapper = btn.closest('.table-wrapper')
  const table = wrapper.querySelector('table')
  if (!table) return

  // 提取表格文本内容（按行列格式化）
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

const renderedHtml = ref('')
let _timer = null

function doRender(text) {
  cleanupInlineSvgCards()
  renderedHtml.value = stripMessageDownloadLinks(highlightMentionsInHtml(md.render(text || '')))
}

async function renderMermaid() {
  if (props.isStreaming) return
  ensureMermaid()
  const nodes = el.value?.querySelectorAll('.mermaid-block[data-src]')
  if (!nodes?.length) {
    renderInlineSvgCards()
    return
  }

  for (const node of nodes) {
    try {
      const code = decodeURIComponent(
        atob(node.dataset.src).split('').map(c =>
          '%' + c.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('')
      )
      node.textContent = code
      node.removeAttribute('data-src')
      prepareMermaidLayout(node)
    } catch {
      // 解码失败跳过
    }
  }

  try {
    await mermaid.run({
      nodes: Array.from(el.value.querySelectorAll('.mermaid-block')),
    })
    renderInlineSvgCards()
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

onUnmounted(() => {
  clearTimeout(_timer)
  cleanupInlineSvgCards()
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

.markdown-content :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px 0;
}

.markdown-content :deep(.code-copy-btn) {
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
}

.markdown-content :deep(.code-copy-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.code-copy-btn img) {
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

/* 文件路径 */
.markdown-content :deep(.file-path-wrapper) {
  position: relative;
  margin: 6px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #F9FAFB;
  border: 1px solid #d0d7de;
}

.markdown-content :deep(.file-path-header) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px 0;
}

.markdown-content :deep(.file-path) {
  display: block;
  background: transparent;
  padding: 8px 16px 12px;
  border: none;
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.875em;
  color: #1f2328;
  word-break: break-all;
}

.markdown-content :deep(.file-path-copy-btn) {
  flex-shrink: 0;
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
}

.markdown-content :deep(.file-path-copy-btn:hover) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.markdown-content :deep(.file-path-copy-btn img) {
  width: 16px;
  height: 16px;
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
