<script setup>
import { ref } from 'vue'
import desktopIcon from '@/assets/home/desktop_icon.png'

const emit = defineEmits(['expand', 'restore'])

let clickTimer = null
let isDragging = false
let startX = 0
let startY = 0

function handleClick() {
  if (isDragging) {
    isDragging = false
    return
  }

  // 区分单击和双击
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    // 双击 → 恢复主窗口
    emit('restore')
  } else {
    clickTimer = setTimeout(() => {
      clickTimer = null
      // 单击 → 展开迷你聊天
      emit('expand')
    }, 250)
  }
}

function handleMouseDown(e) {
  startX = e.screenX
  startY = e.screenY
  isDragging = false

  const onMouseMove = (moveEvent) => {
    const deltaX = moveEvent.screenX - startX
    const deltaY = moveEvent.screenY - startY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      isDragging = true
      startX = moveEvent.screenX
      startY = moveEvent.screenY
      if (window.bubbleAPI) {
        window.bubbleAPI.drag(deltaX, deltaY)
      }
    }
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    // 拖拽结束，吸附到最近边缘
    if (isDragging && window.bubbleAPI) {
      window.bubbleAPI.dragEnd()
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div
    class="bubble-icon"
    @click="handleClick"
    @mousedown="handleMouseDown"
  >
    <img :src="desktopIcon" alt="Kooky" class="icon-img" />
  </div>
</template>

<style scoped>
.bubble-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.bubble-icon:hover {
  transform: scale(1.1);
}

.bubble-icon:active {
  transform: scale(0.95);
}

.icon-img {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  pointer-events: none;
}
</style>
