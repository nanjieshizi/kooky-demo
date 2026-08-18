<template>
  <div
    class="factory-bottom-panel"
    :class="{ 'is-expanded': expanded }"
    :style="expanded ? { height: `${heightPercent}%` } : undefined"
  >
    <!-- 顶栏固定：Tab + 操作（收起时仅显示此栏） -->
    <div class="bottom-bar">
      <div class="bottom-tabs" role="tablist">
        <button
          v-for="t in BOTTOM_TABS"
          :key="t.id"
          type="button"
          role="tab"
          class="bottom-tab"
          :class="{ active: activeTab === t.id }"
          @click="onTabClick(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="bottom-bar-right">
        <span class="storage-text">
          已使用 / 空间总容量: {{ storageUsedMB }}MB / {{ storageTotalGB }}GB
        </span>
        <button type="button" class="bar-btn" @click="handleClear">清理</button>
        <button type="button" class="bar-icon-btn" title="新建终端" @click="handleNewTerminal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button type="button" class="bar-icon-btn" title="最大化" @click="handleMaximize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        </button>
        <button
          type="button"
          class="bar-icon-btn"
          :title="expanded ? '收起' : '展开'"
          @click="factoryStore.toggleBottomPanelExpanded()"
        >
          <!-- 收起时箭头向上（提示可展开）；展开时箭头向下（收起），详情在 Tab 栏下方向下展开 -->
          <svg
            v-if="!expanded"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 15"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 展开：详情在 Tab 栏下方（向下展开） -->
    <div v-show="expanded" class="bottom-body">
      <div v-show="activeTab === 'terminal'" class="bottom-pane bottom-pane--terminal">
        <pre ref="terminalViewRef" class="terminal-view"><template v-for="(line, i) in terminalLines" :key="i"><span :class="`line-${line.type}`">{{ line.text }}
</span></template></pre>
        <form class="terminal-input-row" @submit.prevent="submitTerminalCommand">
          <span class="input-prompt">{{ terminalPrompt }}</span>
          <input
            v-model="terminalInput"
            type="text"
            class="terminal-input"
            placeholder="git status / git add . / git commit -m &quot;...&quot;"
            autocomplete="off"
            spellcheck="false"
          />
        </form>
      </div>
      <div v-show="activeTab === 'runs'" class="bottom-pane bottom-pane--runs">
        <FactoryTracePanel />
      </div>
      <div v-show="activeTab === 'output'" class="bottom-pane">
        <pre class="output-view"><span v-for="(line, i) in outputLines" :key="i" class="output-line">{{ line }}
</span></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useFactoryStore } from '../store'
import { getOutputLines, BOTTOM_PANEL_STORAGE } from '../bottomPanelMock'
import FactoryTracePanel from './FactoryTracePanel.vue'

defineOptions({ name: 'FactoryBottomPanel' })

const props = defineProps({
  expanded: { type: Boolean, default: false },
  activeTab: { type: String, default: 'terminal' },
  heightPercent: { type: Number, default: 32 },
})

const factoryStore = useFactoryStore()

const BOTTOM_TABS = [
  { id: 'terminal', label: '终端' },
  { id: 'runs', label: '运行记录' },
  { id: 'output', label: '输出' },
]

const terminalLines = computed(() => factoryStore.getTerminalLines(factoryStore.currentProjectId))
const outputLines = computed(() => getOutputLines(factoryStore.currentProjectId))
const terminalInput = ref('')
const terminalViewRef = ref(null)
const terminalPrompt = computed(() => {
  const slug = (factoryStore.currentProjectId || 'project').replace(/[^a-z0-9-]/gi, '-')
  return `${slug}#`
})

watch(terminalLines, async () => {
  await nextTick()
  const el = terminalViewRef.value
  if (el) el.scrollTop = el.scrollHeight
}, { deep: true })

function submitTerminalCommand() {
  const cmd = terminalInput.value.trim()
  if (!cmd) return
  factoryStore.runTerminalCommand(cmd)
  terminalInput.value = ''
}
const storageUsedMB = BOTTOM_PANEL_STORAGE.usedMB
const storageTotalGB = BOTTOM_PANEL_STORAGE.totalGB

function onTabClick(tabId) {
  factoryStore.setBottomPanelTab(tabId)
  if (!props.expanded) factoryStore.setBottomPanelExpanded(true)
}

function handleClear() {
  ElMessage.success('已清理缓存（演示）')
}

function handleNewTerminal() {
  factoryStore.setBottomPanelTab('terminal')
  if (!props.expanded) factoryStore.setBottomPanelExpanded(true)
  ElMessage.info('已新建终端会话（演示）')
}

function handleMaximize() {
  factoryStore.setBottomPanelExpanded(true)
  factoryStore.setBottomPanelHeightPercent(55)
}
</script>

<style lang="scss" scoped>
.factory-bottom-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;

  &:not(.is-expanded) {
    flex: 0 0 auto;
  }

  &.is-expanded {
    min-height: 0;
    flex-shrink: 0;
  }
}

.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px 0 12px;
  flex-shrink: 0;
  gap: 12px;
  background: #fafafa;
  border-bottom: 1px solid transparent;

  .is-expanded & {
    border-bottom-color: rgba(0, 0, 0, 0.06);
  }
}

.bottom-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.bottom-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;

  &--runs {
    display: flex;
    flex-direction: column;
  }

  &--terminal {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.terminal-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #fafafa;
}

.input-prompt {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6366f1;
  flex-shrink: 0;
}

.terminal-input {
  flex: 1;
  border: none;
  outline: none;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #1a1a1a;
  background: transparent;
}

.terminal-view {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.terminal-view,
.output-view {
  margin: 0;
  padding: 12px 14px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  color: #1a1a1a;
  white-space: pre-wrap;
  word-break: break-all;
}

.line-prompt { color: #6366f1; }
.line-cmd { color: #2f3547; }
.line-out { color: #4b5563; }

.output-line {
  display: block;
  color: #374151;
}

.bottom-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.bottom-tab {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;

  &:hover {
    color: #2f3547;
    background: rgba(47, 53, 71, 0.06);
  }

  &.active {
    color: #6366f1;
    font-weight: 500;
    background: #fff;
  }
}

.bottom-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  justify-content: flex-end;
}

.storage-text {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.bar-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;

  &:hover {
    color: #6366f1;
    background: rgba(99, 102, 241, 0.08);
  }
}

.bar-icon-btn {
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

  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }
}
</style>
