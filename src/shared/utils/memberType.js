/**
 * 成员类型判定 helper（基于 HTTP IM 后端规范）
 *
 * 后端 /api/conversations/groups/{id} 返回的成员对象里：
 *   - type: 'user' 真人 / 'agent' 企业数字人-机器人 / 'system'
 *
 * 所有业务代码都通过这里判断「是否机器人」，避免再散落 BOT_GENERAL / USER 这类旧标识。
 */

/** 后端规范：机器人 / 企业数字人 */
export const MEMBER_TYPE_AGENT = 'agent'
/** 后端规范：真人用户 */
export const MEMBER_TYPE_USER = 'user'
/** 后端规范：系统 */
export const MEMBER_TYPE_SYSTEM = 'system'

/**
 * 判断成员是否为机器人（含企业数字人）
 * @param {{ type?: string }} member
 * @returns {boolean}
 */
export function isRoomMemberBot(member) {
  if (!member || typeof member !== 'object') return false
  return String(member.type ?? '').toLowerCase() === MEMBER_TYPE_AGENT
}

/**
 * 判断成员是否为真人用户
 * @param {{ type?: string }} member
 * @returns {boolean}
 */
export function isRoomMemberUser(member) {
  if (!member || typeof member !== 'object') return false
  return String(member.type ?? '').toLowerCase() === MEMBER_TYPE_USER
}
