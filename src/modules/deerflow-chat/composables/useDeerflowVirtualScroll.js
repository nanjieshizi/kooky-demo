/**
 * 轻量虚拟滚动 composable
 * 适用于消息列表场景（动态高度、自动滚底）
 * 不引入外部依赖，基于 IntersectionObserver 实现懒渲染
 */
import { ref, computed, watch } from 'vue'

const BUFFER_SIZE = 10
const INITIAL_RENDER_COUNT = 30

/**
 * @param {{
 *   items: import('vue').Ref<Array>,
 *   listRef: import('vue').Ref<HTMLElement|null>,
 *   threshold: number,
 * }} opts
 */
export function useDeerflowVirtualScroll(opts) {
  const { items, threshold = 50 } = opts

  const renderStart = ref(0)
  const renderEnd = ref(INITIAL_RENDER_COUNT)
  const isVirtualEnabled = ref(false)

  const visibleItems = computed(() => {
    if (!isVirtualEnabled.value) return items.value
    return items.value.slice(renderStart.value, renderEnd.value)
  })

  const shouldEnableVirtual = computed(() => items.value.length > threshold)

  watch(shouldEnableVirtual, (val) => {
    isVirtualEnabled.value = val
    if (val) {
      renderStart.value = Math.max(0, items.value.length - INITIAL_RENDER_COUNT)
      renderEnd.value = items.value.length
    }
  }, { immediate: true })

  watch(() => items.value.length, (newLen, oldLen) => {
    if (!isVirtualEnabled.value) return
    if (newLen > oldLen) {
      renderEnd.value = newLen
      if (renderEnd.value - renderStart.value > INITIAL_RENDER_COUNT + BUFFER_SIZE * 2) {
        renderStart.value = renderEnd.value - INITIAL_RENDER_COUNT - BUFFER_SIZE
      }
    }
  })

  function loadMoreTop() {
    if (!isVirtualEnabled.value) return
    if (renderStart.value <= 0) return
    renderStart.value = Math.max(0, renderStart.value - BUFFER_SIZE)
  }

  function getItemKey(index) {
    const actualIndex = isVirtualEnabled.value ? renderStart.value + index : index
    return items.value[actualIndex]?.id || `item-${actualIndex}`
  }

  return {
    visibleItems,
    isVirtualEnabled,
    renderStart,
    renderEnd,
    loadMoreTop,
    getItemKey,
  }
}
