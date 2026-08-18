<template>
  <div class="agent-market">
    <!-- Banner 区域 -->
    <!-- <div class="market-banner">
      <div class="banner-left">
        <span class="banner-new">NEW</span>
        <span class="banner-text">组建专属AI数字员工Team，等你来开启~</span>
      </div> 
    </div> -->

    <!-- 提示文案 -->
    <!-- <div class="hint-text">🌟更多数字员工等待开放～</div> -->
     <div class="gent-market-close" @click="emit('close')">
      <img src="@/assets/home/icon-img-open.png" alt="close" class="close-icon">
     </div>


    <!-- 贴图占位（卡片网格暂时隐藏） -->
    <div class="placeholder-wrap">
      <img :src="placeholderImg" alt="" class="placeholder-img" />
    </div>
  </div>
</template>

<script setup>
import { useAgentStore } from '@/modules/agent/store'
import agentBg from '@/assets/home/agent_bg.png'
import placeholderImg from '@/assets/home/agent_p_bg.png'

const emit = defineEmits(['close'])
const agentStore = useAgentStore()

function handleAgentClick(agent) {
}

function handleAddAgent() {
}
</script>

<style scoped>
.agent-market {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
  padding: 0px 48px 0;
  background: #fff url('@/assets/home/agent_bg.png') no-repeat;
  background-size: 100% 100%;
}

/* Banner */
.market-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  overflow: hidden;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banner-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 4px;
  background: #1e293b;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.banner-text {
  font-size: 14px;
  color: var(--text-secondary, #666);
}

.banner-deco {
  position: absolute;
  right: 0;
  top: -20px;
  width: 200px;
  height: auto;
  pointer-events: none;
  opacity: 0.9;
}

.add-agent-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 20px;
  border: 1.5px solid var(--accent, #7c3aed);
  border-radius: 20px;
  background: transparent;
  color: var(--accent, #7c3aed);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  position: relative;
  z-index: 1;
}
.placeholder-wrap {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 150px;

}
.placeholder-wrap .placeholder-img {
  width: 90%;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}


.add-agent-btn:hover {
  background: var(--accent-light, #ede9fe);
}

.add-icon {
  font-size: 16px;
  font-weight: 600;
}

/* 提示文案 */
.hint-text {
  font-size: 13px;
  color: #999;
  margin-bottom: 20px;
}

/* Agent 卡片网格 - 3 列 */
.agent-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-content: start;
  padding-bottom: 32px;
}

.agent-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--border, #e5e7eb);
  background: #fff;
}

.agent-card:hover {
  border-color: rgba(99, 102, 241, 0.25);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.card-bg {
  width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
}

.card-body {
  padding: 16px 20px 20px;
}

.card-avatar-wrap {
  position: relative;
  display: inline-flex;
  margin-bottom: 12px;
}

.card-avatar-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
}

.card-avatar-text {
  font-size: 24px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
}

.gold-badge {
  position: absolute;
  bottom: -2px;
  right: -14px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 10px;
  font-size: 10px;
  color: #b45309;
  font-weight: 600;
  white-space: nowrap;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 6px;
}

.card-desc {
  font-size: 12px;
  color: var(--text-muted, #999);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gent-market-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 22px;
  height: 22px;
  cursor: pointer;
}
.gent-market-close img {
  width: 22px;
  height: 22px;
}

/* @media (max-width: 900px) {
  .agent-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .agent-market {
    padding: 24px 24px 0;
  }
} */
</style>
