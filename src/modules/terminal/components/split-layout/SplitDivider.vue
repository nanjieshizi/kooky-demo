<template>
  <div
    class="split-divider"
    :class="direction"
    :style="{
      background: theme?.paneSplitDivider || 'rgba(255, 255, 255, 0.08)'
    }"
    @mousedown.prevent="onMouseDown"
  />
</template>

<script setup>
const props = defineProps({
  direction: { type: String, required: true },
  splitId: { type: String, required: true },
  dividerIndex: { type: Number, required: true },
  sizes: { type: Array, required: true },
  containerRef: { type: Object, default: null },
  theme: { type: Object, default: null },
})

const emit = defineEmits(['resize'])

const SPLIT_DIVIDER_DRAG_START = 'claude-split-divider-drag-start'
const SPLIT_DIVIDER_DRAG_END = 'claude-split-divider-drag-end'

function onMouseDown(event) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SPLIT_DIVIDER_DRAG_START))
  }

  const startSizes = [...props.sizes]
  const isHorizontal = props.direction === 'horizontal'
  const startPos = isHorizontal ? event.clientX : event.clientY

  function onMove(e) {
    const container = props.containerRef
    if (!container) return
    const pos = isHorizontal ? e.clientX : e.clientY
    const delta = pos - startPos
    const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight
    if (containerSize === 0) return

    const deltaPercent = (delta / containerSize) * 100
    const i = props.dividerIndex
    const j = props.dividerIndex + 1
    const total = startSizes[i] + startSizes[j]

    const newI = Math.max(10, Math.min(total - 10, startSizes[i] + deltaPercent))
    const newSizes = [...startSizes]
    newSizes[i] = newI
    newSizes[j] = total - newI

    emit('resize', props.splitId, newSizes)
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SPLIT_DIVIDER_DRAG_END))
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.split-divider {
  flex-shrink: 0;
  transition: background 0.15s;
  z-index: 10;
}
.split-divider:hover,
.split-divider:active {
  background: rgba(137, 180, 250, 0.5);
}
.split-divider.horizontal {
  width: 1px;
  cursor: col-resize;
}
.split-divider.vertical {
  height: 1px;
  cursor: row-resize;
}
</style>
