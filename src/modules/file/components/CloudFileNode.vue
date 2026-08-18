<template>
  <div class="cloud-node">
    <div
      class="cloud-node-row"
      :class="{ selected: node.nodeId === selectedNodeId, 'drag-over': isDragOver }"
      :style="{ paddingLeft: `${depth * 16 + 32}px` }"
      :draggable="isDraggable"
      @click="handleClick"
      @mouseenter="isHovered = true"
      @mouseleave="handleMouseLeave"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 展开箭头 -->
      <span class="tree-arrow" :class="{ invisible: node.nodeType === 'file' }">
        <span v-if="isLoading" class="loading-dot" />
        <img
          v-else
          :src="isExpanded ? expandIcon : collapseIcon"
          width="14"
          height="14"
          alt=""
        />
      </span>

      <!-- 图标 -->
      <img :src="fileIconSrc" class="tree-icon-img" :alt="node.name" />

      <!-- 文件名或重命名输入框 -->
      <div v-if="isRenaming" class="rename-container" @click.stop @mousedown.stop>
        <div class="rename-input-wrap" tabindex="-1">
          <input
            ref="renameInputRef"
            v-model="renameValue"
            class="rename-input"
            @focus="isRenamingJustStarted = false"
            @blur="handleRenameBlur"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            @keyup.enter="confirmRename"
            @keyup.esc="cancelRename"
          />
        </div>
      </div>
      <span v-else class="tree-name" :title="node.name">{{ node.name }}</span>

      <!-- 操作按钮（hover 时显示） -->
      <div v-if="(isHovered || isDropdownOpen) && canEdit" class="tree-actions" @click.stop>
        <!-- 新建文件夹下拉菜单（支持 dir 和 team_root） -->
        <el-dropdown
          v-if="node.nodeType === 'dir' || node.nodeType === 'team_root'"
          trigger="click"
          :teleported="true"
          @command="handleCreateCommand"
          @visible-change="v => { isDropdownOpen = v }"
        >
          <button class="action-btn">
            <img :src="addIcon" alt="新建" />
          </button>
          <template #dropdown>
            <el-dropdown-menu class="file-tree-dropdown">
              <el-dropdown-item command="newFolder">新建文件夹</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 更多操作下拉菜单（排除 team_root） -->
        <el-dropdown
          v-if="node.nodeType !== 'team_root'"
          trigger="click"
          :teleported="true"
          placement="bottom-end"
          :popper-offset="0"
          popper-class="file-tree-dropdown-popper"
          @command="handleMoreCommand"
          @visible-change="v => { isDropdownOpen = v }"
        >
          <button class="action-btn">
            <img :src="moreIcon" alt="更多" />
          </button>
          <template #dropdown>
            <el-dropdown-menu class="file-tree-dropdown">
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="delete" class="danger-item">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 子节点（展开时显示） -->
    <template v-if="isExpanded">
      <template v-if="children.length > 0">
        <CloudFileNode
          v-for="child in children"
          :key="child.nodeId"
          :node="child"
          :depth="depth + 1"
          :person-biz-id="personBizId"
          :teams="teams"
          :selected-node-id="selectedNodeId"
          :parent-node-id="node.nodeId"
          @preview="$emit('preview', $event)"
          @rename="$emit('rename', $event)"
          @delete="$emit('delete', $event)"
          @create-folder="$emit('create-folder', $event)"
          @select="$emit('select', $event)"
          @move="$emit('move', $event)"
        />
      </template>
      <div v-else-if="!isLoading" class="node-empty" :style="{ paddingLeft: `${(depth + 1) * 16 + 32}px` }">暂无文件</div>
    </template>

    <!-- 新建子文件夹输入框 -->
    <div v-if="creatingFolder" :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }" class="inline-create">
      <div class="rename-input-wrap">
        <input
          ref="createInputRef"
          v-model="newFolderName"
          class="rename-input"
          placeholder="文件夹名称"
          @focus="isCreatingJustStarted = false"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @keydown.enter="confirmCreateFolder"
          @keydown.esc="cancelCreateFolder"
          @blur="handleCreateBlur"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFileStore } from '@/modules/file/store'
import expandIcon from '@/assets/home/expand.svg'
import collapseIcon from '@/assets/home/collapse.svg'
import addIcon from '@/assets/home/add.svg'
import moreIcon from '@/assets/home/more.svg'
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'

// 递归组件需要显式引用自身
import CloudFileNode from './CloudFileNode.vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  personBizId: { type: String, default: '' },
  teams: { type: Array, default: () => [] },
  selectedNodeId: { type: String, default: null },
  canEdit: { type: Boolean, default: true },
  parentNodeId: { type: String, default: null },
})

const emit = defineEmits(['preview', 'rename', 'delete', 'create-folder', 'select', 'move'])

const fileStore = useFileStore()

const isHovered = ref(false)
const isDropdownOpen = ref(false)
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref(null)
const isRenamingJustStarted = ref(false) // 防止刚开始重命名时被 dropdown 关闭抢焦点导致立即失焦
let renameBlurTimer = null // 重命名输入框 blur 防抖计时器
const creatingFolder = ref(false)
const newFolderName = ref('')
const createInputRef = ref(null)
const isDragOver = ref(false)
const isComposing = ref(false) // 输入法组合状态（用于 macOS 中文输入法兼容）
const isCreatingJustStarted = ref(false) // 防止刚开始新建时被 dropdown 关闭/子节点渲染抢焦点导致立即失焦
let createBlurTimer = null // 新建输入框 blur 防抖计时器

const isDraggable = computed(() =>
  props.node.nodeType === 'dir' || props.node.nodeType === 'file'
)

function canDrop(dragNode, targetNode) {
  if (!dragNode || !targetNode) return false
  if (dragNode.nodeId === targetNode.nodeId) return false
  // 目标必须是文件夹类型
  if (targetNode.nodeType !== 'dir' && targetNode.nodeType !== 'team_root') return false
  // person 区域：目标也是 person 类型即可
  if (dragNode.businessType === 'person') {
    return targetNode.businessType === 'person'
  }
  // opt（一人团队）区域：必须同一 businessId
  if (dragNode.businessType === 'opt') {
    return targetNode.businessType === 'opt' && dragNode.businessId === targetNode.businessId
  }
  // team（协作）区域：必须同一 businessId
  if (dragNode.businessType === 'team') {
    return targetNode.businessType === 'team' && dragNode.businessId === targetNode.businessId
  }
  return false
}

function handleDragStart(e) {
  window.__cloudDragNode = { node: props.node, parentNodeId: props.parentNodeId }
  e.dataTransfer.effectAllowed = 'all'
  e.dataTransfer.setData('text/plain', props.node.nodeId)
  if (props.node.nodeType === 'file') {
    e.dataTransfer.setData('application/x-cloud-file-node', JSON.stringify({
      fileId: props.node.fileId,
      businessId: props.node.businessId,
      name: props.node.name,
      mimeType: props.node.mimeType,
      fileSize: props.node.fileSize,
    }))
  }
}

function handleDragEnd() {
  window.__cloudDragNode = null
  isDragOver.value = false
}

function handleDragOver(e) {
  const src = window.__cloudDragNode
  if (!src) return
  if (!canDrop(src.node, props.node)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

function handleDrop(e) {
  isDragOver.value = false
  const src = window.__cloudDragNode
  window.__cloudDragNode = null
  if (!src) return
  if (!canDrop(src.node, props.node)) return
  e.preventDefault()
  emit('move', { dragNode: src.node, targetNode: props.node, dragParentNodeId: src.parentNodeId })
}


const isExpanded = computed(() =>
  fileStore.cloudTree.expandedNodeIds.includes(props.node.nodeId)
)

const isLoading = computed(() =>
  fileStore.cloudTree.loadingNodeIds.includes(props.node.nodeId)
)

const children = computed(() =>
  fileStore.cloudTree.nodeCache[props.node.nodeId] ?? []
)

const fileIconSrc = computed(() => {
  if (props.node.nodeType === 'dir' || props.node.nodeType === 'team_root') return folderIcon
  const ext = (props.node.suffix || props.node.name || '').split('.').pop()?.toLowerCase()
  if (ext === 'md') return mdIcon
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'sh', 'php', 'rb', 'swift', 'kt', 'html', 'css', 'scss', 'json']
  if (codeExts.includes(ext)) return codeIcon
  const richTextExts = ['docx', 'doc', 'pdf', 'rtf', 'odt']
  if (richTextExts.includes(ext)) return richTextIcon
  const pictureExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  if (pictureExts.includes(ext)) return pictureIcon
  return textIcon
})

function handleMouseLeave() {
  if (!isDropdownOpen.value) isHovered.value = false
}

async function handleClick() {
  if (props.node.nodeType === 'file') {
    emit('select', props.node)
    emit('preview', props.node)
    return
  }
  if (props.node.nodeType === 'dir' || props.node.nodeType === 'team_root') {
    await fileStore.toggleCloudNode(props.node.nodeId, props.personBizId, props.teams)
  }
}

function handleCreateCommand(command) {
  if (command === 'newFolder') {
    if (!isExpanded.value) {
      fileStore.expandCloudNode(props.node.nodeId, props.personBizId, props.teams)
    }
    creatingFolder.value = true
    newFolderName.value = ''
    isCreatingJustStarted.value = true
    // 延迟聚焦，避开 dropdown 关闭动画与子节点首帧渲染抢焦点
    setTimeout(() => {
      createInputRef.value?.focus()
    }, 50)
    // 兜底：500ms 后强制解除保护，防止 focus 事件未触发时卡死
    setTimeout(() => {
      isCreatingJustStarted.value = false
    }, 500)
  }
}

async function confirmCreateFolder() {
  // 输入法组合中，忽略回车（macOS 中文输入法兼容）
  if (isComposing.value) return

  const name = newFolderName.value.trim()
  if (!name) { cancelCreateFolder(); return }
  emit('create-folder', { parentNodeId: props.node.nodeId, name, businessType: props.node.businessType, businessId: props.node.businessId })
  cancelCreateFolder()
}

// 处理新建输入框失焦：忽略刚开始时的抢占失焦 + 防抖兼容焦点短暂转移
function handleCreateBlur() {
  if (isCreatingJustStarted.value) return
  clearTimeout(createBlurTimer)
  createBlurTimer = setTimeout(() => {
    if (document.activeElement === createInputRef.value) return
    confirmCreateFolder()
  }, 150)
}

function cancelCreateFolder() {
  clearTimeout(createBlurTimer)
  creatingFolder.value = false
  newFolderName.value = ''
  isCreatingJustStarted.value = false
}

function handleMoreCommand(command) {
  if (command === 'rename') {
    isRenaming.value = true
    renameValue.value = props.node.name
    isRenamingJustStarted.value = true
    // 延迟聚焦，避开 dropdown 关闭动画抢焦点
    setTimeout(() => {
      renameInputRef.value?.focus()
      renameInputRef.value?.select?.()
    }, 50)
    // 兜底：500ms 后强制解除保护，防止 focus 事件未触发时卡死
    setTimeout(() => {
      isRenamingJustStarted.value = false
    }, 500)
  } else if (command === 'delete') {
    emit('delete', props.node)
  }
}

function handleRenameBlur() {
  if (isRenamingJustStarted.value) return
  clearTimeout(renameBlurTimer)
  renameBlurTimer = setTimeout(() => {
    if (document.activeElement === renameInputRef.value) return
    confirmRename()
  }, 150)
}

function confirmRename() {
  // 输入法组合中，忽略回车（macOS 中文输入法兼容）
  if (isComposing.value) return

  const name = renameValue.value.trim()
  if (name && name !== props.node.name) {
    emit('rename', { node: props.node, newName: name })
  }
  isRenaming.value = false
  isRenamingJustStarted.value = false
}

function cancelRename() {
  clearTimeout(renameBlurTimer)
  isRenaming.value = false
  isRenamingJustStarted.value = false
}
</script>

<style scoped>
.cloud-node {
  user-select: none;
}

.cloud-node-row {
  display: flex;
  align-items: center;
  height: 32px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 4px;
  gap: 4px;
  position: relative;
}

.cloud-node-row:hover {
  background: rgba(47, 53, 71, 0.06);
}

.cloud-node-row.selected {
  background: #FFF1EA;
}

.tree-arrow {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tree-arrow.invisible {
  visibility: hidden;
}

.tree-icon-img {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-right: 4px;
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
  border-radius: 4px;
  padding: 0;
}

.action-btn:hover {
  background: rgba(47, 53, 71, 0.1);
}

.action-btn img {
  width: 14px;
  height: 14px;
}

.rename-container {
  flex: 1;
  min-width: 0;
}

.rename-input-wrap {
  display: flex;
  align-items: center;
}

.rename-input {
  width: 100%;
  height: 24px;
  border: 1px solid #D0D5DD;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 13px;
  outline: none;
  background: #fff;
}

.rename-input:focus {
  border-color: #FF684E;
}

.inline-create {
  display: flex;
  align-items: center;
  height: 32px;
  margin: 0 4px;
}

.inline-create .rename-input-wrap {
  flex: 1;
}

.cloud-node-row.drag-over {
  background: rgba(67, 111, 246, 0.08);
  border-radius: 4px;
}

.node-empty {
  font-size: 12px;
  color: #8C93A6;
  height: 28px;
  display: flex;
  align-items: center;
}

.loading-dot {  display: inline-block;
  width: 8px;
  height: 8px;
  border: 2px solid #436FF6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
