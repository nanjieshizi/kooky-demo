import api, { getSsoToken } from '@/shared/services/api'
import { updateModelSelection } from '@/modules/deerflow-chat/services/modelApi'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchEmployeeModels() {
  const res = await api.get('/kooky-api/api/models', {
    headers: getAuthHeaders(),
  })
  return {
    models: res?.models || [],
    token_usage: res?.token_usage || { enabled: false },
  }
}

/**
 * 对话模型列表（员工 / 数字人）
 * GET /kooky-api/api/client/v1/chat/models?agent_id=…&channel=…
 * @param {string|number} agentId - 智能体 id（与一人团队员工 id、协作数字人 agent_id 一致）
 */
export async function fetchEmployeeChatModels(agentId, channel = 'kc-oc') {
  const params = new URLSearchParams({ agent_id: String(agentId), channel })
  const res = await api.get(`/kooky-api/api/client/v1/chat/models?${params.toString()}`, {
    headers: getAuthHeaders(),
  })
  return {
    current_model: res?.current_model || null,
    available_models: res?.available_models || [],
  }
}

/** 与「我的分身」Deerflow 一致：持久化当前智能体的模型选择 */
export { updateModelSelection as updateEmployeeModelSelection }
