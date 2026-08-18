import { ref, computed, reactive } from 'vue'
import { makeStubTree, formatRelativeDate } from './traceMock'

/**
 * 创建独立的「预览」会话 store（与左栏 Agent Creator 对话隔离）
 * 接口契约对齐一人团队 EmployeeChatPanel 期望的 store API。
 *
 * 会话 ID = trace run ID。activeSessionId 直接读 factoryStore.activeTraceRunId，
 * 不再维护独立的 active 状态，切换 run 自动切换会话，反之亦然。
 */

// 历史会话 mock 消息（仅用于 demo）
const MOCK_SESSION_MESSAGES = {
  run1: [
    { id: 'pv-run1-1', role: 'user', content: '我最近总是头痛，而且有点发烧', timestamp: Date.now() - 5 * 60_000 },
    { id: 'pv-run1-2', role: 'assistant', content: '可能是上呼吸道感染。建议多休息、多饮水，体温 ≤ 38.5°C 时可物理降温。如果持续 3 天以上需就医。', timestamp: Date.now() - 5 * 60_000 + 1000 },
  ],
  run2: [
    { id: 'pv-run2-1', role: 'user', content: '帮我查一下张三的就诊记录', timestamp: Date.now() - 35 * 60_000 },
    { id: 'pv-run2-2', role: 'assistant', content: '已为您查询到张三的就诊记录：最近一次就诊为 2026-05-20，主诉头痛，诊断为偏头痛，开具布洛芬。', timestamp: Date.now() - 35 * 60_000 + 1000 },
  ],
  run3: [
    { id: 'pv-run3-1', role: 'user', content: '我想预约下周一的门诊', timestamp: Date.now() - 24 * 60 * 60_000 },
    { id: 'pv-run3-2', role: 'assistant', content: '抱歉，预约接口暂时不可用，请稍后重试。', timestamp: Date.now() - 24 * 60 * 60_000 + 1000 },
  ],
  run4: [
    { id: 'pv-run4-1', role: 'user', content: '请问感冒了应该吃什么药？', timestamp: Date.now() - 30 * 60 * 60_000 },
    { id: 'pv-run4-2', role: 'assistant', content: '普通感冒以对症治疗为主：发热可用对乙酰氨基酚、布洛芬；鼻塞可用伪麻黄碱；咳嗽可用右美沙芬。建议多饮水、多休息。', timestamp: Date.now() - 30 * 60 * 60_000 + 1000 },
  ],
}

export function createPreviewSessionStore(factoryStore) {
  // ─── 消息按 runId 存储 ────────────────────────
  const messagesByRun = ref({
    run1: [...MOCK_SESSION_MESSAGES.run1],
    run2: [...MOCK_SESSION_MESSAGES.run2],
    run3: [...MOCK_SESSION_MESSAGES.run3],
    run4: [...MOCK_SESSION_MESSAGES.run4],
  })

  const isResponding = ref(false)

  // activeSessionId 直接读 factoryStore（单一来源）
  const activeSessionId = computed(() => factoryStore.activeTraceRunId)
  const activeMessages = computed(() => messagesByRun.value[activeSessionId.value] || [])

  // 历史会话列表（供下拉框使用，从 factoryStore.traceRuns 派生）
  // 空会话（无任何消息）不计入历史，除非它正好是当前激活的会话
  const previewSessions = computed(() =>
    factoryStore.traceRuns
      .map(run => {
        const msgs = messagesByRun.value[run.id] || []
        const firstUser = msgs.find(m => m.role === 'user')
        return {
          id: run.id,
          date: formatRelativeDate(run.date),
          time: run.time,
          status: run.status,
          preview: firstUser?.content
            ? (firstUser.content.length > 40 ? firstUser.content.slice(0, 40) + '…' : firstUser.content)
            : '空对话',
          active: run.id === activeSessionId.value,
          isEmpty: msgs.length === 0,
        }
      })
      .filter(s => !s.isEmpty || s.active)
  )

  // 切换会话 = 切换 trace run（单一来源）
  function pickSession(id) {
    factoryStore.pickTraceRun(id)
  }

  // 新增会话 = 新建 trace run + 初始化空消息列表
  // 如果当前会话已经是空会话，直接复用，避免堆积空记录
  function createNewSession() {
    const currentId = activeSessionId.value
    const currentMsgs = messagesByRun.value[currentId] || []
    const currentRun = factoryStore.traceRuns.find(r => r.id === currentId)
    const currentIsEmpty = currentMsgs.length === 0 && (!currentRun?.nodes || currentRun.nodes.length === 0)
    if (currentIsEmpty) return currentId

    const id = factoryStore.createTraceRun({ status: 'success', duration: '—' })
    messagesByRun.value[id] = []
    return id
  }

  // 引用消息（暂不实现）
  const employeeQuotingMessage = ref(null)
  const employeeUserSelectedMode = ref('auto')
  const employeeUserSelectedModelName = ref('')
  const employeePendingPrefillText = ref('')

  // ─── 模拟 store 必需的接口 ─────────────────
  const $id = 'factory-preview'

  const currentEmployee = computed(() => ({
    id: 'preview-agent',
    name: factoryStore.currentAgent?.name || '数字人',
    avatar: null,
  }))
  const currentEmployeeId = computed(() => 'preview-agent')

  const currentEmployeeThread = computed(() => ({
    id: activeSessionId.value,
    langgraph_thread_id: activeSessionId.value,
  }))
  const currentEmployeeThreadId = computed(() => activeSessionId.value)
  const currentEmployeeNavKey = computed(() => `preview-${activeSessionId.value}`)

  const currentEmployeeMessages = computed(() =>
    activeMessages.value.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts: [{ type: 'text', text: msg.content }],
      timestamp: msg.timestamp,
      feedback: null,
    }))
  )

  const currentEmployeeTodos = computed(() => [])
  const employeeSelectedModelName = computed(() => '')
  const employeeChatAvailableModels = computed(() => [])
  const currentEmployeeModelSupportsThinking = computed(() => false)
  const employeeChatHost = computed(() => 'factory-preview')
  const employeeSkillBindingAgentId = computed(() => null)
  const currentEmployeeHasMore = computed(() => false)
  const currentEmployeeLoadingOlderPage = computed(() => false)
  const currentEmployeePersistedMessageCount = computed(() => activeMessages.value.length)
  const currentEmployeeScrollAnchor = computed(() => null)
  const currentEmployeeLedgerBackfillPending = computed(() => false)

  function getEmployeeThreadState() {
    return {
      sendingMessage: isResponding.value,
      uploadingFiles: false,
      loadingMessages: false,
      isStreaming: isResponding.value,
    }
  }

  // ─── Actions ──────────────────────────────

  async function sendEmployeeMessage(employeeId, threadId, text) {
    if (!text || !text.trim()) return
    const runId = activeSessionId.value
    if (!messagesByRun.value[runId]) messagesByRun.value[runId] = []
    const msgs = messagesByRun.value[runId]

    msgs.push({
      id: `pv-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    })

    isResponding.value = true
    const agentName = factoryStore.currentAgent?.name || '数字人'
    const userText = text.trim()

    setTimeout(() => {
      msgs.push({
        id: `pv-${Date.now()}`,
        role: 'assistant',
        content: `这是 ${agentName} 的模拟回复：我已收到"${userText}"。`,
        timestamp: Date.now(),
      })
      isResponding.value = false

      // 如果当前 run 的 trace 为空（新会话），模拟生成一棵调用树
      const run = factoryStore.traceRuns.find(r => r.id === runId)
      if (run && (!run.nodes || run.nodes.length === 0)) {
        const duration = `${(Math.random() * 8 + 2).toFixed(1)}s`
        factoryStore.attachTraceToRun(runId, makeStubTree(runId, userText, duration), { duration })
      }
    }, 1200)
  }

  function stopEmployeeStreaming() {
    isResponding.value = false
  }

  function clearEmployeeMessages() {
    const runId = activeSessionId.value
    if (messagesByRun.value[runId]) messagesByRun.value[runId] = []
    isResponding.value = false
  }

  function setEmployeeQuotingMessage(message) { employeeQuotingMessage.value = message }
  function clearEmployeeQuotingMessage() { employeeQuotingMessage.value = null }
  function submitEmployeeFeedback() {}
  async function regenerateEmployeeLastMessage() {}
  function setEmployeePendingPrefillText(text) { employeePendingPrefillText.value = text }
  function clearEmployeePendingPrefillText() { employeePendingPrefillText.value = '' }
  function tryReconnectEmployeeStream() {}
  function setEmployeeSelectedMode(mode) { employeeUserSelectedMode.value = mode }
  function setEmployeeSelectedModel(name) { employeeUserSelectedModelName.value = name }
  function updateEmployeeChatModelSelection() {}
  async function loadEmployeeOlderPage() {}

  return reactive({
    $id,
    isResponding,

    // 会话管理
    previewSessions,
    activeSessionId,
    pickSession,
    createNewSession,

    currentEmployee,
    currentEmployeeId,
    currentEmployeeThread,
    currentEmployeeThreadId,
    currentEmployeeNavKey,
    currentEmployeeMessages,
    currentEmployeeTodos,
    employeeQuotingMessage,
    employeeUserSelectedMode,
    employeeUserSelectedModelName,
    employeeSelectedModelName,
    employeeChatAvailableModels,
    currentEmployeeModelSupportsThinking,
    employeeChatHost,
    employeeSkillBindingAgentId,
    currentEmployeeHasMore,
    currentEmployeeLoadingOlderPage,
    currentEmployeePersistedMessageCount,
    currentEmployeeScrollAnchor,
    currentEmployeeLedgerBackfillPending,
    employeePendingPrefillText,

    getEmployeeThreadState,
    sendEmployeeMessage,
    stopEmployeeStreaming,
    clearEmployeeMessages,
    setEmployeeQuotingMessage,
    clearEmployeeQuotingMessage,
    submitEmployeeFeedback,
    regenerateEmployeeLastMessage,
    setEmployeePendingPrefillText,
    clearEmployeePendingPrefillText,
    tryReconnectEmployeeStream,
    setEmployeeSelectedMode,
    setEmployeeSelectedModel,
    updateEmployeeChatModelSelection,
    loadEmployeeOlderPage,
  })
}
