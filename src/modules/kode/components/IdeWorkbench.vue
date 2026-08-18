<script setup>
import { inject, computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'
import crabMascot from '@/assets/crab-pixel.png'

/**
 * IDE 模式工作台 · VSCode 高保真还原
 *
 * 只负责「IDE」这一块(KodeView 标签条选中「IDE」时的中间工作区)。
 * 右侧 Kode 对话柱由 KodeView 的 <aside> 渲染,不在本组件内。
 *
 *   ┌─────────┬────────────────────────────────────────┐
 *   │ 侧栏     │ Breadcrumb                            │
 *   │ (Trae 式 ├───────────────────────────────────────┤
 *   │  图标并 │ Tab Bar                               │
 *   │  入顶部)├──────────────────────┬───Mini─────────┤
 *   │ 资源/搜 │ 代码 + 问题指示      │ map            │
 *   │ 索/Git/ │                      │                │
 *   │ 大纲    │                      │                │
 *   ├─────────┴──────────────────────┴────────────────┤
 *   │ 状态栏:🌿 分支 ↑↓ · ⚠ 警告 · ✕ 错误 · 行/列 · UTF-8 │
 *   └──────────────────────────────────────────────────┘
 *
 * 快捷键: ⌘P 文件搜索 · ⌘⇧P 命令面板 · ESC 关闭
 * 终端走 KodeView 顶部的「CLI」标签页(IDE 内不再自带终端面板)
 * 文件预览走全局共享预览区(previewStore),不在 IDE 内开面板
 */

const state = inject(KODE_STATE_KEY)
const { selectedTask, workspaces, openPreviewTab } = state

const ws = computed(
  () => workspaces.value.find((w) => w.id === selectedTask.value?.wsId) || null,
)

// ═════════════════ 文件树 + Git 状态 ═════════════════
const files = [
  { name: 'src', icon: '📁', depth: 0, isFolder: true },
  { name: 'components', icon: '📁', depth: 1, isFolder: true },
  { name: 'MessageList.vue', icon: '⚡', depth: 2, fileId: 'MessageList.vue', git: 'M' },
  { name: 'MessageRow.vue', icon: '⚡', depth: 2, fileId: 'MessageRow.vue' },
  { name: 'composables', icon: '📁', depth: 1, isFolder: true },
  { name: 'useInfiniteScroll.ts', icon: '🇹', depth: 2, fileId: 'useInfiniteScroll.ts', git: 'A' },
  { name: 'App.vue', icon: '⚡', depth: 0, fileId: 'App.vue' },
  { name: 'index.html', icon: '🌐', depth: 0, fileId: 'index.html', git: 'A' },
  { name: 'package.json', icon: '📋', depth: 0, fileId: 'package.json' },
  { name: 'README.md', icon: '📝', depth: 0, fileId: 'README.md' },
]

// ═════════════════ 合并侧栏（Trae 式：活动栏图标并入侧栏顶部，点切视图）═══════
// 省掉独立竖活动栏，一栏既选视图又看内容
// 图标集 = VSCode 活动栏原生 5 项（账户 / 设置齿轮砍掉：第二套账户 + 外观跟 Kooky 走）
// ⚠️ 大纲 / 时间线不在这里 —— 它们是资源管理器内部的折叠面板（VSCode 原生位置）
const SIDEBAR_VIEWS = [
  { key: 'explorer', icon: '🗂', title: '资源管理器' },
  { key: 'search', icon: '🔍', title: '搜索' },
  { key: 'git', icon: '⑂', title: '源代码管理' },
  { key: 'debug', icon: '🐞', title: '运行和调试' },
  { key: 'extensions', icon: '🧩', title: '扩展' },
]
const sidebarView = ref('explorer')
const sidebarTitle = computed(() => SIDEBAR_VIEWS.find((v) => v.key === sidebarView.value)?.title || '')
// Git 改动 = 文件树里带 git 标记的
const gitFiles = computed(() => files.filter((f) => f.git))

// ─── 资源管理器底部：大纲 / 时间线（VSCode 原生就在这，默认折叠）───
const outlineOpen = ref(false)
const timelineOpen = ref(false)
// 大纲（mock：当前文件的符号树）
const outlineItems = [
  { icon: '◇', name: 'template', depth: 0 },
  { icon: 'ƒ', name: 'setup()', depth: 0 },
  { icon: '▢', name: 'props.messages', depth: 1 },
  { icon: 'ƒ', name: 'onScroll()', depth: 1 },
  { icon: 'ƒ', name: 'loadNextPage()', depth: 1 },
  { icon: '◇', name: 'style', depth: 0 },
]
// 时间线（mock：git 提交历史 + 本地编辑历史）
const timelineItems = [
  { icon: '⑂', name: 'feat: 接入虚拟滚动', meta: 'Kode · 12 分钟前' },
  { icon: '⑂', name: 'refactor: 抽出分页 composable', meta: '孟世一 · 2 小时前' },
  { icon: '○', name: '已保存', meta: '本地历史 · 3 小时前' },
  { icon: '⑂', name: 'init: 消息列表骨架', meta: '孟世一 · 昨天' },
]

// 搜索（mock）
const searchInput = ref('')
const searchHits = [
  { file: 'MessageList.vue', line: 3, text: '<VirtualScroller :items="messages" :height="48">' },
  { file: 'useInfiniteScroll.ts', line: 12, text: 'const pageSize = 30 // 按需加载' },
  { file: 'MessageRow.vue', line: 8, text: 'defineProps([\'msg\'])' },
]

// ─── 运行和调试（mock：未启动会话的静态形态）───
const debugConfigs = ['启动 Electron 主进程', '附加到 Vite Dev Server']
const debugConfig = ref(debugConfigs[0])
const debugSections = [
  { key: 'vars', title: '变量', empty: '未在调试中' },
  { key: 'watch', title: '监视', empty: '尚未添加表达式' },
  { key: 'callstack', title: '调用堆栈', empty: '未在调试中' },
]
const breakpoints = [
  { file: 'MessageList.vue', line: 12, on: true },
  { file: 'useInfiniteScroll.ts', line: 30, on: false },
]

// ─── 扩展（mock：已装列表；Pata 拍板先保留扩展）───
const extSearch = ref('')
const extensions = [
  { name: 'Vue - Official', pub: 'Vue', desc: 'Vue 3 语言支持', on: true },
  { name: 'ESLint', pub: 'Microsoft', desc: '代码规范检查', on: true },
  { name: 'Python', pub: 'Microsoft', desc: '调试适配器 + 语言服务', on: true },
  { name: 'Prettier', pub: 'Prettier', desc: '代码格式化', on: false },
]

// ═════════════════ 底部面板：问题 / 输出 / 调试控制台 ═════════════════
// 终端不在这（走 Kode 顶部的 CLI 标签页）；Debug Console / Ports 见 PRD 区域 8
const bottomOpen = ref(false)
const bottomTab = ref('problems')
const BOTTOM_TABS = [
  { key: 'problems', label: '问题' },
  { key: 'output', label: '输出' },
  { key: 'debug', label: '调试控制台' },
]
const outputChannel = ref('Git')
// ⚠️ 没有「任务」频道：VSCode 的任务系统(tasks.json / ⇧⌘B)跟着终端一起砍了 ——
//    任务的本质是跑命令，跟 CLI 标签页冲突；而且它依赖集成终端，终端没了它也跑不起来。
//    剩下的都是 VSCode 自身的内部日志频道，不冲突也能用，留着零成本（用户不切就看不到）。
const OUTPUT_CHANNELS = ['Git', '窗口', '扩展主机']
// Git 频道 mock —— git 报错时用户唯一能看到原始 stderr 的地方
const outputLines = [
  '> git status --porcelain',
  '> git checkout feature/kode-prompt-chips',
  "error: Your local changes to the following files would be overwritten by checkout:",
  '        src/views/messages/MessageList.vue',
  'Please commit your changes or stash them before you switch branches.',
]
// 调试控制台只在调试会话活着时才有内容（没会话 = 空态，不是永远挂着 mock）
const debugSession = ref(false)
const debugConsoleLines = [
  { type: 'out', text: '[vite] connected.' },
  { type: 'out', text: 'messages loaded: 30' },
]
const debugConsoleInput = ref('')
function toggleBottom(tab) {
  if (bottomOpen.value && bottomTab.value === tab) { bottomOpen.value = false; return }
  bottomTab.value = tab
  bottomOpen.value = true
}

// ─── 面板高度：可拖 + 可最大化（VSCode 原生行为，不冲突也能用）───
const BOTTOM_MIN = 120
const BOTTOM_MAX = 560
const bottomHeight = ref(200)
const bottomMax = ref(false)
const isResizingBottom = ref(false)
let _bDrag = { startY: 0, startH: 0 }
function onBottomResizeStart(e) {
  _bDrag = { startY: e.clientY, startH: bottomHeight.value }
  isResizingBottom.value = true
  window.addEventListener('mousemove', onBottomResizeMove)
  window.addEventListener('mouseup', onBottomResizeEnd)
  document.body.style.userSelect = 'none'
}
function onBottomResizeMove(e) {
  const dy = _bDrag.startY - e.clientY
  bottomHeight.value = Math.max(BOTTOM_MIN, Math.min(BOTTOM_MAX, _bDrag.startH + dy))
}
function onBottomResizeEnd() {
  isResizingBottom.value = false
  window.removeEventListener('mousemove', onBottomResizeMove)
  window.removeEventListener('mouseup', onBottomResizeEnd)
  document.body.style.userSelect = ''
}

// ─── 问题面板：筛选 + 严重程度过滤 + 按文件分组（VSCode 原生形态）───
const problemFilter = ref('')
const problemSeverity = ref('all') // all | error | warning

// ═════════════════ 编辑器 Tab + 代码 ═════════════════
const editorTabs = ref([
  { id: 'MessageList.vue', label: 'MessageList.vue', icon: '⚡', dirty: true },
  { id: 'index.html', label: 'index.html', icon: '🌐' },
])
const activeTabId = ref('MessageList.vue')
function setActiveTab(id) {
  activeTabId.value = id
  if (id && !editorTabs.value.find((t) => t.id === id)) {
    const file = files.find((f) => f.fileId === id)
    if (file) editorTabs.value.push({ id, label: file.name, icon: file.icon })
  }
}
function closeTab(id, e) {
  e.stopPropagation()
  const idx = editorTabs.value.findIndex((t) => t.id === id)
  if (idx < 0) return
  editorTabs.value.splice(idx, 1)
  if (activeTabId.value === id) {
    activeTabId.value = editorTabs.value[Math.max(0, idx - 1)]?.id || ''
  }
}

// 代码内容 mock
const codeContent = {
  'MessageList.vue': [
    '<template>',
    '  <section class="message-list">',
    '    <VirtualScroller :items="messages" :height="48">',
    '      <template #item="{ row }">',
    '        <MessageRow :msg="row" />',
    '      </template>',
    '    </VirtualScroller>',
    '  </section>',
    '</template>',
    '',
    '<script setup>',
    "import VirtualScroller from '@/ui/VirtualScroller.vue'",
    "import MessageRow from './MessageRow.vue'",
    '',
    "const props = defineProps(['messages'])",
    '<\/script>',
  ],
  'index.html': [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <title>Demo Preview</title>',
    '</head>',
    '<body>',
    '  <h1>🚀 Demo</h1>',
    '  <button onclick="alert(\'Hi\')">点我</button>',
    '</body>',
    '</html>',
  ],
}
const currentCode = computed(() => codeContent[activeTabId.value] || ['(空文件)'])

// ─── 空白页(VSCode 叫 Watermark)：全部标签页关掉时的品牌形象 + 快捷键指引 ───
// ⚠️ 快捷键这列是占位：等 Pata 梳理完保留哪些键位再定稿
//    「打开设置 ⌘,」有意不列 —— 设置已砍（外观跟 Kooky 走）
const hasOpenTab = computed(() => editorTabs.value.length > 0)
const watermarkKeys = [
  { label: '显示所有命令', keys: ['⇧', '⌘', 'P'] },
  { label: '转到文件', keys: ['⌘', 'P'] },
  { label: '在文件中查找', keys: ['⇧', '⌘', 'F'] },
  { label: '开始调试', keys: ['F5'] },
]

// Breadcrumb 路径(mock)
const breadcrumb = computed(() => {
  const map = {
    'MessageList.vue': ['src', 'components', 'MessageList.vue'],
    'MessageRow.vue': ['src', 'components', 'MessageRow.vue'],
    'useInfiniteScroll.ts': ['src', 'composables', 'useInfiniteScroll.ts'],
    'App.vue': ['src', 'App.vue'],
    'index.html': ['index.html'],
    'package.json': ['package.json'],
    'README.md': ['README.md'],
  }
  return map[activeTabId.value] || [activeTabId.value || '']
})

// 行内问题指示(mock)
const codeIssues = {
  'MessageList.vue': [
    { line: 3, type: 'warning', text: 'VirtualScroller 隐式 any 类型' },
    { line: 12, type: 'error', text: "Cannot find module '@/ui/VirtualScroller.vue'" },
  ],
}
function issuesByLine(line) {
  return (codeIssues[activeTabId.value] || []).filter((i) => i.line === line)
}
// 底部「问题」面板 = 全工作区诊断，与编辑器行内波浪线同一份数据
const problemList = computed(() =>
  Object.entries(codeIssues).flatMap(([file, list]) =>
    list.map((i) => ({ file, ...i })),
  ),
)
// 过滤后按文件分组（VSCode 是树：文件 → 该文件下的问题）
const groupedProblems = computed(() => {
  const q = problemFilter.value.trim().toLowerCase()
  const hit = problemList.value.filter((p) => {
    if (problemSeverity.value !== 'all' && p.type !== problemSeverity.value) return false
    if (q && !p.text.toLowerCase().includes(q) && !p.file.toLowerCase().includes(q)) return false
    return true
  })
  const byFile = new Map()
  hit.forEach((p) => {
    if (!byFile.has(p.file)) byFile.set(p.file, [])
    byFile.get(p.file).push(p)
  })
  return [...byFile.entries()].map(([file, items]) => ({ file, items }))
})
const problemHitCount = computed(() => groupedProblems.value.reduce((n, g) => n + g.items.length, 0))

// IDE 内任何「在预览中打开」(文件卡 / 右键 / 命令面板)→ 全局共享预览区
// 与「我的分身」点附件卡是同一个入口(previewStore)
function openPreview() { openPreviewTab({ name: 'index.html', icon: '🌐' }) }

// ═════════════════ 右键菜单 ═════════════════
const ctxMenu = ref({ visible: false, x: 0, y: 0, source: null, payload: null })
function openContextMenu(e, source, payload) {
  e.preventDefault()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, source, payload }
}
function closeContextMenu() { ctxMenu.value.visible = false }
function ctxPreview() { openPreview(); closeContextMenu() }
function ctxOpenInEditor() {
  const f = ctxMenu.value.payload
  if (f?.fileId) setActiveTab(f.fileId)
  closeContextMenu()
}

// ═════════════════ 状态栏数据 ═════════════════
const cursorPos = ref({ line: 5, col: 14 })

// ─── 状态栏 Quick Pick ───────────────────────────────────────────
// VSCode 里状态栏几乎每一项都是按钮。我们「换肤」之后原生点击行为全没了，
// 所以这里把它们复刻回来 —— 否则状态栏就是一条只能看的装饰。
const sbPick = ref(null) // { title, items?, input? }
function openSbPick(cfg) { sbPick.value = cfg }
function closeSbPick() { sbPick.value = null }

const BRANCHES = ['main', 'dev', 'feature/kode-prompt-chips', 'feature/virtual-scroll']
// 分支：VSCode 里状态栏是切分支的主入口，换肤后必须自己实现
function pickBranch() {
  const cur = ws.value?.branch || 'main'
  openSbPick({
    title: '切换分支',
    items: [
      { label: '＋ 创建新分支…', accent: true },
      ...BRANCHES.map((b) => ({ label: b, hint: b === cur ? '当前' : '' })),
    ],
  })
}
function pickIndent() {
  openSbPick({
    title: '缩进',
    // ⚠️ 有意不含「按语言配置缩进」——那条会跳设置页，而设置已砍（外观跟 Kooky 走）→ 死链
    items: [
      { label: '使用空格缩进' },
      { label: '使用制表符缩进' },
      { label: '更改缩进大小…' },
      { label: '按缩进重新检测' },
    ],
  })
}
function pickEncoding() {
  openSbPick({ title: '选择编码', items: [{ label: 'UTF-8', hint: '当前' }, { label: 'UTF-8 with BOM' }, { label: 'GBK' }, { label: 'ISO 8859-1' }] })
}
function pickEol() {
  openSbPick({ title: '选择行尾序列', items: [{ label: 'LF', hint: '当前' }, { label: 'CRLF' }] })
}
function pickLang() {
  openSbPick({ title: '选择语言模式', items: [{ label: 'Vue', hint: '当前' }, { label: 'TypeScript' }, { label: 'HTML' }, { label: 'JSON' }, { label: 'Markdown' }] })
}
function gotoLine() {
  openSbPick({ title: '转到行', input: '输入行号，如 30' })
}
// 错误警告数 → 开问题面板。
// ⚠️ 这条是补窟窿不是锦上添花：我们砍了标题栏菜单和 Layout Ctrl，
//    VSCode 原本 6 个唤起入口去了 2 个，这是剩下的唯一鼠标入口。
function openProblems() {
  bottomTab.value = 'problems'
  bottomOpen.value = true
}
const errorCount = computed(
  () => (codeIssues[activeTabId.value] || []).filter((i) => i.type === 'error').length,
)
const warningCount = computed(
  () => (codeIssues[activeTabId.value] || []).filter((i) => i.type === 'warning').length,
)
const gitChanges = computed(() => {
  const m = files.filter((f) => f.git === 'M').length
  const a = files.filter((f) => f.git === 'A').length
  return { m, a, total: m + a }
})

// ═════════════════ 命令面板 / 文件搜索 ═════════════════
const cmdPaletteOpen = ref(false)
const fileSearchOpen = ref(false)
const cmdInput = ref('')
const fileSearchInput = ref('')

const commands = [
  { id: 'preview', icon: '🌐', label: '在预览中打开', shortcut: '', action: () => { openPreview(); closeCmdPalette() } },
  { id: 'newfile', icon: '📄', label: '新建文件', shortcut: '⌘N' },
  { id: 'split', icon: '⫶', label: '拆分编辑器', shortcut: '⌘\\' },
  { id: 'format', icon: '✨', label: '格式化文档', shortcut: '⇧⌥F' },
  { id: 'commit', icon: '🌿', label: 'Git: 提交', shortcut: '' },
  { id: 'goto', icon: '📍', label: '转到行', shortcut: '⌃G' },
]
const filteredCommands = computed(() => {
  const q = cmdInput.value.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => c.label.toLowerCase().includes(q))
})
const filteredFiles = computed(() => {
  const q = fileSearchInput.value.trim().toLowerCase()
  const list = files.filter((f) => f.fileId)
  if (!q) return list
  return list.filter((f) => f.name.toLowerCase().includes(q))
})
function openCmdPalette() { cmdPaletteOpen.value = true; cmdInput.value = '' }
function closeCmdPalette() { cmdPaletteOpen.value = false }
function openFileSearch() { fileSearchOpen.value = true; fileSearchInput.value = '' }
function closeFileSearch() { fileSearchOpen.value = false }
function executeCommand(c) {
  if (c.action) c.action()
  closeCmdPalette()
}
function jumpToFile(f) {
  setActiveTab(f.fileId)
  closeFileSearch()
}

// 键盘监听
function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault()
    openCmdPalette()
  } else if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault()
    openFileSearch()
  } else if (e.key === 'Escape') {
    cmdPaletteOpen.value = false
    fileSearchOpen.value = false
    sbPick.value = null
    closeContextMenu()
  }
}

// 生命周期
onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  // 拖底部面板高度时切走标签页 → 监听会留在 window 上，这里兜底摘掉
  window.removeEventListener('mousemove', onBottomResizeMove)
  window.removeEventListener('mouseup', onBottomResizeEnd)
  document.body.style.userSelect = ''
})
</script>

<template>
  <div class="ide-root" @click="closeContextMenu">
    <!-- 顶部条已上移到 KodeView 统一固定条(切换不动) -->

    <!-- ════ 主区 ════ -->
    <div class="ide-main">
      <!-- 合并侧栏：顶部横图标（活动栏并入）+ 下方按视图切内容 -->
      <aside class="ide-files">
        <!-- Trae 式：活动栏图标做成侧栏顶部横排，点切视图（省掉独立竖活动栏）-->
        <div class="side-iconbar">
          <button
            v-for="v in SIDEBAR_VIEWS"
            :key="v.key"
            type="button"
            class="side-ico"
            :class="{ active: sidebarView === v.key }"
            :title="v.title"
            @click="sidebarView = v.key"
          >{{ v.icon }}</button>
        </div>
        <div class="files-head">
          <span class="fh-label">{{ sidebarTitle }}</span>
          <span v-if="sidebarView === 'git'" class="fh-count">{{ gitFiles.length }}</span>
        </div>

        <!-- 资源管理器（文件树 + 底部 大纲/时间线 折叠面板，还原 VSCode 原生结构）-->
        <template v-if="sidebarView === 'explorer'">
          <div class="files-tree">
            <div
              v-for="(f, i) in files"
              :key="i"
              class="file-row"
              :class="{ active: activeTabId === f.fileId }"
              :style="{ paddingLeft: 6 + f.depth * 14 + 'px' }"
              @click="f.fileId && setActiveTab(f.fileId)"
              @contextmenu="f.fileId && openContextMenu($event, 'file', f)"
            >
              <span class="fr-caret">{{ f.isFolder ? '▾' : '' }}</span>
              <span class="fr-icon">{{ f.icon }}</span>
              <span class="fr-name" :class="{ 'git-mod': f.git === 'M', 'git-add': f.git === 'A' }">{{ f.name }}</span>
              <span v-if="f.git" class="fr-git" :class="`git-${f.git.toLowerCase()}`">{{ f.git }}</span>
            </div>
          </div>

          <!-- 大纲（默认折叠）-->
          <div class="ex-section">
            <button class="ex-head" type="button" @click="outlineOpen = !outlineOpen">
              <span class="ex-caret">{{ outlineOpen ? '▾' : '▸' }}</span>大纲
            </button>
            <div v-if="outlineOpen" class="ex-body">
              <div
                v-for="(o, i) in outlineItems"
                :key="i"
                class="outline-row"
                :style="{ paddingLeft: 8 + o.depth * 14 + 'px' }"
              >
                <span class="ol-icon">{{ o.icon }}</span>{{ o.name }}
              </div>
            </div>
          </div>

          <!-- 时间线（默认折叠）-->
          <div class="ex-section">
            <button class="ex-head" type="button" @click="timelineOpen = !timelineOpen">
              <span class="ex-caret">{{ timelineOpen ? '▾' : '▸' }}</span>时间线
            </button>
            <div v-if="timelineOpen" class="ex-body">
              <div v-for="(t, i) in timelineItems" :key="i" class="tl-row">
                <span class="tl-icon">{{ t.icon }}</span>
                <span class="tl-main">
                  <span class="tl-name">{{ t.name }}</span>
                  <span class="tl-meta">{{ t.meta }}</span>
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- 搜索 -->
        <div v-else-if="sidebarView === 'search'" class="side-pane">
          <input v-model="searchInput" class="side-search-input" placeholder="搜索文件内容…" />
          <div class="search-hits">
            <div v-for="(h, i) in searchHits" :key="i" class="hit-row" @click="setActiveTab(h.file)">
              <div class="hit-file">📄 {{ h.file }} <span class="hit-line">:{{ h.line }}</span></div>
              <div class="hit-text">{{ h.text }}</div>
            </div>
          </div>
        </div>

        <!-- 源代码管理（Git）-->
        <div v-else-if="sidebarView === 'git'" class="side-pane">
          <div class="git-section">更改 ({{ gitFiles.length }})</div>
          <div
            v-for="(f, i) in gitFiles"
            :key="i"
            class="git-row"
            @click="f.fileId && setActiveTab(f.fileId)"
          >
            <span class="fr-icon">{{ f.icon }}</span>
            <span class="git-name" :class="{ 'git-mod': f.git === 'M', 'git-add': f.git === 'A' }">{{ f.name }}</span>
            <span class="fr-git" :class="`git-${f.git.toLowerCase()}`">{{ f.git }}</span>
          </div>
        </div>

        <!-- 运行和调试 -->
        <div v-else-if="sidebarView === 'debug'" class="side-pane">
          <div class="dbg-launch">
            <button class="dbg-run" type="button" title="开始调试">▷</button>
            <select v-model="debugConfig" class="dbg-select">
              <option v-for="c in debugConfigs" :key="c" :value="c">{{ c }}</option>
            </select>
            <button class="dbg-gear" type="button" title="配置 launch.json">⚙</button>
          </div>
          <div v-for="s in debugSections" :key="s.key" class="dbg-section">
            <div class="dbg-head"><span class="ex-caret">▾</span>{{ s.title }}</div>
            <div class="dbg-empty">{{ s.empty }}</div>
          </div>
          <div class="dbg-section">
            <div class="dbg-head"><span class="ex-caret">▾</span>断点</div>
            <div v-for="(b, i) in breakpoints" :key="i" class="bp-row">
              <span class="bp-dot" :class="{ off: !b.on }">●</span>
              <span class="bp-name">{{ b.file }}</span>
              <span class="bp-line">:{{ b.line }}</span>
            </div>
          </div>
        </div>

        <!-- 扩展 -->
        <div v-else-if="sidebarView === 'extensions'" class="side-pane">
          <input v-model="extSearch" class="side-search-input" placeholder="在市场中搜索扩展…" />
          <div class="ext-section">已安装</div>
          <div v-for="(e, i) in extensions" :key="i" class="ext-row">
            <span class="ext-ico">🧩</span>
            <span class="ext-main">
              <span class="ext-name">{{ e.name }}<span class="ext-pub">{{ e.pub }}</span></span>
              <span class="ext-desc">{{ e.desc }}</span>
            </span>
            <span class="ext-state" :class="{ off: !e.on }">{{ e.on ? '已启用' : '已禁用' }}</span>
          </div>
        </div>

        <div v-if="sidebarView === 'explorer'" class="files-tip">💡 右键文件→预览 · ⌘P 文件查找</div>
      </aside>

      <!-- 3) 编辑器 -->
      <main class="ide-editor">
        <!-- 空白页(Watermark)：没有打开任何文件时 = 品牌形象 + 快捷键指引 -->
        <div v-if="!hasOpenTab" class="ide-watermark">
          <div class="wm-inner">
            <div class="wm-hero">
              <img :src="crabMascot" alt="Kooky" class="wm-crab" />
              <div class="wm-say">
                <p class="wm-title">Kode 待命中</p>
                <p class="wm-sub">左边挑个文件打开，或者右边直接派活</p>
              </div>
            </div>
            <ul class="wm-keys">
              <li v-for="(k, i) in watermarkKeys" :key="i" class="wm-key-row">
                <span class="wk-label">{{ k.label }}</span>
                <span class="wk-keys">
                  <kbd v-for="(c, j) in k.keys" :key="j">{{ c }}</kbd>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <template v-else>
        <!-- Tab 栏 -->
        <div class="editor-tabbar">
          <button
            v-for="t in editorTabs"
            :key="t.id"
            type="button"
            class="editor-tab"
            :class="{ active: activeTabId === t.id, dirty: t.dirty }"
            @click="setActiveTab(t.id)"
          >
            <span class="et-icon">{{ t.icon }}</span>
            <span class="et-label">{{ t.label }}</span>
            <span class="et-dirty-dot" v-if="t.dirty && activeTabId !== t.id">●</span>
            <span class="et-close" @click="closeTab(t.id, $event)" title="关闭">×</span>
          </button>
          <div class="tabbar-spacer"></div>
          <button class="tabbar-action" type="button" title="拆分编辑器">⫶</button>
          <button class="tabbar-action" type="button" title="更多">···</button>
        </div>

        <!-- Breadcrumb -->
        <div v-if="breadcrumb.length" class="editor-breadcrumb">
          <template v-for="(seg, i) in breadcrumb" :key="i">
            <span v-if="i > 0" class="bc-sep">›</span>
            <span class="bc-item">{{ seg }}</span>
          </template>
        </div>

        <!-- 代码 + Minimap -->
        <div
          class="editor-body"
          @contextmenu="openContextMenu($event, 'code', { fileId: activeTabId, name: activeTabId })"
        >
          <div class="editor-code">
            <div
              v-for="(ln, i) in currentCode"
              :key="i"
              class="code-row"
              :class="{
                'has-error': issuesByLine(i + 1).some((x) => x.type === 'error'),
                'has-warning': issuesByLine(i + 1).some((x) => x.type === 'warning'),
              }"
            >
              <span class="ln">
                <span v-if="issuesByLine(i + 1).some((x) => x.type === 'error')" class="ln-mark error">✕</span>
                <span v-else-if="issuesByLine(i + 1).some((x) => x.type === 'warning')" class="ln-mark warn">⚠</span>
                <span class="ln-num">{{ i + 1 }}</span>
              </span>
              <span class="lc">
                <code>{{ ln }}</code>
                <span v-if="issuesByLine(i + 1).length" class="issue-tip">
                  {{ issuesByLine(i + 1)[0].text }}
                </span>
              </span>
            </div>
          </div>
          <!-- Minimap -->
          <div class="editor-minimap">
            <div class="mm-canvas">
              <div
                v-for="(ln, i) in currentCode"
                :key="i"
                class="mm-line"
                :style="{ width: Math.min(100, (ln.length || 1) * 3) + '%' }"
                :class="{
                  'mm-error': issuesByLine(i + 1).some((x) => x.type === 'error'),
                  'mm-warning': issuesByLine(i + 1).some((x) => x.type === 'warning'),
                }"
              ></div>
            </div>
          </div>
        </div>
        </template>
      </main>

    </div>

    <!-- ════ 底部面板:问题 / 输出 / 调试控制台（终端不在这,走 Kode 的 CLI 标签页）════ -->
    <div
      class="ide-bottom"
      :class="{ open: bottomOpen, maxed: bottomMax }"
      :style="bottomOpen && !bottomMax ? { height: bottomHeight + 'px' } : null"
    >
      <!-- 拖高度手柄 -->
      <div
        v-if="bottomOpen && !bottomMax"
        class="bp-grip"
        :class="{ on: isResizingBottom }"
        @mousedown.prevent="onBottomResizeStart"
      ></div>

      <header class="bp-bar">
        <button
          v-for="t in BOTTOM_TABS"
          :key="t.key"
          type="button"
          class="bp-tab"
          :class="{ active: bottomOpen && bottomTab === t.key }"
          @click="toggleBottom(t.key)"
        >
          {{ t.label }}
          <span v-if="t.key === 'problems' && problemList.length" class="bp-badge">{{ problemList.length }}</span>
        </button>
        <span class="bp-spacer"></span>

        <!-- 问题：筛选 + 严重程度 -->
        <template v-if="bottomOpen && bottomTab === 'problems'">
          <input v-model="problemFilter" class="bp-filter" placeholder="筛选问题…" />
          <select v-model="problemSeverity" class="bp-channel">
            <option value="all">全部</option>
            <option value="error">仅错误</option>
            <option value="warning">仅警告</option>
          </select>
        </template>

        <select v-if="bottomOpen && bottomTab === 'output'" v-model="outputChannel" class="bp-channel">
          <option v-for="c in OUTPUT_CHANNELS" :key="c" :value="c">{{ c }}</option>
        </select>

        <button v-if="bottomOpen" class="bp-x" type="button" :title="bottomMax ? '还原' : '最大化'" @click="bottomMax = !bottomMax">
          {{ bottomMax ? '▽' : '△' }}
        </button>
        <button v-if="bottomOpen" class="bp-x" type="button" title="收起" @click="bottomOpen = false; bottomMax = false">✕</button>
      </header>

      <div v-if="bottomOpen" class="bp-body">
        <!-- 问题（按文件分组，跟编辑器行内波浪线同一份数据）-->
        <div v-if="bottomTab === 'problems'" class="bp-problems">
          <div v-for="g in groupedProblems" :key="g.file" class="pb-group">
            <div class="pb-file">
              <span class="pb-caret">▾</span>
              <span class="pb-fname">{{ g.file }}</span>
              <span class="pb-fcount">{{ g.items.length }}</span>
            </div>
            <div v-for="(p, i) in g.items" :key="i" class="pb-row" @click="setActiveTab(p.file)">
              <span class="pb-ico" :class="p.type">{{ p.type === 'error' ? '✕' : '⚠' }}</span>
              <span class="pb-text">{{ p.text }}</span>
              <span class="pb-loc">[行 {{ p.line }}]</span>
            </div>
          </div>
          <div v-if="!problemHitCount" class="bp-empty">
            {{ problemList.length ? '没有匹配的问题' : '工作区中未检测到问题' }}
          </div>
        </div>

        <!-- 输出(Git 频道 = git 报错时唯一能看到原始 stderr 的地方) -->
        <div v-else-if="bottomTab === 'output'" class="bp-log">
          <template v-if="outputChannel === 'Git'">
            <div v-for="(l, i) in outputLines" :key="i" class="log-line">{{ l }}</div>
          </template>
          <div v-else class="bp-empty">（{{ outputChannel }} 频道暂无输出）</div>
        </div>

        <!-- 调试控制台：只在调试会话活着时有内容 -->
        <div v-else class="bp-log dbg-console">
          <template v-if="debugSession">
            <div v-for="(l, i) in debugConsoleLines" :key="i" class="log-line">{{ l.text }}</div>
            <div class="dc-input-row">
              <span class="dc-caret">›</span>
              <input v-model="debugConsoleInput" class="dc-input" placeholder="在断点作用域中求值(mock)" />
            </div>
          </template>
          <div v-else class="bp-empty">
            未在调试中 —— 从侧栏「🐞 运行和调试」启动后，程序输出和求值都在这里
          </div>
        </div>
      </div>
    </div>

    <!-- ════ 状态栏(VSCode 蓝)════ -->
    <!-- 状态栏：Kooky 浅色（非 VSCode 蓝）。无 Remote 指示器（Remote 砍了）、无账户（第二套账户体系） -->
    <footer class="ide-statusbar">
      <button class="sb-item sb-branch" type="button" title="切换分支" @click.stop="pickBranch">
        <span class="sb-ico">🌿</span>
        {{ ws?.branch || 'main' }}
      </button>
      <button class="sb-item" type="button" title="同步（拉取 + 推送）">
        <span class="sb-mini">↓ 0 ↑ 0</span>
      </button>
      <span class="sb-item sb-static" v-if="gitChanges.total > 0">
        <span class="sb-ico">●</span>
        {{ gitChanges.m }}M {{ gitChanges.a }}A
      </span>
      <button class="sb-item" type="button" title="打开问题面板" @click.stop="openProblems">
        <span class="sb-ico">⚠</span> {{ warningCount }}
        <span class="sb-ico">✕</span> {{ errorCount }}
      </button>
      <span class="sb-spacer"></span>
      <button class="sb-item" type="button" title="转到行" @click.stop="gotoLine">行 {{ cursorPos.line }}, 列 {{ cursorPos.col }}</button>
      <button class="sb-item" type="button" title="选择缩进" @click.stop="pickIndent">空格: 2</button>
      <button class="sb-item" type="button" title="选择编码" @click.stop="pickEncoding">UTF-8</button>
      <button class="sb-item" type="button" title="选择行尾序列" @click.stop="pickEol">LF</button>
      <button class="sb-item sb-lang" type="button" title="选择语言模式" @click.stop="pickLang">
        {{ activeTabId.endsWith('.html') ? 'HTML' : activeTabId.endsWith('.ts') ? 'TypeScript' : 'Vue' }}
      </button>
    </footer>

    <!-- 状态栏 Quick Pick（复刻 VSCode 状态栏各项的点击行为）-->
    <div v-if="sbPick" class="overlay" @click="closeSbPick">
      <div class="palette" @click.stop>
        <div class="sb-pick-title">{{ sbPick.title }}</div>
        <input
          v-if="sbPick.input"
          class="palette-input"
          :placeholder="sbPick.input"
          @keydown.enter="closeSbPick"
        />
        <ul v-else class="palette-list">
          <li
            v-for="(it, i) in sbPick.items"
            :key="i"
            class="palette-item"
            :class="{ 'pi-accent': it.accent }"
            @click="closeSbPick"
          >
            <span class="pi-label">{{ it.label }}</span>
            <span v-if="it.hint" class="pi-shortcut">{{ it.hint }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- ════ 右键菜单 ════ -->
    <ul
      v-if="ctxMenu.visible"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <li v-if="ctxMenu.source === 'file'" @click="ctxOpenInEditor">
        <span class="cm-ico">📝</span> 在编辑器打开
      </li>
      <li @click="ctxPreview">
        <span class="cm-ico">🌐</span> 在预览中打开
      </li>
      <li @click="closeContextMenu" class="cm-sep">
        <span class="cm-ico">✕</span> 取消
      </li>
    </ul>

    <!-- ════ 命令面板(⌘⇧P)════ -->
    <div v-if="cmdPaletteOpen" class="overlay" @click="closeCmdPalette">
      <div class="palette" @click.stop>
        <input
          v-model="cmdInput"
          type="text"
          class="palette-input"
          placeholder="> 输入命令..."
          autofocus
          @keydown.escape="closeCmdPalette"
        />
        <ul class="palette-list">
          <li
            v-for="c in filteredCommands"
            :key="c.id"
            class="palette-item"
            @click="executeCommand(c)"
          >
            <span class="pi-icon">{{ c.icon }}</span>
            <span class="pi-label">{{ c.label }}</span>
            <span v-if="c.shortcut" class="pi-shortcut">{{ c.shortcut }}</span>
          </li>
          <li v-if="!filteredCommands.length" class="palette-empty">无匹配命令</li>
        </ul>
      </div>
    </div>

    <!-- ════ 文件搜索(⌘P)════ -->
    <div v-if="fileSearchOpen" class="overlay" @click="closeFileSearch">
      <div class="palette" @click.stop>
        <input
          v-model="fileSearchInput"
          type="text"
          class="palette-input"
          placeholder="🔍 输入文件名..."
          autofocus
          @keydown.escape="closeFileSearch"
        />
        <ul class="palette-list">
          <li
            v-for="f in filteredFiles"
            :key="f.fileId"
            class="palette-item"
            @click="jumpToFile(f)"
          >
            <span class="pi-icon">{{ f.icon }}</span>
            <span class="pi-label">{{ f.name }}</span>
            <span v-if="f.git" class="pi-git" :class="`pi-git-${f.git.toLowerCase()}`">{{ f.git }}</span>
          </li>
          <li v-if="!filteredFiles.length" class="palette-empty">无匹配文件</li>
        </ul>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.ide-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  position: relative;
}

// ════ 主区 ════
.ide-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

// 文件树
.ide-files {
  width: 220px;
  flex-shrink: 0;
  background: #F3F3F3;
  border-right: 1px solid $border;
  display: flex;
  flex-direction: column;

  // Trae 式合并侧栏：顶部横图标条（活动栏并入）
  .side-iconbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid $border-light;
    .side-ico {
      width: 28px; height: 28px;
      border: 0; background: transparent;
      border-radius: 7px; cursor: pointer;
      font-size: 14px; color: $text-muted;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all $anim-fast;
      &:hover { background: rgba(0,0,0,.05); color: $text-display; }
      &.active { background: #fff; color: $aurora-purple; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    }
  }

  .files-head {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: $text-muted;
    font-weight: $fw-semibold;
    display: flex; align-items: center; gap: 6px;
    .fh-count { background: rgba(132,120,250,.14); color: $aurora-purple; border-radius: 8px; padding: 0 6px; font-size: 10px; }
  }
  .files-tree { flex: 1; overflow-y: auto; }

  // 搜索 / Git / 大纲 共用面板
  .side-pane { flex: 1; overflow-y: auto; padding: 4px 0; }
  .side-search-input {
    width: calc(100% - 16px); margin: 2px 8px 8px; height: 28px;
    border: 1px solid $border; border-radius: 7px; padding: 0 10px;
    font-size: $fs-base; outline: none; font-family: inherit;
    &:focus { border-color: $aurora-purple; }
  }
  .search-hits { display: flex; flex-direction: column; }
  .hit-row { padding: 6px 12px; cursor: pointer; &:hover { background: rgba(0,0,0,.04); }
    .hit-file { font-size: $fs-base; color: $text-display; .hit-line { color: $text-faint; } }
    .hit-text { font-size: 11px; color: $text-muted; font-family: 'SF Mono', Monaco, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
  }
  .git-section { padding: 4px 12px 6px; font-size: 11px; color: $text-muted; }
  .git-row { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 12px; cursor: pointer; font-size: $fs-sm;
    &:hover { background: rgba(0,0,0,.04); }
    .git-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .git-name.git-mod { color: #d97706; } .git-name.git-add { color: #16a34a; }
  }
  .outline-row { display: flex; align-items: center; gap: 6px; height: 24px; font-size: $fs-sm; color: $text-display; cursor: default;
    &:hover { background: rgba(0,0,0,.04); }
    .ol-icon { color: $aurora-purple; font-size: 11px; width: 14px; text-align: center; }
  }

  // ─── 资源管理器底部折叠区（大纲 / 时间线,VSCode 原生位置）───
  .ex-section {
    flex-shrink: 0;
    border-top: 1px solid $border-light;
    .ex-head {
      width: 100%; height: 24px; display: flex; align-items: center; gap: 4px;
      padding: 0 8px; border: 0; background: transparent; cursor: pointer;
      font-size: 11px; font-weight: $fw-semibold; color: $text-secondary;
      text-transform: uppercase; letter-spacing: .3px; font-family: inherit;
      &:hover { background: rgba(0,0,0,.04); }
    }
    .ex-body { max-height: 160px; overflow-y: auto; padding-bottom: 4px; }
  }
  .ex-caret { width: 12px; font-size: 9px; color: $text-faint; }
  .tl-row { display: flex; align-items: center; gap: 6px; padding: 3px 12px; cursor: default;
    &:hover { background: rgba(0,0,0,.04); }
    .tl-icon { color: $aurora-purple; font-size: 10px; width: 12px; text-align: center; flex-shrink: 0; }
    .tl-main { display: flex; flex-direction: column; min-width: 0; }
    .tl-name { font-size: 11px; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tl-meta { font-size: 10px; color: $text-faint; }
  }

  // ─── 运行和调试 ───
  .dbg-launch { display: flex; align-items: center; gap: 6px; padding: 4px 8px 8px;
    .dbg-run { width: 24px; height: 24px; border: 0; border-radius: 6px; background: rgba(22,163,74,.12); color: #16a34a; cursor: pointer; font-size: 11px; }
    .dbg-select { flex: 1; min-width: 0; height: 24px; border: 1px solid $border; border-radius: 6px; background: #fff; font-size: 11px; font-family: inherit; color: $text-display; outline: none; }
    .dbg-gear { width: 22px; height: 24px; border: 0; background: transparent; color: $text-muted; cursor: pointer; font-size: 11px; }
  }
  .dbg-section { border-top: 1px solid $border-light;
    .dbg-head { display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px;
      font-size: 11px; font-weight: $fw-semibold; color: $text-secondary; text-transform: uppercase; letter-spacing: .3px; }
    .dbg-empty { padding: 4px 12px 8px; font-size: 11px; color: $text-faint; }
  }
  .bp-row { display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 12px; font-size: 11px; cursor: default;
    &:hover { background: rgba(0,0,0,.04); }
    .bp-dot { color: #e11d48; font-size: 9px; &.off { color: $text-faint; } }
    .bp-name { flex: 1; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-line { color: $text-faint; }
  }

  // ─── 扩展 ───
  .ext-section { padding: 4px 12px 6px; font-size: 11px; color: $text-muted; }
  .ext-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: default;
    &:hover { background: rgba(0,0,0,.04); }
    .ext-ico { font-size: 13px; }
    .ext-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .ext-name { font-size: $fs-base; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      .ext-pub { margin-left: 6px; font-size: 10px; color: $text-faint; }
    }
    .ext-desc { font-size: 10px; color: $text-muted; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ext-state { font-size: 10px; color: #16a34a; flex-shrink: 0; &.off { color: $text-faint; } }
  }

  .files-tip {
    flex-shrink: 0;
    padding: 6px 12px;
    background: rgba(132,120,250,.05);
    color: $text-muted;
    font-size: 10px;
    border-top: 1px solid $border-light;
  }
  .file-row {
    display: flex; align-items: center; gap: 4px;
    height: 22px; padding-right: 6px;
    font-size: $fs-sm; color: $text-display;
    cursor: pointer; user-select: none;
    transition: background 80ms;

    &:hover { background: rgba(0,0,0,.05); }
    &.active { background: rgba(132,120,250,.12); }
    .fr-caret { width: 10px; flex-shrink: 0; font-size: 10px; color: $text-muted; }
    .fr-icon { font-size: 12px; flex-shrink: 0; }
    .fr-name {
      flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      &.git-mod { color: #1e88e5; }
      &.git-add { color: #43a047; }
    }
    .fr-git {
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 700;
      padding: 0 4px;
      border-radius: 2px;
      &.git-m { color: #1e88e5; }
      &.git-a { color: #43a047; }
    }
  }
}

// 3) 编辑器
.ide-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

// ════ 空白页 Watermark（品牌形象 + 快捷键指引）════
// 参考 VSCode 原生 watermark，左边换成 Kooky 螃蟹
.ide-watermark {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  user-select: none;
}
.wm-inner { display: flex; flex-direction: column; gap: 28px; padding: 24px; }
.wm-hero { display: flex; align-items: center; gap: 20px; }
.wm-crab {
  width: 108px;
  height: 108px;
  object-fit: contain;
  flex-shrink: 0;
}
.wm-say {
  .wm-title {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: $fw-semibold;
    color: $text-display;
  }
  .wm-sub {
    margin: 0;
    font-size: $fs-lg;
    color: $text-muted;
  }
}
.wm-keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
}
.wm-key-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  .wk-label { font-size: $fs-lg; color: $text-secondary; }
  .wk-keys { display: flex; gap: 4px; }
  kbd {
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 6px;
    background: #F3F3F3;
    border: 1px solid $border;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
    color: $text-secondary;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: $fs-sm;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

.editor-tabbar {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  background: #ECECEC;
  border-bottom: 1px solid $border;

  .editor-tab {
    height: 36px;
    padding: 0 14px;
    border: 0; background: transparent;
    border-right: 1px solid $border-light;
    color: $text-muted; cursor: pointer;
    font-family: inherit; font-size: $fs-sm;
    display: inline-flex; align-items: center; gap: 6px;
    position: relative;
    transition: background .1s;

    .et-icon { font-size: 12px; flex-shrink: 0; }
    .et-label { max-width: 160px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .et-dirty-dot { color: $aurora-purple; font-size: 12px; }
    .et-close {
      width: 16px; height: 16px; border-radius: 3px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 14px; color: $text-faint;
      transition: all .1s;
      &:hover { background: rgba(0,0,0,.08); color: $text-display; }
    }
    &:hover { background: rgba(0,0,0,.03); color: $text-secondary; }
    &.active {
      background: #fff; color: $text-display;
      &::before {
        content: ''; position: absolute;
        top: 0; left: 0; right: 0; height: 2px;
        background: $aurora-purple;
      }
    }
  }
  .tabbar-spacer { flex: 1; }
  .tabbar-action {
    width: 32px; height: 36px;
    border: 0; background: transparent;
    color: $text-muted; cursor: pointer;
    font-family: inherit; font-size: 14px;
    &:hover { background: rgba(0,0,0,.05); color: $text-display; }
  }
}

.editor-breadcrumb {
  flex-shrink: 0;
  padding: 4px 14px;
  background: #fff;
  border-bottom: 1px solid $border-light;
  display: flex; align-items: center; gap: 4px;
  font-size: 11px;
  color: $text-muted;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  user-select: none;

  .bc-item {
    cursor: pointer;
    padding: 1px 4px; border-radius: 3px;
    &:hover { background: rgba(0,0,0,.04); color: $text-display; }
  }
  .bc-sep { color: $text-faint; font-size: 11px; }
}

.editor-body {
  flex: 1; min-height: 0;
  display: flex;
  overflow: hidden;
}
.editor-code {
  flex: 1; min-width: 0;
  overflow: auto;
  padding: 8px 0 8px 0;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px; line-height: 1.7;
  background: #fff;

  .code-row {
    display: flex;
    position: relative;
    &:hover { background: rgba(0,0,0,.02); }
    &.has-error .ln { background: rgba(239,68,68,.05); }
    &.has-warning .ln { background: rgba(245,158,11,.05); }

    .ln {
      flex-shrink: 0;
      width: 56px;
      padding-right: 10px;
      color: #b3b3b3;
      user-select: none;
      display: flex; align-items: center; justify-content: flex-end; gap: 4px;

      .ln-mark {
        font-size: 11px;
        &.error { color: #ef4444; }
        &.warn { color: #f59e0b; }
      }
      .ln-num { font-size: 12px; }
    }
    .lc {
      flex: 1; min-width: 0;
      color: #383A42; white-space: pre;
      position: relative;
      padding-right: 12px;

      .issue-tip {
        margin-left: 12px;
        font-family: inherit;
        font-size: 11px;
        color: $text-muted;
        font-style: italic;
        opacity: 0;
        transition: opacity .15s;
      }
    }
    &.has-error .lc { text-decoration: underline wavy #ef4444; }
    &.has-warning .lc { text-decoration: underline wavy #f59e0b; }
    &:hover .lc .issue-tip { opacity: 1; }
  }
}

// Minimap
.editor-minimap {
  flex-shrink: 0;
  width: 64px;
  background: rgba(0,0,0,.02);
  border-left: 1px solid $border-light;
  padding: 8px 6px;
  overflow: hidden;

  .mm-canvas {
    display: flex; flex-direction: column; gap: 2px;
  }
  .mm-line {
    height: 4px;
    background: rgba(0,0,0,.15);
    border-radius: 1px;

    &.mm-error { background: rgba(239,68,68,.5); }
    &.mm-warning { background: rgba(245,158,11,.5); }
  }
}

// ════ 底部面板:问题 / 输出 / 调试控制台 ════
// 终端不在这（走 Kode 顶部 CLI 标签页）；折叠态只有 30px 标签条
.ide-bottom {
  flex-shrink: 0;
  border-top: 1px solid $border;
  background: $bg-primary;
  display: flex;
  flex-direction: column;
  position: relative;
  // 最大化 = 占满编辑器区（VSCode 原生行为）
  &.maxed { flex: 1; min-height: 0; }
}
// 拖高度手柄（贴在面板上沿）
.bp-grip {
  position: absolute;
  top: -3px; left: 0; right: 0;
  height: 6px;
  cursor: row-resize;
  z-index: 5;
  &:hover, &.on { background: rgba(132, 120, 250, 0.35); }
}
.bp-bar {
  flex-shrink: 0;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  background: #F3F3F3;
  .bp-tab {
    height: 30px; padding: 0 10px; border: 0; background: transparent; cursor: pointer;
    font-size: 11px; font-family: inherit; color: $text-muted;
    text-transform: uppercase; letter-spacing: .3px;
    border-bottom: 2px solid transparent;
    display: flex; align-items: center; gap: 5px;
    &:hover { color: $text-display; }
    &.active { color: $text-display; border-bottom-color: $aurora-purple; }
  }
  .bp-badge {
    min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px;
    background: rgba(225,29,72,.14); color: #e11d48;
    font-size: 9px; display: inline-flex; align-items: center; justify-content: center;
  }
  .bp-spacer { flex: 1; }
  .bp-filter {
    width: 150px; height: 22px; margin-right: 4px;
    border: 1px solid $border; border-radius: 5px; padding: 0 7px; background: #fff;
    font-size: 10px; font-family: inherit; color: $text-display; outline: none;
    &:focus { border-color: $aurora-purple; }
  }
  .bp-channel {
    height: 22px; border: 1px solid $border; border-radius: 5px; background: #fff;
    font-size: 10px; font-family: inherit; color: $text-display; outline: none;
  }
  .bp-x { width: 22px; height: 22px; border: 0; background: transparent; color: $text-muted; cursor: pointer; font-size: 10px;
    &:hover { color: $text-display; }
  }
}
.bp-body { flex: 1; overflow-y: auto; min-height: 0; }
.bp-problems {
  padding: 4px 0;
  // 文件分组头（VSCode 是树：文件 → 该文件下的问题）
  .pb-file {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px;
    font-size: $fs-base; color: $text-secondary; cursor: default;
    .pb-caret { font-size: 9px; color: $text-faint; }
    .pb-fname { font-weight: $fw-medium; }
    .pb-fcount {
      min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px;
      background: rgba(0,0,0,.06); color: $text-muted;
      font-size: 9px; display: inline-flex; align-items: center; justify-content: center;
    }
  }
  .pb-row { display: flex; align-items: center; gap: 8px; padding: 3px 12px 3px 28px; cursor: pointer; font-size: $fs-base;
    &:hover { background: rgba(0,0,0,.04); }
    .pb-ico { font-size: 10px; flex-shrink: 0;
      &.error { color: #e11d48; } &.warning { color: #d97706; }
    }
    .pb-text { flex: 1; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pb-loc { color: $text-faint; font-size: 10px; font-family: 'SF Mono', Monaco, monospace; flex-shrink: 0; }
  }
}
.bp-empty { padding: 12px; color: $text-faint; font-size: $fs-base; line-height: 1.6; }
.bp-log {
  padding: 6px 12px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  line-height: 1.7;
  color: $text-secondary;
  .log-line { white-space: pre-wrap; word-break: break-all; }
}
.dbg-console .dc-input-row {
  display: flex; align-items: center; gap: 6px; margin-top: 4px;
  .dc-caret { color: $aurora-purple; }
  .dc-input {
    flex: 1; border: 0; outline: 0; background: transparent;
    font-family: inherit; font-size: inherit; color: $text-display;
    &::placeholder { color: $text-faint; }
  }
}

// ════ 状态栏(Kooky 浅色 + Aurora 紫强调)════
.ide-statusbar {
  flex-shrink: 0;
  height: 24px;
  background: $bg-primary;
  color: $text-secondary;
  border-top: 1px solid $border-light;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 2px;
  font-size: 11px;

  // 状态栏每一项都是按钮（VSCode 原生行为，换肤后自己复刻）
  .sb-item {
    height: 24px;
    padding: 0 8px;
    display: inline-flex; align-items: center; gap: 4px;
    transition: background .12s;
    cursor: pointer;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    &:hover { background: rgba(0,0,0,.04); color: $text-display; }
    // 纯展示项（改动数），不可点
    &.sb-static { cursor: default; &:hover { background: transparent; color: inherit; } }

    .sb-ico { font-size: 11px; opacity: 0.75; }
    .sb-mini { font-size: 9px; color: $text-muted; }
  }
  .sb-spacer { flex: 1; }
  .sb-lang { font-weight: $fw-medium; color: $aurora-purple; }
  .sb-branch {
    font-family: 'SF Mono', Monaco, monospace;
    color: $aurora-purple;
    font-weight: $fw-medium;
  }
}

// 状态栏 Quick Pick（复用 ⌘P / ⌘⇧P 那套浮层样式）
.sb-pick-title {
  padding: 8px 10px 6px;
  font-size: $fs-xs;
  color: $text-muted;
  border-bottom: 1px solid $border-light;
  margin-bottom: 4px;
}
.pi-accent .pi-label { color: $aurora-purple; font-weight: $fw-medium; }

// ════ 右键菜单 ════
.ctx-menu {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid $border;
  border-radius: 6px;
  box-shadow: $shadow-md;
  padding: 4px;
  list-style: none;
  margin: 0;
  min-width: 160px;
  font-size: $fs-sm;

  li {
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    color: $text-display;
    display: flex; align-items: center; gap: 8px;
    transition: background .1s;
    &:hover { background: rgba(132,120,250,.08); color: $aurora-purple; }

    .cm-ico { font-size: 13px; }
    &.cm-sep { border-top: 1px solid $border-light; margin-top: 2px;
      padding-top: 8px; color: $text-muted;
      &:hover { color: $text-display; } }
  }
}

// ════ 命令面板 / 文件搜索 (overlay)════
.overlay {
  position: absolute;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,.20);
  display: flex;
  justify-content: center;
  padding-top: 80px;
}
.palette {
  width: 600px;
  max-width: 80%;
  max-height: 60vh;
  background: #fff;
  border: 1px solid $border;
  border-radius: 8px;
  box-shadow: $shadow-md;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.palette-input {
  width: 100%;
  padding: 12px 16px;
  border: 0; outline: 0;
  font-family: inherit; font-size: 14px;
  background: #fff; color: $text-display;
  border-bottom: 1px solid $border-light;
  &::placeholder { color: $text-faint; }
}
.palette-list {
  list-style: none;
  margin: 0; padding: 4px;
  overflow-y: auto;
}
.palette-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex; align-items: center; gap: 10px;
  font-size: $fs-base;
  &:hover { background: rgba(132,120,250,.08); }

  .pi-icon { font-size: 14px; }
  .pi-label { flex: 1; color: $text-display; }
  .pi-shortcut {
    color: $text-muted;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
  }
  .pi-git {
    font-size: 9px; font-weight: 700;
    padding: 0 4px; border-radius: 2px;
    &.pi-git-m { color: #1e88e5; }
    &.pi-git-a { color: #43a047; }
  }
}
.palette-empty {
  padding: 16px;
  text-align: center;
  color: $text-faint;
  font-size: $fs-sm;
}

</style>
