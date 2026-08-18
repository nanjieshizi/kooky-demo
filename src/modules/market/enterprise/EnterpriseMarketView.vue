<template>
  <section class="ent-market">
    <!-- Banner -->
    <div class="ent-banner">
      <div class="ent-banner__inner">
        <h1 class="ent-banner__title">企业数字人 · 带数据库的智能体</h1>
        <p class="ent-banner__sub">维护一份共享数据，订阅即用 · 越养越聪明的企业级 AI 服务</p>
      </div>
    </div>

    <div class="ent-market__inner">
      <!-- 顶部 tab + 工具栏 -->
      <header class="ent-market__header">
        <div class="ent-market__tabs">
          <div class="ent-market__tab" :class="{ 'is-active': activeTab === 'market' }" @click="activeTab = 'market'">
            企业数字人市场
          </div>
          <div class="ent-market__tab" :class="{ 'is-active': activeTab === 'uploaded' }" @click="activeTab = 'uploaded'">
            我的上传
          </div>
        </div>
        <div class="ent-market__toolbar-right">
          <input v-model="search" class="ent-market__search" placeholder="搜索企业数字人" />
          <button class="ent-btn" @click="openGuide">创建指引</button>
          <button class="ent-btn ent-btn--dark" @click="goCreate">创建企业数字人</button>
        </div>
      </header>

      <!-- 市场 Tab -->
      <div v-show="activeTab === 'market'">
        <div class="ent-filters">
          <span
            v-for="c in categories"
            :key="c"
            class="ent-cat"
            :class="{ 'is-active': selectedCategory === c }"
            @click="selectedCategory = c"
          >{{ c }}</span>
        </div>

        <div v-if="marketList.length === 0" class="ent-empty">暂无企业数字人，看看其他的吧~</div>
        <div v-else class="ent-grid">
          <article v-for="a in marketList" :key="a.id" class="ent-card" @click="goDetail(a.id)">
            <div class="ent-card__top">
              <div class="ent-card__avatar">{{ a.icon }}</div>
              <div class="ent-card__head">
                <div class="ent-card__name-row">
                  <span class="ent-card__name">{{ a.name }}</span>
                  <span class="ent-card__db" title="带数据库">🗄️ 带库</span>
                </div>
                <div class="ent-card__tags">
                  <span v-for="t in a.tags.slice(0, 3)" :key="t" class="ent-tag">{{ t }}</span>
                </div>
              </div>
            </div>
            <p class="ent-card__desc">{{ a.description }}</p>
            <div class="ent-card__foot">
              <span class="ent-card__meta">👥 {{ a.subscribers }} 订阅 · 由 {{ a.author.displayName }} 维护</span>
              <button
                class="ent-sub-btn"
                :class="{ 'is-subscribed': a.isSubscribed }"
                @click.stop="toggleSubscribe(a)"
              >{{ a.isSubscribed ? '已订阅' : '订阅' }}</button>
            </div>
          </article>
        </div>
      </div>

      <!-- 我的上传 Tab -->
      <div v-show="activeTab === 'uploaded'">
        <div class="ent-filters">
          <button
            v-for="s in statusFilters"
            :key="s.value"
            class="ent-cat"
            :class="{ 'is-active': statusFilter === s.value }"
            @click="statusFilter = s.value"
          >{{ s.label }}</button>
        </div>

        <div v-if="myList.length === 0" class="ent-empty">暂无上传的企业数字人</div>
        <div v-else class="ent-grid">
          <article v-for="a in myList" :key="a.id" class="ent-card" @click="goMineDetail(a.id)">
            <div class="ent-card__top">
              <div class="ent-card__avatar">{{ a.icon }}</div>
              <div class="ent-card__head">
                <div class="ent-card__name-row">
                  <span class="ent-card__name">{{ a.name }}</span>
                  <span class="ent-status" :class="`ent-status--${a.status}`">{{ statusLabel(a.status) }}</span>
                </div>
                <div class="ent-card__tags">
                  <span v-for="t in a.tags.slice(0, 3)" :key="t" class="ent-tag">{{ t }}</span>
                </div>
              </div>
            </div>
            <p class="ent-card__desc">{{ a.description }}</p>
            <div class="ent-card__foot">
              <span class="ent-card__meta">👥 {{ a.subscribers }} 订阅 · 🗄️ {{ a.dbTables.length }} 张表</span>
              <span class="ent-card__open">查看 ›</span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'EnterpriseMarketView' })
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ENTERPRISE_CATEGORIES,
  listEnterpriseAgents,
  listMyEnterpriseAgents,
} from '@/dev-mocks/data/enterprise-agents'

const router = useRouter()
const activeTab = ref('market')
const search = ref('')
const selectedCategory = ref('全部')
const statusFilter = ref('all')

const categories = ENTERPRISE_CATEGORIES

const statusFilters = [
  { value: 'all', label: '全部' },
  { value: 'online', label: '已发布' },
  { value: 'testing', label: '审核中' },
  { value: 'draft', label: '未发布' },
  { value: 'reject', label: '已驳回' },
  { value: 'offline', label: '已下架' },
]

const statusLabelMap = {
  online: '已发布',
  testing: '审核中',
  draft: '未发布',
  reject: '已驳回',
  offline: '已下架',
}
function statusLabel(s) {
  return statusLabelMap[s] || s
}

const marketList = computed(() =>
  listEnterpriseAgents({ search: search.value, category: selectedCategory.value }),
)
const myList = computed(() => listMyEnterpriseAgents({ status: statusFilter.value }))

function toggleSubscribe(a) {
  a.isSubscribed = !a.isSubscribed
  if (a.isSubscribed) {
    a.subscribers += 1
    ElMessage.success(`已订阅「${a.name}」，可在会话中 @召唤`)
  } else {
    a.subscribers = Math.max(0, a.subscribers - 1)
    ElMessage.info(`已取消订阅「${a.name}」`)
  }
}

function goDetail(id) {
  router.push({ name: 'EnterpriseDetail', params: { id } })
}
function goMineDetail(id) {
  router.push({ name: 'EnterpriseMineDetail', params: { id } })
}
function goCreate() {
  ElMessage.info('企业数字人在「工厂」中创建，完成后从这里发布')
}
function openGuide() {
  ElMessage.info('创建指引（占位）')
}
</script>

<style lang="scss" scoped>
.ent-market {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 20px 40px;
  border-radius: 12px;
  background: #fff;
  box-sizing: border-box;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.ent-banner {
  height: 160px;
  margin: -2px -20px 0;
  background: linear-gradient(120deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  display: flex;
  align-items: center;
  padding: 0 40px;
}
.ent-banner__title { margin: 0; color: #fff; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
.ent-banner__sub { margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; }

.ent-market__inner { display: flex; flex-direction: column; container-type: inline-size; container-name: ent-market; }

.ent-market__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0 16px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
}

.ent-market__tabs { display: flex; gap: 24px; }
.ent-market__tab {
  font-size: 14px;
  color: #2f3547;
  cursor: pointer;
  position: relative;
  &.is-active {
    font-size: 16px;
    font-weight: 600;
    &::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -8px;
      height: 3px;
      border-radius: 2px;
      background: #ff684e;
    }
  }
}

.ent-market__toolbar-right { display: flex; align-items: center; gap: 10px; }
.ent-market__search {
  height: 34px;
  width: 220px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  &:focus { border-color: #a5b4fc; }
}

.ent-btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  font-size: 13px;
  color: #2f3547;
  cursor: pointer;
  &:hover { border-color: #ff684e; color: #ff684e; }
  &--dark { background: #1c1a21; color: #fff; border-color: #1c1a21; &:hover { background: #2e323c; color: #fff; } }
}

.ent-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0 20px;
  border-bottom: 1px solid #eceef3;
  margin-bottom: 20px;
}
.ent-cat {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 1px 12px;
  font-size: 14px;
  color: #2f3547;
  background: transparent;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  &.is-active { color: #ff684e; background: #ffeeeb; font-weight: 600; }
}

.ent-grid {
  display: grid;
  row-gap: 20px;
  column-gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}
@container ent-market (min-width: 648px) { .ent-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container ent-market (min-width: 968px) { .ent-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

.ent-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #eceef3;
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: rgba(99,102,241,0.3); box-shadow: 0 4px 16px rgba(0,0,0,0.06); transform: translateY(-2px); }
}
.ent-card__top { display: flex; gap: 12px; align-items: flex-start; }
.ent-card__avatar {
  width: 48px; height: 48px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff, #f5f3ff);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
.ent-card__head { flex: 1; min-width: 0; }
.ent-card__name-row { display: flex; align-items: center; gap: 8px; }
.ent-card__name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.ent-card__db { font-size: 11px; color: #6366f1; background: rgba(99,102,241,0.1); padding: 1px 6px; border-radius: 5px; flex-shrink: 0; }
.ent-card__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ent-tag { font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 5px; }
.ent-card__desc {
  margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ent-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ent-card__meta { font-size: 11px; color: #9ca3af; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ent-card__open { font-size: 13px; color: #6366f1; flex-shrink: 0; }

.ent-sub-btn {
  flex-shrink: 0;
  height: 30px;
  padding: 0 18px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: #4f46e5; }
  &.is-subscribed { background: #f2f3f5; color: #6b7280; }
}

.ent-status { font-size: 11px; padding: 1px 8px; border-radius: 5px; flex-shrink: 0; }
.ent-status--online { color: #16a34a; background: #dcfce7; }
.ent-status--testing { color: #b45309; background: #fef3c7; }
.ent-status--draft { color: #6b7280; background: #f3f4f6; }
.ent-status--reject { color: #dc2626; background: #fee2e2; }
.ent-status--offline { color: #6b7280; background: #f3f4f6; }

.ent-empty { text-align: center; color: #9ca3af; padding: 80px 0; font-size: 14px; }
</style>
