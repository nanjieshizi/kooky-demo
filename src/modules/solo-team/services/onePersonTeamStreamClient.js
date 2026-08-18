import { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { getKookyOnePersonTeamStreamUrl } from './onePersonTeamRuntimeApi'

function buildHeaders() {
  const token = getSsoToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}`, one_dev_token: token } : {}),
    Accept: 'text/event-stream',
  }
}

function toAbsoluteKookyUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  const value = String(pathOrUrl)
  if (/^https?:\/\//i.test(value)) return value
  const base = getOneBaseUrl()
  if (value.startsWith('/kooky-api/')) return `${base}${value}`
  if (value.startsWith('/api/v1/')) return `${base}/kooky-api${value}`
  return `${base}${value.startsWith('/') ? value : `/${value}`}`
}

function parseSseEvent(eventStr) {
  let eventType = 'message'
  let eventId = ''
  const dataLines = []

  for (const line of eventStr.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) eventType = line.slice(6).trim()
    else if (line.startsWith('id:')) eventId = line.slice(3).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }

  if (!dataLines.length) return null
  const rawData = dataLines.join('\n')
  let data = rawData
  try {
    data = JSON.parse(rawData)
  } catch {
    // Some gateways send plain text keepalive/status frames.
  }

  return { eventType, eventId, data }
}

export class OnePersonTeamStreamClient {
  constructor() {
    this.controllers = new Map()
  }

  async connectTeamEvents(teamId, lastEventId, callbacks = {}) {
    if (!teamId) return
    const key = `events:${teamId}`
    this.close(key)

    const query = new URLSearchParams()
    if (lastEventId !== undefined && lastEventId !== null && lastEventId !== '') {
      query.set('last_event_id', String(lastEventId))
    }
    const suffix = `/events/stream${query.toString() ? `?${query.toString()}` : ''}`
    await this._connect(key, toAbsoluteKookyUrl(getKookyOnePersonTeamStreamUrl(teamId, suffix)), callbacks)
  }

  async connectRunStream(teamId, runId, streamUrl, callbacks = {}) {
    if (!teamId || !runId) return
    const key = `run:${runId}`
    this.close(key)
    const url = streamUrl
      ? toAbsoluteKookyUrl(streamUrl)
      : toAbsoluteKookyUrl(getKookyOnePersonTeamStreamUrl(teamId, `/runs/${encodeURIComponent(String(runId))}/stream`))
    await this._connect(key, url, callbacks)
  }

  async _connect(key, url, callbacks = {}) {
    if (!url) return
    const controller = new AbortController()
    this.controllers.set(key, controller)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        callbacks.onError?.(new Error(text || `HTTP ${response.status}`))
        return
      }

      callbacks.onOpen?.()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          callbacks.onFinish?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.replace(/\r\n/g, '\n').split('\n\n')
        buffer = events.pop()

        for (const eventStr of events) {
          if (!eventStr.trim()) continue
          const event = parseSseEvent(eventStr)
          if (!event) continue
          callbacks.onEvent?.(event.eventType, event.data, event.eventId)
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') callbacks.onError?.(error)
    } finally {
      if (this.controllers.get(key) === controller) {
        this.controllers.delete(key)
      }
    }
  }

  close(key) {
    if (key) {
      const controller = this.controllers.get(key)
      if (controller) controller.abort()
      this.controllers.delete(key)
      return
    }
    for (const controller of this.controllers.values()) controller.abort()
    this.controllers.clear()
  }

  closeTeamEvents(teamId) {
    if (teamId) this.close(`events:${teamId}`)
  }

  closeRunStream(runId) {
    if (runId) this.close(`run:${runId}`)
  }
}

export const onePersonTeamStreamClient = new OnePersonTeamStreamClient()
