<template>
  <section class="skill-market-view">
    <Loading :visible="listLoading || uploadedListLoading" text="加载中..." />
    <div class="skill-market-view__inner">
      <!-- 顶部：tab + 右侧工具栏 -->
      <header class="skill-market-view__header">
        <div class="skill-market-view__tabs">
          <div
            class="skill-market-view__tab"
            :class="{ 'is-active': activeTab === 'market' }"
            @click="activeTab = 'market'"
          >
            <span class="skill-market-view__tab-text">Skill 市场</span>
            <img class="skill-market-view__tab-swoosh" :src="tabSwooshIcon" alt="" />
          </div>
          <div
            class="skill-market-view__tab"
            :class="{ 'is-active': activeTab === 'uploaded' }"
            @click="activeTab = 'uploaded'"
          >
            <span class="skill-market-view__tab-text">我的上传</span>
            <img class="skill-market-view__tab-swoosh" :src="tabSwooshIcon" alt="" />
          </div>
        </div>
        <div class="skill-market-view__toolbar-right">
          <MarketSpecSearchInput
            v-model="searchInput"
            class="skill-market-view__search"
            placeholder="搜索 Skill"
            @search="onSearch"
          />
          <MarketCustomButton @click="showUploadGuide">创建指引</MarketCustomButton>
          <MarketCustomButton variant="dark" @click="goToUploadSkill">创建 Skill</MarketCustomButton>
        </div>
      </header>

      <!-- Skill 市场 Tab -->
      <div v-show="activeTab === 'market'" class="skill-market-view__tab-content">
        <div class="skill-market-view__category-section">
        <div
          ref="categoryTagsRef"
          class="skill-market-view__category-tags"
          :class="{ 'is-expanded': categoriesExpanded }"
        >
          <span
            v-for="c in categories"
            :key="c.id"
            :data-cat-id="c.id"
            class="skill-market-view__cat skill-market-view__cat--chip"
            :class="{
              'is-active': activeCategoryId === c.id,
              'skill-market-view__cat--all': c.id === 'all',
            }"
            @click="activeCategoryId = c.id"
          >
            {{ c.label }}
          </span>
        </div>
        <button
          v-if="hasCategoryOverflow"
          type="button"
          class="skill-market-view__category-expand-btn"
          :aria-expanded="categoriesExpanded"
          @click="toggleCategoriesExpanded"
        >
          {{ categoriesExpanded ? '收起' : '更多' }}
          <img
            class="skill-market-view__expand-arrow-icon"
            :src="categoriesExpanded ? upIcon : downIcon"
            alt=""
          />
        </button>
      </div>

      <div
        ref="scrollRoot"
        class="box"
        @scroll.passive="onListScroll"
      >
        <div class="skill-market-view__toolbar">
        <div class="skill-market-view__sort">
          <button
            type="button"
            class="skill-market-view__sort-btn skill-market-view__sort-btn--popular"
            :class="{ 'is-active': sortKey === 'downloads' }"
            @click="sortKey = 'downloads'"
          >
            <span class="skill-market-view__flame" aria-hidden="true">🔥</span>
            安装量
          </button>
          <button
            type="button"
            class="skill-market-view__sort-btn skill-market-view__sort-btn--plain"
            :class="{ 'is-active': sortKey === 'stars' }"
            @click="sortKey = 'stars'"
          >
            收藏量
          </button>
          <button
            type="button"
            class="skill-market-view__sort-btn skill-market-view__sort-btn--plain"
            :class="{ 'is-active': sortKey === 'updated' }"
            @click="sortKey = 'updated'"
          >
            最新
          </button>
        </div>
        <span class="skill-market-view__toolbar-divider" aria-hidden="true" />
        <el-checkbox
          v-model="onlyStarred"
          class="skill-market-view__only-fav"
        >
          仅看收藏
        </el-checkbox>
      </div>

      <div v-if="!listLoading && skillsList.length === 0" class="skill-market-view__empty-state">
        <img
          class="skill-market-view__empty-state-img"
          :src="emptyIllustration"
          alt=""
          width="100"
          height="100"
        />
        <p class="skill-market-view__empty-state-text">暂无数据，看看其他的吧~</p>
      </div>
      <div
        v-else-if="!listLoading"
        class="skill-market-view__grid"
      >
        <SkillMarketCard
          v-for="item in skillsList"
          :key="item.id"
          :title="item.title"
          :version="item.version"
          :org="item.org"
          :tags="item.tags"
          :description="item.description"
          :views="item.views"
          :stars="item.stars"
          :collected="Boolean(item.collected)"
          :cover-url="item.coverUrl || COVER_FALLBACK"
          :skill-slug="item.slug"
          :is-installed="Boolean(item.isInstalled)"
          @open="goToDetail(item)"
          @collect="onCollect(item)"
          @installed="onSkillCardInstalled"
        />
      </div>
      <p
        v-if="loadMoreLoading"
        class="skill-market-view__list-footer skill-market-view__list-footer--loading"
      >
        加载中…
      </p>
      <p
        v-else-if="!hasMore && skillsList.length > 0"
        class="skill-market-view__list-footer skill-market-view__list-footer--end"
      >
        已经到底啦，换个方向逛逛吧～
      </p>
      </div>


      </div>

      <!-- 我的上传 Tab -->
      <div v-show="activeTab === 'uploaded'" class="skill-market-view__tab-content">
        <!-- 状态筛选 -->
        <div class="skill-market-view__uploaded-filter">
          <StatusFilter v-model="uploadedStatusFilter" />
        </div>
        <div ref="uploadedScrollRoot" class="skill-market-view__uploaded-scroll" @scroll.passive="onUploadedListScroll">
          <div v-if="uploadedList.isEmpty.value" class="skill-market-view__empty-state">
            <img class="skill-market-view__empty-state-img" :src="emptyIllustration" alt="" width="100" height="100" />
            <p class="skill-market-view__empty-state-text">暂无上传的 Skill</p>
          </div>
          <div v-else class="skill-market-view__uploaded-grid">
            <SkillCard
              v-for="item in uploadedList.list.value"
              :key="item.id"
              :item="item"
              view-mode="list"
            />
          </div>
          <p v-if="uploadedList.loadMoreLoading.value" class="skill-market-view__list-footer skill-market-view__list-footer--loading">加载中…</p>
          <p v-else-if="!uploadedList.hasMore.value && uploadedList.list.value.length > 0" class="skill-market-view__list-footer skill-market-view__list-footer--end">已经到底啦，换个方向逛逛吧～</p>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'SkillMarketView' })
import { nextTick, onBeforeUnmount, onMounted, onActivated, ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import MarketSpecSearchInput from '@/shared/components/MarketSpecSearchInput.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import upIcon from '../avatar/components/images/up.svg'
import downIcon from '../avatar/components/images/down.svg'
import emptyIllustration from '@/assets/home/flie-preview.png'
import skillCzCoverUrl from '@/assets/skill/skill-cz.png'
import SkillMarketCard from './components/SkillMarketCard.vue'
import SkillCard from '@/modules/market/my-uploads/components/SkillCard.vue'
import StatusFilter from '@/modules/market/my-uploads/components/StatusFilter.vue'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { useSkillList } from '@/modules/market/my-uploads/composables/useSkillList'
import {
  deleteSkillFollow,
  fetchSkillMarketList,
  fetchSkillMarketTags,
  postSkillFollow,
} from './skillMarketApi.js'
// @ts-ignore
import tabSwooshIcon from '@/assets/market/myuploads/tab-skill-swoosh.svg'

const router = useRouter()
const route = useRoute()

const COVER_FALLBACK = skillCzCoverUrl

// ==================== Tab 状态 ====================
const activeTab = ref('market')

const keyword = ref('')
const uploadedKeyword = ref('')
/** 搜索框绑定当前 Tab 对应的搜索词，切换 Tab 时自动显示各自的搜索词 */
const searchInput = computed({
  get: () => activeTab.value === 'uploaded' ? uploadedKeyword.value : keyword.value,
  set: (val) => {
    if (activeTab.value === 'uploaded') {
      uploadedKeyword.value = val
    } else {
      keyword.value = val
    }
  },
})
/** 分类超出首行可用宽度时，展示「更多」 */
const categoriesExpanded = ref(false)
const activeCategoryId = ref('all')
/** 与 GET /skills 的 sort 一致：downloads | stars | updated */
const sortKey = ref('downloads')
/** 对应 isStarred：仅显示我关注的 */
const onlyStarred = ref(false)
const skillsList = ref([])
const listLoading = ref(false)
const loadMoreLoading = ref(false)
/** 列表滚动容器：`.box` 内 overflow-y: auto，与 onListScroll / 重置页码时 scrollTop 一致 */
const scrollRoot = ref(null)
const PAGE_SIZE = 20
const listPage = ref(1)
const hasMore = ref(true)

/** 顶部分类：首项「全部」固定，其余来自 GET /api/v1/tags/skills */
const categories = ref([{ id: 'all', label: '全部' }])
const categoryTagsRef = ref(null)
const hasCategoryOverflow = ref(false)
/** 收起时 max-height 过渡中，禁止临时写 style 测高度，否则打断 transition 并造成闪动 */
const isCategoryMaxHeightAnimating = ref(false)
let categoryResizeObserver = null
let categoryTagsTransitionEndEl = null
let categoryCollapseAnimFallbackTimer = null

function clearCategoryCollapseAnimFallback() {
  if (categoryCollapseAnimFallbackTimer != null) {
    clearTimeout(categoryCollapseAnimFallbackTimer)
    categoryCollapseAnimFallbackTimer = null
  }
}

function onCategoryTagsMaxHeightTransitionEnd(ev) {
  if (ev.propertyName !== 'max-height') return
  if (ev.target !== categoryTagsRef.value) return
  clearCategoryCollapseAnimFallback()
  isCategoryMaxHeightAnimating.value = false
  updateCategoryOverflow()
}

function disconnectCategoryResizeObserver() {
  clearCategoryCollapseAnimFallback()
  if (categoryTagsTransitionEndEl) {
    categoryTagsTransitionEndEl.removeEventListener(
      'transitionend',
      onCategoryTagsMaxHeightTransitionEnd,
    )
    categoryTagsTransitionEndEl = null
  }
  if (categoryResizeObserver) {
    categoryResizeObserver.disconnect()
    categoryResizeObserver = null
  }
}

function connectCategoryResizeObserver() {
  disconnectCategoryResizeObserver()
  if (typeof ResizeObserver === 'undefined') return
  const el = categoryTagsRef.value
  if (!el) return
  el.addEventListener('transitionend', onCategoryTagsMaxHeightTransitionEnd)
  categoryTagsTransitionEndEl = el
  categoryResizeObserver = new ResizeObserver(() => {
    updateCategoryOverflow()
  })
  categoryResizeObserver.observe(el)
}

/** 与 Avatar 市场：单行截断后 scrollHeight 大于可见高度则显示「更多」；展开时不再折叠测量 */
function updateCategoryOverflow() {
  const el = categoryTagsRef.value
  if (!el) {
    hasCategoryOverflow.value = false
    return
  }
  if (isCategoryMaxHeightAnimating.value) {
    return
  }
  if (categoriesExpanded.value) {
    hasCategoryOverflow.value = true
    return
  }

  const prevMaxHeight = el.style.maxHeight
  const prevOverflowY = el.style.overflowY
  /* 与 AvatarMarketView.updateCategoryOverflow 一致（CSS 单行 34px，测量用 36px） */
  const COLLAPSED_MAX = '36px'

  el.style.maxHeight = COLLAPSED_MAX
  el.style.overflowY = 'hidden'

  const collapsedNeedsMore = el.scrollHeight - el.clientHeight > 1

  el.style.maxHeight = prevMaxHeight
  el.style.overflowY = prevOverflowY

  hasCategoryOverflow.value = collapsedNeedsMore
}

function handleWindowResize() {
  updateCategoryOverflow()
}

function ensureActiveCategoryOnFirstLineOrReset() {
  const wrap = categoryTagsRef.value
  if (!wrap || activeCategoryId.value === 'all') return
  let activeEl
  try {
    activeEl = wrap.querySelector(
      `[data-cat-id="${CSS.escape(String(activeCategoryId.value))}"]`,
    )
  } catch {
    activeEl = null
  }
  if (!activeEl) {
    activeCategoryId.value = 'all'
    return
  }
  const first = wrap.querySelector('button[data-cat-id]')
  if (first && activeEl.offsetTop > first.offsetTop + 1) {
    activeCategoryId.value = 'all'
  }
}

function toggleCategoriesExpanded() {
  const next = !categoriesExpanded.value
  if (next) {
    isCategoryMaxHeightAnimating.value = false
    clearCategoryCollapseAnimFallback()
  } else {
    ensureActiveCategoryOnFirstLineOrReset()
    isCategoryMaxHeightAnimating.value = true
    /* 0.1s 过渡，无 transition 时兜底 */
    clearCategoryCollapseAnimFallback()
    categoryCollapseAnimFallbackTimer = setTimeout(() => {
      categoryCollapseAnimFallbackTimer = null
      isCategoryMaxHeightAnimating.value = false
      updateCategoryOverflow()
    }, 200)
  }
  categoriesExpanded.value = next
}

async function loadSkillTags() {
  try {
    const tags = await fetchSkillMarketTags()
    const rest = tags.map((t) => {
      const name = String(t?.name ?? '').trim()
      return {
        id: name,
        label: name,
        count: Number(t?.count) || 0,
      }
    }).filter((c) => c.id)
    categories.value = [{ id: 'all', label: '全部' }, ...rest]
  } catch {
    categories.value = [{ id: 'all', label: '全部' }]
  }
}

/**
 * 接口 `image`：
 * - `data:image/...` 内联图、完整 `http(s)://` 不拼接，原样用于 img src
 * - 其它相对路径与 one 网关 base 拼成绝对地址
 */
function resolveSkillCoverUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

/** 空、服务端占位图等：卡片先用网络默认图，后续可改为本地资源 */
function isPlaceholderSkillImage(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return true
  if (/^data:/i.test(s)) return false
  return /default-avatar\.png$/i.test(s) || /\/default-avatar\.png(\?|$)/i.test(s)
}

function resolveSkillCoverForCard(raw) {
  if (isPlaceholderSkillImage(raw)) return COVER_FALLBACK
  const resolved = resolveSkillCoverUrl(raw)
  if (!resolved.trim()) return COVER_FALLBACK
  if (isPlaceholderSkillImage(resolved)) return COVER_FALLBACK
  return resolved
}

function mapSkillRow(r) {
  const author = r?.author || {}
  const handle = String(author.handle || '').trim()
  const org =
    handle && handle.startsWith('@')
      ? handle
      : handle
        ? `@${handle.replace(/^@/, '')}`
        : ''
  // 优先从 latestVersion.version 获取版本号，兼容顶层 version 字段，无版本号时默认 1.0.0
  const rawVersion = r?.latestVersion?.version ?? r?.version ?? '1.0.0'
  const ver = String(rawVersion).trim()
  const versionLabel =
    ver && !/^v\d/i.test(ver) && /^\d/.test(ver) ? `v${ver}` : ver
  const slug = String(r?.slug ?? '').trim()
  const legacyId = String(r?.id ?? '').trim()
  /** 列表封面字段兼容：新接口用 avatar，历史接口可能是 image/avatarUrl/coverUrl */
  const coverRaw = r?.image ?? r?.avatar ?? r?.avatarUrl ?? r?.coverUrl ?? r?.latestVersion?.icon ?? author?.image ?? ''
  /** 列表卡片「1+n」依赖 tags 数组长度；新接口 tags 可能是对象 { latest: "version" }，需要兼容处理 */
  function normalizeSkillTags(raw) {
    const buckets = [
      // 新接口 tags 可能是对象 { latest: "version" }，取其 keys 作为标签
      raw?.tags && typeof raw.tags === 'object' && !Array.isArray(raw.tags)
        ? Object.keys(raw.tags)
        : raw?.tags,
      raw?.labels,
      raw?.categories,
      raw?.topics,
      raw?.keywords,
      raw?.capabilities,
    ]
    const out = []
    const seen = new Set()
    for (const b of buckets) {
      const arr = Array.isArray(b) ? b : []
      for (const t of arr) {
        const s = String(t ?? '').trim()
        if (!s) continue
        const key = s.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(s)
      }
    }
    return out
  }
  return {
    /** 详情路由与 GET /skills/:slug 使用 slug，无 slug 时退回 id */
    id: slug || legacyId,
    slug: slug || legacyId,
    title: String(r?.displayName || r?.name || r?.title || '').trim(),
    version: versionLabel,
    org,
    tags: normalizeSkillTags(r),
    description: String(r?.summary || r?.description || '').trim() || '-',
    // 优先从 stats 对象获取下载数和收藏数
    views: Number(r?.stats?.downloads ?? r?.downloads ?? r?.statsDownloads ?? 0),
    stars: Number(r?.stats?.stars ?? r?.stars ?? r?.statsStars ?? 0),
    collected: Boolean(r?.isStarred || r?.isFollowed || r?.collected),
    isInstalled: Boolean(
      r?.isInstalled
      ?? r?.is_installed
      ?? r?.installed
      ?? r?.hasInstalled
      ?? r?.installStatus === 'installed',
    ),
    coverUrl: resolveSkillCoverForCard(coverRaw),
  }
}

function buildSkillListParams(page) {
  const search = keyword.value.trim()
  return {
    sort: sortKey.value,
    ...(activeCategoryId.value !== 'all'
      ? { tag: String(activeCategoryId.value).trim() }
      : {}),
    isOfficial: false,
    isStarred: onlyStarred.value,
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
  }
}

/**
 * 是否还有下一页（兼容多种 pagination 结构；本批不足 pageSize 则无更多）
 */
function computeHasMore(pagination, batchLength, page, pageSize) {
  if (batchLength === 0) return false
  if (batchLength < pageSize) return false
  const total = Number(
    pagination?.total ??
      pagination?.totalCount ??
      pagination?.itemCount,
  )
  if (Number.isFinite(total) && total >= 0) {
    return page * pageSize < total
  }
  const totalPages = Number(
    pagination?.totalPages ?? pagination?.pageCount ?? pagination?.pages,
  )
  if (Number.isFinite(totalPages) && totalPages > 0) {
    return page < totalPages
  }
  if (pagination?.hasNext === false) return false
  if (pagination?.hasNext === true) return true
  return batchLength >= pageSize
}

/**
 * @param {boolean} reset - true：重新筛选从第 1 页替换列表；false：追加下一页
 * @param {{ silent?: boolean, skipScrollReset?: boolean }} [opts]
 *   - silent：不展示首屏全表 loading（用于收藏后静默刷新）
 *   - skipScrollReset：重置列表时保留当前滚动位置
 */
async function loadSkills(reset = true, opts = {}) {
  const silent = Boolean(opts.silent)
  const skipScrollReset = Boolean(opts.skipScrollReset)

  if (!reset) {
    if (!hasMore.value || loadMoreLoading.value || listLoading.value) return
  }

  const nextPage = reset ? 1 : listPage.value + 1

  if (reset) {
    if (!silent) {
      listLoading.value = true
      skillsList.value = []
    } else loadMoreLoading.value = true
    hasMore.value = true
  } else {
    loadMoreLoading.value = true
  }

  try {
    const params = buildSkillListParams(nextPage)
    const { results, pagination } = await fetchSkillMarketList(params)
    const rows = (results || []).map(mapSkillRow)

    if (reset) {
      skillsList.value = rows
      listPage.value = 1
      const root = scrollRoot.value
      if (root && !skipScrollReset) root.scrollTop = 0
      hasMore.value = computeHasMore(
        pagination,
        rows.length,
        nextPage,
        PAGE_SIZE,
      )
    } else if (rows.length === 0) {
      hasMore.value = false
    } else {
      skillsList.value = [...skillsList.value, ...rows]
      listPage.value = nextPage
      hasMore.value = computeHasMore(
        pagination,
        rows.length,
        nextPage,
        PAGE_SIZE,
      )
    }
  } catch (e) {
    console.error('[SkillMarketView] loadSkills failed:', e)
    if (reset) {
      skillsList.value = []
      hasMore.value = false
    }
  } finally {
    listLoading.value = false
    loadMoreLoading.value = false
  }
}

const SCROLL_LOAD_THRESHOLD_PX = 160

function onListScroll() {
  const el = scrollRoot.value
  if (!el || !hasMore.value || listLoading.value || loadMoreLoading.value) {
    return
  }
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
    loadSkills(false)
  }
}

watch([sortKey, activeCategoryId, onlyStarred], () => {
  loadSkills(true)
})

watch(
  () => categories.value.map((c) => c.id).join('|'),
  async () => {
    await nextTick()
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  },
)

onMounted(() => {
  loadSkillTags()
  loadSkills(true)
  void nextTick(() => {
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  })
  window.addEventListener('resize', handleWindowResize)
})

onActivated(() => {
  const history = router.options.history
  const from = history.state.back || ''
  const fromDetail = from.includes('Detail') || from.includes('detail')

  if (!fromDetail) {
    if (activeTab.value === 'market') {
      loadSkillTags()
      loadSkills(true)
    } else {
      uploadedList.page.value = 1
      void uploadedList.loadList()
    }
  }
  void nextTick(() => {
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  disconnectCategoryResizeObserver()
})

/** 来自 MarketSpecSearchInput：输入防抖结束或回车立即搜索 */
function onSearch() {
  if (activeTab.value === 'uploaded') {
    uploadedList.list.value = []
    uploadedList.page.value = 1
    void uploadedList.loadList()
    return
  }
  loadSkills(true)
}

// ==================== 我的上传 Tab ====================
/** @type {import('vue').Ref<'all' | 'active' | 'online_review' | 'draft' | 'rejected' | 'offline_review' | 'offline'>} */
const uploadedStatusFilter = ref('all')
const uploadedList = useSkillList(uploadedKeyword, uploadedStatusFilter)
const uploadedScrollRoot = ref(null)
const uploadedListLoading = uploadedList.listLoading
const UPLOADED_SCROLL_THRESHOLD = 160

function onUploadedListScroll() {
  const el = uploadedScrollRoot.value
  if (!el) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < UPLOADED_SCROLL_THRESHOLD) {
    void uploadedList.loadMore()
  }
}

function goToUploadSkill() {
  router.push({ name: 'SkillCreate' })
}

function showUploadGuide() {
  window.open('https://yf2ljykclb.xfchat.iflytek.com/docx/doxrzTrNXecm6I9BWB6Ir0Qajxe', '_blank', 'noopener,noreferrer')
}

watch(activeTab, (tab) => {
  if (tab === 'uploaded') {
    uploadedList.list.value = []
    uploadedList.page.value = 1
    void uploadedList.loadList()
  } else {
    skillsList.value = []
    loadSkillTags()
    loadSkills(true)
  }
})

/** 详情无 skill 头图时，用列表卡片已解析的 coverUrl（经 history.state 传入） */
function goToDetail(item) {
  const id = String(item?.id ?? '').trim()
  if (!id) return
  const cover = String(item?.coverUrl || COVER_FALLBACK).trim() || COVER_FALLBACK
  router.push({
    name: 'SkillDetail',
    params: { id },
    state: { skillHeroCover: cover, skillHeroForSlug: id },
  })
}

const followInFlight = new Set()

async function onCollect(item) {
  const slug = String(item.slug || item.id || '').trim()
  if (!slug) return
  if (followInFlight.has(slug)) return
  followInFlight.add(slug)
  try {
    const wasStarred = Boolean(item.collected)
    await (wasStarred ? deleteSkillFollow(slug) : postSkillFollow(slug))
    if (onlyStarred.value && wasStarred) {
      skillsList.value = skillsList.value.filter(
        (s) => String(s.slug || s.id || '').trim() !== slug,
      )
    } else {
      item.collected = !wasStarred
    }
    const num = wasStarred ? -1 : 1
    item.stars = item.stars + num
    ElMessage.success(wasStarred ? '已取消收藏' : '收藏成功')
  } catch (e) {
    const msg =
      (typeof e === 'object' && e != null && (e.message || e.msg)) ||
      (typeof e === 'string' ? e : '') ||
      '操作失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    followInFlight.delete(slug)
  }
}

function onSkillCardInstalled(payload) {
  const key = String(payload?.skillSlug ?? '').trim()
  if (!key) return
  const row = skillsList.value.find(
    (s) => s.slug === key || s.id === key,
  )
  if (row) row.isInstalled = true
}
</script>

<style lang="scss" scoped>
.skill-market-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 20px 40px;
  background-color: white;
  overflow: hidden;
}

.skill-market-view__inner {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  container-type: inline-size;
  container-name: skill-market;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ==================== 顶部 header：tab + 右侧工具栏 ==================== */
.skill-market-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.skill-market-view__tabs {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.skill-market-view__tab {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #2f3547;
  cursor: pointer;
  position: relative;
  min-width: 66px;

  .skill-market-view__tab-swoosh {
    display: none;
    width: 18px;
    height: 14px;
    position: absolute;
    bottom: 0;
    right: -5px;
  }

  &.is-active
    {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: #2f3547;

    .skill-market-view__tab-swoosh {
      display: block;
    }
  }

  &:nth-last-child(1) {
    margin-left: 12px;
    &.is-active {
      margin-left: 0;
    }
  }
}

.skill-market-view__toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.skill-market-view__search {
  box-sizing: border-box;
}

/* ==================== Tab 内容区 ==================== */
.skill-market-view__tab-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 顶部分类：与数字人市场 AvatarMarketView 一致 — 标签区单行截断 + 右侧「更多 / 收起」与上下箭头 */
.skill-market-view__category-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ECEEF3;
}

.skill-market-view__category-tags {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px; /* 与 Avatar .category-tags 一致，避免 row-gap 与 max-height 动画不同步 */
  min-width: 0;
  overflow: hidden;
  max-height: 34px; /* 单行高度，与 Avatar .category-tags 一致 */
  transition: max-height 0.1s ease;

  &.is-expanded {
    max-height: 200px;
  }
}

.skill-market-view__cat {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  height: 28px;
  display: inline-flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 1px 12px;
  gap: 0;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: center;
  letter-spacing: normal;
  color: #2f3547;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  min-width: 0;

  /* 筛选项（非「全部」）：宽度随文案，过长省略（接口 tag 名长度不一） */
  &--chip:not(.skill-market-view__cat--all) {
    max-width: min(240px, 100%);
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 「全部」未选中 */
  &--all:not(.is-active) {
    min-width: 52px;
    flex: 0 0 auto;
  }

  &:hover:not(.is-active) {
    background: transparent;
  }

  &.is-active {
    color: #ff6d40;
    background: #ffeeeb;
    font-weight: 600;
  }

  &--chip.is-active:not(.skill-market-view__cat--all) {
    max-width: min(240px, 100%);
    height: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--all.is-active {
    box-sizing: border-box;
    min-width: 52px;
    height: 28px;
    display: inline-flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 1px 12px;
    gap: 0;
    border-radius: 16px;
    background: #ffeeeb;
    font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
    text-align: center;
    letter-spacing: normal;
    color: #ff684e;
    flex: 0 0 auto;

    &:hover {
      background: #ffeeeb;
      color: #ff684e;
    }
  }
}

.skill-market-view__category-expand-btn {
  width: 50px;
  height: 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: center;
  justify-content: center;
  gap: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 5.4px;
  background: transparent;
  color: #91949e;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  transition: all 0.2s;
  z-index: 1;
  align-self: flex-start;
  margin-top: 3px;

  &:hover {
    background: #f3f3f4;
    color: #91949e;
  }
}

.skill-market-view__expand-arrow-icon {
  width: 12px;
  height: 12px;
  margin-left: 2px;
  flex-shrink: 0;
  display: block;
}
.box {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.skill-market-view__toolbar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 20px;
  padding-top: 16px;
  flex-wrap: wrap;
}

.skill-market-view__sort {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skill-market-view__toolbar-divider {
  width: 1px;
  height: 14px;
  margin: 0 16px 0 20px;
  flex-shrink: 0;
  background: #dfe2ea;
}

.skill-market-view__only-fav {
  :deep(.el-checkbox__label) {
    padding-left: 8px;
    font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: center;
    letter-spacing: normal;
    color: #606572;
  }

  :deep(.el-checkbox__inner) {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border-color: #dfe2ea;
  }

  :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #ff684e;
    border-color: #ff684e;
  }
}

.skill-market-view__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  // padding: 6px 12px;
  font-size: 13px;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0 8px;
  height: 28px;
  line-height: 28px;

  /* 收藏量、最新：纯文字；选中时与「安装量」同款橘底 */
  &--plain {
    // padding: 4px 2px;
    font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: center;
    letter-spacing: normal;
    color: #606572;
    background: transparent;

    &.is-active {
      font-weight: 600;
      color: #ff684e;
      background: #ffeeeb;
      // border-radius: 6px;
      // padding: 4px 10px;
    }
  }

  /* 安装量（sort=downloads）：未选中外层灰底 + 一级字色；选中橘字 + 浅橘底 */
  &--popular {
    font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    letter-spacing: normal;
    color: #2f3547;
    // background: #f7f8fa;

    // &:hover:not(.is-active) {
    //   // background: #eef0f3;
    //   color: #2f3547;
    // }

    &.is-active {
      font-weight: 600;
      color: #ff684e;
      background: #ffeeeb;
    }
  }
}

.skill-market-view__flame {
  font-size: 14px;
  line-height: 1;
}

/* 卡片栅格：单卡最小 296px。有效宽度 = 内容区宽度 + 左侧菜单/导航 312px，再对齐原规格（960 / 1280 / 1601）→ 断点用 calc(原值 − 312px) */
.skill-market-view__grid {
  display: grid;
  gap: 20px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
 
}

.skill-market-view__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 48px 24px;
  margin-top: 8px;
  text-align: center;
}

.skill-market-view__empty-state-img {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  object-fit: contain;
  display: block;
  margin-bottom: 12px;
}

.skill-market-view__empty-state-text {
  margin: 0;
  font-size: 14px;
  font-weight: normal;
  line-height: 24px;
  letter-spacing: normal;
  color: #2f3547;
}

@container skill-market (min-width: calc(960px - 312px)) {
  .skill-market-view__grid {
    grid-template-columns: repeat(2, minmax(296px, 1fr));
  }
}

@container skill-market (min-width: calc(1280px - 312px)) {
  .skill-market-view__grid {
    grid-template-columns: repeat(3, minmax(296px, 1fr));
  }
}

@container skill-market (min-width: calc(1601px - 312px)) {
  .skill-market-view__grid {
    grid-template-columns: repeat(4, minmax(296px, 1fr));
  }
}

.skill-market-view__list-footer {
  margin: 8px 0 0;
  padding: 12px 0 8px;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
  color: #91949e;

  &--loading {
    color: #606572;
  }

  &--end {
    color: #5e6672;
  }
}

/* 小屏满宽；需盖过 MarketSpecSearchInput 上内联 width */
@media (max-width: 640px) {
  .skill-market-view__search {
    width: 100% !important;
  }
}

/* ==================== 我的上传 Tab ==================== */
.skill-market-view__uploaded-filter {
  padding-bottom: 16px;
  //border-bottom: 1px solid #ECEEF3;
  //margin-bottom: 16px;
}

.skill-market-view__uploaded-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.skill-market-view__uploaded-grid {
  display: grid;
  gap: 20px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
  padding-top: 16px;
}

@container skill-market (min-width: calc(960px - 312px)) {
  .skill-market-view__uploaded-grid {
    grid-template-columns: repeat(2, minmax(296px, 1fr));
  }
}

@container skill-market (min-width: calc(1280px - 312px)) {
  .skill-market-view__uploaded-grid {
    grid-template-columns: repeat(3, minmax(296px, 1fr));
  }
}
</style>
