import { defineStore } from 'pinia'
import { fetchMyHiredList } from './myHiredApi'
import kookyAvatar from './assets/kooky.svg'

// 聘用状态枚举
export const HIRED_STATUS = {
  INSTALLING: 'installing',     // 安装中
  ACTIVE: 'active',             // 已安装
  UNINSTALLING: 'uninstalling', // 卸载中
}

export const HIRED_STATUS_LABEL = {
  [HIRED_STATUS.INSTALLING]: '聘用中',
  [HIRED_STATUS.ACTIVE]: '已聘用',
  [HIRED_STATUS.UNINSTALLING]: '解聘中',
}

export const HIRED_STATUS_COLOR = {
  [HIRED_STATUS.INSTALLING]: '#21AB9D',
  [HIRED_STATUS.ACTIVE]: '#21AB9D',
  [HIRED_STATUS.UNINSTALLING]: '#FF8C00',
}

export const HIRED_STATUS_BG = {
  [HIRED_STATUS.INSTALLING]: '#CCF5F1',
  [HIRED_STATUS.ACTIVE]: '#CCF5F1',
  [HIRED_STATUS.UNINSTALLING]: '#FFF3E0',
}

// 分身详情 mock
export const MOCK_CLONE_DETAIL = {
  id: 'main',
  name: '我的分身',
  subtitle: 'Kooky专属数字人',
  avatar: kookyAvatar,
  description: '您的专属AI核心，负责统筹协调所有数字人的工作，理解您的目标并智能分配任务。',
  skills: [
    {
      id: 'skill-c-001',
      icon: null,
      title: '代码审查助手',
      version: 'v1.0.2',
      description: '自动化代码审查，提升代码质量',
      content: '支持多语言代码审查，输出详细审查报告',
      downloadCount: 1200,
      collectCount: 340,
    },
    {
      id: 'skill-c-002',
      icon: null,
      title: '需求分析专家',
      version: 'v2.1.0',
      description: '快速拆解需求，生成结构化文档',
      content: '支持 PRD 解析、用例生成、优先级排序',
      downloadCount: 980,
      collectCount: 210,
    },
  ],
}

// Mock数据
const MOCK_HIRED_LIST = [
  {
    id: 'hired-001',
    name: '研发全链路专家',
    version: '1.2.0',
    source: 'Kooky市场',
    type: 'market',
    avatar: null,
    description: '涵盖从需求分析到发布上线、资产管理的全流程，助力研发效率提升，提供专业的技术咨询与代码审查服务',
    tags: ['研发', '代码审查', '需求分析', '架构设计'],
    status: HIRED_STATUS.ACTIVE,
    isCollected: true,
    collectCount: 450,
    downloadCount: 3200,
  },
  {
    id: 'hired-002',
    name: '效能审计官',
    version: '2.0.1',
    source: 'Kooky市场',
    type: 'market',
    avatar: null,
    description: '专门管理和评述"数字员工"好不好用以及产出，持续优化团队效能，提供数据驱动的效能报告',
    tags: ['效能管理', '数据分析', '团队优化'],
    status: HIRED_STATUS.INSTALLING,
    isCollected: false,
    collectCount: 328,
    downloadCount: 1850,
  },
  {
    id: 'hired-003',
    name: 'OA流程专家',
    version: '1.0.3',
    source: '企业自建',
    type: 'selfBuilt',
    avatar: null,
    description: '专门处理集团内部行政、流程、办公自动化，让审批不再繁琐，提升行政效率',
    tags: ['OA', '流程自动化', '行政管理'],
    status: HIRED_STATUS.UNINSTALLING,
    isCollected: true,
    collectCount: 738,
    downloadCount: 4120,
  },
]

export const useMyHiredStore = defineStore('myHired', {
  state: () => ({
    list: [],
    loading: false,
    error: null,
  }),

  getters: {
    isEmpty: (state) => !state.loading && state.list.length === 0,
    getById: (state) => (id) => state.list.find(h => String(h.id) === String(id)) || null,
  },

  actions: {
    async loadList(forceRefresh = false) {
      if (this.loading) return
      if (!forceRefresh && this.list.length > 0) return

      this.loading = true
      this.error = null
      try {
        const { results } = await fetchMyHiredList()
        this.list = results
      } catch (e) {
        this.error = e.message || '加载失败'
        console.error('加载我的聘用列表失败:', e)
        this.list = []
      } finally {
        this.loading = false
      }
    },

    toggleCollect(id) {
      const item = this.list.find(h => h.id === id)
      if (item) item.isCollected = !item.isCollected
    },
  },
})
