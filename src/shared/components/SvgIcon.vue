<script setup>
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [String, Number], default: '1em' },
  color: { type: String, default: 'currentColor' },
})

const iconName = computed(() => {
  return props.name.startsWith('icon-') ? `#${props.name}` : `#icon-${props.name}`
})

const iconSize = computed(() => {
  return typeof props.size === 'number' ? `${props.size}px` : props.size
})

import { computed } from 'vue'
</script>

<template>
  <svg
    class="svg-icon"
    :style="{ width: iconSize, height: iconSize, color }"
    aria-hidden="true"
  >
    <use :xlink:href="iconName" />
  </svg>
</template>

<style scoped>
.svg-icon {
  display: inline-block;
  fill: currentColor;
  vertical-align: -0.15em;
  overflow: hidden;
}
</style>
