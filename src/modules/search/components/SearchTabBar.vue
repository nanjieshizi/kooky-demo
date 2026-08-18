<script setup>
import { computed } from 'vue'

const props = defineProps({
  activeTab: {
    type: String,
    default: 'all'
  },
  results: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:activeTab'])

const totalCount = computed(() => {
  return (props.results.soloTeams?.length || 0) +
    (props.results.collaborations?.length || 0) +
    (props.results.messages?.length || 0) +
    (props.results.contacts?.length || 0) +
    (props.results.files?.length || 0)
})

const tabs = computed(() => [
  { key: 'all', label: '综合', count: totalCount.value },
  { key: 'solo-team', label: '一人团队', count: props.results.soloTeams?.length || 0 },
  { key: 'collaboration', label: '协作', count: props.results.collaborations?.length || 0 },
  { key: 'message', label: '消息记录', count: props.results.messages?.length || 0 },
  { key: 'contact', label: '联系人', count: props.results.contacts?.length || 0 },
  { key: 'file', label: '文件', count: props.results.files?.length || 0 }
])

function handleTabClick(tabKey) {
  emit('update:activeTab', tabKey)
}
</script>

<template>
  <div class="search-tab-bar">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: activeTab === tab.key }"
      @click="handleTabClick(tab.key)"
    >
      {{ tab.label }}
      <span v-if="tab.count > 0" class="tab-count">({{ tab.count }})</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-tab-bar {
  display: flex;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e5e5;
  background: white;
  overflow-x: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tab-item {
  font-size: 13px;
  color: #666;
  cursor: pointer;
  padding: 10px 12px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: #333;
  }

  &.active {
    color: #1890ff;
    border-bottom-color: #1890ff;
    font-weight: 500;
  }
}

.tab-count {
  margin-left: 3px;
  font-size: 12px;
  font-weight: normal;
}
</style>
