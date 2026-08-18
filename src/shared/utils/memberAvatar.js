import defaultMemberAvatar from '@/assets/default-avatar.svg'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import { isRoomMemberBot } from './memberType.js'

export { defaultMemberAvatar, defaultAgentAvatar }

/** Matrix / 业务成员对象上的头像 HTTP 地址 */
export function resolveMemberAvatarUrl(member) {
  const u = member?.avatarHttpUrl ?? member?.avatarUrl ?? member?.avatar_url ?? ''
  return typeof u === 'string' && u.trim() ? u.trim() : ''
}

/**
 * 展示用头像 URL：有则用远端；无则根据成员类型使用不同的默认图
 * - 数字人/机器人：使用 default-agent-avatar.svg
 * - 真人用户：使用 default-avatar.svg
 */
export function memberAvatarDisplayUrl(member) {
  const u = resolveMemberAvatarUrl(member)
  if (u) return u
  // 判断是否为数字人/机器人
  if (isRoomMemberBot(member)) {
    return defaultAgentAvatar
  }
  return defaultMemberAvatar
}
