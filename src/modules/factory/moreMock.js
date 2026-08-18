// 工厂"更多"区子页面的 mock 数据

// ─── 版本 ─────────────────────────────────────
export const VERSION_LIST = [
  {
    id: 'v3',
    hash: '91a63a9',
    time: '几秒前',
    status: 'current',
    statusText: '当前',
    desc: 'feat: 创建问诊 Agent，提供症状诊断、原因分析和护理建议',
    changes: ['+12 -3 prompt.md', '+45 -0 tools/diagnosis.js', '+8 -2 config.yaml'],
    messageId: 'm-1-1-a',
  },
  {
    id: 'v2',
    hash: 'f4e82b1',
    time: '10 分钟前',
    status: 'tested',
    statusText: '已测试',
    desc: 'feat: 添加多轮对话追问能力，优化症状分析准确度',
    changes: ['+28 -5 prompt.md', '+15 -8 tools/followup.js'],
    messageId: 'm-1-0-a',
  },
  {
    id: 'v1',
    hash: 'a1c09d4',
    time: '1 小时前',
    status: 'draft',
    statusText: '草稿',
    desc: 'init: 初始化问诊 Agent 基础框架',
    changes: ['+120 -0 prompt.md', '+35 -0 config.yaml', '+60 -0 tools/diagnosis.js'],
    messageId: 'm-1--1-a',
  },
]

// ─── 知识库 ────────────────────────────────────
export const KB_ITEMS = [
  { id: 'k1', type: 'file', name: '公司考勤与请假管理制度.pdf', meta: '1.8 MB', time: '5 分钟前', isNew: true },
  { id: 'k2', type: 'file', name: '各类假期申请说明.docx', meta: '860 KB', time: '今天 09:20' },
  { id: 'k3', type: 'url', name: '人事 OA 审批流程说明', meta: 'oa.example.com', time: '昨天 16:42' },
  { id: 'k4', type: 'file', name: '年假折算规则.md', meta: '24 KB', time: '2 天前' },
  { id: 'k5', type: 'file', name: '法定节假日安排.xlsx', meta: '46 KB', time: '3 天前' },
]

// ─── Skill ─────────────────────────────────────
export const SKILL_ITEMS = [
  {
    id: 'sk1',
    name: '请假申请',
    desc: '根据请假类型、起止时间提交 OA 审批单',
    iconEmoji: '📝',
    icon: 'file-text',
    source: 'builtin',
    enabled: true,
    category: '内置',
    version: '1.0.0',
    params: [
      { key: 'auto_submit', label: '自动提交', value: 'true', type: 'text' },
      { key: 'notify', label: '通知渠道', value: 'feishu', type: 'text' },
    ],
    sample: {
      input: '{ "type": "annual", "start_date": "2026-06-08", "end_date": "2026-06-08" }',
      output: '{ "approval_id": "OA-20260608-001", "status": "submitted" }',
    },
  },
  {
    id: 'sk2',
    name: '假期余额查询',
    desc: '查询员工各类假期剩余天数',
    iconEmoji: '🗄️',
    icon: 'database',
    source: 'builtin',
    enabled: true,
    category: '内置',
    version: '1.0.0',
    params: [{ key: 'timeout', label: '超时(ms)', value: '5000', type: 'number' }],
    sample: {
      input: '{ "user_id": "张伟", "type": "annual" }',
      output: '{ "remaining_days": 5 }',
    },
  },
  {
    id: 'sk3',
    name: '网页搜索',
    desc: '调用搜索引擎获取实时信息',
    iconEmoji: '🌐',
    icon: 'globe',
    source: 'market',
    enabled: true,
    category: '市场',
    version: '2.1.0',
    params: [
      { key: 'engine', label: '搜索引擎', value: 'bing', type: 'text' },
      { key: 'max_results', label: '最大结果数', value: '5', type: 'number' },
    ],
    sample: {
      input: '{ "query": "2026 春季流感趋势" }',
      output: '{ "items": [{ "title": "...", "url": "..." }] }',
    },
  },
  {
    id: 'sk4',
    name: '代码执行',
    desc: '在沙箱中执行 Python/JS 代码',
    iconEmoji: '💻',
    icon: 'terminal',
    source: 'market',
    enabled: false,
    category: '市场',
    version: '1.3.2',
    params: [
      { key: 'language', label: '语言', value: 'python', type: 'text' },
      { key: 'timeout', label: '超时(ms)', value: '30000', type: 'number' },
    ],
    sample: {
      input: '{ "code": "print(sum(range(100)))" }',
      output: '{ "stdout": "4950", "exit_code": 0 }',
    },
  },
  {
    id: 'sk5',
    name: '生成报告',
    desc: '根据对话内容生成结构化咨询报告',
    iconEmoji: '📄',
    icon: 'file-text',
    source: 'custom',
    enabled: true,
    category: '自定义',
    version: '1.0.0',
    params: [{ key: 'format', label: '输出格式', value: 'markdown', type: 'text' }],
    sample: {
      input: '{ "thread_id": "thr-1-1" }',
      output: '{ "report": "# 问诊报告\\n\\n..." }',
    },
  },
  {
    id: 'sk6',
    name: '发送邮件',
    desc: '通过 SMTP 发送邮件通知',
    iconEmoji: '✉️',
    icon: 'mail',
    source: 'market',
    enabled: false,
    category: '市场',
    version: '1.0.5',
    params: [
      { key: 'smtp_host', label: 'SMTP 主机', value: '', type: 'text' },
      { key: 'smtp_port', label: '端口', value: '465', type: 'number' },
    ],
    sample: {
      input: '{ "to": "user@example.com", "subject": "问诊提醒" }',
      output: '{ "ok": true, "message_id": "..." }',
    },
  },
]

// 市场可安装的 Skill（"添加 Skill -> 市场" Tab 使用）
export const SKILL_MARKET_ITEMS = [
  { id: 'm1', name: '图片生成', desc: '基于 Stable Diffusion 生成图片', icon: 'image', installs: '2.3k' },
  { id: 'm2', name: 'PDF 解析', desc: '提取 PDF 文档中的结构化内容', icon: 'file-text', installs: '1.8k' },
  { id: 'm3', name: 'HTTP 请求', desc: '发起自定义 HTTP API 调用', icon: 'globe', installs: '3.1k' },
  { id: 'm4', name: '日程管理', desc: '创建、查询和管理日历事件', icon: 'calendar', installs: '956' },
  { id: 'm5', name: '数据可视化', desc: '生成图表和数据可视化', icon: 'bar-chart', installs: '1.5k' },
  { id: 'm6', name: '语音合成', desc: '将文本转换为自然语音', icon: 'volume', installs: '720' },
]

// ─── 数据库 ────────────────────────────────────
export const DB_TABLES = [
  {
    name: 'consultations',
    desc: '问诊记录表',
    rows: 142,
    size: '34 KB',
    updated: '5 分钟前',
    columns: [
      { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
      { name: 'user_id', type: 'VARCHAR(64)', pk: false, desc: '用户标识' },
      { name: 'symptoms', type: 'TEXT', pk: false, desc: '症状描述' },
      { name: 'diagnosis', type: 'TEXT', pk: false, desc: '诊断建议' },
      { name: 'created_at', type: 'DATETIME', pk: false, desc: '创建时间' },
    ],
    sampleRows: [
      { id: 1, user_id: 'u_001', symptoms: '头痛、发烧、喉咙痛', diagnosis: '上呼吸道感染', created_at: '2026-05-22 08:16' },
      { id: 2, user_id: 'u_002', symptoms: '咳嗽、胸闷', diagnosis: '建议就医排查', created_at: '2026-05-22 07:42' },
      { id: 3, user_id: 'u_003', symptoms: '腹痛、腹泻', diagnosis: '急性肠胃炎', created_at: '2026-05-21 23:10' },
    ],
  },
  {
    name: 'symptoms_kb',
    desc: '症状知识库',
    rows: 583,
    size: '128 KB',
    updated: '1 小时前',
    columns: [
      { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
      { name: 'symptom', type: 'VARCHAR(128)', pk: false, desc: '症状' },
      { name: 'category', type: 'VARCHAR(64)', pk: false, desc: '分类' },
      { name: 'severity', type: 'INTEGER', pk: false, desc: '严重程度 1-5' },
    ],
    sampleRows: [
      { id: 1, symptom: '高烧 ≥ 39°C', category: '体温异常', severity: 4 },
      { id: 2, symptom: '持续性头痛', category: '神经系统', severity: 3 },
      { id: 3, symptom: '咽喉肿痛', category: '上呼吸道', severity: 2 },
    ],
  },
  {
    name: 'feedback',
    desc: '用户反馈',
    rows: 28,
    size: '6 KB',
    updated: '3 天前',
    columns: [
      { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
      { name: 'consultation_id', type: 'INTEGER', pk: false, desc: '关联问诊' },
      { name: 'rating', type: 'INTEGER', pk: false, desc: '评分 1-5' },
      { name: 'comment', type: 'TEXT', pk: false, desc: '反馈内容' },
    ],
    sampleRows: [
      { id: 1, consultation_id: 1, rating: 5, comment: '建议很有帮助' },
      { id: 2, consultation_id: 2, rating: 4, comment: '回复及时' },
    ],
  },
]

// 备份记录
export const DB_BACKUPS = [
  { id: 'bk-1', time: '今天 18:00', type: 'auto', typeText: '自动', size: '24.3 MB' },
  { id: 'bk-2', time: '昨天 18:00', type: 'auto', typeText: '自动', size: '23.8 MB' },
  { id: 'bk-3', time: '05-19 14:22', type: 'manual', typeText: '手动', size: '22.1 MB' },
]

// ─── 文件树 ────────────────────────────────────
export const FILE_TREE = [
  {
    id: 'proj-1',
    name: '问诊智能体',
    type: 'folder',
    children: [
      {
        id: 'p1-config', name: 'config', type: 'folder',
        children: [
          { id: 'p1-c1', name: 'agent.yaml', type: 'yaml' },
          { id: 'p1-c2', name: 'prompts.yaml', type: 'yaml' },
          { id: 'p1-c3', name: 'tools.yaml', type: 'yaml' },
        ],
      },
      {
        id: 'p1-src', name: 'src', type: 'folder',
        children: [
          {
            id: 'p1-agents', name: 'agents', type: 'folder',
            children: [
              { id: 'p1-a1', name: 'diagnosis.py', type: 'python' },
              { id: 'p1-a2', name: 'followup.py', type: 'python' },
            ],
          },
          {
            id: 'p1-tools', name: 'tools', type: 'folder',
            children: [
              { id: 'p1-t1', name: 'kb_search.py', type: 'python' },
              { id: 'p1-t2', name: 'db_query.py', type: 'python' },
            ],
          },
          { id: 'p1-main', name: 'main.py', type: 'python' },
        ],
      },
      {
        id: 'p1-tests', name: 'tests', type: 'folder',
        children: [
          { id: 'p1-ts1', name: 'test_diagnosis.py', type: 'python' },
        ],
      },
      { id: 'p1-readme', name: 'README.md', type: 'markdown' },
      { id: 'p1-req', name: 'requirements.txt', type: 'text' },
    ],
  },
  {
    id: 'proj-2',
    name: '文档助手',
    type: 'folder',
    children: [
      {
        id: 'p2-config', name: 'config', type: 'folder',
        children: [
          { id: 'p2-c1', name: 'agent.yaml', type: 'yaml' },
          { id: 'p2-c2', name: 'prompts.yaml', type: 'yaml' },
        ],
      },
      {
        id: 'p2-src', name: 'src', type: 'folder',
        children: [
          { id: 'p2-s1', name: 'summarizer.py', type: 'python' },
          { id: 'p2-s2', name: 'formatter.py', type: 'python' },
        ],
      },
      { id: 'p2-readme', name: 'README.md', type: 'markdown' },
    ],
  },
  {
    id: 'proj-3',
    name: '客服机器人',
    type: 'folder',
    children: [
      {
        id: 'p3-config', name: 'config', type: 'folder',
        children: [
          { id: 'p3-c1', name: 'agent.yaml', type: 'yaml' },
          { id: 'p3-c2', name: 'intents.json', type: 'json' },
        ],
      },
      {
        id: 'p3-src', name: 'src', type: 'folder',
        children: [
          { id: 'p3-s1', name: 'router.py', type: 'python' },
          { id: 'p3-s2', name: 'responder.py', type: 'python' },
          { id: 'p3-s3', name: 'escalation.py', type: 'python' },
        ],
      },
      { id: 'p3-readme', name: 'README.md', type: 'markdown' },
    ],
  },
  {
    id: 'proj-4',
    name: '数据分析师',
    type: 'folder',
    children: [
      {
        id: 'p4-config', name: 'config', type: 'folder',
        children: [
          { id: 'p4-c1', name: 'agent.yaml', type: 'yaml' },
        ],
      },
      {
        id: 'p4-src', name: 'src', type: 'folder',
        children: [
          { id: 'p4-s1', name: 'analyzer.py', type: 'python' },
          { id: 'p4-s2', name: 'visualizer.py', type: 'python' },
          { id: 'p4-s3', name: 'sql_gen.py', type: 'python' },
        ],
      },
      { id: 'p4-readme', name: 'README.md', type: 'markdown' },
    ],
  },
]
