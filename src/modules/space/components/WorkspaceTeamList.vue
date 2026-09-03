<template>
  <div class="submenu-list">
    <div
      v-if="isActiveCollaborationNav && taskBridgeProjects.length"
      class="submenu-category"
      :class="{ 'is-expanded': expandedCategories.project }"
    >
      <div class="submenu-category-header" @click="toggleCategory('project')">
        <span class="category-label">项目</span>
        <el-icon class="category-arrow" :class="{ 'is-expanded': expandedCategories.project }"><CaretRight /></el-icon>
      </div>
      <div class="submenu-category-content">
        <TransitionGroup name="project-card" tag="div" class="submenu-project-list" appear>
          <div v-for="project in taskBridgeProjects" :key="project.id" class="submenu-project-block">
            <button
              type="button"
              class="submenu-item submenu-item--project"
              :class="{ active: String(uiStore.activeSecondaryNav) === String(project.id) }"
              @click="onTaskBridgeProjectClick(project)"
            >
              <span class="submenu-project-icon">▣</span>
              <span class="submenu-conversation-copy">
                <span class="submenu-item-label">{{ project.name }}</span>
                <span class="submenu-item-preview">{{ taskBridgeProjectPreview(project) }}</span>
              </span>
            </button>
            <button
              type="button"
              class="submenu-project-delete"
              :aria-label="`删除项目 ${project.name}`"
              title="删除项目"
              @click.stop="removeTaskBridgeProject(project)"
            >×</button>
            <TransitionGroup v-if="taskBridgeProjectTasks(project).length" name="project-task" tag="div" class="submenu-project-tasks" appear>
              <button
                v-for="task in taskBridgeProjectTasks(project)"
                :key="`${project.id}-${task.id}`"
                type="button"
                class="submenu-project-task"
                @click="onTaskBridgeTaskClick(project, task)"
              >
                <span class="submenu-project-task-copy">
                  <span class="submenu-project-task-title">{{ task.title }}</span>
                  <span class="submenu-project-task-meta">{{ task.owner === '我' ? '我的任务' : task.owner }}</span>
                </span>
              </button>
            </TransitionGroup>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- 任务桥改版：不展示团队群聊会话列表。 -->
    <div v-if="isActiveCollaborationNav && !taskBridgeProjects.length" class="collaboration-history-empty" role="status">
      <img :src="collaborationHistoryEmpty" alt="" />
      <p><strong>没有历史对话</strong><span>新建项目后即可开始协作</span></p>
    </div>

    <div
      v-if="false"
      class="submenu-category"
      :class="{ 'is-expanded': expandedCategories.group }"
    >
      <div class="submenu-category-header" @click="toggleCategory('group')">
        <span class="category-label">团队群聊</span>
        <el-icon class="category-arrow" :class="{ 'is-expanded': expandedCategories.group }">
          <CaretRight />
        </el-icon>
      </div>
      <div class="submenu-category-content">
        <template v-if="groupStore.groupConversations.length > 0">
          <div
            v-for="conversation in groupStore.groupConversations"
            :key="conversation.conversationId"
            class="submenu-item submenu-item--conversation submenu-item--group"
            :class="{ active: uiStore.activeSecondaryNav === conversation.conversationId }"
            @click="onGroupConversationClick(conversation)"
          >
            <span class="submenu-avatar-anchor submenu-avatar-anchor--group">
              <span class="submenu-group-avatar-stack">
                <span
                  v-for="(avatar, index) in getGroupAvatarItems(conversation)"
                  :key="`${conversation.conversationId}-avatar-${index}`"
                  class="submenu-group-avatar"
                  :style="avatar.src ? null : { background: avatar.color }"
                >
                  <img v-if="avatar.src" :src="avatar.src" alt="" />
                  <span v-else>{{ avatar.text }}</span>
                </span>
              </span>
              <span
                v-if="showMentionBadge(conversation.conversationId)"
                class="submenu-badge submenu-badge--mention submenu-avatar-badge"
              >@</span>
              <span
                v-else-if="showUnreadBadge(conversation.conversationId)"
                class="submenu-badge submenu-badge--count submenu-avatar-badge"
              >{{ formatUnread(unreadStore.getConversationUnreadCount(conversation.conversationId)) }}</span>
            </span>
            <span class="submenu-conversation-copy">
              <span class="submenu-conversation-title-row">
                <span class="submenu-item-label">{{ conversation.name || conversation.conversationId }}</span>
              </span>
              <span class="submenu-item-preview">{{ getGroupPreview(conversation) }}</span>
            </span>
          </div>
        </template>
        <div v-else class="submenu-empty-state">暂无群聊</div>
      </div>
    </div>

    <!-- 任务桥改版：不展示私聊会话列表。 -->
    <div
      v-if="false"
      class="submenu-category"
      :class="{ 'is-expanded': expandedCategories.private }"
    >
      <div class="submenu-category-header" @click="toggleCategory('private')">
        <span class="category-label">私聊</span>
        <el-icon class="category-arrow" :class="{ 'is-expanded': expandedCategories.private }">
          <CaretRight />
        </el-icon>
      </div>
      <div class="submenu-category-content">
        <template v-if="privateStore.privateChats.length > 0">
          <div
            v-for="chat in privateStore.privateChats"
            :key="chat.conversationId"
            class="submenu-item submenu-item--conversation submenu-item--private"
            :class="{ active: uiStore.activeSecondaryNav === `private-${chat.conversationId}` }"
            @click="onPrivateChatClick(chat)"
          >
            <span class="submenu-avatar-anchor">
              <img :src="getPrivateAvatar(chat)" alt="" class="submenu-conversation-avatar" />
              <span
                v-if="showPrivateMentionBadge(chat.conversationId)"
                class="submenu-badge submenu-badge--mention submenu-avatar-badge"
              >@</span>
              <span
                v-else-if="showPrivateUnreadBadge(chat.conversationId)"
                class="submenu-badge submenu-badge--count submenu-avatar-badge"
              >{{ formatUnread(unreadStore.getConversationUnreadCount(chat.conversationId)) }}</span>
            </span>
            <span class="submenu-conversation-copy">
              <span class="submenu-conversation-title-row">
                <span class="submenu-item-label">{{ chat.peerDisplayName || chat.peerUsername }}</span>
              </span>
              <span class="submenu-item-preview">{{ getPrivatePreview(chat) }}</span>
            </span>
            <button
              class="submenu-close-btn"
              type="button"
              title="更多"
              @click.stop="openPrivateChatMenu($event, chat)"
            >
              ···
            </button>
          </div>
        </template>
        <div v-else class="submenu-empty-state">暂无私聊</div>
      </div>
    </div>

    <!-- 任务桥改版：协作侧栏只展示项目，不再展示企业数字人列表。 -->
    <div
      v-if="false"
      class="submenu-category"
      :class="{ 'is-expanded': expandedCategories.digitalHuman }"
    >
      <div class="submenu-category-header" @click="toggleCategory('digitalHuman')">
        <span class="category-label">企业数字人</span>
        <el-icon class="category-arrow" :class="{ 'is-expanded': expandedCategories.digitalHuman }">
          <CaretRight />
        </el-icon>
      </div>
      <div class="submenu-category-content">
        <template v-if="digitalHumanStore.agents.length > 0">
          <div
            v-for="agent in digitalHumanStore.sortedAgents"
            :key="agent.agent_id"
            class="submenu-item submenu-item--conversation submenu-item--digital-human"
            :class="{ active: uiStore.activeSecondaryNav === `digital-human-${agent.agent_id}` }"
            @click="onDigitalHumanClick(agent)"
          >
            <span class="submenu-avatar-anchor">
              <img :src="getDigitalHumanAvatar(agent)" alt="" class="submenu-conversation-avatar" />
              <span
                v-if="getDigitalHumanUnreadCount(agent) > 0"
                class="submenu-badge submenu-badge--count submenu-avatar-badge"
              >{{ formatUnread(getDigitalHumanUnreadCount(agent)) }}</span>
            </span>
            <span class="submenu-conversation-copy">
              <span class="submenu-conversation-title-row">
                <span class="submenu-item-label">{{ agent.agent_display_name || agent.agent_name }}</span>
              </span>
              <span class="submenu-item-preview">{{ getDigitalHumanPreview(agent) }}</span>
            </span>
            <el-icon
              v-if="String(collaborationEmployeeChatStore.collaborationDigitalHumanOpeningAgentId) === String(agent.agent_id)"
              class="is-loading submenu-loading-icon submenu-digital-human-trailing"
            >
              <Loading />
            </el-icon>
            <button
              type="button"
              class="submenu-digital-human-more submenu-digital-human-trailing"
              :class="{ 'is-menu-open': isDigitalHumanMenuOpenFor(agent) }"
              title="更多"
              @click.stop="openDigitalHumanMenu($event, agent)"
            >
              ···
            </button>
          </div>
        </template>
        <div v-else class="submenu-empty-state">
          <span v-if="digitalHumanStore.loadingAgents">加载中…</span>
          <span v-else>暂无数字人</span>
        </div>
      </div>
    </div>

    <!-- 其他导航（市场、一人团队等，保持原有逻辑） -->
    <template v-if="!isActiveCollaborationNav">
      <template v-for="item in secondaryNavItems" :key="item.key">
        <div v-if="item.type === 'group-header'" class="submenu-group-header">
          <img v-if="iconMap[item.icon]" :src="iconMap[item.icon]" :alt="item.label" class="submenu-group-icon-img" />
          <span v-else-if="item.icon" class="submenu-group-icon">{{ item.icon }}</span>
          <span class="submenu-group-label">{{ item.label }}</span>
        </div>
        <div
          v-else-if="['solo-team-room', 'deerflow-thread'].includes(item.type)"
          class="submenu-item"
          :class="{ active: uiStore.activeSecondaryNav === item.key }"
          @click="onSecondaryNavClick(item)"
        >
          <span class="submenu-item-label">{{ item.label }}</span>
        </div>
        <div
          v-else-if="item.route"
          class="submenu-item"
          :class="{ active: uiStore.activeSecondaryNav === item.key }"
          @click="onSecondaryNavClick(item)"
        >
          <span class="submenu-item-label">{{ item.label }}</span>
        </div>
      </template>
    </template>

    <Teleport to="body">
      <div
        v-if="privateChatMenu.visible"
        class="employee-context-menu"
        :style="{ top: `${privateChatMenu.y}px`, left: `${privateChatMenu.x}px` }"
        @click.stop
      >
        <button
          type="button"
          class="employee-context-item employee-context-item--danger"
          @click="handlePrivateChatMenuRemove"
        >移除会话</button>
      </div>
      <div v-if="privateChatMenu.visible" class="employee-context-mask" @click="closePrivateChatMenu"></div>

      <div
        v-if="digitalHumanMenu.visible"
        class="employee-context-menu"
        :style="{ top: `${digitalHumanMenu.y}px`, left: `${digitalHumanMenu.x}px` }"
        @click.stop
      >
        <button
          type="button"
          class="employee-context-item"
          @click="handleDigitalHumanMenuAction(isPinnedDigitalHuman(digitalHumanMenu.agent) ? 'unpin' : 'pin')"
        >{{ isPinnedDigitalHuman(digitalHumanMenu.agent) ? '取消置顶' : '置顶' }}</button>
        <button type="button" class="employee-context-item employee-context-item--danger" @click="handleDigitalHumanMenuAction('remove')">移除</button>
      </div>
      <div v-if="digitalHumanMenu.visible" class="employee-context-mask" @click="closeDigitalHumanMenu"></div>

      <div
        v-if="removeDigitalHumanDialog.visible"
        class="delete-dialog-mask"
        @click.self="cancelRemoveDigitalHumanDialog"
      >
        <div class="delete-dialog delete-dialog--remove-digital-human">
          <div class="delete-dialog-header">
            <div class="delete-dialog-header-main">
              <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
              <span class="delete-dialog-title">确认移除数字人「{{ removeDigitalHumanDialogLabel }}」吗？</span>
            </div>
            <button type="button" class="delete-dialog-close" @click="cancelRemoveDigitalHumanDialog">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p class="delete-dialog-desc">移除后，数字人在列表消失。</p>
          <div class="delete-dialog-footer">
            <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelRemoveDigitalHumanDialog">
              取消
            </button>
            <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmRemoveDigitalHumanDialog">
              确认
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CaretRight, Loading } from '@element-plus/icons-vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { usePrivateStore } from '@/modules/private/store'
import { useUnreadStore } from '@/modules/shared/store/unreadStore'
import { getSecondaryNavItems, isCollaborationNavKey } from '@/modules/navigation/config'
import { isCollaborationSecondaryNavAvailable } from '@/modules/space/utils/collaborationLayout.js'
import { soloTeamApiErrorMessage } from '@/modules/solo-team/utils/apiErrorMessage'
import marketIcon from '@/assets/home/market.png'
import myIcon from '@/assets/home/my.png'
import defaultAgentAvatar from '@/assets/soloTeam/default_agent.svg'
import defaultAvatar from '@/assets/default-avatar.svg'
import collaborationHistoryEmpty from '@/assets/collaboration-history-empty.png'
import { useTaskBridgeStore } from '@/modules/task-bridge/store'

const props = defineProps({
  navKey: {
    type: String,
    default: 'collaboration',
    validator: isCollaborationNavKey,
  },
})

const router = useRouter()
const uiStore = useUIStore()
const groupStore = useGroupStore()
const deerflowStore = useDeerflowChatStore()
const digitalHumanStore = useDigitalHumanStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()
const privateStore = usePrivateStore()
const unreadStore = useUnreadStore()
const taskBridgeStore = useTaskBridgeStore()
const isActiveCollaborationNav = computed(() => uiStore.activePrimaryNav === props.navKey)

const privateChatMenu = ref({ visible: false, x: 0, y: 0, chat: null })
const digitalHumanMenu = ref({ visible: false, x: 0, y: 0, agent: null })
const removeDigitalHumanDialog = reactive({ visible: false, agent: null })
const removeDigitalHumanDialogLabel = computed(() => {
  const a = removeDigitalHumanDialog.agent
  const n = a?.agent_display_name || a?.agent_name
  const s = n != null ? String(n).trim() : ''
  return s || '该数字人'
})

const iconMap = {
  market: marketIcon,
  my: myIcon,
}

// 折叠状态（持久化到 localStorage）
const STORAGE_KEY = 'workspace-expanded-categories'
const expandedCategories = ref({
  project: true,
  group: true,        // 群聊默认展开
  private: true,      // 私聊默认展开
  digitalHuman: true, // 数字人默认展开
})

const taskBridgeProjects = computed(() => Object.values(taskBridgeStore.projects).filter((project) => (
  !taskBridgeStore.deletedProjectIds[String(project.id)]
  && !project.isPersonalOnly
  && !String(project.id).startsWith('personal-task-')
)))

const AVATAR_COLORS = ['#7569e8', '#f39a62', '#5da7a4', '#d8799d', '#5d8bc9']

function cleanPreview(value, fallback = '暂无新消息') {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

function getGroupPreview(conversation) {
  const direct = conversation?.latestMessagePreview
    || conversation?.lastMessagePreview
    || conversation?.raw?.latest_message_preview
    || conversation?.raw?.last_message_preview
  if (direct) return cleanPreview(direct)

  const messages = groupStore.conversationMessages?.[conversation?.conversationId]?.messages || []
  const latest = messages.length ? messages[messages.length - 1] : null
  const body = latest?.content?.body ?? latest?.body ?? latest?.text
  if (!body) return '暂无新消息'
  const sender = String(latest?.senderDisplayName || latest?.senderName || '').trim()
  return cleanPreview(sender ? `${sender}：${body}` : body)
}

function getPrivatePreview(chat) {
  return cleanPreview(
    chat?.lastMessagePreview
      || chat?.latestMessagePreview
      || chat?.raw?.last_message_preview,
  )
}

function getDigitalHumanPreview(agent) {
  return cleanPreview(
    agent?.last_message_preview
      || agent?.lastMessagePreview
      || agent?.latest_message_preview
      || agent?.agent_description
      || agent?.description,
    '点击继续对话',
  )
}

function getPrivateAvatar(chat) {
  return chat?.peerAvatarUrl || chat?.avatarUrl || chat?.avatar || defaultAvatar
}

function getDigitalHumanAvatar(agent) {
  return agent?.agent_avatar_url || agent?.avatarUrl || agent?.avatar || defaultAgentAvatar
}

function getDigitalHumanUnreadCount(agent) {
  const conversationId = agent?.conversation_id ?? agent?.conversationId
  const storeCount = conversationId == null
    ? 0
    : unreadStore.getConversationUnreadCount(conversationId)
  return Math.max(
    Number(storeCount) || 0,
    Number(agent?.unread_count ?? agent?.unreadCount ?? agent?.conv_count ?? 0) || 0,
  )
}

function memberAvatarSrc(member) {
  if (typeof member === 'string') return member
  return member?.avatarHttpUrl
    || member?.avatarUrl
    || member?.avatar_url
    || member?.avatar
    || ''
}

function memberLabel(member) {
  if (typeof member === 'string') return ''
  return String(
    member?.displayName
      || member?.name
      || member?.account
      || member?.userId
      || '',
  ).trim()
}

function getGroupAvatarItems(conversation) {
  const conversationId = conversation?.conversationId
  const memberSources = [
    groupStore.conversationMembers?.[conversationId],
    conversation?.memberAvatars,
    conversation?.raw?.member_avatars,
    conversation?.raw?.members,
  ]
  const members = memberSources.find((items) => Array.isArray(items) && items.length) || []
  const actual = members.slice(0, 3).map((member, index) => ({
    src: memberAvatarSrc(member),
    text: Array.from(memberLabel(member))[0] || '人',
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
  }))
  if (actual.length) return actual

  const titleChars = Array.from(String(conversation?.name || '群聊').replace(/\s/g, ''))
  const fallbackChars = [titleChars[0] || '群', titleChars[1] || '聊', titleChars.at(-1) || '组']
  return fallbackChars.slice(0, 3).map((text, index) => ({
    src: '',
    text,
    color: AVATAR_COLORS[(String(conversationId || '').length + index) % AVATAR_COLORS.length],
  }))
}

// 从 localStorage 加载折叠状态
onBeforeUnmount(() => {
  closePrivateChatMenu()
  closeDigitalHumanMenu()
  cancelRemoveDigitalHumanDialog()
})

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      expandedCategories.value = { ...expandedCategories.value, ...parsed }
    }
  } catch (error) {
    console.error('[WorkspaceTeamList] 加载折叠状态失败:', error)
  }

  // 协作面板下首次进入时拉取数字人会话列表
  if (isActiveCollaborationNav.value) {
    void digitalHumanStore.fetchAgents()
    const activeConversation = groupStore.conversations.find(
      (item) => String(item.conversationId) === String(groupStore.currentSpaceId),
    )
    if (activeConversation?.conversationId) {
      taskBridgeStore.ensureProject(activeConversation.conversationId, activeConversation.name)
    }
  }
})

watch(
  () => groupStore.currentSpaceId,
  (conversationId) => {
    if (!conversationId || !isActiveCollaborationNav.value) return
    const conversation = groupStore.conversations.find(
      (item) => String(item.conversationId) === String(conversationId),
    )
    taskBridgeStore.ensureProject(conversationId, conversation?.name || '项目一')
  },
  { immediate: true },
)

function toggleCategory(categoryId) {
  expandedCategories.value[categoryId] = !expandedCategories.value[categoryId]
  // 持久化到 localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedCategories.value))
  } catch (error) {
    console.error('[WorkspaceTeamList] 保存折叠状态失败:', error)
  }
}

async function onTaskBridgeProjectClick(project) {
  const conversationId = String(project?.id || '')
  if (!conversationId) return
  taskBridgeStore.requestDashboardClose()
  // 点击项目时退出当前任务对话；点击子任务会在选中项目后重新进入对应任务。
  taskBridgeStore.closeTaskConversation(conversationId)
  uiStore.setActiveNavigation(props.navKey, conversationId)
  // 项目聊天同时由项目 store 和群聊 store 的当前空间驱动，切换时必须同步更新二者。
  groupStore.setCurrentSpaceId(conversationId)
  if (project?.isDemoProject) {
    groupStore.currentConversationId = conversationId
    return
  }
  await groupStore.selectConversation(conversationId, { forceRead: true })
}

async function removeTaskBridgeProject(project) {
  const conversationId = String(project?.id || '')
  if (!conversationId) return

  try {
    await ElMessageBox.confirm(
      `删除「${project.name}」后，该项目下的任务、讨论和回填记录将从当前 Demo 中移除。`,
      '删除项目',
      { confirmButtonText: '删除项目', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  const nextProject = taskBridgeProjects.value.find((item) => String(item.id) !== conversationId) || null
  const isActive = String(uiStore.activeSecondaryNav) === conversationId || String(groupStore.currentSpaceId) === conversationId

  // 先切走当前项目，避免 currentSpaceId 的监听逻辑重新创建刚删除的项目。
  if (isActive) {
    uiStore.setActiveNavigation(props.navKey, nextProject ? String(nextProject.id) : null)
    groupStore.setCurrentSpaceId(nextProject ? String(nextProject.id) : null)
    groupStore.currentConversationId = nextProject ? String(nextProject.id) : null
  }

  taskBridgeStore.removeProject(conversationId)
  groupStore.markProjectDeleted(conversationId)
  // 会话列表会在后台刷新；通过群会话的正式移除入口写入 _leftConversationIds，
  // 后续加载会自动过滤该项目，避免仅 splice 一次后又被 Mock 数据回填。
  groupStore._onConversationLeft({
    conversationId,
    conversationName: project.name,
    cardType: 'dissolved',
  })

  if (nextProject && isActive) await onTaskBridgeProjectClick(nextProject)
  ElMessage.success(`已删除项目「${project.name}」`)
}

function taskBridgeProjectTasks(project) {
  return (project?.tasks || []).filter((task) => task.confirmed)
}

async function onTaskBridgeTaskClick(project, task) {
  await onTaskBridgeProjectClick(project)
  taskBridgeStore.openTaskConversation(project.id, task.id)
}

function taskBridgeProjectPreview(project) {
  if (project.phase === 'draft') return '待确认分工'
  if (project.phase === 'planned') return `${project.tasks.length} 项任务执行中`
  if (project.phase === 'backfill') return '回填草稿待确认'
  if (project.phase === 'published') return project.echoPublished ? '任务已回填' : '回填已发布'
  return '暂无新消息'
}

const secondaryNavItems = computed(() =>
  getSecondaryNavItems(
    uiStore.activePrimaryNav,
    groupStore.groupConversations,
    deerflowStore.sortedThreads,
    privateStore.privateChats,
    digitalHumanStore.sortedAgents,
  ),
)

function isConversationReadActive(conversationId) {
  return !!conversationId
    && String(conversationId) === String(groupStore.currentConversationId)
    && isActiveCollaborationNav.value
}

function isPrivateChatReadActive(conversationId) {
  return !!conversationId
    && String(conversationId) === String(privateStore.currentChatId)
    && isActiveCollaborationNav.value
}

function showMentionBadge(conversationId) {
  if (isConversationReadActive(conversationId)) return false
  return unreadStore.hasConversationMention(conversationId)
}

function showUnreadBadge(conversationId) {
  if (isConversationReadActive(conversationId)) return false
  return unreadStore.getConversationUnreadCount(conversationId) > 0
}

function showPrivateMentionBadge(conversationId) {
  if (isPrivateChatReadActive(conversationId)) return false
  return unreadStore.hasConversationMention(conversationId)
}

function showPrivateUnreadBadge(conversationId) {
  if (isPrivateChatReadActive(conversationId)) return false
  return unreadStore.getConversationUnreadCount(conversationId) > 0
}

function formatUnread(count) {
  const n = Number(count) || 0
  return n > 99 ? '99+' : String(n)
}

watch(
  () => [
    groupStore.groupConversations.map((conversation) => conversation.conversationId),
    privateStore.privateChats.map((chat) => chat.conversationId),
    digitalHumanStore.sortedAgents.map((agent) => agent.agent_id ?? agent.agentId),
  ],
  ([conversationIds, _privateConversationIds, digitalHumanAgentIds]) => {
    const privateChats = privateStore.privateChats
    const digitalHumanAgents = digitalHumanStore.sortedAgents
    if (!isActiveCollaborationNav.value) return
    if (conversationIds.length === 0 && privateChats.length === 0 && digitalHumanAgentIds.length === 0) {
      if (uiStore.activeSecondaryNav !== null) {
        uiStore.setActiveNavigation(props.navKey, null)
      }
      return
    }
    if (!isCollaborationSecondaryNavAvailable(
      uiStore.activeSecondaryNav,
      conversationIds,
      privateChats,
      digitalHumanAgents,
    )) {
      const nextConversationId = conversationIds.includes(groupStore.currentSpaceId)
        ? groupStore.currentSpaceId
        : (
          conversationIds[0]
          ?? (privateChats[0]?.conversationId ? `private-${privateChats[0].conversationId}` : null)
          ?? (digitalHumanAgentIds[0] != null ? `digital-human-${digitalHumanAgentIds[0]}` : null)
        )
      if (!nextConversationId) return
      uiStore.setActiveNavigation(props.navKey, nextConversationId)
      if (String(nextConversationId).startsWith('private-')) {
        void privateStore.selectChat(privateChats[0].conversationId)
      } else if (String(nextConversationId).startsWith('digital-human-')) {
        const agentId = String(nextConversationId).slice('digital-human-'.length)
        const agent = digitalHumanAgents.find(
          (item) => String(item.agent_id ?? item.agentId) === agentId,
        )
        if (agent) void onDigitalHumanClick(agent)
      } else {
        void onSpaceClick(nextConversationId)
      }
    }
  },
  { immediate: true },
)

// 进入协作面板时拉取数字人列表
watch(
  () => uiStore.activePrimaryNav,
  (primaryNav) => {
    if (primaryNav === props.navKey) {
      void digitalHumanStore.fetchAgents()
    }
  },
)

async function onSecondaryNavClick(item) {
  if (isActiveCollaborationNav.value) {
    uiStore.setActiveNavigation(props.navKey, item.key)
    await onSpaceClick(item.conversationId)
    return
  }

  if (uiStore.activePrimaryNav === 'market' && item.route) {
    uiStore.setActiveNavigation('market', item.key)
    await router.push(item.route)
    return
  }

  uiStore.setActiveNavigation(uiStore.activePrimaryNav, item.key)
}

// 群聊项点击
async function onGroupConversationClick(conversation) {
  uiStore.setActiveNavigation(props.navKey, conversation.conversationId)
  await onSpaceClick(conversation.conversationId)
}

// 私聊项点击
async function onPrivateChatClick(chat) {
  try {
    uiStore.setActiveNavigation(props.navKey, `private-${chat.conversationId}`)
    await privateStore.selectChat(chat.conversationId)
  } catch (error) {
    console.error('[WorkspaceTeamList] 选择私聊失败:', error)
    // 回退导航状态（选择第一个可用项或 null）
    const fallbackKey = groupStore.groupConversations[0]?.conversationId || null
    uiStore.setActiveNavigation(props.navKey, fallbackKey)
    // 显示错误提示
    ElMessage.error('加载私聊失败，请重试')
  }
}

async function onPrivateChatClose(chat) {
  if (!chat?.conversationId) return
  try {
    await privateStore.closePrivateChat(chat.conversationId)
    ElMessage.success('已关闭私聊')
  } catch (error) {
    console.error('[WorkspaceTeamList] 关闭私聊失败:', error)
    ElMessage.error('关闭私聊失败，请重试')
  }
}

function openPrivateChatMenu(event, chat) {
  closeDigitalHumanMenu()
  const rect = event.currentTarget.getBoundingClientRect()
  privateChatMenu.value = {
    visible: true,
    x: rect.right - 92,
    y: rect.bottom + 6,
    chat,
  }
}

function closePrivateChatMenu() {
  privateChatMenu.value = { visible: false, x: 0, y: 0, chat: null }
}

function handlePrivateChatMenuRemove() {
  const chat = privateChatMenu.value.chat
  closePrivateChatMenu()
  if (chat) void onPrivateChatClose(chat)
}

// 数字人：进入最近 personal 会话；无历史时由 collaboration store 创建新会话（与一人团队「我的员工」一致）
async function onDigitalHumanClick(agent) {
  try {
    uiStore.setActiveNavigation(props.navKey, `digital-human-${agent.agent_id}`)
    await collaborationEmployeeChatStore.enterCollaborationDigitalHumanExistingSession(
      agent.agent_id,
      agent,
    )
  } catch (error) {
    console.error('[WorkspaceTeamList] 打开数字人失败:', error)
    // 回退导航状态
    const fallbackKey = groupStore.groupConversations[0]?.conversationId || null
    uiStore.setActiveNavigation(props.navKey, fallbackKey)
  }
}

function isPinnedDigitalHuman(agent) {
  return Boolean(agent?.pinned)
}

function isDigitalHumanMenuOpenFor(agent) {
  if (!digitalHumanMenu.value.visible || !agent) return false
  const id = agent.agent_id ?? agent.agentId
  const menuAgent = digitalHumanMenu.value.agent
  const menuId = menuAgent?.agent_id ?? menuAgent?.agentId
  return id != null && menuId != null && String(menuId) === String(id)
}

function openDigitalHumanMenu(e, agent) {
  closePrivateChatMenu()
  const rect = e.currentTarget.getBoundingClientRect()
  digitalHumanMenu.value = {
    visible: true,
    x: rect.right - 88,
    y: rect.bottom + 6,
    agent,
  }
}

function closeDigitalHumanMenu() {
  digitalHumanMenu.value = { visible: false, x: 0, y: 0, agent: null }
}

async function handleDigitalHumanMenuAction(action) {
  const agent = digitalHumanMenu.value.agent
  const agentId = agent?.agent_id ?? agent?.agentId
  closeDigitalHumanMenu()
  if (!agentId) return

  if (action === 'remove') {
    openRemoveDigitalHumanDialog(agent)
    return
  }

  if (action === 'pin') {
    if (isPinnedDigitalHuman(agent)) {
      ElMessage.info('当前已置顶')
      return
    }
    try {
      await collaborationEmployeeChatStore.pinEmployee(agentId)
      ElMessage.success('已置顶')
    } catch (error) {
      console.error('[WorkspaceTeamList] pin digital human failed:', error)
      ElMessage.error(soloTeamApiErrorMessage(error, '置顶失败，请稍后重试'))
    }
    return
  }

  if (action === 'unpin') {
    if (!isPinnedDigitalHuman(agent)) {
      ElMessage.info('当前未置顶')
      return
    }
    try {
      await collaborationEmployeeChatStore.unpinEmployee(agentId)
      ElMessage.success('已取消置顶')
    } catch (error) {
      console.error('[WorkspaceTeamList] unpin digital human failed:', error)
      ElMessage.error(soloTeamApiErrorMessage(error, '取消置顶失败，请稍后重试'))
    }
  }
}

function openRemoveDigitalHumanDialog(agent) {
  if (!agent?.agent_id && !agent?.agentId) return
  removeDigitalHumanDialog.agent = agent
  removeDigitalHumanDialog.visible = true
}

function cancelRemoveDigitalHumanDialog() {
  removeDigitalHumanDialog.visible = false
  removeDigitalHumanDialog.agent = null
}

async function confirmRemoveDigitalHumanDialog() {
  const agent = removeDigitalHumanDialog.agent
  const agentId = agent?.agent_id ?? agent?.agentId
  cancelRemoveDigitalHumanDialog()
  if (!agentId) return
  try {
    await collaborationEmployeeChatStore.removeEmployee(agentId)
    ElMessage.success('已从列表移除')
  } catch (error) {
    console.error('[WorkspaceTeamList] remove digital human failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '操作失败，请稍后重试'))
  }
}

async function onSpaceClick(spaceId) {
  taskBridgeStore.requestDashboardClose()
  groupStore.cancelCreatingTeam()
  groupStore.setCurrentSpaceId(spaceId)
  if (spaceId !== groupStore.currentConversationId) {
    await groupStore.selectConversation(spaceId)
  }
}
</script>

<style lang="scss" scoped>
.submenu-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0 2px 8px 5px;
  overflow-y: auto;
  overflow-x: hidden;
}

.submenu-list::-webkit-scrollbar {
  width: 4px;
}

.submenu-list::-webkit-scrollbar-track {
  background: transparent;
}

.submenu-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.submenu-list:hover::-webkit-scrollbar-thumb {
  background: rgba(47, 53, 71, 0.2);
}

/* 三个分组共享一条连续滚动流，避免每组各困在一口小鱼缸里。 */
.submenu-category {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.submenu-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 8px 14px;
  color: #91949E;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;

  &:hover {
    color: #2f3547;
  }
}

.category-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;

  &.is-expanded {
    transform: rotate(90deg);
  }
}

.category-label {
  font-family: PingFang SC;
  line-height: 20px;
}

/* 分组内容不再各自滚动，由整个二级菜单统一承载滚动。 */
.submenu-category-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;

  // 留出阴影缓冲区，避免选中项目卡片的外阴影被滚动容器裁切。
  padding: 12px 14px 16px;
  margin: -4px 0 0;

  .submenu-category:not(.is-expanded) & {
    display: none;
  }
}

.submenu-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 0px 14px;
  margin-top: 8px;
}

.submenu-group-header:first-child {
  margin-top: 0;
}

.submenu-group-icon {
  font-size: 18px;
  line-height: 1;
}

.submenu-group-icon-img {
  width: 14px;
  height: 14px;
  display: block;
}

.submenu-group-label {
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #91949E;
}

.submenu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.submenu-item:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.submenu-item.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.submenu-item--conversation {
  position: relative;
  height: 54px;
  min-height: 54px;
  justify-content: flex-start;
  gap: 10px;
  padding: 0 9px;
}

.submenu-item--conversation:hover,
.submenu-item--conversation.active {
  background: #f5f6f9;
}

.submenu-item--project {
  box-sizing: border-box;
  width: 100%;
  min-height: 54px;
  justify-content: flex-start;
  border: 0;
  background: #fff;
  font: inherit;
  text-align: left;
}

.submenu-item--project:hover,
.submenu-item--project.active {
  background: #fff;
}

.submenu-item--project.active {
  position: relative;
  z-index: 1;
  box-shadow: 0 9px 24px rgba(86, 104, 137, 0.12), 0 3px 8px rgba(86, 104, 137, 0.07);
}

.submenu-project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submenu-project-block {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submenu-item--project { padding-right: 42px; }

.submenu-project-delete {
  position: absolute;
  z-index: 3;
  top: 10px;
  right: 10px;
  display: grid;
  width: 24px;
  height: 24px;
  padding: 0;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #9aa1ad;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transform: scale(.92);
  transition: opacity .16s ease, transform .16s ease, color .16s ease, background .16s ease, border-color .16s ease;
}

.submenu-project-block:hover .submenu-project-delete,
.submenu-project-delete:focus-visible {
  opacity: 1;
  transform: scale(1);
}

.submenu-project-delete:hover {
  border-color: #efcbc4;
  background: #fff3f1;
  color: #bd5549;
}

@media (max-width: 640px) {
  .submenu-project-delete {
    opacity: 1;
    transform: scale(1);
  }
}

.project-card-enter-active,
.project-card-appear-active,
.project-card-leave-active,
.project-card-move { transition: opacity .46s ease, transform .46s cubic-bezier(.16, 1, .3, 1), filter .46s ease; }
.project-card-enter-from,
.project-card-appear-from { opacity: 0; transform: translateY(-18px) scale(.92); filter: blur(4px); }
.project-card-leave-to { opacity: 0; transform: translateY(-8px) scale(.97); }
.project-card-leave-active { position: absolute; width: calc(100% - 28px); }

.submenu-project-tasks {
  position: relative;
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  width: calc(100% - 12px);
  margin: 0 0 12px 12px;
  padding-left: 0;
  border-left: 0;
}

.submenu-project-tasks::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -8px;
  width: 1px;
  background: #e5e8ef;
  content: '';
}

.project-task-enter-active,
.project-task-appear-active,
.project-task-leave-active,
.project-task-move { transition: opacity .46s ease, transform .46s cubic-bezier(.16, 1, .3, 1); }
.project-task-enter-from,
.project-task-appear-from { opacity: 0; transform: translateY(-18px) scale(.9); }
.project-task-leave-to { opacity: 0; transform: translateX(12px) scale(.96); }
.project-task-leave-active { position: absolute; width: calc(100% - 20px); }

.submenu-project-task {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 54px;
  min-height: 54px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  color: #2f3547;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  transition: background 0.2s ease, transform 0.2s ease;
}

.submenu-project-task:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: none;
}

.submenu-project-task-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 0;
}

.submenu-project-task-title {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu-project-task-meta {
  color: #5d6474;
  font-size: 11px;
  line-height: 1.2;
}

@media (prefers-reduced-motion: reduce) {
  .project-card-enter-active,
  .project-card-appear-active,
  .project-card-leave-active,
  .project-card-move,
  .project-task-enter-active,
  .project-task-appear-active,
  .project-task-leave-active,
  .project-task-move { transition: none; }
}

.submenu-project-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #fff0e9;
  color: #ff621f;
  font-size: 16px;
}

.submenu-item-label {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.submenu-conversation-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.submenu-conversation-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.submenu-conversation-title-row .submenu-item-label {
  line-height: 22px;
}

.submenu-item-preview {
  overflow: hidden;
  color: #91949e;
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu-avatar-anchor {
  position: relative;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
}

.submenu-conversation-avatar {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #eef0f5;
  object-fit: cover;
}

.submenu-group-avatar-stack {
  position: relative;
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #eef0f5;
}

.submenu-group-avatar {
  position: absolute;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.submenu-group-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.submenu-group-avatar:nth-child(1) {
  top: 0;
  left: 8px;
  z-index: 3;
}

.submenu-group-avatar:nth-child(2) {
  bottom: 0;
  left: 0;
  z-index: 2;
}

.submenu-group-avatar:nth-child(3) {
  right: 0;
  bottom: 0;
  z-index: 1;
}

.submenu-avatar-badge {
  position: absolute;
  right: -5px;
  bottom: -2px;
  z-index: 4;
  border: 1.5px solid #fff;
  box-sizing: border-box;
}

.submenu-item--private {
  justify-content: flex-start;
}

.submenu-close-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: #909399;
  font-size: 15px;
  line-height: 1;
  background: transparent;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.submenu-item--private:hover .submenu-close-btn {
  opacity: 1;
  pointer-events: auto;
}

.submenu-close-btn:hover {
  color: #2f3547;
  background: rgba(47, 53, 71, 0.08);
}

.submenu-item--digital-human {
  justify-content: flex-start;
}

.submenu-item--digital-human .submenu-item-label {
  flex: 1;
  min-width: 0;
}

.submenu-digital-human-trailing {
  flex-shrink: 0;
  margin-left: auto;
}

.submenu-digital-human-more {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8d93a6;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}

/* 行悬浮时展示；选中态也仅在悬浮时展示 */
.submenu-item--digital-human:hover .submenu-digital-human-more,
.submenu-digital-human-more.is-menu-open {
  opacity: 1;
}

.submenu-digital-human-more.is-menu-open {
  background: rgba(47, 53, 71, 0.08);
}

.submenu-private-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
  background: #f0f2f5;
}

.submenu-loading-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #409EFF;
}

.submenu-badge {
  flex-shrink: 0;
}

.submenu-badge--mention {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ED4543;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.submenu-badge--unread {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ED4543;
}

.submenu-badge--count {
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
}

.collaboration-history-empty {
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

.collaboration-history-empty img {
  width: 132px;
  height: 132px;
  object-fit: contain;
}

.collaboration-history-empty p {
  max-width: 170px;
  margin: 0;
  line-height: 1.55;
}

.collaboration-history-empty p strong,
.collaboration-history-empty p span {
  display: block;
}

.collaboration-history-empty p strong {
  color: #697383;
  font-size: 12px;
  font-weight: 600;
}

.collaboration-history-empty p span {
  margin-top: 3px;
  color: #a2a9b4;
  font-size: 10px;
  font-weight: 400;
}

.submenu-empty-state {
  padding: 12px 14px;
  color: #91949E;
  font-size: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>

<style lang="scss">
/* 与 SoloTeamList 员工菜单一致（Teleport 到 body，需非 scoped） */
.employee-context-menu {
  position: fixed;
  z-index: 3000;
  width: 92px;
  padding: 8px 0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.16);
}

.employee-context-item {
  width: 100%;
  height: 30px;
  border: none;
  background: transparent;
  color: #2f3547;
  text-align: left;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
}

.employee-context-item:hover {
  background: #f5f6f9;
}

.employee-context-item--danger {
  color: #ff4d4f;
}

.employee-context-mask {
  position: fixed;
  inset: 0;
  z-index: 2999;
  background: transparent;
}
</style>

<style lang="scss" scoped>
@use '@/modules/solo-team/styles/cancel-button.scss' as cancel-btn;
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

/* 与 SoloTeamList 移除确认框一致 */
.delete-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog {
  position: relative;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.delete-dialog--remove-digital-human {
  box-sizing: border-box;
  width: 480px;
  height: 172px;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 16px;

  @include delete-confirm.delete-dialog-header-row;

  .delete-dialog-desc {
    flex: 1;
    margin: 0 0 0 28px;
    line-height: 1.5;
  }

  .delete-dialog-footer {
    flex-shrink: 0;
    margin-top: auto;
  }
}

.delete-dialog-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  word-break: break-word;
}

.delete-dialog-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 28px;
  line-height: 1.6;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-dialog-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  &:hover {
    opacity: 0.85;
  }
}

.delete-dialog-btn--cancel {
  @include cancel-btn.solo-team-cancel-button;
}

.delete-dialog-btn--confirm {
  background: #1f2937;
  color: #fff;
}
</style>
