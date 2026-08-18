/**
 * WebSocket 管理器
 * 负责 WebSocket 连接、订阅、心跳、重连
 */

import { HttpEventTypes } from '../eventTypes.js'

function normalizeWebSocketBaseUrl(wsUrl) {
  const raw = String(wsUrl || '').trim().replace(/\/$/, '')
  if (!raw) return ''
  if (raw.startsWith('wss://') || raw.startsWith('ws://')) return raw
  if (raw.startsWith('https://')) return raw.replace(/^https:\/\//, 'wss://')
  if (raw.startsWith('http://')) return raw.replace(/^http:\/\//, 'ws://')
  return `ws://${raw}`
}

function buildWebSocketUrl(wsUrl, token) {
  const normalized = normalizeWebSocketBaseUrl(wsUrl)
  if (!normalized) {
    throw new Error('[WebSocket] 缺少 WebSocket 地址')
  }

  const url = new URL(normalized)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export class WebSocketManager {
  constructor(client) {
    this._client = client
    this._ws = null
    this._reconnectTimer = null
    this._heartbeatTimer = null
    this._subscribedConversations = new Set()
    this._reconnectAttempts = 0
    this._maxReconnectAttempts = 10
    this._reconnectDelay = 3000
    this._heartbeatInterval = 30000 // 30 秒
    this._manualClose = false
  }

  /**
   * 建立 WebSocket 连接
   * @param {string} wsUrl - WebSocket 地址
   * @param {string} token - JWT Token
   */
  async connect(wsUrl, token) {
    this._manualClose = false
    return new Promise((resolve, reject) => {
      try {
        // 构建带 token 的 WebSocket URL
        const url = buildWebSocketUrl(wsUrl, token)
        console.log('[WebSocket] 正在连接:', url)

        this._ws = new WebSocket(url)

        this._ws.onopen = () => {
          console.log('[WebSocket] 连接成功')
          this._reconnectAttempts = 0
          this._startHeartbeat()
          this._resubscribeAll()
          this._client.syncAllConversations?.().catch((error) => {
            console.error('[WebSocket] 重连后同步失败:', error)
          })
          resolve()
        }

        this._ws.onmessage = (event) => {
          this._handleMessage(event)
        }

        this._ws.onclose = (event) => {
          console.log('[WebSocket] 连接关闭:', event.code, event.reason)
          this._stopHeartbeat()
          if (this._manualClose) return
          this._scheduleReconnect(wsUrl, token)
        }

        this._ws.onerror = (error) => {
          console.error('[WebSocket] 连接错误:', error)
          reject(error)
        }
      } catch (error) {
        console.error('[WebSocket] 创建连接失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    console.log('[WebSocket] 主动断开连接')
    this._manualClose = true
    this._stopHeartbeat()
    this._clearReconnectTimer()

    if (this._ws) {
      this._ws.close()
      this._ws = null
    }

    this._subscribedConversations.clear()
  }

  /**
   * 订阅会话
   * @param {number} conversationId - 会话 ID
   */
  subscribe(conversationId) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 未连接，无法订阅')
      this._subscribedConversations.add(conversationId)
      return
    }

    console.log('[WebSocket] 订阅会话:', conversationId)

    this._ws.send(JSON.stringify({
      action: 'subscribe',
      conversation_id: conversationId
    }))

    this._subscribedConversations.add(conversationId)
  }

  /**
   * 取消订阅会话
   * @param {number} conversationId - 会话 ID
   */
  unsubscribe(conversationId) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 未连接，无法取消订阅')
      return
    }

    console.log('[WebSocket] 取消订阅会话:', conversationId)

    this._ws.send(JSON.stringify({
      action: 'unsubscribe',
      conversation_id: conversationId
    }))

    this._subscribedConversations.delete(conversationId)
  }

  /**
   * 处理 WebSocket 消息
   * @private
   */
  _handleMessage(event) {
    try {
      const data = JSON.parse(event.data)

      // 处理心跳响应
      if (data.type === HttpEventTypes.Pong) {
        return
      }

      // 转发给客户端处理
      this._client._handleWebSocketEvent(data)
    } catch (error) {
      console.error('[WebSocket] 解析消息失败:', error, event.data)
    }
  }

  /**
   * 启动心跳
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat()

    this._heartbeatTimer = setInterval(() => {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ action: 'heartbeat' }))
      }
    }, this._heartbeatInterval)
  }

  /**
   * 停止心跳
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  /**
   * 调度重连
   * @private
   */
  _scheduleReconnect(wsUrl, token) {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数，停止重连')
      return
    }

    this._clearReconnectTimer()

    const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts)
    console.log(`[WebSocket] ${delay}ms 后尝试重连 (第 ${this._reconnectAttempts + 1} 次)`)

    this._reconnectTimer = setTimeout(() => {
      this._reconnectAttempts++
      this.connect(wsUrl, token).catch((error) => {
        console.error('[WebSocket] 重连失败:', error)
      })
    }, delay)
  }

  /**
   * 清除重连定时器
   * @private
   */
  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  /**
   * 重新订阅所有会话（重连后）
   * @private
   */
  _resubscribeAll() {
    if (this._subscribedConversations.size === 0) {
      return
    }

    console.log('[WebSocket] 重新订阅所有会话:', Array.from(this._subscribedConversations))

    this._subscribedConversations.forEach(conversationId => {
      this.subscribe(conversationId)
    })
  }

  /**
   * 检查连接状态
   */
  isConnected() {
    return this._ws && this._ws.readyState === WebSocket.OPEN
  }
}
