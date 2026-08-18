<script setup>
import { useNotificationStore } from '@/modules/terminal/stores/notification'

const props = defineProps({
  workbenchs: { type: Array, default: () => [] },
  activeWorkbenchId: { type: String, default: null },
})

const emit = defineEmits(['switch', 'add', 'close', 'split-h', 'split-v'])

const notificationStore = useNotificationStore()

function unreadCount(wsId) {
  return notificationStore.unreadByWorkbench(wsId)
}
</script>

<template>
  <div class="workbench-tab-bar">
    <div class="workbench-tab-bar__tabs">
      <div
        v-for="ws in workbenchs"
        :key="ws.id"
        class="workbench-tab-item"
        :class="{ 'is-active': ws.id === activeWorkbenchId }"
        @click="emit('switch', ws.id)"
      >
        <span class="workbench-tab-item__name">{{ ws.name }}</span>
        <span v-if="unreadCount(ws.id) > 0" class="workbench-tab-item__badge">
          {{ unreadCount(ws.id) }}
        </span>
        <button class="workbench-tab-item__close" @click.stop="emit('close', ws.id)">×</button>
      </div>
      <button class="workbench-tab-add" @click="emit('add')">+</button>
    </div>
    <div class="workbench-tab-bar__actions">
      <button @click="emit('split-h')" title="垂直分屏">⫿</button>
      <button @click="emit('split-v')" title="水平分屏">⊞</button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.workbench-tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 8px;
  background: var(--tab-bar-bg, #1e1e2e);
  border-bottom: 1px solid var(--border-color, #333);

  &__tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    flex: 1;
  }

  &__actions {
    display: flex;
    gap: 4px;
    margin-left: 8px;
    button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      &:hover { background: #333; color: #fff; }
    }
  }
}

.workbench-tab-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #888;
  font-size: 13px;
  white-space: nowrap;

  &.is-active { background: #2a2a3a; color: #fff; }
  &:hover:not(.is-active) { background: #252535; }

  &__badge {
    background: #5090e0;
    color: #fff;
    font-size: 11px;
    padding: 0 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }

  &__close {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0 2px;
    font-size: 14px;
    &:hover { color: #fff; }
  }
}

.workbench-tab-add {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 10px;
  font-size: 16px;
  border-radius: 4px;
  &:hover { background: #333; color: #fff; }
}
</style>
