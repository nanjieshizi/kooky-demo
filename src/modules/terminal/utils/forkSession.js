export function isClaudeSessionPanel(panel) {
  return Boolean(panel && panel.mode === 'claude-code')
}

export function shouldResumeClaudeSession(panel) {
  if (!panel) return false
  // 有 claudeSessionId 即尝试 resume（claudeActive 在 Claude 退出后为 false，不可靠）
  // resume 失败时 handleResumeFailed 会清除 sessionId 并降级为 shell
  return !!panel.claudeSessionId
}

export function getPanelLaunchMode(panel) {
  if (shouldResumeClaudeSession(panel)) {
    return 'claude-code'
  }

  return panel?.mode || 'shell'
}

export function shouldReplayTerminalScrollback(panel) {
  return !shouldResumeClaudeSession(panel)
}

export function canForkSessionPanel(panel) {
  if (!isClaudeSessionPanel(panel)) {
    return { canFork: false, reason: 'not_claude_code' }
  }

  if (panel?.detached) {
    return { canFork: false, reason: 'detached_window_not_supported' }
  }

  if (panel?.teamId || panel?.teamRole) {
    return { canFork: false, reason: 'team_session_not_supported' }
  }

  if (!panel.claudeSessionId) {
    return { canFork: false, reason: 'missing_session_id' }
  }

  return { canFork: true, reason: '' }
}

export function buildForkLaunchData(panel) {
  const state = canForkSessionPanel(panel)
  if (!state.canFork) return null

  return {
    resumeSessionId: panel.claudeSessionId,
    forkSession: true,
    cwd: panel.cwd || '',
  }
}
