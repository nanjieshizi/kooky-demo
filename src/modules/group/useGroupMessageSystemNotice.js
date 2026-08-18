import { computed } from 'vue'

function fallbackName(id) {
  if (!id) return '未知成员'
  const local = String(id).split(':')[0].replace('@', '')
  return local || String(id)
}

function trimDisplay(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function contentOf(message) {
  return message?.content && typeof message.content === 'object' ? message.content : {}
}

function personLabel(person) {
  const name = trimDisplay(person?.display_name) || trimDisplay(person?.name)
  return name || fallbackName(person?.id)
}

function personId(person) {
  return person?.id != null ? String(person.id) : ''
}

function personVersionId(person) {
  return person?.latest_version_id ?? person?.latestVersionId ?? person?.version_id ?? person?.versionId ?? ''
}

function buildPersonSegment(person) {
  const segment = {
    type: 'person',
    text: personLabel(person),
    id: personId(person),
  }
  if (person?.type) segment.memberType = person.type
  if (person?.agent_id) segment.agentId = person.agent_id
  if (personVersionId(person)) segment.versionId = person?.latest_version_id ?? personVersionId(person)
  return segment
}

export function useGroupMessageSystemNotice(props) {
  const inviteGroup = computed(() => {
    const message = props.message
    if (message.role !== 'system') return null

    const content = contentOf(message)

    if (message.type === 'group.created') {
      const creator = content.creator ?? message.sender
      const creatorId = personId(creator)
      const invitees = Array.isArray(content.initial_members)
        ? content.initial_members.filter((member) => {
          const memberId = personId(member)
          return memberId && memberId !== creatorId
        })
        : []

      if (invitees.length === 0) return null

      return {
        actor: creator?.id
          ? {
              id: creatorId,
              name: personLabel(creator),
              ...(creator.type ? { type: creator.type } : {}),
              ...(creator.agent_id ? { agentId: creator.agent_id } : {}),
              ...(personVersionId(creator) ? { versionId: creator.latest_version_id ?? personVersionId(creator) } : {}),
            }
          : null,
        invitees: invitees.map((member) => ({
          id: personId(member),
          name: personLabel(member),
          ...(member.type ? { type: member.type } : {}),
          ...(member.agent_id ? { agentId: member.agent_id } : {}),
          ...(personVersionId(member) ? { versionId: member.latest_version_id ?? personVersionId(member) } : {}),
        })),
      }
    }

    if (message.type !== 'member.joined') return null

    const member = content.member
    const inviter = content.inviter
    const isInvite = content.join_type === 'invited' && inviter?.id != null && member?.id != null
    if (!isInvite || String(inviter.id) === String(member.id)) return null

    return {
      actor: {
        id: personId(inviter),
        name: personLabel(inviter),
        ...(inviter.type ? { type: inviter.type } : {}),
        ...(inviter.agent_id ? { agentId: inviter.agent_id } : {}),
        ...(personVersionId(inviter) ? { versionId: inviter.latest_version_id ?? personVersionId(inviter) } : {}),
      },
      invitees: [{
        id: personId(member),
        name: personLabel(member),
        ...(member.type ? { type: member.type } : {}),
        ...(member.agent_id ? { agentId: member.agent_id } : {}),
        ...(personVersionId(member) ? { versionId: member.latest_version_id ?? personVersionId(member) } : {}),
      }],
    }
  })

  const systemNoticeSegments = computed(() => {
    const message = props.message
    if (message.role !== 'system') return []

    const type = message.type
    const content = contentOf(message)

    if (type === 'group.created') {
      // 演示场景：第二条「拉数字员工」可在 content 里设 _skipCreator 跳过「X 创建了团队」段
      if (content._skipCreator) return []
      const creator = content.creator ?? message.sender
      if (!creator?.id) return []
      return [
        buildPersonSegment(creator),
        { type: 'plain', text: ' 创建了群聊' },
      ]
    }

    if (type === 'member.joined') {
      if (inviteGroup.value) return []
      const member = content.member
      if (!member?.id) return []
      return [
        buildPersonSegment(member),
        { type: 'plain', text: ' 加入了团队' },
      ]
    }

    if (type === 'member.left') {
      const member = content.member
      if (!member?.id) return []
      return [
        buildPersonSegment(member),
        { type: 'plain', text: ' 退出了团队' },
      ]
    }

    if (type === 'member.kicked') {
      const kicker = content.kicker ?? message.sender
      const member = content.member
      if (!kicker?.id || !member?.id) return []
      return [
        buildPersonSegment(kicker),
        { type: 'plain', text: ' 将 ' },
        buildPersonSegment(member),
        { type: 'plain', text: ' 移出了团队' },
      ]
    }

    return []
  })

  return { systemNoticeSegments, inviteGroup }
}
