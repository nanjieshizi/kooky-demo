<template>
  <Teleport to="body">
    <Transition name="dispatch-fade">
      <div v-if="visible" class="dispatch-modal-mask" @click.self="close">
        <div class="dispatch-modal" @click.stop>
          <header class="modal-header">
            <h3 class="modal-title">⚡ 分派</h3>
            <button class="modal-close" @click="close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="modal-body custom-scrollbar">
            <p class="modal-hint">把这一步「{{ step?.name }}」转去哪里独立执行：</p>

            <!-- 横向目的地 tab -->
            <div class="dest-tabs">
              <button
                type="button"
                class="dest-tab"
                :class="{ active: dest === 'soloTeam' }"
                @click="dest = 'soloTeam'"
              >
                <span class="tab-icon">👥</span>
                <span class="tab-label">一人团队</span>
              </button>
              <button
                type="button"
                class="dest-tab"
                :class="{ active: dest === 'kode' }"
                @click="dest = 'kode'"
              >
                <span class="tab-icon">⚙️</span>
                <span class="tab-label">Kode 终端</span>
              </button>
            </div>

            <!-- 一人团队子选择 -->
            <div v-if="dest === 'soloTeam'" class="dest-pane">
              <div class="sub-group">
                <div class="sub-title">👤 数字员工 · 单聊</div>
                <div class="choice-row">
                  <button
                    v-for="emp in employees"
                    :key="emp.id"
                    type="button"
                    class="choice-chip"
                    :class="{ selected: pickType === 'employee' && pickId === emp.id }"
                    @click.stop="selectEmployee(emp)"
                  >
                    {{ emp.name }}
                  </button>
                  <div v-if="!employees.length" class="empty">无聘用员工，请先到市场聘用</div>
                </div>
              </div>
              <div class="sub-group">
                <div class="sub-title">👥 一人团队 · 群</div>
                <div class="choice-row">
                  <button
                    v-for="team in teams"
                    :key="team.id"
                    type="button"
                    class="choice-chip team-chip"
                    :class="{ selected: pickType === 'team' && pickId === team.id }"
                    @click.stop="selectTeam(team)"
                  >
                    {{ team.name }}
                  </button>
                  <div v-if="!teams.length" class="empty">暂无团队群</div>
                </div>
              </div>
            </div>

            <!-- Kode 提示 -->
            <div v-if="dest === 'kode'" class="dest-pane">
              <div class="kode-hint">
                <span class="kode-hint-icon">⚙️</span>
                <div class="kode-hint-text">
                  <div class="kode-hint-title">在 Kode 代码工作台执行</div>
                  <div class="kode-hint-desc">把任务上下文作为初始 prompt 注入终端</div>
                </div>
              </div>
            </div>

            <!-- 上下文 -->
            <section class="ctx-section">
              <h4 class="ctx-title">📦 要带过去的上下文</h4>
              <label class="ctx-row">
                <input type="checkbox" v-model="ctx.taskMeta" />
                <span>协作任务 + 原始目标</span>
              </label>
              <label class="ctx-row">
                <input type="checkbox" v-model="ctx.currentStep" />
                <span>当前步骤描述 + 提交类型</span>
              </label>
              <label class="ctx-row">
                <input type="checkbox" v-model="ctx.prevSteps" />
                <span>前序步骤摘要（{{ prevStepsCount }}）</span>
              </label>
              <label class="ctx-row">
                <input type="checkbox" v-model="ctx.files" />
                <span>前序产出文件（{{ filesCount }}）</span>
              </label>
              <label class="ctx-row">
                <input type="checkbox" v-model="ctx.discussion" />
                <span>群里近期讨论</span>
              </label>

              <button type="button" class="preview-toggle" @click="previewOpen = !previewOpen">
                {{ previewOpen ? '收起预览 ▾' : '展开预览 ▸' }}
              </button>

              <div v-show="previewOpen" class="preview-content">
                <pre class="preview-box">{{ payload.prompt }}</pre>

                <!-- 附件卡片：明确告诉用户文件会一起送过去 -->
                <div v-if="ctx.files && payload.files.length > 0" class="preview-files">
                  <div class="preview-files-head">
                    📎 附件（{{ payload.files.length }} 个文件会一起送过去）
                  </div>
                  <div
                    v-for="(f, i) in payload.files"
                    :key="i"
                    class="file-card"
                  >
                    <span class="file-card-icon">📎</span>
                    <div class="file-card-info">
                      <div class="file-card-name">{{ f.name }}</div>
                      <div class="file-card-meta">
                        {{ f.size || '?' }} · 来自 {{ f.from }} · 「{{ f.stepName }}」步骤
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" @click="close">取消</button>
            <button
              type="button"
              class="btn-confirm"
              :disabled="!canDispatch"
              @click="onConfirm"
            >
              ⚡ 分派
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'CollabDispatchDialog' })

import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { listHired, toEmployeeAgentItem } from '@/dev-mocks/data/hired-state'
import { buildDispatchPayload } from '../services/dispatchPayload'
import { CURRENT_USER } from '@/dev-mocks/data/users'

const props = defineProps({
  visible: { type: Boolean, default: false },
  task: { type: Object, default: null },
  step: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'dispatched'])

const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()
const router = useRouter()

const dest = ref('soloTeam')      // 'soloTeam' | 'kode'
const pickType = ref(null)        // 'employee' | 'team' | null
const pickId = ref(null)
const previewOpen = ref(false)
const ctx = ref({
  taskMeta: true,
  currentStep: true,
  prevSteps: true,
  files: true,
  discussion: false,
})

// 弹窗每次打开重置选择
watch(() => props.visible, (v) => {
  if (v) {
    dest.value = 'soloTeam'
    pickType.value = null
    pickId.value = null
    previewOpen.value = false
  }
})

// 聘用过的数字员工
const employees = computed(() => listHired().map(toEmployeeAgentItem).map((e) => ({
  id: e.agent_id,
  name: e.agent_display_name,
  avatar: e.agent_avatar_url,
})))

// 一人团队群
const teams = computed(() => soloTeamStore.onePersonTeams || [])

const prevStepsCount = computed(() => {
  if (!props.task) return 0
  return (props.task.steps || []).filter(
    (s) => (s.status === 'done' || s.status === 'skipped') && s.id !== props.step?.id,
  ).length
})

const filesCount = computed(() => payload.value.files?.length || 0)

const payload = computed(() => buildDispatchPayload(props.task, props.step, {
  includeTaskMeta: ctx.value.taskMeta,
  includeCurrentStep: ctx.value.currentStep,
  includePrevSteps: ctx.value.prevSteps,
  includeFiles: ctx.value.files,
  includeDiscussion: ctx.value.discussion,
  actor: CURRENT_USER.name,
}))

const canDispatch = computed(() => {
  if (dest.value === 'kode') return true
  return pickType.value && pickId.value != null
})

function selectEmployee(emp) {
  pickType.value = 'employee'
  pickId.value = emp.id
}

function selectTeam(team) {
  pickType.value = 'team'
  pickId.value = team.id
}

function close() {
  emit('update:visible', false)
}

function onConfirm() {
  if (!canDispatch.value) return
  const result = {
    dest: dest.value,
    pickType: pickType.value,
    pickId: pickId.value,
    payload: payload.value,
    task: props.task,
    step: props.step,
  }

  // A 方案：只跳到对应模块，不动对话功能
  try {
    if (dest.value === 'kode') {
      uiStore.openClaudeCode?.()
      ElMessage.success(`已转去 Kode 终端`)
    } else if (pickType.value === 'employee') {
      // 一人团队 · 员工单聊
      uiStore.setActiveNavigation('solo-team', null)
      // 切到员工模式 + 选中该员工（如果 store 支持）
      try {
        soloTeamStore.employeeChatMode = 'employee'
        soloTeamStore.currentEmployeeId = pickId.value
      } catch (_) { /* noop */ }
      const emp = employees.value.find((e) => e.id === pickId.value)
      ElMessage.success(`已转给 ${emp?.name || '员工'}`)
    } else if (pickType.value === 'team') {
      uiStore.setActiveNavigation('solo-team', null)
      try {
        soloTeamStore.employeeChatMode = 'room'
        soloTeamStore.currentRoomId = pickId.value
      } catch (_) { /* noop */ }
      const team = teams.value.find((t) => String(t.id) === String(pickId.value))
      ElMessage.success(`已转给「${team?.name || '团队'}」`)
    }
  } catch (e) {
    console.error('[CollabDispatchDialog] navigate failed:', e)
    ElMessage.error('跳转失败：' + (e?.message || e))
  }

  emit('dispatched', result)
  close()
}

// 弹窗打开时如果一人团队列表为空，触发一次加载
watch(() => props.visible, async (v) => {
  if (v && teams.value.length === 0 && !soloTeamStore.onePersonTeamsLoading) {
    try { await soloTeamStore.loadOnePersonTeamsFromApi?.() } catch (_) { /* noop */ }
  }
})
</script>

<style scoped>
.dispatch-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 33, 41, 0.45);
  backdrop-filter: blur(2px);
}

.dispatch-modal {
  width: 540px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  background: #FFFFFF;
  border-radius: 14px;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #F2F3F5;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1D2129;
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
}
.modal-close:hover { background: #F7F8FA; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.modal-hint {
  margin: 0 0 14px 0;
  font-size: 13px;
  color: #4E5969;
}

/* ── 横向目的地 tab ── */
.dest-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.dest-tab {
  flex: 1;
  padding: 14px 12px;
  background: #FFFFFF;
  border: 1.5px solid #E5E6EB;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: #4E5969;
}
.dest-tab:hover {
  border-color: #C9D6FA;
  color: #1D2129;
}
.dest-tab.active {
  border-color: #436FF6;
  background: #F7F9FF;
  color: #436FF6;
}

.tab-icon {
  font-size: 16px;
}

.dest-pane {
  padding: 4px 0 8px;
  margin-bottom: 10px;
}

/* Kode 提示卡片 */
.kode-hint {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #FAFBFC;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
}

.kode-hint-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.kode-hint-title {
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
}

.kode-hint-desc {
  font-size: 12px;
  color: #86909C;
  margin-top: 3px;
  line-height: 1.5;
}

.sub-group {
  margin-bottom: 10px;
}
.sub-group:last-child { margin-bottom: 0; }

.sub-title {
  font-size: 12px;
  color: #4E5969;
  margin-bottom: 6px;
  font-weight: 500;
}

.choice-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.choice-chip {
  padding: 6px 10px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 12px;
  color: #1D2129;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.choice-chip:hover {
  border-color: #436FF6;
  color: #436FF6;
}
.choice-chip.selected {
  background: #436FF6;
  border-color: #436FF6;
  color: #FFFFFF;
}
.choice-chip.team-chip {
  font-weight: 500;
}

.empty {
  font-size: 12px;
  color: #C9CDD4;
  padding: 4px 0;
}

/* ── 上下文 section ── */
.ctx-section {
  margin-top: 4px;
  padding: 12px 14px;
  background: #FAFBFC;
  border-radius: 10px;
}

.ctx-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
}

.ctx-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #4E5969;
  cursor: pointer;
  user-select: none;
}

.ctx-row input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #436FF6;
  cursor: pointer;
}

.preview-toggle {
  margin-top: 8px;
  background: transparent;
  border: none;
  color: #436FF6;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 0;
  font-family: inherit;
}
.preview-toggle:hover { text-decoration: underline; }

.preview-content {
  margin-top: 8px;
}

.preview-box {
  margin: 0;
  padding: 10px 12px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 12px;
  color: #4E5969;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-height: 240px;
  overflow-y: auto;
}

/* 附件卡片 */
.preview-files {
  margin-top: 10px;
}

.preview-files-head {
  font-size: 12px;
  font-weight: 500;
  color: #436FF6;
  margin-bottom: 6px;
}

.file-card {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  margin-top: 6px;
}

.file-card-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.file-card-info {
  flex: 1;
  min-width: 0;
}

.file-card-name {
  font-size: 13px;
  font-weight: 500;
  color: #1D2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card-meta {
  font-size: 11px;
  color: #86909C;
  margin-top: 2px;
}

/* ── 底部 footer ── */
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #F2F3F5;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-family: inherit;
}

.btn-cancel {
  background: #F2F3F5;
  color: #4E5969;
}
.btn-cancel:hover { background: #E5E6EB; }

.btn-confirm {
  background: linear-gradient(135deg, #7B5BFF 0%, #5E3FD9 100%);
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(123, 91, 255, 0.25);
}
.btn-confirm:hover:not(:disabled) {
  box-shadow: 0 4px 14px rgba(123, 91, 255, 0.4);
}
.btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ── 进出动画 ── */
.dispatch-fade-enter-active,
.dispatch-fade-leave-active {
  transition: opacity 0.18s ease;
}
.dispatch-fade-enter-from,
.dispatch-fade-leave-to {
  opacity: 0;
}
.dispatch-fade-enter-active .dispatch-modal,
.dispatch-fade-leave-active .dispatch-modal {
  transition: transform 0.22s ease;
}
.dispatch-fade-enter-from .dispatch-modal,
.dispatch-fade-leave-to .dispatch-modal {
  transform: scale(0.96) translateY(8px);
}
</style>
