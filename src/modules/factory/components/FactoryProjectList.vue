<template>
  <div class="submenu-list">
    <div
      v-for="item in projectItems"
      :key="item.key"
      class="submenu-item"
      :class="{ active: factoryStore.currentProjectId === item.key }"
      @click="onProjectClick(item)"
    >
      <!-- 内联重命名输入框 -->
      <input
        v-if="renamingId === item.key"
        :ref="el => setRenameInputRef(el, item.key)"
        class="submenu-item-rename-input"
        :value="renameValue"
        maxlength="20"
        @input="onRenameInput"
        @keydown.enter.prevent="submitRename"
        @keydown.esc.prevent="cancelRename"
        @blur="submitRename"
        @click.stop
      />
      <span v-else class="submenu-item-label">{{ item.label }}</span>

      <button
        type="button"
        class="submenu-item-more"
        @click.stop="onMoreClick($event, item)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
          <circle cx="5" cy="12" r="1"/>
        </svg>
      </button>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="thread-context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="onRename">重命名</div>
        <div class="context-menu-item context-menu-item--danger" @click="onDelete">删除</div>
      </div>
      <div v-if="contextMenu.visible" class="context-menu-mask" @click="closeContextMenu" />
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, nextTick } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryProjectList' })

const factoryStore = useFactoryStore()

const projectItems = computed(() =>
  factoryStore.projects.map((proj) => ({
    key: proj.id,
    label: proj.name,
  }))
)

const contextMenu = reactive({ visible: false, x: 0, y: 0, project: null })

// 内联重命名
const renamingId = ref(null)
const renameValue = ref('')
const renameInputRefs = {}

function setRenameInputRef(el, key) {
  if (el) renameInputRefs[key] = el
  else delete renameInputRefs[key]
}

function onProjectClick(item) {
  if (renamingId.value === item.key) return
  factoryStore.selectProject(item.key)
}

function onMoreClick(e, item) {
  const rect = e.currentTarget.getBoundingClientRect()
  contextMenu.visible = true
  contextMenu.x = rect.right
  contextMenu.y = rect.bottom + 4
  contextMenu.project = item
}

function closeContextMenu() {
  contextMenu.visible = false
  contextMenu.project = null
}

function onRename() {
  const project = contextMenu.project
  closeContextMenu()
  if (!project) return
  renamingId.value = project.key
  renameValue.value = project.label
  nextTick(() => {
    const input = renameInputRefs[project.key]
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const ALLOWED_RENAME_RE = /[^一-龥a-zA-Z0-9　-〿＀-￯ ,.!?;:'"()-]/g

function onRenameInput(e) {
  const raw = e.target.value
    .replace(/[\r\n]/g, '')
    .replace(ALLOWED_RENAME_RE, '')
  renameValue.value = raw
  e.target.value = raw
}

function submitRename() {
  if (!renamingId.value) return
  const id = renamingId.value
  const value = renameValue.value.trim()
  renamingId.value = null
  renameValue.value = ''
  if (!value) return
  const proj = projectItems.value.find(t => t.key === id)
  if (!proj || value === proj.label) return
  factoryStore.renameProject(id, value)
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

function onDelete() {
  const project = contextMenu.project
  closeContextMenu()
  if (!project) return
  factoryStore.deleteProject(project.key)
}
</script>

<style lang="scss" scoped>
.submenu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  height: 100%;
  margin: 0 5px;
}

.submenu-list::-webkit-scrollbar { width: 4px; }
.submenu-list::-webkit-scrollbar-track { background: transparent; }
.submenu-list::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
.submenu-list:hover::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.25); }

.submenu-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0px 2px 0px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submenu-item:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.submenu-item:hover .submenu-item-more {
  opacity: 1;
}

.submenu-item.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
  .submenu-item-label { font-weight: 600; }
}

.submenu-item-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.submenu-item-rename-input {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-family: inherit;
  color: #2f3547;
  background: #fff;
  border: 1px solid #4e6ef2;
  border-radius: 6px;
  padding: 2px 6px;
  outline: none;
  height: 26px;
  box-sizing: border-box;
  box-shadow: 0 0 0 2px rgba(78, 110, 242, 0.15);
}

.submenu-item-more {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-left: auto;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8d93a6;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.submenu-item-more:hover {
  opacity: 1;
  background: rgba(47, 53, 71, 0.06);
}

.thread-context-menu {
  position: fixed;
  z-index: 9999;
  width: 98px;
  padding: 8px 6px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.16);
}

.context-menu-item {
  height: 30px;
  line-height: 30px;
  padding: 0 6px;
  font-size: 14px;
  color: #2f3547;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: #f5f6f9;
}

.context-menu-item--danger {
  color: #ff4d4f;
}

.context-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
