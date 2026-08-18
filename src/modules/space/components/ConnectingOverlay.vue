<template>
  <Transition name="fade">
    <div v-if="visible" class="connecting-overlay">
      <h2 class="connect-title">BOSS～报告！</h2>
      <p class="connect-subtitle">正在努力加载中...</p>
      <div class="connect-visual">
        <img src="@/assets/home/connectBg.png" class="connect-bg" alt="" />
        <img src="@/assets/home/kooky_run.gif" class="connect-gif" alt="connecting" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
})
</script>

<style scoped>
.connecting-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
}

.connect-title {
  position: absolute;
  top: 143px;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px;
}

.connect-subtitle {
  position: absolute;
  top: 191px;
  font-size: 14px;
  color: #999;
  margin: 0;
}

/* 背景图+GIF 绝对居中 */
.connect-visual {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.connect-bg {
  position: absolute;
  width: 901px;
  height: 810px;
  object-fit: fill;
  pointer-events: none;
}

.connect-gif {
  position: relative;
  z-index: 1;
  width: 118px;
  height: 118px;
  margin-top: 12px;
  margin-left: 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
