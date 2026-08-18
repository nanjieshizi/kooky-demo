<template>
  <div class="create-team-view">
    <!-- 右上角图标 -->
    <div class="top-right-icons">
      <button
        class="icon-btn"
        :class="{ active: uiStore.isAgentPanelOpen }"
        title="Agent市场"
        @click="uiStore.toggleRightPanel('agent')"
      >
        <img :src="agentIcon" alt="Agent市场" class="icon-img" />
      </button>
    </div>
    <div class="create-team-content">
      <!-- Hero image: 循环切换 g_heade1 / g_header2 -->
      <div class="team-hero">
        <img :src="currentHeroImg" :key="heroIndex" alt="hero" class="team-hero-img" />
      </div>

      <!-- Title with capability tag -->
      <div class="team-title-row">
        <h1 class="team-title">创建超级团队，在这里可以</h1>
        <span class="capability-tag" :style="{ background: currentGradient }">
          <span class="capability-text">{{ currentCapability }}</span>
          <img :src="jianTouIcon" alt="" class="capability-arrow" />
        </span>
      </div>

      <!-- Members row -->
      <div class="members-row">
        <div class="member-avatars">
          <span class="member-label" :style="{ background: '#dcfce7', color: '#16a34a' }">PMO</span>
          <span class="member-label" :style="{ background: '#dbeafe', color: '#2563eb' }">我</span>
          <button class="member-add-btn">
            <img :src="jiaIcon" alt="add" class="member-add-icon" />
          </button>
        </div>
        <span class="members-text">打造自己的Super Team</span>
      </div>

      <!-- Expert cards -->
      <div class="expert-cards">
        <div v-for="expert in experts" :key="expert.name" class="expert-card">
          <img :src="expert.avatar" alt="" class="expert-avatar" />
          <div class="expert-info">
            <div class="expert-name">{{ expert.name }}</div>
            <div class="expert-desc">{{ expert.desc }}</div>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <div class="input-wrapper" :class="{ focused: inputFocused }">
          <input
            v-model="inputValue"
            type="text"
            class="team-input"
            placeholder="输入你的团队名称"
            @focus="inputFocused = true"
            @blur="inputFocused = false"
            @keydown.enter="handleCreate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import heroImg1 from '@/assets/home/g_heade1.png'
import heroImg2 from '@/assets/home/g_header2.png'
import pmImg from '@/assets/home/product.png'
import finopsImg from '@/assets/home/cloud_analysis.png'
import testImg from '@/assets/home/testing.png'
import jianTouIcon from '@/assets/home/jian_tou_icon.png'
import jiaIcon from '@/assets/home/jia.png'
import agentIcon from '@/assets/home/agent_icon.svg'

const emit = defineEmits(['created'])

const uiStore = useUIStore()

const inputValue = ref('')
const inputFocused = ref(false)

// Hero 图片循环切换
const heroImages = [heroImg1, heroImg2]
const heroIndex = ref(0)
const currentHeroImg = computed(() => heroImages[heroIndex.value])

// 能力标签循环
const capabilities = ['做设计', '写代码', '做测试', '写文档', '分析数据']
const capabilityIndex = ref(0)
const currentCapability = computed(() => capabilities[capabilityIndex.value])

const tagGradients = [
  'linear-gradient(90deg, #F386BE 0%, #8478FA 52%, #77C9FB 98%)',
  'linear-gradient(90deg, #81CDFE -48%, #F284AB 17%, #FD9159 92%)',
  'linear-gradient(90deg, #3A94E8 0%, #72E1C9 100%)',
]
const gradientIndex = ref(0)
const currentGradient = computed(() => tagGradients[gradientIndex.value])

// 专家卡片
const experts = [
  { name: '产品经理', desc: '赋能产品全流程，需求分析、PRD、原型设计', avatar: pmImg },
  { name: '测试专家', desc: '从设计执行到专项测试，全流程测试智能护航', avatar: testImg },
  { name: '云分析助手', desc: '云资源全生命周期操作和云成本优化', avatar: finopsImg },
]

let timer = null
onMounted(() => {
  timer = setInterval(() => {
    capabilityIndex.value = (capabilityIndex.value + 1) % capabilities.length
    heroIndex.value = (heroIndex.value + 1) % heroImages.length
    // 随机切换渐变色
    let next
    do {
      next = Math.floor(Math.random() * tagGradients.length)
    } while (next === gradientIndex.value && tagGradients.length > 1)
    gradientIndex.value = next
  }, 2000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const creating = ref(false)

</script>

<style scoped>
.create-team-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: #ffffff url('@/assets/home/creat_team_bg.png') no-repeat;
  position: relative;
  background-size: 100% 100%;
}

/* 右上角图标 */
.top-right-icons {
  position: absolute;
  top: 16px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: var(--bg-tertiary, #f0f0f0);
  color: var(--text-primary, #1a1a1a);
}

.icon-btn.active {
  background: var(--accent-light, #ede9fe);
  color: var(--accent, #7c3aed);
}

.icon-img {
  width: 20px;
  height: 20px;
}

.create-team-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  max-width: 1114px;
  padding: 0 40px;
}

/* Hero 图片切换动画 */
.team-hero {
  margin-bottom: 20px;
}

.team-hero-img {
  width: 200px;
  height: auto;
  display: block;
}

/* Title row */
.team-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.team-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.capability-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 20px;
  border-radius: 4px 16px 16px 16px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  transition: all 0.3s ease;
  position: relative;
}

.capability-arrow {
  position: absolute;
  right: -20px;
  top: 20px;
  width: 20px;
  height: auto;
  pointer-events: none;
}

/* Members row */
.members-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 28px;
}

.member-avatars {
  display: flex;
  align-items: center;
}

.member-label {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.member-label + .member-label,
.member-label + .member-add-btn {
  margin-left: -10px;
}

.member-add-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px dashed #CAD5E1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  position: relative;
  background: #F8FAFC;
}

.member-add-icon {
  width: 15px;
  height: 15px;
}

.members-text {
  font-size: 15px;
  color: #666;
  margin-left: 4px;
}

/* Expert cards */
.expert-cards {
  display: flex;
  gap: 20px;
  width: 100%;
  margin-bottom: 32px;
}

.expert-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: #F7F7F7;
  min-width: 0;
}

.expert-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.expert-info {
  flex: 1;
  min-width: 0;
}

.expert-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.expert-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Input area */
.input-area {
  display: flex;
  align-items: center;
  width: 100%;
  margin-left: 50px;
  justify-content: flex-end;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  border-radius: 20px;
  background: #F7F7F7;
  padding: 11px 18px 11px 13px;
  max-width: 784px;

}

.team-input {
  flex: 1;
  font-size: 14px;
  color: #2F3547;
  letter-spacing: normal;
  outline: none;
  border-radius: 20px;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 2px solid #E3E3E3;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.03);
  height: 54px;
  padding: 0 22px;
  margin-right: 12px;
  transition: all 0.3s ease;
}

.input-wrapper.focused .team-input {
  border: 2px solid transparent;
  background-image: linear-gradient(#fff, #fff), linear-gradient(90deg, #F386BE 0%, #8478FA 52%, #77C9FB 98%);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.03);
}

.team-input::placeholder { color: #999999; }

/* Send button */
.send-btn {
  width: 28px;
  height: 28px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  flex-shrink: 0;
  transition: all 0.2s ease;
  border-radius: 9.6px;
  background: rgba(2, 2, 2, 0.5);
  border: none;
}

.send-btn.active {
  background: #020202;
  cursor: pointer;
}

.send-icon {
  width: 16px;
  height: 16px;
}

.send-btn.active:hover { transform: scale(1.05); }
</style>
