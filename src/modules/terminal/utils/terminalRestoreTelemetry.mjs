function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeCount(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function safeAppendMetadataEvent(appendMetadataEvent, event) {
  if (typeof appendMetadataEvent !== 'function') return
  try {
    appendMetadataEvent(event)
  } catch (error) {
    console.warn('[terminalRestoreTelemetry] append metadata failed:', error?.message || error)
  }
}

function createRestoreRunId() {
  return `restore_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function startTerminalRestoreTelemetryRun({
  appendMetadataEvent = null,
  observeTerminalBootstraps = null,
  plan = {},
} = {}) {
  const startedAt = Date.now()
  const runId = createRestoreRunId()
  const state = {
    runId,
    startedAt,
    finishedAt: null,
    status: 'running',
    totalRecoveredSessions: normalizeCount(plan.totalRecoveredSessions),
    autoBootstrapTotal: normalizeCount(plan.autoBootstrapTotal),
    lazyMetadataOnlyCount: normalizeCount(plan.lazyMetadataOnlyCount),
    threshold: normalizeCount(plan.threshold),
    activeProjectId: normalizeText(plan.activeProjectId),
    activeWorkbenchId: normalizeText(plan.activeWorkbenchId),
    lazyWorkbenchIds: Array.isArray(plan.lazyWorkbenchIds)
      ? plan.lazyWorkbenchIds.map(normalizeText).filter(Boolean)
      : [],
    eagerTerminalIds: Array.isArray(plan.eagerTerminalIds)
      ? plan.eagerTerminalIds.map(normalizeText).filter(Boolean)
      : [],
    completed: 0,
    succeeded: 0,
    failed: 0,
    lastCompletedIndex: 0,
  }

  let stopped = false
  let finished = false
  let unsubscribe = null

  function append(type, payload = {}) {
    safeAppendMetadataEvent(appendMetadataEvent, {
      type,
      payload: {
        runId,
        ...payload,
      },
    })
  }

  function stop() {
    if (stopped) return
    stopped = true
    if (typeof unsubscribe === 'function') {
      unsubscribe()
    }
    unsubscribe = null
  }

  function finish(extraPayload = {}) {
    if (finished) return
    finished = true
    state.status = 'completed'
    state.finishedAt = Date.now()
    append('restore-runtime-finished', {
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      totalRecoveredSessions: state.totalRecoveredSessions,
      autoBootstrapTotal: state.autoBootstrapTotal,
      lazyMetadataOnlyCount: state.lazyMetadataOnlyCount,
      completed: state.completed,
      succeeded: state.succeeded,
      failed: state.failed,
      lastCompletedIndex: state.lastCompletedIndex,
      threshold: state.threshold,
      activeProjectId: state.activeProjectId,
      activeWorkbenchId: state.activeWorkbenchId,
      lazyWorkbenchIds: state.lazyWorkbenchIds,
      eagerTerminalIds: state.eagerTerminalIds,
      ...extraPayload,
    })
    stop()
  }

  append('restore-runtime-started', {
    startedAt: state.startedAt,
    status: state.status,
    totalRecoveredSessions: state.totalRecoveredSessions,
    autoBootstrapTotal: state.autoBootstrapTotal,
    lazyMetadataOnlyCount: state.lazyMetadataOnlyCount,
    completed: state.completed,
    succeeded: state.succeeded,
    failed: state.failed,
    lastCompletedIndex: state.lastCompletedIndex,
    threshold: state.threshold,
    activeProjectId: state.activeProjectId,
    activeWorkbenchId: state.activeWorkbenchId,
    lazyWorkbenchIds: state.lazyWorkbenchIds,
    eagerTerminalIds: state.eagerTerminalIds,
  })

  if (state.autoBootstrapTotal <= 0) {
    finish()
    return {
      runId,
      stop,
      finish,
      isFinished: () => true,
    }
  }

  const observer = {
    onTaskFinish(payload = {}) {
      if (stopped) return
      if (normalizeText(payload?.meta?.restoreRunId) !== runId) return

      state.completed += 1
      if (payload.success === false) {
        state.failed += 1
      } else {
        state.succeeded += 1
      }
      state.lastCompletedIndex = state.completed

      append('restore-runtime-progress', {
        batchId: normalizeCount(payload.batchId),
        terminalId: normalizeText(payload?.meta?.termId),
        panelId: normalizeText(payload?.meta?.panelId),
        workbenchId: normalizeText(payload?.meta?.workbenchId),
        success: payload.success !== false,
        durationMs: normalizeCount(payload.durationMs),
        completed: state.completed,
        succeeded: state.succeeded,
        failed: state.failed,
        lastCompletedIndex: state.lastCompletedIndex,
        autoBootstrapTotal: state.autoBootstrapTotal,
        totalRecoveredSessions: state.totalRecoveredSessions,
      })

      if (state.completed >= state.autoBootstrapTotal) {
        finish()
      }
    },

    onBatchFinish(payload = {}) {
      if (stopped) return
      const matchingEntries = Array.isArray(payload.entries)
        ? payload.entries.filter((entry) => normalizeText(entry?.restoreRunId) === runId)
        : []
      if (matchingEntries.length === 0) return

      const successCount = matchingEntries.filter((entry) => entry?.success !== false).length
      const failureCount = matchingEntries.length - successCount

      append('restore-runtime-batch-finished', {
        batchId: normalizeCount(payload.batchId),
        size: matchingEntries.length,
        durationMs: normalizeCount(payload.durationMs),
        successCount,
        failureCount,
        completed: state.completed,
        succeeded: state.succeeded,
        failed: state.failed,
        lastCompletedIndex: state.lastCompletedIndex,
      })
    },
  }

  if (typeof observeTerminalBootstraps === 'function') {
    unsubscribe = observeTerminalBootstraps(observer)
  }

  return {
    runId,
    stop,
    finish,
    isFinished: () => finished,
  }
}
