/**
 * present_files 工具路径解析（solo-team 自包含）
 */
import { resolveEmployeeArtifactURL } from '../services/employeeThreadApi'

function normalizeToolCall(tc) {
  if (!tc || typeof tc !== 'object') return null
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

export function extractPresentFilesPathsFromToolCalls(msg) {
  const toolCalls = msg?.tool_calls
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return []
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

function guessMimeFromFilename(name) {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.md')) return 'text/markdown'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.gif')) return 'image/gif'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.svg')) return 'image/svg+xml'
  if (n.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

export function attachmentsFromPresentEmployeePaths(langgraphThreadId, paths) {
  if (!langgraphThreadId || !paths?.length) return []
  const out = []
  for (const fp of paths) {
    const pathSeg = fp.startsWith('/') ? fp : `/${fp}`
    const base = pathSeg.split('/').filter(Boolean).pop() || 'file'
    const url = resolveEmployeeArtifactURL(langgraphThreadId, pathSeg)
    if (!url) continue
    const mimeType = guessMimeFromFilename(base)
    out.push({
      name: base,
      url,
      thumbnailUrl: url,
      size: 0,
      type: mimeType,
      mimeType,
    })
  }
  return out
}
