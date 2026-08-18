<template>
  <div
    class="chat-input-area"
    :class="{ 'lib-drop-over': libOver }"
    @dragover="libDragOver"
    @dragleave="libDragLeave"
    @drop="libDrop"
  >
    <div ref="inputWrapperRef" class="input-wrapper" :class="{ focused: isFocused }">
    <GroupMentionPicker
      ref="mentionPickerRef"
      v-model:active-index="mentionActiveIndex"
      :visible="showMentionPicker"
      :group-id="props.groupId"
      :search-query="mentionQuery"
      @select="selectMemberMention"
    />
      <div class="input-glow"></div>
      <div
        class="input-container"
        :class="{
          'has-file-preview': uploadAreaRef?.hasFiles,
          'has-quote-bar': props.quotingMessage,
          'has-workflow-reference': workflowReference,
          'has-matter-reference': matterReference,
        }"
      >
        <!-- 引用预览条 -->
        <MessageQuoteBar
          v-if="props.quotingMessage"
          :quoting-message="props.quotingMessage"
          :sender-display-name="props.quotingSenderName"
          @cancel="emit('cancel-quote')"
        />
        <div v-if="workflowReference" class="workflow-reference-bar">
          <button
            type="button"
            class="workflow-reference-bar__remove"
            aria-label="取消引用工作流"
            @click="clearWorkflowReference"
          >×</button>
          <span class="workflow-reference-bar__icon">↻</span>
          <span class="workflow-reference-bar__content">
            <span class="workflow-reference-bar__label">引用工作流</span>
            <span class="workflow-reference-bar__title">
              {{ workflowReference.emoji || '📋' }} {{ displayWorkflowTitle(workflowReference) }}
            </span>
          </span>
          <span class="workflow-reference-bar__status">
            {{ workflowReference.status === 'aborted' ? '已取消' : '已完成' }}
          </span>
        </div>
        <div v-if="matterReference" class="workflow-reference-bar matter-reference-bar">
          <button
            type="button"
            class="workflow-reference-bar__remove"
            aria-label="取消引用事项"
            @click="clearMatterReference"
          >×</button>
          <span class="workflow-reference-bar__icon matter-reference-bar__icon">事项</span>
          <span class="workflow-reference-bar__content">
            <span class="workflow-reference-bar__label">引用事项 · {{ matterReference.owner || '待指定' }}</span>
            <span class="workflow-reference-bar__title">{{ matterReference.title }}</span>
          </span>
          <span class="workflow-reference-bar__status">@{{ matterReference.steward?.name || '团队助手' }}</span>
        </div>
        <!-- 文件预览条 -->
        <FilePreviewStrip v-if="uploadAreaRef?.hasFiles" :upload-area-ref="uploadAreaRef" />

        <!-- 🦀 AI 起草态 banner -->
        <div v-if="isAiDrafting" class="ai-draft-banner">
          <span class="banner-dots">
            <span class="dot" /><span class="dot" /><span class="dot" />
          </span>
          <span class="banner-text">🦀 分身正在阅读这条消息，起草回复…</span>
        </div>

        <div class="textarea-wrapper">
          <div class="textarea-editor-inner">
            <div
              ref="textareaRef"
              class="chat-textarea chat-input-editable"
              role="textbox"
              tabindex="0"
              spellcheck="false"
              :contenteditable="isAiDrafting ? 'false' : 'true'"
              :class="{
                composing: isComposing,
                'is-placeholder': !inputText.trim(),
                'is-ai-drafting': isAiDrafting,
              }"
              :data-placeholder="isAiDrafting ? '正在起草…' : composerPlaceholder"
              aria-multiline="true"
              @input="onEditableInput"
              @keydown="handleKeydown"
              @focus="isFocused = true"
              @blur="handleInputBlur"
              @paste="handlePaste"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
            />
          </div>
        </div>
        <div class="input-bottom">
          <div class="input-bottom-left">
            <ChatFileUploadArea ref="uploadAreaRef" :space-id="props.conversationId" :conversation-id="props.groupId" />
          </div>
          <div class="input-bottom-right">
            <button
              class="send-btn"
              :class="{ active: canSend && !isAiDrafting }"
              :disabled="!canSend || isAiDrafting"
              @click="send"
            >
              <img src="@/assets/home/send_icon.svg" alt="send" class="send-icon">
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, watchEffect, inject, nextTick, computed } from 'vue'
import { getEditableCaretOffset, setEditableCaretOffset } from '@/shared/utils/contentEditableHighlight'
import { useGroupStore } from '@/modules/group/store'
import { ElMessage } from 'element-plus'
import { getPortalUserId } from '@/shared/utils/userInfoStorage.js'
import {
  CHAT_COMPOSER_INPUT_BOX_KEY,
  FORCE_SCROLL_TO_BOTTOM_KEY
} from '@/shared/constants/injectionKeys'
import ChatFileUploadArea from '@/shared/components/ChatFileUploadArea.vue'
import { useLibraryFileDrop } from '@/modules/file/composables/useLibraryFileDrop'
import MessageQuoteBar from '@/shared/components/MessageQuoteBar.vue'
import GroupMentionPicker from '@/modules/group/components/GroupMentionPicker.vue'
import FilePreviewStrip from '@/shared/components/FilePreviewStrip.vue'
import { useChatFileInput } from '@/shared/chatComposables/useChatFileInput'
import { useChatInputEditable } from '@/shared/chatComposables/useChatInputEditable'
import { useMentionPicker } from '@/shared/chatComposables/useMentionPicker'
import { useTeamFileRef } from '@/shared/chatComposables/useTeamFileRef'
import { useMentionHighlight } from '@/shared/chatComposables/useMentionHighlight'
import { useAiDraftStore } from '@/shared/store/aiDraftStore'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useCollaborationBTaskBoardStore } from '@/modules/collaboration-b/store/taskBoardStore'
import { CURRENT_USER } from '@/dev-mocks/data/users'
import { TEAM_ASSISTANT_BOT_ID } from '@/dev-mocks/data/team-assistant'

const props = defineProps({
  conversationId: { type: String, required: true },
  groupId: { type: String, required: true },
  memberAgentIds: { type: Array, default: () => [] },
  /** 父级每次点「引用」+1，用于可靠触发输入框 @ 预填（不依赖 quotingMessage 引用是否变化） */
  quoteRequestSerial: { type: Number, default: 0 },
  quotingMessage: { type: Object, default: null },
  quotingSenderName: { type: String, default: '' },
})

const emit = defineEmits(['cancel-quote'])

const groupStore = useGroupStore()
const taskStore = useCollabTaskStore()
const taskBoardStore = useCollaborationBTaskBoardStore()

const workflowReference = computed(() => taskStore.workflowReferenceForGroup(props.groupId))
const matterReference = ref(null)
const matterAutoCommand = ref(null)
const matterComposeRequest = inject('collaborationBMatterComposeRequest', null)
const composerPlaceholder = computed(() => {
  if (matterReference.value) return '可以补充你希望管家如何拆解和推进'
  if (workflowReference.value) return '描述这次需要调整的内容，例如：负责人改为刘敏，去掉评审步骤'
  return '输入消息，@ 可提及成员'
})

const composerInputBoxRef = inject(CHAT_COMPOSER_INPUT_BOX_KEY, null)
const inputWrapperRef = ref(null)
const forceScrollToBottom = inject(FORCE_SCROLL_TO_BOTTOM_KEY, null)

watchEffect(() => {
  if (!composerInputBoxRef) return
  composerInputBoxRef.value = inputWrapperRef.value
})

const textareaRef = ref(null)
const pendingMentionUserIds = ref([])

const { formatMentionHighlightsHtml } = useMentionHighlight({
  getRoomMembers: () => groupStore.conversationMembers[props.groupId] ?? [],
  pendingMentionUserIds,
})

const uploadAreaRef = ref(null)

// 从文件库拖入 → 造个真 File 喂给上传区（名/尺寸/类型正确）
const { isOver: libOver, onDragOver: libDragOver, onDragLeave: libDragLeave, onDrop: libDrop } =
  useLibraryFileDrop((f) => {
    try {
      const blob = new File([new ArrayBuffer(f.bytes || 0)], f.name, { type: f.type || '' })
      uploadAreaRef.value?.addFiles?.([blob])
    } catch (_) {
      /* ignore */
    }
  })
const mentionPickerRef = ref(null)
const isFocused = ref(false)

useChatFileInput(uploadAreaRef)

const {
  inputText,
  isComposing,
  onCompositionStart,
  onCompositionEnd,
  handlePaste,
  onEditableInput,
  readEditablePlainText,
  clearEditable,
} = useChatInputEditable(textareaRef, {
  maxHeight: 108,
  onPasteFiles: (files) => uploadAreaRef.value?.addFiles(files),
  onAfterInput: () => {
    // Re-render @mention highlights in the editable (only when not composing CJK)
    if (!isComposing.value) {
      const el = textareaRef.value
      if (el) {
        const plain = readEditablePlainText(el)
        const newHtml = formatMentionHighlightsHtml(plain)
        if (el.innerHTML !== newHtml) {
          // Preserve caret position across innerHTML replacement
          const offset = getEditableCaretOffset(el)
          el.innerHTML = newHtml
          setEditableCaretOffset(el, offset)
        }

        // 同步 pendingMentionUserIds 与实际文本内容，实现去重和清理
        const roomMemberList = groupStore.conversationMembers[props.groupId] ?? []
        pendingMentionUserIds.value = [...new Set(pendingMentionUserIds.value.filter(uid => {
          const member = roomMemberList.find(
            m => m?.userId && String(m.userId).toLowerCase() === String(uid).toLowerCase()
          )
          const displayName = member?.displayName || member?.userId
          return displayName && plain.includes(`@${displayName}`)
        }))]
      }
      processMentionAfterInput()
    }
  },
})

const canSend = computed(() => {
  const upload = uploadAreaRef.value
  if (workflowReference.value && inputText.value.trim().length === 0) return false
  if (matterReference.value && inputText.value.trim().length === 0) return false
  return (
    (inputText.value.trim().length > 0 || (upload?.hasFiles ?? false)) &&
    (upload?.allUploaded ?? true)
  )
})

watch(() => workflowReference.value?.id, (taskId) => {
  if (!taskId) return
  // 归档工作流与事项发起是两种不同的创建意图。后选择工作流时，
  // 同步撤掉事项引用及其自动插入的 @管家命令，避免一次发送创建两条流程。
  if (matterReference.value) clearMatterReference({ focus: false })
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.focus()
    setEditableCaretOffset(el, readEditablePlainText(el).length)
  })
}, { flush: 'post' })

watch(
  () => matterComposeRequest?.value?.serial,
  () => {
    const request = matterComposeRequest?.value
    if (!request || String(request.conversationId || '') !== String(props.groupId)) return
    const matter = request.matter || {}
    const steward = request.steward || { userId: TEAM_ASSISTANT_BOT_ID, name: '团队助手' }
    if (!matter.id) return

    emit('cancel-quote')
    taskStore.clearWorkflowReference(props.groupId)
    // 连续从不同事项发起时，先清理上一条自动命令，但保留用户原本输入的内容。
    clearMatterReference({ focus: false })
    matterReference.value = {
      ...matter,
      conversationId: props.groupId,
      steward,
    }

    const roomMembers = groupStore.conversationMembers[props.groupId] || []
    const actualMember = roomMembers.find((member) => String(member?.userId || '') === String(steward.userId || ''))
    const mentionName = String(actualMember?.displayName || actualMember?.name || steward.name || '团队助手')
    const mentionUserId = String(actualMember?.userId || steward.userId || TEAM_ASSISTANT_BOT_ID)
    const prefix = `@${mentionName} 请基于这个事项创建协作任务并拆解执行步骤。`
    const existing = inputText.value.trim()
    inputText.value = existing ? `${prefix}\n${existing}` : prefix
    matterAutoCommand.value = { text: prefix, mentionUserId, mentionName }
    pendingMentionUserIds.value = [...new Set([...pendingMentionUserIds.value, mentionUserId])]
    showMentionPicker.value = false
    mentionQuery.value = ''

    nextTick(() => {
      const el = textareaRef.value
      if (!el) return
      el.innerHTML = formatMentionHighlightsHtml(inputText.value)
      el.focus()
      setEditableCaretOffset(el, inputText.value.length)
      forceScrollToBottom?.()
    })
  },
  { flush: 'post' },
)

// 🦀 AI 起草态
const aiDraftStore = useAiDraftStore()
const draftKey = computed(() => props.groupId || props.conversationId)
const aiDraft = computed(() => aiDraftStore.getDraft(draftKey.value))
const isAiDrafting = computed(() => {
  const s = aiDraft.value.status
  return s === 'thinking' || s === 'streaming'
})

// 流式期间：实时把 draftText 渲染进 textarea（不污染 inputText，避免触发 mention 解析等副作用）
watch(() => aiDraft.value.draftText, (text) => {
  if (!isAiDrafting.value) return
  const el = textareaRef.value
  if (!el) return
  el.innerText = text || ''
})

// 草稿 ready：把内容同步进 inputText（让 send 按钮、mention 高亮等正常工作），清掉 draft state
watch(() => aiDraft.value.status, (status) => {
  if (status !== 'ready') return
  const text = aiDraft.value.draftText || ''
  const el = textareaRef.value
  if (el) {
    el.innerText = text
    // 触发 input 流程：mention 高亮、inputText 同步、自适应高度
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  inputText.value = text
  // 把 draft state 清掉，让 banner 消失，留下输入框内容给用户编辑
  aiDraftStore.clear(draftKey.value)
  nextTick(() => {
    // 把光标挪到末尾
    const node = textareaRef.value
    if (node) {
      try {
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        const sel = window.getSelection?.()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
        node.focus()
      } catch (_) { /* noop */ }
    }
  })
})

const quoteAutoMentionPrefix = ref('')

const {
  showMentionPicker,
  mentionQuery,
  mentionActiveIndex,
  processMentionAfterInput,
  selectMemberMention: selectMemberMentionBase,
  handleMentionKeydown,
} = useMentionPicker({
  textareaRef,
  mentionPickerRef,
  inputText,
  formatHighlightHtml: formatMentionHighlightsHtml,
  onSelect: (member) => selectMemberMention(member),
})

function resolveQuotedSenderId(msg) {
  if (!msg || typeof msg !== 'object') return ''
  const sid = msg.senderId ?? msg.sender?.id ?? msg.sender ?? msg.userId
  return typeof sid === 'string' && sid.trim() ? sid.trim() : ''
}

function isQuotedSelf(senderId) {
  if (!senderId) return true
  const msg = props.quotingMessage
  if (msg?.role === 'user') return true
  const senderName = String(msg?.senderName ?? '').trim()
  const portal = getPortalUserId()
  if (portal && senderName && senderName === portal) return true
  return false
}

function applyQuoteAuthorMention() {
  const msg = props.quotingMessage
  if (!msg) {
    quoteAutoMentionPrefix.value = ''
    return
  }
  const senderId = resolveQuotedSenderId(msg)
  if (!senderId || isQuotedSelf(senderId)) {
    pendingMentionUserIds.value = []
    quoteAutoMentionPrefix.value = ''
    return
  }
  const display = String(props.quotingSenderName || '').trim() || senderId
  const prefix = `@${display} `

  let text = inputText.value
  const prev = quoteAutoMentionPrefix.value
  if (prev && text.startsWith(prev)) {
    text = text.slice(prev.length)
  }
  if (!text.startsWith(prefix)) {
    inputText.value = prefix + text
  }
  quoteAutoMentionPrefix.value = prefix
  pendingMentionUserIds.value = [senderId]
  showMentionPicker.value = false
  mentionQuery.value = ''

  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.innerHTML = formatMentionHighlightsHtml(inputText.value)
    el.focus()
    setEditableCaretOffset(el, prefix.length)
  })
}

watch(
  [
    () => props.quotingMessage,
    () => props.quotingSenderName || '',
    () => props.quoteRequestSerial,
  ],
  applyQuoteAuthorMention,
  { flush: 'post' },
)

useTeamFileRef({
  uploadAreaRef,
  conversationId: () => props.groupId,
  shouldHandle: () => groupStore.currentSpaceId === props.groupId,
})

// 监听协作空间切换，清除引用文件
watch(() => groupStore.currentSpaceId, (sid) => {
  if (sid !== props.groupId) {
    uploadAreaRef.value?.clearFiles()
    clearMatterReference({ focus: false })
  }
})

onMounted(async () => {
  await groupStore.loadHistory(props.groupId)
})

function selectMemberMention(member) {
  // 已经 @ 过的人，直接关闭 picker，不重复插入
  if (pendingMentionUserIds.value.includes(member.userId)) {
    showMentionPicker.value = false
    mentionQuery.value = ''
    return
  }
  selectMemberMentionBase(member, pendingMentionUserIds)
}

function handleKeydown(e) {
  if (handleMentionKeydown(e)) return
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    e.preventDefault()
    send()
  }
  if (e.key === 'Escape') {
    if (props.quotingMessage) emit('cancel-quote')
    else if (matterReference.value) clearMatterReference()
    else if (workflowReference.value) clearWorkflowReference()
  }
}

function handleInputBlur() {
  isFocused.value = false
  setTimeout(() => { showMentionPicker.value = false }, 150)
}

function displayWorkflowTitle(task) {
  const title = String(task?.title || '未命名任务').trim()
  const emoji = String(task?.emoji || '').trim()
  return emoji && title.startsWith(emoji) ? title.slice(emoji.length).trimStart() : title
}

function clearWorkflowReference() {
  taskStore.clearWorkflowReference(props.groupId)
}

function clearMatterReference() {
  const command = matterAutoCommand.value
  matterReference.value = null
  matterAutoCommand.value = null
  if (!command) return

  const currentText = inputText.value
  let nextText = currentText
  if (currentText.startsWith(command.text)) {
    nextText = currentText.slice(command.text.length).replace(/^\n/, '')
  }
  inputText.value = nextText

  const retainedSameMention = nextText.includes(`@${command.mentionName}`)
  pendingMentionUserIds.value = pendingMentionUserIds.value.filter((uid) => (
    String(uid) !== String(command.mentionUserId) || retainedSameMention
  ))
  showMentionPicker.value = false
  mentionQuery.value = ''

  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.innerHTML = formatMentionHighlightsHtml(nextText)
    setEditableCaretOffset(el, nextText.length)
  })
}

function buildRestartFlowCards(task, activated) {
  if (!activated?.length) return []
  if (activated.length === 1) {
    const first = activated[0]
    return [{
      taskId: task.id,
      kind: 'created',
      nextStepId: first.id,
      nextStepNames: first.name,
      assignees: first.assignees || [],
    }]
  }
  return [
    { taskId: task.id, kind: 'created' },
    ...activated.map((taskStep) => ({
      taskId: task.id,
      kind: 'next-step',
      nextStepId: taskStep.id,
      nextStepNames: taskStep.name,
      assignees: taskStep.assignees || [],
    })),
  ]
}

async function send() {
  if (!canSend.value) return

  const rawText = inputText.value.trim()
  const text = rawText
  const filesToSend = (uploadAreaRef.value?.pendingFiles ?? []).filter(f => f.url)
  const workflowToRestart = workflowReference.value
  const matterToStart = matterReference.value
  const hasText = text.length > 0
  const hasFiles = filesToSend.length > 0

  // 理论上两类引用已由 watcher 双向互斥；这里再守一道发送边界，
  // 防止同一 tick 的极端竞态把两种创建 payload 一起发出去。
  if (workflowToRestart && matterToStart) {
    ElMessage.warning('一次只能引用一个流程来源，请重新选择事项或历史工作流')
    return
  }

  if (workflowToRestart && !taskStore.canCreateMoreTask(props.groupId)) {
    ElMessage.warning('同时进行中任务已达上限（3 个），请先完成或取消一个任务')
    return
  }
  if (matterToStart && !taskStore.canCreateMoreTask(props.groupId)) {
    ElMessage.warning('同时进行中任务已达上限（3 个），请先完成或取消一个任务')
    return
  }

  // 在 emit('cancel-quote') 之前捕获引用选项，防止父组件同步清空 quotingMessage 后丢失数据
  const replyOpts = props.quotingMessage
    ? {
        replyToId: props.quotingMessage.id ?? props.quotingMessage.eventId,
      }
    : {}

  // 提前计算 mentions（参与发送，不影响 msgtype 判断）
  const roomMemberList = groupStore.conversationMembers[props.groupId] ?? []
  const memberByUserId = new Map(
    roomMemberList
      .filter(m => m?.userId)
      .map(m => [String(m.userId).toLowerCase(), m]),
  )
  const mentions = pendingMentionUserIds.value
    .map(uid => memberByUserId.get(String(uid).toLowerCase()))
    .filter(Boolean)
    .filter(m => {
      const displayName = m.displayName || m.userId
      return rawText.includes(`@${displayName}`)
    })
    .map(m => ({
      participant_id: m.userId,
      name: m.displayName || m.userId,
      username: m.username || m.account || '',
      type: m.type === 'agent' ? 'agent' : 'user',
    }))

  uploadAreaRef.value?.clearFiles()
  clearEditable()
  emit('cancel-quote')
  pendingMentionUserIds.value = []

  const baseOpts = {
    ...(mentions.length ? { mentions } : {}),
    ...replyOpts,
    ...(workflowToRestart ? {
      workflowReference: {
        taskId: workflowToRestart.id,
        conversationId: workflowToRestart.conversationId,
      },
    } : matterToStart ? {
      matterReference: {
        conversationId: props.groupId,
        matterId: matterToStart.id,
        title: matterToStart.title,
        owner: matterToStart.owner,
        deadline: matterToStart.deadline || '',
        description: matterToStart.description || '',
        steward: matterToStart.steward,
        source: 'collaboration-b-board',
      },
    } : {}),
  }

  try {
    if (hasFiles) {
      // 将所有附件合并到一个消息中发送
      const attachments = filesToSend.map(f => ({
        url: f.url,
        name: f.file.name,
        size: f.file.size,
        mime_type: f.file.type,
        // 附加上传接口返回的全部信息
        ...(f.fileInfo || {}),
      }))

      // 发送一条消息，包含文本和所有附件
      await groupStore.sendMessage(text, props.groupId, {
        ...baseOpts,
        attachments,
      })
    } else if (hasText) {
      await groupStore.sendMessage(text, props.groupId, baseOpts)
    }

    if (workflowToRestart && hasText) {
      const { task, activated, changes } = taskStore.restartTaskFromReference({
        conversationId: props.groupId,
        sourceTaskId: workflowToRestart.id,
        instruction: text,
        createdBy: CURRENT_USER?.name || '群成员',
      })
      const cards = buildRestartFlowCards(task, activated)
      const adjustmentText = changes.length
        ? `已调整：${changes.join('、')}`
        : '已结合你的描述生成本轮执行内容'
      const body = `已基于「${displayWorkflowTitle(workflowToRestart)}」开启新一轮工作流。${adjustmentText}。`
      const content = { msgtype: 'text', body }
      if (cards.length === 1) content.flowCard = cards[0]
      else if (cards.length > 1) content.flowCards = cards
      groupStore.addAssistantMessage(body, props.groupId, {
        senderId: TEAM_ASSISTANT_BOT_ID,
        senderName: '团队助手',
        senderType: 'agent',
        content,
      })
    }

    else if (matterToStart && hasText) {
      const steward = matterToStart.steward || { userId: TEAM_ASSISTANT_BOT_ID, name: '团队助手' }
      const { task, activated } = taskStore.createTaskFromMatter({
        conversationId: props.groupId,
        matter: matterToStart,
        instruction: text,
        createdBy: steward.name || '团队助手',
      })
      taskBoardStore.linkWorkflowTask(props.groupId, matterToStart.id, task.id)
      const cards = buildRestartFlowCards(task, activated)
      const firstStep = activated?.[0]?.name
      const body = `已基于事项「${matterToStart.title}」创建协作任务，并完成双向关联。${firstStep ? `先推进「${firstStep}」。` : ''}`
      const content = {
        msgtype: 'text',
        body,
        matterReference: {
          matterId: matterToStart.id,
          title: matterToStart.title,
        },
      }
      if (cards.length === 1) content.flowCard = cards[0]
      else if (cards.length > 1) content.flowCards = cards
      groupStore.addAssistantMessage(body, props.groupId, {
        senderId: steward.userId || TEAM_ASSISTANT_BOT_ID,
        senderName: steward.name || '团队助手',
        senderType: 'agent',
        senderAvatar: steward.avatar || '',
        content,
      })
      clearMatterReference()
    }
  } catch (err) {
    console.error('[GroupChatInput] 发送失败:', err)
    ElMessage.error('发送失败')
  }

  // 发送完成后强制滚动到底部
  nextTick(() => forceScrollToBottom?.())
}
</script>

<style scoped>
.chat-input-area {
  padding: 4px 24px 28px;
  /* background: var(--bg-primary); */
  background: #fff;
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.chat-input-area > .input-wrapper {
  width: 100%;
  max-width: 952px;
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

/* 旋转彩弧层 */
.input-wrapper::before {
  content: '';
  position: absolute;
  inset: 6px 5px 0px 5px;
  border-radius: 16px;
  z-index: 0;
  pointer-events: none;
  /* 全周彩虹渐变 */
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

/* 聚焦时 */
.input-wrapper.focused::before {
  inset: 3px 6px -3px 6px;
}

/* 白色内容遮罩，仅露出 1px 边框 */
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
  /* 上层更“清晰”的高光（轻微渐隐） */
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.2) 20%,
    rgba(255, 255, 255, 0.4) 45%,
    rgba(255, 255, 255, 1) 100%
  );
  pointer-events: none;
  z-index:1;
}

/* 下层更“模糊”的光晕：自上而下清晰度降低直到看不到 */
.input-glow::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.30) 0%,
    rgba(255, 255, 255, 0.12) 45%,
    rgba(255, 255, 255, 0) 100%
  );
  filter: blur(10px);
  transform: translateY(0px);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.25) 55%, rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.25) 55%, rgba(0, 0, 0, 0) 100%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  pointer-events: none;
}

.input-container {
  position: relative;
  border: none;
  border-radius: 12px;
  background: transparent;
  padding: 12px 16px 8px;
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

/* 有文件预览时：容器上内边距 + 预览条上内边距 = 12px 到卡片顶，且为 .fp-remove 负偏移保留条内空间 */
.input-container.has-file-preview {
  padding-top: 4px;
}

/* 引用条：与 ChatInput / MessageQuoteBar 一致，避免灰条顶边与 input-wrapper 彩边/白底贴死 */
.input-container.has-quote-bar {
  padding-top: 8px;
}

.input-container.has-workflow-reference,
.input-container.has-matter-reference {
  padding-top: 8px;
}

.workflow-reference-bar {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 9px;
  position: relative;
  margin: 0 4px 8px;
  padding: 7px 10px;
  border: 1px solid #e5e7f0;
  border-radius: 8px;
  background: #f7f8fa;
  box-sizing: border-box;
}
.workflow-reference-bar__remove {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -5px;
  right: -5px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #c5c9d3;
  color: #fff;
  font-size: 13px;
  line-height: 16px;
  cursor: pointer;
}
.workflow-reference-bar__remove:hover {
  background: #91949e;
}
.workflow-reference-bar__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 7px;
  background: #eef0ff;
  color: #6072aa;
  font-size: 20px;
  font-weight: 600;
}
.workflow-reference-bar__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}
.workflow-reference-bar__label {
  color: #91949e;
  font-size: 11px;
  line-height: 16px;
}
.workflow-reference-bar__title {
  overflow: hidden;
  color: #2f3547;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workflow-reference-bar__status {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 9px;
  background: #eef0f8;
  color: #6072aa;
  font-size: 10px;
  line-height: 16px;
}
.matter-reference-bar {
  border-color: #ffd8c8;
  background: #fff9f6;
}
.matter-reference-bar__icon {
  background: #fff0e9;
  color: #ff621f;
  font-size: 10px;
}
.matter-reference-bar .workflow-reference-bar__status {
  background: #fff0e9;
  color: #e8581f;
}

.textarea-wrapper {
  position: relative;
  margin-left: 4px;
  width: calc(100% - 4px);
  box-sizing: border-box;
}

.textarea-editor-inner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.textarea-editor-inner .chat-textarea {
  flex: 1;
  min-width: 0;
  width: auto;
}

.chat-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  /* 与 ChatInput 一致：镜像方案时期即用的橙色光标 */
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
}

/* 🦀 AI 起草态 banner */
.ai-draft-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin: 0 4px 6px;
  background: linear-gradient(
    90deg,
    rgba(123, 91, 255, 0.10) 0%,
    rgba(67, 111, 246, 0.10) 50%,
    rgba(123, 91, 255, 0.10) 100%
  );
  background-size: 200% 100%;
  animation: ai-draft-shimmer 2s ease-in-out infinite;
  border-radius: 8px;
  font-size: 12px;
  color: #5E3FD9;
}

.ai-draft-banner .banner-dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.ai-draft-banner .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #7B5BFF;
  animation: ai-draft-bounce 1.2s infinite ease-in-out;
}
.ai-draft-banner .dot:nth-child(1) { animation-delay: -0.32s; }
.ai-draft-banner .dot:nth-child(2) { animation-delay: -0.16s; }

.banner-text {
  letter-spacing: 0.3px;
}

@keyframes ai-draft-shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes ai-draft-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* AI 起草态：禁用 + shimmer 占位 */
.chat-textarea.is-ai-drafting {
  cursor: not-allowed;
  user-select: none;
  color: #7B5BFF;
  background: linear-gradient(
    90deg,
    rgba(123, 91, 255, 0.04) 0%,
    rgba(123, 91, 255, 0.10) 50%,
    rgba(123, 91, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: ai-draft-shimmer 2.4s ease-in-out infinite;
  border-radius: 6px;
}

/* @ 提及高亮（innerHTML 注入 .chat-input-mention） */
.chat-input-editable :deep(.chat-input-mention) {
  color: #4f6ef7;
  font-weight: 500;
}

.chat-textarea.composing {
  color: var(--text-primary);
}

.chat-input-editable :deep(.url-link) {
  color: #1677ff;
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
}

.input-bottom-right {
  display: flex;
  align-items: center;
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

.send-btn.active:hover {
  transform: scale(1.05);
}

.send-icon {
  width: 16px;
  height: 16px;
}

.send-btn.active:hover { transform: scale(1.05); }

/* 输入框聚焦时发送按钮使用激活色（高于 .send-btn.active 的底色） */
.input-wrapper.focused .send-btn {
  background: #171B26;
}

/* ──── 文件预览区 ──── */
</style>
