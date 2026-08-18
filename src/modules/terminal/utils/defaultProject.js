export const DEFAULT_PROJECT_NAME = 'kc_workspace'
export const DEFAULT_PROJECT_DIRNAME = 'kc_workspace'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeProjectPath(value) {
  const normalized = normalizeText(value).replace(/\\/g, '/')
  if (!normalized) return ''
  if (/^[A-Za-z]:\/$/.test(normalized) || normalized === '/') return normalized
  return normalized.replace(/\/+$/, '')
}

export function isDefaultProject(project) {
  if (!project || typeof project !== 'object') return false
  if (normalizeText(project.name) !== DEFAULT_PROJECT_NAME) return false

  const normalizedPath = normalizeProjectPath(project.path)
  if (!normalizedPath) return true

  const segments = normalizedPath.split('/').filter(Boolean)
  return segments[segments.length - 1] === DEFAULT_PROJECT_DIRNAME
}

