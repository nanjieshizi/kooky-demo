<!-- src/components/claude-code/ProjectDropdown.vue -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { useTabStore } from '@/modules/terminal/stores/tab'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import { ElMessage } from 'element-plus'
import { removeProjectCascade } from '@/modules/terminal/utils/projectSessionLifecycle.js'
import { isDefaultProject } from '@/modules/terminal/utils/defaultProject.js'
// const darkToongzhiUrl = new URL('../../../assets/terminal/dark_toongzhi.svg', import.meta.url).href
// const rongzhiAniUrl = new URL('../../../assets/terminal/rongzhi_ani.gif', import.meta.url).href

const props = defineProps({
  theme: { type: Object, default: null },
  // tooltipEffect: { type: String, default: 'dark' },
})

const emit = defineEmits(['create-project'])

const projectStore = useProjectStore()
const workbenchStore = useWorkbenchStore()
const tabStore = useTabStore()
const panelStore = usePanelStore()
const notificationStore = useNotificationStore()

const rootRef = ref(null)
const dropdownVisible = ref(false)
const showCreateDialog = ref(false)
const newProjectPath = ref('')
const actionPopoverProjectId = ref(null)
const actionPopoverStyle = ref({ top: '0px', left: '0px' })

const showRenameDialog = ref(false)
const renameProjectId = ref(null)
const renameProjectName = ref('')
const renameError = ref('')

const isComposing = ref(false) // 标记是否正在输入法组合输入中

const showDeleteDialog = ref(false)
const deleteProjectId = ref(null)
const deleteProjectName = ref('')

const PROJECT_PATH_STATUS_COPY = {
  missing: '原路径已不存在',
  'not-directory': '目标路径不是目录',
  'no-access': '没有权限访问原路径',
  unknown: '路径校验失败',
}

const currentProject = computed(() => projectStore.activeProject)
const totalUnreadCount = computed(() => notificationStore.unreadCount)
// const notifyIconSrc = computed(() =>
//   totalUnreadCount.value > 0 ? rongzhiAniUrl : darkToongzhiUrl,
// )

function toggleDropdown() {
  const nextVisible = !dropdownVisible.value
  dropdownVisible.value = nextVisible
  actionPopoverProjectId.value = null
  if (nextVisible) {
    notificationStore.setNotificationCenterOpen(false)
  }
}

function closeDropdown() {
  dropdownVisible.value = false
  actionPopoverProjectId.value = null
}
// function handleNotifyClick() {
//   closeDropdown()
//   notificationStore.toggleNotificationCenter()
// }

function toggleActionPopover(projId, event) {
  if (actionPopoverProjectId.value === projId) {
    actionPopoverProjectId.value = null
    return
  }
  actionPopoverProjectId.value = projId
  // 基于按钮位置计算弹层坐标
  const btn = event?.currentTarget
  if (btn) {
    const rect = btn.getBoundingClientRect()
    actionPopoverStyle.value = {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.right + 6}px`,
    }
  }
}

async function selectProject(projId) {
  // 不在此批量标记已读：切换工作区仅改变当前上下文，页签/面板的未读应保留到用户聚焦面板或从通知中心处理
  await projectStore.switchProjectWithValidation(projId)
  closeDropdown()
}

function openCreateDialog() {
  newProjectPath.value = ''
  showCreateDialog.value = true
  closeDropdown()
}

function getProjectNameFromPath(path) {
  if (typeof path !== 'string') return ''
  const normalized = path.trim().replace(/\/+$/, '')
  if (!normalized) return ''
  return normalized.split('/').pop() || normalized.split('\\').pop() || ''
}

function formatProjectPath(path) {
  if (typeof path !== 'string' || !path.trim()) return ''
  const normalized = path.trim().replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length) return normalized
  if (parts.length <= 2) return normalized
  return `.../${parts.slice(-2).join('/')}`
}

function isProjectPathInvalid(projectId) {
  return projectStore.isProjectPathInvalid(projectId)
}

function getProjectPathStatusTooltip(project) {
  if (!projectStore.isProjectPathInvalid(project?.id)) return ''
  const reason = projectStore.getProject(project?.id)?.pathStatusReason || 'unknown'
  const reasonCopy = PROJECT_PATH_STATUS_COPY[reason] || PROJECT_PATH_STATUS_COPY.unknown
  return `路径失效：${reasonCopy}。当前仅保留已保存的历史内容。`
}

function isProjectEditable(project) {
  return !isDefaultProject(project)
}

function getEditableProject(projId) {
  const proj = projectStore.getProject?.(projId) || projectStore.projects.find(p => p.id === projId)
  return isProjectEditable(proj) ? proj : null
}

async function renameProject(projId) {
  const proj = getEditableProject(projId)
  closeDropdown()
  if (!proj) return

  showRenameDialog.value = true
  renameProjectId.value = projId
  renameProjectName.value = proj.name || ''
  renameError.value = ''
}

function closeRenameDialog() {
  showRenameDialog.value = false
  renameProjectId.value = null
  renameProjectName.value = ''
  renameError.value = ''
  isComposing.value = false
}

function confirmRename() {
  // 如果正在输入法组合输入中，不执行提交
  if (isComposing.value) {
    return
  }

  if (!getEditableProject(renameProjectId.value)) {
    closeRenameDialog()
    return
  }

  const trimmed = (renameProjectName.value || '').trim()
  if (!trimmed) {
    renameError.value = '工作区名称不能为空'
    return
  }

  if (projectStore.isNameTaken(trimmed, renameProjectId.value)) {
    renameError.value = `已存在名为"${trimmed}"的工作区`
    return
  }

  const ok = projectStore.renameProject(renameProjectId.value, trimmed)
  if (ok) {
    ElMessage.success('工作区已重命名')
    closeRenameDialog()
  } else {
    renameError.value = '重命名失败：名称不能为空或已存在'
  }
}

async function selectDirectory() {
  const path = await window.electronAPI?.dialog?.selectDirectory?.()
  if (path) {
    newProjectPath.value = path
  }
}

async function confirmCreate() {
  const nextPath = newProjectPath.value.trim()
  if (!nextPath) return

  const existingProject = projectStore.findProjectByPath(nextPath)
  if (existingProject) {
    await projectStore.switchProjectWithValidation(existingProject.id)
    showCreateDialog.value = false
    return
  }

  const derivedName = getProjectNameFromPath(nextPath) || 'project'
  emit('create-project', {
    name: derivedName,
    path: nextPath,
  })
  showCreateDialog.value = false
}

async function removeProject(projId) {
  if (projectStore.projects.length <= 1) return
  const proj = getEditableProject(projId)
  closeDropdown()
  if (!proj) return
  const name = proj?.name || '该工作区'

  deleteProjectId.value = projId
  deleteProjectName.value = name
  showDeleteDialog.value = true
}

function closeDeleteDialog() {
  showDeleteDialog.value = false
  deleteProjectId.value = null
  deleteProjectName.value = ''
}

function confirmDelete() {
  const projId = deleteProjectId.value
  const proj = getEditableProject(projId)
  if (!proj) {
    closeDeleteDialog()
    return
  }
  const name = deleteProjectName.value

  const result = removeProjectCascade({
    projectId: projId,
    projectStore,
    workbenchStore,
    tabStore,
    panelStore,
    notificationStore,
  })
  if (result?.removed) {
    ElMessage.success(`已删除工作区"${name}"`)
  }
  closeDeleteDialog()
}

function hasUnread(projId) {
  return notificationStore.projectHasUnread(projId)
}

// 点击外部关闭（替代 v-click-outside）
function onGlobalPointerDown(event) {
  const target = event.target
  const root = rootRef.value
  if (!(target instanceof Node) || !root) return

  const actionPopover = document.querySelector('.project-dropdown__action-popover')
  if (root.contains(target) || actionPopover?.contains(target)) return

  closeDropdown()
}

function onGlobalEscape(event) {
  if (event.key === 'Escape' && (dropdownVisible.value || actionPopoverProjectId.value)) {
    closeDropdown()
  }
}

onMounted(() => {
  window.addEventListener('pointerdown', onGlobalPointerDown)
  window.addEventListener('keydown', onGlobalEscape)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onGlobalPointerDown)
  window.removeEventListener('keydown', onGlobalEscape)
})
</script>

<template>
  <div ref="rootRef" class="project-dropdown">
    <!-- 触发器 -->
    <button
      class="project-dropdown__trigger"
      :class="{ 'is-open': dropdownVisible }"
      @click="toggleDropdown"
    >
      <!-- folder-closed icon -->
      <!-- <svg class="project-dropdown__folder-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg> -->
      <span class="project-dropdown__trigger-content">
        <span class="project-dropdown__name">{{ currentProject?.name || '选择项目' }}</span>
        <!-- chevron-down icon -->
        <svg class="project-dropdown__chevron" :class="{ open: dropdownVisible }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </span>
    </button>
    <div class="project-dropdown__notify-group">
      <!-- <span class="project-dropdown__divider" aria-hidden="true" /> -->
      <!--
      <el-tooltip
        content="通知中心"
        placement="bottom"
        :show-after="0"
        :effect="tooltipEffect"
        popper-class="project-dropdown__notify-tooltip"
      >
        <button
          type="button"
          class="project-dropdown__notify"
          aria-label="通知中心"
          @click.stop="handleNotifyClick"
        >
          <img
            :src="notifyIconSrc"
            alt=""
            class="project-dropdown__notify-icon"
            aria-hidden="true"
          >
        </button>
      </el-tooltip>
      -->
      <span v-if="totalUnreadCount > 0" class="project-dropdown__notify-dot" aria-hidden="true" />
    </div>

    <!-- 下拉面板 -->
    <Transition name="dropdown-fade">
      <div
        v-if="dropdownVisible"
        class="project-dropdown__panel"
      >
        <!-- 头部：标题 + 新增按钮 -->
        <div class="project-dropdown__header">
          <span class="project-dropdown__header-label">workspace</span>
          <button class="project-dropdown__header-add" @click="openCreateDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span>新增工作区</span>
          </button>
        </div>

        <!-- 项目列表 -->
        <div class="project-dropdown__list">
          <div
            v-for="proj in projectStore.projects"
            :key="proj.id"
            class="project-dropdown__item"
            :class="{ active: proj.id === projectStore.activeProjectId }"
            @click="selectProject(proj.id)"
          >
            <span
              v-if="hasUnread(proj.id)"
              class="project-dropdown__item-dot"
            />
            <div class="project-dropdown__item-content">
              <div class="project-dropdown__item-name">{{ proj.name }}</div>
              <div v-if="proj.path" class="project-dropdown__item-path" :title="proj.path">
                {{ formatProjectPath(proj.path) }}
              </div>
            </div>
            <div class="project-dropdown__item-right">
              <span
                v-if="isProjectPathInvalid(proj.id)"
                class="project-dropdown__item-status project-dropdown__item-status--invalid"
                :title="getProjectPathStatusTooltip(proj)"
              >路径失效</span>
              <!-- 三点操作菜单 -->
              <div v-if="isProjectEditable(proj)" class="project-dropdown__item-actions" @click.stop>
                <button
                  class="project-dropdown__more-btn"
                  :class="{ 'is-open': actionPopoverProjectId === proj.id }"
                  type="button"
                  title="更多操作"
                  @click.stop="toggleActionPopover(proj.id, $event)"
                >
                  <SvgIcon name="icon-gengduo" :size="16" color="currentColor" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 操作弹层（Teleport 到 body，避免被 overflow 裁切） -->
    <Teleport to="body">
      <Transition name="popover-fade">
        <div
          v-if="actionPopoverProjectId"
          class="project-dropdown__action-popover"
          :style="actionPopoverStyle"
          @click.stop
        >
          <div
            class="project-dropdown__action-menu-item"
            @click.stop="renameProject(actionPopoverProjectId)"
          >
            <SvgIcon name="icon-bianji1" :size="14" color="currentColor" />
            <span>重命名</span>
          </div>
          <div
            v-if="projectStore.projects.length > 1"
            class="project-dropdown__action-menu-item project-dropdown__action-menu-item--delete"
            @click.stop="removeProject(actionPopoverProjectId)"
          >
            <SvgIcon name="icon-shanchu2" :size="14" color="currentColor" />
            <span>删除</span>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 新建工作区对话框 -->
    <Teleport to="body">
      <div v-if="showCreateDialog" class="project-create-overlay" @click.self="showCreateDialog = false">
        <div class="project-create-dialog">
          <div class="project-create-dialog__header">
            <div class="project-create-dialog__header-left">
              <!-- <span
                class="project-create-dialog__header-icon"
                :style="{
                  backgroundColor: '#58a6ff',
                  WebkitMaskImage: `url(${darkToongzhiUrl})`,
                  maskImage: `url(${darkToongzhiUrl})`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }"
              /> -->
              <span class="project-create-dialog__title">新建工作区</span>
            </div>
            <button class="project-create-dialog__close" @click="showCreateDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="project-create-dialog__body">
            <div class="project-create-dialog__path-row">
              <div class="project-create-dialog__path-display" :class="{ 'is-empty': !newProjectPath }">
                {{ newProjectPath || '请选择工作区目录' }}
              </div>
              <button class="project-create-dialog__browse" @click="selectDirectory">浏览</button>
            </div>
          </div>
          <div class="project-create-dialog__footer">
            <button class="project-create-dialog__btn" @click="showCreateDialog = false">取消</button>
            <button class="project-create-dialog__btn project-create-dialog__btn--primary" :disabled="!newProjectPath.trim()" @click="confirmCreate">
              {{ projectStore.findProjectByPath(newProjectPath)?.id ? '切换工作区' : '创建工作区' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 重命名工作区对话框 -->
    <Teleport to="body">
      <div v-if="showRenameDialog" class="project-rename-overlay" @click.self="closeRenameDialog">
        <div class="project-rename-dialog">
          <div class="project-rename-dialog__header">
            <div class="project-rename-dialog__header-left">
              <span class="project-rename-dialog__title">重命名</span>
            </div>
            <button class="project-rename-dialog__close" @click="closeRenameDialog">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="project-rename-dialog__body">
            <div class="project-rename-dialog__input-wrapper">
              <input
                v-model="renameProjectName"
                type="text"
                class="project-rename-dialog__input"
                placeholder="请输入工作区名称"
                maxlength="20"
                @compositionstart="isComposing = true"
                @compositionend="isComposing = false"
                @keydown.enter="confirmRename"
                @keydown.esc="closeRenameDialog"
              />
              <span class="project-rename-dialog__counter">{{ renameProjectName.length }}/20</span>
            </div>
            <div v-if="renameError" class="project-rename-dialog__error">{{ renameError }}</div>
          </div>
          <div class="project-rename-dialog__footer">
            <button class="project-rename-dialog__btn" @click="closeRenameDialog">取消</button>
            <button class="project-rename-dialog__btn project-rename-dialog__btn--primary" @click="confirmRename">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除工作区确认对话框 -->
    <Teleport to="body">
      <div v-if="showDeleteDialog" class="project-delete-overlay" @click.self="closeDeleteDialog">
        <div class="project-delete-dialog">
          <div class="project-delete-dialog__header">
            <div class="project-delete-dialog__header-left">
              <span class="project-delete-dialog__title">提示</span>
            </div>
            <button class="project-delete-dialog__close" @click="closeDeleteDialog">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="project-delete-dialog__body">
            <p class="project-delete-dialog__message">
              删除 "{{ deleteProjectName }}" 不会删除磁盘上的工作区目录，但该工作区下所有终端会话都会被丢弃，无法恢复。 是否继续?
            </p>
          </div>
          <div class="project-delete-dialog__footer">
            <button class="project-delete-dialog__btn" @click="closeDeleteDialog">取消</button>
            <button class="project-delete-dialog__btn project-delete-dialog__btn--primary" @click="confirmDelete">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.project-dropdown {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;

  &__notify-group {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    margin-right: 24px;
    flex-shrink: 0;
  }

  &__divider {
    width: 1px;
    height: 16px;
    background: #333333;
    flex-shrink: 0;
  }

  // &__notify {
  //   position: relative;
  //   display: inline-flex;
  //   align-items: center;
  //   justify-content: center;
  //   width: 24px;
  //   height: 24px;
  //   padding: 0;
  //   border: none;
  //   background: transparent;
  //   cursor: pointer;
  //   flex-shrink: 0;
  //   transition: background 0.15s;
  // }
  //
  // &__notify-icon {
  //   display: block;
  //   width: 16px;
  //   height: 16px;
  //   flex-shrink: 0;
  //   object-fit: contain;
  // }

  &__notify-dot {
    width: 8px;
    height: 8px;
    background: #ED4543;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__trigger {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 8px 0 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: #fff;
    transition: background 0.15s;
    &:hover { background: transparent; }
    &.is-open { background: transparent; }
  }

  &__folder-icon {
    color: #58a6ff;
    flex-shrink: 0;
  }

  &__trigger-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }

  &__name {
    display: block;
    max-width: 105px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    // font-weight: 600;
    color: #fff;
    text-align: left;
  }

  &__chevron {
    color: #666;
    flex-shrink: 0;
    transition: transform 0.2s, color 0.15s;
    &.open { transform: rotate(180deg); }
  }

  &__trigger:hover &__chevron { color: #fff; }

  // ── 下拉面板 ──
  &__panel {
    position: absolute;
    top: calc(100% + 0px);
    left: 8px;
    width: 330px;
    background: #292929;
    border-top: none;
    padding: 0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 200;
    border-radius: 12px;
    padding-bottom: 8px;

  }

  // ── 头部：标题 + 新增按钮 ──
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #353535;
    padding: 15px 8px;
    height: 44px;

  }

  &__header-label {
    font-size: 13px;
    font-weight: 500;
    color: #7B7B7B;
    // text-transform: uppercase;
    // letter-spacing: 0.06em;
  }

  &__header-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: #DFDFDF;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background: rgb(236, 238, 243, 0.1);
      color: #DFDFDF;
      border-radius: 6px;
    }

    svg { flex-shrink: 0; }
  }

  // ── 列表 ──
  &__list {
    max-height: 394px;
    overflow-y: auto;
    padding: 8px;
  

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
    &::-webkit-scrollbar-thumb:hover { background: #484f58; }
  }

  // ── 单个工作区项 ──
  &__item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 0.12s;
    border-radius: 13px;

    &:hover:not(.active) {
      background: transparent;
    }

    &.active {
      background: #3E3E3E;
     }
  }

  &__item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  &__item-name {
    font-size: 13px;
    color: #DFDFDF;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item:hover:not(.active) &__item-name {
    color: rgba(255, 255, 255, 0.6);
  }

  &__item.active &__item-name{
    color: #fff;
  }

  &__item-path {
    font-size: 12px;
    color: #696969;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: 8px;
  }

  &__item-status {
    display: inline-flex;
    align-items: center;
    height: 16px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.04em;
    white-space: nowrap;
    user-select: none;
    flex-shrink: 0;

    &--invalid {
      border: 1px solid rgba(248, 81, 73, 0.35);
      background: rgba(248, 81, 73, 0.12);
      color: #ff7b72;
    }
  }

  &__item-dot {
    position: absolute;
    top: 11px;
    right: 12px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ED4543;
    pointer-events: none;
  }

  // ── 三点操作按钮 ──
  &__item-actions {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  &__more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7b7b7b;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s, background 0.12s, color 0.12s;

    &:hover,
    &.is-open {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    &.is-open { opacity: 1; }
  }

  &__item:hover &__more-btn { opacity: 1; }
}

.dropdown-fade-enter-active { transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
.dropdown-fade-leave-active { transition: opacity 0.1s ease; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.popover-fade-enter-active { transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1); }
.popover-fade-leave-active { transition: opacity 0.08s ease; }
.popover-fade-enter-from, .popover-fade-leave-to { opacity: 0; transform: translateY(-4px) scale(0.95); }

 .project-create-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.project-create-dialog {
  width: 420px;
  max-width: calc(100vw - 40px);
  border-radius: 12px;
  background: #292929;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__header-icon {
    display: block;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f4f4f4;
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.34);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.6);
    }
  }

  &__body {
    padding: 8px 24px 24px;
  }

  &__path-row {
    display: flex;
    gap: 10px;
  }

  &__path-display {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
    min-height: 32px;
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: #464646;
    color: #e8e8e8;
    font-size: 14px;
    line-height: 1.4;
    word-break: break-all;

    &.is-empty {
      color: rgba(255, 255, 255, 0.34);
    }
  }

  &__browse {
    min-width: 72px;
    min-height: 32px;
    border: none;
    border-radius: 8px;
    background: #595959;
    color: #f4f4f4;
    cursor: pointer;
    padding: 0 16px;
    font-size: 14px;
    white-space: nowrap;
    transition: background 0.2s;

    &:hover {
      background: #666666;
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px 24px;
  }

  &__btn {
    min-width: 80px;
    height: 32px;
    border: 1px solid #383838;
    border-radius: 8px;
    background: transparent;
    color: #f2f2f2;
    cursor: pointer;
    padding: 0 16px;
    font-size: 14px;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.14);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    &--primary {
      border: none;
      background: #4E525E;
      color: #ffffff;

      &:hover:not(:disabled) {
        background: #4E525E;
      }
    }
  }
}

.project-rename-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.project-rename-dialog {
  width: 420px;
  max-width: calc(100vw - 40px);
  border-radius: 12px;
  background: #292929;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f4f4f4;
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.34);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.6);
    }
  }

  &__body {
    padding: 8px 24px 24px;
  }

  &__input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  &__input {
    width: 100%;
    padding: 0 50px 0 14px;
    min-height: 32px;
    border: none;
    border-radius: 8px;
    background: #464646;
    color: #e8e8e8;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;

    &::placeholder {
      color: rgba(255, 255, 255, 0.34);
    }

    &:focus {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
    }
  }

  &__counter {
    position: absolute;
    right: 14px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.34);
    pointer-events: none;
    white-space: nowrap;
  }

  &__error {
    margin-top: 8px;
    font-size: 13px;
    color: #ff7b72;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px 24px;
  }

  &__btn {
    min-width: 80px;
    height: 32px;
    border: 1px solid #383838;
    border-radius: 8px;
    background: transparent;
    color: #f2f2f2;
    cursor: pointer;
    padding: 0 16px;
    font-size: 14px;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.14);
    }

    &--primary {
      border: none;
      background: #4E525E;
      color: #ffffff;

      &:hover:not(:disabled) {
        background: #4E525E;
      }
    }
  }
}

.project-delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.project-delete-dialog {
  width: 420px;
  max-width: calc(100vw - 40px);
  border-radius: 12px;
  background: #292929;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f4f4f4;
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.34);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.6);
    }
  }

  &__body {
    padding: 8px 24px 24px;
  }

  &__message {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px 24px;
  }

  &__btn {
    min-width: 80px;
    height: 32px;
    border: 1px solid #383838;
    border-radius: 8px;
    background: transparent;
    color: #f2f2f2;
    cursor: pointer;
    padding: 0 16px;
    font-size: 14px;
    transition: background 0.2s, border-color 0.2s, opacity 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.14);
    }

    &--primary {
      border: none;
      background: #4E525E;
      color: #ffffff;

      &:hover:not(:disabled) {
        background: #4E525E;
      }
    }
  }
}

</style>

<!-- 操作弹层 Teleport 到 body，需要 unscoped 样式 -->
<style lang="scss">
.project-dropdown__action-popover {
  position: fixed;
  transform: translateY(-50%);
  min-width: 120px;
  padding: 6px;
  border-radius: 10px;
  background: #3b3b3b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 10000;
}

.project-dropdown__action-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;

  &:hover { background: rgba(255, 255, 255, 0.08); }

  &--delete {
    color: #e6edf3;
  }
}

.light-theme {
  .project-dropdown__name {
    color: #2F3547;
  }

  .project-dropdown__chevron {
    color: #999;
  }

  .project-dropdown__trigger {
    &:hover .project-dropdown__chevron {
      color: #2F3547;
    }
  }

  .project-dropdown__divider {
    background: #D8D8D8;
  }

  .project-dropdown__panel {
    background: #FFFFFF;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border: 1px solid #E5E5E5;
  }

  .project-dropdown__header {
    border-bottom-color: #E8E8E8;
  }

  .project-dropdown__header-label {
    color: #666666;
  }

  .project-dropdown__header-add {
    color: #333333;
    border-radius: 6px;
    border: none;
    padding: 8px 10px;
    line-height: 1;

    &:hover {
      background: rgb(236, 238, 243);
      color: #2F3547;
    }
  }

  .project-dropdown__list {
    &::-webkit-scrollbar-thumb {
      background: #D0D0D0;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: #B0B0B0;
    }
  }

  .project-dropdown__item {
    &.active {
      background: #F0F0F0;
    }
    &:hover:not(.active) {
      background: transparent;
    }
  }

  .project-dropdown__item-name {
    color: #1a1a1a;
  }

  .project-dropdown__item:hover:not(.active) .project-dropdown__item-name {
    color: rgba(47, 53, 71, 0.6);
  }

  .project-dropdown__item.active .project-dropdown__item-name {
    color: #000000;
  }

  .project-dropdown__item-path {
    color: #999999;
  }

  .project-dropdown__item-dot {
    background: #ED4543;
  }

  .project-dropdown__more-btn {
    color: #999999;

    &:hover,
    &.is-open {
      background: rgba(0, 0, 0, 0.06);
      color: #333333;
    }
  }

  .project-dropdown__action-popover {
    background: #FFFFFF;
    border-color: #E5E5E5;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .project-dropdown__action-menu-item {
    color: #333333;

    &:hover {
      background: #F0F0F0;
    }

    &--delete {
      color: #333333;
    }
  }

  // Teleport 到 body 的弹框样式
  .project-create-overlay {
    background: rgba(0, 0, 0, 0.3);
  }

  .project-create-dialog {
    background: #ffffff;
    border-color: #d0d7de;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);

    &__title {
      color: #1f2328;
    }

    &__close {
      color: #656d76;

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2328;
      }
    }

    &__path-display {
      background: #f6f8fa;
      color: #1f2328;

      &.is-empty {
        color: #656d76;
      }
    }

    &__browse {
      background: #f6f8fa;
      color: #1f2328;
      border: 1px solid #d0d7de;

      &:hover {
        background: #e8eaed;
        border-color: #1f2328;
      }
    }

    &__btn {
      border-color: #d0d7de;
      color: #1f2328;

      &:hover {
        background: #f6f8fa;
        border-color: #1f2328;
      }

      &--primary {
        background: #171B26;
        border-color: #171B26;
        color: #FFFFFF;

        &:hover {
          background: #0f1219;
          border-color: #0f1219;
        }
      }
    }
  }

  .project-rename-overlay {
    background: rgba(0, 0, 0, 0.3);
  }

  .project-rename-dialog {
    background: #ffffff;
    border-color: #d0d7de;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);

    &__title {
      color: #1f2328;
    }

    &__close {
      color: #656d76;

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2328;
      }
    }

    &__input {
      background: #f6f8fa;
      color: #1f2328;
      border: 1px solid #d0d7de;

      &::placeholder {
        color: #656d76;
      }

      &:focus {
        border-color: #0969da;
      }
    }

    &__error {
      color: #d1242f;
    }

    &__btn {
      border-color: #d0d7de;
      color: #1f2328;

      &:hover {
        background: #f6f8fa;
        border-color: #1f2328;
      }

      &--primary {
        background: #171B26;
        border-color: #171B26;
        color: #FFFFFF;

        &:hover {
          background: #0f1219;
          border-color: #0f1219;
        }
      }
    }
  }

  .project-delete-overlay {
    background: rgba(0, 0, 0, 0.3);
  }

  .project-delete-dialog {
    background: #ffffff;
    border-color: #d0d7de;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);

    &__title {
      color: #1f2328;
    }

    &__close {
      color: #656d76;

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2328;
      }
    }

    &__message {
      color: #606572;
    }

    &__btn {
      border-color: #d0d7de;
      color: #1f2328;

      &:hover {
        background: #f6f8fa;
        border-color: #1f2328;
      }

      &--primary {
        background: #ED4543;
        border-color: #ED4543;
        color: #FFFFFF;

        &:hover {
          background: #d93d3b;
          border-color: #d93d3b;
        }
      }
    }
  }
}
</style>
