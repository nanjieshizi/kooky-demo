<template>
  <div class="team-intro">
    <!-- 右上角图标 -->
    <div class="top-right-icons">
      <button
        class="icon-btn"
        :class="{ active: uiStore.isFilePanelOpen }"
        title="文件"
        @click="uiStore.toggleRightPanel('file')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button
        class="icon-btn"
        :class="{ active: uiStore.isAgentPanelOpen }"
        title="Agent市场"
        @click="uiStore.toggleRightPanel('agent')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </button>
    </div>

    <div class="team-intro-content">
      <!-- Hero image -->
      <div class="team-hero">
        <img src="@/assets/home/g_header2.png" alt="crab" class="team-hero-img" />
      </div>

      <!-- Title with capability tag -->
      <div class="team-title-row">
        <h1 class="team-title">已经组建好{{ teamName }}超级团队，在这里可以</h1>
        <span class="capability-tag" :style="{ background: currentGradient }">
          <span class="capability-text">{{ currentCapability }}</span>
          <img :src="jianTouIcon" alt="" class="capability-arrow" />
        </span>
      </div>

      <!-- Members row -->
      <div class="members-row">
        <div class="member-avatars">
          <div class="member-avatar" v-for="(m, i) in mockMembers" :key="i">
            <img v-if="m.img" :src="m.img" alt="" />
            <span v-else class="member-label" :style="{ background: m.bg, color: m.color }">{{ m.text }}</span>
          </div>
        </div>
        <span class="members-text">你自己的Super Team</span>
      </div>

      <!-- AI message bubble -->
      <div class="ai-message">
        <img src="@/assets/home/heade_icon.svg" alt="crab" class="ai-avatar" />
        <div class="ai-bubble">
          超级团队成员已集合完毕，快来体验一下吧，这是一段说明文案
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrapper" :class="{ focused: inputFocused, 'has-content': inputValue.length > 0 }">
        <input
          v-model="inputValue"
          type="text"
          class="team-input"
          placeholder="发起团队的第一个任务或提问任何问题，让工作像聊天一样简单"
          @focus="inputFocused = true"
          @blur="inputFocused = false"
          @keydown.enter="handleSend"
        />
        <button
          class="send-btn"
          :class="{ active: inputValue.trim().length > 0 }"
          @click="handleSend"
        >
          <img src="@/assets/home/send_icon.svg" alt="send" class="send-icon">
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import g1Img from '@/assets/home/g_1.png'
import g2Img from '@/assets/home/g2.png'
import g3Img from '@/assets/home/g3.png'
import jianTouIcon from '@/assets/home/jian_tou_icon.png'

const props = defineProps({
  spaceId: { type: String, required: true }
})

const emit = defineEmits(['completed'])

const groupStore = useGroupStore()
const uiStore = useUIStore()

const inputValue = ref('')
const inputFocused = ref(false)
const capabilityIndex = ref(0)

const teamName = computed(() => {
  const r = groupStore.conversations.find((x) => x.conversationId === props.spaceId)
  return r?.name && String(r.name).trim() ? String(r.name).trim() : props.spaceId
})

const capabilities = ['做设计', '写代码', '做测试', '写文档', '分析数据']
const currentCapability = computed(() => capabilities[capabilityIndex.value])

const tagGradients = [
  'linear-gradient(90deg, #F386BE 0%, #8478FA 52%, #77C9FB 98%)',
  'linear-gradient(90deg, #81CDFE -48%, #F284AB 17%, #FD9159 92%)',
  'linear-gradient(90deg, #3A94E8 0%, #72E1C9 100%)',
]
const gradientIndex = ref(0)
const currentGradient = computed(() => tagGradients[gradientIndex.value])

function pickRandomGradient() {
  let next
  do {
    next = Math.floor(Math.random() * tagGradients.length)
  } while (next === gradientIndex.value && tagGradients.length > 1)
  gradientIndex.value = next
}

let timer = null
onMounted(() => {
  timer = setInterval(() => {
    capabilityIndex.value = (capabilityIndex.value + 1) % capabilities.length
    pickRandomGradient()
  }, 2000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 模拟团队成员
const mockMembers = [
  { img: g1Img },
  { img: g2Img },
  { img: g3Img },
  { img: g1Img },
  { img: '', text: 'PMO', bg: '#dcfce7', color: '#16a34a' },
  { img: '', text: '我', bg: '#dbeafe', color: '#2563eb' },
]

function handleSend() {
  const content = inputValue.value.trim()
  if (!content) {
    ElMessage.warning('请输入内容后再发送')
    return
  }
  groupStore.completeTeamIntro(props.spaceId)
  groupStore.sendMessage(content, props.spaceId).catch((e) => {
    console.error('[TeamIntro] 发送介绍消息失败:', e)
  })
  emit('completed')
}
</script>

<style scoped>
.team-intro {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  position: relative;
  background: #ffffff;
  padding-top: 60px;
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
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-sm, 6px);
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

.team-intro-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  max-width: 820px;
  min-width: 645px;
  padding: 0 40px 40px;
  margin-top: 37px;
}

/* Hero */
.team-hero {
  margin-bottom: 20px;
}

.team-hero-img {
  width: 200px;
  height: auto;
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
  gap: 12px;
  margin-bottom: 28px;
}

.member-avatars {
  display: flex;
  align-items: center;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  margin-left: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}

.member-avatar:first-child {
  margin-left: 0;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-label {
  font-size: 10px;
  font-weight: 700;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.members-text {
  font-size: 15px;
  color: #666;
}

/* AI message */
.ai-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin-bottom: 28px;
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
  line-height: 22px;
  border-radius: 0px 16px 16px 16px;
  background: #F7F7F7;
}

/* Input area */
.input-area {
  width: 100%;
  max-width: 784px;
  padding: 0 40px 40px;
  padding-left: 190px;
  box-sizing: border-box;
}

.input-wrapper {
  display: flex;
  align-items: center;
  border-radius: 20px;
  background: #F7F7F7;
  padding: 11px 18px 11px 13px;
  margin-right: -150px;
}

.team-input {
  flex: 1;
  height: 54px;
  padding: 0 22px;
  border: 1px solid #E3E3E3;
  border-radius: 20px;
  background: #FFFFFF;
  font-size: 14px;
  color: #2F3547;
  outline: none;
  box-sizing: border-box;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.03);
  margin-right: 12px;
}

.team-input::placeholder { color: #999999; }

.send-btn {
  width: 28px;
  height: 28px;
  border-radius: 9.6px;
  border: none;
  background: #020202;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.send-icon {
  width: 16px;
  height: 16px;
}

.send-btn.active { opacity: 1; }
.send-btn:hover { transform: scale(1.05); }
</style>
