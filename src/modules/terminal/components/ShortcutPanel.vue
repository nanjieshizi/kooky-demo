<template>
  <Teleport to="body">
    <Transition name="shortcut-panel">
      <div v-if="visible" class="shortcut-panel-overlay" @click.self="handleClose">
        <div class="shortcut-panel" :class="[`theme-${themeKey}`]">
          <!-- 标题栏 -->
          <div class="panel-header">
            <h3 class="panel-title">快捷键列表</h3>
            <button class="close-btn" @click="handleClose">
              <SvgIcon name="tianjia" :size="16" color="#7B7B7B" style="transform: rotate(45deg)" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="panel-content" >
            <img :src="shortcutImage" class="shortcut-image" alt="快捷键说明" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import darkMac from '@/assets/terminal/dark_mac.png'
import darkWin from '@/assets/terminal/dark_win.png'
import whiteMac from '@/assets/terminal/white_mac.png'
import whiteWin from '@/assets/terminal/white_win.png'
import panelContentBg from '@/assets/terminal/panel-content-bg.png'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isMac: { type: Boolean, default: true },
  themeKey: { type: String, default: 'dark' }
})

const emit = defineEmits(['update:visible'])

const shortcutImage = computed(() => {
  if (props.themeKey === 'dark') {
    return props.isMac ? darkMac : darkWin
  }
  return props.isMac ? whiteMac : whiteWin
})

const panelContentStyle = computed(() => {
  if (props.themeKey === 'dark') {
    return {
      backgroundImage: `url(${panelContentBg})`,
      backgroundSize: '100% auto',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'top center'
    }
  }
  return {}
})

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.shortcut-panel-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
}

.shortcut-panel {
  width: 800px;
  max-width: 90vw;
  max-height: 85vh;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: 32px;

}

.shortcut-panel.theme-dark {
  background: #1e1e1e;
}

.shortcut-panel.theme-light {
  background: #ffffff;
}

/* 标题栏 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}

.panel-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: normal;
  margin: 0;
}

.shortcut-panel.theme-dark .panel-title { color: #D1D1D1; }
.shortcut-panel.theme-light .panel-title { color: #2F3547; }

.close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  transition: background 0.15s;
}

.close-btn:hover {
  background: rgba(128, 128, 128, 0.15);
}

/* 内容区域 */
.panel-content {
  overflow-y: auto;
  padding-left: 20px;
  padding-right: 20px;
}

.shortcut-image {
  width: 100%;
  height: auto;
  display: block;
}

/* 滚动条 */
.panel-content::-webkit-scrollbar { width: 4px; }
.panel-content::-webkit-scrollbar-track { background: transparent; }
.panel-content::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.25);
  border-radius: 2px;
}

/* 过渡动画 */
.shortcut-panel-enter-active,
.shortcut-panel-leave-active {
  transition: opacity 0.2s ease;
}

.shortcut-panel-enter-from,
.shortcut-panel-leave-to {
  opacity: 0;
}

.shortcut-panel-enter-active .shortcut-panel,
.shortcut-panel-leave-active .shortcut-panel {
  transition: transform 0.2s ease;
}

.shortcut-panel-enter-from .shortcut-panel,
.shortcut-panel-leave-to .shortcut-panel {
  transform: scale(0.95);
}
</style>
