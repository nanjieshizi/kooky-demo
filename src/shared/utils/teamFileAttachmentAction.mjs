export function getTeamFileAttachmentUrl(file) {
  if (!file || typeof file !== 'object') return ''
  return file.httpUrl
    || file.downloadUrl
    || file.download_url
    || file.url
    || file.artifact_url
    || file.file_url
    || ''
}

export function getTeamFileAttachmentId(file) {
  if (!file || typeof file !== 'object') return ''
  return file.id ?? file.fileId ?? file.file_id ?? ''
}

export function getTeamFilePreviewType(file) {
  if (!file || typeof file !== 'object') return ''
  const explicitType = file.type ?? file.suffix ?? file.nodeType
  if (typeof explicitType === 'string' && explicitType && !explicitType.includes('/')) {
    return explicitType.toLowerCase()
  }
  const name = String(file.name || file.displayName || '')
  const i = name.lastIndexOf('.')
  if (i > 0 && i < name.length - 1) return name.slice(i + 1).toLowerCase()
  return ''
}

export function buildTeamFilePanelPreviewInfo(file, { spaceId = null, roomType = null } = {}) {
  const httpUrl = getTeamFileAttachmentUrl(file) || null
  const id = getTeamFileAttachmentId(file) || httpUrl
  return {
    id,
    name: file?.name ?? file?.displayName ?? '',
    type: getTeamFilePreviewType(file),
    mimeType: file?.mimeType ?? file?.mime_type,
    size: file?.size ?? file?.fileSize,
    httpUrl,
    spaceId: spaceId ?? null,
    roomType: roomType ?? null,
  }
}
