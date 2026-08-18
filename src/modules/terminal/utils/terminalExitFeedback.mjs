export function shouldSuppressTerminalExitFeedback({
  exitCode = null,
  suppressUntil = 0,
  suppressCodes = [],
  now = Date.now(),
} = {}) {
  if (!Number.isFinite(suppressUntil) || suppressUntil <= 0) {
    return false
  }

  if (now > suppressUntil) {
    return false
  }

  if (!Array.isArray(suppressCodes) || suppressCodes.length === 0) {
    return false
  }

  return suppressCodes.includes(exitCode)
}
