<template>
  <div class="skill-card" @click.stop="handleView">
    <div class="card-top">
      <div class="card-icon">
        <img v-if="displayImageSrc" :src="displayImageSrc" alt="" />
        <div v-else class="icon-placeholder">{{ item.displayName?.charAt(0) }}</div>
      </div>
      <div class="card-content">
        <div class="card-header">
          <div class="title-row">
            <h3 class="card-title">{{ item.displayName }}</h3>
            <span class="version">v{{ item.version }}</span>
          </div>
          <el-tooltip
            v-if="props.item.status === 'rejected' || props.item.reviewStatus === 'rejected'"
            :content="props.item.reviewComment || '审核未通过'"
            placement="top"
          >
            <span
              class="version-card__status"
              :class="`version-card__status--${statusMeta.mod}`"
              :style="statusMeta.color || statusMeta.bgColor ? {
                color: statusMeta.color,
                backgroundColor: statusMeta.bgColor
              } : undefined"
            >{{ statusMeta.text }}</span>
          </el-tooltip>
          <span
            v-else
            class="version-card__status"
            :class="`version-card__status--${statusMeta.mod}`"
            :style="statusMeta.color || statusMeta.bgColor ? {
              color: statusMeta.color,
              backgroundColor: statusMeta.bgColor
            } : undefined"
          >{{ statusMeta.text }}</span>
        </div>
        <div class="card-tags">
          <template v-if="(item.tags?.length || 0) > 2">
            <el-tooltip
              :content="(item.tags || [])[0] || ''"
              :disabled="!isTagTruncated((item.tags || [])[0])"
              placement="top"
            >
              <span class="tag tag-quality">{{ formatTagText((item.tags || [])[0] || '') }}</span>
            </el-tooltip>
            <el-tooltip
              :content="formatExtraTagsTooltip(item.tags || [])"
              placement="top"
            >
              <span class="tag tag-extra">+{{ (item.tags || []).length - 1 }}</span>
            </el-tooltip>
          </template>
          <template v-else>
            <el-tooltip
              v-for="(tag, idx) in (item.tags ?? []).slice(0, 2)"
              :key="`tag-${idx}`"
              :content="tag"
              :disabled="!isTagTruncated(tag)"
              placement="top"
            >
              <span class="tag tag-quality">{{ formatTagText(tag) }}</span>
            </el-tooltip>
          </template>
          <span class="displayName">@{{ item?.author?.displayName }}</span>
        </div>
      </div>
    </div>
    <p class="card-desc">{{ item.summary }}</p>
    <div class="card-footer">
      <div class="stats">
        <span class="stat-item">
          <img :src="statDownloadIcon" class="stat-icon" width="14" height="14" alt="" aria-hidden="true" />
          {{ formatNumber(item.downloads ?? item.statsDownloads ?? 0) }}
        </span>
        <CollectButton
          type="skill"
          :resource-id="item.slug"
          :initial-collected="item.isStarred"
          :initial-count="item.stars"
        />
      </div>
      <MarketCustomButton class="query-btn" size="small" @click.stop="handleView">
        查看
      </MarketCustomButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import defaultAvatarSrc from '@/assets/default-avatar.svg'
import statDownloadIcon from '@/assets/market/myupload/stat-download.svg'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import type { SkillItem, ViewMode } from '../types'
import { getListCardStatusMeta } from '../utils/listCardStatusMeta'
import { formatTagText, isTagTruncated, formatExtraTagsTooltip } from '../utils/tagDisplay'

/** 列表项：与详情「版本历史」状态字段对齐（status active/draft、reviewStatus 等） */
type SkillCardItem = Omit<SkillItem, 'status'> & {
  status?: SkillItem['status'] | 'active'
  image?: string
  tags?: string[]
  author?: { displayName?: string }
  reviewStatus?: 'draft' | 'published' | 'reviewing' | 'rejected'
  /** 部分列表接口可能使用别名 */
  downloads?: number
  stars?: number
  isStarred?: boolean
}

const props = defineProps<{
  item: SkillCardItem
  viewMode: ViewMode
}>()

/** 与 Skill 市场列表进入详情一致（路由 param 为 slug，无 slug 时用数字 id） */
const COVER_FALLBACK = 'https://picsum.photos/seed/101/200/200'

const router = useRouter()

function handleView() {
  const slug = String(props.item.slug ?? '').trim()
  const legacyId = props.item.id != null ? String(props.item.id).trim() : ''
  const routeId = slug || legacyId
  if (!routeId) return
  const resolved = displayImageSrc.value?.trim() || ''
  const cover =
    resolved && !/default-avatar\.png/i.test(resolved) ? resolved : COVER_FALLBACK
  router.push({
    name: 'MySkillDetail',
    params: { id: routeId },
    query: { from: 'my-uploads' },
    state: { skillHeroCover: cover, skillHeroForSlug: routeId },
  })
}

function formatNumber(num: number) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

/**
 * 解析封面图地址：
 * - `data:image/...` 等内联图原样返回
 * - `http(s)://` 完整地址原样返回
 * - 含 `default-avatar.png` 的占位路径改为本地资源
 * - 其它相对路径与 one 网关 base 拼接
 */
function handleImageUrl(item: SkillCardItem): string {
  const raw = String(item.image ?? item.avatar ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return defaultAvatarSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

const displayImageSrc = computed(() => handleImageUrl(props.item))

const statusMeta = computed(() => getListCardStatusMeta(props.item))
</script>

<style lang="scss" scoped>
.skill-card {
  box-sizing: border-box;
  width: 100%;
  height: 166px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;
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

    .query-btn {
      display: inline-flex !important;
    }
  }
}

/* 小号、白底描边由 MarketCustomButton 提供；仅保留卡片区交互与字色 */
.query-btn {
  display: none !important;
}

.card-top {
  display: flex;
  gap: 16px;
  height: 48px;
}

.card-icon {
  // flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  // background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  // margin-top: -32px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version {
  flex-shrink: 0;
  font-size: 13px;
  color: #8f959e;
}

/* 与 AvatarDetailView 版本历史 statusMeta 一致 */
.version-card__status {
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

.version-card__status--unpublished {
  color: #f5b400;
  background: #fffaeb;
}

.version-card__status--published {
  color: #24bcad;
  background: #eefcfa;
}

.version-card__status--reviewing {
  color: #00b4e0;
  background: #ebfbff;
}

.version-card__status--rejected {
  color: #ed4543;
  background: #fef0f0;
}

.version-card__status--default {
  color: #606572;
  background: #eceef3;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  // flex-wrap: wrap;
  overflow: hidden;
  height: 22px;

  .displayName {
    font-family: PingFang SC;
    font-size: 12px;
    font-weight: normal;
    line-height: 20px;
    text-align: right;
    letter-spacing: normal;
    /* 文本色&图标色/三级文本色 */
    color: #91949E;
  }
}

/* 与 AgentCard 一致：plain 标签样式，非 el-tag */
.tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  color: #606572;
  white-space: nowrap;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-quality,
.tag-extra {
  flex-shrink: 0;
  background: #eceef3;
}

.author-info {
  font-size: 13px;
  color: #8f959e;
}

.card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #646a73;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  height: 42px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #8f959e;
}

.stat-icon {
  flex-shrink: 0;
  display: block;
}

.view-btn {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  padding: 5px 16px;
  height: 28px;
  border-radius: 8px;
  background-color: #171B26;
  border-color: #171B26;
}
</style>
