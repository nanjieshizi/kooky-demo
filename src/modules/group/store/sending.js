/**
 * IM Store 子模块 - 消息发送 & 流式输出（group 群组频道）
 * 包含 sendMessage、clearConversationActiveStream 等方法
 */

import { client } from '@/shared/im-client'
import * as messageSending from '@/shared/storeUtils/messageSending'

export const groupSendingActions = {
  // 来自 messageSending 的方法
  addAssistantMessage(content, conversationId, extra) {
    return messageSending.addAssistantMessage(this, content, conversationId, extra)
  },

  pushUserTurnAndAssistantStream(conversationId, userText, assistantExtra) {
    return messageSending.pushUserTurnAndAssistantStream(this, conversationId, userText, assistantExtra)
  },

  updateAssistantMessage(messageId, content) {
    return messageSending.updateAssistantMessage(this, messageId, content)
  },

  appendAssistantMessage(messageId, chunk) {
    return messageSending.appendAssistantMessage(this, messageId, chunk)
  },

  finishAssistantMessage(messageId) {
    return messageSending.finishAssistantMessage(this, messageId)
  },

  cancelAssistantMessage(messageId) {
    return messageSending.cancelAssistantMessage(this, messageId)
  },

  // ─── F. 消息发送 & 流式输出 ──────────────────────────────────

  async sendMessage(content, conversationId = this.currentConversationId, sendOptions = {}) {
    if (!conversationId) {
      throw new Error('未指定会话 ID')
    }

    const hasAttachments = Array.isArray(sendOptions.attachments) && sendOptions.attachments.length > 0
    // 纯文本消息必须有内容；有附件时允许文本为空
    if (!content.trim() && !hasAttachments) {
      throw new Error('消息内容为空')
    }

    const rc = this._ensureConversationMessages(conversationId)
    rc.sendingMessage = true

    try {
      const text = content.trim()
      const result = await client.sendMessage(conversationId, text, sendOptions)
      rc.sendingMessage = false
      return result
    } catch (error) {
      console.error('[ImStore] 发送消息失败:', error)
      rc.sendingMessage = false
      throw error
    }
  },

  async sendFileMessage(conversationId, fileInfo, options = {}) {
    if (!conversationId) throw new Error('未指定会话 ID')
    return client.sendFileMessage(conversationId, fileInfo, options)
  },

  clearConversationActiveStream(conversationId) {
    const rc = this.conversationMessages[conversationId]
    if (rc) rc._activeStream = null
  },
}
