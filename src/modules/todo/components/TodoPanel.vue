<template>
  <div class="todo-panel">
    <!-- 标题栏 -->
    <header class="todo-head">
      <div class="head-title">
        待办
        <span v-if="store.openCount" class="head-badge">{{ store.openCount }}</span>
      </div>
      <button class="head-close" title="关闭" @click="close">✕</button>
    </header>

    <!-- 今日进度 -->
    <section class="today-bar">
      <div class="today-row">
        <span class="today-label">今日待办进度</span>
        <span v-if="progress.allDone" class="today-count is-done">全部闭环 🎉</span>
        <span v-else class="today-count">
          <span class="cnt-num" :class="{ pop: countPop }">{{ progress.done }}</span
          >/{{ progress.total }} 已闭环
        </span>
      </div>
      <div class="today-track">
        <div class="today-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
    </section>

    <!-- 手动添加 -->
    <section class="add-row">
      <input
        v-model="draft"
        class="add-input"
        type="text"
        placeholder="手动添加待办，例如：补齐评审结论"
        @keydown.enter="addManual"
      />
      <button class="add-date" :class="{ set: draftDate }" title="设定日期" @click="cycleDate">
        📅<span v-if="draftDate" class="date-tag">{{ draftDateLabel }}</span>
      </button>
      <button class="add-btn" :disabled="!draft.trim()" @click="addManual">添加</button>
    </section>

    <!-- 分组列表 -->
    <div class="todo-scroll">
      <section v-for="g in store.groups" :key="g.key" class="todo-group">
        <div class="group-head" :class="{ danger: g.danger }">
          <span class="group-name">
            <span v-if="g.danger" class="danger-dot"></span>{{ g.name }}
          </span>
          <span class="group-date">{{ g.dateLabel }}</span>
        </div>

        <div
          v-for="item in g.items"
          :key="item.id"
          class="todo-item"
          :class="{
            expanded: store.expandedId === item.id,
            celebrating: celebrating.has(item.id),
            collapsing: collapsing.has(item.id),
          }"
        >
          <!-- 行主体 -->
          <div class="item-row" @click="onRowClick(item)">
            <!-- 左标记 -->
            <span class="item-mark">
              <button
                v-if="item.type === 'manual'"
                class="mark-check"
                :class="{ checked: celebrating.has(item.id) }"
                title="完成"
                @click.stop="finishManual(item)"
              >
                <svg viewBox="0 0 20 20" class="check-svg">
                  <path d="M5 10.5l3.2 3.2L15 7" />
                </svg>
              </button>
              <span v-else class="mark-puck" :class="'t-' + item.type" :title="typeHint(item.type)">
                {{ typeIcon(item.type) }}
              </span>
            </span>

            <!-- 名称 + 来源群（常驻）-->
            <div class="item-body">
              <span class="item-title">{{ item.title }}</span>
              <button v-if="item.group" class="item-from" @click.stop="jumpToGroup(item)">
                🦀 来自 {{ item.group }}
              </button>
            </div>

            <!-- 转发到 Kode / 一人团队 -->
            <button class="fwd-btn" title="转发到 Kode / 一人团队" @click.stop="toggleFwd(item, $event)">↪</button>
          </div>

          <!-- 展开：三种协作完成方式 -->
          <div v-if="store.expandedId === item.id" class="item-expand">
            <!-- 提交文本结论：@团队助理 固定在对话框内 -->
            <template v-if="item.type === 'text'">
              <div class="submit-box">
                <span class="at-tag">@团队助理</span>
                <textarea
                  v-model="drafts[item.id]"
                  class="sb-textarea"
                  rows="2"
                  placeholder="输入结论，也可以补一句说明"
                ></textarea>
              </div>
            </template>

            <!-- 提交文件 -->
            <template v-else-if="item.type === 'file'">
              <div class="submit-tagline"><span class="at-tag">@团队助理</span></div>
              <label class="file-drop" :class="{ has: fileNames[item.id] }">
                <input type="file" class="file-input" @change="onFilePick(item, $event)" />
                <template v-if="fileNames[item.id]">
                  <span class="file-chip">📎 {{ fileNames[item.id] }}</span>
                </template>
                <template v-else>
                  <span class="drop-hint">点击选择文件，或拖拽到此</span>
                </template>
              </label>
              <input
                v-if="fileNames[item.id]"
                v-model="drafts[item.id]"
                class="expand-note"
                type="text"
                placeholder="补充说明（可选）"
              />
            </template>

            <!-- 投票 -->
            <template v-else-if="item.type === 'vote'">
              <div class="submit-tagline"><span class="at-tag">@团队助理</span></div>
              <button
                v-for="opt in item.options"
                :key="opt"
                class="vote-opt"
                @click="finishVote(item, opt)"
              >
                <span class="vote-radio"></span>{{ opt }}
              </button>
            </template>

            <!-- 操作条（vote 无：点选即投）-->
            <div v-if="item.type !== 'vote'" class="expand-acts">
              <button class="act-cancel" @click="store.collapse()">取消</button>
              <button class="act-send" :disabled="!canSend(item)" @click="finishSubmit(item)">
                发送
              </button>
            </div>
            <div class="expand-foot">将作为消息发送到「{{ item.group }}」</div>
          </div>
        </div>
      </section>

      <!-- 已完成区 -->
      <section v-if="store.doneItems.length" class="done-section">
        <div class="done-head">已完成 {{ store.doneItems.length }} 条</div>
        <div v-for="d in shownDone" :key="d.id" class="done-item">
          <span class="done-check">✓</span>
          <span class="done-title">{{ d.title }}</span>
          <span v-if="d.result" class="done-result">· {{ d.result }}</span>
        </div>
        <button
          v-if="store.doneItems.length > 3"
          class="done-toggle"
          @click="store.toggleShowAllCompleted()"
        >
          {{ store.showAllCompleted ? '收起' : `查看全部 ${store.doneItems.length} 条` }}
        </button>
      </section>
    </div>

    <!-- 转发菜单：Teleport 到 body，避开待办行 overflow:hidden 裁剪 -->
    <Teleport to="body">
      <div v-if="fwdItem" class="fwd-menu" :style="fwdMenuStyle" @click.stop>
        <button class="fm-item" @click="forwardToKode(fwdItem)">
          <span class="fm-ic">🖥️</span> 转发到 Kode
        </button>
        <div class="fm-sep"></div>
        <div class="fm-label">👥 转发到一人团队</div>
        <button
          v-for="t in teams"
          :key="t.id"
          class="fm-item fm-team"
          @click="forwardToTeam(fwdItem, t)"
        >
          <span class="fm-ic">🎯</span> {{ t.name }}
        </button>
        <div v-if="!teams.length" class="fm-empty">暂无一人团队</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useTodoStore } from '@/modules/todo/store/todoStore'
import { TODO_DEMO } from '@/modules/todo/demo/todoDemo'
import { forwardTodoToTeam } from '@/modules/solo-team/demo/onePersonDirector'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'

const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()
const store = useTodoStore()
const taskBridgeStore = useTaskBridgeStore()
store.seed(TODO_DEMO)

// —— 转发到 Kode / 一人团队（选具体团队）——
const teams = computed(() => soloTeamStore.onePersonTeams || [])
const fwdItem = ref(null)
const fwdMenuStyle = ref({})
function toggleFwd(item, e) {
  if (fwdItem.value && fwdItem.value.id === item.id) {
    fwdItem.value = null
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  fwdMenuStyle.value = {
    position: 'fixed',
    top: `${r.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - r.right)}px`,
  }
  fwdItem.value = item
}
function closeFwd() {
  fwdItem.value = null
}
function forwardToKode(item) {
  closeFwd()
  // 先切到 Kode（openClaudeCode 会挂载 KodeView + 注册桥接），一个 tick 后再预填新建任务
  uiStore.openClaudeCode?.()
  setTimeout(() => {
    window.__kookyMock?.openKodeNewTaskWithPrefill?.({
      prefilledDesc: item.title + (item.group ? `\n\n（来自待办 · ${item.group}）` : ''),
      sourceMeta: `来自「待办」${item.group ? ' · ' + item.group : ''}`,
      preferredWsId: 'kc',
    })
  }, 250)
  ElMessage?.success?.('已转发到 Kode，正在新建任务')
}
function forwardToTeam(item, team) {
  closeFwd()
  const teamId = team?.teamId ?? team?.id
  if (!teamId) return
  // 切到该一人团队工作区
  soloTeamStore.activateOnePersonTeamRuntime?.(teamId)
  uiStore.setActiveNavigation?.('solo-team', `team:${teamId}`)
  ElMessage?.success?.(`已转发到「${team.name}」，团队助理确认中…`)
  // 把待办作为消息发进主会话 → 团队助理确认 + 建子任务（mock）
  void forwardTodoToTeam(teamId, item.title)
}
onMounted(() => window.addEventListener('click', closeFwd))
onUnmounted(() => window.removeEventListener('click', closeFwd))

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// —— 类型元信息 ——
const TYPE_ICON = { text: '📝', file: '📎', vote: '🗳' }
const TYPE_HINT = { text: '提交结论', file: '提交文件', vote: '投票' }
function typeIcon(t) {
  return TYPE_ICON[t] || '•'
}
function typeHint(t) {
  return TYPE_HINT[t] || ''
}

// —— 今日进度 ——
const progress = computed(() => store.todayProgress)
const progressPct = computed(() => {
  const p = progress.value
  return p.total ? Math.round((p.done / p.total) * 100) : 0
})
const countPop = ref(false)
function pulseCount() {
  if (prefersReducedMotion) return
  countPop.value = true
  setTimeout(() => (countPop.value = false), 360)
}

// —— 手动添加 ——
const draft = ref('')
const draftDate = ref(false) // 简化：false=今天，true=明天（可选设日期占位）
const draftDateLabel = computed(() => (draftDate.value ? '明天' : ''))
function cycleDate() {
  draftDate.value = !draftDate.value
}
function addManual() {
  if (!draft.value.trim()) return
  store.addManual({ title: draft.value, bucket: draftDate.value ? 'tomorrow' : 'today' })
  draft.value = ''
  draftDate.value = false
}

// —— 行交互 ——
const drafts = reactive({}) // id → 输入内容（结论 / 文件说明）
const fileNames = reactive({}) // id → 选中的文件名

function onRowClick(item) {
  if (item.type === 'manual') return // 手动靠圆圈完成
  store.toggleExpand(item.id)
}

function canSend(item) {
  if (item.type === 'text') return !!(drafts[item.id] && drafts[item.id].trim())
  if (item.type === 'file') return !!fileNames[item.id]
  return true
}

function onFilePick(item, e) {
  const f = e.target.files && e.target.files[0]
  if (f) fileNames[item.id] = f.name
}

// —— 完成动效编排 ——
const celebrating = reactive(new Set())
const collapsing = reactive(new Set())

function runCompletion(item, result) {
  if (item.taskBridgeConversationId && item.taskBridgeTaskId) {
    taskBridgeStore.completePersonalTask(item.taskBridgeConversationId, item.taskBridgeTaskId)
    ElMessage.success('任务已完成，已生成项目回填草稿')
  }
  if (prefersReducedMotion) {
    store.completeNow(item.id, { result })
    pulseCount()
    return
  }
  store.complete(item.id, { result }) // → celebrate
  celebrating.add(item.id)
  pulseCount()
  // 勾圈弹入 + 删除线扫过
  setTimeout(() => {
    collapsing.add(item.id) // 行高塌陷淡出
  }, 520)
  setTimeout(() => {
    store.archive(item.id)
    celebrating.delete(item.id)
    collapsing.delete(item.id)
  }, 880)
}

function finishManual(item) {
  runCompletion(item, '')
}
function finishSubmit(item) {
  if (!canSend(item)) return
  const result =
    item.type === 'file'
      ? `📎 ${fileNames[item.id]}${drafts[item.id] ? ' · ' + drafts[item.id] : ''}`
      : drafts[item.id]
  runCompletion(item, result)
}
function finishVote(item, opt) {
  runCompletion(item, `我投「${opt}」`)
}

// —— 跳转（P3 接真实：切群 + 开任务面板 + 直达详情 + 步骤高亮）——
function jumpToGroup(item) {
  if (item.taskBridgeConversationId) {
    uiStore.setActiveNavigation?.('collaboration', item.taskBridgeConversationId)
    uiStore.activeToolTab = null
    return
  }
  // 跳到协作（demo linkGroup 为占位 id，跳到协作 nav；接真实群 id 后可直达该群）
  uiStore.setActiveNavigation?.('collaboration', null)
  uiStore.activeToolTab = null
}

// —— 已完成区 ——
const shownDone = computed(() =>
  store.showAllCompleted ? store.doneItems : store.doneItems.slice(0, 3),
)

function close() {
  uiStore.activeToolTab = null
}
</script>

<style scoped>
.todo-panel {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  /* 与文件面板一致：圆角悬浮卡，与会话区留出缝隙、不再粘连 */
  border-radius: 12px;
  overflow: hidden;
  color: var(--kk-ink-800);
  font-size: 13px;
}

/* 标题栏 */
.todo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.head-title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.head-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--kk-orange-400);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.head-close {
  border: none;
  background: transparent;
  color: var(--kk-ink-400, #9aa0aa);
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.head-close:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}

/* 今日进度 */
.today-bar {
  padding: 0 16px 12px;
  flex-shrink: 0;
}
.today-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.today-label {
  font-size: 12px;
  color: var(--kk-ink-500, #6b7280);
}
.today-count {
  font-size: 12px;
  color: var(--kk-ink-600, #4b5563);
}
.today-count.is-done {
  color: var(--kk-orange-400);
  font-weight: 600;
}
.cnt-num {
  font-weight: 700;
  color: var(--kk-orange-400);
  display: inline-block;
}
.cnt-num.pop {
  animation: cnt-pop 0.36s ease;
}
@keyframes cnt-pop {
  40% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1);
  }
}
.today-track {
  height: 6px;
  border-radius: 3px;
  background: var(--kk-fill-muted, #eef0f3);
  overflow: hidden;
}
.today-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--grad-warm, linear-gradient(90deg, #ff8a4c, #ff621f));
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 添加行 */
.add-row {
  display: flex;
  gap: 6px;
  padding: 0 16px 12px;
  flex-shrink: 0;
}
.add-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--kk-border-soft);
  border-radius: 8px;
  font-size: 13px;
  color: var(--kk-ink-800);
  background: var(--kk-bg-base, #fff);
}
.add-input:focus {
  outline: none;
  border-color: var(--kk-orange-400);
}
.add-date {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--kk-border-soft);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.add-date.set {
  border-color: var(--kk-orange-400);
}
.date-tag {
  font-size: 11px;
  color: var(--kk-orange-400);
}
.add-btn {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--kk-ink-800, #1f2329);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* 滚动区 */
.todo-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 16px;
}

/* 分组 */
.todo-group {
  margin-top: 8px;
}
.group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px 6px;
  font-size: 12px;
  color: var(--kk-ink-500, #6b7280);
}
.group-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}
.group-date {
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
}
.group-head.danger .group-name,
.group-head.danger .group-date {
  color: var(--kk-danger-500, #f5222d);
}
.danger-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--kk-danger-500, #f5222d);
}

/* 单条待办 */
.todo-item {
  border-radius: 10px;
  overflow: hidden;
  transition: background 0.15s;
}
.todo-item.collapsing {
  animation: row-collapse 0.36s ease forwards;
}
@keyframes row-collapse {
  to {
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
    margin: 0;
  }
}
.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  cursor: pointer;
  position: relative;
}
.item-row:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.03));
}
/* 展开态：整条待办（行+提交区）成一张卡，和相邻待办清晰分开 */
.todo-item.expanded {
  background: var(--kk-orange-50, rgba(255, 98, 31, 0.06));
  border: 1px solid rgba(255, 98, 31, 0.18);
  border-radius: 12px;
  margin: 2px 0 10px;
}
.todo-item.expanded .item-row {
  background: transparent;
}
.todo-item.celebrating .item-row {
  background: rgba(7, 193, 96, 0.1);
}

/* 左标记 */
.item-mark {
  width: 24px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}
.mark-check {
  width: 18px;
  height: 18px;
  border: 1.6px solid var(--kk-border-strong, #c4c8ce);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mark-check:hover {
  border-color: #07c160;
}
.mark-check.checked {
  border-color: #07c160;
  background: #07c160;
  animation: check-pop 0.3s ease;
}
@keyframes check-pop {
  40% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}
.check-svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
}
.mark-check.checked .check-svg {
  animation: draw-check 0.3s 0.05s ease forwards;
}
@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}
.mark-puck {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.mark-puck.t-text {
  background: rgba(51, 112, 255, 0.12);
}
.mark-puck.t-file {
  background: rgba(132, 120, 250, 0.14);
}
.mark-puck.t-vote {
  background: var(--accent-soft, rgba(255, 98, 31, 0.12));
}

/* 行主体：名称 + 来源群（两行） */
.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item-title {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-from {
  align-self: flex-start;
  max-width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-from:hover {
  color: var(--kk-orange-400, #ff621f);
}
.from-arrow {
  color: var(--kk-orange-400, #ff621f);
}

/* 转发入口 + 菜单 */
.item-forward {
  position: relative;
  flex-shrink: 0;
}
.fwd-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--kk-ink-400, #9aa0aa);
  padding: 3px 7px;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.15s;
}
.item-row:hover .fwd-btn {
  opacity: 1;
}
.fwd-btn:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.06));
  color: var(--kk-orange-400, #ff621f);
}
.fwd-menu {
  min-width: 176px;
  max-height: 60vh;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(31, 35, 41, 0.16);
  padding: 4px;
  z-index: 3000;
}
.fm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  padding: 8px 10px;
  border-radius: 7px;
  white-space: nowrap;
}
.fm-item:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.05));
}
.fm-ic {
  flex-shrink: 0;
}
.fm-team {
  padding-left: 22px;
  color: var(--kk-ink-700, #4b5563);
}
.fm-sep {
  height: 1px;
  background: var(--kk-border-soft, #e5e6eb);
  margin: 4px 6px;
}
.fm-label {
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
  padding: 4px 10px 2px;
}
.fm-empty {
  font-size: 12px;
  color: var(--kk-ink-400, #9aa0aa);
  padding: 6px 10px;
}
.todo-item.celebrating .item-title {
  position: relative;
}
.todo-item.celebrating .item-title::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  height: 1px;
  width: 100%;
  background: var(--kk-ink-500, #6b7280);
  transform: scaleX(0);
  transform-origin: left;
  animation: strike 0.32s 0.1s ease forwards;
}
@keyframes strike {
  to {
    transform: scaleX(1);
  }
}

/* 来源 + 跳转 */
.item-source {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  justify-content: flex-end;
  position: relative;
}
.src-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--kk-fill-muted, #eef0f3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.src-pill {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  background: #fff;
  border: 1px solid var(--kk-border-soft);
  box-shadow: var(--shadow-xs, 0 2px 8px rgba(0, 0, 0, 0.08));
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  cursor: pointer;
}
.item-row:hover .src-pill {
  opacity: 1;
  pointer-events: auto;
}
.src-pill:hover {
  border-color: var(--kk-orange-400);
}
.pill-arrow {
  color: var(--kk-orange-400);
}

/* 展开区（在展开卡内，缩进收窄不留白左槽）*/
.item-expand {
  padding: 2px 12px 12px;
  animation: expand-in 0.18s ease;
}
@keyframes expand-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.at-tag {
  font-size: 12px;
  color: #3370ff;
  font-weight: 600;
}
/* 文本提交：@团队助理 固定在对话框内 */
.submit-box {
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 10px;
  background: #fff;
  padding: 8px 10px;
}
.submit-box .at-tag {
  display: block;
  margin-bottom: 4px;
}
.sb-textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  font-family: inherit;
  line-height: 1.5;
}
/* file / vote 的 @团队助理 一行（紧凑）*/
.submit-tagline {
  margin-bottom: 6px;
}
.expand-textarea,
.expand-note {
  width: 100%;
  border: 1px solid var(--kk-border-soft);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--kk-ink-800);
  resize: none;
  font-family: inherit;
}
.expand-note {
  margin-top: 8px;
}
.expand-textarea:focus,
.expand-note:focus {
  outline: none;
  border-color: var(--kk-orange-400);
}
.file-drop {
  display: block;
  border: 1px dashed var(--kk-border-strong, #c4c8ce);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  color: var(--kk-ink-500, #6b7280);
}
.file-drop.has {
  border-style: solid;
  padding: 10px;
}
.file-input {
  display: none;
}
.file-chip {
  color: #8478fa;
  font-weight: 500;
}
.vote-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--kk-border-soft);
  border-radius: 8px;
  padding: 9px 12px;
  margin-bottom: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: var(--kk-ink-800);
}
.vote-opt:hover {
  border-color: var(--accent-strong, #ff621f);
}
.vote-radio {
  width: 14px;
  height: 14px;
  border: 1.6px solid var(--kk-border-strong, #c4c8ce);
  border-radius: 50%;
  flex-shrink: 0;
}
.vote-opt:hover .vote-radio {
  border-color: var(--accent-strong, #ff621f);
}
.expand-acts {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.act-cancel {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--kk-border-soft);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--kk-ink-600, #4b5563);
}
.act-send {
  height: 30px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--kk-ink-800, #1f2329);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.act-send:disabled {
  opacity: 0.4;
  cursor: default;
}
.expand-foot {
  margin-top: 8px;
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
}

/* 已完成 */
.done-section {
  margin-top: 16px;
  padding: 12px 4px 0;
  border-top: 1px solid var(--kk-border-soft);
}
.done-head {
  font-size: 12px;
  color: var(--kk-ink-500, #6b7280);
  margin-bottom: 8px;
}
.done-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 4px;
  font-size: 12px;
  color: var(--kk-ink-400, #9aa0aa);
}
.done-check {
  color: #07c160;
}
.done-title {
  text-decoration: line-through;
}
.done-result {
  color: var(--kk-ink-400, #9aa0aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.done-toggle {
  border: none;
  background: transparent;
  color: var(--kk-orange-400);
  cursor: pointer;
  font-size: 12px;
  padding: 6px 4px;
}
</style>
