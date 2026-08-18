import { resolveArtifactURL } from '../services/threadApi'

/**
 * Deer-flow AI 产物：present_files tool（对齐 Web extractPresentFilesFromMessage）
 * @see deer-flow/frontend/src/core/messages/utils.ts
 */

function guessMimeFromFilename(name) {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.md')) return 'text/markdown'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.gif')) return 'image/gif'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.svg')) return 'image/svg+xml'
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.doc')) return 'application/msword'
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (n.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (n.endsWith('.txt')) return 'text/plain'
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'text/html'
  return 'application/octet-stream'
}

const MIME_TO_EXT_MAP = {
  'text/markdown': 'md',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/html': 'html',
}

export function mimeToExt(mime) {
  return MIME_TO_EXT_MAP[mime] || ''
}

function normalizeToolCall(tc) {
  if (!tc || typeof tc !== 'object') return null
  // OpenAI 风格 tool_calls[].function
  if (tc.function && typeof tc.function === 'object') {
    let args = tc.function.arguments
    if (args == null || args === '') args = {}
    else if (typeof args === 'string') {
      try {
        args = JSON.parse(args)
      } catch {
        args = {}
      }
    }
    return { name: tc.function.name, args }
  }
  let args = tc.args
  if (args == null && typeof tc.arguments === 'string') {
    try {
      args = JSON.parse(tc.arguments)
    } catch {
      args = {}
    }
  }
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      args = {}
    }
  }
  if (!args || typeof args !== 'object') args = {}
  return { name: tc.name, args }
}

/** @param {object} msg LangGraph AIMessage-like */
export function extractPresentFilesPathsFromToolCalls(msg) {
  const toolCalls = msg?.tool_calls
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return []
  /** @type {string[]} */
  const paths = []
  for (const tc of toolCalls) {
    const n = normalizeToolCall(tc)
    if (!n || n.name !== 'present_files') continue
    const a = n.args || {}
    const fps = a.filepaths ?? a.filepath ?? a.paths
    if (Array.isArray(fps)) {
      for (const p of fps) {
        if (typeof p === 'string' && p.trim()) paths.push(p.trim())
      }
    } else if (typeof fps === 'string' && fps.trim()) {
      paths.push(fps.trim())
    }
  }
  return paths
}

/**
 * @param {string} langgraphThreadId
 * @param {string[]} paths 虚拟路径，如 /mnt/user-data/outputs/hello.md
 */
export function attachmentsFromPresentFilePaths(langgraphThreadId, paths) {
  if (!langgraphThreadId || !paths?.length) return []
  const out = []
  for (const fp of paths) {
    const pathSeg = fp.startsWith('/') ? fp : `/${fp}`
    const base = pathSeg.split('/').filter(Boolean).pop() || 'file'
    const url = resolveArtifactURL(langgraphThreadId, pathSeg)
    if (!url) continue
    const mimeType = guessMimeFromFilename(base)
    const dotIdx = base.lastIndexOf('.')
    const extFromName = dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : mimeToExt(mimeType)
    out.push({
      name: base,
      url,
      thumbnailUrl: url,
      size: 0,
      type: extFromName,
      mimeType,
    })
  }
  return out
}
