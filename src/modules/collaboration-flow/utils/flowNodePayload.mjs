export function getNodeAttachments(node) {
  const submissions = node?.nodeResult?.submissions
  if (Array.isArray(submissions)) {
    return submissions.flatMap((submission) => {
      const attachments = submission?.attachments
      if (!Array.isArray(attachments)) return []
      return attachments
    })
  }

  return []
}

function pickString(value) {
  if (value == null) return ''
  return String(value)
}

export function normalizeExecutor(executor = {}) {
  const participantId = executor.participantId ?? null
  const username = pickString(executor.username)
  const name = pickString(executor.name)
  const avatar = pickString(executor.avatar)

  return {
    participantId,
    username,
    name,
    avatar,
    executeStatus: executor.executeStatus || '',
    completedAt: executor.completedAt || null,
    member: {
      participantId,
      username,
      name,
      avatar,
      // 我们底座的 UserAvatar 走 resolveMemberAvatarUrl，读 avatarUrl/avatarHttpUrl，不读 avatar——补上以显示真人头像
      avatarUrl: avatar,
    },
  }
}

export function getNodeVoteResult(node) {
  if (node?.nodeType !== 'vote') return null

  const options = node?.nodeConfig?.options
  const voteSummary = node?.nodeResult?.voteSummary
  if (!Array.isArray(options) || !options.length) return null

  const counts = options.map((option) => {
    const voters = voteSummary?.[option.key]
    return Array.isArray(voters) ? voters.length : 0
  })
  const maxVotes = Math.max(...counts, 0)
  const resolution = node?.nodeResult?.resolution || ''

  return {
    maxVotes,
    resolution,
    options: options.map((option, index) => {
      const count = counts[index]
      return {
        key: option.key,
        label: pickString(option.label),
        count,
        percent: maxVotes > 0 ? Math.round((count / maxVotes) * 100) : 0,
        resolved: !!resolution && option.key === resolution,
      }
    }),
  }
}
