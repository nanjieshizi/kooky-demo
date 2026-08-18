<template>
  <div
    v-if="visible"
    ref="sentinelRef"
    class="load-older-sentinel"
  >
    <span v-if="loadingOlder">加载更早的消息…</span>
    <span v-else-if="ledgerBackfillPending">历史消息回填中…</span>
    <span v-else-if="hasMore">上滑加载更早消息</span>
  </div>
</template>

<script setup>
/**
 * 上滑加载更早消息哨兵 —— 对齐 deer-flow `PersonalMessageLoadOlderSentinel`。
 *
 * 行为：
 *  - IntersectionObserver 以 listRef 为 root，rootMargin 240px 顶部缓冲。
 *  - 触发条件：!ledgerBackfillPending && hasMore && !loadingOlder。
 *  - 触发前在 store 写入 scrollAnchor = { scrollHeight, scrollTop }，请求完成后由本组件 watch
 *    persistedMessages 长度变化，在 nextTick 中恢复滚动位置避免视口跳动。
 */
import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed } from 'vue'

const props = defineProps({
  /**
   * 滚动容器（DOM 元素）。父组件通常以 `:list-ref="listRef"` 传入，
   * Vue 模板会自动解包顶层 ref，所以这里收到的是 HTMLElement，而非 ref 对象。
   */
  listRef: { type: Object, required: true },
  hasMore: { type: Boolean, default: false },
  loadingOlder: { type: Boolean, default: false },
  ledgerBackfillPending: { type: Boolean, default: false },
  /** 当前会话的 personalThreadId */
  threadDbId: { type: [Number, String], default: null },
  /** 触发拉旧页的回调；调用方需在 store 中实现并写入 scrollAnchor */
  onFetchOlder: { type: Function, required: true },
  /** 用于监听 persisted 长度变化，触发滚动锚点恢复 */
  persistedCount: { type: Number, default: 0 },
  /** 由 store 维护的滚动锚点对象引用，{ scrollHeight, scrollTop } | null */
  scrollAnchorRef: { type: Object, default: null },
  /** 锚点恢复后清理回调（建议把 store.threadStates.get(id).scrollAnchor 置 null） */
  onAfterRestore: { type: Function, default: () => {} },
})

const sentinelRef = ref(null)
let observer = null

const visible = computed(() => props.hasMore || props.loadingOlder || props.ledgerBackfillPending)

function attachObserver() {
  const sentinel = sentinelRef.value
  const root = props.listRef
  if (!sentinel || !root) return
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry || !entry.isIntersecting) return
      if (props.ledgerBackfillPending || !props.hasMore || props.loadingOlder) return
      // 在请求前写入滚动锚点
      const anchor = { scrollHeight: root.scrollHeight, scrollTop: root.scrollTop }
      // 通过 onFetchOlder 回调让 store 把 anchor 存入对应 threadState.scrollAnchor
      void props.onFetchOlder(anchor)
    },
    { root, rootMargin: '240px 0px 0px 0px', threshold: 0 },
  )
  observer.observe(sentinel)
}

function detachObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

onMounted(() => {
  nextTick(() => attachObserver())
})

onBeforeUnmount(() => {
  detachObserver()
})

watch(() => props.listRef, (root, oldRoot) => {
  if (root && root !== oldRoot) {
    detachObserver()
    nextTick(() => attachObserver())
  }
})

watch(visible, async (vis) => {
  if (vis) {
    // v-if 由 visible 控制，从 false→true 时 sentinelRef DOM 仍未挂载，
    // 单次 nextTick 不一定能拿到，await 之后再判断更稳妥。
    await nextTick()
    if (!observer && sentinelRef.value) attachObserver()
  } else {
    detachObserver()
  }
})

// 旧页回来后恢复滚动位置：persistedCount 增加 + 存在 scrollAnchorRef → 恢复
watch(
  () => props.persistedCount,
  () => {
    const root = props.listRef
    const anchor = props.scrollAnchorRef
    if (!root || !anchor) return
    nextTick(() => {
      const delta = root.scrollHeight - anchor.scrollHeight
      root.scrollTop = anchor.scrollTop + (delta > 0 ? delta : 0)
      props.onAfterRestore?.()
    })
  },
)
</script>

<style lang="scss" scoped>
.load-older-sentinel {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
  padding: 8px 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  user-select: none;
}
</style>
