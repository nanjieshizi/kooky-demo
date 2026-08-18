function inferAttachmentType(attachment, mimeType) {
  if (attachment?.type) return attachment.type
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) return 'image'
  return 'file'
}

export function normalizeMessageAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return attachment

  const name = attachment.name ?? attachment.filename ?? attachment.file_name ?? ''
  const mimeType = attachment.mimeType ?? attachment.mime_type ?? attachment.mimetype ?? attachment.content_type ?? ''

  return {
    ...attachment,
    name,
    filename: attachment.filename ?? name,
    mimeType,
    mime_type: attachment.mime_type ?? mimeType,
    type: inferAttachmentType(attachment, mimeType),
  }
}

export function normalizeMessageAttachments(attachments) {
  return Array.isArray(attachments) && attachments.length
    ? attachments.map(normalizeMessageAttachment)
    : undefined
}
