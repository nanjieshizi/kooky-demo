// 右侧底部面板 Mock：终端 / 输出（按项目）

export const BOTTOM_PANEL_STORAGE = Object.freeze({
  usedMB: 2,
  totalGB: 1,
})

const TERMINAL_BY_PROJECT = {
  'leave-agent': [
    { type: 'prompt', text: '(leave-agent) root@localhost:/workspace/projects#' },
    { type: 'cmd', text: 'git status' },
    { type: 'out', text: ' M config.yaml' },
    { type: 'out', text: ' M SOUL.md' },
    { type: 'out', text: ' M skills/leave-application/handler.py' },
    { type: 'cmd', text: 'git add . && git commit -m "feat: 请假智能体 OA 接入"' },
    { type: 'out', text: '[main a1b2c3d] 3 files changed, 86 insertions(+)' },
  ],
  'consult-agent': [
    { type: 'prompt', text: '(consult-agent) root@localhost:/workspace/projects#' },
    { type: 'cmd', text: 'python -m skills.symptom_intake --dry-run' },
    { type: 'out', text: '✓ symptom_kb loaded (4 entries)' },
    { type: 'out', text: '✓ triage-recommend ready' },
    { type: 'cmd', text: 'pytest tests/test_triage.py -q' },
    { type: 'out', text: '3 passed in 0.42s' },
  ],
  'note-agent': [
    { type: 'prompt', text: '(note-agent) root@localhost:/workspace/projects#' },
    { type: 'cmd', text: 'npm run build:preview' },
    { type: 'out', text: '✓ Built note-writing skill' },
    { type: 'out', text: '✓ hot_topics sync: 3 keywords' },
    { type: 'cmd', text: 'node scripts/export-xhs-draft.js' },
    { type: 'out', text: 'Draft saved → 夏日防晒' },
  ],
}

const OUTPUT_BY_PROJECT = {
  'leave-agent': [
    '[10:02:11] INFO  Agent build pipeline started',
    '[10:02:14] INFO  Writing config.yaml, SOUL.md',
    '[10:02:18] INFO  skills/leave-application → OK',
    '[10:02:21] INFO  skills/leave-balance → OK',
    '[10:02:24] INFO  db: leave_requests, leave_balance created',
    '[10:02:28] SUCCESS Build finished · V1.0.0',
  ],
  'consult-agent': [
    '[09:15:02] INFO  Initializing consult-agent workspace',
    '[09:15:08] INFO  symptom-intake handler compiled',
    '[09:15:12] WARN  HIS endpoint mock mode',
    '[09:15:16] INFO  triage-recommend rules loaded',
    '[09:15:20] SUCCESS Preview ready',
  ],
  'note-agent': [
    '[14:08:01] INFO  note-writing skill code-gen complete',
    '[14:08:05] INFO  Template library: 3 hooks',
    '[14:08:09] INFO  xiaohongshu draft exporter idle',
    '[14:08:12] SUCCESS Agent V1.0.0 ready',
  ],
}

const DEFAULT_TERMINAL = [
  { type: 'prompt', text: '(agent-factory) root@localhost:/workspace/projects#' },
  { type: 'out', text: '等待 Agent 生成完成…' },
  { type: 'cmd', text: 'echo "Ready"' },
  { type: 'out', text: 'Ready' },
]

const DEFAULT_OUTPUT = [
  '[--:--:--] INFO  Waiting for build output…',
]

export function getTerminalLines(projectId) {
  return TERMINAL_BY_PROJECT[projectId] || DEFAULT_TERMINAL
}

export function getOutputLines(projectId) {
  return OUTPUT_BY_PROJECT[projectId] || DEFAULT_OUTPUT
}
