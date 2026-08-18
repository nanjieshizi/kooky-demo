<script setup>
import { inject, ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'
import TodoReuseBar from './TodoReuseBar.vue'

const state = inject(KODE_STATE_KEY)
const {
  kodeMessages,
  kodeInput,
  sendKodeMessage,
  kodeReuseSend,
  kodeReuseSendAll,
  openProductInPreview,
} = state

const streamEl = ref(null)
function scrollEnd() {
  nextTick(() => { if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight })
}
watch(() => kodeMessages.value.length, scrollEnd)

function onSend() { sendKodeMessage(); scrollEnd() }
function onReuseSend(t) { kodeReuseSend(t); scrollEnd() }
function onReuseSendAll(todos) { kodeReuseSendAll(todos); scrollEnd() }
function onAttachmentClick(att) {
  // 聊天里的文件卡 → 尝试在预览中打开（仅预览页已开时跳）
  if (att) openProductInPreview(att)
}

// ═══════ 选区上下文（编辑器选中 → 自动带入，可一键关掉）═══════
// 真集成走 ide MCP server：连上后每条 prompt 自动带当前选区 + 活动文件
const selection = ref({ file: 'MessageList.vue', from: 12, to: 30, on: true })

// ═══════ 权限模式（对应 Claude Code 的 Manual / Plan / acceptEdits）═══════
const PERMISSION_MODES = [
  { key: 'manual', icon: '🖐', label: '手动审批', hint: '改文件和跑命令前都问你' },
  { key: 'plan', icon: '📋', label: '计划模式', hint: '先出计划，你批了才动手' },
  { key: 'auto', icon: '⚡', label: '自动接受', hint: '直接改，不问' },
]
const permMode = ref('manual')
const permOpen = ref(false)
const currentPerm = computed(() => PERMISSION_MODES.find((m) => m.key === permMode.value))

// ═══════ 动作菜单（/ 按钮）═══════
// ⚠️ 有意砍掉的四项：
//  按「Kooky 里不能有第二个产品」——
//    · 「Account & usage」→ 那是 Anthropic 的账户和用量，Kooky 有自己的账户体系，用量走 Kooky 账户页
//    · 「消息被 flag 时自动切模型」→ 纯技术细节，用户看不懂，做成默认行为不暴露
//  按「Kooky 是多模型工作台，不暴露单一模型的专有参数」——
//    · 「推理强度 Effort」/「深度思考 Thinking」→ 这俩是 Claude 模型的专有概念。
//      切到 DeepSeek 就没意义了，留着会出现「换个模型少两个开关」的怪状态。
//      模型组只留「切换模型」——那是 Kooky 自己的概念，跟谁家的模型无关。
const actionsOpen = ref(false)
const actionFilter = ref('')
const CONTEXT_ACTIONS = [
  { key: 'attach', label: '附加文件…', hint: '从磁盘挑，可以是项目外的' },
  { key: 'mention', label: '提及项目里的文件…', hint: '@ 提及' },
  { key: 'clear', label: '清空对话' },
  { key: 'rewind', label: '回溯…', hint: '把会话和文件改动回退到之前某一步' },
]
// 模型列表来自 Kooky（不是 Claude 的模型选择器）——多模型是 Kooky 的产品能力
const MODELS = ['Sonnet 4.6', 'Opus 4.8', 'DeepSeek V4 Pro']
const model = ref(MODELS[0])

const filteredContextActions = computed(() => {
  const q = actionFilter.value.trim().toLowerCase()
  if (!q) return CONTEXT_ACTIONS
  return CONTEXT_ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
})
const showModelGroup = computed(() => {
  const q = actionFilter.value.trim().toLowerCase()
  return !q || '切换模型 模型'.includes(q)
})

function onAction(key) {
  if (key === 'clear') kodeMessages.value = []
  actionsOpen.value = false
  actionFilter.value = ''
}
function closeMenus() { actionsOpen.value = false; permOpen.value = false }
if (typeof window !== 'undefined') {
  window.addEventListener('click', closeMenus)
  onBeforeUnmount(() => window.removeEventListener('click', closeMenus))
}
</script>

<template>
  <div class="kode-convo">
    <div class="kc-stream" ref="streamEl">
      <article v-for="(m, i) in kodeMessages" :key="i" class="kc-msg" :class="m.role">
        <!-- 助手 Kode：左对齐，方形头像 + 名字 + 纯文本（与任务助手同款）-->
        <template v-if="m.role === 'assistant'">
          <div class="kc-aside">
            <span class="kc-avatar">K</span>
          </div>
          <div class="kc-main">
            <div class="kc-name">Kode</div>
            <div class="kc-text">{{ m.text }}</div>
            <button v-if="m.attachment" type="button" class="kc-att" @click="onAttachmentClick(m.attachment)">
              <span class="kc-att-ico">{{ m.attachment.icon || '📄' }}</span>
              <span class="kc-att-name">{{ m.attachment.name }}</span>
              <span class="kc-att-go">在预览中打开 →</span>
            </button>
          </div>
        </template>
        <!-- 用户：右对齐灰泡（与任务助手同款）-->
        <template v-else>
          <div class="kc-bubble">{{ m.text }}</div>
        </template>
      </article>
    </div>

    <!-- Todolist 复用 chip 行 -->
    <div class="kc-reuse">
      <TodoReuseBar @send="onReuseSend" @send-all="onReuseSendAll" />
    </div>

    <!-- 输入区：选区芯片 + 输入框 + 工具条(＋ / 动作菜单 / 权限模式 / 发送) -->
    <div class="kc-composer" @click.stop>
      <!-- 选区上下文：编辑器选中什么，Kode 自动看到；点 ✕ 可以不让它看 -->
      <div v-if="selection.on" class="kc-sel">
        <span class="ks-ico">⧉</span>
        <span class="ks-text">已选中 {{ selection.file }}:{{ selection.from }}-{{ selection.to }}</span>
        <button class="ks-x" type="button" title="不让 Kode 看这段" @click="selection.on = false">✕</button>
      </div>

      <div class="kc-box">
        <input
          v-model="kodeInput"
          type="text"
          class="kc-field"
          placeholder="提问 Kode，或派 Todolist 给它…"
          @keydown.enter.prevent="onSend"
        />

        <div class="kc-tools">
          <button class="kt-btn" type="button" title="附加文件">＋</button>

          <!-- 动作菜单 -->
          <div class="kt-wrap">
            <button
              class="kt-btn kt-slash"
              :class="{ on: actionsOpen }"
              type="button"
              title="动作菜单"
              @click.stop="actionsOpen = !actionsOpen; permOpen = false"
            >/</button>
            <div v-if="actionsOpen" class="kt-menu" @click.stop>
              <input v-model="actionFilter" class="km-filter" placeholder="筛选操作…" />
              <div class="km-scroll">
                <template v-if="filteredContextActions.length">
                  <div class="km-group">上下文</div>
                  <button
                    v-for="a in filteredContextActions"
                    :key="a.key"
                    type="button"
                    class="km-item"
                    @click="onAction(a.key)"
                  >
                    <span class="km-label">{{ a.label }}</span>
                    <span v-if="a.hint" class="km-hint">{{ a.hint }}</span>
                  </button>
                </template>

                <template v-if="showModelGroup">
                  <div class="km-group">模型</div>
                  <div class="km-row">
                    <span class="km-label">切换模型</span>
                    <select v-model="model" class="km-select" @click.stop>
                      <option v-for="m in MODELS" :key="m" :value="m">{{ m }}</option>
                    </select>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <span class="kt-spacer"></span>

          <!-- 权限模式 -->
          <div class="kt-wrap">
            <button
              class="kt-perm"
              type="button"
              :title="currentPerm.hint"
              @click.stop="permOpen = !permOpen; actionsOpen = false"
            >
              <span class="kp-ico">{{ currentPerm.icon }}</span>{{ currentPerm.label }}
            </button>
            <div v-if="permOpen" class="kt-menu kt-menu-right" @click.stop>
              <button
                v-for="m in PERMISSION_MODES"
                :key="m.key"
                type="button"
                class="km-item"
                :class="{ active: permMode === m.key }"
                @click="permMode = m.key; permOpen = false"
              >
                <span class="km-label">{{ m.icon }} {{ m.label }}</span>
                <span class="km-hint">{{ m.hint }}</span>
              </button>
            </div>
          </div>

          <button class="kc-send" type="button" title="发送" @click="onSend">↑</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.kode-convo {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kc-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.kc-msg.assistant { display: flex; gap: 8px; align-items: flex-start; }
.kc-msg.user { display: flex; justify-content: flex-end; }

.kc-aside { flex-shrink: 0; }
.kc-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $gradient-aurora;
  color: #fff;
  font-size: 15px;
  font-weight: $fw-bold;
}
.kc-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.kc-name { font-size: $fs-lg; color: $text-display; font-weight: $fw-medium; }
.kc-text { font-size: $fs-lg; line-height: 1.5; color: $text-display; }
.kc-bubble {
  max-width: 90%;
  font-size: $fs-lg;
  line-height: 1.43;
  color: $text-display;
  background: #f3f5f7;
  border-radius: 8px 0 8px 8px;
  padding: 9px 14px;
}
.kc-att {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  padding: 8px 10px;
  border: 1px solid $border;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  &:hover { border-color: $aurora-purple; }
  .kc-att-name { font-family: 'SF Mono', Monaco, monospace; font-size: $fs-base; font-weight: $fw-medium; }
  .kc-att-go { margin-left: 4px; color: $aurora-purple; font-size: $fs-xs; font-weight: $fw-semibold; }
}

.kc-reuse { flex-shrink: 0; padding: 0 14px; border-top: 1px solid $border-light; }

// ════ 输入区 ════
.kc-composer {
  flex-shrink: 0;
  padding: 10px 14px 12px;
  border-top: 1px solid $border-light;
}

// 选区上下文芯片
.kc-sel {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding: 4px 8px;
  border-radius: 7px;
  background: rgba(132, 120, 250, 0.08);
  font-size: $fs-xs;
  .ks-ico { color: $aurora-purple; }
  .ks-text { flex: 1; color: $aurora-purple; font-family: 'SF Mono', Monaco, monospace; }
  .ks-x {
    border: 0; background: transparent; cursor: pointer;
    color: $aurora-purple; opacity: .6; font-size: 10px; padding: 0 2px;
    &:hover { opacity: 1; }
  }
}

// 输入盒（输入框 + 工具条合成一个圆角框，跟截图参考一致）
.kc-box {
  border: 1px solid $border;
  border-radius: 12px;
  background: #fff;
  transition: border-color $anim-fast;
  &:focus-within { border-color: #FF9566; }
}
.kc-field {
  width: 100%;
  height: 34px;
  border: 0;
  background: transparent;
  padding: 0 12px;
  font-size: $fs-md;
  font-family: inherit;
  outline: none;
}
.kc-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 6px;
  .kt-spacer { flex: 1; }
}
.kt-btn {
  width: 26px; height: 26px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: $text-muted;
  font-size: $fs-md;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: rgba(0,0,0,.05); color: $text-display; }
  &.kt-slash {
    border-color: $border;
    font-family: 'SF Mono', Monaco, monospace;
    &.on { border-color: $aurora-purple; color: $aurora-purple; }
  }
}
.kt-perm {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 8px;
  border: 0; border-radius: 7px; background: transparent;
  color: $text-muted; font-size: $fs-xs; font-family: inherit; cursor: pointer;
  &:hover { background: rgba(0,0,0,.05); color: $text-display; }
  .kp-ico { font-size: 11px; }
}
.kc-send {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border: 0; border-radius: 7px;
  background: $gradient-aurora;
  color: #fff;
  font-size: $fs-md;
  font-family: inherit;
  cursor: pointer;
}

// 弹出菜单
.kt-wrap { position: relative; }
.kt-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  width: 250px;
  background: #fff;
  border: 1px solid $border;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  padding: 4px;
  z-index: 30;
  &.kt-menu-right { left: auto; right: 0; }
}
.km-filter {
  width: 100%; height: 28px; margin-bottom: 4px;
  border: 1px solid $border; border-radius: 7px; padding: 0 8px;
  font-size: $fs-base; font-family: inherit; outline: none;
  &:focus { border-color: $aurora-purple; }
}
.km-scroll { max-height: 300px; overflow-y: auto; }
.km-group {
  padding: 6px 8px 3px;
  font-size: 10px; color: $text-faint;
  text-transform: uppercase; letter-spacing: .4px;
}
.km-item {
  width: 100%;
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  padding: 6px 8px;
  border: 0; border-radius: 7px; background: transparent;
  cursor: pointer; text-align: left; font-family: inherit;
  &:hover { background: rgba(0,0,0,.05); }
  &.active { background: rgba(132,120,250,.10); }
}
.km-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 6px 8px;
}
.km-label { font-size: $fs-base; color: $text-display; }
.km-hint { font-size: 10px; color: $text-faint; }
.km-select {
  height: 24px; max-width: 130px;
  border: 1px solid $border; border-radius: 6px; background: #fff;
  font-size: 11px; font-family: inherit; color: $text-display; outline: none;
}
</style>
