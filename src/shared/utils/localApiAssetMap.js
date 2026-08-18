/**
 * 后端/本地配置可能返回「开发期源码路径」（如 /super-assistant/src/assets/...），
 * 打包后该路径不存在，不可直接作为 img src。此处将已知路径映射为 import 后的构建 URL。
 *
 * 新增映射：settings 在 BUNDLED_SETTINGS_ASSETS 增加文件名与 import；一人团队头像在 assets/soloTeam/ava/ 下放 @2x.png，由 glob 自动注册。
 */

import bundled1 from '@/assets/settings/1.png'
import bundled2 from '@/assets/settings/2.png'
import bundled3 from '@/assets/settings/3.png'
import bundledKookyLogo from '@/assets/settings/kooky.png'
import bundledOpenai from '@/assets/settings/openai.png'
import bundledQianwen from '@/assets/settings/qianwen.png'
import bundledDeepseek from '@/assets/settings/deepseek.png'
import bundledAnthropic from '@/assets/settings/anthropic.png'

/** settings 目录下、可被后端用「源码路径」指代的文件名 → 打包资源 */
const BUNDLED_SETTINGS_ASSETS = Object.freeze({
  '1.png': bundled1,
  '2.png': bundled2,
  '3.png': bundled3,
  'kooky.png': bundledKookyLogo,
  'openai.png': bundledOpenai,
  'qianwen.png': bundledQianwen,
  'deepseek.png': bundledDeepseek,
  'anthropic.png': bundledAnthropic,
})

/** @type {Map<string, string>} key: normalizeImageRef 后的小写路径 */
const EXACT_NORMALIZED_PATHS = (() => {
  const m = new Map()
  for (const file of Object.keys(BUNDLED_SETTINGS_ASSETS)) {
    const mod = BUNDLED_SETTINGS_ASSETS[file]
    m.set(`/super-assistant/src/assets/settings/${file}`.toLowerCase(), mod)
    m.set(`/src/assets/settings/${file}`.toLowerCase(), mod)
  }
  return m
})()

const SUFFIX_RULES = Object.keys(BUNDLED_SETTINGS_ASSETS).map((file) => ({
  suffix: `/src/assets/settings/${file}`.toLowerCase(),
  asset: BUNDLED_SETTINGS_ASSETS[file],
}))

const INCLUDES_RULES = Object.keys(BUNDLED_SETTINGS_ASSETS).map((file) => ({
  includes: `/assets/settings/${file}`.toLowerCase(),
  asset: BUNDLED_SETTINGS_ASSETS[file],
}))

/** 无路径时：纯 token / 路径最后一段 → 资源（如后端只回 `openai`、`1.png`） */
const BARE_TOKEN_TO_ASSET = Object.freeze({
  '1.png': bundled1,
  '2.png': bundled2,
  '3.png': bundled3,
  openai: bundledOpenai,
  qianwen: bundledQianwen,
  deepseek: bundledDeepseek,
  anthropic: bundledAnthropic,
  kooky: bundledKookyLogo,
})

/** 一人团队预设头像：与 CreateDigitalEmployeeDialog 同目录，后端可能回源码路径或裸 token（如 m05） */
const soloTeamAvaModules = import.meta.glob('@/assets/soloTeam/ava/*@2x.png', {
  eager: true,
  import: 'default',
})

const SOLO_TEAM_AVA_EXACT_PATHS = new Map()
const SOLO_TEAM_AVA_SUFFIX_RULES = []
const SOLO_TEAM_AVA_INCLUDES_RULES = []
/** @type {Map<string, string>} 小写文件名 m05@2x.png → 打包 URL */
const SOLO_TEAM_AVA_BY_FILE = new Map()
/** @type {Map<string, string>} 小写基名 m05 → 打包 URL */
const SOLO_TEAM_AVA_BY_BASE = new Map()

for (const [vitePath, url] of Object.entries(soloTeamAvaModules)) {
  const file = vitePath.split('/').pop() || ''
  const lowerFile = file.toLowerCase()
  if (!lowerFile) continue
  SOLO_TEAM_AVA_BY_FILE.set(lowerFile, url)
  const base = lowerFile.replace(/@2x\.png$/i, '')
  if (base) SOLO_TEAM_AVA_BY_BASE.set(base, url)
  SOLO_TEAM_AVA_EXACT_PATHS.set(`/super-assistant/src/assets/soloTeam/ava/${file}`.toLowerCase(), url)
  SOLO_TEAM_AVA_EXACT_PATHS.set(`/src/assets/soloTeam/ava/${file}`.toLowerCase(), url)
  SOLO_TEAM_AVA_SUFFIX_RULES.push({ suffix: `/src/assets/soloTeam/ava/${file}`.toLowerCase(), asset: url })
  SOLO_TEAM_AVA_INCLUDES_RULES.push({ includes: `/assets/soloTeam/ava/${file}`.toLowerCase(), asset: url })
}

function normalizeImageRef(val) {
  return String(val ?? '').trim().replace(/\\/g, '/')
}

/**
 * 命中已知「伪本地/API 源码路径」时返回 Vite 打包后的资源 URL，否则返回空字符串。
 * @param {unknown} val
 * @returns {string}
 */
export function resolveBundledImageFromApiPath(val) {
  const raw = String(val ?? '').trim()
  if (!raw) return ''
  const norm = normalizeImageRef(raw).toLowerCase()

  const exact = EXACT_NORMALIZED_PATHS.get(norm)
  if (exact) return exact

  for (const { suffix, asset } of SUFFIX_RULES) {
    if (norm.endsWith(suffix)) return asset
  }
  for (const { includes, asset } of INCLUDES_RULES) {
    if (norm.startsWith('http://') || norm.startsWith('https://')) continue
    if (norm.includes(includes)) return asset
  }

  const lastSeg = norm.includes('/') ? norm.slice(norm.lastIndexOf('/') + 1) : norm
  const bare = BARE_TOKEN_TO_ASSET[lastSeg]
  if (bare) return bare

  const soloExact = SOLO_TEAM_AVA_EXACT_PATHS.get(norm)
  if (soloExact) return soloExact
  for (const { suffix, asset } of SOLO_TEAM_AVA_SUFFIX_RULES) {
    if (norm.endsWith(suffix)) return asset
  }
  for (const { includes, asset } of SOLO_TEAM_AVA_INCLUDES_RULES) {
    if (norm.startsWith('http://') || norm.startsWith('https://')) continue
    if (norm.includes(includes)) return asset
  }
  const soloByFile = SOLO_TEAM_AVA_BY_FILE.get(lastSeg)
  if (soloByFile) return soloByFile
  const soloByBase = SOLO_TEAM_AVA_BY_BASE.get(lastSeg)
  if (soloByBase) return soloByBase

  return ''
}

/**
 * 是否为打包后无效的「源码树」路径（未映射时不可当 img src）。
 * @param {unknown} val
 * @returns {boolean}
 */
export function isLikelyInvalidSrcAssetPath(val) {
  const norm = normalizeImageRef(val).toLowerCase()
  if (!norm) return false
  return norm.includes('/src/assets/') || norm.includes('/super-assistant/src/')
}
