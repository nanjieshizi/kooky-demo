export function formatApiMessageField(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const msg = item.detail ?? item.message ?? item.msg ?? item.error
          if (msg != null) return formatApiMessageField(msg)
        }
        return ''
      })
      .filter(Boolean)
      .join('; ')
  }
  if (typeof value === 'object') {
    const msg = value.detail ?? value.message ?? value.msg ?? value.error
    if (msg != null) return formatApiMessageField(msg)
  }
  return String(value).trim()
}

function extractFromJsonString(text) {
  if (typeof text !== 'string' || !text.trim()) return ''
  const value = text.trim()
  if (value[0] !== '{' && value[0] !== '[') return ''
  try {
    return formatApiMessageField(JSON.parse(value))
  } catch {
    return ''
  }
}

export function apiErrorMessage(error, fallback = '操作失败，请稍后重试') {
  const responseData = error?.response?.data
  const fromResponse = formatApiMessageField(responseData)
  if (fromResponse) return fromResponse

  const fromJsonMessage = extractFromJsonString(error?.message)
  if (fromJsonMessage) return fromJsonMessage

  const fromDirectPayload = formatApiMessageField(error)
  if (fromDirectPayload && fromDirectPayload !== '[object Object]') return fromDirectPayload

  return fallback
}
