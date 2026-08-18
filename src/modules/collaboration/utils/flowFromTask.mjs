// 适配器：把我们 demo 的 taskStore「task」对象映射成生产 collaboration-flow 组件消费的「标准化 flow」结构。
// 让详情面板能用生产的流程时间线渲染，同时 taskStore 仍是唯一数据源。
// 生产数据契约见 modules/collaboration-flow/utils/{flowStatus,flowNodePayload,flowTime}.mjs。

const STEP_TO_NODE_STATUS = {
  pending: 'pending',
  active: 'in_progress',
  done: 'completed',
  skipped: 'skipped',
  overdue: 'expired',
  canceled: 'cancelled',
}

const TASK_TO_FLOW_STATUS = {
  in_progress: 'in_progress',
  completed: 'completed',
  aborted: 'cancelled',
}

const DONE_LIKE = ['completed', 'skipped', 'cancelled']

function defaultResolveMember(name) {
  return { participantId: name, username: name, name, avatar: '' }
}

// 执行人：assignee 名 → 生产 executor 形状（含 executeStatus / completedAt，供 FlowExecutors 用）。
function buildExecutors(step, resolveMember) {
  const done = new Set([...(step.completed_by || []), ...(step.skipped_by || [])])
  const submittedAt = {}
  for (const s of step.submissions || []) {
    if (s?.by != null) submittedAt[s.by] = s.at
  }
  return (step.assignees || []).map((name) => {
    const member = resolveMember(name) || defaultResolveMember(name)
    const isDone = done.has(name)
    return {
      participantId: member.participantId ?? name,
      username: member.username ?? name,
      name: member.name ?? name,
      avatar: member.avatar ?? '',
      executeStatus: isDone ? 'completed' : 'pending',
      completedAt: isDone ? (submittedAt[name] ?? step.completedAt ?? null) : null,
    }
  })
}

// 投票步骤 → nodeConfig.options + nodeResult.voteSummary/resolution（供 getNodeVoteResult 用）。
function buildVoteParts(step) {
  if (step.submit_type !== 'vote') return { nodeConfig: {}, nodeResult: {} }
  const options = (step.vote_options || []).map((label) => ({ key: label, label }))
  const voteSummary = {}
  for (const opt of options) voteSummary[opt.key] = []
  for (const s of step.submissions || []) {
    const key = typeof s?.content === 'string' ? s.content : null
    if (key != null && voteSummary[key]) voteSummary[key].push(s.by ?? '')
  }
  let resolution = ''
  if (step.status === 'done') {
    let best = ''
    let bestCount = 0
    for (const opt of options) {
      const count = voteSummary[opt.key].length
      if (count > bestCount) {
        bestCount = count
        best = opt.key
      }
    }
    resolution = best
  }
  return { nodeConfig: { options }, nodeResult: { voteSummary, resolution } }
}

function stepToNode(step, order, resolveMember) {
  const { nodeConfig, nodeResult } = buildVoteParts(step)
  return {
    id: step.id,
    nodeKey: step.id,
    nodeOrder: order,
    nodeName: step.name,
    nodeContent: step.desc || '',
    nodeType: step.submit_type === 'vote' ? 'vote' : 'task',
    nodeStatus: STEP_TO_NODE_STATUS[step.status] || 'pending',
    nodeConfig,
    nodeResult,
    executors: buildExecutors(step, resolveMember),
    // 我们 demo 的 deadline 是「周三 18:00」这类人话字符串，非时间戳，置空避免 NaN 倒计时。
    deadline: null,
    deadlineStatus: '',
    activatedAt: step.activatedAt || null,
    completedAt: step.completedAt || null,
    skippedAt: null,
    createdAt: step.activatedAt || null,
    updatedAt: step.completedAt || step.activatedAt || null,
    subNodes: null,
    // 回指原 step，供详情面板的「⚡ 分派到 Kode」按钮判定 + 取数。
    __stepId: step.id,
  }
}

function aggregateParallelStatus(subNodes) {
  if (!subNodes.length) return 'pending'
  if (subNodes.some((n) => n.nodeStatus === 'in_progress')) return 'in_progress'
  if (subNodes.every((n) => DONE_LIKE.includes(n.nodeStatus))) return 'completed'
  if (subNodes.some((n) => ['completed', 'skipped'].includes(n.nodeStatus))) return 'in_progress'
  return 'pending'
}

// 把 task.steps 映射成 flow.nodes：同 parallel_group 的步骤折成一个 parallel_node（subNodes）。
export function flowFromTask(task, { resolveMember } = {}) {
  const resolve = resolveMember || defaultResolveMember
  const steps = Array.isArray(task?.steps) ? task.steps : []
  const nodes = []
  const emittedGroups = new Set()
  let order = 0

  for (const step of steps) {
    const group = step.parallel_group
    if (group) {
      if (emittedGroups.has(group)) continue
      emittedGroups.add(group)
      const subNodes = steps
        .filter((s) => s.parallel_group === group)
        .map((s, i) => stepToNode(s, i, resolve))
      nodes.push({
        id: `pg-${group}`,
        nodeKey: `pg-${group}`,
        nodeOrder: order++,
        nodeName: '并行任务',
        nodeContent: '',
        nodeType: 'parallel_node',
        nodeStatus: aggregateParallelStatus(subNodes),
        nodeConfig: {},
        nodeResult: {},
        executors: [],
        deadline: null,
        deadlineStatus: '',
        activatedAt: null,
        completedAt: null,
        skippedAt: null,
        createdAt: null,
        updatedAt: null,
        subNodes,
      })
    } else {
      nodes.push(stepToNode(step, order++, resolve))
    }
  }

  return {
    id: task?.id,
    flowName: task?.title || '未命名任务',
    flowStatus: TASK_TO_FLOW_STATUS[task?.status] || 'in_progress',
    description: task?.goal || '',
    conversationId: task?.conversationId,
    nodes,
  }
}
