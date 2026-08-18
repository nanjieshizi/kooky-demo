function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizePaneIndex(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }

  return undefined
}

export function normalizeTeamModePayload(teamMode) {
  if (!teamMode || typeof teamMode !== 'object' || teamMode.enabled !== true) {
    return undefined
  }

  const payload = { enabled: true }
  const teamId = normalizeNonEmptyString(teamMode.teamId)
  const role = normalizeNonEmptyString(teamMode.role)
  const workspaceId = normalizeNonEmptyString(teamMode.workspaceId)
  const surfaceId = normalizeNonEmptyString(teamMode.surfaceId)
  const paneIndex = normalizePaneIndex(teamMode.paneIndex)

  if (teamId) payload.teamId = teamId
  if (role) payload.role = role
  if (workspaceId) payload.workspaceId = workspaceId
  if (surfaceId) payload.surfaceId = surfaceId
  if (paneIndex !== undefined) payload.paneIndex = paneIndex

  return payload
}

export function cloneTeamModePayload(teamMode) {
  return normalizeTeamModePayload(teamMode)
}

export function resolveRecoveredTeamSurfaceId({ panel = null, nextSurfaceId = null } = {}) {
  const panelSurfaceId = normalizeNonEmptyString(panel?.teamSurfaceId)
  if (panelSurfaceId) {
    return panelSurfaceId
  }

  return typeof nextSurfaceId === 'function' ? nextSurfaceId() : ''
}

export function shouldShowTerminalWelcome({ mode = 'shell', teamMode = null } = {}) {
  return !(teamMode?.enabled === true)
}

export function isTeammateBootstrapCommand(text) {
  if (typeof text !== 'string') {
    return false
  }

  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized.startsWith('cd ')) {
    return false
  }

  return (
    normalized.includes(' && env ') &&
    normalized.includes('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1') &&
    normalized.includes('CLAUDE_CONFIG_DIR=')
  )
}

export function shouldIgnoreTeamSendText({ panel = null, text = '' } = {}) {
  if (!panel || panel.teamRole !== 'teammate' || panel.mode !== 'claude-code') {
    return false
  }

  return isTeammateBootstrapCommand(text)
}
