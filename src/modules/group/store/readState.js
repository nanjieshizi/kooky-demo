import { isCollaborationNavKey } from '@/modules/navigation/config'

/**
 * 判断群会话是否处于用户可见的阅读态。
 * 选中会话不等于正在阅读：协作一级菜单隐藏时，仍应累计未读。
 */
export function isGroupConversationReadActive({ conversationId, currentConversationId, activePrimaryNav }) {
  return !!conversationId
    && String(conversationId) === String(currentConversationId)
    && isCollaborationNavKey(activePrimaryNav)
}
