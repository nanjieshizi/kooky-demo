<template>
  <div v-if="node" class="trace-detail">
    <!-- 知识库节点 -->
    <template v-if="node.kind === 'kb'">
      <div class="detail-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="header-icon">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span class="detail-title">{{ node.name }}</span>
        <span class="detail-badge success">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          命中 {{ node.hits.length }}
        </span>
        <span class="detail-badge info">向量检索</span>
      </div>

      <div class="detail-meta">
        <span class="meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          耗时 {{ node.duration }}
        </span>
        <span class="meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          top_k = {{ node.topK }}
        </span>
        <span class="meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          阈值 {{ node.threshold }}
        </span>
      </div>

      <div class="kb-section">
        <div class="section-title">检索 Query</div>
        <div class="code-block">
          <span class="code-string">"{{ node.query }}"</span>
        </div>
      </div>

      <div class="kb-section">
        <div class="kb-section-header">
          <span class="section-title">命中片段</span>
          <span class="section-hint">按相似度降序</span>
        </div>
        <div class="kb-hits">
          <div v-for="(hit, i) in node.hits" :key="i" class="kb-hit-card">
            <div class="hit-header">
              <span class="hit-index">{{ i + 1 }}</span>
              <svg
                v-if="hit.type === 'file'"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="hit-icon"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <svg
                v-else
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="hit-icon"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span class="hit-src">{{ hit.src }}</span>
              <span class="hit-score">{{ hit.score.toFixed(3) }}</span>
            </div>
            <div class="hit-snippet">{{ hit.snippet }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- 通用节点 -->
    <template v-else>
      <div class="detail-header">
        <span class="detail-title">{{ node.name }}</span>
        <span class="detail-badge" :class="node.status === 'success' ? 'success' : 'error'">
          <svg v-if="node.status === 'success'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          {{ node.status === 'success' ? '成功' : '失败' }}
        </span>
        <button type="button" class="header-action" @click="onViewCode">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          查看代码
        </button>
      </div>

      <div class="detail-meta">
        <span class="meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          耗时 {{ node.duration }}
        </span>
        <span class="meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          消耗 {{ node.tokenUsage || '–' }}
        </span>
        <span class="meta-item runid">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
          <code class="runid-code">{{ node.runId || '—' }}</code>
          <button type="button" class="copy-btn" :title="`复制 ${node.runId}`" @click="copyRunId">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </span>
      </div>

      <div class="io-grid">
        <div class="io-section">
          <div class="section-title">输入</div>
          <pre class="code-block io-code">{{ node.input }}</pre>
        </div>
        <div class="io-section">
          <div class="section-title">输出</div>
          <pre class="code-block io-code">{{ node.output }}</pre>
        </div>
      </div>
    </template>
  </div>
  <div v-else class="trace-detail-empty">
    <span>请选择左侧节点查看详情</span>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'

defineOptions({ name: 'FactoryTraceDetail' })

const props = defineProps({
  node: { type: Object, default: null },
})

async function copyRunId() {
  if (!props.node?.runId) return
  try {
    await navigator.clipboard.writeText(props.node.runId)
    ElMessage.success('已复制 Run ID')
  } catch {
    ElMessage.error('复制失败')
  }
}

function onViewCode() {
  ElMessage.info('查看代码功能尚未实现')
}
</script>

<style lang="scss" scoped>
.trace-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 20px;
  background: #fff;
}

.trace-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #9ca3af;
  background: #fff;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.header-icon {
  color: #6366f1;
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.detail-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;

  &.success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  &.info {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }
}

.header-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    color: #6366f1;
  }
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 11px;
  color: #6b7280;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &.runid {
    gap: 6px;
  }
}

.runid-code {
  background: #f3f4f6;
  color: #6b7280;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
}

.copy-btn {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f3f4f6;
    color: #6366f1;
  }
}

.io-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.io-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
}

.code-block {
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 10px 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: #374151;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.io-code {
  max-height: 220px;
}

.code-string {
  color: #16a34a;
}

.kb-section {
  margin-top: 12px;
}

.kb-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-hint {
  font-size: 10px;
  color: #9ca3af;
}

.kb-hits {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kb-hit-card {
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 0.15s;

  &:hover {
    border-color: #e5e7eb;
  }
}

.hit-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.hit-index {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-size: 10px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 600;
  flex-shrink: 0;
}

.hit-icon {
  color: #9ca3af;
  flex-shrink: 0;
}

.hit-src {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hit-score {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f9fafb;
  color: #6366f1;
  font-size: 10px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  flex-shrink: 0;
}

.hit-snippet {
  padding-left: 22px;
  font-size: 11px;
  line-height: 1.6;
  color: #6b7280;
}
</style>
