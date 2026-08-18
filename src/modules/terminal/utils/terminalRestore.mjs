import {
  DEFAULT_RESTORE_POLICY,
  TERMINAL_RESTORE_STRATEGY,
  resolveTerminalRestoreStrategy,
} from './terminalRestorePolicy.mjs'
import { getPanelAutoTitle } from './tabTitle.mjs'

export const RESTORE_METADATA_ONLY_THRESHOLD = 12

export function shouldRestoreTerminalScrollback({
  readonlyHistory = false,
  mode = 'shell',
  resumeSessionId = '',
  teamMode = null,
  terminalRestoreStrategy = DEFAULT_RESTORE_POLICY.terminalRestoreStrategy,
} = {}) {
  if (readonlyHistory) {
    return true
  }

  if (mode !== 'claude-code') {
    if (teamMode?.enabled === true) {
      return false
    }

    return resolveTerminalRestoreStrategy(terminalRestoreStrategy)
      === TERMINAL_RESTORE_STRATEGY.LEGACY_FULL
  }

  if (teamMode?.enabled === true) {
    return false
  }

  if (typeof resumeSessionId === 'string' && resumeSessionId.trim()) {
    return false
  }

  return true
}

export async function resolveRestoredTerminalContent({
  checkpoint = null,
  termId = '',
  mode = 'shell',
  resumeSessionId = '',
  teamMode = null,
  readonlyHistory = false,
  terminalRestoreStrategy = DEFAULT_RESTORE_POLICY.terminalRestoreStrategy,
  loadTerminalJournal = null,
  loadLegacyScrollback = null,
} = {}) {
  const normalizedTermId = typeof termId === 'string' ? termId.trim() : ''
  if (!normalizedTermId) {
    return ''
  }

  const shouldReplayHistory = shouldRestoreTerminalScrollback({
    readonlyHistory,
    mode,
    resumeSessionId,
    teamMode,
    terminalRestoreStrategy,
  })
  if (!shouldReplayHistory) {
    return ''
  }

  const checkpointPanels = checkpoint?.panels
  let shouldReadJournal = true
  if (checkpointPanels && typeof checkpointPanels === 'object') {
    const hasMatchingTerminal = Object.values(checkpointPanels).some(
      (panel) => panel?.terminalId === normalizedTermId,
    )
    if (!hasMatchingTerminal) {
      shouldReadJournal = false
    }
  }

  const journalContent = shouldReadJournal && typeof loadTerminalJournal === 'function'
    ? await loadTerminalJournal(normalizedTermId)
    : ''
  if (typeof journalContent === 'string' && journalContent) {
    return journalContent
  }

  const legacyContent = typeof loadLegacyScrollback === 'function'
    ? await loadLegacyScrollback(normalizedTermId)
    : ''
  return typeof legacyContent === 'string' ? legacyContent : ''
}

const ANSI_CSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g
const ANSI_OSC_RE = /\u001b\].*?(?:\u0007|\u001b\\)/g

function stripAnsiSequences(content = '') {
  return String(content)
    .replace(ANSI_OSC_RE, '')
    .replace(ANSI_CSI_RE, '')
}

function looksLikeClaudeFullscreenShellCapture(scrollback = '') {
  if (typeof scrollback !== 'string' || !scrollback) {
    return false
  }

  const plain = stripAnsiSequences(scrollback).replace(/\r/g, '')
  const hasClaudeHeader = /Claude\s+Code(?:\s+v?\d[\d.]*)?/i.test(plain)
  const hasModelLabel = /\b(?:Sonnet|Haiku|Opus)/i.test(plain)
  const hasClaudePrompt = /(?:^|\n)❯\s*[O0]?\s*(?:\n|$)/.test(plain)

  return hasClaudeHeader && hasModelLabel && hasClaudePrompt
}

export function sanitizeRestoredScrollbackForPanel({
  mode = 'shell',
  claudeSessionId = '',
  readonlyHistory = false,
  scrollback = '',
} = {}) {
  if (typeof scrollback !== 'string' || !scrollback) {
    return ''
  }

  if (readonlyHistory) {
    return scrollback
  }

  // claude-code 模式下,如果没有有效的 sessionId(无法 resume),
  // 清除包含 Claude TUI 全屏渲染的 scrollback,避免样式错乱
  if (mode === 'claude-code') {
    const hasValidSession = typeof claudeSessionId === 'string' && claudeSessionId.trim()
    if (!hasValidSession && looksLikeClaudeFullscreenShellCapture(scrollback)) {
      return ''
    }
    return scrollback
  }

  if (mode !== 'shell') {
    return scrollback
  }

  if (typeof claudeSessionId === 'string' && claudeSessionId.trim()) {
    return scrollback
  }

  if (looksLikeClaudeFullscreenShellCapture(scrollback)) {
    return ''
  }

  return scrollback
}

function collectPanelIdsFromLayout(node, panelIds = []) {
  if (!node || typeof node !== 'object') {
    return panelIds
  }

  if (node.type === 'leaf') {
    if (typeof node.panelId === 'string' && node.panelId.trim()) {
      panelIds.push(node.panelId.trim())
    }
    return panelIds
  }

  if (node.type === 'split' && Array.isArray(node.children)) {
    for (const child of node.children) {
      collectPanelIdsFromLayout(child, panelIds)
    }
  }

  return panelIds
}

function collectUniqueTerminalIdsFromPanels(panels = []) {
  const seen = new Set()
  const terminalIds = []

  for (const panel of panels) {
    const terminalId = typeof panel?.terminalId === 'string' ? panel.terminalId.trim() : ''
    if (!terminalId || seen.has(terminalId) || panel?.detached) continue
    seen.add(terminalId)
    terminalIds.push(terminalId)
  }

  return terminalIds
}

function collectWorkbenchTerminalIds(snapshot = {}, workbenchId = '') {
  if (!workbenchId) return []

  const panels = Object.values(snapshot?.panels || {})
    .filter((panel) => panel?.workbenchId === workbenchId)

  return collectUniqueTerminalIdsFromPanels(panels)
}

function collectAllRecoveredTerminalIds(snapshot = {}) {
  const panels = Object.values(snapshot?.panels || {})
  return collectUniqueTerminalIdsFromPanels(panels)
}

export function buildRestoredTerminalBootstrapPlan(snapshot = {}, options = {}) {
  const threshold = Number.isFinite(options.threshold)
    ? Math.max(0, Number(options.threshold))
    : RESTORE_METADATA_ONLY_THRESHOLD
  const activeProjectId = snapshot?.projects?.activeProjectId
    ?? snapshot?.projects?.list?.[0]?.id
    ?? null
  const activeProject = snapshot?.projects?.list?.find((project) => project?.id === activeProjectId) ?? null
  const activeWorkbenchId = activeProject?.activeWorkbenchId
    ?? activeProject?.workbenchIds?.[0]
    ?? null
  const totalTerminalIds = collectAllRecoveredTerminalIds(snapshot)
  const shouldLazyRestoreOffscreenWorkbenches = Boolean(
    activeWorkbenchId &&
    totalTerminalIds.length > threshold
  )

  const eagerTerminalIds = shouldLazyRestoreOffscreenWorkbenches
    ? collectWorkbenchTerminalIds(snapshot, activeWorkbenchId)
    : totalTerminalIds
  const eagerTerminalIdSet = new Set(eagerTerminalIds)
  const lazyTerminalIds = totalTerminalIds.filter((terminalId) => !eagerTerminalIdSet.has(terminalId))
  const lazyWorkbenchIds = shouldLazyRestoreOffscreenWorkbenches
    ? (Array.isArray(activeProject?.workbenchIds) ? activeProject.workbenchIds : [])
      .filter((workbenchId) => workbenchId && workbenchId !== activeWorkbenchId)
    : []

  return {
    threshold,
    activeProjectId,
    activeWorkbenchId,
    totalRecoveredSessions: totalTerminalIds.length,
    autoBootstrapTotal: eagerTerminalIds.length,
    lazyMetadataOnlyCount: lazyTerminalIds.length,
    shouldLazyRestoreOffscreenWorkbenches,
    eagerTerminalIds,
    lazyTerminalIds,
    lazyWorkbenchIds,
  }
}

export function collectEagerRestoredTerminalIds(snapshot = {}) {
  const plan = buildRestoredTerminalBootstrapPlan(snapshot)
  if (plan.shouldLazyRestoreOffscreenWorkbenches) {
    return [...plan.eagerTerminalIds]
  }

  const activeWorkbench = plan.activeWorkbenchId
    ? snapshot?.workbenches?.[plan.activeWorkbenchId]
    : null
  if (!activeWorkbench) return []

  const activeTabId = activeWorkbench.activeTabId
    ?? activeWorkbench.tabIds?.[0]
    ?? null
  if (!activeTabId) return []

  const activeTab = snapshot?.tabs?.[activeTabId]
  if (!activeTab?.layoutRoot) return []

  const panelIds = collectPanelIdsFromLayout(activeTab.layoutRoot, [])
  return panelIds
    .map((panelId) => snapshot?.panels?.[panelId]?.terminalId ?? '')
    .filter((terminalId, index, list) => Boolean(terminalId) && list.indexOf(terminalId) === index)
}

export function normalizeRestoredPanelRuntime(panel, {
  readonlyHistory = false,
  terminalRestoreStrategy = DEFAULT_RESTORE_POLICY.terminalRestoreStrategy,
} = {}) {
  if (!panel || typeof panel !== 'object') {
    return panel
  }

  if (readonlyHistory) {
    return { ...panel }
  }

  const shouldPromoteToClaudeRuntime =
    panel.mode === 'claude-code' ||
    (typeof panel.claudeSessionId === 'string' && panel.claudeSessionId.trim())

  if (!shouldPromoteToClaudeRuntime) {
    const isClaudeOnlyRestore =
      resolveTerminalRestoreStrategy(terminalRestoreStrategy)
        === TERMINAL_RESTORE_STRATEGY.CLAUDE_ONLY
    const isOrdinaryShellPane =
      panel.mode === 'shell' &&
      !panel.teamId &&
      !(typeof panel.claudeSessionId === 'string' && panel.claudeSessionId.trim())

    if (!isClaudeOnlyRestore || !isOrdinaryShellPane) {
      return { ...panel }
    }

    return {
      ...panel,
      title: panel.title || getPanelAutoTitle(panel),
      shellState: 'idle',
      lastExitCode: 0,
      claudeActive: false,
    }
  }

  return {
    ...panel,
    mode: 'claude-code',
    shellHostedClaude: false,
    // Claude panes are recreated on restore, so old PTY exit/error markers are stale.
    shellState: 'idle',
    lastExitCode: null,
    claudeActive: true,
    teamStatus: panel.teamId ? null : panel.teamStatus,
    teamStatusIcon: panel.teamId ? null : panel.teamStatusIcon,
    teamStatusColor: panel.teamId ? null : panel.teamStatusColor,
  }
}
