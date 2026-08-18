<template>
  <div class="flow-node" :class="[{ 'flow-node--compact': compact }, `flow-node--${tone}`]">
    <div class="flow-node__title-row">
      <span v-if="compact" class="flow-node__dot" :style="{ background: meta.color }"></span>
      <OverflowTooltipText :text="node.nodeName" custom-class="flow-node__title" />
    </div>
    <div v-if="node.nodeContent" class="flow-node__content">{{ node.nodeContent }}</div>
    <FlowExecutors :executors="node.executors" :show-status="showExecutorStatus" />
    <FlowVoteResult :node="node" />
    <FlowAttachmentList :attachments="attachments" :space-id="conversationId" />
    <FlowNodeTime :node="node" />
    <!-- demo 增量：宿主可注入行内操作（如「⚡ 分派到 Kode」），生产无 slot 内容时不渲染 -->
    <slot name="actions" :node="node" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OverflowTooltipText from '@/shared/components/OverflowTooltipText.vue'
import FlowAttachmentList from './FlowAttachmentList.vue'
import FlowExecutors from './FlowExecutors.vue'
import FlowNodeTime from './FlowNodeTime.vue'
import FlowVoteResult from './FlowVoteResult.vue'
import { getNodeAttachments } from '../utils/flowNodePayload.mjs'
import { getNodeStatusMeta } from '../utils/flowStatus.mjs'

defineOptions({ name: 'FlowNodeItem' })

const props = defineProps({
  node: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  conversationId: { type: [String, Number], default: '' },
})

const attachments = computed(() => getNodeAttachments(props.node))
const meta = computed(() => getNodeStatusMeta(props.node))
const tone = computed(() => (
  ['skipped', 'cancelled'].includes(props.node?.nodeStatus) ? 'muted' : 'normal'
))
const showExecutorStatus = computed(() => !['skipped', 'cancelled'].includes(props.node?.nodeStatus))
</script>

<style scoped>
.flow-node {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 12px;
}

.flow-node__title-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.flow-node__dot {
  width: 4px;
  height: 4px;
  flex-shrink: 0;
  border-radius: 50%;
}

.flow-node :deep(.flow-node__title) {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: #2F3547;
}

.flow-node--compact :deep(.flow-node__title) {
  font-size: 12px;
  line-height: 20px;
}

.flow-node__content {
  font-size: 12px;
  line-height: 20px;
  color: #606572;
}

.flow-node--muted :deep(.flow-node__title),
.flow-node--muted .flow-node__content {
  color: #91949E;
}
</style>
