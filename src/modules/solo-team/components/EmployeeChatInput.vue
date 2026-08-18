<template>
  <div class="deerflow-input-wrapper">
    <div class="deerflow-input-inner">
      <div class="input-glow" aria-hidden="true" />
      <div v-if="showWelcomePromptBar && displayedWelcomeActions.length" class="welcome-prompt-bar">
        <div
          class="welcome-prompt-bar__scroll"
          :class="{
            'welcome-prompt-bar__scroll--single': displayedWelcomeActions.length === 1,
            'welcome-prompt-bar__scroll--equal': displayedWelcomeActions.length > 1,
          }"
        >
          <button
            v-for="item in displayedWelcomeActions"
            :key="`${welcomeBatchIndex}-${item.id}`"
            type="button"
            class="welcome-prompt-pill"
            :class="`welcome-prompt-pill--${item.tone}`"
            :disabled="disabled"
            @click="handleWelcomePillClick(item)"
          >
            <img
              v-if="item.iconUrl"
              :src="item.iconUrl"
              alt=""
              class="welcome-prompt-pill__icon"
            />
            <span v-else class="welcome-prompt-pill__emoji">{{ item.emoji }}</span>
            <span class="welcome-prompt-pill__title">{{ truncateEmployeeWelcomePillTitle(item.title) }}</span>
          </button>
        </div>
        <button
          v-if="showWelcomePromptRotate"
          type="button"
          class="welcome-prompt-bar__refresh"
          @click="rotateWelcomeActions"
        >
          <img :src="refreshIcon" alt="" class="welcome-prompt-bar__refresh-icon" width="14" height="14" />
          <span>换一换</span>
        </button>
      </div>
      <div ref="inputWrapperRef" class="input-wrapper" :class="{ focused: isFocused }">
      <div class="input-container" :class="{ 'has-file-preview': selectedFiles.length > 0, disabled }">
        <EmployeeDeerflowQuoteBar
          v-if="quotingMessage"
          :quoting-message="quotingMessage"
          :assistant-name="employeeName"
          @cancel="emit('cancel-quote')"
        />

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

        <div class="textarea-wrapper">
          <div v-if="selectedSkills.length" class="skill-tags-row">
            <SkillTag
              v-for="(skill, idx) in selectedSkills"
              :key="skill.id || skill.slug || idx"
              :skill="skill"
              @remove="removeSkill(idx)"
            />
          </div>
          <div
            ref="editableRef"
            class="chat-textarea chat-input-editable"
            contenteditable="plaintext-only"
            role="textbox"
            tabindex="0"
            spellcheck="false"
            aria-multiline="true"
            :class="{ 'is-placeholder': !inputText.trim() }"
            :data-placeholder="placeholder"
            @input="onEditableInput"
            @keydown="handleKeydown"
            @paste="handlePaste"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
            @focus="isFocused = true"
            @blur="isFocused = false"
          />
        </div>

        <div class="input-bottom">
          <div class="input-bottom-left">
            <el-tooltip :content="UPLOAD_TOOLTIP_TEXT" placement="top" :show-after="400">
              <button type="button" class="upload-btn" :disabled="disabled" @click="triggerFileSelect">
                <SvgIcon name="icon-fujian1" :size="16" :color="'#606572'" />
              </button>
            </el-tooltip>
            <input
              ref="fileInputRef"
              type="file"
              :accept="UPLOAD_ACCEPT"
              style="display: none"
              @change="handleFileSelect"
            />
            <el-tooltip v-if="employeeAgentId" content="选择技能" placement="top" :show-after="400">
              <span class="skill-selector-wrap">
                <EmployeeSkillSelector :agent-id="employeeAgentId" :show-market="showSkillMarket" @select="onSelectSkill" />
              </span>
            </el-tooltip>
          </div>

          <div class="input-bottom-right">
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

            <el-popover
              v-if="showModelSelector && models.length"
              v-model:visible="modelPopoverVisible"
              placement="top-end"
              :width="260"
              trigger="click"
              popper-class="model-selector-popper"
            >
              <template #reference>
                <button type="button" class="model-trigger-btn" :disabled="disabled">
                  <img :src="kookyIcon" alt="" style="width: 16px;" />
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

            <button v-if="isStreaming" class="stop-btn" @click="emit('stop')">
              <span class="stop-icon" />
            </button>
            <button
              v-else
              class="send-btn"
              :class="{ active: canSend }"
              :disabled="!canSend"
              @click="handleSend"
            >
              <img :src="sendIcon" alt="send" class="send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <p class="input-disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import sendIcon from '@/assets/home/send_icon.svg'
import fpRemoveIcon from '@/assets/home/fp-remove.svg'
import expandIcon from '@/assets/home/expand.svg'
import refreshIcon from '@/assets/soloTeam/refresh_icon.svg'
import flashIcon from '@/assets/deerflowChat/flash.svg'
import thinkIcon from '@/assets/deerflowChat/think.svg'
import proIcon from '@/assets/deerflowChat/pro.svg'
import ultraIcon from '@/assets/deerflowChat/ultra.svg'
import kookyIcon from '@/assets/deerflowChat/kooky.png'
import { getChatFileTypeFromName, getChatFileIconSrc } from '@/shared/utils/chatFileIcons'
import EmployeeSkillSelector from './EmployeeSkillSelector.vue'
import SkillTag from '@/shared/components/skill/SkillTag.vue'
import EmployeeDeerflowQuoteBar from './EmployeeDeerflowQuoteBar.vue'
import { useEmployeeDeerflowInputEditable } from '../composables/useEmployeeDeerflowInputEditable'
import { useEmployeeDeerflowSkill } from '../composables/useEmployeeDeerflowSkill'
import { useEmployeeDeerflowFileDropConsumer } from '../composables/useEmployeeDeerflowFileDrop'
import { useEmployeeWelcomePrompts, truncateEmployeeWelcomePillTitle } from '../composables/useEmployeeWelcomePrompts'
import { useSoloTeamStore } from '../store'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'

defineOptions({ name: 'EmployeeChatInput' })

const props = defineProps({
  disabled: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  /** 协作数字人对话等场景可关闭模型下拉 */
  showModelSelector: { type: Boolean, default: true },
  /** 协作数字人对话等场景可关闭技能市场入口 */
  showSkillMarket: { type: Boolean, default: true },
  showWelcomePromptBar: { type: Boolean, default: false },
  /** false：一人团队 / 我的员工不请求提示词接口；协作数字人传 true */
  fetchWelcomePrompts: { type: Boolean, default: true },
  placeholder: { type: String, default: '你可以输入任何你想做的事情，也可以给我起一个心仪的名字' },
  quotingMessage: { type: Object, default: null },
  employeeName: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'stop', 'cancel-quote'])

const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const employeeSessionStore = injectedSessionStore ?? useSoloTeamStore()

const editableRef = ref(null)
const inputWrapperRef = ref(null)
const fileInputRef = ref(null)
const isFileSelecting = ref(false)
const selectedFiles = ref([])
const selectedSkills = ref([])
const isFocused = ref(false)
const mode = ref(
  employeeSessionStore.employeeUserSelectedMode
  || (employeeSessionStore.currentEmployeeModelSupportsThinking ? 'pro' : 'flash')
)
const modePopoverVisible = ref(false)
const modelPopoverVisible = ref(false)

const employeeAgentId = computed(() => employeeSessionStore.employeeSkillBindingAgentId)

// 与「我的分身」DeerflowInput 一致（见 DeerflowInput.vue）
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_FILE_COUNT = 5
const UPLOAD_TOOLTIP_TEXT = '上传附件（单次最多 5 个，总大小不超过 100MB）'
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

function getFileExtension(filename) {
  const base = (filename || '').split(/[/\\]/).pop() || ''
  const i = base.lastIndexOf('.')
  if (i <= 0) return ''
  return base.slice(i + 1).toLowerCase()
}

function isAllowedFile(file) {
  const ext = getFileExtension(file.name)
  return ext.length > 0 && ALLOWED_EXT_SET.has(ext)
}

function addFileItems(files) {
  if (!files?.length) return

  const remaining = MAX_FILE_COUNT - selectedFiles.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多支持 ${MAX_FILE_COUNT} 个文件`)
    return
  }

  const typeRejected = files.filter(f => !isAllowedFile(f))
  if (typeRejected.length) {
    ElMessage.warning(ALLOWED_TYPES_MSG)
  }
  const typeOk = files.filter(isAllowedFile)
  if (!typeOk.length) return

  const oversized = typeOk.filter(f => f.size > MAX_FILE_SIZE)
  if (oversized.length) {
    ElMessage.warning(`单个文件不可超过 50MB，已跳过：${oversized.map(f => f.name).join('、')}`)
  }
  const withinLimit = typeOk.filter(f => f.size <= MAX_FILE_SIZE)
  if (!withinLimit.length) return

  const toAdd = withinLimit.slice(0, remaining)
  if (withinLimit.length > remaining) {
    ElMessage.warning(`已选 ${withinLimit.length} 个有效文件，超出上限，仅添加前 ${remaining} 个`)
  }

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

  finalToAdd.forEach((file) => {
    selectedFiles.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
    })
  })
}

const models = computed(() => {
  const chatAvail = employeeSessionStore.employeeChatAvailableModels || []
  return chatAvail.map(chatModel => ({
    name: chatModel.model_name,
    display_name: chatModel.display_name || chatModel.model_name,
    supports_thinking: chatModel.supports_thinking ?? false,
    ...chatModel,
  }))
})

const selectedModel = ref(employeeSessionStore.employeeUserSelectedModelName || employeeSessionStore.employeeSelectedModelName)

watch(() => employeeSessionStore.employeeSelectedModelName, (val) => {
  if (val && !employeeSessionStore.employeeUserSelectedModelName) {
    selectedModel.value = val
  }
}, { immediate: true })

watch(selectedModel, (newModelName) => {
  const eid = employeeSessionStore.currentEmployeeId
  const tid = employeeSessionStore.currentEmployeeThreadId
  if (newModelName && eid && tid) {
    if (newModelName !== employeeSessionStore.employeeSelectedModelName) {
      employeeSessionStore.setEmployeeSelectedModel(eid, tid, newModelName)
    }
  }
  const model = models.value.find(m => m.name === newModelName)
  if (!model) return
  if (!model.supports_thinking && mode.value !== 'flash') {
    mode.value = 'flash'
    ElMessage.info('当前模型不支持深度思考，已自动切换到闪速模式')
  }
})

watch(() => employeeSessionStore.employeePendingPrefillText, async (text) => {
  if (!text) return
  employeeSessionStore.clearEmployeePendingPrefillText()
  inputText.value = text
  await nextTick()
  if (!editableRef.value) return
  editableRef.value.textContent = text
  editableRef.value.focus()
  const range = document.createRange()
  const selection = window.getSelection()
  range.selectNodeContents(editableRef.value)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
}, { immediate: true })

const currentModelOption = computed(() => {
  const chatAvail = employeeSessionStore.employeeChatAvailableModels || []
  if (chatAvail.length > 0) {
    const chatModel = chatAvail.find(
      m => m.model_name === selectedModel.value,
    )
    if (chatModel) {
      return {
        name: chatModel.model_name,
        display_name: chatModel.display_name || chatModel.model_name,
        supports_thinking: chatModel.supports_thinking ?? false,
        ...chatModel,
      }
    }
  }
  return models.value.find(m => m.name === selectedModel.value) || models.value[0] || null
})

const { inputText, isComposing, onCompositionStart, onCompositionEnd, handlePaste, onEditableInput, clearEditable } = useEmployeeDeerflowInputEditable(editableRef, {
  maxHeight: 108,
  onPasteFiles: addFileItems,
})

const modeOptions = [
  { value: 'flash', label: '闪速', icon: flashIcon, desc: '快速且高效的完成任务，但可能不够精准' },
  { value: 'thinking', label: '思考', icon: thinkIcon, desc: '思考后再行动，在时间与准确性之间取得平衡' },
  { value: 'pro', label: 'Pro', icon: proIcon, desc: '思考、计划再执行，获得更精准的结果，可能需要更多时间' },
  { value: 'ultra', label: 'Ultra', icon: ultraIcon, desc: '继承自 Pro 模式，可调用子代理分工协作，适合复杂多步骤任务，能力最强' },
]

const currentModeOption = computed(() => modeOptions.find(item => item.value === mode.value) || modeOptions[0])
const hasFiles = computed(() => selectedFiles.value.length > 0)
const { canSend: skillCanSend, handleSkillTagKeydown, buildSendText } = useEmployeeDeerflowSkill({
  selectedSkills,
  inputText,
  isComposing,
  hasFiles,
})
const canSend = computed(() => !props.disabled && !props.isLoading && !props.isStreaming && skillCanSend.value)

useEmployeeDeerflowFileDropConsumer((files) => {
  addFileItems(files)
  nextTick(() => { editableRef.value?.focus() })
})

const {
  welcomeInputWidth,
  welcomeBatchIndex,
  displayedWelcomeActions,
  rotateWelcomeActions,
  showWelcomePromptRotate,
} = useEmployeeWelcomePrompts(employeeAgentId, {
  fixedPerPage: 4,
  fetchWelcomePrompts: toRef(props, 'fetchWelcomePrompts'),
})

let inputWelcomeResizeObserver = null

function attachInputWelcomeWidthObserver() {
  inputWelcomeResizeObserver?.disconnect()
  inputWelcomeResizeObserver = null
  if (!props.showWelcomePromptBar) return
  const el = inputWrapperRef.value
  if (!el) return
  welcomeInputWidth.value = el.getBoundingClientRect().width || 760
  inputWelcomeResizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width
    if (w) welcomeInputWidth.value = w
  })
  inputWelcomeResizeObserver.observe(el)
}

watch(() => props.showWelcomePromptBar, (show) => {
  if (show) nextTick(() => attachInputWelcomeWidthObserver())
  else {
    inputWelcomeResizeObserver?.disconnect()
    inputWelcomeResizeObserver = null
  }
})

let isFirstModeWatch = true
watch(() => employeeSessionStore.currentEmployeeModelSupportsThinking, (supportsThinking) => {
  if (isFirstModeWatch && !employeeSessionStore.employeeUserSelectedMode) {
    mode.value = supportsThinking ? 'pro' : 'flash'
  }
  isFirstModeWatch = false
}, { immediate: true })

onMounted(() => {
  nextTick(() => attachInputWelcomeWidthObserver())
})

onBeforeUnmount(() => {
  inputWelcomeResizeObserver?.disconnect()
  inputWelcomeResizeObserver = null
})

async function selectModel(modelName) {
  const prev = selectedModel.value
  selectedModel.value = modelName
  modelPopoverVisible.value = false

  const eid = employeeSessionStore.currentEmployeeId
  const tid = employeeSessionStore.currentEmployeeThreadId
  const chatAvail = employeeSessionStore.employeeChatAvailableModels || []
  if (!eid || !tid || !chatAvail.length) return

  const modelConfig = chatAvail.find(m => m.model_name === modelName)
  if (!modelConfig) {
    console.warn('[EmployeeChatInput] Model config not found for:', modelName)
    return
  }

  try {
    await employeeSessionStore.updateEmployeeChatModelSelection(eid, tid, modelName)
  } catch {
    selectedModel.value = prev
    employeeSessionStore.setEmployeeSelectedModel(eid, tid, prev)
  }
}

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
}

function handleKeydown(e) {
  if (handleSkillTagKeydown(e)) return
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    e.preventDefault()
    handleSend()
  }
}

const EDITABLE_MAX_HEIGHT = 108

function handleWelcomePillClick(item) {
  const text = String(item.content || item.title || '').trim()
  if (!text || props.disabled) return
  inputText.value = text
  nextTick(() => {
    const el = editableRef.value
    if (!el) return
    el.innerText = text
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, EDITABLE_MAX_HEIGHT)}px`
    el.focus()
    const range = document.createRange()
    const selection = window.getSelection()
    range.selectNodeContents(el)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}

function triggerFileSelect() {
  if (isFileSelecting.value) return
  isFileSelecting.value = true
  fileInputRef.value?.click()
  setTimeout(() => {
    isFileSelecting.value = false
  }, 300)
}

function handleFileSelect(e) {
  addFileItems(Array.from(e.target.files || []))
  if (fileInputRef.value) fileInputRef.value.value = ''
  nextTick(() => { editableRef.value?.focus() })
}

function removeFile(index) {
  selectedFiles.value.splice(index, 1)
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function selectMode(value) {
  mode.value = value
  employeeSessionStore.setEmployeeSelectedMode(value)
  modePopoverVisible.value = false
}

function clearInput() {
  selectedFiles.value = []
  selectedSkills.value = []
  clearEditable()
}

function handleSend() {
  if (!canSend.value) return
  const { text, skills } = buildSendText(inputText.value.trim())
  const modelName =
    selectedModel.value ||
    employeeSessionStore.employeeSelectedModelName ||
    'qwen-plus-default'
  emit('submit', {
    text,
    files: selectedFiles.value.map(item => item.file),
    mode: mode.value,
    model: modelName,
    skills,
  })
  clearInput()
  if (props.quotingMessage) emit('cancel-quote')
}

defineExpose({ focus: () => editableRef.value?.focus() })
</script>

<style lang="scss" scoped>
.deerflow-input-wrapper {
  flex-shrink: 0;
  padding: 4px 24px 20px;
  background: #fff;
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.deerflow-input-inner {
  position: relative;
  z-index: 0;
  width: 100%;
  max-width: 952px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.input-disclaimer {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  color: #A6ACB9;
  user-select: none;
}

.welcome-prompt-bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 10px;
  min-width: 0;
}

.welcome-prompt-bar__scroll {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: hidden;
  padding: 2px 0;
}

.welcome-prompt-bar__scroll--single {
  justify-content: flex-start;
  overflow-x: visible;
}

.welcome-prompt-bar__scroll--single .welcome-prompt-pill {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  max-width: min(480px, 100%);
}

.welcome-prompt-bar__scroll--equal {
  justify-content: stretch;
}

.welcome-prompt-bar__scroll--equal .welcome-prompt-pill {
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  width: 0;
}

.welcome-prompt-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(240px, 72vw);
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #eceef3;
  background: #fff;
  font-size: 12px;
  line-height: 1.3;
  color: #4b5563;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.12s ease, transform 0.12s ease;
}

.welcome-prompt-pill:hover:not(:disabled) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.welcome-prompt-pill:active:not(:disabled) {
  transform: scale(0.98);
}

.welcome-prompt-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.welcome-prompt-pill__emoji {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
}

.welcome-prompt-pill__icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  object-fit: cover;
}

.welcome-prompt-pill__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.welcome-prompt-pill--gold {
  background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
}

.welcome-prompt-pill--green {
  background: linear-gradient(180deg, #f5fbf2 0%, #fbfdf9 100%);
}

.welcome-prompt-pill--blue {
  background: linear-gradient(180deg, #f4f8ff 0%, #fbfcff 100%);
}

.welcome-prompt-pill--purple {
  background: linear-gradient(180deg, #faf5ff 0%, #fdfbff 100%);
}

.welcome-prompt-bar__refresh {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0 0 0 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;
}

.welcome-prompt-bar__refresh:hover {
  color: #606773;
}

.welcome-prompt-bar__refresh-icon {
  display: block;
  flex-shrink: 0;
}

.input-wrapper {
  position: relative;
  width: 100%;
  background: rgba(180, 180, 180, 0.3);
  border-radius: 16px;
  padding: 1.5px;
  box-shadow: 4px 4px 6px #91949e24;
  z-index: 2;
  transition: background 0.3s;
  container-type: inline-size;
  container-name: employee-input;
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
  position: absolute;
  top: -44px;
  left: 0;
  right: 0;
  width: 100%;
  height: 40px;
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
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.input-container.disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.fp-icon-wrap {
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

.file-preview-card:hover .fp-remove {
  opacity: 1;
  pointer-events: auto;
}

.textarea-wrapper {
  position: relative;
  margin-left: 4px;
  width: calc(100% - 4px);
  box-sizing: border-box;
}

.skill-tags-row {
  position: relative;
  z-index: 2;
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

.chat-input-editable.is-placeholder::before {
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
}

.input-bottom-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-trigger-label {
  font-size: 13px;
  color: #374151;
}

.model-trigger-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.mode-trigger-btn,
.model-trigger-btn,
.send-btn {
  border: none;
  cursor: pointer;
  background: transparent;
}

.upload-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #E3E3E3;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  box-sizing: border-box;
  transition: background 0.15s;
}

.upload-btn:hover:not(:disabled) {
  background: #F7F8FA;
}

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

.send-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

/* 与「我的分身」DeerflowInput 一致：流式时占位发送钮位置 */
.stop-btn {
  width: 28px;
  height: 28px;
  border-radius: 9.6px;
  border: none;
  background: #171B26;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.2s ease;
}

.send-btn {
  color: #ffffff;
  cursor: not-allowed;
  border-radius: 9.6px;
  background: rgba(2, 2, 2, 0.5);
  border: none;
}

.send-btn.active {
  background: #020202;
  cursor: pointer;
}

.send-btn.active:hover {
  transform: scale(1.05);
}

.input-wrapper.focused .send-btn {
  background: #171B26;
}

.send-icon {
  width: 16px;
  height: 16px;
}

.stop-icon {
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 2px;
  display: block;
}

.send-btn:disabled,
.upload-btn:disabled,
.mode-trigger-btn:disabled,
.model-trigger-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* 窄屏（如侧栏展开数字员工管理）：隐藏占位文案，优先露出底部操作栏 —— 对齐设计稿 */
@container employee-input (max-width: 440px) {
  .input-container {
    padding: 8px 8px 6px;
  }

  .input-bottom {
    margin-top: 4px;
  }

  .input-bottom-left,
  .input-bottom-right {
    gap: 4px;
    flex-shrink: 0;
  }
}

@container employee-input (max-width: 380px) {
  .mode-trigger-label,
  .model-trigger-label {
    display: none;
  }

  .mode-trigger-btn,
  .model-trigger-btn {
    padding: 0 6px;
    gap: 4px;
    min-width: 28px;
    justify-content: center;
  }

  .model-trigger-btn .model-trigger-arrow {
    margin: 0;
  }
}
</style>

<style>
.mode-selector-popper.el-popover,
.model-selector-popper.el-popover {
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
}

.mode-selector-panel,
.model-selector-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-selector-title,
.model-selector-title {
  font-size: 12px;
  color: #9ca3af;
  padding: 4px 8px 6px;
  font-weight: 500;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.mode-option:hover,
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
