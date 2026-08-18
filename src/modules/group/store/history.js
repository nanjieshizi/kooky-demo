/**
 * IM Store 子模块 - 消息历史 & 分页（group chat）
 * 策略：replace（每次从 SDK 时间轴重算整表）
 */

import * as roomHistoryStrategy from '@/shared/storeUtils/roomHistoryStrategy'

const LOG_PREFIX = '[GroupStore]'

export const groupHistoryActions = {
  async loadHistory(conversationId) {
    return roomHistoryStrategy.loadHistory(this, conversationId, LOG_PREFIX)
  },

  async loadMoreHistory(conversationId, pageLimit, options) {
    return roomHistoryStrategy.loadMoreHistory(this, conversationId, pageLimit, options, LOG_PREFIX)
  },

  findMessageInCurrentWindow(conversationId, eventId) {
    return roomHistoryStrategy.findMessageInCurrentWindow(this, conversationId, eventId)
  },

  replaceWithContext(conversationId, ctxMessages, meta) {
    return roomHistoryStrategy.replaceWithContext(this, conversationId, ctxMessages, meta)
  },

  hasMoreForward(conversationId) {
    return roomHistoryStrategy.hasMoreForward(this, conversationId)
  },

  async paginateForward(conversationId, pageLimit) {
    return roomHistoryStrategy.paginateForward(this, conversationId, pageLimit)
  },

  async reloadLatest(conversationId) {
    return roomHistoryStrategy.reloadLatest(this, conversationId, LOG_PREFIX)
  },
}
