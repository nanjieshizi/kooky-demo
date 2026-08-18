export function normalizeManualTabTitle(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isTabTitlePinned(tab) {
  return Boolean(tab?.titlePinned && normalizeManualTabTitle(tab?.name))
}

export function getPanelAutoTitle(panel) {
  // 页签标题：稳定的 shell + cwd 格式，不跟随 OSC（避免因 claude/git 等进程导致页签频繁变更）
  // 真正的 OSC 标题仅作用于 Pane 头部（见 ClaudeCodeView.getPaneHeaderTeamPresentation）
  if (!panel) return 'Terminal'
  const sh = panel.shell || 'shell'
  const cwd = panel.cwd || ''
  const lastDir = cwd.split('/').filter(Boolean).pop() || ''
  return lastDir ? `${sh} ~/${lastDir}` : sh
}

export function getTabDisplayTitle(tab, panel) {
  const pinnedTitle = normalizeManualTabTitle(tab?.name)
  if (isTabTitlePinned(tab) && pinnedTitle) {
    return pinnedTitle
  }
  if (panel) {
    return getPanelAutoTitle(panel)
  }
  return pinnedTitle || 'Terminal'
}
