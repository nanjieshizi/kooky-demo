<template>
  <div
    ref="panelRef"
    class="cgt-panel"
    :class="{
      'is-accordion-mode': isAccordion,
      'is-split-mode': isSplit,
    }"
  >
    <template v-if="isSplit">
      <div class="split-layout" :class="{ 'is-master-collapsed': isSplitListCollapsed }">
        <aside class="split-master" aria-label="协作任务列表">
          <header class="split-master__head">
            <button
              type="button"
              class="split-master__toggle"
              :aria-label="isSplitListCollapsed ? '展开任务列表' : '收起任务列表'"
              :title="isSplitListCollapsed ? '展开任务列表' : '收起任务列表'"
              @click="toggleSplitList"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </button>
            <template v-if="!isSplitListCollapsed">
              <strong>任务列表</strong>
              <span>{{ tasks.length }}</span>
            </template>
          </header>

          <div v-if="isSplitListCollapsed" class="split-rail">
            <div class="split-rail__metric is-active" title="进行中任务">
              <span>{{ activeTasks.length }}</span><small>进行中</small>
            </div>
            <div class="split-rail__metric" title="已归档任务">
              <span>{{ archivedTasks.length }}</span><small>归档</small>
            </div>
          </div>

          <div v-else ref="splitListRef" class="split-master__scroll">
            <template v-if="tasks.length">
              <section v-if="activeTasks.length" class="split-task-section">
                <div class="split-task-section__head">
                  <span>进行中</span><b>{{ activeTasks.length }}</b>
                </div>
                <button
                  v-for="task in activeTasks"
                  :key="task.id"
                  type="button"
                  class="split-task-row"
                  :class="{ 'is-selected': isTaskExpanded(task), 'is-overdue': isTaskOverdue(task) }"
                  :data-task-id="task.id"
                  @click="selectSplitTask(task)"
                >
                  <span class="split-task-row__emoji">{{ task.emoji || '📋' }}</span>
                  <span class="split-task-row__copy">
                    <strong>{{ displayTaskTitle(task) }}</strong>
                    <small>
                      <span :class="{ 'is-danger': isTaskOverdue(task) }">{{ isTaskOverdue(task) ? '已逾期' : '进行中' }}</span>
                      <i></i>{{ taskProgress(task) }}
                    </small>
                  </span>
                  <FlowStatusIcon
                    status="in_progress"
                    :deadline-status="isTaskOverdue(task) ? 'overdue' : ''"
                  />
                </button>
              </section>

              <section v-if="archivedTasks.length" class="split-task-section is-archived">
                <div class="split-task-section__head">
                  <span>已归档</span><b>{{ archivedTasks.length }}</b>
                </div>
                <div
                  v-for="task in archivedTasks"
                  :key="task.id"
                  class="split-task-row-shell"
                  :class="{ 'is-selected': isTaskExpanded(task) }"
                  :data-task-id="task.id"
                >
                  <button type="button" class="split-task-row" @click="selectSplitTask(task)">
                    <span class="split-task-row__emoji">{{ task.emoji || '📋' }}</span>
                    <span class="split-task-row__copy">
                      <strong>{{ displayTaskTitle(task) }}</strong>
                      <small><span>{{ archivedStatusLabel(task) }}</span><i></i>{{ taskProgress(task) }}</small>
                    </span>
                    <FlowStatusIcon :status="taskFlowStatus(task)" />
                  </button>
                  <button
                    type="button"
                    class="split-task-row__restart"
                    :aria-label="`再次开启：${displayTaskTitle(task)}`"
                    title="引用该工作流再次开启"
                    @click.stop="referenceWorkflow(task)"
                  >
                    <SvgIcon name="icon-shuaxin" :size="13" />
                  </button>
                </div>
              </section>
            </template>
            <div v-else class="cgt-empty is-compact">
              <span>暂无流程任务</span>
            </div>
          </div>
        </aside>

        <section class="split-detail" aria-label="协作任务详情">
          <CollabTaskDetailPanel
            v-if="showDetail"
            :key="expandedTaskId"
            :conversation-id="cid"
            embedded
            split
            class="split-detail__panel"
          />
          <div v-else class="split-detail__empty">
            <span class="split-detail__empty-icon">↗</span>
            <strong>选择一个协作任务</strong>
            <small>在左侧查看流程详情和当前执行节点</small>
          </div>
        </section>
      </div>
    </template>

    <!-- 详情态：复用生产详情面板（自带头部，其 ✕ = 返回列表）-->
    <CollabTaskDetailPanel
      v-else-if="showDetail && !isAccordion"
      :conversation-id="cid"
      :embedded="props.embedded"
      class="cgt-detail"
    />

    <!-- 列表态：保留 taskStore 数据链，使用 0805 生产任务列表视觉 -->
    <template v-else>
      <header v-if="!props.embedded" class="cgt-head">
        <span class="cgt-title">任务</span>
        <button type="button" class="cgt-close" aria-label="关闭" @click="closePanel">
          <SvgIcon name="icon-kuangjia-guanbi" :size="18" />
        </button>
      </header>

      <div ref="scrollRef" class="cgt-scroll">
        <template v-if="tasks.length">
          <section v-if="activeTasks.length" class="task-section">
            <div class="task-section__head">
              <span>进行中</span>
              <span class="task-section__count">{{ activeTasks.length }}</span>
            </div>
            <article
              v-for="t in activeTasks"
              :key="t.id"
              :data-task-id="t.id"
              class="task-accordion"
              :class="{ 'is-expanded': isTaskExpanded(t) }"
            >
              <button
                type="button"
                class="task-row"
                :class="{ 'is-overdue': isTaskOverdue(t) }"
                :aria-expanded="isAccordion ? isTaskExpanded(t) : undefined"
                :aria-label="`${isTaskExpanded(t) ? '收起' : '查看'}任务：${displayTaskTitle(t)}`"
                @click="toggleTask(t)"
              >
                <span class="task-row__emoji">{{ t.emoji || '📋' }}</span>
                <OverflowTooltipText
                  :text="displayTaskTitle(t)"
                  custom-class="task-row__name"
                  flex
                />
                <span v-if="isAccordion" class="task-row__progress">{{ taskProgress(t) }}</span>
                <span
                  class="task-row__status"
                  :class="{ 'is-spinning': !isTaskOverdue(t) }"
                  :title="isTaskOverdue(t) ? '已逾期' : '进行中'"
                >
                  <FlowStatusIcon
                    status="in_progress"
                    :deadline-status="isTaskOverdue(t) ? 'overdue' : ''"
                  />
                </span>
                <span v-if="isTaskOverdue(t)" class="task-row__overdue-label">逾期</span>
                <svg v-if="isAccordion" class="task-row__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <CollabTaskDetailPanel
                v-if="isAccordion && isTaskExpanded(t)"
                :conversation-id="cid"
                embedded
                inline
                class="task-inline-detail"
              />
            </article>
          </section>

          <section v-if="archivedTasks.length" class="task-section task-section--archived">
            <div class="task-section__head">
              <span>已归档</span>
              <span class="task-section__count">{{ archivedTasks.length }}</span>
            </div>
            <article
              v-for="t in archivedTasks"
              :key="t.id"
              :data-task-id="t.id"
              class="task-accordion"
              :class="{ 'is-expanded': isTaskExpanded(t) }"
            >
              <div class="task-row-shell">
                <button
                  type="button"
                  class="task-row task-row--archived"
                  :aria-expanded="isAccordion ? isTaskExpanded(t) : undefined"
                  :aria-label="`${isTaskExpanded(t) ? '收起' : '查看'}任务：${displayTaskTitle(t)}`"
                  @click="toggleTask(t)"
                >
                  <span class="task-row__emoji">{{ t.emoji || '📋' }}</span>
                  <OverflowTooltipText
                    :text="displayTaskTitle(t)"
                    custom-class="task-row__name"
                    flex
                  />
                  <span class="task-row__archive-status" :class="`is-${t.status}`">
                    <FlowStatusIcon :status="taskFlowStatus(t)" />
                    <span>{{ archivedStatusLabel(t) }}</span>
                  </span>
                  <svg v-if="isAccordion" class="task-row__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="task-row__restart"
                  :aria-label="`再次开启：${displayTaskTitle(t)}`"
                  title="引用该工作流再次开启"
                  @click.stop="referenceWorkflow(t)"
                >
                  <SvgIcon name="icon-shuaxin" :size="14" />
                </button>
              </div>
              <CollabTaskDetailPanel
                v-if="isAccordion && isTaskExpanded(t)"
                :conversation-id="cid"
                embedded
                inline
                class="task-inline-detail"
              />
            </article>
          </section>
        </template>
        <div v-else class="cgt-empty">
          <svg
            class="cgt-empty__image"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <rect x="23" y="18" width="54" height="67" rx="10" fill="#f5f6f8" />
            <rect x="30.5" y="25.5" width="39" height="52" rx="7.5" fill="#fff" stroke="#e1e5ee" />
            <rect x="39" y="18" width="22" height="12" rx="5" fill="#eceef3" />
            <path d="M40 45h20M40 54h20M40 63h13" stroke="#c8cbd3" stroke-width="3" stroke-linecap="round" />
            <circle cx="68" cy="72" r="13" fill="#fff" stroke="#e1e5ee" />
            <path d="M63 72h10M68 67v10" stroke="#91949e" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <span>暂无流程任务</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useGroupStore } from '@/modules/group/store'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { ensureDemoTasksForGroup } from '@/modules/collaboration/demo/collabTasksDemo'
import CollabTaskDetailPanel from './CollabTaskDetailPanel.vue'
import FlowStatusIcon from '@/modules/collaboration-flow/components/FlowStatusIcon.vue'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'

const props = defineProps({
  conversationId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  displayMode: { type: String, default: 'drilldown' },
  revealRequest: { type: Object, default: null },
})
const emit = defineEmits(['close', 'request-collapse'])

const taskStore = useCollabTaskStore()
const groupStore = useGroupStore()
const sidePanel = useSidePanelStore()
const panelRef = ref(null)
const scrollRef = ref(null)
const splitListRef = ref(null)
const splitCollapsedByGroup = ref({})

const cid = computed(() => (
  props.conversationId
  || groupStore.currentSpaceId
  || groupStore.currentConversationId
  || ''
))
const tasks = computed(() => (cid.value ? taskStore.tasksByGroup(cid.value) : []))
const activeTasks = computed(() => tasks.value.filter((task) => task.status === 'in_progress'))
const archivedTasks = computed(() => tasks.value.filter((task) => ['completed', 'aborted'].includes(task.status)))
const isAccordion = computed(() => props.displayMode === 'accordion')
const isSplit = computed(() => props.displayMode === 'split')
const isSplitListCollapsed = computed(() => !!splitCollapsedByGroup.value[String(cid.value || '')])

// 仅 mock/demo 群补视觉数据；与项目看板复用同一入口，真实群不会被视图写入假任务。
watch(cid, (id) => ensureDemoTasksForGroup(taskStore, id), { immediate: true })

const showDetail = computed(
  () =>
    !!cid.value &&
    taskStore.detailPanelOpenByGroup[cid.value] &&
    !!taskStore.currentTaskByGroup(cid.value),
)
const expandedTaskId = computed(() => (
  showDetail.value ? String(taskStore.currentTaskByGroup(cid.value)?.id || '') : ''
))

watch([expandedTaskId, () => props.revealRequest?.serial], async ([taskId]) => {
  if (!isAccordion.value || !taskId) return
  await nextTick()
  const target = Array.from(scrollRef.value?.querySelectorAll('[data-task-id]') || [])
    .find((node) => node.dataset.taskId === taskId)
  target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}, { immediate: true, flush: 'post' })

watch(
  [cid, isSplit, () => tasks.value.map((task) => `${task.id}:${task.status}`).join('|')],
  ([conversationId, split]) => {
    if (!split || !conversationId || !tasks.value.length) return
    const current = taskStore.currentTaskByGroup(conversationId)
    const valid = current && tasks.value.some((task) => String(task.id) === String(current.id))
    if (valid && taskStore.detailPanelOpenByGroup[conversationId]) return
    const firstTask = activeTasks.value[0] || tasks.value[0]
    if (!firstTask || String(firstTask.conversationId) !== String(conversationId)) return
    taskStore.setActiveTask(conversationId, firstTask.id)
    taskStore.toggleDetailPanel(conversationId, true)
  },
  { immediate: true, flush: 'post' },
)

watch(
  [() => props.revealRequest?.serial, cid],
  async () => {
    if (!isSplit.value) return
    const request = props.revealRequest
    const conversationId = String(cid.value || '')
    const requestedTask = tasks.value.find((task) => (
      String(task.id) === String(request?.taskId || '')
      && String(task.conversationId) === conversationId
    ))
    if (!requestedTask) return
    taskStore.setActiveTask(conversationId, requestedTask.id)
    taskStore.toggleDetailPanel(conversationId, true)
    if (request?.directDetail) setSplitListCollapsed(conversationId, true)
    await nextTick()
    revealSplitTask(requestedTask.id)
  },
  { immediate: true, flush: 'post' },
)
// 列表=窄、下钻 flow 详情=宽
watch(showDetail, (v) => {
  if (!props.embedded) sidePanel.setWide(v)
}, { immediate: true })

const TASK_TO_FLOW_STATUS = Object.freeze({
  in_progress: 'in_progress',
  completed: 'completed',
  aborted: 'cancelled',
})

function taskFlowStatus(task) {
  return TASK_TO_FLOW_STATUS[task?.status] || task?.status || 'pending'
}

function isTaskOverdue(task) {
  if (task?.status !== 'in_progress') return false
  if (task?.deadlineStatus === 'overdue') return true
  const activeSteps = Array.isArray(task?.steps)
    ? task.steps.filter((taskStep) => taskStep.status === 'active')
    : []
  return activeSteps.some((taskStep) => {
    if (taskStep.deadlineStatus === 'overdue') return true
    const deadlineAt = Date.parse(String(taskStep.deadline || ''))
    return Number.isFinite(deadlineAt) && deadlineAt < Date.now()
  })
}

function archivedStatusLabel(task) {
  return task?.status === 'aborted' ? '已取消' : '已完成'
}

function displayTaskTitle(task) {
  const title = String(task?.title || '未命名任务').trim()
  const emoji = String(task?.emoji || '').trim()
  return emoji && title.startsWith(emoji)
    ? title.slice(emoji.length).trimStart()
    : title
}

function isTaskExpanded(task) {
  return !!showDetail.value && taskStore.currentTaskByGroup(cid.value)?.id === task?.id
}

function toggleTask(t) {
  if (!cid.value) return
  if (isAccordion.value && isTaskExpanded(t)) {
    taskStore.toggleDetailPanel(cid.value, false)
    return
  }
  taskStore.setActiveTask(cid.value, t.id)
  taskStore.toggleDetailPanel(cid.value, true)
}

function setSplitListCollapsed(conversationId, collapsed) {
  const key = String(conversationId || '')
  if (!key) return
  splitCollapsedByGroup.value = {
    ...splitCollapsedByGroup.value,
    [key]: !!collapsed,
  }
}

function toggleSplitList() {
  setSplitListCollapsed(cid.value, !isSplitListCollapsed.value)
  if (!isSplitListCollapsed.value) nextTick(() => revealSplitTask(expandedTaskId.value))
}

function selectSplitTask(task) {
  const conversationId = String(cid.value || '')
  if (!conversationId || !task || String(task.conversationId) !== conversationId) return
  taskStore.setActiveTask(conversationId, task.id)
  taskStore.toggleDetailPanel(conversationId, true)
  if ((panelRef.value?.getBoundingClientRect().width || 0) < 620) {
    setSplitListCollapsed(conversationId, true)
  }
}

function revealSplitTask(taskId) {
  if (!taskId || isSplitListCollapsed.value) return
  const target = Array.from(splitListRef.value?.querySelectorAll('[data-task-id]') || [])
    .find((node) => node.dataset.taskId === String(taskId))
  target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function taskProgress(task) {
  const steps = Array.isArray(task?.steps) ? task.steps : []
  if (!steps.length) return '0/0'
  const done = steps.filter((taskStep) => ['done', 'skipped'].includes(taskStep.status)).length
  return `${done}/${steps.length}`
}

function referenceWorkflow(task) {
  if (!cid.value) return
  if (!taskStore.canCreateMoreTask(cid.value)) {
    ElMessage.warning('同时进行中任务已达上限（3 个），请先完成或取消一个任务')
    return
  }
  if (!taskStore.setWorkflowReference(cid.value, task.id)) return
  taskStore.toggleDetailPanel(cid.value, false)
  if (props.embedded) {
    emit('request-collapse')
    return
  }
  sidePanel.close()
}

function closePanel() {
  if (props.embedded) {
    emit('close')
    return
  }
  sidePanel.close()
}
</script>

<style scoped>
.cgt-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: #fff;
}
.cgt-detail {
  height: 100%;
}

.cgt-panel.is-split-mode { container-type: inline-size; }
.split-layout { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; overflow: hidden; background: #fff; }
.split-master { width: 232px; min-width: 232px; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid #eceef2; background: #fafbfc; transition: width .2s ease, min-width .2s ease; }
.split-layout.is-master-collapsed .split-master { width: 44px; min-width: 44px; }
.split-master__head { height: 46px; min-height: 46px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border-bottom: 1px solid #eef0f3; box-sizing: border-box; }
.split-master__head strong { min-width: 0; flex: 1; color: #303746; font-size: 13px; font-weight: 650; }
.split-master__head > span { min-width: 19px; height: 19px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; border-radius: 10px; background: #eef0f4; color: #858b97; font-size: 10px; box-sizing: border-box; }
.split-master__toggle { width: 26px; height: 26px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #737a89; cursor: pointer; }
.split-master__toggle:hover { background: #eef0f4; color: #ff5a1f; }
.split-master__toggle svg { width: 17px; height: 17px; }
.split-layout.is-master-collapsed .split-master__head { justify-content: center; padding: 0; }
.split-rail { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 12px; }
.split-rail__metric { width: 30px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 0; border-radius: 8px; background: #f0f1f4; color: #8d93a0; }
.split-rail__metric.is-active { background: #edf5ff; color: #3b83da; }
.split-rail__metric span { font-size: 12px; font-weight: 700; line-height: 16px; }
.split-rail__metric small { font-size: 8px; line-height: 11px; writing-mode: vertical-rl; letter-spacing: 1px; }
.split-master__scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6px 7px 14px; box-sizing: border-box; }
.split-task-section + .split-task-section { margin-top: 12px; }
.split-task-section__head { height: 27px; display: flex; align-items: center; gap: 5px; padding: 0 7px; color: #9096a2; font-size: 11px; font-weight: 600; }
.split-task-section__head b { min-width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; border-radius: 9px; background: #eff1f4; font-size: 9px; font-weight: 600; box-sizing: border-box; }
.split-task-row-shell { position: relative; border-radius: 8px; }
.split-task-row-shell.is-selected { background: #fff3ed; }
.split-task-row { width: 100%; min-width: 0; min-height: 52px; display: flex; align-items: center; gap: 7px; padding: 7px 8px; border: 0; border-left: 2px solid transparent; border-radius: 8px; background: transparent; color: #333a49; text-align: left; cursor: pointer; box-sizing: border-box; }
.split-task-row:hover { background: #f1f2f5; }
.split-task-row.is-selected,
.split-task-row-shell.is-selected .split-task-row { border-left-color: #ff6a32; background: #fff3ed; }
.split-task-row.is-overdue:not(.is-selected) { border-left-color: #ed5a57; }
.split-task-row__emoji { flex: 0 0 auto; font-size: 15px; }
.split-task-row__copy { min-width: 0; flex: 1; }
.split-task-row__copy strong,
.split-task-row__copy small { display: block; }
.split-task-row__copy strong { overflow: hidden; color: #343a49; font-size: 11px; font-weight: 600; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }
.split-task-row__copy small { display: flex; align-items: center; gap: 5px; margin-top: 2px; color: #979da8; font-size: 9px; line-height: 14px; }
.split-task-row__copy small .is-danger { color: #e34f4c; }
.split-task-row__copy small i { width: 2px; height: 2px; border-radius: 50%; background: #c2c6ce; }
.split-task-row > :deep(.flow-status-icon) { flex: 0 0 auto; }
.split-task-row-shell .split-task-row { padding-right: 30px; }
.split-task-row__restart { position: absolute; top: 50%; right: 5px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #9298a5; cursor: pointer; transform: translateY(-50%); }
.split-task-row__restart:hover { background: #fff; color: #ff5a1f; }
.split-detail { min-width: 0; flex: 1; height: 100%; min-height: 0; overflow: hidden; background: #fff; }
.split-detail__panel { width: 100%; height: 100%; }
.split-detail__empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: #959ba7; text-align: center; }
.split-detail__empty-icon { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: #f1f2f5; color: #8d94a0; font-size: 17px; }
.split-detail__empty strong { color: #6e7583; font-size: 13px; }
.split-detail__empty small { font-size: 10px; }
.cgt-empty.is-compact { min-height: 180px; }

@container (max-width: 620px) {
  .split-layout { position: relative; }
  .split-layout:not(.is-master-collapsed) .split-master { position: absolute; inset: 0 auto 0 0; z-index: 4; width: min(280px, 82%); min-width: min(280px, 82%); box-shadow: 12px 0 28px rgba(35, 40, 54, .13); }
  .split-layout.is-master-collapsed .split-master { position: relative; z-index: 2; }
}

.cgt-head {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  flex-shrink: 0;
  box-sizing: border-box;
}
.cgt-title {
  min-width: 0;
  font-family: 'PingFang SC', sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #2f3547;
}
.cgt-close {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  padding: 0;
  background: transparent;
  color: #606572;
  cursor: pointer;
  line-height: 0;
}
.cgt-close:hover {
  background: rgba(47, 53, 71, 0.06);
}

.cgt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 8px 16px;
  box-sizing: border-box;
}

.task-section + .task-section {
  margin-top: 14px;
}
.task-accordion {
  display: block;
}
.is-accordion-mode .task-accordion {
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 9px;
  overflow: hidden;
  transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.is-accordion-mode .task-accordion.is-expanded {
  border-color: #ffd0be;
  background: #fffdfc;
  box-shadow: 0 4px 14px rgba(255, 90, 31, .07);
}
.task-section__head {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  color: #91949e;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.task-section__count {
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 9px;
  background: #f2f3f6;
  color: #91949e;
  font-size: 10px;
  box-sizing: border-box;
}

.task-row {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
}
.is-accordion-mode .task-row { min-height: 44px; }
.is-accordion-mode .task-accordion.is-expanded .task-row { background: #fff7f3; }
.task-row:hover {
  background: rgba(47, 53, 71, 0.06);
}
.task-row.is-overdue:hover {
  background: #fff5f4;
}
.task-row__emoji {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 20px;
}
.cgt-scroll :deep(.task-row__name) {
  font-size: 13px;
  line-height: 20px;
  color: #2f3547;
}

.task-row__status {
  width: 16px;
  height: 16px;
  display: inline-flex;
  flex-shrink: 0;
}
.task-row__status.is-spinning :deep(svg) {
  animation: cgt-status-spin 1s linear infinite;
  transform-origin: center;
}
@keyframes cgt-status-spin {
  to { transform: rotate(360deg); }
}
.task-row__overdue-label {
  flex-shrink: 0;
  color: #ed4543;
  font-size: 11px;
  line-height: 18px;
}
.task-row__progress {
  flex-shrink: 0;
  color: #9a9fac;
  font-size: 10px;
  line-height: 18px;
}
.task-row__chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #9ba0aa;
  transition: transform .18s ease;
}
.is-accordion-mode .task-accordion.is-expanded .task-row__chevron { transform: rotate(180deg); }
.task-inline-detail {
  height: auto;
  border-top: 1px solid #f1f2f4;
}

.task-row-shell {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  display: flex;
  align-items: center;
  border-radius: 6px;
}
.is-accordion-mode .task-row-shell { min-height: 44px; }
.task-row-shell:hover {
  background: rgba(47, 53, 71, 0.06);
}
.task-row-shell .task-row:hover {
  background: transparent;
}
.task-row--archived {
  flex: 1;
  width: auto;
}
.task-row__archive-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  font-size: 11px;
  line-height: 18px;
  color: #07c160;
}
.task-row__archive-status.is-aborted {
  color: #91949e;
}
.task-row__restart {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 4px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #6072aa;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
  opacity: 0.72;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.task-row__restart:hover {
  background: #eef0f8;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .task-row__status.is-spinning :deep(svg) { animation: none; }
}

.cgt-empty {
  height: 100%;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 8px;
  box-sizing: border-box;
  font-size: 12px;
  color: #91949e;
}
.cgt-empty__image {
  display: block;
  width: 100px;
  height: 100px;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
</style>
