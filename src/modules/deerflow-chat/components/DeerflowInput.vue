<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import fileUploadIcon from '@/assets/deerflowChat/file.svg'
import fpRemoveIcon from '@/assets/home/fp-remove.svg'
import { getChatFileTypeFromName, getChatFileIconSrc } from '@/shared/utils/chatFileIcons'
import { useLibraryFileDrop } from '@/modules/file/composables/useLibraryFileDrop'
import { useDeerflowInputEditable } from '../composables/useDeerflowInputEditable'
import { useDeerflowFileDropConsumer } from '../composables/useDeerflowFileDrop'
import { useDeerflowSkill } from '../composables/useDeerflowSkill'
import { useDeerflowChatStore } from '../store'
import DeerflowQuoteBar from './DeerflowQuoteBar.vue'
import SkillSelector from './DeerflowSkillSelector.vue'
import SkillTag from '@/shared/components/skill/SkillTag.vue'
import SendIcon from '@/assets/home/send_icon.svg'
import expandIcon from '@/assets/home/expand.svg'
import flashIcon from '@/assets/deerflowChat/flash.svg'
import thinkIcon from '@/assets/deerflowChat/think.svg'
import proIcon from '@/assets/deerflowChat/pro.svg'
import ultraIcon from '@/assets/deerflowChat/ultra.svg'

// 文件上传限制常量（与 ChatFileUploadArea.vue 保持一致）
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_FILE_COUNT = 5
const UPLOAD_TOOLTIP_TEXT = '上传附件（单次最多 5 个，总大小不超过 100MB）'

// 允许的文件扩展名列表
const ALLOWED_EXT = [
  'md', 'txt',
  'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'html', 'htm', 'css', 'json', 'sql',
  'vue', 'svelte', 'yaml', 'yml', 'xml', 'toml', 'ini', 'sh', 'bash', 'zsh',
  'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts', 'dart', 'scala', 'cs',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx', 'r', 'lua', 'pl', 'pm', 'ex', 'exs',
  'less', 'scss', 'sass', 'graphql', 'gql',
  'docx', 'odt', 'pdf',
  'png', 'jpg', 'jpeg',
]
const ALLOWED_EXT_SET = new Set(ALLOWED_EXT)
const UPLOAD_ACCEPT = ALLOWED_EXT.map(e => `.${e}`).join(',')

const ALLOWED_TYPES_MSG = '仅支持 Markdown(.md)、纯文本(.txt)、常见代码(如 .py/.js/.html/.css/.json/.sql 等)、Word(.docx)/ODT/PDF、图片(.png/.jpg/.jpeg)'

const props = defineProps({
  placeholder: { type: String, default: '输入任何你想做的事情' },
  disabled: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  quotingMessage: { type: Object, default: null },
})

const emit = defineEmits(['submit', 'stop', 'cancel-quote'])

const store = useDeerflowChatStore()

// 输入框
const textareaRef = ref(null)
const { inputText, isComposing, onCompositionStart, onCompositionEnd, handlePaste, onEditableInput, clearEditable } = useDeerflowInputEditable(textareaRef, {
  maxHeight: 108,
  onPasteFiles: (files) => {
    addFileItems(files)
  }
})

// 文件上传
// 注：文件选择时仅保存在本地，实际上传在发送消息时由 store.sendMessage 统一处理
const fileInputRef = ref(null)
const selectedFiles = ref([]) // [{ id, file }]
const isFileSelecting = ref(false)

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 获取文件扩展名
function getFileExtension(filename) {
  const base = (filename || '').split(/[/\\]/).pop() || ''
  const i = base.lastIndexOf('.')
  if (i <= 0) return ''
  return base.slice(i + 1).toLowerCase()
}

// 判断是否为允许的文件类型（按扩展名）
function isAllowedFile(file) {
  const ext = getFileExtension(file.name)
  return ext.length > 0 && ALLOWED_EXT_SET.has(ext)
}

function addFileItems(files) {
  if (!files?.length) return

  // 1. 文件数量上限检查
  const remaining = MAX_FILE_COUNT - selectedFiles.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多支持 ${MAX_FILE_COUNT} 个文件`)
    return
  }

  // 2. 文件类型检查（按扩展名）
  const typeRejected = files.filter(f => !isAllowedFile(f))
  if (typeRejected.length) {
    ElMessage.warning(ALLOWED_TYPES_MSG)
  }
  const typeOk = files.filter(isAllowedFile)
  if (!typeOk.length) return

  // 3. 文件大小检查
  const oversized = typeOk.filter(f => f.size > MAX_FILE_SIZE)
  if (oversized.length) {
    ElMessage.warning(`单个文件不可超过 50MB，已跳过：${oversized.map(f => f.name).join('、')}`)
  }
  const withinLimit = typeOk.filter(f => f.size <= MAX_FILE_SIZE)
  if (!withinLimit.length) return

  // 4. 截取到上限范围内
  const toAdd = withinLimit.slice(0, remaining)
  if (withinLimit.length > remaining) {
    ElMessage.warning(`已选 ${withinLimit.length} 个有效文件，超出上限，仅添加前 ${remaining} 个`)
  }

  // 5. 总文件大小检查
  const currentTotalSize = selectedFiles.value.reduce((sum, item) => sum + (item.file.size || 0), 0)
  const finalToAdd = []
  let accSize = currentTotalSize
  for (const file of toAdd) {
    if (accSize + file.size > MAX_TOTAL_SIZE) {
      ElMessage.warning(`文件总大小不能超过 100MB，已跳过：${file.name}`)
      continue
    }
    accSize += file.size
    finalToAdd.push(file)
  }
  if (!finalToAdd.length) return

  finalToAdd.forEach(file => {
    selectedFiles.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
    })
  })
}

// 从文件库拖入 → 作为附件（mock 文件对象）
const { isOver: libOver, onDragOver: libDragOver, onDragLeave: libDragLeave, onDrop: libDrop } =
  useLibraryFileDrop((f) => {
    selectedFiles.value.push({
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: { name: f.name, size: f.bytes || 0, type: f.type || '' },
    })
  })

function handleFileSelect(e) {
  const files = Array.from(e.target.files || [])
  addFileItems(files)
  if (fileInputRef.value) fileInputRef.value.value = ''
  nextTick(() => { textareaRef.value?.focus() })
}

// 防抖的文件选择触发
function triggerFileSelect() {
  if (isFileSelecting.value) return
  isFileSelecting.value = true
  fileInputRef.value?.click()
  setTimeout(() => {
    isFileSelecting.value = false
  }, 300)
}

function removeFile(index) {
  selectedFiles.value.splice(index, 1)
}

// 拖拽文件消费
useDeerflowFileDropConsumer((files) => {
  addFileItems(files)
  nextTick(() => { textareaRef.value?.focus() })
})

// 技能选择
const selectedSkills = ref([])
const hasFiles = computed(() => selectedFiles.value.length > 0)

const { canSend: skillCanSend, handleSkillTagKeydown, buildSendText } = useDeerflowSkill({
  selectedSkills,
  inputText,
  isComposing,
  hasFiles,
})

function removeSkill(index) {
  selectedSkills.value.splice(index, 1)
}

function onSelectSkill(skill) {
  if (selectedSkills.value.length >= 5) {
    ElMessage.warning('最多选择 5 个技能')
    return
  }
  const exists = selectedSkills.value.some(s => (s.id || s.slug) === (skill.id || skill.slug))
  if (exists) {
    ElMessage.warning('该技能已选择')
    return
  }
  selectedSkills.value.push(skill)
  // 选择技能后自动聚焦输入框
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

// 模式选择：优先使用用户手动选择的模式，否则根据模型能力初始化
const mode = ref(store.userSelectedMode || (store.currentModelSupportsThinking ? 'pro' : 'flash'))
const modePopoverVisible = ref(false)

const modeOptions = [
  {
    value: 'flash',
    label: '闪速',
    icon: flashIcon,
    desc: '快速且高效的完成任务，但可能不够精准',
  },
  {
    value: 'thinking',
    label: '思考',
    icon: thinkIcon,
    desc: '思考后再行动，在时间与准确性之间取得平衡',
  },
  {
    value: 'pro',
    label: 'Pro',
    icon: proIcon,
    desc: '思考、计划再执行，获得更精准的结果，可能需要更多时间',
  },
  {
    value: 'ultra',
    label: 'Ultra',
    icon: ultraIcon,
    desc: '继承自 Pro 模式，可调用子代理分工协作，适合复杂多步骤任务，能力最强',
  },
]

const currentModeOption = computed(() => modeOptions.find(o => o.value === mode.value) || modeOptions[0])

function selectMode(val) {
  mode.value = val
  store.setSelectedMode(val)
  modePopoverVisible.value = false
}

// 仅在首次初始化且用户未手动选择时根据模型能力设置默认模式
let isFirstWatch = true
watch(() => store.currentModelSupportsThinking, (supportsThinking) => {
  if (isFirstWatch && !store.userSelectedMode) {
    mode.value = supportsThinking ? 'pro' : 'flash'
  }
  isFirstWatch = false
}, { immediate: true })

// 模型选择
const modelPopoverVisible = ref(false)

async function selectModel(modelName) {
  selectedModel.value = modelName
  modelPopoverVisible.value = false

  // 持久化到后端（与 deer-flow 对齐）
  const thread = store.threads.find(t => t.id === store.currentThreadId)
  const agentId = thread?.agent_id
  if (!agentId) return

  // 从 chatAvailableModels 中找到对应的模型配置
  const modelConfig = store.chatAvailableModels.find(m => m.model_name === modelName)
  if (!modelConfig) {
    console.warn('[DeerFlow] Model config not found for:', modelName)
    return
  }

  try {
    await store.updateModelSelection({
      provider_config_id: modelConfig.provider_config_id || null,
      model_config_id: modelConfig.model_config_id || null,
      agent_id: agentId,
    })
  } catch (err) {
    console.error('[DeerFlow] Failed to update model selection:', err)
    // 失败时不阻止用户继续使用，只是记录错误
  }
}

const currentModelOption = computed(() => {
  return models.value.find(m => m.model_name === selectedModel.value) || models.value[0] || null
})

const models = computed(() => {
  return store.chatAvailableModels.map(chatModel => ({
    name: chatModel.model_name,
    display_name: chatModel.display_name || chatModel.model_name,
    supports_thinking: chatModel.supports_thinking ?? false,
    ...chatModel,
  }))
})
// 优先使用用户手动选择的模型，否则用 store 当前值
const selectedModel = ref(store.userSelectedModelName || store.selectedModelName)

// 同步 store 的 selectedModelName 到本地 ref（用户手动选择过时不跟随）
watch(() => store.selectedModelName, (val) => {
  if (!store.userSelectedModelName) {
    selectedModel.value = val
  }
}, { immediate: true })

// 本地选择变化时同步到 store
watch(selectedModel, (val) => {
  if (val && val !== store.selectedModelName) {
    store.setSelectedModel(val)
  }
})

// 预填输入框文本（由外部通过 store.pendingPrefillText 触发）
watch(() => store.pendingPrefillText, async (text) => {
  if (!text) return
  store.pendingPrefillText = null
  // 统一通过 clearEditable 清空再写入，保持 inputText 与 DOM 一致
  clearEditable()
  await nextTick()
  if (textareaRef.value) {
    textareaRef.value.textContent = text
    // 手动同步 inputText，与 onEditableInput 保持一致
    inputText.value = text
    textareaRef.value.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(textareaRef.value)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
})

// 是否可发送
const canSend = computed(() => {
  if (props.disabled || props.isLoading) return false
  return skillCanSend.value
})

// 发送
function handleSend() {
  if (!canSend.value) return
  const { text, skills } = buildSendText(inputText.value.trim())
  emit('submit', {
    text,
    files: selectedFiles.value.map(item => item.file),
    mode: mode.value,
    model: selectedModel.value || 'claude-sonnet-4-6',
    skills: skills || [],
  })
  clearEditable()
  selectedFiles.value = []
  selectedSkills.value = []
  if (props.quotingMessage) emit('cancel-quote')
}

// 键盘事件
function handleKeydown(e) {
  if (handleSkillTagKeydown(e)) return
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    e.preventDefault()
    handleSend()
  }
}

defineExpose({ focus: () => textareaRef.value?.focus() })

// 是否聚焦（用于彩虹边框激活）
const isFocused = ref(false)
</script>

<template>
  <div
    class="deerflow-input-wrapper"
    :class="{ 'lib-drop-over': libOver }"
    @dragover="libDragOver"
    @dragleave="libDragLeave"
    @drop="libDrop"
  >
    <div class="input-wrapper" :class="{ focused: isFocused }">
      <div class="input-glow"></div>
      <!-- 主输入区 -->
      <div
        class="input-container"
        :class="{ 'has-file-preview': selectedFiles.length > 0, disabled: disabled }"
      >
        <!-- 引用预览条 -->
        <DeerflowQuoteBar
          v-if="quotingMessage"
          :quoting-message="quotingMessage"
          @cancel="emit('cancel-quote')"
        />

        <!-- 文件预览区 -->
        <div v-if="selectedFiles.length" class="file-preview-strip">
          <div v-for="(item, idx) in selectedFiles" :key="item.id" class="file-preview-card">
            <div class="fp-icon-wrap">
              <img :src="getChatFileIconSrc(getChatFileTypeFromName(item.file.name))" class="fp-icon" alt="" />
            </div>
            <div class="fp-info">
              <span class="fp-name">{{ item.file.name }}</span>
              <span class="fp-size">{{ formatFileSize(item.file.size) }}</span>
            </div>
            <button class="fp-remove" @click.stop="removeFile(idx)">
              <img :src="fpRemoveIcon" width="16" height="16" />
            </button>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="textarea-wrapper">
          <!-- 技能标签 -->
          <div v-if="selectedSkills.length" class="skill-tags-row">
            <SkillTag
              v-for="(skill, idx) in selectedSkills"
              :key="skill.id || skill.slug || idx"
              :skill="skill"
              @remove="removeSkill(idx)"
            />
          </div>
          <div
            ref="textareaRef"
            class="chat-textarea chat-input-editable"
            role="textbox"
            tabindex="0"
            spellcheck="false"
            contenteditable="plaintext-only"
            :class="{ 'is-placeholder': !inputText.trim() }"
            :data-placeholder="placeholder"
            aria-multiline="true"
            @input="onEditableInput"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
            @paste="handlePaste"
            @keydown="handleKeydown"
            @focus="isFocused = true"
            @blur="isFocused = false"
          />
        </div>

        <div class="input-bottom">
          <div class="input-bottom-left">
            <!-- 文件上传 -->
            <el-tooltip :content="UPLOAD_TOOLTIP_TEXT" placement="top" :show-after="400">
              <button
                type="button"
                class="upload-btn"
                :disabled="disabled"
                @click="triggerFileSelect"
              >
                <!-- <img :src="fileUploadIcon" alt="upload" class="upload-icon" /> -->
                <SvgIcon name="icon-fujian1" :size="14" color="currentColor" />
              </button>
            </el-tooltip>
            <input
              ref="fileInputRef"
              type="file"
              :accept="UPLOAD_ACCEPT"
              style="display: none"
              @change="handleFileSelect"
            />

            <!-- 技能选择器 -->
            <el-tooltip content="选择技能" placement="top">
              <span class="skill-selector-wrap">
                <SkillSelector
                  :agent-id="store.selectedAgentId"
                  @select="onSelectSkill"
                />
              </span>
            </el-tooltip>
          </div>

          <div class="input-bottom-right">
            <!-- 模式选择 -->
            <el-popover
              v-model:visible="modePopoverVisible"
              placement="top-end"
              :width="260"
              trigger="click"
              popper-class="mode-selector-popper"
            >
              <template #reference>
                <button type="button" class="mode-trigger-btn" :disabled="disabled">
                  <img :src="currentModeOption.icon" alt="" class="mode-trigger-icon" />
                  <span class="mode-trigger-label">{{ currentModeOption.label }}</span>
                  <img :src="expandIcon" alt="" class="mode-trigger-arrow" />
                </button>
              </template>

              <div class="mode-selector-panel">
                <div class="mode-selector-title">模式</div>
                <div
                  v-for="opt in modeOptions"
                  :key="opt.value"
                  class="mode-option"
                  :class="{ active: mode === opt.value }"
                  @click="selectMode(opt.value)"
                >
                  <img :src="opt.icon" alt="" class="mode-option-icon" />
                  <div class="mode-option-body">
                    <div class="mode-option-label">{{ opt.label }}</div>
                    <div class="mode-option-desc">{{ opt.desc }}</div>
                  </div>
                  <span v-if="mode === opt.value" class="mode-option-check">✓</span>
                </div>
              </div>
            </el-popover>

            <!-- 模型选择 -->
            <el-popover
              v-if="models && models.length"
              v-model:visible="modelPopoverVisible"
              placement="top-end"
              :width="260"
              trigger="click"
              popper-class="model-selector-popper"
            >
              <template #reference>
                <button type="button" class="model-trigger-btn" :disabled="disabled">
                  <span class="model-trigger-label">{{ currentModelOption?.display_name || '选择模型' }}</span>
                  <img :src="expandIcon" alt="" class="model-trigger-arrow" />
                </button>
              </template>

              <div class="model-selector-panel">
                <div class="model-selector-title">模型</div>
                <div
                  v-for="m in models"
                  :key="m.name"
                  class="mode-option"
                  :class="{ active: selectedModel === m.name }"
                  @click="selectModel(m.name)"
                >
                  <div class="mode-option-body">
                    <div class="mode-option-label">{{ m.display_name }}</div>
                  </div>
                  <span v-if="selectedModel === m.name" class="mode-option-check">✓</span>
                </div>
              </div>
            </el-popover>

            <!-- 发送 / 停止 -->
            <button
              v-if="isStreaming"
              class="stop-btn"
              @click="emit('stop')"
            >
              <span class="stop-icon" />
            </button>
            <button
              v-else
              class="send-btn"
              :class="{ active: canSend }"
              :disabled="!canSend"
              @click="handleSend"
            >
              <img :src="SendIcon" alt="send" class="send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <p class="input-disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
  </div>
</template>

<style lang="scss" scoped>
.deerflow-input-wrapper {
  padding: 4px 24px 20px;
  background: #fff;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.deerflow-input-wrapper > .input-wrapper {
  width: 100%;
  max-width: 952px;
}

.input-disclaimer {
  width: 100%;
  max-width: 952px;
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  color: #A6ACB9;
  user-select: none;
}

.input-wrapper {
  position: relative;
  background: rgba(180, 180, 180, 0.3);
  border-radius: 16px;
  padding: 1.5px;
  box-shadow: 4px 4px 6px #91949e24;
  z-index: 0;
  transition: background 0.3s;
}

.input-wrapper.focused {
  background: rgba(180, 180, 180, 0.3);
}

.input-wrapper::before {
  content: '';
  position: absolute;
  inset: 6px 5px 0px 5px;
  border-radius: 16px;
  z-index: 0;
  pointer-events: none;
  background: conic-gradient(
    from var(--arc-angle, 0turn),
    rgba(255, 151, 133, 1) 0%,
    rgba(255, 178, 95,  1) 14%,
    rgba(255, 221, 85,  1) 28%,
    rgba(45,  255, 203, 1) 42%,
    rgba(59,  180, 255, 1) 56%,
    rgba(0,   140, 255, 1) 70%,
    rgba(115, 60,  255, 1) 84%,
    rgba(255, 151, 133, 1) 100%
  );
  animation: arc-spin 4s linear infinite;
  filter: blur(6px);
  opacity: .6;
  transition: opacity .8s ease-out, filter .8s ease-out;
}

.input-wrapper.focused::before {
  inset: 3px 6px -3px 6px;
}

.input-wrapper::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 16px;
  background: #ffffff;
  z-index: 0;
  pointer-events: none;
}

.input-glow {
  height: 40px;
  position: absolute;
  width: 100%;
  margin-top: -44px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,1) 100%);
  pointer-events: none;
  z-index: 1;
}

.input-glow::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 100%);
  filter: blur(10px);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%);
  pointer-events: none;
}

.input-container {
  position: relative;
  border: none;
  border-radius: 12px;
  background: transparent;
  padding: 12px 12px 8px;
  z-index: 2;
}

@property --arc-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0turn;
}

@keyframes arc-spin {
  from { --arc-angle: 0turn; }
  to   { --arc-angle: 1turn; }
}

@media (prefers-reduced-motion: reduce) {
  .input-wrapper::before { animation: none; }
}

.input-container.has-file-preview {
  padding-top: 4px;
}

.input-container.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea-wrapper {
  position: relative;
  margin-left: 4px;
  width: calc(100% - 4px);
  box-sizing: border-box;
}

.skill-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
  padding: 0 0 6px;
}

.skill-selector-wrap {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.chat-textarea {
  display: block;
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  caret-color: #F58138;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  max-height: 108px;
  min-height: 60px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

.chat-textarea.chat-input-editable {
  resize: none;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
  caret-color: #F58138;
  -webkit-user-modify: read-write-plaintext-only;
}

.chat-input-editable.is-placeholder:before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 0;
}

.input-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.input-bottom-left {
  display: flex;
  align-items: center;

  .tool-btn {
    padding: 6px;
    color: #999;
    transition: color 0.2s;
    &:hover:not(:disabled) { color: #333; }
  }

  .mode-select,
/* 模型触发按钮 */
.model-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  transition: background 0.15s;
  white-space: nowrap;
  border: 1px solid #e3e3e3;
  &:hover:not(:disabled) {
    background: rgba(47, 53, 71, 0.06);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.model-trigger-label {
  font-size: 13px;
  color: #374151;
}

.model-trigger-arrow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* 模型选择面板 */
.model-selector-panel {
  padding: 8px 0;
}

.model-selector-title {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.model-option:hover {
  background: #f5f6f9;
}

.model-option.active {
  background: #f5f6f9;
}

.model-option-body {
  flex: 1;
  min-width: 0;
}

.model-option-label {
  font-size: 13px;
  font-weight: 500;
  color: #2f3547;
  margin-bottom: 2px;
}

.model-option-desc {
  font-size: 11px;
  color: #91949e;
  line-height: 1.4;
}

.model-option-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #e8f4ff;
  color: #1890ff;
  border-radius: 4px;
  flex-shrink: 0;
}

.model-option-check {
  font-size: 14px;
  color: #1890ff;
  flex-shrink: 0;
}
}

.upload-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: #F7F8FA;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.upload-icon {
  width: 14px;
  height: 14px;
}

/* 模式触发按钮 */
.mode-trigger-btn, .model-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 2px 8px;
  background: #F5F6F9;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: #2F3547;
  transition: background 0.15s;
  white-space: nowrap;
  border: transparent;
  &:hover:not(:disabled) {
    background: rgba(47, 53, 71, 0.06);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.mode-trigger-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.mode-trigger-label {
  font-size: 13px;
  color: #374151;
}

.mode-trigger-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.input-bottom-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.send-btn {
  width: 28px;
  height: 28px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  flex-shrink: 0;
  transition: all 0.2s ease;
  border-radius: 9.6px;
  background: rgba(2, 2, 2, 0.5);
  border: none;
}

.send-btn.active {
  background: #020202;
  cursor: pointer;
}

.send-icon {
  width: 16px;
  height: 16px;
}

.send-btn.active:hover {
  transform: scale(1.05);
}

.input-wrapper.focused .send-btn {
  background: #171B26;
}

/* 停止按钮 */
.stop-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f54c46;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-btn:hover {
  background: #e03e38;
  transform: scale(1.05);
}

.stop-icon {
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 2px;
}

/* ──── 文件预览区 ──── */
.file-preview-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0px 4px 0px;
  margin-bottom: 4px;
  scrollbar-width: thin;
}

.file-preview-strip::-webkit-scrollbar { height: 4px; }
.file-preview-strip::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }

.file-preview-card {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: 200px;
  min-height: 48px;
  padding: 8px 28px 8px 10px;
  border-radius: 8px;
  background: #F7F8FA;
  position: relative;
  box-sizing: border-box;
}

.file-preview-card.has-error {
  border: 1px solid #fca5a5;
  background: #fef2f2;
}

.fp-icon-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.fp-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: contain;
}

.fp-loading {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fp-loading::after {
  content: '';
  width: 14px;
  height: 14px;
  border: 2px solid #8478FA;
  border-top-color: transparent;
  border-radius: 50%;
  animation: fp-spin 0.7s linear infinite;
}

@keyframes fp-spin {
  to { transform: rotate(360deg); }
}

.fp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  line-height: 1.25;
}

.fp-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fp-size {
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fp-error {
  font-size: 11px;
  color: #ef4444;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.fp-retry {
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.fp-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #e5e7eb;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.fp-progress-bar {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.fp-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 1;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.file-preview-card:hover .fp-remove,
.file-preview-card:focus-within .fp-remove {
  opacity: 1;
  pointer-events: auto;
}

.fp-remove:hover {
  opacity: 0.8;
}
</style>

<style>
.mode-selector-popper.el-popover {
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

.mode-selector-panel, .model-selector-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-selector-title, .model-selector-title {
  font-size: 12px;
  color: #9ca3af;
  padding: 4px 8px 6px;
  font-weight: 500;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.mode-option:hover {
  background: #f5f6f9;
}

.mode-option.active {
  background: #f5f6f9;
}

.mode-option-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.mode-option-body {
  flex: 1;
  min-width: 0;
}

.mode-option-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.mode-option-desc {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
  margin-top: 2px;
}

.mode-option-check {
  font-size: 14px;
  color: #FF5233;
  flex-shrink: 0;
  margin-top: 2px;
  font-weight: 600;
}
</style>

