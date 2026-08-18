<template>
  <ParallelFlowExpanded v-if="expanded" :node="node" :conversation-id="conversationId" @toggle="expanded = false">
    <template #actions="slotProps">
      <slot name="actions" :node="slotProps.node" />
    </template>
  </ParallelFlowExpanded>
  <ParallelFlowCollapsed v-else :node="node" @toggle="expanded = true" />
</template>

<script setup>
import { ref, watch } from 'vue'
import ParallelFlowCollapsed from './ParallelFlowCollapsed.vue'
import ParallelFlowExpanded from './ParallelFlowExpanded.vue'
import { shouldDefaultExpandParallelNode } from '../utils/flowStatus.mjs'

defineOptions({ name: 'ParallelFlowNode' })

const props = defineProps({
  node: { type: Object, required: true },
  conversationId: { type: [String, Number], default: '' },
})

const expanded = ref(shouldDefaultExpandParallelNode(props.node))

watch(
  () => props.node,
  (node) => {
    expanded.value = shouldDefaultExpandParallelNode(node)
  },
)
</script>
