// 代码工程 Git 提交记录（与智能体市场发布记录分离）

/** 生成 10 位短 hash（演示） */
export function generateCommitHash() {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatCommitTime(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 分组标题：Commits on 02/06/2026 */
export function formatCommitDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `Commits on ${d}/${m}/${y}`
}

export function getProjectWorkspacePath(projectId, projectName) {
  const slug = (projectId || 'project').replace(/[^a-z0-9-]/gi, '-')
  return `/workspace/projects/${slug}`
}

/**
 * @param {object} opts
 * @returns {import('./codeVersionMock').CodeCommit}
 */
export function createCommitRecord(opts = {}) {
  const now = opts.createdAt ? new Date(opts.createdAt) : new Date()
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  return {
    id: opts.id || `commit-${now.getTime()}`,
    hash: opts.hash || generateCommitHash(),
    message: opts.message || 'update',
    author: opts.author || 'user3464111810',
    time: opts.time || formatCommitTime(now),
    date,
    source: opts.source || 'chat',
    messageId: opts.messageId || null,
    threadId: opts.threadId || null,
    changes: opts.changes || [],
  }
}

/** 按日期倒序分组提交 */
export function groupCommitsByDate(commits) {
  const map = new Map()
  for (const c of commits) {
    if (!map.has(c.date)) map.set(c.date, [])
    map.get(c.date).push(c)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      label: formatCommitDateLabel(date),
      commits: items,
    }))
}

/** 从终端命令行解析 git commit -m "..." */
export function parseGitCommitMessage(line) {
  const trimmed = (line || '').trim()
  if (!/git\s+commit/i.test(trimmed)) return null
  const m = trimmed.match(/-m\s+["']([^"']+)["']/) || trimmed.match(/-m\s+(\S+)/)
  return m ? m[1] : 'update'
}

export function buildLeaveCommits() {
  return [
    createCommitRecord({
      id: 'commit-leave-6',
      hash: 'aa1d4c1afc',
      message: 'update',
      time: '17:30',
      date: '2026-06-02',
      source: 'terminal',
    }),
    createCommitRecord({
      id: 'commit-leave-5',
      hash: '62e60611c4',
      message: 'feat: 保存文件变更',
      time: '11:38',
      date: '2026-06-02',
      source: 'chat',
      messageId: 'm-leave-3-a',
      threadId: 'thr-leave-1',
      changes: ['+86 -0 skills/leave-application/handler.py', '+24 -2 config.yaml'],
    }),
    createCommitRecord({
      id: 'commit-leave-4',
      hash: '2291be3e12',
      message: 'feat: OA系统数据持久化 - 从内存存储迁移到Supabase数据库',
      time: '11:23',
      date: '2026-06-02',
      source: 'chat',
    }),
    createCommitRecord({
      id: 'commit-leave-3',
      hash: '8958430b40',
      message: 'feat: 保存文件变更',
      time: '11:17',
      date: '2026-06-02',
      source: 'chat',
      messageId: 'm-leave-2-a',
      threadId: 'thr-leave-1',
    }),
    createCommitRecord({
      id: 'commit-leave-2',
      hash: 'c609d00e7f',
      message: 'feat: 完成OA审批Agent开发，包含请假申请、审批流程和飞书通知',
      time: '15:44',
      date: '2026-05-28',
      source: 'chat',
      messageId: 'm-leave-3-a',
      threadId: 'thr-leave-1',
      changes: ['+30 -4 SOUL.md', '+18 -1 config.yaml'],
    }),
    createCommitRecord({
      id: 'commit-leave-1',
      hash: '89b4c51df8',
      message: 'Initial commit',
      time: '15:39',
      date: '2026-05-28',
      source: 'init',
      messageId: 'm-leave-1-a',
      threadId: 'thr-leave-1',
      changes: ['+60 -0 config.yaml', '+48 -0 SOUL.md', '+20 -0 README.md'],
    }),
  ]
}

export function buildLeavePublishRecords() {
  return [
    {
      id: 'pub-leave-1',
      commitId: 'commit-leave-2',
      commitHash: 'c609d00e7f',
      commitMessage: 'feat: 完成OA审批Agent开发，包含请假申请、审批流程和飞书通知',
      publishedAt: '2026-06-02 11:30',
      marketCategory: '人事行政',
      marketSummary: '面向企业员工的请假助手，自然语言申请、余额校验、自动走 OA 审批。',
      isActive: true,
    },
  ]
}

export function buildConsultCommits() {
  return [
    createCommitRecord({
      id: 'commit-consult-3',
      hash: 'f3a8b21c90',
      message: 'feat: 接入 HIS 号源查询，完成问诊全流程',
      time: '09:20',
      date: '2026-06-02',
      messageId: 'm-consult-3-a',
      threadId: 'thr-consult-1',
    }),
    createCommitRecord({
      id: 'commit-consult-2',
      hash: 'b71204de11',
      message: 'feat: 增加分诊建议与急症识别',
      time: '14:05',
      date: '2026-05-30',
      messageId: 'm-consult-2-a',
      threadId: 'thr-consult-1',
    }),
    createCommitRecord({
      id: 'commit-consult-1',
      hash: '9c44a0ff22',
      message: 'Initial commit',
      time: '10:12',
      date: '2026-05-28',
      messageId: 'm-consult-1-a',
      threadId: 'thr-consult-1',
    }),
  ]
}

export function buildConsultPublishRecords() {
  return [
    {
      id: 'pub-consult-1',
      commitId: 'commit-consult-3',
      commitHash: 'f3a8b21c90',
      commitMessage: 'feat: 接入 HIS 号源查询，完成问诊全流程',
      publishedAt: '2026-06-02 09:30',
      marketCategory: '客户服务',
      marketSummary: '智能问诊与分诊推荐，支持急症识别与 HIS 号源查询。',
      isActive: true,
    },
  ]
}

export function buildNoteCommits() {
  return [
    createCommitRecord({
      id: 'commit-note-3',
      hash: 'e91c0a44ab',
      message: 'feat: 爆款笔记模板与小红书导出',
      time: '12:00',
      date: '2026-06-02',
      messageId: 'm-note-3-a',
      threadId: 'thr-note-1',
    }),
    createCommitRecord({
      id: 'commit-note-2',
      hash: 'd2048811fe',
      message: 'feat: 热点选题与标题钩子库',
      time: '16:30',
      date: '2026-05-31',
      messageId: 'm-note-2-a',
      threadId: 'thr-note-1',
    }),
    createCommitRecord({
      id: 'commit-note-1',
      hash: '7a33b90012',
      message: 'Initial commit',
      time: '11:00',
      date: '2026-05-28',
      messageId: 'm-note-1-a',
      threadId: 'thr-note-1',
    }),
  ]
}

export function buildNotePublishRecords() {
  return [
    {
      id: 'pub-note-1',
      commitId: 'commit-note-3',
      commitHash: 'e91c0a44ab',
      commitMessage: 'feat: 爆款笔记模板与小红书导出',
      publishedAt: '2026-06-02 12:00',
      marketCategory: '办公协同',
      marketSummary: '小红书风格爆款笔记：选题、标题、正文与标签一键生成。',
      isActive: true,
    },
  ]
}
