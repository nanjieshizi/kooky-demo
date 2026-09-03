/**
 * IM Store 子模块 - Group 会话列表管理（useGroupStore 专属）
 * 只处理 createRoomType === 'group_chat' 的会话
 */

import { client, ROOM_TYPES } from '@/shared/im-client'
import { useUIStore } from '@/modules/space/uiStore.js'
import * as roomsActions from '@/shared/storeUtils/roomsActions.js'
import { useFileStore } from '@/modules/file/store.js'
import { isGroupConversationReadActive } from './readState.js'
import { buildGroupConversationFromEvent } from '@/shared/im-http/utils/conversationListItems.mjs'

const DELETED_PROJECT_CONVERSATIONS_STORAGE_KEY = 'group-deleted-project-conversations'

function readDeletedProjectConversationIds() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DELETED_PROJECT_CONVERSATIONS_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : []
  } catch {
    return []
  }
}

function persistDeletedProjectConversationIds(ids) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DELETED_PROJECT_CONVERSATIONS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Demo 在无法使用 localStorage 时仍保持当前会话内的删除状态。
  }
}

export const groupConversationsState = () => ({
  conversations: [],
  currentConversationId: null,
  currentSpaceId: null,
  // 仅用于本地 Demo：禁止被用户删除的项目被会话刷新重新插回列表。
  deletedProjectConversationIds: readDeletedProjectConversationIds(),
  isCreatingTeam: false,
  teamIntroCompletedByConversationId: {},
  teamMemberAgentIdsByConversationId: {},
  leftConversationMentionSnapshots: {},
})

const LOG_PREFIX = '[GroupStore]'
const config = {
  conversationType: ROOM_TYPES.GROUP_CHAT,
  logPrefix: LOG_PREFIX,
  onLoadConversationsFilter(filteredConversations) {
    const deletedProjectIds = new Set(this.deletedProjectConversationIds || [])
    return filteredConversations.filter((item) => !deletedProjectIds.has(String(item.conversationId)))
  },
}

export const groupConversationsActions = {
  _loadConversations(pendingConversationId) {
    return roomsActions.loadConversations(this, pendingConversationId, config)
  },

  async selectConversation(conversationId) {
    return roomsActions.selectConversation(this, conversationId, LOG_PREFIX)
  },

  async createGroupRoom(name, accounts = [], botIds = [], options = {}) {
    const result = await client.createGroupRoom(name, accounts, botIds, options)
    const targetConversationId = result?.conversationId
    if (!targetConversationId) return result

    const stub = buildGroupConversationFromEvent({
      conversation_id: targetConversationId,
      conv_name: result?.name || name,
      created_at: Date.now(),
      content: { conv_name: result?.name || name },
    })
    if (stub) roomsActions.upsertConversation(this, stub)

    this.loadConversationMembers(targetConversationId, { force: true })
    this.setCurrentSpaceId(targetConversationId)
    const uiStore = useUIStore()
    const collaborationNavKey = uiStore.activePrimaryNav === 'collaboration-b'
      ? 'collaboration-b'
      : 'collaboration'
    uiStore.setActiveNavigation(collaborationNavKey, targetConversationId)
    uiStore.expandSidebar()
    useFileStore().invalidateCloudNode('category_team')

    return result
  },

  async changeRoomMembers(name, conversationId, accounts, botIds = []) {
    return client.changeRoomMembers(name, conversationId, accounts, botIds)
  },

  async inviteMembers(conversationId, payload = {}) {
    return client.inviteMembers(conversationId, payload)
  },

  async removeMembers(conversationId, payload = {}) {
    return client.removeMembers(conversationId, payload)
  },

  async renameGroup(conversationId, name) {
    return client.renameGroup(conversationId, name)
  },

  async dissolveGroup(conversationId) {
    return client.dissolveGroup(conversationId)
  },

  async leaveConversation(conversationId) {
    return client.leaveRoom(conversationId)
  },

  _sortConversationsByLatestTimeline() {
    return roomsActions.sortConversationsByLatestTimeline(this)
  },

  _bumpConversationTimelineTs(conversationId, ts) {
    return roomsActions.bumpConversationTimelineTs(this, conversationId, ts)
  },

  _syncActiveSpaceWithConversations(pendingConversationId) {
    return roomsActions.syncActiveSpaceWithConversations(this, pendingConversationId)
  },

  updateTeamMembers(conversationId, memberAgentIds) {
    return roomsActions.updateTeamMembers(this, conversationId, memberAgentIds)
  },

  completeTeamIntro(conversationId) {
    return roomsActions.completeTeamIntro(this, conversationId)
  },

  setCurrentSpaceId(id) {
    return roomsActions.setCurrentSpaceId(this, id)
  },

  markProjectDeleted(conversationId) {
    const id = String(conversationId || '')
    if (!id || this.deletedProjectConversationIds.includes(id)) return
    this.deletedProjectConversationIds.push(id)
    persistDeletedProjectConversationIds(this.deletedProjectConversationIds)
  },

  startCreatingTeam() {
    return roomsActions.startCreatingTeam(this)
  },

  cancelCreatingTeam() {
    return roomsActions.cancelCreatingTeam(this)
  },

  resetChatNavigation() {
    return roomsActions.resetChatNavigation(this)
  },

  _onConversationLeft(payload) {
    return roomsActions.onConversationLeft(this, payload, LOG_PREFIX)
  },

  _onConversationInvite(payload) {
    return roomsActions.onConversationInvite(this, payload, LOG_PREFIX)
  },

  _onPostConnect() {
    return roomsActions.onPostConnect(this, config)
  },

  _onConversationsUpdated(rooms) {
    const event = rooms?.event || rooms?.raw || null
    const conversationId = rooms?.conversationId ?? event?.conversation_id
    const name = rooms?.name || event?.content?.new_name || event?.content?.conv_name || event?.conv_name
    if (rooms?.action === 'upsert') {
      const nextConversation = rooms.conversation || buildGroupConversationFromEvent(event)
      if (nextConversation) {
        if (this.deletedProjectConversationIds.includes(String(nextConversation.conversationId))) return
        roomsActions.upsertConversation(this, nextConversation)
        return
      }
    }
    if (rooms?.action === 'rename' && conversationId && name) {
      roomsActions.updateConversationName(this, conversationId, name)
      return
    }
    if (rooms?.action === 'members_changed' && conversationId) {
      roomsActions.updateConversationMemberCount(this, conversationId, {
        memberCount: rooms.memberCount,
        memberDelta: rooms.memberDelta,
      })
      return this._loadConversations(conversationId)
    }
    return roomsActions.onConversationsUpdated(this, rooms, config)
  },

  // 覆盖 _bumpConversationTimelineTs 方法名（保持向后兼容）
  _bumpGroupConversationTimelineTs(conversationId, ts) {
    return this._bumpConversationTimelineTs(conversationId, ts)
  },

  // 新群创建事件：仅维护本地列表，不主动切换 tab。
  // 自己创建场景在 createGroupRoom 中接口成功后处理；此处兜底其他端 / 被拉入场景。
  async _onConversationCreated({ conversationId, event, conversation }) {
    const nextConversation = conversation || buildGroupConversationFromEvent(event)
    if (nextConversation) {
      if (this.deletedProjectConversationIds.includes(String(nextConversation.conversationId))) return
      roomsActions.upsertConversation(this, nextConversation)
    } else if (conversationId) {
      await this._loadConversations()
    }
  },

  /** 未读计数可能变化，更新对应 conversationMessages 条目 */
  _onUnreadUpdated({ conversationId }) {
    if (!conversationId) return
    if (isGroupConversationReadActive({
      conversationId,
      currentConversationId: this.currentConversationId,
      activePrimaryNav: useUIStore().activePrimaryNav,
    })) return
    const conversation = this.conversations.find((item) => String(item.conversationId) === String(conversationId))
    if (!conversation) return
    const rc = this._ensureConversationMessages?.(conversationId)
    if (!rc) return
    const { unreadCount, hasMention } = client.getRoomUnreadCounts(conversationId)
    rc.unreadCount = unreadCount
    rc.hasUnreadDot = unreadCount > 0
    rc.hasMentionDot = unreadCount > 0 && hasMention
  },

  /** 断开连接后清理 group 会话状态（保留 currentSpaceId，保持用户上次选择） */
  _onDisconnectCleanup() {
    this.conversations = []
    this.currentConversationId = null
    this.resetChatNavigation()
  },

  /** reset() 后清理 group 会话状态 */
  _onResetCleanup() {
    this.conversations = []
    this.currentConversationId = null
  },
}
