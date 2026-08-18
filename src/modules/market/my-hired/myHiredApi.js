import api, { getSsoToken } from '@/shared/services/api'

// [dev-mocks] DEV 模式 mock 我的聘用接口
import { listHired, removeHired, toMyHiredItem } from '@/dev-mocks/data/hired-state'
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

function authHeaders() {
  const token = getSsoToken()
  const account = getUserAccount()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(account ? { 'X-KC-Account': account } : {}),
  }
}

/**
 * 将列表项转换为卡片所需格式
 * @param {Object} item - 列表接口返回的单个 item
 * @returns {Object}
 */
function transformItem(item) {
  return {
    // 列表字段
    id: item.ocAgentId,
    name: item.displayName || item.slug,
    version: item?.version || '',
    source: item.official ? item.author?.displayName : '我',
    fromAgentName: item.fromAgentName || '',
    fromAgentSlug: item.fromAgentSlug || '',
    type: item.official ? 'market' : 'selfBuilt',
    // 内置
    isBuiltin: item.isBuiltin,
    avatar: item.avatar || null,
    description: item.summary || '',
    tags: item.tags || [],
    status: item?.status || 'active',
    isCollected: item.isFollowed || false,
    collectCount: item.statsStars || 0,
    downloadCount: item.statsDownloads || 0,
    // 详情字段
    detailedDescription: item.detailedDescription || '',
    functions: item.functions || '',
    scope: item.scope || '',
    scenarios: item.scenarios || '',
    riskLevel: item.riskLevel || '',
    license: item.license || '',
    owner: item.author?.displayName || item.author?.name || '',
    changelog: item.changelog || item.latestVersion?.changelog || '',
    hasNewVersion: false,
    fileMd5: item.fileMd5 || item.latestVersion?.fileMd5 || '',
    downloadUrl: item.downloadUrl || item.latestVersion?.downloadUrl || '',
    skills: Array.isArray(item.skills)
      ? item.skills.map(skill => ({
          id: skill.id,
          icon: skill.icon || null,
          title: skill.displayName || skill.title || skill.slug || '',
          version: skill.version || '',
          tags: skill.tags || [],
          role: skill.role || '',
          content: skill.content || '',
          downloadCount: skill.downloadCount || 0,
          collectCount: skill.collectCount || 0,
        }))
      : [],
    updateLogs: Array.isArray(item.historyVersion)
      ? item.historyVersion.map(v => ({
          version: v.version ? `v${String(v.version).replace(/^v/i, '')}` : '',
          content: v.changelog || '',
          updateTime: v.createdAt || 0,
          updater: v.ownerName || item.author?.displayName || item.author?.name || '',
        }))
      : [],
  }
}

/**
 * 安装/更新数字人
 * POST /api/v1/agent/admin/managed-agents
 * @param {Object} data - { agentId, agentName, version, isUpdate }
 * @returns {Promise<Object>}
 */
export async function installAgent(data) {
  const res = await api.post(
    `${HUB}/api/v1/agent/admin/managed-agents`,
    data,
    { headers: authHeaders() }
  )
  return res?.data ?? res
}

/**
 * 更新数字人
 * PUT /api/v1/agents/{id}
 * @param {string|number} agentId - Agent ID
 * @param {Object} data - 更新数据
 * @returns {Promise<Object>}
 */
export async function updateManagedAgent(agentId, data) {
  const res = await api.put(
    `${HUB}/api/v1/installed/agents/${agentId}`,
    data,
    { headers: authHeaders() }
  )
  return res?.data ?? res
}

/**
 * 解雇数字人
 * @param {string} agentId - Agent ID
 * @returns {Promise<boolean>}
 */
export async function fireAgent(agentId) {
  if (DEV_MOCK) {
    removeHired(agentId)
    return true
  }
  try {
    await api.delete(`${HUB}/api/v1/agent/admin/managed-agents/${agentId}`, {
      headers: authHeaders(),
    })
    return true
  } catch (e) {
    console.error('解雇失败:', e)
    throw e
  }
}

/**
 * 获取数字人关联的 Skills
 * GET /api/v1/installed/skills
 * @param {string} agentName - Agent 名称
 * @returns {Promise<Array>}
 */
export async function fetchInstalledSkills(agentName) {
  try {
    const res = await api.get(`${HUB}/api/v1/installed/skills`, {
      params: { agentName, scope: 'agents' },
      headers: authHeaders(),
    })
    const body = res?.data ?? res
    const items = body?.items ?? []
    items.forEach(ele => {
      ele.slug = ele.name
    })
    // 转换为详情页所需格式
    return items
  } catch (e) {
    console.error('获取关联 Skills 失败:', e)
    return []
  }
}

/**
 * 获取 Agent 详情（用于获取 roomId）
 * GET /kc-public/kc-user/api/client/v1/app/agent_detail
 * @param {string} agentId
 * @returns {Promise<Object>}
 */
export async function fetchAgentRoomDetail(agentId) {
  const res = await api.get('kc-public/kc-user/api/client/v1/app/agent_detail', {
    params: { agentId },
    headers: authHeaders(),
  })
  return res?.data ?? res
}

/**
 * 获取数字人详情（用于获取更新日志）
 * GET /api/v1/agents/{slug}
 * @param {string} slug - fromAgentSlug
 * @returns {Promise<Object>}
 */
export async function fetchAgentDetail(slug) {
  try {
    const res = await api.get(`${HUB}/api/v1/agents/${slug}`, {
      headers: authHeaders(),
    })
    const body = res?.data ?? res
    return transformItem(body)
  } catch (e) {
    console.error('获取数字人详情失败:', e)
    return null
  }
}

/**
 * 移除数字人关联的 Skill（新接口）
 * DELETE /api/v1/installed/skills/{slug}?agentName={agentName}
 * @param {string} skillSlug - Skill slug
 * @param {string} agentName - Agent 名称
 * @returns {Promise<void>}
 */
export async function removeManagedSkill(skillSlug, agentName) {
  const s = encodeURIComponent(String(skillSlug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 skillSlug'))
  }
  const agent = String(agentName ?? '').trim() || 'main'
  await api.delete(
    `${HUB}/api/v1/installed/skills/${s}`,
    {
      params: { agentName: agent },
      headers: authHeaders(),
    }
  )
}

/**
 * 安装/更新数字人关联的 Skills（新接口）
 * PUT /api/v1/installed/skills/{slug}?agentName={agentName}
 * @param {string} agentName - Agent 名称
 * @param {string} skillSlug - Skill slug
 * @returns {Promise<Object>}
 */
export async function installManagedSkills(agentName, skillSlug) {
  const s = encodeURIComponent(String(skillSlug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 skillSlug'))
  }
  const agent = String(agentName ?? '').trim() || 'main'
  const res = await api.put(
    `${HUB}/api/v1/installed/skills/${s}`,
    null,
    {
      params: { agentName: agent },
      headers: authHeaders(),
    }
  )
  return res?.data ?? res
}

/**
 * 获取我的聘用列表
 * @param {Record<string, unknown>} [params] - 查询参数
 * @returns {Promise<{ results: Array, total: number }>}
 */
export async function fetchMyHiredList(params = {}) {
  if (DEV_MOCK) {
    const records = listHired()
    const items = records.map(toMyHiredItem)
    const results = items.map(transformItem)
    return { results, itemsCount: results.length }
  }
  const res = await api.get(`${HUB}/api/v1/agents/market-install/hired`, {
    params,
    headers: authHeaders(),
  })
  const body = res?.data ?? res
  const items = body?.items ?? []
  // const total = body?.total ?? 0
  const itemsCount = items.length

  const results = items.map(transformItem)
  return { results, itemsCount }
}
