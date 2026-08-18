<template>
  <div class="hire-overview">
    <div class="section-title">
      <div class="belt"></div>聘用概览
    </div>
    <div v-if="items.length" class="hire-overview__grid">
      <HireAgentCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @view="handleView"
      />
    </div>
    <div v-else class="hire-overview__empty">暂无聘用数据</div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import HireAgentCard from './HireAgentCard.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  agentId: { type: [String, Number], default: '' },
})

const router = useRouter()

function handleView(id) {
  const currentHistory = router.options.history.state.breadcrumbHistory || []

  // 构建新的历史：保留当前历史 + 添加当前详情页（带 to）
  const newHistory = currentHistory.length > 0
    ? [
        ...currentHistory,
        { label: '数字人详情', to: `/market/my-uploads/agent/${props.agentId}` },
      ]
    : [
        { label: '我的上传', to: '/market/my-uploads' },
        { label: '数字人详情', to: `/market/my-uploads/agent/${props.agentId}` },
      ]

  router.push({
    name: 'UploadAgentDetail',
    params: { id },
    state: {
      breadcrumbHistory: newHistory,
    },
  })
}
</script>

<style lang="scss" scoped>
.section-title {
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  display: flex;
  align-items: center;
  letter-spacing: 0px;
  font-variation-settings: "opsz" auto;
  color: #2F3547;
  margin-bottom: 24px;

  .belt {
    background: #FF684E;
    margin-top: 2px;
    width: 3px;
    height: 14px;
    border-radius: 0px 4px 4px 0px;
    margin-right: 8px;
  }
}

.hire-overview__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.hire-overview__empty {
  font-size: 14px;
  color: #8f959e;
}
</style>
