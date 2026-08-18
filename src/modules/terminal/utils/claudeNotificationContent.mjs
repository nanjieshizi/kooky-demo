// cmux 对齐：Claude Code hook 事件 → 通知内容（title / subtitle / body）
//
// 设计要点：
// - Title 永远是 'Claude Code'（常量，不随事件变化）
// - Subtitle 做事件分类：Completed / Permission / Error / Waiting / Attention
// - Body 承载真正的内容（Stop 用 transcript 最后一条 assistant 消息，Notification 用 hook message）
// - SessionEnd 不创建通知（避免覆盖 Stop 的 Completed 通知）
//
// 对应 cmux 源：
//   CLI/cmux.swift summarizeClaudeHookStop / summarizeClaudeHookNotification / classifyClaudeNotification

const TITLE_CONST = 'Claude Code'
const BODY_MAX_LEN = 200

function normalizeToSingleLine(text, maxLen = BODY_MAX_LEN) {
  if (typeof text !== 'string') return ''
  const single = text.replace(/\s+/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen - 1) + '…'
}

/**
 * 从路径取最后一个目录作为"项目名"
 */
function projectNameFromCwd(cwd) {
  if (typeof cwd !== 'string') return ''
  const normalized = cwd.replace(/[/\\]+$/, '')
  const parts = normalized.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || ''
}

/**
 * Stop hook → 通知内容
 * @param {object} hookData - hook 主数据（含 cwd 等）
 * @param {object} latestAssistantTurn - hook-server.js 解析的最新 assistant turn（含 text）
 * @param {string} cliBrand - CLI 品牌标识（'claude-code' | 'kooky'）
 * @returns {{ title, subtitle, body }}
 */
export function buildStopNotification(hookData = {}, latestAssistantTurn = null, cliBrand = 'claude-code') {
  const cwd = hookData?.cwd || ''
  const projectName = projectNameFromCwd(cwd)
  const subtitle = projectName ? `Completed in ${projectName}` : 'Completed'
  const brandName = cliBrand === 'kooky' ? 'Ko' : 'Claude'

  // Body 优先级：latestAssistantTurn.text（来自 transcript）→ hook result → fallback
  let body = ''
  if (latestAssistantTurn && typeof latestAssistantTurn.text === 'string' && latestAssistantTurn.text.trim()) {
    body = normalizeToSingleLine(latestAssistantTurn.text)
  } else if (typeof hookData?.result === 'string' && hookData.result.trim()) {
    body = normalizeToSingleLine(hookData.result)
  } else {
    body = projectName ? `${brandName} session completed in ${projectName}` : `${brandName} session completed`
  }

  return { title: TITLE_CONST, subtitle, body }
}

/**
 * Notification hook → 通知内容（通过关键词分类）
 * @param {object} hookData
 * @param {string} cliBrand - CLI 品牌标识（'claude-code' | 'kooky'）
 * @returns {{ title, subtitle, body }}
 */
export function buildNotificationHookNotification(hookData = {}, cliBrand = 'claude-code') {
  const raw =
    hookData?.message ||
    hookData?.body ||
    hookData?.text ||
    hookData?.prompt ||
    hookData?.error ||
    hookData?.description ||
    hookData?.notification?.message ||
    hookData?.data?.message ||
    ''
  const msg = typeof raw === 'string' ? raw : String(raw || '')
  const lower = msg.toLowerCase()
  const brandName = cliBrand === 'kooky' ? 'Ko' : 'Claude'

  let subtitle = 'Attention'
  let body = msg.trim() || `${brandName} needs your attention`

  if (/permission|approve|approval/.test(lower)) {
    subtitle = 'Permission'
    if (!msg.trim()) body = 'Approval needed'
  } else if (/error|failed|exception/.test(lower)) {
    subtitle = 'Error'
    if (!msg.trim()) body = `${brandName} reported an error`
  } else if (/complet|finish|done|success/.test(lower)) {
    subtitle = 'Completed'
    if (!msg.trim()) body = 'Task completed'
  } else if (/idle|wait|input/.test(lower)) {
    subtitle = 'Waiting'
    if (!msg.trim()) body = 'Waiting for input'
  }

  body = normalizeToSingleLine(body, 180)
  return { title: TITLE_CONST, subtitle, body }
}

/**
 * OSC 9/99/777 → 通用终端通知
 */
export function buildOscNotification(hookData = {}) {
  const content = hookData?.content || hookData?.text || ''
  return {
    title: TITLE_CONST,
    subtitle: 'Terminal',
    body: normalizeToSingleLine(content, 180) || '终端通知',
  }
}
