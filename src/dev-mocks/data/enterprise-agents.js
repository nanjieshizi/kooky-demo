/**
 * dev-mocks 企业数字人市场数据（自包含）
 *
 * 企业数字人 = 带数据库的有状态 Agent。
 * - 消费动作：订阅（非聘用）
 * - 单版本：无版本号 / 无版本历史
 * - owner 即作者：谁上传就是谁的
 * - 产物来自工厂，市场「选择性展示」其中几块内容：
 *     · 公开详情（消费者）：技能 + 知识库
 *     · 我的上传详情（owner）：技能 + 知识库 + 数据库 + 代码
 */

export const ENTERPRISE_CATEGORIES = ['全部', '人事行政', '客户服务', '数据分析', '办公协同', '其他']

export const ENTERPRISE_AGENTS_RAW = [
  {
    id: 'ent-policy',
    name: '政策问答数字人',
    icon: '📋',
    category: '人事行政',
    tags: ['人事行政', '知识问答', '政策解读'],
    description: '维护一份公司制度与政策知识库，员工自然语言提问即可秒查考勤、报销、假期等各类规章，并给出条款出处。',
    author: { name: 'hr-ops', displayName: '人力资源部' },
    subscribers: 1284,
    updatedAt: '2026-06-02',
    isSubscribed: false,
    // 我的上传相关
    isMine: true,
    status: 'online', // online 已发布 / testing 审核中 / draft 未发布 / reject 已驳回 / offline 已下架
    // 选择性展示：技能
    skills: [
      { id: 's1', name: '政策检索', desc: '从政策库中检索最相关的条款并给出出处' },
      { id: 's2', name: '条款解读', desc: '把生硬的规章用大白话解释给员工' },
      { id: 's3', name: '相似问题推荐', desc: '答完后推荐相关问题，减少来回提问' },
    ],
    // 选择性展示：知识库
    knowledge: [
      { id: 'k1', name: '员工手册2026版.pdf', type: 'file' },
      { id: 'k2', name: '考勤与假期管理制度.docx', type: 'file' },
      { id: 'k3', name: '差旅与报销标准.pdf', type: 'file' },
      { id: 'k4', name: '公司内网制度专区', type: 'url' },
    ],
    // owner 专属：数据库
    dbTables: [
      {
        name: 'policies',
        desc: '政策条款库（共享数据）',
        rows: 326,
        columns: [
          { name: 'id', type: 'int', desc: '主键', pk: true },
          { name: 'category', type: 'string', desc: '政策分类' },
          { name: 'title', type: 'string', desc: '条款标题' },
          { name: 'content', type: 'text', desc: '条款正文' },
          { name: 'source', type: 'string', desc: '出处文件' },
        ],
        sampleRows: [
          { id: 1, category: '假期', title: '年假天数', content: '入职满1年享5天年假，每满10年递增…', source: '员工手册 3.2' },
          { id: 2, category: '报销', title: '差旅住宿标准', content: '一线城市≤500元/晚，其余≤350元/晚…', source: '差旅标准 2.1' },
          { id: 3, category: '考勤', title: '弹性打卡', content: '可在 8:30-10:00 之间弹性打卡…', source: '考勤制度 1.4' },
        ],
      },
      {
        name: 'ask_logs',
        desc: '提问记录（运行数据）',
        rows: 5821,
        columns: [
          { name: 'id', type: 'int', desc: '主键', pk: true },
          { name: 'user', type: 'string', desc: '提问人' },
          { name: 'question', type: 'string', desc: '问题' },
          { name: 'hit_policy', type: 'string', desc: '命中条款' },
          { name: 'created_at', type: 'datetime', desc: '提问时间' },
        ],
        sampleRows: [
          { id: 9001, user: '张伟', question: '年假能不能跨年休？', hit_policy: '年假天数', created_at: '2026-06-02 09:14' },
          { id: 9002, user: '李娜', question: '出差打车能报销吗', hit_policy: '差旅住宿标准', created_at: '2026-06-02 10:02' },
        ],
      },
    ],
    // owner 专属：代码（只读，编辑回工厂）
    codeFiles: [
      { path: 'config.yaml', content: 'name: 政策问答数字人\nmodel: spark-x1\ndatabase: enabled\nskills:\n  - policy-search\n  - policy-explain\n' },
      { path: 'SOUL.md', content: '# 人设\n你是公司的政策顾问，严谨、准确、有出处。\n回答时务必引用条款来源，不确定就说不确定，绝不编造。\n' },
      { path: 'skills/policy-search/SKILL.md', content: '# 政策检索\n根据用户问题在 policies 表中做语义检索，返回最相关的 3 条并附出处。' },
    ],
  },
  {
    id: 'ent-aftersales',
    name: '售后工单数字人',
    icon: '🎧',
    category: '客户服务',
    tags: ['客户服务', '工单', '知识库'],
    description: '对接产品知识库与历史工单，自动解答客户常见问题、生成工单并分派，沉淀每一次对话为可复用经验。',
    author: { name: 'cs-team', displayName: '客户成功团队' },
    subscribers: 642,
    updatedAt: '2026-05-29',
    isSubscribed: true,
    isMine: false,
    status: 'online',
    skills: [
      { id: 's1', name: 'FAQ 应答', desc: '匹配知识库给出标准答案' },
      { id: 's2', name: '工单创建', desc: '把无法自助解决的问题转成工单' },
      { id: 's3', name: '情绪安抚', desc: '识别客户情绪并优先安抚' },
    ],
    knowledge: [
      { id: 'k1', name: '产品使用手册.pdf', type: 'file' },
      { id: 'k2', name: '常见问题FAQ.docx', type: 'file' },
    ],
    dbTables: [
      {
        name: 'tickets',
        desc: '工单表（运行数据）',
        rows: 1043,
        columns: [
          { name: 'id', type: 'int', desc: '主键', pk: true },
          { name: 'customer', type: 'string', desc: '客户' },
          { name: 'issue', type: 'string', desc: '问题描述' },
          { name: 'status', type: 'enum', desc: '状态' },
        ],
        sampleRows: [
          { id: 201, customer: '王先生', issue: '无法登录', status: '已解决' },
          { id: 202, customer: '赵女士', issue: '发票抬头错误', status: '处理中' },
        ],
      },
    ],
    codeFiles: [
      { path: 'config.yaml', content: 'name: 售后工单数字人\nmodel: spark-x1\ndatabase: enabled\n' },
      { path: 'SOUL.md', content: '# 人设\n你是耐心专业的售后助理，先安抚情绪再解决问题。' },
    ],
  },
  {
    id: 'ent-bi',
    name: '经营数据分析数字人',
    icon: '📊',
    category: '数据分析',
    tags: ['数据分析', '自然语言查询', 'BI'],
    description: '连接经营数据，用自然语言问出销售额、转化率、同比环比等指标，自动出表出图，老板也能自助查数。',
    author: { name: 'data-lab', displayName: '数据中台' },
    subscribers: 389,
    updatedAt: '2026-05-31',
    isSubscribed: false,
    isMine: true,
    status: 'testing',
    skills: [
      { id: 's1', name: '自然语言转SQL', desc: '把口语问题翻译成查询' },
      { id: 's2', name: '指标解释', desc: '解释指标口径和异常波动' },
    ],
    knowledge: [
      { id: 'k1', name: '指标口径字典.xlsx', type: 'file' },
    ],
    dbTables: [
      {
        name: 'sales',
        desc: '销售明细（共享数据）',
        rows: 28456,
        columns: [
          { name: 'id', type: 'int', desc: '主键', pk: true },
          { name: 'region', type: 'string', desc: '区域' },
          { name: 'amount', type: 'decimal', desc: '销售额' },
          { name: 'date', type: 'date', desc: '日期' },
        ],
        sampleRows: [
          { id: 1, region: '华东', amount: 128400, date: '2026-05-30' },
          { id: 2, region: '华南', amount: 96200, date: '2026-05-30' },
        ],
      },
    ],
    codeFiles: [
      { path: 'config.yaml', content: 'name: 经营数据分析数字人\nmodel: spark-x1\ndatabase: enabled\n' },
    ],
  },
]

export function listEnterpriseAgents({ search = '', category = '全部' } = {}) {
  let items = ENTERPRISE_AGENTS_RAW.slice()
  if (category && category !== '全部') items = items.filter((a) => a.category === category)
  if (search) {
    const q = String(search).toLowerCase()
    items = items.filter((a) => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
  }
  return items
}

export function listMyEnterpriseAgents({ status = 'all' } = {}) {
  let items = ENTERPRISE_AGENTS_RAW.filter((a) => a.isMine)
  if (status && status !== 'all') items = items.filter((a) => a.status === status)
  return items
}

export function getEnterpriseAgent(id) {
  return ENTERPRISE_AGENTS_RAW.find((a) => a.id === id) || null
}
