<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElIcon, ElPopover } from 'element-plus'
import { CirclePlus } from '@element-plus/icons-vue'
import { fetchUserProfile, fetchAgentProfile } from '@/shared/im-http/services/userProfile.js'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import { useCollaborationEmployeeChatStore } from '@/modules/collaboration/store/employeeChatStore'
import { defaultMemberAvatar, resolveMemberAvatarUrl } from '@/shared/utils/memberAvatar.js'
import { employeeDefaultAgentAvatar } from '@/modules/solo-team/utils/employeeChatAvatar.js'
import { useStartPrivateChat } from '@/modules/private/composables/useStartPrivateChat'

defineOptions({ name: 'UserProfileCard' })

const props = defineProps({
  /** 触发器形态：'text' 用默认 slot；'avatar' 渲染头像 */
  mode: { type: String, default: 'text' },

  /** 文字 trigger 模式使用 */
  account: { type: String, default: '' },

  /** 头像 trigger 模式使用：含 type / agentId / account 等 */
  member: { type: Object, default: () => null },
  size: { type: [Number, String], default: 40 },
  shape: { type: String, default: 'circle' },

  agentId: { type: [String, Number], default: '' },
  versionId: { type: [String, Number], default: '' },
  memberType: { type: String, default: '' },

  /** 关闭 popover、仅渲染内容（用于已被外层 popover 包裹的旧用法） */
  disableCard: { type: Boolean, default: false },
  /** disableCard 模式下由外部驱动是否拉接口 */
  active: { type: Boolean, default: false },

  /** 仅展示资料信息，不展示对话等操作按钮 */
  hideActions: { type: Boolean, default: false },

  placement: { type: String, default: 'top' },
})

const emit = defineEmits(['avatar-click'])

const popoverVisible = ref(false)

const isAvatarMode = computed(() => props.mode === 'avatar')

/** 头像模式从 member 解析出资料卡需要的 account/agentId/type */
const resolvedAccount = computed(() => {
  if (!isAvatarMode.value) return String(props.account || '').trim()
  const m = props.member || {}
  if (m.type === 'agent') {
    const aid = m.agent_id || m.agentId
    return aid ? String(aid) : ''
  }
  const candidates = [m.account, m.username, m.domainAccount, m.domain_account, m.userName, m.id, m.userId]
  const hit = candidates.find((v) => v !== undefined && v !== null && String(v).trim())
  return hit == null ? '' : String(hit).trim()
})

const resolvedAgentId = computed(() => {
  if (!isAvatarMode.value) return props.agentId
  const m = props.member || {}
  return m.agent_id || m.agentId || ''
})

const resolvedVersionId = computed(() => {
  if (!isAvatarMode.value) return props.versionId
  const m = props.member || {}
  return (
    m.version_id ??
    m.versionId ??
    m.agent_version_id ??
    m.online_version_id ??
    m.latest_version_id ??
    ''
  )
})

const resolvedMemberType = computed(() => {
  if (props.memberType) return props.memberType
  if (isAvatarMode.value) return props.member?.type || 'user'
  return 'user'
})

/** 头像 trigger 视觉 */
const profileDefaultAvatar = computed(() => (isAgent.value ? employeeDefaultAgentAvatar : defaultMemberAvatar))
const avatarUrl = computed(() => resolveMemberAvatarUrl(props.member) || profileDefaultAvatar.value)
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const shapeClass = computed(() => (props.shape === 'square' ? 'is-square' : 'is-circle'))

/** disableCard 模式下接受外部 active；否则随 popover 显隐 */
const effectiveActive = computed(() =>
  props.disableCard ? props.active : popoverVisible.value,
)

const userStore = useUserStore()
const uiStore = useUIStore()
const digitalHumanStore = useDigitalHumanStore()
const collaborationEmployeeChatStore = useCollaborationEmployeeChatStore()

const { startChat } = useStartPrivateChat()

const detail = ref({})
const loadingDetail = ref(false)

const profileName = computed(() => detail.value.name || resolvedAccount.value || '未知用户')
const profileAlias = computed(() => {
  const alias = detail.value.account || resolvedAccount.value
  return alias && alias !== profileName.value ? alias : ''
})
const mergedTitle = computed(() => detail.value.title || '')
const mergedDepartment = computed(() => detail.value.department || '')
const mergedDescription = computed(() => detail.value.description || '')
const mergedAvatar = computed(() => detail.value.avatar || profileDefaultAvatar.value)

function normalizeIdentityKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

const currentIdentityKeys = computed(() => {
  const info = userStore.userInfo || {}
  return [
    info.userId,
    info.account,
    info.username,
    info.userName,
    info.name,
  ].map(normalizeIdentityKey).filter(Boolean)
})

const profileIdentityKeys = computed(() => [
  detail.value.userId,
  detail.value.account,
  detail.value.username,
  detail.value.name,
  resolvedAccount.value,
].map(normalizeIdentityKey).filter(Boolean))

const isSelf = computed(() => {
  if (currentIdentityKeys.value.length === 0) return false
  return profileIdentityKeys.value.some((key) => currentIdentityKeys.value.includes(key))
})
const isAgent = computed(() => resolvedMemberType.value === 'agent')
const showChatBtn = computed(() => !props.hideActions && !!detail.value.userId && !isAgent.value && !isSelf.value)
const showAgentChatBtn = computed(() => !props.hideActions && !!detail.value.userId && isAgent.value)

const loaded = ref(false)
watch(
  () => [effectiveActive.value, resolvedAccount.value, resolvedAgentId.value, resolvedVersionId.value, isAgent.value],
  async ([active, value, agentId, versionId, agent]) => {
    if (!active) return
    const lookupKey = agent
      ? [String(agentId || '').trim(), String(versionId || '').trim()].filter(Boolean).join('::')
      : value
    if (!lookupKey) return
    if (loaded.value && detail.value._lookupKey === lookupKey) return
    detail.value = { account: agent ? '' : value, _lookupKey: lookupKey }
    loadingDetail.value = true
    try {
      const data = agent
        ? await fetchAgentProfile(String(agentId || '').trim(), String(versionId || '').trim() || undefined)
        : await fetchUserProfile(lookupKey)
      const stillSame = agent
        ? [String(resolvedAgentId.value || '').trim(), String(resolvedVersionId.value || '').trim()]
            .filter(Boolean).join('::') === lookupKey
        : resolvedAccount.value === lookupKey
      if (stillSame) {
        detail.value =
          data && Object.keys(data).length
            ? { ...data, _lookupKey: lookupKey }
            : { account: agent ? '' : lookupKey, _lookupKey: lookupKey }
        loaded.value = true
      }
    } catch {
      // 静默降级
    } finally {
      const stillSame = agent
        ? [String(resolvedAgentId.value || '').trim(), String(resolvedVersionId.value || '').trim()]
            .filter(Boolean).join('::') === lookupKey
        : resolvedAccount.value === lookupKey
      if (stillSame) loadingDetail.value = false
    }
  },
  { immediate: true },
)

async function handleChat() {
  try {
    await startChat({
      userName: detail.value.account || resolvedAccount.value,
      name: detail.value.name || resolvedAccount.value,
    })
    popoverVisible.value = false
  } catch (error) {
    console.error('[UserProfileCard] 发起私聊失败:', error)
    // 接口报错时终止，不关闭 popover、不进行跳转
  }
}

async function handleAgentChat() {
  const agentId = detail.value.userId || resolvedAgentId.value
  if (!agentId) return

  try {
    await digitalHumanStore.openAgent(agentId, '新对话')
    digitalHumanStore.upsertAgentInList({
      agent_id: agentId,
      agent_name: detail.value.name || String(agentId),
      agent_display_name: detail.value.name || detail.value.account || String(agentId),
      agent_avatar_url: detail.value.avatar || mergedAvatar.value || '',
    })
    await collaborationEmployeeChatStore.applyCollaborationDigitalHumanSession(
      agentId,
      digitalHumanStore.currentThreadPayload,
      digitalHumanStore.currentAgent || {
        agent_id: agentId,
        agent_name: detail.value.name || String(agentId),
        agent_display_name: detail.value.name || detail.value.account || String(agentId),
      },
    )
    const navKey = String(agentId)
    uiStore.setActiveNavigation('collaboration', `digital-human-${navKey}`)
    uiStore.expandSidebar()
    popoverVisible.value = false
  } catch (error) {
    console.error('[UserProfileCard] 打开数字人对话失败:', error)
    // 接口报错时终止，不关闭 popover、不进行跳转
  }
}

function onAvatarError(e) {
  e.target.src = profileDefaultAvatar.value
}

function handleAvatarClick(e) {
  emit('avatar-click', e)
}
</script>

<template>
  <!-- disableCard + 头像模式：只渲染头像，不弹卡片 -->
  <span
    v-if="disableCard && isAvatarMode"
    class="user-avatar"
    role="button"
    tabindex="0"
    :style="{ width: sizePx, height: sizePx }"
    @click="handleAvatarClick"
  >
    <img
      :src="avatarUrl"
      alt=""
      class="user-avatar__img"
      :class="shapeClass"
      @error="onAvatarError"
    />
  </span>

  <!-- disableCard + 文字模式：仅渲染卡片本体（兼容外部已经包了 popover 的旧用法） -->
  <div v-else-if="disableCard" class="user-profile-card">
    <div class="profile-header">
      <img :src="mergedAvatar" alt="" class="profile-avatar" @error="onAvatarError" />
    </div>
    <div class="profile-body">
      <div class="profile-name-row">
        <span class="profile-name">{{ profileName }}</span>
        <span v-if="profileAlias" class="profile-alias">{{ profileAlias }}</span>
      </div>
      <div v-if="mergedTitle" class="profile-title">{{ mergedTitle }}</div>
      <div v-else-if="loadingDetail" class="profile-skeleton profile-skeleton--title" />
      <div v-if="mergedDepartment" class="field-row">
        <span class="field-label">部门</span>
        <span class="field-value">{{ mergedDepartment }}</span>
      </div>
      <div v-else-if="loadingDetail" class="field-row">
        <span class="field-label">部门</span>
        <span class="profile-skeleton profile-skeleton--field" />
      </div>
      <div v-if="mergedDescription" class="field-row field-row--description">
        <span class="field-label">描述</span>
        <span class="field-value">{{ mergedDescription }}</span>
      </div>
      <el-button v-if="showChatBtn" class="action-btn" @click="handleChat">
        <el-icon class="action-btn__icon"><CirclePlus /></el-icon>
        <span>对话</span>
      </el-button>
      <el-button v-if="showAgentChatBtn" class="action-btn" @click="handleAgentChat">
        <el-icon class="action-btn__icon"><CirclePlus /></el-icon>
        <span>对话</span>
      </el-button>
    </div>
  </div>

  <!-- 正常模式：自带 popover，trigger 用头像或文字 -->
  <el-popover
    v-else
    v-model:visible="popoverVisible"
    :placement="placement"
    trigger="click"
    :show-arrow="false"
    :persistent="false"
    popper-class="user-profile-popover"
    :width="240"
  >
    <template #reference>
      <span
        v-if="isAvatarMode"
        class="user-avatar"
        role="button"
        tabindex="0"
        :style="{ width: sizePx, height: sizePx }"
        @click="handleAvatarClick"
      >
        <img
          :src="avatarUrl"
          alt=""
          class="user-avatar__img"
          :class="shapeClass"
          @error="onAvatarError"
        />
      </span>
      <span v-else class="user-profile-trigger"><slot /></span>
    </template>
    <div class="user-profile-card">
      <div class="profile-header">
        <img :src="mergedAvatar" alt="" class="profile-avatar" @error="onAvatarError" />
      </div>
      <div class="profile-body">
        <div class="profile-name-row">
          <span class="profile-name">{{ profileName }}</span>
          <span v-if="profileAlias" class="profile-alias">{{ profileAlias }}</span>
        </div>
        <div v-if="mergedTitle" class="profile-title">{{ mergedTitle }}</div>
        <div v-else-if="loadingDetail" class="profile-skeleton profile-skeleton--title" />
        <div v-if="mergedDepartment" class="field-row">
          <span class="field-label">部门</span>
          <span class="field-value">{{ mergedDepartment }}</span>
        </div>
        <div v-else-if="loadingDetail" class="field-row">
          <span class="field-label">部门</span>
          <span class="profile-skeleton profile-skeleton--field" />
        </div>
        <div v-if="mergedDescription" class="field-row field-row--description">
          <span class="field-label">描述</span>
          <span class="field-value">{{ mergedDescription }}</span>
        </div>
        <el-button v-if="showChatBtn" class="action-btn" @click="handleChat">
          <el-icon class="action-btn__icon"><CirclePlus /></el-icon>
          <span>对话</span>
        </el-button>
        <el-button v-if="showAgentChatBtn" class="action-btn" @click="handleAgentChat">
          <el-icon class="action-btn__icon"><CirclePlus /></el-icon>
          <span>对话</span>
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style lang="scss" scoped>
.user-profile-trigger {
  display: inline-flex;
  cursor: pointer;
}

.user-avatar {
  display: inline-block;
  line-height: 0;
  cursor: pointer;
  outline: none;

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
    border-radius: 50%;
  }
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #f2f3f5;

  &.is-circle { border-radius: 50%; }
  &.is-square { border-radius: 6px; }
}

.user-profile-card {
  width: 240px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.profile-header {
  position: relative;
  height: 116px;
  background-image: url('@/assets/kooky_word.png');
  background-size: cover;
  background-position: center;
}

.profile-avatar {
  position: absolute;
  left: 20px;
  bottom: -20px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid #fff;
  object-fit: cover;
  background: #fff;
}

.profile-body {
  padding: 32px 20px 20px;
}

.profile-name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.profile-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.profile-alias {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.profile-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.field-row {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;

  .field-label {
    width: 36px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 13px;
  }
  .field-value {
    flex: 1;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &--description {
    .field-value {
      -webkit-line-clamp: 4;
      line-clamp: 4;
      word-break: break-word;
    }
  }
}

.action-btn {
  margin-top: 4px;
  width: 100%;
  border-radius: 10px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  .action-btn__icon {
    font-size: 16px;
  }
}

.profile-skeleton {
  display: inline-block;
  height: 14px;
  background: linear-gradient(90deg, #f2f3f5 25%, #e6e8eb 50%, #f2f3f5 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  animation: profile-skeleton-shimmer 1.2s ease-in-out infinite;
}

.profile-skeleton--title {
  width: 60%;
  margin-bottom: 12px;
}

.profile-skeleton--field {
  flex: 1;
}

@keyframes profile-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>

<style lang="scss">
.user-profile-popover.el-popover.el-popper {
  padding: 0 !important;
  border-radius: 16px;
  border: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}
</style>
