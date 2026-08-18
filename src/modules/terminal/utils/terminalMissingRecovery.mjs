function sanitizeReplayData(replayData) {
  if (typeof replayData !== 'string' || !replayData) {
    return ''
  }

  // xterm 在聚焦/终端属性协商期间可能产生内部控制序列；
  // 这些数据不是用户真实输入，重放到新 PTY 会直接把转义串打到屏幕上。
  if (replayData === '\u001b[I' || replayData === '\u001b[O') {
    return ''
  }
  if (/^\u001b\[\?[0-9;]*c(?:\u001b\[[IO])?$/.test(replayData)) {
    return ''
  }

  return replayData
}

export function resolveMissingTerminalRecoveryPlan({
  mode = 'claude-code',
  aiPermissionMode = 'default',
  replayData = '',
} = {}) {
  const normalizedMode = typeof mode === 'string' ? mode.trim().toLowerCase() : 'claude-code'
  const normalizedPermissionMode =
    typeof aiPermissionMode === 'string' ? aiPermissionMode.trim() : 'default'

  const isClaudeBypassRecovery =
    normalizedMode === 'claude-code' && normalizedPermissionMode === 'bypassPermissions'

  return {
    hardReset: isClaudeBypassRecovery,
    showRecoveryNotice: !isClaudeBypassRecovery,
    replayData: sanitizeReplayData(replayData),
  }
}
