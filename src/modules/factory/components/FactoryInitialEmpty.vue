<template>
  <div class="factory-initial-empty">
    <div class="empty-card">
      <div class="empty-illu">
        <span class="illu-emoji">🛠️</span>
        <span class="illu-spark spark-1">✦</span>
        <span class="illu-spark spark-2">✦</span>
      </div>
      <h3 class="empty-title">还没有产出</h3>
      <p class="empty-sub">
        在左侧对话框里描述你的需求，或先填写「基础必要条件」，<br />
        我会一步一步把 {{ agentName }} 的工程生成在这里。
      </p>

      <div class="empty-steps">
        <div class="step-item">
          <span class="step-dot">1</span>
          <span class="step-text">描述需求 / 选择必要条件</span>
        </div>
        <div class="step-arrow">→</div>
        <div class="step-item">
          <span class="step-dot">2</span>
          <span class="step-text">实时生成代码工程</span>
        </div>
        <div class="step-arrow">→</div>
        <div class="step-item">
          <span class="step-dot">3</span>
          <span class="step-text">预览调试 / 发布</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFactoryStore } from '../store'

defineOptions({ name: 'FactoryInitialEmpty' })

const factoryStore = useFactoryStore()
const agentName = computed(() => factoryStore.currentAgent?.name || '智能体')
</script>

<style scoped lang="scss">
.factory-initial-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 12px 12px, rgba(99, 102, 241, 0.05) 1.4px, transparent 1.6px) 0 0 / 26px 26px,
    #f4f5f5;
}

.empty-card {
  max-width: 460px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-illu {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 22px;
  background: linear-gradient(135deg, #eef2ff, #faf5ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;

  .illu-emoji { font-size: 40px; }

  .illu-spark {
    position: absolute;
    color: #c4b5fd;
    font-size: 14px;
    animation: twinkle 2.4s ease-in-out infinite;
  }
  .spark-1 { top: 6px; right: 8px; }
  .spark-2 { bottom: 8px; left: 6px; animation-delay: 1.2s; }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}

.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: #2f3547;
  margin: 0 0 8px;
}

.empty-sub {
  font-size: 13px;
  color: #8b8f9a;
  line-height: 1.7;
  margin: 0 0 22px;
}

.empty-steps {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 999px;
}

.step-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.step-text { font-size: 12px; color: #4b5563; white-space: nowrap; }
.step-arrow { color: #c7cad1; font-size: 13px; }
</style>
