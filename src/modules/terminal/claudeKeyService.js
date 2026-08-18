/**
 * Claude Code API Key 获取服务
 * 登录后从后端获取用户专属的 API Key 信息
 *
 * 鉴权方式：
 * - /kooky-api 接口：使用共享 api 实例 + Authorization Bearer token
 * - CC 专属接口（/api/llm/console/chat）：使用独立 ccApi 实例 + 环境 SSO header
 */

import axios from 'axios'
import api, { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl, getOneEnv } from '@/shared/utils/oneEnv'
import { redirectToLogin } from '@/shared/utils/redirectToLogin'

// CC 接口路径前缀（拼接在 one 域名之后，仅用于 logout 等非 kooky-api 接口）
const CC_API_PATH = '/api/llm/console/chat'

// 不同环境的 token header 名
const TOKEN_HEADER_MAP = {
  dev: 'one_dev_token',
  test: 'one_test_token',
  prod: 'bk_token',
}

// client-config、logout 使用的 type
const CLIENT_TYPE = 'kc-cc'

/** 与 OpenClaw 建连配套的登录态上报：kc-cc + kc-oc */
const CLIENT_LOGIN_STATUS_TYPES_WITH_OPENCLAW = Object.freeze(['kc-cc', 'kc-oc'])

/** KC 用户开放接口：登录态 in/out */
const KC_OPEN_USER_LOGIN_LOGOUT_PREFIX = '/kooky-api/api/v1/cms/kc-client'

/**
 * 获取 Authorization Bearer 头（/kooky-api 接口鉴权）
 */
function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** CC 接口请求体中的 bk_token */
function getBkTokenPayload() {
  return { bk_token: getSsoToken() || '' }
}

// CC 专属接口的 axios 实例（仅用于 logout 等 /api/llm/console/chat 下的接口）
const ccApi = axios.create({ timeout: 15000 })

ccApi.interceptors.request.use(
  (config) => {
    config.baseURL = getOneBaseUrl() + CC_API_PATH
    const token = getSsoToken()
    if (token) {
      const headerName = TOKEN_HEADER_MAP[getOneEnv()] || 'one_dev_token'
      config.headers[headerName] = token
    }
    return config
  },
  (error) => Promise.reject(error)
)

ccApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      redirectToLogin()
    }
    return Promise.reject(error)
  }
)

/**
 * 从后端获取 Claude Code 客户端配置
 * 接口：/kooky-api/api/client/v1/cli/config
 * @returns {Promise<{authToken: string, baseUrl: string, modelList: Array, env: Object}>}
 */
export async function fetchClaudeApiKey() {
  try {
    const res = await api.get(
      '/kooky-api/api/client/v1/cli/config',
      { headers: getAuthHeaders() }
    )

    // 共享 api 拦截器已解包 response.data，res 即为响应体
    const data = res || {}
    // models 不是环境变量，分离出来
    const { models: modelList, ...envVars } = data

    return {
      authToken: data.ANTHROPIC_AUTH_TOKEN,
      baseUrl: data.ANTHROPIC_BASE_URL,
      modelList: modelList || [],
      env: envVars,
    }
  } catch (error) {
    console.error('[claudeKeyService] fetchClaudeApiKey error:', error)
    throw error
  }
}

/**
 * 用户登出时调用，禁用该域账号的令牌并清除服务端缓存
 * @returns {Promise<void>}
 */
export async function logoutClaudeCode() {
  try {
    await ccApi.post(
      `/api/client-config/${CLIENT_TYPE}/logout`,
      getBkTokenPayload()
    )
  } catch (error) {
    console.error('[claudeKeyService] logoutClaudeCode error:', error)
    throw error
  }
}

/**
 * 上报客户端登录态
 * @param {'in'|'out'} status - in：login；out：logout
 * @param {{ includeOpenclawClientType?: boolean }} [options]
 * @returns {Promise<{ success?: boolean, message?: string }>}
 */
export async function postClaudeCodeClientLoginStatus(status, options = {}) {
  if (status !== 'in' && status !== 'out') {
    throw new Error('client_login_status 仅支持 in 或 out')
  }
  const action = status === 'in' ? 'login' : 'logout'
  const types = options.includeOpenclawClientType
    ? CLIENT_LOGIN_STATUS_TYPES_WITH_OPENCLAW
    : [CLIENT_TYPE]
  try {
    const results = await Promise.all(
      types.map((t) =>
        api.post(
          `${KC_OPEN_USER_LOGIN_LOGOUT_PREFIX}/${action}/${t}`,
          { ...getBkTokenPayload(), status },
          { headers: getAuthHeaders() }
        )
      )
    )
    // 共享 api 拦截器已解包，results 中每项即为响应体
    const allOk = results.every((r) => r?.success === true)
    const firstBad = results.find((r) => r?.success !== true)
    return {
      success: allOk,
      message: firstBad?.message,
    }
  } catch (error) {
    console.error('[claudeKeyService] postClaudeCodeClientLoginStatus error:', error)
    throw error
  }
}

/**
 * 清除本地存储的 Claude Code 相关配置
 */
export function clearLocalClaudeCodeConfig() {
  const STORAGE_KEY = 'claude_code_config'
  try {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn('[claudeKeyService] clearLocalClaudeCodeConfig error:', e)
  }
}

/**
 * 获取存储的 Claude Code 配置（可选，用于缓存）
 */
export function getCachedClaudeCodeConfig() {
  const STORAGE_KEY = 'claude_code_config'
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    console.warn('[claudeKeyService] getCachedClaudeCodeConfig error:', e)
  }
  return null
}

/**
 * 缓存 Claude Code 配置（可选，用于减少请求次数）
 */
export function cacheClaudeCodeConfig(config) {
  const STORAGE_KEY = 'claude_code_config'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.warn('[claudeKeyService] cacheClaudeCodeConfig error:', e)
  }
}

/**
 * 设置弹窗（新版 SettingsDialogNew）保存后刷新 Claude Code CLI 配置。
 * 浏览器 / demo 无 electronAPI 时直接跳过，返回 null。
 */
export async function refreshClaudeCodeSettings() {
  try {
    if (!window.electronAPI?.claudeCode?.setupEnv) return null
    const keyInfo = await fetchClaudeApiKey()
    if (keyInfo?.env) {
      await window.electronAPI.claudeCode.setupEnv(keyInfo.env, keyInfo.modelList)
    }
    return keyInfo
  } catch (e) {
    console.error('[claudeKeyService] refreshClaudeCodeSettings failed:', e)
    return null
  }
}
