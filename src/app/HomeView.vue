<template>
  <div class="home-view">
    <!-- 左上角背景图，从 0,0 开始覆盖顶部栏 -->
    <div class="nav-bg-layer" />
    <TitleBar />

    <!-- 收起/展开按钮：始终存在于最外层，通过 left 过渡 -->
    <!-- <button
      class="nav-rail-toggle-btn"
      :class="{ 'nav-rail-toggle-btn--collapsed': !uiStore.navRailVisible }"
      @click="uiStore.toggleNavRail()"
    >
      <img src="@/assets/home/show.png" class="nav-toggle-icon" :class="{ 'nav-toggle-icon--flipped': uiStore.navRailVisible }" alt="切换" />
    </button> -->

    <div class="home-body" :class="{ 'nav-collapsed': !uiStore.navRailVisible }">
      <WorkspaceSidebar>
      </WorkspaceSidebar>

      <!-- 中间主区：CLI 终端 与 对话区 共用同一 flex 位置，v-show 切换 -->
      <!-- 会话区右侧留缝：仅「贴合型」面板（分身管理/数字员工/一人团队任务/会话侧区）展开时收掉；
           文件、待办这类圆角悬浮卡要留缝，不参与判断 -->
      <div class="center-area-wrapper" :class="{ 'gap-right': !uiStore.globalFilePreviewActive && !uiStore.personaPanelVisible && !uiStore.digitalEmployeePanelVisible && !showOnePersonTaskPanel && !showConversationSidePanel }">
        <!-- Kode 工作台（替代老 Claude Code 终端入口；cli nav 激活时显示）-->
        <div v-show="uiStore.claudeCodeActive" class="claude-code-host kode-host">
          <KodeView v-if="uiStore.claudeCodeVisible" />
        </div>

        <!-- 对话区 -->
        <div v-show="!uiStore.claudeCodeActive" class="main-area-wrapper">
          <div class="main-area" :class="{ 'merged-side': showConversationSidePanel }">
            <div class="main-area-body">
              <div class="content-area">
                <CreateCollaborationView
                  v-if="showCreateCollaborationView && uiStore.imReady"
                  class="main-content"
                  @create="handleCreateCollaboration"
                />

                <router-view v-else-if="isMarketNav" v-slot="{ Component }" class="main-content">
                  <keep-alive :key="`market-${userStore.cacheKey}`" :include="['SkillMarketView', 'AvatarMarketView', 'MyUploadsView', 'MyHiredView', 'EnterpriseAvatarView']">
                    <component :is="Component" />
                  </keep-alive>
                </router-view>

                <router-view v-else-if="isContactsNav" v-slot="{ Component }" class="main-content">
                  <keep-alive :include="['ContactsEmployeesView', 'ContactsOrgView']">
                    <component :is="Component" />
                  </keep-alive>
                </router-view>

                <router-view v-else-if="isDeerflowNav" v-slot="{ Component }" class="main-content">
                  <keep-alive :include="['DeerflowChatPanel']">
                    <component :is="Component" />
                  </keep-alive>
                </router-view>

                <router-view v-else-if="isCommunityNav" v-slot="{ Component }" class="main-content">
                  <component :is="Component" />
                </router-view>

                <keep-alive>
                  <component
                    v-if="keptMainView"
                    :is="keptMainView.is"
                    :key="keptMainView.key"
                    class="main-content"
                    v-bind="keptMainView.extras"
                  />
                </keep-alive>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 统一「会话侧区」：与会话合体，装 管理/任务/文件预览，互斥可拖拽；滑入滑出 -->
      <Transition name="side-slide">
        <ConversationSidePanel v-if="showConversationSidePanel" />
      </Transition>

      <!-- 全局共享预览区：整个 kooky 共用一个（Kode 等仍用）；会话侧区 preview 槽激活时由侧区接管，避免重复 -->
      <Transition name="file-panel-slide">
        <div v-if="previewStore.visible && sidePanelStore.activePanel !== 'preview'" class="preview-shell-host">
          <GroupFilesPreviewPane />
        </div>
      </Transition>

      <!-- Agent 市场侧拉抽屉 -->
      <AgentMarketDrawer
        v-if="isCollaborationNav"
        :visible="uiStore.isAgentPanelOpen"
        @close="uiStore.closeRightPanel()"
      />

      <!-- 分身管理 / 一人团队数字员工管理（复用 PersonaManagePanel） -->
      <Transition name="file-panel-slide">
        <div
          v-if="(uiStore.personaPanelVisible || uiStore.digitalEmployeePanelVisible) && !isContactsBNav"
          class="file-panel-wrapper persona-panel-wrapper"
        >
          <PersonaManagePanel
            :key="`persona-${personaManageContext}-${activePersonaAgentId ?? 'none'}`"
            :agent-id="activePersonaAgentId"
            :context="personaManageContext"
            :initial-width="isContactsNav ? 350 : 260"
          />
        </div>
      </Transition>

      <!-- 通讯录 · 组织目录 / 企业数字人：点人出的档案卡（与数字员工管理同一个落位） -->
      <Transition name="file-panel-slide">
        <div v-if="isContactsNav && contactsStore.activeProfile" class="file-panel-wrapper contacts-profile-wrapper">
          <ContactsProfilePanel />
        </div>
      </Transition>

      <!-- 文件库面板（改版：不分云端/本地，用户文件库 + 弹窗预览）-->
      <Transition name="file-panel-slide">
        <div v-if="(uiStore.toolFileContentVisible || uiStore.notificationPanelOpen) && !showOnePersonTaskPanel && !showCollabTaskPanel" class="file-panel-wrapper">
          <FileLibraryPanel />
        </div>
      </Transition>

      <!-- 定时任务详情面板 -->
      <Transition name="file-panel-slide">
        <div v-if="showScheduleDetailPanel" class="file-panel-wrapper schedule-detail-wrapper">
          <ScheduleDetailPanel />
        </div>
      </Transition>

      <!-- 定时任务列表面板 -->
      <Transition name="file-panel-slide">
        <div v-if="showScheduleListPanel" class="file-panel-wrapper schedule-panel-wrapper">
          <ScheduleListPanel />
        </div>
      </Transition>

      <!-- 我的待办面板 -->
      <Transition name="file-panel-slide">
        <div v-if="showTodoPanel" class="file-panel-wrapper todo-panel-wrapper">
          <TodoPanel />
        </div>
      </Transition>

      <!-- 工具栏：始终固定在最右侧 -->
      <ToolPanel class="tool-panel-host" />
    </div>

    <!-- 全局文件预览弹窗（文件库 / 分身会话文件卡 共用）-->
    <FilePreviewModal />

    <!-- 定时任务创建/编辑弹窗 -->
    <ScheduleCreateDialog />

    <!-- 新建项目：网页 demo 中进入项目背景创建弹窗 -->
    <CreateProjectBaseModal
      :visible="showCreateTeamDialog"
      @update:visible="showCreateTeamDialog = $event"
    />
  </div><!-- end home-view -->
</template>

<script setup>
import { computed, markRaw, onMounted, ref, watch } from 'vue'
import WorkspaceSidebar from '@/modules/space/components/WorkspaceSidebar.vue'
import TitleBar from '@/modules/space/components/TitleBar.vue'
import ToolPanel from '@/modules/space/components/ToolPanel.vue'
import PersonaManagePanel from '@/modules/space/components/PersonaManagePanel.vue'
import ContactsProfilePanel from '@/modules/contacts/components/ContactsProfilePanel.vue'
import { useContactsStore } from '@/modules/contacts/store'
import OnePersonTeamTaskPanel from '@/modules/solo-team/components/one-person-team/OnePersonTeamTaskPanel.vue'
import CollabTaskListPanel from '@/modules/collaboration/components/CollabTaskListPanel.vue'
import CollabTaskDetailPanel from '@/modules/collaboration/components/CollabTaskDetailPanel.vue'
import { useCollabTaskStore } from '@/modules/collaboration/store/taskStore'
import ScheduleListPanel from '@/modules/schedule/components/ScheduleListPanel.vue'
import ScheduleDetailPanel from '@/modules/schedule/components/ScheduleDetailPanel.vue'
import TodoPanel from '@/modules/todo/components/TodoPanel.vue'
import FileLibraryPanel from '@/modules/file/components/FileLibraryPanel.vue'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import ScheduleCreateDialog from '@/modules/schedule/components/ScheduleCreateDialog.vue'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'

import Collaboration from '@/modules/space/components/Collaboration.vue'
import CollaborationB from '@/modules/collaboration-b/components/CollaborationB.vue'
import AgentMarketDrawer from '@/modules/agent/components/AgentMarketDrawer.vue'
import ClaudeCodeView from '@/modules/terminal/components/ClaudeCodeView.vue'
import KodeView from '@/modules/kode/KodeView.vue'
import CreateProjectBaseModal from '@/modules/group/components/CreateProjectBaseModal.vue'
import { CreateCollaborationView } from '@/modules/collaboration'
import { SoloTeamView } from '@/modules/solo-team'
import GroupFilesPreviewPane from '@/modules/solo-team/components/one-person-team/GroupFilesPreviewPane.vue'
import ConversationSidePanel from '@/modules/space/components/ConversationSidePanel.vue'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { useUIStore } from '@/modules/space/uiStore'
import { usePreviewStore } from '@/modules/space/previewStore'
import { useUserStore } from '@/modules/auth/store'
import { useGroupStore } from '@/modules/group/store'
import { usePrivateStore } from '@/modules/private/store'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { isDigitalHumanSecondaryNav } from '@/modules/space/utils/collaborationLayout'
import { isCollaborationNavKey } from '@/modules/navigation/config'
import { useRouter, useRoute } from 'vue-router'
import { ROOM_TYPES } from '@/shared/im-client'

const router = useRouter()
const route = useRoute()

const uiStore = useUIStore()
const previewStore = usePreviewStore()
const sidePanelStore = useSidePanelStore()
const userStore = useUserStore()

// （已移除）预览打开自动收起二级菜单的逻辑：预览已迁入会话侧区，不再需要，且与任务/管理不一致
const groupStore = useGroupStore()
const privateStore = usePrivateStore()
const deerflowStore = useDeerflowChatStore()
const soloTeamStore = useSoloTeamStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()

/** 数字员工管理侧栏：协作数字人 vs 一人团队「我的员工」 */
const isCollaborationDigitalEmployeeManageContext = computed(
  () =>
    uiStore.digitalEmployeePanelVisible
    && isCollaborationNavKey(uiStore.activePrimaryNav)
    && isDigitalHumanSecondaryNav(uiStore.activeSecondaryNav),
)

/** 侧栏 PersonaManagePanel：deerflow 分身 vs 数字员工（一人团队 / 协作数字人） */
const activePersonaAgentId = computed(() => {
  if (uiStore.digitalEmployeePanelVisible) {
    if (isCollaborationDigitalEmployeeManageContext.value) {
      return collaborationEmployeeChatStore.currentEmployeeId ?? null
    }
    return soloTeamStore.currentEmployeeId ?? null
  }
  return deerflowStore.selectedAgentId
})

const personaManageContext = computed(() => {
  if (uiStore.digitalEmployeePanelVisible) {
    return isCollaborationDigitalEmployeeManageContext.value ? 'collaborationEmployee' : 'employee'
  }
  return 'deerflow'
})

const isCollaborationNav = computed(() => uiStore.activePrimaryNav === 'collaboration')
const isCollaborationBNav = computed(() => uiStore.activePrimaryNav === 'collaboration-b')
const isSoloTeamNav = computed(() => uiStore.activePrimaryNav === 'solo-team')
const isMarketNav = computed(() => uiStore.activePrimaryNav === 'market')
const isCliNav = computed(() => uiStore.activePrimaryNav === 'cli')
const isDeerflowNav = computed(() => uiStore.activePrimaryNav === 'deerflow')
const isCommunityNav = computed(() => uiStore.activePrimaryNav === 'community')
// 通讯录 A / B（B 是演示用的列表版）共用同一套主区渲染、档案卡、面板宽度
const isContactsNav = computed(() => ['contacts', 'contacts-b'].includes(uiStore.activePrimaryNav))
/** B 版的员工管理是整页的（详情页内嵌 PersonaManagePanel），右侧那条 350px 面板不该出现 ——
 *  从 A 版点过员工再切到 B，panelVisible 还是 true，会两份配置同屏 */
const isContactsBNav = computed(() => uiStore.activePrimaryNav === 'contacts-b')

/** 会话侧区（专项作战室 / 任务 / 预览）是会话场的东西 —— 通讯录没有会话，
 *  从「个人」带着作战室切过来会把员工列表挤成一列一个字 */
const showConversationSidePanel = computed(() => (
  sidePanelStore.isOpen
  // 专项作战室已从当前 Demo 的会话布局中移除，避免残留状态继续挤占对话区域。
  && sidePanelStore.activePanel !== 'office'
  && !isContactsNav.value
  && !isCollaborationBNav.value
))
const contactsRoutePrefix = computed(() => (uiStore.activePrimaryNav === 'contacts-b' ? '/contacts-b/' : '/contacts/'))
const contactsStore = useContactsStore()
const showOnePersonTaskPanel = computed(() => isSoloTeamNav.value && uiStore.activeToolTab === 'task')
const showCollabTaskPanel = computed(() => isCollaborationNav.value && uiStore.activeToolTab === 'task')

const collabTaskStore = useCollabTaskStore()
const showCollabTaskDetailPanel = computed(() => {
  if (!isCollaborationNav.value) return false
  // 任务已迁入统一会话侧区：侧区 tasks 槽激活时，老的详情面板不再重复渲染
  if (sidePanelStore.activePanel === 'tasks') return false
  const cid = groupStore.currentSpaceId || groupStore.currentConversationId
  if (!cid) return false
  if (!collabTaskStore.detailPanelOpenByGroup[cid]) return false
  return !!collabTaskStore.activeTaskByGroup[cid]
})

const showTodoPanel = computed(() => uiStore.activeToolTab === 'todo')

const scheduleStore = useScheduleStore()
const showScheduleListPanel = computed(() => uiStore.activeToolTab === 'schedule')
const showScheduleDetailPanel = computed(() =>
  showScheduleListPanel.value && !!scheduleStore.activeTaskId
)

// 与 extras 中 {} 用同一引用，避免重渲染时 v-bind 传入新空对象
const KA_EXTRAS_EMPTY = Object.freeze({})

function syncRouteWithPrimaryNav(primaryNav) {
  let targetPath = null

  if (primaryNav === 'deerflow') {
    if (!route.path.startsWith('/deerflow-chats')) {
      // 有上次选过的对话则恢复，没有则进引导页
      const lastThreadId = deerflowStore.currentThreadId
      targetPath = lastThreadId ? `/deerflow-chats/${lastThreadId}` : '/deerflow-chats'
    }
  } else if (primaryNav === 'market') {
    // 市场导航：如果路由不在 /market/ 下，跳转到默认市场页
    if (!route.path.startsWith('/market/')) {
      targetPath = '/market/skill'
    }
  } else if (primaryNav === 'contacts' || primaryNav === 'contacts-b') {
    // 通讯录：不在自己那段路由下就落到「我的员工」
    const prefix = contactsRoutePrefix.value
    if (!route.path.startsWith(prefix)) {
      // A 版首页 = 我的员工；B 版首页 = 组织目录（员工在二级栏平铺，不是页面）
      // A 版首页 = 我的员工页；B 版首页 = 我的助理（左边选中它，主区是它的整页管理）
      targetPath = prefix === '/contacts-b/' ? '/contacts-b/employee/assistant' : '/contacts/employees'
    }
  } else if (primaryNav === 'community') {
    if (route.path !== '/community') {
      targetPath = '/community'
    }
  } else if (
    route.path.startsWith('/market/')
    || route.path.startsWith('/contacts/')
    || route.path.startsWith('/contacts-b/')
    || route.path.startsWith('/deerflow-chats')
    || route.path === '/community'
  ) {
    // 非市场/deerflow/社区导航，但路由还停留在这些路径上，重置到根路径
    targetPath = '/'
  }

  if (targetPath && route.path !== targetPath) {
    router.replace(targetPath)
  }
}

// 监听导航切换，确保路由回到匹配当前一级导航的路径。
// 初始同步放到 mounted 后，避免 setup 阶段路由切换打断当前组件的首次 patch。
onMounted(() => {
  syncRouteWithPrimaryNav(uiStore.activePrimaryNav)
})

watch(
  () => uiStore.activePrimaryNav,
  (primaryNav) => {
    syncRouteWithPrimaryNav(primaryNav)
  },
)

// 通讯录整页靠路由渲染：路由被别处重置到根时主区会空掉，兜回员工页。
// 注意：只在路由被踢出「整个通讯录家族」时兜底。切 通讯录 ↔ 通讯录B 时路径仍是
// /contacts(-b)/ 段，子前缀由 activePrimaryNav 的 watcher 负责对齐——这里若按
// contactsRoutePrefix（跟着 activePrimaryNav，切换瞬间会滞后）去纠偏，两个 watcher
// 会互相 replace 打架、直到卡死。
watch(
  () => route.path,
  (path) => {
    if (
      isContactsNav.value
      && !path.startsWith('/contacts/')
      && !path.startsWith('/contacts-b/')
    ) {
      router.replace(`${contactsRoutePrefix.value}employees`)
    }
  },
)

/** 当前展示上下文是否为协作群组（Matrix room） */
const isDisplayedGroupSpace = computed(() => {
  if (!isCollaborationNavKey(uiStore.activePrimaryNav)) return false
  const cid = groupStore.currentSpaceId
  const conversation = groupStore.conversations.find((c) => c.conversationId === cid)
  return conversation?.createRoomType === ROOM_TYPES.GROUP_CHAT
})

/** 是否有协作团队 */
const hasCollaborationTeams = computed(() => {
  const groupCount = groupStore.conversations?.length || 0
  const privateCount = privateStore.privateChats?.length || 0
  const employeeCount = collaborationEmployeeChatStore.employeeChatEmployees?.length || 0
  return (groupCount + privateCount + employeeCount) > 0
})

/** 显示创建协作引导页（无团队时） */
const showCreateCollaborationView = computed(() => {
  return (isCollaborationNav.value || isCollaborationBNav.value)
    && !hasCollaborationTeams.value
    && !groupStore.isCreatingTeam
})

// 窄屏时收起二级导航，保留一级导航入口

// 进入群组时关闭全局文件树；离开群组时关闭团队文件侧栏
watch(isDisplayedGroupSpace, (isGroup) => {
  if (isGroup) {
    uiStore.globalFilePanelVisible = false
  } else {
    uiStore.closeRightPanel()
    uiStore.closeGroupRosterSidebar()
  }
})

watch(() => uiStore.activePrimaryNav, (nav) => {
  // 切换模块时关掉全局预览区（Kode 等开的预览不该跨模块残留）
  previewStore.close()

  if (!['collaboration', 'cli'].includes(nav)) {
    uiStore.closeNotificationPanel()
    uiStore.closeRightPanel()
    uiStore.closeGroupRosterSidebar()
  }

  if (!['solo-team', 'collaboration'].includes(nav) && uiStore.activeToolTab === 'task') {
    uiStore.activeToolTab = null
  }

  // 离开 deerflow 时自动关闭对话面板
  if (nav !== 'deerflow') {
    uiStore.closeDeerflowThreadPanel()
  }

  // cli 导航自动切换到本地文件 Tab，离开 cli 恢复云端文件 Tab
  if (nav === 'cli') {
    uiStore.setFileTab('global')
  } else if (uiStore.activeFileTab === 'global') {
    uiStore.setFileTab('team')
  }
})

// keep-alive 单入口：与 CreateCollaborationView 互斥；进市场/CLI 时内部不挂子级以保留缓存
const keptMainView = computed(() => {
  if (isMarketNav.value) return null
  if (isContactsNav.value) return null
  if (isCommunityNav.value) return null
  if (isSoloTeamNav.value) {
    return {
      is: markRaw(SoloTeamView),
      key: 'kept-solo-team',
      extras: KA_EXTRAS_EMPTY,
    }
  }
  if (
    isCollaborationNav.value
    && !groupStore.isCreatingTeam
    && !showCreateCollaborationView.value
  ) {
    return { is: markRaw(Collaboration), key: 'kept-collaboration', extras: {} }
  }
  if (
    isCollaborationBNav.value
    && !groupStore.isCreatingTeam
    && !showCreateCollaborationView.value
  ) {
    return { is: markRaw(CollaborationB), key: 'kept-collaboration-b', extras: KA_EXTRAS_EMPTY }
  }
  return null
})

// 新建项目弹框；项目看板是每个协作项目的常驻能力
const showCreateTeamDialog = ref(false)

function handleCreateCollaboration() {
  showCreateTeamDialog.value = true
}

</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: hidden;
  overflow-x: auto;
  background: var(--bg-primary);
  position: relative;
  min-width: 960px;
}

.nav-bg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 260px;
  height: 264px;
  background: url('@/assets/navigation/navigationBg.png') no-repeat left top;
  background-size: 260px 264px;
  pointer-events: none;
  z-index: 201;
}


.home-body {
  position: relative; /* 作为悬浮工具栏的定位父级 */
  flex: 1;
  display: flex;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  transition: padding-left 0.24s ease;
}

.home-body.nav-collapsed {
  padding-left: 15px;
}

/* 导航栏收起/展开按钮 */
.nav-rail-toggle-btn {
  position: fixed;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1200;
  padding: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
  left: calc(var(--sidebar-width, 80px) - 10px);
  top: 92px;
  border: 1px solid #EDEEF0;
  box-shadow: 0px 5px 6px 0px rgba(0, 0, 0, 0.1);
}

.nav-rail-toggle-btn--collapsed {
  left: 8px;
}

.nav-rail-toggle-btn:hover {
  border-color: rgba(47, 53, 71, 0.24);
  box-shadow: 0 2px 8px rgba(47, 53, 71, 0.15);
}

.nav-toggle-icon {
  width: 18px;
  height: auto;
  transform: scaleX(-1);
  transition: transform 0.24s ease;
}

.nav-toggle-icon--flipped {
  transform: scaleX(1);
}

/* 中间主区容器：CLI 与对话区共用，flex: 1 撑满 */
.center-area-wrapper {
  flex: 1;
  min-width: 300px;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
  z-index: 202;
}

.center-area-wrapper.gap-right {
  margin-right: 8px;
}

.main-area-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow: hidden;
  margin-bottom: 10px;
}

.main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
}

/* 会话侧区打开：会话右侧变直角，与侧区拼成一整片大卡 */
.main-area.merged-side {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.main-area-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-area {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.main-content {
  flex: 1;
  min-width: 0;
}

.chat-main-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  min-width: 0;
}

/* Terminal fullscreen transition */
.terminal-fade-enter-active {
  transition: opacity 0.2s ease;
}
.terminal-fade-leave-active {
  transition: opacity 0.15s ease;
}
.terminal-fade-enter-from,
.terminal-fade-leave-to {
  opacity: 0;
}

.claude-code-host {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 8px;
  box-sizing: border-box;
  position: relative;
  z-index: 202;
}

/* 文件树展开/收起动画 */
.file-panel-slide-enter-active,
.file-panel-slide-leave-active {
  transition: width 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}

.file-panel-slide-enter-from,
.file-panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}

.file-panel-slide-enter-to,
.file-panel-slide-leave-from {
  width: 260px;
  opacity: 1;
}

.file-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex-shrink: 0;
  z-index: 203;
  margin-bottom: 10px;
}

.task-panel-wrapper {
  width: 260px;
  padding-left: 8px;
  box-sizing: content-box;
}

/* 通讯录档案卡：与会话区留一条缝，宽度由组件自己定 */
.contacts-profile-wrapper {
  padding-left: 8px;
  box-sizing: content-box;
}

.task-detail-wrapper {
  width: 380px;
  padding-left: 8px;
  box-sizing: content-box;
}

.schedule-panel-wrapper {
  width: 280px;
  box-sizing: content-box;
}

.schedule-detail-wrapper {
  width: 420px;
  box-sizing: content-box;
}

.file-panel-slide-enter-to.task-panel-wrapper,
.file-panel-slide-leave-from.task-panel-wrapper {
  width: 268px;
}

/* 宽度由 PersonaManagePanel 内 panelWidth 控制，勿写死 260px，否则拖宽无效 */
.persona-panel-wrapper {
  width: auto;
  overflow: visible;
}

.file-panel-slide-enter-active.persona-panel-wrapper,
.file-panel-slide-leave-active.persona-panel-wrapper {
  transition: min-width 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
  overflow: visible;
}

.file-panel-slide-enter-from.persona-panel-wrapper,
.file-panel-slide-leave-to.persona-panel-wrapper {
  width: auto !important;
  min-width: 0 !important;
  opacity: 0;
}

.file-panel-slide-enter-to.persona-panel-wrapper,
.file-panel-slide-leave-from.persona-panel-wrapper {
  width: auto;
  min-width: 260px;
  opacity: 1;
}

/* 工具栏：始终固定在最右侧，占位不覆盖 */
.tool-panel-host {
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  padding: 0px 8px 8px 0;
}

/* 全局共享预览区外壳：模块右侧的一列（贴合内容区、无缝）*/
.preview-shell-host {
  flex-shrink: 0;
  width: 480px;
  display: flex;
  align-self: stretch;
  margin-bottom: 10px;
  box-sizing: content-box;
}

.preview-shell-host > * {
  flex: 1;
  min-width: 0;
}
</style>
