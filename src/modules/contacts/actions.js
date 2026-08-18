import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { startSoloChatWithEmployee } from '@/modules/solo-team/hireHandoff'

/**
 * 通讯录里的跳转动作 —— 全部落到已有模块，通讯录自己不开对话场。
 */

/**
 * 我的数字员工 · 对话：在「个人」开一条只拉他的会话（我 + 助理 + 他）。
 * 实现搬到了 solo-team/hireHandoff —— 市场聘完也要走同一条路，
 * 放在通讯录里会让 market 反向依赖这边。
 */
export function chatWithEmployee(employee) {
  return startSoloChatWithEmployee(employee)
}

/**
 * 我的数字员工 · 打开一条已有会话（详情页右栏「近期会话」点击）。
 * nav value 形态 `employee:<agentId>:<threadId>` 照抄 employeeChats.sendEmployeeMessage 里的写法。
 */
export async function openEmployeeThread(employee, thread) {
  const employeeId = String(employee?.id ?? '')
  const threadId = String(thread?.id ?? '')
  if (!employeeId || !threadId) return
  const uiStore = useUIStore()
  const soloTeamStore = useSoloTeamStore()
  try {
    await soloTeamStore.selectEmployeeThread(employeeId, threadId)
    uiStore.setActiveNavigation('solo-team', `employee:${employeeId}:${threadId}`)
    uiStore.expandSidebar()
  } catch (error) {
    console.error('[Contacts] 打开会话失败:', error)
    ElMessage.error('打开会话失败，请重试')
  }
}

/**
 * 我的数字员工 · 打开定时任务详情（详情页右栏「定时任务」点击）。
 * 列表/详情面板都挂在 HomeView 上，开关是 `uiStore.activeToolTab === 'schedule'` + activeTaskId。
 */
export function openEmployeeSchedule(task) {
  const taskId = task?.id
  if (!taskId) return
  const uiStore = useUIStore()
  const scheduleStore = useScheduleStore()
  uiStore.activeToolTab = 'schedule'
  scheduleStore.setActiveTask(taskId)
}

/**
 * 我的数字员工 · 配置：右侧开 PersonaManagePanel（基本 / 技能 / 记忆 + 解聘）。
 * HomeView 已按 digitalEmployeePanelVisible + soloTeamStore.currentEmployeeId 渲染，这里只置位。
 * 助理本体也走这块面板，解聘按钮由面板自己按 is_default 藏掉。
 */
export function manageEmployee(employee) {
  const uiStore = useUIStore()
  const soloTeamStore = useSoloTeamStore()
  soloTeamStore.currentEmployeeId = employee.id
  uiStore.digitalEmployeePanelVisible = true
}

/**
 * 员工来源 · 跳市场看这条数字人的详情（只有市场聘来的才有得跳）。
 * 路由是市场自己的 `/market/avatar/:id`，nav 也要跟着切，否则左栏还停在通讯录。
 */
export function openMarketAgent(marketAgentId, router) {
  const id = String(marketAgentId ?? '')
  if (!id || !router) return
  const uiStore = useUIStore()
  uiStore.setActiveNavigation('market', 'market-avatar')
  uiStore.expandSidebar()
  router.push(`/market/avatar/${id}`).catch(() => {})
}

/**
 * 数字同事（企业数字人）· 对话：跳协作的数字人单聊。
 * 顺序照抄 shared/components/user/UserProfileCard.vue 的 handleAgentChat（生产范本）。
 */
export async function chatWithDigitalColleague(agent) {
  const uiStore = useUIStore()
  const agentId = agent?.id
  if (!agentId) return
  try {
    const digitalHumanStore = useDigitalHumanStore()
    const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()
    await digitalHumanStore.openAgent(agentId, '新对话')
    digitalHumanStore.upsertAgentInList?.({
      agent_id: agentId,
      agent_name: agent.account || String(agentId),
      agent_display_name: agent.name || String(agentId),
      agent_avatar_url: agent.avatar || '',
    })
    await collaborationEmployeeChatStore.applyCollaborationDigitalHumanSession(
      agentId,
      digitalHumanStore.currentThreadPayload,
      digitalHumanStore.currentAgent || {
        agent_id: agentId,
        agent_name: agent.account || String(agentId),
        agent_display_name: agent.name || String(agentId),
      },
    )
    uiStore.setActiveNavigation('collaboration', `digital-human-${agentId}`)
    uiStore.expandSidebar()
  } catch (error) {
    console.error('[Contacts] 打开数字人对话失败:', error)
    ElMessage.error('打开对话失败，请重试')
  }
}
