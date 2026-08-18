<template>
  <div class="factory-preview-pane">
    <!-- 预览 Tab 内部工具栏：版本切换器 + 运行记录 + 历史会话 + 新增会话 -->
    <div class="preview-toolbar">
      <div class="toolbar-left">
        <el-dropdown
          trigger="click"
          placement="bottom-start"
          @command="handleVersionSwitch"
        >
          <div class="version-switcher" :class="{ previewing: !!previewingCommit }">
            <span class="version-dot" :style="{ background: previewingCommit ? '#f59e0b' : '#22c55e' }"></span>
            <span class="version-label">{{ previewingCommit ? previewingCommit.hash : currentCommitHash }}</span>
            <span class="version-status-text">{{ previewingCommit ? '预览中' : 'HEAD' }}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="version-caret">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="latest" :class="{ 'is-active': !previewingCommit }">
                <span class="dd-dot" style="background:#22c55e"></span>
                <span class="dd-hash">{{ currentCommitHash }}</span>
                <span class="dd-tag">HEAD</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-for="c in historyCommits"
                :key="c.id"
                :command="c"
                :class="{ 'is-active': previewingCommit && previewingCommit.id === c.id }"
              >
                <span class="dd-dot" style="background:#9ca3af"></span>
                <span class="dd-hash">{{ c.hash }}</span>
                <span class="dd-desc">{{ c.message }}</span>
                <span class="dd-time">{{ c.time }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="toolbar-right">
        <button
          type="button"
          class="icon-btn toolbar-btn-with-label"
          :class="{ active: showTrace }"
          title="运行记录"
          @click="toggleTrace"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span>运行记录</span>
        </button>
        <span class="toolbar-divider"></span>
        <el-popover
          v-model:visible="showPreviewHistory"
          placement="bottom-end"
          :width="280"
          trigger="click"
          popper-class="factory-preview-history-popper"
        >
          <template #reference>
            <button
              type="button"
              class="icon-btn"
              :class="{ active: showPreviewHistory }"
              title="历史会话"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v5h5"/>
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                <path d="M12 7v5l4 2"/>
              </svg>
            </button>
          </template>
          <div class="history-popper">
            <div class="history-popper-head">
              <span class="head-title">历史会话</span>
              <span class="head-count">{{ previewSessions.length }} 条</span>
            </div>
            <div class="history-popper-list">
              <button
                v-for="s in previewSessions"
                :key="s.id"
                type="button"
                class="history-item"
                :class="{ active: s.active }"
                @click="handlePickSession(s.id)"
              >
                <div class="history-item-head">
                  <span class="history-dot" :class="`status-${s.status}`"></span>
                  <span class="history-time">{{ s.date }} {{ s.time }}</span>
                  <span v-if="s.active" class="history-active-tag">当前</span>
                </div>
                <div class="history-preview">{{ s.preview }}</div>
              </button>
            </div>
          </div>
        </el-popover>
        <button
          type="button"
          class="icon-btn"
          title="新增会话"
          @click="handleNewSession"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 预览主体 -->
    <div class="preview-body">
      <!-- Agent 生成中：替换整个预览区为"预览准备中"占位 -->
      <div v-if="agentBuilding" class="preview-preparing">
        <div class="preparing-card">
          <svg class="preparing-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
        </div>
        <div class="preparing-title">
          <span>预览准备中</span>
          <span class="preparing-dots">
            <span></span><span></span><span></span>
          </span>
        </div>
        <p class="preparing-hint">Agent 生成完成后将自动激活</p>
      </div>

      <div v-else class="preview-stack">
        <div class="preview-chat" :style="showTrace ? { height: `${chatHeight}%` } : {}">
          <EmployeeMessageList
            :messages="messages"
            :employee="previewEmployee"
            :loading="false"
            :sending="sending"
            :is-streaming="streaming"
            :fetch-welcome-prompts="false"
            :space-id="'factory-preview-thread'"
            :welcome-message="welcomeMessage"
            @copy="handleCopy"
          />
          <EmployeeChatInput
            ref="inputRef"
            :disabled="sending"
            :is-loading="sending"
            :is-streaming="streaming"
            :show-model-selector="false"
            :show-skill-market="false"
            :show-welcome-prompt-bar="false"
            :fetch-welcome-prompts="false"
            :employee-name="previewEmployee.name"
            :quoting-message="null"
            @submit="handleSubmit"
            @stop="handleStop"
          />
        </div>
        <template v-if="showTrace">
          <div
            class="preview-divider"
            @mousedown="startDrag"
          >
            <div class="divider-line"></div>
          </div>
          <div class="preview-trace" :style="{ height: `${traceHeight}%` }">
            <FactoryTracePanel />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useFactoryStore } from '../../store'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { createPreviewSessionStore } from '../../previewSessionStore'
import EmployeeMessageList from '@/modules/solo-team/components/EmployeeMessageList.vue'
import EmployeeChatInput from '@/modules/solo-team/components/EmployeeChatInput.vue'
import FactoryTracePanel from '../FactoryTracePanel.vue'

defineOptions({ name: 'FactoryPreviewPane' })

const factoryStore = useFactoryStore()

// 创建独立的预览会话 store（与左栏 Agent Creator 对话隔离）
const previewStore = createPreviewSessionStore(factoryStore)
provide(EMPLOYEE_CHAT_SESSION_STORE_KEY, previewStore)

const inputRef = ref(null)

// 预览模式工具栏状态
const { showTrace } = storeToRefs(factoryStore)
const showPreviewHistory = ref(false)
const previewSessions = computed(() => previewStore.previewSessions)

// 拖拽调整 trace 面板高度
const chatHeight = ref(55)
const traceHeight = computed(() => 100 - chatHeight.value)

function startDrag(e) {
  e.preventDefault()
  const startY = e.clientY
  const startChatHeight = chatHeight.value
  const container = e.target.closest('.preview-stack')
  const containerRect = container.getBoundingClientRect()

  function onMouseMove(moveEvent) {
    const deltaY = moveEvent.clientY - startY
    const deltaPercent = (deltaY / containerRect.height) * 100
    let newChatHeight = startChatHeight + deltaPercent

    // 限制最小/最大高度（20% - 80%）
    newChatHeight = Math.max(20, Math.min(80, newChatHeight))
    chatHeight.value = newChatHeight
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function toggleTrace() {
  factoryStore.toggleTrace()
}

// trace 面板展开/收起时，对话区高度变化，强制滚动到底部
watch(showTrace, () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      const root = document.querySelector('.factory-preview-pane .preview-chat')
      const scroller = root?.querySelector('.message-list-scroll')
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
  })
})

function handlePickSession(id) {
  previewStore.pickSession(id)
  showPreviewHistory.value = false
}

function handleNewSession() {
  const prevId = previewStore.activeSessionId
  const newId = previewStore.createNewSession()
  if (newId === prevId) {
    ElMessage.info('当前已是空会话')
  } else {
    ElMessage.success('已创建新会话')
  }
}

// ─── 版本切换器 ────────────────────────────────────────────────
const previewingCommit = computed(() => factoryStore.previewingCommit)
const historyCommits = computed(() => factoryStore.codeCommits)
const currentCommitHash = computed(
  () => factoryStore.headCommit?.hash || '—',
)

function handleVersionSwitch(cmd) {
  if (cmd === 'latest') {
    factoryStore.clearPreviewCommit()
  } else if (cmd && typeof cmd === 'object' && cmd.id) {
    factoryStore.previewCommit(cmd)
  }
}

// ─── 预览数据 ──────────────────────────────────────────────────
const previewEmployee = computed(() => ({
  id: 'preview-agent',
  name: factoryStore.currentAgent.name,
  avatar: null,
  description: '正在测试此 Agent',
  welcomeMessage: `你好！我是 ${factoryStore.currentAgent.name}，有什么可以帮您？`,
}))

const messages = computed(() => previewStore.currentEmployeeMessages)
const sending = computed(() => previewStore.isResponding)
const streaming = computed(() => previewStore.isResponding)
const welcomeMessage = computed(() => `你好！我是 ${factoryStore.currentAgent.name}，有什么可以帮您？`)

// Agent 是否仍在左栏生成中：生成期间预览区不应可用
const agentBuilding = computed(() => factoryStore.isGenerating)

async function handleSubmit(payload) {
  await previewStore.sendEmployeeMessage(
    'preview-agent',
    'preview-thread',
    payload.text,
    payload.files || [],
    payload,
  )
}
function handleStop() {
  previewStore.stopEmployeeStreaming()
}
async function handleCopy(content) {
  try {
    await navigator.clipboard.writeText(content || '')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<style lang="scss" scoped>
.factory-preview-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 8px 8px, rgba(255, 183, 180, 0.24) 1.2px, transparent 1.4px) 0 0 / 22px 22px,
    #fff;
}

/* 让 EmployeeMessageList 透出外层波点背景 */
:deep(.message-list-root) {
  background: transparent;
}

/* 预览 Tab 内部工具栏 */
.preview-toolbar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 版本切换器 */
.version-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border-radius: 10px;
  border: 1px solid rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.06);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  color: #1a1a1a;

  &:hover {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.1);
  }

  &.previewing {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.07);

    &:hover {
      border-color: rgba(245, 158, 11, 0.55);
      background: rgba(245, 158, 11, 0.12);
    }
  }
}

.version-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.version-label {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 600;
  font-size: 12px;
}

.version-status-text {
  font-size: 11px;
  color: #888;
}

.version-caret {
  color: #aaa;
  margin-left: 2px;
}

/* dropdown item 内容 */
.dd-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dd-hash {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  color: #1a1a1a;
}

.dd-desc {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.dd-time {
  font-size: 10px;
  color: #aaa;
  margin-left: auto;
  flex-shrink: 0;
}

.dd-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  margin-left: auto;
}

/* dropdown menu 全局样式 */
:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  min-width: 280px;

  &.is-active {
    background: rgba(99, 102, 241, 0.08);
    color: #6366f1;

    .dd-hash {
      color: #6366f1;
    }
  }
}

/* 工具栏按钮 */
.toolbar-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 4px;
  flex-shrink: 0;
}

.toolbar-btn-with-label {
  width: auto !important;
  padding: 0 8px;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;

  span {
    line-height: 1;
    font-weight: 500;
  }

  &.active {
    color: #6366f1;
  }
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #8d93a6;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }

  &.active {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }
}

/* 预览主体 */
.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 预览：对话区 + 运行记录 上下分屏 */
.preview-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-divider {
  height: 4px;
  flex-shrink: 0;
  cursor: ns-resize;
  position: relative;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(99, 102, 241, 0.08);

    .divider-line {
      background: rgba(99, 102, 241, 0.4);
    }
  }
}

.divider-line {
  width: 40px;
  height: 2px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 1px;
  transition: all 0.2s;
}

.preview-trace {
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* Agent 生成中占位 */
.preview-preparing {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  background: #fff;
  animation: preparing-fade 0.25s ease-out;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
    background-size: 16px 16px;
    opacity: 0.6;
    pointer-events: none;
  }
}

.preparing-card {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  z-index: 1;
}

.preparing-spinner {
  animation: preparing-spin 1s linear infinite;
}

.preparing-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  z-index: 1;
}

.preparing-dots {
  display: inline-flex;
  gap: 2px;

  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #6366f1;
    animation: preparing-pulse 1.4s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

.preparing-hint {
  position: relative;
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
  z-index: 1;
}

@keyframes preparing-spin {
  to { transform: rotate(360deg); }
}

@keyframes preparing-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

@keyframes preparing-fade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

<style lang="scss">
/* 历史会话 popover（非 scoped） */
.factory-preview-history-popper {
  --el-popover-padding: 12px;
  padding: 12px !important;

  .history-popper-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 0 4px;

    .head-title {
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
    }

    .head-count {
      font-size: 10px;
      color: #9ca3af;
    }
  }

  .history-popper-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }

  .history-item {
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: #f7f7f8;
    }

    &.active {
      background: rgba(99, 102, 241, 0.08);
      border-color: rgba(99, 102, 241, 0.3);
    }
  }

  .history-item-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }

  .history-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #9ca3af;

    &.status-success { background: #22c55e; }
    &.status-error { background: #ef4444; }
  }

  .history-time {
    font-size: 10px;
    color: #9ca3af;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
  }

  .history-active-tag {
    margin-left: auto;
    font-size: 9px;
    color: #6366f1;
    font-weight: 500;
  }

  .history-preview {
    font-size: 12px;
    color: #1a1a1a;
    padding-left: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
