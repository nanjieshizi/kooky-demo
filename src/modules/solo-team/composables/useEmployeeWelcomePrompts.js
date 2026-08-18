import { computed, ref, unref, watch } from 'vue'
import { fetchAgentPrompts } from '../service'

const DEFAULT_PILL_TITLE_MAX = 15

/** 输入框上方胶囊标题截断（最多 15 字，超出加省略号） */
export function truncateEmployeeWelcomePillTitle(text, max = DEFAULT_PILL_TITLE_MAX) {
  const s = String(text ?? '')
  const chars = [...s]
  if (chars.length <= max) return s
  return `${chars.slice(0, max).join('')}…`
}

/**
 * 欢迎页 / 对话态输入框：分页展示提示词，支持「换一换」轮换。
 * @param {import('vue').Ref<string | number | null | undefined> | import('vue').ComputedRef<string | number | null | undefined>} agentIdRef 数字员工 agent id
 * @param {{ fixedPerPage?: number, fetchWelcomePrompts?: import('vue').Ref<boolean> | boolean }} [options]
 *   `fixedPerPage: 4`：输入框上方每页固定条数；不传则欢迎区按宽度 3/4 条。
 *   `fetchWelcomePrompts`：为 false 时不请求提示词接口（一人团队 / 我的员工暂关）；协作数字人传 true。未传默认 true。
 */
export function useEmployeeWelcomePrompts(agentIdRef, options = {}) {
  const fixedPerPage = Number(options.fixedPerPage) > 0 ? Math.floor(Number(options.fixedPerPage)) : null
  const fetchWelcomePromptsOpt = options.fetchWelcomePrompts

  function shouldFetchPrompts() {
    if (fetchWelcomePromptsOpt == null) return true
    return Boolean(unref(fetchWelcomePromptsOpt))
  }

  const welcomeInputWidth = ref(760)
  const welcomeBatchIndex = ref(0)
  const welcomePrompts = ref([])
  const welcomePromptsLoading = ref(false)

  watch(
    [
      () => {
        const v = agentIdRef == null ? null : unref(agentIdRef)
        if (v == null || v === '') return ''
        return String(v).trim()
      },
      () => shouldFetchPrompts(),
    ],
    async ([id, fetchOn]) => {
      welcomeBatchIndex.value = 0
      if (!id) {
        welcomePrompts.value = []
        welcomePromptsLoading.value = false
        return
      }
      if (!fetchOn) {
        welcomePrompts.value = []
        welcomePromptsLoading.value = false
        return
      }
      welcomePromptsLoading.value = true
      try {
        welcomePrompts.value = await fetchAgentPrompts(id)
      } catch {
        welcomePrompts.value = []
      } finally {
        welcomePromptsLoading.value = false
      }
    },
    { immediate: true },
  )

  const welcomeActionPageSize = computed(() => {
    if (fixedPerPage != null) return fixedPerPage
    const width = Number(welcomeInputWidth.value) || 0
    return width > 640 ? 4 : 3
  })
  const welcomeActionPageCount = computed(() => {
    const size = welcomeActionPageSize.value
    const len = welcomePrompts.value.length
    if (!len) return 1
    return Math.max(1, Math.ceil(len / size))
  })
  const displayedWelcomeActions = computed(() => {
    const list = welcomePrompts.value
    const size = welcomeActionPageSize.value
    if (!list.length) return []
    const start = welcomeBatchIndex.value * size
    return list.slice(start, start + size)
  })
  watch(welcomeActionPageSize, () => {
    welcomeBatchIndex.value = 0
  })
  const welcomePromptCount = computed(() => welcomePrompts.value.length)
  /** 接口条数大于当前分辨率下一行可展示条数时才需要「换一换」 */
  const showWelcomePromptRotate = computed(() => {
    const n = welcomePrompts.value.length
    const size = welcomeActionPageSize.value
    return n > size
  })
  function rotateWelcomeActions() {
    welcomeBatchIndex.value = (welcomeBatchIndex.value + 1) % welcomeActionPageCount.value
  }
  return {
    welcomeInputWidth,
    welcomeBatchIndex,
    welcomeActionPageSize,
    welcomeActionPageCount,
    displayedWelcomeActions,
    rotateWelcomeActions,
    welcomePromptsLoading,
    welcomePromptCount,
    showWelcomePromptRotate,
  }
}
