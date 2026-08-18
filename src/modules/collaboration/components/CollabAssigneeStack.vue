<template>
  <div class="assignee-stack" @mouseenter="open = true" @mouseleave="open = false">
    <div class="stack-avatars">
      <span
        v-for="(p, idx) in visiblePeople"
        :key="p.key"
        class="stack-avatar"
        :class="{ 'is-dimmed': p.status !== 'done' }"
        :style="{ zIndex: visiblePeople.length - idx, marginLeft: idx === 0 ? 0 : '-8px' }"
        :title="`${p.name}${p.status === 'done' ? ' · 已完成' : ' · 待完成'}`"
      >
        <img v-if="p.avatar" :src="p.avatar" :alt="p.name" />
        <span v-else class="avatar-fallback" :style="{ background: avatarColor(p.name) }">
          {{ initials(p.name) }}
        </span>
      </span>
      <span v-if="overflow > 0" class="stack-overflow" :style="{ marginLeft: '-8px' }">
        +{{ overflow }}
      </span>
    </div>

    <!-- hover 弹出详情卡片 -->
    <Transition name="popover">
      <div v-if="open && people.length > 0" class="assignee-popover" @click.stop>
        <div class="popover-header">
          <span class="popover-icon">👷</span>
          <span class="popover-title">执行人</span>
        </div>
        <div class="popover-list">
          <div
            v-for="p in people"
            :key="p.key"
            class="popover-row"
            :class="`row-${p.status || 'pending'}`"
          >
            <span class="row-avatar">
              <img v-if="p.avatar" :src="p.avatar" :alt="p.name" />
              <span v-else class="avatar-fallback small" :style="{ background: avatarColor(p.name) }">
                {{ initials(p.name) }}
              </span>
            </span>
            <span class="row-info">
              <span class="row-name">{{ p.name }} <span v-if="p.account" class="row-account">{{ p.account }}</span></span>
              <span class="row-status">{{ statusText(p) }}</span>
            </span>
            <span class="row-marker">
              <svg v-if="p.status === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5 9-10" stroke="#86909C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="p.status === 'pending' || !p.status" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3a7 7 0 0 0-7 7v3l-2 2h18l-2-2v-3a7 7 0 0 0-7-7zM10 19a2 2 0 1 0 4 0" stroke="#F53F3F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineOptions({ name: 'CollabAssigneeStack' })

import { ref, computed } from 'vue'
import { COLLEAGUES, CURRENT_USER } from '@/dev-mocks/data/users'

const props = defineProps({
  /** 执行人名字数组（中文名） */
  names: { type: Array, default: () => [] },
  /** 每个执行人的状态映射：{ name: 'pending' | 'done', completedAt?: string } */
  statuses: { type: Object, default: () => ({}) },
  /** 最多显示几个头像，超出 +N */
  maxShow: { type: Number, default: 4 },
})

const open = ref(false)

const POOL = computed(() => [CURRENT_USER, ...COLLEAGUES])

function lookup(name) {
  if (!name) return null
  return POOL.value.find(
    (u) => u.name === name || u.userName === name || u.userId === name,
  ) || null
}

const people = computed(() => {
  return (props.names || []).map((name, i) => {
    const u = lookup(name)
    const status = props.statuses?.[name]?.status || 'pending'
    return {
      key: `${name}-${i}`,
      name,
      account: u?.userName || '',
      avatar: u?.avatar || '',
      status,
      completedAt: props.statuses?.[name]?.completedAt || '',
    }
  })
})

const visiblePeople = computed(() => people.value.slice(0, props.maxShow))
const overflow = computed(() => Math.max(0, people.value.length - props.maxShow))

function initials(name) {
  if (!name) return ''
  // 中文名：取最后一个字
  const ch = String(name).trim()
  if (/[一-龥]/.test(ch)) return ch.slice(-1)
  return ch.slice(0, 1).toUpperCase()
}

// 用名字 hash 出一个稳定的背景色（兜底头像）
const COLORS = ['#E8F2FE', '#FFF1ED', '#F0F9F4', '#FFF7E6', '#F3E8FF', '#FFE8F0', '#E6F7FF']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

function statusText(p) {
  if (p.status === 'done') return p.completedAt ? `${p.completedAt} 完成` : '已完成'
  if (p.status === 'pending') return '待完成'
  return ''
}
</script>

<style scoped>
.assignee-stack {
  display: inline-flex;
  position: relative;
  align-items: center;
}

.stack-avatars {
  display: inline-flex;
  align-items: center;
}

.stack-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #FFFFFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #F2F3F5;
  position: relative;
  flex-shrink: 0;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

/* 未完成执行人：半透明 + 灰度（PRD 规范）*/
.stack-avatar.is-dimmed {
  opacity: 0.4;
  filter: grayscale(0.6);
}

.stack-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  color: #4E5969;
}

.avatar-fallback.small {
  font-size: 13px;
}

.stack-overflow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #F2F3F5;
  border: 1.5px solid #FFFFFF;
  font-size: 11px;
  color: #4E5969;
  font-weight: 500;
}

/* ── 弹出卡片 ── */
.assignee-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  width: 240px;
  max-height: 280px;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid #E5E6EB;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
  border-bottom: 1px solid #F2F3F5;
}

.popover-icon {
  font-size: 14px;
}

.popover-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.popover-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.popover-row:hover {
  background: #FAFBFC;
}

.row-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #F2F3F5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.row-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-name {
  font-size: 13px;
  color: #1D2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-account {
  margin-left: 4px;
  color: #86909C;
  font-size: 11px;
}

.row-status {
  font-size: 11px;
  color: #86909C;
  margin-top: 1px;
}

.popover-row.row-pending .row-status {
  color: #F53F3F;
}

.row-marker {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
