<template>
  <button type="button" class="work-card" @click="openInWarRoom">
    <div class="work-card__bar" aria-hidden="true"></div>

    <div class="work-card__head">
      <span class="work-card__title">{{ title }}</span>
      <span class="work-card__status" :class="statusClass">
        <span v-if="isBusy" class="wc-spinner" aria-hidden="true"></span>
        {{ statusText }}
      </span>
    </div>

    <div v-if="todos.length" class="work-card__steps">
      <div v-for="(t, i) in todos" :key="i" class="wc-step" :class="stepClass(t.status)">
        <span class="wc-step__mark" aria-hidden="true">
          <svg v-if="t.status === 'completed'" width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span v-else-if="t.status === 'in_progress'" class="wc-spinner wc-spinner--sm"></span>
        </span>
        <span class="wc-step__text">{{ t.content }}</span>
      </div>
    </div>

    <div class="work-card__toggle">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      <span>在专项作战室看工作流 · 思考 / 工具 / Todo →</span>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { getExecTrace, focusWorkMember } from '../../demo/onePersonDirector'

defineOptions({ name: 'OnePersonWorkCard' })

const props = defineProps({
  payload: { type: Object, default: () => ({}) },
  teamId: { type: [String, Number], default: '' },
})

const store = useSidePanelStore()
const trace = computed(() => getExecTrace(props.payload?.task_id, props.payload?.member_id))
const title = computed(() => props.payload?.title || '工作')
// 无实时 trace（静态预置会话）时，从 payload 的 status / steps 兜底
const todos = computed(() => trace.value?.todos || props.payload?.steps || [])
const isBusy = computed(() => (trace.value ? Boolean(trace.value.busy) : props.payload?.status === 'running'))
const isDone = computed(() => (trace.value ? Boolean(trace.value.done) : props.payload?.status === 'done'))
const statusText = computed(() => (isDone.value ? '完成' : isBusy.value ? '执行中' : '待执行'))
const statusClass = computed(() => (isDone.value ? 'is-done' : isBusy.value ? 'is-busy' : ''))

function stepClass(status) {
  if (status === 'completed') return 'is-completed'
  if (status === 'in_progress') return 'is-active'
  return ''
}

// 点工作卡 = 打开专项作战室 + 聚焦该员工，工作流在作战室下方展开（与点工位同一性质）
function openInWarRoom() {
  focusWorkMember(props.teamId, props.payload?.member_id)
  store.open('office')
}
</script>

<style scoped>
.work-card {
  display: block;
  text-align: left;
  width: 100%;
  max-width: 420px;
  margin-top: 8px;
  padding: 0;
  border: 0.5px solid var(--kk-border-soft, #eceef3);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(31, 35, 41, 0.05);
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.work-card:hover { box-shadow: 0 4px 14px rgba(31, 35, 41, 0.09); transform: translateY(-1px); }
.work-card__bar { height: 3px; background: linear-gradient(90deg, #ff9a5a, #ff621f 55%, #ff8a4c); }
.work-card__head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; }
.work-card__title { font-size: 12.5px; font-weight: 600; color: #2f3547; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.work-card__status {
  margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; padding: 2px 9px; border-radius: 999px; color: #8b95a5; background: #f1f3f6;
}
.work-card__status.is-busy { color: #ff621f; background: #fff1ea; }
.work-card__status.is-done { color: #17a66a; background: #e9f8f0; }

.work-card__steps { display: flex; flex-direction: column; gap: 5px; padding: 0 12px 10px; }
.wc-step { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8c93a6; }
.wc-step.is-completed { color: #2f3547; }
.wc-step.is-active { color: #436ff6; }
.wc-step__mark {
  width: 14px; height: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%; border: 1.5px solid #d1d5db; box-sizing: border-box;
}
.wc-step.is-completed .wc-step__mark { border-color: #22c55e; background: #22c55e; color: #fff; }
.wc-step.is-active .wc-step__mark { border-color: #436ff6; }
.wc-step__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.work-card__toggle {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border-top: 0.5px solid var(--kk-border-soft, #f0f1f5);
  color: #ff621f; font-size: 11.5px;
}

.wc-spinner {
  width: 11px; height: 11px; border-radius: 50%;
  border: 1.6px solid currentColor; border-top-color: transparent;
  display: inline-block; animation: wc-spin 0.7s linear infinite;
}
.wc-spinner--sm { width: 9px; height: 9px; border-width: 1.4px; }
@keyframes wc-spin { to { transform: rotate(360deg); } }
</style>
