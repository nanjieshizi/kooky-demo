/**
 * 团队文件库服务
 * 接口路径：kc-public/kc-media/api/v1
 *
 * 业务 Headers（每个请求自动注入）：
 *   X-Business-Id: 业务空间 id（团队 roomId / 分身 DeerFlow 会话见下方）
 *   X-Business-Type: team | person | opt | conversation
 *   X-Env: {env}
 *   X-User-Id: {userId}
 *   Authorization: Bearer {token}
 *   X-Bind-Im-User-Id: {imUserId}
 */

import SparkMD5 from 'spark-md5'
import api from '@/shared/services/api'
import { useUserStore } from '@/modules/auth/store'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { getOneEnv } from '@/shared/utils/oneEnv'
import { client, ROOM_TYPES } from '@/shared/im-client'

const BASE = 'kc-public/kc-media/api/v1'

// 分片大小：5MB
const CHUNK_SIZE = 5 * 1024 * 1024

// 扩展名 → MIME 兜底映射（浏览器对部分文件类型返回空 type）
const EXT_MIME_MAP = {
  md: 'text/markdown', txt: 'text/plain', html: 'text/html', htm: 'text/html',
  css: 'text/css', csv: 'text/csv', xml: 'text/xml', yaml: 'text/yaml', yml: 'text/yaml',
  js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
  ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/javascript',
  vue: 'text/x-vue', svelte: 'text/x-svelte',
  json: 'application/json', sql: 'application/sql',
  py: 'text/x-python', java: 'text/x-java', go: 'text/x-go',
  rs: 'text/x-rust', rb: 'text/x-ruby', php: 'text/x-php',
  swift: 'text/x-swift', kt: 'text/x-kotlin', kts: 'text/x-kotlin',
  dart: 'text/x-dart', scala: 'text/x-scala', cs: 'text/x-csharp',
  c: 'text/x-c', cpp: 'text/x-c++', cc: 'text/x-c++', cxx: 'text/x-c++',
  h: 'text/x-c', hpp: 'text/x-c++', sh: 'text/x-sh', bash: 'text/x-sh',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
}

function getMimeType(file) {
  if (file.type) return file.type
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  return EXT_MIME_MAP[ext] || 'application/octet-stream'
}

function sameBusinessId(a, b) {
  return a != null && b != null && String(a) === String(b)
}

function isDeerflowBusinessId(spaceId) {
  try {
    const uiStore = useUIStore()
    if (uiStore.activePrimaryNav !== 'deerflow') return false
    const deerflowStore = useDeerflowChatStore()
    return sameBusinessId(spaceId, deerflowStore.selectedAgentId) || sameBusinessId(spaceId, uiStore.activeSecondaryNav)
  } catch {
    return false
  }
}

/**
 * 根据 spaceId 推断 businessType
 * @param {string} spaceId
 * @returns {'team'|'person'|'opt'|'conversation'}
 */
function inferBusinessType(spaceId) {
  if (!spaceId) return 'team'

  // 我的分身（DeerFlow）：kc-media 与 deer-flow thread-files 一致，用 person
  if (isDeerflowBusinessId(spaceId)) return 'person'

  const personalRoomId = client.getPersonalRoomId?.()
  if (personalRoomId && spaceId === personalRoomId) return 'person'

  // 从 IM client 获取房间信息
  const rooms = client.getRooms?.() || []
  const room = rooms.find(r => r.roomId === spaceId)

  if (!room) return 'team'

  // HTTP IM client 已不维护会话缓存；这里仅兼容旧 Matrix client。
  const conv = client._conversations?.get(spaceId)
  const convType = conv?.type || room.type || room.createRoomType || ''

  // 根据会话类型映射 businessType
  if (convType === 'personal' || room.createRoomType === ROOM_TYPES.BOT_PERSON_CHAT) return 'person'
  if (room.createRoomType === ROOM_TYPES.SUPER_PERSON_CHAT) return 'opt'
  if (convType === 'team' || room.createRoomType === ROOM_TYPES.GROUP_CHAT) return 'team'
  return 'team'
}

/**
 * DeerFlow 当前会话在 kc-media 中的 X-Business-Id：统一使用 agent_id。
 * @param {string|number} personalThreadId
 * @returns {string}
 */
function resolveDeerflowKcMediaBusinessId(personalThreadId) {
  try {
    const deerflowStore = useDeerflowChatStore()
    const row = deerflowStore.threads.find((t) => String(t.id) === String(personalThreadId))
    const agentId = row?.agent_id
    if (agentId != null && String(agentId).trim() !== '') return String(agentId)
  } catch { /* noop */ }
  return String(personalThreadId)
}

/**
 * @param {string} spaceId
 * @param {'team'|'person'|'opt'|'conversation'} [businessType]  不传则自动推断
 */
function bizHeaders(spaceId, businessType) {
  const userStore = useUserStore()
  const imConnectionStore = useImConnectionStore()
  const accessToken = userStore.userInfo?.access_token
  const userId = userStore.userInfo?.userId
  const userName = userStore.userInfo?.userName || userStore.userInfo?.username
  const imUserId = imConnectionStore.userId
  const env = getOneEnv()

  // 自动推断 businessType
  const finalBusinessType = businessType || inferBusinessType(spaceId)
  const xBusinessId =
    finalBusinessType === 'person' && isDeerflowBusinessId(spaceId)
      ? resolveDeerflowKcMediaBusinessId(spaceId)
      : String(spaceId)

  return {
    'X-Business-Id': xBusinessId,
    'X-Business-Type': finalBusinessType,
    'X-Env': env,
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(userName ? { 'X-User-Name': userName } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(imUserId ? { 'X-Bind-Im-User-Id': imUserId } : {}),
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 计算整个文件的 MD5
 * @param {File} file
 * @returns {Promise<string>}
 */
function calcFileMd5(file) {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    const chunks = Math.ceil(file.size / CHUNK_SIZE)
    let current = 0

    function loadNext() {
      const start = current * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    reader.onload = (e) => {
      spark.append(e.target.result)
      current++
      if (current < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }
    reader.onerror = reject
    loadNext()
  })
}

/**
 * 计算单个分片的 MD5
 * @param {Blob} chunk
 * @returns {Promise<string>}
 */
function calcChunkMd5(chunk) {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    reader.onload = (e) => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(chunk)
  })
}

// ─── F2：文件管理 ─────────────────────────────────────────────────────────────

/**
 * 浏览目录（GET /team-files?parentId=xxx）
 * @param {string} spaceId
 * @param {string|null} parentId  null = 根目录
 * @returns {Promise<TeamFileInfo[]>}
 */
export async function listFiles(spaceId, parentId = null) {
  const params = {}
  if (parentId !== null) params.parentId = parentId
  const res = await api.get(`${BASE}/team-files`, {
    params,
    headers: bizHeaders(spaceId),
  })
  const page = res.data ?? res
  // 实测响应字段为 records（非 list），totalRow（非 total），pageNumber（非 pageNum）
  return page?.records ?? page?.list ?? (Array.isArray(page) ? page : [])
}

/**
 * 只返回目录节点（GET /team-files/dirs?parentId=xxx）
 */
export async function listDirs(spaceId, parentId = null) {
  const params = {}
  if (parentId !== null) params.parentId = parentId
  const res = await api.get(`${BASE}/team-files/dirs`, {
    params,
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

/**
 * 面包屑导航（GET /team-files/{dirId}/path）
 * @returns {Promise<TeamFileInfo[]>} 从根到当前目录的路径数组
 */
export async function getPath(spaceId, dirId) {
  const res = await api.get(`${BASE}/team-files/${dirId}/path`, {
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

/**
 * 创建文件夹（POST /team-files/directory）
 * @param {string} spaceId
 * @param {string|null} parentId
 * @param {string} name
 * @returns {Promise<TeamFileInfo>}
 */
export async function createDirectory(spaceId, parentId = null, name, businessType) {
  const res = await api.post(
    `${BASE}/team-files/directory`,
    { parentId: parentId ?? null, name },
    { headers: bizHeaders(spaceId, businessType) },
  )
  return res.data ?? res
}

/**
 * 重命名（PUT /team-files/{fileId}/rename）
 * @param {string} spaceId
 * @param {string} fileId
 * @param {string} newName
 * @returns {Promise<TeamFileInfo>}
 */
export async function renameFile(spaceId, fileId, newName) {
  const res = await api.put(
    `${BASE}/team-files/${fileId}/rename`,
    { newName },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 删除（DELETE /team-files）
 * @param {string} spaceId
 * @param {string[]} fileIds
 */
export async function deleteFiles(spaceId, fileIds) {
  await api.delete(`${BASE}/team-files`, {
    data: { fileIds },
    headers: bizHeaders(spaceId),
  })
}

/**
 * 移动文件/文件夹到新父目录
 * @param {string} spaceId
 * @param {string} fileId
 * @param {string|null} targetParentId  null = 移动到根目录
 * @returns {Promise<TeamFileInfo>}
 */
export async function moveFile(spaceId, fileId, targetParentId, businessType) {
  const res = await api.put(
    `${BASE}/team-files/${fileId}/move`,
    { targetParentId: targetParentId ?? null },
    { headers: bizHeaders(spaceId, businessType) },
  )
  return res.data ?? res
}

/**
 * 批量更新同层级排序（PUT /team-files/sort）
 * @param {string} spaceId
 * @param {Array<{fileId: string, sortOrder: number}>} items
 */
export async function batchSort(spaceId, items) {
  const res = await api.put(
    `${BASE}/team-files/sort`,
    { items },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 从 URL 保存文件到文件库（POST /team-files/save-from-url）
 * @param {string} spaceId
 * @param {string} downloadUrl  文件下载链接（S3 预签名 URL）
 * @param {string} fileName     文件名（含后缀）
 * @param {string|null} parentId  目标文件夹 ID，null 表示根目录
 * @param {object|null} ext     扩展信息，如 { source: 'conversation', sourceId: 'xxx' }
 * @returns {Promise<TeamFileInfo>}
 */
export async function saveFromUrl(spaceId, downloadUrl, fileName, parentId = null, ext = null) {
  const res = await api.post(
    `${BASE}/team-files/save-from-url`,
    { downloadUrl, fileName, parentId: parentId ?? null, ext },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 批量获取文件引用信息（POST /team-files/batch-refs）
 * @param {string} spaceId
 * @param {string[]} fileIds  文件 ID 列表（最多 5 个）
 * @returns {Promise<Array<{id, displayName, suffix, mimeType, size, downloadUrl}>>}
 */
export async function batchGetRefs(spaceId, fileIds) {
  const res = await api.post(
    `${BASE}/team-files/batch-refs`,
    { fileIds },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 获取下载链接（GET /team-files/{fileId}/download-url）
 * @returns {Promise<{url: string, expireAt: string}>}
 */
export async function getDownloadUrl(spaceId, fileId) {
  const res = await api.get(`${BASE}/team-files/${fileId}/download-url`, {
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

// ─── F5：文件预览 ─────────────────────────────────────────────────────────────

/**
 * 获取预览路径（接口13：GET /team-files/{fileId}/preview 返回文件流）
 * 直接返回路径字符串，调用方用 fetch/XHR 携带 Authorization header 请求，
 * 或通过 <iframe>/<video> 等标签直接使用（需网关支持 token 透传）。
 * @returns {string}
 */
export function getPreviewUrl(_spaceId, fileId) {
  return `${BASE}/team-files/${fileId}/preview`
}

/**
 * 获取预签名访问 URL（接口14：GET /team-files/{fileId}/url）
 * 适合图片/视频嵌入（Content-Disposition: inline）
 * @param {string} spaceId
 * @param {string} fileId
 * @param {number} [expireSeconds]  URL 有效时间（秒），默认 3600
 * @returns {Promise<string>}  预签名 URL 字符串
 */
export async function getFileUrl(spaceId, fileId, expireSeconds) {
  const params = {}
  if (expireSeconds !== undefined) params.expireSeconds = expireSeconds
  const res = await api.get(`${BASE}/team-files/${fileId}/url`, {
    params,
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

/**
 * 获取预览 Blob URL（GET /team-files/{fileId}/preview）
 * 携带完整业务 headers，返回可直接嵌入 <iframe>/<img> 的 blob: URL
 * @returns {Promise<{blobUrl: string, mimeType: string, revoke: () => void}>}
 */
export async function fetchPreviewBlob(spaceId, fileId) {
  const res = await api.get(`${BASE}/team-files/${fileId}/preview`, {
    headers: bizHeaders(spaceId),
    responseType: 'blob',
  })
  const blob = res.data ?? res
  const mimeType = blob.type || 'application/octet-stream'
  const blobUrl = URL.createObjectURL(blob)
  return { blobUrl, mimeType, revoke: () => URL.revokeObjectURL(blobUrl) }
}



/**
 * 查询空间容量（进度条数据）（GET /team-space/capacity）
 * @param {string} spaceId
 * @returns {Promise<{usedBytes: number, limitBytes: number, usedPercent: number, usedDisplay: string, limitDisplay: string}>}
 */
export async function getQuota(spaceId) {
  const res = await api.get(`${BASE}/team-space/capacity`, {
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

/**
 * 初始化上传任务（POST /team-files/transfer/init）
 * @returns {Promise<{taskId: string}>}
 */
async function initUpload(spaceId, file, parentId) {
  const dotIdx = file.name.lastIndexOf('.')
  const suffix = dotIdx > 0 ? file.name.slice(dotIdx + 1).toLowerCase() : ''
  const res = await api.post(
    `${BASE}/team-files/transfer/init`,
    {
      fileName: file.name,
      fileSize: file.size,
      mimeType: getMimeType(file),
      suffix,
      parentId: parentId ?? null,
      chunkSize: CHUNK_SIZE,
      chunkCount: Math.ceil(file.size / CHUNK_SIZE),
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 秒传检测（POST /team-files/transfer/check）
 * @returns {Promise<{instantTransfer: boolean, fileId?: string}>}
 */
async function checkUpload(spaceId, taskId, contentMd5) {
  const res = await api.post(
    `${BASE}/team-files/transfer/check`,
    { taskId, contentMd5 },
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 上传单个分片（POST /team-files/transfer/chunk）
 */
async function uploadChunk(spaceId, taskId, chunkIndex, chunk, chunkMd5) {
  const form = new FormData()
  form.append('file', chunk, `chunk_${chunkIndex}`)
  form.append('taskId', taskId)
  form.append('chunkIndex', String(chunkIndex))
  form.append('chunkMd5', chunkMd5)
  await api.post(`${BASE}/team-files/transfer/chunk`, form, {
    headers: {
      ...bizHeaders(spaceId),
      'Content-Type': 'multipart/form-data',
    },
  })
}

/**
 * 查询已上传分片序号（GET /team-files/transfer/chunks/{taskId}）
 * @returns {Promise<number[]>} 已成功上传的分片序号数组
 */
async function getUploadedChunks(spaceId, taskId) {
  const res = await api.get(`${BASE}/team-files/transfer/chunks/${taskId}`, {
    headers: bizHeaders(spaceId),
  })
  return res.data ?? res
}

/**
 * 合并分片（POST /team-files/transfer/merge/{taskId}）
 * @returns {Promise<TeamFileInfo>}
 */
async function mergeChunks(spaceId, taskId) {
  const res = await api.post(
    `${BASE}/team-files/transfer/merge/${taskId}`,
    {},
    { headers: bizHeaders(spaceId) },
  )
  return res.data ?? res
}

/**
 * 上传文件（分片流程：init → check → chunk(s) → merge）
 * @param {string} spaceId
 * @param {File} file
 * @param {string|null} parentId
 * @param {function} onProgress  可选进度回调 (percent: number) => void
 * @returns {Promise<TeamFileInfo>}
 */
export async function uploadFile(spaceId, file, parentId = null, onProgress) {
  // 1. 初始化任务
  const initResult = await initUpload(spaceId, file, parentId)
  const taskId = initResult.taskId ?? initResult

  // 2. 计算整体 MD5，检测秒传
  const contentMd5 = await calcFileMd5(file)
  const checkResult = await checkUpload(spaceId, taskId, contentMd5)
  if (checkResult.instantTransfer) {
    // 秒传成功，直接返回文件信息
    return checkResult
  }

  // 3. 逐片上传
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const chunkMd5 = await calcChunkMd5(chunk)
    await uploadChunk(spaceId, taskId, i, chunk, chunkMd5)
    if (onProgress) onProgress(Math.round(((i + 1) / chunkCount) * 90))
  }

  // 4. 轮询已上传分片数，直到与预期一致再合并（最多等 30s）
  const POLL_INTERVAL = 1000
  const POLL_MAX = 30
  let uploadedIndexes = []
  for (let attempt = 0; attempt < POLL_MAX; attempt++) {
    uploadedIndexes = await getUploadedChunks(spaceId, taskId)
    if (Array.isArray(uploadedIndexes) && uploadedIndexes.length === chunkCount) break
    if (attempt < POLL_MAX - 1) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    }
  }
  if (!Array.isArray(uploadedIndexes) || uploadedIndexes.length !== chunkCount) {
    throw new Error(
      `分片校验超时：预期 ${chunkCount} 片，服务端已收到 ${Array.isArray(uploadedIndexes) ? uploadedIndexes.length : 0} 片`
    )
  }

  // 5. 合并分片
  const result = await mergeChunks(spaceId, taskId)
  if (onProgress) onProgress(100)
  return result
}

// ─── 云端文件树（统一接口）────────────────────────────────────────────────────

/**
 * 云端文件树懒加载
 * POST /cloud-files/tree
 * @param {string} nodeId  要展开的节点ID（root / category_person / category_team / team_root:{bizId} / dir:{type}:{bizId}:{fileId}）
 * @param {string} personBizId  个人文件的 businessId（我的分身 roomId）
 * @param {Array<{bizId: string, name: string}>} teams  协作团队列表
 * @returns {Promise<CloudFileNodeVO[]>}
 */
export async function getCloudFileTree(nodeId, personBizId, teams) {
  const userStore = useUserStore()
  const imConnectionStore = useImConnectionStore()
  const env = getOneEnv()
  const accessToken = userStore.userInfo?.access_token
  const userId = userStore.userInfo?.userId
  const userName = userStore.userInfo?.userName || userStore.userInfo?.username
  const imUserId = imConnectionStore.userId

  // personBizId 为空时从 chatStore 兜底获取（Matrix 连接完成前 currentRoomId 可能为 null）
  const resolvedPersonBizId = personBizId || chatStore.resolvePersonalRoomId() || ''

  const res = await api.post(
    `${BASE}/cloud-files/tree`,
    { nodeId, personBizId: resolvedPersonBizId, teams: teams ?? [] },
    {
      headers: {
        'X-Env': env,
        ...(userId ? { 'X-User-Id': userId } : {}),
        ...(userName ? { 'X-User-Name': userName } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(imUserId ? { 'X-Bind-Im-User-Id': imUserId } : {}),
      }
    }
  )
  const data = res.data ?? res
  return data?.children ?? (Array.isArray(data) ? data : [])
}

// ─── 默认导出 ────────────────────────────────────────────────────────────────
export const teamFileService = {
  listFiles,
  listDirs,
  getPath,
  createDirectory,
  renameFile,
  deleteFiles,
  getDownloadUrl,
  uploadFile,
  moveFile,
  batchSort,
  saveFromUrl,
  batchGetRefs,
  getPreviewUrl,
  getFileUrl,
  fetchPreviewBlob,
  getQuota,
}
