<template>
  <div class="chat-button-wrap" :class="{ 'is-highlight': highlight }">
    <MarketCustomButton
      :size="size"
      :variant="variant"
      :disabled="disabled || busy"
      @click="handleChat"
    >
      <span v-if="busy" class="chat-btn-spinner" />
      <slot v-else>对话</slot>
    </MarketCustomButton>
    <span v-if="highlight" class="chat-button-wrap__shimmer" aria-hidden="true" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import MarketCustomButton from './MarketCustomButton.vue'

/**
 * 数字人市场「对话」：与协作资料卡一致——新建 personal 线程并进入协作数字人对话页
 */
defineOptions({ name: 'ChatButton' })

const props = defineProps({
  /** 按钮尺寸：default (32px) | small (28px) */
  size: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'small',
  },
  /** 按钮主题：default (白底描边) | dark (深色) */
  variant: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'dark',
  },
  /** 是否禁用 */
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 市场 Agent 数字 id（与详情 / 列表 id 一致） */
  id: {
    type: [String, Number],
    default: '',
  },
  /** 展示名（写入侧栏列表与协作会话元信息） */
  agentDisplayName: {
    type: String,
    default: '',
  },
  agentName: {
    type: String,
    default: '',
  },
  agentAvatarUrl: {
    type: String,
    default: '',
  },
  /** 引导高亮：显示光效流转动画 */
  highlight: {
    type: Boolean,
    default: false,
  },
})

const uiStore = useUIStore()
const digitalHumanStore = useDigitalHumanStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()

const localOpening = ref(false)

const busy = computed(() => {
  if (localOpening.value) return true
  const aid = props.id
  if (aid == null || aid === '') return false
  return String(digitalHumanStore.openingAgentId ?? '') === String(aid)
})

async function handleChat() {
  const rawId = props.id
  if (rawId == null || rawId === '') return

  const agentId = Number(rawId)
  if (!Number.isFinite(agentId) || agentId <= 0) {
    ElMessage.error('无效的数字人标识')
    return
  }

  const displayName = String(props.agentDisplayName || props.agentName || '').trim() || String(agentId)
  const name = String(props.agentName || props.agentDisplayName || '').trim() || displayName

  localOpening.value = true
  try {
    await digitalHumanStore.openAgent(agentId, '新对话')
    digitalHumanStore.upsertAgentInList({
      agent_id: agentId,
      agent_name: name,
      agent_display_name: displayName,
      agent_avatar_url: props.agentAvatarUrl || '',
    })
    const payload = digitalHumanStore.currentThreadPayload
    if (!payload?.id) {
      ElMessage.error('创建会话失败')
      return
    }
    await collaborationEmployeeChatStore.applyCollaborationDigitalHumanSession(
      agentId,
      payload,
      digitalHumanStore.currentAgent || {
        agent_id: agentId,
        agent_name: name,
        agent_display_name: displayName,
        agent_avatar_url: props.agentAvatarUrl || '',
      },
    )
    uiStore.setActiveNavigation('collaboration', `digital-human-${String(agentId)}`)
    uiStore.expandSidebar()
  } catch (err) {
    console.error('[ChatButton] 打开协作数字人对话失败:', err)
  } finally {
    localOpening.value = false
  }
}
</script>

<style lang="scss" scoped>
.chat-button-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  overflow: hidden;

  &__shimmer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.55) 50%,
      transparent 70%
    );
    background-size: 200% 100%;
    animation: chat-btn-shimmer 1.4s ease-in-out infinite;
    pointer-events: none;
  }
}

@keyframes chat-btn-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}

.chat-btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: chat-btn-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes chat-btn-spin {
  to { transform: rotate(360deg); }
}
</style>
