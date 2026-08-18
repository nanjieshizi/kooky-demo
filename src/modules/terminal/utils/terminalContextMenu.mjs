export function canStartKoTeams(panel) {
  if (!panel) return false
  return panel.mode === 'shell'
    && panel.isActivePane === true
    && !panel.teamId
    && !panel.readonlyHistory
}

export function getPaneContextActions({ source, panel, canFork }) {
  if (source === 'tab') {
    return [
      { key: 'rename-tab', label: '✎ 重命名' },
    ]
  }
  const actions = []
  if (source === 'pane' && canFork) {
    actions.push({ key: 'fork-session', label: '⑂ Fork 会话' })
  }
  if (source === 'pane' && canStartKoTeams(panel)) {
    actions.push({ key: 'ko-teams', label: '启动团队' })
  }
  if (source === 'pane' && panel?.mode === 'claude-code' && panel?.claudeSessionId) {
    actions.push({ key: 'export-session', label: '⤓ 导出会话' })
  }
  if (source === 'pane') {
    actions.push({ key: 'detach-window', label: '↗ 独立窗口' })
  }
  return actions
}

export function getTerminalContextActions({ panel, hasSelection, canPaste = true }) {
  const actions = [
    { key: 'copy', label: '复制', disabled: !hasSelection },
    { key: 'paste', label: '粘贴', disabled: !canPaste },
  ]
  if (canStartKoTeams(panel)) {
    actions.push({ key: 'ko-teams', label: '启动团队' })
  }

  return actions
}
