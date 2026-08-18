import { ref, computed, type Ref } from 'vue'
import { fetchMyAgents } from '../services/myUploadsApi'
import type { AgentItem, StatusFilter } from '../types'

/**
 * Agent 列表管理组合式函数（支持下拉加载）
 * @param searchKeyword 与工具栏搜索框同步，作为 GET my/agents 的 `search` 查询参数
 * @param statusFilter 可选的状态筛选
 */
export function useAgentList(searchKeyword: Ref<string>, statusFilter?: Ref<StatusFilter>) {
  /** 首屏/刷新/筛选/搜索 整表请求 */
  const listLoading = ref(false)
  /** 滚动到底追加下一页 */
  const loadMoreLoading = ref(false)
  const list = ref<AgentItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const hasMore = ref(true)

  const isEmpty = computed(
    () => !listLoading.value && !loadMoreLoading.value && list.value.length === 0,
  )

  /**
   * 加载列表数据
   */
  async function loadList(append = false) {
    if (listLoading.value || loadMoreLoading.value) return

    if (append) {
      loadMoreLoading.value = true
    } else {
      listLoading.value = true
    }
    try {
      const q = searchKeyword.value.trim()
      const status = statusFilter?.value ?? 'all'
      const res = await fetchMyAgents({
        page: page.value,
        pageSize: pageSize.value,
        status,
        ...(q ? { search: q } : {}),
      })

      if (append) {
        list.value = [...list.value, ...res.results]
      } else {
        list.value = res.results
      }

      total.value = res.pagination.total
      hasMore.value = res.pagination.hasMore
    } catch (error) {
      console.error('加载 Agent 列表失败:', error)
      if (!append) {
        list.value = []
        total.value = 0
      }
    } finally {
      listLoading.value = false
      loadMoreLoading.value = false
    }
  }

  /**
   * 加载更多
   */
  async function loadMore() {
    if (!hasMore.value || listLoading.value || loadMoreLoading.value) return
    page.value += 1
    await loadList(true)
  }

  /**
   * 刷新列表
   */
  function refresh() {
    page.value = 1
    list.value = []
    loadList()
  }

  return {
    listLoading,
    loadMoreLoading,
    list,
    total,
    page,
    pageSize,
    hasMore,
    isEmpty,
    loadList,
    loadMore,
    refresh,
  }
}
