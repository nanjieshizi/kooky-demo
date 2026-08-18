import { defineStore } from 'pinia'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { fetchAgentList, hireAgent } from '@/modules/market/avatar/services/avatarApi'
import { syncHiredEmployeeToDemoMock } from '@/modules/solo-team/hireHandoff'
import { updatePrivateAgent } from '@/modules/solo-team/service'
import {
  fetchRootDepartments,
  fetchDepartmentChildren,
  fetchDepartmentProfiles,
  fetchDepartmentAgents,
  fetchOrgHeadcount,
  searchProfiles,
} from '@/shared/services/orgApi'

/**
 * 通讯录 · 我的数字员工
 *
 * 列表数据不自己维护，直接借 solo-team 的 `/api/v1/agents/my`（loadEmployeeItems），
 * 这里只做「通讯录视角」的加工：搜索、卡片上的统计数字。
 *
 * ⚠️ demo 兜底：真实接口目前没有 记忆条数 / 技能开关数（记忆是 PersonaManagePanel 里的
 *   演示数据、没落库），缺字段时按 id 生成**稳定**假值（同一个员工每次刷新一致），
 *   接口补齐后把 resolveStats 里的 fallback 摘掉即可。
 *   忙/闲状态已按 Pata 意见去掉（真字段只有 idle 一档，展示了也是演）。
 */

/** orgApi 人员 → 通讯录成员（title/email/employeeId 是 demo 富化字段，真接口没有就空着） */
function toHumanMember(p) {
  return {
    kind: 'human',
    id: String(p.userId),
    name: p.name,
    account: p.account,
    department: p.department,
    departmentPath: p.departmentPath || [],
    title: p.title || '',
    email: p.email || '',
    employeeId: p.employeeId || '',
    managerName: p.managerName || '',
    managerAccount: p.managerAccount || '',
    projectRole: p.projectRole || '',
    avatar: p.avatar,
  }
}

/** 企业数字人（agent-usage 结构）→ 通讯录成员；职位/部门是 demo 补的人事字段 */
function toAgentMember(a) {
  return {
    kind: 'agent',
    id: String(a.agent_id ?? a.agentId ?? ''),
    name: a.agent_display_name || a.agent_name || `Agent ${a.agent_id}`,
    account: a.agent_name || '',
    department: a.agent_department || '企业数字人',
    title: a.agent_job_title || '企业数字人',
    avatar: a.agent_avatar_url || a.avatar || '',
    desc: a.description || a.agent_description || '',
    // 数字人也有工号，但走自己的号段（AI- 开头），一眼跟真人的 2024xxxxxx 区分开
    employeeId: a.agent_employee_id || `AI-${String(a.agent_id ?? a.agentId ?? '').padStart(4, '0')}`,
    tags: Array.isArray(a.agent_tags) ? a.agent_tags : [],
  }
}

/** 由 id 派生的稳定伪随机（0~1），保证刷新不跳字 */
function seededUnit(id, salt = 0) {
  const s = `${id}#${salt}`
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** 已装技能的名字（档案卡展示用，最多 4 个） */
function resolveSkillNames(employee) {
  const raw = employee?.raw || {}
  const skills = Array.isArray(raw.skills) ? raw.skills : []
  return skills
    .map((s) => String(s?.displayName || s?.display_name || s?.name || '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

/** 卡片底部两个统计：记忆条目 / 已开技能 */
function resolveStats(employee) {
  const raw = employee?.raw || {}
  const skills = Array.isArray(raw.skills) ? raw.skills : []
  const latest = Array.isArray(raw.latestSkills) ? raw.latestSkills : []
  const total = Math.max(skills.length, latest.length, 2 + Math.floor(seededUnit(employee.id, 'st') * 3))
  const enabled = skills.length || Math.max(1, total - Math.round(seededUnit(employee.id, 'se') * 1.4))
  return {
    memoryCount: 3 + Math.floor(seededUnit(employee.id, 'mem') * 6),
    skillEnabled: Math.min(enabled, total),
    skillTotal: total,
  }
}

/**
 * 产出物素材池（demo）：名字带岗位气味，类型覆盖文档/表格/幻灯/图片，
 * 让不同员工挑出来的东西不至于都长一个样。
 */
const DELIVERABLE_POOL = Object.freeze([
  { name: '支付流程改版 PRD', ext: 'docx', kind: 'doc', size: '246 KB', from: '支付流程改版需求' },
  { name: '竞品功能对比表', ext: 'xlsx', kind: 'sheet', size: '88 KB', from: '竞品调研 · 协作类工具' },
  { name: 'Q3 目标拆解', ext: 'pptx', kind: 'slide', size: '3.1 MB', from: 'Q3 目标拆解' },
  { name: 'PRD 评审意见汇总', ext: 'md', kind: 'doc', size: '18 KB', from: 'PRD 评审意见整理' },
  { name: '登录页走查记录', ext: 'pdf', kind: 'doc', size: '1.4 MB', from: '登录页原型走查' },
  { name: '本周科技新闻摘要', ext: 'md', kind: 'doc', size: '12 KB', from: '每日科技新闻摘要' },
  { name: '用户访谈纪要', ext: 'docx', kind: 'doc', size: '132 KB', from: '用户访谈复盘' },
  { name: '数据看板截图', ext: 'png', kind: 'image', size: '640 KB', from: '周报整理' },
])

const DELIVERABLE_ICON = Object.freeze({ doc: '📄', sheet: '📊', slide: '📑', image: '🖼' })

/** 按 agent id 稳定挑 3~5 件产出物，时间往前铺开 */
function buildDeliverables(agentId) {
  if (!agentId) return []
  const count = 3 + Math.round(seededUnit(agentId, 'dlv-n') * 2)
  const offset = Math.round(seededUnit(agentId, 'dlv-o') * DELIVERABLE_POOL.length)
  return Array.from({ length: count }, (_, i) => {
    const item = DELIVERABLE_POOL[(offset + i * 3) % DELIVERABLE_POOL.length]
    const days = Math.round(seededUnit(agentId, `dlv-t${i}`) * 6) + i * 2
    return {
      ...item,
      id: `${agentId}-dlv-${i}`,
      icon: DELIVERABLE_ICON[item.kind] || '📄',
      ts: Date.now() - days * 86400000,
    }
  }).sort((a, b) => b.ts - a.ts)
}

/** 效能/用量的周期切换（与市场那套一致） */
export const EFFICIENCY_PERIODS = Object.freeze(['今日', '近7天', '近30天'])

const PERIOD_SCALE = { 今日: 1, 近7天: 7, 近30天: 30 }
const PERIOD_BARS = { 今日: 12, 近7天: 7, 近30天: 30 }
const PERIOD_DELTA = { 今日: '较昨日', 近7天: '较上周', 近30天: '较上月' }

/**
 * 雇主视角的效能 + 用量（demo 兜底）。
 *
 * ⚠️ 跟市场那套「发布者视角」是两码事：那边样本是全体用户（320 活跃用户 / 4286 次调用），
 * 这里只有「我」一个用户，所以砍掉了服务用户数 / 聘用概况 / 调用方排名，
 * 换成雇主真正关心的四件事：他干了多少、干成没有、烧了多少 token、花了我多少钱。
 * 「正向反馈率」也没有 —— 1:1 会话里没有点赞/踩通道，编不出来。
 *
 * 「异常率」不单独占格：它和完成率是同一枚硬币（两者恒等于 100%），
 * 明细降级成完成率卡片的 hint，hover 才出。腾出来的位置给 token —— 我们支持多模型，
 * token 和费用不是固定换算，两个都得给，才能看出"贵是因为用得多，还是因为模型贵"。
 *
 * 数据全是按 agent id 生成的**稳定**假值（刷新不跳字）—— Kooky 目前没有 trace 统计接口。
 * 真接口补齐后，把这个函数换成接口返回即可，组件不用动。
 */
function buildEfficiency(agentId, period) {
  const u = (salt) => seededUnit(agentId, salt)
  const scale = PERIOD_SCALE[period] ?? 1
  const bars = PERIOD_BARS[period] ?? 7

  const perDay = 3 + Math.round(u('calls') * 9)
  const calls = perDay * scale
  const complete = 88 + Math.round(u('cmp') * 9)
  const fail = 1 + Math.round(u('fail') * 3)
  const abort = Math.max(0, 100 - complete - fail)
  const tokensK = Math.round(calls * (2.4 + u('tok') * 3))
  // 输出比输入贵，占比也小 —— 拆开给，才解释得了"为什么 token 不多但费用不低"
  const outK = Math.round(tokensK * (0.24 + u('out') * 0.12))
  const inK = tokensK - outK
  // 多模型混合计价：均价随员工用的档位浮动（¥0.03~0.09 / 1K），不是全局固定汇率
  const rate = +(0.03 + u('rate') * 0.06).toFixed(3)
  const cost = +(tokensK * rate).toFixed(1)

  const stats = [
    {
      key: 'calls',
      label: '调用量',
      value: String(calls),
      unit: '次',
      delta: `${PERIOD_DELTA[period]} +${8 + Math.round(u('d1') * 20)}%`,
      up: true,
    },
    {
      key: 'complete',
      label: '完成率',
      value: String(complete),
      unit: '%',
      delta: `${PERIOD_DELTA[period]} +${(u('d2') * 2).toFixed(1)}pt`,
      up: true,
      // 异常明细不占格，挂这儿 hover 出
      hint: `没干成的 ${fail + abort}%：失败 ${fail}% · 中断 ${abort}%`,
    },
    {
      key: 'tokens',
      label: 'Token 消耗',
      // 统一按 K 给，别在 K/M 之间跳档 —— 下面趋势柱的刻度得跟卡片对得上
      value: String(tokensK),
      unit: 'K',
      delta: `${PERIOD_DELTA[period]} +${6 + Math.round(u('d3') * 16)}%`,
      up: true,
      hint: `输入 ${inK}K · 输出 ${outK}K`,
    },
    {
      key: 'cost',
      label: '折算成本',
      value: `¥${cost}`,
      unit: '',
      delta: `${PERIOD_DELTA[period]} +${4 + Math.round(u('d4') * 14)}%`,
      hint: `多模型混合计价，本期均价 ¥${rate}/1K`,
    },
  ]

  /** 趋势：围绕基准做稳定波动，柱数按周期变 */
  const trendOf = (key) => {
    const base = { calls: perDay, complete, tokens: tokensK / scale, cost: cost / scale }[key]
    return Array.from({ length: bars }, (_, i) => {
      const wave = (seededUnit(agentId, `${key}-${i}`) - 0.5) * 0.34
      const v = base * (1 + wave)
      return key === 'cost' ? +v.toFixed(1) : Math.max(0, Math.round(v))
    })
  }

  return { stats, trendOf }
}

/**
 * 版本 / 是否有新版可升（员工来自市场，市场出新版时可一键更新）。
 * 与 PersonaManagePanel 的 hasNewVersion 判断同源：latestVersion 存在且与当前版本不同。
 */
/**
 * 名片三件套：来源 / 上岗时长 / 模型档位。
 * ⚠️ 真接口都还没有这些字段，mock 里按员工排了稳定值；接口补齐后这里的兜底一起摘掉。
 */
/** 标签上限：页头一行能塞下的量，多了就成杂草了 */
export const MAX_EMPLOYEE_LABELS = 8

/**
 * 标签（label）：跟市场那排 tags 同一个东西 —— 纯标识，不参与任何逻辑，用户自己维护。
 * 用户改过的以 agent_config.labels 为准（哪怕清空）；从没改过就拿市场带来的 tags 打底。
 */
function resolveLabels(employee) {
  const raw = employee?.raw || employee || {}
  const cfg = raw.agent_config || raw.agentConfig || {}
  const custom = Array.isArray(cfg.labels) ? cfg.labels : null
  const list = custom || (Array.isArray(raw.tags) ? raw.tags : [])
  return list.map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, MAX_EMPLOYEE_LABELS)
}

function resolveCardInfo(employee) {
  const raw = employee?.raw || employee || {}
  const source = String(raw.source || (raw.is_default ? 'builtin' : 'builtin'))
  const hiredAt = raw.hired_at || raw.first_used_at || raw.created_at || ''
  const ms = Date.parse(hiredAt)
  const days = Number.isFinite(ms) ? Math.max(1, Math.round((Date.now() - ms) / 86400000)) : 0
  const busy = String(raw.busy_status || raw.presence?.status || 'idle').toLowerCase()
  // 来源只认一件事：是不是从市场聘来的。是 → 给市场里那条的名字 + 可跳的 id；
  // 自建/企业统配都不给标签（叫法本身就没信息量），UI 那边显示「-」。
  const from = String(raw.source_from || '').trim()
  const fromMarket = source === 'market' && Boolean(from)
  return {
    source,
    sourceFrom: from,
    fromMarket,
    // demo 里员工 id 与市场数字人 id 同源；真接口应给 market_agent_id
    marketAgentId: fromMarket
      ? String(raw.market_agent_id ?? raw.source_agent_id ?? raw.agent_id ?? raw.id ?? '')
      : '',
    onboardDays: days,
    model: raw.llm_model || raw.agent_config?.llm_model || '',
    busy: busy === 'busy' || busy === 'working' ? 'busy' : 'idle',
    busyLabel: busy === 'busy' || busy === 'working' ? '执行中' : '空闲',
  }
}

function resolveVersion(employee) {
  const raw = employee?.raw || {}
  const version = String(raw.version || '').trim()
  const latestVersion = String(raw.latestVersion || '').trim()
  return {
    version,
    latestVersion,
    changelog: String(raw.changelog || '').trim(),
    hasUpdate: Boolean(latestVersion && latestVersion !== version),
  }
}

/**
 * 职位/领域：真字段优先；缺了拿第一个「和名字不重样」的 tag 顶
 * （mock 员工的 tags[0] 常常就是别名本身，直接用会出现「产品经理 / 产品经理」）
 */
function resolveTitle(employee) {
  const raw = employee?.raw || {}
  const name = String(employee?.name || '').trim()
  const title = String(employee?.title || '').trim()
  if (title && title !== name) return title
  const tags = Array.isArray(raw.tags) ? raw.tags : []
  const tag = tags.map((t) => String(t || '').trim()).find((t) => t && t !== name)
  return tag || '专属数字员工'
}

export const useContactsStore = defineStore('contacts', {
  state: () => ({
    keyword: '',

    // ── 组织目录 ──────────────────────────────
    /** 部门树（懒加载 children）—— 纯真实组织架构 */
    departments: [],
    /** deptId → 人员列表（真人） */
    profilesByDept: {},
    /** deptId → 该部门的企业数字人（A 方案：混编进部门） */
    agentsByDept: {},
    expandedDeptIds: [],
    activeDeptId: null,
    orgKeyword: '',
    orgSearchResults: null,
    orgLoading: false,
    /** 右侧档案卡当前展示的人（真人或数字同事），null = 不展开 */
    activeProfile: null,
    /**
     * 「只看数字同事」筛选态：跨部门筛出全公司的数字同事。
     * 它是**筛选视角**不是组织节点 —— 所以只活在列表头的胶囊上，不进部门树。
     */
    agentOnly: false,
    /** 全公司人数（二级栏底部概览条）；接口没有就一直是 null，那一格不显示 */
    headcount: null,
    /** 市场推荐（B 版二级栏：员工少时给几个可聘的数字人，填白 + 引导） */
    marketRecos: [],
    hiringId: null,
  }),

  getters: {
    /** 通讯录口径的员工卡数据（不含助理本体 —— 它不是"雇来的"，单独一张卡） */
    employees() {
      const soloTeam = useSoloTeamStore()
      return (soloTeam.employeeChatEmployees || [])
        .filter((e) => e && !e.isDefault)
        .map((e) => ({
          id: e.id,
          name: e.name,
          title: resolveTitle(e),
          description: e.description || '还没写自我介绍，点开配置给他补一段。',
          avatar: e.avatar,
          labels: resolveLabels(e),
          skillNames: resolveSkillNames(e),
          pinned: Boolean(e.pinned),
          ...resolveStats(e),
          ...resolveVersion(e),
          ...resolveCardInfo(e),
          raw: e.raw,
        }))
    },

    /**
     * 「我的助理」本体（agent 9001，is_default）—— 天生在岗、唯一、不可解聘，
     * 所以不混进 employees 计数，单独一张置顶卡。
     * ⚠️ 数据源里它还叫「我的分身」（全库 90+ 处旧称待统一），这里先按新叫法显示。
     */
    assistant() {
      const soloTeam = useSoloTeamStore()
      const self = (soloTeam.employeeChatEmployees || []).find((e) => e && e.isDefault)
      if (!self) return null
      return {
        id: self.id,
        name: self.name === '我的分身' ? '我的助理' : self.name,
        title: '团队中枢',
        description: self.description || '你的通用助理，牵头拆解需求、调度员工、汇总产出。',
        avatar: self.avatar,
        isAssistant: true,
        labels: resolveLabels(self),
        skillNames: resolveSkillNames(self),
        ...resolveStats(self),
        ...resolveVersion(self),
        ...resolveCardInfo(self),
        raw: self.raw,
      }
    },

    /** 搜索时助理也参与过滤，不搜就常驻置顶 */
    visibleAssistant() {
      const a = this.assistant
      if (!a) return null
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return a
      return `${a.name}${a.title}${a.description}`.toLowerCase().includes(kw) ? a : null
    },

    /**
     * 推荐位：市场里还没聘、也不在我员工列表里的，取前 3 个。
     * 员工多了就没必要占地方（由组件按数量决定显不显示）。
     */
    visibleMarketRecos() {
      const mine = new Set(this.employees.map((e) => String(e.id)))
      return this.marketRecos
        .filter((a) => !a.isInstalled && !mine.has(String(a.id)))
        .slice(0, 3)
    },

    /** 全部企业数字人（搜索兜底 + 计数用） */
    digitalColleagues() {
      const dhs = useDigitalHumanStore()
      return (dhs.agents || []).map(toAgentMember)
    },

    /**
     * 组织目录当前选中部门下的成员：数字同事 + 真人混编。
     * **数字同事排在最前**（Pata 定：部门里先看见数字人，它们是随时能派活的那批）。
     */
    orgMembers() {
      if (this.orgSearchResults) return this.orgSearchResults
      if (this.agentOnly) return this.digitalColleagues
      const agents = (this.agentsByDept[this.activeDeptId] || []).map(toAgentMember)
      const humans = (this.profilesByDept[this.activeDeptId] || []).map(toHumanMember)
      return [...agents, ...humans]
    },

    /** 当前部门下的数字同事数（胶囊上的数字，与 agentOnly 态无关） */
    deptAgentCount() {
      return (this.agentsByDept[this.activeDeptId] || []).length
    },

    /** 当前列表里的数字同事数量（列表头「N 人 · M 数字同事」用） */
    orgAgentCount() {
      return this.orgMembers.filter((m) => m.kind === 'agent').length
    },

    /** 二级栏「组织目录」计数：已加载到的人 + 数字同事（没加载完就先不显示） */
    orgTotal() {
      const humans = Object.values(this.profilesByDept)
        .reduce((sum, list) => sum + (list?.length || 0), 0)
      return humans + this.digitalColleagues.length
    },

    /**
     * 详情页右栏「工作记录」· 定时任务：该员工挂的 routine。
     * 数据是真链路 —— schedule store 里每条都带 executor.agentId。
     */
    schedulesOf() {
      const schedule = useScheduleStore()
      return (agentId) => {
        const id = String(agentId ?? '')
        if (!id) return []
        return schedule.allTasks.filter((t) => String(t?.executor?.agentId ?? '') === id)
      }
    },

    /** 详情页「效能」：雇主视角的效能 + 用量（demo 兜底，见 buildEfficiency 注释） */
    efficiencyOf() {
      return (agentId, period) => buildEfficiency(String(agentId ?? ''), period)
    },

    /** 详情页右栏「工作记录」· 近期会话：员工自己的会话线程，新的在前 */
    threadsOf() {
      const soloTeam = useSoloTeamStore()
      return (agentId) => {
        const list = soloTeam.getEmployeeThreads?.(String(agentId ?? '')) || []
        return [...list].sort((a, b) =>
          String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')),
        )
      }
    },

    /**
     * 详情页「工作记录」· 最近动态：会话和定时执行混排成一条流。
     *
     * 定时任务本质就是"到点自动开的一条会话"，跟手动会话是同类项 ——
     * 原来按触发方式分两栏，是拿实现细节当分类；用户只问"他最近干了啥"。
     * 定时那条取 lastRunAt（没跑过就退回 nextRunAt / createdAt），才排得进时间轴。
     */
    activityOf() {
      return (agentId) => {
        const chats = this.threadsOf(agentId).map((t) => ({
          kind: 'chat',
          id: `chat-${t.id}`,
          title: t.title || '新对话',
          sub: '',
          ts: Date.parse(t.updated_at || t.created_at || '') || 0,
          raw: t,
        }))
        const routines = this.schedulesOf(agentId).map((t) => ({
          kind: 'routine',
          id: `routine-${t.id}`,
          title: t.name || '定时任务',
          sub: t.cycle?.description || '',
          status: t.status,
          ts: t.lastRunAt || t.nextRunAt || t.createdAt || 0,
          // 没跑过的别谎称"已执行"
          pending: !t.lastRunAt,
          raw: t,
        }))
        return [...chats, ...routines].sort((a, b) => b.ts - a.ts)
      }
    },

    /**
     * 详情页「工作记录」· 产出物：他交付的东西。
     *
     * ⚠️ demo-only —— Kooky 目前没有"按 agent 归集产出文件"的接口，
     * 这里按 id 播种从素材池里挑几件（刷新不跳）。真接口来了换掉这个函数即可。
     */
    deliverablesOf() {
      return (agentId) => buildDeliverables(String(agentId ?? ''))
    },

    /** 主区网格：关键词过滤 */
    visibleEmployees() {
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return this.employees
      return this.employees.filter((e) =>
        `${e.name}${e.title}${e.description}`.toLowerCase().includes(kw),
      )
    },
  },

  actions: {
    setKeyword(value) {
      this.keyword = String(value ?? '')
    },
    /** 拉员工列表（复用 solo-team 的真实接口，已加载则不重复请求） */
    async loadEmployees({ force = false } = {}) {
      const soloTeam = useSoloTeamStore()
      await soloTeam.loadEmployeeItems({ force })
      return this.employees
    },

    /**
     * 一键更新到市场最新版：技能取并集、版本号推进。
     *
     * ⚠️ demo-only —— 直接改 `window.__optMock.employees`（与 PersonaManagePanel 里那套
     * 本地 ref 的做法等价，但落在共享数据上，所以详情页/二级栏/管理面板读到的是同一份，
     * 不会出现「hero 说更新完了、面板还显示可更新」）。
     * 真实环境要换成市场的版本更新接口。
     */
    async applyEmployeeUpdate(agentId) {
      const optMock = typeof window !== 'undefined' ? window.__optMock : null
      const emp = optMock?.employees?.find((e) => String(e.agent_id ?? e.id) === String(agentId))
      if (!emp?.latestVersion) return false
      const seen = new Set()
      emp.skills = [...(emp.skills || []), ...(emp.latestSkills || [])].filter((s) => {
        const key = s?.slug || s?.displayName
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (emp.agent_config) emp.agent_config.enabled_skills = emp.skills.map((s) => s.slug)
      emp.version = emp.latestVersion
      emp.latestVersion = ''
      emp.changelog = ''
      emp.latestSkills = []
      await this.loadEmployees({ force: true })
      return true
    },

    /**
     * 置顶 / 取消置顶：走 solo-team 的真实接口。
     * 列表顺序不用自己管 —— `sortEmployeesLikeAgentsMy` 本来就是
     * is_default DESC > pinned_at DESC > id ASC，置顶完顺序自然就对了。
     */
    async toggleEmployeePin(employee) {
      const soloTeam = useSoloTeamStore()
      if (!employee?.id) return
      try {
        if (employee.pinned) await soloTeam.unpinEmployee(employee.id)
        else await soloTeam.pinEmployee(employee.id)
      } catch (err) {
        console.error('[Contacts] 置顶失败:', err)
      }
    },

    /**
     * 改标签：落在 agent_config.labels（跟人设、技能开关同一条路，整包合并别冲掉别的）。
     * updatePrivateAgent 只回写后端，不动 solo-team 那份列表，所以存完得重拉一次。
     */
    async updateEmployeeLabels(agentId, labels) {
      const soloTeam = useSoloTeamStore()
      const emp = soloTeam.employeeChatEmployees?.find((e) => String(e.id) === String(agentId))
      const current = emp?.raw?.agent_config || emp?.raw?.agentConfig || {}
      const next = (Array.isArray(labels) ? labels : [])
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, MAX_EMPLOYEE_LABELS)
      await updatePrivateAgent(agentId, { agentConfig: { ...current, labels: next } })
      await soloTeam.loadEmployeeItems({ force: true })
      return next
    },

    /** 解聘：走 solo-team 的真实接口，确认弹窗由调用方负责 */
    async dismissEmployee(agentId) {
      const soloTeam = useSoloTeamStore()
      await soloTeam.removeEmployee(agentId)
      await this.loadEmployees({ force: true })
    },

    /**
     * 详情页右栏要的会话列表 —— 走 solo-team 已有的真实接口，不自己请求。
     * 拉不到就静默退化成空列表（右栏自己出空态），不挡住配置区。
     */
    async loadEmployeeThreads(agentId) {
      const id = String(agentId ?? '')
      if (!id) return []
      const soloTeam = useSoloTeamStore()
      try {
        await soloTeam.fetchEmployeeThreads(id)
      } catch (err) {
        console.error('[Contacts] 加载员工会话失败:', err)
      }
      return this.threadsOf(id)
    },

    // ── 组织目录 ──────────────────────────────

    /** 首次进组织目录：拉根部门并自动展开/选中第一个 */
    async loadOrgRoots() {
      if (this.departments.length) return this.departments
      this.orgLoading = true
      try {
        const roots = await fetchRootDepartments()
        const tree = (roots || []).map((d) => ({
          id: d.id,
          name: d.name,
          fullName: d.full_name || d.name,
          hasChildren: Boolean(d.has_children),
          children: null,
          virtual: false,
        }))
        this.departments = tree
        const dhs = useDigitalHumanStore()
        dhs.fetchAgents().catch(() => { /* 数字同事拉不到不挡住真人目录 */ })
        if (tree[0] && !this.activeDeptId) {
          await this.drillToFirstLeafDept()
        }
      } catch (err) {
        console.error('[Contacts] 加载组织架构失败:', err)
      } finally {
        this.orgLoading = false
      }
      return this.departments
    },

    /**
     * 组织目录的默认落点：从第一个根部门一路下钻到末级部门。
     * 上级部门基本没有直属成员（人都挂在末级），落在根上主区就是一片
     * 「这个部门没有直属成员」，等于让人对着空白发呆。
     */
    async drillToFirstLeafDept() {
      let node = this.departments[0]
      let guard = 0
      // guard 防的是脏数据造出来的环，正常组织架构不会有 6 层以上
      while (node?.hasChildren && guard < 6) {
        guard += 1
        // expandDept 是 toggle，已经展开的别再点一次，否则会收起来
        if (node.children === null || !this.expandedDeptIds.includes(String(node.id))) {
          await this.expandDept(node.id)
        }
        const child = node.children?.[0]
        if (!child) break
        node = child
      }
      if (node) await this.selectDept(node.id)
      return node?.id ?? null
    },

    findDept(deptId, list = this.departments) {
      for (const node of list) {
        if (String(node.id) === String(deptId)) return node
        if (node.children?.length) {
          const hit = this.findDept(deptId, node.children)
          if (hit) return hit
        }
      }
      return null
    },

    /** 展开/收起部门；首次展开时懒加载子部门 */
    async expandDept(deptId) {
      const node = this.findDept(deptId)
      if (!node) return
      const idx = this.expandedDeptIds.indexOf(String(deptId))
      if (idx >= 0) {
        this.expandedDeptIds.splice(idx, 1)
        return
      }
      this.expandedDeptIds.push(String(deptId))
      if (node.hasChildren && node.children === null) {
        try {
          const children = await fetchDepartmentChildren(node.id)
          node.children = (children || []).map((d) => ({
            id: d.id,
            name: d.name,
            fullName: d.full_name || d.name,
            hasChildren: Boolean(d.has_children),
            children: null,
            virtual: false,
          }))
        } catch (err) {
          console.error('[Contacts] 加载子部门失败:', err)
          node.children = []
        }
      }
    },

    /** 市场推荐：拉一页热门，组件自己决定展示几个 */
    async loadMarketRecos() {
      if (this.marketRecos.length) return this.marketRecos
      try {
        const res = await fetchAgentList({ page: 1, pageSize: 12, sort: 'downloads' })
        const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
        this.marketRecos = items.map((it) => ({
          id: String(it.id ?? it.agent_id ?? ''),
          name: it.display_name || it.name || '',
          avatar: it.avatar_url || it.avatar || '',
          summary: it.summary || it.description || '',
          tags: Array.isArray(it.tags) ? it.tags : [],
          isInstalled: Boolean(it.isInstalled ?? it.is_installed),
        })).filter((it) => it.id && it.name)
      } catch (err) {
        console.error('[Contacts] 加载市场推荐失败:', err)
        this.marketRecos = []
      }
      return this.marketRecos
    },

    /** 一键聘用（走市场真实聘用接口；demo 下 mock 会写进聘用状态） */
    async hireRecommended(item) {
      if (!item?.id || this.hiringId) return false
      this.hiringId = String(item.id)
      try {
        await hireAgent(item.id, {})
        // demo 桥（与市场那条聘用路径共用同一份实现）
        syncHiredEmployeeToDemoMock({
          id: item.id,
          name: item.name,
          avatar: item.avatar,
          description: item.summary,
          tags: item.tags,
        })
        // 在通讯录里聘的就留在通讯录（市场那边才跳去开会话）：刷新我的员工 + 把这条从推荐里摘掉
        await this.loadEmployees({ force: true })
        this.marketRecos = this.marketRecos.map((a) =>
          String(a.id) === String(item.id) ? { ...a, isInstalled: true } : a,
        )
        return true
      } catch (err) {
        console.error('[Contacts] 聘用失败:', err)
        return false
      } finally {
        this.hiringId = null
      }
    },

    /** 概览条：全公司人数（真接口没有就保持 null，UI 自己隐藏那一格） */
    async loadHeadcount() {
      if (this.headcount != null) return this.headcount
      try {
        this.headcount = await fetchOrgHeadcount()
      } catch {
        this.headcount = null
      }
      return this.headcount
    },

    /** 列表头胶囊：在「当前部门」和「全公司数字同事」之间切 */
    toggleAgentOnly() {
      this.agentOnly = !this.agentOnly
      this.activeProfile = null
      if (this.agentOnly) {
        // 进全局筛选时清掉搜索，两个筛法不叠加，免得用户搞不清在看什么
        this.orgKeyword = ''
        this.orgSearchResults = null
      }
    },

    /** 打开/关闭右侧档案卡 */
    openProfile(member) {
      this.activeProfile = member || null
    },
    closeProfile() {
      this.activeProfile = null
    },

    /** 选中部门 → 拉人员（数字同事走 digitalHuman store，不请求 IAM） */
    async selectDept(deptId) {
      this.activeDeptId = String(deptId)
      this.orgKeyword = ''
      this.orgSearchResults = null
      this.activeProfile = null
      this.agentOnly = false // 点了具体部门就退出「全公司数字同事」筛选
      // 上级部门多半没有直属成员，顺手展开下级，别让用户对着空列表发呆
      const node = this.findDept(deptId)
      if (node?.hasChildren && !this.expandedDeptIds.includes(String(deptId))) {
        this.expandDept(deptId)
      }
      if (this.profilesByDept[String(deptId)]) return
      // 真人和数字同事并行拉，谁挂了都不影响另一半
      const [profiles, agents] = await Promise.all([
        fetchDepartmentProfiles(deptId).catch((err) => {
          console.error('[Contacts] 加载部门人员失败:', err)
          return []
        }),
        fetchDepartmentAgents(deptId).catch((err) => {
          console.error('[Contacts] 加载部门数字同事失败:', err)
          return []
        }),
      ])
      this.profilesByDept[String(deptId)] = profiles || []
      this.agentsByDept[String(deptId)] = agents || []
    },

    /** 组织目录搜索：真人走 IAM 搜索，数字同事本地过滤，混在一起出结果 */
    async searchOrg(keyword) {
      const kw = String(keyword ?? '').trim()
      this.orgKeyword = kw
      if (kw) this.agentOnly = false
      if (!kw) {
        this.orgSearchResults = null
        return
      }
      const lower = kw.toLowerCase()
      const agents = this.digitalColleagues.filter((a) => a.name.toLowerCase().includes(lower))
      let humans = []
      try {
        const results = await searchProfiles(kw)
        humans = (results || []).map(toHumanMember)
      } catch (err) {
        console.error('[Contacts] 搜索联系人失败:', err)
      }
      // 关键词已变（用户接着敲）就丢弃这次的迟到结果
      if (this.orgKeyword !== kw) return
      this.orgSearchResults = [...humans, ...agents]
    },
  },
})
