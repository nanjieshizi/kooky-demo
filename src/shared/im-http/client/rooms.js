/**
 * 房间/群聊管理功能
 */

import {
  createGroup,
  getGroups,
  saveGroupSettings,
  leaveGroup,
  dissolveGroupConversation,
  inviteGroupMembers,
  removeGroupMembers,
  renameGroup as renameGroupApi,
} from '../services/group.js'
import { buildGroupRoomFromApi } from '../utils/conversationListItems.mjs'

/**
 * 获取房间列表
 * @param {Object} client - HttpIMClient 实例
 */
export function getRooms(client) {
  return []
}

/**
 * 从 HTTP API 获取群聊列表
 */
export async function fetchGroupRooms(client) {
  client._checkInitialized()
  const groups = await getGroups()
  return Array.isArray(groups) ? groups.map(buildGroupRoomFromApi) : []
}

/**
 * 检查是否已加入房间
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export function hasJoinedRoom(client, conversationId) {
  return false
}

/**
 * 加入房间
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export async function joinRoom(client, conversationId) {
  client._checkInitialized()

  // 订阅 WebSocket 事件
  if (client._wsManager) {
    client._wsManager.subscribe(conversationId)
  }

  // TODO: 如果后端提供加入房间接口，在这里调用
  console.log('[HttpIMClient] 加入房间:', conversationId)
}

/**
 * 离开房间
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export async function leaveRoom(client, conversationId) {
  client._checkInitialized()

  await leaveGroup(conversationId)

  // 取消订阅 WebSocket 事件
  if (client._wsManager) {
    client._wsManager.unsubscribe(conversationId)
  }

  console.log('[HttpIMClient] 离开房间:', conversationId)
}

/**
 * 创建群聊
 * @param {string} name - 群聊名称
 * @param {Array} accounts - 成员账号列表
 * @param {Array} botIds - Bot ID 列表
 * @param {Object} options - 选项
 */
export async function createGroupRoom(name, accounts = [], botIds = [], options = {}) {
  try {
    const result = await createGroup({
      name,
      avatar_url: options.avatar_url,
      member_usernames: accounts,
      agent_participant_ids: botIds
    })

    const { conversation_id } = result

    return {
      conversationId: conversation_id,
      name,
    }
  } catch (error) {
    console.error('[HttpIMClient] 创建群聊失败:', error)
    throw error
  }
}

/**
 * 保存群聊设置（全量覆盖：更新名称 + 同步成员列表）
 * 仅群主可调用。
 * @param {Object} client - HttpIMClient 实例
 * @param {string} name - 新群名（为空字符串时不更新名称）
 * @param {string|number} conversationId - 房间 ID
 * @param {string[]} accounts - 剩余用户域账号全量列表（不含群主）
 * @param {number[]} botIds - 剩余 Agent participant_id 全量列表
 */
export async function changeRoomMembers(client, name, conversationId, accounts = [], botIds = []) {
  client._checkInitialized()

  try {
    const payload = {
      member_usernames: accounts,
      agent_participant_ids: botIds,
    }
    if (typeof name === 'string' && name.trim()) {
      payload.name = name.trim()
    }
    const result = await saveGroupSettings(conversationId, payload)
    console.log('[HttpIMClient] 保存群聊设置成功', result)
    return result
  } catch (error) {
    console.error('[HttpIMClient] 保存群聊设置失败:', error)
    throw error
  }
}

/**
 * 邀请成员加入群聊（增量，仅传新增的人）
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 * @param {{ usernames?: string[], agentParticipantIds?: number[] }} [payload]
 */
export async function inviteMembers(client, conversationId, payload = {}) {
  client._checkInitialized()

  const usernames = Array.isArray(payload.usernames) ? payload.usernames : []
  const agentIds = Array.isArray(payload.agentParticipantIds) ? payload.agentParticipantIds : []

  return inviteGroupMembers(conversationId, {
    usernames,
    agent_participant_ids: agentIds
  })
}

/**
 * 移除群聊成员（增量，仅传要移除的人）
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 * @param {{ usernames?: string[], agentParticipantIds?: number[] }} [payload]
 */
export async function removeMembers(client, conversationId, payload = {}) {
  client._checkInitialized()

  const usernames = Array.isArray(payload.usernames) ? payload.usernames : []
  const agentIds = Array.isArray(payload.agentParticipantIds) ? payload.agentParticipantIds : []

  return removeGroupMembers(conversationId, {
    usernames,
    agent_participant_ids: agentIds
  })
}

/**
 * 更新群聊名称（仅传名称，不涉及成员）
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 * @param {string} name - 新名称
 */
export async function renameGroup(client, conversationId, name) {
  client._checkInitialized()
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) throw new Error('[HttpIMClient] 群聊名称不能为空')
  return renameGroupApi(conversationId, { name: trimmed })
}

/**
 * 解散群聊
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间 ID
 */
export async function dissolveGroup(client, conversationId) {
  client._checkInitialized()

  try {
    await dissolveGroupConversation(conversationId)

    console.log('[HttpIMClient] 解散群聊成功')
  } catch (error) {
    console.error('[HttpIMClient] 解散群聊失败:', error)
    throw error
  }
}

/**
 * 清除所有房间
 * @param {Object} client - HttpIMClient 实例
 * @param {Object} options - 选项
 */
export async function clearRooms(client, options = {}) {
  client._checkInitialized()
}
