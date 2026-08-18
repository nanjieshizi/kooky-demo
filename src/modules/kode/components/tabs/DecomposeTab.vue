<script setup>
import { inject, ref, computed, nextTick, onMounted, watch } from 'vue'
import { KODE_STATE_KEY } from '../../composables/useKodeState.js'
import AssistantMessageActions from '@/shared/components/AssistantMessageActions.vue'
import MessageAssistantAttachmentCards from '@/shared/components/MessageAssistantAttachmentCards.vue'

const state = inject(KODE_STATE_KEY)
const {
  selectedTask,
  digitalHumans,
  taskAssistant,
  invitedHumanIds,
  inviteHuman,
  removeHuman,
  dialogMessages,
  decomposeInput,
  sendDecomposeMessage,
  executeNow,
  getPersona,
  wsMissing,
} = state

const streamEl = ref(null)
const inputFocused = ref(false)

// 输入框附件：纯前端 mock，不真上传
const fileInputEl = ref(null)
const pendingAttachments = ref([])

function onPickFile() {
  fileInputEl.value?.click()
}

function onFileSelected(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) {
    pendingAttachments.value.push({
      id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: f.name,
      url: '',  // demo 不真上传
      size: f.size,
    })
  }
  if (fileInputEl.value) fileInputEl.value.value = ''
}

function removePendingAttachment(id) {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.id !== id)
}

// ─── @ 提及数字人：只是 @ ta 让 ta 回复，不再拉人进群 ───
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionMatches = computed(() => {
  const list = digitalHumans.value || []
  const q = mentionQuery.value.toLowerCase()
  return q ? list.filter((h) => (h.name || '').toLowerCase().includes(q)) : list
})
function onInputChange() {
  const m = (decomposeInput.value || '').match(/@([^\s@]*)$/)
  if (m) { mentionOpen.value = true; mentionQuery.value = m[1] }
  else { mentionOpen.value = false }
}
function pickMention(h) {
  decomposeInput.value = (decomposeInput.value || '').replace(/@([^\s@]*)$/, `@${h.name} `)
  mentionOpen.value = false
  mentionQuery.value = ''
}

async function scrollEnd() {
  await nextTick()
  if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight
}

watch(dialogMessages, () => scrollEnd(), { deep: true })
onMounted(() => scrollEnd())

// 邀请弹层
const showInvitePop = ref(false)
const invitableHumans = computed(() =>
  digitalHumans.value.filter((d) => d.id !== 'me' && !invitedHumanIds.value.has(d.id)),
)
function pickInvite(id) {
  inviteHuman(id)
  showInvitePop.value = false
}

// 高亮 @ 提及
function renderBody(text) {
  if (!text) return ''
  return text.replace(/@(小产|老架|阿测|老研|小审|阿运|任务助手)/g, '<span class="mention">@$1</span>')
}

function onSend() {
  const hasText = decomposeInput.value.trim().length > 0
  const hasFiles = pendingAttachments.value.length > 0
  if (!hasText && !hasFiles) return
  sendDecomposeMessage(pendingAttachments.value.slice())
  pendingAttachments.value = []
}

// 立即执行：tab 自动切到处理 + 任务进入 running + 第一条 todo 启动
function onExecuteNow() {
  executeNow()
}

// 输入框上方的快捷 prompt chip
// 点击 → prefill 到输入框（不自动发送，留给用户审/改）
const promptChips = [
  {
    id: 'criteria',
    emoji: '🔍',
    label: '补全验收标准',
    text: '@任务助手 帮我补充验收标准 —— 怎么算这个任务做完了？需要覆盖哪些指标？',
  },
  {
    id: 'constraints',
    emoji: '🚫',
    label: '明确边界约束',
    text: '@任务助手 这个任务有哪些不能动的依赖或代码？帮我列出来，避免 Kode 跑的时候越界',
  },
  {
    id: 'split-finer',
    emoji: '📋',
    label: '拆得更细',
    text: '@任务助手 现在的 todolist 太粗，请按文件 / 模块拆成更具体的步骤',
  },
  {
    id: 'tests',
    emoji: '🧪',
    label: '补充测试场景',
    text: '@任务助手 这个任务的回归测试该覆盖哪些场景？请帮我补几条到 todolist',
  },
]

function onChipClick(text) {
  decomposeInput.value = text
}

// 任务"编辑中"摘要：用户对话已开始就显示"编辑中"，否则"未启动"
const decomposeStateLabel = computed(() => {
  const hasUserMsg = dialogMessages.value.some((m) => m.type === 'msg' && m.from === 'me')
  return hasUserMsg ? '编辑中' : '未启动'
})

// ─── AssistantMessageActions 适配层：把 Kode dialogMessage 转成 actions 看得懂的对象 ───
function toActionMessage(m) {
  let role
  if (m.from === 'me') role = 'user'
  else if (m.from === 'agent') role = 'assistant'
  else role = 'member'
  return {
    role,
    content: m.body || '',
    eventId: m.id,
    senderId: m.from,
    attachments: m.attachments,
  }
}
function actionModeFor(m) {
  if (m.from === 'me') return 'user'
  if (m.from === 'agent') return 'assistant'
  return 'member'
}

// 🦀 帮我回复：触发 dev-mocks 的 startAiDraft（mock 流式打字 → 输入框）
function onAiDraft(sourceMessage) {
  const cid = selectedTask.value?.id || 'kode-decompose'
  if (typeof window !== 'undefined' && window.__kookyMock?.startAiDraft) {
    window.__kookyMock.startAiDraft(cid, sourceMessage)
  } else {
    console.warn('[DecomposeTab] __kookyMock.startAiDraft 不可用')
  }
}

// 引用 hook（暂保留入口，demo 不深做）
function onQuoteMessage(m) {
  decomposeInput.value = `> ${m?.content?.split('\n')[0] || ''}\n${decomposeInput.value}`
}
</script>

<template>
  <div class="decompose-tab" v-if="selectedTask">
    <!-- 参与者条：先拉人协作（任务助手常驻，可邀请产品/研发等数字人）-->
    <div class="participants-bar">
      <span class="bar-label">参与者</span>
      <div class="people">
        <span class="avatar-chip agent" :title="taskAssistant.name + ' · ' + taskAssistant.role">
          <span class="av" :style="{ background: taskAssistant.gradient }">{{ taskAssistant.initials }}</span>
        </span>
        <span
          v-for="id in invitedHumanIds"
          :key="id"
          class="avatar-chip"
          :title="getPersona(id)?.name + ' · ' + getPersona(id)?.role"
        >
          <img v-if="getPersona(id)?.avatar" :src="getPersona(id).avatar" class="av av-img" :alt="getPersona(id).name" />
          <span v-else class="av" :style="{ background: getPersona(id)?.gradient }">{{ getPersona(id)?.initials }}</span>
          <span class="remove" @click="removeHuman(id)">✕</span>
        </span>
        <div class="invite-wrap">
          <button
            type="button"
            class="avatar-chip invite-btn"
            :class="{ active: showInvitePop }"
            title="邀请数字人"
            @click="showInvitePop = !showInvitePop"
          >
            <span class="av">+</span>
          </button>
          <div v-if="showInvitePop" class="invite-pop">
            <div class="pop-head">邀请数字人</div>
            <button
              v-for="h in invitableHumans"
              :key="h.id"
              class="pop-item"
              type="button"
              @click="pickInvite(h.id)"
            >
              <img v-if="h.avatar" :src="h.avatar" class="av av-img" :alt="h.name" />
              <span v-else class="av" :style="{ background: h.gradient }">{{ h.initials }}</span>
              <span class="who">
                <span class="name">{{ h.name }}</span>
                <span class="role">· {{ h.role }}</span>
              </span>
            </button>
            <div v-if="!invitableHumans.length" class="empty">没有可邀请的了</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 消息流 -->
    <div class="msg-stream" ref="streamEl">
      <template v-for="m in dialogMessages" :key="m.id">
        <!-- 系统通知 -->
        <div v-if="m.type === 'system'" class="sys-line">
          <span class="sys-dot"></span>
          <span class="sys-text">{{ m.body }}</span>
          <span class="sys-ts">{{ m.ts }}</span>
        </div>

        <!-- 📝 todo-patch 小卡：紧贴任务助手上一条气泡下方，不占满横屏 -->
        <!-- 业务规则：只有任务助手（by:'agent'）能产生 todo-patch，数字人不写 todolist -->
        <div v-else-if="m.type === 'todo-patch'" class="todo-patch-card">
          <div class="patch-head">
            <span class="patch-ico">📝</span>
            <span class="patch-title">
              <template v-if="m.sourceFrom">已基于 {{ getPersona(m.sourceFrom)?.name }} 的建议更新 Todolist</template>
              <template v-else>已更新 Todolist</template>
            </span>
            <span class="patch-stat">
              <span v-if="m.adds?.length" class="stat add">+{{ m.adds.length }}</span>
              <span v-if="m.removes?.length" class="stat rm">−{{ m.removes.length }}</span>
              <span v-if="m.modifies?.length" class="stat mod">✎{{ m.modifies.length }}</span>
            </span>
          </div>
          <ul v-if="m.adds?.length" class="patch-list patch-list--add">
            <li v-for="(it, i) in m.adds" :key="`a${i}`">{{ it }}</li>
          </ul>
        </div>

        <!-- 普通消息（对齐 Kooky GroupMessageItem 样式）-->
        <article
          v-else
          class="msg-item"
          :class="m.from === 'me' ? 'user' : 'assistant'"
        >
          <!-- 用户气泡：右对齐 + 灰底 + 圆形头像 -->
          <template v-if="m.from === 'me'">
            <div class="user-body">
              <div class="user-bubble-wrapper">
                <div class="user-header">
                  <span class="user-time">{{ m.ts }}</span>
                  <span class="user-name">{{ getPersona('me')?.name }}</span>
                  <span class="user-avatar-wrapper">
                    <img class="user-avatar" :src="getPersona('me')?.avatar" :alt="getPersona('me')?.name" />
                  </span>
                </div>
                <div v-if="m.body" class="user-bubble">
                  <div class="user-bubble-content" v-html="renderBody(m.body)"></div>
                </div>
                <!-- 附件在文字下方靠右（与主线协作一致）-->
                <MessageAssistantAttachmentCards
                  v-if="m.attachments?.length"
                  class="kode-user-attachments"
                  :attachments="m.attachments"
                />
                <!-- 用户气泡 hover 操作：引用 + 复制（与协作一致）-->
                <div class="user-bubble-actions">
                  <AssistantMessageActions
                    action-mode="user"
                    :content="m.body || ''"
                    :message="toActionMessage(m)"
                    @quote="onQuoteMessage"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- 数字人 / 任务助手：左对齐 + 方形头像 + 无气泡背景 -->
          <template v-else>
            <div class="assistant-block">
              <div class="assistant-aside">
                <div class="assistant-avatar">
                  <img
                    class="avatar-img"
                    :class="getPersona(m.from)?.isHuman ? 'avatar-img--human' : 'avatar-img--digital'"
                    :src="getPersona(m.from)?.avatar"
                    :alt="getPersona(m.from)?.name"
                  />
                  <span class="avatar-name">{{ getPersona(m.from)?.name }}</span>
                  <span class="assistant-time">{{ m.ts }}</span>
                </div>
              </div>
              <div class="msg-body assistant-body">
                <div class="msg-text" v-html="renderBody(m.body)"></div>
                <!-- 助手 / 数字人 hover 操作：复制 / 引用 / 赞踩 + 🦀 帮我回复 -->
                <AssistantMessageActions
                  :action-mode="actionModeFor(m)"
                  :content="m.body || ''"
                  :message="toActionMessage(m)"
                  :show-ai-draft="true"
                  class="kode-msg-actions"
                  @quote="onQuoteMessage"
                  @ai-draft="onAiDraft"
                />
              </div>
            </div>
          </template>
        </article>
      </template>
    </div>

    <!-- 快捷 prompt chip：点了 prefill 到输入框，不自动发送 -->
    <div class="prompt-chips">
      <button
        v-for="chip in promptChips"
        :key="chip.id"
        type="button"
        class="prompt-chip"
        @click="onChipClick(chip.text)"
      >
        <span class="chip-emoji">{{ chip.emoji }}</span>
        <span class="chip-label">{{ chip.label }}</span>
      </button>
    </div>

    <!-- Kooky 彩虹边输入框 -->
    <div class="msg-input">
      <div class="input-wrapper" :class="{ focused: inputFocused }">
        <!-- @ 提及数字人下拉（只 @ ta 回复，不拉群）-->
        <div v-if="mentionOpen && mentionMatches.length" class="mention-pop">
          <div class="mention-head">@ 让 ta 回复</div>
          <button
            v-for="h in mentionMatches"
            :key="h.id"
            type="button"
            class="mention-item"
            @mousedown.prevent="pickMention(h)"
          >
            <img v-if="h.avatar" :src="h.avatar" class="mav" :alt="h.name" />
            <span v-else class="mav" :style="{ background: h.gradient }">{{ h.initials }}</span>
            <span class="mwho"><span class="mname">{{ h.name }}</span><span class="mrole">· {{ h.role }}</span></span>
          </button>
        </div>
        <!-- 目录失效：对话历史照常看（上面的消息流），但不能再发 —— 发了也没工作区可干活 -->
        <div v-if="wsMissing" class="input-disabled">
          🗂️ 工作区目录不存在，已停用对话与执行。历史记录仍可查看。
        </div>
        <div v-else class="input-container">
          <!-- 待发附件预览（复用主线 MessageAssistantAttachmentCards 样式）-->
          <div v-if="pendingAttachments.length" class="pending-attachments">
            <div v-for="a in pendingAttachments" :key="a.id" class="pending-card">
              <span class="pc-name">📎 {{ a.name }}</span>
              <button type="button" class="pc-remove" :aria-label="`移除 ${a.name}`" @click="removePendingAttachment(a.id)">✕</button>
            </div>
          </div>
          <textarea
            v-model="decomposeInput"
            placeholder="跟任务助手聊，或 @ 数字人..."
            @input="onInputChange"
            @keydown.enter.exact.prevent="onSend"
            @focus="inputFocused = true"
            @blur="inputFocused = false"
          ></textarea>
          <input ref="fileInputEl" type="file" multiple hidden @change="onFileSelected" />
          <div class="input-toolbar">
            <button type="button" class="btn-attach" title="添加附件" @click="onPickFile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <span class="hint">⌥+↵ 多行 · @ 数字人由 ta 回复，不 @ 任务助手回</span>
            <button type="button" class="btn-send" @click="onSend">↵ 发送</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles.scss' as *;

// @ 提及数字人下拉
.input-wrapper { position: relative; }
.mention-pop {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 30;
  max-height: 240px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 12px;
  box-shadow: $shadow-lg;
  padding: 4px;

  .mention-head { padding: 6px 10px 4px; font-size: $fs-xs; color: $text-muted; }
  .mention-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    &:hover { background: rgba(132, 120, 250, 0.08); }
    .mav { width: 24px; height: 24px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: $fw-semibold; object-fit: cover; flex-shrink: 0; }
    .mwho { display: flex; align-items: baseline; gap: 5px; min-width: 0; }
    .mname { font-size: $fs-md; font-weight: $fw-medium; color: $text-display; }
    .mrole { font-size: $fs-xs; color: $text-muted; }
  }
}

.decompose-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

// ─── 顶部任务条 ───
.task-bar {
  flex-shrink: 0;
  padding: 12px 24px;
  background: $bg-primary;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  gap: 12px;

  .task-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    .emoji { font-size: $fs-lg; }

    .title {
      font-size: $fs-xl;
      font-weight: $fw-semibold;
      color: $text-display;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .state-chip {
      padding: 2px 10px;
      background: rgba(132, 120, 250, 0.1);
      color: $aurora-purple;
      border-radius: 10px;
      font-size: $fs-xs;
      font-weight: $fw-medium;
      flex-shrink: 0;
    }
  }

  .btn-run {
    flex-shrink: 0;
    padding: 7px 18px;
    border: 0;
    border-radius: 16px;
    background: $gradient-aurora;
    color: #fff;
    font-size: $fs-md;
    font-weight: $fw-semibold;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 10px rgba(132, 120, 250, 0.25);
    transition: all $anim-fast;

    .ico { font-size: $fs-base; }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(132, 120, 250, 0.35);
    }
  }
}

// ─── 参与者条 ───
.participants-bar {
  flex-shrink: 0;
  padding: 8px 24px;
  background: $bg-secondary;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  gap: 10px;

  .bar-label {
    font-size: $fs-xs;
    color: $text-muted;
    font-weight: $fw-semibold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .people {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
  }
}

.avatar-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform $anim-fast;

  &:hover { transform: scale(1.08); }

  .av {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #fff;
    font-size: $fs-base;
    font-weight: $fw-semibold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid $bg-primary;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  &.agent .av {
    box-shadow: 0 1px 4px rgba(132, 120, 250, 0.4);
  }

  .remove {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: $danger;
    color: #fff;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    cursor: pointer;
  }

  &:hover .remove { display: flex; }

  &.invite-btn .av {
    background: $bg-primary;
    color: $text-muted;
    border: 1.5px dashed $text-faint;
    font-size: $fs-md;
    box-shadow: none;
  }

  &.invite-btn:hover .av,
  &.invite-btn.active .av {
    color: $aurora-purple;
    border-color: $aurora-purple;
    border-style: solid;
    background: rgba(132, 120, 250, 0.06);
  }
}

.invite-wrap { position: relative; }

.invite-pop {
  position: absolute;
  top: 38px;
  left: 0;
  background: $bg-primary;
  border: 1px solid $border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  padding: 6px;
  width: 220px;
  z-index: 50;

  .pop-head {
    font-size: $fs-xs;
    color: $text-muted;
    padding: 6px 8px;
    font-weight: $fw-semibold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pop-item {
    width: 100%;
    padding: 8px;
    border-radius: $radius-sm;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: inherit;
    text-align: left;

    &:hover { background: $bg-secondary; }

    .av {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: #fff;
      font-size: $fs-sm;
      font-weight: $fw-semibold;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .who {
      display: flex;
      align-items: center;
      gap: 4px;
      .name { font-weight: $fw-medium; color: $text-display; font-size: $fs-base; }
      .role { color: $text-muted; font-size: $fs-xs; }
    }
  }

  .empty {
    padding: 16px;
    text-align: center;
    color: $text-muted;
    font-size: $fs-base;
  }
}

// ─── 消息流 ───
.msg-stream {
  flex: 1;
  overflow-y: auto;
  padding: 18px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
}

.sys-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 0;
  font-size: $fs-xs;
  color: $text-muted;

  .sys-dot { width: 4px; height: 4px; border-radius: 50%; background: $text-faint; }

  .sys-text {
    background: $bg-secondary;
    padding: 2px 10px;
    border-radius: 10px;
  }

  .sys-ts { color: $text-faint; font-size: $fs-xs; }
}

// 📝 todo-patch 小卡：紧贴任务助手气泡下方，宽度自适应内容（不占满横屏）
// 缩进对齐 assistant-body（margin-left 与 40×40 头像 + 间距对齐）
.todo-patch-card {
  align-self: flex-start;
  margin-top: -6px;          // 紧贴上方任务助手气泡
  margin-left: 54px;         // 与 assistant-body 文本左对齐（40 头像 + 14 间距）
  max-width: 70%;
  background: linear-gradient(180deg, rgba(132, 120, 250, 0.06), rgba(132, 120, 250, 0.02));
  border: 1px solid rgba(132, 120, 250, 0.20);
  border-radius: $radius-md;
  padding: 8px 12px;
  animation: kode-msg-appear 0.3s ease-out;

  .patch-head {
    display: flex;
    align-items: center;
    gap: 6px;

    .patch-ico { font-size: $fs-md; }

    .patch-title {
      font-size: $fs-base;
      color: $aurora-purple;
      font-weight: $fw-semibold;
      flex: 1;
    }

    .patch-stat {
      display: inline-flex;
      gap: 4px;
      font-size: $fs-xs;
      font-weight: $fw-semibold;

      .stat {
        padding: 1px 6px;
        border-radius: 8px;
      }
      .add { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
      .rm  { background: rgba(239, 68, 68, 0.12);  color: #ef4444; }
      .mod { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    }
  }

  .patch-list {
    list-style: none;
    padding: 6px 0 0 18px;
    margin: 6px 0 0;
    border-top: 1px dashed rgba(132, 120, 250, 0.2);

    li {
      position: relative;
      padding: 2px 0;
      font-size: $fs-base;
      color: $text-display;

      &::before {
        position: absolute;
        left: -14px;
        font-weight: 700;
      }
    }
  }
  .patch-list--add li::before { content: '+'; color: #22c55e; }
}


// ─── 消息项（复用 Kooky GroupMessageItem 样式）───
.msg-item {
  display: flex;
  gap: 10px;
  width: 100%;
  animation: kode-msg-appear 0.3s ease-out;

  &.user {
    justify-content: flex-end;
    margin-top: 28px;
  }
  &.assistant {
    align-items: flex-start;
    justify-content: flex-start;
  }
}

.assistant-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-top: 24px;
}

.assistant-block > .assistant-body { margin-top: 12px; align-self: stretch; }

.assistant-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 16px;
}

.assistant-avatar {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.avatar-name {
  margin-left: 10px;
  white-space: nowrap;
  font-family: 'PingFang SC', inherit;
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
}

.assistant-time {
  margin-left: 4px;
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.msg-item:hover .assistant-time,
.msg-item:hover .user-time { opacity: 1; }

// hover 操作：默认零高度不占位，hover 父消息时平滑展开（避免卡片中间空一截）
.msg-item :deep(.msg-actions) {
  max-height: 0;
  overflow: hidden;
  visibility: visible;
  margin: 0;
  transition: max-height 0.15s ease, margin 0.15s ease;
}
.msg-item:hover :deep(.msg-actions),
.msg-item.assistant:hover .assistant-body :deep(.msg-actions),
.msg-item.user:hover .user-bubble-actions :deep(.msg-actions) {
  max-height: 36px;
  margin-top: 4px;
}

// 用户气泡下方的操作栏对齐
.user-bubble-actions {
  align-self: flex-end;
  :deep(.msg-actions) { justify-content: flex-end; }
}

// 助手 / 数字人操作栏（外部 margin 由上面 hover 状态控制，默认贴气泡）
.kode-msg-actions {
  align-self: flex-start;
}

.avatar-img {
  position: relative;
  flex-shrink: 0;
  object-fit: cover;
}

.avatar-img--digital {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 0;
}

.avatar-img--human {
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  border-radius: 50%;
  overflow: hidden;
}

.msg-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  margin-left: 4px;
}

.assistant-body .msg-text {
  font-size: 14px;
  line-height: 1.7;
  color: #2F3547;
  word-break: break-word;
  white-space: pre-wrap;

  :deep(.mention) { color: #4f6ef7; font-weight: 500; }
}

.user-body {
  align-items: flex-end;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
}

.user-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: min(70%, 1000px);
  min-width: 0;
}

.user-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;

  .user-name {
    font-family: 'PingFang SC', inherit;
    font-size: 14px;
    font-weight: 500;
    color: #2F3547;
  }
}

.user-time {
  font-size: 12px;
  color: #91949E;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.user-avatar-wrapper { flex-shrink: 0; }

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.user-bubble {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 9px 16px;
  gap: 8px;
  border-radius: 8px 0 8px 8px;
  background: #F3F5F7;
  min-height: 38px;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.user-bubble-content {
  font-family: 'PingFang SC', inherit;
  font-size: 14px;
  line-height: 20px;
  color: #2F3547;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  white-space: pre-wrap;

  :deep(.mention) { color: #4f6ef7; font-weight: 500; }
}

// 主线 MessageAssistantAttachmentCards 在用户气泡区靠右对齐
// 内部 .msg-attachments 是 flex-direction:column + align-items:flex-start（默认贴左）
// 用户消息要靠右 → 覆盖 align-items: flex-end
.kode-user-attachments {
  align-self: flex-end;
  width: 100%;
  margin-top: 4px;

  :deep(.msg-attachments) {
    align-items: flex-end !important;
  }
  // 单张卡片不撑满 100% 宽度
  :deep(.file-card) {
    width: auto;
    max-width: 360px;
  }
}

@keyframes kode-msg-appear {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

// ─── 快捷 prompt chip 行 ───
.prompt-chips {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 24px 0;
  background: $bg-primary;
}

.prompt-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid rgba(132, 120, 250, 0.22);
  background: rgba(132, 120, 250, 0.04);
  color: $aurora-purple;
  border-radius: 14px;
  cursor: pointer;
  font-size: $fs-xs;
  font-family: inherit;
  white-space: nowrap;
  transition: all $anim-fast;

  &:hover {
    background: rgba(132, 120, 250, 0.12);
    border-color: rgba(132, 120, 250, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(132, 120, 250, 0.15);
  }

  .chip-emoji { font-size: 12px; line-height: 1; }
  .chip-label { font-weight: $fw-medium; }
}

// ─── Kooky 彩虹旋转边输入框 ───
.msg-input {
  flex-shrink: 0;
  padding: 8px 24px 16px;
  border-top: 1px solid $border;
  background: $bg-primary;
}

.input-wrapper {
  position: relative;
  background: rgba(180, 180, 180, 0.3);
  border-radius: 16px;
  padding: 1.5px;
  box-shadow: 4px 4px 6px #91949e24;
  z-index: 0;
  transition: background 0.3s;

  &.focused { background: rgba(180, 180, 180, 0.3); }
}

.input-wrapper::before {
  content: '';
  position: absolute;
  inset: 6px 5px 0px 5px;
  border-radius: 16px;
  z-index: 0;
  pointer-events: none;
  background: conic-gradient(
    from var(--arc-angle, 0turn),
    rgba(255, 151, 133, 1) 0%,
    rgba(255, 178, 95, 1) 14%,
    rgba(255, 221, 85, 1) 28%,
    rgba(45, 255, 203, 1) 42%,
    rgba(59, 180, 255, 1) 56%,
    rgba(0, 140, 255, 1) 70%,
    rgba(115, 60, 255, 1) 84%,
    rgba(255, 151, 133, 1) 100%
  );
  animation: arc-spin 4s linear infinite;
  filter: blur(6px);
  opacity: 0.6;
  transition: opacity 0.8s ease-out, filter 0.8s ease-out;
}

.input-wrapper.focused::before {
  inset: 3px 6px -3px 6px;
}

.input-wrapper::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 16px;
  background: #ffffff;
  z-index: 0;
  pointer-events: none;
}

// 目录失效：输入区替换成一条禁用提示
.input-disabled {
  margin: 8px 0 4px;
  padding: 12px 14px;
  border: 1px dashed rgba(225, 29, 72, 0.3);
  border-radius: 12px;
  background: rgba(225, 29, 72, 0.05);
  color: #b91c3c;
  font-size: 13px;
  text-align: center;
}

.input-container {
  position: relative;
  border: 0;
  border-radius: 12px;
  background: transparent;
  padding: 12px 16px 10px;
  z-index: 2;

  textarea {
    width: 100%;
    border: 0;
    background: transparent;
    outline: 0;
    font-size: $fs-md;
    font-family: inherit;
    resize: none;
    line-height: 1.6;
    min-height: 24px;
    max-height: 120px;
    color: $text-display;

    &::placeholder { color: $text-faint; }
  }

  .input-toolbar {
    display: flex;
    align-items: center;
    margin-top: 6px;
    gap: 8px;

    .btn-attach {
      width: 28px;
      height: 28px;
      border: 0;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: $text-muted;
      transition: all $anim-fast;
      flex-shrink: 0;
      padding: 0;

      &:hover {
        color: $aurora-purple;
        background: rgba(132, 120, 250, 0.08);
      }
    }

    .hint {
      font-size: $fs-xs;
      color: $text-faint;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-send {
      padding: 5px 14px;
      background: $gradient-aurora;
      color: #fff;
      border: 0;
      border-radius: 14px;
      font-size: $fs-base;
      cursor: pointer;
      font-weight: $fw-medium;
      font-family: inherit;
      flex-shrink: 0;
      transition: all $anim-fast;

      &:hover { box-shadow: 0 2px 10px rgba(132, 120, 250, 0.3); }
    }
  }

  // 待发附件预览（贴在 textarea 上方）
  .pending-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .pending-card {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 10px;
    background: #F7F8FA;
    border: 1px solid #ECEEF3;
    border-radius: 8px;
    font-size: $fs-xs;
    color: $text-display;
    max-width: 220px;

    .pc-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pc-remove {
      border: 0;
      background: transparent;
      cursor: pointer;
      color: $text-muted;
      font-size: 11px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;

      &:hover { background: rgba(0,0,0,0.06); color: $danger; }
    }
  }
}

@property --arc-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0turn;
}

@keyframes arc-spin {
  from { --arc-angle: 0turn; }
  to { --arc-angle: 1turn; }
}

@media (prefers-reduced-motion: reduce) {
  .input-wrapper::before { animation: none; }
}
</style>
