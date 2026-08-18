<script setup>
import { inject, ref, nextTick } from 'vue'
import { KODE_STATE_KEY } from '../../composables/useKodeState.js'

// 普通任务 CLI 标签：仿 Kooky 的 Claude CLI 终端样式（onboarding 界面）
// 不是真本地终端，纯演示；保留「拖任务卡进来填充」能力。
const state = inject(KODE_STATE_KEY)
const { tasks, buildCliDragPrompt } = state

const items = ref([
  { id: 'i0', name: '默认' },
  { id: 'i1', name: '新事项' },
  { id: 'i2', name: '新事项 2' },
  { id: 'i3', name: '新事项 3' },
])
const activeItem = ref('i1')

// 终端里追加的命令行（拖拽 / Todolist 复用产生）
const extraLines = ref([])
const bodyEl = ref(null)
function scrollBottom() {
  nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight })
}

// Todolist 复用（KodeConvo 等派发到终端）—— 兼容旧入口
function shortT(text) { return String(text).split('（')[0].split('(')[0].trim() }
function onReuseSend(t) {
  extraLines.value.push({ type: 'prompt', text: `claude> 开始这一步：${t.text}` })
  extraLines.value.push({ type: 'ok', text: `收到，开始处理「${shortT(t.text)}」…` })
  scrollBottom()
}
function onReuseSendAll(todos) {
  extraLines.value.push({ type: 'prompt', text: `claude> 按这份 Todolist（${todos.length} 步）逐条开干` })
  extraLines.value.push({ type: 'ok', text: `好的，已排入 ${todos.length} 步，从第 1 步开始执行…` })
  scrollBottom()
}
defineExpose({ onReuseSend, onReuseSendAll })

// ── 拖拽任务卡 → 填充到终端 ──
const isDragOver = ref(false)
let _dragCounter = 0
function hasTask(e) { return e.dataTransfer?.types?.includes('application/x-kode-task-id') }
function onDragEnter(e) { if (!hasTask(e)) return; _dragCounter += 1; isDragOver.value = true }
function onDragOver(e) { if (!hasTask(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
function onDragLeave() { _dragCounter = Math.max(0, _dragCounter - 1); if (_dragCounter === 0) isDragOver.value = false }
let _thinkTimer = null
function onDrop(e) {
  if (!hasTask(e)) return
  e.preventDefault()
  isDragOver.value = false
  _dragCounter = 0
  const taskId = e.dataTransfer?.getData('application/x-kode-task-id')
  const task = tasks.value.find((t) => t.id === taskId)
  if (!task) return
  const prompt = (buildCliDragPrompt(task) || task.title || '').trim()
  // 整段作为一次输入（回车提交），不再每行一个 claude>
  extraLines.value.push({ type: 'input', text: prompt })
  // mock 正在思考
  const think = { type: 'thinking', text: '正在思考' }
  extraLines.value.push(think)
  scrollBottom()
  clearTimeout(_thinkTimer)
  _thinkTimer = setTimeout(() => {
    const i = extraLines.value.indexOf(think)
    if (i >= 0) extraLines.value.splice(i, 1)
    extraLines.value.push({ type: 'ok', text: `✓ 已理解任务「${task.title}」，正在拆解执行计划…` })
    extraLines.value.push({ type: 'dim', text: '· 读取关键文件 · 规划改动点 · 准备逐步执行' })
    scrollBottom()
  }, 2200)
}
</script>

<template>
  <div class="cli-onboard">
    <!-- 左：事项侧栏 -->
    <aside class="cli-side">
      <div class="side-head">
        <span class="ws-name">kc_workspace</span>
        <span class="ws-caret">⌄</span>
      </div>
      <button class="add-item" type="button">＋ 事项</button>
      <ul class="item-list">
        <li
          v-for="it in items"
          :key="it.id"
          class="item"
          :class="{ active: activeItem === it.id }"
          @click="activeItem = it.id"
        >
          <span class="item-ic">≣</span>{{ it.name }}
        </li>
      </ul>
    </aside>

    <!-- 右：tab + 终端 -->
    <div class="cli-main">
      <div class="tab-bar">
        <div class="t-tab active"><span class="t-ic">zsh</span> ~/kc_workspace <span class="t-x">✕</span></div>
        <button class="t-add">＋</button>
        <span class="spacer"></span>
        <span class="t-win">▢ ▭</span>
      </div>
      <div class="path-row">zsh ~/kc_workspace <span class="path-x">✕</span></div>

      <!-- 终端体（暗色，onboarding）-->
      <div
        class="term-body"
        ref="bodyEl"
        :class="{ dragover: isDragOver }"
        @dragenter="onDragEnter"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <div class="cli-logo">
          <div class="stars">
            <span style="left:6%;top:18%">✦</span><span style="left:22%;top:55%">✦</span>
            <span style="left:14%;top:80%">✦</span><span style="left:34%;top:30%">✦</span>
            <span style="left:30%;top:88%">✦</span><span style="left:44%;top:64%">✦</span>
          </div>
          <div class="logo-box"><span class="crab">🦀</span><span class="logo-tx">Kooky<br/>CLI</span></div>
        </div>
        <div class="ln b">Let's get started.</div>
        <div class="ln b">Choose the text style that looks best with your terminal</div>
        <div class="ln dim">To change this later, run /theme</div>
        <div class="ln"></div>
        <div class="ln green">❯ 1. Dark mode ✓</div>
        <div class="ln">  2. Light mode</div>
        <div class="ln">  3. Dark mode (colorblind-friendly)</div>
        <div class="ln">  4. Light mode (colorblind-friendly)</div>
        <div class="ln">  5. Dark mode (ANSI colors only)</div>
        <div class="ln">  6. Light mode (ANSI colors only)</div>
        <div class="ln"></div>
        <div class="ln dim">  1 function greet() {</div>
        <div class="code-del">  2   console.log("Hello, World!");</div>
        <div class="code-add">  2   console.log("Hello, Claude!");</div>
        <div class="ln dim">  3 }</div>
        <div class="ln"></div>
        <div class="ln dim small">Syntax highlighting available only in native build</div>

        <!-- 拖拽 / 复用追加的内容 -->
        <template v-for="(l, i) in extraLines" :key="i">
          <!-- 整段输入：claude> + 一大段（回车提交）-->
          <div v-if="l.type === 'input'" class="input-block">
            <span class="prompt">claude&gt;</span>
            <span class="input-text">{{ l.text }}</span>
          </div>
          <!-- 正在思考 -->
          <div v-else-if="l.type === 'thinking'" class="think-line">
            <span class="think-star">✻</span> {{ l.text }}<span class="think-dots"><i>.</i><i>.</i><i>.</i></span>
          </div>
          <div v-else class="ln" :class="l.type">{{ l.text }}</div>
        </template>
        <div class="ln cursor-line"><span class="prompt">claude&gt;</span> <span class="cursor"></span></div>
      </div>

      <!-- 底部命令栏 -->
      <div class="cli-foot"><span class="plus">＋</span> 添加常用命令，一键发送到终端</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles.scss' as *;

.cli-onboard { flex: 1; min-height: 0; display: flex; background: #1b2027; overflow: hidden; }

/* 左侧事项栏（浅色）*/
.cli-side {
  width: 188px;
  flex-shrink: 0;
  background: #14181f;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  padding: 12px 10px;
  color: #cbd0d8;
}
.side-head { display: flex; align-items: center; gap: 4px; font-size: $fs-md; font-weight: $fw-semibold; padding: 4px 6px 10px; }
.side-head .ws-caret { color: #7a818c; }
.add-item { text-align: left; border: 0; background: transparent; color: #cbd0d8; font-family: inherit; font-size: $fs-md; padding: 7px 6px; cursor: pointer; border-radius: 7px; &:hover { background: rgba(255, 255, 255, 0.05); } }
.item-list { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 7px; font-size: $fs-md; color: #9aa1ad; cursor: pointer; .item-ic { color: #6b7280; } &:hover { background: rgba(255, 255, 255, 0.04); } &.active { background: rgba(255, 255, 255, 0.08); color: #fff; } }

/* 右侧 */
.cli-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tab-bar { height: 38px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 0 12px; background: #14181f; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.t-tab { display: inline-flex; align-items: center; gap: 6px; font-size: $fs-base; color: #cbd0d8; background: #1b2027; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 4px 10px; .t-ic { color: #7dd3fc; } .t-x { color: #7a818c; margin-left: 2px; } }
.t-add { border: 0; background: transparent; color: #9aa1ad; font-size: 14px; cursor: pointer; }
.tab-bar .spacer { flex: 1; }
.t-win { color: #7a818c; letter-spacing: 4px; font-size: 12px; }
.path-row { flex-shrink: 0; height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 14px; font-family: 'SF Mono', Monaco, monospace; font-size: $fs-base; color: #9aa1ad; .path-x { margin-left: auto; color: #7a818c; } }

.term-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  color: #cbd0d8;
  position: relative;
  &.dragover { box-shadow: inset 0 0 0 2px #8478fa; }
}
/* logo 区：星点 + 橙边框盒 */
.cli-logo { position: relative; height: 96px; margin: 6px 0 14px; }
.stars { position: absolute; inset: 0; width: 320px; }
.stars span { position: absolute; color: #f67c43; opacity: 0.7; font-size: 12px; }
.logo-box {
  position: absolute;
  left: 200px;
  top: 14px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  border: 2px solid #f67c43;
  border-radius: 10px;
  color: #f67c43;
}
.logo-box .crab { font-size: 22px; }
.logo-box .logo-tx { font-weight: 700; font-size: 17px; line-height: 1.25; letter-spacing: 1px; }

.ln { white-space: pre-wrap; }

/* 拖拽整段输入块 */
.input-block { display: flex; gap: 8px; margin: 2px 0; }
.input-block .prompt { color: #cbd0d8; flex-shrink: 0; }
.input-block .input-text { white-space: pre-wrap; color: #e6e9ee; flex: 1; min-width: 0; }

/* 正在思考 */
.think-line { color: #c9a8ff; margin: 6px 0; }
.think-star { display: inline-block; animation: think-spin 1.4s linear infinite; }
.think-dots i { animation: think-blink 1.2s infinite; opacity: 0.2; }
.think-dots i:nth-child(2) { animation-delay: 0.2s; }
.think-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes think-spin { to { transform: rotate(360deg); } }
@keyframes think-blink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
.ln.b { color: #fff; font-weight: 600; }
.ln.dim { color: #7a818c; }
.ln.small { font-size: 12px; margin-top: 8px; }
.ln.green { color: #86efac; }
.ln.ok { color: #5eead4; }
.ln.prompt { color: #cbd0d8; }
.code-del { background: rgba(220, 38, 38, 0.28); color: #fecaca; padding: 1px 0; white-space: pre-wrap; }
.code-add { background: rgba(22, 163, 74, 0.30); color: #bbf7d0; padding: 1px 0; white-space: pre-wrap; }
.cursor-line { margin-top: 6px; }
.prompt { color: #cbd0d8; }
.cursor { display: inline-block; width: 8px; height: 15px; background: #cbd0d8; vertical-align: middle; animation: cli-blink 1.1s step-end infinite; }
@keyframes cli-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }

.cli-foot { flex-shrink: 0; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: #14181f; border-top: 1px solid rgba(255, 255, 255, 0.06); color: #7a818c; font-size: $fs-md; .plus { color: #9aa1ad; } }
</style>
