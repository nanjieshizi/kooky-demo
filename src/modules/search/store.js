import { defineStore } from 'pinia'
import { ref } from 'vue'

export const PAGE_SIZE = 20

function createPagination() {
  return { page: 0, hasMore: false, total: 0, loadingMore: false }
}

export const useSearchStore = defineStore('search', () => {
  const visible = ref(false)
  const keyword = ref('')
  const activeTab = ref('all')
  const loading = ref(false)
  const hasSearched = ref(false)  // 标记是否已经搜索过
  const results = ref({
    collaborations: [],
    contacts: []
  })
  const pagination = ref({
    collaboration: createPagination(),
    contact: createPagination()
  })

  function openDialog() {
    visible.value = true
  }

  function closeDialog() {
    visible.value = false
    keyword.value = ''
    activeTab.value = 'all'
    hasSearched.value = false
    results.value = {
      collaborations: [],
      contacts: []
    }
    resetPagination()
  }

  function setKeyword(value) {
    keyword.value = value
  }

  function setActiveTab(tab) {
    activeTab.value = tab
  }

  function setResults(newResults) {
    results.value = { ...results.value, ...newResults }
  }

  function appendResults(key, items) {
    if (!Array.isArray(items) || !items.length) return
    results.value = { ...results.value, [key]: [...results.value[key], ...items] }
  }

  function setLoading(value) {
    loading.value = value
  }

  function setHasSearched(value) {
    hasSearched.value = value
  }

  function setPagination(key, patch) {
    if (!pagination.value[key]) return
    pagination.value[key] = { ...pagination.value[key], ...patch }
  }

  function resetPagination(key) {
    if (key) {
      pagination.value[key] = createPagination()
    } else {
      pagination.value = {
        collaboration: createPagination(),
        contact: createPagination()
      }
    }
  }

  return {
    visible,
    keyword,
    activeTab,
    loading,
    hasSearched,
    results,
    pagination,
    show: openDialog,
    hide: closeDialog,
    setKeyword,
    setActiveTab,
    setResults,
    appendResults,
    setLoading,
    setHasSearched,
    setPagination,
    resetPagination
  }
})
