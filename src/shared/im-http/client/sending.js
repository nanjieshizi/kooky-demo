/**
 * 消息发送功能
 */

import { sendGroupMessage } from '../services/group.js'
import { AppEventTypes } from '../eventTypes.js'

function stripEventId(eventId) {
  if (eventId == null) return undefined
  const raw = String(eventId).startsWith('$') ? String(eventId).slice(1) : String(eventId)
  const numeric = Number(raw)
  return Number.isFinite(numeric) && raw.trim() !== '' ? numeric : raw
}

function resolveResultEventId(result) {
  const eventId = result?.event_id || result?.content?.event_id || result?.message_id || result?.id
  return eventId != null ? String(eventId) : null
}

/**
 * 统一抽取发送结果，补充 dag / team_collab_task_id 等业务字段
 */
function buildSendResult(result) {
  return {
    eventId: resolveResultEventId(result),
    messageId: result?.message_id ?? null,
    dagCreated: Boolean(result?.dag_created),
    dag: result?.dag ?? null,
    teamCollabTaskId: result?.team_collab_task_id ?? null,
    awaitingHuman: Boolean(result?.awaiting_human),
    clarificationExcerpt: result?.clarification_excerpt ?? null,
    raw: result,
  }
}

function normalizeMention(item) {
  if (item == null || typeof item !== 'object') return item
  const participantId = item.participant_id ?? item.id ?? item.user_id
  const username = item.username ?? item.account ?? item.sender_name ?? ''
  return {
    participant_id: participantId,
    name: item.name,
    username,
    type: item.type || 'agent',
  }
}

/**
 * 构造发送给后端的消息体。
 * msgtype 只区分 text / file：有 attachments 视为 file，否则 text。
 * mentions / replyToId / forward_from 始终作为独立字段透传，不参与 msgtype 判断。
 */
function buildGroupMessageBody(content, options = {}) {
  const { replyToId, mentions, forward_from, attachments } = options
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  const body = {
    msgtype: hasAttachments ? 'file' : 'text',
    body: content ?? '',
  }

  if (hasAttachments) {
    body.attachments = attachments
  }
  if (Array.isArray(forward_from) && forward_from.length > 0) {
    body.forward_from = forward_from
  }
  if (replyToId) {
    body.reply_to_id = parseInt(replyToId, 10)
  }
  if (Array.isArray(mentions) && mentions.length > 0) {
    body.mentions = mentions.map(normalizeMention)
  }

  return body
}

/**
 * 发送文本消息
 * @param {Object} client - HttpIMClient 实例
 * @param {string|number} conversationId - 房间/会话 ID
 * @param {string} content - 消息内容
 * @param {Object} options - 选项
 */
export async function sendTextMessage(client, conversationId, content, options = {}) {
  client._checkInitialized()

  const trimmed = typeof content === 'string' ? content.trim() : String(content)
  const hasAttachments = Array.isArray(options.attachments) && options.attachments.length > 0

  // 纯文本消息必须有内容；有附件时允许文本为空
  if (!trimmed && !hasAttachments) {
    throw new Error('[HttpIMClient] 消息内容不能为空')
  }

  try {
    const result = await sendGroupMessage(conversationId, buildGroupMessageBody(trimmed, options))
    return buildSendResult(result)
  } catch (error) {
    console.error('[HttpIMClient] 发送消息失败:', error)

    throw error
  }
}

/**
 * 发送消息（别名）
 */
export async function sendMessage(client, conversationId, content, options) {
  return sendTextMessage(client, conversationId, content, options)
}

/**
 * 预览发送的消息内容
 */
export function previewOutgoingTextBody(client, conversationId, content, options = {}) {
  return typeof content === 'string' ? content.trim() : String(content)
}

/**
 * 发送文件消息（同时携带文字 / @提及 / 引用 / 转发等参数）
 * msgtype 固定为 file（同时有 file 和 text 时也以 file 为主）。
 */
export async function sendFileMessage(client, conversationId, fileInfo, options = {}) {
  client._checkInitialized()

  const { url, name, size, mimeType, body } = fileInfo
  const caption = typeof body === 'string' ? body.trim() : ''

  const attachments = [{
    url,
    name,
    size,
    mime_type: mimeType,
  }]

  try {
    const result = await sendGroupMessage(conversationId, buildGroupMessageBody(caption, {
      ...options,
      attachments,
    }))
    return buildSendResult(result)
  } catch (error) {
    console.error('[HttpIMClient] 发送文件消息失败:', error)
    throw error
  }
}

/**
 * 标记房间已读
 */
export async function markRoomRead(client, conversationId) {
  client._checkInitialized()

  // 触发未读更新事件
  client._emit(AppEventTypes.UnreadUpdated, { conversationId })
  client._emit(AppEventTypes.ReadMarkerUpdated, { conversationId })

  // TODO: 如果后端提供标记已读接口，在这里调用
}
