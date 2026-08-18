import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 水平拖拽调整（左右分栏）
 * @param {number} defaultLeftPercent - 默认左侧宽度百分比（0-100）
 * @param {number} minLeftPercent - 最小左侧宽度百分比
 * @param {number} maxLeftPercent - 最大左侧宽度百分比
 */
export function useHorizontalResize(defaultLeftPercent = 40, minLeftPercent = 20, maxLeftPercent = 80) {
  const leftPercent = ref(defaultLeftPercent)
  const isDragging = ref(false)

  let startX = 0
  let startPercent = 0
  let containerWidth = 0

  function startDrag(e, container) {
    isDragging.value = true
    startX = e.clientX
    startPercent = leftPercent.value
    containerWidth = container.offsetWidth

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onDrag(e) {
    if (!isDragging.value) return

    const deltaX = e.clientX - startX
    const deltaPercent = (deltaX / containerWidth) * 100
    const newPercent = Math.max(minLeftPercent, Math.min(maxLeftPercent, startPercent + deltaPercent))

    leftPercent.value = newPercent
  }

  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
  })

  return {
    leftPercent,
    isDragging,
    startDrag,
  }
}

/**
 * 垂直拖拽调整（上下分栏）
 * @param {number} defaultTopPercent - 默认上部高度百分比（0-100）
 * @param {number} minTopPercent - 最小上部高度百分比
 * @param {number} maxTopPercent - 最大上部高度百分比
 */
export function useVerticalResize(defaultTopPercent = 55, minTopPercent = 20, maxTopPercent = 80) {
  const topPercent = ref(defaultTopPercent)
  const isDragging = ref(false)

  let startY = 0
  let startPercent = 0
  let containerHeight = 0

  function startDrag(e, container) {
    isDragging.value = true
    startY = e.clientY
    startPercent = topPercent.value
    containerHeight = container.offsetHeight

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  function onDrag(e) {
    if (!isDragging.value) return

    const deltaY = e.clientY - startY
    const deltaPercent = (deltaY / containerHeight) * 100
    const newPercent = Math.max(minTopPercent, Math.min(maxTopPercent, startPercent + deltaPercent))

    topPercent.value = newPercent
  }

  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
  })

  return {
    topPercent,
    isDragging,
    startDrag,
  }
}
