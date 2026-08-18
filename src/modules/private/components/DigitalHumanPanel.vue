<template>
  <div class="digital-human-panel">
    <template v-if="hasSession">
      <div class="digital-human-employee-shell">
        <EmployeeChatSessionHeader variant="collaboration" />
        <EmployeeChatPanel class="chat-area" />
      </div>
    </template>
    <div v-else class="digital-human-empty">
      <div class="digital-human-empty-title">数字人对话</div>
      <div class="digital-human-empty-desc">
        <template v-if="emptyStateAgentLabel">
          正在打开：{{ emptyStateAgentLabel }}
        </template>
        <template v-else>
          请在左侧选择一个数字人
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, provide } from 'vue'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { useUIStore } from '@/modules/space/uiStore'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import EmployeeChatPanel from '@/modules/solo-team/components/EmployeeChatPanel.vue'
import EmployeeChatSessionHeader from '@/modules/solo-team/components/EmployeeChatSessionHeader.vue'

defineOptions({ name: 'DigitalHumanPanel' })

const digitalHumanStore = useDigitalHumanStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()
const uiStore = useUIStore()
provide(EMPLOYEE_CHAT_SESSION_STORE_KEY, collaborationEmployeeChatStore)

/** 协作会话是否已就绪：仅用 collaboration-employee-chat，与 digitalHumanStore 的 currentAgentId/currentThreadPayload 隔离 */
const hasSession = computed(
  () =>
    collaborationEmployeeChatStore.isEmployeeChatActive
    && !!collaborationEmployeeChatStore.currentEmployeeThread,
)

const secondaryDigitalHumanAgentId = computed(() => {
  const nav = uiStore.activeSecondaryNav
  if (typeof nav !== 'string' || !nav.startsWith('digital-human-')) return null
  return nav.slice('digital-human-'.length).trim() || null
})

/** 空态展示用名称：优先当前员工，其次侧栏 agent-usage 列表 */
const emptyStateAgentLabel = computed(() => {
  const emp = collaborationEmployeeChatStore.currentEmployee
  if (emp?.name) return emp.name
  const id = secondaryDigitalHumanAgentId.value
  if (!id) return ''
  const row = digitalHumanStore.agents.find((a) => String(a.agent_id ?? a.agentId) === String(id))
  return row?.agent_display_name || row?.agent_name || ''
})
</script>

<style lang="scss" scoped>
.digital-human-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.digital-human-employee-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  min-height: 0;
}

.digital-human-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #91949e;
}

.digital-human-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #2f3547;
}

.digital-human-empty-desc {
  font-size: 13px;
}
</style>

<!-- 无 scoped：:has 需匹配子组件 EmployeeMessageList 内节点 -->
<style lang="scss">
.digital-human-panel .digital-human-employee-shell:has(.message-list-scroll--employee-welcome-full-bleed-bg) {
  background-color: transparent;
  background-image: url('@/assets/soloTeam/bg1.png');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.digital-human-panel .digital-human-employee-shell:has(.message-list-scroll--employee-welcome-full-bleed-bg) .solo-team-header {
  background: transparent;
}

.digital-human-panel .digital-human-employee-shell:has(.message-list-scroll--employee-welcome-full-bleed-bg) .employee-chat-panel {
  background: transparent;
}
</style>
