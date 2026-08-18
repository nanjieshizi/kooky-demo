import { getPanelRuntimeState, getPanelTeamBadgeLabel, STATUS_LABELS } from './panelRuntimeState.mjs'

export function getPaneHeaderTeamPresentation(panel, fallbackTitle = 'Claude Code') {
  if (!panel?.teamRole) {
    return null
  }

  const teamLabel = typeof panel.teamLabel === 'string' ? panel.teamLabel.trim() : ''
  const runtimeState = getPanelRuntimeState(panel)
  const badgeLabel = getPanelTeamBadgeLabel(panel)

  return {
    title: teamLabel || fallbackTitle,
    badgeLabel,
    statusLabel: runtimeState.label || STATUS_LABELS.idle,
    statusIcon: null,
    statusTone: runtimeState.tone,
  }
}

export function getTeamStatusBarPresentation(panel) {
  if (!panel?.teamRole) {
    return null
  }

  const runtimeState = getPanelRuntimeState(panel)

  return {
    roleLabel: getPanelTeamBadgeLabel(panel),
    statusLabel: runtimeState.label || STATUS_LABELS.idle,
    statusTone: runtimeState.tone,
  }
}
