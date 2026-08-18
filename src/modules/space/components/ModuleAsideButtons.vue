<template>
  <div
    v-if="panels.length"
    class="aside-btns"
    :class="{ 'aside-btns--collaboration': isCollaboration }"
  >
    <el-tooltip
      v-for="p in panels"
      :key="p"
      :content="store.labelOf(nav, p)"
      placement="bottom"
      effect="dark"
      append-to="#app"
      strategy="fixed"
    >
      <button
        type="button"
        class="aside-btn"
        :class="{ active: store.activePanel === p }"
        @click="store.toggle(p)"
      >
        <!-- 仅协作使用 0805 生产工具栏图标；个人等其他模块保留原有渲染 -->
        <span v-if="isCollaboration" class="ab-icon ab-icon--collaboration">
          <SvgIcon
            v-if="COLLABORATION_ICON_NAMES[p]"
            :name="COLLABORATION_ICON_NAMES[p]"
            :size="18"
            color="currentColor"
          />
          <span v-else v-html="ICONS[p]"></span>
        </span>
        <span v-else class="ab-icon" v-html="ICONS[p]"></span>
      </button>
    </el-tooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import SvgIcon from '@/shared/components/SvgIcon.vue'

const uiStore = useUIStore()
const store = useSidePanelStore()

const nav = computed(() => uiStore.activePrimaryNav)
const isCollaboration = computed(() => nav.value === 'collaboration')
const panels = computed(() => {
  const registered = store.panelsFor(nav.value)
  if (!isCollaboration.value) return registered
  const orderedPanels = ['project', 'tasks', 'preview', 'manage']
  return orderedPanels.filter((panel) => registered.includes(panel))
})

// 简约线性图标（stroke=currentColor，随按钮态变色）
const S = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
const ICONS = {
  project: `<svg ${S}><path d="M4 20V7.5A1.5 1.5 0 0 1 5.5 6H10l2-2h6.5A1.5 1.5 0 0 1 20 5.5V20"/><path d="M8 10h8M8 14h5M8 18h7"/></svg>`,
  manage: `<svg ${S}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-3 3-4.8 5.5-4.8S14.1 17 14.5 20"/><path d="M16 3.6a3 3 0 0 1 0 5.6"/><path d="M20.5 20c-.3-2-1.4-3.4-3-4.1"/></svg>`,
  tasks: `<svg ${S}><path d="M4 6.5l1.4 1.4L8 5.3"/><path d="M4 13.5l1.4 1.4L8 12.3"/><path d="M11 7h9"/><path d="M11 14h9"/><path d="M11 19.5h6"/></svg>`,
  preview: `<svg ${S}><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H9l2 2h7.5A1.5 1.5 0 0 1 20 8.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5z"/></svg>`,
}

// 0805 协作会话工具栏：任务 → 会话文件 → 群管理。
// 项目看板是 kooky-pata 在生产基线上的增量，继续使用现有项目图标。
const COLLABORATION_ICON_NAMES = Object.freeze({
  tasks: 'icon-renwu',
  preview: 'icon-wenjianjia',
  manage: 'icon-tuanduiguanli',
})
</script>

<style scoped>
.aside-btns {
  display: flex;
  align-items: center;
  gap: 4px;
}
.aside-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kk-ink-600, #4b5563);
  transition: background 0.15s, color 0.15s;
}
.aside-btn:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.05));
  color: var(--kk-ink-800, #1f2329);
}
.aside-btn.active {
  background: var(--accent-soft, rgba(255, 98, 31, 0.12));
  color: var(--kk-orange-400, #ff621f);
}
.ab-icon {
  display: inline-flex;
}
.ab-icon :deep(svg) {
  display: block;
}

/* 0805 生产工具栏视觉只限 collaboration，不改个人/一人团队。 */
.aside-btns--collaboration {
  gap: 6px;
}
.aside-btns--collaboration .aside-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  color: #2f3547;
  transition: background 0.2s;
}
.aside-btns--collaboration .aside-btn:hover,
.aside-btns--collaboration .aside-btn.active {
  color: #2f3547;
  background: rgba(47, 53, 71, 0.06);
}
.ab-icon--collaboration,
.ab-icon--collaboration > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ab-icon--collaboration :deep(svg) {
  width: 18px;
  height: 18px;
}
</style>
