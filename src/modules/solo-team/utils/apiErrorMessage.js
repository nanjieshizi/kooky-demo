/**
 * 将接口响应体中的 `detail` 规范为可展示的字符串（兼容 FastAPI 校验错误数组）
 * @param {unknown} detail
 * @returns {string}
 */
export function formatApiDetailField(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail.trim()
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const msg = item.msg ?? item.message
          if (msg != null) return String(msg).trim()
        }
        return ''
      })
      .filter(Boolean)
      .join('; ')
  }
  if (typeof detail === 'object') {
    const msg = detail.msg ?? detail.message
    if (msg != null) return String(msg).trim()
  }
  return String(detail).trim()
}

function tryExtractDetailFromJsonString(text) {
  if (typeof text !== 'string' || !text.trim()) return ''
  const t = text.trim()
  if (t[0] !== '{' && t[0] !== '[') return ''
  try {
    const data = JSON.parse(t)
    return pickApiErrorMessage(data)
  } catch {
    return ''
  }
}

function formatPlainMessage(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

function pickApiErrorMessage(body) {
  if (!body || typeof body !== 'object') return ''
  const rawMessage = body.message ?? body.msg
  const fromMessage = isGenericErrorMessage(rawMessage) ? '' : formatPlainMessage(rawMessage)
  if (fromMessage) return fromMessage

  const fromDetail = formatApiDetailField(body.detail)
  if (fromDetail) return fromDetail

  const fromData = body.data && typeof body.data === 'object' ? pickApiErrorMessage(body.data) : ''
  if (fromData) return fromData

  const fromError = formatPlainMessage(body.error)
  if (fromError) return fromError

  return ''
}

function isGenericErrorMessage(message) {
  const text = formatPlainMessage(message)
  return !text || /^request failed with status code \d+$/i.test(text) || text === 'Network Error'
}

/**
 * 一人团队模块：接口错误提示优先使用后端响应体 `message/detail`（无则使用 fallback）
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function soloTeamApiErrorMessage(error, fallback = '操作失败，请稍后重试') {
  const fromResponse = pickApiErrorMessage(error?.response?.data)
  if (fromResponse) return fromResponse

  const fromRejectedBody = error?.response ? '' : pickApiErrorMessage(error)
  if (fromRejectedBody) return fromRejectedBody

  const fromJsonMessage = tryExtractDetailFromJsonString(error?.message)
  if (fromJsonMessage) return fromJsonMessage

  if (!isGenericErrorMessage(error?.message)) return formatPlainMessage(error.message)

  return fallback
}
