import axios from 'axios'
import { redirectToLogin } from '@/shared/utils/redirectToLogin'

const whiteUrlList = [
  '/cloudpro/portal/api/v1/common/getUser',
  '/cloudpro/portal/api/v1/announcement/pullLast',
  '/cloudpro/api/user-login/oauth/token/' // 登录流程内调用，401 不触发全局跳转
] //白名单接口

// 存储所有正在进行的请求
const pendingRequests = new Map()

// 生成请求的唯一标识
const generateRequestKey = (config) => {
  // 只使用 URL 作为唯一标识
  if (!config) {
    return ''
  }
  return config.url
}

// 移除请求从 pending 列表
const removePendingRequest = (config) => {
  if (!config) {
    return
  }
  const requestKey = generateRequestKey(config)
  if (pendingRequests.has(requestKey)) {
    pendingRequests.delete(requestKey)
  }
}
const { VITE_BASE_ENV } = window.BASEDB || {}
const instance = axios.create({
  timeout: 10000
})
/** 添加请求拦截器 **/
instance.interceptors.request.use(
  (config) => {
    // 根据配置决定是否需要取消相同 URL 的请求
    if (config.cancelPrevious) {
      const requestKeyCancle = generateRequestKey(config)
      if (pendingRequests.has(requestKeyCancle)) {
        pendingRequests.get(requestKeyCancle)('取消重复请求')
        pendingRequests.delete(requestKeyCancle)
      }
    }
    // 添加新的请求
    const requestKey = generateRequestKey(config)
    config.cancelToken = new axios.CancelToken((cancel) => {
      pendingRequests.set(requestKey, cancel)
    })

    // SaaS 版本下拦截所有 /cyxt/ 接口请求（不真正发起到后端）
    try {
      const urlContainsXfyunjia = (window.location.hostname || window.location.href || '').includes(
        'xfyunjia'
      )
      const isCyxtApi = /\/cyxt\//.test(config.url)

      if (urlContainsXfyunjia && isCyxtApi) {
        if (pendingRequests.has(requestKey)) {
          // 立刻取消该请求；在响应拦截里会以 ERR_CANCELED 被吞掉
          pendingRequests.get(requestKey)('SaaS 版本下不调用 /cyxt/ 接口')
          pendingRequests.delete(requestKey)
        }
      }
    } catch {
      // 兜底，路径解析异常时不影响正常请求
    }

    if (/^(\/devops|\/sae|\/dme|\/cyxt|\/asset)/.test(config.url)) {
      config.baseURL = ''
    }
    if (/^(\/apis)/.test(config.url)) {
      config.baseURL = ''
      // if (import.meta.env.MODE !== 'dev') {
      //   const saeEnv = localStorage.getItem('sae_current_env') || 'pre' // 默认研测环境
      //   const prefix = saeEnv === 'prod' ? '/sae' : '/sae-pre'
      // }
      // 根据当前页面路径判断是否是 SAE 应用，并添加对应前缀
      const currentPath = window.location.pathname
      const isSaePath = currentPath.includes('/sae/') || currentPath.includes('/sae-pre/')
      const isXfyunjiaPath = window.location.href.includes('xfyunjia')
      if (isXfyunjiaPath) {
        config.url = '/sae' + config.url
      } else if (isSaePath) {
        // 根据路径确定前缀：/sae-pre/ 路径用 /sae-pre，/sae/ 路径用 /sae
        let prefix = currentPath.includes('/sae-pre/') ? '/sae-pre' : '/sae'
        const saeSessionEnv = localStorage.getItem('sae_current_env') // 默认研测环境
        if (saeSessionEnv === 'prod') {
          prefix = '/sae'
        } else if (saeSessionEnv === 'pre') {
          prefix = '/sae-pre'
        }

        config.url = prefix + config.url
      }
    }

    if (config.method === 'get') {
      // 添加时间戳参数，防止浏览器（IE）对get请求的缓存
      config.params = {
        ...config.params,
        t: new Date().getTime()
      }
    }
    if (config.url.includes('/filedDownload')) {
      config.headers.responseType = 'blob'
    }
    // 文件上传，发送的是二进制流，设置请求头的'Content-Type'
    if (config.url.includes('/filedUpload')) {
      config.headers['Content-Type'] = 'multipart/form-data'
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/** 添加响应拦截器  **/
instance.interceptors.response.use(
  (response) => {
    // loadingInstance.close()
    // 没有 code 字段也视为成功（如部分接口直接返回业务数据）
    if (response.data && !Object.prototype.hasOwnProperty.call(response.data, 'code')) {
      return Promise.resolve(response.data)
    }
    if (
      ['200', '00000', '0000', '000000', '0', '10002', 'E00000000'].includes(
        String(response.data.code)
      )
    ) {
      return Promise.resolve(response.data)
    }
    if (
      ['200', '00000', '0000', '000000', '0', '10002', 'E00000000'].includes(String(response.code))
    ) {
      return Promise.resolve(response.data)
    }
    if (response.config.headers.responseType === 'blob') {
      return Promise.resolve(response.data)
    }
    if (
      (response.config.url.includes('/ice') || response.config.url.includes('/storage-use-web')) &&
      response.status === 200
    ) {
      return Promise.resolve(response.data)
    }
    // ElMessage({
    //   message: response.data.message || response.data.msg || response.data.info,
    //   type: 'error'
    // })
    return Promise.reject(response.data)
  },
  (error) => {
    if (error.code === 'ERR_CANCELED') {
      removePendingRequest(error?.config)
      return
    }
    if (error.response) {
      // 根据请求失败的http状态码去给用户相应的提示
      if ([401].includes(error.response.status)) {
        const reqUrl = error.config?.url || ''
        const skipAuthRedirect = whiteUrlList.some((p) => reqUrl.includes(p))
        if (!skipAuthRedirect) {
          redirectToLogin()
        }
      }
      // else if ([403].includes(error.response.status)) {
      //   window.location.href = '/cloud-work/noPermission'
      // }
      return Promise.reject(error)
    }
    // ElMessage({
    //   message: '请求超时, 请刷新重试',
    //   type: 'error'
    // })
    return Promise.reject(new Error('请求超时, 请刷新重试'))
  }
)

/* 统一封装get请求 */
export const get = (url, params, config = {}) => {
  return new Promise((resolve, reject) => {
    instance({
      method: 'get',
      url,
      params,
      ...config
    })
      .then((response) => {
        resolve(response)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

/* 统一封装post请求  */
export const post = (url, data, config = {}) => {
  return new Promise((resolve, reject) => {
    let requestConfig = {
      method: 'post',
      url,
      ...config
    }
    // 判断data类型，如果是对象则作为请求体数据，如果是字符串则作为URL参数
    if (config.params) {
      requestConfig.params = data
    } else {
      requestConfig.data = data
    }
    instance(requestConfig)
      .then((response) => {
        resolve(response)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

/* 统一封装delete请求  */
export const del = (url, data = {}, config = {}) => {
  return new Promise((resolve, reject) => {
    let requestConfig = {
      method: 'delete',
      url,
      ...config
    }
    if (config.params) {
      requestConfig.params = data
    } else {
      requestConfig.data = data
    }

    instance(requestConfig)
      .then((response) => {
        resolve(response)
      })
      .catch((error) => {
        reject(error)
      })
  })
}
