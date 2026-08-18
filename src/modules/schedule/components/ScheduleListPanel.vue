<template>
  <div class="schedule-list-panel">
    <!-- 顶部标题栏 -->
    <header class="panel-header">
      <h3 class="panel-title">定时任务</h3>
      <button class="panel-close" aria-label="关闭" @click="closePanel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M6 18L18 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <!-- 空态 -->
    <div v-if="store.isEmpty" class="empty-state">
      <div class="empty-icon">⏰</div>
      <div class="empty-title">选择下方对话</div>
      <div class="empty-subtitle">开启你的第一个定时任务吧</div>
      <div class="presets">
        <button
          v-for="p in store.presets"
          :key="p.id"
          type="button"
          class="preset-btn"
          @click="openCreate(p)"
        >
          <span class="preset-text">{{ p.label }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="preset-arrow">
            <path d="M9 6l6 6-6 6" stroke="#86909C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <button type="button" class="create-btn create-btn--cta" @click="openCreate(null)">
        <span class="cta-plus">+</span> 创建定时任务
      </button>
    </div>

    <!-- 列表态 -->
    <div v-else class="list-state custom-scrollbar">
      <button type="button" class="create-btn create-btn--inline" @click="openCreate(null)">
        <span class="cta-plus">+</span> 创建定时任务
      </button>

      <!-- 我的分身分组 -->
      <ScheduleGroupSection
        v-if="store.groupedTasks.avatar.tasks.length"
        :label="store.groupedTasks.avatar.label"
        icon="🎭"
        :tasks="store.groupedTasks.avatar.tasks"
        :active-id="store.activeTaskId"
        @select="selectTask"
      />

      <!-- 一人团队 -->
      <ScheduleSubGroups
        v-if="hasSoloTeamGroups"
        :label="store.groupedTasks['solo-team-group'].label"
        icon="🧑"
        :sub-groups="store.groupedTasks['solo-team-group'].subGroups"
        :active-id="store.activeTaskId"
        @select="selectTask"
      />

      <!-- 协作 -->
      <ScheduleSubGroups
        v-if="hasCollabGroups"
        :label="store.groupedTasks['collab-group'].label"
        icon="🤝"
        :sub-groups="store.groupedTasks['collab-group'].subGroups"
        :active-id="store.activeTaskId"
        @select="selectTask"
      />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'ScheduleListPanel' })

import { computed } from 'vue'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'
import { useUIStore } from '@/modules/space/uiStore'
import ScheduleGroupSection from './ScheduleGroupSection.vue'
import ScheduleSubGroups from './ScheduleSubGroups.vue'

const store = useScheduleStore()
const uiStore = useUIStore()

const hasSoloTeamGroups = computed(() =>
  Object.keys(store.groupedTasks['solo-team-group'].subGroups || {}).length > 0
)
const hasCollabGroups = computed(() =>
  Object.keys(store.groupedTasks['collab-group'].subGroups || {}).length > 0
)

function selectTask(taskId) {
  store.setActiveTask(taskId)
}

function openCreate(preset) {
  store.openCreateDialog(preset)
}

function closePanel() {
  uiStore.setActiveToolTab(null)
}
</script>

<style scoped>
.schedule-list-panel {
  display: flex;
  flex-direction: column;
  width: 280px;
  height: 100%;
  background: #FFFFFF;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #F2F3F5;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1D2129;
}

.panel-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}
.panel-close:hover { background: #F7F8FA; }

/* ── 空态 ── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  text-align: center;
  overflow-y: auto;
}

.empty-icon {
  font-size: 48px;
  margin-top: 20px;
}

.empty-title {
  margin-top: 12px;
  font-size: 14px;
  color: #1D2129;
  font-weight: 500;
}

.empty-subtitle {
  font-size: 13px;
  color: #86909C;
  margin-top: 2px;
}

.presets {
  margin-top: 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: #FAFBFC;
  border: 1px solid #F2F3F5;
  border-radius: 16px;
  font-size: 12px;
  color: #4E5969;
  cursor: pointer;
  text-align: left;
  line-height: 1.5;
  transition: all 0.15s ease;
  font-family: inherit;
}
.preset-btn:hover {
  background: #FFFFFF;
  border-color: #436FF6;
  color: #1D2129;
  box-shadow: 0 2px 8px rgba(67, 111, 246, 0.08);
}

.preset-text {
  flex: 1;
}

.preset-arrow {
  flex-shrink: 0;
}

.create-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: #1D2129;
  color: #FFFFFF;
  border: none;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}
.create-btn:hover { background: #2F3547; }

.create-btn--cta {
  margin-top: 24px;
}

.create-btn--inline {
  margin: 12px 16px;
  align-self: flex-start;
}

.cta-plus {
  font-size: 14px;
  line-height: 1;
}

/* ── 列表态 ── */
.list-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
