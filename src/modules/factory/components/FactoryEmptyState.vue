<template>
  <div class="factory-empty">
    <div class="content-wrapper">
      <!-- 中心角色 + 环绕气泡 -->
      <div class="character-section">
        <div class="center-character">
          <img :src="characterImg" alt="Kooky" class="character-img" />
        </div>

        <div class="tip-bubble tip-1">
          <span class="tip-text">🛠️ 一句话描述，帮你造出一个 Agent</span>
        </div>
        <div class="line">
          <img :src="lineImg" alt="line" />
        </div>
        <div class="tip-bubble tip-2">
          <span class="tip-text">技能、数据、集成 一站配齐 ☄️</span>
        </div>
        <div class="tip-bubble tip-3">
          <span class="tip-text">边对话 ☕️ 边生成代码工程</span>
        </div>
        <div class="tip-bubble tip-4">
          <span class="tip-text">在线预览调试，所见即所得 🤖</span>
        </div>
        <div class="tip-bubble tip-5">
          <span class="tip-text">版本管理 👫 一键发布到市场</span>
        </div>
        <div class="tip-bubble tip-6">
          <span class="tip-text">为你沉淀 💫 专属数字员工</span>
        </div>
      </div>

      <!-- 标题 -->
      <div class="title-section">
        <h1 class="title-text">智能体<span class="title-accent">工厂</span></h1>
        <p class="title-sub">通过对话一步步生成、调试并发布你的专属 Agent</p>
      </div>

      <!-- 创建按钮 -->
      <button type="button" class="create-btn" @click="factoryStore.openCreateModal()">
        新建智能体
      </button>
    </div>
  </div>
</template>

<script setup>
import { useFactoryStore } from '../store'
import characterImg from '@/assets/collaboration/assistant_bg.png'
import lineImg from '@/assets/collaboration/line.png'

defineOptions({ name: 'FactoryEmptyState' })

const factoryStore = useFactoryStore()
</script>

<style lang="scss" scoped>
.factory-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #F5F5FF 0%, #FFFFFF 100%);
  overflow: auto;
  position: relative;
  border-radius: 12px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: url('@/assets/soloTeam/bg.png') no-repeat center top;
    background-size: cover;
    z-index: 0;
  }
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 900px;
  width: 100%;
  position: relative;
  z-index: 1;
  padding: 40px 20px;
}

.character-section {
  position: relative;
  width: 100%;
  height: 348px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.center-character {
  position: relative;
  z-index: 2;

  .character-img {
    width: auto;
    height: 300px;
    object-fit: contain;
    filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.1));
    animation: slideUp 3s ease-out forwards;
  }
}

.tip-bubble {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  border-radius: 60px;
  padding: 8px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1;
  opacity: 0;
  animation: bubbleIn 1.5s ease-out forwards;
  backdrop-filter: blur(5px) saturate(100%);
  border: 1px solid #fff;
  background: linear-gradient(180deg, rgba(216, 216, 216, 0.5) 0%, rgba(248, 248, 250, 0.5) 99%);
  box-sizing: border-box;
}

.line {
  position: absolute;
  left: 180px;
  top: 59px;
  opacity: 0;
  animation: bubbleIn 1.5s ease-out forwards;
  img {
    width: 45px;
    height: 45px;
    transform: rotate(-10.06deg) scale(1.2);
  }
}

.tip-text {
  font-size: 12px;
  line-height: 1.4;
  color: #2F3547;
  white-space: nowrap;
}

.tip-1, .tip-2, .tip-5, .line { animation-delay: 0s; }
.tip-3, .tip-4, .tip-6 { animation-delay: 1.2s; }

.tip-1 { top: 10px; left: -15px; }
.tip-2 { top: 145px; left: -40px; }
.tip-3 { bottom: 30px; left: 28px; }
.tip-4 { top: 50px; right: 20px; }
.tip-5 { top: 155px; right: -28px; }
.tip-6 { bottom: 55px; right: 16px; }

@keyframes slideUp {
  0% { transform: translateY(20px); opacity: 0.8; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes bubbleIn {
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

.title-section {
  margin-top: -56px;
  margin-bottom: 22px;
  text-align: center;
}

.title-text {
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #1a1a1a;
  line-height: 1.2;
}

.title-accent {
  background: linear-gradient(90deg, #FF8670 0%, #AD85FF 55%, #77C9FB 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-left: 4px;
}

.title-sub {
  margin: 12px 0 0;
  font-size: 14px;
  color: #8d93a6;
}

.create-btn {
  padding: 14px 48px;
  background:
    linear-gradient(#000, #000) padding-box,
    linear-gradient(90deg, #FF8670 0%, #AD85FF 55%, #77C9FB 100%) border-box;
  border: 4px solid transparent;
  border-radius: 20px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(173, 133, 255, 0.3);

  &:hover {
    transform: scale(1.05) translateY(-2px);
    box-shadow: 0 12px 32px rgba(173, 133, 255, 0.4);
  }

  &:active {
    transform: scale(1.02) translateY(0);
  }
}
</style>
