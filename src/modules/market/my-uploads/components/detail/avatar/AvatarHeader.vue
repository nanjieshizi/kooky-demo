<template>
  <div class="avatar-header">
    <div class="avatar-header__left">
      <div class="avatar-header__icon">
        <img v-if="agent.avatar" :src="agent.avatar" alt="" />
        <div v-else class="avatar-header__placeholder">{{ agent.displayName?.charAt(0) }}</div>
        <div v-if="agent.hired" class="avatar-header__hired">
          <img :src="hiredBadgeSvg" alt="已聘用" />
          <span class="avatar-header__hired-text">已聘用</span>
        </div>
      </div>
    </div>
    <div class="avatar-header__right">
      <div class="avatar-header__row1">
        <div class="avatar-header__name-col">
          <h1 class="avatar-header__name">{{ agent.displayName }}</h1>
          <span class="avatar-header__version">v{{ agent.latestVersion?.version }}</span>
        </div>
        <div class="avatar-header__actions">
          <div class="avatar-header__stats">
            <span class="avatar-header__stat">
              <img
                :src="statDownloadIcon"
                class="avatar-header__stat-icon"
                width="14"
                height="14"
                alt=""
                aria-hidden="true"
              />
              {{ formatNumber(agent.statsDownloads || 0) }}
            </span>
            <span class="avatar-header__stat avatar-header__stat--fav">
              <span class="avatar-header__star-icon" aria-hidden="true" :style="starIconMaskStyle" />
              {{ formatNumber(agent.statsStars || 0) }}
            </span>
          </div>
          <!-- <el-button
            :class="['avatar-header__fav-btn', { 'is-fav': agent.isFollowed }]"
            size="small"
            @click="handleToggleFavorite"
          >
            {{ agent.isFollowed ? '已收藏' : '收藏' }}
          </el-button> -->
          <el-button
            v-if="agent.hired"
            class="avatar-header__hire-btn"
            size="small"
            disabled
          >
            已聘用
          </el-button>
          <el-button
            v-else
            class="avatar-header__hire-btn avatar-header__hire-btn--active"
            type="primary"
            size="small"
            @click="handleToggleHire"
          >
            聘用
          </el-button>
        </div>
      </div>
      <div class="avatar-header__row2">
        <div class="avatar-header__tags">
          <el-tag
            v-for="tag in agent.tags"
            :key="tag"
            size="small"
            effect="plain"
            class="avatar-header__tag"
          >
            {{ tag }}
          </el-tag>
        </div>
        <span class="avatar-header__author">@{{ agent.author?.displayName }}</span>
        <p class="avatar-header__desc">{{ agent.summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import statDownloadIcon from '@/assets/market/myupload/stat-download.svg'
import statStarIcon from '@/assets/market/myupload/stat-star.svg'
import hiredBadgeSvg from '@/modules/market/my-uploads/assets/yipinyong.svg'

const props = defineProps({
  agent: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggleHire'])

const starIconMaskStyle = computed(() => ({
  WebkitMaskImage: `url(${statStarIcon})`,
  maskImage: `url(${statStarIcon})`,
}))

function handleToggleHire() {
  emit('toggleHire')
}

function formatNumber(num) {
  if (!num || num === 0) return '0'
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}
</script>

<style lang="scss" scoped>
.avatar-header {
  display: flex;
  gap: 16px;
  background: #fff;
}

.avatar-header__left {
  flex-shrink: 0;
}

.avatar-header__icon {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: visible;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  > img:first-child {
    width: 80px;
    height: 80px;
    border-radius: 12px;
    object-fit: cover;
  }
}

.avatar-header__placeholder {
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

.avatar-header__hired {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 45px;
  height: 30.5px;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
  }
}

.avatar-header__hired-text {
  position: relative;
  z-index: 1;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  transform: rotate(-6deg);
  margin-top: -2px;
}

.avatar-header__right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatar-header__row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.avatar-header__name-col {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.avatar-header__name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar-header__version {
  flex-shrink: 0;
  font-size: 13px;
  color: #8f959e;
}

.avatar-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.avatar-header__stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-header__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8f959e;
}

.avatar-header__stat-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.avatar-header__stat--fav {
  color: #8f959e;
  font-size: 12px;
}

.avatar-header__star-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.avatar-header__fav-btn {
  width: 60px;
  height: 32px;
  border-radius: 6px;
  opacity: 1;

  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 5px 16px;
  gap: 8px;

  background: #FFFFFF;

  box-sizing: border-box;
  border: 1px solid #DFE2EA;

  &.is-fav {
    color: #f7ba2a;
    border-color: #f7ba2a;
    background: #fef8e7;
  }
}

.avatar-header__hire-btn {
  width: 60px;
  height: 32px;
  border-radius: 6px;
  opacity: 1;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 5px 16px;
  gap: 8px;
  background: #171B26;
  z-index: 1;

  &--active {
    background-color: #171b26;
    border-color: #171b26;
  }
}

.avatar-header__row2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.avatar-header__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.avatar-header__tag {
  border-radius: 4px;
  background: #f2f3f5;
  border-color: transparent;
  color: #646a73;
}

.avatar-header__author {
  font-size: 13px;
  color: #8f959e;
}

.avatar-header__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #646a73;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  width: 100%;
}
</style>
