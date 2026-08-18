export function isTerminalContainerReady(containerLike, {
  minWidth = 50,
  minHeight = 50,
} = {}) {
  const width = Number(containerLike?.clientWidth ?? 0)
  const height = Number(containerLike?.clientHeight ?? 0)
  return width >= minWidth && height >= minHeight
}

export function settleTerminalFit({
  measure,
  fit,
  maxRetries = 5,
  retryIntervalMs = 50,
  scheduleFrame = (callback) => requestAnimationFrame(callback),
  scheduleRetry = (callback, delay) => setTimeout(callback, delay),
} = {}) {
  return new Promise((resolve) => {
    let attempts = 0

    const attempt = () => {
      const measurement = typeof measure === 'function' ? measure() : null
      if (!isTerminalContainerReady(measurement)) {
        if (attempts >= maxRetries) {
          resolve(false)
          return
        }
        attempts += 1
        scheduleRetry(attempt, retryIntervalMs)
        return
      }

      scheduleFrame(() => {
        if (typeof fit === 'function') {
          fit()
        }
        resolve(true)
      })
    }

    attempt()
  })
}
