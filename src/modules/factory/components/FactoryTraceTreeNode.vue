<template>
  <div>
    <div
      class="tree-node"
      :class="{ active: isActive }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="onClick"
    >
      <span
        class="node-dot"
        :class="{ active: isActive, kb: node.kind === 'kb' }"
      ></span>
      <span class="node-name" :class="{ active: isActive }">{{ node.name }}</span>
      <span class="node-time">{{ node.duration }}</span>
    </div>
    <FactoryTraceTreeNode
      v-for="child in node.children || []"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :active-id="activeId"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ name: 'FactoryTraceTreeNode' })

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  activeId: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const isActive = computed(() => props.activeId === props.node.id)

function onClick() {
  emit('select', props.node.id)
}
</script>

<style lang="scss" scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;

  &:hover {
    background: #f7f7f8;
  }

  &.active {
    background: rgba(99, 102, 241, 0.08);
  }
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #9ca3af;

  &.kb {
    background: #6366f1;
    opacity: 0.6;
  }

  &.active {
    background: #6366f1;
    opacity: 1;
  }
}

.node-name {
  flex: 1;
  font-size: 12px;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.active {
    color: #6366f1;
    font-weight: 500;
  }
}

.node-time {
  font-size: 10px;
  color: #9ca3af;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  flex-shrink: 0;
}
</style>
