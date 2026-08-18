/**
 * 正文中的 <uploaded_files> 解析与剥离（solo-team 自包含）
 */
import { resolveEmployeeArtifactURL } from '../services/employeeThreadApi'

export function stripUploadedFilesBlock(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text.replace(/<uploaded_files\b[^>]*>[\s\S]*?<\/uploaded_files>/gi, '').trim()
  out = out.replace(/\n*\[uploaded_files\][\s\S]*?\[\/uploaded_files\]\n*/g, '').trim()
  // 剥离后端注入的纯文本文件描述块（如 "Here are the images you've viewed:\n• /mnt/..."）
  out = out.replace(/Here are the (?:images|files) you['']ve (?:viewed|uploaded)[^\n]*:[\s\S]*?(?=\n\n|\n[^\s•\-/]|$)/gi, '').trim()
  // 剥离无标题行的裸路径列表（如 "• /mnt/user-data/uploads/位图.png (image/png)"）
  out = out.replace(/(?:^|\n)[•\-]\s*\/mnt\/user-data\/(?:uploads|outputs)\/[^\n]*/g, '').trim()
  return out
}

function guessMimeFromFilename(name) {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.gif')) return 'image/gif'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.svg')) return 'image/svg+xml'
  if (n.endsWith('.bmp')) return 'image/bmp'
  if (n.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

function extFromName(name) {
  const n = name || ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
}

/**
 * 从消息正文解析 <uploaded_files> 块（与「我的分身」uploadedFilesMarkup 对齐）。
 * 后端会在块内写「本条 (empty)」与「历史仍可用」等段落；若本条为 (empty)，不得把历史路径挂到当前气泡上。
 * 同时支持纯文本格式：
 *   - "Here are the images you've viewed:\n• /mnt/user-data/uploads/xxx (mime)"
 *   - 无标题行的裸路径列表 "• /mnt/user-data/uploads/位图.png (image/png)"
 */
export function parseUploadedFilesFromContent(text, langgraphThreadId) {
  if (!langgraphThreadId || typeof text !== 'string') return []

  const out = []
  const byPath = new Map()

  // 1. 解析 <uploaded_files>...</uploaded_files> XML 块
  if (text.toLowerCase().includes('<uploaded_files')) {
    const blockMatch = text.match(/<uploaded_files\b[^>]*>([\s\S]*?)<\/uploaded_files>/i)
    if (blockMatch) {
      const blockContent = blockMatch[1]
      // 本条无新上传时整块不解析，避免后续轮次重复带出历史文件/图片
      if (!/\(empty\)/i.test(blockContent)) {
        const fileRegex = /- ([^\n(]+)\s*\(([^)]+)\)\s*\n\s*path:\s*([^\n]+)/gi
        let m
        while ((m = fileRegex.exec(blockContent)) !== null) {
          const name = m[1].trim()
          const path = m[3].trim()
          if (name && path) {
            byPath.set(path, { name, path, size: 0 })
          }
        }
        const pathRe = /path:\s*(\/mnt\/user-data\/uploads\/[^\s<\r\n]+)/gi
        while ((m = pathRe.exec(blockContent)) !== null) {
          const path = m[1].trim()
          const base = path.split('/').pop() || path
          if (path && !byPath.has(path)) {
            byPath.set(path, { name: base, path, size: 0 })
          }
        }
      }
    }
  }

  // 2. 解析 "Here are the ... you've ...:" 标题块
  const plainBlockRe = /Here are the (?:images|files) you['']ve (?:viewed|uploaded)[^\n]*:\s*\n([\s\S]*?)(?=\n\n|\n[^\s•\-/]|$)/gi
  let pm
  while ((pm = plainBlockRe.exec(text)) !== null) {
    const block = pm[1]
    const lineRe = /[•\-]\s*(\/mnt\/user-data\/(?:uploads|outputs)\/[^\s(]+)\s*(?:\(([^)]*)\))?/g
    let lm
    while ((lm = lineRe.exec(block)) !== null) {
      const path = lm[1].trim()
      if (!byPath.has(path)) {
        const name = decodeURIComponent(path.split('/').pop() || path)
        byPath.set(path, { name, path, size: 0 })
      }
    }
  }

  // 3. 解析无标题的裸路径行（如 "• /mnt/user-data/uploads/位图.png (image/png)"）
  const bareLineRe = /[•\-]\s*(\/mnt\/user-data\/(?:uploads|outputs)\/[^\s(]+)\s*(?:\(([^)]*)\))?/g
  let bm
  while ((bm = bareLineRe.exec(text)) !== null) {
    const path = bm[1].trim()
    if (!byPath.has(path)) {
      const name = decodeURIComponent(path.split('/').pop() || path)
      byPath.set(path, { name, path, size: 0 })
    }
  }

  for (const { name, path, size } of byPath.values()) {
    const url = resolveEmployeeArtifactURL(langgraphThreadId, path)
    if (!url) continue
    const mimeType = guessMimeFromFilename(name)
    out.push({
      name,
      url,
      thumbnailUrl: url,
      size,
      type: extFromName(name) || mimeType,
      mimeType,
    })
  }
  return out
}
