<template>
  <div v-if="cards.length || goal" class="member-strip-wrapper" :class="{ 'member-strip-wrapper--hide-members': hideMembers }">
    <div v-if="goal" class="member-strip__goal">
      <span class="member-strip__goal-icon">
        <img :src="startsIcon" style="width: 18px;height: 18px;" draggable="false"/>
      </span>
      <span class="member-strip__goal-text">{{ goal }}</span>
    </div>
    <button
      type="button"
      class="member-tip"
      @click="emit('toggle-plan')"
      @mouseleave="handleTooltipMouseLeave"
      aria-label="查看执行计划"
    >
      <img :src="tipIcon" draggable="false"/>
      <CrabTooltip ref="tooltipRef" :member-cards="cards" />
    </button>
    <OnePersonPlanCard
      v-if="showPlan && plan"
      :plan="plan"
      :member-cards="cards"
      class="plan-popover"
      @close="emit('close-plan')"
    />
    <div v-if="cards.length && !hideMembers" class="member-strip">
        <div
          v-if="collapsed"
          class="member-strip__summary"
        >
          <span class="member-strip__avatar-stack">
            <span
              v-for="card in stackCards"
              :key="card.agentId"
              class="member-strip__mini-avatar-wrap"
              :class="{ 'member-strip__mini-avatar-wrap--selected': card.agentId === selectedMemberId }"
              @click.stop="emit('open-member', card)"
            >
              <img
                class="member-strip__mini-avatar"
                :src="card.avatarUrl || defaultAgentAvatar"
                alt=""
                draggable="false"
              />
              <span v-if="card.running || getCardStatus(card) === 'running'" class="member-strip__mini-badge">
                <svgIcon name="icon-runing" class="svg-icon" :size="10"/>
              </span>
            </span>
          </span>
          <img
            v-if="selectedCardStatusIcon"
            class="member-strip__summary-icon"
            :src="selectedCardStatusIcon"
            alt=""
            draggable="false"
          />
          <span class="member-strip__summary-text">{{ summaryText }}</span>
          <button
            type="button"
            class="member-strip__collapse"
            @click="emit('toggle-collapsed')"
          >
            <svgIcon name="icon-zhankai1" class="svg-icon member-strip__chevron" :size="16"/>
          </button>
        </div>
      <template v-else>
        <div class="member-strip__nav--left">
          <button
            type="button"
            class="member-strip__nav"
            :class="{ 'member-strip__nav--hidden': !scrollable }"
            aria-label="向左滚动成员卡"
            @click="scrollBy(-1)"
          >
            <svgIcon name="icon-zuohua" class="svg-icon" :size="16"/>
          </button>
        </div>
        <div ref="scrollerRef" class="member-strip__scroller">
          <button
            v-for="card in cards"
            :key="card.agentId"
            type="button"
            class="member-card"
            :class="[
              { 'member-card--selected': card.agentId === selectedMemberId },
              `member-card--${getCardStatus(card)}`
            ]"
            @click.stop="emit('open-member', card)"
          >
            <span class="member-card__avatar-wrap">
              <img class="member-card__avatar" :src="card.avatarUrl || defaultAgentAvatar" alt="" draggable="false"/>
              <span v-if="card.running || getCardStatus(card) === 'running'" class="member-card__running-badge">
                <svgIcon name="icon-runing" class="svg-icon" :size="10"/>
              </span>
            </span>
            <span class="member-card__name" :title="card.displayName">{{ card.displayName }}</span>
            <span v-if="card.execLabel" class="member-card__label" :title="card.execLabel">
              <img
                v-if="STATUS_MAP[getCardStatus(card)]?.icon"
                class="member-card__label-icon"
                :src="STATUS_MAP[getCardStatus(card)].icon"
                alt=""
                draggable="false"
              />
              <span>{{ STATUS_MAP[getCardStatus(card)].label }}</span>
            </span>
          </button>
        </div>
        <div class="member-strip__right-actions">
          <button type="button" class="member-strip__collapse" aria-label="收起成员卡" @click="emit('toggle-collapsed')">
            <svgIcon name="icon-zhankai1" class="svg-icon" :size="16"/>
          </button>
          <button
            type="button"
            class="member-strip__nav member-strip__nav--right"
            :class="{ 'member-strip__nav--hidden': !scrollable }"
            aria-label="向右滚动成员卡"
            @click="scrollBy(1)"
          >
            <svgIcon name="icon-youhua" class="svg-icon" :size="16"/>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
// 任务成员卡横排:名册全量展示、执行中排首位,卡面=头像+展示名+文案态(服务端物化直读)。
// 点击成员卡进入围观下钻;收起态为头像堆+执行中成员摘要一行(围观视图默认收起)。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OnePersonPlanCard from './OnePersonPlanCard.vue'
import CrabTooltip from './CrabTooltip.vue'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import startsIcon from '@/assets/soloTeam/starts.png'
import tipIcon from '@/assets/soloTeam/xie.png'
import completedIcon from '@/assets/soloTeam/completed.svg'
import failedIcon from '@/assets/soloTeam/failed.svg'
import runningIcon from '@/assets/soloTeam/running.svg'
import waitingIcon from '@/assets/soloTeam/waiting.svg'
defineOptions({ name: 'OnePersonTaskMemberStrip' })

const props = defineProps({
  cards: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false },
  goal: { type: String, default: '' },
  showPlan: { type: Boolean, default: false },
  plan: { type: Object, default: null },
  selectedMemberId: { type: String, default: '' },
  // 成员已挪到标题栏常驻展示时，这里只留目标 + 小螃蟹 + 执行计划卡
  hideMembers: { type: Boolean, default: false },
})

const emit = defineEmits(['open-member', 'toggle-collapsed', 'toggle-plan', 'close-plan'])

const scrollerRef = ref(null)
const scrollable = ref(false)
const tooltipRef = ref(null)

function handleTooltipMouseLeave() {
  tooltipRef.value?.hideOnMouseLeave()
}

// 状态映射配置
const STATUS_MAP = {
  completed: { icon: completedIcon, color: '#07C160', label: '任务完成啦' },
  running: { icon: runningIcon, color: '#436FF6', label: '全力干活中' },
  idle: { icon: waitingIcon, color: '#A070FF', label: '摸鱼等待中' },
  waiting: { icon: waitingIcon, color: '#A070FF', label: '摸鱼等待中' },
  failed: { icon: failedIcon, color: '#FF621F', label: '任务失败了' },
}

function getCardStatus(card) {
  if (card.failed) return 'failed'
  if (card.running) return 'running'
  // 根据 execLabel 推断状态（兜底）
  const label = String(card.execLabel || '').toLowerCase()
  if (label.includes('完成') || label.includes('done')) return 'completed'
  if (label.includes('等待') || label.includes('待命') || label.includes('摸鱼')) return 'idle'
  return 'idle' // 默认待命
}

const stackCards = computed(() => props.cards)
const summaryText = computed(() => {
  // 显示当前选中成员的状态
  const selected = props.cards.find(card => card.agentId === props.selectedMemberId)
  if (selected && selected.execLabel) {
    return `${selected.displayName} ${selected.execLabel}`
  }
  // 兜底: 显示成员数量
  return `共 ${props.cards.length} 位成员`
})

const selectedCardStatusIcon = computed(() => {
  const selected = props.cards.find(card => card.agentId === props.selectedMemberId)
  if (!selected || !selected.execLabel) return null
  const status = getCardStatus(selected)
  return STATUS_MAP[status]?.icon || null
})

function refreshScrollable() {
  const node = scrollerRef.value
  if (!node) {
    scrollable.value = false
    return
  }
  // 加 1px 容差避免浮点数精度问题
  scrollable.value = node.scrollWidth > node.clientWidth + 1
}

function scrollBy(direction) {
  const node = scrollerRef.value
  if (!node) return
  // 每张卡片宽度 96px + 间距 8px = 104px，确保至少滚动一张完整卡片
  const cardWidth = 104
  const viewportWidth = node.clientWidth
  // 滚动距离：尽量滚动视口宽度，但至少一张卡片
  const scrollDistance = Math.max(cardWidth, Math.floor(viewportWidth / cardWidth) * cardWidth)
  node.scrollBy({ left: direction * scrollDistance, behavior: 'smooth' })
}

let resizeObserver = null

function setupResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (scrollerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      refreshScrollable()
    })
    resizeObserver.observe(scrollerRef.value)
  }
}

watch(() => [props.cards.length, props.collapsed], async () => {
  await nextTick()
  refreshScrollable()
  setupResizeObserver()
})

// scrollerRef 变化时重新绑定 observer（条件渲染切换或拖拽面板后）
watch(scrollerRef, () => {
  nextTick(() => {
    refreshScrollable()
    setupResizeObserver()
  })
})

onMounted(() => {
  refreshScrollable()
  window.addEventListener('resize', refreshScrollable)
  setupResizeObserver()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', refreshScrollable)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.member-strip {
  position: relative;
  display: flex;
  align-items: center;
  /* gap: 4px; */
  flex: none;
  background: linear-gradient(0deg, #fafafc00 0%, #e6eaee30 100%);
  box-sizing: border-box;
  height: 97px;
  margin: 0px 8px;
  border-radius: 12px;
  /* padding: 6px 8px; */
  margin-top: 36px;
  padding: 0px 1px;
  transition: height 0.3s ease, margin-top 0.3s ease;
}

.member-strip:has(.member-strip__summary) {
  height: 34px;
}

.member-strip::before {
  content: '';
  position: absolute;
  top: 0px;
  right: 0;
  bottom: 40px;
  left: 0;
  border-radius: 12px;
  padding: 0.6px;
  background: linear-gradient(0deg, #ffffff00 0%, #ebebeb 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.member-strip:has(.member-strip__summary)::before {
  display: none;
}

.member-strip__scroller {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0px 32px 0px 25px;
  box-sizing: border-box;
}

.member-strip__scroller::-webkit-scrollbar {
  display: none;
}

.member-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: none;
  width: 96px;
  padding: 6px 12px;
  cursor: pointer;
  height: 72px;
  border-radius: 8px;
  background: linear-gradient(180deg, #eaf1ff 0%, #ffffff 48%);
  border: none;
  backdrop-filter: blur(10.18px) saturate(100%);
}

.member-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  padding: 0.6px;
  background: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.member-card:hover {
  /* background: #f7f8fb; */
  &:not(.member-card--selected)::before {
    background: linear-gradient(180deg, #ff621f 0%, #dfe2ea00 80%);
  }
}

.member-card--running {
  border-color: #ff621f;
  background: #fff7f2;
}

.member-card__avatar-wrap {
  position: relative;
  width: 24px;
  height: 24px;
}

.member-card__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.member-card__running-badge {
  position: absolute;
  top: 0px;
  right: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  background: #3490F9;
  border-radius: 50%;
  color: #fff;
  animation: member-card-spin 1.5s linear infinite;
}

.member-card__presence {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: #c0c4cc;
}

.member-card__presence--busy {
  background: #ff621f;
}

.member-card__presence--idle {
  background: #07c160;
}

.member-card__name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  color: #2f3547;
}

.member-card__label {
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #8c93a6;
  line-height: 12px;
}

.member-card__label-icon {
  flex: none;
  width: 12px;
  height: 12px;
  object-fit: contain;
}

/* 状态对应的颜色 */
.member-card--completed {
  background: linear-gradient(180deg, #f2fdf2 0%, #ffffff 48%);
  border-image: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%) 0.6;
  backdrop-filter: blur(10.18px) saturate(100%);
  .member-card__label {
    color: #07C160;
  }
}


.member-card--running {
  background: linear-gradient(180deg, #e8ebfa 0%, #ffffff 48%);
  border-image: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%) 0.6;
  backdrop-filter: blur(10.18px) saturate(100%);
  .member-card__label {
    color: #436FF6;
  }
}

.member-card--idle, .member-card--waiting {
  background: linear-gradient(180deg, #faf4ff 0%, #ffffff 48%);
  border-image: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%) 0.6;
  backdrop-filter: blur(10.18px) saturate(100%);
  .member-card__label {
    color: #A070FF;
  }
}

.member-card--failed {
  background: linear-gradient(180deg, #fceeeb 0%, #ffffff 48%);
  border-image: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%) 0.6;
  backdrop-filter: blur(10.18px) saturate(100%);
  .member-card__label {
    color: #FF621F;
  }
}

.member-card--selected {
  background: linear-gradient(180deg, #fef3ed 0%, #ffffff 48%);
  border: 0.6px solid #FF621F;
  backdrop-filter: blur(10.18px) saturate(100%);
}

@keyframes member-card-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.member-strip__nav,
.member-strip__collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #91949E;
  cursor: pointer;
}

.member-strip__nav--hidden {
  visibility: hidden;
  pointer-events: none;
}

.member-strip__nav--left {
  position: absolute;
  left: 1px;
  top: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* padding: 0 6px; */
  backdrop-filter: blur(6px) saturate(120%);
  width: 24px;
  z-index: 2;
  border-radius: 12px 0px 0px 12px;
  background: #ffffff50;
}

.member-strip__right-actions {
  position: absolute;
  right: 1px;
  top: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  padding-left: 16px;
  background: #ffffff50;
  backdrop-filter: blur(6px) saturate(120%);
  width: 40px;
  border-radius: 0px 12px 12px 0px;
  z-index: 2;
  .member-strip__nav--right {
    margin-top: 12px;
  }
}

.member-strip__nav:hover,
.member-strip__collapse:hover {
  background: #fff;
}

.member-strip__collapse {
  align-self: flex-start;
  margin-top: 6px;
}

.member-strip__summary {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(0deg, #fafafc80 0%, #e6eaee80 100%);
  color: #91949E;
  cursor: pointer;
}

.member-strip__summary::before {
  content: '';
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 14px;
  border-radius: 12px;
  padding: 0.6px;
  background: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.member-strip__avatar-stack {
  display: flex;
  flex: none;
}

.member-strip__mini-avatar-wrap {
  position: relative;
  flex: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.member-strip__mini-avatar-wrap:active .member-strip__mini-avatar {
  background: #FFB493;
  border: 1px solid #FF684E;
  box-shadow: 2px 2px 6px 0px rgba(209, 209, 209, 0.3);
}

.member-strip__mini-avatar-wrap:active {
  transform: scale(0.95);
}

.member-strip__mini-avatar-wrap--selected .member-strip__mini-avatar {
  background: #FFB493;
  border: 1px solid #FF684E;
  box-shadow: 2px 2px 6px 0px rgba(209, 209, 209, 0.3);
}

.member-strip__mini-avatar-wrap:nth-child(1) { z-index: 4; }
.member-strip__mini-avatar-wrap:nth-child(2) { z-index: 3; }
.member-strip__mini-avatar-wrap:nth-child(3) { z-index: 2; }
.member-strip__mini-avatar-wrap:nth-child(4) { z-index: 1; }

.member-strip__mini-avatar-wrap + .member-strip__mini-avatar-wrap {
  margin-left: -4px;
}

.member-strip__mini-avatar {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  object-fit: cover;
}

.member-strip__mini-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  background: #436FF6;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  color: #fff;
  animation: member-card-spin 1.5s linear infinite;
}

.member-strip__summary-icon {
  flex: none;
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.member-strip__summary-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
  color: #8c93a6;
}

.member-strip__chevron {
  flex: none;
  color: #91949E;
  transform: rotate(180deg);
  transition: transform 0.3s ease;
}

.member-strip-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: none;
  margin: 0px 16px;
  min-height: 132px;
  background: linear-gradient(180deg, #f5f6f980 0%, #f5f6f980 100%);
  backdrop-filter: blur(10px) saturate(100%);
  border-radius: 30px;
  position: relative;
  overflow: visible;
  z-index: 9 !important;
  transition: min-height 0.3s ease;
}

.member-strip-wrapper:has(.member-strip__summary) {
  min-height: 70px;
}

/* 成员挪到标题栏后：本条只承载目标 + 小螃蟹 + 执行计划卡，收窄高度 */
.member-strip-wrapper--hide-members {
  min-height: 62px;
}

.member-strip-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  /* border-radius: 8px; */
  padding: 0.6px;
  /* background: linear-gradient(180deg, #dfe2ea 0%, #dfe2ea00 100%); */
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.member-strip-wrapper .member-tip {
  position: absolute;
  right: 28px;
  top: 18px;
  z-index: 20;
  background: transparent;
  border: none;
  img {
    width: 36px;
    height: 25px;
  }
  &:hover {
    cursor: pointer;
  }
}

.member-strip__goal {
  position: absolute;
  display: flex;
  /* align-items: baseline; */
  gap: 6px;
  padding: 7px 8px;
  margin: 5px 16px 0px 16px;
  border-radius: 12px 12px 0px 0px;
  background: linear-gradient(180deg, #fff1ea 29%, #fff1ea00 100%);
  color: #FF621F;
  font-size: 12px;
  height: 48px;
  width: calc(100% - 36px);
}

.member-strip__goal-icon {
  flex: none;
}

.member-strip__goal-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 80px);
}

.plan-popover {
  position: absolute;
  top: 36px;
  left: 16px;
  right: 16px;
  z-index: 10000;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
</style>
