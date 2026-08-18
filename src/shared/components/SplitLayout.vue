<template>
  <div class="split-layout" v-if="root">
    <SplitNode
      :node="root"
      :active-leaf-id="activeLeafId"
      :drag-state="dragState"
      :is-single-pane="isSinglePane"
      :theme="theme"
      @resize="(splitId, sizes) => emit('resize', splitId, sizes)"
      @move-leaf="(payload) => emit('move-leaf', payload.fromId, payload.toId, payload.position)"
      @set-active="(id) => emit('set-active', id)"
      @remove-leaf="(leafId) => emit('remove-leaf', leafId)"
      @start-drag="onLeafPaneDragStart"
      @end-drag="onLeafPaneDragEnd"
    >
      <template #pane-header="slotProps">
        <slot name="pane-header" v-bind="slotProps" />
      </template>
      <template #leaf="slotProps">
        <slot name="leaf" v-bind="slotProps" />
      </template>
    </SplitNode>
  </div>
</template>

<script setup>
import SplitNode from './SplitNode.vue'

defineOptions({ name: 'SplitLayout' })

defineProps({
  root: { type: Object, default: null },
  activeLeafId: { type: String, default: null },
  dragState: { type: Object, default: null },
  isSinglePane: { type: Boolean, default: false },
  theme: { type: Object, default: null },
})

const emit = defineEmits(['resize', 'move-leaf', 'set-active', 'remove-leaf', 'start-drag', 'end-drag'])

/** 终端块标题栏拖拽（非分割线）：供 ClaudeCodeTerminal 等在拖拽中抑制 PTY resize */
const LEAF_PANE_DRAG_START = 'claude-split-leaf-pane-drag-start'
const LEAF_PANE_DRAG_END = 'claude-split-leaf-pane-drag-end'

function onLeafPaneDragStart(leafId) {
  emit('start-drag', leafId)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEAF_PANE_DRAG_START))
  }
}

function onLeafPaneDragEnd() {
  emit('end-drag')
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEAF_PANE_DRAG_END))
  }
}
</script>

<style scoped>
.split-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
