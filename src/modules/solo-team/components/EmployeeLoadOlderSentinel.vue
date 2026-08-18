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
import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed } from 'vue'

const props = defineProps({
  listRef: { type: Object, default: null },
  hasMore: { type: Boolean, default: false },
  loadingOlder: { type: Boolean, default: false },
  ledgerBackfillPending: { type: Boolean, default: false },
  threadDbId: { type: [Number, String], default: null },
  onFetchOlder: { type: Function, required: true },
  persistedCount: { type: Number, default: 0 },
  scrollAnchorRef: { type: Object, default: null },
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
      const anchor = { scrollHeight: root.scrollHeight, scrollTop: root.scrollTop }
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
    await nextTick()
    if (!observer && sentinelRef.value) attachObserver()
  } else {
    detachObserver()
  }
})

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
