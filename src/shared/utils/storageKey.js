/**
 * localStorage key 工具
 * 所有持久化 key 以服务器 host:port 为命名空间，
 * 确保不同服务器的数据完全隔离。
 */

/** OpenClaw 已移除，此函数保留兼容 */
let _serverUrl = ''

export function setServerUrl(url) {
  _serverUrl = url || ''
}

/**
 * 从 gatewayUrl 提取 host:port 作为服务器唯一标识
 * 例：ws://172.29.67.211:18789 → "172.29.67.211:18789"
 */
export function getServerKey() {
  try {
    return new URL(_serverUrl).host || 'default'
  } catch {
    return 'default'
  }
}

/**
 * 群聊轻量索引键：仅存储 agentSession 映射 + turns 顺序，
 * 消息内容通过 getChatHistory 从服务器拉取。
 */
export function groupIndexKey(groupId) {
  return `openclaw_${getServerKey()}_idx_${groupId}`
}

/** 群聊轻量索引键（含 host:port 命名空间） */
export function isGroupIndexStorageKey(key) {
  return typeof key === 'string' && /^openclaw_.+_idx_.+$/.test(key)
}

/**
 * 从 openclaw_${serverKey}_idx_${groupId} 解析出 groupId（serverKey 中可能含 : .）
 */
export function groupIdFromIndexStorageKey(key) {
  if (typeof key !== 'string') return null
  const marker = '_idx_'
  const i = key.lastIndexOf(marker)
  if (i === -1) return null
  return key.slice(i + marker.length) || null
}

/** Matrix 会话键前缀（与 matrixSessionStorageKey 一致） */
export const MATRIX_SESSION_STORAGE_PREFIX = 'matrix_session_'

/** Matrix 会话 localStorage 键（按 Homeserver baseUrl 隔离） */
export function matrixSessionStorageKey(baseUrl) {
  const u = String(baseUrl || '').replace(/\/$/, '') || 'default'
  return `${MATRIX_SESSION_STORAGE_PREFIX}${encodeURIComponent(u)}`
}

/**
 * 清除全部 Matrix 会话缓存（系统登出 / 无登录态时调用，避免复用旧 access_token）
 */
export function clearAllMatrixSessionStorage() {
  try {
    const keys = Object.keys(localStorage)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (k.startsWith(MATRIX_SESSION_STORAGE_PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    /* noop */
  }
}

/**
 * 清除历史团队空间列表在 localStorage 中的残留（openclaw_*_spaces，已不再使用）
 */
export function clearLegacyTeamSpacesLocalStorage() {
  try {
    const keys = Object.keys(localStorage)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (typeof k === 'string' && /^openclaw_.+_spaces$/.test(k)) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* noop */
  }
}
