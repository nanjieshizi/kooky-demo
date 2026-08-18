// 纯逻辑：功能介绍悬浮层的触发判断 + localStorage 读写
// 无 Vue / DOM 依赖，可通过 node:test 直接测试

export const STORAGE_KEY = 'kc_cli_intro_last_seen_version'

/**
 * 判断是否应该展示功能介绍
 * @param {number|null|undefined} lastSeen - 用户上次看过的版本号
 * @param {number} currentVersion - 当前代码里的 CLI_INTRO_VERSION
 * @returns {boolean}
 */
export function shouldShowFeatureIntro(lastSeen, currentVersion) {
  const last = Number(lastSeen)
  if (!Number.isFinite(last)) return true  // 首次或非法值
  return last < currentVersion
}

/**
 * 从 storage 读取上次看过的版本号，返回 number
 * @param {Storage|null|undefined} storage - localStorage / sessionStorage / mock
 * @returns {number}
 */
export function readLastSeenVersion(storage) {
  if (!storage || typeof storage.getItem !== 'function') return 0
  try {
    const raw = storage.getItem(STORAGE_KEY)
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/**
 * 把当前版本号写入 storage
 * @param {Storage|null|undefined} storage
 * @param {number} version
 */
export function writeLastSeenVersion(storage, version) {
  if (!storage || typeof storage.setItem !== 'function') return
  try {
    storage.setItem(STORAGE_KEY, String(version))
  } catch {
    // 静默降级：quota 满 / private mode 等
  }
}
