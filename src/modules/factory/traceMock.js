// 运行记录 Mock 数据
// 每个 run 自带 nodes（trace tree），与其会话一一对应。

// ─── 日期工具 ────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return isoDate(d)
}

/** 把 ISO 日期格式化为「今天 / 昨天 / MM-DD」 */
export function formatRelativeDate(iso) {
  if (!iso) return '—'
  const today = isoDate(new Date())
  const yesterday = daysAgoIso(1)
  if (iso === today) return '今天'
  if (iso === yesterday) return '昨天'
  return iso.slice(5) // MM-DD
}

// 通用节点 input/output mock（run1 详细树用）
const SAMPLE_USER_INPUT = `{
  role: "user",
  content: "我最近总是头痛，
  而且有点发烧，喉咙也疼。
  请帮我生成问诊报告"
}`

const SAMPLE_TOOLS_OUTPUT = `[
  "Send(node='tools',
  arg={'__type':
  'tool_call_with_context',
  'tool_call': {'name':
  'generate_consultation_report'..."
]`

// 知识库命中片段
const KB_HITS = [
  {
    src: '感冒诊疗指南.pdf',
    score: 0.892,
    type: 'file',
    snippet: '上呼吸道感染常见症状包括头痛、发热、咽喉疼痛，多由病毒感染引起，体温通常在 37.5-38.5°C 之间，病程一般 5-7 天可自愈。',
  },
  {
    src: '常见症状速查手册.docx',
    score: 0.847,
    type: 'file',
    snippet: '咽痛 + 发热 + 头痛三联征：首先考虑急性咽炎或上呼吸道感染。若发热 ≥ 38.5°C 持续 3 天以上需警惕流感，建议血常规检查。',
  },
  {
    src: 'WHO 流感预防指南',
    score: 0.781,
    type: 'url',
    snippet: '流感典型表现为骤起高热、肌肉酸痛、头痛、咽痛和咳嗽，潜伏期一般 1-4 天。流感与普通感冒的区别在于全身症状更重。',
  },
]

// run1 的详细调用树（与 HTML 原型对齐）
const RUN1_TREE = [
  {
    id: 'langgraph',
    name: 'LangGraph',
    duration: '9.0s',
    status: 'success',
    kind: 'generic',
    runId: '4f6f47f967cc8a91',
    input: SAMPLE_USER_INPUT,
    output: '{ messages: [...完整对话历史] }',
    children: [
      {
        id: 'model',
        name: 'model',
        duration: '8.9s',
        status: 'success',
        kind: 'generic',
        runId: 'a2b8d9e1c4f6...',
        input: '{ messages: [user_query] }',
        output: '{ tool_calls: [...] }',
        children: [
          {
            id: 'chatopenai',
            name: 'ChatOpenAI',
            duration: '8.9s',
            status: 'success',
            kind: 'generic',
            runId: '7c1e2a3b4d5f...',
            tokenUsage: '2,341 tokens',
            input: SAMPLE_USER_INPUT,
            output: `{
  role: "assistant",
  content: null,
  tool_calls: [{
    name: "retrieve_knowledge",
    args: { query: "头痛 发烧..." }
  }]
}`,
          },
          {
            id: 'model_to_tools',
            name: 'model_to_tools',
            duration: '0ms',
            status: 'success',
            kind: 'generic',
            runId: '4f6f47f967cc...',
            input: SAMPLE_USER_INPUT,
            output: SAMPLE_TOOLS_OUTPUT,
          },
        ],
      },
      {
        id: 'tools',
        name: 'tools',
        duration: '15ms',
        status: 'success',
        kind: 'generic',
        runId: '9d8c7b6a5e4f...',
        input: '{ tool_calls: [...] }',
        output: '{ tool_results: [...] }',
        children: [
          {
            id: 'retrieve_knowledge',
            name: 'retrieve_knowledge',
            duration: '8ms',
            status: 'success',
            kind: 'kb',
            query: '头痛 发烧 喉咙疼 上呼吸道感染 症状诊断',
            topK: 3,
            threshold: 0.75,
            hits: KB_HITS,
          },
          {
            id: 'generate_consultation_report',
            name: 'generate_consultation_report',
            duration: '5ms',
            status: 'success',
            kind: 'generic',
            runId: 'e1f2a3b4c5d6...',
            input: `{
  symptoms: ["头痛", "发烧", "咽痛"],
  knowledge_hits: [...]
}`,
            output: `{
  diagnosis: "上呼吸道感染（疑似）",
  suggestions: [
    "多饮水、注意休息",
    "如发热超 38.5°C 服用退烧药",
    "症状持续 3 天以上建议就医"
  ]
}`,
          },
          {
            id: 'tools_to_model',
            name: 'tools_to_model',
            duration: '1ms',
            status: 'success',
            kind: 'generic',
            runId: '8a9b0c1d2e3f...',
            input: '{ tool_results: [...] }',
            output: '{ messages: [...with_tool_response] }',
          },
        ],
      },
    ],
  },
]

// 为其他 run 构造一棵简化的 stub 调用树
export function makeStubTree(runId, query, duration, status = 'success') {
  const trimmed = (query || '').slice(0, 50)
  const errorOutput = '{ error: "request timeout / no response" }'
  return [
    {
      id: `${runId}-langgraph`,
      name: 'LangGraph',
      duration,
      status,
      kind: 'generic',
      runId,
      input: `{\n  role: "user",\n  content: "${trimmed}${(query || '').length > 50 ? '...' : ''}"\n}`,
      output: status === 'success' ? '{ messages: [...完整对话历史] }' : errorOutput,
      children: [
        {
          id: `${runId}-model`,
          name: 'model',
          duration,
          status,
          kind: 'generic',
          runId: `${runId}-mdl`,
          tokenUsage: '~ 1.2K tokens',
          input: '{ messages: [user_query] }',
          output: status === 'success' ? '{ content: "..." }' : errorOutput,
        },
      ],
    },
  ]
}

// 历史运行记录列表（每条 run 自带 nodes）
// 日期相对于今天动态生成，让 demo 始终显示「今天 / 昨天」
export const TRACE_RUNS = [
  {
    id: 'run1',
    time: '08:16',
    date: daysAgoIso(0),
    status: 'success',
    duration: '9.0s',
    nodes: RUN1_TREE,
  },
  {
    id: 'run2',
    time: '07:42',
    date: daysAgoIso(0),
    status: 'success',
    duration: '11.2s',
    nodes: makeStubTree('run2', '帮我查一下张三的就诊记录', '11.2s'),
  },
  {
    id: 'run3',
    time: '06:55',
    date: daysAgoIso(0),
    status: 'error',
    duration: '3.1s',
    nodes: makeStubTree('run3', '我想预约下周一的门诊', '3.1s', 'error'),
  },
  {
    id: 'run4',
    time: '23:10',
    date: daysAgoIso(1),
    status: 'success',
    duration: '8.7s',
    nodes: makeStubTree('run4', '请问感冒了应该吃什么药？', '8.7s'),
  },
  {
    id: 'run5',
    time: '18:30',
    date: daysAgoIso(1),
    status: 'success',
    duration: '10.4s',
    nodes: makeStubTree('run5', '帮我分析下最近的就诊数据', '10.4s'),
  },
  {
    id: 'run6',
    time: '14:05',
    date: daysAgoIso(2),
    status: 'error',
    duration: '2.8s',
    nodes: makeStubTree('run6', '生成本周问诊报告', '2.8s', 'error'),
  },
]

// 日期下拉选项：最近 5 天
export const TRACE_DATES = [0, 1, 2, 3, 4].map(daysAgoIso)

export const DEFAULT_ACTIVE_RUN_ID = 'run1'
export const DEFAULT_ACTIVE_NODE_ID = 'model_to_tools'
