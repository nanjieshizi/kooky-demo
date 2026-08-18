<template>
  <div
    ref="barRef"
    class="feedback-bar"
    :class="{ 'feedback-bar--fadeout': fadingOut }"
    :style="barStyle"
    tabindex="0"
    @mousedown="onBarMouseDown"
    @keydown="onKeyDown"
  >
    <template v-if="!fadingOut">
      <div class="feedback-header">
        <span class="feedback-dot">•</span>
        <span class="feedback-title">请评价这次回复</span>
        <span class="feedback-hint">（输入数字直接确认，空格跳过）：</span>
      </div>
      <div class="feedback-options">
        <button
          v-for="opt in ratingOptions"
          :key="opt.key"
          type="button"
          class="feedback-option-btn"
          :class="{ active: selectedRating === opt.rating }"
          :disabled="submitting"
          @click="submitRating(opt.rating)"
        >
          <span class="option-key">{{ opt.key }}：</span>
          <span class="option-label">{{ opt.label }}</span>
          <span class="option-label"> - {{ opt.desc }}</span>
        </button>
        <button
          type="button"
          class="feedback-option-btn feedback-option-btn--skip"
          :class="{ active: selectedRating === 0 }"
          :disabled="submitting"
          @click="submitRating(0)"
        >
          <span class="option-key">空格：</span>
          <span class="option-label">跳过</span>
        </button>
      </div>
    </template>
    <div v-else class="feedback-thanks">感谢您的反馈</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { submitClaudeCodeLike } from '@/modules/terminal/claudeLikeService'
import {
  loadFeedbackFloatingBarPosition,
  saveFeedbackFloatingBarPosition,
  saveSubmittedFeedbackRecord,
} from '@/modules/terminal/services/persistentUserDataService'

defineOptions({ name: 'ClaudeCodeStopFeedbackBar' })

const FEEDBACK_DEBOUNCE_MS = 400

const props = defineProps({
  replyText: { type: String, default: '' },
  responseId: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  termId: { type: String, required: true },
  theme: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['stop-feedback', 'layout', 'dismiss'])

const barRef = ref(null)
const selectedRating = ref(null)
const submitting = ref(false)
const fadingOut = ref(false)
let lastInvokeAt = 0
let fadeTimer = null

// 根据终端背景色判断浅色/深色模式
const isLight = computed(() => {
  const bg = props.theme?.background || ''
  return bg === '#fafafa' || bg === '#ffffff' || bg === '#fff'
})

const barStyle = computed(() => ({
  left: position.value.left + 'px',
  bottom: position.value.bottom + 'px',
  background: isLight.value ? '#F7F8FA' : '#232323',
  border: isLight.value ? '1px solid #ECEEF3' : '1px solid #2B2A2A',
  '--fb-text': isLight.value ? '#2F3547' : '#FAFAFA',
  '--fb-hint': isLight.value ? '#91949E' : '#909090',
}))

const ratingOptions = [
  { key: '1', rating: 3, label: '好', desc: '准确有用' },
  { key: '2', rating: 2, label: '一般', desc: '部分有用' },
  { key: '3', rating: 1, label: '不好', desc: '不符合预期' },
]

// 拖动相关
const position = ref({ left: 16, bottom: 24 })
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
let barWidth = 0
let barHeight = 0
let resizeObserver = null

function measureBar() {
  if (barRef.value) {
    barWidth = barRef.value.offsetWidth
    barHeight = barRef.value.offsetHeight
  }
}

function adjustPositionToFit() {
  if (!barRef.value) return
  const parentElement = barRef.value.parentElement
  if (!parentElement) return
  measureBar()
  const parentRect = parentElement.getBoundingClientRect()
  const maxLeft = Math.max(0, parentRect.width - barWidth)
  const maxBottom = Math.max(0, parentRect.height - barHeight)
  position.value.left = Math.max(0, Math.min(maxLeft, position.value.left))
  position.value.bottom = Math.max(0, Math.min(maxBottom, position.value.bottom))
}

function onBarMouseDown(e) {
  if (e.target.closest('.feedback-option-btn')) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  document.addEventListener('mousemove', onDocumentMouseMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
  e.preventDefault()
  // 点击弹框区域时确保聚焦，使键盘快捷键生效
  barRef.value?.focus()
}

function onDocumentMouseMove(e) {
  if (!isDragging.value || !barRef.value) return
  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  let newLeft = position.value.left + deltaX
  let newBottom = position.value.bottom - deltaY
  const parentElement = barRef.value.parentElement
  if (parentElement) {
    const parentRect = parentElement.getBoundingClientRect()
    newLeft = Math.max(0, Math.min(parentRect.width - barWidth, newLeft))
    newBottom = Math.max(0, Math.min(parentRect.height - barHeight, newBottom))
  }
  position.value.left = newLeft
  position.value.bottom = newBottom
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
}

function onDocumentMouseUp() {
  if (isDragging.value) {
    isDragging.value = false
    document.removeEventListener('mousemove', onDocumentMouseMove)
    document.removeEventListener('mouseup', onDocumentMouseUp)
    void saveFeedbackFloatingBarPosition(position.value)
  }
}

// 键盘快捷键 — 仅在弹框聚焦时生效（通过 @keydown 绑定在组件根元素上）
function onKeyDown(e) {
  if (submitting.value) return
  if (e.key === '1') {
    e.preventDefault()
    e.stopPropagation()
    submitRating(3) // 好
  } else if (e.key === '2') {
    e.preventDefault()
    e.stopPropagation()
    submitRating(2) // 一般
  } else if (e.key === '3') {
    e.preventDefault()
    e.stopPropagation()
    submitRating(1) // 不好
  } else if (e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    submitRating(0) // 跳过
  }
}

watch(
  () => [props.responseId, props.sessionId],
  () => {
    selectedRating.value = null
    fadingOut.value = false
    lastInvokeAt = 0
  },
)

async function submitRating(rating) {
  if (submitting.value) return
  const now = Date.now()
  if (now - lastInvokeAt < FEEDBACK_DEBOUNCE_MS) return
  lastInvokeAt = now

  selectedRating.value = rating

  // 空格跳过：调接口后立即消失
  if (rating === 0) {
    submitting.value = true
    try {
      await submitClaudeCodeLike({
        comment: props.replyText || '',
        rating,
        responseId: props.responseId,
        sessionId: props.sessionId,
      })
    } catch { /* 跳过失败静默处理 */ }
    await saveSubmittedFeedbackRecord({
      source: 'terminal-stop',
      rating,
      responseId: props.responseId,
      sessionId: props.sessionId,
    }).catch(() => null)
    submitting.value = false
    emit('dismiss')
    return
  }

  // 评分 1-3：调接口，成功后显示感谢提示并渐隐
  submitting.value = true
  try {
    await submitClaudeCodeLike({
      comment: props.replyText || '',
      rating,
      responseId: props.responseId,
      sessionId: props.sessionId,
    })
    await saveSubmittedFeedbackRecord({
      source: 'terminal-stop',
      rating,
      responseId: props.responseId,
      sessionId: props.sessionId,
    }).catch(() => null)
    emit('stop-feedback', {
      choice: rating,
      termId: props.termId,
      hookTimestamp: Date.now(),
      responseId: props.responseId,
      sessionId: props.sessionId,
    })
    // 显示"感谢您的反馈"，1s 渐隐后 dismiss
    fadingOut.value = true
    fadeTimer = setTimeout(() => emit('dismiss'), 1000)
  } catch (err) {
    lastInvokeAt = 0
    selectedRating.value = null
    let msg = err?.message || err?.msg || (typeof err === 'string' ? err : '')
    if (!msg && err?.response?.data != null) {
      const d = err.response.data
      if (typeof d === 'string') msg = d
      else if (d && typeof d === 'object') msg = d.message || d.msg || d.error || ''
    }
    if (!msg) msg = '评价接口请求失败'
    ElMessage({ type: 'error', message: String(msg), duration: 4000 })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const savedPosition = await loadFeedbackFloatingBarPosition().catch(() => null)
  if (savedPosition) {
    position.value = {
      left: savedPosition.left,
      bottom: savedPosition.bottom,
    }
  }
  await nextTick()
  measureBar()
  adjustPositionToFit()

  // 弹框出现时自动聚焦，使键盘快捷键立即可用
  // 使用 setTimeout 确保在终端焦点管理逻辑之后执行
  setTimeout(() => barRef.value?.focus(), 50)

  if (barRef.value?.parentElement) {
    resizeObserver = new ResizeObserver(() => {
      adjustPositionToFit()
    })
    resizeObserver.observe(barRef.value.parentElement)
  }
  emit('layout')
})

onBeforeUnmount(() => {
  lastInvokeAt = 0
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
  document.removeEventListener('mousemove', onDocumentMouseMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.feedback-bar {
  position: absolute;
  z-index: 20;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
  cursor: move;
  user-select: none;
  outline: none;
}

.feedback-header {
  display: flex;
  align-items: center;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}

.feedback-dot {
  color: var(--fb-text);
  margin-right: 4px;
  font-size: 14px;
}

.feedback-title {
  color: var(--fb-text);
  /* font-weight: 500; */
}

.feedback-hint {
  color: var(--fb-hint);
  margin-left: 2px;
}

.feedback-options {
  display: flex;
  align-items: center;
  gap: 32px;
  padding-left: 12px;
}

.feedback-option-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 12px;
  line-height: 20px;
  color: var(--fb-text);
  white-space: nowrap;
  transition: opacity 0.15s;
}

.feedback-option-btn:hover:not(:disabled) {
  opacity: 0.8;
}

.feedback-option-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.feedback-option-btn.active {
  opacity: 0.6;
}

.option-key {
  color: var(--fb-text);
}

.option-label {
  color: var(--fb-text);
}

.option-desc {
  color: var(--fb-hint);
}

.feedback-bar--fadeout {
  animation: fadeOut 1s ease-out forwards;
}

.feedback-thanks {
  font-size: 12px;
  line-height: 20px;
  color: var(--fb-text);
  text-align: center;
  padding: 2px 0;
}

@keyframes fadeOut {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
