import { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { formatApiDetailField } from '../utils/apiErrorMessage'

export class EmployeeStreamClient {
  constructor() {
    this.controllers = new Map()
  }

  async connect(threadId, input, context = {}, callbacks = {}) {
    const url = `${getOneBaseUrl()}/kooky-api/api/langgraph-compat/threads/${threadId}/runs/stream`
    const token = getSsoToken()
    const existing = this.controllers.get(threadId)
    if (existing) existing.abort()

    const controller = new AbortController()
    this.controllers.set(threadId, controller)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistant_id: 'lead_agent',
          input,
          context,
          config: { recursion_limit: 1000 },
          on_disconnect: 'continue',
          stream_mode: ['messages-tuple', 'values', 'updates', 'custom', 'events'],
          stream_subgraphs: true,
          stream_resumable: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        let detailMsg = ''
        try {
          const j = JSON.parse(text)
          detailMsg = formatApiDetailField(j?.detail) || formatApiDetailField(j?.message)
        } catch {
          /* 非 JSON 响应 */
        }
        callbacks.onError?.(new Error(detailMsg || text || `HTTP ${response.status}`))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          callbacks.onFinish?.({})
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.replace(/\r\n/g, '\n').split('\n\n')
        buffer = events.pop()

        for (const eventStr of events) {
          if (!eventStr.trim()) continue
          this._dispatchEvent(eventStr, callbacks)
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    } finally {
      if (this.controllers.get(threadId) === controller) {
        this.controllers.delete(threadId)
      }
    }
  }

  _dispatchEvent(eventStr, callbacks) {
    let eventType = 'message'
    const dataLines = []

    for (const line of eventStr.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) eventType = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return

    let data
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }

    switch (eventType) {
      case 'messages-tuple':
      case 'messages': {
        const chunk = Array.isArray(data) ? data[0] : data
        const text = this._extractText(chunk?.content)
        if (text) callbacks.onTokenDelta?.(text, chunk)
        break
      }
      case 'events': {
        if (data?.event === 'on_chat_model_stream') {
          const text = this._extractText(data?.data?.chunk?.content)
          if (text) callbacks.onTokenDelta?.(text, data?.data?.chunk)
        } else if (data?.event === 'on_tool_end') {
          callbacks.onToolEnd?.(data?.data ?? data)
        } else if (data?.event === 'on_custom_event') {
          callbacks.onCustomEvent?.(data?.data ?? data)
        }
        break
      }
      case 'values':
      case 'updates':
      case 'message':
        callbacks.onStateChange?.(data)
        break
      case 'custom':
      case 'on_custom_event':
        callbacks.onCustomEvent?.(data)
        break
      case 'error':
        callbacks.onError?.(new Error(
          formatApiDetailField(data?.detail) || String(data?.message || 'Server error'),
        ))
        break
      default:
        break
    }
  }

  _extractText(content) {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map(item => (typeof item === 'string' ? item : item?.text || '')).join('')
    }
    return ''
  }

  close(threadId) {
    if (threadId) {
      const controller = this.controllers.get(threadId)
      if (controller) controller.abort()
      this.controllers.delete(threadId)
      return
    }
    for (const controller of this.controllers.values()) controller.abort()
    this.controllers.clear()
  }
}

export const employeeStreamClient = new EmployeeStreamClient()
