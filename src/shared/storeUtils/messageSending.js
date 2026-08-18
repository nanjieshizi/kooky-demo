// 消息发送 & 流式输出公共函数（chat / group 模块共用）

import { newClientMessageKey } from '@/shared/storeUtils/imMessageUtils'

export function addAssistantMessage(store, content, conversationId, extra = {}) {
  const rc = store._ensureConversationMessages(conversationId)
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let maxTs = 0
  for (const m of rc.messages) {
    if (m.conversationId === conversationId && typeof m.timestamp === 'number') {
      maxTs = Math.max(maxTs, m.timestamp)
    }
  }
  const timestamp = Math.max(Date.now(), maxTs + 1)
  rc.messages.push({
    eventId: id,
    conversationId,
    role: 'assistant',
    content: { msgtype: 'text', body: content },
    senderId: 'assistant',
    timestamp,
    ...extra,
  })
  return id
}

export function pushUserTurnAndAssistantStream(store, conversationId, userText, assistantExtra = {}) {
  const rc = store._ensureConversationMessages(conversationId)
  const userEventId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const assistantEventId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let maxTs = 0
  for (const m of rc.messages) {
    if (m.conversationId === conversationId && typeof m.timestamp === 'number') {
      maxTs = Math.max(maxTs, m.timestamp)
    }
  }
  const base = Math.max(Date.now(), maxTs + 1)
  const userMsg = {
    clientMessageKey: newClientMessageKey(),
    eventId: userEventId,
    conversationId,
    role: 'user',
    content: { msgtype: 'text', body: userText },
    senderId: store.userId,
    timestamp: base,
  }
  const assistantMsg = {
    clientMessageKey: newClientMessageKey(),
    eventId: assistantEventId,
    conversationId,
    role: 'assistant',
    content: { msgtype: 'text', body: '' },
    senderId: 'assistant',
    timestamp: base + 1,
    ...assistantExtra,
    isStreaming: true,
  }
  rc._activeStream = { messageId: assistantEventId }
  rc.messages.push(userMsg, assistantMsg)
  return assistantEventId
}

export function updateAssistantMessage(store, messageId, content) {
  const ctx = store._findMessageCtx(messageId)
  if (ctx?.msg) {
    ctx.msg.content = { ...(ctx.msg.content && typeof ctx.msg.content === 'object' ? ctx.msg.content : {}), body: content }
  }
}

export function appendAssistantMessage(store, messageId, chunk) {
  const ctx = store._findMessageCtx(messageId)
  if (ctx?.msg) {
    const current = ctx.msg.content && typeof ctx.msg.content === 'object' ? ctx.msg.content : { body: ctx.msg.content || '' }
    ctx.msg.content = { ...current, body: `${current.body || ''}${chunk}` }
  }
}

export function finishAssistantMessage(store, messageId) {
  const ctx = store._findMessageCtx(messageId)
  if (ctx?.msg) {
    ctx.msg.isStreaming = false
  }
  if (ctx?.rc?._activeStream?.messageId === messageId) {
    ctx.rc._activeStream = null
  }
}

export function cancelAssistantMessage(store, messageId) {
  const ctx = store._findMessageCtx(messageId)
  if (!ctx) return
  const { rc, msg } = ctx
  const index = rc.messages.indexOf(msg)
  if (index > -1) {
    rc.messages.splice(index, 1)
  }
  if (rc._activeStream?.messageId === messageId) {
    rc._activeStream = null
  }
}
