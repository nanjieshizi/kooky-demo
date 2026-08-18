<template>
  <div
    class="factory-left-panel employee-chat-panel"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <FactorySessionHeader />

    <Transition name="drag-fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-card">
          <img :src="uploadDragImg" class="drag-img" alt="" />
          <p class="drag-title">在此处拖放文件/图片</p>
          <p class="drag-hint">最多支持 5 个文件，每个 50MB，支持 MD、TXT、PDF、DOCX、ODT、JPG、PNG、代码文件等</p>
        </div>
      </div>
    </Transition>

    <!-- 引导问卷卡片：仅在未完成且未跳过时显示 -->
    <FactoryOnboardingCard
      v-if="!factoryStore.onboarding.completed && !factoryStore.onboarding.skipped"
    />

    <!-- 上下文提示气泡列表 -->
    <div v-if="factoryStore.contextHints.length > 0" class="context-hints-stack">
      <FactoryContextHint
        v-for="hint in factoryStore.contextHints"
        :key="hint.id"
        :id="hint.id"
        :type="hint.type"
        :message="hint.message"
      />
    </div>

    <EmployeeMessageList
      v-show="factoryStore.onboarding.completed || factoryStore.onboarding.skipped"
      :messages="messages"
      :employee="currentEmployee"
      :loading="loading"
      :sending="sending"
      :is-streaming="streaming"
      :fetch-welcome-prompts="false"
      :space-id="'factory-thread-1'"
      :welcome-message="welcomeMessage"
      @quote="handleQuote"
      @copy="handleCopy"
      @feedback="handleFeedback"
      @regenerate="handleRegenerate"
      @welcome-prompt-pick="handleWelcomePromptPick"
    >
      <template #body-extra="{ message }">
        <FactoryBuildSteps
          v-if="message.role === 'assistant' && message.steps && message.steps.length"
          :steps="message.steps"
        />
        <FactoryVersionCard
          v-if="message.role === 'assistant' && message.versionInfo"
          :version="message.versionInfo"
        />
      </template>
    </EmployeeMessageList>

    <EmployeeChatInput
      ref="inputRef"
      :disabled="sending"
      :is-loading="sending"
      :is-streaming="streaming"
      :show-model-selector="false"
      :show-skill-market="true"
      :show-welcome-prompt-bar="messages.length > 0"
      :fetch-welcome-prompts="false"
      :employee-name="currentEmployee?.name || ''"
      :quoting-message="factoryStore.employeeQuotingMessage"
      @submit="handleSubmit"
      @stop="factoryStore.stopEmployeeStreaming()"
      @cancel-quote="factoryStore.clearEmployeeQuotingMessage()"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, provide, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useFactoryStore } from '../store'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import EmployeeMessageList from '@/modules/solo-team/components/EmployeeMessageList.vue'
import EmployeeChatInput from '@/modules/solo-team/components/EmployeeChatInput.vue'
import FactorySessionHeader from './FactorySessionHeader.vue'
import FactoryVersionCard from './FactoryVersionCard.vue'
import FactoryBuildSteps from './FactoryBuildSteps.vue'
import FactoryOnboardingCard from './FactoryOnboardingCard.vue'
import FactoryContextHint from './FactoryContextHint.vue'
import uploadDragImg from '@/assets/home/uploadDrag.png'

defineOptions({ name: 'FactoryLeftPanel' })

const factoryStore = useFactoryStore()

// 关键：把 factoryStore 作为 EmployeeMessageList / EmployeeChatInput 期望的 session store 注入
provide(EMPLOYEE_CHAT_SESSION_STORE_KEY, factoryStore)

const inputRef = ref(null)

// 拖拽（暂不实现真实上传，仅 UI）
const isDragging = ref(false)
function onDragEnter(e) {
  e.preventDefault()
  isDragging.value = true
}
function onDragOver(e) {
  e.preventDefault()
}
function onDragLeave(e) {
  if (e.target === e.currentTarget) isDragging.value = false
}
function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
}

const currentEmployee = computed(() => factoryStore.currentEmployee)
const messages = computed(() => factoryStore.currentEmployeeMessages)
const sending = computed(() => factoryStore.isGenerating)
const streaming = computed(() => factoryStore.isGenerating)
const loading = computed(() => false)

const welcomeMessage = computed(
  () => currentEmployee.value?.welcomeMessage
    || `你好！我是 ${currentEmployee.value?.name || 'Agent Creator'}，告诉我你想创建什么样的 Agent？`,
)

async function handleSubmit(payload) {
  await factoryStore.sendEmployeeMessage(
    factoryStore.currentEmployeeId,
    factoryStore.currentEmployeeThreadId,
    payload.text,
    payload.files || [],
    {
      mode: payload.mode,
      model: payload.model,
      skills: payload.skills || [],
      replyTo: factoryStore.employeeQuotingMessage,
    },
  )
  factoryStore.clearEmployeeQuotingMessage()
}

function handleQuote(message) {
  factoryStore.setEmployeeQuotingMessage(message)
  nextTick(() => inputRef.value?.focus?.())
}

async function handleCopy(content) {
  try {
    await navigator.clipboard.writeText(content || '')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function handleFeedback(messageId, type) {
  factoryStore.submitEmployeeFeedback(
    factoryStore.currentEmployeeId,
    factoryStore.currentEmployeeThreadId,
    messageId,
    type,
  )
}

async function handleRegenerate() {
  await factoryStore.regenerateEmployeeLastMessage(
    factoryStore.currentEmployeeId,
    factoryStore.currentEmployeeThreadId,
  )
}

function handleWelcomePromptPick(payload) {
  const text = String(payload?.content ?? '').trim()
  if (!text) return
  factoryStore.setEmployeePendingPrefillText(text)
}

// ─── 滚动定位 ─────────────────────────────────────────────────────
watch(() => factoryStore.scrollTargetMessageId, (token) => {
  if (!token) return
  const messageId = token.split('__')[0]
  nextTick(() => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 高亮动画
      el.classList.add('highlight-flash')
      setTimeout(() => el.classList.remove('highlight-flash'), 1500)
    } else {
      ElMessage.warning('该版本对应的对话不在当前会话中')
    }
    factoryStore.consumeScrollTarget()
  })
})
</script>

<style lang="scss" scoped>
.employee-chat-panel {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 8px 8px, rgba(255, 183, 180, 0.24) 1.2px, transparent 1.4px) 0 0 / 22px 22px,
    #fff;
  position: relative;
}

/* 让 EmployeeMessageList 透出外层波点背景 */
:deep(.message-list-root) {
  background: transparent;
}

/* 引导卡片：左右留出与消息列表一致的边距；可伸缩 + 内部滚动（嵌窄栏不顶掉输入框）*/
.factory-left-panel > :deep(.factory-onboarding-card) {
  margin: 12px 20px 4px;
  width: auto;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}

/* 上下文提示气泡列表 */
.context-hints-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 20px 4px;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 48px;
  border-radius: 16px;
  background: #fff;
  min-width: 280px;
}

.drag-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.drag-title {
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
  margin: 0;
}

.drag-hint {
  font-size: 12px;
  color: #91949e;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
  opacity: 0;
}

/* 滚动定位高亮动画 */
:deep(.message-item.highlight-flash) {
  animation: highlight-pulse 1.5s ease-out;
}

@keyframes highlight-pulse {
  0% {
    background: rgba(99, 102, 241, 0.15);
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
  }
  50% {
    background: rgba(99, 102, 241, 0.08);
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
  }
  100% {
    background: transparent;
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
  }
}
</style>
