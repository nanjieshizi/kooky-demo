<template>
  <div class="sfb">
    <!-- 加载中 -->
    <div v-if="treeLoading" class="sfb__loading">
      <div class="sfb__spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="treeError" class="sfb__empty">
      <img src="@/assets/home/noPreview.png" class="sfb__placeholder-img" alt="" />
      <p>加载文件列表失败</p>
    </div>

    <!-- 无文件 -->
    <div v-else-if="!treeNodes.length" class="sfb__empty">
      <p>暂无文件</p>
    </div>

    <!-- 主体：左树 + 右预览 -->
    <div v-else class="sfb__body">
      <!-- 左侧文件树 -->
      <div class="sfb__tree-panel">
        <div class="sfb__tree-header">
          <span>文件</span>
          <span class="sfb__tree-count"><span class="num">{{ flatFileCount }}</span>个</span>
        </div>
        <div class="sfb__tree-list">
          <SfbTreeNode
            v-for="node in treeNodes"
            :key="node.path"
            :node="node"
            :selected-path="selectedPath"
            @select="handleSelectFile"
          />
        </div>
      </div>

      <!-- 右侧预览 -->
      <div class="sfb__preview-panel">
        <!-- 未选中 -->
        <div v-if="!selectedPath" class="sfb__preview-empty">
          <p>选择左侧文件查看内容</p>
        </div>

        <!-- 内容加载中 -->
        <div v-else-if="contentLoading" class="sfb__preview-loading">
          <div class="sfb__spinner"></div>
          <span>加载中...</span>
        </div>

        <!-- 内容加载失败 -->
        <div v-else-if="contentError" class="sfb__preview-empty">
          <p>{{ contentError }}</p>
        </div>

        <!-- 有内容 -->
        <template v-else>
          <!-- 文件名栏 -->
          <div class="sfb__preview-header">
            <img :src="selectedFileIcon" class="sfb__preview-icon" alt="" />
            <span class="sfb__preview-name" :title="selectedPath">{{ selectedFileName }}</span>
            <!-- <span v-if="selectedExt" class="sfb__preview-ext">{{ selectedExt }}</span> -->
          </div>

          <!-- 图片 -->
          <div v-if="isImage" class="sfb__preview-image-wrap">
            <img :src="imageDataUrl" class="sfb__preview-image" :alt="selectedFileName" />
          </div>

          <!-- Markdown -->
          <iframe
            v-else-if="selectedExt === 'md'"
            :srcdoc="mdHtml"
            class="sfb__preview-iframe"
            sandbox="allow-scripts allow-same-origin"
          />

          <!-- 文本/代码 -->
          <div v-else-if="isText" class="sfb__preview-text-wrap">
            <pre class="sfb__preview-code"><code>{{ fileContent }}</code></pre>
          </div>

          <!-- 不支持 -->
          <div v-else class="sfb__preview-empty">
            <img src="@/assets/home/noPreview.png" class="sfb__placeholder-img" alt="" />
            <p>当前文件不可预览</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, defineComponent, h } from 'vue'
import MarkdownIt from 'markdown-it'
import { fetchSkillFileTree, fetchSkillFileContent } from '@/modules/market/skill/skillMarketApi'
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'

// ── 内部文件树节点组件 ──────────────────────────────────────
const SfbTreeNode = defineComponent({
  name: 'SfbTreeNode',
  props: {
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    selectedPath: { type: String, default: '' },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const isExpanded = ref(props.depth === 0)
    const isDir = computed(() => props.node.type === 'directory' || !!props.node.children?.length)
    const isSelected = computed(() => !isDir.value && props.selectedPath === props.node.path)

    const iconSrc = computed(() => {
      if (isDir.value) return folderIcon
      const name = props.node.name || ''
      const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
      if (ext === 'md') return mdIcon
      const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'go', 'java', 'cpp', 'c', 'h', 'cs', 'sh', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'sql', 'pyc']
      if (codeExts.includes(ext)) return codeIcon
      const richExts = ['docx', 'doc', 'pdf', 'rtf', 'odt']
      if (richExts.includes(ext)) return richTextIcon
      const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']
      if (imgExts.includes(ext)) return pictureIcon
      return textIcon
    })

    function handleClick() {
      if (isDir.value) {
        isExpanded.value = !isExpanded.value
      } else {
        emit('select', props.node)
      }
    }

    return () => {
      const rowStyle = { paddingLeft: `${props.depth * 16 + 8}px` }
      const rowClass = ['sfb-node-row', isSelected.value && 'is-selected', isDir.value && 'is-dir'].filter(Boolean).join(' ')

      const children = isDir.value && isExpanded.value && props.node.children?.length
        ? props.node.children.map(child =>
            h(SfbTreeNode, {
              key: child.path,
              node: child,
              depth: props.depth + 1,
              selectedPath: props.selectedPath,
              onSelect: (n) => emit('select', n),
            })
          )
        : []

      return h('div', { class: 'sfb-node' }, [
        h('div', { class: rowClass, style: rowStyle, onClick: handleClick }, [
          // 展开箭头
          h('span', { class: ['sfb-node-arrow', !isDir.value && 'invisible'].filter(Boolean).join(' ') }, [
            h('svg', {
              width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none',
              class: isExpanded.value ? 'expanded' : '',
            }, [
              h('path', { d: 'M4 3l4 3-4 3', stroke: '#91949E', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
            ]),
          ]),
          // 图标
          h('img', { src: iconSrc.value, class: 'sfb-node-icon', alt: '' }),
          // 文件名
          h('span', { class: 'sfb-node-name', title: props.node.name }, props.node.name),
        ]),
        ...children,
      ])
    }
  },
})

// ── Props ──────────────────────────────────────────────────
const props = defineProps({
  slug: { type: String, default: '' },
  version: { type: String, default: '' },
  /** 本地模式：直接传入 zip File 对象，组件内部解析 */
  zipFile: { type: Object, default: null },
})

// ── Markdown ───────────────────────────────────────────────
const md = new MarkdownIt({ html: false, linkify: true })

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
const TEXT_EXTS = new Set([
  'md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'vue', 'svelte',
  'py', 'go', 'rs', 'rb', 'java', 'cpp', 'c', 'h', 'cs', 'sh',
  'json', 'yaml', 'yml', 'xml', 'toml', 'ini',
  'css', 'scss', 'less', 'html', 'htm', 'sql', 'graphql',
])

// ── 文件树状态 ─────────────────────────────────────────────
const rawFiles = ref([])
const treeLoading = ref(false)
const treeError = ref(false)

// ── 本地 zip 解析后的 JSZip 实例 ──────────────────────────
let zipInstance = null

// ── 文件内容状态 ───────────────────────────────────────────
const selectedPath = ref('')
const fileContent = ref('')
const imageDataUrl = ref('')
const mdHtml = ref('')
const contentLoading = ref(false)
const contentError = ref('')

// ── 构建嵌套树 ─────────────────────────────────────────────
function buildNestedTree(files) {
  const root = []
  const nodeMap = new Map()

  // 收集所有目录路径
  const dirs = new Set()
  for (const f of files) {
    const parts = f.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'))
    }
  }

  // 创建目录节点
  for (const dir of dirs) {
    const name = dir.split('/').pop() || dir
    nodeMap.set(dir, { name, path: dir, type: 'directory', children: [] })
  }

  // 添加文件节点（跳过目录类型和空名称条目）
  for (const f of files) {
    if (f.type === 'directory') continue
    const parts = f.path.split('/')
    const name = parts[parts.length - 1]
    if (!name) continue  // 路径以 / 结尾的显式目录条目
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null
    const fileNode = { name, path: f.path, type: 'file', size: f.size, contentType: f.contentType }
    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath).children.push(fileNode)
    } else {
      root.push(fileNode)
    }
  }

  // 将目录挂到父目录或根
  for (const dir of dirs) {
    const parts = dir.split('/')
    if (parts.length === 1) {
      const node = nodeMap.get(dir)
      if (node) root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      const node = nodeMap.get(dir)
      if (parent && node) parent.children.push(node)
    }
  }

  // 排序：目录在前，按名称排序
  function sort(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children) sort(n.children)
    }
  }
  sort(root)
  return root
}

const treeNodes = computed(() => buildNestedTree(rawFiles.value))

function countFiles(nodes) {
  let n = 0
  for (const node of nodes) {
    if (node.type === 'directory') n += countFiles(node.children || [])
    else n++
  }
  return n
}
const flatFileCount = computed(() => rawFiles.value.filter(f => f.type === 'file').length)

// ── 选中文件的派生状态 ─────────────────────────────────────
const selectedFileName = computed(() => {
  if (!selectedPath.value) return ''
  const parts = selectedPath.value.split('/')
  return parts[parts.length - 1] || selectedPath.value
})

const selectedExt = computed(() => {
  const name = selectedFileName.value
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
})

const isImage = computed(() => IMAGE_EXTS.has(selectedExt.value))
const isText = computed(() => TEXT_EXTS.has(selectedExt.value))

const selectedFileIcon = computed(() => {
  if (!selectedFileName.value) return textIcon
  const ext = selectedExt.value
  if (ext === 'md') return mdIcon
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'go', 'java', 'cpp', 'c', 'h', 'cs', 'sh', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'sql', 'pyc']
  if (codeExts.includes(ext)) return codeIcon
  const richExts = ['docx', 'doc', 'pdf', 'rtf', 'odt']
  if (richExts.includes(ext)) return richTextIcon
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']
  if (imgExts.includes(ext)) return pictureIcon
  return textIcon
})

// ── 加载文件树 ─────────────────────────────────────────────
async function loadTree() {
  // 本地 zip 模式
  if (props.zipFile) {
    zipInstance = null
    rawFiles.value = []
    selectedPath.value = ''
    treeLoading.value = true
    treeError.value = false
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(props.zipFile)
      zipInstance = zip
      const files = []
      zip.forEach((relativePath, entry) => {
        // 过滤掉显式目录条目（以 / 结尾 或 entry.dir），目录由 buildNestedTree 从路径推导
        if (entry.dir || relativePath.endsWith('/')) return
        files.push({ path: relativePath, type: 'file' })
      })
      rawFiles.value = files
      const firstFile = files[0]
      if (firstFile) handleSelectFile({ path: firstFile.path, name: firstFile.path.split('/').pop() })
    } catch {
      treeError.value = true
    } finally {
      treeLoading.value = false
    }
    return
  }

  if (!props.slug) return
  zipInstance = null
  treeLoading.value = true
  treeError.value = false
  rawFiles.value = []
  selectedPath.value = ''
  try {
    const res = await fetchSkillFileTree(props.slug, props.version || undefined)
    rawFiles.value = res.files || []
    const firstFile = res.files?.find(f => f.type === 'file')
    if (firstFile) handleSelectFile({ path: firstFile.path, name: firstFile.path.split('/').pop() })
  } catch {
    treeError.value = true
  } finally {
    treeLoading.value = false
  }
}

// ── 点击文件节点 ───────────────────────────────────────────
async function handleSelectFile(node) {
  if (selectedPath.value === node.path) return
  selectedPath.value = node.path
  fileContent.value = ''
  imageDataUrl.value = ''
  mdHtml.value = ''
  contentError.value = ''
  contentLoading.value = true

  try {
    let text
    if (zipInstance) {
      // 本地 zip 模式：从 JSZip 实例读取
      const entry = zipInstance.file(node.path)
      if (!entry) throw new Error('文件不存在')
      const ext = node.path.slice(node.path.lastIndexOf('.') + 1).toLowerCase()
      if (IMAGE_EXTS.has(ext)) {
        const base64 = await entry.async('base64')
        text = `data:image/${ext};base64,${base64}`
      } else {
        text = await entry.async('string')
      }
    } else {
      text = await fetchSkillFileContent(props.slug, node.path, props.version || undefined)
    }
    if (isImage.value) {
      imageDataUrl.value = text.startsWith('data:') || text.startsWith('http') ? text : `data:image/${selectedExt.value};base64,${text}`
    } else if (selectedExt.value === 'md') {
      fileContent.value = text
      mdHtml.value = buildMdHtml(text)
    } else {
      fileContent.value = text
    }
  } catch (e) {
    contentError.value = '加载失败：' + (e?.message || '未知错误')
  } finally {
    contentLoading.value = false
  }
}

function buildMdHtml(raw) {
  const body = md.render(raw)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
  padding: 20px 24px;
  line-height: 1.7;
  color: #2F3547;
  font-size: 14px;
  margin: 0;
}
h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.2em 0 0.5em; }
code {
  background: #F5F6F9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Monaco","Menlo","Consolas",monospace;
  font-size: 13px;
}
pre { background: #F5F6F9; padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
a { color: #FF684E; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote { border-left: 3px solid #DFE2EA; margin: 0; padding: 4px 16px; color: #91949E; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ECEEF3; padding: 8px 12px; text-align: left; }
th { background: #F5F6F9; }
img { max-width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`
}

// ── 监听 slug / version / zipFile 变化重新加载 ────────────
watch([() => props.slug, () => props.version, () => props.zipFile], loadTree, { immediate: true })
</script>

<style lang="scss" scoped>
.sfb {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

// 加载 / 空状态
.sfb__loading,
.sfb__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #91949E;
  font-size: 13px;
}

.sfb__placeholder-img {
  width: 80px;
  height: 80px;
  opacity: 0.5;
  object-fit: contain;
}

.sfb__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #ECEEF3;
  border-top-color: #FF684E;
  border-radius: 50%;
  animation: sfb-spin 0.8s linear infinite;
}

@keyframes sfb-spin {
  to { transform: rotate(360deg); }
}

// 主体布局
.sfb__body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid #ECEEF3;
  border-radius: 8px;
}

// ── 左侧文件树 ──────────────────────────────────────────────
.sfb__tree-panel {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid #ECEEF3;
  display: flex;
  flex-direction: column;
  // background: #FAFAFA;
  background: #ffffff;
}

.sfb__tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  border-bottom: 1px solid #ECEEF3;
  flex-shrink: 0;
  height: 40px;
}

.sfb__tree-count {
  font-weight: normal;
  color: #91949E;
  .num{
    font-size: 14px;
    color: #FF621F;
    margin-right: 5px;
  }
}

.sfb__tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

// ── 右侧预览 ────────────────────────────────────────────────
.sfb__preview-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F9FAFB;
}

.sfb__preview-empty,
.sfb__preview-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #91949E;
  font-size: 13px;
}

.sfb__preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0px 16px;
  border-bottom: 1px solid #ECEEF3;
  flex-shrink: 0;
  height: 40px;
}

.sfb__preview-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sfb__preview-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfb__preview-ext {
  font-size: 11px;
  color: #91949E;
  background: #F5F6F9;
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.sfb__preview-image-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
}

.sfb__preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sfb__preview-iframe {
  flex: 1;
  border: none;
  width: 100%;
}

.sfb__preview-text-wrap {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
}

.sfb__preview-code {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #2F3547;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

<style lang="scss">
// 文件树节点（非 scoped，因为节点由 render 函数动态生成）
.sfb-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 8px;
  padding-right: 8px;
  transition: background 0.1s;

  &:hover {
    background: #F0F1F5;
  }

  &.is-selected {
    // background: #FFF1EA;
    background: #F0F1F5;
  }
}

.sfb-node-arrow {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &.invisible {
    visibility: hidden;
  }

  svg {
    transition: transform 0.15s;
    &.expanded { transform: rotate(90deg); }
  }
}

.sfb-node-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.sfb-node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #2F3547;
}
</style>
