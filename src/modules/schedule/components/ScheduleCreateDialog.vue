<template>
  <Teleport to="body">
    <div v-if="store.dialogState.open" class="modal-mask" @click.self="onClose">
      <div class="modal-content">
        <header class="modal-header">
          <h3 class="modal-title">{{ mode === 'edit' ? '编辑定时任务' : '新建定时任务' }}</h3>
          <button class="modal-close" aria-label="关闭" @click="onClose">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="modal-body custom-scrollbar">
          <!-- 任务名称 -->
          <div class="field">
            <label class="field-label">任务名称<span class="required">*</span></label>
            <div class="field-input-wrap">
              <input
                v-model="form.name"
                type="text"
                class="text-input"
                placeholder="请输入任务名称"
                maxlength="20"
              />
              <span class="counter">{{ form.name.length }}/20</span>
            </div>
          </div>

          <!-- 执行 Agent -->
          <div class="field">
            <label class="field-label">执行 Agent<span class="required">*</span></label>
            <ScheduleAgentPicker v-model="form.executor" />
          </div>

          <!-- 任务指令 -->
          <div class="field">
            <label class="field-label">任务指令<span class="required">*</span></label>
            <div class="field-textarea-wrap">
              <textarea
                v-model="form.instruction"
                class="textarea-input"
                placeholder="请输入任务指令"
                maxlength="200"
                rows="4"
              />
              <span class="counter counter--bottom">{{ form.instruction.length }}/200</span>
            </div>
          </div>

          <!-- 执行时间 -->
          <div class="field">
            <label class="field-label">执行时间<span class="required">*</span></label>
            <div class="cycle-wrapper">
              <div class="cycle-tabs">
                <button
                  v-for="t in cycleTabs"
                  :key="t.key"
                  type="button"
                  class="cycle-tab"
                  :class="{ active: form.cycle.type === t.key }"
                  @click="onSwitchCycleTab(t.key)"
                >
                  {{ t.label }}
                </button>
              </div>

              <!-- 每天 -->
              <div v-if="form.cycle.type === 'daily'" class="cycle-content">
                <div class="cycle-row">
                  <div class="time-input-wrap">
                    <span class="time-icon">🕐</span>
                    <input
                      v-model="form.cycle.time"
                      type="time"
                      class="time-input"
                    />
                  </div>
                </div>
                <div class="weekdays">
                  <button
                    v-for="(label, idx) in WEEKDAY_LABELS"
                    :key="idx"
                    type="button"
                    class="weekday-chip"
                    :class="{ active: form.cycle.weekdays.includes(idx + 1) }"
                    @click="toggleWeekday(idx + 1)"
                  >
                    周{{ label }}
                  </button>
                </div>
              </div>

              <!-- 按间隔 -->
              <div v-else-if="form.cycle.type === 'interval'" class="cycle-content">
                <div class="cycle-row">
                  <span class="cycle-prefix">每</span>
                  <input
                    v-model.number="form.cycle.value"
                    type="number"
                    min="1"
                    class="number-input"
                  />
                  <select v-model="form.cycle.unit" class="select-input">
                    <option value="minute">分钟</option>
                    <option value="hour">小时</option>
                    <option value="day">天</option>
                  </select>
                </div>
              </div>

              <!-- 按单次 -->
              <div v-else-if="form.cycle.type === 'once'" class="cycle-content">
                <div class="cycle-row">
                  <input
                    v-model="form.cycle.date"
                    type="date"
                    class="date-input"
                  />
                  <input
                    v-model="form.cycle.time"
                    type="time"
                    class="time-input"
                  />
                </div>
              </div>

              <!-- Cron -->
              <div v-else-if="form.cycle.type === 'cron'" class="cycle-content">
                <input
                  v-model="form.cycle.expr"
                  type="text"
                  class="text-input"
                  placeholder="如 0 9 * * 1-5（工作日 9:00）"
                />
                <div v-if="form.cycle.expr && !cronValid" class="cron-error">
                  Cron 表达式格式不正确（应为 5 段：分 时 日 月 周）
                </div>
                <div class="cron-hint">
                  示例：<code>0 9 * * 1-5</code>（工作日 9:00）/ <code>30 */2 * * *</code>（每 2 小时的 30 分）
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn btn-cancel" @click="onClose">取消</button>
          <button
            type="button"
            class="btn btn-confirm"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            确定
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'ScheduleCreateDialog' })

import { computed, reactive, watch } from 'vue'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'
import ScheduleAgentPicker from './ScheduleAgentPicker.vue'

const store = useScheduleStore()

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const cycleTabs = [
  { key: 'daily', label: '每天' },
  { key: 'interval', label: '按间隔' },
  { key: 'once', label: '按单次' },
  { key: 'cron', label: 'Cron' },
]

const mode = computed(() => store.dialogState.mode)

const form = reactive(emptyForm())

function emptyForm() {
  return {
    name: '',
    instruction: '',
    executor: null,
    cycle: {
      type: 'daily',
      time: '09:00',
      weekdays: [1, 2, 3, 4, 5],
      value: 1,
      unit: 'hour',
      date: '',
      expr: '',
    },
  }
}

// 弹窗打开时根据 mode + preset 重置 form
watch(() => store.dialogState.open, (open) => {
  if (!open) return
  if (store.dialogState.mode === 'edit' && store.dialogState.taskId) {
    const t = store.tasks[store.dialogState.taskId]
    if (t) {
      form.name = t.name
      form.instruction = t.instruction
      form.executor = t.executor
        ? { agentId: t.executor.agentId, agentName: t.executor.agentName, source: t.executor.source }
        : null
      form.cycle = mergeCycle(emptyForm().cycle, t.cycle)
    }
  } else if (store.dialogState.preset) {
    const p = store.dialogState.preset
    Object.assign(form, emptyForm())
    form.name = p.taskName || ''
    form.instruction = p.instruction || ''
    form.cycle = mergeCycle(emptyForm().cycle, p.cycle)
  } else {
    Object.assign(form, emptyForm())
  }
})

function mergeCycle(base, c) {
  if (!c) return base
  return {
    ...base,
    ...c,
    weekdays: Array.isArray(c.weekdays) ? c.weekdays.slice() : base.weekdays,
  }
}

function toggleWeekday(d) {
  const idx = form.cycle.weekdays.indexOf(d)
  if (idx >= 0) form.cycle.weekdays.splice(idx, 1)
  else {
    form.cycle.weekdays.push(d)
    form.cycle.weekdays.sort((a, b) => a - b)
  }
}

function onSwitchCycleTab(type) {
  form.cycle.type = type
  // 切换时给一些合理默认
  if (type === 'daily' && !form.cycle.time) form.cycle.time = '09:00'
  if (type === 'interval' && !form.cycle.value) { form.cycle.value = 1; form.cycle.unit = 'hour' }
  if (type === 'once' && !form.cycle.date) {
    const d = new Date(Date.now() + 24 * 3600 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    form.cycle.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    form.cycle.time = '09:00'
  }
}

const CRON_RE = /^\s*(\S+\s+){4}\S+\s*$/
const cronValid = computed(() => CRON_RE.test(form.cycle.expr || ''))

const canSubmit = computed(() => {
  if (!form.name.trim()) return false
  if (!form.executor) return false
  if (!form.instruction.trim()) return false
  if (form.cycle.type === 'daily' && (!form.cycle.time || !form.cycle.weekdays.length)) return false
  if (form.cycle.type === 'interval' && !(form.cycle.value > 0)) return false
  if (form.cycle.type === 'once' && (!form.cycle.date || !form.cycle.time)) return false
  if (form.cycle.type === 'cron' && !cronValid.value) return false
  return true
})

function buildCycleDescription(c) {
  if (c.type === 'daily') {
    const days = c.weekdays.slice().sort()
    const isWorkday = JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])
    const isAll = JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5, 6, 7])
    if (isAll) return `每天 ${c.time}`
    if (isWorkday) return `工作日 ${c.time}`
    const labels = days.map((d) => '一二三四五六日'[d - 1]).join('、')
    return `周${labels} ${c.time}`
  }
  if (c.type === 'interval') {
    const unitLabel = { minute: '分钟', hour: '小时', day: '天' }[c.unit] || c.unit
    return `每 ${c.value} ${unitLabel}`
  }
  if (c.type === 'once') return `单次 ${c.date} ${c.time}`
  if (c.type === 'cron') return `Cron · ${c.expr}`
  return '—'
}

function onSubmit() {
  if (!canSubmit.value) return
  const cycle = {
    type: form.cycle.type,
    description: buildCycleDescription(form.cycle),
  }
  if (form.cycle.type === 'daily') {
    cycle.time = form.cycle.time
    cycle.weekdays = form.cycle.weekdays.slice()
  } else if (form.cycle.type === 'interval') {
    cycle.value = form.cycle.value
    cycle.unit = form.cycle.unit
  } else if (form.cycle.type === 'once') {
    cycle.date = form.cycle.date
    cycle.time = form.cycle.time
    cycle.runAt = new Date(`${form.cycle.date}T${form.cycle.time}:00`).getTime()
  } else if (form.cycle.type === 'cron') {
    cycle.expr = form.cycle.expr
  }

  const task = {
    id: store.dialogState.mode === 'edit' ? store.dialogState.taskId : undefined,
    name: form.name.trim(),
    instruction: form.instruction.trim(),
    executor: form.executor,
    cycle,
    status: 'running',
    nextRunAt: cycle.runAt || (Date.now() + 24 * 3600 * 1000),
    runHistory: [],
  }
  const saved = store.upsertTask(task)
  store.setActiveTask(saved.id)
  store.closeDialog()
}

function onClose() {
  store.closeDialog()
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(29, 33, 41, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fade-in 0.18s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  width: 560px;
  max-width: 92vw;
  max-height: 86vh;
  background: #FFFFFF;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
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
  border-radius: 4px;
  display: flex;
}
.modal-close:hover { background: #F7F8FA; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
}

.field {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.field-label {
  font-size: 13px;
  color: #1D2129;
  font-weight: 500;
  padding-top: 8px;
}

.required {
  color: #F53F3F;
  margin-left: 2px;
}

.field-input-wrap,
.field-textarea-wrap {
  position: relative;
}

.text-input,
.number-input,
.date-input,
.time-input,
.select-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 13px;
  color: #1D2129;
  outline: none;
  font-family: inherit;
}
.text-input:focus,
.number-input:focus,
.date-input:focus,
.time-input:focus,
.select-input:focus {
  border-color: #436FF6;
}

.textarea-input {
  width: 100%;
  padding: 8px 12px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 13px;
  color: #1D2129;
  outline: none;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}
.textarea-input:focus { border-color: #436FF6; }

.counter {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 11px;
  color: #C9CDD4;
  pointer-events: none;
}
.counter--bottom {
  top: auto;
  bottom: 8px;
  right: 12px;
}

/* Cycle wrapper：作为 field 的第 2 列单一子项 */
.cycle-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Cycle */
.cycle-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  background: #FAFBFC;
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 12px;
}

.cycle-tab {
  padding: 8px 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  color: #86909C;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  font-weight: 500;
}
.cycle-tab:hover { color: #1D2129; }
.cycle-tab.active {
  background: #FFFFFF;
  color: #FF6B00;
  box-shadow: 0 1px 3px rgba(255, 107, 0, 0.1);
}

.cycle-content {
  padding-top: 2px;
}

.cycle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cycle-prefix {
  font-size: 13px;
  color: #4E5969;
}

.time-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.time-icon {
  position: absolute;
  left: 10px;
  font-size: 13px;
  pointer-events: none;
}
.time-input-wrap .time-input {
  padding-left: 32px;
  width: 160px;
}

.weekdays {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.weekday-chip {
  padding: 4px 10px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 12px;
  font-size: 12px;
  color: #4E5969;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.weekday-chip:hover { border-color: #FFB48A; }
.weekday-chip.active {
  background: #FFF1ED;
  border-color: #FF8670;
  color: #FF6B00;
}

.number-input { width: 80px; }
.select-input { width: 100px; }
.date-input,
.time-input { width: 160px; }

.cron-error {
  margin-top: 6px;
  font-size: 12px;
  color: #F53F3F;
}
.cron-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #86909C;
}
.cron-hint code {
  background: #F2F3F5;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 22px;
  border-top: 1px solid #F2F3F5;
}

.btn {
  padding: 8px 22px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  font-family: inherit;
  font-weight: 500;
}
.btn:disabled { cursor: not-allowed; opacity: 0.5; }

.btn-cancel {
  background: #FFFFFF;
  color: #4E5969;
  border: 1px solid #E5E6EB;
}
.btn-cancel:hover:not(:disabled) { background: #F7F8FA; }

.btn-confirm {
  background: #1D2129;
  color: #FFFFFF;
}
.btn-confirm:hover:not(:disabled) { background: #2F3547; }
</style>
