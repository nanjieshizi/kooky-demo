<script setup>
import { provide, computed, onMounted, onBeforeUnmount } from 'vue'
import { createKodeState, KODE_STATE_KEY } from './composables/useKodeState.js'
import KodeLeftList from './components/KodeLeftList.vue'
import { ref } from 'vue'
import DecomposeTab from './components/tabs/DecomposeTab.vue'
import TodolistCenter from './components/tabs/TodolistCenter.vue'
import CliTab from './components/tabs/CliTab.vue'
import KodeConvo from './components/KodeConvo.vue'
import NewTaskModal from './components/NewTaskModal.vue'
import AddWorkspaceModal from './components/AddWorkspaceModal.vue'
import BatchExecuteModal from './components/BatchExecuteModal.vue'
import IdeWorkbench from './components/IdeWorkbench.vue'
import WsMissingState from './components/WsMissingState.vue'

const state = createKodeState()
provide(KODE_STATE_KEY, state)

const {
  openNewTaskModal,
  selectedTask,
  selectedWorkspace,
  wsMissing,
  openTabIds,
  activeTabId,
  setActiveTab,
  closeTab,
  openTab,
  addableTabs,
} = state

// 标签页定义（Plan/IDE/CLI 三个全部常驻，都不可关）
// 文件预览不在这里：点文件卡 / 产物 → 走全局共享预览区（见 useKodeState.openPreviewTab）
const TAB_DEFS = {
  task: { icon: '📋', label: 'Plan', closable: false },
  ide: { icon: '💻', label: 'IDE', closable: false },
  cli: { icon: '⌨️', label: 'CLI', closable: false },
}
const openTabs = computed(() => openTabIds.value.map((id) => ({ id, ...TAB_DEFS[id] })))

// + 菜单
const addMenuOpen = ref(false)
function onAdd(id) { openTab(id); addMenuOpen.value = false }

// 右侧栏是否显示：CLI 不需要对话，中间区直接全宽
const showConvo = computed(
  () => activeTabId.value === 'task' || activeTabId.value === 'ide',
)
// 中间工作区切换动画 key
const currentModeKey = computed(() => activeTabId.value)

// 桥接：让协作 / 一人团队等其它模块能远程触发 Kode 新建任务弹窗（含预填）
// 调用方式：window.__kookyMock.openKodeNewTaskWithPrefill({ prefilledDesc, sourceMeta, preferredWsId })
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.__kookyMock = window.__kookyMock || {}
    window.__kookyMock.openKodeNewTaskWithPrefill = (opts) => openNewTaskModal(opts)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && window.__kookyMock) {
    delete window.__kookyMock.openKodeNewTaskWithPrefill
  }
})
</script>

<template>
  <div class="kode-demo-root">
    <!-- ⚠️ 已删除自带的 Kooky 顶栏 logo + "Kode / 产研工作台"
         嵌在 HomeView 里时由主壳 TitleBar 统一渲染 logo / 导航
         旧的独立路由全屏挂载方案见 git 历史 -->
    <main class="kode-main">
      <!-- 左：任务列表 -->
      <KodeLeftList />

      <!-- 右侧整体:统一固定顶部条 + 下方根据 mode 切内容 -->
      <section class="kode-right-area">
        <!-- 统一固定顶部条(所有任务类型共用,切换时不动)-->
        <header v-if="selectedTask" class="unified-topbar">
          <!-- 浏览器式标签页:任务/IDE 钉死,CLI 可关 + 加回 -->
          <div class="tab-strip">
            <button
              v-for="tab in openTabs"
              :key="tab.id"
              class="wb-tab"
              :class="{ active: activeTabId === tab.id }"
              type="button"
              @click="setActiveTab(tab.id)"
            >
              <span class="wt-icon">{{ tab.icon }}</span>
              <span class="wt-label">{{ tab.label }}</span>
              <span
                v-if="tab.closable"
                class="wt-close"
                title="关闭标签页"
                @click.stop="closeTab(tab.id)"
              >✕</span>
            </button>

            <!-- + 加标签页 -->
            <div v-if="addableTabs.length" class="wb-add">
              <button class="wb-add-btn" type="button" title="新建标签页" @click.stop="addMenuOpen = !addMenuOpen">+</button>
              <div v-if="addMenuOpen" class="wb-add-menu">
                <button
                  v-for="id in addableTabs"
                  :key="id"
                  type="button"
                  class="wb-add-item"
                  @click="onAdd(id)"
                >
                  {{ TAB_DEFS[id].icon }} {{ TAB_DEFS[id].label }}
                </button>
              </div>
            </div>
          </div>

          <span class="ut-spacer"></span>
          <span v-if="activeTabId === 'ide'" class="ut-tip">⌘P 文件 · ⌘⇧P 命令</span>
        </header>

        <!-- 目录失效横幅：跨 Plan/IDE/CLI 常驻，提示当前工作区目录不在了 -->
        <div v-if="wsMissing" class="ws-missing-banner">
          <span class="wm-ico">⚠️</span>
          <span class="wm-text">
            工作区目录不存在：<code>{{ selectedWorkspace?.cwd }}</code>
            —— 已停用所有操作，仅保留可展示的内容
          </span>
        </div>

        <!-- 内容区:中间工作区(随标签页 crossfade) + 右侧统一对话柱 -->
        <div class="mode-stage">
          <div class="wb-body">
            <!-- 中间工作区:按标签页切,走交叉淡入 -->
            <div class="wb-center">
              <Transition name="mode-fade">
                <div :key="currentModeKey" class="wb-center-inner">
                  <!-- 任务模式:中间放「对话」(任务助手) -->
                  <DecomposeTab v-if="activeTabId === 'task'" />
                  <!-- IDE / CLI 全靠 cwd：目录失效 → 换失效页；Plan 不换，降级展示 -->
                  <template v-else-if="activeTabId === 'ide'">
                    <WsMissingState v-if="wsMissing" scope="ide" />
                    <IdeWorkbench v-else />
                  </template>
                  <template v-else-if="activeTabId === 'cli'">
                    <WsMissingState v-if="wsMissing" scope="cli" />
                    <CliTab v-else />
                  </template>
                </div>
              </Transition>
            </div>

            <!-- 右侧 360 柱:Plan=Todolist / IDE=Kode 会话；CLI 不显,中间全宽 -->
            <aside v-if="showConvo" class="wb-convo">
              <!-- 任务模式:右侧 = Todolist(用它自己的头);其余:会话头 -->
              <header v-if="activeTabId !== 'task'" class="convo-head">
                <span class="ch-title">💬 会话</span>
                <span class="ch-id">Kode</span>
              </header>
              <div class="convo-body">
                <!-- 任务模式右栏:Todolist（执行完末尾带出产物）-->
                <TodolistCenter v-if="activeTabId === 'task'" />
                <KodeConvo v-else />
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>

    <!-- 模态框 -->
    <NewTaskModal />
    <AddWorkspaceModal />
    <BatchExecuteModal />
  </div>
</template>

<style lang="scss" scoped>
@use './styles.scss' as *;

// 嵌入模式：适应 HomeView 的 .center-area-wrapper / .claude-code-host 容器尺寸
// 不再用 position:fixed 全屏覆盖（会盖住主壳 nav rail / 顶栏）
.kode-demo-root {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: $bg-secondary;
  color: $text-display;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  overflow: hidden;
}

.kode-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

// kode-right-area = 编辑/处理/cli tab 栏 + 内容（横跨 center + right panel）
// 让 tab 切换栏横跨右半屏，三 tab 顶部完全一致
.kode-right-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: $bg-primary;
  position: relative;
  overflow: hidden;
}

// ════ 统一固定顶部条(切换模式时不动,只切下面)════
.unified-topbar {
  flex-shrink: 0;
  height: 56px;
  padding: 0 16px;
  background: $bg-primary;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: $fs-sm;

  .ut-target { font-size: 15px; line-height: 1; }
  .ut-task {
    color: $text-display;
    font-weight: $fw-bold;
    font-size: $fs-lg;
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ut-tip {
    color: $text-faint;
    font-size: $fs-xs;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .ut-spacer { flex: 1; }

  // ─── 浏览器式标签页:任务/IDE/CLI ───
  // 激活页 = 白底 + 底部 2px 主色下划线压在顶部条底边线上,与下方内容区连成一体
  .tab-strip {
    position: relative;
    flex-shrink: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 2px;

    .wb-tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border: 0;
      border-radius: 7px 7px 0 0;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      font-size: $fs-md;
      font-weight: $fw-medium;
      color: $text-muted;
      transition: all $anim-fast;

      .wt-icon { font-size: 12px; }
      .wt-close {
        margin-left: 2px;
        font-size: 10px;
        color: $text-faint;
        border-radius: 4px;
        padding: 1px 3px;
        &:hover { background: rgba(0, 0, 0, 0.08); color: $danger; }
      }

      &:hover { background: rgba(47, 53, 71, 0.06); color: $text-display; }

      &.active {
        background: #fff;
        color: $aurora-purple;
        font-weight: $fw-semibold;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

        // 底部主色条压在顶部条的 border-bottom 上 → 标签页"连"到内容
        &::after {
          content: '';
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: -1px;
          height: 2px;
          background: $gradient-aurora;
          border-radius: 2px 2px 0 0;
        }
      }
    }

    .wb-add {
      position: relative;
      .wb-add-btn {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: $text-muted;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        &:hover { background: rgba(132, 120, 250, 0.08); color: $aurora-purple; }
      }
      .wb-add-menu {
        position: absolute;
        top: 34px;
        left: 0;
        z-index: 20;
        min-width: 120px;
        padding: 4px;
        background: #fff;
        border: 1px solid $border-light;
        border-radius: 10px;
        box-shadow: $shadow-lg;
        display: flex;
        flex-direction: column;
        gap: 2px;
        .wb-add-item {
          border: 0;
          background: transparent;
          text-align: left;
          padding: 7px 10px;
          border-radius: 6px;
          font-family: inherit;
          font-size: $fs-md;
          color: $text-display;
          cursor: pointer;
          &:hover { background: rgba(132, 120, 250, 0.08); }
        }
      }
    }
  }
}

// 模式舞台
.ws-missing-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(225, 29, 72, 0.08);
  border-bottom: 1px solid rgba(225, 29, 72, 0.18);
  font-size: $fs-sm;
  color: #b91c3c;
  .wm-ico { flex-shrink: 0; }
  .wm-text code {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: $fs-xs;
    background: rgba(225, 29, 72, 0.10);
    padding: 1px 5px;
    border-radius: 4px;
  }
}

.mode-stage {
  flex: 1;
  position: relative;
  min-height: 0;
  display: flex;
}

// ── 工作台主体：中间工作区 + 右侧统一对话柱 ──
.wb-body {
  flex: 1;
  display: flex;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
// 中间工作区：给交叉淡入提供定位上下文（离场元素 absolute 重叠在此）
.wb-center {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  background: $bg-primary;
}
.wb-center-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
// 右侧统一对话柱：常驻 360，任务助手 / Kode 共用同款外壳
.wb-convo {
  flex: 0 0 360px;
  width: 360px;
  min-height: 0;
  border-left: 1px solid $border;
  background: #fcfbfe;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  // 统一顶部栏「会话」
  .convo-head {
    flex-shrink: 0;
    height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-bottom: 1px solid $border;
    background: #fff;

    .ch-title { font-size: $fs-lg; font-weight: $fw-semibold; color: $text-display; }
    .ch-id {
      font-size: $fs-xs;
      font-weight: $fw-medium;
      color: $aurora-purple;
      background: rgba(132, 120, 250, 0.10);
      border-radius: 7px;
      padding: 2px 8px;
    }
  }

  // 对话内容（DecomposeTab / KodeConvo）铺满剩余高度
  .convo-body {
    flex: 1;
    min-height: 0;
    display: flex;
    > * { flex: 1; min-height: 0; width: 100%; }
  }
}


// 中间工作区切换动画 · 交叉淡入（纯 opacity，对话柱不参与，避免"重载"感）
.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 0.26s ease;
}
.mode-fade-enter-from,
.mode-fade-leave-to { opacity: 0; }
.mode-fade-leave-active {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.mode-fade-enter-active { z-index: 1; }

.kode-tabs {
  height: $tab-bar-h;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: stretch;
  padding: 0 20px;
  gap: 24px;
  flex-shrink: 0;

  .kode-tab {
    height: $tab-bar-h;
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: $fs-md;
    color: $text-muted;
    font-weight: $fw-medium;
    font-family: inherit;
    padding: 0;
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color $anim-fast;

    &:hover {
      color: $text-secondary;
    }

    &.active {
      color: $text-display;
      font-weight: $fw-semibold;

      &::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2px;
        background: $gradient-aurora;
        border-radius: 1px;
      }
    }

    .dot-ind {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: $aurora-purple;
      animation: kode-pulse 1.5s infinite;
    }
  }

  .spacer { flex: 1; }
}

.kode-tab-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

@keyframes kode-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
