<template>
  <section class="project-overview">
    <header v-if="!props.embedded" class="project-overview__head">
      <div>
        <h3>项目看板</h3>
        <p>当前群的项目上下文</p>
      </div>
      <button type="button" class="icon-button" aria-label="收起" @click="closePanel">✕</button>
    </header>

    <div v-if="!project" class="project-overview__empty">
      <section class="empty-card">
        <span class="empty-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V7.5A1.5 1.5 0 0 1 5.5 6H10l2-2h6.5A1.5 1.5 0 0 1 20 5.5V20M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <h4>让群里的协作有个共同目标</h4>
        <p>先写清楚要交付什么、怎样算完成。之后再按需补充进展、里程碑和风险。</p>
        <div class="empty-card__sources" aria-label="支持的维护方式">
          <span>人维护</span>
          <span>数字人维护</span>
        </div>

        <button
          v-if="!editingGoal"
          type="button"
          class="empty-card__cta"
          @click="beginGoalEdit"
        >添加项目目标</button>

        <div v-else class="empty-goal-form">
          <label for="initial-project-goal">项目目标</label>
          <textarea
            id="initial-project-goal"
            v-model="goalDraft"
            class="edit-textarea"
            maxlength="300"
            rows="4"
            autofocus
            placeholder="例如：在 9 月底前完成新版协作群交付，并通过核心用户验收"
          ></textarea>
          <div class="inline-actions">
            <button type="button" class="secondary-button" :disabled="savingGoal" @click="cancelGoalEdit">取消</button>
            <button type="button" class="primary-button" :disabled="savingGoal" @click="saveGoal">
              {{ savingGoal ? '保存中…' : '保存项目目标' }}
            </button>
          </div>
        </div>
      </section>

      <div class="empty-preview" aria-hidden="true">
        <div><span>01</span><strong>目标</strong><small>明确交付与完成标准</small></div>
        <div><span>02</span><strong>里程碑</strong><small>记录关键节点与状态</small></div>
        <div><span>03</span><strong>风险</strong><small>公开阻塞并持续跟进</small></div>
      </div>

      <section v-if="props.embedded" class="overview-section task-summary task-summary--board task-summary--empty">
        <div class="section-head">
          <div><h5>项目事项</h5><span>Kooky 自动统计 · 基于本群事项状态实时计算</span></div>
          <button type="button" class="text-button" @click="openBoard">查看事项</button>
        </div>
        <div class="task-stats">
          <div><strong>{{ boardItemCount }}</strong><span>事项总数</span></div>
          <div><strong>{{ boardOngoingCount }}</strong><span>进行中</span></div>
          <div><strong>{{ boardCompletedCount }}</strong><span>已完成</span></div>
          <div><strong>{{ boardOverdueCount }}</strong><span>逾期</span></div>
        </div>
      </section>

      <section class="overview-section task-summary task-summary--empty">
        <div class="section-head">
          <div><h5>协作任务</h5><span>本群任务状态摘要</span></div>
          <button type="button" class="text-button" @click="openTasks">查看全部</button>
        </div>
        <div class="task-stats">
          <div><strong>{{ tasks.length }}</strong><span>全部</span></div>
          <div><strong>{{ activeTaskCount }}</strong><span>进行中</span></div>
          <div><strong>{{ completedTaskCount }}</strong><span>已完成</span></div>
          <div><strong>{{ abortedTaskCount }}</strong><span>已取消</span></div>
        </div>
      </section>
    </div>

    <div v-else class="project-overview__scroll">
      <section class="project-hero" :class="{ 'has-steward': props.embedded }">
        <div class="project-hero__summary">
          <div class="project-hero__top">
            <div class="project-hero__identity">
              <span class="project-hero__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V7.5A1.5 1.5 0 0 1 5.5 6H10l2-2h6.5A1.5 1.5 0 0 1 20 5.5V20M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <div>
                <h4>{{ project.name }}</h4>
                <span>人和数字人共同维护</span>
              </div>
            </div>
          </div>

          <div v-if="!props.embedded" class="project-meta">
            <div><span>负责人</span><strong>{{ project.owner || '待指定' }}</strong></div>
            <div><span>完成度</span><strong>{{ project.progress || 0 }}%</strong></div>
            <div><span>最近更新</span><strong>{{ shortTime(project.updatedAt) }}</strong></div>
          </div>
          <div v-if="!props.embedded" class="progress-track" aria-label="项目完成度">
            <span :style="{ width: `${project.progress || 0}%` }"></span>
          </div>

          <template v-if="props.embedded && !editingOverview">
            <div class="project-hero__progress-head">
              <span>目标达成度</span>
              <strong>{{ project.progress || 0 }}%</strong>
            </div>
            <div class="progress-track" aria-label="目标达成度">
              <span :style="{ width: `${project.progress || 0}%` }"></span>
            </div>
            <div class="project-hero__goal-head">
              <strong>当前目标</strong>
              <button type="button" class="text-button" @click="beginOverviewEdit">编辑</button>
            </div>
            <p class="project-hero__goal-copy">{{ project.goal || '还没有填写当前目标' }}</p>
          </template>

          <aside v-if="props.embedded" class="project-steward-figure">
            <div class="project-steward-figure__portrait" :class="`is-${selectedSteward.presentationKey}`" aria-hidden="true">
              <img :src="selectedSteward.image" alt="" />
            </div>
            <button
              type="button"
              class="project-steward-figure__trigger"
              :aria-expanded="stewardPickerOpen"
              aria-haspopup="listbox"
              @click="stewardPickerOpen = !stewardPickerOpen"
            >
              <span><small>项目 PMO</small><strong>{{ selectedSteward.name }}</strong></span>
              <b>更换⌄</b>
            </button>

            <div v-if="stewardPickerOpen" class="project-steward-picker" role="listbox" aria-label="选择项目 PMO">
              <div class="project-steward-picker__head">
                <strong>选择项目 PMO</strong>
                <small>从当前群的数字人成员中选择</small>
              </div>
              <button
                v-for="steward in stewardOptions"
                :key="steward.id"
                type="button"
                role="option"
                :aria-selected="selectedSteward.id === steward.id"
                :class="{ active: selectedSteward.id === steward.id }"
                @click="selectSteward(steward.id)"
              >
                <span class="project-steward-picker__avatar" :class="`is-${steward.presentationKey}`"><img :src="steward.avatar || steward.image" alt="" /></span>
                <span class="project-steward-picker__copy"><strong>{{ steward.name }}</strong><small>{{ steward.description }}</small></span>
                <b>{{ selectedSteward.id === steward.id ? '✓' : '' }}</b>
              </button>
            </div>
          </aside>
        </div>

        <section v-if="props.embedded && editingOverview" class="project-hero__editor">
            <label class="hero-field-label">目标</label>
            <textarea v-model="goalDraft" class="edit-textarea hero-edit-textarea" maxlength="300" rows="3" placeholder="写清楚这一阶段要实现什么、怎样算完成"></textarea>
            <label class="field-label">目标达成度 <b>{{ progressDraft }}%</b></label>
            <input v-model.number="progressDraft" type="range" min="0" max="100" step="5" class="progress-range" />
            <div class="inline-actions">
              <button type="button" class="secondary-button" @click="cancelOverviewEdit">取消</button>
              <button type="button" class="primary-button" @click="saveOverview">保存</button>
            </div>
        </section>
      </section>

      <section v-if="props.embedded" class="overview-section overview-section--execution">
        <div class="section-head">
          <div><h5>执行数据</h5><span>Kooky 根据本群事项与协作任务自动统计</span></div>
        </div>
        <div class="task-stats task-stats--three">
          <button type="button" @click="openBoard"><strong>{{ boardCompletedCount }}/{{ boardItemCount }}</strong><span>事项已完成</span></button>
          <button type="button" @click="openBoard"><strong>{{ boardOverdueCount }}</strong><span>事项逾期</span></button>
          <button type="button" @click="openTasks"><strong>{{ activeTaskCount }}</strong><span>任务运行中</span></button>
        </div>
      </section>

      <section v-if="!props.embedded" class="overview-section">
        <div class="section-head">
          <div><h5>项目目标</h5><span>{{ updateAttribution }}</span></div>
          <button v-if="!editingGoal" type="button" class="text-button" @click="beginGoalEdit">编辑</button>
        </div>
        <template v-if="editingGoal">
          <textarea v-model="goalDraft" class="edit-textarea" maxlength="300" rows="4"></textarea>
          <div class="inline-actions">
            <button type="button" class="secondary-button" @click="cancelGoalEdit">取消</button>
            <button type="button" class="primary-button" @click="saveGoal">保存</button>
          </div>
        </template>
        <p v-else class="goal-copy">{{ project.goal || '还没有填写项目目标' }}</p>
      </section>

      <section v-if="!props.embedded" class="overview-section">
        <div class="section-head">
          <div><h5>当前进展</h5><span>人或数字人均可维护，操作过程可在群聊中追溯</span></div>
          <button v-if="!editingProgress" type="button" class="text-button" @click="beginProgressEdit">更新</button>
        </div>
        <template v-if="editingProgress">
          <label class="field-label">完成度 <b>{{ progressDraft }}%</b></label>
          <input v-model.number="progressDraft" type="range" min="0" max="100" step="5" class="progress-range" />
          <textarea v-model="progressSummaryDraft" class="edit-textarea" maxlength="240" rows="3" placeholder="说明当前已完成、正在做和下一步"></textarea>
          <div class="inline-actions">
            <button type="button" class="secondary-button" @click="editingProgress = false">取消</button>
            <button type="button" class="primary-button" @click="saveProgress">保存</button>
          </div>
        </template>
        <p v-else class="progress-copy">{{ project.progressSummary || '暂无进展说明' }}</p>
      </section>

      <section class="overview-section">
        <div class="section-head">
          <div><h5>关键里程碑</h5><span>不是第三方实时同步；由人或数字人按需维护</span></div>
          <button type="button" class="text-button" @click="showMilestoneForm = !showMilestoneForm">+ 添加</button>
        </div>

        <div v-if="showMilestoneForm" class="inline-form">
          <input v-model="milestoneDraft.title" maxlength="80" placeholder="里程碑名称" />
          <div class="inline-form__row">
            <input v-model="milestoneDraft.date" maxlength="20" placeholder="日期，如 8月30日" />
            <button type="button" class="primary-button" @click="addMilestone">添加</button>
          </div>
        </div>

        <div v-if="project.milestones?.length" class="milestone-list">
          <article v-for="milestone in project.milestones" :key="milestone.id" class="milestone" :class="`is-${milestone.status}`">
            <span class="milestone__node" aria-hidden="true"></span>
            <div class="milestone__body">
              <div class="milestone__title-row">
                <strong>{{ milestone.title }}</strong>
                <select :value="milestone.status" @change="updateMilestone(milestone.id, $event.target.value)">
                  <option value="pending">未开始</option>
                  <option value="active">进行中</option>
                  <option value="done">已完成</option>
                </select>
              </div>
              <div class="milestone__meta">
                <span>{{ milestone.date || '待确定' }}</span>
                <span>{{ milestone.updatedBy || '群成员' }} 更新</span>
                <span>{{ sourceLabel(milestone.source) }}</span>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="section-empty">还没有里程碑</div>
      </section>

      <section class="overview-section">
        <div class="section-head">
          <div><h5>风险与阻塞</h5><span>{{ openRiskCount ? `${openRiskCount} 项待处理` : '当前无待处理风险' }}</span></div>
          <button type="button" class="text-button" @click="showRiskForm = !showRiskForm">+ 添加</button>
        </div>

        <div v-if="showRiskForm" class="inline-form">
          <input v-model="riskDraft.title" maxlength="100" placeholder="描述风险或阻塞" />
          <div class="inline-form__row">
            <select v-model="riskDraft.level">
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </select>
            <button type="button" class="primary-button" @click="addRisk">添加</button>
          </div>
        </div>

        <div v-if="project.risks?.length" class="risk-list">
          <button
            v-for="risk in project.risks"
            :key="risk.id"
            type="button"
            class="risk-row"
            :class="{ 'is-resolved': risk.status === 'resolved' }"
            @click="toggleRisk(risk.id)"
          >
            <span class="risk-dot" :class="`is-${risk.level}`"></span>
            <span class="risk-copy"><strong>{{ risk.title }}</strong><small>{{ risk.status === 'resolved' ? '已解除' : `${risk.updatedBy || '群成员'} 更新` }}</small></span>
            <span>{{ risk.status === 'resolved' ? '重新打开' : '标记解决' }}</span>
          </button>
        </div>
        <div v-else class="section-empty section-empty--safe">暂无风险，世界暂时还没塌。</div>
      </section>

      <section v-if="!props.embedded" class="overview-section task-summary">
        <div class="section-head">
          <div><h5>协作任务</h5><span>本群任务状态摘要</span></div>
          <button type="button" class="text-button" @click="openTasks">查看全部</button>
        </div>
        <div class="task-stats">
          <div><strong>{{ tasks.length }}</strong><span>全部</span></div>
          <div><strong>{{ activeTaskCount }}</strong><span>进行中</span></div>
          <div><strong>{{ completedTaskCount }}</strong><span>已完成</span></div>
          <div><strong>{{ abortedTaskCount }}</strong><span>已取消</span></div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/store'
import { useUserStore } from '@/modules/auth/store'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useCollabProjectStore } from '@/modules/collaboration/store/projectStore'
import { ensureDemoTasksForGroup } from '@/modules/collaboration/demo/collabTasksDemo'
import { useCollaborationBTaskBoardStore } from '@/modules/collaboration-b/store/taskBoardStore'
import {
  collaborationBStewardCandidates,
  useCollaborationBStewardStore,
} from '@/modules/collaboration-b/store/stewardStore'
import kookyStewardImage from '@/assets/home/kooky_stop.png'
import pmoStewardImage from '@/assets/collaboration/pmo-digital-human.png'
import pmoStewardAvatar from '@/assets/collaboration/pmo-digital-human-avatar.png'
import yunfanPmoStewardImage from '@/assets/collaboration/yunfan-pmo-digital-human.png'
import yunfanPmoStewardAvatar from '@/assets/collaboration/yunfan-pmo-avatar.png'
import tapdPmoStewardImage from '@/assets/collaboration/tapd-pmo-digital-human.png'
import tapdPmoStewardAvatar from '@/assets/collaboration/tapd-pmo-avatar.png'

defineOptions({ name: 'ProjectOverviewPanel' })

const props = defineProps({
  conversationId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'navigate-tab'])

const groupStore = useGroupStore()
const userStore = useUserStore()
const sidePanel = useSidePanelStore()
const taskStore = useCollabTaskStore()
const projectStore = useCollabProjectStore()
const taskBoardStore = useCollaborationBTaskBoardStore()
const stewardStore = useCollaborationBStewardStore()

const STEWARD_PRESENTATION = Object.freeze({
  'team-assistant': {
    name: '团队助手',
    description: '整理群内协作信息，协助创建并推进协作任务',
    image: kookyStewardImage,
    presentationKey: 'team-assistant',
  },
  'agent-1007': {
    name: 'PMO 数字人',
    description: '关注项目节奏、里程碑与跨角色协同',
    image: pmoStewardImage,
    avatar: pmoStewardAvatar,
    presentationKey: 'pmo',
  },
  'agent-1008': {
    name: '云帆 PMO',
    description: '通过云帆 Skill 推进项目、工单与里程碑',
    image: yunfanPmoStewardImage,
    avatar: yunfanPmoStewardAvatar,
    presentationKey: 'pmo',
  },
  'agent-1009': {
    name: 'TAPD PMO',
    description: '通过 TAPD Skill 推进迭代、需求与缺陷',
    image: tapdPmoStewardImage,
    avatar: tapdPmoStewardAvatar,
    presentationKey: 'pmo',
  },
})

const conversationId = computed(() => (
  props.conversationId
  || groupStore.currentSpaceId
  || groupStore.currentConversationId
  || ''
))
const conversationName = computed(() => (
  groupStore.conversations.find((item) => String(item.conversationId) === String(conversationId.value))?.name
  || '未命名项目'
))
const roomMembers = computed(() => groupStore.conversationMembers[conversationId.value] || [])
const stewardOptions = computed(() => (
  collaborationBStewardCandidates(roomMembers.value).map((candidate) => {
    const presentation = STEWARD_PRESENTATION[candidate.id] || {}
    const name = presentation.name || candidate.name
    return {
      ...candidate,
      ...presentation,
      name,
      shortName: candidate.id === 'agent-1007' ? 'PMO' : name,
      description: presentation.description || '群内数字人，可按指令推进项目协作',
      image: presentation.image || candidate.avatar || '',
      avatar: presentation.avatar || candidate.avatar || presentation.image || '',
      presentationKey: presentation.presentationKey || candidate.presentationKey || 'digital-human',
    }
  })
))
const selectedStewardId = computed(() => stewardStore.stewardForGroup(conversationId.value))
const selectedSteward = computed(() => (
  stewardOptions.value.find((steward) => steward.id === selectedStewardId.value) || stewardOptions.value[0]
))
const project = computed(() => projectStore.projectForGroup(conversationId.value))
const tasks = computed(() => conversationId.value ? taskStore.tasksByGroup(conversationId.value) : [])
const activeTaskCount = computed(() => tasks.value.filter((task) => task.status === 'in_progress').length)
const completedTaskCount = computed(() => tasks.value.filter((task) => task.status === 'completed').length)
const abortedTaskCount = computed(() => tasks.value.filter((task) => task.status === 'aborted').length)
const hasKookyBoardDemo = computed(() => String(conversationId.value) === 'mock-group-kooky-special-001')
const localBoardItems = computed(() => taskBoardStore.createdItemsForGroup(conversationId.value))
const kookyDemoMatters = computed(() => (hasKookyBoardDemo.value ? [
  { id: 'demo-release-script', status: 'ongoing', deadlineAt: '2026-08-18' },
  { id: 'demo-yunfan-auth', status: 'ongoing', deadlineAt: '2026-08-16' },
  { id: 'demo-product-acceptance', status: 'done', deadlineAt: '2026-08-14' },
  { id: 'demo-cross-project', status: 'archived' },
] : []))
const ordinaryBaseMatters = computed(() => [
  ...kookyDemoMatters.value,
  ...localBoardItems.value,
])
const ordinaryMatterIds = computed(() => new Set(ordinaryBaseMatters.value.map((item) => String(item.id))))
const workflowChains = computed(() => buildWorkflowChains(tasks.value))
const standaloneMatters = computed(() => ordinaryBaseMatters.value.map((item) => {
  const chain = workflowChainForMatter(item.id, workflowChains.value)
  const status = chain
    ? (chain.current?.status === 'completed' ? 'done' : 'ongoing')
    : effectiveMatterStatus(item)
  return {
    ...item,
    status,
    overdue: status === 'ongoing' && (chain ? isTaskOverdue(chain.current) : isStandaloneMatterOverdue(item)),
  }
}))
const workflowMatters = computed(() => workflowChains.value
  .filter((chain) => !isWorkflowChainLinkedToOrdinaryMatter(chain))
  .map((chain) => ({
    id: `workflow-${chain.rootId}`,
    status: chain.current?.status === 'completed' ? 'done' : 'ongoing',
    overdue: isTaskOverdue(chain.current),
  })))
const boardMatters = computed(() => [...standaloneMatters.value, ...workflowMatters.value])
const boardItemCount = computed(() => boardMatters.value.length)
const boardOngoingCount = computed(() => boardMatters.value.filter((item) => item.status === 'ongoing').length)
const boardCompletedCount = computed(() => boardMatters.value.filter((item) => item.status === 'done').length)
const boardOverdueCount = computed(() => boardMatters.value.filter((item) => item.overdue).length)
const openRiskCount = computed(() => (project.value?.risks || []).filter((risk) => risk.status !== 'resolved').length)
const operator = computed(() => userStore.userName || '群成员')
const updateAttribution = computed(() => {
  if (!project.value) return ''
  const source = project.value.maintenanceSource || project.value.updates?.[0]?.source
  return `${project.value.updatedBy || '群成员'} · ${sourceLabel(source)} · ${shortTime(project.value.updatedAt)}更新`
})

const editingGoal = ref(false)
const goalDraft = ref('')
const savingGoal = ref(false)
const editingOverview = ref(false)
const editingProgress = ref(false)
const progressDraft = ref(0)
const progressSummaryDraft = ref('')
const showMilestoneForm = ref(false)
const milestoneDraft = reactive({ title: '', date: '' })
const showRiskForm = ref(false)
const riskDraft = reactive({ title: '', level: 'medium' })
const stewardPickerOpen = ref(false)

onMounted(() => {
  if (!props.embedded) sidePanel.setWide(true)
})
onBeforeUnmount(() => {
  if (!props.embedded) sidePanel.setWide(false)
})

watch(conversationId, () => {
  ensureDemoTasksForGroup(taskStore, conversationId.value)
  editingGoal.value = false
  savingGoal.value = false
  editingOverview.value = false
  editingProgress.value = false
  showMilestoneForm.value = false
  showRiskForm.value = false
  stewardPickerOpen.value = false
}, { immediate: true })

watch(
  [conversationId, () => stewardOptions.value.map((item) => item.id).join('|')],
  ([cid]) => {
    if (!props.embedded || !cid) return
    // 成员列表已有缓存时才判定“原选中管家已离群”，避免首次加载瞬间误回退。
    if (!Object.prototype.hasOwnProperty.call(groupStore.conversationMembers, cid)) return
    stewardStore.ensureValidSteward(cid, stewardOptions.value.map((item) => item.id))
  },
  { immediate: true },
)

function shortTime(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function sourceLabel(value) {
  return /数字人|管家|agent|digital/i.test(String(value || '')) ? '数字人维护' : '人维护'
}

function meta(text) {
  return { updatedBy: operator.value, source: '人维护', text }
}

function updateStage(stage) {
  projectStore.updateProject(conversationId.value, { stage }, meta(`将项目阶段更新为${stage}`))
}

function beginGoalEdit() {
  goalDraft.value = project.value?.goal || ''
  editingGoal.value = true
}

function cancelGoalEdit() {
  editingGoal.value = false
}

function beginOverviewEdit() {
  goalDraft.value = project.value?.goal || ''
  progressDraft.value = Number(project.value?.progress || 0)
  editingOverview.value = true
  stewardPickerOpen.value = false
}

function cancelOverviewEdit() {
  editingOverview.value = false
}

function saveOverview() {
  const goal = goalDraft.value.trim()
  if (!goal) return ElMessage.warning('当前目标不能为空')
  projectStore.updateProject(
    conversationId.value,
    {
      goal,
      progress: progressDraft.value,
    },
    meta('更新了当前目标与目标达成度'),
  )
  editingOverview.value = false
  ElMessage.success('目标与达成度已更新')
}

async function saveGoal() {
  const goal = goalDraft.value.trim()
  if (!goal) return ElMessage.warning('项目目标不能为空')
  const cid = conversationId.value
  if (!cid) return ElMessage.warning('当前群聊不可用，请重新进入后再试')

  savingGoal.value = true
  try {
    if (!project.value) {
      projectStore.createProject(cid, {
        name: conversationName.value,
        goal,
        owner: operator.value,
        stage: '规划中',
        progress: 0,
        updatedBy: operator.value,
        source: '人维护',
      })
      ElMessage.success('项目目标已添加')
    } else {
      projectStore.updateProject(cid, { goal }, meta('更新了项目目标'))
      ElMessage.success('项目目标已更新')
    }
    cancelGoalEdit()
  } catch (error) {
    console.error('[ProjectOverviewPanel] 保存项目目标失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    savingGoal.value = false
  }
}

function beginProgressEdit() {
  progressDraft.value = Number(project.value?.progress || 0)
  progressSummaryDraft.value = project.value?.progressSummary || ''
  editingProgress.value = true
}

function saveProgress() {
  projectStore.updateProject(
    conversationId.value,
    { progress: progressDraft.value, progressSummary: progressSummaryDraft.value.trim() },
    meta('更新了项目进展'),
  )
  editingProgress.value = false
  ElMessage.success('项目进展已更新')
}

function addMilestone() {
  if (!milestoneDraft.title.trim()) return ElMessage.warning('请输入里程碑名称')
  projectStore.addMilestone(
    conversationId.value,
    { title: milestoneDraft.title, date: milestoneDraft.date },
    meta(`新增里程碑：${milestoneDraft.title.trim()}`),
  )
  milestoneDraft.title = ''
  milestoneDraft.date = ''
  showMilestoneForm.value = false
  ElMessage.success('里程碑已添加')
}

function updateMilestone(id, status) {
  projectStore.updateMilestoneStatus(conversationId.value, id, status, meta('更新了里程碑状态'))
}

function addRisk() {
  if (!riskDraft.title.trim()) return ElMessage.warning('请输入风险或阻塞')
  projectStore.addRisk(
    conversationId.value,
    { title: riskDraft.title, level: riskDraft.level },
    meta(`新增风险：${riskDraft.title.trim()}`),
  )
  riskDraft.title = ''
  riskDraft.level = 'medium'
  showRiskForm.value = false
  ElMessage.success('风险已添加')
}

function toggleRisk(id) {
  projectStore.resolveRisk(conversationId.value, id, meta('更新了项目风险'))
}

function openTasks() {
  if (conversationId.value) taskStore.toggleDetailPanel(conversationId.value, false)
  if (props.embedded) {
    emit('navigate-tab', 'tasks')
    return
  }
  sidePanel.open('tasks')
}

function closePanel() {
  if (props.embedded) {
    emit('close')
    return
  }
  sidePanel.close()
}

function openBoard() {
  if (props.embedded) emit('navigate-tab', 'board')
}

function selectSteward(stewardId) {
  if (!props.embedded) return
  stewardStore.setSteward(
    conversationId.value,
    stewardId,
    stewardOptions.value.map((item) => item.id),
  )
  stewardPickerOpen.value = false
}

function normalizeMatterStatus(status) {
  const value = String(status || '').toLowerCase()
  if (['done', 'completed'].includes(value)) return 'done'
  if (['archived', 'cancelled', 'canceled'].includes(value)) return 'archived'
  return 'ongoing'
}

function effectiveMatterStatus(item) {
  const fallback = normalizeMatterStatus(item?.status)
  if (typeof taskBoardStore.effectiveStatusForGroup !== 'function') return fallback
  return normalizeMatterStatus(
    taskBoardStore.effectiveStatusForGroup(conversationId.value, item?.id, fallback),
  )
}

function buildWorkflowChains(taskList = []) {
  const taskById = new Map(taskList.map((task) => [String(task.id), task]))
  const chains = new Map()

  taskList.forEach((task) => {
    const rootId = workflowRootId(task, taskById)
    if (!chains.has(rootId)) chains.set(rootId, [])
    chains.get(rootId).push(task)
  })

  return Array.from(chains, ([rootId, chainTasks]) => {
    const ordered = chainTasks.slice().sort((left, right) => taskCreatedAt(right) - taskCreatedAt(left))
    const current = ordered.find((task) => task.status === 'in_progress') || ordered[0]
    return { rootId, tasks: chainTasks, current }
  })
}

function workflowChainForMatter(matterId, chains = []) {
  const id = String(matterId || '')
  const linkedTaskId = taskBoardStore.linkedWorkflowTaskIdForMatter(conversationId.value, id)
  const explicit = chains.find((chain) => chain.tasks.some((task) => String(task.id) === linkedTaskId))
  if (explicit) return explicit
  return chains
    .filter((chain) => chain.tasks.some((task) => String(task.matterId || task.sourceMatterId || '') === id))
    .sort((left, right) => taskCreatedAt(right.current) - taskCreatedAt(left.current))[0] || null
}

function isWorkflowChainLinkedToOrdinaryMatter(chain) {
  if (chain.tasks.some((task) => ordinaryMatterIds.value.has(String(task.matterId || task.sourceMatterId || '')))) {
    return true
  }
  const taskIds = new Set(chain.tasks.map((task) => String(task.id)))
  return [...ordinaryMatterIds.value].some((matterId) => (
    taskIds.has(taskBoardStore.linkedWorkflowTaskIdForMatter(conversationId.value, matterId))
  ))
}

function workflowRootId(task, taskById) {
  let current = task
  const visited = new Set([String(task?.id || '')])

  while (current?.reopenedFromTaskId) {
    const parentId = String(current.reopenedFromTaskId)
    if (visited.has(parentId)) break
    visited.add(parentId)
    const parent = taskById.get(parentId)
    if (!parent) return parentId
    current = parent
  }
  return String(current?.id || task?.id || '')
}

function taskCreatedAt(task) {
  const value = task?.createdAt
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function isStandaloneMatterOverdue(item) {
  if (item?.overdue || item?.deadlineStatus === 'overdue') return true
  const raw = String(item?.deadlineAt || item?.deadline || '')
  const deadlineAt = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? Date.parse(`${raw}T23:59:59`)
    : Date.parse(raw)
  return Number.isFinite(deadlineAt) && deadlineAt < Date.now()
}

function isTaskOverdue(task) {
  if (task?.status !== 'in_progress') return false
  if (task?.deadlineStatus === 'overdue') return true
  return (task?.steps || []).some((step) => {
    if (step?.status !== 'active') return false
    if (step.deadlineStatus === 'overdue') return true
    const deadlineAt = Date.parse(String(step.deadline || ''))
    return Number.isFinite(deadlineAt) && deadlineAt < Date.now()
  })
}
</script>

<style scoped>
.project-overview { height: 100%; min-width: 0; display: flex; flex-direction: column; container-type: inline-size; background: #fff; color: #2f3547; }
.project-overview__head { min-height: 54px; padding: 12px 16px 10px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f1f3; box-sizing: border-box; }
.project-overview__head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.project-overview__head p { margin: 2px 0 0; color: #a0a5b0; font-size: 11px; }
.icon-button { width: 26px; height: 26px; border: none; border-radius: 7px; background: transparent; color: #9aa0aa; cursor: pointer; }
.icon-button:hover { background: #f3f4f7; color: #2f3547; }
.project-overview__empty { flex: 1; min-height: 0; overflow-y: auto; padding: 28px 22px 24px; color: #2f3547; box-sizing: border-box; }
.empty-card { max-width: 460px; margin: 0 auto; padding: 28px 30px 26px; border: 1px solid rgba(255,98,31,.16); border-radius: 16px; background: linear-gradient(145deg, rgba(255,98,31,.055), rgba(255,255,255,.98) 64%); text-align: center; box-sizing: border-box; }
.empty-card__icon { width: 48px; height: 48px; margin: 0 auto; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,98,31,.11); color: #ff621f; }
.empty-card__icon svg { width: 23px; height: 23px; }
.empty-card h4 { margin: 14px 0 0; font-size: 17px; font-weight: 600; }
.empty-card > p { max-width: 360px; margin: 8px auto 0; color: #7f8694; font-size: 12px; line-height: 1.7; }
.empty-card__sources { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.empty-card__sources span { padding: 3px 8px; border-radius: 999px; background: #f3f4f7; color: #707786; font-size: 10px; }
.empty-card__cta { height: 34px; margin-top: 20px; padding: 0 18px; border: 1px solid #2f3547; border-radius: 8px; background: #2f3547; color: #fff; font-size: 12px; cursor: pointer; }
.empty-card__cta:hover { background: #202532; }
.empty-goal-form { margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(47,53,71,.08); text-align: left; }
.empty-goal-form > label { display: block; margin: 12px 0 6px; color: #596071; font-size: 11px; font-weight: 500; }
.empty-goal-form > label:first-child { margin-top: 0; }
.empty-goal-form label small { color: #a0a5b0; font-weight: 400; }
.empty-goal-form .edit-textarea { margin-top: 0; }
.empty-preview { max-width: 460px; margin: 14px auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.empty-preview div { min-width: 0; padding: 12px 10px; border: 1px solid #ebecef; border-radius: 10px; background: #fff; }
.empty-preview span,
.empty-preview strong,
.empty-preview small { display: block; }
.empty-preview span { color: #ff8b5c; font-size: 9px; font-weight: 600; }
.empty-preview strong { margin-top: 4px; font-size: 11px; font-weight: 600; }
.empty-preview small { margin-top: 3px; color: #a0a5b0; font-size: 9px; line-height: 1.45; }
.project-overview__scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px 24px; }
.project-hero { position: relative; padding: 15px; border: 1px solid rgba(255,98,31,.16); border-radius: 12px; background: linear-gradient(145deg, rgba(255,98,31,.055), rgba(255,255,255,.96) 68%); }
.project-hero.has-steward { min-height: 0; padding-right: 15px; box-sizing: border-box; }
.project-hero__summary { position: relative; }
.project-hero.has-steward .project-hero__summary { min-height: 135px; padding-right: 160px; box-sizing: border-box; }
.project-hero__top, .project-hero__identity, .project-meta, .section-head, .inline-actions, .inline-form__row, .milestone__title-row { display: flex; align-items: center; }
.project-hero__top, .section-head, .milestone__title-row { justify-content: space-between; gap: 12px; }
.project-hero__identity { gap: 10px; min-width: 0; }
.project-hero__icon { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,98,31,.11); color: #ff621f; flex-shrink: 0; }
.project-hero__icon svg { width: 19px; height: 19px; }
.project-hero h4 { margin: 0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.project-hero__identity span { color: #9aa0aa; font-size: 11px; }
.milestone select { height: 28px; padding: 0 24px 0 9px; border: 1px solid #e4e6eb; border-radius: 7px; outline: none; background: #fff; color: #596071; font-size: 11px; }
.project-meta { margin-top: 16px; gap: 12px; }
.project-meta > div { flex: 1; min-width: 0; }
.project-meta span, .project-meta strong { display: block; }
.project-meta span { color: #a0a5b0; font-size: 10px; }
.project-meta strong { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
.progress-track { height: 4px; margin-top: 12px; border-radius: 4px; overflow: hidden; background: #eceef2; }
.progress-track span { display: block; height: 100%; min-width: 2px; border-radius: inherit; background: linear-gradient(90deg,#ff9a5a,#ff621f); transition: width .2s; }
.project-steward-figure { position: absolute; top: -15px; right: -8px; width: 154px; height: 150px; z-index: 5; }
.project-steward-figure__portrait { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.project-steward-figure__portrait img { position: absolute; left: 50%; display: block; transform: translateX(-50%); filter: drop-shadow(0 7px 9px rgba(63,44,35,.12)); }
.project-steward-figure__portrait.is-team-assistant img { width: 90px; bottom: 42px; }
.project-steward-figure__portrait.is-pmo img { width: 128px; top: 0; }
.project-steward-figure__portrait.is-digital-human img { width: 112px; bottom: 34px; border-radius: 50%; }
.project-steward-figure__trigger { position: absolute; left: 3px; right: 3px; bottom: 6px; z-index: 4; height: 34px; padding: 0 8px 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid rgba(255,98,31,.18); border-radius: 9px; outline: none; background: rgba(255,255,255,.9); color: #343b4c; cursor: pointer; box-shadow: 0 4px 14px rgba(70,50,40,.1); backdrop-filter: blur(7px); }
.project-steward-figure__trigger span, .project-steward-figure__trigger small, .project-steward-figure__trigger strong { min-width: 0; display: block; text-align: left; }
.project-steward-figure__trigger small { color: #9a7464; font-size: 8px; line-height: 11px; }
.project-steward-figure__trigger strong { max-width: 88px; overflow: hidden; font-size: 10px; font-weight: 650; line-height: 14px; text-overflow: ellipsis; white-space: nowrap; }
.project-steward-figure__trigger > b { flex-shrink: 0; color: #ff621f; font-size: 9px; font-weight: 600; }
.project-steward-figure__trigger:hover { border-color: rgba(255,98,31,.34); background: #fff; }
.project-steward-figure__trigger:focus-visible { box-shadow: 0 0 0 2px rgba(255,98,31,.2); }
.project-steward-picker { position: absolute; top: calc(100% + 6px); right: 0; z-index: 30; width: 276px; padding: 7px; border: 1px solid #e6e8ed; border-radius: 11px; background: #fff; box-sizing: border-box; box-shadow: 0 12px 34px rgba(34,39,52,.16); }
.project-steward-picker__head { padding: 5px 7px 8px; border-bottom: 1px solid #f0f1f3; }
.project-steward-picker__head strong, .project-steward-picker__head small { display: block; }
.project-steward-picker__head strong { color: #343b4c; font-size: 12px; }
.project-steward-picker__head small { margin-top: 2px; color: #969ca8; font-size: 9px; }
.project-steward-picker > button { width: 100%; min-width: 0; min-height: 52px; margin-top: 4px; padding: 5px 7px; display: grid; grid-template-columns: 38px minmax(0,1fr) 16px; align-items: center; gap: 8px; border: 0; border-radius: 8px; background: transparent; color: #343b4c; cursor: pointer; text-align: left; }
.project-steward-picker > button:hover { background: #f7f8fa; }
.project-steward-picker > button.active { background: #fff5f0; }
.project-steward-picker > button > b { color: #ff621f; font-size: 13px; text-align: center; }
.project-steward-picker__avatar { position: relative; width: 38px; height: 38px; overflow: hidden; border-radius: 8px; background: linear-gradient(145deg,#fff3ec,#f1f4f9); }
.project-steward-picker__avatar img { position: absolute; left: 50%; display: block; transform: translateX(-50%); }
.project-steward-picker__avatar.is-team-assistant img { width: 36px; bottom: 2px; }
.project-steward-picker__avatar.is-pmo img { width: 38px; top: 0; }
.project-steward-picker__avatar.is-digital-human img { width: 38px; top: 0; }
.project-steward-picker__copy { min-width: 0; }
.project-steward-picker__copy strong, .project-steward-picker__copy small { display: block; }
.project-steward-picker__copy strong { font-size: 11px; font-weight: 600; }
.project-steward-picker__copy small { margin-top: 2px; overflow: hidden; color: #8c929f; font-size: 9px; line-height: 13px; text-overflow: ellipsis; white-space: nowrap; }
.project-hero__goal-head, .project-hero__progress-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.project-hero__goal-head { margin-top: 12px; }
.project-hero__goal-head strong { display: block; }
.project-hero__goal-head strong { font-size: 12px; font-weight: 600; }
.project-hero__goal-copy { margin: 6px 0 0; overflow: hidden; color: #4b5260; font-size: 11px; font-weight: 500; line-height: 1.6; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.project-hero__progress-head { margin-top: 11px; color: #7f8694; font-size: 10px; }
.project-hero__progress-head strong { color: #ff621f; font-size: 13px; }
.project-hero.has-steward .progress-track { margin-top: 7px; }
.project-hero__editor { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,98,31,.12); }
.hero-field-label { display: block; margin-top: 10px; color: #7f8694; font-size: 10px; }
.hero-edit-textarea { min-height: 58px; resize: vertical; }
.overview-section { margin-top: 10px; padding: 14px; border: 1px solid #ebecef; border-radius: 12px; background: #fff; }
.section-head { align-items: flex-start; }
.section-head h5 { margin: 0; font-size: 13px; font-weight: 600; }
.section-head span { display: block; margin-top: 3px; color: #a0a5b0; font-size: 10px; line-height: 1.45; }
.text-button { flex-shrink: 0; padding: 2px 0; border: none; background: transparent; color: #ff621f; font-size: 11px; cursor: pointer; }
.goal-copy, .progress-copy { margin: 10px 0 0; color: #596071; font-size: 12px; line-height: 1.75; white-space: pre-wrap; }
.edit-textarea, .inline-form input, .inline-form select { width: 100%; box-sizing: border-box; border: 1px solid #dfe2e8; border-radius: 8px; outline: none; background: #fff; color: #2f3547; font: inherit; }
.edit-textarea { margin-top: 10px; padding: 9px 10px; resize: vertical; font-size: 12px; line-height: 1.6; }
.edit-textarea:focus, .inline-form input:focus, .inline-form select:focus { border-color: #ff621f; }
.inline-actions { justify-content: flex-end; gap: 8px; margin-top: 8px; }
.secondary-button, .primary-button { height: 28px; padding: 0 12px; border-radius: 7px; font-size: 11px; cursor: pointer; }
.secondary-button { border: 1px solid #dfe2e8; background: #fff; color: #596071; }
.primary-button { border: 1px solid #2f3547; background: #2f3547; color: #fff; }
.secondary-button:disabled, .primary-button:disabled { opacity: .55; cursor: not-allowed; }
.field-label { display: flex; justify-content: space-between; margin-top: 11px; color: #7f8694; font-size: 11px; }
.progress-range { width: 100%; margin: 9px 0 2px; accent-color: #ff621f; }
.inline-form { margin-top: 10px; padding: 10px; border-radius: 9px; background: #f7f8fa; }
.inline-form input, .inline-form select { height: 32px; padding: 0 9px; font-size: 11px; }
.inline-form__row { gap: 8px; margin-top: 8px; }
.inline-form__row input, .inline-form__row select { flex: 1; min-width: 0; }
.milestone-list { margin-top: 12px; }
.milestone { position: relative; display: flex; gap: 11px; padding: 0 0 16px; }
.milestone:last-child { padding-bottom: 0; }
.milestone::before { content: ''; position: absolute; left: 5px; top: 12px; bottom: -2px; width: 1px; background: #e3e5e9; }
.milestone:last-child::before { display: none; }
.milestone__node { position: relative; z-index: 1; width: 10px; height: 10px; margin-top: 4px; border: 2px solid #c6cad1; border-radius: 50%; box-sizing: border-box; background: #fff; flex-shrink: 0; }
.milestone.is-active .milestone__node { border-color: #ff621f; box-shadow: 0 0 0 3px rgba(255,98,31,.1); }
.milestone.is-done .milestone__node { border-color: #25ad6a; background: #25ad6a; }
.milestone__body { flex: 1; min-width: 0; }
.milestone__title-row strong { min-width: 0; color: #3f4654; font-size: 12px; font-weight: 500; }
.milestone__meta { display: flex; flex-wrap: wrap; gap: 5px 10px; margin-top: 4px; color: #a0a5b0; font-size: 10px; }
.risk-list { margin-top: 10px; }
.risk-row { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 0; border: none; border-top: 1px solid #f0f1f3; background: transparent; text-align: left; cursor: pointer; }
.risk-row:first-child { border-top: none; }
.risk-row > span:last-child { flex-shrink: 0; color: #9aa0aa; font-size: 10px; }
.risk-row.is-resolved { opacity: .55; }
.risk-dot { width: 7px; height: 7px; border-radius: 50%; background: #f2b24a; flex-shrink: 0; }
.risk-dot.is-high { background: #eb5757; } .risk-dot.is-low { background: #56b881; }
.risk-copy { flex: 1; min-width: 0; }
.risk-copy strong, .risk-copy small { display: block; }
.risk-copy strong { color: #4d5564; font-size: 11px; font-weight: 500; }
.risk-copy small { margin-top: 2px; color: #a0a5b0; font-size: 10px; }
.section-empty { margin-top: 12px; padding: 14px; border-radius: 8px; background: #f7f8fa; color: #9aa0aa; text-align: center; font-size: 11px; }
.section-empty--safe { color: #6b9b7f; background: #f5faf7; }
.task-summary--empty { max-width: 460px; margin: 14px auto 0; text-align: left; }
.task-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 11px; }
.task-stats--three { grid-template-columns: repeat(3,minmax(0,1fr)); }
.task-stats div, .task-stats button { min-width: 0; padding: 9px; border: 0; border-radius: 8px; background: #f7f8fa; color: #2f3547; text-align: center; }
.task-stats button { cursor: pointer; }
.task-stats button:hover { background: #f1f2f5; }
.task-stats strong, .task-stats span { display: block; }
.task-stats strong { font-size: 15px; } .task-stats span { margin-top: 2px; color: #9aa0aa; font-size: 9px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

@container (max-width: 480px) {
  .project-hero.has-steward .project-hero__summary { padding-right: 132px; }
  .project-steward-figure { width: 130px; }
  .project-steward-figure__portrait.is-pmo img { width: 112px; }
  .project-steward-figure__portrait.is-team-assistant img { width: 80px; }
  .project-steward-picker { width: min(276px, calc(100cqw - 20px)); }
}
</style>
