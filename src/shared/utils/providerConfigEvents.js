const listeners = new Set()

/** 模型与用量配置变更（保存/删除/关闭设置）后通知对话页刷新模型下拉 */
export function onProviderConfigChanged(handler) {
  if (typeof handler !== 'function') return () => {}
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function emitProviderConfigChanged() {
  listeners.forEach((handler) => {
    try {
      handler()
    } catch (err) {
      console.error('[providerConfigEvents] listener error:', err)
    }
  })
}
