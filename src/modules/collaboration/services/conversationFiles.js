import api, { getSsoToken } from '@/shared/services/api'
import { getUserInfoAccessToken } from '@/shared/services/imApi'
import { absoluteKookyPublicUrl } from '@/shared/utils/kookyGateway'
import { IS_DEMO } from '@/shared/utils/buildMode'
import { getLocalDeviceInfo } from '@/shared/utils/localDeviceInfo'

const PAGE_SIZE = 20
const CONVERSATION_FILES_BASE = '/kooky-api/gateway/api/im/biz/v1/conversations'

function normalizeClientVersion(version) {
  return String(version || '').trim().match(/^\d+(?:\.\d+)*/)?.[0] || ''
}

async function buildConversationFileHeaders() {
  const token = getSsoToken()
  const jwt = getUserInfoAccessToken() || token
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(jwt ? { 'X-JWT-Token': jwt } : {}),
    'Client-Type': 'pc',
  }

  try {
    const info = await getLocalDeviceInfo()
    const platform = String(info?.platform || '').trim().toLowerCase()
    const machineId = String(info?.machineId || '').trim()
    const deviceType = { darwin: 'mac', win32: 'windows', linux: 'linux' }[platform]
      || platform
      || 'unknown'
    const clientVersion = normalizeClientVersion(info?.appVersion)
    if (machineId) headers['Client-Device-Id'] = `${deviceType}:${machineId}`
    if (clientVersion) headers['Client-Version'] = clientVersion
  } catch {
    // 浏览器态拿不到设备信息时，保留认证头与 Client-Type 即可。
  }

  return headers
}

function normalizeId(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function unwrapResponse(response) {
  let body = response
  for (let i = 0; i < 3; i += 1) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) break
    const hasPageData = Array.isArray(body.items)
      || Array.isArray(body.records)
      || Array.isArray(body.list)
    if (hasPageData || !body.data || typeof body.data !== 'object') break
    body = body.data
  }
  return body && typeof body === 'object' ? body : {}
}

function normalizeUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^(?:https?:|blob:|data:|mxc:)/i.test(value)) return value
  return absoluteKookyPublicUrl(value)
}

function fileExtension(name, explicit = '') {
  const suffix = String(explicit || '').replace(/^\./, '').trim().toLowerCase()
  if (suffix) return suffix
  const value = String(name || '')
  const index = value.lastIndexOf('.')
  return index > 0 && index < value.length - 1
    ? value.slice(index + 1).toLowerCase()
    : ''
}

function stableFileId(item, attachment, index) {
  const direct = attachment.id
    ?? attachment.fileId
    ?? attachment.file_id
    ?? item.id
    ?? item.fileId
    ?? item.file_id
  if (direct !== undefined && direct !== null && direct !== '') return String(direct)
  return [
    item.threadId ?? item.thread_id ?? '',
    attachment.name ?? attachment.fileName ?? '',
    item.sendTime ?? item.send_time ?? item.createdAt ?? item.created_at ?? '',
    index,
  ].join('|')
}

function normalizeFile(item = {}, conversationId, index = 0) {
  const attachment = item.attachment || item.file || item.fileInfo || item.file_info || item
  const sender = item.sender && typeof item.sender === 'object' ? item.sender : {}
  const name = String(
    attachment.name
    || attachment.displayName
    || attachment.display_name
    || attachment.fileName
    || attachment.file_name
    || attachment.original_filename
    || '未命名文件',
  ).trim()
  const rawUrl = attachment.url
    || attachment.httpUrl
    || attachment.http_url
    || attachment.downloadUrl
    || attachment.download_url
    || item.url
    || item.httpUrl
    || item.http_url
  const inlineContent = attachment.content ?? item.contentText ?? item.content_text ?? ''

  return {
    id: stableFileId(item, attachment, index),
    name,
    type: fileExtension(name, attachment.suffix || attachment.type),
    mimeType: attachment.mimeType || attachment.mime_type || '',
    size: Number(attachment.size ?? attachment.fileSize ?? attachment.file_size) || 0,
    httpUrl: normalizeUrl(rawUrl),
    sender: sender.displayName
      || sender.display_name
      || sender.name
      || item.senderName
      || item.sender_name
      || '',
    sendTime: item.sendTime || item.send_time || item.createdAt || item.created_at || '',
    inlineContent: typeof inlineContent === 'string' ? inlineContent : '',
    conversationId: normalizeId(conversationId),
    sourceBusinessType: item.businessType || item.business_type || '',
    isLocalFallback: item.isLocalFallback === true,
  }
}

function readRecords(body) {
  if (Array.isArray(body)) return body
  if (Array.isArray(body.items)) return body.items
  if (Array.isArray(body.records)) return body.records
  if (Array.isArray(body.list)) return body.list
  if (Array.isArray(body.content)) return body.content
  return []
}

function normalizePage(response, conversationId, requestedPage, requestedSize) {
  const body = unwrapResponse(response)
  const records = readRecords(body)
  const page = Math.max(1, Number(body.page ?? body.pageNumber ?? body.page_num ?? requestedPage) || 1)
  const size = Math.max(1, Number(body.size ?? body.pageSize ?? body.page_size ?? requestedSize) || PAGE_SIZE)
  const totalValue = body.total ?? body.totalRow ?? body.totalElements ?? body.total_count
  const hasTotal = totalValue !== undefined && totalValue !== null && totalValue !== ''
  const total = hasTotal ? Math.max(0, Number(totalValue) || 0) : ((page - 1) * size + records.length)
  return {
    items: records.map((item, index) => normalizeFile(item, conversationId, index)),
    page,
    size,
    total,
    hasMore: hasTotal ? page * size < total : records.length >= size,
    source: 'remote',
    fallbackMessage: '',
  }
}

function encodeInlineText(content, mimeType = 'text/plain') {
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`
}

function localDemoFiles(conversationId, messages = []) {
  const attachments = []
  for (const message of messages) {
    const list = message?.content?.attachments || message?.attachments
    if (!Array.isArray(list)) continue
    for (const attachment of list) {
      attachments.push(normalizeFile({
        attachment,
        senderName: message.senderDisplayName || message.senderName || '',
        sendTime: message.createdAt || message.timestamp || '',
        isLocalFallback: true,
      }, conversationId, attachments.length))
    }
  }

  const projectBrief = [
    '# 项目协作说明',
    '',
    '- 群聊是项目的沟通主场',
    '- 协作任务承载可执行的流程',
    '- 群内数字人通过 Skill 调用项目与协作任务接口',
    '',
    '> 本文件是内置演示群的本地会话文件。',
  ].join('\n')
  const reviewNotes = [
    '评审纪要',
    '1. 每个协作群都可以直接维护项目看板，不需要额外启用。',
    '2. 项目目标、里程碑和风险由人或数字人维护。',
    '3. 第三方数据不做后台自动同步。',
  ].join('\n')
  const milestoneDraft = JSON.stringify({
    project: '群聊项目看板改造',
    milestones: [
      { name: '群聊与项目看板并存', status: 'done' },
      { name: '会话文件与协作任务闭环', status: 'active' },
      { name: '群内数字人调用项目与协作任务接口', status: 'pending' },
    ],
  }, null, 2)

  const samples = [
    {
      id: `local-${conversationId}-brief`,
      name: '项目协作说明.md',
      type: 'md',
      mimeType: 'text/markdown',
      size: new Blob([projectBrief]).size,
      httpUrl: encodeInlineText(projectBrief, 'text/markdown'),
      inlineContent: projectBrief,
      sender: '团队助手',
      sendTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      conversationId: normalizeId(conversationId),
      isLocalFallback: true,
    },
    {
      id: `local-${conversationId}-review`,
      name: '项目看板改造评审纪要.txt',
      type: 'txt',
      mimeType: 'text/plain',
      size: new Blob([reviewNotes]).size,
      httpUrl: encodeInlineText(reviewNotes),
      inlineContent: reviewNotes,
      sender: '张月华',
      sendTime: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      conversationId: normalizeId(conversationId),
      isLocalFallback: true,
    },
    {
      id: `local-${conversationId}-milestones`,
      name: '里程碑草案.json',
      type: 'json',
      mimeType: 'application/json',
      size: new Blob([milestoneDraft]).size,
      httpUrl: encodeInlineText(milestoneDraft, 'application/json'),
      inlineContent: milestoneDraft,
      sender: '云帆管家',
      sendTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      conversationId: normalizeId(conversationId),
      isLocalFallback: true,
    },
  ]

  const merged = new Map()
  for (const file of [...attachments, ...samples]) {
    if (!file?.id || merged.has(file.id)) continue
    merged.set(file.id, file)
  }
  return [...merged.values()]
}

function localFallbackPage({ conversationId, filename, page, size, messages, error }) {
  const keyword = String(filename || '').trim().toLowerCase()
  const filtered = localDemoFiles(conversationId, messages).filter((file) => (
    !keyword || file.name.toLowerCase().includes(keyword)
  ))
  const start = (page - 1) * size
  return {
    items: filtered.slice(start, start + size),
    page,
    size,
    total: filtered.length,
    hasMore: start + size < filtered.length,
    source: 'local-fallback',
    fallbackMessage: '当前是内置演示群，未连通服务时展示本地会话文件。',
    fallbackReason: error?.message || '',
  }
}

function shouldUseLocalFallback(conversationId) {
  return IS_DEMO && /^(?:mock|demo)-/i.test(String(conversationId || ''))
}

export async function fetchCollabConversationFiles({
  conversationId,
  filename = '',
  page = 1,
  size = PAGE_SIZE,
  messages = [],
} = {}) {
  const id = normalizeId(conversationId)
  if (!id) throw new Error('缺少群聊 ID，无法加载会话文件')
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedSize = Math.max(1, Number(size) || PAGE_SIZE)

  if (shouldUseLocalFallback(id)) {
    return localFallbackPage({
      conversationId: id,
      filename,
      page: normalizedPage,
      size: normalizedSize,
      messages,
    })
  }

  const headers = await buildConversationFileHeaders()
  const response = await api.get(
    `${CONVERSATION_FILES_BASE}/${encodeURIComponent(id)}/files`,
    {
      params: {
        page: normalizedPage,
        size: normalizedSize,
        ...(String(filename || '').trim() ? { filename: String(filename).trim() } : {}),
      },
      headers,
    },
  )
  return normalizePage(response, id, normalizedPage, normalizedSize)
}

function isPresignedUrl(url) {
  return /[?&]X-Amz-Signature=/i.test(url)
    || (/[?&]AWSAccessKeyId=/i.test(url) && /[?&]Signature=/i.test(url))
}

function isTrustedKookyOrigin(url) {
  try {
    const kookyOrigin = new URL(absoluteKookyPublicUrl('/')).origin
    return new URL(url, `${kookyOrigin}/`).origin === kookyOrigin
  } catch {
    return false
  }
}

async function fileRequestHeaders(url) {
  if (
    isPresignedUrl(url)
    || /^(?:data:|blob:)/i.test(url)
    || !isTrustedKookyOrigin(url)
  ) return {}
  return buildConversationFileHeaders()
}

export async function fetchCollabConversationFileBlob(file, { conversationId } = {}) {
  const expectedConversationId = normalizeId(conversationId)
  const fileConversationId = normalizeId(file?.conversationId)
  if (
    expectedConversationId
    && fileConversationId
    && expectedConversationId !== fileConversationId
  ) {
    throw new Error('会话已经切换，请在当前群重新打开文件')
  }
  if (file?.inlineContent) {
    return new Blob([file.inlineContent], {
      type: file.mimeType || 'text/plain;charset=utf-8',
    })
  }
  const url = normalizeUrl(file?.httpUrl || file?.url)
  if (!url || url.startsWith('mxc:')) throw new Error('该文件暂无可用下载地址')
  const response = await fetch(url, { headers: await fileRequestHeaders(url) })
  if (!response.ok) {
    const error = new Error(`文件请求失败（HTTP ${response.status}）`)
    error.status = response.status
    throw error
  }
  return response.blob()
}

export function triggerCollabConversationFileDownload(blob, fileName = '文件') {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1200)
}

export const COLLAB_CONVERSATION_FILE_PAGE_SIZE = PAGE_SIZE
