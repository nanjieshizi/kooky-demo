import { defineStore } from 'pinia'

const TASK_SEED = Object.freeze([
  {
    id: 'research',
    title: '调研报告',
    type: '调研',
    goal: '输出 3 家竞品对比和可评审结论',
    owner: '我',
    agent: '产品数字人',
    deadline: '8月20日',
    deliverable: '竞品调研报告 · 在线文档',
    acceptance: '输出 3 家竞品对比和结论，提交可评审报告',
  },
  {
    id: 'prototype',
    title: '绘制原型',
    type: '设计',
    goal: '完成核心路径和关键异常状态的可点击原型',
    owner: '我',
    agent: '设计数字人',
    deadline: '8月21日',
    deliverable: '核心流程原型 · Figma',
    acceptance: '完成核心路径和关键异常状态的可点击原型',
  },
  {
    id: 'review',
    title: '技术方案评估',
    type: '技术评估',
    goal: '明确实现边界、依赖与风险评估',
    owner: '研发数字人',
    agent: '研发数字人',
    deadline: '8月22日',
    deliverable: '技术方案评估 · Markdown',
    acceptance: '给出实现边界、依赖与风险评估',
  },
])

const DEFAULT_TASK_CONSTRAINTS = Object.freeze([
  '交付物必须可访问、可评审，并与任务目标保持一致。',
  '关键结论保留来源，无法验证的信息需要明确标注。',
  '发现阻塞依赖时及时同步，不等待任务临近截止才处理。',
])

function projectKey(conversationId) {
  return String(conversationId || '')
}

function makeTask(task, projectName = '项目一') {
  return {
    ...task,
    contextMessages: [],
    contextConstraints: [...DEFAULT_TASK_CONSTRAINTS],
    confirmed: false,
    submitted: false,
    status: 'draft',
    messages: [
      { id: `task-created-${task.id}`, type: 'system', text: `已从「${projectName}」创建任务对话` },
      { id: `task-context-${task.id}`, type: 'assistant', text: `任务已挂载到项目。请围绕「${task.title}」推进，关键结论会在确认后回填项目。` },
    ],
    backfillDemoStep: 0,
    backfill: null,
  }
}

function attachTaskContext(task, project) {
  if (!task || !project) return task
  const discussion = (project.discussion || []).filter((item) => item.type !== 'system').slice(-6)
  task.contextMessages = discussion.map((item, index) => ({
    id: item.id || `task-context-message-${task.id}-${index}`,
    sender: item.type === 'user' ? '我' : '团队助理',
    text: String(item.text || item.content || '').trim(),
    date: item.date || '2026-08-19',
  })).filter((item) => item.text)
  task.contextConstraints = [...DEFAULT_TASK_CONSTRAINTS]
  return task
}

function makeProject(conversationId, name = '项目一', options = {}) {
  const projectName = String(name || '项目一').trim() || '项目一'
  const goal = String(options.goal || '').trim()
  return {
    id: projectKey(conversationId),
    name: projectName,
    isDemoProject: Boolean(options.isDemoProject),
    isPersonalOnly: Boolean(options.isPersonalOnly),
    // Demo 首屏从「讨论」开始，由发送按钮逐步推进预设内容与任务快照。
    phase: 'discussion',
    activeTaskId: null,
    tasks: [],
    discussion: [],
    snapshot: {
      projectBase: goal || '项目目标：完成任务桥 Demo 主流程，确保任务从协作讨论进入个人执行并可回填项目。',
      trigger: '讨论中 @团队助理 生成分工',
      version: 1,
    },
    backfillDraft: '',
    echoDraft: '',
    echoPublished: false,
  }
}

export const useTaskBridgeStore = defineStore('taskBridge', {
  state: () => ({
    projects: {},
  }),

  getters: {
    projectFor: (state) => (conversationId) => state.projects[projectKey(conversationId)] || null,
    personalTasks: (state) => Object.values(state.projects).flatMap((project) =>
      (project.tasks || [])
        .filter((task) => task.confirmed && task.owner === '我')
        .map((task) => ({ projectId: project.id, projectName: project.name, task })),
    ),
  },

  actions: {
    ensureProject(conversationId, name) {
      const key = projectKey(conversationId)
      if (!key) return null
      if (!this.projects[key]) this.projects[key] = makeProject(key, name)
      if (name && !this.projects[key].name) this.projects[key].name = String(name)
      return this.projects[key]
    },

    createPersonalTask(payload = {}) {
      const title = String(payload.title || '').trim()
      if (!title) return null
      const projectId = String(payload.projectId || '').trim()
      const project = projectId
        ? this.ensureProject(projectId)
        : this.createProject(`personal-task-${Date.now()}`, '个人任务', { isPersonalOnly: true })
      if (!project) return null
      const taskId = `personal-${Date.now()}`
      const task = {
        id: taskId,
        title,
        type: String(payload.type || '研究'),
        priority: String(payload.priority || '中'),
        goal: String(payload.goal || '').trim(),
        owner: '我',
        agent: String(payload.agent || '团队助理'),
        members: Array.isArray(payload.members) ? payload.members.map((member) => ({ ...member })) : [],
        projectBaseVersion: projectId ? Number(payload.projectBaseVersion || project.snapshot.version || 1) : null,
        includedSections: projectId && Array.isArray(payload.includedSections) ? [...payload.includedSections] : [],
        includedChatIds: projectId && Array.isArray(payload.includedChatIds) ? [...payload.includedChatIds] : [],
        contextMessages: projectId && Array.isArray(payload.contextMessages) ? payload.contextMessages.map((item) => ({ ...item })) : [],
        contextConstraints: projectId && Array.isArray(payload.contextConstraints) ? [...payload.contextConstraints] : [...DEFAULT_TASK_CONSTRAINTS],
        deadline: String(payload.dueAt || '未设置'),
        deliverable: String(payload.deliverable || '').trim(),
        acceptance: String(payload.acceptance || '').trim(),
        scope: String(payload.scope || '').trim(),
        confirmed: true,
        submitted: false,
        status: 'in_progress',
        messages: [
          { id: `task-created-${taskId}`, type: 'system', text: project.isPersonalOnly ? '已创建个人任务对话' : `已从「${project.name}」创建任务对话` },
          { id: `task-context-${taskId}`, type: 'assistant', text: project.isPersonalOnly ? `请围绕「${title}」推进，完成后可在个人任务中回填产物。` : `任务已挂载到项目。请围绕「${title}」推进，关键结论会在确认后回填项目。` },
        ],
        backfillDemoStep: 0,
        backfill: null,
      }
      project.tasks.push(task)
      project.phase = project.tasks.every((item) => item.confirmed) ? 'planned' : project.phase
      project.discussion.push(
        { id: `personal-task-user-${taskId}`, type: 'user', text: project.isPersonalOnly ? `我创建了个人任务「${title}」。` : `我创建了任务「${title}」，并将其挂载到当前项目。` },
        { id: `personal-task-assistant-${taskId}`, type: 'assistant', text: project.isPersonalOnly ? '个人任务已创建，对话已准备就绪。' : '任务已创建并加入团队计划，个人任务对话已准备就绪。' },
      )
      return { project, task }
    },

    createProject(conversationId, name, options = {}) {
      const key = projectKey(conversationId)
      if (!key) return null
      this.projects[key] = makeProject(key, name, options)
      return this.projects[key]
    },

    addDiscussion(conversationId, text, type = 'user') {
      const project = this.ensureProject(conversationId)
      if (!project || !String(text || '').trim()) return
      project.discussion.push({ id: `${type}-${Date.now()}`, type, text: String(text).trim() })
    },

    generateAssignments(conversationId) {
      const project = this.ensureProject(conversationId)
      if (!project) return null
      if (project.tasks.length) {
        project.phase = 'draft'
        return project
      }
      project.phase = 'draft'
      project.tasks = TASK_SEED.map((task) => attachTaskContext(makeTask(task, project.name), project))
      project.discussion.push({
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        text: '已识别 3 项可执行工作，并生成任务快照。请核对负责人、截止时间和验收标准后确认加入团队计划。',
      })
      return project
    },

    revealNextAssignment(conversationId) {
      const project = this.ensureProject(conversationId)
      const nextSeed = TASK_SEED[project?.tasks.length || 0]
      if (!project || !nextSeed) return project
      project.tasks.push(attachTaskContext(makeTask(nextSeed, project.name), project))
      if (project.tasks.length === TASK_SEED.length) project.phase = 'draft'
      return project
    },

    confirmAssignments(conversationId) {
      const project = this.ensureProject(conversationId)
      if (!project || project.phase !== 'draft' || project.tasks.length !== TASK_SEED.length) return null
      project.phase = 'planned'
      project.tasks.forEach((task) => { task.status = task.owner === '我' ? 'in_progress' : 'planned' })
      project.discussion.push({
        id: `confirmed-${Date.now()}`,
        type: 'assistant',
        text: '任务分工已确认，已加入团队计划并挂载到当前项目；你的「调研报告」已同步进入个人待办。',
      })
      return project
    },

    confirmTask(conversationId, taskId) {
      const project = this.ensureProject(conversationId)
      const task = project?.tasks.find((item) => item.id === taskId)
      if (!project || !task || task.confirmed) return null
      if (!Array.isArray(task.contextMessages)) task.contextMessages = []
      if (!Array.isArray(task.contextConstraints)) task.contextConstraints = [...DEFAULT_TASK_CONSTRAINTS]
      task.confirmed = true
      task.status = task.owner === '我' ? 'in_progress' : 'planned'
      if (project.tasks.length === TASK_SEED.length && project.tasks.every((item) => item.confirmed)) {
        project.phase = 'planned'
        project.tasks.forEach((item) => { item.status = item.owner === '我' ? 'in_progress' : 'planned' })
        project.discussion.push({
          id: `confirmed-${Date.now()}`,
          type: 'assistant',
          text: '任务分工已全部确认，已加入团队计划并挂载到当前项目；你的「调研报告」已同步进入个人待办。',
        })
      }
      return project
    },

    completePersonalTask(conversationId, taskId) {
      const project = this.ensureProject(conversationId)
      const task = project?.tasks.find((item) => item.id === taskId)
      if (!project || !task) return null
      task.status = 'done'
      project.phase = 'backfill'
      project.backfillDraft = `「${task.title}」已完成：完成竞品资料收集和结构化分析，结论已沉淀到调研报告，可供团队评审和后续原型设计复用。`
      project.echoDraft = '同类调研先明确比较维度，再收集证据；避免先搜资料后找框架，能显著减少返工。'
      project.discussion.push({
        id: `backfill-${Date.now()}`,
        type: 'assistant',
        text: '任务完成。我已根据执行历史起草回填摘要和一条执行回声，等待你确认后再对项目成员发布。',
      })
      return project
    },

    prepareBackfill(conversationId, taskId) {
      const project = this.ensureProject(conversationId)
      const task = project?.tasks.find((item) => item.id === taskId)
      if (!project || !task) return null
      task.status = 'backfill'
      project.phase = 'backfill'
      project.backfillDraft = project.backfillDraft || `「${task.title}」已完成：产物已提交，关键结论和执行过程可供团队评审。`
      project.echoDraft = project.echoDraft || '先明确比较维度，再收集证据并形成结论，能减少后续返工。'
      return project
    },

    publishBackfill(conversationId) {
      const project = this.ensureProject(conversationId)
      if (!project || !project.backfillDraft.trim()) return null
      const task = project.tasks.find((item) => item.id === project.activeTaskId)
        || project.tasks.find((item) => item.status === 'backfill')
      if (task) task.submitted = true
      project.phase = 'published'
      if (!project.discussion.some((item) => item.id === `backfill-user-${task?.id || 'project'}`)) {
        project.discussion.push({
          id: `backfill-user-${task?.id || 'project'}`,
          type: 'user',
          text: '@团队助理@相关人员 文件已回填，请接收',
        })
        project.discussion.push({
          id: `backfill-file-${task?.id || 'project'}`,
          type: 'assistant',
          kind: 'file',
          text: '回填文件已发送，请查收。',
          file: {
            name: `${task?.title || '任务'}-回填.md`,
            type: 'Markdown',
            version: 'v1',
            status: '已提交',
          },
        })
      }
      return project
    },

    publishEcho(conversationId) {
      const project = this.ensureProject(conversationId)
      if (!project || !project.echoDraft.trim()) return null
      project.echoPublished = true
      project.snapshot.version += 1
      project.discussion.push({
        id: `echo-${Date.now()}`,
        type: 'echo',
        text: `执行回声已写入协作背景 v${project.snapshot.version}：${project.echoDraft}`,
      })
      return project
    },

    openTaskConversation(conversationId, taskId) {
      const project = this.ensureProject(conversationId)
      if (!project?.tasks.some((task) => task.id === taskId)) return null
      project.activeTaskId = taskId
      return project
    },

    closeTaskConversation(conversationId) {
      const project = this.ensureProject(conversationId)
      if (project) project.activeTaskId = null
    },
  },
})
