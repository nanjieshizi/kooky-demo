import { resolveArtifactURL } from '../services/threadApi'

/**
 * LangGraph / deer-flow 会把本地上传路径写进消息正文里的 <uploaded_files> 块，
 * 与 additional_kwargs.files 并存或仅存在正文。本模块负责解析与从气泡正文中剥离。
 * 下载 URL 与 Web 一致：`/api/threads/{id}/artifacts` + 虚拟路径（见 deer-flow message-list-item + resolveArtifactURL）
 */

export function stripUploadedFilesBlock(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(/<uploaded_files\b[^>]*>[\s\S]*?<\/uploaded_files>/gi, '').trim()
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
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.doc')) return 'application/msword'
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (n.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (n.endsWith('.txt')) return 'text/plain'
  if (n.endsWith('.md')) return 'text/markdown'
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'text/html'
  return 'application/octet-stream'
}

function extFromName(name) {
  const n = name || ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toLowerCase() : ''
}

/**
 * 从消息正文解析 <uploaded_files> 中的 Path: /mnt/user-data/uploads/xxx 及 “文件名 (大小)” 行，生成附件列表（可 GET 的线程上传 URL）。
 * @param {string} text
 * @param {string} langgraphThreadId
 * @returns {Array<{ name: string, url: string, thumbnailUrl: string, size: number, type: string, mimeType: string }>}
 */
export function parseUploadedFilesFromContent(text, langgraphThreadId) {
  if (!langgraphThreadId || typeof text !== 'string' || !text.toLowerCase().includes('<uploaded_files')) {
    return []
  }

  // 提取 <uploaded_files>...</uploaded_files> 块内容
  const blockMatch = text.match(/<uploaded_files\b[^>]*>([\s\S]*?)<\/uploaded_files>/i)
  if (!blockMatch) return []

  const fullBlock = blockMatch[1]

  // 后端会把"本条消息上传的文件"和"历史可用文件"都写进同一个块：
  //   "The following files were uploaded in this message:\n\n
  //    - file1 (size)\n  Path: /mnt/...\n\n
  //    The following files were uploaded in previous messages and are still available:\n
  //    - old_file (size)\n  Path: /mnt/..."
  // 只截取 "in this message" 段，避免历史文件被错误归到本条消息上
  const thisMsgMarker = /the following files were uploaded in this message:/i
  const prevMsgMarker = /the following files were uploaded in previous messages/i
  let blockContent = fullBlock
  const thisMatch = thisMsgMarker.exec(fullBlock)
  if (thisMatch) {
    const startIdx = thisMatch.index + thisMatch[0].length
    const tail = fullBlock.slice(startIdx)
    const prevMatch = prevMsgMarker.exec(tail)
    blockContent = prevMatch ? tail.slice(0, prevMatch.index) : tail
  } else {
    // 没有显式标记时，若整体含有 "previous messages" 段，把它截掉
    const prevMatch = prevMsgMarker.exec(fullBlock)
    if (prevMatch) blockContent = fullBlock.slice(0, prevMatch.index)
  }

  // 若本条消息标注了 (empty)，说明本条没有新上传文件，直接返回空
  if (/\(empty\)/i.test(blockContent)) {
    return []
  }

  /** @type {Map<string, { name: string, path: string, size: number }>} */
  const byPath = new Map()

  // 与 deer-flow `parseUploadedFiles` 相同：`- name (size)\n  Path: /mnt/...`
  const fileRegex = /- ([^\n(]+)\s*\(([^)]+)\)\s*\n\s*path:\s*([^\n]+)/gi
  let m
  while ((m = fileRegex.exec(blockContent)) !== null) {
    const name = m[1].trim()
    const path = m[3].trim()
    if (name && path) {
      byPath.set(path, { name, path, size: 0 })
    }
  }

  // Path: 行（不要求前置 "- name (size)"）
  const pathRe = /path:\s*(\/mnt\/user-data\/uploads\/[^\s<\r\n]+)/gi
  while ((m = pathRe.exec(blockContent)) !== null) {
    const path = m[1].trim()
    const base = path.split('/').pop() || path
    if (path && !byPath.has(path)) {
      byPath.set(path, { name: base, path, size: 0 })
    }
  }

  const out = []
  for (const { name, path, size } of byPath.values()) {
    const url = resolveArtifactURL(langgraphThreadId, path)
    if (!url) continue
    const mimeType = guessMimeFromFilename(name)
    out.push({
      name,
      url,
      thumbnailUrl: url,
      size,
      type: extFromName(name),
      mimeType,
    })
  }
  return out
}
