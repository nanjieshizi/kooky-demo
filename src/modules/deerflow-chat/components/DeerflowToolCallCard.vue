<script setup>
import { ref, computed, watch } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import {
  getToolDescription,
  getToolPath,
  getToolCommand,
  getToolQuery,
  getToolUrl,
  isFileTool,
  ToolType
} from '../utils/toolCallsUtils'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false }
})

const uiStore = useUIStore()
const showAllSteps = ref(false)

const lastToolCallStep = computed(() => {
  const toolCallSteps = props.steps.filter(s => s.type === 'toolCall')
  return toolCallSteps[toolCallSteps.length - 1] || null
})

const aboveLastToolCallSteps = computed(() => {
  if (!lastToolCallStep.value) return []
  const idx = props.steps.findIndex(s => s.id === lastToolCallStep.value.id)
  return idx > 0 ? props.steps.slice(0, idx) : []
})

const hiddenStepsCount = computed(() => aboveLastToolCallSteps.value.length)

// FlipDisplay：监听最后一个 step 的 id 变化，触发翻转动画
const flipKey = ref(lastToolCallStep.value?.id || '')
watch(lastToolCallStep, (next) => {
  if (next?.id !== flipKey.value) {
    flipKey.value = next?.id || ''
  }
})

function toggleShowAll() {
  showAllSteps.value = !showAllSteps.value
}

function openFilePreview(filePath) {
  if (!filePath) return
  uiStore.openFilePreview(filePath)
}

const collapsedTexts = ref({})

function shouldCollapseCode(result) {
  if (!result) return false
  return result.split('\n').length > 20
}

function getCollapsedCode(result) {
  return result.split('\n').slice(0, 20).join('\n') + '\n...'
}

function toggleCollapse(id) {
  collapsedTexts.value[id] = !collapsedTexts.value[id]
}

function shouldCollapseText(result) {
  if (!result) return false
  return result.split('\n').length > 10
}

function getCollapsedText(result) {
  return result.split('\n').slice(0, 10).join('\n') + '\n...'
}

// 工具名称映射（中文）
const toolNameMap = {
  [ToolType.WEB_SEARCH]: '搜索网页',
  [ToolType.IMAGE_SEARCH]: '搜索图片',
  [ToolType.WEB_FETCH]: '获取网页内容',
  [ToolType.LS]: '列出文件夹',
  [ToolType.READ_FILE]: '读取文件',
  [ToolType.WRITE_FILE]: '写入文件',
  [ToolType.STR_REPLACE]: '替换文件内容',
  [ToolType.BASH]: '执行命令',
  [ToolType.ASK_CLARIFICATION]: '需要您的帮助',
  [ToolType.WRITE_TODOS]: '更新待办事项',
  [ToolType.PRESENT_FILES]: '展示文件',
}

function getToolLabel(step) {
  if (!step) return ''
  const desc = getToolDescription(step.args)
  if (desc) return desc
  switch (step.name) {
    case ToolType.WEB_SEARCH: {
      const q = getToolQuery(step.args)
      return q ? `在网络上搜索: ${q}` : '搜索相关信息'
    }
    case ToolType.IMAGE_SEARCH: {
      const q = getToolQuery(step.args)
      return q ? `搜索相关图片: ${q}` : '搜索相关图片'
    }
    case ToolType.WEB_FETCH: return '查看网页内容'
    case ToolType.LS: return '列出文件夹内容'
    case ToolType.READ_FILE: return '读取文件'
    case ToolType.WRITE_FILE:
    case ToolType.STR_REPLACE: return '写入文件'
    case ToolType.BASH: return '执行命令'
    case ToolType.ASK_CLARIFICATION: return '需要您的帮助'
    case ToolType.WRITE_TODOS: return '更新待办事项'
    default: return toolNameMap[step.name] || `使用工具: ${step.name}`
  }
}

// 结果渲染类型
// 对齐 deer-flow：工具卡片只展示"做了什么（args）"，不展示执行结果（result）
// 仅 web_search / image_search 例外，因为结果本身就是展示内容
function getResultRenderType(name) {
  switch (name) {
    case ToolType.WEB_SEARCH: return 'search-links'
    case ToolType.IMAGE_SEARCH: return 'image-grid'
    default: return 'none'
  }
}

// SVG 图标组件
function getToolIcon(name) {
  const iconMap = {
    search: '<svg viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    folder: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>',
    book: '<svg viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>',
    edit: '<svg viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>',
    terminal: '<svg viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd"><path d="M6 9a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 6 9zM3.854 4.146a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2z"/><path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12z"/></svg>',
    question: '<svg viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/></svg>',
    todo: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/></svg>',
    tool: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3c0-.269-.035-.53-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814L1 0zm9.646 10.646a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708zM3 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242-.529-.026-.287-.445-.445-.287-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026L3 11z"/></svg>',
  }

  switch (name) {
    case ToolType.WEB_SEARCH:
    case ToolType.IMAGE_SEARCH: return iconMap.search
    case ToolType.WEB_FETCH: return iconMap.globe
    case ToolType.LS: return iconMap.folder
    case ToolType.READ_FILE: return iconMap.book
    case ToolType.WRITE_FILE:
    case ToolType.STR_REPLACE: return iconMap.edit
    case ToolType.BASH: return iconMap.terminal
    case ToolType.ASK_CLARIFICATION: return iconMap.question
    case ToolType.WRITE_TODOS: return iconMap.todo
    default: return iconMap.tool
  }
}

// 解析搜索结果链接
function parseSearchLinks(result) {
  if (!result) return []
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (Array.isArray(parsed)) return parsed.slice(0, 5)
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results.slice(0, 5)
  } catch (e) {
    console.warn('Failed to parse search links:', e)
  }
  return []
}

// 解析图片搜索结果
function parseImageGrid(result) {
  if (!result) return []
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (Array.isArray(parsed)) return parsed.slice(0, 8)
    if (parsed.images && Array.isArray(parsed.images)) return parsed.images.slice(0, 8)
  } catch (e) {
    console.warn('Failed to parse image grid:', e)
  }
  return []
}
</script>

<template>
  <div v-if="steps.length > 0" class="tool-calls-timeline">
    <!-- 折叠按钮 -->
    <button
      v-if="hiddenStepsCount > 0"
      class="expand-btn"
      @click="toggleShowAll"
    >
      <span class="expand-icon" :class="{ rotated: showAllSteps }">▸</span>
      <span>{{ showAllSteps ? '隐藏步骤' : `查看其它 ${hiddenStepsCount} 个步骤` }}</span>
    </button>

    <!-- 时间线容器 -->
    <div class="timeline-container">
      <!-- 展开的历史步骤 -->
      <template v-if="showAllSteps">
        <div
          v-for="step in aboveLastToolCallSteps"
          :key="step.id"
          class="timeline-step"
        >
          <div class="step-icon-wrapper">
            <div class="step-icon" v-html="getToolIcon(step.name)"></div>
            <div class="step-line"></div>
          </div>
          <div class="step-content">
            <div class="step-header">
              <span class="step-label">{{ getToolLabel(step) }}</span>
            </div>
            <pre v-if="getToolCommand(step.args)" class="step-command">{{ getToolCommand(step.args) }}</pre>
            <div v-else-if="getToolPath(step.args)" class="step-meta">
              <code>{{ getToolPath(step.args) }}</code>
            </div>
            <div v-else-if="getToolUrl(step.args)" class="step-meta">
              <code>{{ getToolUrl(step.args) }}</code>
            </div>
          </div>
        </div>
      </template>

      <!-- 最后一个步骤（带 FlipDisplay 动画） -->
      <div
        v-if="lastToolCallStep"
        :key="flipKey"
        class="timeline-step last-step flip-display"
      >
        <div class="step-icon-wrapper">
          <div class="step-icon" v-html="getToolIcon(lastToolCallStep.name)"></div>
        </div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-label">{{ getToolLabel(lastToolCallStep) }}</span>
            <span v-if="isLoading" class="loading-spinner"></span>
          </div>
          <!-- command：bash 优先用代码块样式展示，对齐 deer-flow CodeBlock -->
          <pre v-if="getToolCommand(lastToolCallStep.args)" class="step-command">{{ getToolCommand(lastToolCallStep.args) }}</pre>
          <!-- path：本地路径可点击打开预览，容器内路径（/开头）仅展示 -->
          <div
            v-else-if="getToolPath(lastToolCallStep.args)"
            class="step-meta"
            :class="{ clickable: isFileTool(lastToolCallStep.name) && !getToolPath(lastToolCallStep.args).startsWith('/') }"
            @click="isFileTool(lastToolCallStep.name) && !getToolPath(lastToolCallStep.args).startsWith('/') && openFilePreview(getToolPath(lastToolCallStep.args))"
          >
            <code>{{ getToolPath(lastToolCallStep.args) }}</code>
          </div>
          <div v-else-if="getToolUrl(lastToolCallStep.args)" class="step-meta">
            <code>{{ getToolUrl(lastToolCallStep.args) }}</code>
          </div>

          <!-- 结果渲染 -->
          <div v-if="lastToolCallStep.result && getResultRenderType(lastToolCallStep.name) !== 'none'" class="step-result">
            <!-- 搜索链接 -->
            <template v-if="getResultRenderType(lastToolCallStep.name) === 'search-links'">
              <div class="search-links">
                <a
                  v-for="(link, idx) in parseSearchLinks(lastToolCallStep.result)"
                  :key="idx"
                  :href="link.url"
                  target="_blank"
                  class="search-link"
                >
                  <div class="link-title">{{ link.title }}</div>
                  <div class="link-url">{{ link.url }}</div>
                </a>
              </div>
            </template>

            <!-- 图片网格 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'image-grid'">
              <div class="image-grid">
                <img
                  v-for="(img, idx) in parseImageGrid(lastToolCallStep.result)"
                  :key="idx"
                  :src="img.url || img"
                  :alt="img.title || ''"
                  class="grid-image"
                />
              </div>
            </template>

            <!-- 代码块 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'code-block'">
              <div class="code-block-wrapper">
                <pre class="code-block">{{
                  collapsedTexts[lastToolCallStep.id] || !shouldCollapseCode(lastToolCallStep.result)
                    ? lastToolCallStep.result
                    : getCollapsedCode(lastToolCallStep.result)
                }}</pre>
                <button
                  v-if="shouldCollapseCode(lastToolCallStep.result)"
                  class="toggle-btn"
                  @click="toggleCollapse(lastToolCallStep.id)"
                >
                  {{ collapsedTexts[lastToolCallStep.id] ? '收起' : '展开全部' }}
                </button>
              </div>
            </template>

            <!-- 可折叠文本 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'collapsible-text'">
              <div class="collapsible-text">
                <pre>{{
                  collapsedTexts[lastToolCallStep.id] || !shouldCollapseText(lastToolCallStep.result)
                    ? lastToolCallStep.result
                    : getCollapsedText(lastToolCallStep.result)
                }}</pre>
                <button
                  v-if="shouldCollapseText(lastToolCallStep.result)"
                  class="toggle-btn"
                  @click="toggleCollapse(lastToolCallStep.id)"
                >
                  {{ collapsedTexts[lastToolCallStep.id] ? '收起' : '展开' }}
                </button>
              </div>
            </template>

            <!-- 文件路径 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'file-path'">
              <div class="file-path">
                <code class="clickable" @click="openFilePreview(lastToolCallStep.result)">
                  {{ lastToolCallStep.result }}
                </code>
              </div>
            </template>

            <!-- 文件列表 -->
            <template v-else-if="getResultRenderType(lastToolCallStep.name) === 'plain-pre'">
              <pre class="plain-pre">{{ lastToolCallStep.result }}</pre>
            </template>

            <!-- 默认文本 -->
            <template v-else>
              <div class="result-text">{{ lastToolCallStep.result }}</div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-calls-timeline {
  margin: 12px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: #f9fafb;
  border: none;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  transition: background 0.15s;

  &:hover {
    background: #f3f4f6;
  }

  .expand-icon {
    font-size: 10px;
    transition: transform 0.2s;
    &.rotated {
      transform: rotate(90deg);
    }
  }
}

.timeline-container {
  padding: 16px;
}

.timeline-step {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease;

  &:not(:last-child) {
    margin-bottom: 20px;
  }

  &.last-step {
    margin-bottom: 0;
  }
}

.step-icon-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 50%;
  flex-shrink: 0;

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}

.step-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: #e5e7eb;
  margin-top: 4px;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.step-label {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.step-meta {
  margin-top: 4px;
  code {
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #6b7280;
    background: #f9fafb;
    padding: 2px 6px;
    border-radius: 4px;
  }
  &.clickable {
    cursor: pointer;
    code {
      color: #2563eb;
      background: #eff6ff;
      &:hover {
        background: #dbeafe;
      }
    }
  }
}

// bash 命令代码块（对齐 deer-flow CodeBlock 样式）
.step-command {
  margin: 6px 0 0;
  padding: 8px 10px;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}

.step-result {
  margin-top: 12px;
}

// 搜索链接
.search-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-link {
  display: block;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: #f3f4f6;
  }

  .link-title {
    font-size: 13px;
    color: #3b82f6;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .link-url {
    font-size: 12px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 图片网格
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.grid-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  background: #f3f4f6;
}

// 代码块
.code-block-wrapper {
  position: relative;

  .toggle-btn {
    margin-top: 8px;
    padding: 4px 12px;
    background: #f3f4f6;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #e5e7eb;
    }
  }
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

// 可折叠文本
.collapsible-text {
  pre {
    margin: 0;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .toggle-btn {
    margin-top: 8px;
    padding: 4px 12px;
    background: #f3f4f6;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #e5e7eb;
    }
  }
}

// 文件路径
.file-path {
  code {
    font-size: 13px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #374151;
    background: #f9fafb;
    padding: 8px 12px;
    border-radius: 6px;
    display: block;

    &.clickable {
      cursor: pointer;
      transition: background 0.15s;
      &:hover {
        background: #e5e7eb;
      }
    }
  }
}

// 文件列表
.plain-pre {
  margin: 0;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #374151;
  white-space: pre;
  overflow-x: auto;
}

// 默认文本
.result-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

// FlipDisplay 翻转动画
.flip-display {
  animation: flipIn 0.4s ease;
}

@keyframes flipIn {
  0% {
    opacity: 0;
    transform: perspective(400px) rotateX(-90deg);
  }
  40% {
    transform: perspective(400px) rotateX(20deg);
  }
  100% {
    opacity: 1;
    transform: perspective(400px) rotateX(0deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

