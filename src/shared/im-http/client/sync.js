/**
 * 增量同步功能
 * 用于断线重连后的消息补齐
 */

import { getGroupMessages } from '../services/group.js'

/**
 * 同步单个会话的增量事件
 * @param {Object} client - HttpIMClient 实例
 * @param {number} conversationId - 会话 ID
 */
export async function syncConversation(client, conversationId) {
  try {
    const lastSeq = 0

    console.log(`[HttpIMClient] 同步会话 ${conversationId} 的增量事件，last_seq: ${lastSeq}`)

    // 获取增量事件
    const events = await getGroupMessages(conversationId, {
      after_id: lastSeq,
      limit: 200
    })

    if (events.length === 0) {
      console.log(`[HttpIMClient] 会话 ${conversationId} 无新事件`)
      return
    }

    console.log(`[HttpIMClient] 会话 ${conversationId} 获取到 ${events.length} 个增量事件`)

    // 按 seq 排序
    events.sort((a, b) => a.seq - b.seq)

    // 依次处理事件
    events.forEach(event => {
      // 模拟 WebSocket 事件格式
      const wsEvent = {
        type: event.type,
        conversation_id: conversationId,
        seq: event.seq,
        ...event
      }

      client._handleWebSocketEvent(wsEvent)
    })

    console.log(`[HttpIMClient] 会话 ${conversationId} 同步完成`)
  } catch (error) {
    console.error(`[HttpIMClient] 同步会话 ${conversationId} 失败:`, error)
  }
}

/**
 * 同步所有已订阅会话的增量事件
 * @param {Object} client - HttpIMClient 实例
 */
export async function syncAllConversations(client) {
  console.log('[HttpIMClient] 无状态模式不维护会话同步游标，跳过全量补偿同步')
}
