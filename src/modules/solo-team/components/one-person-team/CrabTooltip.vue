<template>
  <transition name="tooltip-fade">
    <div v-if="visible" class="crab-tooltip">
      <div class="crab-tooltip__content">
        <img v-if="isProgressMessage" class="crab-tooltip__icon" :src="noticeIcon" alt="" />
        {{ currentMessage }}
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import noticeIcon from '@/assets/soloTeam/notice.png'

const props = defineProps({
  memberCards: { type: Array, default: () => [] },
})

// 文案库
const MESSAGES = {
  allIdle: [
    '全速运转，别宕机，冲！',
    '方向对了，跑起来！',
    '需求很虐，但你们很牛，加油！',
  ],
  partialIdle: [
    '歇够了就回来，等你',
    '调整完，尽快归队',
    '摸鱼可以，别让我抓到',
    '茶凉了，该回工位了',
  ],
  hasFailed: [
    '错了就改，我陪你重来',
    '先调整，责任晚点再说',
    '没事，AI也会胡说八道',
  ],
  allCompleted: [
    '你们做到了，我真骄傲',
    '辛苦了，结果很好',
    '收工！去当快乐人类吧',
  ],
  progress: '执行进度都在这，点我查看～',
}

const visible = ref(false)
const currentMessage = ref('')
const isProgressMessage = computed(() => currentMessage.value === MESSAGES.progress)
let showTimer = null
let hideTimer = null

// 计算当前状态
const currentStatus = computed(() => {
  if (!props.memberCards.length) return null

  const hasFailed = props.memberCards.some(card => card.failed)
  if (hasFailed) return 'hasFailed'

  const allCompleted = props.memberCards.every(card => {
    const label = String(card.execLabel || '').toLowerCase()
    return label.includes('完成') || label.includes('done')
  })
  if (allCompleted) return 'allCompleted'

  const idleCards = props.memberCards.filter(card => {
    const label = String(card.execLabel || '').toLowerCase()
    return label.includes('等待') || label.includes('待命') || label.includes('摸鱼')
  })

  if (idleCards.length === props.memberCards.length) return 'allIdle'
  if (idleCards.length > 0) return 'partialIdle'

  return null
})

// 随机选择消息
function getRandomMessage(status) {
  // 10% 概率显示进度提示
  if (Math.random() < 0.1) {
    return MESSAGES.progress
  }

  const messages = MESSAGES[status]
  if (!messages || !messages.length) return ''
  return messages[Math.floor(Math.random() * messages.length)]
}

// 显示气泡
function showTooltip() {
  if (!currentStatus.value) return

  currentMessage.value = getRandomMessage(currentStatus.value)
  visible.value = true

  // 显示 10-20 秒后隐藏（随机）
  const showDuration = 10000 + Math.random() * 10000
  hideTimer = setTimeout(() => {
    visible.value = false

    // 隐藏后等待 10-20 秒再次显示（随机间隔）
    const delay = 10000 + Math.random() * 10000
    showTimer = setTimeout(showTooltip, delay)
  }, showDuration)
}

// 启动循环
function startLoop() {
  stopLoop()
  // 初始延迟 2 秒
  showTimer = setTimeout(showTooltip, 4000)
}

// 停止循环
function stopLoop() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  visible.value = false
}

// 暴露给父组件：鼠标划出时立即隐藏并重启循环
function hideOnMouseLeave() {
  if (!visible.value) return

  // 清除当前的定时器
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  // 立即隐藏
  visible.value = false

  // 重新启动下一个循环（5-8秒后）
  if (currentStatus.value) {
    const delay = 5000 + Math.random() * 3000
    showTimer = setTimeout(showTooltip, delay)
  }
}

// 监听状态变化
watch(currentStatus, (newStatus) => {
  if (newStatus) {
    startLoop()
  } else {
    stopLoop()
  }
})

onMounted(() => {
  if (currentStatus.value) {
    startLoop()
  }
})

onBeforeUnmount(() => {
  stopLoop()
})

defineExpose({ hideOnMouseLeave })
</script>

<style scoped>
.crab-tooltip {
  position: absolute;
  bottom: 100%;
  right: -6px;
  margin-bottom: 4px;
  z-index: 100;
}

.crab-tooltip__content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #171B26;
  border-radius: 12px 12px 0px 12px;
  color: #fff;
  font-size: 12px;
  height: 24px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.crab-tooltip__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.tooltip-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
