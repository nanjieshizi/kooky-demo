// 应用层 IM 事件名契约。Matrix / HTTP-WS 实现对外都必须 emit 这一套事件。
export const AppEventTypes = Object.freeze({
  // 连接状态
  Connected: 'connected',
  Disconnected: 'disconnected',
  ConnectError: 'connect_error',

  // 同步状态
  Sync: 'sync',
  SyncPrepared: 'sync_prepared',
  SyncStopped: 'sync_stopped',

  // 房间事件
  RoomsUpdated: 'rooms_updated',
  RoomCreated: 'room_created',
  RoomLeft: 'room_left',
  RoomInvite: 'room_invite',

  // 消息事件
  MessageReceived: 'message_received',

  // 已读标记更新
  ReadMarkerUpdated: 'read_marker_updated',

  // 未读数变化
  UnreadUpdated: 'unread_updated',

  // 未读数据初始化完成
  UnreadInitialized: 'unread_initialized',

  // @我 未读明细已更新
  UnreadMentionDetailsUpdated: 'unread_mention_details_updated',

  // 群聊消息到达
  GroupMessageReceived: 'group_message_received',

  // 群聊消息撤回
  GroupMessageRecalled: 'group_message_recalled',

  // solo-team 消息到达
  SoloTeamMessageReceived: 'solo_team_message_received',

  // 房间成员 typing
  RoomMemberTyping: 'room_member_typing',

  // 房间成员变化
  RoomMembersUpdated: 'room_members_updated',

  // solo-team agent 状态变化
  SoloTeamAgentStatusChanged: 'solo_team_agent_status_changed',

  // typing 快照
  RoomTypingSnapshot: 'room_typing_snapshot',

  // ═══════════════════════════════════════════════
  // 私聊专属事件（与群聊事件完全独立）
  // ═══════════════════════════════════════════════

  // 私聊列表更新
  PrivateChatsUpdated: 'private_chats_updated',

  // 私聊创建（新开始的私聊）
  PrivateChatCreated: 'private_chat_created',

  // 私聊删除（本地删除）
  PrivateChatDeleted: 'private_chat_deleted',

  // 私聊消息到达
  PrivateMessageReceived: 'private_message_received',

  // 私聊消息撤回
  PrivateMessageRecalled: 'private_message_recalled',

  // 私聊消息发送成功
  PrivateMessageSent: 'private_message_sent',

  // 私聊消息发送失败
  PrivateMessageSendFailed: 'private_message_send_failed',

  // 私聊对方正在输入
  PrivateChatTyping: 'private_chat_typing',
})
