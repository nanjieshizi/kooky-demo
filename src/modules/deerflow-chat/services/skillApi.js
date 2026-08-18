import api, { getAuthHeaders } from '@/shared/services/api'
import { mockFetchInstalledSkills } from '@/dev-mocks/data/skills'
import { IS_DEMO } from '@/shared/utils/buildMode'

const DEV_MOCK = IS_DEMO

/**
 * 获取已安装技能列表（与 deer-flow 对齐）
 * GET /api/v1/installed/skills
 *
 * @param {Object} options - 查询选项
 * @param {string} options.scope - 范围：'global' | 'agent'，默认 'global'
 * @param {string} [options.agentName] - 可选的 agent 名称
 * @param {number|string} [options.agentId] - 可选的 agent ID
 * @returns {Promise<Array>} 已安装的技能列表
 */
export async function fetchInstalledSkills(options = {}) {
  if (DEV_MOCK) return mockFetchInstalledSkills(options)
  const { scope = 'global', agentName, agentId } = options
  const params = new URLSearchParams()
  params.set('scope', scope)
  if (agentName) params.set('agentName', agentName)
  if (agentId !== undefined && agentId !== null && agentId !== '') {
    params.set('agentId', String(agentId))
  }

  const res = await api.get(`/kooky-api/api/v1/installed/skills?${params.toString()}`, {
    headers: getAuthHeaders(),
  })

  // 后端返回结构：{ status, message, data: { items, pagination } }
  const items = res?.data?.items ?? res?.items ?? []
  return Array.isArray(items) ? items : []
}

/**
 * 将市场技能与指定 agent 解绑
 * POST /api/v1/skills/{slug}/unbind-agents
 */
export async function unbindSkillFromAgent(slug, agentId) {
  return api.post(
    `/kooky-api/api/v1/skills/${encodeURIComponent(slug)}/unbind-agents`,
    { agent_ids: [agentId] },
    { headers: getAuthHeaders() }
  )
}

/**
 * 删除用户自己上传的私有技能
 * DELETE /api/v1/skills/{slug}?agentId={agentId}
 * 适用于 scope=private 的技能，无需版本状态限制，直接硬删除
 * @param {string} slug - 技能标识（slug）
 * @param {number|string} [agentId] - 可选的 agent ID，用于权限校验或日志记录
 */
export async function deleteSkill(slug, agentId) {
  const params = new URLSearchParams()
  if (agentId !== undefined && agentId !== null && agentId !== '') {
    params.set('agentId', String(agentId))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.delete(
    `/kooky-api/api/v1/skills/${encodeURIComponent(slug)}${query}`,
    { headers: getAuthHeaders() }
  )
}
