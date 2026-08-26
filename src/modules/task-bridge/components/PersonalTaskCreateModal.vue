<template>
  <Teleport to="body">
    <Transition name="personal-task-modal">
      <div v-if="visible" class="personal-task-modal" @click.self="requestClose">
        <section class="personal-task-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="personal-task-title">
          <header class="personal-task-modal__header">
            <div><div class="personal-task-modal__title-row"><h2 id="personal-task-title">新建个人任务</h2><span v-if="form.projectId">所属项目：{{ selectedProject?.name }}</span></div><p>创建一个可执行、可验收的任务</p></div>
            <button type="button" class="personal-task-modal__close" aria-label="关闭" @click="requestClose">×</button>
          </header>

          <form class="personal-task-modal__form" @submit.prevent="runCheck">
              <div class="personal-task-form-scroll">
                <section class="personal-task-section"><h3>基本信息</h3><div class="personal-task-grid"><label class="is-wide"><span>任务标题 <em>*</em></span><input v-model.trim="form.title" maxlength="60" placeholder="请输入任务名称" /></label><label><span>任务类型</span><select v-model="form.type"><option v-for="type in taskTypes" :key="type">{{ type }}</option></select></label><label><span>优先级</span><select v-model="form.priority"><option v-for="priority in priorities" :key="priority">{{ priority }}</option></select></label><label><span>截止时间</span><input v-model="form.dueAt" type="date" /></label></div></section>
                <section class="personal-task-section"><h3>任务目标</h3><label><span>一句话目标 <em>*</em></span><textarea v-model.trim="form.goal" rows="2" placeholder="说明这项任务要达成什么结果"></textarea></label><label><span>任务背景</span><textarea v-model.trim="form.background" rows="2" placeholder="补充任务背景或上下文（可选）"></textarea></label><button type="button" class="personal-task-ai" @click="suggestGoal">✦ 让 AI 帮我优化目标</button></section>
                <section class="personal-task-section"><h3>项目关联</h3><label v-if="projects.length">所属项目<select ref="projectSelect" :value="form.projectId" @change="handleProjectChange"><option value="">不关联项目</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label><div v-else class="personal-task-project-empty"><strong>请先去创建可关联项目</strong><span>当前可先创建不关联项目的个人任务。</span></div><div v-if="form.projectId" class="personal-task-context-wrap"><div v-if="contextLoading" class="personal-task-context-loading">正在读取项目背景…</div><div v-else-if="selectedProject && selectedProject.snapshot" class="personal-task-context"><div class="personal-task-context__top"><div><strong>项目上下文</strong><span class="personal-task-context__project">{{ selectedProject.name }}</span></div><span class="personal-task-context__version">项目背景 v{{ selectedProject.snapshot.version }} · 更新于今天</span></div><p class="personal-task-context__summary">{{ contextSummary }}</p><span class="personal-task-context__included">已带入 · 项目目标、核心约束、工作约定和关键决策</span><div class="personal-task-context__actions"><button type="button" @click="showContextOptions = !showContextOptions">{{ showContextOptions ? '收起带入内容' : '调整带入内容' }}</button><button type="button" @click="showBaseDetails = !showBaseDetails">{{ showBaseDetails ? '收起项目背景' : '查看项目背景 →' }}</button><button type="button" class="is-quiet" @click="changeProject">更换项目</button><button type="button" class="is-quiet" @click="removeProject">移除项目</button></div><div v-if="showContextOptions" class="personal-task-context__options"><strong>选择任务背景</strong><label><input v-model="contextSections.projectGoal" type="checkbox" disabled />项目目标</label><label><input v-model="contextSections.constraints" type="checkbox" disabled />核心约束</label><label><input v-model="contextSections.workingConventions" type="checkbox" />工作约定</label><label><input v-model="contextSections.activeDecisions" type="checkbox" />关键决策</label><label><input v-model="contextSections.methodology" type="checkbox" />方法论沉淀</label><div class="personal-task-context__chat-picker"><div class="personal-task-context__chat-head"><strong>选择具体聊天内容</strong><span>已选 {{ selectedChatIds.length }} 条</span></div><div class="personal-task-context__chat-filters"><input v-model.trim="chatQuery" type="search" placeholder="搜索聊天内容" aria-label="搜索聊天内容" /><select v-model="chatSpeaker" aria-label="按发言人筛选"><option value="">全部发言人</option><option v-for="speaker in chatSpeakers" :key="speaker" :value="speaker">{{ speaker }}</option></select><select v-model="chatDate" aria-label="按日期筛选"><option value="">全部日期</option><option v-for="date in chatDates" :key="date" :value="date">{{ date }}</option></select></div><div class="personal-task-context__chat-list"><label v-for="chat in filteredChats" :key="chat.id" class="personal-task-context__chat-item" :class="{ selected: selectedChatIds.includes(chat.id) }"><input type="checkbox" :checked="selectedChatIds.includes(chat.id)" @change="toggleChat(chat.id)" /><span><strong>{{ chat.sender }}</strong><small>{{ chat.date }}</small><em>{{ chat.text }}</em></span></label><p v-if="!filteredChats.length" class="personal-task-context__chat-empty">没有找到匹配的聊天内容</p></div><small class="personal-task-context__chat-hint">未选择具体聊天时，仍按上方默认项目背景内容带入。</small></div></div><div v-if="showBaseDetails" class="personal-task-context__details"><strong>项目背景 v{{ selectedProject.snapshot.version }}</strong><span>{{ selectedProject.snapshot.projectBase }}</span><small>触发规则：{{ selectedProject.snapshot.trigger }}</small></div></div><div v-else class="personal-task-context-empty"><strong>该项目暂未创建项目背景</strong><span>任务仍可继续创建，仅使用自身填写的上下文。</span></div></div></section>
                <section class="personal-task-section"><h3>工作范围</h3><div class="personal-task-grid"><label>包含范围<textarea v-model.trim="form.inScope" rows="3" placeholder="明确需要完成的内容"></textarea></label><label>不包含范围<textarea v-model.trim="form.outOfScope" rows="3" placeholder="明确不在本次任务内的内容"></textarea></label></div></section>
                <section class="personal-task-section"><h3>交付物与验收标准</h3><label><span>交付物 <em>*</em></span><input v-model.trim="form.deliverable" placeholder="例如：竞品调研报告 · 在线文档" /></label><label><span>验收标准 <em>*</em></span><textarea v-model.trim="form.acceptance" rows="3" placeholder="写下可验证、可评审的完成标准"></textarea></label></section>
                <section class="personal-task-section"><h3>协作成员</h3><MemberPicker :model-value="form.members" @update:model-value="updateMembers" /><small class="personal-task-hint">AI 推荐组合会根据任务目标预选合适的联系人和数字人。</small></section>
                <section class="personal-task-section"><h3>负责人和可见范围</h3><div class="personal-task-grid"><label>负责人<input value="我" readonly /></label><label>任务卡片可见范围<select v-model="form.visibility"><option value="project_members">项目成员</option><option value="task_members">任务成员</option><option value="private">仅自己</option></select></label><label>任务背景可见范围<select v-model="form.snapshotVisibility"><option value="task_members">任务成员</option><option value="project_members">项目成员</option></select></label></div><small class="personal-task-hint">任务卡片可见范围不等于任务背景可见范围。</small></section>
              </div>
              <aside class="personal-task-check-sidebar">
                <div class="personal-task-check-sidebar__header"><h3>发布前检查</h3><p>任务创建后将冻结为任务背景 v1</p></div>
                <div class="personal-task-check-list"><div v-for="item in checkItems" :key="item.label" class="personal-task-check-row" :class="`is-${item.status}`"><span>{{ item.status === 'passed' ? '✓' : '!' }}</span><div><strong>{{ item.label }}</strong><small>{{ item.message }}</small></div></div></div>
                <div class="personal-task-check-note"><strong>创建后会发生什么？</strong><span>任务会进入个人任务对话；选择项目后，也会同步出现在对应协作项目中。</span></div>
              </aside>
              <p v-if="formError" class="personal-task-error">{{ formError }}</p>
              <footer class="personal-task-modal__footer"><span>草稿自动保存于刚刚</span><div><button type="button" class="personal-task-secondary" @click="requestClose">取消</button><button type="button" class="personal-task-secondary" @click="saveDraft">保存草稿</button><button type="submit" class="personal-task-primary">确认并创建任务</button></div></footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import MemberPicker from '@/shared/components/MemberPicker.vue'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'created'])
const taskBridgeStore = useTaskBridgeStore()
const formError = ref('')
const contextLoading = ref(false)
const showContextOptions = ref(false)
const showBaseDetails = ref(false)
const projectSelect = ref(null)
const chatQuery = ref('')
const chatSpeaker = ref('')
const chatDate = ref('')
const selectedChatIds = ref([])
const taskTypes = ['产品', '设计', '研发', '研究', '内容', '运营', '其他']
const priorities = ['低', '中', '高', '紧急']
const form = reactive({ title: 'Q3 竞品调研报告', type: '研究', priority: '中', dueAt: '2026-08-20', goal: '梳理 5 家同类产品的核心功能、定价与差异化策略，形成可评审的竞品分析结论。', background: '围绕本季度产品规划，补充市场信息与竞品动态，为后续方案评审提供依据。', projectId: '', inScope: '竞品功能、定价、目标用户、核心体验与市场策略对比。', outOfScope: '不包含未经验证的用户规模数据，也不延伸到完整商业计划。', deliverable: '竞品分析-Q3.md · 在线文档', acceptance: '覆盖 5 家主要竞品；关键结论均标注来源；输出功能与定价对比表，并提出至少 3 条可执行建议。', agent: '团队助理', members: [{ id: 'agent-assistant', name: '团队助理', initial: '助', type: 'agent', meta: '任务拆解与协作同步' }], visibility: 'project_members', snapshotVisibility: 'task_members' })
const contextSections = reactive({ projectGoal: true, constraints: true, workingConventions: true, activeDecisions: true, methodology: false })
const projects = computed(() => Object.values(taskBridgeStore.projects).filter((project) => !project.isPersonalOnly && !String(project.id).startsWith('personal-task-')))
const selectedProject = computed(() => projects.value.find((project) => project.id === form.projectId) || null)
watch([() => props.visible, projects], ([visible]) => {
  if (!visible || form.projectId) return
  const defaultProject = projects.value.find((project) => String(project.name).trim() === '项目一')
  if (!defaultProject) return
  form.projectId = String(defaultProject.id)
  contextLoading.value = true
  window.setTimeout(() => { contextLoading.value = false }, 360)
}, { immediate: true })
const contextSummary = computed(() => { const snapshot = selectedProject.value?.snapshot; const constraintCount = snapshot?.constraints?.length || 4; const decisionCount = snapshot?.activeDecisions?.length || 2; return `已带入：项目目标、${constraintCount} 条约束、${decisionCount} 条关键决策` })
const includedSections = computed(() => Object.entries(contextSections).filter(([, enabled]) => enabled).map(([key]) => key))
const demoChats = [
  { id: 'context-chat-1', sender: '我', text: '请基于本次项目目标，明确调研范围、负责人和验收标准。', date: '2026-08-18' },
  { id: 'context-chat-2', sender: '团队助理', text: '已识别项目目标，并建议先完成竞品功能与定价维度对比。', date: '2026-08-18' },
  { id: 'context-chat-3', sender: '产品数字人', text: '我会整理主要竞品资料，输出可评审的对比结论。', date: '2026-08-19' },
  { id: 'context-chat-4', sender: '设计数字人', text: '建议补充核心流程和关键异常状态，便于后续评审。', date: '2026-08-19' },
]
const contextChats = computed(() => {
  const discussion = selectedProject.value?.discussion || []
  if (!discussion.length) return demoChats
  return discussion.map((message, index) => ({
    id: message.id || `project-chat-${index}`,
    sender: message.type === 'user' ? '我' : '团队助理',
    text: message.text || message.content || '项目讨论内容',
    date: message.date || '2026-08-19',
  }))
})
const chatSpeakers = computed(() => [...new Set(contextChats.value.map((chat) => chat.sender))])
const chatDates = computed(() => [...new Set(contextChats.value.map((chat) => chat.date))])
const filteredChats = computed(() => contextChats.value.filter((chat) => {
  const matchesQuery = !chatQuery.value || `${chat.sender}${chat.text}`.toLowerCase().includes(chatQuery.value.toLowerCase())
  const matchesSpeaker = !chatSpeaker.value || chat.sender === chatSpeaker.value
  const matchesDate = !chatDate.value || chat.date === chatDate.value
  return matchesQuery && matchesSpeaker && matchesDate
}))
const selectedChats = computed(() => contextChats.value.filter((chat) => selectedChatIds.value.includes(chat.id)))
const checkItems = computed(() => [
  { label: '任务标题', status: form.title ? 'passed' : 'blocked', message: form.title ? '已填写' : '请补充任务标题' },
  { label: '任务目标', status: form.goal ? 'passed' : 'blocked', message: form.goal ? '已填写' : '请补充一句话目标' },
  { label: '项目关联', status: 'passed', message: selectedProject.value ? `已带入项目背景 v${selectedProject.value.snapshot.version}` : '未关联项目，可独立执行' },
  { label: '负责人', status: 'passed', message: '我' },
  { label: '协作成员', status: form.members.length ? 'passed' : 'warning', message: form.members.length ? `已选择 ${form.members.length} 位成员` : '可选择联系人或数字人' },
  { label: '交付物', status: form.deliverable ? 'passed' : 'blocked', message: form.deliverable ? '已添加 1 项交付物' : '请至少添加一项交付物' },
  { label: '验收标准', status: form.acceptance ? 'passed' : 'blocked', message: form.acceptance ? '已添加可验证标准' : '请至少添加一项可验证的验收标准' },
  { label: '权限设置', status: 'passed', message: '已设置任务卡片和任务背景可见范围' },
])
const hasBlocked = computed(() => checkItems.value.some((item) => item.status === 'blocked'))

function requestClose() {
  emit('close')
}
function saveDraft() { ElMessage.success('任务草稿已保存'); emit('close') }
function suggestGoal() { if (!form.goal && form.title) form.goal = `围绕「${form.title}」完成关键信息梳理，并形成可执行、可评审的交付结果。` }
function updateMembers(members) { form.members = members; form.agent = members.find((member) => member.type === 'agent')?.name || '团队助理' }
function handleProjectChange(event) { form.projectId = event.target.value; showContextOptions.value = false; showBaseDetails.value = false; chatQuery.value = ''; chatSpeaker.value = ''; chatDate.value = ''; selectedChatIds.value = []; if (!form.projectId) return; contextLoading.value = true; window.setTimeout(() => { contextLoading.value = false }, 360) }
function changeProject() { showContextOptions.value = false; showBaseDetails.value = false; nextTick(() => projectSelect.value?.focus()) }
function removeProject() { form.projectId = ''; showContextOptions.value = false; showBaseDetails.value = false; selectedChatIds.value = []; ElMessage.success('已移除项目关联 · 可重新选择') }
function toggleChat(chatId) { selectedChatIds.value = selectedChatIds.value.includes(chatId) ? selectedChatIds.value.filter((id) => id !== chatId) : [...selectedChatIds.value, chatId] }
function runCheck() { formError.value = ''; if (hasBlocked.value) { formError.value = '请补齐带 * 的必填信息后再创建任务'; return }; createTask() }
function createTask() { const payload = { ...form, projectBaseVersion: selectedProject.value?.snapshot?.version || null, includedSections: form.projectId ? includedSections.value : [], includedChatIds: form.projectId ? selectedChatIds.value : [], contextMessages: form.projectId ? selectedChats.value : [], contextConstraints: form.projectId ? ['交付物必须可访问、可评审，并与任务目标保持一致。', '关键结论保留来源，无法验证的信息需要明确标注。', '发现阻塞依赖时及时同步，不等待任务临近截止才处理。'] : [] }; const result = taskBridgeStore.createPersonalTask(payload); if (!result) { formError.value = '任务创建失败，请稍后重试'; return }; emit('created', result) }
</script>

<style scoped>
.personal-task-modal{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:32px;background:rgba(20,30,45,.38)}.personal-task-modal__dialog{width:760px;max-width:calc(100vw - 48px);max-height:calc(100vh - 64px);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 20px 60px rgba(20,30,45,.18);color:#17202b;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC',sans-serif}.personal-task-modal__header{display:flex;justify-content:space-between;gap:20px;padding:24px 28px 18px;border-bottom:1px solid #e7ebef}.personal-task-modal__header h2{margin:0;font-size:20px}.personal-task-modal__header p{margin:6px 0 0;color:#7b8592;font-size:13px}.personal-task-modal__header span{display:inline-block;margin-top:10px;color:#3157d5;font-size:12px}.personal-task-modal__close{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#7b8592;font-size:24px;cursor:pointer}.personal-task-modal__close:hover{background:#f3f5f7}.personal-task-modal__form{display:flex;min-height:0;flex-direction:column}.personal-task-form-scroll{overflow:auto;padding:8px 28px 0}.personal-task-section{padding:17px 0;border-bottom:1px solid #eef1f3}.personal-task-section h3{margin:0 0 12px;font-size:14px}.personal-task-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.personal-task-section label{display:flex;min-width:0;flex-direction:column;gap:6px;color:#596575;font-size:12px}.personal-task-section label.is-wide{grid-column:1 / -1}.personal-task-section em{color:#c45454;font-style:normal}.personal-task-section input,.personal-task-section select,.personal-task-section textarea{box-sizing:border-box;width:100%;border:1px solid #e7ebef;border-radius:7px;padding:9px 10px;outline:0;background:#fff;color:#17202b;font:13px/1.45 inherit;resize:vertical}.personal-task-section input:focus,.personal-task-section select:focus,.personal-task-section textarea:focus{border-color:#3157d5;box-shadow:0 0 0 3px rgba(49,87,213,.1)}.personal-task-section textarea{min-height:62px}.personal-task-ai{margin-top:10px;border:0;background:transparent;color:#3157d5;font-size:12px;cursor:pointer}.personal-task-context{display:flex;flex-direction:column;gap:5px;margin-top:11px;padding:10px 12px;border-radius:8px;background:#f3f6ff;color:#3157d5;font-size:12px}.personal-task-context span,.personal-task-hint{color:#7b8592;font-size:11px}.personal-task-hint{display:block;margin-top:10px}.personal-task-modal__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 28px;background:#fafbfc;color:#929aa5;font-size:11px}.personal-task-modal__footer div{display:flex;gap:8px}.personal-task-secondary,.personal-task-primary{border-radius:7px;padding:9px 13px;font-size:12px;cursor:pointer}.personal-task-secondary{border:1px solid #e0e5ea;background:#fff;color:#596575}.personal-task-primary{border:1px solid #3157d5;background:#3157d5;color:#fff}.personal-task-primary:disabled{opacity:.45;cursor:not-allowed}.personal-task-error{margin:10px 28px 0;color:#c45454;font-size:12px}.personal-task-checking{overflow:auto}.personal-task-checking__head{padding:22px 28px 14px}.personal-task-checking__head span{display:block;font-size:17px;font-weight:650}.personal-task-checking__head small{display:block;margin-top:5px;color:#7b8592;font-size:12px}.personal-task-check-row{display:grid;grid-template-columns:24px 100px 1fr;align-items:center;gap:8px;margin:0 28px;padding:12px 0;border-bottom:1px solid #eef1f3;font-size:12px}.personal-task-check-row>span{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#e7f5ee;color:#2b8a65;font-weight:700}.personal-task-check-row.is-blocked>span{background:#fdecec;color:#c45454}.personal-task-check-row small{color:#7b8592}.personal-task-success{display:flex;align-items:center;flex-direction:column;padding:72px 28px}.personal-task-success__icon{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#e7f5ee;color:#2b8a65;font-size:28px}.personal-task-success h2{margin:18px 0 5px}.personal-task-success p{margin:0;color:#596575}.personal-task-success small{margin-top:9px;color:#7b8592}.personal-task-success button{margin-top:24px}.personal-task-modal-enter-active,.personal-task-modal-leave-active{transition:opacity .2s ease}.personal-task-modal-enter-active .personal-task-modal__dialog,.personal-task-modal-leave-active .personal-task-modal__dialog{transition:transform .24s cubic-bezier(.22,1,.36,1),opacity .2s ease}.personal-task-modal-enter-from,.personal-task-modal-leave-to{opacity:0}.personal-task-modal-enter-from .personal-task-modal__dialog,.personal-task-modal-leave-to .personal-task-modal__dialog{opacity:0;transform:translateY(10px) scale(.98)}
@media (max-width:700px){.personal-task-modal{padding:12px}.personal-task-modal__dialog{max-width:100%;max-height:calc(100vh - 24px)}.personal-task-grid{grid-template-columns:1fr}.personal-task-section label.is-wide{grid-column:auto}.personal-task-modal__footer{align-items:stretch;flex-direction:column}.personal-task-modal__footer div{justify-content:flex-end;flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){.personal-task-modal-enter-active,.personal-task-modal-leave-active,.personal-task-modal-enter-active .personal-task-modal__dialog,.personal-task-modal-leave-active .personal-task-modal__dialog{transition:none}}
/* 与协作「创建项目背景」弹窗统一：容器、标题区、表单节奏、底部操作区 */
:global(body) { --personal-task-orange: #ff621f; --personal-task-ink: #303746; --personal-task-secondary: #87909d; --personal-task-border: #e5e5e5; }
.personal-task-modal { padding: 32px; background: rgba(0, 0, 0, .4); }
.personal-task-modal__dialog { width: min(980px, 100%); height: min(800px, calc(100vh - 64px)); min-height: 640px; max-width: none; max-height: none; border: 1px solid #e5e5e5; border-radius: 17px; background: #f7f7f7; box-shadow: 0 22px 70px rgba(0, 0, 0, .18); color: var(--personal-task-ink); }
.personal-task-modal__header { height: 76px; flex: 0 0 76px; align-items: center; padding: 0 27px; border-bottom-color: var(--personal-task-border); }
.personal-task-modal__header h2 { margin: 0 0 5px; color: var(--personal-task-ink); font-size: 19px; letter-spacing: -.03em; font-weight: 760; }
.personal-task-modal__header p { margin: 0; color: var(--personal-task-secondary); font-size: 12px; }
.personal-task-modal__header span { margin-top: 7px; color: var(--personal-task-orange); font-size: 11px; }
.personal-task-modal__close { width: 32px; height: 32px; color: var(--personal-task-secondary); border-radius: 8px; font-size: 25px; line-height: 1; }
.personal-task-modal__close:hover { color: var(--personal-task-ink); background: #ededed; }
.personal-task-modal__form { flex: 1; }
.personal-task-form-scroll { padding: 0 30px 30px; }
.personal-task-section { padding: 25px 0; margin: 0; border-bottom: 1px solid #eef1f3; }
.personal-task-section:first-child { padding-top: 25px; }
.personal-task-section:last-child { border-bottom: 0; }
.personal-task-section h3 { margin: 0 0 16px; color: var(--personal-task-ink); font-size: 15px; font-weight: 750; }
.personal-task-grid { gap: 13px; }
.personal-task-section label { gap: 7px; color: #5f6975; font-size: 11px; font-weight: 650; }
.personal-task-section input, .personal-task-section select, .personal-task-section textarea { border-color: #dfe4e9; border-radius: 8px; padding: 10px 11px; color: var(--personal-task-ink); background: #fff; font-size: 13px; transition: border .15s, box-shadow .15s; }
.personal-task-section input, .personal-task-section select { height: 40px; }
.personal-task-section textarea { min-height: 75px; line-height: 1.6; }
.personal-task-section input:focus, .personal-task-section select:focus, .personal-task-section textarea:focus { border-color: #f09a78; box-shadow: 0 0 0 3px #fff0e9; }
.personal-task-ai { margin-top: 10px; padding: 7px 10px; color: #d75c2c; background: #fff0e9; border: 1px solid #ffd8c8; border-radius: 7px; font-size: 11px; }
.personal-task-context { padding: 11px; margin-top: 12px; background: #fff8f4; border: 1px solid #ffd8c8; border-radius: 9px; color: #d75c2c; }
.personal-task-context span, .personal-task-hint { color: var(--personal-task-secondary); font-size: 10px; }
.personal-task-hint { margin-top: 8px; }
.personal-task-error { margin: 10px 30px 0; color: #c45454; font-size: 11px; }
.personal-task-modal__footer { height: 73px; flex: 0 0 73px; padding: 0 27px; border-top: 1px solid var(--personal-task-border); background: #f7f7f7; color: #8a949f; font-size: 10px; }
.personal-task-modal__footer div { gap: 9px; }
.personal-task-secondary, .personal-task-primary { height: 36px; padding: 0 14px; border-radius: 8px; font-size: 12px; }
.personal-task-secondary { color: #5e6875; background: #fff; border: 1px solid #dfe4e9; }
.personal-task-primary { color: #fff; background: var(--personal-task-orange); border: 1px solid var(--personal-task-orange); box-shadow: 0 5px 12px rgba(255, 98, 31, .2); font-weight: 650; }
.personal-task-primary:hover { background: #e95517; border-color: #e95517; }
.personal-task-checking { flex: 1; }
.personal-task-checking__head { padding: 25px 30px 16px; }
.personal-task-checking__head span { color: var(--personal-task-ink); font-size: 15px; font-weight: 750; }
.personal-task-checking__head small { color: var(--personal-task-secondary); font-size: 11px; }
.personal-task-check-row { margin: 0 30px; padding: 12px 0; border-bottom-color: #eef1f3; font-size: 11px; }
.personal-task-success { min-height: 100%; box-sizing: border-box; justify-content: center; background: #f7f7f7; }
.personal-task-success h2 { color: var(--personal-task-ink); font-size: 19px; }
.personal-task-success p, .personal-task-success small { color: var(--personal-task-secondary); }
.personal-task-modal__dialog button:focus-visible, .personal-task-modal__dialog input:focus-visible, .personal-task-modal__dialog textarea:focus-visible, .personal-task-modal__dialog select:focus-visible { outline: 2px solid #ff9c71; outline-offset: 2px; }
.personal-task-modal__form { display: grid; grid-template-columns: minmax(0, 1fr) 285px; grid-template-rows: minmax(0, 1fr) auto auto; }
.personal-task-form-scroll { grid-column: 1; grid-row: 1; min-width: 0; }
.personal-task-check-sidebar { grid-column: 2; grid-row: 1; min-width: 0; overflow-y: auto; padding: 23px 20px; background: #ededed; border-left: 1px solid #dedede; }
.personal-task-check-sidebar__header h3 { margin: 0 0 6px; color: var(--personal-task-ink); font-size: 15px; }
.personal-task-check-sidebar__header p { margin: 0 0 18px; color: var(--personal-task-secondary); font-size: 11px; line-height: 1.45; }
.personal-task-check-list { border-top: 1px solid #dedede; }
.personal-task-check-sidebar .personal-task-check-row { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 11px 0; border-bottom: 1px solid #dedede; }
.personal-task-check-sidebar .personal-task-check-row > span { width: 17px; height: 17px; flex: 0 0 17px; display: grid; place-items: center; border-radius: 50%; background: #dff2e9; color: #2b8a65; font-size: 10px; font-weight: 800; }
.personal-task-check-sidebar .personal-task-check-row.is-blocked > span { background: #fff1d8; color: #a36b1c; }
.personal-task-check-sidebar .personal-task-check-row strong, .personal-task-check-sidebar .personal-task-check-row small { display: block; }
.personal-task-check-sidebar .personal-task-check-row strong { color: var(--personal-task-ink); font-size: 11px; font-weight: 650; }
.personal-task-check-sidebar .personal-task-check-row small { margin-top: 4px; color: var(--personal-task-secondary); font-size: 10px; line-height: 1.4; }
.personal-task-check-note { display: flex; flex-direction: column; gap: 8px; padding: 13px; margin-top: 22px; background: #f7f7f7; border: 1px solid #dedede; border-radius: 9px; }
.personal-task-check-note strong { color: var(--personal-task-ink); font-size: 11px; }
.personal-task-check-note span { color: var(--personal-task-secondary); font-size: 10px; line-height: 1.6; }
.personal-task-modal__form > .personal-task-error { grid-column: 1; grid-row: 2; }
.personal-task-modal__form > .personal-task-modal__footer { grid-column: 1 / -1; grid-row: 3; }
@media (max-width:700px) {
  .personal-task-modal__form { display: flex; flex-direction: column; }
  .personal-task-check-sidebar { display: none; }
  .personal-task-modal__form > .personal-task-error, .personal-task-modal__form > .personal-task-modal__footer { flex: 0 0 auto; }
}
.personal-task-modal__title-row { display: flex; align-items: center; gap: 10px; }
.personal-task-modal__title-row span { display: inline-block; margin: 0; padding: 3px 7px; border-radius: 5px; background: #fff0e9; color: #d75c2c; font-size: 10px; line-height: 1.2; white-space: nowrap; }
.personal-task-context-wrap { margin-top: 12px; }
.personal-task-context-loading, .personal-task-context-empty { display: flex; flex-direction: column; gap: 5px; padding: 14px; color: var(--personal-task-secondary); background: #f7f8fa; border: 1px solid #e7ebef; border-radius: 10px; font-size: 11px; line-height: 1.5; }
.personal-task-context-loading { color: #87909d; }
.personal-task-context-empty strong { color: var(--personal-task-ink); font-size: 11px; }.personal-task-context-empty span { font-size: 10px; }
.personal-task-project-empty { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px; color: #d75c2c; background: #fff8f4; border: 1px solid #ffd8c8; border-radius: 8px; font-size: 11px; line-height: 1.5; }
.personal-task-project-empty strong { font-size: 11px; font-weight: 650; }
.personal-task-project-empty span { color: #a47b6d; font-size: 10px; }
.personal-task-context { padding: 14px; margin-top: 0; color: var(--personal-task-ink); background: #f7f8fa; border: 1px solid #e7ebef; border-radius: 10px; }
.personal-task-context__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.personal-task-context__top > div { display: flex; min-width: 0; flex-direction: column; gap: 5px; }.personal-task-context__top strong { font-size: 12px; }.personal-task-context__project { color: var(--personal-task-ink); font-size: 12px; font-weight: 650; }.personal-task-context__version { padding: 3px 7px; color: #3157d5; background: #eef2ff; border-radius: 5px; font-size: 10px; white-space: nowrap; }
.personal-task-context__summary { margin: 12px 0 5px; color: var(--personal-task-ink); font-size: 11px; line-height: 1.5; }.personal-task-context__included { display: block; color: #2b8a65; font-size: 10px; line-height: 1.5; }
.personal-task-context__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 13px; }.personal-task-context__actions button { padding: 0; color: #3157d5; background: transparent; border: 0; outline: 0; font-size: 10px; cursor: pointer; }.personal-task-context__actions button:hover { color: #2445b3; }.personal-task-context__actions button.is-quiet { color: #87909d; }.personal-task-context__actions button:focus-visible { outline: 2px solid #ffbda3; outline-offset: 3px; border-radius: 3px; }
.personal-task-context__options { display: grid; gap: 8px; padding: 12px; margin-top: 12px; background: #fff; border: 1px solid #e7ebef; border-radius: 8px; }.personal-task-context__options strong { margin-bottom: 2px; color: var(--personal-task-ink); font-size: 11px; }.personal-task-context__options label { display: flex; align-items: center; flex-direction: row; gap: 7px; color: #596575; font-size: 10px; font-weight: 500; }.personal-task-context__options input { width: 14px; height: 14px; accent-color: #ff621f; }.personal-task-context__options input:disabled { opacity: .75; }
.personal-task-context__details { display: flex; flex-direction: column; gap: 6px; padding: 12px; margin-top: 12px; color: #596575; background: #fff; border: 1px solid #e7ebef; border-radius: 8px; font-size: 10px; line-height: 1.55; }.personal-task-context__details strong { color: var(--personal-task-ink); font-size: 11px; }.personal-task-context__details small { color: #87909d; font-size: 9px; }
.personal-task-context__chat-picker { display: flex; flex-direction: column; gap: 9px; padding-top: 12px; margin-top: 4px; border-top: 1px solid #eef1f3; }.personal-task-context__chat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.personal-task-context__chat-head strong { color: var(--personal-task-ink); font-size: 11px; }.personal-task-context__chat-head span { color: #87909d; font-size: 9px; }
.personal-task-context__chat-filters { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(90px, .8fr) minmax(90px, .8fr); gap: 6px; }.personal-task-context__chat-filters input, .personal-task-context__chat-filters select { box-sizing: border-box; width: 100%; height: 30px; min-width: 0; padding: 0 8px; color: var(--personal-task-ink); background: #fff; border: 1px solid #e7ebef; border-radius: 6px; outline: 0; font-size: 10px; }.personal-task-context__chat-filters input:focus, .personal-task-context__chat-filters select:focus { border-color: #f09a78; box-shadow: 0 0 0 2px #fff0e9; }
.personal-task-context__chat-list { display: grid; gap: 5px; max-height: 185px; overflow-y: auto; }.personal-task-context__chat-item { display: flex; align-items: flex-start; gap: 7px; padding: 8px; color: #596575; background: #fff; border: 1px solid #e7ebef; border-radius: 7px; cursor: pointer; }.personal-task-context__chat-item:hover, .personal-task-context__chat-item.selected { background: #fff8f4; border-color: #ffd8c8; }.personal-task-context__chat-item input { width: 14px; height: 14px; flex: 0 0 14px; margin: 1px 0 0; accent-color: #ff621f; }.personal-task-context__chat-item > span { display: grid; min-width: 0; grid-template-columns: auto auto; column-gap: 6px; }.personal-task-context__chat-item strong { color: var(--personal-task-ink); font-size: 10px; }.personal-task-context__chat-item small { color: #a0a8b2; font-size: 9px; }.personal-task-context__chat-item em { grid-column: 1 / -1; margin-top: 4px; color: #596575; font-style: normal; font-size: 10px; line-height: 1.45; }.personal-task-context__chat-empty { padding: 12px; margin: 0; color: #a0a8b2; text-align: center; font-size: 10px; }.personal-task-context__chat-hint { color: #87909d; font-size: 9px; line-height: 1.4; }
@media (max-width:700px) { .personal-task-context__top { flex-direction: column; }.personal-task-context__chat-filters { grid-template-columns: 1fr 1fr; }.personal-task-context__chat-filters input { grid-column: 1 / -1; } }
</style>
