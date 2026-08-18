export function getGroupMemberKey(member) {
  if (!member || typeof member !== 'object') return ''
  const type = String(member.type || '').toLowerCase() === 'agent' ? 'agent' : 'user'
  const rawId =
    member.participantId ??
    member.participant_id ??
    member.userId ??
    member.id ??
    member.account ??
    member.username
  return rawId === undefined || rawId === null || rawId === '' ? '' : `${type}:${rawId}`
}

export function splitGroupMembers(members = []) {
  const humans = []
  const bots = []

  for (const member of Array.isArray(members) ? members : []) {
    if (String(member?.type || '').toLowerCase() === 'agent') {
      bots.push(member)
    } else if (String(member?.type || '').toLowerCase() !== 'system') {
      humans.push(member)
    }
  }

  humans.sort((a, b) => Number(!!b.isOwner) - Number(!!a.isOwner))
  return { humans, bots }
}

export function isCurrentUserGroupOwner(members = [], userInfo = {}) {
  const currentUserId = userInfo?.userId || ''
  const currentUserName = userInfo?.userName || ''
  if (!currentUserId && !currentUserName) return false

  return (Array.isArray(members) ? members : []).some((member) => {
    if (!member?.isOwner && member?.role !== 'owner') return false
    const identities = [
      member.username,
      member.account,
      member.userId,
      member.participantId,
      member.participant_id,
    ].filter((value) => value !== undefined && value !== null && value !== '').map(String)
    return identities.includes(String(currentUserId)) || identities.includes(String(currentUserName))
  })
}

function uniqueFilled(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue
    const key = String(value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function buildGroupSavePayload({ name = '', humans = [], bots = [] } = {}) {
  return {
    name: String(name || '').trim(),
    accounts: uniqueFilled(
      humans.map((member) => member.account ?? member.username),
    ),
    botIds: uniqueFilled(
      bots.map((member) =>
        member.imBotId ??
        member.participantId ??
        member.participant_id ??
        member.userId,
      ),
    ),
  }
}
