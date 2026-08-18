const FALLBACK_USER_STATE_KEY = 'kc-user-state-fallback'
const LEGACY_SHORTCUT_STORAGE_KEY = 'terminal-shortcut-commands'
const LEGACY_FEEDBACK_TOTAL_COUNT_KEY = 'claude-feedback-total-stop-count'
const LEGACY_FEEDBACK_USED_SKILLS_KEY = 'claude-feedback-used-skills'
const LEGACY_FEEDBACK_BAR_POSITION_KEY = 'claude-feedback-bar-position'

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNonNegativeNumber(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return num
}

function getElectronPersistentApi() {
  if (typeof window === 'undefined') return null
  return window.electronAPI?.persistentUserData || null
}

function getBrowserStorage(kind) {
  if (typeof window === 'undefined') return null
  try {
    return window[kind] || null
  } catch {
    return null
  }
}

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function createDefaultShortcutBarState() {
  return {
    commands: [],
    migratedFromLocalStorage: false,
    updatedAt: '',
  }
}

function createDefaultFeedbackStrategyState() {
  return {
    totalStopCount: 0,
    usedSkills: [],
    migratedFromLocalStorage: false,
    updatedAt: '',
  }
}

function createDefaultFeedbackFloatingBarState() {
  return {
    left: 16,
    bottom: 24,
    updatedAt: '',
  }
}

function createDefaultFeedbackState() {
  return {
    strategy: createDefaultFeedbackStrategyState(),
    floatingBar: createDefaultFeedbackFloatingBarState(),
    submittedRatings: {},
    updatedAt: '',
  }
}

function createDefaultUserState() {
  return {
    version: 1,
    updatedAt: '',
    shortcutBar: createDefaultShortcutBarState(),
    feedback: createDefaultFeedbackState(),
  }
}

function generateShortcutCommandId() {
  return `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeShortcutCommand(command) {
  if (!command || typeof command !== 'object') return null
  const label = normalizeText(command.label)
  const content = typeof command.command === 'string' ? command.command : ''
  if (!label || !content) return null

  const createdAtValue = Number(command.createdAt)
  const updatedAtValue = Number(command.updatedAt)

  return {
    id: normalizeText(command.id) || generateShortcutCommandId(),
    label,
    command: content,
    mode: command.mode === 'execute' ? 'execute' : 'input',
    color: typeof command.color === 'string' && command.color.trim() ? command.color.trim() : null,
    createdAt: Number.isFinite(createdAtValue) && createdAtValue > 0 ? createdAtValue : Date.now(),
    updatedAt: Number.isFinite(updatedAtValue) && updatedAtValue > 0 ? updatedAtValue : undefined,
  }
}

function sanitizeShortcutBarState(input) {
  const state = input && typeof input === 'object' ? input : {}
  return {
    commands: Array.isArray(state.commands) ? state.commands.map(sanitizeShortcutCommand).filter(Boolean) : [],
    migratedFromLocalStorage: state.migratedFromLocalStorage === true,
    updatedAt: normalizeText(state.updatedAt),
  }
}

function sanitizeFeedbackStrategyState(input) {
  const state = input && typeof input === 'object' ? input : {}
  return {
    totalStopCount: Math.max(0, Math.floor(Number(state.totalStopCount) || 0)),
    usedSkills: Array.from(
      new Set(
        (Array.isArray(state.usedSkills) ? state.usedSkills : [])
          .map((value) => normalizeText(value).toLowerCase())
          .filter(Boolean),
      ),
    ),
    migratedFromLocalStorage: state.migratedFromLocalStorage === true,
    updatedAt: normalizeText(state.updatedAt),
  }
}

function sanitizeFeedbackFloatingBarState(input) {
  const state = input && typeof input === 'object' ? input : {}
  return {
    left: normalizeNonNegativeNumber(state.left, 16),
    bottom: normalizeNonNegativeNumber(state.bottom, 24),
    updatedAt: normalizeText(state.updatedAt),
  }
}

export function buildFeedbackRecordKey({ source, sessionId, responseId }) {
  const normalizedSource = normalizeText(source)
  const normalizedSessionId = normalizeText(sessionId)
  const normalizedResponseId = normalizeText(responseId)
  if (!normalizedSource || !normalizedSessionId || !normalizedResponseId) return ''
  return `${normalizedSource}:${normalizedSessionId}:${normalizedResponseId}`
}

function sanitizeSubmittedFeedbackRecord(record, keyHint = '') {
  if (!record || typeof record !== 'object') return null
  const source = record.source === 'chat-message' ? 'chat-message' : (record.source === 'terminal-stop' ? 'terminal-stop' : '')
  const sessionId = normalizeText(record.sessionId)
  const responseId = normalizeText(record.responseId)
  const rating = Math.max(0, Math.min(3, Math.floor(Number(record.rating) || 0)))
  const key = buildFeedbackRecordKey({ source, sessionId, responseId }) || normalizeText(keyHint)
  if (!source || !sessionId || !responseId || !key) return null
  return {
    key,
    source,
    sessionId,
    responseId,
    rating,
    updatedAt: normalizeText(record.updatedAt) || nowIso(),
  }
}

function sanitizeFeedbackState(input) {
  const state = input && typeof input === 'object' ? input : {}
  const submittedRatings = {}
  if (state.submittedRatings && typeof state.submittedRatings === 'object') {
    Object.entries(state.submittedRatings).forEach(([key, value]) => {
      const normalized = sanitizeSubmittedFeedbackRecord(value, key)
      if (normalized?.key) {
        submittedRatings[normalized.key] = normalized
      }
    })
  }

  return {
    strategy: sanitizeFeedbackStrategyState(state.strategy),
    floatingBar: sanitizeFeedbackFloatingBarState(state.floatingBar),
    submittedRatings,
    updatedAt: normalizeText(state.updatedAt),
  }
}

function sanitizeUserState(input) {
  const state = input && typeof input === 'object' ? input : {}
  return {
    ...createDefaultUserState(),
    version: 1,
    updatedAt: normalizeText(state.updatedAt),
    shortcutBar: sanitizeShortcutBarState(state.shortcutBar),
    feedback: sanitizeFeedbackState(state.feedback),
  }
}

function readFallbackUserState() {
  const storage = getBrowserStorage('localStorage')
  if (!storage) return createDefaultUserState()
  try {
    const raw = storage.getItem(FALLBACK_USER_STATE_KEY)
    return sanitizeUserState(safeJsonParse(raw, createDefaultUserState()))
  } catch {
    return createDefaultUserState()
  }
}

function writeFallbackUserState(state) {
  const next = sanitizeUserState(state)
  next.updatedAt = nowIso()
  const storage = getBrowserStorage('localStorage')
  if (!storage) return next
  try {
    storage.setItem(FALLBACK_USER_STATE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

async function getNamespace(namespace) {
  const api = getElectronPersistentApi()
  if (!api?.get) {
    return readFallbackUserState()[namespace]
  }
  try {
    const result = await api.get(namespace)
    if (result?.success) {
      return result.data
    }
  } catch {
    // ignore
  }
  return readFallbackUserState()[namespace]
}

async function setNamespace(namespace, data) {
  const api = getElectronPersistentApi()
  if (!api?.set) {
    const nextState = readFallbackUserState()
    nextState[namespace] = data
    return writeFallbackUserState(nextState)[namespace]
  }
  try {
    const result = await api.set(namespace, data)
    if (result?.success) return result.data
  } catch {
    // ignore
  }
  const nextState = readFallbackUserState()
  nextState[namespace] = data
  return writeFallbackUserState(nextState)[namespace]
}

function readLegacyShortcutCommands() {
  const storage = getBrowserStorage('localStorage')
  if (!storage) return []
  try {
    const raw = storage.getItem(LEGACY_SHORTCUT_STORAGE_KEY)
    const parsed = safeJsonParse(raw, [])
    return Array.isArray(parsed) ? parsed.map(sanitizeShortcutCommand).filter(Boolean) : []
  } catch {
    return []
  }
}

function clearLegacyShortcutCommands() {
  const storage = getBrowserStorage('localStorage')
  if (!storage) return
  try {
    storage.removeItem(LEGACY_SHORTCUT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

function readLegacyFeedbackStrategy() {
  let totalStopCount = 0
  let usedSkills = []
  const storage = getBrowserStorage('localStorage')
  if (!storage) {
    return sanitizeFeedbackStrategyState({
      totalStopCount,
      usedSkills,
      migratedFromLocalStorage: false,
      updatedAt: '',
    })
  }

  try {
    totalStopCount = Math.max(0, parseInt(storage.getItem(LEGACY_FEEDBACK_TOTAL_COUNT_KEY), 10) || 0)
  } catch {
    totalStopCount = 0
  }

  try {
    const parsed = safeJsonParse(storage.getItem(LEGACY_FEEDBACK_USED_SKILLS_KEY), [])
    usedSkills = Array.isArray(parsed) ? parsed : []
  } catch {
    usedSkills = []
  }

  return sanitizeFeedbackStrategyState({
    totalStopCount,
    usedSkills,
    migratedFromLocalStorage: totalStopCount > 0 || usedSkills.length > 0,
    updatedAt: totalStopCount > 0 || usedSkills.length > 0 ? nowIso() : '',
  })
}

function clearLegacyFeedbackStrategy() {
  const storage = getBrowserStorage('localStorage')
  if (!storage) return
  try {
    storage.removeItem(LEGACY_FEEDBACK_TOTAL_COUNT_KEY)
    storage.removeItem(LEGACY_FEEDBACK_USED_SKILLS_KEY)
  } catch {
    // ignore
  }
}

function readLegacyFeedbackBarPosition() {
  const storage = getBrowserStorage('sessionStorage')
  if (!storage) return null
  try {
    const parsed = safeJsonParse(storage.getItem(LEGACY_FEEDBACK_BAR_POSITION_KEY), null)
    if (!parsed || typeof parsed !== 'object') return null
    return sanitizeFeedbackFloatingBarState({
      left: parsed.left,
      bottom: parsed.bottom,
      updatedAt: nowIso(),
    })
  } catch {
    return null
  }
}

function clearLegacyFeedbackBarPosition() {
  const storage = getBrowserStorage('sessionStorage')
  if (!storage) return
  try {
    storage.removeItem(LEGACY_FEEDBACK_BAR_POSITION_KEY)
  } catch {
    // ignore
  }
}

export async function loadShortcutBarState() {
  let state = sanitizeShortcutBarState(await getNamespace('shortcutBar'))
  if (state.commands.length > 0 || state.migratedFromLocalStorage) {
    return state
  }

  const legacyCommands = readLegacyShortcutCommands()
  if (!legacyCommands.length) {
    return state
  }

  state = {
    ...state,
    commands: legacyCommands,
    migratedFromLocalStorage: true,
    updatedAt: nowIso(),
  }
  await setNamespace('shortcutBar', state)
  clearLegacyShortcutCommands()
  return state
}

export async function saveShortcutBarCommands(commands) {
  const current = await loadShortcutBarState()
  const next = {
    ...current,
    commands: Array.isArray(commands) ? commands.map(sanitizeShortcutCommand).filter(Boolean) : [],
    updatedAt: nowIso(),
  }
  return sanitizeShortcutBarState(await setNamespace('shortcutBar', next))
}

export async function loadFeedbackState() {
  let state = sanitizeFeedbackState(await getNamespace('feedback'))
  let shouldPersist = false

  if (
    !state.strategy.migratedFromLocalStorage &&
    state.strategy.totalStopCount === 0 &&
    state.strategy.usedSkills.length === 0
  ) {
    const legacyStrategy = readLegacyFeedbackStrategy()
    if (legacyStrategy.totalStopCount > 0 || legacyStrategy.usedSkills.length > 0) {
      state = {
        ...state,
        strategy: {
          ...legacyStrategy,
          migratedFromLocalStorage: true,
        },
      }
      shouldPersist = true
    }
  }

  if (!state.floatingBar.updatedAt) {
    const legacyPosition = readLegacyFeedbackBarPosition()
    if (legacyPosition) {
      state = {
        ...state,
        floatingBar: legacyPosition,
      }
      shouldPersist = true
    }
  }

  if (shouldPersist) {
    state.updatedAt = nowIso()
    state = sanitizeFeedbackState(await setNamespace('feedback', state))
    clearLegacyFeedbackStrategy()
    clearLegacyFeedbackBarPosition()
  }

  return state
}

export async function saveFeedbackStrategyState(strategy) {
  const current = await loadFeedbackState()
  const next = {
    ...current,
    strategy: {
      ...current.strategy,
      ...sanitizeFeedbackStrategyState(strategy),
      updatedAt: nowIso(),
    },
    updatedAt: nowIso(),
  }
  return sanitizeFeedbackState(await setNamespace('feedback', next)).strategy
}

export async function loadFeedbackFloatingBarPosition() {
  const state = await loadFeedbackState()
  return state.floatingBar
}

export async function saveFeedbackFloatingBarPosition(position) {
  const current = await loadFeedbackState()
  const next = {
    ...current,
    floatingBar: {
      ...current.floatingBar,
      ...sanitizeFeedbackFloatingBarState(position),
      updatedAt: nowIso(),
    },
    updatedAt: nowIso(),
  }
  return sanitizeFeedbackState(await setNamespace('feedback', next)).floatingBar
}

export async function getSubmittedFeedbackRecord({ source, sessionId, responseId }) {
  const key = buildFeedbackRecordKey({ source, sessionId, responseId })
  if (!key) return null
  const state = await loadFeedbackState()
  return state.submittedRatings[key] || null
}

export async function saveSubmittedFeedbackRecord({ source, sessionId, responseId, rating }) {
  const current = await loadFeedbackState()
  const record = sanitizeSubmittedFeedbackRecord({
    source,
    sessionId,
    responseId,
    rating,
    updatedAt: nowIso(),
  })
  if (!record?.key) return null

  const next = {
    ...current,
    submittedRatings: {
      ...current.submittedRatings,
      [record.key]: record,
    },
    updatedAt: nowIso(),
  }
  const savedState = sanitizeFeedbackState(await setNamespace('feedback', next))
  return savedState.submittedRatings[record.key] || null
}

export async function removeSubmittedFeedbackRecord({ source, sessionId, responseId }) {
  const key = buildFeedbackRecordKey({ source, sessionId, responseId })
  if (!key) return false
  const current = await loadFeedbackState()
  if (!current.submittedRatings[key]) return false

  const nextRatings = { ...current.submittedRatings }
  delete nextRatings[key]

  await setNamespace('feedback', {
    ...current,
    submittedRatings: nextRatings,
    updatedAt: nowIso(),
  })
  return true
}

export async function loadChatFeedbackSelection({ spaceId, messageId }) {
  const record = await getSubmittedFeedbackRecord({
    source: 'chat-message',
    sessionId: spaceId,
    responseId: messageId,
  })

  if (!record) return null
  if (record.rating === 3) return 'like'
  if (record.rating === 1) return 'dislike'
  return null
}
