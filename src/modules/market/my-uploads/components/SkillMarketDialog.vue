<template>
  <el-dialog v-model="visible" 
    append-to-body title="Skill市场" width="960px" :close-icon="DialogCloseIcon" :close-on-click-modal="false"
    class=" skill-market-select-dialog">
    <template #header="{ close, titleId, titleClass }">
      <!-- Tab 切换 -->
      <div class="skill-market-dialog__tabs">
        <div class="skill-market-dialog__tab" :class="{ 'is-active': activeTab === 'market' }"
          @click="activeTab = 'market'">
          <span class="skill-market-dialog__tab-text">Skill市场</span>
          <img class="skill-market-dialog__tab-swoosh" :src="tabSwooshIcon" alt="" />
        </div>
        <div class="skill-market-dialog__tab" :class="{ 'is-active': activeTab === 'uploaded' }"
          @click="activeTab = 'uploaded'">
          <span class="skill-market-dialog__tab-text">上传的Skill</span>
          <img class="skill-market-dialog__tab-swoosh" :src="tabSwooshIcon" alt="" />
        </div>
      </div>
    </template>
    <div class="skill-market-dialog-content">
      <!-- Skill市场 Tab -->
      <div v-show="activeTab === 'market'" class="skill-market-dialog__tab-content">
        <Loading :visible="listLoading" text="加载中..." />

        <!-- 搜索（与市场 Skill 列表 MarketSpecSearchInput 一致） -->
        <MarketSpecSearchInput v-model="keyword" class="skill-market-dialog__search" placeholder="搜索 Skill" :width="910"
          @search="onSearch" />

        <!-- 分类标签：单行截断 +「更多 / 收起」（与 SkillMarketView 一致） -->
        <div class="skill-market-dialog__category-section">
          <div ref="categoryTagsRef" class="skill-market-dialog__category-tags"
            :class="{ 'is-expanded': categoriesExpanded }">
            <span v-for="cat in categories" :key="cat.id" role="button" tabindex="0" :data-cat-id="cat.id"
              class="skill-market-dialog__cat skill-market-dialog__cat--chip" :class="{
                'is-active': activeCategory === cat.id,
                'skill-market-dialog__cat--all': cat.id === 'all',
              }" :title="cat.id === 'all'
              ? undefined
              : cat.label
            " @click="activeCategory = cat.id" @keydown.enter.prevent="activeCategory = cat.id"
              @keydown.space.prevent="activeCategory = cat.id">
              {{ cat.label }}{{ cat.id === 'all' ? ` (${allSkillsTotal})` : '' }}
            </span>
          </div>
          <button v-if="hasCategoryOverflow" type="button" class="skill-market-dialog__category-expand-btn"
            :aria-expanded="categoriesExpanded" @click="toggleCategoriesExpanded">
            {{ categoriesExpanded ? '收起' : '更多' }}
            <img class="skill-market-dialog__expand-arrow-icon" :src="categoriesExpanded ? upIcon : downIcon" alt="" />
          </button>
        </div>

        <!-- Skill 卡片列表：滚动加载更多（与市场 Skill 列表一致，每页 20 条） -->
        <div ref="skillListScrollRef" class="skill-list" @scroll.passive="onSkillListScroll">
          <div v-if="!listLoading && allSkills.length === 0" class="empty-tip">
            暂无数据
          </div>
          <template v-else>
            <div class="skill-list-box">
              <SkillCardWithAdd v-for="item in allSkills" :key="item.id" :item="item" :is-added="addedIds.has(item.id)"
                @add="handleAdd" @remove="handleRemove" />
            </div>
            <p v-if="loadMoreLoading"
              class="skill-market-dialog__list-footer skill-market-dialog__list-footer--loading">
              加载中…
            </p>
            <p v-else-if="!hasMore && allSkills.length > 0"
              class="skill-market-dialog__list-footer skill-market-dialog__list-footer--end">
              已经到底啦～
            </p>
          </template>
        </div>
      </div>
      <!-- 上传的Skill Tab -->
      <div v-show="activeTab === 'uploaded'" class="skill-market-dialog__tab-content">
        <Loading :visible="uploadedListLoading" text="加载中..." />

        <!-- 上传的Skill 卡片列表：无搜索、无分类，滚动加载 -->
        <div ref="uploadedListScrollRef" class="skill-list skill-list--uploaded" @scroll.passive="onUploadedListScroll">
          <div v-if="!uploadedListLoading && uploadedSkills.length === 0" class="empty-tip">
            暂无上传的Skill
          </div>
          <template v-else>
            <div class="skill-list-box">
              <SkillCardWithAdd v-for="item in uploadedSkills" :key="item.id" :item="item"
                :is-added="addedIds.has(item.id)" @add="handleAdd" @remove="handleRemove" />
            </div>
            <p v-if="uploadedLoadMoreLoading"
              class="skill-market-dialog__list-footer skill-market-dialog__list-footer--loading">
              加载中…
            </p>
            <p v-else-if="!uploadedHasMore && uploadedSkills.length > 0"
              class="skill-market-dialog__list-footer skill-market-dialog__list-footer--end">
              已经到底啦～
            </p>
          </template>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Loading from '@/shared/components/Loading/index.vue'
import MarketSpecSearchInput from '@/shared/components/MarketSpecSearchInput.vue'
import SkillCardWithAdd from './SkillCardWithAdd.vue'
import { fetchSkillMarketList, fetchSkillMarketTags } from '../../skill/skillMarketApi.js'
import { fetchMySkills } from '../services/myUploadsApi'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import dialogCloseUrl from '@/modules/market/my-uploads/assets/dialog-close.svg'
import upIcon from '../../avatar/components/images/up.svg'
import downIcon from '../../avatar/components/images/down.svg'
// @ts-ignore
import tabSwooshIcon from '@/assets/market/myuploads/tab-skill-swoosh.svg'

// ==================== 常量 ====================
const PAGE_SIZE = 20
const SCROLL_LOAD_THRESHOLD_PX = 160
const FIXED_CATEGORIES = [{ id: 'all', label: '全部' }]

// ==================== Props & Emits ====================
const props = defineProps<{ modelValue: boolean; selectedIds?: number[] }>()
const emit = defineEmits(['update:modelValue', 'add', 'remove'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ==================== 对话框配置 ====================
const DialogCloseIcon = {
  name: 'AvatarUploadDialogCloseIcon',
  render() {
    return h('img', {
      class: 'avatar-upload-dialog__close-icon',
      src: dialogCloseUrl,
      width: 12,
      height: 12,
      alt: '',
      draggable: false,
    })
  },
}

// ==================== Tab 状态 ====================
const activeTab = ref<'market' | 'uploaded'>('market')
const addedIds = ref(new Set<number>(props.selectedIds ?? []))

// ==================== Skill 市场 Tab ====================
const keyword = ref('')
const activeCategory = ref('all')
const categories = ref(FIXED_CATEGORIES)
const allSkills = ref<any[]>([])
const allSkillsTotal = ref(0)
const listLoading = ref(false)
const loadMoreLoading = ref(false)
const listPage = ref(1)
const hasMore = ref(true)
const skillListScrollRef = ref<HTMLElement | null>(null)

// 分类展开/收起状态
const categoriesExpanded = ref(false)
const categoryTagsRef = ref<HTMLElement | null>(null)
const hasCategoryOverflow = ref(false)
const isCategoryMaxHeightAnimating = ref(false)
let categoryResizeObserver: ResizeObserver | null = null
let categoryTagsTransitionEndEl: HTMLElement | null = null
let categoryCollapseAnimFallbackTimer: ReturnType<typeof setTimeout> | null = null

// ==================== 上传的 Skill Tab ====================
const uploadedSkills = ref<any[]>([])
const uploadedListLoading = ref(false)
const uploadedLoadMoreLoading = ref(false)
const uploadedPage = ref(1)
const uploadedHasMore = ref(true)
const uploadedListScrollRef = ref<HTMLElement | null>(null)

// ==================== 工具函数 ====================
function resolveUrl(path: string) {
  if (!path) return ''
  if (/^(data:|https?:\/\/)/.test(path)) return path
  const base = getOneBaseUrl().replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

function computeHasMore(
  pagination: Record<string, unknown> | undefined,
  batchLength: number,
  page: number,
  pageSize: number,
) {
  if (batchLength === 0) return false
  if (batchLength < pageSize) return false

  const total = Number(pagination?.total ?? pagination?.totalCount ?? pagination?.itemCount)
  if (Number.isFinite(total) && total >= 0) {
    return page * pageSize < total
  }

  const totalPages = Number(pagination?.totalPages ?? pagination?.pageCount ?? pagination?.pages)
  if (Number.isFinite(totalPages) && totalPages > 0) {
    return page < totalPages
  }

  if (pagination?.hasNext === false) return false
  if (pagination?.hasNext === true) return true
  return batchLength >= pageSize
}

// ==================== 分类展开/收起逻辑 ====================
function clearCategoryCollapseAnimFallback() {
  if (categoryCollapseAnimFallbackTimer != null) {
    clearTimeout(categoryCollapseAnimFallbackTimer)
    categoryCollapseAnimFallbackTimer = null
  }
}

function updateCategoryOverflow() {
  const el = categoryTagsRef.value
  if (!el || isCategoryMaxHeightAnimating.value) {
    hasCategoryOverflow.value = false
    return
  }

  if (categoriesExpanded.value) {
    hasCategoryOverflow.value = true
    return
  }

  const prevMaxHeight = el.style.maxHeight
  const prevOverflowY = el.style.overflowY
  el.style.maxHeight = '36px'
  el.style.overflowY = 'hidden'

  hasCategoryOverflow.value = el.scrollHeight - el.clientHeight > 1

  el.style.maxHeight = prevMaxHeight
  el.style.overflowY = prevOverflowY
}

function connectCategoryResizeObserver() {
  disconnectCategoryResizeObserver()
  if (typeof ResizeObserver === 'undefined') return

  const el = categoryTagsRef.value
  if (!el) return

  const handler = (ev: TransitionEvent) => {
    if (ev.propertyName === 'max-height' && ev.target === el) {
      clearCategoryCollapseAnimFallback()
      isCategoryMaxHeightAnimating.value = false
      updateCategoryOverflow()
    }
  }

  el.addEventListener('transitionend', handler as EventListener)
  categoryTagsTransitionEndEl = el
  categoryResizeObserver = new ResizeObserver(() => updateCategoryOverflow())
  categoryResizeObserver.observe(el)
}

function disconnectCategoryResizeObserver() {
  clearCategoryCollapseAnimFallback()
  if (categoryTagsTransitionEndEl) {
    categoryTagsTransitionEndEl.removeEventListener('transitionend', () => {})
    categoryTagsTransitionEndEl = null
  }
  if (categoryResizeObserver) {
    categoryResizeObserver.disconnect()
    categoryResizeObserver = null
  }
}

function toggleCategoriesExpanded() {
  const next = !categoriesExpanded.value
  categoriesExpanded.value = next

  if (next) {
    isCategoryMaxHeightAnimating.value = false
    clearCategoryCollapseAnimFallback()
  } else {
    // 收起时确保激活分类在第一行，否则重置为"全部"
    const wrap = categoryTagsRef.value
    if (wrap && activeCategory.value !== 'all') {
      const activeEl = wrap.querySelector(`[data-cat-id="${CSS.escape(activeCategory.value)}"]`)
      const firstEl = wrap.querySelector('[data-cat-id]')
      if (activeEl && firstEl && (activeEl as HTMLElement).offsetTop > (firstEl as HTMLElement).offsetTop + 1) {
        activeCategory.value = 'all'
      }
    }

    isCategoryMaxHeightAnimating.value = true
    categoryCollapseAnimFallbackTimer = setTimeout(() => {
      isCategoryMaxHeightAnimating.value = false
      updateCategoryOverflow()
    }, 200)
  }
}

function handleCategoryWindowResize() {
  if (!visible.value) return
  updateCategoryOverflow()
}

// ==================== Skill 市场 Tab 逻辑 ====================
let loadSkillsSeq = 0

function buildListQuery(): Record<string, string> {
  const q: Record<string, string> = {}
  const kw = keyword.value.trim()
  if (kw) q.search = kw

  const cat = activeCategory.value
  if (cat !== 'all') q.tag = String(cat).trim()

  return q
}

function onSearch() {
  loadSkills(true)
}

function onSkillListScroll() {
  const el = skillListScrollRef.value
  if (!el || !hasMore.value || listLoading.value || loadMoreLoading.value) return

  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
    loadSkills(false)
  }
}

async function loadSkills(reset = true) {
  const seq = ++loadSkillsSeq

  if (!reset) {
    if (!hasMore.value || loadMoreLoading.value || listLoading.value) return
  }

  const nextPage = reset ? 1 : listPage.value + 1

  if (reset) {
    listLoading.value = true
    hasMore.value = true
  } else {
    loadMoreLoading.value = true
  }

  const listQuery = buildListQuery()

  try {
    const { results, pagination } = await fetchSkillMarketList({
      page: nextPage,
      pageSize: PAGE_SIZE,
      sort: 'downloads',
      isOfficial: false,
      isStarred: false,
      ...listQuery,
    })

    const pag = (pagination || {}) as Record<string, unknown>
    const rawRows = (results || []) as any[]
    let batch = rawRows

    if (!reset) {
      const existingIds = new Set(allSkills.value.map((s: any) => s.id))
      batch = batch.filter((s: any) => !existingIds.has(s.id))
    }

    /** 与 SkillMarketView 一致：hasMore 按接口本页条数算；去重后 batch 可能变短 */
    const pageHasMore = computeHasMore(pag, rawRows.length, nextPage, PAGE_SIZE)

    // console.log('[SkillMarket] batch[0]:', JSON.stringify(batch[0]))

    if (seq !== loadSkillsSeq) return

    if (reset) {
      allSkills.value = batch
      listPage.value = 1
      hasMore.value = pageHasMore

      // 只有当 tab 为 skill 市场且 tag 为全部时，才赋值 allSkillsTotal
      if (activeTab.value === 'market' && activeCategory.value === 'all') {
        allSkillsTotal.value = Number(pag?.total ?? pag?.totalCount ?? 0)
      }

      await nextTick()
      const root = skillListScrollRef.value
      if (root) root.scrollTop = 0
    } else if (rawRows.length === 0) {
      hasMore.value = false
    } else if (batch.length === 0) {
      listPage.value = nextPage
      hasMore.value = pageHasMore
    } else {
      allSkills.value = [...allSkills.value, ...batch]
      listPage.value = nextPage
      hasMore.value = pageHasMore
    }

    // console.log('[SkillMarket] allSkills[0]:', JSON.stringify(allSkills.value[0]))
  } catch (e) {
    // console.error('[SkillMarket] loadSkills error:', e)
    if (seq !== loadSkillsSeq) return
    if (reset) {
      allSkills.value = []
      hasMore.value = false
    }
  } finally {
    if (seq === loadSkillsSeq) {
      listLoading.value = false
      loadMoreLoading.value = false
    }
  }
}

async function loadTags() {
  try {
    const tags = await fetchSkillMarketTags()
    const extra = tags.map((t: any) => ({ id: t.name, label: t.name })).filter((c: any) => c.id)
    categories.value = [...FIXED_CATEGORIES, ...extra.filter((c: any) => !FIXED_CATEGORIES.find(f => f.id === c.id))]
  } catch { /* keep defaults */ }
}

watch(visible, async (v) => {
  if (v) {
    addedIds.value = new Set(props.selectedIds ?? [])
    activeTab.value = 'market'
    allSkillsTotal.value = 0
    uploadedSkills.value = []
    uploadedPage.value = 1
    uploadedHasMore.value = true
    await Promise.all([loadSkills(true), loadTags()])
    await nextTick()
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  } else {
    disconnectCategoryResizeObserver()
    categoriesExpanded.value = false
  }
})

watch(
  () => categories.value.map((c) => c.id).join('|'),
  async () => {
    if (!visible.value) return
    await nextTick()
    connectCategoryResizeObserver()
    updateCategoryOverflow()
  },
)

/** 分类切换与市场页一致：改 tag 即重新请求，不做前端按标签过滤 */
watch(activeCategory, () => {
  if (!visible.value) return
  loadSkills(true)
})

onMounted(() => {
  window.addEventListener('resize', handleCategoryWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleCategoryWindowResize)
  disconnectCategoryResizeObserver()
})

function handleAdd(item: any) {
  addedIds.value.add(item.id)
  emit('add', item)
}

function handleRemove(item: any) {
  addedIds.value.delete(item.id)
  emit('remove', item)
}

// ==================== 上传的 Skill Tab 逻辑 ====================
const UPLOADED_PAGE_SIZE = 20
let loadUploadedSeq = 0

function mapUploadedRow(r: any) {
  // 处理 tags：新 API 返回对象 { latest: "version" }，转换为数组
  let tags: string[] = []
  if (r?.tags && typeof r.tags === 'object' && !Array.isArray(r.tags)) {
    tags = Object.keys(r.tags)
  } else if (Array.isArray(r?.tags)) {
    tags = r.tags
  }

  // 处理 stats：从嵌套对象提取
  const downloads = Number(r?.stats?.downloads ?? r?.statsDownloads ?? r?.downloads) || 0
  const stars = Number(r?.stats?.stars ?? r?.statsStars ?? r?.stars) || 0

  return {
    id: r?.id ?? r?.slug,
    slug: r?.slug,
    displayName: r?.displayName || r?.slug || '',
    summary: r?.summary ?? r?.description ?? '',
    avatar: resolveUrl(r?.avatar ?? r?.image ?? r?.latestVersion?.icon ?? r?.author?.image ?? ''),
    tags,
    downloads,
    stars,
    version: r?.version || '',
    isMyUpload: true,
    author: r?.author,
    status: r?.status
  }
}

async function loadUploadedSkills(reset = true) {
  const seq = ++loadUploadedSeq

  if (!reset && (!uploadedHasMore.value || uploadedLoadMoreLoading.value || uploadedListLoading.value)) return

  const nextPage = reset ? 1 : uploadedPage.value + 1

  if (reset) {
    uploadedListLoading.value = true
    uploadedHasMore.value = true
  } else {
    uploadedLoadMoreLoading.value = true
  }

  try {
    const res = await fetchMySkills({ page: nextPage, pageSize: UPLOADED_PAGE_SIZE, status: 'all' })
    const rows = (res.results || []).map(mapUploadedRow)
    const pag = res.pagination as any
    const pageHasMore = pag?.hasMore ?? (rows.length >= UPLOADED_PAGE_SIZE)

    if (seq !== loadUploadedSeq) return

    if (reset) {
      uploadedSkills.value = rows
      uploadedPage.value = 1
      uploadedHasMore.value = pageHasMore
      await nextTick()
      const el = uploadedListScrollRef.value
      if (el) el.scrollTop = 0
    } else {
      uploadedSkills.value = [...uploadedSkills.value, ...rows]
      uploadedPage.value = nextPage
      uploadedHasMore.value = pageHasMore
    }
  } catch (e) {
    // console.error('[UploadedSkill] loadUploadedSkills error:', e)
    if (seq !== loadUploadedSeq) return
    if (reset) {
      uploadedSkills.value = []
      uploadedHasMore.value = false
    }
  } finally {
    if (seq === loadUploadedSeq) {
      uploadedListLoading.value = false
      uploadedLoadMoreLoading.value = false
    }
  }
}

function onUploadedListScroll() {
  const el = uploadedListScrollRef.value
  if (!el || !uploadedHasMore.value || uploadedListLoading.value || uploadedLoadMoreLoading.value) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD_PX) {
    loadUploadedSkills(false)
  }
}

watch(activeTab, (tab) => {
  if (!visible.value) return
  if (tab === 'uploaded' && uploadedSkills.value.length === 0) {
    loadUploadedSkills(true)
  }
})
</script>

<style lang="scss" scoped>
.skill-market-dialog__tabs {
  display: flex;
  gap: 12px;
  flex-shrink: 0;

  .skill-market-dialog__tab {
    font-family: PingFang SC;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    text-align: justify;
    /* 浏览器可能不支持 */
    letter-spacing: normal;
    /* 文本色&图标色/--color-text-primary */
    /* 样式描述：一级文本色 */
    color: #2F3547;
    cursor: pointer;
    position: relative;
    min-width: 66px;

    .skill-market-dialog__tab-swoosh {
      display: none;
      width: 18px;
      height: 14px;
      position: absolute;
      bottom: 0;
      right: -5px;
    }

    &.is-active,
    &:hover {
      font-family: 苹方;
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
      text-align: justify;
      /* 浏览器可能不支持 */
      letter-spacing: normal;
      /* 文本色&图标色/--color-text-primary */
      /* 样式描述：一级文本色 */
      color: #2F3547;

      .skill-market-dialog__tab-swoosh {
        display: block;
      }
    }
  }
  .skill-market-dialog__tab:nth-last-child(1) {
    margin-left: 12px;
    &.is-active {
      margin-left: 0px;
    }
  }
}

.skill-market-dialog-content {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;

  .skill-market-dialog__tab-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;

    .skill-market-dialog__search {
      margin-bottom: 16px;
      flex-shrink: 0;
    }

    .skill-market-dialog__category-section {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding-bottom: 24px;
      flex-shrink: 0;

      .skill-market-dialog__category-tags {
        display: flex;
        flex: 1;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
        overflow: hidden;
        max-height: 34px;
        transition: max-height 0.1s ease;

        &.is-expanded {
          max-height: 200px;
        }

        .skill-market-dialog__cat {
          box-sizing: border-box;
          position: relative;
          z-index: 1;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1px 12px;
          font-family: 'PingFang SC', 'PingFang TC', 'Microsoft YaHei', sans-serif;
          font-size: 14px;
          font-weight: normal;
          line-height: 22px;
          text-align: center;
          color: #2f3547;
          background: transparent;
          border-radius: 16px;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s, color 0.15s;
          min-width: 0;
          outline: none;

          &--chip:not(.skill-market-dialog__cat--all) {
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

          // &:hover:not(.is-active) {
          //   color: #ff6d40;
          //   background: #ffeeeb;
          //   font-weight: 600;
          // }

          &:focus-visible {
            box-shadow: 0 0 0 2px rgba(255, 104, 78, 0.35);
          }

          &.is-active {
            color: #ff6d40;
            background: #ffeeeb;
            font-weight: 600;
          }

          &--chip.is-active:not(.skill-market-dialog__cat--all) {
            max-width: min(240px, 100%);
            height: 28px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          &--all.is-active {
            min-width: 52px;
            height: 28px;
            color: #ff684e;
            background: #ffeeeb;
            font-weight: 600;
            flex: 0 0 auto;
          }
        }
      }

      .skill-market-dialog__category-expand-btn {
        width: 50px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
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

        .skill-market-dialog__expand-arrow-icon {
          width: 12px;
          height: 12px;
          margin-left: 2px;
          flex-shrink: 0;
          display: block;
        }
      }
    }

    .skill-list {
      flex: 1;
      min-height: 80px;
      overflow-y: auto;

      &.skill-list--uploaded {
        // padding-top: 16px;
        margin-top: 4px;
      }

      .skill-list-box {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }

      .empty-tip {
        flex: 1;
        text-align: center;
        color: #8f959e;
        font-size: 13px;
        padding: 40px 0;
        width: 100%;
      }

      .skill-market-dialog__list-footer {
        width: 100%;
        text-align: center;
        font-size: 13px;
        color: #91949e;
        padding: 12px 0 4px;
        margin: 0;

        &.skill-market-dialog__list-footer--loading {
          color: #606572;
        }

        &.skill-market-dialog__list-footer--end {
          color: #c2c3c9;
        }
      }
    }
  }
}
</style>

<!-- teleported 到 body，单独用类名限定本弹窗，不影响其它 el-dialog -->
<style lang="scss">
.skill-market-select-dialog {
  padding: 20px 24px 32px 24px;
  height: 546px !important;
  top: 50%;
  transform: translateY(-50%);
  margin: 0 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .el-dialog__header {
    padding: 0;
    // margin-bottom: 16px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #2f3547;
    }

    .el-dialog__headerbtn {
      width: 12px;
      height: 12px;
      position: initial;

      .el-dialog__close {
        width: 12px;
        height: 12px;
        color: #91949e;
      }
    }
  }

  .el-dialog__body {
    padding: 0;
    flex: 1;
    overflow: hidden;
  }
}
</style>
