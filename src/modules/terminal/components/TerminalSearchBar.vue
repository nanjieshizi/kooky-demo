<template>
  <div class="terminal-search-bar" :style="barStyle">
    <!-- 搜索输入框 -->
    <input
      ref="searchInputRef"
      v-model="searchQuery"
      type="text"
      class="search-input"
      :placeholder="placeholder"
      @input="onSearchInput"
      @keydown="onSearchKeydown"
    />

    <!-- 结果计数 -->
    <span class="result-count">
      {{ resultText }}
    </span>

    <!-- 搜索选项按钮 -->
    <div class="search-options">
      <!-- 大小写敏感 -->
      <el-tooltip
        :content="'大小写敏感'"
        placement="bottom"
        :show-after="100"
        :effect="tooltipEffect"
      >
        <button
          class="option-btn"
          :class="{ active: caseSensitive }"
          @click="toggleCaseSensitive"
          :title="`${modKeyName}+C`"
        >
          <SvgIcon name="quanci" :size="14" :color="caseSensitive ? '#FF8C00' : iconColor" />
        </button>
      </el-tooltip>

      <!-- 正则表达式 -->
      <el-tooltip
        :content="'正则表达式'"
        placement="bottom"
        :show-after="100"
        :effect="tooltipEffect"
      >
        <button
          class="option-btn"
          :class="{ active: useRegex }"
          @click="toggleRegex"
          :title="`${modKeyName}+R`"
        >
          <SvgIcon name="xingxing" :size="16" :color="useRegex ? '#FF8C00' : iconColor" />
        </button>
      </el-tooltip>

      <!-- 全词匹配 -->
      <el-tooltip
        :content="'全词匹配'"
        placement="bottom"
        :show-after="100"
        :effect="tooltipEffect"
      >
        <button
          class="option-btn"
          :class="{ active: wholeWord }"
          @click="toggleWholeWord"
        >
          <SvgIcon name="ab" :size="16" :color="wholeWord ? '#FF8C00' : iconColor" />
        </button>
      </el-tooltip>
    </div>

    <!-- 导航按钮和关闭 -->
    <div class="search-navigation">
      <!-- 上一个 -->
      <el-tooltip content="上一个匹配项 (Shift+Enter)" placement="bottom" :show-after="100" :effect="tooltipEffect">
        <button
          class="nav-btn"
          :disabled="!hasResults"
          @click="findPrevious"
        >
          <SvgIcon name="xia" :size="16" :color="iconColor" />
        </button>
      </el-tooltip>

      <!-- 下一个 -->
      <el-tooltip content="下一个匹配项 (Enter)" placement="bottom" :show-after="100" :effect="tooltipEffect">
        <button
          class="nav-btn"
          :disabled="!hasResults"
          @click="findNext"
        >
          <SvgIcon name="xia-2" :size="16" :color="iconColor" />
        </button>
      </el-tooltip>
    </div>

    <!-- 关闭按钮 -->
    <button class="close-btn" @click="close" title="关闭 (Esc)">
      <SvgIcon name="guanbi" :size="16" :color="iconColor" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  theme: { type: Object, default: () => ({}) },
  currentIndex: { type: Number, default: 0 },
  resultCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'close',
  'search',
  'find-next',
  'find-previous',
  'options-change',
])

/** 与 terminalThemes.light.background、ClaudeCodeStopFeedbackBar 一致 */
function isLightTerminalBg(bg) {
  const b = (bg || '').trim().toLowerCase()
  return b === '#fafafa' || b === '#ffffff' || b === '#fff'
}

// 根据主题背景色判断深浅
const iconColor = computed(() => {
  const bg = props.theme.background || '#0d1117'
  // 浅色主题用 #606572，深色主题用 #7B7B7B
  return isLightTerminalBg(bg) ? '#606572' : '#7B7B7B'
})

const tooltipEffect = computed(() => {
  const bg = props.theme.background || '#0d1117'
  return isLightTerminalBg(bg) ? 'light' : 'dark'
})

const searchInputRef = ref(null)
const searchQuery = ref('')
const caseSensitive = ref(false)
const useRegex = ref(false)
const wholeWord = ref(false)

let searchDebounceTimer = null
const SEARCH_DEBOUNCE_MS = 300

const placeholder = computed(() => {
  return '搜索当前 Tab 的终端内容'
})

const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
const modKeyName = isMac ? 'Cmd' : 'Alt'

const hasResults = computed(() => props.resultCount > 0)

const resultText = computed(() => {
  if (!searchQuery.value) return ''
  if (props.resultCount === 0) return '0/0'
  if (props.resultCount > 1000) return `${props.currentIndex + 1}/1000+`
  return `${props.currentIndex + 1}/${props.resultCount}`
})

const barStyle = computed(() => {
  const bg = props.theme.background || '#0d1117'
  const isLight = isLightTerminalBg(bg)

  return {
    '--search-bg': props.theme.dialogBg || 'rgba(20, 25, 35, 0.96)',
    '--search-border': props.theme.dialogBorder || 'rgba(255, 255, 255, 0.1)',
    '--search-text': props.theme.dialogInputText || 'rgba(255, 255, 255, 0.9)',
    '--search-input-bg': props.theme.dialogInputBg || 'rgba(255, 255, 255, 0.06)',
    '--search-input-border': props.theme.dialogInputBorder || 'rgba(255, 255, 255, 0.15)',
    '--btn-text': props.theme.btnText || 'rgba(255, 255, 255, 0.7)',
    '--btn-hover-bg': props.theme.btnHoverBg || 'rgba(255, 255, 255, 0.1)',
    '--btn-active-bg': '#409eff',
    '--btn-active-text': '#fff',
    '--no-results-border': '#ff4444',
    '--divider-color': isLight ? '#D8D8D8' : '#333333',
    '--placeholder-color': isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)',
  }
})

function onSearchInput() {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    performSearch()
  }, SEARCH_DEBOUNCE_MS)
}

function performSearch() {
  emit('search', {
    query: searchQuery.value,
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
    wholeWord: wholeWord.value,
  })
}

function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) {
      findPrevious()
    } else {
      findNext()
    }
  }
  // Esc 和 Cmd/Alt+C/R 快捷键已在 ClaudeCodeView 层级处理
}

function toggleCaseSensitive() {
  caseSensitive.value = !caseSensitive.value
  emitOptionsChange()
  performSearch()
}

function toggleRegex() {
  useRegex.value = !useRegex.value
  emitOptionsChange()
  performSearch()
}

function toggleWholeWord() {
  wholeWord.value = !wholeWord.value
  emitOptionsChange()
  performSearch()
}

function emitOptionsChange() {
  emit('options-change', {
    caseSensitive: caseSensitive.value,
    useRegex: useRegex.value,
    wholeWord: wholeWord.value,
  })
}

function findNext() {
  if (hasResults.value) {
    emit('find-next')
  }
}

function findPrevious() {
  if (hasResults.value) {
    emit('find-previous')
  }
}

function close() {
  emit('close')
}

function focus() {
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

// 组件挂载时自动聚焦
onMounted(() => {
  focus()
})

defineExpose({
  focus,
  searchQuery,
  toggleCaseSensitive,
  toggleRegex,
  toggleWholeWord,
})
</script>


<style scoped>
.terminal-search-bar {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--search-bg);
  border-bottom: 1px solid var(--tab-border);
  font-size: 12px;
  user-select: none;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.search-input {
  flex: 1;
  height: 28px;
  /* padding: 0 12px; */
  background: transparent;
  border: none;
  color: var(--search-text);
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  outline: none;
}

.search-input::placeholder {
  color: var(--placeholder-color);
}



/* 竖线分隔符 - 选项按钮右侧 */
.search-options::after {
  content: '';
  width: 1px;
  height: 16px;
  background: var(--divider-color);
  margin: 0 8px 0 8px;
}

.search-options::before {
  content: '';
  width: 1px;
  height: 16px;
  background: var(--divider-color);
  margin: 0 4px 0 8px;
}

.search-options,
.search-navigation {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-navigation {
  justify-content: flex-end;
}

.option-btn,
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
}

.option-btn:hover,
.close-btn:hover,
.nav-btn:hover {
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
}

/* .option-btn.active {
  background: rgba(255, 255, 255, 0.15);
} */



.result-count {
  font-size: 11px;
  color: var(--btn-text);
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  white-space: nowrap;
}

.result-count.no-results {
  color: var(--no-results-border);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin-left: 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}


</style>
