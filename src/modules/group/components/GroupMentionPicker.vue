<template>
  <div v-if="visible && hasItems" ref="pickerRef" class="group-mention-picker">
    <template v-if="filteredBots.length">
      <div class="group-mention-picker__group-label">{{ LABEL_BOT }}</div>
      <div
        v-for="(m, idx) in filteredBots"
        :key="'bot-' + m.userId"
        class="group-mention-picker__item"
        :class="{ active: idx === activeIndex }"
        @mousedown.prevent="emit('select', m)"
      >
        <UserAvatar :member="m" :size="28" placement="right-start" class="group-mention-picker__avatar" />
        <span class="group-mention-picker__name">{{ m.displayName || m.userId }}</span>
      </div>
    </template>
    <template v-if="filteredHumans.length">
      <div class="group-mention-picker__group-label">{{ LABEL_HUMAN }}</div>
      <div
        v-for="(m, idx) in filteredHumans"
        :key="'user-' + m.userId"
        class="group-mention-picker__item"
        :class="{ active: filteredBots.length + idx === activeIndex }"
        @mousedown.prevent="emit('select', m)"
      >
        <UserAvatar :member="m" :size="28" placement="right-start" class="group-mention-picker__avatar" />
        <span class="group-mention-picker__name">{{ m.displayName || m.userId }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, watch, ref, nextTick } from 'vue'
import { useGroupStore } from '@/modules/group/store'
import { isRoomMemberBot } from '@/shared/utils/memberType.js'
import { memberAvatarDisplayUrl } from '@/shared/utils/memberAvatar.js'
import { isSelfMember } from '@/shared/utils/userInfoStorage.js'
import { UserAvatar } from '@/shared/components/user'

defineOptions({ name: 'GroupMentionPicker' })

const LABEL_BOT = '企业数字人'
const LABEL_HUMAN = '团队内成员'

const props = defineProps({
  visible: { type: Boolean, default: false },
  groupId: { type: String, required: true },
  /** @ 后输入的过滤关键字 */
  searchQuery: { type: String, default: '' },
  activeIndex: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'update:activeIndex'])

const groupStore = useGroupStore()

watch(
  () => props.groupId,
  (rid) => {
    if (rid) groupStore.loadConversationMembers(rid)
  },
  { immediate: true },
)

const memberProfiles = computed(() =>
  (groupStore.conversationMembers[props.groupId] ?? []).filter((m) => !isSelfMember(m)),
)

function filterByQueryString(list, queryStr) {
  const q = String(queryStr ?? '').toLowerCase()
  if (!q) return list
  return list.filter(
    (m) =>
      searchableMemberText(m.displayName).includes(q) ||
      searchableMemberText(m.name).includes(q) ||
      searchableMemberText(m.account).includes(q) ||
      searchableMemberText(m.username).includes(q) ||
      searchableMemberText(m.userId).includes(q),
  )
}

function searchableMemberText(value) {
  return String(value ?? '').toLowerCase()
}

function buildFlatForQuery(queryStr) {
  const members = memberProfiles.value
  const bots = filterByQueryString(
    members.filter((m) => isRoomMemberBot(m)),
    queryStr,
  )
  const humans = filterByQueryString(
    members.filter((m) => !isRoomMemberBot(m)),
    queryStr,
  )
  return [...bots, ...humans]
}

const filteredBots = computed(() =>
  filterByQueryString(
    memberProfiles.value.filter((m) => isRoomMemberBot(m)),
    props.searchQuery,
  ),
)

const filteredHumans = computed(() =>
  filterByQueryString(
    memberProfiles.value.filter((m) => !isRoomMemberBot(m)),
    props.searchQuery,
  ),
)

const flatList = computed(() => buildFlatForQuery(props.searchQuery))

const hasItems = computed(() => flatList.value.length > 0)

const pickerRef = ref(null)

watch(
  () => props.activeIndex,
  (idx) => {
    nextTick(() => {
      const container = pickerRef.value
      if (!container) return
      const items = container.querySelectorAll('.group-mention-picker__item')
      const el = items[idx]
      if (el) el.scrollIntoView({ block: 'nearest' })
    })
  },
)

watch(flatList, (list) => {
  if (props.activeIndex >= list.length) {
    emit('update:activeIndex', 0)
  }
})

/**
 * @param {string} [queryOverride] 与 props 不同步时传入（如同一 tick 内刚更新的 @ 关键字）
 */
function getFlatList(queryOverride) {
  if (queryOverride !== undefined) return buildFlatForQuery(queryOverride)
  return flatList.value
}

defineExpose({ getFlatList })
</script>

<style scoped>
.group-mention-picker {
  position: absolute;
  bottom: calc(100% - 12px);
  /* margin-bottom: 4px; */
  left: 0;
  right: 0;
  background: var(--el-bg-color-overlay, var(--bg-primary));
  border: 1px solid var(--el-border-color, var(--border));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  max-height: 248px;
  overflow-y: auto;
  z-index: 10;
}

.group-mention-picker__group-label {
  padding: 8px 14px 4px;
  font-size: 12px;
  line-height: 18px;
  color: #91949e;
  user-select: none;
}

.group-mention-picker__group-label:not(:first-child) {
  padding-top: 10px;
}

.group-mention-picker__item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 4px;
  padding: 0 8px;
  height: 40px;
  line-height: 40px;
  cursor: pointer;
  color: #2f3547;
  font-size: 12px;
  border-radius: 8px;
}

.group-mention-picker__item:hover,
.group-mention-picker__item.active {
  background: #f5f6f9;
}

.group-mention-picker__avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.group-mention-picker__name {
  font-size: 12px;
  color: #2f3547;
}
</style>
