const cache = new Map()
const agentCache = new Map()

const PROFILE_SEARCH_PATH = '/cloudpro/api/cloud-iam-usermgr/kc/api/v2/profiles/'
const AGENT_DETAIL_PATH = '/kooky-api/api/v1/agents/detail'

function cleanText(value) {
  return String(value ?? '').trim()
}

function firstValue(values) {
  for (const value of values) {
    const text = cleanText(value)
    if (text) return text
  }
  return ''
}

function normalizeDepartments(departments) {
  if (!Array.isArray(departments) || departments.length === 0) return ''
  return firstValue([
    departments[0]?.name,
    departments[0]?.full_name,
  ])
}

function normalizeLeaderName(leader) {
  if (!Array.isArray(leader) || leader.length === 0) return ''
  return firstValue([
    leader[0]?.display_name,
    leader[0]?.name,
    leader[0]?.username,
  ])
}

function extractResults(response) {
  const data = response?.data ?? response
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.data?.results)) return data.data.results
  return []
}

export function normalizeUserProfileRecord(record = {}) {
  const account = firstValue([record.username, record.account])
  return {
    userId: record.id ?? '',
    employeeId: firstValue([record.user_id, record.employeeId, record.employee_id]),
    account,
    name: firstValue([record.display_name, record.name, account]),
    avatar: firstValue([record.logo, record.extras?.avatar, record.avatar, record.avatarHttpUrl]),
    title: firstValue([record.position, record.title, record.jobTitle]),
    department: normalizeDepartments(record.departments),
    leaderName: normalizeLeaderName(record.leader),
    imUserId: firstValue([record.extras?.imuserid, record.imUserId, record.im_user_id]),
    isBot: cleanText(record.tag).toLowerCase() === 'bot' || cleanText(record.type).toLowerCase() === 'agent',
  }
}

export function normalizeUserProfileSearchResponse(response, account = '') {
  const results = extractResults(response)
  if (!results.length) return {}
  const target = cleanText(account).toLowerCase()
  const exact = target
    ? results.find((item) => cleanText(item?.username).toLowerCase() === target)
    : null
  return normalizeUserProfileRecord(exact || results[0])
}

async function requestUserProfileByAccount(account) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const res = await api.get(PROFILE_SEARCH_PATH, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: {
      lookup_field: 'tag',
      exact_lookups: 'kc,bot',
      search: account,
      page: 1,
      page_size: 100,
    },
  })
  return normalizeUserProfileSearchResponse(res, account)
}

let requester = requestUserProfileByAccount
let agentRequester = requestAgentDetail

export function __setRequesterForTest(fn) {
  requester = fn
}

export function __setAgentRequesterForTest(fn) {
  agentRequester = fn
}

export function clearUserProfileCache() {
  cache.clear()
  agentCache.clear()
}

export function fetchUserProfile(account) {
  const key = cleanText(account).toLowerCase()
  if (!key) return Promise.reject(new Error('account is required'))
  if (cache.has(key)) return cache.get(key)
  const p = requester(cleanText(account)).catch((err) => {
    cache.delete(key)
    throw err
  })
  cache.set(key, p)
  return p
}

function normalizeAgentDetail(record = {}) {
  const data = record?.data ?? record
  const account = firstValue([data.username, data.account, data.name])
  return {
    userId: data.id ?? data.agent_id ?? '',
    account,
    name: firstValue([data.display_name, data.name, account]),
    avatar: firstValue([data.avatar_url, data.avatar, data.logo]),
    title: firstValue([data.title, data.position]),
    department: firstValue([data.department, data.author]),
    description: firstValue([data.description, data.desc, data.intro]),
    leaderName: '',
    imUserId: '',
    isBot: true,
  }
}

async function requestAgentDetail(agentId) {
  const { default: api, getSsoToken } = await import('./api.js')
  const token = getSsoToken()
  const res = await api.get(`${AGENT_DETAIL_PATH}/${agentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: {
      marketplace: true,
    },
  })
  return normalizeAgentDetail(res)
}

export function fetchAgentProfile(agentId) {
  const key = cleanText(agentId)
  if (!key) return Promise.reject(new Error('agentId is required'))
  if (agentCache.has(key)) return agentCache.get(key)
  const p = agentRequester(key).catch((err) => {
    agentCache.delete(key)
    throw err
  })
  agentCache.set(key, p)
  return p
}
