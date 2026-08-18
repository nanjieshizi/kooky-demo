<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  keyword: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['click', 'chat'])

function highlightKeyword(text) {
  if (!props.keyword || !text) return text
  const escaped = props.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

const icon = computed(() => {
  switch (props.item.type) {
    case 'solo-team': return '👥'
    case 'collaboration': return '👥'
    case 'contact': return null
    case 'file': return '📄'
    case 'message': return '💬'
    default: return '📋'
  }
})
</script>

<template>
  <div
    class="search-result-item"
    @click="emit('click', item)"
  >
    <div class="item-icon">
      <span v-if="icon">{{ icon }}</span>
      <img v-else-if="item.avatar" :src="item.avatar" class="avatar" />
      <span v-else>👤</span>
    </div>

    <div class="item-content">
      <div class="item-title" v-html="highlightKeyword(item.name || item.roomName)"></div>

      <div v-if="item.type === 'message'" class="item-snippet" v-html="highlightKeyword(item.snippet)"></div>
      <div v-if="item.type === 'file'" class="item-meta">{{ item.spaceId }}</div>
      <div v-if="item.type === 'contact' && item.department" class="item-meta">{{ item.department }}</div>
    </div>

    <div class="item-right">
      <span v-if="item.lastActiveTime || item.timestamp || item.uploadTime" class="item-time">
        {{ formatTime(item.lastActiveTime || item.timestamp || item.uploadTime) }}
      </span>

      <button
        v-if="item.type === 'contact'"
        class="chat-btn"
        @click.stop="emit('chat', item)"
      >
        💬 单聊
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }
}

.item-icon {
  width: 32px;
  height: 32px;
  margin-right: 12px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(mark) {
    background-color: #fff566;
    padding: 0 2px;
  }
}

.item-snippet,
.item-meta {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(mark) {
    background-color: #fff566;
    padding: 0 2px;
  }
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  flex-shrink: 0;
}

.item-time {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}

.chat-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: #f5f5f5;
  }
}
</style>
