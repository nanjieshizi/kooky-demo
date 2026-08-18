// 像素螃蟹 ANSI art — 全块字符高清版
// 使用 █ 全块字符，28×10 像素网格
// 主体橙 #FE6442
// 仅使用前景色，避免 conpty resize 时背景色拉伸到行末

const o = '\x1b[38;2;254;100;66m'
const r = '\x1b[0m'

// 螃蟹可见宽度（每行均为 28 可见字符）
export const CRAB_WIDTH = 28

// 默认姿态
const raw2 = [
  '     ████            ████  ',
  '    █    █          █    █ ',
  '     ███  ██████████  ███  ',
  '   █  ████  ████  ████  █  ',
  '    ██ ████████████████ ██ ',
  '      ████████████████     ',
  '  ██  ████████████████  ██ ',
  '  ██    ████████████    ██ ',
  '  ██      ████████      ██ ',
  '  █         ████         █ ',
]

const frame2 = raw2.map(l => `${o}${l.padEnd(CRAB_WIDTH)}${r}`)

// 旧版帧保留导出兼容
const frame1 = frame2
const frame3 = frame2

// 动画序列
export const crabFrames = [frame2, frame1, frame2, frame3]
export const crabLines = frame2
