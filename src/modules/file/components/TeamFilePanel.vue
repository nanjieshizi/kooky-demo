<template>
  <div class="team-file-panel" :class="{ 'is-dragging': isLeftDragging || isDividerDragging, 'is-float-mode': isFloatMode }" :style="{ width: effectivePanelWidth + 'px' }">
    <!-- 左侧分割线（控制面板总宽度，与对话框之间） -->
    <div
      v-if="!isFloatMode && (previewNode || showFileTree || showNotification)"
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

    <div v-if="previewNode || showFileTree || showNotification" class="panel-body">
      <!-- 左：预览区 -->
      <TeamFilePreview
        v-if="previewNode"
        :node="previewNode"
        :space-id="previewNode.spaceId ?? spaceId ?? ''"
        :room-type="roomType"
        class="preview-col"
        :style="{ width: previewWidth + 'px', marginRight: (!showFileTree && !showNotification) ? '8px' : '0' }"
        @close="previewNode = null"
      >
        <!-- dropdown 模式：在预览头部和内容区之间注入文件树选择器栏 -->
        <template v-if="showTreeAsDropdown" #selector-bar>
          <div class="tree-selector-bar">
            <el-popover
              :visible="treeDropdownVisible"
              placement="bottom-start"
              :width="280"
              popper-class="file-tree-dropdown-popover"
              :teleported="true"
              @click-outside="treeDropdownVisible = false"
            >
              <template #reference>
                <button class="tree-selector-btn" @click="treeDropdownVisible = !treeDropdownVisible">
                  <span class="tree-selector-label">{{ previewNode?.name ?? '请选择一个文件查看详情' }}</span>
                  <svg class="tree-selector-arrow" :class="{ open: treeDropdownVisible }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </template>
              <template #default>
                <div class="dropdown-tree-wrap">
                  <!-- dropdown 模式暂不支持（旧的 TeamFileNode 已废弃） -->
                  <div class="category-empty">暂不支持 dropdown 模式</div>
                </div>
              </template>
            </el-popover>
          </div>
        </template>
      </TeamFilePreview>

      <!-- 分割线（有预览且非 dropdown 模式时显示） -->
      <div
        v-if="previewNode && !showTreeAsDropdown && (showFileTree || showNotification)"
        class="divider"
        :class="{ dragging: isDividerDragging }"
        @mousedown="startDividerDrag"
      >
        <div class="divider-line" :class="{ dragging: isDividerDragging }"></div>
        <div class="divider-handle" :class="{ dragging: isDividerDragging }">
          <img :src="dragIcon" class="drag-icon drag-icon-default" alt="拖拽" />
          <img :src="dragHoverIcon" class="drag-icon drag-icon-hover" alt="拖拽" />
        </div>
      </div>

      <!-- dropdown 模式：文件树收进预览头部下拉（由 TeamFilePreview 内部触发，此处仅占位） -->

      <!-- 右：文件树 -->
      <div v-show="showFileTree" ref="treeColRef" class="file-tree-col">
        <!-- 顶部标题栏 -->
        <div class="panel-header">
          <span class="panel-title">文件</span>
          <button class="tree-btn close-panel-btn" title="关闭" @click="uiStore.collapseFileTree()">
            <img :src="closeIcon" width="16" height="16" alt="关闭" />
          </button>
        </div>

        <!-- Tab 切换栏 -->
        <div class="file-tab-bar">
          <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'team' }" @click="uiStore.setFileTab('team')">云端文件</button>
          <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'global' }" @click="uiStore.setFileTab('global')">本地文件</button>
        </div>

        <!-- 云端文件内容区 -->
        <template v-if="uiStore.activeFileTab === 'team'">
          <div class="cloud-tree-scroll">
            <!-- 我的分身分组 -->
            <div
              class="cloud-category"
              :class="{ 'category-drag-over': categoryDragOver === 'person' }"
              @dragover="handleCategoryDragOver($event, 'person')"
              @dragleave="handleCategoryDragLeave($event, 'person')"
              @drop="handleCategoryDrop($event, 'person')"
            >
              <div
                class="cloud-category-header"
                @click="toggleCategory('person')"
                @mouseenter="hoveredCategory = 'person'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="avatarIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">我的分身</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('person') }" width="8" height="8" alt="" />
                <div v-if="hoveredCategory === 'person'" class="category-actions" @click.stop>
                  <button class="category-action-btn" title="新建文件夹" @click="handleCategoryCreateFolder('person')">
                    <img :src="addIcon" width="14" height="14" alt="新建文件夹" />
                  </button>
                </div>
              </div>
              <template v-if="isCategoryExpanded('person')">
                <div v-if="isCategoryLoading('person')" class="category-loading">加载中...</div>
                <template v-else-if="personNodes.length > 0">
                  <CloudFileNode
                    v-for="node in personNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_person"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
                <div v-if="categoryCreatingKey === 'person'" class="category-inline-create">
                  <div class="rename-input-wrap">
                    <input
                      ref="categoryCreateInputRef"
                      v-model="categoryNewFolderName"
                      class="rename-input"
                      placeholder="文件夹名称"
                      @compositionstart="isComposing = true"
                      @compositionend="isComposing = false"
                      @keydown.enter="confirmCategoryCreateFolder"
                      @keydown.esc="cancelCategoryCreateFolder"
                      @blur="confirmCategoryCreateFolder"
                    />
                  </div>
                </div>
              </template>
            </div>

            <!-- 一人团队分组 -->
            <!-- <div
              class="cloud-category"
              :class="{ 'category-drag-over': categoryDragOver === 'solo-team' }"
              @dragover="handleCategoryDragOver($event, 'solo-team')"
              @dragleave="handleCategoryDragLeave($event, 'solo-team')"
              @drop="handleCategoryDrop($event, 'solo-team')"
            >
              <div
                class="cloud-category-header"
                @click="toggleCategory('solo-team')"
                @mouseenter="hoveredCategory = 'solo-team'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="soloTeamIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">一人团队</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('solo-team') }" width="8" height="8" alt="" />
                <div v-if="hoveredCategory === 'solo-team'" class="category-actions" @click.stop>
                  <button class="category-action-btn" title="新建文件夹" @click="handleCategoryCreateFolder('solo-team')">
                    <img :src="addIcon" width="14" height="14" alt="新建文件夹" />
                  </button>
                </div>
              </div>
              <template v-if="isCategoryExpanded('solo-team')">
                <div v-if="isCategoryLoading('solo-team')" class="category-loading">加载中...</div>
                <template v-else-if="soloTeamNodes.length > 0">
                  <CloudFileNode
                    v-for="node in soloTeamNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_opt"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
                <div v-if="categoryCreatingKey === 'solo-team'" class="category-inline-create">
                  <div class="rename-input-wrap">
                    <input
                      v-model="categoryNewFolderName"
                      class="rename-input"
                      placeholder="文件夹名称"
                      @compositionstart="isComposing = true"
                      @compositionend="isComposing = false"
                      @keydown.enter="confirmCategoryCreateFolder"
                      @keydown.esc="cancelCategoryCreateFolder"
                      @blur="confirmCategoryCreateFolder"
                    />
                  </div>
                </div>
              </template>
            </div> -->

            <!-- 协作分组 -->
            <div class="cloud-category">
              <div
                class="cloud-category-header"
                @click="toggleCategory('collaboration')"
                @mouseenter="hoveredCategory = 'collaboration'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="collaborationIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">协作</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('collaboration') }" width="8" height="8" alt="" />
              </div>
              <template v-if="isCategoryExpanded('collaboration')">
                <div v-if="isCategoryLoading('collaboration')" class="category-loading">加载中...</div>
                <template v-else-if="collaborationNodes.length > 0">
                  <CloudFileNode
                    v-for="node in collaborationNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_team"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
              </template>
            </div>

            <!-- Kode 分组（产研工作台 workspace → 本地文件 · 纯展示）-->
            <div class="cloud-category kode-file-category">
              <div class="cloud-category-header" @click="toggleKodeCategory">
                <span class="category-icon-emoji">⌨️</span>
                <span class="category-label">Kode</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: kodeCategoryOpen }" width="8" height="8" alt="" />
              </div>
              <template v-if="kodeCategoryOpen">
                <div v-for="ws in kodeWorkspaces" :key="ws.id" class="kode-ws-block">
                  <div class="kode-ws-head" @click="toggleKodeWs(ws.id)">
                    <span class="kode-ws-dot" :style="{ background: ws.color }"></span>
                    <span class="kode-ws-arrow" :class="{ expanded: expandedKodeWs[ws.id] }">▸</span>
                    <span class="kode-ws-name">{{ ws.name }}</span>
                    <span class="kode-ws-count">{{ kodeWsFileList(ws.id).length }}</span>
                  </div>
                  <ul v-if="expandedKodeWs[ws.id]" class="kode-file-list">
                    <li v-for="f in kodeWsFileList(ws.id)" :key="f.path" class="kode-file-item" :title="f.path">
                      <span class="kode-file-ico">{{ f.icon }}</span>
                      <span class="kode-file-path">{{ f.path }}</span>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- 本地文件内容区 -->
        <GlobalFileTree v-else />
      </div>

      <!-- 右：通知面板（与文件树互斥） -->
      <div v-show="showNotification" class="notification-col">
        <NotificationPanel
          :extra-cards="uiStore.notificationLeaveCards"
          @navigate="handleNotificationNavigate"
        />
      </div>
    </div>
  </div>

  <!-- 删除确认弹框 -->
  <el-dialog
    v-model="deleteDialogVisible"
    width="420px"
    :show-close="false"
    :z-index="20001"
    :append-to-body="true"
    align-center
    class="file-delete-dialog"
  >
    <template #header>
      <div class="delete-dialog-header">
        <div class="delete-dialog-header-left">
          <el-icon class="warning-icon"><WarningFilled /></el-icon>
          <span class="delete-dialog-title">您确认要删除文件夹吗？</span>
        </div>
        <button class="delete-dialog-close" @click="cancelDelete">
          <img :src="closeIcon" width="16" height="16" alt="关闭" />
        </button>
      </div>
    </template>
    <div class="delete-dialog-content">
      删除后子文件夹将同步删除，无法找回
    </div>
    <template #footer>
      <div class="delete-dialog-footer">
        <button class="cancel-btn" @click="cancelDelete">取消</button>
        <button class="confirm-btn" @click="confirmDelete">确定</button>
      </div>
    </template>
  </el-dialog>

  <!-- float 模式：浮层覆盖对话区 -->
  <Teleport to="body">
    <div
      v-if="isFloatMode && uiStore.isFilePanelOpen"
      class="team-file-float-panel"
      :style="{ width: (previewNode ? Math.max(previewWidth, 420) : panelWidth) + 'px' }"
    >
      <!-- 有预览：全宽预览 + dropdown 选择器切换文件 -->
      <TeamFilePreview
        v-if="previewNode"
        :node="previewNode"
        :space-id="previewNode.spaceId ?? spaceId ?? ''"
        :room-type="roomType"
        class="preview-col"
        style="flex: 1; min-width: 0;"
        @close="previewNode = null"
      >
        <template #selector-bar>
          <div class="tree-selector-bar">
            <el-popover
              :visible="treeDropdownVisible"
              placement="bottom-start"
              :width="280"
              popper-class="file-tree-dropdown-popover"
              :teleported="true"
              @click-outside="treeDropdownVisible = false"
            >
              <template #reference>
                <button class="tree-selector-btn" @click="treeDropdownVisible = !treeDropdownVisible">
                  <span class="tree-selector-label">{{ previewNode?.name ?? '请选择一个文件查看详情' }}</span>
                  <svg class="tree-selector-arrow" :class="{ open: treeDropdownVisible }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </template>
              <template #default>
                <div class="dropdown-tree-wrap">
                  <!-- dropdown 模式暂不支持（旧的 TeamFileNode 已废弃） -->
                  <div class="category-empty">暂不支持 dropdown 模式</div>
                </div>
              </template>
            </el-popover>
          </div>
        </template>
      </TeamFilePreview>
      <!-- 无预览：文件树 -->
      <div v-else class="file-tree-col">
        <div class="panel-header">
          <span class="panel-title">文件</span>
          <button class="tree-btn close-panel-btn" title="关闭" @click="closeFloatPanel">
            <img :src="closeIcon" width="16" height="16" alt="关闭" />
          </button>
        </div>

        <!-- Tab 切换栏 -->
        <div class="file-tab-bar">
          <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'team' }" @click="uiStore.setFileTab('team')">云端文件</button>
          <button class="file-tab" :class="{ active: uiStore.activeFileTab === 'global' }" @click="uiStore.setFileTab('global')">本地文件</button>
        </div>

        <!-- 云端文件内容区（float 模式） -->
        <template v-if="uiStore.activeFileTab === 'team'">
          <div class="cloud-tree-scroll">
            <div
              class="cloud-category"
              :class="{ 'category-drag-over': categoryDragOver === 'person' }"
              @dragover="handleCategoryDragOver($event, 'person')"
              @dragleave="handleCategoryDragLeave($event, 'person')"
              @drop="handleCategoryDrop($event, 'person')"
            >
              <div
                class="cloud-category-header"
                @click="toggleCategory('person')"
                @mouseenter="hoveredCategory = 'person'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="avatarIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">我的分身</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('person') }" width="8" height="8" alt="" />
                <div v-if="hoveredCategory === 'person'" class="category-actions" @click.stop>
                  <button class="category-action-btn" title="新建文件夹" @click="handleCategoryCreateFolder('person')">
                    <img :src="addIcon" width="14" height="14" alt="新建文件夹" />
                  </button>
                </div>
              </div>
              <template v-if="isCategoryExpanded('person')">
                <div v-if="isCategoryLoading('person')" class="category-loading">加载中...</div>
                <template v-else-if="personNodes.length > 0">
                  <CloudFileNode
                    v-for="node in personNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_person"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
                <div v-if="categoryCreatingKey === 'person'" class="category-inline-create">
                  <div class="rename-input-wrap">
                    <input
                      v-model="categoryNewFolderName"
                      class="rename-input"
                      placeholder="文件夹名称"
                      @compositionstart="isComposing = true"
                      @compositionend="isComposing = false"
                      @keydown.enter="confirmCategoryCreateFolder"
                      @keydown.esc="cancelCategoryCreateFolder"
                      @blur="confirmCategoryCreateFolder"
                    />
                  </div>
                </div>
              </template>
            </div>
            <div
              class="cloud-category"
              :class="{ 'category-drag-over': categoryDragOver === 'solo-team' }"
              @dragover="handleCategoryDragOver($event, 'solo-team')"
              @dragleave="handleCategoryDragLeave($event, 'solo-team')"
              @drop="handleCategoryDrop($event, 'solo-team')"
            >
              <div
                class="cloud-category-header"
                @click="toggleCategory('solo-team')"
                @mouseenter="hoveredCategory = 'solo-team'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="soloTeamIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">一人团队</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('solo-team') }" width="8" height="8" alt="" />
                <div v-if="hoveredCategory === 'solo-team'" class="category-actions" @click.stop>
                  <button class="category-action-btn" title="新建文件夹" @click="handleCategoryCreateFolder('solo-team')">
                    <img :src="addIcon" width="14" height="14" alt="新建文件夹" />
                  </button>
                </div>
              </div>
              <template v-if="isCategoryExpanded('solo-team')">
                <div v-if="isCategoryLoading('solo-team')" class="category-loading">加载中...</div>
                <template v-else-if="soloTeamNodes.length > 0">
                  <CloudFileNode
                    v-for="node in soloTeamNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_opt"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
                <div v-if="categoryCreatingKey === 'solo-team'" class="category-inline-create">
                  <div class="rename-input-wrap">
                    <input
                      v-model="categoryNewFolderName"
                      class="rename-input"
                      placeholder="文件夹名称"
                      @compositionstart="isComposing = true"
                      @compositionend="isComposing = false"
                      @keydown.enter="confirmCategoryCreateFolder"
                      @keydown.esc="cancelCategoryCreateFolder"
                      @blur="confirmCategoryCreateFolder"
                    />
                  </div>
                </div>
              </template>
            </div>
            <div class="cloud-category">
              <div
                class="cloud-category-header"
                @click="toggleCategory('collaboration')"
                @mouseenter="hoveredCategory = 'collaboration'"
                @mouseleave="hoveredCategory = null"
              >
                <img :src="collaborationIcon" class="category-icon" width="18" height="18" alt="" />
                <span class="category-label">协作</span>
                <img :src="cloudCategoryIcon" class="category-arrow" :class="{ expanded: isCategoryExpanded('collaboration') }" width="8" height="8" alt="" />
              </div>
              <template v-if="isCategoryExpanded('collaboration')">
                <div v-if="isCategoryLoading('collaboration')" class="category-loading">加载中...</div>
                <template v-else-if="collaborationNodes.length > 0">
                  <CloudFileNode
                    v-for="node in collaborationNodes"
                    :key="node.nodeId"
                    :node="node"
                    :depth="0"
                    :person-biz-id="personBizId"
                    :teams="teamsForApi"
                    :selected-node-id="selectedCloudNodeId"
                    parent-node-id="category_team"
                    @preview="handleCloudPreview"
                    @rename="handleCloudRename"
                    @delete="handleCloudDelete"
                    @create-folder="handleCloudCreateFolder"
                    @select="selectedCloudNodeId = $event.nodeId"
                    @move="handleCloudMove"
                  />
                </template>
                <div v-else class="category-empty">暂无文件</div>
              </template>
            </div>
          </div>
        </template>
        <GlobalFileTree v-else />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useFileStore } from '@/modules/file/store'
import { useGroupStore } from '@/modules/group/store'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useWindowWidth } from '@/shared/hooks/useWindowWidth'
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import TeamFilePreview from './TeamFilePreview.vue'
import NotificationPanel from '@/modules/space/components/NotificationPanel.vue'
import { batchGetRefs, teamFileService } from '@/modules/file/service'
import { referenceMediaFile } from '@/shared/services/imApi'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import GlobalFileTree from './GlobalFileTree.vue'
import CloudFileNode from './CloudFileNode.vue'
// Kode 分类（纯展示，不动现有 IM 文件树逻辑）
import { workspaces as kodeWorkspaces, workspaceFiles as kodeWorkspaceFiles } from '@/modules/kode/mocks/data'
import closeIcon from '@/assets/home/close.svg'
import addIcon from '@/assets/home/add.svg'
import folderIcon from '@/assets/home/folderTree.svg'
import emptyStateIcon from '@/assets/home/flie-preview.png'
import dragIcon from '@/assets/home/drag.svg'
import dragHoverIcon from '@/assets/home/dragHover.svg'
import expandIcon from '@/assets/home/expand.svg'
import collapseIcon from '@/assets/home/collapse.svg'
import cloudCategoryIcon from '@/assets/home/cloud-category.svg'
import avatarIcon from '@/assets/home/left_h.png'
import soloTeamIcon from '@/assets/home/one-team.png'
import collaborationIcon from '@/assets/home/collaboration.png'

const fileStore = useFileStore()
const groupStore = useGroupStore()
const soloTeamStore = useSoloTeamStore()
const uiStore = useUIStore()
const connectionStore = useImConnectionStore()
const deerflowStore = useDeerflowChatStore()

// 响应式窗口宽度同步到 uiStore
const { windowWidth } = useWindowWidth()
watch(windowWidth, (w) => uiStore.setWindowWidth(w), { immediate: true })

// 预览状态（需要在 computed 之前定义）
const previewNode = ref(null)
const previewWidth = ref(Number(localStorage.getItem('team-file-preview-width')) || 420)
// 单独记录文件树宽度（不含预览），用于场景切换时恢复
const treeOnlyWidth = ref(Math.max(268, Number(localStorage.getItem('team-file-tree-width')) || 320))
// 启动时预览始终关闭，panelWidth 应等于 treeOnlyWidth（不能从 team-file-panel-width 读取，
// 因为上次会话可能以"预览+文件树"状态结束，导致存储的是含预览的总宽度）
const panelWidth = ref(treeOnlyWidth.value)
const isDividerDragging = ref(false)
const isLeftDragging = ref(false)

// 显示模式
const panelMode = computed(() => uiStore.filePanelDisplayMode)
const isFloatMode = computed(() => panelMode.value === 'float')
const showTreeAsDropdown = computed(() =>
  panelMode.value === 'dropdown' && !!previewNode.value
)
const treeDropdownVisible = ref(false)

watch([showTreeAsDropdown, isFloatMode], ([dropdown, float]) => {
  if (!dropdown || float) treeDropdownVisible.value = false
})

watch(previewNode, (node, oldNode) => {
  uiStore.globalFilePreviewActive = !!node

  // 关闭预览时，只有在文件树激活的情况下才收缩面板宽度到文件树宽度
  if (!node && oldNode) {
    // 只有文件树展开且激活时，才保留文件树宽度
    if (!uiStore.fileTreeCollapsed && uiStore.activeToolTab === 'file') {
    panelWidth.value = treeOnlyWidth.value
    localStorage.setItem('team-file-panel-width', panelWidth.value)
  }
    // 否则面板宽度会通过 effectivePanelWidth 计算为 0，无需设置 panelWidth
  }
})

// 文件树从折叠切换为展开时，若有预览则确保总宽度可容纳预览+文件树
watch(() => uiStore.fileTreeCollapsed, (collapsed, prevCollapsed) => {
  if (prevCollapsed && !collapsed && previewNode.value) {
    const minPanel = previewWidth.value + 304
    if (panelWidth.value < minPanel) {
      panelWidth.value = minPanel
      localStorage.setItem('team-file-panel-width', panelWidth.value)
    }
  }
})

// 面板有效宽度
const effectivePanelWidth = computed(() => {
  if (isFloatMode.value) return 0
  // 通知面板打开时，显示面板宽度（无预览时用 treeOnlyWidth，有预览时用 panelWidth）
  if (uiStore.notificationPanelOpen && !showTreeAsDropdown.value) {
    return previewNode.value ? panelWidth.value : treeOnlyWidth.value
  }
  if (showTreeAsDropdown.value || uiStore.fileTreeCollapsed) return previewNode.value ? previewWidth.value + 16 : 0
  // 无预览且文件树未激活时，面板宽度为 0
  if (!previewNode.value && uiStore.activeToolTab !== 'file') return 0
  return panelWidth.value
})

// 根据当前导航获取 spaceId
const spaceId = computed(() => {
  const nav = uiStore.activePrimaryNav
  if (nav === 'solo-team') return soloTeamStore.currentTeamId
  if (nav === 'collaboration') return groupStore.currentSpaceId
  return null
})

// 获取当前房间的 createRoomType，并映射为 media/transfer 接口所需的 roomType
const roomType = computed(() => {
  const nav = uiStore.activePrimaryNav
  const id = spaceId.value
  if (!id) return 'group_chat'

  if (nav === 'solo-team') {
    return 'super_person_chat'
  }
  if (nav === 'collaboration') {
    const conversation = (groupStore.conversations ?? []).find(item => item.conversationId === id)
    return conversation?.createRoomType || 'group_chat'
  }
  return 'group_chat'
})

// 初始加载 & 切换空间时重新加载（已废弃：云端文件树通过 activeCategoryKey 的 watch 自动加载）

let unsubscribeFileSaved = null

onMounted(() => {
  loadStorageQuota()
  // 监听文件上传成功事件，自动刷新云端文件树
  window.addEventListener('files-uploaded-to-tree', handleFilesUploaded)
  // 监听独立预览窗口保存成功的 IPC 通知
  unsubscribeFileSaved = window.electronAPI?.onFileSavedToTree?.(handleFilesUploaded)
})

onUnmounted(() => {
  window.removeEventListener('files-uploaded-to-tree', handleFilesUploaded)
  unsubscribeFileSaved?.()
})

// 处理文件上传成功事件（DOM CustomEvent 或 IPC payload 两种来源）
async function handleFilesUploaded(eventOrPayload) {
  const payload = eventOrPayload instanceof Event ? eventOrPayload.detail : eventOrPayload
  const spaceId = payload?.spaceId
  const roomType = payload?.roomType

  if (spaceId) {
    // 根据 roomType 判断文件类型并刷新对应的文件树节点
    if (roomType === 'bot_person_chat') {
      // 分身场景：刷新个人文件树并自动展开
      fileStore.invalidateCloudNode('category_person')
      await fileStore.loadCloudTreeNode('category_person', personBizId.value, teamsForApi.value)
      // 自动展开"我的分身"分类
      manualCollapsedCategories.value.delete('person')
      manualExpandedCategories.value.add('person')
    } else if (roomType === 'super_person_chat') {
      // 一人团队场景：刷新一人团队文件树并自动展开
      fileStore.invalidateCloudNode('category_opt')
      await fileStore.loadCloudTreeNode('category_opt', personBizId.value, teamsForApi.value)
      // 自动展开"一人团队"分类
      manualCollapsedCategories.value.delete('solo-team')
      manualExpandedCategories.value.add('solo-team')
    } else {
      // 团队协作场景（group_chat 或其他）：刷新团队文件树并自动展开
      const teamRootNodeId = `team_root:${spaceId}`
      fileStore.invalidateCloudNode('category_team')
      fileStore.invalidateCloudNode(teamRootNodeId)
      await fileStore.loadCloudTreeNode('category_team', personBizId.value, teamsForApi.value)
      await fileStore.loadCloudTreeNode(teamRootNodeId, personBizId.value, teamsForApi.value)
      // 自动展开"协作"分类
      manualCollapsedCategories.value.delete('collaboration')
      manualExpandedCategories.value.add('collaboration')
    }
  } else {
    await fileStore.refreshActiveCloudTree(personBizId.value, teamsForApi.value, activeCategoryKey.value)
  }
}

watch(spaceId, () => {
  previewNode.value = null
  panelWidth.value = treeOnlyWidth.value
  localStorage.setItem('team-file-panel-width', panelWidth.value)
  loadStorageQuota()
})

// 监听场景切换（我的分身/协作/一人团队），切换时重置预览并恢复纯文件树宽度
watch(() => uiStore.activePrimaryNav, () => {
  previewNode.value = null
  panelWidth.value = treeOnlyWidth.value
  localStorage.setItem('team-file-panel-width', panelWidth.value)
})

// 监听文件面板打开/关闭，重新打开时重新加载数据（已废弃：云端文件树自动加载）
watch(() => uiStore.activeToolTab, (newTab, oldTab) => {
  if (newTab === 'file' && oldTab !== 'file') {
    loadStorageQuota()
  }
})

// 监听文件按钮点击序列号，每次点击都刷新文件列表
watch(() => uiStore.fileTabClickSerial, () => {
  if (uiStore.activeToolTab === 'file') {
    loadStorageQuota()
  }
})

// ─── 云端文件树（新 API）────────────────────────────────────────────────────────

// 我的分身 bizId：使用当前选中的 agentId
const personBizId = computed(() => {
  const agentId = deerflowStore.selectedAgentId
  if (agentId != null && String(agentId).trim() !== '') return String(agentId)
  return ''
})

// 协作团队列表
const teamsForApi = computed(() =>
  (groupStore.conversations ?? []).map(conversation => ({
    bizId: conversation.conversationId,
    name: conversation.name ?? '',
  }))
)

// 当前激活的分类（与 activePrimaryNav 联动）
const activeCategoryKey = computed(() => {
  const nav = uiStore.activePrimaryNav
  if (nav === 'deerflow') return 'person'
  if (nav === 'solo-team') return 'solo-team'
  if (nav === 'collaboration') return 'collaboration'
  return null
})

// 手动展开/收起的分类集合（覆盖自动联动）
const manualExpandedCategories = ref(new Set())
const manualCollapsedCategories = ref(new Set())

function isCategoryExpanded(key) {
  if (manualCollapsedCategories.value.has(key)) return false
  if (manualExpandedCategories.value.has(key)) return true
  return activeCategoryKey.value === key
}

function isCategoryLoading(key) {
  const nodeId = categoryToNodeId(key)
  return fileStore.cloudTree.loadingNodeIds.includes(nodeId)
}

function categoryToNodeId(key) {
  if (key === 'person') return 'category_person'
  if (key === 'solo-team') return 'category_opt'
  if (key === 'collaboration') return 'category_team'
  return key
}

const personNodes = computed(() => fileStore.cloudTree.nodeCache['category_person'] ?? [])
const soloTeamNodes = computed(() => fileStore.cloudTree.nodeCache['category_opt'] ?? [])
const collaborationNodes = computed(() => fileStore.cloudTree.nodeCache['category_team'] ?? [])

const selectedCloudNodeId = ref(null)
const hoveredCategory = ref(null)

// Kode 分类状态（本地）— 默认 Kode 展开，workspace 默认收起
const kodeCategoryOpen = ref(true)
const expandedKodeWs = ref({})
function toggleKodeCategory() {
  kodeCategoryOpen.value = !kodeCategoryOpen.value
}
function toggleKodeWs(wsId) {
  expandedKodeWs.value[wsId] = !expandedKodeWs.value[wsId]
}
function kodeWsFileList(wsId) {
  return kodeWorkspaceFiles[wsId] || []
}

async function toggleCategory(key) {
  const nodeId = categoryToNodeId(key)
  if (isCategoryExpanded(key)) {
    manualCollapsedCategories.value.add(key)
    manualExpandedCategories.value.delete(key)
  } else {
    manualCollapsedCategories.value.delete(key)
    manualExpandedCategories.value.add(key)
    await fileStore.loadCloudTreeNode(nodeId, personBizId.value, teamsForApi.value)
  }
}

// 切换导航时自动展开对应分类并加载数据
watch(activeCategoryKey, async (key) => {
  if (!key) return
  // 我的分身分类需要等待 personBizId 有值
  if (key === 'person' && !personBizId.value) return
  // 清除所有手动状态，让自动联动接管
  manualExpandedCategories.value.clear()
  manualCollapsedCategories.value.clear()
  const nodeId = categoryToNodeId(key)
  await fileStore.loadCloudTreeNode(nodeId, personBizId.value, teamsForApi.value)
}, { immediate: true })

// 监听协作团队列表变化，新建团队后缓存已失效时重新加载
watch(teamsForApi, async () => {
  if (activeCategoryKey.value !== 'collaboration') return
  if (fileStore.cloudTree.nodeCache['category_team']) return
  await fileStore.loadCloudTreeNode('category_team', personBizId.value, teamsForApi.value)
})

// 监听 personBizId 变化，当从空变为有值时重新加载我的分身数据
watch(personBizId, async (newId, oldId) => {
  if (!oldId && newId && activeCategoryKey.value === 'person') {
    const nodeId = categoryToNodeId('person')
    // 清除可能存在的空数据缓存
    fileStore.invalidateCloudNode(nodeId)
    await fileStore.loadCloudTreeNode(nodeId, newId, teamsForApi.value)
  }
})

// 云端文件操作
async function handleCloudPreview(node) {
  if (!node.fileId) return
  const fileInfo = {
    id: node.fileId,
    name: node.name,
    type: node.suffix || node.nodeType,
    mimeType: node.mimeType,
    size: node.fileSize,
    spaceId: node.businessId ?? null,
    roomType: null,
  }
  window.electronAPI?.openFilePreview?.(fileInfo)
}

async function handleCloudRename({ node, newName }) {
  try {
    await teamFileService.renameFile(node.businessId, node.fileId, newName)
    const parentNodeId = deriveParentNodeId(node)
    fileStore.invalidateCloudNode(parentNodeId)
    await fileStore.loadCloudTreeNode(parentNodeId, personBizId.value, teamsForApi.value)
  } catch {
    ElMessage.error('重命名失败')
  }
}

async function handleCloudDelete(node) {
  pendingCloudDeleteNode.value = node
  deleteDialogVisible.value = true
}

async function handleCloudMove({ dragNode, targetNode, dragParentNodeId }) {
  try {
    await fileStore.moveCloudFile(dragNode, targetNode, dragParentNodeId, personBizId.value, teamsForApi.value)
  } catch {
    ElMessage.error('移动失败')
  }
}

async function handleCloudCreateFolder({ parentNodeId, name, businessId, businessType }) {
  try {
    const parentFileId = parentNodeId.startsWith('dir:') ? parentNodeId.split(':').pop() : null
    await teamFileService.createDirectory(businessId, parentFileId, name, businessType)
    fileStore.invalidateCloudNode(parentNodeId)
    await fileStore.loadCloudTreeNode(parentNodeId, personBizId.value, teamsForApi.value)
  } catch {
    ElMessage.error('创建文件夹失败')
  }
}

// 分组级内联新建文件夹
const categoryCreatingKey = ref(null)
const categoryNewFolderName = ref('')
const categoryCreateInputRef = ref(null)
const isComposing = ref(false) // 输入法组合状态（用于 macOS 中文输入法兼容）

async function handleCategoryCreateFolder(categoryKey) {
  // 先确保分组展开
  if (!isCategoryExpanded(categoryKey)) {
    await toggleCategory(categoryKey)
  }
  categoryCreatingKey.value = categoryKey
  categoryNewFolderName.value = ''
  nextTick(() => categoryCreateInputRef.value?.focus())
}

async function confirmCategoryCreateFolder() {
  // 输入法组合中，忽略回车（macOS 中文输入法兼容）
  if (isComposing.value) return

  const name = categoryNewFolderName.value.trim()
  if (!name) { cancelCategoryCreateFolder(); return }

  const categoryKey = categoryCreatingKey.value
  let businessId = null
  let parentNodeId = null
  let businessType = null

  if (categoryKey === 'person') {
    businessId = personBizId.value
    parentNodeId = 'category_person'
    businessType = 'person'
  } else if (categoryKey === 'solo-team') {
    const soloTeams = soloTeamStore.onePersonTeams
    if (soloTeams.length === 0) { ElMessage.warning('暂无一人团队'); cancelCategoryCreateFolder(); return }
    businessId = soloTeamStore.currentTeamId || soloTeams[0].id
    parentNodeId = 'category_opt'
    businessType = 'opt'
  } else if (categoryKey === 'collaboration') {
    const teams = groupStore.conversations
    if (teams.length === 0) { ElMessage.warning('暂无协作团队'); cancelCategoryCreateFolder(); return }
    businessId = groupStore.currentSpaceId
    parentNodeId = 'category_team'
    businessType = 'team'
  }

  cancelCategoryCreateFolder()
  if (!businessId) return

  try {
    await teamFileService.createDirectory(businessId, null, name, businessType)
    fileStore.invalidateCloudNode(parentNodeId)
    await fileStore.loadCloudTreeNode(parentNodeId, personBizId.value, teamsForApi.value)
    ElMessage.success('创建成功')
  } catch {
    ElMessage.error('创建文件夹失败')
  }
}

function cancelCategoryCreateFolder() {
  categoryCreatingKey.value = null
  categoryNewFolderName.value = ''
}

// 分组根目录拖放（将节点移到该分组根目录）
const categoryDragOver = ref(null)

function handleCategoryDragOver(e, categoryKey) {
  const src = window.__cloudDragNode
  if (!src) return
  const node = src.node
  // 只允许同类型区域内拖放
  const typeMap = { person: 'person', 'solo-team': 'opt', collaboration: 'team' }
  if (node.businessType !== typeMap[categoryKey]) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  categoryDragOver.value = categoryKey
}

function handleCategoryDragLeave(e, categoryKey) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    if (categoryDragOver.value === categoryKey) categoryDragOver.value = null
  }
}

async function handleCategoryDrop(e, categoryKey) {
  categoryDragOver.value = null
  const src = window.__cloudDragNode
  window.__cloudDragNode = null
  if (!src) return
  const typeMap = { person: 'person', 'solo-team': 'opt', collaboration: 'team' }
  if (src.node.businessType !== typeMap[categoryKey]) return
  e.preventDefault()

  const nodeIdMap = { person: 'category_person', 'solo-team': 'category_opt', collaboration: 'category_team' }
  const parentNodeId = nodeIdMap[categoryKey]

  // 已经在根目录则不处理
  if (src.parentNodeId === parentNodeId) return

  try {
    await fileStore.moveCloudFile(src.node, { nodeType: 'team_root', nodeId: parentNodeId, fileId: null, businessId: src.node.businessId }, src.parentNodeId, personBizId.value, teamsForApi.value)
  } catch {
    ElMessage.error('移动失败')
  }
}

function deriveParentNodeId(node) {
  // 从 nodeCache 中反查包含该节点的父节点
  const cache = fileStore.cloudTree.nodeCache
  for (const [parentId, children] of Object.entries(cache)) {
    if (Array.isArray(children) && children.some(c => c.nodeId === node.nodeId)) {
      return parentId
    }
  }
  // 兜底：刷新分类根节点
  if (node.businessType === 'person') return 'category_person'
  if (node.businessType === 'opt') return 'category_opt'
  return `team_root:${node.businessId}`
}


const isAllFilesHovered = ref(false)
const isAllFilesDropdownOpen = ref(false)

function handleAllFilesMouseLeave() {
  if (!isAllFilesDropdownOpen.value) isAllFilesHovered.value = false
}

function handleAllFilesCreateCommand(command) {
  if (command === 'newFolder') {
    startCreateFolder(null)
  }
}

// ─── 新建文件夹 ───────────────────────────────────────────────────────────────
const creatingFolder = ref(false)
const creatingFolderParentId = ref(null)
const newFolderName = ref('')
const createInputRef = ref(null)

function startCreateFolder(parentId) {
  creatingFolder.value = true
  creatingFolderParentId.value = parentId ?? null
  newFolderName.value = ''
  nextTick(() => createInputRef.value?.focus())
}

async function confirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) { cancelCreateFolder(); return }
  try {
    await fileStore.createTeamFolder(spaceId.value, name, creatingFolderParentId.value)
  } catch (e) {
    ElMessage.error('创建文件夹失败')
  }
  cancelCreateFolder()
}

function cancelCreateFolder() {
  creatingFolder.value = false
  newFolderName.value = ''
  creatingFolderParentId.value = null
}

// 处理来自子节点的新建文件夹事件（带 name 参数，直接创建）
async function handleCreateFolder(parentId, name) {
  if (!name) return
  try {
    await fileStore.createTeamFolder(spaceId.value, name, parentId)
  } catch (e) {
    ElMessage.error('创建文件夹失败')
  }
}

// ─── 重命名 ───────────────────────────────────────────────────────────────────
async function handleRename(nodeId, newName) {
  try {
    await fileStore.renameTeamFile(spaceId.value, nodeId, newName)
  } catch (e) {
    ElMessage.error('重命名失败')
  }
}

// ─── 删除确认弹框 ─────────────────────────────────────────────────────────────
const deleteDialogVisible = ref(false)
const pendingDeleteNodeId = ref(null)
const pendingCloudDeleteNode = ref(null)

function cancelDelete() {
  deleteDialogVisible.value = false
  pendingDeleteNodeId.value = null
  pendingCloudDeleteNode.value = null
}

async function confirmDelete() {
  if (pendingCloudDeleteNode.value) {
    const node = pendingCloudDeleteNode.value
    try {
      await teamFileService.deleteFiles(node.businessId, [node.fileId])
      const parentNodeId = deriveParentNodeId(node)
      fileStore.invalidateCloudNode(parentNodeId)
      await fileStore.loadCloudTreeNode(parentNodeId, personBizId.value, teamsForApi.value)
      cancelDelete()
    } catch {
      ElMessage.error('删除失败')
    }
    return
  }
  const nodeId = pendingDeleteNodeId.value
  if (!nodeId) {
    cancelDelete()
    return
  }
  try {
    await fileStore.deleteTeamFiles(spaceId.value, [nodeId])
    cancelDelete()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

// ─── 删除 ─────────────────────────────────────────────────────────────────────
function handleDelete(nodeId) {
  pendingDeleteNodeId.value = nodeId
  deleteDialogVisible.value = true
}

// ─── 预览 ─────────────────────────────────────────────────────────────────────
async function handlePreview(node, _options = {}) {
  // 打开独立预览窗口
  if (window.electronAPI?.openFilePreview) {
    const fileInfo = {
      id: node.id ?? node.fileId,
      name: node.name,
      type: node.type ?? node.suffix,
      mimeType: node.mimeType,
      size: node.size ?? node.fileSize,
      httpUrl: node.httpUrl ?? node.downloadUrl ?? null,
      spaceId: spaceId.value ?? null,
      roomType: roomType.value ?? null,
    }
    window.electronAPI.openFilePreview(fileInfo)
    return
  }

  // ── 以下为原左侧预览区逻辑，暂时保留备用 ──────────────────────────────────
  /*
  const { expandTree = true } = options

  // 打开预览前，先保存当前纯文件树宽度（在 panelWidth 被扩展之前）
  if (!previewNode.value) {
    treeOnlyWidth.value = Math.max(260, panelWidth.value)
    localStorage.setItem('team-file-tree-width', treeOnlyWidth.value)
  }

  previewNode.value = node

  // 根据 expandTree 选项决定是否展开文件树
  if (expandTree) {
    uiStore.expandFileTree()
  }

  // 确保文件面板打开
  if (!expandTree) {
    // 从对话流点击文件：不改变文件树开合状态，只确保面板可见
    if (!uiStore.toolFileContentVisible) {
      uiStore.toolFileContentVisible = true
      uiStore.globalFilePanelVisible = true
    }
  } else if (!uiStore.toolFileContentVisible) {
    uiStore.setActiveToolTab('file')
  }

  // 只在展开文件树时才调整 panelWidth
  if (expandTree) {
    const mainAreaEl = Array.from(document.querySelectorAll('.main-area')).find(el => el.offsetWidth > 0)
    const mainAreaWidth = mainAreaEl?.offsetWidth ?? Infinity
    const maxPanel = Math.min(900, mainAreaWidth > 320 ? mainAreaWidth - 320 - 52 : Infinity)
    const minPanel = previewWidth.value + 304

    if (panelWidth.value < minPanel) {
      if (minPanel <= maxPanel) {
        panelWidth.value = minPanel
      } else {
        // 空间不足，缩小预览宽度
        const newPreviewWidth = Math.max(280, maxPanel - 304)
        previewWidth.value = newPreviewWidth
        panelWidth.value = newPreviewWidth + 304
        localStorage.setItem('team-file-preview-width', previewWidth.value)
      }
      localStorage.setItem('team-file-panel-width', panelWidth.value)
    }
  } else if (!isFloatMode.value) {
    // 不展开文件树时，如果不是 float 模式，也需要确保 panelWidth 足够显示预览
    // 仅在右侧面板实际可见（文件树或通知）时，才需要预留右侧宽度
    if ((!uiStore.fileTreeCollapsed && uiStore.activeToolTab === 'file') || uiStore.notificationPanelOpen) {
      const minPanel = previewWidth.value + 304
      if (panelWidth.value < minPanel) {
        panelWidth.value = minPanel
        localStorage.setItem('team-file-panel-width', panelWidth.value)
      }
    } else {
      const minPanel = previewWidth.value + 16
      if (panelWidth.value < minPanel) {
        panelWidth.value = minPanel
        localStorage.setItem('team-file-panel-width', panelWidth.value)
      }
    }
  }

  // 引用文件到对话框
  if (node.type !== 'folder' && spaceId.value) {
    try {
      const refs = await batchGetRefs(spaceId.value, [node.id])
      if (refs?.[0]) {
        const result = await referenceMediaFile(null, {
          mimeType: node.mimeType || 'application/octet-stream',
          fileName: node.name || node.displayName || '',
          downloadUrl: refs[0].downloadUrl,
        })
        window.dispatchEvent(new CustomEvent('team-file-ref', {
          detail: { ...refs[0], httpUrl: result?.contentUri },
        }))
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.data?.message || e?.message || '文件引用失败'
      ElMessage.error(errMsg)
      console.error('[TeamFilePanel] 获取文件引用失败:', e)
    }
  }
  */
}

// 监听来自消息附件的外部预览请求（immediate: true 确保面板挂载时即捕获已设置的值）
watch(() => uiStore.pendingPreviewFile, (file) => {
  if (!file) return
  // 直接设置 previewNode 触发内嵌预览，不走 electronAPI
  if (!previewNode.value) {
    treeOnlyWidth.value = Math.max(260, panelWidth.value)
    localStorage.setItem('team-file-tree-width', treeOnlyWidth.value)
  }
  previewNode.value = {
    id: file.id,
    name: file.name,
    type: file.type,
    httpUrl: file.httpUrl,
    size: file.size,
    mimeType: file.mimeType,
    spaceId: file.spaceId ?? spaceId.value ?? null,
  }
  uiStore.pendingPreviewFile = null
}, { immediate: true })

// 组件级别拖拽清理函数，用于 onUnmounted 时强制清理僵尸监听器（防止 HMR 热更新后拖拽失效）
let cleanupLeftDrag = null
let cleanupDividerDrag = null

function startLeftDividerDrag(e) {
  // 先清理可能残留的上一次拖拽监听器
  if (cleanupLeftDrag) { cleanupLeftDrag(); cleanupLeftDrag = null }

  e.preventDefault()
  isLeftDragging.value = true
  const startX = e.clientX
  const startPanelWidth = effectivePanelWidth.value
  const startPreviewWidth = previewWidth.value
  const isTreeCollapsed = uiStore.fileTreeCollapsed
  const isNotificationOpen = uiStore.notificationPanelOpen

  // 计算右侧固定区域宽度（文件树或通知面板）
  // 通知面板打开时 fileTreeCollapsed=true，但右侧实际有通知面板占据宽度
  let fixedWidth = 0
  if (isNotificationOpen) {
    fixedWidth = previewNode.value ? Math.max(0, startPanelWidth - startPreviewWidth) : startPanelWidth
  } else if (!isTreeCollapsed) {
    fixedWidth = Math.max(0, startPanelWidth - startPreviewWidth)
  }

  // 只获取可见的 .main-area（避免获取到被 v-show 隐藏的终端区域）
  const mainAreaEl = Array.from(document.querySelectorAll('.main-area')).find(el => el.offsetWidth > 0)
  const startMainAreaWidth = mainAreaEl?.offsetWidth ?? Infinity
  let rafId = null

  function blockDragStart(ev) { ev.preventDefault(); ev.stopPropagation() }
  document.addEventListener('dragstart', blockDragStart, true)

  function onMouseMove(e) {
    if (rafId) return
    const clientX = e.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = startX - clientX
      if (previewNode.value) {
        // 有预览：改变预览宽度，右侧面板宽度固定
        const maxByMainArea = startPanelWidth + Math.max(0, startMainAreaWidth - 320 - 52)
        const maxPreview = Math.min(900, maxByMainArea) - fixedWidth
        const newPreviewWidth = Math.max(280, Math.min(maxPreview, startPreviewWidth + delta))
        previewWidth.value = newPreviewWidth
        // 文件树展开或通知面板打开时，同步更新 panelWidth
        if (!isTreeCollapsed || isNotificationOpen) {
          panelWidth.value = newPreviewWidth + fixedWidth
        }
      } else {
        // 无预览：改变面板总宽度
        const maxByMainArea = startPanelWidth + Math.max(0, startMainAreaWidth - 320 - 52)
        const newWidth = Math.max(268, Math.min(Math.min(900, maxByMainArea), startPanelWidth + delta))
        if (isNotificationOpen) {
          // 通知面板打开时，更新 treeOnlyWidth（通知面板复用此宽度）
          treeOnlyWidth.value = newWidth
        } else {
          panelWidth.value = newWidth
        }
      }
    })
  }

  function onMouseUp() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isLeftDragging.value = false
    localStorage.setItem('team-file-panel-width', panelWidth.value)
    localStorage.setItem('team-file-preview-width', previewWidth.value)
    if (!previewNode.value) {
      if (!isNotificationOpen) {
        treeOnlyWidth.value = panelWidth.value
      }
      // 通知面板打开时 treeOnlyWidth 已在 onMouseMove 中实时更新
    } else if (!isTreeCollapsed || isNotificationOpen) {
      treeOnlyWidth.value = Math.max(260, panelWidth.value - previewWidth.value)
    }
    localStorage.setItem('team-file-tree-width', treeOnlyWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('dragstart', blockDragStart, true)
    cleanupLeftDrag = null
  }

  cleanupLeftDrag = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isLeftDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('dragstart', blockDragStart, true)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startDividerDrag(e) {
  // 先清理可能残留的上一次拖拽监听器
  if (cleanupDividerDrag) { cleanupDividerDrag(); cleanupDividerDrag = null }

  e.preventDefault()
  isDividerDragging.value = true
  const startX = e.clientX
  const startPreviewWidth = previewWidth.value
  let rafId = null

  function onMouseMove(e) {
    if (rafId) return
    const clientX = e.clientX
    rafId = requestAnimationFrame(() => {
      rafId = null
      const delta = clientX - startX
      const maxPreview = panelWidth.value - 304
      previewWidth.value = Math.max(280, Math.min(maxPreview, startPreviewWidth + delta))
    })
  }

  function onMouseUp() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isDividerDragging.value = false
    localStorage.setItem('team-file-preview-width', previewWidth.value)
    // 中间分割线拖拽改变了预览宽度，同步更新 treeOnlyWidth
    treeOnlyWidth.value = Math.max(260, panelWidth.value - previewWidth.value)
    localStorage.setItem('team-file-tree-width', treeOnlyWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    cleanupDividerDrag = null
  }

  cleanupDividerDrag = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    isDividerDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// ─── 拖拽移动 ─────────────────────────────────────────────────────────────────
async function handleMove({ nodeId, newParentId, newIndex }) {
  try {
    await fileStore.moveTeamNode(spaceId.value, nodeId, newParentId, newIndex)
  } catch (e) {
    ElMessage.error('移动失败')
  }
}

// 根目录空白区域拖入（将节点移到根目录末尾）
const isRootDragOver = ref(false)

function handleRootDragOver(e) {
  const src = window.__teamDragNode
  if (!src) return
  e.dataTransfer.dropEffect = 'move'
  if (e.target === e.currentTarget) {
    isRootDragOver.value = true
  }
}

function handleRootDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isRootDragOver.value = false
  }
}

function handleRootDrop(e) {
  isRootDragOver.value = false
  const src = window.__teamDragNode
  window.__teamDragNode = null
  if (!src) return
  if (e.target !== e.currentTarget) return
  const rootCount = rootNodes.value.length
  handleMove({ nodeId: src.id, newParentId: null, newIndex: rootCount })
}

function handlePreviewFromDropdown(node) {
  handlePreview(node)
  treeDropdownVisible.value = false
}

function closeFloatPanel() {
  uiStore.closeToolFileContent()
  previewNode.value = null
}

// ─── 右侧面板显示逻辑（文件树 / 通知面板互斥） ────────────────────────────────
const showFileTree = computed(() =>
  !showTreeAsDropdown.value &&
  !isFloatMode.value &&
  !uiStore.fileTreeCollapsed &&
  uiStore.activeToolTab === 'file'
)

const showNotification = computed(() =>
  !showTreeAsDropdown.value &&
  !isFloatMode.value &&
  uiStore.notificationPanelOpen
)

function handleNotificationNavigate(card) {
  uiStore.setActiveNavigation('collaboration', card.conversationId)
  uiStore.closeNotificationPanel()
}

// ─── 文件库容量 ───────────────────────────────────────────────────────────────
const storagePercent = ref(0)
const storageUsedText = ref('0 B')
const storageTotalText = ref('0 B')
const showStorageTitle = ref(true)

function applyQuotaData(data) {
  storagePercent.value = Math.min(100, Math.round((data?.usedPercent ?? 0) * 100) / 100)
  storageUsedText.value = data?.usedDisplay ?? '0 B'
  storageTotalText.value = data?.limitDisplay ?? '0 B'
}

async function loadStorageQuota() {
  if (!spaceId.value) return
  try {
    const data = await fileStore.refreshQuota(spaceId.value)
    applyQuotaData(data)
  } catch {
    // 静默失败，不影响主流程
  }
}

// 监听 store 中的容量信息变化（由保存/上传文件触发）
watch(() => fileStore.quotaInfo[spaceId.value], (data) => {
  if (data) applyQuotaData(data)
})

// 监听面板宽度，决定是否显示"文件库容量"标题
const treeColRef = ref(null)
const TITLE_MIN_WIDTH = 240
let resizeObserver = null
onMounted(() => {
  if (!treeColRef.value) return
  showStorageTitle.value = treeColRef.value.offsetWidth >= TITLE_MIN_WIDTH
  resizeObserver = new ResizeObserver(() => {
    if (treeColRef.value) {
      showStorageTitle.value = treeColRef.value.offsetWidth >= TITLE_MIN_WIDTH
    }
  })
  resizeObserver.observe(treeColRef.value)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.team-file-panel {
  display: flex;
  flex-shrink: 0;
  height: 100%;
  background: #F4F5F5;
  overflow: visible;
  box-sizing: border-box;
  position: relative;
  z-index: 3;
}

.team-file-panel.is-float-mode {
  width: 0 !important;
  min-width: 0 !important;
  overflow: hidden;
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  flex-direction: row;
  padding: 0px 0px 8px 0;
  box-sizing: border-box;
  /* margin-right: 8px; */
}

.file-tree-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 0;
  min-width: 260px;
  overflow: hidden;
  background: #fff;
  border-radius: 12px 0 0 12px;
  will-change: width;
  border-right: 1.5px solid var(--bg-primary, #F4F5F5);
}

.notification-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 0;
  min-width: 260px;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  will-change: width;
}

.preview-col {
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  will-change: width;
}

/* 拖拽分割线时禁止子元素触发鼠标事件，防止卡顿 */
.team-file-panel.is-dragging * {
  pointer-events: none !important;
  user-select: none !important;
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
  opacity: 0;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
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
  border-color: #436FF6;
  box-shadow: 0 0 0 2px rgba(67, 111, 246, 0.15);
}

.divider-handle.dragging .drag-icon-default {
  display: none;
}

.divider-handle.dragging .drag-icon-hover {
  display: block;
}

/* 顶部标题栏 */
.panel-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  /* border-bottom: 1px solid var(--border, #F0F2F5); */
  flex-shrink: 0;
}

.file-tab-bar {
  display: flex;
  gap: 4px;
  padding: 2px;
  background: rgba(47, 53, 71, 0.06);
  border-radius: 8px;
  margin: 0 16px 8px;
  flex-shrink: 0;
  width: 156px;
}

.file-tab {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: #2F3547;
  cursor: pointer;
  transition: all 0.15s;
}

.file-tab.active {
  background: #fff;
  color: #FF621F;
  font-weight: 600;
  border: 1px solid #ECEEF3;
  box-sizing: border-box;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
}

.tree-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
  flex-shrink: 0;
}

.tree-btn:hover {
  background: rgba(47, 53, 71, 0.06);
}

/* 全部文件行 */
.all-files-row {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  cursor: default;
  flex-shrink: 0;
}

.all-files-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.all-files-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.all-files-label {
  font-size: 13px;
  color: #2F3547;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-folder-btn {
  width: 24px;
  height: 24px;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-tree::-webkit-scrollbar {
  width: 4px;
}

.file-tree::-webkit-scrollbar-track {
  background: transparent;
}

.file-tree::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}

.inline-create {
  padding: 4px 24px;
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

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-icon-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.empty-text {
  font-size: 14px;
  color: var(--text-muted);
}

.file-tree.root-drag-over,
.empty-state.root-drag-over {
  background: rgba(67, 111, 246, 0.04);
  outline: 1px dashed #436FF6;
  outline-offset: -4px;
  border-radius: 6px;
}

/* 底部容量 */
.storage-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin:16px;
}

.storage-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  margin-right: 16px;
}

.storage-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.storage-title {
  font-size: 12px;
  color: #606572;
  white-space: nowrap;
  flex-shrink: 0;
}

.storage-percent {
  font-size: 12px;
  color: #606572;
  white-space: nowrap;
  flex-shrink: 0;
}

.storage-size {
  font-size: 12px;
  flex-shrink: 0;
}

.storage-used {
  color: #3D3D3D;
}

.storage-total {
  color: #91949E;
}

.storage-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.storage-bar-bg {
  width: 100%;
  height: 4px;
  background: #E8EBF0;
  border-radius: 2px;
  overflow: hidden;
}

.storage-bar-fill {
  height: 100%;
  background: #436FF6;
  border-radius: 2px;
  transition: width 0.3s;
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

/* float 模式：面板主体 */
.team-file-float-panel {
  position: fixed;
  top: 36px;
  right: 0;
  bottom: 0;
  display: flex;
  background: #F4F5F5;
  overflow: hidden;
  z-index: 2000;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
}

/* 删除确认弹框 */
:deep(.file-delete-dialog) {
  border-radius: 12px;
}

:deep(.file-delete-dialog .el-dialog__header) {
  padding: 24px 24px 16px;
}

:deep(.file-delete-dialog .el-dialog__body) {
  padding: 0 24px 24px;
}

:deep(.file-delete-dialog .el-dialog__footer) {
  padding: 0 24px 24px;
}

.delete-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.delete-dialog-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.warning-icon {
  font-size: 20px;
  color: #ff7d00;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1F2329;
  line-height: 24px;
}

.delete-dialog-close {
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

.delete-dialog-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.delete-dialog-content {
  color: #606572;
  font-size: 13px;
  line-height: 20px;
  padding-left: 32px;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.cancel-btn {
  background: #fff;
  color: #1F2329;
  border: 1px solid #E3E3E3;
}

.cancel-btn:hover {
  background: #F7F8FA;
  border-color: #D0D5DD;
}

.confirm-btn {
  background: #1F2329;
  color: #fff;
}

.confirm-btn:hover {
  background: #2F3547;
}

/* ─── 云端文件树分组 ─────────────────────────────────────────────────────────── */
.cloud-tree-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0 8px;
}

.cloud-tree-scroll::-webkit-scrollbar {
  width: 4px;
}

.cloud-tree-scroll::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}

.cloud-category {
  margin-bottom: 2px;
}

.cloud-category.category-drag-over {
  background: rgba(67, 111, 246, 0.04);
  border-radius: 6px;
  outline: 1px dashed #436FF6;
  outline-offset: -2px;
}

.cloud-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 12px;
  cursor: pointer;
  border-radius: 6px;
  margin: 0 4px;
  user-select: none;
}

.cloud-category-header:hover {
  background: rgba(47, 53, 71, 0.06);
}

.category-icon {
  flex-shrink: 0;
}

.category-label {
  font-size: 13px;
  font-weight: 500;
  color: #2F3547;
  margin-right: 6px;
}

.category-arrow {
  flex-shrink: 0;
  transition: transform 0.2s;
  transform: rotate(0deg);
}

.category-arrow.expanded {
  transform: rotate(180deg);
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.category-action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.category-action-btn:hover {
  background: rgba(47, 53, 71, 0.1);
}

.category-loading {
  padding: 6px 24px;
  font-size: 12px;
  color: #8C93A6;
}

.category-empty {
  padding: 6px 24px;
  font-size: 12px;
  color: #8C93A6;
}

.category-inline-create {
  display: flex;
  align-items: center;
  height: 32px;
  margin: 0 8px;
  padding-left: 32px;
}

.category-inline-create .rename-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid #FF684E;
  border-radius: 4px;
  background: #fff;
  height: 24px;
  overflow: hidden;
}

.category-inline-create .rename-input {
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

/* ────── Kode 分类（产研工作台 workspace 文件列表）─────────── */
.kode-file-category .category-icon-emoji {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.kode-ws-block {
  margin-left: 0;
}

.kode-ws-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 24px;
  cursor: pointer;
  font-size: 13px;
  color: #2F3547;
  border-radius: 4px;
  transition: background 0.15s;
}
.kode-ws-head:hover { background: rgba(132, 120, 250, 0.06); }

.kode-ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.kode-ws-arrow {
  font-size: 10px;
  color: #91949E;
  transition: transform 0.15s;
  display: inline-block;
  width: 10px;
  text-align: center;
}
.kode-ws-arrow.expanded { transform: rotate(90deg); }

.kode-ws-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.kode-ws-count {
  font-size: 11px;
  color: #91949E;
  padding: 1px 6px;
  background: #F3F5F7;
  border-radius: 8px;
}

.kode-file-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.kode-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 42px;
  font-size: 12.5px;
  color: #4A4F61;
  cursor: default;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kode-file-item:hover { background: rgba(0, 0, 0, 0.03); }

.kode-file-ico {
  flex-shrink: 0;
  font-size: 13px;
}

.kode-file-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
