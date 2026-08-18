<template>
  <div class="personal-intro">
    <div class="intro-content">
      <!-- Guide + Title overlay -->
      <div class="guide-wrapper">
        <!-- <img v-if="guideImgSrc" :src="guideImgSrc" alt="guide" class="guide-img" /> -->
        <div class="intro-title-wrap">
          <img src="@/assets/home/snow.png" alt="kooky" class="snow-img" draggable="false" />
          <img src="@/assets/home/new-title.png" alt="title" class="intro-title-img" draggable="false" />
        </div>
      </div>

      <!-- AI message bubble -->
      <!-- <div class="ai-message">
        <img src="@/assets/home/heade_icon.svg" alt="crab" class="ai-avatar" />
        <div class="ai-bubble">
          你好，你可以叫我小king，也可以给我起一个心仪的名字；你希望我是什么样的合作者？
        </div>
      </div> -->

      <!-- Feature cards -->
      <div class="feature-cards">
        <div ref="cardsStageRef" class="feature-cards-stage">
          <div class="feature-card card-1" @click="fillPrompt(1)">
            <!-- 智能需求拆解 -->
            <img src="@/assets/home/card_1.png" alt="feature-1" class="feature-card-img" draggable="false"/>
          </div>
          <div class="feature-card card-2" @click="fillPrompt(2)">
            <!-- 我的分身 -->
            <img src="@/assets/home/card_2.png" alt="feature-2" class="feature-card-img" draggable="false"/>
            <!-- kooky 停止态：锚定 card-2，避免随窗口缩放跑位 -->
            <img
              src="@/assets/home/kooky_stop.png"
              alt="kooky-stop"
              class="kooky-stop"
              draggable="false"
            />
          </div>
          <div class="feature-card card-3" @click="fillPrompt(3)">
            <!-- 成本智能洞察 -->
            <img src="@/assets/home/card_3.png" alt="feature-3" class="feature-card-img" draggable="false"/>
          </div>
          <div class="feature-card card-4" @click="fillPrompt(4)">
            <img src="@/assets/home/card_4.png" alt="feature-4" class="feature-card-img" draggable="false"/>
            <!-- kooky 起跑锚点：card-4 右上角 -->
            <span ref="card4AnchorRef" class="card4-anchor" aria-hidden="true" />
          </div>

          <!-- kooky 循环动画 gif -->
          <img
            src="@/assets/home/kooky_run.gif"
            alt="kooky"
            class="kooky-runner"
            :style="kookyRunnerStyle"
            draggable="false"
          />
        </div>
      </div>

      <!-- Input area -->
      <DeerflowInput
        placeholder="你可以输入任何你想做的事情，也可以给我起一个你心仪的名字"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDeerflowChatStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import DeerflowInput from './DeerflowInput.vue'

const props = defineProps({
  threadId: { type: Number, default: null }
})

// 父组件（DeerflowChatPanel）走本地 demo-server 时，不调 createThread/路由跳转，
// 而是 emit 'submit' 让父级接管
const emit = defineEmits(['submit'])

const router = useRouter()
const store = useDeerflowChatStore()
const uiStore = useUIStore()

const cardsStageRef = ref(null)
const card4AnchorRef = ref(null)

const kookyRunnerPos = ref({ left: 0, top: 0 })
const kookyRunnerReady = ref(false)

const kookyRunnerStyle = computed(() => ({
  left: `${kookyRunnerPos.value.left}px`,
  top: `${kookyRunnerPos.value.top}px`,
  visibility: kookyRunnerReady.value ? 'visible' : 'hidden',
}))

function updateKookyRunnerStart() {
  const stageEl = cardsStageRef.value
  const anchorEl = card4AnchorRef.value
  if (!stageEl || !anchorEl) return

  const stageRect = stageEl.getBoundingClientRect()
  const anchorRect = anchorEl.getBoundingClientRect()

  const OFFSET_X = 70
  const OFFSET_Y = -74

  kookyRunnerPos.value = {
    left: anchorRect.left - stageRect.left - OFFSET_X,
    top: anchorRect.top - stageRect.top + OFFSET_Y,
  }

  if (!kookyRunnerReady.value) kookyRunnerReady.value = true
}

let resizeObserver

onMounted(async () => {
  await nextTick()
  updateKookyRunnerStart()

  window.addEventListener('resize', updateKookyRunnerStart, { passive: true })

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => updateKookyRunnerStart())
    if (cardsStageRef.value) resizeObserver.observe(cardsStageRef.value)
    if (card4AnchorRef.value?.parentElement) resizeObserver.observe(card4AnchorRef.value.parentElement)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateKookyRunnerStart)
  resizeObserver?.disconnect?.()
})

const CARD_PROMPTS = {
  1: '帮我做一个[登录]页面的可交互原型',
  2: '请介绍你的能力，能帮我做什么事情',
  3: '请帮我围绕「职场沟通技巧」进行头脑风暴，从多个角度发散思考，列出尽可能多的创意方案',
  4: '请帮我生成测试用例。 需求描述：[在这里描述你的功能需求]',
}

function fillPrompt(cardIndex) {
  store.pendingPrefillText = CARD_PROMPTS[cardIndex]
}

async function handleSubmit({ text, files, mode, model, skills }) {
  if (!text?.trim() && !files?.length && !skills?.length) return

  // 本地 demo-server 模式：直接 emit 让父级（DeerflowChatPanel）走自己的 streamFromDemoServer
  // 不调 store.createThread（远程 BFF 接口，dev mode 下 404）
  emit('submit', { text, files, mode, model, skills })
}
</script>

<style scoped>
.personal-intro {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: #ffffff;
  position: relative;
}

.personal-intro::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;

  /* 波点背景：上方更明显，向下渐隐，约 50% 高度消失 */
  background-image: radial-gradient(circle, rgba(255, 151, 133, 0.28) 1.2px, transparent 1.3px);
  background-size: 22px 22px;
  background-position: 0 0;

  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0) 50%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0) 50%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.intro-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 0 20px;
  position: relative;
  z-index: 1;
}

/* Guide + Title overlay wrapper */
.guide-wrapper {
  position: relative;
  /* width: 65%; */
  max-width: 865.6px;
  margin-bottom: 40px;
}

.intro-title-wrap {
  position: relative;
  width: 364px;
  max-width: 90%;
  margin: 0 auto;
}

/* Title image (2x: 1050×164) */
.intro-title-img {
  display: block;
  width: 100%;
  margin-top: 28px;
  height: auto;
  z-index: 1;
}

.snow-img {
  width: 24px;
  height: 24px;
  position: absolute;
  left: 56px;
  top: 0px;
  transform: translateX(-50%);
  animation: snow-spin 2s linear 1 forwards;
}

@keyframes snow-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes card-2-land {
  /* 缓慢上浮 */
  0% { transform: translateX(-45px) rotate(0deg); }
  40% { transform: translateX(-45px) rotate(0deg) translateY(-4px); }
  65% { transform: translateX(-45px) rotate(0deg) translateY(-8px); }
  /* 还在上浮，没到顶点就被螃蟹踩下 */
  78% { transform: translateX(-45px) rotate(0deg) translateY(-10px); }
  86% { transform: translateX(-45px) rotate(0deg) translateY(8px); }
  /* 弹回原位 */
  100% { transform: translateX(-45px) rotate(0deg); }
}

@keyframes card-3-land {
  /* 缓慢上浮 */
  0% { transform: translateX(-122px) translateY(40px) rotate(-6deg); }
  30% { transform: translateX(-122px) translateY(36px) rotate(-6deg); }
  50% { transform: translateX(-122px) translateY(32px) rotate(-6deg); }
  /* 还在上浮，没到顶点就被螃蟹踩下 */
  58% { transform: translateX(-122px) translateY(30px) rotate(-6deg); }
  68% { transform: translateX(-122px) translateY(48px) rotate(-6deg); }
  /* 弹回原位 */
  100% { transform: translateX(-122px) translateY(40px) rotate(-6deg); }
}
/* Guide image (2x: 1082×262) */
.guide-img {
  width: 100%;
  height: auto;
  display: block;
  /* 防止缩放模糊，Mac Retina / HiDPI 高质量插值 */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: high-quality;
}

/* Feature cards */
.feature-cards {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 70px;
}

.feature-cards-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 725px;
  max-width: 100%;
  padding: 0px 0px 20px 150px;
  position: relative;
  transform-origin: top center;
  will-change: transform;
}

.feature-card {
  width: 214px;
  height: 234px;
  border-radius: 16px;
  /* background: #F5F6F9; */
  /* border: 1px solid #E6E6E6; */
  flex-shrink: 0;
  /* box-shadow: 6px 6px 12px #efefef; */
  /* overflow: hidden; */
}

.card-1 {
  background: #87E7FF;
  transform: translateY(20px) rotate(10deg);
  transform-origin: center center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 4px 2px 30px #ccc;
}


.card-2 {
  background: #000;
  transform: translateX(-45px) rotate(0deg);
  position: relative;
  z-index: 20;
  transition: transform 0.15s ease;
  animation: card-2-land 5s ease-out 1;
  box-shadow: 6px 6px 18px #ccc;
}

.card-3 {
  background: #fff;
  transform: translateX(-122px) translateY(40px) rotate(-6deg);
  transform-origin: center center;
  z-index: 30;
  transition: transform 0.15s ease;
  animation: card-3-land 5s ease-out 1;
  box-shadow: 6px 6px 30px #e6e6e6;
}


.card-4 {
  background: #C5A7FF;
  transform: translateX(-170px) translateY(0px) rotate(5deg);
  transform-origin: center center;
  z-index: 40;
  transition: transform 0.15s ease;
  box-shadow: 10px 5px 16px #e6e6e6;
  position: relative;
}

.card4-anchor {
  position: absolute;
  right: 0;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.card-1:hover {
  box-shadow: 0px -10px 20px 0px rgba(0, 212, 255, 0.3), 0px 15px 20px 0px #90C6FF, 10px 20px 40px 0px rgba(111, 111, 111, 0.15);
}

.card-2:hover {
  box-shadow: 0px -10px 20px 0px rgba(255, 140, 50, 0.35), 0px 15px 20px 0px rgba(255, 180, 80, 0.4), 10px 20px 40px 0px rgba(111, 111, 111, 0.15);
}

.card-3:hover {
  box-shadow: 0px -10px 20px 0px rgba(59, 180, 255, 0.25), 0px 15px 20px 0px rgba(100, 200, 255, 0.35), 10px 20px 40px 0px rgba(111, 111, 111, 0.15);
}

.card-4:hover {
  box-shadow: 0px -10px 20px 0px rgba(150, 80, 255, 0.3), 0px 15px 20px 0px rgba(197, 167, 255, 0.5), 10px 20px 40px 0px rgba(111, 111, 111, 0.15);
}

.card-1:active {
  transform: translateY(20px) rotate(10deg) scale(0.95);
}

.card-2:active {
  transform: translateX(-45px) rotate(0deg) scale(0.95);
}

.card-3:active {
  transform: translateX(-122px) translateY(40px) rotate(-6deg) scale(0.95);
}

.card-4:active {
  transform: translateX(-170px) translateY(0px) rotate(5deg) scale(0.95);
}

/* AI message */
.ai-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin-bottom: 28px;
  padding-left: 197px;
  box-sizing: border-box;
}

.ai-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
}

.ai-bubble {
  padding: 9px 16px;
  font-size: 14px;
  color: #2F3547;
  line-height: 1.6;
  line-height: 22px;
  letter-spacing: normal;
  /* 文本色&图标色/--color-text-primary */
  /* 样式描述：一级文本色 */
  border-radius: 0px 16px 16px 16px;
background: #F7F7F7;
}


.feature-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px;
  display: block;
}

/* kooky 路径：card-4顶部 → card-3顶部 → card-2顶部 → card-2底部中间
 * 坐标系：.feature-cards position:relative，起点 right:0
 * card 宽214，gap16，各自有 translateX offset
 */
.kooky-runner {
  position: absolute;
  /* left/top 由 card-4 锚点实时计算，避免窗口缩放跑位 */
  width: 80px;
  height: auto;
  z-index: 25;
  pointer-events: none;
  /* 延迟 1s 后显示并开始横向跑动（无下落动画） */
  animation: kooky-fly 4s linear 1 forwards;
  animation-delay: 1s;
  animation-fill-mode: both;
}

.kooky-stop {
  position: absolute;
  left: 50%;
  bottom: 36px;
  width: 80px;
  height: auto;
  z-index: 25;
  pointer-events: none;
  transform: translateX(-50%);
  opacity: 0;
  /* 延迟(1s) + 跑动(4s) 结束后再出现停止态 */
  animation: kooky-show 0.2s ease 5s 1 forwards;
  transition: transform 0.15s ease;
}

.card-2:active .kooky-stop {
  transform: translateX(-50%) scale(0.95);
}

@keyframes kooky-show {
  to { opacity: 1; }
}

@keyframes kooky-fly {
  /* ── card-4 顶部小弹跳前进 ── */
  0% {
    transform: translate(0px, 0px) scale(1.2);
    opacity: 0;
  }
  1% {
    transform: translate(0px, 0px) scale(1.2);
    opacity: 1;
  }
  5% {
    transform: translate(-25px, -4px) scale(1.2);
    opacity: 1;
  }
  10% {
    transform: translate(-50px, -6px) scale(1.2);
    opacity: 1;
  }
  15% {
    transform: translate(-90px, -10px) scale(1.2);
    opacity: 1;
  }
  20% {
    transform: translate(-120px, -12px) scale(1.2);
    opacity: 1;
  }
  /* ── 大弹跳：起跳 → 抛物线 → 落地 card-3 ── */
  22% {
    transform: translate(-130px, -30px) scale(1.2);
    opacity: 1;
  }
  24% {
    transform: translate(-180px, -50px) scale(1.2);
    opacity: 1;
  }
  26% {
    transform: translate(-230px, -30px) scale(1.2);
    opacity: 1;
  }
  28% {
    transform: translate(-240px, -12px) scale(1.2);
    opacity: 1;
  }
  30% {
    transform: translate(-260px, 10px) scale(1.2);
    opacity: 1;
  }
  32% {
    transform: translate(-270px, 20px) scale(1.2);
    opacity: 1;
  }
  36% {
    transform: translate(-280px, 26px) scale(1.2);
    opacity: 1;
  }
  /* ── card-3 上减速跑跳 ── */
  38% {
    transform: translate(-285px, 28px) scale(1.2);
    opacity: 1;
  }
  41% {
    transform: translate(-290px, 30px) scale(1.2);
    opacity: 1;
  }
  44% {
    transform: translate(-306px, 34px) scale(1.2);
    opacity: 1;
  }
  47% {
    transform: translate(-324px, 36px) scale(1.2);
    opacity: 1;
  }
  50% {
    transform: translate(-334px, 40px) scale(1.2);
    opacity: 1;
  }
  /* ── card-3 左���自然滑落到 card-2 底部中间 ── */
  52% {
    transform: translate(-348px, 48px) scale(1.2);
    opacity: 1;
  }
  56% {
    transform: translate(-358px, 60px) scale(1.2);
    opacity: 1;
  }
  61% {
    transform: translate(-364px, 110px) scale(1.2);
    opacity: 1;
  }
  65% {
    transform: translate(-370px, 118px) scale(1.2);
    opacity: 1;
  }
  69% {
    transform: translate(-378px, 124px) scale(1.2);
    opacity: 1;
  }
  72% {
    transform: translate(-386px, 132px) scale(1.2);
    opacity: 1;
  }
  74% {
    transform: translate(-390px, 140px) scale(1.2);
    opacity: 1;
  }
  78% {
    transform: translate(-398px, 148px) scale(1.2);
    opacity: 1;
  }
  /* ── 终点停留 + 渐隐 ── */
  82% {
    transform: translate(-406px, 156px) scale(1.2);
    opacity: 1;
  }
  86% {
    transform: translate(-410px, 164px) scale(1.2);
    opacity: 1;
  }
  90% {
    transform: translate(-412px, 170px) scale(1.2);
    opacity: 1;
  }
  96% {
    transform: translate(-416px, 176px) scale(1.2);
    opacity: 1;
  }
  100% {
    transform: translate(-420px, 180px) scale(1.2);
    opacity: 0;
  }
}

@media (max-height: 600px) {
  .feature-cards {
    margin-bottom: 50px;
  }
}
</style>
