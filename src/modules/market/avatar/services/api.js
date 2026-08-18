import axios from 'axios'
import { redirectToLogin } from '@/shared/utils/redirectToLogin'
import { isElectron } from '@/modules/auth/sso'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

// Electron 中直接请求服务端地址（跨域已在主进程中解除）
// 浏览器中使用相对路径（由 nginx/vite proxy 代理）
function getBaseURL() {
  if (isElectron) return getOneBaseUrl()
  return '/api'
}

/**
 * 从 localStorage 的 super-assistant-userInfo 中读取 access_token
 */
export function getSsoToken() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return userInfo?.access_token || ''
    }
  } catch (e) {
    // ignore
  }
  return ''
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  withCredentials: true,
})

// Request interceptor: attach Token header
api.interceptors.request.use(
  (config) => {
    if (isElectron) config.baseURL = getBaseURL()
    // 从 localStorage 读取 access_token，通过自定义 Header 传递
    const token = getSsoToken()
    if (token) {
      config.headers['one_dev_token'] = token
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
