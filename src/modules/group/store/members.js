/**
 * IM Store 子模块 - 成员 & 打字状态
 * 使用 shared/storeUtils/conversationMembersActions 提供的通用方法
 */

import * as conversationMembersActions from '@/shared/storeUtils/conversationMembersActions.js'

const LOG_PREFIX = '[GroupStore]'
const DEBOUNCE_DELAY = 200

export const membersActions = {
  _applyConversationMembersDiff(conversationId, incoming) {
    return conversationMembersActions.applyConversationMembersDiff(this, conversationId, incoming)
  },

  async loadConversationMembers(conversationId, options) {
    return conversationMembersActions.loadConversationMembers(this, conversationId, options, LOG_PREFIX)
  },

  async _refreshConversationMembers(conversationId) {
    return conversationMembersActions.refreshConversationMembers(this, conversationId, LOG_PREFIX)
  },

  _debouncedRefreshConversationMembers(conversationId) {
    return conversationMembersActions.debouncedRefreshConversationMembers(this, conversationId, DEBOUNCE_DELAY, LOG_PREFIX)
  },

  _applyConversationMemberTyping(payload) {
    return conversationMembersActions.applyConversationMemberTyping(this, payload)
  },

  _applyConversationTypingSnapshot(payload) {
    return conversationMembersActions.applyConversationTypingSnapshot(this, payload)
  },

  _onConversationMemberTyping(payload) {
    return conversationMembersActions.onConversationMemberTyping(this, payload)
  },

  _onConversationTypingSnapshot(payload) {
    return conversationMembersActions.onConversationTypingSnapshot(this, payload)
  },

  _onConversationMembersUpdated(conversationId) {
    return conversationMembersActions.onConversationMembersUpdated(this, conversationId, DEBOUNCE_DELAY, LOG_PREFIX)
  },
}

