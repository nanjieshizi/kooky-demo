<template>
  <div class="one-person-message-list">
    <div ref="scrollRef" class="message-scroll">
      <div v-if="loading" class="workspace-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ loadingText }}</span>
      </div>

      <div v-else-if="empty" class="workspace-state workspace-state--empty">
        <img src="@/assets/home/heade_icon.svg" alt="" class="workspace-state-icon" />
        <span>{{ emptyText }}</span>
      </div>

      <template v-else>
        <button
          v-if="hasMore || loadingMore"
          type="button"
          class="load-more-top"
          :disabled="loadingMore"
          @click="requestLoadMore"
        >
          <el-icon v-if="loadingMore" class="is-loading"><Loading /></el-icon>
          <span>{{ loadingMore ? '正在加载更早消息…' : '加载更早的消息' }}</span>
        </button>

        <template v-for="(message, index) in messages" :key="message.id">
          <div v-if="getDateLabel(index)" class="date-separator">
            <span class="date-label">{{ getDateLabel(index) }}</span>
          </div>
          <OnePersonMessageItem
            :message="message"
            :team-id="teamId"
            @open-task="emit('open-task', $event)"
          />
        </template>
      </template>
    </div>

    <Transition name="fade">
      <button
        v-if="showScrollToBottom"
        type="button"
        class="scroll-to-bottom-btn"
        aria-label="回到底部"
        @click="forceScrollToBottom"
      >
        <img src="@/assets/chat/down.svg" alt="" />
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { getDateSeparator } from '../../composables/useOnePersonMessageTimestamp'
import OnePersonMessageItem from './OnePersonMessageItem.vue'

defineOptions({ name: 'OnePersonMessageList' })

const props = defineProps({
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  thinking: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  teamId: { type: [String, Number], default: '' },
  threadId: { type: [String, Number], default: '' },
  emptyText: { type: String, default: '暂无消息' },
  loadingText: { type: String, default: '正在加载团队会话…' },
})

const emit = defineEmits(['open-task', 'load-more'])
const scrollRef = ref(null)
const userScrolledUp = ref(false)
const pendingPreserveTop = ref(null)
const showScrollToBottom = computed(() => userScrolledUp.value)
const empty = computed(() => !props.messages.length)

function getDateLabel(index) {
  return getDateSeparator(props.messages, index)
}

function scrollToBottom() {
  if (userScrolledUp.value) return
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function forceScrollToBottom() {
  userScrolledUp.value = false
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function requestLoadMore() {
  if (!props.hasMore || props.loadingMore || props.loading) return
  const el = scrollRef.value
  pendingPreserveTop.value = el
    ? { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight }
    : null
  emit('load-more')
}

function preserveTopAfterLoad() {
  const prev = pendingPreserveTop.value
  if (!prev) return false
  pendingPreserveTop.value = null
  nextTick(() => {
    const el = scrollRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight - prev.scrollHeight + prev.scrollTop
  })
  return true
}

function onScroll() {
  const el = scrollRef.value
  if (!el) return
  userScrolledUp.value = el.scrollHeight - el.scrollTop - el.clientHeight > 60
  if (el.scrollTop <= 80) requestLoadMore()
}

watch(
  () => props.messages.length,
  (next, prev) => {
    if (preserveTopAfterLoad()) return
    if (next >= (prev ?? 0)) scrollToBottom()
  },
)

watch(
  () => `${props.teamId || ''}:${props.threadId || ''}`,
  () => {
    pendingPreserveTop.value = null
    forceScrollToBottom()
  },
  { flush: 'post' },
)

watch(
  () => [
    props.messages.at(-1)?.id,
    props.messages.at(-1)?.seq,
    props.messages.at(-1)?.content,
    props.messages.at(-1)?.status,
  ].join('|'),
  () => scrollToBottom(),
)

watch(
  () => props.loading,
  (loading) => {
    if (!loading) forceScrollToBottom()
  },
)

watch(
  () => props.loadingMore,
  (loading) => {
    if (!loading) preserveTopAfterLoad()
  },
)

onMounted(() => {
  nextTick(() => {
    scrollRef.value?.addEventListener('scroll', onScroll, { passive: true })
    forceScrollToBottom()
  })
})

onUnmounted(() => {
  scrollRef.value?.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.one-person-message-list {
  position: relative;
  flex: 1;
  min-height: 0;
}

.message-scroll {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 28px 20px;
}

.message-scroll::-webkit-scrollbar {
  width: 5px;
}

.message-scroll::-webkit-scrollbar-thumb {
  background: rgba(47, 53, 71, 0.14);
  border-radius: 99px;
}

.workspace-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8d93a6;
  font-size: 14px;
}

.workspace-state-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  opacity: 0.76;
}

.load-more-top {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  min-width: 128px;
  margin: 4px auto 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #f1f3f7;
  color: #7b8191;
  font-size: 12px;
  cursor: pointer;
}

.load-more-top:disabled {
  cursor: default;
  opacity: 0.75;
}

.date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.date-label {
  font-size: 12px;
  color: #91949e;
  background: #fff;
  padding: 0 12px;
  position: relative;
}

.scroll-to-bottom-btn {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 5;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.scroll-to-bottom-btn img {
  width: 18px;
  height: 18px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
