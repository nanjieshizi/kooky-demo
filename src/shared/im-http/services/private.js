/**
 * 私聊 API（兼容层）
 * 此文件保留作为兼容层，实际接口已迁移到 @/shared/services/imApi.js
 */

export {
  startPrivateChatApi as startPrivateChat,
  getPrivateChatsApi as getPrivateChats,
  closePrivateChatApi as closePrivateChat,
  reopenPrivateChatApi as reopenPrivateChat,
  getPrivateChatDetailApi as getPrivateChatDetail,
  sendPrivateMessageApi as sendPrivateMessage,
  recallPrivateMessageApi as recallPrivateMessage,
} from '@/shared/services/imApi.js'
