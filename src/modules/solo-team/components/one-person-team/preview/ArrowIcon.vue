<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="dir === 'left'">
      <path d="M15 6l-6 6 6 6" />
    </template>
    <template v-else-if="dir === 'right'">
      <path d="M9 6l6 6-6 6" />
    </template>
    <template v-else-if="dir === 'up-right'">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </template>
  </svg>
</template>

<script setup>
defineOptions({ name: 'ArrowIcon' })
defineProps({
  size: { type: [Number, String], default: 16 },
  dir: { type: String, default: 'right' },
})
</script>
