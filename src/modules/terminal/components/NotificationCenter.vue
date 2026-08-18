<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNotificationStore } from '@/modules/terminal/stores/notification'
import { useProjectStore } from '@/modules/terminal/stores/project'
import { useWorkbenchStore } from '@/modules/terminal/stores/workbench'
import { usePanelStore } from '@/modules/terminal/stores/panel'
import { buildNotificationTeamMeta, getPanelRuntimeState, getPanelTeamBadgeLabel } from '@/modules/terminal/utils/panelRuntimeState.mjs'
import emptyStateImg from '@/assets/terminal/no-xiaoxi.png'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'navigate'])

const notificationStore = useNotificationStore()
const projectStore = useProjectStore()
const workbenchStore = useWorkbenchStore()
const panelStore = usePanelStore()

const notificationAnchorRef = inject('notificationAnchorRef', ref(null))
const panelFixedStyle = ref({})

function updatePanelPosition() {
  if (!props.visible) {
    panelFixedStyle.value = {}
    return
  }
  const anchor = notificationAnchorRef?.value
  if (!anchor?.getBoundingClientRect) {
    panelFixedStyle.value = {}
    return
  }
  const r = anchor.getBoundingClientRect()
  const gap = 2
  panelFixedStyle.value = {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.bottom + gap -2}px`,
    width: '382px',
    bottom: '5px',
    zIndex: 200,
  }
}

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      await nextTick()
      updatePanelPosition()
      requestAnimationFrame(updatePanelPosition)
    } else {
      panelFixedStyle.value = {}
    }
  }
)

watch(notificationAnchorRef, () => {
  if (props.visible) updatePanelPosition()
})

onMounted(() => {
  window.addEventListener('resize', updatePanelPosition)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePanelPosition)
})

const notifications = computed(() => {
  return [...notificationStore.notifications].sort((a, b) => b.timestamp - a.timestamp)
})

function projectName(projectId) {
  return projectStore.getProject(projectId)?.name ?? '未知工作区'
}

function workbenchName(workbenchId) {
  return workbenchStore.getWorkbench(workbenchId)?.name ?? '未知工作台'
}

function panelForNotification(notif) {
  return notif?.panelId ? panelStore.getPanel(notif.panelId) : null
}

function notificationSourceLabel(notif) {
  const panel = panelForNotification(notif)
  if (panel?.cliBrand === 'kooky') return 'KO Code'
  return 'Claude Code'
}

function notificationRoleLabel(notif) {
  if (notif?.roleLabel) return notif.roleLabel
  const panel = panelForNotification(notif)
  if (!panel) return ''
  return buildNotificationTeamMeta(panel).roleLabel || getPanelTeamBadgeLabel(panel) || ''
}

function notificationStatus(notif) {
  let tone, label
  if (notif?.statusLabel || notif?.statusTone) {
    tone = notif.statusTone || notif.teamStatus || 'idle'
    label = notif.statusLabel || ''
  } else {
    const panel = panelForNotification(notif)
    if (!panel) return { label: '', tone: 'idle' }
    const runtimeState = getPanelRuntimeState(panel)
    tone = runtimeState.tone
    label = runtimeState.label
  }
  // idle 状态无需显示标签
  if (tone === 'idle') return { label: '', tone: 'idle' }
  return { label, tone }
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function handleNavigate(notif) {
  emit('navigate', {
    notificationId: notif.id,
    projectId: notif.projectId,
    workbenchId: notif.workbenchId,
    panelId: notif.panelId,
  })
}

function markAllRead() {
  notificationStore.markAllRead('all')
}

function clearAllNotifications() {
  notificationStore.clearAllAfterRead()
}

function dismissNotification(notif) {
  notificationStore.removeOne(notif.id)
}
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="notification-center" :style="panelFixedStyle">
      <!-- 头部 -->
      <div class="notification-center__header">
        <div class="notification-center__header-left">
          <h2 class="notification-center__title">通知 <span class="notification-center__title-count">({{ notifications.length }})</span></h2>
        </div>
        <div class="notification-center__header-actions">
          <button
            v-if="notifications.length > 0"
            class="notification-center__action-btn"
            @click="clearAllNotifications"
          >
            <SvgIcon name="icon-clear" :size="14" color="currentColor" />
          </button>
          <!-- <button
            v-if="notificationStore.unreadCount > 0"
            class="notification-center__action-btn"
            @click="markAllRead"
          >全部已读</button> -->
          <button class="notification-center__close-btn" @click="emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- 列表区域 -->
      <div class="notification-center__list">
        <div v-if="notifications.length === 0" class="notification-center__empty">
          <img :src="emptyStateImg" alt="" class="notification-center__empty-img">
          <p class="notification-center__empty-text">暂无通知</p>
        </div>
        <div v-else class="notification-center__group">
          <div class="notification-center__items">
            <div
              v-for="notif in notifications"
              :key="notif.id"
              class="notification-item"
              :class="{ 'is-unread': !notif.read }"
              @click="handleNavigate(notif)"
            >
              <!-- 关闭按钮 -->
              <button
                class="notification-item__dismiss"
                title="清除此通知"
                @click.stop="dismissNotification(notif)"
              >
                <SvgIcon name="guanbi" :size="16" color="currentColor" />
              </button>

              <!-- 面包屑路径（前两部分） -->
              <div class="notification-item__breadcrumb">
                <span class="notification-item__breadcrumb-part">{{ projectName(notif.projectId) }}</span>
                <span class="notification-item__breadcrumb-sep">/</span>
                <span class="notification-item__breadcrumb-part">{{ workbenchName(notif.workbenchId) }}</span>
              </div>

              <!-- 标题行：来源 + 角色标签 -->
              <div class="notification-item__title-row">
                <h4 class="notification-item__title">{{ notificationSourceLabel(notif) }}</h4>
                <span
                  v-if="notificationRoleLabel(notif)"
                  class="notification-item__role-badge"
                >
                  {{ notificationRoleLabel(notif) }}
                </span>
              </div>

              <!-- 面包屑第三部分（subtitle） -->
              <div v-if="notif.subtitle" class="notification-item__subtitle">
                {{ notif.subtitle }}
              </div>

              <!-- 正文内容 -->
              <p v-if="notif.content" class="notification-item__content">{{ notif.content }}</p>

              <!-- 时间 -->
              <div class="notification-item__time">{{ formatTime(notif.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="notification-center__footer">
        <label class="notification-center__sound-toggle">
          <div class="notification-center__sound-label">
            <!-- volume-2 icon -->
            <div class="notification-center__switch" :class="{ 'is-on': notificationStore.soundEnabled }">
            <input
              type="checkbox"
              :checked="notificationStore.soundEnabled"
              @change="notificationStore.setSoundEnabled($event.target.checked)"
            />
            <div class="notification-center__switch-track">
              <div class="notification-center__switch-thumb" />
            </div>
          </div>
            <span>通知声音</span>
          </div>
         
        </label>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
/* 宽度 382px；位置由 panelFixedStyle（锚定工作区标题行底部）撑满至视口底 */
.notification-center {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background: #212121;
  border-radius: 12px;

  &__header {
    height: 44px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #DFDFDF;
    margin: 0;
  }

  &__title-count {
    color: #898989;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #797979;
    cursor: pointer;
    padding: 5px;
    border-radius: 6px;
    transition: opacity 0.15s ease, background 0.15s ease;
    &:hover {
      background: rgba(255, 255, 255, 0.06);
      opacity: 0.8;
    }
  }

  &__close-btn {
    background: none;
    border: none;
    color: #DFDFDF;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
  }

  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
    &::-webkit-scrollbar-thumb:hover { background: #484f58; }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    min-height: 0;
    margin-top: 266px;
  }

  &__empty-img {
    display: block;
    width: 100%;
    max-width: 100px;
    height: auto;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
  }

  &__empty-text {
    margin: 0;
    text-align: center;
    color: #8b949e;
    font-size: 13px;
  }

  &__group {
    padding: 16px;
    padding-top: 8px;
  }

  &__group-title {
    font-size: 10px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 12px 0;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__footer {
    padding: 12px 14px;
    flex-shrink: 0;
  }

  &__sound-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  &__sound-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #7b7b7b;
    font-size: 12px;
    svg { flex-shrink: 0; }
  }

  &__sound-icon {
    color: #7b7b7b;
  }

  &__switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;

    input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
  }

  &__switch-track {
    width: 32px;
    height: 16px;
    background: #30363d;
    border-radius: 8px;
    position: relative;
    transition: background 0.2s;

    .is-on & {
      background: #ff684e;
    }
  }

  &__switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;

    .is-on & {
      transform: translateX(16px);
    }
  }
}

.notification-item {
  position: relative;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  // border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  &.is-unread {
    border-color: rgba(255, 255, 255, 0.08);
  }

  &__dismiss {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #ffffff;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  }

  &:hover &__dismiss {
    opacity: 1;
  }

  &__dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  &__breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    // margin-bottom: 4px;
    font-size: 12px;
    color: #7B7B7B;
  }

  &__breadcrumb-part {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__breadcrumb-sep {
    opacity: 0.5;
    flex-shrink: 0;
  }

  &__source {
    display: none;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: #DFDFDF;
    line-height: 1.4;
  }

  &__role-badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 10px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #c9d1d9;
    font-size: 11px;
    font-weight: 600;
  }

  &__subtitle {
    font-size: 12px;
    color: #7B7B7B;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  &__content {
    margin: 0 0 4px;
    font-size: 12px;
    color: #DFDFDF;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__time {
    margin-top: 8px;
    font-size: 12px;
    color: #7B7B7B;
  }
}

.slide-enter-active {
  animation: panel-drop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes panel-drop-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<style lang="scss">
.light-theme {
  .notification-center {
    background: #ffffff;
    border-color: #d0d7de;

    &__header {
      border-bottom-color: #d0d7de;
    }

    &__title {
      color: #2F3547;
    }

    &__title-count {
      color: #898989;
    }

    &__action-btn {
      color: #91949E;
    }

    &__close-btn {
      color: #2F3547;
      &:hover {
        color: #1f2328;
      }
    }

    &__list {
      &::-webkit-scrollbar-thumb {
        background: #d0d7de;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: #8b949e;
      }
    }

    &__empty-text {
      color: #656d76;
    }

    &__footer {
      border-top-color: #d0d7de;
      background: #ffffff;
    }

    &__sound-label {
      color: #656d76;
    }

    &__sound-icon {
      color: #656d76;
    }

    &__switch-track {
      background: #d0d7de;
      .is-on & {
        background: #ff684e;
      }
    }
  }

  .notification-item {
    background: #F5F6F9;

    &:hover {
      background: #ECEEF3;
    }

    &.is-unread {
      // border-color: #d0d7de;
    }

    &__dismiss {
      color: #656d76;
      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2328;
      }
    }

    &__breadcrumb {
      color: #91949E;
    }

    &__source {
      display: none;
    }

    &__title {
      color: #2F3547;
      font-weight: 500;
    }

    &__subtitle {
      color: #91949E;
    }

    &__role-badge {
      background: #f6f8fa;
      color: #1f2328;
      border: 1px solid #d0d7de;
    }

    &__content {
      color: #2F3547;
    }

    &__time {
      color: #8b949e;
    }
  }
}
</style>
