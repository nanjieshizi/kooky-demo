<template>
  <Teleport to="body">
    <div v-if="visible" class="project-backdrop" role="presentation" @mousedown.self="requestClose">
      <section class="project-modal" role="dialog" aria-modal="true" aria-label="创建项目底座">
        <header class="project-header">
          <div>
            <h2>创建项目底座</h2>
            <p>建立项目长期共享的目标、规则与协作共识</p>
          </div>
          <button ref="closeButton" class="icon-close" aria-label="关闭" @click="requestClose">×</button>
        </header>

        <div class="project-content">
          <main class="project-form">
            <div class="form-section">
              <div class="section-heading"><div><span class="eyebrow">01</span><h3>项目定位</h3></div><span class="section-note">建立共同目标</span></div>
              <label class="field"><span>项目名称 <b>*</b></span><input v-model="form.name" placeholder="例如：任务桥 · Task Bridge" @input="dirty = true" /><small v-if="errors.name">{{ errors.name }}</small></label>
              <label class="field"><span>一句话目标 <b>*</b></span><textarea v-model="form.goal" placeholder="用一句话描述这个项目要解决什么问题" rows="3" @input="dirty = true" /><small v-if="errors.goal">{{ errors.goal }}</small></label>
              <div class="ai-action-row">
                <button class="ai-button" :disabled="aiLoading" @click="generateSuggestion">{{ aiLoading ? '⌛ 正在提炼…' : '✦ 让 AI 从讨论中提炼' }}</button>
                <span>不会自动覆盖你的内容</span>
              </div>
              <div v-if="showSuggestion" class="suggestion-panel">
                <div class="suggestion-title"><span>✦</span><strong>AI 建议</strong></div>
                <p>从最近 14 条项目讨论中识别到 3 个目标候选，建议采用当前版本。</p>
                <div><button class="link-button" @click="adoptSuggestion">采用 AI 建议</button><button class="quiet-button" @click="showSuggestion = false">忽略</button></div>
              </div>
              <label class="field"><span>项目背景</span><textarea v-model="form.background" placeholder="补充项目缘起、上下文或已知限制（可选）" rows="3" @input="dirty = true" /></label>
            </div>

            <div class="form-section">
              <div class="section-heading"><div><span class="eyebrow">02</span><h3>项目边界</h3></div><span class="section-note">防止范围无限扩张</span></div>
              <div class="field-grid two"><label class="field"><span>目标用户</span><input v-model="form.users" placeholder="产品、设计与研发团队" @input="dirty = true" /></label><label class="field"><span>成功标准 <em>建议填写</em></span><input v-model="form.success" placeholder="例如：首轮评审通过率 ≥ 80%" @input="dirty = true" /></label></div>
              <div class="field-grid two"><label class="field"><span>范围内</span><textarea v-model="form.inScope" rows="3" placeholder="要解决的事情" @input="dirty = true" /></label><label class="field"><span>不在范围内</span><textarea v-model="form.outScope" rows="3" placeholder="明确不处理的事情" @input="dirty = true" /></label></div>
            </div>

            <div class="form-section">
              <div class="section-heading"><div><span class="eyebrow">03</span><h3>核心约束</h3></div><span class="section-note">至少选择一条</span></div>
              <div class="constraint-list"><button v-for="option in constraintOptions" :key="option" class="constraint" :class="{ selected: form.constraints.includes(option) }" @click="toggleConstraint(option)">{{ form.constraints.includes(option) ? '✓ ' : '' }}{{ option }}</button></div>
              <small v-if="errors.constraints" class="standalone-error">{{ errors.constraints }}</small>
            </div>

            <div class="form-section">
              <div class="section-heading"><div><span class="eyebrow">04</span><h3>团队成员与角色</h3></div><span class="section-note">至少添加一名成员</span></div>
              <MemberPicker v-model="form.members" />
              <small v-if="errors.members" class="standalone-error">{{ errors.members }}</small>
            </div>

            <div class="form-section last-section">
              <div class="section-heading"><div><span class="eyebrow">05</span><h3>工作约定</h3></div><span class="section-note">让协作有章可循</span></div>
              <div class="field-grid two"><label class="field"><span>交付格式</span><input v-model="form.delivery" @input="dirty = true" /></label><label class="field"><span>评审流程</span><select v-model="form.review" @change="dirty = true"><option>提交 → 产品评审 → 修改 → 通过</option><option>提交 → 负责人确认 → 发布</option><option>异步评审 → 统一记录结论</option></select></label></div>
            </div>
          </main>

          <aside class="check-sidebar">
            <div class="check-header"><h3>发布前检查</h3><p>底座发布后将成为项目公共上下文</p></div>
            <div class="check-list"><div v-for="check in checks" :key="check.label" class="check-row"><span class="check-icon" :class="check.status">{{ check.status === 'warning' ? '!' : '✓' }}</span><div><strong>{{ check.label }}</strong><small>{{ check.hint }}</small></div></div></div>
            <div class="freeze-card"><h4>发布后会发生什么？</h4><ul><li>生成项目底座 v1</li><li>成为任务创建时的可选上下文</li><li>新任务可引用目标与约束</li><li>后续修改会生成新版本</li></ul></div>
          </aside>
        </div>

        <footer class="project-footer"><span>草稿自动保存于刚刚 · 项目成员可见</span><div><button class="secondary-button" @click="saveDraft">保存草稿</button><button class="primary-button" @click="createBase">创建项目底座</button></div></footer>
        <div v-if="toast" class="modal-toast" role="status">{{ toast }}</div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import MemberPicker from '@/shared/components/MemberPicker.vue'

defineOptions({ name: 'CreateProjectBaseModal' })
const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible', 'created'])

const dirty = ref(false)
const aiLoading = ref(false)
const showSuggestion = ref(false)
const toast = ref('')
const closeButton = ref(null)
const errors = reactive({ name: '', goal: '', constraints: '', members: '' })
const constraintOptions = ['讨论来源必须可追溯', '任务创建必须人工确认', '项目上下文按版本冻结', '私密内容不可越权', '自定义约束']
const form = reactive({ name: '任务桥 · Task Bridge', goal: '让团队把讨论中的共识，稳定地转化为可执行、可验收的任务。', background: '', users: '产品、设计与研发团队', success: '', inScope: '讨论共识沉淀、任务拆解与验收标准', outScope: '替代团队决策、自动发布未经确认的任务', constraints: ['讨论来源必须可追溯', '任务创建必须人工确认', '项目上下文按版本冻结', '私密内容不可越权'], delivery: 'HTML 原型 + Markdown 规格', review: '提交 → 产品评审 → 修改 → 通过', members: [{ id: 'contact-owner', initial: '王', name: '王靖博', role: '项目负责人', responsibility: '管理目标、决策与底座版本', type: 'contact' }, { id: 'agent-product', initial: '产', name: '产品数字人', role: '调研协作', responsibility: '负责竞品调研与结论整理', type: 'agent' }, { id: 'agent-design', initial: '设', name: '设计数字人', role: '原型协作', responsibility: '负责流程、原型与体验评审', type: 'agent' }] })

const checks = computed(() => [
  { label: '项目名称与目标', status: form.name && form.goal ? 'passed' : 'warning', hint: form.name && form.goal ? '信息完整' : '需要填写' },
  { label: '项目背景与边界', status: form.inScope && form.outScope ? 'passed' : 'warning', hint: form.inScope && form.outScope ? '已填写' : '建议补充范围' },
  { label: '核心约束', status: form.constraints.length ? 'passed' : 'warning', hint: form.constraints.length ? `已添加 ${form.constraints.length} 条` : '至少添加 1 条' },
  { label: '团队成员', status: form.members.length ? 'passed' : 'warning', hint: `${form.members.length} 位成员已加入` },
  { label: '成功标准', status: form.success ? 'passed' : 'warning', hint: form.success ? '已填写' : '建议至少添加 1 项可量化标准' },
])

watch(() => props.visible, (isVisible) => {
  if (isVisible) nextTick(() => closeButton.value?.focus())
})

function showToast(message) { toast.value = message; window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => { toast.value = '' }, 2200) }
function toggleConstraint(option) { const index = form.constraints.indexOf(option); if (index >= 0) form.constraints.splice(index, 1); else form.constraints.push(option); dirty.value = true; errors.constraints = '' }
function generateSuggestion() { aiLoading.value = true; window.setTimeout(() => { aiLoading.value = false; showSuggestion.value = true }, 650) }
function adoptSuggestion() { form.goal = '让团队把讨论中的共识，稳定地转化为可执行、可验收的任务。'; showSuggestion.value = false; dirty.value = true; showToast('已采用 AI 建议') }
function validate() { errors.name = form.name.trim() ? '' : '请输入项目名称'; errors.goal = form.goal.trim() ? '' : '请输入一句话目标'; errors.constraints = form.constraints.length ? '' : '至少选择一条核心约束'; errors.members = form.members.length ? '' : '至少添加一名项目成员'; return !errors.name && !errors.goal && !errors.constraints && !errors.members }
function saveDraft() { dirty.value = false; showToast('项目底座草稿已保存') }
function createBase() { if (!validate()) { showToast('请先补充必填信息'); return }; dirty.value = false; emit('created', { ...form, version: 'v1' }); showToast('项目底座已创建，当前版本为 v1'); window.setTimeout(() => emit('update:visible', false), 700) }
function requestClose() { if (dirty.value && !window.confirm('项目底座尚未保存，确定退出吗？')) return; emit('update:visible', false) }
</script>

<style scoped>
:global(body) { --project-blue: #3157d5; --project-ink: #17202b; --project-secondary: #7b8592; --project-border: #e7ebef; }
.project-backdrop { position: fixed; inset: 0; z-index: 2147483000; isolation: isolate; padding: 32px; display: flex; align-items: center; justify-content: center; background: rgba(224,228,234,.80); }
.project-modal { position: relative; width: min(980px, 100%); height: min(800px, calc(100vh - 64px)); min-height: 640px; display: flex; flex-direction: column; overflow: hidden; color: var(--project-ink); background: #fff; border-radius: 17px; box-shadow: 0 22px 70px rgba(24,35,52,.22); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif; }
button { appearance: none; -webkit-appearance: none; border: 0; font: inherit; cursor: pointer; }
.project-header { height: 76px; flex: 0 0 76px; display: flex; align-items: center; justify-content: space-between; padding: 0 27px; border-bottom: 1px solid var(--project-border); }
.project-header h2 { margin: 0 0 5px; font-size: 19px; letter-spacing: -.03em; font-weight: 760; }.project-header p { margin: 0; color: var(--project-secondary); font-size: 12px; }.icon-close { width: 32px; height: 32px; padding: 0; color: #7b8592; background: transparent; border-radius: 8px; font-size: 25px; line-height: 1; }.icon-close:hover { color: var(--project-ink); background: #f1f3f6; }
.project-content { min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 285px; }.project-form { min-width: 0; overflow-y: auto; padding: 25px 30px 30px; }.check-sidebar { padding: 23px 20px; overflow-y: auto; background: #fbfcfd; border-left: 1px solid var(--project-border); }
.stepper { display: flex; align-items: center; margin-bottom: 27px; }.step { display: flex; align-items: center; gap: 7px; padding: 0; color: #9aa2ad; background: transparent; white-space: nowrap; font-size: 12px; }.step-number { width: 21px; height: 21px; display: grid; place-items: center; border: 1px solid #b9c0ca; border-radius: 50%; font-size: 10px; }.step.active { color: var(--project-blue); font-weight: 700; }.step.active .step-number { color: #fff; background: var(--project-blue); border-color: var(--project-blue); }.step.done { color: #2b8a65; }.step.done .step-number { color: #fff; background: #dff2e9; border-color: #b8e1cc; }.step-line { width: 25px; height: 1px; margin: 0 9px; background: #dfe4e9; }
.form-section { padding-bottom: 25px; margin-bottom: 24px; border-bottom: 1px solid #eef1f3; }.last-section { border-bottom: 0; margin-bottom: 0; }.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }.section-heading > div { display: flex; align-items: center; gap: 9px; }.section-heading h3 { margin: 0; font-size: 15px; font-weight: 750; }.eyebrow { color: var(--project-blue); font-size: 10px; font-weight: 800; letter-spacing: .08em; }.section-note { color: #a0a8b2; font-size: 10px; }
.field { display: block; margin-bottom: 14px; }.field > span { display: flex; align-items: center; gap: 5px; margin-bottom: 7px; color: #5f6975; font-size: 11px; font-weight: 650; }.field b { color: #c45454; }.field em { color: #a36b1c; font-style: normal; font-weight: 500; }.field input, .field textarea, .field select { width: 100%; padding: 10px 11px; color: var(--project-ink); background: #fff; border: 1px solid #dfe4e9; border-radius: 8px; outline: none; font-size: 13px; transition: border .15s, box-shadow .15s; }.field input { height: 40px; }.field textarea { min-height: 75px; resize: vertical; line-height: 1.6; }.field select { height: 40px; }.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--project-blue); box-shadow: 0 0 0 3px #eff2ff; }.field small, .standalone-error { display: block; margin-top: 5px; color: #c45454; font-size: 10px; }.field-grid { display: grid; gap: 13px; }.field-grid.two { grid-template-columns: 1fr 1fr; }
.ai-action-row { display: flex; align-items: center; gap: 9px; margin: -2px 0 12px; }.ai-action-row > span { color: #a4acb5; font-size: 10px; }.ai-button { padding: 7px 10px; color: var(--project-blue); background: #eff2ff; border: 1px solid #d8defd; border-radius: 7px; font-size: 11px; }.ai-button:disabled { opacity: .65; }.suggestion-panel { padding: 11px; margin: -2px 0 13px; background: #f7f8ff; border: 1px solid #d8defd; border-radius: 9px; }.suggestion-title { display: flex; gap: 7px; align-items: center; color: var(--project-blue); font-size: 12px; }.suggestion-panel p { margin: 7px 0 9px; color: #58677d; font-size: 11px; line-height: 1.5; }.link-button, .quiet-button { padding: 0; margin-right: 15px; color: var(--project-blue); background: transparent; font-size: 11px; }.quiet-button { color: #87909b; }
.constraint-list { display: flex; flex-wrap: wrap; gap: 8px; }.constraint { padding: 7px 10px; color: #6f7985; background: #fff; border: 1px solid #dfe4e9; border-radius: 7px; font-size: 11px; }.constraint.selected { color: var(--project-blue); background: #eff2ff; border-color: #b9c5f5; }.members-list { display: grid; gap: 8px; }.member-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #e8ecf0; border-radius: 9px; }.member-avatar { width: 27px; height: 27px; display: grid; place-items: center; flex: 0 0 27px; color: #fff; border-radius: 50%; background: #6f8ee4; font-size: 9px; font-weight: 750; }.avatar-1 { background: #bf8fce; }.avatar-2 { background: #59aa95; }.member-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.member-main strong { font-size: 11px; }.member-main span { overflow: hidden; color: #8a949f; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }.remove-member { margin-left: auto; color: #a7afb8; background: transparent; font-size: 18px; }.add-member { padding: 9px 0 0; color: var(--project-blue); background: transparent; font-size: 11px; }
.check-header h3 { margin: 0 0 6px; font-size: 15px; }.check-header p { margin: 0 0 18px; color: var(--project-secondary); font-size: 11px; line-height: 1.45; }.check-list { border-top: 1px solid var(--project-border); }.check-row { display: flex; gap: 8px; padding: 11px 0; border-bottom: 1px solid var(--project-border); }.check-icon { width: 17px; height: 17px; display: grid; place-items: center; flex: 0 0 17px; color: #2b8a65; background: #dff2e9; border-radius: 50%; font-size: 10px; font-weight: 800; }.check-icon.warning { color: #a36b1c; background: #fff1d8; }.check-row strong, .check-row small { display: block; }.check-row strong { font-size: 11px; font-weight: 650; }.check-row small { margin-top: 4px; color: var(--project-secondary); font-size: 10px; }.freeze-card { padding: 13px; margin-top: 22px; background: #fff; border: 1px solid var(--project-border); border-radius: 9px; }.freeze-card h4 { margin: 0 0 10px; font-size: 11px; }.freeze-card ul { padding-left: 15px; margin: 0; color: #7b8592; font-size: 10px; line-height: 2; }
.project-footer { height: 73px; flex: 0 0 73px; display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 0 27px; color: #8a949f; border-top: 1px solid var(--project-border); font-size: 10px; }.project-footer > div { display: flex; gap: 9px; }.secondary-button, .primary-button { height: 36px; padding: 0 14px; border-radius: 8px; font-size: 12px; white-space: nowrap; }.secondary-button { color: #5e6875; background: #fff; border: 1px solid #dfe4e9; }.primary-button { color: #fff; background: var(--project-blue); border: 1px solid var(--project-blue); font-weight: 650; }.primary-button:hover { background: #264ac0; }.modal-toast { position: absolute; left: 50%; bottom: 86px; padding: 9px 14px; color: #fff; background: #243044; border-radius: 8px; box-shadow: 0 8px 24px rgba(24,35,52,.18); transform: translateX(-50%); font-size: 11px; }
@media (max-width: 780px) { .project-backdrop { padding: 0; }.project-modal { width: 100%; height: 100%; min-height: 0; border-radius: 0; }.project-content { display: block; }.check-sidebar { display: none; }.project-form { padding: 22px 20px; }.project-footer { padding: 0 20px; }.project-footer > span { display: none; }.field-grid.two { grid-template-columns: 1fr; }.step-line { width: 15px; margin: 0 5px; } }
.project-modal button:focus-visible, .project-modal input:focus-visible, .project-modal textarea:focus-visible, .project-modal select:focus-visible { outline: 2px solid #9eafff; outline-offset: 2px; }

/* 与任务桥 Demo 统一视觉：橙色主操作、暖白背景、浅橙状态面 */
:global(body) { --project-blue: #ff621f; --project-ink: #303746; --project-secondary: #87909d; --project-border: #f1e5df; }
.project-backdrop { background: rgba(0, 0, 0, .4); }
.project-modal { background: #f7f7f7; border: 1px solid #e5e5e5; box-shadow: 0 22px 70px rgba(0, 0, 0, .18); }
.project-header, .project-footer, .project-form { background: #f7f7f7; }
.project-header { border-bottom-color: #e5e5e5; }
.project-header h2, .section-heading h3, .check-header h3 { color: #303746; }
.section-heading .eyebrow { color: #ff621f; }
.field input:focus, .field textarea:focus, .field select:focus { border-color: #f09a78; box-shadow: 0 0 0 3px #fff0e9; }
.ai-button, .constraint.selected { color: #d75c2c; background: #fff0e9; border-color: #ffd8c8; }
.suggestion-panel { background: #fff8f4; border-color: #ffd8c8; }
.suggestion-title, .link-button, .add-member { color: #d75c2c; }
.constraint { border-color: #e5e8ed; }
.member-avatar { background: #ff8b55; }
.check-sidebar { background: #ededed; border-left-color: #dedede; }
.freeze-card { border-color: #f1e5df; }
.secondary-button { border-color: #e1e5ed; }
.primary-button { background: #ff621f; border-color: #ff621f; box-shadow: 0 5px 12px rgba(255, 98, 31, .2); }
.primary-button:hover { background: #e95517; border-color: #e95517; }
.project-modal button:focus-visible, .project-modal input:focus-visible, .project-modal textarea:focus-visible, .project-modal select:focus-visible { outline-color: #ff9c71; }
</style>
