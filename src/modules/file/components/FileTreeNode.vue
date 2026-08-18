<template>
  <div class="tree-node">
    <!-- 节点行 -->
    <div
      class="tree-node-row"
      :class="{ selected: node.path === selectedPath, 'drag-over': isDragOver, 'multi-selected': isMultiSelected }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      draggable="true"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      @mouseenter="!isRenaming && (isHovered = true)"
      @mouseleave="handleMouseLeave"
      @dragstart="handleDragStart"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- 展开箭头（仅文件夹） -->
      <span class="tree-arrow" :class="{ invisible: node.type !== 'directory' }">
        <img :src="isExpanded ? expandIcon : collapseIcon" width="14" height="14" alt="" />
      </span>

      <!-- 图标 -->
      <img v-if="fileIconSrc" :src="fileIconSrc" class="tree-icon-img" :alt="node.name" />
      <span v-else class="tree-icon">{{ fileIcon }}</span>

      <!-- 文件名或重命名输入框 -->
      <div v-if="isRenaming" class="rename-container" @click.stop @mousedown.stop>
        <div class="rename-input-wrap" tabindex="-1" @mousedown="e => { if (e.target !== renameInput) e.preventDefault() }">
          <input
            ref="renameInput"
            v-model="newName"
            class="rename-input"
            :class="{ error: renameError }"
            @focus="isRenamingJustStarted = false"
            @blur="handleRenameBlur"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            @keyup.enter="commitRename"
            @keyup.esc="cancelRename"
          />
          <span v-if="renameSuffix" class="rename-suffix">{{ renameSuffix }}</span>
        </div>
        <span v-if="renameError" class="rename-error">{{ renameError }}</span>
      </div>
      <span v-else class="tree-name" :title="node.name">{{ node.name }}</span>

      <!-- 操作按钮（hover 时显示，重命名时隐藏） -->
      <div v-if="!isRenaming && (isHovered || isDropdownOpen)" class="tree-actions" @click.stop>
        <!-- 新建菜单按钮（仅文件夹显示） -->
        <el-dropdown
          v-if="node.type === 'directory'"
          trigger="click"
          :teleported="true"
          popper-class="file-tree-dropdown-popper"
          @command="handleCreateCommand"
          @visible-change="handleCreateDropdownChange"
        >
          <button class="action-btn">
            <img :src="addIcon" alt="新建" />
          </button>
          <template #dropdown>
            <el-dropdown-menu class="file-tree-dropdown">
              <el-dropdown-item command="newFolder">新建文件夹</el-dropdown-item>
              <el-dropdown-item command="newFile">新建文件</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 更多操作按钮 -->
        <el-dropdown
          trigger="click"
          :teleported="true"
          placement="bottom-end"
          :popper-offset="0"
          popper-class="file-tree-dropdown-popper"
          @command="handleMoreCommand"
          @visible-change="handleMoreDropdownChange"
        >
          <button class="action-btn more-btn">
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

    <!-- 子节点（展开时显示） -->
    <div v-if="isExpanded && children.length > 0">
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :selected-path="selectedPath"
        @select="$emit('select', $event)"
        @refresh="handleChildRefresh"
      />
    </div>

    <!-- 展开中加载状态 -->
    <div v-if="isExpanded && childrenLoading" class="tree-node-loading" :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }">
      加载中...
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
        @click.stop
      >
        <div class="menu-item" @click="handleCreateFile">
          <el-icon><DocumentAdd /></el-icon>
          <span>新建文件</span>
        </div>
      </div>
    </Teleport>

    <!-- 遮罩层 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu-overlay"
        @click="contextMenuVisible = false"
        @contextmenu.prevent="contextMenuVisible = false"
      />
    </Teleport>

    <!-- 删除确认弹框（样式同云端，挂载到 body 避免被父级 overflow 截断） -->
    <el-dialog
      v-model="deleteDialogVisible"
      width="420px"
      :show-close="false"
      align-center
      append-to-body
      :modal-append-to-body="true"
      class="file-delete-dialog"
    >
      <template #header>
        <div class="delete-dialog-header">
          <div class="delete-dialog-header-left">
            <el-icon class="warning-icon"><WarningFilled /></el-icon>
            <span class="delete-dialog-title">{{ deleteDialogTitle }}</span>
          </div>
          <button class="delete-dialog-close" @click="cancelDelete">
            <img :src="closeIcon" width="16" height="16" alt="关闭" />
          </button>
        </div>
      </template>
      <div class="delete-dialog-content">{{ deleteDialogContent }}</div>
      <template #footer>
        <div class="delete-dialog-footer">
          <button class="cancel-btn" @click="cancelDelete">取消</button>
          <button class="confirm-btn" @click="confirmDelete">确定</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, nextTick, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { DocumentAdd, WarningFilled } from '@element-plus/icons-vue'
import { getFileIcon, getFolderIcon } from '@/shared/utils/fileIcons'
import { useUIStore } from '@/modules/space/uiStore'
import {
  REGISTER_NODE_REFRESH_KEY,
  TRIGGER_NODE_REFRESH_KEY,
  TOGGLE_SELECT_KEY,
  SELECTED_NODES_MAP_KEY,
  SELECTED_PATHS_KEY,
  EXPANDED_PATHS_KEY
} from '@/shared/constants/injectionKeys'

// 导入 SVG 图标
import folderIcon from '@/assets/home/folderTree.svg'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'
import addIcon from '@/assets/home/add.svg'
import moreIcon from '@/assets/home/more.svg'
import expandIcon from '@/assets/home/expand.svg'
import collapseIcon from '@/assets/home/collapse.svg'
import closeIcon from '@/assets/home/close.svg'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  selectedPath: { type: String, default: '' },
})

const emit = defineEmits(['select', 'refresh'])

function joinPath(dir, name) {
  const sep = dir.includes('/') ? '/' : '\\'
  return dir.endsWith(sep) ? dir + name : dir + sep + name
}

const registerNodeRefresh = inject(REGISTER_NODE_REFRESH_KEY, null)
const triggerNodeRefresh = inject(TRIGGER_NODE_REFRESH_KEY, null)
const toggleSelect = inject(TOGGLE_SELECT_KEY, null)
const selectedNodesMap = inject(SELECTED_NODES_MAP_KEY, null)
const injectedSelectedPaths = inject(SELECTED_PATHS_KEY, null)
const injectedExpandedPaths = inject(EXPANDED_PATHS_KEY, null)
const uiStore = useUIStore()

// 如果是目录节点，向全局注册刷新回调
onMounted(() => {
  if (props.node.type === 'directory' && registerNodeRefresh) {
    const unregister = registerNodeRefresh(props.node.path, async () => {
      if (isExpanded.value) {
        childrenLoading.value = true
        try {
          const entries = await window.electronAPI.fs.readDir(props.node.path)
          children.value = entries
            .filter(e => uiStore.showHiddenFiles || !e.isHidden)
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
              return a.name.localeCompare(b.name)
            })
        } catch (err) {
          console.error('刷新目录失败:', err)
        } finally {
          childrenLoading.value = false
        }
      } else {
        children.value = []
      }
    })
    onUnmounted(() => unregister())
  }
})

const isExpanded = ref(false)
const children = ref([])
const childrenLoading = ref(false)
const isHovered = ref(false)
const isDropdownOpen = ref(false)
const isRenaming = ref(false)
const newName = ref('')
const renameSuffix = ref('') // 文件扩展名，重命名时只读保留
const renameError = ref('')
const renameInput = ref(null)
const isDragOver = ref(false)
const isRenamingJustStarted = ref(false) // 防止刚开始重命名时立即失焦
const isComposing = ref(false) // 输入法组合状态（用于 macOS 中文输入法兼容）
let renameBlurTimer = null // blur 防抖计时器

// 多选状态（通过 inject 读取父级 ref，确保响应式）
const isMultiSelected = computed(() => injectedSelectedPaths?.value?.has?.(props.node.path) && injectedSelectedPaths.value.size > 1)

// 监听 expandedPaths 变化，自动展开需要展开的目录节点
watch(() => injectedExpandedPaths?.value, async (expandedSet) => {
  if (props.node.type === 'directory' && expandedSet?.has(props.node.path) && !isExpanded.value) {
    // 自动展开该目录
    await toggleExpand()
  }
}, { deep: true })

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 根据文件类型返回 SVG 图标路径
const fileIconSrc = computed(() => {
  // 文件夹
  if (props.node.type === 'directory') {
    return folderIcon
  }

  const ext = props.node.name.split('.').pop()?.toLowerCase()

  // .md 格式
  if (ext === 'md') {
    return mdIcon
  }

  // 代码格式
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'svelte', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'sh', 'bash', 'zsh', 'php', 'rb', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'less', 'sass']
  if (codeExts.includes(ext)) {
    return codeIcon
  }

  // 富文本格式
  const richTextExts = ['docx', 'doc', 'pdf', 'rtf', 'odt', 'pages']
  if (richTextExts.includes(ext)) {
    return richTextIcon
  }

  // 图片格式
  const pictureExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif']
  if (pictureExts.includes(ext)) {
    return pictureIcon
  }

  // 纯文本格式
  const textExts = ['txt', 'log', 'csv', 'xml', 'yaml', 'yml', 'json', 'ini', 'conf', 'config', 'env']
  if (textExts.includes(ext)) {
    return textIcon
  }

  // 默认使用文本图标
  return textIcon
})

// 根据文件扩展名返回对应图标
const fileIcon = computed(() => {
  if (props.node.type === 'directory') {
    return getFolderIcon(isExpanded.value)
  }
  return getFileIcon(props.node.name)
})

// 展开目录（懒加载子节点）
async function toggleExpand() {
  if (props.node.type !== 'directory') return
  if (isExpanded.value) {
    isExpanded.value = false
    return
  }
  if (children.value.length === 0) {
    childrenLoading.value = true
    try {
      const entries = await window.electronAPI.fs.readDir(props.node.path)
      children.value = entries
        .filter(e => uiStore.showHiddenFiles || !e.isHidden)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    } catch (err) {
      console.error('读取目录失败:', err)
    } finally {
      childrenLoading.value = false
    }
  }
  isExpanded.value = true
}

async function handleClick(event) {
  const isMac = navigator.platform?.includes('Mac')
  const isMultiKey = event ? (isMac ? event.metaKey : event.ctrlKey) : false

  // 多选模式：Ctrl/Cmd+Click
  if (isMultiKey && toggleSelect) {
    toggleSelect(props.node, event)
    return
  }

  emit('select', props.node)

  if (props.node.type === 'directory') {
    await toggleExpand()
  }
}

// 右键菜单处理
function handleContextMenu(event) {
  event.preventDefault()
  // 只对目录显示右键菜单
  if (props.node.type !== 'directory') return

  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

// 处理鼠标离开节点行
function handleMouseLeave() {
  // 重命名期间不改变 hover 状态，避免 DOM 变化导致输入框失焦
  if (isRenaming.value) return
  // 只有当下拉菜单没有打开时，才隐藏操作按钮
  if (!isDropdownOpen.value) {
    isHovered.value = false
  }
}

// 处理新建下拉菜单可见性变化
function handleCreateDropdownChange(visible) {
  isDropdownOpen.value = visible
  // 下拉菜单关闭时，如果鼠标不在节点上，隐藏操作按钮
  if (!visible && !isHovered.value && !isRenaming.value) {
    isHovered.value = false
  }
}

// 处理更多操作下拉菜单可见性变化
function handleMoreDropdownChange(visible) {
  isDropdownOpen.value = visible
  // 下拉菜单关闭时，如果鼠标不在节点上，隐藏操作按钮
  if (!visible && !isHovered.value && !isRenaming.value) {
    isHovered.value = false
  }
}

// 将文件系统错误转换为用户友好的提示
function getFsErrorMessage(error) {
  const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error)) || ''
  if (/EPERM|operation not permitted/i.test(msg)) {
    return '没有权限操作此目录，请检查文件夹权限'
  }
  if (/EACCES|access denied/i.test(msg)) {
    return '访问被拒绝，请检查文件夹权限'
  }
  if (/EEXIST/i.test(msg)) {
    return '同名文件已存在'
  }
  if (/ENOENT/i.test(msg)) {
    return '目标路径不存在'
  }
  if (/ENOSPC/i.test(msg)) {
    return '磁盘空间不足'
  }
  // 截取最后一段有效信息，去掉 Electron IPC 前缀
  const match = msg.match(/Error:\s*(.+)$/)
  return match ? match[1] : msg
}

// 新建文件
async function handleCreateFile() {
  contextMenuVisible.value = false
  try {
    const result = await ElMessageBox.prompt('请输入文件名', '新建文件', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /^[^\\/:*?"<>|]+$/,
      inputErrorMessage: '文件名不能包含特殊字符 \\ / : * ? " < > |'
    })

    // 检查目标名称是否已存在
    const entries = await window.electronAPI.fs.readDir(props.node.path)
    const existing = entries.find(e => e.name === result.value)
    if (existing) {
      const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
      ElMessage.error(`"${result.value}" 已存在（${typeLabel}），请使用其他名称`)
      return
    }

    const filePath = joinPath(props.node.path, result.value)
    await window.electronAPI.fs.writeFile(filePath, '', 'utf8')

    ElMessage.success('文件创建成功')
    emit('refresh', props.node.path)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('文件创建失败：' + getFsErrorMessage(error))
    }
  }
}

// 处理新建菜单命令
async function handleCreateCommand(command) {
  const sep = props.node.path.includes('/') ? '/' : '\\'
  const targetPath = props.node.type === 'directory' ? props.node.path : props.node.path.substring(0, props.node.path.lastIndexOf(sep))

  if (command === 'newFolder') {
    try {
      const result = await ElMessageBox.prompt('请输入文件夹名', '新建文件夹', {
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        inputPattern: /^[^\\/:*?"<>|]+$/,
        inputErrorMessage: '文件夹名不能包含特殊字符 \\ / : * ? " < > |'
      })

      // 检查目标名称是否已存在
      const entries = await window.electronAPI.fs.readDir(targetPath)
      const existing = entries.find(e => e.name === result.value)
      if (existing) {
        const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
        ElMessage.error(`"${result.value}" 已存在（${typeLabel}），请使用其他名称`)
        return
      }

      const folderPath = joinPath(targetPath, result.value)
      await window.electronAPI.fs.mkdir(folderPath)

      ElMessage.success('文件夹创建成功')

      // 确保目录展开，然后刷新
      if (props.node.type === 'directory' && !isExpanded.value) {
        await handleClick()
      }

      // 使用 handleChildRefresh 直接刷新当前目录
      await handleChildRefresh(targetPath)
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error('文件夹创建失败：' + getFsErrorMessage(error))
      }
    }
  } else if (command === 'newFile') {
    try {
      const result = await ElMessageBox.prompt('请输入文件名', '新建文件', {
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        inputPattern: /^[^\\/:*?"<>|]+$/,
        inputErrorMessage: '文件名不能包含特殊字符 \\ / : * ? " < > |'
      })

      // 检查目标名称是否已存在
      const entries = await window.electronAPI.fs.readDir(targetPath)
      const existing = entries.find(e => e.name === result.value)
      if (existing) {
        const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
        ElMessage.error(`"${result.value}" 已存在（${typeLabel}），请使用其他名称`)
        return
      }

      const filePath = joinPath(targetPath, result.value)
      await window.electronAPI.fs.writeFile(filePath, '', 'utf8')

      ElMessage.success('文件创建成功')

      // 确保目录展开，然后刷新
      if (props.node.type === 'directory' && !isExpanded.value) {
        await handleClick()
      }

      // 使用 handleChildRefresh 直接刷新当前目录
      await handleChildRefresh(targetPath)
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error('文件创建失败：' + getFsErrorMessage(error))
      }
    }
  }
}

// 处理更多操作命令
async function handleMoreCommand(command) {
  if (command === 'rename') {
    startRename()
  } else if (command === 'delete') {
    deleteDialogVisible.value = true
  }
}

// ─── 删除确认弹框（样式与云端 TeamFilePanel 一致） ────────────────────────────
const deleteDialogVisible = ref(false)

const deleteDialogTitle = computed(() =>
  props.node.type === 'directory' ? '您确认要删除文件夹吗？' : '您确认要删除文件吗？'
)

const deleteDialogContent = computed(() =>
  props.node.type === 'directory'
    ? '删除后子文件夹将同步删除，无法找回'
    : '删除后文件无法找回'
)

function cancelDelete() {
  deleteDialogVisible.value = false
}

async function confirmDelete() {
  try {
    if (props.node.type === 'directory') {
      await window.electronAPI.fs.rmdir(props.node.path)
    } else {
      await window.electronAPI.fs.unlink(props.node.path)
    }

    ElMessage.success('删除成功')
    const sep = props.node.path.includes('/') ? '/' : '\\'
    const parentPath = props.node.path.substring(0, props.node.path.lastIndexOf(sep))

    // 使用 handleChildRefresh 直接刷新父目录，保持其他节点的展开状态
    await handleChildRefresh(parentPath)
  } catch (error) {
    ElMessage.error('删除失败: ' + (error.message || error))
  } finally {
    deleteDialogVisible.value = false
  }
}

// 开始重命名
async function startRename() {
  isRenaming.value = true
  isRenamingJustStarted.value = true
  // 文件：拆分文件名和扩展名，input 只编辑文件名部分
  if (props.node.type !== 'directory') {
    const dotIndex = props.node.name.lastIndexOf('.')
    if (dotIndex > 0) {
      newName.value = props.node.name.substring(0, dotIndex)
      renameSuffix.value = props.node.name.substring(dotIndex)
    } else {
      newName.value = props.node.name
      renameSuffix.value = ''
    }
  } else {
    newName.value = props.node.name
    renameSuffix.value = ''
  }
  renameError.value = ''
  await nextTick()
  // 延迟聚焦，确保 dropdown 关闭动画完成后再抢焦点
  setTimeout(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      renameInput.value.select()
    }
  }, 50)
  // 兜底：500ms 后强制解除保护，防止 focus 事件未触发时卡死
  setTimeout(() => {
    isRenamingJustStarted.value = false
  }, 500)
}

// 取消重命名
function cancelRename() {
  isRenaming.value = false
  newName.value = ''
  renameSuffix.value = ''
  renameError.value = ''
}

// 处理子节点刷新事件：若刷新路径是当前目录，重新加载子节点；否则继续向上冒泡
async function handleChildRefresh(refreshedPath) {
  if (refreshedPath === props.node.path) {
    if (isExpanded.value) {
      childrenLoading.value = true
      try {
        const entries = await window.electronAPI.fs.readDir(props.node.path)
        const newChildren = entries
          .filter(e => uiStore.showHiddenFiles || !e.isHidden)
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
          })

        // 创建旧节点的 path -> node 映射
        const oldNodesMap = new Map(children.value.map(c => [c.path, c]))

        // 构建新的 children 数组，优先使用旧节点对象以保持组件状态
        children.value = newChildren.map(newNode => {
          // 如果旧列表中存在相同 path 的节点，使用旧节点对象
          return oldNodesMap.has(newNode.path) ? oldNodesMap.get(newNode.path) : newNode
        })
      } catch (err) {
        console.error('刷新目录失败:', err)
      } finally {
        childrenLoading.value = false
      }
    } else {
      // 未展开时清除缓存，下次展开时重新加载
      children.value = []
    }
  } else {
    emit('refresh', refreshedPath)
  }
}

// 处理重命名失焦
async function handleRenameBlur() {
  // 如果刚开始重命名，忽略这次 blur 事件
  if (isRenamingJustStarted.value) {
    return
  }

  // 防抖：延迟 150ms 执行，避免焦点短暂转移后又回来时误触发
  clearTimeout(renameBlurTimer)
  renameBlurTimer = setTimeout(async () => {
    // 如果输入框重新获得了焦点，不处理
    if (document.activeElement === renameInput.value) return
    await commitRename()
  }, 150)
}

async function commitRename() {
  // 输入法组合中，忽略回车（macOS 中文输入法兼容）
  if (isComposing.value) return

  const fullNewName = newName.value + renameSuffix.value
  if (fullNewName === props.node.name) {
    cancelRename()
    return
  }

  // 校验文件名（允许表情符号，只禁止文件系统特殊字符）
  const namePattern = /^[^\\/:*?"<>|]+$/
  if (!newName.value || !namePattern.test(newName.value)) {
    renameError.value = '命名错误，请勿包含特殊符号'
    await nextTick()
    if (renameInput.value) {
      renameInput.value.focus()
    }
    return
  }

  try {
    // 获取父目录路径
    const parentPath = props.node.path.substring(0, props.node.path.lastIndexOf(props.node.path.includes('/') ? '/' : '\\'))
    const separator = props.node.path.includes('/') ? '/' : '\\'
    const newPath = parentPath + separator + fullNewName

    await window.electronAPI.fs.rename(props.node.path, newPath)

    ElMessage.success('重命名成功')
    // 重置本地状态，避免子节点继续使用旧路径
    isExpanded.value = false
    children.value = []
    emit('refresh', parentPath)
    cancelRename()
  } catch (error) {
    renameError.value = '重命名失败：' + getFsErrorMessage(error)
    await nextTick()
    if (renameInput.value) {
      renameInput.value.focus()
    }
  }
}

// 拖拽处理
function handleDragStart(e) {
  window.__dragNode = props.node
  e.dataTransfer.effectAllowed = 'all'

  // 判断是否多选拖拽
  const isInMultiSelect = injectedSelectedPaths?.value?.has?.(props.node.path) && injectedSelectedPaths.value.size > 1
  let dragNodes = [props.node]
  let dragPaths = [props.node.path]

  if (isInMultiSelect && selectedNodesMap?.value) {
    dragNodes = Array.from(selectedNodesMap.value.values())
    dragPaths = dragNodes.map(n => n.path)
  }

  // 设置数据供终端 drop 使用（路径含空格时加引号）
  const quotedPaths = dragPaths.map(p => p.includes(' ') ? `"${p}"` : p)
  e.dataTransfer.setData('text/plain', quotedPaths.join(' '))
  e.dataTransfer.setData('application/x-file-tree-nodes', JSON.stringify(
    dragNodes.map(n => ({ path: n.path, name: n.name, type: n.type }))
  ))
}

function handleDragOver(e) {
  const src = window.__dragNode
  if (!src || src.path === props.node.path) return

  const sep = props.node.path.includes('/') ? '/' : '\\'
  if (props.node.type === 'directory' && (props.node.path.startsWith(src.path + sep) || props.node.path === src.path)) return

  isDragOver.value = true
  e.dataTransfer.dropEffect = 'move'
}

function handleDragLeave() {
  isDragOver.value = false
}

async function handleDrop() {
  isDragOver.value = false
  const src = window.__dragNode
  window.__dragNode = null
  if (!src || src.path === props.node.path) return

  const sep = src.path.includes('/') ? '/' : '\\'
  let destDir = props.node.type === 'directory' ? props.node.path : props.node.path.substring(0, props.node.path.lastIndexOf(sep))

  if (destDir === src.path || destDir.startsWith(src.path + sep)) return

  const destPath = destDir + sep + src.name
  if (destPath === src.path) return

  try {
    await window.electronAPI.fs.rename(src.path, destPath)
    ElMessage.success('移动成功')

    const srcParent = src.path.substring(0, src.path.lastIndexOf(sep))
    // 直接触发源父目录和目标目录刷新，无需事件冒泡
    if (triggerNodeRefresh) {
      triggerNodeRefresh(srcParent)
      if (destDir !== srcParent) triggerNodeRefresh(destDir)
    } else {
      emit('refresh', srcParent)
      if (destDir !== srcParent) emit('refresh', destDir)
    }
  } catch (err) {
    ElMessage.error('移动失败: ' + (err.message || err))
  }
}


</script>

<style scoped>
.tree-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 12px;
  transition: background 0.1s;
  padding-left: 20px;
  padding-right: 8px;
  overflow: hidden;
  min-width: 0;
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

.tree-node-row.drag-over {
  background: rgba(67, 111, 246, 0.15);
  outline: 1px dashed #436FF6;
}

.tree-node-row.multi-selected {
  background: rgba(67, 111, 246, 0.08);
}

.tree-node-row.multi-selected:hover {
  background: rgba(67, 111, 246, 0.12);
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

.tree-icon {
  font-size: 13px;
  flex-shrink: 0;
  line-height: 1;
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
    border-color: #FF684E;
  }
}

.rename-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 4px 0 8px;
  font-size: 13px;
  font-family: inherit;
  color: #2F3547;
  border: none;
  outline: none;
  background: transparent;
  line-height: 22px;
}

.rename-suffix {
  flex-shrink: 0;
  padding-right: 6px;
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
  user-select: none;
}

.rename-input.error {
  border-color: #FF4D4F;
}

.rename-error {
  font-size: 12px;
  color: #FF4D4F;
  line-height: 1;
}

.tree-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
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
  color: #2F3547;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.action-btn img {
  width: 16px;
  height: 16px;
  display: block;
}


.tree-node-loading {
  height: 20px;
  font-size: 11px;
  color: #666;
  display: flex;
  align-items: center;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 150px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #ccc;
  font-size: 13px;
}

.menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  background: transparent;
}
</style>

<style>
/* Element Plus 下拉菜单自定义样式（不使用 scoped，以便覆盖全局样式） */
.file-tree-dropdown-popper {
  box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.1) !important;
  border-radius: 12px !important;
  overflow: hidden;
}

.file-tree-dropdown {
  background: #fff !important;
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

删除确认弹框（与云端 TeamFilePanel 样式保持一致；append-to-body，需放在非 scoped 全局块）
.file-delete-dialog {
  border-radius: 12px;
}

.file-delete-dialog .delete-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-delete-dialog .delete-dialog-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-delete-dialog .warning-icon {
  font-size: 20px;
  color: #ff7d00;
  flex-shrink: 0;
}

.file-delete-dialog .delete-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1F2329;
  line-height: 24px;
}

.file-delete-dialog .delete-dialog-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.file-delete-dialog .delete-dialog-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.file-delete-dialog .delete-dialog-content {
  color: #606572;
  font-size: 13px;
  line-height: 20px;
  padding-left: 32px;
}

.file-delete-dialog .delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.file-delete-dialog .cancel-btn,
.file-delete-dialog .confirm-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.file-delete-dialog .cancel-btn {
  background: #fff;
  color: #1F2329;
  border: 1px solid #E3E3E3;
}

.file-delete-dialog .cancel-btn:hover {
  background: #F7F8FA;
  border-color: #D0D5DD;
}

.file-delete-dialog .confirm-btn {
  background: #1F2329;
  color: #fff;
}

.file-delete-dialog .confirm-btn:hover {
  background: #2F3547;
}
</style>
