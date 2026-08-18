<template>
  <div class="collaboration-b-container">
    <!-- 私聊与企业数字人仍是纯对话；协作台只属于群协作。 -->
    <div v-if="isPrivateChat || isDigitalHumanChat" class="plain-conversation-shell">
      <DigitalHumanPanel v-if="isDigitalHumanChat" class="plain-conversation" />
      <PrivatePanel v-else class="plain-conversation" />
    </div>

    <template v-else>
      <div class="collaboration-b-stage">
        <section class="collaboration-b-chat">
          <header class="collaboration-b-chat__header">
            <div class="group-title">
              <span class="group-title__name">{{ currentGroupName }}</span>
              <span v-if="hasCollaborationData" class="group-title__status">协作中</span>
            </div>

            <div class="group-actions">
              <button
                type="button"
                class="header-action header-action--icon"
                :class="{ active: uiStore.groupRosterTab !== null }"
                aria-label="群管理"
                title="群管理"
                @click="toggleGroupManage"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19.5c.5-2.9 2.9-4.7 5.5-4.7s5 1.8 5.5 4.7M16 4.5a3 3 0 0 1 0 6M17 15.2c2 .6 3.2 2.1 3.5 4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              </button>
              <button
                type="button"
                class="header-action header-action--icon"
                :class="{ active: filesActive }"
                :aria-pressed="filesActive"
                aria-label="文件"
                title="文件"
                @click="toggleFiles"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7.5a2 2 0 0 1 2-2h3.2l1.6 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button
                type="button"
                class="header-action header-action--icon header-action--project"
                :class="{ active: projectActive }"
                :aria-pressed="projectActive"
                aria-label="项目"
                title="项目"
                @click="toggleProject"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M14 4.5v15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
            </div>
          </header>

          <div class="collaboration-b-chat__content">
            <ChatPanel
              v-for="sid in visitedSpaceIds"
              :key="sid"
              :ref="setChatPanelRef(sid)"
              v-show="sid === activeSpaceId"
              list-context="collaboration"
              :conversation-id="sid"
              class="chat-area"
            />
          </div>
        </section>

        <Transition name="workbench-slide">
          <CollaborationBWorkbench
            v-if="workbenchExpanded && activeSpaceId"
            :conversation-id="activeSpaceId"
            @request-start-workflow="requestStartWorkflow"
          />
        </Transition>
      </div>

      <GroupRosterSidebar
        v-if="showGroupRoster"
        :conversation-id="activeSpaceId"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onActivated, provide, ref, watch } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useCollabProjectStore } from '@/modules/collaboration/store/projectStore'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { useCollaborationBWorkbenchStore } from '@/modules/collaboration-b/store/workbenchStore'
import {
  collaborationBStewardCandidates,
  resolveCollaborationBSteward,
  useCollaborationBStewardStore,
} from '@/modules/collaboration-b/store/stewardStore'
import ChatPanel from '@/modules/space/components/ChatPanel.vue'
import PrivatePanel from '@/modules/private/components/PrivatePanel.vue'
import DigitalHumanPanel from '@/modules/private/components/DigitalHumanPanel.vue'
import GroupRosterSidebar from '@/modules/group/components/GroupRosterSidebar.vue'
import CollaborationBWorkbench from './CollaborationBWorkbench.vue'
import {
  isDigitalHumanSecondaryNav,
  isPrivateSecondaryNav,
  shouldCloseGroupRosterOnSpaceChange,
  shouldShowGroupRosterSidebar,
} from '@/modules/space/utils/collaborationLayout.js'

defineOptions({ name: 'CollaborationB' })

const groupStore = useGroupStore()
const uiStore = useUIStore()
const projectStore = useCollabProjectStore()
const taskStore = useCollabTaskStore()
const workbenchStore = useCollaborationBWorkbenchStore()
const stewardStore = useCollaborationBStewardStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()

const activeSpaceId = computed(() => groupStore.currentSpaceId || '')
const isPrivateChat = computed(() => isPrivateSecondaryNav(uiStore.activeSecondaryNav))
const isDigitalHumanChat = computed(() => isDigitalHumanSecondaryNav(uiStore.activeSecondaryNav))
const isGroupChat = computed(() => !!activeSpaceId.value && !isPrivateChat.value && !isDigitalHumanChat.value)
const currentGroup = computed(() => (
  groupStore.conversations.find((item) => String(item.conversationId) === String(activeSpaceId.value))
))
const currentGroupName = computed(() => currentGroup.value?.name || activeSpaceId.value || '群聊')
const hasProject = computed(() => !!projectStore.projectForGroup(activeSpaceId.value))
const taskCount = computed(() => activeSpaceId.value ? taskStore.tasksByGroup(activeSpaceId.value).length : 0)
const hasCollaborationData = computed(() => hasProject.value || taskCount.value > 0)
const workbenchExpanded = computed(() => (
  !!activeSpaceId.value && workbenchStore.isExpanded(activeSpaceId.value)
))
const activeWorkbenchTab = computed(() => (
  activeSpaceId.value ? workbenchStore.activeTab(activeSpaceId.value) : 'project'
))
const filesActive = computed(() => workbenchExpanded.value && activeWorkbenchTab.value === 'files')
const projectActive = computed(() => (
  workbenchExpanded.value && ['project', 'board', 'tasks'].includes(activeWorkbenchTab.value)
))
const showGroupRoster = computed(() => (
  shouldShowGroupRosterSidebar(uiStore.activeSecondaryNav, uiStore.groupRosterTab)
))

const visitedSpaceIds = ref([])
const chatPanelRefs = ref({})
const matterComposeRequest = ref(null)
let matterComposeSerial = 0

function setChatPanelRef(spaceId) {
  return (element) => {
    if (element) chatPanelRefs.value[spaceId] = element
    else delete chatPanelRefs.value[spaceId]
  }
}

function toggleFiles() {
  if (!activeSpaceId.value) return
  uiStore.closeGroupRosterSidebar()
  workbenchStore.toggleFiles(activeSpaceId.value)
}

function toggleProject() {
  if (!activeSpaceId.value) return
  uiStore.closeGroupRosterSidebar()
  workbenchStore.toggleProject(activeSpaceId.value)
}

function toggleGroupManage() {
  if (!activeSpaceId.value) return
  if (uiStore.groupRosterTab === null && workbenchExpanded.value) {
    workbenchStore.close(activeSpaceId.value)
  }
  uiStore.toggleGroupRosterTab('manage')
  if (uiStore.groupRosterTab) {
    void groupStore.loadConversationMembers(activeSpaceId.value, { force: true })
  }
}

function openFileInWorkbench({ conversationId, file } = {}) {
  const targetId = String(conversationId || '')
  if (!targetId || targetId !== String(activeSpaceId.value) || !isGroupChat.value) return false
  uiStore.closeGroupRosterSidebar()
  workbenchStore.openFile(targetId, file)
  return true
}

function openTaskInWorkbench({ conversationId, taskId } = {}) {
  const targetId = String(conversationId || '')
  const task = taskStore.tasks[taskId]
  if (
    !targetId
    || targetId !== String(activeSpaceId.value)
    || String(task?.conversationId || '') !== targetId
    || !isGroupChat.value
  ) return
  uiStore.closeGroupRosterSidebar()
  taskStore.setActiveTask(targetId, taskId)
  taskStore.toggleDetailPanel(targetId, true)
  workbenchStore.openTask(targetId, taskId)
}

function requestStartWorkflow(matter = {}) {
  const targetId = String(matter.conversationId || '')
  if (!targetId || targetId !== String(activeSpaceId.value) || !isGroupChat.value) return

  const roomMembers = groupStore.conversationMembers[targetId] || []
  const availableStewards = collaborationBStewardCandidates(roomMembers)
  const selectedStewardId = stewardStore.ensureValidSteward(
    targetId,
    availableStewards.map((item) => item.id),
  )
  const steward = resolveCollaborationBSteward(selectedStewardId, roomMembers)
  matterComposeSerial += 1
  matterComposeRequest.value = {
    serial: matterComposeSerial,
    conversationId: targetId,
    matter: {
      id: String(matter.id || ''),
      title: String(matter.title || '未命名事项'),
      owner: String(matter.owner || '待指定'),
      deadline: String(matter.deadline || ''),
      description: String(matter.description || ''),
    },
    steward: {
      ...steward,
      name: String(steward.name || '团队助手'),
      avatar: steward.avatar || '',
    },
  }
  uiStore.closeGroupRosterSidebar()
}

provide('collaborationBOpenFilePreview', openFileInWorkbench)
provide('collaborationBOpenTask', openTaskInWorkbench)
provide('collaborationBMatterComposeRequest', matterComposeRequest)

watch(
  [activeSpaceId, isGroupChat, hasProject, taskCount],
  ([conversationId, groupActive, projectExists, tasks], previous = []) => {
    if (!conversationId || !groupActive) return
    const hadCollaborationData = !!previous[2] || Number(previous[3] || 0) > 0
    const hasData = !!projectExists || Number(tasks) > 0
    const alreadyInitialized = !!workbenchStore.initializedByConversation[String(conversationId)]
    workbenchStore.ensure(conversationId, {
      hasCollaborationData: hasData,
      preferredTab: projectExists ? 'project' : (Number(tasks) > 0 ? 'tasks' : 'project'),
    })
    if (alreadyInitialized && !hadCollaborationData && hasData) {
      workbenchStore.revealForNewData(conversationId, projectExists ? 'project' : 'tasks')
    }
  },
  { immediate: true },
)

watch(
  activeSpaceId,
  (spaceId, previousSpaceId) => {
    if (!spaceId) return
    if (shouldCloseGroupRosterOnSpaceChange(spaceId, previousSpaceId, uiStore.groupRosterTab)) {
      uiStore.closeGroupRosterSidebar()
    }
    const index = visitedSpaceIds.value.indexOf(spaceId)
    if (index >= 0) visitedSpaceIds.value.splice(index, 1)
    else if (visitedSpaceIds.value.length >= 10) visitedSpaceIds.value.shift()
    visitedSpaceIds.value.push(spaceId)
  },
  { immediate: true },
)

watch(
  [() => uiStore.activePrimaryNav, activeSpaceId],
  ([primaryNav, spaceId]) => {
    if (primaryNav !== 'collaboration-b' || !spaceId || !isGroupChat.value) return
    void groupStore.selectConversation(spaceId, { forceRead: true })
  },
  { immediate: true },
)

let wasDigitalHumanChat = false
watch(isDigitalHumanChat, (active) => {
  if (wasDigitalHumanChat && !active && uiStore.activePrimaryNav === 'collaboration-b') {
    collaborationEmployeeChatStore.activateRoomChat()
  }
  wasDigitalHumanChat = active
}, { immediate: true })

watch(
  () => uiStore.activeSecondaryNav,
  (secondaryNav) => {
    if (uiStore.activePrimaryNav !== 'collaboration-b') return
    if (isPrivateSecondaryNav(secondaryNav) || isDigitalHumanSecondaryNav(secondaryNav)) {
      uiStore.closeGroupRosterSidebar()
    }
  },
  { immediate: true },
)

onActivated(() => {
  nextTick(() => {
    const spaceId = activeSpaceId.value
    if (spaceId && isGroupChat.value) chatPanelRefs.value[spaceId]?.onActivate?.()
  })
})
</script>

<style scoped>
.collaboration-b-container {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  gap: 8px;
  overflow: hidden;
  background: #f5f6f8;
}
.plain-conversation-shell,
.collaboration-b-stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
}
.collaboration-b-stage { position: relative; }
.plain-conversation { flex: 1; min-width: 0; }
.collaboration-b-chat {
  position: relative;
  flex: 1;
  min-width: 260px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.collaboration-b-chat::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,151,133,.28) 1.2px, transparent 1.3px);
  background-size: 18px 18px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.95), transparent 50%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.95), transparent 50%);
}
.collaboration-b-chat > * { position: relative; z-index: 1; }
.collaboration-b-chat__header {
  height: 54px;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px 0 16px;
  box-sizing: border-box;
  background: rgba(255,255,255,.78);
  backdrop-filter: blur(3px);
}
.group-title { min-width: 0; display: flex; align-items: center; gap: 8px; }
.group-title__name { min-width: 0; max-width: min(360px, 34vw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #2f3547; font-size: 14px; }
.group-title__status { flex-shrink: 0; padding: 2px 7px; border-radius: 9px; color: #15915a; background: #e9f8f0; font-size: 10px; }
.group-actions { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
.header-action { height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 0 9px; border: 0; outline: none; border-radius: 7px; color: #5f6675; background: transparent; font-size: 12px; cursor: pointer; }
.header-action svg { width: 17px; height: 17px; }
.header-action:hover,
.header-action.active { color: #2f3547; background: rgba(47,53,71,.07); }
.header-action:focus-visible { box-shadow: 0 0 0 2px rgba(255,98,31,.2); }
.header-action--icon { width: 30px; padding: 0; }
.collaboration-b-chat__content { flex: 1; min-height: 0; position: relative; }
.chat-area { position: absolute; inset: 0; }
.workbench-slide-enter-active,
.workbench-slide-leave-active { transition: opacity .2s ease, transform .24s cubic-bezier(.22,1,.36,1); }
.workbench-slide-enter-from,
.workbench-slide-leave-to { opacity: 0; transform: translateX(20px); }
</style>
