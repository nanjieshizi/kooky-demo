<template>
  <section class="my-hired-view">
    <!-- 标题 -->
    <h1 class="page-title">我的聘用</h1>

    <!-- 导航卡片 -->
    <div class="nav-card" @click="goToCloneDetail">
      <div class="nav-content">
        <div class="nav-left">
          <img src="./assets/hired-icon.svg" class="nav-icon" alt="聘用图标" />
        </div>
        <div class="nav-text">
          <h2 class="nav-title">我的分身</h2>
          <p class="nav-desc">Kooky专属数字人</p>
        </div>
      </div>
      <p class="nav-detail">您的专属AI核心，负责统筹协调所有数字人的工作，理解您的目标并智能分配任务。</p>
      <button class="chat-btn" @click.stop="handleChat">
        <span>对话</span>
      </button>
    </div>

    <!-- 缺省页 -->
    <div v-if="store.isEmpty && !store.loading" class="empty-state">
      <div class="empty-icon-wrapper">
        <img src="./assets/empty-icon.svg" class="empty-icon" alt="空状态" />
      </div>
      <p class="empty-text">
        暂无聘用记录，
        <span class="link-text" @click="goToMarket">前往市场聘用</span>
      </p>
    </div>

    <!-- 列表页 -->
    <div v-else class="list-container">
      <!-- 标签筛选 -->
      <div v-if="hasTags" class="filter-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </div>
      </div>

      <!-- 分割线 -->
      <div v-if="hasTags" class="divider"></div>

      <!-- 卡片列表 -->
      <Loading :visible="store.loading && store.list.length === 0" text="加载中..." :fullscreen="false" />
      <div v-if="!store.loading || store.list.length > 0" class="card-grid">
        <div
          v-for="item in filteredList"
          :key="item.id"
          class="hired-card"
          @click="goToDetail(item.id)"
        >
          <!-- 头像 -->
          <div class="card-avatar">
            <img :src="item.avatar || defaultAvatarIcon" alt="" @error="e => e.target.src = defaultAvatarIcon" />
          </div>

          <!-- 内容区 -->
          <div class="card-content">
            <!-- 标题行 -->
            <div class="card-header">
              <div class="card-title-wrap">
                <div class="card-title-row">
                  <p class="card-title">{{ item.name }}</p>
                  <span v-if="item.version" class="card-version">v{{ item.version }}</span>
                </div>
                <span class="status-badge" :style="getStatusStyle(item.status)">
                  <span v-if="item.status === HIRED_STATUS.INSTALLING || item.status === HIRED_STATUS.UNINSTALLING" class="status-spinner"></span>
                  {{ getStatusLabel(item.status) }}
                </span>
              </div>

              <!-- 标签 -->
              <div class="card-tags">
                <span v-if="item.tags.length" class="tag">
                  {{ item.tags[0] }}
                </span>
                <el-tooltip v-if="item.tags.length > 1" effect="dark" placement="top">
                  <template #content>
                    <div class="tag-tooltip-content">
                      <div v-for="(tag, idx) in item.tags.slice(1)" :key="idx">{{ tag }}</div>
                    </div>
                  </template>
                  <span class="tag-more">+{{ item.tags.length - 1 }}</span>
                </el-tooltip>
                <span v-if="item.fromAgentName" class="tag-source">来自 <el-tooltip :content="item.fromAgentName" effect="dark" placement="top"><span class="tag-source-name" @click.stop="goToAgentDetail(item)">{{ item.fromAgentName }}</span></el-tooltip></span>
              </div>
            </div>

            <!-- 描述 -->
            <p class="card-desc">{{ item.description || '-' }}</p>

            <div class="card-actions">
              <button class="action-btn" @click.stop="handleDownload(item.id)">
                <img
                  src="./assets/down.svg"
                  class="action-icon"
                  alt="下载"
                />
                <span>{{ formatCount(item.downloadCount) }}</span>
              </button>
              <button class="action-btn" @click.stop="handleCollect(item.id)">
                <img
                  src="./assets/collect.svg"
                  class="action-icon"
                  :class="{ collected: item.isCollected }"
                  alt="收藏"
                />
                <span>{{ formatCount(item.collectCount) }}</span>
              </button>
              <button class="action-chat-btn" @click.stop="handleCardChat(item.id)">对话</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.list.length > 0" class="list-footer-cta" @click="goToMarket">
        <span class="cta-text">让数字人帮你分担工作，提升效率，</span>
        <span class="cta-link">前往市场聘用 ></span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineOptions({ name: 'MyHiredView' })
import { ref, computed, onActivated } from 'vue'
import Loading from '@/shared/components/Loading/index.vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElTooltip } from 'element-plus'
import { useMyHiredStore, HIRED_STATUS, HIRED_STATUS_LABEL, HIRED_STATUS_COLOR, HIRED_STATUS_BG, MOCK_CLONE_DETAIL } from './store'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import defaultAvatarIcon from './assets/ava/m01@2x.png'

const router = useRouter()
const route = useRoute()
const store = useMyHiredStore()
const uiStore = useUIStore()
const soloTeamStore = useSoloTeamStore()

const activeTab = ref('all')

const hasTags = computed(() => store.list.some(item => item.tags?.length > 0))

const tabs = computed(() => {
  const tagSet = new Set(store.list.flatMap(item => item.tags || []).filter(Boolean))
  const dynamicTabs = Array.from(tagSet).map(tag => ({
    label: tag,
    value: tag,
  }))
  return [{ label: '全部', value: 'all' }, ...dynamicTabs]
})


const filteredList = computed(() => {
  const list = store.list.filter(item => String(item.id) !== 'main')
  if (activeTab.value === 'all') return list
  return list.filter(item => item.tags?.includes(activeTab.value))
})

function getStatusLabel(status) {
  return HIRED_STATUS_LABEL[status] || status
}

function getStatusStyle(status) {
  const color = HIRED_STATUS_COLOR[status] || '#999'
  const bg = HIRED_STATUS_BG[status]
  return bg
    ? { color, background: bg, borderRadius: '4px', padding: '2px 6px' }
    : { color }
}

async function handleChat() {
  uiStore.setActiveNavigation('deerflow', null)
}

function goToCloneDetail() {
  router.push({ name: 'HiredDetail', params: { id: MOCK_CLONE_DETAIL.id } })
}

function goToMarket() {
  router.push({ name: 'MarketAvatar' })
}

function goToDetail(id) {
  router.push({ name: 'HiredDetail', params: { id } })
}

function handleCollect(id) {
  store.toggleCollect(id)
}

function handleDownload(id) {
  console.log('下载', id)
}

function goToAgentDetail(item) {
  if (!item.fromAgentSlug || item.isBuiltin) return
  if (item.type === 'selfBuilt') {
    router.push({ name: 'MyAvatarDetail', params: { id: item.fromAgentSlug }, query: { from: 'my-uploads' } })
  } else {
    router.push({ name: 'AvatarDetail', params: { id: item.fromAgentSlug } })
  }
}


async function handleCardChat(id) {
  try {
    await soloTeamStore.loadEmployeeItems({ force: true })
    await soloTeamStore.fetchEmployeeThreads(id)
    let thread = soloTeamStore.getEmployeeThreads(id)[0]
    if (!thread) thread = await soloTeamStore.createEmployeeThread(id)
    if (!thread?.id) return
    await soloTeamStore.selectEmployeeThread(id, thread.id)
    uiStore.setActiveNavigation('solo-team', `employee:${id}:${thread.id}`)
    uiStore.expandSidebar()
  } catch (e) {
    console.error('跳转对话失败:', e)
    ElMessage.error('打开对话失败')
  }
}

function formatCount(count) {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return String(count)
}

onActivated(() => {
  // 检查是否从详情页返回
  const history = router.options.history
  const from = history.state.back || ''

  // 如果是从详情页返回，不重新加载（保留搜索条件）
  // 如果是从其他列表页切换过来，重新加载
  const fromDetail = from.includes('Detail') || from.includes('detail')

  if (!fromDetail) {
    store.loadList(true)
  }
})
</script>

<style lang="scss" scoped>
.my-hired-view {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 20px 12px 0 20px;
  background: #fff;
}

.page-title {
  margin: 0 0 16px;
  font-family: PingFang SC;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: #2f3547;
}

.nav-card {
  position: relative;
  height: 112px;
  width: 100%;
  padding: 16px 20px 18px 20px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('./assets/bg.png') no-repeat center/cover;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.nav-content {
  display: flex;
  gap: 16px;
}

.nav-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.nav-text {
  display: flex;
  flex-direction: column;
}

.nav-title {
  margin: 0;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.nav-desc {
  margin: 0;
  font-family: PingFang SC;
  font-size: 12px;
  font-weight: normal;
  line-height: 20px;
  text-align: right;
  letter-spacing: normal;
  /* 文本色&图标色/三级文本色 */
  color: #91949E;
}

.nav-detail {
  margin-top: 8px;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  text-align: justify; /* 浏览器可能不支持 */
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
}

.chat-btn {
  position: absolute;
  right: 20px;
  bottom: 16px;
  background: #141517;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  width: 60px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  &:hover {
    background: #2E323C;
  }

  &:active {
    transform: scale(0.98);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 109px;
}

.empty-icon-wrapper {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 83px;
  height: auto;
}

.empty-text {
  margin-top: 24px;
  font-size: 12px;
  color: #727272;
}

.link-text {
  color: #436ff6;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.list-container {
  flex: 1;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 24px 0 16px 0;
}

.tab-item {
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  text-align: center;
  letter-spacing: normal;
  /* 文本色&图标色/一级文本色 */
  color: #2F3547;
  cursor: pointer;
  transition: color 0.2s;
  padding: 2px 12px;
  border-radius: 6px;
  /* 背景色/--color-bg-bottom */
  /* 样式描述：布局背景色 */
  background: #F7F8FA;
  &:hover {
    color: #FF684E;
    background: #FFEEEB;
  }

  &.active {
    /* 主色/橘-07 */
    color: #FF684E;
    background: #FFEEEB;
  }
}

.divider {
  border-bottom: 1px solid #eceef3;
  margin-bottom: 40px;
}

.loading-state {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

.card-grid {
  display: grid;
  gap: 32px 16px;
  grid-template-columns: repeat(auto-fill, minmax(296px, 1fr));
  margin-top: 24px;

  @media (min-width: 960px) and (max-width: 1279px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1280px) and (max-width: 1600px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.divider + .loading-state + .card-grid,
.divider + .card-grid {
  margin-top: 0;
}

.hired-card {
  position: relative;
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 296px;
  display: flex;
  gap: 12px;
  border: 1px solid #ECEEF3;

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 16px;
    padding: 1px;
    background: linear-gradient(270deg, #81BEFC 23%, #C69FED 75%, #FF8670 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  &:hover {
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.06);

    &::before {
      opacity: 1;
    }

    .action-chat-btn {
      opacity: 1;
    }
  }
}

.card-avatar {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: visible;
  position: absolute;
  top: -16px;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  font-weight: 600;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 92px;
}

.card-title-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #2f3547;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 24px;
    height: 24px;
    margin: 0;
  }
}

.card-version {
  font-size: 12px;
  color: #91949e;
  font-weight: normal;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  align-items: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;

  &:hover {
    color: #5f6573;
  }
}

.action-chat-btn {
  margin-left: auto;
  width: 48px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: #141517;
  color: #fff;
  font-size: 12px;
  line-height: 24px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    background: #2e323c;
  }
}

.action-icon {
  width: 14px;
  height: 14px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &.collected {
    opacity: 1;
    filter: brightness(1.2);
  }
}

.card-tags {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 24px;
}

.tag {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.tag-more {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: #436ff6;
  }
}

.tag-source {
  font-size: 12px;
  color: #91949e;
  white-space: nowrap;
  display: flex;
  align-items: center;
  min-width: 0;

  .tag-source-name {
    color: #436FF6;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
    display: inline-block;
  }
}

.tag-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-desc {
  margin: 0;
  font-size: 13px;
  color: #91949e;
  font-weight: normal;
  font-family: PingFang SC;
  line-height: 1.5;
  height: calc(13px * 1.5 * 2);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
 height: 20px;
 width: 48px;
  line-height: 20px;
  text-align: center;
}

.status-badge {
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 16px;
}

.status-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid #7ad8ce;
  border-top-color: #21ab9d;
  border-radius: 50%;
  animation: status-spin 0.8s linear infinite;
}

@keyframes status-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.list-footer-cta {
  padding: 32px 0 40px;
  text-align: center;
  font-size: 12px;
  color: #91949e;
  cursor: pointer;

  .cta-link {
    color: #436ff6;
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
