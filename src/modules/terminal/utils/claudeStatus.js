const SPEED_WINDOW_MS = 2000
const tokenSpeedCache = new Map()

function getTotalContextTokens(payload) {
  const usage = payload?.context_window?.current_usage
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  )
}

function getContextPercent(payload) {
  const nativePercent = payload?.context_window?.used_percentage
  if (typeof nativePercent === 'number' && !Number.isNaN(nativePercent)) {
    return Math.min(100, Math.max(0, Math.round(nativePercent)))
  }

  const contextSize = payload?.context_window?.context_window_size
  if (!(contextSize > 0)) return null

  return Math.min(100, Math.round((getTotalContextTokens(payload) / contextSize) * 100))
}

function normalizeModelName(payload) {
  const displayName = payload?.model?.display_name
  if (displayName) return String(displayName)

  const modelId = payload?.model?.id
  if (!modelId) return undefined

  const normalized = String(modelId).toLowerCase()
  const prefix = 'anthropic.claude-'
  const index = normalized.indexOf(prefix)
  if (index === -1) return String(modelId)

  let suffix = normalized.slice(index + prefix.length)
  suffix = suffix.replace(/-v\d+:\d+$/, '')
  suffix = suffix.replace(/-\d{8}$/, '')

  const tokens = suffix.split('-').filter(Boolean)
  const familyIndex = tokens.findIndex(token => ['haiku', 'sonnet', 'opus'].includes(token))
  if (familyIndex === -1) return String(modelId)

  const family = tokens[familyIndex]
  const versionParts = []
  for (let i = familyIndex + 1; i < tokens.length; i += 1) {
    if (!/^\d+$/.test(tokens[i])) break
    versionParts.push(tokens[i])
    if (versionParts.length === 2) break
  }

  const familyLabel = family[0].toUpperCase() + family.slice(1)
  return versionParts.length > 0
    ? `Claude ${familyLabel} ${versionParts.join('.')}`
    : `Claude ${familyLabel}`
}

function getRollingTokenSpeed(outputTokens, sessionKey, now) {
  if (!sessionKey || typeof outputTokens !== 'number' || !Number.isFinite(outputTokens)) {
    return null
  }

  const previous = tokenSpeedCache.get(sessionKey)
  let speed = null

  if (previous && outputTokens >= previous.outputTokens) {
    const deltaTokens = outputTokens - previous.outputTokens
    const deltaMs = now - previous.timestamp
    if (deltaTokens > 0 && deltaMs > 0 && deltaMs <= SPEED_WINDOW_MS) {
      speed = deltaTokens / (deltaMs / 1000)
    }
  }

  tokenSpeedCache.set(sessionKey, { outputTokens, timestamp: now })
  return speed
}

export function resetClaudeTokenSpeedTrackerForTests() {
  tokenSpeedCache.clear()
}

export function parseClaudeStatusPayload(payload, options = {}) {
  if (!payload || typeof payload !== 'object') return {}

  const parsed = {}
  const now = typeof options.now === 'number' ? options.now : Date.now()
  const sessionKey = options.sessionKey || payload.termId || payload.session_id || payload.transcript_path || ''

  if (payload.cwd) parsed.cwd = String(payload.cwd)
  if (payload.session_id) parsed.sessionId = String(payload.session_id)
  if (payload.transcript_path) parsed.transcriptPath = String(payload.transcript_path)
  parsed.model = normalizeModelName(payload)

  const contextPercent = getContextPercent(payload)
  if (contextPercent != null) parsed.contextPercent = contextPercent
  if (payload.cost?.total_cost_usd != null) {
    parsed.costUsd = payload.cost.total_cost_usd
  }

  const outputTokens = payload.context_window?.current_usage?.output_tokens
  parsed.tokenSpeed = getRollingTokenSpeed(outputTokens, sessionKey, now)

  return parsed
}
