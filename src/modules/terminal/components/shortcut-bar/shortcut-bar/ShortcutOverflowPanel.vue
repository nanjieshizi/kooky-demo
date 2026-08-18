<template>
  <Teleport to="body">
    <div v-if="visible" class="overflow-mask" @mousedown="$emit('update:visible', false)" />
    <Transition name="panel-fade">
      <div v-if="visible" class="overflow-panel" :style="panelStyle">
        <div
          v-for="(cmd, idx) in localList"
          :key="cmd.id"
          class="overflow-item"
          :class="{ 'drag-over': dragOverIdx === idx }"
          @click="$emit('click', cmd)"
        >
          <span
            class="drag-handle"
            draggable="true"
            @dragstart.stop="onDragStart(idx, $event)"
            @dragover.prevent="onDragOver(idx)"
            @drop.prevent="onDrop(idx)"
            @dragend="onDragEnd"
          >⠿</span>
          <span class="item-dot" :style="{ background: cmd.color || '#f9a825' }" />
          <span class="item-label">{{ cmd.label }}</span>
          <span class="item-command">{{ cmd.command || '没有' }}</span>
          <button class="item-delete" @click.stop="handleDelete(cmd)">×</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  commands: { type: Array, default: () => [] },
  anchorRect: { type: Object, default: null },
})

const emit = defineEmits(['update:visible', 'click', 'delete', 'reorder'])

const localList = ref([])
const dragFromIdx = ref(-1)
const dragOverIdx = ref(-1)

watch(() => props.commands, (v) => {
  localList.value = [...v]
}, { immediate: true, deep: true })

const panelStyle = computed(() => {
  if (!props.anchorRect) return { bottom: '60px', right: '16px' }
  return {
    bottom: `${window.innerHeight - props.anchorRect.top + 8}px`,
    right: `${window.innerWidth - props.anchorRect.right}px`,
  }
})

function onDragStart(idx, e) {
  dragFromIdx.value = idx
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(idx) {
  dragOverIdx.value = idx
}

function onDrop(idx) {
  if (dragFromIdx.value === -1 || dragFromIdx.value === idx) return
  const list = [...localList.value]
  const [moved] = list.splice(dragFromIdx.value, 1)
  list.splice(idx, 0, moved)
  localList.value = list
  emit('reorder', list)
  dragFromIdx.value = -1
  dragOverIdx.value = -1
}

function onDragEnd() {
  dragFromIdx.value = -1
  dragOverIdx.value = -1
}

function handleDelete(cmd) {
  emit('delete', cmd)
}
</script>

<style scoped>
.overflow-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.overflow-panel {
  position: fixed;
  z-index: 9999;
  min-width: 280px;
  max-width: 420px;
  max-height: 360px;
  overflow-y: auto;
  background: rgba(35, 35, 40, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.overflow-panel::-webkit-scrollbar {
  width: 4px;
}

.overflow-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  transition: background 0.12s;
}

.overflow-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.overflow-item.drag-over {
  background: rgba(64, 158, 255, 0.15);
}

.drag-handle {
  cursor: grab;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
  user-select: none;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
}

.item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-command {
  color: rgba(255, 255, 255, 0.4);
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.item-delete {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.12s;
}

.item-delete:hover {
  color: #f56c6c;
}

/* 过渡动画 */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
