/**
 * 从主进程转发来的 Claude Code HTTP hook 载荷中取出会话 ID 与「回复/轮次」ID。
 * 官方文档常见字段：session_id；response 侧不同版本可能为 response_id / turn_id / message_id 等。
 *
 * @param {object} payload - { event, route?, data, latestAssistantTurn?, ... }，与 hook-server → preload 一致
 * @returns {{ sessionUuid: string|null, responseId: string|null, event: string|null }}
 */
export function extractClaudeHookIdentifiers(payload) {
  const event = payload?.event ?? null
  const data = payload?.data
  if (!data || typeof data !== 'object') {
    return { sessionUuid: null, responseId: null, event }
  }
  const sessionUuid = data.session_id ?? data.sessionId ?? null

  const lat = payload?.latestAssistantTurn
  let responseId = null
  if (lat && typeof lat === 'object' && lat.id != null && String(lat.id).trim()) {
    responseId = String(lat.id).trim() || null
  }

  return { sessionUuid, responseId, event }
}

/** @param {object|null|undefined} data - payload.data */
export function listClaudeHookDataKeys(data) {
  if (!data || typeof data !== 'object') return []
  return Object.keys(data).sort()
}

/**
 * Hook 载荷里的会话 transcript 路径（主会话或子 Agent）
 * @param {{ data?: object }|null|undefined} payload
 * @returns {string|null}
 */
export function extractTranscriptPathFromPayload(payload) {
  const data = payload?.data
  if (!data || typeof data !== 'object') return null
  const raw =
    data.transcript_path ??
    data.agent_transcript_path ??
    data.transcriptPath ??
    null
  if (raw == null || typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length ? t : null
}

// —— Stop hook：data 上字符串字段 last_assistant_message ——

/** @param {unknown} raw - data.last_assistant_message，字符串 */
function textFromHookLastAssistantMessage(raw) {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  return ''
}

/** 与 hook-server 一致：正文在 POST body（即 payload.data）根上的 last_assistant_message */
function pickLastAssistantMessageFromPayload(payload) {
  const d = payload?.data
  if (!d || typeof d !== 'object') return undefined
  return d.last_assistant_message ?? d.lastAssistantMessage
}

/**
 * Stop 事件：抽取点赞接口所需字段与展示用回复摘要
 * 正文来自 hook data.last_assistant_message；id/session 优先 latestAssistantTurn（transcript）
 * @param {{ event?: string, data?: object, latestAssistantTurn?: { id?: string|null, sessionId?: string } }} payload
 * @returns {{ replyText: string, responseId: string, sessionId: string }}
 */
export function extractStopHookReplyContext(payload) {
  const ids = extractClaudeHookIdentifiers(payload)
  let sessionId = ids.sessionUuid != null ? String(ids.sessionUuid) : ''
  let responseId = ''
  const lam = pickLastAssistantMessageFromPayload(payload)
  let replyText = textFromHookLastAssistantMessage(lam)

  const lat = payload?.latestAssistantTurn
  if (lat && typeof lat === 'object') {
    if (lat.id != null && String(lat.id).trim()) {
      responseId = String(lat.id).trim()
    }
    if (lat.sessionId != null && String(lat.sessionId).trim()) {
      sessionId = String(lat.sessionId).trim()
    }
  }

  if (!responseId && ids.responseId != null && String(ids.responseId).trim()) {
    responseId = String(ids.responseId)
  }

  if (!replyText) {
    replyText = '（未能从 last_assistant_message 解析到助手正文）'
  }

  return {
    replyText,
    responseId,
    sessionId,
  }
}
