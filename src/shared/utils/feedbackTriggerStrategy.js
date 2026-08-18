import { loadFeedbackState, saveFeedbackStrategyState } from '@/modules/terminal/services/persistentUserDataService'

/**
 * 评论弹出智能触发策略
 *
 * 规则：
 * 1. 新手保护：历史总交互次数 <= 3 时不弹
 * 2. 常规触发：每 8-12 次有效交互随机弹 1 次
 * 3. 智能触发：
 *    - 长内容回复（> 1000 字符或 > 50 行代码）：80% 概率触发
 *    - 长时间任务（> 30 秒）：60% 概率触发
 *    - 用户使用了新功能（如首次使用某个 skill）：50% 概率触发
 * 4. 冷却期：同一会话内，两次评论请求间隔至少 5 分钟
 * 5. 异常/重试时：不触发评论请求，且不计入计数
 */

const NEWBIE_THRESHOLD = 3
const COOLDOWN_MS = 5 * 60 * 1000
const LONG_TASK_MS = 30 * 1000
const STRATEGY_PERSIST_DEBOUNCE_MS = 300

const ERROR_KEYWORDS = [
  'error', 'exception', 'retry', 'failed',
  'enoent', 'etimedout', 'econnrefused', 'econnreset',
]

const sessionStates = new Map()
let strategyHydratePromise = null
let strategyPersistTimer = null
let strategyState = {
  totalStopCount: 0,
  usedSkills: [],
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function normalizeUsedSkills(skills) {
  if (!Array.isArray(skills)) return []
  return Array.from(
    new Set(
      skills
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter(Boolean),
    ),
  )
}

function applyStrategyState(nextState) {
  strategyState = {
    totalStopCount: Math.max(0, Math.floor(Number(nextState?.totalStopCount) || 0)),
    usedSkills: normalizeUsedSkills(nextState?.usedSkills),
  }
}

function schedulePersistStrategyState() {
  clearTimeout(strategyPersistTimer)
  strategyPersistTimer = setTimeout(() => {
    strategyPersistTimer = null
    void saveFeedbackStrategyState({
      totalStopCount: strategyState.totalStopCount,
      usedSkills: strategyState.usedSkills,
    })
  }, STRATEGY_PERSIST_DEBOUNCE_MS)
}

export async function initializeFeedbackStrategyState() {
  if (strategyHydratePromise) return strategyHydratePromise

  strategyHydratePromise = loadFeedbackState()
    .then((state) => {
      applyStrategyState(state?.strategy)
    })
    .catch(() => {
      applyStrategyState({})
    })
    .then(() => strategyState)

  return strategyHydratePromise
}

function getTotalCount() {
  return strategyState.totalStopCount
}

function incrementTotalCount() {
  strategyState.totalStopCount += 1
  schedulePersistStrategyState()
  return strategyState.totalStopCount
}

function getUsedSkills() {
  return strategyState.usedSkills
}

function setUsedSkills(skills) {
  strategyState.usedSkills = normalizeUsedSkills(skills)
  schedulePersistStrategyState()
}

function clearPersistStrategyTimer() {
  if (strategyPersistTimer) {
    clearTimeout(strategyPersistTimer)
    strategyPersistTimer = null
  }
}

function normalizeSessionKey(value) {
  if (value == null) return ''
  return String(value).trim()
}

function resolveSessionKey({ sessionId, hookData } = {}) {
  const direct = normalizeSessionKey(sessionId)
  if (direct) return direct

  const hookSessionId = normalizeSessionKey(
    hookData?.session_id ??
    hookData?.sessionId ??
    hookData?.termId
  )
  return hookSessionId || 'global'
}

function createSessionState() {
  return {
    stopCount: 0,
    nextTriggerAt: randomBetween(8, 12),
    lastTriggerTime: 0,
    taskStartedAt: 0,
    pendingNewFeatureUsed: false,
  }
}

function getSessionState(sessionKey) {
  if (!sessionStates.has(sessionKey)) {
    sessionStates.set(sessionKey, createSessionState())
  }
  return sessionStates.get(sessionKey)
}

function isInCooldown(state, now) {
  return (now - state.lastTriggerTime) < COOLDOWN_MS
}

function recordTrigger(state, now) {
  state.lastTriggerTime = now
  state.stopCount = 0
  state.nextTriggerAt = randomBetween(8, 12)
}

function isLongContent(replyText) {
  if (!replyText) return false
  const charCount = replyText.length
  const codeBlockMatch = replyText.match(/```[\s\S]*?```/g)
  const codeLineCount = codeBlockMatch
    ? codeBlockMatch.reduce((acc, block) => acc + block.split('\n').length, 0)
    : 0
  return charCount > 1000 || codeLineCount > 50
}

function isLongTask(taskDurationMs) {
  return taskDurationMs > LONG_TASK_MS
}

function isErrorReply(replyText) {
  if (!replyText) return false
  const lower = replyText.toLowerCase()
  return ERROR_KEYWORDS.some((kw) => lower.includes(kw))
}

function looksExceptionalValue(value) {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return false
  const lower = value.trim().toLowerCase()
  return [
    'error', 'failed', 'failure', 'exception', 'retry', 'retried',
    'timed_out', 'timeout', 'cancelled', 'canceled', 'abort', 'aborted',
  ].some((token) => lower.includes(token))
}

function isExceptionalHookData(hookData) {
  if (!hookData || typeof hookData !== 'object') return false

  const directErrorKeys = [
    'error', 'error_message', 'errorMessage', 'exception',
    'failure_reason', 'failureReason', 'stop_reason', 'stopReason',
    'status', 'result', 'outcome',
  ]
  for (const key of directErrorKeys) {
    if (looksExceptionalValue(hookData[key])) return true
  }

  if (hookData.is_error === true || hookData.isError === true) return true
  if (hookData.should_retry === true || hookData.shouldRetry === true) return true
  if (hookData.success === false || hookData.ok === false) return true

  return false
}

function isExceptionalContext({ replyText, hookData }) {
  return isExceptionalHookData(hookData) || isErrorReply(replyText)
}

function extractSkillNamesFromText(text) {
  if (!text || typeof text !== 'string') return []
  const names = new Set()
  const regex = /(?:\/skill|skill:?)\s+([a-zA-Z0-9_-]+)/gi
  let match = regex.exec(text)
  while (match) {
    const skillName = String(match[1] || '').trim().toLowerCase()
    if (skillName) names.add(skillName)
    match = regex.exec(text)
  }
  return Array.from(names)
}

function readPossiblePromptText(hookData) {
  if (!hookData || typeof hookData !== 'object') return ''
  const candidates = [
    hookData.prompt,
    hookData.user_prompt,
    hookData.userPrompt,
    hookData.input,
    hookData.message,
    hookData.text,
    hookData.query,
  ]
  const first = candidates.find(v => typeof v === 'string' && v.trim())
  return first ? first.trim() : ''
}

function markNewFeatureUsage(hookData) {
  const promptText = readPossiblePromptText(hookData)
  const skillNames = extractSkillNamesFromText(promptText)
  if (!skillNames.length) return false

  const usedSkills = getUsedSkills()
  let hasNewSkill = false

  skillNames.forEach((skillName) => {
    if (!usedSkills.includes(skillName)) {
      usedSkills.push(skillName)
      hasNewSkill = true
    }
  })

  if (hasNewSkill) {
    setUsedSkills(usedSkills)
  }

  return hasNewSkill
}

function calculateTaskDurationMs(state, now) {
  if (!state.taskStartedAt) return 0
  return Math.max(0, now - state.taskStartedAt)
}

function calculateTriggerProbability({ replyText, taskDurationMs, newFeatureUsed }) {
  let probability = 0

  if (isLongContent(replyText)) {
    probability = Math.max(probability, 0.8)
  }

  if (isLongTask(taskDurationMs)) {
    probability = Math.max(probability, 0.6)
  }

  if (newFeatureUsed) {
    probability = Math.max(probability, 0.5)
  }

  return probability
}

function shouldTriggerByProbability(probability) {
  if (probability === 0) return false
  return Math.random() < probability
}

export function recordFeedbackHookEvent(payload) {
  if (!payload) return

  const eventName = payload.event
  const hookData = payload.data
  const sessionKey = resolveSessionKey({
    sessionId: payload.latestAssistantTurn?.sessionId,
    hookData,
  })
  const state = getSessionState(sessionKey)
  const now = payload.timestamp || Date.now()

  if (eventName === 'UserPromptSubmit') {
    state.taskStartedAt = now
    if (markNewFeatureUsage(hookData)) {
      state.pendingNewFeatureUsed = true
    }
    return
  }

  if (eventName === 'SessionEnd') {
    sessionStates.delete(sessionKey)
  }
}

/**
 * 判断本次 Stop 事件是否应显示评论条
 * @param {{ replyText: string, sessionId?: string, hookData?: object, timestamp?: number }} ctx
 * @returns {boolean}
 */
export function shouldShowFeedback({ replyText, sessionId, hookData, timestamp }) {
  if (isExceptionalContext({ replyText, hookData })) {
    return false
  }

  const sessionKey = resolveSessionKey({ sessionId, hookData })
  const state = getSessionState(sessionKey)
  const now = timestamp || Date.now()
  const taskDurationMs = calculateTaskDurationMs(state, now)
  const newFeatureUsed = state.pendingNewFeatureUsed

  state.taskStartedAt = 0
  state.pendingNewFeatureUsed = false
  state.stopCount += 1

  const totalCount = incrementTotalCount()
  if (totalCount <= NEWBIE_THRESHOLD) {
    return false
  }

  if (isInCooldown(state, now)) {
    return false
  }

  const probability = calculateTriggerProbability({
    replyText,
    taskDurationMs,
    newFeatureUsed,
  })
  if (shouldTriggerByProbability(probability)) {
    recordTrigger(state, now)
    return true
  }

  if (state.stopCount >= state.nextTriggerAt) {
    recordTrigger(state, now)
    return true
  }

  return false
}

export function resetFeedbackStrategy() {
  clearPersistStrategyTimer()
  sessionStates.clear()
}
