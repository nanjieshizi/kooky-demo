import api from '@/shared/services/api'

/**
 * 调用后端接口检查版本更新
 * POST /api/client/v1/check-update
 *
 * 接口文档见：KC Distribute — 客户端版本更新设计文档
 */
export async function checkUpdate({ currentVersion, platform, deviceId, arch }) {
  const appCode = platform === 'mac' ? 'kc-mac' : 'kc-windows'
  const userId = getUserId()

  const res = await api.post('https://one.iflytek.com/kc-distribute/api/client/v1/check-update', {
    appCode,
    currentVersion,
    platform,
    deviceId: deviceId || getClientDeviceId(),
    arch: arch || await getArch(),
    userId,
  })
  return res.data
}

/**
 * 从 localStorage 读取当前登录人的域账号
 */
function getUserId() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return userInfo?.userId || ''
    }
  } catch {
    // ignore
  }
  return ''
}

/**
 * 客户端持久化设备 ID（localStorage `kc-device-id`），与版本检查等接口一致
 * @returns {string}
 */
export function getClientDeviceId() {
  let id = localStorage.getItem('kc-device-id')
  if (!id) {
    id = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('kc-device-id', id)
  }
  return id
}

/**
 * 获取 CPU 架构
 * Electron 环境通过主进程 process.arch 获取，准确区分 Intel / Apple Silicon
 */
async function getArch() {
  if (window.electronAPI?.getArch) {
    const arch = await window.electronAPI.getArch()
    console.log('[更新检查] 获取 CPU 架构:', arch)
    return arch === 'x64' ? 'x86_64' : arch
  }
  return 'universal'
}
