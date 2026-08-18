const STATUS_LABELS = {
  running: '运行中',
  'needs-input': '待输入',
  error: '错误',
  exited: '已退出',
  idle: '空闲',
}

const STATUS_DOT_COLORS = {
  running: '#3fb950',
  'needs-input': '#d29922',
  error: '#f85149',
  exited: '#484f58',
  idle: '#8b949e',
}

function hasActiveClaudeWork(panel) {
  if (!panel) return false
  return (
    (panel.aiActiveSubagentCount ?? 0) > 0 ||
    (panel.aiActiveToolCount ?? 0) > 0 ||
    (Array.isArray(panel.aiRunningTools) && panel.aiRunningTools.length > 0)
  )
}

function normalizeStatusTone(statusTone) {
  if (statusTone === 'running' || statusTone === 'needs-input' || statusTone === 'error' || statusTone === 'exited') {
    return statusTone
  }
  return 'idle'
}

export function getPanelRuntimeState(panel) {
  if (!panel) {
    return {
      tone: 'idle',
      label: STATUS_LABELS.idle,
      dotColor: null,
      statusFieldLabel: '',
      source: 'none',
      hasClaudeWork: false,
    }
  }

  const busy = hasActiveClaudeWork(panel)

  if (panel.shellState === 'error') {
    return {
      tone: 'error',
      label: STATUS_LABELS.error,
      dotColor: STATUS_DOT_COLORS.error,
      statusFieldLabel: panel.teamRole ? STATUS_LABELS.error : '失败',
      source: 'shell',
      hasClaudeWork: busy,
    }
  }

  if (panel.shellState === 'exited' && !panel.claudeActive) {
    return {
      tone: 'exited',
      label: STATUS_LABELS.exited,
      dotColor: STATUS_DOT_COLORS.exited,
      statusFieldLabel: panel.teamRole ? STATUS_LABELS.exited : STATUS_LABELS.exited,
      source: 'shell',
      hasClaudeWork: busy,
    }
  }

  if (panel.teamRole) {
    const tone = normalizeStatusTone(panel.teamStatus)
    return {
      tone,
      label: STATUS_LABELS[tone],
      dotColor: tone === 'idle' ? null : STATUS_DOT_COLORS[tone],
      statusFieldLabel: STATUS_LABELS[tone],
      source: 'team',
      hasClaudeWork: busy,
    }
  }

  if (panel.claudeActive && busy) {
    return {
      tone: 'running',
      label: STATUS_LABELS.running,
      dotColor: STATUS_DOT_COLORS.running,
      statusFieldLabel: '任务中',
      source: 'claude',
      hasClaudeWork: true,
    }
  }

  if (panel.shellState === 'running' || panel.shellState === 'ai-busy') {
    return {
      tone: 'running',
      label: STATUS_LABELS.running,
      dotColor: STATUS_DOT_COLORS.running,
      statusFieldLabel: STATUS_LABELS.running,
      source: 'shell',
      hasClaudeWork: busy,
    }
  }

    return {
      tone: 'idle',
      label: STATUS_LABELS.idle,
      dotColor: null,
      statusFieldLabel: panel.teamRole ? STATUS_LABELS.idle : '',
      source: panel.claudeActive ? 'claude' : 'shell',
      hasClaudeWork: busy,
  }
}

export function getPanelTeamBadgeLabel(panel) {
  if (!panel?.teamRole) return ''
  const teamLabel = typeof panel.teamLabel === 'string' ? panel.teamLabel.trim() : ''
  return panel.teamRole === 'leader'
    ? 'Leader'
    : (teamLabel ? `@${teamLabel}` : 'Agent')
}

export function buildNotificationTeamMeta(panel) {
  if (!panel) return {}
  const runtimeState = getPanelRuntimeState(panel)
  return {
    teamId: panel.teamId ?? null,
    teamRole: panel.teamRole ?? null,
    teamLabel: typeof panel.teamLabel === 'string' ? panel.teamLabel.trim() : '',
    teamStatus: panel.teamStatus ?? null,
    statusTone: runtimeState.tone,
    statusLabel: runtimeState.label,
    roleLabel: getPanelTeamBadgeLabel(panel) || '',
  }
}

export { STATUS_LABELS, STATUS_DOT_COLORS }
