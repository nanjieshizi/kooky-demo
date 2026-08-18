/**
 * 滚动条显示控制 Composable
 * 用于实现"滚动时才显示滚动条"的效果
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'

/**
 * @param {Object} options 配置选项
 * @param {Ref} options.scrollContainer 可选，传入已有的滚动容器 ref
 * @param {number} options.hideDelay 滚动停止后多久隐藏滚动条（毫秒），默认 1000ms
 * @returns {Object} { scrollContainer, isScrolling }
 */
export function useScrollbar(options = {}) {
  const { hideDelay = 1000, scrollContainer: externalRef } = options

  const scrollContainer = externalRef || ref(null)
  const isScrolling = ref(false)
  let scrollTimer = null

  function handleScroll() {
    isScrolling.value = true

    // 清除之前的定时器
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }

    // 设置新的定时器，延迟隐藏滚动条
    scrollTimer = setTimeout(() => {
      isScrolling.value = false
    }, hideDelay)
  }

  function attachListener() {
    if (scrollContainer.value) {
      scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
    }
  }

  function detachListener() {
    if (scrollContainer.value) {
      scrollContainer.value.removeEventListener('scroll', handleScroll)
    }
  }

  onMounted(() => {
    attachListener()
  })

  onUnmounted(() => {
    detachListener()
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }
  })

  // 如果传入了外部 ref，监听其变化
  if (externalRef) {
    watch(externalRef, (newVal, oldVal) => {
      if (oldVal) {
        detachListener()
      }
      if (newVal) {
        attachListener()
      }
    })
  }

  return {
    scrollContainer,
    isScrolling
  }
}
