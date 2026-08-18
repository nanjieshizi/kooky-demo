import { computed } from 'vue'
import { useGroupStore } from '@/modules/group/store'

/**
 * 按 senderId + conversationId 从群成员 store 中查找标准成员对象
 * 查不到时返回最小兜底对象，供 UserAvatar 渲染
 *
 * @param {() => string} getSenderId
 * @param {() => string} getConversationId
 * @param {() => Object} getFallback - 兜底字段（name/avatar 等，来自消息本身）
 */
export function useSenderMember(getSenderId, getConversationId, getFallback = () => ({})) {
  const groupStore = useGroupStore()
  return computed(() => {
    const sid = typeof getSenderId === 'function' ? getSenderId() : getSenderId?.value ?? getSenderId
    const cid = typeof getConversationId === 'function' ? getConversationId() : getConversationId?.value ?? getConversationId
    const fb = (typeof getFallback === 'function' ? getFallback() : getFallback) || {}
    if (!sid) return { userId: '', ...fb, type: fb?.type || 'user' }
    const list = cid ? groupStore.conversationMembers?.[cid] ?? [] : []
    const hit = list.find((m) => {
      const candidates = [m.userId, m.participantId, m.participant_id, m.id, m.account, m.username]
      return candidates.some((c) => c !== undefined && c !== null && String(c) === String(sid))
    })
    if (hit) return hit
    return {
      userId: sid,
      displayName: fb?.name || fb?.displayName || '',
      avatarHttpUrl: fb?.avatar || fb?.avatarUrl || '',
      type: fb?.type || 'user',
    }
  })
}
