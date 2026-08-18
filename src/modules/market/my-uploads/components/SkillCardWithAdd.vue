<template>
  <article class="skill-market-card skill-card-with-add" tabindex="0">
    <div class="skill-market-card__top">
      <div class="skill-market-card__icon-wrap">
        <img
          v-if="coverSrc"
          class="skill-market-card__icon"
          :src="coverSrc"
          :alt="displayTitle"
          loading="lazy"
        />
        <div v-else class="skill-market-card__icon-placeholder">
          {{ initialLetter }}
        </div>
      </div>
      <div class="skill-market-card__meta">
        <div class="skill-market-card__title-row">
          <h3 class="skill-market-card__title" :title="displayTitle">{{ displayTitle }}</h3>
          <span v-if="versionDisplay" class="skill-market-card__version">{{ versionDisplay }}</span>
        </div>
        <div class="skill-market-card__tag-org-row">
          <div
            v-if="safeTags.length > 1"
            class="skill-market-card__tags skill-market-card__tags--in-row skill-market-card__tags--overflow"
          >
            <span class="skill-market-card__tag">{{ safeTags[0] }}</span>
            <el-tooltip
              :content="tooltipRestTags"
              placement="top"
              effect="dark"
              :show-after="200"
            >
              <span class="skill-market-card__tag skill-market-card__tag--more">
                +{{ safeTags.length - 1 }}
              </span>
            </el-tooltip>
          </div>
          <div
            v-else-if="safeTags.length === 1"
            class="skill-market-card__tags skill-market-card__tags--in-row"
          >
            <span class="skill-market-card__tag">{{ safeTags[0] }}</span>
          </div>
          <span   class="skill-market-card__org">@{{ item.author?.displayName }}</span>
          <span v-if="item.isMyUpload" class="skill-market-card__my-upload">由我上传的</span>
        </div>
      </div>
    </div>

    <p class="skill-market-card__desc">{{ item.summary || '-' }}</p>

    <div class="skill-market-card__footer">
      <div v-if="!(item.isMyUpload && item.status !== 'active')" class="skill-market-card__stats">
        <span class="skill-market-card__stat">
          <img
            class="skill-market-card__stat-icon"
            :src="skillDownloadStatUrl"
            alt=""
            width="14"
            height="14"
            decoding="async"
          />
          <span class="skill-market-card__stat-num">{{ item.downloads }}</span>
        </span>
        <CollectButton
          type="skill"
          :resource-id="item.slug"
          :initial-collected="item.isStarred"
          :initial-count="item.stars"
        />
      </div>
      <div class="skill-card-with-add__actions">
        <MarketCustomButton
          class="skill-card-with-add__btn-add"
          variant="dark"
          size="small"
          @click.stop="isAdded ? emit('remove', item) : emit('add', item)"
        >
          {{ isAdded ? '移除添加' : '添加' }}
        </MarketCustomButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import skillDownloadStatUrl from '@/assets/skill/skill-xiazai.svg?url'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'

const props = defineProps<{
  item: Record<string, any>
  /** 是否已加入当前编辑上下文 */
  isAdded?: boolean,
}>()

const emit = defineEmits<{ add: [item: Record<string, any>]; remove: [item: Record<string, any>] }>()

const safeTags = computed(() =>
  Array.isArray(props.item?.tags)
    ? props.item.tags.filter((t: unknown) => t != null && String(t).trim() !== '')
    : [],
)

const displayTitle = computed(() => String(props.item?.displayName ?? '').trim() || '-')

const versionDisplay = computed(() => formatSkillVersion(props.item?.version))


const coverSrc = computed(() => {
  const u = props.item?.avatar
  return u != null && String(u).trim() !== '' ? String(u).trim() : ''
})

const initialLetter = computed(() => {
  const t = String(props.item?.displayName ?? '').trim()
  return t ? t.charAt(0) : '?'
})



const orgDisplay = computed(() => {
  const o = props.item?.orgName ?? props.item?.org ?? ''
  const s = String(o).trim()
  if (!s) return ''
  return s.startsWith('@') ? s : `@${s}`
})

const tooltipRestTags = computed(() => safeTags.value.slice(1).join('、'))

function formatSkillVersion(v: unknown) {
  if (v == null || String(v).trim() === '') return ''
  const s = String(v).trim()
  return s.startsWith('v') ? s : `v${s}`
}

function formatCount(val: unknown) {
  const n = Number(val)
  if (Number.isNaN(n)) return String(val ?? '')
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const viewsDisplay = computed(() => formatCount(props.item?.statsDownloads ?? 0))
const starsDisplay = computed(() => formatCount(props.item?.statsStars ?? 0))
</script>

<style lang="scss" scoped>
/* 层级与模板一致：根卡片 → 上区 → 简介 → 页脚（统计 + 添加） */
.skill-market-card.skill-card-with-add {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #eceef3;
  box-shadow: none;
  cursor: default;
  max-width: 290px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover,
  &:focus-within,
  &.is-added {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    .skill-card-with-add__actions {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  }

  /* -------- 上区：图标 + 标题 / 标签行 -------- */
  .skill-market-card__top {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .skill-market-card__icon-wrap {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      overflow: hidden;

      .skill-market-card__icon {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .skill-market-card__icon-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
    }

    .skill-market-card__meta {
      min-width: 0;
      flex: 1;

      .skill-market-card__title-row {
        display: flex;
        flex-wrap: nowrap;
        align-items: baseline;
        gap: 8px;
        min-width: 0;

        .skill-market-card__title {
          margin: 0;
          min-width: 0;
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
      }

      .skill-market-card__tag-org-row {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
        max-width: 100%;

        .skill-market-card__tags {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          max-width: 100%;

          &.skill-market-card__tags--in-row {
            flex-shrink: 0;
            margin-bottom: 0;
          }

          &.skill-market-card__tags--overflow {
            position: relative;
            cursor: default;
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

            &.skill-market-card__tag--more {
              background: #eceef3;
              color: #4b5563;

              &:hover {
                background: #f5f6f9;
              }
            }
          }
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

        .skill-market-card__my-upload {
          flex-shrink: 0;
          font-size: 12px;
          line-height: 20px;
          font-weight: 500;
          color: #ff684e;
        }
      }
    }
  }

  /* -------- 简介 -------- */
  .skill-market-card__desc {
    margin: 8px 0;
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

  /* -------- 页脚：统计 + 添加（悬停卡片显隐）-------- */
  .skill-market-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;

    .skill-market-card__stats {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 13px;
      color: #9ca3af;
      min-width: 0;

      .skill-market-card__stat {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #606572;
        line-height: 1;

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
      }
    }

    .skill-card-with-add__actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      opacity: 0;
      // display: block;
      pointer-events: none;
      transition: opacity 0.15s ease;

      .skill-card-with-add__btn-add.market-custom-button--dark {
        padding: 6px 12px;
        line-height: 1.2;
        font-size: 13px;
      }
    }
  }
}
</style>
