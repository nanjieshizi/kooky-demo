/**
 * dev-mocks 组织架构 mock
 *
 * 提供 orgApi.js 五个接口的本地 mock：
 *   - fetchRootDepartments
 *   - fetchDepartmentChildren
 *   - fetchDepartmentProfiles
 *   - searchProfiles
 *   - fetchKcMarketAgents（新建团队弹窗也用它选数字人）
 *
 * 部门树体现讯飞云+真实组织感（孟世一 + 核心同事按截图归类）：
 *   技术中心
 *   ├─ 平台产品技术部
 *   │   ├─ 平台产品组
 *   │   │   ├─ 产研协同域产品组（刘敏 / 张月华）
 *   │   │   └─ 构建运行时域产品组（孟世一[本人]）
 *   │   ├─ 平台架构组（杨宇龙）
 *   │   └─ 效率平台部
 *   │       ├─ 研发项目管理组（胡勤彪）
 *   │       └─ 需求管理组（方小宇）
 *   ├─ 测试部（黄燕）
 *   │   └─ 业务测试二组（徐俊保）
 *   └─ 用户体验设计部（邓颖茹 / 员清亮）
 */

import { CURRENT_USER, COLLEAGUES, ALL_PEOPLE } from './users'
import { DIGITAL_HUMANS_RAW } from './digital-humans'

// ─────────────────────────────────────────────────────
// 部门树
// 字段对照 fetchRootDepartments / fetchDepartmentChildren：
//   { id, name, full_name, has_children }
// ─────────────────────────────────────────────────────

const DEPARTMENTS = [
  // 根
  { id: 1, name: '技术中心', full_name: '技术中心', parent_id: null, has_children: true },

  // L2
  { id: 11, name: '平台产品技术部', full_name: '技术中心平台产品技术部', parent_id: 1, has_children: true },
  { id: 12, name: '测试部', full_name: '技术中心测试部', parent_id: 1, has_children: true },
  { id: 13, name: '用户体验设计部', full_name: '技术中心用户体验设计部', parent_id: 1, has_children: false },

  // L3
  { id: 111, name: '平台产品组', full_name: '技术中心平台产品技术部平台产品组', parent_id: 11, has_children: true },
  { id: 112, name: '效率平台部', full_name: '技术中心平台产品技术部效率平台部', parent_id: 11, has_children: true },
  { id: 113, name: '平台架构组', full_name: '技术中心平台产品技术部平台架构组', parent_id: 11, has_children: false },
  { id: 121, name: '业务测试二组', full_name: '技术中心测试部业务测试二组', parent_id: 12, has_children: false },

  // L4
  { id: 1111, name: '产研协同域产品组', full_name: '技术中心平台产品技术部平台产品组产研协同域产品组', parent_id: 111, has_children: false },
  { id: 1112, name: '构建运行时域产品组', full_name: '技术中心平台产品技术部平台产品组构建运行时域产品组', parent_id: 111, has_children: false },
  { id: 1121, name: '研发项目管理组', full_name: '技术中心平台产品技术部效率平台部研发项目管理组', parent_id: 112, has_children: false },
  { id: 1122, name: '需求管理组', full_name: '技术中心平台产品技术部效率平台部需求管理组', parent_id: 112, has_children: false },
  { id: 1123, name: '前端开发组', full_name: '技术中心平台产品技术部效率平台部前端开发组', parent_id: 112, has_children: false },

  // 通讯录扩充：测试部第二个组 + 智能算法部两个组（让树不止 2 层可点）
  { id: 122, name: '自动化测试组', full_name: '技术中心测试部自动化测试组', parent_id: 12, has_children: false },
  { id: 14, name: '智能算法部', full_name: '技术中心智能算法部', parent_id: 1, has_children: true },
  { id: 141, name: '大模型应用组', full_name: '技术中心智能算法部大模型应用组', parent_id: 14, has_children: false },
  { id: 142, name: '数据平台组', full_name: '技术中心智能算法部数据平台组', parent_id: 14, has_children: false },
]

// 部门 ID → 该部门直接归属的人员账号列表
// ⚠️ Demo 简化：把全部真人同事「也」挂在 DEPT 11（平台产品技术部）下，
//    让现场建群时点开「平台产品技术部」就能一次性勾选全员，不用钻 4 层组织树或搜索。
//    原 L4 末端部门归属保持不变（其它演示路径仍可用）。
const ALL_COLLEAGUE_ACCOUNTS = [
  'minliu27', 'yrdeng2', 'yhzhang2',
  'ylyang21', 'yanhuang', 'qbhu', 'xyfang9',
  'jbxu2', 'jrnie', 'qlyun',
]

const DEPT_DIRECT_PROFILES = {
  // L2：Demo 主入口 —— 全员快捷选
  11: ALL_COLLEAGUE_ACCOUNTS,

  // L4 末端部门归属（保留原组织真实感）；后一批是通讯录扩充的群众演员
  1111: ['minliu27', 'yhzhang2', 'zychen3', 'lywang8'],
  1112: ['symeng7', 'hjzhao', 'xmsun2'],
  1121: ['qbhu', 'pfzhou', 'tzli9'],
  1122: ['xyfang9', 'gjwu', 'yqhe'],
  1123: ['jrnie', 'bcma7', 'sqlin', 'zhguo2'],
  113: ['ylyang21'],
  12: ['yanhuang'],
  121: ['jbxu2', 'mxtang', 'jfhan'],
  122: ['ykxu3', 'lqcao'],
  13: ['yrdeng2', 'qlyun', 'rzshen', 'wywei', 'cxdu5'],
  141: ['ksliang', 'jyfu'],
  142: ['dhqin', 'nnyang'],
}

// userName → user 对象的快查
const USER_BY_NAME = new Map(ALL_PEOPLE.map((u) => [u.userName, u]))

// 部门 ID → 节点
const DEPT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]))

function trimRoot(deps) {
  // fetchRootDepartments 是返回顶层节点（这里只有 1 个：技术中心）
  return deps.filter((d) => d.parent_id === null).map(stripParent)
}

function stripParent(d) {
  // 接口契约里没有 parent_id
  // eslint-disable-next-line no-unused-vars
  const { parent_id, ...rest } = d
  return rest
}

function childrenOf(parentId) {
  return DEPARTMENTS.filter((d) => d.parent_id === parentId).map(stripParent)
}

/**
 * 人员 → 接口契约字段。
 * 前 5 个字段是 orgApi 的正式契约；后面 title/email/employeeId 是 demo 富化，
 * 给通讯录的档案卡用（真接口没有时组件自己降级不显示）。
 */
/**
 * demo 富化：工号 / 邮箱 / 直属上级。
 * 真接口给了就用真的（u.xxx 优先），没给就按账号稳定编一份 —— 档案卡这几栏
 * 是照讯飞那张名片来的，全空着就没什么可看的了。
 */
const MANAGER_BY_ACCOUNT = {
  minliu27: 'qbhu',
  yhzhang2: 'qbhu',
  symeng7: 'qbhu',
  xyfang9: 'qbhu',
  jbxu2: 'qbhu',
  jrnie: 'qbhu',
  qlyun: 'qbhu',
}

/** 账号 → 稳定 10 位工号（2024 + 6 位 hash），刷新不跳字 */
function fakeEmployeeId(account) {
  const s = String(account || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `2024${String((h >>> 0) % 1000000).padStart(6, '0')}`
}

function toProfile(u) {
  const account = u.userName
  const mgrAccount = u.managerAccount || MANAGER_BY_ACCOUNT[account] || ''
  const mgr = mgrAccount && mgrAccount !== account ? USER_BY_NAME.get(mgrAccount) : null
  return {
    userId: u.userName, // 用 userName 当 userId（mock 不需要数字 ID）
    name: u.name,
    account,
    department: u.department,
    avatar: u.avatar || '',
    title: u.title || '',
    email: u.email || `${account}@iflytek.com`,
    employeeId: u.employeeId || fakeEmployeeId(account),
    managerName: u.managerName || mgr?.name || '',
    managerAccount: u.managerAccount || (mgr ? mgrAccount : ''),
    projectRole: u.projectRole || '',
    departmentPath: u.departmentPath || [],
  }
}

function profilesOf(deptId) {
  const accounts = DEPT_DIRECT_PROFILES[deptId] || []
  return accounts
    .map((acc) => USER_BY_NAME.get(acc))
    .filter(Boolean)
    .map(toProfile)
}

function searchAll(keyword) {
  const q = String(keyword || '').toLowerCase().trim()
  if (!q) return []
  return ALL_PEOPLE
    .filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.userName.toLowerCase().includes(q) ||
      (u.title && u.title.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    )
    .map(toProfile)
}

// ─────────────────────────────────────────────────────
// fetchKcMarketAgents mock：用数字人池构造完整 items
// ─────────────────────────────────────────────────────

function buildKcMarketAgents() {
  return {
    items: DIGITAL_HUMANS_RAW.map((dh, idx) => ({
      id: dh.agent_id,
      name: dh.agent_display_name,
      avatar: dh.agent_avatar_url || '',
      icon: '',
      color: '',
      agent_id: dh.agent_id,
      latest_version_id: idx + 1,
      participant_id: `agent-${idx + 1}`,
      imBotId: `agent-${idx + 1}`,
      username: dh.agent_name,
      slug: dh.agent_name,
      tags: dh.agent_tags || [],
      capabilities: [],
      skills: [],
      isInstalled: idx < 3, // 前 3 个标记已安装
      favorited: false,
      raw: dh,
    })),
    pagination: { page: 1, pageSize: 20, total: DIGITAL_HUMANS_RAW.length },
    nextCursor: null,
  }
}

// ─────────────────────────────────────────────────────
// 对外 mock API
// ─────────────────────────────────────────────────────

export function mockFetchRootDepartments() {
  return trimRoot(DEPARTMENTS)
}

export function mockFetchDepartmentChildren(id) {
  return childrenOf(Number(id))
}

export function mockFetchDepartmentProfiles(id) {
  return profilesOf(Number(id))
}

export function mockSearchProfiles(search) {
  return searchAll(search)
}

/** 全公司人数（二级栏底部概览条用；真接口没有这个统计时返回 null） */
export function mockFetchOrgHeadcount() {
  return ALL_PEOPLE.length
}

/** 部门下的企业数字人（归属写在 digital-humans 的 agent_department_id 上） */
export function mockFetchDepartmentAgents(id) {
  const deptId = Number(id)
  return DIGITAL_HUMANS_RAW.filter((dh) => Number(dh.agent_department_id) === deptId)
}

export function mockFetchKcMarketAgents(params = {}) {
  const result = buildKcMarketAgents()
  const keyword = String(params.search || params.displayName || '').trim().toLowerCase()
  if (!keyword) return result

  result.items = result.items.filter((agent) => (
    String(agent.name || '').toLowerCase().includes(keyword)
    || String(agent.username || '').toLowerCase().includes(keyword)
    || String(agent.raw?.agent_description || '').toLowerCase().includes(keyword)
  ))
  result.pagination = { ...result.pagination, total: result.items.length }
  return result
}

// 调试用：也暴露原始结构
export const MOCK_ORG_TREE = DEPARTMENTS
export const MOCK_DEPT_PROFILES_MAP = DEPT_DIRECT_PROFILES
