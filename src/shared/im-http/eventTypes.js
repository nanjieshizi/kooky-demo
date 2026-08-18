/**
 * HTTP IM 事件类型定义
 * 对齐新 API 的事件规范
 */

import { AppEventTypes } from '../im-client/eventTypes.js'
export { AppEventTypes }

// HTTP API 事件类型（对应 WebSocket 推送的事件）
export const HttpEventTypes = {
  // 消息事件
  MessageCreated: 'MESSAGE_CREATED',
  MessageRecall: 'MESSAGE_RECALL',
  MessageRead: 'MESSAGE_READ',

  // 成员事件
  MemberJoined: 'MEMBER_JOINED',
  MemberLeft: 'MEMBER_LEFT',
  MemberKicked: 'MEMBER_KICKED',

  // 群聊事件
  GroupCreated: 'GROUP_CREATED',
  GroupRenamed: 'GROUP_RENAMED',
  GroupDissolved: 'GROUP_DISSOLVED',

  // 私聊事件
  PrivateCreated: 'PRIVATE_CREATED',

  // 输入状态
  TypingStart: 'TYPING_START',
  TypingStop: 'TYPING_STOP',

  // 在线状态
  UserOnline: 'USER_ONLINE',
  UserOffline: 'USER_OFFLINE',

  // WebSocket 控制
  Pong: 'pong',
}

// 消息类型
export const MessageTypes = {
  Text: 'text',
  Image: 'image',
  File: 'file',
  Audio: 'audio',
  Video: 'video',
  ForwardBundle: 'forward_bundle',
  ContextInjection: 'context_injection',
  TaskEvent: 'task_event',
  RecallEvent: 'recall_event',
}

// 会话类型
export const ConversationTypes = {
  Group: 'group',
  Private: 'private',
}

// 房间类型（与 Matrix 版本保持一致）
export const ROOM_TYPES = Object.freeze({
  GROUP_CHAT: 'group_chat',
  PRIVATE_CHAT: 'private_chat',
  BOT_PERSON_CHAT: 'bot_person_chat',
  SUPER_PERSON_CHAT: 'super_person_chat',
  DIGITAL_MAN_CHAT: 'digital_man_chat',
})

export default {
  HttpEventTypes,
  AppEventTypes,
  MessageTypes,
  ConversationTypes,
  ROOM_TYPES,
}
