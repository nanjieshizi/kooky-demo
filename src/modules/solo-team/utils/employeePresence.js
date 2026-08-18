export const EMPLOYEE_PRESENCE_BUSY = 'busy'
export const EMPLOYEE_PRESENCE_IDLE = 'idle'

const BUSY_VALUES = new Set([
  EMPLOYEE_PRESENCE_BUSY,
  'working',
  'running',
  'in_progress',
  'in-progress',
  'processing',
  'executing',
  'occupied',
  '1',
  'true',
  '忙碌',
])

const IDLE_VALUES = new Set([
  EMPLOYEE_PRESENCE_IDLE,
  'free',
  'available',
  'ready',
  'standby',
  '0',
  'false',
  '空闲',
])

function normalizePresenceString(value) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeEmployeePresence(value) {
  if (value === true) return EMPLOYEE_PRESENCE_BUSY
  if (value === false) return EMPLOYEE_PRESENCE_IDLE
  if (value === 1) return EMPLOYEE_PRESENCE_BUSY
  if (value === 0) return EMPLOYEE_PRESENCE_IDLE
  const normalized = normalizePresenceString(value)
  if (!normalized) return ''
  if (BUSY_VALUES.has(normalized)) return EMPLOYEE_PRESENCE_BUSY
  if (IDLE_VALUES.has(normalized)) return EMPLOYEE_PRESENCE_IDLE
  return ''
}

export function resolveEmployeePresence(source, fallback = '') {
  const raw = source?.raw && source.raw !== source ? source.raw : {}
  const candidates = [
    source?.presence,
    source?.presence_status,
    source?.presenceStatus,
    source?.agent_status,
    source?.agentStatus,
    source?.work_status,
    source?.workStatus,
    source?.busy_status,
    source?.busyStatus,
    source?.status,
    source?.state,
    source?.is_busy,
    source?.isBusy,
    raw?.presence,
    raw?.presence_status,
    raw?.presenceStatus,
    raw?.agent_status,
    raw?.agentStatus,
    raw?.work_status,
    raw?.workStatus,
    raw?.busy_status,
    raw?.busyStatus,
    raw?.status,
    raw?.state,
    raw?.is_busy,
    raw?.isBusy,
  ]

  for (const value of candidates) {
    const normalized = normalizeEmployeePresence(value)
    if (normalized) return normalized
  }

  return normalizeEmployeePresence(fallback)
}
