<template>
  <article
    class="avatar-card"
    :class="{ 'is-hovered': isHovered, 'is-hired': localHired, 'is-guide-active': guideStep > 0, 'is-dialog-active': isDialogOpen }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="$emit('view-detail', avatar.id)"
  >
    <!-- 上区：头像 + 标题/标签（对齐 SkillMarketCard __top + __meta） -->
    <div class="avatar-card__top">
      <div class="avatar-card__media">
        <img
          :src="avatar.avatar || defaultAvatar"
          :alt="avatar.name"
          class="avatar-card__cover"
          @error="(e) => (e.target.src = defaultAvatar)"
        />
        <img v-if="localHired" :src="isHiredIcon" class="avatar-card__hired-badge" alt="" />
      </div>
      <div class="avatar-card__meta">
        <div class="avatar-card__title-row">
          <ElTooltip
            :content="avatar.display_name||avatar.name"
            placement="top"
            :show-after="300"
            :disabled="!isNameOverflow"
          >
            <span ref="nameRef" class="avatar-card__title">{{ avatar.display_name||avatar.name }}</span>
          </ElTooltip>
          <span class="avatar-card__version">{{ avatar.version }}</span>
          <ElTooltip
            v-if="avatarStatusTag && avatarStatusTag.text"
            placement="top"
            :show-after="200"
            :disabled="!isStatusRejected || !avatarStatusTag.rejection"
          >
            <template #content>
              <span>{{ avatarStatusTag.rejection }}</span>
            </template>
            <span
              class="avatar-card__status"
              :class="`avatar-card__status--${avatarStatusTag.mod || 'default'}`"
              :style="avatarStatusTag.color || avatarStatusTag.bgColor ? {
                color: avatarStatusTag.color,
                backgroundColor: avatarStatusTag.bgColor
              } : undefined"
            >
              {{ avatarStatusTag.text }}
            </span>
          </ElTooltip>
          <span
            v-else-if="avatarStatusTag && avatarStatusTag.text"
            class="avatar-card__status"
            :class="`avatar-card__status--${avatarStatusTag.mod || 'default'}`"
            :style="avatarStatusTag.color || avatarStatusTag.bgColor ? {
              color: avatarStatusTag.color,
              backgroundColor: avatarStatusTag.bgColor
            } : undefined"
          >
            {{ avatarStatusTag.text }}
          </span>
        </div>
        <div class="avatar-card__tag-row">
          <div
            v-if="avatar.qualityLevel || avatar.extraTagCount"
            class="avatar-card__tags-inline"
          >
            <span v-if="avatar.qualityLevel" class="avatar-card__tag avatar-card__tag--quality">
              {{ avatar.qualityLevel }}
            </span>
            <ElTooltip
              v-if="avatar.extraTagCount"
              placement="top"
              :show-after="200"
              :disabled="!extraTagsTooltip"
            >
              <template #content>
                <span>{{ extraTagsTooltip }}</span>
              </template>
              <span class="avatar-card__tag avatar-card__tag--extra">
                +{{ avatar.extraTagCount }}
              </span>
            </ElTooltip>
          </div>
          <span v-if="avatar.author" class="avatar-card__org">@{{ avatar.author }}</span>
        </div>
      </div>
    </div>

    <!-- 中区：摘要（与 skill-market-card__desc 一致） -->
    <p class="avatar-card__desc">{{ avatar.description || '-' }}</p>

    <!-- 下区：统计 + 操作 -->
    <div  class="avatar-card__footer">
      <div v-if="showStats" class="avatar-card__stats">
        <span class="avatar-card__stat">
          <img
            class="avatar-card__stat-icon"
            :src="downloadIcon"
            alt=""
            width="14"
            height="14"
            decoding="async"
          />
          <span class="avatar-card__stat-num">{{ formatCount(avatar.stats_hires || 0) }}</span>
        </span>


        <CollectButton
          type="avatar"
          :resource-id="avatar.id"
          :initial-collected="avatar.favorited"
          :initial-count="avatar.stats_stars || 0"
        />
      </div>

      <div class="avatar-card__actions" @click.stop>
        <template v-if="!viewOnly">
        <ChatButton
          size="small"
          :id="avatar.id"
          :agent-display-name="avatar.display_name || avatar.name"
          :agent-name="avatar.name || avatar.display_name"
          :agent-avatar-url="avatar.avatar || ''"
          :highlight="guideStep === 1"
        />
        <AvatarHireButton
          class="avatar-card__btn-hire"
          size="small"
          :avatar="avatar"
          :highlight="guideStep === 2"
          @hired="onHireSuccess"
          @dialog-open="isDialogOpen = true"
          @dialog-close="isDialogOpen = false"
        />
        </template>

        <MarketCustomButton
        v-else
        size="small"
        @click.stop="handleViewOnlyOpen"
      >
        查看
      </MarketCustomButton>
      </div>
    </div>

 
  </article>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElTooltip } from 'element-plus'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import ChatButton from "@/modules/market/components/ChatButton.vue"
import AvatarHireButton from '@/modules/market/components/AvatarHireButton.vue'
import downloadIcon from './images/download.svg'
import defaultAvatar from './images/m01@2x.png'
import isHiredIcon from './images/isHired.png'

const props = defineProps({
  avatar: {
    type: Object,
    required: true,
  },
  viewOnly: {
    type: Boolean,
    default: false,
  },
  ocAgentId: {
    type: String,
    default: '',
  },
  /** 卡片头部状态角标，未传时不显示 */
  statusTag: {
    type: Object,
    default: null,
  },
  /** 仅查看模式下，点击「查看」是否改为向父级派发 view-detail */
  viewOnlyEmitOpen: {
    type: Boolean,
    default: false,
  },
  /**
   * 引导步骤：0=无引导，1=高亮聊天按钮，2=高亮聘用按钮
   * 非零时卡片保持选中边框样式
   */
  guideStep: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['view-detail', 'collect-change', 'hired'])

const nameRef = ref(null)
const isNameOverflow = ref(false)

function checkNameOverflow() {
  if (nameRef.value) {
    isNameOverflow.value = nameRef.value.scrollWidth > nameRef.value.clientWidth
  }
}

onMounted(() => {
  nextTick(() => {
    checkNameOverflow()
  })
})

watch(() => props.avatar.name, () => {
  nextTick(() => {
    checkNameOverflow()
  })
})

/** 「+N」悬浮：展示与 extraTagCount 对应的剩余标签文案（函数绑定，避免部分环境下 computed 未挂到实例） */
function formatExtraTagTooltip() {
  const from = props.avatar?.extraTagLabels
  if (Array.isArray(from) && from.length) {
    return from
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join('、')
  }
  const tags = props.avatar?.tags
  if (Array.isArray(tags) && tags.length > 1) {
    return tags
      .slice(1)
      .map((t) =>
        String(typeof t === 'string' ? t : (t?.name ?? t?.title ?? t?.label ?? '')).trim()
      )
      .filter(Boolean)
      .join('、')
  }
  return ''
}

/** 供 ElTooltip 使用，避免渲染期多次调用与异常冒泡 */
const extraTagsTooltip = computed(() => {
  try {
    return formatExtraTagTooltip()
  } catch {
    return ''
  }
})

const router = useRouter()
const isHovered = ref(false)
const isDialogOpen = ref(false)
const localHired = ref(props.avatar.is_installed ?? false)
const avatarStatusTag = computed(() => {
  const t = props.statusTag
  if (!t || typeof t !== 'object') return null
  const text = String(t.text ?? '').trim()
  if (!text) return null
  return {
    text,
    mod: String(t.mod ?? 'default').trim() || 'default',
    color: t.color,
    bgColor: t.bgColor,
    rejection: t.rejection,
  }
})

const isStatusRejected = computed(() => {
  return avatarStatusTag.value?.mod === 'rejected'
})

/**
 * 统计区显隐：
 * - 市场卡片（未传 statusTag）：始终展示
 * - 我的上传卡片（传了 statusTag）：仅「已发布」展示
 */
const showStats = computed(() => {
  if (!props.statusTag) return true
  return avatarStatusTag.value?.mod === 'published'
})
function toHireDetail() {
  router.push({ name: 'HiredDetail', params: { id: props.avatar.raw.ocAgentId }, query: { origin: 'agent-market' } })
}
function handleViewOnlyOpen() {
  if (props.viewOnlyEmitOpen) {
    emit('view-detail', props.avatar.id)
    return
  }
  toHireDetail()
}
 

function onHireSuccess() {
  localHired.value = true
  // 手动增加聘用次数
  if (props.avatar.stats_downloads != null) {
    props.avatar.stats_downloads = Number(props.avatar.stats_downloads) + 1
  }
  if (props.avatar.stats_hires != null) {
    props.avatar.stats_hires = Number(props.avatar.stats_hires) + 1
  }
  emit('hired', { id: props.avatar.id, avatar: props.avatar })
}

 

watch(
  () => props.avatar.is_installed,
  (value) => {
    localHired.value = value ?? false
  }
)

function formatCount(num) {
  if (!num) return '0'
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}
</script>

<style lang="scss" scoped>
.avatar-card {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #ECEEF3;
  cursor: pointer;
  overflow: visible;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .avatar-card__actions {
      opacity: 1;
      pointer-events: auto;
    }
  }

  // &.is-hired {
  //   border-color: rgba(99, 179, 237, 0.3);
  // }

  &.is-guide-active,
  &.is-dialog-active {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .avatar-card__actions {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

/* ---- 悬停浮层 ---- */
.hover-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.btn-analysis {
  padding: 5px 12px;
  border-radius: 20px;
  border: none;
  background: rgba(47, 53, 71, 0.82);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.2s;

  &:hover {
    background: rgba(47, 53, 71, 0.95);
  }
}

.hover-btn-enter-active,
.hover-btn-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.hover-btn-enter-from,
.hover-btn-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---- 上区：头像 + meta（对齐 skill-market-card__top） ---- */
.avatar-card__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.avatar-card__media {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  margin: -32px 0 0px;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.avatar-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-card__hired-badge {
  position: absolute;
  left: -8px;
  bottom: -8px;
  width: 51px;
  height: 30px;
  z-index: 2;
}

.avatar-card__meta {
  min-width: 0;
  flex: 1;
}

.avatar-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  margin-bottom: 4px;
}

.avatar-card__title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: normal;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.avatar-card__version {
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #91949e;
  flex-shrink: 0;
}

.avatar-card__status {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
}

// .avatar-card__status--unpublished {
//   color: #f5b400;
//   background: #fffaeb;
// }

// .avatar-card__status--published {
//   color: #24bcad;
//   background: #eefcfa;
// }

// .avatar-card__status--reviewing {
//   color: #00b4e0;
//   background: #ebfbff;
// }

// .avatar-card__status--rejected {
//   color: #ed4543;
//   background: #fef0f0;
// }

// .avatar-card__status--default {
//   color: #606572;
//   background: #eceef3;
// }

.avatar-card__tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  max-width: 100%;
}

.avatar-card__tags-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-right: 8px;
}

.avatar-card__tag {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #606572;
  white-space: nowrap;
  z-index: 0;
}

.avatar-card__tag--quality,
.avatar-card__tag--extra {
  background: #eceef3;
}

.avatar-card__org {
  margin: 0;
  min-width: 0;
  font-size: 12px;
  color: #91949e;
  padding: 0;
}

/* ---- 中区：描述（对齐 skill-market-card__desc） ---- */
.avatar-card__desc {
  flex: 1;
  margin: 8px 0;
  font-size: 13px;
  font-weight: normal;
  line-height: 21px;
  text-align: justify;
  letter-spacing: normal;
  color: #91949e;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 42px;
}

/* ---- 下区：与 SkillMarketCard 同款布局 ---- */
.avatar-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 28px;
  margin-top: auto;
}

.avatar-card__stats {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #9ca3af;
}

.avatar-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #606572;
  line-height: 1;
}

.avatar-card__stat-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: block;
  object-fit: contain;
}

.avatar-card__stat-num {
  display: inline-flex;
  align-items: center;
  min-height: 14px;
  line-height: 14px;
  font-size: inherit;
}

.avatar-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* 收藏：与 Skill 市场卡一致 */
.avatar-card__footer--view-only {
  justify-content: flex-end;
}

/* 「查看」小号默认按钮，与 Skill 市场卡「查看」一致 */
.avatar-card__btn-install.market-custom-button--default {
  width: 60px;
  flex-shrink: 0;
  line-height: 1.2;
  font-size: 13px;
  color: #2f3547;
  --mcb-default-hover-color: #2f3547;
  --mcb-default-active-color: #2f3547;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.avatar-card:hover .avatar-card__footer--view-only .avatar-card__btn-install,
.avatar-card.is-hovered .avatar-card__footer--view-only .avatar-card__btn-install {
  opacity: 1;
  pointer-events: auto;
}
</style>
