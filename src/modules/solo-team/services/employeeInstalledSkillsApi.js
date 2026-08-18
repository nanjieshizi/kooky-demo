/**
 * 员工对话技能列表 API（solo-team 自包含，不引用 deerflow-chat）
 */
import api, { getSsoToken } from '@/shared/services/api'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchEmployeeInstalledSkills(options = {}) {
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
  const items = res?.data?.items ?? res?.items ?? []
  return Array.isArray(items) ? items : []
}

export async function listEmployeeAgentsMy(options = {}) {
  const { stateful, status, page = 1, pageSize = 100 } = options
  const params = new URLSearchParams()
  params.append('page', String(page))
  params.append('pageSize', String(pageSize))
  if (stateful !== undefined) params.append('stateful', stateful)
  if (status !== undefined) params.append('status', status)
  const query = params.toString()
  const url = `/kooky-api/api/v1/agents/my${query ? `?${query}` : ''}`
  return api.get(url, { headers: getAuthHeaders() })
}
