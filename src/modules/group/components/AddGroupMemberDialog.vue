<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    :width="dialogWidth"
    class="group-add-member-dialog"
    align-center
    append-to-body
    destroy-on-close
    @close="handleClose"
  >
    <div v-if="isCreateTeamMode" class="group-add-member__team-row">
      <label class="group-add-member__team-label">群名称</label>
      <div class="group-add-member__team-field">
        <input
          v-model="teamName"
          class="group-add-member__team-input"
          maxlength="20"
          placeholder="请输入群名称，若不输入系统会自动生成名称哦"
        />
        <span class="group-add-member__team-count">{{ teamName.length }}/20</span>
      </div>
    </div>

    <div class="group-add-member__layout">
      <section class="group-add-member__column group-add-member__column--left">
        <div class="group-add-member__label">选择成员</div>
        <div class="group-add-member__picker">
          <div class="group-add-member__search">
            <el-icon :size="14" class="group-add-member__search-icon"><Search /></el-icon>
            <input
              v-model="searchQuery"
              class="group-add-member__search-input"
              placeholder="搜索真人或数字人"
            />
          </div>

          <div v-if="isCreateTeamMode" class="group-add-member__tabs">
            <button
              type="button"
              class="group-add-member__tab"
              :class="{ 'group-add-member__tab--active': activeCreateTab === 'user' }"
              @click="switchCreateTab('user')"
            >
              联系人
            </button>
            <button
              type="button"
              class="group-add-member__tab"
              :class="{ 'group-add-member__tab--active': activeCreateTab === 'agent' }"
              @click="switchCreateTab('agent')"
            >
              数字人
            </button>
          </div>

          <div v-if="activePickerMode === 'user' && orgStack.length && !isSearchMode" class="group-add-member__breadcrumb">
            <button type="button" title="全部" @click="goToOrgLevel(-1)">全部</button>
            <template v-for="(crumb, idx) in orgStack" :key="crumb.id">
              <span>/</span>
              <button type="button" :title="crumb.name" @click="goToOrgLevel(idx)">{{ crumb.name }}</button>
            </template>
          </div>

          <div class="group-add-member__candidate-list">
            <template v-if="activePickerMode === 'agent'">
              <div v-if="loading || agentSearchLoading" class="group-add-member__empty">加载中…</div>
              <template v-else>
                <button
                  v-for="agent in filteredAgents"
                  :key="agent.id"
                  type="button"
                  class="group-add-member__candidate"
                  :class="{ 'group-add-member__candidate--locked': isTeamAssistantAgent(agent) }"
                  @click="toggleAgent(agent)"
                >
                  <span class="group-add-member__checkbox" :class="{ 'group-add-member__checkbox--checked': selectedAgentIds.has(agent.id) }">
                    <el-icon v-if="selectedAgentIds.has(agent.id)"><Check /></el-icon>
                  </span>
                  <img :src="agent.avatar || defaultAgentAvatar" alt="" class="group-add-member__avatar" />
                  <span class="group-add-member__info">
                    <span class="group-add-member__name">
                      {{ agent.name || agent.username || agent.id }}
                      <span v-if="isTeamAssistantAgent(agent)" class="group-add-member__lock-tag">必选</span>
                    </span>
                    <span class="group-add-member__sub">{{ isTeamAssistantAgent(agent) ? '协作群内置 · 不可取消' : '数字人' }}</span>
                  </span>
                </button>
                <div v-if="!filteredAgents.length" class="group-add-member__empty">暂无数字人</div>
              </template>
            </template>

            <template v-else>
              <div v-if="loading || searchLoading" class="group-add-member__empty">加载中…</div>
              <template v-else-if="isSearchMode">
                <button
                  v-for="member in searchResults"
                  :key="member.account || member.userId"
                  type="button"
                  class="group-add-member__candidate"
                  @click="toggleUser(member)"
                >
                  <span class="group-add-member__checkbox" :class="{ 'group-add-member__checkbox--checked': selectedUserKeys.has(member.account || member.userId) }">
                    <el-icon v-if="selectedUserKeys.has(member.account || member.userId)"><Check /></el-icon>
                  </span>
                  <img :src="member.avatar || defaultAvatar" alt="" class="group-add-member__avatar" />
                  <span class="group-add-member__info">
                    <span class="group-add-member__name">{{ member.name }}</span>
                    <span class="group-add-member__sub">{{ member.department || '—' }}</span>
                  </span>
                </button>
                <div v-if="!searchResults.length" class="group-add-member__empty">无匹配结果</div>
              </template>
              <template v-else>
                <button
                  v-for="member in profileMembers"
                  :key="'p-' + (member.account || member.userId)"
                  type="button"
                  class="group-add-member__candidate"
                  @click="toggleUser(member)"
                >
                  <span class="group-add-member__checkbox" :class="{ 'group-add-member__checkbox--checked': selectedUserKeys.has(member.account || member.userId) }">
                    <el-icon v-if="selectedUserKeys.has(member.account || member.userId)"><Check /></el-icon>
                  </span>
                  <img :src="member.avatar || defaultAvatar" alt="" class="group-add-member__avatar" />
                  <span class="group-add-member__info">
                    <span class="group-add-member__name">{{ member.name }}</span>
                    <span class="group-add-member__sub">{{ member.department || '—' }}</span>
                  </span>
                </button>
                <button
                  v-for="node in orgNodes"
                  :key="'d-' + node.id"
                  type="button"
                  class="group-add-member__candidate group-add-member__candidate--dept"
                  @click="drillDown(node)"
                >
                  <span class="group-add-member__checkbox group-add-member__checkbox--dept"></span>
                  <span class="group-add-member__info">
                    <span class="group-add-member__name">{{ node.name }}</span>
                    <span class="group-add-member__sub">{{ node.full_name || '部门' }}</span>
                  </span>
                  <span class="group-add-member__dept-next">下级</span>
                </button>
                <div v-if="!profileMembers.length && !orgNodes.length" class="group-add-member__empty">暂无数据</div>
              </template>
            </template>
          </div>
        </div>
      </section>

      <section class="group-add-member__column group-add-member__column--right">
        <div class="group-add-member__selected-header">已选 <span class="group-add-member__selected-count">{{ selectedList.length }}</span> 个</div>
        <div class="group-add-member__selected-list">
          <div v-for="item in selectedList" :key="item.key" class="group-add-member__selected-row">
            <img :src="item.avatar" alt="" class="group-add-member__avatar" />
            <span class="group-add-member__info">
              <span class="group-add-member__name">{{ item.name }}</span>
              <span class="group-add-member__sub">{{ item.subtitle }}</span>
            </span>
            <span v-if="item.mandatory" class="group-add-member__selected-required">必选</span>
            <button v-else type="button" class="group-add-member__selected-remove" @click="removeSelected(item)">×</button>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        type="button"
        class="group-add-member__dialog-btn group-add-member__dialog-btn--cancel"
        :disabled="confirmLoading"
        @click="handleClose"
      >取消</button>
      <button
        type="button"
        class="group-add-member__dialog-btn group-add-member__dialog-btn--confirm"
        :disabled="confirmLoading"
        @click="handleConfirm"
      >{{ confirmLoading ? '处理中…' : confirmButtonText }}</button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Search } from '@element-plus/icons-vue'
import {
  fetchRootDepartments,
  fetchDepartmentChildren,
  fetchDepartmentProfiles,
  fetchKcMarketAgents,
  searchProfiles,
} from '@/shared/services/orgApi'
import defaultAvatar from '@/assets/default-avatar.svg'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'

// [dev-mocks] 团队助手：协作群创建时必须默认选中且不可取消
import { TEAM_ASSISTANT_AGENT_ID } from '@/dev-mocks/data/team-assistant'

function isTeamAssistantAgent(agent) {
  if (!agent) return false
  if (agent.is_team_assistant === true) return true
  const id = Number(agent.id ?? agent.agent_id)
  return Number.isFinite(id) && id === TEAM_ASSISTANT_AGENT_ID
}

function buildTeamAssistantItem() {
  return {
    id: TEAM_ASSISTANT_AGENT_ID,
    agent_id: TEAM_ASSISTANT_AGENT_ID,
    name: '团队助手',
    display_name: '团队助手',
    username: 'team-assistant',
    avatar: '',
    is_team_assistant: true,
    is_mandatory: true,
    participant_id: 'team-assistant',
    imBotId: 'team-assistant',
    description: '协作模块的 AI 助手，群里 @ 触发任务拆解和推进',
  }
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'user' },
  existingMembers: { type: Array, default: () => [] },
  initialDraft: { type: Object, default: null },
  confirmLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirm'])

const loading = ref(false)
const searchLoading = ref(false)
const agentSearchLoading = ref(false)
const searchQuery = ref('')
const teamName = ref('')
const activeCreateTab = ref('user')
const orgNodes = ref([])
const orgStack = ref([])
const profileMembers = ref([])
const searchResults = ref([])
const digitalHumans = ref([])
const selectedUsers = ref(new Map())
const selectedAgents = ref(new Map())
let searchTimer = null
let agentSearchTimer = null

const isCreateTeamMode = computed(() => props.mode === 'create-team')
const activePickerMode = computed(() => isCreateTeamMode.value ? activeCreateTab.value : props.mode)
const dialogTitle = computed(() => {
  if (isCreateTeamMode.value) return '新建群聊'
  return props.mode === 'agent' ? '添加数字人成员' : '添加真人成员'
})
const dialogWidth = computed(() => isCreateTeamMode.value ? '708px' : '628px')
const confirmButtonText = computed(() => {
  return isCreateTeamMode.value ? '创建群聊' : '确定'
})
const isSearchMode = computed(() => activePickerMode.value === 'user' && !!searchQuery.value.trim())
const selectedUserKeys = computed(() => new Set(selectedUsers.value.keys()))
const selectedAgentIds = computed(() => new Set(selectedAgents.value.keys()))

const filteredAgents = computed(() => {
  // 数字人搜索改为通过接口实现，这里直接展示完整列表
  return digitalHumans.value
})

const selectedList = computed(() => {
  const agentItems = [...selectedAgents.value.values()].map((agent) => ({
      key: `agent-${agent.id}`,
      type: 'agent',
      name: agent.name || agent.username || agent.id,
      subtitle: agent.department || '数字人',
      avatar: agent.avatar || defaultAgentAvatar,
      mandatory: isTeamAssistantAgent(agent),
      raw: agent,
    }))
  const userItems = [...selectedUsers.value.values()].map((member) => ({
    key: `user-${member.account || member.userId}`,
    type: 'user',
    name: member.name || member.account || member.userId,
    subtitle: member.department || '—',
    avatar: member.avatar || defaultAvatar,
    raw: member,
  }))
  if (isCreateTeamMode.value) return [...userItems, ...agentItems]
  return props.mode === 'agent' ? agentItems : userItems
})

watch(() => props.visible, async (visible) => {
  if (!visible) return
  reset()
  loading.value = true
  try {
    if (isCreateTeamMode.value) {
      const [departments, agentRes] = await Promise.all([
        fetchRootDepartments(),
        fetchKcMarketAgents({ pageSize: 100 }),
      ])
      orgNodes.value = departments
      // 协作群必须带团队助手：放第一位 + 预选
      const taItem = buildTeamAssistantItem()
      const items = (agentRes.items || []).filter((a) => !isTeamAssistantAgent(a))
      digitalHumans.value = [taItem, ...items]
      selectedAgents.value = new Map([[TEAM_ASSISTANT_AGENT_ID, taItem]])
      applyInitialDraft(taItem)
    } else if (activePickerMode.value === 'agent') {
      const agentRes = await fetchKcMarketAgents({ pageSize: 100 })
      digitalHumans.value = (agentRes.items || []).filter((a) => !isTeamAssistantAgent(a))
    } else {
      orgNodes.value = await fetchRootDepartments()
    }
  } catch (e) {
    console.error('[AddGroupMemberDialog] 加载成员失败:', e)
    ElMessage.error('成员加载失败，请重试')
  } finally {
    loading.value = false
  }
})

watch(searchQuery, (value) => {
  if (activePickerMode.value === 'agent') {
    // 数字人搜索：调用接口
    if (agentSearchTimer) clearTimeout(agentSearchTimer)
    const q = value.trim()
    if (!q) {
      // 清空搜索时重新加载完整列表
      agentSearchTimer = setTimeout(async () => {
        agentSearchLoading.value = true
        try {
          const agentRes = await fetchKcMarketAgents({ pageSize: 100 })
          digitalHumans.value = agentRes.items
        } catch (e) {
          console.error('[AddGroupMemberDialog] 加载数字人失败:', e)
          ElMessage.error('加载失败，请重试')
        } finally {
          agentSearchLoading.value = false
        }
      }, 300)
      return
    }
    agentSearchTimer = setTimeout(async () => {
      agentSearchLoading.value = true
      try {
        const agentRes = await fetchKcMarketAgents({ search: q, pageSize: 100 })
        digitalHumans.value = agentRes.items
      } catch (e) {
        console.error('[AddGroupMemberDialog] 搜索数字人失败:', e)
        digitalHumans.value = []
        ElMessage.error('搜索失败，请重试')
      } finally {
        agentSearchLoading.value = false
      }
    }, 300)
  } else {
    // 真人搜索：保持原有逻辑
    if (searchTimer) clearTimeout(searchTimer)
    const q = value.trim()
    if (!q) {
      searchResults.value = []
      searchLoading.value = false
      return
    }
    searchTimer = setTimeout(async () => {
      searchLoading.value = true
      try {
        searchResults.value = await searchProfiles(q)
      } catch (e) {
        console.error('[AddGroupMemberDialog] 搜索成员失败:', e)
        searchResults.value = []
        ElMessage.error('搜索失败，请重试')
      } finally {
        searchLoading.value = false
      }
    }, 300)
  }
})

function reset() {
  searchQuery.value = ''
  teamName.value = ''
  activeCreateTab.value = 'user'
  orgNodes.value = []
  orgStack.value = []
  profileMembers.value = []
  searchResults.value = []
  digitalHumans.value = []
  selectedUsers.value = new Map()
  selectedAgents.value = new Map()
}

function applyInitialDraft(teamAssistant) {
  const draft = props.initialDraft
  if (!isCreateTeamMode.value || !draft) return
  teamName.value = String(draft.name || '')
  selectedUsers.value = new Map(
    (Array.isArray(draft.users) ? draft.users : [])
      .map((member) => [member.account || member.userId, member])
      .filter(([key]) => key !== undefined && key !== null && key !== ''),
  )
  const agents = Array.isArray(draft.agents) ? draft.agents : []
  const agentEntries = agents
    .map((agent) => [agent.id ?? agent.agent_id, agent])
    .filter(([key]) => key !== undefined && key !== null && key !== '')
  const assistant = teamAssistant || buildTeamAssistantItem()
  selectedAgents.value = new Map([
    [TEAM_ASSISTANT_AGENT_ID, assistant],
    ...agentEntries.filter(([, agent]) => !isTeamAssistantAgent(agent)),
  ])
}

async function switchCreateTab(tab) {
  if (!isCreateTeamMode.value || activeCreateTab.value === tab) return
  activeCreateTab.value = tab
  searchQuery.value = ''
  if (tab === 'agent' && digitalHumans.value.length === 0) {
    agentSearchLoading.value = true
    try {
      const agentRes = await fetchKcMarketAgents({ pageSize: 100 })
      digitalHumans.value = agentRes.items
    } catch (e) {
      console.error('[AddGroupMemberDialog] 加载数字人失败:', e)
      ElMessage.error('加载失败，请重试')
    } finally {
      agentSearchLoading.value = false
    }
  } else if (tab === 'user' && orgNodes.value.length === 0) {
    loading.value = true
    try {
      orgNodes.value = await fetchRootDepartments()
    } catch (e) {
      console.error('[AddGroupMemberDialog] 加载成员失败:', e)
      ElMessage.error('成员加载失败，请重试')
    } finally {
      loading.value = false
    }
  }
}

function toggleUser(member) {
  const key = member.account || member.userId
  const next = new Map(selectedUsers.value)
  if (next.has(key)) next.delete(key)
  else next.set(key, member)
  selectedUsers.value = next
}

function toggleAgent(agent) {
  // 团队助手是协作群内置 bot，不允许取消选中
  if (isTeamAssistantAgent(agent)) return
  const next = new Map(selectedAgents.value)
  if (next.has(agent.id)) next.delete(agent.id)
  else next.set(agent.id, agent)
  selectedAgents.value = next
}

function removeSelected(item) {
  if (item.mandatory || isTeamAssistantAgent(item.raw)) return
  if (item.type === 'agent') {
    const next = new Map(selectedAgents.value)
    next.delete(item.raw.id)
    selectedAgents.value = next
  } else {
    const next = new Map(selectedUsers.value)
    next.delete(item.raw.account || item.raw.userId)
    selectedUsers.value = next
  }
}

async function drillDown(node) {
  loading.value = true
  searchQuery.value = ''
  try {
    const [children, profiles] = await Promise.all([
      node.has_children ? fetchDepartmentChildren(node.id) : Promise.resolve([]),
      fetchDepartmentProfiles(node.id),
    ])
    orgStack.value.push({
      id: node.id,
      name: node.name,
      nodes: orgNodes.value,
      profiles: profileMembers.value,
    })
    orgNodes.value = children
    profileMembers.value = profiles
  } catch (e) {
    console.error('[AddGroupMemberDialog] 加载部门成员失败:', e)
    ElMessage.error('成员加载失败，请重试')
  } finally {
    loading.value = false
  }
}

function goToOrgLevel(idx) {
  if (idx === orgStack.value.length - 1) return
  if (idx === -1) {
    const root = orgStack.value[0]
    orgNodes.value = root?.nodes || orgNodes.value
    profileMembers.value = []
    orgStack.value = []
    return
  }
  const target = orgStack.value[idx + 1]
  orgNodes.value = target?.nodes || []
  profileMembers.value = target?.profiles || []
  orgStack.value = orgStack.value.slice(0, idx + 1)
}

function handleClose() {
  if (props.confirmLoading) return
  emit('update:visible', false)
}

function handleConfirm() {
  if (props.confirmLoading) return
  if (isCreateTeamMode.value) {
    emit('confirm', {
      mode: 'create-team',
      name: teamName.value.trim(),
      users: [...selectedUsers.value.values()],
      agents: [...selectedAgents.value.values()],
      members: [...selectedUsers.value.values(), ...selectedAgents.value.values()],
    })
    return
  }
  emit('confirm', {
    mode: props.mode,
    members: props.mode === 'agent'
      ? [...selectedAgents.value.values()]
      : [...selectedUsers.value.values()],
  })
}
</script>

<style scoped>
.group-add-member__team-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 0;
  margin: 0 0 20px;
}

.group-add-member__team-label {
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  line-height: 20px;
}

.group-add-member__team-field {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #edf0f6;
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
}

.group-add-member__team-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #2f3547;
  line-height: 20px;
}

.group-add-member__team-input::placeholder {
  color: #bfc3cc;
}

.group-add-member__team-count {
  flex-shrink: 0;
  color: #c8ccd6;
  font-size: 13px;
  line-height: 18px;
}

.group-add-member__layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: min(404px, calc(100vh - 176px));
  min-height: 280px;
  gap: 8px;
}

.group-add-member__column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f6f6fb;
  border-radius: 12px;
  overflow: hidden;
}

.group-add-member__column--right {
  background: #f6f6fb;
}

.group-add-member__label,
.group-add-member__selected-header {
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  line-height: 20px;
}

.group-add-member__selected-header {
  font-weight: 400;
  color: #a6a6a6;
}

.group-add-member__selected-count {
  margin: 0 4px;
  color: #2F3547;
  font-weight: 600;
}

.group-add-member__picker {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 0 0 8px;
}

.group-add-member__search {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 8px;
  padding: 0 10px;
  background: #fff;
  border-radius: 8px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.group-add-member__search-icon {
  color: #b6bbc6;
}

.group-add-member__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #2f3547;
  line-height: 20px;
}

.group-add-member__search-input::placeholder {
  color: #b6bbc6;
}

.group-add-member__tabs {
  height: 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 8px 8px 4px;
  padding: 2px;
  background: #f2f3f8;
  border-radius: 7px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.group-add-member__tab {
  min-width: 0;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #5f6573;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

.group-add-member__tab--active {
  background: #fff;
  color: #ff5233;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(19, 26, 43, 0.08);
}

.group-add-member__breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 4px;
  min-height: 28px;
  min-width: 0;
  padding: 8px 16px 4px;
  overflow: visible;
  color: #8f959e;
  font-size: 12px;
  line-height: 18px;
}

.group-add-member__breadcrumb span {
  flex: 0 0 auto;
}

.group-add-member__breadcrumb button {
  max-width: calc(100% - 16px);
  flex: 0 0 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  background: transparent;
  padding: 0;
  color: #606572;
  cursor: pointer;
}

.group-add-member__candidate-list,
.group-add-member__selected-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

.group-add-member__candidate,
.group-add-member__selected-row {
  width: 100%;
  min-height: 52px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  box-sizing: border-box;
  overflow: hidden;
}

.group-add-member__candidate {
  width: calc(100% - 16px);
  margin: 0 8px;
  cursor: pointer;
}

.group-add-member__candidate:hover {
  background: rgba(47, 53, 71, 0.06);
}

.group-add-member__checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 1.5px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.group-add-member__checkbox--checked {
  border-color: #ff5233;
  background: #ff5233;
}

.group-add-member__checkbox--dept {
  border-color: transparent;
}

.group-add-member__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.group-add-member__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.group-add-member__name,
.group-add-member__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-add-member__name {
  font-size: 14px;
  font-weight: 400;
  color: rgba(42, 42, 42, 0.9);
  line-height: 20px;
}

.group-add-member__sub {
  font-size: 12px;
  color: rgba(42, 42, 42, 0.4);
  line-height: 20px;
}

.group-add-member__dept-next {
  flex-shrink: 0;
  font-size: 13px;
  color: #ff5233;
}

.group-add-member__selected-row {
  width: calc(100% - 16px);
  min-height: 42px;
  margin: 0 8px 8px;
  padding: 0 8px;
  border-radius: 12px;
}

.group-add-member__selected-row:hover {
  background: rgba(47, 53, 71, 0.06);
}

.group-add-member__selected-remove {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #8f959e;
  font-size: 16px;
  cursor: pointer;
  /* opacity: 0; */
}

.group-add-member__selected-required {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(255, 82, 51, 0.08);
  color: #ff5233;
  font-size: 10px;
  line-height: 18px;
}

/* .group-add-member__selected-row:hover .group-add-member__selected-remove {
  opacity: 1;
} */

.group-add-member__empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: #bfc3cc;
}

.group-add-member__dialog-btn {
  width: 60px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #e6e6e6;
  background: #fff;
  color: #2f3547;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-add-member__dialog-btn:hover {
  background: #e6e6e6;
}

.group-add-member__dialog-btn + .group-add-member__dialog-btn {
  margin-left: 8px;
}

.group-add-member__dialog-btn--confirm {
  background: #1c1a21;
  border-color: #1c1a21;
  color: #fff;
}

.group-add-member__dialog-btn--confirm:hover {
  background: #3d3d3d;
}

.group-add-member__dialog-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.group-add-member__dialog-btn:disabled:hover {
  background: inherit;
}

.group-add-member__dialog-btn--confirm:disabled:hover {
  background: #1c1a21;
}
</style>

<style>
.group-add-member-dialog.el-dialog {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  max-height: calc(100vh - 48px);
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.group-add-member-dialog.el-dialog .el-dialog__header {
  height: 56px;
  padding: 0 24px;
  margin-right: 0;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.group-add-member-dialog.el-dialog .el-dialog__title {
  padding: 0 !important;
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #2f3547 !important;
  line-height: 26px !important;
}

.group-add-member-dialog.el-dialog .el-dialog__headerbtn {
  top: 16px !important;
  right: 20px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: none !important;
  z-index: 2;
}

.group-add-member-dialog.el-dialog .el-dialog__headerbtn:hover {
  background: rgba(23, 27, 38, 0.06);
}

.group-add-member-dialog.el-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #91949E !important;
  font-size: 16px !important;
  font-weight: 700;
}

.group-add-member-dialog.el-dialog .el-dialog__headerbtn .el-dialog__close svg {
  width: 16px;
  height: 16px;
  transform: scale(1.12);
}

.group-add-member-dialog.el-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 24px 12px;
}

.group-add-member-dialog.el-dialog .el-dialog__footer {
  flex-shrink: 0;
  padding: 0 24px 16px;
}

/* 与任务桥 Demo 统一：暖白底、橙色主操作、轻量边框和圆角层级 */
.group-add-member-dialog.el-dialog {
  background: #fffdfb;
  border: 1px solid #f1e5df;
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(91, 67, 55, 0.14);
}

.group-add-member-dialog.el-dialog .el-dialog__header {
  border-bottom: 1px solid #f3e8e2;
}

.group-add-member-dialog.el-dialog .el-dialog__title {
  color: #303746 !important;
}

.group-add-member__team-label,
.group-add-member__label {
  color: #596271;
}

.group-add-member__team-field,
.group-add-member__search {
  border: 1px solid #e5e8ed;
  border-radius: 9px;
}

.group-add-member__team-field:focus-within,
.group-add-member__search:focus-within {
  border-color: #f09a78;
  box-shadow: 0 0 0 3px rgba(255, 98, 31, 0.08);
}

.group-add-member__column,
.group-add-member__column--right {
  background: #fff8f4;
  border: 1px solid #f1e5df;
}

.group-add-member__tabs {
  background: #fff0e9;
}

.group-add-member__tab--active {
  color: #d75c2c;
  box-shadow: 0 1px 4px rgba(255, 98, 31, 0.14);
}

.group-add-member__candidate:hover,
.group-add-member__selected-row:hover {
  background: #fff0e9;
}

.group-add-member__checkbox--checked {
  border-color: #ff621f;
  background: #ff621f;
}

.group-add-member__dept-next {
  color: #e86632;
}

.group-add-member__selected-required {
  background: #fff0e9;
  color: #d75c2c;
}

.group-add-member__dialog-btn--confirm {
  background: #ff621f;
  border-color: #ff621f;
  box-shadow: 0 5px 12px rgba(255, 98, 31, 0.2);
}

.group-add-member__dialog-btn--confirm:hover {
  background: #e95517;
  border-color: #e95517;
}

.group-add-member__dialog-btn--cancel {
  border-color: #e1e5ed;
  color: #697384;
}

.group-add-member__dialog-btn--cancel:hover {
  background: #fff8f4;
}
</style>
