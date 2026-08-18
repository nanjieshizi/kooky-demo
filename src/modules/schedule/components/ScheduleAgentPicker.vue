<template>
  <div class="agent-picker">
    <button
      type="button"
      class="picker-trigger"
      :class="{ open }"
      @click="open = !open"
    >
      <span class="trigger-text" :class="{ placeholder: !modelValue }">
        {{ displayText || '请选择执行 Agent' }}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" :class="{ rotated: open }">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="#86909C" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="open" class="picker-dropdown">
      <div class="picker-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="picker-tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="picker-body custom-scrollbar">
        <!-- 我的分身 -->
        <template v-if="tab === 'avatar'">
          <div class="picker-group">
            <header class="group-header">我的分身 · 单人</header>
            <button
              v-for="opt in availability.avatar"
              :key="opt.agentId"
              type="button"
              class="agent-row"
              :class="{ selected: isSelected(opt) }"
              @click="onSelect(opt)"
            >
              <span class="agent-avatar" :style="{ background: avatarColor(opt.agentName) }">
                {{ initials(opt.agentName) }}
              </span>
              <span class="agent-name">{{ opt.agentName }}</span>
            </button>
          </div>
        </template>

        <!-- 一人团队 -->
        <template v-else-if="tab === 'solo'">
          <div v-if="availability.soloEmployees.length" class="picker-group">
            <header class="group-header">我的员工 · 单人</header>
            <button
              v-for="opt in availability.soloEmployees"
              :key="opt.agentId"
              type="button"
              class="agent-row"
              :class="{ selected: isSelected(opt) }"
              @click="onSelect(opt)"
            >
              <span class="agent-avatar" :style="{ background: avatarColor(opt.agentName) }">
                {{ initials(opt.agentName) }}
              </span>
              <span class="agent-name">{{ opt.agentName }}</span>
            </button>
          </div>
          <div v-for="team in availability.soloTeams" :key="team.teamId" class="picker-group">
            <header class="group-header">{{ team.teamName }} · 选择团队中的某个成员</header>
            <button
              v-for="opt in team.members"
              :key="`${team.teamId}-${opt.agentId}`"
              type="button"
              class="agent-row"
              :class="{ selected: isSelected(opt) }"
              @click="onSelect(opt)"
            >
              <span class="agent-avatar" :style="{ background: avatarColor(opt.agentName) }">
                {{ initials(opt.agentName) }}
              </span>
              <span class="agent-name">{{ opt.agentName }}</span>
            </button>
          </div>
          <div v-if="!availability.soloEmployees.length && !availability.soloTeams.length" class="picker-empty">
            暂无可用的数字员工
          </div>
        </template>

        <!-- 协作 -->
        <template v-else-if="tab === 'collab'">
          <div v-for="conv in availability.collabGroups" :key="conv.conversationId" class="picker-group">
            <header class="group-header">{{ conv.name }} · 群里的数字员工</header>
            <button
              v-for="opt in conv.agents"
              :key="`${conv.conversationId}-${opt.agentId}`"
              type="button"
              class="agent-row"
              :class="{ selected: isSelected(opt) }"
              @click="onSelect(opt)"
            >
              <span class="agent-avatar" :style="{ background: avatarColor(opt.agentName) }">
                {{ initials(opt.agentName) }}
              </span>
              <span class="agent-name">{{ opt.agentName }}</span>
            </button>
          </div>
          <div v-if="!availability.collabGroups.length" class="picker-empty">
            暂无协作群聊
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'ScheduleAgentPicker' })

import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useGroupStore } from '@/modules/group/store'

const props = defineProps({
  modelValue: { type: Object, default: null }, // 选中的 agent { agentId, agentName, source }
})
const emit = defineEmits(['update:modelValue'])

const tabs = [
  { key: 'avatar', label: '我的分身' },
  { key: 'solo', label: '一人团队' },
  { key: 'collab', label: '协作' },
]
const tab = ref('solo')
const open = ref(false)

const soloStore = useSoloTeamStore()
const groupStore = useGroupStore()

const availability = computed(() => {
  // 我的分身
  const avatar = [{
    agentId: 'avatar-self',
    agentName: '我的分身',
    source: { type: 'avatar', label: '我的分身', conversationId: 'avatar-self-conv' },
  }]

  // 一人团队 · 我的员工
  const soloEmployees = (soloStore.employeeChatEmployees || []).map((emp) => ({
    agentId: `solo-emp-${emp.id}`,
    agentName: emp.name || emp.raw?.agent_display_name || `员工 ${emp.id}`,
    source: {
      type: 'solo-employee',
      label: '一人团队 · 我的员工',
      conversationId: `sched-solo-emp-${emp.id}`,
    },
  }))

  // 一人团队 · 团队群
  const teamsRaw = soloStore.onePersonTeams || []
  const soloTeams = teamsRaw.map((team) => {
    const members = (team.members || team.agents || []).map((m) => ({
      agentId: `solo-team-${team.id}-${m.agentId || m.id}`,
      agentName: m.agentName || m.name || m.displayName || '?',
      source: {
        type: 'solo-team',
        label: `一人团队 · ${team.name}`,
        conversationId: `sched-solo-team-${team.id}-${m.agentId || m.id}`,
      },
    }))
    return { teamId: team.id, teamName: team.name, members }
  }).filter((t) => t.members.length > 0)

  // 协作群里的数字人
  const collabGroups = (groupStore.conversations || [])
    .filter((c) => c.createRoomType === 'group_chat')
    .map((conv) => {
      const members = groupStore.conversationMembers?.[conv.conversationId] || []
      const agents = members
        .filter((m) => m.type === 'agent')
        .map((m) => ({
          agentId: `collab-${conv.conversationId}-${m.userId}`,
          agentName: m.displayName || m.name || m.userId,
          source: {
            type: 'collab-group',
            label: `协作 · ${conv.name}`,
            conversationId: conv.conversationId,
          },
        }))
      return { conversationId: conv.conversationId, name: conv.name, agents }
    })
    .filter((g) => g.agents.length > 0)

  return { avatar, soloEmployees, soloTeams, collabGroups }
})

const displayText = computed(() => {
  const v = props.modelValue
  if (!v) return ''
  return `${v.agentName}（${v.source?.label || ''}）`
})

function isSelected(opt) {
  return props.modelValue?.agentId === opt.agentId
}

function onSelect(opt) {
  emit('update:modelValue', { ...opt })
  open.value = false
}

function initials(name) {
  if (!name) return '?'
  const ch = String(name).trim()
  if (/[一-龥]/.test(ch)) return ch.slice(-1)
  return ch.slice(0, 1).toUpperCase()
}

const COLORS = ['#E8F2FE', '#FFF1ED', '#F0F9F4', '#FFF7E6', '#F3E8FF']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

// 点外面关闭
function onDocClick(e) {
  if (!open.value) return
  const el = e.target.closest?.('.agent-picker')
  if (!el) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.agent-picker {
  position: relative;
  width: 100%;
}

.picker-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 13px;
  color: #1D2129;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s;
}
.picker-trigger:hover { border-color: #C9D6FA; }
.picker-trigger.open { border-color: #436FF6; }

.trigger-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trigger-text.placeholder { color: #C9CDD4; }

svg.rotated { transform: rotate(180deg); }

.picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.08);
  z-index: 100;
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

.picker-tabs {
  display: flex;
  padding: 4px;
  gap: 4px;
  border-bottom: 1px solid #F2F3F5;
  background: #FAFBFC;
  border-radius: 10px 10px 0 0;
}

.picker-tab {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #86909C;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.picker-tab:hover { color: #1D2129; }
.picker-tab.active {
  background: #FFFFFF;
  color: #FF6B00;
  box-shadow: 0 1px 3px rgba(255, 107, 0, 0.1);
}

.picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
}

.picker-group {
  margin-bottom: 4px;
}

.group-header {
  padding: 6px 12px;
  font-size: 12px;
  color: #86909C;
  font-weight: 500;
}

.agent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.agent-row:hover { background: #F7F8FA; }
.agent-row.selected { background: #FFF1ED; }

.agent-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: #4E5969;
  flex-shrink: 0;
}

.agent-name {
  font-size: 13px;
  color: #1D2129;
}

.picker-empty {
  padding: 18px 12px;
  text-align: center;
  font-size: 12px;
  color: #C9CDD4;
}
</style>
