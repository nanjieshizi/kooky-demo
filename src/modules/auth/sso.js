import Cookies from 'js-cookie'

// Detect if running in Electron
export const isElectron = !!(window && window.process && window.process.type) ||
  !!(window && window.electronAPI) ||
  navigator.userAgent.includes('Electron')

// Environment detection
const ENV_MAP = {
  'localhost:5173': 'dev',
  'localhost:5174': 'dev',
  'one-dev.iflytek.com': 'dev',
  'one-test.iflytek.com': 'test',
  'one-pre.iflytek.com': 'pre',
  'one.iflytek.com': 'prod'
}

// Get SSO config from window.BASEDB or fallback
function getConfig() {
  return window.BASEDB || {}
}

// Get current environment
export function getEnv() {
  return ENV_MAP[window.location.host] || 'dev'
}

/**
 * 获取 SSO 回调地址
 * Electron 中使用本地地址，浏览器中使用当前页面地址
 */
function getCallbackUrl() {
  if (isElectron) {
    // Electron 中 SSO 回调到本地地址
    return encodeURIComponent(window.location.origin + window.location.pathname)
  }
  return encodeURIComponent(window.location.href)
}

/**
 * 跳转 SSO 登录
 * 在 Electron 中，SSO 登录后会回调到本地地址，
 * Electron 主进程中的 will-navigate 拦截器会处理 ticket 提取
 */
export function ssoLogin() {
  const { VITE_SSO_URL } = getConfig()
  if (!VITE_SSO_URL) return
  const callbackUrl = getCallbackUrl()
  window.location.href = `${VITE_SSO_URL}?c_url=${callbackUrl}`
}

/**
 * SSO 登出
 */
export function ssoLogout() {
  const { VITE_SSO_OUT_URL } = getConfig()
  // Clear all cookies
  const tokenCookies = [
    'one-test-token', 'one-dev-token', 'one-pre-token',
    'one_test_token', 'one_dev_token', 'one_pre_token',
    'bk_token', 'Token'
  ]
  tokenCookies.forEach(k => Cookies.remove(k))
  sessionStorage.clear()
  localStorage.removeItem('userInfo')

  if (!VITE_SSO_OUT_URL || isElectron) {
    // Electron 中直接回到本地登录页
    window.location.hash = '#/'
    window.location.reload()
    return
  }

  const callbackUrl = encodeURIComponent(window.location.origin + '/#/')
  window.location.href = `${VITE_SSO_OUT_URL}?c_url=${callbackUrl}`
}

/**
 * 从 URL 提取 ticket（兼容 hash 路由和普通路由）
 */
export function getTicket() {
  // 先从主 URL 的 search 参数中查找
  const params = new URLSearchParams(window.location.search)
  const ticket = params.get('ticket')
  if (ticket) return ticket

  // 再从 hash 部分查找（hash 路由场景）
  const hash = window.location.hash
  if (hash && hash.includes('ticket=')) {
    const hashParams = new URLSearchParams(hash.split('?')[1] || '')
    return hashParams.get('ticket')
  }

  return null
}

/**
 * 获取 service URL（当前地址去掉 ticket 参数）
 * 用于后端 ticket 换 token 时的 service 参数
 */
export function getServiceUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('ticket')
  return url.toString()
}

/**
 * 清除 URL 中的 ticket 参数（美化地址栏）
 */
export function cleanTicketFromUrl() {
  const url = new URL(window.location.href)
  if (url.searchParams.has('ticket')) {
    url.searchParams.delete('ticket')
    window.history.replaceState({}, '', url.toString())
  }
}
