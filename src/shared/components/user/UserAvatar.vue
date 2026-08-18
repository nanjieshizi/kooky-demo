<script setup>
import UserProfileCard from './UserProfileCard.vue'

defineOptions({ name: 'UserAvatar' })

const props = defineProps({
  member: { type: Object, required: true },
  size: { type: [Number, String], default: 40 },
  shape: { type: String, default: 'circle' },
  disableCard: { type: Boolean, default: false },
  placement: { type: String, default: 'right-start' },
})

const emit = defineEmits(['click'])

function handleAvatarClick(e) {
  emit('click', e)
}
</script>

<template>
  <UserProfileCard
    mode="avatar"
    :member="member"
    :size="size"
    :shape="shape"
    :placement="placement"
    :disable-card="disableCard"
    @avatar-click="handleAvatarClick"
  />
</template>
