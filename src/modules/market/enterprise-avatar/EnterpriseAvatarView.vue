<template>
  <section class="enterprise-avatar-view">
    <div class="market-container">
      <h1 class="market-title">企业数字人</h1>
      <p class="market-description">企业专属数字人管理。</p>
      <div class="market-content">
        <p class="placeholder-text">企业数字人内容开发中...</p>
        <button class="demo-link-btn" @click="goToDetail('demo-enterprise-123')">
          查看示例企业数字人详情
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'EnterpriseAvatarView' })
import { useRouter } from 'vue-router'

const router = useRouter()

function goToDetail(id) {
  router.push({ name: 'EnterpriseAvatarDetail', params: { id } })
}
</script>

<style lang="scss" scoped>
.enterprise-avatar-view {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 32px;
  background: linear-gradient(180deg, #fffaf7 0%, #ffffff 100%);
  overflow-y: auto;
}

.market-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.market-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 600;
  color: #2f3547;
}

.market-description {
  margin: 0 0 32px;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(47, 53, 71, 0.7);
}

.market-content {
  padding: 48px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(132, 120, 250, 0.12);
  text-align: center;
}

.placeholder-text {
  margin: 0 0 16px;
  font-size: 14px;
  color: rgba(47, 53, 71, 0.5);
}

.demo-link-btn {
  padding: 8px 16px;
  border: 1px solid rgba(132, 120, 250, 0.3);
  border-radius: 8px;
  background: rgba(132, 120, 250, 0.08);
  color: #8478fa;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(132, 120, 250, 0.15);
    border-color: rgba(132, 120, 250, 0.5);
  }
}
</style>
