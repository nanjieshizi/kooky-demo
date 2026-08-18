/**
 * 一人团队 / 我的员工 演示数据
 *
 * - DEMO_EMPLOYEES：用户在「市场」聘了 6 个数字员工，但给它们起了职业化的别名
 *   （跟发布会演示截图里的「产品经理 / 全栈开发 / 产品运营 / UI 设计师 / 架构师 / 测试工程师」对齐）
 * - DEMO_SOLO_TEAMS：预置 1 个旧团队「我的个人博客」让 sidebar 不空
 *
 * Kooky 落地页冲刺 团队不预置 —— 现场走真实「+ 创建团队」流程
 */

import { DIGITAL_HUMANS_RAW } from './digital-humans'
import agentTeamAssistantAvatar from '@/assets/crab-pixel.png'

const NOW_MS = Date.now()
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

/** 数字员工 RAW → 演示职业化 mapping */
const ALIAS_BY_AGENT_ID = {
  1001: { name: '产品经理',    description: '负责产品调研、需求设计、PRD输出', tags: ['产品经理', 'PRD', '需求分析'] },
  1002: { name: '全栈开发',    description: '负责代码实现，从前端到后端到部署',  tags: ['全栈开发', '前端', '后端'] },
  1003: { name: '测试工程师',  description: '负责测试方案、自动化用例、质量保障', tags: ['测试工程师', '自动化测试', 'QA'] },
  1004: { name: 'UI 设计师',   description: '负责视觉设计、交互流程、原型还原',   tags: ['UI 设计师', '视觉', '交互'] },
  1005: { name: '架构师',      description: '负责技术架构、性能调优、技术选型',   tags: ['架构师', '系统设计', '性能'] },
  1006: { name: '产品运营',    description: '擅长产品运营、文案撰写、增长营销',   tags: ['产品运营', '文案', '增长'] },
}

/**
 * 每个员工的岗位 + 人设三件套（称呼风格 / 语言偏好 / 回答语气）。
 * 详情页要把「编辑里有的」原样展示出来，没有数据那一片就是空的 —— 所以这里配齐。
 * ⚠️ agent_config 的字段名是照生产 UI 猜的，接后端前要跟真实契约核。
 */
const PROFILE_BY_AGENT_ID = {
  1001: {
    job_title: '产品经理',
    call_style: '直呼其名，不带头衔',
    language_preference: '简体中文，专业术语保留英文原词',
    tone_style: '先结论后论据，能用表格就不写长段',
  },
  1002: {
    job_title: '全栈工程师',
    call_style: '直接叫「你」，不客套',
    language_preference: '简体中文，代码和报错原样贴英文',
    tone_style: '务实、给可执行方案，风险点单独标出来',
  },
  1003: {
    job_title: '测试工程师',
    call_style: '称呼「你」，正式场合用全名',
    language_preference: '简体中文，缺陷等级用标准英文缩写',
    tone_style: '严谨、逐条列举，复现步骤必须写全',
  },
  1004: {
    job_title: 'UI 设计师',
    call_style: '亲切自然，直呼其名',
    language_preference: '简体中文，设计术语中英混用',
    tone_style: '先给视觉方案再讲理由，配具体数值',
  },
  1005: {
    job_title: '系统架构师',
    call_style: '直呼其名',
    language_preference: '简体中文，架构名词用英文',
    tone_style: '先讲权衡再给结论，明确说明适用边界',
  },
  1006: {
    job_title: '产品运营',
    call_style: '轻松一点，可以带点玩笑',
    language_preference: '简体中文，文案给多个备选',
    tone_style: '有感染力但不浮夸，数据说话',
  },
  9001: {
    job_title: '团队中枢',
    call_style: '亲切自然，直呼其名',
    language_preference: '简体中文优先，技术细节保留英文术语',
    tone_style: '先给结论和下一步，细节按需展开',
  },
}

/**
 * 每个员工已装的技能。1002 / 1004 不在这儿配 —— 它们的技能由
 * UPDATE_INFO_BY_AGENT_ID 提供（要演示「版本更新后技能取并集」）。
 */
const SKILLS_BY_AGENT_ID = {
  1001: [
    { slug: 'req-breakdown', displayName: '需求拆解', summary: '把一句话需求拆成可评审的功能点与验收标准' },
    { slug: 'competitor-scan', displayName: '竞品分析', summary: '按维度对比竞品功能，输出差异表和机会点' },
    { slug: 'prd-writing', displayName: 'PRD 撰写', summary: '生成结构完整的需求文档，含流程图与边界说明' },
  ],
  1003: [
    { slug: 'case-design', displayName: '用例设计', summary: '基于需求生成正向 / 异常 / 边界用例集' },
    { slug: 'auto-regression', displayName: '自动化回归', summary: '维护回归脚本，跑完输出失败用例清单' },
    { slug: 'defect-analysis', displayName: '缺陷分析', summary: '归类缺陷根因，给出复现步骤与影响面' },
  ],
  1005: [
    { slug: 'arch-review', displayName: '架构评审', summary: '审阅技术方案，指出耦合点与扩展性风险' },
    { slug: 'perf-diagnosis', displayName: '性能诊断', summary: '定位性能瓶颈，给出优化优先级' },
    { slug: 'tech-selection', displayName: '技术选型', summary: '按场景对比技术栈，输出选型理由与代价' },
  ],
  1006: [
    { slug: 'copywriting', displayName: '文案撰写', summary: '按渠道生成多版本文案，可指定语气和字数' },
    { slug: 'campaign-plan', displayName: '活动策划', summary: '产出活动方案：目标、节奏、素材清单' },
    { slug: 'data-review', displayName: '数据复盘', summary: '拉活动数据做归因，给下一轮建议' },
  ],
  9001: [
    { slug: 'task-dispatch', displayName: '任务拆解派发', summary: '把目标拆成子任务并分派给合适的员工' },
    { slug: 'progress-digest', displayName: '进度汇总', summary: '汇总各员工产出，生成一份可交付的总结' },
  ],
}

/**
 * 名片四件套的 demo 事实源：来源 / 模型档位 / 上岗天数 / 忙闲。
 *
 * ⚠️ 真接口目前都没有这几个字段（`presence.status` 只有 idle 一档），
 *    这里按员工排一份稳定值。接口补齐后删掉这张表、store 的兜底也一起摘。
 *    source: self=自建 | market=市场聘用 | builtin=企业统配
 */
const CARD_INFO_BY_AGENT_ID = {
  9001: { source: 'builtin', model: '星火 X1', days: 30, busy: 'idle' },
  1001: { source: 'market', model: '星火 X1', days: 62, busy: 'busy', from: '产品数字人' },
  1002: { source: 'market', model: 'Claude Sonnet 4', days: 48, busy: 'idle', from: '研发数字人' },
  1003: { source: 'builtin', model: '星火 4.0 Turbo', days: 35, busy: 'busy' },
  1004: { source: 'market', model: '星火 X1', days: 21, busy: 'idle', from: '设计数字人' },
  1005: { source: 'self', model: 'Claude Sonnet 4', days: 15, busy: 'idle' },
  1006: { source: 'builtin', model: '星火 4.0 Turbo', days: 9, busy: 'busy' },
  1007: { source: 'builtin', model: '星火 X1', days: 74, busy: 'idle' },
}

const EXTRA_CARD_INFO = [
  { source: 'self', model: '星火 4.0 Turbo', days: 6, busy: 'idle' },
  { source: 'market', model: '星火 X1', days: 12, busy: 'busy', from: '内容工场' },
  { source: 'self', model: 'Claude Sonnet 4', days: 4, busy: 'idle' },
  { source: 'market', model: '星火 4.0 Turbo', days: 18, busy: 'idle', from: '用户研究助手' },
]

/** 上岗天数 → hired_at（相对现在算，演示到哪天都对） */
function hiredAtFromDays(days) {
  return new Date(NOW_MS - days * DAY).toISOString()
}

/** 补位员工（算法工程师、内容编辑…）的通用技能，够撑住详情页不空就行 */
function buildGenericSkills(role) {
  return [
    { slug: `${role}-plan`, displayName: `${role}方案`, summary: `按${role}的专业视角输出可执行方案` },
    { slug: `${role}-review`, displayName: '产出复核', summary: '复核交付物，标出问题与改进项' },
  ]
}

/**
 * agent_config：人设三件套 + enabled_skills。
 * enabled_skills 要带上，否则「已安装技能」接口一旦有返回，
 * PersonaManagePanel 会拿它跟 enabled_skills 求交集，结果就空了。
 */
function buildAgentConfig(agentId) {
  const p = PROFILE_BY_AGENT_ID[agentId] || {}
  const skills = SKILLS_BY_AGENT_ID[agentId] || UPDATE_INFO_BY_AGENT_ID[agentId]?.skills || []
  return {
    call_style: p.call_style || '',
    language_preference: p.language_preference || '',
    tone_style: p.tone_style || '',
    enabled_skills: skills.map((s) => s.slug),
  }
}

/**
 * 演示「市场出了新版本」：给部分员工挂可更新信息（其余员工 = 已是最新）。
 * skills = 当前已装；latestSkills = 新版技能（含新增），更新时与 skills 取并集。
 */
const UPDATE_INFO_BY_AGENT_ID = {
  1004: { // UI 设计师 v4.0.3 → v4.1.0
    version: 'v4.0.3',
    latestVersion: 'v4.1.0',
    changelog: '新增「暗黑模式适配」技能；优化高保真还原的栅格对齐；修复批量导出偶发丢失图层的问题。',
    skills: [
      { slug: 'visual-spec', displayName: '视觉规范', summary: '统一色彩 / 字体 / 间距规范，输出可复用设计 token' },
      { slug: 'prototype-restore', displayName: '原型还原', summary: '将设计稿还原为高保真可交互原型' },
    ],
    latestSkills: [
      { slug: 'visual-spec', displayName: '视觉规范', summary: '统一色彩 / 字体 / 间距规范，输出可复用设计 token' },
      { slug: 'prototype-restore', displayName: '原型还原', summary: '将设计稿还原为高保真可交互原型' },
      { slug: 'dark-mode', displayName: '暗黑模式适配', summary: '自动生成暗黑模式配色与组件适配方案' },
    ],
  },
  1002: { // 全栈开发 v5.1.0 → v5.2.0
    version: 'v5.1.0',
    latestVersion: 'v5.2.0',
    changelog: '新增「性能调优」技能；升级部署流水线到并行构建；修复偶发的接口超时重试问题。',
    skills: [
      { slug: 'api-impl', displayName: '接口实现', summary: '前后端接口设计与实现' },
      { slug: 'deploy', displayName: '部署上线', summary: '自动化构建与部署流水线' },
    ],
    latestSkills: [
      { slug: 'api-impl', displayName: '接口实现', summary: '前后端接口设计与实现' },
      { slug: 'deploy', displayName: '部署上线', summary: '自动化构建与部署流水线' },
      { slug: 'perf-opt', displayName: '性能调优', summary: '前端性能分析与优化建议' },
    ],
  },
}

/** 演示员工列表（响应 /v1/agents/my）—— 7 个：1 团队助手（default 协调者）+ 6 个职业化员工 */
export function buildDemoEmployees() {
  // 「我的分身」= 团队中枢（is_default: true，dialog 会把它过滤掉不显示给用户勾选）。
  // 合并后它取代原「团队助手」：既是默认应答者/协调者，又能自己下场干活。
  const teamAssistant = {
    id: 9001,
    agent_id: 9001,
    participant_id: 'agent-team-assistant',
    imBotId: 'agent-team-assistant',
    name: '我的分身',
    display_name: '我的分身',
    username: 'team-assistant',
    slug: 'team-assistant',
    avatar: agentTeamAssistantAvatar,
    avatar_url: agentTeamAssistantAvatar,
    description: '你的通用助理，牵头拆解需求、调度员工、汇总产出',
    bio: '你的通用助理，牵头拆解需求、调度员工、汇总产出',
    is_default: true,
    is_official: true,
    pinned: false,
    presence: { status: CARD_INFO_BY_AGENT_ID[9001].busy },
    busy_status: CARD_INFO_BY_AGENT_ID[9001].busy,
    source: CARD_INFO_BY_AGENT_ID[9001].source,
    llm_model: CARD_INFO_BY_AGENT_ID[9001].model,
    hired_at: hiredAtFromDays(CARD_INFO_BY_AGENT_ID[9001].days),
    tags: ['我的分身', '通用助理', '协调'],
    job_title: PROFILE_BY_AGENT_ID[9001].job_title,
    agent_config: buildAgentConfig(9001),
    capabilities: [],
    skills: SKILLS_BY_AGENT_ID[9001] || [],
    created_at: new Date(NOW_MS - 30 * DAY).toISOString(),
    updated_at: new Date(NOW_MS - 1 * DAY).toISOString(),
  }
  const others = DIGITAL_HUMANS_RAW.map((dh) => {
    const alias = ALIAS_BY_AGENT_ID[dh.agent_id] || {}
    const upd = UPDATE_INFO_BY_AGENT_ID[dh.agent_id] || {}
    return {
      id: dh.agent_id,
      agent_id: dh.agent_id,
      participant_id: `agent-${dh.agent_id}`,
      imBotId: `agent-${dh.agent_id}`,
      name: alias.name || dh.agent_display_name,
      display_name: alias.name || dh.agent_display_name,
      username: dh.agent_name,
      slug: dh.agent_name,
      avatar: dh.agent_avatar_url || '',
      avatar_url: dh.agent_avatar_url || '',
      description: alias.description || dh.agent_description?.slice(0, 40) || '',
      bio: alias.description || dh.agent_description?.slice(0, 40) || '',
      version: upd.version || dh.agent_version,
      latestVersion: upd.latestVersion || '',
      changelog: upd.changelog || '',
      latestSkills: upd.latestSkills || [],
      tags: alias.tags || dh.agent_tags || [],
      job_title: PROFILE_BY_AGENT_ID[dh.agent_id]?.job_title || '',
      agent_config: buildAgentConfig(dh.agent_id),
      capabilities: [],
      // 有版本更新的（1002/1004）技能由 UPDATE_INFO 提供，其余读 SKILLS 表
      skills: upd.skills || SKILLS_BY_AGENT_ID[dh.agent_id] || [],
      is_official: dh.is_official,
      pinned: dh.pinned,
      presence: { status: (CARD_INFO_BY_AGENT_ID[dh.agent_id]?.busy) || 'idle' },
      busy_status: (CARD_INFO_BY_AGENT_ID[dh.agent_id]?.busy) || 'idle',
      source: CARD_INFO_BY_AGENT_ID[dh.agent_id]?.source || 'builtin',
      source_from: CARD_INFO_BY_AGENT_ID[dh.agent_id]?.from || '',
      llm_model: CARD_INFO_BY_AGENT_ID[dh.agent_id]?.model || '星火 X1',
      hired_at: hiredAtFromDays(CARD_INFO_BY_AGENT_ID[dh.agent_id]?.days ?? 7),
      is_default: false,
      created_at: new Date(NOW_MS - 7 * DAY).toISOString(),
      updated_at: new Date(NOW_MS - 1 * DAY).toISOString(),
    }
  })
  // demo：额外补若干员工，凑够"多人团队"场景（体现标题栏头像堆的「+N」缩略）。
  // 头像循环复用现有 6 个职业素材，名字用常见岗位。
  const EXTRA_ROLES = [
    '算法工程师', '内容编辑', '项目经理', '用户研究',
  ]
  const extras = EXTRA_ROLES.map((role, i) => {
    const base = others[i % others.length] || {}
    const id = 1100 + i
    const card = EXTRA_CARD_INFO[i] || EXTRA_CARD_INFO[0]
    return {
      ...base,
      source: card.source,
      source_from: card.from || '',
      llm_model: card.model,
      hired_at: hiredAtFromDays(card.days),
      presence: { status: card.busy },
      busy_status: card.busy,
      id,
      agent_id: id,
      participant_id: `agent-${id}`,
      imBotId: `agent-${id}`,
      name: role,
      display_name: role,
      username: `emp-${id}`,
      slug: `emp-${id}`,
      description: `${role}（演示成员）`,
      bio: `${role}（演示成员）`,
      latestVersion: '',
      changelog: '',
      latestSkills: [],
      tags: [role],
      // 别继承 base 的岗位/技能/人设，否则「算法工程师」会顶着产品经理的技能
      job_title: role,
      skills: buildGenericSkills(role),
      agent_config: {
        call_style: '直呼其名',
        language_preference: '简体中文，专业术语保留英文',
        tone_style: `以${role}的视角先给判断，再补依据`,
        enabled_skills: buildGenericSkills(role).map((s) => s.slug),
      },
      is_default: false,
    }
  })
  return [teamAssistant, ...others, ...extras]
}

/**
 * 某个员工「已安装」的技能（响应 /v1/installed/skills?agentId=xxx）。
 * 必须和 buildDemoEmployees 里的 skills 同源 —— PersonaManagePanel 会拿这份
 * 跟 agent_config.enabled_skills 求交集，两边对不上技能区就空了。
 */
export function getDemoEmployeeSkills(agentId) {
  const id = Number(agentId)
  if (!Number.isFinite(id)) return []
  const emp = findDemoEmployee(id)
  return Array.isArray(emp?.skills) ? emp.skills : []
}

/**
 * 每个员工的近期会话标题（通讯录详情页右栏「工作记录」要看的东西）。
 * 没配到的员工走通用兜底，保证点谁都不是空的。
 */
const THREAD_TITLES_BY_AGENT_ID = {
  9001: ['本周待办梳理', '给三个员工派活', 'Q3 目标拆解'],
  1001: ['支付流程改版需求', '竞品调研 · 协作类工具', 'PRD 评审意见整理'],
  1002: ['登录接口联调', '构建流水线提速', '线上超时问题排查'],
  1003: ['回归用例补充', '支付链路测试方案', '缺陷收敛复盘'],
  1004: ['详情页视觉走查', '暗黑模式配色', '组件库间距规范'],
  1005: ['消息推送架构评审', '数据库分库方案', '前端框架选型对比'],
  1006: ['发布会预热文案', '用户增长复盘', '公众号排期'],
}

const GENERIC_THREAD_TITLES = ['需求沟通', '方案讨论', '产出复核']

/**
 * 造某个员工的会话列表（响应 /api/personal/threads）。
 * 时间用「相对现在」，永远显示成刚刚 / 几小时前，demo 不会过期。
 */
export function buildDemoEmployeeThreads(agentId) {
  const id = Number(agentId)
  if (!Number.isFinite(id)) return []
  const titles = THREAD_TITLES_BY_AGENT_ID[id] || GENERIC_THREAD_TITLES
  const now = Date.now()
  // 每条往前推 3h / 1.5d / 4d，错开成"最近聊过"的样子
  const offsets = [3 * HOUR, 36 * HOUR, 4 * DAY]
  return titles.map((title, i) => {
    const ts = now - (offsets[i] ?? (6 + i) * DAY)
    return {
      id: `demo-thread-${id}-${i + 1}`,
      thread_id: `demo-thread-${id}-${i + 1}`,
      langgraph_thread_id: `lg-demo-${id}-${i + 1}`,
      title,
      is_pinned: false,
      agent_id: id,
      thread_type: 'personal',
      created_at: new Date(ts - 2 * HOUR).toISOString(),
      updated_at: new Date(ts).toISOString(),
    }
  })
}

/** 通过 agent_id / participant_id / display_name 查找演示员工 */
export function findDemoEmployee(key) {
  if (key == null) return null
  const all = buildDemoEmployees()
  const s = String(key)
  return (
    all.find((e) => String(e.agent_id) === s) ||
    all.find((e) => e.participant_id === s) ||
    all.find((e) => e.name === s || e.display_name === s) ||
    null
  )
}

/** 旧示例一人团队（响应 /v1/one-person-teams/my）：「我的个人博客」，1 人 */
export function buildDemoSoloTeams() {
  const pmEmp = findDemoEmployee('产品经理')
  const fullstackEmp = findDemoEmployee('全栈开发')
  const team1Members = [pmEmp, fullstackEmp].filter(Boolean).map((emp) => ({
    member_id: `mem-blog-${emp.agent_id}`,
    agent_id: emp.agent_id,
    participant_id: emp.participant_id,
    name: emp.name,
    avatar: emp.avatar,
    role: 'agent',
    presence: { status: 'idle' },
  }))
  return [
    {
      team_id: 'demo-team-personal-blog',
      id: 'demo-team-personal-blog',
      name: '我的个人博客',
      description: '维护个人技术博客 / 文章撰写 / 自动发布',
      avatar: null,
      members: team1Members,
      member_count: team1Members.length,
      created_at: new Date(NOW_MS - 5 * DAY).toISOString(),
      updated_at: new Date(NOW_MS - 6 * HOUR).toISOString(),
      last_active_at: new Date(NOW_MS - 6 * HOUR).toISOString(),
      pinned: false,
      is_collaboration_dissolved: false,
    },
  ]
}
