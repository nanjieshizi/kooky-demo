import { getOneBaseUrl } from '../utils/oneEnv.js'

const DEFAULT_HTTP_IM_WS_PATH = '/kooky-api/api/ws'

function readBaseDb(baseDb) {
  if (baseDb && typeof baseDb === 'object') return baseDb
  if (typeof window !== 'undefined' && window.BASEDB && typeof window.BASEDB === 'object') {
    return window.BASEDB
  }
  return {}
}

function parseBooleanFlag(value, defaultValue) {
  if (value == null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '')
}

function toWebSocketUrl(value) {
  const trimmed = trimTrailingSlash(value)
  if (trimmed.startsWith('https://')) return trimmed.replace(/^https:\/\//, 'wss://')
  return trimmed.replace(/^http:\/\//, 'ws://')
}

function resolveHttpImBaseUrl() {
  return trimTrailingSlash(getOneBaseUrl())
}

function resolveHttpImWsUrl(baseUrl) {
  return `${toWebSocketUrl(baseUrl)}${DEFAULT_HTTP_IM_WS_PATH}`
  // return `ws://deer-flow.iflytek.com/api/ws`
}

export function buildImClientInitOptions(options = {}, baseDb) {
  const config = readBaseDb(baseDb)
  const baseUrl = resolveHttpImBaseUrl()

  const initParams = {
    baseUrl,
    wsUrl: resolveHttpImWsUrl(baseUrl),
    token: options.accessToken || options.token,
    userId: options.userId,
    enableWebSocket: parseBooleanFlag(config.VITE_IM_WS_ENABLED, true),
  }

  return { initParams }
}
