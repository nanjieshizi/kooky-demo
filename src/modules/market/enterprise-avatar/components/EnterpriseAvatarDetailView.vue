<template>
  <div class="enterprise-avatar-detail">
    <Breadcrumb
      :items="[
        { label: '企业数字人', to: '/market/enterprise-avatar' },
        { label: `企业数字人 ${avatarId}` }
      ]"
      title="详情"
    />
    <div class="detail-body">
      <h2 class="detail-title">企业数字人详情</h2>
      <p class="detail-description">这里展示单个企业数字人的详细信息。</p>
      <div class="detail-content">
        <p>企业数字人 ID: {{ avatarId }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'

const route = useRoute()
const avatarId = computed(() => route.params.id)
</script>

<style lang="scss" scoped>
.enterprise-avatar-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.detail-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: #2f3547;
}

.detail-description {
  margin: 0 0 24px;
  font-size: 14px;
  color: rgba(47, 53, 71, 0.7);
}

.detail-content {
  padding: 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(132, 120, 250, 0.12);
}
</style>
