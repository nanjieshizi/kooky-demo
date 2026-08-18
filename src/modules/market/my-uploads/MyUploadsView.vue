<template>
  <section class="my-uploads-view">
    <div class="market-container my-uploads-view__inner">
      <Loading
        v-if="uploadType === 'skill'"
        :visible="skillList.listLoading.value"
        text="加载中..." />
        <Loading
        v-if="uploadType === 'avatar'"
        :visible="agentList.listLoading.value"
        text="加载中..." />
      <!-- 头部工具栏 -->
      <div class="header-bar">
        <h1 class="page-title">{{ pageTitle }}</h1>
        <div class="toolbar">
          <MarketSpecSearchInput
            v-model="searchKeyword"
            class="search-input"
            placeholder="搜索名称或标签"
            :width="240"
            :debounce-ms="320"
            @search="handleSearch"
          />
          <MarketCustomButton @click="showUploadGuide">
            上传指引
          </MarketCustomButton>
          <MarketCustomButton
            variant="dark"
            @click="handleUploadClick"
          >
            {{ uploadType === 'avatar' ? '上传数字人' : '上传 Skill' }}
          </MarketCustomButton>
        </div>
      </div>

      <!-- Avatar 列表 -->
      <div v-if="uploadType === 'avatar'" ref="scrollRoot" class="content-section" style="padding-top: 16px;"
        @scroll.passive="onListScroll">
        <div class="loading-wrapper">
          <EmptyState v-if="agentList.isEmpty.value" type="agent" @upload="handleUpload('avatar')" />
          <div v-else>
            <div class="card-list">
              <AvatarCard
                v-for="item in myUploadAgentCards"
                :key="item.id"
                :avatar="item"
                :status-tag="item.statusTag"
                :view-only-emit-open="true"
                @view-detail="handleAgentCardOpen"
              />
            </div>
            <p v-if="agentList.loadMoreLoading.value" class="list-footer list-footer--loading">
              加载中…
            </p>
            <p v-else-if="!agentList.hasMore.value && agentList.list.value.length > 0"
              class="list-footer list-footer--end">
              已经到底啦，换个方向逛逛吧～
            </p>
          </div>
        </div>
      </div>

      <!-- Skill 列表 -->
      <div v-if="uploadType === 'skill'" ref="scrollRoot" class="content-section" @scroll.passive="onListScroll">
        <div class="loading-wrapper">
          <EmptyState v-if="skillList.isEmpty.value" type="skill" @upload="handleUpload('skill')" />
          <div v-else>
            <div class="card-list">
              <SkillCard v-for="item in skillList.list.value" :key="item.id" :item="item" view-mode="list" />
            </div>
            <p v-if="skillList.loadMoreLoading.value" class="list-footer list-footer--loading">
              加载中…
            </p>
            <p v-else-if="!skillList.hasMore.value && skillList.list.value.length > 0"
              class="list-footer list-footer--end">
              已经到底啦，换个方向逛逛吧～
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MyUploadsView' })
import { computed, ref, nextTick, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MarketSpecSearchInput from '@/shared/components/MarketSpecSearchInput.vue'
import MarketCustomButton from '@/modules/market/components/MarketCustomButton.vue'
import AvatarCard from '@/modules/market/avatar/components/AvatarCard.vue'
import defaultAvatarSrc from '@/assets/default-avatar.svg'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'
import { useAgentList } from './composables/useAgentList'
import { useSkillList } from './composables/useSkillList'
import SkillCard from './components/SkillCard.vue'
import EmptyState from './components/EmptyState.vue'
import { getListCardStatusMeta } from './utils/listCardStatusMeta'
import type { AgentItem } from './types'

const searchKeyword = ref('')
const router = useRouter()
const route = useRoute()

// 从路由参数获取上传类型
const uploadType = computed(() => {
  const type = route.query.type as string
  return type === 'avatar' ? 'avatar' : 'skill'
})

// 页面标题
const pageTitle = computed(() => {
  return uploadType.value === 'avatar' ? '上传的数字人' : '上传的 Skill'
})

const agentList = useAgentList(searchKeyword)
const skillList = useSkillList(searchKeyword)

const scrollRoot = ref<HTMLElement | null>(null)
const SCROLL_LOAD_THRESHOLD_PX = 160

async function refreshCurrentList() {
  if (uploadType.value === 'skill') {
    skillList.page.value = 1
    await skillList.loadList()
  } else {
    agentList.page.value = 1
    await agentList.loadList()
  }
  scrollListToTop()
}

function scrollListToTop() {
  nextTick(() => {
    const el = scrollRoot.value
    if (el) el.scrollTop = 0
  })
}

function onListScroll() {
  const el = scrollRoot.value
  if (!el) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollHeight - scrollTop - clientHeight > SCROLL_LOAD_THRESHOLD_PX) {
    return
  }
  if (uploadType.value === 'avatar') {
    if (
      !agentList.hasMore.value
      || agentList.listLoading.value
      || agentList.loadMoreLoading.value
    ) {
      return
    }
    void agentList.loadMore()
  } else {
    if (
      !skillList.hasMore.value
      || skillList.listLoading.value
      || skillList.loadMoreLoading.value
    ) {
      return
    }
    void skillList.loadMore()
  }
}

// 监听路由参数变化，切换列表
watch(() => route.query.type, () => {
  void refreshCurrentList()
})

onActivated(() => {
  const history = router.options.history
  const from = String(history.state.back || '')
  const fromDetail = from.includes('Detail') || from.includes('detail')

  if (!fromDetail) {
    void refreshCurrentList()
  }
})

function handleUpload(type: 'skill' | 'avatar') {
  if (type === 'avatar') {
    router.push({ name: 'AvatarCreate' })
  } else {
    router.push({ name: 'SkillCreate' })
  }
}

function handleUploadClick() {
  handleUpload(uploadType.value)
}

function handleSearch() {
  if (uploadType.value === 'skill') {
    skillList.page.value = 1
    void skillList.loadList().then(() => scrollListToTop())
  } else {
    agentList.page.value = 1
    void agentList.loadList().then(() => scrollListToTop())
  }
}

function showUploadGuide() {
  window.open('https://yf2ljykclb.xfchat.iflytek.com/docx/doxrzTrNXecm6I9BWB6Ir0Qajxe', '_blank', 'noopener,noreferrer')
}

function resolveAgentAvatarUrl(rawAvatar: string) {
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
  return (agentList.list.value || []).map((item: AgentItem) => {
    const tags = Array.isArray(item.tags) ? item.tags : []
    const capabilities = Array.isArray(item.capabilities) ? item.capabilities : []
    const secondaryTags = capabilities.length ? capabilities : tags.slice(1)
    const extraTagLabels = secondaryTags
      .map((t: unknown) => {
        if (t == null) return ''
        if (typeof t === 'string') return t
        if (typeof t === 'object') {
          const o = t as Record<string, unknown>
          return String(o.name ?? o.title ?? o.label ?? o.displayName ?? o.id ?? '').trim()
        }
        return String(t)
      })
      .filter(Boolean)
    const verRaw = String(item.latestVersion?.version ?? item.version ?? '').trim()
    const version = verRaw ? (verRaw.startsWith('v') ? verRaw : `v${verRaw}`) : ''
    const rawAvatar = String(item.avatar ?? item.author?.avatar ?? '').trim()
    return {
      id: String(item.id ?? ''),
      name: String(item.displayName ?? ''),
      version,
      qualityLevel: String(tags[0] ?? '').trim(),
      extraTagCount: extraTagLabels.length,
      extraTagLabels,
      sourceOrg: String(item.author?.displayName ?? ''),
      description: String(item.summary ?? ''),
      avatar: resolveAgentAvatarUrl(rawAvatar),
      installed: Number(item.installCount ?? item.statsDownloads ?? 0),
      favorites: Number(item.statsStars ?? 0),
      isCollected: Boolean(item.isFollowed),
      isHired: Boolean(item.isInstalled),
      statusTag: getListCardStatusMeta(item as any),
      raw: item,
    }
  })
})

function handleAgentCardOpen(id: string | number) {
  const row = (agentList.list.value || []).find((item) => String(item.id) === String(id))
  if (!row) return
  const slug = String((row as any).slug ?? '').trim()
  const legacyId = row.id != null ? String(row.id).trim() : ''
  const routeId = slug || legacyId
  if (!routeId) return

  const resolved = resolveAgentAvatarUrl(String((row as any).avatar ?? '')).trim()
  const cover = resolved && !/default-avatar\.png/i.test(resolved) ? resolved : 'https://picsum.photos/seed/101/200/200'

  router.push({
    name: 'MyAvatarDetail',
    params: { id: routeId },
    query: { from: 'my-uploads' },
    state: { skillHeroCover: cover, skillHeroForSlug: routeId },
  })
}
</script>

<style lang="scss" scoped>
.my-uploads-view {
  flex: 1;
  min-width: 0;
  padding: 20px;
  border-radius: 12px;
  opacity: 1;
  background: linear-gradient(0deg, #FFFFFF, #FFFFFF), linear-gradient(180deg, #F9FAFA 0%, #FFFFFF 25%);
  box-sizing: border-box;
  border: 1.5px solid #FFFFFF;
}

.market-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 与 Skill 市场一致：按内容区宽度断点（非仅视口），对齐 960 / 1280 规格减左侧导航 312px */
.my-uploads-view__inner {
  container-type: inline-size;
  container-name: my-uploads;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: #2f3547;
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 24px;
  height: 32px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.search-input {
  flex-shrink: 0;
}

.content-section {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading-wrapper {
  min-height: 300px;
}

/* 卡片栅格：单卡最小约 296px；窄屏 1 列 → 中 2 列 → 宽 3 列 */
.card-list {
  display: grid;
  align-items: stretch;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 32px;
  column-gap: 16px;
}

.card-list>* {
  min-width: 0;
}

@container my-uploads (min-width: calc(960px - 312px)) {
  .card-list {
    grid-template-columns: repeat(2, minmax(296px, 1fr));
  }
}

@container my-uploads (min-width: calc(1280px - 312px)) {
  .card-list {
    grid-template-columns: repeat(3, minmax(296px, 1fr));
  }
}

/* 与 Skill 市场 list-footer 一致 */
.list-footer {
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
</style>
