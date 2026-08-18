import api, { getSsoToken } from '@/shared/services/api'
import { getOneEnv } from '@/shared/utils/oneEnv'
import {
  mockFetchSkillMarketTags,
  mockFetchSkillMarketList,
  mockFetchSkillMarketDetail,
  mockFetchSkillAgents,
  mockFetchSkillBindingStatus,
  mockInstallSkillToAgent,
  mockUninstallSkillFromAgent,
  mockToggleSkillStar,
} from '@/dev-mocks/data/skills'
import { DIGITAL_HUMANS_RAW } from '@/dev-mocks/data/digital-humans'
import { IS_DEMO } from '@/shared/utils/buildMode'

const DEV_MOCK = IS_DEMO

// const HUB = 'assistant/agenthub'
const HUB = '/kooky-api'

/** 与 myHiredApi 一致：be-super-assistant 管理端接口用其识别当前用户 */
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

/** my-hired / be-super-assistant：Bearer + X-KC-Account + X-KC-Env（X-KC-Env 与 one 环境一致，见 getOneEnv） */
function authHeadersBeSuperAssistant() {
  const token = getSsoToken()
  const account = getUserAccount()
  const kcEnv = getOneEnv()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(account ? { 'X-KC-Account': account } : {}),
    ...(kcEnv ? { 'X-KC-Env': String(kcEnv).trim() } : {}),
  }
}

function authHeaders() {
  const token = getSsoToken()
  return {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Skill 市场顶部分类标签
 * GET …/api/v1/tags/skills
 * @returns {Promise<Array<{ name: string, count: number }>>}
 */
export async function fetchSkillMarketTags() {
  if (DEV_MOCK) return mockFetchSkillMarketTags()
  const res = await api.get(`${HUB}/api/v1/tags/skills`, {
    headers: authHeaders(),
  })
  if (Array.isArray(res)) return res
  if (!res || typeof res !== 'object') return []
  const tags =
    res?.data?.tags ??
    res?.data?.data?.tags ??
    res?.tags ??
    []
  return Array.isArray(tags) ? tags : []
}

/**
 * Skill 市场卡片列表（query 由调用方在 Vue 中组装后传入）
 * GET …/api/v1/skills
 * @param {Record<string, unknown>} params - axios query，如 sort、tag、search、isOfficial、isStarred、page、pageSize
 * @returns {Promise<{ results: unknown[], pagination?: Record<string, unknown> }>}
 */
export async function fetchSkillMarketList(params = {}) {
  if (DEV_MOCK) return mockFetchSkillMarketList(params)
  const res = await api.get(`${HUB}/api/v1/skills`, {
    params,
    headers: authHeaders(),
  })
  // 后端返回结构：{ status, message, data: { results/items, pagination } }
  // api.js 拦截器已返回 response.data，所以 res 就是响应体
  const body =
    res && typeof res === 'object' && !Array.isArray(res)
      ? res.results !== undefined
        ? res
        : res.items !== undefined
          ? { results: res.items, pagination: res.pagination }
          : res.data != null && typeof res.data === 'object' && !Array.isArray(res.data)
            ? res.data.results !== undefined
              ? res.data
              : res.data.items !== undefined
                ? { results: res.data.items, pagination: res.data.pagination }
                : res.data
            : res
      : res
  const results = Array.isArray(body?.results) ? body.results : Array.isArray(body?.items) ? body.items : []
  const pagination =
    body?.pagination && typeof body.pagination === 'object' ? body.pagination : {}
  return { results, pagination }
}

/**
 * Skill 详情 GET …/api/v1/skills/{slug}/detail（AgentHub 前端接口），可选 query `version`
 * 响应解析与字段映射在 SkillDetailView 中完成，此处仅发起请求并返回接口原始 JSON
 * @param {string} slug
 * @param {{ version?: string, marketplace?: boolean }} [options]
 *   - `marketplace`：与「我的上传」等场景区分，通常市场详情为 `true`，我的上传为 `false`
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchSkillMarketDetail(slug, options = {}) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) {
    try {
      return mockFetchSkillMarketDetail(String(slug ?? '').trim())
    } catch (e) {
      return Promise.reject(e)
    }
  }
  const ver = String(options.version ?? '').trim()
  const params = {}
  if (ver) params.version = ver
  if (Object.prototype.hasOwnProperty.call(options, 'marketplace')) {
    params.marketplace = Boolean(options.marketplace)
  }
  return api.get(`${HUB}/api/v1/skills/${s}/detail`, {
    headers: authHeaders(),
    ...(Object.keys(params).length ? { params } : {}),
  })
}

/**
 * Skill 关联的 Agent 列表（详情「被引用的数字人」、安装弹窗等）
 * GET …/api/v1/skills/{slug}/agents
 * @param {string} slug - Skill 唯一标识
 * @param {{ page?: number, pageSize?: number, version?: string }} [params]
 * - page 默认 1，pageSize 默认 20、最大 100；version 可选，用于按指定 Skill 版本查询关联 Agent
 * @returns {Promise<{ results: object[], pagination: Record<string, unknown> }>}
 */
export async function fetchSkillAgents(slug, params = {}) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockFetchSkillAgents(String(slug ?? '').trim())
  const page = Math.max(1, Number(params.page) || 1)
  const rawSize = Number(params.pageSize) || 20
  const pageSize = Math.min(100, Math.max(1, rawSize))
  const version = String(params.version ?? '').trim()
  const res = await api.get(`${HUB}/api/v1/skills/${s}/agents`, {
    params: {
      page,
      pageSize,
      ...(version ? { version } : {}),
    },
    headers: authHeaders(),
  })
  const envelopeStatus = res?.status
  if (
    envelopeStatus != null &&
    Number(envelopeStatus) !== 200 &&
    String(envelopeStatus) !== '200'
  ) {
    return Promise.reject(new Error(res?.message || '请求失败'))
  }
  const inner =
    res?.data?.results !== undefined
      ? res.data
      : res?.results !== undefined
        ? res
        : {}
  const results = Array.isArray(inner?.results) ? inner.results : []
  const pagination =
    inner?.pagination && typeof inner.pagination === 'object' ? inner.pagination : {}
  return { results, pagination }
}

/**
 * 已安装 Agent 实例列表（平铺，不按 slug 聚合）
 * GET …/${HUB}/api/v1/installed/agents[&targetSkill=xxx]
 * 成功：`{ status: 200, data: { items: [...], total } }`，
 * 当传 `targetSkill` 时，单条可返回 `targetSkillStatus`（installing | active | uninstalling | ''）
 * @param {{ targetSkill?: string }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchInstalledAgents(options = {}) {
  const targetSkill = String(options?.targetSkill ?? '').trim()
  const params = targetSkill ? { targetSkill } : undefined
  const res = await api.get(`${HUB}/api/v1/agents/market-install/hired`, {
    params,
    headers: authHeaders(),
  })
  const envelopeStatus = res?.status
  if (
    envelopeStatus != null &&
    Number(envelopeStatus) !== 200 &&
    String(envelopeStatus) !== '200'
  ) {
    return Promise.reject(new Error(res?.message || '请求失败'))
  }
  const items = res?.data?.items
  return Array.isArray(items) ? items : []
}

/**
 * 安装 Skill（透传 OC / AgentHub Admin）
 * PUT …/assistant/be-super-assistant/api/v1/agent/admin/managed-skills
 * 请求体：`{ skill_ids: string[], agent_id: string, env: string }`
 * 成功：`{ status: 200, data: { success: true } }`
 * @param {{ skill_ids: string[], agent_id?: string }} payload
 * @returns {Promise<{ success?: boolean }>}
 */
export async function putManagedSkills(payload) {
  const skill_ids = Array.isArray(payload?.skill_ids)
    ? payload.skill_ids.map((s) => String(s).trim()).filter(Boolean)
    : []
  if (!skill_ids.length) {
    return Promise.reject(new Error('缺少 skill_ids'))
  }
  const agentIdRaw =
    payload?.agent_id != null ? String(payload.agent_id).trim() : ''
  const agent_id = agentIdRaw || 'main'
  const env = String(getOneEnv() ?? '').trim()
  const body = {
    skill_ids,
    agent_id,
    ...(env ? { env } : {}),
  }
  const res = await api.put(
    `${HUB}/api/v1/agent/admin/managed-skills`,
    body,
    {
      // 安装可能较慢，不沿用实例默认 15s 超时
      timeout: 0,
      headers: {
        ...authHeadersBeSuperAssistant(),
        'Content-Type': 'application/json',
      },
    },
  )
  const st = res?.status
  if (st != null && Number(st) !== 200 && String(st) !== '200') {
    return Promise.reject(new Error(res?.message || res?.msg || '安装失败'))
  }
  if (res?.success === false) {
    return Promise.reject(new Error(res.message || res.msg || '安装失败'))
  }
  const inner = res?.data != null && typeof res.data === 'object' ? res.data : null
  if (inner && Object.prototype.hasOwnProperty.call(inner, 'success')) {
    if (inner.success !== true) {
      return Promise.reject(new Error(res?.message || res?.msg || '安装失败'))
    }
    return inner
  }
  return inner ?? res
}

/**
 * 解析收藏接口统一响应
 * @param {Record<string, unknown>} res
 * @returns {{ isStarred: boolean, starred: boolean }}
 */
function parseSkillFollowResponse(res) {
  const status = res?.status
  const ok =
    status == null ||
    Number(status) === 200 ||
    String(status) === '200'
  if (!ok) {
    throw new Error(res?.message || res?.msg || '操作失败')
  }
  const inner =
    res?.data != null && typeof res.data === 'object' && !Array.isArray(res.data)
      ? res.data
      : {}
  const followedRaw =
    inner.followed ??
    inner.isStarred ??
    inner.starred ??
    res?.followed ??
    res?.isStarred ??
    res?.starred
  if (followedRaw == null) {
    return { isStarred: null, starred: null }
  }
  const isStarred = Boolean(followedRaw)
  return { isStarred, starred: isStarred }
}

/**
 * 收藏 Skill（POST /api/v1/stars/{slug}）
 * @returns {Promise<{ isStarred: boolean, starred: boolean }>}
 */
export async function postSkillFollow(slug) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockToggleSkillStar(String(slug ?? '').trim(), true)
  const res = await api.post(`${HUB}/api/v1/stars/${s}`, null, {
    headers: authHeaders(),
  })
  return parseSkillFollowResponse(res)
}

/**
 * 取消收藏 Skill（DELETE /api/v1/stars/{slug}）
 * @returns {Promise<{ isStarred: boolean, starred: boolean }>}
 */
export async function deleteSkillFollow(slug) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockToggleSkillStar(String(slug ?? '').trim(), false)
  const res = await api.delete(`${HUB}/api/v1/stars/${s}`, {
    headers: authHeaders(),
  })
  return parseSkillFollowResponse(res)
}

/**
 * 获取 Skill 文件树
 * GET /api/v1/skills/{slug}/tree?version={}
 * @param {string} slug
 * @param {string} [version]
 * @returns {Promise<{ version: string, files: Array<{ path: string, type: 'file'|'directory', size?: number, contentType?: string }> }>}
 */
export async function fetchSkillFileTree(slug, version) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) return Promise.reject(new Error('缺少 slug'))
  const params = {}
  if (version) params.version = version
  const res = await api.get(`${HUB}/api/v1/skills/${s}/tree`, {
    params,
    headers: authHeaders(),
  })
  const body = res?.data != null && typeof res.data === 'object' ? res.data : res
  return {
    version: body?.version ?? '',
    files: Array.isArray(body?.files) ? body.files : [],
  }
}

/**
 * 获取 Skill 文件内容（纯文本）
 * GET /api/v1/skills/{slug}/file?path={}&version={}
 * @param {string} slug
 * @param {string} path
 * @param {string} [version]
 * @returns {Promise<string>}
 */
export async function fetchSkillFileContent(slug, path, version) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) return Promise.reject(new Error('缺少 slug'))
  const params = { path }
  if (version) params.version = version
  // 文件内容接口返回纯文本，使用 responseType: 'text'
  const res = await api.get(`${HUB}/api/v1/skills/${s}/file`, {
    params,
    headers: authHeaders(),
    responseType: 'text',
    transformResponse: [(data) => data],
  })
  // axios 拦截器可能已解包，兼容两种情况
  return typeof res === 'string' ? res : (res?.data ?? '')
}

/**
 * 获取 Skill 下载预签名 URL
 * GET …/api/v1/skills/{slug}/download
 * @param {string} slug
 * @param {{ version?: string, expires?: number }} [options]
 * @returns {Promise<{ downloadUrl: string, version: string, filename: string, expiresIn: number }>}
 */
export async function fetchSkillDownloadUrl(slug, options = {}) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  const params = {}
  if (options.version) params.version = options.version
  if (options.expires != null) params.expires = options.expires
  const res = await api.get(`${HUB}/api/v1/skills/${s}/download`, {
    params,
    headers: authHeaders(),
  })
  const body = res?.data != null && typeof res.data === 'object' ? res.data : res
  return {
    downloadUrl: body?.downloadUrl ?? body?.download_url ?? '',
    version: body?.version ?? '',
    filename: body?.filename ?? '',
    expiresIn: body?.expiresIn ?? body?.expires_in ?? 3600,
  }
}

// ============== 新 API 接口（deerflow-api-docs.md）==============

/**
 * 获取技能在各 Agent 的绑定状态
 * GET /api/v1/skills/{slug}/binding-status
 * @param {string} slug - Skill 唯一标识
 * @returns {Promise<{ agents: Array<{ agentId: string, agentName: string, status: string, avatar?: string, boundVersion?: string, isLatest?: boolean }>, latestVersion: string }>}
 */
export async function fetchSkillBindingStatus(slug) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockFetchSkillBindingStatus(String(slug ?? '').trim(), DIGITAL_HUMANS_RAW)
  const res = await api.get(`${HUB}/api/v1/skills/${s}/binding-status`, {
    headers: authHeaders(),
  })
  const envelopeStatus = res?.status
  if (
    envelopeStatus != null &&
    Number(envelopeStatus) !== 200 &&
    String(envelopeStatus) !== '200'
  ) {
    return Promise.reject(new Error(res?.message || '请求失败'))
  }
  // API 返回结构：{ status, message, data: { slug, latest_version, bindings: [...] } }
  const body = res?.data != null && typeof res.data === 'object' ? res.data : res
  const latestVersion = body?.latest_version || ''
  const bindings = Array.isArray(body?.bindings) ? body.bindings : []
  // 映射 bindings → agents，保持字段名兼容
  const agents = bindings.map((item) => ({
    agentId: item?.agent_id,
    agentName: item?.agent_name,
    status: item?.bound_version ? 'installed' : 'idle',
    isDefault: item?.is_default,
    boundVersion: item?.bound_version,
    isLatest: item?.is_latest,
    enabled: item?.enabled,
    // 新增：agent 的完整信息用于显示
    displayName: item?.display_name || item?.agent_name,
    description: item?.description,
    avatar: item?.avatar,
  }))
  return { agents, latestVersion }
}

/**
 * 安装技能到指定 Agent（新接口）
 * POST /api/v1/skills/{slug}/bind-agents
 * @param {string} slug - Skill 唯一标识
 * @param {string|number} agentId - Agent ID
 * @param {{ version?: string, enabled?: boolean }} [options] - 可选版本和启用状态
 * @returns {Promise<{ success: boolean }>}
 */
export async function installSkillToAgent(slug, agentId = 'main', options = {}) {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockInstallSkillToAgent(String(slug ?? '').trim(), agentId)
  // agentId 可能是数字或字符串，统一处理
  const agentIdNum = typeof agentId === 'number' ? agentId : parseInt(String(agentId ?? ''), 10)
  const body = {
    agent_ids: [agentIdNum],
    version: options.version || undefined,
    enabled: options.enabled !== undefined ? options.enabled : true,
  }
  // 移除 undefined 字段
  if (body.version === undefined) delete body.version

  const res = await api.post(
    `${HUB}/api/v1/skills/${s}/bind-agents`,
    body,
    {
      timeout: 0,
      headers: {
        ...authHeadersBeSuperAssistant(),
        'Content-Type': 'application/json',
      },
    },
  )

  const st = res?.status
  if (st != null && Number(st) !== 200 && String(st) !== '200') {
    return Promise.reject(new Error(res?.message || res?.msg || '安装失败'))
  }
  if (res?.success === false) {
    return Promise.reject(new Error(res.message || res.msg || '安装失败'))
  }
  const inner = res?.data != null && typeof res.data === 'object' ? res.data : null
  if (inner && Object.prototype.hasOwnProperty.call(inner, 'success')) {
    if (inner.success !== true) {
      return Promise.reject(new Error(res?.message || res?.msg || '安装失败'))
    }
    return inner
  }
  return inner ?? { success: true }
}

/**
 * 从指定 Agent 卸载技能（新接口）
 * DELETE /api/v1/installed/skills/{slug}?agentName={name}
 * @param {string} slug - Skill 唯一标识
 * @param {string} agentName - Agent 名称（默认 'main'）
 * @returns {Promise<{ success: boolean }>}
 */
export async function uninstallSkillFromAgent(slug, agentName = 'main') {
  const s = encodeURIComponent(String(slug ?? '').trim())
  if (!s) {
    return Promise.reject(new Error('缺少 slug'))
  }
  if (DEV_MOCK) return mockUninstallSkillFromAgent(String(slug ?? '').trim(), agentName, DIGITAL_HUMANS_RAW)
  const agent = String(agentName ?? '').trim() || 'main'

  const res = await api.delete(
    `${HUB}/api/v1/installed/skills/${s}`,
    {
      params: { agentName: agent },
      headers: authHeaders(),
    },
  )

  const st = res?.status
  if (st != null && Number(st) !== 200 && String(st) !== '200') {
    return Promise.reject(new Error(res?.message || res?.msg || '卸载失败'))
  }
  return { success: true }
}
