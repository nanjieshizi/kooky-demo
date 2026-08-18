function normalizeId(value) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : value
}

function normalizeName(value) {
  return String(value || '').trim()
}

function normalizeDescription(value) {
  return String(value || '').trim()
}

function readTeamId(item) {
  return normalizeId(item?.teamId ?? item?.team_id ?? item?.id)
}

function readCoordinatorId(item) {
  return normalizeId(
    item?.coordinatorId ??
      item?.coordinator_id ??
      item?.coordinatorAgentId ??
      item?.coordinator_agent_id,
  )
}

function readMemberIds(members) {
  if (!Array.isArray(members)) return []
  return members
    .map(member => normalizeId(member?.agent_id ?? member?.agentId))
    .filter(id => id != null)
}

function readDescription(team) {
  if (!team || typeof team !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(team, 'description')) return team.description
  if (Object.prototype.hasOwnProperty.call(team, 'teamDescription')) return team.teamDescription
  if (Object.prototype.hasOwnProperty.call(team, 'team_description')) return team.team_description
  return undefined
}

/**
 * 归一化 GET /api/v1/one-person-teams/my 单条 team
 */
export function normalizeOnePersonTeam(team) {
  const id = readTeamId(team)
  const descriptionValue = readDescription(team)

  return {
    ...team,
    id,
    teamId: id,
    name: normalizeName(team?.name),
    ...(descriptionValue !== undefined ? { description: normalizeDescription(descriptionValue) } : {}),
    coordinatorId: readCoordinatorId(team),
    memberIds: readMemberIds(team?.members),
    source: 'api',
    raw: team?.raw || team,
  }
}
