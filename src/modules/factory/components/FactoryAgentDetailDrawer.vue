<template>
  <el-drawer
    :model-value="showAgentDetail"
    title="Agent 详情"
    direction="rtl"
    size="440px"
    append-to-body
    class="factory-agent-drawer"
    @close="factoryStore.closeAgentDetail()"
  >
    <!-- Agent 基本信息 -->
    <div class="agent-profile">
      <div class="agent-avatar">
        <img v-if="agent.icon" :src="agent.icon" alt="" />
        <span v-else class="avatar-fallback">🤖</span>
      </div>
      <div class="agent-info">
        <div class="agent-name">{{ agent.name }}</div>
        <div class="agent-version">
          <span class="ver-pill">{{ agent.version }}</span>
          <span v-if="publishedVersion" class="published-pill">已发布到市场</span>
          <span v-else class="unpublished-pill">未发布</span>
        </div>
      </div>
    </div>
    <p class="agent-desc">{{ agent.description || '暂无描述' }}</p>

    <!-- 版本列表 -->
    <div class="ver-head">
      <span class="ver-title">版本列表</span>
      <span class="ver-count">{{ versions.length }} 个版本</span>
    </div>
    <div class="ver-list">
      <div
        v-for="v in versions"
        :key="v.id"
        class="ver-item"
        :class="{ published: v.published }"
      >
        <div class="ver-row-top">
          <span class="ver-num">{{ v.version }}</span>
          <span class="build-badge" :class="`build-${v.buildStatus}`">{{ v.buildStatusText }}</span>
          <span v-if="v.published" class="pub-badge">● 发布中</span>
          <span class="ver-time">{{ v.time }}</span>
        </div>
        <div class="ver-desc">{{ v.desc }}</div>
        <div class="ver-meta">
          <button type="button" class="meta-link" @click="locate(v)">
            关联记录：{{ shortThread(v) }}
          </button>
          <span v-if="v.publishedAt" class="pub-time">发布于 {{ v.publishedAt }}</span>
        </div>
        <div class="ver-ops">
          <button
            v-if="!v.published"
            type="button"
            class="op-btn op-btn--primary"
            @click="publish(v)"
          >
            发布此版本
          </button>
          <button
            v-else
            type="button"
            class="op-btn"
            @click="factoryStore.unpublishVersion(v.id)"
          >
            取消发布
          </button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { ElDrawer, ElMessage } from 'element-plus'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryAgentDetailDrawer' })

const factoryStore = useFactoryStore()
const showAgentDetail = computed(() => factoryStore.showAgentDetail)
const agent = computed(() => factoryStore.currentAgent)
const versions = computed(() => factoryStore.agentVersions)
const publishedVersion = computed(() => factoryStore.publishedVersion)

function shortThread(v) {
  return v.threadId || '当前会话'
}

function locate(v) {
  if (v.messageId) {
    factoryStore.requestScrollToMessage(v.messageId)
    factoryStore.closeAgentDetail()
  }
}

function publish(v) {
  factoryStore.publishVersion(v.id)
  ElMessage.success(`已将 ${v.version} 发布到市场`)
}
</script>

<style scoped lang="scss">
.agent-profile {
  display: flex;
  align-items: center;
  gap: 14px;
}

.agent-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  background: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-fallback { font-size: 28px; }
}

.agent-name { font-size: 16px; font-weight: 600; color: #2f3547; }

.agent-version {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.ver-pill {
  font-size: 12px;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 5px;
  padding: 2px 8px;
}

.published-pill {
  font-size: 11px;
  color: #16a34a;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 5px;
  padding: 1px 7px;
}

.unpublished-pill {
  font-size: 11px;
  color: #9ca3af;
  background: #f7f8fb;
  border-radius: 5px;
  padding: 1px 7px;
}

.agent-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.7;
  margin: 16px 0 20px;
}

.ver-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef0f3;
}

.ver-title { font-size: 14px; font-weight: 600; color: #2f3547; }
.ver-count { font-size: 12px; color: #9ca3af; }

.ver-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ver-item {
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
  transition: all 0.15s;

  &.published {
    border-color: #bbf7d0;
    background: linear-gradient(180deg, #f0fdf4, #fff);
  }
}

.ver-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ver-num { font-size: 13px; font-weight: 600; color: #2f3547; }

.build-badge {
  font-size: 10px;
  border-radius: 4px;
  padding: 1px 6px;

  &.build-current { color: #6366f1; background: #eef2ff; }
  &.build-tested { color: #0891b2; background: #ecfeff; }
  &.build-draft { color: #9ca3af; background: #f3f4f6; }
}

.pub-badge { font-size: 11px; color: #16a34a; }
.ver-time { font-size: 11px; color: #9ca3af; margin-left: auto; }

.ver-desc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  margin: 8px 0;
}

.ver-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-link {
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  &:hover { text-decoration: underline; }
}

.pub-time { font-size: 11px; color: #16a34a; }

.ver-ops {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.op-btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #d1d5db; }

  &--primary {
    background: #1c1a21;
    color: #fff;
    border-color: #1c1a21;
    &:hover { background: #2e323c; }
  }
}
</style>

<style lang="scss">
.factory-agent-drawer {
  .el-drawer__header {
    margin-bottom: 16px;
    padding: 18px 20px;
    border-bottom: 1px solid #eef0f3;
    font-size: 15px;
    font-weight: 600;
    color: #2f3547;
  }
  .el-drawer__body { padding: 0 20px 24px; }
}
</style>
