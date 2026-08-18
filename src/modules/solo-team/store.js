import { defineStore } from 'pinia'
import { employeeChatsState, employeeChatsGetters, employeeChatsActions } from './store/employeeChats'
import { onePersonTeamsState, onePersonTeamsActions } from './store/onePersonTeams'
import {
  onePersonTeamDetailState,
  onePersonTeamDetailGetters,
  onePersonTeamDetailActions,
} from './store/onePersonTeamDetail'
import {
  onePersonTeamRuntimeState,
  onePersonTeamRuntimeGetters,
  onePersonTeamRuntimeActions,
} from './store/onePersonTeamRuntime'

export const useSoloTeamStore = defineStore('solo-team', {
  state: () => ({
    // 一人团队 REST 列表
    ...onePersonTeamsState(),
    // 一人团队详情/线程/数字员工选择缓存
    ...onePersonTeamDetailState(),
    // 一人团队 Kooky 会话/任务运行时 UI 状态
    ...onePersonTeamRuntimeState(),
    // 我的员工模拟对话状态
    // 我的员工独立会话状态
    ...employeeChatsState(),
  }),

  getters: {
    ...employeeChatsGetters,
    ...onePersonTeamDetailGetters,
    ...onePersonTeamRuntimeGetters,
  },

  actions: {
    // ─── 合并子模块 ───────────────────────────────────────────
    ...onePersonTeamsActions,
    ...onePersonTeamDetailActions,
    ...onePersonTeamRuntimeActions,
    ...employeeChatsActions,
  },
})
