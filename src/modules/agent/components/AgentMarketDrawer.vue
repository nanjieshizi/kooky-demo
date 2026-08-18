<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="$emit('close')">
        <div class="drawer-panel">
          <AgentPanel @close="$emit('close')" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import AgentPanel from './AgentPanel.vue'

defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close'])
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.35);
}

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 80%;
  height: 100vh;
  
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

/* 进入/离开动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
