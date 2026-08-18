<template>
  <AddGroupMemberDialog
    :visible="visible"
    mode="create-team"
    :confirm-loading="creating"
    @update:visible="handleVisibleChange"
    @confirm="handleConfirm"
  />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import AddGroupMemberDialog from '@/modules/group/components/AddGroupMemberDialog.vue'
import { useGroupStore } from '@/modules/group/store'
import { useUserStore } from '@/modules/auth/store'
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage.mjs'

defineOptions({ name: 'CreateGroupFlowDialog' })

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'created'])

const groupStore = useGroupStore()
const userStore = useUserStore()

const creating = ref(false)

function closeFlow() {
  emit('update:visible', false)
}

function defaultGroupName() {
  const fullName = userStore.userName || '用户'
  const chineseName = fullName.match(/[\u4e00-\u9fa5]+/g)?.join('') || '用户'
  return `${chineseName}创建的群聊`
}

function normalizeDraft(payload = {}) {
  const users = Array.isArray(payload.users) ? payload.users : []
  const agents = Array.isArray(payload.agents) ? payload.agents : []
  return {
    name: String(payload.name || '').trim() || defaultGroupName(),
    users,
    agents,
    accounts: users.map((member) => member.account || member.username).filter(Boolean),
    botIds: agents
      .map((agent) => agent.imBotId ?? agent.participantId ?? agent.participant_id)
      .filter((id) => id !== undefined && id !== null && id !== ''),
  }
}

function handleVisibleChange(nextVisible) {
  if (nextVisible || creating.value) return
  closeFlow()
}

async function handleConfirm(payload) {
  const draft = normalizeDraft(payload)
  if (creating.value) return
  creating.value = true
  try {
    const uniqueBotIds = [...new Map(draft.botIds.map((id) => [String(id), id])).values()]
    const result = await groupStore.createGroupRoom(draft.name, draft.accounts, uniqueBotIds)
    const conversationId = result?.conversationId
    if (!conversationId) throw new Error('创建群聊后未返回会话 ID')

    ElMessage.success('群聊已创建')
    emit('created', { conversationId, groupKind: 'normal' })
    closeFlow()
  } catch (error) {
    console.error('[CreateGroupFlowDialog] 创建群聊失败:', error)
    ElMessage.error(apiErrorMessage(error, '创建群聊失败，请重试'))
  } finally {
    creating.value = false
  }
}
</script>
