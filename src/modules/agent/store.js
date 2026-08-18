import { defineStore } from 'pinia'
import person1 from '@/assets/home/person1.png'
import person2 from '@/assets/home/person2.png'
import person3 from '@/assets/home/person3.png'

// 模拟数据，匹配 UI 设计稿
const MOCK_AGENTS = [
  {
    id: 'agent-dev-expert',
    name: '研发全链路专家',
    icon: '👨‍💻',
    avatar: person1,
    description: '涵盖从需求分析到发布上线，资产管理的全流程，助力研发效率提升',
    isGold: true,
  },
  {
    id: 'agent-efficiency-auditor',
    name: '效能审计官',
    icon: '📊',
    avatar: person2,
    description: '专门管理和评述"数字员工"好不好用以及产出，持续优化团队效能',
    isGold: true,
  },
  {
    id: 'agent-oa-expert',
    name: 'OA流程专家',
    icon: '📋',
    avatar: person3,
    description: '专门处理集团内部行政、流程、办公自动化，让审批不再繁琐',
    isGold: false,
  },
  {
    id: 'agent-test-engineer',
    name: '测试工程师',
    icon: '🧪',
    avatar: person1,
    description: '自动化测试用例生成与执行，覆盖率分析，质量报告输出',
    isGold: false,
  },
  {
    id: 'agent-doc-writer',
    name: '文档撰写助手',
    icon: '📝',
    avatar: person2,
    description: '根据代码与需求自动生成技术文档、API文档、用户手册',
    isGold: false,
  },
  {
    id: 'agent-data-analyst',
    name: '数据分析师',
    icon: '📈',
    avatar: person3,
    description: '数据采集、清洗、可视化分析，快速洞察业务趋势与异常',
    isGold: true,
  },
]

export const useAgentStore = defineStore('agent', {
  state: () => ({
    agents: MOCK_AGENTS,
    loaded: true,
    loading: false,
  }),

  getters: {
    byId: (state) => (id) => state.agents.find(a => a.id === id),
    byName: (state) => (name) => state.agents.find(a => a.name === name),
    filteredAgents: (state) => state.agents,
  },

  actions: {
    async loadAgents() {
      // 不再从 OpenClaw 加载，直接使用模拟数据
      this.loaded = true
    }
  }
})
