import api, { getSsoToken } from '@/shared/services/api'

// [dev-mocks] DEV 模式 mock 数字人列表 / 创建会话
import { listHired, toEmployeeAgentItem } from '@/dev-mocks/data/hired-state'
import { IS_DEMO } from '@/shared/utils/buildMode'
const DEV_MOCK = IS_DEMO

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 数字人（无状态 Agent）相关 API
 * 通过 one 网关代理时走 /kooky-api 前缀（与现有 threadApi 一致）
 */
export const digitalHumanApi = {
  /**
   * 获取我用过的无状态 Agent 列表（数字人列表）
   * GET /kooky-api/api/personal/agent-usage?stateful=false&page=1&page_size=50
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.pageSize=50]
   * @param {boolean} [options.includeHidden=false]
   * @returns {Promise<{items: Array, total: number, page: number, page_size: number}>}
   */
  async listAgents(options = {}) {
    if (DEV_MOCK) {
      // 一人团队"我的员工" / 协作模块员工对话都读这个 API；
      // 在 mock 下，"我的员工"列表 = 用户在市场聘用过的数字人
      const items = listHired().map(toEmployeeAgentItem)
      return { items, total: items.length, page: 1, page_size: items.length }
    }
    const { page = 1, pageSize = 50, includeHidden = false } = options

    const params = new URLSearchParams()
    params.append('stateful', 'false')
    params.append('page', page)
    params.append('page_size', pageSize)
    if (includeHidden) params.append('include_hidden', 'true')

    return api.get(`/kooky-api/api/personal/agent-usage?${params.toString()}`, {
      headers: getAuthHeaders()
    })
  },

  /**
   * 创建会话（点击数字人后调用，进入与其对话）
   * POST /kooky-api/api/personal/threads
   * @param {string} title - 会话标题
   * @param {number} agentId - 数字人 / Agent ID
   * @returns {Promise<Object>} 创建的会话对象（含 id 等）
   */
  async createThread(title = '新对话', agentId) {
    if (!agentId) {
      throw new Error('agentId is required')
    }

    return api.post('/kooky-api/api/personal/threads', {
      title,
      agent_id: agentId
    }, {
      headers: getAuthHeaders()
    })
  },

  /**
   * 置顶 agent-usage（我的列表）
   * POST /api/personal/agent-usage/{agent_id}/pin → { ok, pinned }
   */
  async pinAgentUsage(agentId) {
    const id = encodeURIComponent(String(agentId))
    return api.post(`/kooky-api/api/personal/agent-usage/${id}/pin`, {}, { headers: getAuthHeaders() })
  },

  /**
   * 取消置顶
   * POST .../agent-usage/{agent_id}/unpin → { ok, pinned }
   */
  async unpinAgentUsage(agentId) {
    const id = encodeURIComponent(String(agentId))
    return api.post(`/kooky-api/api/personal/agent-usage/${id}/unpin`, {}, { headers: getAuthHeaders() })
  },

  /**
   * 从「我的列表」软隐藏（写 hidden_at）
   * DELETE .../agent-usage/{agent_id} → { ok, hidden }
   */
  async hideAgentUsage(agentId) {
    const id = encodeURIComponent(String(agentId))
    return api.delete(`/kooky-api/api/personal/agent-usage/${id}`, { headers: getAuthHeaders() })
  },

  /**
   * 恢复展示
   * POST .../agent-usage/{agent_id}/restore
   */
  async restoreAgentUsage(agentId) {
    const id = encodeURIComponent(String(agentId))
    return api.post(`/kooky-api/api/personal/agent-usage/${id}/restore`, {}, { headers: getAuthHeaders() })
  },

  /**
   * 批量从列表隐藏
   * POST .../agent-usage/batch-remove body: { agent_ids: number[] }
   */
  async batchHideAgentUsage(agentIds) {
    const ids = Array.isArray(agentIds) ? agentIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
    return api.post(
      '/kooky-api/api/personal/agent-usage/batch-remove',
      { agent_ids: ids },
      { headers: getAuthHeaders() },
    )
  },
}
