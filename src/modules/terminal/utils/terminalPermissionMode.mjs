const PERMISSION_MODE_PHRASES = [
  { mode: 'bypassPermissions', phrases: ['bypass permissions on'] },
  { mode: 'acceptEdits', phrases: ['accept edits on'] },
  { mode: 'plan', phrases: ['plan mode on', 'plan on'] },
  { mode: 'default', phrases: ['default mode on', 'default on'] },
]

const ANSI_CSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g
const ANSI_OSC_PATTERN = /\x1b\][^\u0007]*(?:\u0007|\x1b\\)/g
const TRACKER_WINDOW_SIZE = 512

function stripTerminalPermissionControlSequences(data) {
  if (typeof data !== 'string' || !data) return ''
  return data
    .replace(ANSI_OSC_PATTERN, '')
    .replace(ANSI_CSI_PATTERN, '')
    .toLowerCase()
}

function normalizeTerminalPermissionText(data) {
  return stripTerminalPermissionControlSequences(data)
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveLatestPermissionMode(text) {
  if (!text) return null

  let latestMatch = null
  for (const candidate of PERMISSION_MODE_PHRASES) {
    for (const phrase of candidate.phrases) {
      const index = text.lastIndexOf(phrase)
      if (index === -1) continue
      if (!latestMatch || index > latestMatch.index) {
        latestMatch = {
          mode: candidate.mode,
          index,
        }
      }
    }
  }

  return latestMatch?.mode || null
}

export function detectPermissionModeFromTerminalOutput(data) {
  return resolveLatestPermissionMode(normalizeTerminalPermissionText(data))
}

export function detectPermissionModeFromTerminalLines(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) return null
  return resolveLatestPermissionMode(normalizeTerminalPermissionText(lines.join('\n')))
}

export function createTerminalPermissionModeTracker(initialText = '') {
  let buffer = stripTerminalPermissionControlSequences(initialText).slice(-TRACKER_WINDOW_SIZE)

  return {
    push(data) {
      const stripped = stripTerminalPermissionControlSequences(data)
      if (!stripped) return null
      buffer = `${buffer}${stripped}`.slice(-TRACKER_WINDOW_SIZE)
      return resolveLatestPermissionMode(normalizeTerminalPermissionText(buffer))
    },
    reset() {
      buffer = ''
    },
    snapshot() {
      return normalizeTerminalPermissionText(buffer)
    },
  }
}
