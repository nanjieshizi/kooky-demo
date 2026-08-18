<template>
  <div
    v-if="visible"
    class="msg-actions"
    :class="[
      { 'msg-actions--always': showAlways },
      `msg-actions--${actionMode}`,
    ]"
  >
    <!-- 助手消息：复制 + 引用 + 重新生成 + 赞踩 -->
    <template v-if="actionMode === 'assistant'">
      <el-tooltip content="复制" placement="top" :show-after="500">
        <button class="action-btn" aria-label="复制" @click="onCopy">
          <img :src="copyIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip v-if="showQuote && props.message" content="引用" placement="top" :show-after="500">
        <button class="action-btn" aria-label="引用" @click="emit('quote', props.message)">
          <img class="quote-icon-img" :src="quoteIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip content="点赞" placement="top" :show-after="500">
        <button
          class="action-btn"
          :class="{ active: feedback === 'like' }"
          aria-label="点赞"
          @click="onLike"
        >
          <img :src="feedback === 'like' ? likeActiveIcon : likeIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip content="点踩" placement="top" :show-after="500">
        <button
          class="action-btn"
          :class="{ active: feedback === 'dislike' }"
          aria-label="点踩"
          @click="onDislike"
        >
          <img :src="feedback === 'dislike' ? disLikeActiveIcon : stepIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip
        content="重新生成"
        placement="top"
        :show-after="500"
      >
        <button
          class="action-btn"
          aria-label="重新生成"
          :disabled="isStreaming"
          @click="onRegenerate"
        >
          <img :src="regenerateIcon" alt="" />
        </button>
      </el-tooltip>
      <!-- 📥 转发到 Kode：仅在云帆数字人这类有 Kode 联动能力的对话里显示 -->
      <span v-if="showForwardToKode" class="action-divider" aria-hidden="true" />
      <button
        v-if="showForwardToKode"
        type="button"
        class="action-btn action-btn--forward-kode"
        aria-label="转发到 Kode"
        title="把这条消息作为任务转发到 Kode"
        @click="onForwardToKode"
      >
        <span class="fwd-emoji">📥</span>
        <span class="fwd-text">转发到 Kode</span>
      </button>
      <Teleport to="body">
        <div
          v-if="showTooltip"
          class="msg-feedback-tip-floating"
          :class="{ 'msg-feedback-tip-floating--wide': feedback === 'dislike' }"
          role="status"
          :style="feedbackTipStyle"
        >
          <div class="msg-feedback-tip-floating__inner">
            <img class="msg-feedback-tip-floating__icon" :src="huaIcon" alt="" />
            <span>{{ feedbackTipCopy }}</span>
          </div>
        </div>
      </Teleport>
    </template>

    <!-- 用户消息：引用 + 复制 -->
    <template v-else-if="actionMode === 'user'">
      <el-tooltip v-if="showQuote && props.message" content="引用" placement="top" :show-after="500">
        <button class="action-btn" aria-label="引用" @click="emit('quote', props.message)">
          <img class="quote-icon-img" :src="quoteIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip content="复制" placement="top" :show-after="500">
        <button class="action-btn" aria-label="复制" @click="onCopy">
          <img :src="copyIcon" alt="" />
        </button>
      </el-tooltip>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { submitClaudeCodeLike } from '@/modules/terminal/claudeLikeService'
import copyIcon from '@/assets/home/refresh.svg'
import quoteIcon from '@/assets/chat/quote.svg'
import likeIcon from '@/assets/home/like.svg'
import stepIcon from '@/assets/home/step.svg'
import likeActiveIcon from '@/assets/chat/dainzan_click.svg'
import disLikeActiveIcon from '@/assets/chat/diancai_click.svg'
import huaIcon from '@/assets/chat/hua.svg'
// 重新生成图标（沿用 copy 图标暂代；如有专用刷新图标可替换）
import regenerateIcon from '@/assets/deerflowChat/refresh_set.svg'

const props = defineProps({
  actionMode: {
    type: String,
    default: 'assistant',
    validator: (v) => ['assistant', 'user'].includes(v),
  },
  content: { type: String, default: '' },
  message: { type: Object, default: null },
  isStreaming: { type: Boolean, default: false },
  showAlways: { type: Boolean, default: false },
  /** 是否显示"📥 转发到 Kode"按钮（仅特定数字人对话开启，如云帆数字人）*/
  showForwardToKode: { type: Boolean, default: false },
})

const emit = defineEmits(['quote', 'copy', 'feedback', 'regenerate', 'forward-to-kode'])

function onForwardToKode() {
  emit('forward-to-kode', props.message || { content: props.content })
}

const showQuote = true

const feedback = ref(null)
const showTooltip = ref(false)

const FEEDBACK_STORAGE_KEY = 'deerflow_chat_feedback'

const CHAT_PANEL_ROOT_REF_KEY = 'chatPanelRootRef'
const panelRootRef = inject(CHAT_PANEL_ROOT_REF_KEY, null)

function loadFeedback(messageId) {
  if (!messageId) return null
  try {
    const data = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '{}')
    return data[messageId] || null
  } catch { return null }
}

function saveFeedback(messageId, value) {
  if (!messageId) return
  try {
    const data = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '{}')
    if (value) {
      data[messageId] = value
    } else {
      delete data[messageId]
    }
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

watch(
  () => props.message?.id,
  (id) => {
    if (props.actionMode === 'assistant' && id) {
      feedback.value = loadFeedback(id)
    }
  },
  { immediate: true },
)

const feedbackTipStyle = ref({
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: '100px',
  zIndex: 3000,
})

function layoutFeedbackTip() {
  const panelEl = panelRootRef?.value
  const panelRect = panelEl?.getBoundingClientRect?.()
  const centerX = panelRect ? panelRect.left + panelRect.width / 2 : null
  feedbackTipStyle.value = {
    position: 'fixed',
    left: centerX != null ? `${Math.round(centerX)}px` : '50%',
    transform: 'translateX(-50%)',
    bottom: '100px',
    zIndex: 3000,
  }
}

let detachListeners = null

function attachLayoutListeners() {
  detachListeners?.()
  const onRelayout = () => nextTick(() => layoutFeedbackTip())
  window.addEventListener('resize', onRelayout)
  detachListeners = () => window.removeEventListener('resize', onRelayout)
}

watch(showTooltip, (v) => {
  if (props.actionMode !== 'assistant') return
  if (v) {
    nextTick(() => { layoutFeedbackTip(); attachLayoutListeners() })
  } else {
    detachListeners?.(); detachListeners = null
  }
})

onUnmounted(() => { detachListeners?.() })

const feedbackTipCopy = computed(() => {
  if (feedback.value === 'dislike') {
    return '可以在对话中告诉我你的喜好，帮助我更理解你~'
  }
  return '感谢你的反馈~'
})

const visible = computed(() => {
  if (props.actionMode === 'assistant') {
    return !props.isStreaming && Boolean(props.content?.trim?.())
  }
  if (props.actionMode === 'user') {
    if (Boolean(props.content?.trim?.())) return true
    const a = props.message?.attachments
    return Array.isArray(a) && a.length > 0
  }
  return false
})

function onCopy() {
  // 剪贴板与「已复制」提示由 EmployeeChatPanel.handleCopy 统一处理，避免与 emit('copy') 重复弹两次
  emit('copy', props.content)
}

function onRegenerate() {
  if (props.actionMode !== 'assistant') return
  if (props.isStreaming) return
  emit('regenerate', props.message)
}

function onLike() {
  if (props.actionMode !== 'assistant') return
  const next = feedback.value === 'like' ? null : 'like'
  feedback.value = next
  saveFeedback(props.message?.id, next)
  if (next === 'like') {
    showTooltip.value = true
    setTimeout(() => { showTooltip.value = false }, 2000)
    submitClaudeCodeLike({
      rating: 3,
      responseId: props.message?.id || '',
      sessionId: 'deerflow',
      comment: '',
    }).catch(() => {})
  }
  emit('feedback', props.message?.id, next)
}

function onDislike() {
  if (props.actionMode !== 'assistant') return
  const next = feedback.value === 'dislike' ? null : 'dislike'
  feedback.value = next
  saveFeedback(props.message?.id, next)
  if (next === 'dislike') {
    showTooltip.value = true
    setTimeout(() => { showTooltip.value = false }, 2000)
    submitClaudeCodeLike({
      rating: 1,
      responseId: props.message?.id || '',
      sessionId: 'deerflow',
      comment: '',
    }).catch(() => {})
  }
  emit('feedback', props.message?.id, next)
}
</script>

<style scoped>
.msg-actions {
  display: flex;
  gap: 4px;
  visibility: hidden;
  align-items: center;
}

.msg-actions.msg-actions--always {
  visibility: visible;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.action-btn:hover {
  opacity: 1;
  background: rgba(47, 53, 71, 0.06);
}

.action-btn.active {
  opacity: 1;
}

.action-btn img {
  width: 16px;
  height: 16px;
}

.action-btn .quote-icon-img {
  width: 14px;
  height: auto;
}

/* 分割线 */
.action-divider {
  width: 1px;
  height: 16px;
  background: #DFE2EA;
  margin: 0 4px;
}

/* 📥 转发到 Kode：紫色品牌色 chip */
.action-btn--forward-kode {
  width: auto;
  padding: 0 10px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8478FA;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  background: rgba(132, 120, 250, 0.08);
}
.action-btn--forward-kode:hover {
  background: rgba(132, 120, 250, 0.16);
  color: #6E5FE8;
}
.fwd-emoji { font-size: 13px; line-height: 1; }
.fwd-text { line-height: 1; }
</style>

<style lang="scss">
.msg-feedback-tip-floating {
  padding: 8px 12px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0px 4px 40px 0px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  max-width: min(320px, calc(100vw - 32px));
  box-sizing: border-box;
}

.msg-feedback-tip-floating--wide {
  max-width: min(360px, calc(100vw - 32px));
}

.msg-feedback-tip-floating__inner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 20px;
  color: #2F3547;
}

.msg-feedback-tip-floating__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: block;
}
</style>
