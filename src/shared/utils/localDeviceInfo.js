/**
 * 获取本机 / 当前运行环境可见的设备信息
 * Electron 下由主进程补充 OS 级 machineId 与硬件相关元数据；纯 Web 仅有 navigator
 */

/**
 * @returns {Promise<{
 *   machineId: string,
 *   isElectron: boolean,
 *   userAgent: string,
 *   language: string,
 *   navigatorPlatform: string,
 *   platform?: string,
 *   arch?: string,
 *   hostname?: string,
 *   osRelease?: string,
 *   cpuCount?: number,
 *   totalMemoryBytes?: number,
 *   appVersion?: string,
 *   electronVersion?: string,
 *   nodeVersion?: string,
 * }>}
 *
 * machineId：操作系统级本机标识（Electron 下为 node-machine-id 的 SHA256，同机一致；非 Electron 为空串）
 */
export async function getLocalDeviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const base = {
    machineId: '',
    isElectron: false,
    userAgent: nav.userAgent || '',
    language: nav.language || '',
    navigatorPlatform: nav.platform || '',
  }

  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (api?.getDeviceInfo) {
    try {
      const host = await api.getDeviceInfo()
      if (host && typeof host === 'object') {
        return { ...base, ...host, isElectron: true }
      }
    } catch {
      /* noop */
    }
    return { ...base, isElectron: true }
  }

  return base
}
