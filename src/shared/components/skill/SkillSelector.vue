<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="top-start"
    :width="280"
    trigger="click"
    popper-class="skill-selector-popper"
    @show="onPopoverShow"
    @hide="onPopoverHide"
  >
    <template #reference>
      <button class="skill-selector-btn" :class="{ active: popoverVisible }">
        <SvgIcon name="icon-Skill" :size="16" color="#606572" />
      </button>
    </template>

    <div class="skill-selector-panel">
      <div class="skill-selector-panel__search">
        <el-input
          v-model="keyword"
          class="skill-selector-search-input"
          placeholder="搜索技能"
          size="small"
          clearable
        >
          <template #prefix>
            <SvgIcon name="icon-sousuo1" :size="16" color="#91949E" />
          </template>
        </el-input>
      </div>

      <div class="skill-selector-panel__list" ref="listRef" @scroll.passive="onListScroll">
        <div v-if="loading" class="skill-selector-panel__status">加载中...</div>

        <div v-else-if="filteredList.length === 0" class="skill-selector-panel__status">
          <template v-if="keyword.trim()">未找到匹配的技能</template>
          <template v-else>暂无技能，请去市场安装</template>
        </div>

        <template v-else>
          <div
            v-for="skill in filteredList"
            :key="skill.id"
            class="skill-selector-panel__item"
            @click="skill.isInstalled === true ? selectSkill(skill) : ElMessage.warning('请先安装该技能')"
          >
            <img :src="skillIconItem(skill)" class="skill-selector-panel__item-icon" alt="" />
            <span class="skill-selector-panel__item-name">{{ skill.displayName || skill.slug }}</span>
            <!-- 已安装标识：绿色对勾 -->
            <SvgIcon
              v-if="skill.isInstalled === true"
              name="icon-chenggong"
              :size="16"
              color="#52C41A"
              class="skill-selector-panel__item-installed"
            />
            <button
              v-if="skill.isInstalled !== true"
              class="skill-selector-panel__item-download"
              :class="{ 'is-downloading': downloadingSkillIds.has(skill.slug || skill.id) }"
              :disabled="downloadingSkillIds.has(skill.slug || skill.id)"
              @click.stop="onInstall(skill)"
            >
              <img
                v-if="downloadingSkillIds.has(skill.slug || skill.id)"
                :src="downloadingIcon"
                class="skill-selector-panel__item-download-icon"
                alt="安装中"
              />
              <SvgIcon v-else name="icon-anzhuang" :size="16" color="#91949E" />
            </button>
          </div>

          <div v-if="loadMoreLoading" class="skill-selector-panel__bottom">加载中...</div>
          <div v-else-if="!hasMore && keyword.trim()" class="skill-selector-panel__bottom">已到底</div>
        </template>
      </div>

      <div class="skill-selector-panel__footer" :class="{ 'is-scrolled': isListScrolled }">
        <button class="skill-selector-panel__market-btn" @click="openMarket">
          <img :src="skillMarketIcon" class="skill-selector-panel__market-icon" alt="" />
          <span>Skill 市场</span>
        </button>
      </div>
    </div>
  </el-popover>

</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchSkillMarketList, putManagedSkills } from '@/modules/market/skill/skillMarketApi'
import { ElMessage } from 'element-plus'
import skillIcon from '@/assets/chat/skillDefault.png'
import skillMarketIcon from '@/assets/chat/skillpath.svg'
import downloadingIcon from '@/assets/chat/downloading.png'

// 防抖函数
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

const props = defineProps({
  fetchAgentId: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const router = useRouter()
const popoverVisible = ref(false)
const keyword = ref('')
const loading = ref(false)
const loadMoreLoading = ref(false)
const allSkills = ref([])
const hasMore = ref(false)
const listRef = ref(null)
const currentPage = ref(1)
const isListScrolled = ref(false)

const PAGE_SIZE = 20
const SCROLL_THRESHOLD_PX = 60

/** 正在下载中的技能 slug/id 集合 */
const downloadingSkillIds = ref(new Set())

/** fetchAgentId=true 时优先使用外部缓存的 agentId，缺省回退 main。 */
const cachedAgentId = ref(null)

/** 数据是否已初始化过（避免重复拉取） */
const initialized = ref(false)

/**
 * 是否还有下一页（与 SkillMarketView 一致：优先 pagination.total / totalPages / hasNext）
 */
function computeHasMore(pagination, batchLength, page, pageSize) {
  if (batchLength === 0) return false
  // 优先使用后端直接返回的 hasMore / hasNext 字段
  if (pagination?.hasMore === false || pagination?.hasNext === false) return false
  if (pagination?.hasMore === true || pagination?.hasNext === true) return true
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
  return batchLength >= pageSize
}

// 移除前端过滤，改为服务端搜索
const filteredList = computed(() => allSkills.value)

const skillIconItem = (item) => {
  return item?.avatar || skillIcon
}

async function loadSkills(reset = true) {
  if (reset) {
    if (loading.value) return
    loading.value = true
    currentPage.value = 1
  } else {
    if (!hasMore.value || loadMoreLoading.value || loading.value) return
    loadMoreLoading.value = true
  }

  const nextPage = reset ? 1 : currentPage.value + 1

  try {
    const hasKeyword = keyword.value.trim()

    const params = {
      page: nextPage,
      pageSize: PAGE_SIZE,
    }

    if (!hasKeyword) {
      const agentId = props.fetchAgentId
        ? (cachedAgentId.value || 'main')
        : 'main'
      params.agentId = agentId
      params.includeInstallStatus = true
      params.prioritizeInstalled = true
    } else {
      params.search = hasKeyword
    }

    const { results, pagination } = await fetchSkillMarketList(params)
    const rows = results ?? []
    if (reset) {
      allSkills.value = rows
      currentPage.value = 1
      await nextTick()
      listRef.value?.scrollTo?.(0, 0)
    } else {
      allSkills.value = [...allSkills.value, ...rows]
      currentPage.value = nextPage
    }
    hasMore.value = computeHasMore(pagination, rows.length, nextPage, PAGE_SIZE)
  } catch (e) {
    console.error('[SkillSelector] 加载技能列表失败:', e)
    if (reset) {
      allSkills.value = []
    }
    hasMore.value = false
  } finally {
    loading.value = false
    loadMoreLoading.value = false
  }
}

function onListScroll() {
  const el = listRef.value
  if (!el) return

  const { scrollTop, clientHeight, scrollHeight } = el
  isListScrolled.value = scrollTop > 0

  if (!hasMore.value || loading.value || loadMoreLoading.value) return
  if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX) {
    loadSkills(false)
  }
}

async function onInstall(skill) {
  const skillId = skill.slug || skill.id
  if (downloadingSkillIds.value.has(skillId)) return
  downloadingSkillIds.value = new Set(downloadingSkillIds.value).add(skillId)

  function cleanup() {
    const next = new Set(downloadingSkillIds.value)
    next.delete(skillId)
    downloadingSkillIds.value = next
    loadSkills(true)
  }

  try {
    const agentId = props.fetchAgentId
      ? (cachedAgentId.value || 'main')
      : 'main'

    await putManagedSkills({
      skill_ids: [skillId],
      agent_id: agentId,
    })

    ElMessage.success('安装成功')
    cleanup()
  } catch (e) {
    console.error('[SkillSelector] 安装失败:', e)
    ElMessage.error(e?.message || '安装失败')
    cleanup()
  }
}

function openMarket() {
  popoverVisible.value = false
  router.push({ name: 'MarketSkill' })
}

function onPopoverHide() {
  keyword.value = ''
  allSkills.value = []
  hasMore.value = false
  currentPage.value = 1
}

async function onPopoverShow() {
  keyword.value = ''

  await loadSkills()
  initialized.value = true
}

function selectSkill(skill) {
  emit('select', skill)
  popoverVisible.value = false
  keyword.value = ''
}

// 监听搜索关键词变化，防抖后重新加载
const debouncedSearch = debounce(() => {
  loadSkills(true)
}, 300)

watch(keyword, () => {
  if (popoverVisible.value) {
    debouncedSearch()
  }
})

// 组件挂载时预加载数据
onMounted(async () => {
  // 静默加载数据，不显示 loading 状态
  await loadSkills()
  initialized.value = true
})
</script>

<style lang="scss" scoped>
.skill-selector-btn {
  width: 28px;
  height: 28px;
  background: #FFFFFF;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
  margin-left: 8px;
  transition: background 0.15s;

  &:hover,
  &.active {
    background: #F7F8FA;
  }

  &__icon {
    width: 20px;
    height: 20px;
  }
}

.skill-selector-panel {
  display: flex;
  flex-direction: column;
  max-height: 378px;

  &__search {
    padding: 8px 8px 4px;
    flex-shrink: 0;

    :deep(.skill-selector-search-input.el-input) {
      .el-input__wrapper {
        height: 32px;
        border-radius: 8px;
        background: #F7F8FA;
        box-sizing: border-box;
        border: 1px solid transparent;
        box-shadow: none;
      }

      .el-input__wrapper:hover {
        box-shadow: none;
      }

      .el-input__wrapper.is-focus {
        border-color: #FF8670;
        box-shadow: none;
      }

      .el-input__inner::placeholder {
        font-size: 14px;
      }
    }
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 60px;
    max-height: 320px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #DFE2EA;
      border-radius: 3px;
      border-right: 1px solid transparent;
      background-clip: padding-box;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #c4c8d4;
      background-clip: padding-box;
    }
  }

  &__status {
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
    padding: 24px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.12s;
    margin: 0 4px;
    color: #1f2937;

    &:hover {
      border-radius: 8px;
      background: #F5F6F9;
    }

    &.is-disabled {
      cursor: not-allowed;

      &:hover {
        background: transparent;
      }

      .skill-selector-panel__item-icon,
      .skill-selector-panel__item-name {
        opacity: 0.5;
      }
    }

    &-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    &-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }

    &-installed {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
    }

    &-download {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.12s;
    }

    &-download:hover {
      background: #e5e7eb;
    }

    &-download.is-downloading {
      cursor: default;
      opacity: 0.7;

      .skill-selector-panel__item-download-icon {
        width: 16px;
        height: 16px;
        animation: spin 1s linear infinite;
      }
    }

    &-download.is-downloading:hover {
      background: none;
    }
  }

  &__bottom {
    text-align: center;
    color: #d1d5db;
    font-size: 12px;
    padding: 8px 0 4px;
  }

  &__footer {
    background: #FFFFFF;
    padding: 6px 8px;
    flex-shrink: 0;
    position: relative;
    transition: box-shadow 0.2s ease;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 16px;
      right: 16px;
      height: 1px;
      background: #ECEEF3;
    }

    &.is-scrolled {
      box-shadow: 0px -4px 6px 0px rgba(47, 53, 71, 0.06);
    }
  }

  &__market-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
    transition: background 0.12s;

    &:hover {
      background: #f3f4f6;
    }
  }

  &__market-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
