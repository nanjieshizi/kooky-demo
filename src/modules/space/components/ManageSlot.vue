<template>
  <div class="mgs">
    <!-- 分身：PersonaManagePanel 自带头部（含编辑），不叠 ManageSlot 的头 -->
    <PersonaManagePanel
      v-if="nav === 'deerflow'"
      context="deerflow"
      embedded
      class="mgs-fill"
      @close="sidePanel.close()"
    />

    <!-- 协作 / 一人团队：ManageSlot 提供头 + roster 嵌入 -->
    <template v-else>
      <header class="mgs-head">
        <h3 class="mgs-title">{{ title }}</h3>
        <button class="mgs-close" aria-label="收起" @click="sidePanel.close()">✕</button>
      </header>
      <div class="mgs-body">
        <GroupRosterSidebar
          v-if="nav === 'collaboration'"
          :conversation-id="cid"
          embedded
          class="mgs-fill"
        />
        <OnePersonTeamRosterSidebar
          v-else-if="nav === 'solo-team' && teamId"
          :team-id="teamId"
          embedded
          class="mgs-fill"
          @close="sidePanel.close()"
        />
        <div v-else class="mgs-placeholder">
          <div class="ph-icon">⚙️</div>
          <div class="ph-note">该模块暂无管理</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import GroupRosterSidebar from '@/modules/group/components/GroupRosterSidebar.vue'
import OnePersonTeamRosterSidebar from '@/modules/solo-team/components/OnePersonTeamRosterSidebar.vue'
import PersonaManagePanel from '@/modules/space/components/PersonaManagePanel.vue'

const uiStore = useUIStore()
const groupStore = useGroupStore()
const soloTeamStore = useSoloTeamStore()
const sidePanel = useSidePanelStore()

const nav = computed(() => uiStore.activePrimaryNav)
const cid = computed(() => groupStore.currentSpaceId || groupStore.currentConversationId)
const teamId = computed(() => soloTeamStore.currentOnePersonTeam?.id || '')
const title = computed(() =>
  nav.value === 'collaboration' ? '群管理' : nav.value === 'solo-team' ? '会话管理' : '管理',
)

function loadMembers() {
  if (nav.value === 'collaboration' && cid.value) {
    groupStore.loadConversationMembers(cid.value, { force: true })
  }
}
onMounted(() => {
  sidePanel.setWide(false) // 管理(roster/persona)用窄
  loadMembers()
})
watch(cid, loadMembers)
</script>

<style scoped>
.mgs {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mgs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.mgs-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--kk-ink-800, #1f2329);
}
.mgs-close {
  border: none;
  background: transparent;
  color: var(--kk-ink-400, #9aa0aa);
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.mgs-close:hover {
  background: var(--kk-fill-hover, rgba(0, 0, 0, 0.04));
}
.mgs-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.mgs-fill {
  flex: 1;
  min-width: 0;
}
.mgs-placeholder {
  margin: auto;
  text-align: center;
  color: var(--kk-ink-400, #9aa0aa);
}
.ph-icon {
  font-size: 30px;
  margin-bottom: 10px;
}
.ph-note {
  font-size: 12px;
}
</style>
