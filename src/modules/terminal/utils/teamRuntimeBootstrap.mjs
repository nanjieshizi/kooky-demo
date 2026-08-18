function normalizeTermId(termId) {
  return typeof termId === 'string' && termId.trim() ? termId.trim() : ''
}

function normalizeCwd(cwd) {
  return typeof cwd === 'string' && cwd.trim() ? cwd.trim() : ''
}

function shellQuote(value) {
  return `'${String(value || '').replace(/'/g, `'\"'\"'`)}'`
}

function normalizePermissionMode(permissionMode) {
  if (typeof permissionMode !== 'string') {
    return 'default'
  }
  const normalized = permissionMode.trim()
  return normalized || 'default'
}

function appendQuotedFlag(args, flag, value) {
  const normalized = typeof value === 'string' && value.trim() ? value.trim() : ''
  if (!normalized) {
    return
  }

  args.push(flag, shellQuote(normalized))
}

export function shouldReuseRuntimeManagedTerminal({
  runtimeManaged = false,
  termId = '',
  liveCwdMap = {},
} = {}) {
  if (runtimeManaged !== true) {
    return false
  }

  const normalizedTermId = normalizeTermId(termId)
  if (!normalizedTermId) {
    return false
  }

  return Boolean(liveCwdMap && typeof liveCwdMap === 'object' && liveCwdMap[normalizedTermId])
}

export function buildTeamTeammateBootstrapCommand({
  cwd = '',
  teamName = '',
  agentName = '',
  agentId = '',
  agentColor = '',
  parentSessionId = '',
  agentType = '',
  model = '',
  permissionMode = 'default',
  planModeRequired = false,
} = {}) {
  const pieces = []
  const normalizedCwd = normalizeCwd(cwd)

  if (normalizedCwd) {
    pieces.push(`cd -- ${shellQuote(normalizedCwd)}`)
  }

  const args = ['"$KC_NODE_PATH"', '"$KC_CLI_PATH"']
  const normalizedTeamName = typeof teamName === 'string' ? teamName.trim() : ''
  const normalizedAgentName = typeof agentName === 'string' ? agentName.trim() : ''
  const derivedAgentId = normalizedTeamName && normalizedAgentName
    ? `${normalizedAgentName}@${normalizedTeamName}`
    : ''
  const normalizedAgentId = typeof agentId === 'string' && agentId.trim()
    ? agentId.trim()
    : derivedAgentId

  appendQuotedFlag(args, '--agent-id', normalizedAgentId)
  appendQuotedFlag(args, '--agent-name', agentName)
  appendQuotedFlag(args, '--team-name', normalizedTeamName)
  appendQuotedFlag(args, '--agent-color', agentColor)
  appendQuotedFlag(args, '--parent-session-id', parentSessionId)
  appendQuotedFlag(args, '--agent-type', agentType)

  if (planModeRequired === true) {
    args.push('--plan-mode-required')
  } else {
    const normalizedPermissionMode = normalizePermissionMode(permissionMode)
    if (normalizedPermissionMode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions')
    } else if (normalizedPermissionMode === 'acceptEdits' || normalizedPermissionMode === 'auto') {
      args.push('--permission-mode', shellQuote(normalizedPermissionMode))
    }
  }

  appendQuotedFlag(args, '--model', model)
  appendQuotedFlag(args, '--teammate-mode', 'auto')

  pieces.push(
    `env CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CONFIG_DIR="$KC_CONFIG_DIR" ${args.join(' ')}`,
  )
  return `${pieces.join(' && ')}\r`
}

export function buildRestoredTeamLaunchPlan({
  panel = null,
  restoreSessionId = '',
} = {}) {
  const normalizedRestoreSessionId = normalizeTermId(restoreSessionId)
  const normalizedPanelSessionId = normalizeTermId(panel?.claudeSessionId)
  const resolvedResumeSessionId = normalizedRestoreSessionId || normalizedPanelSessionId

  if (panel?.teamRole === 'teammate') {
    return {
      launchMode: 'claude-code',
      resumeSessionId: resolvedResumeSessionId,
      queueShellBootstrap: false,
    }
  }

  return {
    launchMode: panel?.mode === 'shell' ? 'shell' : 'claude-code',
    resumeSessionId: resolvedResumeSessionId,
    queueShellBootstrap: false,
  }
}
