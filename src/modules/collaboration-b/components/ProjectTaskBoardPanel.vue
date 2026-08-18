<template>
  <section class="task-board-panel">
    <header class="board-head">
      <div>
        <h3>事项</h3>
        <span>{{ allItems.length }} 项 · 复杂事项可发起协作任务</span>
      </div>
      <button type="button" class="board-create" @click="toggleCreate">+ 新建事项</button>
    </header>

    <div class="board-scroll">
      <div v-if="creating" class="quick-create">
        <div class="quick-create__grid">
          <label class="is-full">
            <span>事项标题 <b>*</b></span>
            <input
              v-model="newTitle"
              maxlength="80"
              placeholder="写下需要推进的事情"
              @keyup.enter="createMatter"
            />
          </label>
          <label>
            <span>责任人 <b>*</b></span>
            <select v-model="newOwner">
              <option v-for="person in formPeople" :key="person.name" :value="person.name">{{ person.name }}</option>
            </select>
          </label>
          <label>
            <span>截止时间</span>
            <input v-model="newDeadline" type="date" />
          </label>
          <label>
            <span>优先级</span>
            <select v-model="newPriority">
              <option value="">不设置</option>
              <option value="P0">P0 · 紧急</option>
              <option value="P1">P1 · 重要</option>
              <option value="P2">P2 · 普通</option>
            </select>
          </label>
          <label class="is-full">
            <span>事项说明</span>
            <textarea v-model="newDescription" maxlength="300" rows="3" placeholder="补充背景、目标或需要关注的信息"></textarea>
          </label>
        </div>
        <div class="quick-create__actions">
          <button type="button" @click="cancelCreate">取消</button>
          <button type="button" class="is-primary" :disabled="!canCreateMatter" @click="createMatter">创建事项</button>
        </div>
      </div>

      <section v-for="section in visibleSections" :key="section.key" class="matter-section">
        <div class="matter-section__head">
          <span>{{ section.label }}</span>
          <span class="matter-section__count">{{ section.items.length }}</span>
          <button
            v-if="section.defaultLimit && section.items.length > section.defaultLimit"
            type="button"
            class="matter-section__toggle"
            @click="toggleSection(section.key)"
          >
            {{ section.expanded ? '收起' : `展开更多 ${section.items.length - section.defaultLimit}` }}
          </button>
        </div>

        <div class="matter-grid">
          <template v-for="item in section.visibleItems" :key="item.id">
            <article
              class="matter-card"
              :class="{
                'is-expanded': expandedId === item.id,
                'is-overdue': item.overdue,
              }"
            >
            <button
              type="button"
              class="matter-card__summary"
              :aria-expanded="expandedId === item.id"
              @click="toggleMatter(item.id)"
            >
              <span class="matter-card__main">
                <span class="matter-card__title-row">
                  <strong>{{ item.title }}</strong>
                </span>
                <span class="matter-card__meta">
                  <span class="owner-avatar">
                    <img v-if="avatarFor(item.owner)" :src="avatarFor(item.owner)" alt="" />
                    <span v-else>{{ item.owner.slice(0, 1) }}</span>
                  </span>
                  {{ item.owner }}
                  <template v-if="item.deadline">
                    <i></i>
                    <span :class="{ 'is-danger': item.overdue }">{{ item.deadline }}</span>
                  </template>
                  <template v-else>
                    <i></i>
                    <span>未设置截止时间</span>
                  </template>
                </span>
                <span class="matter-card__linkline">
                  <template v-if="item.workflowTaskId">
                    <span class="workflow-mark">协作任务 {{ item.workflowProgress }}</span>
                    <span>{{ item.currentStep || item.workflowHint }}</span>
                  </template>
                  <template v-else>
                    <span>未发起协作任务</span>
                  </template>
                </span>
              </span>
            </button>
            </article>

            <div v-if="expandedId === item.id" class="matter-card__detail matter-grid__inspector">
              <dl class="matter-detail-grid">
                <div><dt>事项说明</dt><dd>{{ item.description || '暂无说明' }}</dd></div>
                <div>
                  <dt>责任人</dt>
                  <dd class="creator-info">
                    <span class="owner-avatar">
                      <img v-if="avatarFor(item.owner)" :src="avatarFor(item.owner)" alt="" />
                      <span v-else>{{ item.owner.slice(0, 1) }}</span>
                    </span>
                    {{ item.owner }}
                  </dd>
                </div>
                <div><dt>截止时间</dt><dd>{{ item.deadline || '未设置' }}</dd></div>
                <div>
                  <dt>创建者</dt>
                  <dd class="creator-info">
                    <span class="owner-avatar">
                      <img v-if="avatarFor(item.creator)" :src="avatarFor(item.creator)" alt="" />
                      <span v-else>{{ item.creator.slice(0, 1) }}</span>
                    </span>
                    {{ item.creator }} · {{ formatCreatedAt(item.createdAt) }}
                  </dd>
                </div>
              </dl>

              <button
                v-if="item.workflowTaskId"
                type="button"
                class="workflow-entry"
                @click="emit('open-workflow', item.workflowTaskId)"
              >
                <span class="workflow-entry__icon">↻</span>
                <span>
                  <strong>协作任务 · {{ item.workflowProgress }}</strong>
                  <small>{{ item.currentStep || item.workflowHint }}</small>
                </span>
                <b>{{ item.workflowActionLabel }}</b>
              </button>
              <div v-else class="workflow-empty">
                <span>{{ item.status === 'archived' ? '事项已归档，恢复后可继续推进' : (item.status === 'done' ? '普通事项已完成' : '这件事暂时不需要复杂协作流程') }}</span>
                <button v-if="item.status === 'in_progress'" type="button" @click="startWorkflow(item)">发起协作任务</button>
              </div>

              <p
                v-if="item.workflowTaskId"
                class="workflow-sync-hint"
                :class="{ 'is-cancelled': item.workflowCancelled, 'is-completed': item.status === 'done' }"
              >
                {{ item.workflowSyncMessage }}
              </p>

              <div v-if="!item.workflowTaskId" class="matter-status-actions">
                <template v-if="item.status === 'in_progress'">
                  <button type="button" class="is-primary" @click="completeMatter(item)">标记完成</button>
                  <button type="button" @click="archiveMatter(item)">归档</button>
                </template>
                <template v-else-if="item.status === 'done'">
                  <button type="button" class="is-primary" @click="reopenMatter(item)">重新打开</button>
                  <button type="button" @click="archiveMatter(item)">归档</button>
                </template>
                <button v-else type="button" class="is-primary" @click="restoreMatter(item)">恢复事项</button>
              </div>

              <div class="matter-card__actions">
                <button type="button" @click="discussMatter(item)">在群里讨论</button>
                <button type="button">关联消息</button>
                <button type="button">关联文件</button>
              </div>
            </div>
          </template>
        </div>
        <div v-if="!section.items.length" class="matter-section__empty">暂无{{ section.label }}事项</div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { ensureDemoTasksForGroup } from '@/modules/collaboration/demo/collabTasksDemo'
import { useCollaborationBTaskBoardStore } from '@/modules/collaboration-b/store/taskBoardStore'
import { CURRENT_USER, COLLEAGUES } from '@/dev-mocks/data/users'

defineOptions({ name: 'ProjectTaskBoardPanel' })

const props = defineProps({
  conversationId: { type: String, required: true },
})
const emit = defineEmits(['open-workflow', 'request-start-workflow'])

const taskStore = useCollabTaskStore()
const taskBoardStore = useCollaborationBTaskBoardStore()
const KOOKY_SPECIAL_GROUP_ID = 'mock-group-kooky-special-001'
const expandedId = ref('')
const sectionExpanded = ref({ in_progress: false, done: false, archived: false })
const creating = ref(false)
const newTitle = ref('')
const newOwner = ref(CURRENT_USER?.name || '')
const newDeadline = ref('')
const newDescription = ref('')
const newPriority = ref('')

const SECTION_META = Object.freeze([
  { key: 'in_progress', label: '进行中', defaultLimit: null },
  { key: 'done', label: '已完成', defaultLimit: 3 },
  { key: 'archived', label: '已归档', defaultLimit: 3 },
])

const SIMPLE_ITEMS = Object.freeze([
  {
    id: 'demo-release-script', title: '发布会演示流程与话术确认', status: 'in_progress', owner: '邓颖茹',
    deadline: '8月18日', deadlineAt: '2026-08-18', priority: 'P0', creator: '邓颖茹', createdAt: '2026-08-14T09:32:00+08:00',
    description: '把新建项目群、数字人更新看板和发起协作任务串成一条稳定的演示链路。',
  },
  {
    id: 'demo-yunfan-auth', title: '云帆 Skill 群级鉴权联调', status: 'in_progress', owner: '黄燕',
    deadline: '8月16日', deadlineAt: '2026-08-16', priority: 'P0', creator: '黄燕', createdAt: '2026-08-13T16:18:00+08:00',
    description: '验证数字人只能在当前群授权的云帆空间内查询和修改数据。',
  },
  {
    id: 'demo-product-acceptance', title: '协作 B 核心链路产品验收', status: 'done', owner: '孟世一',
    deadline: '今天', deadlineAt: '2026-08-14', priority: 'P0', creator: '邓颖茹', createdAt: '2026-08-12T11:06:00+08:00',
    description: '走查项目概览、事项、协作任务和会话文件的完整信息架构。',
  },
  {
    id: 'demo-cross-project', title: '跨项目总看板方案评估', status: 'archived', owner: '杨宇龙',
    deadline: '', priority: 'P2', creator: '杨宇龙', createdAt: '2026-08-11T14:20:00+08:00',
    description: '评估是否需要在群外提供跨项目事项汇总和负责人工作台。',
  },
])

const peopleByName = new Map(
  [CURRENT_USER, ...COLLEAGUES].filter(Boolean).map((person) => [person.name, person]),
)
const formPeople = [...peopleByName.values()]
const canCreateMatter = computed(() => !!newTitle.value.trim() && !!newOwner.value)

const flowTasks = computed(() => (
  props.conversationId ? taskStore.tasksByGroup(props.conversationId) : []
))
const createdItems = computed(() => taskBoardStore.createdItemsForGroup(props.conversationId))
const ordinaryBaseItems = computed(() => [
  ...createdItems.value,
  ...(props.conversationId === KOOKY_SPECIAL_GROUP_ID ? SIMPLE_ITEMS : []),
])
const ordinaryMatterIds = computed(() => new Set(ordinaryBaseItems.value.map((item) => String(item.id))))
const workflowChains = computed(() => groupWorkflowChains(flowTasks.value))
const workflowItems = computed(() => workflowChains.value
  .filter((chain) => !isChainLinkedToOrdinaryMatter(chain))
  .map(({ rootTask, currentTask, attempts }) => buildStandaloneWorkflowItem(rootTask, currentTask, attempts)))

const allItems = computed(() => [
  ...ordinaryBaseItems.value.map(normalizeOrdinaryItem),
  ...workflowItems.value,
])

const visibleSections = computed(() => SECTION_META.map(buildVisibleSection))

watch(
  () => props.conversationId,
  (conversationId) => {
    expandedId.value = ''
    sectionExpanded.value = { in_progress: false, done: false, archived: false }
    creating.value = false
    resetCreateForm()
    ensureDemoTasksForGroup(taskStore, conversationId)
  },
  { immediate: true },
)

watch([flowTasks, ordinaryBaseItems], ([tasks, matters]) => {
  const matterIds = new Set(matters.map((item) => String(item.id)))
  tasks
    .filter((task) => matterIds.has(String(task.matterId || '')))
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0))
    .forEach((task) => {
      if (taskBoardStore.linkedWorkflowTaskIdForMatter(props.conversationId, task.matterId) !== String(task.id)) {
        taskBoardStore.linkWorkflowTask(props.conversationId, task.matterId, task.id)
      }
    })
}, { immediate: true, deep: true })

function normalizeItem(item) {
  return {
    overdue: false,
    creator: '群成员',
    createdAt: '',
    updatedAt: '',
    deadlineAt: '',
    workflowTaskId: '',
    workflowProgress: '',
    currentStep: '',
    workflowCancelled: false,
    workflowHint: '查看流程',
    workflowActionLabel: '查看流程 →',
    workflowSyncMessage: '',
    ...item,
    statusLabel: statusLabel(item.status),
  }
}

function buildWorkflowMeta(task, attempts = 1) {
  const steps = Array.isArray(task?.steps) ? task.steps : []
  const doneCount = steps.filter((step) => ['done', 'skipped'].includes(step.status)).length
  const activeStep = steps.find((step) => step.status === 'active')
  const overdue = task?.deadlineStatus === 'overdue' || steps.some((step) => (
    step.status === 'active' && (
      step.deadlineStatus === 'overdue'
      || (Number.isFinite(Date.parse(String(step.deadline || ''))) && Date.parse(String(step.deadline)) < Date.now())
    )
  ))
  const status = task?.status === 'completed' ? 'done' : 'in_progress'
  const workflowCancelled = task?.status === 'aborted'
  return {
    status,
    activeStep,
    overdue,
    deadlineAt: task?.deadlineAt || activeStep?.deadline || '',
    fields: {
      workflowTaskId: task?.id || '',
      workflowProgress: `${doneCount}/${steps.length}`,
      currentStep: activeStep?.name || '',
      workflowCancelled,
      workflowHint: workflowCancelled ? '流程已取消，事项仍在进行中' : '流程已完成',
      workflowActionLabel: workflowCancelled ? '查看并重新开启 →' : '查看流程 →',
      workflowSyncMessage: workflowCancelled
        ? '协作任务已取消，事项保持进行中；可从历史流程再次开启。'
        : (status === 'done'
            ? '协作任务已完成，事项已自动完成。'
            : `事项状态由协作任务自动同步${attempts > 1 ? ` · 已执行 ${attempts} 次` : ''}。`),
    },
  }
}

function buildStandaloneWorkflowItem(rootTask, currentTask, attempts) {
  const workflow = buildWorkflowMeta(currentTask, attempts)
  return normalizeItem({
    id: `matter-flow-${rootTask.id}`,
    title: displayTaskTitle(currentTask),
    status: workflow.status,
    owner: workflow.activeStep?.assignees?.[0] || currentTask.createdBy || '待指定',
    deadline: workflow.overdue
      ? '已逾期'
      : (workflow.fields.workflowCancelled ? '待重新开启' : (workflow.status === 'done' ? '已完成' : '本周')),
    deadlineAt: workflow.deadlineAt,
    priority: workflow.overdue ? 'P0' : (workflow.status === 'in_progress' ? 'P1' : 'P2'),
    creator: rootTask.createdBy || currentTask.createdBy || '群成员',
    createdAt: rootTask.createdAt || currentTask.createdAt || '',
    updatedAt: currentTask.finishedAt || currentTask.createdAt || '',
    overdue: workflow.overdue,
    description: currentTask.goal || '通过群内协作推进这项工作。',
    ...workflow.fields,
  })
}

function linkedWorkflowChainForMatter(matterId) {
  const id = String(matterId)
  const linkedTaskId = taskBoardStore.linkedWorkflowTaskIdForMatter(props.conversationId, id)
  return workflowChains.value.find((chain) => (
    chain.tasks.some((task) => String(task.id) === linkedTaskId)
    || chain.tasks.some((task) => String(task.matterId || '') === id)
  )) || null
}

function isChainLinkedToOrdinaryMatter(chain) {
  if (chain.tasks.some((task) => ordinaryMatterIds.value.has(String(task.matterId || '')))) return true
  const chainTaskIds = new Set(chain.tasks.map((task) => String(task.id)))
  return [...ordinaryMatterIds.value].some((matterId) => (
    chainTaskIds.has(taskBoardStore.linkedWorkflowTaskIdForMatter(props.conversationId, matterId))
  ))
}

function normalizeOrdinaryItem(item) {
  const state = taskBoardStore.matterStateForGroup(props.conversationId, item.id)
  const linkedChain = linkedWorkflowChainForMatter(item.id)
  const workflow = linkedChain
    ? buildWorkflowMeta(linkedChain.currentTask, linkedChain.attempts)
    : null
  const status = workflow?.status || state?.status || item.status || 'in_progress'
  return normalizeItem({
    ...item,
    status,
    overdue: item.overdue || isDeadlineOverdue(item.deadlineAt, status) || workflow?.overdue,
    updatedAt: linkedChain?.currentTask?.finishedAt
      || linkedChain?.currentTask?.createdAt
      || state?.updatedAt
      || item.updatedAt
      || item.createdAt
      || '',
    ...(workflow?.fields || {}),
  })
}

function isDeadlineOverdue(deadlineAt, status) {
  if (!deadlineAt || status !== 'in_progress') return false
  const raw = String(deadlineAt)
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? Date.parse(`${raw}T23:59:59`)
    : Date.parse(raw)
  return Number.isFinite(timestamp) && timestamp < Date.now()
}

function statusLabel(status) {
  return ({
    in_progress: '进行中',
    done: '已完成',
    archived: '已归档',
  })[status] || '进行中'
}

function buildVisibleSection(section) {
  const items = allItems.value
    .filter((item) => item.status === section.key)
    .sort(sortMatters)
  const expanded = !!sectionExpanded.value[section.key]
  return {
    ...section,
    items,
    expanded,
    visibleItems: expanded || !section.defaultLimit ? items : items.slice(0, section.defaultLimit),
  }
}

function groupWorkflowChains(tasks) {
  const taskById = new Map(tasks.map((task) => [String(task.id), task]))
  const chains = new Map()

  tasks.forEach((task) => {
    let rootTask = task
    const visited = new Set([String(task.id)])
    while (rootTask?.reopenedFromTaskId) {
      const parentId = String(rootTask.reopenedFromTaskId)
      if (visited.has(parentId)) break
      const parent = taskById.get(parentId)
      if (!parent) break
      visited.add(parentId)
      rootTask = parent
    }
    const rootId = String(rootTask?.id || task.id)
    if (!chains.has(rootId)) chains.set(rootId, { rootTask, tasks: [] })
    chains.get(rootId).tasks.push(task)
  })

  return [...chains.values()].map((chain) => {
    const ordered = chain.tasks.slice().sort((left, right) => (
      Number(right.createdAt || right.finishedAt || 0) - Number(left.createdAt || left.finishedAt || 0)
    ))
    const currentTask = ordered.find((task) => task.status === 'in_progress') || ordered[0] || chain.rootTask
    return { rootTask: chain.rootTask, currentTask, attempts: chain.tasks.length, tasks: chain.tasks }
  })
}

function sortMatters(left, right) {
  const alertDiff = Number(right.overdue) - Number(left.overdue)
  if (alertDiff) return alertDiff
  const timeDiff = timestampOf(right.updatedAt || right.createdAt) - timestampOf(left.updatedAt || left.createdAt)
  if (timeDiff) return timeDiff
  return String(left.id).localeCompare(String(right.id))
}

function displayTaskTitle(task) {
  const title = String(task?.title || '未命名任务').trim()
  const emoji = String(task?.emoji || '').trim()
  return emoji && title.startsWith(emoji) ? title.slice(emoji.length).trimStart() : title
}

function avatarFor(owner) {
  return peopleByName.get(owner)?.avatar || ''
}

function timestampOf(value) {
  if (typeof value === 'number') return value
  const timestamp = Date.parse(String(value || ''))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatCreatedAt(value) {
  const timestamp = timestampOf(value)
  if (!timestamp) return '刚刚'
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDeadline(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${Number(match[2])}月${Number(match[3])}日` : ''
}

function toggleMatter(id) {
  expandedId.value = expandedId.value === id ? '' : id
}

function toggleSection(key) {
  sectionExpanded.value = {
    ...sectionExpanded.value,
    [key]: !sectionExpanded.value[key],
  }
}

function toggleCreate() {
  creating.value = !creating.value
  if (creating.value && !newOwner.value) newOwner.value = CURRENT_USER?.name || formPeople[0]?.name || ''
}

function resetCreateForm() {
  newTitle.value = ''
  newOwner.value = CURRENT_USER?.name || formPeople[0]?.name || ''
  newDeadline.value = ''
  newDescription.value = ''
  newPriority.value = ''
}

function cancelCreate() {
  creating.value = false
  resetCreateForm()
}

function createMatter() {
  const title = newTitle.value.trim()
  if (!title || !newOwner.value) return
  const item = normalizeItem({
    id: `matter-local-${Date.now()}`,
    title,
    status: 'in_progress',
    owner: newOwner.value,
    deadline: formatDeadline(newDeadline.value),
    deadlineAt: newDeadline.value,
    priority: newPriority.value,
    creator: CURRENT_USER?.name || '孟世一',
    createdAt: Date.now(),
    description: newDescription.value.trim(),
  })
  const createdItem = taskBoardStore.addCreatedItem(props.conversationId, item)
  if (!createdItem) return
  cancelCreate()
  expandedId.value = createdItem.id
}

function discussMatter(item) {
  ElMessage.success(`已引用「${item.title}」，可以回到群聊继续讨论`)
}

function startWorkflow(item) {
  emit('request-start-workflow', {
    id: item.id,
    title: item.title,
    owner: item.owner,
    deadline: item.deadline,
    description: item.description,
    conversationId: props.conversationId,
  })
}

function completeMatter(item) {
  if (!taskBoardStore.setMatterStatus(props.conversationId, item.id, 'done')) return
  ElMessage.success('事项已完成')
}

function reopenMatter(item) {
  if (!taskBoardStore.setMatterStatus(props.conversationId, item.id, 'in_progress')) return
  ElMessage.success('事项已重新打开')
}

function archiveMatter(item) {
  if (!taskBoardStore.archiveMatter(props.conversationId, item.id, item.status)) return
  ElMessage.success('事项已归档')
}

function restoreMatter(item) {
  if (!taskBoardStore.restoreMatter(props.conversationId, item.id, item.archivedFrom)) return
  ElMessage.success('事项已恢复')
}
</script>

<style scoped>
.task-board-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  color: #2f3547;
  container-type: inline-size;
}
.board-head {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 18px 7px;
  box-sizing: border-box;
}
.board-head h3 { margin: 0; font-size: 15px; line-height: 22px; font-weight: 650; }
.board-head span { display: block; margin-top: 1px; color: #969ba7; font-size: 11px; }
.board-create { height: 30px; padding: 0 12px; border: 1px solid #ffd3c2; border-radius: 8px; background: #fff7f3; color: #ff5a1f; font-size: 12px; font-weight: 600; cursor: pointer; }
.board-create:hover { background: #fff0e9; }
.quick-create { margin: 0 0 14px; padding: 13px; border: 1px solid #ffd9ca; border-radius: 10px; background: #fffaf7; }
.quick-create__grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.quick-create label { min-width: 0; display: flex; flex-direction: column; gap: 5px; color: #727887; font-size: 11px; }
.quick-create label.is-full { grid-column: 1 / -1; }
.quick-create label > span b { color: #ff5a1f; font-weight: 600; }
.quick-create input,
.quick-create select,
.quick-create textarea { width: 100%; padding: 0 10px; border: 1px solid #e4e7ed; border-radius: 7px; outline: none; background: #fff; color: #343a49; box-sizing: border-box; font: inherit; font-size: 12px; }
.quick-create input,
.quick-create select { height: 34px; }
.quick-create textarea { min-height: 68px; padding-top: 8px; resize: vertical; line-height: 18px; }
.quick-create input:focus,
.quick-create select:focus,
.quick-create textarea:focus { border-color: #ff8a5b; box-shadow: 0 0 0 2px rgba(255,90,31,.08); }
.quick-create__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 9px; }
.quick-create__actions button { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: #f0f1f3; color: #555c6c; cursor: pointer; }
.quick-create__actions .is-primary { background: #ff5a1f; color: #fff; }
.quick-create__actions .is-primary:disabled { opacity: .45; cursor: default; }
.board-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 18px 22px; box-sizing: border-box; }
.matter-section + .matter-section { margin-top: 18px; }
.matter-section__head { height: 28px; display: flex; align-items: center; gap: 6px; color: #8d93a0; font-size: 12px; font-weight: 600; }
.matter-section__count { min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; border-radius: 9px; background: #f1f2f5; font-size: 10px; box-sizing: border-box; }
.matter-section__toggle { margin-left: auto; padding: 3px 0; border: 0; background: transparent; color: #7e8799; font-size: 10px; cursor: pointer; }
.matter-section__toggle:hover { color: #ff5a1f; }
.matter-section__empty { display: flex; align-items: center; justify-content: center; min-height: 58px; border: 1px dashed #e7e9ed; border-radius: 10px; color: #a1a6b0; font-size: 11px; }
.matter-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); grid-auto-flow: row dense; gap: 8px; }
.matter-card { min-width: 0; margin: 0; border: 1px solid #e9ebef; border-radius: 11px; background: #fff; overflow: hidden; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }
.matter-card:hover { border-color: #dfe2e8; box-shadow: 0 3px 12px rgba(35,39,52,.05); }
.matter-card.is-expanded { border-color: #ffb99d; box-shadow: 0 5px 18px rgba(255,90,31,.08); }
.matter-card.is-overdue:not(.is-expanded) { border-left: 3px solid #ef5350; }
.matter-card__summary { width: 100%; min-height: 78px; display: flex; align-items: flex-start; padding: 10px 11px 9px; border: 0; outline: none; background: transparent; color: inherit; text-align: left; cursor: pointer; box-sizing: border-box; }
.matter-card__summary:focus-visible { border-radius: 10px; box-shadow: inset 0 0 0 2px rgba(255,90,31,.24); }
.priority-dot { width: 7px; height: 7px; flex: 0 0 auto; margin-top: 6px; border-radius: 50%; background: #a9aeb9; }
.priority-dot.is-p0 { background: #f05252; }
.priority-dot.is-p1 { background: #ff9b42; }
.priority-dot.is-p2 { background: #91a0b7; }
.matter-card__main { min-width: 0; flex: 1; }
.matter-card__title-row { display: flex; align-items: center; gap: 8px; }
.matter-card__title-row strong { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 20px; font-weight: 650; }
.status-pill { flex: 0 0 auto; padding: 1px 7px; border-radius: 8px; background: #f1f2f5; color: #7f8591; font-size: 10px; line-height: 17px; }
.status-pill.is-in_progress { background: #eaf3ff; color: #3386e8; }
.status-pill.is-done { background: #e9f7ef; color: #28a761; }
.status-pill.is-archived { background: #f1f2f4; color: #959aa4; }
.matter-card__meta { height: 20px; display: flex; align-items: center; gap: 5px; margin-top: 3px; color: #9197a3; font-size: 11px; }
.matter-card__meta i { width: 2px; height: 2px; border-radius: 50%; background: #c1c5cd; }
.matter-card__meta .is-danger { color: #e94b48; }
.owner-avatar { width: 17px; height: 17px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; background: #edf0f5; color: #687184; font-size: 9px; }
.owner-avatar img { width: 100%; height: 100%; object-fit: cover; }
.matter-card__linkline { min-width: 0; height: 18px; display: flex; align-items: center; gap: 7px; margin-top: 1px; overflow: hidden; color: #9a9fab; font-size: 10px; white-space: nowrap; }
.workflow-mark { flex: 0 0 auto; color: #5f70aa; font-weight: 600; }
.matter-card__chevron { width: 17px; height: 17px; flex: 0 0 auto; margin-top: 3px; color: #a0a5af; transition: transform .18s ease; }
.matter-card.is-expanded .matter-card__chevron { transform: rotate(180deg); }
.matter-card__detail { padding: 4px 14px 14px; border: 1px solid #ffcfbc; border-radius: 11px; background: #fffdfc; box-shadow: 0 5px 18px rgba(255,90,31,.06); }
.matter-grid__inspector { grid-column: 1 / -1; min-width: 0; }
.matter-detail-grid { margin: 0; }
.matter-detail-grid div { display: grid; grid-template-columns: 58px minmax(0,1fr); gap: 8px; padding-top: 10px; font-size: 11px; line-height: 18px; }
.matter-detail-grid dt { color: #9b9faa; }
.matter-detail-grid dd { margin: 0; color: #4d5361; }
.creator-info { display: flex; align-items: center; gap: 5px; }
.workflow-entry { width: 100%; display: flex; align-items: center; gap: 9px; margin-top: 12px; padding: 10px; border: 1px solid #e3e7f3; border-radius: 9px; background: #f8f9fd; color: #4c587f; text-align: left; cursor: pointer; }
.workflow-entry:hover { border-color: #cbd3ea; background: #f4f6fc; }
.workflow-entry__icon { width: 25px; height: 25px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; background: #e8edfb; color: #5870be; font-size: 16px; }
.workflow-entry > span:nth-child(2) { min-width: 0; flex: 1; }
.workflow-entry strong, .workflow-entry small { display: block; }
.workflow-entry strong { font-size: 11px; }
.workflow-entry small { margin-top: 2px; overflow: hidden; color: #9298a6; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.workflow-entry b { flex: 0 0 auto; color: #6174b0; font-size: 10px; font-weight: 600; }
.workflow-empty { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 10px; border-radius: 9px; background: #f7f7f8; color: #8d929d; font-size: 10px; }
.workflow-empty button { height: 26px; flex: 0 0 auto; padding: 0 9px; border: 1px solid #ffd0be; border-radius: 7px; background: #fff; color: #ff5a1f; cursor: pointer; }
.workflow-sync-hint { margin: 7px 2px 0; color: #858c9a; font-size: 10px; line-height: 16px; }
.workflow-sync-hint.is-completed { color: #28a761; }
.workflow-sync-hint.is-cancelled { color: #c47a28; }
.matter-status-actions { display: flex; gap: 7px; margin-top: 11px; padding-bottom: 10px; border-bottom: 1px solid #f0f1f3; }
.matter-status-actions button { height: 28px; padding: 0 11px; border: 1px solid #e4e6eb; border-radius: 7px; background: #fff; color: #6b7280; font-size: 10px; cursor: pointer; }
.matter-status-actions button:hover { background: #f7f8fa; }
.matter-status-actions button.is-primary { border-color: #ffcbb7; background: #fff2ec; color: #ff5a1f; font-weight: 600; }
.matter-card__actions { display: flex; gap: 7px; margin-top: 11px; }
.matter-card__actions button { height: 27px; padding: 0 9px; border: 0; border-radius: 6px; background: #f0f1f3; color: #656c79; font-size: 10px; cursor: pointer; }
.matter-card__actions button:first-child { background: #fff0e9; color: #ff5a1f; }

@container (max-width: 440px) {
  .matter-grid { grid-template-columns: minmax(0,1fr); }
}
</style>
