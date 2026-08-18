import { ElMessage } from 'element-plus'
import {
  fetchOnePersonTeamDetail,
  fetchOnePersonTeamThreads,
  updateOnePersonTeam,
  deleteOnePersonTeam,
  fetchPrivateAgents,
} from '../service'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'
import { resolveEmployeePresence } from '../utils/employeePresence'

/**
 * 一人团队详情子模块（基于 /api/v1/one-person-teams/*）
 * - currentTeamId：当前选中团队 id
 * - teamDetailById：团队详情缓存
 * - teamThreadsById：团队 thread 列表缓存
 * - privateAgents：当前用户的有状态数字员工（用于添加数字人/选协调者）
 */

function findCachedTeam(state, teamId) {
  if (!teamId) return null
  return state.teamDetailById?.[String(teamId)] || null
}

function toMemberPayloadId(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : value
}

function buildLocalTeamMembers(memberIds = [], privateAgents = []) {
  const agentIndex = new Map()
  for (const agent of privateAgents || []) {
    if (agent?.id != null) agentIndex.set(String(agent.id), agent)
  }

  return memberIds.map((id) => {
    const key = String(id)
    const agent = agentIndex.get(key)
    return {
      agent_id: toMemberPayloadId(id),
      agentId: key,
      id: key,
      role: 'member',
      name: agent?.name || '',
      avatar_url: agent?.avatar || agent?.icon || '',
      avatar: agent?.avatar || agent?.icon || '',
      description: agent?.description || '',
      presence: resolveEmployeePresence(agent, 'idle'),
    }
  })
}

export const onePersonTeamDetailState = () => ({
  currentTeamId: null,
  teamDetailById: {},
  teamDetailLoadingById: {},
  teamThreadsById: {},
  teamThreadsLoadingById: {},
  privateAgents: [],
  privateAgentsLoading: false,
  privateAgentsLoaded: false,
})

export const onePersonTeamDetailGetters = {
  currentOnePersonTeam(state) {
    if (!state.currentTeamId) return null
    return findCachedTeam(state, state.currentTeamId)
  },
  currentOnePersonTeamThreads(state) {
    if (!state.currentTeamId) return []
    return state.teamThreadsById[String(state.currentTeamId)] || []
  },
  currentOnePersonTeamMainThread(state) {
    const list = state.currentTeamId ? (state.teamThreadsById[String(state.currentTeamId)] || []) : []
    return list.find((t) => t?.thread_type === 'one_person_main') || null
  },
}

export const onePersonTeamDetailActions = {
  setCurrentOnePersonTeamId(teamId) {
    this.currentTeamId = teamId == null ? null : String(teamId)
  },

  activateOnePersonTeamRuntime(teamId) {
    this.setCurrentOnePersonTeamId(teamId)
    this.employeeChatMode = 'one_person_runtime'
    this.currentEmployeeId = null
    this.currentEmployeeThreadId = null
    this.optTeamChatContext = null
    this.employeeQuotingMessage = null
    this.employeePendingPrefillText = null
  },

  async loadOnePersonTeamDetail(teamId, { force = false } = {}) {
    if (!teamId) return null
    const key = String(teamId)
    if (!force && this.teamDetailById[key]) return this.teamDetailById[key]
    if (this.teamDetailLoadingById[key]) return this.teamDetailById[key] || null
    this.teamDetailLoadingById = { ...this.teamDetailLoadingById, [key]: true }
    try {
      const detail = await fetchOnePersonTeamDetail(teamId)
      const previous = this.teamDetailById[key] || this.onePersonTeams.find((item) => String(item?.id) === key || String(item?.teamId) === key) || null
      const hasDescription = Object.prototype.hasOwnProperty.call(detail || {}, 'description')
      const nextDetail = hasDescription ? detail : { ...detail, description: previous?.description || '' }
      this.teamDetailById = { ...this.teamDetailById, [key]: nextDetail }
      return nextDetail
    } catch (error) {
      console.error('[SoloTeam] load one-person team detail failed:', error)
      ElMessage.error(soloTeamApiErrorMessage(error, '加载团队详情失败'))
      return null
    } finally {
      const next = { ...this.teamDetailLoadingById }
      delete next[key]
      this.teamDetailLoadingById = next
    }
  },

  async loadOnePersonTeamThreads(teamId, { force = false } = {}) {
    if (!teamId) return []
    const key = String(teamId)
    if (!force && this.teamThreadsById[key]) return this.teamThreadsById[key]
    if (this.teamThreadsLoadingById[key]) return this.teamThreadsById[key] || []
    this.teamThreadsLoadingById = { ...this.teamThreadsLoadingById, [key]: true }
    try {
      const list = await fetchOnePersonTeamThreads(teamId)
      this.teamThreadsById = { ...this.teamThreadsById, [key]: Array.isArray(list) ? list : [] }
      return this.teamThreadsById[key]
    } catch (error) {
      console.error('[SoloTeam] load one-person team threads failed:', error)
      this.teamThreadsById = { ...this.teamThreadsById, [key]: [] }
      return []
    } finally {
      const next = { ...this.teamThreadsLoadingById }
      delete next[key]
      this.teamThreadsLoadingById = next
    }
  },

  async loadPrivateAgentsForTeam({ force = false } = {}) {
    if (this.privateAgentsLoading) return this.privateAgents
    if (!force && this.privateAgentsLoaded) return this.privateAgents
    this.privateAgentsLoading = true
    try {
      const agents = await fetchPrivateAgents()
      this.privateAgents = Array.isArray(agents) ? agents : []
      this.privateAgentsLoaded = true
      return this.privateAgents
    } catch (error) {
      console.error('[SoloTeam] load private agents failed:', error)
      this.privateAgents = []
      return []
    } finally {
      this.privateAgentsLoading = false
    }
  },

  async updateCurrentOnePersonTeam(payload = {}) {
    if (!this.currentTeamId) throw new Error('当前未选中团队')
    const teamId = this.currentTeamId
    const updated = await updateOnePersonTeam(teamId, payload)
    const key = String(teamId)
    const hasMemberPatch = Array.isArray(payload.memberIds)
    const hasDescriptionPatch = Object.prototype.hasOwnProperty.call(payload, 'description')
    const localMembers = hasMemberPatch ? buildLocalTeamMembers(payload.memberIds, this.privateAgents) : null
    const patched = {
      ...(this.teamDetailById[key] || {}),
      ...updated,
      ...(hasDescriptionPatch ? { description: String(payload.description ?? '').trim() } : {}),
      ...(hasMemberPatch
        ? {
            memberIds: payload.memberIds.map(String),
            members: localMembers,
          }
        : {}),
    }
    this.teamDetailById = { ...this.teamDetailById, [key]: patched }
    if (hasMemberPatch && this.onePersonMembersByTeamId) {
      this.onePersonMembersByTeamId = {
        ...this.onePersonMembersByTeamId,
        [key]: localMembers,
      }
    }
    const idx = this.onePersonTeams.findIndex((item) => String(item.id) === String(teamId))
    if (idx !== -1) {
      const next = [...this.onePersonTeams]
      next[idx] = { ...next[idx], ...patched }
      this.onePersonTeams = next
    }
    return patched
  },

  async dissolveCurrentOnePersonTeam() {
    if (!this.currentTeamId) throw new Error('当前未选中团队')
    const teamId = this.currentTeamId
    const key = String(teamId)
    await updateOnePersonTeam(teamId, { is_collaboration_dissolved: true })
    const detail = { ...this.teamDetailById }
    delete detail[key]
    this.teamDetailById = detail
    const threads = { ...this.teamThreadsById }
    delete threads[key]
    this.teamThreadsById = threads
    this.onePersonTeams = this.onePersonTeams.filter((item) => String(item.id) !== String(teamId))
    this.onePersonTaskSidebarGroups = (this.onePersonTaskSidebarGroups || []).filter(group => String(group.teamId) !== key)
    const tasksByTeam = { ...(this.onePersonTasksByTeamId || {}) }
    delete tasksByTeam[key]
    this.onePersonTasksByTeamId = tasksByTeam
    const tasksLoaded = { ...(this.onePersonTasksLoadedByTeamId || {}) }
    delete tasksLoaded[key]
    this.onePersonTasksLoadedByTeamId = tasksLoaded
    this.onePersonTaskSidebarLoaded = false
    if (this.currentTeamId === teamId) this.currentTeamId = null
    if (typeof this.loadOnePersonTaskSidebar === 'function') {
      await this.loadOnePersonTaskSidebar({ force: true }).catch((error) => {
        console.warn('[SoloTeam] refresh task sidebar after dissolve failed:', error)
      })
    }
  },
}
