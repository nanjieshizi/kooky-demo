<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  filePath: { type: String, required: true },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

// 常量配置
const LINE_HEIGHT = 20 // 固定行高（px）
const VISIBLE_LINES = 30 // 可见区域行数（减少初始加载）
const BUFFER_LINES = 20 // 缓冲区行数（减少预加载）
const CACHE_SIZE = 300 // LRU 缓存最大行数（减少内存占用）
const MAX_LINE_LENGTH = 5000 // 单行最大字符数（防止超长行）
const MAX_TOTAL_HEIGHT = 100000000 // 最大总高度（防止浏览器崩溃）

// 状态
const loading = ref(false)
const totalLines = ref(0)
const scrollTop = ref(0)
const containerHeight = ref(1000)

// LRU 缓存（Map 保持插入顺序）
const lineCache = new Map()

// 当前可见行
const visibleLines = ref([])

// 计算属性
const totalHeight = computed(() => {
  const height = totalLines.value * LINE_HEIGHT
  // 限制最大高度，防止浏览器崩溃
  return Math.min(height, MAX_TOTAL_HEIGHT)
})
const startLine = computed(() => Math.floor(scrollTop.value / LINE_HEIGHT))
const endLine = computed(() => Math.min(
  totalLines.value - 1,
  Math.ceil((scrollTop.value + containerHeight.value) / LINE_HEIGHT)
))
const offsetY = computed(() => startLine.value * LINE_HEIGHT)

// LRU 缓存操作
function getCachedLine(lineIndex) {
  if (!lineCache.has(lineIndex)) return null
  const value = lineCache.get(lineIndex)
  // 移到最后（最近使用）
  lineCache.delete(lineIndex)
  lineCache.set(lineIndex, value)
  return value
}

function setCachedLine(lineIndex, content) {
  if (lineCache.has(lineIndex)) {
    lineCache.delete(lineIndex)
  }

  // 截断超长行，防止渲染卡顿
  const truncatedContent = content.length > MAX_LINE_LENGTH
    ? content.slice(0, MAX_LINE_LENGTH) + ' ...(行内容过长已截断)'
    : content

  lineCache.set(lineIndex, truncatedContent)

  // 超出容量，删除最旧的
  if (lineCache.size > CACHE_SIZE) {
    const firstKey = lineCache.keys().next().value
    lineCache.delete(firstKey)
  }
}

// 加载文件元数据
async function loadMetadata() {
  try {
    const metadata = await window.electronAPI.fs.getFileMetadata(props.filePath)
    // 更保守的行数估算（假设平均每行 120 字节，避免估算过大）
    const estimatedLines = Math.ceil(metadata.size / 120)
    // 限制最大行数估算，防止创建过大的占位元素
    totalLines.value = Math.min(estimatedLines, 1000000)
  } catch (err) {
    console.error('加载文件元数据失败:', err)
    totalLines.value = 1000 // 默认值
  }
}

// 加载指定范围的行
async function loadLines(start, count) {
  if (loading.value) return

  loading.value = true
  try {
    const result = await window.electronAPI.fs.readFileChunk(props.filePath, start, count)

    // 更新缓存
    result.lines.forEach((line, index) => {
      setCachedLine(start + index, line)
    })

    // 更新实际总行数
    if (result.endLine > totalLines.value) {
      totalLines.value = result.endLine
    }
  } catch (err) {
    console.error('加载文件块失败:', err)
  } finally {
    loading.value = false
  }
}

// 更新可见行
function updateVisibleLines() {
  const lines = []
  const start = startLine.value
  const end = endLine.value

  for (let i = start; i <= end; i++) {
    const content = getCachedLine(i)
    if (content !== null) {
      lines.push({ index: i, content })
    } else {
      lines.push({ index: i, content: '' })
    }
  }

  visibleLines.value = lines
}

// 滚动处理（带防抖）
let scrollRaf = null
let isLoadingChunk = false
function handleScroll(e) {
  if (scrollRaf) return

  scrollRaf = requestAnimationFrame(async () => {
    scrollRaf = null
    scrollTop.value = e.target.scrollTop

    // 先更新可见行（使用缓存的内容）
    updateVisibleLines()

    // 如果正在加载，跳过本次加载请求
    if (isLoadingChunk) return

    // 计算需要加载的范围（包含缓冲区）
    const loadStart = Math.max(0, startLine.value - BUFFER_LINES)
    const loadEnd = Math.min(totalLines.value - 1, endLine.value + BUFFER_LINES)

    // 检查缓存，收集缺失的行范围
    const missingRanges = []
    let rangeStart = null

    for (let i = loadStart; i <= loadEnd; i++) {
      if (getCachedLine(i) === null) {
        if (rangeStart === null) {
          rangeStart = i
        }
      } else {
        if (rangeStart !== null) {
          missingRanges.push({ start: rangeStart, end: i - 1 })
          rangeStart = null
        }
      }
    }
    if (rangeStart !== null) {
      missingRanges.push({ start: rangeStart, end: loadEnd })
    }

    // 只加载第一个缺失范围，避免一次性加载过多
    if (missingRanges.length > 0) {
      const range = missingRanges[0]
      const count = Math.min(range.end - range.start + 1, 50) // 单次最多加载 50 行
      isLoadingChunk = true
      await loadLines(range.start, count)
      isLoadingChunk = false
      updateVisibleLines()
    }
  })
}

// 初始化
onMounted(async () => {
  await loadMetadata()
  // 初始只加载前 50 行，减少启动时间
  await loadLines(0, 50)
  updateVisibleLines()
})

// 清理
onUnmounted(() => {
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
  }
  lineCache.clear()
})

// 监听文件路径变化
watch(() => props.filePath, async () => {
  lineCache.clear()
  scrollTop.value = 0
  visibleLines.value = []
  await loadMetadata()
  await loadLines(0, 50)
  updateVisibleLines()
})

// 格式化文件大小
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }
  return (bytes / 1024).toFixed(0) + ' KB'
}
</script>

<template>
  <div v-if="visible" class="virtual-file-viewer">
    <!-- 头部提示 -->
    <!-- <div class="viewer-header">
      <span class="header-text">大文件模式 · 只读预览</span>
      <button class="close-btn" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div> -->

    <!-- 滚动容器 -->
    <div class="scroll-container" @scroll="handleScroll">
      <!-- 占位元素（撑开滚动条） -->
      <div class="spacer" :style="{ height: totalHeight + 'px' }"></div>

      <!-- 可见内容 -->
      <div class="content" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="line in visibleLines"
          :key="line.index"
          class="line"
          v-show="line.content !== ''"
        >
          <span class="line-number">{{ line.index + 1 }}</span>
          <span class="line-content">{{ line.content }}</span>
        </div>
      </div>

      <!-- 加载指示 -->
      <div v-if="loading" class="loading-indicator">加载中...</div>
    </div>
  </div>
</template>

<style scoped>
.virtual-file-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #FAFBFC;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  background: #FFF8E1;
  border-bottom: 1px solid #FFE082;
  flex-shrink: 0;
}

.header-text {
  font-size: 12px;
  color: #795548;
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #795548;
  border-radius: 4px;
  transition: background 0.15s;
}

.close-btn:hover {
  background: #FFE082;
}

.scroll-container {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: auto;
}

.spacer {
  width: 1px;
}

.content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.line {
  display: flex;
  align-items: flex-start;
  height: 20px;
  padding: 0 8px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 20px;
  white-space: pre;
}

.line:hover {
  background: rgba(0, 0, 0, 0.04);
}

.line-number {
  min-width: 48px;
  color: #C0C6D4;
  text-align: right;
  padding-right: 16px;
  user-select: none;
  flex-shrink: 0;
}

.line-content {
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
}

.scroll-container::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-container::-webkit-scrollbar-thumb {
  background: #E0E4EC;
  border-radius: 2px;
}
</style>

