<template>
  <div class="update-notification">
    <!-- 下载状态条（替代横幅位置） -->
    <slot name="download-bar"></slot>

    <!-- 有更新时的常驻提示（下载中不显示） -->
    <div v-if="updateStatus === 'available' && !downloading && !forceUpdate" class="update-banner">
      <img src="@/assets/navigation/star.png" alt="" class="update-banner-icon" />
      <span class="update-banner-text">发现新版本</span>
      <span class="update-banner-btn" @click.stop="handleUpgrade">立即更新</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  updateStatus: { type: String, default: 'idle' },
  currentVersion: { type: String, default: '' },
  newVersion: { type: String, default: '' },
  downloading: { type: Boolean, default: false },
  forceUpdate: { type: Boolean, default: false }
})

const emit = defineEmits(['upgrade'])

function handleUpgrade() {
  emit('upgrade')
}
</script>

<style scoped>
.update-notification {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-banner {
  display: flex;
  align-items: center;
  border-radius: 24px;
  background: #FFFFFF;
  padding: 6px 16px;
}

.update-banner-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.update-banner-text {
  font-size: 13px;
  color: #2F3547;
  white-space: nowrap;
  margin-left: 4px;
  margin-right: 10px;
}

.update-banner-btn {
  font-size: 13px;
  font-weight: 600;
  color: #FF5233;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.update-banner-btn:hover {
  opacity: 0.8;
}
</style>
