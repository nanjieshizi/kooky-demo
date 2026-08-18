<template>
  <div class="avatar-hire-button-root" :class="{ 'is-highlight': highlight }">
    <MarketCustomButton
      class="avatar-hire-button"
      variant="dark"
      :disabled="disabled || hireLoading"
      :size="size"
      @click.stop="onClickButton"
    >
      <!-- <span v-if="hireLoading" class="avatar-hire-button__inner">
        <img
          class="avatar-hire-button__spinner-img"
          :src="hireLoadingIconUrl"
          width="14"
          height="14"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        聘用中
      </span> -->
      <span class="avatar-hire-button__inner">聘用</span>
    </MarketCustomButton>
    <span v-if="highlight" class="avatar-hire-button-root__shimmer" aria-hidden="true" />

    <HireConfirmDialog
      v-model="showConfirmDialog"
      :display-name="displayNameForDialog"
      @confirm="onConfirmHire"
    />
    <HireLimitDialog v-model="showLimitDialog" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import HireConfirmDialog from '@/modules/market/avatar/components/HireConfirmDialog.vue'
import HireLimitDialog from '@/modules/market/avatar/components/HireLimitDialog.vue'
import hireLoadingIconUrl from '@/assets/skill/skill-one-click-install-loading.png'
import { hireAgent, hireAgentVersion } from '@/modules/market/avatar/services/avatarApi.js'
import { fetchMyHiredList } from '@/modules/market/my-hired/myHiredApi.js'
import { handoffAfterHire } from '@/modules/solo-team/hireHandoff'

defineOptions({ name: 'AvatarHireButton' })

const props = defineProps({
  /** 当前市场卡片/详情上的数字人数据（含 raw，供 hireAgent） */
  avatar: {
    type: Object,
    default: null,
  },
  disabled: { type: Boolean, default: false },
  size: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'small',
  },
  /** 已聘用数量上限 */
  managedAgentsLimit: { type: Number, default: 20 },
  /** 引导高亮：显示光效流转动画 */
  highlight: { type: Boolean, default: false },
  /** 版本级聘用时传入版本 ID，使用版本级聘用接口 */
  versionId: { type: [Number, String], default: null },
})

const emit = defineEmits(['hired', 'dialog-open', 'dialog-close'])

const showConfirmDialog = ref(false)
const showLimitDialog = ref(false)
const hireLoading = ref(false)

watch(showConfirmDialog, (val) => {
  emit(val ? 'dialog-open' : 'dialog-close')
})
watch(showLimitDialog, (val) => {
  if (val) emit('dialog-open')
  else if (!showConfirmDialog.value) emit('dialog-close')
})

const displayNameForDialog = computed(() =>
  String(props.avatar?.name ?? '').trim(),
)

function buildHireParams(avatar, newName) {
  return {
    name: newName || avatar?.name || '',
  }
}

async function onClickButton() {
  if (props.disabled || hireLoading.value) return
  const avatar = props.avatar
  if (!avatar) return

  try {
    const { itemsCount } = await fetchMyHiredList()
    if (itemsCount >= props.managedAgentsLimit) {
      showLimitDialog.value = true
      return
    }
  } catch (error) {
    console.error('[AvatarHireButton] fetchMyHiredList failed:', error)
    return
  }

  showConfirmDialog.value = true
}

async function onConfirmHire(newName) {
  const avatar = props.avatar
  if (!avatar) return

  hireLoading.value = true

  const params = buildHireParams(avatar, newName)

  try {
    const res = props.versionId != null
      ? await hireAgentVersion(avatar.id, props.versionId, params)
      : await hireAgent(avatar.id, params)
    ElMessage.success('聘用成功，这就带你去聊两句')
    emit('hired', { avatar, newName })

    // 聘完直接落到「个人」并跟他开一条会话 —— 聘用的下一步本来就是使唤他，
    // 别让人自己再去找。接口若返回了新的 agent id 就用它，否则退回市场 id。
    await handoffAfterHire({
      id: res?.agentId ?? res?.agent_id ?? res?.id ?? avatar.id,
      name: newName || avatar.name || '',
      avatar: avatar.avatar_url || avatar.avatar || '',
      description: avatar.summary || avatar.description || '',
      tags: Array.isArray(avatar.tags) ? avatar.tags : [],
    })
  } catch (error) {
    ElMessage.error(error?.message || '聘用失败')
  } finally {
    hireLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.avatar-hire-button-root {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  position: relative;
  border-radius: 6px;
  overflow: hidden;

  &__shimmer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.35) 50%,
      transparent 70%
    );
    background-size: 200% 100%;
    animation: hire-btn-shimmer 1.4s ease-in-out infinite;
    pointer-events: none;
  }
}

.avatar-hire-button.market-custom-button--dark {
  min-width: 52px;
  // padding: 6px 14px;
  --mcb-dark-hover-bg: #2b3142;
  --mcb-dark-active-bg: #10131c;
}

.avatar-hire-button__inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.2;
}

.avatar-hire-button__spinner-img {
  display: block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  object-fit: contain;
  animation: avatar-hire-spin 0.9s linear infinite;
}

@keyframes avatar-hire-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes hire-btn-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
</style>
