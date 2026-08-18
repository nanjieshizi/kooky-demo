<template>
  <div class="submenu-list">
    <!-- 顶部：＋ 新建（下拉：新建会话 / 新建多人会话）+ 我的助理快捷新建 -->
    <div class="conv-new">
      <div class="conv-new__wrap">
        <button type="button" class="conv-new__btn" :class="{ 'is-open': showNewMenu }" @click="showNewMenu = !showNewMenu">
          <span>＋ 新建</span>
          <svg class="conv-new__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <template v-if="showNewMenu">
          <div class="conv-new__backdrop" @click="showNewMenu = false"></div>
          <div class="conv-new__menu">
            <button type="button" class="conv-new__opt" @click="onNewSingle">
              <span class="conv-new__opt-title">新建会话</span>
              <span class="conv-new__opt-sub">和数字员工进行一对一单聊</span>
            </button>
            <button type="button" class="conv-new__opt" @click="onNewGroup">
              <span class="conv-new__opt-title">新建多人会话</span>
              <span class="conv-new__opt-sub">拉多个数字员工组队协作</span>
            </button>
          </div>
        </template>
      </div>
      <button type="button" class="conv-assistant" @click="startSoloConversation">
        <span class="conv-assistant__deco" aria-hidden="true">
          <img v-for="(src, i) in decoAvatars" :key="i" :src="src" alt="" draggable="false" />
        </span>
        <span class="conv-assistant__av" aria-hidden="true">
          <img class="conv-assistant__av-bubble" :src="assistantBubble" alt="" draggable="false" />
          <img class="conv-assistant__av-crab" :src="assistantCrab" alt="" draggable="false" />
        </span>
        <span class="conv-assistant__text">
          <span class="conv-assistant__name">我的助理</span>
          <span class="conv-assistant__sub">创建新会话</span>
        </span>
      </button>
    </div>

    <!-- 会话列表 -->
    <section class="submenu-category is-expanded">
      <div class="submenu-category-content">
        <template v-for="item in visibleTeamItems" :key="getTeamKey(item)">
          <div
            class="submenu-item"
            :class="{
              active: isTeamActive(item),
              'submenu-item--disabled': !isTeamSelectable(item),
            }"
            @click="onSoloTeamClick(item)"
          >
            <span
              class="conv-av"
              :class="avClass(item)"
              :style="avKind(item) === 'group' ? { background: pastelFor(item) } : null"
            >
              <template v-if="avKind(item) !== 'group'">
                <span class="conv-av__chat" :style="{ background: pastelFor(item) }" aria-hidden="true">
                  <svg viewBox="0 0 32 32">
                    <path d="M9 8h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-8l-4 3.2V20H9a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="#fff" />
                    <circle cx="11.5" cy="14" r="1.5" fill="#b9c0cc" />
                    <circle cx="16" cy="14" r="1.5" fill="#b9c0cc" />
                    <circle cx="20.5" cy="14" r="1.5" fill="#b9c0cc" />
                  </svg>
                </span>
                <img class="conv-av__badge-img" :src="avKind(item) === 'single' ? singleAvatar(item) : crabIcon" alt="" draggable="false" />
              </template>
              <template v-else>
                <img
                  v-for="(a, i) in clusterAvatars(item)"
                  :key="i"
                  class="conv-av__stack"
                  :src="a"
                  alt=""
                  draggable="false"
                />
              </template>
            </span>
            <span class="conv-item-text">
              <span class="conv-item-title">{{ item.name }}</span>
              <span class="conv-item-preview">{{ itemPreview(item) }}</span>
            </span>
          </div>
        </template>

        <!-- 特殊会话（mock 常驻）：系统通知 / 定时任务 -->
        <div class="submenu-item submenu-item--sys">
          <span class="conv-sys-av" :style="{ background: '#FFDED0' }" aria-hidden="true">📢</span>
          <span class="conv-item-text">
            <span class="conv-item-title">系统通知</span>
            <span class="conv-item-preview">升级啦！</span>
          </span>
        </div>
        <div class="submenu-item submenu-item--sys">
          <span class="conv-sys-av" :style="{ background: '#FFF1CC' }" aria-hidden="true">⏰</span>
          <span class="conv-item-text">
            <span class="conv-item-title">定时任务</span>
            <span class="conv-item-preview">每日喝水提醒</span>
          </span>
        </div>
      </div>
    </section>

    <!-- 新建会话（1:1 单聊）/ 新建多人会话 弹窗 -->
    <NewSingleDialog v-if="showNewSingle" @close="showNewSingle = false" @pick="onPickSingle" />
    <NewGroupDialog v-if="showNewGroup" @close="showNewGroup = false" @confirm="onCreateGroup" />

    <Teleport to="body">
      <!-- 与 EmployeeChatSessionHeader「移除会话」确认弹框同结构、同样式 -->
      <div
        v-if="removeEmployeeDialog.visible"
        class="delete-dialog-mask"
        @click.self="cancelRemoveEmployeeDialog"
      >
        <div class="delete-dialog delete-dialog--remove-employee">
          <div class="delete-dialog-header">
            <div class="delete-dialog-header-main">
              <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
              <span class="delete-dialog-title">确认移除数字员工「{{ removeEmployeeDialogLabel }}」吗？</span>
            </div>
            <button type="button" class="delete-dialog-close" @click="cancelRemoveEmployeeDialog">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <p class="delete-dialog-desc">移除后，数字员工在列表消失。</p>
          <div class="delete-dialog-footer">
            <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelRemoveEmployeeDialog">
              取消
            </button>
            <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmRemoveEmployeeDialog">
              确认
            </button>
          </div>
        </div>
      </div>

      <!-- 重命名员工弹框 -->
      <div
        v-if="renameEmployeeDialog.visible"
        class="delete-dialog-mask"
        @click.self="cancelRenameEmployeeDialog"
      >
        <div class="delete-dialog delete-dialog--rename-employee">
          <div class="delete-dialog-header">
            <div class="delete-dialog-header-main">
              <span class="delete-dialog-title">重命名员工</span>
            </div>
            <button type="button" class="delete-dialog-close" @click="cancelRenameEmployeeDialog">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="rename-input-wrap">
            <input
              ref="renameInputRef"
              v-model="renameEmployeeDialog.inputValue"
              class="rename-input"
              type="text"
              placeholder="请输入新的员工名称"
              spellcheck="false"
              @keyup.enter="confirmRenameEmployeeDialog"
            />
          </div>
          <div class="delete-dialog-footer">
            <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelRenameEmployeeDialog">
              取消
            </button>
            <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmRenameEmployeeDialog">
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CaretRight } from '@element-plus/icons-vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useFileStore } from '@/modules/file/store'
import { soloTeamApiErrorMessage } from '@/modules/solo-team/utils/apiErrorMessage'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import soloTeamAgentIcon from '@/assets/soloTeam/agent.png'
import soloTeamTeamIcon from '@/assets/soloTeam/team.png'
import { isTeamUpgraded, inviteMembers } from '@/modules/solo-team/demo/onePersonDirector'
import { createOnePersonTeam } from '@/modules/solo-team/service'
import OnePersonInvitePanel from './one-person-team/OnePersonInvitePanel.vue'
import NewSingleDialog from './one-person-team/NewSingleDialog.vue'
import NewGroupDialog from './one-person-team/NewGroupDialog.vue'
import fallbackAvatar from '@/assets/default-agent-avatar.svg'
import crabIcon from '@/assets/crab-pixel.png'
// 「我的助理」icon = 气泡(容器173586) + 螃蟹(坐姿) 两张图合成
import assistantBubble from '@/assets/soloTeam/assistant-bubble.svg'
import assistantCrab from '@/assets/soloTeam/assistant-crab.png'
// 我的助理卡片右上角「淡淡的一撮头像」装饰底图（对齐设计稿：2×3 倾斜网格、40% 透明）
import deco1 from '@/assets/soloTeam/people_1.png'
import deco2 from '@/assets/soloTeam/people_2.png'
import deco3 from '@/assets/soloTeam/people_3.png'
import deco4 from '@/assets/soloTeam/people_4.png'
import deco5 from '@/assets/soloTeam/people_5.png'
import deco6 from '@/assets/soloTeam/people_6.png'
const decoAvatars = [deco1, deco2, deco3, deco4, deco5, deco6]

const SOLO_TEAM_COORDINATOR_ID = 9001

const router = useRouter()
const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()
const fileStore = useFileStore()
const soloTeamFeatureEnabled = true
const employeeExpanded = ref(true)
const teamExpanded = ref(true)
const openDropdownEmployeeId = ref(null)
const renameInputRef = ref(null)
const renameEmployeeDialog = reactive({ visible: false, employee: null, inputValue: '' })
const removeEmployeeDialog = reactive({ visible: false, employee: null })
const removeEmployeeDialogLabel = computed(() => {
  const n = removeEmployeeDialog.employee?.name
  const s = n != null ? String(n).trim() : ''
  return s || '该员工'
})
const teamItems = computed(() => soloTeamStore.onePersonTeams)
// 会话不发送内容就不创建（同 CC 逻辑）→ 列表里不显示空会话：
// 有最新消息预览 = 有内容才露出；刚开的空会话在发首条消息前不占列表位。
function hasConversationContent(item) {
  const preview = item?.latest_message_preview || item?.last_message_preview || item?.latestMessagePreview
  return !!(preview && String(preview).trim())
}
// 活跃时间戳（新会话发消息后 last_active_at 会刷新 → 排到最前）
function activeTs(item) {
  const t = item?.last_active_at || item?.lastActiveAt || item?.updated_at || item?.updatedAt || item?.created_at || item?.createdAt
  const n = t ? new Date(t).getTime() : 0
  return Number.isFinite(n) ? n : 0
}
const visibleTeamItems = computed(() =>
  teamItems.value.filter(hasConversationContent).slice().sort((a, b) => activeTs(b) - activeTs(a)),
)

// ── 顶部两入口：①我的分身 → 1:1 新会话 ②「+」→ 选员工开多人会话 ──
const assistantAvatar = crabIcon // 分身头像 = 螃蟹
const showCreateGroup = ref(false)
// 顶部「＋ 新建」下拉 + 两个新建弹窗
const showNewMenu = ref(false)
const showNewSingle = ref(false)
const showNewGroup = ref(false)

function onNewSingle() { showNewMenu.value = false; showNewSingle.value = true }
function onNewGroup() { showNewMenu.value = false; showNewGroup.value = true }
// 1:1 单聊：建一条会话，只拉这一个数字员工（会话名 = 员工名）
async function onPickSingle(emp) {
  try {
    const result = await createOnePersonTeam({ name: emp.name || nextConversationName(), description: '', coordinatorId: SOLO_TEAM_COORDINATOR_ID, memberIds: [] })
    const rawId = activateCreatedTeam(result)
    // soloChat：开场白由他本人说，点进来直接是跟他的聊天页（不出场景引导页）
    if (rawId) await inviteMembers(rawId, `thread-main-${rawId}`, [emp], { soloChat: true })
  } catch (error) {
    console.error('[SoloTeamList] 新建单聊失败:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '新建会话失败，请重试'))
  }
}
function openCreateGroup() {
  showCreateGroup.value = true
}

function nextConversationName() {
  const base = '新会话'
  const names = new Set(teamItems.value.map((t) => String(t?.name || '').trim()))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base} ${i}`)) i += 1
  return `${base} ${i}`
}

function activateCreatedTeam(result) {
  const rawId = result?.teamId ?? result?.id
  if (!rawId) return null
  const createdId = soloTeamStore.activateCreatedOnePersonTeam({ ...(result || {}), id: rawId, teamId: rawId })
  const nextId = createdId || rawId
  uiStore.setActiveNavigation('solo-team', `team:${nextId}`)
  uiStore.expandSidebar()
  return rawId
}

async function startSoloConversation() {
  try {
    const result = await createOnePersonTeam({
      name: nextConversationName(), description: '',
      coordinatorId: SOLO_TEAM_COORDINATOR_ID, memberIds: [],
    })
    activateCreatedTeam(result)
  } catch (error) {
    console.error('[SoloTeamList] 新建分身会话失败:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '新建会话失败，请重试'))
  }
}

async function onCreateGroup(list) {
  showCreateGroup.value = false
  if (!Array.isArray(list) || !list.length) return
  try {
    // 建一条空会话，再拉人 → inviteMembers 负责加成员 + 升群 + 分身群里打招呼
    const result = await createOnePersonTeam({
      name: nextConversationName(), description: '',
      coordinatorId: SOLO_TEAM_COORDINATOR_ID, memberIds: [],
    })
    const rawId = activateCreatedTeam(result)
    if (rawId) await inviteMembers(rawId, `thread-main-${rawId}`, list)
  } catch (error) {
    console.error('[SoloTeamList] 新建多人会话失败:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '新建会话失败，请重试'))
  }
}

const employeeItems = computed(() => soloTeamStore.employeeItems)

function getTeamId(item) {
  return item?.teamId ?? item?.id ?? null
}

function getTeamKey(item) {
  return String(item?.teamId ?? item?.id ?? item?.name ?? '')
}

// 会话左侧头像逻辑（对齐设计稿）：
//   solo   = 只有分身 → 单个螃蟹
//   single = 分身 + 1 个数字员工 → 员工头像 + 右下角分身蟹小徽标
//   group  = 分身 + ≥2 个数字员工 → KIMI 式叠放头像簇（最多 3）
function convMembers(item) {
  const members = Array.isArray(item?.members) ? item.members : []
  return members.filter((m) => String(m.agent_id ?? m.id) !== '9001')
}
// 单聊大图 = 彩色圆底 + 白气泡，底色随机分配（对齐设计稿：按会话 id 稳定取色）
const CHAT_PASTELS = ['#CCF5F1', '#E4D6FF', '#FFF1CC', '#DDF4D6', '#D6E7FF', '#FFE1EA']
function pastelFor(item) {
  const key = String(getTeamKey(item) || '')
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CHAT_PASTELS[h % CHAT_PASTELS.length]
}
function memberAvatar(m) { return m?.avatar || m?.avatar_url || fallbackAvatar }
// 群头像簇缓存：升级群在刷新时序里成员瞬时不足时，用上次缓存的头像兜底，避免空簇闪一下
const clusterCache = new Map()
function clusterAvatars(item) {
  const avs = convMembers(item).slice(0, 3).map(memberAvatar)
  const id = getTeamKey(item)
  if (avs.length >= 2) { clusterCache.set(id, avs); return avs }
  if (isTeamUpgraded(getTeamId(item)) && clusterCache.has(id)) return clusterCache.get(id)
  return avs
}
function singleAvatar(item) { return memberAvatar(convMembers(item)[0]) }
function avKind(item) {
  // 已升级成群的会话恒为多人簇——避免刷新时序里成员数瞬时波动导致头像「变多人后又回退」
  if (isTeamUpgraded(getTeamId(item))) return 'group'
  const n = convMembers(item).length
  return n === 0 ? 'solo' : n === 1 ? 'single' : 'group'
}
function avClass(item) {
  const k = avKind(item)
  return k === 'group' ? `conv-av--g${Math.min(clusterAvatars(item).length, 3)}` : `conv-av--${k}`
}
// 列表第二行：最新一条内容预览（空会话给兜底）
function itemPreview(item) {
  return item?.latest_message_preview || item?.last_message_preview || item?.latestMessagePreview || '空会话'
}

function isTeamSelectable(item) {
  const id = item?.teamId ?? item?.id
  return id != null && id !== ''
}

function isTeamActive(item) {
  if (soloTeamStore.isEmployeeChatActive) return false
  const id = item?.teamId ?? item?.id
  if (id != null && String(id) === String(soloTeamStore.currentTeamId)) return true
  return false
}

watch(
  () => teamItems.value.map((item) => item?.teamId ?? item?.id).filter((id) => id != null).map(String),
  (teamIds) => {
    if (uiStore.activePrimaryNav !== 'solo-team') return
    if (soloTeamStore.isEmployeeChatActive) return
    if (
      typeof uiStore.activeSecondaryNav === 'string'
      && (
        uiStore.activeSecondaryNav.startsWith('employee:')
        || uiStore.activeSecondaryNav.startsWith('one-person-team:')
      )
    ) {
      return
    }
    if (teamIds.length === 0) {
      if (uiStore.activeSecondaryNav !== null) {
        uiStore.setActiveNavigation('solo-team', null)
      }
      if (soloTeamStore.currentTeamId) {
        soloTeamStore.setCurrentOnePersonTeamId(null)
      }
      return
    }
    const currentId = soloTeamStore.currentTeamId ? String(soloTeamStore.currentTeamId) : null
    if (!currentId || !teamIds.includes(currentId)) {
      const nextId = teamIds[0]
      soloTeamStore.setCurrentOnePersonTeamId(nextId)
      uiStore.setActiveNavigation('solo-team', `team:${nextId}`)
    } else if (uiStore.activeSecondaryNav !== `team:${currentId}`) {
      uiStore.setActiveNavigation('solo-team', `team:${currentId}`)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void soloTeamStore.loadEmployeeModels()
  if (soloTeamFeatureEnabled) {
    void loadOnePersonTeams()
  }
})

onBeforeUnmount(() => {
  cancelRemoveEmployeeDialog()
  cancelRenameEmployeeDialog()
})

watch(
  () => uiStore.activePrimaryNav,
  (nav) => {
    if (nav === 'solo-team' && soloTeamFeatureEnabled) void loadOnePersonTeams()
  },
)

/**
 * 仅用「员工 id 集合」作为 watch 源：避免 .map(() => id) 每次返回新数组引用，
 * 在编辑数字员工（名称/头像等）更新列表项时误触发。
 * 会话列表不在此拉取：由 onEmployeeClick / selectEmployeeThread / selectFirstEmployeeFromLoadedList 按需 GET personal/threads。
 */
function employeeIdSetKey() {
  return [...employeeItems.value.map((e) => String(e.id))].sort().join(',')
}

watch(
  employeeIdSetKey,
  async () => {
    if (!soloTeamStore.employeeItemsLoaded && !soloTeamStore.employeeLoadingItems) {
      await soloTeamStore.loadEmployeeItems()
    }
  },
  { immediate: true },
)

async function loadOnePersonTeams() {
  await soloTeamStore.loadOnePersonTeamsFromApi()
}

function handleTeamGroupClick() {
  teamExpanded.value = !teamExpanded.value
}

async function onSoloTeamClick(item) {
  const teamId = item?.teamId ?? item?.id
  if (teamId == null || teamId === '') {
    ElMessage.warning('该团队暂未关联到聊天会话，请稍后再试')
    return
  }
  soloTeamStore.activateOnePersonTeamRuntime(teamId)
  uiStore.setActiveNavigation('solo-team', `team:${teamId}`)
}

function getEmployeeThreads(employeeId) {
  return soloTeamStore.getEmployeeThreads(employeeId)
}

async function onEmployeeClick(employee) {
  if (!getEmployeeThreads(employee.id).length) {
    await soloTeamStore.fetchEmployeeThreads(employee.id)
  }
  const firstThread = getEmployeeThreads(employee.id)[0]
  if (firstThread) {
    await onEmployeeThreadClick(employee, firstThread)
  } else {
    await onCreateEmployeeThread(employee)
  }
}

async function onCreateEmployeeThread(employee) {
  const thread = await soloTeamStore.createEmployeeThread(employee.id)
  if (!thread?.id) return
  setEmployeeActiveNavigation(employee.id, thread.id)
}

async function onEmployeeThreadClick(employee, thread) {
  await soloTeamStore.selectEmployeeThread(employee.id, thread.id)
  setEmployeeActiveNavigation(employee.id, thread.id)
}

function setEmployeeActiveNavigation(employeeId, threadId) {
  uiStore.setActiveNavigation('solo-team', `employee:${employeeId}:${threadId}`)
}

function isPinnedEmployee(employee) {
  return Boolean(employee?.pinned ?? employee?.raw?.pinned)
}

function onEmployeeDropdownChange(visible, employee) {
  openDropdownEmployeeId.value = visible ? employee.id : null
}

async function handleEmployeeMenuAction(action, employee) {
  if (!employee?.id) return

  if (action === 'rename') {
    openRenameEmployeeDialog(employee)
    return
  }

  if (action === 'remove') {
    openRemoveEmployeeDialog(employee)
    return
  }

  if (action === 'pin') {
    await handleEmployeePin(employee)
    return
  }

  if (action === 'unpin') {
    await handleEmployeeUnpin(employee)
    return
  }

  ElMessage.info('未知操作')
}

async function handleEmployeePin(employee) {
  if (isPinnedEmployee(employee)) {
    ElMessage.info('当前员工已置顶')
    return
  }
  try {
    await soloTeamStore.pinEmployee(employee.id)
    ElMessage.success('已置顶')
  } catch (error) {
    console.error('[SoloTeamList] pin employee failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '置顶失败，请稍后重试'))
  }
}

async function handleEmployeeUnpin(employee) {
  const pinned = isPinnedEmployee(employee)
  if (!pinned) {
    ElMessage.info('当前员工未置顶')
    return
  }
  try {
    await soloTeamStore.unpinEmployee(employee.id)
    ElMessage.success('已取消置顶')
  } catch (error) {
    console.error('[SoloTeamList] unpin employee failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '取消置顶失败，请稍后重试'))
  }
}

function openRenameEmployeeDialog(employee) {
  if (!employee?.id) return
  renameEmployeeDialog.employee = employee
  renameEmployeeDialog.inputValue = employee.name || ''
  renameEmployeeDialog.visible = true
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function cancelRenameEmployeeDialog() {
  renameEmployeeDialog.visible = false
  renameEmployeeDialog.employee = null
  renameEmployeeDialog.inputValue = ''
}

async function confirmRenameEmployeeDialog() {
  const employee = renameEmployeeDialog.employee
  const nextName = String(renameEmployeeDialog.inputValue || '').trim()
  if (!nextName || !employee?.id || nextName === employee.name) {
    cancelRenameEmployeeDialog()
    return
  }
  try {
    await soloTeamStore.renameEmployee(employee.id, nextName)
    ElMessage.success('重命名成功')
  } catch (error) {
    console.error('[SoloTeamList] rename employee failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '重命名失败，请稍后重试'))
  } finally {
    cancelRenameEmployeeDialog()
  }
}

function openRemoveEmployeeDialog(employee) {
  if (!employee?.id) return
  removeEmployeeDialog.employee = employee
  removeEmployeeDialog.visible = true
}

function cancelRemoveEmployeeDialog() {
  removeEmployeeDialog.visible = false
  removeEmployeeDialog.employee = null
}

async function confirmRemoveEmployeeDialog() {
  const employee = removeEmployeeDialog.employee
  cancelRemoveEmployeeDialog()
  if (!employee?.id) return
  try {
    await soloTeamStore.removeEmployee(employee.id)
    ElMessage.success('移除成功')
    // 刷新文件树
    fileStore.invalidateCloudNode('category_opt')
    window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
      detail: { spaceId: employee.id, roomType: 'super_person_chat' },
    }))
  } catch (error) {
    console.error('[SoloTeamList] remove employee failed:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '操作失败，请稍后重试'))
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/cancel-button.scss' as cancel-btn;
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

.submenu-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0 -5px 0 5px;
  overflow: hidden;
}

/* 顶部：＋ 新建下拉 + 我的助理卡片 */
.conv-new { display: flex; flex-direction: column; gap: 8px; padding: 8px 8px 10px; flex-shrink: 0; }
.conv-new__wrap { position: relative; }
.conv-new__btn {
  width: 100%; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid #eceef3; border-radius: 999px; background: #fff; color: #2f3547;
  font-size: 14px; font-weight: 400; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;
}
.conv-new__btn:hover, .conv-new__btn.is-open { border-color: #ffcaa8; }
.conv-new__caret { color: #9aa1ad; transition: transform 0.15s ease; }
.conv-new__btn.is-open .conv-new__caret { transform: rotate(180deg); }
.conv-new__backdrop { position: fixed; inset: 0; z-index: 40; }
.conv-new__menu {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 50;
  background: #fff; border: 0.5px solid #eceef3; border-radius: 12px;
  box-shadow: 0 10px 30px rgba(31, 35, 41, 0.14); padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.conv-new__opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 11px; border: none; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; transition: background 0.14s ease; }
.conv-new__opt:hover { background: #fff3ec; }
.conv-new__opt-title { font-size: 13.5px; font-weight: 600; color: #2f3547; }
.conv-new__opt-sub { font-size: 11.5px; color: #9a9fab; }

.conv-assistant {
  position: relative; overflow: hidden;
  width: 100%;
  display: flex; align-items: center; gap: 12px; padding: 8px; min-height: 56px; box-sizing: border-box;
  border: none; border-radius: 12px; background: linear-gradient(282deg, #FFDED0 0%, #FDF8F6 37%, #F5F6F9 100%);
  text-align: left;
  cursor: pointer; transition: filter 0.16s ease;
}
.conv-assistant:hover { filter: brightness(0.985); }
/* 右上角「淡淡一撮头像」装饰：2×3 倾斜网格、40% 透明，被卡片圆角裁切 */
.conv-assistant__deco {
  position: absolute; top: -4px; right: 8px; z-index: 0;
  display: grid; grid-template-columns: repeat(2, 15px); gap: 9px 8px;
  transform: rotate(15deg); transform-origin: top right;
  opacity: 0.4; pointer-events: none;
}
.conv-assistant__deco img { width: 15px; height: 15px; border-radius: 50%; object-fit: cover; display: block; }
/* 我的助理 icon：气泡打底铺满，螃蟹叠在左下角、略小并轻微溢出（比例照设计稿手调）*/
.conv-assistant__av { position: relative; z-index: 1; width: 40px; height: 40px; flex-shrink: 0; }
.conv-assistant__av-bubble { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.conv-assistant__av-crab { position: absolute; left: -3px; bottom: -2px; width: 22px; height: 22px; object-fit: contain; }
.conv-assistant__text { position: relative; z-index: 1; display: flex; flex-direction: column; min-width: 0; flex: 1; }
.conv-assistant__name { font-size: 14px; font-weight: 500; color: #2F3547; }
.conv-assistant__sub { font-size: 12px; color: #91949E; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 空态 */
.conv-empty { padding: 28px 16px; text-align: center; font-size: 12.5px; color: #b6bac4; line-height: 1.7; }

/* 顶部常驻：我的分身入口 + 「+」开多人会话 */
.conv-top {
  display: flex;
  align-items: stretch;
  padding: 4px 4px 6px;
  flex-shrink: 0;
}

/* 横向排：新会话橙色胶囊 + 群聊 logo（仅图标）；统一到 app 橙色系 */
.conv-top--row { align-items: center; gap: 8px; padding: 8px 8px 12px; }
.conv-pill {
  flex: 1; min-width: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px; border: none; border-radius: 12px; cursor: pointer;
  background: linear-gradient(135deg, #ff9a3d, #ff621f);
  color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(255, 120, 60, 0.26);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.conv-pill:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255, 120, 60, 0.34); }
.conv-group-btn {
  flex-shrink: 0; width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid #ffd8c2; border-radius: 12px; background: #fff; color: #ff6a2b; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.conv-group-btn:hover { border-color: #ff8a4c; background: #fff6f0; color: #ff5a1f; }
.conv-self {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffefe4, #fff8f3);
  cursor: pointer;
  transition: box-shadow 0.16s ease, transform 0.16s ease;
}
.conv-self:hover {
  box-shadow: 0 6px 16px rgba(255, 120, 60, 0.18);
  transform: translateY(-1px);
}
.conv-self__avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(255, 120, 60, 0.2);

  img {
    width: 82%;
    height: 82%;
    object-fit: contain;
    display: block;
  }
}
.conv-self__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.conv-self__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  line-height: 1.3;
  white-space: nowrap;
}
.conv-self__badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #ffa63d, #ff7a1f);
  border-radius: 6px;
  padding: 1px 6px;
  line-height: 1.6;
}
.conv-self__desc {
  font-size: 11px;
  color: #c0895f;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 会话分组头右侧：纯「+」图标 → 开多人会话 */
.category-count {
  font-size: 12px;
  color: #b6bac4;
  margin-left: 2px;
}
.category-add {
  margin-left: auto;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8b95a5;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.category-add:hover {
  background: #eef0f4;
  color: #ff621f;
}

/* 分组容器：展开时根据内容自适应，超出时可滚动 */
.submenu-category {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  &.is-expanded {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
  }
}

.submenu-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 8px 12px;
  color: #91949E;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;

  &:hover {
    color: #2f3547;
  }

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.category-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;

  &.is-expanded {
    transform: rotate(90deg);
  }
}

.category-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.category-label {
  font-family: PingFang SC;
  line-height: 20px;
}

.beta-tag {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 6px;
  gap: 4px;
  width: 39px;
  height: 20px;
  border-radius: 12px;
  background: #F1EBFF;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  color: #A070FF;
  margin-left: 3px;
}

/* 分组内容区域：展开时显示并可滚动，收缩时隐藏 */
.submenu-category-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  flex: 1 1 auto;
  padding-right: 4px;

  .submenu-category:not(.is-expanded) & {
    display: none;
  }
}

/* 滚动条样式 */
.submenu-category-content::-webkit-scrollbar {
  width: 4px;
}

.submenu-category-content::-webkit-scrollbar-track {
  background: transparent;
}

.submenu-category-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.submenu-category-content:hover::-webkit-scrollbar-thumb {
  background: rgba(47, 53, 71, 0.2);
}

.submenu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

/* 两行文本：标题 + 最新内容 */
.conv-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.conv-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  line-height: 1.57;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-item-preview {
  font-size: 12px;
  color: #91949e;
  margin-top: 2px;
  line-height: 1.67;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.submenu-item.active .conv-item-title {
  font-weight: 600;
}

.submenu-item:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.submenu-item.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);

  .submenu-item-label {
    font-weight: 600;
  }
}

.submenu-item--disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.submenu-item--disabled:hover {
  background: transparent;
}

.submenu-item-label {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

/* 会话头像：solo=螃蟹 / single=员工底像+右下角分身蟹徽标 / group=KIMI 叠放簇 */
.conv-av { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
.conv-av__solo,
.conv-av__base {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
  background: #f0f1f4; display: block;
}
.conv-av__solo { object-fit: contain; }
/* single：大图 = 默认 💬 icon；右下角 = 对应数字人头像（白环） */
.conv-av__chat {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.conv-av__chat svg { width: 26px; height: 26px; display: block; }
.conv-av__badge-img {
  position: absolute; right: -1px; bottom: -1px;
  width: 18px; height: 18px; border-radius: 50%;
  object-fit: cover; background: #f0f1f4;
  border: 1.5px solid #fff;
}
/* group：KIMI 叠放头像簇 */
.conv-av__stack {
  position: absolute; border-radius: 50%; object-fit: cover;
  background: #f0f1f4; border: 1.5px solid #fff;
}
.conv-av--g2, .conv-av--g3 { border-radius: 50%; }
.conv-av--g2 .conv-av__stack { width: 25px; height: 25px; }
.conv-av--g2 .conv-av__stack:nth-child(1) { left: 1px; top: 1px; z-index: 1; }
.conv-av--g2 .conv-av__stack:nth-child(2) { right: 1px; bottom: 1px; z-index: 2; }
.conv-av--g3 .conv-av__stack { width: 21px; height: 21px; }
.conv-av--g3 .conv-av__stack:nth-child(1) { left: 50%; top: 1px; transform: translateX(-50%); z-index: 1; }
.conv-av--g3 .conv-av__stack:nth-child(2) { left: 1px; bottom: 1px; z-index: 2; }
.conv-av--g3 .conv-av__stack:nth-child(3) { right: 1px; bottom: 1px; z-index: 3; }

/* 特殊会话头像：纯色圆底 + emoji（系统通知 / 定时任务） */
.conv-sys-av {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; line-height: 1;
}

.submenu-item--employee {
  justify-content: space-between;
  padding-left: 12px;
  padding-right: 6px;
}

.submenu-item-pin-icon {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
}

.submenu-item--employee:hover .submenu-item-pin-icon,
.submenu-item--employee:has(.submenu-employee-more.is-menu-open) .submenu-item-pin-icon {
  display: none;
}

.submenu-employee-trailing {
  flex-shrink: 0;
  margin-left: auto;
}

.submenu-employee-more {
  width: 24px;
  height: 24px;
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

.submenu-item--employee:hover .submenu-employee-more,
.submenu-employee-more.is-menu-open {
  opacity: 1;
}

.submenu-employee-more:hover,
.submenu-employee-more.is-menu-open {
  background: rgba(47, 53, 71, 0.06);
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

/* 与 EmployeeChatSessionHeader「移除会话」确认弹框一致 */
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

.delete-dialog--remove-employee {
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

.delete-dialog--rename-employee {
  box-sizing: border-box;
  width: 480px;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 16px;

  @include delete-confirm.delete-dialog-header-row;

  .delete-dialog-footer {
    flex-shrink: 0;
    margin-top: 16px;
  }
}

.rename-input-wrap {
  margin-top: 12px;
}

.rename-input {
  width: 100%;
  height: 32px;
  padding: 0 16px;
  box-sizing: border-box;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  color: #0a0e23;
  background: #fff;
  transition: border-color 0.2s;

  &::placeholder {
    color: rgba(10, 14, 35, 0.28);
  }

  &:focus {
    border-color: #8478fa;
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

<style lang="scss">
/* el-dropdown 弹窗样式（与协作列表共用 popper-class="submenu-more-dropdown"） */
.submenu-more-dropdown {
  &.el-popper {
    --el-dropdown-menuItem-hover-fill: #F5F6F9;
    --el-dropdown-menuItem-hover-color: #2f3547;
    min-width: auto !important;
    width: 98px;
    padding: 8px 6px !important;
    border-radius: 8px !important;
    border: none !important;
    box-shadow: 0 8px 24px rgba(47, 53, 71, 0.16) !important;
  }

  .el-dropdown-menu {
    padding: 0;
  }

  .el-dropdown-menu__item {
    height: 30px;
    line-height: 30px;
    padding: 0 6px;
    font-size: 14px;
    color: #2f3547;
    border-radius: 6px;
  }

  .submenu-dropdown-danger {
    color: #ff4d4f !important;
  }
}
</style>
