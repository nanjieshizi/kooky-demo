<script setup>
import { inject, computed } from 'vue'
import { KODE_STATE_KEY } from '../composables/useKodeState.js'

// IDE / CLI 的失效页：这俩全靠 cwd（文件树 / 编辑器 / 终端），目录没了就整块换成这个。
// 区别于「空目录」——空目录能建文件，这是路径根本不存在，所以要说清楚。
const props = defineProps({ scope: { type: String, default: 'ide' } }) // ide | cli
const state = inject(KODE_STATE_KEY)
const { selectedWorkspace } = state

const title = computed(() => (props.scope === 'cli' ? '终端不可用' : '编辑器不可用'))
const desc = computed(() =>
  props.scope === 'cli'
    ? '工作区目录不存在，无法进入该目录起终端。'
    : '工作区目录不存在，没有可打开的文件树和代码。',
)
</script>

<template>
  <div class="ws-missing-view">
    <div class="wmv-inner">
      <div class="wmv-ico">🗂️</div>
      <div class="wmv-title">{{ title }}</div>
      <div class="wmv-desc">{{ desc }}</div>
      <code class="wmv-path">{{ selectedWorkspace?.cwd }}</code>
      <div class="wmv-hint">把目录移回原位后会自动恢复；或在真实工程里为该工作区重指路径。</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../styles.scss' as *;

.ws-missing-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-secondary;
}
.wmv-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  text-align: center;
  padding: 24px;
}
.wmv-ico { font-size: 40px; opacity: 0.5; margin-bottom: 4px; }
.wmv-title { font-size: 17px; font-weight: $fw-semibold; color: $text-display; }
.wmv-desc { font-size: $fs-lg; color: $text-muted; line-height: 1.5; }
.wmv-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: $fs-sm;
  color: #b91c3c;
  background: rgba(225, 29, 72, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
  word-break: break-all;
}
.wmv-hint { font-size: $fs-sm; color: $text-faint; line-height: 1.5; margin-top: 4px; }
</style>
