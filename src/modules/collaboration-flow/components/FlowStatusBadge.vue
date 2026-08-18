<template>
  <span class="flow-status-badge" :style="badgeStyle">{{ meta.text }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { getStatusMeta } from '../utils/flowStatus.mjs'

defineOptions({ name: 'FlowStatusBadge' })

const props = defineProps({
  status: { type: String, default: '' },
})

const meta = computed(() => getStatusMeta(props.status))
const badgeStyle = computed(() => ({
  color: meta.value.color,
  background: meta.value.background,
}))
</script>

<style scoped>
.flow-status-badge {
  flex-shrink: 0;
  height: 20px;
  padding: 0 7px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}
</style>
