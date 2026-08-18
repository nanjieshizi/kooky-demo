export type UpdateType = 'patch' | 'minor' | 'major'

function normalizeVersion(v: string): string {
  const parts = v.split('.').map(p => parseInt(p) || 0)
  while (parts.length < 3) parts.push(0)
  return parts.slice(0, 3).join('.')
}

function parseVersion(v: string): [number, number, number] {
  const parts = normalizeVersion(v).split('.').map(Number)
  return [parts[0], parts[1], parts[2]]
}

function compareVersions(a: string, b: string): number {
  const [a0, a1, a2] = parseVersion(a)
  const [b0, b1, b2] = parseVersion(b)
  if (a0 !== b0) return a0 - b0
  if (a1 !== b1) return a1 - b1
  return a2 - b2
}

export function incrementVersion(base: string, type: UpdateType): string {
  const [major, minor, patch] = parseVersion(base)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export function generateVersion(versions: { version: string }[], type: UpdateType): string {
  if (!versions || versions.length === 0) return '1.0.0'

  const normalized = versions.map(v => normalizeVersion(v.version))
  const latest = normalized.sort((a, b) => compareVersions(b, a))[0]
  let candidate = incrementVersion(latest, type)

  // avoid conflicts with all existing versions
  const existing = new Set(normalized)
  let [major, minor, patch] = parseVersion(candidate)
  while (existing.has(`${major}.${minor}.${patch}`)) {
    patch++
    candidate = `${major}.${minor}.${patch}`
  }
  return candidate
}

export function isVersionConflict(version: string, versions: { version: string }[]): boolean {
  if (!versions || versions.length === 0) return false
  const normalized = normalizeVersion(version)
  return versions.some(v => normalizeVersion(v.version) === normalized)
}

export function isVersionTooLow(version: string, versions: { version: string }[]): boolean {
  if (!versions || versions.length === 0) return false
  const normalized = versions.map(v => normalizeVersion(v.version))
  const latest = normalized.sort((a, b) => compareVersions(b, a))[0]
  return compareVersions(normalizeVersion(version), latest) <= 0
}

export function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version.trim())
}

/**
 * 以当前框内版本为基准，在同 major/minor 下修订号从 +0 到 +5 共 6 档中随机选一，
 * 需满足：不与历史版本重复、且严格高于已有最高版本（与 isVersionTooLow 一致）。
 * 无合法候选时返回 null，由调用方回退 generateVersion。
 */
export function pickRandomVersionWithinFivePatchSteps(
  formVersion: string,
  existing: { version: string }[],
): string | null {
  const t = (formVersion || '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(t)) return null
  const [major, minor, pat] = parseVersion(t)
  const pool: string[] = []
  for (let d = 0; d <= 5; d++) {
    const cand = `${major}.${minor}.${pat + d}`
    if (isVersionConflict(cand, existing)) continue
    if (isVersionTooLow(cand, existing)) continue
    pool.push(cand)
  }
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
