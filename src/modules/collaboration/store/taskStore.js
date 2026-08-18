/**
 * 协作任务 Store · Sprint 1.5 版（完整状态机）
 *
 * 复用 live-demo.html 已定的全套行为：
 *   - 9 动作：done / submit / skip_self / skip_step / back / abort / confirm_abort / edit / unrelated
 *   - 多人步骤：默认全员响应；投票多数封板
 *   - 并行步骤：parallel_group 同时激活
 *   - 二次确认终止 + pendingAbort
 *   - 上限 3 个 active
 *
 * 数据模型：
 *   Task = { id, conversationId, title, emoji, status, createdAt, createdBy, goal,
 *            steps, currentStepIndex }
 *   Step = { id, name, desc, assignees, submit_type, vote_options?, deadline?,
 *            parallel_group?, status, completed_by[], skipped_by[], submissions[],
 *            activatedAt, completedAt }
 *   step.status: pending | active | done | skipped | overdue | canceled
 *   task.status: in_progress | completed | aborted
 */

import { defineStore } from 'pinia'
import { decomposeGoal, interpretMessage } from '../services/aiBridge'

const HARD_LIMIT_PER_GROUP = 3
const SUBMIT_TYPE_LABEL = { confirm: '确认', text: '文本', file: '文件', vote: '投票' }
const SUBMIT_TYPE_ICON = { confirm: '✅', text: '📝', file: '📎', vote: '🗳️' }
const SUBMIT_TYPE_VERB = { confirm: '确认完成', text: '提供信息', file: '上传文件', vote: '投票' }

function makeTaskId() { return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function makeStepId() { return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function nowMs() { return Date.now() }

function collectInstructionFragments(text, verbs) {
  const verbPattern = verbs.join('|')
  const pattern = new RegExp(`(?:${verbPattern})\\s*[「“"]?([^，。；,;\\n]{2,20}?)[」”"]?(?:步骤|环节)(?=[，。；,;\\n]|$)`, 'g')
  return [...String(text || '').matchAll(pattern)].map((match) => String(match[1] || '').trim()).filter(Boolean)
}

/** 将一份已归档流程重置为新流程，并对常见自然语言改动做本地 mock 解析。 */
function buildRestartedSteps(sourceTask, instruction, createdBy) {
  const originalSteps = Array.isArray(sourceTask?.steps) ? sourceTask.steps : []
  let steps = originalSteps.map((sourceStep) => ({
    id: makeStepId(),
    name: sourceStep.name,
    desc: sourceStep.desc || '',
    assignees: Array.isArray(sourceStep.assignees) && sourceStep.assignees.length
      ? sourceStep.assignees.slice()
      : [createdBy].filter(Boolean),
    submit_type: sourceStep.submit_type || 'confirm',
    vote_options: Array.isArray(sourceStep.vote_options) ? sourceStep.vote_options.slice() : [],
    deadline: sourceStep.deadline || null,
    parallel_group: sourceStep.parallel_group || null,
    status: 'pending',
    completed_by: [],
    skipped_by: [],
    submissions: [],
    activatedAt: null,
    completedAt: null,
  }))

  const changes = []
  const text = String(instruction || '').trim()
  const assigneeMatch = text.match(/(?:负责人|执行人)(?:统一)?(?:改为|换成|调整为)\s*[「“"]?([一-龥A-Za-z0-9_-]{2,12})/)
  if (assigneeMatch?.[1]) {
    const assignee = assigneeMatch[1]
    steps.forEach((taskStep) => { taskStep.assignees = [assignee] })
    changes.push(`执行人改为${assignee}`)
  }

  const removeNames = collectInstructionFragments(text, ['去掉', '删除', '移除'])
  removeNames.forEach((keyword) => {
    const next = steps.filter((taskStep) => !String(taskStep.name || '').includes(keyword))
    if (next.length > 0 && next.length < steps.length) {
      steps = next
      changes.push(`移除「${keyword}」步骤`)
    }
  })

  const addNames = collectInstructionFragments(text, ['增加', '新增', '补充'])
  addNames.forEach((name) => {
    steps.push({
      id: makeStepId(),
      name,
      desc: `根据本次描述新增：${text}`,
      assignees: assigneeMatch?.[1] ? [assigneeMatch[1]] : [createdBy].filter(Boolean),
      submit_type: 'confirm',
      vote_options: [],
      deadline: null,
      parallel_group: null,
      status: 'pending',
      completed_by: [],
      skipped_by: [],
      submissions: [],
      activatedAt: null,
      completedAt: null,
    })
    changes.push(`新增「${name}」步骤`)
  })

  const deadlineMatch = text.match(/(?:截止时间改为|延期到|改到)\s*([^，。；,;\\n]+)/)
  if (deadlineMatch?.[1]) {
    const deadline = deadlineMatch[1].trim()
    steps.forEach((taskStep) => { taskStep.deadline = deadline })
    changes.push(`截止时间改为${deadline}`)
  }

  return { steps, changes }
}

/** 多人步骤的有效响应人数 = done + skip_self 的并集 */
function stepEffectiveCompleted(step) {
  return new Set([...(step.completed_by || []), ...(step.skipped_by || [])]).size
}

/** 步骤是否已完成（投票多数封板特殊处理） */
function stepIsFullyComplete(step) {
  if (step.submit_type === 'vote' && (step.assignees || []).length > 0) {
    const counts = {}
    ;(step.submissions || []).forEach((s) => {
      counts[s.content] = (counts[s.content] || 0) + 1
    })
    const majority = Math.floor(step.assignees.length / 2) + 1
    if (Object.values(counts).some((c) => c >= majority)) return true
  }
  return stepEffectiveCompleted(step) >= (step.assignees || []).length
}

/** 找下一批可激活的步骤（按 parallel_group 处理） */
function findNextActivatable(task) {
  const steps = task.steps || []
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.status !== 'pending') continue
    const allPrevDone = steps.slice(0, i).every((p) => p.status === 'done' || p.status === 'skipped')
    if (!allPrevDone) continue
    if (s.parallel_group) {
      return steps.filter((x) => x.status === 'pending' && x.parallel_group === s.parallel_group)
    }
    return [s]
  }
  return []
}

export const useCollabTaskStore = defineStore('collaboration-task', {
  state: () => ({
    tasks: {},                       // taskId → Task
    activeTaskByGroup: {},           // cid → 当前选中的 taskId
    detailPanelOpenByGroup: {},      // cid → bool
    decomposingByGroup: {},          // cid → bool（拆解中高光态）
    pendingAbortByTask: {},          // taskId → bool（二次确认终止）
    workflowReferenceByGroup: {},    // cid → 待在输入框引用的已归档 taskId
    taskListPanelOpen: true,
    lastError: null,
  }),

  getters: {
    tasksByGroup: (state) => (cid) =>
      Object.values(state.tasks).filter((t) => String(t.conversationId) === String(cid)),
    activeTasksByGroup() {
      return (cid) => this.tasksByGroup(cid).filter((t) => t.status === 'in_progress')
    },
    canCreateMoreTask() {
      return (cid) => this.activeTasksByGroup(cid).length < HARD_LIMIT_PER_GROUP
    },
    allTasks: (state) => Object.values(state.tasks),
    activeTasksAll() { return this.allTasks.filter((t) => t.status === 'in_progress') },
    archivedTasksAll() {
      return this.allTasks.filter((t) => ['completed', 'aborted'].includes(t.status))
    },
    currentTaskByGroup() {
      return (cid) => {
        const id = this.activeTaskByGroup[cid]
        const task = id ? this.tasks[id] : null
        return task && String(task.conversationId) === String(cid) ? task : null
      }
    },
    workflowReferenceForGroup() {
      return (cid) => {
        const id = this.workflowReferenceByGroup[cid]
        const task = id ? this.tasks[id] : null
        if (!task || String(task.conversationId) !== String(cid)) return null
        return ['completed', 'aborted'].includes(task.status) ? task : null
      }
    },
    isDecomposing: (state) => (cid) => !!state.decomposingByGroup[cid],
    /** 步骤的当前响应进度 X/Y 字符串 */
    stepProgressLabel: () => (step) => {
      const done = stepEffectiveCompleted(step)
      const total = (step.assignees || []).length
      return total > 0 ? `${done}/${total}` : ''
    },
  },

  actions: {
    // ────────────────────────────────────────────
    // 创建 / 拆解
    // ────────────────────────────────────────────

    async createTask({ conversationId, goal, members = [], createdBy = '' }) {
      if (!this.canCreateMoreTask(conversationId)) {
        const err = new Error(`同时进行中任务已达上限（${HARD_LIMIT_PER_GROUP} 个）`)
        this.lastError = err.message
        throw err
      }
      this.decomposingByGroup[conversationId] = true
      this.lastError = null
      try {
        const result = await decomposeGoal(goal, members)
        const taskId = makeTaskId()
        const steps = (result.steps || []).map((s) => ({
          id: s.id || makeStepId(),
          name: s.name,
          desc: s.desc,
          assignees: Array.isArray(s.assignees) ? s.assignees : [],
          submit_type: s.submit_type || 'confirm',
          vote_options: s.vote_options || [],
          deadline: s.deadline || null,
          parallel_group: s.parallel_group || null,
          status: 'pending',
          completed_by: [],
          skipped_by: [],
          submissions: [],
          activatedAt: null,
          completedAt: null,
        }))
        // 兜底：若有步骤没合法 assignee 用 createdBy
        steps.forEach((s) => {
          if (s.assignees.length === 0) s.assignees = [createdBy].filter(Boolean)
        })
        const task = {
          id: taskId,
          conversationId,
          title: result.title || '未命名任务',
          emoji: result.emoji || '📋',
          status: 'in_progress',
          createdAt: nowMs(),
          createdBy,
          goal,
          steps,
          finishedAt: null,
        }
        this.tasks[taskId] = task
        this.activeTaskByGroup[conversationId] = taskId
        // 激活第一批步骤
        const activated = this._activateNextSteps(task)
        return { task, activated }
      } catch (e) {
        this.lastError = e.message || String(e)
        throw e
      } finally {
        this.decomposingByGroup[conversationId] = false
      }
    },

    /**
     * 从项目事项确定性创建协作任务。
     * 这是原型专用的稳定路径：不请求 3939 拆解服务，但仍生成完整 Task/Step 契约。
     */
    createTaskFromMatter({ conversationId, matter = {}, instruction = '', createdBy = '' }) {
      const matterId = String(matter?.id || matter?.matterId || '')
      if (!conversationId || !matterId) throw new Error('事项信息不完整')

      const existing = this.tasksByGroup(conversationId).find((task) => (
        String(task.matterId || task.sourceMatterId || '') === matterId
        && task.status === 'in_progress'
      ))
      if (existing) {
        this.activeTaskByGroup[conversationId] = existing.id
        return {
          task: existing,
          activated: (existing.steps || []).filter((step) => step.status === 'active'),
        }
      }
      if (!this.canCreateMoreTask(conversationId)) {
        throw new Error(`同时进行中任务已达上限（${HARD_LIMIT_PER_GROUP} 个）`)
      }

      const owner = String(matter.owner || createdBy || '待指定')
      const deadline = matter.deadlineAt || matter.deadline || null
      const stepDefinitions = [
        ['确认事项范围与完成标准', `核对「${matter.title || '当前事项'}」的目标、边界和预期结果`],
        ['制定推进计划并同步分工', '明确执行顺序、责任人和关键检查点'],
        ['完成事项交付', matter.description || '按事项说明完成交付并同步进展'],
        ['验收结果并关闭事项', '确认结果符合预期，完成事项收口'],
      ]
      const steps = stepDefinitions.map(([name, desc], index) => ({
        id: makeStepId(),
        name,
        desc,
        assignees: [owner],
        submit_type: 'confirm',
        vote_options: [],
        deadline: index === stepDefinitions.length - 1 ? deadline : null,
        parallel_group: null,
        status: 'pending',
        completed_by: [],
        skipped_by: [],
        submissions: [],
        activatedAt: null,
        completedAt: null,
      }))
      const normalizedInstruction = String(instruction || '').trim()
      const taskId = makeTaskId()
      const task = {
        id: taskId,
        conversationId,
        title: matter.title || '未命名事项',
        emoji: '🗂',
        status: 'in_progress',
        createdAt: nowMs(),
        createdBy,
        goal: [matter.description, normalizedInstruction].filter(Boolean).join('\n') || matter.title || '推进事项',
        steps,
        finishedAt: null,
        matterId,
        sourceMatterId: matterId,
        source: { type: 'matter', id: matterId },
      }
      this.tasks[taskId] = task
      this.activeTaskByGroup[conversationId] = taskId
      const activated = this._activateNextSteps(task)
      return { task, activated }
    },

    /** 把归档任务放进当前群输入框，原归档记录保持不变。 */
    setWorkflowReference(conversationId, taskId) {
      const task = this.tasks[taskId]
      if (!task || String(task.conversationId) !== String(conversationId)) return false
      if (!['completed', 'aborted'].includes(task.status)) return false
      this.workflowReferenceByGroup[conversationId] = taskId
      return true
    },

    clearWorkflowReference(conversationId) {
      delete this.workflowReferenceByGroup[conversationId]
    },

    /**
     * 根据用户描述复制并重启已归档工作流。
     * task.status 仍只使用 in_progress / completed / aborted，不引入新状态。
     */
    restartTaskFromReference({ conversationId, sourceTaskId, instruction, createdBy = '' }) {
      const sourceTask = this.tasks[sourceTaskId]
      if (!sourceTask || String(sourceTask.conversationId) !== String(conversationId)) {
        throw new Error('引用的工作流不属于当前群')
      }
      if (!['completed', 'aborted'].includes(sourceTask.status)) {
        throw new Error('只能重新开启已归档的工作流')
      }
      const normalizedInstruction = String(instruction || '').trim()
      if (!normalizedInstruction) throw new Error('请先描述这次需要调整的内容')
      if (!this.canCreateMoreTask(conversationId)) {
        throw new Error(`同时进行中任务已达上限（${HARD_LIMIT_PER_GROUP} 个）`)
      }

      const { steps, changes } = buildRestartedSteps(sourceTask, normalizedInstruction, createdBy)
      const taskId = makeTaskId()
      const task = {
        id: taskId,
        conversationId,
        title: sourceTask.title || '未命名任务',
        emoji: sourceTask.emoji || '📋',
        status: 'in_progress',
        createdAt: nowMs(),
        createdBy,
        goal: `${sourceTask.goal || sourceTask.title || ''}\n本次调整：${normalizedInstruction}`.trim(),
        steps,
        finishedAt: null,
        reopenedFromTaskId: sourceTask.id,
        restartInstruction: normalizedInstruction,
        ...(sourceTask.matterId || sourceTask.sourceMatterId ? {
          matterId: sourceTask.matterId || sourceTask.sourceMatterId,
          sourceMatterId: sourceTask.sourceMatterId || sourceTask.matterId,
          source: sourceTask.source || {
            type: 'matter',
            id: sourceTask.matterId || sourceTask.sourceMatterId,
          },
        } : {}),
      }
      this.tasks[taskId] = task
      this.activeTaskByGroup[conversationId] = taskId
      const activated = this._activateNextSteps(task)
      this.clearWorkflowReference(conversationId)
      return { task, activated, changes }
    },

    // ────────────────────────────────────────────
    // 内部：激活下一批 + 任务完成
    // ────────────────────────────────────────────

    _activateNextSteps(task) {
      const next = findNextActivatable(task)
      if (next.length === 0) {
        this._completeTask(task)
        return []
      }
      const ts = nowMs()
      next.forEach((s) => {
        s.status = 'active'
        s.activatedAt = ts
      })
      return next
    },

    _completeTask(task) {
      task.status = 'completed'
      task.finishedAt = nowMs()
    },

    // ────────────────────────────────────────────
    // 9 动作（对应 demo-server interpret 输出）
    // ────────────────────────────────────────────

    /**
     * action: done
     * 个人响应 confirm 步骤完成。如果步骤已收齐响应 → 推进。
     * @returns { kind, doneStep?, activated?, completed? }
     */
    applyDone({ task, speaker, targetStepId }) {
      const step = this._pickTargetStep(task, targetStepId)
        || task.steps.find((s) => s.status === 'active' && s.assignees.includes(speaker))
      if (!step) return { kind: 'noop', reason: '当前没有需要你确认的步骤' }
      if (step.submit_type !== 'confirm') {
        return { kind: 'mismatch', reason: `「${step.name}」是${SUBMIT_TYPE_LABEL[step.submit_type]}类型，需要${SUBMIT_TYPE_VERB[step.submit_type]}` }
      }
      if (!step.completed_by.includes(speaker)) step.completed_by.push(speaker)
      return this._afterStepProgress(task, step)
    },

    applySubmit({ task, speaker, targetStepId, content }) {
      const step = this._pickTargetStep(task, targetStepId)
        || task.steps.find((s) => s.status === 'active' && s.assignees.includes(speaker))
      if (!step) return { kind: 'noop', reason: '当前没有需要提交内容的步骤' }
      if (!step.completed_by.includes(speaker)) step.completed_by.push(speaker)
      step.submissions.push({ by: speaker, content, at: nowMs() })
      return this._afterStepProgress(task, step)
    },

    applySkipSelf({ task, speaker, targetStepId }) {
      const step = this._pickTargetStep(task, targetStepId)
        || task.steps.find((s) => s.status === 'active' && s.assignees.includes(speaker))
      if (!step) return { kind: 'noop', reason: '没找到要跳过的步骤' }
      if (!step.skipped_by.includes(speaker)) step.skipped_by.push(speaker)
      return this._afterStepProgress(task, step)
    },

    applySkipStep({ task, targetStepId }) {
      const step = this._pickTargetStep(task, targetStepId)
        || task.steps.find((s) => s.status === 'active')
      if (!step) return { kind: 'noop', reason: '没找到要跳过的步骤' }
      step.status = 'skipped'
      step.completedAt = nowMs()
      const activated = this._activateNextSteps(task)
      return { kind: 'skipped', skippedStep: step, activated, completed: task.status === 'completed' }
    },

    applyBack({ task, targetStepId }) {
      const target = this._pickTargetStep(task, targetStepId)
      if (!target) return { kind: 'noop', reason: '没找到要回退到的步骤' }
      const idx = task.steps.findIndex((s) => s.id === target.id)
      if (idx < 0) return { kind: 'noop', reason: '步骤不在任务中' }
      // 清空 target 及之后所有步骤的响应/提交
      task.steps.forEach((s, i) => {
        if (i >= idx) {
          s.completed_by = []
          s.skipped_by = []
          s.submissions = []
          s.status = i === idx ? 'active' : 'pending'
          s.activatedAt = i === idx ? nowMs() : null
          s.completedAt = null
        }
      })
      // 重置任务状态为进行中（万一已完成又被回退）
      task.status = 'in_progress'
      task.finishedAt = null
      return { kind: 'back', target }
    },

    applyAbort({ task }) {
      this.pendingAbortByTask[task.id] = true
      return { kind: 'abort-confirm-pending' }
    },

    applyConfirmAbort({ task }) {
      if (!this.pendingAbortByTask[task.id]) return { kind: 'noop', reason: '当前没有待确认的取消操作' }
      delete this.pendingAbortByTask[task.id]
      task.status = 'aborted'
      task.finishedAt = nowMs()
      task.steps.forEach((s) => {
        if (s.status === 'pending' || s.status === 'active') s.status = 'canceled'
      })
      return { kind: 'aborted' }
    },

    applyEdit({ task, targetStepId, field, value }) {
      const step = this._pickTargetStep(task, targetStepId)
        || task.steps.find((s) => s.status === 'active')
      if (!step) return { kind: 'noop', reason: '没找到要编辑的步骤' }
      let ok = false
      switch (field) {
        case 'assignees':
          if (Array.isArray(value)) {
            step.assignees = value.slice()
            ok = step.assignees.length > 0
          } else if (value && typeof value === 'object') {
            if (Array.isArray(value.add)) value.add.forEach((v) => { if (!step.assignees.includes(v)) step.assignees.push(v) })
            if (Array.isArray(value.remove)) step.assignees = step.assignees.filter((a) => !value.remove.includes(a))
            ok = step.assignees.length > 0
          }
          break
        case 'deadline':
          step.deadline = value
          ok = true
          break
        case 'step_type':
          if (['confirm', 'text', 'file', 'vote'].includes(value)) {
            step.submit_type = value
            step.submissions = []
            step.completed_by = []
            ok = true
          }
          break
        case 'vote_options':
          if (Array.isArray(value) && value.length >= 2) {
            step.vote_options = value
            step.submissions = []
            step.completed_by = []
            ok = true
          }
          break
        case 'name':
          step.name = value
          ok = true
          break
        case 'desc':
          step.desc = value
          ok = true
          break
        default:
          ok = false
      }
      return ok ? { kind: 'edited', step, field, value } : { kind: 'noop', reason: '编辑参数不合法' }
    },

    // ────────────────────────────────────────────
    // 内部：步骤进度处理（done 后判断是否推进）
    // ────────────────────────────────────────────

    _afterStepProgress(task, step) {
      if (stepIsFullyComplete(step)) {
        step.status = 'done'
        step.completedAt = nowMs()
        const activated = this._activateNextSteps(task)
        return { kind: 'advanced', doneStep: step, activated, completed: task.status === 'completed' }
      }
      const remain = (step.assignees || []).filter(
        (a) => !step.completed_by.includes(a) && !step.skipped_by.includes(a)
      )
      return { kind: 'progress', step, remain }
    },

    _pickTargetStep(task, targetIdOrName) {
      if (!targetIdOrName) return null
      const t = String(targetIdOrName)
      return task.steps.find((s) => s.id === t) || task.steps.find((s) => s.name === t) || null
    },

    // ────────────────────────────────────────────
    // 高层入口：群里发言 → 选 decompose / interpret
    // ────────────────────────────────────────────

    /**
     * 推进现有任务（调 interpret）
     * @returns {Promise<{ action, result, reply }>}
     */
    async progressTask({ task, text, speaker }) {
      if (!task || task.status !== 'in_progress') {
        return { action: { action: 'unrelated', reply: '当前没有进行中的任务' }, result: { kind: 'noop' }, reply: '' }
      }
      const activeSteps = task.steps.filter((s) => s.status === 'active').map((s) => ({
        id: s.id, name: s.name, submit_type: s.submit_type, assignees: s.assignees,
        completed_by: s.completed_by, skipped_by: s.skipped_by, vote_options: s.vote_options,
      }))
      const ctx = {
        task_title: task.title,
        task_status: task.status,
        all_steps: task.steps.map((s) => ({ id: s.id, name: s.name, status: s.status })),
        active_steps: activeSteps,
        pending_abort_confirmation: !!this.pendingAbortByTask[task.id],
      }
      const action = await interpretMessage(text, speaker, ctx)
      const result = this._dispatchAction({ task, action, speaker })
      return { action, result, reply: action?.reply || '' }
    },

    _dispatchAction({ task, action, speaker }) {
      const a = action?.action || 'unrelated'
      switch (a) {
        case 'done':
          return this.applyDone({ task, speaker, targetStepId: action.target_step })
        case 'submit':
          return this.applySubmit({ task, speaker, targetStepId: action.target_step, content: action.submit_content })
        case 'skip_self':
          return this.applySkipSelf({ task, speaker, targetStepId: action.target_step })
        case 'skip_step':
          return this.applySkipStep({ task, targetStepId: action.target_step })
        case 'back':
          return this.applyBack({ task, targetStepId: action.target_step })
        case 'abort':
          return this.applyAbort({ task })
        case 'confirm_abort':
          return this.applyConfirmAbort({ task })
        case 'edit':
          return this.applyEdit({
            task,
            targetStepId: action.target_step,
            field: action.edit_params?.field,
            value: action.edit_params?.value,
          })
        case 'unrelated':
        default:
          return { kind: 'unrelated' }
      }
    },

    setActiveTask(conversationId, taskId) {
      this.activeTaskByGroup[conversationId] = taskId
    },

    toggleDetailPanel(conversationId, open) {
      if (typeof open === 'boolean') this.detailPanelOpenByGroup[conversationId] = open
      else this.detailPanelOpenByGroup[conversationId] = !this.detailPanelOpenByGroup[conversationId]
    },

    toggleTaskListPanel(open) {
      if (typeof open === 'boolean') this.taskListPanelOpen = open
      else this.taskListPanelOpen = !this.taskListPanelOpen
    },

    reset() {
      this.tasks = {}
      this.activeTaskByGroup = {}
      this.detailPanelOpenByGroup = {}
      this.decomposingByGroup = {}
      this.pendingAbortByTask = {}
      this.workflowReferenceByGroup = {}
      this.lastError = null
    },
  },
})

// 工具函数导出（给组件用）
export const COLLAB_TYPE_LABEL = SUBMIT_TYPE_LABEL
export const COLLAB_TYPE_ICON = SUBMIT_TYPE_ICON
export const COLLAB_TYPE_VERB = SUBMIT_TYPE_VERB
export { stepEffectiveCompleted, stepIsFullyComplete }
