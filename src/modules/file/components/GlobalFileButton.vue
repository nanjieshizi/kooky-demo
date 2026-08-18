<template>
  <button
    class="global-file-button"
    :class="{ active: uiStore.globalFilePanelVisible && !uiStore.fileTreeCollapsed }"
    title="文件"
    @click="uiStore.toggleGlobalFilePanel()"
  >
    <img :src="uiStore.globalFilePanelVisible ? openedIcon : folderIcon" alt="文件" class="file-icon" />
  </button>
</template>

<script setup>
import { useUIStore } from '@/modules/space/uiStore'
import folderIcon from '@/assets/home/folder.svg'
import openedIcon from '@/assets/home/opened.svg'

const uiStore = useUIStore()
</script>

<style scoped>
.global-file-button {
  position: fixed;
  top: 3px;
  right: 2px;
  z-index: 2000;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  border-color: transparent;
  transition: all 0.2s ease;
}

.global-file-button:hover {
  background: #fff;
}

.global-file-button.active {
  background: #fff;
}

.file-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.global-file-button.active .file-icon {
  width: 12px;
  height: 12px;
}
</style>
