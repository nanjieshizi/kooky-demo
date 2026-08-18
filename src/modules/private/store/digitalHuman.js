import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { digitalHumanApi } from '../services/digitalHumanApi'

/**
 * 数字人（无状态 Agent）Store
 *
 * 职责边界：
 * - agents / fetchAgents：协作侧栏「数字人」列表（agent-usage）
 * - openingAgentId、currentAgentId、currentThreadId、currentThreadPayload：仅服务于「创建新会话」类流程（如 openAgent、资料卡入口），
 *   与协作主区数字人对话会话态隔离；侧栏点击进入已有会话请用 collaboration-employee-chat 内字段。
 */
export const useDigitalHumanStore = defineStore('digital-human', {
  state: () => ({
    // 无状态 Agent 列表（数字人）
    agents: [],
    loadingAgents: false,

    /** 以下会话指针仅用于 openAgent 等「新建线程」路径，协作侧栏进已有会话不写这些字段 */
    currentAgentId: null,
    currentThreadId: null,
    currentThreadPayload: null,
    openingAgentId: null,

    error: null,
  }),

  getters: {
    /**
     * 列表展示顺序：置顶优先，否则按 last_used_at 倒序
     */
    sortedAgents: (state) => {
      return [...state.agents].sort((a, b) => {
        const ap = a.pinned ? 1 : 0
        const bp = b.pinned ? 1 : 0
        if (ap !== bp) return bp - ap
        const at = new Date(a.last_used_at || a.first_used_at || 0).getTime()
        const bt = new Date(b.last_used_at || b.first_used_at || 0).getTime()
        return bt - at
      })
    },

    currentAgent: (state) => {
      if (state.currentAgentId == null || state.currentAgentId === '') return null
      const id = String(state.currentAgentId)
      return state.agents.find((a) => String(a.agent_id ?? a.agentId) === id) || null
    },
  },

  actions: {
    _isAuthenticated() {
      try {
        const raw = localStorage.getItem('super-assistant-userInfo')
        if (!raw) return false
        const userInfo = JSON.parse(raw)
        return !!userInfo?.access_token
      } catch {
        return false
      }
    },

    /**
     * 拉取无状态 Agent 列表
     */
    async fetchAgents(options = {}) {
      if (!this._isAuthenticated()) return
      if (this.loadingAgents) return

      const { page = 1, pageSize = 50, includeHidden = false } = options
      this.loadingAgents = true
      this.error = null

      try {
        const data = await digitalHumanApi.listAgents({ page, pageSize, includeHidden })

        let items = []
        if (Array.isArray(data)) {
          items = data
        } else if (Array.isArray(data?.items)) {
          items = data.items
        } else if (Array.isArray(data?.data?.items)) {
          items = data.data.items
        } else if (Array.isArray(data?.data)) {
          items = data.data
        }

        this.agents = items
      } catch (err) {
        this.error = err.message || String(err)
        console.error('[DigitalHuman] Failed to fetch agents:', err)
      } finally {
        this.loadingAgents = false
      }
    },

    /**
     * 打开指定数字人：调用 POST /personal/threads 创建会话，刷新列表并设置当前会话
     * @param {number} agentId
     * @param {string} [title='新对话']
     * @returns {Promise<Object|null>} 新建的 thread 对象
     */
    async openAgent(agentId, title = '新对话') {
      if (!agentId) return null
      if (this.openingAgentId) return null

      this.openingAgentId = agentId
      try {
        const res = await digitalHumanApi.createThread(title, agentId)
        const body = res?.data ?? res ?? {}
        const thread = body.item || body.thread || body
        // 刷新列表（last_used_at / has_dialog 会更新）
        await this.fetchAgents()
        this.currentAgentId = agentId
        if (thread?.id) this.currentThreadId = thread.id
        this.currentThreadPayload = thread && typeof thread === 'object' ? { ...thread } : null
        return thread
      } catch (err) {
        console.error('[DigitalHuman] Failed to open agent:', err)
        ElMessage.error('打开数字人对话失败')
        throw err
      } finally {
        this.openingAgentId = null
      }
    },

    /**
     * 将数字人合并进左侧「数字人」列表（资料卡等入口：列表接口暂未返回时仍可展示）
     * @param {object} partial 至少含 agent_id / agentId，可选 agent_name、agent_display_name、agent_avatar_url
     */
    upsertAgentInList(partial) {
      const rawId = partial?.agent_id ?? partial?.agentId
      if (rawId == null || rawId === '') return
      const idStr = String(rawId)
      const idx = this.agents.findIndex((a) => String(a.agent_id ?? a.agentId) === idStr)
      const prev = idx >= 0 ? { ...this.agents[idx] } : {}
      const display =
        String(partial.agent_display_name || partial.agent_name || partial.name || prev.agent_display_name || '').trim()
      const name =
        String(partial.agent_name || partial.name || prev.agent_name || display || idStr).trim()
      const merged = {
        ...prev,
        ...partial,
        agent_id: prev.agent_id ?? partial.agent_id ?? partial.agentId,
        agent_name: name || idStr,
        agent_display_name: display || name || idStr,
        agent_avatar_url:
          partial.agent_avatar_url
          || partial.avatar
          || prev.agent_avatar_url
          || '',
      }
      const next = [...this.agents]
      if (idx >= 0) next.splice(idx, 1, merged)
      else next.unshift(merged)
      this.agents = next
    },

    resetState() {
      this.agents = []
      this.currentAgentId = null
      this.currentThreadId = null
      this.currentThreadPayload = null
      this.openingAgentId = null
      this.loadingAgents = false
      this.error = null
    },
  },
})
