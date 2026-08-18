export const TERMINAL_RESTORE_STRATEGY = {
  CLAUDE_ONLY: 'claude_only',
  LEGACY_FULL: 'legacy_full',
}

export const DEFAULT_RESTORE_POLICY = {
  terminalRestoreStrategy: TERMINAL_RESTORE_STRATEGY.CLAUDE_ONLY,
}

export function resolveTerminalRestoreStrategy(terminalRestoreStrategy = '') {
  return terminalRestoreStrategy === TERMINAL_RESTORE_STRATEGY.LEGACY_FULL
    ? TERMINAL_RESTORE_STRATEGY.LEGACY_FULL
    : DEFAULT_RESTORE_POLICY.terminalRestoreStrategy
}

