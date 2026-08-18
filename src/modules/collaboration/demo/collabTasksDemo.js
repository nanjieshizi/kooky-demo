/**
 * 协作任务 · demo 种子（仅供看样式，不接真流程）
 *
 * makeDemoTasks(cid) 生成绑定到指定会话/群的 14 个任务，覆盖：
 *   - 2 个进行中（正常 / 逾期）、8 个已完成、4 个已取消
 *   - confirm / vote / file / text 四种提交类型
 *   - done / active / pending 步骤态 + 并行步骤 + 投票封板
 * 供 CollabGroupTasksPanel 在本群无任务时注入，好看列表 + 下钻 flow 详情。
 */

const T0 = 1783000000000 // 固定时间戳，避免依赖 Date.now
const DAY = 24 * 60 * 60 * 1000
const OVERDUE_DEADLINE = '2026-07-03T18:00:00.000+08:00'
const KOOKY_SPECIAL_GROUP_ID = 'mock-group-kooky-special-001'
const BUILTIN_DEMO_GROUP_IDS = new Set([
  'mock-group-kc-pcp-001',
  'mock-group-design-001',
  'mock-group-launch-520-001',
  'mock-group-kooky-special-001',
])

function step(o) {
  return {
    id: o.id,
    name: o.name,
    desc: o.desc || '',
    assignees: o.assignees || [],
    submit_type: o.submit_type || 'confirm',
    vote_options: o.vote_options || [],
    deadline: o.deadline || null,
    parallel_group: o.parallel_group || null,
    status: o.status || 'pending',
    completed_by: o.completed_by || [],
    skipped_by: o.skipped_by || [],
    submissions: o.submissions || [],
    activatedAt: o.activatedAt || null,
    completedAt: o.completedAt || null,
  }
}

const ARCHIVED_DEMO_TASKS = [
  {
    slug: 'release-plan', title: '🚀 9 月版本发布计划', emoji: '🚀', status: 'completed', createdBy: '张月华',
    goal: '明确版本范围、灰度节奏和发布责任人',
    steps: [
      { name: '锁定版本范围', desc: '确认必上和可延后需求' },
      { name: '制定灰度方案', desc: '定义灰度范围与回滚条件', assignee: '王工', type: 'file' },
      { name: '发布确认', desc: '各负责人确认发布窗口', assignee: '孟世一' },
    ],
  },
  {
    slug: 'interview-insights', title: '🎤 核心用户访谈结论', emoji: '🎤', status: 'completed', createdBy: '邓颖茹',
    goal: '完成核心用户访谈并形成优先级结论',
    steps: [
      { name: '招募访谈用户' },
      { name: '执行访谈', desc: '完成访谈和原始纪要', type: 'text' },
      { name: '结论评审', desc: '确认问题优先级', assignee: '孟世一' },
    ],
  },
  {
    slug: 'api-review', title: '🔌 协作任务接口评审', emoji: '🔌', status: 'completed', createdBy: '王工',
    goal: '统一任务创建、推进和状态查询契约',
    steps: [
      { name: '整理接口清单', type: 'file' },
      { name: '确认权限边界', desc: '按群校验任务访问范围', assignee: '孟世一' },
      { name: '封版接口契约' },
    ],
  },
  {
    slug: 'design-handoff', title: '🎨 项目看板视觉交付', emoji: '🎨', status: 'completed', createdBy: '员清亮',
    goal: '完成项目看板的高保真方案与视觉走查',
    steps: [
      { name: '输出高保真方案', type: 'file' },
      { name: '评审交互细节', assignee: '孟世一' },
      { name: '完成视觉走查' },
    ],
  },
  {
    slug: 'regression', title: '🧪 核心链路回归测试', emoji: '🧪', status: 'completed', createdBy: '测试数字人',
    goal: '覆盖建群、创建任务、任务推进与归档链路',
    steps: [
      { name: '整理回归用例', type: 'file' },
      { name: '执行核心链路' },
      { name: '输出测试报告', type: 'file' },
    ],
  },
  {
    slug: 'ops-guide', title: '📘 协作群运营手册', emoji: '📘', status: 'completed', createdBy: '张月华',
    goal: '沉淀项目看板与协作任务使用指引',
    steps: [
      { name: '梳理使用场景', type: 'text' },
      { name: '编写操作指引', type: 'file' },
      { name: '试用验收', assignee: '孟世一' },
    ],
  },
  {
    slug: 'tracking-acceptance', title: '📊 任务状态埋点验收', emoji: '📊', status: 'completed', createdBy: '孟世一',
    goal: '确保创建、完成、取消的统计口径正确',
    steps: [
      { name: '确认埋点字典' },
      { name: '核对上报数据', assignee: '王工', type: 'file' },
      { name: '验收统计口径' },
    ],
  },
  {
    slug: 'legacy-import', title: '📦 历史任务批量导入', emoji: '📦', status: 'aborted', createdBy: '李工',
    goal: '将旧任务数据批量迁移到新流程',
    steps: [
      { name: '盘点历史数据' },
      { name: '设计字段映射', assignee: '王工' },
      { name: '执行批量导入', type: 'file' },
    ],
  },
  {
    slug: 'weekly-digest', title: '📰 项目周报自动汇总', emoji: '📰', status: 'aborted', createdBy: '张月华',
    goal: '每周自动汇总群内项目进展与风险',
    steps: [
      { name: '确认周报口径', type: 'text' },
      { name: '配置定时生成', assignee: '团队助手' },
      { name: '群内验收', assignee: '孟世一' },
    ],
  },
  {
    slug: 'theme-experiment', title: '🌈 群聊主题色 A/B 实验', emoji: '🌈', status: 'aborted', createdBy: '员清亮',
    goal: '比较两套主题色对群聊信息密度的影响',
    steps: [
      { name: '输出两套方案', type: 'file' },
      { name: '组织内部投票', type: 'vote', options: ['方案 A', '方案 B'] },
      { name: '发布实验' },
    ],
  },
  {
    slug: 'notice-refactor', title: '🔔 旧消息提醒规则改造', emoji: '🔔', status: 'aborted', createdBy: '王工',
    goal: '重写旧版消息提醒与免打扰规则',
    steps: [
      { name: '梳理旧规则' },
      { name: '设计兼容方案', type: 'text' },
      { name: '灰度切换', assignee: '孟世一' },
    ],
  },
]

function makeArchivedTasks(cid) {
  return ARCHIVED_DEMO_TASKS.map((definition, taskIndex) => {
    const createdAt = T0 - (20 - taskIndex) * DAY
    const finishedAt = createdAt + 2 * DAY
    const completed = definition.status === 'completed'
    return {
      id: `demo-${cid}-${definition.slug}`,
      conversationId: cid,
      title: definition.title,
      emoji: definition.emoji,
      status: definition.status,
      createdAt,
      createdBy: definition.createdBy,
      goal: definition.goal,
      finishedAt,
      steps: definition.steps.map((item, stepIndex) => {
        const assignee = item.assignee || definition.createdBy
        const done = completed || stepIndex === 0
        return step({
          id: `${definition.slug}-${stepIndex + 1}`,
          name: item.name,
          desc: item.desc,
          assignees: [assignee],
          submit_type: item.type,
          vote_options: item.options,
          status: done ? 'done' : 'canceled',
          completed_by: done ? [assignee] : [],
          completedAt: done ? createdAt + (stepIndex + 1) * 6 * 60 * 60 * 1000 : null,
        })
      }),
    }
  })
}

const KOOKY_TASK_COPY = [
  {
    slug: 'archive-restart', title: '🗂 协作任务归档与再次开启', emoji: '🗂', createdBy: '邓颖茹',
    goal: '区分进行中与已归档任务，并支持引用历史工作流后通过自然语言再次开启',
    steps: [
      { name: '确认归档规则', assignee: '邓颖茹' },
      { name: '评审再次开启方案', assignees: ['孟世一', '邓颖茹', '杨宇龙'], options: ['引用后创建新流程', '原任务原地恢复'] },
      { name: '完成列表与引用交互', assignee: '聂家睿' },
      { name: '完成工作流复制逻辑', assignee: '杨宇龙' },
      { name: '覆盖状态机回归', assignee: '黄燕' },
      { name: '专项群验收', assignee: '邓颖茹' },
    ],
  },
  {
    slug: 'overview-acceptance', title: '⏰ 项目看板与群聊联动验收', emoji: '⏰', createdBy: '邓颖茹',
    goal: '验证人和数字人都能维护项目看板，且操作过程留在群聊上下文中',
    steps: [
      { name: '走查已有项目数据', desc: '核对目标、进展、里程碑与风险', assignee: '邓颖茹' },
      { name: '验证云帆管家群内更新', assignee: '黄燕' },
    ],
  },
  {
    slug: 'secondary-menu', title: '🧭 协作二级菜单统一改造', emoji: '🧭', createdBy: '邓颖茹',
    goal: '统一群聊、私聊和数字人会话的列表视觉与信息层级',
    steps: [{ name: '移植生产列表视觉', assignee: '聂家睿' }, { name: '完成专项走查', assignee: '邓颖茹' }],
  },
  {
    slug: 'project-empty', title: '🎯 项目看板常驻入口与空态', emoji: '🎯', createdBy: '邓颖茹',
    goal: '所有群常驻项目看板入口，无数据时允许成员手动补充项目目标',
    steps: [{ name: '确定入口规则' }, { name: '完成空态高保真', assignee: '聂家睿' }, { name: '交互验收', assignee: '邓颖茹' }],
  },
  {
    slug: 'side-panel', title: '🪟 会话侧区视觉统一', emoji: '🪟', createdBy: '邓颖茹',
    goal: '统一项目看板、任务、文件和群管理侧区的容器与间距',
    steps: [{ name: '核对生产规范' }, { name: '完成侧区改造', assignee: '聂家睿' }, { name: '视觉走查', assignee: '邓颖茹' }],
  },
  {
    slug: 'conversation-files', title: '📁 会话文件侧栏迁移', emoji: '📁', createdBy: '孟世一',
    goal: '把协作群文件能力迁入统一右侧工具栏并保持群级隔离',
    steps: [{ name: '文件列表与搜索' }, { name: '预览与下载', assignee: '聂家睿' }, { name: '群间隔离验收', assignee: '黄燕' }],
  },
  {
    slug: 'chat-background', title: '🔴 群聊红色噪点背景还原', emoji: '🔴', createdBy: '邓颖茹',
    goal: '还原生产协作群底色，并确保私聊和数字人会话不受影响',
    steps: [{ name: '提取生产背景参数' }, { name: '限定群聊生效', assignee: '聂家睿' }, { name: '多会话验收', assignee: '邓颖茹' }],
  },
  {
    slug: 'member-data', title: '👥 群成员与团队助手数据修正', emoji: '👥', createdBy: '黄燕',
    goal: '确保每个 mock 群默认包含团队助手，并使用最新专项成员数据',
    steps: [{ name: '清理离职成员数据' }, { name: '补充专项负责人档案' }, { name: '群成员回归', assignee: '黄燕' }],
  },
  {
    slug: 'project-task-model', title: '🧩 项目与协作任务关系定稿', emoji: '🧩', createdBy: '孟世一',
    goal: '明确一群一项目、任务按群归属，项目看板仅展示任务状态摘要',
    steps: [{ name: '确认一群一项目' }, { name: '确认任务按群归属' }, { name: '评审概览摘要', assignee: '邓颖茹' }],
  },
  {
    slug: 'toolbar', title: '🧰 右侧工具栏顺序与间距统一', emoji: '🧰', createdBy: '邓颖茹',
    goal: '统一项目看板、任务、文件和群管理入口的顺序、状态与间距',
    steps: [{ name: '确认按钮顺序' }, { name: '还原工具栏间距', assignee: '聂家睿' }, { name: '普通群与专项群验收' }],
  },
  {
    slug: 'create-project-group', title: '⛔ 建群时选择项目协作群', emoji: '⛔', createdBy: '邓颖茹',
    goal: '曾计划在建群时暴露项目类型，后决定普通建群优先并取消该方案',
    steps: [{ name: '设计群用途选择' }, { name: '评估普通用户认知成本' }, { name: '取消创建时入口' }],
  },
  {
    slug: 'required-manager', title: '⛔ 项目看板强绑定第三方管家', emoji: '⛔', createdBy: '孟世一',
    goal: '曾计划项目必须选择管家，后改为成员可独立维护、数字人只是普通群成员',
    steps: [{ name: '设计管家选择' }, { name: '验证无第三方场景' }, { name: '取消强绑定方案' }],
  },
  {
    slug: 'builtin-yunfan', title: '⛔ Kooky 直接内置云帆连接器', emoji: '⛔', createdBy: '黄燕',
    goal: '曾讨论由 Kooky 对接云帆，后明确第三方能力统一由数字人的 Skill 承载',
    steps: [{ name: '盘点云帆接口' }, { name: '评估连接器维护成本' }, { name: '转为数字人 Skill 方案' }],
  },
  {
    slug: 'multi-project-group', title: '⛔ 一个群承载多个项目', emoji: '⛔', createdBy: '孟世一',
    goal: '曾讨论群内多项目关联，后明确多个项目应拆分为多个群',
    steps: [{ name: '讨论项目关联模型' }, { name: '评估群聊上下文边界' }, { name: '确认一群一项目' }],
  },
]

function adaptKookyTasks(tasks, cid) {
  return tasks.map((task, taskIndex) => {
    const definition = KOOKY_TASK_COPY[taskIndex]
    if (!definition) return task
    return {
      ...task,
      id: `demo-${cid}-${definition.slug}`,
      title: definition.title,
      emoji: definition.emoji,
      createdBy: definition.createdBy,
      goal: definition.goal,
      steps: task.steps.map((sourceStep, stepIndex) => {
        const copy = definition.steps[stepIndex] || {}
        const assignees = copy.assignees || [copy.assignee || definition.createdBy]
        const submitType = copy.type || sourceStep.submit_type
        const voteOptions = copy.options || sourceStep.vote_options || []
        return {
          ...sourceStep,
          id: `${definition.slug}-${stepIndex + 1}`,
          name: copy.name || sourceStep.name,
          desc: copy.desc || '',
          assignees,
          submit_type: submitType,
          vote_options: voteOptions,
          completed_by: sourceStep.status === 'done' ? assignees : [],
          submissions: submitType === 'vote' && sourceStep.status === 'done' && voteOptions.length
            ? assignees.map((memberId) => ({ memberId, content: voteOptions[0] }))
            : [],
        }
      }),
    }
  })
}

export function makeDemoTasks(cid) {
  const tasks = [
    {
      id: `demo-${cid}-factory`,
      conversationId: cid,
      title: '🏭『工厂』在线调试功能',
      emoji: '🏭',
      status: 'in_progress',
      createdAt: T0,
      createdBy: '孟世一',
      goal: '让工厂支持在线调试，端到端跑通',
      finishedAt: null,
      steps: [
        step({ id: 's1', name: '需求设计', desc: '梳理在线调试的功能边界与交互', assignees: ['孟世一'], submit_type: 'confirm', status: 'done', completed_by: ['孟世一'], completedAt: T0 }),
        step({
          id: 's2', name: '架构方案投票', desc: '沙箱隔离方案二选一', assignees: ['孟世一', '李工', '王工'],
          submit_type: 'vote', vote_options: ['方案A · 独立沙箱', '方案B · 共享运行时'], status: 'done',
          submissions: [
            { memberId: '孟世一', content: '方案A · 独立沙箱' },
            { memberId: '李工', content: '方案A · 独立沙箱' },
            { memberId: '王工', content: '方案B · 共享运行时' },
          ],
          completedAt: T0,
        }),
        step({ id: 's3a', name: '前端开发', desc: '调试面板 UI', assignees: ['李工'], submit_type: 'confirm', status: 'active', parallel_group: 'dev', activatedAt: T0 }),
        step({ id: 's3b', name: '后端开发', desc: '调试会话网关', assignees: ['王工'], submit_type: 'confirm', status: 'active', parallel_group: 'dev', activatedAt: T0 }),
        step({ id: 's4', name: '联调测试', desc: '提交测试报告', assignees: ['孟世一'], submit_type: 'file', status: 'pending' }),
        step({ id: 's5', name: '上线', assignees: ['孟世一'], submit_type: 'confirm', status: 'pending' }),
      ],
    },
    {
      id: `demo-${cid}-survey`,
      conversationId: cid,
      title: '📝 用户调研问卷',
      emoji: '📝',
      status: 'in_progress',
      createdAt: T0,
      createdBy: '孟世一',
      goal: '设计并回收一轮用户调研',
      finishedAt: null,
      deadlineStatus: 'overdue',
      steps: [
        step({ id: 'q1', name: '问卷设计', desc: '输出问卷结论文本', assignees: ['孟世一'], submit_type: 'text', deadline: OVERDUE_DEADLINE, status: 'active', activatedAt: T0 }),
        step({ id: 'q2', name: '回收分析', desc: '上传分析报告', assignees: ['李工'], submit_type: 'file', status: 'pending' }),
      ],
    },
    {
      id: `demo-${cid}-dashboard`,
      conversationId: cid,
      title: '📊 Q3 数据看板',
      emoji: '📊',
      status: 'completed',
      createdAt: T0,
      createdBy: '孟世一',
      goal: '搭好 Q3 数据看板',
      finishedAt: T0,
      steps: [
        step({ id: 'd1', name: '指标梳理', assignees: ['孟世一'], submit_type: 'confirm', status: 'done', completed_by: ['孟世一'], completedAt: T0 }),
        step({ id: 'd2', name: '看板搭建', assignees: ['李工'], submit_type: 'confirm', status: 'done', completed_by: ['李工'], completedAt: T0 }),
      ],
    },
    ...makeArchivedTasks(cid),
  ]
  return cid === KOOKY_SPECIAL_GROUP_ID ? adaptKookyTasks(tasks, cid) : tasks
}

/**
 * 仅给本地 mock/demo 群补视觉演示数据。项目看板和任务面板共用这一个入口，
 * 避免“概览显示 0 条，点进任务突然出现演示数据”的跳变。
 */
export function ensureDemoTasksForGroup(taskStore, cid) {
  const conversationId = String(cid || '')
  if (!import.meta.env.DEV || !BUILTIN_DEMO_GROUP_IDS.has(conversationId)) return []
  if (!taskStore?.tasksByGroup || taskStore.tasksByGroup(conversationId).length > 0) return []

  const tasks = makeDemoTasks(conversationId)
  tasks.forEach((task) => {
    taskStore.tasks[task.id] = task
  })
  return tasks
}
