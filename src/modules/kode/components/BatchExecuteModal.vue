<script setup>
import { inject, ref, computed, watch, reactive } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  showBatchExecuteModal,
  closeBatchExecuteModal,
  checkedTasksGroupedByWs,
  startBatchExecute,
  splitIntoBatches,
} = state

// per-task 是否「接前」（同批次，串行）
// undefined / true = 接前；false = 起新批次
// 第一个 task 永远是批次起点，忽略它的值
const chainConfig = reactive({})

// 本地 ws 内任务顺序（拖拽调整）：{ wsId: [task, task, ...] }
const wsTaskOrder = reactive({})

// 拖拽中的任务 id / 所属 wsId
let _dragTaskId = null
let _dragWsId = null

watch(showBatchExecuteModal, (v) => {
  if (!v) return
  for (const k of Object.keys(chainConfig)) delete chainConfig[k]
  for (const k of Object.keys(wsTaskOrder)) delete wsTaskOrder[k]
  for (const { ws, tasks: list } of checkedTasksGroupedByWs.value) {
    wsTaskOrder[ws.id] = [...list]  // 拷贝一份本地顺序
    list.forEach((t, i) => {
      chainConfig[t.id] = i === 0 ? false : true // 首个起点；其余默认接前
    })
  }
})

const groups = computed(() => checkedTasksGroupedByWs.value)
const totalTasks = computed(() => groups.value.reduce((n, g) => n + g.tasks.length, 0))

// ws 内任务的实际渲染顺序（用本地拷贝代替原 g.tasks）
function tasksOfWs(g) {
  return wsTaskOrder[g.ws.id] || g.tasks
}

// 实时计算每个 ws 内的批次切片
function batchesOfWs(g) {
  return splitIntoBatches(tasksOfWs(g), chainConfig)
}
const batchesCount = computed(() =>
  groups.value.reduce((n, g) => n + batchesOfWs(g).length, 0),
)

// 切换某 task 的接前 / 起新批次
function toggleChain(taskId) {
  chainConfig[taskId] = !chainConfig[taskId]
}

// ─── ws 内拖拽排序（不允许跨 ws） ───
function onRowDragStart(e, t, wsId) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(t.id))
  _dragTaskId = t.id
  _dragWsId = wsId
  e.currentTarget.classList.add('is-dragging')
}
function onRowDragEnd(e) {
  e.currentTarget?.classList?.remove?.('is-dragging')
  _dragTaskId = null
  _dragWsId = null
}
function onRowDragOver(e, wsId) {
  if (_dragWsId !== wsId) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
function onRowDrop(e, targetTask, wsId) {
  if (_dragWsId !== wsId) return
  e.preventDefault()
  if (!_dragTaskId || _dragTaskId === targetTask.id) return
  const arr = wsTaskOrder[wsId]
  if (!arr) return
  const from = arr.findIndex((x) => x.id === _dragTaskId)
  const to = arr.findIndex((x) => x.id === targetTask.id)
  if (from < 0 || to < 0) return
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
}

function onSubmit() {
  if (!totalTasks.value) return
  // 把本地拖拽后的顺序转成 { wsId: [taskId, ...] } 传给后端
  const wsTaskOrderPayload = {}
  for (const wsId of Object.keys(wsTaskOrder)) {
    wsTaskOrderPayload[wsId] = wsTaskOrder[wsId].map((t) => t.id)
  }
  startBatchExecute({
    chainConfig: { ...chainConfig },
    wsTaskOrder: wsTaskOrderPayload,
  })
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="showBatchExecuteModal" class="modal-overlay" @click.self="closeBatchExecuteModal">
        <div class="modal-card">
          <header class="modal-head">
            <h3>▶ 批量执行编排</h3>
            <button class="close" type="button" @click="closeBatchExecuteModal">✕</button>
          </header>

          <div class="modal-body">
            <!-- 顶部说明 -->
            <div class="banner">
              <div class="banner-line">
                <span class="banner-ico">⚙️</span>
                <span>
                  共 <b>{{ totalTasks }}</b> 个任务 · 将编排为 <b>{{ batchesCount }}</b> 个批次
                </span>
              </div>
              <div class="banner-sub">
                同 workspace 内默认串行；点任务右侧 <b>📍 起新批次</b> 可拆出独立批次
              </div>
            </div>

            <!-- 每个 workspace 一组 -->
            <div v-for="g in groups" :key="g.ws.id" class="ws-group">
              <header class="wsg-head">
                <span class="wsg-dot" :style="{ background: g.ws.color }"></span>
                <div class="wsg-info">
                  <div class="wsg-name">{{ g.ws.name }}</div>
                  <div class="wsg-cwd">{{ g.ws.cwd }}</div>
                </div>
                <span class="wsg-count">{{ batchesOfWs(g).length }} 个批次 · {{ g.tasks.length }} 个任务</span>
              </header>

              <!-- 任务列表（带 chain toggle 显示批次分隔 + 拖拽排序）-->
              <ul class="task-list">
                <template v-for="(t, i) in tasksOfWs(g)" :key="t.id">
                  <!-- 起新批次：显示分隔线 -->
                  <li v-if="i > 0 && chainConfig[t.id] === false" class="batch-separator">
                    <span class="sep-line"></span>
                    <span class="sep-label">↓ 新批次起点</span>
                    <span class="sep-line"></span>
                  </li>
                  <li
                    class="task-row"
                    :class="{ 'is-batch-start': i === 0 || chainConfig[t.id] === false }"
                    draggable="true"
                    @dragstart="onRowDragStart($event, t, g.ws.id)"
                    @dragend="onRowDragEnd"
                    @dragover="onRowDragOver($event, g.ws.id)"
                    @drop="onRowDrop($event, t, g.ws.id)"
                    title="可拖拽调整顺序"
                  >
                    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
                    <span class="task-idx">{{ i + 1 }}</span>
                    <span class="task-type" :class="`type-${t.type}`">{{ t.type }}</span>
                    <span class="task-title" :title="t.title">{{ t.title }}</span>
                    <!-- 第一个 task 永远是批次起点，不可切换 -->
                    <span v-if="i === 0" class="chain-chip start">📍 批次起点</span>
                    <button
                      v-else
                      type="button"
                      class="chain-toggle"
                      :class="{ 'is-break': chainConfig[t.id] === false }"
                      @click="toggleChain(t.id)"
                      :title="chainConfig[t.id] === false ? '改为接前（同批串行）' : '改为起新批次（独立）'"
                    >
                      <template v-if="chainConfig[t.id] === false">📍 起新批次</template>
                      <template v-else>⛓ 接前</template>
                    </button>
                  </li>
                </template>
              </ul>
            </div>
          </div>

          <footer class="modal-foot">
            <button class="btn-cancel" type="button" @click="closeBatchExecuteModal">取消</button>
            <button class="btn-submit" :disabled="!totalTasks" type="button" @click="onSubmit">
              ▶ 开始执行（{{ batchesCount }} 批次 · {{ totalTasks }} 任务）
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 41, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 600px;
  max-width: 100%;
  max-height: 90vh;
  background: $bg-primary;
  border-radius: $radius-2xl;
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-head {
  padding: 18px 22px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid $border-light;

  h3 {
    margin: 0;
    font-size: $fs-xl;
    font-weight: $fw-semibold;
    color: $text-display;
  }

  .close {
    border: 0;
    background: transparent;
    color: $text-muted;
    font-size: $fs-md;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;

    &:hover { background: $bg-secondary; color: $text-display; }
  }
}

.modal-body {
  padding: 18px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

// 顶部说明
.banner {
  background: linear-gradient(135deg, rgba(132, 120, 250, 0.06), rgba(119, 201, 251, 0.06));
  border: 1px solid rgba(132, 120, 250, 0.2);
  border-radius: $radius-md;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .banner-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: $fs-base;
    color: $text-display;

    .banner-ico { font-size: 15px; }
    b { color: $aurora-purple; font-weight: $fw-semibold; }
  }

  .banner-sub {
    font-size: $fs-xs;
    color: $text-muted;
    line-height: 1.6;
    padding-left: 23px;

    b { color: $aurora-purple; font-weight: $fw-medium; }
  }
}

// workspace 分组
.ws-group {
  background: $bg-secondary;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wsg-head {
  display: flex;
  align-items: center;
  gap: 8px;

  .wsg-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .wsg-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .wsg-name {
    font-size: $fs-md;
    font-weight: $fw-semibold;
    color: $text-display;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wsg-cwd {
    font-size: $fs-xs;
    color: $text-faint;
    font-family: 'SF Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wsg-count {
    flex-shrink: 0;
    font-size: $fs-xs;
    color: $aurora-purple;
    font-weight: $fw-medium;
    padding: 2px 8px;
    background: rgba(132, 120, 250, 0.10);
    border-radius: 10px;
  }
}

// 任务列表
.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: $bg-primary;
  border-radius: $radius-sm;
  border: 1px solid $border-light;
  overflow: hidden;
}

// 批次分隔线
.batch-separator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(132, 120, 250, 0.04);
  border-top: 1px dashed rgba(132, 120, 250, 0.3);
  border-bottom: 1px dashed rgba(132, 120, 250, 0.3);

  .sep-line {
    flex: 1;
    height: 1px;
    background: rgba(132, 120, 250, 0.2);
  }

  .sep-label {
    font-size: 11px;
    color: $aurora-purple;
    font-weight: $fw-semibold;
  }
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: $fs-base;
  border-bottom: 1px solid $border-light;
  cursor: grab;
  transition: background $anim-fast, opacity $anim-fast;

  &:active { cursor: grabbing; }
  &.is-dragging { opacity: 0.4; cursor: grabbing; }

  &:hover {
    background: rgba(132, 120, 250, 0.04);
    .drag-handle { color: $aurora-purple; }
  }

  &:last-child { border-bottom: 0; }

  .drag-handle {
    flex-shrink: 0;
    color: $text-faint;
    font-size: 12px;
    letter-spacing: -2px;
    user-select: none;
    transition: color $anim-fast;
  }

  .task-idx {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: $bg-secondary;
    border: 1px solid $border;
    color: $text-muted;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: $fw-semibold;
    flex-shrink: 0;
  }

  .task-type {
    font-size: $fs-xs;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    font-weight: $fw-medium;
  }
  .task-type.type-需求 { background: rgba(34, 197, 94, 0.12); color: $success; }
  .task-type.type-研发任务 { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
  .task-type.type-缺陷 { background: rgba(239, 68, 68, 0.12); color: $danger; }
  .task-type.type-用例 { background: rgba(87, 207, 222, 0.12); color: #0891b2; }

  .task-title {
    flex: 1;
    min-width: 0;
    color: $text-display;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// chain toggle 按钮 / 起点 chip
.chain-chip {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: $fw-semibold;
  white-space: nowrap;
}
.chain-chip.start {
  background: rgba(132, 120, 250, 0.12);
  color: $aurora-purple;
}

.chain-toggle {
  flex-shrink: 0;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 10px;
  border: 1px solid $border;
  background: $bg-primary;
  color: $text-secondary;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  font-weight: $fw-medium;
  transition: all $anim-fast;

  &:hover {
    border-color: $aurora-purple;
    color: $aurora-purple;
  }

  &.is-break {
    background: rgba(132, 120, 250, 0.10);
    border-color: rgba(132, 120, 250, 0.40);
    color: $aurora-purple;
  }
}

.modal-foot {
  padding: 14px 22px;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  .btn-cancel {
    padding: 7px 16px;
    background: transparent;
    border: 1px solid $border;
    border-radius: 16px;
    color: $text-secondary;
    cursor: pointer;
    font-family: inherit;
    font-size: $fs-base;

    &:hover { background: $bg-secondary; }
  }

  .btn-submit {
    padding: 7px 18px;
    border: 0;
    border-radius: 16px;
    background: $gradient-aurora;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: $fs-base;
    font-weight: $fw-semibold;
    box-shadow: 0 2px 10px rgba(132, 120, 250, 0.25);
    transition: all $anim-fast;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(132, 120, 250, 0.35);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
  .modal-card { transition: transform 0.15s ease; }
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  .modal-card { transform: scale(0.96); }
}
</style>
