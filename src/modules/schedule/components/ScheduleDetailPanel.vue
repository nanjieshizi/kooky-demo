<template>
  <div v-if="task" class="schedule-detail-panel">
    <header class="panel-header">
      <div class="header-title">
        <span class="task-name">{{ task.name }}</span>
        <span class="task-status-tag" :class="`tag-${task.status}`">
          {{ store.statusLabel(task.status) }}
        </span>
      </div>
      <div class="header-actions">
        <button
          class="header-btn"
          aria-label="编辑"
          :disabled="task.status === 'invalid'"
          :title="task.status === 'invalid' ? '已失效任务不可编辑' : '编辑'"
          @click="onEdit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M16 3l5 5L8 21H3v-5L16 3z" stroke="#86909C" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          v-if="task.status === 'running'"
          class="header-btn"
          aria-label="暂停"
          title="暂停"
          @click="onPause"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="5" width="3" height="14" fill="#86909C" rx="1" />
            <rect x="15" y="5" width="3" height="14" fill="#86909C" rx="1" />
          </svg>
        </button>
        <button
          v-else-if="task.status === 'paused'"
          class="header-btn"
          aria-label="启用"
          title="启用"
          @click="onResume"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M7 5l12 7-12 7V5z" fill="#57BC66" />
          </svg>
        </button>
        <button class="header-btn header-btn--danger" aria-label="删除" title="删除" @click="onDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="#F53F3F" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button class="header-btn" aria-label="关闭" @click="onClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <div class="panel-scroll custom-scrollbar">
      <!-- 任务指令 -->
      <section class="info-section">
        <div class="section-label">任务指令</div>
        <div class="instruction-box" :class="{ 'is-invalid': task.status === 'invalid' }">
          {{ task.instruction }}
        </div>
        <div v-if="task.status === 'invalid' && task.invalidReason" class="invalid-banner">
          ⚠ {{ task.invalidReason }}
        </div>
      </section>

      <!-- 执行者 -->
      <section class="info-section">
        <div class="section-label">执行者</div>
        <div class="executor-card">
          <span class="executor-avatar" :style="{ background: avatarColor(task.executor?.agentName) }">
            {{ initials(task.executor?.agentName) }}
          </span>
          <div class="executor-info">
            <div class="executor-name">
              {{ task.executor?.source?.label || '—' }} · {{ task.executor?.agentName || '—' }}
            </div>
            <button
              v-if="task.executor?.source?.conversationId"
              type="button"
              class="executor-open"
              :disabled="task.status === 'invalid'"
              @click="onOpenSourceConversation"
            >
              打开会话 →
            </button>
          </div>
        </div>
      </section>

      <!-- 计划 -->
      <section class="info-section">
        <div class="section-label">计划</div>
        <div class="plan-box">
          <div class="plan-cycle">{{ cycleLabel }}</div>
          <div v-if="task.nextRunAt" class="plan-next">下次执行：{{ formatNextRun(task.nextRunAt) }}</div>
          <div v-else-if="task.status !== 'running'" class="plan-next plan-next--muted">下次执行：—</div>
        </div>
      </section>

      <!-- 运行历史 -->
      <section class="info-section">
        <div class="section-label">运行历史</div>
        <div v-if="!task.runHistory || task.runHistory.length === 0" class="history-empty">
          暂无运行记录
        </div>
        <div v-else class="history-list">
          <article
            v-for="entry in task.runHistory"
            :key="entry.id"
            class="history-card"
          >
            <header class="history-date">
              <span class="history-dot" />
              <span>{{ formatDate(entry.ts) }}</span>
            </header>
            <div class="history-title">{{ task.name }}</div>
            <div class="history-meta">
              <span class="history-meta-label">执行人</span>
              <span class="history-mini-avatar" :style="{ background: avatarColor(task.executor?.agentName) }">
                {{ initials(task.executor?.agentName) }}
              </span>
            </div>
            <div class="history-meta">
              <span class="history-meta-label">完成时间</span>
              <span class="history-meta-value">{{ formatFullTime(entry.ts) }}</span>
            </div>
            <div class="history-detail">
              <span class="history-detail-label">详情</span>
              <span class="history-detail-text">{{ truncate(entry.replyContent, 120) }}</span>
            </div>
            <button
              type="button"
              class="history-jump"
              :disabled="!entry.conversationId"
              @click="onJump(entry)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#436FF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>去对话中查看</span>
            </button>
          </article>
        </div>
      </section>
    </div>

    <!-- 删除二次确认 -->
    <div v-if="store.confirmDelete.open && store.confirmDelete.taskId === task.id" class="confirm-mask" @click.self="store.cancelDelete">
      <div class="confirm-box">
        <div class="confirm-title">删除「{{ task.name }}」？</div>
        <div class="confirm-desc">删除后该定时任务及其所有运行记录将被永久移除，无法恢复。</div>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="store.cancelDelete">取消</button>
          <button class="btn-confirm" @click="onConfirmDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'ScheduleDetailPanel' })

import { computed } from 'vue'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'

const store = useScheduleStore()
const task = computed(() => store.activeTask)

const cycleLabel = computed(() => {
  const c = task.value?.cycle
  if (!c) return '—'
  if (c.description) return c.description
  if (c.type === 'daily') {
    const wd = (c.weekdays || []).map((d) => '一二三四五六日'[d - 1]).join('、') || '每天'
    return `${wd} ${c.time || ''}`
  }
  if (c.type === 'interval') return `每 ${c.value} ${c.unit}`
  if (c.type === 'once') return `单次 ${c.time || ''}`
  if (c.type === 'cron') return `Cron：${c.expr || ''}`
  return '—'
})

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function formatNextRun(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isSameDay = d.toDateString() === now.toDateString()
  const isTomorrow = (d.getTime() - now.getTime() > 0 && d.getTime() - now.getTime() < 24 * 3600 * 1000 + 12 * 3600 * 1000) && !isSameDay
  const pad = (n) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (isSameDay) return `今天 ${time}`
  if (isTomorrow) return `明天 ${time}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function formatFullTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function truncate(text, n) {
  if (!text) return ''
  const s = String(text)
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function initials(name) {
  if (!name) return '?'
  const ch = String(name).trim()
  if (/[一-龥]/.test(ch)) return ch.slice(-1)
  return ch.slice(0, 1).toUpperCase()
}

const COLORS = ['#E8F2FE', '#FFF1ED', '#F0F9F4', '#FFF7E6', '#F3E8FF', '#FFE8F0']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

function onClose() {
  store.clearActiveTask()
}

function onEdit() {
  if (!task.value) return
  if (task.value.status === 'invalid') return
  store.openEditDialog(task.value.id)
}

function onPause() {
  if (!task.value) return
  store.pauseTask(task.value.id)
}

function onResume() {
  if (!task.value) return
  store.resumeTask(task.value.id)
}

function onDelete() {
  if (!task.value) return
  store.requestDelete(task.value.id)
}

function onConfirmDelete() {
  store.confirmDeleteTask()
}

function onOpenSourceConversation() {
  // R6 实现：跳到执行者所在的会话
  const cid = task.value?.executor?.source?.conversationId
  if (!cid) return
  if (typeof window !== 'undefined' && window.__kookyMock?.openScheduleConversation) {
    window.__kookyMock.openScheduleConversation(cid)
  } else {
    console.log('[schedule] open source conversation:', cid)
  }
}

function onJump(entry) {
  if (!entry?.conversationId) return
  if (typeof window !== 'undefined' && window.__kookyMock?.openScheduleConversation) {
    window.__kookyMock.openScheduleConversation(entry.conversationId, entry.anchorEventId)
  } else {
    console.log('[schedule] jump:', entry)
  }
}
</script>

<style scoped>
.schedule-detail-panel {
  display: flex;
  flex-direction: column;
  width: 420px;
  height: 100%;
  background: #FFFFFF;
  border-left: 1px solid #E5E6EB;
  overflow: hidden;
  position: relative;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #F2F3F5;
  gap: 8px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.task-status-tag.tag-running { background: #E8F2FE; color: #436FF6; }
.task-status-tag.tag-paused  { background: #F2F3F5; color: #86909C; }
.task-status-tag.tag-invalid { background: #FFE8E6; color: #F53F3F; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.header-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.header-btn:hover { background: #F7F8FA; }
.header-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.header-btn:disabled:hover { background: transparent; }

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.info-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
  margin-bottom: 6px;
}

.instruction-box {
  padding: 10px 12px;
  background: #FAFBFC;
  border: 1px solid #F2F3F5;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #4E5969;
  white-space: pre-wrap;
  word-break: break-word;
}
.instruction-box.is-invalid {
  color: #86909C;
}

.invalid-banner {
  margin-top: 8px;
  padding: 6px 10px;
  background: #FFF3F3;
  border-radius: 6px;
  font-size: 12px;
  color: #F53F3F;
}

/* 执行者 */
.executor-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #FAFBFC;
  border-radius: 8px;
}

.executor-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #4E5969;
  font-weight: 500;
  flex-shrink: 0;
}

.executor-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.executor-name {
  font-size: 13px;
  color: #1D2129;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.executor-open {
  align-self: flex-start;
  padding: 0;
  background: transparent;
  border: none;
  color: #436FF6;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.executor-open:hover { color: #2451D8; }
.executor-open:disabled { color: #C9CDD4; cursor: not-allowed; }

/* 计划 */
.plan-box {
  padding: 10px 12px;
  background: #FAFBFC;
  border-radius: 8px;
  font-size: 13px;
}
.plan-cycle {
  color: #1D2129;
  font-weight: 500;
}
.plan-next {
  margin-top: 6px;
  font-size: 12px;
  color: #4E5969;
}
.plan-next--muted { color: #C9CDD4; }

/* 运行历史 */
.history-empty {
  padding: 18px 12px;
  text-align: center;
  font-size: 12px;
  color: #C9CDD4;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  padding: 12px 14px;
  background: #FAFBFC;
  border: 1px solid #F2F3F5;
  border-radius: 10px;
}

.history-date {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4E5969;
  font-weight: 500;
  margin-bottom: 6px;
}

.history-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #57BC66;
}

.history-title {
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
  margin-bottom: 6px;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4E5969;
  margin: 3px 0;
}

.history-meta-label {
  color: #86909C;
  min-width: 56px;
}

.history-mini-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #4E5969;
}

.history-detail {
  margin-top: 6px;
  display: flex;
  gap: 8px;
  font-size: 12px;
  align-items: flex-start;
}

.history-detail-label {
  color: #86909C;
  flex-shrink: 0;
}

.history-detail-text {
  color: #4E5969;
  line-height: 1.6;
}

.history-jump {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #FFFFFF;
  border: 1px solid #D4E5FF;
  color: #436FF6;
  border-radius: 14px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.history-jump:hover { background: #F0F5FF; }
.history-jump:disabled { color: #C9CDD4; border-color: #E5E6EB; cursor: not-allowed; }

/* 二次确认 mask */
.confirm-mask {
  position: absolute;
  inset: 0;
  background: rgba(29, 33, 41, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.confirm-box {
  width: 320px;
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.confirm-title {
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
}

.confirm-desc {
  margin-top: 8px;
  font-size: 13px;
  color: #4E5969;
  line-height: 1.5;
}

.confirm-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
}

.btn-cancel {
  background: #F2F3F5;
  color: #4E5969;
}
.btn-cancel:hover { background: #E5E6EB; }

.btn-confirm {
  background: #F53F3F;
  color: #FFFFFF;
}
.btn-confirm:hover { background: #D43A3A; }
</style>
