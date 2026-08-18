// Kode demo · mock 数据
// 浏览器演示用，不连真后端

// 真头像（来自发布会素材 + 团队助手图标）
import meAvatar from '@/assets/launch/me.jpeg'              // 孟世一
import productAvatar from '@/assets/launch/product.png'     // 产品数字人
import devAvatar from '@/assets/launch/dev.png'             // 研发数字人
import testAvatar from '@/assets/launch/test.png'           // 测试数字人
import saeAvatar from '@/assets/launch/sae.png'             // SAE 数字人（运维 / 架构）
import consultingAvatar from '@/assets/launch/consulting.png' // 咨询数字人（评审）
import assetsAvatar from '@/assets/launch/assets.png'       // 资产数字人（备用）
import teamAssistantIcon from '@/assets/team-assistant-icon.png' // 任务助手 = 团队助手图标

export const workspaces = [
  {
    id: 'kc',
    name: 'kc_workspace',
    color: '#22c55e',
    cwd: '~/projects/kc_workspace',
    branch: 'main',
    status: 'running',
  },
  {
    id: 'sa',
    name: 'super-assistant',
    color: '#8478FA',
    cwd: '~/projects/super-assistant',
    branch: 'main',
    status: 'idle',
    // 演示「工作区目录失效」兜底态：用户把目录删了/移走了，或切分支导致挂载点消失。
    // 真实场景是选中 ws / 打开 IDE 时现查 cwd 存不存在，这里用 mock 字段驱动。
    missing: true,
  },
  {
    id: 'pf',
    name: 'platform-bridge',
    color: '#F67C43',
    cwd: '~/projects/platform-bridge',
    branch: 'dev',
    status: 'idle',
  },
]

// 任务助手 = 系统默认 agent，拆解 tab 永远在场，不能移除
// 视觉与协作里的"团队助手"一致
export const taskAssistant = {
  id: 'agent',
  name: '任务助手',
  role: '默认',
  initials: '助',
  avatar: teamAssistantIcon,
  isDigital: true, // 跟数字人一样的方形头像处理
}

// 当前用户：孟世一（真头像）
export const currentUser = {
  id: 'me',
  name: '孟世一',
  role: '你',
  initials: '孟',
  avatar: meAvatar,
  isHuman: true, // 圆形头像
}

// 数字人 = 真 PERSONAS（头像用发布会素材）
export const digitalHumans = [
  currentUser,
  { id: 'xiaochan', name: '小产', role: '产品 / PM', bio: '需求拆解 · 验收 · 产物归并', initials: '产', color: '#ec4899', avatar: productAvatar, isDigital: true },
  { id: 'laojia',   name: '老架', role: '架构师',     bio: '方案设计 · 风险评估 · 设计审', initials: '架', color: '#8478fa', avatar: consultingAvatar, isDigital: true },
  { id: 'ace',      name: '阿测', role: '测试 / QA',   bio: '测试用例 · 回归 · 必拒 6 条',  initials: '测', color: '#06b6d4', avatar: testAvatar, isDigital: true },
  { id: 'laoyan',   name: '老研', role: '研发 / Dev', bio: '编码 · 调试 · PR 提交',         initials: '研', color: '#f59e0b', avatar: devAvatar, isDigital: true },
  { id: 'xiaoshen', name: '小审', role: '代码评审',    bio: 'PR 评审 · 必拒检查 · 风险建议', initials: '审', color: '#6366f1', avatar: assetsAvatar, isDigital: true },
  { id: 'ayun',     name: '阿运', role: '运维 / Ops',  bio: '部署 · 灰度 · 监控接入',         initials: '运', color: '#10b981', avatar: saeAvatar, isDigital: true },
]

// 批次（per workspace）
export const batches = [
  {
    id: 'b1',
    wsId: 'kc',
    startedAt: '14:32',
    status: 'running',
    taskIds: ['t1', 't2', 't3', 't4', 't5'],
  },
]

// 任务（与 workspace、batch 关联）
//
// 数据模型说明：
// - todos[] 是 task 上唯一的 todolist（拆解 + 处理共用同一份）
//   - status: 'todo' | 'active' | 'done'
//   - 拆解阶段所有项都是 'todo'；处理阶段会随 CC 跑动把 todo → active → done
// - briefing 是任务助手在背后凑齐的执行说明书（cwd / branch / key_files / constraints / criteria）
//   - 用户在 UI 上看不到，点"立即执行"时由任务助手序列化成 prompt 投给 CC
export const tasks = [
  // ===== kc_workspace 当前批次 =====
  {
    id: 't1',
    wsId: 'kc',
    batchId: 'b1',
    type: '研发任务',
    mode: 'ide',
    title: '埋点字典 v2 设计',
    desc: '统一埋点字段规范，按场景分组管理，对接灰度集群。',
    status: 'done',
    progress: 1,
    todos: [],
    briefing: {},
  },
  {
    id: 't2',
    wsId: 'kc',
    batchId: 'b1',
    type: '研发任务',
    title: '列表分页优化',
    desc: '会话历史列表 1k+ 条目首屏卡顿（FCP > 2s），改为虚拟滚动 + 预取策略。',
    status: 'running',
    progress: 0.38,
    // 处理中态：第一条已完成，第二条进行中，后面排队
    todos: [
      { id: 'p1', text: '调研现有分页实现 · 定位 5 处相关代码', status: 'done' },
      { id: 'p2', text: '设计虚拟滚动方案 + FCP 优化路径', status: 'active' },
      { id: 'p3', text: '输出验收标准与回归用例清单', status: 'todo' },
      { id: 'p4', text: '评估埋点字典 v2 联动改动', status: 'todo' },
    ],
    briefing: {
      cwd: '~/projects/kc_workspace',
      branch: 'main',
      key_files: ['src/views/messages/MessageList.vue', 'src/composables/useInfiniteScroll.ts'],
      constraints: ['不改 useInfiniteScroll 公开 API', '兼容 IE11 不需要'],
      criteria: 'FCP < 1.5s，骨架屏 ≤ 200ms，无白屏闪烁',
    },
  },
  {
    id: 't3',
    wsId: 'kc',
    batchId: 'b1',
    type: '需求',
    mode: 'ide',
    title: '会话导出为 PDF',
    desc: '群聊历史导出为 PDF，含发送人、时间戳、附件链接。',
    status: 'queue',
    progress: 0,
    todos: [],
    briefing: {},
  },
  {
    id: 't4',
    wsId: 'kc',
    batchId: 'b1',
    type: '用例',
    mode: 'ide',
    title: '消息中心已读未读全量回归',
    desc: '回归范围：消息中心首屏 + 群消息已读态计算 + 未读 badge 同步。',
    status: 'queue',
    progress: 0,
    depHint: '依赖：列表分页优化',
    todos: [],
    briefing: {},
  },
  {
    id: 't5',
    wsId: 'kc',
    batchId: 'b1',
    type: '需求',
    title: '团队空间配置优化',
    desc: '用户中心团队空间面板的配置项重构，支持多角色权限切换。',
    status: 'queue',
    progress: 0,
    todos: [],
    briefing: {},
  },
  // ===== kc_workspace 未批次任务 =====
  {
    id: 't6',
    wsId: 'kc',
    batchId: null,
    type: '缺陷',
    mode: 'ide',
    title: '头像组件遮挡边距',
    desc: '群成员头像在列表项最右边距溢出 4px。',
    status: 'ready',
    progress: 0,
    todos: [],
    briefing: {},
  },
  // ===== super-assistant 任务（演示编辑中态的主任务 · Kode 元闭环演示）=====
  {
    id: 't7',
    wsId: 'sa',
    batchId: null,
    type: '研发任务',
    title: 'Kode 编辑 tab · 加快捷 prompt chip 行',
    desc: '在 Kode 编辑 tab 输入框上方加一行预置 prompt chip，让用户一键 prefill 触发任务助手完善 todolist。',
    status: 'ready',
    progress: 0,
    selected: true, // 默认选中演示
    // 编辑中态：所有项都是 'todo'，等点"立即执行"才开始转 active
    todos: [
      { id: 'd1', text: '调研现有 chip 类组件设计（ElementPlus / Naive UI）', status: 'todo' },
      { id: 'd2', text: '列出 4-6 个常用 prompt（验收 / 约束 / 拆细 / 测试场景）', status: 'todo' },
      { id: 'd3', text: '实现 chip UI 组件（紫色边框 + hover 上浮）', status: 'todo' },
      { id: 'd4', text: '接入 prefill 逻辑（点击 chip → 填充到输入框）', status: 'todo' },
      { id: 'd5', text: '升级 element-plus 到 2.5.0（修复 hover transition bug）', status: 'todo' },
      { id: 'd6', text: '写单测 + 提交 PR', status: 'todo' },
    ],
    briefing: {
      cwd: '~/projects/kooky-frontend',
      branch: 'feature/kode-prompt-chips',
      key_files: [
        'src/modules/kode/components/tabs/DecomposeTab.vue',
        'src/modules/kode/composables/useKodeState.js',
      ],
      constraints: ['不改 Vue 大版本', '不引入新依赖（除非必要）', '保持现有彩虹边输入框样式'],
      criteria: 'chip hover 上浮 + prefill 工作 + 4 个 prompt 全覆盖 + 单测通过',
    },
  },
  {
    id: 't8',
    wsId: 'sa',
    batchId: null,
    type: '研发任务',
    mode: 'ide',
    title: '组件库迁移收尾',
    desc: '收尾旧组件库迁移到 Element Plus 的最后 3 个组件。',
    status: 'ready',
    progress: 0,
    todos: [],
    briefing: {},
  },
  {
    id: 't9',
    wsId: 'sa',
    batchId: null,
    type: '用例',
    mode: 'ide',
    title: '登录态保持兼容性',
    desc: '验证 SSO 登录态在 token 刷新 / 跨标签页同步时的兼容性。',
    status: 'ready',
    progress: 0,
    todos: [],
    briefing: {},
  },
  // ===== platform-bridge 任务（少量）=====
  {
    id: 't10',
    wsId: 'pf',
    batchId: null,
    type: '研发任务',
    mode: 'ide',
    title: '磐石需求双向同步',
    desc: 'Kooky 任务状态变更回写到磐石。',
    status: 'ready',
    progress: 0,
    todos: [],
    briefing: {},
  },
  // ===== 云帆管家同步过来的任务（演示「协作群 → Kode」闭环）=====
  {
    id: 't11',
    wsId: 'kc',
    batchId: null,
    type: '缺陷',
    mode: 'ide',
    title: '订单状态机异常分支处理',
    desc: '处理订单状态机里 5 个异常分支（超时 / 重试失败 / 部分成功等），来自云帆 #YF-1283。',
    status: 'ready',
    progress: 0,
    source: 'yunfan',
    sourceId: 'YF-1283',
    todos: [],
    briefing: {},
  },
  {
    id: 't12',
    wsId: 'kc',
    batchId: null,
    type: '需求',
    mode: 'ide',
    title: '用户中心配置面板重构',
    desc: '用户中心团队空间面板的配置项重构（来自云帆 #YF-1284）。',
    status: 'ready',
    progress: 0,
    source: 'yunfan',
    sourceId: 'YF-1284',
    todos: [],
    briefing: {},
  },
  {
    id: 't13',
    wsId: 'kc',
    batchId: null,
    type: '研发任务',
    title: '埋点字典 v3 接入',
    desc: '将埋点字典 v3 接入业务模块（来自云帆 #YF-1297）。',
    status: 'ready',
    progress: 0,
    source: 'yunfan',
    sourceId: 'YF-1297',
    todos: [],
    briefing: {},
  },
  {
    id: 't14',
    wsId: 'kc',
    batchId: null,
    type: '缺陷',
    title: '列表筛选条件丢失',
    desc: '路由切换后列表筛选条件未保留（来自云帆 #YF-1302）。',
    status: 'ready',
    progress: 0,
    source: 'yunfan',
    sourceId: 'YF-1302',
    todos: [],
    briefing: {},
  },
  {
    id: 't15',
    wsId: 'kc',
    batchId: null,
    type: '用例',
    title: '全链路灰度兼容性回归',
    desc: '验证灰度发布下新老版本接口兼容性（来自云帆 #YF-1311）。',
    status: 'ready',
    progress: 0,
    source: 'yunfan',
    sourceId: 'YF-1311',
    todos: [],
    briefing: {},
  },
]

// ※ 旧的 decomposeTaskTodos / processTaskTodos 已合并到 task.todos 上（同一份数据的两个生命周期）

// 任务产物 = 实际改/新增的业务文件
// change: added | modified | deleted | link
// status: pending | running | done
//
// 拆解态：空数组（UI 用占位文案）
// 处理态：随 CC 执行逐步出现的文件
export const products = {
  decompose: [], // 拆解阶段没有产物，UI 显示占位
  process: [
    {
      id: 'p1',
      icon: '📝',
      kind: 'code',
      path: 'src/views/messages/MessageList.vue',
      change: 'modified',
      status: 'done',
    },
    {
      id: 'p2',
      icon: '📝',
      kind: 'code',
      path: 'src/composables/useVirtualScroller.ts',
      change: 'added',
      status: 'done',
    },
    {
      id: 'p3',
      icon: '📝',
      kind: 'code',
      path: 'src/api/messages.ts',
      change: 'modified',
      status: 'running',
    },
    {
      id: 'p4',
      icon: '🧪',
      kind: 'test',
      path: 'tests/message-list.spec.ts',
      change: 'added',
      status: 'pending',
    },
    {
      id: 'p5',
      icon: '📄',
      kind: 'doc',
      path: 'docs/perf/list-virtualization.md',
      change: 'added',
      status: 'pending',
    },
  ],
}

// 拆解 tab 的输入源（关联文件/任务/链接）
export const decomposeInputs = [
  { id: 'i1', icon: '📋', name: '磐石需求 · 深色模式 PRD', source: '磐石' },
  { id: 'i2', icon: '📁', name: 'src/themes/ · 主题文件夹', source: '本地' },
  { id: 'i3', icon: '🔗', name: '列表分页优化（已完成任务）', source: '关联产物' },
]

// 拆解 tab 群聊消息流（默认演示）
// 消息类型：msg | todo-patch | system
//   msg        = 普通发言（from: 'agent' | 'me' | 数字人 id），可带 attachments
//   todo-patch = 任务助手对 todolist 的修改通知（小卡片，挂在任务助手气泡下方，不占满横屏）
//                字段：by 必为 'agent'；adds[] / removes[] / modifies[]
//                ※ 数字人不会改 todolist；他们只发言，由任务助手听完后自己更新
//   system     = 系统通知（数字人加入 / 离开）
//
// 流程：用户发起（带任务详情 + 附件）→ 任务助手立即拆初稿 → 引导拉数字人 → @ 数字人贡献 → 任务助手吸收 → 补验收 → 准备执行
export const decomposeMessages = [
  // ① 用户发起任务（这是原始数据：prompt + 附件）
  {
    id: 'd1',
    type: 'msg',
    from: 'me',
    ts: '14:19:55',
    attachments: [
      { id: 'a1', icon: '📋', name: 'Kode prompt chip 设计稿.fig' },
      { id: 'a2', icon: '📄', name: 'DecomposeTab.vue（现有代码）' },
      { id: 'a3', icon: '📋', name: 'Kooky 编辑 tab PRD.md' },
    ],
    body: 'Kode 编辑 tab 输入框上方加一行预置 prompt chip，让用户一键 prefill 触发任务助手完善 todolist。',
  },
  // ② 任务助手 ack + 立即拆初稿（todo-patch 紧贴在它下面）
  {
    id: 'd2',
    type: 'msg',
    from: 'agent',
    ts: '14:19:58',
    body: '收到。读完 PRD 和现有 DecomposeTab.vue，我先初步拆了 4 步：',
  },
  {
    id: 'd3',
    type: 'todo-patch',
    by: 'agent',
    ts: '14:19:58',
    adds: [
      '调研现有 chip 类组件设计（ElementPlus / Naive UI）',
      '列出 4-6 个常用 prompt（验收 / 约束 / 拆细 / 测试场景）',
      '实现 chip UI 组件（紫色边框 + hover 上浮）',
      '接入 prefill 逻辑（点击 chip → 填充到输入框）',
    ],
  },
  // ③ 任务助手引导：建议拉数字人
  {
    id: 'd4',
    type: 'msg',
    from: 'agent',
    ts: '14:20:02',
    body: '这个任务涉及 UI 实现 + 状态接入。要不要拉 @老架（架构）或 @老研（研发）一起看看？',
  },
  // ④ 用户 @老架
  {
    id: 'd5',
    type: 'msg',
    from: 'me',
    ts: '14:20:20',
    mentioned: ['laojia'],
    body: '@老架 帮我看下架构',
  },
  // ⑤ 系统：老架加入
  {
    id: 'd6',
    type: 'system',
    ts: '14:20:22',
    body: '老架 已加入对话',
  },
  // ⑥ 老架发言（数字人只发言、不写 todolist）
  {
    id: 'd7',
    type: 'msg',
    from: 'laojia',
    ts: '14:20:26',
    body: 'ElementPlus 2.4 的 hover transition 有 bug，会影响 chip 上浮动效，建议升到 2.5。另外别忘了单测覆盖 prefill 逻辑 + 提 PR，这两个最容易漏。',
  },
  // ⑦ 任务助手听完老架，主动吸收 → 自己更新 todolist
  {
    id: 'd8',
    type: 'msg',
    from: 'agent',
    ts: '14:20:30',
    body: '老架说的对，把这两条补进 todolist：',
  },
  {
    id: 'd9',
    type: 'todo-patch',
    by: 'agent',
    ts: '14:20:30',
    sourceFrom: 'laojia',
    adds: [
      '升级 element-plus 到 2.5.0（修复 hover transition bug）',
      '写单测 + 提交 PR',
    ],
  },
  // ⑧ 用户补验收 + 约束
  {
    id: 'd10',
    type: 'msg',
    from: 'me',
    ts: '14:21:00',
    body: '验收标准：chip hover 上浮 + prefill 工作 + 4 个 prompt 全覆盖 + 单测通过。\n约束：不改 Vue 大版本，不引入新依赖。',
  },
  // ⑨ 任务助手收尾（验收/约束 进 briefing，不在 todolist 里）
  {
    id: 'd11',
    type: 'msg',
    from: 'agent',
    ts: '14:21:02',
    body: '验收标准 + 约束都记下。Todolist 现在共 6 条，可以执行了。还有要补充的吗？',
  },
]


// ─────────────────────────────────────────────────────────────────
// t7「深色模式」处理 tab 执行时间线
// 中度模拟 CC TodoWrite + 工具调用 + thinking + ask-user
//
// 由 useKodeState.executeNow() 触发后，每 3 秒按顺序 push 一条到 dialog
// 直到 ask-user → 暂停（task.status='waiting'）→ 用户决策后恢复
//
// 事件类型：
//   tool       —— CC 工具调用日志（Read / Grep / Edit / Write / Bash / Glob）
//   thinking   —— CC 思考片段（灰色斜体）
//   todo-tick  —— 一条 todo 完成（驱动右侧 todolist + 左侧 task 状态）
//   ask-user   —— 卡住等用户决策（暂停 timeline）
//   cc-text    —— CC 自然语言段落
// ─────────────────────────────────────────────────────────────────
export const t7ProcessTimeline = [
  // ── Step 1: 调研现有 chip 类组件设计 ──
  { type: 'tool', tool: 'Read', target: 'package.json', result: '依赖列表 · element-plus 2.4.4' },
  { type: 'tool', tool: 'Read', target: 'src/modules/kode/components/tabs/DecomposeTab.vue', result: '936 lines' },
  { type: 'tool', tool: 'Grep', target: 'Tag|Chip', scope: 'node_modules/element-plus/es/components', result: '7 matches · 主要在 ElTag' },
  { type: 'thinking', text: 'ElementPlus 的 ElTag 样式偏轻，没有 hover 上浮动效；我们想要更突出的紫色边框 chip + emoji。自造比改 ElTag 更可控。' },
  { type: 'todo-tick', summary: '调研现有 chip 类组件设计' },

  // ── Step 2: 列出常用 prompt ──
  { type: 'thinking', text: '围绕"完善 todolist"这个核心场景，4 类最高频：补验收标准 / 明确边界约束 / 拆得更细 / 补充测试场景。' },
  { type: 'cc-text', text: '初步定 4 个 prompt：🔍 补全验收标准 / 🚫 明确边界约束 / 📋 拆得更细 / 🧪 补充测试场景。如果用得顺手可以再扩。' },
  { type: 'todo-tick', summary: '列出常用 prompt' },

  // ── Step 3: 实现 chip UI 组件 ──
  { type: 'tool', tool: 'Edit', target: 'src/modules/kode/components/tabs/DecomposeTab.vue', result: '+ 24 / − 0（chip 区块 + template）' },
  { type: 'tool', tool: 'Edit', target: 'src/modules/kode/components/tabs/DecomposeTab.vue', result: '+ 38 / − 0（.prompt-chips + hover 动效 style）' },
  { type: 'tool', tool: 'Bash', target: 'npm run lint -- src/modules/kode', result: '✓ 0 errors' },
  { type: 'todo-tick', summary: '实现 chip UI 组件' },

  // ── Step 4: 接入 prefill 逻辑 ──
  { type: 'tool', tool: 'Edit', target: 'src/modules/kode/components/tabs/DecomposeTab.vue', result: '+ 32 / − 0（script: promptChips 数据 + onChipClick 函数）' },
  { type: 'thinking', text: 'prefill 设计成不自动发送，留给用户审/改一下文案再发，避免误触；这也是协作群里更尊重用户控制权的做法。' },
  { type: 'tool', tool: 'Bash', target: 'npm run test:unit -- DecomposeTab', result: '✓ 12 passed' },
  { type: 'todo-tick', summary: '接入 prefill 逻辑' },

  // ── Step 5: 升级 element-plus → ⚠️ 请求执行权限 ──
  { type: 'tool', tool: 'Read', target: 'package.json', result: '当前 element-plus@2.4.4' },
  { type: 'tool', tool: 'Bash', target: 'npm outdated element-plus', result: '2.4.4 → 2.5.0（含 ElButton hover transition 修复）' },
  { type: 'thinking', text: '2.5.0 修复的 hover transition bug 正好影响我们 chip 的 hover 上浮效果。升次要版本，但会改 lockfile，这种敏感操作我先停下来问你。' },
  {
    type: 'ask-user',
    context: '升级 element-plus 到 2.5.0',
    question: '需要执行 npm install element-plus@2.5.0 修复 ElButton hover transition bug。这个命令会修改 package.json + package-lock.json，并下载约 18MB 增量。是否允许执行？',
    options: [
      { id: 'A', label: '✅ 允许执行',          desc: '修改 lockfile + 下载增量包，约 30s 完成' },
      { id: 'B', label: '🚫 拒绝',              desc: '我先用 CSS polyfill 兜住 hover 抖动，不升级' },
      { id: 'wait', label: '让我看看再说',       desc: '暂停 CC，给我 5 分钟看代码' },
    ],
  },

  // ── 用户决策后的事件（demo 默认按 ✅ 允许追加）──
  { type: 'cc-text', text: '收到，已获授权，开始升级。' },
  { type: 'tool', tool: 'Bash', target: 'npm install element-plus@2.5.0', result: '✓ 1 package updated · +18MB · 28s' },
  { type: 'tool', tool: 'Edit', target: 'package.json', result: '+ 1 / − 1（element-plus: 2.4.4 → 2.5.0）' },
  { type: 'tool', tool: 'Bash', target: 'npm run dev -- --no-open', result: '✓ Vite ready 308ms' },
  { type: 'todo-tick', summary: '升级 element-plus 到 2.5.0' },

  // ── Step 6: 写单测 + 提交 PR ──
  { type: 'tool', tool: 'Write', target: 'src/modules/kode/components/tabs/__tests__/DecomposeTab.spec.ts', result: '+ 56 lines · 6 个 case' },
  { type: 'tool', tool: 'Bash', target: 'npm run test', result: '✓ 18 passed（含新增 6 个 chip case）' },
  { type: 'tool', tool: 'Bash', target: 'git diff --stat', result: '3 files changed · +150 / −1' },
  { type: 'tool', tool: 'Bash', target: 'git commit -m "feat(kode): 加快捷 prompt chip 行"', result: '✓ [feature/kode-prompt-chips] abc1234' },
  { type: 'todo-tick', summary: '写单测 + 提交 PR' },

  // ── 收尾 ──
  { type: 'cc-text', text: '✅ 6 项全部完成。4 个 prompt chip 已上线，hover 动效正常；单测 18 passed；PR #142 已提交，等你 review。' },
]


// 处理 tab 的对话流（CC + 用户 bubble）—— 默认空，由 executeNow 注入
export const processDialog = [
  {
    id: 'm1',
    from: 'cc',
    ts: '14:32:01',
    body: [
      { text: '开始处理任务「列表分页优化」' },
      { tool: 'Read', text: ' CLAUDE.md' },
      { tool: 'Read', text: ' src/views/messages/MessageList.vue' },
      { ok: '✓', text: ' 当前实现：分页大小固定 50，无虚拟滚动' },
      { sep: true },
      { tool: 'Generate', text: ' context.md' },
      { ok: '✓', text: ' context.md 写入完成' },
    ],
  },
  {
    id: 'm2',
    from: 'user',
    ts: '14:32:13',
    body: [{ text: '等等，验收标准里加一条 —— 骨架屏在 200ms 内出现，FCP 别只看到内容' }],
  },
  {
    id: 'm3',
    from: 'cc',
    ts: '14:32:14',
    body: [
      { text: '收到，已记下"骨架屏 ≤ 200ms"作为额外验收项' },
      { tool: 'Generate', text: ' goal.md · 含骨架屏要求' },
      { ok: '✓', text: ' goal.md 写入完成' },
    ],
  },
  {
    id: 'm4',
    from: 'cc',
    ts: '14:32:22',
    body: [
      { tool: 'Generate', text: ' proposal.md · 虚拟滚动 + 预取策略' },
      { ok: '✓', text: ' 方案对比 vue-virtual-scroller / @tanstack/virtual' },
      { ok: '✓', text: ' proposal.md 写入完成' },
      { sep: true },
      { tool: 'Generate', text: ' plan.md · 执行计划' },
      { text: '分析现有组件结构 ...' },
      { text: '评估虚拟滚动接入路径 ...' },
      { warn: '⚠', text: ' 检测到 useInfiniteScroll hook 已废弃，需迁移' },
      { text: '拆解步骤 ...' },
      { cursor: true },
    ],
  },
]

// 拆解阶段的完成度校验项
// 硬必备 (required)：不满足，主行动按钮置灰
// 软质量 (suggest)：影响完成度环，不卡流程
export const completionChecks = [
  { id: 'desc', label: '任务描述', required: true, ok: true },
  { id: 'todo', label: 'Todolist', required: true, ok: true },
  { id: 'criteria', label: '验收标准', required: false, ok: false, tip: '在目标里写一句"做完了能怎么验证"' },
  { id: 'inputs', label: '输入源', required: false, ok: true },
  { id: 'humans', label: '数字人参与', required: false, ok: true },
  { id: 'constraints', label: '风险/约束声明', required: false, ok: false, tip: '告诉 CC 哪些不能改 / 必须保留的依赖' },
]

// 每个 workspace 下的 mock 文件清单
// 给 TeamFilePanel 的 Kode 分类用 —— 二级目录 = workspace，三级 = 实际文件
// 纯展示，不真访问磁盘
export const workspaceFiles = {
  kc: [
    { icon: '📁', path: 'src/' },
    { icon: '📁', path: 'src/views/' },
    { icon: '📁', path: 'src/composables/' },
    { icon: '📄', path: 'package.json' },
    { icon: '📄', path: 'CLAUDE.md' },
    { icon: '📄', path: 'README.md' },
    { icon: '⚙️', path: 'vite.config.ts' },
    { icon: '🧪', path: 'tests/' },
  ],
  sa: [
    { icon: '📁', path: 'src/themes/' },
    { icon: '📁', path: 'src/components/' },
    { icon: '📁', path: 'src/composables/' },
    { icon: '📄', path: 'src/composables/useTheme.ts' },
    { icon: '📄', path: 'package.json' },
    { icon: '📄', path: 'CLAUDE.md' },
    { icon: '⚙️', path: 'vite.config.ts' },
  ],
  pf: [
    { icon: '📁', path: 'src/bridge/' },
    { icon: '📁', path: 'src/services/' },
    { icon: '📄', path: 'src/bridge/panshi.ts' },
    { icon: '📄', path: 'package.json' },
    { icon: '📄', path: 'README.md' },
  ],
}
