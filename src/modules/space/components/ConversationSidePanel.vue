<template>
  <div
    class="conv-side-panel"
    :class="{
      'is-dragging': dragging,
      'is-collaboration': nav === 'collaboration',
    }"
    :style="{ width: store.effectiveWidth + 'px' }"
  >
    <!-- 左边缘拖拽手柄（在会话↔侧区分隔线上）；作战室固定宽，不显示手柄 -->
    <div
      v-if="store.activePanel !== 'office'"
      class="csp-resizer"
      :class="{ dragging }"
      title="拖拽调整宽度"
      @mousedown.prevent="startDrag"
    ></div>

    <!-- 真实槽组件（自带头部）；未接入的槽走占位 -->
    <component :is="slotComponent" v-if="slotComponent" class="csp-slot" />

    <template v-else>
      <header class="csp-head">
        <span class="csp-title">{{ title }}</span>
        <button class="csp-close" aria-label="收起" @click="store.close()">✕</button>
      </header>
      <div class="csp-body">
        <div class="csp-placeholder">
          <div class="ph-icon">{{ meta.icon }}</div>
          <div class="ph-title">{{ title }}</div>
          <div class="ph-sub">{{ moduleLabel }} · 骨架占位</div>
          <div class="ph-note">{{ note }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useSidePanelStore, PANEL_META } from '@/modules/space/sidePanelStore'
import CollabGroupTasksPanel from '@/modules/collaboration/components/CollabGroupTasksPanel.vue'
import OnePersonTasksSlot from '@/modules/solo-team/components/one-person-team/OnePersonTasksSlot.vue'
import FilePreviewSlot from '@/modules/space/components/FilePreviewSlot.vue'
import ManageSlot from '@/modules/space/components/ManageSlot.vue'
import OnePersonWarRoom from '@/modules/solo-team/components/one-person-team/OnePersonWarRoom.vue'
import ProjectOverviewPanel from '@/modules/collaboration/components/ProjectOverviewPanel.vue'
import CollabConversationFilesPanel from '@/modules/collaboration/components/CollabConversationFilesPanel.vue'

const uiStore = useUIStore()
const store = useSidePanelStore()

const nav = computed(() => uiStore.activePrimaryNav)

/** 已接入真实内容的槽（自带头部）；其余走占位 */
const slotComponent = computed(() => {
  if (store.activePanel === 'preview' && nav.value === 'collaboration') return CollabConversationFilesPanel
  if (store.activePanel === 'preview') return FilePreviewSlot
  if (store.activePanel === 'office' && nav.value === 'solo-team') return OnePersonWarRoom
  if (store.activePanel === 'project' && nav.value === 'collaboration') return ProjectOverviewPanel
  if (store.activePanel === 'manage') return ManageSlot
  if (store.activePanel === 'tasks' && nav.value === 'collaboration') return CollabGroupTasksPanel
  if (store.activePanel === 'tasks' && nav.value === 'solo-team') return OnePersonTasksSlot
  return null
})
const meta = computed(() => PANEL_META[store.activePanel] || { icon: '·', label: '' })
const title = computed(() =>
  store.activePanel ? store.labelOf(nav.value, store.activePanel) : '',
)

const MODULE_LABEL = {
  deerflow: '我的分身',
  'solo-team': '一人团队',
  collaboration: '协作',
  cli: 'Kode',
}
const moduleLabel = computed(() => MODULE_LABEL[nav.value] || nav.value)

const NOTES = {
  manage: '管理槽：后续迁入 roster / 分身管理',
  tasks: '任务槽：协作=区内下钻 flow 详情；一人团队=子会话切换器（点开子会话去主区）',
  preview: '文件预览槽：文件列表 + 多标签预览（复用 previewStore）',
}
const note = computed(() => NOTES[store.activePanel] || '')

// —— 拖拽调整宽度 ——
const dragging = ref(false)
let startX = 0
let startWidth = 0

function startDrag(e) {
  dragging.value = true
  startX = e.clientX
  startWidth = store.effectiveWidth
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}
function onDrag(e) {
  // 手柄在侧区左边缘：往左拖 = 变宽
  const delta = startX - e.clientX
  store.setWidth(startWidth + delta)
}
function endDrag() {
  dragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}
onBeforeUnmount(endDrag)
</script>

<style scoped>
.conv-side-panel {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  margin-bottom: 10px; /* 与会话卡底对齐（会话 main-area-wrapper 也是 10）*/
  display: flex;
  flex-direction: column;
  background: #fff;
  /* 与会话卡合体：贴死无缝、仅右侧圆角；靠一条竖分隔线区分两栏（非两张卡）*/
  border-radius: 0 12px 12px 0;
  border-left: 1px solid var(--kk-border-soft, #e5e6eb);
  overflow: hidden;
  /* 列表/详情宽度切换平滑过渡；拖拽时关掉免卡顿 */
  transition: width 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.conv-side-panel.is-dragging {
  transition: none;
}

/* 0805 生产在完整会话卡与最右工具栏间保留 8px；仅协作侧区复用。 */
.conv-side-panel.is-collaboration {
  margin-right: 8px;
}

/* 滑入/滑出：width 0 ↔ 实际宽（内联 effectiveWidth 作目标），会话同步被推开，丝滑不弹跳 */
.side-slide-enter-active,
.side-slide-leave-active {
  transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
  overflow: hidden;
}
.side-slide-enter-from,
.side-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}

/* 拖拽手柄：覆盖左边缘那条分隔 */
.csp-resizer {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 5;
}
.csp-resizer:hover,
.csp-resizer.dragging {
  background: linear-gradient(
    90deg,
    transparent,
    var(--kk-orange-400, #ff621f),
    transparent
  );
  opacity: 0.5;
}

.csp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.csp-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.csp-close {
  border: none;
  background: transparent;
  color: var(--kk-ink-400, #9aa0aa);
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.csp-close:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}

.csp-slot {
  flex: 1;
  min-height: 0;
}

.csp-body {
  flex: 1;
  overflow: auto;
  display: flex;
}

/* A 骨架占位 */
.csp-placeholder {
  margin: auto;
  padding: 24px;
  text-align: center;
  color: var(--kk-ink-500, #6b7280);
}
.ph-icon {
  font-size: 34px;
  margin-bottom: 12px;
}
.ph-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.ph-sub {
  font-size: 12px;
  margin-top: 4px;
  color: var(--kk-orange-400, #ff621f);
}
.ph-note {
  font-size: 12px;
  margin-top: 14px;
  line-height: 1.6;
  color: var(--kk-ink-400, #9aa0aa);
  max-width: 220px;
}
</style>
