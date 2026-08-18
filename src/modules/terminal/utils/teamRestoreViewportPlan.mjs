function normalizeAliasCount(value) {
  if (Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }

  return 0
}

export function resolveTeamRestoreViewportPlan({
  mode = 'shell',
  resumeSessionId = '',
  teamMode = null,
  restoreHints = null,
} = {}) {
  const hasResumeSessionId = typeof resumeSessionId === 'string' && resumeSessionId.trim().length > 0
  const aliasCount = normalizeAliasCount(restoreHints?.staleAliasCount)

  if (
    mode !== 'claude-code' ||
    !hasResumeSessionId ||
    teamMode?.enabled !== true ||
    teamMode?.role !== 'leader' ||
    restoreHints?.clearStaleLeaderHistoryOnRestore !== true ||
    aliasCount <= 0
  ) {
    return null
  }

  return {
    clearViewport: true,
    focusTerminal: true,
    suppressSyntheticFocusInput: true,
    suppressSyntheticFocusInputMs: 800,
  }
}
