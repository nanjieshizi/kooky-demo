import defaultAgentAvatar from '@/assets/soloTeam/default_agent.svg'
import { resolveBundledImageFromApiPath, isLikelyInvalidSrcAssetPath } from '@/shared/utils/localApiAssetMap'

/**
 * 从员工 / agent 对象上取出接口返回的头像原始字符串（不含默认图，用于表单回写）
 * @param {Record<string, unknown> | null | undefined} source
 * @returns {string}
 */
export function pickEmployeeAvatarRawString(source) {
  if (!source || typeof source !== 'object') return ''
  const nested = source.raw && typeof source.raw === 'object' ? source.raw : {}
  return String(
    source.avatar
    || source.avatar_url
    || source.avatarUrl
    || source.icon
    || source.agent_avatar_url
    || nested.agent_avatar_url
    || nested.avatar_url
    || nested.avatarUrl
    || '',
  ).trim()
}

/**
 * 一人团队 / 协作数字人：展示用头像 URL（有则用，无或无效则用 default_agent.svg）
 * @param {Record<string, unknown> | null | undefined} employee
 * @returns {string}
 */
export function resolveEmployeeAvatarSrc(employee) {
  const raw = pickEmployeeAvatarRawString(employee || {})
  if (!raw) return defaultAgentAvatar
  const mapped = resolveBundledImageFromApiPath(raw)
  if (mapped) return mapped
  if (isLikelyInvalidSrcAssetPath(raw)) return defaultAgentAvatar
  return raw
}

export { defaultAgentAvatar as employeeDefaultAgentAvatar }
