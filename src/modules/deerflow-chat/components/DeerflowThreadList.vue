<template>
  <div class="submenu-list">
    <div
      v-for="item in threadItems"
      :key="item.key"
      class="submenu-item"
      :class="{ active: uiStore.activeSecondaryNav === item.key }"
      @click="onThreadClick(item)"
    >
      <!-- 内联重命名输入框 -->
      <input
        v-if="renamingId === item.key"
        :ref="el => setRenameInputRef(el, item.key)"
        class="submenu-item-rename-input"
        :value="renameValue"
        maxlength="20"
        @input="onRenameInput"
        @keydown.enter.prevent="submitRename"
        @keydown.esc.prevent="cancelRename"
        @blur="submitRename"
        @click.stop
      />
      <span v-else class="submenu-item-label">{{ item.label }}</span>

      <img
        v-if="item.isPinned"
        src="@/assets/deerflowChat/ding.svg"
        alt="置顶"
        class="submenu-item-pin-icon"
      />

      <img
        src="@/assets/deerflowChat/overflow.svg"
        alt="more"
        class="submenu-item-more"
        @click.stop="onMoreClick($event, item)"
      />
    </div>

    <!-- 分页哨兵：进入视口时触发加载下一页 -->
    <div ref="sentinel" class="thread-list-sentinel" />

    <!-- 底部加载状态 -->
    <div v-if="loading && threadItems.length > 0" class="thread-list-footer">
      <span class="thread-list-footer-dot" />
      <span class="thread-list-footer-dot" />
      <span class="thread-list-footer-dot" />
    </div>
    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="thread-context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="onPin" v-if="!currentThreadPinned">置顶</div>
        <div class="context-menu-item" @click="onUnpin" v-else>取消置顶</div>
        <div class="context-menu-item" @click="onRename">重命名</div>
        <div class="context-menu-item context-menu-item--danger" @click="onDelete">删除</div>
      </div>
      <div v-if="contextMenu.visible" class="context-menu-mask" @click="closeContextMenu" />

      <!-- 删除确认弹框 -->
      <div v-if="deleteDialog.visible" class="delete-dialog-mask" @click.self="cancelDelete">
        <div class="delete-dialog">
          <button class="delete-dialog-close" @click="cancelDelete">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="delete-dialog-header">
            <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
            <span class="delete-dialog-title">确认删除该会话吗</span>
          </div>
          <p class="delete-dialog-desc">删除后，该会话聊天记录不可恢复</p>
          <div class="delete-dialog-footer">
            <button class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelDelete">取消</button>
            <button class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmDelete">确认</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { useDeerflowChatStore } from '@/modules/deerflow-chat/store'

const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const store = useDeerflowChatStore()

const loading = computed(() => store.loadingThreads)

const sentinel = ref(null)
let observer = null

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && store.threadPagination.hasMore && !store.loadingThreads && store.threads.length > 0) {
        store.loadMoreThreads()
      }
    },
    { threshold: 0.1 }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

const threadItems = computed(() =>
  store.sortedThreads.map((thread) => ({
    key: thread.id,
    label: thread.title || 'New Chat',
    threadId: thread.id,
    isPinned: !!(thread.is_pinned || thread.pinned_at),
  }))
)

const contextMenu = reactive({ visible: false, x: 0, y: 0, thread: null })
const deleteDialog = reactive({ visible: false, thread: null })

// 当前右键菜单选中的会话是否已置顶
const currentThreadPinned = computed(() => {
  const thread = contextMenu.thread
  if (!thread) return false
  const fullThread = store.threads.find(t => t.id === thread.threadId)
  return !!(fullThread?.is_pinned || fullThread?.pinned_at)
})

// 内联重命名状态
const renamingId = ref(null)
const renameValue = ref('')
const renameInputRefs = {}

function setRenameInputRef(el, key) {
  if (el) renameInputRefs[key] = el
  else delete renameInputRefs[key]
}

watch(
  () => store.sortedThreads.map((t) => t.id),
  (ids) => {
    if (uiStore.activePrimaryNav !== 'deerflow') return
    if (ids.length === 0) {
      if (uiStore.activeSecondaryNav !== null) {
        uiStore.setActiveNavigation('deerflow', null)
      }
      return
    }
    if (!ids.includes(uiStore.activeSecondaryNav)) {
      const urlId = Number(route.params.threadId)
      if (urlId && ids.includes(urlId)) {
        uiStore.setActiveNavigation('deerflow', urlId)
        return
      }
      // 无 URL threadId 时不默认选中，展示二级引导页
      if (uiStore.activeSecondaryNav !== null) {
        uiStore.setActiveNavigation('deerflow', null)
      }
    }
  },
  { immediate: true },
)

function onThreadClick(item) {
  if (renamingId.value === item.key) return
  uiStore.setActiveNavigation('deerflow', item.key)
  navigateToThread(item.threadId)
}

function navigateToThread(threadId) {
  store.isCreatingNewThread = false
  router.push(`/deerflow-chats/${threadId}`)
}

function onMoreClick(e, item) {
  const rect = e.target.getBoundingClientRect()
  contextMenu.visible = true
  contextMenu.x = rect.right
  contextMenu.y = rect.bottom + 4
  contextMenu.thread = item
}

function closeContextMenu() {
  contextMenu.visible = false
  contextMenu.thread = null
}

function onRename() {
  const thread = contextMenu.thread
  closeContextMenu()
  if (!thread) return
  renamingId.value = thread.key
  renameValue.value = thread.label
  nextTick(() => {
    const input = renameInputRefs[thread.key]
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 只允许：中文、英文大小写、数字、ASCII 标点、中文标点；过滤换行和其他字符
const ALLOWED_RENAME_RE = /[^一-龥a-zA-Z0-9　-〿＀-￯ ,.!?;:'"()-]/g

function onRenameInput(e) {
  const raw = e.target.value
    .replace(/[\r\n]/g, '')           // 禁止换行
    .replace(ALLOWED_RENAME_RE, '')   // 过滤非法字符
  renameValue.value = raw
  e.target.value = raw
}

async function submitRename() {
  if (!renamingId.value) return
  const id = renamingId.value
  const value = renameValue.value.trim()
  renamingId.value = null
  renameValue.value = ''
  if (!value) return
  const thread = threadItems.value.find(t => t.key === id)
  if (!thread || value === thread.label) return
  try {
    await store.renameThread(thread.threadId, value)
  } catch {
    ElMessage.error('重命名失败，请重试')
  }
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

async function onDelete() {
  const thread = contextMenu.thread
  closeContextMenu()
  if (!thread) return
  deleteDialog.visible = true
  deleteDialog.thread = thread
}

function cancelDelete() {
  deleteDialog.visible = false
  deleteDialog.thread = null
}

async function confirmDelete() {
  const thread = deleteDialog.thread
  cancelDelete()
  if (!thread) return
  const wasActive = uiStore.activeSecondaryNav === thread.key
  await store.deleteThread(thread.threadId)
  // 删除后还有会话：保留之前的二级菜单同步逻辑
  // 删除后无会话：切回引导页（清掉 URL 中的 threadId 并清除二级菜单选中态）
  if (wasActive) {
    if (store.currentThreadId) {
      uiStore.setActiveNavigation('deerflow', store.currentThreadId)
      router.replace(`/deerflow-chats/${store.currentThreadId}`)
    } else {
      uiStore.setActiveNavigation('deerflow', null)
      router.replace('/deerflow-chats')
    }
  }
}

async function onPin() {
  const thread = contextMenu.thread
  closeContextMenu()
  if (!thread) return
  await store.pinThread(thread.threadId)
}

async function onUnpin() {
  const thread = contextMenu.thread
  closeContextMenu()
  if (!thread) return
  await store.unpinThread(thread.threadId)
}
</script>

<style lang="scss" scoped>
.submenu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  height: 100%;
  margin: 0 5px;
}

.submenu-list::-webkit-scrollbar { width: 4px; }
.submenu-list::-webkit-scrollbar-track { background: transparent; }
.submenu-list::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
.submenu-list:hover::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.25); }

.submenu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0px;
  min-height: 36px;
  padding: 0px 2px 0px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submenu-item-pin-icon {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  margin-right: 2px;
}

.submenu-item:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.submenu-item:hover .submenu-item-more {
  opacity: 1;
}

.submenu-item.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
  .submenu-item-label { font-weight: 600; }
}

.submenu-item-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.submenu-item-rename-input {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-family: inherit;
  color: #2f3547;
  background: #fff;
  border: 1px solid #4e6ef2;
  border-radius: 6px;
  padding: 2px 6px;
  outline: none;
  height: 26px;
  box-sizing: border-box;
  box-shadow: 0 0 0 2px rgba(78, 110, 242, 0.15);
}

.submenu-item-more {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.submenu-item-more:hover {
  opacity: 1 !important;
}

.submenu-empty-hint {
  padding: 20px 12px;
  font-size: 13px;
  color: #91949e;
  text-align: center;
}

/* 右键菜单 */
.thread-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 120px;
  padding: 4px 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #2f3547;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: #f5f6f9;
}

.context-menu-item--danger {
  color: #f54c46;
}

.context-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* 删除确认弹框 */
.delete-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog {
  position: relative;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.delete-dialog-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  padding: 0;
  &:hover { background: #f3f4f6; }
}

.delete-dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.delete-dialog-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.delete-dialog-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 28px;
  line-height: 1.6;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-dialog-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
}

.delete-dialog-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}

.delete-dialog-btn--confirm {
  background: #1f2937;
  color: #fff;
}

.thread-list-sentinel {
  height: 4px;
  width: 100%;
  flex-shrink: 0;
}

.thread-list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0 4px;
  flex-shrink: 0;
}

.thread-list-footer--end {
  font-size: 11px;
  color: #c0c4cc;
}

.thread-list-footer-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c0c4cc;
  animation: thread-dot-bounce 1.2s infinite ease-in-out;

  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}

@keyframes thread-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
