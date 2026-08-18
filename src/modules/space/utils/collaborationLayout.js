export function isPrivateSecondaryNav(secondaryNav) {
  return typeof secondaryNav === 'string' && secondaryNav.startsWith('private-')
}

export function isDigitalHumanSecondaryNav(secondaryNav) {
  return typeof secondaryNav === 'string' && secondaryNav.startsWith('digital-human-')
}

export function shouldShowCollaborationSecondaryPanel(groupRoomCount, privateChatCount, digitalHumanCount = 0) {
  return Number(groupRoomCount) > 0
    || Number(privateChatCount) > 0
    || Number(digitalHumanCount) > 0
}

export function isCollaborationSecondaryNavAvailable(
  secondaryNav,
  groupRoomIds = [],
  privateChats = [],
  digitalHumanAgents = [],
) {
  if (groupRoomIds.some((id) => String(id) === String(secondaryNav))) return true
  if (isDigitalHumanSecondaryNav(secondaryNav)) {
    const agentId = String(secondaryNav).slice('digital-human-'.length)
    return digitalHumanAgents.some(
      (agent) => String(agent?.agent_id ?? agent?.agentId) === agentId,
    )
  }
  if (!isPrivateSecondaryNav(secondaryNav)) return false

  const conversationId = String(secondaryNav).slice('private-'.length)
  return privateChats.some((chat) => String(chat?.conversationId) === conversationId)
}

export function shouldShowWorkspaceHeader(secondaryNav) {
  return !isPrivateSecondaryNav(secondaryNav) && !isDigitalHumanSecondaryNav(secondaryNav)
}

export function shouldShowGroupRosterSidebar(secondaryNav, hasRosterTab) {
  return (
    !isPrivateSecondaryNav(secondaryNav) &&
    !isDigitalHumanSecondaryNav(secondaryNav) &&
    !!hasRosterTab
  )
}

export function shouldCloseGroupRosterOnSpaceChange(nextSpaceId, prevSpaceId, rosterTab) {
  return !!rosterTab && !!prevSpaceId && !!nextSpaceId && String(nextSpaceId) !== String(prevSpaceId)
}
