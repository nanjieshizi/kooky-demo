// 合并主进程 `session:collect-session-ids` 返回的 termId → sessionId 映射到 renderer 的 panel.claudeSessionId。
//
// 主进程的 session map 来自 hook-server 的内存 `termIdToSessionIds`，它是易失的：
//   - 重启后为空，靠 hook 事件逐步填充
//   - hook 未命中过的 term 永远不会出现
//   - Bug 4 修复之后，它已经只保留 transcript-backed 的 sessionId
//
// 因此"空态"不等于"确认没有 session"。这里只做"有值 upsert"，空态保留 renderer 既有状态；
// 脏 id 的清理交给使用点兜底（ShortcutBar bypass 前置校验、resume 失败降级、snapshot 加载 sanitize）。
//
// 返回需要调用 panelStore.updateClaudeSessionId 的条目列表，方便在任何宿主里做副作用。
//
// @param {Array<{ id: string, terminalId?: string|null }>} panels
// @param {Record<string, string>} sessionMap — 主进程 `session:collect-session-ids` 返回的 data
// @returns {Array<{ panelId: string, sessionId: string }>}
export function planClaudeSessionIdUpdatesFromMain(panels, sessionMap) {
  const safePanels = Array.isArray(panels) ? panels : []
  const safeMap = sessionMap && typeof sessionMap === 'object' ? sessionMap : {}
  const updates = []
  for (const panel of safePanels) {
    if (!panel || typeof panel !== 'object') continue
    const termId = panel.terminalId
    if (!termId) continue
    const fromMain = safeMap[termId]
    if (fromMain && typeof fromMain === 'string') {
      updates.push({ panelId: panel.id, sessionId: fromMain })
    }
  }
  return updates
}
