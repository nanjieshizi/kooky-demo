<template>
  <el-dialog
    :model-value="visible"
    title="新建会话"
    width="800px"
    class="create-solo-team-dialog"
    :close-on-click-modal="false"
    :show-close="true"
    @close="handleClose"
  >
    <div class="solo-team-form">
      <div class="form-row form-row--name">
        <label class="form-label required">会话名称</label>
        <div class="name-field-wrap">
          <div class="text-field" :class="{ 'is-error': !!teamNameError }">
            <input
              v-model="teamName"
              class="text-input"
              type="text"
              maxlength="15"
              placeholder="请输入会话名称"
            />
            <span class="text-count">{{ teamName.length }}/15</span>
          </div>
          <div v-if="teamNameError" class="form-error">{{ teamNameError }}</div>
        </div>
      </div>

      <div class="form-row form-row--description">
        <label class="form-label">会话描述</label>
        <div class="description-field">
          <textarea
            v-model="teamDescription"
            class="description-input"
            maxlength="200"
            placeholder="请输入会话描述（选填）"
          />
          <span class="description-count">{{ teamDescription.length }}/200</span>
        </div>
      </div>

      <!-- 合并后·形态1：会话成员固定 = 全体员工（我的分身 + 聘用的数字员工），不再勾选选人。
           员工隐性待命，靠 @ 或分身调度出场。 -->
      <div class="form-row form-row--members-hint">
        <label class="form-label">团队成员</label>
        <div class="members-fixed-hint">
          你聘用的数字员工会自动编入这条会话，平时后台待命，需要谁 @ 他或交给分身调度即可。
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button type="button" class="btn-cancel" @click="handleClose">取消</button>
        <button
          type="button"
          class="btn-confirm"
          :disabled="!canCreate || loading"
          @click="handleCreate"
        >
          确定
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import { useSoloTeamStore } from '../store'
import { useFileStore } from '@/modules/file/store'
import { createOnePersonTeam, fetchAvailableAgents } from '../service'
import { soloTeamApiErrorMessage } from '../utils/apiErrorMessage'

const props = defineProps({
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['close', 'created'])
const soloTeamStore = useSoloTeamStore()
const fileStore = useFileStore()

const teamName = ref('')
const teamDescription = ref('')
const agents = ref([])
const selectedAgentIds = ref([])
const agentsLoading = ref(false)
const loading = ref(false)
const serverTeamNameError = ref('')

const selectedAgents = computed(() =>
  selectedAgentIds.value
    .map((id) => agents.value.find((agent) => agent.id === id))
    .filter(Boolean),
)

const normalizedTeamName = computed(() => normalizeTeamName(teamName.value))
const isTeamNameDuplicated = computed(() => {
  const name = normalizedTeamName.value
  if (!name) return false
  return (soloTeamStore.onePersonTeams || []).some(team => normalizeTeamName(team?.name) === name)
})
const teamNameError = computed(() => {
  if (isTeamNameDuplicated.value) return '会话名称已存在，请修改后再继续'
  return serverTeamNameError.value
})
const canCreate = computed(() =>
  normalizedTeamName.value.length > 0 && !teamNameError.value,
)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      void loadAgents()
      void soloTeamStore.loadOnePersonTeamsFromApi()
    }
  },
)

watch(teamName, () => {
  serverTeamNameError.value = ''
})

function normalizeTeamName(value) {
  return String(value || '').trim()
}

function isSelected(agentId) {
  return selectedAgentIds.value.includes(agentId)
}

function toggleAgent(agent) {
  const index = selectedAgentIds.value.indexOf(agent.id)
  if (index === -1) {
    selectedAgentIds.value.push(agent.id)
  } else {
    selectedAgentIds.value.splice(index, 1)
  }
}

function removeAgent(agentId) {
  const index = selectedAgentIds.value.indexOf(agentId)
  if (index !== -1) {
    selectedAgentIds.value.splice(index, 1)
  }
}

function resetForm() {
  teamName.value = ''
  teamDescription.value = ''
  selectedAgentIds.value = []
  serverTeamNameError.value = ''
  loading.value = false
}

function handleClose() {
  resetForm()
  emit('close')
}

function handleAvatarError(event) {
  event.target.src = defaultAgentAvatar
}
let agengtList = [];
async function loadAgents() {
  agentsLoading.value = true
  try {
    agengtList = await fetchAvailableAgents()
    agents.value = agengtList.filter(agent => !agent.isDefault)
  } catch (error) {
    console.error('加载员工列表失败:', error)
    ElMessage.error(soloTeamApiErrorMessage(error, '加载员工列表失败'))
  } finally {
    agentsLoading.value = false
  }
}

async function handleCreate() {
  if (teamNameError.value) return
  if (!canCreate.value || loading.value) return

  loading.value = true
  try {
    const coordinatorAgent = agengtList.find(agent => agent.isDefault)
    if (!coordinatorAgent) {
      ElMessage.warning('请选择有状态员工作为协调者')
      return
    }

    const name = normalizedTeamName.value
    const description = teamDescription.value.trim()
    const result = await createOnePersonTeam({
      name,
      description,
      coordinatorId: coordinatorAgent.id,
      // 形态1：会话成员固定=全体员工（不勾选，agents 已过滤掉 default 分身）
      memberIds: agents.value.map(agent => agent.id),
    })
    const teamId = result.teamId ?? result.id

    emit('created', {
      teamId,
      team: {
        ...result,
        id: teamId,
        teamId,
        name: result.name || name,
        description,
      },
    })
    ElMessage.success('创建会话成功')
    // 刷新文件树
    fileStore.invalidateCloudNode('category_opt')
    window.dispatchEvent(new CustomEvent('files-uploaded-to-tree', {
      detail: { spaceId: teamId, roomType: 'super_person_chat' },
    }))
    handleClose()
  } catch (error) {
    console.error('创建一人团队失败:', error)
    const message = soloTeamApiErrorMessage(error, '创建一人团队失败，请重试')
    if (isDuplicateNameError(error, message)) {
      serverTeamNameError.value = '会话名称已存在，请修改后再继续'
      return
    }
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

function isDuplicateNameError(error, message = '') {
  const status = error?.response?.status ?? error?.status
  const text = String(message || error?.response?.data?.message || error?.message || '')
  return Number(status) === 409 || /团队名称.*(已存在|重复)|已存在/.test(text)
}
</script>

<style lang="scss" scoped>
.solo-team-form {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-row .form-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
  color: #2f3547;
  text-align: left;
  white-space: nowrap;
}

.form-row > :not(.form-label) {
  flex: 1;
  min-width: 0;
}

.form-row--members {
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.form-row--description {
  align-items: flex-start;
}

.form-row--name {
  align-items: flex-start;
}

.form-row--members .form-label {
  align-self: flex-start;
  padding-top: 8px;
}

.form-row--name .form-label {
  padding-top: 8px;
}

.form-row--description .form-label {
  padding-top: 8px;
}

.form-label.required::after {
  content: '*';
  margin-left: 2px;
  color: #f56c6c;
}

.text-field {
  position: relative;
}

.name-field-wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-input {
  width: 100%;
  height: 32px;
  padding: 0 54px 0 16px;
  box-sizing: border-box;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  color: #0a0e23;
  background: #fff;
  transition: all 0.2s;
}

.text-input:focus {
  border-color: #8478fa;
  background: #fff;
}

.text-field.is-error .text-input,
.text-field.is-error .text-input:focus {
  border-color: #ff4d4f;
}

.text-input::placeholder {
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: rgba(10, 14, 35, 0.2);
  opacity: 1;
}

.text-count {
  position: absolute;
  right: 10px;
  top: 8px;
  color: rgba(47, 53, 71, 0.28);
  font-size: 10px;
  pointer-events: none;
}

.form-error {
  font-size: 14px;
  line-height: 20px;
  color: #ff4d4f;
}

.description-field {
  position: relative;
}

.description-input {
  width: 100%;
  height: 82px;
  padding: 10px 42px 18px 16px;
  box-sizing: border-box;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  color: #0a0e23;
  background: #fff;
  transition: all 0.2s;
}

.description-input:focus {
  border-color: #8478fa;
}

.description-input::placeholder {
  color: rgba(10, 14, 35, 0.2);
  opacity: 1;
}

.description-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  color: rgba(47, 53, 71, 0.28);
  font-size: 10px;
  pointer-events: none;
}

.member-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  min-height: 0;
  border: 1px solid #dfe2ea;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.member-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.member-panel--source {
  border-right: 1px solid #dfe2ea;
}

.member-panel--selected {
  background: #f7f8fb;
}

.member-list,
.selected-list {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
  overflow-y: auto;
}

.member-item,
.selected-item {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  box-sizing: border-box;
}

.member-item {
  padding: 5px 4px;
  text-align: left;
  cursor: pointer;
}

.member-item:hover,
.member-item.selected {
  background: rgba(255, 111, 72, 0.06);
}

.checkbox-shell {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.checkbox-shell :deep(.el-checkbox) {
  height: 16px;
}

.checkbox-shell :deep(.el-checkbox__inner) {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.checkbox-shell :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  border-color: #ff754a;
  background-color: #ff754a;
}

.member-avatar {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
}

.member-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: 12px;
  line-height: 16px;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-desc {
  font-size: 11px;
  line-height: 14px;
  color: #a4aab8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selected-count {
  flex-shrink: 0;
  padding: 10px 12px 2px;
  font-size: 12px;
  line-height: 18px;
  color: #8d93a6;
}

.selected-item {
  position: relative;
  padding: 5px 22px 5px 4px;
}

.remove-member-btn {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: #a4aab8;
  font-size: 14px;
  line-height: 18px;
  cursor: pointer;
}

.remove-member-btn:hover {
  color: #ff754a;
}

.member-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #a4aab8;
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  box-sizing: border-box;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #fff;
  border: 1px solid #e5e5e5;
  color: #0a0e23;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

.btn-confirm {
  background: #1c1a21;
  color: #fff;
}

.btn-confirm:not(:disabled):hover {
  background: #2e323c;
}

.btn-confirm:disabled {
  cursor: not-allowed;
  opacity: 0.3;
  background: #0c1018;
}
</style>

<style lang="scss">
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

.el-dialog.create-solo-team-dialog {
  box-sizing: border-box;
  height: min(660px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  margin: clamp(24px, min(7vh, calc((100vh - 660px) / 2)), 7vh) auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;

  @include delete-confirm.el-dialog-header-row;

  .el-dialog__header {
    flex-shrink: 0;
  }

  .el-dialog__title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: normal;
    color: #2f3547;
  }

  .el-dialog__headerbtn {
    pointer-events: auto;
    cursor: pointer;
    z-index: 10;
  }

  .el-dialog__headerbtn:hover {
    background: rgba(23, 27, 38, 0.06);
    border-radius: 6px;
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: #606572;
    font-size: 18px;
    margin-top: 2px;
  }

  .el-dialog__body {
    flex: 1;
    min-height: 0;
    padding: 0 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .el-dialog__footer {
    flex-shrink: 0;
    padding: 0 16px 14px;
  }
}
</style>
