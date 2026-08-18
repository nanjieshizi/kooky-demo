<template>
  <div v-if="visible && hasItems" ref="pickerRef" class="one-person-mention-picker">
    <div class="one-person-mention-picker__group-label">数字员工</div>
    <button
      v-for="(member, idx) in filteredMembers"
      :key="member.userId"
      type="button"
      class="one-person-mention-picker__item"
      :class="{ active: idx === activeIndex }"
      @mousedown.prevent="emit('select', member)"
    >
      <img
        class="one-person-mention-picker__avatar"
        :src="member.avatar || defaultAgentAvatar"
        alt=""
        @error="onAvatarError"
      />
      <span class="one-person-mention-picker__meta">
        <span class="one-person-mention-picker__name">{{ member.displayName || member.userId }}</span>
        <span v-if="member.description" class="one-person-mention-picker__desc">{{ member.description }}</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'

defineOptions({ name: 'OnePersonMentionPicker' })

const props = defineProps({
  visible: { type: Boolean, default: false },
  members: { type: Array, default: () => [] },
  searchQuery: { type: String, default: '' },
  activeIndex: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'update:activeIndex'])
const pickerRef = ref(null)

function searchableText(value) {
  return String(value ?? '').toLowerCase()
}

function normalizeMember(member) {
  const id = member?.userId ?? member?.agentId ?? member?.id
  if (id == null || id === '') return null
  const displayName = String(member?.displayName || member?.name || member?.agentName || `数字员工 ${id}`).trim()
  return {
    ...member,
    id: String(member?.id ?? id),
    agentId: String(member?.agentId ?? id),
    userId: String(id),
    displayName: displayName || String(id),
    avatar: member?.avatar || member?.avatarUrl || member?.icon || '',
    description: String(member?.description || member?.role || '').trim(),
    type: 'agent',
  }
}

function buildFlatForQuery(queryStr) {
  const q = searchableText(queryStr).trim()
  const normalized = props.members.map(normalizeMember).filter(Boolean)
  const deduped = []
  const seen = new Set()
  for (const member of normalized) {
    const key = member.userId.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(member)
  }
  if (!q) return deduped
  return deduped.filter((member) =>
    searchableText(member.displayName).includes(q)
    || searchableText(member.name).includes(q)
    || searchableText(member.description).includes(q)
    || searchableText(member.agentId).includes(q)
    || searchableText(member.userId).includes(q),
  )
}

const filteredMembers = computed(() => buildFlatForQuery(props.searchQuery))
const hasItems = computed(() => filteredMembers.value.length > 0)

watch(
  () => props.activeIndex,
  (idx) => {
    nextTick(() => {
      const container = pickerRef.value
      if (!container) return
      const items = container.querySelectorAll('.one-person-mention-picker__item')
      const el = items[idx]
      if (el) el.scrollIntoView({ block: 'nearest' })
    })
  },
)

watch(filteredMembers, (list) => {
  if (props.activeIndex >= list.length) emit('update:activeIndex', 0)
})

function getFlatList(queryOverride) {
  if (queryOverride !== undefined) return buildFlatForQuery(queryOverride)
  return filteredMembers.value
}

function onAvatarError(event) {
  event.target.src = defaultAgentAvatar
}

defineExpose({ getFlatList })
</script>

<style scoped>
.one-person-mention-picker {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% - 10px);
  z-index: 20;
  max-height: 248px;
  overflow-y: auto;
  padding: 6px 4px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.12);
}

.one-person-mention-picker__group-label {
  padding: 4px 12px 6px;
  color: #91949e;
  font-size: 12px;
  line-height: 18px;
  user-select: none;
}

.one-person-mention-picker__item {
  width: 100%;
  height: 46px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.one-person-mention-picker__item:hover,
.one-person-mention-picker__item.active {
  background: #f5f6f9;
}

.one-person-mention-picker__avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.one-person-mention-picker__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.one-person-mention-picker__name {
  color: #2f3547;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.one-person-mention-picker__desc {
  color: #91949e;
  font-size: 12px;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
