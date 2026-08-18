<script setup>
import { computed } from 'vue'
import { useNotificationStore } from '@/modules/terminal/stores/notification'

const props = defineProps({
  panelId: { type: String, required: true },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const notificationStore = useNotificationStore()

// cmux 对齐：蓝环显示条件 = 真正未读 OR focused-read indicator（聚焦时刚收到的通知也闪）
const hasNotification = computed(() =>
  notificationStore.panelHasVisibleIndicator(props.panelId)
)

function handleClick() {
  // cmux 对齐：点击/聚焦时统一清除 pane 的 unread + indicator
  notificationStore.dismissPanelIndicator(props.panelId)
  emit('click')
}
</script>

<template>
  <div
    class="notification-ring"
    :class="{ 'has-notification': hasNotification }"
    @click.stop="handleClick"
  >
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.notification-ring {
  position: relative;
  width: 100%;
  height: 100%;

  &.has-notification {
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px solid #5090e0;
      border-radius: 0;
      pointer-events: none;
      animation: pulse-ring 2s ease-in-out infinite;
    }
  }
}

@keyframes pulse-ring {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(80, 144, 224, 0.2);
    opacity: 0.4;
  }
  50% {
    box-shadow: 0 0 12px 2px rgba(80, 144, 224, 0.5);
    opacity: 1;
  }
}
</style>
