import { ElMessage } from 'element-plus'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { createOnePersonTeam } from '@/modules/solo-team/service'
import { inviteMembers } from '@/modules/solo-team/demo/onePersonDirector'
import { soloTeamApiErrorMessage } from '@/modules/solo-team/utils/apiErrorMessage'

/**
 * 「聘完就能聊」的交接逻辑。
 *
 * 放在 solo-team 而不是 contacts，是因为落点是「个人」nav —— 市场和通讯录都往这儿交接，
 * 搁在 contacts 里会让 market 反向依赖通讯录。
 */

/** 「个人」nav 里分身的固定 agent_id（与 SoloTeamList 一致） */
const SOLO_TEAM_COORDINATOR_ID = 9001

/**
 * 在「个人」开一条只拉他的会话（我 + 助理 + 他）。
 * 顺序照抄 solo-team/components/SoloTeamList.vue 的 onPickSingle（1:1 单聊范本）。
 * 助理本体（isAssistant）不拉人，就是一条纯 1:1 新会话。
 */
export async function startSoloChatWithEmployee(employee) {
  if (!employee?.id) return null
  const uiStore = useUIStore()
  const soloTeamStore = useSoloTeamStore()
  const pick = {
    agent_id: employee.id,
    name: employee.name,
    avatar: employee.avatar,
  }
  try {
    const result = await createOnePersonTeam({
      // 会话名 = 员工名（1:1 单聊范本）；助理本体是默认应答者，叫「新会话」
      name: employee.isAssistant ? '新会话' : (employee.name || '新会话'),
      description: '',
      coordinatorId: SOLO_TEAM_COORDINATOR_ID,
      memberIds: [],
    })
    const rawId = result?.teamId ?? result?.id
    if (!rawId) return null
    const createdId = soloTeamStore.activateCreatedOnePersonTeam({
      ...(result || {}),
      id: rawId,
      teamId: rawId,
    })
    uiStore.setActiveNavigation('solo-team', `team:${createdId || rawId}`)
    uiStore.expandSidebar()
    // 助理本体就是会话默认应答者，不用（也不能）把自己拉进来。
    // soloChat：开场白由他本人说，点进来直接是跟他的聊天页
    if (!employee.isAssistant) {
      await inviteMembers(rawId, `thread-main-${rawId}`, [pick], { soloChat: true })
    }
    return createdId || rawId
  } catch (error) {
    console.error('[SoloTeam] 新建单聊失败:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '新建会话失败，请重试'))
    return null
  }
}

/**
 * demo 桥：`hireAgent` 只写市场的「已聘」状态，而「我的员工」读的是
 * `window.__optMock.employees`（另一套 mock）—— 不补这一手，聘完员工列表不会多人。
 * 真实环境没有 __optMock，这里自然空转。
 */
export function syncHiredEmployeeToDemoMock(employee) {
  if (typeof window === 'undefined') return
  const optMock = window.__optMock
  if (!optMock || !Array.isArray(optMock.employees)) return
  const id = String(employee?.id ?? '')
  if (!id || optMock.employees.some((e) => String(e.agent_id ?? e.id) === id)) return
  const now = new Date().toISOString()
  optMock.employees.push({
    id: Number(employee.id), agent_id: Number(employee.id),
    name: employee.name, display_name: employee.name,
    avatar: employee.avatar, avatar_url: employee.avatar,
    description: employee.description || '', bio: employee.description || '',
    is_default: false, pinned: false,
    tags: employee.tags || [], capabilities: [], skills: [],
    presence: { status: 'idle' },
    created_at: now, updated_at: now,
  })
}

/**
 * 市场聘用成功后的交接：把人补进员工列表，跳到「个人」并跟他开一条会话。
 * 失败不抛 —— 聘用本身已经成功了，交接不上最多是少跳一步，不该报成聘用失败。
 */
export async function handoffAfterHire(employee) {
  if (!employee?.id) return
  syncHiredEmployeeToDemoMock(employee)
  const soloTeamStore = useSoloTeamStore()
  try {
    await soloTeamStore.loadEmployeeItems({ force: true })
  } catch (error) {
    console.error('[SoloTeam] 聘用后刷新员工列表失败:', error)
  }
  await startSoloChatWithEmployee(employee)
}
