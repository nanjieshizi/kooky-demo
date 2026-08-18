<script setup>
import { inject, computed, ref, watch } from 'vue'
import { KODE_STATE_KEY } from '../../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  selectedTask,
  currentTodos,
  currentProducts,
  visibleTodos,
  phase,
  execProgress,
  execStatus,
  execIndex,
  startExecuting,
  openProductInPreview,
  wsMissing,
} = state

// 产物点击 → 预览（仅预览页已开才跳；否则提示去 +）
// 目录失效时产物已不在磁盘（或在别的分支上），不给点
const hintNoPreview = ref(false)
let hintTimer = null
function onProductClick(p) {
  if (wsMissing.value) return
  if (!openProductInPreview(p)) {
    hintNoPreview.value = true
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { hintNoPreview.value = false }, 2600)
  }
}

// 草稿视图 = planning / ready；执行视图 = executing / done
const isDraft = computed(() => phase.value === 'planning' || phase.value === 'ready')
const total = computed(() => currentTodos.value.length)
const doneCount = computed(() =>
  currentTodos.value.filter((_, i) => execStatus(i) === 'done').length,
)

// 处理视图：每步工作流手风琴展开（互斥,同时只开一个）
// 默认展开「执行中」那步;全部完成后默认展开最后一步。-1=全收起
const openStep = ref(-1)
// 执行中跟随运行步;done 落最后一步（用户随后可自由点开别的）
watch(
  [phase, execIndex],
  () => {
    if (phase.value === 'executing') openStep.value = Math.max(0, execIndex.value)
    else if (phase.value === 'done') openStep.value = total.value - 1
  },
  { immediate: true },
)
function isStepOpen(i) { return openStep.value === i }
function toggleStep(i) {
  if (execStatus(i) === 'queued') return // 排队中没有工作流
  openStep.value = openStep.value === i ? -1 : i
}

// mock：每步的具体工作流（真实接 CC tool_use 流）。比两行多,贴近真实 CC 执行
function workLines(t, status) {
  const head = (t.text || '').slice(0, 10)
  const base = [
    { ico: '📖', text: `读取 src/ 下与「${head}」相关文件` },
    { ico: '🔍', text: 'grep 关键调用点 · 命中 6 处' },
    { ico: '✏️', text: '编辑 MessageList.vue（+38 −12）' },
    { ico: '✏️', text: '编辑 useInfiniteScroll.ts（+24）' },
    { ico: '⌘', text: '运行 pnpm test -- message-list' },
    { ico: '✓', text: '12 passed · 0 failed', kind: 'note' },
    { ico: '⌘', text: 'git add -A && commit' },
  ]
  if (status === 'running') {
    return [...base.slice(0, 4), { ico: '▸', text: '正在处理…', kind: 'active' }]
  }
  return base
}
</script>

<template>
  <div class="todo-center" v-if="selectedTask">
    <!-- ───────── 草稿视图（planning / ready）───────── -->
    <template v-if="isDraft">
      <header class="tc-head">
        <span class="tc-title">📝 Todolist 草稿</span>
        <span class="tc-badge" :class="phase">
          {{ phase === 'planning' ? '拆解中…' : `待执行 · ${total} 步` }}
        </span>
        <span class="tc-spacer"></span>
        <span class="tc-hint">去任务助手继续完善</span>
      </header>

      <!-- 进度条（草稿态也保留，0%，避免显得空）-->
      <div class="prog-row">
        <span class="prog-label">{{ doneCount }} / {{ total }} 完成 · {{ execProgress }}%</span>
        <div class="prog-track">
          <div class="prog-fill" :style="{ width: execProgress + '%' }"></div>
        </div>
      </div>

      <ul class="draft-list">
        <li v-for="(t, i) in visibleTodos" :key="t.id" class="draft-item" :class="{ fresh: t.isNew }">
          <span class="d-no">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="d-circle"></span>
          <span class="d-text">{{ t.text }}</span>
          <span v-if="t.isNew" class="d-new">新</span>
        </li>
      </ul>

      <footer class="tc-foot">
        <button
          class="exec-btn"
          :class="{ ready: phase === 'ready' && !wsMissing }"
          type="button"
          :disabled="phase !== 'ready' || wsMissing"
          @click="startExecuting"
        >
          {{ phase === 'ready' ? `▶ 执行 Todolist（${total} 步）` : '拆解中…' }}
        </button>
        <span class="foot-tip">
          {{ wsMissing ? '🗂️ 工作区目录不存在，无法执行' : (phase === 'ready' ? '满意就交给 CC 逐条开干' : '任务助手正在拆解，稍候') }}
        </span>
      </footer>
    </template>

    <!-- ───────── 执行视图（executing / done / waiting）───────── -->
    <template v-else>
      <header class="tc-head">
        <span class="tc-title">⚙️ 处理</span>
        <span class="tc-badge" :class="phase">
          {{ phase === 'waiting' ? '等待执行' : phase === 'done' ? '已完成' : '执行中' }}
        </span>
        <span class="tc-spacer"></span>
        <span class="tc-hint">Todolist · CC 真实处理工作流</span>
      </header>

      <!-- 等待执行横幅（批量执行时排在队列里）-->
      <div v-if="phase === 'waiting'" class="wait-banner">
        ⏳ 在批量队列中排队，等待前序任务完成后自动开始
      </div>

      <!-- 进度条（纯展示）-->
      <div class="prog-row">
        <span class="prog-label">{{ doneCount }} / {{ total }} 完成 · {{ execProgress }}%</span>
        <div class="prog-track">
          <div class="prog-fill" :style="{ width: execProgress + '%' }"></div>
        </div>
      </div>

      <!-- 时间线：点击步骤展开它的工作流（互斥,同时只开一个）-->
      <ul class="timeline">
        <li
          v-for="(t, i) in currentTodos"
          :key="t.id"
          class="tl-item"
          :class="[execStatus(i), { 'tl-item--open': isStepOpen(i) }]"
        >
          <div class="tl-gutter">
            <span class="tl-icon">
              <span v-if="execStatus(i) === 'done'" class="ic-done">✓</span>
              <span v-else-if="execStatus(i) === 'running'" class="ic-spin"></span>
              <span v-else class="ic-queue"></span>
            </span>
            <span v-if="i < currentTodos.length - 1" class="tl-line"></span>
          </div>
          <div class="tl-body">
            <button
              class="tl-row"
              :class="{ clickable: execStatus(i) !== 'queued' }"
              type="button"
              @click="toggleStep(i)"
            >
              <span class="tl-no">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="tl-text">{{ t.text }}</span>
              <span class="tl-chip" :class="execStatus(i)">
                {{ execStatus(i) === 'done' ? '已完成' : execStatus(i) === 'running' ? '执行中' : '排队' }}
              </span>
              <span v-if="execStatus(i) !== 'queued'" class="tl-caret">{{ isStepOpen(i) ? '▾' : '▸' }}</span>
            </button>
            <!-- 具体工作流（展开该步时显示；done=处理记录 / running=实时）-->
            <div v-if="isStepOpen(i) && execStatus(i) !== 'queued'" class="tl-work" :class="execStatus(i)">
              <div class="work-title">{{ execStatus(i) === 'running' ? '⚡ Kode 实时处理工作流' : '处理记录' }}</div>
              <div
                v-for="(w, wi) in workLines(t, execStatus(i))"
                :key="wi"
                class="work-line"
                :class="w.kind"
              >
                <span class="wl-ico">{{ w.ico }}</span> {{ w.text }}
              </div>
            </div>
          </div>
        </li>
      </ul>

      <!-- 📦 产物：执行完(done)后在时间线下方出现，点击跳预览标签页 -->
      <section v-if="phase === 'done' && currentProducts.length" class="products">
        <div class="prod-head">
          <span class="prod-title">📦 产物</span>
          <span class="prod-count">{{ currentProducts.length }}</span>
          <span class="prod-spacer"></span>
          <span class="prod-tip">点击在预览中打开 →</span>
        </div>
        <ul class="prod-list">
          <li v-for="p in currentProducts" :key="p.id" class="prod-item" @click="onProductClick(p)">
            <span class="pi-ico">{{ p.icon || '📄' }}</span>
            <span class="pi-path">{{ p.path }}</span>
            <span class="pi-go">↗</span>
          </li>
        </ul>
        <div v-if="hintNoPreview" class="prod-hint">先点顶部 ＋ 打开「🌐 预览」标签页，再点产物即可查看</div>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles.scss' as *;

.todo-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
}

.tc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-shrink: 0;
  flex-wrap: wrap;

  .tc-title { font-size: $fs-md; font-weight: $fw-bold; color: $text-display; white-space: nowrap; }
  .tc-spacer { flex: 1; }
  .tc-hint { font-size: $fs-xs; color: $text-faint; white-space: nowrap; }
  .tc-badge {
    padding: 3px 10px;
    border-radius: 8px;
    font-size: $fs-xs;
    font-weight: $fw-semibold;
    &.planning { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    &.ready { background: #f3fbf6; color: #16a34a; }
    &.executing { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    &.done { background: #f3fbf6; color: #16a34a; }
    &.waiting { background: #fdf6e3; color: #d97706; }
  }
}

.wait-banner {
  flex-shrink: 0;
  margin-bottom: 14px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #fdf6e3;
  border: 1px solid #f3e3b3;
  color: #b45309;
  font-size: $fs-md;
}

/* ───── 草稿列表 ───── */
.draft-list { list-style: none; margin: 0 0 auto; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.draft-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 6px 6px;
  border-radius: 8px;
  animation: kkin 0.32s cubic-bezier(0.45, 0.02, 0.18, 1);

  .d-no { font-size: $fs-xs; font-weight: $fw-bold; color: #cabfe8; font-family: 'SF Mono', Monaco, monospace; line-height: 1.5; flex-shrink: 0; }
  .d-circle { width: 14px; height: 14px; margin-top: 2px; border-radius: 50%; border: 1.5px solid #d8d3e6; flex-shrink: 0; }
  .d-text { font-size: $fs-md; color: #3b414c; line-height: 1.5; }
  .d-new { padding: 0 5px; border-radius: 5px; font-size: 10px; font-weight: $fw-semibold; background: rgba(132, 120, 250, 0.14); color: $aurora-purple; flex-shrink: 0; align-self: center; }
  &.fresh { background: rgba(132, 120, 250, 0.05); }
}

/* ───── 执行按钮 ───── */
.tc-foot { display: flex; align-items: center; gap: 10px; padding-top: 14px; flex-shrink: 0; }
.exec-btn {
  height: 34px;
  padding: 0 16px;
  border: 0;
  border-radius: 9px;
  font-size: $fs-md;
  font-weight: $fw-semibold;
  font-family: inherit;
  cursor: not-allowed;
  background: #ece9e3;
  color: #b3b8c0;
  transition: all $anim-base;
  white-space: nowrap;

  &.ready {
    cursor: pointer;
    background: $gradient-aurora;
    color: #fff;
    box-shadow: 0 3px 10px rgba(132, 120, 250, 0.30);
    &:hover { transform: translateY(-1px); }
  }
}
.foot-tip { font-size: $fs-xs; color: $text-faint; min-width: 0; }

/* ───── 进度条 ───── */
.prog-row { margin-bottom: 14px; flex-shrink: 0; }
.prog-label { font-size: $fs-base; color: $aurora-purple; font-weight: $fw-medium; }
.prog-track { margin-top: 6px; height: 6px; border-radius: 99px; background: #f0edf7; overflow: hidden; }
.prog-fill { height: 100%; border-radius: 99px; background: $gradient-aurora; transition: width 0.6s ease; }

/* ───── 时间线 ───── */
.timeline { list-style: none; margin: 0; padding: 0; }
.tl-item { display: flex; gap: 10px; }
.tl-gutter { width: 20px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.tl-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.ic-done { width: 20px; height: 20px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.ic-spin { width: 20px; height: 20px; border-radius: 50%; border: 2px solid $aurora-purple; border-top-color: transparent; animation: kkspin 0.8s linear infinite; }
.ic-queue { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #d8d3e6; }
.tl-line { flex: 1; width: 2px; min-height: 12px; background: #ece8f5; margin: 2px 0; }
.tl-item.done .tl-line { background: #bfe6cc; }

.tl-body { flex: 1; min-width: 0; padding-bottom: 10px; }
.tl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  font-family: inherit;
  padding: 4px 6px;
  border-radius: 8px;
  text-align: left;
  cursor: default;
  &.clickable { cursor: pointer; }
  &.clickable:hover { background: rgba(132, 120, 250, 0.05); }
}
.tl-caret { color: $text-faint; font-size: 10px; flex-shrink: 0; }
.tl-no { font-size: $fs-xs; font-weight: $fw-bold; color: #cabfe8; font-family: 'SF Mono', Monaco, monospace; }
.tl-text { font-size: $fs-md; line-height: 1.45; flex: 1; min-width: 0; }
.tl-item.running .tl-text { font-weight: $fw-bold; color: #1f2430; }
.tl-item.done .tl-text { font-weight: $fw-semibold; color: $text-secondary; }
.tl-item.queued .tl-text { font-weight: $fw-semibold; color: #aab0ba; }
.tl-chip { padding: 2px 8px; border-radius: 6px; font-size: 10.5px; font-weight: $fw-semibold; flex-shrink: 0; }
.tl-chip.done { background: #eaf7ef; color: #16a34a; }
.tl-chip.running { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
.tl-chip.queued { background: #f3f2ef; color: #aab0ba; }

.tl-work {
  margin-top: 10px;
  border: 1px solid rgba(132, 120, 250, 0.23);
  background: #fcfbff;
  border-radius: 12px;
  padding: 10px 12px;
  .work-title { font-size: $fs-base; font-weight: $fw-semibold; color: $aurora-purple; margin-bottom: 8px; }
  .work-line { font-size: 12px; color: #3b414c; font-family: 'SF Mono', Monaco, monospace; padding: 2px 0; display: flex; gap: 8px; }
  .work-line .wl-ico { width: 15px; text-align: center; flex-shrink: 0; }
  .work-line.active { color: $aurora-purple; }
  .work-line.note { color: #16a34a; }

  // done 态:置灰、无高亮边框（处理记录）
  &.done {
    border-color: $border;
    background: $bg-secondary;
    .work-title { color: #bcc2cc; }
    .work-line { color: #aab0ba; }
  }
}

/* ───── 📦 产物（done 后时间线下方）───── */
.products { margin-top: 4px; padding-top: 14px; border-top: 1px solid $border; animation: kkin 0.32s ease; }
.prod-head { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
.prod-title { font-size: $fs-md; font-weight: $fw-semibold; color: $text-display; }
.prod-count { font-size: 10px; font-weight: $fw-semibold; color: $aurora-purple; background: rgba(132, 120, 250, 0.12); border-radius: 7px; padding: 1px 6px; }
.prod-spacer { flex: 1; }
.prod-tip { font-size: $fs-xs; color: $text-faint; }
.prod-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.prod-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border: 1px solid $border; border-radius: 9px; background: #fff;
  cursor: pointer; transition: all $anim-fast;
  &:hover { border-color: $aurora-purple; background: rgba(132, 120, 250, 0.04); }
  .pi-ico { font-size: 13px; }
  .pi-path { flex: 1; min-width: 0; font-family: 'SF Mono', Monaco, monospace; font-size: $fs-base; color: #3b414c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pi-go { color: $aurora-purple; font-weight: $fw-bold; }
}
.prod-hint { margin-top: 8px; font-size: $fs-xs; color: #d97706; background: #fdf6e3; border-radius: 8px; padding: 7px 10px; }

@keyframes kkin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes kkspin { to { transform: rotate(360deg); } }
</style>
