/**
 * dev-mocks 数字人市场字段映射
 *
 * 把 RAW_AGENTS（dev-mocks 的事实源）翻译成 avatarApi.fetchAgentList / fetchAgentDetail
 * 期望的后端字段格式。
 *
 * 同时输出 snake_case + camelCase + raw 嵌套，最大化兼容各消费方。
 */

import { DIGITAL_HUMANS_RAW, MARKET_ONLY_AGENTS, findRawAgent, aggregateTags } from './digital-humans'
import { isHired, isFollowed } from './hired-state'
import { TEAM_ASSISTANT_AGENT_ID } from './team-assistant'

/** 市场列表 = 我已有的那批 + 市场独有的（后者才是能聘的） */
export const MARKET_AGENTS_RAW = [...DIGITAL_HUMANS_RAW, ...MARKET_ONLY_AGENTS]

/** 详情查找（findRawAgent 已同时覆盖市场独有的那批） */
function findMarketRaw(id) {
  return findRawAgent(id)
}

/**
 * 把 RAW agent 转成 fetchAgentList items 元素（市场卡片用）
 */
export function toMarketItem(raw) {
  if (!raw) return null
  const id = raw.agent_id
  const followed = isFollowed(id)
  const hired = isHired(id)
  return {
    id,
    ocAgentId: id,
    agent_id: id,
    name: raw.agent_display_name,
    display_name: raw.agent_display_name,
    displayName: raw.agent_display_name,
    slug: raw.agent_name,
    avatar_url: raw.agent_avatar_url || '',
    avatar: raw.agent_avatar_url || '',
    version: raw.agent_version,
    latest_version: {
      id: `${id}-${raw.agent_version}`,
      version: raw.agent_version,
      changelog: raw.changelog,
      fileMd5: '',
      downloadUrl: '',
    },
    tags: Array.isArray(raw.agent_tags) ? raw.agent_tags : [],
    capabilities: [],
    official: raw.is_official,
    author: {
      name: raw.agent_uploader_account,
      display_name: raw.agent_uploader,
      displayName: raw.agent_uploader,
      avatar_url: '',
    },
    summary: raw.agent_description,
    description: raw.agent_description,
    detailedDescription: raw.detailed_description,
    detailed_description: raw.detailed_description,
    functions: raw.functions,
    scope: raw.scope,
    scenarios: raw.scenarios,
    riskLevel: raw.risk_level,
    risk_level: raw.risk_level,
    license: raw.license,
    changelog: raw.changelog,
    is_builtin: raw.is_builtin,
    isBuiltin: raw.is_builtin,
    is_installed: hired,
    isInstalled: hired,
    is_followed: followed,
    isFollowed: followed,
    favorited: followed,
    stats_stars: raw.star_count,
    statsStars: raw.star_count,
    stats_downloads: raw.download_count,
    statsDownloads: raw.download_count,
    stats_hires: 0,
    statsHires: 0,
    created_at: raw.first_used_at,
    updated_at: raw.last_used_at,
    raw: {
      ocAgentId: id,
      ...raw,
    },
  }
}

/**
 * fetchAgentList mock
 * 支持 search / tag 过滤（市场页面可能传）
 * 注：团队助手是协作模块内置 bot，不出现在市场列表
 */
export function mockFetchAgentList(params = {}) {
  const all = MARKET_AGENTS_RAW
    .filter((a) => Number(a.agent_id) !== TEAM_ASSISTANT_AGENT_ID)
    .map(toMarketItem)
  let items = all

  if (params.search) {
    const q = String(params.search).toLowerCase()
    items = items.filter((it) =>
      String(it.name || '').toLowerCase().includes(q) ||
      String(it.summary || '').toLowerCase().includes(q),
    )
  }
  if (params.tag && params.tag !== 'all') {
    items = items.filter((it) => (it.tags || []).includes(params.tag))
  }

  const total = items.length
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 20
  const start = (page - 1) * pageSize
  const sliced = items.slice(start, start + pageSize)

  return {
    items: sliced,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: start + pageSize < total,
    },
  }
}

/**
 * fetchAgentDetail mock
 */
export function mockFetchAgentDetail(id) {
  const raw = findMarketRaw(id)
  if (!raw) return null
  return toMarketItem(raw)
}

/**
 * fetchAgentTags mock
 */
export function mockFetchAgentTags() {
  return aggregateTags()
}

/**
 * followAgent mock
 */
export function mockFollowAgent(agentId, isFollow) {
  // 实际状态切换交由 hired-state 的 setFollowed 处理（由 avatarApi 中调用）
  return { followed: !!isFollow, market_agent_id: Number(agentId) }
}

/**
 * 版本列表 mock（fetchAgentVersions）
 */
export function mockFetchAgentVersions(agentId) {
  const raw = findMarketRaw(agentId)
  if (!raw) return { items: [] }
  // mock 一份单版本数据（足够 UI 不崩）
  return {
    items: [
      {
        id: `${raw.agent_id}-${raw.agent_version}`,
        version: raw.agent_version,
        agent_id: raw.agent_id,
        changelog: raw.changelog,
        status: 'online',
        created_at: raw.last_used_at,
      },
    ],
  }
}
