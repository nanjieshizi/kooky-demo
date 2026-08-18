import { searchMessagesApi, searchConversationsApi, searchKnowledgeApi, searchTasksApi, searchFilesApi, searchApi } from './service'

export function useGlobalSearch() {
  async function searchSoloTeams(keyword) {
    if (!keyword) return []
    try {
      const result = await searchConversationsApi(keyword)
      return result.results
        .filter(item => item.conversationType === 'super_person_chat')
        .map(item => ({
          type: 'solo-team',
          id: item.roomId,
          name: item.name,
          roomId: item.roomId,
          lastActiveTime: item.lastActiveTime
        }))
    } catch (error) {
      console.error('搜索一人团队失败:', error)
      return []
    }
  }

  async function searchCollaborations(keyword, { page = 1, size = 20 } = {}) {
    if (!keyword) return { items: [], hasMore: false }
    try {
      const res = await searchApi('conversation', keyword, { page, size })
      const hits = res.hits || []
      const items = hits
        .filter(hit => hit.conversation_type !== 'super_person_chat')
        .map(hit => ({
          type: 'collaboration',
          id: hit.conversation_id || hit.id,
          roomId: hit.conversation_id || hit.id,
          name: hit.conversation_name || '未命名会话',
          highlightName: hit.highlight?.conversation_name?.[0] || hit.conversation_name || '未命名会话',
          conversationType: hit.conversation_type,
          avatarUrl: hit.avatar_url || '',
          lastActiveTime: hit.last_message_at ? new Date(hit.last_message_at).getTime() : 0,
          memberCount: hit.member_count || 0
        }))
      // 用原始返回条数判断是否还有下一页（因为本端会过滤掉 super_person_chat）
      return { items, hasMore: hits.length >= size }
    } catch (error) {
      console.error('搜索协作失败:', error)
      return { items: [], hasMore: false }
    }
  }

  async function searchFiles(keyword) {
    if (!keyword) return []
    try {
      const result = await searchFilesApi(keyword)
      return result.results
    } catch (error) {
      console.error('搜索文件失败:', error)
      return []
    }
  }

  async function searchContacts(keyword, { page = 1, size = 20 } = {}) {
    if (!keyword) return { items: [], hasMore: false }
    try {
      const res = await searchApi('contact', keyword, { page, size })
      const hits = res.hits || []
      const items = hits.map(hit => ({
        type: 'contact',
        id: hit.id,
        userId: hit.id,
        // 数字人优先用 agent_id；对真人而言为空
        agentId: hit.agent_id || '',
        name: hit.name,
        avatar: hit.logo || '',
        tag: hit.tag,
        participantType: hit.participant_type,
        department: hit.department || '',
        position: hit.position || '',
        staffStatus: hit.staff_status,
        source: 'unified'
      }))
      return { items, hasMore: hits.length >= size }
    } catch (error) {
      console.error('搜索联系人失败:', error)
      return { items: [], hasMore: false }
    }
  }

  async function searchMessages(keyword) {
    if (!keyword) return []
    try {
      const result = await searchMessagesApi(keyword)
      return (result.results || []).map(msg => ({
        type: 'message',
        id: msg.messageId,
        messageId: msg.messageId,
        roomId: msg.roomId,
        roomName: msg.roomName,
        content: msg.content,
        snippet: msg.snippet,
        timestamp: msg.timestamp,
        senderId: msg.senderId
      }))
    } catch (error) {
      console.error('搜索消息失败:', error)
      return []
    }
  }

  async function searchKnowledge(keyword) {
    if (!keyword) return []
    try {
      const result = await searchKnowledgeApi(keyword)
      return result.results
    } catch (error) {
      console.error('搜索知识库失败:', error)
      return []
    }
  }

  async function searchTasks(keyword) {
    if (!keyword) return []
    try {
      const result = await searchTasksApi(keyword)
      return result.results
    } catch (error) {
      console.error('搜索任务失败:', error)
      return []
    }
  }

  return {
    searchSoloTeams,
    searchCollaborations,
    searchFiles,
    searchContacts,
    searchMessages,
    searchKnowledge,
    searchTasks
  }
}
