<template>
  <div class="agent-card" @click="$emit('view', item.id)">
    <div class="card-top">
      <div class="card-icon">
        <img v-if="item.avatar" :src="item.avatar" alt="" />
        <div v-else class="icon-placeholder">{{ item.displayName?.charAt(0) }}</div>
      </div>
      <div class="card-content">
        <div class="card-header">
          <div class="title-row">
            <h3 class="card-title">{{ item.displayName }}</h3>
          </div>
          <el-tag
            :type="item.status === 'published' ? 'success' : 'warning'"
            size="small"
            class="status-tag"
          >
            {{ item.status === 'published' ? '发布中' : '审核中' }}
          </el-tag>
        </div>
        <div class="card-tags" v-if="item.tags && item.tags.length">
          <el-tag
            v-for="tag in item.tags.slice(0, 2)"
            :key="tag"
            size="small"
            effect="plain"
            class="tag-item"
          >
            {{ tag }}
          </el-tag>
        </div>
      </div>
    </div>
    <p class="card-desc">{{ item.description }}</p>
    <div class="card-footer">
      <div class="stats">
        <span v-if="item.statsDownloads != null" class="stat-item">
          <el-icon><Download /></el-icon>
          {{ formatNumber(item.statsDownloads) }}
        </span>
        <span v-if="item.statsStars != null" class="stat-item">
          <el-icon><Star /></el-icon>
          {{ formatNumber(item.statsStars) }}
        </span>
      </div>
      <el-button type="primary" size="small" class="view-btn" round @click.stop="$emit('view', item.id)">
        查看
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { Download, Star } from '@element-plus/icons-vue'

defineProps({
  item: { type: Object, required: true },
})

defineEmits(['view'])

function formatNumber(num) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}
</script>

<style lang="scss" scoped>
.agent-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    border-color: #00d4aa;
    box-shadow: 0 4px 12px rgba(0, 212, 170, 0.15);

    .view-btn {
      opacity: 1;
      visibility: visible;
    }
  }
}

.card-top {
  display: flex;
  gap: 16px;
}

.card-icon {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: visible;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin-top: -32px;

  > img:first-child {
    width: 80px;
    height: 80px;
    border-radius: 12px;
    object-fit: cover;
  }
}

.icon-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  flex-shrink: 0;
  border-radius: 4px;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-item {
  border-radius: 4px;
  background: #f2f3f5;
  border-color: transparent;
  color: #646a73;
}

.card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #646a73;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #8f959e;

  .el-icon {
    font-size: 14px;
  }
}

.view-btn {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  padding: 5px 16px;
  height: 28px;
  border-radius: 8px;
  background-color: #171B26;
  border-color: #171B26;
}
</style>
