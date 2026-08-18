import api, { getSsoToken } from '@/shared/services/api'
import { normalizeOnePersonTeam } from './utils/onePersonTeamList.mjs'
import { resolveEmployeePresence } from './utils/employeePresence'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const AGENTS_API = '/kooky-api/api/v1/agents'
const ONE_PERSON_TEAM_API = '/kooky-api/api/v1/one-person-teams'
const MY_AGENTS_PAGE_SIZE = 100

function unwrapApiBody(res) {
  return res?.data ?? res ?? {}
}

function readAgentAvatar(agent) {
  return agent?.avatar_url || agent?.avatarUrl || agent?.image || agent?.avatar || agent?.icon || ''
}

function readAgentName(agent) {
  return String(agent?.display_name || agent?.name || agent?.agent_name || '').trim()
}

function readAgentDescription(agent) {
  return String(agent?.description || agent?.summary || '').trim()
}

function readMarketStats(agent) {
  return agent?.stats && typeof agent.stats === 'object' ? agent.stats : {}
}

/** 市场数字人是否已聘用（接口字段 is_installed，兼容 isInstalled） */
function readMarketIsInstalled(agent) {
  if (agent?.is_installed != null) return Boolean(agent.is_installed)
  if (agent?.isInstalled != null) return Boolean(agent.isInstalled)
  return false
}

function normalizePrivateAgent(agent) {
  const id = String(agent?.id ?? agent?.agent_id ?? '')
  return {
    id,
    agentId: id,
    name: readAgentName(agent),
    icon: readAgentAvatar(agent),
    avatar: readAgentAvatar(agent),
    description: readAgentDescription(agent),
    scope: agent?.scope || 'private',
    isUse: Boolean(agent?.isUse || agent?.is_use),
    isDefault: Boolean(agent?.is_default),
    pinned: Boolean(agent?.pinned),
    pinnedAt: agent?.pinned_at ?? agent?.pinnedAt ?? null,
    job_title: agent?.job_title || agent?.jobTitle || '',
    team_name: agent?.team_name || agent?.teamName || '',
    status: agent?.status || '',
    presence: resolveEmployeePresence(agent, 'idle'),
    stateful: agent?.stateful !== false,
    latestVersionId: agent?.latest_version_id ?? agent?.latestVersionId ?? null,
    latestVersionLabel: agent?.latest_version_label || agent?.latestVersionLabel || '',
    onlineVersionId: agent?.online_version_id ?? agent?.onlineVersionId ?? null,
    pendingPublishId: agent?.pending_publish_id ?? agent?.pendingPublishId ?? null,
    memoryPath: agent?.memory_path || agent?.memoryPath || '',
    personality: agent?.personality || '',
    preferences: agent?.preferences || null,
    avatarStrategy: agent?.avatar_strategy || agent?.avatarStrategy || null,
    taskCount: Number(agent?.task_count ?? agent?.taskCount ?? 0),
    interactionCount: Number(agent?.interaction_count ?? agent?.interactionCount ?? 0),
    skillProficiency: agent?.skill_proficiency || agent?.skillProficiency || {},
    createdAt: agent?.created_at || agent?.createdAt || '',
    updatedAt: agent?.updated_at || agent?.updatedAt || '',
    raw: agent,
  }
}

function readPrivateAgentsList(body) {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.agents)) return body.agents
  if (Array.isArray(body?.items)) return body.items
  if (Array.isArray(body?.results)) return body.results
  if (Array.isArray(body?.data)) return body.data
  if (Array.isArray(body?.data?.agents)) return body.data.agents
  if (Array.isArray(body?.data?.items)) return body.data.items
  if (Array.isArray(body?.data?.results)) return body.data.results
  return []
}

function normalizeMarketAgent(agent) {
  const stats = readMarketStats(agent)
  const tags = Array.isArray(agent?.tags)
    ? agent.tags
    : (Array.isArray(agent?.base_info?.tags) ? agent.base_info.tags : [])
  const tagLabels = tags
    .map((tag) => {
      if (tag == null) return ''
      if (typeof tag === 'string') return tag
      return String(tag.name ?? tag.title ?? tag.label ?? tag.displayName ?? tag.id ?? '').trim()
    })
    .filter(Boolean)
  const versionLabel = agent?.version_label || agent?.latest_version_label || agent?.latestVersion?.version || ''
  const isFollowed = Boolean(agent?.favorited || stats.favorited_by_me || agent?.isFollowed || agent?.isCollected)

  return {
    id: String(agent?.id ?? agent?.agent_id ?? ''),
    name: readAgentName(agent),
    version: versionLabel ? (String(versionLabel).startsWith('v') ? String(versionLabel) : `v${versionLabel}`) : '',
    qualityLevel: tagLabels[0] || '',
    extraTagCount: Math.max(tagLabels.length - 1, 0),
    extraTagLabels: tagLabels.slice(1),
    sourceOrg: agent?.author?.displayName || agent?.tenant_name || '',
    tags: tagLabels,
    description: readAgentDescription(agent),
    avatar: readAgentAvatar(agent),
    installed: Number(agent.stats_hires ?? agent?.hire_count ?? 0),
    favorites: Number(agent.stats_stars ?? agent?.collect_count ?? 0),
    updatedAt: agent?.updated_at || agent?.updatedAt || 0,
    isCollected: isFollowed,
    isHired: readMarketIsInstalled(agent),
    raw: agent,
  }
}

function normalizeMarketPagination(body, page, limit, batchLength) {
  const total = Number(body?.total)
  return {
    page: Number(body?.page ?? page),
    pageSize: Number(body?.limit ?? body?.pageSize ?? limit),
    total: Number.isFinite(total) ? total : batchLength,
  }
}

/**
 * 获取当前用户私有数字员工列表（新接口）
 * 文档：GET /api/v1/agents/my
 */
export async function fetchPrivateAgents(params = {}) {
  const res = await api.get(`${AGENTS_API}/my`, {
    params: { page: 1, pageSize: MY_AGENTS_PAGE_SIZE, list_scope: 'hires', ...params },
    headers: getAuthHeaders(),
  })
  const body = unwrapApiBody(res)
  const agents = readPrivateAgentsList(body)
  return agents.map(normalizePrivateAgent).filter(agent => agent.id)
}

const EMPLOYEE_PROMPT_TONES = ['gold', 'green', 'blue', 'purple']
const EMPLOYEE_PROMPT_FALLBACK_EMOJIS = ['✨', '📝', '🗓', '📎', '🧩', '📌', '🛠', '🚀']

function isHttpUrl(str) {
  return /^https?:\/\//i.test(String(str || '').trim())
}

/**
 * 接口示例：{ status, message, data: { prompts: [{ id, title, subtitle, content, icon, sort }], total } }
 */
function pickAgentPromptsList(body) {
  if (!body || typeof body !== 'object') return []
  if (Array.isArray(body.prompts)) return body.prompts
  if (body.data && typeof body.data === 'object' && Array.isArray(body.data.prompts)) return body.data.prompts
  if (Array.isArray(body.items)) return body.items
  if (Array.isArray(body.results)) return body.results
  if (Array.isArray(body.data)) return body.data
  return []
}

function normalizeAgentPromptForEmployeeWelcome(raw, index) {
  const title = String(raw?.title ?? raw?.name ?? '').trim()
  const content = String(raw?.content ?? raw?.text ?? raw?.body ?? '').trim()
  const subtitle = String(raw?.subtitle ?? raw?.sub_title ?? '').trim()
  const desc = subtitle || (content && content !== title ? content : '') || title
  const id = String(raw?.id ?? raw?.prompt_id ?? `prompt-${index}`)
  const iconRaw = String(raw?.icon ?? raw?.emoji ?? '').trim()
  const iconUrl = isHttpUrl(iconRaw) ? iconRaw : ''
  const emoji = iconUrl
    ? ''
    : (iconRaw || EMPLOYEE_PROMPT_FALLBACK_EMOJIS[index % EMPLOYEE_PROMPT_FALLBACK_EMOJIS.length])
  const tone = EMPLOYEE_PROMPT_TONES[index % EMPLOYEE_PROMPT_TONES.length]
  const fillText = content || title
  const sort = Number(raw?.sort)
  return {
    id,
    title,
    desc,
    content: fillText,
    emoji,
    iconUrl,
    tone,
    sort: Number.isFinite(sort) ? sort : index,
  }
}

const inflightAgentPrompts = new Map()

/**
 * 查询数字员工的快捷提示词
 * 文档：GET /api/v1/agents/{agent_id}/prompts
 */
export async function fetchAgentPrompts(agentId) {
  const id = String(agentId ?? '').trim()
  if (!id) return []
  if (inflightAgentPrompts.has(id)) return inflightAgentPrompts.get(id)
  const promise = (async () => {
    const encoded = encodeURIComponent(id)
    const res = await api.get(`${AGENTS_API}/${encoded}/prompts`, { headers: getAuthHeaders() })
    const body = unwrapApiBody(res)
    const list = pickAgentPromptsList(body)
    if (!list.length) return []
    const sorted = [...list].sort((a, b) => (Number(a?.sort) || 0) - (Number(b?.sort) || 0))
    return sorted
      .map((item, idx) => normalizeAgentPromptForEmployeeWelcome(item, idx))
      .filter((p) => p.title)
  })().finally(() => {
    inflightAgentPrompts.delete(id)
  })
  inflightAgentPrompts.set(id, promise)
  return promise
}

/**
 * 创建私有数字员工（新接口）
 * 文档：POST /api/v1/agents
 */
export async function createPrivateAgent({ name, description = '', avatarUrl = '', stateful = true } = {}) {
  const payload = {
    name,
    description: description || null,
    stateful,
    agent_config: { skills: [] },
    is_default: false,
    category: 'myEmployeeWrite',
  }
  if (avatarUrl) payload.base_info = {
    avatar_url: avatarUrl
  }

  const res = await api.post(`${AGENTS_API}`, payload, {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 更新私有数字员工信息
 * 文档：PUT /api/v1/agents/{agent_id}
 */
export async function updatePrivateAgent(agentId, payload = {}) {
  const id = encodeURIComponent(String(agentId))
  const body = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description || null } : {}),
    ...(payload.teamName !== undefined ? { team_name: payload.teamName || null } : {}),
    ...(payload.jobTitle !== undefined ? { job_title: payload.jobTitle || null } : {}),
    ...(payload.avatarUrl !== undefined ? { avatar_url: payload.avatarUrl || null } : {}),
    ...(payload.agentConfig ? { agent_config: payload.agentConfig } : {}),
    ...(payload.personality !== undefined ? { personality: payload.personality || null } : {}),
    ...(payload.preferences !== undefined ? { preferences: payload.preferences || null } : {}),
    ...(payload.avatarStrategy !== undefined ? { avatar_strategy: payload.avatarStrategy || null } : {}),
    ...(payload.status ? { status: payload.status } : {}),
  }
  const res = await api.put(`${AGENTS_API}/${id}`, body, { headers: getAuthHeaders() })
  return normalizePrivateAgent(unwrapApiBody(res))
}

/**
 * 从「我的员工」移除或解聘（一人团队：自建与市场聘用统一走此接口）
 * 文档：DELETE /api/v1/agents/my/{agent_id}
 */
export async function deleteMyPrivateAgent(agentId) {
  const id = encodeURIComponent(String(agentId))
  const res = await api.delete(`${AGENTS_API}/my/${id}`, { headers: getAuthHeaders() })
  return unwrapApiBody(res)
}

/**
 * 删除私有数字员工
 * 文档：DELETE /api/v1/agents/{agent_id}
 */
export async function deletePrivateAgent(agentId) {
  const id = encodeURIComponent(String(agentId))
  const res = await api.delete(`${AGENTS_API}/${id}`, { headers: getAuthHeaders() })
  return unwrapApiBody(res)
}

/**
 * 置顶私有智能体
 * 文档：PUT /api/v1/agents/{agent_id}/pin
 */
export async function pinPrivateAgent(agentId) {
  const id = encodeURIComponent(String(agentId))
  const res = await api.put(`${AGENTS_API}/${id}/pin`, {}, { headers: getAuthHeaders() })
  return normalizePrivateAgent(unwrapApiBody(res))
}

/**
 * 取消置顶私有智能体
 * 文档：DELETE /api/v1/agents/{agent_id}/pin
 */
export async function unpinPrivateAgent(agentId) {
  const id = encodeURIComponent(String(agentId))
  const res = await api.delete(`${AGENTS_API}/${id}/pin`, { headers: getAuthHeaders() })
  return normalizePrivateAgent(unwrapApiBody(res))
}

/**
 * 获取数字人市场列表（新接口）
 * 文档：GET /api/v1/agents/market
 */
export async function fetchMarketAgents(params = {}) {
  const {
    page = 1,
    pageSize = 20,
    limit = pageSize,
    search,
    sort = 'popular',
    favoritesOnly = false,
    onlyOnline = true,
  } = params

  const requestParams = favoritesOnly
    ? { only_online: onlyOnline }
    : {
        scope: 'platform',
        listing_status: 'online',
        include_stats: true,
        page,
        limit,
        sort,
        ...(search ? { search } : {}),
      }

  const url = favoritesOnly ? `${AGENTS_API}/market/collected` : `${AGENTS_API}/market`
  const res = await api.get(url, {
    params: requestParams,
    headers: getAuthHeaders(),
  })
  const body = unwrapApiBody(res)
  const agents = body.agents || body.items || body.results || []
  const normalized = agents.map(normalizeMarketAgent).filter(agent => agent.id)

  return {
    items: normalized,
    pagination: normalizeMarketPagination(body, Number(page), Number(limit), normalized.length),
  }
}

/**
 * 收藏/取消收藏市场数字人（新接口）
 */
export async function setMarketAgentCollected(marketAgentId, collected) {
  const id = encodeURIComponent(String(marketAgentId))
  const url = `${AGENTS_API}/market/${id}/collect`
  const res = collected
    ? await api.post(url, null, { headers: getAuthHeaders() })
    : await api.delete(url, { headers: getAuthHeaders() })
  return unwrapApiBody(res)
}

/**
 * 从市场聘用数字人（新接口）
 */
export async function hireMarketAgent(marketAgentId, { name, personality, preferences, avatarStrategy } = {}) {
  const payload = {
    ...(name ? { name } : {}),
    ...(personality ? { personality } : {}),
    ...(preferences ? { preferences } : {}),
    ...(avatarStrategy ? { avatar_strategy: avatarStrategy } : {}),
  }
  const res = await api.post(`${AGENTS_API}/market/${encodeURIComponent(String(marketAgentId))}/hire`, payload, {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 解聘从市场聘用的数字员工（非「我的员工」列表删除场景时单独使用）
 * 文档：DELETE /api/v1/agents/market/hired/{agent_id}
 */
export async function fireHiredMarketAgent(agentId) {
  const id = encodeURIComponent(String(agentId))
  const res = await api.delete(`${AGENTS_API}/market/hired/${id}`, { headers: getAuthHeaders() })
  return unwrapApiBody(res)
}

/**
 * 从「我的员工」移除或解聘：统一 DELETE /api/v1/agents/my/{agent_id}
 * @param {{ id?: string|number, agent_id?: string|number, agentId?: string|number, raw?: object }} agent
 */
export async function removePrivateAgent(agent) {
  const id = agent?.id ?? agent?.agent_id ?? agent?.agentId
  if (!id) throw new Error('缺少员工 ID')
  return deleteMyPrivateAgent(id)
}

function toNumberId(value) {
  const id = Number(value)
  return Number.isFinite(id) ? id : value
}

function onePersonTeamPath(teamId, suffix = '') {
  return `${ONE_PERSON_TEAM_API}/${encodeURIComponent(String(teamId))}${suffix}`
}

function normalizeOnePersonTeamPayload(body) {
  const source = body?.team || body?.one_person_team || body?.onePersonTeam || body
  if (!source || typeof source !== 'object') return normalizeOnePersonTeam(body)
  return normalizeOnePersonTeam({
    ...source,
    members: source.members || body?.members,
    coordinator_agent_id:
      source.coordinator_agent_id ??
      source.coordinatorAgentId ??
      body?.coordinator_agent_id ??
      body?.coordinator_id,
    coordinator_id:
      source.coordinator_id ??
      source.coordinatorId ??
      body?.coordinator_id ??
      body?.coordinator_agent_id,
  })
}

/**
 * 获取我的一人团队列表（新接口）
 * 文档：GET /api/v1/one-person-teams/my
 */
export async function fetchOnePersonTeams() {
  const res = await api.get(`${ONE_PERSON_TEAM_API}/my`, {
    headers: getAuthHeaders(),
  })
  const body = unwrapApiBody(res)
  const teams = body.teams || body.items || []
  return teams.map(normalizeOnePersonTeam).filter(team => team.id)
}

/**
 * 创建一人团队（新接口）
 * 文档：POST /api/v1/one-person-teams
 */
export async function createOnePersonTeam({
  name,
  description = '',
  coordinatorId,
  memberIds = [],
  maxConcurrentGoals = 3,
  autoArchiveHours = 24,
} = {}) {
  const descriptionText = String(description || '').trim()
  const ids = Array.isArray(memberIds) ? memberIds : []
  const payload = {
    name,
    description: descriptionText,
    coordinator_id: toNumberId(coordinatorId),
    // 与 updateOnePersonTeam 一致：members 为团队内全部 agent（含协调者）；仅协调者一人时不可再排除否则 members 为空
    members: ids.map(id => ({ agent_id: toNumberId(id), role: 'member' })),
    max_concurrent_goals: maxConcurrentGoals,
    auto_archive_hours: autoArchiveHours,
  }

  const res = await api.post(ONE_PERSON_TEAM_API, payload, {
    headers: getAuthHeaders(),
  })
  return normalizeOnePersonTeamPayload(unwrapApiBody(res))
}

/**
 * 获取一人团队详情（新接口）
 * 文档：GET /api/v1/one-person-teams/{team_id}
 */
export async function fetchOnePersonTeamDetail(teamId) {
  const res = await api.get(onePersonTeamPath(teamId), {
    headers: getAuthHeaders(),
  })
  return normalizeOnePersonTeamPayload(unwrapApiBody(res))
}

/**
 * 更新一人团队（新接口）
 * 文档：PUT /api/v1/one-person-teams/{team_id}
 */
export async function updateOnePersonTeam(teamId, {
  name,
  description,
  coordinatorId,
  memberIds,
  maxConcurrentGoals,
  autoArchiveHours,
  isCollaborationDissolved,
  is_collaboration_dissolved,
} = {}) {
  const collaborationDissolved = is_collaboration_dissolved ?? isCollaborationDissolved
  const payload = {
    ...(name ? { name } : {}),
    ...(description !== undefined ? { description: String(description ?? '').trim() } : {}),
    ...(coordinatorId ? { coordinator_id: toNumberId(coordinatorId) } : {}),
    ...(Array.isArray(memberIds)
      ? { members: memberIds.map(id => ({ agent_id: toNumberId(id), role: 'member' })) }
      : {}),
    ...(maxConcurrentGoals ? { max_concurrent_goals: maxConcurrentGoals } : {}),
    ...(autoArchiveHours ? { auto_archive_hours: autoArchiveHours } : {}),
    ...(collaborationDissolved !== undefined ? { is_collaboration_dissolved: Boolean(collaborationDissolved) } : {}),
  }
  const res = await api.put(onePersonTeamPath(teamId), payload, {
    headers: getAuthHeaders(),
  })
  return normalizeOnePersonTeamPayload(unwrapApiBody(res))
}

/**
 * 删除一人团队（新接口）
 * 文档：DELETE /api/v1/one-person-teams/{team_id}
 */
export async function deleteOnePersonTeam(teamId) {
  const res = await api.delete(onePersonTeamPath(teamId), {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 获取一人团队线程列表（新接口）
 * 文档：GET /api/v1/one-person-teams/{team_id}/threads
 */
export async function fetchOnePersonTeamThreads(teamId) {
  const res = await api.get(onePersonTeamPath(teamId, '/threads'), {
    headers: getAuthHeaders(),
  })
  const body = unwrapApiBody(res)
  return body.threads || body.items || []
}

/**
 * 创建一人团队主会话（新接口）
 * 文档：POST /api/v1/one-person-teams/{team_id}/threads/main
 */
export async function createOnePersonMainThread(teamId, title = '主会话') {
  const res = await api.post(onePersonTeamPath(teamId, '/threads/main'), { title }, {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 确保团队存在主会话：POST .../threads/main；若已存在（409）则 GET .../threads 取主会话。
 * 与 DeerFlow `one_person_teams_v1` 对齐，创建团队只落新一人团队服务。
 */
export async function ensureOnePersonTeamMainThread(teamId, title = '主会话') {
  const tid = toNumberId(teamId)
  if (tid == null) throw new Error('缺少团队 ID')
  try {
    return await createOnePersonMainThread(tid, title)
  } catch (e) {
    const status = e?.response?.status
    if (status !== 409) throw e
    const list = await fetchOnePersonTeamThreads(tid)
    const rows = Array.isArray(list) ? list : []
    const main = rows.find(
      (t) => String(t?.thread_type || t?.threadType || '').toLowerCase() === 'one_person_main',
    )
    if (main) return main
    throw e
  }
}

/**
 * 创建一人团队子会话（新接口）
 * 文档：POST /api/v1/one-person-teams/{team_id}/threads/sub
 */
export async function createOnePersonSubThread(teamId, {
  parentThreadId,
  title,
  goalDescription = '',
  assignedAgentId,
} = {}) {
  const payload = {
    parent_thread_id: toNumberId(parentThreadId),
    title,
    goal_description: goalDescription,
    ...(assignedAgentId ? { assigned_agent_id: toNumberId(assignedAgentId) } : {}),
  }
  const res = await api.post(onePersonTeamPath(teamId, '/threads/sub'), payload, {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 更新一人团队子会话状态（新接口）
 * 文档：PATCH /api/v1/one-person-teams/{team_id}/threads/{thread_id}
 */
export async function updateOnePersonThread(teamId, threadId, {
  subThreadStatus,
  archived,
  cancelLinkedTasks,
} = {}) {
  const payload = {
    ...(subThreadStatus ? { sub_thread_status: subThreadStatus } : {}),
    ...(typeof archived === 'boolean' ? { archived } : {}),
    ...(typeof cancelLinkedTasks === 'boolean' ? { cancel_linked_tasks: cancelLinkedTasks } : {}),
  }
  const res = await api.patch(onePersonTeamPath(teamId, `/threads/${encodeURIComponent(String(threadId))}`), payload, {
    headers: getAuthHeaders(),
  })
  return unwrapApiBody(res)
}

/**
 * 获取可用数字人列表（用于创建团队时选择成员）
 * @returns {Promise<Array>} 数字人列表
 */
export async function fetchAvailableAgents() {
  return fetchPrivateAgents()
}
