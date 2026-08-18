import { USER_INFO_STORAGE_KEY } from '../constants/storageKeys.js'

export function getStoredUserInfo() {
  try {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getPortalUserId() {
  const userInfo = getStoredUserInfo()
  return String(userInfo?.userId ?? '').trim()
}

/**
 * 判断成员是否为当前登录用户（以 portal userId 与 member.account 比对）
 * @param {{ account?: string }} [member]
 * @returns {boolean}
 */
export function isSelfMember(member) {
  if (!member || typeof member !== 'object') return false
  const account = String(member.account ?? '').trim()
  if (!account) return false
  const portal = getPortalUserId()
  return !!portal && account === portal
}
