// src/modules/terminal/services/sessionService.js
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { useTabStore } from '@/modules/terminal/stores/tab'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { planClaudeSessionIdUpdatesFromMain } from '@/modules/terminal/utils/mergeClaudeSessionIdsFromMain.mjs'

const SNAPSHOT_VERSION = 1
const SNAPSHOT_INTERVAL = 8000   // 8 秒
const SCROLLBACK_INTERVAL = 60000 // 60 秒
const SNAPSHOT_DEBOUNCE_MS = 2000
const TYPING_QUIET_MS = 650

let _snapshotTimer = null
let _scrollbackTimer = null
let _terminalRefs = new Map() // termId → component ref (for serialize)
let _snapshotDebounceTimer = null
let _lastInputTime = 0
let _snapshotSuspended = false

/**
 * 暂停 snapshot 保存（登出时使用，防止空数据覆盖有效 snapshot）
 */
export function suspendSnapshot() {
  _snapshotSuspended = true
}

/**
 * 注册终端组件 ref，供 scrollback 采集时调用 getSerializedContent()
 */
export function registerTerminalRef(termId, ref) {
  _terminalRefs.set(termId, ref)
}

export function unregisterTerminalRef(termId) {
  _terminalRefs.delete(termId)
}

/**
 * 采集当前状态，组装为 snapshot 数据
 */
async function collectSnapshot() {
  const projectStore = useProjectStore()
  const workbenchStore = useWorkbenchStore()
  const tabStore = useTabStore()
  const panelStore = usePanelStore()

  const api = window.electronAPI?.session
  if (!api) return null

  // CWD 已由 shell integration 事件驱动更新到 panelStore，无需 lsof 采集
  const sessionResult = await api.collectSessionIds()
  const sessionMap = sessionResult?.data ?? {}

  // 合并 sessionId 到 panel 元数据
  // 注意：主进程 `collectSessionIds` 只能看到 hook 事件绑定成功的 term → sessionId 映射，
  // 这是一个易失的内存 map（重启后即空、hook 未命中则为空）。空态不代表"磁盘上没有可恢复 session"，
  // 所以这里只做"有值就 upsert"，不在空态擦 renderer 已知的 claudeSessionId。
  // 脏 id 的清理交给 use-time 兜底：
  //   - bypass 切换：ShortcutBar.selectPermissionMode 会调 resolveResumableSessionId(preferred) 验磁盘
  //   - resume 失败：ClaudeCodeTerminal.handleResumeFailed 会清 id
  //   - snapshot 加载：session-persistence.loadSnapshot 调 sanitizeSnapshotClaudeSessionIds 对照磁盘清脏
  const updates = planClaudeSessionIdUpdatesFromMain(panelStore.panelList, sessionMap)
  for (const { panelId, sessionId } of updates) {
    panelStore.updateClaudeSessionId(panelId, sessionId)
  }

  const getCliBrand = window.electronAPI?.terminal?.getCliBrand
  if (typeof getCliBrand === 'function') {
    const panelsNeedingCliBrandSync = panelStore.panelList.filter((panel) => (
      panel?.terminalId &&
      (
        panel?.claudeActive ||
        panel?.shellHostedClaude ||
        (typeof panel?.claudeSessionId === 'string' && panel.claudeSessionId.trim())
      )
    ))

    const cliBrandResults = await Promise.allSettled(
      panelsNeedingCliBrandSync.map(async (panel) => ({
        terminalId: panel.terminalId,
        cliBrand: await getCliBrand(panel.terminalId),
      })),
    )

    for (const result of cliBrandResults) {
      if (result.status !== 'fulfilled') continue
      const { terminalId, cliBrand } = result.value || {}
      if (!terminalId || !cliBrand) continue
      panelStore.updateCliBrand(terminalId, cliBrand)
    }
  }

  return {
    version: SNAPSHOT_VERSION,
    projects: projectStore.exportProjects(),
    workbenches: workbenchStore.exportWorkbenches(),
    tabs: tabStore.exportTabs(),
    panels: panelStore.exportPanels(),
  }
}

/**
 * 保存 snapshot 到文件系统
 */
export async function saveSnapshot() {
  if (_snapshotSuspended) return
  const api = window.electronAPI?.session
  if (!api) return

  const data = await collectSnapshot()
  if (!data) return

  // 确保数据可被 structured clone（IPC 序列化）
  await api.saveSnapshot(JSON.parse(JSON.stringify(data)))
}

/**
 * 保存所有终端的 scrollback 到文件系统
 */
export async function saveAllScrollback() {
  const api = window.electronAPI?.session
  if (!api) return

  const panelStore = usePanelStore()
  const promises = []

  for (const panel of panelStore.panelList) {
    const termId = panel.terminalId
    if (!termId || panel.detached) continue

    const termRef = _terminalRefs.get(termId)
    if (!termRef?.getSerializedContent) continue

    const content = termRef.getSerializedContent()
    if (content) {
      promises.push(api.saveScrollback(termId, content))
    }
  }

  await Promise.allSettled(promises)
}

/**
 * 加载 snapshot
 */
export async function loadSnapshot() {
  const api = window.electronAPI?.session
  if (!api) return null

  const result = await api.loadSnapshot()
  if (!result?.success || !result.data) return null
  if (result.data.version !== SNAPSHOT_VERSION) return null
  return result.data
}

/**
 * 加载主进程统一恢复视图（当前阶段允许回退到 legacy snapshot）
 */
export async function loadRecoveredState() {
  const api = window.electronAPI?.session
  if (!api) return null

  if (typeof api.loadCheckpoint === 'function') {
    const result = await api.loadCheckpoint()
    if (result?.success && result.data?.version === SNAPSHOT_VERSION) {
      return result.data
    }
  }

  return null
}

export async function loadCheckpoint() {
  return loadRecoveredState()
}

/**
 * 加载指定终端的 scrollback
 */
export async function loadScrollback(termId) {
  const api = window.electronAPI?.session
  if (!api) return ''

  const result = await api.loadScrollback(termId)
  return result?.content ?? ''
}

/**
 * 加载指定终端的主进程 journal 内容
 */
export async function loadTerminalJournal(termId) {
  const api = window.electronAPI?.session
  if (!api?.loadTerminalJournal) return ''

  const result = await api.loadTerminalJournal(termId)
  return result?.content ?? ''
}

/**
 * 标记用户正在输入（用于 debounce 安静期判断）
 */
export function markInputActive() {
  _lastInputTime = Date.now()
}

/**
 * 防抖版 saveSnapshot：等待 SNAPSHOT_DEBOUNCE_MS 后执行，
 * 若用户仍在打字（距上次输入 < TYPING_QUIET_MS）则继续推迟。
 */
export function debouncedSaveSnapshot() {
  clearTimeout(_snapshotDebounceTimer)
  _snapshotDebounceTimer = setTimeout(() => {
    if (Date.now() - _lastInputTime < TYPING_QUIET_MS) {
      debouncedSaveSnapshot()
      return
    }
    saveSnapshot()
  }, SNAPSHOT_DEBOUNCE_MS)
}

/**
 * 启动定时保存
 */
export function startPeriodicSave() {
  stopPeriodicSave()
  _snapshotTimer = setInterval(() => saveSnapshot(), SNAPSHOT_INTERVAL)
  _scrollbackTimer = setInterval(() => saveAllScrollback(), SCROLLBACK_INTERVAL)
}

/**
 * 停止定时保存
 */
export function stopPeriodicSave() {
  if (_snapshotDebounceTimer) {
    clearTimeout(_snapshotDebounceTimer)
    _snapshotDebounceTimer = null
  }
  if (_snapshotTimer) {
    clearInterval(_snapshotTimer)
    _snapshotTimer = null
  }
  if (_scrollbackTimer) {
    clearInterval(_scrollbackTimer)
    _scrollbackTimer = null
  }
}

/**
 * 生命周期保存（关闭/退出时调用，包含 scrollback）
 */
export async function lifecycleSave() {
  await Promise.allSettled([
    saveSnapshot(),
    saveAllScrollback(),
  ])
}

/**
 * 清除所有 session 数据
 */
export async function clearSession() {
  const api = window.electronAPI?.session
  if (!api) return
  await api.clear()
}
