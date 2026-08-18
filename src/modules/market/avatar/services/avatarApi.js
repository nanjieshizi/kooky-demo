import api, { getSsoToken } from '@/shared/services/api'

// [dev-mocks] DEV 模式 mock 数字人市场接口
import {
  mockFetchAgentList,
  mockFetchAgentDetail,
  mockFetchAgentTags,
  mockFollowAgent,
  mockFetchAgentVersions,
} from '@/dev-mocks/data/market-agents'
import { addHired, setFollowed } from '@/dev-mocks/data/hired-state'
import { IS_DEMO } from '@/shared/utils/buildMode'
const DEV_MOCK = IS_DEMO

// const HUB = 'assistant/agenthub'
const HUB = '/kooky-api'

/**
 * 获取用户账号
 */
function getUserAccount() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return userInfo?.userId || userInfo?.name || ''
    }
  } catch (e) {
    // ignore
  }
  return ''
}
function getAuthHeaders() {
  const token = getSsoToken()
  const account = getUserAccount()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(account ? { 'X-KC-Account': account } : {}),
  }
}

// function getAuthHeaders() {
//   const token = getSsoToken()
//   return token ? { Authorization: `Bearer ${token}` } : {}
// }
// function getAuthHeaders() {
//   const token = getSsoToken()
//   return {
//     'Cache-Control': 'no-cache',
//     Pragma: 'no-cache',
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//   }
// }

/**
 * 获取 Agent 广场列表
 * @param {Object} [params] - 可选查询参数
 * @returns {Promise<Array>}
 */
export async function fetchAgentList(params = {}) {
  if (DEV_MOCK) return mockFetchAgentList(params)
  const res = await api.get(`${HUB}/api/v1/agents-kc/market`, {
    headers: getAuthHeaders(),
    params,
  })
  const data = res?.data || res || {}
  const items = data.items || []
  const pagination = data.pagination || {
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    totalPages: data.totalPages,
    hasMore: data.hasMore,
  }
  return { items, pagination }
}

/**
 * 获取 Agent 分类标签列表
 * @returns {Promise<Array>} tags 数组，每项包含 name 和 count
 */
export async function fetchAgentTags() {
  if (DEV_MOCK) return mockFetchAgentTags()
  const res = await api.get(`${HUB}/api/v1/agents/tags`, {
    headers: getAuthHeaders(),
  })
  const tags = res?.data?.tags || res?.tags || []
  // 兼容字符串数组和对象数组两种格式
  return tags.map((t) => typeof t === 'string' ? { name: t } : t)
}

/**
 * 获取 Agent 详情（统一接口）
 * @param {number|string} id - Agent ID
 * @param {Object} [params] - 可选查询参数
 * @param {boolean} [params.marketplace] - true=市场上架行详情；false=我的智能体详情（默认 false）
 * @returns {Promise<Object>} data 字段，即 agent 详情对象
 */
export async function fetchAgentDetail(id, params = {}) {
  if (DEV_MOCK) {
    const detail = mockFetchAgentDetail(id)
    if (!detail) throw new Error(`agent ${id} not found in mock`)
    return detail
  }
  const { version_id, ...restParams } = params
  const versionPath = version_id != null ? `/${version_id}` : ''
  const res = await api.get(`${HUB}/api/v1/agents/${id}/detail${versionPath}`, {
    headers: getAuthHeaders(),
    params: restParams,
  })
  return res?.data || res
}

/**
 * 关注 / 取消关注 Agent
 * @param {number|string} market_agent_id - Agent ID
 * @param {boolean} isFollowed - true 为收藏，false 为取消收藏
 * @returns {Promise<{ followed: boolean }>}
 */

export async function followAgent(market_agent_id, isFollowed) {
  if (DEV_MOCK) {
    setFollowed(market_agent_id, isFollowed)
    return mockFollowAgent(market_agent_id, isFollowed)
  }
  if (isFollowed) {
    const res = await api.post(`${HUB}/api/v1/agents/market/${market_agent_id}/collect`, null, {
      headers: getAuthHeaders(),
    })
    return res?.data || res
  } else {
    const res = await api.delete(`${HUB}/api/v1/agents/market/${market_agent_id}/collect`, {
      headers: getAuthHeaders(),
    })
    return res?.data || res
  }
}
// /agent/admin/managed-agents
// 聘用
export async function hireAgent(id, params = {}) {
  if (DEV_MOCK) {
    const record = addHired(id, { newName: params?.name })
    return { ok: true, agentId: id, hiredAt: record.hiredAt, displayName: record.displayName }
  }
  const res = await api.post(`${HUB}/api/v1/agents/market/${id}/hire`, params, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}

// 已聘用的数字人 GET .../installed/agents/{agentId}（路径参数为 Agent id）
export async function getHiredAgents(agentId, params = {}) {
  const res = await api.get(`${HUB}/api/v1/agents/market-install/hired/${agentId}`, {
    headers: getAuthHeaders(),
    params,
  })
  return res?.data || res
}

// 版本列表 GET /api/v1/agents/{agent_id}/versions
export async function fetchAgentVersions(agentId) {
  if (DEV_MOCK) return mockFetchAgentVersions(agentId)
  const res = await api.get(`${HUB}/api/v1/agents/${agentId}/versions`, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}

// 删除单个版本 DELETE /api/v1/agents/{agent_id}/versions/{version_id}
export async function deleteAgentVersion(agentId, versionId) {
  const res = await api.delete(`${HUB}/api/v1/agents/${agentId}/versions/${versionId}`, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}

// 版本级下架 POST /v1/agents/{agent_id}/versions/{version_id}/offline
export async function offlineAgentVersion(agentId, versionId) {
  const res = await api.post(`${HUB}/api/v1/agents/${agentId}/versions/${versionId}/offline`, {}, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}

// 版本级聘用 POST /v1/agents/{agent_id}/versions/{version_id}/hire
export async function hireAgentVersion(agentId, versionId, params = {}) {
  if (DEV_MOCK) {
    const record = addHired(agentId, { newName: params?.name, versionId })
    return { ok: true, agentId, versionId, hiredAt: record.hiredAt, displayName: record.displayName }
  }
  const res = await api.post(`${HUB}/api/v1/agents/${agentId}/versions/${versionId}/hire`, params, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}

// 编辑版本 PUT /api/v1/agents/{agent_id}/edit/{version_id}
export async function editAgentVersion(agentId, versionId, data = {}) {
  const res = await api.put(`${HUB}/api/v1/agents/${agentId}/edit/${versionId}`, data, {
    headers: getAuthHeaders(),
  })
  return res?.data || res
}