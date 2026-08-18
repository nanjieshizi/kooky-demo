import { defineStore } from 'pinia'

export const DEFAULT_STEWARD_ID = 'team-assistant'

const LEGACY_STEWARD_ALIASES = Object.freeze({
  pmo: 'agent-1007',
})

const KNOWN_STEWARDS = Object.freeze({
  [DEFAULT_STEWARD_ID]: Object.freeze({
    id: DEFAULT_STEWARD_ID,
    userId: DEFAULT_STEWARD_ID,
    name: '团队助手',
    presentationKey: 'team-assistant',
  }),
  'agent-1007': Object.freeze({
    id: 'agent-1007',
    userId: 'agent-1007',
    name: 'PMO 数字人',
    presentationKey: 'pmo',
  }),
})

function keyOf(conversationId) {
  return conversationId == null ? '' : String(conversationId)
}

function normalizeStewardId(stewardId) {
  const id = String(stewardId || '')
  return LEGACY_STEWARD_ALIASES[id] || id
}

function memberUserId(member) {
  return String(member?.userId || member?.participantId || member?.participant_id || '')
}

function isDigitalHumanMember(member) {
  const userId = memberUserId(member)
  const type = String(member?.type || member?.memberType || member?.participantType || '').toLowerCase()
  return type === 'agent' || userId.startsWith('agent-')
}

/**
 * 只把当前群的真实数字人成员暴露为候选；团队助手是每群内置的保底执行者。
 * 返回统一的 userId 作为选中值，以便未来容纳多个 PMO/第三方数字人。
 */
export function collaborationBStewardCandidates(members = []) {
  const candidates = [{ ...KNOWN_STEWARDS[DEFAULT_STEWARD_ID] }]
  const seen = new Set([DEFAULT_STEWARD_ID])

  for (const member of Array.isArray(members) ? members : []) {
    const userId = normalizeStewardId(memberUserId(member))
    if (!userId || seen.has(userId) || !isDigitalHumanMember(member)) continue
    seen.add(userId)
    const known = KNOWN_STEWARDS[userId] || {}
    candidates.push({
      ...known,
      id: userId,
      userId,
      name: String(member?.displayName || member?.name || known.name || '数字人'),
      avatar: member?.avatarUrl || member?.avatarHttpUrl || member?.avatar || '',
      presentationKey: known.presentationKey || 'digital-human',
    })
  }
  return candidates
}

export function resolveCollaborationBSteward(stewardId, members = []) {
  const id = normalizeStewardId(stewardId)
  return collaborationBStewardCandidates(members).find((candidate) => candidate.id === id)
    || { ...KNOWN_STEWARDS[DEFAULT_STEWARD_ID] }
}

export const useCollaborationBStewardStore = defineStore('collaborationBSteward', {
  state: () => ({
    stewardByConversation: {},
  }),

  getters: {
    stewardForGroup: (state) => (conversationId) => (
      normalizeStewardId(state.stewardByConversation[keyOf(conversationId)]) || DEFAULT_STEWARD_ID
    ),
  },

  actions: {
    setSteward(conversationId, stewardId, availableIds = []) {
      const key = keyOf(conversationId)
      const id = normalizeStewardId(stewardId)
      const allowed = new Set((availableIds || []).map(normalizeStewardId))
      if (!key || !id || (allowed.size && !allowed.has(id))) return false
      this.stewardByConversation[key] = id
      return true
    },

    ensureValidSteward(conversationId, availableIds = []) {
      const key = keyOf(conversationId)
      if (!key) return DEFAULT_STEWARD_ID
      const allowed = new Set([DEFAULT_STEWARD_ID, ...(availableIds || []).map(normalizeStewardId)])
      const current = this.stewardForGroup(conversationId)
      if (allowed.has(current)) return current
      this.stewardByConversation[key] = DEFAULT_STEWARD_ID
      return DEFAULT_STEWARD_ID
    },
  },
})
