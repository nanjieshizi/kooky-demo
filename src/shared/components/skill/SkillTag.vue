<template>
  <div class="skill-tag" :class="{ 'is-readonly': readonly }">
    <button
      v-if="!readonly"
      type="button"
      class="skill-tag__icon-btn"
      aria-label="移除技能"
      @click.stop="emit('remove')"
    >
      <img v-if="skillAvatar" :src="skillAvatar" class="skill-tag__icon skill-tag__icon--skill" alt="" />
      <img v-else :src="skillIcon" class="skill-tag__icon skill-tag__icon--skill" alt="" />
      <!-- <SvgIcon v-else name="icon-Skill" :size="16" color="#606572" class="skill-tag__icon skill-tag__icon--skill" /> -->
      <SvgIcon name="icon-a-guanbixiao" :size="18" color="#606572" class="skill-tag__icon skill-tag__icon--close" />
    </button>
    <template v-else>
      <img v-if="skillAvatar" :src="skillAvatar" class="skill-tag__icon skill-tag__icon--skill" alt="" />
      <img v-else :src="skillIcon" class="skill-tag__icon skill-tag__icon--skill" alt="" />
    </template>
    <span class="skill-tag__name">{{ displayLabel }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import skillIcon from '@/assets/chat/skillDefault.png'

const props = defineProps({
  skill: { type: Object, required: true },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['remove'])

// 兼容不同接口的图片字段：avatar（市场接口）或 image（已安装接口）
const skillAvatar = computed(() => props.skill?.avatar || props.skill?.image || '')

const displayLabel = computed(
  () => props.skill.displayName || props.skill.slug || props.skill.name || ''
)
</script>

<style lang="scss" scoped>
.skill-tag {
  box-sizing: border-box;
  width: auto;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 1px 6px;
  gap: 4px;
  border-radius: 6px;
  background: #F5F6F9;
  color: #2F3547;
  font-size: 14px;
  flex-shrink: 0;
  cursor: default;
  user-select: none;
  margin-top: -3px;

  &.is-readonly {
    background: #FFFFFF;
  }

  &__icon-btn {
    position: relative;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: block;
  }

  &__icon {
    width: 18px;
    height: 18px;
    display: block;
    flex-shrink: 0;
    transition: opacity 0.15s ease;

    &--close {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      pointer-events: none;
    }
  }

  &:not(.is-readonly):hover &__icon--skill {
    opacity: 0;
    pointer-events: none;
  }

  &:not(.is-readonly):hover &__icon--close {
    opacity: 1;
    pointer-events: auto;
  }

  &__name {
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
    margin-left: 4px;
    font-size: 14px;
  }
}
</style>
