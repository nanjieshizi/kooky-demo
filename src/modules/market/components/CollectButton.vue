<template>
  <span
    :class="['collect-button', { 'is-collected': localCollected, 'is-disabled': !clickable }]"
    @click.stop="handleClick"
  >
    <img
      v-if="localCollected"
      class="collect-button__icon"
      :src="starFilledIcon"
      alt=""
      width="14"
      height="14"
    />
    <img
      v-else
      class="collect-button__icon"
      :src="starOutlineIcon"
      alt=""
      width="14"
      height="14"
    />
    <span class="collect-button__count">{{ displayCount }}</span>
  </span>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import starFilledIcon from '@/assets/market/collect-star-filled.png'
import starOutlineIcon from '@/assets/market/collect-star-outline.png'
import { postSkillFollow,deleteSkillFollow } from '@/modules/market/skill/skillMarketApi'
import { followAgent } from '@/modules/market/avatar/services/avatarApi'

const props = defineProps({
  /** 收藏类型：skill 或 avatar */
  type: {
    type: String,
    required: true,
    validator: (value) => ['skill', 'avatar'].includes(value),
  },
  /** 资源 ID：skill 使用 slug，avatar 使用 id */
  resourceId: {
    type: [String, Number],
    required: true,
  },
  /** 初始收藏状态 */
  initialCollected: {
    type: Boolean,
    default: false,
  },
  /** 初始收藏数量 */
  initialCount: {
    type: [Number, String],
    default: 0,
  },
  /** 是否允许点击收藏（默认允许） */
  clickable: {
    type: Boolean,
    default: true,
  },
})

const localCollected = ref(props.initialCollected)
const localCount = ref(Number(props.initialCount) || 0)
const loading = ref(false)

// 监听外部状态变化
watch(() => props.initialCollected, (newVal) => {
  localCollected.value = newVal
})

watch(() => props.initialCount, (newVal) => {
  localCount.value = Number(newVal) || 0
})

const displayCount = computed(() => {
  const n = localCount.value
  if (Number.isNaN(n)) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
})

async function handleClick() {
  if (!props.clickable || loading.value) return

  const wasCollected = localCollected.value
  const prevCount = localCount.value

  loading.value = true

  try {

    let api = followAgent
    if(props.type === 'skill'){
      api = !wasCollected ? postSkillFollow : deleteSkillFollow
    } else {
      api = followAgent
    }
    await api (props.resourceId,!wasCollected)
    // 乐观更新 UI
    localCollected.value = !wasCollected
    localCount.value = localCollected.value ? prevCount + 1 : Math.max(0, prevCount - 1)
  } catch (error) {
    console.error('收藏操作失败:', error)
    // 回滚状态
    localCollected.value = wasCollected
    localCount.value = prevCount
    ElMessage.error('操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// async function handleSkillCollect(wasCollected) {
//   const slug = String(props.resourceId ?? '').trim()
//   if (!slug) {
//     throw new Error('缺少 Skill 标识')
//   }

//   if (wasCollected) {
//     await deleteSkillFollow(slug)
//   } else {
//     await postSkillFollow(slug)
//   }
// }

// async function handleAvatarCollect(wasCollected) {
//   const id = props.resourceId
//   if (!id) {
//     throw new Error('缺少 Avatar 标识')
//   }

//   await followAgent(id, !wasCollected)
// }
</script>

<style lang="scss" scoped>
.collect-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #606572;
  line-height: 1;
  transition: color 0.15s;
  user-select: none;

  &:hover:not(.is-disabled) {
    color: #2f3547;
  }

  &.is-collected {
    color: #FFB800;

    &:hover:not(.is-disabled) {
      color: #e6a600;
    }
  }

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.collect-button__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
}

.collect-button__count {
  display: inline-flex;
  align-items: center;
  min-height: 14px;
  line-height: 14px;
  font-size: inherit;
}
</style>
