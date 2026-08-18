<template>
  <div class="tree-node">
    <!-- 节点行 -->
    <div
      class="tree-node-row"
      :class="{
        'drop-before': dropPosition === 'before',
        'drop-after': dropPosition === 'after',
        'drop-inside': dropPosition === 'inside',
        'selected': node.id === selectedId,
      }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      draggable="true"
      @click="handleClick"
      @mouseenter="isHovered = true"
      @mouseleave="handleMouseLeave"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- 展开箭头 -->
      <span class="tree-arrow" :class="{ invisible: node.type !== 'folder' }">
        <img :src="node.isOpen ? expandIcon : collapseIcon" width="14" height="14" alt="" />
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
            @blur="handleRenameBlur"
            @keyup.enter="confirmRename"
            @keyup.esc="cancelRename"
          />
        </div>
      </div>
      <span v-else class="tree-name" :title="node.name">{{ node.name }}</span>

      <!-- 操作按钮（hover 时显示） -->
      <div v-if="isHovered || isDropdownOpen" class="tree-actions" @click.stop>
        <!-- 新建子文件夹（仅文件夹显示） -->
        <el-dropdown
          v-if="node.type === 'folder'"
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

        <!-- 更多操作 -->
        <el-dropdown
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
              <el-dropdown-item command="delete" class="delete-item">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 子节点 -->
    <template v-if="node.type === 'folder' && node.isOpen">
      <!-- 新建子文件夹内联输入框 -->
      <div v-if="creatingChild" :style="{ paddingLeft: `${(depth + 1) * 16 + 8 + 20 + 6}px` }" class="inline-create-row">
        <div class="rename-input-wrap">
          <input
            ref="childInputRef"
            v-model="childFolderName"
            class="rename-input"
            placeholder="文件夹名称"
            @keydown.enter="confirmChildFolder"
            @keydown.esc="cancelChildFolder"
            @blur="confirmChildFolder"
          />
        </div>
      </div>
      <TeamFileNode
        v-for="child in childNodes"
        :key="child.id"
        :node="child"
        :space-id="spaceId"
        :all-nodes="allNodes"
        :depth="depth + 1"
        :selected-id="selectedId"
        @toggle="$emit('toggle', $event)"
        @rename="(nodeId, newName) => $emit('rename', nodeId, newName)"
        @delete="$emit('delete', $event)"
        @create-folder="(parentId, name) => $emit('create-folder', parentId, name)"
        @move="$emit('move', $event)"
        @preview="$emit('preview', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'

import addIcon from '@/assets/home/add.svg'
import moreIcon from '@/assets/home/more.svg'
import expandIcon from '@/assets/home/expand.svg'
import collapseIcon from '@/assets/home/collapse.svg'
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'

const props = defineProps({
  node: { type: Object, required: true },
  spaceId: { type: String, required: true },
  allNodes: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 },
  selectedId: { type: String, default: null },
})

const emit = defineEmits(['toggle', 'rename', 'delete', 'create-folder', 'move', 'preview'])

// 按 order 排序的子节点
const childNodes = computed(() =>
  props.allNodes
    .filter(n => n.parentId === props.node.id)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
)

const fileIconSrc = computed(() => {
  if (props.node.type === 'folder') return folderIcon
  const ext = (props.node.name || '').split('.').pop()?.toLowerCase()
  if (ext === 'md') return mdIcon
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'sh', 'php', 'rb', 'swift', 'kt', 'html', 'css', 'scss', 'json']
  if (codeExts.includes(ext)) return codeIcon
  const richTextExts = ['docx', 'doc', 'pdf', 'rtf', 'odt']
  if (richTextExts.includes(ext)) return richTextIcon
  const pictureExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  if (pictureExts.includes(ext)) return pictureIcon
  return textIcon
})

function handleClick() {
  if (props.node.type === 'folder') {
    emit('toggle', props.node.id)
  } else {
    emit('preview', props.node)
  }
}

// ─── hover / dropdown 状态 ────────────────────────────────────────────────────
const isHovered = ref(false)
const isDropdownOpen = ref(false)

function handleMouseLeave() {
  if (!isDropdownOpen.value) isHovered.value = false
}

// ─── 重命名 ───────────────────────────────────────────────────────────────────
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref(null)
const isRenamingJustStarted = ref(false)
let renameBlurTimer = null

function startRename() {
  isRenaming.value = true
  isRenamingJustStarted.value = true
  renameValue.value = props.node.name
  nextTick(() => {
    setTimeout(() => {
      renameInputRef.value?.focus()
      renameInputRef.value?.select()
    }, 50)
    setTimeout(() => { isRenamingJustStarted.value = false }, 500)
  })
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
  const val = renameValue.value.trim()
  if (val && val !== props.node.name) {
    emit('rename', props.node.id, val)
  }
  cancelRename()
}

function cancelRename() {
  isRenaming.value = false
  renameValue.value = ''
}

// ─── 新建子文件夹（内联） ──────────────────────────────────────────────────────
const creatingChild = ref(false)
const childFolderName = ref('')
const childInputRef = ref(null)

function handleCreateCommand(command) {
  if (command === 'newFolder') {
    if (!props.node.isOpen) {
      emit('toggle', props.node.id)
    }
    creatingChild.value = true
    childFolderName.value = ''
    nextTick(() => childInputRef.value?.focus())
  }
}

function confirmChildFolder() {
  const name = childFolderName.value.trim()
  if (name) emit('create-folder', props.node.id, name)
  cancelChildFolder()
}

function cancelChildFolder() {
  creatingChild.value = false
  childFolderName.value = ''
}

// ─── 更多操作 ─────────────────────────────────────────────────────────────────
function handleMoreCommand(command) {
  if (command === 'rename') startRename()
  else if (command === 'delete') emit('delete', props.node.id)
}

// ─── 拖拽排序 ─────────────────────────────────────────────────────────────────
// 'before' | 'after' | 'inside' | null
const dropPosition = ref(null)
let rafId = null

function handleDragStart(e) {
  window.__teamDragNode = props.node
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', props.node.id)
}

function handleDragEnd() {
  window.__teamDragNode = null
  dropPosition.value = null
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

function handleDragOver(e) {
  // 必须无条件 preventDefault，浏览器才允许 drop（否则 dropEffect=none，拖不动）
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'

  const src = window.__teamDragNode
  if (!src || src.id === props.node.id) return
  if (src.type === 'folder' && isDescendant(src.id, props.node.id)) return

  // RAF 节流：避免高频 dragover 触发大量 Vue 响应式更新
  if (rafId) return
  const clientY = e.clientY
  const rect = e.currentTarget.getBoundingClientRect()
  rafId = requestAnimationFrame(() => {
    rafId = null
    const relY = clientY - rect.top
    const ratio = relY / rect.height
    if (ratio < 0.33) dropPosition.value = 'before'
    else if (ratio > 0.67) dropPosition.value = 'after'
    else dropPosition.value = props.node.type === 'folder' ? 'inside' : (ratio < 0.5 ? 'before' : 'after')
  })
}

function handleDragLeave(e) {
  // 只在真正离开当前行时清除（排除进入子元素时触发的 leave）
  const rect = e.currentTarget.getBoundingClientRect()
  if (
    e.clientX < rect.left || e.clientX > rect.right ||
    e.clientY < rect.top || e.clientY > rect.bottom
  ) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    dropPosition.value = null
  }
}

function handleDrop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  const src = window.__teamDragNode
  const pos = dropPosition.value
  dropPosition.value = null
  window.__teamDragNode = null

  if (!src || !pos || src.id === props.node.id) return
  if (src.type === 'folder' && isDescendant(src.id, props.node.id)) return

  if (pos === 'inside') {
    // 拖入文件夹：移到该文件夹末尾
    const childCount = props.allNodes.filter(n => n.parentId === props.node.id).length
    emit('move', { nodeId: src.id, newParentId: props.node.id, newIndex: childCount })
  } else {
    // 同层排序：插入到目标节点的前 or 后
    const parentId = props.node.parentId ?? null
    const siblings = props.allNodes
      .filter(n => n.parentId === parentId)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    // 从 siblings 中移除 src（若同层）
    const srcIdx = siblings.findIndex(n => n.id === src.id)
    if (srcIdx !== -1) siblings.splice(srcIdx, 1)
    const insertIdx = siblings.findIndex(n => n.id === props.node.id)
    const finalIdx = pos === 'before' ? insertIdx : insertIdx + 1
    emit('move', { nodeId: src.id, newParentId: parentId, newIndex: Math.max(0, finalIdx) })
  }
}

onUnmounted(() => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
})

// 检查 targetId 是否是 ancestorId 的子孙节点
function isDescendant(ancestorId, targetId) {
  return props.allNodes
    .filter(n => n.parentId === ancestorId)
    .some(n => n.id === targetId || isDescendant(n.id, targetId))
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-node-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 12px;
  padding-right: 48px;
  overflow: hidden;
  min-width: 0;
  transition: background 0.1s;
}

.tree-node-row:hover {
  background: #F5F6F9;
}

.tree-node-row.selected {
  background: #FFF1EA;
}

.tree-node-row.selected:hover {
  background: #F5F6F9;
}

/* 拖入文件夹高亮 */
.tree-node-row.drop-inside {
  background: rgba(67, 111, 246, 0.08) !important;
  outline: 1px dashed #436FF6;
  outline-offset: -1px;
}

/* 节点上方插入线 */
.tree-node-row.drop-before::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #436FF6;
  border-radius: 1px;
  pointer-events: none;
}

/* 节点下方插入线 */
.tree-node-row.drop-after::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #436FF6;
  border-radius: 1px;
  pointer-events: none;
}

.tree-arrow {
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #2F3547;
}

.rename-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.rename-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid #D0D5DD;
  border-radius: 4px;
  background: #fff;
  height: 24px;
  overflow: hidden;

  &:focus-within {
    border-color: #436FF6;
  }
}

.rename-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  font-size: 13px;
  font-family: inherit;
  color: #2F3547;
  border: none;
  outline: none;
  background: transparent;
}

.tree-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.action-btn img {
  width: 16px;
  height: 16px;
}

.inline-create-row {
  padding: 2px 12px 2px 0;
}
</style>

<style>
.file-tree-dropdown {
  background: #fff !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  padding: 6px !important;
  min-width: 110px !important;
  max-width: 360px !important;
  width: max-content !important;
}

.file-tree-dropdown .el-dropdown-menu__item {
  color: #2F3547 !important;
  font-size: 14px !important;
  padding: 8px 6px !important;
  border-radius: 6px !important;
  margin: 2px 0 !important;
  height: 32px !important;
  line-height: 16px !important;
  display: flex !important;
  align-items: center !important;
  white-space: nowrap !important;
}

.file-tree-dropdown .el-dropdown-menu__item:hover,
.file-tree-dropdown .el-dropdown-menu__item:focus {
  background: #F5F6F9 !important;
}

.file-tree-dropdown .el-dropdown-menu__item.delete-item {
  color: #FF4D4F !important;
}

.file-tree-dropdown .el-dropdown-menu__item.delete-item:hover,
.file-tree-dropdown .el-dropdown-menu__item.delete-item:focus {
  background: #F5F6F9 !important;
}
</style>
