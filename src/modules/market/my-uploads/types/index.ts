/**
 * 我的上传模块 - 类型定义（对齐真实 API 文档）
 */

/** 对话模型 */
export interface ProviderModel {
  id: number
  model_name: string
  model_code: string
  is_selected: boolean
}

/** 对话模型提供商配置 */
export interface ProviderConfig {
  id: number | null
  template_code: string | null
  display_name: string
  icon_url: string | null
  is_builtin: boolean
  is_custom: boolean
  is_selected: boolean
  models: ProviderModel[]
}

/** API 统一响应格式 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

/** 分页信息 */
export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

/** 列表响应数据 */
export interface ListResponse<T> {
  results: T[]
  pagination: Pagination
}

/** 列表查询参数 */
export interface ListParams {
  page?: number
  pageSize?: number
  status?: StatusFilter
  /** 模糊匹配名称、显示名、描述、标签等（后端 GET my/skills | my/agents 可选参数） */
  search?: string
}

/** Agent 列表项（对齐市场接口 GET /api/v1/agents/market 与 GET /api/v1/agents/my 响应） */
export interface AgentItem {
  id: number
  slug: string
  displayName: string
  name?: string
  version?: string
  summary: string
  status: 'draft' | 'published'
  avatar?: string
  avatar_url?: string
  /** 安装量（新结构字段，对齐市场接口） */
  installCount?: number
  /** 下载量（旧结构兼容字段） */
  statsDownloads?: number
  statsStars?: number
  isFollowed?: boolean
  isInstalled?: boolean
  official?: boolean
  author?: {
    id?: number
    displayName?: string
    avatar?: string
  }
  tags?: string[]
  capabilities?: string[]
  latestVersion?: {
    id?: number
    version?: string
  }
  updatedAt?: string
}

/** Skill 列表项（对齐 GET /api/v1/my/skills 响应） */
export interface SkillItem {
  id: number
  slug: string
  displayName: string
  version: string
  summary: string
  status: 'draft' | 'published'
  avatar: string
  avatar_url?: string
  statsDownloads: number
  statsStars: number
  isFollowed?: boolean
  isInstalled?: boolean
  installedVersion?: string
  tags?: string[]
  updatedAt: string
  statusLabel?: string
  statusColor?: string
  statusBgColor?: string
}

// ==================== 文件上传 ====================

/** 文件上传类型 */
export type FileUploadType = 'avatar' | 'demo' | 'package' | 'general'

/** 文件上传响应 */
export interface FileUploadResult {
  success: boolean
  ossUrl: string
  fileMd5: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedAt: string
}

// ==================== Agent 校验 & CRUD ====================

/** 校验步骤 */
export interface ValidationStep {
  step: string
  status: 'completed' | 'failed' | 'skipped'
  message: string
}

/** Skill 信息（来自 validate-package 接口的 skillsInfo 字段） */
export interface SkillInfoItem {
  id: string
  name: string
  description: string
  icon: string
}

/** Agent 校验结果 */
export interface AgentValidateResult {
  success: boolean
  packageName?: string
  displayName?: string
  version?: string
  description?: string
  capabilities?: string[]
  tags?: string[]
  ossUrl?: string
  fileMd5?: string
  isVersionUpgrade?: boolean
  existingVersion?: string | null
  validatedAt?: string
  validationSteps: ValidationStep[]
  skills?: string[]
  skillsInfo?: SkillInfoItem[]
}

/** Skill 校验结果 */
export interface SkillValidateResult {
  success: boolean
  packageName?: string
  displayName?: string
  version?: string
  description?: string
  author?: string
  tags?: string[]
  ossUrl?: string
  fileMd5?: string
  storagePath?: string
  isVersionUpgrade?: boolean
  existingSkillId?: number | null
  validatedAt?: string
  error?: string
}

/** 对话模型配置（传给后端的 model_config 结构） */
export interface ModelConfig {
  llm_channel: string
  llm_model_config_id: number | null
  llm_provider_config_id: number
}

/** 创建 Agent 请求体 */
export interface AgentCreateData {
  name: string
  displayName: string
  description: string
  version: string
  ossUrl?: string
  fileMd5?: string
  image?: string
  detailedDescription?: string
  capabilities?: string[]
  skills?: string[]
  tags?: string[]
  functions?: string[]
  scope?: string
  scenarios?: string[]
  riskLevel?: string
  official?: boolean
  isPublished?: boolean,
  changelog?: string
  simulatedConversationUrl?: string
  modelCode?: string
  model_config?: ModelConfig
  prompts?: Array<{ title: string; subtitle: string; content: string; icon?: string }>
  skillsInfo?: SkillInfoItem[]
  agentId?: number
  agent_id?: number
}

/** 更新 Agent 请求体 */
export interface AgentUpdateData {
  displayName?: string
  description?: string
  detailedDescription?: string
  version?: string
  image?: string
  ossUrl?: string
  fileMd5?: string
  capabilities?: string[]
  skills?: string[]
  tags?: string[]
  functions?: string[]
  scope?: string
  scenarios?: string[]
  riskLevel?: string
  isPublished?: boolean
  official?: boolean,
  changelog?: string
  simulatedConversationUrl?: string
  modelCode?: string
  model_config?: ModelConfig
  prompts?: Array<{ title: string; subtitle: string; content: string; icon?: string }>
  skillsInfo?: SkillInfoItem[]
}

/** 创建 Skill 请求体（JSON 格式） */
export interface SkillCreateData {
  slug: string
  displayName: string
  description: string
  detailedDescription?: string
  version: string
  official: boolean
  changelog?: string
  tags?: string[]
  acceptLicenseTerms: boolean
  /** 封面 / 图标 URL（与 Agent 创建字段 image 一致） */
  image?: string
  files?: { path: string; content: string }[]
  /** 后端架构调整：上传和校验已融合，不再需要这些字段 */
  // fileMd5?: string
  // ossUrl?: string
  /** 作用域：private=草稿，market=待审核 */
  scope?: 'private' | 'market'
  /** 是否发布：保存并发布时传 true */
  publish?: boolean
  /** 上传新版本时关联的已有 Skill ID */
  skillId?: number | string
}

/** 更新 Skill 请求体 */
export interface SkillUpdateData {
  displayName?: string
  summary?: string
  detailedDescription?: string
  tags?: string[]
  /** 作用域：private=草稿，market=待审核 */
  scope?: 'private' | 'market'
  /** 是否发布：保存并发布时传 true */
  publish?: boolean
}

/** 可见性设置结果 */
export interface VisibilityResult {
  success: boolean
  isPublic: boolean
}

// ==================== 详情相关 ====================

/** 作者信息 */
export interface Author {
  id: number
  name: string
  displayName: string
  avatarUrl: string
}

/** 关联 Skill 简要信息（Agent 详情中） */
export interface SkillBrief {
  id: number
  slug: string
  displayName: string
  summary: string
  statsDownloads: number
  statsStars: number
  tags: string[]
  version: string
  author: Author
}

/** Agent 版本信息 */
export interface AgentVersion {
  id: number
  version: string
  statsDownloads: number
  createdAt: number
  ownerName: string
  releaseDate?: string
  changelog?: string
  reviewStatus?: 'published' | 'reviewing' | 'rejected' | 'draft'
  isCurrent?: boolean
  hireCount?: number
  rejectReason?: string
  /** 状态标签（中文） */
  statusLabel?: string
  /** 状态颜色 */
  statusColor?: string
  /** 状态背景颜色 */
  statusBgColor?: string
}

/** Agent 详情 */
export interface AgentDetail extends AgentItem {
  name: string
  description: string
  author: Author
  tags: string[]
  downloadUrl: string
  simulatedConversationUrl?: string
  skills: SkillBrief[]
  historyVersion?: AgentVersion[]
  versions?: AgentVersion[]
  latestVersion?: {
    id: number
    version: string
    createdAt: number
  }
  createdAt: string
}

/** 关联 Agent 简要信息（Skill 详情中） */
export interface AgentBrief {
  id: number
  slug: string
  displayName: string
  summary: string
  statsDownloads: number
  statsStars: number
  tags: string[]
  version: string
  author: Author
}

/** Skill 详情 */
export interface SkillDetail extends SkillItem {
  name: string
  description: string
  detailedDescription: string
  author: Author
  tags: string[]
  changelog?: string
  downloadUrl: string
  agents: AgentBrief[]
  createdAt: string
  /** 版本历史（与 Agent 版本结构一致，含 ownerName / hireCount 等） */
  versionHistory?: AgentVersion[]
  versions?: AgentVersion[]
}

// ==================== UI 辅助类型 ====================

/** 视图模式 */
export type ViewMode = 'list' | 'grid'

/** 状态筛选（对齐后端 version_status 字段） */
export type StatusFilter = 'all' | 'active' | 'online_review' | 'draft' | 'rejected' | 'offline_review' | 'offline'

/** Tab 类型 */
export type TabType = 'agent' | 'skill'

/** 数字人表单模式 */
export type AvatarFormMode = 'create' | 'edit'

/** 数字人表单数据 */
export interface AvatarFormData {
  displayName: string
  name: string
  version: string
  tags: string[]
  description: string
  avatarUrl: string
  relatedSkillIds: number[]
  changelog: string
  modelCode: string
  prompts: Array<{ title: string; subtitle: string; content: string; icon?: string }>
  _uploadGate: string
}
