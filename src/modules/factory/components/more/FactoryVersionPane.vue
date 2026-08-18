<template>
  <div class="factory-version-pane">
    <div class="vc-header">
      <h2 class="vc-title">版本控制</h2>
      <div class="vc-github-banner">
        <span>没有链接到 GitHub，无法保存代码到云端</span>
        <button type="button" class="link-github">去连接 ↗</button>
      </div>
      <div class="vc-toolbar">
        <div class="branch-select">
          <span class="branch-icon">⎇</span>
          <span class="branch-name">{{ currentBranch }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="branch-caret">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="vc-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input v-model="searchQuery" type="text" placeholder="搜索内容" />
        </div>
        <button type="button" class="date-picker-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          选择日期
        </button>
      </div>
      <p class="vc-workspace-hint">
        工程目录：<code>{{ workspacePath }}</code>
      </p>
    </div>

    <div class="vc-commit-list scrollbar-thin">
      <template v-for="group in filteredGroups" :key="group.date">
        <div class="commit-group-label">{{ group.label }}</div>
        <div
          v-for="c in group.commits"
          :key="c.id"
          class="commit-card"
          :class="{ active: selectedCommitId === c.id, published: isPublishedCommit(c.id) }"
          @click="selectedCommitId = c.id"
        >
          <div class="commit-message">{{ c.message }}</div>
          <div class="commit-meta">
            <span class="commit-hash">{{ c.hash }}</span>
            <span class="commit-author">{{ c.author }}</span>
            <span class="commit-time">{{ c.time }}</span>
            <span v-if="isPublishedCommit(c.id)" class="commit-pub-tag">已发布</span>
            <button
              v-if="c.messageId"
              type="button"
              class="commit-locate"
              @click.stop="locateMessage(c)"
            >
              关联对话
            </button>
          </div>
        </div>
      </template>
      <div v-if="!filteredGroups.length" class="vc-empty">暂无提交记录</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useFactoryStore } from '../../store'
import { groupCommitsByDate } from '../../codeVersionMock'

defineOptions({ name: 'FactoryVersionPane' })

const factoryStore = useFactoryStore()
const currentBranch = ref('main')
const searchQuery = ref('')
const selectedCommitId = ref(null)

const workspacePath = computed(() => factoryStore.projectWorkspacePath)
const commits = computed(() => factoryStore.codeCommits)
const publishedRelease = computed(() => factoryStore.publishedRelease)

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = q
    ? commits.value.filter(
      c => c.message.toLowerCase().includes(q) || c.hash.includes(q),
    )
    : commits.value
  return groupCommitsByDate(list)
})

function isPublishedCommit(commitId) {
  return publishedRelease.value?.commitId === commitId
}

function locateMessage(c) {
  if (c.messageId) factoryStore.requestScrollToMessage(c.messageId)
}
</script>

<style lang="scss" scoped>
.factory-version-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f4f5f5;
}

.vc-header {
  flex-shrink: 0;
  padding: 20px 24px 12px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.vc-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
}

.vc-github-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: #f7f8fb;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;

  .link-github {
    border: none;
    background: transparent;
    color: #6366f1;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    &:hover { text-decoration: underline; }
  }
}

.vc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.branch-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #2f3547;
  cursor: default;
}

.branch-icon { opacity: 0.7; }
.branch-caret { color: #9ca3af; }

.vc-search {
  flex: 1;
  min-width: 160px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;

  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    color: #2f3547;
    background: transparent;
  }
  svg { color: #9ca3af; flex-shrink: 0; }
}

.date-picker-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  &:hover { border-color: #d1d5db; }
}

.vc-workspace-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #9ca3af;
  code {
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    color: #6366f1;
    background: #eef2ff;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

.vc-commit-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 24px 24px;
}

.commit-group-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin: 16px 0 10px;
  &:first-child { margin-top: 0; }
}

.commit-card {
  padding: 14px 16px;
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  &.active {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
  }

  &.published {
    border-color: #bbf7d0;
    background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);
  }
}

.commit-message {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.5;
  margin-bottom: 8px;
}

.commit-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #9ca3af;
}

.commit-hash {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: #6366f1;
}

.commit-pub-tag {
  color: #16a34a;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
}

.commit-locate {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  &:hover { text-decoration: underline; }
}

.vc-empty {
  text-align: center;
  padding: 48px;
  color: #9ca3af;
  font-size: 14px;
}
</style>
