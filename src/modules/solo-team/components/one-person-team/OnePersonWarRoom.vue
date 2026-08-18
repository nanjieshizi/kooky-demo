<template>
  <section class="war-room" :class="{ 'is-interrupted': isInterruptedNow }">
    <header class="wr-head">
      <span class="wr-title">专项作战室</span>
      <button type="button" class="wr-close" aria-label="收起" @click="store.close()">✕</button>
    </header>

    <div v-if="!workers.length" class="wr-empty">暂无成员在岗作业<br>派了活才会有人上工位</div>

    <template v-else>
      <!-- 目标 + tab 一起框进橙色底盒（对齐设计稿 容器173014 rgba(255,241,234,0.5)）-->
      <div class="wr-topbox">
      <!-- 目标契约 banner -->
      <div v-if="activeTask && activeTask.title" class="wr-goal">
        <span class="wr-goal__ic">🎯</span>
        <span class="wr-goal__text">{{ activeTask.title }}</span>
      </div>

      <!-- Tab：全部任务 + 每个数字员工 -->
      <div class="wr-tabs">
        <button type="button" class="wr-tab wr-tab--all" :class="{ 'is-active': tab === 'all' }" @click="tab = 'all'">
          <span class="wr-tab__ic wr-tab__ic--img" aria-hidden="true">
            <img :src="allTasksIcon" alt="" draggable="false" />
          </span>
          <span class="wr-tab__name">全部</span>
          <span class="wr-tab__sub">执行计划总览</span>
        </button>
        <button
          v-for="w in workers"
          :key="w.id"
          type="button"
          class="wr-tab"
          :class="{ 'is-active': tab === w.id }"
          @click="tab = w.id"
        >
          <span class="wr-tab__av-wrap">
            <img class="wr-tab__av" :src="w.avatar || defaultAgentAvatar" alt="" @error="onAvatarError" />
            <span v-if="w.busy" class="wr-tab__spin" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            </span>
          </span>
          <span class="wr-tab__name">{{ w.name }}</span>
          <span class="wr-tab__status" :class="tabStatusKind(w)">
            <span class="wr-tab__status-ic" aria-hidden="true">{{ w.busy ? '⚡' : '☕' }}</span>{{ tabStatusLabel(w) }}
          </span>
        </button>
      </div>
      </div>

      <!-- 全部任务：总 + 分执行计划（带耗时） -->
      <div v-if="tab === 'all'" class="wr-plan">
        <div class="wr-plan__head">执行计划 <span class="wr-plan__count">{{ stepDone }}/{{ stepTotal }}</span> <span class="wr-plan__dur">总耗时 {{ fmtDuration(totalDuration) }}</span></div>
        <div v-for="w in workers" :key="w.id" class="wr-step" :class="{ 'is-open': openSteps.has(w.id) }">
          <button type="button" class="wr-step__head" @click="toggleStep(w.id)">
            <span class="wr-step__mark" :class="statusKind(w)">
              <svg v-if="w.done" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else-if="w.busy" class="wr-step__sync" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a9bff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
              <span v-else class="wr-step__dot"></span>
            </span>
            <span class="wr-step__title">{{ w.taskName || w.name }}</span>
            <span class="wr-step__who"><img :src="w.avatar || defaultAgentAvatar" alt="" @error="onAvatarError" />{{ w.name }}</span>
            <span class="wr-step__dur">{{ durationLabel(w) }}</span>
            <svg class="wr-step__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0c4cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div v-if="openSteps.has(w.id)" class="wr-step__body">
            <div v-if="!w.todos.length" class="wr-substep wr-substep--empty">还没开始，暂无子步骤</div>
            <div v-for="(t, i) in w.todos" :key="i" class="wr-substep" :class="t.status">
              <span class="wr-substep__dot"></span>
              <span class="wr-substep__text">{{ t.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 某个数字员工：具体工作流输出 -->
      <div v-else class="wr-flow">
        <div v-if="focusWorker" class="wr-flow-head">
          <img :src="focusWorker.avatar || defaultAgentAvatar" alt="" class="wr-flow-head__av" @error="onAvatarError" />
          <span class="wr-flow-head__name">{{ focusWorker.name }}</span>
          <span class="wr-flow-head__badge" :class="statusKind(focusWorker)">{{ statusText(focusWorker) }}</span>
          <button v-if="focusWorker.busy" type="button" class="wr-interrupt" :class="{ 'is-paused': isInterruptedNow }" @click="onToggleInterrupt">
            {{ isInterruptedNow ? '▶ 继续' : '‖ 打断' }}
          </button>
        </div>

        <div v-if="focusTrace" class="wr-flow-body">
          <div v-if="focusTrace.todos && focusTrace.todos.length" class="wr-todobox">
            <div v-for="(t, ti) in focusTrace.todos" :key="ti" class="wr-todo" :class="t.status">
              <span class="wr-todo__mark" aria-hidden="true">
                <svg v-if="t.status === 'completed'" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span v-else-if="t.status === 'in_progress'" class="wr-todo__spin"></span>
              </span>
              <span class="wr-todo__text">{{ t.content }}</span>
            </div>
          </div>
          <div class="wr-transcript">
            <template v-for="(e, ei) in (focusTrace.entries || [])" :key="ei">
              <p v-if="e.type === 'reasoning'" class="wr-tr-reason">{{ e.text }}</p>
              <div v-else class="wr-tr-tool">
                <button type="button" class="wr-tr-tool__row" @click="toggleTool(ei)">
                  <span class="wr-tr-tool__ic">{{ toolIcon(e.name) }}</span>
                  <span class="wr-tr-tool__name">{{ e.name }}</span>
                  <span class="wr-tr-tool__chev">{{ openTools.has(ei) ? '▾' : '▸' }}</span>
                </button>
                <div v-if="openTools.has(ei)" class="wr-tr-tool__body">
                  <div v-if="e.args" class="wr-tr-tool__args">{{ e.args }}</div>
                  <div v-if="e.result" class="wr-tr-tool__res">→ {{ e.result }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="wr-flow-hint">这位还没开始干活{{ focusWorker && focusWorker.mood ? `，正在${focusWorker.mood.text} ${focusWorker.mood.emoji}` : '～' }}</div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import allTasksIcon from '@/assets/soloTeam/all-tasks.png'
import { useSoloTeamStore } from '../../store'
import { demoState, getExecTrace, isInterrupted, toggleInterrupt, staticTasks } from '../../demo/onePersonDirector'

defineOptions({ name: 'OnePersonWarRoom' })

const store = useSidePanelStore()
const soloTeamStore = useSoloTeamStore()
const teamId = computed(() => (soloTeamStore.currentTeamId ? String(soloTeamStore.currentTeamId) : ''))

const MOODS = [
  { emoji: '🐟', text: '摸鱼中' }, { emoji: '🐱', text: '云吸猫' }, { emoji: '☕', text: '泡茶歇会儿' },
  { emoji: '📺', text: '追个番' }, { emoji: '💭', text: '放空发呆' }, { emoji: '🛒', text: '逛购物 App' },
  { emoji: '🎧', text: '戴耳机听歌' }, { emoji: '💤', text: '打个小盹' },
]
function moodFor(id) {
  const n = String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return MOODS[n % MOODS.length]
}

const activeTask = computed(() => {
  if (String(demoState.teamId) === teamId.value && demoState.taskObj) {
    return { taskId: demoState.taskId, participants: demoState.taskObj.participants || [], title: demoState.taskObj.title || '' }
  }
  const st = staticTasks[teamId.value]
  return st ? { taskId: st.id, participants: st.participants || [], title: st.title || '' } : null
})

const workers = computed(() => {
  const t = activeTask.value
  if (t) {
    return (t.participants || []).map((p) => {
      const id = String(p.agent_id ?? p.id ?? '')
      const tr = getExecTrace(t.taskId, p.agent_id ?? p.id)
      const busy = Boolean(tr?.busy); const done = Boolean(tr?.done)
      const todos = Array.isArray(tr?.todos) ? tr.todos : []
      const doneCount = todos.filter((x) => x.status === 'completed').length
      return {
        id, name: p.name || '数字员工', avatar: p.avatar, taskName: p.taskName || '',
        busy, done, mood: (!busy && !done) ? moodFor(id) : null,
        todos, doneCount, totalCount: todos.length,
        duration: Number(tr?.duration) || (done ? 30 : busy ? 5 : 0),
      }
    }).filter((w) => w.id)
  }
  const team = (soloTeamStore.onePersonTeams || []).find((t2) => String(t2.id ?? t2.teamId) === teamId.value)
  return (Array.isArray(team?.members) ? team.members : [])
    .filter((m) => String(m.agent_id ?? m.id) !== '9001')
    .map((m) => { const id = String(m.agent_id ?? m.id ?? ''); return { id, name: m.name || '数字员工', avatar: m.avatar, taskName: '', busy: false, done: false, mood: moodFor(id), todos: [], doneCount: 0, totalCount: 0, duration: 0 } })
    .filter((w) => w.id)
})

// Tab 状态
const tab = ref('all')
const focusWorker = computed(() => workers.value.find((w) => w.id === tab.value) || null)
const focusTrace = computed(() => (tab.value !== 'all' && activeTask.value ? getExecTrace(activeTask.value.taskId, tab.value) : null))

// 执行计划总览：步骤展开态
const openSteps = ref(new Set())
function toggleStep(id) {
  const s = new Set(openSteps.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  openSteps.value = s
}
// 任务流转到某个数字员工执行时，自动展开他那一步（并收起上一个刚忙完的），无需手动点
const busyWorkerId = computed(() => workers.value.find((w) => w.busy)?.id || null)
watch(busyWorkerId, (id, prev) => {
  const s = new Set(openSteps.value)
  if (prev && prev !== id) s.delete(prev)
  if (id) s.add(id)
  openSteps.value = s
}, { immediate: true })
const stepDone = computed(() => workers.value.filter((w) => w.done).length)
const stepTotal = computed(() => workers.value.length)
const totalDuration = computed(() => workers.value.reduce((s, w) => s + (Number(w.duration) || 0), 0))
function fmtDuration(s) {
  const n = Number(s) || 0
  if (n < 60) return `${n}s`
  const m = Math.floor(n / 60); const r = n % 60
  return r ? `${m}m${r}s` : `${m}m`
}
function durationLabel(w) {
  if (w.done) return `耗时 ${fmtDuration(w.duration)}`
  if (w.busy) return `已处理 ${fmtDuration(w.duration)}`
  return '未开始'
}

// 工具行展开 + 图标
const openTools = ref(new Set())
function toggleTool(i) {
  const s = new Set(openTools.value)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  openTools.value = s
}
function toolIcon(name) {
  const n = String(name || '').toLowerCase()
  if (/read|读/.test(n)) return '📖'
  if (/write|写|生成|doc/.test(n)) return '✍️'
  if (/query|table|数据|bitable/.test(n)) return '📊'
  if (/file|文件|查看/.test(n)) return '📄'
  return '🔧'
}

function statusKind(w) { return w.busy ? 'busy' : w.done ? 'done' : 'idle' }
function statusText(w) { return w.busy ? '执行中' : w.done ? '已完成' : '待命' }
// 数字人 tab 状态：只区分 干活中 / 等待中（对齐设计稿——无「已完成」，done 也归等待中）
function tabStatusKind(w) { return w.busy ? 'busy' : 'idle' }
function tabStatusLabel(w) { return w.busy ? '干活中' : '等待中' }
function statusLabel(w) {
  if (w.busy) return '全力干活中'
  if (w.done) return '已完成'
  return w.mood ? `${w.mood.emoji} 摸鱼等待中` : '摸鱼等待中'
}

const isInterruptedNow = computed(() => isInterrupted(teamId.value))
function onToggleInterrupt() { toggleInterrupt(teamId.value) }

function onAvatarError(e) { if (e?.target) e.target.src = defaultAgentAvatar }
</script>

<style scoped>
.war-room { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #fff; }

.wr-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #fff; border-bottom: 0.5px solid #f0f1f5; }
.wr-title { font-size: 14px; font-weight: 700; letter-spacing: 0.02em; color: #ff5a1f; }
.wr-close { border: none; background: rgba(47, 53, 71, 0.06); color: #8b7d75; width: 22px; height: 22px; border-radius: 6px; cursor: pointer; font-size: 12px; }
.wr-close:hover { background: rgba(47, 53, 71, 0.1); }
.wr-empty { text-align: center; font-size: 12px; color: #a99a92; line-height: 1.7; padding: 30px 0; }

/* 目标契约 banner */
/* 橙色底盒：把「目标 banner + tab 条」框成一个区域（对齐设计稿 容器173014）*/
.wr-topbox { flex-shrink: 0; margin: 8px 12px 4px; border-radius: 10px; background: rgba(255, 241, 234, 0.5); overflow: hidden; }
.wr-goal { flex-shrink: 0; display: flex; align-items: center; gap: 6px; margin: 12px 14px 8px; padding: 0; }
.wr-goal__ic { flex-shrink: 0; font-size: 15px; line-height: 1; }
.wr-goal__text { font-size: 12px; font-weight: 400; color: #2f3547; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Tab 行 */
/* tab 条底色：橙盒内叠一层淡青渐变（对齐设计稿 矩形150031，无下边框）*/
.wr-tabs { flex-shrink: 0; display: flex; gap: 8px; padding: 4px 12px 12px; overflow-x: auto; background: linear-gradient(270deg, rgba(255, 255, 255, 0) 5%, rgba(215, 255, 255, 0.16) 12%); }
/* tab = 96×81：白卡片(::before)只占下方 69px，顶部留 12px 让 icon/头像露出卡片一点点（对齐设计稿 矩形150198 y=12 / 容器173317 y=0）*/
.wr-tab { flex-shrink: 0; position: relative; width: 96px; height: 81px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; border: none; background: transparent; cursor: pointer; }
.wr-tab::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 69px; border: 1px solid rgba(47,53,71,0.06); border-radius: 8px; background: #fff; z-index: 0; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.wr-tab:hover::before { box-shadow: 0 2px 8px rgba(31,35,41,0.06); }
.wr-tab.is-active::before { border-color: #ff621f; box-shadow: 0 2px 10px rgba(255,98,31,0.12); }
.wr-tab > * { position: relative; z-index: 1; }
.wr-tab__ic { width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #ffe9df; color: #ff621f; }
.wr-tab__ic--img { background: transparent; overflow: hidden; }
.wr-tab__ic--img img { width: 100%; height: 100%; object-fit: contain; border-radius: 10px; }
.wr-tab__av { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; display: block; }
/* 干活的人头像右上角：蓝色转圈徽标 */
.wr-tab__av-wrap { position: relative; width: 32px; height: 32px; }
.wr-tab__spin { position: absolute; top: -2px; right: -2px; width: 13px; height: 13px; border-radius: 50%; background: #3490f9; border: 1.5px solid #fff; display: flex; align-items: center; justify-content: center; }
.wr-tab__spin svg { width: 8px; height: 8px; animation: wr-tab-spin 1s linear infinite; }
@keyframes wr-tab-spin { to { transform: rotate(360deg); } }
.wr-tab__name { font-size: 13px; font-weight: 400; color: #2f3547; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-tab.is-active .wr-tab__name { font-weight: 500; }
/* 全部 tab 副标题（纯文字）；数字人 tab 状态（药丸：干活中蓝 / 等待中紫，两态） */
.wr-tab__sub { font-size: 11px; color: #767676; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-tab__status { display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 6px; border-radius: 10px; font-size: 12px; max-width: 100%; white-space: nowrap; }
.wr-tab__status-ic { font-size: 11px; line-height: 1; }
.wr-tab__status.busy { color: #436ff6; }
.wr-tab__status.idle { color: #a070ff; }

/* 全部任务：执行计划 */
.wr-plan { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px 16px; }
.wr-plan__head { font-size: 13px; font-weight: 600; color: #2f3547; margin-bottom: 12px; }
.wr-plan__count { display: inline-flex; align-items: center; padding: 1px 9px; border-radius: 999px; background: #fff1ea; color: #ff5a1f; font-size: 12px; font-weight: 700; }
.wr-plan__dur { color: #a4aab8; font-weight: 400; margin-left: 4px; }
.wr-step { border-bottom: 0.5px solid #f0f1f5; }
.wr-step:last-child { border-bottom: none; }
.wr-step__head { display: flex; align-items: center; gap: 9px; width: 100%; padding: 11px 2px; border: none; background: transparent; cursor: pointer; text-align: left; }
.wr-step__mark { width: 18px; height: 18px; flex-shrink: 0; border-radius: 50%; border: 2px solid #d1d5db; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
.wr-step__mark.done { border-color: #22c55e; background: #22c55e; }
.wr-step__mark.busy { border: none; }
.wr-step__dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d5db; }
.wr-step__sync { animation: wr-spin 1.2s linear infinite; }
@keyframes wr-spin { to { transform: rotate(360deg); } }
/* 任务名不再撑满：只占内容宽（可收缩省略），让 chip+耗时紧跟其后左对齐（对齐设计稿图三） */
.wr-step__title { flex: 0 1 auto; min-width: 0; font-size: 13px; font-weight: 500; color: #2f3547; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-step__who { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #8b95a5; background: #f4f5f7; border-radius: 999px; padding: 2px 8px 2px 3px; }
.wr-step__who img { width: 16px; height: 16px; border-radius: 50%; object-fit: cover; }
.wr-step__dur { flex-shrink: 0; font-size: 11px; color: #a4aab8; }
/* chev 单独推到最右，name/耗时留在左侧一簇 */
.wr-step__chev { flex-shrink: 0; margin-left: auto; transition: transform 0.15s ease; }
.wr-step.is-open .wr-step__chev { transform: rotate(180deg); }
.wr-step__body { padding: 0 0 12px 27px; display: flex; flex-direction: column; gap: 7px; }
.wr-substep { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: #8c93a6; }
.wr-substep.completed { color: #2f3547; }
.wr-substep.in_progress { color: #436ff6; }
.wr-substep__dot { width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: #d1d5db; }
.wr-substep.completed .wr-substep__dot { background: #22c55e; }
.wr-substep.in_progress .wr-substep__dot { background: #436ff6; }
.wr-substep--empty { color: #b6bac4; font-size: 12px; }

/* 员工工作流 */
.wr-flow { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; }
.wr-flow-head { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.wr-flow-head__av { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.wr-flow-head__name { font-size: 15px; font-weight: 700; color: #2f3547; }
.wr-flow-head__badge { flex-shrink: 0; font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 6px; }
.wr-flow-head__badge.busy { color: #fff; background: #ff8a1f; }
.wr-flow-head__badge.done { color: #fff; background: #22c55e; }
.wr-flow-head__badge.idle { color: #8b95a5; background: #f1f3f6; }
.wr-interrupt { margin-left: auto; flex-shrink: 0; height: 30px; padding: 0 14px; border: 1px solid #ffbcbc; border-radius: 8px; background: #fff; color: #ff4d4f; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.wr-interrupt:hover { background: #fff1f1; }
.wr-interrupt.is-paused { border-color: #b7e4c7; color: #17a66a; background: #f0fbf4; }
.wr-flow-body { display: flex; flex-direction: column; gap: 12px; }
.wr-flow-hint { padding: 28px 16px; text-align: center; font-size: 12.5px; color: #a4aab8; line-height: 1.7; }

.wr-todobox { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; border-radius: 10px; background: #f7f8fa; }
.wr-todo { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: #8c93a6; }
.wr-todo.completed { color: #2f3547; }
.wr-todo.in_progress { color: #436ff6; }
.wr-todo__mark { width: 15px; height: 15px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1.5px solid #d1d5db; box-sizing: border-box; }
.wr-todo.completed .wr-todo__mark { border-color: #22c55e; background: #22c55e; color: #fff; }
.wr-todo.in_progress .wr-todo__mark { border-color: #436ff6; }
.wr-todo__spin { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #436ff6; border-top-color: transparent; animation: wr-spin 0.7s linear infinite; }
.wr-todo__text { min-width: 0; }

.wr-transcript { display: flex; flex-direction: column; gap: 10px; }
.wr-tr-reason { margin: 0; font-size: 13.5px; line-height: 1.75; color: #3a3f4a; white-space: pre-wrap; word-break: break-word; }
.wr-tr-tool { border: 1px solid #eceef2; border-radius: 8px; overflow: hidden; }
.wr-tr-tool__row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 11px; border: none; background: #f9fafb; cursor: pointer; text-align: left; transition: background 0.15s ease; }
.wr-tr-tool__row:hover { background: #f2f4f6; }
.wr-tr-tool__ic { font-size: 13px; flex-shrink: 0; }
.wr-tr-tool__name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; color: #4a5160; font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wr-tr-tool__chev { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
.wr-tr-tool__body { padding: 8px 11px; border-top: 1px solid #eceef2; font-size: 12px; color: #6b7280; }
.wr-tr-tool__args { font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace; word-break: break-all; }
.wr-tr-tool__res { margin-top: 5px; color: #17a66a; }

/* 中断态：在忙的 tab / 工作流头像描红 */
.war-room.is-interrupted .wr-tab.is-active { border-color: #ff4d4f; box-shadow: 0 0 0 1.5px rgba(255,77,79,0.4); }
</style>
