<template>
  <Transition name="bar-fade">
    <div v-if="visible" class="shortcut-bar" :style="barStyle">
      <!-- + 按钮 -->
      <button
        ref="addBtnRef"
        class="add-btn"
        :class="{ disabled: isAtLimit }"
        :disabled="isAtLimit"
        :title="isAtLimit ? `已达到上限（${MAX_COUNT} 条）` : '添加快捷命令'"
        @click="openAddDialog"
      >+</button>

      <!-- 命令按钮列表 -->
      <div ref="listRef" class="btn-list">
        <template v-if="commands.length === 0">
          <span class="empty-hint">添加常用命令，一键发送到终端</span>
        </template>
        <template v-else>
          <ShortcutButton
            v-for="(cmd, idx) in commands"
            :key="cmd.id"
            :item="cmd"
            :dragging="dragIdx === idx"
            :drag-over="dragOverIdx === idx"
            @click="handleClick"
            @contextmenu="handleContextMenu"
            @delete="handleDelete"
            @drag-start="onDragStart(idx)"
            @drag-over="onDragOver(idx)"
            @drop="onDrop(idx)"
          />
        </template>
      </div>

      <!-- 添加/编辑弹窗 -->
      <ShortcutDialog
        :visible="dialogVisible"
        :edit-item="editingItem"
        :anchor-rect="addBtnRect"
        :theme="theme"
        @update:visible="dialogVisible = $event"
        @confirm="handleDialogConfirm"
      />

      <!-- 右键菜单 -->
      <ShortcutContextMenu
        :visible="contextMenuVisible"
        :position="contextMenuPos"
        :item="contextMenuItem"
        :theme="theme"
        @update:visible="contextMenuVisible = $event"
        @edit="openEditDialog"
        @send-to-all="handleSendToAll"
        @delete="handleDelete"
      />

    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ShortcutButton from './ShortcutButton.vue'
import ShortcutDialog from './ShortcutDialog.vue'
import ShortcutContextMenu from './ShortcutContextMenu.vue'
import { useShortcutCommands } from './useShortcutCommands'

const props = defineProps({
  visible: { type: Boolean, default: true },
  theme: { type: Object, default: null },
})

const barStyle = computed(() => {
  const t = props.theme
  if (!t) return {}
  const isLight = t.name === '白色'
  return {
    background: t.barBg,
    borderColor: t.barBorder,
    '--bar-btn-bg': t.barBtnBg,
    '--bar-btn-border': t.barBtnBorder,
    '--bar-btn-text': t.barBtnText,
    '--bar-btn-hover-bg': t.barBtnHoverBg,
    '--bar-btn-active-bg': t.barBtnActiveBg || t.barBtnBg,
    '--bar-add-btn-bg': t.barAddBtnBg,
    '--bar-add-btn-text': t.barAddBtnText,
    '--bar-empty-hint': t.barEmptyHint,
    '--delete-x-color': isLight ? '#fff' : '#2B2B2C',
  }
})

const emit = defineEmits(['send-command', 'send-command-all'])

const {
  commands,
  isAtLimit,
  MAX_COUNT,
  load,
  addCommand,
  updateCommand,
  removeCommand,
  reorder,
} = useShortcutCommands()

const listRef = ref(null)
const addBtnRef = ref(null)

onMounted(async () => {
  await load()
})

// ========================
// 添加/编辑弹窗
// ========================
const dialogVisible = ref(false)
const editingItem = ref(null)
const addBtnRect = ref(null)

function openAddDialog() {
  if (isAtLimit.value) return
  editingItem.value = null
  addBtnRect.value = addBtnRef.value?.getBoundingClientRect() ?? null
  dialogVisible.value = true
}

function openEditDialog(item) {
  editingItem.value = item
  addBtnRect.value = addBtnRef.value?.getBoundingClientRect() ?? null
  dialogVisible.value = true
}

function handleDialogConfirm(data) {
  if (data.id) {
    updateCommand(data.id, data)
  } else {
    addCommand(data)
  }
}

// ========================
// 右键菜单
// ========================
const contextMenuVisible = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuItem = ref(null)

function handleContextMenu({ event, item }) {
  const rect = event.target.closest('.shortcut-btn-wrapper')?.getBoundingClientRect()
  contextMenuPos.value = {
    x: rect ? rect.left + rect.width / 2 - 80 : event.clientX,
    y: rect ? rect.top : event.clientY,
  }
  contextMenuItem.value = item
  contextMenuVisible.value = true
}

// ========================
// 命令操作
// ========================

function handleClick(item) {
  emit('send-command', { command: item.command, mode: item.mode })
}

function handleSendToAll(item) {
  emit('send-command-all', { command: item.command, mode: item.mode })
}

function handleDelete(item) {
  removeCommand(item.id)
}

// ========================
// 拖拽排序
// ========================
const dragIdx = ref(-1)
const dragOverIdx = ref(-1)

function onDragStart(idx) {
  dragIdx.value = idx
}

function onDragOver(idx) {
  dragOverIdx.value = idx
}

function onDrop(idx) {
  if (dragIdx.value === -1 || dragIdx.value === idx) return
  const list = [...commands.value]
  const [moved] = list.splice(dragIdx.value, 1)
  list.splice(idx, 0, moved)
  reorder(list)
  dragIdx.value = -1
  dragOverIdx.value = -1
}
</script>

<style scoped>
.shortcut-bar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 50px;
  padding-left: 12px;
  padding-right: 12px;
  border-width: 1px 0px 0px 0px;
  border-style: solid;
  user-select: none;
  overflow: visible;
  /* Windows 渲染优化：强制 GPU 层独立，避免残留 */
  will-change: opacity;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.add-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--bar-add-btn-bg, #2B2B2C);
  color: var(--bar-add-btn-text, #8C8C8C);
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
}

.add-btn:hover:not(.disabled) {
  background: var(--bar-btn-hover-bg, rgba(255, 255, 255, 0.12));
  color: var(--bar-btn-text, rgba(255, 255, 255, 0.95));
}

.add-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-list {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
}

.btn-list::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.empty-hint {
  color: var(--bar-empty-hint, rgba(255, 255, 255, 0.3));
  font-size: 13px;
  white-space: nowrap;
}

/* 过渡动画 - Windows 优化 */
.bar-fade-enter-active,
.bar-fade-leave-active {
  transition: opacity 0.2s ease;
  overflow: hidden;
}

.bar-fade-enter-from,
.bar-fade-leave-to {
  opacity: 0;
}

.bar-fade-enter-to,
.bar-fade-leave-from {
  opacity: 1;
}
</style>
