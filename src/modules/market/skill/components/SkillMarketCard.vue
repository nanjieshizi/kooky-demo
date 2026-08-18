<template>
  <article
    class="skill-market-card"
    :class="{ 'is-dialog-active': isDialogOpen }"
    role="button"
    tabindex="0"
    @click="emit('open')"
  >
    <div class="skill-market-card__top">
      <div   class="skill-market-card__icon-wrap">
        <img
          class="skill-market-card__icon"
          :src="coverUrl"
          :alt="title || 'Skill'"
          loading="lazy"
        />
      </div>
      <div class="skill-market-card__meta">
        <div   class="skill-market-card__title-row">
          <h3
            class="skill-market-card__title"
            :title="displayTitle"
          >{{ displayTitle }}</h3>
          <span  class="skill-market-card__version">{{ version }}</span>
        </div>
        <!-- 第二行：标签与 @组织 同一行（左对齐，间距由 gap 控制） -->
        <div
          class="skill-market-card__tag-org-row"
        >
          <!-- 多个标签：固定「首标签 + +n」，悬停 +n 看气泡（与接口 data.results[].tags 条数一致即可） -->
          <div
            v-if="safeTags.length > 1"
            class="skill-market-card__tags skill-market-card__tags--in-row skill-market-card__tags--overflow"
          >
            <span class="skill-market-card__tag">{{ safeTags[0] }}</span>
            <span
              class="skill-market-card__tag skill-market-card__tag--more skill-market-card__overflow-tip"
              :aria-label="`其余标签：${tooltipRestTags}`"
            >
              +{{ safeTags.length - 1 }}
              <span class="skill-market-card__overflow-bubble" role="tooltip">
                {{ tooltipRestTags }}
              </span>
            </span>
          </div>
          <div
            v-else-if="safeTags.length === 1"
            class="skill-market-card__tags skill-market-card__tags--in-row"
          >
            <span class="skill-market-card__tag">{{ safeTags[0] }}</span>
          </div>
          <span  class="skill-market-card__org">{{ org }}</span>
        </div>
      </div>
    </div>

    <p  class="skill-market-card__desc">{{ description || '-' }}</p>

    <div class="skill-market-card__footer">
      <div   class="skill-market-card__stats">
        <span   class="skill-market-card__stat">
          <img
            class="skill-market-card__stat-icon"
            :src="skillDownloadStatUrl"
            alt=""
            width="14"
            height="14"
            decoding="async"
          />
          <span class="skill-market-card__stat-num">{{ viewsDisplay }}</span>
        </span>
        <CollectButton
          type="skill"
          :resource-id="skillSlug"
          :initial-collected="collected"
          :initial-count="stars"
        />
      </div>
      <div class="skill-market-card__actions">
        <template v-if="viewOnly">
          <MarketCustomButton
            class="skill-market-card__btn-install"
            size="small"
            @click.stop="emit('open')"
          >查看</MarketCustomButton>
        </template>
        <template v-else>
          <SkillOneClickInstallButton
            :skill-slug="skillSlug"
            mode="dialog"
            size="small"
            @installed="handleInstalled"
            @dialog-open="isDialogOpen = true"
            @dialog-close="isDialogOpen = false"
          />
        </template>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import skillDownloadStatUrl from '@/assets/skill/skill-xiazai.svg?url'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import SkillOneClickInstallButton from '@/modules/market/components/SkillOneClickInstallButton.vue'

const props = defineProps({  title: { type: String, default: '' },
  version: { type: String, default: '' },
  org: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
  description: { type: String, default: '' },
  views: { type: [Number, String], default: 0 },
  stars: { type: [Number, String], default: 0 },
  /** 是否已收藏（切换后展示「已收藏」） */
  collected: { type: Boolean, default: false },
  /**
   * Skill 标识，用于一键安装到「我的分身」等；与列表/详情 slug 一致
   */
  skillSlug: { type: String, default: '' },
  /**
   * 是否已安装到默认数字人；为 true 时安装按钮为「已安装」态
   */
  isInstalled: { type: Boolean, default: false },
  /** 仅查看模式：隐藏收藏和安装按钮，只显示查看按钮 */
  viewOnly: { type: Boolean, default: false },
  coverUrl: {
    type: String,
    default: 'https://picsum.photos/seed/101/200/200',
  },
})

const emit = defineEmits(['collect', 'installed', 'open'])

const isDialogOpen = ref(false)

// 本地浏览量状态，用于安装成功后手动加1
const localViews = ref(props.views)

// 监听 props.views 变化，同步到本地状态
watch(() => props.views, (newVal) => {
  localViews.value = newVal
}, { immediate: true })

/** 稳定数组，避免 template 对 null/非数组访问；与列表 patch 时结构一致 */
const safeTags = computed(() =>
  Array.isArray(props.tags)
    ? props.tags.filter((t) => t != null && String(t).trim() !== '')
    : [],
)

const hasTitle = computed(() => Boolean(props.title?.trim()))
/** 列表标题展示：空标题用「-」占位（与详情等字段空态一致） */
const displayTitle = computed(() => String(props.title ?? '').trim() || '-')
const hasVersion = computed(() => Boolean(props.version?.trim()))
const hasOrg = computed(() => Boolean(props.org?.trim()))
const showTitleRow = computed(() => hasTitle.value || hasVersion.value)
const showCover = computed(() => Boolean(props.coverUrl))
const hasDescription = computed(() => Boolean(props.description?.trim()))

const showViews = computed(() => {
  const n = Number(localViews.value)
  return !Number.isNaN(n) && n > 0
})
const showStars = computed(() => {
  const n = Number(props.stars)
  return !Number.isNaN(n) && n > 0
})
const showStats = computed(() => showViews.value || showStars.value)

const tooltipRestTags = computed(() => safeTags.value.slice(1).join('、'))

function formatCount(val) {
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const viewsDisplay = computed(() => formatCount(localViews.value))
const starsDisplay = computed(() => formatCount(props.stars))

// 安装成功回调：手动给浏览量加1
function handleInstalled(event) {
  const currentViews = Number(localViews.value)
  if (!Number.isNaN(currentViews)) {
    localViews.value = currentViews + 1
  }
  emit('installed', event)
}
</script>

<style lang="scss" scoped>
.skill-market-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 296px;
  min-height: 0;
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #ECEEF3;
  cursor: pointer;
  overflow: visible;

  &:hover,
  &.is-dialog-active {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .skill-market-card__actions {
      opacity: 1;
      pointer-events: auto;
    }
  }
  .el-button {
    height: 28px;
  }
}

.skill-market-card__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  // margin-bottom: 10px;
}

.skill-market-card__icon-wrap {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  overflow: hidden;
  // background: #f4f4f5;
}

.skill-market-card__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.skill-market-card__meta {
  min-width: 0;
  flex: 1;
}

.skill-market-card__title-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.skill-market-card__title {
  margin: 0;
  min-width: 0;
  // flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: normal;
  color: #2f3547;
}

.skill-market-card__version {
  flex-shrink: 0;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #91949e;
}

.skill-market-card__tag-org-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  max-width: 100%;
}

.skill-market-card__org {
  margin: 0;
  min-width: 0;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #91949e;
}

.skill-market-card__tags {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.skill-market-card__tags--in-row {
  flex-shrink: 0;
  margin-bottom: 0;
}

/* 多标签：悬停「首标签 + +n」区域时，在 +n 上方展示深色气泡（无 Teleport，避免列表 patch 问题） */
.skill-market-card__tags--overflow {
  position: relative;
  cursor: default;
}

.skill-market-card__overflow-tip {
  position: relative;
  cursor: pointer;
}

.skill-market-card__overflow-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 40;
  box-sizing: border-box;
  /* 定位包含块是窄的「+n」父级时，width:auto 会按父宽收缩导致一字一行；用 max-content 按文案自然宽度展开 */
  width: max-content;
  max-width: min(240px, calc(100vw - 24px));
  padding: 6px 10px;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  letter-spacing: normal;
  color: #ffffff;
  text-align: center;
  white-space: normal;
  word-break: normal;
  overflow-wrap: break-word;
  background: #2f3547;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-50%);
  transition:
    opacity 0.12s ease,
    visibility 0.12s ease;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border: 5px solid transparent;
    border-top-color: #2f3547;
  }
}

.skill-market-card__overflow-tip:hover .skill-market-card__overflow-bubble {
  opacity: 1;
  visibility: visible;
}

.skill-market-card__tag {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 6px;
  gap: 4px;
  z-index: 0;
  border-radius: 4px;
  background: #eceef3;
  font-size: 12px;
  line-height: 20px;
  color: #6b7280;
  transition: background-color 0.15s ease;

  &:hover {
    background: #f5f6f9;
  }

  &--more {
    background: #eceef3;
    color: #4b5563;

    &:hover {
      background: #f5f6f9;
    }
  }
}

.skill-market-card__desc {
  margin:  8px 0px;
  flex: 1;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  font-weight: normal;
  line-height: 21px;
  text-align: justify;
  letter-spacing: normal;
  color: #91949e;
  max-height: 42px;
  white-space: normal;
  word-break: break-word;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.skill-market-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  // padding-top: 8px;
}

.skill-market-card__stats {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #9ca3af;
}

.skill-market-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #606572;
  line-height: 1;
}

.skill-market-card__stat-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: block;
  object-fit: contain;
}

.skill-market-card__stat-num {
  display: inline-flex;
  align-items: center;
  min-height: 14px;
  line-height: 14px;
  font-size: inherit;
}

.skill-market-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* 仅「查看」行：与 one-click 安装区分的根节点带 `skill-one-click-install` */
.skill-market-card__btn-install:not(.skill-one-click-install).market-custom-button--default {
  line-height: 1.2;
  font-size: 13px;
  color: #2f3547;
  --mcb-default-hover-color: #2f3547;
  --mcb-default-active-color: #2f3547;
}

</style>
