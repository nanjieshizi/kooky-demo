<template>
  <!-- 通讯录 B · 员工详情左区「工作记录」：左边一条动态流（会话 + 定时执行混排），右边他交付的东西 -->
  <aside class="wl-pane">
    <h3 class="wl-pane-title">工作记录</h3>
    <div class="wl-cols">
      <section class="wl-block">
        <header class="wl-block-head">
          <span class="wl-block-name">最近动态</span>
          <span v-if="activity.length" class="wl-block-count">{{ activity.length }}</span>
        </header>
        <p v-if="loadingThreads" class="wl-hint">加载中…</p>
        <p v-else-if="!activity.length" class="wl-hint">还没干过活。点右上角「对话」派一件。</p>
        <ul v-else class="wl-list">
          <li v-for="item in visibleActivity" :key="item.id">
            <button type="button" class="wl-row" @click="onOpen(item)">
              <span class="wl-row-ico" :class="`is-${item.kind}`" aria-hidden="true">
                <!-- 会话 = 气泡，定时 = 闹钟：一眼分得清这活是我派的还是它自己到点跑的 -->
                <svg v-if="item.kind === 'chat'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.3-.5L3 21l1.7-4.4A8.2 8.2 0 0 1 3.6 11 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
                </svg>
                <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M5 3 2.5 5M19 3l2.5 2" />
                </svg>
              </span>
              <span class="wl-row-main">
                <span class="wl-row-name">{{ item.title }}</span>
                <span v-if="item.sub" class="wl-row-sub">
                  {{ item.sub }}
                  <i v-if="item.status === 'paused'" class="wl-row-flag">已暂停</i>
                  <i v-else-if="item.status === 'invalid'" class="wl-row-flag is-bad">已失效</i>
                </span>
              </span>
              <span class="wl-row-time">{{ item.pending ? '待首次执行' : timeAgo(item.ts) }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="wl-block">
        <header class="wl-block-head">
          <span class="wl-block-name">产出物</span>
          <span v-if="deliverables.length" class="wl-block-count">{{ deliverables.length }}</span>
        </header>
        <p v-if="!deliverables.length" class="wl-hint">还没有交付物。</p>
        <ul v-else class="wl-list">
          <li v-for="f in deliverables" :key="f.id">
            <div class="wl-file" :title="`来自「${f.from}」`">
              <span class="wl-file-ico">{{ f.icon }}</span>
              <span class="wl-row-main">
                <span class="wl-row-name">{{ f.name }}.{{ f.ext }}</span>
                <span class="wl-row-sub">{{ f.size }} · 来自「{{ f.from }}」</span>
              </span>
              <span class="wl-row-time">{{ timeAgo(f.ts) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useContactsStore } from '@/modules/contacts/store'
import { openEmployeeSchedule, openEmployeeThread } from '@/modules/contacts/actions'

defineOptions({ name: 'EmployeeWorkLogPane' })

const props = defineProps({
  employee: { type: Object, required: true },
})

const store = useContactsStore()
const loadingThreads = ref(false)

const activity = computed(() => store.activityOf(props.employee.id))
const deliverables = computed(() => store.deliverablesOf(props.employee.id))

/** 这栏是辅助信息，不做分页；多了只露最近 8 条 */
const visibleActivity = computed(() => activity.value.slice(0, 8))

watch(
  () => props.employee.id,
  async (id) => {
    if (!id) return
    loadingThreads.value = true
    try {
      await store.loadEmployeeThreads(id)
    } finally {
      loadingThreads.value = false
    }
  },
  { immediate: true },
)

/** 会话点进去继续聊，定时任务点开右侧的定时详情 —— 两种动态各回各家 */
function onOpen(item) {
  if (item.kind === 'chat') {
    openEmployeeThread(props.employee, item.raw)
    return
  }
  openEmployeeSchedule(item.raw)
}

/** 时间只在这栏用，没必要引第三方；各模块本来也是各写各的 */
function timeAgo(value) {
  if (!value) return ''
  const ts = typeof value === 'number' ? value : new Date(value).getTime()
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style lang="scss" scoped>
.wl-pane {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 12px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 16px;
  overflow-y: auto;
}

.wl-pane-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #2f3547;
}

/* 动态和产出物并排：接在效能下面，横向铺开比竖着堆更省高度 */
.wl-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

/* 窄了就回到上下堆叠 */
@container (max-width: 440px) {
  .wl-cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
}

.wl-block-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.wl-block-name {
  font-size: 12px;
  font-weight: 500;
  color: #6b7183;
}

.wl-block-count {
  padding: 0 6px;
  font-size: 11px;
  line-height: 16px;
  color: #6a5df0;
  background: #f0eeff;
  border-radius: 8px;
}

.wl-hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #a8b0c0;
}

.wl-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wl-row,
.wl-file {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  background: transparent;
  border: none;
  border-radius: 8px;
  text-align: left;
  box-sizing: border-box;
}

.wl-row {
  cursor: pointer;
}

.wl-row:hover,
.wl-file:hover {
  background: #f6f7fb;
}

/* 类型徽标：会话紫、定时橙 —— 混排里全靠它区分 */
.wl-row-ico {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
}

.wl-row-ico.is-chat {
  color: #6a5df0;
  background: #f0eeff;
}

.wl-row-ico.is-routine {
  color: #d97a1a;
  background: #fff3e2;
}

.wl-file-ico {
  flex: none;
  width: 24px;
  font-size: 15px;
  text-align: center;
}

.wl-row-main {
  flex: 1;
  min-width: 0;
}

.wl-row-name {
  display: block;
  font-size: 12.5px;
  color: #2f3547;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.wl-row-sub {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  color: #a8b0c0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.wl-row-flag {
  margin-left: 4px;
  padding: 0 4px;
  font-style: normal;
  font-size: 10px;
  color: #8a92a3;
  background: #f0f1f5;
  border-radius: 4px;
}

.wl-row-flag.is-bad {
  color: #c2410c;
  background: #ffece0;
}

.wl-row-time {
  flex: none;
  font-size: 11px;
  color: #a8b0c0;
}
</style>
