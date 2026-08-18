import { defineStore } from 'pinia'
import {
  employeeChatsState,
  employeeChatsGetters,
  employeeChatsActions,
  loadCollaborationDigitalHumanEmployeeList,
} from '@/modules/solo-team/store/employeeChats'

/**
 * 协作模块 · 数字人对话专用 store，与一人团队「我的员工」Pinia 状态隔离。
 * 数字人「员工」列表走 GET /api/personal/agent-usage（见 loadCollaborationDigitalHumanEmployeeList），
 * 禁止复用一人团队 GET /api/v1/agents/my。
 */
export const useCollaborationEmployeeChatStore = defineStore('collaboration-employee-chat', {
  state: () => ({
    ...employeeChatsState(),
    employeeChatHost: 'collaboration',
    /** 协作侧不从 mock 预填，由 agent-usage 接口填充 */
    employeeChatEmployees: [],
    employeeItemsLoaded: false,
  }),
  getters: {
    ...employeeChatsGetters,
  },
  actions: {
    ...employeeChatsActions,
    /** 覆盖一人团队实现：仅拉协作数字人列表（agent-usage） */
    async loadEmployeeItems(opts = {}) {
      return loadCollaborationDigitalHumanEmployeeList(this, opts)
    },
  },
})
