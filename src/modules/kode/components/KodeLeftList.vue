<script setup>
import { inject, computed, ref } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

// 左侧任务列表收起/展开
const collapsed = ref(false)

const state = inject(KODE_STATE_KEY)
const {
  workspaces,
  tasks,
  batches,
  selectedTaskId,
  selectTask,
  batchesByWorkspace,
  checkedTaskIds,
  toggleCheck,
  checkedCountByWs,
  activeFilter,
  setFilter,
  passesFilter,
  batchStatus,
  batchDoneCount,
  cancelBatch,
  pauseBatch,
  resumeBatch,
  finishBatch,
  isWorkspaceCollapsed,
  toggleWorkspaceCollapse,
  openNewTaskModal,
  openAddWorkspaceModal,
  openBatchExecuteModal,
  checkedSummary,
  setTab,
  completeTask,
} = state

// 手动标记完成（草稿 / IDE/CLI 手动干活的任务，靠人点完成）
function onComplete(e, t) {
  e.stopPropagation()
  completeTask(t.id)
}
// 「完成」入口只给待处理任务（批次任务靠批处理跑完进已完成，不手动）
function canComplete(t) {
  return t.status !== 'done' && !t.batchId
}

// 当前 workspace 下，按筛选过滤后的分组
const grouped = computed(() => {
  return workspaces.value.map((ws) => {
    const wsAllTasks = tasks.value.filter((t) => t.wsId === ws.id)
    const allBatches = batchesByWorkspace.value[ws.id] || []
    // 筛选
    const wsT = wsAllTasks.filter((t) => passesFilter(t))
    // 已完成任务一律走单卡（不挂批次块）；只有未归档的批次任务才分组展示
    const inBatch = wsT.filter((t) => t.batchId && t.status !== 'done')
    const free = wsT.filter((t) => !t.batchId || t.status === 'done')
    // 当前显示的批次 = 至少有 1 个任务通过筛选的批次
    const visibleBatchIds = new Set(inBatch.map((t) => t.batchId))
    const visibleBatches = allBatches.filter((b) => visibleBatchIds.has(b.id))
    return {
      ws,
      visibleBatches,
      inBatch,
      free,
      totalCount: wsAllTasks.length,
      visibleCount: wsT.length,
    }
  })
})

const visibleGroups = computed(() => grouped.value)

function wsStatusLabel(g) {
  const runningBatch = g.visibleBatches.find((b) => batchStatus(b) === 'running')
  if (runningBatch) {
    const done = runningBatch.taskIds.filter((id) => {
      const t = tasks.value.find((t) => t.id === id)
      return t && t.status === 'done'
    }).length
    return { label: `▶ ${done}/${runningBatch.taskIds.length}`, cls: 'run' }
  }
  const failedBatch = g.visibleBatches.find((b) => {
    const bts = b.taskIds.map((id) => tasks.value.find((t) => t.id === id))
    return bts.some((t) => t && t.status === 'failed')
  })
  if (failedBatch) return { label: '⚠ 整改', cls: 'err' }
  return { label: '空闲', cls: 'idle' }
}

function batchClass(b) {
  const s = batchStatus(b)
  return s
}

function batchLabel(b) {
  const s = batchStatus(b)
  if (s === 'running') return `▶ 批次 · ${b.startedAt}`
  if (s === 'done') return `✓ 批次 · ${b.startedAt}`
  if (s === 'mixed') return `! 批次 · ${b.startedAt}`
  return `批次 · ${b.startedAt}`
}

// 任务卡元信息(只有"批次执行流程中"或"已完成"才有状态文字)
// 普通任务卡(包括 ide 模式 / 还没批次执行的任务)无状态文字
function taskMeta(t) {
  const map = {
    done: { label: '已完成', cls: 'done' },
    running: { label: `执行中 ${Math.round((t.progress || 0) * 100)}%`, cls: 'running' },
    waiting: { label: '⏸ 等你决策', cls: 'waiting' },
    paused: { label: '⏸ 已中止', cls: 'paused' },
  }
  return map[t.status] || { label: '', cls: '' }
}

// 任务卡左侧:批次任务/已完成 → 状态图标;其他 → 勾选框
function leadType(t) {
  if (t.batchId || t.status === 'done') return 'status'
  return 'check'
}

function pipText(t) {
  if (t.status === 'done') return '✓'
  if (t.status === 'waiting' || t.status === 'paused') return '⏸'
  if (t.status === 'running') return '▶'
  // queue:仅批次内部,显示批次内序号
  if (t.status === 'queue') {
    const b = batches.value.find((b) => b.id === t.batchId)
    if (b) {
      const idx = b.taskIds.indexOf(t.id)
      if (idx >= 0) return String(idx + 1)
    }
    return '·'
  }
  return ''
}

function isChecked(t) {
  return checkedTaskIds.value.has(t.id)
}

function onCardClick(t) {
  selectTask(t.id)
}

// ─── 拖拽：任务卡 → cli 输入框 ────────────────────────────────
// dragstart：写 taskId 进 dataTransfer + 自动切到 cli tab（让 drop 区域立即可见）
function onDragStart(e, t) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-kode-task-id', String(t.id))
  e.dataTransfer.setData('text/plain', t.title || '')
  // 让 cli tab 立即激活，用户能直接拖到 cli 输入框
  setTab?.('cli')
  // 给卡片本身加一个临时类（CSS 半透明）
  e.currentTarget.classList.add('is-dragging')
}

function onDragEnd(e) {
  e.currentTarget?.classList?.remove?.('is-dragging')
}

function onCheckClick(e, t) {
  e.stopPropagation()
  toggleCheck(t.id)
}

function onWsHeaderClick(wsId) {
  toggleWorkspaceCollapse(wsId)
}

function onCancelBatch(e, batchId) {
  e.stopPropagation()
  if (confirm('确定取消这个批次吗？未跑完的任务会回到就绪态。')) {
    cancelBatch(batchId)
  }
}
function onToggleBatch(e, b) {
  e.stopPropagation()
  if (batchStatus(b) === 'paused') resumeBatch(b.id)
  else pauseBatch(b.id)
}
// 跑完待确认 → 完成任务：整批归档到已完成
function onFinishBatch(e, batchId) {
  e.stopPropagation()
  finishBatch(batchId)
}
// 跑完待确认 → 重新编辑：和取消一回事（任务回待处理草稿）
function onReeditBatch(e, batchId) {
  e.stopPropagation()
  if (confirm('重新编辑会把这批任务放回「待处理」，可改 todolist 后重跑，确认？')) {
    cancelBatch(batchId)
  }
}
// 批次左侧进度文案：完成数/总数 · 起始时间
function batchProgressText(b) {
  return `${batchDoneCount(b)}/${b.taskIds.length} · ${b.startedAt}`
}
function batchIcon(b) {
  const s = batchStatus(b)
  if (s === 'running') return '▶'
  if (s === 'paused') return '⏸'
  if (s === 'reviewing') return '◆'
  if (s === 'done') return '✓'
  if (s === 'mixed') return '!'
  return '▦'
}
</script>

<template>
  <aside class="kode-left" :class="{ collapsed }">
    <!-- 收起态：细条，点击展开 -->
    <button v-if="collapsed" class="left-expand" type="button" title="展开任务列表" @click="collapsed = false">
      <span class="le-icon">»</span>
      <span class="le-label">任务列表</span>
    </button>

    <!-- 展开态内容 -->
    <div v-show="!collapsed" class="left-inner">
    <div class="left-head">
      <button class="btn-new-task" type="button" @click="openNewTaskModal">
        <span class="ico">+</span>
        <span>新建任务</span>
      </button>
      <button
        class="btn-add-ws-secondary"
        type="button"
        title="添加工作区"
        @click="openAddWorkspaceModal"
      >
        <span class="ico">+</span>
        <span>工作区</span>
      </button>
      <button class="btn-collapse" type="button" title="收起任务列表" @click="collapsed = true">«</button>
    </div>

    <!-- 全局批量执行栏：跨 workspace 勾选后出现 -->
    <div v-if="checkedSummary.total > 0" class="global-batch-bar">
      <div class="gb-info">
        <b>已勾选 {{ checkedSummary.total }} 个</b>
        <span class="gb-sub">
          跨 {{ checkedSummary.wsCount }} 个 workspace
          <template v-if="checkedSummary.wsCount > 1">· 会编排为多批次</template>
        </span>
      </div>
      <button class="gb-btn" type="button" @click="openBatchExecuteModal()">▶ 批量执行</button>
    </div>

    <div class="filters">
      <span
        v-for="f in [
          { id: 'pending', label: '待处理' },
          { id: 'batch', label: '批处理' },
          { id: 'done', label: '已完成' },
          { id: 'all', label: '全部' },
        ]"
        :key="f.id"
        class="filter-tab"
        :class="{ active: activeFilter === f.id }"
        @click="setFilter(f.id)"
      >
        {{ f.label }}
      </span>
    </div>

    <div class="list-scroll">
      <div v-for="g in visibleGroups" :key="g.ws.id" class="ws-group">
        <!-- workspace header（可折叠）-->
        <header
          class="ws-head"
          :class="{ collapsed: isWorkspaceCollapsed(g.ws.id), missing: g.ws.missing }"
          @click="toggleWorkspaceCollapse(g.ws.id)"
        >
          <div class="ws-name">
            <span class="caret">▾</span>
            <span class="ws-dot" :style="{ background: g.ws.color }"></span>
            <span class="name">{{ g.ws.name }}</span>
            <span v-if="isWorkspaceCollapsed(g.ws.id)" class="summary">
              · {{ g.visibleCount }}/{{ g.totalCount }} 个任务
            </span>
          </div>
          <!-- 目录失效：显性标出来，别让用户以为只是空的 -->
          <span v-if="g.ws.missing" class="ws-missing">⚠️ 目录不存在</span>
          <!-- 仅在「执行中」/「失败」时显示状态 chip；空闲态隐藏（用户反馈：意义不明）-->
          <span
            v-else-if="wsStatusLabel(g).cls === 'run' || wsStatusLabel(g).cls === 'fail'"
            class="ws-status"
            :class="wsStatusLabel(g).cls"
          >
            {{ wsStatusLabel(g).label }}
          </span>
        </header>

        <!-- 失效工作区：把路径摊出来，用户才知道该去哪找 -->
        <div v-if="g.ws.missing && !isWorkspaceCollapsed(g.ws.id)" class="ws-missing-path">
          {{ g.ws.cwd }}
        </div>

        <!-- 任务区（折叠时隐藏）-->
        <div v-show="!isWorkspaceCollapsed(g.ws.id)" class="ws-body" :class="{ missing: g.ws.missing }">
          <!-- 批量执行栏已上移到列表顶部（跨 workspace 勾选） -->

          <!-- 批次任务（左色条 + 分割线含取消按钮）-->
          <div
            v-for="b in g.visibleBatches"
            :key="`block-${b.id}`"
            class="batch-block"
            :class="batchClass(b)"
          >
            <div class="batch-divider">
              <span class="label" :class="batchClass(b)" :title="batchLabel(b)">
                <span class="b-ico">{{ batchIcon(b) }}</span>{{ batchProgressText(b) }}
              </span>
              <span class="line"></span>
              <!-- 运行中/中断：中断/继续 + 取消 -->
              <template v-if="batchStatus(b) === 'running' || batchStatus(b) === 'paused'">
                <button
                  class="btn-batch btn-toggle"
                  :class="{ resume: batchStatus(b) === 'paused' }"
                  type="button"
                  :title="batchStatus(b) === 'paused' ? '继续批次' : '中断批次'"
                  @click="onToggleBatch($event, b)"
                >{{ batchStatus(b) === 'paused' ? '▶ 继续' : '⏸ 中断' }}</button>
                <button
                  class="btn-batch btn-cancel-batch"
                  type="button"
                  title="取消批次"
                  @click="onCancelBatch($event, b.id)"
                >✕ 取消</button>
              </template>
              <!-- 跑完待确认：完成任务 + 重新编辑 -->
              <template v-else-if="batchStatus(b) === 'reviewing'">
                <button
                  class="btn-batch btn-finish"
                  type="button"
                  title="整批归档到已完成"
                  @click="onFinishBatch($event, b.id)"
                >✓ 完成任务</button>
                <button
                  class="btn-batch btn-reedit"
                  type="button"
                  title="放回待处理·重新编辑"
                  @click="onReeditBatch($event, b.id)"
                >✎ 重新编辑</button>
              </template>
            </div>
            <article
              v-for="t in g.inBatch.filter((t) => t.batchId === b.id)"
              :key="t.id"
              class="task-card"
              :class="{ active: t.id === selectedTaskId, failed: t.status === 'failed', done: t.status === 'done', waiting: t.status === 'waiting' }"
              draggable="true"
              @click="onCardClick(t)"
              @dragstart="onDragStart($event, t)"
              @dragend="onDragEnd"
            >
              <span
                v-if="leadType(t) === 'check'"
                class="check"
                :class="{ on: isChecked(t) }"
                @click="onCheckClick($event, t)"
              ></span>
              <span v-else class="status-pip" :class="t.status">{{ pipText(t) }}</span>
              <div class="body">
                <div class="row1">
                  <span class="pill" :class="`pill-${t.type}`">{{ t.type }}</span>
                </div>
                <div class="title">{{ t.title }}</div>
                <div v-if="taskMeta(t).label" class="meta">
                  <span class="dot" :class="taskMeta(t).cls"></span>
                  {{ taskMeta(t).label }}
                  <span v-if="t.depHint" class="dep">· 🔗 {{ t.depHint }}</span>
                </div>
              </div>
              <button
                v-if="canComplete(t)"
                class="card-done-btn"
                type="button"
                title="标记完成"
                @click="onComplete($event, t)"
              >✓ 完成</button>
            </article>
          </div>

          <!-- 非批次任务 -->
          <article
            v-for="t in g.free"
            :key="t.id"
            class="task-card"
            :class="{ active: t.id === selectedTaskId, waiting: t.status === 'waiting' }"
            draggable="true"
            @click="onCardClick(t)"
            @dragstart="onDragStart($event, t)"
            @dragend="onDragEnd"
          >
            <span
              v-if="leadType(t) === 'check'"
              class="check"
              :class="{ on: isChecked(t) }"
              @click="onCheckClick($event, t)"
            ></span>
            <span v-else class="status-pip" :class="t.status">{{ pipText(t) }}</span>
            <div class="body">
              <div class="row1">
                <span class="pill" :class="`pill-${t.type}`">{{ t.type }}</span>
              </div>
              <div class="title">{{ t.title }}</div>
              <div v-if="taskMeta(t).label" class="meta">
                <span class="dot" :class="taskMeta(t).cls"></span>
                {{ taskMeta(t).label }}
              </div>
            </div>
            <button
              v-if="canComplete(t)"
              class="card-done-btn"
              type="button"
              title="标记完成"
              @click="onComplete($event, t)"
            >✓ 完成</button>
          </article>

          <!-- 空态（筛选后）-->
          <div v-if="!g.visibleCount" class="ws-empty">没有符合筛选的任务</div>
        </div>
      </div>

    </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

// 任务卡右上角的执行模式标签：kode（紫）/ ide（蓝）
// 绝对定位到 .task-card（position: relative）右上角
.mode-tag {
  position: absolute;
  top: 8px;
  right: 9px;
  z-index: 1;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 4px;
  font-weight: $fw-medium;
  line-height: 1.5;
  letter-spacing: 0.02em;

  &.mode-kode { color: $aurora-purple; background: rgba(132, 120, 250, 0.14); }
  &.mode-ide { color: #2080c8; background: rgba(119, 201, 251, 0.28); }
}

// 任务卡 hover 才露出的「标记完成」按钮（右下角）
.card-done-btn {
  position: absolute;
  bottom: 6px;
  right: 8px;
  z-index: 2;
  opacity: 0;
  padding: 2px 9px;
  border: 1px solid rgba(52, 199, 123, 0.4);
  border-radius: 12px;
  background: rgba(52, 199, 123, 0.1);
  color: #1c9a5e;
  font-size: 11px;
  font-weight: $fw-medium;
  cursor: pointer;
  transition: opacity $anim-fast, background $anim-fast;
  &:hover { background: rgba(52, 199, 123, 0.2); }
}
.task-card:hover .card-done-btn { opacity: 1; }

.kode-left {
  width: $left-col-w;
  border-right: 1px solid $border;
  background: $bg-secondary;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s ease;

  &.collapsed { width: 40px; }
}

// 内容包裹层：撑满，保留原列布局
.left-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

// 收起态细条
.left-expand {
  flex: 1;
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
  color: $text-muted;
  transition: background $anim-fast, color $anim-fast;
  &:hover { background: rgba(132, 120, 250, 0.06); color: $aurora-purple; }
  .le-icon { font-size: 16px; font-weight: $fw-bold; }
  .le-label { writing-mode: vertical-rl; letter-spacing: 2px; font-size: $fs-md; }
}

// 收起按钮（展开态头部）
.btn-collapse {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: $text-muted;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all $anim-fast;
  &:hover { background: rgba(132, 120, 250, 0.10); color: $aurora-purple; }
}

.left-head {
  padding: 14px 14px 10px;
  display: flex;
  align-items: center;
  gap: 8px;

  .btn-new-task {
    flex: 1;
    padding: 9px 12px;
    border: 0;
    border-radius: $radius-md;
    font-size: $fs-md;
    color: #fff;
    background: $gradient-aurora;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: inherit;
    font-weight: $fw-semibold;
    transition: all $anim-fast;
    box-shadow: 0 2px 8px rgba(132, 120, 250, 0.25);

    .ico { font-size: $fs-lg; line-height: 1; }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(132, 120, 250, 0.35);
    }
  }

  // 次按钮：添加工作区（白底紫边/紫字，小一号，不抢主按钮风头）
  .btn-add-ws-secondary {
    flex-shrink: 0;
    padding: 8px 10px;
    border: 1px solid rgba(132, 120, 250, 0.35);
    border-radius: $radius-md;
    font-size: $fs-base;
    color: $aurora-purple;
    background: $bg-primary;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    font-weight: $fw-medium;
    transition: all $anim-fast;

    .ico { font-size: $fs-md; line-height: 1; }

    &:hover {
      background: rgba(132, 120, 250, 0.08);
      border-color: $aurora-purple;
    }
  }
}

// 全局批量执行栏：跨 workspace 勾选后才出现
.global-batch-bar {
  margin: 0 14px 10px;
  padding: 8px 12px;
  background: rgba(132, 120, 250, 0.06);
  border: 1px solid rgba(132, 120, 250, 0.22);
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: kode-msg-appear 0.2s ease-out;

  .gb-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: $fs-xs;

    b {
      color: $text-display;
      font-weight: $fw-semibold;
      font-size: $fs-base;
    }
    .gb-sub {
      color: $text-muted;
    }
  }

  .gb-btn {
    flex-shrink: 0;
    padding: 5px 14px;
    border: 0;
    border-radius: 14px;
    background: $gradient-aurora;
    color: #fff;
    font-size: $fs-base;
    font-weight: $fw-semibold;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(132, 120, 250, 0.25);
    transition: all $anim-fast;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(132, 120, 250, 0.35);
    }
  }
}

@keyframes kode-msg-appear {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.filters {
  padding: 0 14px 10px;
  display: flex;
  gap: 4px;
  font-size: $fs-base;
  overflow-x: auto;  // 6 个 tab 可能挤,左栏窄时支持横滚兜底
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }

  .filter-tab {
    padding: 4px 10px;
    border-radius: $radius-sm;
    color: $text-muted;
    cursor: pointer;
    transition: all $anim-fast;
    flex-shrink: 0;
    white-space: nowrap;

    &:hover {
      color: $text-secondary;
    }

    &.active {
      background: rgba(132, 120, 250, 0.1);
      color: $aurora-purple;
      font-weight: $fw-medium;
    }
  }
}

.list-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 12px;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 3px; }
}

.ws-group { margin: 0 12px 16px; }


// 目录失效工作区：显性提示 + 底下任务整组变暗
.ws-missing {
  flex-shrink: 0;
  font-size: $fs-xs;
  font-weight: $fw-semibold;
  color: #e11d48;
  background: rgba(225, 29, 72, 0.10);
  padding: 2px 7px;
  border-radius: 6px;
}
.ws-missing-path {
  margin: 0 4px 6px 22px;
  font-size: $fs-xs;
  color: $text-faint;
  font-family: 'SF Mono', Monaco, monospace;
  word-break: break-all;
}
.ws-body.missing {
  // 任务卡仍可点选（要能进去看 Plan 的降级态），但视觉压暗表明它失效；
  // 勾选/批量/执行等操作在各自入口单独禁（见 wsMissing）
  opacity: 0.6;
}

.ws-head {
  padding: 8px 4px 6px;
  font-size: $fs-base;
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: space-between;
  &.missing .name { color: $text-muted; }
  cursor: pointer;
  border-radius: $radius-sm;
  transition: background $anim-fast;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .ws-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: $fw-medium;
    min-width: 0;
    flex: 1;

    .caret {
      color: $text-faint;
      font-size: $fs-xs;
      transition: transform $anim-base;
      flex-shrink: 0;
    }

    .ws-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .name {
      color: $text-display;
    }

    .summary {
      color: $text-muted;
      font-weight: $fw-regular;
      font-size: $fs-xs;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &.collapsed .ws-name .caret {
    transform: rotate(-90deg);
  }

  .ws-status {
    font-size: $fs-sm;
    font-weight: $fw-regular;
    padding: 1px 8px;
    border-radius: 8px;
    flex-shrink: 0;

    &.idle { background: $bg-tertiary; color: $text-muted; }
    &.run { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    &.err { background: rgba(239, 68, 68, 0.10); color: $danger; }
  }
}

.ws-body {
  // 简单 transition：snappy
}

.batch-bar {
  margin: 4px 0 8px;
  padding: 8px 10px;
  background: $gradient-aurora-soft;
  border: 1px solid rgba(132, 120, 250, 0.25);
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  gap: 8px;

  .count {
    background: $aurora-purple;
    color: #fff;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .info {
    flex: 1;
    font-size: $fs-sm;
    color: $text-secondary;
    line-height: 1.35;

    b {
      color: $text-display;
      display: block;
    }

    .sub {
      font-size: $fs-xs;
      color: $text-muted;
    }
  }

  .btn-batch {
    padding: 4px 10px;
    background: $aurora-purple;
    color: #fff;
    border: 0;
    border-radius: $radius-sm;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    cursor: pointer;
    font-family: inherit;
  }
}

// 批次块（左色条）
.batch-block {
  position: relative;
  padding-left: 8px;
  margin-bottom: 8px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 22px;
    bottom: 6px;
    width: 2px;
    border-radius: 2px;
    background: rgba(132, 120, 250, 0.3);
  }

  &.running::before { background: $aurora-purple; }
  &.done::before { background: $success; }
  &.mixed::before { background: $warning; }
}

.batch-divider {
  margin: 6px 0 6px 0;
  font-size: $fs-xs;
  color: $text-muted;
  display: flex;
  align-items: center;
  gap: 6px;

  .label {
    padding: 1px 7px;
    background: $bg-primary;
    border: 1px solid $border;
    border-radius: 8px;
    font-weight: $fw-medium;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    .b-ico { font-size: 9px; opacity: 0.85; }

    &.running { color: $aurora-purple; border-color: rgba(132, 120, 250, 0.3); }
    &.paused { color: $warning; border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.04); }
    &.reviewing { color: #2080c8; border-color: rgba(32, 128, 200, 0.35); background: rgba(87, 207, 222, 0.06); }
    &.done { color: $success; border-color: rgba(34, 197, 94, 0.3); }
    &.mixed { color: $warning; border-color: rgba(245, 158, 11, 0.3); }
  }

  .line {
    flex: 1;
    height: 1px;
    background: $border;
  }

  // 批次操作按钮基座
  .btn-batch {
    padding: 1px 8px;
    border-radius: 8px;
    font-size: $fs-xs;
    cursor: pointer;
    font-family: inherit;
    font-weight: $fw-medium;
    flex-shrink: 0;
    transition: all $anim-fast;
    white-space: nowrap;
  }

  // 中断/继续 = 常用操作,中性描边;继续时转 aurora 强调正向
  .btn-toggle {
    background: $bg-primary;
    color: $text-muted;
    border: 1px solid $border;
    &:hover { border-color: $text-faint; color: $text-display; }

    &.resume {
      color: $aurora-purple;
      border-color: rgba(132, 120, 250, 0.4);
      background: rgba(132, 120, 250, 0.06);
      &:hover { background: rgba(132, 120, 250, 0.12); border-color: rgba(132, 120, 250, 0.6); }
    }
  }

  // 取消 = 危险操作,红系,层级更重
  .btn-cancel-batch {
    background: $bg-primary;
    color: $danger;
    border: 1px solid rgba(239, 68, 68, 0.3);
    &:hover {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.5);
    }
  }

  // 完成任务 = 正向主操作,aurora 实心
  .btn-finish {
    background: $aurora-purple;
    color: #fff;
    border: 1px solid $aurora-purple;
    &:hover { background: #6f61e8; border-color: #6f61e8; }
  }
  // 重新编辑 = 次要,中性描边
  .btn-reedit {
    background: $bg-primary;
    color: $text-muted;
    border: 1px solid $border;
    &:hover { border-color: $text-faint; color: $text-display; }
  }
}

.task-card {
  background: $bg-primary;
  border: 1px solid $border;
  border-radius: $radius-lg;
  padding: 9px 10px;
  margin-bottom: 4px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: grab;

  &:active { cursor: grabbing; }

  // 拖拽中：本卡半透明，提示用户拖到目标
  &.is-dragging {
    opacity: 0.4;
    cursor: grabbing;
  }
  transition: all $anim-fast;
  position: relative;

  &:hover {
    border-color: rgba(132, 120, 250, 0.3);
  }

  &.active {
    border-color: $aurora-purple;
    background: rgba(132, 120, 250, 0.04);
    box-shadow: 0 0 0 3px rgba(132, 120, 250, 0.08);
  }

  &.failed {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.04);
  }

  // 🟡 等待用户决策：黄色边框 + 微 glow（让你扫一眼就发现哪个任务卡了）
  &.waiting {
    border-color: rgba(234, 179, 8, 0.45);
    background: rgba(234, 179, 8, 0.06);
    box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.10);
    animation: kode-waiting-glow 1.6s ease-in-out infinite;
  }

  &.done { opacity: 0.65; }

  .check {
    width: 15px;
    height: 15px;
    border: 1.5px solid $text-faint;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $anim-fast;
    cursor: pointer;

    &:hover { border-color: $aurora-purple; }

    &.on {
      background: $aurora-purple;
      border-color: $aurora-purple;
      &::after { content: '✓'; color: #fff; font-size: 10px; font-weight: 700; }
    }
  }

  .status-pip {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    border: 1.5px solid transparent;

    &.done { background: $success; }
    &.running { background: $aurora-purple; animation: kode-pulse 1.5s infinite; }
    &.waiting { background: #eab308; color: #fff; animation: kode-pulse 1.2s infinite; }
    &.queue { background: #fff; border-color: $warning; color: $warning; }
    &.failed { background: $danger; }
    &.ready { background: $success; }
  }

  .body { flex: 1; min-width: 0; }
  .row1 { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }

  .pill {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: $fs-xs;
    font-weight: $fw-medium;
    line-height: 1.4;
  }

  .pill-用例 { background: $pill-uc-bg; color: $pill-uc-text; }
  .pill-需求 { background: $pill-req-bg; color: $pill-req-text; }
  .pill-研发任务 { background: $pill-dev-bg; color: $pill-dev-text; }
  .pill-缺陷 { background: $pill-bug-bg; color: $pill-bug-text; }

  .title {
    font-size: 12.5px;
    color: $text-display;
    font-weight: $fw-medium;
    line-height: 1.4;
  }

  .meta {
    font-size: $fs-xs;
    color: $text-muted;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 5px;

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: $text-faint;
      flex-shrink: 0;

      &.ready { background: $success; }
      &.running { background: $aurora-purple; animation: kode-pulse 1.5s infinite; }
      &.waiting { background: #eab308; animation: kode-pulse 1.2s infinite; }
      &.queue { background: $warning; }
      &.done { background: $success; }
      &.failed { background: $danger; }
    }

    .dep { color: $warning; }
  }

}

.ws-empty {
  padding: 14px 8px;
  font-size: $fs-xs;
  color: $text-faint;
  text-align: center;
  background: $bg-primary;
  border: 1px dashed $border;
  border-radius: $radius-sm;
}

@keyframes kode-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes kode-waiting-glow {
  0%, 100% { box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.10); }
  50%      { box-shadow: 0 0 0 5px rgba(234, 179, 8, 0.20); }
}
</style>
