<template>
  <div class="global-file-tree">
    <!-- 根路径显示 -->
    <div v-if="rootPath" class="tree-root-path">
      <div class="root-path-top">
        <div class="root-path-left">
          <span class="root-path-label">{{ rootPathDisplay }}</span>
        </div>
        <el-dropdown
          trigger="click"
          :disabled="folderHistory.length === 0"
          :teleported="true"
          placement="bottom"
          popper-class="file-panel-history-popper"
          @command="loadFolder"
        >
          <button class="history-trigger-btn" :disabled="folderHistory.length === 0">
            <svg class="root-path-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="file-tree-dropdown file-panel-history-dropdown">
              <el-dropdown-item
                v-for="p in folderHistory"
                :key="p"
                :command="p"
                :title="p"
              >{{ p }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="root-path-actions">
          <button class="action-btn" title="打开目录" @click="openCurrentFolder">
            <img :src="addIcon" alt="打开目录" class="action-icon" />
          </button>
          <button class="action-btn" title="切换文件目录" @click="selectRootDir">
            <img :src="switchIcon" alt="切换文件目录" class="action-icon" />
          </button>
          <button class="action-btn" title="新建文件" @click="createFileInCurrent">
            <img :src="addTextIcon" alt="新建文件" class="action-icon" />
          </button>
          <button class="action-btn" title="新建文件夹" @click="createFolderInCurrent">
            <img :src="addFolderIcon" alt="新建文件夹" class="action-icon" />
          </button>
        </div>
      </div>
      <div class="root-path-full" :title="rootPath">{{ rootPath }}</div>
    </div>

    <!-- 空状态 -->
    <div v-if="!rootPath" class="tree-empty">
      <div class="tree-empty-icon">
        <img :src="emptyStateIcon" alt="空状态" class="empty-icon-img" />
      </div>
      <button class="tree-empty-btn" @click="selectRootDir">
        <img :src="addEmptyIcon" alt="添加" class="btn-icon" />
        <span>添加文件路径</span>
      </button>
    </div>

    <!-- 文件树内容 -->
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
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import FileTreeNode from './FileTreeNode.vue'
import addIcon from '@/assets/home/open.svg'
import addFolderIcon from '@/assets/home/addFolder.svg'
import addTextIcon from '@/assets/home/addText.svg'
import switchIcon from '@/assets/home/switch.svg'
import emptyStateIcon from '@/assets/home/flie-preview.png'
import addEmptyIcon from '@/assets/home/openFolder.svg'

const uiStore = useUIStore()

// 全局节点刷新注册表：path → refresh callback
const _refreshRegistry = new Map()

provide('registerNodeRefresh', (path, cb) => {
  _refreshRegistry.set(path, cb)
  return () => _refreshRegistry.delete(path)
})

provide('triggerNodeRefresh', (path) => {
  const cb = _refreshRegistry.get(path)
  if (cb) cb()
})

// 文件树状态
const rootPath = ref('')
const rootNodes = ref([])
const loading = ref(false)
const selectedPath = ref('')
const selectedNode = ref(null)

// 需要展开的路径集合（用于从终端点击文件时展开文件树）
const expandedPaths = ref(new Set())

// 多选状态（用于拖拽多文件到终端）
const selectedPaths = ref(new Set())
// 多选节点信息注册表（path → node），供拖拽时获取完整信息
const selectedNodesMap = ref(new Map())

provide('expandedPaths', expandedPaths)
provide('selectedPaths', selectedPaths)
provide('selectedNodesMap', selectedNodesMap)
provide('toggleSelect', (node, event) => {
  const isMac = navigator.platform?.includes('Mac')
  const isMultiKey = isMac ? event.metaKey : event.ctrlKey
  if (isMultiKey) {
    const newSet = new Set(selectedPaths.value)
    const newMap = new Map(selectedNodesMap.value)
    if (newSet.has(node.path)) {
      newSet.delete(node.path)
      newMap.delete(node.path)
    } else {
      newSet.add(node.path)
      newMap.set(node.path, node)
    }
    selectedPaths.value = newSet
    selectedNodesMap.value = newMap
  } else {
    selectedPaths.value = new Set([node.path])
    selectedNodesMap.value = new Map([[node.path, node]])
  }
})
provide('clearMultiSelect', () => {
  selectedPaths.value = new Set()
  selectedNodesMap.value = new Map()
})

// 文件夹历史
const folderHistory = ref(loadHistory())

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('file-panel-folder-history') || '[]')
  } catch { return [] }
}

function saveHistory(path) {
  const list = [path, ...folderHistory.value.filter(p => p !== path)].slice(0, 10)
  folderHistory.value = list
  localStorage.setItem('file-panel-folder-history', JSON.stringify(list))
}

const rootPathDisplay = computed(() => {
  if (!rootPath.value || rootPath.value === 'drives') return '文件夹名称XXX'
  const parts = rootPath.value.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || rootPath.value
})

// 文件系统监听
let unwatchFs = null
let refreshDebounce = null

async function startWatching(dirPath) {
  if (unwatchFs) {
    unwatchFs()
    unwatchFs = null
  }
  if (!dirPath || dirPath === 'drives') return
  await window.electronAPI?.fs.watchStart(dirPath)
  unwatchFs = window.electronAPI?.fs.onFileChanged(() => {
    clearTimeout(refreshDebounce)
    refreshDebounce = setTimeout(() => handleRefresh(), 500)
  })
}

onMounted(async () => {
  const lastPath = localStorage.getItem('file-panel-last-root')
  if (lastPath) {
    await loadFolder(lastPath)
    await startWatching(lastPath)
  }

  window.addEventListener('reveal-file-in-tree', handleRevealFileInTree)
})

onUnmounted(() => {
  window.removeEventListener('reveal-file-in-tree', handleRevealFileInTree)
  if (unwatchFs) {
    unwatchFs()
    unwatchFs = null
  }
  clearTimeout(refreshDebounce)
  window.electronAPI?.fs.watchStop()
})

// 处理终端点击文件事件：展开文件树并定位到指定路径
async function handleRevealFileInTree(e) {
  const filePath = e.detail?.filePath
  if (!filePath) return

  const sep = filePath.includes('/') ? '/' : '\\'
  const parentDir = filePath.substring(0, filePath.lastIndexOf(sep))

  const normalizedFilePath = filePath.replace(/\\/g, '/')
  const normalizedRoot = rootPath.value.replace(/\\/g, '/')

  if (!rootPath.value || !normalizedFilePath.startsWith(normalizedRoot)) {
    if (parentDir) {
      await loadFolder(parentDir)
    }
  }

  const normalizedRootNow = rootPath.value.replace(/\\/g, '/')
  const pathsToExpand = new Set()
  let current = normalizedFilePath
  while (current.length > normalizedRootNow.length) {
    const lastSep = Math.max(current.lastIndexOf('/'), current.lastIndexOf('\\'))
    if (lastSep <= 0) break
    current = current.substring(0, lastSep)
    if (current.length >= normalizedRootNow.length) {
      const originalPath = filePath.includes('/') ? current : current.replace(/\//g, '\\')
      pathsToExpand.add(originalPath)
    }
  }

  expandedPaths.value = pathsToExpand
  selectedPath.value = filePath
}

function onNodeSelect(node) {
  selectedPath.value = node.path
  selectedNode.value = node
  if (!selectedPaths.value.has(node.path) || selectedPaths.value.size !== 1) {
    selectedPaths.value = new Set([node.path])
    selectedNodesMap.value = new Map([[node.path, node]])
  }
  if (node.type === 'directory') {
    saveHistory(node.path)
  }
  if (node.type === 'file') {
    const dotIndex = node.name.lastIndexOf('.')
    const fileType = dotIndex >= 0 ? node.name.substring(dotIndex + 1).toLowerCase() : ''
    window.electronAPI?.openFilePreview?.({
      localPath: node.path,
      name: node.name,
      type: fileType,
      size: node.size ?? 0,
    })
  }
}

async function handleRefresh(refreshedPath) {
  if (!rootPath.value || rootPath.value === 'drives') {
    const drives = await window.electronAPI.fs.getDrives()
    rootNodes.value = drives
  } else if (refreshedPath === rootPath.value || !refreshedPath) {
    await loadFolder(rootPath.value)
  }
}

async function loadFolder(folderPath) {
  loading.value = true
  try {
    const entries = await window.electronAPI.fs.readDir(folderPath)
    rootNodes.value = entries
      .filter(e => uiStore.showHiddenFiles || !e.isHidden)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    rootPath.value = folderPath
    saveHistory(folderPath)
    localStorage.setItem('file-panel-last-root', folderPath)
    await startWatching(folderPath)
  } catch (err) {
    console.error('加载目录失败:', err)
  } finally {
    loading.value = false
  }
}

async function selectRootDir() {
  if (!window.electronAPI?.claudeCode) {
    ElMessage.error('文件系统 API 未加载，请重启应用')
    return
  }
  const dir = await window.electronAPI.claudeCode.selectDirectory()
  if (!dir) return
  await loadFolder(dir)
}

function openCurrentFolder() {
  if (rootPath.value && rootPath.value !== 'drives') {
    window.electronAPI?.openPath(rootPath.value)
  }
}

async function createFileInCurrent() {
  if (!rootPath.value || rootPath.value === 'drives') return
  try {
    const { value: fileName } = await ElMessageBox.prompt('请输入文件名', '新建文件', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '文件名不能为空'
    })
    if (!fileName) return
    const sep = rootPath.value.includes('/') ? '/' : '\\'
    const filePath = rootPath.value + sep + fileName

    const existing = rootNodes.value.find(n => n.name === fileName)
    if (existing) {
      const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
      ElMessage.error(`"${fileName}" 已存在（${typeLabel}），请使用其他名称`)
      return
    }

    await window.electronAPI.fs.writeFile(filePath, '', 'utf8')
    ElMessage.success('文件创建成功')

    const entries = await window.electronAPI.fs.readDir(rootPath.value)
    const newNodes = entries
      .filter(e => uiStore.showHiddenFiles || !e.isHidden)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    const oldNodesMap = new Map(rootNodes.value.map(n => [n.path, n]))
    rootNodes.value = newNodes.map(newNode => {
      return oldNodesMap.has(newNode.path) ? oldNodesMap.get(newNode.path) : newNode
    })
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('文件创建失败: ' + (err.message || err))
  }
}

async function createFolderInCurrent() {
  if (!rootPath.value || rootPath.value === 'drives') return
  try {
    const { value: folderName } = await ElMessageBox.prompt('请输入文件夹名', '新建文件夹', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '文件夹名不能为空'
    })
    if (!folderName) return
    const sep = rootPath.value.includes('/') ? '/' : '\\'
    const folderPath = rootPath.value + sep + folderName

    const existing = rootNodes.value.find(n => n.name === folderName)
    if (existing) {
      const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
      ElMessage.error(`"${folderName}" 已存在（${typeLabel}），请使用其他名称`)
      return
    }

    await window.electronAPI.fs.mkdir(folderPath)
    ElMessage.success('文件夹创建成功')

    const entries = await window.electronAPI.fs.readDir(rootPath.value)
    const newNodes = entries
      .filter(e => uiStore.showHiddenFiles || !e.isHidden)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    const oldNodesMap = new Map(rootNodes.value.map(n => [n.path, n]))
    rootNodes.value = newNodes.map(newNode => {
      return oldNodesMap.has(newNode.path) ? oldNodesMap.get(newNode.path) : newNode
    })
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('文件夹创建失败: ' + (err.message || err))
  }
}
</script>

<style scoped>
.global-file-tree {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.tree-root-path {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  padding: 8px 8px 8px 12px;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.root-path-top {
  display: flex;
  align-items: center;
  position: relative;
}

.history-trigger-btn {
  height: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: #8C93A6;
  border-radius: 3px;
  transition: background 0.15s;
  flex-shrink: 0;
}

.history-trigger-btn:hover:not(:disabled) {
  background: #F0F2F5;
}

.history-trigger-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.root-path-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  max-width: 112px;
}

.root-path-label {
  font-size: 13px;
  color: #2F3547;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-path-arrow {
  color: #8C93A6;
  flex-shrink: 0;
}

.root-path-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  visibility: hidden;
}

.tree-root-path:hover .root-path-actions {
  visibility: visible;
}

.action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #8C93A6;
  border-radius: 4px;
  transition: all 0.15s;
}

.action-btn:hover {
  background: #F0F2F5;
  color: #436FF6;
}

.action-icon {
  width: 16px;
  height: 16px;
}

.root-path-full {
  font-size: 13px;
  color: #91949E;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
  transform: translateZ(0);
  will-change: scroll-position;
}

.tree-scroll::-webkit-scrollbar {
  width: 4px;
}

.tree-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.tree-scroll::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}

.tree-loading {
  padding: 14px 16px;
  font-size: 12px;
  color: #8C93A6;
}

.tree-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 0px 20px;
  margin-top: 218px;
}

.tree-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon-img {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.tree-empty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 142px;
  height: 32px;
  background: rgba(47, 53, 71, 0.06);
  border: none;
  border-radius: 8px;
  color: #2F3547;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.tree-empty-btn:hover {
  background: rgba(47, 53, 71, 0.12);
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
