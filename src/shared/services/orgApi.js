import api from './api'
import { getSsoToken } from './api'

// [dev-mocks] DEV 模式下走本地 mock，绕开 cloud-iam / kooky-api 真后端
import {
  mockFetchRootDepartments,
  mockFetchDepartmentChildren,
  mockFetchDepartmentProfiles,
  mockFetchDepartmentAgents,
  mockFetchOrgHeadcount,
  mockSearchProfiles,
  mockFetchKcMarketAgents,
} from '@/dev-mocks/data/org'
import { IS_DEMO } from '@/shared/utils/buildMode'
const DEV_MOCK = IS_DEMO

const DEPT_BASE = '/cloudpro/api/cloud-iam-usermgr/kc/api/v2/departments'

/** 浏览器 axios base 为 `/api`；Electron 为 one 域名根路径，需带 `/api` 前缀 */
const WORKBENCH_AGENTS_PATH = '/kooky-api/api/resources/agents'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 获取根部门列表
 * @returns {Promise<Array<{ id: number, name: string, full_name: string, has_children: boolean }>>}
 */
export async function fetchRootDepartments() {
  if (DEV_MOCK) return mockFetchRootDepartments()
  const res = await api.get(`${DEPT_BASE}/`, {
    headers: getAuthHeaders(),
    params: {
      root_only: true,
      lookup_field: 'category_id',
      exact_lookups: 1,
    },
  })
  return res.data?.results || []
}

/**
 * 获取子部门列表
 * @param {number} id - 父部门 ID
 * @returns {Promise<Array<{ id: number, name: string, full_name: string, has_children: boolean }>>}
 */
export async function fetchDepartmentChildren(id) {
  if (DEV_MOCK) return mockFetchDepartmentChildren(id)
  const res = await api.get(`${DEPT_BASE}/${id}/children/`, {
    headers: getAuthHeaders(),
  })
  return res.data || []
}

/**
 * 获取部门下的人员列表，映射为组件所需格式
 * @param {number} id - 部门 ID
 * @returns {Promise<Array<{ userId: number, name: string, account: string, department: string, avatar: string }>>}
 */
export async function fetchDepartmentProfiles(id) {
  if (DEV_MOCK) return mockFetchDepartmentProfiles(id)
  const res = await api.get(`${DEPT_BASE}/${id}/profiles/?tag=kc`, {
    headers: getAuthHeaders()
  })
  const results = res.data?.results || []
  return results.map(p => ({
    userId: p.id,
    name: p.display_name || p.username,
    account: p.username,
    department: p.departments?.[0]?.name || '',
    avatar: p.logo || '',
    // 档案卡用（接口给就带上，没有就空着，组件按需降级）
    title: p.position || p.title || '',
    email: p.email || '',
    employeeId: p.employee_id || p.job_number || '',
    managerName: p.manager_name || p.managerName || p.leader?.display_name || '',
    managerAccount: p.manager_account || p.managerAccount || p.leader?.username || '',
  }))
}

/**
 * 获取部门下的企业数字人（通讯录「数字同事混编进部门」用）
 *
 * ⚠️ 后端目前没有"数字人归属部门"这个字段：demo 走 mock 映射，生产先返回空数组
 *    （组织目录里就只剩真人 + 树底部的「全部数字同事」聚合入口，不会出错）。
 *    等 agent 接口补上 department_id，这里换成真实请求即可。
 * @param {number|string} id - 部门 ID
 */
export async function fetchDepartmentAgents(id) {
  if (DEV_MOCK) return mockFetchDepartmentAgents(id)
  return []
}

/**
 * 全公司人数（通讯录二级栏底部概览条）。
 * ⚠️ IAM 没有现成的总人数统计接口：生产返回 null，UI 那一格自己隐藏。
 */
export async function fetchOrgHeadcount() {
  if (DEV_MOCK) return mockFetchOrgHeadcount()
  return null
}

/** workbench `/resources/agents`：多为 `{ code, data: Agent[] }`，或直接 `Agent[]` */
function extractAgentRecords(res) {
  if (Array.isArray(res)) return res
  if (!res || typeof res !== 'object') return []
  const inner = res.data
  if (Array.isArray(inner)) return inner
  if (inner && typeof inner === 'object') {
    const list =
      inner.records ??
      inner.list ??
      inner.items ??
      inner.content ??
      inner.agents
    if (Array.isArray(list)) return list
  }
  const rootList = res.records ?? res.list ?? res.items
  if (Array.isArray(rootList)) return rootList
  return []
}

/**
 * 获取企业数字人列表
 * @param {Object} [params] - 可选参数
 * @param {string} [params.search] - 搜索关键词
 * @param {string} [params.keyword] - 搜索关键词（别名）
 * @param {string} [params.env] - 环境过滤 dev/test/prod
 * @param {number} [params.page=1] - 当前页
 * @param {number} [params.size=20] - 每页条数
 * @returns {Promise<Array<{ id: number, name: string, avatar: string, imBotId: number|null }>>}
 */
export async function fetchDigitalHumans(params = {}) {
  const queryParams = {}

  // 支持 search 或 keyword 参数
  const searchTerm = params.search || params.keyword
  if (searchTerm) {
    queryParams.search = searchTerm
  }

  if (params.env) queryParams.env = params.env
  if (params.page) queryParams.page = params.page
  if (params.size) queryParams.size = params.size

  const res = await api.get(WORKBENCH_AGENTS_PATH, {
    headers: getAuthHeaders(),
    params: queryParams
  })
  const records = extractAgentRecords(res)
  return records.map(r => ({
    id: r.id,
    name: r.name || '',
    avatar: r.avatarUrl ?? r.avatar ?? r.logo ?? '',
    icon: r.initials ?? r.icon ?? '',
    color: r.color ?? '',
    agent_id: r.agent_id ?? r.id,
    latest_version_id: r.latest_version_id ?? r.latestVersionId ?? r.latest_version?.id ?? null,
    // IM 侧 bot 与 participant_id 对齐（群成员 type='agent' 的 userId）
    imBotId: r.participant_id ?? r.imBotId ?? r.im_bot_id ?? r.botId ?? r.bot_id ?? null,
    username: r.username ?? r.account ?? null,
    agents: Array.isArray(r.agents) ? r.agents : [],
  }))
}

/** KC Client 智能体市场列表（固定 online + platform/tenant） */
const KC_MARKET_PATH = '/kooky-api/api/v1/agents-kc/market'

/**
 * 获取 KC Client 智能体市场列表
 * @param {Object} [params] - 可选查询参数
 * @param {string} [params.search] - 搜索关键词（模糊匹配 name 和 description）
 * @param {boolean} [params.includeStats] - 为 true 时附加 stats 字段
 * @param {boolean} [params.includeInstallStatus] - 为 true 时返回安装状态字段
 * @param {string} [params.tag] - 按标签过滤
 * @param {string} [params.displayName] - 按显示名称过滤（模糊匹配）
 * @param {boolean} [params.isOfficial] - 仅显示官方 Agent
 * @param {boolean} [params.isStarred] - 仅显示已收藏
 * @param {string} [params.slugs] - 按 slug 批量查询（逗号分隔，最多 50 个）
 * @param {('stars'|'downloads'|'updated')} [params.sort] - 排序方式
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.pageSize=20] - 每页数量（1-100）
 * @returns {Promise<{ items: Array, pagination: Object, nextCursor: any }>} 列表与分页
 */
export async function fetchKcMarketAgents(params = {}) {
  if (DEV_MOCK) return mockFetchKcMarketAgents(params)
  const queryParams = {}
  if (params.search != null && params.search !== '') queryParams.search = params.search
  if (params.includeStats != null) queryParams.includeStats = params.includeStats
  if (params.includeInstallStatus != null) queryParams.includeInstallStatus = params.includeInstallStatus
  if (params.tag) queryParams.tag = params.tag
  if (params.displayName) queryParams.displayName = params.displayName
  if (params.isOfficial != null) queryParams.isOfficial = params.isOfficial
  if (params.isStarred != null) queryParams.isStarred = params.isStarred
  if (params.slugs) queryParams.slugs = params.slugs
  if (params.sort) queryParams.sort = params.sort
  if (params.page) queryParams.page = params.page
  if (params.pageSize) queryParams.pageSize = params.pageSize

  const res = await api.get(KC_MARKET_PATH, {
    headers: getAuthHeaders(),
    params: queryParams,
  })
  // 响应可能是 { items, pagination } 或被包一层 data
  const body = res?.data && typeof res.data === 'object' && 'items' in res.data ? res.data : res
  const items = Array.isArray(body?.items) ? body.items : []
  const pagination = body?.pagination || null
  const nextCursor = body?.nextCursor ?? null
  const mapped = items.map(r => ({
    id: r.id,
    name: r.display_name || r.name || '',
    avatar: r.avatar_url || r.avatar || '',
    icon: '',
    color: '',
    agent_id: r.agent_id ?? r.id,
    latest_version_id: r.latest_version_id ?? r.latestVersionId ?? r.latest_version?.id ?? null,
    participant_id: r.participant_id ?? null,
    imBotId: r.participant_id ?? r.im_bot_id ?? r.imBotId ?? r.botId ?? r.bot_id ?? null,
    username: r.name ?? null,
    slug: r.slug ?? '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    capabilities: Array.isArray(r.capabilities) ? r.capabilities : [],
    skills: Array.isArray(r.skills) ? r.skills : [],
    isInstalled: Boolean(r.is_installed),
    favorited: Boolean(r.favorited),
    raw: r,
  }))
  return { items: mapped, pagination, nextCursor }
}

/**
 * 搜索联系人
 * @param {string} search - 搜索关键词
 * @returns {Promise<Array<{ userId: number, name: string, account: string, department: string, avatar: string }>>}
 */
export async function searchProfiles(search) {
  if (DEV_MOCK) return mockSearchProfiles(search)
  const res = await api.get('/cloudpro/api/cloud-iam-usermgr/kc/api/v2/profiles/', {
    headers: getAuthHeaders(),
    params: {
      lookup_field: 'tag',
      exact_lookups: 'kc',
      search,
    },
  })
  const results = res.data?.results || []
  return results.map(p => ({
    userId: p.id,
    name: p.display_name || p.username,
    account: p.username,
    department: p.departments?.[0]?.name || '',
    avatar: p.logo || '',
    // 档案卡用（接口给就带上，没有就空着，组件按需降级）
    title: p.position || p.title || '',
    email: p.email || '',
    employeeId: p.employee_id || p.job_number || '',
    managerName: p.manager_name || p.managerName || p.leader?.display_name || '',
    managerAccount: p.manager_account || p.managerAccount || p.leader?.username || '',
  }))
}
