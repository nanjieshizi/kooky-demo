<template>
  <!-- 分割节点：渲染子节点 + 分割条 -->
  <div
    v-if="node.type === 'split'"
    :key="`split-${node.id}`"
    ref="containerRef"
    class="split-node"
    :class="node.direction"
  >
    <!-- display:contents 让子项直接参与父 flex，避免 <template v-for> 多根 key 与协调问题 -->
    <div
      v-for="(child, idx) in node.children"
      :key="child.id"
      class="split-node-fragment"
    >
      <SplitNode
        :node="child"
        :style="childStyles[idx]"
        :active-leaf-id="activeLeafId"
        :drag-state="dragState"
        :is-single-pane="isSinglePane"
        :theme="theme"
        @resize="(splitId, sizes) => emit('resize', splitId, sizes)"
        @move-leaf="(payload) => emit('move-leaf', payload)"
        @set-active="(id) => emit('set-active', id)"
        @remove-leaf="(id) => emit('remove-leaf', id)"
        @start-drag="(id) => emit('start-drag', id)"
        @end-drag="emit('end-drag')"
      >
        <template #pane-header="slotProps">
          <slot name="pane-header" v-bind="slotProps" />
        </template>
        <template #leaf="slotProps">
          <slot name="leaf" v-bind="slotProps" />
        </template>
      </SplitNode>
      <SplitDivider
        v-if="idx < node.children.length - 1"
        :direction="node.direction"
        :split-id="node.id"
        :divider-index="idx"
        :sizes="node.sizes"
        :container-ref="containerRef"
        :theme="theme"
        @resize="(id, sizes) => emit('resize', id, sizes)"
      />
    </div>
  </div>

  <!-- 叶子节点：渲染终端面板 -->
  <div
    v-else
    :key="`leaf-${node.id}`"
    class="split-leaf"
    :class="{
      active: activeLeafId === node.id,
      'drag-over': isDragOver,
      'is-single-pane': isSinglePane,
    }"
    @mousedown="emit('set-active', node.id)"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @mouseup="onMouseUp"
  >
    <!-- 拖拽放置区指示器 -->
    <div
      v-if="dropPosition && dragState && dragState.leafId !== node.id"
      class="drop-indicator"
      :class="dropPosition"
    />

    <!-- 面板头部：单面板也保留，保证终端标题始终可见 -->
    <div
      class="split-pane-header"
      :style="{
        background: theme?.paneTitleBg || 'rgba(0, 0, 0, 0.2)',
        borderBottom: `1px solid ${theme?.paneSplitDivider || 'rgba(255, 255, 255, 0.08)'}`,
        '--close-color': theme?.paneCloseColor || 'rgba(255, 255, 255, 0.4)',
        '--close-hover-bg': theme?.paneCloseHoverBg || 'rgba(255, 255, 255, 0.1)',
        '--close-hover-color': theme?.paneCloseHoverColor || 'rgba(255, 255, 255, 0.95)',
      }"
      @mousedown.stop="onHeaderMouseDown"
    >
      <slot name="pane-header" :leaf-id="node.id" :panel-id="node.panelId" />
      <button class="pane-close" @mousedown.stop @click.stop="emit('remove-leaf', node.id)" title="关闭">✕</button>
    </div>

    <!-- 叶子内容（终端） -->
    <div class="split-leaf-content">
      <NotificationRing :panel-id="node.panelId" :active="activeLeafId === node.id">
        <slot name="leaf" :leaf-id="node.id" :panel-id="node.panelId" />
      </NotificationRing>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import SplitDivider from './SplitDivider.vue'
import NotificationRing from '@/modules/terminal/components/NotificationRing.vue'

defineOptions({ name: 'SplitNode' })

const props = defineProps({
  node: { type: Object, required: true },
  activeLeafId: { type: String, default: null },
  dragState: { type: Object, default: null },
  isSinglePane: { type: Boolean, default: false },
  theme: { type: Object, default: null },
})

const emit = defineEmits([
  'resize', 'move-leaf', 'set-active',
  'remove-leaf', 'start-drag', 'end-drag',
])

const containerRef = ref(null)
const dropPosition = ref(null)
let currentMouseUpHandler = null
const isDragOver = computed(() =>
  !!dropPosition.value && !!props.dragState && props.dragState.leafId !== props.node.id
)

const childStyles = computed(() => {
  const { sizes, children, direction } = props.node
  return children.map((_, idx) => {
    const size = sizes?.[idx] ?? (100 / children.length)
    // 与 .split-node 的 flex:1 不同：作为分割子项必须用 grow/shrink 比例分配空间，
    // 否则 flex-basis:0 会压过单独的 width/height%，拖拽比例不生效，xterm ResizeObserver 也不会触发。
    return direction === 'horizontal'
      ? { flex: `${size} ${size} 0px`, minWidth: 0, minHeight: 0, overflow: 'hidden' }
      : { flex: `${size} ${size} 0px`, minWidth: 0, minHeight: 0, overflow: 'hidden' }
  })
})

function getDropPosition(event, el) {
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const w = rect.width
  const h = rect.height
  if (y < h * 0.25) return 'top'
  if (y > h * 0.75) return 'bottom'
  if (x < w * 0.25) return 'left'
  if (x > w * 0.75) return 'right'
  return null
}

function onHeaderMouseDown(event) {
  emit('set-active', props.node.id)
  emit('start-drag', props.node.id)

  // 拖拽开始后监听全局 mousemove/mouseup
  function onGlobalMouseUp() {
    emit('end-drag')
    document.removeEventListener('mouseup', onGlobalMouseUp)
    if (currentMouseUpHandler === onGlobalMouseUp) {
      currentMouseUpHandler = null
    }
  }
  currentMouseUpHandler = onGlobalMouseUp
  document.addEventListener('mouseup', onGlobalMouseUp)
}

onUnmounted(() => {
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
})

function onMouseMove(event) {
  if (!props.dragState || props.dragState.leafId === props.node.id) {
    dropPosition.value = null
    return
  }
  dropPosition.value = getDropPosition(event, event.currentTarget)
}

function onMouseLeave() {
  dropPosition.value = null
}

function onMouseUp(event) {
  if (!props.dragState || props.dragState.leafId === props.node.id) return
  const pos = getDropPosition(event, event.currentTarget)
  dropPosition.value = null
  if (!pos) return
  emit('move-leaf', { fromId: props.dragState.leafId, toId: props.node.id, position: pos })
  emit('end-drag')
}
</script>

<style scoped>
.split-node {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.split-node.horizontal { flex-direction: row; }
.split-node.vertical   { flex-direction: column; }

.split-node-fragment {
  display: contents;
}

.split-leaf {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
/* 多面板时：outline 易被裁切或落在 xterm 下，用伪元素内描边。单面板不画（否则上下边与 tab/容器接缝会露出细线） */
.split-leaf.active {
  outline: none;
}
.split-leaf.active:not(.is-single-pane)::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(137, 180, 250, 0.3);
  pointer-events: none;
  z-index: 10;
  box-sizing: border-box;
}

.split-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.2);
  min-height: 32px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}
.split-pane-header:active { cursor: grabbing; }

.pane-close {
  border: none;
  background: transparent;
  color: var(--close-color, rgba(255, 255, 255, 0.4));
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.pane-close:hover {
  background: var(--close-hover-bg, rgba(255, 255, 255, 0.1));
  color: var(--close-hover-color, rgba(255, 255, 255, 0.95));
}

.split-leaf-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* 拖拽放置区指示器 — 细线风格 */
.drop-indicator {
  position: absolute;
  pointer-events: none;
  background: rgba(137, 180, 250, 0.85);
  z-index: 100;
  border-radius: 2px;
  transition: all 0.08s ease;
}
.drop-indicator.top    { top: 0; left: 4px; right: 4px; height: 3px; }
.drop-indicator.bottom { bottom: 0; left: 4px; right: 4px; height: 3px; }
.drop-indicator.left   { top: 4px; left: 0; bottom: 4px; width: 3px; }
.drop-indicator.right  { top: 4px; right: 0; bottom: 4px; width: 3px; }
</style>
