// 额外预置的「已产出、可预览」Agent 示例：问诊智能体、爆款笔记生成 Agent
// 数据结构与 leaveAgentMock 保持一致，便于 store 统一以「项目 + 产物快照」方式装载。

import avatar3 from '@/assets/soloTeam/people_3.png'
import avatar5 from '@/assets/soloTeam/people_5.png'
import { DEFAULT_VERSION } from './leaveAgentMock'
import {
  buildConsultCommits,
  buildConsultPublishRecords,
  buildNoteCommits,
  buildNotePublishRecords,
} from './codeVersionMock'

// 通用大模型集成列表（各 Agent 默认模型不同）
function buildModels(defaultId) {
  const base = [
    { id: 'spark-x1', name: '讯飞星火 X1', vendor: '讯飞', desc: '中文理解与推理' },
    { id: 'spark-max', name: '讯飞星火 Max', vendor: '讯飞', desc: '高性能通用大模型' },
    { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', desc: '多模态通用模型' },
    { id: 'deepseek-v3', name: 'DeepSeek V3', vendor: 'DeepSeek', desc: '代码与推理增强' },
    { id: 'qwen-max', name: '通义千问 Max', vendor: '阿里', desc: '中文通用大模型' },
  ]
  return base.map(m => ({
    ...m,
    enabled: m.id === defaultId,
    isDefault: m.id === defaultId,
  }))
}

// ═══════════════════════════════════════════════════════════════
// 1. 问诊智能体
// ═══════════════════════════════════════════════════════════════
export const CONSULT_PROJECT_ID = 'consult-agent'

function buildConsultProject() {
  return {
    id: CONSULT_PROJECT_ID,
    name: '问诊智能体',
    icon: avatar3,
    avatar: avatar3,
    version: DEFAULT_VERSION,
    description: '面向患者的智能问诊助手：采集症状、智能分诊、给出就医建议并提醒线下就诊。',
    produced: true,
    createdAt: Date.now() - 86400000 * 4,
  }
}

function buildConsultThread() {
  return [
    {
      id: 'thr-consult-1',
      title: '做一个智能问诊助手',
      createdAt: Date.now() - 86400000 * 4,
      messages: [
        {
          id: 'm-consult-1-u',
          role: 'user',
          content: '帮我做一个问诊智能体，患者描述症状后，能追问关键信息、判断可能的科室并给出就医建议。',
          timestamp: Date.now() - 86400000 * 4,
        },
        {
          id: 'm-consult-1-a',
          role: 'assistant',
          content: `好的，我先搭建「问诊智能体」基础框架：

- 初始化项目结构（config.yaml / SOUL.md / skills/）
- 写入医疗问诊人设：严谨、共情、不做确诊
- 准备症状采集、智能分诊两个核心技能`,
          timestamp: Date.now() - 86400000 * 4 + 60000,
          versionInfo: {
            commitId: 'commit-consult-1', hash: '9c44a0ff22', message: 'Initial commit', time: '4 天前',
          },
        },
        {
          id: 'm-consult-2-u',
          role: 'user',
          content: '增加分诊建议，根据症状推荐科室，并对急症给出紧急提醒。',
          timestamp: Date.now() - 86400000 * 2,
        },
        {
          id: 'm-consult-2-a',
          role: 'assistant',
          content: `已补充分诊与急症识别：

- 新增 symptom_kb 症状知识库，映射症状到科室
- 识别胸痛、呼吸困难等高危症状 → 触发急症提醒
- 始终提示「仅供参考，请及时线下就医」`,
          timestamp: Date.now() - 86400000 * 2 + 60000,
          versionInfo: {
            commitId: 'commit-consult-2', hash: 'b71204de11', message: 'feat: 增加分诊建议与急症识别', time: '2 天前',
          },
        },
        {
          id: 'm-consult-3-u',
          role: 'user',
          content: '接入医院 HIS 系统，能查询号源并引导挂号。',
          timestamp: Date.now() - 3600000 * 5,
        },
        {
          id: 'm-consult-3-a',
          role: 'assistant',
          content: `✅ 问诊智能体已完成并通过测试！

## 完成内容
- 接入医院 HIS 系统，查询科室号源并引导挂号
- 完善 SOUL.md 人设：共情、严谨、明确边界（不做确诊与处方）
- 全流程结尾统一附「线下就医」提醒

## 测试结果
✓ 「最近总是头晕、乏力」→ 追问后建议神经内科
✓ 「突然胸口剧痛」→ 触发急症提醒并建议立即就医
✓ HIS 号源查询正常

可在右侧「预览」中直接对话测试，或在「Agent 详情」查看版本、发布到市场。`,
          timestamp: Date.now() - 3600000 * 5 + 60000,
          versionInfo: {
            commitId: 'commit-consult-3', hash: 'f3a8b21c90', message: 'feat: 接入 HIS 号源查询，完成问诊全流程', time: '5 小时前',
          },
        },
      ],
    },
  ]
}

function buildConsultFileStructure() {
  return [
    {
      id: 'skills', name: 'skills', type: 'folder', desc: '技能模块',
      children: [
        {
          id: 'skills/symptom-intake', name: 'symptom-intake', type: 'folder', desc: '症状采集技能',
          children: [
            { id: 'skills/symptom-intake/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/symptom-intake/SKILL.md', desc: '症状采集技能说明' },
            { id: 'skills/symptom-intake/handler.py', name: 'handler.py', type: 'file', path: 'skills/symptom-intake/handler.py', desc: '症状采集与追问逻辑' },
          ],
        },
        {
          id: 'skills/triage-recommend', name: 'triage-recommend', type: 'folder', desc: '分诊建议技能',
          children: [
            { id: 'skills/triage-recommend/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/triage-recommend/SKILL.md', desc: '分诊建议技能说明' },
          ],
        },
      ],
    },
    { id: 'config.yaml', name: 'config.yaml', type: 'file', path: 'config.yaml', desc: 'Agent 配置' },
    { id: 'SOUL.md', name: 'SOUL.md', type: 'file', path: 'SOUL.md', desc: 'Agent 人设与行为准则' },
    { id: 'README.md', name: 'README.md', type: 'file', path: 'README.md', desc: '项目说明' },
  ]
}

function buildConsultFileContents() {
  const t = Date.now() - 3600000 * 5
  return {
    'config.yaml': {
      content: `name: 问诊智能体
version: V1.0.0
model: spark-x1
temperature: 0.2
max_tokens: 2048

departments:
  - 内科
  - 外科
  - 神经内科
  - 皮肤科
  - 急诊

integrations:
  - his_system      # 医院 HIS 号源
  - wecom_bot       # 企业微信通知

skills:
  - symptom-intake
  - triage-recommend
`,
      generating: false, lastUpdated: t,
    },
    'SOUL.md': {
      content: `# 问诊智能体 · 人设

## 角色
你是一名「智能问诊助手」，帮助患者梳理症状、初步分诊并给出就医建议。

## 性格
- 共情、耐心、专业
- 主动追问关键信息（部位、持续时间、诱因、伴随症状）
- 严谨：不做确诊、不开处方、不替代医生

## 工作流程
1. 倾听并采集症状，必要时分轮追问
2. 调用 triage-recommend 映射可能科室
3. 识别急症 → 立即给出紧急就医提醒
4. 查询 HIS 号源，引导挂号

## 边界
- 不提供确诊结论与用药剂量
- 任何建议结尾都附「请及时线下就医」
`,
      generating: false, lastUpdated: t,
    },
    'README.md': {
      content: `# 问诊智能体

面向患者的智能问诊助手，支持症状采集、智能分诊、就医建议与挂号引导。

## 能力
- 🩺 多轮症状采集与追问
- 🧭 症状到科室的智能分诊
- 🚨 高危急症识别与提醒
- 🏥 接入医院 HIS 号源

## 目录结构
- \`config.yaml\` — Agent 配置
- \`SOUL.md\` — 人设与行为准则
- \`skills/\` — 技能模块
`,
      generating: false, lastUpdated: t,
    },
    'skills/symptom-intake/SKILL.md': {
      content: `# 症状采集技能

## 描述
采集患者主诉，按需多轮追问关键信息。

## 输入
- chief_complaint: 主诉
- history: 既往对话上下文

## 输出
- symptoms: 结构化症状（部位 / 时长 / 诱因 / 伴随）
- need_follow_up: 是否需要继续追问
`,
      generating: false, lastUpdated: t,
    },
    'skills/symptom-intake/handler.py': {
      content: `# 症状采集与追问逻辑
from integrations import his_system

REQUIRED_FIELDS = ["部位", "持续时间", "诱因", "伴随症状"]


def handle(payload: dict) -> dict:
    """提取结构化症状，缺失关键信息时要求追问。"""
    symptoms = extract_symptoms(payload["chief_complaint"], payload.get("history", []))
    missing = [f for f in REQUIRED_FIELDS if f not in symptoms]
    return {
        "symptoms": symptoms,
        "need_follow_up": len(missing) > 0,
        "follow_up_fields": missing,
    }


def extract_symptoms(text: str, history: list) -> dict:
    # 实际由大模型完成结构化抽取，这里仅示意
    return {"主诉": text}
`,
      generating: false, lastUpdated: t,
    },
    'skills/triage-recommend/SKILL.md': {
      content: `# 分诊建议技能

## 描述
根据结构化症状映射可能科室，并识别急症。

## 输入
- symptoms: 结构化症状

## 输出
- department: 推荐科室
- urgent: 是否急症
- advice: 就医建议
`,
      generating: false, lastUpdated: t,
    },
  }
}

function buildConsultDbTables() {
  return [
    {
      name: 'consultations', desc: '问诊记录表', rows: 3, size: '14 KB', updated: '5 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'patient', type: 'VARCHAR(64)', pk: false, desc: '患者' },
        { name: 'chief_complaint', type: 'TEXT', pk: false, desc: '主诉' },
        { name: 'department', type: 'VARCHAR(32)', pk: false, desc: '推荐科室' },
        { name: 'urgent', type: 'BOOLEAN', pk: false, desc: '是否急症' },
        { name: 'created_at', type: 'DATETIME', pk: false, desc: '时间' },
      ],
      sampleRows: [
        { id: 1, patient: '刘洋', chief_complaint: '头晕、乏力一周', department: '神经内科', urgent: '否', created_at: '2026-06-02 08:40' },
        { id: 2, patient: '赵敏', chief_complaint: '突发胸口剧痛', department: '急诊', urgent: '是', created_at: '2026-06-02 09:15' },
        { id: 3, patient: '孙强', chief_complaint: '皮肤红疹瘙痒', department: '皮肤科', urgent: '否', created_at: '2026-06-02 10:02' },
      ],
    },
    {
      name: 'symptom_kb', desc: '症状-科室知识库', rows: 4, size: '10 KB', updated: '2 天前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'symptom', type: 'VARCHAR(64)', pk: false, desc: '症状关键词' },
        { name: 'department', type: 'VARCHAR(32)', pk: false, desc: '对应科室' },
        { name: 'urgent', type: 'BOOLEAN', pk: false, desc: '是否高危' },
      ],
      sampleRows: [
        { id: 1, symptom: '胸痛', department: '急诊/心内科', urgent: '是' },
        { id: 2, symptom: '头晕乏力', department: '神经内科', urgent: '否' },
        { id: 3, symptom: '皮疹瘙痒', department: '皮肤科', urgent: '否' },
        { id: 4, symptom: '呼吸困难', department: '急诊', urgent: '是' },
      ],
    },
  ]
}

function buildConsultIntegrations() {
  return {
    models: buildModels('spark-x1'),
    internal: [
      { id: 'his_system', name: '医院 HIS 系统', icon: '🏥', desc: '查询科室号源、引导挂号', connected: true, category: '内部系统' },
      { id: 'emr', name: '电子病历(EMR)', icon: '📋', desc: '读取既往病历辅助分诊', connected: true, category: '内部系统' },
      { id: 'mail', name: '企业邮件', icon: '📧', desc: '随访结果邮件通知', connected: false, category: 'IT 系统' },
    ],
    external: [
      { id: 'wecom', name: '企业微信', icon: '💬', desc: '问诊小结与挂号提醒推送', connected: true, configFields: ['CorpID', 'Secret', 'AgentId'] },
      { id: 'yunfan', name: '云帆', icon: '⛵', desc: '云帆开放平台能力接入', settingsKey: 'yunfan' },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. 爆款笔记生成 Agent
// ═══════════════════════════════════════════════════════════════
export const NOTE_PROJECT_ID = 'note-agent'

function buildNoteProject() {
  return {
    id: NOTE_PROJECT_ID,
    name: '爆款笔记生成 Agent',
    icon: avatar5,
    avatar: avatar5,
    version: DEFAULT_VERSION,
    description: '小红书风格的爆款笔记生成助手：选题分析、标题钩子、正文与标签一键产出。',
    produced: true,
    createdAt: Date.now() - 86400000 * 3,
  }
}

function buildNoteThread() {
  return [
    {
      id: 'thr-note-1',
      title: '做一个爆款笔记生成 Agent',
      createdAt: Date.now() - 86400000 * 3,
      messages: [
        {
          id: 'm-note-1-u',
          role: 'user',
          content: '帮我做一个爆款笔记生成 Agent，输入一个主题，就能产出小红书风格的标题、正文和话题标签。',
          timestamp: Date.now() - 86400000 * 3,
        },
        {
          id: 'm-note-1-a',
          role: 'assistant',
          content: `好的，我先搭建「爆款笔记生成 Agent」基础框架：

- 初始化项目结构（config.yaml / SOUL.md / skills/）
- 写入人设：懂流量、会写钩子、口语化
- 准备选题分析、爆款文案生成两个核心技能`,
          timestamp: Date.now() - 86400000 * 3 + 60000,
          versionInfo: {
            commitId: 'commit-note-1', hash: '7a33b90012', message: 'Initial commit', time: '3 天前',
          },
        },
        {
          id: 'm-note-2-u',
          role: 'user',
          content: '标题要有钩子和 emoji，正文分点、带 emoji，结尾给 5-8 个话题标签。',
          timestamp: Date.now() - 86400000,
        },
        {
          id: 'm-note-2-a',
          role: 'assistant',
          content: `已按爆款公式优化输出：

- 标题：痛点/好奇/数字钩子 + emoji（≤20 字）
- 正文：分点表达、口语化、每段配 emoji
- 结尾：自动生成 5-8 个高流量话题标签
- 新增爆款模板库 note_templates`,
          timestamp: Date.now() - 86400000 + 60000,
          versionInfo: {
            commitId: 'commit-note-2', hash: 'd2048811fe', message: 'feat: 标题钩子 + 分点正文 + 话题标签', time: '1 天前',
          },
        },
        {
          id: 'm-note-3-u',
          role: 'user',
          content: '接入热点选题，能结合当下热点给选题建议，并能一键发布到小红书草稿箱。',
          timestamp: Date.now() - 3600000 * 3,
        },
        {
          id: 'm-note-3-a',
          role: 'assistant',
          content: `✅ 爆款笔记生成 Agent 已完成并通过测试！

## 完成内容
- 接入热点选题源，结合实时热点给出选题建议
- 支持一键导出到小红书草稿箱
- 完善 SOUL.md 人设：懂流量、会造钩子、口语自然不端着

## 测试结果
✓ 输入「夏日防晒」→ 产出标题《☀️ 防晒踩了3年坑，这篇帮你省2000》+ 正文 + 标签
✓ 选题建议结合当日热点
✓ 草稿箱导出成功

可在右侧「预览」中直接对话测试，或在「Agent 详情」查看版本、发布到市场。`,
          timestamp: Date.now() - 3600000 * 3 + 60000,
          versionInfo: {
            commitId: 'commit-note-3', hash: 'e91c0a44ab', message: 'feat: 爆款笔记模板与小红书导出', time: '3 小时前',
          },
        },
      ],
    },
  ]
}

function buildNoteFileStructure() {
  return [
    {
      id: 'skills', name: 'skills', type: 'folder', desc: '技能模块',
      children: [
        {
          id: 'skills/topic-analysis', name: 'topic-analysis', type: 'folder', desc: '选题分析技能',
          children: [
            { id: 'skills/topic-analysis/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/topic-analysis/SKILL.md', desc: '选题分析技能说明' },
          ],
        },
        {
          id: 'skills/note-writing', name: 'note-writing', type: 'folder', desc: '爆款文案生成技能',
          children: [
            { id: 'skills/note-writing/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/note-writing/SKILL.md', desc: '文案生成技能说明' },
            { id: 'skills/note-writing/handler.py', name: 'handler.py', type: 'file', path: 'skills/note-writing/handler.py', desc: '爆款文案生成逻辑' },
          ],
        },
      ],
    },
    { id: 'config.yaml', name: 'config.yaml', type: 'file', path: 'config.yaml', desc: 'Agent 配置' },
    { id: 'SOUL.md', name: 'SOUL.md', type: 'file', path: 'SOUL.md', desc: 'Agent 人设与行为准则' },
    { id: 'README.md', name: 'README.md', type: 'file', path: 'README.md', desc: '项目说明' },
  ]
}

function buildNoteFileContents() {
  const t = Date.now() - 3600000 * 3
  return {
    'config.yaml': {
      content: `name: 爆款笔记生成 Agent
version: V1.0.0
model: spark-max
temperature: 0.8
max_tokens: 2048

style:
  platform: 小红书
  tone: 口语化、有钩子
  emoji: true
  tags_count: [5, 8]

integrations:
  - hot_topics       # 热点选题源
  - xhs_draft        # 小红书草稿箱

skills:
  - topic-analysis
  - note-writing
`,
      generating: false, lastUpdated: t,
    },
    'SOUL.md': {
      content: `# 爆款笔记生成 Agent · 人设

## 角色
你是一名资深小红书内容操盘手，擅长把任何主题写成有点击欲的爆款笔记。

## 性格
- 懂流量、会造钩子、口语自然不端着
- 善用 emoji 与分点表达
- 真实有用，不夸大、不虚假宣传

## 写作公式
1. 标题：痛点 / 好奇 / 数字钩子 + emoji（≤20 字）
2. 正文：开头共鸣 → 分点干货（每点配 emoji）→ 结尾行动号召
3. 标签：结合主题与热点生成 5-8 个高流量话题

## 边界
- 不编造数据与功效，不做违规宣传
- 涉及医疗、金融等敏感领域提示谨慎
`,
      generating: false, lastUpdated: t,
    },
    'README.md': {
      content: `# 爆款笔记生成 Agent

小红书风格的爆款笔记生成助手，输入主题即可产出标题、正文与话题标签。

## 能力
- 🔥 结合热点的选题分析
- ✍️ 钩子标题 + 分点正文
- #️⃣ 高流量话题标签
- 📤 一键导出小红书草稿箱

## 目录结构
- \`config.yaml\` — Agent 配置
- \`SOUL.md\` — 人设与行为准则
- \`skills/\` — 技能模块
`,
      generating: false, lastUpdated: t,
    },
    'skills/topic-analysis/SKILL.md': {
      content: `# 选题分析技能

## 描述
结合主题与实时热点，给出有爆款潜力的选题方向。

## 输入
- topic: 主题
- audience: 目标人群（可选）

## 输出
- angles: 选题角度列表
- hot_match: 关联的热点
`,
      generating: false, lastUpdated: t,
    },
    'skills/note-writing/SKILL.md': {
      content: `# 爆款文案生成技能

## 描述
按小红书爆款公式生成标题、正文与话题标签。

## 输入
- topic: 主题
- angle: 选题角度

## 输出
- title: 钩子标题
- body: 分点正文
- tags: 话题标签数组
`,
      generating: false, lastUpdated: t,
    },
    'skills/note-writing/handler.py': {
      content: `# 爆款文案生成逻辑
from integrations import hot_topics, xhs_draft


def handle(payload: dict) -> dict:
    """根据主题与角度生成标题/正文/标签，并可选导出草稿箱。"""
    topic = payload["topic"]
    angle = payload.get("angle", "")
    hots = hot_topics.fetch(topic)

    title = build_title(topic, angle)
    body = build_body(topic, angle)
    tags = build_tags(topic, hots)

    if payload.get("export_draft"):
        xhs_draft.save(title=title, body=body, tags=tags)

    return {"title": title, "body": body, "tags": tags}


def build_title(topic, angle):
    return f"☀️ {topic}踩了3年坑，这篇帮你少走弯路"


def build_body(topic, angle):
    return "（由大模型按爆款公式生成的分点正文）"


def build_tags(topic, hots):
    return [f"#{topic}", "#干货分享", "#好物推荐", "#经验贴", "#避坑指南"]
`,
      generating: false, lastUpdated: t,
    },
  }
}

function buildNoteDbTables() {
  return [
    {
      name: 'generated_notes', desc: '生成记录表', rows: 3, size: '16 KB', updated: '3 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'topic', type: 'VARCHAR(64)', pk: false, desc: '主题' },
        { name: 'title', type: 'VARCHAR(64)', pk: false, desc: '标题' },
        { name: 'tags', type: 'VARCHAR(255)', pk: false, desc: '话题标签' },
        { name: 'status', type: 'VARCHAR(16)', pk: false, desc: '状态' },
        { name: 'created_at', type: 'DATETIME', pk: false, desc: '时间' },
      ],
      sampleRows: [
        { id: 1, topic: '夏日防晒', title: '☀️防晒踩了3年坑，这篇帮你省2000', tags: '#防晒 #夏日好物 #避坑指南', status: '已导出', created_at: '2026-06-02 13:10' },
        { id: 2, topic: '通勤穿搭', title: '👔月薪5k也能穿出高级感', tags: '#通勤穿搭 #穿搭分享', status: '草稿', created_at: '2026-06-02 14:02' },
        { id: 3, topic: '减脂餐', title: '🥗7天减脂餐，好吃到舔盘', tags: '#减脂餐 #健康饮食 #食谱', status: '已导出', created_at: '2026-06-02 15:20' },
      ],
    },
    {
      name: 'note_templates', desc: '爆款模板库', rows: 3, size: '6 KB', updated: '1 天前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'name', type: 'VARCHAR(32)', pk: false, desc: '模板名' },
        { name: 'hook_type', type: 'VARCHAR(16)', pk: false, desc: '钩子类型' },
        { name: 'pattern', type: 'TEXT', pk: false, desc: '标题模板' },
      ],
      sampleRows: [
        { id: 1, name: '数字钩子', hook_type: '数字', pattern: '{N}个{主题}技巧，第{X}个绝了' },
        { id: 2, name: '痛点钩子', hook_type: '痛点', pattern: '{主题}踩了{N}年坑，这篇帮你少走弯路' },
        { id: 3, name: '好奇钩子', hook_type: '好奇', pattern: '没想到{主题}还能这样，看完惊呆' },
      ],
    },
    {
      name: 'hot_topics', desc: '热点选题表', rows: 3, size: '5 KB', updated: '3 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'keyword', type: 'VARCHAR(32)', pk: false, desc: '热点关键词' },
        { name: 'heat', type: 'INTEGER', pk: false, desc: '热度' },
        { name: 'category', type: 'VARCHAR(16)', pk: false, desc: '分类' },
      ],
      sampleRows: [
        { id: 1, keyword: '多巴胺穿搭', heat: 9800, category: '穿搭' },
        { id: 2, keyword: '平价防晒', heat: 8600, category: '美妆' },
        { id: 3, keyword: '减脂食谱', heat: 7400, category: '美食' },
      ],
    },
  ]
}

function buildNoteIntegrations() {
  return {
    models: buildModels('spark-max'),
    internal: [
      { id: 'content_lib', name: '内容素材库', icon: '🗃️', desc: '复用历史爆款与素材', connected: true, category: '内部系统' },
      { id: 'review', name: '内容合规审核', icon: '🛡️', desc: '发布前敏感词与合规校验', connected: true, category: 'IT 系统' },
    ],
    external: [
      { id: 'xiaohongshu', name: '小红书开放平台', icon: '📕', desc: '一键导出到小红书草稿箱', connected: true, configFields: ['AppKey', 'AppSecret', '授权账号'] },
      { id: 'douyin', name: '抖音', icon: '🎵', desc: '同步图文到抖音', connected: false, configFields: ['ClientKey', 'ClientSecret'] },
      { id: 'yunfan', name: '云帆', icon: '⛵', desc: '云帆开放平台能力接入', settingsKey: 'yunfan' },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// 统一导出：供 store 装载为「项目 + 产物快照」
// ═══════════════════════════════════════════════════════════════
export function buildPresetAgents() {
  return [
    {
      project: buildConsultProject(),
      thread: buildConsultThread(),
      defaultThreadId: 'thr-consult-1',
      artifacts: {
        codeFileStructure: buildConsultFileStructure(),
        codeFiles: buildConsultFileContents(),
        dbTables: buildConsultDbTables(),
        integrations: buildConsultIntegrations(),
        codeCommits: buildConsultCommits(),
        publishRecords: buildConsultPublishRecords(),
        selectedCodePath: 'README.md',
        openCodeFiles: ['README.md'],
      },
    },
    {
      project: buildNoteProject(),
      thread: buildNoteThread(),
      defaultThreadId: 'thr-note-1',
      artifacts: {
        codeFileStructure: buildNoteFileStructure(),
        codeFiles: buildNoteFileContents(),
        dbTables: buildNoteDbTables(),
        integrations: buildNoteIntegrations(),
        codeCommits: buildNoteCommits(),
        publishRecords: buildNotePublishRecords(),
        selectedCodePath: 'README.md',
        openCodeFiles: ['README.md'],
      },
    },
  ]
}
