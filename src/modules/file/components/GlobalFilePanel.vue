<template>
  <div
    class="global-file-panel"
    :class="{ 'is-dragging': isDragging || isLeftDragging, 'is-preview-fullscreen-root': isFullscreen }"
    :style="panelStyle"
  >
    <!-- 左侧分割线（文件树/预览区与对话框之间，非全屏时显示） -->
    <div
      v-if="!isFloatMode && !isFullscreen && (previewFile || (uiStore.globalFilePanelVisible && !uiStore.fileTreeCollapsed) || showNotification)"
      class="divider left-divider"
      :class="{ dragging: isLeftDragging }"
      @mousedown="startLeftDividerDrag"
    >
      <div class="divider-line" :class="{ dragging: isLeftDragging }"></div>
      <div class="divider-handle" :class="{ dragging: isLeftDragging }">
        <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
        <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
      </div>
    </div>

    <!-- 预览区域（可选，点击文件后显示） -->
    <div
      v-if="previewFile"
      class="preview-area"
      :class="{ 'preview-fullscreen': isFullscreen }"
      :style="isFullscreen ? {} : { width: previewWidth + 'px' }"
    >
      <!-- 预览头部 -->
      <div class="preview-header">
        <div class="preview-file-info">
          <img :src="previewFileIconSrc" class="preview-file-icon-img" :alt="previewFile.name" />
          <span class="preview-file-name">{{ previewFile.name }}</span>
          <span v-if="isEdited" class="preview-edited-dot" title="有未保存的修改">●</span>
        </div>
        <div class="preview-actions">
          <button v-if="isEditable && isEdited && isEditMode" class="preview-btn" title="保存 (Ctrl+S)" @click="saveFile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
          <button class="preview-btn" :title="isFullscreen ? '收起' : '全屏'" @click="isFullscreen = !isFullscreen">
            <img :src="isFullscreen ? mizeIcon : maximizeIcon" class="preview-icon" :alt="isFullscreen ? '收起' : '全屏'" />
          </button>
          <button v-if="isEditable && !isImage && previewTab === 'source' && !isEditMode" class="preview-btn" title="编辑" @click="isEditMode = true">
            <img :src="editIcon" class="preview-icon" alt="编辑" />
          </button>
          <button class="preview-btn" title="关闭" @click="closePreview">
            <img :src="closeIcon" class="preview-icon" alt="关闭" />
          </button>
        </div>
      </div>

      <!-- dropdown 模式：文件树选择器，放在 tabs 行 -->
      <div v-if="showTreeAsDropdown" class="tree-selector-bar">
        <el-popover
          :visible="treeDropdownVisible"
          placement="bottom-start"
          :width="treeWidth"
          popper-class="file-tree-dropdown-popover"
          :teleported="true"
          @click-outside="treeDropdownVisible = false"
        >
          <template #reference>
            <button class="tree-selector-btn" @click="treeDropdownVisible = !treeDropdownVisible">
              <span class="tree-selector-label">{{ selectedPath ? selectedPath.split(/[\\/]/).pop() : '请选择一个文件查看详情' }}</span>
              <svg class="tree-selector-arrow" :class="{ open: treeDropdownVisible }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </template>
          <template #default>
            <div class="dropdown-tree-wrap">
              <div v-if="loading" class="tree-loading">加载中...</div>
              <FileTreeNode
                v-else
                v-for="node in rootNodes"
                :key="node.path"
                :node="node"
                :depth="0"
                :selected-path="selectedPath"
                @select="onNodeSelectFromDropdown"
                @refresh="handleRefresh"
              />
            </div>
          </template>
        </el-popover>
      </div>

      <!-- 预览 Tab -->
      <div v-if="isPreviewable" class="preview-tabs">
        <button class="preview-tab" :class="{ active: previewTab === 'source' }" @click="previewTab = 'source'">源文件</button>
        <button class="preview-tab" :class="{ active: previewTab === 'preview' }" @click="previewTab = 'preview'">预览</button>
      </div>

      <!-- 预览内容 -->
      <div class="preview-content">
        <div v-if="previewLoading" class="preview-loading">加载中...</div>
        <div v-else-if="previewError" class="preview-error">{{ previewError }}</div>

        <!-- 大文件虚拟滚动模式 -->
        <VirtualFileViewer
          v-else-if="useLargeFileMode"
          :file-path="previewFile.path"
          :visible="true"
          @close="closePreview"
        />

        <!-- 图片 -->
        <div v-else-if="isImage" class="preview-image-wrap">
          <img :src="`file://${previewFile.path}`" :alt="previewFile.name" class="preview-image" />
        </div>

        <!-- 不支持的文件 -->
        <div v-else-if="isUnsupported" class="preview-unsupported">
          <img src="@/assets/home/noPreview.png" class="unsupported-icon" alt="不可预览" />
          <p>当前文件不可预览，请用对应软件打开</p>
          <button class="unsupported-open-btn" @click="openInSystem">打开文件</button>
        </div>

        <!-- docx 预览 -->
        <div v-else-if="isDocx" class="preview-docx markdown-body" v-html="docxHtml"></div>

        <!-- 可编辑文件：源文件 tab -->
        <textarea
          v-else-if="previewTab === 'source'"
          v-model="editContent"
          class="preview-editor"
          :class="{ readonly: !isEditMode }"
          :readonly="!isEditMode"
          spellcheck="false"
          @input="isEdited = true"
        />

        <!-- 预览 tab（iframe 渲染） -->
        <div v-else-if="previewTab === 'preview'" class="preview-iframe-wrap">
          <iframe
            v-if="fileExt === 'html'"
            class="preview-iframe"
            :src="`file://${previewFile.path}`"
          />
          <iframe
            v-else
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
            :srcdoc="previewHtml"
          />
        </div>

        <!-- 代码高亮预览（备用） -->
        <pre v-else class="preview-code"><code v-html="highlightedCode" /></pre>
      </div>
    </div>

    <!-- 分割线（仅在有预览且有文件树或通知面板且非全屏且非dropdown时显示） -->
    <div
      v-if="previewFile && !isFullscreen && !showTreeAsDropdown && (uiStore.globalFilePanelVisible || showNotification)"
      class="divider"
      :class="{ dragging: isDragging }"
      @mousedown="startDividerDrag"
    >
      <div class="divider-line" :class="{ dragging: isDragging }"></div>
      <div class="divider-handle" :class="{ dragging: isDragging }">
        <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
        <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
      </div>
    </div>

    <!-- 文件树区域 -->
    <div v-show="uiStore.globalFilePanelVisible && !isFullscreen && !showTreeAsDropdown && !isFloatMode && !uiStore.fileTreeCollapsed" class="file-tree-area" :style="{ width: treeWidth + 'px' }">
      <!-- 头部（仅在无预览时显示） -->
      <div v-if="!previewFile" class="tree-header">
        <span class="tree-title">文件</span>
        <button class="close-btn" @click="uiStore.closeGlobalFilePanel()">
          <img :src="closeIcon" width="16" height="16" alt="关闭" />
        </button>
      </div>

      <!-- Tab 切换栏（仅在无预览时显示） -->
      <div v-if="!previewFile" class="file-tab-bar">
        <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'team' }" @click="uiStore.setFileTab('team')">云端文件</button>
        <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'global' }" @click="uiStore.setFileTab('global')">本地文件</button>
      </div>

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

    <!-- 通知面板（与文件树互斥） -->
    <div v-show="showNotification" class="notification-col">
      <NotificationPanel
        :extra-cards="uiStore.notificationLeaveCards"
        @navigate="handleNotificationNavigate"
      />
    </div>
  </div>

  <!-- float 模式：以 Teleport 浮层覆盖对话区 -->
  <Teleport to="body">
    <div
      v-if="isFloatMode && (uiStore.globalFilePanelVisible || uiStore.globalFilePreviewActive)"
      class="global-file-float-panel"
      :style="{ width: floatPanelWidth + 'px' }"
    >
        <!-- 预览区域 -->
        <div
          v-if="previewFile"
          class="preview-area"
          :class="{ 'preview-fullscreen': isFullscreen }"
          :style="isFullscreen ? {} : { width: previewWidth + 'px' }"
        >
          <div class="preview-header">
            <div class="preview-file-info">
              <img :src="previewFileIconSrc" class="preview-file-icon-img" :alt="previewFile.name" />
              <span class="preview-file-name">{{ previewFile.name }}</span>
              <span v-if="isEdited" class="preview-edited-dot" title="有未保存的修改">●</span>
            </div>
            <div class="preview-actions">
              <button v-if="isEditable && isEdited && isEditMode" class="preview-btn" title="保存 (Ctrl+S)" @click="saveFile">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
              </button>
              <button class="preview-btn" :title="isFullscreen ? '收起' : '全屏'" @click="isFullscreen = !isFullscreen">
                <img :src="isFullscreen ? mizeIcon : maximizeIcon" class="preview-icon" :alt="isFullscreen ? '收起' : '全屏'" />
              </button>
              <button v-if="isEditable && !isImage && previewTab === 'source' && !isEditMode" class="preview-btn" title="编辑" @click="isEditMode = true">
                <img :src="editIcon" class="preview-icon" alt="编辑" />
              </button>
              <button class="preview-btn" title="关闭" @click="closePreview">
                <img :src="closeIcon" class="preview-icon" alt="关闭" />
              </button>
            </div>
          </div>
          <div v-if="isPreviewable" class="preview-tabs">
            <button class="preview-tab" :class="{ active: previewTab === 'source' }" @click="previewTab = 'source'">源文件</button>
            <button class="preview-tab" :class="{ active: previewTab === 'preview' }" @click="previewTab = 'preview'">预览</button>
          </div>
          <div class="preview-content">
            <div v-if="previewLoading" class="preview-loading">加载中...</div>
            <div v-else-if="previewError" class="preview-error">{{ previewError }}</div>

            <!-- 大文件虚拟滚动模式 -->
            <VirtualFileViewer
              v-else-if="useLargeFileMode"
              :file-path="previewFile.path"
              :visible="true"
              @close="closePreview"
            />

            <div v-else-if="isImage" class="preview-image-wrap">
              <img :src="`file://${previewFile.path}`" :alt="previewFile.name" class="preview-image" />
            </div>
            <div v-else-if="isUnsupported" class="preview-unsupported">
              <img src="@/assets/home/preview.png" class="unsupported-icon" alt="不可预览" />
              <p>当前文件不可预览，请用对应软件打开</p>
            </div>
            <div v-else-if="isDocx" class="preview-docx markdown-body" v-html="docxHtml"></div>
            <textarea
              v-else-if="previewTab === 'source'"
              v-model="editContent"
              class="preview-editor"
              :class="{ readonly: !isEditMode }"
              :readonly="!isEditMode"
              spellcheck="false"
              @input="isEdited = true"
            />
            <div v-else-if="previewTab === 'preview'" class="preview-iframe-wrap">
              <iframe v-if="fileExt === 'html'" class="preview-iframe" :src="`file://${previewFile.path}`" />
              <iframe v-else class="preview-iframe" sandbox="allow-scripts allow-same-origin" :srcdoc="previewHtml" />
            </div>
            <pre v-else class="preview-code"><code v-html="highlightedCode" /></pre>
          </div>
        </div>

        <!-- 中间分割线 -->
        <div
          v-if="previewFile && uiStore.globalFilePanelVisible"
          class="divider"
          :class="{ dragging: isDragging }"
          @mousedown="startDividerDrag"
        >
          <div class="divider-line" :class="{ dragging: isDragging }"></div>
          <div class="divider-handle" :class="{ dragging: isDragging }">
            <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
            <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
          </div>
        </div>

        <!-- 文件树区域 -->
        <div v-show="uiStore.globalFilePanelVisible" class="file-tree-area" :style="{ width: treeWidth + 'px' }">
          <div class="tree-header">
            <span class="tree-title">文件</span>
            <button class="close-btn" @click="uiStore.closeGlobalFilePanel()">
              <img :src="closeIcon" width="16" height="16" alt="关闭" />
            </button>
          </div>

          <!-- Tab 切换栏 -->
          <div class="file-tab-bar">
            <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'team' }" @click="uiStore.setFileTab('team')">云端文件</button>
            <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'global' }" @click="uiStore.setFileTab('global')">本地文件</button>
          </div>
          <div v-if="rootPath" class="tree-root-path">
            <div class="root-path-top">
              <div class="root-path-left">
                <span class="root-path-label">{{ rootPathDisplay }}</span>
              </div>
              <div class="root-path-actions" style="visibility: visible;">
                <button class="action-btn" title="切换文件目录" @click="selectRootDir">
                  <img :src="switchIcon" alt="切换文件目录" class="action-icon" />
                </button>
              </div>
            </div>
            <div class="root-path-full" :title="rootPath">{{ rootPath }}</div>
          </div>
          <div v-if="!rootPath" class="tree-empty">
            <div class="tree-empty-icon">
              <img :src="emptyStateIcon" alt="空状态" class="empty-icon-img" />
            </div>
            <button class="tree-empty-btn" @click="selectRootDir">
              <img :src="addEmptyIcon" alt="添加" class="btn-icon" />
              <span>添加文件路径</span>
            </button>
          </div>
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
      </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useWindowWidth } from '@/shared/hooks/useWindowWidth'
import {
  REGISTER_NODE_REFRESH_KEY,
  TRIGGER_NODE_REFRESH_KEY,
  EXPANDED_PATHS_KEY,
  SELECTED_PATHS_KEY,
  SELECTED_NODES_MAP_KEY,
  TOGGLE_SELECT_KEY,
  CLEAR_MULTI_SELECT_KEY
} from '@/shared/constants/injectionKeys'
import FileTreeNode from './FileTreeNode.vue'
import VirtualFileViewer from './VirtualFileViewer.vue'
import NotificationPanel from '@/modules/space/components/NotificationPanel.vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import '@/shared/styles/markdown-body.css'
import mdIcon from '@/assets/home/md.svg'
import codeIcon from '@/assets/home/code.svg'
import richTextIcon from '@/assets/home/richText.svg'
import pictureIcon from '@/assets/home/picture.svg'
import textIcon from '@/assets/home/text.svg'
import dragIcon from '@/assets/home/drag.svg'
import dragHoverIcon from '@/assets/home/dragHover.svg'
import addIcon from '@/assets/home/open.svg'
import addFolderIcon from '@/assets/home/addFolder.svg'
import addTextIcon from '@/assets/home/addText.svg'
import switchIcon from '@/assets/home/switch.svg'
import emptyStateIcon from '@/assets/home/flie-preview.png'
import addEmptyIcon from '@/assets/home/openFolder.svg'
import closeIcon from '@/assets/home/close.svg'
import editIcon from '@/assets/home/edit.svg'
import maximizeIcon from '@/assets/home/maximize.svg'
import mizeIcon from '@/assets/home/mize.svg'

const md = new MarkdownIt({ html: true, breaks: true, linkify: true })

const uiStore = useUIStore()

// 响应式窗口宽度同步到 uiStore
const { windowWidth } = useWindowWidth()
watch(windowWidth, (w) => uiStore.setWindowWidth(w), { immediate: true })

// 显示模式
const panelMode = computed(() => uiStore.filePanelDisplayMode)
const isFloatMode = computed(() => panelMode.value === 'float')
const treeDropdownVisible = ref(false)

// 全局节点刷新注册表：path → refresh callback
const _refreshRegistry = new Map()

provide(REGISTER_NODE_REFRESH_KEY, (path, cb) => {
  _refreshRegistry.set(path, cb)
  return () => _refreshRegistry.delete(path)
})

provide(TRIGGER_NODE_REFRESH_KEY, (path) => {
  const cb = _refreshRegistry.get(path)
  if (cb) cb()
})

// 文件树状态
const rootPath = ref('')
const _rawRootNodes = ref([]) // 原始数据（含隐藏文件）
const rootNodes = computed(() =>
  _rawRootNodes.value.filter(e => uiStore.showHiddenFiles || !e.isHidden)
)
const loading = ref(false)
const selectedPath = ref('')
const selectedNode = ref(null)

// 需要展开的路径集合（用于从终端点击文件时展开文件树）
const expandedPaths = ref(new Set())

// 多选状态（用于拖拽多文件到终端）
const selectedPaths = ref(new Set())
// 多选节点信息注册表（path → node），供拖拽时获取完整信息
const selectedNodesMap = ref(new Map())

provide(EXPANDED_PATHS_KEY, expandedPaths)
provide(SELECTED_PATHS_KEY, selectedPaths)
provide(SELECTED_NODES_MAP_KEY, selectedNodesMap)
provide(TOGGLE_SELECT_KEY, (node, event) => {
  const isMac = navigator.platform?.includes('Mac')
  const isMultiKey = isMac ? event.metaKey : event.ctrlKey
  if (isMultiKey) {
    // Ctrl/Cmd+Click: 切换选中
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
    // 普通点击: 单选
    selectedPaths.value = new Set([node.path])
    selectedNodesMap.value = new Map([[node.path, node]])
  }
})
provide(CLEAR_MULTI_SELECT_KEY, () => {
  selectedPaths.value = new Set()
  selectedNodesMap.value = new Map()
})

// 宽度约束常量
const MIN_TREE_WIDTH = 260
const MIN_PREVIEW_WIDTH = 300
const MIN_MAIN_AREA_WIDTH = 300

// 宽度控制（从 localStorage 恢复）
const treeWidth = ref(Number(localStorage.getItem('file-panel-tree-width')) || 260)
const previewWidth = ref(Number(localStorage.getItem('file-panel-preview-width')) || 403)
const isDragging = ref(false)
const isLeftDragging = ref(false)
const isFullscreen = ref(false)

// 预览状态
const previewFile = ref(null)
const previewContent = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const previewTab = ref('source')

// dropdown 模式：预览和文件树同时存在时才触发
const showTreeAsDropdown = computed(() =>
  panelMode.value === 'dropdown' && !!previewFile.value && uiStore.globalFilePanelVisible
)

// 模式切换时关闭下拉
watch([showTreeAsDropdown, isFloatMode], ([dropdown, float]) => {
  if (!dropdown || float) treeDropdownVisible.value = false
})

// ─── 右侧面板显示逻辑（文件树 / 通知面板互斥） ────────────────────────────────
const showNotification = computed(() =>
  !showTreeAsDropdown.value &&
  !isFloatMode.value &&
  uiStore.notificationPanelOpen
)

function handleNotificationNavigate(card) {
  uiStore.setActiveNavigation('collaboration', card.conversationId)
  uiStore.closeNotificationPanel()
}

// 面板总宽度：驱动父容器 .side-panel 的宽度（flex 布局下自动让 content-area 收缩）
const panelStyle = computed(() => {
  if (isFullscreen.value) return {}
  // float 模式：面板不占 flex 宽度（以 Teleport 浮层展示）
  if (isFloatMode.value) return { width: '0px' }
  const dividerW = 10 // 每条分割线 10px
  const hasPreview = !!previewFile.value
  const hasTree = uiStore.globalFilePanelVisible && !uiStore.fileTreeCollapsed
  const hasNotification = showNotification.value

  // dropdown 模式：文件树收进下拉，面板只占预览宽度
  if (showTreeAsDropdown.value) {
    return { width: `${previewWidth.value + dividerW}px` }
  }

  // 通知面板打开时的宽度计算
  if (hasNotification) {
    if (hasPreview) {
      // 预览 + 通知面板：预览宽度 + 通知面板宽度 + 两条分割线
      return { width: `${previewWidth.value + treeWidth.value + dividerW * 2}px` }
    }
    // 只有通知面板：通知面板宽度 + 左侧分割线
    return { width: `${treeWidth.value + dividerW}px` }
  }

  // 只有预览：预览宽度 + 左侧分割线
  if (hasPreview && !hasTree) {
    return { width: `${previewWidth.value + dividerW}px` }
  }
  // 预览 + 文件树：预览宽度 + 文件树宽度 + 两条分割线
  if (hasPreview && hasTree) {
    return { width: `${previewWidth.value + treeWidth.value + dividerW * 2}px` }
  }
  // 只有文件树：文件树宽度 + 左侧分割线
  if (hasTree) {
    return { width: `${treeWidth.value + dividerW}px` }
  }
  // 都没有
  return { width: '0px' }
})

// float 模式浮层宽度：复用原本的宽度（previewWidth + treeWidth）
const floatPanelWidth = computed(() => {
  const dividerW = 10
  const hasPreview = !!previewFile.value
  const hasTree = uiStore.globalFilePanelVisible
  if (hasPreview && hasTree) return previewWidth.value + treeWidth.value + dividerW
  if (hasPreview) return previewWidth.value + dividerW
  if (hasTree) return treeWidth.value + dividerW
  return 400
})

// 同步面板宽度到 uiStore，供 HomeView 的 terminalWrapper 使用
// 面板隐藏时（v-show=false）重置为 0，避免终端窗口保留空白占位
watch(
  [panelStyle, () => uiStore.globalFilePanelVisible, () => uiStore.globalFilePreviewActive],
  ([style, visible, previewActive]) => {
    if (!visible && !previewActive) {
      uiStore.globalFilePanelTotalWidth = 0
    } else {
      const w = style.width ? parseInt(style.width) : 0
      uiStore.globalFilePanelTotalWidth = w
    }
  },
  { immediate: true }
)

// 编辑状态
const editContent = ref('')
const isEdited = ref(false)
const isSaving = ref(false)
const isEditMode = ref(false) // 是否处于编辑模式（点击编辑按钮后才允许编辑）

// 大文件模式状态
const useLargeFileMode = ref(false)
const FILE_SIZE_THRESHOLD = 2 * 1024 * 1024 // 2MB

// docx HTML
const docxHtml = ref('')

// 文件类型常量
const EDITABLE_EXTS = ['md','txt','js','ts','jsx','tsx','vue','svelte','py','java','go','rs','cpp','c','h','css','scss','less','sass','html','xml','json','yaml','yml','sql','sh','bash','rb','php','swift','kt']
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
const DOCX_EXTS = ['docx']

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

const PREVIEWABLE_EXTS = ['md', 'html', 'css', 'js']

// 文件类型判断
const fileExt = computed(() => {
  if (!previewFile.value) return ''
  const name = previewFile.value.name
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.substring(dotIndex + 1).toLowerCase() : ''
})
const isImage = computed(() => IMAGE_EXTS.includes(fileExt.value))
const isEditable = computed(() => EDITABLE_EXTS.includes(fileExt.value))
const isDocx = computed(() => DOCX_EXTS.includes(fileExt.value))
const isUnsupported = computed(() => !isImage.value && !isEditable.value && !isDocx.value)
const isPreviewable = computed(() => PREVIEWABLE_EXTS.includes(fileExt.value))

// 预览 iframe srcdoc
const previewHtml = computed(() => {
  const ext = fileExt.value
  const src = editContent.value
  if (!src) return ''

  if (ext === 'md') {
    const body = md.render(src)
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;font-size:14px;line-height:1.7;color:#1f2328;background:#fff;padding:32px 40px;max-width:860px}
      h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.25;margin-top:24px;margin-bottom:12px}
      h1{font-size:2em;padding-bottom:10px;border-bottom:1px solid #d0d7de}
      h2{font-size:1.5em;padding-bottom:8px;border-bottom:1px solid #d0d7de}
      h3{font-size:1.25em}
      p{margin-bottom:14px}
      a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}
      code{font-family:'SFMono-Regular',Consolas,monospace;font-size:85%;background:#f6f8fa;border-radius:4px;padding:2px 6px;color:#c9254e}
      pre{background:#f6f8fa;border-radius:6px;padding:16px;overflow:auto;margin-bottom:16px}
      pre code{background:transparent;padding:0;color:#1f2328;font-size:13px}
      blockquote{border-left:4px solid #d0d7de;color:#656d76;padding:4px 16px;margin:0 0 16px}
      ul,ol{padding-left:2em;margin-bottom:14px}li{margin-bottom:4px}
      table{border-collapse:collapse;width:100%;margin-bottom:16px;font-size:13px}
      th,td{border:1px solid #d0d7de;padding:8px 12px;text-align:left}
      th{background:#f6f8fa;font-weight:600}tr:nth-child(even) td{background:#f6f8fa}
      img{max-width:100%;height:auto;border-radius:4px}
      hr{border:none;border-top:1px solid #d0d7de;margin:24px 0}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#E0E4EC;border-radius:2px}
</style></head><body>${body}</body></html>`
  }


  if (['css', 'js'].includes(ext)) {
    if (ext === 'css') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${src}</style></head><body>
        <h1>标题 H1</h1><h2>标题 H2</h2><h3>标题 H3</h3>
        <p>这是一段普通正文文本，用于展示 CSS 样式效果。</p>
        <a href="#">链接示例</a>
        <ul><li>列表项 1</li><li>列表项 2</li><li>列表项 3</li></ul>
        <button>按钮</button>
        <input type="text" placeholder="输入框" />
        <table><thead><tr><th>列1</th><th>列2</th></tr></thead><tbody><tr><td>数据1</td><td>数据2</td></tr></tbody></table>
      </body></html>`
    }
    if (ext === 'js') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'SFMono-Regular',Consolas,monospace;background:#1e1e1e;color:#d4d4d4;margin:0;padding:16px;font-size:13px}
        .header{color:#888;font-size:11px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #333}
        #output{white-space:pre-wrap;line-height:1.6}
        .log-line{padding:2px 0;border-bottom:1px solid #2a2a2a}
        .log-error{color:#f48771}.log-warn{color:#cca700}
      </style></head><body>
        <div class="header">Console Output</div>
        <div id="output"></div>
        <script>
          const out=document.getElementById('output')
          function appendLine(text,cls){const d=document.createElement('div');d.className='log-line'+(cls?' '+cls:'');d.textContent=text;out.appendChild(d)}
          console.log=(...args)=>appendLine(args.map(a=>typeof a==='object'?JSON.stringify(a,null,2):String(a)).join(' '))
          console.error=(...args)=>appendLine(args.map(String).join(' '),'log-error')
          console.warn=(...args)=>appendLine(args.map(String).join(' '),'log-warn')
          window.onerror=(msg,src,line)=>appendLine('Error: '+msg+' (line '+line+')','log-error')
          try{${src}}catch(e){appendLine('Error: '+e.message,'log-error')}
        <\/script>
      </body></html>`
    }
  }

  return ''
})

// 代码高亮
const highlightedCode = computed(() => {
  if (fileExt.value === 'md' || isImage.value || isDocx.value) return ''
  try {
    const result = hljs.highlightAuto(editContent.value)
    return result.value
  } catch {
    return editContent.value
  }
})

const rootPathDisplay = computed(() => {
  if (!rootPath.value || rootPath.value === 'drives') return '文件夹名称XXX'
  const parts = rootPath.value.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || rootPath.value
})

const previewFileIconSrc = computed(() => {
  if (!previewFile.value) return textIcon
  const ext = previewFile.value.name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return mdIcon
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'vue', 'svelte', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'sh', 'bash', 'zsh', 'php', 'rb', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'less', 'sass']
  if (codeExts.includes(ext)) return codeIcon
  const richTextExts = ['docx', 'doc', 'pdf', 'rtf', 'odt', 'pages']
  if (richTextExts.includes(ext)) return richTextIcon
  const pictureExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif']
  if (pictureExts.includes(ext)) return pictureIcon
  const textExts = ['txt', 'log', 'csv', 'xml', 'yaml', 'yml', 'json', 'ini', 'conf', 'config', 'env']
  if (textExts.includes(ext)) return textIcon
  return textIcon
})

// ── 文件系统监听：自动刷新文件树 ──
let unwatchFs = null
let refreshDebounce = null

async function startWatching(dirPath) {
  // 停止旧监听
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
  uiStore.globalFilePreviewActive = false

  // 恢复上次的根目录
  const lastPath = localStorage.getItem('file-panel-last-root')
  if (lastPath) {
    await loadFolder(lastPath)
    await startWatching(lastPath)
  }

  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('reveal-file-in-tree', handleRevealFileInTree)
})

onUnmounted(() => {
  // 组件卸载时，清除预览状态
  uiStore.globalFilePreviewActive = false
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('reveal-file-in-tree', handleRevealFileInTree)
  // 停止文件监听
  if (unwatchFs) {
    unwatchFs()
    unwatchFs = null
  }
  clearTimeout(refreshDebounce)
  window.electronAPI?.fs.watchStop()
  // 清理可能残留的 dragstart 监听器
  document.removeEventListener('dragstart', blockDragStart, true)
})

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveFile()
  }
}

// 处理终端点击文件事件：展开文件树并定位到指定路径
async function handleRevealFileInTree(e) {
  const filePath = e.detail?.filePath
  if (!filePath) return

  const sep = filePath.includes('/') ? '/' : '\\'
  const parentDir = filePath.substring(0, filePath.lastIndexOf(sep))

  // 如果当前没有根目录，或文件不在当前根目录下，则加载文件所在目录
  const normalizedFilePath = filePath.replace(/\\/g, '/')
  const normalizedRoot = rootPath.value.replace(/\\/g, '/')

  if (!rootPath.value || !normalizedFilePath.startsWith(normalizedRoot)) {
    if (parentDir) {
      await loadFolder(parentDir)
    }
  }

  // 计算从根目录到文件的所有父目录路径，用于展开
  const normalizedRootNow = rootPath.value.replace(/\\/g, '/')
  const pathsToExpand = new Set()
  let current = normalizedFilePath
  while (current.length > normalizedRootNow.length) {
    const lastSep = Math.max(current.lastIndexOf('/'), current.lastIndexOf('\\'))
    if (lastSep <= 0) break
    current = current.substring(0, lastSep)
    if (current.length >= normalizedRootNow.length) {
      // 还原为原始路径格式
      const originalPath = filePath.includes('/') ? current : current.replace(/\//g, '\\')
      pathsToExpand.add(originalPath)
    }
  }

  // 更新需要展开的路径集合
  expandedPaths.value = pathsToExpand

  // 选中该文件路径
  selectedPath.value = filePath
}

function onNodeSelect(node) {
  selectedPath.value = node.path
  selectedNode.value = node
  // 同步多选状态（普通点击时单选，多选由 toggleSelect 处理）
  if (!selectedPaths.value.has(node.path) || selectedPaths.value.size !== 1) {
    selectedPaths.value = new Set([node.path])
    selectedNodesMap.value = new Map([[node.path, node]])
  }
  if (node.type === 'directory') {
    saveHistory(node.path)
  }
  if (node.type === 'file') {
    if (window.electronAPI?.openFilePreview) {
      const dotIndex = node.name.lastIndexOf('.')
      const fileType = dotIndex >= 0 ? node.name.substring(dotIndex + 1).toLowerCase() : ''
      window.electronAPI.openFilePreview({
        localPath: node.path,
        name: node.name,
        type: fileType,
        size: node.size ?? 0,
      })
    } else {
      openPreview(node)
    }
  }
}

function onNodeSelectFromDropdown(node) {
  onNodeSelect(node)
  if (node.type !== 'directory') treeDropdownVisible.value = false
}

function closeFloatPanel() {
  uiStore.closeGlobalFilePanel()
  closePreview()
}

async function openPreview(node) {
  previewFile.value = node
  editContent.value = ''
  previewContent.value = ''
  previewError.value = ''
  docxHtml.value = ''
  isEdited.value = false
  isEditMode.value = false
  useLargeFileMode.value = false
  uiStore.globalFilePreviewActive = true
  uiStore.expandFileTree()

  // 图片直接显示，不需要读取内容
  if (isImage.value) {
    previewTab.value = 'preview'
    return
  }

  // 大文件检测（>= 2MB 且可编辑）
  console.log('[大文件检测]', {
    fileName: node.name,
    size: node.size,
    sizeInMB: node.size ? (node.size / 1024 / 1024).toFixed(2) : 'N/A',
    threshold: FILE_SIZE_THRESHOLD,
    isEditable: isEditable.value,
    willUseLargeMode: isEditable.value && node.size && node.size >= FILE_SIZE_THRESHOLD
  })

  if (isEditable.value && node.size && node.size >= FILE_SIZE_THRESHOLD) {
    useLargeFileMode.value = true
    previewTab.value = 'source'
    return
  }

  previewTab.value = 'source'
  previewLoading.value = true
  try {
    if (isDocx.value) {
      docxHtml.value = await window.electronAPI.docxToHtml(node.path)
    } else if (isEditable.value) {
      const content = await window.electronAPI.fs.readFile(node.path, 'utf8')
      editContent.value = content
    }
    // isUnsupported: 不读取，直接显示提示
  } catch (err) {
    previewError.value = '无法读取文件内容'
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  previewFile.value = null
  editContent.value = ''
  previewContent.value = ''
  docxHtml.value = ''
  isEdited.value = false
  isEditMode.value = false
  isFullscreen.value = false
  useLargeFileMode.value = false
  selectedPath.value = ''
  uiStore.globalFilePreviewActive = false
}

async function saveFile() {
  if (!isEditable.value || !isEdited.value || isSaving.value) return
  isSaving.value = true
  try {
    await window.electronAPI.fs.writeFile(previewFile.value.path, editContent.value, 'utf8')
    isEdited.value = false
    ElMessage.success('已保存')
  } catch (err) {
    ElMessage.error('保存失败: ' + (err.message || err))
  } finally {
    isSaving.value = false
  }
}

function openInSystem() {
  if (previewFile.value) {
    window.electronAPI?.openPath(previewFile.value.path)
  }
}

// 选择根目录
async function selectRootDir() {
  if (!window.electronAPI?.claudeCode) {
    ElMessage.error('文件系统 API 未加载，请重启应用')
    return
  }
  const dir = await window.electronAPI.claudeCode.selectDirectory()
  if (!dir) return
  await loadFolder(dir)
}

// 打开当前根目录
function openCurrentFolder() {
  if (rootPath.value && rootPath.value !== 'drives') {
    window.electronAPI?.openPath(rootPath.value)
  }
}

// 在当前根目录下新建文件
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

    // 检查目标名称是否已存在（文件或文件夹）
    const existing = rootNodes.value.find(n => n.name === fileName)
    if (existing) {
      const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
      ElMessage.error(`"${fileName}" 已存在（${typeLabel}），请使用其他名称`)
      return
    }

    await window.electronAPI.fs.writeFile(filePath, '', 'utf8')
    ElMessage.success('文件创建成功')

    // 智能更新根节点列表，保留已存在节点对象以保持组件状态
    const entries = await window.electronAPI.fs.readDir(rootPath.value)
    const newNodes = entries
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    // 创建旧节点的 path -> node 映射
    const oldNodesMap = new Map(_rawRootNodes.value.map(n => [n.path, n]))

    // 构建新的 _rawRootNodes 数组，优先使用旧节点对象
    _rawRootNodes.value = newNodes.map(newNode => {
      return oldNodesMap.has(newNode.path) ? oldNodesMap.get(newNode.path) : newNode
    })
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('文件创建失败: ' + (err.message || err))
  }
}

// 在当前根目录下新建文件夹
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

    // 检查目标名称是否已存在（文件或文件夹）
    const existing = rootNodes.value.find(n => n.name === folderName)
    if (existing) {
      const typeLabel = existing.type === 'directory' ? '文件夹' : '文件'
      ElMessage.error(`"${folderName}" 已存在（${typeLabel}），请使用其他名称`)
      return
    }

    await window.electronAPI.fs.mkdir(folderPath)
    ElMessage.success('文件夹创建成功')

    // 智能更新根节点列表，保留已存在节点对象以保持组件状态
    const entries = await window.electronAPI.fs.readDir(rootPath.value)
    const newNodes = entries
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    // 创建旧节点的 path -> node 映射
    const oldNodesMap = new Map(_rawRootNodes.value.map(n => [n.path, n]))

    // 构建新的 _rawRootNodes 数组，优先使用旧节点对象
    _rawRootNodes.value = newNodes.map(newNode => {
      return oldNodesMap.has(newNode.path) ? oldNodesMap.get(newNode.path) : newNode
    })
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error('文件夹创建失败: ' + (err.message || err))
  }
}

async function handleRefresh(refreshedPath) {
  if (!rootPath.value || rootPath.value === 'drives') {
    const drives = await window.electronAPI.fs.getDrives()
    _rawRootNodes.value = drives
  } else if (refreshedPath === rootPath.value || !refreshedPath) {
    // 刷新当前根目录
    await loadFolder(rootPath.value)
  }
  // 子目录刷新由 FileTreeNode 的 handleChildRefresh 处理
}

async function loadFolder(folderPath) {
  loading.value = true
  try {
    const entries = await window.electronAPI.fs.readDir(folderPath)
    _rawRootNodes.value = entries
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    rootPath.value = folderPath
    saveHistory(folderPath)
    localStorage.setItem('file-panel-last-root', folderPath)
    localStorage.setItem('file-panel-last-root', folderPath)
    // 切换目录后重新监听
    await startWatching(folderPath)
  } catch (err) {
    console.error('加载目录失败:', err)
  } finally {
    loading.value = false
  }
}

// 在 capture 阶段拦截 dragstart，防止鼠标经过文件树节点时触发原生拖拽
function blockDragStart(ev) {
  ev.preventDefault()
  ev.stopPropagation()
}

// 左侧分割线拖拽（调整面板与对话框之间的边界，改变整体面板宽度）
function startLeftDividerDrag(e) {
  e.preventDefault()
  isLeftDragging.value = true
  const startX = e.clientX
  const startPreviewWidth = previewWidth.value
  const startTreeWidth = treeWidth.value
  const hasPreview = !!previewFile.value
  const isNotificationOpen = uiStore.notificationPanelOpen
  let rafId = null

  document.addEventListener('dragstart', blockDragStart, true)

  function onMouseMove(e) {
    if (rafId) return
    const clientX = e.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = startX - clientX
      const centerEl = document.querySelector('.center-area-wrapper')
      const centerWidth = centerEl ? centerEl.offsetWidth : 0
      // 通知面板现在在 GlobalFilePanel 内部，不再是独立 DOM 元素
      // 计算可用空间时不需要扣除外部通知面板宽度
      const currentMainAreaWidth = centerWidth

      if (hasPreview) {
        // 有预览时，拖拽改变预览宽度，通知面板/文件树宽度固定
        const fixedWidth = isNotificationOpen ? startTreeWidth : (uiStore.globalFilePanelVisible ? startTreeWidth : 0)
        const maxByMainArea = startPreviewWidth + fixedWidth + Math.max(0, currentMainAreaWidth - 300)
        let newPreviewWidth = startPreviewWidth + delta
        newPreviewWidth = Math.max(300, Math.min(maxByMainArea - fixedWidth, newPreviewWidth))
        previewWidth.value = newPreviewWidth
      } else {
        // 无预览时，拖拽改变通知面板/文件树宽度
        const maxByMainArea = startTreeWidth + Math.max(0, currentMainAreaWidth - 300)
        let newTreeWidth = startTreeWidth + delta
        newTreeWidth = Math.max(260, Math.min(maxByMainArea, newTreeWidth))
        treeWidth.value = newTreeWidth
      }
    })
  }

  function onMouseUp() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isLeftDragging.value = false
    localStorage.setItem('file-panel-tree-width', treeWidth.value)
    localStorage.setItem('file-panel-preview-width', previewWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('dragstart', blockDragStart, true)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startDividerDrag(e) {
  isDragging.value = true
  const startX = e.clientX
  const startTreeWidth = treeWidth.value
  const startPreviewWidth = previewWidth.value
  const totalWidth = startTreeWidth + startPreviewWidth
  let rafId = null

  function onMouseMove(e) {
    if (rafId) return
    const clientX = e.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = startX - clientX

      let newPreviewWidth = startPreviewWidth - delta
      let newTreeWidth = totalWidth - newPreviewWidth

      // 双向约束：确保两者都在最小范围内
      if (newPreviewWidth < 300) {
        newPreviewWidth = 300
        newTreeWidth = totalWidth - 300
      }

      if (newTreeWidth < 260) {
        newTreeWidth = 260
        newPreviewWidth = totalWidth - 260
      }

      previewWidth.value = newPreviewWidth
      treeWidth.value = newTreeWidth
    })
  }

  function onMouseUp() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isDragging.value = false
    localStorage.setItem('file-panel-tree-width', treeWidth.value)
    localStorage.setItem('file-panel-preview-width', previewWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.global-file-panel {
  display: flex;
  flex-shrink: 0;
  height: calc(100% - 10px);
  overflow: visible;
  position: relative;
  z-index: 1020;
  margin-bottom: 10px;
  background: var(--bg-primary);
}

.global-file-panel.is-preview-fullscreen-root {
  z-index: 12000;
}

.global-file-panel.is-float-mode {
  width: 0 !important;
  min-width: 0 !important;
  border-left: none;
  overflow: hidden;
}

/* dropdown 模式：文件树选择器栏 */
.tree-selector-bar {
  border-bottom: 1px solid #F0F2F5;
  padding: 0 16px;
}

.tree-selector-btn {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  gap: 6px;
}

.tree-selector-btn:hover .tree-selector-label {
  color: #436FF6;
}

.tree-selector-label {
  flex: 1;
  font-size: 13px;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.tree-selector-arrow {
  flex-shrink: 0;
  color: #8C93A6;
  transition: transform 0.2s;
}

.tree-selector-arrow.open {
  transform: rotate(180deg);
}

/* 预览区域 */
.preview-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 300px;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-right: 1px solid #F0F2F5;
  border-radius: 12px;
  will-change: width;
}

.preview-fullscreen {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto !important;
  z-index: 2000;
  border-right: none;
  box-shadow: none;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  min-height: 44px;
  padding: 0 16px 0 16px;
  /* border-bottom: 1px solid #F0F2F5; */
}

.preview-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.preview-file-icon-img {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.preview-file-name {
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.preview-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #8C93A6;
  border-radius: 6px;
  padding: 0;
  transition: background 0.15s;
}

.preview-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

.preview-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.preview-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  border-bottom: 1px solid #F0F2F5;
  width: 121px;
  height: 28px;
  border-radius: 6px;
  background: #F5F6F9;
  box-sizing: border-box;
  margin: 12px 16px;
  padding: 0 2px;
}

.preview-tab {
  flex: 1;
  height: 24px;
  border-radius: 6px;
  font-size: 13px;
  color: #8C93A6;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.preview-tab.active {
  background: #FFFFFF;
  color: #2F3547;
  font-weight: 500;
}

.preview-tab:hover:not(.active) {
  color: #2F3547;
}

.preview-content {
  flex: 1;
  overflow: hidden;
}

.preview-loading,
.preview-error {
  padding: 20px;
  font-size: 13px;
  color: #8C93A6;
}

.preview-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: 100%;
  box-sizing: border-box;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-text {
  margin: 0;
  padding: 14px 16px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #2F3547;
  line-height: 1.6;
  white-space: pre;
  overflow-wrap: normal;
}

.preview-editor {
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #2F3547;
  line-height: 1.6;
  border: none;
  outline: none;
  resize: none;
  background: #fff;
  box-sizing: border-box;
}

.preview-editor.readonly {
  cursor: default;
  background: #FAFBFC;
  user-select: text;
}

.preview-markdown,
.preview-docx {
  padding: 14px 16px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
}

.preview-code {
  margin: 0;
  padding: 14px 16px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.preview-iframe-wrap {
  flex: 1;
  overflow: hidden;
  background: #fff;
  height: 100%;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 218px;
  gap: 16px;
  color: #2F3547;
  font-size: 13px;
}

.unsupported-icon {
  width: 100px;
  height: 100px;
}

.unsupported-open-btn {
  display: none;
}

.preview-edited-dot {
  color: #F59E0B;
  font-size: 10px;
  margin-left: 6px;
}

/* 分割线 */
.divider {
  position: relative;
  width: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 10;
  background: var(--bg-primary);
  margin-bottom: 10px;
  margin-top: 5px;
}

.divider-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
  transition: background 0.15s;
}

.divider-line.dragging {
  background: linear-gradient(
    180deg,
    rgba(67, 111, 246, 0) 0%,
    rgba(67, 111, 246, 0.6) 21%,
    #436FF6 51%,
    rgba(67, 111, 246, 0.6) 82%,
    rgba(67, 111, 246, 0) 100%
  );
}

.divider:hover .divider-line {
  background: #E8EBF0;
}

.divider-handle {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 32px;
  background: #fff;
  border: 1px solid #E8EBF0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #C0C6D4;
  opacity: 0;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.drag-icon {
  width: 14px;
  height: 21.58px;
  object-fit: contain;
}

.drag-icon-hover {
  display: none;
}

.divider:hover .divider-handle {
  opacity: 1;
}

.divider-handle.dragging {
  opacity: 1;
  background: #BFD6FF;
}

.divider-handle.dragging .drag-icon-default {
  display: none;
}

.divider-handle.dragging .drag-icon-hover {
  display: block;
}

/* 左侧分割线：handle 向左突出，层级高于对话框 */
.left-divider {
  overflow: visible;
  z-index: 1600;
}

.left-divider .divider-handle {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1600;
}

/* 文件树区域 */
.file-tree-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  will-change: width;
  margin-bottom: 10px;
}

.notification-col {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  will-change: width;
  margin-bottom: 10px;
}

/* 拖拽时禁止子元素触发鼠标事件，防止卡顿 */
.global-file-panel.is-dragging * {
  pointer-events: none !important;
  user-select: none !important;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  min-height: 44px;
  padding: 0 16px 0 16px;
  border-bottom: none;
}

.file-tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(47, 53, 71, 0.06);
  border-radius: 8px;
  margin: 0 12px 8px;
  flex-shrink: 0;
}

.file-tab {
  flex: 1;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  color: #91949E;
  cursor: pointer;
  transition: all 0.15s;
}

.file-tab.active {
  background: #fff;
  color: #2F3547;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tree-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  font-family: PingFang SC, sans-serif;
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #8C93A6;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover {
  background: #F0F2F5;
  color: #2F3547;
}

.tree-root-path {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  padding: 8px 8px 8px 12px;
  border-bottom: 1px solid #F0F2F5;
  position: relative;
  z-index: 10;
}

.root-path-top {
  display: flex;
  align-items: center;
  position: relative;
}

/* 历史下拉菜单触发按钮居中定位 */
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
  /* justify-content: center; */
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

.tree-empty-btn svg {
  flex-shrink: 0;
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* float 模式：面板主体 */
.global-file-float-panel {
  position: fixed;
  top: 36px;
  right: 0;
  bottom: 0;
  display: flex;
  background: #fff;
  overflow: hidden;
  z-index: 2000;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
}
</style>

<style>
/* 文件面板历史下拉菜单：确保在所有层级之上 */
.file-panel-history-popper {
  /* width: auto !important; */
  box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.1) !important;
  border-radius: 8px;
}

.file-panel-history-dropdown {
  z-index: 9999 !important;
  width: 236px !important;
  max-height: 300px !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.file-panel-history-dropdown .el-dropdown-menu__item {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  display: block !important;
  max-width: 388px !important;
  box-sizing: border-box !important;
}

.history-item-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.file-panel-history-dropdown .el-dropdown-menu__item span {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  display: block !important;
  max-width: 388px !important;
}

.file-panel-history-dropdown::-webkit-scrollbar {
  width: 4px;
}

.file-panel-history-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.file-panel-history-dropdown::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}

/* 历史下拉菜单 popper 居中定位 - 相对于文件树容器居中 (文件树容器宽度 260px，下拉菜单宽度 236px，居中偏移 = 12px) */
/* popper 使用 fixed 定位，right: 12px 让它距离视口右侧 12px，在文件树容器中居中 */
/* .el-popper.file-panel-history-popper,
.el-popper.file-panel-history-popper[data-popper-placement="bottom"] {
  right: 11px !important;
  left: auto !important;
  margin: 0 !important;
  transform: none !important;
} */

.el-popper.file-panel-history-popper .el-popper__content {
  width: 236px !important;
}

/* 文件树 dropdown popover */
.file-tree-dropdown-popover {
  padding: 0 !important;
  border-radius: 8px !important;
  box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.12) !important;
  overflow: hidden;
}

.file-tree-dropdown-popover .dropdown-tree-wrap {
  max-height: 400px;
  overflow-y: auto;
  padding: 4px 0;
}

.file-tree-dropdown-popover .dropdown-tree-wrap::-webkit-scrollbar {
  width: 4px;
}

.file-tree-dropdown-popover .dropdown-tree-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.file-tree-dropdown-popover .dropdown-tree-wrap::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}
</style>
