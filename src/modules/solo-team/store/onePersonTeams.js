import { ElMessage } from 'element-plus'
import { fetchOnePersonTeams } from '../service'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'
import { normalizeOnePersonTeam } from '../utils/onePersonTeamList.mjs'

function readTeamKey(team) {
  const id = team?.id ?? team?.teamId ?? team?.team_id
  return id == null || id === '' ? null : String(id)
}

function normalizeTeamForList(team) {
  const normalized = normalizeOnePersonTeam(team)
  return normalized?.id ? normalized : null
}

function upsertTeam(list, team) {
  const normalized = normalizeTeamForList(team)
  const current = Array.isArray(list) ? list : []
  if (!normalized) return { list: current, team: null }

  const key = String(normalized.id)
  const index = current.findIndex((item) => readTeamKey(item) === key)
  if (index === -1) {
    return { list: [normalized, ...current], team: normalized }
  }

  const hasDescription = Object.prototype.hasOwnProperty.call(normalized, 'description')
  const next = current.slice()
  next[index] = {
    ...next[index],
    ...normalized,
    id: normalized.id,
    teamId: normalized.id,
    ...(!hasDescription ? { description: next[index]?.description || '' } : {}),
  }
  return { list: next, team: next[index] }
}

function keepTeamIfMissing(list, team) {
  const normalized = normalizeTeamForList(team)
  if (!normalized) return list
  const key = String(normalized.id)
  const index = list.findIndex((item) => readTeamKey(item) === key)
  if (index !== -1) {
    const hasDescription = Object.prototype.hasOwnProperty.call(list[index] || {}, 'description')
    if (hasDescription || !normalized.description) return list
    const next = list.slice()
    next[index] = { ...next[index], description: normalized.description }
    return next
  }
  return [normalized, ...list]
}

export const onePersonTeamsState = () => ({
  /** GET /api/v1/one-person-teams/my 归一化后的列表 */
  onePersonTeams: [],
  onePersonTeamsLoading: false,
})

export const onePersonTeamsActions = {
  upsertOnePersonTeam(team) {
    const result = upsertTeam(this.onePersonTeams, team)
    this.onePersonTeams = result.list
    return result.team
  },

  async loadOnePersonTeamsFromApi({ preserveTeam = null } = {}) {
    this.onePersonTeamsLoading = true
    try {
      const teams = await fetchOnePersonTeams()
      this.onePersonTeams = keepTeamIfMissing(teams, preserveTeam)
    } catch (error) {
      console.error('[SoloTeam] load one-person teams failed:', error)
      this.onePersonTeams = preserveTeam ? keepTeamIfMissing(this.onePersonTeams, preserveTeam) : []
      ElMessage.error(soloTeamApiErrorMessage(error, '加载团队列表失败'))
    } finally {
      this.onePersonTeamsLoading = false
    }
  },

  activateCreatedOnePersonTeam(team) {
    const optimisticTeam = this.upsertOnePersonTeam(team)
    const targetTeamId = optimisticTeam?.id ?? team?.id ?? team?.teamId ?? team?.team_id
    if (!targetTeamId) return null

    // 刚创建的团队本地已有完整 payload：先种进详情缓存，让随后 force:false 的
    // loadOnePersonTeamDetail 直接短路，避免对尚未落库的新团队 GET 详情失败弹错
    const detailKey = String(targetTeamId)
    if (optimisticTeam && !this.teamDetailById?.[detailKey]) {
      this.teamDetailById = { ...(this.teamDetailById || {}), [detailKey]: optimisticTeam }
    }

    this.activateOnePersonTeamRuntime(targetTeamId)
    void this.loadOnePersonTeamsFromApi({ preserveTeam: optimisticTeam || team }).finally(() => {
      if (String(this.currentTeamId) === String(targetTeamId)) {
        this.activateOnePersonTeamRuntime(targetTeamId)
      }
    })
    return targetTeamId
  },
}
