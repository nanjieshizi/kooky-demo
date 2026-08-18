<template>
  <el-dialog
    v-model="visible"
    title="Skill 市场"
    :width="dialogWidth"
    :append-to-body="true"
    :destroy-on-close="true"
    class="skill-market-dialog"
  >
    <div class="skill-market-dialog__body">
      <!-- 搜索框 -->
      <div class="skill-market-dialog__search-wrap">
        <el-input
          v-model="keyword"
          placeholder="搜索 Skill"
          clearable
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 分类 tab -->
      <div class="skill-market-dialog__categories">
        <button
          v-for="c in displayCategories"
          :key="c.id"
          type="button"
          class="skill-market-dialog__cat"
          :class="{ 'is-active': activeCategoryId === c.id }"
          @click="activeCategoryId = c.id"
        >
          {{ c.label }}
        </button>
        <button
          v-if="hasCollapsibleCategories"
          type="button"
          class="skill-market-dialog__cat skill-market-dialog__cat--toggle"
          @click="categoriesExpanded = !categoriesExpanded"
        >
          <span>{{ categoriesExpanded ? '收起' : '更多' }}</span>
          <img
            :src="skillMoreIconUrl"
            width="14"
            height="14"
            :class="{ 'is-expanded': categoriesExpanded }"
            class="skill-market-dialog__toggle-icon"
            alt=""
          />
        </button>
      </div>

      <!-- 卡片网格（可滚动区域） -->
      <div
        ref="listRef"
        class="skill-market-dialog__list"
        @scroll.passive="onListScroll"
      >
        <div v-if="listLoading" class="skill-market-dialog__status">加载中…</div>
        <div v-else-if="skillsList.length === 0" class="skill-market-dialog__status">暂无数据</div>
        <template v-else>
          <div class="skill-market-dialog__grid">
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
              :collected="item.collected"
              :cover-url="item.coverUrl"
              :skill-slug="item.slug"
              :is-installed="Boolean(item.isInstalled)"
              @collect="onCollect(item)"
              @installed="onSkillCardInstalled"
            />
          </div>
          <p v-if="loadMoreLoading" class="skill-market-dialog__footer-tip">加载中…</p>
          <p v-else-if="!hasMore" class="skill-market-dialog__footer-tip">已经到底啦～</p>
        </template>
      </div>
    </div>

  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import skillMoreIconUrl from '@/assets/skill/skill-more.svg?url'
import SkillMarketCard from '@/modules/market/skill/components/SkillMarketCard.vue'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import {
  fetchSkillMarketList,
  fetchSkillMarketTags,
  postSkillFollow,
  deleteSkillFollow,
} from '@/modules/market/skill/skillMarketApi.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 弹框宽度：根据屏幕宽度自适应列数 ──
// 卡片 min-width 296px，gap 16px，body padding 40px，dialog padding ~48px
// 3列需要约 1008px，2列需要约 696px
const windowWidth = ref(window.innerWidth)
function onResize() { windowWidth.value = window.innerWidth }
window.addEventListener('resize', onResize)
onUnmounted(() => window.removeEventListener('resize', onResize))

const dialogWidth = computed(() => {
  if (windowWidth.value >= 1200) return Math.min(1080, Math.floor(windowWidth.value * 0.9)) + 'px'
  return Math.min(760, Math.floor(windowWidth.value * 0.9)) + 'px'
})

// ── 分类 ──
const categories = ref([{ id: 'all', label: '全部' }])
const activeCategoryId = ref('all')
const categoriesExpanded = ref(false)
const MAX_INLINE_CATS = 10
const hasCollapsibleCategories = computed(() => categories.value.length > MAX_INLINE_CATS)
const displayCategories = computed(() =>
  categoriesExpanded.value || !hasCollapsibleCategories.value
    ? categories.value
    : categories.value.slice(0, MAX_INLINE_CATS),
)

async function loadTags() {
  try {
    const tags = await fetchSkillMarketTags()
    const rest = tags
      .map((t) => ({ id: String(t?.name ?? '').trim(), label: String(t?.name ?? '').trim(), count: Number(t?.count) || 0 }))
      .filter((c) => c.id)
    categories.value = [{ id: 'all', label: '全部' }, ...rest]
  } catch {
    categories.value = [{ id: 'all', label: '全部' }]
  }
}

// ── 列表 ──
const keyword = ref('')
const skillsList = ref([])
const listLoading = ref(false)
const loadMoreLoading = ref(false)
const hasMore = ref(true)
const listPage = ref(1)
const PAGE_SIZE = 20
const listRef = ref(null)
const COVER_FALLBACK = 'https://picsum.photos/seed/101/200/200'

function resolveSkillCoverUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  if (/^data:/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  const base = getOneBaseUrl().replace(/\/$/, '')
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`
}

function isPlaceholderSkillImage(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return true
  if (/^data:/i.test(s)) return false
  return /default-avatar\.png$/i.test(s)
}

function resolveSkillCoverForCard(raw) {
  if (isPlaceholderSkillImage(raw)) return COVER_FALLBACK
  const resolved = resolveSkillCoverUrl(raw)
  return !resolved.trim() || isPlaceholderSkillImage(resolved) ? COVER_FALLBACK : resolved
}

function mapSkillRow(r) {
  const author = r?.author || {}
  const handle = String(author.handle || '').trim()
  const org = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : ''
  const ver = r?.version != null ? String(r.version).trim() : ''
  const versionLabel = ver && !/^v\d/i.test(ver) && /^\d/.test(ver) ? `v${ver}` : ver
  const slug = String(r?.slug ?? '').trim()
  const legacyId = String(r?.id ?? '').trim()
  return {
    id: slug || legacyId,
    slug: slug || legacyId,
    title: String(r?.displayName || '').trim(),
    version: versionLabel,
    org,
    tags: Array.isArray(r?.tags) ? r.tags : [],
    description: String(r?.summary || '').trim(),
    views: Number(r?.downloads) || 0,
    stars: Number(r?.stars) || 0,
    collected: Boolean(r?.isStarred),
    isInstalled: Boolean(
      r?.isInstalled
      ?? r?.is_installed
      ?? r?.installed
      ?? r?.hasInstalled
      ?? r?.installStatus === 'installed',
    ),
    coverUrl: resolveSkillCoverForCard(r?.image),
  }
}

function computeHasMore(pagination, batchLength, page, pageSize) {
  if (batchLength === 0) return false
  if (batchLength < pageSize) return false
  const total = Number(pagination?.total ?? pagination?.totalCount ?? pagination?.itemCount)
  if (Number.isFinite(total) && total >= 0) return page * pageSize < total
  const totalPages = Number(pagination?.totalPages ?? pagination?.pageCount ?? pagination?.pages)
  if (Number.isFinite(totalPages) && totalPages > 0) return page < totalPages
  if (pagination?.hasNext === false) return false
  if (pagination?.hasNext === true) return true
  return batchLength >= pageSize
}

let loadGeneration = 0
async function loadSkills(reset = true) {
  if (!reset && (!hasMore.value || loadMoreLoading.value || listLoading.value)) return
  const nextPage = reset ? 1 : listPage.value + 1
  const gen = ++loadGeneration
  if (reset) { listLoading.value = true; hasMore.value = true }
  else loadMoreLoading.value = true

  try {
    const search = keyword.value.trim()
    const params = {
      sort: 'downloads',
      isOfficial: false,
      isStarred: false,
      page: nextPage,
      pageSize: PAGE_SIZE,
      ...(activeCategoryId.value !== 'all' ? { tag: String(activeCategoryId.value).trim() } : {}),
      ...(search ? { search } : {}),
    }
    const { results, pagination } = await fetchSkillMarketList(params)
    if (gen !== loadGeneration) return
    const rows = (results || []).map(mapSkillRow)
    if (reset) {
      skillsList.value = rows
      listPage.value = 1
      if (listRef.value) listRef.value.scrollTop = 0
      hasMore.value = computeHasMore(pagination, rows.length, nextPage, PAGE_SIZE)
    } else {
      skillsList.value = [...skillsList.value, ...rows]
      listPage.value = nextPage
      hasMore.value = computeHasMore(pagination, rows.length, nextPage, PAGE_SIZE)
    }
  } catch {
    if (gen === loadGeneration && reset) { skillsList.value = []; hasMore.value = false }
  } finally {
    if (gen === loadGeneration) {
      listLoading.value = false
      loadMoreLoading.value = false
    }
  }
}

const SCROLL_THRESHOLD = 160
let searchTimer
function onListScroll() {
  const el = listRef.value
  if (!el || !hasMore.value || listLoading.value || loadMoreLoading.value) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) loadSkills(false)
}

function onSearch() {
  clearTimeout(searchTimer)
  loadSkills(true)
}

watch(keyword, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadSkills(true), 400) })
watch(activeCategoryId, () => loadSkills(true))
onUnmounted(() => clearTimeout(searchTimer))

// dialog 打开时加载数据
watch(visible, (v) => {
  if (v) { loadTags(); loadSkills(true) }
})

// ── 收藏 ──
const followInFlight = new Set()
async function onCollect(item) {
  const slug = String(item.slug || item.id || '').trim()
  if (!slug || followInFlight.has(slug)) return
  followInFlight.add(slug)
  try {
    const wasStarred = Boolean(item.collected)
    const r = await (wasStarred ? deleteSkillFollow(slug) : postSkillFollow(slug))
    const row = skillsList.value.find((s) => s.id === item.id)
    if (row) {
      row.collected = Boolean(r?.isStarred)
      // 更新收藏量：收藏时 +1，取消收藏时 -1
      if (r?.isStarred && !wasStarred) {
        row.stars = Math.max(0, (row.stars || 0) + 1)
      } else if (!r?.isStarred && wasStarred) {
        row.stars = Math.max(0, (row.stars || 0) - 1)
      }
    }
    ElMessage.success(r?.isStarred ? '收藏成功' : '已取消收藏')
  } catch (e) {
    const msg = (typeof e === 'object' && e?.message) || '操作失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    followInFlight.delete(slug)
  }
}

function onSkillCardInstalled(payload) {
  const key = String(payload?.skillSlug ?? '').trim()
  if (!key) return
  const row = skillsList.value.find((s) => s.slug === key || s.id === key)
  if (row) row.isInstalled = true
}
</script>

<style lang="scss" scoped>
.skill-market-dialog__body {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.skill-market-dialog__search-wrap {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.skill-market-dialog__categories {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.skill-market-dialog__cat {
  box-sizing: border-box;
  height: 28px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 1px 12px;
  font-size: 14px;
  line-height: 22px;
  color: #2f3547;
  background: #f7f8fa;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;

  &:hover:not(.is-active) {
    background: #eef0f3;
  }

  &.is-active {
    color: #ff6d40;
    background: #ffeeeb;
    font-weight: 600;
  }

  &--toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    color: #91949e;
    font-size: 12px;
    margin-left: auto;

    &:hover {
      background: transparent;
    }
  }
}

.skill-market-dialog__toggle-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;

  &.is-expanded {
    transform: rotate(180deg);
  }
}

.skill-market-dialog__list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 2px 8px;
}

.skill-market-dialog__status {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 48px 0;
}

.skill-market-dialog__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, 1fr);

  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.skill-market-dialog__footer-tip {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 12px 0;
  margin: 0;
}
</style>
