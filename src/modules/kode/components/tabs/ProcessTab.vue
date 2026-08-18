<script setup>
import { inject, ref, computed, nextTick, watch } from 'vue'
import { KODE_STATE_KEY } from '../../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  selectedTask,
  selectedWorkspace,
  currentBatch,
  currentBatchTasks,
  dialog,
  decideAskUser,
  pauseExecution,
  resumeExecution,
  selectTask,
} = state

const streamEl = ref(null)

async function scrollEnd() {
  await nextTick()
  if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight
}

watch(dialog, () => scrollEnd(), { deep: true })

function jumpTo(taskId) {
  selectTask(taskId)
}

// 节点 status icon
function nodeIcon(t, idx) {
  if (t.status === 'done') return '✓'
  if (t.status === 'running') return '▶'
  if (t.status === 'waiting') return '⏸'
  if (t.status === 'failed') return '✕'
  return String(idx + 1) // queue 显示位置
}

// todolist 进度计数（控制条用）
const totalCount = computed(() => selectedTask.value?.todos?.length || 0)
const doneCount = computed(() => (selectedTask.value?.todos || []).filter((t) => t.status === 'done').length)

// 中止 / 继续：todolist 停在当前步骤，回编辑 tab 改完再继续
function onPause() {
  pauseExecution()
}
function onResume() {
  resumeExecution()
}

// 处理 ask-user 卡片决策
function onDecide(askId, optionId) {
  decideAskUser(askId, optionId)
}

// 工具图标 / 颜色映射
function toolIcon(tool) {
  return {
    Read: '📖', Glob: '🔍', Grep: '🔎',
    Edit: '✏️', Write: '📝', Bash: '⚙️',
  }[tool] || '🔧'
}
</script>

<template>
  <div class="process-tab" v-if="selectedTask">
    <!-- 顶部 mini stepper chip（只批次时显示）-->
    <header v-if="currentBatch && currentBatchTasks.length > 1" class="mini-stepper">
      <span class="ws-tag">
        <span class="ws-dot" :style="{ background: selectedWorkspace?.color }"></span>
        {{ selectedWorkspace?.name }}
      </span>

      <div class="stepper">
        <template v-for="(t, i) in currentBatchTasks" :key="t.id">
          <button
            class="node"
            :class="[t.status, { current: t.id === selectedTask.id }]"
            type="button"
            :title="t.title"
            @click="jumpTo(t.id)"
          >
            <span class="ico">{{ nodeIcon(t, i) }}</span>
          </button>
          <span v-if="i < currentBatchTasks.length - 1" class="line" :class="t.status"></span>
        </template>
      </div>

      <span class="progress-text">
        {{ currentBatchTasks.filter((t) => t.status === 'done').length }}/{{ currentBatchTasks.length }}
      </span>
      <span class="current-title">· {{ selectedTask.title }}</span>
      <button type="button" class="expand" title="展开看完整批次">▾</button>
    </header>

    <!-- 任务标题（mini）-->
    <header class="task-head">
      <div class="left">
        <span class="emoji">🎯</span>
        <span class="title">{{ selectedTask.title }}</span>
        <span class="sub">· 实时输出</span>
      </div>
      <div class="right">
        <span v-if="selectedTask.status === 'waiting'" class="stage waiting">
          ⏸ 等待你决策
        </span>
        <span v-else-if="selectedTask.status === 'running'" class="stage running">
          ▶ Kode 运行中
        </span>
        <span v-else-if="selectedTask.status === 'paused'" class="stage waiting">
          ⏸ 已中止
        </span>
        <span v-else-if="selectedTask.status === 'done'" class="stage done">✓ 已完成</span>
        <span v-else-if="selectedTask.status === 'failed'" class="stage err">已停止</span>
        <span v-else class="stage idle">就绪</span>
      </div>
    </header>

    <!-- 对话流：CC 长 turn 的实时输出 -->
    <div class="dialog-stream" ref="streamEl">
      <template v-for="m in dialog" :key="m.id">

        <!-- 📜 kickoff：任务说明书（任务助手投给 CC 的初始 prompt）-->
        <div v-if="m.type === 'kickoff'" class="kickoff-card">
          <div class="kickoff-head">
            <span class="ico">📜</span>
            <span class="label">任务助手投递给 CC 的任务说明书</span>
            <span class="ts">{{ m.ts }}</span>
          </div>
          <pre class="kickoff-body">{{ m.text }}</pre>
        </div>

        <!-- 🔧 tool：工具调用日志（一行一条，等宽字体）-->
        <div v-else-if="m.type === 'tool'" class="tool-line">
          <span class="tool-ico">{{ toolIcon(m.tool) }}</span>
          <span class="tool-name">{{ m.tool }}</span>
          <span class="tool-target">{{ m.target }}<span v-if="m.scope" class="tool-scope">  in {{ m.scope }}</span></span>
          <span class="tool-status">✓</span>
          <span v-if="m.result" class="tool-result">{{ m.result }}</span>
        </div>

        <!-- 💭 thinking：CC 思考片段 -->
        <div v-else-if="m.type === 'thinking'" class="thinking-block">
          <span class="thinking-ico">💭</span>
          <span class="thinking-text">{{ m.text }}</span>
        </div>

        <!-- ✅ todo-tick：一条 todo 完成 -->
        <div v-else-if="m.type === 'todo-tick'" class="todo-tick-line">
          <span class="tick-ico">✅</span>
          <span class="tick-label">Updated todo list</span>
          <span class="tick-text">{{ m.summary }}</span>
        </div>

        <!-- 🟡 ask-user：CC 卡住等用户决策 -->
        <div v-else-if="m.type === 'ask-user'" class="ask-card">
          <div class="ask-head">
            <span class="ask-ico">🟡</span>
            <span class="ask-label">CC 在「{{ m.context }}」时需要你确认</span>
            <span class="ts">{{ m.ts }}</span>
          </div>
          <div class="ask-question">{{ m.question }}</div>
          <div class="ask-options">
            <button
              v-for="opt in m.options"
              :key="opt.id"
              type="button"
              class="ask-option"
              :class="{ selected: m.decision === opt.id, locked: m.decision != null }"
              :disabled="m.decision != null"
              @click="onDecide(m.id, opt.id)"
            >
              <div class="opt-label">
                <span class="opt-radio">{{ m.decision === opt.id ? '●' : '○' }}</span>
                {{ opt.label }}
              </div>
              <div class="opt-desc">{{ opt.desc }}</div>
            </button>
          </div>
          <div v-if="m.decision" class="ask-result">
            ✅ 你选了「{{ m.options.find((o) => o.id === m.decision)?.label }}」
          </div>
        </div>

        <!-- ✋ user-interrupt：用户打断 -->
        <div v-else-if="m.type === 'user-interrupt'" class="interrupt-divider">
          <span class="divider-line"></span>
          <div class="divider-content">
            <span class="divider-tag">✋ 你打断了 CC</span>
            <span class="divider-text">{{ m.text }}</span>
          </div>
          <span class="divider-line"></span>
        </div>

        <!-- 💬 cc-text：CC 自然语言段落 -->
        <div v-else-if="m.type === 'cc-text'" class="cc-text-block">
          <span class="cc-ico kode-mark">K</span>
          <span class="cc-text">{{ m.text }}</span>
        </div>

        <!-- 兜底：旧格式 dialog（其他 task 切过去用）-->
        <article v-else class="msg" :class="m.from">
          <span class="av">{{ m.from === 'cc' ? 'K' : 'P' }}</span>
          <div class="content">
            <header>
              <span class="who">{{ m.from === 'cc' ? 'Kode' : 'Pata' }}</span>
              <span class="ts">{{ m.ts }}</span>
            </header>
            <div class="body">
              <template v-for="(seg, i) in (m.body || [])" :key="i">
                <br v-if="seg.sep" />
                <span v-if="seg.sep" class="sep">────────────────────</span>
                <br v-if="seg.sep" />
                <span v-else-if="seg.tool" class="tool">{{ seg.tool }}</span>
                <span v-if="seg.ok" class="ok">{{ seg.ok }}</span>
                <span v-if="seg.warn" class="warn">{{ seg.warn }}</span>
                <span v-if="seg.err" class="err">{{ seg.err }}</span>
                <span v-if="seg.text">{{ seg.text }}</span>
                <span v-if="seg.cursor" class="cursor"></span>
              </template>
            </div>
          </div>
        </article>

      </template>
    </div>

    <!-- 控制条：中止 / 继续（不再有对话输入，要改 todolist 请回「编辑」tab）-->
    <div class="process-control-bar">
      <div class="control-hint">
        <span v-if="selectedTask.status === 'running'">
          ▶ Kode 正在执行 · 第 <b>{{ doneCount }}/{{ totalCount }}</b> 步
        </span>
        <span v-else-if="selectedTask.status === 'waiting'">
          ⏸ 等待你做出决策（看上方卡片）
        </span>
        <span v-else-if="selectedTask.status === 'paused'">
          ⏸ 已中止 · 回「编辑」可改剩余 todolist，回来点继续
        </span>
        <span v-else-if="selectedTask.status === 'done'">✓ 任务已完成</span>
        <span v-else>就绪 · 在编辑 tab 准备好后再来执行</span>
      </div>
      <div class="control-actions">
        <button
          v-if="selectedTask.status === 'running'"
          type="button"
          class="btn-stop"
          @click="onPause"
        >⏸ 中止</button>
        <button
          v-if="selectedTask.status === 'paused'"
          type="button"
          class="btn-resume"
          @click="onResume"
        >▶ 继续</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles.scss' as *;

.process-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

// ─── mini stepper chip ───
.mini-stepper {
  flex-shrink: 0;
  padding: 8px 18px;
  background: $bg-secondary;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: $fs-sm;

  .ws-tag {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    background: $bg-primary;
    border: 1px solid $border;
    border-radius: 10px;
    font-size: $fs-xs;
    color: $text-secondary;
    font-weight: $fw-medium;

    .ws-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 0;

    .node {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid $border-strong;
      background: $bg-primary;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: $fw-bold;
      color: $text-muted;
      cursor: pointer;
      transition: all $anim-fast;
      padding: 0;
      font-family: inherit;
      flex-shrink: 0;

      &:hover { transform: scale(1.15); }

      &.done {
        background: $success;
        border-color: $success;
        color: #fff;
      }
      &.running {
        background: $aurora-purple;
        border-color: $aurora-purple;
        color: #fff;
        animation: kode-pulse 1.5s infinite;
        box-shadow: 0 0 0 3px rgba(132, 120, 250, 0.18);
      }
      &.queue {
        background: $bg-primary;
        border-color: $warning;
        color: $warning;
      }
      &.failed {
        background: $danger;
        border-color: $danger;
        color: #fff;
      }

      &.current {
        outline: 2px solid rgba(132, 120, 250, 0.4);
        outline-offset: 2px;
      }
    }

    .line {
      width: 14px;
      height: 2px;
      background: $border-strong;
      flex-shrink: 0;

      &.done { background: $success; }
    }
  }

  .progress-text {
    font-size: $fs-xs;
    font-weight: $fw-semibold;
    color: $text-secondary;
  }

  .current-title {
    font-size: $fs-xs;
    color: $text-muted;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .expand {
    border: 0;
    background: transparent;
    color: $aurora-purple;
    font-size: $fs-base;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: inherit;

    &:hover { background: rgba(132, 120, 250, 0.1); }
  }
}

// ─── 任务标题 ───
.task-head {
  flex-shrink: 0;
  padding: 10px 24px;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-primary;

  .left {
    display: flex;
    align-items: center;
    gap: 6px;

    .emoji { font-size: $fs-md; }
    .title { font-size: $fs-md; font-weight: $fw-semibold; color: $text-display; }
    .sub { font-size: $fs-base; color: $text-muted; font-weight: $fw-regular; }
  }

  .stage {
    font-size: $fs-base;
    padding: 3px 10px;
    border-radius: 10px;

    &.running {
      background: rgba(132, 120, 250, 0.12);
      color: $aurora-purple;
      animation: kode-pulse 1.6s ease-in-out infinite;
    }
    &.done { background: rgba(34, 197, 94, 0.12); color: $success; }
    &.err { background: rgba(239, 68, 68, 0.12); color: $danger; }
    &.idle { background: $bg-tertiary; color: $text-muted; }
    &.waiting {
      background: rgba(234, 179, 8, 0.14);
      color: #b45309;
      animation: kode-pulse 1.2s ease-in-out infinite;
    }
  }
}

// ─── 对话流 ───
.dialog-stream {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
}

.msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;

  .av {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: $fs-sm;
    font-weight: $fw-semibold;
    color: #fff;
  }

  &.cc .av { background: linear-gradient(135deg, #8478FA, #77C9FB); }
  &.user .av { background: linear-gradient(135deg, #FFB37A, #F67C43); }

  .content {
    flex: 1;
    min-width: 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;

    .who {
      font-size: $fs-sm;
      font-weight: $fw-medium;
      color: $text-secondary;
    }

    .ts {
      font-size: $fs-xs;
      color: $text-faint;
    }
  }

  .body {
    font-size: $fs-md;
    line-height: 1.7;
    padding: 9px 13px;
    border-radius: $radius-md;
    word-break: break-word;
  }

  &.cc .body {
    background: rgba(132, 120, 250, 0.05);
    border: 1px solid rgba(132, 120, 250, 0.18);
    font-family: 'SF Mono', Monaco, monospace;
    font-size: $fs-base;
    color: $text-display;
  }

  &.user .body {
    background: rgba(246, 124, 67, 0.06);
    border: 1px solid rgba(246, 124, 67, 0.22);
    color: $text-display;
  }

  .tool {
    display: inline-block;
    padding: 0 6px;
    background: $bg-primary;
    border: 1px solid rgba(132, 120, 250, 0.3);
    border-radius: 3px;
    font-size: $fs-sm;
    color: $aurora-purple;
    margin: 0 2px;
  }

  .ok { color: $success; font-weight: $fw-semibold; }
  .warn { color: $warning; font-weight: $fw-semibold; }
  .err { color: $danger; font-weight: $fw-semibold; }
  .sep { color: $text-faint; opacity: 0.6; }

  .cursor::after {
    content: '▌';
    color: $aurora-purple;
    animation: kode-blink 1s infinite;
  }
}

// ─── 输入框 ───
// 处理 tab 的底部控制条：中止 / 继续（不再有对话输入框）
.process-control-bar {
  flex-shrink: 0;
  padding: 10px 24px 14px;
  border-top: 1px solid $border;
  background: $bg-primary;
  display: flex;
  align-items: center;
  gap: 12px;

  .control-hint {
    flex: 1;
    min-width: 0;
    font-size: $fs-base;
    color: $text-secondary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    b {
      color: $aurora-purple;
      font-weight: $fw-semibold;
    }
  }

  .control-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-stop,
  .btn-resume {
    padding: 7px 16px;
    border-radius: 16px;
    font-size: $fs-base;
    font-weight: $fw-semibold;
    cursor: pointer;
    font-family: inherit;
    transition: all $anim-fast;
    border: 0;
  }

  .btn-stop {
    background: rgba(239, 68, 68, 0.10);
    color: $danger;
    border: 1px solid rgba(239, 68, 68, 0.25);

    &:hover { background: rgba(239, 68, 68, 0.18); }
  }

  .btn-resume {
    background: $gradient-aurora;
    color: #fff;
    box-shadow: 0 2px 10px rgba(132, 120, 250, 0.25);

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(132, 120, 250, 0.35);
    }
  }
}

@keyframes kode-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.95); }
}

@keyframes kode-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

// ──────────────────────────────────────────────────────────
// 中度模拟 CC TodoWrite 执行流：新事件类型的样式
// ──────────────────────────────────────────────────────────

// 📜 kickoff：任务说明书卡片（紫色边框 + 等宽字体）
.kickoff-card {
  background: rgba(132, 120, 250, 0.04);
  border: 1px solid rgba(132, 120, 250, 0.22);
  border-left: 3px solid $aurora-purple;
  border-radius: $radius-md;
  padding: 10px 14px;
  margin-bottom: 4px;

  .kickoff-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: $fs-xs;

    .ico { font-size: $fs-md; }
    .label { color: $aurora-purple; font-weight: $fw-semibold; flex: 1; }
    .ts { color: $text-faint; }
  }

  .kickoff-body {
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: $text-secondary;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    background: transparent;
  }
}

// 🔧 tool：工具调用一行（等宽字体 + ✓）
.tool-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  color: $text-display;
  animation: kode-msg-appear 0.3s ease-out;

  .tool-ico { font-size: 13px; }
  .tool-name {
    color: $aurora-purple;
    font-weight: $fw-semibold;
    min-width: 56px;
  }
  .tool-target {
    color: $text-secondary;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tool-scope { color: $text-muted; }
  .tool-status { color: $success; font-weight: $fw-bold; }
  .tool-result {
    color: $text-muted;
    font-size: 11.5px;
    background: $bg-secondary;
    padding: 1px 6px;
    border-radius: 6px;
  }
}

// 💭 thinking：灰色斜体
.thinking-block {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  border-left: 2px solid $border-strong;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 0 6px 6px 0;
  font-size: $fs-base;
  font-style: italic;
  color: $text-muted;
  line-height: 1.6;
  animation: kode-msg-appear 0.3s ease-out;

  .thinking-ico { flex-shrink: 0; font-style: normal; }
}

// ✅ todo-tick：紫色高亮 Updated todo list
.todo-tick-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(34, 197, 94, 0.08);
  border-radius: 8px;
  font-size: $fs-base;
  animation: kode-msg-appear 0.3s ease-out;

  .tick-ico { font-size: $fs-md; }
  .tick-label {
    color: $success;
    font-weight: $fw-semibold;
    font-family: 'SF Mono', monospace;
    font-size: 12px;
  }
  .tick-text { color: $text-display; flex: 1; }
}

// 🟡 ask-user：黄色决策卡
.ask-card {
  background: linear-gradient(180deg, rgba(234, 179, 8, 0.08), rgba(234, 179, 8, 0.04));
  border: 1.5px solid rgba(234, 179, 8, 0.35);
  border-radius: $radius-md;
  padding: 12px 16px;
  animation: kode-msg-appear 0.3s ease-out;
  box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.06);

  .ask-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .ask-ico { font-size: $fs-md; }
    .ask-label {
      color: #b45309;
      font-weight: $fw-semibold;
      font-size: $fs-base;
      flex: 1;
    }
    .ts { font-size: $fs-xs; color: $text-faint; }
  }

  .ask-question {
    font-size: $fs-md;
    color: $text-display;
    margin-bottom: 10px;
    font-weight: $fw-medium;
  }

  .ask-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ask-option {
    text-align: left;
    background: #fff;
    border: 1px solid rgba(234, 179, 8, 0.25);
    border-radius: 10px;
    padding: 8px 12px;
    cursor: pointer;
    font-family: inherit;
    transition: all $anim-fast;

    &:hover:not(.locked) {
      border-color: #b45309;
      box-shadow: 0 2px 8px rgba(234, 179, 8, 0.15);
      transform: translateY(-1px);
    }

    &.selected {
      border-color: $success;
      background: rgba(34, 197, 94, 0.06);
    }

    &.locked {
      cursor: default;
      opacity: 0.7;
    }
    &.locked.selected { opacity: 1; }

    .opt-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: $fs-base;
      font-weight: $fw-semibold;
      color: $text-display;
      .opt-radio { color: $aurora-purple; }
    }
    .opt-desc {
      font-size: $fs-xs;
      color: $text-muted;
      margin-top: 2px;
      padding-left: 18px;
    }
  }

  .ask-result {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed rgba(234, 179, 8, 0.3);
    font-size: $fs-base;
    color: $success;
    font-weight: $fw-medium;
  }
}

// ✋ user-interrupt：分隔条
.interrupt-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  animation: kode-msg-appear 0.3s ease-out;

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, $aurora-purple, transparent);
    opacity: 0.4;
  }

  .divider-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: $fs-xs;

    .divider-tag {
      color: $aurora-purple;
      font-weight: $fw-semibold;
    }
    .divider-text {
      color: $text-secondary;
      font-style: italic;
      max-width: 320px;
      text-align: center;
    }
  }
}

// 💬 cc-text：CC 自然语言段落
.cc-text-block {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: $fs-md;
  line-height: 1.7;
  color: $text-display;
  animation: kode-msg-appear 0.3s ease-out;

  .cc-ico { flex-shrink: 0; font-size: $fs-md; }

  // Kode 品牌头像：紫色圆形 + 白 K 字
  .cc-ico.kode-mark {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8478FA, #77C9FB);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    font-family: 'PingFang SC', sans-serif;
  }
  .cc-text { flex: 1; word-break: break-word; }
}

// 输入框「打断」模式视觉
.dialog-input.is-interrupting {
  background: rgba(132, 120, 250, 0.04);
  border-top-color: rgba(132, 120, 250, 0.3);
}
.btn-send.btn-interrupt {
  background: linear-gradient(135deg, $aurora-purple, #6366f1);
  &:hover { box-shadow: 0 2px 12px rgba(132, 120, 250, 0.4); }
}

@keyframes kode-msg-appear {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
