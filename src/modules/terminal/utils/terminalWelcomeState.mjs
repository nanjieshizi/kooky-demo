export const TERMINAL_WELCOME_PHASE = {
  HIDDEN: 'hidden',
  LOADING: 'loading',
  READY: 'ready',
}

const RESTORED_WELCOME_MIN_VISIBLE_MS = 600

function hasLoadingWelcome(currentState = {}) {
  return currentState.visible && currentState.phase === TERMINAL_WELCOME_PHASE.LOADING
}

function hasResumeSession(resumeSessionId = '') {
  return typeof resumeSessionId === 'string' && resumeSessionId.trim().length > 0
}

function isRestoredClaudeResume({ mode = 'shell', resumeSessionId = '' } = {}) {
  return mode === 'claude-code' && hasResumeSession(resumeSessionId)
}

function isRestoredWelcomeFlow({ restoredSession = false, resumeSessionId = '' } = {}) {
  return restoredSession || hasResumeSession(resumeSessionId)
}

function createHiddenWelcomeState() {
  return {
    visible: false,
    phase: TERMINAL_WELCOME_PHASE.HIDDEN,
    dismissOnInput: false,
    minVisibleUntil: 0,
  }
}

export function getRemainingLoadingWelcomeMs(currentState = {}, { now = Date.now() } = {}) {
  if (!hasLoadingWelcome(currentState)) {
    return 0
  }

  const minVisibleUntil = Number(currentState.minVisibleUntil || 0)
  if (!Number.isFinite(minVisibleUntil) || minVisibleUntil <= 0) {
    return 0
  }

  return Math.max(0, minVisibleUntil - now)
}

export function createInitialWelcomeState({
  mode = 'shell',
  readonlyHistory = false,
  restoredSession = false,
  resumeSessionId = '',
  teamMode = null,
  now = Date.now(),
} = {}) {
  if (readonlyHistory) {
    return createHiddenWelcomeState()
  }

  const restoredWelcomeFlow = isRestoredWelcomeFlow({ restoredSession, resumeSessionId })
  const shouldShow = !(mode === 'claude-code' && teamMode?.enabled === true && !restoredWelcomeFlow)
  if (!shouldShow) {
    return createHiddenWelcomeState()
  }

  return {
    visible: true,
    phase: TERMINAL_WELCOME_PHASE.LOADING,
    dismissOnInput: !restoredWelcomeFlow,
    minVisibleUntil: restoredWelcomeFlow ? now + RESTORED_WELCOME_MIN_VISIBLE_MS : 0,
  }
}

export function resolveWelcomeReadyState(currentState = {}, { now = Date.now() } = {}) {
  if (!hasLoadingWelcome(currentState)) {
    return currentState
  }

  if (getRemainingLoadingWelcomeMs(currentState, { now }) > 0) {
    return currentState
  }

  if (!currentState.dismissOnInput) {
    return createHiddenWelcomeState()
  }

  return {
    visible: true,
    phase: TERMINAL_WELCOME_PHASE.READY,
    dismissOnInput: true,
    minVisibleUntil: 0,
  }
}

export function shouldDismissReadyWelcomeOnInput(currentState = {}, input = '') {
  if (!currentState.visible || currentState.phase !== TERMINAL_WELCOME_PHASE.READY) {
    return false
  }

  if (typeof input !== 'string' || !input) {
    return false
  }

  return /[^\r\n\t]/.test(input)
}

export function shouldAutoAdvanceLoadingWelcomeOnPtyData({
  currentState = {},
  mode = 'shell',
  resumeSessionId = '',
} = {}) {
  if (!hasLoadingWelcome(currentState)) {
    return false
  }

  return !isRestoredClaudeResume({ mode, resumeSessionId })
}

export function shouldAutoAdvanceLoadingWelcomeOnClaudeStatus({
  currentState = {},
  mode = 'shell',
  resumeSessionId = '',
  statusPayload = null,
} = {}) {
  if (!hasLoadingWelcome(currentState)) {
    return false
  }

  if (!isRestoredClaudeResume({ mode, resumeSessionId })) {
    return false
  }

  if (!statusPayload || typeof statusPayload !== 'object') {
    return false
  }

  return Boolean(
    (typeof statusPayload.session_id === 'string' && statusPayload.session_id.trim()) ||
    (typeof statusPayload.transcript_path === 'string' && statusPayload.transcript_path.trim()) ||
    (typeof statusPayload.model === 'string' && statusPayload.model.trim()) ||
    (statusPayload.model && typeof statusPayload.model === 'object' && Object.keys(statusPayload.model).length > 0)
  )
}

export function shouldAutoAdvanceLoadingWelcomeOnResumeSettled({
  currentState = {},
  mode = 'shell',
  resumeSessionId = '',
} = {}) {
  if (!hasLoadingWelcome(currentState)) {
    return false
  }

  return isRestoredClaudeResume({ mode, resumeSessionId })
}
