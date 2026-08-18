import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import teamAssistantAvatar from '@/assets/soloTeam/team-head.svg'
import userAvatarFallback from '@/assets/default-avatar.svg'
import {
  fetchKookyOnePersonTeamHome,
  fetchKookyOnePersonTeamMessages,
  fetchKookyOnePersonTaskSidebar,
  fetchKookyOnePersonTeamTasks,
  sendKookyOnePersonTeamMessage,
} from '../services/onePersonTeamRuntimeApi'
import {
  buildOnePersonUploadArtifactUrl,
  resolveOnePersonArtifactUrl,
  toAbsoluteOnePersonMediaUrl,
  onePersonTeamAttachmentApi,
} from '../services/onePersonTeamAttachmentApi'
import { onePersonTeamStreamClient } from '../services/onePersonTeamStreamClient'
import { resolveEmployeePresence } from '../utils/employeePresence'

let onePersonTaskSidebarRefreshTimer = null
const onePersonTeamEventReconnectTimers = new Map()
const onePersonTeamEventSubscriptions = new Set()
const onePersonThreadSyncTimers = new Map()
const onePersonThinkingSettleTimers = new Map()

export function createDefaultOnePersonTasks() {
  return [
    {
      id: 'intro',
      icon: '📋',
      title: '新人介绍',
      status: 'active',
      preview: '欢迎大家这里是新人介绍专区，给你一个更正式的空间介绍自己',
      goal: '完成团队成员相互介绍，沉淀每位数字员工的职责与擅长',
      participants: [
        { id: 'assistant', name: '我的分身', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-intro',
      executionThreadId: 'task-intro',
    },
    {
      id: 'travel',
      icon: '🚚',
      title: '上海到北京到哈尔滨到到...',
      status: 'active',
      preview: '正在整理路线、交通时间和预算方案',
      goal: '产出覆盖路线、交通时长与预算的完整行程方案',
      participants: [
        { id: 'asset', name: '资产数字人', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-travel',
      executionThreadId: 'task-travel',
    },
    {
      id: 'prd',
      icon: '📋',
      title: '帮我生成一个爬虫prd',
      status: 'active',
      preview: '产品经理正在拆 PRD 结构',
      goal: '输出一份可评审的爬虫 PRD，含目标网站、字段范围与采集策略',
      participants: [
        { id: 'pm', name: '产品经理', avatar: defaultAgentAvatar },
        { id: 'fe', name: '全栈开发', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-prd',
      executionThreadId: 'task-prd',
    },
    {
      id: 'poster',
      icon: '🎨',
      title: '生成一张促销海报',
      status: 'completed',
      preview: '海报方案已完成，可在文件里查看',
      goal: '交付一张促销主视觉海报，含多尺寸导出件，风格符合活动调性',
      participants: [
        { id: 'design', name: '设计师', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-poster',
      executionThreadId: 'task-poster',
    },
    {
      id: 'crawl',
      icon: '🧩',
      title: '帮我生成一个爬虫prd',
      status: 'blocked',
      preview: '等待补充目标网站和字段范围',
      goal: '补齐目标网站与字段范围后，产出爬虫 PRD',
      participants: [
        { id: 'pm', name: '产品经理', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-crawl',
      executionThreadId: 'task-crawl',
    },
    {
      id: 'failed-route',
      icon: '☁️',
      title: '上海到北京到哈尔滨',
      status: 'failed',
      preview: '任务失败，请稍后重试',
      goal: '生成上海→北京→哈尔滨的可执行行程方案',
      participants: [
        { id: 'asset', name: '资产数字人', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-failed-route',
      executionThreadId: 'task-failed-route',
    },
    {
      id: 'waiting-route',
      icon: '⏳',
      title: '上海到北京到哈尔滨',
      status: 'waiting_approval',
      preview: '需要确认是否继续调用外部行程工具',
      goal: '确认是否调用外部行程工具后，完成行程方案',
      participants: [
        { id: 'asset', name: '资产数字人', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-waiting-route',
      executionThreadId: 'task-waiting-route',
    },
    {
      id: 'idea-route',
      icon: '☁️',
      title: '上海到北京到哈尔滨',
      status: 'active',
      preview: '正在补充备选方案',
      goal: '补充备选方案，输出多套行程对比',
      participants: [
        { id: 'asset', name: '资产数字人', avatar: defaultAgentAvatar },
      ],
      threadId: 'task-idea-route',
      executionThreadId: 'task-idea-route',
    },
  ]
}

function defaultMembers() {
  return [
    { id: 'assistant-member-1', name: '产品经理', avatar: defaultAgentAvatar, description: '协助梳理需求、撰写产品文档' },
    { id: 'assistant-member-2', name: '设计师', avatar: defaultAgentAvatar, description: '协助设计方案和视觉表达' },
    { id: 'assistant-member-3', name: '资产数字人', avatar: defaultAgentAvatar, description: '协助资料整理、文件产出和盘点' },
  ]
}

function buildMemberMapFromList(members = []) {
  const map = new Map()
  for (const member of members || []) {
    const id = member?.id ?? member?.agent_id ?? member?.agentId
    if (id == null) continue
    map.set(String(id), normalizeOnePersonMember(member))
  }
  return map
}

function buildMemberMap(privateAgents = []) {
  const map = new Map()
  for (const agent of privateAgents || []) {
    if (agent?.id != null) {
      map.set(String(agent.id), {
        id: String(agent.id),
        agentId: String(agent.id),
        name: agent.name || `数字员工 ${agent.id}`,
        avatar: agent.avatar || agent.icon || defaultAgentAvatar,
        description: agent.description || '数字员工',
        presence: resolveEmployeePresence(agent, 'idle'),
      })
    }
  }
  return map
}

function resolveTeamMemberIds(team) {
  if (Array.isArray(team?.memberIds) && team.memberIds.length) return team.memberIds
  const members = Array.isArray(team?.members) ? team.members : []
  return members.map(m => m?.agent_id ?? m?.agentId).filter(id => id != null)
}

function readCoordinatorAgentId(team) {
  return team?.coordinator_agent_id
    ?? team?.coordinatorAgentId
    ?? team?.coordinator_id
    ?? team?.coordinatorId
    ?? team?.raw?.coordinator_agent_id
    ?? team?.raw?.coordinatorAgentId
    ?? team?.raw?.coordinator_id
    ?? team?.raw?.coordinatorId
    ?? null
}

function isCoordinatorMember(member, team = null) {
  const role = String(member?.role || member?.raw?.role || '').toLowerCase()
  if (role === 'coordinator') return true
  const coordinatorId = readCoordinatorAgentId(team)
  const agentId = member?.agentId ?? member?.agent_id ?? member?.id
  return coordinatorId != null && agentId != null && String(agentId) === String(coordinatorId)
}

function isActiveMember(member) {
  const status = String(member?.status || member?.raw?.status || 'active').toLowerCase()
  return !status || status === 'active'
}

function limitResolvedMembers(members, limit) {
  if (!Number.isFinite(limit)) return members
  return members.slice(0, limit)
}

function mergePrivateAgentMeta(member, memberIndex) {
  const meta = memberIndex.get(String(member.agentId || member.id))
  if (!meta) return member
  const hasRealName = member.name && member.name !== '数字员工'
  const hasRealAvatar = member.avatar && member.avatar !== defaultAgentAvatar
  const hasRealDescription = member.description && !['数字员工', member.role].includes(member.description)
  return {
    ...meta,
    ...member,
    name: hasRealName ? member.name : meta.name,
    avatar: hasRealAvatar ? member.avatar : meta.avatar,
    description: hasRealDescription ? member.description : meta.description,
  }
}

function resolveDisplayMembers(team, privateAgents, homeMembers = [], limit = 6) {
  const memberIndex = buildMemberMap(privateAgents)
  const normalizedHomeMembers = (homeMembers || []).map(normalizeOnePersonMember).filter(member => member.id)
  if (normalizedHomeMembers.length) {
    return limitResolvedMembers(normalizedHomeMembers.map(member => mergePrivateAgentMeta(member, memberIndex)), limit)
  }

  const list = resolveTeamMemberIds(team)
    .map(id => memberIndex.get(String(id)))
    .filter(Boolean)
  return list.length ? limitResolvedMembers(list, limit) : limitResolvedMembers(defaultMembers(), limit)
}

function resolveMentionMembers(team, privateAgents, homeMembers = []) {
  const memberIndex = buildMemberMap(privateAgents)
  const normalizedHomeMembers = (homeMembers || []).map(normalizeOnePersonMember).filter(member => member.id)
  const sourceMembers = normalizedHomeMembers.length
    ? normalizedHomeMembers.map(member => mergePrivateAgentMeta(member, memberIndex))
    : resolveTeamMemberIds(team)
      .map(id => memberIndex.get(String(id)) || normalizeOnePersonMember({ agent_id: id }))
      .filter(member => member?.id)

  return sourceMembers
    .filter(member => !isCoordinatorMember(member, team))
    .filter(isActiveMember)
}

function normalizeOnePersonMember(member) {
  const id = member?.agent_id ?? member?.agentId ?? member?.id
  return {
    id: id == null ? '' : String(id),
    agentId: id == null ? '' : String(id),
    name: member?.name || member?.display_name || member?.displayName || member?.agent_name || '数字员工',
    avatar: member?.avatar_url || member?.avatarUrl || member?.avatar || member?.icon || defaultAgentAvatar,
    description: member?.description || member?.role || '数字员工',
    role: member?.role || 'member',
    presence: resolveEmployeePresence(member, 'idle'),
    raw: member,
  }
}

function normalizeTaskStatus(status) {
  const value = String(status || 'active')
  if (value === 'running' || value === 'open') return 'active'
  if (value === 'waiting' || value === 'pending_approval') return 'waiting_approval'
  return value
}

function taskIconByStatus(status) {
  if (status === 'completed') return '🎨'
  if (status === 'failed') return '☁️'
  if (status === 'waiting_approval') return '⏳'
  if (status === 'blocked') return '🧩'
  return '📋'
}

function pushUniqueId(list, value) {
  if (value === undefined || value === null || value === '') return
  const id = String(value)
  if (!list.includes(id)) list.push(id)
}

function collectTaskParticipantIds(task) {
  const ids = []
  const collect = (items) => {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (item && typeof item === 'object') {
        pushUniqueId(ids, item.agent_id ?? item.agentId ?? item.id)
      } else {
        pushUniqueId(ids, item)
      }
    }
  }

  collect(task?.participantAgentIds)
  collect(task?.participant_agent_ids)
  collect(task?.participants)
  collect(task?.raw?.participant_agent_ids)
  collect(task?.raw?.participantAgentIds)
  collect(task?.raw?.participants)
  if (!ids.length) {
    pushUniqueId(ids, task?.assigned_to ?? task?.assignedTo)
    pushUniqueId(ids, task?.raw?.assigned_to ?? task?.raw?.assignedTo)
  }
  return ids
}

function findOnePersonTask(tasks = [], taskId = '', threadId = '') {
  const taskKey = taskId == null ? '' : String(taskId)
  const threadKey = threadId == null ? '' : String(threadId)
  return tasks.find((task) => {
    if (taskKey && String(task.id) === taskKey) return true
    if (!threadKey) return false
    return String(task.threadId || '') === threadKey
      || String(task.executionThreadId || '') === threadKey
      || String(task.raw?.thread_id || '') === threadKey
      || String(task.raw?.threadId || '') === threadKey
      || String(task.raw?.execution_thread_id || '') === threadKey
      || String(task.raw?.executionThreadId || '') === threadKey
  }) || null
}

function participantObjectForId(task, agentId) {
  const id = agentId == null ? '' : String(agentId)
  if (!id) return null
  const pools = [
    task?.participants,
    task?.raw?.participants,
  ]
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue
    const item = pool.find(participant => String(participant?.agent_id ?? participant?.agentId ?? participant?.id ?? '') === id)
    if (item && typeof item === 'object') return item
  }
  return null
}

function resolveMemberByName(members = [], name = '') {
  const key = String(name || '').trim()
  if (!key || isGenericAuthorName(key)) return null
  return (members || [])
    .map(normalizeOnePersonMember)
    .find(member => member.name === key) || null
}

function isGenericAuthorName(name = '') {
  const value = String(name || '').trim()
  if (!value) return true
  return ['团队助理', '团队助手', '我的分身', '数字员工', 'agent', 'assistant', 'system', '系统'].includes(value)
}

function resolveSingleTaskSpeaker(task, members = []) {
  if (!task) return null
  const ids = collectTaskParticipantIds(task)
  if (ids.length !== 1) return null
  const id = ids[0]
  const member = buildMemberMapFromList(members).get(String(id))
  if (member) return member
  const participant = participantObjectForId(task, id)
  if (participant) return normalizeOnePersonMember(participant)
  return {
    id: String(id),
    agentId: String(id),
    name: `成员 #${id}`,
    avatar: defaultAgentAvatar,
    description: '数字员工',
    presence: 'idle',
  }
}

function resolveMessageSpeakerMember({ agentId = '', displayName = '', task = null, members = [] } = {}) {
  const memberMap = buildMemberMapFromList(members)
  if (agentId !== undefined && agentId !== null && agentId !== '') {
    const member = memberMap.get(String(agentId))
    if (member) return member
  }
  const nameMember = resolveMemberByName(members, displayName)
  if (nameMember) return nameMember
  return resolveSingleTaskSpeaker(task, members)
}

function normalizeTask(task, members = []) {
  if (!task) return null
  const id = task.id ?? task.task_id ?? task.taskId ?? task.execution_thread_id ?? task.executionThreadId
  if (id == null) return null
  const status = normalizeTaskStatus(task.status)
  const memberMap = buildMemberMapFromList(members)
  const participantIds = []
  if (Array.isArray(task.participant_agent_ids)) task.participant_agent_ids.forEach(id => pushUniqueId(participantIds, id))
  if (Array.isArray(task.participantAgentIds)) task.participantAgentIds.forEach(id => pushUniqueId(participantIds, id))
  if (!participantIds.length) pushUniqueId(participantIds, task.assigned_to ?? task.assignedTo)
  const rawParticipants = Array.isArray(task.participants)
    ? task.participants
    : participantIds
  const participants = rawParticipants
    .map((item) => {
      if (item && typeof item === 'object') return normalizeOnePersonMember(item)
      return memberMap.get(String(item)) || { id: String(item), agentId: String(item), name: `数字员工 ${item}`, avatar: defaultAgentAvatar, description: '数字员工', presence: 'idle' }
    })
    .filter(member => member.id)
  const threadId = task.execution_thread_id ?? task.executionThreadId ?? task.thread_id ?? task.threadId
  const langgraphThreadId = task.execution_langgraph_thread_id
    ?? task.executionLanggraphThreadId
    ?? task.langgraph_thread_id
    ?? task.langgraphThreadId

  return {
    id: String(id),
    icon: task.icon || task.emoji || taskIconByStatus(status),
    title: task.title || task.name || '未命名任务',
    description: task.description || '',
    status,
    goal: task.goal || task.objective || '',
    preview: task.latest_message_preview || task.latestMessagePreview || task.preview || task.description || '',
    latestMessagePreview: task.latest_message_preview || task.latestMessagePreview || '',
    threadId: threadId == null ? '' : String(threadId),
    executionThreadId: threadId == null ? '' : String(threadId),
    langgraphThreadId: langgraphThreadId == null ? '' : String(langgraphThreadId),
    executionLanggraphThreadId: langgraphThreadId == null ? '' : String(langgraphThreadId),
    participants,
    participantAgentIds: participants.map(member => member.agentId || member.id),
    progress: task.progress || null,
    sortOrder: Number(task.sort_order ?? task.sortOrder ?? 0),
    updatedAt: task.updated_at || task.updatedAt || task.latest_activity_at || task.latestActivityAt || '',
    createdAt: task.created_at || task.createdAt || '',
    raw: task,
  }
}

function normalizeTaskSidebarGroup(group, privateAgents = []) {
  const team = group?.team || group
  const teamId = team?.id ?? team?.team_id ?? team?.teamId
  if (teamId == null) return null
  const dissolved = Boolean(
    team?.is_collaboration_dissolved
    || team?.isCollaborationDissolved
    || team?.is_dissolved
    || team?.isDissolved
    || team?.dissolved_at
    || team?.dissolvedAt,
  )
  if (dissolved) return null
  const teamKey = String(teamId)
  const teamMembers = Array.isArray(team?.members)
    ? team.members.map(normalizeOnePersonMember).filter(member => member.id)
    : []
  const members = resolveDisplayMembers(team, privateAgents, teamMembers, Infinity)
  const tasks = (Array.isArray(group?.tasks) ? group.tasks : [])
    .map(task => normalizeTask({ ...task, team_id: task?.team_id ?? teamId }, members))
    .filter(Boolean)

  return {
    id: teamKey,
    teamId: teamKey,
    name: team?.name || group?.name || '一人团队',
    team: {
      ...team,
      id: teamKey,
      teamId: teamKey,
      name: team?.name || group?.name || '一人团队',
      memberIds: resolveTeamMemberIds(team).map(String),
      raw: team?.raw || team,
    },
    tasks,
    latestTaskAt: group?.latest_task_at || group?.latestTaskAt || null,
    raw: group,
  }
}

function normalizeTaskSidebarGroups(groups = [], privateAgents = []) {
  return (Array.isArray(groups) ? groups : [])
    .map(group => normalizeTaskSidebarGroup(group, privateAgents))
    .filter(Boolean)
}

function normalizeMainThread(team, fallbackThread = null) {
  const id = fallbackThread?.id ?? fallbackThread?.thread_id ?? team?.main_thread_id ?? team?.mainThreadId
  if (id == null) return fallbackThread || null
  return {
    ...(fallbackThread || {}),
    id: String(id),
    title: fallbackThread?.title || team?.main_thread_title || '主会话',
    thread_type: fallbackThread?.thread_type || fallbackThread?.threadType || 'one_person_main',
    agent_id: fallbackThread?.agent_id ?? fallbackThread?.agentId ?? team?.coordinator_agent_id ?? team?.coordinatorAgentId ?? team?.coordinator_id ?? team?.coordinatorId ?? null,
    one_person_team_id: fallbackThread?.one_person_team_id ?? fallbackThread?.onePersonTeamId ?? team?.id ?? null,
    parent_thread_id: fallbackThread?.parent_thread_id ?? fallbackThread?.parentThreadId ?? null,
    langgraph_thread_id: fallbackThread?.langgraph_thread_id || fallbackThread?.langgraphThreadId || team?.main_langgraph_thread_id || team?.mainLanggraphThreadId || '',
    langgraphThreadId: fallbackThread?.langgraph_thread_id || fallbackThread?.langgraphThreadId || team?.main_langgraph_thread_id || team?.mainLanggraphThreadId || '',
    sub_thread_status: fallbackThread?.sub_thread_status ?? fallbackThread?.subThreadStatus ?? null,
    raw: fallbackThread?.raw || fallbackThread || null,
  }
}

function readRunId(run) {
  return run?.run_id ?? run?.runId ?? run?.id
}

function readRunThreadId(run) {
  return run?.thread_id
    ?? run?.threadId
    ?? run?.execution_thread_id
    ?? run?.executionThreadId
    ?? run?.one_person_thread_id
    ?? run?.onePersonThreadId
}

function readRunTaskId(run) {
  return run?.task_id ?? run?.taskId
}

function isActiveRun(run) {
  const status = String(run?.status || '').toLowerCase()
  return !['completed', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'].includes(status)
}

function isTerminalRunStatus(status) {
  const value = String(status || '').toLowerCase()
  return ['completed', 'succeeded', 'failed', 'error', 'timeout', 'cancelled', 'canceled'].includes(value)
}

function collectSnapshotRuns(snapshot = {}, mainThread = null, tasks = []) {
  const snapshotMainThread = snapshot.main_thread || snapshot.mainThread || {}
  const rawRuns = [
    ...(Array.isArray(snapshot.active_runs) ? snapshot.active_runs : []),
    ...(Array.isArray(snapshot.activeRuns) ? snapshot.activeRuns : []),
    ...(Array.isArray(snapshot.current_runs) ? snapshot.current_runs : []),
    ...(Array.isArray(snapshot.currentRuns) ? snapshot.currentRuns : []),
    ...(Array.isArray(snapshot.pending_runs) ? snapshot.pending_runs : []),
    ...(Array.isArray(snapshot.pendingRuns) ? snapshot.pendingRuns : []),
    ...(Array.isArray(snapshot.runs) ? snapshot.runs : []),
    snapshot.active_run,
    snapshot.activeRun,
    snapshot.current_run,
    snapshot.currentRun,
    snapshot.run,
    snapshotMainThread.active_run,
    snapshotMainThread.activeRun,
    snapshotMainThread.current_run,
    snapshotMainThread.currentRun,
    snapshotMainThread.run,
  ].filter(Boolean)

  for (const task of tasks || []) {
    const raw = task?.raw || task
    const taskRuns = [
      ...(Array.isArray(raw?.active_runs) ? raw.active_runs : []),
      ...(Array.isArray(raw?.activeRuns) ? raw.activeRuns : []),
      raw?.active_run,
      raw?.activeRun,
      raw?.current_run,
      raw?.currentRun,
      raw?.run,
    ].filter(Boolean)
    rawRuns.push(...taskRuns.map(run => ({ ...run, task_id: readRunTaskId(run) ?? task.id })))
  }

  const seen = new Set()
  return rawRuns
    .filter(run => readRunId(run) && isActiveRun(run))
    .map((run) => {
      const taskId = readRunTaskId(run)
      const task = taskId == null ? null : tasks.find(item => String(item.id) === String(taskId))
      const threadId = readRunThreadId(run) || task?.threadId || task?.executionThreadId || mainThread?.id
      return {
        ...run,
        run_id: readRunId(run),
        thread_id: threadId == null ? '' : String(threadId),
        task_id: taskId == null ? '' : String(taskId),
      }
    })
    .filter((run) => {
      const key = `${run.run_id}:${run.thread_id}`
      if (!run.thread_id || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function normalizeSendResultRun(result = {}, fallbackThreadId = '', fallbackTaskId = null) {
  const run = result?.run && typeof result.run === 'object' ? result.run : {}
  const message = result?.message && typeof result.message === 'object' ? result.message : {}
  const runId = result?.run_id ?? result?.runId ?? run?.run_id ?? run?.runId ?? message?.run_id ?? message?.runId
  if (!runId) return null
  return {
    ...run,
    run_id: String(runId),
    stream_url: result?.run_stream_url ?? result?.runStreamUrl ?? run?.stream_url ?? run?.streamUrl ?? '',
    thread_id: result?.thread_id ?? result?.threadId ?? run?.thread_id ?? run?.threadId ?? message?.thread_id ?? message?.threadId ?? fallbackThreadId,
    task_id: result?.task_id ?? result?.taskId ?? run?.task_id ?? run?.taskId ?? message?.task_id ?? message?.taskId ?? fallbackTaskId,
    status: result?.run_status ?? result?.runStatus ?? run?.status ?? 'pending',
  }
}

function makeClientMessageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeOutgoingMessageInput(input) {
  if (input && typeof input === 'object') {
    return {
      content: String(input.text ?? input.content ?? '').trim(),
      mentions: Array.isArray(input.mentions) ? input.mentions : [],
      files: Array.isArray(input.files) ? input.files.filter(Boolean) : [],
    }
  }
  return {
    content: String(input || '').trim(),
    mentions: [],
    files: [],
  }
}

function isOnePersonImageAttachment(file) {
  if (!file) return false
  const mime = file.mimeType || file.type
  if (typeof mime === 'string' && mime.startsWith('image/')) return true
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|heic|heif)$/i.test(file.name || '')
}

function stripOnePersonUploadedFilesBlock(text) {
  if (typeof text !== 'string' || !text) return text
  let next = text.replace(/<uploaded_files\b[^>]*>[\s\S]*?<\/uploaded_files>/gi, '').trim()
  next = next.replace(/\n*\[uploaded_files\][\s\S]*?\[\/uploaded_files\]\n*/g, '').trim()
  return next
}

function guessOnePersonMimeFromFilename(name) {
  const value = String(name || '').toLowerCase()
  if (value.endsWith('.md')) return 'text/markdown'
  if (value.endsWith('.txt')) return 'text/plain'
  if (value.endsWith('.png')) return 'image/png'
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg'
  if (value.endsWith('.gif')) return 'image/gif'
  if (value.endsWith('.webp')) return 'image/webp'
  if (value.endsWith('.svg')) return 'image/svg+xml'
  if (value.endsWith('.bmp')) return 'image/bmp'
  if (value.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

function extractOnePersonTextContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      if (typeof item.text === 'string') return item.text
      if (typeof item.content === 'string') return item.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function parseOnePersonUploadedFilesFromContent(text, langgraphThreadId) {
  if (!langgraphThreadId || typeof text !== 'string' || !text.toLowerCase().includes('<uploaded_files')) return []
  const blockMatch = text.match(/<uploaded_files\b[^>]*>([\s\S]*?)<\/uploaded_files>/i)
  if (!blockMatch) return []
  const blockContent = blockMatch[1]
  if (/\(empty\)/i.test(blockContent)) return []

  const byPath = new Map()
  const fileRegex = /- ([^\n(]+)\s*\(([^)]+)\)\s*\n\s*path:\s*([^\n]+)/gi
  let match
  while ((match = fileRegex.exec(blockContent)) !== null) {
    const name = match[1].trim()
    const path = match[3].trim()
    if (name && path) byPath.set(path, { name, path, size: 0 })
  }
  const pathRegex = /path:\s*(\/mnt\/user-data\/uploads\/[^\s<\r\n]+)/gi
  while ((match = pathRegex.exec(blockContent)) !== null) {
    const path = match[1].trim()
    const name = path.split('/').pop() || path
    if (path && !byPath.has(path)) byPath.set(path, { name, path, size: 0 })
  }

  return [...byPath.values()].map(({ name, path, size }) => {
    const url = resolveOnePersonArtifactUrl(langgraphThreadId, path)
    const mimeType = guessOnePersonMimeFromFilename(name)
    return {
      name,
      url,
      thumbnailUrl: url,
      size,
      type: mimeType,
      mimeType,
    }
  }).filter(file => file.url)
}

function normalizeOnePersonToolCall(toolCall) {
  if (!toolCall || typeof toolCall !== 'object') return null
  if (toolCall.function && typeof toolCall.function === 'object') {
    let args = toolCall.function.arguments
    if (args == null || args === '') args = {}
    else if (typeof args === 'string') {
      try {
        args = JSON.parse(args)
      } catch {
        args = {}
      }
    }
    return { name: toolCall.function.name, args }
  }

  let args = toolCall.args
  if (args == null && typeof toolCall.arguments === 'string') {
    try {
      args = JSON.parse(toolCall.arguments)
    } catch {
      args = {}
    }
  }
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      args = {}
    }
  }
  if (!args || typeof args !== 'object') args = {}
  return { name: toolCall.name, args }
}

function extractOnePersonPresentFilesPaths(raw, payload) {
  const toolCalls = [
    ...(Array.isArray(raw?.tool_calls) ? raw.tool_calls : []),
    ...(Array.isArray(raw?.toolCalls) ? raw.toolCalls : []),
    ...(Array.isArray(payload?.tool_calls) ? payload.tool_calls : []),
    ...(Array.isArray(payload?.toolCalls) ? payload.toolCalls : []),
  ]
  if (!toolCalls.length) return []
  const paths = []
  for (const toolCall of toolCalls) {
    const normalized = normalizeOnePersonToolCall(toolCall)
    if (!normalized || normalized.name !== 'present_files') continue
    const args = normalized.args || {}
    const filepaths = args.filepaths ?? args.filepath ?? args.paths
    if (Array.isArray(filepaths)) {
      filepaths.forEach((path) => {
        if (typeof path === 'string' && path.trim()) paths.push(path.trim())
      })
    } else if (typeof filepaths === 'string' && filepaths.trim()) {
      paths.push(filepaths.trim())
    }
  }
  return paths
}

function attachmentsFromOnePersonPresentFiles(langgraphThreadId, paths = []) {
  if (!langgraphThreadId || !paths.length) return []
  return paths.map((path) => {
    const pathSeg = path.startsWith('/') ? path : `/${path}`
    const name = pathSeg.split('/').filter(Boolean).pop() || 'file'
    const url = resolveOnePersonArtifactUrl(langgraphThreadId, pathSeg)
    const mimeType = guessOnePersonMimeFromFilename(name)
    return {
      name,
      url,
      thumbnailUrl: url,
      size: 0,
      type: mimeType,
      mimeType,
    }
  }).filter(file => file.url)
}

function normalizeOnePersonAttachment(file, { langgraphThreadId = '', localFile = null, localThumbnailUrl = '' } = {}) {
  if (!file && !localFile) return null
  const name = file?.name || file?.filename || file?.title || localFile?.name || '未命名文件'
  const fromApi = file?.artifact_url
    || file?.artifactUrl
    || file?.url
    || file?.file_url
    || file?.fileUrl
    || file?.download_url
    || file?.downloadUrl
    || file?.open_url
    || file?.openUrl
    || file?.httpUrl
  let url = ''
  if (fromApi) url = toAbsoluteOnePersonMediaUrl(fromApi)
  else if (file?.virtual_path && langgraphThreadId) url = resolveOnePersonArtifactUrl(langgraphThreadId, file.virtual_path)
  else if (file?.virtualPath && langgraphThreadId) url = resolveOnePersonArtifactUrl(langgraphThreadId, file.virtualPath)
  else if (langgraphThreadId && typeof file?.path === 'string' && file.path.includes('/mnt/user-data')) {
    url = resolveOnePersonArtifactUrl(langgraphThreadId, file.path)
  } else if (langgraphThreadId && name) {
    url = buildOnePersonUploadArtifactUrl(langgraphThreadId, name)
  }

  const downloadUrl = file?.download_url || file?.downloadUrl || ''
  const openUrl = file?.open_url || file?.openUrl || ''
  const size = Number(file?.size ?? file?.size_bytes ?? file?.sizeBytes ?? localFile?.size ?? 0)
  const artifactType = file?.artifact_type || file?.artifactType || ''
  const type = file?.type || file?.mime_type || file?.mimeType || file?.content_type || file?.contentType || artifactType || localFile?.type || ''
  const mimeType = file?.mime_type
    || file?.mimeType
    || file?.content_type
    || file?.contentType
    || (typeof file?.type === 'string' && file.type.includes('/') ? file.type : '')
    || localFile?.type
    || ''
  const rawThumbnail = file?.thumbnail_url || file?.thumbnailUrl || file?.preview_url || file?.previewUrl || ''
  const normalizedThumbnail = rawThumbnail && /^(https?:|blob:|data:)/i.test(rawThumbnail)
    ? rawThumbnail
    : (rawThumbnail ? toAbsoluteOnePersonMediaUrl(rawThumbnail) : '')
  const thumbnailUrl = rawThumbnail
    ? normalizedThumbnail
    : (isOnePersonImageAttachment({ name, type, mimeType }) ? (url || localThumbnailUrl) : localThumbnailUrl)

  return {
    name,
    url,
    thumbnailUrl,
    size: Number.isFinite(size) ? size : 0,
    type,
    mimeType,
    artifactType,
    artifactId: file?.artifact_id ?? file?.artifactId ?? null,
    downloadUrl: downloadUrl ? toAbsoluteOnePersonMediaUrl(downloadUrl) : '',
    openUrl: openUrl ? toAbsoluteOnePersonMediaUrl(openUrl) : '',
    path: file?.path || file?.virtual_path || file?.virtualPath || '',
    // 保留正文 / 预览类型：demo 产物（content 型）→ 会话侧区多标签预览区可渲染 + 编辑
    content: file?.content ?? '',
    fileType: file?.fileType || '',
    raw: file || null,
  }
}

function normalizeOnePersonAttachments(files = [], langgraphThreadId = '') {
  if (!Array.isArray(files) || !files.length) return []
  const seen = new Set()
  return files
    .map(file => normalizeOnePersonAttachment(file, { langgraphThreadId }))
    .filter(Boolean)
    .filter((file) => {
      const key = `${file.url || ''}\u0000${file.name || ''}\u0000${file.size || 0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function pushRawOnePersonAttachmentCandidates(result, item) {
  if (Array.isArray(item)) result.push(...item)
  else if (item && typeof item === 'object') result.push(item)
}

function collectRawOnePersonArtifacts(raw, payload) {
  const result = []
  const candidates = [
    payload?.artifacts,
    raw?.artifacts,
    payload?.artifact,
    raw?.artifact,
    payload?.additional_kwargs?.artifacts,
    payload?.additionalKwargs?.artifacts,
    raw?.additional_kwargs?.artifacts,
    raw?.additionalKwargs?.artifacts,
  ]
  candidates.forEach(item => pushRawOnePersonAttachmentCandidates(result, item))
  return result
}

function collectRawOnePersonAttachments(raw, payload, langgraphThreadId = '') {
  const result = []
  const candidates = [
    payload?.attachments,
    raw?.attachments,
    payload?.files,
    raw?.files,
    payload?.additional_kwargs?.files,
    payload?.additionalKwargs?.files,
    raw?.additional_kwargs?.files,
    raw?.additionalKwargs?.files,
    collectRawOnePersonArtifacts(raw, payload),
  ]
  candidates.forEach(item => pushRawOnePersonAttachmentCandidates(result, item))

  const contentCandidates = [raw?.content, payload?.content]
  for (const content of contentCandidates) {
    if (!Array.isArray(content)) continue
    content.forEach((item) => {
      if (!item || typeof item !== 'object') return
      if (item.type !== 'image' && item.type !== 'image_url') return
      const url = item.url || item.image_url?.url || item.imageUrl?.url || item.image_url || item.imageUrl || ''
      if (!url) return
      result.push({
        name: item.name || '图片',
        url,
        thumbnailUrl: url,
        type: 'image',
        mimeType: item.mime_type || item.mimeType || 'image/png',
        size: Number(item.size || 0),
      })
    })
  }

  if (langgraphThreadId) {
    result.push(...attachmentsFromOnePersonPresentFiles(
      langgraphThreadId,
      extractOnePersonPresentFilesPaths(raw, payload),
    ))
  }

  if (!result.length && langgraphThreadId) {
    const flatText = extractOnePersonTextContent(raw?.content ?? payload?.content ?? '')
    result.push(...parseOnePersonUploadedFilesFromContent(flatText, langgraphThreadId))
  }
  return result
}

function makeLocalOnePersonAttachment(file) {
  if (!file) return null
  const thumbnailUrl = file.type?.startsWith('image/') ? URL.createObjectURL(file) : ''
  return normalizeOnePersonAttachment(null, { localFile: file, localThumbnailUrl: thumbnailUrl })
}

function toMillis(value) {
  if (value == null || value === '') return NaN
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return NaN
}

function firstPresentValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function onePersonMessageTimestampValue(raw = {}, payload = {}) {
  return firstPresentValue(
    raw.timestamp,
    raw.created_at,
    raw.createdAt,
    raw.updated_at,
    raw.updatedAt,
    payload.created_at,
    payload.createdAt,
    payload.additional_kwargs?.created_at,
    payload.additionalKwargs?.createdAt,
    raw.additional_kwargs?.created_at,
    raw.additionalKwargs?.createdAt,
  )
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function payloadKind(payload) {
  return typeof payload?.kind === 'string' ? payload.kind : ''
}

function resolveCardMember(members = [], agentId) {
  if (agentId == null || agentId === '') return null
  return members.find(member => String(member.agentId || member.agent_id || member.id) === String(agentId)) || null
}

function normalizeCardMember(raw, members = []) {
  const item = isPlainObject(raw) ? raw : { agent_id: raw }
  const agentId = item.agent_id ?? item.agentId ?? item.id
  const member = resolveCardMember(members, agentId)
  const name = item.name
    || item.display_name
    || item.displayName
    || item.agent_name
    || member?.name
    || (agentId != null ? `成员 #${agentId}` : '数字员工')
  const summary = item.summary
    || item.intro_preview
    || item.introPreview
    || item.description
    || item.role_title
    || item.roleTitle
    || member?.description
    || '参与团队协作'
  return {
    id: agentId == null ? String(name) : String(agentId),
    agentId: agentId == null ? '' : String(agentId),
    name,
    avatar: item.avatar_url || item.avatarUrl || item.avatar || member?.avatar || defaultAgentAvatar,
    description: summary,
    roleTitle: item.role_title || item.roleTitle || member?.description || '',
    summary,
    presence: resolveEmployeePresence(item, member?.presence || 'idle'),
    raw: item,
  }
}

function normalizeCardMembersFromIds(ids = [], members = []) {
  return ids
    .map(id => normalizeCardMember({ agent_id: id }, members))
    .filter(member => member.id)
}

function extractTaskCard(payload, members = []) {
  if (!payload || typeof payload !== 'object') return null
  if (payloadKind(payload) === 'task_card') return payload
  if (isPlainObject(payload.task_card)) return payload.task_card
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : []
  const block = blocks.find(item => item?.type === 'task_card')
  return block?.data || null
}

function normalizeTaskCard(rawCard, members = []) {
  if (!rawCard || typeof rawCard !== 'object') return null
  const participantIds = Array.isArray(rawCard.participant_agent_ids)
    ? rawCard.participant_agent_ids
    : (Array.isArray(rawCard.participantAgentIds)
        ? rawCard.participantAgentIds
        : (rawCard.assigned_to != null || rawCard.assignedTo != null ? [rawCard.assigned_to ?? rawCard.assignedTo] : []))
  const cardMembers = Array.isArray(rawCard.members)
    ? rawCard.members.map(item => normalizeCardMember(item, members))
    : Array.isArray(rawCard.participants)
      ? rawCard.participants.map(item => normalizeCardMember(item, members))
      : normalizeCardMembersFromIds(participantIds, members)
  return {
    taskId: rawCard.task_id ?? rawCard.taskId ?? rawCard.id ?? '',
    executionThreadId: rawCard.execution_thread_id ?? rawCard.executionThreadId ?? rawCard.thread_id ?? rawCard.threadId ?? '',
    title: rawCard.title || rawCard.name || '任务',
    status: normalizeTaskStatus(rawCard.status || 'active'),
    preview: rawCard.latest_message_preview || rawCard.latestMessagePreview || rawCard.result || rawCard.error || rawCard.description || '',
    progress: rawCard.progress || null,
    members: cardMembers.filter(member => member.id),
    raw: rawCard,
  }
}

function extractWelcomeCard(payload, members = []) {
  if (!payload || typeof payload !== 'object') return null
  if (payloadKind(payload) !== 'welcome_card' && !isPlainObject(payload.welcome_card)) return null
  const card = isPlainObject(payload.welcome_card) ? payload.welcome_card : payload
  const participantIds = Array.isArray(card.participant_agent_ids)
    ? card.participant_agent_ids
    : (Array.isArray(card.participantAgentIds) ? card.participantAgentIds : [])
  const cardMembers = Array.isArray(card.members)
    ? card.members.map(item => normalizeCardMember(item, members))
    : normalizeCardMembersFromIds(participantIds, members)
  const titleRaw = String(card.title || '').trim()
  const title = titleRaw === '成员相互介绍' ? '新人介绍' : (titleRaw || '新人介绍')
  const linkedTitleRaw = String(card.linked_sub_thread_title || card.linkedSubThreadTitle || '').trim() || '新人介绍'
  const linkedTitle = linkedTitleRaw === '成员相互介绍' ? '新人介绍' : linkedTitleRaw
  return {
    taskId: card.task_id ?? card.taskId ?? payload.task_id ?? payload.taskId ?? '',
    executionThreadId:
      card.execution_thread_id
      ?? card.executionThreadId
      ?? card.linked_sub_thread_db_id
      ?? card.linkedSubThreadDbId
      ?? payload.execution_thread_id
      ?? payload.executionThreadId
      ?? '',
    title,
    linkedTitle,
    members: cardMembers.filter(member => member.id),
    raw: card,
  }
}

function transcriptPayload(payload) {
  if (payloadKind(payload) !== 'langgraph_transcript' || !Array.isArray(payload.messages)) return null
  return payload
}

function visibleTranscriptContent(payload) {
  const transcript = transcriptPayload(payload)
  if (!transcript) return ''
  const content = transcript.messages
    .filter(entry => entry?.type === 'ai' && !entry.hidden_by_default && typeof entry.content_text === 'string')
    .map(entry => entry.content_text)
    .join('')
    .trim()
  if (content) return content
  return typeof transcript.failure?.summary === 'string' ? transcript.failure.summary.trim() : ''
}

function normalizeMessage(raw, { threadId = '', taskId = '', members = [], task = null, langgraphThreadId = '' } = {}) {
  if (!raw) return null
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {}
  const authorType = raw.author_type || raw.authorType || raw.role || ''
  const role = authorType === 'human' || authorType === 'user'
    ? 'human'
    : authorType === 'agent'
      ? 'agent'
      : authorType === 'system'
        ? 'system'
        : 'assistant'
  const agentId = raw.agent_id ?? raw.agentId ?? raw.author_id ?? raw.authorId ?? payload.speaker?.id
  const taskCard = normalizeTaskCard(extractTaskCard(payload, members), members)
  const welcomeCard = extractWelcomeCard(payload, members)
  // 组队方案卡（拍平后新剧本）：原样保留 payload 供组件渲染
  const teamProposal = payloadKind(payload) === 'team_proposal' ? payload : null
  // 工作卡（员工发言下挂，可下钻围观）：原样保留 payload
  const workCard = payloadKind(payload) === 'work_card' ? payload : null
  const messageTaskId = raw.task_id ?? raw.taskId ?? taskId ?? taskCard?.taskId ?? welcomeCard?.taskId
  const messageThreadId = raw.thread_id ?? raw.threadId ?? threadId
  const displayName = raw.display_name || raw.displayName || raw.authorName || payload.speaker?.name || ''
  const speakerMember = role === 'human' || role === 'system'
    ? null
    : resolveMessageSpeakerMember({ agentId, displayName, task, members })
  const effectiveAgentId = agentId === undefined || agentId === null || agentId === ''
    ? (speakerMember?.agentId ?? speakerMember?.id ?? '')
    : agentId
  const preferSpeakerMember = Boolean(
    speakerMember
    && (agentId == null || agentId === '' || isGenericAuthorName(displayName)),
  )
  const id = raw.id ?? raw.message_id ?? raw.messageId ?? `${messageThreadId || 'thread'}-${raw.seq ?? Date.now()}`
  const status = raw.status || 'completed'
  const clientMessageId = raw.client_message_id
    ?? raw.clientMessageId
    ?? payload.client_message_id
    ?? payload.clientMessageId
    ?? ''
  const runId = raw.run_id
    ?? raw.runId
    ?? payload.run_id
    ?? payload.runId
    ?? ''
  const transcriptContent = visibleTranscriptContent(payload)
  const messageLanggraphThreadId = raw.langgraph_thread_id
    || raw.langgraphThreadId
    || payload.langgraph_thread_id
    || payload.langgraphThreadId
    || task?.langgraphThreadId
    || task?.executionLanggraphThreadId
    || langgraphThreadId
    || ''
  const attachments = normalizeOnePersonAttachments(
    collectRawOnePersonAttachments(raw, payload, messageLanggraphThreadId),
    messageLanggraphThreadId,
  )
  const artifacts = normalizeOnePersonAttachments(
    collectRawOnePersonArtifacts(raw, payload),
    messageLanggraphThreadId,
  )
  const rawContent = transcriptContent || raw.content || payload.content || ''
  const content = stripOnePersonUploadedFilesBlock(extractOnePersonTextContent(rawContent))
  const timestampValue = onePersonMessageTimestampValue(raw, payload)
  const timestamp = toMillis(timestampValue)

  return {
    id: String(id),
    seq: Number(raw.seq ?? raw.sequence ?? 0),
    role,
    clientMessageId: clientMessageId == null ? '' : String(clientMessageId),
    runId: runId == null ? '' : String(runId),
    authorId: effectiveAgentId == null ? '' : String(effectiveAgentId),
    authorName:
      (preferSpeakerMember ? speakerMember?.name : '') ||
      displayName ||
      speakerMember?.name ||
      (role === 'human' ? '我' : role === 'agent' ? '数字员工' : '我的分身'),
    avatar:
      raw.avatar_url ||
      raw.avatarUrl ||
      raw.senderAvatar ||
      payload.speaker?.avatar_url ||
      payload.speaker?.avatarUrl ||
      speakerMember?.avatar ||
      (role === 'human' ? userAvatarFallback : teamAssistantAvatar),
    content,
    status,
    isStreaming: status === 'streaming' || raw.isStreaming === true,
    threadId: messageThreadId == null ? '' : String(messageThreadId),
    taskId: messageTaskId == null ? '' : String(messageTaskId),
    payloadKind: payloadKind(payload),
    taskCard,
    welcomeCard,
    teamProposal,
    workCard,
    attachments,
    artifacts,
    createdAt: timestampValue || '',
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    additional_kwargs: raw.additional_kwargs || payload.additional_kwargs || null,
    additionalKwargs: raw.additionalKwargs || payload.additionalKwargs || null,
    raw,
  }
}

function sortMessages(messages = []) {
  return [...messages].sort((a, b) => {
    const aSeq = Number(a.seq || 0)
    const bSeq = Number(b.seq || 0)
    if (aSeq !== bSeq) return aSeq - bSeq
    const aId = Number(a.id)
    const bId = Number(b.id)
    if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId
    if ((a.timestamp || 0) !== (b.timestamp || 0)) return (a.timestamp || 0) - (b.timestamp || 0)
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

function isServerBackedMessage(message) {
  if (!message || message.isOptimistic || message.isStreaming) return false
  if (isGeneratedLocalMessageId(message.id)) return false
  const id = Number(message.id)
  return Number.isFinite(id) && id > 0
}

function maxServerMessageSeq(messages = []) {
  return messages.reduce((max, message) => {
    const seq = Number(message?.seq)
    if (!Number.isFinite(seq) || seq <= 0 || !isServerBackedMessage(message)) return max
    return Math.max(max, Math.floor(seq))
  }, 0)
}

function isModelReplyMessage(message) {
  if (!message) return false
  const role = String(message.role || message.author_type || message.authorType || '').toLowerCase()
  if (role === 'human' || role === 'user' || role === 'system') return false
  return Boolean(
    String(message.content || '').trim()
    || message.taskCard
    || message.welcomeCard
    || message.attachments?.length
    || message.artifacts?.length
  )
}

function isOnePersonTaskEntryMessage(message) {
  if (!message) return false
  return Boolean(
    message.taskCard
    || message.welcomeCard
    || message.role === 'task-card'
    || message.payloadKind === 'task_card'
    || message.payloadKind === 'welcome_card'
  )
}

function readMessageClientId(message) {
  return message?.clientMessageId
    || message?.client_message_id
    || message?.raw?.client_message_id
    || message?.raw?.clientMessageId
    || ''
}

function readMessageRunId(message) {
  return message?.runId
    || message?.run_id
    || message?.raw?.run_id
    || message?.raw?.runId
    || ''
}

function isGeneratedLocalMessageId(id) {
  const value = String(id || '')
  return value.startsWith('local-') || value.startsWith('run-')
}

function isSameMessage(a, b) {
  if (!a || !b) return false
  if (a.id && b.id && String(a.id) === String(b.id)) return true

  const aClientId = readMessageClientId(a)
  const bClientId = readMessageClientId(b)
  if (aClientId && bClientId && String(aClientId) === String(bClientId)) return true

  const aRunId = readMessageRunId(a)
  const bRunId = readMessageRunId(b)
  if (
    aRunId
    && bRunId
    && String(aRunId) === String(bRunId)
    && a.role !== 'human'
    && b.role !== 'human'
    && (
      a.isStreaming
      || b.isStreaming
      || isGeneratedLocalMessageId(a.id)
      || isGeneratedLocalMessageId(b.id)
    )
  ) {
    return true
  }

  return false
}

function mergeMessage(existing, incoming) {
  const merged = { ...(existing || {}), ...(incoming || {}) }
  if (existing?.id && incoming?.id && isGeneratedLocalMessageId(incoming.id) && !isGeneratedLocalMessageId(existing.id)) {
    merged.id = existing.id
  }
  if (incoming?.id && !isGeneratedLocalMessageId(incoming.id)) {
    merged.isOptimistic = false
  }
  return merged
}

function mergeMessageList(current = [], incoming = []) {
  const list = current.filter(Boolean).map(item => ({ ...item }))
  for (const item of incoming) {
    if (!item?.id) continue
    const index = list.findIndex(existing => isSameMessage(existing, item))
    if (index === -1) {
      list.push(item)
    } else {
      list[index] = mergeMessage(list[index], item)
    }
  }
  return sortMessages(list)
}

export function createDefaultMainMessages(members = defaultMembers()) {
  return [
    {
      id: 'm-welcome',
      role: 'assistant',
      authorName: '我的分身',
      avatar: teamAssistantAvatar,
      content: '🎉大家好！我为团队创建了第一个任务，请各位成员在话题中介绍下自己，方便后续大家协作。',
    },
    {
      id: 'm-task-card',
      role: 'task-card',
      taskId: 'intro',
      title: '新人介绍',
      members,
    },
  ]
}

export function createDefaultTaskMessages(task, members = defaultMembers()) {
  if (task?.id === 'intro') {
    const [first, second, third] = members
    return [
      {
        id: 'intro-assistant',
        role: 'assistant',
        authorName: '我的分身',
        avatar: teamAssistantAvatar,
        content: '🎉欢迎大家这里是新人介绍专区，给你一个更正式的空间介绍自己\n\n可以聊聊这些方向：\n- 你具体有哪些技能和能力？拿手的是什么？\n- 对「自主创业」这个目标，你觉得能帮上哪些具体的忙？\n- 之前做过什么类型的项目或任务？\n\n不用太正式，按你的风格来就行。以后有新伙伴加入也可以在这里自我介绍。',
      },
      {
        id: 'intro-member-1',
        role: 'agent',
        authorId: first?.id,
        authorName: first?.name || '产品经理',
        avatar: first?.avatar || defaultAgentAvatar,
        content: '我会负责把模糊想法拆成清晰目标，梳理需求、优先级、验收标准，也能跟进项目过程中的风险和决策。',
      },
      {
        id: 'intro-member-2',
        role: 'agent',
        authorId: second?.id,
        authorName: second?.name || '设计师',
        avatar: second?.avatar || defaultAgentAvatar,
        content: '我擅长把方案转成可感知的界面和视觉表达，可以做信息架构、页面布局、海报和活动物料。',
      },
      {
        id: 'intro-member-3',
        role: 'agent',
        authorId: third?.id,
        authorName: third?.name || '资产数字人',
        avatar: third?.avatar || defaultAgentAvatar,
        content: '我可以整理文件、沉淀资产、做周期性盘点，把团队协作产生的资料变成可复用的知识库。',
      },
    ]
  }

  return [
    {
      id: `${task.id}-assistant`,
      role: 'assistant',
      authorName: '我的分身',
      avatar: teamAssistantAvatar,
      content: task.preview || '任务已创建，我会安排合适的数字员工继续处理。',
    },
    {
      id: `${task.id}-member`,
      role: 'agent',
      authorId: members[0]?.id,
      authorName: members[0]?.name || '产品经理',
      avatar: members[0]?.avatar || defaultAgentAvatar,
      content: task.status === 'failed'
        ? '当前任务执行失败，建议稍后重试，或补充更具体的任务范围。'
        : task.status === 'waiting_approval'
          ? '继续前需要你确认是否允许我调用外部工具完成下一步。'
          : '我已经开始处理这个任务，会把阶段性结果同步在这里。',
    },
  ]
}

function eventCursorStorageKey(teamId) {
  return `kooky:one-person-team:event-cursor:${teamId}`
}

function readStoredEventCursor(teamId) {
  try {
    const raw = localStorage.getItem(eventCursorStorageKey(teamId))
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function persistEventCursor(teamId, cursor) {
  try {
    localStorage.setItem(eventCursorStorageKey(teamId), String(cursor || 0))
  } catch {
    // ignore storage errors
  }
}

export const onePersonTeamRuntimeState = () => ({
  onePersonActiveTaskIdByTeamId: {},
  onePersonLocalMainMessagesByTeamId: {},
  onePersonLocalTaskMessagesByTeamId: {},
  onePersonHomeLoadedByTeamId: {},
  onePersonHomeLoadingByTeamId: {},
  onePersonRuntimeFallbackByTeamId: {},
  onePersonMainThreadByTeamId: {},
  onePersonMembersByTeamId: {},
  onePersonTaskSidebarGroups: [],
  onePersonTaskSidebarLoading: false,
  onePersonTaskSidebarLoaded: false,
  onePersonTaskSidebarError: null,
  onePersonTasksByTeamId: {},
  onePersonTasksLoadedByTeamId: {},
  onePersonTasksLoadingByTeamId: {},
  onePersonMessagesByThreadId: {},
  onePersonDirtyThreadIds: {},
  onePersonUnreadCountByThreadId: {},
  onePersonSendingByThreadId: {},
  onePersonThinkingByThreadId: {},
  onePersonEventCursorByTeamId: {},
  onePersonEventStreamStatusByTeamId: {},
})

export const onePersonTeamRuntimeGetters = {
  getOnePersonDisplayMembers: (state) => (teamId) => {
    const key = teamId ? String(teamId) : ''
    const team = key ? state.teamDetailById[String(key)] : null
    return resolveDisplayMembers(team, state.privateAgents, state.onePersonMembersByTeamId[key] || [])
  },
  getOnePersonMentionMembers: (state) => (teamId) => {
    const key = teamId ? String(teamId) : ''
    const team = key ? state.teamDetailById[String(key)] : null
    return resolveMentionMembers(team, state.privateAgents, state.onePersonMembersByTeamId[key] || [])
  },
  getOnePersonTaskSidebarGroups: (state) => () => state.onePersonTaskSidebarGroups || [],
  getOnePersonTasks: (state) => (teamId) => {
    const key = teamId ? String(teamId) : ''
    if (key && state.onePersonTasksLoadedByTeamId[key]) return state.onePersonTasksByTeamId[key] || []
    return createDefaultOnePersonTasks()
  },
  getOnePersonMainThread: (state) => (teamId) => {
    const key = teamId ? String(teamId) : ''
    if (key && state.onePersonMainThreadByTeamId[key]) return state.onePersonMainThreadByTeamId[key]
    const list = key ? (state.teamThreadsById[key] || []) : []
    return list.find((t) => t?.thread_type === 'one_person_main') || list[0] || null
  },
  getOnePersonActiveTask: (state) => (teamId) => {
    if (!teamId) return null
    const key = String(teamId)
    const activeId = state.onePersonActiveTaskIdByTeamId[key]
    const tasks = state.onePersonTasksLoadedByTeamId[key] ? (state.onePersonTasksByTeamId[key] || []) : createDefaultOnePersonTasks()
    return tasks.find(task => String(task.id) === String(activeId)) || null
  },
  getOnePersonThreadMessages: (state) => (threadId) => {
    if (!threadId) return []
    return state.onePersonMessagesByThreadId[String(threadId)]?.items || []
  },
  getOnePersonThreadState: (state) => (threadId) => {
    if (!threadId) return null
    return state.onePersonMessagesByThreadId[String(threadId)] || null
  },
  getOnePersonMainMessages: (state) => (teamId) => {
    if (!teamId) return []
    const key = String(teamId)
    const thread = state.onePersonMainThreadByTeamId[key] || (state.teamThreadsById[key] || []).find((t) => t?.thread_type === 'one_person_main')
    const threadId = thread?.id ?? thread?.thread_id
    const messageState = threadId ? state.onePersonMessagesByThreadId[String(threadId)] : null
    if (messageState?.loaded || messageState?.items?.length) return messageState.items || []
    const local = state.onePersonLocalMainMessagesByTeamId[key]
    if (local?.length) return local
    if (state.onePersonHomeLoadedByTeamId[key] && !state.onePersonRuntimeFallbackByTeamId[key]) return []
    const team = state.teamDetailById[key]
    return createDefaultMainMessages(resolveDisplayMembers(team, state.privateAgents, state.onePersonMembersByTeamId[key] || []))
  },
  getOnePersonTaskMessages: (state) => (teamId, taskId) => {
    if (!teamId || !taskId) return []
    const key = String(teamId)
    const taskKey = String(taskId)
    const tasks = state.onePersonTasksLoadedByTeamId[key] ? (state.onePersonTasksByTeamId[key] || []) : createDefaultOnePersonTasks()
    const task = tasks.find(item => String(item.id) === taskKey)
    const threadId = task?.threadId || task?.executionThreadId
    const messageState = threadId ? state.onePersonMessagesByThreadId[String(threadId)] : null
    if (messageState?.loaded || messageState?.items?.length) return messageState.items || []
    const local = state.onePersonLocalTaskMessagesByTeamId[key]?.[taskKey]
    if (local?.length) return local
    if (state.onePersonHomeLoadedByTeamId[key] && !state.onePersonRuntimeFallbackByTeamId[key]) return []
    if (!task) return []
    const team = state.teamDetailById[key]
    return createDefaultTaskMessages(task, resolveDisplayMembers(team, state.privateAgents, state.onePersonMembersByTeamId[key] || []))
  },
  isOnePersonThreadSending: (state) => (threadId) => {
    if (!threadId) return false
    return !!state.onePersonSendingByThreadId[String(threadId)]
  },
  isOnePersonThreadThinking: (state) => (threadId) => {
    if (!threadId) return false
    return !!state.onePersonThinkingByThreadId[String(threadId)]
  },
}

export const onePersonTeamRuntimeActions = {
  _setOnePersonThreadThinking(threadId, thinking) {
    if (!threadId) return
    const key = String(threadId)
    if (thinking) {
      this.onePersonThinkingByThreadId = {
        ...this.onePersonThinkingByThreadId,
        [key]: true,
      }
      return
    }

    const next = { ...this.onePersonThinkingByThreadId }
    delete next[key]
    this.onePersonThinkingByThreadId = next
    for (const [timerKey, timer] of onePersonThinkingSettleTimers.entries()) {
      if (!timerKey.endsWith(`:${key}`)) continue
      clearTimeout(timer)
      onePersonThinkingSettleTimers.delete(timerKey)
    }
  },

  _clearOnePersonThreadThinking(threadIds = []) {
    const ids = Array.isArray(threadIds) ? threadIds : [threadIds]
    const next = { ...this.onePersonThinkingByThreadId }
    let changed = false
    for (const threadId of ids) {
      if (threadId === undefined || threadId === null || threadId === '') continue
      const key = String(threadId)
      if (next[key]) {
        delete next[key]
        changed = true
      }
    }
    if (changed) this.onePersonThinkingByThreadId = next
  },

  _findOnePersonTeamIdByMainThreadId(threadId) {
    if (!threadId) return ''
    const threadKey = String(threadId)
    for (const [teamId, thread] of Object.entries(this.onePersonMainThreadByTeamId || {})) {
      if (String(thread?.id ?? thread?.thread_id ?? '') === threadKey) return String(teamId)
    }
    for (const [teamId, threads] of Object.entries(this.teamThreadsById || {})) {
      if (!Array.isArray(threads)) continue
      const mainThread = threads.find(thread => thread?.thread_type === 'one_person_main')
      if (mainThread && String(mainThread.id ?? mainThread.thread_id ?? '') === threadKey) return String(teamId)
    }
    return ''
  },

  _scheduleOnePersonTaskSidebarRefresh({ delay = 200 } = {}) {
    this.onePersonTaskSidebarLoaded = false
    if (onePersonTaskSidebarRefreshTimer) clearTimeout(onePersonTaskSidebarRefreshTimer)
    onePersonTaskSidebarRefreshTimer = setTimeout(() => {
      onePersonTaskSidebarRefreshTimer = null
      void this.loadOnePersonTaskSidebar({ force: true })
    }, delay)
  },

  _setOnePersonThreadMessageState(threadId, patch) {
    if (!threadId) return
    const key = String(threadId)
    this.onePersonMessagesByThreadId = {
      ...this.onePersonMessagesByThreadId,
      [key]: {
        items: [],
        loaded: false,
        loading: false,
        error: null,
        hasMore: false,
        nextBeforeSeq: null,
        latestSeq: 0,
        ...(this.onePersonMessagesByThreadId[key] || {}),
        ...patch,
      },
    }
  },

  _upsertOnePersonMessages(threadId, messages) {
    if (!threadId || !Array.isArray(messages) || !messages.length) return
    const key = String(threadId)
    const current = this.onePersonMessagesByThreadId[key]?.items || []
    const currentLatestSeq = Number(this.onePersonMessagesByThreadId[key]?.latestSeq || 0)
    const incomingLatestSeq = maxServerMessageSeq(messages)
    this._setOnePersonThreadMessageState(key, {
      items: mergeMessageList(current, messages),
      loaded: true,
      latestSeq: Math.max(currentLatestSeq, incomingLatestSeq),
    })
    if (messages.some(isModelReplyMessage)) this._setOnePersonThreadThinking(key, false)
    if (messages.some(isOnePersonTaskEntryMessage) && this._findOnePersonTeamIdByMainThreadId(key)) {
      this._scheduleOnePersonTaskSidebarRefresh()
    }
  },

  _appendOnePersonMessage(threadId, message) {
    if (!threadId || !message) return
    this._upsertOnePersonMessages(threadId, [message])
  },

  _markOnePersonThreadDirty(threadId) {
    if (!threadId) return
    const key = String(threadId)
    this.onePersonDirtyThreadIds = {
      ...this.onePersonDirtyThreadIds,
      [key]: true,
    }
    this.onePersonUnreadCountByThreadId = {
      ...this.onePersonUnreadCountByThreadId,
      [key]: Number(this.onePersonUnreadCountByThreadId[key] || 0) + 1,
    }
  },

  _clearOnePersonThreadDirty(threadId) {
    if (!threadId) return
    const key = String(threadId)
    const dirty = { ...this.onePersonDirtyThreadIds }
    const unread = { ...this.onePersonUnreadCountByThreadId }
    delete dirty[key]
    delete unread[key]
    this.onePersonDirtyThreadIds = dirty
    this.onePersonUnreadCountByThreadId = unread
  },

  _isOnePersonThreadVisible(teamId, threadId) {
    if (!teamId || !threadId) return false
    const threadKey = String(threadId)
    const mainThread = this.getOnePersonMainThread(teamId)
    if (mainThread && String(mainThread.id ?? mainThread.thread_id ?? '') === threadKey) return true
    const activeTask = this.getOnePersonActiveTask(teamId)
    return Boolean(activeTask && (
      String(activeTask.threadId || '') === threadKey
      || String(activeTask.executionThreadId || '') === threadKey
    ))
  },

  async _syncOnePersonThreadAfterSeq(teamId, threadId, { taskId = null, forceIfUnloaded = false } = {}) {
    if (!teamId || !threadId) return []
    const key = String(threadId)
    const existing = this.onePersonMessagesByThreadId[key]
    if (existing?.loading) {
      this._scheduleOnePersonThreadAfterSeqSync(teamId, threadId, {
        taskId,
        delay: 300,
        forceIfUnloaded,
      })
      return existing.items || []
    }
    const hasLoadedMessages = Boolean(existing?.loaded || existing?.items?.length)
    if (!hasLoadedMessages) {
      if (!forceIfUnloaded) return []
      return this.loadOnePersonThreadMessages(teamId, threadId, { force: true, taskId, limit: 80 })
    }
    const latestSeq = Number(existing?.latestSeq || maxServerMessageSeq(existing?.items || []) || 0)
    return this.loadOnePersonThreadMessages(teamId, threadId, {
      afterSeq: latestSeq,
      taskId,
      limit: 200,
    })
  },

  _scheduleOnePersonThreadAfterSeqSync(teamId, threadId, {
    taskId = null,
    delay = 0,
    forceIfUnloaded = false,
  } = {}) {
    if (!teamId || !threadId) return
    const key = `${String(teamId)}:${String(threadId)}:${taskId == null ? '' : String(taskId)}`
    const existingTimer = onePersonThreadSyncTimers.get(key)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      onePersonThreadSyncTimers.delete(key)
      void this._syncOnePersonThreadAfterSeq(teamId, threadId, { taskId, forceIfUnloaded })
    }, delay)
    onePersonThreadSyncTimers.set(key, timer)
  },

  _settleOnePersonThreadThinkingAfterLedger(teamId, threadId, {
    taskId = null,
    attempts = 3,
    delay = 500,
  } = {}) {
    if (!teamId || !threadId) return
    const teamKey = String(teamId)
    const threadKey = String(threadId)
    const timerKey = `${teamKey}:${threadKey}`
    const existingTimer = onePersonThinkingSettleTimers.get(timerKey)
    if (existingTimer) clearTimeout(existingTimer)

    const schedule = (remaining, wait) => {
      const timer = setTimeout(async () => {
        onePersonThinkingSettleTimers.delete(timerKey)
        const state = this.onePersonMessagesByThreadId[threadKey]
        if (state?.loading) {
          schedule(remaining, 300)
          return
        }

        try {
          await this._syncOnePersonThreadAfterSeq(teamId, threadId, {
            taskId,
            forceIfUnloaded: this._isOnePersonThreadVisible(teamId, threadId),
          })
        } catch (error) {
          console.warn('[SoloTeam] settle one-person thinking sync failed:', error)
        }

        if (!this.onePersonThinkingByThreadId[threadKey]) return
        if (remaining > 1) {
          schedule(remaining - 1, delay)
          return
        }
        this._setOnePersonThreadThinking(threadId, false)
      }, wait)
      onePersonThinkingSettleTimers.set(timerKey, timer)
    }

    schedule(Math.max(1, Number(attempts) || 1), delay)
  },

  _resolveOnePersonLanggraphThreadId(teamId, threadId, taskId = null) {
    const teamKey = teamId == null ? '' : String(teamId)
    const threadKey = threadId == null ? '' : String(threadId)
    const taskKey = taskId == null || taskId === '' ? '' : String(taskId)
    if (!teamKey && !threadKey) return ''

    const mainThread = this.getOnePersonMainThread(teamKey)
    if (
      mainThread
      && (
        !taskKey
        || String(mainThread.id ?? '') === threadKey
        || String(mainThread.thread_id ?? '') === threadKey
        || String(mainThread.threadId ?? '') === threadKey
      )
    ) {
      const langgraphId = mainThread.langgraph_thread_id || mainThread.langgraphThreadId
      if (langgraphId) return String(langgraphId)
    }

    const tasks = this.getOnePersonTasks(teamKey)
    const matchedTask = tasks.find(task =>
      (taskKey && String(task.id) === taskKey)
      || (threadKey && (
        String(task.threadId || '') === threadKey
        || String(task.executionThreadId || '') === threadKey
        || String(task.raw?.thread_id || '') === threadKey
        || String(task.raw?.threadId || '') === threadKey
        || String(task.raw?.execution_thread_id || '') === threadKey
        || String(task.raw?.executionThreadId || '') === threadKey
      ))
    )
    const taskLanggraphId = matchedTask?.langgraphThreadId
      || matchedTask?.executionLanggraphThreadId
      || matchedTask?.raw?.execution_langgraph_thread_id
      || matchedTask?.raw?.executionLanggraphThreadId
      || matchedTask?.raw?.langgraph_thread_id
      || matchedTask?.raw?.langgraphThreadId
    if (taskLanggraphId) return String(taskLanggraphId)

    return ''
  },

  applyOnePersonHomeSnapshot(teamId, snapshot = {}) {
    if (!teamId) return
    const key = String(teamId)
    const team = snapshot.team || {}
    const members = Array.isArray(snapshot.members) ? snapshot.members.map(normalizeOnePersonMember).filter(member => member.id) : []
    const snapshotMainThread = snapshot.main_thread || snapshot.mainThread || null
    const fallbackThread = snapshotMainThread
      || (this.teamThreadsById[key] || []).find((t) => t?.thread_type === 'one_person_main' || t?.threadType === 'one_person_main')
      || null
    const mainThread = normalizeMainThread(team, fallbackThread)
    const tasks = (Array.isArray(snapshot.tasks) ? snapshot.tasks : [])
      .map(task => normalizeTask(task, members))
      .filter(Boolean)

    this.onePersonHomeLoadedByTeamId = { ...this.onePersonHomeLoadedByTeamId, [key]: true }
    this.onePersonRuntimeFallbackByTeamId = { ...this.onePersonRuntimeFallbackByTeamId, [key]: false }
    this.onePersonMembersByTeamId = { ...this.onePersonMembersByTeamId, [key]: members }
    this.onePersonTasksByTeamId = { ...this.onePersonTasksByTeamId, [key]: tasks }
    this.onePersonTasksLoadedByTeamId = { ...this.onePersonTasksLoadedByTeamId, [key]: true }
    if (tasks.length && this.onePersonTaskSidebarLoaded) this._scheduleOnePersonTaskSidebarRefresh()

    if (mainThread) {
      this.onePersonMainThreadByTeamId = { ...this.onePersonMainThreadByTeamId, [key]: mainThread }
      const existingThreads = this.teamThreadsById[key] || []
      if (!existingThreads.some(thread => String(thread.id) === String(mainThread.id))) {
        this.teamThreadsById = { ...this.teamThreadsById, [key]: [mainThread, ...existingThreads] }
      }
    }

    if (team?.id != null || team?.name) {
      const teamDescriptionValue = team.description ?? team.teamDescription ?? team.team_description
      const hasTeamDescription = teamDescriptionValue !== undefined
      this.teamDetailById = {
        ...this.teamDetailById,
        [key]: {
          ...(this.teamDetailById[key] || {}),
          id: String(team.id ?? key),
          name: team.name || this.teamDetailById[key]?.name || '一人团队',
          description: hasTeamDescription ? String(teamDescriptionValue || '').trim() : (this.teamDetailById[key]?.description || ''),
          main_thread_id: team.main_thread_id ?? team.mainThreadId ?? mainThread?.id ?? null,
          main_langgraph_thread_id: team.main_langgraph_thread_id ?? team.mainLanggraphThreadId ?? mainThread?.langgraph_thread_id ?? '',
          is_dissolved: Boolean(team.is_dissolved || team.isDissolved),
          raw: team,
        },
      }
    }

    const snapshotCursor = Number(snapshot.event_cursor ?? snapshot.eventCursor ?? 0)
    const localCursor = Number(this.onePersonEventCursorByTeamId[key] ?? readStoredEventCursor(key) ?? 0)
    const cursor = Math.max(localCursor, Number.isFinite(snapshotCursor) ? snapshotCursor : 0)
    this.onePersonEventCursorByTeamId = { ...this.onePersonEventCursorByTeamId, [key]: cursor }
    persistEventCursor(key, cursor)
  },

  async loadOnePersonTaskSidebar({ force = false } = {}) {
    if (!force && this.onePersonTaskSidebarLoaded) return this.onePersonTaskSidebarGroups || []
    if (this.onePersonTaskSidebarLoading) return this.onePersonTaskSidebarGroups || []
    this.onePersonTaskSidebarLoading = true
    this.onePersonTaskSidebarError = null
    try {
      if (!this.privateAgentsLoaded && !this.privateAgentsLoading) {
        await this.loadPrivateAgentsForTeam({ force: false }).catch(() => [])
      }
      const rawGroups = await fetchKookyOnePersonTaskSidebar()
      const groups = normalizeTaskSidebarGroups(rawGroups, this.privateAgents)
      this.onePersonTaskSidebarGroups = groups
      this.onePersonTaskSidebarLoaded = true
      this.onePersonTaskSidebarError = null

      const tasksByTeam = { ...this.onePersonTasksByTeamId }
      const tasksLoaded = { ...this.onePersonTasksLoadedByTeamId }
      const details = { ...this.teamDetailById }
      let teams = Array.isArray(this.onePersonTeams) ? [...this.onePersonTeams] : []

      for (const group of groups) {
        const teamKey = String(group.teamId)
        tasksByTeam[teamKey] = group.tasks
        tasksLoaded[teamKey] = true
        details[teamKey] = {
          ...(details[teamKey] || {}),
          ...group.team,
          id: teamKey,
          teamId: teamKey,
          name: group.name,
        }
        const index = teams.findIndex(team => String(team.id) === teamKey)
        if (index === -1) {
          teams.push(details[teamKey])
        } else {
          teams[index] = { ...teams[index], ...details[teamKey] }
        }
      }

      this.onePersonTasksByTeamId = tasksByTeam
      this.onePersonTasksLoadedByTeamId = tasksLoaded
      this.teamDetailById = details
      this.onePersonTeams = teams
      return groups
    } catch (error) {
      console.error('[SoloTeam] load one-person task sidebar failed:', error)
      this.onePersonTaskSidebarError = error?.message || '加载任务失败'
      return this.onePersonTaskSidebarGroups || []
    } finally {
      this.onePersonTaskSidebarLoading = false
    }
  },

  async loadOnePersonTeamHome(teamId, { force = false } = {}) {
    if (!teamId) return null
    const key = String(teamId)
    if (!force && this.onePersonHomeLoadedByTeamId[key]) return this.teamDetailById[key] || null
    if (this.onePersonHomeLoadingByTeamId[key]) return this.teamDetailById[key] || null
    this.onePersonHomeLoadingByTeamId = { ...this.onePersonHomeLoadingByTeamId, [key]: true }
    try {
      const snapshot = await fetchKookyOnePersonTeamHome(teamId)
      this.applyOnePersonHomeSnapshot(teamId, snapshot)
      return snapshot
    } catch (error) {
      console.warn('[SoloTeam] Kooky one-person home unavailable, using local fallback:', error)
      const fallbackThread = {
        id: `fallback-main-${key}`,
        title: '主会话',
        thread_type: 'one_person_main',
        langgraph_thread_id: '',
      }
      this.onePersonHomeLoadedByTeamId = { ...this.onePersonHomeLoadedByTeamId, [key]: false }
      this.onePersonRuntimeFallbackByTeamId = { ...this.onePersonRuntimeFallbackByTeamId, [key]: true }
      this.onePersonMainThreadByTeamId = {
        ...this.onePersonMainThreadByTeamId,
        [key]: this.onePersonMainThreadByTeamId[key] || fallbackThread,
      }
      return null
    } finally {
      const next = { ...this.onePersonHomeLoadingByTeamId }
      delete next[key]
      this.onePersonHomeLoadingByTeamId = next
    }
  },

  async loadOnePersonTeamTasks(teamId, { force = false, status } = {}) {
    if (!teamId) return []
    const key = String(teamId)
    if (!force && this.onePersonTasksLoadedByTeamId[key]) return this.onePersonTasksByTeamId[key] || []
    if (this.onePersonTasksLoadingByTeamId[key]) return this.onePersonTasksByTeamId[key] || []
    this.onePersonTasksLoadingByTeamId = { ...this.onePersonTasksLoadingByTeamId, [key]: true }
    try {
      const members = this.onePersonMembersByTeamId[key] || []
      const rawTasks = await fetchKookyOnePersonTeamTasks(teamId, { status })
      const tasks = (Array.isArray(rawTasks) ? rawTasks : [])
        .map(task => normalizeTask(task, members))
        .filter(Boolean)
      this.onePersonTasksByTeamId = { ...this.onePersonTasksByTeamId, [key]: tasks }
      this.onePersonTasksLoadedByTeamId = { ...this.onePersonTasksLoadedByTeamId, [key]: true }
      this.onePersonRuntimeFallbackByTeamId = { ...this.onePersonRuntimeFallbackByTeamId, [key]: false }
      if (force || this.onePersonTaskSidebarLoaded) this._scheduleOnePersonTaskSidebarRefresh()
      return tasks
    } catch (error) {
      console.warn('[SoloTeam] Kooky one-person tasks unavailable:', error)
      if (!this.onePersonTasksLoadedByTeamId[key]) {
        this.onePersonRuntimeFallbackByTeamId = { ...this.onePersonRuntimeFallbackByTeamId, [key]: true }
      }
      return this.getOnePersonTasks(teamId)
    } finally {
      const next = { ...this.onePersonTasksLoadingByTeamId }
      delete next[key]
      this.onePersonTasksLoadingByTeamId = next
    }
  },

  async loadOnePersonThreadMessages(teamId, threadId, {
    force = false,
    beforeSeq,
    afterSeq,
    taskId,
    limit = 80,
  } = {}) {
    if (!teamId || !threadId) return []
    const key = String(threadId)
    const existing = this.onePersonMessagesByThreadId[key]
    if (!force && existing?.loaded && beforeSeq == null && afterSeq == null) return existing.items || []
    if (existing?.loading) return existing.items || []
    this._setOnePersonThreadMessageState(key, { loading: true, error: null })
    try {
      const members = this.getOnePersonMentionMembers(teamId)
      const task = findOnePersonTask(this.getOnePersonTasks(teamId), taskId, threadId)
      const langgraphThreadId = this._resolveOnePersonLanggraphThreadId(teamId, threadId, taskId)
      const body = await fetchKookyOnePersonTeamMessages(teamId, threadId, { beforeSeq, afterSeq, limit })
      const rawItems = body.items || body.messages || (Array.isArray(body) ? body : [])
      const items = rawItems
        .map(message => normalizeMessage(message, { threadId, taskId, members, task, langgraphThreadId }))
        .filter(Boolean)
      const existingItems = this.onePersonMessagesByThreadId[key]?.items || []
      const current = (beforeSeq != null || afterSeq != null || force)
        ? (force && beforeSeq == null && afterSeq == null
            ? existingItems.filter(item => !String(item?.id || '').startsWith('run-'))
            : existingItems)
        : []
      const previousState = this.onePersonMessagesByThreadId[key] || {}
      const latestSeq = Math.max(
        Number(previousState.latestSeq || 0),
        Number(body.latest_seq ?? body.latestSeq ?? 0),
        maxServerMessageSeq(items),
      )
      this._setOnePersonThreadMessageState(key, {
        items: mergeMessageList(current, items),
        loaded: true,
        loading: false,
        hasMore: afterSeq != null
          ? Boolean(previousState.hasMore)
          : Boolean(body.has_more ?? body.hasMore),
        nextBeforeSeq: afterSeq != null
          ? (previousState.nextBeforeSeq ?? null)
          : (body.next_before_seq ?? body.nextBeforeSeq ?? null),
        latestSeq,
      })
      this._clearOnePersonThreadDirty(key)
      if (items.some(isOnePersonTaskEntryMessage) && this._findOnePersonTeamIdByMainThreadId(key)) {
        this._scheduleOnePersonTaskSidebarRefresh()
      }
      return this.onePersonMessagesByThreadId[key]?.items || []
    } catch (error) {
      console.warn('[SoloTeam] Kooky one-person messages unavailable:', error)
      this._setOnePersonThreadMessageState(key, {
        loading: false,
        error,
        loaded: false,
      })
      this.onePersonRuntimeFallbackByTeamId = {
        ...this.onePersonRuntimeFallbackByTeamId,
        [String(teamId)]: true,
      }
      return []
    }
  },

  async loadOnePersonTeamRuntime(teamId, { force = false } = {}) {
    if (!teamId) return
    const snapshot = await this.loadOnePersonTeamHome(teamId, { force })
    if (!snapshot) {
      await this.loadOnePersonTeamThreads(teamId, { force: true }).catch(() => [])
      return
    }
    const mainThread = this.getOnePersonMainThread(teamId)
    if (mainThread?.id) {
      void this.loadOnePersonThreadMessages(teamId, mainThread.id, { force })
    }
    this.subscribeOnePersonTeamEvents(teamId)
    this.markOnePersonSnapshotRunsActive(teamId, snapshot)
    const activeTask = this.getOnePersonActiveTask(teamId)
    const activeTaskThreadId = activeTask?.threadId || activeTask?.executionThreadId || ''
    if (activeTaskThreadId) {
      void this.loadOnePersonThreadMessages(teamId, activeTaskThreadId, {
        force,
        taskId: activeTask.id,
      })
    }
  },

  openOnePersonTask(teamId, taskId) {
    if (!teamId || !taskId) return
    const key = String(teamId)
    this.onePersonActiveTaskIdByTeamId = {
      ...this.onePersonActiveTaskIdByTeamId,
      [key]: String(taskId),
    }
    const task = this.getOnePersonActiveTask(teamId)
    const threadId = task?.threadId || task?.executionThreadId || ''
    if (threadId && this.onePersonTasksLoadedByTeamId[key] && !this.onePersonRuntimeFallbackByTeamId[key]) {
      void this.loadOnePersonThreadMessages(teamId, threadId, { force: false, taskId: task.id })
    }
  },

  closeOnePersonTask(teamId) {
    if (!teamId) return
    const next = { ...this.onePersonActiveTaskIdByTeamId }
    delete next[String(teamId)]
    this.onePersonActiveTaskIdByTeamId = next
  },

  appendOnePersonMainMessage(teamId, content, files = []) {
    const text = String(content || '').trim()
    const localAttachments = (Array.isArray(files) ? files : []).map(makeLocalOnePersonAttachment).filter(Boolean)
    if (!teamId || (!text && !localAttachments.length)) return
    const key = String(teamId)
    const team = this.teamDetailById[key]
    const current = this.onePersonLocalMainMessagesByTeamId[key]
      || createDefaultMainMessages(resolveDisplayMembers(team, this.privateAgents, this.onePersonMembersByTeamId[key] || []))
    const id = `local-main-${Date.now()}`
    this.onePersonLocalMainMessagesByTeamId = {
      ...this.onePersonLocalMainMessagesByTeamId,
      [key]: [
        ...current,
        {
          id,
          role: 'human',
          authorName: '我',
          avatar: userAvatarFallback,
          content: text,
          attachments: localAttachments,
        },
        {
          id: `${id}-assistant`,
          role: 'assistant',
          authorName: '我的分身',
          avatar: teamAssistantAvatar,
          content: '收到，我会根据你的目标判断是否需要创建任务，并把后续进展同步到右侧任务列表和对应子会话。',
        },
      ],
    }
  },

  appendOnePersonTaskMessage(teamId, taskId, content, files = []) {
    const text = String(content || '').trim()
    const localAttachments = (Array.isArray(files) ? files : []).map(makeLocalOnePersonAttachment).filter(Boolean)
    if (!teamId || !taskId || (!text && !localAttachments.length)) return
    const key = String(teamId)
    const taskKey = String(taskId)
    const tasks = this.onePersonTasksLoadedByTeamId[key] ? (this.onePersonTasksByTeamId[key] || []) : createDefaultOnePersonTasks()
    const task = tasks.find(item => String(item.id) === taskKey)
    if (!task) return
    const team = this.teamDetailById[key]
    const current = this.onePersonLocalTaskMessagesByTeamId[key]?.[taskKey]
      || createDefaultTaskMessages(task, resolveDisplayMembers(team, this.privateAgents, this.onePersonMembersByTeamId[key] || []))
    const id = `local-task-${taskKey}-${Date.now()}`
    this.onePersonLocalTaskMessagesByTeamId = {
      ...this.onePersonLocalTaskMessagesByTeamId,
      [key]: {
        ...(this.onePersonLocalTaskMessagesByTeamId[key] || {}),
        [taskKey]: [
          ...current,
          {
          id,
          role: 'human',
          authorName: '我',
          avatar: userAvatarFallback,
          content: text,
          attachments: localAttachments,
        },
          {
            id: `${id}-assistant`,
            role: 'assistant',
            authorName: '我的分身',
            avatar: teamAssistantAvatar,
            content: '已补充到这个任务里，后端推送新的成员回复后会继续展示在当前子会话。',
          },
        ],
      },
    }
  },

  async sendOnePersonMainMessage(teamId, input) {
    const { content, mentions, files } = normalizeOutgoingMessageInput(input)
    const mainThread = this.getOnePersonMainThread(teamId)
    if (!mainThread?.id || this.onePersonRuntimeFallbackByTeamId[String(teamId)]) {
      this.appendOnePersonMainMessage(teamId, content, files)
      return
    }
    await this.sendOnePersonThreadMessage(teamId, {
      threadId: mainThread.id,
      taskId: null,
      content,
      mentions,
      files,
    })
  },

  async sendOnePersonTaskMessage(teamId, taskId, input) {
    const { content, mentions, files } = normalizeOutgoingMessageInput(input)
    const task = this.getOnePersonTasks(teamId).find(item => String(item.id) === String(taskId))
    const threadId = task?.threadId || task?.executionThreadId
    if (!threadId || this.onePersonRuntimeFallbackByTeamId[String(teamId)]) {
      this.appendOnePersonTaskMessage(teamId, taskId, content, files)
      return
    }
    await this.sendOnePersonThreadMessage(teamId, {
      threadId,
      taskId,
      content,
      mentions,
      files,
    })
  },

  async sendOnePersonThreadMessage(teamId, { threadId, taskId = null, content, mentions = [], files = [] } = {}) {
    const text = String(content || '').trim()
    const fileList = Array.isArray(files) ? files.filter(Boolean) : []
    if (!teamId || !threadId || (!text && !fileList.length)) return
    const threadKey = String(threadId)
    if (this.onePersonSendingByThreadId[threadKey]) return

    const clientMessageId = makeClientMessageId()
    const localAttachments = fileList.map(makeLocalOnePersonAttachment).filter(Boolean)
    const currentState = this.onePersonMessagesByThreadId[threadKey] || {}
    const optimisticSeq = Number(currentState.latestSeq || maxServerMessageSeq(currentState.items || []) || 0) + 0.25
    const userMessage = {
      id: `local-user-${clientMessageId}`,
      role: 'human',
      clientMessageId,
      authorName: '我',
      avatar: userAvatarFallback,
      content: text,
      attachments: localAttachments,
      seq: optimisticSeq,
      status: 'completed',
      threadId: threadKey,
      taskId: taskId == null ? '' : String(taskId),
      timestamp: Date.now(),
      isOptimistic: true,
      raw: {
        client_message_id: clientMessageId,
        mentions,
      },
    }
    this._appendOnePersonMessage(threadKey, userMessage)
    this.onePersonSendingByThreadId = { ...this.onePersonSendingByThreadId, [threadKey]: true }
    this._setOnePersonThreadThinking(threadKey, true)

    let hasActiveRun = false
    try {
      let uploadedFiles = []
      let requestAttachments = []
      const langgraphThreadId = this._resolveOnePersonLanggraphThreadId(teamId, threadId, taskId)
      if (fileList.length > 0) {
        if (!langgraphThreadId) throw new Error('当前会话缺少 LangGraph 线程，无法上传附件')
        const result = await onePersonTeamAttachmentApi.uploadFiles(langgraphThreadId, fileList)
        uploadedFiles = result?.files || result?.data?.files || []
        requestAttachments = uploadedFiles
        const uploadedAttachments = uploadedFiles.map((file, index) => normalizeOnePersonAttachment(file, {
          langgraphThreadId,
          localFile: fileList[index],
          localThumbnailUrl: localAttachments[index]?.thumbnailUrl || '',
        })).filter(Boolean)
        if (uploadedAttachments.length) {
          this._upsertOnePersonMessages(threadKey, [{
            ...userMessage,
            attachments: uploadedAttachments,
          }])
        }
      }
      const result = await sendKookyOnePersonTeamMessage(teamId, {
        threadId,
        taskId,
        content: text,
        clientMessageId,
        attachments: requestAttachments,
        mentions,
      })
      const members = this.getOnePersonMentionMembers(teamId)
      const task = findOnePersonTask(this.getOnePersonTasks(teamId), taskId, threadId)
      if (result?.message) {
        const serverMessage = normalizeMessage(result.message, { threadId, taskId, members, task, langgraphThreadId })
        if (serverMessage) this._upsertOnePersonMessages(threadKey, [serverMessage])
      }
      const run = normalizeSendResultRun(result, threadId, taskId)
      if (run?.run_id) {
        hasActiveRun = true
        this._setOnePersonThreadThinking(run.thread_id || threadId, true)
        this._scheduleOnePersonThreadAfterSeqSync(teamId, run.thread_id || threadId, {
          taskId: run.task_id ?? taskId,
          delay: 1200,
          forceIfUnloaded: true,
        })
      } else {
        this._scheduleOnePersonThreadAfterSeqSync(teamId, threadId, {
          taskId,
          delay: 300,
          forceIfUnloaded: true,
        })
      }
    } catch (error) {
      console.warn('[SoloTeam] send Kooky one-person message failed, using local fallback:', error)
      const assistantMessage = {
        id: `${userMessage.id}-assistant`,
        role: 'assistant',
        authorName: '我的分身',
        avatar: teamAssistantAvatar,
        content: taskId
          ? '已先记录到当前任务，等后端消息接口可用后会切换为真实任务会话。'
          : '已先记录到主会话，等后端消息接口可用后会切换为真实团队编排。',
        status: 'completed',
        threadId: threadKey,
        taskId: taskId == null ? '' : String(taskId),
        timestamp: Date.now() + 1,
      }
      this._appendOnePersonMessage(threadKey, assistantMessage)
      this.onePersonRuntimeFallbackByTeamId = {
        ...this.onePersonRuntimeFallbackByTeamId,
        [String(teamId)]: true,
      }
    } finally {
      const next = { ...this.onePersonSendingByThreadId }
      delete next[threadKey]
      this.onePersonSendingByThreadId = next
      if (!hasActiveRun) this._setOnePersonThreadThinking(threadKey, false)
    }
  },

  markOnePersonRunActive(teamId, threadId, run, { taskId = null } = {}) {
    const runId = run?.run_id || run?.runId
    if (!teamId || !threadId || !runId) return
    const threadKey = String(threadId)
    this._setOnePersonThreadThinking(threadKey, true)
    this._scheduleOnePersonThreadAfterSeqSync(teamId, threadKey, {
      taskId,
      delay: 1200,
      forceIfUnloaded: true,
    })
  },

  markOnePersonSnapshotRunsActive(teamId, snapshot = {}) {
    if (!teamId || !snapshot) return
    const mainThread = this.getOnePersonMainThread(teamId)
    const tasks = this.getOnePersonTasks(teamId)
    const runs = collectSnapshotRuns(snapshot, mainThread, tasks)
    for (const run of runs) {
      this.markOnePersonRunActive(teamId, run.thread_id, run, { taskId: run.task_id || null })
    }
  },

  _scheduleOnePersonTeamEventsReconnect(teamId) {
    if (!teamId) return
    const key = String(teamId)
    if (!onePersonTeamEventSubscriptions.has(key) || onePersonTeamEventReconnectTimers.has(key)) return
    const timer = setTimeout(() => {
      onePersonTeamEventReconnectTimers.delete(key)
      if (onePersonTeamEventSubscriptions.has(key)) this.subscribeOnePersonTeamEvents(key)
    }, 1500)
    onePersonTeamEventReconnectTimers.set(key, timer)
  },

  subscribeOnePersonTeamEvents(teamId) {
    if (!teamId) return
    const key = String(teamId)
    const reconnectTimer = onePersonTeamEventReconnectTimers.get(key)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      onePersonTeamEventReconnectTimers.delete(key)
    }
    onePersonTeamEventSubscriptions.add(key)
    onePersonTeamStreamClient.closeTeamEvents(key)
    const cursor = Math.max(
      Number(this.onePersonEventCursorByTeamId[key] || 0),
      readStoredEventCursor(key),
    )
    this.onePersonEventStreamStatusByTeamId = {
      ...this.onePersonEventStreamStatusByTeamId,
      [key]: 'connecting',
    }

    void onePersonTeamStreamClient.connectTeamEvents(key, cursor, {
      onOpen: () => {
        this.onePersonEventStreamStatusByTeamId = {
          ...this.onePersonEventStreamStatusByTeamId,
          [key]: 'connected',
        }
      },
      onEvent: (eventType, data, eventId) => {
        console.info('[SoloTeam] one-person team event stream:', {
          teamId: key,
          eventType,
          eventId,
          data,
        })

        const eventItems = Array.isArray(data)
          ? data
          : (Array.isArray(data?.events)
              ? data.events
              : (Array.isArray(data?.items) ? data.items : []))
        if (eventItems.length) {
          for (const item of eventItems) {
            if (!item || typeof item !== 'object') continue
            const itemEventId = item.id ?? item.event_id ?? item.eventId ?? ''
            this.applyOnePersonTeamEvent(key, {
              ...item,
              id: itemEventId,
              event_type: item.event_type || item.eventType || eventType,
            }, itemEventId)
          }
          const cursor = Number(eventId || data?.id || data?.event_id || data?.eventId || 0)
          if (Number.isFinite(cursor) && cursor > 0) {
            this.onePersonEventCursorByTeamId = { ...this.onePersonEventCursorByTeamId, [key]: cursor }
            persistEventCursor(key, cursor)
          }
          return
        }

        const event = data?.event_type || data?.eventType || data?.payload
          ? {
              ...data,
              id: data?.id ?? eventId,
              event_type: data?.event_type || data?.eventType || eventType,
            }
          : null
        if (event) {
          this.applyOnePersonTeamEvent(key, event, eventId)
        } else {
          const cursor = Number(eventId || data?.id || data?.event_id || data?.eventId || 0)
          if (Number.isFinite(cursor) && cursor > 0) {
            this.onePersonEventCursorByTeamId = { ...this.onePersonEventCursorByTeamId, [key]: cursor }
            persistEventCursor(key, cursor)
          }
        }
      },
      onError: (error) => {
        console.warn('[SoloTeam] one-person team events disconnected:', error)
        this.onePersonEventStreamStatusByTeamId = {
          ...this.onePersonEventStreamStatusByTeamId,
          [key]: 'error',
        }
        this._scheduleOnePersonTeamEventsReconnect(key)
      },
      onFinish: () => {
        this.onePersonEventStreamStatusByTeamId = {
          ...this.onePersonEventStreamStatusByTeamId,
          [key]: 'closed',
        }
        this._scheduleOnePersonTeamEventsReconnect(key)
      },
    })
  },

  unsubscribeOnePersonTeamEvents(teamId) {
    if (!teamId) return
    const key = String(teamId)
    onePersonTeamEventSubscriptions.delete(key)
    const reconnectTimer = onePersonTeamEventReconnectTimers.get(key)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      onePersonTeamEventReconnectTimers.delete(key)
    }
    onePersonTeamStreamClient.closeTeamEvents(key)
    this.onePersonEventStreamStatusByTeamId = {
      ...this.onePersonEventStreamStatusByTeamId,
      [key]: 'closed',
    }
  },

  applyOnePersonTeamEvent(teamId, event = {}, eventId = '') {
    if (!teamId || !event) return
    const key = String(teamId)
    const cursor = Number(event.id ?? eventId ?? 0)
    const currentCursor = Number(this.onePersonEventCursorByTeamId[key] ?? readStoredEventCursor(key) ?? 0)
    if (Number.isFinite(cursor) && cursor > 0 && cursor <= currentCursor) return

    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
    const eventType = event.event_type || event.eventType || ''
    const threadId = event.thread_id ?? event.threadId ?? payload.thread_id ?? payload.threadId
    const taskId = event.task_id ?? event.taskId ?? payload.task_id ?? payload.taskId ?? event.entity_id
    const runId = event.run_id ?? event.runId ?? payload.run_id ?? payload.runId

    if (eventType === 'task.created' || eventType === 'task.updated') {
      const members = this.onePersonMembersByTeamId[key] || []
      const normalized = normalizeTask({
        id: taskId,
        ...payload,
        status: payload.status,
        execution_thread_id: payload.execution_thread_id ?? payload.executionThreadId ?? threadId,
      }, members)
      if (normalized) {
        const current = this.onePersonTasksByTeamId[key] || []
        const idx = current.findIndex(item => String(item.id) === String(normalized.id))
        const next = idx === -1
          ? [normalized, ...current]
          : current.map((item, itemIdx) => itemIdx === idx ? { ...item, ...normalized } : item)
        this.onePersonTasksByTeamId = { ...this.onePersonTasksByTeamId, [key]: next }
        this.onePersonTasksLoadedByTeamId = { ...this.onePersonTasksLoadedByTeamId, [key]: true }
        this._scheduleOnePersonTaskSidebarRefresh()
        if (threadId && ['completed', 'failed', 'cancelled', 'canceled'].includes(String(normalized.status || '').toLowerCase())) {
          this._settleOnePersonThreadThinkingAfterLedger(teamId, threadId, {
            taskId: normalized.id || taskId,
          })
        }
      } else {
        void this.loadOnePersonTeamTasks(teamId, { force: true })
      }
    } else if (eventType === 'message.created' || eventType === 'message.updated') {
      if (threadId) {
        const threadKey = String(threadId)
        const state = this.onePersonMessagesByThreadId[threadKey]
        const visible = this._isOnePersonThreadVisible(teamId, threadId)
        const shouldSync = visible || state?.loaded || state?.items?.length

        if (eventType === 'message.created') {
          if (shouldSync) {
            this._scheduleOnePersonThreadAfterSeqSync(teamId, threadId, {
              taskId,
              delay: 0,
              forceIfUnloaded: visible,
            })
          } else {
            this._markOnePersonThreadDirty(threadId)
          }
          if (taskId != null && taskId !== '') {
            this._scheduleOnePersonTaskSidebarRefresh()
          }
        } else {
          if (isTerminalRunStatus(payload.run_status ?? payload.runStatus ?? payload.status)) {
            this._settleOnePersonThreadThinkingAfterLedger(teamId, threadId, { taskId })
          }
          if (shouldSync) {
            void this.loadOnePersonThreadMessages(teamId, threadId, { force: true, taskId })
          } else {
            this._markOnePersonThreadDirty(threadId)
          }
        }
      }
    } else if (eventType === 'member.presence.updated' || eventType === 'solo_team_agent_status_changed') {
      const agentId = payload.agent_id ?? payload.agentId ?? payload.member_id ?? payload.memberId ?? event.entity_id
      const nextPresence = resolveEmployeePresence(payload, payload.presence || payload.status || '')
      if (agentId != null) {
        const current = this.onePersonMembersByTeamId[key] || []
        const next = current.map(member => String(member.id) === String(agentId)
          ? { ...member, presence: nextPresence || member.presence }
          : member)
        this.onePersonMembersByTeamId = { ...this.onePersonMembersByTeamId, [key]: next }
        if (nextPresence) {
          this.privateAgents = (this.privateAgents || []).map(agent => String(agent.id ?? agent.agentId ?? agent.agent_id) === String(agentId)
            ? { ...agent, presence: nextPresence, raw: { ...(agent.raw || {}), presence: nextPresence } }
            : agent)
          this.employeeChatEmployees = (this.employeeChatEmployees || []).map(employee => String(employee.id) === String(agentId)
            ? { ...employee, presence: nextPresence, raw: { ...(employee.raw || {}), presence: nextPresence } }
            : employee)
        }
      }
      if (threadId) {
        const presence = nextPresence || resolveEmployeePresence(payload)
        if (presence === 'busy' && runId) this._setOnePersonThreadThinking(threadId, true)
        if (presence === 'idle') {
          this._settleOnePersonThreadThinkingAfterLedger(teamId, threadId, { taskId })
        }
      }
    } else if (eventType === 'team.updated' || eventType === 'member.updated' || eventType === 'approval.updated') {
      void this.loadOnePersonTeamHome(teamId, { force: true })
    }

    if (Number.isFinite(cursor) && cursor > 0) {
      this.onePersonEventCursorByTeamId = { ...this.onePersonEventCursorByTeamId, [key]: cursor }
      persistEventCursor(key, cursor)
    }
  },
}
