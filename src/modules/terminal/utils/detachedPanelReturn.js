function normalizeId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export function pickDetachedPanelReturnTarget(options = {}) {
  const originalTabId = normalizeId(options.originalTabId)
  const originalWorkbenchId = normalizeId(options.originalWorkbenchId)
  const activeTabId = normalizeId(options.activeTabId)
  const activeWorkbenchId = normalizeId(options.activeWorkbenchId)

  if (originalTabId && options.originalTabExists) {
    return {
      tabId: originalTabId,
      workbenchId: originalWorkbenchId || activeWorkbenchId || null,
      reason: 'original-tab',
    }
  }

  if (activeTabId) {
    return {
      tabId: activeTabId,
      workbenchId: activeWorkbenchId || originalWorkbenchId || null,
      reason: 'active-tab',
    }
  }

  if (originalWorkbenchId && options.originalWorkbenchExists !== false) {
    return {
      tabId: null,
      workbenchId: originalWorkbenchId,
      reason: 'recreate-in-original-workbench',
    }
  }

  if (activeWorkbenchId && options.activeWorkbenchExists !== false) {
    return {
      tabId: null,
      workbenchId: activeWorkbenchId,
      reason: 'recreate-in-active-workbench',
    }
  }

  return null
}
