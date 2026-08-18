<template>
  <div class="skill-detail">
    <Loading :visible="loading" text="加载中..." />
    <div class="skill-detail__breadcrumb-wrap">
      <Breadcrumb
        :items="breadcrumbItems"
        back-url="/market/skill"
      />
    </div>

    <p
      v-if="loadError && !loading"
      class="skill-detail__load-error"
    >
      {{ loadError }}
    </p>

    <div
      v-else-if="!loading && detail"
      class="skill-detail__layout"
    >
      <main class="skill-detail__main">
        <!-- 标题区 -->
        <header class="skill-detail__hero">
          <div class="skill-detail__hero-media">
            <div class="skill-detail__hero-icon-wrap">
              <img
                class="skill-detail__hero-image"
                :src="heroImageSrc"
                loading="lazy"
                decoding="async"
              />
              <!-- <el-icon
                v-else
                class="skill-detail__hero-icon"
                :size="40"
              >
                <Document />
              </el-icon> -->
            </div>
          </div>
          <div class="skill-detail__hero-content">
            <div class="skill-detail__hero-top">
              <div class="skill-detail__hero-main">
                <div class="skill-detail__hero-title-row">
                  <h1 class="skill-detail__hero-title">{{ skill.title }}</h1>
                  <span
                    v-if="skill.version"
                    class="skill-detail__hero-version"
                  >{{ skill.version }}</span>
                </div>
              </div>
              <div class="skill-detail__hero-right">
                <!-- 非我的上传，或我的上传且当前版本已发布，才展示 hero-stats -->
                <div v-if="!isMyUploadsViewContext || isCurrentVersionPublished" class="skill-detail__hero-stats">
                  <span class="skill-detail__stat">
                    <img
                      class="skill-detail__stat-icon"
                      :src="skillXiazaiUrl"
                      alt=""
                      width="16"
                      height="16"
                      decoding="async"
                    />
                    <span class="skill-detail__stat-num">{{ skill.viewsDisplay }}</span>
                  </span>
                  <CollectButton
                    type="skill"
                    :resource-id="skillSlug"
                    :initial-collected="skill.isStarred"
                    :initial-count="skill.starsDisplay"
                  />
                </div>
                <div class="skill-detail__hero-actions">
                  <template v-if="!isMyUploadsViewContext">
                    <SkillOneClickInstallButton
                      :skill-slug="skillSlug"
                      mode="dropdown"
                      @installed="onOneClickInstallInstalled"
                    />
                  </template>
                  <!-- 我的上传：已发布可点击，否则置灰 -->
                  <template v-else>
                    <MarketCustomButton
                      v-if="isCurrentVersionPublished"
                      variant="dark"
                      @click="goToMarketDetail"
                    >
                      去市场查看
                    </MarketCustomButton>
                  </template>
                </div>
              </div>
            </div>
            <div class="skill-detail__hero-subrow skill-detail__hero-subrow--full">
              <div
                v-if="skill.tags.length"
                class="skill-detail__hero-tags"
              >
                <span
                  v-for="t in skill.tags"
                  :key="t"
                  class="skill-detail__tag"
                >{{ t }}</span>
              </div>
              <p class="skill-detail__hero-meta-line">{{ skill.metaLine }}</p>
            </div>
          </div>
        </header>

        <!-- 基本信息（不含文件区，按需求已省略文件树/预览） -->
        <section class="skill-detail__section">
          <h2 class="skill-detail__section-title">
            <img class="skill-detail__section-title-icon" :src="skillJxUrl" alt="" />
            <span>基本信息</span>
          </h2>
          <div class="skill-detail__basic">
            <div class="skill-detail__label">描述</div>
            <p class="skill-detail__basic-desc">{{ skill.description || '-' }}</p>
          </div>
        </section>

        <!-- 文件预览 -->
        <section v-if="skillSlug" class="skill-detail__section">
          <!-- <h2 class="skill-detail__section-title">
            <img class="skill-detail__section-title-icon" :src="skillJxUrl" alt="" />
            <span>文件</span>
          </h2> -->
          <div class="skill-detail__file-browser">
            <div class="skill-detail__label">文件</div>
            <SkillFileBrowser
              :slug="skillSlug"
              :version="selectedApiVersion || undefined"
            />
          </div>
        </section>

        <!-- 更新日志：接口字段 changelog（随版本选择切换） -->
        <section class="skill-detail__section">
          <h2 class="skill-detail__section-title">
            <img class="skill-detail__section-title-icon" :src="skillJxUrl" alt="" />
            <span>更新日志</span>
          </h2>
          <div class="skill-detail__basic">
            <div class="skill-detail__label">描述</div>
            <p class="skill-detail__basic-desc">{{ skill.changelog || '-' }}</p>
          </div>
        </section>

        <!-- ========== 被引用的数字人 - 暂隐藏开始（含 GET /skills/{slug}/agents）========== -->
        <!--
        <section
          v-if="referencedDigitalHumans.length"
          v-loading="referencedAgentsLoading"
          class="skill-detail__section skill-detail__section--ref-agents"
        >
          <h2 class="skill-detail__section-title">
            <img class="skill-detail__section-title-icon" :src="skillJxUrl" alt="" />
            <span>被引用的数字人</span>
          </h2>
          <div class="skill-detail__ref-grid">
            <article
              v-for="(dh, dhIdx) in referencedDigitalHumans"
              :key="`ref-dh-${dhIdx}-${dh.id}`"
              class="skill-detail__ref-card"
            >
              <div class="skill-detail__ref-avatar-wrap">
                <img
                  class="skill-detail__ref-avatar"
                  :src="dh.avatar"
                  :alt="dh.name"
                  loading="lazy"
                />
              </div>
              <div class="skill-detail__ref-body">
                <div class="skill-detail__ref-head">
                  <span class="skill-detail__ref-name">{{ dh.name }}</span>
                  <span class="skill-detail__ref-ver">{{ dh.version }}</span>
                </div>
                <div class="skill-detail__ref-tag-org-row">
                  <div
                    v-if="dh.visibleTags.length || dh.extraTagCount > 0"
                    class="skill-detail__ref-tags"
                  >
                    <span
                      v-for="tg in dh.visibleTags"
                      :key="tg"
                      class="skill-detail__ref-tag"
                    >{{ tg }}</span>
                    <span
                      v-if="dh.extraTagCount > 0"
                      class="skill-detail__ref-tag skill-detail__ref-tag--more skill-detail__ref-overflow-tip"
                      :aria-label="`其余标签：${dh.restTagsText}`"
                    >+{{ dh.extraTagCount }}
                      <span class="skill-detail__ref-overflow-bubble" role="tooltip">
                        {{ dh.restTagsText }}
                      </span>
                    </span>
                  </div>
                  <span v-if="dh.org" class="skill-detail__ref-org">{{ dh.org }}</span>
                </div>
                <p class="skill-detail__ref-desc">{{ dh.description }}</p>
                <div class="skill-detail__ref-footer">
                  <span class="skill-detail__ref-stat">
                    <img
                      class="skill-detail__ref-stat-icon"
                      :src="skillDownloadStatUrl"
                      alt=""
                      width="15"
                      height="15"
                      decoding="async"
                    />
                    <span class="skill-detail__ref-stat-num">{{ dh.viewsDisplay }}</span>
                  </span>
                  <span class="skill-detail__ref-stat">
                    <img
                      class="skill-detail__ref-stat-icon"
                      :src="skillStarOutlineUrl"
                      alt=""
                      width="15"
                      height="15"
                      decoding="async"
                    />
                    <span class="skill-detail__ref-stat-num">{{ dh.starsDisplay }}</span>
                  </span>
                  <el-button
                    class="skill-detail__ref-view-btn"
                    type="primary"
                    size="small"
                    :disabled="!dh.viewTargetId"
                    @click.stop="goRefDigitalHuman(dh)"
                  >
                    查看
                  </el-button>
                </div>
              </div>
            </article>
          </div>
        </section>
        -->
        <!-- ========== 被引用的数字人 - 暂隐藏结束 ========== -->
      </main>

      <aside class="skill-detail__aside">
        <div class="skill-detail__aside-head">
          <h2 class="skill-detail__aside-title">版本历史</h2>
          <div v-if="isMyUploadsViewContext" class="skill-detail__version-actions">
            <el-tooltip content="上传新版本" placement="top" :show-after="200">
              <img
                class="skill-detail__version-action-icon"
                :src="uploadBtnIcon"
                alt="上传新版本"
                @click="onUploadNewVersionFromMyUploads"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top" :show-after="200">
              <img
                class="skill-detail__version-action-icon"
                :src="deleteBinIcon"
                alt="删除"
                @click="onDeleteAllVersionsFromMyUploads"
              />
            </el-tooltip>
          </div>
        </div>
        <ul class="skill-detail__version-list">
          <li
            v-for="(ver, vIdx) in versionHistory"
            :key="`${ver.version}-${vIdx}`"
            role="button"
            tabindex="0"
            class="skill-detail__version-card"
            :class="{ 'is-selected': selectedVersionIndex === vIdx }"
            :aria-pressed="selectedVersionIndex === vIdx"
            @click="onVersionItemClick(vIdx)"
            @keydown.enter.prevent="onVersionItemClick(vIdx)"
          >
            <div class="skill-detail__version-head">
              <span class="skill-detail__version-num">
                {{ ver.version }}
                <img
                  v-if="vIdx === 0"
                  class="skill-detail__version-new-img"
                  :src="skillNewPngUrl"
                  alt=""
                />
              </span>
              <el-tooltip
                v-if="ver.statusMeta && isMyUploadsViewContext && (ver.status === 'rejected' || ver.reviewStatus === 'rejected')"
                :content="ver.reviewComment || '审核未通过'"
                placement="top"
              >
                <span
                  class="skill-detail__version-status"
                  :class="`skill-detail__version-status--${ver.statusMeta.mod}`"
                  :style="ver.statusMeta.color || ver.statusMeta.bgColor ? {
                    color: ver.statusMeta.color,
                    backgroundColor: ver.statusMeta.bgColor
                  } : undefined"
                >{{ ver.statusMeta.text }}</span>
              </el-tooltip>
              <span
                v-else-if="ver.statusMeta && isMyUploadsViewContext"
                class="skill-detail__version-status"
                :class="`skill-detail__version-status--${ver.statusMeta.mod}`"
                :style="ver.statusMeta.color || ver.statusMeta.bgColor ? {
                  color: ver.statusMeta.color,
                  backgroundColor: ver.statusMeta.bgColor
                } : undefined"
              >{{ ver.statusMeta.text }}</span>
            </div>
            <div class="skill-detail__version-meta">
              <span class="skill-detail__version-meta-part">{{ ver.metaAuthor }}</span>
              <span
                class="skill-detail__version-meta-divider"
                aria-hidden="true"
              />
              <span class="skill-detail__version-meta-part">{{ ver.dateYmd }}</span>
            </div>
            <p class="skill-detail__version-preview">{{ ver.changelogPreview || '-' }}</p>
           
            <div
             v-if="isMyUploadsViewContext"
              class="skill-detail__version-actions"
            >
              <div class="skill-detail__version-stat-icons">
                <!-- 编辑：草稿、审核失败、已下架 -->
                <el-tooltip
                  v-if="isVersionEditable(ver)"
                  content="编辑"
                  placement="top"
                  effect="dark"
                  :show-after="200"
                >
                  <span class="skill-detail__icon-stat-tooltip-host">
                    <button
                      type="button"
                      class="skill-detail__icon-stat"
                      aria-label="编辑"
                      @click.stop="handleVersionEdit(ver)"
                    >
                      <img :src="editIcon" class="skill-detail__icon-stat__img" width="14" height="14" alt="" />
                    </button>
                  </span>
                </el-tooltip>
                <!-- 下架：已发布 -->
                <el-tooltip
                  v-if="versionIsPublished(ver)"
                  content="下架"
                  placement="top"
                  effect="dark"
                  :show-after="200"
                >
                  <span class="skill-detail__icon-stat-tooltip-host">
                    <img
                      :src="shelfDownIcon"
                      class="skill-detail__icon-stat__img"
                      width="14"
                      height="14"
                      alt=""
                      @click.stop="handleVersionUnpublish(ver)"
                    />
                  </span>
                </el-tooltip>
                <el-tooltip
                  :content="marketVersionDeleteTooltip(ver)"
                  placement="top"
                  effect="dark"
                  :show-after="200"
                >
                  <span class="skill-detail__icon-stat-tooltip-host">
                    <button
                      type="button"
                      class="skill-detail__icon-stat"
                      aria-label="删除"
                      :disabled="isMarketVersionDeleteDisabled(ver)"
                      @click.stop="onDeleteVersionFromMyUploads(ver, vIdx)"
                    >
                      <img
                        :src="deleteBinIcon"
                        class="skill-detail__icon-stat__img"
                        width="14"
                        height="14"
                        alt=""
                      />
                    </button>
                  </span>
                </el-tooltip>
              </div>
            </div>
          </li>
        </ul>
      </aside>
    </div>

    <!-- 删除确认弹窗 -->
    <MarketConfirmDialog
      ref="confirmDialogRef"
      :title="deleteDialogTitle || '确认移除该skill吗？'"
      :content="deleteDialogContent || '移除后，无法继续使用，请确认后进行操作'"
      confirm-text="删除"
      confirm-variant="danger"
      @confirm="handleConfirmDelete"
    />
    <!-- 发布确认弹窗 -->
    <MarketConfirmDialog
      ref="publishDialogRef"
      :title="`确认发布版本 v${pendingShelfVersion?.version} 吗?`"
      content="发布并审核成功后将在广场可见。"
      confirm-text="确认发布"
      confirm-variant="dark"
      @confirm="handleConfirmPublish"
    />
    <!-- 下架确认弹窗 -->
    <MarketConfirmDialog
      ref="unpublishDialogRef"
      :title="`确认下架版本 v${pendingShelfVersion?.version} 吗?`"
      content="下架后，市场不可见，且无法再次发布该版本，请确认后操作。"
      confirm-text="确认下架"
      confirm-variant="danger"
      @confirm="handleConfirmUnpublish"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Document } from '@element-plus/icons-vue'
import skillXiazaiUrl from '@/assets/skill/skill-xiazai.svg?url'
import skillDownloadStatUrl from '@/assets/skill/skill-sz.svg?url'
import skillJxUrl from '@/assets/skill/skill-jx.svg?url'
import skillNewPngUrl from '@/assets/skill/skill-new.png'
import deleteBinIcon from '@/assets/market/myupload/skill-version-delete.svg'
import editIcon from '@/assets/market/edit.png'
import uploadBtnIcon from '@/assets/market/myupload/upload-btn.svg'
import shelfUpIcon from '@/assets/market/myupload/skill-version-shelf-up.svg'
import shelfDownIcon from '@/assets/market/myupload/skill-version-shelf-down.svg'
import Breadcrumb from '@/shared/components/Breadcrumb.vue'
import Loading from '@/shared/components/Loading/index.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import MarketConfirmDialog from '@/modules/market/components/MarketConfirmDialog.vue'
import CollectButton from '@/modules/market/components/CollectButton.vue'
import SkillOneClickInstallButton from '@/modules/market/components/SkillOneClickInstallButton.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteSkillVersion, deleteSkillBySlug, setSkillVisibility } from '@/modules/market/my-uploads/services/myUploadsApi'
import {
  fetchSkillAgents,
  fetchSkillMarketDetail,
} from '../skillMarketApi.js'
import SkillFileBrowser from '@/modules/market/components/SkillFileBrowser.vue'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

/** 从错误对象中提取消息：优先使用 response.data.detail，否则返回默认值 */
function extractErrorMessage(e, defaultMsg) {
  if (e && typeof e === 'object') {
    const err = e
    const detail = err?.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim()
    }
  }
  return defaultMsg
}

const route = useRoute()
const router = useRouter()
const skillSlug = computed(() => String(route.params.id ?? '').trim())

const confirmDialogRef = ref(null)
const publishDialogRef = ref(null)
const unpublishDialogRef = ref(null)
const pendingDeleteVersion = ref(null)
const pendingShelfVersion = ref(null)
const deleteDialogTitle = ref('')
const deleteDialogContent = ref('')

/** 从「我的上传」点「查看」进入本页时通常携带 `?from=my-uploads` */
const isMyUploadsViewContext = computed(
  () => String(route.query.from ?? '').trim() === 'my-uploads',
)

/**
 * 是否已安装：以详情 GET /skills/{slug}/detail 返回的 `data.entity` 为准
 *（字段名：`isInstalled`，兼容 `is_installed`；一键安装成功后回写同字段）
 */
const detailSkillIsInstalled = computed(() => {
  const e = detail.value?.entity
  if (!e || typeof e !== 'object') return false
  return Boolean(e.isInstalled)
})

/**
 * AgentHub `GET …/skills/{slug}/detail`：`entity.createdAt` / `updatedAt` 支持毫秒时间戳或 YYYY-MM-DD
 */
function toEntityTimestampMs(val) {
  if (val == null) return 0
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val
  const s = String(val).trim()
  if (!s) return 0
  const parsed = Date.parse(s)
  if (Number.isFinite(parsed)) return parsed
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * 解析详情接口 JSON → 本页状态（字段与文档 `data.entity`、`data.isFollowed` 一致，不做旧版 skill 结构映射）
 */
function parseSkillDetailApiResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('响应数据异常')
  }
  const st = raw.status
  if (st != null && Number(st) === 404) {
    throw new Error(String(raw.message || 'Not found'))
  }
  if (st != null && Number(st) !== 200 && String(st) !== '200') {
    throw new Error(String(raw.message || '请求失败'))
  }
  const data =
    raw.data != null && typeof raw.data === 'object' ? raw.data : null
  const entity =
    (data?.entity != null && typeof data.entity === 'object'
      ? data.entity
      : null) ??
    (raw.entity != null && typeof raw.entity === 'object' && !Array.isArray(raw.entity)
      ? raw.entity
      : null)
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    throw new Error('响应数据异常')
  }
  const isFollowed = Boolean(
    data && Object.prototype.hasOwnProperty.call(data, 'isFollowed')
      ? data.isFollowed
      : raw.isFollowed,
  )
  return { entity, isFollowed }
}

function detailFollowed(model) {
  return Boolean(model?.isFollowed)
}

// 被引用的数字人 - 暂隐藏
// const REF_DH_COVER_FALLBACK =
//   'https://picsum.photos/seed/refdh/200/200'

const loading = ref(true)
const loadError = ref('')
const detail = ref(null)

/** 被引用的数字人：GET /skills/{slug}/agents 的 results */
const referencedAgentsList = ref([])
const referencedAgentsLoading = ref(false)

/** 右侧「版本历史」当前选中项（与接口 versionHistory 下标一致，0 为最新一条） */
const selectedVersionIndex = ref(0)
/** 详情接口当前请求的 version（与路由 slug 解耦） */
const selectedApiVersion = ref('')

/** 从市场列表 router.push 传入的卡片封面（详情接口无 skill 图字段） */
const passedHeroCover = ref('')

function readHeroCoverFromRouterState() {
  try {
    const st = history.state
    const id = String(route.params.id ?? '').trim()
    if (!st || typeof st !== 'object') {
      passedHeroCover.value = ''
      return
    }
    const forSlug = String(st.skillHeroForSlug ?? '').trim()
    if (!forSlug || forSlug !== id) {
      passedHeroCover.value = ''
      return
    }
    const u =
      st.skillHeroCover != null ? String(st.skillHeroCover).trim() : ''
    passedHeroCover.value = u
  } catch {
    passedHeroCover.value = ''
  }
}

watch(
  () => route.params.id,
  () => {
    readHeroCoverFromRouterState()
  },
  { immediate: true },
)

/**
 * data:image/...;base64,... 中 base64 段若含换行/空白，部分浏览器会拒绘；
 * SVG 常见 `;utf8` 在 `<img src>` 下不兼容，改为 `charset=utf-8`
 */
function normalizeImageDataUri(raw) {
  let s = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!/^data:/i.test(s)) return s
  if (/^data:image\/svg\+xml;utf8,/i.test(s)) {
    s = s.replace(
      /^data:image\/svg\+xml;utf8,/i,
      'data:image/svg+xml;charset=utf-8,',
    )
  }
  const comma = s.indexOf(',')
  if (comma < 0) return s
  const meta = s.slice(0, comma)
  const body = s.slice(comma + 1)
  if (/;base64$/i.test(meta)) {
    return `${meta},${body.replace(/\s/g, '')}`
  }
  return s
}

function resolveAssetUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return normalizeImageDataUri(raw)
  if (/^https?:\/\//i.test(raw)) return raw
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

function isPlaceholderAvatar(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return true
  if (/^data:/i.test(s)) return false
  return /default-avatar\.png$/i.test(s) || /\/default-avatar\.png(\?|$)/i.test(s)
}

/** 左上角头像：优先列表传入 → entity.image（非占位） */
const heroImageSrc = computed(() => detail.value?.entity?.avatar ?? '')

function formatVersionLabel(verRaw) {
  const ver = verRaw != null ? String(verRaw).trim() : ''
  if (!ver) return ''
  if (!/^v\d/i.test(ver) && /^\d/.test(ver)) return `v${ver}`
  return ver
}

function formatTs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    return new Date(n).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '—'
  }
}

/** 版本卡片日期：YYYY-MM-DD（与稿一致） */
function formatDateYmd(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    const d = new Date(n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return '—'
  }
}

/** 版本行作者展示：优先条目 author，否则 owner（@显示名 或 @handle） */
function formatVersionMetaAuthor(owner, versionAuthorRaw) {
  const a = String(versionAuthorRaw ?? '').trim()
  if (a) return a.startsWith('@') ? a : `@${a.replace(/^@/, '')}`
  const name = String(owner?.displayName ?? '').trim()
  const h = String(owner?.handle ?? '').trim()
  if (name) return `@${name.replace(/^@/, '')}`
  if (h) return h.startsWith('@') ? h : `@${h.replace(/^@/, '')}`
  return '—'
}

function normVersionKey(v) {
  return String(v ?? '').trim().replace(/^v/i, '')
}

function formatK(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '0'
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

function changelogLines(text) {
  const t = String(text ?? '').trim()
  if (!t) return ['（无说明）']
  const parts = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : [t]
}

const rawVersionList = computed(() => {
  const list = detail.value?.entity?.versionHistory
  return Array.isArray(list) ? list : []
})

const selectedVersionRaw = computed(() => {
  const list = rawVersionList.value
  const i = selectedVersionIndex.value
  if (i < 0 || i >= list.length) return null
  return list[i]
})

watch(rawVersionList, (list) => {
  if (selectedVersionIndex.value >= list.length) {
    selectedVersionIndex.value = 0
  }
})

const skill = computed(() => {
  const e = detail.value?.entity
  const slug = skillSlug.value
  if (!e) {
    return {
      title: slug || 'Skill',
      version: '',
      tags: [],
      metaLine: '',
      viewsDisplay: '0',
      starsDisplay: '0',
      description: '',
      changelog: '',
      isStarred: false,
      official: false,
    }
  }
  const downloads = Number(e.downloads) || 0
  const stars = Number(e.stars) || 0
  const authorLabel = String(e.author ?? '').trim()
  const by = authorLabel || '—'

  const sel = selectedVersionRaw.value
  const latestKey = normVersionKey(e.version)
  const selKey = sel ? normVersionKey(sel.version) : ''
  const idx = selectedVersionIndex.value
  const viewingLatest =
    !sel ||
    (latestKey && selKey && selKey === latestKey) ||
    (!latestKey && idx === 0)

  let displayVersion = formatVersionLabel(e.version)
  let description = String(e.description ?? '').trim()
  let changelog = String(e.changelog ?? '').trim()
  let metaLine = `由 @${by} · 更新于 ${e.updatedAt}`

  if (!viewingLatest && sel) {
    displayVersion = formatVersionLabel(sel.version)
    const ch = String(sel.changelog ?? '').trim()
    const lic = String(sel.license ?? '').trim()
    const rowCreated =
      typeof sel.createdAt === 'number' && Number.isFinite(sel.createdAt)
        ? sel.createdAt
        : toEntityTimestampMs(sel.createdAt)
    const vDate = formatTs(rowCreated)
    changelog = ch
    // if (ch) {
    //   description = ch.length > 160 ? `${ch.slice(0, 160)}…` : ch
    // }
    metaLine = lic
      ? `本版本 ${displayVersion} · ${vDate} · ${lic}`
      : `本版本 ${displayVersion} · ${vDate}`
  }

  return {
    title: String(e.displayName ?? '').trim() || slug,
    version: displayVersion,
    tags: Array.isArray(e.tags) ? e.tags : [],
    metaLine,
    viewsDisplay: formatK(downloads),
    starsDisplay: formatK(stars),
    description,
    changelog,
    isStarred: detailFollowed(detail.value),
    official: e.status === 'official',
  }
})

const breadcrumbItems = computed(() => {
  const name = skill.value.title
  const ver = skill.value.version
  const lastLabel = ver ? `${name} ${ver} 详情` : `${name} 详情`
  if (isMyUploadsViewContext.value) {
    return [
      // { label: '我的上传', to: '/market/my-uploads' },
      { label: lastLabel },
    ]
  }
  const history = router.options.history.state.breadcrumbHistory || []
  if (history.length > 0) {
    // 从其他详情页跳转来的，不显示当前详情页的列表页
    return [...history, { label: lastLabel }]
  }
  // 直接访问或从市场列表来的
  // return [{ label: 'Skill 市场', to: '/market/skill' }, { label: lastLabel }]
  return [{ label: lastLabel }]
})

// 被引用的数字人 - 暂隐藏
// function mapReferencedDhRow(raw, index) {
//   const id = String(
//     raw?.id ?? raw?.slug ?? raw?.name ?? raw?.digitalHumanId ?? `ref-${index}`,
//   ).trim()
//   const name =
//     String(raw?.displayName ?? raw?.name ?? '').trim() || id || '数字人'
//   const ver = raw?.version != null ? String(raw.version).trim() : ''
//   const versionLabel =
//     ver && !/^v\d/i.test(ver) && /^\d/.test(ver) ? `v${ver}` : ver
//   const tags = Array.isArray(raw?.tags)
//     ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
//     : []
//   // 与 SkillMarketCard 一致：多标签采用「首标签 + +n」
//   const visibleTags = tags.slice(0, 1)
//   const extraTagCount = Math.max(0, tags.length - 1)
//   const restTagsText = tags.slice(1).join('、')
//   const author = raw?.owner || raw?.author || {}
//   const handle = String(author.handle ?? author.name ?? '').trim()
//   const orgRaw = String(raw?.org ?? raw?.orgName ?? '').trim()
//   const org =
//     handle && handle.startsWith('@')
//       ? handle
//       : handle
//         ? `@${handle.replace(/^@/, '')}`
//         : orgRaw
//           ? orgRaw.startsWith('@')
//             ? orgRaw
//             : `@${orgRaw.replace(/^@/, '')}`
//           : ''
//   const description = String(
//     raw?.summary ?? raw?.description ?? '',
//   ).trim()
//   const stats = raw?.stats || {}
//   const views =
//     Number(raw?.downloads ?? stats.downloads ?? raw?.views) || 0
//   const stars = Number(raw?.stars ?? stats.stars) || 0
//   // 勿用 `a ?? b` 串联：后端若给 `image: ""` 会挡住后面的 avatar
//   const imgRaw = [
//     raw?.image,
//     raw?.avatar,
//     raw?.avatarUrl,
//     raw?.coverUrl,
//   ]
//     .map((x) => String(x ?? '').trim())
//     .find(Boolean) || ''
//   let avatar = resolveAssetUrl(imgRaw)
//   if (
//     !avatar ||
//     isPlaceholderAvatar(imgRaw) ||
//     isPlaceholderAvatar(avatar)
//   ) {
//     avatar = REF_DH_COVER_FALLBACK
//   }
//   const viewTargetId = String(
//     raw?.slug ?? raw?.name ?? raw?.id ?? raw?.digitalHumanId ?? '',
//   ).trim()
//   return {
//     id,
//     name,
//     version: versionLabel,
//     visibleTags,
//     extraTagCount,
//     restTagsText,
//     org,
//     description,
//     viewsDisplay: formatK(views),
//     starsDisplay: formatK(stars),
//     avatar,
//     viewTargetId,
//   }
// }

// const referencedDigitalHumans = computed(() =>
//   referencedAgentsList.value.map((row, i) => mapReferencedDhRow(row, i)),
// )

// function goRefDigitalHuman(dh) {
//   const id = dh.viewTargetId
//   if (!id) return
//
//   const name = skill.value.title
//   const ver = skill.value.version
//   const currentHistory = router.options.history.state.breadcrumbHistory || []
//
//   // 构建新的历史：保留当前历史 + 添加当前详情页（带 to）
//   const newHistory = currentHistory.length > 0
//     ? [
//         ...currentHistory,
//         { label: ver ? `${name} ${ver} 详情` : `${name} 详情`, to: `/market/skill/${skillSlug.value}` },
//       ]
//     : [
//         { label: 'Skill 市场', to: '/market/skill' },
//         { label: ver ? `${name} ${ver} 详情` : `${name} 详情`, to: `/market/skill/${skillSlug.value}` },
//       ]
//
//   router.push({
//     name: 'AvatarDetail',
//     params: { id },
//     state: {
//       breadcrumbHistory: newHistory,
//     },
//   })
// }

/**
 * 与「我的上传」/ Avatar 详情中版本行展示一致：versionHistory[].status 为主
 * active → 已发布，draft → 未发布
 * 优先使用接口返回的 statusLabel、statusColor、statusBgColor
 */
function versionItemStatusMeta(item) {
  if (!item || typeof item !== 'object') return null

  // 优先使用接口返回的动态值
  if (item.statusLabel) {
    let mod = 'default'
    if (item.statusLabel.includes('未通过') || item.statusLabel.includes('拒绝')) {
      mod = 'rejected'
    } else if (item.statusLabel.includes('发布') && !item.statusLabel.includes('未发布')) {
      mod = 'published'
    } else if (item.statusLabel.includes('未发布') || item.statusLabel.includes('草稿')) {
      mod = 'unpublished'
    } else if (item.statusLabel.includes('审核')) {
      mod = 'reviewing'
    }
    return {
      text: item.statusLabel,
      mod,
      color: item.statusColor,
      bgColor: item.statusBgColor,
    }
  }

  const rawSt = item.status
  const st =
    rawSt != null && String(rawSt).trim() !== ''
      ? String(rawSt).trim().toLowerCase()
      : ''
  const rs = item.reviewStatus

  if (st === 'active') return { text: '已发布', mod: 'published' }
  if (st === 'draft') return { text: '未发布', mod: 'unpublished' }
  if (st === 'reviewing' || st === 'pending' || st === 'in_review') {
    return { text: '审核中', mod: 'reviewing' }
  }
  if (st === 'rejected') return { text: '审核未通过', mod: 'rejected' }

  if (rs === 'rejected') return { text: '审核未通过', mod: 'rejected' }
  if (rs === 'reviewing') return { text: '审核中', mod: 'reviewing' }
  if (rs === 'published') return { text: '已发布', mod: 'published' }
  if (rs === 'draft') return { text: '未发布', mod: 'unpublished' }
  return null
}

const versionHistory = computed(() => {
  const list = rawVersionList.value
  const e = detail.value?.entity
  const authorStr = String(e?.author ?? '').trim()
  const ownerCtx = { displayName: authorStr.replace(/^@/, ''), handle: '' }
  return list.map((v) => {
    const changelogPreview = String(v?.changelog ?? '').trim()
    const versionPlain = normVersionKey(v?.version)
    const rowCreated =
      typeof v?.createdAt === 'number' && Number.isFinite(v.createdAt)
        ? v.createdAt
        : toEntityTimestampMs(v?.createdAt)
    const status =
      v?.status != null && String(v.status).trim() !== ''
        ? String(v.status).trim()
        : null
    const row = {
      versionId: v?.id != null ? Number(v.id) : null,
      status,
      reviewStatus: v?.reviewStatus,
      reviewComment: v?.reviewComment,
      version: versionPlain || String(v?.version ?? '').trim() || '—',
      metaAuthor: formatVersionMetaAuthor(ownerCtx, v?.ownerName),
      dateYmd: formatDateYmd(rowCreated),
      changelogPreview,
      // 传递接口返回的状态标签动态值
      statusLabel: v?.statusLabel,
      statusColor: v?.statusColor,
      statusBgColor: v?.statusBgColor,
    }
    return {
      ...row,
      statusMeta: versionItemStatusMeta(row),
    }
  })
})

function marketVersionDeleteTooltip(ver) {
  if (ver.reviewStatus === 'reviewing') return '审核中，暂不可删除'
  if (ver.versionId == null || Number.isNaN(Number(ver.versionId)))
    return '缺少版本 ID，无法删除'
  return '删除'
}

function isMarketVersionDeleteDisabled(ver) {
  if (ver.reviewStatus === 'reviewing') return true
  if (ver.versionId == null || Number.isNaN(Number(ver.versionId)))
    return true
  return false
}

function skillPackageSlugForMyUploadsApi() {
  const e = detail.value?.entity
  return String(e?.name ?? e?.slug ?? skillSlug.value ?? '').trim()
}

function versionIsPublished(ver) {
  if (ver.status === 'active') return true
  if (ver.status === 'draft') return false
  return ver.reviewStatus === 'published'
}

/** 当前选中版本是否已发布 */
const isCurrentVersionPublished = computed(() => {
  const list = rawVersionList.value
  const ver = list[selectedVersionIndex.value]
  if (!ver) return false
  return versionIsPublished(ver)
})

/** 版本是否可编辑：草稿、审核失败（已下架不可编辑） */
function isVersionEditable(ver) {
  const st = ver.status
  return st === 'draft' || st === 'rejected'
}

function handleVersionEdit(ver) {
  const slug = skillPackageSlugForMyUploadsApi()
  if (!slug) return
  router.push({
    name: 'SkillCreate',
    query: {
      editSlug: slug,
      editVersionId: ver.versionId != null ? String(ver.versionId) : '',
      editVersion: ver.version || '',
      from: 'my-uploads',
      slug, // 添加 slug 参数，用于固定 Skill ID
    },
  })
}

function goToMarketDetail() {
  router.push({
    name: 'SkillDetail',
    params: { id: skillSlug.value },
  })
}

function canToggleShelf(ver) {
  if (ver.status === 'active' || ver.status === 'draft') return true
  if (ver.reviewStatus === 'published' || ver.reviewStatus === 'draft') return true
  return false
}

function isShelfActionDisabled(ver) {
  return ver.reviewStatus === 'reviewing'
}

function shelfTooltipContent(ver) {
  if (isShelfActionDisabled(ver)) return '审核中，暂不可上下架'
  return versionIsPublished(ver) ? '下架' : '发布'
}

function handleShelfToggle(ver) {
  if (isShelfActionDisabled(ver)) {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (versionIsPublished(ver)) {
    handleVersionUnpublish(ver)
  } else {
    handleVersionPublish(ver)
  }
}

function handleVersionPublish(ver) {
  if (ver.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (ver.reviewStatus === 'rejected') {
    ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  pendingShelfVersion.value = ver
  publishDialogRef.value?.open()
}

function handleVersionUnpublish(ver) {
  if (ver.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  if (ver.reviewStatus === 'rejected') {
    ElMessage.warning('当前审核未通过，请重新提交发布')
    return
  }
  pendingShelfVersion.value = ver
  unpublishDialogRef.value?.open()
}

async function handleConfirmPublish() {
  const ver = pendingShelfVersion.value
  if (!ver) return
  await doShelfAction(ver, true, '已提交发布申请，审核通过后广场可见')
  pendingShelfVersion.value = null
}

async function handleConfirmUnpublish() {
  const ver = pendingShelfVersion.value
  if (!ver) return
  await doShelfAction(ver, false, '操作成功，当前版本广场不可见')
  pendingShelfVersion.value = null
}

async function doShelfAction(ver, isPublic, successMsg = '操作成功') {
  const slug = skillPackageSlugForMyUploadsApi()
  if (!slug) {
    ElMessage.error('缺少 Skill 标识')
    return
  }
  try {
    await setSkillVisibility(slug, isPublic, ver.versionId)
    ElMessage.success(successMsg)
    await loadDetail({ silent: true })
  } catch (e) {
    console.error(e)
    ElMessage.error(extractErrorMessage(e, '操作失败'))
  }
}

function onUploadNewVersionFromMyUploads() {
  const skillId = detail.value?.entity?.id
  const slug = skillPackageSlugForMyUploadsApi()
  const avatar = detail.value?.entity?.avatar ?? ''
  const tags = Array.isArray(detail.value?.entity?.tags) ? detail.value.entity.tags.join(',') : ''
  const prevVersion = detail.value?.entity?.versionHistory?.[0]?.version ?? ''
  router.push({
    name: 'SkillCreate',
    query: {
      ...(skillId != null ? { skillId: String(skillId) } : {}),
      ...(slug ? { slug } : {}),
      ...(avatar ? { prevAvatar: avatar } : {}),
      ...(tags ? { prevTags: tags } : {}),
      ...(prevVersion ? { prevVersion } : {}),
    },
  })
}

/** 删除所有版本（删除整个 Skill） */
function onDeleteAllVersionsFromMyUploads() {
  const slug = skillPackageSlugForMyUploadsApi()
  if (!slug) {
    ElMessage.error('缺少 Skill 标识')
    return
  }
  const list = rawVersionList.value
  if (!list || list.length === 0) {
    ElMessage.warning('没有可删除的版本')
    return
  }

  pendingDeleteVersion.value = {
    slug,
    versionId: list[0]?.versionId,
    isDeleteAll: true,
  }
  deleteDialogTitle.value = '确认删除当前 Skill？'
  deleteDialogContent.value = '删除后该 Skill 所有版本将在市场同步下架，无法被搜索访问，且操作不可撤回，请谨慎操作。'
  confirmDialogRef.value?.open()
}

async function onDeleteVersionFromMyUploads(ver) {
  if (ver.reviewStatus === 'reviewing') {
    ElMessage.warning('已经在审核中啦~')
    return
  }
  const slug = skillPackageSlugForMyUploadsApi()
  if (!slug) {
    ElMessage.error('缺少 Skill 标识')
    return
  }
  const versionId = ver?.versionId
  if (versionId == null || Number.isNaN(Number(versionId))) {
    ElMessage.warning('缺少版本 ID，无法删除')
    return
  }
  const verLabel = String(ver.version || '').replace(/^v/i, '')

  pendingDeleteVersion.value = { ver, slug, versionId }
  deleteDialogTitle.value = `确认删除版本 v${verLabel}？`
  deleteDialogContent.value = '删除后该版本将在市场同步下架，无法被搜索访问，且操作不可撤回，请谨慎操作。'
  confirmDialogRef.value?.open()
}

async function handleConfirmDelete() {
  const { ver, slug, versionId, isDeleteAll } = pendingDeleteVersion.value || {}
  if (!slug) return

  try {
    // 删除整个 Skill（所有版本）
    if (isDeleteAll) {
      await deleteSkillBySlug(slug)
      ElMessage.success('删除成功')
      router.push({ name: 'MarketSkill' })
      return
    }

    // 删除单个版本
    if (!versionId) return
    const list = rawVersionList.value
    const wasOnlyVersion = list.length === 1
    await deleteSkillVersion(slug, Number(versionId))
    ElMessage.success('操作成功')
    if (wasOnlyVersion) {
      router.push({ name: 'MarketSkill' })
      return
    }
    selectedApiVersion.value = ''
    selectedVersionIndex.value = 0
    await loadDetail()
  } catch (e) {
    console.error(e)
    ElMessage.error(extractErrorMessage(e, '移除失败'))
  } finally {
    pendingDeleteVersion.value = null
  }
}

// 被引用的数字人 - 暂隐藏（GET /skills/{slug}/agents）
// async function loadReferencedAgents() {
//   const slug = skillSlug.value
//   if (!slug) {
//     referencedAgentsList.value = []
//     return
//   }
//   // 与当前详情版本保持一致，避免拉到其它版本的引用数字人
//   const version = String(
//     selectedApiVersion.value || detail.value?.entity?.version || '',
//   ).trim()
//   referencedAgentsLoading.value = true
//   try {
//     const { results } = await fetchSkillAgents(slug, {
//       page: 1,
//       pageSize: 100,
//       ...(version ? { version } : {}),
//     })
//     referencedAgentsList.value = Array.isArray(results) ? results : []
//   } catch {
//     referencedAgentsList.value = []
//   } finally {
//     referencedAgentsLoading.value = false
//   }
// }

function syncSelectedVersionIndexAfterLoad(requestedRaw) {
  const req = normVersionKey(requestedRaw)
  if (!req) {
    selectedVersionIndex.value = 0
    return
  }
  const list = Array.isArray(detail.value?.entity?.versionHistory)
    ? detail.value.entity.versionHistory
    : []
  const idx = list.findIndex((row) => normVersionKey(row?.version) === req)
  selectedVersionIndex.value = idx >= 0 ? idx : 0
}

function onVersionItemClick(vIdx) {
  // 如果点击的是已选中的版本，不触发接口请求
  if (vIdx === selectedVersionIndex.value) return

  const list = rawVersionList.value
  const row = list[vIdx]
  const raw = row ? String(row.version ?? '').trim() : ''
  selectedVersionIndex.value = vIdx
  if (!raw) return
  loadDetail({ version: raw, silent: true, refreshReferencedAgents: true })
}

/**
 * @param {{ silent?: boolean, version?: string, refreshReferencedAgents?: boolean }} [options]
 * - silent：不展示全页 v-loading、不清空 detail（收藏同步、点版本历史防闪屏）
 * - version：详情 query
 * - refreshReferencedAgents：是否强制刷新「被引用的数字人」（切版本时应为 true）
 */
async function loadDetail(options = {}) {
  const silent = Boolean(options.silent)
  const slug = skillSlug.value
  if (!slug) {
    loading.value = false
    loadError.value = '无效的 Skill 地址'
    detail.value = null
    // referencedAgentsList.value = [] // 被引用的数字人 - 暂隐藏
    selectedApiVersion.value = ''
    selectedVersionIndex.value = 0
    return
  }
  if (!silent) {
    loading.value = true
    loadError.value = ''
    detail.value = null
  }

  const prevDetailSnapshot = silent ? detail.value : null
  // 被引用的数字人 - 暂隐藏
  // const prevAgentsSnapshot = silent
  //   ? referencedAgentsList.value.slice()
  //   : null
  const prevSelectedApiVersion = silent ? selectedApiVersion.value : null
  const prevVersionIndex = silent ? selectedVersionIndex.value : null

  const mergedRaw =
    options.version !== undefined
      ? String(options.version ?? '').trim()
      : String(selectedApiVersion.value ?? '').trim()
  const versionParam = mergedRaw
  if (options.version !== undefined) {
    selectedApiVersion.value = versionParam
  }

  function rollbackSilentDetailState() {
    if (prevDetailSnapshot) detail.value = prevDetailSnapshot
    // if (prevAgentsSnapshot) referencedAgentsList.value = prevAgentsSnapshot // 被引用的数字人 - 暂隐藏
    if (prevSelectedApiVersion !== null) {
      selectedApiVersion.value = prevSelectedApiVersion
    }
    if (prevVersionIndex !== null) {
      selectedVersionIndex.value = prevVersionIndex
    }
  }

  try {
    const raw = await fetchSkillMarketDetail(slug, {
      ...(versionParam ? { version: versionParam } : {}),
      /** 我的上传查看：marketplace=false；市场等入口：marketplace=true */
      marketplace: !isMyUploadsViewContext.value,
    })
    detail.value = parseSkillDetailApiResponse(raw)
    syncSelectedVersionIndexAfterLoad(versionParam)
    // 被引用的数字人 - 暂隐藏
    // const shouldRefreshReferencedAgents =
    //   !silent || Boolean(options.refreshReferencedAgents)
    // if (shouldRefreshReferencedAgents) {
    //   await loadReferencedAgents()
    // }
  } catch (e) {
    if (!silent) {
      loadError.value =
        (e && (e.message || e.msg)) || '加载失败，请稍后重试'
      detail.value = null
      // referencedAgentsList.value = [] // 被引用的数字人 - 暂隐藏
    } else {
      rollbackSilentDetailState()
      ElMessage.error(
        (e && (e.message || e.msg)) || '加载失败，请稍后重试',
      )
    }
  } finally {
    if (!silent) loading.value = false
  }
}

function onOneClickInstallInstalled() {
  const e = detail.value?.entity
  if (e && typeof e === 'object') {
    e.isInstalled = true
    e.is_installed = true
    // 安装成功后刷新详情接口，更新浏览量等数据
    loadDetail({ silent: true })
  }
  // void loadReferencedAgents()
}

onMounted(loadDetail)
watch(skillSlug, () => {
  selectedApiVersion.value = ''
  selectedVersionIndex.value = 0
  loadDetail()
})
watch(isMyUploadsViewContext, () => {
  loadDetail()
})

function onCollectChange(payload) {
  if (!detail.value) return
  detail.value.isFollowed = Boolean(payload?.collected)
  // 重新加载详情以同步最新数据
  loadDetail({ silent: true })
}

</script>

<style lang="scss" scoped>
.skill-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
}
.skill-detail__load-error {
  margin: 24px;
  padding: 12px 16px;
  font-size: 14px;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 8px;
}

.skill-detail__layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
  padding: 0 20px;
  background: #fff;
  overflow: hidden;
}

.skill-detail__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 20px;
  padding-top: 20px;
  padding-bottom: 20px;
}

.skill-detail__hero {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 0 0 8px;
  margin-bottom: 20px;
  background: transparent;
  border-bottom: none;
}

.skill-detail__hero-media {
  flex: 0 0 auto;
}

.skill-detail__hero-icon-wrap {
  flex-shrink: 0;
  width: 45.88px;
  height: 45.88px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f3f4f6;
  color: #4b5563;
}

.skill-detail__hero-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.skill-detail__hero-main {
  min-width: 0;
  flex: 1 1 auto;
}

.skill-detail__hero-content {
  flex: 1 1 auto;
  min-width: 0;
}

.skill-detail__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  min-width: 0;
}

.skill-detail__hero-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 0;
}

.skill-detail__hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #2f3547;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-detail__hero-version {
  font-size: 14px;
  color: #91949e;
  font-weight: 400;
}

.skill-detail__hero-subrow {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  min-width: 0;
}

.skill-detail__hero-subrow--full {
  margin-top: 10px;
}

.skill-detail__hero-tags {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  flex: 0 1 auto;
  max-width: 58%;
  gap: 8px;
  margin: 0;
  overflow: hidden;
}

.skill-detail__tag {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 2px 10px;
  font-size: 12px;
  color: #606572;
  background: #eceef3;
  border-radius: 4px;
}

.skill-detail__hero-meta-line {
  margin: 0;
  flex: 1 1 0;
  min-width: 0;
  font-size: 13px;
  line-height: 22px;
  color: #91949E;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-detail__hero-right {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 16px 12px;
  flex-shrink: 0;
  margin-left: 0;
}

.skill-detail__hero-stats {
  display: inline-flex;
  align-items: center;
  gap: 18px;
}

.skill-detail__stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  line-height: 1;
}

.skill-detail__stat-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: block;
  object-fit: contain;
}

.skill-detail__stat-num {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  line-height: 16px;
  font-weight: 500;
  color: #606572;
}

.skill-detail__hero-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

@media (max-width: 720px) {
  .skill-detail__hero {
    flex-wrap: wrap;
  }

  .skill-detail__hero-content {
    flex-basis: 100%;
  }

  .skill-detail__hero-top {
    flex-wrap: wrap;
  }

  .skill-detail__hero-right {
    flex-basis: 100%;
    margin-left: 0;
    justify-content: space-between;
    width: 100%;
  }
}

.skill-detail__one-click-install {
  flex-shrink: 0;
}

.skill-detail__section {
  margin-bottom: 28px;
  padding: 0;
  background: transparent;
  border: none;
}

.skill-detail__file-browser {
  height: 420px;
}

.skill-detail__section--ref-agents {
  min-height: 120px;
}

.skill-detail__section-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #2f3547;
}

.skill-detail__section-title-icon {
  width: 3px;
  height: 14px;
  display: block;
  flex-shrink: 0;
}

.skill-detail__label {
  font-size: 14px;
  font-weight: 500;
  color: #91949E;
  margin-bottom: 8px;
}

.skill-detail__basic-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: #2F3547;
  white-space: pre-wrap;
}

.skill-detail__ref-empty {
  margin: 0;
  padding: 20px 0 8px;
  font-size: 14px;
  line-height: 22px;
  color: #9ca3af;
  text-align: center;
}

.skill-detail__ref-grid {
  display: grid;
  gap: 30px;
  margin-top: 10px;
  grid-template-columns: 1fr;
}

@media (min-width: 720px) {
  .skill-detail__ref-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.skill-detail__ref-card {
  position: relative;
  display: block;
  padding: 12px 16px 20px;
  border-radius: 16px;
  background: #ffffff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  box-shadow: none;
  overflow: visible;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border: 1px solid transparent;
    background:
      linear-gradient(#ffffff, #ffffff) padding-box,
      linear-gradient(270deg, #81BEFC 23%, #C69FED 75%, #FF8670 100%) border-box;
    box-shadow: 0 4px 10px 0 rgba(0, 0, 0, 0.06);
  }
}

.skill-detail__ref-avatar-wrap {
  float: left;
  width: 80px;
  height: 80px;
  margin: -28px 12px 8px 0;
}

.skill-detail__ref-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: linear-gradient(135deg, #e8e4ff 0%, #f5f3ff 100%);
  border: 2px solid rgba(132, 120, 250, 0.15);
  box-shadow: 0 8px 18px rgba(47, 53, 71, 0.08);
}

.skill-detail__ref-body {
  min-width: 0;
  display: block;
  overflow: visible;
}

.skill-detail__ref-head {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
  padding-top: 2px;
  min-width: 0;
}

.skill-detail__ref-name {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: #2f3547;
}

.skill-detail__ref-ver {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 20px;
  color: #91949e;
}

.skill-detail__ref-tag-org-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  max-width: 100%;
}

.skill-detail__ref-tags {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.skill-detail__ref-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  color: #6b7280;
  background: #eceef3;
  border-radius: 4px;

  &--more {
    background: #eceef3;
    color: #4b5563;
  }
}

.skill-detail__ref-overflow-tip {
  position: relative;
  cursor: pointer;
}

.skill-detail__ref-overflow-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 40;
  box-sizing: border-box;
  width: max-content;
  max-width: min(240px, calc(100vw - 24px));
  padding: 6px 10px;
  font-size: 12px;
  line-height: 20px;
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

.skill-detail__ref-overflow-tip:hover .skill-detail__ref-overflow-bubble {
  opacity: 1;
  visibility: visible;
}

.skill-detail__ref-org {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: #91949e;
}

.skill-detail__ref-desc {
  clear: both;
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 21px;
  text-align: justify;
  color: #91949e;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-detail__ref-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  clear: both;
  padding-top: 4px;
}

.skill-detail__ref-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
  font-size: 13px;
  color: #606572;
}

.skill-detail__ref-stat-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: block;
  object-fit: contain;
  transform: translateY(1px);
}

.skill-detail__ref-stat-num {
  display: inline-flex;
  align-items: center;
  min-height: 14px;
  line-height: 14px;
}

.skill-detail__ref-view-btn {
  margin-left: auto;
  opacity: 1;
  pointer-events: auto;
  padding: 6px 14px;
  border-radius: 6px;
  --el-button-text-color: #ffffff;
  --el-button-bg-color: #171b26;
  --el-button-border-color: #171b26;
  --el-button-hover-text-color: #ffffff;
  --el-button-hover-bg-color: #2b3142;
  --el-button-hover-border-color: #2b3142;
  --el-button-active-text-color: #ffffff;
  --el-button-active-bg-color: #10131c;
  --el-button-active-border-color: #10131c;
}

/* 右侧版本历史 */
.skill-detail__aside {
  width: 264px;
  flex-shrink: 0;
  overflow-y: auto;
  margin-left: 0;
  padding: 20px 0 0 20px;
  background: rgba(255, 255, 255, 0);
  box-sizing: border-box;
  border-width: 0 0 0 1px;
  border-style: solid;
  border-color: #eceef3;
  border-radius: 0;
  align-self: stretch;
  max-height: 100%;
}

.skill-detail__aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}

.skill-detail__aside-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2f3547;
}

.skill-detail__version-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.skill-detail__version-action-icon {
  width: 24px;
  height: 24px;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(47, 53, 71, 0.06);
  }
}

.skill-detail__version-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  // margin-top: 8px;
  // padding-top: 8px;
}

.skill-detail__version-stat-icons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.skill-detail__icon-stat-tooltip-host {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.skill-detail__icon-stat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #8f959e;
  line-height: 0;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.skill-detail__icon-stat__img {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
  cursor: pointer;

  &--disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.skill-detail__version-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-detail__version-card {
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(247, 248, 250, 0.8);
  border: 1px solid transparent;
  cursor: pointer;
  outline: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(.is-selected) {
    border-color: rgba(255, 104, 78, 0.35);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(255, 104, 78, 0.25);
  }

  &.is-selected {
    background: #ffffff;
    border-color: rgba(255, 104, 78, 0.5);
  }

  &.is-selected:hover {
    border-color: rgba(255, 104, 78, 0.65);
  }
}

.skill-detail__version-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  justify-content: space-between;
}

.skill-detail__version-status {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
}

.skill-detail__version-status--unpublished {
  color: #f5b400;
  background: #fffaeb;
}

.skill-detail__version-status--published {
  color: #24bcad;
  background: #eefcfa;
}

.skill-detail__version-status--reviewing {
  color: #00b4e0;
  background: #ebfbff;
}

.skill-detail__version-status--rejected {
  color: #ed4543;
  background: #fef0f0;
}

.skill-detail__version-num {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/** 仅列表首条（最新版本）：图内已含 NEW 文案，不再叠字 */
.skill-detail__version-new-img {
  display: block;
  flex-shrink: 0;
  width: 28px;
  height: 16px;
  object-fit: cover;
  transform: scale(1.2);
  transform-origin: center;
}

.skill-detail__version-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #9ca3af;
}

.skill-detail__version-meta-part {
  flex-shrink: 0;
  color: #91949E;
  font-size: 12px;
}

.skill-detail__version-meta-divider {
  flex-shrink: 0;
  width: 1px;
  height: 12px;
  background: #e5e7eb;
}

.skill-detail__version-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #2F3547;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .skill-detail__layout {
    flex-direction: column;
  }

  .skill-detail__aside {
    width: 100%;
    max-height: 40%;
    margin-left: 0;
    padding: 20px 0 0;
    border-left: none;
    border-top: 1px solid #e5e7eb;
  }
}
</style>

<style>

/* 解散确认弹窗 */
.dissolve-confirm-dialog {
  border-radius: 12px !important;
  padding: 24px !important;
}
.dissolve-confirm-dialog .el-message-box__header {
  padding: 0 0 8px;
}
.dissolve-confirm-dialog .el-message-box__title {
  font-size: 16px;
  font-weight: 600;
  color: #1F2329;
}
.dissolve-confirm-dialog .el-message-box__content {
  padding: 0 0 20px;
  font-size: 14px;
  color: #646A73;
}
.dissolve-confirm-dialog .el-message-box__btns {
  padding: 0;
}
.dissolve-confirm-dialog .dissolve-confirm-btn,
.dissolve-confirm-dialog .el-button--primary {
  /* width: 60px !important; */
  height: 32px !important;
  padding: 5px 16px !important;
  border-radius: 6px !important;
  background: #ED4543 !important;
  border-color: #ED4543 !important;
  color: #fff !important;
  font-size: 14px !important;
  font-weight: normal !important;
  line-height: 22px !important;
  box-sizing: border-box;
}
.dissolve-confirm-dialog .dissolve-confirm-btn:hover,
.dissolve-confirm-dialog .el-button--primary:hover {
  background: #d93c3a !important;
  border-color: #d93c3a !important;
}
.dissolve-confirm-dialog .el-button--default {
  /* width: 60px; */
  height: 32px;
  padding: 5px 16px;
  border-radius: 6px !important;
  background: #FFFFFF !important;
  border: 1px solid #DFE2EA !important;
  color: #2F3547 !important;
  font-size: 14px !important;
  font-weight: normal !important;
  line-height: 22px !important;
  box-sizing: border-box;
  outline: none !important;
  box-shadow: none !important;
}
.dissolve-confirm-dialog .el-button--default:hover,
.dissolve-confirm-dialog .el-button--default:focus,
.dissolve-confirm-dialog .el-button--default:active,
.dissolve-confirm-dialog .el-button--default.is-hover,
.dissolve-confirm-dialog .el-button--default.is-focus {
  background: #FFFFFF !important;
  border-color: #DFE2EA !important;
  color: #2F3547 !important;
  outline: none !important;
  box-shadow: none !important;
}
</style>

 