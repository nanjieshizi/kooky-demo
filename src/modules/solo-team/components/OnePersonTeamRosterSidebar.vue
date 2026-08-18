<template>
  <aside class="op-team-manage" :class="{ 'is-embedded': embedded }" aria-label="团队管理">
    <header v-if="!embedded" class="op-team-manage__head">
      <span class="op-team-manage__title">会话管理</span>
      <button type="button" class="op-team-manage__close" aria-label="关闭" @click="emit('close')">
        <SvgIcon name="icon-guanbi1" :size="18" />
      </button>
    </header>

    <section class="op-team-manage__team-name">
      <div class="op-team-manage__avatar-stack" aria-hidden="true">
        <img
          v-for="item in teamAvatarPreview"
          :key="item.key"
          :src="item.avatar"
          alt=""
          @error="onTeamAvatarError($event, item.fallback)"
        />
      </div>
      <input
        v-if="editingName"
        ref="nameInputRef"
        v-model="draftName"
        maxlength="20"
        class="op-team-manage__team-name-input"
        @blur="submitName"
        @keydown.enter.prevent="nameInputRef?.blur()"
        @keydown.esc.prevent="cancelName"
      />
      <span v-else class="op-team-manage__team-name-text">{{ teamName || '团队名称' }}</span>
      <button v-if="!editingName" type="button" class="op-team-manage__name-edit-btn" aria-label="编辑团队名称" @click="startNameEdit">
        <SvgIcon name="icon-bianjituanduimingcheng" :size="16" />
      </button>
    </section>

    <section class="op-team-manage__description">
      <div class="op-team-manage__description-head">
        <span class="op-team-manage__description-title">描述</span>
        <button v-if="!editingDescription" type="button" class="op-team-manage__description-edit-btn" aria-label="编辑团队描述" @click="startDescriptionEdit">
          <SvgIcon name="icon-bianjituanduimingcheng" :size="16" />
        </button>
      </div>
      <div v-if="editingDescription" class="op-team-manage__description-editor">
        <textarea
          ref="descriptionInputRef"
          v-model="draftDescription"
          maxlength="200"
          class="op-team-manage__description-input"
          @blur="submitDescription"
          @keydown.esc.prevent="cancelDescription"
        />
        <span class="op-team-manage__description-count">{{ draftDescription.length }}/200</span>
      </div>
      <p v-else class="op-team-manage__description-text">{{ teamDescription }}</p>
    </section>

    <div class="op-team-manage__body">
      <section class="op-team-manage__section">
        <div class="op-team-manage__section-head">
          <span class="op-team-manage__section-title">参与成员</span>
        </div>
        <ul class="op-team-manage__list">
          <li v-if="!participantMembers.length" class="op-team-manage__empty">暂无成员出场 · 下需求后分身会拉合适的人加入</li>
          <li v-for="member in participantMembers" :key="member.id" class="op-team-manage__row">
            <span class="op-team-manage__avatar-wrap">
              <img :src="member.avatar || defaultAgentAvatar" alt="" class="op-team-manage__avatar" @error="onAvatarError" />
              <span
                v-if="member.presence"
                class="op-team-manage__presence"
                :class="`op-team-manage__presence--${member.presence}`"
              />
            </span>
            <div class="op-team-manage__main">
              <div class="op-team-manage__line">
                <span class="op-team-manage__name">{{ member.name || `Agent ${member.id}` }}</span>
              </div>
              <div class="op-team-manage__sub">{{ member.description || '数字员工' }}</div>
            </div>
          </li>
        </ul>
        <p style="margin:8px 2px 0; font-size:11px; color:#8c93a6; line-height:1.5;">成员的添加 / 配置 / 市场聘用请去「数字人管理」，这里只看本会话出场了谁。</p>
      </section>

      <section class="op-team-manage__section">
        <div class="op-team-manage__section-head">
          <span class="op-team-manage__section-title">真人</span>
        </div>
        <ul class="op-team-manage__list">
          <li class="op-team-manage__row">
            <img :src="userAvatar || defaultAvatar" alt="" class="op-team-manage__avatar" @error="onAvatarError" />
            <div class="op-team-manage__main">
              <div class="op-team-manage__line">
                <span class="op-team-manage__name">{{ userName || '我' }}</span>
                <span class="op-team-manage__badge op-team-manage__badge--owner">本人</span>
              </div>
              <div class="op-team-manage__sub">当前登录用户</div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <footer class="op-team-manage__footer">
      <button type="button" class="op-team-manage__dissolve-btn" @click="confirmDissolve">删除会话</button>
    </footer>

    <AddDigitalEmployeeDialog
      v-model:visible="addDialogVisible"
      :existing-agent-ids="existingAgentIds"
      :coordinator-id="coordinatorId"
      :confirm-loading="saving"
      @confirm="handleAddAgents"
    />
  </aside>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { useSoloTeamStore } from '../store'
import { useUserStore } from '@/modules/auth/store'
import { demoState, emergedMembers } from '../demo/onePersonDirector'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import defaultAvatar from '@/assets/default-avatar.svg'
import AddDigitalEmployeeDialog from './AddDigitalEmployeeDialog.vue'
import { resolveEmployeePresence } from '../utils/employeePresence'

defineOptions({ name: 'OnePersonTeamRosterSidebar' })

const props = defineProps({
  teamId: { type: [String, Number], default: '' },
  // 嵌入会话侧区 manage 槽：隐藏自带头部、宽度撑满
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'dissolved'])

const soloTeamStore = useSoloTeamStore()
const userStore = useUserStore()
// 本会话参与成员（只读）= 任务参与者 ∪ 被 @ 出场的；员工的增删/配置/聘用去「数字人管理」
const participantMembers = computed(() => {
  const out = []
  const seen = new Set()
  const add = (m) => {
    const id = String(m.agentId ?? m.agent_id ?? m.id ?? '')
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push({
      id,
      name: m.name || m.display_name || '',
      avatar: m.avatar || m.avatar_url || '',
      description: m.description || '',
      presence: m.presence,
    })
  }
  if (String(demoState.teamId) === teamKey.value && demoState.taskObj) {
    (demoState.taskObj.participants || []).forEach(add)
  }
  const byId = new Map((agentMembers.value || []).map((m) => [String(m.id), m]))
  ;(emergedMembers[teamKey.value] || []).forEach((id) => { const m = byId.get(String(id)); if (m) add(m) })
  return out
})

const editingName = ref(false)
const editingDescription = ref(false)
const draftName = ref('')
const draftDescription = ref('')
const skipDescriptionSubmit = ref(false)
const nameInputRef = ref(null)
const descriptionInputRef = ref(null)
const addDialogVisible = ref(false)
const saving = ref(false)

const teamKey = computed(() => (props.teamId ? String(props.teamId) : ''))
const team = computed(() => {
  if (!teamKey.value) return null
  return soloTeamStore.teamDetailById[teamKey.value]
    || soloTeamStore.onePersonTeams.find((item) => String(item?.id) === teamKey.value || String(item?.teamId) === teamKey.value)
    || null
})
const loading = computed(() => Boolean(teamKey.value && soloTeamStore.teamDetailLoadingById[teamKey.value]))
const teamName = computed(() => team.value?.name || '')
const teamDescription = computed(() => String(team.value?.description || '').trim())
const coordinatorId = computed(() => team.value?.coordinatorId ?? team.value?.coordinator_id ?? null)
const memberIds = computed(() => {
  if (Array.isArray(team.value?.memberIds) && team.value.memberIds.length) return team.value.memberIds
  const members = Array.isArray(team.value?.members) ? team.value.members : []
  return members.map((m) => m?.agent_id ?? m?.agentId).filter((id) => id != null)
})

const agentIndex = computed(() => {
  const map = new Map()
  for (const agent of soloTeamStore.privateAgents || []) {
    if (agent?.id != null) map.set(String(agent.id), agent)
  }
  for (const employee of soloTeamStore.employeeChatEmployees || []) {
    if (employee?.id != null && !map.has(String(employee.id))) {
      map.set(String(employee.id), employee)
    }
  }
  return map
})

const runtimeMemberIndex = computed(() => {
  const map = new Map()
  const members = teamKey.value ? soloTeamStore.onePersonMembersByTeamId?.[teamKey.value] || [] : []
  for (const member of members) {
    const id = member?.agentId ?? member?.agent_id ?? member?.id
    if (id != null) map.set(String(id), member)
  }
  return map
})

function asAgentEntry(id, overrides = {}) {
  const key = String(id)
  const cached = agentIndex.value.get(key)
  const runtimeMember = runtimeMemberIndex.value.get(key)
  return {
    id: key,
    name: cached?.name || runtimeMember?.name || overrides.name || '',
    avatar: cached?.avatar || cached?.icon || runtimeMember?.avatar || overrides.avatar || '',
    description: cached?.description || runtimeMember?.description || overrides.description || '',
    presence: resolveEmployeePresence(runtimeMember, resolveEmployeePresence(cached, 'idle')),
    isCoordinator: overrides.isCoordinator || false,
    raw: runtimeMember?.raw || cached?.raw || runtimeMember || cached || null,
  }
}

const agentMembers = computed(() => {
  if (!team.value) return []
  const list = []
  for (const id of memberIds.value) {
    if (id == null) continue
    if (coordinatorId.value != null && String(id) === String(coordinatorId.value)) continue
    list.push(asAgentEntry(id))
  }
  return list
})

const existingAgentIds = computed(() => agentMembers.value.map((m) => String(m.id)))
const personalDefaultAssistantIds = computed(() => {
  const ids = new Set()
  for (const agent of soloTeamStore.privateAgents || []) {
    if (isPersonalDefaultAssistant(agent) && agent?.id != null) ids.add(String(agent.id))
  }
  return ids
})

const userName = computed(() => userStore.userName || userStore.userInfo?.userName || '我')
const userAvatar = computed(() => userStore.avatar || '')

const teamAvatarPreview = computed(() => {
  const avatars = [{
    key: 'user',
    avatar: userAvatar.value || defaultAvatar,
    fallback: defaultAvatar,
  }]
  for (const member of agentMembers.value) {
    if (avatars.length >= 4) break
    avatars.push({
      key: `agent-${member.id}`,
      avatar: member.avatar || defaultAgentAvatar,
      fallback: defaultAgentAvatar,
    })
  }
  return avatars.slice(0, 4)
})

watch(
  () => props.teamId,
  (id) => {
    editingName.value = false
    editingDescription.value = false
    addDialogVisible.value = false
    if (id) {
      soloTeamStore.setCurrentOnePersonTeamId(id)
      void soloTeamStore.loadOnePersonTeamDetail(id, { force: true })
      void soloTeamStore.loadPrivateAgentsForTeam({ force: true })
    }
  },
  { immediate: true },
)

function onAvatarError(e) {
  if (e?.target) e.target.src = defaultAgentAvatar
}

function onTeamAvatarError(e, fallback) {
  if (e?.target) e.target.src = fallback || defaultAgentAvatar
}

function startNameEdit() {
  draftName.value = teamName.value
  editingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

function cancelName() {
  editingName.value = false
  draftName.value = ''
}

function startDescriptionEdit() {
  draftDescription.value = teamDescription.value
  skipDescriptionSubmit.value = false
  editingDescription.value = true
  nextTick(() => {
    descriptionInputRef.value?.focus()
    descriptionInputRef.value?.select()
  })
}

function closeDescriptionEditor() {
  editingDescription.value = false
  draftDescription.value = ''
}

function cancelDescription() {
  skipDescriptionSubmit.value = true
  closeDescriptionEditor()
}

async function submitName() {
  const name = draftName.value.trim()
  if (!name || name === teamName.value) {
    cancelName()
    return
  }
  try {
    await soloTeamStore.updateCurrentOnePersonTeam({ name })
    ElMessage.success('团队名称已更新')
  } catch (e) {
    console.error('[OnePersonTeamRosterSidebar] 更新团队名称失败:', e)
    ElMessage.error(soloTeamApiErrorMessage(e, '更新失败，请重试'))
  } finally {
    cancelName()
  }
}

async function submitDescription() {
  if (skipDescriptionSubmit.value) {
    skipDescriptionSubmit.value = false
    return
  }
  const description = draftDescription.value.trim()
  if (description === teamDescription.value) {
    closeDescriptionEditor()
    return
  }
  try {
    await soloTeamStore.updateCurrentOnePersonTeam({ description })
    ElMessage.success('团队描述已更新')
  } catch (e) {
    console.error('[OnePersonTeamRosterSidebar] 更新团队描述失败:', e)
    ElMessage.error(soloTeamApiErrorMessage(e, '更新失败，请重试'))
  } finally {
    closeDescriptionEditor()
  }
}

function openAddDialog() {
  addDialogVisible.value = true
}

function isPersonalDefaultAssistant(agent) {
  const raw = agent?.raw || agent || {}
  return Boolean(
    agent?.isDefault
      ?? raw?.is_default
      ?? raw?.isDefault
      ?? false
  )
}

function shouldOmitMemberId(id) {
  if (id == null) return true
  const key = String(id)
  if (coordinatorId.value != null && key === String(coordinatorId.value)) return true
  if (personalDefaultAssistantIds.value.has(key)) return true
  const cached = agentIndex.value.get(key)
  return cached ? isPersonalDefaultAssistant(cached) : false
}

function normalizeMemberIdsForPayload(ids) {
  const result = []
  const seen = new Set()
  for (const id of ids || []) {
    if (shouldOmitMemberId(id)) continue
    const key = String(id)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

async function handleAddAgents(agents) {
  if (!agents?.length) return
  const next = new Set(memberIds.value.map(String))
  for (const agent of agents) {
    if (agent?.id != null) next.add(String(agent.id))
  }
  await persistMemberIds([...next])
  addDialogVisible.value = false
}

async function confirmRemoveAgent(member) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${member.name || member.id}」吗？`,
      '删除成员',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'group-manage-confirm-dialog',
      },
    )
    const next = memberIds.value.map(String).filter((id) => id !== String(member.id))
    await persistMemberIds(next)
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error('[OnePersonTeamRosterSidebar] 移除成员失败:', e)
    ElMessage.error(soloTeamApiErrorMessage(e, '移除失败，请重试'))
  }
}

async function persistMemberIds(ids) {
  if (saving.value) return
  saving.value = true
  try {
    const normalizedIds = normalizeMemberIdsForPayload(ids)
    await soloTeamStore.updateCurrentOnePersonTeam({ memberIds: normalizedIds })
    ElMessage.success('团队成员已更新')
  } catch (e) {
    console.error('[OnePersonTeamRosterSidebar] 更新成员失败:', e)
    ElMessage.error(soloTeamApiErrorMessage(e, '更新失败，请重试'))
    throw e
  } finally {
    saving.value = false
  }
}

async function confirmDissolve() {
  try {
    await ElMessageBox.confirm(
      '解散后所有对话记录及文件将永久删除，请谨慎操作。',
      '您确认要解散当前团队吗？',
      {
        confirmButtonText: '解散',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'group-manage-confirm-dialog',
      },
    )
    await soloTeamStore.dissolveCurrentOnePersonTeam()
    ElMessage.success('团队已解散')
    emit('dissolved', teamKey.value)
    emit('close')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error('[OnePersonTeamRosterSidebar] 解散团队失败:', e)
    ElMessage.error(soloTeamApiErrorMessage(e, '解散失败，请重试'))
  }
}
</script>

<style scoped>
.op-team-manage.is-embedded {
  width: 100%;
}
.op-team-manage {
  flex-shrink: 0;
  width: 256px;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-sizing: border-box;
}

.op-team-manage__head {
  height: 50px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.op-team-manage__title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.op-team-manage__close,
.op-team-manage__name-edit-btn,
.op-team-manage__description-edit-btn,
.op-team-manage__section-add,
.op-team-manage__remove-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8f95a3;
  cursor: pointer;
}

.op-team-manage__close:hover,
.op-team-manage__name-edit-btn:hover,
.op-team-manage__description-edit-btn:hover,
.op-team-manage__section-add:hover {
  background: #f3f4f7;
  color: #2f3547;
}

.op-team-manage__remove-btn:hover {
  background: #f3f4f7;
  color: #2f3547;
}

.op-team-manage__team-name {
  min-height: 48px;
  padding: 0 16px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.op-team-manage__avatar-stack {
  width: 40px;
  height: 40px;
  background: #ECEEF3;
  border-radius: 9px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, 17px);
  grid-template-rows: repeat(2, 17px);
  gap: 2px;
  place-content: center;
  place-items: center;
}

.op-team-manage__avatar-stack img {
  width: 17px;
  height: 17px;
  border-radius: 6px;
  object-fit: cover;
}

.op-team-manage__team-name-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.op-team-manage__team-name-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dde1e8;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
  color: #2f3547;
}

.op-team-manage__team-name-input:focus {
  border-color: #ff5233;
}

.op-team-manage__description {
  flex-shrink: 0;
  padding: 0 16px 12px;
}

.op-team-manage__description-head {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-team-manage__description-title {
  font-size: 13px;
  font-weight: 600;
  color: #8f95a3;
}

.op-team-manage__description-text {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: #2f3547;
  white-space: pre-wrap;
  word-break: break-word;
}

.op-team-manage__description-editor {
  position: relative;
  margin-top: 4px;
}

.op-team-manage__description-input {
  width: 100%;
  height: 88px;
  padding: 8px 10px 20px;
  box-sizing: border-box;
  border: 1px solid #dde1e8;
  border-radius: 8px;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  color: #2f3547;
  background: #fff;
}

.op-team-manage__description-input:focus {
  border-color: #ff5233;
}

.op-team-manage__description-count {
  position: absolute;
  right: 10px;
  bottom: 6px;
  font-size: 10px;
  color: #a0a5b0;
  pointer-events: none;
}

.op-team-manage__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.op-team-manage__section + .op-team-manage__section {
  margin-top: 12px;
}

.op-team-manage__section-head {
  height: 36px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-team-manage__section-title {
  font-size: 13px;
  font-weight: 600;
  color: #8f95a3;
}

.op-team-manage__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.op-team-manage__row {
  position: relative;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 32px 6px 10px;
  border-radius: 10px;
  box-sizing: border-box;
}

.op-team-manage__row:hover {
  background: #f7f8fb;
}

.op-team-manage__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  flex-shrink: 0;
}

.op-team-manage__avatar-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.op-team-manage__presence {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 7px;
  height: 7px;
  border: 2px solid #FFFFFF;
  border-radius: 50%;
  box-sizing: content-box;
  pointer-events: none;
}

.op-team-manage__presence--busy {
  background: #FF621F;
}

.op-team-manage__presence--idle {
  background: #07C160;
}

.op-team-manage__main {
  min-width: 0;
  flex: 1;
}

.op-team-manage__line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.op-team-manage__name,
.op-team-manage__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.op-team-manage__name {
  font-size: 14px;
  color: #2f3547;
}

.op-team-manage__sub {
  margin-top: 2px;
  font-size: 12px;
  color: #a0a5b0;
}

.op-team-manage__badge {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
}

.op-team-manage__badge--owner {
  background: #fff0e8;
  color: #ff5a2f;
}

.op-team-manage__remove-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  color: #a0a5b0;
}

.op-team-manage__row:hover .op-team-manage__remove-btn {
  opacity: 1;
}

.op-team-manage__empty {
  padding: 18px 8px;
  text-align: center;
  font-size: 12px;
  color: #a0a5b0;
  list-style: none;
}

.op-team-manage__footer {
  flex-shrink: 0;
  height: 64px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.op-team-manage__dissolve-btn {
  border: none;
  background: transparent;
  color: #ff4d4f;
  font-size: 14px;
  cursor: pointer;
}

.op-team-manage__dissolve-btn:hover {
  background: transparent;
}
</style>

<style>
.group-manage-confirm-dialog.el-message-box {
  border-radius: 12px;
  padding: 20px 24px;
  overflow: hidden;
}

.group-manage-confirm-dialog .el-message-box__header {
  padding: 0 0 12px;
}

.group-manage-confirm-dialog .el-message-box__title {
  padding-left: 30px;
  font-size: 16px;
  font-weight: 600;
  color: #2f3547;
  line-height: 22px;
}

.group-manage-confirm-dialog .el-message-box__headerbtn {
  top: 0;
  right: 0;
}

.group-manage-confirm-dialog .el-message-box__content {
  padding: 0 0 16px;
}

.group-manage-confirm-dialog .el-message-box__container {
  min-height: 44px;
}

.group-manage-confirm-dialog .el-message-box__message {
  padding-left: 30px;
  font-size: 14px;
  color: #606572;
  line-height: 22px;
}

.group-manage-confirm-dialog .el-message-box__status {
  position: absolute;
  top: 20px;
  color: #ff7d00;
}

.group-manage-confirm-dialog .el-message-box__btns {
  padding: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.group-manage-confirm-dialog .el-message-box__btns .el-button {
  height: 32px;
  min-width: 60px;
  margin: 0;
  padding: 0 18px;
  border-radius: 6px;
  font-size: 14px;
}

.group-manage-confirm-dialog .el-message-box__btns .el-button--default {
  border-color: #e6e6e6;
  background: #fff;
  color: #2F3547;
}

.group-manage-confirm-dialog .el-message-box__btns .el-button--primary {
  border-color: #1c1a21;
  background: #1c1a21;
  color: #fff;
}

.group-manage-confirm-dialog .el-message-box__btns .el-button--primary:hover,
.group-manage-confirm-dialog .el-message-box__btns .el-button--primary:focus {
  border-color: #2e323c;
  background: #2e323c;
  color: #fff;
}
</style>
