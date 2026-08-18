import api, { getSsoToken } from '@/shared/services/api'

const KOOKY_ONE_PERSON_TEAM_API = '/kooky-api/api/v1/one-person-teams'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function unwrapKookyApiBody(res) {
  if (res && typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'code')) {
    if (String(res.code) !== '0') {
      throw new Error(res.message || `一人团队接口业务失败 code=${res.code}`)
    }
    return res.data ?? {}
  }
  return res?.data ?? res ?? {}
}

function toNumberId(value) {
  const id = Number(value)
  return Number.isFinite(id) ? id : value
}

function normalizeOnePersonMention(item) {
  if (!item || typeof item !== 'object') return null
  const agentId = item.agent_id ?? item.agentId ?? item.id ?? item.userId
  const name = String(item.name ?? item.displayName ?? item.user_name ?? item.username ?? '').trim()
  if (agentId == null || agentId === '' || !name) return null
  return {
    agent_id: toNumberId(agentId),
    name,
  }
}

function normalizeOnePersonMentions(mentions) {
  if (!Array.isArray(mentions)) return []
  return mentions.map(normalizeOnePersonMention).filter(Boolean)
}

function kookyOnePersonTeamPath(teamId, suffix = '') {
  return `${KOOKY_ONE_PERSON_TEAM_API}/${encodeURIComponent(String(teamId))}${suffix}`
}

function kookyOnePersonTeamCollectionPath(suffix = '') {
  return `${KOOKY_ONE_PERSON_TEAM_API}${suffix}`
}

export function getKookyOnePersonTeamStreamUrl(teamId, suffix = '') {
  return kookyOnePersonTeamPath(teamId, suffix)
}

/**
 * Kooky v1 一人团队首页聚合。
 * 目标契约：GET /api/v1/one-person-teams/{team_id}/home
 */
export async function fetchKookyOnePersonTeamHome(teamId) {
  const res = await api.get(kookyOnePersonTeamPath(teamId, '/home'), {
    headers: getAuthHeaders(),
  })
  return unwrapKookyApiBody(res)
}

/**
 * Kooky v1 一人团队任务列表。
 * 目标契约：GET /api/v1/one-person-teams/{team_id}/tasks
 */
export async function fetchKookyOnePersonTeamTasks(teamId, { status } = {}) {
  const res = await api.get(kookyOnePersonTeamPath(teamId, '/tasks'), {
    params: {
      ...(status ? { status } : {}),
    },
    headers: getAuthHeaders(),
  })
  const body = unwrapKookyApiBody(res)
  return body.tasks || body.items || []
}

/**
 * Kooky v1 一人团队全局任务侧栏聚合。
 * 目标契约：GET /api/v1/one-person-teams/task-sidebar
 */
export async function fetchKookyOnePersonTaskSidebar() {
  const res = await api.get(kookyOnePersonTeamCollectionPath('/task-sidebar'), {
    headers: getAuthHeaders(),
  })
  const body = unwrapKookyApiBody(res)
  return body.teams || body.items || []
}

/**
 * Kooky v1 一人团队线程消息分页。
 * 目标契约：GET /api/v1/one-person-teams/{team_id}/threads/{thread_id}/messages
 */
export async function fetchKookyOnePersonTeamMessages(teamId, threadId, {
  limit = 50,
  beforeSeq,
  afterSeq,
} = {}) {
  const params = {
    limit,
    ...(beforeSeq !== undefined && beforeSeq !== null ? { before_seq: beforeSeq } : {}),
    ...(afterSeq !== undefined && afterSeq !== null ? { after_seq: afterSeq } : {}),
  }
  const res = await api.get(
    kookyOnePersonTeamPath(teamId, `/threads/${encodeURIComponent(String(threadId))}/messages`),
    {
      params,
      headers: getAuthHeaders(),
    },
  )
  return unwrapKookyApiBody(res)
}

/**
 * Kooky v1 一人团队发送消息。
 * 目标契约：POST /api/v1/one-person-teams/{team_id}/threads/{thread_id}/messages
 */
export async function sendKookyOnePersonTeamMessage(teamId, {
  threadId,
  taskId = null,
  content,
  clientMessageId,
  attachments = [],
  mentions = [],
} = {}) {
  const payload = {
    task_id: taskId == null || taskId === '' ? null : toNumberId(taskId),
    content,
    client_message_id: clientMessageId,
    attachments,
    mentions: normalizeOnePersonMentions(mentions),
  }
  const res = await api.post(
    kookyOnePersonTeamPath(teamId, `/threads/${encodeURIComponent(String(threadId))}/messages`),
    payload,
    { headers: getAuthHeaders() },
  )
  return unwrapKookyApiBody(res)
}
