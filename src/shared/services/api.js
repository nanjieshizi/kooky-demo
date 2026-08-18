import axios from 'axios'
import { redirectToLogin } from '@/shared/utils/redirectToLogin'
import { isElectron } from '@/modules/auth/sso'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { USER_INFO_STORAGE_KEY } from '@/shared/constants/storageKeys'
import { normalizeKookyApiAxiosUrl } from '@/shared/utils/kookyGateway'

// Electron 中直接请求服务端地址（跨域已在主进程中解除）
// 浏览器中使用相对路径（由 nginx/vite proxy 代理）；devlocal 下由 normalizeKookyApiAxiosUrl 去掉 /kooky-api 并将 /api/langgraph-compat/ 改为 /api/，base 用空串
function getBaseURL() {
  if (isElectron) return getOneBaseUrl()
  if (import.meta.env.MODE === 'devlocal') return ''
  return '/api'
}

/**
 * 从 localStorage 的 super-assistant-userInfo 中读取 access_token
 */
export function getSsoToken() {
  if (import.meta.env.MODE === 'devlocal') {
    const t = import.meta.env.VITE_LOCAL_AUTH_TOKEN
    if (t != null && String(t).trim() !== '') return String(t).trim()
  }
  try {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY)
    if (raw) {
      const userInfo = JSON.parse(raw)
      return userInfo?.access_token || ''
    }
  } catch (e) {
    // ignore
  }
  return ''
}

/**
 * 生成 Bearer Authorization 头，供各 service 模块统一使用
 */
export function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  withCredentials: true,
})

// Request interceptor: attach Token header
api.interceptors.request.use(
  (config) => {
    if (config.url) config.url = normalizeKookyApiAxiosUrl(config.url)
    if (isElectron) config.baseURL = getBaseURL()
    // 从 localStorage 读取 access_token，通过 Authorization header 传递
    const token = getSsoToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    if (import.meta.env.MODE === 'devlocal' && token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    const data = response.data

    // Handle responses with a code field
    if (data && data.code !== undefined) {
      const successCodes = ['200', '00000', '0000', '0']
      if (successCodes.includes(String(data.code))) {
        return data
      }
      return Promise.reject(data)
    }

    // Handle plain 200 responses without code field
    return data
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      redirectToLogin()
    }
    return Promise.reject(error)
  }
)

export default api
