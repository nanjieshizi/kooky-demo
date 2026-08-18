<script setup>
import { inject, computed, ref } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

const state = inject(KODE_STATE_KEY)
const {
  selectedTask,
  selectedWorkspace,
  currentTodos,
  currentProducts,
  activeTab,
  addTodo,
  removeTodo,
  getPersona,
} = state

function contribDH(id) {
  return getPersona(id)
}

const todoStatus = (t) => {
  if (activeTab.value === 'process') return t.status || 'todo'
  return 'draft'
}

const productStatus = (p) => p.status || 'pending'

function changeLabel(change) {
  const map = {
    added: '新增',
    modified: '改',
    deleted: '删',
    link: '外链',
  }
  return map[change] || change
}

// 手动加 todo（拆解 tab 用）
const newTodoText = ref('')
function onAddTodo() {
  if (!newTodoText.value.trim()) return
  addTodo(newTodoText.value, 'me')
  newTodoText.value = ''
}

// 打开 workspace 本地文件夹
function onOpenWorkspaceDir() {
  const cwd = selectedWorkspace.value?.cwd
  if (!cwd) return
  if (typeof window !== 'undefined' && window.electronAPI?.openPath) {
    window.electronAPI.openPath(cwd).catch((e) => console.warn('[Kode] openPath failed:', e?.message))
  } else {
    console.log('[Kode] electron 环境外，假装打开本地文件夹：', cwd)
  }
}
</script>

<template>
  <aside class="kode-right">
    <!-- 已删除 ws-head（workspace 名字栏）：跟左侧 task-bar 颜色不衔接造成视觉断层
         workspace 信息其实在左侧 KodeLeftList 里就能看到，右栏不重复显示 -->
    <div class="ws-body" v-if="selectedTask">
      <!-- Todolist -->
      <section class="r-section">
        <header class="r-section-head">
          <div class="title">📝 Todolist</div>
          <span v-if="activeTab === 'decompose'" class="state-chip draft">编辑态 · 可改</span>
          <span v-else-if="activeTab === 'process'" class="state-chip run">执行中</span>
        </header>
        <ul class="todolist" v-if="currentTodos.length">
          <li
            v-for="t in currentTodos"
            :key="t.id"
            :class="todoStatus(t)"
          >
            <span class="ico"></span>
            <span class="text">{{ t.text }}</span>
            <span
              v-if="t.contrib && contribDH(t.contrib)"
              class="contrib"
              :class="`contrib-${t.contrib}`"
            >
              {{ contribDH(t.contrib).initials }}
            </span>
            <span v-if="activeTab === 'decompose'" class="remove" @click="removeTodo(t.id)">✕</span>
          </li>
        </ul>
        <div v-else class="empty">尚未生成 todolist</div>

        <!-- 拆解态：手动加 todo -->
        <div v-if="activeTab === 'decompose'" class="todo-add">
          <input
            v-model="newTodoText"
            placeholder="+ 手动加一条..."
            @keydown.enter.prevent="onAddTodo"
          />
          <button type="button" @click="onAddTodo">+</button>
        </div>
      </section>

      <!-- 产物 = 实际改/新增的业务文件
           拆解 / 处理 都展示；拆解 tab 不显示 change 标签（任务还没启动，文件还没真改）-->
      <section class="r-section">
        <header class="r-section-head">
          <div class="title">📁 产物</div>
          <span v-if="activeTab === 'process' && currentProducts.length" class="state-chip count">
            {{ currentProducts.length }}
          </span>
          <div class="spacer"></div>
          <button
            v-if="selectedWorkspace?.cwd"
            type="button"
            class="open-dir-btn"
            :title="`打开本地文件夹 · ${selectedWorkspace.cwd}`"
            @click="onOpenWorkspaceDir"
          >
            📂
          </button>
        </header>

        <ul v-if="currentProducts.length" class="product-list">
          <li v-for="p in currentProducts" :key="p.id" :class="[productStatus(p), `kind-${p.kind}`]">
            <span class="ico">{{ p.icon }}</span>
            <span class="path" :title="p.path">{{ p.path }}</span>
            <!-- 处理 tab 才显示"新增/改/删"标签，拆解阶段不显示（任务未执行）-->
            <span v-if="activeTab === 'process'" class="change-chip" :class="p.change">{{ changeLabel(p.change) }}</span>
          </li>
        </ul>
        <div v-else class="product-placeholder">还没产物</div>
      </section>
    </div>

    <div class="ws-body empty-state" v-else>
      <div>选个任务看详情 →</div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.kode-right {
  width: $right-col-w;
  border-left: 1px solid $border;
  background: $bg-secondary;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.ws-head {
  height: $tab-bar-h;
  border-bottom: 1px solid $border;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  .ws-name {
    font-size: $fs-md;
    font-weight: $fw-semibold;
    color: $text-display;
    display: flex;
    align-items: center;
    gap: 6px;

    .ws-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  }

  .ws-meta {
    font-size: $fs-sm;
    color: $text-muted;

    .branch {
      padding: 2px 8px;
      background: $bg-primary;
      border: 1px solid $border;
      border-radius: 10px;
    }
  }
}

.ws-body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }

  &.empty-state {
    color: $text-muted;
    text-align: center;
    padding: 60px 20px;
    font-size: $fs-md;
  }
}

.r-section {
  background: $bg-primary;
  border: 1px solid $border;
  border-radius: $radius-lg;
  padding: 12px;
  margin-bottom: 12px;
}

.r-section-head {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 6px;

  .spacer { flex: 1; }

  .open-dir-btn {
    width: 24px;
    height: 24px;
    border: 0;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: $text-muted;
    transition: all $anim-fast;

    &:hover {
      background: rgba(132, 120, 250, 0.08);
      color: $aurora-purple;
    }
  }

  .title {
    font-size: $fs-base;
    font-weight: $fw-semibold;
    color: $text-display;
  }

  .state-chip {
    font-size: $fs-xs;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: $fw-medium;

    &.draft { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    &.run { background: rgba(34, 197, 94, 0.12); color: $success; }
  }

  .btn-mini {
    padding: 2px 8px;
    background: $bg-primary;
    border: 1px solid $border;
    border-radius: 4px;
    color: $text-secondary;
    cursor: pointer;
    font-size: $fs-sm;
    font-family: inherit;
    transition: all $anim-fast;

    &:hover {
      border-color: $aurora-purple;
      color: $aurora-purple;
    }
  }
}

.task-meta { margin-bottom: 6px; }

.pill {
  padding: 2px 7px;
  border-radius: 3px;
  font-size: $fs-xs;
  font-weight: $fw-medium;
}
.pill-用例 { background: $pill-uc-bg; color: $pill-uc-text; }
.pill-需求 { background: $pill-req-bg; color: $pill-req-text; }
.pill-研发任务 { background: $pill-dev-bg; color: $pill-dev-text; }
.pill-缺陷 { background: $pill-bug-bg; color: $pill-bug-text; }

.task-title {
  font-size: $fs-md;
  font-weight: $fw-semibold;
  color: $text-display;
  margin-bottom: 6px;
}

.task-desc {
  font-size: $fs-base;
  color: $text-secondary;
  line-height: 1.5;
  padding: 8px 10px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  margin-bottom: 12px;
}

// 输入源附件区（merge 在原始任务段底部）
.inputs-sub {
  border-top: 1px dashed $border;
  padding-top: 10px;

  .inputs-sub-head {
    font-size: $fs-xs;
    color: $text-muted;
    font-weight: $fw-semibold;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    .count {
      background: $bg-tertiary;
      color: $text-secondary;
      padding: 0 6px;
      border-radius: 8px;
      font-size: $fs-xs;
      font-weight: $fw-medium;
      letter-spacing: 0;
      text-transform: none;
    }
  }

  .inputs-sub-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;

    li {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      background: $bg-secondary;
      border-radius: $radius-sm;
      font-size: $fs-base;

      .ico { font-size: $fs-md; flex-shrink: 0; }
      .name { flex: 1; color: $text-display; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .source { color: $text-muted; font-size: $fs-xs; flex-shrink: 0; }
    }
  }

  .btn-add-input {
    margin-top: 6px;
    width: 100%;
    padding: 5px 8px;
    background: transparent;
    border: 1px dashed $border-strong;
    border-radius: $radius-sm;
    color: $text-muted;
    font-size: $fs-xs;
    cursor: pointer;
    font-family: inherit;

    &:hover {
      border-color: $aurora-purple;
      color: $aurora-purple;
    }
  }
}

// Todolist
.todolist {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    font-size: $fs-base;
    color: $text-display;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: $radius-sm;
    margin-bottom: 1px;

    .ico {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      background: $bg-tertiary;
      color: $text-faint;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .text {
      flex: 1;
      min-width: 0;
    }

    .contrib {
      font-size: $fs-xs;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: $fw-medium;
      flex-shrink: 0;
    }

    .contrib-me { background: $bg-tertiary; color: $text-muted; }
    .contrib-xiaochan { background: rgba(236, 72, 153, 0.15); color: #ec4899; }
    .contrib-laojia { background: rgba(132, 120, 250, 0.15); color: #8478fa; }
    .contrib-ace { background: rgba(6, 182, 212, 0.18); color: #06b6d4; }
    .contrib-laoyan { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .contrib-xiaoshen { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
    .contrib-ayun { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .contrib-cc { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
    .contrib-agent { background: $gradient-aurora-soft; color: $aurora-purple; }

    .remove {
      color: $text-faint;
      cursor: pointer;
      opacity: 0;
      transition: opacity $anim-fast;
      font-size: $fs-sm;

      &:hover { color: $danger; }
    }

    &:hover .remove { opacity: 1; }

    &.done {
      .ico { background: $success; color: #fff; &::after { content: '✓'; } }
    }
    &.active {
      background: rgba(132, 120, 250, 0.05);
      .ico { background: $aurora-purple; color: #fff; animation: kode-pulse 1.5s infinite;
        &::after { content: '▶'; font-size: 7px; } }
    }
    &.failed {
      background: rgba(239, 68, 68, 0.06);
      color: $danger;
      .ico { background: $danger; color: #fff; &::after { content: '✕'; } }
    }
    &.todo {
      color: $text-muted;
    }
    &.draft {
      color: $text-display;
      .ico { background: $bg-tertiary; }
    }
  }
}

.todo-add {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 8px;
  background: $bg-secondary;
  border: 1px dashed $border;
  border-radius: $radius-sm;

  input {
    flex: 1;
    border: 0;
    background: transparent;
    outline: 0;
    font-size: $fs-base;
    font-family: inherit;

    &::placeholder { color: $text-faint; }
  }

  button {
    padding: 2px 8px;
    background: $aurora-purple;
    color: #fff;
    border: 0;
    border-radius: 4px;
    font-size: $fs-base;
    cursor: pointer;
    font-family: inherit;
  }
}

.empty {
  padding: 20px 10px;
  text-align: center;
  font-size: $fs-base;
  color: $text-muted;
}

.product-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: $radius-sm;
    font-size: $fs-base;
    cursor: pointer;

    &:hover {
      background: rgba(132, 120, 250, 0.04);
    }

    .ico {
      font-size: $fs-md;
      flex-shrink: 0;
    }

    .path {
      flex: 1;
      color: $text-display;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: $fs-sm;
    }

    .change-chip {
      flex-shrink: 0;
      font-size: $fs-xs;
      font-weight: $fw-medium;
      padding: 1px 6px;
      border-radius: 8px;

      &.added { background: rgba(34, 197, 94, 0.12); color: $success; }
      &.modified { background: rgba(132, 120, 250, 0.12); color: $aurora-purple; }
      &.deleted { background: rgba(239, 68, 68, 0.12); color: $danger; }
      &.link { background: $bg-tertiary; color: $text-muted; }
    }

    &.running {
      .path { color: $aurora-purple; font-weight: $fw-medium; }
      .path::after {
        content: ' …';
        color: $aurora-purple;
        animation: kode-pulse 1.5s infinite;
      }
    }

    &.pending {
      opacity: 0.55;
      .path { color: $text-muted; }
    }
  }
}

.product-placeholder {
  padding: 18px 12px;
  text-align: center;
  font-size: $fs-base;
  color: $text-muted;
  background: $bg-secondary;
  border: 1px dashed $border;
  border-radius: $radius-sm;
  line-height: 1.6;
}

.state-chip.count {
  background: $bg-tertiary;
  color: $text-secondary;
  font-weight: $fw-medium;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: $fs-xs;
}

@keyframes kode-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
