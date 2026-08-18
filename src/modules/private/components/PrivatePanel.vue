<template>
  <div class="private-panel">
    <header v-if="currentChat" class="private-panel-header">
      <div class="header-left">
        <span class="peer-name">会话</span>
      </div>
    </header>
    <PrivateMessageList
      v-if="currentChat"
      :key="currentChat.conversationId"
      :conversation-id="currentChat.conversationId"
      class="chat-area"
    />
    <div v-else class="placeholder">未选中私聊</div>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePrivateStore } from '@/modules/private/store'
import { useUIStore } from '@/modules/space/uiStore'
import PrivateMessageList from './PrivateMessageList.vue'

defineOptions({ name: 'PrivatePanel' })

const privateStore = usePrivateStore()
const uiStore = useUIStore()
const { currentChat } = storeToRefs(privateStore)

/** 监听二级导航：进入 private-{id} 时同步 currentChatId */
watch(
  () => uiStore.activeSecondaryNav,
  (nav) => {
    if (typeof nav !== 'string' || !nav.startsWith('private-')) return
    const id = nav.slice('private-'.length)
    const cid = Number(id) || id
    if (cid && cid !== privateStore.currentChatId) {
      privateStore.selectChat(cid)
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.private-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.private-panel-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  user-select: none;
}

.header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.peer-name {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #2F3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-area {
  flex: 1;
  min-height: 0;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
</style>
