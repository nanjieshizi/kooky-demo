<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="skill-icon-svg"
  >
    <!-- book-open -->
    <template v-if="name === 'book-open'">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </template>
    <!-- database -->
    <template v-else-if="name === 'database'">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
      <path d="M3 12a9 3 0 0 0 18 0"/>
    </template>
    <!-- globe -->
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </template>
    <!-- terminal -->
    <template v-else-if="name === 'terminal'">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </template>
    <!-- file-text -->
    <template v-else-if="name === 'file-text'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </template>
    <!-- mail -->
    <template v-else-if="name === 'mail'">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </template>
    <!-- image -->
    <template v-else-if="name === 'image'">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </template>
    <!-- calendar -->
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </template>
    <!-- bar-chart -->
    <template v-else-if="name === 'bar-chart'">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </template>
    <!-- volume -->
    <template v-else-if="name === 'volume'">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </template>
    <!-- puzzle (默认) -->
    <template v-else>
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.47 1.229 0 1.698l-2.589 2.59c-.27.27-.69.34-1.029.17l-1.42-.71c-.34-.17-.74-.07-1 .19l-.93.93c-.26.26-.36.66-.19 1l.71 1.42c.17.34.1.76-.17 1.029l-2.59 2.589c-.469.47-1.228.47-1.698 0l-1.568-1.568a.713.713 0 0 0-.878-.29c-.323.115-.643.246-.96.39a.5.5 0 0 0-.292.453V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1.642a.5.5 0 0 0-.293-.453 9.97 9.97 0 0 1-.96-.39.713.713 0 0 0-.878.29L1.299 19.37a1.2 1.2 0 0 1-1.7-1.7l1.568-1.567a.713.713 0 0 0 .29-.879 9.97 9.97 0 0 1-.39-.96A.5.5 0 0 0 .613 14H-1"/>
    </template>
  </svg>
</template>

<script setup>
defineOptions({ name: 'SkillIcon' })

defineProps({
  name: { type: String, default: 'puzzle' },
  size: { type: [Number, String], default: 16 },
})
</script>

<style scoped>
.skill-icon-svg {
  display: block;
}
</style>
