<template>
  <div
    v-if="visible"
    class="msg-actions"
    :class="[
      { 'msg-actions--always': showAlways },
      `msg-actions--${actionMode}`,
    ]"
  >
    <!-- 机器人/助手：复制 + 引用 + 赞踩 + 🦀 帮我回复 -->
    <template v-if="actionMode === 'assistant'">
      <el-tooltip content="复制" placement="top" :show-after="500">
        <button class="action-btn" aria-label="复制" @click="onCopy">
          <img :src="copyIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip v-if="props.showQuote && props.message" content="引用" placement="top" :show-after="500">
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
      <!-- 🦀 帮我回复：用户的分身代笔起草回复 -->
      <span v-if="showAiDraft" class="action-divider" aria-hidden="true" />
      <button
        v-if="showAiDraft"
        type="button"
        class="action-btn action-btn--ai-draft"
        aria-label="帮我回复"
        @click="onAiDraft"
      >
        <span class="ai-draft-emoji">🦀</span>
        <span class="ai-draft-text">帮我回复</span>
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

    <!-- 用户气泡：引用（非 system）+ 复制 -->
    <template v-else-if="actionMode === 'user'">
      <el-tooltip v-if="showUserQuote" content="引用" placement="top" :show-after="500">
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

    <!-- 群成员消息：引用 + 复制 + 🦀 帮我回复（机器人 assistant 走上方分支，为全套操作） -->
    <template v-else-if="actionMode === 'member'">
      <el-tooltip v-if="props.showQuote" content="引用" placement="top" :show-after="500">
        <button class="action-btn" aria-label="引用" @click="emit('quote', props.message)">
          <img class="quote-icon-img" :src="quoteIcon" alt="" />
        </button>
      </el-tooltip>
      <el-tooltip content="复制" placement="top" :show-after="500">
        <button class="action-btn" aria-label="复制" @click="onCopy">
          <img :src="copyIcon" alt="" />
        </button>
      </el-tooltip>
      <!-- 🦀 帮我回复：让分身代笔 -->
      <span v-if="showAiDraft" class="action-divider" aria-hidden="true" />
      <button
        v-if="showAiDraft"
        type="button"
        class="action-btn action-btn--ai-draft"
        aria-label="帮我回复"
        @click="onAiDraft"
      >
        <span class="ai-draft-emoji">🦀</span>
        <span class="ai-draft-text">帮我回复</span>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { submitClaudeCodeLike } from '@/modules/terminal/claudeLikeService'
import {
  loadChatFeedbackSelection,
  removeSubmittedFeedbackRecord,
  saveSubmittedFeedbackRecord,
} from '@/modules/terminal/services/persistentUserDataService'
import {
  CHAT_COMPOSER_TOP_ANCHOR_KEY,
  CHAT_COMPOSER_INPUT_BOX_KEY,
  CHAT_PANEL_ROOT_REF_KEY
} from '@/shared/constants/injectionKeys'
import copyIcon from '@/assets/home/refresh.svg'
import quoteIcon from '@/assets/chat/quote.svg'
import likeIcon from '@/assets/home/like.svg'
import stepIcon from '@/assets/home/step.svg'
import likeActiveIcon from '@/assets/chat/dainzan_click.svg'
import disLikeActiveIcon from '@/assets/chat/diancai_click.svg'
import huaIcon from '@/assets/chat/hua.svg'
import {
  hasMessageActionPayload,
  isBasicMessageActionRole,
} from '@/shared/utils/messageActionVisibility.js'

const props = defineProps({
  /**
   * assistant：助手消息（复制/引用/赞踩）
   * user：用户气泡（引用 + 复制，system 角色不显示引用）
   * member：群成员消息（引用 + 复制）
   */
  actionMode: {
    type: String,
    default: 'assistant',
    validator: (v) => ['assistant', 'user', 'member'].includes(v),
  },
  /** 消息正文，用于复制与是否展示操作栏 */
  content: { type: String, default: '' },
  /** 点赞接口用的消息 id */
  messageId: { type: String, default: '' },
  /** 会话维度 id */
  conversationId: { type: String, default: 'personal' },
  /** 是否处于流式生成中（为 true 时不显示操作栏，仅 assistant 有效） */
  isStreaming: { type: Boolean, default: false },
  /** 为 true 时操作栏常显（不依赖 hover） */
  showAlways: { type: Boolean, default: false },
  /** 当前消息对象，用于引用 */
  message: { type: Object, default: null },
  /** 是否展示引用按钮；一人团队本期暂不上引用，调用方可关闭 */
  showQuote: { type: Boolean, default: true },
  /** 是否展示"🦀 帮我回复"按钮（仅 assistant / member 模式下有效）*/
  showAiDraft: { type: Boolean, default: false },
})

const emit = defineEmits(['quote', 'ai-draft'])

function onAiDraft() {
  // 让父级（GroupMessageItem）转发到 dev-mocks helper 触发草稿流程
  emit('ai-draft', props.message || { content: props.content })
}

const showUserQuote = computed(
  () => props.showQuote && Boolean(props.message) && props.message.role !== 'system',
)

const visible = computed(() => {
  if (props.actionMode === 'assistant') {
    return !props.isStreaming && Boolean(props.content?.trim?.())
  }
  if (props.actionMode === 'user') {
    if (Boolean(props.content?.trim?.())) return true
    const a = props.message?.attachments
    if (Array.isArray(a) && a.length > 0) return true
    const imgs = props.message?.images
    return Array.isArray(imgs) && imgs.length > 0
  }
  if (props.actionMode === 'member') {
    const m = props.message
    return Boolean(m) && isBasicMessageActionRole(m.role) && hasMessageActionPayload(m, props.content)
  }
  return false
})

const copyText = computed(() => {
  const content = String(props.content || '').trim()
  if (content) return content

  const attachments = Array.isArray(props.message?.attachments) ? props.message.attachments : []
  if (attachments.length) {
    return attachments
      .map((item) => item?.name || item?.filename || item?.url || '')
      .filter(Boolean)
      .join('\n')
  }

  const images = Array.isArray(props.message?.images) ? props.message.images : []
  return images
    .map((item) => item?.url || item?.src || '')
    .filter(Boolean)
    .join('\n')
})

const composerTopAnchorRef = inject(CHAT_COMPOSER_TOP_ANCHOR_KEY, null)
const composerInputBoxRef = inject(CHAT_COMPOSER_INPUT_BOX_KEY, null)
const chatPanelRootRef = inject(CHAT_PANEL_ROOT_REF_KEY, null)

const feedback = ref(null)
const showTooltip = ref(false)
const feedbackTipStyle = ref({})
let feedbackHydrateToken = 0

/** 提示底边与输入框壳（.input-wrapper）顶边的间距（UI 稿 20px） */
const FEEDBACK_GAP_ABOVE_INPUT_PX = 20

function getFeedbackVerticalAnchorEl() {
  const box = composerInputBoxRef?.value
  if (box?.getBoundingClientRect) return box
  return composerTopAnchorRef?.value
}

const feedbackTipCopy = computed(() => {
  if (feedback.value === 'dislike') {
    return '可以在对话中告诉我你的喜好，帮助我更理解你~'
  }
  return '感谢你的反馈~'
})

function layoutFeedbackTip() {
  // 相对 ChatPanel 根节点（.chat-area 列宽），勿用 main-area（会包含右侧文件面板）
  const panelEl = chatPanelRootRef?.value
  const panelRect = panelEl?.getBoundingClientRect?.()
  const centerX = panelRect
    ? panelRect.left + panelRect.width / 2
    : null

  const el = getFeedbackVerticalAnchorEl()
  if (!el?.getBoundingClientRect) {
    feedbackTipStyle.value = {
      position: 'fixed',
      left: centerX != null ? `${Math.round(centerX)}px` : '50%',
      transform: 'translateX(-50%)',
      bottom: '100px',
      zIndex: 3000,
    }
    return
  }
  const r = el.getBoundingClientRect()
  // 提示块底边在视口 y = 输入框壳顶 - gap → bottom = innerHeight - (top - gap)
  const bottomPx = window.innerHeight - r.top + FEEDBACK_GAP_ABOVE_INPUT_PX
  feedbackTipStyle.value = {
    position: 'fixed',
    left: centerX != null ? `${Math.round(centerX)}px` : '50%',
    transform: 'translateX(-50%)',
    bottom: `${Math.round(Math.max(8, bottomPx))}px`,
    zIndex: 3000,
  }
}

let detachLayoutListeners = null
function attachLayoutListeners() {
  detachFeedbackLayoutListeners()
  const onRelayout = () => {
    nextTick(() => layoutFeedbackTip())
  }
  window.addEventListener('resize', onRelayout)
  window.addEventListener('scroll', onRelayout, true)
  detachLayoutListeners = () => {
    window.removeEventListener('resize', onRelayout)
    window.removeEventListener('scroll', onRelayout, true)
  }
}

function detachFeedbackLayoutListeners() {
  detachLayoutListeners?.()
  detachLayoutListeners = null
}

watch(showTooltip, (v) => {
  if (props.actionMode !== 'assistant') return
  if (v) {
    nextTick(() => {
      layoutFeedbackTip()
      attachLayoutListeners()
    })
  } else {
    detachFeedbackLayoutListeners()
  }
})

onUnmounted(() => detachFeedbackLayoutListeners())

watch(
  () => [props.actionMode, props.conversationId, props.messageId],
  () => {
    feedbackHydrateToken += 1
    const currentToken = feedbackHydrateToken
    feedback.value = null
    if (props.actionMode !== 'assistant' || !props.conversationId || !props.messageId) return
    void loadChatFeedbackSelection({
      spaceId: props.conversationId,
      messageId: props.messageId,
    }).then((value) => {
      if (feedbackHydrateToken !== currentToken) return
      feedback.value = value
    }).catch(() => {})
  },
  { immediate: true },
)

async function onCopy() {
  try {
    await navigator.clipboard.writeText(copyText.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function onAgain() {
  ElMessage.warning('暂不支持重新生成')
}

function onLike() {
  if (props.actionMode !== 'assistant') return
  const next = feedback.value === 'like' ? null : 'like'
  feedback.value = next
  if (!props.conversationId || !props.messageId) return
  if (next === null) {
    void removeSubmittedFeedbackRecord({
      source: 'chat-message',
      sessionId: props.conversationId,
      responseId: props.messageId,
    })
    return
  }

  if (next === 'like') {
    showTooltip.value = true
    setTimeout(() => { showTooltip.value = false }, 2000)
    void saveSubmittedFeedbackRecord({
      source: 'chat-message',
      sessionId: props.conversationId,
      responseId: props.messageId,
      rating: 3,
    })
    submitClaudeCodeLike({
      rating: 3,
      responseId: props.messageId,
      sessionId: props.conversationId,
      comment: '',
    }).catch(() => {})
  }
}

function onDislike() {
  if (props.actionMode !== 'assistant') return
  const next = feedback.value === 'dislike' ? null : 'dislike'
  feedback.value = next
  if (!props.conversationId || !props.messageId) return
  if (next === null) {
    void removeSubmittedFeedbackRecord({
      source: 'chat-message',
      sessionId: props.conversationId,
      responseId: props.messageId,
    })
    return
  }

  if (next === 'dislike') {
    showTooltip.value = true
    setTimeout(() => { showTooltip.value = false }, 2000)
    void saveSubmittedFeedbackRecord({
      source: 'chat-message',
      sessionId: props.conversationId,
      responseId: props.messageId,
      rating: 1,
    })
    submitClaudeCodeLike({
      rating: 1,
      responseId: props.messageId,
      sessionId: props.conversationId,
      comment: '',
    }).catch(() => {})
  }
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
  /* opacity: 0.45; */
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

.msg-actions--member {
  margin-top: 6px;
}

/* 分割线 */
.action-divider {
  width: 1px;
  height: 16px;
  background: #DFE2EA;
  margin: 0 4px;
}

/* 🦀 帮我回复 按钮：emoji + 文字，主品牌色调，单独区分 */
.action-btn--ai-draft {
  width: auto;
  padding: 0 8px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #436FF6;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  background: rgba(67, 111, 246, 0.08);
}
.action-btn--ai-draft:hover {
  background: rgba(67, 111, 246, 0.16);
  color: #2451D8;
}
.ai-draft-emoji {
  font-size: 13px;
  line-height: 1;
}
.ai-draft-text {
  line-height: 1;
}

/* 模型信息 */
.model-info {
  font-size: 12px;
  color: #C2C3C9;
  padding: 0 4px;
  user-select: none;
}
</style>

<!-- Teleport 到 body，需非 scoped -->
<style lang="scss">
.msg-feedback-tip-floating {
  padding: 8px 12px;
  border-radius: 4px;
  // border: 1px solid #2b2a2a;
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
