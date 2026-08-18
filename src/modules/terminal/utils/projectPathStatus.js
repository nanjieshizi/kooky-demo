export const PROJECT_PATH_STATUS = {
  VALID: 'valid',
  INVALID: 'invalid',
}

export const PROJECT_PATH_STATUS_REASON = {
  MISSING: 'missing',
  NOT_DIRECTORY: 'not-directory',
  NO_ACCESS: 'no-access',
  UNKNOWN: 'unknown',
}

const KNOWN_PROJECT_PATH_REASONS = new Set([
  PROJECT_PATH_STATUS_REASON.MISSING,
  PROJECT_PATH_STATUS_REASON.NOT_DIRECTORY,
  PROJECT_PATH_STATUS_REASON.NO_ACCESS,
  PROJECT_PATH_STATUS_REASON.UNKNOWN,
])

export function normalizeProjectPathReason(reason) {
  if (typeof reason !== 'string' || !reason.trim()) {
    return PROJECT_PATH_STATUS_REASON.UNKNOWN
  }

  const normalized = reason.trim()
  return KNOWN_PROJECT_PATH_REASONS.has(normalized)
    ? normalized
    : PROJECT_PATH_STATUS_REASON.UNKNOWN
}

export function normalizeProjectSnapshot(project = {}) {
  const workbenchIds = Array.isArray(project.workbenchIds)
    ? project.workbenchIds
    : (Array.isArray(project.workspaceIds) ? project.workspaceIds : [])
  const activeWorkbenchId = project.activeWorkbenchId ?? project.activeWorkspaceId ?? null
  const pathStatus = project.pathStatus === PROJECT_PATH_STATUS.INVALID
    ? PROJECT_PATH_STATUS.INVALID
    : PROJECT_PATH_STATUS.VALID

  return {
    ...project,
    workbenchIds,
    activeWorkbenchId,
    pathStatus,
    pathStatusReason: pathStatus === PROJECT_PATH_STATUS.INVALID
      ? normalizeProjectPathReason(project.pathStatusReason)
      : '',
    lastPathCheckAt: typeof project.lastPathCheckAt === 'number' ? project.lastPathCheckAt : 0,
  }
}

export function mapValidationResultToProjectState(result) {
  if (result?.ok) {
    return {
      pathStatus: PROJECT_PATH_STATUS.VALID,
      pathStatusReason: '',
      readonly: false,
    }
  }

  return {
    pathStatus: PROJECT_PATH_STATUS.INVALID,
    pathStatusReason: normalizeProjectPathReason(result?.reason),
    readonly: true,
  }
}

export function resolveProjectTerminalCwd(project, fallbackCwd = '') {
  if (!project) {
    return ''
  }

  if (project?.pathStatus === PROJECT_PATH_STATUS.INVALID) {
    return ''
  }

  if (typeof project?.path === 'string' && project.path.trim()) {
    return project.path.trim()
  }

  if (typeof fallbackCwd === 'string' && fallbackCwd.trim()) {
    return fallbackCwd.trim()
  }

  return ''
}
