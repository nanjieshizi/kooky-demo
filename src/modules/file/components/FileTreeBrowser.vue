<template>
  <div class="file-tree-browser">
    <!-- 头部工具栏 -->
    <div class="tree-header">
      <span class="tree-title">文件资源管理器</span>
      <div class="tree-actions">
        <el-tooltip content="打开文件夹" placement="bottom" :show-after="0">
          <button class="tree-btn" @click="selectRootDir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </el-tooltip>
        <el-tooltip content="刷新" placement="bottom" :show-after="0">
          <button class="tree-btn" @click="refreshRoot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </el-tooltip>
      </div>
    </div>

    <!-- 当前根路径 -->
    <div v-if="rootPath" class="tree-root-path" :title="rootPath">
      <span class="root-path-text">{{ rootPathDisplay }}</span>
      <el-tooltip content="切换目录" placement="bottom" :show-after="0">
        <button class="root-path-switch-btn" @click="selectRootDir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </el-tooltip>
    </div>

    <!-- 空状态 -->
    <div v-if="!rootPath" class="tree-empty">
      <div class="tree-empty-icon">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <!-- 文件夹图标 -->
          <rect x="15" y="25" width="50" height="35" rx="3" fill="#5B8DEF" opacity="0.2"/>
          <rect x="15" y="28" width="50" height="32" rx="3" fill="#5B8DEF" opacity="0.3"/>
          <path d="M15 31C15 29.3431 16.3431 28 18 28H35L38 31H62C63.6569 31 65 32.3431 65 34V57C65 58.6569 63.6569 60 62 60H18C16.3431 60 15 58.6569 15 57V31Z" fill="#5B8DEF"/>
          <!-- 文档图标 -->
          <rect x="25" y="38" width="20" height="16" rx="2" fill="white" opacity="0.9"/>
          <line x1="28" y1="42" x2="42" y2="42" stroke="#5B8DEF" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="28" y1="46" x2="38" y2="46" stroke="#5B8DEF" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="28" y1="50" x2="40" y2="50" stroke="#5B8DEF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <button class="tree-empty-btn" @click="selectRootDir">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>添加项目根路径</span>
      </button>
    </div>

    <!-- 文件树 -->
    <div v-else class="tree-scroll">
      <div v-if="loading" class="tree-loading">加载中...</div>
      <FileTreeNode
        v-else
        v-for="node in rootNodes"
        :key="node.path"
        :node="node"
        :depth="0"
        :selected-path="selectedPath"
        @select="onNodeSelect"
        @refresh="handleRefresh"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import FileTreeNode from './FileTreeNode.vue'

const emit = defineEmits(['open-file'])

const uiStore = useUIStore()

const rootPath = ref('')
const rootNodes = ref([])
const loading = ref(false)
const selectedPath = ref('')

const rootPathDisplay = computed(() => {
  if (!rootPath.value) return ''
  const parts = rootPath.value.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || rootPath.value
})

onMounted(async () => {
  // 调试：检查 electronAPI 是否可用
  console.log('FileTreeBrowser mounted, electronAPI:', window.electronAPI)
  console.log('electronAPI.fs:', window.electronAPI?.fs)
  console.log('electronAPI.claudeCode:', window.electronAPI?.claudeCode)

  // 清除旧的 localStorage 数据，确保显示空状态
  localStorage.removeItem('file-tree-root')

  // 不再默认加载磁盘驱动器，显示空状态
  // 用户需要手动点击按钮选择文件夹
})

async function selectRootDir() {
  // 检查 electronAPI 是否可用
  if (!window.electronAPI || !window.electronAPI.claudeCode) {
    console.error('electronAPI 未加载，请重启应用')
    alert('文件系统 API 未加载，请完全关闭应用后重新启动。\n\n如果问题仍然存在，请尝试：\n1. 关闭所有应用窗口\n2. 运行: yarn electron:dev')
    return
  }

  const dir = await window.electronAPI.claudeCode.selectDirectory()
  if (!dir) return
  rootPath.value = dir
  localStorage.setItem('file-tree-root', dir)
  await loadDir(dir, rootNodes)
}

async function refreshRoot() {
  if (!rootPath.value) return
  await loadDir(rootPath.value, rootNodes)
}

async function loadDir(dirPath, targetRef) {
  loading.value = true
  try {
    const entries = await window.electronAPI.fs.readDir(dirPath)
    // 排序：文件夹在前，文件在后；各自按名称排序；隐藏文件排最后
    targetRef.value = entries
      .filter(e => uiStore.showHiddenFiles || !e.isHidden)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch (err) {
    console.error('读取目录失败:', err)
    targetRef.value = []
  } finally {
    loading.value = false
  }
}

function onNodeSelect(node) {
  selectedPath.value = node.path
  if (node.type === 'file') {
    emit('open-file', node)
  }
}

// 处理子节点的刷新请求
async function handleRefresh(dirPath) {
  // 刷新指定目录（重新加载该目录的内容）
  // 这个功能会在创建新文件后被调用
  await refreshRoot()
}

// 暴露给父组件使用
defineExpose({ loadDir, expandToPath })

// 展开到指定路径并选中
async function expandToPath(filePath) {
  if (!filePath) return

  // 标准化路径分隔符
  const normalizedPath = filePath.replace(/\\/g, '/')
  const normalizedRoot = rootPath.value.replace(/\\/g, '/')

  // 检查文件是否在当前根目录下
  if (!normalizedPath.startsWith(normalizedRoot)) {
    console.warn('文件不在当前根目录下:', filePath)
    // 尝试设置根目录为文件所在目录的父目录
    const pathParts = normalizedPath.split('/')
    const newRoot = pathParts.slice(0, -1).join('/')
    if (newRoot) {
      rootPath.value = newRoot
      localStorage.setItem('file-tree-root', newRoot)
      await loadDir(newRoot, rootNodes)
    }
  }

  // 选中该路径
  selectedPath.value = filePath
}

// 监听终端文件点击事件
function handleRevealFileInTree(e) {
  expandToPath(e.detail.filePath)
}

onMounted(async () => {
  // 调试：检查 electronAPI 是否可用
  console.log('FileTreeBrowser mounted, electronAPI:', window.electronAPI)
  console.log('electronAPI.fs:', window.electronAPI?.fs)
  console.log('electronAPI.claudeCode:', window.electronAPI?.claudeCode)

  // 清除旧的 localStorage 数据，确保显示空状态
  localStorage.removeItem('file-tree-root')

  // 不再默认加载磁盘驱动器，显示空状态
  // 用户需要手动点击按钮选择文件夹

  window.addEventListener('reveal-file-in-tree', handleRevealFileInTree)
})

onUnmounted(() => {
  window.removeEventListener('reveal-file-in-tree', handleRevealFileInTree)
})</script>

<style scoped>
.file-tree-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  color: #ccc;
  font-size: 13px;
  user-select: none;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.tree-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #bbb;
  letter-spacing: 0.5px;
}

.tree-actions {
  display: flex;
  gap: 2px;
}

.tree-btn {
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.tree-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tree-root-path {
  padding: 4px 12px;
  font-size: 11px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
}

.tree-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: #666;
  padding: 40px 20px;
}

.tree-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-empty-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px dashed #555;
  border-radius: 4px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tree-empty-btn:hover {
  border-color: #5B8DEF;
  color: #5B8DEF;
  background: rgba(91, 141, 239, 0.05);
}

.tree-empty-btn svg {
  flex-shrink: 0;
}

.tree-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.tree-scroll::-webkit-scrollbar {
  width: 4px;
}

.tree-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.tree-scroll::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

.tree-loading {
  padding: 16px;
  text-align: center;
  color: #666;
  font-size: 12px;
}
</style>
