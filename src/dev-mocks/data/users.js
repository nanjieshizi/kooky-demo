/**
 * dev-mocks 用户资料数据
 *
 * - CURRENT_USER：Pata 自己的档案，登录后塞进 userStore
 * - COLLEAGUES：同事池，给 @ 提及选择器 / 创建群成员选择 / 协作任务执行人池用
 *
 * 部门体系完全照搬截图，保持讯飞云+平台的真实组织感。
 */

// 真人头像（核心角色用本地真人照）
import userSymengAvatar from '../assets/user-symeng7.jpeg'
import userQbhuAvatar from '../assets/user-qbhu.jpeg'
import userJrnieAvatar from '../assets/user-jrnie.jpeg'
import userJbxuAvatar from '../assets/user-jbxu2.jpeg'
import userMinliuAvatar from '../assets/user-minliu27.jpeg'
import userYhzhangAvatar from '../assets/user-yhzhang2.jpeg'
import userXyfangAvatar from '../assets/user-xyfang9.jpeg'
import userYrdengAvatar from '../assets/user-yrdeng2.jpeg'
import userYlyangAvatar from '../assets/user-ylyang21.jpeg'
import userYanhuangAvatar from '../assets/user-yanhuang.jpeg'

const DEFAULT_AVATAR = ''

// DiceBear 头像 URL 工厂（次要角色 fallback 用，按 seed 生成稳定头像）
function avatar(style, seed, bg = 'transparent') {
  const bgParam = bg && bg !== 'transparent' ? `&backgroundColor=${bg}` : ''
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}${bgParam}`
}

// ─────────────────────────────────────────────────────
// 当前登录用户（Pata 自己）
// ─────────────────────────────────────────────────────

// 当前用户：孟世一 → 真人照
const CURRENT_USER_AVATAR = userSymengAvatar

export const CURRENT_USER = {
  access_token: 'mock-token-symeng7',
  userId: 'symeng7',
  name: '孟世一',
  userName: 'symeng7',
  email: 'symeng7@iflytek.com',
  avatar: CURRENT_USER_AVATAR,
  headUrl: CURRENT_USER_AVATAR,
  portalToken: 'mock-portal-token',
  role: 'user',
  // 组织信息（顶栏档案抽屉用）
  employeeId: '2026001715',
  title: '高级平台软件产品经理',
  department: '技术中心平台产品技术部平台产品组构建运行时域产品组',
  departmentPath: [
    '技术中心',
    '平台产品技术部',
    '平台产品组',
    '构建运行时域产品组',
  ],
}

// ─────────────────────────────────────────────────────
// 同事池（参考用户提供的真实档案截图）
// ─────────────────────────────────────────────────────

export const COLLEAGUES = [
  {
    userId: 'minliu27',
    name: '刘敏',
    userName: 'minliu27',
    avatar: userMinliuAvatar,
    title: '中级平台软件产品经理',
    department: '技术中心平台产品技术部平台产品组产研协同域产品组',
    departmentPath: ['技术中心', '平台产品技术部', '平台产品组', '产研协同域产品组'],
  },
  {
    userId: 'yrdeng2',
    name: '邓颖茹',
    userName: 'yrdeng2',
    avatar: userYrdengAvatar,
    employeeId: '2025006561',
    email: 'yrdeng2@iflytek.com',
    title: '高级体验设计师',
    projectRole: 'Kooky专项负责人',
    department: '技术中心用户体验设计部',
    departmentPath: ['技术中心', '用户体验设计部'],
  },
  {
    userId: 'yhzhang2',
    name: '张月华',
    userName: 'yhzhang2',
    avatar: userYhzhangAvatar,
    title: '高级平台软件产品经理',
    department: '技术中心平台产品技术部平台产品组产研协同域产品组',
    departmentPath: ['技术中心', '平台产品技术部', '平台产品组', '产研协同域产品组'],
  },
  {
    userId: 'ylyang21',
    name: '杨宇龙',
    userName: 'ylyang21',
    avatar: userYlyangAvatar,
    employeeId: '2024000810',
    email: 'ylyang21@iflytek.com',
    title: '高级系统架构师',
    projectRole: '研发负责人',
    managerName: '郭秀军',
    managerAccount: 'xjguo9',
    department: '技术中心平台产品技术部平台架构组',
    departmentPath: ['技术中心', '平台产品技术部', '平台架构组'],
  },
  {
    userId: 'yanhuang',
    name: '黄燕',
    userName: 'yanhuang',
    avatar: userYanhuangAvatar,
    employeeId: '20080029',
    email: 'yanhuang@iflytek.com',
    title: '技术中心测试部总监',
    projectRole: '生态方负责人',
    managerName: '郭秀军',
    managerAccount: 'xjguo9',
    department: '技术中心测试部',
    departmentPath: ['技术中心', '测试部'],
  },
  {
    // 胡勤彪 → 架构（真人照）
    userId: 'qbhu',
    name: '胡勤彪',
    userName: 'qbhu',
    avatar: userQbhuAvatar,
    title: '高级系统架构师',
    department: '技术中心平台产品技术部效率平台部研发项目管理组',
    departmentPath: ['技术中心', '平台产品技术部', '效率平台部', '研发项目管理组'],
  },
  {
    userId: 'xyfang9',
    name: '方小宇',
    userName: 'xyfang9',
    avatar: userXyfangAvatar,
    title: '中级软件开发工程师-JAVA',
    department: '技术中心平台产品技术部效率平台部需求管理组',
    departmentPath: ['技术中心', '平台产品技术部', '效率平台部', '需求管理组'],
  },
  {
    // 徐俊保 → 测试（真人照）
    userId: 'jbxu2',
    name: '徐俊保',
    userName: 'jbxu2',
    avatar: userJbxuAvatar,
    title: '中级系统测试工程师',
    department: '技术中心测试部业务测试二组',
    departmentPath: ['技术中心', '测试部', '业务测试二组'],
  },
  {
    // 聂家睿 → 研发前端（真人照）
    userId: 'jrnie',
    name: '聂家睿',
    userName: 'jrnie',
    avatar: userJrnieAvatar,
    title: '高级软件开发工程师-前端',
    department: '技术中心平台产品技术部效率平台部前端开发组',
    departmentPath: ['技术中心', '平台产品技术部', '效率平台部', '前端开发组'],
  },
  {
    userId: 'qlyun',
    name: '员清亮',
    userName: 'qlyun',
    avatar: avatar('adventurer', 'qlyun', 'ffd5dc'),
    title: '高级交互设计师',
    department: '技术中心用户体验设计部',
    departmentPath: ['技术中心', '用户体验设计部'],
  },
]

// ─────────────────────────────────────────────────────
// 组织目录扩充池（通讯录用）
// 上面 10 位是"核心角色"（真人照、进提及/建群演示）；这里补一批群众演员，
// 让通讯录·组织目录点开任意部门都有人，不至于处处 2 个人。
// 头像走 DiceBear（按 seed 稳定生成），职务/邮箱/工号齐全，够撑档案卡。
// ─────────────────────────────────────────────────────

const EXTRA_SPECS = [
  ['zychen3', '陈志远', '资深平台软件产品经理', ['技术中心', '平台产品技术部', '平台产品组', '产研协同域产品组']],
  ['lywang8', '王丽云', '中级平台软件产品经理', ['技术中心', '平台产品技术部', '平台产品组', '产研协同域产品组']],
  ['hjzhao', '赵华杰', '高级软件开发工程师-JAVA', ['技术中心', '平台产品技术部', '平台产品组', '构建运行时域产品组']],
  ['xmsun2', '孙晓萌', '中级平台软件产品经理', ['技术中心', '平台产品技术部', '平台产品组', '构建运行时域产品组']],
  ['pfzhou', '周鹏飞', '资深系统架构师', ['技术中心', '平台产品技术部', '效率平台部', '研发项目管理组']],
  ['tzli9', '李婷竹', '中级项目管理师', ['技术中心', '平台产品技术部', '效率平台部', '研发项目管理组']],
  ['gjwu', '吴国俊', '高级需求分析师', ['技术中心', '平台产品技术部', '效率平台部', '需求管理组']],
  ['yqhe', '何雨晴', '中级需求分析师', ['技术中心', '平台产品技术部', '效率平台部', '需求管理组']],
  ['bcma7', '马博成', '高级软件开发工程师-前端', ['技术中心', '平台产品技术部', '效率平台部', '前端开发组']],
  ['sqlin', '林书琴', '中级软件开发工程师-前端', ['技术中心', '平台产品技术部', '效率平台部', '前端开发组']],
  ['zhguo2', '郭振华', '资深软件开发工程师-JAVA', ['技术中心', '平台产品技术部', '效率平台部', '前端开发组']],
  ['mxtang', '唐梦欣', '高级系统测试工程师', ['技术中心', '测试部', '业务测试二组']],
  ['jfhan', '韩劲峰', '中级系统测试工程师', ['技术中心', '测试部', '业务测试二组']],
  ['ykxu3', '徐一凯', '高级自动化测试工程师', ['技术中心', '测试部', '自动化测试组']],
  ['lqcao', '曹磊强', '中级系统测试工程师', ['技术中心', '测试部', '自动化测试组']],
  ['rzshen', '沈瑞泽', '高级交互设计师', ['技术中心', '用户体验设计部']],
  ['wywei', '魏婉滢', '中级视觉设计师', ['技术中心', '用户体验设计部']],
  ['cxdu5', '杜晨曦', '高级用户研究员', ['技术中心', '用户体验设计部']],
  ['ksliang', '梁凯森', '资深算法工程师', ['技术中心', '智能算法部', '大模型应用组']],
  ['jyfu', '傅嘉怡', '高级算法工程师', ['技术中心', '智能算法部', '大模型应用组']],
  ['dhqin', '秦东昊', '中级数据工程师', ['技术中心', '智能算法部', '数据平台组']],
  ['nnyang', '杨念念', '高级数据分析师', ['技术中心', '智能算法部', '数据平台组']],
]

const EXTRA_AVATAR_STYLES = ['adventurer', 'micah', 'notionists', 'avataaars', 'personas']
const EXTRA_AVATAR_BGS = ['c0e8ff', 'ffd5dc', 'd9f2d9', 'ffe7c2', 'e6ddff']

export const EXTRA_COLLEAGUES = EXTRA_SPECS.map(([userName, name, title, path], i) => ({
  userId: userName,
  name,
  userName,
  avatar: avatar(
    EXTRA_AVATAR_STYLES[i % EXTRA_AVATAR_STYLES.length],
    userName,
    EXTRA_AVATAR_BGS[i % EXTRA_AVATAR_BGS.length],
  ),
  title,
  department: path.join(''),
  departmentPath: path,
}))

/** 档案卡要的字段：工号 / 邮箱 / 签名（核心角色手写没有，这里统一按账号派生） */
function withProfileFields(user, index) {
  return {
    ...user,
    employeeId: user.employeeId || `20${24 + (index % 3)}00${String(1000 + index * 37).slice(-4)}`,
    email: user.email || `${user.userName}@iflytek.com`,
  }
}

// 所有"人"组成的成员池（含自己），给提及选择器/通讯录用
export const ALL_PEOPLE = [CURRENT_USER, ...COLLEAGUES, ...EXTRA_COLLEAGUES].map(withProfileFields)
