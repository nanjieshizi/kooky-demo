<template>
  <!-- 根模式：渲染顶层节点列表（标题/操作由 FactoryCodePane 工具栏承载）-->
  <div v-if="!node" class="factory-file-tree">
    <div v-if="!codeFileStructure.length" class="tree-empty">暂无文件</div>
    <div class="tree-body">
      <FactoryFileTree
        v-for="root in codeFileStructure"
        :key="root.id"
        :node="root"
        :depth="0"
      />
    </div>
  </div>

  <!-- 节点模式：folder 或 file -->
  <div v-else class="tree-node">
    <!-- 文件夹 -->
    <template v-if="node.type === 'folder'">
      <el-tooltip
        :content="node.desc || node.name"
        placement="right"
        :show-after="300"
        :disabled="!node.desc"
      >
        <div
          class="row folder-row"
          :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
          @click="expanded = !expanded"
        >
          <span class="caret">{{ expanded ? '▼' : '▶' }}</span>
          <span class="icon">{{ expanded ? '📂' : '📁' }}</span>
          <span class="label">{{ node.name }}</span>
        </div>
      </el-tooltip>

      <div v-if="expanded" class="folder-children">
        <template v-if="node.children && node.children.length">
          <FactoryFileTree
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :depth="depth + 1"
          />
        </template>
        <div
          v-else
          class="empty-folder"
          :style="{ paddingLeft: (depth + 1) * 16 + 8 + 'px' }"
        >
          (空)
        </div>
      </div>
    </template>

    <!-- 文件 -->
    <template v-else>
      <div
        class="row file-row"
        :class="{ selected: selectedCodePath === node.path }"
        :style="{ paddingLeft: depth * 16 + 24 + 'px' }"
        @click="handlePick(node.path)"
      >
        <span class="icon">{{ fileIcon(node.name) }}</span>
        <span class="label">{{ node.name }}</span>
        <span v-if="isGenerating" class="spinner" title="生成中" />
      </div>
    </template>
  </div>
</template>

<script setup>
// 工厂代码 Tab：左侧文件树组件
// 双模式：未传 node 时是根容器；传了 node 时是递归渲染单个节点（自身递归）
defineOptions({ name: 'FactoryFileTree' })

import { ref, computed, inject, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFactoryStore } from '../store'

const props = defineProps({
  node: { type: Object, default: null },
  depth: { type: Number, default: 0 },
})

const factoryStore = useFactoryStore()
const { codeFileStructure, selectedCodePath } = storeToRefs(factoryStore)
const { getCodeFile, selectCodePath } = factoryStore

// 文件夹默认展开
const expanded = ref(true)

// 折叠/展开联动（来自 FactoryCodePane 的 provide）
const treeControl = inject('factoryCodeTreeControl', null)
if (treeControl) {
  watch(() => treeControl.token, () => {
    expanded.value = treeControl.expand
  })
}

// 当前节点是否处于「生成中」状态
const isGenerating = computed(() => {
  if (!props.node || props.node.type !== 'file') return false
  return !!getCodeFile(props.node.path)?.generating
})

// 按扩展名分配文件图标
function fileIcon(name) {
  if (/\.md$/i.test(name)) return '📄'
  if (/\.json$/i.test(name)) return '🔧'
  if (/\.ya?ml$/i.test(name)) return '⚙️'
  return '📃'
}

function handlePick(path) {
  selectCodePath(path)
}
</script>

<style scoped lang="scss">
.factory-file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafbfc;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
  user-select: none;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  flex: 0 0 auto;
}

.tree-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-add-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
}

.tree-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.tree-empty {
  padding: 20px 12px;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}

.tree-node {
  font-size: 13px;
  line-height: 1.5;
}

.row {
  display: flex;
  align-items: center;
  height: 26px;
  padding-right: 10px;
  cursor: pointer;
  color: #374151;
  transition: background 0.12s;

  &:hover {
    background: rgba(59, 130, 246, 0.08);
  }
}

.folder-row {
  font-weight: 500;
}

.caret {
  display: inline-block;
  width: 12px;
  font-size: 9px;
  color: #9ca3af;
  margin-right: 2px;
  flex: 0 0 12px;
}

.icon {
  margin-right: 6px;
  font-size: 13px;
  flex: 0 0 auto;
}

.label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-row.selected {
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
  position: relative;
  font-weight: 500;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #2563eb;
  }
}

.empty-folder {
  font-size: 12px;
  color: #9ca3af;
  height: 22px;
  line-height: 22px;
  font-style: italic;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(59, 130, 246, 0.25);
  border-top-color: #3b82f6;
  border-radius: 50%;
  margin-left: 6px;
  animation: tree-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

@keyframes tree-spin {
  to { transform: rotate(360deg); }
}
</style>
