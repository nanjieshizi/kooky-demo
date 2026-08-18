<template>
  <TaskBridgeDemo />

  <div v-if="false" class="collaboration-container">
    <div
      class="collaboration-main"
      :class="{ 'collaboration-main--group': isGroupChat }"
    >
      <WorkspaceHeader v-if="showWorkspaceHeader" />
      <div class="chat-content">
        <!-- 数字人对话面板 -->
        <template v-if="isDigitalHumanChat">
          <DigitalHumanPanel class="chat-area" />
        </template>

        <!-- 私聊面板 -->
        <template v-else-if="isPrivateChat">
          <PrivatePanel class="chat-area" />
        </template>

        <!-- 群聊面板（保留现有逻辑） -->
        <template v-else>
          <ChatPanel
            v-for="sid in visitedSpaceIds"
            :key="sid"
            :ref="setChatPanelRef(sid)"
            v-show="sid === activeSpaceId"
            list-context="collaboration"
            :conversation-id="sid"
            class="chat-area"
          />
        </template>
      </div>
    </div>

    <!-- 群组成员侧边栏（仅在群聊时显示） -->
    <GroupRosterSidebar
      v-if="showGroupRoster"
      :conversation-id="activeSpaceId"
    />
  </div>
</template>

<script setup>
defineOptions({ name: 'Collaboration' })

// Vue 核心
import { computed, ref, watch, onActivated, nextTick } from 'vue'

// Store
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'

// 组件
import WorkspaceHeader from './WorkspaceHeader.vue'
import ChatPanel from './ChatPanel.vue'
import GroupRosterSidebar from '@/modules/group/components/GroupRosterSidebar.vue'
import PrivatePanel from '@/modules/private/components/PrivatePanel.vue'
import DigitalHumanPanel from '@/modules/private/components/DigitalHumanPanel.vue'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import {
  isPrivateSecondaryNav,
  isDigitalHumanSecondaryNav,
  shouldCloseGroupRosterOnSpaceChange,
  shouldShowGroupRosterSidebar,
  shouldShowWorkspaceHeader,
} from '@/modules/space/utils/collaborationLayout.js'
import TaskBridgeDemo from '@/modules/task-bridge/components/TaskBridgeDemo.vue'

const groupStore = useGroupStore()
const uiStore = useUIStore()
const sidePanelStore = useSidePanelStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()
const activeSpaceId = computed(() => groupStore.currentSpaceId)
const chatPanelRefs = ref({})

// 判断当前选中的是否为私聊
const isPrivateChat = computed(() => {
  return isPrivateSecondaryNav(uiStore.activeSecondaryNav)
})

// 判断当前选中的是否为数字人会话
const isDigitalHumanChat = computed(() => {
  return isDigitalHumanSecondaryNav(uiStore.activeSecondaryNav)
})

const isGroupChat = computed(() => (
  Boolean(activeSpaceId.value) && !isPrivateChat.value && !isDigitalHumanChat.value
))

watch(
  () => uiStore.activeSecondaryNav,
  (secondaryNav) => {
    if (uiStore.activePrimaryNav !== 'collaboration') return
    if (isPrivateSecondaryNav(secondaryNav) || isDigitalHumanSecondaryNav(secondaryNav)) {
      sidePanelStore.close()
    }
  },
  { immediate: true },
)

let prevDigitalHumanChat = false
watch(isDigitalHumanChat, (active) => {
  if (prevDigitalHumanChat && !active && uiStore.activePrimaryNav === 'collaboration') {
    collaborationEmployeeChatStore.activateRoomChat()
  }
  prevDigitalHumanChat = active
}, { immediate: true })

const setChatPanelRef = (sid) => (el) => {
  if (el) {
    chatPanelRefs.value[sid] = el
  } else {
    delete chatPanelRefs.value[sid]
  }
}

onActivated(() => {
  nextTick(() => {
    const sid = activeSpaceId.value
    if (sid) chatPanelRefs.value[sid]?.onActivate?.()
  })
})

const showWorkspaceHeader = computed(() => shouldShowWorkspaceHeader(uiStore.activeSecondaryNav))
const showGroupRoster = computed(() =>
  shouldShowGroupRosterSidebar(uiStore.activeSecondaryNav, uiStore.groupRosterTab),
)

const SPACE_CACHE_MAX = 10
const visitedSpaceIds = ref([])

watch(
  activeSpaceId,
  (sid, previousSid) => {
    if (!sid) return
    if (shouldCloseGroupRosterOnSpaceChange(sid, previousSid, uiStore.groupRosterTab)) {
      uiStore.closeGroupRosterSidebar()
    }
    const idx = visitedSpaceIds.value.indexOf(sid)
    if (idx !== -1) {
      visitedSpaceIds.value.splice(idx, 1)
    } else if (visitedSpaceIds.value.length >= SPACE_CACHE_MAX) {
      visitedSpaceIds.value.shift()
    }
    visitedSpaceIds.value.push(sid)
  },
  { immediate: true },
)

watch(
  [() => uiStore.activePrimaryNav, activeSpaceId],
  ([primaryNav, sid]) => {
    if (primaryNav !== 'collaboration' || !sid) return
    void groupStore.selectConversation(sid, { forceRead: true })
  },
  { immediate: true },
)
</script>

<style scoped>
.collaboration-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  gap: 8px;
  background: #f5f6f8;
}

.collaboration-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

/* 精确复用 0805 生产群聊底纹；只在协作群聊生效，私聊/数字人不染色。 */
.collaboration-main--group {
  position: relative;
}

.collaboration-main--group::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255, 151, 133, 0.28) 1.2px, transparent 1.3px);
  background-size: 18px 18px;
  background-position: 0 0;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0) 50%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0) 50%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.collaboration-main--group > * {
  position: relative;
  z-index: 1;
}

.chat-content {
  flex: 1;
  min-height: 0;
  position: relative;
}

.chat-area {
  position: absolute;
  inset: 0;
}
</style>
