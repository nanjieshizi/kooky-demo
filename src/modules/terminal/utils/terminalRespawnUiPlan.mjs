export function resolvePermissionModeRespawnUiPlan({
  currentMode = 'default',
  targetMode = 'default',
} = {}) {
  const isEnteringBypass =
    typeof targetMode === 'string' &&
    targetMode === 'bypassPermissions' &&
    currentMode !== 'bypassPermissions'

  return {
    eventName: 'kc-terminal-focus',
    clearViewport: true,
    focusTerminal: true,
    suppressSyntheticFocusInput: true,
    suppressSyntheticFocusInputMs: 1200,
    suppressExitBannerMs: 4000,
    suppressExitBannerCodes: [129],
    optimisticPermissionMode: isEnteringBypass ? null : targetMode,
    messageType: isEnteringBypass ? 'info' : 'success',
    messageText: isEnteringBypass
      ? '已打开 Bypass Permissions 确认，请在终端中选择并回车确认'
      : '已退出 Bypass Permissions',
  }
}
