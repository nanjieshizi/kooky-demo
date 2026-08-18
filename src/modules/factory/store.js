import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TRACE_RUNS, DEFAULT_ACTIVE_RUN_ID, DEFAULT_ACTIVE_NODE_ID } from './traceMock'
import {
  BUILTIN_AVATARS,
  DEFAULT_VERSION,
  LEAVE_PROJECT_ID,
  buildLeaveProject,
  buildLeaveThreads,
  buildLeaveFileStructure,
  buildLeaveFileContents,
  buildLeaveDbTables,
  buildIntegrations,
  AGENT_ESSENTIALS,
} from './leaveAgentMock'
import {
  buildLeaveCommits,
  buildLeavePublishRecords,
  createCommitRecord,
  getProjectWorkspacePath,
  parseGitCommitMessage,
} from './codeVersionMock'
import { buildPresetAgents } from './presetAgentsMock'

// 右侧全部 Tab 元信息（仅 code 固定不可关，其余均可关闭/重开）
export const ALL_RIGHT_TABS = Object.freeze([
  { id: 'code', label: '代码', icon: '💻', fixed: true },
  { id: 'preview', label: '预览', icon: '▶', fixed: false },
  { id: 'version', label: '版本管理', icon: '📋', fixed: false },
  { id: 'database', label: '数据库', icon: '🗄️', fixed: false },
  { id: 'integration', label: '集成管理', icon: '🔌', fixed: false },
  { id: 'skill', label: '技能', icon: '🧩', fixed: false },
  { id: 'knowledge', label: '知识库', icon: '📚', fixed: false },
])
// 代码 Tab 默认打开的文件
export const DEFAULT_CODE_FILE = 'README.md'

// 每个项目默认：左侧对话 + 右侧仅打开「代码」Tab
const DEFAULT_PROJECT_UI = Object.freeze({
  openTabs: ['code'],
  activeTab: 'code',
})

const DEFAULT_BOTTOM_PANEL = Object.freeze({
  expanded: false,
  activeTab: 'terminal',
  heightPercent: 32,
})

function cloneDefaultBottomPanel() {
  return { ...DEFAULT_BOTTOM_PANEL }
}

function cloneDefaultProjectUi() {
  return {
    openTabs: [...DEFAULT_PROJECT_UI.openTabs],
    activeTab: DEFAULT_PROJECT_UI.activeTab,
    bottomPanel: cloneDefaultBottomPanel(),
  }
}

export const useFactoryStore = defineStore('factory', () => {
  // 当前状态：empty | thinking | done
  const currentState = ref('done')

  // ─── 项目（二级菜单）：预置「请假 / 问诊 / 爆款笔记」等可预览 Agent，删光后回到空态 ───
  const PRESET_AGENTS = buildPresetAgents()
  const projects = ref([buildLeaveProject(), ...PRESET_AGENTS.map(p => p.project)])
  const currentProjectId = ref(LEAVE_PROJECT_ID)

  const currentProject = computed(
    () => projects.value.find(p => p.id === currentProjectId.value) || null,
  )

  // 当前 Agent 信息（派生自当前项目）
  const currentAgent = computed(() => {
    const p = currentProject.value
    return {
      name: p?.name || 'Agent',
      icon: p?.icon || null,
      version: p?.version || DEFAULT_VERSION,
      description: p?.description || '',
    }
  })

  // 内置头像库（供新建弹窗选择）
  const builtinAvatars = BUILTIN_AVATARS

  // 当前项目是否已有产出（未产出时右侧显示初始空态）
  const currentProjectProduced = computed(() => !!currentProject.value?.produced)

  // ─── 创建项目弹窗 ───────────────────────────────────────────────
  const showCreateModal = ref(false)
  function openCreateModal() {
    showCreateModal.value = true
  }
  function closeCreateModal() {
    showCreateModal.value = false
  }

  // ─── 初始化引导（基础必要条件）+ 上下文提示 ─────────────────────
  const agentEssentials = AGENT_ESSENTIALS
  // 引导问卷按项目隔离：仅「新建且未产出」的项目展示，已有/已产出项目永不展示
  const onboardingByProject = ref({})
  const onboarding = computed(() => {
    // 已产出（已有 Agent / 已生成完成）一律不再展示引导
    if (currentProjectProduced.value) return { completed: true, skipped: false, answers: {} }
    const id = currentProjectId.value
    const entry = id ? onboardingByProject.value[id] : null
    return entry || { completed: true, skipped: false, answers: {} }
  })
  const contextHints = ref([])
  function completeOnboarding(answers) {
    const id = currentProjectId.value
    if (!id) return
    onboardingByProject.value[id] = { completed: true, skipped: false, answers: answers || {} }
  }
  function skipOnboarding() {
    const id = currentProjectId.value
    if (!id) return
    const cur = onboardingByProject.value[id] || { completed: false, skipped: false, answers: {} }
    onboardingByProject.value[id] = { ...cur, skipped: true }
  }
  function addContextHint(type, message) {
    contextHints.value.push({
      id: `hint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      message,
      timestamp: Date.now(),
    })
  }
  function dismissContextHint(id) {
    contextHints.value = contextHints.value.filter(h => h.id !== id)
  }

  // ─── 右侧 Tab 架构（按项目隔离：切换智能体时恢复各自的 Tab 状态）────
  const projectUiStateByProject = ref({
    [LEAVE_PROJECT_ID]: cloneDefaultProjectUi(),
    ...Object.fromEntries(PRESET_AGENTS.map(p => [p.project.id, cloneDefaultProjectUi()])),
  })
  const openTabs = ref([...DEFAULT_PROJECT_UI.openTabs])
  const activeTab = ref(DEFAULT_PROJECT_UI.activeTab)

  // 右侧底部面板：终端 / 运行记录 / 输出（按项目隔离）
  const bottomPanelExpanded = ref(DEFAULT_BOTTOM_PANEL.expanded)
  const bottomPanelActiveTab = ref(DEFAULT_BOTTOM_PANEL.activeTab)
  const bottomPanelHeightPercent = ref(DEFAULT_BOTTOM_PANEL.heightPercent)

  function snapshotProjectUi() {
    const id = currentProjectId.value
    if (!id) return
    projectUiStateByProject.value[id] = {
      openTabs: [...openTabs.value],
      activeTab: activeTab.value,
      bottomPanel: {
        expanded: bottomPanelExpanded.value,
        activeTab: bottomPanelActiveTab.value,
        heightPercent: bottomPanelHeightPercent.value,
      },
    }
  }

  function restoreProjectUi(projectId) {
    const saved = projectUiStateByProject.value[projectId]
    const state = saved
      ? {
          openTabs: [...(saved.openTabs || DEFAULT_PROJECT_UI.openTabs)],
          activeTab: saved.activeTab || DEFAULT_PROJECT_UI.activeTab,
          bottomPanel: saved.bottomPanel
            ? { ...saved.bottomPanel }
            : cloneDefaultBottomPanel(),
        }
      : cloneDefaultProjectUi()
    openTabs.value = state.openTabs
    activeTab.value = state.activeTab
    bottomPanelExpanded.value = state.bottomPanel.expanded
    bottomPanelActiveTab.value = state.bottomPanel.activeTab
    bottomPanelHeightPercent.value = state.bottomPanel.heightPercent
    ensureActiveTabValid()
  }

  function setBottomPanelTab(tab) {
    if (!['terminal', 'runs', 'output'].includes(tab)) return
    bottomPanelActiveTab.value = tab
  }
  function setBottomPanelExpanded(expanded) {
    bottomPanelExpanded.value = !!expanded
  }
  function toggleBottomPanelExpanded() {
    bottomPanelExpanded.value = !bottomPanelExpanded.value
  }
  function setBottomPanelHeightPercent(percent) {
    bottomPanelHeightPercent.value = Math.max(18, Math.min(60, percent))
  }
  function getTabMeta(id) {
    return ALL_RIGHT_TABS.find(t => t.id === id) || { id, label: id, icon: '', fixed: false }
  }
  // 「更多」下拉里可重开的 Tab = 全部 - 已打开
  const availableMoreTabs = computed(() =>
    ALL_RIGHT_TABS.filter(t => !openTabs.value.includes(t.id)),
  )
  function setActiveTab(tab) {
    if (!ALL_RIGHT_TABS.some(t => t.id === tab)) return
    if (!openTabs.value.includes(tab)) openTabs.value.push(tab)
    activeTab.value = tab
  }

  function ensureActiveTabValid() {
    if (!openTabs.value.includes(activeTab.value)) {
      activeTab.value = openTabs.value[0] || 'code'
    }
  }
  function openTab(tab) {
    setActiveTab(tab)
  }
  function closeTab(tab) {
    if (getTabMeta(tab).fixed) return // 代码不可关闭
    const idx = openTabs.value.indexOf(tab)
    if (idx === -1) return
    openTabs.value.splice(idx, 1)
    if (activeTab.value === tab) {
      const next = openTabs.value[idx] || openTabs.value[idx - 1] || 'code'
      activeTab.value = next
    }
  }

  // ─── 代码工程：文件结构 + 内容 + 多文件打开 ───────────────────
  const codeFileStructure = ref(buildLeaveFileStructure())
  const codeFiles = ref(buildLeaveFileContents())
  const selectedCodePath = ref(DEFAULT_CODE_FILE)
  // 已打开的文件 Tab（多文件编辑）
  const openCodeFiles = ref([DEFAULT_CODE_FILE])

  function updateCodeFile(path, content, generating = false) {
    codeFiles.value[path] = {
      content,
      generating,
      lastUpdated: Date.now(),
    }
  }
  function getCodeFile(path) {
    return codeFiles.value[path] || null
  }
  function selectCodePath(path) {
    selectedCodePath.value = path
    if (!openCodeFiles.value.includes(path)) openCodeFiles.value.push(path)
  }
  function closeCodeFile(path) {
    const idx = openCodeFiles.value.indexOf(path)
    if (idx === -1) return
    openCodeFiles.value.splice(idx, 1)
    if (selectedCodePath.value === path) {
      selectedCodePath.value = openCodeFiles.value[idx] || openCodeFiles.value[idx - 1] || null
    }
  }
  // 在结构树中新建文件/文件夹（parentId 为 null 表示根）
  function createCodeNode(parentId, name, type = 'file') {
    const node = type === 'folder'
      ? { id: `${parentId ? parentId + '/' : ''}${name}`, name, type: 'folder', children: [] }
      : { id: `${parentId ? parentId + '/' : ''}${name}`, name, type: 'file', path: `${parentId ? parentId + '/' : ''}${name}` }
    if (!parentId) {
      codeFileStructure.value.push(node)
    } else {
      const findFolder = (nodes) => {
        for (const n of nodes) {
          if (n.id === parentId && n.type === 'folder') return n
          if (n.children) {
            const f = findFolder(n.children)
            if (f) return f
          }
        }
        return null
      }
      const folder = findFolder(codeFileStructure.value)
      if (folder) {
        if (!folder.children) folder.children = []
        folder.children.push(node)
      } else {
        codeFileStructure.value.push(node)
      }
    }
    if (type === 'file') {
      updateCodeFile(node.path, '', false)
      selectCodePath(node.path)
    }
    return node
  }

  // ─── 数据库（增删改查）─────────────────────────────────────────
  const dbTables = ref(buildLeaveDbTables())
  const selectedDbTableName = ref(dbTables.value[0]?.name || '')
  const selectedDbTable = computed(
    () => dbTables.value.find(t => t.name === selectedDbTableName.value) || null,
  )
  function selectDbTable(name) {
    selectedDbTableName.value = name
  }
  function insertDbRow(tableName, row) {
    const t = dbTables.value.find(x => x.name === tableName)
    if (!t) return
    const nextId = (t.sampleRows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)) + 1
    t.sampleRows.push({ id: nextId, ...row })
    t.rows = t.sampleRows.length
  }
  function updateDbRow(tableName, id, row) {
    const t = dbTables.value.find(x => x.name === tableName)
    if (!t) return
    const target = t.sampleRows.find(r => r.id === id)
    if (target) Object.assign(target, row)
  }
  function deleteDbRow(tableName, id) {
    const t = dbTables.value.find(x => x.name === tableName)
    if (!t) return
    t.sampleRows = t.sampleRows.filter(r => r.id !== id)
    t.rows = t.sampleRows.length
  }

  // ─── 集成管理 ─────────────────────────────────────────────────
  const integrations = ref(buildIntegrations())
  function toggleModel(modelId) {
    const m = integrations.value.models.find(x => x.id === modelId)
    if (m) m.enabled = !m.enabled
  }
  function setDefaultModel(modelId) {
    integrations.value.models.forEach((m) => {
      m.isDefault = m.id === modelId
      if (m.id === modelId) m.enabled = true
    })
  }
  function toggleInternalIntegration(id) {
    const it = integrations.value.internal.find(x => x.id === id)
    if (it) it.connected = !it.connected
  }
  function toggleExternalIntegration(id) {
    const it = integrations.value.external.find(x => x.id === id)
    if (it) it.connected = !it.connected
  }
  // ─── 代码提交（Git）/ 智能体市场发布 ───────────────────────────
  const codeCommits = ref(buildLeaveCommits())
  const publishRecords = ref(buildLeavePublishRecords())
  const terminalLinesByProject = ref({})

  const showAgentDetail = ref(false)
  const showPublishModal = ref(false)
  function openAgentDetail() {
    showAgentDetail.value = true
  }
  function closeAgentDetail() {
    showAgentDetail.value = false
  }
  function toggleAgentDetail() {
    showAgentDetail.value = !showAgentDetail.value
  }
  function openPublishModal() {
    showPublishModal.value = true
  }
  function closePublishModal() {
    showPublishModal.value = false
  }

  const headCommit = computed(() => codeCommits.value[0] || null)
  const publishedRelease = computed(
    () => publishRecords.value.find(r => r.isActive) || null,
  )
  // 兼容右上角「已发布」绿点
  const publishedVersion = computed(() => {
    const rel = publishedRelease.value
    if (!rel) return null
    return {
      version: rel.commitHash,
      commitMessage: rel.commitMessage,
      publishedAt: rel.publishedAt,
    }
  })

  function createCodeCommit(opts = {}) {
    const commit = createCommitRecord(opts)
    codeCommits.value.unshift(commit)
    return commit
  }

  function publishCommit(commitId, meta = {}) {
    const commit = codeCommits.value.find(c => c.id === commitId)
    if (!commit) return
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    publishRecords.value.forEach((r) => { r.isActive = false })
    publishRecords.value.unshift({
      id: `pub-${Date.now()}`,
      commitId: commit.id,
      commitHash: commit.hash,
      commitMessage: commit.message,
      publishedAt: stamp,
      marketCategory: meta.category || '其他',
      marketSummary: meta.summary || '',
      isActive: true,
    })
  }

  function unpublishRelease(recordId) {
    const r = publishRecords.value.find(x => x.id === recordId)
    if (r) r.isActive = false
  }

  const projectWorkspacePath = computed(() =>
    getProjectWorkspacePath(currentProjectId.value, currentProject.value?.name),
  )

  function getTerminalLines(projectId) {
    const id = projectId || currentProjectId.value
    const lines = terminalLinesByProject.value[id]
    if (lines?.length) return lines
    const slug = (id || 'project').replace(/[^a-z0-9-]/gi, '-')
    return [
      { type: 'prompt', text: `(${slug}) root@localhost:${getProjectWorkspacePath(id)}#` },
      { type: 'out', text: 'Git 仓库已就绪。支持 git status / git add / git commit -m "..."' },
    ]
  }

  function appendTerminalLine(projectId, line) {
    const id = projectId || currentProjectId.value
    if (!id) return
    const prev = getTerminalLines(id)
    terminalLinesByProject.value[id] = [...prev, line]
  }

  function runTerminalCommand(command) {
    const cmd = (command || '').trim()
    if (!cmd || !currentProjectId.value) return
    const pid = currentProjectId.value
    appendTerminalLine(pid, { type: 'cmd', text: cmd })

    if (/^git\s+status/i.test(cmd)) {
      appendTerminalLine(pid, { type: 'out', text: 'On branch main' })
      appendTerminalLine(pid, { type: 'out', text: 'Changes not staged for commit:' })
      appendTerminalLine(pid, { type: 'out', text: '  modified: config.yaml' })
      appendTerminalLine(pid, { type: 'out', text: '  modified: SOUL.md' })
      return
    }
    if (/^git\s+add/i.test(cmd)) {
      appendTerminalLine(pid, { type: 'out', text: '（演示）已暂存工作区变更' })
      return
    }
    const commitMsg = parseGitCommitMessage(cmd)
    if (commitMsg) {
      const commit = createCodeCommit({
        message: commitMsg,
        source: 'terminal',
        changes: ['+12 -3 config.yaml', '+8 -1 SOUL.md'],
      })
      appendTerminalLine(pid, {
        type: 'out',
        text: `[main ${commit.hash}] ${commit.message}`,
      })
      return
    }
    if (/^pwd$/i.test(cmd)) {
      appendTerminalLine(pid, { type: 'out', text: projectWorkspacePath.value })
      return
    }
    appendTerminalLine(pid, { type: 'out', text: `（演示）已执行: ${cmd}` })
  }

  // ─── 项目会话（thread）────────────────────────────────────────
  const projectThreads = ref({
    ...buildLeaveThreads(),
    ...Object.fromEntries(PRESET_AGENTS.map(p => [p.project.id, p.thread])),
  })
  const currentThreadIdByProject = ref({
    [LEAVE_PROJECT_ID]: 'thr-leave-1',
    ...Object.fromEntries(PRESET_AGENTS.map(p => [p.project.id, p.defaultThreadId])),
  })

  const currentProjectThreads = computed(() => projectThreads.value[currentProjectId.value] || [])
  const currentThreadId = computed(() => currentThreadIdByProject.value[currentProjectId.value])
  const currentThread = computed(() =>
    currentProjectThreads.value.find(t => t.id === currentThreadId.value) || null,
  )

  function selectThread(threadId) {
    if (!currentProjectId.value) return
    currentThreadIdByProject.value[currentProjectId.value] = threadId
  }
  function createThread(title) {
    if (!currentProjectId.value) return null
    const id = `thr-${Date.now()}`
    const thread = { id, title: title || '新对话', messages: [], createdAt: Date.now() }
    if (!projectThreads.value[currentProjectId.value]) {
      projectThreads.value[currentProjectId.value] = []
    }
    projectThreads.value[currentProjectId.value].unshift(thread)
    selectThread(id)
    return id
  }
  function deleteThread(threadId) {
    if (!currentProjectId.value) return
    const list = projectThreads.value[currentProjectId.value] || []
    const idx = list.findIndex(t => t.id === threadId)
    if (idx === -1) return
    list.splice(idx, 1)
    if (currentThreadIdByProject.value[currentProjectId.value] === threadId) {
      const next = list[0]
      currentThreadIdByProject.value[currentProjectId.value] = next ? next.id : null
    }
  }
  function renameThread(threadId, newTitle) {
    if (!currentProjectId.value) return
    const list = projectThreads.value[currentProjectId.value] || []
    const t = list.find(t => t.id === threadId)
    if (t) t.title = newTitle
  }

  // 新项目的独立产物上下文：按项目快照/恢复，保证多项目数据隔离
  // 预置 Agent（问诊 / 爆款笔记）的产物先放进来，选中即可预览
  const projectArtifacts = ref({
    [LEAVE_PROJECT_ID]: {
      codeFileStructure: buildLeaveFileStructure(),
      codeFiles: buildLeaveFileContents(),
      dbTables: buildLeaveDbTables(),
      integrations: buildIntegrations(),
      codeCommits: buildLeaveCommits(),
      publishRecords: buildLeavePublishRecords(),
      selectedCodePath: DEFAULT_CODE_FILE,
      openCodeFiles: [DEFAULT_CODE_FILE],
    },
    ...Object.fromEntries(
      PRESET_AGENTS.map(p => [p.project.id, JSON.parse(JSON.stringify(p.artifacts))]),
    ),
  })

  function snapshotArtifacts() {
    return {
      codeFileStructure: JSON.parse(JSON.stringify(codeFileStructure.value)),
      codeFiles: JSON.parse(JSON.stringify(codeFiles.value)),
      dbTables: JSON.parse(JSON.stringify(dbTables.value)),
      integrations: JSON.parse(JSON.stringify(integrations.value)),
      codeCommits: JSON.parse(JSON.stringify(codeCommits.value)),
      publishRecords: JSON.parse(JSON.stringify(publishRecords.value)),
      selectedCodePath: selectedCodePath.value,
      openCodeFiles: [...openCodeFiles.value],
    }
  }
  function emptyArtifacts() {
    return {
      codeFileStructure: [],
      codeFiles: {},
      dbTables: [],
      integrations: buildIntegrations(),
      codeCommits: [],
      publishRecords: [],
      selectedCodePath: null,
      openCodeFiles: [],
    }
  }
  function resolveCodeFileSelection(a = {}) {
    const files = a.codeFiles || {}
    if (files[DEFAULT_CODE_FILE]) {
      const open = a.openCodeFiles?.includes(DEFAULT_CODE_FILE)
        ? [...a.openCodeFiles]
        : [DEFAULT_CODE_FILE, ...(a.openCodeFiles || []).filter(p => p !== DEFAULT_CODE_FILE)]
      return { selectedCodePath: DEFAULT_CODE_FILE, openCodeFiles: open }
    }
    const path = a.selectedCodePath && files[a.selectedCodePath] ? a.selectedCodePath : null
    if (path) {
      return {
        selectedCodePath: path,
        openCodeFiles: a.openCodeFiles?.length ? [...a.openCodeFiles] : [path],
      }
    }
    const firstPath = Object.keys(files)[0] || null
    return {
      selectedCodePath: firstPath,
      openCodeFiles: firstPath ? [firstPath] : [],
    }
  }

  function applyArtifacts(a) {
    codeFileStructure.value = a.codeFileStructure || []
    codeFiles.value = a.codeFiles || {}
    dbTables.value = a.dbTables || []
    integrations.value = a.integrations || buildIntegrations()
    codeCommits.value = a.codeCommits?.length ? a.codeCommits : []
    publishRecords.value = a.publishRecords || []
    const codeSel = resolveCodeFileSelection(a)
    selectedCodePath.value = codeSel.selectedCodePath
    openCodeFiles.value = codeSel.openCodeFiles
    selectedDbTableName.value = (a.dbTables && a.dbTables[0]?.name) || ''
  }

  function selectProject(projectId) {
    if (projectId === currentProjectId.value) {
      if (currentState.value === 'empty') currentState.value = 'done'
      return
    }
    // 保存当前项目产物与右侧 Tab 状态
    if (currentProjectId.value) {
      projectArtifacts.value[currentProjectId.value] = snapshotArtifacts()
      snapshotProjectUi()
    }
    currentProjectId.value = projectId
    // 恢复目标项目产物与 Tab（默认：对话区 + 代码标签）
    const saved = projectArtifacts.value[projectId]
    applyArtifacts(saved || emptyArtifacts())
    restoreProjectUi(projectId)
    if (currentState.value === 'empty') currentState.value = 'done'
  }

  function createProject(nameOrOptions) {
    const opts = typeof nameOrOptions === 'string' ? { name: nameOrOptions } : (nameOrOptions || {})
    const { name, avatar = null, version = DEFAULT_VERSION, description = '' } = opts

    // 先保存当前项目产物与 Tab 状态
    if (currentProjectId.value) {
      projectArtifacts.value[currentProjectId.value] = snapshotArtifacts()
      snapshotProjectUi()
    }

    const id = `proj-${Date.now()}`
    const newProj = {
      id,
      name: name || '新建智能体',
      icon: avatar,
      avatar,
      version: version || DEFAULT_VERSION,
      description,
      produced: false, // 新项目：右侧初始空态、未产出
      createdAt: Date.now(),
    }
    projects.value.unshift(newProj)

    const threadId = `thr-${Date.now()}-init`
    projectThreads.value[id] = [{ id: threadId, title: '新对话', messages: [], createdAt: Date.now() }]
    currentThreadIdByProject.value[id] = threadId

    currentProjectId.value = id
    currentState.value = 'done'
    // 清空产物 → 右侧初始空态
    applyArtifacts(emptyArtifacts())
    projectArtifacts.value[id] = emptyArtifacts()
    // 新项目重新走「基础必要条件」引导（仅对该项目生效）
    onboardingByProject.value[id] = { completed: false, skipped: false, answers: {} }
    contextHints.value = []
    // 新项目默认：左侧对话 + 右侧「代码」Tab
    projectUiStateByProject.value[id] = cloneDefaultProjectUi()
    restoreProjectUi(id)
    return id
  }

  function deleteProject(projectId) {
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx === -1) return
    projects.value.splice(idx, 1)
    delete projectThreads.value[projectId]
    delete currentThreadIdByProject.value[projectId]
    delete onboardingByProject.value[projectId]
    delete projectUiStateByProject.value[projectId]
    if (currentProjectId.value === projectId) {
      const next = projects.value[0]
      if (next) selectProject(next.id)
      else {
        currentProjectId.value = null
        currentState.value = 'empty'
      }
    }
  }

  function renameProject(projectId, newName) {
    const proj = projects.value.find(p => p.id === projectId)
    if (proj) proj.name = newName
  }

  // ─── 左栏生成态 ───────────────────────────────────────────────
  const isGenerating = ref(false)

  // 当前预览中的代码提交（null = HEAD / 最新提交）
  const previewingCommit = ref(null)

  // ─── 预览 Tab：运行记录 ───────────────────────────────────────
  const traceRuns = ref(TRACE_RUNS)
  const activeTraceRunId = ref(DEFAULT_ACTIVE_RUN_ID)
  const selectedTraceNodeIdByRun = ref({ [DEFAULT_ACTIVE_RUN_ID]: DEFAULT_ACTIVE_NODE_ID })
  const traceSelectedDate = ref(TRACE_RUNS[0]?.date || '')
  const traceFilterStatus = ref('all')
  const showTrace = ref(false)

  function toggleTrace() { showTrace.value = !showTrace.value }
  function setShowTrace(v) { showTrace.value = !!v }
  function pickTraceRun(id) {
    activeTraceRunId.value = id
    const run = traceRuns.value.find(r => r.id === id)
    if (run) traceSelectedDate.value = run.date
  }
  function pickTraceDate(d) { traceSelectedDate.value = d }
  function pickTraceFilter(s) { traceFilterStatus.value = s }
  function createTraceRun(meta = {}) {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const id = meta.id || `run-${Date.now()}`
    const run = {
      id,
      date: meta.date || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: meta.time || `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      status: meta.status || 'success',
      duration: meta.duration || '—',
      nodes: [],
    }
    traceRuns.value.unshift(run)
    activeTraceRunId.value = id
    traceSelectedDate.value = run.date
    return id
  }
  function attachTraceToRun(runId, nodes, meta = {}) {
    const run = traceRuns.value.find(r => r.id === runId)
    if (!run) return
    run.nodes = nodes
    if (meta.duration) run.duration = meta.duration
    if (meta.status) run.status = meta.status
  }
  function selectTraceNode(nodeId) {
    selectedTraceNodeIdByRun.value[activeTraceRunId.value] = nodeId
  }
  const filteredTraceRuns = computed(() => {
    if (traceFilterStatus.value === 'all') return traceRuns.value
    return traceRuns.value.filter(r => r.status === traceFilterStatus.value)
  })
  const activeTraceRun = computed(
    () => traceRuns.value.find(r => r.id === activeTraceRunId.value) || null,
  )
  const traceNodes = computed(() => activeTraceRun.value?.nodes || [])
  const selectedTraceNodeId = computed(() => {
    const remembered = selectedTraceNodeIdByRun.value[activeTraceRunId.value]
    if (remembered) return remembered
    return traceNodes.value[0]?.id || null
  })
  const selectedTraceNode = computed(() => {
    if (!selectedTraceNodeId.value) return null
    const findNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === selectedTraceNodeId.value) return node
        if (node.children) {
          const found = findNode(node.children)
          if (found) return found
        }
      }
      return null
    }
    return findNode(traceNodes.value)
  })

  // ─── EmployeeChatPanel 兼容接口 ───────────────────────────────
  const $id = 'factory'
  const currentEmployee = computed(() => ({
    id: 'agent-creator',
    name: 'Agent Creator',
    avatar: null,
    description: '通过对话帮你创建、修改和调试 Agent',
    welcomeMessage: '你好！我是 Agent Creator，告诉我你想创建什么样的 Agent？',
  }))
  const currentEmployeeId = computed(() => 'agent-creator')
  const currentEmployeeThread = computed(() => {
    const t = currentThread.value
    return t ? { id: t.id, title: t.title, langgraph_thread_id: t.id } : null
  })
  const currentEmployeeThreadId = computed(() => currentThreadId.value)
  const currentEmployeeNavKey = computed(() => `factory-${currentProjectId.value}-${currentThreadId.value}`)
  const currentEmployeeMessages = computed(() => {
    const msgs = currentThread.value?.messages || []
    return msgs.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts: [{ type: 'text', text: msg.content }],
      timestamp: msg.timestamp,
      feedback: null,
      versionInfo: msg.versionInfo || null,
      steps: msg.steps || null,
    }))
  })
  const currentEmployeeTodos = computed(() => [])
  const employeeQuotingMessage = ref(null)
  const employeeUserSelectedMode = ref('auto')
  const employeeUserSelectedModelName = ref('')
  const employeeSelectedModelName = computed(() => employeeUserSelectedModelName.value)
  const employeeChatAvailableModels = computed(() => [])
  const currentEmployeeModelSupportsThinking = computed(() => false)
  const employeeChatHost = computed(() => 'factory')
  // 启用输入框的技能选择器（与「我的分身」一致）：'main' 为技能接口的默认 agentId
  const employeeSkillBindingAgentId = computed(() => 'main')
  const currentEmployeeHasMore = computed(() => false)
  const currentEmployeeLoadingOlderPage = computed(() => false)
  const currentEmployeePersistedMessageCount = computed(() => (currentThread.value?.messages || []).length)
  const currentEmployeeScrollAnchor = computed(() => null)
  const currentEmployeeLedgerBackfillPending = computed(() => false)
  const employeePendingPrefillText = ref('')
  const scrollTargetMessageId = ref(null)
  function requestScrollToMessage(messageId) {
    scrollTargetMessageId.value = `${messageId}__${Date.now()}`
  }
  function consumeScrollTarget() {
    scrollTargetMessageId.value = null
  }
  function getEmployeeThreadState() {
    return {
      sendingMessage: isGenerating.value,
      uploadingFiles: false,
      loadingMessages: false,
      isStreaming: isGenerating.value,
    }
  }
  async function sendEmployeeMessage(employeeId, threadId, text) {
    sendCreatorMessage(text)
  }
  function stopEmployeeStreaming() {
    isGenerating.value = false
    currentState.value = 'done'
  }
  function setEmployeeQuotingMessage(message) { employeeQuotingMessage.value = message }
  function clearEmployeeQuotingMessage() { employeeQuotingMessage.value = null }
  function submitEmployeeFeedback() {}
  async function regenerateEmployeeLastMessage() {}
  function setEmployeePendingPrefillText(text) { employeePendingPrefillText.value = text }
  function clearEmployeePendingPrefillText() { employeePendingPrefillText.value = '' }
  function tryReconnectEmployeeStream() {}
  function setEmployeeSelectedMode(mode) { employeeUserSelectedMode.value = mode }
  function setEmployeeSelectedModel(modelName) { employeeUserSelectedModelName.value = modelName }
  function updateEmployeeChatModelSelection() {}
  async function loadEmployeeOlderPage() {}

  // ─── 工厂自身 Actions ─────────────────────────────────────────

  // 首次创建时的分步生成脚本（请假智能体）
  const FIRST_BUILD_STEPS = [
    { text: '理解需求：员工请假申请 + 假期校验 + OA 审批', file: null },
    { text: '初始化项目结构 config.yaml / SOUL.md / README.md', file: 'config.yaml' },
    { text: '写入 Agent 人设（SOUL.md）', file: 'SOUL.md' },
    { text: '生成「请假申请」技能', file: 'skills/leave-application/handler.py' },
    { text: '生成「假期余额查询」技能', file: 'skills/leave-balance/SKILL.md' },
    { text: '创建业务数据表 leave_requests / leave_balance', file: null },
    { text: '接入 OA 审批与飞书通知', file: null },
  ]

  let buildTimer = null

  function sendCreatorMessage(content) {
    const thread = currentThread.value
    if (!thread) return

    const userMsg = { id: `msg-${Date.now()}`, role: 'user', content, timestamp: Date.now() }
    thread.messages.push(userMsg)
    if (thread.title === '新对话' || thread.title === '初次创建') {
      thread.title = content.slice(0, 12) + (content.length > 12 ? '...' : '')
    }

    isGenerating.value = true
    currentState.value = 'thinking'

    const isFirstBuild = !currentProjectProduced.value
    if (isFirstBuild) {
      runStepwiseGeneration()
    } else {
      buildTimer = setTimeout(() => completeGeneration(), 4000)
    }
  }

  // 分步生成：左侧推送思考过程，右侧文件逐个生成
  function runStepwiseGeneration() {
    const proj = currentProject.value
    const thread = currentThread.value
    if (!proj || !thread) return

    // 为新项目准备完整的请假工程素材
    const fullStructure = buildLeaveFileStructure()
    const fullContents = buildLeaveFileContents()

    // 左侧插入一条带 steps 的 assistant 消息，随进度更新
    const buildMsg = {
      id: `msg-${Date.now()}-build`,
      role: 'assistant',
      content: '正在为你打造 Agent…',
      timestamp: Date.now(),
      steps: FIRST_BUILD_STEPS.map(s => ({ text: s.text, status: 'pending' })),
    }
    thread.messages.push(buildMsg)

    // 切到代码 Tab，方便观察文件逐个出现
    activeTab.value = 'code'

    let i = 0
    const stepDelay = 900
    const tick = () => {
      if (i > 0) buildMsg.steps[i - 1].status = 'done'
      if (i >= FIRST_BUILD_STEPS.length) {
        finishFirstBuild(fullStructure, fullContents, buildMsg)
        return
      }
      buildMsg.steps[i].status = 'running'
      const step = FIRST_BUILD_STEPS[i]
      // 文件逐个写入右侧代码区
      if (step.file && fullContents[step.file]) {
        // 确保结构树包含该文件
        if (codeFileStructure.value.length === 0) {
          codeFileStructure.value = JSON.parse(JSON.stringify(fullStructure))
        }
        updateCodeFile(step.file, fullContents[step.file].content, false)
        selectCodePath(step.file)
      }
      i += 1
      buildTimer = setTimeout(tick, stepDelay)
    }
    tick()
  }

  function finishFirstBuild(fullStructure, fullContents, buildMsg) {
    const proj = currentProject.value
    const thread = currentThread.value
    if (!proj || !thread) return

    // 落地完整产物
    codeFileStructure.value = JSON.parse(JSON.stringify(fullStructure))
    codeFiles.value = JSON.parse(JSON.stringify(fullContents))
    dbTables.value = buildLeaveDbTables()
    integrations.value = buildIntegrations()
    const initCommit = createCodeCommit({
      message: `init: 初始化 ${proj.name}`,
      source: 'chat',
      messageId: buildMsg.id,
      threadId: thread.id,
      changes: ['+60 -0 config.yaml', '+48 -0 SOUL.md', '+20 -0 README.md'],
    })
    publishRecords.value = []

    proj.produced = true
    isGenerating.value = false
    currentState.value = 'done'

    buildMsg.content = `✅ ${proj.name} 已生成完成！

我已经为你创建了完整的项目结构（config.yaml / SOUL.md / skills/），并准备好数据表与集成。

你可以在「代码」里查看工程，在「版本管理」查看提交记录，或在「Agent 详情」发布到市场。`
    buildMsg.versionInfo = {
      commitId: initCommit.id,
      hash: initCommit.hash,
      message: initCommit.message,
      time: '刚刚',
    }

    // 首次生成完成后：自动把产出的工作面板都开出来（代码/预览/数据库/版本），默认停在代码
    openTabs.value = ['code', 'preview', 'database', 'version']
    activeTab.value = 'code'
    if (codeFiles.value[DEFAULT_CODE_FILE]) {
      openCodeFiles.value = [DEFAULT_CODE_FILE]
      selectedCodePath.value = DEFAULT_CODE_FILE
    }
  }

  function selectFile() {}
  function previewCommit(commit) {
    previewingCommit.value = commit
  }
  function clearPreviewCommit() {
    previewingCommit.value = null
  }
  function startGeneration() {
    currentState.value = 'thinking'
    isGenerating.value = true
  }

  // 非首次：对已产出项目的增量更新
  function completeGeneration() {
    currentState.value = 'done'
    isGenerating.value = false
    const proj = currentProject.value
    const thread = currentThread.value
    if (!proj || !thread) return

    const assistantMsg = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `✅ ${proj.name} 已根据本轮对话更新并通过测试！

你可以在右侧「预览」中测试，在「版本管理」查看提交，或在「Agent 详情」发布到市场。`,
      timestamp: Date.now(),
      versionInfo: null,
    }
    thread.messages.push(assistantMsg)

    const commit = createCodeCommit({
      message: 'feat: 根据本轮对话同步更新 Agent 配置',
      source: 'chat',
      messageId: assistantMsg.id,
      threadId: thread.id,
      changes: ['+12 -3 config.yaml', '+8 -1 SOUL.md'],
    })
    assistantMsg.versionInfo = {
      commitId: commit.id,
      hash: commit.hash,
      message: commit.message,
      time: '刚刚',
    }
  }

  function resetToEmpty() {
    currentState.value = 'empty'
  }

  return {
    // 基础态
    currentState,
    currentAgent,
    currentProject,
    currentProjectProduced,
    builtinAvatars,
    isGenerating,
    previewingCommit,

    // 创建弹窗
    showCreateModal,
    openCreateModal,
    closeCreateModal,

    // 引导
    agentEssentials,
    onboarding,
    contextHints,
    completeOnboarding,
    skipOnboarding,
    addContextHint,
    dismissContextHint,

    // Tab
    ALL_RIGHT_TABS,
    openTabs,
    activeTab,
    availableMoreTabs,
    getTabMeta,
    setActiveTab,
    openTab,
    closeTab,

    // 右侧底部面板
    bottomPanelExpanded,
    bottomPanelActiveTab,
    bottomPanelHeightPercent,
    setBottomPanelTab,
    setBottomPanelExpanded,
    toggleBottomPanelExpanded,
    setBottomPanelHeightPercent,

    // 代码
    codeFiles,
    codeFileStructure,
    selectedCodePath,
    openCodeFiles,
    updateCodeFile,
    getCodeFile,
    selectCodePath,
    closeCodeFile,
    createCodeNode,

    // 数据库
    dbTables,
    selectedDbTableName,
    selectedDbTable,
    selectDbTable,
    insertDbRow,
    updateDbRow,
    deleteDbRow,

    // 集成
    integrations,
    toggleModel,
    setDefaultModel,
    toggleInternalIntegration,
    toggleExternalIntegration,

    // 代码提交 / 市场发布
    codeCommits,
    headCommit,
    publishRecords,
    publishedRelease,
    publishedVersion,
    projectWorkspacePath,
    getTerminalLines,
    runTerminalCommand,
    createCodeCommit,
    showAgentDetail,
    showPublishModal,
    openAgentDetail,
    closeAgentDetail,
    toggleAgentDetail,
    openPublishModal,
    closePublishModal,
    publishCommit,
    unpublishRelease,

    // 预览 / trace
    traceNodes,
    selectedTraceNodeId,
    selectedTraceNode,
    traceRuns,
    activeTraceRunId,
    traceSelectedDate,
    traceFilterStatus,
    showTrace,
    filteredTraceRuns,
    activeTraceRun,
    toggleTrace,
    setShowTrace,
    pickTraceRun,
    pickTraceDate,
    pickTraceFilter,
    createTraceRun,
    attachTraceToRun,
    selectTraceNode,

    // EmployeeChatPanel 兼容
    $id,
    currentEmployee,
    currentEmployeeId,
    currentEmployeeThread,
    currentEmployeeThreadId,
    currentEmployeeNavKey,
    currentEmployeeMessages,
    currentEmployeeTodos,
    employeeQuotingMessage,
    employeeUserSelectedMode,
    employeeUserSelectedModelName,
    employeeSelectedModelName,
    employeeChatAvailableModels,
    currentEmployeeModelSupportsThinking,
    employeeChatHost,
    employeeSkillBindingAgentId,
    currentEmployeeHasMore,
    currentEmployeeLoadingOlderPage,
    currentEmployeePersistedMessageCount,
    currentEmployeeScrollAnchor,
    currentEmployeeLedgerBackfillPending,
    employeePendingPrefillText,
    scrollTargetMessageId,
    getEmployeeThreadState,
    sendEmployeeMessage,
    stopEmployeeStreaming,
    setEmployeeQuotingMessage,
    clearEmployeeQuotingMessage,
    submitEmployeeFeedback,
    regenerateEmployeeLastMessage,
    setEmployeePendingPrefillText,
    clearEmployeePendingPrefillText,
    requestScrollToMessage,
    consumeScrollTarget,
    tryReconnectEmployeeStream,
    setEmployeeSelectedMode,
    setEmployeeSelectedModel,
    updateEmployeeChatModelSelection,
    loadEmployeeOlderPage,

    // 工厂 Actions
    sendCreatorMessage,
    selectFile,
    previewCommit,
    clearPreviewCommit,
    startGeneration,
    completeGeneration,
    resetToEmpty,

    // 项目
    projects,
    currentProjectId,
    selectProject,
    createProject,
    deleteProject,
    renameProject,

    // 会话
    currentProjectThreads,
    currentThreadId,
    currentThread,
    selectThread,
    createThread,
    deleteThread,
    renameThread,
  }
})
