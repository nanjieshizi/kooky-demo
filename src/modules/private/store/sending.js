/**
 * IM Store 子模块 - 私聊消息发送
 *
 * 负责：
 * - 发送文本消息
 * - 发送文件消息
 * - 撤回消息
 */

import { httpIMClient as client } from '../../../shared/im-http/httpClient.js'

const LOG_PREFIX = '[PrivateStore:sending]'

function normalizeReplyToId(replyToId) {
  return replyToId || null
}

/**
 * 根据 MIME 类型判断附件类型
 * @param {string} mimeType
 * @returns {string}
 */
function getAttachmentType(mimeType) {
  if (!mimeType) return 'file'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export const privateSendingActions = {
  /**
   * 发送文本消息
   * @param {number} conversationId
   * @param {string} content
   * @param {object} options - { replyToId?: string|number, mentions?: Array, attachments?: Array }
   * @returns {Promise<object>}
   */
  async sendTextMessage(conversationId, content, options = {}) {
    const hasAttachments = Array.isArray(options.attachments) && options.attachments.length > 0

    // 纯文本消息必须有内容；有附件时允许文本为空
    if (!conversationId || (!content?.trim() && !hasAttachments)) {
      throw new Error(`${LOG_PREFIX} conversationId 和 content 不能为空`)
    }

    const chatState = this._ensureChatMessages(conversationId)
    chatState.sendingMessage = true

    try {
      // 构建请求数据
      const data = {
        body: content?.trim() || '',
      }

      if (hasAttachments) {
        data.attachments = options.attachments
      }

      const replyToId = normalizeReplyToId(options.replyToId)
      if (replyToId) {
        data.reply_to_id = replyToId
      }

      if (options.mentions?.length) {
        data.mentions = options.mentions
      }

      // 调用后端 API 发送消息
      const result = await client.sendPrivateMessage(conversationId, data)

      console.log(`${LOG_PREFIX} 发送消息成功:`, result)

      return result
    } catch (error) {
      console.error(`${LOG_PREFIX} 发送消息失败:`, error)
      throw error
    } finally {
      chatState.sendingMessage = false
    }
  },

  /**
   * 发送文件消息
   * @param {number} conversationId
   * @param {object} fileInfo - { url, name, size, mimeType }
   * @param {object} options - { body?: string, replyToId?: string|number }
   * @returns {Promise<object>}
   */
  async sendFileMessage(conversationId, fileInfo, options = {}) {
    if (!conversationId || !fileInfo?.url) {
      throw new Error(`${LOG_PREFIX} conversationId 和 fileInfo.url 不能为空`)
    }

    const chatState = this._ensureChatMessages(conversationId)
    chatState.sendingMessage = true

    try {
      // 构建附件数据
      const attachment = {
        id: `att_${Date.now()}`,
        type: getAttachmentType(fileInfo.mimeType),
        url: fileInfo.url,
        size: fileInfo.size,
        filename: fileInfo.name,
        mime_type: fileInfo.mimeType,
      }

      // 构建请求数据
      const data = {
        body: typeof options.body === 'string' ? options.body.trim() : '',
        attachments: [attachment],
      }

      const replyToId = normalizeReplyToId(options.replyToId)
      if (replyToId) {
        data.reply_to_id = replyToId
      }

      // 调用后端 API 发送消息
      const result = await client.sendPrivateMessage(conversationId, data)

      console.log(`${LOG_PREFIX} 发送文件消息成功:`, result)

      return result
    } catch (error) {
      console.error(`${LOG_PREFIX} 发送文件消息失败:`, error)
      throw error
    } finally {
      chatState.sendingMessage = false
    }
  },

  /**
   * 撤回消息
   * @param {number} conversationId
   * @param {string} eventId - 消息 ID（带或不带 $ 前缀）
   * @returns {Promise<object>}
   */
  async recallMessage(conversationId, eventId) {
    if (!conversationId || !eventId) {
      throw new Error(`${LOG_PREFIX} conversationId 和 eventId 不能为空`)
    }

    try {
      // 移除 $ 前缀
      const rawEventId = String(eventId).replace(/^\$/, '')

      // 调用后端 API 撤回消息
      const result = await client.recallPrivateMessage(conversationId, rawEventId)

      console.log(`${LOG_PREFIX} 撤回消息成功:`, result)

      // 撤回事件会通过 WebSocket 推送回来，在 _handleMessageRecalled 中处理

      return result
    } catch (error) {
      console.error(`${LOG_PREFIX} 撤回消息失败:`, error)
      throw error
    }
  },
}

export { getAttachmentType }
