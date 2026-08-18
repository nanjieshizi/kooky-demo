/**
 * 成员管理功能
 */

import { getGroupDetail } from '../services/group.js'

function convertMember(member) {
  const rawMember = { ...member }
  const displayName = member.name || member.display_name
  const departmentName = member.department
  const departments = departmentName
    ? [{ name: departmentName, fullName: member.department_full }]
    : []

  return {
    ...rawMember,
    userId: member.participant_id,
    participantId: member.participant_id,
    displayName,
    name: displayName,
    account: member.username,
    username: member.username,
    avatarUrl: member.avatar_url,
    avatarHttpUrl: member.avatar_url,
    avatar_url: member.avatar_url,
    type: member.type, // 后端规范：'user' / 'agent' / 'system'
    agent_id: member.agent_id,
    latest_version_id: member.latest_version_id,
    role: member.role,
    isOwner: member.role === 'owner',
    department: departmentName,
    departmentFull: member.department_full,
    department_full: member.department_full,
    departments,
  }
}

/**
 * 获取房间成员列表
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export async function getRoomMembers(client, conversationId) {
  client._checkInitialized()

  const detail = await getGroupDetail(conversationId)
  const members = Array.isArray(detail?.members) ? detail.members : []
  const agents = Array.isArray(detail?.agents) ? detail.agents : []
  return [...members, ...agents].map(convertMember)
}

/**
 * 获取房间成员资料
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export function getRoomMemberProfiles(client, conversationId) {
  return []
}
