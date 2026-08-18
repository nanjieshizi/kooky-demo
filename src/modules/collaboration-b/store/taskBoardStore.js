import { defineStore } from 'pinia'

function keyOf(conversationId) {
  return conversationId == null ? '' : String(conversationId)
}

export const useCollaborationBTaskBoardStore = defineStore('collaborationBTaskBoard', {
  state: () => ({
    createdItemsByConversation: {},
    matterStateByConversation: {},
    linkedWorkflowTaskByConversation: {},
  }),

  getters: {
    createdItemsForGroup: (state) => (conversationId) => (
      state.createdItemsByConversation[keyOf(conversationId)] || []
    ),
    matterStateForGroup: (state) => (conversationId, matterId) => (
      state.matterStateByConversation[keyOf(conversationId)]?.[String(matterId)] || null
    ),
    effectiveStatusForGroup: (state) => (conversationId, matterId, fallback = 'in_progress') => (
      state.matterStateByConversation[keyOf(conversationId)]?.[String(matterId)]?.status || fallback
    ),
    linkedWorkflowTaskIdForMatter: (state) => (conversationId, matterId) => (
      state.linkedWorkflowTaskByConversation[keyOf(conversationId)]?.[String(matterId)] || ''
    ),
  },

  actions: {
    addCreatedItem(conversationId, item = {}) {
      const key = keyOf(conversationId)
      if (!key) return null
      const record = {
        ...item,
        id: String(item.id || `matter-local-${Date.now()}`),
        conversationId: key,
      }
      this.createdItemsByConversation[key] = [
        record,
        ...(this.createdItemsByConversation[key] || []),
      ]
      return record
    },

    linkWorkflowTask(conversationId, matterId, taskId) {
      const key = keyOf(conversationId)
      const id = matterId == null ? '' : String(matterId)
      const workflowTaskId = taskId == null ? '' : String(taskId)
      if (!key || !id || !workflowTaskId) return false
      this.linkedWorkflowTaskByConversation[key] = {
        ...(this.linkedWorkflowTaskByConversation[key] || {}),
        [id]: workflowTaskId,
      }
      return true
    },

    clearLinkedWorkflowTask(conversationId, matterId) {
      const key = keyOf(conversationId)
      const id = matterId == null ? '' : String(matterId)
      const groupLinks = this.linkedWorkflowTaskByConversation[key]
      if (!key || !id || !groupLinks?.[id]) return false
      const next = { ...groupLinks }
      delete next[id]
      this.linkedWorkflowTaskByConversation[key] = next
      return true
    },

    setMatterStatus(conversationId, matterId, status) {
      const key = keyOf(conversationId)
      const id = matterId == null ? '' : String(matterId)
      if (!key || !id || !['in_progress', 'done', 'archived'].includes(status)) return false
      const groupState = this.matterStateByConversation[key] || {}
      const previous = groupState[id] || {}
      this.matterStateByConversation[key] = {
        ...groupState,
        [id]: {
          ...previous,
          status,
          updatedAt: Date.now(),
        },
      }
      return true
    },

    archiveMatter(conversationId, matterId, currentStatus = 'in_progress') {
      const key = keyOf(conversationId)
      const id = matterId == null ? '' : String(matterId)
      if (!key || !id) return false
      const groupState = this.matterStateByConversation[key] || {}
      const previous = groupState[id] || {}
      this.matterStateByConversation[key] = {
        ...groupState,
        [id]: {
          ...previous,
          status: 'archived',
          archivedFrom: currentStatus === 'done' ? 'done' : 'in_progress',
          updatedAt: Date.now(),
        },
      }
      return true
    },

    restoreMatter(conversationId, matterId, fallbackStatus = 'in_progress') {
      const key = keyOf(conversationId)
      const id = matterId == null ? '' : String(matterId)
      const groupState = this.matterStateByConversation[key] || {}
      const previous = groupState[id]
      if (!key || !id || (previous && previous.status !== 'archived')) return false
      this.matterStateByConversation[key] = {
        ...groupState,
        [id]: {
          ...previous,
          status: previous?.archivedFrom === 'done' || fallbackStatus === 'done'
            ? 'done'
            : 'in_progress',
          updatedAt: Date.now(),
        },
      }
      return true
    },
  },
})
