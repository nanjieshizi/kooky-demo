<template>
  <div class="parallel-expanded">
    <button type="button" class="parallel-expanded__head" @click="$emit('toggle')">
      <span class="parallel-expanded__title">并行任务</span>
      <SvgIcon name="icon-xia" :size="12" color="currentColor" class="parallel-expanded__arrow" />
    </button>
    <FlowNodeItem
      v-for="child in sortedChildren"
      :key="child.nodeKey || child.id"
      :node="child"
      :conversation-id="conversationId"
      compact
    >
      <template #actions="slotProps">
        <slot name="actions" :node="slotProps.node" />
      </template>
    </FlowNodeItem>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import FlowNodeItem from './FlowNodeItem.vue'
import { sortFlowNodes } from '../utils/flowStatus.mjs'

defineOptions({ name: 'ParallelFlowExpanded' })

const props = defineProps({
  node: { type: Object, required: true },
  conversationId: { type: [String, Number], default: '' },
})

defineEmits(['toggle'])

const sortedChildren = computed(() => sortFlowNodes(props.node.subNodes || []))
</script>

<style scoped>
.parallel-expanded {
  min-width: 0;
}

.parallel-expanded__head {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 0;
  color: #2F3547;
  cursor: pointer;
}

.parallel-expanded__title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.parallel-expanded__arrow {
  flex-shrink: 0;
}
</style>
