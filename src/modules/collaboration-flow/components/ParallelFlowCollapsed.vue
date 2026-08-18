<template>
  <div class="parallel-collapsed">
    <button type="button" class="parallel-collapsed__head" @click="$emit('toggle')">
      <span class="parallel-collapsed__title">并行任务  {{ count }}项</span>
      <SvgIcon name="icon-xia-2" :size="12" color="currentColor" class="parallel-collapsed__arrow" />
    </button>
    <div class="parallel-collapsed__card">
      <OverflowTooltipText :text="node.nodeName" custom-class="parallel-collapsed__card-title" />
      <div
        v-for="(child, index) in sortedChildren"
        :key="child.nodeKey || child.id"
        class="parallel-collapsed__child"
      >
        <span class="parallel-collapsed__dot" :style="{ background: getNodeStatusMeta(child).color }"></span>
        <OverflowTooltipText :text="`任务${index + 1} ${child.nodeName}`" custom-class="parallel-collapsed__child-title" />
      </div>
    </div>
    <FlowNodeTime :node="node" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import FlowNodeTime from './FlowNodeTime.vue'
import { getNodeStatusMeta, sortFlowNodes } from '../utils/flowStatus.mjs'

defineOptions({ name: 'ParallelFlowCollapsed' })

const props = defineProps({
  node: { type: Object, required: true },
})

defineEmits(['toggle'])

const sortedChildren = computed(() => sortFlowNodes(props.node.subNodes || []))
const count = computed(() => sortedChildren.value.length)
</script>

<style scoped>
.parallel-collapsed {
  min-width: 0;
  padding-bottom: 12px;
}

.parallel-collapsed__head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 0;
  color: #2F3547;
  cursor: pointer;
}

.parallel-collapsed__title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.parallel-collapsed__arrow {
  flex-shrink: 0;
}

.parallel-collapsed__card {
  margin: 5px 0 4px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #F5F6FA;
}

.parallel-collapsed :deep(.parallel-collapsed__card-title) {
  font-size: 12px;
  line-height: 18px;
  color: #2F3547;
}

.parallel-collapsed__child {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-top: 5px;
}

.parallel-collapsed__dot {
  width: 4px;
  height: 4px;
  flex-shrink: 0;
  border-radius: 50%;
}

.parallel-collapsed :deep(.parallel-collapsed__child-title) {
  font-size: 12px;
  line-height: 18px;
  color: #606572;
}
</style>
