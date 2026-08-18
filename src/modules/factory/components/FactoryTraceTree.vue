<template>
  <div class="trace-tree">
    <!-- 工具栏：日期 / 筛选 / 运行选择 -->
    <div class="trace-tree-toolbar">
      <el-popover
        placement="bottom-start"
        :width="200"
        trigger="click"
        popper-class="factory-trace-popper"
      >
        <template #reference>
          <button type="button" class="tree-toolbar-btn" title="选择日期">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </button>
        </template>
        <div class="popper-title">选择日期</div>
        <div class="popper-list">
          <button
            v-for="d in dates"
            :key="d"
            type="button"
            class="popper-item"
            :class="{ active: d === traceSelectedDate }"
            @click="onPickDate(d)"
          >
            {{ d }}
            <span v-if="formatRelativeDate(d) !== d" class="popper-item-hint">({{ formatRelativeDate(d) }})</span>
          </button>
        </div>
      </el-popover>

      <el-popover
        placement="bottom-start"
        :width="160"
        trigger="click"
        popper-class="factory-trace-popper"
      >
        <template #reference>
          <button type="button" class="tree-toolbar-btn" title="筛选">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>
        </template>
        <div class="popper-title">按状态筛选</div>
        <div class="popper-list">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            type="button"
            class="popper-item filter-item"
            :class="{ active: f.id === traceFilterStatus }"
            @click="onPickFilter(f.id)"
          >
            <span class="popper-status-dot" :class="`status-${f.id}`"></span>
            {{ f.label }}
          </button>
        </div>
      </el-popover>

      <el-popover
        placement="bottom-start"
        :width="240"
        trigger="click"
        popper-class="factory-trace-popper"
      >
        <template #reference>
          <span class="trace-run-tag" :title="`${activeTraceRun?.date || ''} ${activeTraceRun?.time || ''}`">
            <span
              class="popper-status-dot"
              :class="`status-${activeTraceRun?.status || 'success'}`"
            ></span>
            {{ activeTraceRun ? `${formatRelativeDate(activeTraceRun.date)} ${activeTraceRun.time}` : '—' }}
          </span>
        </template>
        <div class="popper-title">运行记录 ({{ filteredTraceRuns.length }})</div>
        <div class="popper-list scroll">
          <button
            v-for="r in filteredTraceRuns"
            :key="r.id"
            type="button"
            class="popper-item run-item"
            :class="{ active: r.id === activeTraceRunId }"
            @click="onPickRun(r.id)"
          >
            <span class="popper-status-dot" :class="`status-${r.status}`"></span>
            <span class="run-time">{{ formatRelativeDate(r.date) }} {{ r.time }}</span>
            <span class="run-duration">{{ r.duration }}</span>
          </button>
          <div v-if="filteredTraceRuns.length === 0" class="popper-empty">无符合条件的记录</div>
        </div>
      </el-popover>
    </div>

    <!-- 调用树 -->
    <div class="trace-tree-body">
      <FactoryTraceTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :depth="0"
        :active-id="selectedTraceNodeId"
        @select="onSelect"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFactoryStore } from '../store'
import { TRACE_DATES, formatRelativeDate } from '../traceMock'
import FactoryTraceTreeNode from './FactoryTraceTreeNode.vue'

defineOptions({ name: 'FactoryTraceTree' })

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'success', label: '成功' },
  { id: 'error', label: '失败' },
]

const factoryStore = useFactoryStore()
const {
  traceNodes,
  selectedTraceNodeId,
  traceSelectedDate,
  traceFilterStatus,
  activeTraceRunId,
  activeTraceRun,
  filteredTraceRuns,
} = storeToRefs(factoryStore)

const nodes = computed(() => traceNodes.value || [])
const dates = TRACE_DATES

function onSelect(id) {
  factoryStore.selectTraceNode(id)
}

function onPickDate(d) {
  factoryStore.pickTraceDate(d)
}

function onPickFilter(id) {
  factoryStore.pickTraceFilter(id)
}

function onPickRun(id) {
  factoryStore.pickTraceRun(id)
}
</script>

<style lang="scss" scoped>
.trace-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
}

.trace-tree-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.tree-toolbar-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    color: #6366f1;
  }
}

.trace-run-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'SF Mono', Menlo, Consolas, monospace;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    color: #6366f1;
  }
}

.trace-tree-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 6px;
}
</style>

<style lang="scss">
/* popover 样式（非 scoped） */
.factory-trace-popper {
  --el-popover-padding: 10px;
  padding: 10px !important;

  .popper-title {
    font-size: 11px;
    font-weight: 500;
    color: #9ca3af;
    margin: 0 0 6px 4px;
  }

  .popper-list {
    display: flex;
    flex-direction: column;
    gap: 2px;

    &.scroll {
      max-height: 220px;
      overflow-y: auto;
    }
  }

  .popper-empty {
    text-align: center;
    color: #9ca3af;
    font-size: 11px;
    padding: 8px;
  }

  .popper-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: #f3f4f6;
    }

    &.active {
      background: rgba(99, 102, 241, 0.08);
      color: #6366f1;
      font-weight: 500;
    }

    .popper-item-hint {
      color: #9ca3af;
      font-size: 11px;
    }

    &.run-item {
      gap: 8px;

      .run-time {
        flex: 1;
        font-family: 'SF Mono', Menlo, Consolas, monospace;
        font-size: 11px;
      }

      .run-duration {
        color: #9ca3af;
        font-size: 11px;
      }
    }
  }

  .popper-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #9ca3af;

    &.status-success { background: #22c55e; }
    &.status-error { background: #ef4444; }
    &.status-all { background: #9ca3af; }
  }
}
</style>
