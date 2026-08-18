<template>
  <Transition name="loading-fade">
    <div v-show="visible" class="loading-wrapper" :class="{ 'has-overlay': overlay }">
      <img src="@/assets/images/loading.gif" alt="加载中" class="loading-icon" />
      <p class="loading-text">{{ text }}</p>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '请稍候...',
  },
  overlay: {
    type: Boolean,
    default: false,
  },
})
</script>

<style lang="scss" scoped>
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.25s ease;
}
.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

.loading-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  pointer-events: none;
  z-index: 9999;

  &.has-overlay {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.6);
  }
}

.loading-icon {
  width: 48px;
  height: 48px;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #333;
}
</style>
