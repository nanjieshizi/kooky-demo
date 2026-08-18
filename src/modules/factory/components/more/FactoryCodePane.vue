<template>
  <!-- 代码 Tab：工具栏 + 左文件树 + 右(多文件Tab + 编辑器) -->
  <div class="factory-code-pane">
    <!-- 工具栏 -->
    <div class="code-toolbar">
      <span class="toolbar-title">📁 {{ agentName }}</span>
      <div class="toolbar-ops">
        <button class="tool-btn" title="新建文件" @click="handleNewFile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
        <button class="tool-btn" title="新建文件夹" @click="handleNewFolder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </button>
        <button class="tool-btn" title="上传文件" @click="triggerUpload">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button class="tool-btn" title="下载当前文件" @click="handleDownload">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <span class="tool-divider"></span>
        <button class="tool-btn" :title="collapsed ? '展开全部' : '折叠全部'" @click="toggleCollapse">
          <svg v-if="!collapsed" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
          </svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          </svg>
        </button>
      </div>
      <input ref="uploadInput" type="file" class="hidden-upload" @change="onUploadChange" />
    </div>

    <div class="code-main">
      <FactoryFileTree class="code-pane-tree" />
      <div class="code-pane-divider"></div>
      <div class="code-pane-right">
        <!-- 多文件 Tab -->
        <div v-if="openCodeFiles.length" class="file-tabs">
          <div
            v-for="path in openCodeFiles"
            :key="path"
            class="file-tab"
            :class="{ active: selectedCodePath === path }"
            @click="factoryStore.selectCodePath(path)"
          >
            <span class="file-tab-icon">{{ fileIcon(path) }}</span>
            <span class="file-tab-name">{{ fileName(path) }}</span>
            <span class="file-tab-close" @click.stop="factoryStore.closeCodeFile(path)">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
        </div>
        <FactoryFileEditor class="code-pane-editor" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'FactoryCodePane' })

import { computed, provide, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFactoryStore } from '../../store'
import FactoryFileTree from '../FactoryFileTree.vue'
import FactoryFileEditor from '../FactoryFileEditor.vue'

const factoryStore = useFactoryStore()

const agentName = computed(() => factoryStore.currentAgent?.name || 'Agent')
const openCodeFiles = computed(() => factoryStore.openCodeFiles)
const selectedCodePath = computed(() => factoryStore.selectedCodePath)

// 折叠/展开联动：通过 provide 控制递归文件树
const collapsed = ref(false)
const treeControl = reactive({ token: 0, expand: true })
provide('factoryCodeTreeControl', treeControl)
function toggleCollapse() {
  collapsed.value = !collapsed.value
  treeControl.expand = !collapsed.value
  treeControl.token += 1
}

function fileName(path) {
  return path ? path.split('/').pop() : ''
}
function fileIcon(path) {
  const n = fileName(path)
  if (/\.md$/i.test(n)) return '📄'
  if (/\.json$/i.test(n)) return '🔧'
  if (/\.ya?ml$/i.test(n)) return '⚙️'
  if (/\.py$/i.test(n)) return '🐍'
  return '📃'
}

async function handleNewFile() {
  try {
    const { value } = await ElMessageBox.prompt('请输入文件名（可含路径，如 skills/new.py）', '新建文件', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: 'new-file.md',
    })
    const name = (value || '').trim()
    if (!name) return
    factoryStore.createCodeNode(null, name, 'file')
    ElMessage.success(`已创建 ${name}`)
  } catch { /* 取消 */ }
}

async function handleNewFolder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: 'new-folder',
    })
    const name = (value || '').trim()
    if (!name) return
    factoryStore.createCodeNode(null, name, 'folder')
    ElMessage.success(`已创建文件夹 ${name}`)
  } catch { /* 取消 */ }
}

const uploadInput = ref(null)
function triggerUpload() {
  uploadInput.value?.click()
}
function onUploadChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    factoryStore.createCodeNode(null, file.name, 'file')
    factoryStore.updateCodeFile(file.name, String(reader.result || ''), false)
    factoryStore.selectCodePath(file.name)
    ElMessage.success(`已上传 ${file.name}`)
  }
  reader.readAsText(file)
  e.target.value = ''
}

function handleDownload() {
  const path = selectedCodePath.value
  const entry = factoryStore.getCodeFile(path)
  if (!path || !entry) {
    ElMessage.warning('请先选择一个文件')
    return
  }
  const blob = new Blob([entry.content || ''], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(path)
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已下载 ${fileName(path)}`)
}
</script>

<style lang="scss" scoped>
.factory-code-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  flex-shrink: 0;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-ops {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover { background: rgba(99, 102, 241, 0.1); color: #4f46e5; }
}

.tool-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 4px;
}

.hidden-upload { display: none; }

.code-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.code-pane-tree {
  flex: 0 0 230px;
  width: 230px;
}

.code-pane-divider {
  flex: 0 0 1px;
  background: rgba(0, 0, 0, 0.06);
}

.code-pane-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-tabs {
  display: flex;
  align-items: center;
  height: 34px;
  background: #f7f8fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  overflow-x: auto;
  flex-shrink: 0;

  &::-webkit-scrollbar { display: none; }
}

.file-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 10px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.12s;

  &:hover { background: rgba(0, 0, 0, 0.03); }

  &.active {
    background: #fafafa;
    color: #1f2937;
    font-weight: 500;
    box-shadow: inset 0 -2px 0 #6366f1;
  }
}

.file-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  color: #9ca3af;

  &:hover { background: rgba(0, 0, 0, 0.1); color: #ef4444; }
}

.code-pane-editor {
  flex: 1;
  min-height: 0;
}
</style>
