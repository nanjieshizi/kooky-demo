/**
 * 命令行模式：Claude Code 与 kooky 常把 xterm 标题都设为「Claude Code」，
 * 结合主进程 KC_TERM_BRAND_FILE（wrapper 写入 claude | kooky | ko 等）区分展示标题。
 */

export function isClaudeCodeCliTitle(s) {
  const x = String(s || '').trim().replace(/^[^\p{L}\p{N}]+/u, '')
  return x === 'Claude Code' || x.startsWith('Claude Code')
}

/**
 * 是否视为 Kooky 侧 CLI（与 readTermCliBrand 返回值对齐，兼容大小写与 ko 缩写）。
 * @param {string} brand readTermCliBrand 等来源
 */
export function isKookyCliBrand(brand) {
  const b = String(brand || '').trim().toLowerCase()
  return b === 'kooky' || b === 'ko'
}

/**
 * @param {string} rawTitle xterm 标题
 * @param {string} brand readTermCliBrand：claude | kooky | ko | KO 等（大小写不敏感）
 * @param {string} [mode] 终端 mode，claude-code 直连启动
 */
export function mapChromeTitleForCli(rawTitle, brand, mode) {
  const r = String(rawTitle || '').trim()
  if (!r) {
    if (isKookyCliBrand(brand)) return '🦀 Kooky Code'
    if (mode === 'claude-code') return 'Claude Code'
    return 'Shell'
  }
  // 终端已给出明确标题时优先保留，避免被 mode 覆盖（如 "Kooky Code v0.1.0"）
  if (!isClaudeCodeCliTitle(r)) return r

  if (isClaudeCodeCliTitle(r)) {
    if (isKookyCliBrand(brand)) return '🦀 Kooky Code'
    return 'Claude Code'
  }
  return r
}
