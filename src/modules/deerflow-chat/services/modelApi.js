import api, { getAuthHeaders } from '@/shared/services/api'

/**
 * 获取全局模型列表（Studio 页面使用）
 * @returns {Promise<{models: Array, token_usage: {enabled: boolean}}>}
 */
export async function fetchModels() {
  const res = await api.get(`/kooky-api/api/models`, {
    headers: getAuthHeaders(),
  })
  return {
    models: res?.models || [],
    token_usage: res?.token_usage || { enabled: false },
  }
}

/**
 * 获取对话专用模型列表（MVP 个人对话使用）
 * @param {string} [agentId] - 智能体 ID（可选）
 * @param {string} channel - 渠道标识，默认 'kc-oc'
 * @returns {Promise<{current_model: Object|null, available_models: Array}>}
 */
export async function fetchChatModels(agentId = '', channel = 'kc-oc') {
  const params = new URLSearchParams({ channel })
  params.set('agent_id', agentId)
  const res = await api.get(`/kooky-api/api/client/v1/chat/models?${params.toString()}`, {
    headers: getAuthHeaders(),
  })
  return {
    current_model: res?.current_model || null,
    available_models: res?.available_models || [],
  }
}

/**
 * 更新模型选择（持久化到后端）
 * @param {Object} params
 * @param {string} params.channel - 渠道标识
 * @param {number|null} params.provider_config_id - 提供商配置 ID
 * @param {number|null} params.model_config_id - 模型配置 ID
 * @param {string} [params.agent_id] - 可选的 agent ID
 * @returns {Promise<void>}
 */
export async function updateModelSelection(params) {
  await api.put(`/kooky-api/api/client/v1/provider-config/selection`, params, {
    headers: getAuthHeaders(),
  })
}
