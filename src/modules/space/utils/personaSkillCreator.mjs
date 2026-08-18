export const SKILL_CREATOR_PREFILL_TEXT = '@skill-creator，跟我一起创建一个新的Skill吧。这个技能需要实现的目标是：'

export function buildPersonaSkillCreatorTarget({
  context,
  currentEmployeeId,
  currentEmployeeThreadId,
} = {}) {
  const employeeId = currentEmployeeId ? String(currentEmployeeId) : null
  const threadId = currentEmployeeThreadId ? String(currentEmployeeThreadId) : null
  const hasEmployeeThread = Boolean(employeeId && threadId)

  if (context === 'employee') {
    return {
      primaryNav: 'solo-team',
      secondaryNav: hasEmployeeThread ? `employee:${employeeId}:${threadId}` : null,
      prefillText: SKILL_CREATOR_PREFILL_TEXT,
      needsEmployeeSelection: !hasEmployeeThread,
      employeeId,
      threadId,
    }
  }

  if (context === 'collaborationEmployee') {
    return {
      primaryNav: 'collaboration',
      secondaryNav: hasEmployeeThread && employeeId ? `digital-human-${employeeId}` : null,
      prefillText: SKILL_CREATOR_PREFILL_TEXT,
      needsEmployeeSelection: !hasEmployeeThread,
      employeeId,
      threadId,
    }
  }

  return {
    primaryNav: 'deerflow',
    secondaryNav: null,
    prefillText: SKILL_CREATOR_PREFILL_TEXT,
    needsEmployeeSelection: false,
    employeeId,
    threadId,
  }
}
