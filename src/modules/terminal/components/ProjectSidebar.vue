<!-- src/components/claude-code/ProjectSidebar.vue — WorkbenchSidebar -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import ProjectDropdown from './ProjectDropdown.vue'
import NotificationCenter from './NotificationCenter.vue'
import darkLujingUrl from '@/assets/terminal/dark_lujing.svg'

const props = defineProps({
  theme: { type: Object, default: null },
  tooltipEffect: { type: String, default: 'dark' },
})

const emit = defineEmits(['switch-workbench', 'add-workbench', 'create-project', 'delete-workbench', 'notification-navigate'])

import { NOTIFICATION_ANCHOR_REF_KEY } from '@/shared/constants/injectionKeys'

const projectStore = useProjectStore()
const workbenchStore = useWorkbenchStore()
const panelStore = usePanelStore()
const notificationStore = useNotificationStore()
const notificationAnchorRef = ref(null)
provide(NOTIFICATION_ANCHOR_REF_KEY, notificationAnchorRef)

const dragWorkbenchId = ref(null)
const dragOverWorkbenchId = ref(null)
const workbenchItemRefs = new Map()
const actionPopoverWbId = ref(null)
const actionPopoverStyle = ref({ top: '0px', left: '0px' })

const showRenameDialog = ref(false)
const renameWorkbenchId = ref(null)
const renameWorkbenchName = ref('')
const renameError = ref('')
const isComposing = ref(false) // 标记是否正在输入法组合输入中

const showDeleteDialog = ref(false)
const deleteWorkbenchId = ref(null)
const deleteWorkbenchName = ref('')

// 当前项目下的工作台列表
const workbenches = computed(() => {
  const project = projectStore.activeProject
  if (!project) return []

  return project.workbenchIds
    .map(id => workbenchStore.getWorkbench(id))
    .filter(Boolean)
})

// 当前激活的工作台 ID
const activeWbId = computed(() => workbenchStore.activeWorkbenchId)

// 获取工作台内未脱离的面板数量
function panelCount(wbId) {
  return panelStore.panelsByWorkbench(wbId).filter(p => !p.detached).length
}

function isDeletingLastTerminalInWorkbench(workbenchId) {
  return panelStore.panelsByWorkbench(workbenchId).length <= 1
}

// 获取工作台未读通知数
function unreadCount(wbId) {
  return notificationStore.unreadByWorkbench(wbId)
}

function hasUnread(wbId) {
  return notificationStore.workbenchHasUnread(wbId)
}

// 切换工作台
function switchWorkbench(wbId) {
  emit('switch-workbench', wbId)
}

// 侧边栏工作台状态圆点已移除：只保留通知未读角标

// 新建工作台
function addWorkbench() {
  emit('add-workbench')
}

function setWorkbenchItemRef(workbenchId, element) {
  if (!workbenchId) return
  if (element) {
    workbenchItemRefs.set(workbenchId, element)
  } else {
    workbenchItemRefs.delete(workbenchId)
  }
}

function closeActionPopover() {
  actionPopoverWbId.value = null
}

function toggleActionPopover(wbId, event) {
  if (actionPopoverWbId.value === wbId) {
    actionPopoverWbId.value = null
    return
  }
  actionPopoverWbId.value = wbId
  const btn = event?.currentTarget
  if (btn) {
    const rect = btn.getBoundingClientRect()
    actionPopoverStyle.value = {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.right + 6}px`,
    }
  }
}

function openWorkbenchContextMenu(wbId, event) {
  // 右键也打开 popover
  toggleActionPopover(wbId, event)
}

function renameWorkbench(workbenchId) {
  const workbench = workbenchStore.getWorkbench(workbenchId)
  closeActionPopover()
  if (!workbench) return

  showRenameDialog.value = true
  renameWorkbenchId.value = workbenchId
  renameWorkbenchName.value = workbench.name
  renameError.value = ''
}

function closeRenameDialog() {
  showRenameDialog.value = false
  renameWorkbenchId.value = null
  renameWorkbenchName.value = ''
  renameError.value = ''
  isComposing.value = false
}

function confirmRename() {
  // 如果正在输入法组合输入中，不执行提交
  if (isComposing.value) {
    return
  }

  const trimmed = (renameWorkbenchName.value || '').trim()
  if (!trimmed) {
    renameError.value = '工作台名称不能为空'
    return
  }

  const workbench = workbenchStore.getWorkbench(renameWorkbenchId.value)
  if (!workbench) {
    renameError.value = '工作台不存在'
    return
  }

  // 同项目内不允许重名（排除自己）
  if (workbenchStore.isNameTaken(workbench.projectId, trimmed, renameWorkbenchId.value)) {
    renameError.value = `当前工作区下已存在名为"${trimmed}"的工作台`
    return
  }

  if (workbenchStore.renameWorkbench(renameWorkbenchId.value, trimmed)) {
    ElMessage.success('工作台已重命名')
    closeRenameDialog()
  } else {
    renameError.value = '重命名失败：名称为空或已存在'
  }
}

async function confirmDeleteWorkbench(workbenchId) {
  closeActionPopover()
  const workbench = workbenchStore.getWorkbench(workbenchId)
  if (!workbench) return

  deleteWorkbenchId.value = workbenchId
  deleteWorkbenchName.value = workbench.name
  showDeleteDialog.value = true
}

function closeDeleteDialog() {
  showDeleteDialog.value = false
  deleteWorkbenchId.value = null
  deleteWorkbenchName.value = ''
}

function confirmDelete() {
  const wbId = deleteWorkbenchId.value
  if (!wbId) return
  emit('delete-workbench', wbId)
  closeDeleteDialog()
}

function handleGlobalPointerDown(e) {
  const target = e.target
  if (!(target instanceof Node)) return

  if (actionPopoverWbId.value) {
    const popover = document.querySelector('.workbench-action-popover')
    if (!popover?.contains(target)) {
      closeActionPopover()
    }
  }

  if (notificationStore.notificationCenterOpen) {
    const panel = document.querySelector('.notification-center')
    const trigger = document.querySelector('.project-dropdown__notify')
    const isInsideNotificationCenter = panel?.contains(target)
    const isNotificationTrigger = trigger?.contains(target)
    if (!isInsideNotificationCenter && !isNotificationTrigger) {
      notificationStore.setNotificationCenterOpen(false)
    }
  }
}

function handleGlobalEscape(event) {
  if (event.key !== 'Escape') return

  if (actionPopoverWbId.value) {
    closeActionPopover()
  }
  if (notificationStore.notificationCenterOpen) {
    notificationStore.setNotificationCenterOpen(false)
  }
}

function handleCreateProject(payload) {
  emit('create-project', payload)
}

function onDragStart(wbId, event) {
  dragWorkbenchId.value = wbId
  event.dataTransfer?.setData('text/plain', wbId)
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(wbId) {
  if (!dragWorkbenchId.value || dragWorkbenchId.value === wbId) return
  dragOverWorkbenchId.value = wbId
}

function onDragLeave(wbId) {
  if (dragOverWorkbenchId.value === wbId) {
    dragOverWorkbenchId.value = null
  }
}

function onDrop(wbId) {
  const projectId = projectStore.activeProject?.id
  if (!projectId || !dragWorkbenchId.value || dragWorkbenchId.value === wbId) {
    resetDragState()
    return
  }

  projectStore.reorderWorkbench(projectId, dragWorkbenchId.value, wbId)
  resetDragState()
}

function onDragEnd() {
  resetDragState()
}

function resetDragState() {
  dragWorkbenchId.value = null
  dragOverWorkbenchId.value = null
}

async function scrollActiveWorkbenchIntoView() {
  const activeWorkbenchId = activeWbId.value
  if (!activeWorkbenchId) return

  const activeWorkbenchElement = workbenchItemRefs.get(activeWorkbenchId)
  if (!activeWorkbenchElement?.scrollIntoView) return

  activeWorkbenchElement.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  })
}

watch(
  () => [activeWbId.value, workbenches.value.map(wb => wb.id).join('|')],
  async () => {
    await nextTick()
    scrollActiveWorkbenchIntoView()
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalEscape)
})
</script>

<template>
  <aside class="workbench-sidebar">
    <!-- TOP: 工作区标题行 + 紧贴其下的通知面板 -->
    <div ref="notificationAnchorRef" class="workbench-sidebar__project-stack">
      <div class="workbench-sidebar__project">
        <ProjectDropdown
          :theme="theme"
          :tooltip-effect="tooltipEffect"
          @create-project="handleCreateProject"
        />
      </div>
      <NotificationCenter
        :visible="notificationStore.notificationCenterOpen"
        @close="notificationStore.setNotificationCenterOpen(false)"
        @navigate="emit('notification-navigate', $event)"
      />
    </div>

    <!-- MIDDLE: 工作台列表 -->
    <div class="workbench-sidebar__header">
      <button class="workbench-sidebar__add-btn" @click="addWorkbench">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <span>事项</span>
      </button>
    </div>

    <div class="workbench-sidebar__list custom-scrollbar">
      <nav class="workbench-sidebar__nav">
        <template v-for="wb in workbenches" :key="wb.id">
          <div
            :ref="element => setWorkbenchItemRef(wb.id, element)"
            class="workbench-item"
            :class="{
              'is-active': wb.id === activeWbId,
              'is-dragging': wb.id === dragWorkbenchId,
              'drag-over': wb.id === dragOverWorkbenchId,
            }"
            role="button"
            tabindex="0"
            :aria-current="wb.id === activeWbId ? 'true' : null"
            :draggable="true"
            @dragstart="onDragStart(wb.id, $event)"
            @dragover.prevent="onDragOver(wb.id)"
            @dragleave="onDragLeave(wb.id)"
            @dragend="onDragEnd"
            @drop.prevent="onDrop(wb.id)"
            @click="switchWorkbench(wb.id)"
            @keydown.enter.prevent="switchWorkbench(wb.id)"
            @keydown.space.prevent="switchWorkbench(wb.id)"
            @contextmenu.prevent.stop="openWorkbenchContextMenu(wb.id, $event)"
          >
            <div class="workbench-item__left">
              <span
                class="workbench-item__icon"
                :style="{
                  WebkitMaskImage: `url(${darkLujingUrl})`,
                  maskImage: `url(${darkLujingUrl})`,
                }"
              />
              <span class="workbench-item__name">{{ wb.name }}</span>
            </div>
            <div class="workbench-item__right" @click.stop>
              <span v-if="hasUnread(wb.id)" class="workbench-item__badge">{{ unreadCount(wb.id) > 99 ? '99+' : unreadCount(wb.id) }}</span>
              <template v-else>
                
                <!-- <span v-if="panelCount(wb.id) > 0" class="workbench-item__count">{{ panelCount(wb.id) }}</span> -->
                <button
                  type="button"
                  class="workbench-item__more-btn"
                  :class="{ 'is-open': actionPopoverWbId === wb.id }"
                  title="更多操作"
                  @click.stop="toggleActionPopover(wb.id, $event)"
                >
                  <SvgIcon name="icon-gengduo" :size="14" color="currentColor" />
                </button>
              </template>
            </div>
          </div>
        </template>
      </nav>
    </div>

    <!-- 操作弹层（Teleport 到 body，避免被 overflow 裁切） -->
    <Teleport to="body">
      <Transition name="popover-fade">
        <div
          v-if="actionPopoverWbId"
          class="workbench-action-popover"
          :style="actionPopoverStyle"
          @click.stop
        >
          <div
            class="workbench-action-menu-item"
            @click.stop="renameWorkbench(actionPopoverWbId)"
          >
            <SvgIcon name="icon-bianji1" :size="14" color="currentColor" />
            <span>重命名</span>
          </div>
          <div
            class="workbench-action-menu-item workbench-action-menu-item--delete"
            @click.stop="confirmDeleteWorkbench(actionPopoverWbId)"
          >
            <SvgIcon name="icon-shanchu2" :size="14" color="currentColor" />
            <span>删除</span>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 重命名工作台对话框 -->
    <Teleport to="body">
      <div v-if="showRenameDialog" class="workbench-rename-overlay" @click.self="closeRenameDialog">
        <div class="workbench-rename-dialog">
          <div class="workbench-rename-dialog__header">
            <div class="workbench-rename-dialog__header-left">
              <span class="workbench-rename-dialog__title">重命名</span>
            </div>
            <button class="workbench-rename-dialog__close" @click="closeRenameDialog">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="workbench-rename-dialog__body">
            <div class="workbench-rename-dialog__input-wrapper">
              <input
                v-model="renameWorkbenchName"
                type="text"
                class="workbench-rename-dialog__input"
                placeholder="请输入事项名称"
                maxlength="20"
                @compositionstart="isComposing = true"
                @compositionend="isComposing = false"
                @keydown.enter="confirmRename"
                @keydown.esc="closeRenameDialog"
              />
              <span class="workbench-rename-dialog__counter">{{ renameWorkbenchName.length }}/20</span>
            </div>
            <div v-if="renameError" class="workbench-rename-dialog__error">{{ renameError }}</div>
          </div>
          <div class="workbench-rename-dialog__footer">
            <button class="workbench-rename-dialog__btn" @click="closeRenameDialog">取消</button>
            <button class="workbench-rename-dialog__btn workbench-rename-dialog__btn--primary" @click="confirmRename">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除事项确认对话框 -->
    <Teleport to="body">
      <div v-if="showDeleteDialog" class="workbench-delete-overlay" @click.self="closeDeleteDialog">
        <div class="workbench-delete-dialog">
          <div class="workbench-delete-dialog__header">
            <div class="workbench-delete-dialog__header-left">
              <span class="workbench-delete-dialog__title">提示</span>
            </div>
            <button class="workbench-delete-dialog__close" @click="closeDeleteDialog">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="workbench-delete-dialog__body">
            <p class="workbench-delete-dialog__message">
              删除 "{{ deleteWorkbenchName }}" 会丢失该事项下所有终端会话，但不会删除本地目录。 是否继续？
            </p>
          </div>
          <div class="workbench-delete-dialog__footer">
            <button class="workbench-delete-dialog__btn" @click="closeDeleteDialog">取消</button>
            <button class="workbench-delete-dialog__btn workbench-delete-dialog__btn--primary" @click="confirmDelete">确定</button>
          </div>
        </div>
      </div>
    </Teleport>

  </aside>
</template>

<style lang="scss" scoped>
.workbench-sidebar {
  width: 196px;
  display: flex;
  flex-direction: column;
  background: #151515;
  border-right: 1px solid var(--tab-border);
  height: 100%;
  z-index: 30;

  &__project-stack {
    position: relative;
    z-index: 40;
    flex-shrink: 0;
  }

  &__project {
    flex-shrink: 0;
    height: 41px;
    min-height: 40px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--tab-border);
  }

  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 5px 8px 8px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding-left: 16px;
    border-bottom: 1px solid var(--tab-border);
    background: #151515;
    box-sizing: border-box;
    height: 32px;
    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
  }

  &__nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #DFDFDF;
    font-size: 13px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;

   

    svg {
      flex-shrink: 0;
    }
  }
}

.workbench-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px;
  font-size: 13px;
  color: #898989;
  text-decoration: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s, opacity 0.15s, box-shadow 0.15s;
  user-select: none;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.34);
  }

  &:hover:not(.is-active) {
    background: #1D1D1D;
    border-radius: 8px;
    color: #898989;
  }

  &.is-active {
    background: #2E2D2D;
    border-left-color: transparent;
    border-radius: 8px;
    color: #fff;
  }

  &.is-dragging {
    opacity: 0.72;
    transform: scale(0.985);
    box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.22);
    background: linear-gradient(90deg, rgba(31, 110, 180, 0.18), rgba(28, 33, 40, 0.92));
    cursor: grabbing;
  }

  &[draggable='true'] {
    cursor: grab;
  }

  &.drag-over {
    background: rgba(88, 166, 255, 0.14);
    color: #fff;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  &__icon {
    flex-shrink: 0;
    display: block;
    width: 12px;
    height: 12px;
    background-color: currentColor;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }

  &__name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__right {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
  }

  &__count {
    position: absolute;
    right: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: #2E2D2D;
    color: #7B7B7B;
    font-size: 11px;
    font-weight: 500;
    line-height: 20px;
    text-align: center;
    transition: opacity 0.12s;
  }

  &__badge {
    min-width: 16px;
    height: 16px;
    padding: 0 5px;
    border-radius: 999px;
    background: #F54C46;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  }

  &__more-btn {
    position: absolute;
    right: 0;
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

  &:hover &__count { opacity: 0; }
  &.is-active &__count { opacity: 0; }

  &:hover &__more-btn { opacity: 1; }
  &.is-active &__more-btn { opacity: 1; }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #484f58;
  }
}

.workbench-rename-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.workbench-rename-dialog {
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
    font-size: 12px;
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

.workbench-delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.workbench-delete-dialog {
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
.workbench-action-popover {
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

.workbench-action-menu-item {
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
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #e6edf3;
    }
  }
}

.popover-fade-enter-active { transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1); }
.popover-fade-leave-active { transition: opacity 0.08s ease; }
.popover-fade-enter-from, .popover-fade-leave-to { opacity: 0; transform: translateY(-4px) scale(0.95); }

.light-theme {
  .workbench-action-popover {
    background: #ffffff;
    border-color: #d0d7de;
  }

  .workbench-action-menu-item {
    color: #1f2328;
    &:hover {
      background: #f6f8fa;
    }

    &--delete {
      color: #1f2328;
      &:hover {
        background: #f6f8fa;
        color: #1f2328;
      }
    }
  }

  .workbench-rename-dialog {
    background: #ffffff;
    border-color: #d0d7de;

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
      &::placeholder {
        color: #656d76;
      }
      &:focus {
        box-shadow: 0 0 0 1px #0969da;
      }
    }

    &__counter {
      color: #656d76;
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
        background: #4E525E;
        border-color: #4E525E;
        color: #FFFFFF;
        &:hover:not(:disabled) {
          background: #4E525E;
          border-color: #4E525E;
        }
      }
    }
  }

  .workbench-delete-dialog {
    background: #ffffff;
    border-color: #d0d7de;

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
        &:hover:not(:disabled) {
          background: #d93d3b;
          border-color: #d93d3b;
        }
      }
    }
  }
}

.light-theme {
  .workbench-sidebar {
    background: #fff;

    &__project {
    }

    &__header {
      background: #fff;

      &:hover {
        background: #F7F8FA;
      }
    }

    &__add-btn {
      color: #1f2328;
      &:hover {
        color: #1f2328;
        background: transparent;
      }
    }
  }

  .workbench-item {
    color: #656d76;

    &:hover:not(.is-active) {
      background: rgba(47, 53, 71, 0.06);
      border-radius: 8px;
    }

    &.is-active {
      background: #ECEEF3;
      color: #2F3547;
      border-radius: 8px;
    }

    &.is-dragging {
      background: rgba(9, 105, 218, 0.1);
    }

    &.drag-over {
      background: rgba(9, 105, 218, 0.15);
      color: #1f2328;
    }

    &__count {
      background: #ECEEF3;
      color: #91949E;
    }

    &__badge {
      background: #F54C46;
      color: #fff;
    }

    &__more-btn {
      color: #656d76;
      &:hover,
      &.is-open {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2328;
      }
    }
  }

  .custom-scrollbar {
    &::-webkit-scrollbar-thumb {
      background: #d0d7de;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: #8b949e;
    }
  }
}
</style>
