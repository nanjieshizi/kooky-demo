/**
 * IM Store 子模块 - 消息接收（群聊房）
 * 包含 _handleConversationMessageReceived、appendConversationMessageIfNew 等方法
 */

import * as roomMessagesActions from '@/shared/storeUtils/roomMessagesActions'

const config = {
  bumpTimelineFn: '_bumpGroupConversationTimelineTs',
}

export const groupMessagesActions = {
  _handleConversationMessageReceived(message) {
    return roomMessagesActions.handleConversationMessageReceived(this, message, config)
  },

  appendConversationMessageIfNew(conversationId, appMessage) {
    return roomMessagesActions.appendConversationMessageIfNew(this, conversationId, appMessage, config.bumpTimelineFn)
  },

  _onGroupMessageReceived(msg) {
    return roomMessagesActions.onConversationMessageReceived(this, msg, config)
  },

  _onGroupMessageRecalled(data) {
    return roomMessagesActions.onGroupMessageRecalled(this, data)
  },

  _onConversationReadMarkerUpdated(payload) {
    return roomMessagesActions.onConversationReadMarkerUpdated(this, payload)
  },

  _onConversationUnreadMentionDetailsUpdated(payload) {
    return roomMessagesActions.onConversationUnreadMentionDetailsUpdated(this, payload)
  },
}
