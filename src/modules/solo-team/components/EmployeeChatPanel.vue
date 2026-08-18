<template>
  <div
    class="employee-chat-panel"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <Transition name="drag-fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-card">
          <img :src="uploadDragImg" class="drag-img" alt="" />
          <p class="drag-title">在此处拖放文件/图片</p>
          <p class="drag-hint">最多支持 5 个文件，每个 50MB，支持 MD、TXT、PDF、DOCX、ODT、JPG、PNG、代码文件等</p>
        </div>
      </div>
    </Transition>

    <EmployeeMessageList
      :key="employeeChatSessionKey"
      :messages="messages"
      :employee="currentEmployee"
      :loading="loading"
      :sending="sending"
      :is-streaming="streaming"
      :fetch-welcome-prompts="welcomePromptsApiEnabled"
      :space-id="currentThread?.langgraph_thread_id || String(currentThread?.id || '')"
      :welcome-message="welcomeMessage"
      @quote="handleQuote"
      @copy="handleCopy"
      @feedback="handleFeedback"
      @regenerate="handleRegenerate"
      @welcome-prompt-pick="handleWelcomePromptPick"
      @forward-to-kode="handleForwardToKode"
    />
    <!-- <EmployeeTodoList :todos="todos" /> -->
    <EmployeeChatInput
      ref="employeeInputRef"
      :key="`${employeeChatSessionKey}-input`"
      :disabled="sending || uploading"
      :is-loading="sending || uploading"
      :is-streaming="streaming"
      :show-model-selector="showModelSelectorInChat"
      :show-skill-market="!welcomePromptsApiEnabled"
      :show-welcome-prompt-bar="messages.length > 0"
      :fetch-welcome-prompts="welcomePromptsApiEnabled"
      :employee-name="currentEmployee?.name || ''"
      :quoting-message="chatStore.employeeQuotingMessage"
      @submit="handleSubmit"
      @stop="chatStore.stopEmployeeStreaming()"
      @cancel-quote="chatStore.clearEmployeeQuotingMessage()"
    />
  </div>
</template>

<script setup>
import { computed, inject, nextTick, provide, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useSoloTeamStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { useEmployeeDeerflowFileDropProvider } from '../composables/useEmployeeDeerflowFileDrop'
import EmployeeMessageList from './EmployeeMessageList.vue'
import EmployeeChatInput from './EmployeeChatInput.vue'
import EmployeeTodoList from './EmployeeTodoList.vue'
import uploadDragImg from '@/assets/home/uploadDrag.png'

defineOptions({ name: 'EmployeeChatPanel' })

const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const chatStore = injectedSessionStore ?? useSoloTeamStore()
const uiStore = useUIStore()
provide(EMPLOYEE_CHAT_SESSION_STORE_KEY, chatStore)

const employeeInputRef = ref(null)

/** 协作数字人走提示词接口；一人团队「我的员工」暂不请求 */
const welcomePromptsApiEnabled = computed(() => chatStore.$id === 'collaboration-employee-chat')

const { isDragging, onDragEnter, onDragOver, onDragLeave, onDrop } = useEmployeeDeerflowFileDropProvider()

const currentEmployee = computed(() => chatStore.currentEmployee)
const currentThread = computed(() => chatStore.currentEmployeeThread)
/** 与会话 id 绑定，避免 threads 列表刷新瞬间 currentThread 为 null 时整表重挂载导致欢迎页闪现 */
const employeeChatSessionKey = computed(() => {
  const nav = chatStore.currentEmployeeNavKey
  if (nav) return nav
  const eid = chatStore.currentEmployeeId
  const tid = chatStore.currentEmployeeThreadId
  if (eid != null && eid !== '' && tid != null && tid !== '') return `${eid}:${tid}`
  return 'empty'
})

// ─── 流重连：切换会话时尝试恢复活跃的 SSE 流 ─────────────────
let _reconnectDebounceTimer = null
watch(employeeChatSessionKey, (key, oldKey) => {
  if (key === 'empty' || key === oldKey) return
  if (_reconnectDebounceTimer) clearTimeout(_reconnectDebounceTimer)
  _reconnectDebounceTimer = setTimeout(() => {
    chatStore.tryReconnectEmployeeStream()
  }, 200)
})
const messages = computed(() => chatStore.currentEmployeeMessages)
const todos = computed(() => chatStore.currentEmployeeTodos)
const threadState = computed(() => {
  const eid = chatStore.currentEmployeeId
  const tid = chatStore.currentEmployeeThreadId
  if (!eid || tid == null || tid === '') return null
  return chatStore.getEmployeeThreadState(eid, tid)
})
const sending = computed(() => !!threadState.value?.sendingMessage)
const uploading = computed(() => !!threadState.value?.uploadingFiles)
const loading = computed(() => !!threadState.value?.loadingMessages)
const streaming = computed(() => !!threadState.value?.isStreaming)
/** 协作 / 数字人对话隐藏输入框模型选择 */
const showModelSelectorInChat = computed(() => chatStore.employeeChatHost !== 'collaboration')
function buildEmployeeWelcomeMessage(employeeName = '我的分身') {
  return `你好，我是${employeeName}。`
}
const welcomeMessage = computed(() => buildEmployeeWelcomeMessage(currentEmployee.value?.name || '我的分身'))

async function handleSubmit(payload) {
  if (!chatStore.currentEmployeeId || !currentThread.value) return
  await chatStore.sendEmployeeMessage(
    chatStore.currentEmployeeId,
    currentThread.value.id,
    payload.text,
    payload.files || [],
    {
      mode: payload.mode,
      model: payload.model,
      skills: payload.skills || [],
      replyTo: chatStore.employeeQuotingMessage,
    },
  )
  chatStore.clearEmployeeQuotingMessage()
}

function handleQuote(message) {
  chatStore.setEmployeeQuotingMessage(message)
  nextTick(() => employeeInputRef.value?.focus())
}

async function handleCopy(content) {
  const text = content || ''
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function handleFeedback(messageId, type) {
  if (!currentEmployee.value || !currentThread.value) return
  chatStore.submitEmployeeFeedback(currentEmployee.value.id, currentThread.value.id, messageId, type)
}

async function handleRegenerate() {
  if (!currentEmployee.value || !currentThread.value) return
  await chatStore.regenerateEmployeeLastMessage(currentEmployee.value.id, currentThread.value.id)
}

/**
 * 📥 转发到 Kode：把云帆数字人的消息作为 Kode 任务的 desc，弹 Kode 新建任务弹窗
 * 通过全局 window.__kookyMock.openKodeNewTaskWithPrefill 桥接到 Kode 模块
 */
/**
 * 📥 转发到 Kode：点了 → 切到 Kode → 打开新建任务弹窗 + mock 上下文
 * （demo 不真传对话内容，prefill 一段固定的云帆代办 mock 即可）
 */
function handleForwardToKode(/* message */) {
  // 切到 Kode：用 openClaudeCode() 同时设 claudeCodeVisible/claudeCodeActive/activePrimaryNav='cli'
  // 单独设 activePrimaryNav 不会让 KodeView v-if 触发（HomeView 看 claudeCodeVisible）
  uiStore.openClaudeCode?.()
  // KodeView 在切 nav 后一个 tick 挂载，等 250ms 桥接就绪
  setTimeout(() => {
    window.__kookyMock?.openKodeNewTaskWithPrefill?.({
      prefilledDesc:
        '【来自云帆任务平台】\n用户中心配置面板重构 · #YF-1284\n\n问题描述：用户中心团队空间面板的配置项杂乱、权限切换不直观，需要按角色分组重构。\n影响范围：用户中心 → 团队空间面板\n优先级：P1\n\n（已自动从云帆同步上下文，可在下方补充验收 / 约束）',
      sourceMeta: `来自「协作 · 云帆数字人」· #YF-1284`,
      preferredWsId: 'kc',
    })
  }, 250)
}

function handleWelcomePromptPick(payload) {
  const text = String(payload?.content ?? '').trim()
  if (!text) return
  chatStore.setEmployeePendingPrefillText(text)
}
</script>

<style lang="scss" scoped>
.employee-chat-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  position: relative;
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
</style>
