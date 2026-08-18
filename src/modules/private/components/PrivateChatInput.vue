<template>
  <div class="chat-input-area">
    <div ref="inputWrapperRef" class="input-wrapper" :class="{ focused: isFocused }">
      <div class="input-glow"></div>
      <div
        class="input-container"
        :class="{
          'has-file-preview': uploadAreaRef?.hasFiles,
          'has-quote-bar': props.quotingMessage,
        }"
      >
        <MessageQuoteBar
          v-if="props.quotingMessage"
          :quoting-message="props.quotingMessage"
          :sender-display-name="props.quotingSenderName"
          @cancel="emit('cancel-quote')"
        />
        <FilePreviewStrip v-if="uploadAreaRef?.hasFiles" :upload-area-ref="uploadAreaRef" />

        <div class="textarea-wrapper">
          <div class="textarea-editor-inner">
            <div
              ref="textareaRef"
              class="chat-textarea chat-input-editable"
              role="textbox"
              tabindex="0"
              spellcheck="false"
              contenteditable="true"
              :class="{ composing: isComposing, 'is-placeholder': !inputText.trim() }"
              data-placeholder="输入消息"
              aria-multiline="true"
              @input="onEditableInput"
              @keydown="handleKeydown"
              @focus="isFocused = true"
              @blur="isFocused = false"
              @paste="handlePaste"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
            />
          </div>
        </div>
        <div class="input-bottom">
          <div class="input-bottom-left">
            <ChatFileUploadArea
              ref="uploadAreaRef"
              :space-id="String(props.conversationId)"
              :conversation-id="String(props.conversationId)"
            />
          </div>
          <div class="input-bottom-right">
            <button
              class="send-btn"
              :class="{ active: canSend }"
              :disabled="!canSend"
              @click="send"
            >
              <img src="@/assets/home/send_icon.svg" alt="send" class="send-icon">
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watchEffect, inject, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CHAT_COMPOSER_INPUT_BOX_KEY,
  FORCE_SCROLL_TO_BOTTOM_KEY,
} from '@/shared/constants/injectionKeys'
import ChatFileUploadArea from '@/shared/components/ChatFileUploadArea.vue'
import MessageQuoteBar from '@/shared/components/MessageQuoteBar.vue'
import FilePreviewStrip from '@/shared/components/FilePreviewStrip.vue'
import { useChatFileInput } from '@/shared/chatComposables/useChatFileInput'
import { useChatInputEditable } from '@/shared/chatComposables/useChatInputEditable'
import { usePrivateStore } from '@/modules/private/store'

defineOptions({ name: 'PrivateChatInput' })

const props = defineProps({
  conversationId: { type: [String, Number], required: true },
  quoteRequestSerial: { type: Number, default: 0 },
  quotingMessage: { type: Object, default: null },
  quotingSenderName: { type: String, default: '' },
})

const emit = defineEmits(['cancel-quote'])

const privateStore = usePrivateStore()

const composerInputBoxRef = inject(CHAT_COMPOSER_INPUT_BOX_KEY, null)
const inputWrapperRef = ref(null)
const forceScrollToBottom = inject(FORCE_SCROLL_TO_BOTTOM_KEY, null)

watchEffect(() => {
  if (!composerInputBoxRef) return
  composerInputBoxRef.value = inputWrapperRef.value
})

const textareaRef = ref(null)
const uploadAreaRef = ref(null)
const isFocused = ref(false)

useChatFileInput(uploadAreaRef)

const {
  inputText,
  isComposing,
  onCompositionStart,
  onCompositionEnd,
  handlePaste,
  onEditableInput,
  clearEditable,
} = useChatInputEditable(textareaRef, {
  maxHeight: 108,
  onPasteFiles: (files) => uploadAreaRef.value?.addFiles(files),
})

const canSend = computed(() => {
  const upload = uploadAreaRef.value
  return (
    (inputText.value.trim().length > 0 || (upload?.hasFiles ?? false)) &&
    (upload?.allUploaded ?? true)
  )
})

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    e.preventDefault()
    send()
  }
  if (e.key === 'Escape' && props.quotingMessage) {
    emit('cancel-quote')
  }
}

onMounted(async () => {
  await privateStore.loadHistory(props.conversationId)
})

async function send() {
  if (!canSend.value) return

  const text = inputText.value.trim()
  const filesToSend = (uploadAreaRef.value?.pendingFiles ?? []).filter((f) => f.url)
  const hasText = text.length > 0
  const hasFiles = filesToSend.length > 0

  const replyOpts = props.quotingMessage
    ? {
        replyToId: props.quotingMessage.id ?? props.quotingMessage.eventId,
      }
    : {}

  uploadAreaRef.value?.clearFiles()
  clearEditable()
  emit('cancel-quote')

  try {
    if (hasFiles) {
      // 将所有附件合并到一个消息中发送
      const attachments = filesToSend.map(f => ({
        url: f.url,
        name: f.file.name,
        size: f.file.size,
        mime_type: f.file.type,
        // 附加上传接口返回的全部信息
        ...(f.fileInfo || {}),
      }))

      // 发送一条消息，包含文本和所有附件
      await privateStore.sendTextMessage(props.conversationId, text, {
        ...replyOpts,
        attachments,
      })
    } else if (hasText) {
      await privateStore.sendTextMessage(props.conversationId, text, replyOpts)
    }
  } catch (err) {
    console.error('[PrivateChatInput] 发送失败:', err)
    ElMessage.error('发送失败')
  }

  nextTick(() => forceScrollToBottom?.())
}
</script>

<style scoped>
.chat-input-area {
  padding: 4px 24px 28px;
  background: #fff;
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.chat-input-area > .input-wrapper {
  width: 100%;
  max-width: 952px;
}

.input-wrapper {
  position: relative;
  background: rgba(180, 180, 180, 0.3);
  border-radius: 16px;
  padding: 1.5px;
  box-shadow: 4px 4px 6px #91949e24;
  z-index: 0;
  transition: background 0.3s;
}

.input-wrapper::before {
  content: '';
  position: absolute;
  inset: 6px 5px 0px 5px;
  border-radius: 16px;
  z-index: 0;
  pointer-events: none;
  background: conic-gradient(
    from var(--arc-angle, 0turn),
    rgba(255, 151, 133, 1) 0%,
    rgba(255, 178, 95, 1) 14%,
    rgba(255, 221, 85, 1) 28%,
    rgba(45, 255, 203, 1) 42%,
    rgba(59, 180, 255, 1) 56%,
    rgba(0, 140, 255, 1) 70%,
    rgba(115, 60, 255, 1) 84%,
    rgba(255, 151, 133, 1) 100%
  );
  animation: arc-spin 4s linear infinite;
  filter: blur(6px);
  opacity: 0.6;
  transition: opacity 0.8s ease-out, filter 0.8s ease-out;
}

.input-wrapper.focused::before {
  inset: 3px 6px -3px 6px;
}

.input-wrapper::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 16px;
  background: #ffffff;
  z-index: 0;
  pointer-events: none;
}

.input-glow {
  height: 40px;
  position: absolute;
  width: 100%;
  margin-top: -44px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.2) 20%,
    rgba(255, 255, 255, 0.4) 45%,
    rgba(255, 255, 255, 1) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.input-container {
  position: relative;
  border: none;
  border-radius: 12px;
  background: transparent;
  padding: 12px 16px 8px;
  z-index: 2;
}

@property --arc-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0turn;
}

@keyframes arc-spin {
  from { --arc-angle: 0turn; }
  to { --arc-angle: 1turn; }
}

@media (prefers-reduced-motion: reduce) {
  .input-wrapper::before { animation: none; }
}

.input-container.has-file-preview {
  padding-top: 4px;
}

.input-container.has-quote-bar {
  padding-top: 8px;
}

.textarea-wrapper {
  position: relative;
  margin-left: 4px;
  width: calc(100% - 4px);
  box-sizing: border-box;
}

.textarea-editor-inner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.textarea-editor-inner .chat-textarea {
  flex: 1;
  min-width: 0;
  width: auto;
}

.chat-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  caret-color: #F58138;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  max-height: 108px;
  min-height: 60px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.chat-textarea.chat-input-editable {
  resize: none;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
}

.chat-input-editable.is-placeholder:before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 0;
}

.input-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.input-bottom-left {
  display: flex;
  align-items: center;
}

.input-bottom-right {
  display: flex;
  align-items: center;
}

.send-btn {
  width: 28px;
  height: 28px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  flex-shrink: 0;
  transition: all 0.2s ease;
  border-radius: 9.6px;
  background: rgba(2, 2, 2, 0.5);
  border: none;
}

.send-btn.active {
  background: #020202;
  cursor: pointer;
}

.send-btn.active:hover {
  transform: scale(1.05);
}

.send-icon {
  width: 16px;
  height: 16px;
}

.input-wrapper.focused .send-btn {
  background: #171B26;
}
</style>
