<template>
  <div class="factory-file-editor">
    <!-- 顶部 Bar：路径 + 状态 -->
    <div class="editor-bar">
      <div class="bar-path">
        <template v-for="(seg, idx) in pathSegments" :key="idx">
          <span class="bar-seg" :class="{ last: idx === pathSegments.length - 1 }">{{ seg }}</span>
          <span v-if="idx < pathSegments.length - 1" class="bar-sep">/</span>
        </template>
      </div>
      <div class="bar-meta">
        <span v-if="isGenerating" class="generating-tag">
          <span class="g-icon">✨</span>
          <span>正在生成</span>
          <span class="dots"><i></i><i></i><i></i></span>
        </span>
        <span v-else-if="lastUpdatedText" class="updated-text">{{ lastUpdatedText }}</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="editor-body">
      <!-- 空状态：文件还没生成 -->
      <div v-if="!fileEntry" class="editor-empty">
        <div class="empty-icon">📝</div>
        <div class="empty-title">此文件还未生成内容</div>
        <div class="empty-sub">Agent Creator 在生成对应内容时会自动同步到这里</div>
        <button class="empty-btn" @click="handleManualCreate">手动创建空文件</button>
      </div>

      <!-- 编辑器 -->
      <textarea
        v-else
        class="editor-textarea"
        :value="fileEntry.content"
        :readonly="isGenerating"
        :placeholder="isGenerating ? 'Agent 正在写入...' : ''"
        spellcheck="false"
        @input="onInput"
      />
    </div>
  </div>
</template>

<script setup>
// 工厂代码 Tab：右侧轻量代码编辑器
defineOptions({ name: 'FactoryFileEditor' })

import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useFactoryStore } from '../store'

const factoryStore = useFactoryStore()
const { selectedCodePath, codeFiles } = storeToRefs(factoryStore)
const { getCodeFile, updateCodeFile } = factoryStore

// 当前文件条目（响应式：依赖 codeFiles 和 selectedCodePath）
const fileEntry = computed(() => {
  // 显式 touch codeFiles 让 computed 在写入时刷新
  // eslint-disable-next-line no-unused-expressions
  codeFiles.value
  return getCodeFile(selectedCodePath.value)
})

const isGenerating = computed(() => !!fileEntry.value?.generating)

// 路径分段（面包屑）
const pathSegments = computed(() => {
  const p = selectedCodePath.value || ''
  return p ? p.split('/') : []
})

// ─── 相对时间显示（轻量实现，避免引入 dayjs） ───
const now = ref(Date.now())
let timerId = null
onMounted(() => {
  timerId = setInterval(() => { now.value = Date.now() }, 5000)
})
onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId)
})

function fmtRelative(ts) {
  if (!ts) return ''
  const diff = Math.max(0, now.value - ts)
  const s = Math.floor(diff / 1000)
  if (s < 5) return '刚刚更新'
  if (s < 60) return `${s} 秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

const lastUpdatedText = computed(() => {
  const ts = fileEntry.value?.lastUpdated
  return ts ? fmtRelative(ts) : ''
})

// ─── 编辑联动 ───
function onInput(e) {
  if (isGenerating.value) return
  updateCodeFile(selectedCodePath.value, e.target.value, false)
}

function handleManualCreate() {
  updateCodeFile(selectedCodePath.value, '', false)
}
</script>

<style scoped lang="scss">
.factory-file-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: #fff;
  overflow: hidden;
}

.editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  flex: 0 0 auto;
}

.bar-path {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
}

.bar-seg {
  white-space: nowrap;

  &.last {
    color: #1f2937;
    font-weight: 600;
  }
}

.bar-sep {
  margin: 0 4px;
  color: #d1d5db;
}

.bar-meta {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #9ca3af;
  flex: 0 0 auto;
  margin-left: 12px;
}

.generating-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
  color: #6366f1;
  font-weight: 500;
  font-size: 12px;
}

.g-icon {
  margin-right: 4px;
}

.dots {
  display: inline-flex;
  margin-left: 4px;

  i {
    width: 3px;
    height: 3px;
    margin: 0 1px;
    background: #6366f1;
    border-radius: 50%;
    display: inline-block;
    animation: dot-blink 1.2s infinite both;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes dot-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

.updated-text {
  color: #9ca3af;
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.editor-textarea {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  padding: 16px 20px;
  border: none;
  outline: none;
  resize: none;
  background: #fafafa;
  color: #1f2937;
  font-family: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
}

.editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: #6b7280;
  background: #fafafa;
}

.empty-icon {
  font-size: 36px;
  line-height: 1;
  margin-bottom: 12px;
  opacity: 0.7;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.empty-sub {
  font-size: 12px;
  line-height: 1.6;
  color: #9ca3af;
  max-width: 320px;
  margin-bottom: 16px;
}

.empty-btn {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  color: #374151;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.04);
  }
}
</style>
