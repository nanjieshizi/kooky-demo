<template>
  <span v-if="iconSrc" class="task-status-icon" :class="`task-status-icon--${normalizedStatus}`">
    <img :src="iconSrc" class="task-status-icon__img" alt="" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import inProgressIcon from '@/assets/soloTeam/jinxingzhong.svg'
import failedIcon from '@/assets/soloTeam/shibai.svg'
import notStartedIcon from '@/assets/soloTeam/weikaishi.svg'

defineOptions({ name: 'OnePersonTaskStatusIcon' })

const props = defineProps({
  status: { type: String, default: 'active' },
})

const normalizedStatus = computed(() => String(props.status || '').toLowerCase())

const iconSrc = computed(() => {
  if (['completed', 'succeeded', 'success', 'done'].includes(normalizedStatus.value)) return ''
  if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(normalizedStatus.value)) return failedIcon
  if (['blocked', 'waiting_approval', 'pending_approval', 'pending', 'waiting', 'not_started', 'todo'].includes(normalizedStatus.value)) {
    return notStartedIcon
  }
  return inProgressIcon
})
</script>

<style scoped>
.task-status-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.task-status-icon__img {
  width: 14px;
  height: 14px;
  display: block;
}
</style>
