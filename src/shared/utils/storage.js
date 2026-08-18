/**
 * 浏览器侧存储：仅 localStorage（Electron 主进程 KV 存储已移除）
 */

import {
  isGroupIndexStorageKey,
  groupIdFromIndexStorageKey,
} from '@/shared/utils/storageKey'

/**
 * 写入 localStorage
 * @param {string} key
 * @param {any} value
 */
function storageSetSyncInternal(key, value) {
  const json = JSON.stringify(value)
  try {
    localStorage.setItem(key, json)
  } catch (e) {
    console.warn('[storage] localStorage.setItem 失败:', e)
  }
}

function findGroupIndexInLocalStorage(groupId) {
  if (!groupId) return null
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !isGroupIndexStorageKey(k)) continue
      if (groupIdFromIndexStorageKey(k) !== groupId) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.agentSessions && Object.keys(parsed.agentSessions).length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('[storage] findGroupIndexInLocalStorage 失败:', e)
  }
  return null
}

function readLocalStorageWithIpMigration(key) {
  try {
    const raw = localStorage.getItem(key)
    let parsed = raw ? JSON.parse(raw) : null

    if (isGroupIndexStorageKey(key)) {
      const hasIdx = parsed?.agentSessions && Object.keys(parsed.agentSessions).length > 0
      if (!hasIdx) {
        const gid = groupIdFromIndexStorageKey(key)
        const resolved = findGroupIndexInLocalStorage(gid)
        if (resolved) {
          storageSetSyncInternal(key, resolved)
          return resolved
        }
      }
      return parsed
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * 读取存储值
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function storageGet(key) {
  return readLocalStorageWithIpMigration(key)
}

/**
 * 写入存储值
 * @param {string} key
 * @param {any} value
 */
export async function storageSet(key, value) {
  const json = JSON.stringify(value)
  try {
    localStorage.setItem(key, json)
  } catch (e) {
    console.warn('[storage] localStorage.setItem 失败:', e)
  }
}

/**
 * 同步读取（仅 localStorage）
 * @param {string} key
 * @returns {any}
 */
export function storageGetSync(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * 同步写入（仅 localStorage）
 * @param {string} key
 * @param {any} value
 */
export function storageSetSync(key, value) {
  storageSetSyncInternal(key, value)
}
