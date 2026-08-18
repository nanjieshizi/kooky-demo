// 欢迎卡片 SIXEL 渲染：canvas 绘制完整卡片（大圆角边框 + 螃蟹 + 文字）→ SIXEL
// 参考：https://vt100.net/docs/vt3xx-gp/chapter14.html

import crabSvgUrl from '@/assets/crab.svg'

// ========================
// SIXEL 编码器
// ========================

function rgbaToSixel(imageData, width, height) {
  const { data } = imageData
  const colorMap = new Map()
  const pixels = new Uint8Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3]

    if (a < 128) { pixels[i] = 255; continue }

    const qr = Math.min(5, Math.floor(r / 43))
    const qg = Math.min(5, Math.floor(g / 43))
    const qb = Math.min(5, Math.floor(b / 43))
    const key = qr * 36 + qg * 6 + qb

    if (!colorMap.has(key)) {
      colorMap.set(key, {
        index: colorMap.size,
        r: Math.round(qr * 20),
        g: Math.round(qg * 20),
        b: Math.round(qb * 20),
      })
    }
    pixels[i] = colorMap.get(key).index
  }

  let sixel = ''
  for (const [, col] of colorMap) {
    sixel += `#${col.index};2;${col.r};${col.g};${col.b}`
  }

  for (let y = 0; y < height; y += 6) {
    const rowColors = new Map()
    for (let x = 0; x < width; x++) {
      for (const [, col] of colorMap) {
        if (!rowColors.has(col.index)) rowColors.set(col.index, [])
      }
      for (const [, col] of colorMap) {
        let bits = 0
        for (let dy = 0; dy < 6; dy++) {
          const py = y + dy
          if (py >= height) break
          if (pixels[py * width + x] === col.index) bits |= (1 << dy)
        }
        rowColors.get(col.index).push(bits)
      }
    }
    let first = true
    for (const [colorIdx, cols] of rowColors) {
      if (cols.every(b => b === 0)) continue
      if (!first) sixel += '$'
      first = false
      sixel += `#${colorIdx}`
      let i = 0
      while (i < cols.length) {
        const ch = String.fromCharCode(63 + cols[i])
        let count = 1
        while (i + count < cols.length && cols[i + count] === cols[i]) count++
        if (count >= 4) sixel += `!${count}${ch}`
        else sixel += ch.repeat(count)
        i += count
      }
    }
    sixel += '-'
  }
  return sixel
}

// ========================
// 图片加载
// ========================

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ========================
// 欢迎卡片生成
// ========================

let cachedCard = null

/**
 * 生成完整欢迎卡片 SIXEL（大圆角边框 + 螃蟹 + 文字）
 */
export async function generateWelcomeCardSixel() {
  if (cachedCard) return cachedCard

  const W = 620, H = 180
  const R = 16 // 大圆角半径
  const border = '#FE6442'
  const divX = 195 // 竖分隔线 x

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  // 1. 大圆角边框
  ctx.strokeStyle = border
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(1, 1, W - 2, H - 2, R)
  ctx.stroke()

  // 2. 竖分隔线（从上边框到下边框）
  ctx.beginPath()
  ctx.moveTo(divX, 1)
  ctx.lineTo(divX, H - 1)
  ctx.stroke()

  // 3. 螃蟹 SVG
  const crabImg = await loadImage(crabSvgUrl)
  const crabSize = 108
  const crabX = (divX - crabSize) / 2
  ctx.drawImage(crabImg, crabX, 40, crabSize, crabSize)

  // 4. 文字
  const tx = divX + 16
  const mono = '"SF Mono", Monaco, Menlo, Consolas, monospace'
  ctx.textBaseline = 'top'

  // Welcome back!（左上角）
  ctx.font = `bold 13px ${mono}`
  ctx.fillStyle = border
  ctx.fillText('Welcome back!', 18, 12)

  // Kooky CLI（右上角）
  ctx.fillText('Kooky CLI', tx, 12)

  // Kooky-cli 已就绪 🦀 你的终端，一屏尽览
  ctx.font = `13px ${mono}`
  let y = 72
  let x = tx
  ctx.fillStyle = '#4C77D6'
  ctx.fillText('Kooky-cli', x, y)
  x += ctx.measureText('Kooky-cli').width
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(' 已就绪 🦀 你的终端，一屏尽览', x, y)

  // 💡 双击 option，探索隐藏捷径  输入 ko 回车，畅用 AI
  y = 138
  const segments = [
    ['💡 双击 ', 'rgba(255,255,255,0.85)'],
    ['option', '#FFA500'],
    ['，探索隐藏捷径  输入 ', 'rgba(255,255,255,0.85)'],
    ['ko', '#30B528'],
    [' 回车，畅用 AI', 'rgba(255,255,255,0.85)'],
  ]
  x = tx
  for (const [text, color] of segments) {
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    x += ctx.measureText(text).width
  }

  // 5. 编码为 SIXEL
  const imageData = ctx.getImageData(0, 0, W, H)
  const sixelData = rgbaToSixel(imageData, W, H)
  cachedCard = `\x1bP0;0;0q"1;1;${W};${H}${sixelData}\x1b\\`
  return cachedCard
}
