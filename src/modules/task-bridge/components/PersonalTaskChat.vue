<template>
  <section class="personal-task-chat">
    <div class="personal-task-chat__main">
      <header class="bridge-header task-chat-header">
        <div class="bridge-title"><span>{{ task.title }}</span></div>
        <div class="bridge-actions task-chat-header__actions">
          <button v-if="showProjectTools" type="button" :class="{ active: activePanel === 'plan' }" @click="activePanel = 'plan'">团队计划<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg></button>
          <button v-if="showProjectTools" type="button" :class="{ active: activePanel === 'base' }" @click="activePanel = 'base'">任务背景<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg></button>
          <button type="button" class="task-chat-back" @click="backToProject"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>返回项目</button>
        </div>
      </header>
      <div v-if="statePreview === 'ready'" ref="taskChatScrollRef" class="task-chat-scroll">
      <div class="task-origin">来自 {{ project.name }} · 协作背景 v{{ project.snapshot.version }}</div>
      <template v-for="message in task.messages" :key="message.id">
        <div v-if="message.type === 'system'" class="system-event">{{ message.text }}</div>
        <article v-else class="bridge-message" :class="`is-${message.type}`">
          <div class="message-avatar"><img :src="message.type === 'user' ? ownerAvatar : assistantAvatar" :alt="message.type === 'user' ? '我' : '团队助理'" /></div>
          <div class="message-content">
            <strong>{{ message.type === 'user' ? '我' : '团队助理' }}</strong>
            <p>{{ message.text }}</p>
            <div v-if="message.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ message.file.name }}</strong><small>{{ message.file.type }} · {{ message.file.version }} · {{ message.file.status }}</small></div><button type="button">查看产物</button></div>
          </div>
        </article>
      </template>
      <section v-if="task.backfillDemoStep >= 1" class="task-backfill-card" :class="`is-${workflowState}`">
        <header class="backfill-card-header">
          <div>
            <div class="backfill-card-kicker"><strong>交付回填</strong><em :class="`is-${workflowState}`">{{ workflowMeta.label }}</em></div>
            <small>{{ workflowMeta.description }}</small>
          </div>
        </header>

        <div v-if="!canEditBackfill && !isReviewOutcome" class="backfill-permission" role="status">
          <strong>当前为只读权限</strong>
          <span>此任务由「{{ task.owner }}」负责提交。你可查看回填内容，如需修改请联系负责人申请编辑权限。</span>
        </div>
        <div v-if="formStatus.error" class="backfill-feedback is-error" role="alert">
          <span>{{ formStatus.error }}</span><button v-if="formStatus.retryable" type="button" @click="submitBackfill">重新提交</button>
        </div>
        <div v-if="formStatus.submitting" class="backfill-feedback is-loading" role="status" aria-live="polite"><i></i><span>正在提交并同步团队计划，请勿重复操作。</span></div>
        <div v-if="isReviewOutcome" class="task-backfill-outcome-shell">
          <div class="task-backfill-outcome backfill-outcome" :class="`is-${workflowState}`" role="status">
            <strong>{{ workflowMeta.outcomeTitle }}</strong><span>{{ workflowMeta.outcomeDescription }}</span>
            <button v-if="workflowState === 'changes_requested' && canEditBackfill" type="button" @click="resumeBackfill">继续修改</button>
            <button v-if="workflowState === 'accepted' && canSyncBackground" type="button" @click="syncAcceptedBackfill">回填至协作背景</button>
          </div>
        </div>

        <template v-if="isBackfillEditing">
          <section class="backfill-context"><span>当前任务</span><strong>{{ task.title }}</strong><small>{{ project.name }} · 任务背景 v{{ project.snapshot.version }}</small></section>
          <section class="backfill-section backfill-deliverable">
            <div class="backfill-section-heading"><div><span class="backfill-section-label">交付产物 <b>必填</b></span><small>用于接收方验收</small></div></div>
            <label class="task-backfill-artifact-field" :class="{ 'has-error': fieldErrors.deliverable }">
              <div class="task-backfill-artifact">
                <div class="task-backfill-artifact-file" :class="{ 'is-empty': !backfill.deliverable }"><span class="task-file-icon">M</span><div><strong>{{ backfill.deliverable || '尚未添加交付产物' }}</strong><small>{{ backfill.deliverable ? 'Markdown · v1 · 待提交' : '请添加可供验收的文件或链接' }}</small></div></div>
                <div class="task-backfill-artifact-actions"><button type="button" class="task-backfill-artifact-edit" :disabled="!canEditBackfill || formStatus.submitting" :aria-label="backfill.deliverable ? '修改产物' : '添加产物'" @click="editingBackfillArtifact = !editingBackfillArtifact">编辑</button><button v-if="backfill.deliverable" type="button" class="task-backfill-artifact-remove" :disabled="!canEditBackfill || formStatus.submitting" aria-label="移除交付产物" title="移除交付产物" @click="removeBackfillArtifact">×</button></div>
              </div>
              <input v-if="editingBackfillArtifact || !backfill.deliverable" v-model="backfill.deliverable" :disabled="!canEditBackfill || formStatus.submitting" class="backfill-inline-input" placeholder="输入产物名称、文件链接或在线文档" @input="clearFieldError('deliverable')" />
              <small v-if="fieldErrors.deliverable" class="backfill-field-error">{{ fieldErrors.deliverable }}</small>
            </label>
          </section>

          <section class="backfill-section backfill-decision">
            <div class="backfill-section-heading"><div><span class="backfill-section-label">完成结果 <b>必填</b></span><small>选择最符合实际产出的状态</small></div></div>
            <div class="completion-result">
              <div class="completion-result-labels" role="radiogroup" aria-label="完成结果">
                <button v-for="(item, index) in completionResultMeta" :key="item.label" type="button" role="radio" :class="{ active: completionResultValue === Number(index) }" :aria-checked="completionResultValue === Number(index)" :disabled="!canEditBackfill || formStatus.submitting" @click="backfill.completionResult = Number(index)">{{ item.label }}</button>
              </div>
              <div class="completion-result-current" :class="`is-result-${completionResultValue}`"><strong>{{ completionResultInfo(backfill.completionResult).label }}</strong><span>{{ completionResultInfo(backfill.completionResult).description }}</span></div>
              <div v-if="completionResultValue === 1" class="completion-result-fields">
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.completed }"><span>已完成内容</span><textarea v-model="backfill.completed" :disabled="formStatus.submitting" rows="2" placeholder="填写已完成的内容" @input="clearFieldError('completed')"></textarea><small v-if="fieldErrors.completed" class="backfill-field-error">{{ fieldErrors.completed }}</small></label>
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.incomplete }"><span>未完成内容</span><textarea v-model="backfill.incomplete" :disabled="formStatus.submitting" rows="2" placeholder="填写仍未完成的内容" @input="clearFieldError('incomplete')"></textarea><small v-if="fieldErrors.incomplete" class="backfill-field-error">{{ fieldErrors.incomplete }}</small></label>
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.nextAction }"><span>下一步行动</span><textarea v-model="backfill.nextAction" :disabled="formStatus.submitting" rows="2" placeholder="填写下一步处理方式" @input="clearFieldError('nextAction')"></textarea><small v-if="fieldErrors.nextAction" class="backfill-field-error">{{ fieldErrors.nextAction }}</small></label>
              </div>
              <div v-else-if="completionResultValue === 2" class="completion-result-fields">
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.incompleteReason }"><span>未完成原因</span><textarea v-model="backfill.incompleteReason" :disabled="formStatus.submitting" rows="2" placeholder="填写未形成有效产出的原因" @input="clearFieldError('incompleteReason')"></textarea><small v-if="fieldErrors.incompleteReason" class="backfill-field-error">{{ fieldErrors.incompleteReason }}</small></label>
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.blockers }"><span>当前阻塞事项</span><textarea v-model="backfill.blockers" :disabled="formStatus.submitting" rows="2" placeholder="填写当前阻塞事项" @input="clearFieldError('blockers')"></textarea><small v-if="fieldErrors.blockers" class="backfill-field-error">{{ fieldErrors.blockers }}</small></label>
                <label class="backfill-field" :class="{ 'has-error': fieldErrors.nextAction }"><span>后续处理方式</span><textarea v-model="backfill.nextAction" :disabled="formStatus.submitting" rows="2" placeholder="填写后续处理方式" @input="clearFieldError('nextAction')"></textarea><small v-if="fieldErrors.nextAction" class="backfill-field-error">{{ fieldErrors.nextAction }}</small></label>
              </div>
            </div>
          </section>

          <details class="backfill-extra"><summary>补充说明</summary><div><label class="backfill-field"><span>已知问题</span><textarea v-model="backfill.issues" :disabled="formStatus.submitting" rows="2" placeholder="可填写未覆盖内容或后续风险"></textarea></label><label class="backfill-field"><span>提交说明</span><textarea v-model="backfill.effective" :disabled="formStatus.submitting" rows="2" placeholder="补充本次提交需要接收方关注的内容"></textarea></label></div></details>
          <section class="backfill-section backfill-checklist"><div class="backfill-section-heading"><div><span class="backfill-section-label">验收标准</span><small>以下标准由接收方确认，不需要在此勾选</small></div><strong>{{ acceptanceChecklist.length }} 项待确认</strong></div><p v-for="item in acceptanceChecklist" :key="item.id"><i aria-hidden="true">○</i><span>{{ item.statement }}</span><em>待确认</em></p></section>
          <footer class="backfill-card-footer"><div><button type="button" class="backfill-secondary" :disabled="formStatus.submitting" @click="ignoreBackfill">忽略</button><button type="button" class="backfill-primary" :disabled="!canEditBackfill || formStatus.submitting" @click="submitBackfill">{{ formStatus.submitting ? '正在提交…' : '提交并请求验收' }}</button></div></footer>
        </template>
      </section>
      </div>
      <section v-else class="task-chat-state" :class="`is-${statePreview}`" role="status" aria-live="polite">
        <template v-if="statePreview === 'loading'">
          <span class="task-chat-state__mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <strong>正在同步任务内容</strong>
          <p>正在加载任务记录、交付状态与验收进度。</p>
          <div class="task-chat-state__skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
        </template>
        <template v-else-if="statePreview === 'error'">
          <span class="task-chat-state__mark" aria-hidden="true">!</span>
          <strong>内容暂时未能加载</strong>
          <p>请检查网络后重新尝试；已编辑但未提交的内容不会丢失。</p>
          <small>可通过右侧团队计划的“更多 → 恢复正常”返回任务。</small>
        </template>
        <template v-else>
          <span class="task-chat-state__mark" aria-hidden="true">⌁</span>
          <strong>你暂无查看此任务的权限</strong>
          <p>请联系项目负责人申请访问权限，或返回项目查看其他任务。</p>
          <small>可通过右侧团队计划的“更多 → 恢复正常”返回任务。</small>
        </template>
      </section>
      <form class="task-chat-composer" @submit.prevent="send">
        <textarea v-model="draft" rows="3" :readonly="task.backfillDemoStep >= 1 || statePreview !== 'ready'" :placeholder="task.backfillDemoStep >= 1 ? '' : ''"></textarea>
        <button type="submit" :disabled="task.backfillDemoStep >= 1 || statePreview !== 'ready'">发送</button>
      </form>
    </div>
    <aside v-if="showProjectTools && activePanel" class="task-chat-panel">
      <template v-if="activePanel === 'base'">
        <header class="task-chat-panel__head"><div><strong>任务背景</strong><small>当前任务引用的核心项目共识</small></div><div class="task-chat-panel__head-actions"><button type="button" class="task-chat-panel__close" aria-label="关闭侧边抽屉" @click="activePanel = null">×</button><button type="button" class="task-chat-panel__detail" @click="showBaseEditor = true">背景详情<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1-1-4Z"/></svg></button></div></header>
        <div class="task-chat-panel__base-card"><b>任务背景 v{{ project.snapshot.version }}</b><p>{{ project.snapshot.projectBase }}</p><small>已被 {{ project.tasks.length || 1 }} 个任务引用</small></div>
        <section class="task-chat-panel__section"><span>项目目标</span><p>完成可追溯的任务桥 Demo 主流程，让讨论、执行与经验沉淀形成闭环。</p></section>
        <section class="task-chat-panel__section"><span>阻塞约束</span><p>{{ task.contextConstraints?.[0] || '任务必须具备可验证交付物与验收标准。' }}</p></section>
        <section class="task-chat-panel__section"><span>团队成员</span><div class="task-chat-panel__people"><b>我 <small>项目负责人</small></b><b>产品数字人 <small>调研协作</small></b><b>设计数字人 <small>原型协作</small></b></div></section>
        <section class="task-chat-panel__section"><span>AI 角色</span><div class="task-chat-panel__people"><b>产品数字人 <small>收集证据并形成竞品结论</small></b><b>设计数字人 <small>产出核心流程与异常状态</small></b></div></section>
        <section class="task-chat-panel__section"><span>工作约定</span><p>关键结论保留来源，进入评审后再沉淀。</p></section>
        <section class="task-chat-panel__section"><span>关键决策</span><p>任务创建前必须确认快照；阻塞级约束自动带入。</p></section>
        <section class="task-chat-panel__section"><span>方法论沉淀</span><p>调研先定比较维度，结论必须可回看来源。</p></section>
        <section class="task-chat-panel__section"><span>本次引用</span><p>{{ task.contextMessages?.length ? `已引用 ${task.contextMessages.length} 条创建任务时的消息` : project.snapshot.trigger }}</p></section>
      </template>
      <template v-else>
        <header class="task-chat-panel__head task-chat-panel__head--plan"><div class="team-plan-head__title"><strong>团队计划</strong></div><div class="team-plan-head__actions"><button type="button" class="dashboard-expand team-plan-head__expand" aria-label="展开完整团队计划仪表盘" title="展开仪表盘" @click="openFullDashboard"><span>展开总览</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg></button><button type="button" class="panel-close task-chat-panel__close" aria-label="关闭侧边抽屉" title="关闭" @click="activePanel = null">×</button></div></header>
        <section class="team-dashboard" aria-label="本周团队计划概览">
          <div class="team-dashboard-head"><div><strong>实时任务状态</strong></div><div class="dashboard-head-actions"><div class="dashboard-state-control"><button type="button" class="dashboard-more" aria-label="更多团队计划操作" :aria-expanded="showStatePreviewMenu" @click="showStatePreviewMenu = !showStatePreviewMenu">···</button><div v-if="showStatePreviewMenu" class="dashboard-state-menu"><span>体验状态</span><button type="button" @click="setStatePreview('loading')">加载中</button><button type="button" @click="setStatePreview('error')">加载失败</button><button type="button" @click="setStatePreview('permission')">权限不足</button><button type="button" @click="setStatePreview('ready')">恢复正常</button></div></div></div></div>
          <div class="dashboard-kpis"><div><span>任务</span><strong>{{ dashboardMetrics.total }}</strong></div><div><span>进行中</span><strong>{{ dashboardMetrics.inProgress }}</strong></div><div><span>待验收</span><strong>{{ dashboardMetrics.pendingAcceptance }}</strong></div></div>
          <div class="dashboard-load"><div class="dashboard-section-title"><span>任务闭环进度</span><b>{{ dashboardMetrics.completed }} / {{ dashboardMetrics.total || 0 }}</b></div><div class="dashboard-progress"><span :style="{ width: `${dashboardMetrics.completionRate}%` }"></span></div><div class="dashboard-load-meta"><span>{{ dashboardMetrics.completionRate }}%</span><small>已完成 {{ dashboardMetrics.completed }} · 待开始 {{ dashboardMetrics.notStarted }}</small></div></div>
          <div class="dashboard-attention"><div class="dashboard-section-title"><span>需要关注</span><b>{{ dashboardMetrics.attention }}</b></div><p v-if="dashboardMetrics.pendingAcceptance"><span>!</span>{{ dashboardMetrics.pendingAcceptance }} 个交付物等待验收</p><p v-if="dashboardMetrics.changesRequested"><span>!</span>{{ dashboardMetrics.changesRequested }} 个任务需要补充修改</p><p v-if="!dashboardMetrics.attention" class="is-safe"><span>✓</span>当前没有待处理的验收事项</p></div>
        </section>
        <div v-if="confirmedTasks.length" class="plan-list">
          <article v-for="item in confirmedTasks" :key="item.id" class="plan-item" :class="{ 'is-expanded': expandedPlanTasks.has(item.id) }">
            <button type="button" class="plan-item-toggle" @click="togglePlanTask(item.id)"><span class="plan-item-dot"></span><span class="plan-item-main"><b>{{ item.title }}</b><small>{{ item.owner }} · {{ item.deadline }}</small></span><span class="plan-submit-status" :class="`is-${planStatus(item).tone}`">{{ planStatus(item).label }}</span><span class="plan-item-chevron">{{ expandedPlanTasks.has(item.id) ? '⌃' : '⌄' }}</span></button>
            <div v-if="expandedPlanTasks.has(item.id)" class="plan-item-detail"><p v-if="item.goal"><span>任务目标</span>{{ item.goal }}</p><p v-if="item.deliverable"><span>交付物</span>{{ item.deliverable }}</p><p><span>负责人 / 协作方</span>{{ item.owner }} · {{ item.agent }}</p><p v-if="item.acceptance"><span>验收标准</span>{{ item.acceptance }}</p><div v-if="item.workflowState === 'pending_acceptance'" class="plan-review-actions"><span>接收方验收</span><div><button type="button" @click.stop="reviewBackfill(item.id, 'changes_requested')">退回修改</button><button type="button" class="is-approve" @click.stop="reviewBackfill(item.id, 'accepted')">验收通过</button></div></div></div>
          </article>
        </div>
        <div v-else class="task-chat-panel__empty">还没有已确认任务</div>
      </template>
    </aside>
    <ProjectBaseWorkspace v-if="showBaseEditor" :project="project" :task="task" :full="true" @close="showBaseEditor = false" />
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import ProjectBaseWorkspace from '@/modules/task-bridge/components/ProjectBaseWorkspace.vue'
import ownerAvatar from '@/assets/avatar-wang-jingbo.webp'
import assistantAvatar from '@/assets/soloTeam/default_agent.svg'

const props = defineProps({ project: { type: Object, required: true }, task: { type: Object, required: true } })
const uiStore = useUIStore()
const groupStore = useGroupStore()
const bridgeStore = useTaskBridgeStore()
const draft = ref('')
const taskChatScrollRef = ref(null)
const activePanel = ref(null)
const showBaseEditor = ref(false)
const expandedPlanTasks = ref(new Set())
const statePreview = ref('ready')
const showStatePreviewMenu = ref(false)
const acceptanceChecklist = [
  { id: 'acceptance_01', statement: '覆盖项目讨论生成任务和个人创建任务两条路径' },
  { id: 'acceptance_02', statement: '已定义空状态、错误状态和成功状态' },
  { id: 'acceptance_03', statement: '已通过产品体验评审' },
]
const completionResultMeta = {
  0: { label: '已完成', description: '任务目标和主要交付物均已完成' },
  1: { label: '部分完成', description: '已完成部分内容，仍有明确遗留项' },
  2: { label: '没完成', description: '未形成可验收的有效产出' },
}
const completionResultValue = computed(() => Number(backfill.completionResult ?? 0))
const fieldErrors = reactive({ deliverable: '', completed: '', incomplete: '', incompleteReason: '', blockers: '', nextAction: '' })
const formStatus = reactive({ submitting: false, error: '', retryable: false })
const workflowState = computed(() => props.task.workflowState || (props.task.submitted ? 'pending_acceptance' : 'backfill_editing'))
const workflowMeta = computed(() => ({
  backfill_editing: { label: '待提交', description: '确认本次任务的完成情况，提交后由接收方验收。' },
  submitting: { label: '提交中', description: '正在保存回填内容并同步团队计划。' },
  pending_acceptance: { label: '提交待验收', description: '回填已提交，接收方将按验收标准核对产物。', outcomeTitle: '已提交，等待接收方验收', outcomeDescription: '提交内容已锁定并同步至团队计划。验收结论会在此任务中留痕。' },
  changes_requested: { label: '需修改', description: '接收方已退回，请补充内容后重新提交。', outcomeTitle: '接收方请求补充', outcomeDescription: '请根据验收意见完善产物或说明，再次提交请求验收。' },
  accepted: { label: '已验收', description: '产物已验收通过，等待回填协作背景。', outcomeTitle: '验收通过', outcomeDescription: '产物和完成结论已确认。下一步可将关键结论沉淀到协作背景。' },
  project_backfilled: { label: '已回填', description: '关键结论已同步至协作背景。', outcomeTitle: '已回填协作背景', outcomeDescription: '任务闭环完成，后续创建任务可引用最新的协作背景。' },
}[workflowState.value] || { label: '待提交', description: '确认本次任务的完成情况，提交后由接收方验收。' }))
const canEditBackfill = computed(() => props.task.owner === '我' && !['pending_acceptance', 'accepted', 'project_backfilled'].includes(workflowState.value))
const canSyncBackground = computed(() => props.task.owner === '我')
const isBackfillEditing = computed(() => ['backfill_editing', 'changes_requested', 'submitting'].includes(workflowState.value))
const isReviewOutcome = computed(() => ['pending_acceptance', 'changes_requested', 'accepted', 'project_backfilled'].includes(workflowState.value))
function completionResultInfo(value) {
  return completionResultMeta[Number(value)] || completionResultMeta[0]
}
const editingBackfillArtifact = ref(false)
const backfill = reactive({ completionResult: 0, completed: '', incomplete: '', incompleteReason: '', blockers: '', nextAction: '', deliverable: '', effective: '', issues: '', reusable: '', updateBase: false })
if (props.task.backfill) Object.assign(backfill, props.task.backfill)

watch(() => props.task.id, async () => {
  Object.assign(backfill, { completionResult: 0, completed: '', incomplete: '', incompleteReason: '', blockers: '', nextAction: '', deliverable: '', effective: '', issues: '', reusable: '', updateBase: false }, props.task.backfill || {})
  Object.assign(fieldErrors, { deliverable: '', completed: '', incomplete: '', incompleteReason: '', blockers: '', nextAction: '' })
  Object.assign(formStatus, { submitting: false, error: '', retryable: false })
  editingBackfillArtifact.value = false
  expandedPlanTasks.value = new Set()
  await nextTick()
  taskChatScrollRef.value?.scrollTo({ top: 0, behavior: 'auto' })
}, { immediate: true })
// 个人任务同样需要保留团队计划、任务背景与返回项目入口，避免创建路径导致标题栏操作消失。
const showProjectTools = computed(() => true)
const confirmedTasks = computed(() => props.project.tasks.filter((item) => item.confirmed))
const dashboardMetrics = computed(() => {
  const tasks = confirmedTasks.value
  const stages = tasks.map(taskStage)
  const total = tasks.length
  const completed = stages.filter((stage) => stage === 'completed').length
  const inProgress = stages.filter((stage) => stage === 'in_progress').length
  const pendingAcceptance = stages.filter((stage) => stage === 'pending_acceptance').length
  const changesRequested = stages.filter((stage) => stage === 'changes_requested').length
  return {
    total,
    completed,
    inProgress,
    pendingAcceptance,
    changesRequested,
    notStarted: stages.filter((stage) => stage === 'not_started').length,
    attention: pendingAcceptance + changesRequested,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
  }
})

function taskStage(item) {
  if (['accepted', 'project_backfilled', 'done'].includes(item.workflowState) || item.status === 'done') return 'completed'
  if (item.workflowState === 'changes_requested') return 'changes_requested'
  if (item.workflowState === 'pending_acceptance' || item.submitted) return 'pending_acceptance'
  if (['in_progress', 'backfill', 'backfill_editing', 'submitting'].includes(item.workflowState) || ['in_progress', 'backfill'].includes(item.status)) return 'in_progress'
  return 'not_started'
}

function setStatePreview(nextState) {
  statePreview.value = nextState
  showStatePreviewMenu.value = false
}

function openFullDashboard() {
  activePanel.value = null
  groupStore.setCurrentSpaceId(props.project.id)
  groupStore.currentConversationId = props.project.id
  uiStore.setActiveNavigation('collaboration', props.project.id)
  bridgeStore.requestDashboardOpen(props.project.id)
}

function togglePlanTask(taskId) {
  const next = new Set(expandedPlanTasks.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedPlanTasks.value = next
}

function planStatus(item) {
  const states = {
    pending_acceptance: { label: '提交待验收', tone: 'review' },
    changes_requested: { label: '需修改', tone: 'changes' },
    accepted: { label: '已验收', tone: 'accepted' },
    project_backfilled: { label: '已回填', tone: 'completed' },
  }
  return states[item.workflowState] || { label: item.submitted ? '提交待验收' : '未提交', tone: item.submitted ? 'review' : 'pending' }
}

function clearFieldError(field) {
  if (fieldErrors[field]) fieldErrors[field] = ''
  if (formStatus.error) {
    formStatus.error = ''
    formStatus.retryable = false
  }
}

function removeBackfillArtifact() {
  backfill.deliverable = ''
  editingBackfillArtifact.value = true
  clearFieldError('deliverable')
  ElMessage.info('交付产物已移除，请重新添加后再提交')
}

function validateBackfill() {
  Object.keys(fieldErrors).forEach((key) => { fieldErrors[key] = '' })
  if (!backfill.deliverable.trim()) fieldErrors.deliverable = '请补充至少一个可供验收的交付产物。'
  if (completionResultValue.value === 1) {
    if (!backfill.completed.trim()) fieldErrors.completed = '请说明已完成的内容。'
    if (!backfill.incomplete.trim()) fieldErrors.incomplete = '请说明仍未完成的内容。'
    if (!backfill.nextAction.trim()) fieldErrors.nextAction = '请填写下一步行动，便于接收方判断后续安排。'
  }
  if (completionResultValue.value === 2) {
    if (!backfill.incompleteReason.trim()) fieldErrors.incompleteReason = '请补充未完成原因。'
    if (!backfill.blockers.trim()) fieldErrors.blockers = '请说明当前阻塞事项。'
    if (!backfill.nextAction.trim()) fieldErrors.nextAction = '请填写后续处理方式。'
  }
  return !Object.values(fieldErrors).some(Boolean)
}

if (!props.task.messages.some((message) => message.kind === 'file')) {
  props.task.messages.push({
    id: `task-file-${props.task.id}`,
    type: 'assistant',
    kind: 'file',
    text: '产物已生成，请提交验收。',
    file: { name: `${props.task.title}.md`, type: 'Markdown', version: 'v1', status: '待验收' },
  })
}

if (!props.task.backfillDemoStep) {
  props.task.backfillDemoStep = 0
}

function send() {
  if (props.task.backfillDemoStep >= 1) return
  const text = draft.value.trim()
  const preset = '@团队助理，任务完成，起草回填'
  props.task.messages.push({ id: `personal-task-${Date.now()}`, type: 'user', text: text || preset })
  props.task.messages.push({ id: `personal-task-assistant-${Date.now()}`, type: 'assistant', text: '回填已起草，请确认修改。' })
  props.task.backfillDemoStep = 1
  bridgeStore.prepareBackfill(props.project.id, props.task.id)
  backfill.completed = props.project.backfillDraft || ''
  backfill.deliverable = props.task.deliverable || `${props.task.title}.md`
  backfill.effective = '先明确比较维度，再收集证据并形成结论。'
  backfill.issues = '不同来源的信息口径需要额外核对。'
  backfill.reusable = props.project.echoDraft || ''
  draft.value = ''
}

function saveBackfill() {
  props.task.backfill = { ...backfill }
}

async function submitBackfill() {
  if (formStatus.submitting || !canEditBackfill.value) return
  formStatus.error = ''
  formStatus.retryable = false
  if (!validateBackfill()) {
    formStatus.error = '请完善标记的必填信息后再提交。'
    return
  }
  formStatus.submitting = true
  props.task.workflowState = 'submitting'
  await new Promise((resolve) => window.setTimeout(resolve, 850))
  saveBackfill()
  props.project.backfillDraft = backfill.completed
  props.project.echoDraft = backfill.reusable
  props.task.status = 'backfill'
  const current = bridgeStore.publishBackfill(props.project.id)
  formStatus.submitting = false
  if (!current) {
    props.task.workflowState = 'backfill_editing'
    formStatus.error = '提交未完成，已保留你的填写内容。请检查网络后重新提交。'
    formStatus.retryable = true
    return
  }
  current.echoPublished = true
  current.showPlanAfterBackfill = true
  bridgeStore.openTaskConversation(props.project.id, props.task.id)
  uiStore.setActiveNavigation('collaboration', props.project.id)
  ElMessage.success('回填已提交，团队计划已同步为“提交待验收”')
}

function ignoreBackfill() {
  if (formStatus.submitting) return
  props.task.backfillDemoStep = 0
  props.task.status = 'in_progress'
  props.task.workflowState = 'in_progress'
  ElMessage.info('已忽略本次回填')
}

function resumeBackfill() {
  props.task.workflowState = 'backfill_editing'
  props.task.status = 'backfill'
  props.task.backfillDemoStep = 1
}

function reviewBackfill(taskId, decision) {
  const current = bridgeStore.reviewBackfill(props.project.id, taskId, decision)
  if (!current) return
  ElMessage.success(decision === 'accepted' ? '验收已通过，等待回填协作背景' : '已退回任务负责人补充修改')
}

function syncAcceptedBackfill() {
  const current = bridgeStore.syncAcceptedBackfill(props.project.id, props.task.id)
  if (!current) return
  ElMessage.success(`已回填至协作背景 v${current.snapshot.version}`)
}

function backToProject() {
  bridgeStore.closeTaskConversation(props.project.id)
  uiStore.setActiveNavigation('collaboration', props.project.id)
}
</script>

<style scoped>
.personal-task-chat{flex:1;min-width:0;min-height:0;display:flex;background:#fff;color:#2f3547}.personal-task-chat__main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}.task-chat-header{height:54px;min-height:54px;flex:0 0 54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-sizing:border-box;background:rgba(255,255,255,.78)}.task-chat-header>div:first-child{display:flex;flex-direction:column;gap:4px}.task-chat-header strong{font-size:14px;font-weight:400}.task-chat-header__actions{display:flex;align-items:center;gap:8px}.task-chat-header__actions button{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:7px;padding:6px 9px;background:transparent;color:#697184;cursor:pointer;font-size:12px}.task-chat-header__actions button:hover,.task-chat-header__actions button.active{background:#f4f5f7;color:#2f3547}.task-chat-header__actions svg{opacity:.8}.task-chat-back{margin-left:4px!important;background:#f4f5f7!important}.task-chat-scroll{flex:1;min-height:0;overflow:auto;padding:30px min(12vw,130px);background-image:radial-gradient(circle,rgba(255,151,133,.22) 1px,transparent 1.2px);background-size:18px 18px}.task-origin{max-width:620px;margin:0 auto 26px;padding:11px 13px;border:1px solid #f0dfd6;border-radius:10px;background:#fffaf7;color:#818a98;font-size:12px}.task-chat-message{display:flex;flex-direction:column;gap:6px;max-width:620px;margin:16px auto}.task-chat-message b{font-size:13px}.task-chat-message p{margin:0;padding:11px 13px;border-radius:5px 13px 13px;background:#fff;box-shadow:0 2px 8px rgba(47,53,71,.06);line-height:1.6;font-size:14px}.task-chat-message.is-user{align-items:flex-end}.task-chat-message.is-user p{background:#fff0e9;border-radius:13px 5px 13px 13px}.task-system{align-self:center;color:#a1a8b3;font-size:12px}.task-chat-composer{display:flex;gap:12px;align-items:flex-end;margin:0 28px 22px;padding:12px 14px;border:1px solid #dfe4eb;border-radius:14px;background:#fff;box-shadow:0 7px 20px rgba(69,83,105,.08)}.task-chat-composer textarea{flex:1;resize:none;border:0;outline:0;font:14px/1.5 PingFang SC,sans-serif}.task-chat-composer button{border:0;border-radius:8px;padding:8px 14px;background:#ff621f;color:#fff;cursor:pointer}.task-chat-composer button:disabled{opacity:.4;cursor:not-allowed}
.task-file-card{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e5e8ed;border-radius:10px;background:#fff}.task-file-icon{display:grid;place-items:center;width:32px;height:38px;border-radius:7px;background:#d9f5f1;color:#1eaaa0;font-weight:800}.task-file-card>div{display:flex;flex:1;flex-direction:column;gap:4px}.task-file-card strong{font-size:13px}.task-file-card small{color:#8b93a0;font-size:11px}.task-file-card button{border:0;border-radius:7px;padding:6px 9px;background:#fff0e9;color:#d75c2c;font-size:11px;cursor:pointer}.task-backfill-card{max-width:680px;margin:20px auto;padding:16px;border:1px solid #dce6f4;border-radius:12px;background:#f5f9ff;box-shadow:0 6px 18px rgba(63,95,135,.08)}.task-backfill-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.task-backfill-card header div{display:flex;flex-direction:column;gap:4px}.task-backfill-card header span{color:#4f82c7;font-size:11px}.task-backfill-card header strong{font-size:16px}.task-backfill-card header em{padding:4px 7px;border-radius:5px;background:#e6f0ff;color:#4c81c8;font-size:10px;font-style:normal}.task-backfill-intro{color:#64748b;font-size:12px;line-height:1.5}.task-backfill-card label{display:flex;flex-direction:column;gap:5px;margin-top:10px;color:#667085;font-size:11px}.task-backfill-card textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-card textarea:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}.task-backfill-check{flex-direction:row!important;align-items:center;gap:7px!important}.task-backfill-check input{accent-color:#4f82c7}.task-backfill-card footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.task-backfill-card footer button{border:1px solid #dce4ef;border-radius:7px;padding:7px 11px;background:#fff;color:#657080;cursor:pointer;font-size:11px}.task-backfill-card footer .task-backfill-primary{border-color:#4f82c7;background:#4f82c7;color:#fff}

/* 与协作对话统一：头像、角色名与左右气泡 */
.bridge-message { display: flex; gap: 10px; max-width: 720px; margin: 18px auto; }
.bridge-message.is-user { flex-direction: row-reverse; }
.message-avatar { width: 30px; height: 30px; overflow: hidden; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: #eee8ff; color: #7257d9; font-size: 12px; font-weight: 700; }
.message-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.message-content { min-width: 0; }
.message-content strong { font-size: 13px; }
.message-content p { margin: 5px 0 0; padding: 10px 12px; border-radius: 4px 12px 12px 12px; background: rgba(255,255,255,.9); line-height: 1.65; font-size: 13px; box-shadow: 0 1px 5px rgba(47,53,71,.05); white-space: pre-wrap; }
.bridge-message.is-user .message-content p { border-radius: 12px 4px 12px 12px; background: #fff0e9; }
.system-event { margin: 0 auto 12px; text-align: center; color: #a0a6b2; font-size: 12px; }
 .task-backfill-artifact-field{gap:6px!important}.task-backfill-artifact{display:flex;align-items:center;gap:8px}.task-backfill-artifact-file{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:9px 10px;border:1px solid #dce4ef;border-radius:8px;background:#fff}.task-backfill-artifact-file>div{display:flex;flex-direction:column;gap:3px;min-width:0}.task-backfill-artifact-file strong{overflow:hidden;color:#303746;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.task-backfill-artifact-file small{color:#98a0ad;font-size:10px}.task-backfill-artifact-edit{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid #dce4ef;border-radius:7px;background:#fff;color:#657080;cursor:pointer}.task-backfill-artifact-edit:hover{border-color:#7ca8df;color:#4f82c7;background:#f7fbff}.task-backfill-artifact-field>input{box-sizing:border-box;width:100%;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-artifact-field>input:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}
.task-chat-panel{width:330px;flex:0 0 330px;align-self:stretch;box-sizing:border-box;overflow:auto;border-left:1px solid #eaecf0;background:#fff;padding:18px 16px;animation:task-chat-panel-in .24s cubic-bezier(.22,1,.36,1) both}.task-chat-panel__head{display:flex;justify-content:space-between;gap:10px;padding-bottom:13px;border-bottom:1px solid #eef0f2}.task-chat-panel__head>div:first-child{display:flex;flex-direction:column;gap:4px}.task-chat-panel__head strong{font-size:15px}.task-chat-panel__head small{color:#9299a6;font-size:11px;line-height:1.4}.task-chat-panel__head-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px}.task-chat-panel__close{width:24px;height:24px;display:inline-grid;place-items:center;padding:0;border:0;border-radius:6px;background:transparent;color:#9aa1ad;font-size:20px;line-height:1;cursor:pointer}.task-chat-panel__close:hover{background:#f1f3f5;color:#2f3547}.task-chat-panel__detail{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:transparent;color:#64748b;font-size:12px;cursor:pointer}.task-chat-panel__detail:hover{color:#ff621f}.task-chat-panel__head--plan{border-bottom:0}.task-chat-panel__base-card{margin:13px 0;padding:10px;border-radius:9px;background:#fff8f4;color:#6f7683;font-size:12px;line-height:1.55}.task-chat-panel__base-card b{color:#ff621f;font-size:12px}.task-chat-panel__base-card p{margin:6px 0}.task-chat-panel__base-card small{color:#959ca8}.task-chat-panel__section{padding:13px 0;border-bottom:1px solid #eef0f3}.task-chat-panel__section>span{display:block;margin-bottom:5px;color:#8e97a5;font-size:11px}.task-chat-panel__section p{margin:0;color:#535d6c;font-size:12px;line-height:1.55}.task-chat-panel__empty{padding:30px 12px;color:#a0a6b1;text-align:center;font-size:12px}.team-dashboard{margin:12px 0 14px;padding:13px;border:1px solid #edf0f4;border-radius:12px;background:linear-gradient(145deg,#fff 0%,#fcfcfd 100%);box-shadow:0 5px 16px rgba(47,53,71,.05)}.team-dashboard-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:11px}.team-dashboard-head div{display:flex;align-items:baseline;gap:7px}.team-dashboard-head strong{color:#303746;font-size:13px}.team-dashboard-head span{color:#9299a6;font-size:10px}.dashboard-more{width:28px;height:24px;margin-top:-3px;padding:0;border:0;border-radius:6px;background:transparent;color:#8d96a5;font-size:16px;line-height:1;letter-spacing:1px;cursor:pointer}.dashboard-kpis{display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden;border:1px solid #edf0f4;border-radius:9px;background:#fff}.dashboard-kpis div{display:flex;flex-direction:column;gap:4px;padding:9px 8px;border-right:1px solid #edf0f4}.dashboard-kpis div:last-child{border-right:0}.dashboard-kpis span,.dashboard-section-title span{color:#8d96a5;font-size:10px}.dashboard-kpis strong{color:#303746;font-size:17px;font-weight:650}.dashboard-load{padding:12px 0 10px}.dashboard-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.dashboard-section-title b{color:#596273;font-size:10px}.dashboard-progress{height:7px;overflow:hidden;border-radius:999px;background:#eef1f4}.dashboard-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff9a73,#ff621f)}.dashboard-load-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.dashboard-load-meta span{color:#ff621f;font-size:11px;font-weight:650}.dashboard-load-meta small{color:#9299a6;font-size:9px}.dashboard-attention{padding:11px 0 0}.dashboard-attention p{display:flex;gap:6px;margin:6px 0;color:#596273;font-size:10px;line-height:1.35}.dashboard-attention p span{color:#e78b60}.plan-list{display:flex;flex-direction:column}.plan-item{display:block;padding:0;border-bottom:1px solid #f0f1f3}.plan-item-toggle{display:flex;align-items:center;width:100%;gap:9px;padding:12px 0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.plan-item-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#ff8b4d}.plan-item-main{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.plan-item-main b{font-size:13px}.plan-item-main small{color:#949ba7;font-size:11px}.plan-submit-status{flex:0 0 auto;padding:3px 6px;border-radius:5px;font-size:10px}.plan-submit-status.is-submitted{background:#eaf7ef;color:#2c965d}.plan-submit-status.is-pending{background:#f1f2f4;color:#89919d}.plan-item-chevron{width:16px;color:#8f97a5;text-align:center;font-size:14px}.plan-item-detail{display:flex;flex-direction:column;gap:7px;margin:0 0 10px 17px;padding:10px 11px;border:1px solid #eceef2;border-radius:8px;background:#fafbfc;color:#586272;font-size:11px;line-height:1.5}.plan-item-detail p{margin:0}.plan-item-detail p span{display:block;margin-bottom:2px;color:#9aa1ad;font-size:10px}.plan-item.is-expanded .plan-item-toggle{color:#303746}@keyframes task-chat-panel-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
.task-backfill-card{max-width:560px!important;margin:20px auto!important;padding:0!important;border:1px solid #e7ebef!important;border-radius:12px!important;background:#fff!important;box-shadow:0 12px 30px rgba(20,30,45,.12)!important;overflow:hidden}.backfill-card-header{background:#fff!important;padding:20px 24px!important;border-bottom:1px solid #e7ebef}.backfill-card-header strong{color:#273142!important;font-size:17px!important}.backfill-card-header small{color:#7d8794;font-size:11px;line-height:1.45}.backfill-card-header em{background:#eef2ff!important;color:#3157d5!important;border-radius:999px!important}.backfill-section{padding:20px 24px;border-bottom:1px solid #e7ebef}.backfill-summary{display:flex;flex-direction:column;gap:5px}.backfill-summary strong{color:#303746;font-size:14px}.backfill-summary small{color:#8b94a1;font-size:11px}.backfill-section-label{display:flex;align-items:center;gap:6px;margin-bottom:9px;color:#667180;font-size:11px;font-weight:650}.backfill-section-label b{color:#d85e4d;font-size:10px}.backfill-section-label small{color:#9aa3ad;font-weight:400}.backfill-field{display:flex!important;flex-direction:column;gap:5px;margin:0 0 14px!important}.backfill-field:last-child{margin-bottom:0!important}.backfill-field textarea,.backfill-inline-input{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dfe4e9;border-radius:8px;padding:9px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.backfill-field textarea:focus,.backfill-inline-input:focus{border-color:#3157d5;box-shadow:0 0 0 3px #eef2ff}.backfill-inline-input{margin-top:8px}.backfill-checklist{background:#fbfcfd}.backfill-checklist label{display:flex!important;align-items:flex-start;gap:8px;margin:10px 0 0!important;color:#505b6b;font-size:11px;line-height:1.45}.backfill-checklist input{margin:1px 0 0;accent-color:#3157d5}.backfill-checklist label em{margin-left:auto;padding:2px 6px;border-radius:999px;background:#f0f2f5;color:#8b94a0;font-size:9px;font-style:normal;white-space:nowrap}.backfill-card-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px!important;background:#fff}.backfill-card-footer button{padding:8px 12px!important;border-radius:8px!important;font-size:11px!important;cursor:pointer}.backfill-secondary{border:1px solid #dfe4e9!important;background:#fff!important;color:#5e6875!important}.backfill-primary{border:1px solid #3157d5!important;background:#3157d5!important;color:#fff!important;box-shadow:0 4px 10px rgba(49,87,213,.18)}
.completion-result{display:flex;flex-direction:column}.completion-result-labels{display:grid;grid-template-columns:repeat(3,1fr);color:#5e6875;text-align:center;font-size:11px}.completion-result-range{width:100%;height:22px;margin:2px 0 5px;appearance:none;background:transparent;cursor:pointer}.completion-result-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:#d8dee8}.completion-result-range::-webkit-slider-thumb{width:14px;height:14px;margin-top:-5px;appearance:none;border:3px solid #3157d5;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(49,87,213,.25)}.completion-result-current{display:flex;flex-direction:column;gap:4px;margin-top:3px;padding:10px 12px;border-radius:8px;background:#f7f8fa}.completion-result-current strong{color:#303746;font-size:12px}.completion-result-current span{color:#7d8794;font-size:11px}.completion-result-fields{margin-top:12px;padding-top:12px;border-top:1px solid #edf0f3}.completion-result-fields .backfill-field span{color:#667180;font-size:11px}
.completion-result-range::-webkit-slider-runnable-track{background:linear-gradient(to right,#ff7747 0 var(--completion-progress),#d8dee8 var(--completion-progress) 100%)}.completion-result-range::-webkit-slider-thumb{width:16px;height:16px;margin-top:-6px;border:3px solid #ff7747;box-shadow:0 2px 8px rgba(255,119,71,.25);transition:transform .18s ease,box-shadow .18s ease}.completion-result-range:hover::-webkit-slider-thumb{transform:scale(1.12);box-shadow:0 3px 10px rgba(255,119,71,.32)}.completion-result-range:focus-visible{outline:2px solid #ffb092;outline-offset:3px}
.completion-result-labels button{border:0;background:transparent;color:#7d8794;font:inherit;cursor:pointer;transition:color .18s ease,transform .18s ease}.completion-result-labels button:hover,.completion-result-labels button.active{color:#ff7747;font-weight:700}.completion-result-labels button.active{transform:translateY(-1px)}.completion-result-current.is-result-0{background:#fff7f3}.completion-result-current.is-result-1{background:#fff9ed}.completion-result-current.is-result-2{background:#fff3f1}.completion-result-current.is-result-0 strong{color:#e7623b}.completion-result-current.is-result-1 strong{color:#b87816}.completion-result-current.is-result-2 strong{color:#c85246}
.task-backfill-card{background:#fffaf7!important;border-color:#f0ddd5!important;box-shadow:0 12px 30px rgba(184,96,58,.10)!important}
.task-backfill-card .backfill-card-header,.task-backfill-card .backfill-section,.task-backfill-card .backfill-card-footer{background:transparent!important}
.task-backfill-card .backfill-checklist{background:rgba(255,255,255,.46)!important}
.task-backfill-card .completion-result-current{background:rgba(255,255,255,.58)}
.task-backfill-card{max-width:620px!important;margin:24px auto!important;padding:0!important;overflow:hidden;border:1px solid #f0ddd5!important;border-radius:16px!important;background:#fffaf7!important;box-shadow:0 14px 32px rgba(145,81,48,.12)!important;color:#313744}
.task-backfill-card .backfill-card-header{padding:24px 26px 18px!important;background:transparent!important;border:0!important}.backfill-card-kicker{display:flex;align-items:center;gap:8px;margin-bottom:10px}.backfill-card-kicker span{color:#d85c32!important;font-size:11px!important;font-weight:750;letter-spacing:.04em}.backfill-card-kicker em{padding:3px 7px!important;border-radius:999px!important;background:#ffe9df!important;color:#b84b27!important;font-size:10px!important;font-style:normal}.backfill-card-header strong{color:#2e3542!important;font-size:18px!important;letter-spacing:-.02em}.backfill-card-header small{margin-top:5px;color:#737d8c!important;font-size:12px!important;line-height:1.55}
.backfill-context{display:flex;flex-direction:column;gap:4px;margin:0 26px;padding:13px 15px;border:1px solid #f1dfd7;border-radius:10px;background:rgba(255,255,255,.52)}.backfill-context>span{color:#8f776d;font-size:10px;font-weight:700}.backfill-context strong{overflow:hidden;color:#3b414c;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.backfill-context small{color:#8a929e;font-size:10px}
.task-backfill-card .backfill-section{padding:22px 26px!important;background:transparent!important;border:0!important}.backfill-deliverable{padding-bottom:16px!important}.backfill-decision{padding-top:16px!important;border-top:1px solid #f1e3dc!important}.backfill-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.backfill-section-heading>div{display:flex;flex-direction:column;gap:3px}.backfill-section-heading small{color:#8a929e;font-size:10px;line-height:1.4}.backfill-section-heading>strong{padding-top:2px;color:#a7664e;font-size:10px;font-weight:650;white-space:nowrap}.backfill-section-label{margin:0!important;color:#4e5663!important;font-size:12px!important;font-weight:720!important}.backfill-section-label b{margin-left:2px;color:#d85c32!important;font-size:10px!important}
.task-backfill-artifact{gap:9px!important}.task-backfill-artifact-file{padding:11px 12px!important;border-color:#eadfd9!important;border-radius:10px!important;background:rgba(255,255,255,.76)!important}.task-backfill-artifact-edit{width:36px!important;height:36px!important;flex-basis:36px!important;border-color:#e8d9d1!important;border-radius:9px!important;background:rgba(255,255,255,.7)!important;color:#7b6970!important}.task-backfill-artifact-edit:hover{border-color:#e88b66!important;background:#fff1ea!important;color:#d85c32!important}.backfill-inline-input,.backfill-field textarea{border-color:#e5d9d2!important;border-radius:9px!important;background:rgba(255,255,255,.84)!important;color:#373e4a!important}.backfill-inline-input:focus,.backfill-field textarea:focus{border-color:#e88059!important;box-shadow:0 0 0 3px rgba(232,128,89,.14)!important}
.completion-result-labels{position:relative;z-index:1;gap:8px;margin-bottom:-2px}.completion-result-labels button{min-height:30px;border-radius:7px!important;color:#7a838f!important;font-size:12px!important}.completion-result-labels button.active{color:#cc542e!important;background:#fff0e9!important;transform:none!important}.completion-result-range{position:relative;z-index:0;height:28px!important;margin:-1px 0 7px!important}.completion-result-range::-webkit-slider-runnable-track{height:3px!important;background:linear-gradient(to right,#ee734b 0 var(--completion-progress),#eadcd4 var(--completion-progress) 100%)!important}.completion-result-range::-webkit-slider-thumb{width:15px!important;height:15px!important;margin-top:-6px!important;border-color:#ee734b!important;background:#fffaf7!important;box-shadow:0 1px 5px rgba(188,84,47,.24)!important}.completion-result-current{gap:3px!important;margin-top:0!important;padding:12px 14px!important;border:1px solid transparent;border-radius:10px!important;background:rgba(255,255,255,.55)!important}.completion-result-current strong{font-size:13px!important}.completion-result-current span{font-size:11px!important;line-height:1.45}.completion-result-current.is-result-0{border-color:#f5d6c9!important;background:#fff3ed!important}.completion-result-current.is-result-1{border-color:#f0dfb7!important;background:#fff9ec!important}.completion-result-current.is-result-2{border-color:#f0d2cd!important;background:#fff3f1!important}.completion-result-fields{margin-top:14px!important;padding-top:14px!important;border-top-color:#f0e4df!important}.backfill-field{gap:6px!important;margin:0 0 13px!important}.backfill-field span{color:#596271!important;font-size:11px!important;font-weight:650}
.backfill-extra{margin:0 26px;border-top:1px solid #f1e3dc}.backfill-extra summary{display:flex;align-items:center;justify-content:space-between;padding:16px 0;color:#606977;font-size:12px;font-weight:650;cursor:pointer;list-style:none}.backfill-extra summary::-webkit-details-marker{display:none}.backfill-extra summary::after{content:'⌄';margin-left:7px;color:#a47c6d;font-size:15px;line-height:1}.backfill-extra[open] summary::after{transform:rotate(180deg)}.backfill-extra summary span{margin-left:auto;color:#989fa9;font-size:10px;font-weight:400}.backfill-extra>div{padding:0 0 3px}.task-backfill-card .backfill-checklist{margin-top:6px;padding-top:18px!important;padding-bottom:19px!important;background:rgba(255,255,255,.38)!important;border-top:1px solid #f1e3dc!important}.backfill-checklist label{gap:9px!important;margin:9px 0 0!important;color:#5d6674!important;font-size:11px!important}.backfill-checklist input{accent-color:#e46d46!important}.backfill-checklist label::after{content:'待确认';margin-left:auto;color:#999fa8;font-size:10px;white-space:nowrap}
.task-backfill-card .backfill-card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 26px!important;background:rgba(248,236,229,.66)!important;border-top:1px solid #efded6!important}.backfill-card-footer>span{color:#858d98;font-size:10px}.backfill-card-footer>div{display:flex;gap:8px}.backfill-card-footer button{min-height:34px!important;padding:7px 12px!important;border-radius:8px!important;font-size:11px!important;font-weight:650;white-space:nowrap}.backfill-secondary{border-color:#e2d4cc!important;background:rgba(255,255,255,.72)!important;color:#66707d!important}.backfill-primary{border-color:#e06439!important;background:#e06439!important;color:#fff!important;box-shadow:0 5px 12px rgba(206,83,43,.2)!important}.backfill-card-footer button:hover{transform:translateY(-1px)}.backfill-card-footer button:active{transform:translateY(0) scale(.98)}.backfill-card-footer button:focus-visible,.completion-result-labels button:focus-visible,.backfill-extra summary:focus-visible{outline:2px solid #e88059;outline-offset:2px}
@media (max-width:640px){.task-backfill-card{margin:18px 0!important;border-radius:14px!important}.task-backfill-card .backfill-card-header,.task-backfill-card .backfill-section{padding-left:18px!important;padding-right:18px!important}.backfill-context,.backfill-extra{margin-left:18px;margin-right:18px}.task-backfill-card .backfill-card-footer{align-items:flex-start;flex-direction:column;padding:14px 18px!important}.backfill-card-footer>div{width:100%}.backfill-card-footer button{flex:1}.backfill-context strong{white-space:normal}.completion-result-labels{gap:3px}.completion-result-labels button{font-size:11px!important}}
.task-backfill-card{background:#fff!important}.backfill-card-kicker{flex-direction:row!important}.backfill-card-kicker strong{color:#2e3542!important;font-size:19px!important;font-weight:720!important;letter-spacing:-.025em}.backfill-context{background:#fff!important}.task-backfill-card .backfill-checklist,.task-backfill-card .backfill-card-footer{background:#fff!important}.backfill-extra{border-top:0!important}.backfill-extra summary::marker{content:''}.backfill-extra summary{flex-direction:row!important}.backfill-checklist label{display:grid!important;grid-template-columns:16px minmax(0,1fr) auto;align-items:center!important}.backfill-checklist input{margin:0!important}.backfill-checklist label>span{min-width:0}.backfill-checklist label::after{align-self:center}
.task-backfill-card .backfill-card-header{padding-top:20px!important;padding-bottom:14px!important}.backfill-card-header small{margin-top:12px!important}.backfill-context{margin-bottom:0!important;padding-top:12px!important;padding-bottom:12px!important}.task-backfill-card .backfill-section{padding-top:16px!important;padding-bottom:16px!important}.backfill-deliverable{padding-bottom:12px!important}.backfill-decision{padding-top:12px!important}.backfill-extra summary{padding-top:12px!important;padding-bottom:12px!important}.task-backfill-card .backfill-checklist{padding-top:14px!important;padding-bottom:14px!important}
.plan-submit-status.is-review{background:#fff0e9;color:#d85c32}
.completion-result-labels button.active{color:#111!important;background:transparent!important}.completion-result-range{height:44px!important;margin:6px 0 10px!important;padding:2px 9px;box-sizing:border-box;border:1px solid #e5e6e8;border-radius:999px;background:#f4f5f6!important}.completion-result-range::-webkit-slider-runnable-track{height:38px!important;border-radius:999px;background:linear-gradient(to right,#050505 0 var(--completion-progress),#f4f5f6 var(--completion-progress) 100%)!important}.completion-result-range::-webkit-slider-thumb{width:38px!important;height:38px!important;margin-top:0!important;border:3px solid #050505!important;border-radius:50%!important;background:#fff!important;box-shadow:0 1px 2px rgba(0,0,0,.16)!important}.completion-result-range::-moz-range-track{height:38px;border-radius:999px;background:#f4f5f6}.completion-result-range::-moz-range-progress{height:38px;border-radius:999px;background:#050505}.completion-result-range::-moz-range-thumb{width:32px;height:32px;border:3px solid #050505;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.16)}.completion-result-range:focus-visible{outline:2px solid #111;outline-offset:3px}
.completion-result-control{position:relative;height:44px;margin:6px 0 10px;padding:2px 9px;box-sizing:border-box;overflow:hidden;border:1px solid #e5e6e8;border-radius:999px;background:#f4f5f6}.completion-result-control::before{content:'';position:absolute;inset:2px auto 2px 9px;width:var(--completion-progress);border-radius:999px;background:#050505}.completion-result-control::after{content:'';position:absolute;z-index:1;top:3px;left:var(--completion-progress);width:38px;height:38px;box-sizing:border-box;border:3px solid #050505;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.16);transform:translateX(-50%)}.completion-result-control-label{position:absolute;z-index:1;top:50%;left:calc(var(--completion-progress) / 2);transform:translate(-50%,-50%);color:#fff;font-size:12px;font-weight:700;line-height:1;white-space:nowrap;pointer-events:none}.completion-result-control:focus-within{outline:2px solid #111;outline-offset:3px}.completion-result-control .completion-result-range{position:absolute;inset:0;z-index:2;width:100%;height:100%!important;margin:0!important;padding:0!important;border:0;background:transparent!important;opacity:0;cursor:pointer}.completion-result-control .completion-result-range::-webkit-slider-runnable-track,.completion-result-control .completion-result-range::-moz-range-track{background:transparent!important}.completion-result-control .completion-result-range::-webkit-slider-thumb,.completion-result-control .completion-result-range::-moz-range-thumb{opacity:0}
.completion-result{position:relative}.completion-result-labels{display:grid!important;grid-template-columns:repeat(3,1fr);gap:3px!important;margin:0!important;padding:3px;border:1px solid #e5e6e8;border-radius:11px;background:#f3f4f5}.completion-result-labels button{min-height:36px!important;border-radius:8px!important;color:#737983!important;font-size:12px!important;font-weight:600!important}.completion-result-labels button:hover{color:#111!important;background:#e9eaec!important}.completion-result-labels button.active{color:#fff!important;background:#111!important;box-shadow:0 2px 5px rgba(0,0,0,.12)!important}.completion-result-control{height:1px!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;background:transparent!important;outline:0!important}.completion-result-control::before,.completion-result-control::after,.completion-result-control-label{display:none!important}.completion-result-control .completion-result-range{position:absolute;top:-42px;left:0;width:100%;height:40px!important;opacity:0;pointer-events:none}.completion-result-control:focus-within{outline:2px solid #111;outline-offset:3px}.completion-result-current{margin-top:14px!important;border-color:#e8e9eb!important;background:#fafafa!important}.completion-result-current.is-result-0,.completion-result-current.is-result-1,.completion-result-current.is-result-2{border-color:#e8e9eb!important;background:#fafafa!important}.completion-result-current.is-result-0 strong,.completion-result-current.is-result-1 strong,.completion-result-current.is-result-2 strong{color:#20242b!important}
.completion-result-labels button.active{background:#ff621f!important;box-shadow:0 2px 6px rgba(255,98,31,.22)!important}
.task-backfill-card .backfill-card-footer{justify-content:flex-end!important}.backfill-card-footer>div{display:flex!important;margin-left:auto}
.backfill-permission,.backfill-feedback,.backfill-outcome{display:flex;flex-direction:column;gap:6px;margin:0 26px 14px;padding:12px 14px;border:1px solid;border-radius:10px;font-size:12px;line-height:1.5}.backfill-permission{border-color:#f0d7a6;background:#fff9ea;color:#82611f}.backfill-permission strong{color:#6f5016}.backfill-feedback{flex-direction:row;align-items:center;justify-content:space-between}.backfill-feedback.is-error{border-color:#f1c9c4;background:#fff5f4;color:#b8473f}.backfill-feedback.is-error button{border:0;background:transparent;color:#b8473f;font-weight:700;cursor:pointer;text-decoration:underline}.backfill-feedback.is-loading{border-color:#cadcf7;background:#f5f9ff;color:#3a68a7}.backfill-feedback i{width:14px;height:14px;border:2px solid #a7c2e8;border-top-color:#3a68a7;border-radius:50%;animation:backfill-spin .7s linear infinite}.backfill-outcome{margin-bottom:0}.backfill-outcome.is-pending_acceptance{border-color:#f1d2c5;background:#fff8f4;color:#92563e}.backfill-outcome.is-changes_requested{border-color:#f2c7c2;background:#fff5f4;color:#ab4c42}.backfill-outcome.is-accepted,.backfill-outcome.is-project_backfilled{border-color:#cbe7d7;background:#f3fbf6;color:#28764b}.backfill-outcome strong{font-size:13px;color:inherit}.backfill-outcome button{align-self:flex-start;margin-top:4px;border:1px solid currentColor;border-radius:7px;padding:7px 10px;background:#fff;color:inherit;font:650 11px/1 PingFang SC,sans-serif;cursor:pointer}.task-backfill-artifact-field.has-error .task-backfill-artifact-file,.backfill-field.has-error textarea{border-color:#df665c!important}.backfill-field-error{display:block!important;color:#c95149!important;font-size:10px!important;font-weight:500!important}.task-backfill-artifact-file.is-empty{border-style:dashed!important;background:#fffaf8!important}.task-backfill-artifact-edit:disabled,.backfill-field textarea:disabled,.backfill-inline-input:disabled,.completion-result-labels button:disabled,.backfill-card-footer button:disabled{opacity:.52;cursor:not-allowed!important}.completion-result-labels button:focus-visible,.task-backfill-artifact-edit:focus-visible,.backfill-card-footer button:focus-visible,.plan-review-actions button:focus-visible{outline:2px solid #3157d5;outline-offset:2px}.backfill-checklist p{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;margin:10px 0 0;color:#5d6674;font-size:11px;line-height:1.45}.backfill-checklist p i{display:grid;place-items:center;width:14px;height:14px;border:1px solid #c7cdd5;border-radius:50%;color:#9aa1ad;font-size:9px;font-style:normal}.backfill-checklist p em{color:#999fa8;font-size:10px;font-style:normal;white-space:nowrap}.plan-submit-status.is-review{background:#fff0e9;color:#d85c32}.plan-submit-status.is-changes{background:#fff0ef;color:#bd5349}.plan-submit-status.is-accepted,.plan-submit-status.is-completed{background:#eaf7ef;color:#2c965d}.plan-review-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid #e9edf1}.plan-review-actions>span{color:#8d96a5;font-size:10px}.plan-review-actions>div{display:flex;gap:6px}.plan-review-actions button{border:1px solid #e2c8c1;border-radius:6px;padding:5px 7px;background:#fff;color:#a65348;font-size:10px;cursor:pointer}.plan-review-actions button.is-approve{border-color:#bde0ca;background:#eff9f2;color:#28764b}@keyframes backfill-spin{to{transform:rotate(1turn)}}
.task-backfill-artifact-actions{display:flex;gap:6px}.task-backfill-artifact-remove{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid #efcfca;border-radius:7px;background:#fff;color:#b7564b;font-size:17px;line-height:1;cursor:pointer}.task-backfill-artifact-remove:hover{border-color:#d9675c;background:#fff5f4}.task-backfill-artifact-remove:disabled{opacity:.52;cursor:not-allowed}
.task-chat-state{display:flex;flex:1;min-height:0;box-sizing:border-box;align-items:center;justify-content:center;flex-direction:column;padding:44px 24px;background-image:radial-gradient(circle,rgba(255,151,133,.22) 1px,transparent 1.2px);background-size:18px 18px;color:#697485;text-align:center}.task-chat-state strong{margin-top:14px;color:#303746;font-size:15px;font-weight:680}.task-chat-state p{max-width:330px;margin:8px 0 0;color:#8993a1;font-size:12px;line-height:1.65}.task-chat-state small{max-width:330px;margin-top:14px;color:#9aa3af;font-size:11px;line-height:1.55}.task-chat-state__mark{display:grid;place-items:center;width:46px;height:46px;border:1px solid #dfe5ed;border-radius:15px;background:#f8fafc;color:#64748b;font-size:23px;font-weight:700;box-shadow:0 6px 18px rgba(34,48,68,.05)}.task-chat-state.is-error .task-chat-state__mark{border-color:#f0cbc7;background:#fff6f5;color:#c15b52}.task-chat-state.is-permission .task-chat-state__mark{border-color:#f0dcae;background:#fffaf0;color:#aa7a28}.task-chat-state__mark:has(i){display:flex;gap:4px;align-items:center;justify-content:center}.task-chat-state__mark i{display:block;width:4px;height:4px;border-radius:50%;background:currentColor;animation:task-chat-state-pulse 1s ease-in-out infinite}.task-chat-state__mark i:nth-child(2){animation-delay:.14s}.task-chat-state__mark i:nth-child(3){animation-delay:.28s}.task-chat-state__skeleton{display:grid;width:min(100%,410px);gap:9px;margin-top:24px}.task-chat-state__skeleton span{display:block;height:11px;border-radius:999px;background:linear-gradient(90deg,#eef2f6 25%,#f8fafc 38%,#eef2f6 63%);background-size:400% 100%;animation:task-chat-state-shimmer 1.25s ease-in-out infinite}.task-chat-state__skeleton span:nth-child(2){width:82%}.task-chat-state__skeleton span:nth-child(3){width:63%}.dashboard-state-control{position:relative}.dashboard-state-menu{position:absolute;z-index:30;top:28px;right:0;display:flex!important;width:122px;flex-direction:column!important;align-items:stretch!important;gap:0!important;overflow:hidden;border:1px solid #e5e9ef;border-radius:9px;background:#fff;box-shadow:0 10px 24px rgba(30,43,61,.14)}.dashboard-state-menu>span{display:block;padding:9px 10px 6px;color:#9aa3af;font-size:10px}.dashboard-state-menu button{border:0;padding:8px 10px;background:#fff;color:#596473;font:12px/1.2 PingFang SC,sans-serif;text-align:left;cursor:pointer}.dashboard-state-menu button:hover{background:#f5f7fa;color:#303746}.dashboard-state-menu button:last-child{margin-top:3px;border-top:1px solid #edf0f3;color:#708094}@keyframes task-chat-state-pulse{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-3px);opacity:1}}@keyframes task-chat-state-shimmer{to{background-position:-135% 0}}@media (prefers-reduced-motion:reduce){.task-chat-state__mark i,.task-chat-state__skeleton span{animation:none}}
.personal-task-chat{position:relative}.task-chat-panel{width:clamp(320px,31vw,380px);flex:0 0 clamp(320px,31vw,380px);scrollbar-gutter:stable}.task-chat-panel__head{position:sticky;z-index:2;top:-18px;margin:0 -16px;padding:18px 16px 13px;background:#fff}.task-chat-panel__head-actions{flex-direction:row;gap:6px}.task-chat-panel__people{display:flex;flex-direction:column;gap:8px}.task-chat-panel__people b{display:flex;align-items:baseline;justify-content:space-between;gap:10px;color:#4b5564;font-size:12px;font-weight:600}.task-chat-panel__people small{color:#8d96a5;font-size:10px;font-weight:400;line-height:1.4;text-align:right}@media (max-width:760px){.personal-task-chat{min-width:0}.task-chat-panel{position:absolute;z-index:20;inset:0;width:auto;min-width:0;flex:none;border-left:0;box-shadow:-10px 0 26px rgba(36,45,59,.12)}.task-chat-panel__head{top:-18px}.task-chat-header__actions{gap:2px}.task-chat-header__actions button{padding:6px}.task-chat-header__actions button svg{display:none}.task-chat-back{margin-left:0!important}}
.task-chat-header { box-sizing: border-box; min-height: 50px; height: 50px; flex: 0 0 50px; padding: 0 20px; border-bottom: 1px solid rgba(229,230,235,.9); background: #fff; }
.task-chat-header > div:first-child { display: flex; align-items: center; flex-direction: row; gap: 9px; }
.task-chat-header > .bridge-title { color: #2f3547; font-size: 15px; font-weight: 650; }
.task-chat-header > .bridge-title span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-chat-header__actions { display: flex; align-items: center; gap: 8px; }
.task-chat-header__actions button { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 7px; padding: 6px 9px; background: transparent; color: #697184; cursor: pointer; font-size: 12px; font-weight: 400; }
.task-chat-header__actions button:hover, .task-chat-header__actions button.active { background: #f4f5f7; color: #2f3547; }
.task-chat-header__actions button svg { flex: 0 0 auto; opacity: .8; }
.task-chat-header__actions .task-chat-back { margin-left: 0 !important; background: transparent !important; }
.task-chat-panel__head--plan { position: sticky; top: -18px; z-index: 3; display: flex; align-items: center; justify-content: space-between; min-height: 50px; height: 50px; box-sizing: border-box; margin: 0 -16px; padding: 0 16px; border-bottom: 1px solid rgba(229,230,235,.9); background: #fff; }
.task-chat-panel__head--plan > div:first-child { display: flex; flex-direction: row; align-items: center; gap: 8px; }
.task-chat-panel__head--plan .team-plan-head__title strong { color: #2f3547; font-size: 15px; font-weight: 650; }
.task-chat-panel__head--plan .team-plan-head__actions { display: flex; flex-direction: row; align-items: center; gap: 4px; }
.task-chat-panel__head--plan .team-plan-head__expand { display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 28px; height: 24px; gap: 5px; margin: 0; padding: 0 4px 0 7px; border: 0; border-radius: 6px; background: transparent; color: #8d96a5; cursor: pointer; }
.task-chat-panel__head--plan .team-plan-head__expand:hover { background: #f2f4f7; color: #2f3547; }
.task-chat-panel__head--plan .team-plan-head__expand span { color: #8d96a5; font-size: 10px; font-weight: 650; white-space: nowrap; }
.task-chat-panel__head--plan .team-plan-head__expand svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.task-chat-panel__head--plan .team-plan-head__actions .task-chat-panel__close { width: 28px; height: 24px; margin: 0; font-size: 20px; }
/* Use the same content width as the collaboration task backfill card. */
.personal-task-chat .task-backfill-card { width: min(100%, 680px); max-width: 680px !important; }
.personal-task-chat .task-chat-scroll { box-sizing: border-box; overflow-x: hidden; padding-bottom: 160px; scroll-padding-bottom: 160px; }
.personal-task-chat .task-backfill-card { height: auto !important; min-height: 0; }
/* Keep review outcomes in their own flow container, matching the collaboration
   task card. This prevents the outcome box from sitting on the card edge or
   collapsing its bottom spacing on seeded review tasks. */
.personal-task-chat .task-backfill-outcome-shell { padding: 0 26px 18px; }
.personal-task-chat .task-backfill-outcome-shell .task-backfill-outcome { margin: 0; }
.personal-task-chat .task-backfill-card.is-pending_acceptance,
.personal-task-chat .task-backfill-card.is-accepted,
.personal-task-chat .task-backfill-card.is-project_backfilled { padding-bottom: 14px !important; }
.personal-task-chat .task-backfill-card.is-pending_acceptance { min-height: 166px !important; padding-bottom: 18px !important; box-sizing: border-box; }
/* The plan drawer starts at the same top edge as the collaboration drawer. */
.personal-task-chat > .task-chat-panel:has(.task-chat-panel__head--plan) { padding-top: 0; }
.personal-task-chat > .task-chat-panel:has(.task-chat-panel__head--plan) .task-chat-panel__head--plan { top: 0; }
/* Match the collaboration drawer's fixed geometry at every viewport width. */
.personal-task-chat > .task-chat-panel { width: 330px; min-width: 330px; flex: 0 0 330px; }
/* Keep the personal drawer aligned with the collaboration drawer on compact viewports. */
@media (max-width: 760px) {
  .personal-task-chat > .task-chat-panel { position: relative; inset: auto; width: 330px; min-width: 330px; flex: 0 0 330px; border-left: 1px solid #eaecf0; box-shadow: none; }
}
</style>
