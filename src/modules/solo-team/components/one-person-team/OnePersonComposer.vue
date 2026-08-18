<template>
  <footer
    class="composer-area"
    :class="{ 'lib-drop-over': libOver }"
    @dragover="libDragOver"
    @dragleave="libDragLeave"
    @drop="libDrop"
  >
    <div class="composer-shell" :class="{ focused, disabled }">
      <OnePersonMentionPicker
        ref="mentionPickerRef"
        v-model:active-index="mentionActiveIndex"
        :visible="showMentionPicker"
        :members="mentionCandidates"
        :search-query="mentionQuery"
        @select="selectMemberMention"
      />
      <div class="composer-glow" />
      <div class="composer-inner">
        <div v-if="selectedFiles.length" class="file-preview-strip">
          <div v-for="(item, idx) in selectedFiles" :key="item.id" class="file-preview-card">
            <div class="fp-icon-wrap">
              <img :src="getChatFileIconSrc(getChatFileTypeFromName(item.file.name))" class="fp-icon" alt="" />
            </div>
            <div class="fp-info">
              <span class="fp-name" :title="item.file.name">{{ item.file.name }}</span>
              <span class="fp-size">{{ formatFileSize(item.file.size) }}</span>
            </div>
            <button type="button" class="fp-remove" aria-label="移除文件" @click.stop="removeFile(idx)">
              <img :src="fpRemoveIcon" alt="" width="16" height="16" />
            </button>
          </div>
        </div>
        <div
          ref="editableRef"
          class="composer-textarea composer-editable"
          role="textbox"
          tabindex="0"
          spellcheck="false"
          aria-multiline="true"
          :aria-disabled="disabled"
          :contenteditable="!disabled"
          :class="{ composing: isComposing, 'is-placeholder': !inputText.trim() }"
          :data-placeholder="disabledText || placeholder"
          @input="onEditableInput"
          @focus="focused = true"
          @blur="onBlur"
          @keydown="onKeydown"
          @paste="handlePaste"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        />
        <div class="composer-bottom">
          <div class="composer-tools">
            <el-tooltip content="上传附件（单次最多 5 个，总大小不超过 100MB）" placement="top" :show-after="400">
              <button type="button" class="composer-icon-btn" :disabled="disabled" @click="triggerFileSelect">
                <SvgIcon name="icon-fujian1" :size="14" color="currentColor" />
              </button>
            </el-tooltip>
            <input
              ref="fileInputRef"
              type="file"
              :accept="UPLOAD_ACCEPT"
              multiple
              style="display: none"
              @change="handleFileSelect"
            />
            <el-tooltip content="技能（演示）" placement="top" :show-after="400">
              <button type="button" class="composer-icon-btn">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v4M3 5h4M6 17v4M4 19h4"/><path d="M13 3l2.1 5.2L20 10.3l-4.9 2.1L13 17.6l-2.1-5.2L6 10.3l4.9-2.1z"/></svg>
              </button>
            </el-tooltip>
          </div>
          <div class="composer-tools composer-tools--right">
            <button type="button" class="composer-pill">
              <svg class="pill-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.5.4.8 1 .8 1.7V16h6v-.7c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3z"/></svg>
              <span>思考</span>
              <svg class="pill-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <button type="button" class="composer-pill">
              <svg class="pill-ico" viewBox="0 0 24 24" fill="none" stroke="#f5872f" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>
              <span>Claude Opus 4.5</span>
              <svg class="pill-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <button type="button" class="composer-send" :class="{ active: canSend }" :disabled="!canSend" @click="submit">
              <img :src="sendIcon" alt="" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <p class="composer-disclaimer">对话内容将由大模型处理，涉密及个人隐私信息请谨慎输入</p>
  </footer>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getEditableCaretOffset, setEditableCaretOffset } from '@/shared/utils/contentEditableHighlight'
import { useChatInputEditable } from '@/shared/chatComposables/useChatInputEditable'
import { useLibraryFileDrop } from '@/modules/file/composables/useLibraryFileDrop'
import { useMentionHighlight } from '@/shared/chatComposables/useMentionHighlight'
import { useMentionPicker } from '@/shared/chatComposables/useMentionPicker'
import { getChatFileIconSrc, getChatFileTypeFromName } from '@/shared/utils/chatFileIcons'
import { useOnePersonFileDropConsumer } from '../../composables/useOnePersonFileDrop'
import fpRemoveIcon from '@/assets/home/fp-remove.svg'
import sendIcon from '@/assets/home/send_icon.svg'
import OnePersonMentionPicker from './OnePersonMentionPicker.vue'

defineOptions({ name: 'OnePersonComposer' })

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  disabledText: { type: String, default: '' },
  mentionMembers: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'submit'])
const focused = ref(false)
const editableRef = ref(null)
const mentionPickerRef = ref(null)
const fileInputRef = ref(null)
const isFileSelecting = ref(false)
const selectedFiles = ref([])

// 从文件库拖入 → 作为附件（mock 文件对象）
const { isOver: libOver, onDragOver: libDragOver, onDragLeave: libDragLeave, onDrop: libDrop } =
  useLibraryFileDrop((f) => {
    selectedFiles.value.push({
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: { name: f.name, size: f.bytes || 0, type: f.type || '' },
    })
  })
const pendingMentionUserIds = ref([])

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_TOTAL_SIZE = 100 * 1024 * 1024
const MAX_FILE_COUNT = 5
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
const UPLOAD_ACCEPT = ALLOWED_EXT.map(ext => `.${ext}`).join(',')
const ALLOWED_TYPES_MSG = '仅支持 Markdown(.md)、纯文本(.txt)、常见代码(如 .py/.js/.html/.css/.json/.sql 等)、Word(.docx)/ODT/PDF、图片(.png/.jpg/.jpeg)'

function normalizeMentionMember(member) {
  const id = member?.userId ?? member?.agentId ?? member?.id
  if (id == null || id === '') return null
  const displayName = String(member?.displayName || member?.name || member?.agentName || `数字员工 ${id}`).trim()
  return {
    ...member,
    id: String(member?.id ?? id),
    agentId: String(member?.agentId ?? id),
    userId: String(id),
    displayName: displayName || String(id),
    avatar: member?.avatar || member?.avatarUrl || member?.icon || '',
    description: String(member?.description || member?.role || '').trim(),
    role: member?.role || member?.raw?.role || 'member',
    status: member?.status || member?.raw?.status || 'active',
    type: 'agent',
  }
}

function isMentionableAgent(member) {
  const role = String(member?.role || member?.raw?.role || '').toLowerCase()
  if (role === 'coordinator') return false
  const status = String(member?.status || member?.raw?.status || 'active').toLowerCase()
  if (status && status !== 'active') return false
  const type = String(member?.type || member?.raw?.type || '').toLowerCase()
  return type !== 'human' && type !== 'user'
}

function findOnePersonActiveMention(text, cursor) {
  const before = String(text || '').slice(0, cursor)
  const atIndex = before.lastIndexOf('@')
  if (atIndex < 0) return null

  const query = before.slice(atIndex + 1)
  if (/\s/.test(query)) return null
  return { start: atIndex, end: cursor, query }
}

const mentionCandidates = computed(() => {
  const result = []
  const seen = new Set()
  for (const raw of props.mentionMembers || []) {
    if (!isMentionableAgent(raw)) continue
    const member = normalizeMentionMember(raw)
    if (!member) continue
    if (!isMentionableAgent(member)) continue
    const key = member.userId.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(member)
  }
  return result
})

const { formatMentionHighlightsHtml } = useMentionHighlight({
  getRoomMembers: () => mentionCandidates.value,
  pendingMentionUserIds,
})

const {
  inputText,
  isComposing,
  onCompositionStart,
  onCompositionEnd,
  handlePaste,
  onEditableInput,
  readEditablePlainText,
} = useChatInputEditable(editableRef, {
  maxHeight: 108,
  onPasteFiles: (files) => addFileItems(files, { source: 'paste' }),
  onAfterInput: () => {
    if (!isComposing.value) {
      rerenderMentionHighlights()
      syncPendingMentionsWithText(inputText.value)
      processMentionAfterInput()
    }
    emit('update:modelValue', inputText.value)
  },
})

const {
  showMentionPicker,
  mentionQuery,
  mentionActiveIndex,
  processMentionAfterInput,
  selectMemberMention: selectMemberMentionBase,
  handleMentionKeydown,
} = useMentionPicker({
  textareaRef: editableRef,
  mentionPickerRef,
  inputText,
  formatHighlightHtml: formatMentionHighlightsHtml,
  findActiveMention: findOnePersonActiveMention,
  onSelect: (member) => selectMemberMention(member),
})

const canSend = computed(() => (Boolean(inputText.value.trim()) || selectedFiles.value.length > 0) && !props.disabled)

useOnePersonFileDropConsumer((files) => {
  addFileItems(files)
  nextTick(() => editableRef.value?.focus())
})

watch(
  () => props.modelValue,
  (value) => {
    const nextValue = String(value || '')
    if (nextValue === inputText.value) return
    inputText.value = nextValue
    if (!nextValue.trim()) pendingMentionUserIds.value = []
    nextTick(() => renderEditableText(nextValue))
  },
  { immediate: true },
)

watch(mentionCandidates, () => {
  syncPendingMentionsWithText(inputText.value)
  nextTick(() => rerenderMentionHighlights())
})

onMounted(() => {
  renderEditableText(String(props.modelValue || ''))
})

function renderEditableText(text, caretOffset = null) {
  const el = editableRef.value
  if (!el) return
  el.innerHTML = formatMentionHighlightsHtml(text)
  resizeEditable(el)
  if (caretOffset != null) setEditableCaretOffset(el, caretOffset)
}

function resizeEditable(el = editableRef.value) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 108)}px`
  el.scrollTop = el.scrollHeight
}

function rerenderMentionHighlights() {
  const el = editableRef.value
  if (!el) return
  const plain = readEditablePlainText(el)
  const nextHtml = formatMentionHighlightsHtml(plain)
  if (el.innerHTML === nextHtml) return
  const offset = getEditableCaretOffset(el)
  el.innerHTML = nextHtml
  setEditableCaretOffset(el, offset)
  resizeEditable(el)
}

function syncPendingMentionsWithText(text) {
  const plain = String(text || '')
  const memberById = new Map(mentionCandidates.value.map(member => [member.userId.toLowerCase(), member]))
  pendingMentionUserIds.value = [...new Set(pendingMentionUserIds.value.filter((uid) => {
    const member = memberById.get(String(uid).toLowerCase())
    const displayName = member?.displayName || member?.userId
    return Boolean(displayName && plain.includes(`@${displayName}`))
  }))]
}

function selectMemberMention(member) {
  const normalized = normalizeMentionMember(member)
  if (!normalized) return
  selectMemberMentionBase(normalized, pendingMentionUserIds)
  emit('update:modelValue', inputText.value)
}

function buildMentionPayloads() {
  const rawText = inputText.value
  const memberById = new Map(mentionCandidates.value.map(member => [member.userId.toLowerCase(), member]))
  return pendingMentionUserIds.value
    .map(uid => memberById.get(String(uid).toLowerCase()))
    .filter(Boolean)
    .filter(member => rawText.includes(`@${member.displayName || member.userId}`))
    .map((member) => {
      const numericId = Number(member.agentId)
      return {
        agent_id: Number.isFinite(numericId) ? numericId : member.agentId,
        name: member.displayName || member.userId,
      }
    })
}

function submit() {
  if (!canSend.value) return
  emit('submit', {
    text: inputText.value.trim(),
    mentions: buildMentionPayloads(),
    files: selectedFiles.value.map(item => item.file),
  })
  selectedFiles.value = []
}

function onKeydown(event) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  if (handleMentionKeydown(event)) return
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

function onBlur() {
  focused.value = false
  setTimeout(() => {
    showMentionPicker.value = false
  }, 150)
}

function getFileExtension(filename) {
  const base = (filename || '').split(/[/\\]/).pop() || ''
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return base.slice(dotIndex + 1).toLowerCase()
}

function isAllowedFile(file) {
  const ext = getFileExtension(file?.name)
  return ext.length > 0 && ALLOWED_EXT_SET.has(ext)
}

function isImageFile(file) {
  const type = String(file?.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  return ['png', 'jpg', 'jpeg'].includes(getFileExtension(file?.name))
}

function readImageExtension(file) {
  const ext = getFileExtension(file?.name)
  if (ext) return ext
  const type = String(file?.type || '').toLowerCase()
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  return type.startsWith('image/') ? type.slice('image/'.length) : ''
}

function formatPasteTimestamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '_',
    pad(date.getMilliseconds(), 3),
  ].join('')
}

function withPastedImageTimestamp(file, timestamp, index) {
  if (!isImageFile(file)) return file
  const name = String(file?.name || '').trim()
  const ext = readImageExtension(file)
  const baseName = name.replace(/\.[^./\\]+$/, '').trim() || 'pasted-image'
  const suffix = index > 0 ? `_${index + 1}` : ''
  const nextName = `${baseName}_${timestamp}${suffix}${ext ? `.${ext}` : ''}`
  try {
    return new File([file], nextName, {
      type: file.type || '',
      lastModified: file.lastModified || Date.now(),
    })
  } catch (error) {
    console.warn('[OnePersonComposer] failed to rename pasted image:', error)
    return file
  }
}

function normalizeIncomingFiles(files, { source = '' } = {}) {
  const list = Array.from(files || []).filter(Boolean)
  if (source !== 'paste') return list
  const timestamp = formatPasteTimestamp()
  return list.map((file, index) => withPastedImageTimestamp(file, timestamp, index))
}

function addFileItems(files, options = {}) {
  if (props.disabled || !files?.length) return
  const incomingFiles = normalizeIncomingFiles(files, options)
  if (!incomingFiles.length) return

  const remaining = MAX_FILE_COUNT - selectedFiles.value.length
  if (remaining <= 0) {
    ElMessage.warning(`最多支持 ${MAX_FILE_COUNT} 个文件`)
    return
  }

  const typeRejected = incomingFiles.filter(file => !isAllowedFile(file))
  if (typeRejected.length) ElMessage.warning(ALLOWED_TYPES_MSG)

  const typeOk = incomingFiles.filter(isAllowedFile)
  if (!typeOk.length) return

  const oversized = typeOk.filter(file => file.size > MAX_FILE_SIZE)
  if (oversized.length) {
    ElMessage.warning(`单个文件不可超过 50MB，已跳过：${oversized.map(file => file.name).join('、')}`)
  }

  const withinLimit = typeOk.filter(file => file.size <= MAX_FILE_SIZE)
  if (!withinLimit.length) return

  const toAdd = withinLimit.slice(0, remaining)
  if (withinLimit.length > remaining) {
    ElMessage.warning(`已选 ${withinLimit.length} 个有效文件，超出上限，仅添加前 ${remaining} 个`)
  }

  const currentTotalSize = selectedFiles.value.reduce((sum, item) => sum + (item.file.size || 0), 0)
  const finalToAdd = []
  let nextTotalSize = currentTotalSize
  for (const file of toAdd) {
    if (nextTotalSize + file.size > MAX_TOTAL_SIZE) {
      ElMessage.warning(`文件总大小不能超过 100MB，已跳过：${file.name}`)
      continue
    }
    nextTotalSize += file.size
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

function triggerFileSelect() {
  if (props.disabled || isFileSelecting.value) return
  isFileSelecting.value = true
  fileInputRef.value?.click()
  setTimeout(() => {
    isFileSelecting.value = false
  }, 300)
}

function handleFileSelect(event) {
  addFileItems(Array.from(event.target.files || []))
  if (fileInputRef.value) fileInputRef.value.value = ''
  nextTick(() => editableRef.value?.focus())
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
</script>

<style scoped>
.composer-area {
  flex-shrink: 0;
  padding: 4px 24px 20px;
  background: #fff;
}

.composer-disclaimer {
  max-width: 952px;
  margin: 8px auto 0;
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  color: #A6ACB9;
  user-select: none;
}

.composer-shell {
  position: relative;
  max-width: 952px;
  margin: 0 auto;
  background: rgba(180, 180, 180, 0.3);
  border-radius: 16px;
  padding: 1.5px;
  box-shadow: 4px 4px 6px #91949e24;
}

.composer-shell::before {
  content: '';
  position: absolute;
  inset: 6px 5px 0px 5px;
  border-radius: 16px;
  z-index: 0;
  pointer-events: none;
  background: conic-gradient(
    from var(--arc-angle, 0turn),
    rgba(255, 151, 133, 1) 0%,
    rgba(255, 178, 95, 1) 14%,
    rgba(255, 221, 85, 1) 28%,
    rgba(45, 255, 203, 1) 42%,
    rgba(59, 180, 255, 1) 56%,
    rgba(0, 140, 255, 1) 70%,
    rgba(115, 60, 255, 1) 84%,
    rgba(255, 151, 133, 1) 100%
  );
  animation: arc-spin 4s linear infinite;
  filter: blur(6px);
  opacity: .6;
  transition: opacity .8s ease-out, filter .8s ease-out;
}

.composer-shell.focused::before {
  inset: 3px 6px -3px 6px;
}

.composer-shell::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 16px;
  background: #fff;
  z-index: 0;
  pointer-events: none;
}

.composer-shell.disabled {
  opacity: .72;
}

.composer-glow {
  height: 40px;
  position: absolute;
  width: calc(100% - 4px);
  margin-top: -44px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,1) 100%);
  pointer-events: none;
  z-index: 1;
}

.composer-glow::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 100%);
  filter: blur(10px);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%);
  pointer-events: none;
}

.composer-inner {
  position: relative;
  z-index: 2;
  padding: 12px 12px 8px;
}

.file-preview-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 8px;
  margin-bottom: 4px;
  scrollbar-width: thin;
}

.file-preview-strip::-webkit-scrollbar {
  height: 4px;
}

.file-preview-strip::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.file-preview-card {
  position: relative;
  flex-shrink: 0;
  width: 200px;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 28px 8px 10px;
  border-radius: 8px;
  background: #f7f8fa;
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

.composer-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 108px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #2f3547;
  caret-color: #f58138;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  overflow-y: auto;
}

.composer-editable {
  white-space: pre-wrap;
  word-break: break-word;
}

.composer-editable.is-placeholder::before {
  content: attr(data-placeholder);
  color: #9aa1b2;
  pointer-events: none;
}

.composer-editable[contenteditable="false"] {
  cursor: not-allowed;
}

.composer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

/* 底部左右两组工具（对齐设计稿：左 附件+技能 / 右 思考+模型+发送） */
.composer-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.composer-tools--right { flex-shrink: 0; }

.composer-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #e3e3e3;
  background: #fff;
  color: #5b616e;
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
.composer-icon-btn:hover:not(:disabled) { background: #f7f8fa; }
.composer-icon-btn:disabled { cursor: not-allowed; opacity: 0.45; }

/* 思考 / 模型切换 胶囊 */
.composer-pill {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: none;
  border-radius: 8px;
  background: #f5f6f9;
  color: #2f3547;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
}
.composer-pill:hover { background: #eef0f4; }
.composer-pill .pill-ico { width: 16px; height: 16px; flex-shrink: 0; }
.composer-pill .pill-caret { width: 12px; height: 12px; color: #99a0ae; flex-shrink: 0; }

.upload-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #e3e3e3;
  background: #fff;
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
  background: #f7f8fa;
}

.upload-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.composer-send {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 9.6px;
  background: rgba(2, 2, 2, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.composer-send.active {
  cursor: pointer;
  background: #020202;
}

.composer-send.active:hover {
  transform: scale(1.05);
}

.composer-shell.focused .composer-send {
  background: #171B26;
}

.composer-send img {
  width: 16px;
  height: 16px;
}

.composer-editable :deep(.chat-input-mention) {
  display: inline;
  color: #2d8cff;
  font-weight: 600;
  background: rgba(45, 140, 255, 0.1);
  border-radius: 4px;
  padding: 0 2px;
}

.composer-editable :deep(.url-link) {
  color: #2d8cff;
}

@property --arc-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0turn;
}

@keyframes arc-spin {
  from { --arc-angle: 0turn; }
  to { --arc-angle: 1turn; }
}

@media (prefers-reduced-motion: reduce) {
  .composer-shell::before { animation: none; }
}
</style>
