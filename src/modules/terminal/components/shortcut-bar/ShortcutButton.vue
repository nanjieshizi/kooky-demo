<template>
  <div
    class="shortcut-btn-wrapper"
    :class="{ dragging, 'drag-over': dragOver }"
    draggable="true"
    @dragstart="$emit('drag-start', item)"
    @dragover.prevent="$emit('drag-over', item)"
    @drop.prevent="$emit('drop', item)"
    @click="$emit('click', item)"
    @contextmenu.prevent="$emit('contextmenu', { event: $event, item })"
  >
    <span class="color-dot" :style="{ background: item.color || '#f9a825' }" />
    <span class="btn-label">{{ item.label }}</span>
    <button
      class="delete-x"
      @click.stop="$emit('delete', item)"
      title="删除"
    >×</button>
  </div>
</template>

<script setup>
defineProps({
  item: { type: Object, required: true },
  dragging: { type: Boolean, default: false },
  dragOver: { type: Boolean, default: false },
})

defineEmits(['click', 'contextmenu', 'delete', 'drag-start', 'drag-over', 'drop'])
</script>

<style scoped>
.shortcut-btn-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 26px;
  border-radius: 6px;
  background: var(--bar-btn-bg, #2B2B2C);
  border: 0.6px solid var(--bar-btn-border, #414141);
  color: var(--bar-btn-text, rgba(255, 255, 255, 0.85));
  font-size: 13px;
  cursor: grab;
  user-select: none;
  white-space: nowrap;
  max-width: 160px;
  transition: background 0.15s, box-shadow 0.15s, opacity 0.15s;
  flex-shrink: 0;
}

.shortcut-btn-wrapper:hover {
  background: var(--bar-btn-hover-bg, rgba(255, 255, 255, 0.14));
}

.shortcut-btn-wrapper:active {
  background: var(--bar-btn-active-bg, var(--bar-btn-bg, #2B2B2C));
  cursor: grabbing;
}

.shortcut-btn-wrapper.dragging {
  opacity: 0.4;
}

.shortcut-btn-wrapper.drag-over {
  box-shadow: 0 0 0 2px #409eff;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
}

.btn-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.delete-x {
  position: absolute;
  top: -6px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: #91949E;
  color: var(--delete-x-color, #2B2B2C);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.shortcut-btn-wrapper:hover .delete-x {
  opacity: 1;
}
</style>
