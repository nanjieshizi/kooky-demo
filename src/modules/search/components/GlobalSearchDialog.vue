<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSearchStore, PAGE_SIZE } from '../store'
import { useGlobalSearch } from '../useGlobalSearch'
import { searchAllApi, getSearchHistoryApi, saveSearchHistoryApi } from '../service'
import { useUIStore } from '@/modules/space/uiStore'
import { useGroupStore } from '@/modules/group/store'
import { useStartPrivateChat } from '@/modules/private/composables/useStartPrivateChat'
import { useDigitalHumanStore } from '@/modules/private/store/digitalHuman'
import searchAllImg from '@/assets/navigation/search-all.png'
import searchOtherImg from '@/assets/navigation/search-other.png'
import searchEmptyImg from '@/assets/navigation/search-empty.png'

const searchStore = useSearchStore()
const uiStore = useUIStore()
const groupStore = useGroupStore()
const digitalHumanStore = useDigitalHumanStore()
const { startChat } = useStartPrivateChat()
const { visible, keyword, activeTab, loading, hasSearched, results, pagination } = storeToRefs(searchStore)

const debounceTimer = ref(null)
const resultsListRef = ref(null)
const historyList = ref([])

const {
  searchCollaborations,
  searchContacts
} = useGlobalSearch()

const MAX_PER_CATEGORY = 3

const displayResults = computed(() => {
  if (activeTab.value === 'all') {
    return {
      collaborations: results.value.collaborations.slice(0, MAX_PER_CATEGORY),
      collaborationsMore: Math.max(0, results.value.collaborations.length - MAX_PER_CATEGORY),
      contacts: results.value.contacts.slice(0, MAX_PER_CATEGORY),
      contactsMore: Math.max(0, results.value.contacts.length - MAX_PER_CATEGORY)
    }
  }
  return {
    collaborations: activeTab.value === 'collaboration' ? results.value.collaborations : [],
    collaborationsMore: 0,
    contacts: activeTab.value === 'contact' ? results.value.contacts : [],
    contactsMore: 0
  }
})

const hasResults = computed(() => {
  return results.value.collaborations.length > 0 ||
    results.value.contacts.length > 0
})

const hasCurrentTabResults = computed(() => {
  if (activeTab.value === 'all') return hasResults.value
  if (activeTab.value === 'collaboration') return results.value.collaborations.length > 0
  if (activeTab.value === 'contact') return results.value.contacts.length > 0
  return false
})

const currentPagination = computed(() => {
  if (activeTab.value === 'collaboration') return pagination.value.collaboration
  if (activeTab.value === 'contact') return pagination.value.contact
  return null
})

watch(keyword, (val) => {
  clearTimeout(debounceTimer.value)
  searchStore.resetPagination()
  if (!val.trim()) {
    searchStore.setResults({ collaborations: [], contacts: [] })
    return
  }
  debounceTimer.value = setTimeout(() => {
    doSearch(val.trim())
  }, 300)
})

// 切换 tab 时：若该 tab 还没通过分页接口拉过数据（page === 0），按当前关键词拉首页
watch(activeTab, (tab) => {
  const kw = keyword.value.trim()
  if (!kw) return
  if (tab === 'collaboration' || tab === 'contact') {
    const key = tab === 'collaboration' ? 'collaboration' : 'contact'
    if (pagination.value[key].page === 0) {
      doSearch(kw)
    }
  }
})

async function doSearch(kw) {
  searchStore.setLoading(true)
  try {
    if (activeTab.value === 'all') {
      const { collaborations, contacts } = await searchAllApi(kw)
      searchStore.setResults({ collaborations, contacts })
    } else if (activeTab.value === 'collaboration') {
      const { items, hasMore } = await searchCollaborations(kw, { page: 1, size: PAGE_SIZE })
      searchStore.setResults({ collaborations: items })
      searchStore.setPagination('collaboration', { page: 1, hasMore })
    } else if (activeTab.value === 'contact') {
      const { items, hasMore } = await searchContacts(kw, { page: 1, size: PAGE_SIZE })
      searchStore.setResults({ contacts: items })
      searchStore.setPagination('contact', { page: 1, hasMore })
    }
    searchStore.setHasSearched(true)
  } finally {
    searchStore.setLoading(false)
  }
}

async function loadMore() {
  const kw = keyword.value.trim()
  if (!kw) return
  const tab = activeTab.value
  if (tab !== 'collaboration' && tab !== 'contact') return
  const key = tab === 'collaboration' ? 'collaboration' : 'contact'
  const listKey = tab === 'collaboration' ? 'collaborations' : 'contacts'
  const pageState = pagination.value[key]
  if (!pageState.hasMore || pageState.loadingMore) return
  searchStore.setPagination(key, { loadingMore: true })
  try {
    const nextPage = pageState.page + 1
    const fetcher = tab === 'collaboration' ? searchCollaborations : searchContacts
    const { items, hasMore } = await fetcher(kw, { page: nextPage, size: PAGE_SIZE })
    searchStore.appendResults(listKey, items)
    searchStore.setPagination(key, { page: nextPage, hasMore, loadingMore: false })
  } catch (err) {
    console.error('加载更多失败:', err)
    searchStore.setPagination(key, { loadingMore: false })
  }
}

function handleResultsScroll(e) {
  const el = e.target
  if (!el) return
  const threshold = 80
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
    loadMore()
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    searchStore.hide()
  }
}

// 加载搜索历史
async function loadHistory() {
  try {
    const res = await getSearchHistoryApi()
    historyList.value = res.records || []
  } catch (error) {
    console.error('加载搜索历史失败:', error)
    historyList.value = []
  }
}

// 写入搜索历史（fire-and-forget，不阻塞跳转）
function saveHistory() {
  const kw = keyword.value.trim()
  if (!kw) return
  saveSearchHistoryApi(kw).catch(() => {})
}

// 点击历史记录，填充关键词并搜索
function clickHistory(query) {
  searchStore.setKeyword(query)
}

// 截断历史记录文本（超过 20 字符显示省略号）
function truncateHistory(text) {
  if (!text) return ''
  return text.length > 20 ? text.substring(0, 20) + '...' : text
}

// 监听对话框显示，加载历史
watch(visible, (val) => {
  if (val) {
    loadHistory()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

async function jumpToCollaboration(item) {
  saveHistory()
  const roomId = item.roomId
  uiStore.backgroundAllCli()
  uiStore.expandSidebar()
  uiStore.setActiveNavigation('collaboration', roomId)
  groupStore.setCurrentSpaceId(roomId)
  await groupStore.selectConversation(roomId)
  searchStore.hide()
}

async function jumpToContact(item) {
  // 判断是否为数字人：participantType === 'agent' 或 tag === 'bot'
  const isAgent = item.participantType === 'agent' || String(item.tag || '').toLowerCase() === 'bot'

  if (isAgent && item.agentId) {
    // 数字人：调用 openAgent 创建会话并跳转到协作区
    try {
      await digitalHumanStore.openAgent(item.agentId, '新对话')
      saveHistory()
      uiStore.backgroundAllCli()
      uiStore.expandSidebar()
      uiStore.setActiveNavigation('collaboration', `digital-human-${item.agentId}`)
      searchStore.hide()
    } catch (error) {
      console.error('[GlobalSearch] 打开数字人对话失败:', error)
      // 接口报错时不关闭搜索框，让用户可以重试
    }
  } else {
    // 真人：走私聊流程
    await startChat({ userName: item.id, name: item.name })
    saveHistory()
    searchStore.hide()
  }
}

function showMoreResults(tabKey) {
  searchStore.setActiveTab(tabKey)
}

function highlightText(text) {
  if (!keyword.value || !text) return text
  const escaped = keyword.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return String(text).replace(regex, '<em>$1</em>')
}

const contactCard = ref(null)

function showContactCard(event, item) {
  event.stopPropagation()
  const rect = event.currentTarget.getBoundingClientRect()
  contactCard.value = {
    item,
    x: rect.right + 7,
    y: rect.top
  }
}

function hideContactCard() {
  contactCard.value = null
}

async function startChatFromCard(item) {
  hideContactCard()
  // 复用 jumpToContact 的分流逻辑（数字人 / 真人）
  await jumpToContact(item)
}

const emptyStateConfig = computed(() => {
  const configs = {
    all: {
      icon: searchAllImg,
      title: '暂无搜索结果，换下搜索词试试',
      subtitle: '没有想找的结果？发送反馈'
    },
    collaboration: {
      icon: searchOtherImg,
      title: '无群组',
      subtitle: '没有想找的结果？发送反馈'
    },
    contact: {
      icon: searchOtherImg,
      title: '无联系人',
      subtitle: '没有想找的结果？发送反馈'
    }
  }
  return configs[activeTab.value] || configs.all
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="search-overlay" @click="searchStore.hide()">
      <div class="search-dialog" @click.stop>
        <!-- 关闭按钮 -->
        <button class="search-close-btn" @click="searchStore.hide()">
          <svg class="iconfont" aria-hidden="true" width="16" height="16">
            <use xlink:href="#icon-guanbi"></use>
          </svg>
        </button>
        <!-- 内容区 -->
        <div class="search-content">
          <!-- 无关键词时显示搜索历史 -->
          <div v-if="!keyword.trim()" class="search-history">
            <div class="search-history-title">搜索历史</div>
            <div v-if="historyList.length" class="search-history-tags">
              <button
                v-for="item in historyList"
                :key="item.id"
                class="search-history-tag"
                :title="item.search_query.length > 20 ? item.search_query : undefined"
                @click="clickHistory(item.search_query)"
              >
                {{ truncateHistory(item.search_query) }}
              </button>
            </div>
            <div v-else class="search-history-empty">
              <img :src="searchEmptyImg" class="search-empty-icon" alt="" />
              <div class="search-empty-text">输入你的想法，开启搜索</div>
            </div>
          </div>

          <!-- 有关键词时显示搜索结果 -->
          <div v-else class="search-results">
            <!-- Tab 切换 -->
            <div class="search-tabs">
              <button class="search-tab" :class="{ active: activeTab === 'all' }" @click="searchStore.setActiveTab('all')">
                综合
              </button>
              <button class="search-tab" :class="{ active: activeTab === 'contact' }" @click="searchStore.setActiveTab('contact')">
                联系人
              </button>
              <button class="search-tab" :class="{ active: activeTab === 'collaboration' }" @click="searchStore.setActiveTab('collaboration')">
                协作
              </button>
            </div>

            <!-- 结果列表 -->
            <div ref="resultsListRef" class="results-list" @scroll="handleResultsScroll">
              <div v-if="loading" class="loading-state">搜索中...</div>
              <div v-else-if="!hasSearched" class="empty-state-container">
                <!-- 首次搜索前不显示任何内容，或显示提示 -->
              </div>
              <div v-else-if="!hasCurrentTabResults" class="empty-state-container">
                <img :src="emptyStateConfig.icon" class="empty-icon" alt="empty" />
                <div class="empty-title">{{ emptyStateConfig.title }}</div>
                <div class="empty-subtitle">{{ emptyStateConfig.subtitle }}</div>
              </div>
              <div v-else>
                <!-- 协作 -->
                <div v-if="displayResults.collaborations.length" class="result-category">
                  <div v-if="activeTab === 'all'" class="category-title category-title-link" @click="searchStore.setActiveTab('collaboration')">
                    <img src="@/assets/navigation/search-conversation.png" width="14" height="14" alt="协作" />
                    协作
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="#595959" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <div v-for="item in displayResults.collaborations" :key="item.roomId" class="result-item" @click="jumpToCollaboration(item)">
                    <div class="result-avatar collab-avatar">
                      <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.name" />
                      <span v-else class="avatar-initial">{{ item.name?.charAt(0) }}</span>
                    </div>
                    <div class="result-info">
                      <div class="result-name"><span v-html="item.highlightName"></span></div>
                      <div class="result-desc">{{ item.memberCount || 0 }}位成员</div>
                    </div>
                  </div>
                  <!-- <div v-if="displayResults.collaborationsMore > 0" class="show-more" @click="showMoreResults('collaboration')">查看更多 {{ displayResults.collaborationsMore }} 条</div> -->
                </div>

                <!-- 联系人 -->
                <div v-if="displayResults.contacts.length" class="result-category">
                  <div v-if="activeTab === 'all'" class="category-title category-title-link" @click="searchStore.setActiveTab('contact')">
                    <img src="@/assets/navigation/search-contact.png" width="14" height="14" alt="联系人" />
                    联系人
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="#595959" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <div v-for="item in displayResults.contacts" :key="item.userId" class="result-item" @click="jumpToContact(item)">
                    <div class="result-avatar" @click.stop="showContactCard($event, item)">
                      <img v-if="item.avatar" :src="item.avatar" :alt="item.name" />
                      <span v-else class="avatar-initial">{{ item.name?.charAt(0) }}</span>
                    </div>
                    <div class="result-info">
                      <div class="result-name">
                        <span v-html="highlightText(item.name)"></span><span class="result-id" v-html="highlightText(item.id)"></span>
                      </div>
                      <div v-if="item.department" class="result-desc" v-html="highlightText(item.department)"></div>
                    </div>
                  </div>
                  <!-- <div v-if="displayResults.contactsMore > 0" class="show-more" @click="showMoreResults('contact')">查看更多 {{ displayResults.contactsMore }} 条</div> -->
                </div>

                <!-- 滚动加载状态：仅在协作 / 联系人 独立 tab 显示 -->
                <div v-if="currentPagination && currentPagination.loadingMore" class="load-more-tip">加载中...</div>
                <div v-else-if="currentPagination && currentPagination.page > 0 && !currentPagination.hasMore && hasCurrentTabResults" class="load-more-tip load-more-end">没有更多了</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 联系人信息卡片 -->
    <div
      v-if="contactCard"
      class="contact-card"
      :style="{ left: contactCard.x + 'px', top: contactCard.y + 'px' }"
      @click.stop
    >
      <!-- 卡片头部：背景图 + 头像 -->
      <div class="contact-card-header">
        <div class="contact-card-avatar-wrap">
          <img v-if="contactCard.item.avatar" :src="contactCard.item.avatar" class="contact-card-avatar" :alt="contactCard.item.name" />
          <span v-else class="contact-card-avatar-initial">{{ contactCard.item.name?.charAt(0) }}</span>
        </div>
      </div>
      <!-- 卡片内容 -->
      <div class="contact-card-body">
        <div class="contact-card-name">{{ contactCard.item.name }} {{ contactCard.item.id }}</div>
        <div v-if="contactCard.item.position" class="contact-card-position">{{ contactCard.item.position }}</div>
        <div v-if="contactCard.item.department" class="contact-card-row">
          <span class="contact-card-label">部门</span>
          <span class="contact-card-value">{{ contactCard.item.department }}</span>
        </div>
        <button class="contact-card-btn" @click="startChatFromCard(contactCard.item)">
          <img src="@/assets/navigation/dialogue.svg" width="16" height="16" alt="对话" />
          对话
        </button>
      </div>
    </div>
    <!-- 点击空白关闭卡片 -->
    <div v-if="contactCard" class="contact-card-mask" @click="hideContactCard" />
  </Teleport>
</template>

<style lang="scss" scoped>
.search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 64px 20px 20px;
}

.search-dialog {
  width: 794px;
  min-height: 300px;
  max-height: 674px;
  border-radius: 12px;
  background: linear-gradient(0deg, #FFFFFF, #FFFFFF), linear-gradient(180deg, #F9FAFA 0%, #FFFFFF 25%);
  box-sizing: border-box;
  border: 1.5px solid #FFFFFF;
  box-shadow: 0px 20px 50px 0px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.search-close-btn {
  position: absolute;
  top: 22px;
  right: 20px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  flex-shrink: 0;
  color: #2F3547;
}
.search-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.search-empty-icon {
  width: 140px;
  height: 140px;
  margin-bottom: 12px;
}

.search-empty-text {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  text-align: center;
}

.search-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px 24px;
}

.search-history-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  margin-bottom: 14px;
}

.search-history-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-history-tag {
  padding: 6px 12px;
  border-radius: 8px;
  background: #F5F6F9;
  border: none;
  font-size: 13px;
  color: #2F3547;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.search-history-tag:hover {
  background: #E8E8E8;
}

.search-history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-state-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 140px;
  height: 140px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #2F3547;
  margin-bottom: 8px;
  text-align: center;
}

.empty-subtitle {
  font-size: 12px;
  color: #2F3547;
  text-align: center;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  font-size: 14px;
}

.search-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-tabs {
  display: flex;
  gap: 0;
  padding: 0 4px;
  overflow-x: auto;
  flex-shrink: 0;
  height: 48px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.search-tab {
  padding: 12px 16px;
  font-size: 14px;
  color: #606572;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  line-height: 1.5;
  position: relative;

  &.active {
    color: #262626;


    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 28px;
      height: 3px;
      background: #FF7D00;
      border-radius: 12px 12px 0 0;
    }
  }

  &:hover:not(.active) {
    color: #262626;
  }
}

.tab-count {
  font-size: 13px;
  opacity: 0.8;
  margin-left: 4px;
}

.results-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.result-category {
  margin-bottom: 8px;
}

.category-title {
  padding: 12px 24px 0px;
  font-size: 12px;
  font-weight: 600;
  color: #606572;
  letter-spacing: 0.3px;
}

.category-title-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  img {
    margin-right: 4px;
  }
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  cursor: pointer;
  transition: background 0.15s;
  margin: 4px 16px;
  border-radius: 12px;

  &:hover {
    background: #F5F6F9;
  }
}

.result-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #EEF2FF;

  &.collab-icon {
    background: #F6FFED;
  }

  &.file-icon {
    background: #FFF7E6;
  }

  &.msg-icon {
    background: #F9F0FF;
  }

  &.knowledge-icon {
    background: #E6FFFB;
  }

  &.task-icon {
    background: #E6F7FF;
  }
}

.result-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #8478fa, #77c9fb);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.collab-avatar {
  background: linear-gradient(135deg, #52C41A, #73D13D);
}

.avatar-initial {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-size: 14px;
  color: #2F3547;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.result-id {
  margin-left: 6px;
}

.result-desc {
  font-size: 12px;
  color: #606572;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-status {
  display: inline-block;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  background: #F0F0F0;
  color: #595959;
  margin-right: 8px;
}

.show-more {
  padding: 8px 24px;
  font-size: 13px;
  color: #436FF6;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #F0F5FF;
  }
}

.load-more-tip {
  padding: 12px 24px;
  text-align: center;
  font-size: 12px;
  color: #999999;
}

.load-more-end {
  color: #BFBFBF;
}

.contact-card-mask {
  position: fixed;
  inset: 0;
  z-index: 10001;
}

.contact-card {
  position: fixed;
  z-index: 10002;
  width: 240px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.contact-card-header {
  width: 240px;
  height: 116px;
  position: relative;
  display: flex;
  padding-left: 16px;
  padding-top: 24px;
  background: url('@/assets/navigation/contactBg.png') no-repeat center;
  background-size: cover;
}

.contact-card-avatar-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #8478fa, #77c9fb);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contact-card-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.contact-card-avatar-initial {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
}

.contact-card-body {
  padding: 0 16px 24px;
  margin-top: -9px;
}

.contact-card-name {
  font-size: 16px;
  font-weight: 600;
  color: #171B26;
  margin-bottom: 2px;
}

.contact-card-position {
  font-size: 12px;
  color: #91949E;
  margin-bottom: 8px;
}

.contact-card-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  font-size: 13px;
  line-height: 1.5;
}

.contact-card-label {
  color: #606572;
  flex-shrink: 0;
}

.contact-card-value {
  color: #171B26;
  flex: 1;
  word-break: break-all;
}

.contact-card-btn {
  width: 100%;
  height: 32px;
  border: 1px solid #DFE2EA;
  border-radius: 8px;
  background: #FFFFFF;
  color: #171B26;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: #F5F6F9;
    border-color: #DFE2EA;
  }

  svg {
    opacity: 0.8;
  }
}
</style>

<style>
.message-highlight {
  background-color: #fff566 !important;
  transition: background-color 0.3s;
}

.keyword-highlight {
  background: rgba(255, 98, 31, 0.2);
  color: #262626;
  padding: 0 2px;
  border-radius: 2px;
}

.result-name em,
.result-desc em {
  font-style: normal;
  background: rgba(255, 98, 31, 0.2);
  color: #262626;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
