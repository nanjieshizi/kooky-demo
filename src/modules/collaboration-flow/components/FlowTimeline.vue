<template>
  <div class="flow-timeline">
    <div
      v-for="(node, index) in sortedNodes"
      :key="node.nodeKey || node.id"
      class="flow-timeline__item"
    >
      <div class="flow-timeline__rail">
        <SvgIcon
          v-if="isParallelNode(node)"
          name="icon-renwu-binghang"
          :size="16"
          color="currentColor"
          class="flow-timeline__parallel-icon"
        />
        <FlowStatusIcon v-else :status="node.nodeStatus" :deadline-status="node.deadlineStatus" />
        <span v-if="index < sortedNodes.length - 1" class="flow-timeline__line"></span>
      </div>
      <div class="flow-timeline__content">
        <ParallelFlowNode v-if="isParallelNode(node)" :node="node" :conversation-id="conversationId">
          <template #actions="slotProps">
            <slot name="actions" :node="slotProps.node" />
          </template>
        </ParallelFlowNode>
        <FlowNodeItem v-else :node="node" :conversation-id="conversationId">
          <template #actions="slotProps">
            <slot name="actions" :node="slotProps.node" />
          </template>
        </FlowNodeItem>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import FlowNodeItem from './FlowNodeItem.vue'
import FlowStatusIcon from './FlowStatusIcon.vue'
import ParallelFlowNode from './ParallelFlowNode.vue'
import { isParallelNode, sortFlowNodes } from '../utils/flowStatus.mjs'

defineOptions({ name: 'FlowTimeline' })

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  conversationId: { type: [String, Number], default: '' },
})

const sortedNodes = computed(() => sortFlowNodes(props.nodes))
</script>

<style scoped>
.flow-timeline {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding-top: 8px;
  padding-right: 12px;
  margin-right: -12px;
  overflow-y: auto;
  overflow-x: hidden;
}

.flow-timeline__item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 8px;
  min-width: 0;
}

.flow-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.flow-timeline__line {
  position: absolute;
  top: 20px;
  bottom: -2px;
  left: 8px;
  width: 1px;
  background: #E6E9EF;
}

.flow-timeline__parallel-icon {
  color: #3490F9;
  flex-shrink: 0;
}

.flow-timeline__content {
  min-width: 0;
}
</style>
