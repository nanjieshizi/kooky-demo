// ─────────────────────────────────────────────────────────────
// 一人团队 · 产研演示编排引擎（demo only）
//
// 目的：给老板演一条端到端「一人指挥 AI 团队」的完整线——
//   主会话下需求 → 团队助理拆解规划 → 串行调数字人执行（可围观思考/工具/todo）
//   → 产出交付物 → 完成态验收。
//
// 交互模型（已与 Pata 对齐）：
//   · 主会话（群）：团队助理主导，多次「主动说话」——先出规划（步骤+分工），
//     再在每步推进时用自己的话流式播报进度（带结构化进度块）。成员由助理转述。
//   · 子会话（任务）：只有「我 + 团队助理」说话；成员的执行细节通过「围观」露出
//     （点成员头像看其思考/工具/todo），成员不在子会话里发聊天气泡。
//   · 演示节奏：由一个纯演示用的「▶ 推进」按钮手动控制（demoState 驱动），
//     不靠自动计时干等。每点一次 = 完成当前步 + 启动下一步。
//
// 只在 IS_DEMO 下由 dev-mocks 触发。真实后端接通后整块可摘除。
// ─────────────────────────────────────────────────────────────
import { reactive } from 'vue'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { planFromDirector } from './planFromDirector.mjs'

// ── 围观执行轨迹：响应式单例 ──
// TaskConversationPane 读它，用 EmployeeChat 那三个只读组件渲染成员执行细节。
// key: `${taskId}|${memberId}`；busy 字段驱动子会话头像红/绿点。
export const execTraceStore = reactive({ traces: {} })

export function execTraceKey(taskId, memberId) {
  return `${taskId}|${memberId}`
}

export function getExecTrace(taskId, memberId) {
  if (!taskId || memberId == null) return null
  return execTraceStore.traces[execTraceKey(taskId, memberId)] || null
}

function ensureTrace(taskId, memberId) {
  const key = execTraceKey(taskId, memberId)
  if (!execTraceStore.traces[key]) {
    execTraceStore.traces[key] = reactive({
      reasoning: '',
      isReasoningStreaming: false,
      toolSteps: [],
      toolsLoading: false,
      todos: [],
      entries: [], // 有序流水账：{type:'reasoning',text} / {type:'tool',name,args,result} 交替，保留穿插顺序
      busy: false,
      done: false,
    })
  }
  return execTraceStore.traces[key]
}

// ── 演示推进状态：驱动「▶ 推进」浮层按钮 ──
export const demoState = reactive({
  active: false,        // 剧本进行中（按钮可见）
  teamId: '',
  taskId: '',
  step: 0,              // 当前正在执行的步骤（0-based）
  total: 0,
  title: '',            // 当前步骤标题
  running: false,       // 某步正在流式跑（按钮临时禁用，防连点）
  awaitingStart: false, // 计划已出、等用户点「开始执行」才跑第一步
  finished: false,      // 全部完成
  plan: null,           // 生产 OnePersonPlanCard 的 plan 快照（由 syncPlan 投影，整对象替换）
  taskObj: null,        // 当前活跃任务对象（直接给拍平后主会话的成员条/目标读，绕过 store 加载态陷阱）
})

// 「出场」成员（by teamId → agentId 数组）：员工平时隐性，被 @ 或参与任务才在标题栏显性头像
export const emergedMembers = reactive({})
export function noteEmergedMembers(teamId, agentIds = []) {
  const key = String(teamId)
  const cur = new Set(emergedMembers[key] || [])
  agentIds.forEach((id) => { if (id != null && id !== '') cur.add(String(id)) })
  emergedMembers[key] = [...cur]
}
export function resetEmergedMembers(teamId) {
  delete emergedMembers[String(teamId)]
}

// 专项作战室聚焦的员工（by teamId → memberId）：会话工作卡点击 / 作战室工位点击都设它，下方展开其工作流
export const warRoomFocus = reactive({})
export function focusWorkMember(teamId, memberId) {
  warRoomFocus[String(teamId)] = memberId == null ? null : String(memberId)
}

// 静态样本任务：给预置会话注入"作战室状态"（无实时剧本时，作战室也能显示工位 / 进度 / 工作流）
// teamId -> { id, participants:[{agent_id,name,avatar}] }
export const staticTasks = reactive({})
export function seedStaticTask(teamId, { id, title = '', participants = [], traces = {} }) {
  staticTasks[String(teamId)] = { id, title, participants }
  Object.entries(traces).forEach(([mid, data]) => {
    const tr = ensureTrace(id, mid)
    if (Array.isArray(data.todos)) tr.todos = data.todos
    if (Array.isArray(data.entries)) tr.entries = data.entries
    if (typeof data.reasoning === 'string') tr.reasoning = data.reasoning
    if ('busy' in data) tr.busy = data.busy
    if ('done' in data) tr.done = data.done
  })
  upgradeTeam(teamId)
}

// 打断状态（by teamId）：作战室「打断 / 继续」按钮切换 + 群里发一条「我」的消息
export const interruptState = reactive({})
export function isInterrupted(teamId) { return !!interruptState[String(teamId)] }
export async function toggleInterrupt(teamId) {
  const key = String(teamId)
  const paused = !interruptState[key]
  interruptState[key] = paused
  const ctx = rndCtx[teamId]
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!ctx || !optMock) return
  const step = ctx.steps?.[demoState.step]
  const name = step?.member?.name || '各位'
  const mainThreadId = ctx.mainThreadId
  const list = optMock.threadMessages.get(`${teamId}|${mainThreadId}`) || []
  const seq = list.reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  const userInfo = (() => { try { return JSON.parse(localStorage.getItem('super-assistant-userInfo') || '{}') } catch { return {} } })()
  optMock.threadMessages.set(`${teamId}|${mainThreadId}`, [...list, {
    id: `msg-interrupt-${mainThreadId}-${seq}`, seq, author_type: 'human',
    display_name: userInfo.name || '我', avatar: userInfo.avatar || '',
    content: paused ? `@${name} 先停一下 ✋` : `@${name} 好了，继续吧 👍`,
    thread_id: mainThreadId, status: 'completed', created_at: new Date().toISOString(),
  }])
  ctx.store?.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })
}

// 剧本 phase 变更后，把计划快照投影给生产的执行计划卡。
// 整对象替换（与生产「修订号单调、快照整体替换」的语义一致）。
function syncPlan(ctx) {
  demoState.plan = planFromDirector(ctx)
}

// ── 时间线小工具 ──
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 逐字吐字，做出「思考中…」的流式观感
async function streamReasoning(trace, text, { chunk = 6, gap = 36 } = {}) {
  trace.isReasoningStreaming = true
  if (!trace.entries) trace.entries = []
  const entry = reactive({ type: 'reasoning', text: '' })
  trace.entries.push(entry)
  for (let i = 0; i < text.length; i += chunk) {
    trace.reasoning += text.slice(i, i + chunk)
    entry.text += text.slice(i, i + chunk)
    await wait(gap)
  }
  trace.reasoning += '\n\n'
}

let nextStepId = 1
function pushToolStep(trace, { name, args, result }) {
  trace.toolsLoading = true
  const step = { id: `demo-step-${nextStepId++}`, type: 'toolCall', name, args, result: result || '' }
  trace.toolSteps.push(step)
  if (!trace.entries) trace.entries = []
  trace.entries.push({ type: 'tool', ...step })
}

// 更新 store 里某条消息的 content —— 用「整块重建 items 数组 + 重赋 map」强制响应式重渲染，
// 保证逐字打字效果真的一帧一帧出来（直接改对象属性在这套 store 下不稳，会整条闪出）。
function setStoreMsgContent(store, threadId, msgId, content, isStreaming) {
  const key = String(threadId)
  const state = store.onePersonMessagesByThreadId?.[key]
  if (!state || !Array.isArray(state.items)) return false
  const idx = state.items.findIndex((m) => String(m.id) === String(msgId))
  if (idx < 0) return false
  const nextItems = state.items.slice()
  nextItems[idx] = { ...nextItems[idx], content, isStreaming }
  store.onePersonMessagesByThreadId = {
    ...store.onePersonMessagesByThreadId,
    [key]: { ...state, items: nextItems },
  }
  return true
}

// ── 团队助理聊天消息「打字机」流式输出 ──
// 先推一条空消息 + 归一化进 store，再逐字重建那条消息的 content（每帧重赋数组，真打字）。
async function streamChatMessage(ctx, threadId, refetch, streamText, { payload = null, attachments = null, gap = 34, chunk = 2, author = null } = {}) {
  const { store, teamId, optMock, now, assistantAvatar } = ctx
  const key = `${teamId}|${threadId}`
  const list = optMock.threadMessages.get(key) || []
  const seq = list.reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  const msgId = `msg-director-${threadId}-${seq}`
  const full = streamText
  const base = {
    id: msgId, seq,
    author_type: author?.type || 'system',
    display_name: author?.name || '我的分身',
    avatar: author?.avatar || assistantAvatar,
    // normalizeOnePersonMessage 读的是 avatar_url，只写 avatar 会被忽略、
    // 一路兜底成分身头像 —— 员工说话时头像就不对了
    avatar_url: author?.avatar || assistantAvatar,
    thread_id: threadId, status: 'completed', created_at: now(),
    ...(payload ? { payload } : {}),
    ...(attachments && attachments.length ? { attachments } : {}),
  }
  optMock.threadMessages.set(key, [...list, { ...base, content: '' }])
  await refetch()

  // 每帧同时更新 mock + 重赋 store —— 并发 refetch(settle/轮询) 读到的也是当前进度，不会清回空
  const writeContent = (content, isStreaming) => {
    optMock.threadMessages.set(key, (optMock.threadMessages.get(key) || []).map((m) => (m.id === msgId ? { ...m, content } : m)))
    setStoreMsgContent(store, threadId, msgId, content, isStreaming)
  }

  // 逐字打字（isStreaming 保持 false —— 该 store 在 isStreaming=true 时不渲染 content，
  // 而增长的 content 本身就是打字效果）
  let acc = ''
  for (let i = 0; i < streamText.length; i += chunk) {
    acc += streamText.slice(i, i + chunk)
    writeContent(acc, false)
    await wait(gap)
  }
  writeContent(full, false) // 打完 + 补结构块整块补上
}

function memberId(m) {
  return m?.agent_id ?? m?.id
}

function memberDescription(optMock, id) {
  const e = (optMock.employees || []).find((x) => String(x.agent_id) === String(id))
  return e?.description || e?.bio || ''
}

// ─────────────────────────────────────────────────────────────
// 开箱剧本：建团队后自动起的「成员相互介绍」任务
// 让新团队一创建就有一个「活」的可围观任务——成员依次自我介绍，
// 每个成员都有只读执行轨迹，用户可点进去看、也可以不看。
// ─────────────────────────────────────────────────────────────
const playedIntro = new Set()

/**
 * 播放「成员相互介绍」开箱剧本。
 * @param {string} teamId
 */
export async function playIntroDemo(teamId) {
  if (!teamId || playedIntro.has(teamId)) return
  playedIntro.add(teamId)

  const store = useSoloTeamStore()
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!store || !optMock) return
  const snap = optMock.teamHomeSnapshots.get(teamId)
  if (!snap) { playedIntro.delete(teamId); return }

  const members = snap.members || snap.team?.members || []
  if (!members.length) return
  const introTaskId = `task-intro-${teamId}`
  const introThreadId = `thread-intro-${teamId}`
  const now = () => new Date().toISOString()

  const list = () => optMock.threadMessages.get(`${teamId}|${introThreadId}`) || []
  const push = (msg) => optMock.threadMessages.set(`${teamId}|${introThreadId}`, [...list(), msg])
  const nextSeq = () => list().reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  const refetchIntro = () => store.loadOnePersonThreadMessages?.(teamId, introThreadId, { force: true, taskId: introTaskId })

  const setIntroStatus = (status, preview) => {
    snap.tasks = (snap.tasks || []).map((t) =>
      (t.id === introTaskId || t.task_id === introTaskId)
        ? { ...t, status, ...(preview ? { latest_message_preview: preview } : {}) }
        : t,
    )
  }

  try {
    setIntroStatus('active', '成员正在依次自我介绍')
    await store.loadOnePersonTeamTasks?.(teamId, { force: true })
    store._setOnePersonThreadThinking?.(introThreadId, true)

    for (const m of members) {
      const id = m.agent_id ?? m.id
      const name = m.name || '成员'
      const desc = memberDescription(optMock, id)

      const trace = ensureTrace(introTaskId, id)
      trace.busy = true
      trace.todos = [
        { content: '介绍背景与专长', status: 'in_progress' },
        { content: '说明协作偏好', status: 'pending' },
      ]
      await streamReasoning(trace, `我先把自己的定位讲清楚：${desc || '负责团队里对应的专业模块'}。这样团队助手后续派活能第一时间找到我。`, { gap: 22 })
      trace.todos[0].status = 'completed'
      trace.todos[1].status = 'in_progress'

      await wait(260)
      const introMsg = {
        id: `msg-intro-${introThreadId}-${id}`,
        seq: nextSeq(),
        author_type: 'agent',
        display_name: name,
        avatar: m.avatar,
        content: `大家好，我是${name}，${desc || '负责团队里对应的专业模块'}。协作上我习惯先对齐目标再动手，有相关需求随时 @ 我。`,
        thread_id: introThreadId,
        status: 'completed',
        created_at: now(),
      }
      push(introMsg)
      await refetchIntro()
      trace.todos[1].status = 'completed'
      trace.isReasoningStreaming = false
      trace.busy = false
      trace.done = true
    }

    store._setOnePersonThreadThinking?.(introThreadId, false)
    setIntroStatus('completed', '成员已相互介绍完毕')
    await store.loadOnePersonTeamTasks?.(teamId, { force: true })
    void store.loadOnePersonTaskSidebar?.({ force: true })
  } catch (err) {
    console.warn('[opt-director] 介绍剧本播放异常：', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 产研剧本：把用户需求做成一份可评审 PRD —— 三步串行 · 手动推进
// 分工：需求拆解+竞品 → 产品经理；交互原型 → UI 设计师；技术评估 → 架构师；
//       汇总 PRD → 产品经理。首选按 agent_id 匹配，缺席则回退到现有成员。
// ─────────────────────────────────────────────────────────────
const RND_STEP_DEFS = [
  {
    short: '需求拆解', title: '需求拆解 + 竞品调研', role: 1001,
    announce: '第一阶段为需求拆解与竞品调研，由产品经理负责：先明确目标用户与核心使用场景，并盘点同类周报工具的能力边界。这一阶段的结论将决定后续原型与技术方案的范围，需要作为基线夯实。',
    reasoning: [
      '先对照目标：给「个人 / 小团队」用的周报助手，核心价值是「少填、自动汇总、一键成稿」。我按目标用户 → 核心流程 → 功能清单来拆。',
      '看一遍现有周报规范的字段口径，再扫同类工具怎么做自动化，收敛功能框架。',
      '把目标用户分两类：个人贡献者和小团队负责人。两者填报频率、痛点不一样，功能优先级得区分开，不能一锅烩。',
      '核心流程我先在脑子里跑一遍：数据从哪来 → 怎么抽本周进展 → 成稿模板长啥样 → 导出去哪。每一步都得想好兜底，不然自动化一断就废。',
      '数据源这块是关键，得看清主流系统的接入成本，别在框架里承诺了接不进来的东西。',
      '再核对一遍竞品的定价和能力边界，确认我们的差异点站得住，最后把结论落成文档、功能按 P0/P1 分级，给下游原型和技术评估当基线。',
    ],
    tools: [
      { name: 'read_file', args: { path: '团队知识库/周报规范.md' }, result: '提取现有周报字段与填写口径' },
      { name: 'web_search', args: { query: 'AI 周报助手 自动汇总 竞品 2026' }, result: '5 款同类产品，归纳出「数据源接入 / 智能摘要 / 模板化」三类能力' },
      { name: 'read_file', args: { path: '团队知识库/用户访谈纪要.md' }, result: '12 篇访谈，高频诉求：少填、自动、可微调' },
      { name: 'web_search', args: { query: '周报工具 数据源接入 飞书 / 钉钉 / Jira 成本' }, result: '主流数据源 6 个，接入成本从低到高已排序' },
      { name: 'read_file', args: { path: '竞品/定价与能力对比.csv' }, result: '竞品定价中位偏低，模板化是主要差异点' },
      { name: 'write_file', args: { path: '需求结论.md' }, result: '输出需求结论：目标用户 / 核心场景 / 功能框架（P0-P1）' },
    ],
    todos: ['拆解目标用户与核心场景', '盘点数据源与接入成本', '调研同类周报工具形态', '核对竞品定价与能力边界', '产出需求结论与功能框架'],
    done: '产品经理已完成需求拆解：目标用户与核心场景已明确，同类工具能力盘点完成，功能框架初步成型。',
    report: '目标用户和核心场景我理清了，同类周报工具也盘了一遍，功能框架成型，结论我整理好了。',
    plan: '我打算先明确目标用户和核心场景，再盘一遍同类周报工具的做法，把功能框架收敛出来。',
    artifact: {
      id: 'gf-req-result', name: '需求结论.md', type: 'md', fileType: 'md', mime_type: 'text/markdown',
      content: '# 《AI 周报助手》需求结论\n\n## 目标用户\n- 个人贡献者：每周向上汇报，苦于重复整理\n- 小团队负责人：汇总多人进展成团队周报\n\n## 核心场景\n1. 接入日报 / 任务系统 / 日历\n2. 自动抽取本周进展、风险、下周计划\n3. 一键成稿，微调后导出 / 发送\n\n## 功能框架\n- 数据接入（P0）\n- 智能摘要（P0）\n- 模板成稿（P0）\n- 协同评论（P1）',
    },
  },
  {
    short: '交互原型', title: '交互流程 + 原型草图', role: 1004,
    announce: '进入第二阶段：交互流程与原型设计，交由 UI 设计师。基于需求结论，梳理「接入 → 生成 → 微调 → 导出」主流程，产出低保真原型并标注关键交互状态。',
    reasoning: [
      '基于功能框架，把「接入 → 生成 → 微调 → 导出」串成主流程。',
      '画低保真原型：首页汇总卡、生成态、编辑态、导出面板，并标注关键交互态。',
    ],
    tools: [
      { name: 'write_file', args: { path: 'wireframe-周报助手.md' }, result: '输出 4 屏低保真原型与交互说明' },
    ],
    todos: ['梳理核心交互流程', '产出低保真原型', '标注关键交互态'],
    done: 'UI 设计师已交付交互流程与低保真原型，关键交互状态标注完整。',
    report: '接入→生成→微调→导出的主流程我串好了，低保真原型 4 屏画完，关键交互态都标注了。',
    plan: '我会基于需求结论，把「接入 → 生成 → 微调 → 导出」主流程串起来，画一版低保真原型。',
    artifact: {
      id: 'gf-wireframe', name: 'wireframe-周报助手.md', type: 'md', fileType: 'md', mime_type: 'text/markdown',
      content: '# 低保真原型 · AI 周报助手\n\n## 主流程\n接入 → 生成 → 微调 → 导出\n\n## 4 屏\n1. **首页汇总卡**：本周进展一览 +「生成周报」入口\n2. **生成态**：AI 抽取中，进度反馈\n3. **编辑态**：分段可改，支持补充 / 批注\n4. **导出面板**：Markdown / 富文本，一键复制 / 发送\n\n## 关键交互态\n空态 / 生成中 / 生成完成 / 编辑 / 导出成功',
    },
  },
  {
    short: '技术评估', title: '技术可行性评估', role: 1005,
    announce: '进入第三阶段：技术可行性评估，由架构师负责。重点评估数据接入方式、摘要模型选型与导出渲染三条路径，并识别主要风险，为 PRD 收敛范围提供依据。',
    reasoning: [
      '评估三条技术路径：数据源接入方式、摘要模型选型、导出渲染方案。',
      '给出可行性结论与风险点，帮 PRD 收敛范围。',
    ],
    tools: [
      { name: 'write_file', args: { path: '技术可行性评估.md' }, result: '给出选型建议与 3 条风险项' },
    ],
    todos: ['评估数据接入与摘要选型', '评估导出渲染方案', '输出可行性结论'],
    done: '架构师已完成技术可行性评估，给出选型建议并列出三项主要风险，PRD 范围可据此收敛。',
    report: '三条技术路径我都评了，选型建议 + 3 条主要风险列好了，PRD 范围可以据此收敛。',
    plan: '我来评估数据接入、摘要选型、导出渲染三条技术路径，给出可行性结论和主要风险点。',
    artifact: {
      id: 'gf-tech-eval', name: '技术可行性评估.md', type: 'md', fileType: 'md', mime_type: 'text/markdown',
      content: '# 技术可行性评估 · AI 周报助手\n\n## 三条路径\n| 方向 | 选型建议 |\n|---|---|\n| 数据接入 | 优先日报 / 任务系统 API，日历次之 |\n| 摘要模型 | 通用大模型 + 结构化 prompt |\n| 导出渲染 | Markdown 优先，富文本二期 |\n\n## 主要风险\n1. 多数据源字段口径不一，需做映射层\n2. 摘要质量依赖 prompt 调优，需迭代\n3. 导出格式兼容性（企业微信 / 飞书）待验证',
    },
  },
]

// 交付物附件：团队助理汇总后作为产物卡片发出（复用消息附件卡片样式，非纯链接）
const PRD_ATTACHMENT = {
  id: 'gf-rnd-prd-draft',
  name: 'prd-draft.md',
  type: 'md',
  mime_type: 'text/markdown',
}

const RND_GOAL = '输出一份可评审的《AI 周报助手》PRD：明确目标用户、核心流程、功能清单与验收标准。'

// teamId → 运行上下文
const rndCtx = {}

function resolveStepMember(members, role, idx) {
  const byRole = members.find((m) => String(memberId(m)) === String(role))
  return byRole || members[idx % members.length] || members[0] || null
}

// ── 对话阶段状态机（拍平后：下需求 → 澄清 → 组队确认 → 执行）──
// teamId → 'clarify1' | 'clarify2' | 'proposal' | 'executing'
const convoStage = {}

export function resetConvoStage(teamId) {
  delete convoStage[teamId]
}

// ── 演示：模拟真人输入（录 demo 用）──────────────────────────────
// 轮到用户发言的环节，把「该发的话」逐字模拟输入进主会话输入框（像真人在打字），
// 用户自己按发送；不需要用户发言的环节（分身思考、执行阶段）自动流转。
// 全程无演示按钮 / 提示条，看不出是脚本。
// demoPendingInput：按 teamId 存「待模拟输入的文本」。持久到被组件消费为止——
// 比一次性 nonce 信号更稳：即便主会话组件重挂 / 时序错开，挂载时也能拿到待填内容。
export const demoPendingInput = reactive({})

// 演示剧本里「该用户发」的三句话（下需求 + 两轮澄清答复）
const DEMO_SUGGESTIONS = {
  start: '帮我做一个「AI 周报助手」，把团队日报自动汇总成一份周报',
  clarify1: '个人用为主；数据接日报和任务系统',
  clarify2: '要一份能直接开工的完整 PRD',
}
// 触发「模拟输入」：延后 ~1.4s 把 text 挂到 demoPendingInput[teamId]，
// 让「分身回复完 → 输入框开始打字」之间有真实间隔，不秒填。
function typeUserMessage(teamId, text) {
  if (teamId == null || !text) return
  setTimeout(() => { demoPendingInput[String(teamId)] = text }, 1400)
}
// 进入空的演示会话：模拟输入第一条「下需求」
export function primeDemoInput(teamId) {
  typeUserMessage(teamId, DEMO_SUGGESTIONS.start)
}

// 分身单干模式（by teamId）：场景卡「做份 PRD」触发——分身自己产出，不组队、不派员工
const soloMode = {}
export function setSoloMode(teamId, on) { soloMode[String(teamId)] = !!on }

// 会话形态：solo(我 ⇄ 分身 1:1 私聊) → group(多数字人群)，单向升级。
// 预置的三个多人样本会话开局即群态；新建会话 / 产研先锋队默认 solo，靠「分身推荐」或「我拉人」升级。
const upgradedTeams = reactive({
  'demo-team-personal-blog': true,
  'opt-product-sprint': true,
  'opt-content-ops': true,
})
export function isTeamUpgraded(teamId) { return !!upgradedTeams[String(teamId)] }
export function upgradeTeam(teamId) { if (teamId != null) upgradedTeams[String(teamId)] = true }
export function getAssistantAvatar() {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  return optMock?.employees?.find((e) => String(e.agent_id) === '9001')?.avatar || ''
}

function makeConvoCtx(teamId, mainThreadId) {
  const store = useSoloTeamStore()
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  const now = () => new Date().toISOString()
  const assistantAvatar = optMock?.employees?.find((e) => String(e.agent_id) === '9001')?.avatar
  const ctx = { store, teamId, optMock, now, assistantAvatar, mainThreadId }
  const refetchMain = () => store.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })
  ctx.streamMain = (text, opts) => streamChatMessage(ctx, mainThreadId, refetchMain, text, opts)
  return ctx
}

/**
 * 1:1 单聊的对面是谁（teamId → {agent_id, name, avatar}）。
 * 有值就说明这条会话是「你和某个员工」，不是「你和分身牵头的一支队」。
 */
const soloChatPartner = {}
export function setSoloChatPartner(teamId, pick) {
  if (!pick?.agent_id) return
  soloChatPartner[String(teamId)] = {
    agent_id: pick.agent_id,
    name: pick.name || '数字员工',
    avatar: pick.avatar || '',
  }
}

/** 1:1 单聊的推进：由**该员工本人**回话（头像/名字都是他），不组队不派人 */
async function advanceSoloChat(teamId, mainThreadId, userText, partner) {
  const ctx = makeConvoCtx(teamId, mainThreadId)
  const { store } = ctx
  const author = { type: 'agent', name: partner.name, avatar: partner.avatar }
  const key = `solo:${teamId}`
  const stage = convoStage[key]
  const topic = String(userText || '').trim().slice(0, 30) || '这件事'

  store._setOnePersonThreadThinking?.(mainThreadId, true)
  await wait(700)

  if (!stage) {
    convoStage[key] = 'clarified'
    await ctx.streamMain(
      `收到，「${topic}」我来接 👌\n\n开工前先跟你对齐两点，免得返工：\n\n1. 这次要的是**能直接用的成品**，还是先出个**方向草稿**？\n2. 有没有已经定下来的约束（时间、范围、必须照顾的场景）？`,
      { author },
    )
  } else if (stage === 'clarified') {
    convoStage[key] = 'working'
    await ctx.streamMain(
      `明白，那我按这个来。\n\n我的做法是先把要点拆开、逐条过一遍，拿不准的地方我会标出来问你，不自己拍板。\n\n给我一会儿，出来我贴这儿。`,
      { author },
    )
  } else {
    await ctx.streamMain(
      `还在弄「${topic}」这摊事，有新的补充随时说，我一起算进去。`,
      { author },
    )
  }

  store._setOnePersonThreadThinking?.(mainThreadId, false)
}

/**
 * 用户在主会话每发一条消息，推进一步对话：
 *   下需求 → 分身澄清 → 用户答 → 分身第二轮确认 + 出组队方案卡（下一步）→ 用户确认开工 → 执行。
 * @param {string} teamId
 * @param {string} mainThreadId
 * @param {string} userText 用户这条消息原文
 */
export async function advanceConvo(teamId, mainThreadId, userText = '') {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!optMock) return
  // 1:1 单聊：对面是那个员工本人，不是分身 —— 走另一套剧本
  const partner = soloChatPartner[String(teamId)]
  if (partner) {
    await advanceSoloChat(teamId, mainThreadId, userText, partner)
    return
  }
  // 已进入执行阶段：不再拦截，交给现有执行剧本/推进按钮
  if (convoStage[teamId] === 'executing') return

  const ctx = makeConvoCtx(teamId, mainThreadId)
  const { store } = ctx
  const stage = convoStage[teamId]

  if (!stage) {
    // 第 1 轮：分身确认理解 + 澄清用途
    convoStage[teamId] = 'clarify1'
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(1600)
    await ctx.streamMain('好嘞，这事交给我 👌\n\n我先跟你把方向对齐一下——像「AI 周报助手」这类工具，核心价值通常是「少填、自动汇总、一键成稿」。开工前想先确认两点，免得白干：\n\n1. 主要给**你个人**用，还是**团队一起**用？\n2. 周报的数据从哪来 —— 日报、任务系统、还是日历？')
    store._setOnePersonThreadThinking?.(mainThreadId, false)
    typeUserMessage(teamId, DEMO_SUGGESTIONS.clarify1) // 轮到用户答第 1 轮 → 模拟输入
    return
  }

  if (stage === 'clarify1') {
    // 第 2 轮：回应 + 再确认交付范围
    convoStage[teamId] = 'clarify2'
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(1600)
    await ctx.streamMain('明白～那我就按「**个人用 + 接日报 / 任务系统**」来定基调。\n\n再跟你确认一个范围：这一版你是要一份**能直接开工的完整 PRD**（含目标用户、核心流程、功能清单、验收标准），还是先出个**轻量方案**探探方向就行？')
    store._setOnePersonThreadThinking?.(mainThreadId, false)
    typeUserMessage(teamId, DEMO_SUGGESTIONS.clarify2) // 轮到用户答第 2 轮 → 模拟输入
    return
  }

  if (stage === 'clarify2') {
    // 分身单干（PRD 场景卡）：不组队、不派人，分身自己写完交付
    if (soloMode[String(teamId)]) {
      await soloDeliver(teamId, mainThreadId)
      return
    }
    // 第 3 轮：确认理解 + 出【组队方案卡】（用户确认开工后才执行）
    convoStage[teamId] = 'proposal'
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(1600)
    await ctx.streamMain('收到，那就奔着**可评审的完整 PRD** 去。\n\n我把这活拆了下：产品拆需求、设计出原型、前端评估可行性，还差一类**数据分析**来接数据源。给你出个组队方案，你过一眼——缺的人当场就能从市场聘，确认就开工 👇')
    store._setOnePersonThreadThinking?.(mainThreadId, false)
    await wait(300)
    await showTeamProposal(teamId, mainThreadId)
    return
  }

  if (stage === 'proposal') {
    // 方案已出、用户还在打字（没点卡片按钮）：温和提示走卡片
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(500)
    await ctx.streamMain('收到～组队方案就在上面 👆 缺的成员可以直接聘，确认没问题点「确认开工」，我立刻开跑。')
    store._setOnePersonThreadThinking?.(mainThreadId, false)
    return
  }
}

// 分身单干：分身自己流式写完 PRD + 交付，全程无任务 / 无员工（作战室点开是空的）
async function soloDeliver(teamId, mainThreadId) {
  convoStage[teamId] = 'executing'
  const ctx = makeConvoCtx(teamId, mainThreadId)
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, true)
  await wait(700)
  await ctx.streamMain('这份 PRD 不算复杂，我自己来就行，不用麻烦大家 👌\n\n我按「目标用户 → 核心流程 → 功能清单 → 验收标准」四段来搭，先起框架，再逐节填内容。')
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, false)
  await wait(500)
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, true)
  await wait(1500)
  await ctx.streamMain('写好了 ✅\n\n四段都覆盖到了——目标用户、核心流程、功能清单、验收标准。草稿放群里了，你过一眼，要改哪节直接跟我说，我随时调。', {
    attachments: [{ id: 'gf-solo-prd', name: 'AI周报助手-PRD.md', type: 'md', fileType: 'md', mime_type: 'text/markdown', content: PRD_DRAFT_MD }],
  })
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, false)
}

// ── 组队方案卡（含聘用推荐）──
const PROPOSAL_BASE_MEMBERS = [
  { agent_id: 1001, name: '产品经理', role: '出 PRD', status: 'in_team' },
  { agent_id: 1004, name: 'UI 设计师', role: '出原型', status: 'in_team' },
  { agent_id: 1002, name: '全栈开发', role: '前后端实现', status: 'in_team' },
]
// 缺的这类（固定队没有）→ 推荐从市场聘用
const RECRUIT_MEMBER = { agent_id: 8001, name: '数据分析师 · Alice', role: '接数据源 · 本周数据抽取', status: 'need_hire' }

function proposalMsgId(teamId) { return `msg-team-proposal-${teamId}` }

async function showTeamProposal(teamId, mainThreadId) {
  const ctx = makeConvoCtx(teamId, mainThreadId)
  const { optMock, store, assistantAvatar, now } = ctx
  if (!optMock) return
  const avatarOf = (id) => optMock.employees?.find((e) => String(e.agent_id) === String(id))?.avatar
  const members = [
    ...PROPOSAL_BASE_MEMBERS.map((m) => ({ ...m, avatar: avatarOf(m.agent_id) })),
    { ...RECRUIT_MEMBER, avatar: avatarOf(1005) || avatarOf(1001) },
  ]
  const key = `${teamId}|${mainThreadId}`
  const list = optMock.threadMessages.get(key) || []
  const seq = list.reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  optMock.threadMessages.set(key, [...list, {
    id: proposalMsgId(teamId), seq, author_type: 'system', display_name: '我的分身', avatar: assistantAvatar,
    content: '', thread_id: mainThreadId, status: 'completed', created_at: now(),
    payload: { kind: 'team_proposal', understanding: '「AI 周报助手」—— 自动汇总本周进展、一键成稿', members },
  }])
  await store.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })
}

// 就地一键聘用：加入固定队 + 把卡上该成员标为「已聘·在队」
export function hireRecommendedMember(teamId, mainThreadId, agentId = 8001) {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!optMock) return
  const store = useSoloTeamStore()
  const key = `${teamId}|${mainThreadId}`
  const list = optMock.threadMessages.get(key) || []
  const recruit = list.find((m) => m.id === proposalMsgId(teamId))?.payload?.members
    ?.find((m) => String(m.agent_id) === String(agentId))

  // 1. 加入固定队 members（标题栏 +1）
  const team = [...(optMock.teams || []), ...(optMock.createdTeams || [])].find((t) => t.team_id === teamId)
  if (team && Array.isArray(team.members) && !team.members.some((m) => String(m.agent_id) === String(agentId))) {
    team.members = [...team.members, { agent_id: agentId, name: recruit?.name || '数据分析师', avatar: recruit?.avatar, role: 'agent', presence: { status: 'idle' } }]
    team.member_count = team.members.length
    const snap = optMock.teamHomeSnapshots.get(teamId)
    if (snap) snap.members = team.members
  }
  // 2. 卡上该成员 status → hired
  optMock.threadMessages.set(key, list.map((m) => {
    if (m.id !== proposalMsgId(teamId)) return m
    return { ...m, payload: { ...m.payload, members: (m.payload.members || []).map((mm) => String(mm.agent_id) === String(agentId) ? { ...mm, status: 'hired' } : mm) } }
  }))
  store.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })
  store.loadOnePersonTeamsFromApi?.()
}

// 我主动拉人（选人面板 → 拉进会话）：加成员 + 升级成群 + 分身在群里打个招呼
/**
 * @param {object} [opts]
 * @param {boolean} [opts.soloChat] 1:1 单聊：开场白由**他本人**说，
 *   不是分身来一句「已经把 X 拉进会话了」—— 点进来就是跟他的聊天页。
 */
export async function inviteMembers(teamId, mainThreadId, picks = [], { soloChat = false } = {}) {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!optMock || !picks.length) return
  const store = useSoloTeamStore()
  const team = [...(optMock.teams || []), ...(optMock.createdTeams || [])].find((t) => t.team_id === teamId)
  if (team && Array.isArray(team.members)) {
    picks.forEach((p) => {
      if (!team.members.some((m) => String(m.agent_id) === String(p.agent_id))) {
        team.members = [...team.members, { agent_id: p.agent_id, name: p.name, avatar: p.avatar, role: 'agent', presence: { status: 'idle' } }]
      }
    })
    team.member_count = team.members.length
    const snap = optMock.teamHomeSnapshots.get(teamId)
    if (snap) snap.members = team.members
  }
  upgradeTeam(teamId)
  noteEmergedMembers(teamId, picks.map((p) => p.agent_id)) // 拉进来的人在标题栏浮现
  store.loadOnePersonTeamsFromApi?.()
  // 1:1 单聊：记下对面是谁（advanceConvo 要用「他本人」的身份回话），开场白也由他自己说
  if (soloChat && picks.length === 1) {
    const partner = picks[0]
    setSoloChatPartner(teamId, partner)
    const soloCtx = makeConvoCtx(teamId, mainThreadId)
    await soloCtx.streamMain('我在 👋 有什么活直接说，或者把文件丢给我。', {
      author: { type: 'agent', name: partner.name, avatar: partner.avatar },
    })
    return
  }
  const ctx = makeConvoCtx(teamId, mainThreadId)
  const names = picks.map((p) => p.name).join('、')
  const suffix = picks.length > 1 ? '他们' : '他'
  await ctx.streamMain(`已经把 ${names} 拉进会话了 🙌 有活直接 @ ${suffix}，或者跟我说一声，我来派。`)
}

// 移出群成员（成员管理里的「删」）
export function removeMember(teamId, agentId) {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!optMock) return
  const team = [...(optMock.teams || []), ...(optMock.createdTeams || [])].find((t) => t.team_id === teamId)
  if (team && Array.isArray(team.members)) {
    team.members = team.members.filter((m) => String(m.agent_id) !== String(agentId))
    team.member_count = team.members.length
    const snap = optMock.teamHomeSnapshots.get(teamId)
    if (snap) snap.members = team.members
  }
  try { useSoloTeamStore().loadOnePersonTeamsFromApi?.() } catch (_) { /* noop */ }
}

// 把组队卡上的成员真正加进 team.members + snap.members（新会话花名册本是空的，卡上"在队"只是展示）
function ensureProposalMembers(teamId, mainThreadId) {
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!optMock) return
  const list = optMock.threadMessages.get(`${teamId}|${mainThreadId}`) || []
  const proposed = list.find((m) => m.id === proposalMsgId(teamId))?.payload?.members || []
  const team = [...(optMock.teams || []), ...(optMock.createdTeams || [])].find((t) => t.team_id === teamId)
  if (!team || !Array.isArray(team.members)) return
  proposed.forEach((p) => {
    if (!team.members.some((m) => String(m.agent_id) === String(p.agent_id))) {
      team.members = [...team.members, { agent_id: p.agent_id, name: p.name, avatar: p.avatar, role: 'agent', presence: { status: 'idle' } }]
    }
  })
  team.member_count = team.members.length
  const snap = optMock.teamHomeSnapshots.get(teamId)
  if (snap) snap.members = team.members
  // 刷新 onePersonTeams，主会话标题下方的团队成员条才拿得到人
  try { useSoloTeamStore().loadOnePersonTeamsFromApi?.() } catch (_) { /* noop */ }
}

// 确认开工：进执行阶段，接现有产研执行剧本（出目标 + 围观）
export async function confirmTeamProposal(teamId, mainThreadId) {
  if (convoStage[teamId] === 'executing') return
  convoStage[teamId] = 'executing'
  upgradeTeam(teamId) // 分身推荐组队 → 确认开工即升级成群
  ensureProposalMembers(teamId, mainThreadId) // 组队卡成员真加进队，剧本才拿得到人

  const ctx = makeConvoCtx(teamId, mainThreadId)
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, true)
  await wait(500)
  await ctx.streamMain('好嘞，队伍齐活，开干！🚀')
  ctx.store._setOnePersonThreadThinking?.(mainThreadId, false)
  await startProductRnDDemo(teamId, mainThreadId, '')
}

/**
 * 启动产研剧本：出规划 + 建任务 + 跑第 1 步（随后由「▶ 推进」按钮推进）。
 * @param {string} teamId
 * @param {string} mainThreadId
 * @param {string} seedText 用户下的需求原文
 */
export async function startProductRnDDemo(teamId, mainThreadId, seedText = '') {
  if (!teamId || rndCtx[teamId]) return
  const store = useSoloTeamStore()
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!store || !optMock) return
  const snap = optMock.teamHomeSnapshots.get(teamId)
  if (!snap) return
  const members = snap.members || snap.team?.members || []
  if (!members.length) return

  const now = () => new Date().toISOString()
  const taskId = `rnd-prd-${teamId}`
  const taskThreadId = `thread-${taskId}`
  const assistantAvatar = optMock.employees?.find((e) => String(e.agent_id) === '9001')?.avatar

  // 把步骤定义映射到团队现有成员
  const steps = RND_STEP_DEFS.map((def, i) => ({ ...def, member: resolveStepMember(members, def.role, i) }))
  // 去重的参与成员（子会话头像组）
  const seen = new Set()
  const participants = []
  steps.forEach((s) => {
    const id = memberId(s.member)
    if (!seen.has(String(id))) { seen.add(String(id)); participants.push({ agent_id: id, name: s.member.name, avatar: s.member.avatar, taskName: s.title }) }
  })

  const mainList = () => optMock.threadMessages.get(`${teamId}|${mainThreadId}`) || []
  const nextMainSeq = () => mainList().reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  const pushMain = (content, payload) => {
    const seq = nextMainSeq()
    optMock.threadMessages.set(`${teamId}|${mainThreadId}`, [...mainList(), {
      id: `msg-director-${mainThreadId}-${seq}`, seq, author_type: 'system', display_name: '我的分身',
      avatar: assistantAvatar, content, thread_id: mainThreadId, status: 'completed', created_at: now(),
      ...(payload ? { payload } : {}),
    }])
  }
  const refetchMain = () => store.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })
  const pushTask = (content) => {
    const list = optMock.threadMessages.get(`${teamId}|${taskThreadId}`) || []
    const seq = list.reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
    optMock.threadMessages.set(`${teamId}|${taskThreadId}`, [...list, {
      id: `msg-task-${taskThreadId}-${seq}`, seq, author_type: 'system', display_name: '我的分身',
      avatar: assistantAvatar, content, thread_id: taskThreadId, status: 'completed', created_at: now(),
    }])
  }
  const refetchTask = () => store.loadOnePersonThreadMessages?.(teamId, taskThreadId, { force: true, taskId })

  const ctx = {
    teamId, mainThreadId, taskId, taskThreadId, steps,
    phase: steps.map(() => 'pending'), entered: -1,
    store, optMock, snap, assistantAvatar, pushMain, refetchMain, pushTask, refetchTask, now,
  }
  ctx.streamMain = (text, opts) => streamChatMessage(ctx, mainThreadId, refetchMain, text, opts)
  // 拍平：执行叙述也发到主会话（不再有子会话）；围观 trace 数据仍按 taskId 记，UI 内联展示
  ctx.streamTask = (text, opts) => streamChatMessage(ctx, mainThreadId, refetchMain, text, opts)
  // 数字员工作为群成员发言（agent 身份，头像/名字用该成员）
  ctx.streamMember = (member, text, opts = {}) => streamChatMessage(ctx, mainThreadId, refetchMain, text, {
    ...opts,
    author: { type: 'agent', name: member?.name || '数字员工', avatar: member?.avatar },
  })
  rndCtx[teamId] = ctx
  syncPlan(ctx)

  // 预建所有成员的 trace（busy=false）；未开工不铺 todolist（进度条只展开当前步骤的小点）
  participants.forEach((p) => { ensureTrace(taskId, p.agent_id).busy = false })

  try {
    // ── 建任务（主会话冒任务卡 + 右侧任务面板 + 子会话入口）──
    const task = {
      id: taskId, task_id: taskId, title: '输出《AI 周报助手》PRD', status: 'active', goal: RND_GOAL,
      latest_message_preview: `分身已规划 ${steps.length} 步，串行推进中`,
      execution_thread_id: taskThreadId,
      participant_agent_ids: participants.map((p) => p.agent_id), participants,
      created_at: now(),
    }
    snap.tasks = [task, ...(snap.tasks || []).filter((t) => t.id !== taskId)]

    // ── 拍平：不再建子会话 / 冒可下钻任务卡，分身直接在这条会话里规划 + 执行 ──
    // （task 仍建，仅用于承载各成员的围观 trace 数据；execTrace 按 taskId 记）
    await store.loadOnePersonTeamTasks?.(teamId, { force: true })

    setStepActive(ctx, 0)
    demoState.active = true
    demoState.finished = false
    demoState.teamId = teamId
    demoState.taskId = taskId
    demoState.taskObj = task
    demoState.total = steps.length
    ctx.entered = 0

    const planLines = steps.map((s, i) => `${['①', '②', '③', '④'][i]} ${s.title} —— ${s.member.name}`).join('\n')
    const planText = `已收到需求。我把它拆成 ${steps.length} 个阶段，从你的员工里挑人串行推进，分工如下：\n\n${planLines}\n\n目标：${RND_GOAL}`
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(600)
    await ctx.streamMain(planText)
    store._setOnePersonThreadThinking?.(mainThreadId, false)

    // 分身派活第一步 → 员工在群里上场干活
    await wait(300)
    store._setOnePersonThreadThinking?.(mainThreadId, true)
    await wait(300)
    await ctx.streamMain(`那我们开始，第一步「${steps[0].title}」交给 ${steps[0].member.name}。`)
    store._setOnePersonThreadThinking?.(mainThreadId, false)
    await startStep(ctx, 0)
    // 执行阶段自动流转：不再靠手动「推进」按钮，逐步自动跑到交付
    scheduleAutoRnD(teamId)
  } catch (err) {
    console.warn('[opt-director] 剧本启动异常：', err)
  }
}

// 执行阶段自动流转：每隔一段自动推进一步，直到 finishRnD 置 finished（替代手动「▶ 推进」）
let autoRnDTimer = null
function scheduleAutoRnD(teamId, delay = 2200) {
  if (autoRnDTimer) { clearTimeout(autoRnDTimer); autoRnDTimer = null }
  if (demoState.finished) return
  autoRnDTimer = setTimeout(async () => {
    autoRnDTimer = null
    try { await advanceProductRnDDemo(teamId) } catch (e) { /* noop */ }
    if (!demoState.finished) scheduleAutoRnD(teamId)
  }, delay)
}

// 标记第 i 步为进行中：相位/状态/下一步提示/成员 busy + todos
function setStepActive(ctx, i) {
  // 前面所有步骤强制收绿（防止上一步最后一个 todo 卡在 in_progress 的蓝点）
  for (let k = 0; k < i; k++) {
    const s = ctx.steps[k]
    if (!s) continue
    const tr = ensureTrace(ctx.taskId, memberId(s.member))
    tr.todos.forEach((t) => { t.status = 'completed' })
    tr.busy = false
    tr.done = true
    ctx.phase[k] = 'completed'
  }
  const step = ctx.steps[i]
  ctx.phase[i] = 'active'
  demoState.step = i
  demoState.title = step.title
  const trace = ensureTrace(ctx.taskId, memberId(step.member))
  trace.busy = true
  const baseTodos = step.todos.map((t, k) => ({ content: t, status: k === 0 ? 'in_progress' : 'pending' }))
  trace.todos = trace.todos.length && String(trace.__stepKey) === String(i) ? trace.todos : baseTodos
  trace.__stepKey = i
  focusWorkMember(ctx.teamId, memberId(step.member)) // 某员工开工 → 自动切到他的屏幕
  syncPlan(ctx)
}

// 执行第 i 步的围观轨迹：逐字思考 + 工具调用 + todo 推进
async function runStepTrace(ctx, i) {
  const step = ctx.steps[i]
  const trace = ensureTrace(ctx.taskId, memberId(step.member))
  for (let r = 0; r < step.reasoning.length; r++) {
    await streamReasoning(trace, step.reasoning[r])
    if (step.tools[r]) pushToolStep(trace, step.tools[r])
    await wait(700) // 工具跑完停一下再勾完成，别瞬间勾掉
    if (trace.todos[r]) trace.todos[r].status = 'completed'
    if (trace.todos[r + 1]) trace.todos[r + 1].status = 'in_progress'
    await wait(1300) // 下一个 todo 慢点开工，真实一点
  }
  trace.isReasoningStreaming = false
}

// 员工上场：数字员工作为群成员发言（收到 + 工作卡）→ 执行轨迹（工作卡下钻读）
async function startStep(ctx, i) {
  const step = ctx.steps[i]
  if (!step) return
  const member = step.member
  setStepActive(ctx, i)
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, true)
  await wait(400)
  await ctx.streamMember(member, `收到！「${step.short}」这块交给我 🙌\n\n${step.plan || '我这就开始。'}\n\n这就开工，进度和产出我同步在群里。`, {
    payload: {
      kind: 'work_card',
      task_id: ctx.taskId,
      member_id: memberId(member),
      member_name: member.name,
      member_avatar: member.avatar,
      title: step.title,
    },
  })
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, false)
  await runStepTrace(ctx, i)
}

// 仅标记第 i 步完成（成员 idle + todo 全勾 + 相位 completed），不发消息——
// 「上阶段完成」的话术合并进「下阶段启动 / 收尾」那条消息，避免连发两条。
function markStepComplete(ctx, i) {
  const step = ctx.steps[i]
  if (!step) return
  const trace = ensureTrace(ctx.taskId, memberId(step.member))
  trace.todos.forEach((t) => { t.status = 'completed' })
  trace.toolsLoading = false
  trace.busy = false
  trace.done = true
  ctx.phase[i] = 'completed'
  syncPlan(ctx)
}

// 阶段切换：当前员工在群里汇报完成 → 分身接力派活 → 下一个员工上场
async function transitionStep(ctx, fromI, toI) {
  const fromStep = ctx.steps[fromI]
  const fromMember = fromStep.member
  markStepComplete(ctx, fromI)
  // 1. 当前员工在群里汇报完成 + 甩出中间产物
  await wait(300)
  await ctx.streamMember(
    fromMember,
    `「${fromStep.short}」我这边完成 ✅\n\n${fromStep.report}\n\n产出已经放群里了，@我的分身 交给你。`,
    { attachments: fromStep.artifact ? [{ ...fromStep.artifact }] : null },
  )
  // 2. 分身接力派活下一个
  const toStep = ctx.steps[toI]
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, true)
  await wait(400)
  await ctx.streamMain(`收到 ${fromMember.name} 的产出 👍 下面「${toStep.title}」交给 ${toStep.member.name}。`)
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, false)
  // 3. 下一个员工上场
  await startStep(ctx, toI)
}

/**
 * 「▶ 推进」按钮调用：完成当前阶段 →（合并）启动下一阶段 / 收尾交付。
 * @param {string} teamId
 */
export async function advanceProductRnDDemo(teamId) {
  const ctx = rndCtx[teamId]
  if (!ctx || demoState.running || demoState.finished) return
  demoState.running = true
  try {
    const i = ctx.entered
    if (i + 1 < ctx.steps.length) {
      ctx.entered = i + 1
      await transitionStep(ctx, i, i + 1)
    } else {
      markStepComplete(ctx, i)
      await finishRnD(ctx, i)
    }
  } catch (err) {
    console.warn('[opt-director] 推进异常：', err)
  } finally {
    demoState.running = false
  }
}

// 收尾：末阶段完成 + 团队助理汇总交付（产物作为附件卡片，非纯链接）
async function finishRnD(ctx, lastI) {
  const { store, teamId, taskId } = ctx
  const lastStep = ctx.steps[lastI]
  const lastMember = lastStep.member
  injectDeliverable(teamId, lastMember.name)

  // 1. 末位员工在群里汇报完成 + 甩出中间产物
  await wait(300)
  await ctx.streamMember(
    lastMember,
    `「${lastStep.short}」我这边完成 ✅\n\n${lastStep.report}\n\n产出已经放群里了，@我的分身 交给你。`,
    { attachments: lastStep.artifact ? [{ ...lastStep.artifact }] : null },
  )

  // 2. 分身汇总 + 交付产物附件
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, true)
  await wait(500)
  await ctx.streamMain(
    '三份产出都到齐了 👍 我来汇总成一份可评审的 PRD。对照目标契约自检通过——目标用户、核心流程、功能清单与验收标准均已覆盖。交付物如下：',
    // 带上 content + fileType，产物卡点击才能开右侧预览区（content 型走 previewStore）
    { attachments: [{ ...PRD_ATTACHMENT, fileType: 'md', content: PRD_DRAFT_MD }] },
  )
  ctx.store._setOnePersonThreadThinking?.(ctx.mainThreadId, false)

  // 任务转完成态
  ctx.snap.tasks = ctx.snap.tasks.map((t) => (t.id === taskId
    ? { ...t, status: 'completed', latest_message_preview: 'PRD 已交付，目标达成' } : t))
  await store.loadOnePersonTeamTasks?.(teamId, { force: true })
  void store.loadOnePersonTaskSidebar?.({ force: true })

  demoState.finished = true
  demoState.title = '已完成'
}

// ── 产出交付物：塞进 groupFiles 供「文件」区 + 预览区读取 ──
function injectDeliverable(teamId, execName) {
  if (typeof window === 'undefined') return
  const optMock = window.__optMock
  if (!optMock) return
  if (!optMock.groupFiles || typeof optMock.groupFiles.get !== 'function') {
    optMock.groupFiles = new Map()
  }
  const existing = optMock.groupFiles.get(String(teamId)) || []
  const file = {
    id: 'gf-rnd-prd-draft',
    name: 'prd-draft.md',
    fileType: 'md',
    source: '输出《AI 周报助手》PRD',
    sourceKind: 'task',
    status: 'delivered',
    author: execName,
    content: PRD_DRAFT_MD,
  }
  optMock.groupFiles.set(String(teamId), [file, ...existing.filter((f) => f.id !== file.id)])
}

const PRD_DRAFT_MD = `# 《AI 周报助手》产品需求文档（PRD · 草稿）

> 目标：让个人 / 小团队从「每周手工写周报」升级为「自动汇总、一键成稿」。

## 1. 目标用户
- **个人贡献者**：每周需向上汇报，苦于重复整理。
- **小团队负责人**：需汇总多人进展，形成团队周报。

## 2. 核心流程
1. 接入数据源（日报 / 任务系统 / 日历）。
2. AI 自动抽取本周关键进展、风险与下周计划。
3. 按模板生成周报草稿，用户微调后一键导出 / 发送。

## 3. 功能清单
| 模块 | 能力 | 优先级 |
|------|------|--------|
| 数据接入 | 日报 / 任务 / 日历多源同步 | P0 |
| 智能摘要 | 关键进展 / 风险 / 计划自动成段 | P0 |
| 模板成稿 | 个人 / 团队模板，一键导出 | P0 |
| 协同评论 | 团队成员补充与批注 | P1 |

## 4. 验收标准
- 接入 ≥2 类数据源后，可在 30 秒内生成初稿。
- 生成周报关键项覆盖率 ≥90%（人工抽检）。
- 支持 Markdown / 富文本两种导出格式。

---
*本草稿由数字员工在任务沙箱中产出，等待人工评审。*
`

/**
 * 把一条待办转发给一人团队：作为消息发到主会话 → 团队助理 mock「确认 + 建子任务」。
 * @param {string} teamId 目标团队
 * @param {string} todoText 待办内容
 */
export async function forwardTodoToTeam(teamId, todoText) {
  if (!teamId || !todoText) return
  const store = useSoloTeamStore()
  const optMock = typeof window !== 'undefined' ? window.__optMock : null
  if (!store || !optMock) return
  const snap = optMock.teamHomeSnapshots.get(teamId)
  if (!snap) return

  const mainThreadId = `thread-main-${teamId}`
  const now = () => new Date().toISOString()
  const members = snap.members || snap.team?.members || []
  const assistantAvatar = optMock.employees?.find((e) => String(e.agent_id) === '9001')?.avatar
  const owner = members.find((m) => String(m.agent_id || m.id) !== '9001') || members[0] || null

  const mainList = () => optMock.threadMessages.get(`${teamId}|${mainThreadId}`) || []
  const nextSeq = () => mainList().reduce((s, m) => Math.max(s, Number(m?.seq) || 0), 0) + 1
  const pushMain = (msg) => optMock.threadMessages.set(`${teamId}|${mainThreadId}`, [...mainList(), msg])
  const refetch = () => store.loadOnePersonThreadMessages?.(teamId, mainThreadId, { force: true })

  // 1. 用户把待办发进主会话
  const uSeq = nextSeq()
  pushMain({
    id: `msg-fwd-u-${teamId}-${uSeq}`, seq: uSeq, author_type: 'user', display_name: '我',
    content: todoText, thread_id: mainThreadId, status: 'completed', created_at: now(),
  })
  await refetch()
  await wait(700)

  // 2. 团队助理确认 + 建子任务（task_card + 右侧任务 + 打开子会话）
  const taskId = `fwd-${teamId}-${uSeq}`
  const taskThreadId = `thread-${taskId}`
  const participants = (owner ? [owner] : []).map((m) => ({
    id: m.agent_id || m.id, agent_id: m.agent_id || m.id, name: m.name, avatar: m.avatar,
  }))
  const task = {
    id: taskId, task_id: taskId, title: todoText, status: 'active', goal: todoText,
    latest_message_preview: '已从待办转入，我的分身已建子任务',
    execution_thread_id: taskThreadId,
    participant_agent_ids: participants.map((p) => p.agent_id), participants,
    created_at: now(),
  }
  snap.tasks = [task, ...(snap.tasks || []).filter((t) => t.id !== taskId)]

  store._setOnePersonThreadThinking?.(mainThreadId, true)
  await wait(800)
  const aSeq = nextSeq()
  pushMain({
    id: `msg-fwd-a-${teamId}-${aSeq}`, seq: aSeq, author_type: 'system', display_name: '我的分身',
    avatar: assistantAvatar,
    content: `收到「${todoText}」✅ 我已建成一个子任务跟进${owner ? `，交给 ${owner.name} 负责` : ''}，进度会在这里同步。`,
    thread_id: mainThreadId, status: 'completed', created_at: now(),
    payload: {
      kind: 'task_card', task_id: taskId, execution_thread_id: taskThreadId, title: todoText,
      status: 'active', latest_message_preview: task.latest_message_preview,
      participant_agent_ids: participants.map((p) => p.agent_id), members: participants,
    },
  })
  store._setOnePersonThreadThinking?.(mainThreadId, false)
  await refetch()
  await store.loadOnePersonTeamTasks?.(teamId, { force: true })
  void store.loadOnePersonTaskSidebar?.({ force: true })
  store.openOnePersonTask?.(teamId, taskId)
}
