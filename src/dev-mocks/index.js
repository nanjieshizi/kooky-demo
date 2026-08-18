/**
 * dev-mocks · Kooky 本地高保真原型 mock 套装（v2，配新版前端包）
 *
 * 目标：在 npm run dev / electron:dev 下，默认登录态直接进主界面，
 *      IM/SSO/Electron API 全部短路，分身对话/协作可走 demo-server。
 *
 * 三层 mock：
 *   1. 早期阶段 installEarly()：localStorage 塞登录态 + 浏览器模式 electronAPI 兜底
 *   2. 晚期阶段 installLate(pinia)：覆盖 imConnection.connect 短路 + imReady=true 强置
 *   3. （未提供）官方 devlocal：MODE === 'devlocal' 时 applyDevlocalMockUser 自然生效
 *
 * 主入口：main.js 顶部 installEarly()，app.use(pinia) 之后 installLate(pinia)
 *
 * 兜底原则：所有 mock 仅在 IS_DEMO（dev 或 VITE_DEMO=true）下生效，纯生产构建会被 tree-shake。
 */

import { useUIStore } from '@/modules/space/uiStore'
import { useUserStore } from '@/modules/auth/store'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { usePrivateStore } from '@/modules/private/store'
import { useGroupStore } from '@/modules/group/store'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useCollabProjectStore } from '@/modules/collaboration/store/projectStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useAiDraftStore } from '@/shared/store/aiDraftStore'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'
import { useFileStore } from '@/modules/file/store'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { builtinScheduledTasks, builtinScheduleConversations, pickRandomPresets } from './data/schedules'
import { client as imClient } from '@/shared/im-client'

import { CURRENT_USER, COLLEAGUES, ALL_PEOPLE } from './data/users'
import { DIGITAL_HUMANS, DIGITAL_HUMANS_RAW } from './data/digital-humans'
import { snapshot as hiredSnapshot, resetHired, listHired, seedDefaultHired } from './data/hired-state'
import { TEAM_ASSISTANT, TEAM_ASSISTANT_AGENT_ID, TEAM_ASSISTANT_BOT_ID } from './data/team-assistant'
import { builtinGroups, lookupSenderForMessage } from './data/groups'
import api from '@/shared/services/api'
import { buildDemoEmployees, buildDemoSoloTeams, buildDemoEmployeeThreads, getDemoEmployeeSkills, findDemoEmployee } from './data/solo-team'
import { startProductRnDDemo, advanceConvo, noteEmergedMembers, playIntroDemo, seedStaticTask, upgradeTeam } from '@/modules/solo-team/demo/onePersonDirector'
import { IS_DEMO } from '@/shared/utils/buildMode'

const ENABLED = IS_DEMO
// devlocal 模式下官方有 applyDevlocalMockUser 接管登录态，我们只补 IM/electronAPI
const IS_DEVLOCAL = import.meta.env.MODE === 'devlocal'

export const MOCK_USER = CURRENT_USER

const LS_KEY = 'super-assistant-userInfo'

export function installEarly() {
  if (!ENABLED) return

  // 启动种子：默认聘用 4 个数字人（产品/研发/测试/设计）
  try { seedDefaultHired() } catch (_) { /* noop */ }

  // 仅非 devlocal 时塞 localStorage（devlocal 走官方内存注入，不该污染 localStorage）
  if (!IS_DEVLOCAL) {
    try {
      const stored = localStorage.getItem(LS_KEY)
      let storedUser = null
      try { storedUser = stored ? JSON.parse(stored) : null } catch (_) {}
      // 没存过 / 旧版（缺扩展字段 / 头像变更）→ 重塞，让 mock 数据演进时无缝升级
      const isStale = !storedUser || !storedUser.department || !storedUser.title || storedUser.avatar !== MOCK_USER.avatar
      if (isStale) {
        localStorage.setItem(LS_KEY, JSON.stringify(MOCK_USER))
        localStorage.setItem('hasLoggedInBefore', 'true')
        localStorage.setItem('onboardingCompleted', 'true')
        localStorage.setItem('assistantRole', 'product-manager')
      }
    } catch (e) {
      console.warn('[dev-mocks] localStorage 注入失败', e)
    }
  }

  // 浏览器模式（npm run dev）下兜底 electronAPI，避免 undefined 调用炸
  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = buildBrowserElectronStub()
  }

  // DevTools 逃生口 + 数据查看器
  if (typeof window !== 'undefined') {
    window.__kookyMock = {
      logout() {
        localStorage.removeItem(LS_KEY)
        localStorage.removeItem('hasLoggedInBefore')
        localStorage.removeItem('onboardingCompleted')
        localStorage.removeItem('assistantRole')
        location.reload()
      },
      reseed() {
        localStorage.setItem(LS_KEY, JSON.stringify(MOCK_USER))
        location.reload()
      },
      user: MOCK_USER,
      colleagues: COLLEAGUES,
      people: ALL_PEOPLE,
      digitalHumans: DIGITAL_HUMANS,
      digitalHumansRaw: DIGITAL_HUMANS_RAW,
      hired: () => hiredSnapshot(),
      listHired,
      resetHired,
      isDevlocal: IS_DEVLOCAL,
    }
  }

  // 一人团队 / 我的员工 / installed skills 等新接口短路：让 UI 进入「空状态」不弹 toast
  try { installOnePersonTeamApiStubs() } catch (e) { console.warn('[dev-mocks v2] OPT api stub fail', e) }

  console.log('[dev-mocks v2] early installed · devlocal=' + IS_DEVLOCAL + ' · user=' + MOCK_USER.name)
}

// ─────────────────────────────────────────────────────
// 一人团队 / 我的员工新版 API 短路桩
// 只拦截在 fe-super-assistant-dev_refactor_0511 引入的新接口，
// 让一人团队页面进入「空团队列表 / 空员工列表」干净状态，不弹「加载失败」toast
// ─────────────────────────────────────────────────────
/**
 * 演示用私聊会话：跟真人同事的近期私聊。
 *
 * 覆盖两处：协作·私聊列表、通讯录二级栏·最近联系（后者按 last_message_at 排序）。
 * 时间是相对"现在"算的，所以永远显示成"刚刚 / 几小时前"，不会演示到一半变成去年。
 */
function buildDemoPrivateChats() {
  const now = Date.now()
  const MIN = 60 * 1000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  // [账号, 距今多久, 最后一条消息预览]
  const SPEC = [
    ['yrdeng2', 12 * MIN, 'Kooky 专项本周范围我收好了，下午一起过优先级'],
    ['ylyang21', 55 * MIN, '任务流状态和群消息链路我看过了，架构上可以继续往下走'],
    ['yanhuang', 2 * HOUR, '生态方联调名单已经确认，明天拉群对齐接口边界'],
    ['minliu27', 3 * HOUR, '这版原型走查记录发你了，重点看登录态那块'],
    ['jbxu2', 6 * HOUR, '回归跑完了，2 个用例挂在权限校验上'],
    ['qbhu', 1 * DAY, '架构评审挪到周四下午，日历我改好了'],
    ['yhzhang2', 1 * DAY + 4 * HOUR, '竞品那份表我补了两家，你看看还缺不缺'],
    ['jrnie', 2 * DAY, '前端组件库升级完了，注意 Button 的 size 改名了'],
    ['xyfang9', 3 * DAY, '需求池我清了一轮，过期的都归档了'],
  ]
  const byAccount = new Map(ALL_PEOPLE.map((u) => [u.userName, u]))
  return SPEC.map(([account, ago, preview], i) => {
    const u = byAccount.get(account)
    if (!u) return null
    return {
      conversation_id: `pc-${account}`,
      peer: {
        participant_id: 90000 + i,
        username: u.userName,
        display_name: u.name,
        avatar_url: u.avatar || '',
      },
      last_message_at: new Date(now - ago).toISOString(),
      last_message_preview: preview,
      last_seq: 10 + i,
      created_at: new Date(now - ago - 7 * DAY).toISOString(),
    }
  }).filter(Boolean)
}

function installOnePersonTeamApiStubs() {
  if (typeof window === 'undefined') return
  if (!api || api.__optMocked) return
  api.__optMocked = true
  const ok = (data) => ({ data: { code: 0, message: 'success', data } })
    // 暴露给剧本 / DevTools
    window.__optMock = {
      employees: buildDemoEmployees(),
      teams: [...buildDemoSoloTeams()],
      // 现场建群时 push 进来的新团队
      createdTeams: [],
      // teamId → home 快照（含主会话 thread / 子任务 / 成员）
      teamHomeSnapshots: new Map(),
      // (teamId|threadId) → messages 数组
      threadMessages: new Map(),
    }

    // ─── 预置多个一人团队演示快照：覆盖执行中/待确认/完成/失败、单/多执行成员，体现目标契约·红绿忙闲·队列入口 ───
    ;(() => {
      const empById = (id) => window.__optMock.employees.find((e) => String(e.agent_id) === String(id)) || {}
      const part = (ids) => ids.map((id) => { const e = empById(id); return { agent_id: id, name: e.name, avatar: e.avatar } })
      // 固定队成员 = 全体聘用员工（形态1）；用它替代硬编码，凑够多人场景
      const ALL_MEMBER_IDS = window.__optMock.employees.filter((e) => !e.is_default).map((e) => e.agent_id)
      const now = () => new Date().toISOString()
      const ensureTeam = (teamId, name, description, memberIds) => {
        let t = [...window.__optMock.teams, ...window.__optMock.createdTeams].find((x) => x.team_id === teamId)
        if (!t) {
          t = {
            team_id: teamId, id: teamId, name, description, avatar: null,
            members: part(memberIds).map((p) => ({ ...p, role: 'agent', presence: { status: 'idle' } })),
            member_count: memberIds.length,
            created_at: now(), updated_at: now(), last_active_at: now(),
            pinned: false, is_collaboration_dissolved: false,
          }
          window.__optMock.teams.push(t)
        }
        return t
      }
      const agentMsg = (id, content, seq, threadId) => {
        const e = empById(id)
        return { id: `m-${threadId}-${seq}`, seq, author_type: 'agent', display_name: e.name, avatar: e.avatar, content, thread_id: threadId, status: 'completed', created_at: now() }
      }
      const setupTeam = (teamId, name, description, memberIds, tasks, subMessages = {}) => {
        const team = ensureTeam(teamId, name, description, memberIds)
        const mainThreadId = `thread-main-${teamId}`
        const normTasks = tasks.map((t) => ({
          id: t.id, task_id: t.id, title: t.title, status: t.status,
          goal: t.goal, latest_message_preview: t.preview || '',
          execution_thread_id: `thread-${t.id}`,
          participant_agent_ids: t.members, participants: part(t.members),
          created_at: now(),
        }))
        window.__optMock.teamHomeSnapshots.set(teamId, {
          team, members: team.members,
          main_thread: { id: mainThreadId, title: '主会话' },
          tasks: normTasks, pending_approvals: [], event_cursor: 0,
        })
        window.__optMock.threadMessages.set(`${teamId}|${mainThreadId}`, [
          { id: `msg-welcome-${teamId}`, seq: 1, author_type: 'system', display_name: '我的分身',
            content: `欢迎回到「${name}」团队。当前有 ${tasks.length} 个任务，点开右侧任务卡即可进入对应子会话查看进度。`,
            thread_id: mainThreadId, status: 'completed', created_at: now() },
        ])
        Object.entries(subMessages).forEach(([taskId, msgs]) => {
          window.__optMock.threadMessages.set(`${teamId}|thread-${taskId}`, msgs)
        })
      }

      // ─── 三个状态样本会话（拍平后主会话 = 对话流；纯演示不同态）───
      const asstAv = empById(9001).avatar
      const uMsg = (c, seq, tid) => ({ id: `${tid}-u${seq}`, seq, author_type: 'human', display_name: '我', content: c, thread_id: tid, status: 'completed', created_at: now() })
      const sMsg = (c, seq, tid, extra = {}) => ({ id: `${tid}-s${seq}`, seq, author_type: 'system', display_name: '我的分身', avatar: asstAv, content: c, thread_id: tid, status: 'completed', created_at: now(), ...extra })
      const aMsg = (empId, c, seq, tid, extra = {}) => { const e = empById(empId); return { id: `${tid}-a${seq}`, seq, author_type: 'agent', display_name: e.name, avatar: e.avatar, content: c, thread_id: tid, status: 'completed', created_at: now(), ...extra } }
      const workCard = (empId, title, status, steps) => ({ kind: 'work_card', task_id: `t-${empId}`, member_id: empId, title, status, steps })
      // 给样本会话注入作战室静态状态用的小工具
      const part1 = (id, taskName) => ({ agent_id: id, name: empById(id).name, avatar: empById(id).avatar, taskName })
      const tdc = (content, status = 'completed') => ({ content, status })
      const er = (text) => ({ type: 'reasoning', text })
      const et = (name, arg, result) => ({ type: 'tool', name, args: arg, result })

      // ① 已完成 · 有产物：竞品分析
      setupTeam('demo-team-personal-blog', '竞品分析 · Q3', '同类产品对比 / 功能定价盘点', [1001, 1002, 1003, 1005], [])
      {
        const tid = 'thread-main-demo-team-personal-blog'
        const teamCA = window.__optMock.teams.find((t) => t.team_id === 'demo-team-personal-blog')
        if (teamCA) teamCA.latest_message_preview = '竞品分析已汇总，5 家同类对比就绪'
        // 保留团队入口，但不预置历史对话、任务卡片和文件产物，避免干扰当前演示主流程。
        window.__optMock.threadMessages.set(`demo-team-personal-blog|${tid}`, [])
      }

      // ② 正在执行 · 多人任务进行中：登录页原型走查
      setupTeam('opt-product-sprint', '登录页原型走查', 'UI 走查登录页交互与状态', [1004, 1001, 1002], [])
      {
        const tid = 'thread-main-opt-product-sprint'
        const teamLR = window.__optMock.teams.find((t) => t.team_id === 'opt-product-sprint')
        if (teamLR) teamLR.latest_message_preview = 'UI 走查中：主流程已过，异常态检查中'
        seedStaticTask('opt-product-sprint', { id: 'static-login-review', title: '登录页原型走查', participants: [part1(1004, '登录页交互走查'), part1(1001, '需求口径核对'), part1(1002, '前端可行性')], traces: {
          1004: { busy: true, todos: [tdc('走查主流程'), tdc('检查异常态', 'in_progress'), tdc('输出走查清单', 'pending')], entries: [er('先过一遍登录主流程：账密、验证码、第三方登录三条路。'), et('read_file', { path: '登录页原型.fig' }, '读取 6 个界面态'), er('现在逐个抠异常态：错误提示、锁定、超时、弱网……')] },
        } })
        window.__optMock.threadMessages.set(`opt-product-sprint|${tid}`, [
          uMsg('帮我走查下登录页的原型，看有没有问题', 1, tid),
          sMsg('好，我拉 UI 设计师来走查交互和状态 👌', 2, tid),
          aMsg(1004, '收到～登录页走查交给我 🙌 我先过一遍主流程，再逐个状态检查异常态。', 3, tid, { payload: workCard(1004, '登录页原型走查', 'running', [{ content: '走查主流程', status: 'completed' }, { content: '检查异常态', status: 'in_progress' }, { content: '输出走查清单', status: 'pending' }]) }),
        ])
      }

      // ③ 已完成：周会纪要整理
      setupTeam('opt-content-ops', '周会纪要整理', '把周会录音整理成纪要', [1006, 1004], [])
      {
        const tid = 'thread-main-opt-content-ops'
        const teamMN = window.__optMock.teams.find((t) => t.team_id === 'opt-content-ops')
        if (teamMN) teamMN.latest_message_preview = '纪要已生成，决议 / 待办 / 责任人已拎出'
        seedStaticTask('opt-content-ops', { id: 'static-meeting', title: '周会纪要整理', participants: [part1(1006, '纪要提取 + 结构化'), part1(1004, '纪要排版校对')], traces: {
          1006: { done: true, todos: [tdc('提取决议'), tdc('梳理待办 + 责任人')], entries: [er('把周会录音转写，抽取决议、待办、责任人三块。'), et('read_file', { path: '周会录音.txt' }, '转写 42 分钟音频'), et('write_file', { path: '周会纪要.md' }, '生成结构化纪要')] },
          1004: { done: true, todos: [tdc('纪要排版校对')], entries: [er('过一遍排版和错别字，确保能直接发群。')] },
        } })
        const doc = { id: 'gf-meeting-notes', name: '周会纪要.md', fileType: 'md', type: 'md', mime_type: 'text/markdown', content: '# 本周周会纪要\n\n## 决议\n1. 下周启动 Q3 竞品补齐\n2. 登录页原型本周内定稿\n\n## 待办\n| 事项 | 责任人 | 截止 |\n|---|---|---|\n| 竞品协同能力方案 | 产品经理 | 周三 |\n| 登录页走查清单 | UI 设计师 | 周二 |' }
        window.__optMock.threadMessages.set(`opt-content-ops|${tid}`, [
          uMsg('把这周的周会录音整理成纪要', 1, tid),
          sMsg('好，我拉 产品运营 来整理纪要 👌', 2, tid),
          aMsg(1006, '收到！周会纪要交给我 🙌 我把决议、待办、责任人都拎出来。', 3, tid, { payload: workCard(1006, '纪要整理', 'done', [{ content: '提取决议', status: 'completed' }, { content: '梳理待办 + 责任人', status: 'completed' }]) }),
          aMsg(1006, '「纪要整理」完成 ✅ 决议 / 待办 / 责任人都拎出来了，纪要放群里，@我的分身 交给你。', 4, tid, { attachments: [doc] }),
          sMsg('整理好了，纪要给你 👇', 5, tid, { attachments: [doc] }),
        ])
      }

      // ─── 演示主线团队：产研先锋队（空任务，等用户下需求触发编排剧本）───
      // 是「从新建团队到产出」端到端演示的可靠兜底路径：即便不现场建团队，
      // 打开这个团队 → 主会话下需求，也会触发 playProductRnDDemo 全流程。
      setupTeam('opt-rnd-vanguard', '产研先锋队', '一人指挥 AI 产研小队：需求 → 方案 → 交付', [], [])
      // 演示主线：空会话 → 引导页（场景卡指引你下第一个需求）
      window.__optMock.threadMessages.set('opt-rnd-vanguard|thread-main-opt-rnd-vanguard', [])

      // ─── 纯聊天样本：单聊(1 员工) + 群聊(多员工)，只做展示不派活 ───
      // setPreview：给团队塞列表预览文案
      const setPreview = (teamId, text) => {
        const t = window.__optMock.teams.find((x) => x.team_id === teamId)
        if (t) t.latest_message_preview = text
      }

      // 单聊①：和 UI 设计师 1:1 —— 展示「单聊头像」(员工大图 + 右下角分身蟹徽标)
      setupTeam('opt-chat-ui', 'UI 设计师', '1:1 · 详情页视觉聊聊', [1004], [])
      {
        const tid = 'thread-main-opt-chat-ui'
        setPreview('opt-chat-ui', '主色给你定 #FF621F，背景 #FFF7F3 打底')
        window.__optMock.threadMessages.set(`opt-chat-ui|${tid}`, [
          uMsg('详情页现在有点素，配色你有什么建议？', 1, tid),
          aMsg(1004, '给你三套方向：①珊瑚橙做主色，活泼不吵；②低饱和蓝灰，稳；③奶油白 + 木质暖调，适合内容型。你这页偏展示，我更推 ①。', 2, tid),
          uMsg('就珊瑚橙，主色值发我', 3, tid),
          aMsg(1004, '主色 #FF621F，hover 加深到 #E5551A，背景 #FFF7F3 打底；文字别纯黑，#2F3547 更耐看。要的话我直接出一版设计 token 🎨', 4, tid),
          uMsg('可以，回头出个 token 表', 5, tid),
          aMsg(1004, '收到～我整理好丢群里 👌', 6, tid),
        ])
      }

      // 单聊②：和 全栈开发 1:1 —— 技术问答
      setupTeam('opt-chat-dev', '全栈开发', '1:1 · 接口报错排查', [1002], [])
      {
        const tid = 'thread-main-opt-chat-dev'
        setPreview('opt-chat-dev', '八成是跨域预检丢了 token，网关放行下就行')
        window.__optMock.threadMessages.set(`opt-chat-dev|${tid}`, [
          uMsg('前端调接口一直 401，本地 curl 又是好的，咋回事？', 1, tid),
          aMsg(1002, '大概率是浏览器带不上 token。先看两点：① Network 里看 Authorization 头有没有真发出去；② 是不是跨域预检把头丢了。', 2, tid),
          uMsg('预检那个是啥意思', 3, tid),
          aMsg(1002, '跨域时浏览器先发个 OPTIONS 探路，网关没放行 Authorization 头的话，正式请求就带不上 token → 401。网关配上 `Access-Control-Allow-Headers: Authorization` 就好。', 4, tid),
          uMsg('懂了，我让运维加下', 5, tid),
          aMsg(1002, '嗯，加完清下缓存再试。还不行把 Network 截图发我 🔧', 6, tid),
        ])
      }

      // 群聊：小红书运营组(产品运营 + UI 设计师) —— 非任务的日常沟通，展示「群头像簇」
      setupTeam('opt-chat-content', '小红书运营组', '内容选题 / 视觉风格日常沟通', [1006, 1004], [])
      {
        const tid = 'thread-main-opt-chat-content'
        setPreview('opt-chat-content', '封面统一暖色调，本周先发「三个隐藏用法」')
        window.__optMock.threadMessages.set(`opt-chat-content|${tid}`, [
          uMsg('这周小红书发点啥好，想涨点粉', 1, tid),
          aMsg(1006, '结合最近热度，出三个选题：①「Kooky 三个隐藏用法」实用向；②「一个人也能有一支团队」故事向；③ 对比测评向。实用向一般最稳，建议先发 ①。', 2, tid),
          aMsg(1004, '封面我来定调：统一暖色系（珊瑚橙 + 奶油白），大标题压左上，留白别太满。三张封面我今天出草图。', 3, tid),
          uMsg('好，那就先发实用向那篇', 4, tid),
          aMsg(1006, '收到！正文按「痛点 → 用法 → 效果」写，控制 300 字内，配 4 张图 📝', 5, tid),
          aMsg(1004, '封面草图一会儿贴群里，你俩过一眼再定 🙌', 6, tid),
        ])
      }

      // 多人 mock 会话标记为「已升级群」→ isGroup=true → 点进去右侧作战室默认展开
      // （单聊 opt-chat-ui / opt-chat-dev 保持 solo，不自动展开）
      ;['demo-team-personal-blog', 'opt-product-sprint', 'opt-content-ops', 'opt-chat-content'].forEach(upgradeTeam)

      // 预置会话按展示顺序错开 last_active（越靠前越新）；新建会话发首条消息后 last_active=now → 自动排到最前
      {
        const initTs = Date.now()
        ;['demo-team-personal-blog', 'opt-product-sprint', 'opt-content-ops', 'opt-chat-ui', 'opt-chat-dev', 'opt-chat-content']
          .forEach((id, i) => {
            const t = window.__optMock.teams.find((x) => x.team_id === id)
            if (t) { const ts = new Date(initTs - i * 60000).toISOString(); t.last_active_at = ts; t.updated_at = ts }
          })
      }
    })()

    // ── 设置弹窗·模型与用量（provider-config，新版 SettingsDialogNew）—— 纯 demo 数据 ──
    // 形状对齐新版 providerConfigApi 的 unwrap 逻辑 + SettingsKookyPanel：
    //   detail = { display_name, channels:{'kc-oc':{models},'kc-cc':{models}}, quota, dialog_enabled, kode_enabled }
    //   model  = { id, model_name, model_alias, price_info:{input,output,unit} }
    // ⚠️ 新版 unwrap 对 ok() 和裸 {data} 都兼容；这里统一用 ok()。
    // price_info 真实后端就是预格式化字符串（模板直接 {{ model.price }} 渲染）
    const priceStr = (inp, out) => `$${inp}/M input, $${out}/M output`
    const ocModel = (id, name, inp, out) => ({ id, model_name: name, model_alias: name, price_info: priceStr(inp, out) })
    const ccModel = (id, alias, name, inp, out) => ({ id, model_alias: alias, model_name: name, price_info: priceStr(inp, out) })
    const KOOKY_OC_MODELS = [
      ocModel(1, 'kooky-snt-4.6', 3, 15),
      ocModel(2, 'kooky-opus-4.6', 15, 75),
      ocModel(3, 'kooky-hk-4.6', 1, 5),
      ocModel(4, 'gpt-4o', 2.5, 10),
      ocModel(5, 'gpt-4o-mini', 0.15, 0.6),
      ocModel(6, 'deepseek-v3', 0.27, 1.1),
      ocModel(7, 'deepseek-r1', 0.55, 2.19),
      ocModel(8, 'qwen-max', 1.6, 6.4),
      ocModel(9, 'glm-4.6', 0.6, 2),
    ]
    const KOOKY_CC_MODELS = [
      ccModel(11, 'opus', 'kooky-opus-4.6', 15, 75),
      ccModel(12, 'sonnet', 'kooky-snt-4.6', 3, 15),
      ccModel(13, 'haiku', 'kooky-hk-4.6', 1, 5),
    ]
    const KOOKY_DETAIL = {
      id: 'kooky', provider_code: 'kooky', display_name: 'Kooky', is_builtin: true,
      dialog_enabled: true, kode_enabled: true,
      quota: {
        balance: 495, used: 5, total: 500, used_percent: 1, unit: '$',
        quota_type: 'fixed', fixed_quota: 500, reset_date: '2026-09-01',
        has_pending_token_expand: false,
      },
      channels: {
        'kc-oc': { models: KOOKY_OC_MODELS },
        'kc-cc': { models: KOOKY_CC_MODELS },
      },
    }
    // 服务商列表：只有官方 Kooky（截图一致；第三方留空，点「+」新建走兜底）
    const KOOKY_LIST_ITEM = {
      id: 'kooky', provider_code: 'kooky', display_name: 'Kooky', is_builtin: true,
      dialog_enabled: true, kode_enabled: true, chat_model_count: 9, kode_model_count: 3,
    }
    const PC_PROVIDERS = [KOOKY_LIST_ITEM]
    const pcDetailFor = (id) => (String(id) === 'kooky' ? KOOKY_DETAIL : KOOKY_DETAIL)

    // 申请额度·所属产线（组织全部部门，is_current_line 标记本产线，is_self 为用户所在部门=默认选中）
    const QUOTA_DEPARTMENTS = [
      { id: 'dept-ai-product', name: 'AI 平台产品部', is_current_line: true, is_self: true },
      { id: 'dept-ai-eng', name: 'AI 平台研发部', is_current_line: true },
      { id: 'dept-ai-design', name: 'AI 平台设计部', is_current_line: true },
      { id: 'dept-ai-ops', name: 'AI 平台运营部', is_current_line: true },
      { id: 'dept-growth', name: '增长业务部', is_current_line: false },
      { id: 'dept-education', name: '教育业务部', is_current_line: false },
      { id: 'dept-medical', name: '医疗业务部', is_current_line: false },
      { id: 'dept-platform', name: '基础平台部', is_current_line: false },
      { id: 'dept-data', name: '数据智能部', is_current_line: false },
    ]
    // 申请额度·所属项目（按关键词搜索）
    const QUOTA_PROJECTS = [
      { id: 'proj-kooky', name: 'Kooky 数字员工工作台' },
      { id: 'proj-deerflow', name: 'DeerFlow 智能体框架' },
      { id: 'proj-kode', name: 'Kode 产研工作台' },
      { id: 'proj-onepteam', name: '一人团队作战室' },
      { id: 'proj-market', name: '数字人 / Skill 市场' },
      { id: 'proj-contacts', name: '组织通讯录' },
    ]

    const stubs = [
      // ── 设置弹窗·模型与用量（provider-config 新版）─────────────
      { test: (url) => /\/provider-config\/templates/.test(url), handler: () => ok([]) },
      { test: (url, cfg) => (cfg?.method || 'get').toLowerCase() === 'get' && /\/provider-config\/providers\/[^/?]+/.test(url), handler: (cfg) => { const m = String(cfg.url || '').match(/\/providers\/([^/?]+)/); return ok(pcDetailFor(m && m[1])) } },
      { test: (url, cfg) => (cfg?.method || 'get').toLowerCase() === 'get' && /\/provider-config\/providers(\?|$)/.test(url), handler: () => ok(PC_PROVIDERS) },
      // 申请额度·所属产线（全部部门）/ 所属项目（关键词搜索）
      { test: (url) => /\/quota\/departments/.test(url), handler: () => ok(QUOTA_DEPARTMENTS) },
      { test: (url) => /\/quota\/projects/.test(url), handler: (cfg) => { const kw = String(cfg?.params?.keyword || '').trim(); return ok(kw ? QUOTA_PROJECTS.filter((p) => p.name.includes(kw)) : QUOTA_PROJECTS) } },
      // 申请额度审批：上级信息
      { test: (url) => /\/users\/me\/leader/.test(url), handler: () => ok({ leader: { display_name: '罗林汉', username: 'luolh' } }) },
      // 提交扩容申请
      { test: (url) => /\/approval-orders\/token-expand/.test(url), handler: () => ok({ success: true }) },
      // 写操作兜底（启用开关/新建/删除/测试连接 v2/fetch-models 等）——返回成功即可，纯看样式不落库
      { test: (url) => /\/provider-config\//.test(url), handler: () => ok({ success: true, id: 999 }) },
      // 一人团队列表
      { test: (url) => /\/v1\/one-person-teams\/my(\?|$)/.test(url), handler: () => ok({ items: [...window.__optMock.teams, ...window.__optMock.createdTeams], total: window.__optMock.teams.length + window.__optMock.createdTeams.length }) },
      // 全局任务面板：从 home 快照里取 tasks，避免 sidebar 刷新覆盖 onePersonTasksByTeamId
      { test: (url) => /\/v1\/one-person-teams\/task-sidebar/.test(url), handler: () => {
        const all = [...window.__optMock.teams, ...window.__optMock.createdTeams]
        return ok({ teams: all.map(t => {
          const snap = window.__optMock.teamHomeSnapshots.get(t.team_id)
          return { team_id: t.team_id, name: t.name, avatar: t.avatar, tasks: (snap && Array.isArray(snap.tasks)) ? snap.tasks : [] }
        }) })
      } },
      // 团队首页快照
      { test: (url) => /\/v1\/one-person-teams\/[^/]+\/home/.test(url), handler: (config) => {
        const m = String(config.url || '').match(/\/v1\/one-person-teams\/([^/]+)\/home/)
        const teamId = m?.[1]
        const snap = window.__optMock.teamHomeSnapshots.get(teamId)
        if (snap) return ok(snap)
        // fallback：找团队，给出空 home
        const all = [...window.__optMock.teams, ...window.__optMock.createdTeams]
        const team = all.find(t => t.team_id === teamId) || null
        return ok({
          team, members: team?.members || [], main_thread: null, tasks: [], pending_approvals: [], event_cursor: 0,
        })
      } },
      // 团队任务列表：从 home 快照里取，避免 force reload 时覆盖 introTask
      { test: (url) => /\/v1\/one-person-teams\/[^/]+\/tasks/.test(url), handler: (config) => {
        const m = String(config.url || '').match(/\/v1\/one-person-teams\/([^/]+)\/tasks/)
        const teamId = m?.[1]
        const snap = window.__optMock.teamHomeSnapshots.get(teamId)
        const items = (snap && Array.isArray(snap.tasks)) ? snap.tasks : []
        return ok({ items, tasks: items })
      } },
      // 团队线程列表
      { test: (url) => /\/v1\/one-person-teams\/[^/]+\/threads(\?|$)/.test(url), handler: () => ok({ items: [] }) },
      // POST 发消息：把用户消息写进 threadMessages，返回 { message, run } 响应
      { test: (url, cfg) => cfg?.method === 'post' && /\/v1\/one-person-teams\/[^/]+\/threads\/[^/]+\/messages/.test(url), handler: (config) => {
        const m = String(config.url || '').match(/\/v1\/one-person-teams\/([^/]+)\/threads\/([^/]+)\/messages/)
        const teamId = m?.[1]; const threadId = m?.[2]
        const body = (() => { try { return typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {}) } catch { return {} } })()
        const key = `${teamId}|${threadId}`
        const list = window.__optMock.threadMessages.get(key) || []
        const maxSeq = list.reduce((s, msg) => Math.max(s, Number(msg?.seq) || 0), 0)
        const userMsg = {
          id: `msg-user-${body.client_message_id || Date.now()}`,
          seq: maxSeq + 1,
          author_type: 'human',
          display_name: '我',
          content: String(body.content || ''),
          attachments: body.attachments || [],
          client_message_id: body.client_message_id,
          thread_id: threadId,
          task_id: body.task_id || null,
          created_at: new Date().toISOString(),
          status: 'completed',
        }
        window.__optMock.threadMessages.set(key, [...list, userMsg])
        // 首次发消息 → 给会话设最新预览 + 刷新活跃时间，让它在左侧列表冒出来并排到最前
        {
          const allTeams = [...(window.__optMock.teams || []), ...(window.__optMock.createdTeams || [])]
          const teamObj = allTeams.find((t) => t.team_id === teamId)
          const isDirected = teamId === 'opt-rnd-vanguard' || (window.__optMock.createdTeams || []).some((t) => t.team_id === teamId)
          if (teamObj) {
            teamObj.latest_message_preview = String(userMsg.content || '').slice(0, 40) || '新会话'
            teamObj.last_active_at = new Date().toISOString()
            teamObj.updated_at = teamObj.last_active_at
            // 演示：会话标题按内容自动总结（mock 固定名）——仅当还是默认「新会话」名 + 是演示会话
            if (isDirected && /^新会话/.test(String(teamObj.name || ''))) {
              teamObj.name = 'AI 周报助手制作'
            }
          }
          try { useSoloTeamStore().loadOnePersonTeamsFromApi?.() } catch (e) { /* noop */ }
        }
        // 被 @ 的成员 → 标记为「出场」，在标题栏显性浮现
        const mentions = Array.isArray(body.mentions) ? body.mentions : []
        if (mentions.length) noteEmergedMembers(teamId, mentions.map((x) => x?.agent_id ?? x?.id).filter(Boolean))
        // ─── 演示编排触发：在「主会话」下需求 → 播放产研剧本（拆解/派活/执行/交付）───
        // 仅对产研先锋队 + 现场新建的团队生效，且每团队只播一次。
        const mainThreadId = `thread-main-${teamId}`
        const isMainThread = threadId === mainThreadId
        const isDirectedTeam = teamId === 'opt-rnd-vanguard'
          || window.__optMock.createdTeams.some((t) => t.team_id === teamId)
        if (isMainThread && isDirectedTeam && String(userMsg.content || '').trim().length > 1) {
          // 拍平后：走对话状态机（澄清 → 组队确认 → 执行），每条用户消息推进一步
          setTimeout(() => { void advanceConvo(teamId, mainThreadId, userMsg.content) }, 200)
        }
        return ok({ message: userMsg, run: null })
      } },
      // 消息账本（主/子会话拉历史）- GET only
      { test: (url, cfg) => cfg?.method !== 'post' && /\/v1\/one-person-teams\/[^/]+\/threads\/[^/]+\/messages/.test(url), handler: (config) => {
        const m = String(config.url || '').match(/\/v1\/one-person-teams\/([^/]+)\/threads\/([^/]+)\/messages/)
        const key = `${m?.[1]}|${m?.[2]}`
        const msgs = window.__optMock.threadMessages.get(key) || []
        return ok({ items: msgs, has_more: false })
      } },
      // 我的员工列表（演示职业化别名）
      { test: (url) => /\/v1\/agents\/my(\?|$)/.test(url), handler: () => ok({ items: window.__optMock.employees, total: window.__optMock.employees.length }) },
      // 已装技能
      // 员工置顶 / 取消置顶（PUT / DELETE .../agents/{id}/pin）——
      // 排序交给 sortEmployeesLikeAgentsMy，这里只负责把 pinned / pinned_at 写回事实源
      { test: (url, cfg) => /\/v1\/agents\/[^/]+\/pin\b/.test(url) && ['put', 'delete'].includes(String(cfg?.method || '').toLowerCase()), handler: (config) => {
        const id = String(config.url || '').match(/\/v1\/agents\/([^/]+)\/pin/)?.[1]
        const on = String(config.method || '').toLowerCase() === 'put'
        const emp = window.__optMock?.employees?.find((e) => String(e.agent_id ?? e.id) === String(id))
        if (!emp) return ok({})
        emp.pinned = on
        emp.pinned_at = on ? new Date().toISOString() : null
        return ok({ ...emp })
      } },
      // 员工资料编辑（PUT /v1/agents/{id}）——「数字员工管理」保存 + 详情页页头改名改描述都走这条。
      // 没有这个桩，编辑请求会打到真后端，demo 下必然失败。写回 window.__optMock.employees
      // 这份唯一事实源，列表/页头/卡片才会跟着变（agent_config 必须整包合并，别冲掉技能）。
      { test: (url, cfg) => String(cfg?.method || '').toLowerCase() === 'put'
          && /\/v1\/agents\/[^/]+$/.test(String(url).split('?')[0])
          && !/\/v1\/agents\/my$/.test(String(url).split('?')[0]),
        handler: (config) => {
          const id = String(config.url || '').split('?')[0].match(/\/v1\/agents\/([^/]+)$/)?.[1]
          const emp = window.__optMock?.employees?.find((e) => String(e.agent_id ?? e.id) === String(id))
          if (!emp) return ok({})
          // 请求拦截器阶段 data 还没被序列化，但保险起见两种都认
          let body = config.data
          if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
          body = body || {}
          if (body.name) {
            emp.name = body.name
            emp.display_name = body.name
            emp.agent_display_name = body.name
          }
          if (body.description !== undefined) {
            emp.description = body.description || ''
            emp.bio = emp.description
          }
          if (body.job_title !== undefined) emp.job_title = body.job_title || ''
          if (body.avatar_url !== undefined) {
            emp.avatar_url = body.avatar_url || ''
            emp.avatar = emp.avatar_url
          }
          if (body.agent_config) {
            emp.agent_config = { ...(emp.agent_config || {}), ...body.agent_config }
            // 顶层 llm_model 是员工卡/档案卡读的字段，跟着 config 一起走
            if (body.agent_config.llm_model !== undefined) emp.llm_model = body.agent_config.llm_model
          }
          emp.updated_at = new Date().toISOString()
          return ok({ ...emp })
        } },

      // 带 agentId 时返回该员工已装技能（详情页技能区要看）；不带的（分身 scope=global）仍给空
      { test: (url) => /\/v1\/installed\/skills/.test(url), handler: (config) => {
        const agentId = String(config.url || '').match(/agentId=(\d+)/)?.[1]
        const items = agentId ? getDemoEmployeeSkills(agentId) : []
        return ok({ items, total: items.length })
      } },
      // 通用 models / chat models
      { test: (url) => /\/api\/models(\?|$)/.test(url), handler: () => ok({ items: [] }) },
      { test: (url) => /\/v1\/chat\/models/.test(url), handler: () => ok({ current_model: null, available_models: [] }) },
      // 「我的员工」点开员工后拉私聊会话列表
      // 例外：云帆管家（agent_id=1007）返回预置 mock thread，演示"拉云帆代办 → 同步 Kode"
      { test: (url) => /\/api\/personal\/threads/.test(url), handler: (config) => {
        const url = String(config.url || '')
        if (url.includes('1007')) {
          const now = Date.now()
          return ok({
            items: [{
              id: 'mock-thread-yunfan-001',
              thread_id: 'mock-thread-yunfan-001',
              langgraph_thread_id: 'lg-mock-yunfan-001',
              title: '云帆任务对接',
              is_pinned: false,
              updated_at: new Date(now - 8 * 60 * 1000).toISOString(),
              created_at: new Date(now - 15 * 60 * 1000).toISOString(),
              agent_id: 1007,
            }],
            total: 1,
            page: 1,
            page_size: 1,
          })
        }
        // 其余员工：给几条近期会话，通讯录详情页右栏「工作记录」才有东西看
        const agentId = url.match(/agent_id=(\d+)/)?.[1] || url.match(/\/(\d{3,})(?:[/?]|$)/)?.[1]
        const items = buildDemoEmployeeThreads(agentId)
        return ok({ items, total: items.length, page: 1, page_size: 20 })
      } },
      // 兼容路径：直接走 /one-person-teams（旧版可能这么调）
      { test: (url, cfg) => cfg?.method !== 'post' && /\/v1\/one-person-teams\/?(\?|$)/.test(url), handler: () => ok({ items: [...window.__optMock.teams, ...window.__optMock.createdTeams] }) },
      // CLI 配置
      { test: (url) => /\/client\/v1\/cli\/config/.test(url), handler: () => ok({ enabled: false }) },
      // 创建一人团队
      { test: (url, cfg) => cfg?.method === 'post' && /\/v1\/one-person-teams\/?$/.test(url), handler: (config) => {
        const body = (() => { try { return typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {}) } catch { return {} } })()
        const name = body.name || '新团队'
        const description = body.description || ''
        const memberAgentIds = Array.isArray(body.agent_ids) ? body.agent_ids
          : Array.isArray(body.agents) ? body.agents.map(a => a.agent_id ?? a.id ?? a)
          : Array.isArray(body.members) ? body.members.map(m => m.agent_id ?? m.id)
          : []
        const memberObjs = memberAgentIds.map(id => findDemoEmployee(id)).filter(Boolean)
        const teamId = `demo-team-${Date.now()}`
        const members = memberObjs.map((emp) => ({
          member_id: `mem-${teamId}-${emp.agent_id}`,
          agent_id: emp.agent_id,
          participant_id: emp.participant_id,
          name: emp.name,
          avatar: emp.avatar,
          role: 'agent',
          presence: { status: 'idle' },
        }))
        const mainThreadId = `thread-main-${teamId}`
        const team = {
          team_id: teamId, id: teamId, name, description, avatar: null,
          members, member_count: members.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          pinned: false, is_collaboration_dissolved: false,
        }
        window.__optMock.createdTeams.push(team)

        window.__optMock.teamHomeSnapshots.set(teamId, {
          team, members,
          main_thread: { id: mainThreadId, title: '主会话' },
          tasks: [],
          pending_approvals: [], event_cursor: 0,
        })
        // 新会话不预置任何消息：空会话 → 主区显示引导页（场景卡指引）
        window.__optMock.threadMessages.set(`${teamId}|${mainThreadId}`, [])
        window.__optMock.lastTeamId = teamId
        console.log('[dev-mocks v2] 一人团队创建：' + name + ' (' + members.length + ' 员工) → ' + teamId)
        return ok({ team_id: teamId, id: teamId, name, description, members, main_thread_id: mainThreadId })
      } },
      // ── 私聊列表（协作·私聊 + 通讯录·最近联系都吃这份）─────────────
      // ⚠️ 返回**裸数组**不能套 ok()：privateStore 只认 Array（api 拦截器会把
      //    { code, data } 整包往下传，套了就变成对象、列表恒空）。
      { test: (url, cfg) => cfg?.method !== 'post' && /\/conversations\/private(\?|$)/.test(url), handler: () => ({ data: buildDemoPrivateChats() }) },
    ]
    // 装到 axios.interceptors.request 前置：匹配则直接 resolve adapter
    api.interceptors.request.use((config) => {
      const url = String(config.url || '')
      for (const s of stubs) {
        if (s.test(url, config)) {
          // 用 axios adapter 直接短路 —— 返回伪 response，不发真请求
          config.adapter = () => Promise.resolve({
            data: s.handler(config).data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          })
          break
        }
      }
      return config
    })
  console.log('[dev-mocks v2] 已安装一人团队 API 短路桩（' + stubs.length + ' 条）')
}

export function installLate(pinia) {
  if (!ENABLED) return

  // ─────────────────────────────────────────────
  // 注入登录态到 userStore + patch logout
  // Electron 桌面端真实后端不可用时，axios 401 / KC 注册失败 会触发
  // redirectToLogin → userStore.logout() 把登录态清掉跳登录页。
  // 这里把 userInfo 直接写进 store 同时 monkey-patch logout 让它 no-op，
  // 保证 dev 模式下登录态永远有效。
  // ─────────────────────────────────────────────
  try {
    const userStore = useUserStore(pinia)
    const writeLoginState = () => {
      userStore.userInfo = { ...MOCK_USER }
      userStore.onboardingCompleted = true
      userStore.assistantRole = 'product-manager'
      userStore.hasLoggedInBefore = true
      try {
        localStorage.setItem('super-assistant-userInfo', JSON.stringify(MOCK_USER))
        localStorage.setItem('hasLoggedInBefore', 'true')
        localStorage.setItem('onboardingCompleted', 'true')
        localStorage.setItem('assistantRole', 'product-manager')
      } catch (_) { /* noop */ }
    }
    writeLoginState()
    if (!userStore.__mockLogoutPatched) {
      userStore.__mockLogoutPatched = true
      userStore.logout = async function patchedLogout() {
        console.log('[dev-mocks v2] logout 被拦截（dev 模式保护登录态）')
        writeLoginState() // 即使被调也重新注入，确保 UI 不跳登录页
      }
    }
    console.log('[dev-mocks v2] userStore 登录态已注入 + logout 已 patch（dev 模式不会跳登录）')
  } catch (e) {
    console.warn('[dev-mocks v2] userStore 注入失败:', e)
  }

  // 短路 IM connect（新版用 httpIMClient，覆盖 store action 即可）
  const imConn = useImConnectionStore(pinia)
  imConn.connect = async function mockConnect(options = {}) {
    console.log('[dev-mocks v2] IM connect stubbed', options)
    this.isConnected = true
    this.isRealtimeConnected = true
    this.userId = options.userId || MOCK_USER.userId
    this.accessToken = options.accessToken || MOCK_USER.access_token
    this.deviceId = 'mock-device-id'
    this.syncState = 'PREPARED'
    this.isSyncing = false
  }
  imConn.disconnect = async function mockDisconnect() {
    this.isConnected = false
    this.isRealtimeConnected = false
    this.userId = null
    this.accessToken = null
    this.deviceId = null
  }

  // 强置 imReady=true，跳过 ConnectingOverlay 卡顿
  const uiStore = useUIStore(pinia)
  uiStore.setImConnecting(false)
  uiStore.setImReady(true)
  // dev 模式：永久 patch setImReady / setImConnecting，让 false 不生效
  // 原因：useSessionGate / redirectToLogin 在真实后端不可用时会反复把 imReady 设回 false，
  // 导致 ConnectingOverlay 卡死「正在加载」。本地服务无需这套连接握手，直接锁死 ready 状态。
  if (!uiStore.__mockImReadyPatched) {
    uiStore.__mockImReadyPatched = true
    uiStore.setImReady = function patchedSetImReady(_val) {
      this.imReady = true // 永远 true
    }
    uiStore.setImConnecting = function patchedSetImConnecting(_val) {
      this.imConnecting = false // 永远 false
    }
    console.log('[dev-mocks v2] setImReady / setImConnecting 已 patch（dev 模式永远 ready=true）')
  }

  // 数字人注入策略：
  //   - 不再塞 employeeChatEmployees（避免 hasCollaborationTeams=true 把引导页吃掉）
  //   - 只塞 digitalHumanStore.agents（创建协作群弹窗里的"数字人"标签页要用）
  //   - 二级菜单"企业数字人"分组要等用户真的创建/进入了协作群之后才会出现
  try {
    const dhStore = useDigitalHumanStore(pinia)
    // 团队助手放第一位（pinned），后续 6 个普通数字人
    dhStore.agents = [TEAM_ASSISTANT, ...DIGITAL_HUMANS_RAW]
    dhStore.loadingAgents = false
    console.log('[dev-mocks v2] 注入数字人 ' + (DIGITAL_HUMANS_RAW.length + 1) + ' 个（含团队助手）→ digitalHumanStore')
  } catch (e) {
    console.warn('[dev-mocks v2] 数字人注入失败:', e)
  }

  // 注入私聊列表：demo（浏览器）里 IM 客户端不初始化，client.getPrivateChats 直接抛错，
  // HTTP 桩根本轮不到 —— 所以直接把会话写进 store，并把 loaded 置位防止被空结果覆盖。
  // 供：协作·私聊列表 + 通讯录二级栏·最近联系。
  try {
    const privateStore = usePrivateStore(pinia)
    privateStore.privateChats = buildDemoPrivateChats().map((raw) => ({
      conversationId: raw.conversation_id,
      participantId: raw.peer.participant_id,
      peerUsername: raw.peer.username,
      peerDisplayName: raw.peer.display_name,
      peerAvatarUrl: raw.peer.avatar_url,
      lastMessageAt: raw.last_message_at,
      lastMessagePreview: raw.last_message_preview,
      lastSeq: raw.last_seq,
      createdAt: raw.created_at,
    }))
    privateStore.privateChatsLoaded = true
    console.log('[dev-mocks v2] 注入私聊会话 ' + privateStore.privateChats.length + ' 条 → privateStore')
  } catch (e) {
    console.warn('[dev-mocks v2] 私聊注入失败:', e)
  }

  // 注入一人团队 store：预置"我的员工" + 加载内置团队群
  try {
    const soloStore = useSoloTeamStore(pinia)
    // ⚠️ 必须和 GET /v1/agents/my 的桩用**同一份事实源**（window.__optMock.employees）。
    //    以前这里塞的是 hired-state（市场已聘的 5 个数字人），跟接口返回的 11 个职业化员工是两份数据 →
    //    首屏显示 5 个"××数字人"，等哪里触发一次 force 刷新才跳成正确的 11 个（Pata 撞到的那个 bug）。
    const employees = (window.__optMock?.employees || []).map((emp) => ({
      id: emp.agent_id ?? emp.id,
      name: emp.display_name || emp.name,
      title: emp.job_title || '',
      description: emp.description || '',
      avatar: emp.avatar_url || emp.avatar || '',
      isDefault: !!emp.is_default,
      pinned: !!emp.pinned,
      pinnedAt: emp.pinned_at ?? null,
      conversationScope: 'employee',
      presence: emp.presence || { status: 'idle' },
      raw: emp,
    }))
    soloStore.employeeChatEmployees = employees
    soloStore.employeeItemsLoaded = true

    // 一人团队群：直接调 store 的 loadAction 走 mock fetchOnePersonTeams（已 patched）
    if (typeof soloStore.loadOnePersonTeamsFromApi === 'function') {
      soloStore.loadOnePersonTeamsFromApi().catch((e) =>
        console.warn('[dev-mocks v2] 加载一人团队群失败:', e?.message),
      )
    }
    console.log(`[dev-mocks v2] 注入一人团队：员工 ${employees.length} 个 + 团队群已触发加载`)
  } catch (e) {
    console.warn('[dev-mocks v2] soloTeamStore 注入失败:', e)
  }

  // ─────────────────────────────────────────────────────────
  // 云帆管家单聊（协作模块）预置历史对话
  //   演示场景："拉云帆代办 → 同步到 Kode kc_workspace"
  //   注入 thread + messages 到 useCollaborationEmployeeChatStore
  // ─────────────────────────────────────────────────────────
  try {
    const collabStore = useCollaborationEmployeeChatStore(pinia)
    const YUNFAN_AGENT_ID = 1007
    const yunfanRaw = DIGITAL_HUMANS_RAW.find((a) => a.agent_id === YUNFAN_AGENT_ID)

    if (yunfanRaw) {
      // 1. 注入 employee
      const yunfanEmployee = {
        id: YUNFAN_AGENT_ID,
        name: yunfanRaw.agent_display_name,
        avatar: yunfanRaw.agent_avatar_url || '',
        pinned: true,
        pinnedAt: yunfanRaw.pinned_at,
        conversationScope: 'employee',
        raw: yunfanRaw,
      }
      const existingIdx = collabStore.employeeChatEmployees.findIndex(
        (e) => Number(e.id) === YUNFAN_AGENT_ID,
      )
      if (existingIdx < 0) {
        collabStore.employeeChatEmployees = [yunfanEmployee, ...collabStore.employeeChatEmployees]
      }
      collabStore.employeeItemsLoaded = true

      // 2. 注入 mock thread
      const mockThreadId = 'mock-thread-yunfan-001'
      const mockThread = {
        id: mockThreadId,
        thread_id: mockThreadId,
        langgraph_thread_id: 'lg-mock-yunfan-001',
        title: '云帆任务对接',
        is_pinned: false,
        updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        _agent_id: YUNFAN_AGENT_ID,
      }
      collabStore.employeeThreadsByEmployeeId[YUNFAN_AGENT_ID] = [mockThread]

      // 3. 注入 mock messages（按 EmployeeDeerflowMessageItem 期望的字段）
      const NOW = Date.now()
      const mockMessages = [
        {
          id: 'yf-msg-1',
          role: 'user',
          content: '帮我拉一下我在云帆上的代办任务',
          timestamp: NOW - 15 * 60 * 1000,
          isStreaming: false,
        },
        {
          id: 'yf-msg-2',
          role: 'assistant',
          content:
            '已拉取你在云帆的代办，共 5 条（按优先级排序）：\n\n· #YF-1283 [BUG] 订单状态机异常分支处理 · P0\n· #YF-1284 [需求] 用户中心配置面板重构 · P1\n· #YF-1297 [研发任务] 埋点字典 v3 接入 · P1\n· #YF-1302 [缺陷] 列表筛选条件丢失 · P2\n· #YF-1311 [用例] 全链路灰度兼容性回归 · P2\n\n需要我同步到 Kode 工作区吗？',
          timestamp: NOW - 14 * 60 * 1000,
          isStreaming: false,
        },
        {
          id: 'yf-msg-3',
          role: 'user',
          content: '帮我在 Kode 内的 kc 工作区下创建对应的任务',
          timestamp: NOW - 10 * 60 * 1000,
          isStreaming: false,
        },
        {
          id: 'yf-msg-4',
          role: 'assistant',
          content:
            '✅ 已在 Kode · kc_workspace 创建 5 个任务，云帆 ID 与 Kode taskId 已绑定，状态会双向同步：\n\n  · t11 缺陷 订单状态机异常分支处理 · #YF-1283\n  · t12 需求 用户中心配置面板重构 · #YF-1284\n  · t13 研发任务 埋点字典 v3 接入 · #YF-1297\n  · t14 缺陷 列表筛选条件丢失 · #YF-1302\n  · t15 用例 全链路灰度兼容性回归 · #YF-1311\n\n切到 Kode 左侧 kc_workspace 即可看到。',
          timestamp: NOW - 8 * 60 * 1000,
          isStreaming: false,
        },
      ]
      const threadStateKey = `${YUNFAN_AGENT_ID}:${mockThreadId}`
      collabStore.employeeThreadStates[threadStateKey] = {
        messages: mockMessages,
        isStreaming: false,
        streamingMessageId: null,
        sendingMessage: false,
        loadingMessages: false,
        loadingOlderPage: false,
        loaded: true,           // 跳过 loadEmployeeMessages 的 API 调用
        hasMore: false,
        nextBeforeSeq: null,
        ledgerBackfillPending: false,
        persistedMessageCount: mockMessages.length,
        error: null,
      }
      console.log('[dev-mocks v2] 注入云帆管家预置对话（4 条消息）→ collaborationEmployeeChatStore')
    }
  } catch (e) {
    console.warn('[dev-mocks v2] 云帆预置对话注入失败:', e?.message || e)
  }

  // Monkey patch IM client：让 "新建协作群" 流程跑通而不真调 HTTP API
  // 用户点新建团队 → 选成员 → 提交 → groupStore.createGroupRoom 调 client.createGroupRoom
  // → 我们伪造一个 conversationId 返回 → store 接着走 stub 构造 / upsertConversation / setActiveNavigation
  // → 最终二级菜单出现新群、主区域显示该群聊天面板
  // 内部缓存：群成员名单（用于 client.getRoomMembers mock）
  const mockGroupMembers = new Map()
  // 只有用户主动拉入云帆管家的新群才进入演示线，普通群不受影响。
  const yunfanDemoFlows = new Map()
  const YUNFAN_AGENT_ID = 1007

  /**
   * 数字人选择器传给 IM 的是 participant_id（demo 中如 agent-7），
   * 而其他入口也可能传 agent_id / slug。这里统一解析，避免“选中了但群里没人”。
   */
  function resolveMockDigitalHuman(botId) {
    const raw = String(botId ?? '')
    const participantMatch = raw.match(/^agent-(\d+)$/)
    if (participantMatch) {
      const numericId = Number(participantMatch[1])
      // 兼容 agent-1007（直接以 agent_id 编码）
      const byAgentId = DIGITAL_HUMANS_RAW.find((agent) => Number(agent.agent_id) === numericId)
      if (byAgentId) return byAgentId
      // 兼容 agent-7（KC Market mock 以数字人列表序号编码 participant_id）
      return DIGITAL_HUMANS_RAW[numericId - 1] || null
    }
    return DIGITAL_HUMANS_RAW.find(
      (agent) => Number(agent.agent_id) === Number(botId) || String(agent.agent_name) === raw,
    ) || null
  }

  function mockMemberIdentity(member) {
    const isAgent = String(member?.type || '').toLowerCase() === 'agent'
    const id = isAgent
      ? (member?.agent_id ?? member?.userId ?? member?.participantId ?? member?.username)
      : (member?.userId ?? member?.account ?? member?.username)
    return `${isAgent ? 'agent' : 'user'}:${String(id ?? '')}`
  }

  function mergeMockMembers(current = [], incoming = []) {
    const merged = new Map()
    for (const member of [...current, ...incoming]) {
      const key = mockMemberIdentity(member)
      if (!key.endsWith(':')) merged.set(key, member)
    }
    return [...merged.values()]
  }

  function buildMockMembers(accounts, botIds) {
    const members = []
    // 自己
    members.push({
      userId: MOCK_USER.userId,
      displayName: MOCK_USER.name,
      name: MOCK_USER.name,
      account: MOCK_USER.userName,
      username: MOCK_USER.userName,
      avatarUrl: MOCK_USER.avatar || '',
      avatarHttpUrl: MOCK_USER.avatar || '',
      type: 'user',
      role: 'owner',
      isOwner: true,
    })
    // 同事们（按 userName / userId 匹配）
    for (const acc of accounts || []) {
      const u = COLLEAGUES.find((c) => c.userName === acc || c.userId === acc)
      if (u && !members.some((m) => m.userId === u.userId)) {
        members.push({
          userId: u.userId,
          displayName: u.name,
          name: u.name,
          account: u.userName,
          username: u.userName,
          avatarUrl: u.avatar || '',
          avatarHttpUrl: u.avatar || '',
          title: u.title || '',
          department: u.department || '',
          departmentFull: u.department || '',
          projectRole: u.projectRole || '',
          email: u.email || '',
          employeeId: u.employeeId || '',
          type: 'user',
        })
      }
    }
    // bots
    for (const bid of botIds || []) {
      if (String(bid) === TEAM_ASSISTANT_BOT_ID || Number(bid) === TEAM_ASSISTANT_AGENT_ID) {
        if (!members.some((m) => m.userId === TEAM_ASSISTANT_BOT_ID)) {
          members.push({
            userId: TEAM_ASSISTANT_BOT_ID,
            displayName: '团队助手',
            name: '团队助手',
            account: 'team-assistant',
            username: 'team-assistant',
            avatarUrl: TEAM_ASSISTANT.agent_avatar_url || '',
            avatarHttpUrl: TEAM_ASSISTANT.agent_avatar_url || '',
            type: 'agent',
          })
        }
      } else {
        const dh = resolveMockDigitalHuman(bid)
        if (dh) {
          const userId = `agent-${dh.agent_id}`
          if (!members.some((m) => m.userId === userId)) {
            members.push({
              userId,
              displayName: dh.agent_display_name,
              name: dh.agent_display_name,
              account: dh.agent_name,
              username: dh.agent_name,
              avatarUrl: dh.agent_avatar_url || '',
              avatarHttpUrl: dh.agent_avatar_url || '',
              type: 'agent',
              agent_id: dh.agent_id,
              participantId: bid,
            })
          }
        }
      }
    }
    return members
  }

  try {
    imClient.createGroupRoom = async function mockCreateGroupRoom(name, accounts = [], botIds = [], options = {}) {
      const createdAtMs = Date.now()
      const conversationId = `mock-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      // 协作群必带团队助手（即使前端没传也兜底加上）
      const safeBotIds = [...new Set([TEAM_ASSISTANT_BOT_ID, ...botIds])]
      const yunfanAgent = safeBotIds
        .map((botId) => resolveMockDigitalHuman(botId))
        .find((agent) => Number(agent?.agent_id) === YUNFAN_AGENT_ID)
      if (yunfanAgent) {
        yunfanDemoFlows.set(conversationId, { step: 0, done: false })
      }
      mockGroupMembers.set(conversationId, buildMockMembers(accounts, safeBotIds))
      console.log('[dev-mocks v2] createGroupRoom mocked', { name, accounts, botIds: safeBotIds, conversationId, membersCount: mockGroupMembers.get(conversationId).length })

      // ─── 真实建群体验：补 group.created + member.joined 系统消息 ───
      // 创建人 = 当前登录用户（孟世一），分 2 条：真人 / 数字人
      const inviter = {
        id: CURRENT_USER.userId,
        display_name: CURRENT_USER.name,
        type: 'user',
      }
      const userMembers = []
      for (const acc of accounts) {
        const u = COLLEAGUES.find((c) => c.userName === acc || c.userId === acc)
        if (u) userMembers.push({ id: u.userId, display_name: u.name, type: 'user' })
      }
      const agentMembers = []
      for (const bid of botIds) {
        if (bid === TEAM_ASSISTANT_BOT_ID) continue // 团队助手不展示「被邀请」
        const dh = resolveMockDigitalHuman(bid)
        if (dh) agentMembers.push({
          id: `agent-${dh.agent_id}`,
          display_name: dh.agent_display_name,
          type: 'agent',
          agent_id: dh.agent_id,
        })
      }

      // 直接往 conversationMessages 数组 splice（绕过 receiver 的去重/过滤）
      // 用 setTimeout 让 store.createGroupRoom 走完 upsertConversation 再写消息
      setTimeout(() => {
        try {
          // ⚠️ 此处 mock 定义位置早于 groupStore 闭包变量，重新拿 store
          const gs = useGroupStore(pinia)
          if (!gs.conversationMessages[conversationId]) {
            gs.conversationMessages[conversationId] = {
              messages: [],
              oldestSeq: null,
              newestSeq: null,
              remoteTypingUserIds: [],
              unreadCount: 0,
            }
          }
          const rc = gs.conversationMessages[conversationId]
          // 创建请求发起时间早于后续群内业务消息；即使延迟注入也保持正确排序。
          const nowMs = createdAtMs - 2
          const baseMsg = {
            conversationId,
            role: 'system',
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            contentType: 'text',
            status: 'normal',
            readedUsernames: [],
          }
          // 第 1 条：群创建 + 真人成员
          rc.messages.push({
            ...baseMsg,
            id: `sys-${nowMs}-created`,
            eventId: `sys-${nowMs}-created`,
            type: 'group.created',
            timestamp: nowMs,
            seq: nowMs,
            content: { creator: inviter, initial_members: userMembers },
          })
          // 第 2 条：合并所有数字员工 → 一条「孟世一 邀请 测试数字人、研发数字人、产品数字人 进入团队」
          // 用 group.created + _skipCreator 跳过「创建了团队」段，只渲染「邀请」段
          if (agentMembers.length) {
            rc.messages.push({
              ...baseMsg,
              id: `sys-${nowMs + 1}-agents`,
              eventId: `sys-${nowMs + 1}-agents`,
              type: 'group.created',
              timestamp: nowMs + 1,
              seq: nowMs + 1,
              content: {
                _skipCreator: true,
                creator: inviter,           // inviteGroup 仍能读到 actor=孟世一
                initial_members: agentMembers,
              },
            })
          }
          if (yunfanAgent) {
            rc.messages.push({
              ...baseMsg,
              id: `yunfan-${nowMs + 2}-welcome`,
              eventId: `yunfan-${nowMs + 2}-welcome`,
              role: 'assistant',
              senderId: `agent-${YUNFAN_AGENT_ID}`,
              senderName: yunfanAgent.agent_display_name || 'PMO',
              senderType: 'agent',
              senderAvatar: yunfanAgent.agent_avatar_url || '',
              type: 'text',
              timestamp: nowMs + 2,
              seq: nowMs + 2,
              content: {
                body: '我已加入本群。随便发一条消息，我先从云帆同步 Kooky 迭代信息并创建项目看板。',
              },
            })
          }
          if (rc.oldestSeq == null) rc.oldestSeq = nowMs
          rc.newestSeq = nowMs + (yunfanAgent ? 2 : 1)
          console.log('[dev-mocks v2] 建群系统消息已注入', { userMembers: userMembers.length, agentMembers: agentMembers.length })
        } catch (e) {
          console.warn('[dev-mocks v2] 注入建群系统消息失败:', e)
        }
      }, 300)

      return { conversationId, name }
    }

    // 真正返回成员的接口 → 让 loadConversationMembers 拿到正确数据
    imClient.getRoomMembers = async function mockGetRoomMembers(conversationId) {
      return mockGroupMembers.get(conversationId) || []
    }

    // 增量邀请要真正回写 mock 成员池，否则弹窗提示“添加成功”，成员列表却还是没人。
    imClient.inviteMembers = async function mockInviteMembers(conversationId, payload = {}) {
      const usernames = Array.isArray(payload.usernames) ? payload.usernames : []
      const agentParticipantIds = Array.isArray(payload.agentParticipantIds) ? payload.agentParticipantIds : []
      const invitedYunfan = agentParticipantIds
        .map((participantId) => resolveMockDigitalHuman(participantId))
        .some((agent) => Number(agent?.agent_id) === YUNFAN_AGENT_ID)
      if (invitedYunfan && !yunfanDemoFlows.has(conversationId)) {
        yunfanDemoFlows.set(conversationId, { step: 0, done: false })
      }
      const current = mockGroupMembers.get(conversationId) || buildMockMembers([], [])
      const incoming = buildMockMembers(usernames, agentParticipantIds)
      const nextMembers = mergeMockMembers(current, incoming)

      mockGroupMembers.set(conversationId, nextMembers)

      // demo 没有 WebSocket members_changed 事件，同步更新 Pinia 缓存，让当前打开的成员面板立即刷新。
      const gs = useGroupStore(pinia)
      gs.conversationMembers[conversationId] = [...nextMembers]
      const conversation = gs.conversations.find(
        (item) => String(item.conversationId) === String(conversationId),
      )
      if (conversation) conversation.memberCount = nextMembers.length

      return { ok: true, mock: true, conversationId, memberCount: nextMembers.length }
    }

    // 其他可能被群创建后续流程调到的 client 方法，统一吞掉错误
    const SAFE_NOOP_METHODS = [
      'changeRoomMembers', 'removeMembers',
      'renameGroup', 'dissolveGroup', 'leaveRoom',
    ]
    for (const m of SAFE_NOOP_METHODS) {
      if (typeof imClient[m] === 'function') {
        imClient[m] = async () => ({ ok: true, mock: true })
      }
    }
    console.log('[dev-mocks v2] im-client: createGroupRoom + getRoomMembers + ' + SAFE_NOOP_METHODS.length + ' 个方法已 mock')
  } catch (e) {
    console.warn('[dev-mocks v2] im-client mock 失败:', e)
  }

  // ─────────────────────────────────────────────────────────────
  // Monkey patch client.sendMessage：本地化群聊消息发送 + 触发协作 AI
  //   1. 用户消息伪造塞进群聊（这样能看到自己说的话）
  //   2. 检测 @团队助手 → 调 collabTaskStore.createTask（走 demo-server 真 Claude）
  //   3. 团队助手回应消息（含流转卡片标记）也塞回群里
  // ─────────────────────────────────────────────────────────────
  try {
    const groupStore = useGroupStore(pinia)
    const taskStore = useCollabTaskStore(pinia)
    const projectStore = useCollabProjectStore(pinia)

    function pushMessage(conversationId, payload) {
      const eventId = payload.eventId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const msg = {
        id: eventId,
        eventId,
        conversationId,
        seq: Date.now(),
        timestamp: Date.now(),
        type: 'text',
        contentType: 'text',
        ...payload,
      }
      try {
        groupStore._onGroupMessageReceived(msg)
      } catch (e) {
        console.warn('[dev-mocks v2] push message failed:', e)
      }
      return eventId
    }

    function findMessage(conversationId, eventId) {
      const rc = groupStore.conversationMessages?.[conversationId]
      if (!rc?.messages) return null
      return rc.messages.find((m) => m.eventId === eventId) || null
    }

    function updateMessage(conversationId, eventId, patch) {
      const msg = findMessage(conversationId, eventId)
      if (!msg) return false
      // 合并 content 字段，保留响应式
      if (patch.content) {
        msg.content = { ...(msg.content || {}), ...patch.content }
      }
      const rest = { ...patch }
      delete rest.content
      Object.assign(msg, rest)
      return true
    }

    function pushUserMessage(conversationId, text, opts = {}) {
      // 没显式传 mentions 时，自动从正文扫 @ 名字
      const mentions = Array.isArray(opts.mentions) && opts.mentions.length
        ? opts.mentions
        : (typeof _extractMentionsFromText === 'function' ? _extractMentionsFromText(text) : [])
      return pushMessage(conversationId, {
        role: 'user',
        senderId: MOCK_USER.userId,
        // ⚠️ senderName 必须用 userName（portal userId），否则 store 端
        // isSelfMessageSender 判定失败，会把消息重写成 'member' 渲染到左侧
        senderName: MOCK_USER.userName,
        senderType: 'user',
        senderAvatar: MOCK_USER.avatar || '',
        content: {
          body: text,
          mentions,
          ...(opts.matterReference ? { matterReference: opts.matterReference } : {}),
        },
      })
    }

    function pushAssistantMessage(conversationId, body, extra = {}) {
      return pushMessage(conversationId, {
        role: 'assistant',
        senderId: TEAM_ASSISTANT_BOT_ID,
        senderName: '团队助手',
        senderType: 'agent',
        content: { body, ...extra },
      })
    }

    function pushYunfanMessage(conversationId, body, extra = {}) {
      const yunfan = DIGITAL_HUMANS_RAW.find(
        (agent) => Number(agent.agent_id) === YUNFAN_AGENT_ID,
      )
      return pushMessage(conversationId, {
        role: 'assistant',
        senderId: `agent-${YUNFAN_AGENT_ID}`,
        senderName: yunfan?.agent_display_name || 'PMO',
        senderType: 'agent',
        senderAvatar: yunfan?.agent_avatar_url || '',
        content: { body, ...extra },
      })
    }

    function makeYunfanIterationTask(conversationId) {
      const taskId = `yunfan-${conversationId}-kooky-iteration`
      if (taskStore.tasks[taskId]) return taskStore.tasks[taskId]

      const createdAt = Date.now()
      const makeStepBase = () => ({
        vote_options: [],
        deadline: null,
        parallel_group: null,
        completed_by: [],
        skipped_by: [],
        submissions: [],
        activatedAt: null,
        completedAt: null,
      })
      const steps = [
        {
          ...makeStepBase(),
          id: `${taskId}-scope`,
          name: '确认本轮迭代范围',
          desc: '确认项目看板、任务归档与再次开启的本轮交付范围',
          assignees: ['邓颖茹'],
          submit_type: 'confirm',
          status: 'active',
          activatedAt: createdAt,
        },
        {
          ...makeStepBase(),
          id: `${taskId}-interaction`,
          name: '完成列表与逾期状态交互',
          desc: '完成进行中、逾期和已归档任务的列表交互',
          assignees: ['孟世一'],
          submit_type: 'file',
          status: 'pending',
        },
        {
          ...makeStepBase(),
          id: `${taskId}-workflow`,
          name: '实现引用历史工作流再次开启',
          desc: '支持引用已归档流程并根据自然语言生成新一轮任务',
          assignees: ['杨宇龙'],
          submit_type: 'confirm',
          status: 'pending',
        },
        {
          ...makeStepBase(),
          id: `${taskId}-acceptance`,
          name: '完成演示流程回归验收',
          desc: '验证项目看板、协作任务和云帆管家的群内联动',
          assignees: ['黄燕'],
          submit_type: 'confirm',
          status: 'pending',
        },
      ]
      const task = {
        id: taskId,
        conversationId,
        title: '🗂 Kooky 8月迭代｜协作任务归档与再次开启',
        emoji: '🗂',
        status: 'in_progress',
        createdAt,
        createdBy: '云帆管家',
        goal: '完成协作任务列表分组、逾期状态和引用历史工作流再次开启能力，并通过演示验收。',
        steps,
        finishedAt: null,
      }
      taskStore.tasks[taskId] = task
      taskStore.activeTaskByGroup[conversationId] = taskId
      taskStore.toggleDetailPanel(conversationId, false)
      return task
    }

    function runYunfanDemoStep(conversationId, step) {
      const meta = { updatedBy: '云帆管家', source: '数字人维护' }
      if (step === 0) {
        const existing = projectStore.projectForGroup(conversationId)
        if (!existing) {
          projectStore.createProject(conversationId, {
            name: 'Kooky 8月协作能力迭代',
            goal: '完成项目看板、协作任务归档与再次开启能力，并通过核心场景演示验收。',
            owner: '邓颖茹',
            stage: '规划中',
            progress: 20,
            progressSummary: '已从云帆同步迭代范围，正在确认里程碑与负责人。',
            ...meta,
          })
        }
        pushYunfanMessage(
          conversationId,
          '已从云帆同步「Kooky 8月协作能力迭代」，并创建本群项目看板：负责人邓颖茹，当前进度 20%。\n\n再发一条消息，我继续补齐里程碑、进度和风险。',
        )
        return
      }

      if (step === 1) {
        let project = projectStore.projectForGroup(conversationId)
        if (!project) {
          project = projectStore.createProject(conversationId, {
            name: 'Kooky 8月协作能力迭代',
            goal: '完成项目看板、协作任务归档与再次开启能力，并通过核心场景演示验收。',
            owner: '邓颖茹',
            stage: '进行中',
            progress: 20,
            ...meta,
          })
        }
        projectStore.updateProject(
          conversationId,
          {
            stage: '进行中',
            progress: 45,
            progressSummary: '项目看板与任务归档列表已完成高保真验证，进入工作流再次开启联调。',
          },
          { ...meta, text: '同步了云帆最新工单进展' },
        )
        if (!(project.milestones || []).length) {
          projectStore.addMilestone(
            conversationId,
            { title: '协作信息架构与交互定稿', date: '8月14日', status: 'done', owner: '邓颖茹' },
            { ...meta, text: '同步里程碑：协作信息架构与交互定稿' },
          )
          projectStore.addMilestone(
            conversationId,
            { title: '协作任务归档与再次开启联调', date: '8月16日', status: 'active', owner: '杨宇龙' },
            { ...meta, text: '同步里程碑：协作任务归档与再次开启联调' },
          )
          projectStore.addMilestone(
            conversationId,
            { title: '核心场景演示验收', date: '8月18日', status: 'pending', owner: '黄燕' },
            { ...meta, text: '同步里程碑：核心场景演示验收' },
          )
        }
        if (!(project.risks || []).length) {
          projectStore.addRisk(
            conversationId,
            {
              title: '历史工作流重启时需要校验上下文差异',
              level: 'medium',
              status: 'open',
              owner: '杨宇龙',
            },
            { ...meta, text: '从云帆同步一项待跟进风险' },
          )
        }
        pushYunfanMessage(
          conversationId,
          '已更新项目看板：进度调整为 45%，补充了 3 个里程碑，并同步 1 项待跟进风险。\n\n再发一条消息，我按本轮迭代创建协作任务。',
        )
        return
      }

      const task = makeYunfanIterationTask(conversationId)
      const firstStep = task.steps[0]
      projectStore.updateProject(
        conversationId,
        { progressSummary: '已创建本轮产品迭代协作任务，进入范围确认与研发联调。' },
        { ...meta, text: '创建了本轮产品迭代协作任务' },
      )
      pushYunfanMessage(
        conversationId,
        '已创建协作任务「Kooky 8月迭代｜协作任务归档与再次开启」，共 4 个步骤。第一步由邓颖茹确认迭代范围，后续会依次交给产品、研发和生态负责人。',
        {
          flowCard: {
            taskId: task.id,
            kind: 'created',
            nextStepId: firstStep.id,
            nextStepNames: firstStep.name,
            assignees: firstStep.assignees,
          },
        },
      )
    }

    function advanceYunfanDemoFlow(conversationId) {
      const state = yunfanDemoFlows.get(conversationId)
      if (!state || state.done) return false
      const step = state.step
      state.step += 1
      state.done = state.step >= 3
      // 先让用户消息落位，再由数字人回应；步数先递增，避免连点触发同一步。
      setTimeout(() => runYunfanDemoStep(conversationId, step), 650)
      return true
    }

    /**
     * @团队助手 智能分流（按 live-demo.html 已定 PRD 行为）：
     *   - 当前群无活跃任务 → decompose 创建新任务
     *   - 有活跃任务但没选中 → 选第一个 + interpret 推进
     *   - 有活跃任务且选中 → interpret 推进
     */
    async function triggerTeamAssistant(rawText, conversationId) {
      const instruction = rawText.replace(/@团队助手/g, '').trim()
      if (!instruction) return

      const eventId = pushAssistantMessage(conversationId, '', { isThinking: true })

      try {
        const activeTasks = taskStore.activeTasksByGroup(conversationId) || []
        let currentTaskId = taskStore.activeTaskByGroup[conversationId]
        let currentTask = currentTaskId ? taskStore.tasks[currentTaskId] : null

        // 当前选中任务已不在活跃 → 自动切到第一个活跃
        if (!currentTask || currentTask.status !== 'in_progress') {
          if (activeTasks.length > 0) {
            currentTaskId = activeTasks[0].id
            taskStore.setActiveTask(conversationId, currentTaskId)
            currentTask = activeTasks[0]
          } else {
            currentTask = null
          }
        }

        // 分流 1：没有任何活跃任务 → 创建
        if (!currentTask) {
          await handleCreateTask(conversationId, instruction, eventId)
          return
        }

        // 分流 2：有活跃任务 → 推进
        await handleProgressTask(conversationId, currentTask, instruction, eventId)
      } catch (e) {
        console.error('[dev-mocks v2] @团队助手 处理失败:', e)
        updateMessage(conversationId, eventId, {
          content: {
            body: `⚠️ ${e?.message || e}`,
            isThinking: false,
          },
        })
      }
    }

    async function handleCreateTask(conversationId, goal, eventId) {
      const memberObjs = groupStore.conversationMembers?.[conversationId] || []
      const members = memberObjs
        .map((m) => m.displayName || m.name || m.userId)
        .filter((n) => n && n !== '团队助手')

      try {
        const { task, activated } = await taskStore.createTask({
          conversationId,
          goal,
          members: members.length > 0 ? members : [MOCK_USER.name],
          createdBy: MOCK_USER.name,
        })
        const assignees = [...new Set(activated.flatMap((s) => s.assignees))]
        const atList = assignees.map((a) => `@${a}`).join(' ')
        const cards = buildCardsForActivation(task, activated, 'created')
        updateMessage(conversationId, eventId, {
          content: {
            body: `已为你拆解协作任务「${task.title}」，共 ${task.steps.length} 个步骤。${atList} ${buildVerbHint(activated)}`,
            isThinking: false,
            flowCards: cards,
          },
        })

        try {
          taskStore.setActiveTask(conversationId, task.id)
          taskStore.toggleDetailPanel(conversationId, true)
          uiStore.setActiveToolTab('task')
        } catch (_) { /* noop */ }
      } catch (e) {
        updateMessage(conversationId, eventId, {
          content: {
            body: `⚠️ 拆解失败：${e?.message || e}。检查 demo-server 是否跑着。`,
            isThinking: false,
          },
        })
      }
    }

    /**
     * 构造 flowCards：
     *   - 主卡：headerKind（created / advanced / skipped / back ...）
     *   - 子卡：每个 activated step 一张 "next-step"（如果并行，会有多张）
     *
     * 单步骤激活：返回 1 张主卡（合并下一步信息），不出子卡
     * 多步骤激活（并行）：返回 1 张主卡 + N 张 next-step 子卡
     */
    function buildCardsForActivation(task, activated, headerKind) {
      if (!activated || activated.length === 0) return []
      const firstStep = activated[0]
      // 单步骤：用合并主卡（兼容旧逻辑）
      if (activated.length === 1) {
        return [{
          taskId: task.id,
          kind: headerKind,
          nextStepId: firstStep.id,
          nextStepNames: firstStep.name,
          assignees: firstStep.assignees || [],
        }]
      }
      // 并行：主卡（只描述本次发生的事，不带 nextStep）+ 多张 next-step 子卡
      const cards = [{
        taskId: task.id,
        kind: headerKind,
        // 主卡不带 nextStepId（避免渲染 hint/vote），仅展示"已发生"
      }]
      for (const step of activated) {
        cards.push({
          taskId: task.id,
          kind: 'next-step',
          nextStepId: step.id,
          nextStepNames: step.name,
          assignees: step.assignees || [],
        })
      }
      return cards
    }

    function buildVerbHint(activated) {
      if (!activated || activated.length === 0) return ''
      if (activated.length === 1) return `请 ${getActionVerb(activated[0])}`
      // 并行多个，按提交类型聚合
      const types = new Set(activated.map((s) => s.submit_type))
      if (types.size === 1) return `请 ${getActionVerb(activated[0])}`
      return '请按各自步骤要求响应'
    }

    async function handleProgressTask(conversationId, task, text, eventId) {
      try {
        const { action, result, reply } = await taskStore.progressTask({
          task,
          text,
          speaker: MOCK_USER.name,
        })
        const body = reply || ''
        const cards = buildFlowCardsFromResult(task, result)
        const payload = { body, isThinking: false }
        if (cards.length === 1) payload.flowCard = cards[0]
        else if (cards.length > 1) payload.flowCards = cards
        updateMessage(conversationId, eventId, { content: payload })
      } catch (e) {
        updateMessage(conversationId, eventId, {
          content: {
            body: `⚠️ 理解失败：${e?.message || e}`,
            isThinking: false,
          },
        })
      }
    }

    function getActionVerb(step) {
      if (!step) return '响应'
      return ({ confirm: '确认完成', text: '提供信息', file: '上传文件', vote: '投票' })[step.submit_type] || '响应'
    }

    /**
     * 把 store action result 翻译成 flowCards 数组（可能 1 个或 N 个）
     * 并行场景下推 1 张主卡 + N 张 next-step 子卡
     */
    function buildFlowCardsFromResult(task, result) {
      if (!result) return []
      switch (result.kind) {
        case 'advanced': {
          if (result.completed) {
            return [{ taskId: task.id, kind: 'completed', doneStepId: result.doneStep?.id }]
          }
          return buildCardsForActivation(task, result.activated || [], 'advanced')
        }
        case 'progress':
          return [{
            taskId: task.id,
            kind: 'progress',
            doneStepId: result.step?.id,
            progressLabel: `${result.step?.name}：${(result.step?.completed_by?.length || 0) + (result.step?.skipped_by?.length || 0)}/${result.step?.assignees?.length || 0}`,
            remainAssignees: result.remain || [],
          }]
        case 'skipped':
          return buildCardsForActivation(task, result.activated || [], 'skipped')
        case 'back':
          if (!result.target) return []
          return [{
            taskId: task.id,
            kind: 'back',
            nextStepId: result.target.id,
            nextStepNames: result.target.name,
            assignees: result.target.assignees || [],
          }]
        case 'abort-confirm-pending':
          return [{ taskId: task.id, kind: 'abort-pending' }]
        case 'aborted':
          return [{ taskId: task.id, kind: 'aborted' }]
        case 'edited':
          return [{ taskId: task.id, kind: 'edited', editedStepId: result.step?.id, field: result.field }]
        default:
          return []
      }
    }

    /**
     * 快捷投票：CollabFlowCard 点选项时调用
     *   - 不推 "我选 X" 用户消息（用户要求：直接在原投票卡里展示已投+票数）
     *   - 只在以下场景推 AI 消息：
     *     * 步骤刚好满员 → 推一条"投票完成，进入下一步"
     *     * 任务完成 → 推一条"任务全部完成 🎉"
     *   - 进度中（没满员）：不刷屏，只让原卡片更新成横条态
     */
    async function quickVote(conversationId, taskId, stepId, option) {
      const t = taskStore.tasks[taskId]
      if (!t) return
      const step = t.steps.find((s) => s.id === stepId)
      if (!step) return
      const me = MOCK_USER.name
      if (!step.assignees.includes(me)) return
      if (step.completed_by.includes(me)) return

      const result = taskStore.applySubmit({ task: t, speaker: me, targetStepId: stepId, content: option })

      // 没满员（progress）→ 不推新消息，原卡片会响应式刷新成"已投+横条"
      if (result.kind === 'progress') return

      // 满员推进或完成 → 推 AI 反馈消息（带新流转卡）
      let body = ''
      if (result.kind === 'advanced') {
        if (result.completed) {
          body = '任务全部完成 🎉'
        } else {
          const next = result.activated || []
          const at = [...new Set(next.flatMap((s) => s.assignees))].map((a) => `@${a}`).join(' ')
          body = `投票完成，${at} ${buildVerbHint(next)}`
        }
        const cards = buildFlowCardsFromResult(t, result)
        const extra = { isThinking: false }
        if (cards.length === 1) extra.flowCard = cards[0]
        else if (cards.length > 1) extra.flowCards = cards
        pushAssistantMessage(conversationId, body, extra)
      }
    }

    if (typeof window !== 'undefined') {
      window.__kookyMock = window.__kookyMock || {}
      window.__kookyMock.quickVote = quickVote
    }

    // ─────────────────────────────────────────────────────────
    // 🦀 帮我回复：调 demo-server deerflow chat 流式起草回复
    //   1. 点击"🦀 帮我回复" → aiDraftStore.startDraft(cid, sourceMessage)
    //   2. 这个函数构造起草 prompt，开 SSE，流式 appendText 进 store
    //   3. GroupChatInput 监听 store，显示 banner / 填充输入框
    // ─────────────────────────────────────────────────────────
    const aiDraftStore = useAiDraftStore(pinia)

    async function startAiDraft(conversationId, sourceMessage) {
      if (!conversationId || !sourceMessage) return
      aiDraftStore.startDraft(conversationId, sourceMessage)

      // 构造起草 prompt（按"分身视角"语气）
      const senderName = sourceMessage.senderName || sourceMessage.sender || '对方'
      const sourceBody = sourceMessage.content?.body
        || sourceMessage.content?.text
        || (typeof sourceMessage.content === 'string' ? sourceMessage.content : '')
      const draftPrompt = [
        '你是用户「孟世一」的 AI 分身，正在帮他对一条群聊消息起草回复。',
        '',
        '【对方消息】',
        `发言人：${senderName}`,
        `内容：${sourceBody || '(空)'}`,
        '',
        '【起草要求】',
        '- 用孟世一第一人称的语气',
        '- 简短、自然、有用（1-2 句话最好）',
        '- 不要说"作为 AI..."这种废话',
        '- 不要前缀（如"好的，"、"我觉得..."除非必要）',
        '- 直接输出回复内容本身，让用户能直接发送',
        '',
        '现在请输出回复：',
      ].join('\n')

      try {
        const res = await fetch('http://localhost:3939/api/deerflow/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: draftPrompt }],
            threadId: `draft-${conversationId}-${Date.now()}`,
          }),
        })
        if (!res.ok) throw new Error(`demo-server 返回 ${res.status}`)
        if (!res.body) throw new Error('demo-server 未返回 SSE 流')

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let sep
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            let evtName = 'message'
            let dataStr = ''
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) evtName = line.slice(6).trim()
              else if (line.startsWith('data:')) dataStr = line.slice(5).trim()
            }
            let data = null
            try { data = dataStr ? JSON.parse(dataStr) : null } catch (_) {}
            if (evtName === 'text-block' && data?.text) {
              aiDraftStore.appendText(conversationId, data.text)
            } else if (evtName === 'done') {
              aiDraftStore.setReady(conversationId)
            } else if (evtName === 'error') {
              aiDraftStore.setError(conversationId, data?.message || '未知错误')
            }
          }
        }
        aiDraftStore.setReady(conversationId)
      } catch (e) {
        console.error('[ai-draft] failed:', e)
        aiDraftStore.setError(conversationId, e?.message || String(e))
      }
    }

    if (typeof window !== 'undefined') {
      window.__kookyMock.startAiDraft = startAiDraft
    }

    // ─────────────────────────────────────────────────────────
    // 注入内置协作群 + 历史对话
    //   1. mockGroupMembers 注成员
    //   2. groupStore.conversations 注会话
    //   3. pushMessage 注历史消息
    // 让 Cmd+R 后协作页面直接有"活动中"的群
    // ─────────────────────────────────────────────────────────
    function seedBuiltinGroups() {
      const groups = builtinGroups()
      const nowMs = Date.now()
      let totalMessages = 0
      for (const g of groups) {
        // 1. 成员名单
        if (!mockGroupMembers.has(g.conversationId)) {
          mockGroupMembers.set(g.conversationId, buildMockMembers(g.accounts, g.botIds))
        }
        // 2. 会话记录
        const existing = groupStore.conversations?.find?.((c) => c.conversationId === g.conversationId)
        if (!existing) {
          const memberCount = g.accounts.length + (g.botIds?.length || 0)
          groupStore.conversations.push({
            conversationId: g.conversationId,
            name: g.name,
            conversationName: g.name,
            createRoomType: 'group_chat',
            createdAt: g.createdAt,
            lastMessageAt: g.lastMessageAt || g.createdAt,
            memberCount,
            unreadCount: 0,
          })
        }
        // 3. 历史消息
        const msgs = g.messages || []
        for (let i = 0; i < msgs.length; i++) {
          const msg = msgs[i]
          const senderInfo = lookupSenderForMessage(msg.sender)
          if (!senderInfo) continue
          const timestamp = nowMs + (msg.t || 0)
          pushMessage(g.conversationId, {
            eventId: `builtin-${g.conversationId}-msg-${i}`,
            role: senderInfo.role,
            senderId: senderInfo.userId,
            senderName: senderInfo.name,
            senderType: senderInfo.type,
            content: { body: msg.body },
            timestamp,
            seq: timestamp,
          })
          totalMessages++
        }
      }
      console.log(`[dev-mocks v2] 注入 ${groups.length} 个内置协作群 + ${totalMessages} 条历史消息`)
    }

    try {
      // 先 patch cleanup：保护内置 mock 群不被 imConnection.disconnect() 清掉
      // （Electron / 真实后端不可用时 IM 会断开，但内置演示数据应当存活）
      if (groupStore && !groupStore.__mockCleanupPatched) {
        groupStore.__mockCleanupPatched = true
        const origCleanup = groupStore._onDisconnectCleanup?.bind(groupStore)
        groupStore._onDisconnectCleanup = function patchedCleanup() {
          const before = (this.conversations || []).length
          const survivors = (this.conversations || []).filter(c =>
            /^(mock-|sched-conv-)/.test(String(c?.conversationId || ''))
          )
          if (typeof origCleanup === 'function') origCleanup()
          this.conversations = survivors
          console.log(`[dev-mocks v2] _onDisconnectCleanup called: before=${before} survivors=${survivors.length}`, new Error('stack').stack?.split('\n').slice(1, 6).join('\n'))
        }
        const origReset = groupStore._onResetCleanup?.bind(groupStore)
        groupStore._onResetCleanup = function patchedReset() {
          const survivors = (this.conversations || []).filter(c =>
            /^(mock-|sched-conv-)/.test(String(c?.conversationId || ''))
          )
          if (typeof origReset === 'function') origReset()
          this.conversations = survivors
        }
        console.log('[dev-mocks v2] groupStore cleanup 已 patch（先于 seed，确保 mock 群存活）')
      }
      // 再 seed 内置群（此时 cleanup 已被 patch 包装，后续清理会保留 mock-* 群）
      seedBuiltinGroups()
      // 兜底：IM disconnect / $reset 等可能在 dev-mocks 完成后异步清空 conversations
      // 起一个监听器，发现 mock-* / sched-conv-* 群丢失就补回去（持续 10s 后停止）
      const seedSnapshot = (() => {
        const groups = builtinGroups()
        return groups.map(g => ({
          conversationId: g.conversationId,
          name: g.name,
          conversationName: g.name,
          createRoomType: 'group_chat',
          createdAt: g.createdAt,
          lastMessageAt: g.lastMessageAt || g.createdAt,
          memberCount: g.accounts.length + (g.botIds?.length || 0),
          unreadCount: 0,
        }))
      })()
      let guardTicks = 0
      const guardTimer = setInterval(() => {
        guardTicks++
        try {
          const existingIds = new Set((groupStore.conversations || []).map(c => c.conversationId))
          let restored = 0
          for (const g of seedSnapshot) {
            if (!existingIds.has(g.conversationId)) {
              groupStore.conversations.push(g)
              restored++
            }
          }
          if (restored > 0) console.log(`[dev-mocks v2] guard: 补回 ${restored} 个内置群`)
        } catch (e) { /* noop */ }
        if (guardTicks >= 20) clearInterval(guardTimer) // 10s 后停止守护
      }, 500)
    } catch (e) {
      console.warn('[dev-mocks v2] 内置协作群注入失败:', e)
    }

    // ─────────────────────────────────────────────────────────
    // 发布会演示剧本：window.__playLaunchDemo()
    // 在「Kooky 0.0.72 发布冲刺」群里按时间轴播放 5 真人 + 2 数字员工的协作对话
    // 用于在 Chrome 里录制 gif/mp4 的发布会主秀
    // ─────────────────────────────────────────────────────────
    function _delay(ms) {
      return new Promise((r) => setTimeout(r, ms))
    }

    function _scrollToBottom() {
      // 让消息列表滚到底部，确保新消息可见
      try {
        const scroller =
          document.querySelector('.message-list-scroll') ||
          document.querySelector('.messages-wrapper')?.parentElement
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight + 9999
        }
      } catch (e) {
        /* noop */
      }
    }

    /**
     * 模拟"打字 + 发送"效果：
     *   1. 聚焦输入框
     *   2. 逐字 push 到 contenteditable
     *   3. 停顿一下，模拟"想发送"的迟疑
     *   4. 清空输入框 + push 真消息到右侧
     */
    // 录制专用 CSS（一次性注入）：强制数字员工 actions 走 hover 模式
    // 否则 Kooky 默认让"最新一条 finished assistant"的 actions 常驻显示，录制时显得违和
    ;(function _ensureDemoRecordingStyle() {
      if (document.getElementById('demo-recording-style')) return
      const style = document.createElement('style')
      style.id = 'demo-recording-style'
      style.textContent = `
        .message-item.assistant .msg-actions {
          opacity: 0 !important;
          transition: opacity 0.15s !important;
          pointer-events: none;
        }
        .message-item.assistant:hover .msg-actions {
          opacity: 1 !important;
          pointer-events: auto;
        }
        /* 录制时强制隐藏 Claude in Chrome 扩展注入的视觉指示器：
           - #claude-agent-glow-border：4 边橙色发光
           - #claude-phantom-cursor：橙色幻影鼠标
           ⚠️ 扩展用的是 id 而不是 className，所以必须用 id selector */
        #claude-agent-glow-border,
        #claude-phantom-cursor,
        [id^="claude-agent-"],
        [id^="claude-phantom"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `
      document.head.appendChild(style)
      // 双保险：MutationObserver 监听新插入的 claude-* id 节点直接 remove
      try {
        const SELECTORS = '#claude-agent-glow-border, #claude-phantom-cursor, [id^="claude-agent-"], [id^="claude-phantom"]'
        const killExtensionNodes = () => {
          document.querySelectorAll(SELECTORS).forEach((el) => {
            el.style.display = 'none'
            el.style.opacity = '0'
            el.style.visibility = 'hidden'
            el.style.pointerEvents = 'none'
          })
        }
        killExtensionNodes()
        const mo = new MutationObserver(killExtensionNodes)
        mo.observe(document.documentElement, { childList: true, subtree: true })
      } catch (e) { /* noop */ }
    })()

    // 注入 fake input overlay 的 CSS（只注一次）
    function _ensureFakeInputStyle() {
      if (document.getElementById('demo-fake-input-style')) return
      const style = document.createElement('style')
      style.id = 'demo-fake-input-style'
      style.textContent = `
        @keyframes demo-cursor-blink { 50% { opacity: 0; } }
        .demo-fake-input {
          background: #ffffff;
          color: #1f2129;
          font-size: 14px;
          font-family: inherit;
          line-height: 22px;
          padding: 0 16px;
          box-sizing: border-box;
          pointer-events: none;
          white-space: pre-wrap;
          word-break: break-word;
          border-radius: 8px;
        }
        .demo-fake-input .demo-cursor {
          display: inline-block;
          width: 2px;
          height: 18px;
          background: #F58138;
          margin-left: 1px;
          vertical-align: middle;
          animation: demo-cursor-blink 1s steps(2) infinite;
        }
        /* 引用 skill chip 浮层 */
        .demo-skill-chip-row {
          position: fixed;
          z-index: 999998;
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
          pointer-events: none;
        }
        .demo-skill-chip {
          box-sizing: border-box;
          height: 30px;
          display: inline-flex;
          align-items: center;
          padding: 0 8px;
          gap: 6px;
          border-radius: 6px;
          background: #F5F6F9;
          color: #2F3547;
          font-size: 14px;
          line-height: 1;
          box-shadow: 0 2px 8px rgba(31, 33, 41, 0.06);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 220ms ease, transform 220ms ease;
        }
        .demo-skill-chip.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .demo-skill-chip .demo-skill-emoji {
          font-size: 16px;
          line-height: 1;
        }
        .demo-skill-chip .demo-skill-name {
          font-size: 14px;
          line-height: 1;
          white-space: nowrap;
        }
        .demo-skill-chip .demo-skill-close {
          width: 14px;
          height: 14px;
          margin-left: 2px;
          opacity: 0.45;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        /* 仿真技能选择器 popper */
        .demo-skill-popper {
          position: fixed;
          z-index: 999998;
          background: #ffffff;
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(31, 33, 41, 0.18);
          padding: 6px;
          min-width: 210px;
          pointer-events: none;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 200ms ease, transform 200ms ease;
          font-family: inherit;
        }
        .demo-skill-popper.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .demo-skill-popper-title {
          padding: 4px 10px 8px;
          font-size: 12px;
          color: #91949E;
        }
        .demo-skill-popper-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          font-size: 14px;
          color: #2F3547;
          line-height: 1.2;
          transition: background 160ms ease, color 160ms ease;
        }
        .demo-skill-popper-item.is-active {
          background: #FFF3EC;
          color: #F5824A;
          font-weight: 600;
        }
        .demo-skill-popper-emoji {
          font-size: 18px;
          line-height: 1;
        }
      `
      document.head.appendChild(style)
    }

    // 在分身输入框上方插一个「已引用 skill」的浮层 chip（视觉演示）
    async function _showSkillChip({ emoji = '✨', name = '技能', stay = 1600 } = {}) {
      _ensureFakeInputStyle()
      // 复用 _typeInDeerflowInput 的输入框定位算法
      const vw = window.innerWidth
      const vh = window.innerHeight
      let inputBox = null
      try {
        const probeX = vw / 2
        for (let probeY = vh - 80; probeY > vh / 2; probeY -= 8) {
          const els = document.elementsFromPoint(probeX, probeY)
          const found = els.find((el) => el.classList?.contains('chat-input-editable'))
          if (found) {
            inputBox = found.closest('.input-container') || found.closest('.textarea-wrapper') || found
            break
          }
        }
      } catch (e) { /* noop */ }
      let left, top
      if (inputBox) {
        const r = inputBox.getBoundingClientRect()
        left = r.left + 8
        top = r.top - 38
      } else {
        left = 410
        top = vh - 180
      }
      // 复用已存在的 chip row，多次调用时累加
      let row = document.querySelector('.demo-skill-chip-row')
      if (!row) {
        row = document.createElement('div')
        row.className = 'demo-skill-chip-row'
        document.body.appendChild(row)
      }
      row.style.left = `${left}px`
      row.style.top = `${top}px`
      const chip = document.createElement('div')
      chip.className = 'demo-skill-chip'
      chip.innerHTML = `<span class="demo-skill-emoji">${emoji}</span><span class="demo-skill-name">${name}</span><span class="demo-skill-close">×</span>`
      row.appendChild(chip)
      // 触发渐显
      await _delay(20)
      chip.classList.add('is-visible')
      if (stay > 0) await _delay(stay)
    }

    function _clearSkillChips() {
      document.querySelectorAll('.demo-skill-chip-row').forEach((el) => el.remove())
      document.querySelectorAll('.demo-skill-popper').forEach((el) => el.remove())
    }

    // 仿真技能选择器：弹出 popper → 高亮目标 → 关闭 → 输入框上方留 chip
    const _DEMO_SKILLS_LIST = [
      { emoji: '💡', name: '头脑风暴' },
      { emoji: '🔎', name: '深度搜索' },
      { emoji: '🎨', name: 'PPT 生成' },
      { emoji: '📝', name: 'Word 文档生成' },
      { emoji: '📅', name: '日报/周报生成' },
      { emoji: '🧰', name: '产品经理工具箱' },
    ]
    async function _simulateSkillPick({ emoji, name }) {
      _ensureFakeInputStyle()
      const vh = window.innerHeight
      const itemH = 36
      const totalH = _DEMO_SKILLS_LIST.length * itemH + 32
      // 定位：以「技能选择器按钮」为锚点，找不到就以 input 容器左下角为参考
      let left, top
      const btn = document.querySelector('.skill-selector-wrap')
        || document.querySelector('.input-bottom-left')
        || document.querySelector('.chat-input-editable')?.closest('.input-container')
      if (btn) {
        const r = btn.getBoundingClientRect()
        left = Math.max(12, r.left)
        top = Math.max(12, r.top - totalH - 8)
      } else {
        left = 410
        top = vh - totalH - 120
      }
      const popper = document.createElement('div')
      popper.className = 'demo-skill-popper'
      popper.style.left = `${left}px`
      popper.style.top = `${top}px`
      popper.innerHTML = [
        '<div class="demo-skill-popper-title">选择技能</div>',
        ..._DEMO_SKILLS_LIST.map(
          (s) => `<div class="demo-skill-popper-item" data-name="${s.name}"><span class="demo-skill-popper-emoji">${s.emoji}</span><span>${s.name}</span></div>`,
        ),
      ].join('')
      document.body.appendChild(popper)
      // 渐显
      await _delay(20)
      popper.classList.add('is-visible')
      await _delay(650)
      // 高亮目标项
      const target = popper.querySelector(`.demo-skill-popper-item[data-name="${name}"]`)
      if (target) target.classList.add('is-active')
      await _delay(500)
      // 关闭
      popper.classList.remove('is-visible')
      await _delay(220)
      popper.remove()
      // 输入框上方挂 chip（stay:0 = 立即返回，等 _clearSkillChips 收掉）
      await _showSkillChip({ emoji, name, stay: 0 })
    }

    function _spawnFakeInputOverlay() {
      _ensureFakeInputStyle()
      // 清掉残留
      document.querySelector('.demo-fake-input')?.remove()

      // ⚠️ 优先：用 elementsFromPoint 实时探测输入框真实位置（DPR 安全、toast 安全）
      // ChromeExt isolated bcr 经常报 0，但 elementsFromPoint 用 page 真实 layout
      let left, top, width, height
      const vw = window.innerWidth
      const vh = window.innerHeight
      // 找输入框：从右下角往里探 placeholder 中心点
      let inputBox = null
      try {
        const probeX = vw / 2
        for (let probeY = vh - 80; probeY > vh / 2; probeY -= 8) {
          const els = document.elementsFromPoint(probeX, probeY)
          inputBox = els.find((el) => el.classList?.contains('chat-input-editable'))
            || els.find((el) => el.closest?.('.input-container'))
          if (inputBox) {
            inputBox = inputBox.closest('.input-container') || inputBox.closest('.textarea-wrapper') || inputBox
            const r = inputBox.getBoundingClientRect()
            if (r.width > 100 && r.height > 30) break
            inputBox = null
          }
        }
      } catch (e) { /* noop */ }

      if (inputBox) {
        const r = inputBox.getBoundingClientRect()
        // 输入框 textarea 区域：input-container 顶部往下偏一点（避开圆角边框）
        left = r.left + 4
        top = r.top + 4
        width = r.width - 8
        // 固定 textarea 高度，避免盖到底部按钮
        height = Math.min(r.height - 50, 56)
        if (height < 30) height = 56
      } else {
        // fallback：硬编码估算（基于 1512×691 viewport）
        left = 396
        const right = 192
        const bottomGap = 90
        height = 56
        top = vh - bottomGap - height
        width = vw - left - right
      }

      const overlay = document.createElement('div')
      overlay.className = 'demo-fake-input'
      overlay.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: ${height}px;
        z-index: 999999;
        display: flex;
        align-items: center;
      `
      const textNode = document.createElement('span')
      textNode.className = 'demo-text'
      const cursor = document.createElement('span')
      cursor.className = 'demo-cursor'
      overlay.appendChild(textNode)
      overlay.appendChild(cursor)
      document.body.appendChild(overlay)
      return { overlay, textNode }
    }

    /**
     * 模拟"打字 + 发送"效果：
     * 由于 Kooky 输入框的 Vue 状态从扩展 context 改不动（isolated world 同步问题），
     * 直接在输入框父容器叠一个 fake overlay div 逐字写文字 + 光标闪烁，
     * 录制时视觉上跟真打字几乎一致。完成后移除 overlay + 推真消息。
     */
    async function _typeAndSend(cid, text, intervalMs = 90) {
      const handle = _spawnFakeInputOverlay()
      if (!handle) {
        console.warn('[demo] 创建 fake input overlay 失败，回退到直接发送')
        pushUserMessage(cid, text)
        return
      }
      let buf = ''
      for (const ch of text) {
        buf += ch
        handle.textNode.textContent = buf
        await _delay(intervalMs + Math.random() * 40)
      }
      // 假装"想了想"再发
      await _delay(500)
      // 移除 overlay + push 真消息
      handle.overlay.remove()
      pushUserMessage(cid, text)
      requestAnimationFrame(() => _scrollToBottom())
      setTimeout(_scrollToBottom, 80)
    }

    // 扫描消息正文里的 @xxx，匹配同事 / 数字员工 / 团队助手名，组成 mentions 数组
    // 给 useUserBubbleMarkdown 用，触发 .mention-tag 蓝字高亮
    function _extractMentionsFromText(text) {
      if (!text || typeof text !== 'string') return []
      const names = []
      // 候选名池：同事 displayName + 数字员工 display_name + 团队助手
      const candidates = [
        ...COLLEAGUES.map((c) => ({ name: c.name, id: c.userId })),
        ...DIGITAL_HUMANS_RAW.map((d) => ({ name: d.agent_display_name, id: `agent-${d.agent_id}` })),
        { name: '团队助手', id: 'team-assistant' },
        { name: CURRENT_USER.name, id: CURRENT_USER.userId },
      ]
      // 长名优先（避免 "代码" 误匹配 "@代码助手"）
      candidates.sort((a, b) => b.name.length - a.name.length)
      const lower = text
      for (const cand of candidates) {
        const at = '@' + cand.name
        if (lower.includes(at)) {
          names.push({ id: cand.id, name: cand.name })
        }
      }
      return names
    }

    function _pushMemberMessage(cid, userName, text) {
      const u = COLLEAGUES.find((c) => c.userName === userName || c.userId === userName)
      if (!u) {
        console.warn('[demo] 找不到同事:', userName)
        return null
      }
      const id = pushMessage(cid, {
        role: 'member',
        senderId: u.userId,
        senderName: u.name,
        senderType: 'user',
        senderAvatar: u.avatar || '',
        content: { body: text, mentions: _extractMentionsFromText(text) },
      })
      // 下一帧再滚（等 Vue 更新 DOM）
      requestAnimationFrame(() => _scrollToBottom())
      setTimeout(_scrollToBottom, 80)
      return id
    }

    async function _pushAgentStream(cid, agentId, chunks, intervalMs = 500, thinkingMs = 2500) {
      const dh = DIGITAL_HUMANS_RAW.find((a) => Number(a.agent_id) === Number(agentId))
      if (!dh) {
        console.warn('[demo] 找不到数字员工:', agentId)
        return null
      }
      // 先 push 一条"正在思考"（messageBody 设成 "X 正在思考..." 让 indicator 显示对应数字员工名）
      const eventId = pushMessage(cid, {
        role: 'assistant',
        senderId: `agent-${dh.agent_id}`,
        senderName: dh.agent_display_name,
        senderType: 'agent',
        senderAvatar: dh.agent_avatar_url || '',
        content: { body: `${dh.agent_display_name}正在思考…`, isThinking: true },
      })
      requestAnimationFrame(() => _scrollToBottom())
      setTimeout(_scrollToBottom, 80)
      // 思考停顿（让"正在思考"指示器停留更真实）
      await _delay(thinkingMs)
      // 流式累加 body
      let accumulated = ''
      for (const chunk of chunks) {
        accumulated += chunk
        updateMessage(cid, eventId, {
          content: { body: accumulated, isThinking: false },
        })
        _scrollToBottom()
        await _delay(intervalMs)
      }
      return eventId
    }

    // 系统消息：建群通知（原生 group.created 类型 → 渲染为"X 创建了团队 + 邀请 Y、Z 进入团队"）
    function _pushGroupCreated(cid) {
      const eventId = pushMessage(cid, {
        role: 'system',
        type: 'group.created',
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        content: {
          creator: { id: 'yrdeng2', display_name: '邓颖茹', type: 'user' },
          initial_members: [
            { id: 'symeng7', display_name: '孟世一', type: 'user' },
            { id: 'ylyang21', display_name: '杨宇龙', type: 'user' },
            { id: 'yanhuang', display_name: '黄燕', type: 'user' },
            { id: 'qbhu', display_name: '胡勤彪', type: 'user' },
            { id: 'jrnie', display_name: '聂家睿', type: 'user' },
            { id: 'jbxu2', display_name: '徐俊保', type: 'user' },
          ],
        },
      })
      requestAnimationFrame(() => _scrollToBottom())
      setTimeout(_scrollToBottom, 80)
      return eventId
    }

    // 系统消息：单个 member.joined（"邓颖茹 邀请 X 进入团队"）
    function _pushMemberJoined(cid, member) {
      const eventId = pushMessage(cid, {
        role: 'system',
        type: 'member.joined',
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        content: {
          join_type: 'invited',
          inviter: { id: 'yrdeng2', display_name: '邓颖茹', type: 'user' },
          member,
        },
      })
      requestAnimationFrame(() => _scrollToBottom())
      setTimeout(_scrollToBottom, 80)
      return eventId
    }

    // 等待用户手动在 UI 上建群「Kooky 520 发布会」—— 返回新建群 cid
    // 检测方式：每 300ms 扫 groupStore.conversations / conversationMessages，
    //   找名字含「520」或「发布会」的群，且 currentConversationId 已切到它
    async function _waitForLaunchGroupCreated(timeoutMs = 5 * 60 * 1000) {
      const matchName = (name) => {
        if (!name) return false
        return String(name).includes('520') || String(name).includes('发布会')
      }
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        try {
          const convs = groupStore.conversations || []
          const hit = convs.find((c) => matchName(c.name) || matchName(c.title))
          if (hit) {
            const newCid = hit.conversationId || hit.id || hit.roomId
            if (newCid && groupStore.currentConversationId === newCid) {
              return newCid
            }
            if (newCid) return newCid // 即使没切过去也算检测到
          }
        } catch (e) { /* noop */ }
        await _delay(300)
      }
      throw new Error('等待建群超时（5 分钟）')
    }

    window.__playLaunchDemo = async function playLaunchDemo(opts = {}) {
      const startDelayMs = typeof opts.delayMs === 'number' ? opts.delayMs : 3000

      console.log('[demo] ⏸ 等你现场操作：点右上「+ 创建群聊」→ 填名「Kooky 520 发布会」→ 联系人 tab 钻到「平台产品技术部」全员勾选 → 数字人 tab 勾选 测试/研发/产品 数字人 → 确定')
      const cid = await _waitForLaunchGroupCreated()
      console.log(`[demo] ✦ 检测到群已创建 cid=${cid}`)

      // 确认建群完成后等 ${startDelayMs}ms，给现场喘口气
      if (startDelayMs > 0) {
        console.log(`[demo] ⏱ ${startDelayMs / 1000}s 后开播业务对话…`)
        await _delay(startDelayMs)
      }
      console.log('[demo] ▶ Kooky 520 发布会 业务剧本播放开始')

      // ─── 剧本主体 ───

      // 0–3s ▶ 邓颖茹拉群 + 我（孟世一）开口
      _pushMemberMessage(cid, 'yrdeng2', '@测试数字人 跑一遍核心场景回归，明天要 demo')
      await _delay(2500)

      // 3–9s ▶ 测试数字人流式回复
      await _pushAgentStream(cid, 1003, [
        '正在执行核心场景回归测试…',
        '\n\n✅ 协作任务创建 / 群聊消息 / 定时任务  全部通过',
        '\n⚠️  Skill 安装到 Kode 这步点击响应慢 ~500ms',
        '\n建议查一下接口耗时',
      ], 600)
      await _delay(1200)

      // 9–13s ▶ 徐俊保 + 聂家睿
      _pushMemberMessage(cid, 'jbxu2', '我刚也复现了，是接口慢')
      await _delay(1500)
      _pushMemberMessage(cid, 'jrnie', '我看下，应该是 binding-status 接口')
      await _delay(2000)

      // 13–19s ▶ 胡勤彪拉数字人分析
      _pushMemberMessage(cid, 'qbhu', '@研发数字人 跑下 fetchSkillBindingStatus 的耗时分布')
      await _delay(1500)
      await _pushAgentStream(cid, 1002, [
        '正在分析接口耗时…',
        '\n\nP95 = 1.2s，热点在 DB 查询 `skill_bindings` 全表扫描',
        '\n建议方案：加二级缓存 + 索引覆盖，预计提速 70%',
        '\npatch 已贴群里 ✅',
      ], 550)
      await _delay(1200)

      // 19–22s ▶ 我（孟世一）领任务去录介绍视频（带打字效果）
      await _typeAndSend(cid, '速修！我去录介绍视频 ✊')
      await _delay(1500)

      // 22–25s ▶ 邓颖茹收尾拍板
      _pushMemberMessage(cid, 'yrdeng2', '冲！明天见 🚀')
      console.log('[demo] ⏹ 剧本播放结束')
    }

    // 重置：把上一次现场建的「Kooky 520 发布会」群（或类似名字）从侧栏 + 消息池里整个抹掉，
    // 让下次跑 __playLaunchDemo 时再走一遍完整的建群操作。
    window.__resetLaunchDemo = function resetLaunchDemo() {
      try {
        const isLaunchGroup = (c) => {
          const name = c?.name || c?.title || ''
          return name.includes('520') || name.includes('发布会')
        }
        const convs = groupStore.conversations || []
        const targets = convs.filter(isLaunchGroup)
        for (const t of targets) {
          const cid = t.conversationId || t.id || t.roomId
          if (!cid) continue
          // 1) 清消息池
          if (groupStore.conversationMessages?.[cid]) {
            delete groupStore.conversationMessages[cid]
          }
          // 2) 清成员
          if (groupStore.conversationMembers?.[cid]) {
            delete groupStore.conversationMembers[cid]
          }
          // 3) 从 conversations 列表抹掉
          const idx = groupStore.conversations.findIndex((c) => (c.conversationId || c.id || c.roomId) === cid)
          if (idx >= 0) groupStore.conversations.splice(idx, 1)
          // 4) 如果当前正在那个群里，把 currentConversationId 清掉
          if (groupStore.currentConversationId === cid) {
            groupStore.currentConversationId = null
          }
          console.log(`[demo] 已抹除现场建的发布会群 cid=${cid} name=${t.name}`)
        }
        if (!targets.length) {
          console.log('[demo] 没有需要清理的发布会群，初始状态干净')
        }
      } catch (e) {
        console.warn('[demo] reset failed:', e)
      }
    }

    console.log('[dev-mocks v2] 演示剧本已就绪：window.__playLaunchDemo() / window.__resetLaunchDemo()')

    // ─────────────────────────────────────────────────────────
    // 分身页演示剧本：3 幕（记忆沉淀 / 日报生成 / PRD 全流程）
    // 通过 window.__deerflowChat（DeerflowChatPanel 暴露）操作消息
    // 通过 window.__personaMemoryBridge（PersonaManagePanel 暴露）操作记忆
    // ─────────────────────────────────────────────────────────

    // 在分身输入框做 fake 打字 overlay（复用相同 css，定位用 deerflow input 元素）
    async function _typeInDeerflowInput(text, intervalMs = 90) {
      _ensureFakeInputStyle()
      const editor = document.querySelector('.chat-input-editable')
      if (!editor) return null
      // 定位：用 input wrapper bounding rect（page render 真实位置）
      const wrapper = editor.closest('.input-container') || editor.closest('.textarea-wrapper') || editor.parentElement
      let left, top, width, height
      const vw = window.innerWidth
      const vh = window.innerHeight
      // 直接探测：尝试用 elementsFromPoint 找输入框真实位置
      try {
        const probeX = vw / 2
        let inputBox = null
        for (let probeY = vh - 80; probeY > vh / 2; probeY -= 8) {
          const els = document.elementsFromPoint(probeX, probeY)
          const found = els.find((el) => el.classList?.contains('chat-input-editable'))
          if (found) {
            inputBox = found.closest('.input-container') || found.closest('.textarea-wrapper') || found
            break
          }
        }
        if (inputBox) {
          const r = inputBox.getBoundingClientRect()
          if (r.width > 100) {
            left = r.left + 4
            top = r.top + 4
            width = r.width - 8
            height = Math.min(r.height - 50, 56)
            if (height < 30) height = 56
          }
        }
      } catch (e) { /* noop */ }
      if (left == null) {
        // fallback 硬编码
        left = 396
        const right = 192
        const bottomGap = 90
        height = 56
        top = vh - bottomGap - height
        width = vw - left - right
      }
      document.querySelector('.demo-fake-input')?.remove()
      const overlay = document.createElement('div')
      overlay.className = 'demo-fake-input'
      overlay.style.cssText = `position: fixed; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; z-index: 999999; display: flex; align-items: center;`
      const textNode = document.createElement('span')
      textNode.className = 'demo-text'
      const cursor = document.createElement('span')
      cursor.className = 'demo-cursor'
      overlay.appendChild(textNode)
      overlay.appendChild(cursor)
      document.body.appendChild(overlay)
      let buf = ''
      for (const ch of text) {
        buf += ch
        textNode.textContent = buf
        await _delay(intervalMs + Math.random() * 40)
      }
      await _delay(450)
      overlay.remove()
    }

    // 流式输出到一条 AI 消息（节奏接近真实 ChatGPT：每字 ~50-80ms）
    async function _streamToAssistant(aiId, chunks, intervalMs = 60) {
      const ds = window.__deerflowChat
      if (!ds) return
      for (const chunk of chunks) {
        ds.appendAssistantChunk(aiId, chunk)
        await _delay(intervalMs + Math.random() * 30)
      }
      ds.finishAssistant(aiId)
    }

    function _chunkText(text, size = 2) {
      const out = []
      for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
      return out
    }

    // —— 剧本 1：记忆沉淀 ——
    window.__playMemoryDemo = async function playMemoryDemo(opts = {}) {
      const ds = window.__deerflowChat
      if (!ds) { console.warn('[demo] DeerflowChatPanel 未就绪'); return }
      await _delay(typeof opts.delayMs === 'number' ? opts.delayMs : 2500)

      const text = '以后周报都用「本周完成 / 下周计划 / 风险提示」三段式，风险项加粗。'
      await _typeInDeerflowInput(text)
      ds.addUserMessage(text)
      await _delay(300)
      // 思考阶段：显示 thinking placeholder（让画面有反馈）
      const aiId = ds.addAssistantMessage('🦀 正在理解你的偏好...', { streaming: true })
      await _delay(2800)
      ds.replaceAssistantContent(aiId, '')
      await _streamToAssistant(aiId, _chunkText(
        '好的，已经记下你的周报偏好 ✦\n\n以后生成周报会按这个结构来：**本周完成 / 下周计划 / 风险提示**，风险项会自动加粗。',
        2,
      ), 60)
      // 同步进记忆
      const newText = '周报采用「本周完成 / 下周计划 / 风险提示」三段式，风险项加粗。'
      if (window.__personaMemoryBridge?.add) {
        window.__personaMemoryBridge.add(newText)
      } else {
        if (!Array.isArray(window.__personaMemoriesStore)) {
          window.__personaMemoriesStore = []
        }
        window.__personaMemoriesStore.unshift({
          id: `mem-${Date.now()}`,
          text: newText,
          isNew: true,
        })
      }
      console.log('[demo] ⏹ 记忆沉淀剧本结束 · ⏸ 5 秒缓冲让你切到记忆 tab 展示')
      // 留 5 秒给演示者切到「分身管理 → 编辑 → 记忆」tab 展示新增条目
      await _delay(5000)
      console.log('[demo] ▶ 缓冲结束，可以继续下一段')
    }

    // —— 剧本 2：日报/周报生成 ——
    window.__playWeeklyDemo = async function playWeeklyDemo(opts = {}) {
      const ds = window.__deerflowChat
      if (!ds) return
      await _delay(typeof opts.delayMs === 'number' ? opts.delayMs : 2500)

      // 仿真：点开技能选择器 → 选「日报/周报生成」→ chip 出现在输入框上方
      await _simulateSkillPick({ emoji: '📅', name: '日报/周报生成' })
      const text = '帮我生成本周周报'
      await _typeInDeerflowInput(text)
      ds.addUserMessage(text)
      // 发送之后 chip 同步消失
      _clearSkillChips()
      await _delay(300)
      // 思考阶段：显示 placeholder
      const aiId = ds.addAssistantMessage('🦀 正在调用「日报/周报生成」skill，整理本周进展...', { streaming: true })
      await _delay(3500)
      ds.replaceAssistantContent(aiId, '')
      const weekly = [
        '已调用「**日报/周报生成**」技能 📅\n\n',
        '## 本周完成\n',
        '- Kooky 协作能力 demo 录制完成\n',
        '- 发布会 PPT 初稿 v1 走查通过\n',
        '- Skill 安装到分身/Kode 流程优化\n',
        '- 协作群「Kooky 520 发布会」拉群跑通\n\n',
        '## 下周计划\n',
        '- 完成发布会现场演示彩排\n',
        '- 数字员工矩阵新增 2 个角色（设计 / 运营）\n',
        '- 一人团队 GA 文档定稿\n\n',
        '## 风险提示 ⚠️\n',
        '- **Kode 终端接口耗时 P95 1.2s，需赶在发布会前修复**\n',
        '- 设计稿走查反馈未完全闭环\n',
      ]
      await _streamToAssistant(aiId, weekly.flatMap((s) => _chunkText(s, 2)), 55)
      console.log('[demo] ⏹ 周报剧本结束')
    }

    // —— 剧本 3：PRD 全流程（头脑风暴 + 产品经理工具箱 + 文件产物） ——
    window.__playPRDDemo = async function playPRDDemo(opts = {}) {
      const ds = window.__deerflowChat
      if (!ds) return
      await _delay(typeof opts.delayMs === 'number' ? opts.delayMs : 2500)

      // 步骤 1：仿真点开技能选择器 → 选「头脑风暴」→ chip 进输入框
      await _simulateSkillPick({ emoji: '💡', name: '头脑风暴' })
      const q1 = '帮我想一下，Kooky 消息通知中心可以怎么做，列几个方向。'
      await _typeInDeerflowInput(q1)
      ds.addUserMessage(q1)
      _clearSkillChips()
      await _delay(300)
      const ai1 = ds.addAssistantMessage('🦀 正在调用「头脑风暴」skill，发散思考中...', { streaming: true })
      await _delay(3500)
      ds.replaceAssistantContent(ai1, '')
      const brainstorm = [
        '已调用「**头脑风暴**」技能 💡\n\n',
        '围绕「Kooky 消息通知中心」，给你 3 个方向 + MVP 建议：\n\n',
        '### 方向 1：通知卡片汇总页\n',
        '- 把分散在各模块的提醒收到统一时间线\n',
        '- 优势：实现成本低，1 周即可落地\n',
        '- 弱点：缺乏「处理」入口，仍要跳到原模块\n\n',
        '### 方向 2：消息汇总与处理入口（MVP 推荐 ⭐）\n',
        '- 不止汇总，提供「一键处理 / 一键忽略 / 转给同事」\n',
        '- 与协作任务卡片打通，待办可直接派发\n',
        '- 复杂度可控，2 周可发布\n\n',
        '### 方向 3：AI 智能批处理\n',
        '- 调用分身能力，自动分类 + 给出建议处理动作\n',
        '- 适合长期版本，需要 4 周以上\n\n',
        '**MVP 建议**：先做方向 2，把"看见 → 处理"链路打通。',
      ]
      await _streamToAssistant(ai1, brainstorm.flatMap((s) => _chunkText(s, 2)), 55)

      // 步骤 2：用户确认方向
      await _delay(1500)
      const q2 = '就按方向二，做消息汇总与处理入口。'
      await _typeInDeerflowInput(q2)
      ds.addUserMessage(q2)
      await _delay(300)
      const ai2 = ds.addAssistantMessage('🦀 收到，正在整理上下文...', { streaming: true })
      await _delay(2500)
      ds.replaceAssistantContent(ai2, '')
      await _streamToAssistant(ai2, _chunkText('好的，方向已确认。准备好后调用「产品经理工具箱」，我给你出一份完整 PRD。', 2), 65)

      // 步骤 3：仿真点开技能选择器 → 选「产品经理工具箱」→ chip 进输入框
      await _delay(1500)
      await _simulateSkillPick({ emoji: '🧰', name: '产品经理工具箱' })
      const q3 = '基于刚才头脑风暴的结论，帮我生成一份完整的产品需求文档。'
      await _typeInDeerflowInput(q3)
      ds.addUserMessage(q3)
      _clearSkillChips()
      await _delay(300)
      const ai3 = ds.addAssistantMessage('🦀 正在调用「产品经理工具箱」skill，起草需求文档...', { streaming: true })
      await _delay(4000)
      ds.replaceAssistantContent(ai3, '')
      const prdSummary = [
        '已调用「**产品经理工具箱**」技能 🧰\n\n',
        '正在基于头脑风暴方向 2 起草需求文档…\n\n',
        '✦ 已生成 **消息通知中心-MVP-需求文档.md**\n',
        '- 背景与目标\n- 功能列表（5 项）\n- 用户流程\n- 验收标准（12 条）\n- 排期与风险\n',
      ]
      await _streamToAssistant(ai3, prdSummary.flatMap((s) => _chunkText(s, 2)), 55)

      // 加文件产物卡片
      const prdContent = `# 消息通知中心 · MVP 需求文档

## 1. 背景与目标

Kooky 用户反馈：协作任务、群聊 @ 提及、定时任务等触发的消息分散在各模块，**容易错过、难以集中处理**。

本期 MVP 目标：在 Kooky 主侧栏新增「消息中心」入口，**统一汇总 + 提供处理动作**，让用户在一个地方看完、处理完。

## 2. 功能列表

- **F1 通知汇总时间线**：按时间倒序展示所有未读 / 已读消息
- **F2 一键处理**：协作任务 → 直接确认 / 跳过；@提及 → 直接回复
- **F3 一键忽略**：标记已读不再提醒
- **F4 转给同事**：把任务派发给团队其他成员
- **F5 智能分组**：按"待处理 / 今日已完成 / 历史"三段展示

## 3. 用户流程

1. 用户点侧栏「消息中心」入口
2. 进入时间线页面，未读项高亮
3. 点击单条消息可展开详情或直接执行处理动作
4. 处理完成后自动从"待处理"移出

## 4. 验收标准

- 消息汇总延迟 ≤ 2 秒
- 一键处理动作响应 ≤ 500ms
- 时间线滚动支持虚拟列表，1000 条无卡顿
- 桌面通知与应用内通知状态同步
- 多端登录场景下处理状态实时同步
- ...（共 12 条）

## 5. 排期与风险

**排期**：2 周（含 3 天联调 + 2 天测试）

**风险提示** ⚠️
- **多端同步链路依赖 IM 长连接稳定性**
- 时间线虚拟列表与现有聊天列表组件复用度待评估

---

*本文档由 Kooky 分身「产品经理工具箱」基于头脑风暴结论生成 · 2026-05-19*
`
      ds.addArtifact(ai3, {
        name: '消息通知中心-MVP-需求文档.md',
        size: '~12 KB',
        content: prdContent,
      })

      console.log('[demo] ⏹ PRD 全流程剧本结束')
    }

    // 重置分身对话
    window.__resetPersonaDemo = function resetPersonaDemo() {
      if (window.__deerflowChat?.clearMessages) {
        window.__deerflowChat.clearMessages()
      }
      // 同步重置记忆里的脏数据
      if (window.__personaMemoryBridge?.reset) {
        window.__personaMemoryBridge.reset()
      }
      _clearSkillChips()
      console.log('[demo] 分身对话已重置（包含记忆 / chip）')
    }

    // —— 全剧本编排：开场 7s 留白用于讲 skill，然后串起三幕 ——
    window.__playFullDemo = async function playFullDemo(opts = {}) {
      const ds = window.__deerflowChat
      if (!ds) { console.warn('[demo] DeerflowChatPanel 未就绪'); return }
      // 先把脏数据清干净，避免重复演示导致记忆里堆几条一样的周报
      if (window.__personaMemoryBridge?.reset) {
        window.__personaMemoryBridge.reset()
      }
      ds.clearMessages?.()
      _clearSkillChips()

      // 开场 7s 留白：让演讲者口播「这 6 个内置技能」
      const openMs = typeof opts.openingMs === 'number' ? opts.openingMs : 7000
      console.log(`[demo] ▶ 开场留白 ${openMs / 1000}s，展示 skill 列表…`)
      await _delay(openMs)

      // 幕 1：记忆沉淀
      console.log('[demo] ▶ 幕 1 · 记忆沉淀')
      await window.__playMemoryDemo({ delayMs: 600 })

      // 幕 2：日报/周报生成
      console.log('[demo] ▶ 幕 2 · 日报/周报生成')
      await window.__playWeeklyDemo({ delayMs: 1200 })

      // 幕 3：PRD 全流程（引用 skill chip）
      console.log('[demo] ▶ 幕 3 · PRD 全流程')
      await window.__playPRDDemo({ delayMs: 1500 })

      console.log('[demo] ⏹ 全剧本结束')
    }

    console.log('[dev-mocks v2] 分身剧本已就绪：__playFullDemo / __playMemoryDemo / __playWeeklyDemo / __playPRDDemo / __resetPersonaDemo')

    // ─────────────────────────────────────────────────────
    // 一人团队演示剧本（OPT = One-Person Team）
    // 第一幕：成员相互介绍（默认任务）
    // ─────────────────────────────────────────────────────

    // 往主会话 thread 推一条 raw 消息 + 让 runtime store 重新拉账本
    async function _pushOPTMainMessage(teamId, threadId, rawMsg) {
      const key = `${teamId}|${threadId}`
      const list = window.__optMock.threadMessages.get(key) || []
      const next = [...list, rawMsg]
      window.__optMock.threadMessages.set(key, next)
      try {
        const rs = useSoloTeamStore(pinia)
        await rs.loadOnePersonThreadMessages(teamId, threadId, { force: true })
      } catch (e) { console.warn('[demo] force load 失败', e) }
    }

    // 把任务状态改成 completed，并触发 store 刷新
    async function _setOPTTaskStatus(teamId, taskId, status) {
      const snap = window.__optMock.teamHomeSnapshots.get(teamId)
      if (!snap) return
      const task = (snap.tasks || []).find(t => (t.id || t.task_id) === taskId)
      if (task) {
        task.status = status
        task.updated_at = new Date().toISOString()
      }
      try {
        const rs = useSoloTeamStore(pinia)
        await rs.loadOnePersonTeamHome(teamId, { force: true })
        await rs.loadOnePersonTeamTasks(teamId, { force: true })
      } catch (e) { console.warn('[demo] reload home/tasks 失败', e) }
    }

    // 流式更新主会话最后一条消息的 content（content 逐段 append）
    async function _streamOPTMainMessage(teamId, threadId, msgId, chunks, intervalMs = 55) {
      const key = `${teamId}|${threadId}`
      const list = window.__optMock.threadMessages.get(key) || []
      const idx = list.findIndex(m => m.id === msgId)
      if (idx === -1) return
      let acc = ''
      for (const chunk of chunks) {
        acc += chunk
        list[idx] = { ...list[idx], content: acc, status: 'streaming' }
        window.__optMock.threadMessages.set(key, [...list])
        try {
          const rs = useSoloTeamStore(pinia)
          await rs.loadOnePersonThreadMessages(teamId, threadId, { force: true })
        } catch (e) { /* noop */ }
        await _delay(intervalMs + Math.random() * 30)
      }
      list[idx] = { ...list[idx], status: 'completed' }
      window.__optMock.threadMessages.set(key, [...list])
      try {
        const rs = useSoloTeamStore(pinia)
        await rs.loadOnePersonThreadMessages(teamId, threadId, { force: true })
      } catch (e) { /* noop */ }
    }

    function _chunkOPT(text, size = 4) {
      const out = []
      for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
      return out
    }

    // 每个数字员工的自介脚本（按 agent_id）
    const _OPT_INTRO_SCRIPTS = {
      1001: '大家好，我是产品经理 🌟。负责产品调研、需求设计、PRD 输出。\n协作偏好：先把需求想清楚再动手，避免返工。主动梳理可落地方案，喜欢用文档把模糊变清晰。\n等你们抛来目标，我就开搞。',
      1002: '大家好，我是全栈开发 ⚡。负责代码实现，从前端到后端到部署。\n协作偏好：偏爱看到明确需求和设计再动手，遇到技术不确定项会先和大家对齐。\n准备好出代码 ✊',
      1004: 'Hi 我是 UI 设计师 🎨。负责视觉设计、交互流程、原型还原。\n协作偏好：早期参与构思 / 转化路径，喜欢把抽象目标视觉化成卡片和动效。\n等结构稿出来我就出 mockup。',
      1006: '我是产品运营 📢。擅长产品运营、文案撰写、增长营销。\n协作偏好：从用户视角出发，把功能价值翻译成 punch line。喜欢配合数据 / 转化路径迭代文案。\n等结构定了我接手文案 ⭐',
    }

    // 第一幕：成员相互介绍 —— 子会话 4 个员工流式自介 + 主会话团队助理总结 + task completed
    window.__playOPTAct1 = async function playOPTAct1(teamId, opts = {}) {
      teamId = teamId || window.__optMock?.lastTeamId
      if (!teamId) { console.warn('[demo] 没找到 teamId，请先创建团队'); return }
      const snap = window.__optMock.teamHomeSnapshots.get(teamId)
      if (!snap) { console.warn('[demo] team home snapshot 不存在'); return }
      const mainThreadId = snap.main_thread.id
      const introTask = (snap.tasks || []).find(t => /intro/.test(String(t.id || t.task_id)))
      const introTaskId = introTask?.id || introTask?.task_id
      const introThreadId = introTask?.execution_thread_id || introTask?.executionThreadId || `thread-intro-${teamId}`
      const members = snap.members || []
      console.log(`[demo] ▶ OPT 第一幕：成员相互介绍（${members.length} 人）`)
      console.log(`[demo] ⚠️ 子会话 thread = ${introThreadId}，点主会话「新人介绍」卡可打开右侧子会话面板`)

      await _delay(typeof opts.startDelayMs === 'number' ? opts.startDelayMs : 1800)

      // ① 子会话 thread：4 个员工依次流式自介
      let seq = 10
      for (let i = 0; i < members.length; i++) {
        const emp = members[i]
        const empAgentId = emp.agent_id || emp.id
        const script = _OPT_INTRO_SCRIPTS[empAgentId] || `大家好，我是${emp.name}。`
        const msgId = `msg-intro-${teamId}-${empAgentId}`
        // push 空消息容器
        await _pushOPTMainMessage(teamId, introThreadId, {
          id: msgId, seq: seq++,
          author_type: 'agent',
          agent_id: empAgentId,
          display_name: emp.name,
          avatar_url: emp.avatar,
          content: '',
          created_at: new Date().toISOString(),
          thread_id: introThreadId, task_id: introTaskId,
          status: 'streaming',
        })
        // 流式 append
        await _streamOPTMainMessage(teamId, introThreadId, msgId, _chunkOPT(script, 3), 30)
        await _delay(400)
      }

      // ② 主会话：团队助理总结
      const summaryMsgId = `msg-summary-${teamId}-${Date.now()}`
      await _pushOPTMainMessage(teamId, mainThreadId, {
        id: summaryMsgId, seq: 100,
        author_type: 'system',
        display_name: '我的分身',
        content: '',
        created_at: new Date().toISOString(),
        thread_id: mainThreadId,
        status: 'streaming',
      })
      const lines = [
        '任务「成员相互介绍」已完成。\n\n',
        '团队成员介绍已汇总：\n\n',
      ]
      for (const emp of members) {
        const empData = findDemoEmployee(emp.agent_id || emp.id) || {}
        const bio = empData.description || ''
        const tags = (empData.tags || []).join('、')
        lines.push(`• **${emp.name}**（member）：核心能力：${bio}；标签：${tags}。\n\n`)
      }
      lines.push('成员已就绪。请告诉我您希望团队完成什么目标，我会为您规划任务并分配给合适的成员。')
      await _streamOPTMainMessage(teamId, mainThreadId, summaryMsgId, lines.flatMap(s => _chunkOPT(s, 3)), 25)

      // ③ 标记 task 完成
      if (introTaskId) await _setOPTTaskStatus(teamId, introTaskId, 'completed')
      console.log('[demo] ⏹ OPT 第一幕结束')
    }

    console.log('[dev-mocks v2] 一人团队剧本已就绪：__playOPTAct1（建团队后调）')

    // 分身多会话列表：内置几条合理的历史对话（演示时一眼能看见多线程能力）
    try {
      const deerflowStore = useDeerflowChatStore(pinia)
      const nowMs = Date.now()
      const MIN = 60_000
      const HOUR = 60 * MIN
      const DAY = 24 * HOUR
      const presetThreads = [
        {
          // 定时任务专属会话（对应 schedule task: 每日喝水提醒）
          id: 100208,
          title: '定时任务：每日喝水提醒',
          updated_at: new Date(nowMs - 4 * HOUR).toISOString(),
          created_at: new Date(nowMs - 20 * DAY).toISOString(),
          is_pinned: true,
          pinned_at: new Date(nowMs - 20 * DAY).toISOString(),
          // 把定时任务的「专属会话」标识带在 thread 上，方便 UI 渲染特殊 icon / 跳转
          schedule_task_id: 'sched-water-001',
          langgraph_thread_id: 'lg-sched-water-001',
        },
        {
          id: 100201,
          title: '消息通知中心 PRD 草稿',
          updated_at: new Date(nowMs - 12 * MIN).toISOString(),
          created_at: new Date(nowMs - 12 * MIN).toISOString(),
          is_pinned: true,
          pinned_at: new Date(nowMs - 5 * MIN).toISOString(),
        },
        {
          id: 100202,
          title: '本周周报草稿',
          updated_at: new Date(nowMs - 2 * HOUR).toISOString(),
          created_at: new Date(nowMs - 2 * HOUR).toISOString(),
        },
        {
          id: 100203,
          title: '帮我梳理一下发布会演示动线',
          updated_at: new Date(nowMs - 5 * HOUR).toISOString(),
          created_at: new Date(nowMs - 5 * HOUR).toISOString(),
        },
        {
          id: 100301,
          title: '产品周报文件整理',
          updated_at: new Date(nowMs - 500).toISOString(),
          created_at: new Date(nowMs - 2 * HOUR).toISOString(),
        },
        {
          id: 100204,
          title: '分身使用习惯沉淀',
          updated_at: new Date(nowMs - 1 * DAY).toISOString(),
          created_at: new Date(nowMs - 1 * DAY).toISOString(),
        },
        {
          id: 100205,
          title: 'Kode 终端 P95 排查记录',
          updated_at: new Date(nowMs - 2 * DAY).toISOString(),
          created_at: new Date(nowMs - 2 * DAY).toISOString(),
        },
        {
          id: 100206,
          title: '一人团队 GA 文档讨论',
          updated_at: new Date(nowMs - 3 * DAY).toISOString(),
          created_at: new Date(nowMs - 3 * DAY).toISOString(),
        },
        {
          id: 100207,
          title: '协作群消息处理偏好',
          updated_at: new Date(nowMs - 5 * DAY).toISOString(),
          created_at: new Date(nowMs - 5 * DAY).toISOString(),
        },
      ].map((t) => ({
        // 补齐字段，跟后端形状对齐
        langgraph_thread_id: `lg-mock-${t.id}`,
        agent_id: null,
        thread_type: 'personal',
        one_person_team_id: null,
        ...t,
      }))
      // 合并已有 threads（避免覆盖用户已创建的）
      const existingIds = new Set((deerflowStore.threads || []).map((t) => t.id))
      const merged = [
        ...presetThreads.filter((t) => !existingIds.has(t.id)),
        ...(deerflowStore.threads || []),
      ]
      deerflowStore.threads = merged
      deerflowStore.threadPagination = {
        page: 1,
        pageSize: 20,
        total: merged.length,
        hasMore: false,
      }
      deerflowStore.loadingThreads = false
      // 短路真实接口：组件进入页面会调 fetchThreads，避免 404 把 seed 清掉
      deerflowStore.fetchThreads = async function devMockedFetchThreads() {
        this.loadingThreads = false
        this.threadPagination.hasMore = false
        return
      }
      deerflowStore.loadMoreThreads = async function devMockedLoadMoreThreads() {
        return
      }
      console.log(`[dev-mocks v2] 已注入 ${presetThreads.length} 条分身历史会话（接口已 mock）`)

      // —— 内置「定时任务：每日喝水提醒」会话的来回消息 ——
      // 定时任务的工作原理：周期性「用户发指令 → 分身回复」，所以用户消息也要内置出来
      const waterUserPrompt = '该喝水了 💧'
      const mkWaterMsg = (role, content, offsetMs) => ({ role, content, timestamp: nowMs - offsetMs })
      const waterPanelMessages = [
        mkWaterMsg('user', '帮我做一个每日喝水提醒，工作日 10:00 / 14:00 / 16:30 各提醒一次，每次告诉我今天喝了几杯', 28 * HOUR),
        mkWaterMsg('assistant', '好的～已为你创建定时任务「每日喝水提醒」 🍵\n\n📅 工作日 10:00 / 14:00 / 16:30 各触发一次\n💧 每次会播报当天累计杯数和距离目标的差距\n🎯 推荐目标：8 杯（约 1500ml）\n\n第一次提醒会在明天 10:00 准时送到～', 28 * HOUR - 3000),
        mkWaterMsg('user', waterUserPrompt, 24 * HOUR),
        mkWaterMsg('assistant', '💧 喝水时间到啦～\n\n今日累计：**1 杯**（约 200ml）\n推荐目标：8 杯（1500ml）\n下次提醒：14:00', 24 * HOUR - 2000),
        mkWaterMsg('user', waterUserPrompt, 20 * HOUR),
        mkWaterMsg('assistant', '💧 喝水时间到啦～\n\n今日累计：**3 杯**（约 600ml）\n推荐目标：8 杯（1500ml）\n下次提醒：16:30\n\n中午多喝两杯，距离目标只剩 5 杯 💪', 20 * HOUR - 2000),
        mkWaterMsg('user', waterUserPrompt, 17 * HOUR),
        mkWaterMsg('assistant', '💧 喝水时间到啦～\n\n今日累计：**6 杯**（约 1200ml）\n推荐目标：8 杯（1500ml）\n\n继续努力！距离目标还差 2 杯 🚰\n\n今日提醒已全部送达，明天 10:00 再见 👋', 17 * HOUR - 3000),
        mkWaterMsg('user', waterUserPrompt, 4 * HOUR),
        mkWaterMsg('assistant', '💧 喝水时间到啦～\n\n今日累计：**1 杯**（约 200ml）\n推荐目标：8 杯（1500ml）\n下次提醒：14:00\n\n新的一天，先喝起来 ☕', 4 * HOUR - 2000),
      ]
      window.__devMockDeerflowThreads = window.__devMockDeerflowThreads || {}
      window.__devMockDeerflowThreads['100208'] = waterPanelMessages

      // —— 内置「产品周报文件整理」会话（带可点文件，点开走左侧预览区）——
      // fromLibrary 标记 → DeerflowAttachmentCards 走 previewStore（预览区），previewType/content 供预览区渲染
      const libFile = (name, type, size, previewType, content, placeholder) => ({
        name, type, size, fromLibrary: true, previewType, content, placeholder,
      })
      window.__devMockDeerflowThreads['100301'] = [
        { role: 'user', content: '帮我把这次产品周报相关的几个文件整理到一起', timestamp: nowMs - 2 * HOUR },
        {
          role: 'assistant',
          content: '好的～已经把本次产品周报相关的文件整理好了，点开任意文件即可在右侧预览区查看 👇',
          attachments: [
            libFile('文件功能重构方案.md', 'md', '18 KB', 'md',
              '# 文件功能重构方案\n\n## 目标\n重构文件功能，做成用户自己的**文件库**（不分云端/本地）。\n\n## 范围\n- 文件库面板：文件夹 + 文件（类型角标/大小/⋯）\n- 工具栏文件点击 → 弹窗预览\n- 会话文件点击 → 右侧预览区\n\n## 结论\n采用独立沙箱方案，前后端并行。'),
            libFile('评审纪要.txt', 'txt', '4 KB', 'txt',
              '评审纪要\n- 员清亮：demo 链接早上发群\n- 张月华：文件库方案通过\n- 待办：补齐联调测试报告'),
            libFile('Kooky 产品体验周报.pdf', 'pdf', '2.4 MB', 'other', '',
              'PDF 文档 · 可下载后查看'),
            libFile('竞品功能对比.xlsx', 'xlsx', '846 KB', 'other', '',
              '表格文档 · 可下载后查看'),
          ],
          timestamp: nowMs - 2 * HOUR + 3000,
        },
        { role: 'user', content: '周报里的核心结论是什么？', timestamp: nowMs - 40 * 60 * 1000 },
        {
          role: 'assistant',
          content: '核心结论：本期聚焦「文件功能重构」，采用独立沙箱方案、前后端并行；详情见上方《文件功能重构方案.md》。',
          timestamp: nowMs - 40 * 60 * 1000 + 2000,
        },
      ]
      console.log('[dev-mocks] 已内置「产品周报文件整理」会话（带可点文件预览）')
      console.log('[dev-mocks v2] 已内置「定时任务：每日喝水提醒」会话消息（' + waterPanelMessages.length + ' 条 → window.__devMockDeerflowThreads）')
      // 以下：旧的 deerflow store loadFirstPage monkey-patch 已弃用（panel 不依赖 store，但保留兼容路径）
      const nowSec = Math.floor(nowMs / 1000)
      const WATER_THREAD_ID = '100208'
      const WATER_LG_ID = 'lg-sched-water-001'
      const waterRawMessages = [
        // —— 用户初次创建定时任务（昨天 9:30 左右）——
        { id: 'msg-water-setup-u', type: 'human', content: '帮我做一个每日喝水提醒，工作日 10:00 / 14:00 / 16:30 各提醒一次，每次告诉我今天喝了几杯', additional_kwargs: { created_at: nowSec - 28 * HOUR / 1000 } },
        { id: 'msg-water-setup-a', type: 'ai', content: '好的～已为你创建定时任务「每日喝水提醒」 🍵\n\n📅 工作日 10:00 / 14:00 / 16:30 各触发一次\n💧 每次会播报当天累计杯数和距离目标的差距\n🎯 推荐目标：8 杯（约 1500ml）\n\n第一次提醒会在今天 10:00 准时送到～', additional_kwargs: { created_at: nowSec - 28 * HOUR / 1000 + 3 } },
        // —— 昨天 10:00 第一次定时触发 ——
        { id: 'msg-water-d1-h1', type: 'human', content: waterUserPrompt, additional_kwargs: { created_at: nowSec - 24 * HOUR / 1000 } },
        { id: 'msg-water-d1-a1', type: 'ai', content: '💧 喝水时间到啦～\n\n今日累计：**1 杯**（约 200ml）\n推荐目标：8 杯（1500ml）\n下次提醒：14:00', additional_kwargs: { created_at: nowSec - 24 * HOUR / 1000 + 2 } },
        // —— 昨天 14:00 ——
        { id: 'msg-water-d1-h2', type: 'human', content: waterUserPrompt, additional_kwargs: { created_at: nowSec - 20 * HOUR / 1000 } },
        { id: 'msg-water-d1-a2', type: 'ai', content: '💧 喝水时间到啦～\n\n今日累计：**3 杯**（约 600ml）\n推荐目标：8 杯（1500ml）\n下次提醒：16:30\n\n中午多喝两杯，距离目标只剩 5 杯 💪', additional_kwargs: { created_at: nowSec - 20 * HOUR / 1000 + 2 } },
        // —— 昨天 16:30 ——
        { id: 'msg-water-d1-h3', type: 'human', content: waterUserPrompt, additional_kwargs: { created_at: nowSec - 17 * HOUR / 1000 } },
        { id: 'msg-water-d1-a3', type: 'ai', content: '💧 喝水时间到啦～\n\n今日累计：**6 杯**（约 1200ml）\n推荐目标：8 杯（1500ml）\n\n继续努力！距离目标还差 2 杯 🚰\n\n今日提醒已全部送达，明天 10:00 再见 👋', additional_kwargs: { created_at: nowSec - 17 * HOUR / 1000 + 3 } },
        // —— 今天 10:00 第一次触发 ——
        { id: 'msg-water-d2-h1', type: 'human', content: waterUserPrompt, additional_kwargs: { created_at: nowSec - 4 * HOUR / 1000 } },
        { id: 'msg-water-d2-a1', type: 'ai', content: '💧 喝水时间到啦～\n\n今日累计：**1 杯**（约 200ml）\n推荐目标：8 杯（1500ml）\n下次提醒：14:00\n\n新的一天，先喝起来 ☕', additional_kwargs: { created_at: nowSec - 4 * HOUR / 1000 + 2 } },
      ]
      // monkey-patch loadFirstPage：thread=100208 时直接返回内置 page，不真请求
      try {
        const origLoadFirstPage = deerflowStore.loadFirstPage?.bind(deerflowStore)
        if (origLoadFirstPage && !deerflowStore.__waterMockPatched) {
          deerflowStore.__waterMockPatched = true
          deerflowStore.loadFirstPage = async function patchedLoadFirstPage(threadId, options = {}) {
            if (String(threadId) === WATER_THREAD_ID) {
              const state = this._getThreadState(threadId)
              if (state.firstPageLoaded && !options.force) {
                this._syncViewFromThreadState(threadId)
                return
              }
              const page = {
                // _rebuildPersistedFromPages 读 history_messages（不是 messages）
                history_messages: waterRawMessages,
                hasMore: false,
                nextBeforeSeq: null,
                latestSeq: waterRawMessages.length,
                ledgerBackfillPending: false,
              }
              state.pages = [page]
              state.firstPageLoaded = true
              state.hasMore = false
              state.nextBeforeSeq = null
              state.latestSeq = waterRawMessages.length
              state.ledgerBackfillPending = false
              state.loadingFirstPage = false
              state.firstPageInitialLoading = false
              this._rebuildPersistedFromPages(threadId)
              this._syncViewFromThreadState(threadId)
              return
            }
            return origLoadFirstPage(threadId, options)
          }
          console.log('[dev-mocks v2] 已 mock 定时任务「每日喝水提醒」会话消息（thread=100208，' + waterRawMessages.length + ' 条）')
        }
      } catch (e) { console.warn('[dev-mocks v2] water mock 失败:', e) }

      // —— 注入对话框「模式 / 模型选择器」可用模型（演示用，不真调）——
      const mockModels = [
        {
          model_name: 'kooky-sonnet4.6',
          display_name: 'kooky-sonnet4.6',
          supports_thinking: true,
          provider_config_id: 1,
          model_config_id: 11,
        },
        {
          model_name: 'kooky-opus4.5',
          display_name: 'kooky-opus4.5',
          supports_thinking: true,
          provider_config_id: 1,
          model_config_id: 12,
        },
        {
          model_name: 'kooky-haiku4',
          display_name: 'kooky-haiku4',
          supports_thinking: false,
          provider_config_id: 1,
          model_config_id: 13,
        },
        {
          model_name: 'kooky-deepseek-r1',
          display_name: 'DeepSeek R1',
          supports_thinking: true,
          provider_config_id: 2,
          model_config_id: 21,
        },
      ]
      deerflowStore.chatAvailableModels = mockModels
      deerflowStore.chatCurrentModel = mockModels[0]
      if (!deerflowStore.selectedModelName) {
        deerflowStore.selectedModelName = mockModels[0].model_name
      }
      // 短路 loadChatModels：避免组件挂载时拉真接口把 seed 清掉
      deerflowStore.loadChatModels = async function devMockedLoadChatModels() {
        this.loadingChatModels = false
      }
      deerflowStore.updateModelSelection = async function devMockedUpdateModelSelection() {
        return { ok: true }
      }
      console.log(`[dev-mocks v2] 已注入 ${mockModels.length} 个分身可用模型（接口已 mock）`)
    } catch (e) {
      console.warn('[dev-mocks v2] 分身会话/模型注入失败:', e?.message)
    }

    // 文件库假数据桥：保存文件产物时给「我的分身」分组 push 一条
    try {
      const fileStore = useFileStore(pinia)
      window.__addToFileLibrary = function addToFileLibrary({ name, content } = {}) {
        if (!name) return
        if (!fileStore.cloudTree.nodeCache['category_person']) {
          fileStore.cloudTree.nodeCache['category_person'] = []
        }
        const list = fileStore.cloudTree.nodeCache['category_person']
        // 防重
        if (list.some((n) => n.name === name)) return
        const fileId = `demo-file-${Date.now()}`
        list.unshift({
          nodeId: `node-${fileId}`,
          name,
          nodeType: 'file',
          fileId,
          businessId: 'persona-self',
          businessType: 'persona',
          mimeType: 'text/markdown',
          fileSize: (content || '').length,
          suffix: (name.split('.').pop() || 'md').toLowerCase(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          _isDemoFake: true,
          _content: content,
        })
        // 展开"我的分身"分组让它直接可见
        if (!fileStore.cloudTree.expandedNodeIds.includes('category_person')) {
          fileStore.cloudTree.expandedNodeIds.push('category_person')
        }
      }
      console.log('[dev-mocks v2] window.__addToFileLibrary 就绪')
    } catch (e) {
      console.warn('[dev-mocks v2] fileStore 桥注入失败:', e?.message)
    }

    // 注入内置定时任务
    try {
      const scheduleStore = useScheduleStore(pinia)
      const tasks = builtinScheduledTasks()
      scheduleStore.seed({
        tasks,
        presets: pickRandomPresets(3),
      })
      console.log('[dev-mocks v2] 注入定时任务 ' + tasks.length + ' 个')

      // 把定时任务的"专属会话"作为协作群注入，让"去对话中查看"能真跳过去
      const schedConvs = builtinScheduleConversations()
      for (const conv of schedConvs) {
        if (!mockGroupMembers.has(conv.conversationId)) {
          // 成员：自己 + 执行 agent
          mockGroupMembers.set(conv.conversationId, [
            {
              userId: MOCK_USER.userId,
              displayName: MOCK_USER.name,
              name: MOCK_USER.name,
              account: MOCK_USER.userName,
              avatarUrl: '',
              type: 'user',
            },
            {
              userId: `agent-${conv.executorAgentId}`,
              displayName: conv.executorAgentName,
              name: conv.executorAgentName,
              account: conv.executorAgentName,
              avatarUrl: '',
              type: 'agent',
            },
          ])
        }
        // 不再把定时任务专属会话注入协作群列表（避免污染"协作"页群列表）
        // "去对话中查看"跳转仍可通过 conversationId 直达，已有 mockGroupMembers 兜底
        // const exists = groupStore.conversations?.find?.((c) => c.conversationId === conv.conversationId)
        // if (!exists) {
        //   groupStore.conversations.push({
        //     conversationId: conv.conversationId,
        //     name: conv.name,
        //     conversationName: conv.name,
        //     createRoomType: 'group_chat',
        //     createdAt: conv.createdAt,
        //     lastMessageAt: Date.now() - 12 * 3600 * 1000,
        //     memberCount: 2,
        //     unreadCount: 0,
        //     isScheduleConv: true,
        //   })
        // }
        // 把任务的 runHistory 作为消息塞进会话
        const relatedTasks = tasks.filter(
          (t) => t.executor?.source?.conversationId === conv.conversationId
        )
        for (const t of relatedTasks) {
          for (const entry of t.runHistory || []) {
            const triggerTs = entry.ts - 60 * 1000
            pushMessage(conv.conversationId, {
              eventId: `${entry.id}-trigger`,
              role: 'system',
              senderId: 'sched-trigger',
              senderName: '定时任务',
              senderType: 'system',
              content: { body: `⏰ ${t.name} · 触发指令` },
              timestamp: triggerTs,
              seq: triggerTs,
            })
            pushMessage(conv.conversationId, {
              eventId: entry.anchorEventId,
              role: 'member',
              senderId: `agent-${t.executor.agentId}`,
              senderName: t.executor.agentName,
              senderType: 'agent',
              content: { body: entry.replyContent },
              timestamp: entry.ts,
              seq: entry.ts,
            })
          }
        }
      }
      console.log('[dev-mocks v2] 注入 ' + schedConvs.length + ' 个定时任务专属会话')
    } catch (e) {
      console.warn('[dev-mocks v2] 定时任务注入失败:', e)
    }

    // ─────────────────────────────────────────────────────────
    // 「去对话中查看」：切到该会话 + 滚动到指定消息 + 高亮闪一下
    // ─────────────────────────────────────────────────────────
    function openScheduleConversation(conversationId, anchorEventId) {
      if (!conversationId) return
      try {
        uiStore.setActiveNavigation('collaboration', conversationId)
        uiStore.setActiveToolTab(null)
        if (typeof groupStore.setCurrentSpaceId === 'function') {
          groupStore.setCurrentSpaceId(conversationId)
        } else {
          groupStore.currentSpaceId = conversationId
        }
      } catch (e) {
        console.warn('[schedule] open conversation failed:', e)
      }
      // 滚动到锚点 + 闪一下
      if (anchorEventId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-event-id="${anchorEventId}"]`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('schedule-anchor-flash')
            setTimeout(() => el.classList.remove('schedule-anchor-flash'), 2400)
          } else {
            console.warn('[schedule] anchor not found:', anchorEventId)
          }
        }, 450)
      }
    }
    if (typeof window !== 'undefined') {
      window.__kookyMock.openScheduleConversation = openScheduleConversation
    }
    // 注入全局闪烁 CSS（一次性）
    if (typeof document !== 'undefined' && !document.getElementById('kooky-schedule-flash-css')) {
      const css = document.createElement('style')
      css.id = 'kooky-schedule-flash-css'
      css.textContent = `
@keyframes kooky-schedule-flash {
  0%, 100% { background-color: transparent; }
  20%, 60% { background-color: rgba(255, 107, 0, 0.18); }
}
.schedule-anchor-flash {
  animation: kooky-schedule-flash 2.4s ease-out;
  border-radius: 8px;
}`
      document.head.appendChild(css)
    }

    imClient.sendMessage = async function mockSendGroupMessage(conversationId, text, opts = {}) {
      // 1. 用户消息进群
      const eventId = pushUserMessage(conversationId, text, opts)

      // 2. 新建群的云帆演示线优先消费本轮；内容随便写也能向前推进。
      const handledByYunfanDemo = opts.matterReference
        ? false
        : advanceYunfanDemoFlow(conversationId)

      // 3. 检测 @团队助手 → 触发协作 AI（异步，不阻塞 send 返回）
      // 引用已归档工作流时由输入框走本地“复制新一轮”闭环，不再误推进当前活跃任务。
      if (!handledByYunfanDemo && !opts.workflowReference && !opts.matterReference && /@团队助手/.test(text)) {
        setTimeout(() => triggerTeamAssistant(text, conversationId), 200)
      }

      return { ok: true, eventId, conversationId }
    }
    imClient.sendFileMessage = async function mockSendFileMessage(conversationId, fileInfo, _opts = {}) {
      const eventId = pushMessage(conversationId, {
        role: 'user',
        senderId: MOCK_USER.userId,
        senderName: MOCK_USER.name,
        senderType: 'user',
        type: 'file',
        contentType: 'file',
        content: { file: fileInfo, body: fileInfo?.name || '已上传文件' },
      })
      return { ok: true, eventId, conversationId }
    }
    console.log('[dev-mocks v2] im-client.sendMessage / sendFileMessage 已 mock，@团队助手 将触发协作 AI')
  } catch (e) {
    console.warn('[dev-mocks v2] sendMessage hook 失败:', e)
  }

  console.log('[dev-mocks v2] late installed · IM 短路 + imReady + 数字人就位 + 协作 AI 钩子')
}

function buildBrowserElectronStub() {
  const noop = () => {}
  const asyncNoop = async () => {}
  const offFactory = () => () => {}

  return {
    platform: 'darwin',
    windowMinimize: noop,
    windowMaximize: noop,
    windowClose: noop,
    onClaudeHookEvent: offFactory,
    onAppWillHide: offFactory,
    onAppWillQuit: offFactory,
    onFileSavedToTree: offFactory,
    onDetachedTerminalClosed: offFactory,
    onFilePreviewData: offFactory,
    onToggleHiddenFiles: offFactory,
    getPath: async () => '/tmp/mock-kooky',
    getArch: async () => 'arm64',
    getWindowBounds: async () => ({ x: 0, y: 0, width: 1280, height: 800 }),
    getHookServerStatus: async () => ({ running: false, port: 0 }),
    openExternal: noop,
    openPath: asyncNoop,
    openFilePreview: noop,
    openCode: asyncNoop,
    showItemInFolder: noop,
    downloadURL: asyncNoop,
    docxToHtml: async () => '',
    notifyFileSaved: noop,
    persistentUserData: { get: async () => null, set: asyncNoop },
    claudeCode: {
      setupEnv: asyncNoop,
      cleanupEnv: asyncNoop,
      isEnvReady: async () => true,
      selectDirectory: async () => null,
    },
    auth: {
      feishuLogin: asyncNoop,
      getXfchatAppId: async () => 'mock-app-id',
      xfchatExchangeToken: async () => ({ token: 'mock-xfchat-token' }),
    },
    iframe: {
      enableAuthInjector: noop,
      updateToken: noop,
    },
    kcControl: null,
    fs: {
      readDir: async () => [],
      readFile: async () => '',
      readFileChunk: async () => '',
      writeFile: asyncNoop,
      mkdir: asyncNoop,
      rmdir: asyncNoop,
      unlink: asyncNoop,
      rename: asyncNoop,
      getDrives: async () => [],
      getFileMetadata: async () => null,
      downloadToTemp: asyncNoop,
      deleteTemp: asyncNoop,
      watchStart: noop,
      watchStop: noop,
      onFileChanged: offFactory,
    },
    terminal: { create: asyncNoop, destroy: asyncNoop, write: asyncNoop },
    teams: {
      sendCloseResult: noop,
      sendEqualizeSplitsResult: noop,
      sendPaneFocusResult: noop,
      sendPaneListResult: noop,
      sendPaneResizeResult: noop,
      sendReadTextResult: noop,
      sendSendTextResult: noop,
      sendSplitResult: noop,
      sendStartResult: noop,
    },
    updater: {
      getVersion: async () => '0.0.70-mock',
      install: noop,
      deleteFile: asyncNoop,
    },
    session: { collectCwd: asyncNoop },
    dialog: {},
  }
}

// ── HMR 修复：__optMock 只在整页启动时建一次（api.__optMocked 守卫拦住重建），
//    热替换改了预置会话数据并不会生效 → 强制整页刷新，让改动即时可见。 ──
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload()
  })
}
