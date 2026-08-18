<template>
  <div class="factory-right-panel" :class="{ 'is-agent-detail-open': showAgentDetail }">
    <!-- 顶部 Tab 栏 + 右上角操作（初始化空状态 / 嵌入 Kode 统一工作台时隐藏） -->
    <div v-if="!showInitialEmpty && !props.embedded" class="right-tab-bar">
      <div class="tab-scroll" role="tablist">
        <button
          v-for="tabId in openTabs"
          :key="tabId"
          type="button"
          role="tab"
          class="tab-item"
          :class="{ active: activeTab === tabId, 'tab-item--fixed': getTabMeta(tabId).fixed }"
          :aria-selected="activeTab === tabId"
          @click="factoryStore.setActiveTab(tabId)"
        >
          <span class="tab-icon">{{ getTabMeta(tabId).icon }}</span>
          <span class="tab-label">{{ getTabMeta(tabId).label }}</span>
          <span
            v-if="!getTabMeta(tabId).fixed"
            class="tab-close"
            title="关闭"
            @click.stop="factoryStore.closeTab(tabId)"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </span>
        </button>

        <!-- 「更多」下拉：查看/重开其余功能 -->
        <el-dropdown
          v-if="availableMoreTabs.length > 0"
          trigger="click"
          placement="bottom-start"
          @command="factoryStore.openTab"
        >
          <button type="button" class="tab-more" title="更多功能">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <div class="more-dropdown-title">全部功能</div>
              <el-dropdown-item
                v-for="t in availableMoreTabs"
                :key="t.id"
                :command="t.id"
              >
                <span class="more-item-icon">{{ t.icon }}</span>
                <span class="more-item-label">{{ t.label }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <!-- 右上角操作：Agent 详情 + 发布 -->
      <div class="tab-actions">
        <button
          type="button"
          class="action-btn"
          title="Agent 详情与版本"
          :class="{ active: showAgentDetail }"
          @click="factoryStore.toggleAgentDetail()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>Agent 详情</span>
          <span v-if="publishedVersion" class="published-dot" title="已发布"></span>
        </button>
        <button
          type="button"
          class="action-btn action-btn--primary"
          :disabled="!currentProjectProduced"
          title="发布到市场"
          @click="factoryStore.openPublishModal()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <span>发布</span>
        </button>
      </div>
    </div>

    <!-- 主内容 + 底栏（展开时详情在 Tab 下方向下展开） -->
    <div class="right-body-column">
      <div
        v-if="!showInitialEmpty"
        ref="workspaceRef"
        class="right-workspace"
        :style="bottomPanelExpanded ? { height: `${mainHeightPercent}%`, flex: '0 0 auto' } : undefined"
      >
        <div class="right-tab-content">
          <div class="right-tab-panes">
            <FactoryCodePane v-show="resolvedActiveTab === 'code'" class="tab-pane" />
            <FactoryPreviewPane v-show="resolvedActiveTab === 'preview'" class="tab-pane" />
            <FactoryVersionPane v-show="resolvedActiveTab === 'version'" class="tab-pane" />
            <FactoryDatabasePane v-show="resolvedActiveTab === 'database'" class="tab-pane" />
            <FactoryIntegrationPane v-show="resolvedActiveTab === 'integration'" class="tab-pane" />
            <FactorySkillPane v-show="resolvedActiveTab === 'skill'" class="tab-pane" />
            <FactoryKnowledgePane v-show="resolvedActiveTab === 'knowledge'" class="tab-pane" />
          </div>
        </div>
      </div>

      <div
        v-else
        class="right-tab-content right-tab-content--initial"
        :style="bottomPanelExpanded ? { height: `${mainHeightPercent}%`, flex: '0 0 auto' } : undefined"
      >
        <FactoryInitialEmpty />
      </div>

      <div
        v-if="bottomPanelExpanded"
        class="bottom-divider"
        :class="{ dragging: isBottomDragging }"
        @mousedown="onBottomDividerDrag"
      >
        <div class="divider-line"></div>
      </div>

      <FactoryBottomPanel
        :expanded="bottomPanelExpanded"
        :active-tab="bottomPanelActiveTab"
        :height-percent="bottomPanelHeightPercent"
      />
    </div>

    <!-- Agent 详情：右栏内嵌展开（不覆盖全局） -->
    <FactoryAgentDetailPanel v-if="showAgentDetail" />
    <FactoryPublishModal />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useFactoryStore } from '../store'
import { useVerticalResize } from '../composables/useResize'
import FactoryCodePane from './more/FactoryCodePane.vue'
import FactoryPreviewPane from './more/FactoryPreviewPane.vue'
import FactoryDatabasePane from './more/FactoryDatabasePane.vue'
import FactoryIntegrationPane from './more/FactoryIntegrationPane.vue'
import FactoryKnowledgePane from './more/FactoryKnowledgePane.vue'
import FactorySkillPane from './more/FactorySkillPane.vue'
import FactoryInitialEmpty from './FactoryInitialEmpty.vue'
import FactoryVersionPane from './more/FactoryVersionPane.vue'
import FactoryAgentDetailPanel from './FactoryAgentDetailPanel.vue'
import FactoryPublishModal from './FactoryPublishModal.vue'
import FactoryBottomPanel from './FactoryBottomPanel.vue'

defineOptions({ name: 'FactoryRightPanel' })

// embedded：嵌入 Kode 统一工作台时,隐藏自带 tab 栏（由外层顶部标签条接管）
const props = defineProps({ embedded: { type: Boolean, default: false } })

const factoryStore = useFactoryStore()

const openTabs = computed(() => factoryStore.openTabs)
const activeTab = computed(() => factoryStore.activeTab)
const availableMoreTabs = computed(() => factoryStore.availableMoreTabs)
const currentProjectProduced = computed(() => factoryStore.currentProjectProduced)
const publishedVersion = computed(() => factoryStore.publishedVersion)

const getTabMeta = (id) => factoryStore.getTabMeta(id)

const showAgentDetail = computed(() => factoryStore.showAgentDetail)
const TAB_IDS = ['code', 'preview', 'version', 'database', 'integration', 'skill', 'knowledge']

// 未产出 + 未在生成中 → 初始化默认状态；生成中显示代码逐步生成
const showInitialEmpty = computed(
  () => !factoryStore.currentProjectProduced && !factoryStore.isGenerating,
)

// 兜底：activeTab 异常时回退到 code，避免内容区无任何面板匹配
const resolvedActiveTab = computed(() => {
  const tab = activeTab.value
  if (TAB_IDS.includes(tab)) return tab
  return 'code'
})

const bottomPanelExpanded = computed(() => factoryStore.bottomPanelExpanded)
const bottomPanelActiveTab = computed(() => factoryStore.bottomPanelActiveTab)
const bottomPanelHeightPercent = computed(() => factoryStore.bottomPanelHeightPercent)

const workspaceRef = ref(null)
const { topPercent, isDragging: isBottomDragging, startDrag: startVerticalDrag } = useVerticalResize(
  100 - factoryStore.bottomPanelHeightPercent,
  35,
  82,
)

const mainHeightPercent = computed(() => {
  if (!bottomPanelExpanded.value) return 100
  return topPercent.value
})

watch(topPercent, (v) => {
  if (bottomPanelExpanded.value) {
    factoryStore.setBottomPanelHeightPercent(Math.round(100 - v))
  }
})

watch(() => factoryStore.bottomPanelHeightPercent, (h) => {
  if (factoryStore.bottomPanelExpanded) {
    topPercent.value = 100 - h
  }
})

watch(() => factoryStore.bottomPanelExpanded, (expanded) => {
  if (expanded) topPercent.value = 100 - factoryStore.bottomPanelHeightPercent
})

function onBottomDividerDrag(e) {
  if (workspaceRef.value) startVerticalDrag(e, workspaceRef.value)
}
</script>

<style lang="scss" scoped>
.factory-right-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  position: relative;

  &.is-agent-detail-open .right-body-column,
  &.is-agent-detail-open .right-tab-bar {
    margin-right: min(380px, 42%);
  }
}

.action-btn.active {
  background: #eef2ff;
  color: #6366f1;
}

.right-tab-bar {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 10px 0 12px;
  flex-shrink: 0;
  gap: 8px;
  background: #fafafa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.tab-scroll {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;

  &::-webkit-scrollbar { display: none; }
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;

  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }

  &.active {
    background: #fff;
    color: #6366f1;
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

    &::after {
      content: '';
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: -1px;
      height: 2px;
      background: #6366f1;
      border-radius: 2px 2px 0 0;
    }
  }
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-left: 2px;
  color: #9ca3af;
  transition: all 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #ef4444;
  }
}

.tab-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }
}

.more-dropdown-title {
  padding: 6px 16px 4px;
  font-size: 11px;
  color: #9ca3af;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  min-width: 150px;
}

.more-item-icon { font-size: 14px; line-height: 1; }
.more-item-label { font-size: 13px; line-height: 1; }

.tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  white-space: nowrap;

  &:hover {
    border-color: #c7d2fe;
    color: #4f46e5;
  }

  &--primary {
    background: #1c1a21;
    color: #fff;
    border-color: #1c1a21;

    &:hover {
      background: #2e323c;
      color: #fff;
      border-color: #2e323c;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: #1c1a21;
    }
  }
}

.published-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
}

.right-body-column {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: #f4f5f5;

  &--initial {
    flex: 1;
    min-height: 0;
  }
}

.bottom-divider {
  flex-shrink: 0;
  height: 6px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f4f5f5;

  &:hover .divider-line,
  &.dragging .divider-line {
    background: #6366f1;
  }

  .divider-line {
    width: 48px;
    height: 3px;
    border-radius: 2px;
    background: #d1d5db;
    transition: background 0.15s;
  }
}

.right-tab-panes {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.tab-pane {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
</style>
