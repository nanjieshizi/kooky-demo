<template>
  <section class="gf-list-panel" aria-label="群内任务">
    <header class="gfl-head">
      <span class="gfl-title">群内任务</span>
      <button type="button" class="gfl-close" aria-label="关闭" @click="emit('close')">
        <SvgIcon name="icon-guanbi1" :size="16" />
      </button>
    </header>

    <div class="gfl-body">
      <div v-if="!tasks.length" class="gfl-empty">本群还没有任务</div>
      <template v-else>
        <section v-for="group in groups" :key="group.status" class="gfl-group">
          <div class="gfl-group-head">
            <span class="gfl-group-label">{{ statusText(group.status) }}</span>
            <span class="gfl-group-count">{{ group.tasks.length }}</span>
          </div>
          <button
            v-for="task in group.tasks"
            :key="task.id"
            type="button"
            class="gfl-file gfl-task"
            :class="{ active: task.id === activeTaskId }"
            @click="emit('open-task', task)"
          >
            <span class="gfl-task-icon" aria-hidden="true">{{ task.icon || '📋' }}</span>
            <span class="gfl-file-name" :title="task.title">{{ task.title || '未命名任务' }}</span>
            <span class="gfl-pill" :class="`gfl-pill--${task.status}`">{{ statusText(task.status) }}</span>
          </button>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { taskStatusText } from './taskStatus'

defineOptions({ name: 'GroupTasksListPanel' })

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  activeTaskId: { type: [String, Number], default: '' },
})

const emit = defineEmits(['open-task', 'close'])

const STATUS_ORDER = ['active', 'waiting_approval', 'blocked', 'failed', 'completed', 'cancelled']

// 按状态分组，保留固定状态顺序
const groups = computed(() => {
  const byStatus = new Map()
  props.tasks.forEach((task) => {
    const status = task.status || 'active'
    if (!byStatus.has(status)) byStatus.set(status, [])
    byStatus.get(status).push(task)
  })
  return STATUS_ORDER
    .filter((status) => byStatus.has(status))
    .map((status) => ({ status, tasks: byStatus.get(status) }))
})

function statusText(status) {
  return taskStatusText(status)
}
</script>

<style scoped>
.gf-list-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.gfl-head {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #f0f1f5;
}

.gfl-title {
  font-family: PingFang SC, sans-serif;
  font-size: 14px;
  color: #2f3547;
}

.gfl-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: #91949e;
  transition: background 0.15s;
}

.gfl-close:hover {
  background: rgba(47, 53, 71, 0.06);
}

.gfl-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0 12px;
}

.gfl-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: #b6b9c2;
}

.gfl-group + .gfl-group {
  margin-top: 8px;
  border-top: 1px solid #f5f6f8;
  padding-top: 8px;
}

.gfl-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
}

.gfl-group-label {
  font-size: 12px;
  color: #91949e;
}

.gfl-group-count {
  margin-left: auto;
  font-size: 11px;
  color: #b6b9c2;
}

.gfl-file {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.gfl-file:hover {
  background: rgba(47, 53, 71, 0.04);
}

.gfl-file.active {
  background: rgba(67, 111, 246, 0.08);
}

.gfl-task-icon {
  flex-shrink: 0;
  width: 18px;
  font-size: 15px;
  line-height: 1;
  text-align: center;
}

.gfl-file-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gfl-pill {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 8px;
  color: #2f76ff;
  background: #e9f2ff;
}

.gfl-pill--waiting_approval {
  color: #f58138;
  background: #fff1e8;
}

.gfl-pill--completed {
  color: #17a66a;
  background: #e9f8f0;
}

.gfl-pill--failed,
.gfl-pill--cancelled {
  color: #ff4d4f;
  background: #fff0f0;
}

.gfl-pill--blocked {
  color: #8b95a5;
  background: #f1f3f6;
}
</style>
