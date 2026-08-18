<template>
  <div class="editor-panel" :style="{ background: bgColor }">
    <!-- 空状态 -->
    <div v-if="!currentFile" class="editor-empty">
      <div class="editor-empty-icon">📄</div>
      <div class="editor-empty-text">选择一个文件以预览</div>
    </div>

    <!-- 文件内容区 -->
    <template v-else>
      <!-- 文件头部 -->
      <div class="editor-header">
        <span class="editor-filename" :title="currentFile.path">
          {{ fileIcon }} {{ currentFile.name }}
        </span>
        <div class="editor-actions">
          <el-tooltip v-if="isEditable && !readOnly" content="保存 (Ctrl+S)" placement="bottom" :show-after="0">
            <button class="editor-btn" :disabled="!isDirty" @click="saveFile">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
          </el-tooltip>
          <el-tooltip content="在系统中打开" placement="bottom" :show-after="0">
            <button class="editor-btn" @click="openInSystem">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          </el-tooltip>
          <el-tooltip content="关闭" placement="bottom" :show-after="0">
            <button class="editor-btn" @click="closeFile">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </el-tooltip>
        </div>
      </div>

      <!-- 预览 tabs（仅支持预览的文件类型显示） -->
      <div v-if="isPreviewable" class="preview-tabs">
        <button
          class="preview-tab"
          :class="{ active: activeTab === 'source' }"
          @click="activeTab = 'source'"
        >源文件</button>
        <button
          class="preview-tab"
          :class="{ active: activeTab === 'preview' }"
          @click="activeTab = 'preview'"
        >预览</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="editor-loading">加载中...</div>

      <!-- 错误 -->
      <div v-else-if="error" class="editor-error">{{ error }}</div>

      <!-- 图片预览 -->
      <div v-else-if="isImage" class="editor-image-preview">
        <img :src="`file://${currentFile.path}`" :alt="currentFile.name" />
      </div>

      <!-- 二进制文件 -->
      <div v-else-if="isBinary" class="editor-binary">
        <div class="editor-binary-icon">⚠️</div>
        <div>无法预览二进制文件</div>
        <button class="open-btn" @click="openInSystem">用系统程序打开</button>
      </div>

      <!-- 预览面板（iframe） -->
      <div v-else-if="isPreviewable && activeTab === 'preview'" class="editor-preview-wrap">
        <iframe
          v-if="fileExt === 'html'"
          ref="previewIframe"
          class="preview-iframe"
          :src="`file://${currentFile.path}`"
        />
        <iframe
          v-else
          ref="previewIframe"
          class="preview-iframe"
          sandbox="allow-scripts allow-same-origin"
          :srcdoc="previewHtml"
        />
      </div>

      <!-- 文本内容 -->
      <div v-else class="editor-content-wrap">
        <textarea
          v-if="isEditable && !readOnly"
          ref="textareaRef"
          class="editor-textarea"
          v-model="content"
          :style="textareaStyle"
          @keydown.ctrl.s.prevent="saveFile"
          @keydown.meta.s.prevent="saveFile"
          @input="isDirty = true"
          spellcheck="false"
        />
        <pre v-else class="editor-pre"><code>{{ content }}</code></pre>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

const props = defineProps({
  theme: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close'])

const currentFile = ref(null)
const content = ref('')
const loading = ref(false)
const error = ref('')
const isDirty = ref(false)
const readOnly = ref(false)
const textareaRef = ref(null)
const previewIframe = ref(null)
const activeTab = ref('source')

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
const EDITABLE_EXTS = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'json', 'yaml', 'yml',
  'md', 'txt', 'html', 'css', 'scss', 'less', 'sh', 'bash', 'go', 'rs',
  'java', 'cpp', 'c', 'h', 'xml', 'toml', 'ini', 'env', 'gitignore', 'dockerfile']
const PREVIEWABLE_EXTS = ['md', 'html', 'css', 'js']

const fileExt = computed(() => {
  if (!currentFile.value) return ''
  const name = currentFile.value.name
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0) return ''
  return name.substring(dotIndex + 1).toLowerCase()
})

const isImage = computed(() => IMAGE_EXTS.includes(fileExt.value))
const isEditable = computed(() => EDITABLE_EXTS.includes(fileExt.value) || !fileExt.value)
const isBinary = computed(() => !isImage.value && !isEditable.value)
const isPreviewable = computed(() => PREVIEWABLE_EXTS.includes(fileExt.value))

const bgColor = computed(() => props.theme?.background || '#1e1e1e')
const textColor = computed(() => props.theme?.foreground || '#ccc')
const fontSize = computed(() => `${props.theme?.fontSize || 13}px`)
const fontFamily = computed(() => props.theme?.fontFamily || 'monospace')

const textareaStyle = computed(() => ({
  color: textColor.value,
  fontSize: fontSize.value,
  fontFamily: fontFamily.value,
}))

const fileIcon = computed(() => {
  if (!currentFile.value) return '📄'
  const iconMap = {
    js: '📄', ts: '📄', vue: '💚', py: '🐍',
    json: '📋', md: '📝', html: '🌐', css: '🎨',
  }
  return iconMap[fileExt.value] || '📄'
})

// 生成预览 HTML
const previewHtml = computed(() => {
  if (!isPreviewable.value || !content.value) return ''
  const ext = fileExt.value

  if (ext === 'md') {
    const body = md.render(content.value)
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1f2328;
    background: #ffffff;
    padding: 14px 16px;
    max-width: 860px;
    margin: 0 auto;
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.25; margin-top: 24px; margin-bottom: 12px; color: #1f2328; }
  h1 { font-size: 2em; padding-bottom: 10px; border-bottom: 1px solid #d0d7de; }
  h2 { font-size: 1.5em; padding-bottom: 8px; border-bottom: 1px solid #d0d7de; }
  h3 { font-size: 1.25em; }
  p { margin-bottom: 14px; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 85%;
    background: #f6f8fa;
    border-radius: 4px;
    padding: 2px 6px;
    color: #c9254e;
  }
  pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; margin-bottom: 16px; line-height: 1.5; }
  pre code { background: transparent; padding: 0; color: #1f2328; font-size: 13px; }
  blockquote { border-left: 4px solid #d0d7de; color: #656d76; padding: 4px 16px; margin: 0 0 16px; }
  ul, ol { padding-left: 2em; margin-bottom: 14px; }
  li { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 13px; }
  th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) td { background: #f6f8fa; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 24px 0; }
</style>
</head>
<body>${body}</body>
</html>`
  }

  if (ext === 'css') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; background: #fff; color: #333; padding: 24px; }
  .preview-tip { color: #999; font-size: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
</style>
<style>${content.value}</style>
</head>
<body>
<p class="preview-tip">CSS 预览 — 样式应用于以下示例元素</p>
<h1>标题 H1</h1>
<h2>标题 H2</h2>
<h3>标题 H3</h3>
<p>这是一段普通正文文本，用于展示 CSS 样式效果。</p>
<a href="#">链接示例</a>
<ul><li>列表项 1</li><li>列表项 2</li><li>列表项 3</li></ul>
<button>按钮</button>
</body>
</html>`
  }

  if (ext === 'js') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'SFMono-Regular', Consolas, monospace; background: #1e1e1e; color: #d4d4d4; margin: 0; padding: 16px; font-size: 13px; }
  .header { color: #888; font-size: 11px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #333; }
  #output { white-space: pre-wrap; line-height: 1.6; }
  .log-line { padding: 2px 0; border-bottom: 1px solid #2a2a2a; }
  .log-error { color: #f48771; }
  .log-warn { color: #cca700; }
</style>
</head>
<body>
<div class="header">Console Output</div>
<div id="output"></div>
<script>
  const out = document.getElementById('output')
  function appendLine(text, cls) {
    const d = document.createElement('div')
    d.className = 'log-line' + (cls ? ' ' + cls : '')
    d.textContent = text
    out.appendChild(d)
  }
  console.log = (...args) => appendLine(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '))
  console.error = (...args) => appendLine(args.map(String).join(' '), 'log-error')
  console.warn = (...args) => appendLine(args.map(String).join(' '), 'log-warn')
  window.onerror = (msg, src, line) => appendLine('Error: ' + msg + ' (line ' + line + ')', 'log-error')
  try { ${content.value} } catch(e) { appendLine('Error: ' + e.message, 'log-error') }
<\/script>
</body>
</html>`
  }

  return ''
})

watch(() => currentFile.value, () => {
  activeTab.value = 'source'
})

async function openFile(node) {
  if (isDirty.value) {
    const ok = confirm(`文件 ${currentFile.value?.name} 有未保存的更改，是否放弃？`)
    if (!ok) return
  }

  currentFile.value = node
  content.value = ''
  error.value = ''
  isDirty.value = false
  loading.value = true
  activeTab.value = 'source'

  try {
    if (!isImage.value && !isBinary.value) {
      const text = await window.electronAPI.fs.readFile(node.path, 'utf8')
      content.value = text
    }
  } catch (err) {
    error.value = `无法读取文件: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function saveFile() {
  if (!currentFile.value || !isDirty.value) return
  try {
    await window.electronAPI.fs.writeFile(currentFile.value.path, content.value, 'utf8')
    isDirty.value = false
  } catch (err) {
    alert(`保存失败: ${err.message}`)
  }
}

function openInSystem() {
  if (!currentFile.value) return
  window.electronAPI.openPath(currentFile.value.path)
}

function closeFile() {
  if (isDirty.value) {
    const ok = confirm(`文件 ${currentFile.value?.name} 有未保存的更改，是否放弃？`)
    if (!ok) return
  }
  currentFile.value = null
  content.value = ''
  isDirty.value = false
  emit('close')
}

defineExpose({ openFile })
</script>

<style scoped>
.editor-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #555;
}

.editor-empty-icon { font-size: 36px; }
.editor-empty-text { font-size: 13px; }

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
}

.editor-filename {
  font-size: 13px;
  color: #ccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.editor-btn {
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.editor-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.editor-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.preview-tabs {
  display: flex;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.15);
  padding: 0 12px;
}

.preview-tab {
  padding: 6px 14px;
  font-size: 12px;
  color: #888;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.preview-tab:hover { color: #ccc; }

.preview-tab.active {
  color: #fff;
  border-bottom-color: #436FF6;
}

.editor-loading,
.editor-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #666;
}

.editor-error { color: #e06c75; }

.editor-image-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
}

.editor-image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.editor-binary {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #888;
  font-size: 13px;
}

.editor-binary-icon { font-size: 32px; }

.open-btn {
  padding: 6px 14px;
  background: #0078d4;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.open-btn:hover { background: #1a8fe3; }

.editor-preview-wrap {
  flex: 1;
  overflow: hidden;
  background: #fff;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.editor-content-wrap {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  box-sizing: border-box;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow: auto;
  line-height: 1.6;
}

.editor-pre {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #ccc;
  line-height: 1.6;
  white-space: pre;
  overflow-wrap: normal;
}
</style>
