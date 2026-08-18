<template>
  <div class="factory-agent-detail-panel">
    <div class="panel-header">
      <span class="panel-title">Agent 详情</span>
      <button type="button" class="panel-close" title="收起" @click="factoryStore.closeAgentDetail()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="panel-body scrollbar-thin">
      <div class="agent-profile">
        <div class="agent-avatar">
          <img v-if="agent.icon" :src="agent.icon" alt="" />
          <span v-else class="avatar-fallback">🤖</span>
        </div>
        <div class="agent-info">
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-meta">
            <span class="ver-pill">展示版本 {{ agent.version }}</span>
            <span v-if="publishedRelease" class="published-pill">已发布到市场</span>
            <span v-else class="unpublished-pill">未发布</span>
          </div>
        </div>
      </div>
      <p class="agent-desc">{{ agent.description || '暂无描述' }}</p>

      <div class="section-head">
        <span class="section-title">发布记录</span>
        <span class="section-hint">基于代码提交发布到市场（与 Git 提交一一对应）</span>
      </div>

      <div v-if="!publishRecords.length" class="empty-records">
        暂无发布记录。点击右上角「发布」并选择一条提交记录。
      </div>

      <div v-else class="record-list">
        <div
          v-for="r in publishRecords"
          :key="r.id"
          class="record-item"
          :class="{ active: r.isActive }"
        >
          <div class="record-top">
            <span v-if="r.isActive" class="active-badge">● 当前发布</span>
            <span class="record-time">{{ r.publishedAt }}</span>
          </div>
          <div class="record-commit">
            <span class="record-hash">{{ r.commitHash }}</span>
            <span class="record-msg">{{ r.commitMessage }}</span>
          </div>
          <div class="record-market">
            <span class="market-cat">{{ r.marketCategory }}</span>
            <p class="market-summary">{{ r.marketSummary }}</p>
          </div>
          <div class="record-ops">
            <button
              v-if="r.isActive"
              type="button"
              class="op-btn"
              @click="factoryStore.unpublishRelease(r.id)"
            >
              取消发布
            </button>
            <button
              v-else
              type="button"
              class="op-btn op-btn--primary"
              @click="republish(r)"
            >
              重新发布此提交
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryAgentDetailPanel' })

const factoryStore = useFactoryStore()
const agent = computed(() => factoryStore.currentAgent)
const publishRecords = computed(() => factoryStore.publishRecords)
const publishedRelease = computed(() => factoryStore.publishedRelease)

function republish(r) {
  factoryStore.publishCommit(r.commitId, {
    category: r.marketCategory,
    summary: r.marketSummary,
  })
  ElMessage.success('已切换为当前发布版本')
}
</script>

<style scoped lang="scss">
.factory-agent-detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(380px, 42%);
  min-width: 300px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  flex-shrink: 0;
  border-bottom: 1px solid #eef0f3;
  background: #fafafa;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: #2f3547;
  }
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 14px 20px;
}

.agent-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  background: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-fallback { font-size: 24px; }
}

.agent-name { font-size: 15px; font-weight: 600; color: #2f3547; }

.agent-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.ver-pill {
  font-size: 11px;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 5px;
  padding: 2px 7px;
}

.published-pill {
  font-size: 10px;
  color: #16a34a;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 5px;
  padding: 1px 6px;
}

.unpublished-pill {
  font-size: 10px;
  color: #9ca3af;
  background: #f7f8fb;
  border-radius: 5px;
  padding: 1px 6px;
}

.agent-desc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.65;
  margin: 12px 0 16px;
}

.section-head { margin-bottom: 10px; }

.section-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
}

.section-hint {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  line-height: 1.5;
}

.empty-records {
  font-size: 12px;
  color: #9ca3af;
  padding: 16px;
  background: #f7f8fb;
  border-radius: 8px;
  line-height: 1.6;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-item {
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;

  &.active {
    border-color: #bbf7d0;
    background: linear-gradient(180deg, #f0fdf4, #fff);
  }
}

.record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.active-badge { font-size: 11px; color: #16a34a; font-weight: 500; }
.record-time { font-size: 11px; color: #9ca3af; }

.record-commit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.record-hash {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6366f1;
}

.record-msg {
  font-size: 12px;
  color: #374151;
  line-height: 1.5;
}

.record-market {
  margin-bottom: 8px;
}

.market-cat {
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.market-summary {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.55;
}

.record-ops {
  display: flex;
  justify-content: flex-end;
}

.op-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  &--primary {
    background: #1c1a21;
    color: #fff;
    border-color: #1c1a21;
  }
}
</style>
