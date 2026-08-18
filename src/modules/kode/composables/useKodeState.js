// Kode demo · 全局 reactive 状态
// 用 provide/inject 在 KodeView 树里共享

import { ref, computed, reactive, watch, nextTick } from 'vue'
import { usePreviewStore } from '@/modules/space/previewStore'
import {
  workspaces as wsData,
  digitalHumans as dhData,
  taskAssistant,
  batches as bData,
  tasks as tData,
  products,
  decomposeInputs,
  decomposeMessages,
  processDialog,
  t7ProcessTimeline,
  completionChecks,
} from '../mocks/data.js'

export const KODE_STATE_KEY = 'kode-state'

function nowStr() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

// ─── 演示用 mock：新建任务后的拆解流 ─────────────────────────────
// 新任务起手生成的草稿 Todolist（演示拆解从 0 开始）
function makeStarterTodos(t) {
  return [
    '调研现状 · 定位相关代码 / 接口',
    '设计实现方案 · 拆分改动点',
    '编码实现核心逻辑',
    '自测 + 写单元测试',
    '提交 PR · 附变更说明',
  ].map((text, i) => ({ id: `td-${t.id}-${i}`, text, status: 'todo' }))
}
// 用户每发一句话，任务助手按这个脚本依次"完善 Todolist"（演示 todolist 变化）
const DEMO_DECOMPOSE_TURNS = [
  { reply: '好建议，我把"设计实现方案"拆细，并补一条边界用例。', adds: ['补充边界用例（空数据 / 超大输入）'] },
  { reply: '收到，加上性能基线对比这步。', adds: ['性能基线对比（FCP / 交互延迟）'] },
  { reply: '明白，把联调和回归也纳入 Todolist。', adds: ['联调依赖接口 + 回归验证'] },
  { reply: '再补一条文档同步，免得后面对不上。', adds: ['更新相关文档 / 使用说明'] },
]

export function createKodeState() {
  const previewStore = usePreviewStore()
  // ─── 数据 ───
  const workspaces = ref(wsData)
  const digitalHumans = ref(dhData)
  const batches = ref(bData)
  const tasks = ref(tData)

  // 演示：给 todolist 为空的任务补一份草稿
  tasks.value.forEach((t) => {
    if (!Array.isArray(t.todos) || t.todos.length === 0) {
      t.todos = makeStarterTodos(t)
    }
  })

  // ─── 当前选中 ───
  const initialTask = tasks.value.find((t) => t.selected) || tasks.value[0]
  const selectedTaskId = ref(initialTask?.id || null)
  const activeTab = ref('decompose')

  // ─── 统一工作台 · 浏览器式标签页 ───────────────────────────────────
  // 标签页：task(Plan) / ide(IDE) / cli(CLI) —— 三个全部钉死常驻，都不可关
  // active 标签页驱动中间工作区 + 右侧柱（Plan=Todolist / IDE=Kode 会话 / CLI=不显）。
  // 没有「预览」标签：文件预览统一走全局共享预览区（见 openPreviewTab）
  const PINNED_TABS = ['task', 'ide', 'cli']
  const CLOSABLE_TABS = []
  const openTabIds = ref(['task', 'ide', 'cli'])
  const activeTabId = ref(initialTask?.mode === 'ide' ? 'ide' : 'task')

  function setActiveTab(id) {
    if (openTabIds.value.includes(id)) activeTabId.value = id
  }
  function openTab(id) {
    if (!openTabIds.value.includes(id)) {
      // 维持固定顺序：task, ide, cli
      const order = ['task', 'ide', 'cli']
      openTabIds.value = order.filter((t) => openTabIds.value.includes(t) || t === id)
    }
    activeTabId.value = id
  }
  function closeTab(id) {
    if (PINNED_TABS.includes(id)) return
    openTabIds.value = openTabIds.value.filter((t) => t !== id)
    if (activeTabId.value === id) activeTabId.value = 'task'
  }
  // + 菜单里「还能加」的标签（当前没开的可关闭标签）
  const addableTabs = computed(() => CLOSABLE_TABS.filter((t) => !openTabIds.value.includes(t)))

  // 兼容旧渲染口径：currentMode 由 activeTabId 派生（task→kode）
  const currentMode = computed(() => (activeTabId.value === 'task' ? 'kode' : activeTabId.value))
  function switchMode(m) { setActiveTab(m === 'kode' ? 'task' : m) }

  watch(selectedTaskId, () => {
    // 所有任务点开默认进「Plan」tab（不再按 task.mode 落到 IDE）
    activeTabId.value = 'task'
  })

  // ─── 文件预览：统一走全局共享预览区（整个 kooky 共用，模块右侧）─────
  const previewTarget = ref(null)
  // 把 Kode 的产物/文件目标映射成预览区文件。dev server 页面 → 浏览器标签；
  // 普通文件（带内容）→ 文件标签；其余按名字后缀判断。
  function kodeTargetToPreviewFile(target) {
    const name = target?.name || target?.path || target?.title || '预览'
    const ext = String(name).split('.').pop().toLowerCase()
    const base = (selectedWorkspace.value?.devUrl || 'localhost:5173').replace(/^https?:\/\//, '')
    // 代码/文档类且自带内容 → 文件标签
    if (target?.content && ['md', 'markdown', 'txt', 'json', 'js', 'ts', 'css', 'py', 'csv', 'log', 'vue'].includes(ext)) {
      return { id: `kode-${name}`, name, fileType: ext === 'md' || ext === 'markdown' ? 'md' : 'code', content: target.content, source: 'Kode' }
    }
    // 默认：前端工程 / dev server 页面 → 浏览器标签
    return { id: 'kode-preview', name, fileType: 'web', web: { url: base, running: true }, placeholder: `${name} · dev server 实时渲染` }
  }
  // 产物点击 → 预览（统一开共享预览区）
  function openProductInPreview(product) {
    previewTarget.value = product
    previewStore.openFile(kodeTargetToPreviewFile(product))
    return true
  }
  // IDE 内点文件卡 / 🌐 等 → 打开共享预览区
  function openPreviewTab(target) {
    previewTarget.value = target || null
    previewStore.openFile(kodeTargetToPreviewFile(target))
  }

  // ─── Kode 对话（IDE / CLI / 预览 共用的统一对话柱内容）─────────────
  // 任务标签页用「任务助手」对话（dialogMessages）；其余标签页用这份 Kode 对话。
  const kodeMessages = ref([
    { role: 'assistant', text: '我是 Kode，连着你这个 workspace 的代码。要改哪块、或把任务页拆好的 Todolist 派给我都行。' },
  ])
  const kodeInput = ref('')
  function sendKodeMessage(text) {
    const v = (text ?? kodeInput.value).trim()
    if (!v) return
    kodeMessages.value.push({ role: 'user', text: v })
    kodeMessages.value.push({ role: 'assistant', text: '收到 · 这里是 mock 响应，真实场景会调 Claude Code 接口。' })
    kodeInput.value = ''
  }
  function _shortStep(t) { return String(t).split('（')[0].split('(')[0].trim() }
  function kodeReuseSend(t) {
    kodeMessages.value.push({ role: 'user', text: `开始这一步：${t.text}` })
    kodeMessages.value.push({ role: 'assistant', text: `收到，开始处理「${_shortStep(t.text)}」。` })
  }
  function kodeReuseSendAll(todos) {
    kodeMessages.value.push({ role: 'user', text: `按这份 Todolist（${todos.length} 步）逐条开干` })
    kodeMessages.value.push({ role: 'assistant', text: `好的，已排入 ${todos.length} 步，从第 1 步开始执行…` })
  }

  // ─── 勾选（批量执行用）─── per-workspace
  const checkedTaskIds = ref(new Set())

  // ─── Workspace 折叠 + 筛选 ───
  const collapsedWorkspaces = ref(new Set())
  const activeFilter = ref('pending') // pending 待处理(默认) | batch 批处理 | done 已完成 | all 全部

  // ─── 模态框 ───
  const showNewTaskModal = ref(false)
  const showAddWorkspaceModal = ref(false)
  // 批量执行配置框（支持跨 workspace 勾选，每个 ws 创建独立批次）
  const showBatchExecuteModal = ref(false)

  // ─── 拆解 tab 状态 ───
  // 任务助手永远在，invitedHumanIds 是额外邀请的（不含 'me' 和 'agent'）
  // 演示：一开始只有「我 + 任务助手」，拉谁谁才进来发言
  const invitedHumanIds = ref(new Set())
  const decomposeInputsList = ref([...decomposeInputs])
  const dialogMessages = ref([...decomposeMessages])
  const decomposeInput = ref('')
  const completion = reactive(
    completionChecks.reduce((acc, c) => {
      acc[c.id] = { ...c }
      return acc
    }, {}),
  )

  // ─── 处理 tab 状态 ───
  // 注：todos 已合并到 task.todos，拆解和处理共享同一份。这里只保留对话流与输入
  const dialog = ref([...processDialog])
  const userInput = ref('')

  // ─── derived ───
  const selectedTask = computed(() =>
    tasks.value.find((t) => t.id === selectedTaskId.value) || null,
  )

  const selectedWorkspace = computed(() => {
    const t = selectedTask.value
    if (!t) return null
    return workspaces.value.find((w) => w.id === t.wsId) || null
  })

  // ─── 工作区目录失效（兜底态）────────────────────────────────────
  // 触发：用户删了/移走了目录、切分支导致挂载点消失（ws 挂的是子目录）。
  // 口径（Pata 拍板）：降级展示 + 全面禁止操作 —— 能展示的展示，不能展示的不展示。
  //   · Plan：任务/Todolist/对话历史照常看（这些是 Kooky 自己的数据，跟磁盘无关），但不能发消息/执行/点产物
  //   · IDE / CLI：全靠 cwd，整块换失效页
  // 真实实现是选中 ws / 打开 IDE 时现查 cwd 是否存在（外部操作防不住，只能事后兜底）。
  const wsMissing = computed(() => !!selectedWorkspace.value?.missing)

  const tasksByWorkspace = computed(() => {
    const map = {}
    for (const ws of workspaces.value) map[ws.id] = []
    for (const t of tasks.value) {
      if (!map[t.wsId]) map[t.wsId] = []
      map[t.wsId].push(t)
    }
    return map
  })

  const batchesByWorkspace = computed(() => {
    const map = {}
    for (const ws of workspaces.value) map[ws.id] = []
    for (const b of batches.value) {
      if (!map[b.wsId]) map[b.wsId] = []
      map[b.wsId].push(b)
    }
    return map
  })

  const currentBatch = computed(() => {
    const t = selectedTask.value
    if (!t || !t.batchId) return null
    return batches.value.find((b) => b.id === t.batchId) || null
  })

  const currentBatchTasks = computed(() => {
    const b = currentBatch.value
    if (!b) return []
    return b.taskIds.map((id) => tasks.value.find((t) => t.id === id)).filter(Boolean)
  })

  const completionPercent = computed(() => {
    const items = Object.values(completion)
    const ok = items.filter((i) => i.ok).length
    return Math.round((ok / items.length) * 100)
  })

  const requiredAllSatisfied = computed(() =>
    Object.values(completion)
      .filter((i) => i.required)
      .every((i) => i.ok),
  )

  // 拆解 tab 的参与者：任务助手 + 邀请的数字人
  const participants = computed(() => {
    return ['agent', ...Array.from(invitedHumanIds.value)]
  })

  // 通用查 persona：支持 agent + 数字人 + 用户
  function getPersona(id) {
    if (id === 'agent') return taskAssistant
    return digitalHumans.value.find((d) => d.id === id) || null
  }

  // ─── 拆解 tab actions ───
  function inviteHuman(humanId) {
    if (humanId === 'agent' || humanId === 'me') return
    if (invitedHumanIds.value.has(humanId)) return
    const s = new Set(invitedHumanIds.value)
    s.add(humanId)
    invitedHumanIds.value = s
    const p = getPersona(humanId)
    // 只发系统通知：加入。任务助手不主动找 ta —— 由「我」去 @ ta 对话
    dialogMessages.value.push({
      id: `sys-${Date.now()}`,
      type: 'system',
      ts: nowStr(),
      body: `${p?.name || humanId} 已加入对话，可以 @${p?.name || ''} 找 ta 聊`,
    })
  }

  function removeHuman(humanId) {
    if (humanId === 'agent') return // 任务助手不能踢
    const s = new Set(invitedHumanIds.value)
    s.delete(humanId)
    invitedHumanIds.value = s
    const p = getPersona(humanId)
    dialogMessages.value.push({
      id: `sys-${Date.now()}`,
      type: 'system',
      ts: nowStr(),
      body: `${p?.name || humanId} 已离开对话`,
    })
  }

  // @ 提及映射（对齐真 PERSONAS）
  const MENTION_MAP = {
    小产: 'xiaochan',
    老架: 'laojia',
    阿测: 'ace',
    老研: 'laoyan',
    小审: 'xiaoshen',
    阿运: 'ayun',
    任务助手: 'agent',
  }

  function detectMentions(text) {
    const ids = []
    for (const [name, id] of Object.entries(MENTION_MAP)) {
      if (text.includes(`@${name}`)) ids.push(id)
    }
    return ids
  }

  function mockResponseFor(personaId) {
    const map = {
      xiaochan: '产品角度建议先 A/B 一小批，看开启率再全量上。验收口径要写死，避免上线后扯皮。',
      laojia: '从架构看关键是抽象层做厚。可拆三段：① design-token 体系 ② 主题 state 管理 ③ 渐进切换防闪。',
      ace: '测试覆盖建议：组件视觉差异 / 跨页切换 / 用户偏好持久化 / token 刷新场景。',
      laoyan: '研发层面注意 service 注入 + localStorage 兼容。我可以先列出受影响的文件清单。',
      xiaoshen: '评审角度，必拒 6 条要先过：生产配置 / 鉴权绕过 / 敏感数据 / 无测试改核心 / .env / 权限表。',
      ayun: '运维建议：先灰度 5% → 监控 token / 错误率 → 全量。准备 rollback 预案。',
      agent: '收到，已记下。可以继续聊。',
    }
    return map[personaId] || '收到。'
  }

  function sendDecomposeMessage(attachments = []) {
    const text = decomposeInput.value.trim()
    const hasFiles = Array.isArray(attachments) && attachments.length > 0
    if (!text && !hasFiles) return
    const mentioned = detectMentions(text)
    dialogMessages.value.push({
      id: `u-${Date.now()}`,
      type: 'msg',
      from: 'me',
      ts: nowStr(),
      mentioned: mentioned.length ? mentioned : undefined,
      body: text,
      attachments: hasFiles ? attachments : undefined,
    })
    decomposeInput.value = ''

    // 演示：拆解阶段(planning/ready)没 @ 别人 → 任务助手按脚本完善 Todolist（可见变化）
    const t0 = selectedTask.value
    const inDecompose = t0 && (phase.value === 'planning' || phase.value === 'ready')
    if (!mentioned.length && inDecompose) {
      const idx = t0._demoIdx || 0
      const turn = DEMO_DECOMPOSE_TURNS[idx]
      setTimeout(() => {
        if (turn) {
          dialogMessages.value.push({ id: `r-agent-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: turn.reply })
          dialogMessages.value.push({ id: `tp-${Date.now()}`, type: 'todo-patch', from: 'agent', ts: nowStr(), adds: turn.adds })
          applyTodoPatch({ adds: turn.adds })
          t0._demoIdx = idx + 1
        } else {
          dialogMessages.value.push({ id: `r-agent-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: `记下了。Todolist 现在共 ${currentTodos.value.length} 步，满意就点「执行」交给 CC 逐条跑。` })
        }
      }, 700)
      return
    }

    // 没 @ 别人 → 任务助手普通回（拆解阶段已在上面处理）
    if (!mentioned.length) {
      setTimeout(() => {
        dialogMessages.value.push({ id: `r-agent-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: mockResponseFor('agent') })
      }, 700)
      return
    }

    // @ 了任务助手（含 chip 行的预置 prompt）→ 任务助手按意图响应 + 改 Todolist
    if (mentioned.includes('agent')) {
      const intent = CHIP_INTENTS.find((c) => c.match.test(text))
      setTimeout(() => {
        if (intent && (phase.value === 'planning' || phase.value === 'ready')) {
          dialogMessages.value.push({ id: `r-agent-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: intent.reply })
          dialogMessages.value.push({ id: `tp-c-${Date.now()}`, type: 'todo-patch', from: 'agent', ts: nowStr(), adds: intent.adds })
          applyTodoPatch({ adds: intent.adds })
        } else {
          dialogMessages.value.push({ id: `r-agent-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: '收到，已记下。还有要补充的吗？' })
        }
      }, 700)
    }

    // @ 了数字人：① 该数字人给建议 → ② 任务助手看到建议，主动改 Todolist
    mentioned.forEach((rid, idx) => {
      if (rid === 'agent') return
      if (!invitedHumanIds.value.has(rid)) inviteHuman(rid)
      // ① 数字人按角色给建议
      setTimeout(() => {
        dialogMessages.value.push({ id: `r-${rid}-${Date.now()}-${idx}`, type: 'msg', from: rid, ts: nowStr(), body: mockResponseFor(rid) })
      }, 900 + idx * 1000)
      // ② 任务助手据建议改 Todolist（仅拆解阶段）
      const pp = PERSONA_PATCH[rid]
      if (pp && (phase.value === 'planning' || phase.value === 'ready')) {
        setTimeout(() => {
          dialogMessages.value.push({ id: `a-pp-${rid}-${Date.now()}`, type: 'msg', from: 'agent', ts: nowStr(), body: pp.reply })
          dialogMessages.value.push({ id: `tp-${rid}-${Date.now()}`, type: 'todo-patch', from: 'agent', ts: nowStr(), sourceFrom: rid, adds: pp.adds })
          applyTodoPatch({ adds: pp.adds })
        }, 1900 + idx * 1000)
      }
    })
  }

  // chip 行预置 prompt（@任务助手）→ 任务助手按意图回应 + 改 Todolist
  const CHIP_INTENTS = [
    { match: /验收标准/, reply: '好，我把验收标准补进 Todolist。', adds: ['明确验收标准（指标 / 必过条件 / 边界值）'] },
    { match: /不能动|依赖|越界|约束|边界约束/, reply: '记下边界约束，Kode 跑的时候会守住。', adds: ['标注不可改依赖 / 必须保留接口（约束）'] },
    { match: /拆得更细|更具体|按文件|按模块|太粗/, reply: '我按文件 / 模块把粗的步骤拆细。', adds: ['细化：按文件拆分改动点（逐文件列出）', '细化：核心逻辑分函数实现'] },
    { match: /测试|回归/, reply: '补几条回归测试场景到 Todolist。', adds: ['回归测试：核心路径 + 边界 + 异常态'] },
  ]

  // 数字人建议 → 任务助手据此往 Todolist 补的步骤（按角色）
  const PERSONA_PATCH = {
    xiaochan: { reply: '小产提了验收口径，我加进 Todolist。', adds: ['明确验收口径（先 A/B 小批，看开启率再全量）'] },
    laojia: { reply: '老架的分层建议有用，我拆成具体步骤。', adds: ['抽象分层：token 体系 / 状态管理 / 渐进切换防闪'] },
    ace: { reply: '阿测的测试场景我补进去。', adds: ['补测试场景（视觉差异 / 跨页切换 / 偏好持久化）'] },
    laoyan: { reply: '按老研说的，先理受影响文件 + 做兼容。', adds: ['梳理受影响文件清单 + localStorage 兼容处理'] },
    xiaoshen: { reply: '小审的必拒清单我作为约束记下。', adds: ['过必拒检查（配置 / 鉴权 / 敏感数据 / .env / 权限）'] },
    ayun: { reply: '阿运的灰度方案纳入收尾。', adds: ['灰度发布 5% → 监控 → 全量 + rollback 预案'] },
  }

  // 点击顶部 chip → 任务助手主动抛话题
  function askAboutCheck(checkId) {
    const questions = {
      desc: '能再具体说说这个任务要做什么吗？',
      todo: '你希望 Todolist 包含哪些步骤？我先列了几条，你可以补充。',
      criteria: '你的验收标准是什么？（比如目标值 / 必须满足的条件）',
      inputs: '关联什么文件 / 文档 / 历史任务作为输入源？拖进对话即可。',
      humans: '想邀请哪些数字人协作？右上 + 按钮选。',
      constraints: '有哪些不能改 / 必须保留的依赖？告诉我，CC 跑的时候会守住边界。',
    }
    const q = questions[checkId]
    if (!q) return
    dialogMessages.value.push({
      id: `a-${Date.now()}`,
      type: 'msg',
      from: 'agent',
      ts: nowStr(),
      body: q,
    })
  }

  // 手动加 Todolist（只对当前选中 task 操作）
  function addTodo(text) {
    if (!text.trim()) return
    const t = selectedTask.value
    if (!t) return
    if (!Array.isArray(t.todos)) t.todos = []
    t.todos.push({
      id: `td-${Date.now()}`,
      text: text.trim(),
      status: 'todo',
    })
  }

  function removeTodo(id) {
    const t = selectedTask.value
    if (!t || !Array.isArray(t.todos)) return
    t.todos = t.todos.filter((it) => it.id !== id)
  }

  // ─── 任务助手的 todolist 编辑权（用户不可见的"说明书"在背后由它凑齐）─────────
  // patch 由 dialogMessage 的 type:'todo-patch' 触发；这里只是把 patch 应用到当前 task
  // 数字人发言后，任务助手会主动 applyTodoPatch（demo 里用 dialogMessages 数据驱动）
  function applyTodoPatch(patch) {
    const t = selectedTask.value
    if (!t) return
    if (!Array.isArray(t.todos)) t.todos = []
    if (Array.isArray(patch.removes)) {
      const rm = new Set(patch.removes)
      t.todos = t.todos.filter((it) => !rm.has(it.id))
    }
    if (Array.isArray(patch.modifies)) {
      for (const m of patch.modifies) {
        const item = t.todos.find((it) => it.id === m.id)
        if (item) Object.assign(item, m)
      }
    }
    if (Array.isArray(patch.adds)) {
      for (const text of patch.adds) {
        t.todos.push({
          id: `td-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: String(text),
          status: 'todo',
        })
      }
    }
  }

  // ─── 立即执行：拆解 → 处理（同一份 todolist 进入执行生命周期）───────────
  // 用户视角：点完按钮，tab 自动切到处理，看到同一份 todolist 第一条开始动
  // 内部行为：清空 dialog → 注入 kickoff → 启动 mock CC 执行 timeline（3s/step）
  function executeNow() {
    const t = selectedTask.value
    if (!t) return
    // 标记任务进入执行态
    t.status = 'running'
    activeTab.value = 'process'
    // mock：第一条 todo 从 todo → active（如果还没人开跑）
    if (Array.isArray(t.todos)) {
      const firstTodo = t.todos.find((it) => it.status === 'todo')
      if (firstTodo && !t.todos.some((it) => it.status === 'active')) {
        firstTodo.status = 'active'
      }
    }
    // 清空旧 dialog 并注入 kickoff（用户不感知，但 demo 中暴露给你看任务说明书形态）
    dialog.value = [{
      id: `kick-${Date.now()}`,
      type: 'kickoff',
      ts: nowStr(),
      text: buildCcKickoffPrompt(t),
    }]
    // 启动 mock CC 执行（中度模拟：工具调用 / thinking / todo-tick / ask-user）
    startMockExecution(t)
  }

  // ─── Mock CC 执行：定时驱动 + ask-user 暂停 + 打断 ─────────────────────────
  let _execTimer = null
  let _execIndex = 0
  let _execTimeline = []
  let _execTask = null
  const EXEC_STEP_MS = 3000

  function startMockExecution(task) {
    stopMockExecution()
    _execTask = task
    _execTimeline = [...t7ProcessTimeline]  // demo 只对 t7 准备了完整 timeline
    _execIndex = 0
    _scheduleNextStep()
  }

  function _scheduleNextStep() {
    if (_execTimer) clearTimeout(_execTimer)
    _execTimer = setTimeout(_runNextStep, EXEC_STEP_MS)
  }

  function _runNextStep() {
    if (_execIndex >= _execTimeline.length) {
      // timeline 跑完：任务标 done，所有 todos 标 done
      if (_execTask) {
        _execTask.status = 'done'
        if (Array.isArray(_execTask.todos)) {
          _execTask.todos.forEach((it) => { it.status = 'done' })
        }
      }
      stopMockExecution()
      return
    }
    const event = _execTimeline[_execIndex]
    const pushed = {
      ...event,
      id: `e-${Date.now()}-${_execIndex}`,
      ts: nowStr(),
    }
    dialog.value.push(pushed)
    _execIndex += 1

    // ── 事件副作用 ──
    if (event.type === 'todo-tick') {
      // 把 active 那条标 done，下一条 todo 转 active
      if (_execTask && Array.isArray(_execTask.todos)) {
        const active = _execTask.todos.find((it) => it.status === 'active')
        if (active) active.status = 'done'
        const next = _execTask.todos.find((it) => it.status === 'todo')
        if (next) next.status = 'active'
      }
    }

    if (event.type === 'ask-user') {
      // 暂停：等用户决策
      if (_execTask) _execTask.status = 'waiting'
      // 不调度下一步
      return
    }

    _scheduleNextStep()
  }

  function stopMockExecution() {
    if (_execTimer) {
      clearTimeout(_execTimer)
      _execTimer = null
    }
  }

  /** 用户点「中止」：停 timer，task.status = 'paused'，可回编辑改 todolist */
  function pauseExecution() {
    stopMockExecution()
    if (_execTask) _execTask.status = 'paused'
  }

  /** 用户点「继续」：task.status = 'running'，从 timeline 当前位置继续 */
  function resumeExecution() {
    if (!_execTask) return
    _execTask.status = 'running'
    _scheduleNextStep()
  }

  // 用户做出 ask-user 决策（点了 A / B / wait）
  function decideAskUser(askId, optionId) {
    // 找到对话流里的 ask-user，记录决策
    const ask = dialog.value.find((d) => d.id === askId && d.type === 'ask-user')
    if (ask) ask.decision = optionId
    // 'wait' 让用户继续看代码，不恢复执行
    if (optionId === 'wait') return
    // 选 A / B 都继续推进 timeline
    if (_execTask) _execTask.status = 'running'
    _scheduleNextStep()
  }

  // 用户在处理 tab 输入框输入 = 打断 CC
  function interruptExecution(text) {
    if (!text || !text.trim()) return
    stopMockExecution()
    dialog.value.push({
      id: `intr-${Date.now()}`,
      type: 'user-interrupt',
      ts: nowStr(),
      text: text.trim(),
    })
    // CC「听到」并 ack（模拟），然后继续推进
    setTimeout(() => {
      dialog.value.push({
        id: `cc-${Date.now()}`,
        type: 'cc-text',
        ts: nowStr(),
        text: '收到，根据你的指示调整方向，继续。',
      })
      if (_execTask && _execTask.status !== 'done') {
        if (_execTask.status === 'waiting') _execTask.status = 'running'
        _scheduleNextStep()
      }
    }, 1500)
  }

  function buildCcKickoffPrompt(task) {
    const lines = []
    lines.push(`# 任务：${task.title || '(未命名)'}`)
    if (task.desc) lines.push(`\n${task.desc}\n`)
    const b = task.briefing || {}
    if (b.cwd) lines.push(`📁 工作目录：${b.cwd}`)
    if (b.branch) lines.push(`🌿 分支：${b.branch}`)
    if (Array.isArray(b.key_files) && b.key_files.length) {
      lines.push(`🔑 关键文件：${b.key_files.join(', ')}`)
    }
    if (Array.isArray(b.constraints) && b.constraints.length) {
      lines.push(`🚫 约束：${b.constraints.join('；')}`)
    }
    if (b.criteria) lines.push(`✅ 验收：${b.criteria}`)
    if (Array.isArray(task.todos) && task.todos.length) {
      lines.push(`\n📝 执行步骤：`)
      task.todos.forEach((it, i) => {
        lines.push(`  ${i + 1}. ${it.text}`)
      })
    }
    return lines.join('\n')
  }

  /**
   * 拖拽任务卡到 CLI 输入框时使用的 prompt 构造
   * 只输出「原始 briefing + 附件引用」，**不含 todolist**
   * 理由：CLI 派要原料不要拆解结果。todolist 是「编辑/处理」产品化路径的产物，
   *      给 CLI 用户反而是噪音 —— 想要 todolist 的人就该走处理 Tab，不会拖到 CLI
   */
  function buildCliDragPrompt(task) {
    const lines = []
    lines.push(`# 任务：${task.title || '(未命名)'}`)
    if (task.desc) lines.push(`\n${task.desc}\n`)
    const b = task.briefing || {}
    if (b.cwd) lines.push(`📁 工作目录：${b.cwd}`)
    if (b.branch) lines.push(`🌿 分支：${b.branch}`)
    if (Array.isArray(b.key_files) && b.key_files.length) {
      lines.push(`🔑 关键文件：${b.key_files.join(', ')}`)
    }
    if (Array.isArray(b.constraints) && b.constraints.length) {
      lines.push(`🚫 约束：${b.constraints.join('；')}`)
    }
    if (b.criteria) lines.push(`✅ 验收：${b.criteria}`)
    if (Array.isArray(task.attachments) && task.attachments.length) {
      lines.push(`\n📎 附件：`)
      task.attachments.forEach((a) => {
        const label = a?.name || a?.url || (typeof a === 'string' ? a : '(未命名附件)')
        lines.push(`  · ${label}`)
      })
    }
    return lines.join('\n')
  }

  // ─── 选中 / tab ───
  function selectTask(id) {
    selectedTaskId.value = id
  }
  function setTab(t) {
    activeTab.value = t
  }
  function toggleCheck(id) {
    // 目录失效的工作区：任务不能进批量执行（跑起来也是死）
    const t = tasks.value.find((x) => x.id === id)
    if (t && workspaces.value.find((w) => w.id === t.wsId)?.missing) return
    const s = new Set(checkedTaskIds.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    checkedTaskIds.value = s
  }
  function checkedCountByWs(wsId) {
    let n = 0
    for (const id of checkedTaskIds.value) {
      const t = tasks.value.find((t) => t.id === id)
      if (t && t.wsId === wsId) n++
    }
    return n
  }

  // ─── Workspace 折叠 ───
  function toggleWorkspaceCollapse(wsId) {
    const s = new Set(collapsedWorkspaces.value)
    if (s.has(wsId)) s.delete(wsId)
    else s.add(wsId)
    collapsedWorkspaces.value = s
  }

  function isWorkspaceCollapsed(wsId) {
    return collapsedWorkspaces.value.has(wsId)
  }

  // ─── 批次状态判定 ───
  // 批次状态机：
  //   pending 全排队 · running 有任务在跑 · paused 中断 ·
  //   reviewing 跑完待确认(全 ran,等用户[完成任务]/[重新编辑]) ·
  //   done 已归档 · cancelled 已取消/重编
  // 任务 status 生命周期(批次内)：queue → running → ran(跑完待确认) → done(归档)
  function batchStatus(b) {
    if (!b) return null
    if (b.status === 'cancelled') return 'cancelled'
    const bt = b.taskIds.map((id) => tasks.value.find((t) => t.id === id)).filter(Boolean)
    if (!bt.length) return 'pending'
    if (bt.every((t) => t.status === 'done' || t.status === 'failed')) return 'done'
    if (b.paused) return 'paused'
    const stillActive = bt.some((t) => ['queue', 'ready', 'pending', 'running'].includes(t.status))
    // 没有还在排队/运行的,且有跑完的 → 跑完待确认
    if (!stillActive && bt.some((t) => t.status === 'ran')) return 'reviewing'
    if (bt.some((t) => t.status === 'running')) return 'running'
    if (bt.every((t) => ['queue', 'ready', 'pending'].includes(t.status))) return 'pending'
    return 'mixed'
  }

  // 批次内"完成数"(用于左栏进度 done/total)：跑完(ran)/归档(done)/失败都算已推进
  function batchDoneCount(b) {
    if (!b) return 0
    return b.taskIds.filter((id) => {
      const t = tasks.value.find((tt) => tt.id === id)
      return t && ['done', 'failed', 'ran'].includes(t.status)
    }).length
  }

  // ── 左栏批次推进引擎：任务逐个 queue→running→ran,全 ran 后停(进 reviewing) ──
  let _batchTimer = null
  function _batchTick() {
    let anyActive = false
    for (const b of batches.value) {
      if (b.paused || b.status === 'cancelled') continue
      const bt = b.taskIds.map((id) => tasks.value.find((t) => t.id === id)).filter(Boolean)
      const running = bt.find((t) => t.status === 'running')
      const queued = bt.filter((t) => t.status === 'queue' || t.status === 'ready')
      if (!running && !queued.length) continue // 该批已跑完,无可推进
      anyActive = true
      if (running) running.status = 'ran' // 当前跑完
      if (queued.length) queued[0].status = 'running' // 下一个开跑
    }
    if (!anyActive && _batchTimer) { clearInterval(_batchTimer); _batchTimer = null }
  }
  function _ensureBatchTimer() {
    if (!_batchTimer) _batchTimer = setInterval(_batchTick, 1800)
  }

  // 批次级「中断」：running → paused,引擎跳过该批
  function pauseBatch(batchId) {
    const b = batches.value.find((x) => x.id === batchId)
    if (!b || b.paused) return
    b.paused = true
    b.taskIds.forEach((id) => {
      const t = tasks.value.find((tt) => tt.id === id)
      if (t && t.status === 'running') t.status = 'paused'
    })
  }
  // 批次级「继续」：paused → running,重启引擎
  function resumeBatch(batchId) {
    const b = batches.value.find((x) => x.id === batchId)
    if (!b || !b.paused) return
    b.paused = false
    b.taskIds.forEach((id) => {
      const t = tasks.value.find((tt) => tt.id === id)
      if (t && t.status === 'paused') t.status = 'running'
    })
    _ensureBatchTimer()
  }
  // 批次级「完成任务」：跑完待确认 → 整批归档;脱离批次,已完成里以单个任务展示
  function finishBatch(batchId) {
    const b = batches.value.find((x) => x.id === batchId)
    if (!b) return
    b.taskIds.forEach((id) => {
      const t = tasks.value.find((tt) => tt.id === id)
      if (!t) return
      t.status = 'done'
      t.batchId = null
    })
    b.status = 'done'
  }

  // ─── 筛选 ───
  function setFilter(f) {
    activeFilter.value = f
  }

  // 给定任务,返回是否通过当前筛选
  // 四档语义(每个任务落唯一一档):
  //   all      全部
  //   running  执行中 = 走了执行流程(单发/批量)还没完 → _phase ∈ {executing, waiting}
  //   pending  未完成 = 没走执行流程、也没手动完成(草稿 / 在 IDE/CLI 里手动干活的),默认档
  //   done     已完成 = 跑完 或 手动标记完成(status==='done')
  function passesFilter(t) {
    const f = activeFilter.value
    if (f === 'all') return true
    // 已完成 = 手动完成 或 批处理跑完
    if (f === 'done') return t.status === 'done'
    // 批处理 = 进过批处理(有 batchId)且未完成;跑过批处理的任务一直带 batchId(在已完成/全部里也保持批次展示)
    if (f === 'batch') return t.status !== 'done' && !!t.batchId
    // 待处理(默认,第一档) = 未完成 且 没进过批处理(初始态 / 在 IDE/CLI 手动干活的)
    return t.status !== 'done' && !t.batchId
  }

  // ─── 新建任务 ───
  // 新任务弹窗预填（从其它模块转发到 Kode 时携带）
  const newTaskPrefill = ref(null)
  function openNewTaskModal(opts = null) {
    newTaskPrefill.value = opts || null
    showNewTaskModal.value = true
  }
  function closeNewTaskModal() {
    showNewTaskModal.value = false
    newTaskPrefill.value = null
  }

  function createTask(draft) {
    if (!draft.name?.trim() || !draft.wsId) return null
    const t = {
      id: `nt-${Date.now()}`,
      wsId: draft.wsId,
      batchId: null,
      type: draft.type || '需求',
      mode: draft.mode || 'kode',       // 执行模式：kode / ide
      title: draft.name.trim(),
      desc: draft.desc?.trim() || '',
      status: 'ready',
      progress: 0,
      attachments: draft.attachments || [],
    }

    // 演示：新任务起手就有一份草稿 Todolist（逐条揭示拆解）
    t.todos = makeStarterTodos(t)
    t._demoIdx = 0
    tasks.value.push(t)
    // 自动选中新任务 + 切到拆解 tab
    selectedTaskId.value = t.id
    activeTab.value = 'decompose'
    // 演示：建任务即「我」把描述 + 源文件发出来（第一轮），任务助手随后开始拆解
    dialogMessages.value = [
      {
        id: `u-${t.id}`,
        type: 'msg',
        from: 'me',
        ts: nowStr(),
        body: t.desc?.trim() || t.title,
        attachments: t.attachments?.length ? t.attachments : undefined,
      },
    ]
    showNewTaskModal.value = false
    // 任务助手 0.6s 后回应并开始拆解（planning → 逐条揭示）
    t._phase = 'planning'
    setTimeout(() => {
      dialogMessages.value.push({
        id: `a-intro-${t.id}`,
        type: 'msg',
        from: 'agent',
        ts: nowStr(),
        body: `收到，${t.attachments?.length ? '我看了下源文件，' : ''}先拆成一份 Todolist 草稿，你再补充——想加什么、哪步拆细，直接说。`,
      })
      startPlanning()
    }, 600)
    return t
  }

  // ide 任务：人工标记完成（没有机器驱动的 done 信号，靠人点）
  function completeTask(taskId) {
    const t = tasks.value.find((x) => x.id === taskId)
    if (!t) return
    t.status = 'done'
    t.progress = 1
  }

  // ─── 添加 Workspace ───
  function openAddWorkspaceModal() { showAddWorkspaceModal.value = true }
  function closeAddWorkspaceModal() { showAddWorkspaceModal.value = false }

  // ─── 批量执行配置框（支持跨 workspace 编排）──────────────────────
  function openBatchExecuteModal() {
    showBatchExecuteModal.value = true
  }
  function closeBatchExecuteModal() {
    showBatchExecuteModal.value = false
  }

  /**
   * 把已勾选任务按 wsId 分组（每个 ws → 1 个独立批次）
   * 返回：[{ ws, tasks }]，按 ws 在 workspaces 数组里的顺序排
   */
  const checkedTasksGroupedByWs = computed(() => {
    const map = new Map() // wsId → tasks[]
    for (const id of checkedTaskIds.value) {
      const t = tasks.value.find((tt) => tt.id === id)
      if (!t) continue
      if (!map.has(t.wsId)) map.set(t.wsId, [])
      map.get(t.wsId).push(t)
    }
    const groups = []
    for (const ws of workspaces.value) {
      const list = map.get(ws.id)
      if (list && list.length) groups.push({ ws, tasks: list })
    }
    return groups
  })

  // 跨 workspace 勾选汇总信息（左侧顶部批量栏用）
  const checkedSummary = computed(() => {
    const groups = checkedTasksGroupedByWs.value
    return {
      total: groups.reduce((n, g) => n + g.tasks.length, 0),
      wsCount: groups.length,
    }
  })

  /**
   * 把 ws 内的任务按 chainConfig 切分成多个批次
   * @param {Array} list 该 ws 的任务（按勾选顺序）
   * @param {Object} chainConfig { [taskId]: boolean }，true=接前（同批），false=起新批次
   *                              第一个任务永远是新批次起点（忽略它的 chain）
   * @returns Array<Array<Task>>  分组后的批次列表
   */
  function splitIntoBatches(list, chainConfig) {
    const batches = []
    let cur = []
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      const chainPrev = i === 0 ? false : (chainConfig[t.id] !== false) // 默认接前
      if (i === 0 || !chainPrev) {
        if (cur.length) batches.push(cur)
        cur = [t]
      } else {
        cur.push(t)
      }
    }
    if (cur.length) batches.push(cur)
    return batches
  }

  /**
   * 真正开始批量执行（配置框点"开始执行"调）
   * config: {
   *   chainConfig: { [taskId]: boolean },                  // 每个 task 是否接前
   *   wsTaskOrder: { [wsId]: string[] },                   // ws 内任务的拖拽后顺序（可选）
   * }
   */
  function startBatchExecute(config = {}) {
    const groups = checkedTasksGroupedByWs.value
    if (!groups.length) return

    const chainConfig = config.chainConfig || {}
    const wsTaskOrder = config.wsTaskOrder || {}
    let firstPickedTask = null
    let seq = 0

    // 1. 每个 workspace 内按 chainConfig 切分成多个批次
    for (const { ws, tasks: picked } of groups) {
      // 应用 ws 内拖拽顺序（若有）
      let ordered = picked
      const orderIds = wsTaskOrder[ws.id]
      if (Array.isArray(orderIds) && orderIds.length) {
        const byId = new Map(picked.map((t) => [t.id, t]))
        ordered = orderIds.map((id) => byId.get(id)).filter(Boolean)
        // 兜底：把意外漏掉的任务追加在尾部（防止数据不一致丢任务）
        picked.forEach((t) => { if (!ordered.includes(t)) ordered.push(t) })
      }
      const splits = splitIntoBatches(ordered, chainConfig)
      for (const batchTasks of splits) {
        seq += 1
        const batchId = `b-${Date.now()}-${ws.id}-${seq}`
        batches.value.push({
          id: batchId,
          wsId: ws.id,
          startedAt: nowStr().slice(0, 5),
          status: 'running',
          paused: false,
          taskIds: batchTasks.map((t) => t.id),
        })
        batchTasks.forEach((t, i) => {
          t.batchId = batchId
          t.status = i === 0 ? 'running' : 'queue'
          t.progress = 0
          // 任务 tab 的处理态：第一个先 ready（随后 startExecuting 跑起来），其余等待执行
          t._phase = i === 0 ? 'ready' : 'waiting'
        })
        if (!firstPickedTask) firstPickedTask = batchTasks[0]
      }
    }

    // 2. 清空勾选 + 关闭配置框
    checkedTaskIds.value = new Set()
    showBatchExecuteModal.value = false

    // 3. 跳到第一个任务的「任务」tab，看到它正在执行；其余任务的处理区显示「等待执行」
    if (firstPickedTask) {
      selectedTaskId.value = firstPickedTask.id
      activeTabId.value = 'task'
      nextTick(() => startExecuting())
    }
    // 4. 启动左栏批次推进引擎（任务逐个跑完 → 跑完待确认）
    _ensureBatchTimer()
  }

  // 自动轮转色块
  const wsColorPool = ['#22c55e', '#8478FA', '#F67C43', '#57CFDE', '#E9628B', '#659EFF']
  function nextWsColor() {
    return wsColorPool[workspaces.value.length % wsColorPool.length]
  }

  function addWorkspace(draft) {
    if (!draft.name?.trim() || !draft.path?.trim()) return null
    const ws = {
      id: `w-${Date.now()}`,
      name: draft.name.trim(),
      color: draft.color || nextWsColor(),
      cwd: draft.path.trim(),
      branch: draft.branch?.trim() || 'main',
      status: 'idle',
    }
    workspaces.value.push(ws)
    showAddWorkspaceModal.value = false
    return ws
  }

  function removeWorkspace(wsId) {
    workspaces.value = workspaces.value.filter((w) => w.id !== wsId)
    // 同时去掉这个 workspace 下的任务（demo 极简）
    tasks.value = tasks.value.filter((t) => t.wsId !== wsId)
  }

  // 取消 / 重新编辑共用：批次内未归档任务(running/queue/ran/paused)回 ready 草稿、脱离批次 → 落回「待处理」
  function cancelBatch(batchId) {
    const b = batches.value.find((x) => x.id === batchId)
    if (!b) return
    for (const id of b.taskIds) {
      const t = tasks.value.find((tt) => tt.id === id)
      if (!t) continue
      if (['running', 'queue', 'ready', 'ran', 'paused'].includes(t.status)) {
        t.status = 'ready'
        t.batchId = null
      }
    }
    b.status = 'cancelled'
    b.paused = false
  }
  function toggleCompletion(id) {
    if (completion[id]) completion[id].ok = !completion[id].ok
  }

  // ─── 处理 tab actions ───
  function sendUserInput() {
    const text = userInput.value.trim()
    if (!text) return
    dialog.value.push({
      id: `u${Date.now()}`,
      from: 'user',
      ts: nowStr(),
      body: [{ text }],
    })
    userInput.value = ''
    setTimeout(() => {
      dialog.value.push({
        id: `c${Date.now()}`,
        from: 'cc',
        ts: nowStr(),
        body: [{ text: '收到，正在调整中 ...' }, { cursor: true }],
      })
    }, 800)
  }

  // 当前选中任务的 Todolist：拆解 + 处理共享同一份（挂在 task 上）
  // 不再按 tab 分支 —— 用户看到的是同一份数据，只是状态在变化
  const currentTodos = computed(() => {
    const t = selectedTask.value
    return Array.isArray(t?.todos) ? t.todos : []
  })

  // 当前选中任务的产物
  // 产物列表：拆解 / 处理共享同一份业务文件清单（任务对应的真实文件）
  // 拆解 tab UI 已经把"新增/改/删"标签隐藏，所以同一份数据不会混淆
  const currentProducts = computed(() => products.process)

  // ─── 任务 tab 四阶段状态机：planning → ready → executing → done ───────────
  // 仅驱动「任务 tab 中间 Todolist + 右侧对话 + 新建拆解流」；
  // 左栏任务卡 / 筛选不受影响（保留旧极简：无状态文字、只未完成/已完成）。
  // phase 存在 task 上（_phase），切任务自然带着自己的阶段，互不串。
  const revealedCount = ref(999) // planning 阶段已逐条揭示的 todo 数
  const execIndex = ref(-1)      // executing 阶段当前执行到第几条（-1 未开始）
  let revealTimer = null
  let execTimer = null
  function clearPhaseTimers() {
    if (revealTimer) { clearInterval(revealTimer); revealTimer = null }
    if (execTimer) { clearInterval(execTimer); execTimer = null }
  }
  const phase = computed(() => selectedTask.value?._phase || 'ready')
  function setPhase(p) { if (selectedTask.value) selectedTask.value._phase = p }

  // planning 阶段中间区逐条揭示；其余阶段全显
  const visibleTodos = computed(() =>
    phase.value === 'planning'
      ? currentTodos.value.slice(0, revealedCount.value)
      : currentTodos.value,
  )
  const execProgress = computed(() => {
    const total = currentTodos.value.length
    if (!total) return 0
    const done = phase.value === 'done' ? total : Math.max(0, execIndex.value)
    return Math.round((done / total) * 100)
  })
  // 某条 todo 在执行时间线里的状态
  function execStatus(i) {
    if (phase.value === 'done') return 'done'
    if (phase.value !== 'executing') return 'queued'
    if (execIndex.value > i) return 'done'
    if (execIndex.value === i) return 'running'
    return 'queued'
  }

  // 开始拆解：逐条揭示 todo（360ms/条），揭示完转 ready
  function startPlanning() {
    clearPhaseTimers()
    setPhase('planning')
    revealedCount.value = 0
    execIndex.value = -1
    revealTimer = setInterval(() => {
      if (revealedCount.value >= currentTodos.value.length) {
        clearInterval(revealTimer); revealTimer = null
        setPhase('ready')
        // 揭示完：任务助手收尾，引导继续完善（演示拆解）
        dialogMessages.value.push({
          id: `a-plan-${Date.now()}`,
          type: 'msg',
          from: 'agent',
          ts: nowStr(),
          body: `已拆成 ${currentTodos.value.length} 步，放到右侧「处理」里了。看看要不要调整？想加步骤或拆细，跟我说；满意就点「执行」。`,
        })
        return
      }
      revealedCount.value++
    }, 360)
  }
  // 点「执行」：逐条推进（1700ms/条），跑完转 done
  function startExecuting() {
    if (phase.value !== 'ready') return
    clearPhaseTimers()
    setPhase('executing')
    execIndex.value = 0
    execTimer = setInterval(() => {
      if (execIndex.value >= currentTodos.value.length - 1) {
        clearInterval(execTimer); execTimer = null
        execIndex.value = currentTodos.value.length
        setPhase('done')
        return
      }
      execIndex.value++
    }, 1700)
  }
  // ─── Todolist 复用（IDE/CLI 输入框上方 chip 行 → 派发给 Kode）──────────
  // sentSteps：哪些 todo 已经派发给 Kode（chip 变绿 ✓）。跟着任务走。
  const sentSteps = ref(new Set())
  function isStepSent(id) { return sentSteps.value.has(id) }
  function markStepSent(id) {
    const s = new Set(sentSteps.value)
    s.add(id)
    sentSteps.value = s
  }
  function markAllStepsSent() {
    sentSteps.value = new Set(currentTodos.value.map((t) => t.id))
  }

  // 切任务：清定时器 + 复位逐条计数 + 清已派发标记（phase 跟着 task 走，不在这里重置）
  watch(selectedTaskId, () => {
    clearPhaseTimers()
    revealedCount.value = 999
    execIndex.value = -1
    sentSteps.value = new Set()
  })

  // 载入即推进已存在的活跃批次(seeded 批次也能演到"跑完待确认")
  if (batches.value.some((b) => !b.paused && b.status !== 'cancelled' && b.status !== 'done'
    && b.taskIds.some((id) => {
      const t = tasks.value.find((tt) => tt.id === id)
      return t && (t.status === 'running' || t.status === 'queue')
    }))) {
    _ensureBatchTimer()
  }

  return {
    // data
    workspaces,
    digitalHumans,
    taskAssistant,
    batches,
    tasks,
    // selection
    selectedTaskId,
    selectedTask,
    selectedWorkspace,
    wsMissing,
    activeTab,
    currentMode,
    switchMode,
    // 标签页系统
    openTabIds,
    activeTabId,
    setActiveTab,
    openTab,
    closeTab,
    addableTabs,
    previewTarget,
    openProductInPreview,
    openPreviewTab,
    // Kode 对话（统一对话柱）
    kodeMessages,
    kodeInput,
    sendKodeMessage,
    kodeReuseSend,
    kodeReuseSendAll,
    // derived
    tasksByWorkspace,
    batchesByWorkspace,
    currentBatch,
    currentBatchTasks,
    // checked
    checkedTaskIds,
    checkedCountByWs,
    // decompose
    decomposeInputsList,
    invitedHumanIds,
    participants,
    dialogMessages,
    decomposeInput,
    completion,
    completionPercent,
    requiredAllSatisfied,
    // process
    dialog,
    userInput,
    // shared
    currentTodos,
    currentProducts,
    // 任务 tab 四阶段状态机
    phase,
    visibleTodos,
    execProgress,
    execStatus,
    execIndex,
    startPlanning,
    startExecuting,
    // Todolist 复用（IDE/CLI）
    sentSteps,
    isStepSent,
    markStepSent,
    markAllStepsSent,
    // 折叠 + 筛选 + 批次
    collapsedWorkspaces,
    activeFilter,
    toggleWorkspaceCollapse,
    isWorkspaceCollapsed,
    setFilter,
    passesFilter,
    batchStatus,
    batchDoneCount,
    cancelBatch,
    pauseBatch,
    resumeBatch,
    finishBatch,
    // 模态框
    showNewTaskModal,
    newTaskPrefill,
    openNewTaskModal,
    closeNewTaskModal,
    createTask,
    completeTask,
    showAddWorkspaceModal,
    openAddWorkspaceModal,
    closeAddWorkspaceModal,
    addWorkspace,
    removeWorkspace,
    // 批量执行配置框
    showBatchExecuteModal,
    openBatchExecuteModal,
    closeBatchExecuteModal,
    checkedTasksGroupedByWs,
    checkedSummary,
    startBatchExecute,
    splitIntoBatches,
    // actions
    selectTask,
    setTab,
    // 处理 Tab 启动执行：briefing + todolist（产品化路径的完整执行计划）
    buildCcKickoffPrompt,
    // 拖拽任务到 CLI：briefing + 附件，不含 todolist（CLI 派要原料不要拆解结果）
    buildCliDragPrompt,
    toggleCheck,
    inviteHuman,
    removeHuman,
    sendDecomposeMessage,
    askAboutCheck,
    addTodo,
    removeTodo,
    applyTodoPatch,
    executeNow,
    decideAskUser,
    interruptExecution,
    stopMockExecution,
    pauseExecution,
    resumeExecution,
    sendUserInput,
    toggleCompletion,
    getPersona,
  }
}
