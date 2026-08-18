function normalizePositiveInteger(value) {
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null
}

export function normalizeTerminalExitPayload(payload) {
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return {
      exitCode: payload,
      pid: null,
    }
  }

  if (!payload || typeof payload !== 'object') {
    return {
      exitCode: 0,
      pid: null,
    }
  }

  return {
    exitCode: Number.isFinite(payload.exitCode) ? payload.exitCode : 0,
    pid: normalizePositiveInteger(payload.pid),
  }
}

export function shouldTreatExitAsResumeFailure({
  resumeState = 'NONE',
  expectedPid = null,
  exitPayload,
} = {}) {
  if (resumeState !== 'RESUMING') {
    return false
  }

  const normalizedExit = normalizeTerminalExitPayload(exitPayload)
  const normalizedExpectedPid = normalizePositiveInteger(expectedPid)

  if (
    normalizedExpectedPid != null &&
    normalizedExit.pid != null &&
    normalizedExit.pid !== normalizedExpectedPid
  ) {
    return false
  }

  return true
}
