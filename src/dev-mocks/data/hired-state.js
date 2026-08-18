/**
 * dev-mocks 聘用状态管理
 *
 * 维护一个内存 Map：agentId → hiredInfo
 * 给 hireAgent / fetchMyHiredList / digitalHumanApi.listAgents 用，让"聘用 → 一人团队员工出现"流程跑通。
 *
 * ⚠️ 数据只在浏览器会话期间存活；Cmd+R 会重置。需要持久化时把 Map 替换成 localStorage。
 */

import { DIGITAL_HUMANS_RAW, findRawAgent } from './digital-humans'

// agentId → hiredRecord
const hiredMap = new Map()

let lastHiredAt = Date.now()

function nextHiredAt() {
  // 保证每次聘用时间不同（影响排序）
  lastHiredAt = Math.max(Date.now(), lastHiredAt + 1)
  return lastHiredAt
}

/** 默认预聘用的数字人（启动时填充，让"我的员工"列表非空）
 *  1001-1004：基础数字人（产品/研发/测试/设计）
 *  1007：云帆管家（演示"协作 → Kode 转发"闭环时需要）
 */
const DEFAULT_HIRED_AGENT_IDS = [1001, 1002, 1003, 1004, 1007]

/**
 * 启动种子：把默认 4 个数字人塞进聘用列表
 */
export function seedDefaultHired() {
  for (const agentId of DEFAULT_HIRED_AGENT_IDS) {
    if (!hiredMap.has(Number(agentId))) {
      try { addHired(agentId) } catch (_) { /* 找不到 raw 就跳过 */ }
    }
  }
}

/**
 * 是否已聘用
 */
export function isHired(agentId) {
  return hiredMap.has(Number(agentId))
}

/**
 * 添加聘用记录
 * @param {number} agentId
 * @param {object} [opts] - { newName?: string, versionId?: string }
 * @returns {object} 聘用记录
 */
export function addHired(agentId, opts = {}) {
  const id = Number(agentId)
  const raw = findRawAgent(id)
  if (!raw) throw new Error(`agent ${agentId} not found`)
  const record = {
    agentId: id,
    hiredAt: nextHiredAt(),
    displayName: (opts.newName || raw.agent_display_name).trim() || raw.agent_display_name,
    versionId: opts.versionId || null,
    raw,
  }
  hiredMap.set(id, record)
  return record
}

/**
 * 解聘
 */
export function removeHired(agentId) {
  return hiredMap.delete(Number(agentId))
}

/**
 * 当前已聘用列表（按 hiredAt 倒序）
 */
export function listHired() {
  return Array.from(hiredMap.values()).sort((a, b) => b.hiredAt - a.hiredAt)
}

/**
 * 切换收藏（用于 followAgent mock）
 * 收藏状态我们存在内存里（不改 RAW 静态数据）
 */
const followedSet = new Set()

export function isFollowed(agentId) {
  return followedSet.has(Number(agentId))
}

export function setFollowed(agentId, follow) {
  const id = Number(agentId)
  if (follow) followedSet.add(id)
  else followedSet.delete(id)
  return follow
}

/**
 * 把"聘用记录"转成 fetchMyHiredList 的后端 item 格式
 * 让 transformItem 能正常归一化（输出 { id, name, version, source, ... }）
 */
export function toMyHiredItem(record) {
  const raw = record.raw
  return {
    ocAgentId: raw.agent_id,
    displayName: record.displayName,
    slug: raw.agent_name,
    version: raw.agent_version,
    official: raw.is_official,
    author: { name: raw.agent_uploader_account, displayName: raw.agent_uploader },
    fromAgentName: raw.agent_name,
    fromAgentSlug: raw.agent_name,
    isBuiltin: raw.is_builtin,
    avatar: raw.agent_avatar_url || '',
    summary: raw.agent_description,
    tags: raw.agent_tags,
    status: 'active',
    isFollowed: isFollowed(raw.agent_id),
    statsStars: raw.star_count,
    statsDownloads: raw.download_count,
    detailedDescription: raw.detailed_description,
    functions: raw.functions,
    scope: raw.scope,
    scenarios: raw.scenarios,
    riskLevel: raw.risk_level,
    license: raw.license,
    changelog: raw.changelog,
    fileMd5: '',
    downloadUrl: '',
    latestVersion: {
      id: `${raw.agent_id}-${raw.agent_version}`,
      fileMd5: '',
      downloadUrl: '',
      changelog: raw.changelog,
    },
  }
}

/**
 * 把"聘用记录"转成 digitalHumanApi.listAgents 的后端 item 格式
 * （一人团队"我的员工"列表用）
 */
export function toEmployeeAgentItem(record) {
  const raw = record.raw
  return {
    agent_id: raw.agent_id,
    agent_name: raw.agent_name,
    agent_display_name: record.displayName,
    agent_avatar_url: raw.agent_avatar_url || '',
    agent_description: raw.agent_description,
    agent_tags: raw.agent_tags,
    pinned: raw.pinned,
    pinned_at: raw.pinned_at,
    last_used_at: raw.last_used_at,
    first_used_at: new Date(record.hiredAt).toISOString(),
  }
}

/**
 * 重置（调试用，DevTools 跑 __kookyMock.resetHired() 触发）
 */
export function resetHired() {
  hiredMap.clear()
  followedSet.clear()
}

/**
 * 暴露给 DevTools 的快照
 */
export function snapshot() {
  return {
    hired: listHired(),
    followed: Array.from(followedSet),
  }
}
