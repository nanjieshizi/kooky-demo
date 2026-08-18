<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-mask" @mousedown.self="handleCancel" />
    <Transition name="dialog-fade">
      <div v-if="visible" class="shortcut-dialog" :style="{ ...dialogStyle, ...dialogThemeStyle }">
        <div class="dialog-title">{{ isEdit ? '编辑快捷命令' : '添加快捷命令' }}</div>

        <!-- 标签名 -->
        <label class="field-label">标签名</label>
        <input
          ref="labelInputRef"
          v-model="form.label"
          class="field-input"
          :class="{ error: submitted && !form.label.trim() }"
          placeholder="如：启动服务"
          maxlength="20"
        />

        <!-- 命令 -->
        <label class="field-label">命令</label>
        <textarea
          ref="commandTextareaRef"
          v-model="form.command"
          class="field-textarea"
          :class="{ error: hasNewline || (submitted && !form.command.trim()) }"
          placeholder="如：yarn dev 或 cmd1 && cmd2"
          rows="1"
        />
        <div v-if="hasNewline" class="newline-warning">
          不支持换行，多条命令请用 && 或 ; 连接
        </div>

        <!-- 执行模式 -->
        <label class="field-label">执行模式</label>
        <div class="radio-group">
          <label class="radio-item" :class="{ active: form.mode === 'input' }">
            <span class="radio-circle" :class="{ checked: form.mode === 'input' }" />
            <input type="radio" v-model="form.mode" value="input" class="radio-hidden" />
            仅输入（光标停在行末，等待确认）
          </label>
          <label class="radio-item" :class="{ active: form.mode === 'execute' }">
            <span class="radio-circle" :class="{ checked: form.mode === 'execute' }" />
            <input type="radio" v-model="form.mode" value="execute" class="radio-hidden" />
            输入并执行（自动回车）
          </label>
        </div>

        <!-- 颜色 -->
        <div class="color-row">
          <span class="field-label" style="margin-bottom: 0">颜色</span>
          <input type="color" v-model="form.color" class="color-picker" />
          <button class="reset-btn" @click="form.color = '#F9A825'">重置</button>
        </div>

        <!-- 操作按钮 -->
        <div class="dialog-actions">
          <button class="btn btn-cancel" @click="handleCancel">取消</button>
          <button class="btn btn-confirm" @click="handleConfirm">确认</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  editItem: { type: Object, default: null },
  anchorRect: { type: Object, default: null },
  theme: { type: Object, default: null },
})

const dialogThemeStyle = computed(() => {
  const t = props.theme
  if (!t) return {}
  return {
    '--dlg-bg': t.dialogBg,
    '--dlg-border': t.dialogBorder,
    '--dlg-title': t.dialogTitle,
    '--dlg-label': t.dialogLabel,
    '--dlg-input-bg': t.dialogInputBg,
    '--dlg-input-border': t.dialogInputBorder,
    '--dlg-input-text': t.dialogInputText,
    '--dlg-radio-text': t.dialogRadioText,
    '--dlg-btn-cancel-text': t.dialogBtnCancelText,
    '--dlg-btn-cancel-hover-bg': t.dialogBtnCancelHoverBg,
    background: t.dialogBg,
    borderColor: t.dialogBorder,
  }
})

const emit = defineEmits(['update:visible', 'confirm'])

const COMMAND_TEXTAREA_MIN_LINES = 3
const COMMAND_TEXTAREA_MAX_LINES = 10

const isEdit = computed(() => !!props.editItem)
const labelInputRef = ref(null)
const commandTextareaRef = ref(null)
const submitted = ref(false)

const form = reactive({
  label: '',
  command: '',
  mode: 'input',
  color: '#F9A825',
})

const hasNewline = computed(() => form.command.includes('\n'))

function getCommandTextareaMetrics(el) {
  const cs = getComputedStyle(el)
  let lineHeight = parseFloat(cs.lineHeight)
  if (Number.isNaN(lineHeight) || lineHeight <= 0) {
    lineHeight = parseFloat(cs.fontSize) * 1.5
  }
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  const minH = lineHeight * COMMAND_TEXTAREA_MIN_LINES + padY
  const maxH = lineHeight * COMMAND_TEXTAREA_MAX_LINES + padY
  return { lineHeight, padY, minH, maxH }
}

/** 超过 10 行（含自动换行）则截断；再同步高度 */
function clampCommandToMaxVisualLinesAndResize() {
  const el = commandTextareaRef.value
  if (!el) return
  const { minH, maxH } = getCommandTextareaMetrics(el)
  const full = form.command

  el.style.height = 'auto'
  el.value = full
  if (el.scrollHeight <= maxH) {
    applyCommandTextareaHeight(el, minH, maxH)
    return
  }

  let lo = 0
  let hi = full.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    el.value = full.slice(0, mid)
    el.style.height = 'auto'
    if (el.scrollHeight <= maxH) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  const clamped = full.slice(0, lo)
  const didTruncate = clamped !== full
  if (didTruncate) {
    form.command = clamped
  }
  el.value = form.command
  el.style.height = 'auto'
  applyCommandTextareaHeight(el, minH, maxH)

  if (didTruncate) {
    nextTick(() => {
      const t = commandTextareaRef.value
      if (!t || document.activeElement !== t) return
      const len = form.command.length
      t.setSelectionRange(len, len)
    })
  }
}

function applyCommandTextareaHeight(el, minH, maxH) {
  el.style.height = 'auto'
  const scrollH = el.scrollHeight
  const next = Math.min(Math.max(scrollH, minH), maxH)
  el.style.height = `${next}px`
  el.style.overflowY = 'hidden'
}

const dialogStyle = computed(() => {
  if (!props.anchorRect) return { bottom: '60px', left: '16px' }
  return {
    bottom: `${window.innerHeight - props.anchorRect.top + 8}px`,
    left: `${props.anchorRect.left}px`,
  }
})

watch(() => props.visible, async (v) => {
  if (v) {
    submitted.value = false
    if (props.editItem) {
      form.label = props.editItem.label
      form.command = props.editItem.command
      form.mode = props.editItem.mode || 'input'
      form.color = props.editItem.color || '#F9A825'
    } else {
      form.label = ''
      form.command = ''
      form.mode = 'input'
      form.color = '#F9A825'
    }
    await nextTick()
    clampCommandToMaxVisualLinesAndResize()
    labelInputRef.value?.focus()
  }
})

watch(
  () => form.command,
  () => {
    clampCommandToMaxVisualLinesAndResize()
  },
  { flush: 'post' },
)

function handleCancel() {
  emit('update:visible', false)
}

function handleConfirm() {
  submitted.value = true
  if (!form.label.trim() || !form.command.trim()) return

  // 换行替换为 &&
  let command = form.command
  if (command.includes('\n')) {
    command = command.split('\n').filter(l => l.trim()).join(' && ')
  }

  emit('confirm', {
    id: props.editItem?.id || null,
    label: form.label.trim(),
    command,
    mode: form.mode,
    color: form.color === '#F9A825' ? null : form.color,
  })
  emit('update:visible', false)
}
</script>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.shortcut-dialog {
  position: fixed;
  z-index: 9999;
  width: 380px;
  backdrop-filter: blur(16px);
  border: 1px solid;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--dlg-title, rgba(255, 255, 255, 0.95));
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--dlg-label, rgba(255, 255, 255, 0.55));
  margin-bottom: 6px;
}

.field-input,
.field-textarea {
  width: 100%;
  background: var(--dlg-input-bg, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--dlg-input-border, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  padding: 0 10px;
  color: var(--dlg-input-text, rgba(255, 255, 255, 0.9));
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.field-input {
  height: 32px;
}

.field-textarea {
  padding: 8px 10px;
  resize: none;
  line-height: 1.5;
  overflow-y: hidden;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  /* 高度由 adjustCommandTextareaHeight 按行数在 3～10 行之间自适应 */
}

.field-input:focus,
.field-textarea:focus {
  border-color: #409eff;
}

.field-input.error,
.field-textarea.error {
  border-color: #f56c6c;
}

.newline-warning {
  font-size: 12px;
  color: #f56c6c;
  margin-top: -8px;
  margin-bottom: 12px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--dlg-radio-text, rgba(255, 255, 255, 0.75));
  cursor: pointer;
}

.radio-hidden {
  display: none;
}

.radio-circle {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s;
}

.radio-circle.checked {
  border-color: #409eff;
}

.radio-circle.checked::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #409eff;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.color-picker {
  width: 32px;
  height: 24px;
  border: 1px solid var(--dlg-input-border, rgba(255, 255, 255, 0.2));
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

.reset-btn {
  border: none;
  background: transparent;
  color: var(--dlg-label, rgba(255, 255, 255, 0.5));
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
}

.reset-btn:hover {
  color: var(--dlg-title, rgba(255, 255, 255, 0.8));
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  height: 32px;
  padding: 0 20px;
  border-radius: 6px;
  border: 1px solid var(--dlg-input-border, rgba(255, 255, 255, 0.15));
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: transparent;
  color: var(--dlg-btn-cancel-text, rgba(255, 255, 255, 0.7));
}

.btn-cancel:hover {
  background: var(--dlg-btn-cancel-hover-bg, rgba(255, 255, 255, 0.08));
}

.btn-confirm {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.btn-confirm:hover {
  background: #337ecc;
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
