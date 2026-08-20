<template>
  <aside
    ref="sidebarRef"
    class="workspace-sidebar"
    :class="{
      'workspace-sidebar--expanded': showSecondaryPanel && uiStore.navRailVisible,
      'workspace-sidebar--collapsed': !uiStore.navRailVisible,
    }"
  >
    <div class="nav-rail" :class="{ 'nav-rail--hidden': !uiStore.navRailVisible }">
      <div class="nav-rail-top">
        <button
          v-for="item in topNavItems"
          :key="item.key"
          type="button"
          class="primary-nav-item"
          :class="{ active: isPrimaryItemActive(item.key), 'is-mounting': (isCollaborationNavKey(item.key) && collaborationPulse) || (item.key === 'solo-team' && personalPulse), 'primary-nav-item--personal': item.key === 'solo-team', 'primary-nav-item--collaboration': isCollaborationNavKey(item.key) }"
          :data-nav-key="item.key"
          @click="onPrimaryNavClick(item)"
        >
          <span class="primary-nav-icon-shell">
            <span class="primary-nav-icon-inner">
              <img :src="item.icon" :alt="item.label" class="primary-nav-icon" />
            </span>
            <span
              v-if="isCollaborationNavKey(item.key) && unreadStore.totalUnreadCount > 0"
              class="primary-nav-badge"
            >{{ formatUnread(unreadStore.totalUnreadCount) }}</span>
            <span
              v-if="item.key === 'cli' && cliUnreadCount > 0"
              class="primary-nav-badge"
            >{{ formatUnread(cliUnreadCount) }}</span>
          </span>
          <span class="primary-nav-label">{{ item.label }}</span>
        </button>
      </div>
      <div v-if="communityNavItem" class="nav-rail-bottom">
        <button
          type="button"
          class="primary-nav-item"
          :class="{ active: isPrimaryItemActive(communityNavItem.key) }"
          @click="onPrimaryNavClick(communityNavItem)"
        >
          <span class="primary-nav-icon-shell">
            <span class="primary-nav-icon-inner">
              <img :src="communityNavItem.icon" :alt="communityNavItem.label" class="primary-nav-icon" />
            </span>
          </span>
        </button>
      </div>
    </div>

    <Transition name="submenu-slide">
      <section
        v-if="showSecondaryPanel"
        class="submenu-panel"
      >
        <!-- 个人页仅保留新建入口，不展示历史会话或助手列表。 -->
        <div
          v-if="isCollaborationNavKey(uiStore.activePrimaryNav) || ['deerflow', 'solo-team'].includes(uiStore.activePrimaryNav)"
          class="submenu-header"
        >
          <button
            type="button"
            class="submenu-add-btn"
            @click="onAddTeamClick"
          >
            <img :src="addIcon" width="18" height="18" alt="新建" />
            <span v-if="isCollaborationNavKey(uiStore.activePrimaryNav)" class="submenu-add-label">新建项目</span>
            <span v-else-if="uiStore.activePrimaryNav === 'solo-team'" class="submenu-add-label">新建</span>
          </button>
        </div>

        <!-- 市场模块使用独立组件 -->
        <MarketSubmenu v-if="uiStore.activePrimaryNav === 'market'" />

        <!-- 通讯录：我的数字员工 / 组织目录 + 状态筛选 -->
        <ContactsSubmenu v-if="['contacts', 'contacts-b'].includes(uiStore.activePrimaryNav)" />

        <!-- 其他模块使用 slot -->
        <WorkspaceTeamList
          v-if="isCollaborationNavKey(uiStore.activePrimaryNav)"
          :nav-key="uiStore.activePrimaryNav"
        />
        <!-- 个人页不恢复旧的助手/历史会话；只展示任务桥新生成的个人任务聊天。 -->
        <div v-show="uiStore.activePrimaryNav === 'solo-team'" class="personal-task-list">
          <p class="personal-task-list-title">历史对话</p>
          <TransitionGroup v-if="personalTaskChats.length" name="personal-task" tag="div" class="personal-task-entries">
            <button
              v-for="item in personalTaskChats"
              :key="`${item.projectId}:${item.task.id}`"
              type="button"
              class="personal-task-entry"
              :class="{ active: uiStore.activeSecondaryNav === personalTaskKey(item) }"
              @click="openPersonalTaskChat(item)"
            >
              <span class="personal-task-entry-icon">✓</span>
              <span class="personal-task-entry-copy">
                <b>{{ item.task.title }}</b>
                <small>{{ item.projectName }} · {{ item.task.status === 'done' ? '已完成' : '执行中' }}</small>
              </span>
            </button>
          </TransitionGroup>
          <div v-else class="personal-history-empty" role="status">
            <img :src="personalHistoryEmpty" alt="" />
            <p><strong>没有历史对话</strong><span>新建任务可选择关联项目</span></p>
          </div>
        </div>
        <DeerflowThreadList v-if="uiStore.activePrimaryNav === 'deerflow'" />


      </section>
    </Transition>

    <button
      v-if="uiStore.navRailVisible && hasSecondaryNav(uiStore.activePrimaryNav)"
      type="button"
      class="secondary-toggle"
      :class="{ 'is-collapsed': !uiStore.sidebarExpanded }"
      :aria-label="uiStore.sidebarExpanded ? '收起列表' : '展开列表'"
      @click="uiStore.sidebarExpanded ? uiStore.collapseSidebar() : uiStore.expandSidebar()"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    </button>
  </aside>

  <Teleport to="body">
    <div v-show="taskMountFlight.visible" ref="taskMountFlightRef" class="task-mount-flight" aria-hidden="true">
      <img :src="taskFolderIcon" alt="" />
    </div>
    <div
      v-if="taskMountReceipt.visible"
      class="task-mount-receipt"
      :style="{ left: `${taskMountReceipt.left}px`, top: `${taskMountReceipt.top}px` }"
      role="status"
      aria-live="polite"
    >已同步～</div>
  </Teleport>

  <Teleport to="body">
    <CreateProjectBaseModal
      :visible="showCreateTeamDialog"
      @update:visible="showCreateTeamDialog = $event"
      @created="handleProjectBaseCreated"
    />
    <CreateSoloTeamDialog
      :visible="showCreateSoloTeamDialog"
      @close="showCreateSoloTeamDialog = false"
      @created="handleSoloTeamCreated"
    />
    <PersonalTaskCreateModal
      :visible="showPersonalTaskCreateModal"
      @close="showPersonalTaskCreateModal = false"
      @created="handlePersonalTaskCreated"
    />
    <CreateDigitalEmployeeDialog
      :visible="showCreateDigitalEmployeeDialog"
      @close="showCreateDigitalEmployeeDialog = false"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ROOM_TYPES } from '@/shared/im-client'
import addIcon from '@/assets/navigation/add.svg'
import taskFolderIcon from '@/assets/navigation/task-folder.svg'
// 一级导航「浮夸版」3D 插画图标（沿用生产：<img> + navIconMap，非线稿组件）
import personalIcon from '@/assets/home/nav-personal-crab.png' // 个人 = 六腿蟹角色图标
import terminalIcon from '@/assets/home/terminal.png' // Kode = CLI 终端
import contactsIcon from '@/assets/home/one-team.png' // 通讯录 = 原「一人团队」小姐姐
import teamIcon from '@/assets/home/nav-collaboration-original.png' // 协作 = 原始生成的双角色图标
import marketIcon from '@/assets/home/marketLeft.png' // 市场
import communityIcon from '@/assets/home/community.png' // 社区
import CreateProjectBaseModal from '@/modules/group/components/CreateProjectBaseModal.vue'
import MarketSubmenu from '@/modules/space/components/MarketSubmenu.vue'
import ContactsSubmenu from '@/modules/contacts/components/ContactsSubmenu.vue'
import CreateSoloTeamDialog from '@/modules/solo-team/components/CreateSoloTeamDialog.vue'
import PersonalTaskCreateModal from '@/modules/task-bridge/components/PersonalTaskCreateModal.vue'
import { createOnePersonTeam } from '@/modules/solo-team/service'
import CreateDigitalEmployeeDialog from '@/modules/solo-team/components/CreateDigitalEmployeeDialog.vue'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import { usePrivateStore } from '@/modules/private/store'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import {
  PRIMARY_NAV_ITEMS,
  getDefaultSecondaryKey,
  getSecondaryNavItems,
  hasSecondaryNav,
  isCollaborationNavKey,
} from '@/modules/navigation/config'
import { shouldShowCollaborationSecondaryPanel } from '@/modules/space/utils/collaborationLayout.js'
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage.mjs'
import WorkspaceTeamList from '@/modules/space/components/WorkspaceTeamList.vue'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import DeerflowThreadList from '@/modules/deerflow-chat/components/DeerflowThreadList.vue'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'
import { IS_DEMO } from '@/shared/utils/buildMode'
import digitalEmployeeIcon from '@/assets/soloTeam/add_agent.png'
import soloTeamCreateIcon from '@/assets/soloTeam/add_team.png'
import personalHistoryEmpty from '@/assets/personal-history-empty.png'


const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const uiStore = useUIStore()
const groupStore = useGroupStore()
const soloTeamStore = useSoloTeamStore()
const privateStore = usePrivateStore()
const digitalHumanStore = useDigitalHumanStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()
const unreadStore = useUnreadStore()
const deerflowStore = useDeerflowChatStore()
const notificationStore = useNotificationStore()
const taskBridgeStore = useTaskBridgeStore()
const cliUnreadCount = computed(() => notificationStore.unreadCount)
const personalTaskChats = computed(() => taskBridgeStore.personalTasks)

const showCreateTeamDialog = ref(false)
const showCreateSoloTeamDialog = ref(false)
const showPersonalTaskCreateModal = ref(false)
const creatingSoloTeamSession = ref(false)
// 合并后团队固定，「新建会话」直接建一条会话，协调者=分身(默认 agent 9001)
const SOLO_TEAM_COORDINATOR_ID = 9001
const showCreateDigitalEmployeeDialog = ref(false)
const sidebarRef = ref(null)
const sidebarWidth = ref(80)
const taskMountFlightRef = ref(null)
const taskMountFlight = ref({ visible: false })
const collaborationPulse = ref(false)
const personalPulse = ref(false)
const taskMountReceipt = ref({ visible: false, left: 0, top: 0 })
let taskMountAnimation = null
let collaborationPulseTimer = null
let personalPulseTimer = null
let taskMountReceiptTimer = null

function playTaskMountFlight(direction = 'to-personal') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const collaboration = document.querySelector(
    '.primary-nav-item[data-nav-key="collaboration"]',
  ) || document.querySelector(
    '.primary-nav-item[data-nav-key="collaboration-b"]',
  )
  const personal = document.querySelector('.primary-nav-item[data-nav-key="solo-team"]')
  const source = direction === 'to-collaboration' ? personal : collaboration
  const target = direction === 'to-collaboration' ? collaboration : personal
  if (!source || !target) return

  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  // 使用按钮几何中心作为固定锚点，不受图标选中态/悬停态缩放影响。
  const startX = sourceRect.right - 30
  const startY = sourceRect.top + (sourceRect.height - 32) / 2
  const endX = targetRect.left + (targetRect.width - 32) / 2
  const endY = targetRect.top + (targetRect.height - 32) / 2
  const sourcePulse = direction === 'to-collaboration' ? personalPulse : collaborationPulse
  const sourcePulseTimer = direction === 'to-collaboration' ? personalPulseTimer : collaborationPulseTimer
  sourcePulse.value = true
  window.clearTimeout(sourcePulseTimer)
  const nextPulseTimer = window.setTimeout(() => {
    sourcePulse.value = false
  }, 560)
  if (direction === 'to-collaboration') personalPulseTimer = nextPulseTimer
  else collaborationPulseTimer = nextPulseTimer
  taskMountFlight.value = { visible: true }

  requestAnimationFrame(() => {
    const element = taskMountFlightRef.value
    if (!element) return
    taskMountAnimation?.cancel()
    const keyframes = Array.from({ length: 15 }, (_, index) => {
      const progress = index / 14
      const arc = Math.sin(progress * Math.PI) * -126
      const emergence = progress < 0.2
        ? Math.sin((progress / 0.2) * Math.PI) * 16
        : 0
      const x = startX + emergence + (endX - startX) * progress
      const y = startY + (endY - startY) * progress + arc
      const scale = progress < 0.2 ? 0.38 + progress * 3.2 : 1.04 - progress * 0.08
      const rotate = -12 + progress * 28
      return {
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
        opacity: progress < 0.12 ? progress / 0.12 : 1,
      }
    })
    taskMountAnimation = element.animate(keyframes, {
      duration: 1320,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'forwards',
    })
    taskMountAnimation.onfinish = () => {
      taskMountFlight.value = { visible: false }
      if (direction === 'to-collaboration') {
        collaborationPulse.value = true
        window.clearTimeout(collaborationPulseTimer)
        collaborationPulseTimer = window.setTimeout(() => {
          collaborationPulse.value = false
        }, 560)
      }
      taskMountReceipt.value = {
        visible: true,
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.top + 4,
      }
      window.clearTimeout(taskMountReceiptTimer)
      taskMountReceiptTimer = window.setTimeout(() => {
        taskMountReceipt.value = { visible: false, left: 0, top: 0 }
      }, 1100)
      taskMountAnimation = null
    }
  })
}

function handleTaskMountedToPersonal() {
  playTaskMountFlight('to-personal')
}

function handlePersonalTaskMountedToCollaboration() {
  playTaskMountFlight('to-collaboration')
}

// 监听 sidebar 宽度变化，实时更新按钮位置
onMounted(async () => {
  window.addEventListener('task-mounted-to-personal', handleTaskMountedToPersonal)
  window.addEventListener('personal-task-mounted-to-collaboration', handlePersonalTaskMountedToCollaboration)
  onUnmounted(() => {
    window.removeEventListener('task-mounted-to-personal', handleTaskMountedToPersonal)
    window.removeEventListener('personal-task-mounted-to-collaboration', handlePersonalTaskMountedToCollaboration)
    taskMountAnimation?.cancel()
    window.clearTimeout(collaborationPulseTimer)
    window.clearTimeout(personalPulseTimer)
    window.clearTimeout(taskMountReceiptTimer)
  })

  if (sidebarRef.value) {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sidebarWidth.value = entry.contentRect.width
        document.documentElement.style.setProperty('--sidebar-width', `${entry.contentRect.width}px`)
      }
    })
    resizeObserver.observe(sidebarRef.value)

    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }

  // 合并后默认落「个人」(solo-team)：首屏不走点击回调，需主动跑一次初始化把团队群聊拉起来
  if (uiStore.activePrimaryNav === 'solo-team') {
    await onPrimaryNavClick({ key: 'solo-team' })
  }
})

// key → 3D 插画图标（合并后：个人=螃蟹、通讯录=原一人团队小姐姐；其余沿用生产）
const navIconMap = Object.freeze({
  'solo-team': personalIcon,
  collaboration: teamIcon,
  'collaboration-b': teamIcon,
  cli: terminalIcon,
  contacts: contactsIcon,
  'contacts-b': contactsIcon,
  market: marketIcon,
  community: communityIcon,
  // 兼容旧 key
  avatar: personalIcon,
  deerflow: personalIcon,
})

const primaryNavItems = computed(() =>
  PRIMARY_NAV_ITEMS.map((item) => ({ ...item, icon: navIconMap[item.key] })),
)

const topNavItems = computed(() =>
  primaryNavItems.value.filter((item) => item.key !== 'community'),
)

const communityNavItem = computed(() =>
  primaryNavItems.value.find((item) => item.key === 'community'),
)

const activePrimaryItem = computed(() =>
  primaryNavItems.value.find((item) => item.key === uiStore.activePrimaryNav) ?? primaryNavItems.value[0],
)

const showSecondaryPanel = computed(() => {
  if (!uiStore.sidebarExpanded || !hasSecondaryNav(uiStore.activePrimaryNav)) {
    return false
  }

  // 个人页始终保留二级面板，用于承载唯一的「新建」入口。
  if (uiStore.activePrimaryNav === 'solo-team') {
    return true
  }

  // 协作：存在群聊或私聊时都保留二级面板
  if (isCollaborationNavKey(uiStore.activePrimaryNav)) {
    return shouldShowCollaborationSecondaryPanel(
      groupStore.conversations.length,
      privateStore.privateChats.length,
      digitalHumanStore.sortedAgents.length,
    )
  }

  // deerflow：只有存在对话时才显示二级面板，没有对话时显示引导页不展示二级菜单
  if (uiStore.activePrimaryNav === 'deerflow') {
    return deerflowStore.sortedThreads.length > 0
  }

  return true
})

watch(
  () => route.fullPath,
  () => {
    // 通讯录：路由变化时同步二级高亮（刷新 / 直接落地址栏也对）
    if (route.path.startsWith('/contacts/') || route.path.startsWith('/contacts-b/')) {
      const navKey = route.path.startsWith('/contacts-b/') ? 'contacts-b' : 'contacts'
      if (route.meta?.navKey) uiStore.setActiveNavigation(navKey, route.meta.navKey)
      uiStore.expandSidebar()
      return
    }
    if (!route.path.startsWith('/market')) return
    if (route.path.startsWith('/market/my-uploads')) {
      // 我的上传分组：按 type 高亮对应二级项（仍属 market 一级）
      const key = route.query.type === 'skill' ? 'my-uploads-skill' : 'my-uploads-avatar'
      uiStore.setActiveNavigation('market', key)
    } else if (route.meta?.navKey) {
      uiStore.setActiveNavigation('market', route.meta.navKey)
    }
    uiStore.expandSidebar()
  },
  { immediate: true },
)

function formatUnread(n) {
  return n > 99 ? '99+' : String(n)
}

function isPrimaryItemActive(key) {
  if (key === 'cli') return uiStore.claudeCodeActive
  return uiStore.activePrimaryNav === key
}

function resetSideEffects() {
  uiStore.closeNotificationPanel()
  uiStore.closeGroupRosterSidebar()
  uiStore.closeRightPanel()
}

function resetForDemoModule() {
  resetSideEffects()
}

async function onPrimaryNavClick(item) {
  if (item.key !== 'deerflow') {
    deerflowStore.isCreatingNewThread = false
  }

  if (item.key === 'cli') {
    onCliAvatarClick()
    return
  }

  uiStore.backgroundClaudeCode()

  if (isCollaborationNavKey(item.key)) {
    resetForDemoModule()
    const groupConversations = groupStore.groupConversations
    const privateChats = privateStore.sortedPrivateChats
    const digitalHumanAgents = digitalHumanStore.sortedAgents
    if (groupConversations.length > 0 || privateChats.length > 0 || digitalHumanAgents.length > 0) {
      uiStore.expandSidebar()

      // 优先恢复离开协作前最后选中的二级 key（不读 activeSecondaryNav，避免被其他一级污染）
      const lastSecondary = item.key === 'collaboration-b'
        ? uiStore.lastCollaborationBSecondaryNav
        : uiStore.lastCollaborationSecondaryNav
      let nextConversationId = null

      if (typeof lastSecondary === 'string' && lastSecondary.startsWith('private-')) {
        const conversationId = lastSecondary.slice('private-'.length)
        const stillExists = privateChats.some((chat) => String(chat.conversationId) === conversationId)
        if (stillExists) nextConversationId = lastSecondary
      } else if (typeof lastSecondary === 'string' && lastSecondary.startsWith('digital-human-')) {
        const agentId = lastSecondary.slice('digital-human-'.length)
        const stillExists = digitalHumanAgents.some(
          (a) => String(a.agent_id ?? a.agentId) === agentId,
        )
        if (stillExists) nextConversationId = lastSecondary
      } else if (groupConversations.some((conversation) => conversation.conversationId === lastSecondary)) {
        nextConversationId = lastSecondary
      }

      // 缓存命中失败：统一走默认兜底链 群组首项 → 私聊首项 → 数字人首项
      if (!nextConversationId) {
        nextConversationId = getDefaultSecondaryKey(
          item.key,
          groupConversations,
          [],
          privateChats,
          digitalHumanAgents,
        )
      }

      uiStore.setActiveNavigation(item.key, nextConversationId)

      // A/B 各自恢复二级会话时，同步底层会话指针，避免主区留在另一版上次选中的对象。
      if (String(nextConversationId).startsWith('private-')) {
        const conversationId = String(nextConversationId).slice('private-'.length)
        try {
          await privateStore.selectChat(Number(conversationId) || conversationId)
        } catch (error) {
          console.warn('[WorkspaceSidebar] restore collaboration private chat failed:', conversationId, error)
        }
      } else if (String(nextConversationId).startsWith('digital-human-')) {
        const agentId = String(nextConversationId).slice('digital-human-'.length)
        const agent = digitalHumanAgents.find(
          (item) => String(item.agent_id ?? item.agentId) === agentId,
        )
        if (agent) {
          try {
            await collaborationEmployeeChatStore.enterCollaborationDigitalHumanExistingSession(
              agent.agent_id ?? agent.agentId,
              agent,
            )
          } catch (error) {
            console.warn('[WorkspaceSidebar] restore collaboration digital human failed:', agentId, error)
          }
        }
      } else if (nextConversationId) {
        await onSpaceClick(nextConversationId)
      }
    } else {
      uiStore.collapseSidebar()
      uiStore.setActiveNavigation(item.key, null)
    }
    return
  }


  if (item.key === 'solo-team') {
    resetForDemoModule()
    const personalTask = personalTaskChats.value[0]
    if (personalTask) {
      uiStore.expandSidebar()
      openPersonalTaskChat(personalTask)
      return
    }
    if (IS_DEMO) {
      uiStore.expandSidebar()
      uiStore.setActiveNavigation('solo-team', null)
      return
    }
    await soloTeamStore.loadEmployeeItems({ force: true })

    // 形态1·合并后：「个人」主入口 = 团队群聊，优先落到唯一那支一人团队会话。
    await soloTeamStore.loadOnePersonTeamsFromApi()
    const apiTeams = soloTeamStore.onePersonTeams
    if (apiTeams.length > 0) {
      uiStore.expandSidebar()
      const currentTeamId = soloTeamStore.currentTeamId
      const nextTeam = apiTeams.find((team) => String(team.id) === String(currentTeamId)) || apiTeams[0]
      const nextTeamId = nextTeam?.id ?? nextTeam?.teamId
      soloTeamStore.activateOnePersonTeamRuntime(nextTeamId)
      uiStore.setActiveNavigation('solo-team', `team:${nextTeamId}`)
      return
    }

    // 过渡期回退：暂无团队时仍可落「我的员工」会话/引导页（员工单聊入口将在 P4 退役）
    async function tryRestoreSoloTeamEmployeeNav(navStr) {
      const parsed = typeof navStr === 'string' && /^employee:([^:]+):(.+)$/.exec(navStr.trim())
      if (!parsed) return false
      const [, eid, tid] = parsed
      const stillExists = soloTeamStore.employeeChatEmployees.some(
        (e) => String(e.id) === String(eid),
      )
      if (!eid || !tid || !stillExists) {
        try {
          const ls = localStorage.getItem('last_solo_team_employee_secondary_nav')
          if (ls && ls === navStr) localStorage.removeItem('last_solo_team_employee_secondary_nav')
        } catch { /* ignore */ }
        if (navStr === uiStore.lastSoloTeamEmployeeSecondaryNav) {
          uiStore.lastSoloTeamEmployeeSecondaryNav = null
        }
        return false
      }
      try {
        uiStore.expandSidebar()
        await soloTeamStore.selectEmployeeThread(eid, tid)
        uiStore.setActiveNavigation('solo-team', navStr)
        return true
      } catch (err) {
        console.warn('[WorkspaceSidebar] restore solo-team employee nav failed:', navStr, err)
        return false
      }
    }

    const lastEmployeeNav =
      uiStore.lastSoloTeamEmployeeSecondaryNav
      || (() => {
        try {
          const v = localStorage.getItem('last_solo_team_employee_secondary_nav')
          return typeof v === 'string' && v.startsWith('employee:') ? v : null
        } catch {
          return null
        }
      })()

    // 优先恢复离开前缓存的「我的员工」会话（仅对该员工请求 personal/threads）
    if (await tryRestoreSoloTeamEmployeeNav(lastEmployeeNav)) return
    // 其次：当前二级仍是 employee:（同一会话内极少见）
    if (await tryRestoreSoloTeamEmployeeNav(uiStore.activeSecondaryNav)) return
    // 再次：Pinia 仍保留的上次员工会话指针
    const curEid = soloTeamStore.currentEmployeeId
    const curTid = soloTeamStore.currentEmployeeThreadId
    if (curEid && curTid) {
      const rebuilt = `employee:${curEid}:${curTid}`
      if (await tryRestoreSoloTeamEmployeeNav(rebuilt)) return
    }

    // 无历史可恢复：仅对列表首位员工拉会话（不重复 GET agents/my）
    const picked = await soloTeamStore.selectFirstEmployeeFromLoadedListOnly()
    if (picked) {
      uiStore.expandSidebar()
      uiStore.setActiveNavigation(
        'solo-team',
        `employee:${picked.employeeId}:${picked.threadId}`,
      )
      return
    }

    uiStore.collapseSidebar()
    uiStore.setActiveNavigation('solo-team', null)
    return
  }

  resetForDemoModule()
  if (item.key === 'deerflow') {
    deerflowStore.isCreatingNewThread = false
    await deerflowStore.fetchThreads()
    const threads = deerflowStore.sortedThreads
    if (threads.length > 0) {
      uiStore.expandSidebar()
      // 优先恢复 deerflow 上次已选对话（store.currentThreadId），没有则不选中显示引导页
      const lastId = deerflowStore.currentThreadId && threads.some((t) => t.id === deerflowStore.currentThreadId)
        ? deerflowStore.currentThreadId
        : null
      if (lastId) {
        uiStore.setActiveNavigation('deerflow', lastId)
        deerflowStore.setCurrentThread(lastId)
        const targetPath = `/deerflow-chats/${lastId}`
        if (!route.path.startsWith('/deerflow-chats')) {
          await router.push(targetPath)
        } else if (String(route.params.threadId) !== String(lastId)) {
          // 已在分身路由但 URL 会话与选中不一致时，须 replace 才能触发 ChatPanel 的 history 监听
          await router.replace(targetPath)
        } else {
          await deerflowStore.loadFirstPage(lastId, { force: true })
        }
      } else {
        // 没有上次已选对话：显示引导页
        uiStore.setActiveNavigation('deerflow', null)
        deerflowStore.setCurrentThread(null)
        if (!route.path.startsWith('/deerflow-chats')) {
          await router.push('/deerflow-chats')
        } else if (route.params.threadId) {
          await router.replace('/deerflow-chats')
        }
      }
    } else {
      uiStore.collapseSidebar()
      uiStore.setActiveNavigation('deerflow', null)
      if (!route.path.startsWith('/deerflow-chats')) {
        await router.push('/deerflow-chats')
      }
    }
    return
  }

  if (item.key === 'community') {
    resetForDemoModule()
    uiStore.collapseSidebar()
    await router.push('/community')
    uiStore.setActiveNavigation('community', null)
    return
  }

  uiStore.expandSidebar()
  const fallbackKey = getDefaultSecondaryKey(item.key, groupStore.groupConversations, [], privateStore.sortedPrivateChats)
  let secondaryKey =
    uiStore.activePrimaryNav === item.key && uiStore.activeSecondaryNav
      ? uiStore.activeSecondaryNav
      : fallbackKey

  if (item.key === 'market') {
    const targetItem = getSecondaryNavItems('market').find((navItem) => navItem.key === secondaryKey)
    const targetRoute = targetItem?.route || '/market/skill'

    // 先跳转路由，再设置导航状态，确保组件能正确渲染
    if (route.path !== targetRoute) {
      await router.push(targetRoute)
    }
    uiStore.setActiveNavigation(item.key, secondaryKey)
  } else if (item.key === 'contacts' || item.key === 'contacts-b') {
    const targetItem = getSecondaryNavItems(item.key).find((navItem) => navItem.key === secondaryKey)
    let targetRoute = targetItem?.route || '/contacts/employees'
    if (item.key === 'contacts-b') {
      // B 版首屏 = 我的助理（员工在二级栏平铺，组织目录只是其中一段）
      const sec = uiStore.activePrimaryNav === 'contacts-b' ? uiStore.activeSecondaryNav : null
      if (typeof sec === 'string' && sec.startsWith('contacts-b-employee:')) {
        targetRoute = `/contacts-b/employee/${sec.slice('contacts-b-employee:'.length)}`
      } else if (sec === 'contacts-b-org') {
        targetRoute = '/contacts-b/org'
      } else {
        targetRoute = '/contacts-b/employee/assistant'
        secondaryKey = 'contacts-b-employee:assistant'
      }
    }
    if (route.path !== targetRoute) {
      await router.push(targetRoute)
    }
    uiStore.setActiveNavigation(item.key, secondaryKey)
  } else {
    uiStore.setActiveNavigation(item.key, secondaryKey)
  }

  uiStore.setActiveNavigation(item.key, secondaryKey)
}

function personalTaskKey(item) {
  return `task-bridge:${item.projectId}:${item.task.id}`
}

function openPersonalTaskChat(item) {
  uiStore.setActiveNavigation('solo-team', personalTaskKey(item))
}

function onAddTeamClick() {
  uiStore.backgroundClaudeCode()
  uiStore.expandSidebar()

  if (uiStore.activePrimaryNav === 'solo-team') {
    const existingDemoProject = Object.values(taskBridgeStore.projects).find(
      (project) => !project.isPersonalOnly && String(project.name).trim() === '项目一',
    )
    if (!existingDemoProject) taskBridgeStore.ensureProject('task-bridge-demo', '项目一')
    showPersonalTaskCreateModal.value = true
    return
  }

  if (uiStore.activePrimaryNav === 'deerflow') {
    handleCreateDeerflowThread()
    return
  }

  const collaborationNavKey = isCollaborationNavKey(uiStore.activePrimaryNav)
    ? uiStore.activePrimaryNav
    : 'collaboration'
  uiStore.setActiveNavigation(collaborationNavKey, uiStore.activeSecondaryNav)
  showCreateTeamDialog.value = true
}

function handlePersonalTaskCreated(result = {}) {
  showPersonalTaskCreateModal.value = false
  const project = result.project
  const projectId = project?.id
  const taskId = result.task?.id
  if (!projectId || !taskId) return
  if (!project.isPersonalOnly) {
    window.dispatchEvent(new CustomEvent('personal-task-mounted-to-collaboration', {
      detail: { taskId, projectId },
    }))
  }
  uiStore.expandSidebar()
  uiStore.setActiveNavigation('solo-team', `task-bridge:${projectId}:${taskId}`)
}

function handleTaskBridgeProjectCreated({ conversationId } = {}) {
  const conversation = groupStore.conversations.find(
    (item) => String(item.conversationId) === String(conversationId),
  )
  taskBridgeStore.createProject(conversationId, conversation?.name || '项目一')
  uiStore.setActiveNavigation('collaboration', conversationId)
}

function handleProjectBaseCreated(payload = {}) {
  const name = String(payload.name || '新建项目').trim() || '新建项目'
  const conversationId = `demo-project-${Date.now()}`
  const conversation = {
    conversationId,
    name,
    createRoomType: ROOM_TYPES.GROUP_CHAT,
    memberCount: Array.isArray(payload.members) ? payload.members.length : 0,
    lastTimelineTs: Date.now(),
    isDemoProject: true,
    raw: { conversation_id: conversationId, conv_name: name, isDemoProject: true },
  }

  // 复用现有群聊列表的数据结构，让新项目和已有项目聊天走同一套渲染与选中逻辑。
  groupStore._onConversationsUpdated({ action: 'upsert', conversation })
  taskBridgeStore.createProject(conversationId, name, {
    isDemoProject: true,
    goal: payload.goal,
  })
  groupStore.setCurrentSpaceId(conversationId)
  groupStore.currentConversationId = conversationId
  uiStore.setActiveNavigation('collaboration', conversationId)
  uiStore.expandSidebar()
  showCreateTeamDialog.value = false
}

function handleCreateDigitalEmployeeClick() {
  uiStore.backgroundClaudeCode()
  uiStore.expandSidebar()
  showCreateDigitalEmployeeDialog.value = true
}

// 参考「我的分身」新建体验：点「+」直接甩出一条新会话进入，不弹窗。
// 团队固定 → 成员=全体员工，会话名自动生成，建完立即激活进入。
async function handleCreateSoloTeamMenuClick() {
  uiStore.backgroundClaudeCode()
  uiStore.expandSidebar()
  if (creatingSoloTeamSession.value) return
  creatingSoloTeamSession.value = true
  try {
    // 新会话默认 solo（我 ⇄ 分身），花名册留空 —— 靠「拉人组队」/分身推荐一个个攒起来
    const name = nextSoloTeamSessionName()
    const result = await createOnePersonTeam({
      name,
      description: '',
      coordinatorId: SOLO_TEAM_COORDINATOR_ID,
      memberIds: [],
    })
    const teamId = result?.teamId ?? result?.id
    await handleSoloTeamCreated({
      teamId,
      team: { ...(result || {}), id: teamId, teamId, name, description: '' },
    })
  } catch (error) {
    console.error('[WorkspaceSidebar] 新建会话失败:', error)
    ElMessage.error(apiErrorMessage(error, '新建会话失败，请重试'))
  } finally {
    creatingSoloTeamSession.value = false
  }
}

function nextSoloTeamSessionName() {
  const base = '新会话'
  const names = new Set(
    (soloTeamStore.onePersonTeams || []).map((t) => String(t?.name || '').trim()),
  )
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} ${i}`)) i += 1
  return `${base} ${i}`
}

async function handleCreateDeerflowThread() {
  console.log('[WorkspaceSidebar] handleCreateDeerflowThread: setting isCreatingNewThread = true')
  deerflowStore.isCreatingNewThread = true
  uiStore.setActiveNavigation('deerflow', null)
  await router.push('/deerflow-chats')
}

async function handleSoloTeamCreated(payload = {}) {
  showCreateSoloTeamDialog.value = false
  const { teamId, team, personalThreadId, mainThread } = payload
  const targetTeamId = teamId || team?.teamId || team?.id
  if (targetTeamId) {
    const createdTeamId = soloTeamStore.activateCreatedOnePersonTeam({
      ...(team || {}),
      id: targetTeamId,
      teamId: targetTeamId,
    })
    const nextTeamId = createdTeamId || targetTeamId
    uiStore.setActiveNavigation('solo-team', `team:${nextTeamId}`)
    uiStore.expandSidebar()
    return
  }
  await soloTeamStore.loadOnePersonTeamsFromApi()
  const createdTeamName = String(team?.name || payload.name || '').trim()
  const createdTeam = createdTeamName
    ? soloTeamStore.onePersonTeams.find((item) => String(item?.name || '').trim() === createdTeamName)
    : null
  const createdTeamIdFromList = createdTeam?.id ?? createdTeam?.teamId
  if (createdTeamIdFromList) {
    soloTeamStore.activateOnePersonTeamRuntime(createdTeamIdFromList)
    uiStore.setActiveNavigation('solo-team', `team:${createdTeamIdFromList}`)
    uiStore.expandSidebar()
    return
  }
  if (personalThreadId != null && mainThread?.langgraph_thread_id && payload.teamId != null) {
    await soloTeamStore.selectOnePersonTeamMainSession(payload.teamId, mainThread, {
      teamName: payload.team?.name ?? mainThread?.title,
      coordinatorAgentId: payload.team?.coordinatorId ?? payload.team?.coordinator_id,
    })
    uiStore.setActiveNavigation('solo-team', `one-person-team:${String(payload.teamId)}:${mainThread.id}`)
    uiStore.expandSidebar()
    return
  }
  uiStore.expandSidebar()
}

async function onSpaceClick(spaceId) {
  groupStore.cancelCreatingTeam()
  groupStore.setCurrentSpaceId(spaceId)
  await groupStore.selectConversation(spaceId)
}

function onCliAvatarClick() {
  uiStore.toggleClaudeCode()
}
</script>

<style scoped>
.workspace-sidebar {
  width: 80px;
  min-width: 80px;
  display: flex;
  align-items: stretch;
  padding-top: 0px;
  position: relative;
  z-index: 1001;
  transition: width 0.24s ease;
}

/* 任务确认后的跨模块反馈：图标沿弧线从协作飞向个人。 */
.task-mount-flight {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 3000;
  width: 32px;
  height: 32px;
  pointer-events: none;
  will-change: transform, opacity;
}

.task-mount-flight img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 5px 7px rgba(24, 49, 83, 0.22));
}

.task-mount-receipt {
  position: fixed;
  z-index: 3001;
  transform: translate(-50%, -100%);
  padding: 5px 9px;
  border-radius: 999px;
  background: #fff7f0;
  color: #f26b3a;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 7px 16px rgba(242, 107, 58, 0.2);
  animation: task-mount-receipt-in .28s cubic-bezier(.22, 1, .36, 1) both;
}

@keyframes task-mount-receipt-in {
  from { opacity: 0; transform: translate(-50%, -72%) scale(.72); }
  to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
}

/* 二级菜单收起/展开切换钮：贴右边缘、垂直居中，两种宽度下都在交界处 */
.secondary-toggle {
  position: absolute;
  top: 50%;
  right: -11px;
  transform: translateY(-50%);
  z-index: 1100;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #e8ebf0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6d7384;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.secondary-toggle:hover {
  color: #2f3547;
  border-color: rgba(47, 53, 71, 0.24);
  box-shadow: 0 2px 8px rgba(47, 53, 71, 0.15);
}

.secondary-toggle.is-collapsed svg {
  transform: rotate(180deg);
}

.workspace-sidebar--collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  overflow: visible;
}

.workspace-sidebar--expanded {
  width: 330px;
  min-width: 330px;
}


.nav-rail {
  width: 80px;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  /* padding: 16px 0 16px; */
  position: relative;
  opacity: 1;
  transition: opacity 0.24s ease;
}

.nav-rail--hidden {
  opacity: 0;
  pointer-events: none;
}

.nav-rail::after {
  content: '';
  position: absolute;
  top: 8px;
  right: 0;
  bottom: 8px;
  width: 1px;
  /* border-right: 1px dashed rgba(47, 53, 71, 0.18); */
}

.nav-rail-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 100%;
}

.nav-rail-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 12px;
}

.primary-nav-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: color .18s ease;
}

.primary-nav-icon-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  padding: 2px;
  background: transparent;
  transition: all 0.2s ease;
}

.primary-nav-icon-inner {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition: background 0.2s, box-shadow 0.2s;
}

.primary-nav-item:hover .primary-nav-icon-inner,
.primary-nav-item.active .primary-nav-icon-inner {
  background: transparent;
  box-shadow: none;
}

.primary-nav-item:hover .primary-nav-icon-shell,
.primary-nav-item.active .primary-nav-icon-shell {
  background: transparent;
}

.primary-nav-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ED4543;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
}

/* 「浮夸版」3D 插画图标：常态 40，hover/选中放大到 50（沿用生产动效） */
.primary-nav-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  transition: width 0.2s, height 0.2s, filter 0.2s ease, transform 0.2s ease;
}

.primary-nav-item:hover .primary-nav-icon,
.primary-nav-item.active .primary-nav-icon {
  width: 50px;
  height: 50px;
}

/* 个人入口使用更醒目的螃蟹头像，其他导航图标保持原尺寸。 */
.primary-nav-item--personal .primary-nav-icon-shell {
  width: 68px;
  height: 68px;
}

.primary-nav-item--personal .primary-nav-icon {
  width: 68px;
  height: 68px;
}

.primary-nav-item--personal:hover .primary-nav-icon,
.primary-nav-item--personal.active .primary-nav-icon {
  width: 82px;
  height: 82px;
}

/* 选中仅以轻投影与一次灵动抖动提示，避免底板和描边干扰图标本身。 */
.primary-nav-item.active .primary-nav-icon {
  /* drop-shadow 按 PNG 的透明像素边缘投影，不再形成圆角矩形底板。 */
  filter: drop-shadow(0 5px 7px rgba(31, 37, 51, 0.24));
  animation: primary-nav-icon-wiggle .46s cubic-bezier(.22, 1, .36, 1) both;
}

/* 放在通用选中态之后，确保两类主入口使用各自的阴影色相。 */
.primary-nav-item--collaboration.active .primary-nav-icon {
  filter: drop-shadow(0 5px 7px rgba(75, 128, 206, 0.22));
}

.primary-nav-item--personal.active .primary-nav-icon {
  filter: drop-shadow(0 5px 7px rgba(214, 91, 72, 0.22));
}

@keyframes primary-nav-icon-wiggle {
  0% { transform: translateY(2px) rotate(0deg) scale(.94); }
  35% { transform: translateY(-2px) rotate(-5deg) scale(1.03); }
  62% { transform: translateY(0) rotate(4deg) scale(1.01); }
  82% { transform: translateY(-1px) rotate(-2deg) scale(1); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}

.primary-nav-item.is-mounting .primary-nav-icon {
  animation: collaboration-nav-nudge .56s cubic-bezier(.22, 1, .36, 1) both;
}

@keyframes collaboration-nav-nudge {
  0% { transform: rotate(0deg) scale(1); }
  22% { transform: rotate(-7deg) scale(1.04); }
  44% { transform: rotate(6deg) scale(1.02); }
  66% { transform: rotate(-4deg) scale(1.01); }
  84% { transform: rotate(2deg) scale(1); }
  100% { transform: rotate(0deg) scale(1); }
}

.primary-nav-item:active .primary-nav-icon-inner,
.personal-task-entry:active {
  transform: scale(.96);
}
.primary-nav-icon-inner,
.personal-task-entry {
  transition: transform .18s ease, background .2s ease, box-shadow .2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .primary-nav-item,
  .primary-nav-icon-inner,
  .primary-nav-icon,
  .personal-task-entry,
  .personal-task-enter-active,
  .personal-task-leave-active,
  .personal-task-move,
  .personal-task-appear-active { transition: none; }
  .personal-task-enter-active .personal-task-entry-icon,
  .personal-task-appear-active .personal-task-entry-icon { animation: none; }
}

.primary-nav-label {
  font-size: 13px;
  line-height: 1.3;
  color: #2f3547;
  text-align: center;
}

.submenu-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: 250px;
  padding: 0 7px;
  padding-top: 5px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(47, 53, 71, 0.06);
}

.submenu-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin: 0 5px 8px;
  position: relative;
}

.submenu-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2f3547;
}

.submenu-description {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(47, 53, 71, 0.56);
}

.submenu-add-btn {
  flex-shrink: 0;
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 12px;
  background: rgba(47, 53, 71, 0.06);
  color: #2f3547;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.personal-task-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 18px;
}

.personal-task-list-title {
  margin: 0 0 8px 6px;
  color: #969daa;
  font-size: 12px;
}

.personal-history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px 30px;
  color: #9aa1ad;
  text-align: center;
}

.personal-history-empty img {
  width: 132px;
  height: 132px;
  object-fit: contain;
}

.personal-history-empty p {
  max-width: 170px;
  margin: 0;
  line-height: 1.55;
}

.personal-history-empty p strong,
.personal-history-empty p span {
  display: block;
}

.personal-history-empty p strong {
  color: #697383;
  font-size: 12px;
  font-weight: 600;
}

.personal-history-empty p span {
  margin-top: 3px;
  color: #a2a9b4;
  font-size: 10px;
  font-weight: 400;
}

.personal-task-entries { display: flex; flex-direction: column; gap: 2px; }
.personal-task-enter-active,
.personal-task-leave-active,
.personal-task-move,
.personal-task-appear-active { transition: opacity .42s ease, transform .42s cubic-bezier(.16, 1, .3, 1), filter .42s ease, box-shadow .42s ease; }
.personal-task-enter-from,
.personal-task-appear-from { opacity: 0; transform: translateY(22px) scale(.92) rotateX(-5deg); filter: blur(4px); box-shadow: 0 14px 28px rgba(255,98,31,.18); }
.personal-task-enter-active .personal-task-entry-icon,
.personal-task-appear-active .personal-task-entry-icon { animation: personal-task-icon-pop .52s cubic-bezier(.16, 1, .3, 1) both; }
.personal-task-leave-to { opacity: 0; transform: translateY(-6px) scale(.98); }
.personal-task-leave-active { position: absolute; width: calc(100% - 28px); }
@keyframes personal-task-icon-pop { 0% { transform: scale(.55) rotate(-18deg); box-shadow: 0 0 0 0 rgba(255,98,31,.34); } 58% { transform: scale(1.16) rotate(4deg); box-shadow: 0 0 0 7px rgba(255,98,31,0); } 100% { transform: scale(1) rotate(0); box-shadow: none; } }

.personal-task-entry {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #303746;
  text-align: left;
  cursor: pointer;
}

.personal-task-entry:hover,
.personal-task-entry.active {
  background: #fff;
  box-shadow: 0 4px 14px rgba(63, 73, 93, .07);
}

.personal-task-entry-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #fff0e8;
  color: #ff621f;
  font-size: 13px;
  font-weight: 700;
}

.personal-task-entry-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.personal-task-entry-copy b {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.personal-task-entry-copy small {
  overflow: hidden;
  color: #959daa;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu-add-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.submenu-add-btn:hover {
  background: rgba(47, 53, 71, 0.1);
}

.solo-team-create-trigger {
  position: relative;
  width: 100%;
}

.solo-team-create-menu {
  position: absolute;
  top: 36px;
  left: 50%;
  z-index: 20;
  width: 224px;
  height: 132px;
  box-sizing: border-box;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.12);
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(-4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
}

.solo-team-create-trigger::after {
  content: '';
  position: absolute;
  top: 32px;
  left: 0;
  width: 100%;
  height: 8px;
}

.solo-team-create-trigger:hover .solo-team-create-menu,
.solo-team-create-trigger:focus-within .solo-team-create-menu {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.solo-team-create-item {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.16s ease;
}

.solo-team-create-item:hover {
  background: rgba(47, 53, 71, 0.06);
}

.solo-team-create-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.solo-team-create-icon img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.solo-team-create-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.solo-team-create-title {
  font-size: 13px;
  line-height: 18px;
  color: #2f3547;
}

.solo-team-create-desc {
  font-size: 11px;
  line-height: 16px;
  color: rgba(47, 53, 71, 0.48);
  white-space: nowrap;
}

.submenu-empty {
  margin-top: 8px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px dashed rgba(47, 53, 71, 0.14);
}

.submenu-empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.submenu-empty-text {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(47, 53, 71, 0.64);
}

.submenu-empty-btn {
  margin-top: 16px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: rgba(67, 111, 246, 0.1);
  color: #436ff6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.submenu-slide-enter-active,
.submenu-slide-leave-active {
  transition: all 0.22s ease;
}

.submenu-slide-enter-from,
.submenu-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* 收起/展开按钮 */
.nav-rail-toggle-btn {
  position: fixed;
  top: 55px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(47, 53, 71, 0.14);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1100;
  padding: 0;
  transition: left 0.24s ease, border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 4px rgba(47, 53, 71, 0.1);
  left: 70px;
}

.nav-rail-toggle-btn--collapsed {
  left: 8px;
}

.nav-rail-toggle-btn:hover {
  border-color: rgba(47, 53, 71, 0.24);
  box-shadow: 0 2px 8px rgba(47, 53, 71, 0.15);
}

.nav-toggle-icon {
  width: 12px;
  height: 12px;
  transition: transform 0.24s ease;
}

.nav-toggle-icon--flipped {
  transform: scaleX(-1);
}
</style>
