import { ref, onMounted, onUnmounted } from 'vue'

export function useWindowWidth() {
  const windowWidth = ref(window.innerWidth)
  let rafId = null

  function onResize() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      windowWidth.value = window.innerWidth
      rafId = null
    })
  }

  onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    if (rafId) cancelAnimationFrame(rafId)
  })

  return { windowWidth }
}
