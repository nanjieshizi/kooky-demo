/**
 * KC 用户服务 - IM 相关接口
 * 路由经过 APISIX 网关，通过 Authorization: Bearer 鉴权
 */

import axios from 'axios'
import { getOneBaseUrl, getOneEnv } from '@/shared/utils/oneEnv'
import { getMatrixHomeserverBaseUrl } from '@/shared/utils/matrixHomeserverUrl.js'
import { USER_INFO_STORAGE_KEY } from '@/shared/constants/storageKeys'

/** 与 userStore 持久化一致：super-assistant-userInfo.access_token（Matrix SDK / KC fetch 共用） */
export function getUserInfoAccessToken() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (!raw) return ''
    const userInfo = JSON.parse(raw)
    return typeof userInfo?.access_token === 'string' ? userInfo.access_token : ''
  } catch {
    return ''
  }
}

/**
 * 包装 fetch：每次请求附带 X-JWT-Token（userInfo.access_token），供 matrix-js-sdk、Matrix /login 等使用
 * @param {typeof fetch} [baseFetch]
 */
export function createFetchWithKcJwt(baseFetch = globalThis.fetch.bind(globalThis)) {
  return (input, init) => {
    const jwt = getUserInfoAccessToken()
    if (!jwt) return baseFetch(input, init)
    const nextInit = init ? { ...init } : {}
    let merged
    try {
      merged = new Headers(
        nextInit.headers ??
          (typeof input === 'object' && input instanceof Request ? input.headers : undefined),
      )
    } catch {
      merged = new Headers()
    }
    if (!merged.has('X-JWT-Token')) merged.set('X-JWT-Token', jwt)
    nextInit.headers = merged
    return baseFetch(input, nextInit)
  }
}

/** IM 网关专属 axios 实例（独立于全局 request.js，使用 IM 自身鉴权与错误码） */
const imAxios = axios.create({
  baseURL: '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

imAxios.interceptors.request.use((config) => {
  const jwt = getUserInfoAccessToken()
  if (jwt) {
    config.headers = config.headers || {}
    config.headers['X-JWT-Token'] = jwt
  }
  return config
})

const IM_API_PREFIX = '/im/api/v1'

const KC_MATRIX_INFO_PATH = '/kc-public/kc-user/api/client/v1/matrix-info'
const KC_REGISTER_PATH = '/kooky-api/api/v1/cms/kc-client/register'

/** 时间戳 + 4 位十进制随机数（0000–9999，防缓存 / 请求唯一） */
function buildTimeStampQueryValue() {
  let n = 0
  try {
    const buf = new Uint8Array(2)
    crypto.getRandomValues(buf)
    n = (buf[0] << 8) | buf[1]
  } catch {
    n = Math.floor(Math.random() * 65536)
  }
  const suffix = String(n % 10000).padStart(4, '0')
  return `${Date.now()}${suffix}`
}

function withTimeStampQuery(url) {
  const u = new URL(url)
  u.searchParams.set('timeStamp', buildTimeStampQueryValue())
  return u.toString()
}

/**
 * 查询当前用户绑定的 Matrix 信息（bindImUserId、imBotId）
 * @param {string} accessToken - userInfo.access_token
 * @returns {Promise<{ username: string, bindImUserId: string, imBotId: string | null }>}
 */
export async function fetchMatrixInfo(accessToken) {
  const url = withTimeStampQuery(`${getOneBaseUrl()}${KC_MATRIX_INFO_PATH}`)
  const xJwtToken = getUserInfoAccessToken() || accessToken || ''
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  }
  if (xJwtToken) {
    headers['X-JWT-Token'] = xJwtToken
  }
  const res = await fetch(url, {
    method: 'GET',
    headers,
  })
  if (res.status === 500 || res.status === 502) {
    const err = new Error(`服务器错误 ${res.status}`)
    err.status = res.status
    throw err
  }
  const data = await res.json()
  if (data.code === 400) {
    const err = new Error(data.message || '用户未注册初始化')
    err.kcCode = 400
    throw err
  }
  if (data.code !== 0) {
    throw new Error(data.message || `matrix-info 查询失败 code=${data.code}`)
  }
  console.log('[CLIENT_MATRIX_INFO] 查询成功:', data.data?.username)
  return data.data
}

/**
 * IM 网关统一 POST 请求
 * @param {string} path - 接口路径，如 '/im/api/v1/room/create'
 * @param {object} body - 请求体
 * @param {string} imToken - Matrix access_token
 * @returns {Promise<any>} data 字段
 */
async function imPost(path, body, imToken) {
  const url = `${getMatrixHomeserverBaseUrl()}${path}`
  const res = await imAxios.post(url, body, {
    headers: { 'Authorization': `Bearer ${imToken}` },
  })
  const data = res.data
  if (res.status !== 200) {
    throw new Error(data.message || `IM 接口失败 [${path}] status=${res.status}`)
  }
  if (data.code !== undefined && data.code !== 200) {
    throw new Error(data.message || `IM 接口失败 [${path}] code=${data.code}`)
  }
  return data.data ?? data
}

/**
 * 获取房间成员列表
 * @param {string} roomId
 * @param {string} imAccessToken - MatrixClient.getAccessToken()
 * @returns {Promise<any>} 返回原始响应数据
 */
export async function fetchRoomMembers(roomId, imAccessToken) {
  return imPost(`${IM_API_PREFIX}/room/members`, { roomId }, imAccessToken)
}

/**
 * 注册 KC 客户端（Matrix 网关等）
 * @param {string} accessToken - userInfo.access_token
 * @param {object} params - 注册参数
 * @param {string} params.bindImUserId - Matrix 用户 ID
 * @param {'dev'|'test'|'prod'} params.env - 环境
 * @param {string} [params.feishuToken] - 飞书 token
 * @param {string} [params.userAvatar] - 用户头像 URL
 * @returns {Promise<{ username: string, accessToken: string, releaseName: string, externalIp: string, port: number, gatewayToken: string, instanceStatus: string, imBotId: string }>}
 */
export async function registerClient(accessToken, params) {
  const url = withTimeStampQuery(`${getOneBaseUrl()}${KC_REGISTER_PATH}`)
  const xJwtToken = getUserInfoAccessToken() || accessToken
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (xJwtToken) {
    headers['X-JWT-Token'] = xJwtToken
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })
  if (res.status === 500 || res.status === 502) {
    const err = new Error(`服务器错误 ${res.status}`)
    err.status = res.status
    throw err
  }
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(data.message || `KC 注册失败 code=${data.code}`)
  }
  console.log('[CLIENT_REGISTER] 注册成功:', data.data?.username)
  return data.data
}

/**
 * 创建群聊
 * @param {string} imToken
 * @param {{ name: string, topic?: string, roomAvatarUrl?: string, isPublic?: boolean, accounts?: string[], botIds?: string[], reason?: string }} params
 * @returns {Promise<{ roomId: string, roomAlias: string, invitedUsers: Array, successCount: number, failCount: number }>}
 */
export async function createGroupRoomApi(imToken, params) {
  return imPost(`${IM_API_PREFIX}/room/create`, params, imToken)
}

/**
 * 变更房间成员（全量剩余列表，仅群主可操作；服务端自动处理邀请/踢出及私人助理）
 * @param {string} imToken
 * @param {{ name?: string, roomId: string, leftAccounts: string[], leftBotIds?: string[] }} body
 * @returns {Promise<{
 *   result: string,
 *   message?: string,
 *   invitedMembers?: Array,
 *   kickedMembers?: Array,
 *   inviteSuccessCount?: number,
 *   inviteFailCount?: number,
 *   kickSuccessCount?: number,
 *   kickFailCount?: number
 * }>}
 */
export async function changeRoomMembersApi(imToken, body) {
  return imPost(`${IM_API_PREFIX}/room/update`, body, imToken)
}

/**
 * 当前用户离开群聊（自动带走私人助理）
 * @param {string} imToken
 * @param {string} roomId
 * @returns {Promise<{ result: string, leftUsers: Array }>}
 */
export async function leaveGroupRoomApi(imToken, roomId) {
  return imPost(`${IM_API_PREFIX}/room/leave`, { roomId }, imToken)
}

/**
 * 解散群聊（仅群主可操作，数据彻底删除）
 * @param {string} imToken
 * @param {string} roomId
 * @returns {Promise<{ result: string, roomId: string, message: string, deleteId?: string }>}
 */
export async function dissolveGroupRoomApi(imToken, roomId) {
  return imPost(`${IM_API_PREFIX}/room/dissolve`, { roomId }, imToken)
}

/**
 * 搜索用户目录（自动过滤私人助理，返回普通用户和通用数字人）
 * @param {string} imToken
 * @param {string} searchTerm
 * @param {number} [limit=10]
 * @returns {Promise<{ results: Array<{ userId, displayName, avatarUrl, userType }>, limited: boolean }>}
 */
export async function searchUserDirectoryApi(imToken, searchTerm, limit = 10) {
  return imPost(`${IM_API_PREFIX}/user/directory/search`, { searchTerm, limit }, imToken)
}

/**
 * 获取全量用户列表（按类型分组：普通用户 + 通用数字人）
 * @param {string} imToken
 * @param {{ limit?: number, from?: string, guests?: boolean, deactivated?: boolean }} [params]
 * @returns {Promise<{ users: Array, bots: Array, total: number, nextToken: string }>}
 */
export async function fetchUserListApi(imToken, params = {}) {
  return imPost(`${IM_API_PREFIX}/user/list`, params, imToken)
}

/**
 * 批量获取用户信息（用于系统通知名称解析）
 * @param {string} imToken - Matrix access_token
 * @param {string[]} userIds - Matrix 用户 ID 列表，如 ['@user001:synapse.example.com']
 * @returns {Promise<{ users: Array<{ userId, displayName, avatarUrl, userType }>, total: number }>}
 */
export async function fetchUserInfoByIds(imToken, userIds) {
  return imPost(`${IM_API_PREFIX}/user/info`, { userIds }, imToken)
}

/** 从 localStorage 读取 Matrix IM access_token */
function getImAccessToken() {
  try {
    const baseUrl = getMatrixHomeserverBaseUrl()
    const normalized = String(baseUrl || '').replace(/\/$/, '')
    const key = `matrix_session_${encodeURIComponent(normalized)}`
    const raw = localStorage.getItem(key)
    if (!raw) return ''
    const session = JSON.parse(raw)
    return session?.accessToken || ''
  } catch {
    return ''
  }
}

/**
 * 文件转存接口：IM 聊天室文件转存到 kc-media 空间
 * @param {string|null} imToken - Matrix access_token，为空时自动从 localStorage 读取
 * @param {object} params - 转存参数
 * @param {string} params.roomId - 房间ID
 * @param {string} params.roomType - 房间类型
 * @param {string} params.kcUserId - 用户域账号
 * @param {string} params.imUserId - IM用户id
 * @param {string} params.mimeType - 文件类型
 * @param {string} params.fileName - 文件名
 * @param {string} params.httpUrl - 文件地址
 * @returns {Promise<{ id, displayName, originalName, suffix, size, mimeType, isDir, parentId, uploaderId, uploaderName, uploadTime }>}
 */
export async function transferMediaFile(imToken, params) {
  return imPost(`${IM_API_PREFIX}/media/transfer`, params, imToken || getImAccessToken())
}

/**
 * 文件引用接口：kc-media 空间文件引用到 IM 聊天室
 * @param {string|null} imToken - Matrix access_token，为空时自动从 localStorage 读取
 * @param {object} params - 引用参数
 * @param {string} params.mimeType - 文件类型
 * @param {string} params.fileName - 文件名
 * @param {string} params.downloadUrl - kc-media 文件下载地址
 * @returns {Promise<{ contentUri: string }>} contentUri 为 Matrix 文件地址（mxc:// 格式）
 */
export async function referenceMediaFile(imToken, params) {
  return imPost(`${IM_API_PREFIX}/media/reference`, params, imToken || getImAccessToken())
}

// ============================================================================
// 群聊 API（DeerFlow）
// ============================================================================

const GROUP_API_BASE = '/kooky-api/api/conversations/groups'
const CONV_API_BASE = '/kooky-api/api/conversations'
const FORWARD_API_BASE = '/kooky-api/api/forward'

/**
 * 与文件上传接口对齐的业务请求头：X-Business-Id / X-Business-Type / X-Env / X-User-Id / X-Bind-Im-User-Id
 * 仅用于群聊/私聊发送消息接口
 * @param {string|number} conversationId
 * @returns {Record<string, string>}
 */
function buildConversationBizHeaders(conversationId) {
  const headers = {
    'X-Business-Id': String(conversationId ?? ''),
    'X-Business-Type': 'team',
    'X-Env': getOneEnv(),
  }
  let userId = ''
  try {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY)
    if (raw) {
      const userInfo = JSON.parse(raw)
      userId = String(userInfo?.userId ?? '').trim()
    }
  } catch {
    // ignore
  }
  if (userId) {
    headers['X-User-Id'] = userId
    headers['X-Bind-Im-User-Id'] = userId
  }
  return headers
}

/**
 * 创建群聊
 * @param {object} data
 * @param {string} data.name - 群聊名称
 * @param {string} [data.avatar_url] - 群聊头像
 * @param {string[]} [data.member_usernames] - 成员用户名列表
 * @param {number[]} [data.agent_participant_ids] - Agent participant ID 列表
 * @returns {Promise<any>}
 */
export async function createGroupApi(data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(GROUP_API_BASE, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取群聊列表
 * @returns {Promise<any>}
 */
export async function getGroupsApi() {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(GROUP_API_BASE, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取群聊详情
 * @param {string|number} conversationId
 * @param {object} [params]
 * @param {string} [params.search] - 搜索关键词
 * @returns {Promise<any>}
 */
export async function getGroupDetailApi(conversationId, params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${GROUP_API_BASE}/${conversationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 邀请成员加入群聊
 * @param {string|number} conversationId
 * @param {object} data
 * @param {string[]} [data.usernames] - 用户名列表
 * @param {number[]} [data.agent_participant_ids] - Agent participant ID 列表
 * @returns {Promise<any>}
 */
export async function inviteGroupMembersApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${GROUP_API_BASE}/${conversationId}/members`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 移除群聊成员
 * @param {string|number} conversationId
 * @param {object} data
 * @param {string[]} [data.usernames] - 用户名列表
 * @param {number[]} [data.agent_participant_ids] - Agent participant ID 列表
 * @returns {Promise<any>}
 */
export async function removeGroupMembersApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.delete(`${GROUP_API_BASE}/${conversationId}/members`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data,
  })
}

/**
 * 离开群聊
 * @param {string|number} conversationId
 * @returns {Promise<any>}
 */
export async function leaveGroupApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${GROUP_API_BASE}/${conversationId}/leave`, {}, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 保存群聊设置（全量覆盖：更新名称 + 同步成员列表）
 * @param {string|number} conversationId
 * @param {object} data
 * @param {string} [data.name] - 群聊名称
 * @param {string[]} [data.member_usernames] - 成员用户名列表
 * @param {number[]} [data.agent_participant_ids] - Agent participant ID 列表
 * @returns {Promise<any>}
 */
export async function saveGroupSettingsApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.put(`${GROUP_API_BASE}/${conversationId}/save`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 重命名群聊
 * @param {string|number} conversationId
 * @param {object|string} data - 群聊名称或包含 name 的对象
 * @returns {Promise<any>}
 */
export async function renameGroupApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.patch(`${GROUP_API_BASE}/${conversationId}`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 解散群聊
 * @param {string|number} conversationId
 * @returns {Promise<any>}
 */
export async function dissolveGroupApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.delete(`${GROUP_API_BASE}/${conversationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 发送群聊消息
 * @param {string|number} conversationId
 * @param {object|string} content - 消息内容或消息对象
 * @returns {Promise<any>}
 */
export async function sendGroupMessageApi(conversationId, content) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const headers = {
    ...buildConversationBizHeaders(conversationId),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return api.post(`${GROUP_API_BASE}/${conversationId}/messages`, content, {
    headers,
  })
}

/**
 * 获取群聊历史消息
 * @param {string|number} conversationId
 * @param {object} [params]
 * @param {number} [params.before_id] - 获取此 ID 之前的消息
 * @param {number} [params.after_id] - 获取此 ID 之后的消息
 * @param {number} [params.limit] - 消息数量限制
 * @returns {Promise<any>}
 */
export async function getGroupMessagesApi(conversationId, params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${GROUP_API_BASE}/${conversationId}/messages`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 获取会话事件列表（群聊/私聊统一）
 * @param {string|number} conversationId
 * @param {object} [params]
 * @param {string} [params.event_type] - 事件类型过滤
 * @param {number} [params.after_seq] - 增量同步
 * @param {number} [params.before_seq] - 加载历史
 * @param {number} [params.limit] - 数量限制
 * @returns {Promise<any>}
 */
export async function getConversationEventsApi(conversationId, params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/${conversationId}/events`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 检查消息是否是会话中最早的一条
 * @param {string|number} conversationId
 * @param {number} seq - 消息序列号
 * @returns {Promise<{ is_first: boolean }>}
 */
export async function isFirstMessageApi(conversationId, seq) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/${conversationId}/messages/seq/${seq}/is-first`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 检查消息是否是会话中最新的一条
 * @param {string|number} conversationId
 * @param {number} seq - 消息序列号
 * @returns {Promise<{ is_last: boolean }>}
 */
export async function isLastMessageApi(conversationId, seq) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/${conversationId}/messages/seq/${seq}/is-last`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取指定消息的上下文
 * @param {string|number} conversationId - 会话 ID
 * @param {string|number} messageId - 消息事件 ID
 * @param {object} [params]
 * @param {number} [params.before_limit] - 前面消息数量
 * @param {number} [params.after_limit] - 后面消息数量
 * @returns {Promise<any>}
 */
export async function getMessageContextApi(conversationId, messageId, params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/${conversationId}/events/${messageId}/context`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 查询当前用户未读消息数
 * @param {object} [params]
 * @param {string|number} [params.conv_id] - 指定会话 ID；不传则查询全局未读
 * @returns {Promise<any>}
 */
export async function getConversationUnreadApi(params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/unread`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 查询指定会话的未读 @ 消息信息
 * @param {string|number} conversationId
 * @returns {Promise<any>}
 */
export async function getConversationMentionApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${CONV_API_BASE}/${conversationId}/mention`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 批量标记指定会话消息已读
 * @param {string|number} conversationId
 * @param {object|number|string} data
 * @param {number|string} data.event_pk - 批量已读的最后一条消息 events 表主键 ID
 * @returns {Promise<any>}
 */
export async function markConversationMessageReadApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const eventPk = data?.event_pk ?? data?.eventPk ?? data
  return api.post(`${CONV_API_BASE}/${conversationId}/read`, { event_pk: eventPk }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 转发单条消息
 * @param {object} data
 * @param {number|string} data.target_conversation_id - 目标会话 ID
 * @param {number|string} data.event_id - 消息事件 ID
 * @param {string} [data.body] - 附加文本
 * @returns {Promise<any>}
 */
export async function forwardSingleMessageApi(data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${FORWARD_API_BASE}/single`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 批量转发多条消息
 * @param {object} data
 * @param {number|string} data.target_conversation_id - 目标会话 ID
 * @param {Array<number|string>} data.event_ids - 消息事件 ID 列表
 * @param {string} [data.body] - 附加文本
 * @returns {Promise<any>}
 */
export async function forwardBatchMessagesApi(data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${FORWARD_API_BASE}/batch`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 绑定 Agent 到群聊
 * @param {string|number} conversationId
 * @param {number} agentParticipantId
 * @returns {Promise<any>}
 */
export async function bindGroupAgentApi(conversationId, agentParticipantId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${GROUP_API_BASE}/${conversationId}/agents`, {
    agent_participant_id: agentParticipantId,
  }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 解绑群聊 Agent
 * @param {string|number} conversationId
 * @param {number} agentParticipantId
 * @returns {Promise<any>}
 */
export async function unbindGroupAgentApi(conversationId, agentParticipantId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.delete(`${GROUP_API_BASE}/${conversationId}/agents/${agentParticipantId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取群聊协作任务
 * @param {string|number} conversationId
 * @returns {Promise<any>}
 */
export async function getGroupTasksApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${GROUP_API_BASE}/${conversationId}/tasks`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// ============================================================================
// 私聊 API（DeerFlow）
// ============================================================================

const PRIVATE_API_BASE = '/kooky-api/api/conversations/private'

/**
 * 开始私聊（幂等）
 * @param {object} params
 * @param {string} params.targetUserName - 目标用户名
 * @returns {Promise<any>}
 */
export async function startPrivateChatApi(params) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${PRIVATE_API_BASE}/start`, {
    target_user_name: params.targetUserName,
  }, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取私聊列表
 * @param {object} [params]
 * @param {number} [params.limit] - 数量限制
 * @param {number} [params.offset] - 偏移量
 * @returns {Promise<any>}
 */
export async function getPrivateChatsApi(params = {}) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(PRIVATE_API_BASE, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params,
  })
}

/**
 * 关闭私聊
 * @param {number|string} conversationId
 * @returns {Promise<any>}
 */
export async function closePrivateChatApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${PRIVATE_API_BASE}/${conversationId}/close`, {}, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 恢复私聊可见性
 * @param {number|string} conversationId
 * @returns {Promise<any>}
 */
export async function reopenPrivateChatApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${PRIVATE_API_BASE}/${conversationId}/reopen`, {}, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 获取私聊详情
 * @param {number|string} conversationId
 * @returns {Promise<any>}
 */
export async function getPrivateChatDetailApi(conversationId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(`${PRIVATE_API_BASE}/${conversationId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/**
 * 发送私聊消息
 * @param {number|string} conversationId
 * @param {object} data
 * @param {string} data.body - 消息内容
 * @param {string} [data.msgtype] - 消息类型
 * @param {Array} [data.attachments] - 附件列表
 * @param {number} [data.reply_to_id] - 回复的消息 ID
 * @param {Array} [data.mentions] - 提及列表
 * @returns {Promise<any>}
 */
export async function sendPrivateMessageApi(conversationId, data) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const headers = {
    ...buildConversationBizHeaders(conversationId),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return api.post(`${PRIVATE_API_BASE}/${conversationId}/messages`, data, {
    headers,
  })
}

/**
 * 撤回私聊消息
 * @param {number|string} conversationId
 * @param {number|string} eventId
 * @returns {Promise<any>}
 */
export async function recallPrivateMessageApi(conversationId, eventId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.post(`${PRIVATE_API_BASE}/${conversationId}/messages/${eventId}/recall`, {}, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// ============================================================================
// 用户资料 API
// ============================================================================

const PROFILE_SEARCH_PATH = '/cloudpro/api/cloud-iam-usermgr/kc/api/v2/profiles/'
const AGENT_API_BASE = '/kooky-api/api/v1/agents'

/**
 * 根据账号查询用户资料
 * @param {string} account - 用户账号
 * @returns {Promise<any>}
 */
export async function fetchUserProfileByAccountApi(account) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  return api.get(PROFILE_SEARCH_PATH, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: {
      lookup_field: 'tag',
      exact_lookups: 'kc,bot',
      search: account,
      page: 1,
      page_size: 100,
    },
  })
}

/**
 * 根据 Agent ID 查询 Agent 详情
 * @param {string|number} agentId - Agent ID
 * @param {string|number} [versionId] - 版本 ID，拼接到 URL 末尾
 * @returns {Promise<any>}
 */
export async function fetchAgentDetailApi(agentId, versionId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const versionPath = versionId != null && String(versionId).trim() ? `/${versionId}` : ''
  return api.get(`${AGENT_API_BASE}/${agentId}/detail${versionPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: {
      marketplace: true,
    },
  })
}
