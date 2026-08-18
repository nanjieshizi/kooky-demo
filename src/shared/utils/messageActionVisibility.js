export function isBasicMessageActionRole(role) {
  return role === 'member' || role === 'peer'
}

export function hasMessageActionPayload(message = {}, content = message?.content) {
  if (String(content ?? '').trim().length > 0) return true
  const attachments = message?.attachments
  if (Array.isArray(attachments) && attachments.length > 0) return true
  const images = message?.images
  return Array.isArray(images) && images.length > 0
}
