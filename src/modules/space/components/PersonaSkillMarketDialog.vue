<template>
  <el-dialog
    v-model="visible"
    title="Skill 市场"
    :width="dialogWidth"
    align-center
    :append-to-body="true"
    :destroy-on-close="true"
    modal-class="persona-skill-market-dialog-overlay"
    class="persona-skill-market-dialog"
  >
    <div class="persona-skill-market-dialog__body">
      <!-- 搜索框 -->
      <div class="persona-skill-market-dialog__search-wrap">
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
      <div class="persona-skill-market-dialog__categories">
        <button
          v-for="c in displayCategories"
          :key="c.id"
          type="button"
          class="persona-skill-market-dialog__cat"
          :class="{ 'is-active': activeCategoryId === c.id }"
          @click="activeCategoryId = c.id"
        >
          {{ c.label }}
        </button>
        <button
          v-if="hasCollapsibleCategories"
          type="button"
          class="persona-skill-market-dialog__cat persona-skill-market-dialog__cat--toggle"
          @click="categoriesExpanded = !categoriesExpanded"
        >
          <span>{{ categoriesExpanded ? '收起' : '更多' }}</span>
          <img
            :src="skillMoreIconUrl"
            width="14"
            height="14"
            :class="{ 'is-expanded': categoriesExpanded }"
            class="persona-skill-market-dialog__toggle-icon"
            alt=""
          />
        </button>
      </div>

      <!-- 卡片网格（可滚动区域） -->
      <div
        ref="listRef"
        class="persona-skill-market-dialog__list"
        @scroll.passive="onListScroll"
      >
        <div v-if="listLoading" class="persona-skill-market-dialog__status">加载中…</div>
        <div v-else-if="skillsList.length === 0" class="persona-skill-market-dialog__status">暂无数据</div>
        <template v-else>
          <div class="persona-skill-market-dialog__grid">
            <div
              v-for="item in skillsList"
              :key="item.id"
              class="psm-card"
              :class="{ 'is-selected': item.isInstalled }"
            >
              <div class="psm-card__top">
                <div class="psm-card__icon-wrap">
                  <img class="psm-card__icon" :src="item.coverUrl" :alt="item.title" loading="lazy" />
                </div>
                <div class="psm-card__meta">
                  <div class="psm-card__title-row">
                    <span class="psm-card__title">{{ item.title }}</span>
                    <span class="psm-card__version">{{ item.version }}</span>
                  </div>
                  <div class="psm-card__org-row">
                    <span v-if="item.tags && item.tags[0]" class="psm-card__tag">{{ item.tags[0] }}</span>
                    <span class="psm-card__org">{{ item.org }}</span>
                  </div>
                </div>
              </div>
              <p class="psm-card__desc">{{ item.description || '-' }}</p>
              <div class="psm-card__footer">
                <div class="psm-card__stats">
                  <span class="psm-card__stat">
                    <img :src="skillDownloadStatUrl" width="14" height="14" alt="" />
                    {{ item.views }}
                  </span>
                  <span class="psm-card__stat psm-card__stat--collect" @click.stop="onCollect(item)">
                    <img :src="item.collected ? collectStarFilledUrl : skillStarUrl" width="14" height="14" alt="" />
                    {{ item.stars }}
                  </span>
                </div>
                <button
                  v-if="!item.isInstalled"
                  class="psm-card__btn"
                  :disabled="installingSet.has(item.slug)"
                  @click.stop="handleInstall(item)"
                >
                  <img v-if="installingSet.has(item.slug)" :src="skillZhuanquanUrl" class="psm-card__spinner" alt="" />
                  {{ installingSet.has(item.slug) ? '安装中' : '安装' }}
                </button>
                <button v-else class="psm-card__btn psm-card__btn--remove" @click.stop="handleRemove(item)">
                  移除
                </button>
              </div>
            </div>
          </div>
          <p v-if="loadMoreLoading" class="persona-skill-market-dialog__footer-tip">加载中…</p>
          <p v-else-if="!hasMore" class="persona-skill-market-dialog__footer-tip">已经到底啦～</p>
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
import skillDownloadStatUrl from '@/assets/skill/skill-xiazai.svg?url'
import skillStarUrl from '@/assets/skill/skill-xingxing.svg?url'
import collectStarFilledUrl from '@/assets/market/collect-star-filled.png'
import skillZhuanquanUrl from '@/assets/skill/skill-zhuanquan.png'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import {
  fetchSkillMarketList,
  fetchSkillMarketTags,
  postSkillFollow,
  deleteSkillFollow,
  installSkillToAgent,
} from '@/modules/market/skill/skillMarketApi.js'
import { unbindSkillFromAgent } from '@/modules/deerflow-chat/services/skillApi'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentId: { type: [Number, String], default: null },
  installedSlugs: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'skill-installed'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 弹框宽度：根据屏幕宽度自适应列数 ──
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
    views: Number(r?.stats?.downloads ?? r?.downloads ?? r?.download_count ?? r?.downloadCount ?? r?.installCount ?? r?.install_count) || 0,
    stars: Number(r?.stats?.stars ?? r?.stars ?? r?.star_count ?? r?.starCount ?? r?.collectCount ?? r?.collect_count) || 0,
    collected: Boolean(r?.isStarred ?? r?.is_starred ?? r?.collected),
    isInstalled: props.installedSlugs.includes(slug || legacyId),
    coverUrl: resolveSkillCoverForCard(r?.avatar ?? r?.image),
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

// 父组件刷新 installedSlugs 后同步更新列表中每个卡片的 isInstalled 状态
watch(() => props.installedSlugs, (slugs) => {
  skillsList.value.forEach(item => {
    item.isInstalled = slugs.includes(item.slug)
  })
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
    const nowStarred = r?.isStarred != null ? Boolean(r.isStarred) : !wasStarred
    const row = skillsList.value.find((s) => s.id === item.id)
    if (row) {
      row.collected = nowStarred
      if (nowStarred && !wasStarred) {
        row.stars = Math.max(0, (row.stars || 0) + 1)
      } else if (!nowStarred && wasStarred) {
        row.stars = Math.max(0, (row.stars || 0) - 1)
      }
    }
    ElMessage.success(nowStarred ? '收藏成功' : '已取消收藏')
  } catch (e) {
    const msg = (typeof e === 'object' && e?.message) || '操作失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    followInFlight.delete(slug)
  }
}

// ── 安装 / 移除 ──
const installingSet = ref(new Set())

async function handleInstall(item) {
  if (!props.agentId) {
    ElMessage.warning('缺少智能体 ID')
    return
  }
  const slug = item.slug
  if (installingSet.value.has(slug)) return
  installingSet.value = new Set([...installingSet.value, slug])
  try {
    await installSkillToAgent(slug, props.agentId)
    item.isInstalled = true
    ElMessage.success('安装成功')
    emit('skill-installed', { skillSlug: slug, agentId: props.agentId })
  } catch (e) {
    const msg = (typeof e === 'object' && e?.message) || '安装失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    const next = new Set(installingSet.value)
    next.delete(slug)
    installingSet.value = next
  }
}

async function handleRemove(item) {
  if (!props.agentId) return
  const slug = item.slug
  if (installingSet.value.has(slug)) return
  installingSet.value = new Set([...installingSet.value, slug])
  try {
    await unbindSkillFromAgent(slug, props.agentId)
    // 找到列表中对应的项并更新状态
    const row = skillsList.value.find((s) => s.id === item.id)
    if (row) {
      row.isInstalled = false
    }
    ElMessage.success('已移除')
    // 通知父组件刷新数据
    emit('skill-installed', { skillSlug: slug, agentId: props.agentId })
  } catch (e) {
    const msg = (typeof e === 'object' && e?.message) || '移除失败，请稍后再试'
    ElMessage.error(msg)
  } finally {
    const next = new Set(installingSet.value)
    next.delete(slug)
    installingSet.value = next
  }
}
</script>

<style lang="scss" scoped>
.persona-skill-market-dialog__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.persona-skill-market-dialog__search-wrap {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.persona-skill-market-dialog__categories {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.persona-skill-market-dialog__cat {
  padding: 6px 12px;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: #6B7280;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: #D1D5DB;
    background: #F9FAFB;
  }

  &.is-active {
    border-color: #FF6B2C;
    background: #FFF3E0;
    color: #FF6B2C;
    font-weight: 500;
  }

  &--toggle {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.persona-skill-market-dialog__toggle-icon {
  transition: transform 0.2s;

  &.is-expanded {
    transform: rotate(180deg);
  }
}

.persona-skill-market-dialog__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  /* 有溢出时预留槽位，避免悬停出现滑块时布局跳动 */
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;

  &:hover {
    scrollbar-color: #c4c8d4 #f0f2f5;
  }

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-track {
    background: #f0f2f5;
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb {
    background: #c4c8d4;
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb:hover {
    background: #a8adb8;
  }
}

.persona-skill-market-dialog__status {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  padding: 60px 0;
}

.persona-skill-market-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(296px, 1fr));
  gap: 16px;
  padding-bottom: 16px;
}

.persona-skill-market-dialog__footer-tip {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 16px 0;
  margin: 0;
}

// ── 技能卡片 ──
.psm-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  background: #fff;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: #D1D5DB;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  // &.is-selected {
  //   border-color: #FF6B2C;
  //   background: #FFFAF7;
  // }
}

.psm-card__top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.psm-card__icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f3f4f6;
}

.psm-card__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.psm-card__meta {
  flex: 1;
  min-width: 0;
}

.psm-card__title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}

.psm-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psm-card__version {
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
}

.psm-card__org-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.psm-card__tag {
  font-size: 11px;
  color: #6b7280;
  background: #F3F4F6;
  padding: 1px 6px;
  border-radius: 4px;
}

.psm-card__org {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psm-card__desc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.psm-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.psm-card__stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.psm-card__stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;

}

.psm-card__stat--collect {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  transition: background 0.15s;

  &:hover {
    background: #F3F4F6;
  }
}

.psm-card__btn {
  padding: 5px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
  background: #171B26;
  color: #fff;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--remove {
    background: transparent;
    color: #6b7280;
    border: 1px solid #E5E7EB;

    &:hover {
      cursor: pointer;
      // background: #FEF2F2;
      // color: #ef4444;
      // border-color: #FECACA;
    }
  }
}

.psm-card__spinner {
  width: 12px;
  height: 12px;
  animation: psm-spin 0.9s linear infinite;
}

@keyframes psm-spin {
  to { transform: rotate(360deg); }
}
</style>

<style>
/* 遮罩与 overlay 包裹层不滚动；弹窗在视口内垂直居中由 align-center 处理 */
.persona-skill-market-dialog-overlay.el-overlay {
  overflow: hidden !important;
}

.persona-skill-market-dialog-overlay .el-overlay-dialog {
  overflow: hidden !important;
}

.persona-skill-market-dialog.el-dialog {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  min-height: 0;
  overflow: hidden;
}

.persona-skill-market-dialog .el-dialog__header {
  flex-shrink: 0;
}

.persona-skill-market-dialog .el-dialog__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 20px 24px;
  height: auto;
  max-height: none;
  overflow: hidden;
  box-sizing: border-box;
}
</style>

