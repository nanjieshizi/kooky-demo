<template>
  <div v-if="display.text" class="flow-node-time" :class="`flow-node-time--${display.tone}`">
    <span>{{ display.label }}</span>
    <span>{{ display.text }}</span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getNodeTimeDisplay } from '../utils/flowTime.mjs'

defineOptions({ name: 'FlowNodeTime' })

const props = defineProps({
  node: { type: Object, required: true },
})

const now = ref(new Date())
let timer = null

const display = computed(() => getNodeTimeDisplay(props.node, now.value))

function stopTimer() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

watch(
  () => display.value.dynamic,
  (dynamic) => {
    stopTimer()
    if (dynamic) {
      timer = setInterval(() => {
        now.value = new Date()
      }, 1000)
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopTimer)
</script>

<style scoped>
.flow-node-time {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  line-height: 20px;
  color: #91949E;
}

.flow-node-time--danger {
  color: #ED4543;
}

.flow-node-time--warning {
  color: #F5B400;
}
</style>
