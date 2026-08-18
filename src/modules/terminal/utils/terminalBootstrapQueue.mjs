const BOOTSTRAP_CONCURRENCY = 2
const BOOTSTRAP_SPACING_MS = 120

let bootstrapSeq = 0
let bootstrapBatchSeq = 0
let activeBootstrapCount = 0
const pendingBootstraps = []
const bootstrapObservers = new Set()
const activeBootstrapBatches = new Map()

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizePriority(priority) {
  return Number.isFinite(priority) ? Number(priority) : 0
}

function sortPendingBootstraps() {
  pendingBootstraps.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }
    return left.seq - right.seq
  })
}

function notifyBootstrapObservers(hook, payload) {
  for (const observer of bootstrapObservers) {
    const handler = observer?.[hook]
    if (typeof handler !== 'function') continue
    try {
      handler(payload)
    } catch (error) {
      console.warn(`[terminalBootstrapQueue] observer ${hook} failed:`, error)
    }
  }
}

function finalizeBootstrapBatch(batchId) {
  const batch = activeBootstrapBatches.get(batchId)
  if (!batch || batch.pending > 0) return

  activeBootstrapBatches.delete(batchId)
  notifyBootstrapObservers('onBatchFinish', {
    batchId: batch.id,
    durationMs: Math.max(0, Date.now() - batch.startedAt),
    size: batch.size,
    successCount: batch.successCount,
    failureCount: batch.failureCount,
    entries: batch.entries.map((entry) => ({
      ...(entry.meta || {}),
      success: entry.success !== false,
    })),
  })
}

async function runBootstrap(entry) {
  activeBootstrapCount += 1
  entry.started = true
  const startedAt = Date.now()

  notifyBootstrapObservers('onTaskStart', {
    batchId: entry.batchId,
    seq: entry.seq,
    meta: entry.meta,
    startedAt,
  })

  try {
    const result = await entry.task()
    const succeeded = result !== false && result?.bootstrapSuccess !== false
    entry.success = succeeded
    entry.resolve(result)
    const batch = activeBootstrapBatches.get(entry.batchId)
    if (batch) {
      batch.pending = Math.max(0, batch.pending - 1)
      if (succeeded) {
        batch.successCount += 1
      } else {
        batch.failureCount += 1
      }
    }
    notifyBootstrapObservers('onTaskFinish', {
      batchId: entry.batchId,
      seq: entry.seq,
      meta: entry.meta,
      startedAt,
      durationMs: Math.max(0, Date.now() - startedAt),
      success: succeeded,
      error: succeeded ? null : new Error('bootstrap returned failure status'),
    })
  } catch (error) {
    entry.success = false
    entry.reject(error)
    const batch = activeBootstrapBatches.get(entry.batchId)
    if (batch) {
      batch.pending = Math.max(0, batch.pending - 1)
      batch.failureCount += 1
    }
    notifyBootstrapObservers('onTaskFinish', {
      batchId: entry.batchId,
      seq: entry.seq,
      meta: entry.meta,
      startedAt,
      durationMs: Math.max(0, Date.now() - startedAt),
      success: false,
      error,
    })
  } finally {
    finalizeBootstrapBatch(entry.batchId)
    if (BOOTSTRAP_SPACING_MS > 0) {
      await wait(BOOTSTRAP_SPACING_MS)
    }
    activeBootstrapCount = Math.max(0, activeBootstrapCount - 1)
    drainTerminalBootstraps()
  }
}

function drainTerminalBootstraps() {
  while (activeBootstrapCount < BOOTSTRAP_CONCURRENCY && pendingBootstraps.length > 0) {
    const availableSlots = Math.max(0, BOOTSTRAP_CONCURRENCY - activeBootstrapCount)
    const batchEntries = []

    while (batchEntries.length < availableSlots && pendingBootstraps.length > 0) {
      const nextEntry = pendingBootstraps.shift()
      if (!nextEntry || nextEntry.cancelled) {
        nextEntry?.resolve?.(null)
        continue
      }
      batchEntries.push(nextEntry)
    }

    if (batchEntries.length === 0) {
      continue
    }

    const batchId = ++bootstrapBatchSeq
    activeBootstrapBatches.set(batchId, {
      id: batchId,
      startedAt: Date.now(),
      size: batchEntries.length,
      pending: batchEntries.length,
      successCount: 0,
      failureCount: 0,
      entries: batchEntries,
    })

    notifyBootstrapObservers('onBatchStart', {
      batchId,
      size: batchEntries.length,
      startedAt: Date.now(),
      entries: batchEntries.map((entry) => entry.meta),
    })

    for (const entry of batchEntries) {
      entry.batchId = batchId
      void runBootstrap(entry)
    }
  }
}

export function observeTerminalBootstraps(observer) {
  if (!observer || typeof observer !== 'object') {
    throw new TypeError('observer must be an object')
  }

  bootstrapObservers.add(observer)
  return () => {
    bootstrapObservers.delete(observer)
  }
}

export function enqueueTerminalBootstrap(task, options = {}) {
  if (typeof task !== 'function') {
    throw new TypeError('task must be a function')
  }

  let resolvePromise = null
  let rejectPromise = null
  const entry = {
    seq: ++bootstrapSeq,
    priority: normalizePriority(options.priority),
    task,
    started: false,
    cancelled: false,
    success: null,
    meta: options.meta && typeof options.meta === 'object'
      ? JSON.parse(JSON.stringify(options.meta))
      : null,
    batchId: null,
    resolve: null,
    reject: null,
  }

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  entry.resolve = resolvePromise
  entry.reject = rejectPromise

  pendingBootstraps.push(entry)
  sortPendingBootstraps()
  drainTerminalBootstraps()

  return {
    promise,
    cancel() {
      if (entry.started || entry.cancelled) return false
      entry.cancelled = true
      const index = pendingBootstraps.indexOf(entry)
      if (index !== -1) {
        pendingBootstraps.splice(index, 1)
      }
      entry.resolve(null)
      return true
    },
    reprioritize(priority) {
      if (entry.started || entry.cancelled) return false
      entry.priority = normalizePriority(priority)
      sortPendingBootstraps()
      return true
    },
  }
}
