/**
 * Skill 市场 mock 数据
 *
 * 预置 8 个 skill 覆盖：产品 / 研发 / 测试 / 设计 / 运营 / 通用场景
 * 作者用我们的同事池，让市场看起来"团队产出"。
 *
 * 字段对照 SkillMarketView.mapSkillRow：
 *   slug, displayName, summary, tags, author{handle,displayName},
 *   stats{downloads,stars}, isStarred, isInstalled, latestVersion{version,changelog}
 */

// SVG 图标工厂：圆角矩形 + 居中 emoji
function emojiIcon(emoji, bg = '#F3F4F6') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' rx='12' fill='${bg}'/><text x='24' y='34' font-size='26' text-anchor='middle' font-family='Apple Color Emoji, Segoe UI Emoji, system-ui'>${emoji}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const RAW_SKILLS = [
  // ========== 内置 5 个分身预装 skill（演示用） ==========
  {
    slug: 'brainstorm',
    name: 'brainstorm',
    displayName: '头脑风暴',
    summary: '围绕一个主题快速展开发散思考，输出 5-8 个角度的想法清单 + 选项对比矩阵',
    tags: ['通用', '思考', '内置'],
    image: emojiIcon('💡', '#FEF3C7'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 2104, stars: 892 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '1.4.0', changelog: 'v1.4.0：新增对比矩阵；v1.3.0：自动归类' },
    createdAt: '2024-09-01',
    updatedAt: '2026-05-12',
  },
  {
    slug: 'doc-gen',
    name: 'doc-gen',
    displayName: '日报/周报生成',
    summary: '按你的结构出周报：本周完成 / 下周计划 / 风险提示，自动套用历史偏好',
    tags: ['内容生产', '周报', '日报', '内置'],
    image: emojiIcon('📅', '#DBEAFE'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 3520, stars: 1421 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '2.6.1', changelog: 'v2.6.1：周报模板升级；v2.6.0：支持述职报告' },
    createdAt: '2024-08-15',
    updatedAt: '2026-05-15',
  },
  {
    slug: 'deep-research',
    name: 'deep-research',
    displayName: '深度搜索',
    summary: '自动检索 + 多源比对 + 引用追溯，输出可追溯的 Markdown 研究报告',
    tags: ['搜索', '研究', '内置'],
    image: emojiIcon('🔍', '#E9D5FF'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 1893, stars: 765 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '3.2.0', changelog: 'v3.2.0：接入新检索源；v3.1.0：引用规范化' },
    createdAt: '2024-11-10',
    updatedAt: '2026-05-08',
  },
  {
    slug: 'pptx-gen',
    name: 'pptx-gen',
    displayName: 'PPT 生成',
    summary: '基于大纲或一句话需求生成可编辑的 .pptx 文件，自动套用主题、配图与排版',
    tags: ['内容生产', 'PPT', '内置'],
    image: emojiIcon('📊', '#FED7AA'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 2780, stars: 1108 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '1.8.2', changelog: 'v1.8.2：新增 6 套主题；v1.8.0：图标库扩充' },
    createdAt: '2025-01-20',
    updatedAt: '2026-05-10',
  },
  {
    slug: 'docx-gen',
    name: 'docx-gen',
    displayName: 'Word 文档生成',
    summary: '生成结构化 .docx：支持多级标题、表格、引用、目录与封面页',
    tags: ['内容生产', 'Word', '内置'],
    image: emojiIcon('📝', '#BFDBFE'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 2456, stars: 932 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '2.3.4', changelog: 'v2.3.4：目录自动同步；v2.3.0：模板扩展' },
    createdAt: '2024-12-05',
    updatedAt: '2026-05-13',
  },
  {
    slug: 'pm-toolkit',
    name: 'pm-toolkit',
    displayName: '产品经理工具箱',
    summary: 'PRD 撰写 / 需求评审 / 验收标准 / 竞品对比 / 用户旅程，一套产品全链路工具',
    tags: ['产品策划', 'PRD撰写', '内置'],
    image: emojiIcon('🧰', '#FFE4E6'),
    author: { handle: 'kooky-internal', displayName: '讯飞云+平台' },
    stats: { downloads: 3147, stars: 1289 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '4.1.0', changelog: 'v4.1.0：PRD 模板升级；v4.0.0：新增验收标准生成' },
    createdAt: '2024-07-20',
    updatedAt: '2026-05-14',
  },
  // ========== 团队同事产出的 skill（市场常驻） ==========
  {
    slug: 'prd-drafter',
    name: 'prd-drafter',
    displayName: 'PRD 起草助手',
    summary: '基于一句话需求，自动生成结构化 PRD 草稿（背景 / 目标 / 方案 / 风险 / 排期）。配合磐石需求库使用效果更佳。',
    tags: ['产品策划', 'PRD撰写', '效能研发'],
    author: { handle: 'yhzhang2', displayName: '张月华' },
    stats: { downloads: 268, stars: 84 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '2.4.0', changelog: 'v2.4.0：模板适配新需求；v2.3.0：接入磐石需求 ID 自动填充' },
    createdAt: '2025-09-10',
    updatedAt: '2026-04-20',
  },
  {
    slug: 'code-review',
    name: 'code-review',
    displayName: '代码 Review 助手',
    summary: '基于 diff 自动生成 PR Review 评论，重点检查可维护性、潜在 bug、性能问题。支持 Java / Python / Go / TypeScript。',
    tags: ['代码生成', 'Code Review', '效能研发'],
    author: { handle: 'qbhu', displayName: '胡勤彪' },
    stats: { downloads: 432, stars: 156 },
    isInstalled: true,
    isStarred: true,
    latestVersion: { version: '3.1.2', changelog: 'v3.1.2：优化 TypeScript 类型检查；v3.0.0：架构升级，支持长 diff' },
    createdAt: '2025-06-01',
    updatedAt: '2026-05-08',
  },
  {
    slug: 'unit-test-gen',
    name: 'unit-test-gen',
    displayName: '单元测试生成器',
    summary: '基于函数签名和上下文生成对应单元测试，覆盖正常路径 + 边界 + 异常分支。一键挂接 jest / pytest。',
    tags: ['自动化测试', '代码生成', '效能研发'],
    author: { handle: 'jbxu2', displayName: '徐俊保' },
    stats: { downloads: 198, stars: 62 },
    isInstalled: false,
    isStarred: false,
    latestVersion: { version: '1.5.0' },
    createdAt: '2025-12-12',
    updatedAt: '2026-03-15',
  },
  {
    slug: 'weekly-report',
    name: 'weekly-report',
    displayName: '周报整理助手',
    summary: '基于本周「完成 / 进行中 / 阻塞」三栏整理 Markdown 周报，自动套用团队模板。支持自定义日期范围。',
    tags: ['内容运营', '周报', '通用'],
    author: { handle: 'yrdeng2', displayName: '邓颖茹' },
    stats: { downloads: 521, stars: 213 },
    isInstalled: false,
    isStarred: true,
    latestVersion: { version: '4.0.0', changelog: 'v4.0.0：支持自定义周期；v3.5.0：加入 OKR 关联' },
    createdAt: '2025-03-20',
    updatedAt: '2026-05-01',
  },
  {
    slug: 'design-review',
    name: 'design-review',
    displayName: 'UI 设计稿走查',
    summary: '基于讯飞云+ Design System 自动走查设计稿，找出违规色 / 字号 / 间距 / 组件用法。',
    tags: ['用户体验', '视觉设计', 'Design System'],
    author: { handle: 'qlyun', displayName: '员清亮' },
    stats: { downloads: 87, stars: 31 },
    isInstalled: false,
    isStarred: false,
    latestVersion: { version: '1.2.0' },
    createdAt: '2026-01-08',
    updatedAt: '2026-04-12',
  },
  {
    slug: 'email-drafter',
    name: 'email-drafter',
    displayName: '邮件起草助手',
    summary: '给定收件人和要点，自动起草专业邮件，支持中英双语 + 调整语气（正式 / 友好 / 简洁）。',
    tags: ['内容生产', '通用'],
    author: { handle: 'minliu27', displayName: '刘敏' },
    stats: { downloads: 1024, stars: 489 },
    isInstalled: true,
    isStarred: false,
    latestVersion: { version: '5.2.1', changelog: '修复中英混排时换行错位' },
    createdAt: '2024-11-20',
    updatedAt: '2026-05-10',
  },
  {
    slug: 'meeting-notes',
    name: 'meeting-notes',
    displayName: '会议纪要整理',
    summary: '基于会议录音 / 文字记录自动提取关键决议、待办、责任人，输出标准纪要 Markdown。',
    tags: ['内容生产', '会议', '通用'],
    author: { handle: 'symeng7', displayName: '孟世一' },
    stats: { downloads: 367, stars: 142 },
    isInstalled: false,
    isStarred: false,
    latestVersion: { version: '2.0.0' },
    createdAt: '2025-08-05',
    updatedAt: '2026-04-25',
  },
  {
    slug: 'competitor-analysis',
    name: 'competitor-analysis',
    displayName: '竞品分析助手',
    summary: '给定竞品名单和分析维度，自动调研功能 / 定价 / 用户评价，输出对比矩阵 + 差异化建议。',
    tags: ['产品策划', '竞品分析'],
    author: { handle: 'yanhuang', displayName: '黄燕' },
    stats: { downloads: 156, stars: 48 },
    isInstalled: false,
    isStarred: false,
    latestVersion: { version: '1.0.3' },
    createdAt: '2026-02-18',
    updatedAt: '2026-05-05',
  },
]

export const SKILLS_RAW = RAW_SKILLS

/** 聚合 tags（去重 + 计数） */
export function aggregateSkillTags() {
  const map = new Map()
  for (const s of RAW_SKILLS) {
    for (const t of s.tags || []) {
      map.set(t, (map.get(t) || 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
}

/** mock fetchSkillMarketTags 返回 */
export function mockFetchSkillMarketTags() {
  return aggregateSkillTags()
}

/** mock fetchSkillMarketList 返回（支持基本的 search / tag / sort / isStarred 过滤） */
export function mockFetchSkillMarketList(params = {}) {
  let items = RAW_SKILLS.slice()

  if (params.search) {
    const q = String(params.search).toLowerCase()
    items = items.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        (s.tags || []).some((t) => String(t).toLowerCase().includes(q)),
    )
  }
  if (params.tag && params.tag !== 'all' && params.tag !== '') {
    items = items.filter((s) => (s.tags || []).includes(params.tag))
  }
  if (params.isStarred === true || params.isStarred === 'true') {
    items = items.filter((s) => s.isStarred)
  }
  if (params.isOfficial === true || params.isOfficial === 'true') {
    items = items.filter((s) => s.author?.handle === 'kooky-internal')
  }

  if (params.sort === 'stars') {
    items.sort((a, b) => (b.stats?.stars || 0) - (a.stats?.stars || 0))
  } else if (params.sort === 'downloads') {
    items.sort((a, b) => (b.stats?.downloads || 0) - (a.stats?.downloads || 0))
  } else if (params.sort === 'updated') {
    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }

  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 20
  const start = (page - 1) * pageSize
  const sliced = items.slice(start, start + pageSize)

  return {
    results: sliced,
    pagination: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
      hasMore: start + pageSize < items.length,
    },
  }
}

/** mock fetchSkillMarketDetail 返回 */
export function mockFetchSkillMarketDetail(slug) {
  const raw = RAW_SKILLS.find((x) => x.slug === slug)
  if (!raw) throw new Error(`skill ${slug} not found`)
  return {
    ...raw,
    detailedDescription:
      raw.summary + '\n\n这是一个内置示例 Skill，详细使用说明请联系作者。',
    functions: raw.summary,
    license: 'enterprise-internal',
    scope: '集团内',
    riskLevel: 'low',
  }
}

/** mock fetchSkillAgents：返回这个 skill 关联了哪些 agent（演示用） */
export function mockFetchSkillAgents(/* slug */) {
  return { results: [], pagination: { page: 1, pageSize: 20, total: 0 } }
}

// ============ 安装态 / 绑定态（按 slug+agentId 维度记忆，刷新即清）============

/**
 * 安装目标 kind：
 *   - 'persona'：我的分身（唯一目标，agentId='persona-self'）
 *   - 'digital-human'：我的数字员工（多个，agentId 来自 digital-humans 的 agent_id，数字）
 *   - 'kode'：Kode 终端（唯一目标，agentId='kode-cli'）
 */

const PERSONA_TARGET = {
  agentId: 'persona-self',
  agentName: 'persona-self',
  displayName: '我的分身',
  description: '基于我的人设、风格、上下文，代表我执行任务',
  kind: 'persona',
}

const KODE_TARGET = {
  agentId: 'kode-cli',
  agentName: 'kode-cli',
  displayName: 'Kode 终端',
  description: 'Kode 代码工作台里的 Claude，跑在本地终端',
  kind: 'kode',
}

// 用字符串当 key（不再 Number 化），这样 persona/kode 也能进 Set
// { [slug]: Set<string> }
const INSTALLED_BINDINGS = new Map()

function bindingKey(agentId) {
  return String(agentId ?? '').trim()
}

function getBindings(slug) {
  if (!INSTALLED_BINDINGS.has(slug)) INSTALLED_BINDINGS.set(slug, new Set())
  return INSTALLED_BINDINGS.get(slug)
}

// 预装：我的分身已装 5 个内置 skill + PRD 起草 + 邮件起草（贴合"产品负责人"人设）
;(function seedPersonaInstalls() {
  ;[
    'brainstorm',
    'doc-gen',
    'deep-research',
    'pptx-gen',
    'docx-gen',
    'pm-toolkit',
  ].forEach((slug) => {
    getBindings(slug).add(bindingKey(PERSONA_TARGET.agentId))
  })
})()

/** mock fetchSkillBindingStatus：列出三类安装目标（带 kind 字段） + 是否已安装该 skill */
export function mockFetchSkillBindingStatus(slug, digitalHumans = []) {
  const raw = RAW_SKILLS.find((x) => x.slug === slug)
  const latestVersion = raw?.latestVersion?.version || ''
  const bound = getBindings(slug)

  function toRow(target, extra = {}) {
    const installed = bound.has(bindingKey(target.agentId))
    return {
      agentId: target.agentId,
      agentName: target.agentName,
      displayName: target.displayName,
      description: target.description,
      avatar: extra.avatar || '',
      kind: target.kind,
      status: installed ? 'installed' : 'idle',
      isDefault: false,
      boundVersion: installed ? latestVersion : '',
      isLatest: installed,
      enabled: installed,
    }
  }

  const personaRow = toRow(PERSONA_TARGET)
  const kodeRow = toRow(KODE_TARGET)
  const digitalRows = (digitalHumans || []).map((dh) => {
    const installed = bound.has(bindingKey(dh.agent_id ?? dh.id))
    return {
      agentId: dh.agent_id ?? dh.id,
      agentName: dh.agent_name || dh.name,
      displayName: dh.agent_display_name || dh.name,
      description: dh.agent_description || '',
      avatar: dh.agent_avatar_url || '',
      kind: 'digital-human',
      status: installed ? 'installed' : 'idle',
      isDefault: false,
      boundVersion: installed ? latestVersion : '',
      isLatest: installed,
      enabled: installed,
    }
  })

  // 顺序：我的分身 → 数字员工 → Kode（与 UI 展示顺序一致）
  return { agents: [personaRow, ...digitalRows, kodeRow], latestVersion }
}

/** mock installSkillToAgent：标记 slug+agentId 已安装（agentId 保留原类型） */
export function mockInstallSkillToAgent(slug, agentId) {
  getBindings(slug).add(bindingKey(agentId))
  return { success: true }
}

/** mock uninstallSkillFromAgent：先按 id 反查；找不到再按 agentName 反查数字员工 */
export function mockUninstallSkillFromAgent(slug, agentNameOrId, digitalHumans = []) {
  const bindings = getBindings(slug)
  const key = bindingKey(agentNameOrId)
  if (bindings.has(key)) {
    bindings.delete(key)
    return { success: true }
  }
  const match = (digitalHumans || []).find(
    (dh) => dh.agent_name === agentNameOrId || dh.agent_display_name === agentNameOrId,
  )
  if (match) bindings.delete(bindingKey(match.agent_id ?? match.id))
  return { success: true }
}

/** mock 收藏 / 取消收藏：原地翻转 isStarred */
export function mockToggleSkillStar(slug, starred) {
  const target = RAW_SKILLS.find((x) => x.slug === slug)
  if (target) target.isStarred = !!starred
  return { isStarred: !!starred, starred: !!starred }
}

/** mock fetchInstalledSkills：根据 agentId 返回该 agent 已安装的 skill 列表
 *  - 数字员工（1001-1006）：按 agent_id 查绑定表
 *  - 其它数字员工（助理 9001 / 补位 1100+）：绑定表里没有它们，返回空 ——
 *    上层 PersonaManagePanel 会退回用 agent 自带的 skills 展示，不能 fallback 到分身，
 *    否则拿到的是分身的技能、再跟自己的 enabled_skills 求交集就全空了。
 *  - 分身 context（agentId 为 null / 字符串 / 数据库自增 id）：fallback 到 persona-self
 */
export function mockFetchInstalledSkills({ scope = 'global', agentId, agentName } = {}) {
  const numId = Number(agentId)
  const isDigitalHuman = !Number.isNaN(numId) && numId >= 1001 && numId <= 1006
  const isOtherEmployee = !Number.isNaN(numId) && numId >= 1000 && !isDigitalHuman
  if (isOtherEmployee) return []
  const targetKey = isDigitalHuman
    ? bindingKey(numId)
    : bindingKey(PERSONA_TARGET.agentId)
  return RAW_SKILLS.filter((s) => {
    const bound = INSTALLED_BINDINGS.get(s.slug)
    return bound && bound.has(targetKey)
  }).map((s) => ({
    slug: s.slug,
    name: s.name,
    displayName: s.displayName,
    summary: s.summary,
    tags: s.tags,
    image: s.image || '',
    icon: s.image || '',
    version: s.latestVersion?.version || '',
    enabled: true,
    deletable: true,
  }))
}
