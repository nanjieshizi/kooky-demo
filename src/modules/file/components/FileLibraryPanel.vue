<template>
  <div class="flib">
    <header class="flib-head">
      <h3 class="flib-title">文件</h3>
      <div class="flib-head-actions">
        <button class="flib-icon" title="文件管理" @click.stop="openMenu('add', $event)">＋</button>
        <button class="flib-icon" title="收起" @click="close">✕</button>
      </div>
    </header>

    <div v-if="showHint" class="flib-hint">
      <span class="hint-dot"></span>
      <span class="hint-text">文件支持拖动到文件夹或对话框</span>
      <button class="hint-close" aria-label="关闭提示" @click="showHint = false">✕</button>
    </div>

    <div class="flib-scroll">
      <!-- 文件夹 -->
      <div v-for="fd in folders" :key="fd.id" class="flib-folder">
        <div class="folder-row" @click="toggle(fd.id)">
          <span class="fr-caret" :class="{ open: expanded.has(fd.id) }">›</span>
          <span class="fr-ic">📁</span>
          <span class="fr-name">{{ fd.name }}</span>
          <span class="fr-count">{{ fd.files.length }}</span>
          <button class="row-more" aria-label="更多" @click.stop="openMenu('folder', $event)">⋯</button>
        </div>
        <div v-if="expanded.has(fd.id)" class="folder-files">
          <div v-for="f in fd.files" :key="f.id" class="file-row is-indent" draggable="true" @dragstart="onDragStart(f, $event)" @click="open(f)">
            <span class="file-badge" :style="badgeStyle(f)">{{ typeMeta(f).label }}</span>
            <span class="file-name">{{ f.name }}</span>
            <span class="file-size">{{ f.size }}</span>
            <button class="row-more" aria-label="更多" @click.stop="openMenu('file', $event)">⋯</button>
          </div>
        </div>
      </div>

      <!-- 根级文件 -->
      <div v-for="f in files" :key="f.id" class="file-row" draggable="true" @dragstart="onDragStart(f, $event)" @click="open(f)">
        <span class="file-badge" :style="badgeStyle(f)">{{ typeMeta(f).label }}</span>
        <span class="file-name">{{ f.name }}</span>
        <span class="file-size">{{ f.size }}</span>
        <button class="row-more" aria-label="更多" @click.stop>⋯</button>
      </div>
    </div>

    <!-- 文件管理菜单 -->
    <Teleport to="body">
      <div v-if="menu" class="flib-menu" :style="menu.style" @click.stop>
        <template v-for="(it, i) in MENU_ITEMS[menu.type]" :key="i">
          <div v-if="it.key === 'sep'" class="fm-sep"></div>
          <button v-else class="fm-item" :class="{ danger: it.danger }" @click="onMenuItem(it)">
            {{ it.label }}
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { FILE_TYPE_META } from '@/modules/file/demo/fileLibraryDemo'
import { useFileLibraryStore } from '@/modules/file/store/fileLibraryStore'
import { setLibraryDragData } from '@/modules/file/composables/useLibraryFileDrop'
import { useFilePreviewStore } from '@/modules/file/store/filePreviewStore'

const uiStore = useUIStore()
const filePreview = useFilePreviewStore()
const libStore = useFileLibraryStore()
const folders = computed(() => libStore.folders)
const files = computed(() => libStore.files)

const showHint = ref(true)
const expanded = reactive(new Set(['fd-refactor']))

function toggle(id) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

// —— 文件管理菜单（+ / 文件夹⋯ / 文件⋯，交互演示）——
const menu = ref(null) // { type: 'add'|'folder'|'file', style }
const MENU_ITEMS = {
  add: [
    { key: 'new-folder', label: '新建文件夹' },
    { key: 'new-file', label: '新建文件' },
    { key: 'upload', label: '上传文件' },
  ],
  folder: [
    { key: 'new-file', label: '新建文件' },
    { key: 'new-subfolder', label: '新建子文件夹' },
    { key: 'rename', label: '重命名' },
    { key: 'sep' },
    { key: 'delete', label: '删除', danger: true },
  ],
  file: [
    { key: 'quote', label: '引用到会话' },
    { key: 'download', label: '下载' },
    { key: 'rename', label: '重命名' },
    { key: 'sep' },
    { key: 'delete', label: '删除', danger: true },
  ],
}
function openMenu(type, e) {
  if (menu.value && menu.value.type === type && menu.value.anchor === e.currentTarget) {
    menu.value = null
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  menu.value = {
    type,
    anchor: e.currentTarget,
    style: {
      position: 'fixed',
      top: `${r.bottom + 4}px`,
      right: `${Math.max(8, window.innerWidth - r.right)}px`,
    },
  }
}
function closeMenu() {
  menu.value = null
}
function onMenuItem(item) {
  closeMenu()
  if (item.key === 'sep') return
  ElMessage?.info?.(`${item.label}（演示）`)
}
onMounted(() => window.addEventListener('click', closeMenu))
onUnmounted(() => window.removeEventListener('click', closeMenu))
function typeMeta(f) {
  return FILE_TYPE_META[f.type] || FILE_TYPE_META.other
}
function badgeStyle(f) {
  const m = typeMeta(f)
  return { color: m.color, background: m.bg }
}
function open(f) {
  filePreview.open(f)
}
function onDragStart(f, e) {
  setLibraryDragData(e, f)
}
function close() {
  uiStore.closeGlobalFilePanel?.()
  uiStore.activeToolTab = null
}
</script>

<style scoped>
.flib {
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  /* 与待办面板一致：圆角悬浮卡，与会话区留出缝隙、不再粘连 */
  border-radius: 12px;
  overflow: hidden;
}
.flib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.flib-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.flib-head-actions {
  display: flex;
  gap: 2px;
}
.flib-icon {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--kk-ink-500, #6b7280);
  font-size: 15px;
  border-radius: 7px;
}
.flib-icon:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.05));
}

.flib-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 14px 8px;
  padding: 8px 10px;
  border: 1px solid var(--accent-soft, rgba(255, 98, 31, 0.16));
  background: rgba(255, 98, 31, 0.05);
  border-radius: 10px;
}
.hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--kk-orange-400, #ff621f);
  flex-shrink: 0;
}
.hint-text {
  flex: 1;
  font-size: 12px;
  color: var(--kk-orange-400, #ff621f);
}
.hint-close {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--kk-ink-400, #9aa0aa);
  font-size: 12px;
}

.flib-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px 16px;
}

.folder-row,
.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.folder-row:hover,
.file-row:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}
.file-row.is-indent {
  padding-left: 26px;
}
.fr-caret {
  width: 12px;
  flex-shrink: 0;
  color: var(--kk-ink-400, #9aa0aa);
  transition: transform 0.15s;
}
.fr-caret.open {
  transform: rotate(90deg);
}
.fr-ic {
  flex-shrink: 0;
  font-size: 15px;
}
.fr-name,
.file-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fr-count {
  flex-shrink: 0;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--kk-fill-muted, #f2f3f5);
  color: var(--kk-ink-400, #9aa0aa);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.file-badge {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.file-size {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--kk-ink-400, #9aa0aa);
}
.row-more {
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--kk-ink-400, #9aa0aa);
  font-size: 14px;
  padding: 0 4px;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.15s;
}
.folder-row:hover .row-more,
.file-row:hover .row-more {
  opacity: 1;
}
.row-more:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.06));
}

/* 文件管理菜单（Teleport）*/
.flib-menu {
  min-width: 148px;
  background: #fff;
  border: 1px solid var(--kk-border-soft, #e5e6eb);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(31, 35, 41, 0.16);
  padding: 4px;
  z-index: 3200;
}
.fm-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--kk-ink-800, #1f2329);
  padding: 8px 12px;
  border-radius: 7px;
  white-space: nowrap;
}
.fm-item:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.05));
}
.fm-item.danger {
  color: var(--kk-danger-500, #f5222d);
}
.fm-sep {
  height: 1px;
  background: var(--kk-border-soft, #e5e6eb);
  margin: 4px 6px;
}
</style>
