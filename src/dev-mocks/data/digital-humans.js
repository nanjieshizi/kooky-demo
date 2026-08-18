/**
 * dev-mocks 数字人数据（v2）
 *
 * 卡片样式参考用户提供的"测试数字人 v10.0.2"截图：
 *   - 头像 + 名称 + 版本号
 *   - 一句话描述（强调能力 + 集成 + 价值）
 *   - 业务标签（业务领域 + 能力标签）
 *   - 上传者（来自同事池，体现"内部协作生态"）
 *   - 收藏数 / 截图数
 *   - 双 CTA：对话 + 聘用
 *
 * 数字人覆盖产品/研发/测试/设计/架构/运营与项目协作岗位，跟同事职能镜像。
 *
 * ⚠️ ID 用数字（1001-1006），因为 ChatButton 内部 Number(rawId) 校验数字 ID。
 */

import agentProductAvatar from '../assets/agent-product.png'
import agentDevAvatar from '../assets/agent-dev.png'
import agentTestAvatar from '../assets/agent-test.png'
import agentDesignAvatar from '../assets/agent-design.png'
import agentArchAvatar from '../assets/agent-arch.png'
import agentOpsAvatar from '../assets/agent-ops.png'
import pmoDigitalHumanAvatar from '@/assets/collaboration/pmo-digital-human-avatar.png'
import yunfanPmoDigitalHumanAvatar from '@/assets/collaboration/yunfan-pmo-avatar.png'
import tapdPmoDigitalHumanAvatar from '@/assets/collaboration/tapd-pmo-avatar.png'
import mkAv1 from '@/modules/market/avatar/components/images/m01@2x.png'
import mkAv2 from '@/modules/market/avatar/components/images/w02@2x.png'
import mkAv3 from '@/modules/market/avatar/components/images/m03@2x.png'
import mkAv4 from '@/modules/market/avatar/components/images/w04@2x.png'
import mkAv5 from '@/modules/market/avatar/components/images/m05@2x.png'

const NOW_MS = Date.now()
const HOUR = 3600 * 1000

// 后端原始字段格式（模拟 GET /api/personal/agent-usage 与 fetchAgentDetail 返回的结构）
// 此数据是 mock 的"事实源"，市场/聘用/对话各 API 都从这里派生
const RAW_AGENTS = [
  {
    agent_id: 1001,
    agent_name: 'product-digital-human',
    agent_display_name: '产品数字人',
    agent_version: 'v3.2.1',
    agent_avatar_url: agentProductAvatar,
    agent_description: 'AI驱动的全栈产品经理，覆盖需求分析、用户研究、PRD撰写、原型设计、产品规划等全链路产品能力。能直接拉磐石需求、生成结构化 PRD、自动梳理用户旅程，让产品决策更科学。',
    agent_tags: ['效能研发', '产品策划', '需求分析', 'PRD撰写'],
    agent_uploader: '张月华',
    agent_uploader_account: 'yhzhang2',
    agent_uploaded_at: '2026-05-12',
    star_count: 24,
    download_count: 56,
    image_count: 12,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 1 * HOUR).toISOString(),
    first_used_at: '2026-05-01T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: false,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '需求拆解 / PRD 撰写 / 用户旅程 / 竞品分析',
    functions: '磐石需求拉取、Markdown PRD 生成、原型骨架描述、风险点提示',
    detailed_description: '产品数字人是 Kooky 内置的全栈产品经理 Agent，深度集成讯飞云+研发协同体系（磐石/Kode/协作）。它接入磐石需求 API 拉取上下文，按统一 PRD 模板生成结构化文档，并能在协作群里以"AI 同事"身份推进需求评审、迭代规划。',
    changelog: 'v3.2.1：优化 PRD 大纲生成，支持自定义模板段落\nv3.2.0：接入磐石需求过滤器，支持按产品线 / 迭代筛选\nv3.1.0：新增风险点自动识别',
  },
  {
    agent_id: 1002,
    agent_name: 'dev-digital-human',
    agent_display_name: '研发数字人',
    agent_version: 'v5.1.0',
    agent_avatar_url: agentDevAvatar,
    agent_description: 'AI驱动的全栈研发工程师，覆盖代码生成、Code Review、单元测试、调试排障、性能优化等全链路研发能力。深度集成 Kode 与 Git 工作流，让研发节奏更稳、质量更高。',
    agent_tags: ['效能研发', '代码生成', 'Code Review', '调试排障'],
    agent_uploader: '胡勤彪',
    agent_uploader_account: 'qbhu',
    agent_uploaded_at: '2026-05-10',
    star_count: 38,
    download_count: 92,
    image_count: 19,
    pinned: true,
    pinned_at: NOW_MS - 7 * 24 * HOUR,
    last_used_at: new Date(NOW_MS - 2 * HOUR).toISOString(),
    first_used_at: '2026-05-02T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: true,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '代码生成 / Code Review / 单元测试 / 性能调优 / 调试排障',
    functions: '多语言代码生成、PR Review 评论、单测脚手架、性能瓶颈分析',
    detailed_description: '研发数字人深度接入 Kode 终端与 Git，能在协作群里以"AI 研发"身份参与代码评审、需求拆任务、Bug 排障。覆盖 Java/Python/Go/TS 全栈语言，与讯飞研发流水线集成。',
    changelog: 'v5.1.0：新增 PR Review 主动评论能力\nv5.0.0：架构升级，支持长上下文跨文件分析\nv4.3.2：修复 TypeScript 类型推导边缘场景',
  },
  {
    agent_id: 1003,
    agent_name: 'test-digital-human',
    agent_display_name: '测试数字人',
    agent_version: 'v10.0.2',
    agent_avatar_url: agentTestAvatar,
    agent_description: 'AI驱动的全栈测试工程师，覆盖需求测试、测试方案设计、接口与UI自动化、影响范围分析等全链路测试能力，与云帆及测试平台深度集成，让测试更智能、质量更可控。',
    agent_tags: ['效能研发', '自动化测试', '影响范围分析', '需求测试'],
    agent_uploader: '郝晓升',
    agent_uploader_account: 'xshao',
    agent_uploaded_at: '2026-05-17',
    star_count: 17,
    download_count: 34,
    image_count: 0,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 3 * HOUR).toISOString(),
    first_used_at: '2026-05-03T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: false,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '需求测试 / 测试方案 / 接口自动化 / UI 自动化 / 影响范围分析',
    functions: '测试用例生成、自动化脚本骨架、需求变更影响分析、缺陷归类',
    detailed_description: '测试数字人是 Kooky 内置的智能测试工程师，与云帆测试平台深度集成。能够基于需求自动生成测试方案，识别需求变更影响范围，输出测试用例与自动化脚本骨架。',
    changelog: 'v10.0.2：修复影响范围分析的依赖追溯断链\nv10.0.0：架构重构，新增 UI 自动化支持\nv9.5.0：接入云帆缺陷库',
  },
  {
    agent_id: 1004,
    agent_name: 'design-digital-human',
    agent_display_name: '设计数字人',
    agent_version: 'v2.4.0',
    agent_avatar_url: agentDesignAvatar,
    agent_description: 'AI驱动的视觉与交互设计师，覆盖界面设计、组件规范、可用性走查、设计稿生成等全链路设计能力。基于讯飞云+ Design System 输出标准化设计稿，让设计交付更顺滑。',
    agent_tags: ['用户体验', '视觉设计', '交互设计', 'Design System'],
    agent_uploader: '员清亮',
    agent_uploader_account: 'qlyun',
    agent_uploaded_at: '2026-05-08',
    star_count: 21,
    download_count: 41,
    image_count: 15,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 4 * HOUR).toISOString(),
    first_used_at: '2026-05-04T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: false,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '界面设计 / 组件规范 / 可用性走查 / 设计稿生成',
    functions: '基于 Design System 出图、组件规范走查、交互流程提示',
    detailed_description: '设计数字人基于讯飞云+ Design System，能够输出标准化设计稿、走查组件规范、生成交互流程说明。在协作群里以"AI 设计师"身份参与产品评审。',
    changelog: 'v2.4.0：升级 Design System 至 6.0\nv2.3.0：新增交互原型描述能力',
  },
  {
    agent_id: 1005,
    agent_name: 'arch-digital-human',
    agent_display_name: '架构数字人',
    agent_version: 'v4.0.3',
    agent_avatar_url: agentArchAvatar,
    agent_description: 'AI驱动的系统架构师，覆盖技术选型、架构评审、性能优化、安全合规、容灾设计等全链路架构能力。深度集成磐石与监控平台，让架构决策有据可依。',
    agent_tags: ['效能研发', '技术选型', '架构评审', '性能优化'],
    agent_uploader: '胡勤彪',
    agent_uploader_account: 'qbhu',
    agent_uploaded_at: '2026-05-05',
    star_count: 31,
    download_count: 67,
    image_count: 8,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 5 * HOUR).toISOString(),
    first_used_at: '2026-05-05T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: false,
    risk_level: 'medium',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '技术选型 / 架构评审 / 性能优化 / 安全合规 / 容灾设计',
    functions: '架构图描述、技术对比矩阵、性能瓶颈定位、合规检查清单',
    detailed_description: '架构数字人是技术决策的辅助 Agent，能从可扩展性 / 性能 / 安全 / 成本多维度评估架构方案，输出对比矩阵和决策建议。',
    changelog: 'v4.0.3：修复 PostgreSQL 选型评估偏差\nv4.0.0：架构升级，支持多云方案对比',
  },
  {
    agent_id: 1006,
    agent_name: 'ops-digital-human',
    agent_display_name: '运营数字人',
    agent_version: 'v1.8.0',
    agent_avatar_url: agentOpsAvatar,
    agent_description: 'AI驱动的产品运营，覆盖内容生产、数据分析、用户增长、活动策划、用户反馈洞察等全链路运营能力。让运营动作有数据支撑、迭代节奏更快。',
    agent_tags: ['内容运营', '数据分析', '用户增长', '活动策划'],
    agent_uploader: '邓颖茹',
    agent_uploader_account: 'yrdeng2',
    agent_uploaded_at: '2026-05-03',
    star_count: 14,
    download_count: 28,
    image_count: 6,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 6 * HOUR).toISOString(),
    first_used_at: '2026-05-06T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: false,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '内容运营 / 数据分析 / 用户增长 / 活动策划',
    functions: '内容大纲生成、数据指标拆解、增长漏斗分析、活动方案模板',
    detailed_description: '运营数字人基于用户行为数据和市场情报，辅助产品运营做内容策划、数据复盘、增长实验。',
    changelog: 'v1.8.0：新增 A/B 实验建议\nv1.7.0：接入数据指标库',
  },
  {
    agent_id: 1007,
    agent_name: 'yunfan-digital-human',
    agent_display_name: 'PMO 数字人',
    agent_version: 'v2.0.0',
    agent_avatar_url: pmoDigitalHumanAvatar,
    agent_description: '负责项目节奏与跨角色协同的 PMO 数字人。通过云帆 Skill 查询和修改外部工单，也能维护 Kooky 项目数据并创建协作任务。',
    agent_tags: ['云帆对接', '任务同步', '代办拉取', 'Kode 联动'],
    agent_uploader: '平台研发组',
    agent_uploader_account: 'platform-ops',
    agent_uploaded_at: '2026-05-22',
    star_count: 31,
    download_count: 67,
    image_count: 5,
    pinned: true,
    pinned_at: NOW_MS - 3 * 24 * HOUR,
    last_used_at: new Date(NOW_MS - 30 * 60 * 1000).toISOString(),
    first_used_at: '2026-05-22T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: true,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '云帆代办拉取 / 任务同步到 Kode 工作区 / 状态实时回写云帆',
    functions: '云帆 API 接入、代办列表查询、任务双向绑定、状态自动同步',
    detailed_description: 'PMO 是项目协作数字人。它能通过 Skill 查询云帆任务，并按群内指令维护 Kooky 的项目看板与协作任务；第三方能力属于数字人，不是 Kooky 内置连接器。',
    changelog: 'v2.0.0：新增 Kode 工作区任务双向同步\nv1.5.0：支持代办过滤（按项目 / 优先级）\nv1.0.0：首版上线',
  },
  {
    agent_id: 1008,
    agent_name: 'yunfan-pmo-digital-human',
    agent_display_name: '云帆 PMO',
    agent_version: 'v1.3.0',
    agent_avatar_url: yunfanPmoDigitalHumanAvatar,
    agent_description: '专注云帆项目与工单协同的 PMO 数字人，可通过云帆 Skill 查询项目、维护流程并把事项转为 Kooky 协作任务。',
    agent_tags: ['云帆 Skill', '项目推进', '工单同步', '风险跟踪'],
    agent_uploader: '生态平台组',
    agent_uploader_account: 'ecosystem-platform',
    agent_uploaded_at: '2026-07-18',
    star_count: 18,
    download_count: 35,
    image_count: 4,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 2 * HOUR).toISOString(),
    first_used_at: '2026-07-18T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: true,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: '云帆项目同步 / 工单推进 / 里程碑与风险维护',
    functions: '云帆项目查询、流程修改、事项转协作任务、项目状态回写',
    detailed_description: '云帆 PMO 通过自身 Skill 对接云帆，并以当前协作群作为权限与项目上下文；Kooky 只提供通用事项和协作任务能力。',
    changelog: 'v1.3.0：支持从 Kooky 事项发起协作任务\nv1.1.0：补充群级授权校验\nv1.0.0：首版上线',
  },
  {
    agent_id: 1009,
    agent_name: 'tapd-pmo-digital-human',
    agent_display_name: 'TAPD PMO',
    agent_version: 'v1.1.0',
    agent_avatar_url: tapdPmoDigitalHumanAvatar,
    agent_description: '面向 TAPD 需求、迭代与缺陷协同的 PMO 数字人，可通过 TAPD Skill 推进事项并创建 Kooky 协作任务。',
    agent_tags: ['TAPD Skill', '迭代管理', '需求同步', '缺陷跟踪'],
    agent_uploader: '生态平台组',
    agent_uploader_account: 'ecosystem-platform',
    agent_uploaded_at: '2026-07-25',
    star_count: 12,
    download_count: 21,
    image_count: 3,
    pinned: false,
    pinned_at: null,
    last_used_at: new Date(NOW_MS - 5 * HOUR).toISOString(),
    first_used_at: '2026-07-25T10:00:00.000Z',
    is_builtin: true,
    is_official: true,
    is_followed: true,
    risk_level: 'low',
    license: 'enterprise-internal',
    scope: '集团内',
    scenarios: 'TAPD 迭代同步 / 需求与缺陷推进 / 版本风险跟踪',
    functions: 'TAPD 迭代查询、需求与缺陷更新、事项转协作任务、状态回写',
    detailed_description: 'TAPD PMO 通过自身 Skill 访问 TAPD，并把外部执行状态映射到当前群的事项与协作任务中。',
    changelog: 'v1.1.0：支持从 Kooky 事项发起协作任务\nv1.0.0：首版上线',
  },
]

/**
 * 归一化成 employeeChatEmployees 接受的格式（协作模块"数字人对话"用）
 */
function toEmployeeItem(agent) {
  return {
    id: agent.agent_id,
    name: agent.agent_display_name,
    avatar: agent.agent_avatar_url,
    pinned: !!agent.pinned,
    pinnedAt: agent.pinned_at,
    conversationScope: 'employee',
    raw: agent,
  }
}

/**
 * 企业数字人的"人事档案"：职位 + 部门归属（通讯录组织目录混编用）
 *
 * ⚠️ agent-usage 接口目前没有这两个字段，是 demo 补的。后端补上
 *    `job_title` / `department_id` 后，这块整段删掉即可。
 */
const AGENT_HR_PROFILE = {
  1001: { job_title: '数字产品经理', dept_id: 1111, department: '技术中心平台产品技术部平台产品组产研协同域产品组' },
  1002: { job_title: '数字研发工程师', dept_id: 1123, department: '技术中心平台产品技术部效率平台部前端开发组' },
  1003: { job_title: '数字测试工程师', dept_id: 121, department: '技术中心测试部业务测试二组' },
  1004: { job_title: '数字交互设计师', dept_id: 13, department: '技术中心用户体验设计部' },
  1005: { job_title: '数字系统架构师', dept_id: 1112, department: '技术中心平台产品技术部平台产品组构建运行时域产品组' },
  1006: { job_title: '数字运营专员', dept_id: 1122, department: '技术中心平台产品技术部效率平台部需求管理组' },
  1007: { job_title: '数字项目协调员', dept_id: 1121, department: '技术中心平台产品技术部效率平台部研发项目管理组' },
  1008: { job_title: '云帆数字项目经理', dept_id: 1121, department: '技术中心平台产品技术部效率平台部研发项目管理组' },
  1009: { job_title: 'TAPD 数字项目经理', dept_id: 1121, department: '技术中心平台产品技术部效率平台部研发项目管理组' },
}

/** 把人事档案并进事实源，让市场/协作/通讯录各条链路都能读到 */
RAW_AGENTS.forEach((a) => {
  const hr = AGENT_HR_PROFILE[a.agent_id]
  if (!hr) return
  a.agent_job_title = hr.job_title
  a.agent_department = hr.department
  a.agent_department_id = hr.dept_id
})

export const AGENT_DEPT_MAP = AGENT_HR_PROFILE

export const DIGITAL_HUMANS_RAW = RAW_AGENTS
export const DIGITAL_HUMANS = RAW_AGENTS.map(toEmployeeItem)

/**
 * 市场独有的数字人（**不在我的员工里**）。
 *
 * 之前市场列表 = DIGITAL_HUMANS_RAW，而那批 id 跟"我的员工"完全重合，
 * 于是市场里每个都是"已聘用"，任何"推荐可聘"的位置都是空的。
 * 这里补一批外部数字人，让市场有真正能聘的东西。
 */
export const MARKET_ONLY_AGENTS = [
  {
    agent_id: 2001,
    agent_name: 'sales-assistant',
    agent_display_name: '小销 · 销售助理',
    agent_version: 'v3.1.0',
    agent_avatar_url: mkAv1,
    agent_description: '外呼话术 + 异议处理 + CRM 自动写回，跟进不掉链子。',
    agent_tags: ['销售域', '话术', 'CRM'],
    agent_uploader: '黄燕',
    agent_uploader_account: 'yanhuang',
    star_count: 42, download_count: 128, image_count: 6,
    is_official: false, risk_level: 'low', scope: '集团内',
    scenarios: '外呼 / 异议处理 / 跟进提醒',
    functions: '话术生成、异议库匹配、CRM 写回',
    detailed_description: '面向销售场景的数字员工，覆盖从开场白到跟进闭环。',
    changelog: 'v3.1.0：新增异议库自定义',
  },
  {
    agent_id: 2002,
    agent_name: 'data-analyst',
    agent_display_name: '数据分析师 D',
    agent_version: 'v1.4.2',
    agent_avatar_url: mkAv2,
    agent_description: '多源数据整合、SQL 查询与可视化看板，业务洞察一把抓。',
    agent_tags: ['数据域', 'SQL', '看板'],
    agent_uploader: '张月华',
    agent_uploader_account: 'yhzhang2',
    star_count: 18, download_count: 64, image_count: 4,
    is_official: true, risk_level: 'low', scope: '集团内',
    scenarios: '取数 / 指标拆解 / 看板搭建',
    functions: 'SQL 生成、指标口径校验、图表建议',
    detailed_description: '接入数仓，按业务问题自动拆解指标并出图。',
    changelog: 'v1.4.2：支持多数据源联合查询',
  },
  {
    agent_id: 2003,
    agent_name: 'weekly-report',
    agent_display_name: '周报小助手',
    agent_version: 'v2.0.0',
    agent_avatar_url: mkAv3,
    agent_description: '自动汇总本周进展、生成结构化周报，周五不用熬夜。',
    agent_tags: ['效率域', '周报', '总结'],
    agent_uploader: '刘敏',
    agent_uploader_account: 'minliu27',
    star_count: 6, download_count: 30, image_count: 2,
    is_official: false, risk_level: 'low', scope: '集团内',
    scenarios: '周报 / 日报 / 复盘',
    functions: '进展抓取、结构化成文、亮点提炼',
    detailed_description: '从会话与任务里抓进展，按你的模板成文。',
    changelog: 'v2.0.0：支持自定义周报模板',
  },
  {
    agent_id: 2004,
    agent_name: 'contract-review',
    agent_display_name: '合同审查官',
    agent_version: 'v5.0.1',
    agent_avatar_url: mkAv4,
    agent_description: '劳动法 / 知识产权 / 数据合规三件套，逐条挑风险。',
    agent_tags: ['法务域', '合规', '风险'],
    agent_uploader: '胡勤彪',
    agent_uploader_account: 'qbhu',
    star_count: 88, download_count: 210, image_count: 8,
    is_official: true, risk_level: 'medium', scope: '集团内',
    scenarios: '合同初审 / 风险清单 / 条款比对',
    functions: '条款抽取、风险标注、修改建议',
    detailed_description: '按企业模板逐条比对，输出风险清单与改法。',
    changelog: 'v5.0.1：补充数据出境条款库',
  },
  {
    agent_id: 2005,
    agent_name: 'interviewer-max',
    agent_display_name: '面试官 Max',
    agent_version: 'v4.2.0',
    agent_avatar_url: mkAv5,
    agent_description: '结构化追问 + 能力评分，初筛效率拉满。',
    agent_tags: ['人力域', '面试', '评估'],
    agent_uploader: '员清亮',
    agent_uploader_account: 'qlyun',
    star_count: 3, download_count: 22, image_count: 3,
    is_official: false, risk_level: 'low', scope: '集团内',
    scenarios: '简历初筛 / 结构化面试 / 评分',
    functions: '追问树生成、能力项打分、纪要输出',
    detailed_description: '按岗位胜任模型生成追问，边聊边打分。',
    changelog: 'v4.2.0：新增岗位胜任模型库',
  },
]


/** 通过 agent_id 查 RAW（含市场独有的那批，聘用/详情都要查得到） */
export function findRawAgent(agentId) {
  const id = Number(agentId)
  return RAW_AGENTS.find((a) => Number(a.agent_id) === id)
    || MARKET_ONLY_AGENTS.find((a) => Number(a.agent_id) === id)
    || null
}

/** 所有 tags 聚合（去重 + 计数） */
export function aggregateTags() {
  const map = new Map()
  for (const a of RAW_AGENTS) {
    for (const t of a.agent_tags || []) {
      map.set(t, (map.get(t) || 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
}
