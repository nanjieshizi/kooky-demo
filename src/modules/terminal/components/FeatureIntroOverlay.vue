<!-- 功能介绍悬浮层 —— 首次进入 CLI 视图时展示 7 页图文滚动 -->
<template>
  <Transition name="intro-fade">
    <div
      v-if="visible"
      ref="overlayRef"
      class="intro-overlay"
      tabindex="0"
      @click.self.stop
      @keydown.esc.stop.prevent
    >
      <div class="intro-card" :style="cardAccent">
        <!-- 右上角关闭按钮 -->
        <button
          class="intro-card__close"
          type="button"
          title="关闭"
          aria-label="关闭功能介绍"
          @click="handleClose"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        <!-- 页面内容：图 + 标题 + 描述 -->
        <div class="intro-card__content" :key="currentPage">
          <div class="intro-card__image" :class="{ 'is-placeholder': !currentPageData.image }">
            <img
              v-if="currentPageData.image && !imageError"
              :src="currentPageData.image"
              :alt="currentPageData.title"
              @error="imageError = true"
            />
            <span v-else class="intro-card__placeholder-text">{{ currentPageData.title }}</span>
          </div>
          <h3 class="intro-card__title">{{ currentPageData.title }}</h3>
          <p class="intro-card__description">{{ currentPageData.description }}</p>
        </div>

        <!-- 底部分页控件 -->
        <div class="intro-card__nav">
          <button
            class="intro-card__arrow"
            type="button"
            :disabled="isFirstPage"
            aria-label="上一页"
            @click="goPrev"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>

          <div class="intro-card__dots">
            <button
              v-for="(_, idx) in pages"
              :key="idx"
              class="intro-card__dot"
              :class="{ 'is-active': idx === currentPage }"
              type="button"
              :aria-label="`跳转到第 ${idx + 1} 页`"
              @click="goTo(idx)"
            />
          </div>

          <button
            class="intro-card__arrow"
            type="button"
            :disabled="isLastPage"
            aria-label="下一页"
            @click="goNext"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>

        <!-- 最后一页按钮（仅在到达最后一页时显示） -->
        <button
          v-if="showFinalButton"
          class="intro-card__final"
          type="button"
          @click="handleClose"
        >
          我知道了，试一试 →
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  pages: { type: Array, required: true },
  autoPlayDelay: { type: Number, default: 5000 },
})

const emit = defineEmits(['close'])

const overlayRef = ref(null)
const currentPage = ref(0)
const autoPlayStopped = ref(false)
const imageError = ref(false)
let autoPlayTimer = null

const currentPageData = computed(() => props.pages[currentPage.value] || { title: '', description: '', image: null, accent: '#58a6ff' })
const isFirstPage = computed(() => currentPage.value === 0)
const isLastPage = computed(() => currentPage.value === props.pages.length - 1)
const showFinalButton = computed(() => isLastPage.value)
const cardAccent = computed(() => ({
  '--intro-accent': currentPageData.value.accent || '#58a6ff',
}))

function clearAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer)
    autoPlayTimer = null
  }
}

function scheduleAutoPlay() {
  clearAutoPlay()
  if (autoPlayStopped.value || isLastPage.value) return
  autoPlayTimer = setTimeout(() => {
    if (!autoPlayStopped.value && !isLastPage.value) {
      currentPage.value += 1
    }
  }, props.autoPlayDelay)
}

function goPrev() {
  if (isFirstPage.value) return
  autoPlayStopped.value = true
  clearAutoPlay()
  currentPage.value -= 1
  imageError.value = false
}

function goNext() {
  if (isLastPage.value) return
  autoPlayStopped.value = true
  clearAutoPlay()
  currentPage.value += 1
  imageError.value = false
}

function goTo(idx) {
  if (idx < 0 || idx >= props.pages.length) return
  autoPlayStopped.value = true
  clearAutoPlay()
  currentPage.value = idx
  imageError.value = false
}

function handleClose() {
  clearAutoPlay()
  emit('close')
}

// visible 变化时重置状态 + 启动自动播放
watch(() => props.visible, (val) => {
  if (val) {
    currentPage.value = 0
    autoPlayStopped.value = false
    imageError.value = false
    scheduleAutoPlay()
    nextTick(() => overlayRef.value?.focus?.())
  } else {
    clearAutoPlay()
  }
}, { immediate: true })

// currentPage 变化时重新调度（自动播放的下一步 / 手动跳转后不调度）
watch(currentPage, () => {
  imageError.value = false
  if (!autoPlayStopped.value) {
    scheduleAutoPlay()
  }
})

onBeforeUnmount(clearAutoPlay)
</script>

<style lang="scss" scoped>
.intro-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.intro-card {
  position: relative;
  width: 560px;
  height: 480px;
  padding: 24px;
  background: #1c2128;
  border: 1px solid #30363d;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;

  &__close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
  }

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: intro-slide-in 0.2s ease;
  }

  &__image {
    width: 320px;
    height: 180px;
    margin-bottom: 20px;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    &.is-placeholder {
      background: linear-gradient(135deg, var(--intro-accent) 0%, rgba(28, 33, 40, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  }

  &__placeholder-text {
    color: rgba(255, 255, 255, 0.92);
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    padding: 0 16px;
    letter-spacing: 0.3px;
  }

  &__title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    text-align: center;
  }

  &__description {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #8b949e;
    text-align: center;
    max-width: 440px;
  }

  &__nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 0 4px;
  }

  &__arrow {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: #8b949e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;

    &:hover:not(:disabled) {
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }
  }

  &__dots {
    display: flex;
    gap: 8px;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, transform 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.4);
    }

    &.is-active {
      background: #58a6ff;
      transform: scale(1.15);
    }
  }

  &__final {
    margin-top: 12px;
    align-self: center;
    padding: 10px 28px;
    background: #58a6ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #4585e0;
    }
  }
}

@keyframes intro-slide-in {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.intro-fade-enter-active,
.intro-fade-leave-active {
  transition: opacity 0.3s ease;
}
.intro-fade-enter-from,
.intro-fade-leave-to {
  opacity: 0;
}
</style>
