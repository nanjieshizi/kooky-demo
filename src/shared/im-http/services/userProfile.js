/**
 * 用户资料 API（兼容层 + 数据转换）
 * 纯接口函数已迁移到 @/shared/services/imApi.js
 * 此文件保留数据转换逻辑和缓存功能
 */

import {
  fetchUserProfileByAccountApi,
  fetchAgentDetailApi,
} from '@/shared/services/imApi.js'

const cache = new Map()
const agentCache = new Map()

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
    account,
    name: firstValue([record.display_name, record.name, account]),
    avatar: firstValue([record.logo, record.extras?.avatar, record.avatar, record.avatarHttpUrl]),
    title: firstValue([record.position, record.title, record.jobTitle]),
    department: normalizeDepartments(record.departments),
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
  const res = await fetchUserProfileByAccountApi(account)
  return normalizeUserProfileSearchResponse(res, account)
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
    isBot: true,
  }
}

async function requestAgentDetail(agentId, versionId) {
  const res = await fetchAgentDetailApi(agentId, versionId)
  return normalizeAgentDetail(res)
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

export function fetchAgentProfile(agentId, versionId) {
  const id = cleanText(agentId)
  if (!id) return Promise.reject(new Error('agentId is required'))
  const version = cleanText(versionId)
  const key = version ? `${id}::${version}` : id
  if (agentCache.has(key)) return agentCache.get(key)
  const p = agentRequester(id, version || undefined).catch((err) => {
    agentCache.delete(key)
    throw err
  })
  agentCache.set(key, p)
  return p
}
