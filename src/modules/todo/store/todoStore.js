/**
 * 我的待办 Store · 全局个人 TodoList
 *
 * 数据模型（spec §5）：
 *   Todo = { id, type:'manual'|'text'|'file'|'vote',
 *            bucket:'overdue'|'today'|'tomorrow'|'week'|'later',
 *            title, status:'open'|'celebrate'|'done', result,
 *            // 协作来源（手动待办无）：
 *            group, linkGroup, linkTask, linkStep, options }
 *
 * 与协作群任务维护同一份数据：协作任务派到我头上 → 这里自动多一条（带 link*）；
 * 在待办里完成协作待办 → P3 同步回群（append 消息 + 推进 taskStore 步骤）。
 *
 * 进度口径：今日闭环率 = today 分组 done 数 / today 分组总数。
 */

import { defineStore } from 'pinia'

/** 固定分组顺序 */
export const BUCKET_ORDER = ['overdue', 'today', 'tomorrow', 'week', 'later']

/** 分组元信息（名称 + 是否危险色） */
export const BUCKET_META = {
  overdue: { name: '逾期', danger: true },
  today: { name: '今天' },
  tomorrow: { name: '明天' },
  week: { name: '本周' },
  later: { name: '更晚' },
}

let _seq = 0
function makeId() {
  return `todo-${Date.now()}-${(_seq++).toString(36)}`
}

function fmtMD(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export const useTodoStore = defineStore('todo', {
  state: () => ({
    items: [], // 全部待办（含已完成）
    expandedId: null, // 当前展开的协作待办行（渐进式提交区）
    showAllCompleted: false, // 已完成区是否展开全部
    seeded: false,
  }),

  getters: {
    /** 未完成（open / celebrate 动效中仍算未归档，但不进未完成列表——见 openItems 口径） */
    openItems: (s) => s.items.filter((t) => t.status === 'open'),
    doneItems: (s) => s.items.filter((t) => t.status === 'done'),
    /** 标题栏计数徽标 */
    openCount() {
      return this.openItems.length
    },

    /** 按 bucket 分组，固定顺序，空组不出（celebrate 态仍留在原组做塌陷动效） */
    groups() {
      const map = {}
      BUCKET_ORDER.forEach((k) => (map[k] = []))
      this.items.forEach((t) => {
        if (t.status === 'done') return
        ;(map[t.bucket] || (map[t.bucket] = [])).push(t)
      })
      return BUCKET_ORDER.filter((k) => map[k] && map[k].length).map((k) => ({
        key: k,
        name: BUCKET_META[k].name,
        danger: !!BUCKET_META[k].danger,
        dateLabel: this.bucketDateLabel(k),
        items: map[k],
      }))
    },

    /** 今日进度：today 分组 done / 总数 */
    todayProgress() {
      const today = this.items.filter((t) => t.bucket === 'today')
      const done = today.filter((t) => t.status === 'done').length
      const total = today.length
      return { done, total, allDone: total > 0 && done === total }
    },
  },

  actions: {
    /** 分组右侧日期文案（按真实日期算） */
    bucketDateLabel(key) {
      const now = new Date()
      if (key === 'overdue') return '已超期'
      if (key === 'today') return fmtMD(now)
      if (key === 'tomorrow') {
        const d = new Date(now)
        d.setDate(now.getDate() + 1)
        return fmtMD(d)
      }
      if (key === 'week') {
        // 本周剩余：从后天到本周日
        const start = new Date(now)
        start.setDate(now.getDate() + 2)
        const end = new Date(now)
        const toSunday = (7 - now.getDay()) % 7
        end.setDate(now.getDate() + (toSunday === 0 ? 7 : toSunday))
        if (start > end) return '本周内'
        return `${fmtMD(start)}-${end.getDate()}日`
      }
      if (key === 'later') return '未来计划'
      return ''
    },

    /** 种子（幂等） */
    seed(list) {
      if (this.seeded) return
      // 任务桥可能先于待办面板创建个人任务；此时不能再用旧示例数据覆盖它们。
      if (this.items.length) {
        this.seeded = true
        return
      }
      this.items = (list || []).map((x) => ({ status: 'open', result: '', ...x }))
      this.seeded = true
    },

    /** 手动新增待办 */
    addManual({ title, bucket = 'today' } = {}) {
      const t = (title || '').trim()
      if (!t) return null
      const item = { id: makeId(), type: 'manual', bucket, title: t, status: 'open', result: '' }
      // 插到该组顶部（items 里按插入即可，分组 getter 会归位）
      this.items.unshift(item)
      return item
    },

    /** 展开/收起某条协作待办的提交区（互斥） */
    toggleExpand(id) {
      this.expandedId = this.expandedId === id ? null : id
    },
    collapse() {
      this.expandedId = null
    },

    /**
     * 完成一条待办 → 进入 celebrate（动效），组件动效结束后调 archive() 落 done。
     * result：文本结论 / 文件说明 / 我投的选项，用于已完成区展示。
     * 协作待办的「同步回群」在 P3 由联动层接管（这里只管待办自身状态）。
     */
    complete(id, { result = '' } = {}) {
      const t = this.items.find((x) => x.id === id)
      if (!t) return null
      t.result = result
      t.status = 'celebrate'
      if (this.expandedId === id) this.expandedId = null
      return t
    },

    /** 动效结束，正式归档到已完成 */
    archive(id) {
      const t = this.items.find((x) => x.id === id)
      if (t) t.status = 'done'
    },

    /** prefers-reduced-motion：一步到位 */
    completeNow(id, payload) {
      const t = this.complete(id, payload)
      if (t) t.status = 'done'
      return t
    },

    toggleShowAllCompleted() {
      this.showAllCompleted = !this.showAllCompleted
    },
  },
})
