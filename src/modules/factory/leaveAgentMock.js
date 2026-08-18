// 请假智能体（Leave Agent）场景 Mock 数据
// 贯穿工厂全流程：对话、代码工程、数据库、集成、版本/发布

// ─── 内置头像库（复用 soloTeam people 素材）──────────────────────
import avatar1 from '@/assets/soloTeam/people_1.png'
import avatar2 from '@/assets/soloTeam/people_2.png'
import avatar3 from '@/assets/soloTeam/people_3.png'
import avatar4 from '@/assets/soloTeam/people_4.png'
import avatar5 from '@/assets/soloTeam/people_5.png'
import avatar6 from '@/assets/soloTeam/people_6.png'
import avatar7 from '@/assets/soloTeam/people_7.png'

export const BUILTIN_AVATARS = Object.freeze([
  { id: 'av-1', src: avatar1 },
  { id: 'av-2', src: avatar2 },
  { id: 'av-3', src: avatar3 },
  { id: 'av-4', src: avatar4 },
  { id: 'av-5', src: avatar5 },
  { id: 'av-6', src: avatar6 },
  { id: 'av-7', src: avatar7 },
])

export const DEFAULT_VERSION = 'V1.0.0'

// ─── 预置项目：请假智能体 ───────────────────────────────────────
export const LEAVE_PROJECT_ID = 'leave-agent'

export function buildLeaveProject() {
  return {
    id: LEAVE_PROJECT_ID,
    name: '请假智能体',
    icon: avatar2,
    avatar: avatar2,
    version: DEFAULT_VERSION,
    description: '面向企业员工的请假助手：理解请假诉求、校验假期余额、自动走 OA 审批并通知。',
    produced: true,
    createdAt: Date.now() - 86400000 * 2,
  }
}

// ─── 创建对话（左侧思考过程 + 版本卡片）──────────────────────────
export function buildLeaveThreads() {
  return {
    [LEAVE_PROJECT_ID]: [
      {
        id: 'thr-leave-1',
        title: '帮我做一个请假智能体',
        createdAt: Date.now() - 86400000 * 2,
        messages: [
          {
            id: 'm-leave-1-u',
            role: 'user',
            content: '帮我做一个请假智能体，员工可以用自然语言申请请假，能自动判断假期类型、校验余额，并提交到 OA 审批。',
            timestamp: Date.now() - 86400000 * 2,
          },
          {
            id: 'm-leave-1-a',
            role: 'assistant',
            content: `好的，我先把「请假智能体」的基础框架搭起来：

- 初始化项目结构（config.yaml / SOUL.md / skills/）
- 写入 Agent 人设与请假业务规则
- 准备请假申请、假期余额查询两个核心技能

接下来我们再逐步完善审批流转与通知能力。`,
            timestamp: Date.now() - 86400000 * 2 + 60000,
            versionInfo: {
              commitId: 'commit-leave-1',
              hash: '89b4c51df8',
              message: 'Initial commit',
              time: '2 天前',
            },
          },
          {
            id: 'm-leave-2-u',
            role: 'user',
            content: '加上假期余额校验，余额不足要提示，并支持事假、病假、年假的区分。',
            timestamp: Date.now() - 86400000,
          },
          {
            id: 'm-leave-2-a',
            role: 'assistant',
            content: `已补充假期类型与余额校验逻辑：

- 新增 leave_balance 数据表，记录各类假期余额
- 区分事假 / 病假 / 年假，分别走不同校验规则
- 余额不足时返回友好提示并阻止提交`,
            timestamp: Date.now() - 86400000 + 60000,
            versionInfo: {
              commitId: 'commit-leave-3',
              hash: '8958430b40',
              message: 'feat: 保存文件变更',
              time: '1 天前',
            },
          },
          {
            id: 'm-leave-3-u',
            role: 'user',
            content: '最后接入 OA 审批，提交后自动通知主管，并在飞书发消息给我。',
            timestamp: Date.now() - 3600000,
          },
          {
            id: 'm-leave-3-a',
            role: 'assistant',
            content: `✅ 请假智能体已完成并通过测试！

## 完成内容
- 接入内部 OA 审批系统，提交后自动创建审批单
- 通过飞书机器人推送审批进度与结果
- 完善 SOUL.md 人设：礼貌、严谨、主动澄清缺失信息

## 测试结果
✓ 申请「下周一年假 1 天」→ 校验通过 → 已提交 OA
✓ 申请「病假 3 天」但余额不足 → 正确拦截并提示
✓ 飞书通知送达

你可以在右侧「预览」里直接对话测试，或在「Agent 详情」查看版本、发布到市场。`,
            timestamp: Date.now() - 3600000 + 60000,
            versionInfo: {
              commitId: 'commit-leave-2',
              hash: 'c609d00e7f',
              message: 'feat: 完成OA审批Agent开发，包含请假申请、审批流程和飞书通知',
              time: '1 小时前',
            },
          },
        ],
      },
    ],
  }
}

// ─── 代码工程结构（req 7：skills/、config.yaml、SOUL.md、README.md）──
export function buildLeaveFileStructure() {
  return [
    {
      id: 'skills', name: 'skills', type: 'folder', desc: '技能模块',
      children: [
        {
          id: 'skills/leave-application', name: 'leave-application', type: 'folder', desc: '请假申请技能',
          children: [
            { id: 'skills/leave-application/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/leave-application/SKILL.md', desc: '请假申请技能说明' },
            { id: 'skills/leave-application/handler.py', name: 'handler.py', type: 'file', path: 'skills/leave-application/handler.py', desc: '请假申请处理逻辑' },
          ],
        },
        {
          id: 'skills/leave-balance', name: 'leave-balance', type: 'folder', desc: '假期余额查询技能',
          children: [
            { id: 'skills/leave-balance/SKILL.md', name: 'SKILL.md', type: 'file', path: 'skills/leave-balance/SKILL.md', desc: '余额查询技能说明' },
          ],
        },
      ],
    },
    { id: 'config.yaml', name: 'config.yaml', type: 'file', path: 'config.yaml', desc: 'Agent 配置' },
    { id: 'SOUL.md', name: 'SOUL.md', type: 'file', path: 'SOUL.md', desc: 'Agent 人设与行为准则' },
    { id: 'README.md', name: 'README.md', type: 'file', path: 'README.md', desc: '项目说明' },
  ]
}

// 代码文件内容（key = path）
export function buildLeaveFileContents() {
  return {
    'config.yaml': {
      content: `name: 请假智能体
version: V1.0.0
model: spark-x1
temperature: 0.3
max_tokens: 2048

leave_types:
  - { key: annual, label: 年假 }
  - { key: sick, label: 病假 }
  - { key: personal, label: 事假 }

integrations:
  - oa_approval      # 内部 OA 审批
  - feishu_bot       # 飞书通知

skills:
  - leave-application
  - leave-balance
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
    'SOUL.md': {
      content: `# 请假智能体 · 人设

## 角色
你是企业内部的「请假助手」，帮助员工高效、合规地完成请假申请。

## 性格
- 礼貌、简洁、专业
- 主动澄清缺失信息（请假类型、起止日期、事由）
- 严谨：余额不足、信息缺失时绝不擅自提交

## 工作流程
1. 理解员工的请假诉求，提取「类型 / 时间 / 时长 / 事由」
2. 调用 leave-balance 技能校验假期余额
3. 余额充足 → 调用 leave-application 提交 OA 审批
4. 通过飞书通知员工与主管审批进度

## 边界
- 不处理薪资、报销等非请假事务
- 涉及特殊假期（婚假、产假等）引导走人工 HR
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
    'README.md': {
      content: `# 请假智能体

面向企业员工的请假助手，支持自然语言申请请假、假期余额校验、OA 审批与飞书通知。

## 能力
- 🗣️ 自然语言理解请假诉求
- 📅 区分年假 / 病假 / 事假
- ✅ 假期余额自动校验
- 📨 接入 OA 审批 + 飞书通知

## 目录结构
- \`config.yaml\` — Agent 配置
- \`SOUL.md\` — 人设与行为准则
- \`skills/\` — 技能模块
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
    'skills/leave-application/SKILL.md': {
      content: `# 请假申请技能

## 描述
根据员工提供的请假类型、起止时间、事由，创建 OA 审批单。

## 输入
- type: 请假类型（annual/sick/personal）
- start_date / end_date: 起止日期
- reason: 请假事由

## 输出
- approval_id: OA 审批单号
- status: submitted / rejected
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
    'skills/leave-application/handler.py': {
      content: `# 请假申请处理逻辑
from integrations import oa_approval, feishu_bot


def handle(payload: dict) -> dict:
    """提交请假申请到 OA，并通过飞书通知。"""
    approval = oa_approval.create_ticket(
        leave_type=payload["type"],
        start=payload["start_date"],
        end=payload["end_date"],
        reason=payload.get("reason", ""),
    )
    feishu_bot.notify(
        text=f"请假申请已提交：{approval['id']}",
    )
    return {"approval_id": approval["id"], "status": "submitted"}
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
    'skills/leave-balance/SKILL.md': {
      content: `# 假期余额查询技能

## 描述
查询员工各类假期余额，供请假申请前校验。

## 输入
- user_id: 员工标识
- type: 请假类型

## 输出
- remaining_days: 剩余天数
`,
      generating: false,
      lastUpdated: Date.now() - 3600000,
    },
  }
}

// ─── 数据库（req 9）────────────────────────────────────────────
export function buildLeaveDbTables() {
  return [
    {
      name: 'leave_requests',
      desc: '请假记录表',
      rows: 3,
      size: '12 KB',
      updated: '1 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'user_id', type: 'VARCHAR(64)', pk: false, desc: '员工标识' },
        { name: 'type', type: 'VARCHAR(16)', pk: false, desc: '请假类型' },
        { name: 'start_date', type: 'DATE', pk: false, desc: '开始日期' },
        { name: 'end_date', type: 'DATE', pk: false, desc: '结束日期' },
        { name: 'status', type: 'VARCHAR(16)', pk: false, desc: '审批状态' },
      ],
      sampleRows: [
        { id: 1, user_id: '张伟', type: '年假', start_date: '2026-06-08', end_date: '2026-06-08', status: '已通过' },
        { id: 2, user_id: '李娜', type: '病假', start_date: '2026-06-03', end_date: '2026-06-05', status: '审批中' },
        { id: 3, user_id: '王芳', type: '事假', start_date: '2026-06-10', end_date: '2026-06-10', status: '已拒绝' },
      ],
    },
    {
      name: 'leave_balance',
      desc: '假期余额表',
      rows: 3,
      size: '8 KB',
      updated: '2 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'user_id', type: 'VARCHAR(64)', pk: false, desc: '员工标识' },
        { name: 'annual', type: 'INTEGER', pk: false, desc: '年假剩余(天)' },
        { name: 'sick', type: 'INTEGER', pk: false, desc: '病假剩余(天)' },
        { name: 'personal', type: 'INTEGER', pk: false, desc: '事假剩余(天)' },
      ],
      sampleRows: [
        { id: 1, user_id: '张伟', annual: 5, sick: 10, personal: 3 },
        { id: 2, user_id: '李娜', annual: 2, sick: 8, personal: 5 },
        { id: 3, user_id: '王芳', annual: 0, sick: 12, personal: 1 },
      ],
    },
    {
      name: 'approval_logs',
      desc: '审批流水',
      rows: 2,
      size: '4 KB',
      updated: '1 小时前',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, desc: '主键' },
        { name: 'request_id', type: 'INTEGER', pk: false, desc: '关联请假记录' },
        { name: 'approver', type: 'VARCHAR(64)', pk: false, desc: '审批人' },
        { name: 'action', type: 'VARCHAR(16)', pk: false, desc: '操作' },
        { name: 'created_at', type: 'DATETIME', pk: false, desc: '时间' },
      ],
      sampleRows: [
        { id: 1, request_id: 1, approver: '陈经理', action: '通过', created_at: '2026-06-02 09:20' },
        { id: 2, request_id: 3, approver: '陈经理', action: '拒绝', created_at: '2026-06-02 10:05' },
      ],
    },
  ]
}

// ─── 集成管理（req 10）─────────────────────────────────────────
// 内置集成：大模型 / 内部 OA / IT 系统；外部集成：飞书 / 云帆
export function buildIntegrations() {
  return {
    // 大模型集成：该智能体内置可用模型列表
    models: [
      { id: 'spark-x1', name: '讯飞星火 X1', vendor: '讯飞', desc: '中文理解与推理，默认模型', enabled: true, isDefault: true },
      { id: 'spark-max', name: '讯飞星火 Max', vendor: '讯飞', desc: '高性能通用大模型', enabled: true, isDefault: false },
      { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', desc: '多模态通用模型', enabled: false, isDefault: false },
      { id: 'deepseek-v3', name: 'DeepSeek V3', vendor: 'DeepSeek', desc: '代码与推理增强', enabled: false, isDefault: false },
      { id: 'qwen-max', name: '通义千问 Max', vendor: '阿里', desc: '中文通用大模型', enabled: false, isDefault: false },
    ],
    // 内部系统集成
    internal: [
      { id: 'oa_approval', name: 'OA 审批系统', icon: '🗂️', desc: '提交请假审批单、查询审批进度', connected: true, category: '内部 OA' },
      { id: 'attendance', name: '考勤系统', icon: '🕐', desc: '同步考勤、核对出勤记录', connected: true, category: '内部 OA' },
      { id: 'mail', name: '企业邮件', icon: '📧', desc: '审批结果邮件通知', connected: false, category: 'IT 系统' },
      { id: 'enterprise_im', name: '企业 IM', icon: '💬', desc: '内部即时消息推送', connected: false, category: 'IT 系统' },
    ],
    // 外部集成
    external: [
      {
        id: 'feishu',
        name: '飞书',
        icon: '🪶',
        desc: '飞书机器人推送审批进度与结果',
        settingsKey: 'feishu',
      },
      {
        id: 'yunfan',
        name: '云帆',
        icon: '⛵',
        desc: '云帆开放平台能力接入',
        settingsKey: 'yunfan',
      },
    ],
  }
}

// 代码提交 / 市场发布记录见 codeVersionMock.js（与智能体展示版本号 DEFAULT_VERSION 分离）

// ─── 引导：制作 Agent 的基础必要条件（req 4）─────────────────────
export const AGENT_ESSENTIALS = Object.freeze([
  {
    key: 'persona',
    emoji: '🎭',
    title: 'Agent 人设',
    desc: '它是谁、说话风格、服务边界（写入 SOUL.md）',
    required: true,
  },
  {
    key: 'skills',
    emoji: '🧩',
    title: '核心技能',
    desc: '它能做什么，例如：请假申请、余额查询',
    required: true,
  },
  {
    key: 'data',
    emoji: '🗄️',
    title: '业务数据',
    desc: '需要读写的数据，例如：请假记录、假期余额',
    required: false,
  },
  {
    key: 'integration',
    emoji: '🔌',
    title: '系统集成',
    desc: '依赖的外部系统，例如：OA 审批、飞书通知',
    required: false,
  },
  {
    key: 'model',
    emoji: '🧠',
    title: '驱动模型',
    desc: '选择驱动该 Agent 的大模型',
    required: true,
  },
])
