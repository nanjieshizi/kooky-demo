<template>
  <div class="bridge-shell">
    <header class="bridge-header">
      <div class="bridge-title">
        <span>{{ isTaskConversation ? activeTask.title : project.name }}</span>
      </div>
      <div class="bridge-actions">
        <button type="button" :class="{ active: activePanel === 'plan' }" @click="activePanel = 'plan'">团队计划<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg></button>
        <button type="button" :class="{ active: activePanel === 'base' }" @click="activePanel = 'base'">{{ isTaskConversation ? '任务底座' : '项目底座' }}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg></button>
      </div>
    </header>

    <main class="bridge-body">
      <section class="bridge-conversation" aria-label="项目讨论">
        <div ref="conversationScrollRef" class="conversation-scroll">
          <section v-if="isTaskConversation" class="task-conversation">
            <div class="task-conversation-context">
              <span>任务对话</span><b>{{ activeTask.title }}</b><small>挂载于 {{ project.name }} · 任务底座 v{{ project.snapshot.version }}</small>
            </div>
            <template v-for="item in activeTask.messages" :key="item.id">
              <div v-if="item.type === 'system'" class="system-event">{{ item.text }}</div>
              <article v-else class="bridge-message" :class="`is-${item.type}`">
                <div class="message-avatar">{{ item.type === 'user' ? '我' : '助' }}</div>
                <div class="message-content">
                  <strong v-if="item.type !== 'user'">团队助理</strong>
                  <p>{{ item.text }}</p>
                  <div v-if="item.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ item.file.name }}</strong><small>{{ item.file.type }} · {{ item.file.version }} · {{ item.file.status }}</small></div><button type="button">查看产物</button></div>
                </div>
              </article>
            </template>
            <section v-if="activeTask.backfillDemoStep >= 1" class="task-backfill-card">
              <header><div><span>执行回填</span><strong>补充执行回填</strong></div><em>AI 建议</em></header>
              <p class="task-backfill-intro">团队助理已根据本次任务和产物起草回填，请确认并修改后提交。</p>
              <label>本次完成了什么<textarea v-model="activeTask.backfill.completed" rows="2"></textarea></label>
              <label class="task-backfill-artifact-field">
                <span>产物</span>
                <div class="task-backfill-artifact">
                  <div class="task-backfill-artifact-file"><span class="task-file-icon">M</span><div><strong>{{ activeTask.backfill.deliverable || '添加产物文件' }}</strong><small>Markdown 文件</small></div></div>
                  <button type="button" class="task-backfill-artifact-edit" aria-label="修改产物" title="修改产物" @click="editingBackfillArtifact = !editingBackfillArtifact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1-1-4Z"/></svg></button>
                </div>
                <input v-if="editingBackfillArtifact" v-model="activeTask.backfill.deliverable" placeholder="输入或修改产物名称" />
              </label>
              <label>哪些做法有效<textarea v-model="activeTask.backfill.effective" rows="2"></textarea></label>
              <label>遇到了什么问题<textarea v-model="activeTask.backfill.issues" rows="2"></textarea></label>
              <label>下次可以复用的经验<textarea v-model="activeTask.backfill.reusable" rows="2"></textarea></label>
              <label class="task-backfill-check"><input v-model="activeTask.backfill.updateBase" type="checkbox" /> 建议更新项目底座</label>
              <footer><button type="button" @click="saveTaskBackfill">保存草稿</button><button type="button" class="task-backfill-primary" @click="submitTaskBackfill">提交回填</button></footer>
            </section>
          </section>

          <template v-if="!isTaskConversation" v-for="item in project.discussion" :key="item.id">
            <div v-if="item.type === 'system'" class="system-event">{{ item.text }}</div>
            <article v-else class="bridge-message" :class="`is-${item.type}`">
              <div class="message-avatar">{{ item.type === 'user' ? '我' : '助' }}</div>
              <div class="message-content">
                <strong v-if="item.type !== 'user'">{{ item.type === 'published' ? '项目回填' : item.type === 'echo' ? '执行回声' : '团队助理' }}</strong>
                <p>{{ item.text }}</p>
                <div v-if="item.kind === 'file'" class="task-file-card"><span class="task-file-icon">M</span><div><strong>{{ item.file.name }}</strong><small>{{ item.file.type }} · {{ item.file.version }} · {{ item.file.status }}</small></div><button type="button">查看产物</button></div>
              </div>
            </article>
          </template>

          <section v-if="!isTaskConversation && pendingTask" class="assignment-card" aria-label="当前任务快照">
            <header class="assignment-card-head">
              <div>
                <span>{{ project.phase === 'draft' ? '确认任务快照' : '任务快照生成中' }}</span>
                <strong>调研任务分工</strong>
              </div>
              <small>{{ project.phase === 'draft' ? '来自项目讨论 · 待确认' : `已生成 ${project.tasks.length} / 3 项` }}</small>
            </header>
            <div class="assignment-summary">
              <span class="assignment-summary-dot"></span>
              {{ project.phase === 'draft' ? `已基于任务底座 v${project.snapshot.version} 生成，确认后自动挂载项目并同步个人任务。` : `已生成 ${project.tasks.length} / 3 项任务。` }}
            </div>
            <article class="assignment-row assignment-snapshot-card">
              <span class="assignment-number">{{ String(project.tasks.indexOf(pendingTask) + 1).padStart(2, '0') }}</span>
              <div class="assignment-copy">
                <strong>{{ pendingTask.title }}</strong>
                <small v-if="pendingTask.goal">目标：{{ pendingTask.goal }}</small>
                <small v-if="pendingTask.deliverable">交付物：{{ pendingTask.deliverable }}</small>
                <small>{{ pendingTask.acceptance }}</small>
                <div class="assignment-meta"><span>{{ pendingTask.owner }}</span><span>{{ pendingTask.agent }}</span><span>{{ pendingTask.deadline }}</span></div>
              </div>
            </article>
            <footer v-if="pendingTask" class="assignment-actions">
              <button type="button" class="assignment-edit" @click="isEditingAssignments = true">修改分工</button>
              <button v-if="!isEditingAssignments" type="button" class="assignment-confirm" @click="confirmCurrentTask">确认当前任务</button>
              <div v-else class="assignment-waiting" role="status"><i></i><span>当前任务修改中</span></div>
            </footer>
          </section>

          <section v-if="!isTaskConversation && (confirmedTasks.length || project.phase === 'planned')" class="project-task-list">
            <div class="section-heading">
              <span>项目任务</span>
              <small>{{ confirmedTasks.length }} 项 · 引用式挂载</small>
            </div>
            <article v-for="task in confirmedTasks" :key="task.id" class="task-row">
              <span class="task-state" :class="`is-${task.status}`"></span>
              <div><strong>{{ task.title }}</strong><small>{{ task.owner }} · {{ task.agent }} · {{ task.deadline }}</small></div>
              <span class="task-label">{{ task.status === 'done' ? '已完成' : task.status === 'in_progress' ? '执行中' : '待开始' }}</span>
            </article>
          </section>
        </div>

        <form class="bridge-composer" @submit.prevent="sendDiscussion">
          <div class="bridge-composer-shell">
            <textarea v-model="messageText" rows="2" readonly placeholder=""></textarea>
            <div class="bridge-composer-bottom">
              <div class="bridge-composer-tools">
                <button type="button" aria-label="添加附件" title="添加附件">⌕</button>
                <button type="button" aria-label="技能" title="技能">✣</button>
              </div>
              <div class="bridge-composer-tools bridge-composer-tools--right">
                <button type="button" class="bridge-composer-pill"><span>♧</span> 思考 <i>⌄</i></button>
                <button type="button" class="bridge-composer-pill"><b>✳</b> Claude Opus 4.5 <i>⌄</i></button>
                <button type="submit" class="bridge-composer-send" :disabled="isTaskConversation ? activeTask.backfillDemoStep >= 1 : (!canAdvanceDemo || demoFlowIndex >= demoFlow.length)" :aria-label="demoFlowIndex >= demoFlow.length ? '演示完成' : '发送'"><span>➤</span></button>
              </div>
            </div>
          </div>
          <p class="bridge-composer-disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
        </form>

      </section>

      <aside v-if="(isTaskConversation && ['plan', 'base'].includes(activePanel)) || (!isTaskConversation && (activePanel === 'plan' || activePanel === 'base' || isEditingAssignments))" class="bridge-panel">
        <template v-if="activePanel === 'base'">
          <header class="panel-head"><div><strong>{{ isTaskConversation ? '任务底座' : '项目底座' }}</strong><small>{{ isTaskConversation ? '当前任务引用的核心项目共识' : '当前项目长期共享的目标与协作规则' }}</small></div><div class="panel-head-actions"><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button><button type="button" class="base-detail-action" @click="showBaseEditor = true">底座详情<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button></div></header>
          <div class="base-card"><b>{{ isTaskConversation ? '任务底座' : '项目底座' }} v{{ project.snapshot.version }}</b><p>{{ project.snapshot.projectBase }}</p><small>已被 {{ project.tasks.length || 3 }} 个任务引用</small></div>
          <section class="base-preview-section"><span>项目目标</span><p>完成可追溯的任务桥 Demo 主流程，让讨论、执行与经验沉淀形成闭环。</p></section>
          <section class="base-preview-section"><span>阻塞约束</span><p>任务必须具备可验证交付物与验收标准。</p></section>
          <section class="base-preview-section"><span>团队成员</span><div class="base-member-stack" aria-label="团队成员头像"><span><img :src="memberAvatars.owner" alt="我" /></span><span><img :src="memberAvatars.research" alt="产品数字人" /></span><span><img :src="memberAvatars.design" alt="设计数字人" /></span><button type="button" class="base-member-add" aria-label="添加团队成员">+</button></div><div class="base-mini-people"><b>我 <small>项目负责人</small></b><b>产品数字人 <small>调研协作</small></b><b>设计数字人 <small>原型协作</small></b></div></section>
          <section class="base-preview-section"><span>AI 角色</span><div class="base-mini-people"><b>产品数字人 <small>收集证据并形成竞品结论</small></b><b>设计数字人 <small>产出核心流程与异常状态</small></b></div></section>
          <section class="base-preview-section"><span>工作约定</span><p>关键结论保留来源，进入评审后再沉淀。</p></section>
          <section class="base-preview-section"><span>关键决策</span><p>任务创建前必须确认快照；阻塞级约束自动带入。</p></section>
          <section class="base-preview-section"><span>方法论沉淀</span><p>调研先定比较维度，结论必须可回看来源。</p></section>
          <section class="base-preview-section"><span>本次引用</span><p>{{ project.snapshot.trigger }}</p></section>
          <div v-if="project.echoPublished" class="echo-success">执行回声已沉淀；下一次同类任务会自动携带这条经验。</div>
        </template>
        <template v-else-if="!isTaskConversation && pendingTask && isEditingAssignments">
          <header class="panel-head"><div><strong>确认任务快照</strong><small>来自项目讨论 · 任务底座 v{{ project.snapshot.version }}</small></div><div class="panel-head-actions"><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button></div></header>
          <div class="context-note"><b>任务底座 v{{ project.snapshot.version }}</b><span>当前项目：{{ project.name }}</span><span>{{ project.snapshot.projectBase }}</span></div>
          <article class="draft-task-card">
            <template v-if="pendingTask">
              <div class="draft-task-title"><strong>任务 {{ String(project.tasks.indexOf(pendingTask) + 1).padStart(2, '0') }}</strong><span>待确认快照</span></div>
              <label>任务标题<input v-model="pendingTask.title" /></label>
              <label>任务目标<textarea v-model="pendingTask.goal" rows="2"></textarea></label>
              <div class="draft-task-fields"><label>任务类型<input v-model="pendingTask.type" /></label><label>负责人<input v-model="pendingTask.owner" /></label></div>
              <div class="draft-task-fields"><label>协作方<input v-model="pendingTask.agent" /></label><label>截止时间<input v-model="pendingTask.deadline" /></label></div>
              <label>交付物<input v-model="pendingTask.deliverable" /></label>
              <label>验收标准<textarea v-model="pendingTask.acceptance" rows="2"></textarea></label>
              <small class="snapshot-source">来源：项目讨论 · 已绑定任务底座 v{{ project.snapshot.version }}</small>
            </template>
          </article>
          <footer class="panel-footer"><button type="button" class="quiet" @click="isEditingAssignments = false">返回卡片</button><button type="button" class="primary" @click="confirmCurrentTask">确认当前任务</button></footer>
        </template>

        <template v-else>
          <header class="panel-head team-plan-head"><div><strong>团队计划</strong><small>{{ project.phase === 'planned' ? '任务已全部确认并挂载到项目' : `已确认 ${confirmedTasks.length} 项任务` }}</small></div><button type="button" class="panel-close" aria-label="关闭侧边抽屉" title="关闭" @click="closeSidePanel">×</button></header>
          <section class="team-dashboard" aria-label="本周团队计划概览">
            <div class="team-dashboard-head"><div><strong>本周团队计划</strong><span>8/18—8/24</span></div><button type="button" class="dashboard-more" aria-label="更多团队计划操作">···</button></div>
            <div class="dashboard-kpis">
              <div><span>任务</span><strong>18</strong></div>
              <div><span>完成度</span><strong>67%</strong></div>
              <div><span>按时交付</span><strong>83%</strong></div>
            </div>
            <div class="dashboard-load"><div class="dashboard-section-title"><span>团队负载</span><b>中等</b></div><div class="dashboard-progress"><span style="width: 67%"></span></div><div class="dashboard-load-meta"><span>67%</span><small>已完成 12 · 进行中 4 · 待开始 2</small></div></div>
            <div class="dashboard-attention"><div class="dashboard-section-title"><span>需要关注</span><b>3</b></div><p><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg><span>2 个任务临近截止</span></p><p><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg><span>1 个任务存在阻塞依赖</span></p></div>
          </section>
          <div v-if="confirmedTasks.length" class="plan-list">
            <article v-for="task in confirmedTasks" :key="task.id" class="plan-item" :class="{ 'is-expanded': expandedPlanTasks.has(task.id) }">
              <button type="button" class="plan-item-toggle" @click="togglePlanTask(task.id)">
                <span class="plan-item-dot"></span>
                <span class="plan-item-main"><b>{{ task.title }}</b><small>{{ task.owner }} · {{ task.deadline }}</small></span>
                <span class="plan-submit-status" :class="task.submitted ? 'is-submitted' : 'is-pending'">{{ task.submitted ? '已提交' : '未提交' }}</span>
                <span class="plan-item-chevron" aria-hidden="true">{{ expandedPlanTasks.has(task.id) ? '⌃' : '⌄' }}</span>
              </button>
              <div v-if="expandedPlanTasks.has(task.id)" class="plan-item-detail">
                <p v-if="task.goal"><span>任务目标</span>{{ task.goal }}</p>
                <p v-if="task.deliverable"><span>交付物</span>{{ task.deliverable }}</p>
                <p><span>负责人 / 协作方</span>{{ task.owner }} · {{ task.agent }}</p>
                <p v-if="task.acceptance"><span>验收标准</span>{{ task.acceptance }}</p>
              </div>
            </article>
          </div>
          <div v-else class="panel-empty">还没有已确认任务</div>
        </template>
      </aside>
    </main>

    <Transition name="bridge-toast"><div v-if="notice" class="bridge-toast">{{ notice }}</div></Transition>

    <ProjectBaseWorkspace
      v-if="showBaseEditor"
      :project="project"
      :task="activeTask || project.tasks[0]"
      :full="true"
      @close="showBaseEditor = false"
      @saved="(message) => { showBaseEditor = false; flash(message) }"
    />

  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useTodoStore } from '@/modules/todo/store/todoStore'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import ProjectBaseWorkspace from '@/modules/task-bridge/components/ProjectBaseWorkspace.vue'
import ownerAvatar from '@/assets/avatar-wang-jingbo.webp'
import researchAvatar from '@/assets/collaboration/pmo-digital-human-avatar.png'
import designAvatar from '@/assets/collaboration/tapd-pmo-avatar.png'

const groupStore = useGroupStore()
const uiStore = useUIStore()
const todoStore = useTodoStore()
const bridgeStore = useTaskBridgeStore()
const memberAvatars = Object.freeze({ owner: ownerAvatar, research: researchAvatar, design: designAvatar })
const messageText = ref('')
const activePanel = ref('plan')
const isEditingAssignments = ref(false)
const showBaseEditor = ref(false)
const editingBackfillArtifact = ref(false)
const notice = ref('')
const expandedPlanTasks = ref(new Set())
const conversationScrollRef = ref(null)
let noticeTimer = null
const demoFlow = [
  {
    user: '@团队助理，基于本次项目目标生成调研任务分工，明确负责人、协作数字人、截止时间和验收标准。',
    assistant: '收到。我已根据项目底座和当前讨论拆分出 3 项可执行工作，并预填负责人、协作方与验收标准。请核对任务快照后确认加入团队计划。',
  },
  {
    user: '请继续明确每项任务的交付物和验收标准。',
    assistant: '第一项任务已生成：调研报告。',
    revealTask: true,
  },
  {
    user: '请补充原型和技术评估任务，保持任务之间的协作关系。',
    assistant: '第二项任务已生成：绘制原型。',
    revealTask: true,
  },
  {
    user: '请完成最后一项任务，并整理完整的任务快照。',
    assistant: '第三项任务已生成：技术方案评估。任务快照已完成，请核对后确认。',
    revealTask: true,
  },
]

const conversationId = computed(() => String(groupStore.currentSpaceId || 'task-bridge-demo'))
const project = computed(() => bridgeStore.ensureProject(conversationId.value, '项目一'))
const activeTask = computed(() => project.value.tasks.find((task) => task.id === project.value.activeTaskId) || null)
const isTaskConversation = computed(() => Boolean(activeTask.value))
const demoFlowIndex = computed(() => Math.floor(project.value.discussion.length / 2))
const pendingTask = computed(() => project.value.tasks.find((task) => !task.confirmed) || null)
const canAdvanceDemo = computed(() => !pendingTask.value)
const confirmedTasks = computed(() => project.value.tasks.filter((task) => task.confirmed))

function ensureTaskArtifact(task) {
  if (!task || task.messages.some((message) => message.kind === 'file')) return
  task.messages.push({
    id: `task-file-${task.id}`,
    type: 'assistant',
    kind: 'file',
    text: '产物已生成，请提交验收。',
    file: { name: `${task.title}.md`, type: 'Markdown', version: 'v1', status: '待验收' },
  })
}

watch(activeTask, ensureTaskArtifact, { immediate: true })

watch(isTaskConversation, (isTask) => {
  // 任务对话默认不展示右侧抽屉；仍可按需打开团队计划或任务底座。
  activePanel.value = isTask
    ? (project.value.showPlanAfterBackfill ? 'plan' : null)
    : 'plan'
  if (isTask && project.value.showPlanAfterBackfill) project.value.showPlanAfterBackfill = false
}, { immediate: true })

watch(() => project.value.phase, (phase) => {
  // 回填确认完成后直接回到当前项目的团队计划，不再经过中间确认抽屉。
  if (!isTaskConversation.value && ['backfill', 'published'].includes(phase)) activePanel.value = 'plan'
}, { immediate: true })

function closeSidePanel() {
  activePanel.value = null
  isEditingAssignments.value = false
}

function togglePlanTask(taskId) {
  const next = new Set(expandedPlanTasks.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedPlanTasks.value = next
}

function flash(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}

function scrollToLatest() {
  nextTick(() => {
    const container = conversationScrollRef.value
    if (!container) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  })
}

function generateAssignments() {
  const current = bridgeStore.generateAssignments(conversationId.value)
  syncPersonalTasks(current)
  activePanel.value = 'plan'
  flash('已生成任务快照，并同步新增个人任务')
}

function sendDiscussion() {
  const text = messageText.value.trim()
  if (activeTask.value) {
    if (activeTask.value.backfillDemoStep >= 1) return
    const preset = '@团队助理，任务完成，起草回填'
    activeTask.value.messages.push({ id: `task-user-${Date.now()}`, type: 'user', text: text || preset })
    activeTask.value.messages.push({ id: `task-assistant-backfill-${Date.now()}`, type: 'assistant', text: '回填已起草，请确认修改。' })
    activeTask.value.backfillDemoStep = 1
    activeTask.value.backfill = {
      completed: `「${activeTask.value.title}」已完成，产物已生成并提交验收。`,
      deliverable: activeTask.value.deliverable || `${activeTask.value.title}.md`,
      effective: '先明确比较维度，再收集证据并形成结论。',
      issues: '不同来源的信息口径需要额外核对。',
      reusable: '先定比较维度，再收集证据，可显著减少返工。',
      updateBase: false,
    }
    bridgeStore.prepareBackfill(conversationId.value, activeTask.value.id)
    messageText.value = ''
    scrollToLatest()
    return
  }
  const preset = demoFlow[demoFlowIndex.value]
  if (!preset) return
  bridgeStore.addDiscussion(conversationId.value, preset.user, 'user')
  bridgeStore.addDiscussion(conversationId.value, preset.assistant, 'assistant')
  messageText.value = ''
  if (preset.revealTask) {
    const current = bridgeStore.revealNextAssignment(conversationId.value)
    if (current?.tasks.length === 3) flash('当前任务快照已生成，请先编辑并确认')
  }
  scrollToLatest()
}

function saveTaskBackfill() {
  if (!activeTask.value?.backfill) return
  project.value.backfillDraft = activeTask.value.backfill.completed
  project.value.echoDraft = activeTask.value.backfill.reusable
  flash('回填草稿已保存')
}

function submitTaskBackfill() {
  saveTaskBackfill()
  if (activeTask.value) activeTask.value.status = 'backfill'
  const current = bridgeStore.publishBackfill(conversationId.value)
  if (current) current.echoPublished = true
  activePanel.value = 'plan'
  flash('回填已提交，团队计划已同步')
}

function confirmCurrentTask() {
  const task = pendingTask.value
  if (!task) return
  const taskIndex = project.value.tasks.indexOf(task) + 1
  const current = bridgeStore.confirmTask(conversationId.value, task.id)
  if (!current) return
  syncPersonalTasks(current)
  isEditingAssignments.value = false
  activePanel.value = 'plan'
  if (current.phase === 'planned') {
    flash('任务分工已全部确认，已加入团队计划')
    ElMessage.success('任务已同步到我的待办')
  } else {
    flash(`第 ${taskIndex} 项任务已确认并加入团队计划`)
    ElMessage.success(`第 ${taskIndex} 项任务已同步到团队计划`)
  }
}

function syncPersonalTasks(current) {
  if (!current) return
  // 初始化为空待办，但保留已经从任务桥写入的条目。
  todoStore.seed([])
  current.tasks.filter((task) => task.owner === '我').forEach((task) => {
    const todoId = `task-bridge-${conversationId.value}-${task.id}`
    if (todoStore.items.some((item) => item.id === todoId)) return
    todoStore.items.unshift({
      id: todoId,
      type: 'text',
      bucket: 'today',
      title: task.title,
      status: 'open',
      result: '',
      group: current.name,
      taskBridgeConversationId: conversationId.value,
      taskBridgeTaskId: task.id,
    })
  })
}

function publishBackfill() {
  const current = bridgeStore.publishBackfill(conversationId.value)
  if (!current) return
  // 回填确认后直接回到团队计划，不再经过“已发布”抽屉。
  current.echoPublished = true
  activePanel.value = 'plan'
  flash('回填已确认，已返回团队计划')
}

function publishEcho() {
  bridgeStore.publishEcho(conversationId.value)
  flash(`执行回声已写入任务底座 v${project.value.snapshot.version}`)
}
</script>

<style scoped>
.bridge-shell { width:100%; max-width:100%; height: 100%; min-height: 0; display: flex; flex-direction: column; background: #fff; color: #2f3547; position: relative; overflow: hidden; }
.bridge-shell::before { content: ''; position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(circle, rgba(255,151,133,.26) 1.1px, transparent 1.3px); background-size: 18px 18px; -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 62%); mask-image: linear-gradient(to bottom, #000 0%, transparent 62%); }
.bridge-header,.bridge-body,.bridge-next-step { position: relative; z-index: 1; }
.bridge-header { min-height: 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid rgba(229,230,235,.9); }
.bridge-title { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 650; }
.bridge-actions { display: flex; gap: 8px; }.bridge-actions button { display:inline-flex; align-items:center; gap:5px; border: 0; border-radius: 7px; padding: 6px 9px; background: transparent; color: #697184; cursor: pointer; font-size: 12px; }.bridge-actions button svg{flex:0 0 auto;opacity:.8}.bridge-actions button:hover,.bridge-actions button.active { background: #f4f5f7; color: #2f3547; }
.bridge-body { position:relative; flex: 1; min-height: 0; min-width:0; display: flex; overflow:hidden; }.bridge-conversation { position:relative; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }.conversation-scroll { flex: 1; min-height: 0; overflow: auto; padding: 26px min(9vw,120px); }
.system-event { margin: 0 auto 12px; text-align: center; color: #a0a6b2; font-size: 12px; }.bridge-message { display: flex; gap: 10px; max-width: 720px; margin: 18px auto; }.bridge-message.is-user { flex-direction: row-reverse; }.message-avatar { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; background: #eee8ff; color: #7257d9; font-size: 12px; font-weight: 700; }.is-user .message-avatar { background: #ffede5; color: #ee6c37; }.message-content { min-width: 0; }.message-content strong { font-size: 13px; }.message-content p { margin: 5px 0 0; padding: 10px 12px; border-radius: 4px 12px 12px 12px; background: rgba(255,255,255,.9); line-height: 1.65; font-size: 13px; box-shadow: 0 1px 5px rgba(47,53,71,.05); white-space: pre-wrap; }.is-user .message-content p { border-radius: 12px 4px 12px 12px; background: #fff0e9; }
.discussion-hint { max-width: 520px; margin: 90px auto 0; text-align: center; display: flex; flex-direction: column; gap: 11px; color: #8a92a2; font-size: 13px; }.discussion-hint button { margin: 0 auto; border: 0; border-radius: 8px; padding: 8px 14px; background: #ff621f; color: #fff; font-weight: 600; cursor: pointer; }.discussion-hint small { color: #a5abb5; }
.assignment-card { width:min(100%, 560px); margin:26px auto 6px; overflow:hidden; border:1px solid #f1ded4; border-radius:16px; background:rgba(255,255,255,.97); box-shadow:0 14px 32px rgba(91,67,55,.10); }
.assignment-card-head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px 13px; border-bottom:1px solid #f3e8e2; background:linear-gradient(115deg,#fff9f5,#fff); }.assignment-card-head div{display:flex;align-items:baseline;gap:9px}.assignment-card-head span{color:#ff621f;font-size:11px;font-weight:700;letter-spacing:.05em}.assignment-card-head strong{color:#313846;font-size:16px}.assignment-card-head small{padding:4px 8px;border-radius:999px;background:#fff0e9;color:#e96c38;font-size:11px;font-weight:650}
.assignment-summary { display:flex; align-items:flex-start; gap:8px; margin:13px 18px 4px; color:#8a92a0; font-size:11px; line-height:1.5; }.assignment-summary-dot{width:6px;height:6px;flex:0 0 auto;margin-top:5px;border-radius:50%;background:#ff8b55;box-shadow:0 0 0 3px #fff1ea}
.assignment-row { display:flex; gap:11px; margin:0 12px; padding:13px 6px; border-bottom:1px solid #f4f0ed; }.assignment-number{display:grid;place-items:center;flex:0 0 auto;width:25px;height:25px;margin-top:1px;border-radius:8px;background:#fff1e9;color:#ee733f;font-size:10px;font-weight:750}.assignment-copy{min-width:0;display:flex;flex:1;flex-direction:column;gap:4px}.assignment-copy>strong{color:#343b49;font-size:13px}.assignment-copy>small{color:#818a98;font-size:11px;line-height:1.5}.assignment-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}.assignment-meta span{padding:2px 6px;border-radius:5px;background:#f7f8fa;color:#798290;font-size:10px}.assignment-meta span:first-child{background:#eef5ff;color:#5679a9}
.assignment-actions{display:flex;justify-content:flex-end;gap:9px;padding:13px 18px 15px;background:#fffdfc}.assignment-actions button{border-radius:8px;padding:8px 12px;font-size:12px;font-weight:650;cursor:pointer}.assignment-edit{border:1px solid #e9e1dc;background:#fff;color:#69717e}.assignment-confirm{border:1px solid #ff621f;background:#ff621f;color:#fff;box-shadow:0 5px 12px rgba(255,98,31,.20)}.assignment-waiting{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #f3ddd3;border-radius:8px;background:#fff8f4;color:#9b7466;font-size:11px;font-weight:600}.assignment-waiting i{width:12px;height:12px;border:2px solid #f0c3b2;border-top-color:#ff621f;border-radius:50%;animation:assignment-spin .8s linear infinite}.assignment-actions button:active{transform:translateY(1px)}.assignment-actions button:focus-visible{outline:2px solid #5d9cf7;outline-offset:2px}@keyframes assignment-spin{to{transform:rotate(360deg)}}
.task-conversation { max-width: 720px; margin: 4px auto 0; }.task-conversation-context { display:flex; flex-direction:column; gap:4px; margin:0 auto 20px; padding:12px 14px; border:1px solid #f0ded5; border-radius:10px; background:#fffaf7; color:#7f8795; font-size:12px; }.task-conversation-context span { color:#ff621f; font-size:11px; font-weight:650; }.task-conversation-context b { color:#303746; font-size:15px; }.task-conversation-context small { color:#949ba8; }.task-context-card { display:flex; flex-direction:column; gap:8px; margin-top:13px; padding:12px; border:1px solid #eceef2; border-radius:10px; background:#fff; }.task-context-card strong { font-size:14px; }.task-context-card small,.task-context-card p { margin:0; color:#87909d; font-size:12px; line-height:1.55; }.task-context-card p { color:#606a79; }
.project-task-list { max-width: 720px; margin: 26px auto 0; padding: 15px; background: rgba(255,255,255,.82); border: 1px solid #eceef1; border-radius: 12px; }.section-heading { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 650; }.section-heading small,.task-row small { color: #939aa7; font-size: 11px; font-weight: 400; }.task-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid #f1f2f4; }.task-row>div { display:flex; flex-direction:column; gap:3px; flex:1; }.task-row strong { font-size: 13px; }.task-state { width: 8px; height: 8px; border-radius: 50%; background:#bfc5ce; }.task-state.is-in_progress{background:#ff8b4d}.task-state.is-done{background:#26b56a}.task-label{font-size:11px;color:#8f97a5}
.bridge-composer { margin: 0 32px 20px; padding: 11px 14px 9px; border: 1.5px solid #dce2eb; border-radius: 15px; background: #fff; box-shadow: 0 8px 22px rgba(82,98,122,.10); }.bridge-composer:focus-within { border-color:#80b5ff; box-shadow:0 8px 22px rgba(67,130,226,.16); }.bridge-composer textarea { width:100%; resize:none; border:0; outline:0; color:#303746; font:13px/1.55 PingFang SC,sans-serif; background:transparent; box-sizing:border-box; }.composer-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#a1a8b4; font-size:11px; }.composer-footer button { border:0; border-radius:7px; padding:6px 13px; background:#2f3547; color:white; cursor:pointer; }.composer-footer button:disabled { opacity:.4; cursor:not-allowed; }
.bridge-composer-shell{position:relative;max-width:780px;margin:0 auto;padding:11px 14px 9px;border:1.5px solid #dce2eb;border-radius:15px;background:#fff;box-shadow:0 8px 22px rgba(82,98,122,.10)}.bridge-composer-shell:focus-within{border-color:#80b5ff;box-shadow:0 8px 22px rgba(67,130,226,.16)}.bridge-composer textarea{display:block;width:100%;min-height:38px;box-sizing:border-box;resize:none;border:0;outline:0;background:transparent;color:#303746;font:13px/1.55 PingFang SC,sans-serif}.bridge-composer textarea::placeholder{color:#a1a8b4}.bridge-composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px}.bridge-composer-tools{display:flex;align-items:center;gap:7px}.bridge-composer-tools button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid #e0e5ee;border-radius:8px;background:#fff;color:#647084;cursor:pointer;font-size:16px;line-height:1}.bridge-composer-tools--right{gap:8px}.bridge-composer-pill{display:flex!important;align-items:center;gap:5px;width:auto!important;padding:0 10px!important;border:0!important;background:#f5f7fb!important;color:#344055!important;font-size:12px!important}.bridge-composer-pill span{font-size:15px;color:#56677e}.bridge-composer-pill b{color:#f5872f;font-size:15px}.bridge-composer-pill i{color:#8d96a5;font-style:normal;font-size:13px}.bridge-composer-send{width:32px!important;height:32px!important;border:0!important;border-radius:50%!important;background:#aab1bd!important;color:#fff!important;font-size:15px!important}.bridge-composer-send:not(:disabled){background:#6d7888!important;cursor:pointer}.bridge-composer-send:disabled{cursor:not-allowed;opacity:.85}.bridge-composer-disclaimer{max-width:780px;margin:8px auto 0;color:#a6acb9;text-align:center;font-size:11px;line-height:16px}.bridge-panel { width: 330px; flex: 0 0 330px; align-self:stretch; margin-left:auto; overflow: auto; box-sizing: border-box; border-left: 1px solid #eaecf0; background: #fff; padding: 18px 16px; }.panel-head { display:flex; justify-content:space-between; gap:10px; padding-bottom:13px; border-bottom:1px solid #eef0f2; }.panel-head div { display:flex; flex-direction:column; gap:4px; }.panel-head strong { font-size:15px; }.panel-head small { color:#9299a6; font-size:11px; line-height:1.4; }.panel-head button { border:0; background:transparent; color:#64748b; cursor:pointer; font-size:12px; }.context-note,.base-card { margin:13px 0; padding:10px; border-radius:9px; background:#fff8f4; color:#6f7683; font-size:12px; line-height:1.55; }.context-note b { display:block; color:#ff621f; margin-bottom:4px; }.draft-task-card { margin-top:12px; padding:12px; border:1px solid #eceef2; border-radius:10px; background:#fff; }.draft-task-title { display:flex; justify-content:space-between; gap:8px; margin-bottom:10px; }.draft-task-title strong{font-size:13px}.draft-task-title span{font-size:10px;color:#f17a46;background:#fff0e8;border-radius:4px;padding:2px 5px}.draft-task-card label,.long-field { display:flex; flex-direction:column; gap:5px; margin-top:9px; color:#8b93a0; font-size:11px; }.draft-task-card input,.draft-task-card textarea,.long-field textarea { box-sizing:border-box; width:100%; border:1px solid #e5e8ed; border-radius:6px; padding:7px; outline:0; color:#3b4250; font:12px/1.45 PingFang SC,sans-serif; resize:vertical; }.draft-task-card input:focus,.draft-task-card textarea:focus,.long-field textarea:focus { border-color:#f09a78; }.panel-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }.panel-footer button { border:0; border-radius:7px; padding:8px 10px; cursor:pointer; font-size:12px; }.panel-footer .quiet{background:#f3f4f6;color:#6d7581}.panel-footer .primary{background:#ff621f;color:#fff}.plan-list{display:flex;flex-direction:column}.plan-item{display:flex;gap:9px;padding:12px 0;border-bottom:1px solid #f0f1f3}.plan-item>span{width:8px;height:8px;border-radius:50%;background:#ff8b4d;margin-top:5px}.plan-item div{display:flex;flex-direction:column;gap:3px}.plan-item b{font-size:13px}.plan-item small{font-size:11px;color:#949ba7}.panel-empty{padding:30px 12px;color:#a0a6b1;text-align:center;font-size:12px}.base-card b{color:#ff621f;font-size:12px}.base-card p{margin:6px 0}.base-card small{color:#959ca8}.echo-success{padding:10px;border-radius:8px;background:#ebf9f0;color:#228b55;font-size:12px;line-height:1.5}
.bridge-next-step { position:absolute; z-index:4; bottom:136px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #f0dbcf; border-radius:10px; background:#fff; box-shadow:0 10px 24px rgba(47,53,71,.15); color:#647080; font-size:12px; white-space:nowrap; }.bridge-next-step button{border:0;border-radius:6px;padding:6px 9px;background:#ff621f;color:#fff;cursor:pointer;font-size:12px}.bridge-next-step .text-link{background:transparent;color:#596c98;text-decoration:underline;padding:4px}.bridge-toast{position:absolute;z-index:8;top:62px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:8px;background:#2f3547;color:#fff;font-size:12px;box-shadow:0 8px 20px rgba(47,53,71,.2)}.bridge-toast-enter-active,.bridge-toast-leave-active{transition:opacity .18s,transform .18s}.bridge-toast-enter-from,.bridge-toast-leave-to{opacity:0;transform:translate(-50%,-6px)}
.snapshot-source{display:block;margin-top:8px;color:#a4aab5;font-size:10px;line-height:1.35;letter-spacing:.01em}
.base-preview-section{padding:13px 0;border-bottom:1px solid #eef0f3}.base-preview-section span{display:block;margin-bottom:5px;color:#8e97a5;font-size:11px}.base-preview-section p{margin:0;color:#535d6c;font-size:12px;line-height:1.55}
.base-member-stack{display:flex!important;align-items:center;min-height:32px;margin:2px 0 10px!important;padding-left:4px}.base-member-stack>span{display:block!important;width:30px;height:30px;margin:0 0 0 -6px!important;padding:2px;border:2px solid #fff;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(47,53,71,.12)}.base-member-stack>span:first-child{margin-left:0!important}.base-member-stack img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
.base-member-add{display:grid!important;place-items:center;width:30px;height:30px;margin-left:6px;padding:0;border:1px dashed #cbd2dd;border-radius:50%;background:#fff;color:#8993a3;font-size:19px;font-weight:400;line-height:1;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.base-member-add:hover{border-color:#ff9a76;background:#fff8f4;color:#ff621f}
.team-dashboard{margin:12px 0 14px;padding:13px;border:1px solid #edf0f4;border-radius:12px;background:linear-gradient(145deg,#fff 0%,#fcfcfd 100%);box-shadow:0 5px 16px rgba(47,53,71,.05)}.team-dashboard-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:11px}.team-dashboard-head div{display:flex;align-items:baseline;gap:7px}.team-dashboard-head strong{color:#303746;font-size:13px}.team-dashboard-head span{color:#9299a6;font-size:10px}.dashboard-more{width:28px;height:24px;margin-top:-3px;padding:0;border:0;border-radius:6px;background:transparent;color:#8d96a5;font-size:16px;line-height:1;letter-spacing:1px;cursor:pointer}.dashboard-more:hover{background:#f2f4f7;color:#3b4453}.dashboard-kpis{display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden;border:1px solid #edf0f4;border-radius:9px;background:#fff}.dashboard-kpis div{display:flex;flex-direction:column;gap:4px;padding:9px 8px;border-right:1px solid #edf0f4}.dashboard-kpis div:last-child{border-right:0}.dashboard-kpis span,.dashboard-section-title span{color:#8d96a5;font-size:10px}.dashboard-kpis strong{color:#303746;font-size:17px;font-weight:650;letter-spacing:-.02em}.dashboard-load{padding:12px 0 10px;border-bottom:1px solid #edf0f4}.dashboard-section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.dashboard-section-title b{color:#596273;font-size:10px;font-weight:600}.dashboard-progress{height:7px;overflow:hidden;border-radius:999px;background:#eef1f4}.dashboard-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff9a73,#ff621f)}.dashboard-load-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.dashboard-load-meta span{color:#ff621f;font-size:11px;font-weight:650}.dashboard-load-meta small{color:#9299a6;font-size:9px}.dashboard-attention{padding:11px 0 8px;border-bottom:1px solid #edf0f4}.dashboard-attention .dashboard-section-title{margin-bottom:6px}.dashboard-attention .dashboard-section-title b{min-width:17px;height:17px;display:inline-grid;place-items:center;border-radius:50%;background:#fff0e9;color:#e66a3c;font-size:10px}.dashboard-attention p{display:flex;align-items:center;gap:6px;margin:6px 0;color:#596273;font-size:10px;line-height:1.35}.dashboard-attention svg{width:13px;height:13px;flex:0 0 13px;fill:none;stroke:#e78b60;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dashboard-members{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:11px}.dashboard-members div{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:7px 8px;border-radius:7px;background:#f7f8fa}.dashboard-members strong{color:#303746;font-size:11px}.dashboard-members span{color:#8d96a5;font-size:9px;white-space:nowrap}
.base-mini-people{display:flex;flex-direction:column;gap:6px}.base-mini-people b{display:flex;justify-content:space-between;gap:8px;color:#4c5565;font-size:12px;font-weight:600}.base-mini-people small{color:#969daa;font-size:10px;font-weight:400;text-align:right}
.base-detail-action{display:inline-flex;align-items:center;gap:5px;color:#64748b!important}.base-detail-action:hover{color:#ff621f!important}
.dashboard-attention{border-bottom:0}
.team-plan-head{border-bottom:0}
@media (max-width: 960px) { .bridge-panel{position:absolute;top:0;right:0;bottom:0;left:auto;z-index:5;width:min(360px,86%);max-width:100%;margin-left:0;box-shadow:-12px 0 28px rgba(47,53,71,.14)}.conversation-scroll{padding-left:24px;padding-right:24px}.bridge-next-step{max-width:calc(100% - 32px);white-space:normal;flex-wrap:wrap} }
.panel-head .panel-head-actions { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; gap: 8px; flex: 0 0 auto; }
.context-note span { display: block; margin-top: 3px; }
.draft-task-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.panel-close { width: 24px; height: 24px; display: inline-grid; place-items: center; padding: 0; border-radius: 6px; color: #9aa1ad !important; font-size: 20px !important; line-height: 1; }
.panel-close:hover { color: #2f3547 !important; background: #f1f3f5 !important; }
.panel-close:focus-visible { outline: 2px solid #ffb092; outline-offset: 2px; }
.bridge-composer{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}.bridge-composer:focus-within{border:0;box-shadow:none}
.plan-item{display:block;padding:0}.plan-item-toggle{display:flex;align-items:center;width:100%;gap:9px;padding:12px 0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.plan-item-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#ff8b4d}.plan-item-main{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.plan-item-main b{font-size:13px}.plan-item-main small{color:#949ba7;font-size:11px}.plan-submit-status{flex:0 0 auto;padding:3px 6px;border-radius:5px;font-size:10px}.plan-submit-status.is-submitted{background:#eaf7ef;color:#2c965d}.plan-submit-status.is-pending{background:#f1f2f4;color:#89919d}.plan-item-chevron{width:16px;color:#8f97a5;text-align:center;font-size:14px}.plan-item-detail{display:flex;flex-direction:column;gap:7px;margin:0 0 10px 17px;padding:10px 11px;border:1px solid #eceef2;border-radius:8px;background:#fafbfc;color:#586272;font-size:11px;line-height:1.5}.plan-item-detail p{margin:0}.plan-item-detail p span{display:block;margin-bottom:2px;color:#9aa1ad;font-size:10px}.plan-item.is-expanded .plan-item-toggle{color:#303746}
.bridge-panel{animation:bridge-panel-in .24s cubic-bezier(.22,1,.36,1) both}.bridge-message{animation:bridge-message-in .24s ease-out both}.assignment-card{animation:bridge-rise-in .28s cubic-bezier(.22,1,.36,1) both}.task-file-card{animation:bridge-rise-in .24s ease-out both}.task-backfill-card{animation:bridge-rise-in .28s cubic-bezier(.22,1,.36,1) both}.plan-item{animation:plan-item-in .22s ease-out both}.plan-item-toggle,.bridge-actions button,.assignment-actions button,.task-file-card button,.task-backfill-card footer button{transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}.bridge-actions button:active,.assignment-actions button:active,.task-file-card button:active,.task-backfill-card footer button:active{transform:scale(.96)}.bridge-composer-send{transition:transform .16s ease,background-color .18s ease,box-shadow .18s ease}.bridge-composer-send:active:not(:disabled){transform:scale(.94)}.plan-item-detail{animation:plan-detail-in .18s ease-out both}.plan-item-chevron{transition:transform .18s ease}.plan-item.is-expanded .plan-item-chevron{transform:rotate(180deg)}@keyframes bridge-panel-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}@keyframes bridge-message-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes bridge-rise-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes plan-item-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}@keyframes plan-detail-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.bridge-panel,.bridge-message,.assignment-card,.task-file-card,.task-backfill-card,.plan-item,.plan-item-detail{animation:none!important}.bridge-actions button,.assignment-actions button,.task-file-card button,.task-backfill-card footer button,.bridge-composer-send,.plan-item-toggle,.plan-item-chevron{transition:none!important}}
 .task-file-card{display:flex;align-items:center;gap:10px;margin-top:9px;padding:12px;border:1px solid #e5e8ed;border-radius:10px;background:#fff}.task-file-icon{display:grid;place-items:center;width:32px;height:38px;border-radius:7px;background:#d9f5f1;color:#1eaaa0;font-weight:800}.task-file-card>div{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.task-file-card strong{font-size:13px}.task-file-card small{color:#8b93a0;font-size:11px}.task-file-card button{border:0;border-radius:7px;padding:6px 9px;background:#fff0e9;color:#d75c2c;font-size:11px;cursor:pointer}.task-backfill-card{max-width:680px;margin:20px auto;padding:16px;border:1px solid #dce6f4;border-radius:12px;background:#f5f9ff;box-shadow:0 6px 18px rgba(63,95,135,.08)}.task-backfill-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.task-backfill-card header div{display:flex;flex-direction:column;gap:4px}.task-backfill-card header span{color:#4f82c7;font-size:11px}.task-backfill-card header strong{font-size:16px}.task-backfill-card header em{padding:4px 7px;border-radius:5px;background:#e6f0ff;color:#4c81c8;font-size:10px;font-style:normal}.task-backfill-intro{color:#64748b;font-size:12px;line-height:1.5}.task-backfill-card label{display:flex;flex-direction:column;gap:5px;margin-top:10px;color:#667085;font-size:11px}.task-backfill-card textarea{box-sizing:border-box;width:100%;resize:vertical;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-card textarea:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}.task-backfill-check{flex-direction:row!important;align-items:center;gap:7px!important}.task-backfill-check input{accent-color:#4f82c7}.task-backfill-card footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.task-backfill-card footer button{border:1px solid #dce4ef;border-radius:7px;padding:7px 11px;background:#fff;color:#657080;cursor:pointer;font-size:11px}.task-backfill-card footer .task-backfill-primary{border-color:#4f82c7;background:#4f82c7;color:#fff}
 .task-backfill-artifact-field{gap:6px!important}.task-backfill-artifact{display:flex;align-items:center;gap:8px}.task-backfill-artifact-file{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:9px 10px;border:1px solid #dce4ef;border-radius:8px;background:#fff}.task-backfill-artifact-file>div{display:flex;flex-direction:column;gap:3px;min-width:0}.task-backfill-artifact-file strong{overflow:hidden;color:#303746;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.task-backfill-artifact-file small{color:#98a0ad;font-size:10px}.task-backfill-artifact-edit{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;padding:0;border:1px solid #dce4ef;border-radius:7px;background:#fff;color:#657080;cursor:pointer}.task-backfill-artifact-edit:hover{border-color:#7ca8df;color:#4f82c7;background:#f7fbff}.task-backfill-artifact-field>input{box-sizing:border-box;width:100%;border:1px solid #dce4ef;border-radius:7px;padding:8px;background:#fff;color:#303746;font:12px/1.5 PingFang SC,sans-serif;outline:0}.task-backfill-artifact-field>input:focus{border-color:#7ca8df;box-shadow:0 0 0 3px #eaf2ff}
</style>
