/**
 * 定时任务 store
 *
 * demo 阶段 A 方案：纯前端状态，不真正按时触发，但所有操作（创建/暂停/启用/删除/查看历史/跳转会话）都跑通。
 *
 * 字段定义见 dev-mocks/data/schedules.js
 */

import { defineStore } from 'pinia'
import { pickRandomPresets } from '@/dev-mocks/data/schedules'

const STATUS_LABEL = { running: '运行中', paused: '已暂停', invalid: '已失效' }

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    /** taskId → ScheduledTask */
    tasks: {},
    /** 是否已经种过 default 数据 */
    seeded: false,
    /** 当前选中的任务（详情视图）*/
    activeTaskId: null,
    /** 主面板 ToolPanel 上的右侧抽屉是否开启 */
    panelOpen: false,
    /** 弹窗状态 */
    dialogState: {
      open: false,
      mode: 'create', // 'create' | 'edit'
      taskId: null,
      preset: null, // 来自预设的初始字段
    },
    /** 删除二次确认 */
    confirmDelete: {
      open: false,
      taskId: null,
    },
    /** 空态预设示例（首次取 3 条） */
    presets: [],
  }),

  getters: {
    allTasks: (state) => Object.values(state.tasks).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    runningTasks() { return this.allTasks.filter((t) => t.status === 'running') },
    pausedTasks() { return this.allTasks.filter((t) => t.status === 'paused') },
    invalidTasks() { return this.allTasks.filter((t) => t.status === 'invalid') },
    activeTask: (state) => (state.activeTaskId ? state.tasks[state.activeTaskId] : null),
    isEmpty() { return this.allTasks.length === 0 },
    /** 按执行者来源分组（设计稿里详情侧栏的结构）*/
    groupedTasks() {
      const groups = {
        'avatar': { label: '我的分身', tasks: [] },
        'solo-team-group': { label: '一人团队', subGroups: {} },
        'collab-group': { label: '协作', subGroups: {} },
      }
      for (const t of this.allTasks) {
        const src = t.executor?.source
        if (!src) continue
        if (src.type === 'avatar') {
          groups['avatar'].tasks.push(t)
        } else if (src.type === 'solo-employee' || src.type === 'solo-team') {
          const key = src.type === 'solo-employee' ? '我的员工' : (src.label.split('·').pop() || '团队群').trim()
          const bucket = groups['solo-team-group'].subGroups[key] || { label: key, tasks: [] }
          bucket.tasks.push(t)
          groups['solo-team-group'].subGroups[key] = bucket
        } else if (src.type === 'collab-1on1' || src.type === 'collab-group') {
          const key = (src.label.split('·').pop() || '协作').trim()
          const bucket = groups['collab-group'].subGroups[key] || { label: key, tasks: [] }
          bucket.tasks.push(t)
          groups['collab-group'].subGroups[key] = bucket
        }
      }
      return groups
    },
  },

  actions: {
    /** 启动时一次性 seed（默认任务 + 预设示例）*/
    seed({ tasks, presets } = {}) {
      if (this.seeded) return
      if (Array.isArray(tasks)) {
        for (const t of tasks) this.tasks[t.id] = t
      }
      this.presets = Array.isArray(presets) && presets.length ? presets : pickRandomPresets(3)
      this.seeded = true
    },

    /** 重新抽 3 条预设（每次进空态时调）*/
    rerollPresets(n = 3) {
      this.presets = pickRandomPresets(n)
    },

    /** 主面板开关 */
    togglePanel(open) {
      if (typeof open === 'boolean') this.panelOpen = open
      else this.panelOpen = !this.panelOpen
    },

    setActiveTask(taskId) {
      this.activeTaskId = taskId
    },
    clearActiveTask() {
      this.activeTaskId = null
    },

    /** 打开新建弹窗 */
    openCreateDialog(preset = null) {
      this.dialogState = { open: true, mode: 'create', taskId: null, preset }
    },
    /** 打开编辑弹窗 */
    openEditDialog(taskId) {
      const t = this.tasks[taskId]
      if (!t) return
      this.dialogState = { open: true, mode: 'edit', taskId, preset: null }
    },
    closeDialog() {
      this.dialogState = { open: false, mode: 'create', taskId: null, preset: null }
    },

    /** 创建 / 更新任务 */
    upsertTask(task) {
      if (!task?.id) {
        task.id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      }
      const existing = this.tasks[task.id]
      this.tasks[task.id] = {
        ...existing,
        ...task,
        runHistory: task.runHistory || existing?.runHistory || [],
        createdAt: existing?.createdAt || task.createdAt || Date.now(),
      }
      return this.tasks[task.id]
    },

    setStatus(taskId, status) {
      const t = this.tasks[taskId]
      if (!t) return
      if (t.status === 'invalid' && status !== 'invalid') return // 失效不能恢复
      t.status = status
    },

    pauseTask(taskId) { this.setStatus(taskId, 'paused') },
    resumeTask(taskId) { this.setStatus(taskId, 'running') },

    /** 删除（先弹二次确认）*/
    requestDelete(taskId) {
      this.confirmDelete = { open: true, taskId }
    },
    cancelDelete() {
      this.confirmDelete = { open: false, taskId: null }
    },
    confirmDeleteTask() {
      const id = this.confirmDelete.taskId
      if (id && this.tasks[id]) {
        delete this.tasks[id]
        if (this.activeTaskId === id) this.activeTaskId = null
      }
      this.confirmDelete = { open: false, taskId: null }
    },

    /** 工具：状态标签 */
    statusLabel(s) { return STATUS_LABEL[s] || s },
  },
})

export { STATUS_LABEL }
