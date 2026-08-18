import { defineStore } from 'pinia'
import { useUIStore } from '@/modules/space/uiStore'

/**
 * 统一「会话侧区」store
 *
 * 每个模块会话右上角按钮 → 在会话右侧开出一块与会话视觉合体的区域，
 * 装 manage / tasks / preview 三类功能，互斥（单值 activePanel）、
 * 全 kooky 统一宽度、可拖拽。与最右侧全局工具栏（文件/待办/定时）是两套、独立。
 *
 * ⚠️ tasks 槽的"叶子"由各模块自定义：协作=在区内下钻看 flow 详情；
 *    一人团队=当子会话切换器，点子任务把子会话开在主区（见 kooky-solo-team-conversation）。
 */

// 两套记忆宽度：列表模式(窄) / 详情模式(宽)，各自持久、平滑切换
const LIST_WIDTH_KEY = 'kk-side-list-width'
const DETAIL_WIDTH_KEY = 'kk-side-detail-width'
const DEFAULT_LIST_WIDTH = 300
const DEFAULT_DETAIL_WIDTH = 520
const MIN_WIDTH = 280
const MAX_WIDTH = 640
// 专项作战室(office)固定宽：刚好铺下共 4 个 tab「全部 + 3 员工」（96×4 + 8×3 gap + 14×2 padding），
// 不做拖拽——员工再多也不加宽，多出来的 tab 横向滚动看
const OFFICE_WIDTH = 436

/** 模块 nav → 可开的功能槽（数组顺序 = 按钮顺序） */
// kode(cli) 不挂按钮：预览由「点文件卡 / 产物」唤起全局共享预览区，不需要主动入口
export const SIDE_PANEL_REGISTRY = {
  deerflow: ['manage', 'preview'],
  // 拍平后：一人团队右上角 = 文件 + 专项作战室（文件在左）；会话本身无独立管理槽
  'solo-team': ['preview', 'office'],
  collaboration: ['manage', 'tasks', 'preview', 'project'],
}

/** 槽元信息（按钮标签 / 图标）；label 可被模块覆盖（如协作的 manage 显示"群管理"） */
export const PANEL_META = {
  manage: { label: '管理', icon: '⚙️' },
  tasks: { label: '任务', icon: '☑️' },
  preview: { label: '文件预览', icon: '📄' },
  office: { label: '专项作战室', icon: '🏢' },
  project: { label: '项目看板', icon: '◫' },
}

/** 模块级 label 覆盖 */
const LABEL_OVERRIDE = {
  collaboration: { manage: '群管理', preview: '会话文件', project: '项目看板' },
}

function clampWidth(w) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
}

function readSavedWidth(key, fallback) {
  const raw = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(key)) : NaN
  return clampWidth(raw || fallback)
}

export const useSidePanelStore = defineStore('sidePanel', {
  state: () => ({
    // 按模块记忆各自打开的槽：nav → 'manage'|'tasks'|'preview'|null
    // 例：协作开了文件、切到一人团队不会带过去；分身没任务槽自然开不了任务
    panelByNav: {},
    listWidth: readSavedWidth(LIST_WIDTH_KEY, DEFAULT_LIST_WIDTH), // 列表模式(窄)
    detailWidth: readSavedWidth(DETAIL_WIDTH_KEY, DEFAULT_DETAIL_WIDTH), // 详情模式(宽)
    wide: false, // 当前是否详情模式（列表 false / 下钻·预览 true）
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  }),

  getters: {
    /** 当前模块打开的槽（读当前一级导航）；不在该模块注册表内则视为未开 */
    activePanel() {
      const nav = useUIStore().activePrimaryNav
      const panel = this.panelByNav[nav] || null
      if (panel && !(SIDE_PANEL_REGISTRY[nav] || []).includes(panel)) return null
      return panel
    },
    isOpen() {
      return this.activePanel !== null
    },
    /** 实际渲染宽度：作战室(office)固定宽(不拖拽)、详情模式用宽、列表模式用窄 */
    effectiveWidth() {
      if (this.activePanel === 'office') return OFFICE_WIDTH
      if (this.wide) return this.detailWidth
      return this.listWidth
    },
    /** 某模块可开的槽列表 */
    panelsFor: () => (nav) => SIDE_PANEL_REGISTRY[nav] || [],
    /** 某模块下某槽的按钮 label（含覆盖） */
    labelOf: () => (nav, panel) =>
      LABEL_OVERRIDE[nav]?.[panel] || PANEL_META[panel]?.label || panel,
  },

  actions: {
    /** 点按钮：同一个再点收起，否则切过去（天然互斥）——只作用于当前模块 */
    toggle(panel) {
      const nav = useUIStore().activePrimaryNav
      this.panelByNav[nav] = this.panelByNav[nav] === panel ? null : panel
    },
    open(panel) {
      this.panelByNav[useUIStore().activePrimaryNav] = panel
    },
    close() {
      this.panelByNav[useUIStore().activePrimaryNav] = null
    },
    /** 切换列表/详情模式（触发平滑过渡到对应记忆宽度） */
    setWide(v) {
      this.wide = !!v
    },
    /** 拖拽调宽：更新当前模式自己的记忆宽（各记各的）；作战室固定宽不接受拖拽 */
    setWidth(px) {
      if (this.activePanel === 'office') return
      const w = clampWidth(px)
      if (this.wide) {
        this.detailWidth = w
        try { localStorage.setItem(DETAIL_WIDTH_KEY, String(w)) } catch (e) { /* ignore */ }
      } else {
        this.listWidth = w
        try { localStorage.setItem(LIST_WIDTH_KEY, String(w)) } catch (e) { /* ignore */ }
      }
    },
  },
})
