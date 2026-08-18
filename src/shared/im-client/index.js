/**
 * IM 客户端中转层
 *
 * 当前主链路固定使用 httpIMClient（HTTP + WebSocket）。
 * Matrix 实现文件暂时保留，但不再参与运行时选择。
 *
 * 用法：
 *   import { client, AppEventTypes, ROOM_TYPES } from '@/shared/im-client'
 */

import { httpIMClient, MessageTypes as HttpMessageTypes, ROOM_TYPES as HttpRoomTypes } from '@/shared/im-http'
import { AppEventTypes } from './eventTypes.js'

export const client = httpIMClient

export const MessageTypes = HttpMessageTypes
export const ROOM_TYPES = HttpRoomTypes
export { AppEventTypes }
