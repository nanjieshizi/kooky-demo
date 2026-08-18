<template>
  <div class="file-panel">
    <div class="panel-header">
      <span class="panel-title">文件</span>
    </div>

    <div class="file-tree" v-if="fileNodes.length > 0">
      <div
        v-for="node in fileNodes"
        :key="node.id"
        class="tree-node"
      >
        <!-- Folder -->
        <div
          class="tree-item folder-item"
          @click="toggleFolder(node.id)"
        >
          <svg
            class="expand-icon"
            :class="{ open: node.isOpen }"
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="node-icon">📁</span>
          <span class="node-name">{{ node.name }}</span>
        </div>

        <!-- Children -->
        <Transition name="expand">
          <div v-show="node.isOpen" class="tree-children">
            <div
              v-for="child in node.children"
              :key="child.id"
              class="tree-item file-item"
            >
              <span class="node-icon">{{ getFileIcon(child.type) }}</span>
              <span class="node-name">{{ child.name }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <div v-else class="empty-state">
      <p class="empty-text">暂无文件</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFileStore } from '@/modules/file/store'
import { useGroupStore } from '@/modules/group/store'

const fileStore = useFileStore()
const groupStore = useGroupStore()

const fileNodes = computed(() => fileStore.nodesBySpace(groupStore.currentSpaceId))

function toggleFolder(id) {
  fileStore.toggleFolder(id)
}

function getFileIcon(type) {
  const icons = {
    pdf: '📄',
    markdown: '📝',
    doc: '📃',
    image: '🖼️'
  }
  return icons[type] || '📄'
}
</script>

<style scoped>
.file-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.panel-header {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.tree-node {
  margin-bottom: 2px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
  user-select: none;
}

.tree-item:hover {
  background: var(--bg-secondary);
}

.folder-item {
  color: var(--text-primary);
  font-weight: 500;
}

.file-item {
  padding-left: 28px;
  color: var(--text-secondary);
}

.file-item:hover {
  color: var(--text-primary);
}

.expand-icon {
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.expand-icon.open {
  transform: rotate(90deg);
}

.node-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.node-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  font-size: 14px;
  color: var(--text-muted);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
