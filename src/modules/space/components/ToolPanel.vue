<template>
  <div class="tool-panel">
    <div class="tool-tabs" :class="{ 'file-active': uiStore.activeToolTab === 'file' && !uiStore.fileTreeCollapsed }">
      <button
        class="tool-tab"
        :class="{ active: uiStore.activeToolTab === 'file' && !uiStore.fileTreeCollapsed }"
        @click="uiStore.setActiveToolTab('file')"
      >
        <img class="tab-icon tab-icon--asset" :src="toolFileIcon" alt="" aria-hidden="true" />
        <span class="tab-label">文件</span>
      </button>
      <button
        class="tool-tab"
        :class="{ active: uiStore.activeToolTab === 'todo' }"
        @click="uiStore.setActiveToolTab('todo')"
      >
        <img class="tab-icon tab-icon--asset" :src="toolTodoIcon" alt="" aria-hidden="true" />
        <span class="tab-label">待办</span>
      </button>
      <!-- 定时任务：全局可见（PRD：全局公共功能）-->
      <button
        class="tool-tab"
        :class="{ active: uiStore.activeToolTab === 'schedule' }"
        @click="uiStore.setActiveToolTab('schedule')"
      >
        <img class="tab-icon tab-icon--asset" :src="toolScheduleIcon" alt="" aria-hidden="true" />
        <span class="tab-label">定时</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useUIStore } from '@/modules/space/uiStore'
import toolFileIcon from '@/assets/tool-file.svg'
import toolTodoIcon from '@/assets/tool-todo.svg'
import toolScheduleIcon from '@/assets/tool-schedule.svg'

const uiStore = useUIStore()
</script>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex-shrink: 0;
}

.tool-tabs {
  width: 52px;
  min-width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 16px;
  border-radius: 12px;
  position: relative;
  background: #FFFFFF;
}

.tool-tab {
  width: 40px;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  padding: 0;
  position: relative;
}

.tool-tab.active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 38px;
  border-radius: 0 12px 12px 0;
  background: linear-gradient(0deg, #FF8670 23%, #C69FED 75%, #81BEFC 100%);
}

/* 文件面板展开时削左角，和面板贴合 */
.tool-tabs.file-active {
  border-radius: 0 12px 12px 0;
}

.tab-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  margin-bottom: 8px;
}

.tab-icon--asset {
  width: 20px;
  height: 20px;
}

.tab-label {
  font-size: 12px;
  color: #2F3547;
  line-height: 1;
}
</style>
