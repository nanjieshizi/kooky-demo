const SYNTHETIC_FOCUS_INPUTS = new Set(['\x1b[I', '\x1b[O'])

export function shouldSuppressSyntheticTerminalInput(data, suppressUntil = 0, now = Date.now()) {
  if (typeof data !== 'string' || !data) return false
  if (!Number.isFinite(suppressUntil) || suppressUntil <= 0) return false
  if (now > suppressUntil) return false
  return SYNTHETIC_FOCUS_INPUTS.has(data)
}
