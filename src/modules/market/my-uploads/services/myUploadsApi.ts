import api, { getSsoToken } from '@/shared/services/api'
import type {
  AgentItem,
  AgentDetail,
  SkillItem,
  SkillDetail,
  SkillBrief,
  AgentBrief,
  ListParams,
  ListResponse,
  ApiResponse,
  FileUploadResult,
  FileUploadType,
  AgentValidateResult,
  SkillValidateResult,
  AgentCreateData,
  AgentUpdateData,
  SkillCreateData,
  SkillUpdateData,
  VisibilityResult,
  ValidationStep,
  ProviderConfig,
} from '../types'
import mockAvatarUrl from '../assets/touxiang.svg'
import { IS_DEMO } from '@/shared/utils/buildMode'
import { mockFetchAgentList } from '@/dev-mocks/data/market-agents'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

  // const HUB = '/assistant/agenthub'
const HUB = '/kooky-api'

function authHeaders(extra?: Record<string, string>) {
  const token = getSsoToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

// ==================== 文件上传 ====================

export async function uploadFile(file: File, type: FileUploadType = 'package'): Promise<FileUploadResult> {
  if (USE_MOCK) return mockUploadFile(file)
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(`${HUB}/api/v1/files/upload?type=${type}`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    timeout: 0, // 覆盖 api 默认 15s，避免大包上传被中断
  })
  return res.data
}

// ==================== Agent 接口 ====================

export async function fetchMyAgents(params: ListParams = {}): Promise<ListResponse<AgentItem>> {
  if (USE_MOCK) return mockAgentList(params)
  if (IS_DEMO) {
    // demo：复用数字人市场 mock，取前 2 个当作「我发布的」（已发布）
    const r = mockFetchAgentList({ page: params.page, pageSize: params.pageSize, search: (params as any).search, tag: (params as any).tag })
    const items = (r.items || []).slice(0, 2).map((it: any) => ({ ...it, slug: '', status: 'online', statusTag: '已发布' }))
    return { results: items, pagination: { ...r.pagination, total: items.length, totalPages: 1, hasMore: false } } as any
  }
  const { status, ...restParams } = params
  const queryParams: Record<string, any> = { page: 1, pageSize: 20, ...restParams }
  // 只有非 'all' 的状态才传递给后端
  if (status && status !== 'all') {
    queryParams.status = status
  }
  const res = await api.get(`${HUB}/api/v1/agents-kc/my`, {
    params: queryParams,
    headers: authHeaders(),
  })
  // 新接口返回结构：{ items, pagination: { page, pageSize, total, totalPages, hasMore }, nextCursor }
  const body = res?.data ?? res
  const results = body?.items ?? body?.agents ?? body?.results ?? []
  const pagination = body?.pagination ?? {
    page: body?.page ?? queryParams.page,
    pageSize: body?.pageSize ?? body?.limit ?? queryParams.pageSize,
    total: body?.total ?? 0,
    totalPages: body?.totalPages,
    hasMore: body?.hasMore,
  }
  return { results, pagination }
}

export async function fetchAgentById(id: number): Promise<AgentDetail> {
  if (USE_MOCK) return mockAgentDetail(id)
  const res = await api.get(`${HUB}/api/v1/agents/${id}`, { headers: authHeaders() })
  return res.data
}

export async function validateAgent(file: File): Promise<AgentValidateResult> {
  if (USE_MOCK) return mockValidateAgent()
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(`${HUB}/api/v1/agents/validate-package`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    timeout: 0, // 覆盖 api 默认 15s，避免大包上传被中断
  })
  return res.data
}

export async function createAgent(data: AgentCreateData): Promise<any> {
  if (USE_MOCK) return mockCreateAgent(data)
  const res = await api.post(`${HUB}/api/v1/agents`, data, {
    headers: authHeaders()
  })
  return res.data
}

export async function updateAgent(id: number, data: AgentUpdateData): Promise<any> {
  if (USE_MOCK) return { id, updatedAt: new Date().toISOString() }
  const res = await api.put(`${HUB}/api/v1/agents/${id}`, data, {
    headers: authHeaders()
  })
  return res.data
}

export async function deleteAgent(id: number): Promise<{ success: boolean }> {
  if (USE_MOCK) return { success: true }
  const res = await api.delete(`${HUB}/api/v1/agents/${id}`, {
    headers: authHeaders()
  })
  return res.data
}

export async function setAgentVisibility(id: number, isPublic: boolean): Promise<VisibilityResult> {
  if (USE_MOCK) return { success: true, isPublic }
  const res = await api.patch(`${HUB}/api/v1/agents/${id}/visibility`, { isPublic }, {
    headers: authHeaders()
  })
  return res.data
}

/**
 * 收藏 Agent：POST /api/v1/stars/{slug}
 * 取消收藏 Agent：DELETE /api/v1/stars/{slug}
 */
export async function followAgent(id: number | string, isFollowed: boolean): Promise<{ success: boolean; isFollowed: boolean }> {
  if (USE_MOCK) return { success: true, isFollowed }
  const s = encodeURIComponent(String(id))
  if (isFollowed) {
    // 收藏
    const res = await api.post(`${HUB}/api/v1/stars/${s}`, null, {
      headers: authHeaders()
    })
    return res.data
  } else {
    // 取消收藏
    const res = await api.delete(`${HUB}/api/v1/stars/${s}`, {
      headers: authHeaders()
    })
    return res.data
  }
}

// ==================== Skill 接口 ====================

export async function fetchMySkills(params: ListParams = {}): Promise<ListResponse<SkillItem>> {
  if (USE_MOCK) return mockSkillList(params)
  const { status, ...restParams } = params
  const queryParams: Record<string, any> = { page: 1, pageSize: 20, includeInstallStatus: true, ...restParams }
  // 只有非 'all' 的状态才传递给后端
  if (status && status !== 'all') {
    queryParams.status = status
  }
  const res = await api.get(`${HUB}/api/v1/my/skills`, {
    params: queryParams,
    headers: authHeaders()
  })
  // API 返回 { status, message, data: { pagination, results/items } }
  // res = { status, message, data: { pagination, results } }
  // res.data = { pagination, results }
  const body = res?.data ?? res

  // 兼容 results 和 items 两种返回格式
  const rawResults = body?.results ?? body?.items ?? []

  // 映射新 API 数据结构到 SkillItem 格式
  const results = rawResults.map((item: any) => mapSkillItem(item))

  return {
    results,
    pagination: body?.pagination ?? {},
  }
}

/**
 * 映射新 API 数据结构到 SkillItem 格式
 * 新 API 返回：
 * - tags: { latest: "version" } 对象格式
 * - stats: { downloads, stars } 嵌套对象
 * - author: { handle, displayName, image } 对象
 */
function mapSkillItem(raw: any): SkillItem {
  const item: any = { ...raw }

  // 处理 tags：新 API 返回对象 { latest: "version" }，转换为数组
  if (raw?.tags && typeof raw.tags === 'object' && !Array.isArray(raw.tags)) {
    item.tags = Object.keys(raw.tags)
  }

  // 处理 stats：从嵌套对象提取到顶层
  if (raw?.stats && typeof raw.stats === 'object') {
    item.statsDownloads = raw.stats.downloads ?? 0
    item.statsStars = raw.stats.stars ?? 0
    item.downloads = raw.stats.downloads ?? 0
    item.stars = raw.stats.stars ?? 0
  }

  // 处理 author：确保 displayName 存在
  if (raw?.author && typeof raw.author === 'object') {
    item.author = raw.author
  }

  // 处理封面图：兼容多种字段名
  item.avatar = raw?.avatar ?? raw?.image ?? raw?.latestVersion?.icon ?? raw?.author?.image ?? ''

  // 处理 isStarred/isFollowed 兼容：同时保留两个字段名
  if (raw?.isStarred !== undefined) {
    item.isFollowed = raw.isStarred
    item.isStarred = raw.isStarred
  }
  if (raw?.isFollowed !== undefined && item.isStarred === undefined) {
    item.isStarred = raw.isFollowed
  }

  return item as SkillItem
}

export async function fetchSkillBySlug(slug: string): Promise<SkillDetail> {
  if (USE_MOCK) return mockSkillDetail(slug)
  const res = await api.get(`${HUB}/api/v1/skills/${slug}`, {
    headers: authHeaders()
  })
  return res.data
}

/**
 * Skill 详情（前端）：GET /api/v1/skills/{slug}/detail
 * - `version` 查询参数可选，不传则服务端返回最新版本语义
 */
export async function fetchSkillDetail(slug: string, version?: string): Promise<unknown> {
  if (USE_MOCK) {
    const flat = { ...((await mockSkillDetail(slug)) as unknown as Record<string, unknown>) }
    const ent = { ...flat } as Record<string, unknown>
    if (version && Array.isArray(ent.versionHistory)) {
      const row = (ent.versionHistory as { version?: string }[]).find((v) => v.version === version)
      ent.version = version
      if (row && typeof (row as { changelog?: string }).changelog === 'string') {
        ent.changelog = (row as { changelog: string }).changelog
      }
    }
    return { entity: ent }
  }
  const res = await api.get(`${HUB}/api/v1/skills/${encodeURIComponent(slug)}/detail`, {
    params: version ? { version } : {},
    headers: authHeaders(),
  })
  return res.data
}

export async function fetchSkillById(id: number): Promise<SkillDetail> {
  if (USE_MOCK) return mockSkillDetail(`skill-${id}`)
  const res = await api.get(`${HUB}/api/v1/skills/${id}`, {
    headers: authHeaders()
  })
  return res.data
}

export async function validateSkill(file: File): Promise<SkillValidateResult> {
  if (USE_MOCK) return mockValidateSkill()
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(`${HUB}/api/v1/skills/validate`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    timeout: 0, // 覆盖 api 默认 15s，避免大包上传被中断
  })
  return res.data
}

export async function createSkill(data: SkillCreateData): Promise<any> {
  if (USE_MOCK) return mockCreateSkill(data)
  // 使用 multipart/form-data 格式，payload 作为 JSON 字段
  const formData = new FormData()
  formData.append('payload', JSON.stringify(data))
  const res = await api.post(`${HUB}/api/v1/skills`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' })
  })
  return res.data
}

export interface MultipartMeta {
  slug?: string
  displayName?: string
  version?: string
  changelog?: string | null
  acceptLicenseTerms?: boolean
  description?: string
  tags?: string[]
  /** 封面图，对应 web 示例中的 avatar 字段 */
  avatar?: string | null
  image?: string | null
  scope?: string
  official?: boolean
  /** 是否发布：保存并发布时传 true */
  publish?: boolean
  /** 上传新版本时关联的已有 Skill ID */
  skillId?: number | string
}

function buildMultipartFormData(
  file: File,
  meta: MultipartMeta & Record<string, any>,
): FormData {
  const formData = new FormData()
  // 将所有元数据序列化为 payload JSON 字段（与 web 端保持一致）
  const payload: Record<string, any> = {}
  if (meta.slug != null) payload.slug = meta.slug
  if (meta.displayName != null) payload.displayName = meta.displayName
  if (meta.version != null) payload.version = meta.version
  payload.changelog = meta.changelog ?? null
  payload.acceptLicenseTerms = meta.acceptLicenseTerms ?? true
  if (meta.description != null) payload.description = meta.description
  if (meta.tags != null) payload.tags = meta.tags
  payload.avatar = meta.avatar ?? meta.image ?? null
  if (meta.scope != null) payload.scope = meta.scope
  if (meta.official != null) payload.official = meta.official
  if (meta.publish != null) payload.publish = meta.publish
  // 将 meta 中其余自定义字段（如 name、skills 等）也合并进 payload
  const reservedKeys = new Set(['slug', 'displayName', 'version', 'changelog', 'acceptLicenseTerms', 'description', 'tags', 'avatar', 'image', 'scope', 'official', 'publish'])
  for (const [k, v] of Object.entries(meta)) {
    if (!reservedKeys.has(k) && v != null) payload[k] = v
  }
  formData.append('payload', JSON.stringify(payload))
  formData.append('files', file, file.name)
  return formData
}

export async function createSkillMultipart(file: File, meta: MultipartMeta): Promise<any> {
  if (USE_MOCK) return mockCreateSkill(meta as any)
  const formData = buildMultipartFormData(file, meta)
  const res = await api.post(`${HUB}/api/v1/skills`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    timeout: 0,
  })
  return res.data
}

export async function createAgentMultipart(
  file: File,
  meta: MultipartMeta & { name?: string; skills?: string[]; simulatedConversationUrl?: string; modelCode?: string; model_config?: Record<string, any>; prompts?: Array<{ title: string; subtitle: string; content: string; icon?: string }>; skillsInfo?: any[] },
): Promise<any> {
  if (USE_MOCK) return mockCreateAgent(meta as any)
  const formData = buildMultipartFormData(file, meta)
  const res = await api.post(`${HUB}/api/v1/agents/create-from-package`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    timeout: 0,
  })
  return res.data
}

export async function updateSkill(slug: string, data: SkillUpdateData): Promise<any> {
  if (USE_MOCK) return { slug, updatedAt: new Date().toISOString() }
  const res = await api.put(`${HUB}/api/v1/skills/${slug}`, data, {
    headers: authHeaders()
  })
  return res.data
}

/**
 * 编辑 Skill 版本：PUT /api/v1/skills/{slug}
 * payload 以 JSON 字段放入 multipart/form-data
 */
export async function updateSkillMultipart(slug: string, payload: Record<string, any>): Promise<any> {
  const formData = new FormData()
  formData.append('payload', JSON.stringify(payload))
  const res = await api.put(`${HUB}/api/v1/skills/${encodeURIComponent(slug)}`, formData, {
    headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
  })
  return res.data
}

export async function deleteSkill(id: number): Promise<{ success: boolean }> {
  if (USE_MOCK) return { success: true }
  const res = await api.delete(`${HUB}/api/v1/skills/${id}`, {
    headers: authHeaders()
  })
  return res.data
}

/**
 * 删除整个 Skill（所有版本）：DELETE /api/v1/skills/{slug}
 * Authorization 由 authHeaders() 注入 Bearer token
 */
export async function deleteSkillBySlug(slug: string): Promise<{ success?: boolean }> {
  if (USE_MOCK) return { success: true }
  const res = await api.delete(`${HUB}/api/v1/skills/${encodeURIComponent(slug)}`, {
    headers: authHeaders(),
  })
  return res.data
}

/**
 * 移除指定历史版本：DELETE /api/v1/skills/{slug}/versions?id={versionId}
 * Authorization 由 authHeaders() 注入 Bearer token
 */
export async function deleteSkillVersion(slug, versionId): Promise<{ success?: boolean }> {
  if (USE_MOCK) return { success: true }
  const res = await api.delete(
    `${HUB}/api/v1/skills/${encodeURIComponent(slug)}/versions`,
    {
      params: { id: versionId },
      headers: authHeaders(),
    },
  )
  return res.data
}

/**
 * PATCH /api/v1/skills/{slug}/visibility
 * - 路径中的 slug 与详情接口一致时取实体 `name`（包标识）
 * - body：`isPublic`，可选 `versionId` 指定版本历史中的版本 id
 */
export async function setSkillVisibility(
  slug: string,
  isPublic: boolean,
  versionId?: number | null,
): Promise<VisibilityResult> {
  if (USE_MOCK) return { success: true, isPublic }
  const body: { isPublic: boolean; versionId?: number } = { isPublic }
  if (versionId != null && !Number.isNaN(Number(versionId))) {
    body.versionId = Number(versionId)
  }
  const res = await api.patch(
    `${HUB}/api/v1/skills/${encodeURIComponent(slug)}/visibility`,
    body,
    {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    },
  )
  return res.data
}

/**
 * 收藏 Skill：POST /api/v1/stars/{slug}
 * 取消收藏 Skill：DELETE /api/v1/stars/{slug}
 */
export async function followSkill(slug: string, isFollowed: boolean): Promise<{ success: boolean; isFollowed: boolean }> {
  if (USE_MOCK) return { success: true, isFollowed }
  const s = encodeURIComponent(slug)
  if (isFollowed) {
    // 收藏
    const res = await api.post(`${HUB}/api/v1/stars/${s}`, null, {
      headers: authHeaders()
    })
    return res.data
  } else {
    // 取消收藏
    const res = await api.delete(`${HUB}/api/v1/stars/${s}`, {
      headers: authHeaders()
    })
    return res.data
  }
}

// ==================== 上传流程串联（直接校验，不再分步上传） ====================

export async function uploadAndValidatePackage(
  file: File,
  type: 'agent' | 'skill',
): Promise<{ validate: AgentValidateResult | SkillValidateResult }> {
  const validate = type === 'agent'
    ? await validateAgent(file)
    : await validateSkill(file)
  return { validate }
}

// ==================== 导出校验步骤类型 ====================
export type { ValidationStep }

// ==================== Mock 数据 ====================

const mockAuthor = { id: 21, name: 'ydshu', displayName: '舒锐东', avatarUrl: '' }

function delay<T>(data: T, ms = 1500): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), ms))
}

function mockUploadFile(_file: File): Promise<FileUploadResult> {
  return delay({
    success: true,
    ossUrl: 'https://oss.example.com/packages/test-package.zip',
    fileMd5: 'a1b2c3d4e5f678901234567890',
    fileName: _file.name,
    fileSize: _file.size,
    fileType: 'application/zip',
    uploadedAt: new Date().toISOString(),
  }, 2000)
}

function mockValidateAgent(): Promise<AgentValidateResult> {
  return delay({
    success: true,
    packageName: 'test-agent',
    displayName: '测试 Agent',
    version: '1.0.0',
    description: '这是一个测试 Agent',
    capabilities: ['脚本生成', '用例设计'],
    tags: ['测试', '示例'],
    // ossUrl 和 fileMd5 不再需要，后端已融合上传和校验
    isVersionUpgrade: false,
    existingVersion: null,
    validatedAt: new Date().toISOString(),
    validationSteps: [
      { step: 'unzip_check', status: 'completed', message: '解压检查通过' },
      { step: 'security_scan', status: 'completed', message: '安全扫描通过' },
      { step: 'dependency_analysis', status: 'completed', message: '依赖分析完成' },
      { step: 'metadata_extract', status: 'completed', message: '元数据解析完成' },
    ],
  }, 2500)
}

function mockValidateSkill(): Promise<SkillValidateResult> {
  return delay({
    success: true,
    packageName: 'test-skill',
    displayName: '测试 Skill',
    version: '1.0.0',
    description: '这是一个测试 Skill',
    author: '测试用户',
    tags: ['测试', '工具'],
    // ossUrl 和 fileMd5 不再需要，后端已融合上传和校验
    storagePath: '/storage/skills/test-skill/1.0.0/package.zip',
    isVersionUpgrade: false,
    existingSkillId: null,
    validatedAt: new Date().toISOString(),
  }, 2500)
}

function mockCreateAgent(data: AgentCreateData): Promise<any> {
  return delay({ id: Date.now(), status: 'created', version: data.version || '1.0.0', isVersionUpgrade: false, createdAt: new Date().toISOString() })
}

function mockCreateSkill(data: any): Promise<any> {
  return delay({ slug: data.slug || 'test-skill', version: data.version || '1.0.0', storagePath: '/storage/skills/test-skill/1.0.0/package.zip' })
}

function mockListSearchMatch(q: string | undefined, parts: (string | undefined)[]): boolean {
  const needle = String(q ?? '').trim().toLowerCase()
  if (!needle) return true
  return parts.some((p) => String(p ?? '').toLowerCase().includes(needle))
}

function mockAgentList(params: ListParams): Promise<ListResponse<AgentItem>> {
  const { status = 'all', search } = params
  const all: AgentItem[] = [
    { id: 101, slug: 'customer-service-agent', displayName: '智能客服助手', version: '1.2.0', summary: '专业的客户服务数字人，支持多轮对话和情感识别', status: 'published', avatar: mockAvatarUrl, statsDownloads: 156, statsStars: 23, updatedAt: '2026-04-10T14:20:00Z' },
    { id: 102, slug: 'sales-assistant', displayName: '销售助理', version: '1.0.0', summary: '帮助销售团队提升效率的智能助手', status: 'draft', avatar: mockAvatarUrl, statsDownloads: 0, statsStars: 0, updatedAt: '2026-04-16T10:00:00Z' },
  ]
  let filtered = status === 'all' ? all : all.filter(i => i.status === status)
  filtered = filtered.filter((i) =>
    mockListSearchMatch(search, [i.slug, i.displayName, i.summary, i.version]),
  )
  return Promise.resolve({
    results: filtered,
    pagination: { page: params.page || 1, pageSize: params.pageSize || 20, total: filtered.length, totalPages: 1, hasMore: false },
  })
}

function mockSkillList(params: ListParams): Promise<ListResponse<SkillItem>> {
  const { status = 'all', search } = params
  const all: SkillItem[] = [
    { id: 201, slug: 'text-analysis-skill', displayName: '文本分析技能', version: '1.5.0', summary: '提供文本情感分析、关键词提取、摘要生成等 NLP 功能', status: 'published', avatar: mockAvatarUrl, statsDownloads: 234, statsStars: 45, updatedAt: '2026-04-12T11:30:00Z' },
    { id: 202, slug: 'image-processing', displayName: '图像处理', version: '1.0.0', summary: '图像识别、裁剪、滤镜、水印等图像处理功能集合', status: 'draft', avatar: mockAvatarUrl, statsDownloads: 0, statsStars: 0, updatedAt: '2026-04-15T14:00:00Z' },
  ]
  let filtered = status === 'all' ? all : all.filter(i => i.status === status)
  filtered = filtered.filter((i) =>
    mockListSearchMatch(search, [i.slug, i.displayName, i.summary, i.version]),
  )
  return Promise.resolve({
    results: filtered,
    pagination: { page: params.page || 1, pageSize: params.pageSize || 20, total: filtered.length, totalPages: 1, hasMore: false },
  })
}

function mockAgentDetail(_id: number): Promise<AgentDetail> {
  return Promise.resolve({
    id: 101, slug: 'customer-service-agent', displayName: '智能客服助手', version: '1.2.0',
    summary: '专业的客户服务数字人，支持多轮对话和情感识别', status: 'published' as const,
    avatar: mockAvatarUrl, statsDownloads: 156, statsStars: 23, isFollowed: false, updatedAt: '2026-04-10T14:20:00Z',
    name: 'customer-service-agent',
    description: '专业的客户服务数字人，支持多轮对话和情感识别，能够处理常见客户问题。',
    author: mockAuthor, tags: ['客服', '对话', 'AI'],
    downloadUrl: 'https://oss.example.com/packages/customer-service-agent.zip',
    skills: [
      { id: 301, slug: 'text-analysis-skill', displayName: '文本分析技能', summary: '提供文本情感分析、关键词提取等 NLP 功能', statsDownloads: 234, statsStars: 45, tags: ['NLP', '分析'], version: '1.5.0', author: mockAuthor },
      { id: 302, slug: 'sentiment-analysis', displayName: '情感分析', summary: '基于深度学习的情感分析能力', statsDownloads: 128, statsStars: 19, tags: ['AI', '情感'], version: '1.0.0', author: mockAuthor },
    ],
    versions: [
      { version: '1.2.0', releaseDate: '2026-04-10', changelog: '新增多轮对话能力\n优化情感识别准确率', reviewStatus: 'published', isCurrent: true, hireCount: 156 },
      { version: '1.1.0', releaseDate: '2026-03-20', changelog: '修复已知问题', reviewStatus: 'published', isCurrent: false, hireCount: 89 },
      { version: '1.0.0', releaseDate: '2026-03-15', changelog: '首次发布', reviewStatus: 'published', isCurrent: false, hireCount: 45 },
    ],
    createdAt: '2026-03-15T08:30:00Z',
  })
}

function mockSkillDetail(_slug: string): Promise<SkillDetail> {
  const versionHistory = [
    {
      id: 1,
      version: '2.1.0',
      ownerName: 'ppone',
      releaseDate: '2026-03-28',
      changelog: '改进：优化缺陷分析算法',
      reviewStatus: 'draft' as const,
      isCurrent: true,
      hireCount: 2,
      statsDownloads: 0,
      createdAt: Date.now(),
    },
    {
      id: 2,
      version: '2.0.9',
      ownerName: 'ppone',
      releaseDate: '2026-03-18',
      changelog: '新功能：Claude Desktop 插件支持',
      reviewStatus: 'reviewing' as const,
      isCurrent: false,
      hireCount: 5,
      statsDownloads: 0,
      createdAt: Date.now(),
    },
    {
      id: 3,
      version: '2.0.8',
      ownerName: 'ppone',
      releaseDate: '2026-03-10',
      changelog: '修复若干问题',
      reviewStatus: 'rejected' as const,
      isCurrent: false,
      hireCount: 0,
      rejectReason: '材料不全',
      statsDownloads: 0,
      createdAt: Date.now(),
    },
    {
      id: 4,
      version: '2.0.7',
      ownerName: 'ppone',
      releaseDate: '2026-02-01',
      changelog: '性能优化',
      reviewStatus: 'published' as const,
      isCurrent: false,
      hireCount: 12,
      statsDownloads: 0,
      createdAt: Date.now(),
    },
  ]
  return Promise.resolve({
    id: 201, slug: 'text-analysis-skill', displayName: '文本分析技能', version: '1.5.0',
    summary: '提供文本情感分析、关键词提取、摘要生成等 NLP 功能', status: 'published' as const,
    avatar: mockAvatarUrl, statsDownloads: 234, statsStars: 45, updatedAt: '2026-04-12T11:30:00Z',
    name: 'text-analysis-skill',
    description: '提供文本情感分析、关键词提取、摘要生成等 NLP 功能',
    detailedDescription: '功能强大的文本分析技能包，集成多种 NLP 算法。',
    author: mockAuthor, tags: ['NLP', '分析', '文本'], changelog: '修复若干已知问题\n优化性能表现',
    downloadUrl: 'https://oss.example.com/packages/text-analysis-skill.zip',
    agents: [
      { id: 101, slug: 'customer-service-agent', displayName: '智能客服助手', summary: '专业的客户服务数字人', statsDownloads: 156, statsStars: 23, tags: ['客服', '对话'], version: '1.2.0', author: mockAuthor },
    ],
    versionHistory,
    versions: versionHistory,
    createdAt: '2026-03-10T09:00:00Z',
  })
}

// ==================== Provider 配置 ====================

export async function fetchProviderConfigs(channel: string = 'kc-oc'): Promise<ProviderConfig[]> {
  const res: any = await api.get(`${HUB}/api/client/v1/provider-config/providers`, {
    params: { channel },
    headers: authHeaders(),
  })
  const list: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
  return list.map((p: any) => ({
    id: p.id ?? null,
    template_code: p.code ?? p.template_code ?? null,
    display_name: p.name ?? p.display_name ?? '',
    icon_url: p.icon_url ?? null,
    is_builtin: p.is_builtin ?? false,
    is_custom: p.is_custom ?? false,
    is_selected: p.is_selected ?? false,
    models: Array.isArray(p.default_models)
      ? p.default_models.map((m: any) => ({
          id: m.id ?? 0,
          model_name: m.model_name ?? '',
          model_code: m.model_code ?? '',
          is_selected: m.is_selected ?? false,
        }))
      : Array.isArray(p.models) ? p.models : [],
  }))
}

// ==================== Prompt 图标 ====================

export async function fetchPromptIcons(): Promise<string[]> {
  const res: any = await api.get(`${HUB}/api/admin/v1/public-biz-avatar/list`, {
    params: { biz_type: 'agent_prompt_icon' },
    headers: authHeaders(),
  })
  const list = res?.data
  return Array.isArray(list) ? list.map((item: any) => item.avatar_url).filter(Boolean) : []
}

// ==================== 数字人头像 ====================

export async function fetchAgentAvatars(): Promise<string[]> {
  const res: any = await api.get(`${HUB}/api/admin/v1/public-biz-avatar/list`, {
    params: { biz_type: 'agent_icon' },
    headers: authHeaders(),
  })
  const list = res?.data
  return Array.isArray(list) ? list.map((item: any) => item.avatar_url).filter(Boolean) : []
}

// ==================== 数字人版本编辑 ====================

export async function fetchAgentDetailByVersion(agentId: number, versionId: number): Promise<any> {
  const res: any = await api.get(`${HUB}/api/v1/agents/${agentId}/detail/${versionId}`, {
    headers: authHeaders(),
    params: { marketplace: false },
  })
  return res?.data || res
}

export interface AgentVersionEditData {
  avatar?: string
  display_name?: string
  model_config?: Record<string, any>
  description?: string
  tags?: string[]
  change_log?: string
  prompts?: Array<{ title: string; subtitle: string; content: string; icon?: string }>
  scope?: 'private' | 'market'
}

export async function editAgentVersion(agentId: number, versionId: number, data: AgentVersionEditData): Promise<any> {
  const res: any = await api.put(`${HUB}/api/v1/agents/${agentId}/edit/${versionId}`, data, {
    headers: authHeaders(),
  })
  return res?.data || res
}

// ==================== Skill 图标 ====================

export async function fetchSkillIcons(): Promise<string[]> {
  const res: any = await api.get(`${HUB}/api/admin/v1/public-biz-avatar/list`, {
    params: { biz_type: 'skill_icon' },
    headers: authHeaders(),
  })
  const list = res?.data
  return Array.isArray(list) ? list.map((item: any) => item.avatar_url).filter(Boolean) : []
}
