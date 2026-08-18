/**
 * 成员资料解析工具（纯函数，无运行时依赖）
 * 供成员列表、资料卡等 UI 复用
 *
 * 注意：头像 URL 使用内联解析，而非 `memberAvatar.js`。
 * 因为 `memberAvatar.js` 静态导入 `@/assets/default-avatar.svg`，
 * 在 `node --test` 下会触发 ERR_MODULE_NOT_FOUND，导致本模块不可单测。
 * UI 层如需默认头像占位，请在消费侧对空字符串做兜底（复用
 * `memberAvatar.js` 的 `defaultMemberAvatar` 常量）。
 */

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return ''
}

function lowerType(member) {
  return String(member?.type || '').toLowerCase()
}

function pickAvatarUrl(member) {
  const u = member?.avatarHttpUrl ?? member?.avatarUrl ?? member?.avatar_url ?? ''
  return typeof u === 'string' && u.trim() ? u.trim() : ''
}

export function isBotMember(member) {
  return lowerType(member) === 'agent'
}

export function isSelfMember(member, currentUserId) {
  if (!member || !currentUserId) return false
  const id = pick(member, ['userId', 'participantId', 'participant_id', 'id', 'account', 'username'])
  return String(id) === String(currentUserId)
}

export function resolveMemberProfile(member, { currentUserId = '' } = {}) {
  if (!member || typeof member !== 'object') {
    return {
      userId: '',
      name: '',
      alias: '',
      avatar: '',
      title: '',
      department: '',
      isBot: false,
      isSelf: false,
    }
  }
  const userId = String(pick(member, ['userId', 'participantId', 'participant_id', 'id', 'account', 'username']) || '')
  return {
    userId,
    name: String(pick(member, ['displayName', 'name', 'nickname', 'account', 'username']) || userId || ''),
    alias: String(pick(member, ['account', 'username', 'englishName', 'alias']) || ''),
    avatar: pickAvatarUrl(member),
    title: String(pick(member, ['title', 'jobTitle', 'position']) || ''),
    department: String(pick(member, ['department', 'departmentFull', 'dept']) || ''),
    isBot: isBotMember(member),
    isSelf: isSelfMember(member, currentUserId),
  }
}

export function shouldShowChatButton({ isBot, isSelf } = {}) {
  return !isBot && !isSelf
}
