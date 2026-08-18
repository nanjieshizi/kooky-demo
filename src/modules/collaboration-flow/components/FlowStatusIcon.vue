<template>
  <span class="flow-status-icon" :style="{ color: meta.color }">
    <SvgIcon :name="iconName" :size="16" color="currentColor" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { getNodeStatusMeta } from '../utils/flowStatus.mjs'

defineOptions({ name: 'FlowStatusIcon' })

const props = defineProps({
  status: { type: String, default: '' },
  deadlineStatus: { type: String, default: '' },
})

const ICON_NAMES = {
  catching: 'icon-a-liucheng-zhihangzhong-default',
  wait: 'icon-a-liucheng-dengdai-default',
  skip: 'icon-liucheng-tiaoguo-default',
  overdue: 'icon-renwu-yuqi-default',
  cancel: 'icon-a-liucheng-quxiao-default',
  terminate: 'icon-liucheng-shixiao-default',
  success: 'icon-liucheng-chenggong-default',
  failed: 'icon-liucheng-shibai-default',
}

function resolveStatusIconName(status, deadlineStatus) {
  const nodeStatus = String(status || '').trim()
  if (nodeStatus === 'in_progress') {
    const nodeDeadlineStatus = String(deadlineStatus || '').trim()
    if (nodeDeadlineStatus === 'overdue') return 'overdue'
    if (nodeDeadlineStatus === 'approaching') return 'wait'
  }
  return meta.value.icon
}

const meta = computed(() => getNodeStatusMeta({
  nodeStatus: props.status,
  deadlineStatus: props.deadlineStatus,
}))
const iconName = computed(() => ICON_NAMES[resolveStatusIconName(props.status, props.deadlineStatus)] || ICON_NAMES.wait)
</script>

<style scoped>
.flow-status-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

</style>
