<template>
  <div
    ref="chatPanelRootRef"
    class="chat-panel"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 拖拽上传遮罩层 -->
    <Transition name="drag-fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-card">
          <img :src="uploadDragImg" class="drag-img" alt="" />
          <p class="drag-title">在此处拖放文件/图片</p>
          <p class="drag-hint">最多支持 1 个文件，每个 50MB，仅提取文字，支持 MD、TXT、PDF、DOCX、ODT、JPG、PNG、HTML、CSS、JSON、SQL 等</p>
        </div>
      </div>
    </Transition>

    <div class="panel-inner">
      <GroupMessageList
        ref="groupMsgListRef"
        :conversation-id="conversationId"
        :group-id="conversationId"
        :member-agent-ids="spaceMemberAgentIds"
        hide-messages
      />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'ChatPanel' })
import { computed, ref, provide, watch, nextTick } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useChatPanelFileDropProvider } from '@/shared/chatComposables/useChatFileDrop'
import GroupMessageList from '@/modules/group/components/GroupMessageList.vue'
import uploadDragImg from '@/assets/home/uploadDrag.png'

const props = defineProps({
  conversationId: { type: String, required: true },
  /**
   * 消息列实现：必须与挂载入口一致（协作 / 一人团队）。
   * 勿仅用全局 activePrimaryNav：多入口同时挂载且 v-show 切换时，隐藏的 ChatPanel 仍会随导航改型，导致串台或整列表卸载重建。
   */
  listContext: {
    type: String,
    required: true,
    validator: (v) => ['collaboration'].includes(v),
  },
})

const groupStore = useGroupStore()

/** 聊天列布局根节点（不含右侧文件面板），供反馈条等相对聊天区水平居中 */
const chatPanelRootRef = ref(null)
provide('chatPanelRootRef', chatPanelRootRef)

const spaceMemberAgentIds = computed(() => {
  return groupStore.teamMemberAgentIdsByConversationId[props.conversationId] ?? []
})

const activeListSpaceId = computed(() => {
  return groupStore.currentSpaceId
})

const groupMsgListRef = ref(null)

/** 当前分支下的消息列表 ref（v-if 三选一，由 listContext 固定分支） */
const activeMsgListRef = computed(() => {
  return groupMsgListRef.value
})

/** conversationId 激活时触发 onActivate，补齐滚动/定位逻辑 */
watch(
  activeListSpaceId,
  (sid) => {
    if (sid !== props.conversationId) return
    nextTick(() => {
      activeMsgListRef.value?.onActivate?.()
    })
  },
)

const {
  isDragging,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
} = useChatPanelFileDropProvider()

function onActivate() {
  nextTick(() => {
    activeMsgListRef.value?.onActivate?.()
  })
}

defineExpose({ onActivate })
</script>

<style scoped>
.chat-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding-top: 16px;
  /* background: var(--bg-primary); */
}

.panel-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}


/* 拖拽遮罩层 */
.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 48px;
  /* border: 2px dashed #7C6EFA; */
  border-radius: 16px;
  background: #fff;
  min-width: 280px;
}

.drag-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.drag-title {
  font-size: 15px;
  font-weight: 600;
  color: #2F3547;
  margin: 0;
}

.drag-hint {
  font-size: 12px;
  color: #91949E;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
  opacity: 0;
}
</style>
