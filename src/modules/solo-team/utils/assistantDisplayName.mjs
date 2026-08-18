export function resolveAssistantDisplayName(messageLike, assistantName = '') {
  const role = messageLike?.role
  if (role === 'user') return '我'

  const normalizedAssistantName = String(assistantName || '').trim()
  return normalizedAssistantName || 'Kooky'
}
