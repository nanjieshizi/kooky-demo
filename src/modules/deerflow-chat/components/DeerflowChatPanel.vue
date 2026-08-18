<template>
  <div class="deerflow-chat-panel">
    <!-- 顶部工具栏 -->
    <WorkspaceHeader v-if="messages.length > 0" />

    <!-- 空状态欢迎 / 输入引导（Kooky 原版欢迎页：Hi, 我是Kooky + 4 张特性卡 + 蟹子动画） -->
    <DeerflowIntro v-if="messages.length === 0" @submit="handleSubmit" />


    <!-- 消息列表 -->
    <DeerflowMessageList
      v-else
      :messages="messages"
      :loading="false"
      :is-streaming="isStreaming"
      :welcome-message="welcomeMessage"
      @copy="handleCopy"
      @quote="handleQuote"
      @feedback="handleFeedback"
      @regenerate="handleRegenerate"
    />

    <!-- 输入框：仅在有消息时显示（空状态由 DeerflowIntro 自带输入框） -->
    <DeerflowInput
      v-if="messages.length > 0"
      ref="deerflowInputRef"
      :key="threadKey"
      :is-loading="isSending"
      :is-streaming="isStreaming"
      :disabled="isSending"
      :quoting-message="quotingMessage"
      @submit="handleSubmit"
      @stop="handleStop"
      @cancel-quote="quotingMessage = null"
    />

    <!-- 演示用：文件产物预览弹窗（仿 Kooky 独立预览窗口：tab 切换 源文件/预览） -->
    <el-dialog
      v-model="artifactPreviewVisible"
      width="780px"
      top="5vh"
      append-to-body
      :show-close="false"
      class="artifact-preview-dialog"
    >
      <template #header>
        <div class="artifact-preview-header">
          <div class="artifact-preview-header-left">
            <img :src="mdFileIcon" alt="md" class="artifact-preview-icon" />
            <span class="artifact-preview-name">{{ artifactPreviewName }}</span>
          </div>
          <div class="artifact-preview-header-actions">
            <button class="artifact-preview-icon-btn" title="下载" @click="onPreviewSaveClick">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" stroke="#2F3547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="artifact-preview-icon-btn" title="保存到文件库" @click="onPreviewSaveClick">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="#2F3547" stroke-width="2" stroke-linejoin="round"/>
                <path d="M8 4v5h7V4M8 21v-7h8v7" stroke="#2F3547" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="artifact-preview-icon-btn" title="关闭" @click="artifactPreviewVisible = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="#2F3547" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </template>
      <!-- 源文件 / 预览 tab -->
      <div class="artifact-preview-tabs">
        <button
          class="artifact-preview-tab"
          :class="{ active: artifactPreviewTab === 'source' }"
          @click="artifactPreviewTab = 'source'"
        >源文件</button>
        <button
          class="artifact-preview-tab"
          :class="{ active: artifactPreviewTab === 'preview' }"
          @click="artifactPreviewTab = 'preview'"
        >预览</button>
      </div>
      <div v-if="artifactPreviewTab === 'source'" class="artifact-preview-source">
        <pre><code>{{ artifactPreviewRaw }}</code></pre>
      </div>
      <div v-else class="artifact-preview-paper">
        <div class="artifact-preview-body" v-html="artifactPreviewHtml" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
defineOptions({ name: 'DeerflowChatPanel' })

import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import mdFileIcon from '@/assets/file/md@2x.png'
import DeerflowMessageList from './DeerflowMessageList.vue'
import DeerflowInput from './DeerflowInput.vue'
import DeerflowIntro from './DeerflowIntro.vue'
import WorkspaceHeader from '@/modules/space/components/WorkspaceHeader.vue'

// ─────────────────────────────────────────────────────────
// 本地 Demo 版分身对话面板
//
// 这是 deerflow-chat 模块在本地高保真原型下的简化实现，绕开了原版基于
// LangGraph SDK + 复杂 store（2172 行）的数据流，直接调本地 demo-server
// 的 SSE 接口（/api/deerflow/chat）跟 Claude（Sonnet）对话。
//
// 砍掉的特性：多线程、todos、工具调用、推理过程、附件上传、Skill 选择
// 保留的特性：流式消息、Markdown 渲染、引用、复制、停止、重新生成
//
// 原版备份在同目录的 DeerflowChatPanel.vue.langgraph-backup
// ─────────────────────────────────────────────────────────

const DEMO_URL = 'http://localhost:3939'
const CHAT_API = `${DEMO_URL}/api/deerflow/chat`

const threadKey = 'local-demo-thread'
const welcomeMessage = '我是你的私人 AI 助理「分身」，问点啥都行 ✨'

// 本地状态
const messages = ref([])               // 消息数组：{id, role, content, timestamp, isStreaming?, replyTo?}
const isSending = ref(false)           // 正在发送（含 SSE 全程）
const isStreaming = ref(false)         // 正在流式接收
const quotingMessage = ref(null)
const deerflowInputRef = ref(null)
let currentAbort = null                // 当前 SSE AbortController
let currentAiId = null                 // 当前流式 AI 消息 id

// 引用上下文：用户引用消息发送时，前置一段 Markdown quote 块
function withQuotePrefix(text, replyTo) {
  if (!replyTo?.content) return text
  const quoted = String(replyTo.content)
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  return `${quoted}\n\n${text}`
}

// 把 messages 状态拍成 demo-server 需要的格式
function toApiMessages() {
  return messages.value
    .filter(m => !m.isStreaming || (m.content && m.content.length > 0))
    .map(m => ({
      role: m.role,
      content: m.content || '',
    }))
}

async function handleSubmit({ text }) {
  const trimmed = (text || '').trim()
  if (!trimmed || isSending.value) return

  const replyTo = quotingMessage.value
  const userText = withQuotePrefix(trimmed, replyTo)

  // 推用户气泡
  const userMsgId = `user_${Date.now()}`
  messages.value.push({
    id: userMsgId,
    role: 'user',
    content: userText,
    timestamp: Date.now(),
    replyTo: replyTo
      ? { id: replyTo.id, role: replyTo.role, content: replyTo.content, timestamp: replyTo.timestamp }
      : null,
  })
  quotingMessage.value = null

  // 让浏览器先绘制用户气泡再插 AI 占位
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => r()))

  // 推 AI 占位
  const aiMsgId = `ai_${Date.now()}`
  currentAiId = aiMsgId
  messages.value.push({
    id: aiMsgId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  })

  isSending.value = true
  isStreaming.value = true

  try {
    await streamFromDemoServer(aiMsgId)
  } catch (e) {
    console.error('[deerflow local demo] stream error:', e)
    const ai = messages.value.find(m => m.id === aiMsgId)
    if (ai) {
      ai.content = (ai.content || '') + `\n\n⚠️ 出错：${e.message}\n\n请检查 demo-server 是否在 ${DEMO_URL} 跑着。`
      ai.isStreaming = false
    }
  } finally {
    isSending.value = false
    isStreaming.value = false
    currentAbort = null
    currentAiId = null
  }
}

async function streamFromDemoServer(aiMsgId) {
  const controller = new AbortController()
  currentAbort = controller

  const res = await fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadKey,
      messages: toApiMessages(),
    }),
    signal: controller.signal,
  })

  if (!res.ok) {
    throw new Error(`demo-server 返回 ${res.status}`)
  }
  if (!res.body) {
    throw new Error('demo-server 未返回 SSE 流')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let currentEvent = null

  // 流式解析 SSE：按 \n\n 分块，每块里 event: + data:
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const lines = block.split('\n')
      let evtName = 'message'
      let dataStr = ''
      for (const line of lines) {
        if (line.startsWith('event:')) evtName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataStr = line.slice(5).trim()
      }
      currentEvent = evtName
      let data = null
      try { data = dataStr ? JSON.parse(dataStr) : null } catch (_) {}
      handleSseEvent(currentEvent, data, aiMsgId)
    }
  }

  // 流结束兜底
  const ai = messages.value.find(m => m.id === aiMsgId)
  if (ai) ai.isStreaming = false
}

function handleSseEvent(event, data, aiMsgId) {
  const ai = messages.value.find(m => m.id === aiMsgId)
  if (!ai) return

  if (event === 'ready') {
    // 通道开启，啥也不做
    return
  }
  if (event === 'text-block') {
    const text = data?.text || ''
    if (text) {
      ai.content = (ai.content || '') + (ai.content ? '\n\n' : '') + text
    }
    return
  }
  if (event === 'done') {
    ai.isStreaming = false
    ai.cost = data?.cost
    ai.duration = data?.duration
    return
  }
  if (event === 'error') {
    ai.content = (ai.content || '') + `\n\n⚠️ ${data?.message || '未知错误'}`
    ai.isStreaming = false
    return
  }
}

function handleStop() {
  if (currentAbort) {
    try { currentAbort.abort() } catch (_) {}
  }
  isStreaming.value = false
  isSending.value = false
  const ai = currentAiId ? messages.value.find(m => m.id === currentAiId) : null
  if (ai) {
    ai.isStreaming = false
    if (!ai.content) ai.content = '（已中止）'
  }
}

function handleCopy() {
  // MessageList 内部已处理 toast
}

function handleQuote(message) {
  quotingMessage.value = message
  nextTick(() => deerflowInputRef.value?.focus?.())
}

function handleFeedback(_messageId, _type) {
  // 本地 demo 不持久化反馈
}

async function handleRegenerate() {
  // 找到最后一对 user-assistant 消息，删 assistant，重发 user
  const lastAiIdx = [...messages.value].reverse().findIndex(m => m.role === 'assistant')
  if (lastAiIdx === -1) return
  const aiIdx = messages.value.length - 1 - lastAiIdx
  // 找它前面的 user 消息
  let userIdx = aiIdx - 1
  while (userIdx >= 0 && messages.value[userIdx].role !== 'user') userIdx--
  if (userIdx < 0) return
  const userMsg = messages.value[userIdx]
  // 删掉这条 AI（以及之后的所有消息，简化处理）
  messages.value = messages.value.slice(0, aiIdx)
  // 把 user 也删了再重发（避免重复用户气泡）
  messages.value = messages.value.slice(0, userIdx)
  await handleSubmit({ text: userMsg.content })
}

// ─────────────────────────────────────────────────────────
// Dev 演示桥：把内部 messages + helpers 暴露到 window
// 让 dev-mocks 里的剧本可以直接 push 消息 / 流式 / 推文件产物
// ─────────────────────────────────────────────────────────
function _addUserMessage(text) {
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  messages.value.push({
    id,
    role: 'user',
    content: text,
    timestamp: Date.now(),
  })
  return id
}

function _addAssistantMessage(initial = '', extra = {}) {
  const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  messages.value.push({
    id,
    role: 'assistant',
    content: initial,
    timestamp: Date.now(),
    isStreaming: !!extra.streaming,
    ...extra,
  })
  return id
}

function _appendAssistantChunk(id, chunk) {
  const msg = messages.value.find(m => m.id === id)
  if (msg) msg.content = (msg.content || '') + chunk
}

function _replaceAssistantContent(id, content) {
  const msg = messages.value.find(m => m.id === id)
  if (msg) msg.content = content || ''
}

function _finishAssistant(id) {
  const msg = messages.value.find(m => m.id === id)
  if (msg) msg.isStreaming = false
}

function _addArtifact(id, artifact) {
  const msg = messages.value.find(m => m.id === id)
  if (!msg) return
  // 直接挂到 demoArtifact 字段，DeerflowMessageItem 渲染那个
  msg.demoArtifact = artifact
}

function _clearMessages() {
  messages.value = []
}

// ── 文件产物预览 ──
const artifactPreviewVisible = ref(false)
const artifactPreviewName = ref('')
const artifactPreviewHtml = ref('')
const artifactPreviewRaw = ref('')
const artifactPreviewTab = ref('preview')

const _md = new MarkdownIt({ html: false, breaks: true, linkify: true })
function _renderMarkdown(md) {
  if (!md) return ''
  try {
    return _md.render(String(md))
  } catch (e) {
    return `<pre>${String(md).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>`
  }
}

function _openArtifactPreview(art) {
  if (!art) return
  artifactPreviewName.value = art.name || '文档'
  artifactPreviewRaw.value = art.content || ''
  artifactPreviewHtml.value = _renderMarkdown(art.content || '（暂无内容）')
  artifactPreviewTab.value = 'preview'
  artifactPreviewVisible.value = true
}

function _saveArtifact(art) {
  try {
    if (typeof window.__addToFileLibrary === 'function' && art && art.name) {
      window.__addToFileLibrary({ name: art.name, content: art.content })
    }
  } catch (e) {
    console.warn('[deerflow-chat] add to file library failed', e)
  }
  ElMessage.success('已保存到文件库')
}

function onPreviewSaveClick() {
  _saveArtifact({ name: artifactPreviewName.value, content: artifactPreviewRaw.value })
  artifactPreviewVisible.value = false
}

onMounted(() => {
  if (import.meta.env.DEV) {
    window.__deerflowChat = {
      messages,
      addUserMessage: _addUserMessage,
      addAssistantMessage: _addAssistantMessage,
      appendAssistantChunk: _appendAssistantChunk,
      replaceAssistantContent: _replaceAssistantContent,
      finishAssistant: _finishAssistant,
      addArtifact: _addArtifact,
      clearMessages: _clearMessages,
      openArtifactPreview: _openArtifactPreview,
      saveArtifact: _saveArtifact,
    }
    // dev 模式：route 切换时如果当前 threadId 有内置 mock 消息，自动注入
    // dev-mocks 把数据挂在 window.__devMockDeerflowThreads[threadId] = [ {role, content, timestamp}, ... ]
    const route = useRoute()
    const tryInjectMockMessages = (threadId) => {
      const key = String(threadId || '')
      const mock = window.__devMockDeerflowThreads?.[key]
      if (Array.isArray(mock) && mock.length > 0) {
        messages.value = mock.map((m, i) => ({
          id: m.id || `mock_${key}_${i}`,
          role: m.role,
          content: m.content,
          attachments: m.attachments || [],
          timestamp: m.timestamp || Date.now() - (mock.length - i) * 1000,
        }))
      } else {
        // 切到非 mock 会话，清空（避免上一个 mock 残留）
        messages.value = []
      }
    }
    watch(() => route.params.threadId, (id) => tryInjectMockMessages(id), { immediate: true })
  }
})

onBeforeUnmount(() => {
  if (window.__deerflowChat) {
    delete window.__deerflowChat
  }
})
</script>

<style scoped>
.deerflow-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #fff;
  position: relative;
}

.empty-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  gap: 12px;
}

.welcome-icon {
  font-size: 48px;
}

.welcome-title {
  font-size: 20px;
  font-weight: 600;
  color: #2F3547;
  margin: 0;
}

.welcome-subtitle {
  font-size: 13px;
  color: #91949E;
  margin: 0;
  line-height: 1.7;
  max-width: 480px;
}

/* ===== 文件产物预览弹窗：文档卡风格 ===== */
/* 关键：dialog 自身 + body 各自加 max-height，不依赖 flex（部分 EP 版本 .el-dialog 是 block） */
:deep(.artifact-preview-dialog) {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  margin: 5vh auto !important;
  max-height: 90vh;
}
:deep(.artifact-preview-dialog .el-dialog__header) {
  padding: 0;
  margin: 0;
  border-bottom: 1px solid #ececf1;
}
:deep(.artifact-preview-dialog .el-dialog__body) {
  padding: 0;
  background: #f5f6f9;
  /* 视窗高 - 上下 margin(10vh) - header(60px) */
  max-height: calc(90vh - 60px);
  overflow-y: auto;
  overflow-x: hidden;
}

.artifact-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #ffffff;
}
.artifact-preview-header-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.artifact-preview-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}
.artifact-preview-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artifact-preview-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.artifact-preview-icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.artifact-preview-icon-btn:hover {
  background: #f3f4f6;
}

/* 源文件 / 预览 tab —— 黏住，body 内滚时保留可见 */
.artifact-preview-tabs {
  display: flex;
  gap: 0;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #ececf1;
  position: sticky;
  top: 0;
  z-index: 2;
}
.artifact-preview-tab {
  position: relative;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  font-size: 14px;
  color: #86909c;
  cursor: pointer;
  transition: color 0.15s;
}
.artifact-preview-tab:hover {
  color: #2f3547;
}
.artifact-preview-tab.active {
  color: #f5824a;
  font-weight: 600;
}
.artifact-preview-tab.active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: -1px;
  height: 2px;
  background: #f5824a;
  border-radius: 1px;
}

/* 源文件视图 —— 滚动交给外层 el-dialog__body */
.artifact-preview-source {
  background: #f5f6f9;
  padding: 16px 20px;
}
.artifact-preview-source pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #1f2937;
}
.artifact-preview-source pre code {
  background: transparent;
  border: 0;
  padding: 0;
}

/* 纸质卡片 */
.artifact-preview-paper {
  background: #ffffff;
  margin: 20px auto;
  padding: 40px 48px;
  max-width: 660px;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  font-size: 14.5px;
  line-height: 1.75;
  color: #1f2937;
}

/* markdown 内容 */
.artifact-preview-body :deep(h1) {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 18px;
  color: #111827;
  padding-bottom: 12px;
  border-bottom: 2px solid #1f2937;
}
.artifact-preview-body :deep(h2) {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.4;
  margin: 24px 0 12px;
  color: #1f2937;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}
.artifact-preview-body :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 18px 0 8px;
  color: #2f3547;
}
.artifact-preview-body :deep(p) {
  margin: 8px 0;
}
.artifact-preview-body :deep(ul),
.artifact-preview-body :deep(ol) {
  padding-left: 24px;
  margin: 6px 0 14px;
}
.artifact-preview-body :deep(li) {
  margin: 4px 0;
}
.artifact-preview-body :deep(strong) {
  color: #d92d20;
  font-weight: 600;
}
.artifact-preview-body :deep(em) {
  color: #6b7280;
  font-style: italic;
}
.artifact-preview-body :deep(code) {
  padding: 2px 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12.5px;
  font-family: SFMono-Regular, Menlo, monospace;
  color: #c2410c;
}
.artifact-preview-body :deep(pre) {
  background: #1f2937;
  color: #f9fafb;
  padding: 14px 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}
.artifact-preview-body :deep(pre code) {
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0;
}
.artifact-preview-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 14px;
  border-left: 3px solid #c9d6fa;
  background: #f5f7ff;
  color: #4b5563;
  border-radius: 0 6px 6px 0;
}
.artifact-preview-body :deep(hr) {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 24px 0;
}
.artifact-preview-body :deep(table) {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
  font-size: 13px;
}
.artifact-preview-body :deep(th),
.artifact-preview-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
}
.artifact-preview-body :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}
</style>
