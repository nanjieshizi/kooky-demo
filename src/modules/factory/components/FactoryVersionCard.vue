<template>
  <div
    class="version-card"
    :class="{
      'is-current': isCurrentVersion,
      'is-previewing': isPreviewingThis,
    }"
  >
    <div class="card-header">
      <div class="card-hash">{{ version.hash }}</div>
      <div class="card-badges">
        <span v-if="isCurrentVersion" class="card-status-badge status-current">最新</span>
        <span v-if="isPreviewingThis" class="card-previewing-badge">👁 预览中</span>
      </div>
    </div>

    <div v-if="version.message || version.desc" class="card-desc">{{ version.message || version.desc }}</div>

    <div class="card-footer">
      <span class="card-time">{{ version.time }}</span>
      <el-button
        type="primary"
        size="small"
        link
        @click="handlePreview"
      >
        {{ isPreviewingThis ? '取消预览' : '预览此版本' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryVersionCard' })

const props = defineProps({
  version: {
    type: Object,
    required: true,
  },
})

const factoryStore = useFactoryStore()

const isCurrentVersion = computed(
  () => factoryStore.headCommit?.hash === props.version.hash,
)

const isPreviewingThis = computed(
  () => factoryStore.previewingCommit?.hash === props.version.hash,
)

function handlePreview() {
  if (isPreviewingThis.value) {
    factoryStore.clearPreviewCommit()
  } else {
    const commit = factoryStore.codeCommits.find(c => c.hash === props.version.hash)
    if (commit) factoryStore.previewCommit(commit)
  }
}
</script>

<style scoped lang="scss">
.version-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &.is-current {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.02);
  }

  &.is-previewing {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.02);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-hash {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  flex-shrink: 0;

  &.status-current {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
}

.card-previewing-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  flex-shrink: 0;
  background: #fff3cd;
  color: #b8860b;
  border: 1px solid #ffc107;
}

.card-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-time {
  font-size: 12px;
  color: #9ca3af;
}
</style>
