import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

/**
 * 检测容器是否水平溢出
 * @param {import('vue').Ref<HTMLElement|null>} containerRef - 容器元素 ref
 * @param {import('vue').Ref} [deps] - 可选的依赖项，变化时重新检测（如列表长度）
 * @returns {{ isOverflowing: import('vue').Ref<boolean> }}
 */
export function useOverflowDetect(containerRef, deps) {
  const isOverflowing = ref(false)
  let ro = null

  function check() {
    const el = containerRef.value
    if (!el) {
      isOverflowing.value = false
      return
    }
    // 放宽 4px 阈值，避免 sub-pixel 舍入造成的误判（flex 内容合适、但 scrollWidth 取整后比 clientWidth 多 1~3px 的场景）
    isOverflowing.value = el.scrollWidth - el.clientWidth > 4
  }

  onMounted(() => {
    ro = new ResizeObserver(check)
    if (containerRef.value) ro.observe(containerRef.value)
    check()
  })

  onBeforeUnmount(() => {
    if (ro) { ro.disconnect(); ro = null }
  })

  // containerRef 变化时重新绑定
  watch(containerRef, (el, oldEl) => {
    if (ro && oldEl) ro.unobserve(oldEl)
    if (ro && el) ro.observe(el)
    check()
  })

  // 依赖变化时重新检测（如 commands.length、tabs.length）
  if (deps) {
    watch(deps, () => {
      // nextTick 后 DOM 更新完毕再检测
      requestAnimationFrame(check)
    })
  }

  return { isOverflowing }
}
