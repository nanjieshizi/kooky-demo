<template>
  <!-- 纯演示用的推进控制条：driven by demoState，真实后端接通后整块可摘除 -->
  <Teleport to="body">
    <div v-if="demoState.active" class="opt-demo-bar">
      <span class="opt-demo-bar__tag">演示</span>
      <span class="opt-demo-bar__status">
        {{ statusText }}
      </span>
      <button
        v-if="!demoState.finished"
        type="button"
        class="opt-demo-bar__btn"
        :disabled="demoState.running"
        @click="onAdvance"
      >
        {{ btnText }}
      </button>
      <button v-else type="button" class="opt-demo-bar__btn opt-demo-bar__btn--ghost" @click="onClose">收起</button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { demoState, advanceProductRnDDemo } from '../../demo/onePersonDirector'

defineOptions({ name: 'OnePersonDemoBar' })

const statusText = computed(() => {
  if (demoState.finished) return '流程已完成'
  if (demoState.running) return '执行中…'
  return `步骤 ${Math.min(demoState.step + 1, demoState.total)}/${demoState.total} · ${demoState.title}`
})

const btnText = computed(() => (demoState.running ? '执行中…' : '▶ 推进'))

function onAdvance() {
  if (demoState.running || demoState.finished) return
  void advanceProductRnDDemo(demoState.teamId)
}

function onClose() {
  demoState.active = false
}
</script>

<style scoped>
.opt-demo-bar {
  position: fixed;
  /* 靠左：主会话与任务面板的发送键都在各自右下角，右对齐会把它们压死 */
  left: 24px;
  bottom: 24px;
  z-index: 3000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 14px;
  border-radius: 999px;
  background: rgba(23, 27, 38, 0.92);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(6px);
  color: #fff;
}

.opt-demo-bar__tag {
  font-size: 11px;
  font-weight: 600;
  color: #ffd7a8;
  background: rgba(255, 98, 31, 0.22);
  border-radius: 4px;
  padding: 1px 6px;
}

.opt-demo-bar__status {
  font-size: 13px;
  color: #e7eaf1;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opt-demo-bar__btn {
  flex-shrink: 0;
  border: none;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #171b26;
  background: #fff;
  cursor: pointer;
}

.opt-demo-bar__btn:hover:not(:disabled) {
  background: #f1f3f6;
}

.opt-demo-bar__btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.opt-demo-bar__btn--ghost {
  color: #e7eaf1;
  background: rgba(255, 255, 255, 0.14);
}
</style>
