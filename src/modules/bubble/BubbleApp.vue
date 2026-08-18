<script setup>
import { ref } from 'vue'
import BubbleIcon from './components/BubbleIcon.vue'
import MiniChatPanel from './components/MiniChatPanel.vue'

const expanded = ref(false)

function handleExpand() {
  expanded.value = true
  if (window.bubbleAPI) {
    window.bubbleAPI.expand()
  }
}

function handleCollapse() {
  expanded.value = false
  if (window.bubbleAPI) {
    window.bubbleAPI.collapse()
  }
}

function handleRestoreMain() {
  if (window.bubbleAPI) {
    window.bubbleAPI.restoreMain()
  }
}
</script>

<template>
  <div class="bubble-app">
    <BubbleIcon
      v-if="!expanded"
      @expand="handleExpand"
      @restore="handleRestoreMain"
    />
    <MiniChatPanel
      v-else
      @collapse="handleCollapse"
      @restore="handleRestoreMain"
    />
  </div>
</template>

<style scoped>
.bubble-app {
  width: 100%;
  height: 100%;
}
</style>
