import api from '@/shared/services/api'

/**
 * 统一搜索 API
 * @param {string} type - 搜索类型：all/message/knowledge/file/task/contact/conversation
 * @param {string} keyword - 搜索关键词
 * @param {object} params - 额外参数（conversation_id/team_id/kb_id/page/size）
 * @returns {Promise<{total: number, hits: Array, facets: object}>}
 */
export async function searchApi(type, keyword, params = {}) {
  const response = await api.get('/kooky-api/api/search', {
    params: { q: keyword, type, ...params }
  })
  return response
}

/**
 * 搜索消息记录
 */
export async function searchMessagesApi(keyword, options = {}) {
  const res = await searchApi('message', keyword, options)
  return {
    results: (res.hits || []).map(hit => ({
      messageId: hit.id,
      roomId: hit.conversation_id,
      roomName: hit.room_name || '未知房间',
      content: hit.content,
      snippet: hit.highlight?.content?.[0] || hit.content?.substring(0, 100) || '',
      timestamp: hit.created_at ? new Date(hit.created_at).getTime() : Date.now(),
      senderId: hit.sender_id
    })),
    total: res.total || 0
  }
}

/**
 * 搜索会话（一人团队 + 协作）
 */
export async function searchConversationsApi(keyword, options = {}) {
  const res = await searchApi('conversation', keyword, options)
  return {
    results: (res.hits || []).map(hit => ({
      id: String(hit.conversation_id || hit.id),
      roomId: String(hit.conversation_id || hit.id),
      name: hit.conversation_name || '未命名会话',
      conversationType: hit.conversation_type,
      avatarUrl: hit.avatar_url || '',
      lastActiveTime: hit.last_message_at ? new Date(hit.last_message_at).getTime() : 0,
      memberCount: hit.member_count || 0,
      agentCount: hit.agent_count || 0
    })),
    total: res.total || 0
  }
}

/**
 * 搜索知识库文档
 */
export async function searchKnowledgeApi(keyword, options = {}) {
  const res = await searchApi('knowledge', keyword, options)
  return {
    results: (res.hits || []).map(hit => ({
      type: 'knowledge',
      id: hit.id,
      title: hit.title || '未命名知识',
      content: hit.content,
      snippet: hit.content?.substring(0, 100) || '',
      kbId: hit.kb_id,
      kbName: hit.kb_name || '知识库',
      createdAt: hit.created_at ? new Date(hit.created_at).getTime() : Date.now()
    })),
    total: res.total || 0
  }
}

/**
 * 搜索任务
 */
export async function searchTasksApi(keyword, options = {}) {
  const res = await searchApi('task', keyword, options)
  return {
    results: (res.hits || []).map(hit => ({
      type: 'task',
      id: hit.id,
      title: hit.title || '未命名任务',
      description: hit.description,
      snippet: hit.title,
      status: hit.status || 'pending',
      priority: hit.priority || 'normal',
      assignee: hit.assignee_name,
      createdAt: hit.created_at ? new Date(hit.created_at).getTime() : Date.now()
    })),
    total: res.total || 0
  }
}

/**
 * 综合搜索（type=all），返回 contact + conversation 的 hits
 */
export async function searchAllApi(keyword, options = {}) {
  const res = await searchApi('all', keyword, options)
  const hits = res.hits || []
  const collaborations = hits
    .filter(hit => hit.type === 'conversation' && hit.conversation_type !== 'super_person_chat')
    .map(hit => ({
      type: 'collaboration',
      id: hit.conversation_id || hit.id,
      roomId: hit.conversation_id || hit.id,  // 保持数字类型，不转字符串
      name: hit.conversation_name || '未命名会话',
      highlightName: hit.highlight?.conversation_name?.[0] || hit.conversation_name || '未命名会话',
      conversationType: hit.conversation_type,
      avatarUrl: hit.avatar_url || '',
      lastActiveTime: hit.last_message_at ? new Date(hit.last_message_at).getTime() : 0,
      memberCount: hit.member_count || 0
    }))
  const contacts = hits
    .filter(hit => hit.type === 'contact')
    .map(hit => ({
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
  return { collaborations, contacts, total: res.total || 0 }
}

/**
 * 搜索文件
 */
export async function searchFilesApi(keyword, options = {}) {
  const res = await searchApi('file', keyword, options)
  return {
    results: (res.hits || []).map(hit => ({
      type: 'file',
      id: hit.id,
      name: hit.file_name || hit.name,
      fileType: hit.file_type || hit.suffix || 'file',
      spaceId: hit.space_id || 'unknown',
      snippet: hit.file_name,
      uploadTime: hit.created_at ? new Date(hit.created_at).getTime() : Date.now(),
      size: hit.size
    })),
    total: res.total || 0
  }
}

/**
 * 获取搜索历史（最多返回 10 条，按时间倒序）
 */
export async function getSearchHistoryApi() {
  const response = await api.get('/kooky-api/api/search/history')
  return response
}

/**
 * 写入搜索历史（自动去重，每用户最多保留 10 条）
 * @param {string} searchQuery - 搜索关键词
 */
export async function saveSearchHistoryApi(searchQuery) {
  const response = await api.post('/kooky-api/api/search/history', { search_query: searchQuery })
  return response
}

/**
 * 删除单条搜索历史
 * @param {number} historyId - 历史记录 ID
 */
export async function deleteSearchHistoryApi(historyId) {
  const response = await api.delete(`/kooky-api/api/search/history/${historyId}`)
  return response
}

/**
 * 清空所有搜索历史
 */
export async function clearSearchHistoryApi() {
  const response = await api.delete('/kooky-api/api/search/history')
  return response
}
