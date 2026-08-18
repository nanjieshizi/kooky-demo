<script setup>
import { inject, ref, computed } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

const emit = defineEmits(['send', 'send-all'])

const state = inject(KODE_STATE_KEY)
const { currentTodos, isStepSent, markStepSent, markAllStepsSent } = state

const open = ref(false)

// chip 截断标题：取「（」前、≤12 字
function shortTitle(text) {
  const head = String(text).split('（')[0].split('(')[0].trim()
  return head.length > 12 ? head.slice(0, 12) + '…' : head
}

function sendStep(t) {
  if (isStepSent(t.id)) return
  markStepSent(t.id)
  emit('send', t)
}
function sendAll() {
  markAllStepsSent()
  emit('send-all', currentTodos.value)
  open.value = false
}

const count = computed(() => currentTodos.value.length)
</script>

<template>
  <div class="todo-reuse" v-if="count">
    <!-- 折叠 chip 行 -->
    <div class="reuse-row">
      <button class="reuse-toggle" type="button" @click="open = !open">
        📋 Todolist · {{ count }} {{ open ? '▴' : '▾' }}
      </button>
      <div class="reuse-chips">
        <button
          v-for="(t, i) in currentTodos"
          :key="t.id"
          class="step-chip"
          :class="{ sent: isStepSent(t.id) }"
          type="button"
          :title="t.text"
          @click="sendStep(t)"
        >
          <span class="sc-no">{{ i + 1 }}</span>
          <span class="sc-title">{{ shortTitle(t.text) }}</span>
          <span v-if="isStepSent(t.id)" class="sc-check">✓</span>
        </button>
      </div>
    </div>

    <!-- 展开 tray -->
    <div v-if="open" class="reuse-tray">
      <div class="tray-head">
        <span class="th-title">📋 复用任务 Todolist</span>
        <button class="th-collapse" type="button" @click="open = false">收起 ▴</button>
      </div>
      <ul class="tray-list">
        <li v-for="(t, i) in currentTodos" :key="t.id" class="tray-item">
          <span class="ti-no">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="ti-text">{{ t.text }}</span>
          <button
            class="ti-send"
            :class="{ sent: isStepSent(t.id) }"
            type="button"
            :disabled="isStepSent(t.id)"
            @click="sendStep(t)"
          >
            {{ isStepSent(t.id) ? '已发送' : '→ 发送' }}
          </button>
        </li>
      </ul>
      <button class="tray-all" type="button" @click="sendAll">⚡ 全部发给 Kode 逐条开干</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.todo-reuse { flex-shrink: 0; }

.reuse-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  min-width: 0;
}
.reuse-toggle {
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid rgba(132, 120, 250, 0.28);
  border-radius: 8px;
  background: rgba(132, 120, 250, 0.10);
  color: $aurora-purple;
  font-size: $fs-xs;
  font-weight: $fw-semibold;
  font-family: inherit;
  cursor: pointer;
}
.reuse-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  min-width: 0;
  padding-bottom: 2px;
  &::-webkit-scrollbar { height: 0; }
}
.step-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid $border;
  border-radius: 8px;
  background: #fff;
  color: $text-secondary;
  font-size: $fs-xs;
  font-family: inherit;
  cursor: pointer;
  transition: all $anim-fast;
  &:hover { border-color: $aurora-purple; }
  .sc-no { opacity: 0.55; }
  &.sent { background: #f3fbf6; border-color: #cde6d5; color: #16a34a; }
  .sc-check { color: #16a34a; }
}

.reuse-tray {
  max-height: 264px;
  overflow-y: auto;
  border: 1px solid rgba(132, 120, 250, 0.18);
  border-radius: 12px;
  background: #fcfbff;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.tray-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.th-title { font-size: $fs-md; font-weight: $fw-semibold; color: $text-display; }
.th-collapse { border: 0; background: transparent; color: $text-muted; font-size: $fs-xs; cursor: pointer; }
.tray-list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.tray-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid $border;
  border-radius: 10px;
  background: #fff;
  .ti-no { font-size: $fs-sm; font-weight: $fw-bold; color: #cabfe8; font-family: 'SF Mono', Monaco, monospace; }
  .ti-text { flex: 1; min-width: 0; font-size: $fs-md; color: #3b414c; }
  .ti-send {
    flex-shrink: 0;
    padding: 3px 10px;
    border: 0;
    border-radius: 7px;
    background: rgba(132, 120, 250, 0.12);
    color: $aurora-purple;
    font-size: $fs-xs;
    font-weight: $fw-semibold;
    font-family: inherit;
    cursor: pointer;
    &.sent { background: $bg-tertiary; color: $text-muted; cursor: default; }
  }
}
.tray-all {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: $gradient-aurora;
  color: #fff;
  font-size: $fs-md;
  font-weight: $fw-semibold;
  font-family: inherit;
  cursor: pointer;
}
</style>
