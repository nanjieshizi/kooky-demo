<template>
  <aside class="group-manage" :class="{ 'is-embedded': embedded }" aria-label="群管理">
    <header v-if="!embedded" class="group-manage__head">
      <span class="group-manage__title">群管理</span>
      <button type="button" class="group-manage__close" aria-label="关闭" @click="uiStore.closeGroupRosterSidebar()">
        <SvgIcon name="icon-guanbi1" :size="18" />
      </button>
    </header>

    <section class="group-manage__team-name">
      <div class="group-manage__avatar-stack" aria-hidden="true">
        <img
          v-for="member in avatarPreview"
          :key="getGroupMemberKey(member)"
          :src="memberAvatar(member)"
          alt=""
        />
      </div>
      <input
        v-if="editingName"
        ref="nameInputRef"
        v-model="draftName"
        maxlength="20"
        class="group-manage__team-name-input"
        @blur="submitName"
        @keydown.enter.prevent="nameInputRef?.blur()"
        @keydown.esc.prevent="cancelName"
      />
      <span v-else class="group-manage__team-name-text">{{ currentConversationName }}</span>
      <button v-if="!editingName" type="button" class="group-manage__name-edit-btn" aria-label="编辑群名称" @click="startNameEdit">
        <SvgIcon name="icon-bianjituanduimingcheng" :size="16" />
      </button>
    </section>

    <div class="group-manage__body">
      <section class="group-manage__section">
        <div class="group-manage__section-head">
          <span class="group-manage__section-title">数字人</span>
          <button type="button" class="group-manage__section-add" aria-label="添加数字人" @click="openAddDialog('agent')">
            <SvgIcon name="icon-tianjia" :size="16" />
          </button>
        </div>
        <div v-if="loading && botMembers.length === 0" class="group-manage__empty">加载中…</div>
        <div v-else-if="!loading && botMembers.length === 0" class="group-manage__empty">暂无数字人</div>
        <ul v-else class="group-manage__list">
          <li
            v-for="member in botMembers"
            :key="getGroupMemberKey(member)"
            class="group-manage__row"
          >
            <UserAvatar :member="member" :size="32" placement="left-start" class="group-manage__avatar" />
            <div class="group-manage__main">
              <div class="group-manage__line">
                <span class="group-manage__name">{{ member.displayName || member.name || member.userId }}</span>
              </div>
              <div class="group-manage__sub">数字人</div>
            </div>
            <button
              v-if="isCurrentUserOwner"
              type="button"
              class="group-manage__remove-btn"
              aria-label="删除数字人"
              @click="confirmRemove(member)"
            >
              <el-icon :size="15"><Delete /></el-icon>
            </button>
          </li>
        </ul>
      </section>

      <section class="group-manage__section">
        <div class="group-manage__section-head">
          <span class="group-manage__section-title">真人</span>
          <button type="button" class="group-manage__section-add" aria-label="添加真人" @click="openAddDialog('user')">
            <SvgIcon name="icon-tianjia" :size="16" />
          </button>
        </div>
        <div v-if="loading && humanMembers.length === 0" class="group-manage__empty">加载中…</div>
        <div v-else-if="!loading && humanMembers.length === 0" class="group-manage__empty">暂无真人成员</div>
        <ul v-else class="group-manage__list">
          <li v-for="member in humanMembers" :key="getGroupMemberKey(member)" class="group-manage__row">
            <UserAvatar :member="member" :size="32" placement="left-start" class="group-manage__avatar" />
            <div class="group-manage__main">
              <div class="group-manage__line">
                <span class="group-manage__name">{{ member.displayName || member.name || member.account || member.userId }}</span>
                <span v-if="member.isOwner" class="group-manage__owner-badge">群主</span>
              </div>
              <div class="group-manage__sub">{{ member.projectRole || member.department || member.departmentFull || '—' }}</div>
            </div>
            <button
              v-if="isCurrentUserOwner && !member.isOwner"
              type="button"
              class="group-manage__remove-btn"
              aria-label="删除成员"
              @click="confirmRemove(member)"
            >
              <el-icon :size="15"><Delete /></el-icon>
            </button>
          </li>
        </ul>
      </section>

      <section class="group-manage__section">
        <div class="group-manage__section-head">
          <span class="group-manage__section-title">其他</span>
        </div>
        <div class="group-manage__pref-row">
          <span class="group-manage__pref-icon" aria-hidden="true">
            <el-icon :size="18"><Bell /></el-icon>
          </span>
          <span class="group-manage__pref-label">消息免打扰</span>
          <el-switch v-model="muted" class="group-manage__pref-switch" @change="handleMuteChange" />
        </div>
      </section>
    </div>

    <footer v-if="isCurrentUserOwner" class="group-manage__footer">
      <button type="button" class="group-manage__dissolve-btn" @click="confirmDissolve">解散群聊</button>
    </footer>

    <AddGroupMemberDialog
      :visible="addDialogVisible"
      :mode="addDialogMode"
      :existing-members="members"
      :confirm-loading="saving"
      @update:visible="addDialogVisible = $event"
      @confirm="handleAddMembers"
    />
  </aside>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Delete } from '@element-plus/icons-vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { useGroupStore } from '@/modules/group/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useUserStore } from '@/modules/auth/store'
import { memberAvatarDisplayUrl } from '@/shared/utils/memberAvatar.js'
import defaultAvatar from '@/assets/default-avatar.svg'
import AddGroupMemberDialog from './AddGroupMemberDialog.vue'
import { UserAvatar } from '@/shared/components/user'
import {
  getGroupMemberKey,
  isCurrentUserGroupOwner,
  splitGroupMembers,
} from '@/modules/group/utils/groupTeamPanelMembers.mjs'

defineOptions({ name: 'GroupRosterSidebar' })

const props = defineProps({
  conversationId: { type: String, default: '' },
  // 嵌入会话侧区 manage 槽：隐藏自带头部、宽度撑满（由外层槽提供头）
  embedded: { type: Boolean, default: false },
})

const uiStore = useUIStore()
const groupStore = useGroupStore()
const userStore = useUserStore()

const editingName = ref(false)
const draftName = ref('')
const nameInputRef = ref(null)
const addDialogVisible = ref(false)
const addDialogMode = ref('user')
const saving = ref(false)
const muted = ref(false)

// 免打扰仅做演示用 UI 开关：状态按群 ID 存本地，不接入未读/通知逻辑
const muteStorageKey = (id) => `kooky_group_mute_${id}`

function loadMuteState() {
  if (!props.conversationId) {
    muted.value = false
    return
  }
  try {
    muted.value = localStorage.getItem(muteStorageKey(props.conversationId)) === '1'
  } catch {
    muted.value = false
  }
}

function handleMuteChange(val) {
  if (!props.conversationId) return
  try {
    if (val) localStorage.setItem(muteStorageKey(props.conversationId), '1')
    else localStorage.removeItem(muteStorageKey(props.conversationId))
  } catch (e) {
    console.error('[GroupRosterSidebar] 保存免打扰状态失败:', e)
  }
}

watch(
  () => props.conversationId,
  () => {
    editingName.value = false
    addDialogVisible.value = false
    loadMuteState()
  },
  { immediate: true },
)

watch(
  () => [props.conversationId, uiStore.groupRosterTab],
  ([rid, tab]) => {
    if (tab && rid) void groupStore.loadConversationMembers(rid, { force: true })
  },
  { immediate: true },
)

const conversation = computed(() => groupStore.conversations.find((item) => item.conversationId === props.conversationId))
const currentConversationName = computed(() => conversation.value?.name || '群名称')
const members = computed(() => (props.conversationId ? groupStore.conversationMembers[props.conversationId] ?? [] : []))
const loading = computed(() => !!groupStore.conversationMembersLoading[props.conversationId])
const splitMembers = computed(() => splitGroupMembers(members.value))
const humanMembers = computed(() => splitMembers.value.humans)
const botMembers = computed(() => splitMembers.value.bots)
const avatarPreview = computed(() => members.value.slice(0, 4))
const isCurrentUserOwner = computed(() => isCurrentUserGroupOwner(members.value, userStore.userInfo))

function memberAvatar(member) {
  return memberAvatarDisplayUrl(member) || member.avatar || member.avatarHttpUrl || defaultAvatar
}

function startNameEdit() {
  draftName.value = currentConversationName.value
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

async function submitName() {
  const name = draftName.value.trim()
  if (!name || name === currentConversationName.value) {
    cancelName()
    return
  }
  try {
    await groupStore.renameGroup(props.conversationId, name)
    const targetConversation = groupStore.conversations.find((item) => item.conversationId === props.conversationId)
    if (targetConversation) targetConversation.name = name
    cancelName()
    ElMessage.success('群名称已更新')
  } catch (e) {
    console.error('[GroupRosterSidebar] 更新团队名称失败:', e)
    ElMessage.error('更新失败，请重试')
  }
}

function openAddDialog(mode) {
  addDialogMode.value = mode
  addDialogVisible.value = true
}

async function handleAddMembers({ mode, members: addedMembers }) {
  if (!addedMembers?.length || !props.conversationId || saving.value) return

  // 只传新增的人，使用增量邀请接口
  const usernames = []
  const agentParticipantIds = []

  if (mode === 'agent') {
    for (const agent of addedMembers) {
      const participantId = agent.imBotId ?? agent.participantId ?? agent.participant_id
      if (participantId === undefined || participantId === null || participantId === '') continue
      agentParticipantIds.push(participantId)
    }
  } else {
    for (const member of addedMembers) {
      const account = member.account ?? member.username
      if (account) usernames.push(account)
    }
  }

  if (usernames.length === 0 && agentParticipantIds.length === 0) return

  saving.value = true
  try {
    await groupStore.inviteMembers(props.conversationId, { usernames, agentParticipantIds })
    // WebSocket 的 member.joined 事件会自动触发成员列表刷新，无需手动调用
    ElMessage.success('添加成员成功')
    addDialogVisible.value = false
  } catch (e) {
    console.error('[GroupRosterSidebar] 添加成员失败:', e)
    ElMessage.error('添加失败，请重试')
  } finally {
    saving.value = false
  }
}

async function confirmRemove(member) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${member.displayName || member.name || member.account || member.userId}」吗？`,
      '删除成员',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'group-manage-confirm-dialog',
      },
    )

    if (!props.conversationId || saving.value) return

    const isAgent = String(member?.type || '').toLowerCase() === 'agent'
    const usernames = []
    const agentParticipantIds = []
    if (isAgent) {
      const participantId = member.imBotId ?? member.participantId ?? member.participant_id ?? member.userId
      if (participantId !== undefined && participantId !== null && participantId !== '') {
        agentParticipantIds.push(participantId)
      }
    } else {
      const account = member.account ?? member.username
      if (account) usernames.push(account)
    }

    if (usernames.length === 0 && agentParticipantIds.length === 0) {
      ElMessage.error('成员信息不完整，无法删除')
      return
    }

    saving.value = true
    try {
      await groupStore.removeMembers(props.conversationId, { usernames, agentParticipantIds })
      await groupStore.loadConversationMembers(props.conversationId, { force: true })
      await groupStore._loadConversations(props.conversationId)
      ElMessage.success('成员已移除')
    } finally {
      saving.value = false
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[GroupRosterSidebar] 删除成员失败:', e)
      ElMessage.error('删除失败，请重试')
    }
  }
}

async function confirmDissolve() {
  try {
    await ElMessageBox.confirm(
      '解散后所有对话记录及文件将永久删除，请谨慎操作。',
      '您确认要解散当前群聊吗？',
      {
        confirmButtonText: '解散',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'group-manage-confirm-dialog',
      },
    )
    await groupStore.dissolveGroup(props.conversationId)
    uiStore.closeGroupRosterSidebar()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[GroupRosterSidebar] 解散群聊失败:', e)
      ElMessage.error('解散失败，请重试')
    }
  }
}
</script>

<style scoped>
.group-manage {
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
.group-manage.is-embedded {
  width: 100%;
  border-radius: 0;
}

.group-manage__head {
  height: 50px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.group-manage__title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.group-manage__close,
.group-manage__name-edit-btn,
.group-manage__section-add,
.group-manage__remove-btn {
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

.group-manage__close:hover,
.group-manage__name-edit-btn:hover,
.group-manage__section-add:hover,
.group-manage__remove-btn:hover {
  background: #f3f4f7;
  color: #2f3547;
}

.group-manage__team-name {
  min-height: 48px;
  padding: 0 16px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.group-manage__avatar-stack {
  width: 42px;
  height: 36px;
  display: grid;
  grid-template-columns: repeat(2, 18px);
  grid-template-rows: repeat(2, 18px);
  gap: 2px;
  flex-shrink: 0;
}

.group-manage__avatar-stack img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
}

.group-manage__team-name-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-manage__team-name-input {
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

.group-manage__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.group-manage__section + .group-manage__section {
  margin-top: 12px;
}

.group-manage__section-head {
  height: 36px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-manage__section-title {
  font-size: 13px;
  font-weight: 600;
  color: #8f95a3;
}

.group-manage__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.group-manage__row {
  position: relative;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 32px 6px 10px;
  border-radius: 10px;
  box-sizing: border-box;
}

.group-manage__row:hover {
  background: #f7f8fb;
}

.group-manage__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.group-manage__main {
  min-width: 0;
  flex: 1;
}

.group-manage__line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.group-manage__name,
.group-manage__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-manage__name {
  font-size: 14px;
  color: #2f3547;
}

.group-manage__sub {
  margin-top: 2px;
  font-size: 12px;
  color: #a0a5b0;
}

.group-manage__owner-badge {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 4px;
  background: #fff0e8;
  color: #ff5a2f;
  font-size: 11px;
  line-height: 18px;
}

.group-manage__remove-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  color: #a0a5b0;
}

.group-manage__row:hover .group-manage__remove-btn {
  opacity: 1;
}

.group-manage__empty {
  padding: 18px 8px;
  text-align: center;
  font-size: 12px;
  color: #a0a5b0;
}

.group-manage__pref-row {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 10px;
  box-sizing: border-box;
}

.group-manage__pref-row:hover {
  background: #f7f8fb;
}

.group-manage__pref-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f3f4f7;
  color: #8f95a3;
  flex-shrink: 0;
}

.group-manage__pref-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #2f3547;
}

.group-manage__pref-switch {
  flex-shrink: 0;
  --el-switch-on-color: #1c1a21;
}

.group-manage__footer {
  height: 64px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.group-manage__dissolve-btn {
  border: none;
  background: transparent;
  color: #ff4d4f;
  font-size: 14px;
  cursor: pointer;
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
  border-color: #ff4d4f;
  background: #ff4d4f;
  color: #fff;
}

</style>
