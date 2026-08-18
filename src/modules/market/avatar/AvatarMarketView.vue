<template>
  <section ref="sectionRef" class="avatar-market-view" @scroll.passive="onSectionScroll">
    <Loading :visible="listLoading || uploadedAgentList.listLoading.value" text="加载中..." />
    <div class="banner">
      <div class="banner-left" />
      <div class="banner-c" />
      <div class="banner-right" />
    </div>
    <div class="avatar-market-view__inner">
      <!-- 顶部：tab + 右侧工具栏 -->
      <header ref="headerRef" class="avatar-market-view__header">
        <div class="avatar-market-view__tabs">
          <div class="avatar-market-view__tab" :class="{ 'is-active': activeTab === 'market' }"
            @click="activeTab = 'market'">
            <span class="avatar-market-view__tab-text">数字人市场</span>
            <img class="avatar-market-view__tab-swoosh" :src="tabSwooshIcon" alt="" />
          </div>
          <div class="avatar-market-view__tab" :class="{ 'is-active': activeTab === 'uploaded' }"
            @click="activeTab = 'uploaded'">
            <span class="avatar-market-view__tab-text">我的上传</span>
            <img class="avatar-market-view__tab-swoosh" :src="tabSwooshIcon" alt="" />
          </div>
        </div>
        <div class="avatar-market-view__toolbar-right">
          <MarketSpecSearchInput v-model="searchInput" class="avatar-market-view__search" placeholder="搜索数字人"
            @search="onSearch" />
          <MarketCustomButton @click="showUploadGuide">创建指引</MarketCustomButton>
          <MarketCustomButton variant="dark" @click="goToUploadAvatar">创建数字人</MarketCustomButton>
        </div>
      </header>

      <!-- 数字人市场 Tab -->
      <div v-show="activeTab === 'market'" class="avatar-market-view__tab-content">
        <div class="avatar-market-view__filters-bar">
          <div class="avatar-market-view__category-section">
            <div ref="categoryTagsRef" class="avatar-market-view__category-tags"
              :class="{ 'is-expanded': showAllCategories }">
              <span v-for="category in categories" :key="category.id" :data-cat-id="category.id"
                class="avatar-market-view__cat avatar-market-view__cat--chip" :class="{
                  'is-active': selectedCategory === category.id,
                  'avatar-market-view__cat--all': category.id === 'all',
                }" @click="selectedCategory = category.id">
                {{ category.name }}
              </span>
            </div>
            <button v-if="hasOverflow" type="button" class="avatar-market-view__category-expand-btn"
              :aria-expanded="showAllCategories" @click="toggleCategoryExpand">
              {{ showAllCategories ? '收起' : '更多' }}
              <img class="avatar-market-view__expand-arrow-icon" :src="showAllCategories ? upIcon : downIcon" alt="" />
            </button>
          </div>

          <div class="avatar-market-view__toolbar">
            <div class="avatar-market-view__sort">
              <button type="button" class="avatar-market-view__sort-btn avatar-market-view__sort-btn--popular"
                :class="{ 'is-active': selectedSort === 'installed' }" @click="selectedSort = 'installed'">
                <span class="avatar-market-view__flame" aria-hidden="true">🔥</span>
                聘用数
              </button>
              <button type="button" class="avatar-market-view__sort-btn avatar-market-view__sort-btn--plain"
                :class="{ 'is-active': selectedSort === 'favorites' }" @click="selectedSort = 'favorites'">
                关注量
              </button>
              <button type="button" class="avatar-market-view__sort-btn avatar-market-view__sort-btn--plain"
                :class="{ 'is-active': selectedSort === 'latest' }" @click="selectedSort = 'latest'">
                最新
              </button>
            </div>
            <span class="avatar-market-view__toolbar-divider" aria-hidden="true" />
            <el-checkbox v-model="favoritesOnly" class="avatar-market-view__only-fav">
              仅看收藏
            </el-checkbox>
          </div>
        </div>

        <div ref="scrollRoot" class="avatar-market-view__scroll">

          <div v-if="!listLoading && avatars.length === 0" class="avatar-market-view__empty-state">
            <img class="avatar-market-view__empty-state-img" :src="emptyIllustration" alt="" width="100" height="100" />
            <p class="avatar-market-view__empty-state-text">暂无数据，看看其他的吧~</p>
          </div>
          <div v-else-if="!listLoading" class="avatar-market-view__grid">
            <AvatarCard v-for="avatar in avatars" :key="avatar.id" :avatar="avatar" @view-detail="goToDetail"
              @collect-change="onCollectChange" @hired="onAvatarHired" />
          </div>
          <p v-if="loadMoreLoading" class="avatar-market-view__list-footer avatar-market-view__list-footer--loading">
            加载中…
          </p>
          <p v-else-if="!hasMore && avatars.length > 0"
            class="avatar-market-view__list-footer avatar-market-view__list-footer--end">
            已经到底啦，换个方向逛逛吧～
          </p>
        </div>
      </div>

      <!-- 我的上传 Tab -->
      <div v-show="activeTab === 'uploaded'" class="avatar-market-view__tab-content">
        <!-- 状态筛选 -->
        <div class="avatar-market-view__filters-bar">
          <div class="avatar-market-view__status-filter-wrap">
            <div
              ref="statusTagsRef"
              class="avatar-market-view__status-filter"
              :class="{ 'is-expanded': statusFilterExpanded }"
            >
              <button v-for="item in statusFilters" :key="item.value" type="button" class="avatar-market-view__status-btn"
                :class="{ 'is-active': uploadedStatusFilter === item.value }" @click="changeUploadedStatus(item.value)">
                {{ item.label }}
              </button>
            </div>
            <button
              v-if="statusFilterHasOverflow"
              type="button"
              class="avatar-market-view__category-expand-btn"
              :aria-expanded="statusFilterExpanded"
              @click="statusFilterExpanded = !statusFilterExpanded"
            >
              {{ statusFilterExpanded ? '收起' : '更多' }}
              <img class="avatar-market-view__expand-arrow-icon" :src="statusFilterExpanded ? upIcon : downIcon" alt="" />
            </button>
          </div>
        </div>

        <div ref="uploadedScrollRoot" class="avatar-market-view__uploaded-scroll">
          <div v-if="uploadedAgentList.isEmpty.value" class="avatar-market-view__empty-state">
            <img class="avatar-market-view__empty-state-img" :src="emptyIllustration" alt="" width="100" height="100" />
            <p class="avatar-market-view__empty-state-text">暂无上传的数字人</p>
          </div>
          <div v-else class="avatar-market-view__uploaded-grid">
            <AvatarCard v-for="item in myUploadAgentCards" :key="item.id" :avatar="item" :status-tag="item.statusTag"
              :view-only="true" :view-only-emit-open="true" @view-detail="handleAgentCardOpen" />
          </div>
          <p v-if="uploadedAgentList.loadMoreLoading.value"
            class="avatar-market-view__list-footer avatar-market-view__list-footer--loading">加载中…</p>
          <p v-else-if="!uploadedAgentList.hasMore.value && uploadedAgentList.list.value.length > 0"
            class="avatar-market-view__list-footer avatar-market-view__list-footer--end">已经到底啦，换个方向逛逛吧～</p>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'AvatarMarketView' })
import { ref, computed, onMounted, onActivated, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import MarketSpecSearchInput from '@/shared/components/MarketSpecSearchInput.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import AvatarCard from './components/AvatarCard.vue'
import emptyIllustration from '@/assets/home/flie-preview.png'
import upIcon from './components/images/up.svg'
import downIcon from './components/images/down.svg'
import { fetchAgentList, fetchAgentTags, followAgent } from './services/avatarApi'
import bannerBgSrc from "@/modules/market/avatar/components/images/banner-bg.png"
import { useAgentList } from '@/modules/market/my-uploads/composables/useAgentList'
import { getListCardStatusMeta } from '@/modules/market/my-uploads/utils/listCardStatusMeta'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import defaultAvatarSrc from '@/assets/default-avatar.svg'
// @ts-ignore
import tabSwooshIcon from '@/assets/market/myuploads/tab-skill-swoosh.svg'

const PAGE_SIZE = 40
const SCROLL_LOAD_THRESHOLD_PX = 200

const router = useRouter()

// ==================== Tab 状态 ====================
const activeTab = ref('market')

const searchKeyword = ref('')
const uploadedSearchKeyword = ref('')
/** 搜索框绑定当前 Tab 对应的搜索词，切换 Tab 时自动显示各自的搜索词 */
const searchInput = computed({
  get: () => activeTab.value === 'uploaded' ? uploadedSearchKeyword.value : searchKeyword.value,
  set: (val) => {
    if (activeTab.value === 'uploaded') {
      uploadedSearchKeyword.value = val
    } else {
      searchKeyword.value = val
    }
  },
})
const selectedCategory = ref('all')
const selectedSort = ref('installed')
const favoritesOnly = ref(false)
const showAllCategories = ref(false)

const categories = ref([{ id: 'all', name: '全部' }])
const avatars = ref([])
const listPage = ref(1)
const hasMore = ref(true)
const listLoading = ref(false)
const loadMoreLoading = ref(false)
const scrollRoot = ref(null)
const sectionRef = ref(null)
const headerRef = ref(null)
const categoryTagsRef = ref(null)
const hasOverflow = ref(false)
let resizeObserver = null

function disconnectCategoryResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

function connectCategoryResizeObserver() {
  disconnectCategoryResizeObserver()
  if (typeof ResizeObserver === 'undefined') return
  if (!categoryTagsRef.value) return

  resizeObserver = new ResizeObserver(() => {
    updateCategoryOverflow()
  })
  resizeObserver.observe(categoryTagsRef.value)
}

function updateCategoryOverflow() {
  const el = categoryTagsRef.value
  if (!el) {
    hasOverflow.value = false
    return
  }

  // 展开状态下跳过测量，避免临时折叠触发 ResizeObserver 循环
  if (showAllCategories.value) {
    hasOverflow.value = true
    return
  }

  const prevMaxHeight = el.style.maxHeight
  const prevOverflowY = el.style.overflowY

  el.style.maxHeight = '34px'
  el.style.overflowY = 'hidden'

  const collapsedNeedsMore = el.scrollHeight - el.clientHeight > 1

  el.style.maxHeight = prevMaxHeight
  el.style.overflowY = prevOverflowY

  hasOverflow.value = collapsedNeedsMore
}

function handleWindowResize() {
  updateCategoryOverflow()
}

function toggleCategoryExpand() {
  showAllCategories.value = !showAllCategories.value
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) return 0
  const time = Number(timestamp)
  return Number.isNaN(time) ? 0 : time
}

function mapAgentToCard(item) {
  const tags = Array.isArray(item.tags) ? item.tags : []
  const capabilities = Array.isArray(item.capabilities) ? item.capabilities : []
  const secondaryTags = capabilities.length ? capabilities : tags.slice(1)
  const extraTagLabels = secondaryTags
    .map((t) => {
      if (t == null) return ''
      if (typeof t === 'string') return t
      if (typeof t === 'object') return String(t.name ?? t.title ?? t.label ?? t.display_name ?? t.id ?? '').trim()
      return String(t)
    })
    .filter(Boolean)

  return {
    ...item,
    // 蛇形字段直接透传，只处理 avatar_url → avatar（统一字段名）
    avatar: resolveAgentAvatarUrl(String(item.avatar_url ?? item.avatar ?? item.author?.avatar_url ?? item.author?.avatar ?? '')),
    version: (() => {
      const v = String(item.latest_version?.version ?? item.version ?? '').trim()
      return v ? (v.startsWith('v') ? v : `v${v}`) : ''
    })(),
    // tags 辅助字段（AvatarCard 内部使用）
    qualityLevel: tags[0] || '',
    extraTagCount: extraTagLabels.length,
    extraTagLabels,
    sourceOrg: item.official ? '技术中心运营' : (item.author?.display_name ?? item.author?.displayName ?? ''),
  }
}

async function loadCategories() {
  try {
    const tags = await fetchAgentTags()
    categories.value = [
      { id: 'all', name: '全部' },
      ...tags.map(tag => ({
        id: tag.name,
        name: tag.name,
        count: tag.count || 0,
      })),
    ]
  } catch (error) {
    console.error('[AvatarMarketView] fetchAgentTags failed:', error)
    categories.value = [{ id: 'all', name: '全部' }]
  }
}

/**
 * @param {boolean} reset - true：重新筛选从第 1 页替换列表；false：追加下一页
 * @param {{ silent?: boolean, skipScrollReset?: boolean }} [opts]
 *   - silent：不展示首屏全表 loading（用于静默刷新）
 *   - skipScrollReset：重置列表时保留当前滚动位置
 */
async function loadAgents(reset = true, opts = {}) {
  const silent = Boolean(opts.silent)
  const skipScrollReset = Boolean(opts.skipScrollReset)

  if (!reset) {
    if (!hasMore.value || loadMoreLoading.value || listLoading.value) return
  }

  const nextPage = reset ? 1 : listPage.value + 1

  if (reset) {
    if (!silent) {
      listLoading.value = true
      avatars.value = []
    } else loadMoreLoading.value = true
    hasMore.value = true
  } else {
    loadMoreLoading.value = true
  }

  const sortMap = {
    installed: 'downloads',
    favorites: 'stars',
    latest: 'updated',
  }

  const params = {
    page: nextPage,
    pageSize: PAGE_SIZE,
    sort: sortMap[selectedSort.value] || 'downloads',
    includeInstallStatus: true,
  }

  const keyword = searchKeyword.value.trim()
  if (keyword) params.search = keyword
  if (selectedCategory.value !== 'all') params.tag = selectedCategory.value
  if (favoritesOnly.value) params.isStarred = true

  try {
    const { items, pagination } = await fetchAgentList(params)
    const rows = items.map(mapAgentToCard)

    if (reset) {
      avatars.value = rows
      listPage.value = 1
      if (!skipScrollReset && scrollRoot.value) scrollRoot.value.scrollTop = 0
      hasMore.value = computeHasMore(pagination, rows.length, nextPage)
    } else if (rows.length === 0) {
      hasMore.value = false
    } else {
      avatars.value = [...avatars.value, ...rows]
      listPage.value = nextPage
      hasMore.value = computeHasMore(pagination, rows.length, nextPage)
    }
  } catch (error) {
    console.error('[AvatarMarketView] fetchAgentList failed:', error)
    if (reset) {
      avatars.value = []
      hasMore.value = false
    }
  } finally {
    listLoading.value = false
    loadMoreLoading.value = false
  }
}

function computeHasMore(pagination, batchLength, page) {
  if (batchLength === 0) return false
  if (batchLength < PAGE_SIZE) return false
  const total = Number(pagination?.total)
  if (Number.isFinite(total) && total >= 0) return page * PAGE_SIZE < total
  return batchLength >= PAGE_SIZE
}

function onListScroll() {
  const el = sectionRef.value
  if (!el || !hasMore.value || listLoading.value || loadMoreLoading.value) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
    loadAgents(false)
  }
}

function onSectionScroll() {
  if (activeTab.value === 'market') {
    onListScroll()
  } else {
    onUploadedListScroll()
  }
}

function goToDetail(id) {
  const avatar = avatars.value.find(a => a.id === id)
  const versionId = avatar?.latest_version_id ?? avatar?.latest_version?.id
  router.push({
    name: 'AvatarDetail',
    params: { id },
    query: versionId != null ? { versionId } : {},
    state: { isHired: !!avatar?.isHired }
  })
}

async function onCollectChange({ id, isFollowed, collected }) {
  const nextFollowed = isFollowed ?? collected ?? false
  const avatar = avatars.value.find(a => a.id === id)
  const prevFollowed = avatar ? !!avatar.isCollected : false

  if (avatar) avatar.isCollected = nextFollowed

  try {
    await followAgent(id, nextFollowed)
    if (avatar && prevFollowed !== nextFollowed) {
      const n = Number(avatar.favorites) || 0
      avatar.favorites = nextFollowed ? n + 1 : Math.max(0, n - 1)
    }
  } catch (error) {
    console.error('[AvatarMarketView] followAgent failed:', error)
    if (avatar) avatar.isCollected = prevFollowed
    // await loadAgents(true, { silent: true, skipScrollReset: true })
  }
}

function onAvatarHired({ id }) {
  if (id == null) return
  const row = avatars.value.find((a) => String(a.id) === String(id))
  if (!row) return
  row.isHired = true
  if (row.raw && typeof row.raw === 'object') {
    row.raw.isInstalled = true
  }
}

function updateHeaderHeight() {
  const h = headerRef.value?.offsetHeight ?? 0
  sectionRef.value?.style.setProperty('--header-h', `${h}px`)
}

onMounted(async () => {
  loadCategories()
  loadAgents(true)

  await nextTick()
  updateHeaderHeight()
  updateCategoryOverflow()
  checkStatusFilterOverflow()
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('resize', updateHeaderHeight)
  connectCategoryResizeObserver()
  if (typeof ResizeObserver !== 'undefined' && statusTagsRef.value) {
    statusFilterRO = new ResizeObserver(checkStatusFilterOverflow)
    statusFilterRO.observe(statusTagsRef.value)
  }
})

onActivated(async () => {
  const history = router.options.history
  const from = history.state.back || ''
  const fromDetail = from.includes('Detail') || from.includes('detail')

  if (!fromDetail) {
    if (activeTab.value === 'market') {
      loadCategories()
      loadAgents(true)
    } else {
      uploadedAgentList.page.value = 1
      void uploadedAgentList.loadList()
    }
  }
  void nextTick(() => {
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('resize', updateHeaderHeight)
  disconnectCategoryResizeObserver()
  statusFilterRO?.disconnect()
  statusFilterRO = null
})

watch([selectedCategory, selectedSort, favoritesOnly], () => {
  loadAgents(true)
})

/** 与 Skill 市场一致：MarketSpecSearchInput 防抖结束或回车后触发 */
function onSearch() {
  if (activeTab.value === 'uploaded') {
    uploadedAgentList.list.value = []
    uploadedAgentList.page.value = 1
    void uploadedAgentList.loadList()
    return
  }
  loadAgents(true)
}

// ==================== 我的上传 Tab ====================
const uploadedStatusFilter = ref('all')
const uploadedAgentList = useAgentList(uploadedSearchKeyword, uploadedStatusFilter)
const uploadedScrollRoot = ref(null)
const UPLOADED_SCROLL_THRESHOLD = 160

// 状态筛选折叠/展开
const statusTagsRef = ref(null)
const statusFilterHasOverflow = ref(false)
const statusFilterExpanded = ref(false)
const STATUS_FILTER_ROW_HEIGHT = 34

function checkStatusFilterOverflow() {
  const el = statusTagsRef.value
  if (!el) { statusFilterHasOverflow.value = false; return }
  if (statusFilterExpanded.value) { statusFilterHasOverflow.value = true; return }
  const prev = el.style.maxHeight
  el.style.maxHeight = `${STATUS_FILTER_ROW_HEIGHT}px`
  const overflows = el.scrollHeight - el.clientHeight > 1
  el.style.maxHeight = prev
  statusFilterHasOverflow.value = overflows
}

let statusFilterRO = null

// 状态筛选配置
const statusFilters = [
  { value: 'all', label: '全部' },
  { value: 'online', label: '已发布' },
  { value: 'testing', label: '审核中' },
  { value: 'draft', label: '未发布' },
  { value: 'reject', label: '已驳回' },
  { value: 'offline', label: '已下架' },
]

function changeUploadedStatus(val) {
  uploadedStatusFilter.value = val
  uploadedAgentList.list.value = []
  uploadedAgentList.page.value = 1
  void uploadedAgentList.loadList()
}

function resolveAgentAvatarUrl(rawAvatar) {
  const raw = String(rawAvatar ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/default-avatar\.png/i.test(raw)) return defaultAvatarSrc
  const base = getOneBaseUrl().replace(/\/$/, '')
  if (!base) return raw
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

const myUploadAgentCards = computed(() => {
  return (uploadedAgentList.list.value || []).map((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : []
    const capabilities = Array.isArray(item.capabilities) ? item.capabilities : []
    const secondaryTags = capabilities.length ? capabilities : tags.slice(1)
    const extraTagLabels = secondaryTags
      .map((t) => {
        if (t == null) return ''
        if (typeof t === 'string') return t
        if (typeof t === 'object') return String(t.name ?? t.title ?? t.label ?? t.display_name ?? t.id ?? '').trim()
        return String(t)
      })
      .filter(Boolean)

    return {
      ...item,
      avatar: resolveAgentAvatarUrl(String(item.avatar_url ?? item.avatar ?? item.author?.avatar_url ?? item.author?.avatar ?? '')),
      version: (() => {
        const v = String(item.latest_version?.version ?? item.version ?? '').trim()
        return v ? (v.startsWith('v') ? v : `v${v}`) : ''
      })(),
      qualityLevel: tags[0] || '',
      extraTagCount: extraTagLabels.length,
      extraTagLabels,
      sourceOrg: item.official ? '技术中心运营' : (item.author?.display_name ?? item.author?.displayName ?? ''),
      statusTag: getListCardStatusMeta(item),
    }
  })
})

function onUploadedListScroll() {
  const el = sectionRef.value
  if (!el) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < UPLOADED_SCROLL_THRESHOLD) {
    void uploadedAgentList.loadMore()
  }
}

function handleAgentCardOpen(id) {
  const row = (uploadedAgentList.list.value || []).find((item) => String(item.id) === String(id))
  if (!row) return
  const slug = String(row.slug ?? '').trim()
  const legacyId = row.id != null ? String(row.id).trim() : ''
  const routeId = slug || legacyId
  if (!routeId) return

  const resolved = resolveAgentAvatarUrl(String(row.avatar ?? '')).trim()
  const cover = resolved && !/default-avatar\.png/i.test(resolved) ? resolved : 'https://picsum.photos/seed/101/200/200'
  const versionId = row.latest_version_id ?? row.latest_version?.id

  router.push({
    name: 'MyAvatarDetail',
    params: { id: routeId },
    query: {
      from: 'my-uploads',
      ...(versionId != null ? { versionId } : {})
    },
    state: { skillHeroCover: cover, skillHeroForSlug: routeId },
  })
}

function goToUploadAvatar() {
  router.push({ name: 'AvatarCreate' })
}

function showUploadGuide() {
  window.open('https://yf2ljykclb.xfchat.iflytek.com/docx/doxrzTrNXecm6I9BWB6Ir0Qajxe', '_blank', 'noopener,noreferrer')
}

watch(activeTab, (tab) => {
  if (tab === 'uploaded') {
    uploadedAgentList.list.value = []
    uploadedAgentList.page.value = 1
    void uploadedAgentList.loadList()
  } else {
    avatars.value = []
    loadCategories()
    loadAgents(true)
  }
})

watch(categories, async () => {
  await nextTick()
  connectCategoryResizeObserver()
  updateCategoryOverflow()
})
</script>

<style lang="scss" scoped>
.banner {
  height: 180px;
  min-height: 180px;
  background: url('@/modules/market/avatar/components/images/banner-bg.png') no-repeat left top;
  background-size: cover;
  // margin: -1px -21px 16px;
  margin: -2px -21px -5px;
  z-index: 1;
  display: flex;
  align-items: self-end;
  justify-content: center;
  padding: 0 20px;
  container-type: inline-size;

  // .banner-left,
  // .banner-c,
  // .banner-right {
  //   // position: absolute;
  // }

  // &::after,
  // &::before {
  //   content: '';
  //   position: absolute;
  //   bottom: 0;
  // }

  .banner-left {
    left: 20px;
    width: 495px;
    height: 136.68px;
    background: url('@/modules/market/avatar/components/images/banner-left.png') no-repeat left bottom;
    background-size: contain;
    margin-bottom: 34px;
  }

  .banner-c {
    flex: 1;
    max-width: 325px;
    height: 20px;
  }

  .banner-right {
    right: 20px;
    width: 652px;
    height: 161px;
    background: url('@/modules/market/avatar/components/images/banner-right.png') no-repeat right bottom;
    background-size: contain;
    margin-bottom: 1px;
  }


  @container (max-width: 372px) {
    .banner-left {
      background-image: url('@/modules/market/avatar/components/images/banner-left-jw.png');
    }

    .banner-right {
      display: none;
    }
  }

  @container (max-width: 1050px) {
    .banner-right {
      display: none;
    }
  }

  @container (max-width: 1250px) {
    .banner-left,
    .banner-right {
      position: absolute;
    }

  }

}




/* 与 Skill 市场 SkillMarketView 对齐：白底、顶栏 + 分类分割 + 仅列表区滚动 + 工具栏/栅格/空状态 */
.avatar-market-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 20px 40px;
  border-radius: 12px;
  background-color: #fff;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.avatar-market-view__inner {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  container-type: inline-size;
  container-name: avatar-market;
  display: flex;
  flex-direction: column;
}

.avatar-market-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0 16px;
  margin-bottom: 4px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #fff;
}

/* ==================== Tab ==================== */
.avatar-market-view__tabs {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.avatar-market-view__tab {
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #2f3547;
  cursor: pointer;
  position: relative;
  min-width: 66px;

  .avatar-market-view__tab-swoosh {
    display: none;
    width: 18px;
    height: 14px;
    position: absolute;
    bottom: 0;
    right: -5px;
  }

  &.is-active {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: #2f3547;

    .avatar-market-view__tab-swoosh {
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

.avatar-market-view__toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* ==================== Tab 内容区 ==================== */
.avatar-market-view__tab-content {
  display: flex;
  flex-direction: column;
}

.avatar-market-view__filters-bar {
  position: sticky;
  top: var(--header-h, 60px);
  z-index: 9;
  background-color: #fff;
  padding-bottom: 4px;
}

.avatar-market-view__search {
  box-sizing: border-box;
}

.avatar-market-view__category-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eceef3;
}

.avatar-market-view__category-tags {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-width: 0;
  overflow: hidden;
  max-height: 34px;
  transition: max-height 0.1s ease;

  &.is-expanded {
    max-height: 200px;
  }
}

.avatar-market-view__cat {
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

  &--chip:not(.avatar-market-view__cat--all) {
    max-width: min(240px, 100%);
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  &--chip.is-active:not(.avatar-market-view__cat--all) {
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

.avatar-market-view__category-expand-btn {
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
  border-radius: 16px;
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
    background: transparent;
    color: #91949e;
  }
}

.avatar-market-view__expand-arrow-icon {
  width: 12px;
  height: 12px;
  margin-left: 2px;
  flex-shrink: 0;
  display: block;
}

.avatar-market-view__scroll {
}

.avatar-market-view__toolbar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 20px;
  padding-top: 8px;
  flex-wrap: wrap;
}

.avatar-market-view__sort {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-market-view__toolbar-divider {
  width: 1px;
  height: 14px;
  margin: 0 16px 0 20px;
  flex-shrink: 0;
  background: #dfe2ea;
}

.avatar-market-view__only-fav {
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

.avatar-market-view__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

  &--plain {
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
    }
  }

  &--popular {
    font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    letter-spacing: normal;
    color: #2f3547;

    &.is-active {
      font-weight: 600;
      color: #ff684e;
      background: #ffeeeb;
    }
  }
}

.avatar-market-view__flame {
  font-size: 14px;
  line-height: 1;
}

.avatar-market-view__grid {
  display: grid;
  // gap: 20px;
  row-gap: 32px;
  column-gap: 16px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
  padding-top: 16px;
}

.avatar-market-view__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 48px 24px;
  margin-top: 8px;
  text-align: center;
}

.avatar-market-view__empty-state-img {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  object-fit: contain;
  display: block;
  margin-bottom: 12px;
}

.avatar-market-view__empty-state-text {
  margin: 0;
  font-size: 14px;
  font-weight: normal;
  line-height: 24px;
  letter-spacing: normal;
  color: #2f3547;
}

@container avatar-market (min-width: calc(960px - 312px)) {
  .avatar-market-view__grid {
    grid-template-columns: repeat(2, minmax(296px, 1fr));
  }
}

@container avatar-market (min-width: calc(1280px - 312px)) {
  .avatar-market-view__grid {
    grid-template-columns: repeat(3, minmax(296px, 1fr));
  }
}

@container avatar-market (min-width: calc(1601px - 312px)) {
  .avatar-market-view__grid {
    grid-template-columns: repeat(4, minmax(296px, 1fr));
  }
}

.avatar-market-view__list-footer {
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

@media (max-width: 640px) {
  .avatar-market-view__search {
    width: 100% !important;
  }
}

/* ==================== 我的上传 Tab ==================== */
.avatar-market-view__status-filter-wrap {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding-bottom: 8px;
}

.avatar-market-view__status-filter {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  max-height: 34px;
  transition: max-height 0.25s ease;

  &.is-expanded {
    max-height: 200px;
  }
}

.avatar-market-view__status-btn {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 1px 12px;
  font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  color: #2f3547;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;

  // &:hover:not(.is-active) {
  //   background: #f7f8fa;
  // }

  &.is-active {
    color: #ff6d40;
    background: #ffeeeb;
    font-weight: 600;
  }
}

.avatar-market-view__uploaded-scroll {
}

.avatar-market-view__uploaded-grid {
  display: grid;
  row-gap: 32px;
  column-gap: 16px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
  padding-top: 16px;
}

@container avatar-market (min-width: calc(960px - 312px)) {
  .avatar-market-view__uploaded-grid {
    grid-template-columns: repeat(2, minmax(296px, 1fr));
  }
}

@container avatar-market (min-width: calc(1280px - 312px)) {
  .avatar-market-view__uploaded-grid {
    grid-template-columns: repeat(3, minmax(296px, 1fr));
  }
}

@container avatar-market (min-width: calc(1601px - 312px)) {
  .avatar-market-view__uploaded-grid {
    grid-template-columns: repeat(4, minmax(296px, 1fr));
  }
}
</style>
