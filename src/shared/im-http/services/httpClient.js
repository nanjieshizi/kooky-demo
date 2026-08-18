/**
 * HTTP 客户端封装
 * 提供统一的 HTTP 请求接口
 */

class HttpClient {
  constructor() {
    this._baseUrl = ''
    this._token = ''
  }

  setConfig(baseUrl, token) {
    this._baseUrl = baseUrl
    this._token = token
  }

  async request(url, options = {}) {
    const params = options.params && typeof options.params === 'object'
      ? options.params
      : null
    const query = params
      ? new URLSearchParams(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
        ).toString()
      : ''
    const separator = query && String(url).includes('?') ? '&' : '?'
    const path = query ? `${url}${separator}${query}` : url
    const fullUrl = path.startsWith('http') ? path : `${this._baseUrl}${path}`

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`
    }

    const config = {
      ...options,
      headers,
    }
    delete config.params

    try {
      const response = await fetch(fullUrl, config)

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        error.status = response.status
        error.response = response
        throw error
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }

      return await response.text()
    } catch (error) {
      console.error('[HttpClient] 请求失败:', error)
      throw error
    }
  }

  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' })
  }

  post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  patch(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  delete(url, data, options = {}) {
    const hasBody = data !== undefined
    return this.request(url, {
      ...options,
      method: 'DELETE',
      ...(hasBody ? { body: JSON.stringify(data) } : {}),
    })
  }
}

export const httpClient = new HttpClient()
