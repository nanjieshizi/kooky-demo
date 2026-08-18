<template>
  <section class="conversation-pane conversation-pane--main">
    <header class="conversation-head conversation-head--main">
      <div class="head-left">
        <h2 class="conversation-title">{{ conversationName }}</h2>
      </div>
      <div class="head-actions">
        <!-- 文件（左）+ 专项作战室（右）：胶囊按钮，带图标 / 文字 / 徽标 -->
        <button
          type="button"
          class="head-icon-btn"
          :class="{ 'is-active': sidePanelStore.activePanel === 'preview' }"
          title="文件"
          @click="sidePanelStore.toggle('preview')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7.5a2 2 0 0 1 2-2h3.2l1.6 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>
        <!-- solo：此位是「组建作战室」= 点开选人、拉人升级成群；group：就是打开/收起专项作战室面板 -->
        <button
          type="button"
          class="head-icon-btn"
          :class="{ 'is-active': isGroup && sidePanelStore.activePanel === 'office' }"
          :title="isGroup ? '专项作战室' : '组建作战室'"
          @click="isGroup ? sidePanelStore.toggle('office') : openInvite()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M14 4.5v15" />
          </svg>
          <span v-if="isGroup && busyCount" class="head-icon-btn__badge">{{ busyCount }}</span>
        </button>
      </div>
    </header>

    <!-- 数字人管理条（对齐设计稿三态）：成员头像(最多5+溢出) + 添加 + 右侧状态/进度 -->
    <!-- 空会话（开屏指引）时隐藏，发出首条消息后下滑出现 -->
    <transition name="team-bar-drop">
    <div v-if="!isConversationEmpty" class="team-bar">
      <div class="team-bar__members">
        <span
          v-for="m in stripMembers"
          :key="m.agentId"
          class="team-bar__av-wrap"
          :class="`is-${headerMemberStatus(m)}`"
          :title="m.name"
        >
          <img class="team-bar__av" :src="m.avatar" alt="" draggable="false" />
          <span class="team-bar__dot" aria-hidden="true"></span>
        </span>
        <button v-if="stripOverflow" type="button" class="team-bar__more" :title="stripOverflowNames">···</button>
        <button type="button" class="team-bar__add" title="添加数字人" @click="openManage">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <!-- 有任务：xxx 正在工作中 + 进度条（对应执行计划一级节点）-->
      <button v-if="activeTask && planProgress.total" type="button" class="team-bar__right team-bar__right--task" @click="openWarRoom">
        <span class="team-bar__status">{{ busyText }}</span>
        <div class="team-bar__track"><div class="team-bar__fill" :style="{ width: progressPct + '%' }"></div></div>
        <span class="team-bar__count">{{ planProgress.completed }}/{{ planProgress.total }}</span>
      </button>
      <!-- 无任务：缺省文案（group / solo 不同）-->
      <div v-else class="team-bar__right team-bar__idle">
        <span class="team-bar__fun">{{ stripHint }}</span>
      </div>
    </div>
    </transition>

    <!-- 主体：消息列表 + 输入（左列）；围观轨迹（右侧抽屉，点员工头像展开） -->
    <div class="main-body">
      <div class="main-conv-col">
        <OnePersonEmptyGuide v-if="isConversationEmpty" @pick="onPickScene" />
        <OnePersonMessageList
          v-else
          :loading="loading"
          :messages="mainThread ? messages : []"
          :thinking="mainThread ? thinking : false"
          :team-id="teamId"
          :thread-id="mainThread?.id || mainThread?.thread_id || mainThread?.threadId || ''"
          :has-more="hasMore"
          :loading-more="loadingMore"
          empty-text="团队主会话尚未创建"
          loading-text="正在加载团队会话…"
          @open-task="emit('open-task', $event)"
          @load-more="emit('load-more')"
        />

        <OnePersonComposer
          v-model="draft"
          :mention-members="mentionMembers"
          :disabled="!mainThread || sending"
          :disabled-text="sending ? '正在发送中…' : ''"
          placeholder="你可以输入任何你想做的事情"
          @submit="send"
        />
      </div>

    </div>

    <OnePersonInvitePanel
      v-if="showInvite"
      :team-id="teamId"
      :main-thread-id="mainThread?.id || mainThread?.thread_id || ''"
      :member-ids="allMembers.map((m) => m.agent_id)"
      :manage="true"
      title="成员管理"
      @close="showInvite = false"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Close } from '@element-plus/icons-vue'
import OnePersonComposer from './OnePersonComposer.vue'
import OnePersonMessageList from './OnePersonMessageList.vue'
import OnePersonEmptyGuide from './OnePersonEmptyGuide.vue'
import OnePersonInvitePanel from './OnePersonInvitePanel.vue'
import OnePersonTaskMemberStrip from './OnePersonTaskMemberStrip.vue'
import EmployeeChatReasoningBlock from '../EmployeeChatReasoningBlock.vue'
import EmployeeStreamToolCallCard from '../EmployeeStreamToolCallCard.vue'
import EmployeeTodoList from '../EmployeeTodoList.vue'
import ModuleAsideButtons from '@/modules/space/components/ModuleAsideButtons.vue'
import { useSoloTeamStore } from '../../store'
import { getExecTrace, demoState, emergedMembers, focusWorkMember, setSoloMode, isTeamUpgraded, removeMember, demoPendingInput } from '../../demo/onePersonDirector'
import crabIcon from '@/assets/crab-pixel.png'
import { useSidePanelStore } from '@/modules/space/sidePanelStore'
import { memberCardsFromDirector } from '../../demo/planFromDirector.mjs'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'

defineOptions({ name: 'MainConversationPane' })

const props = defineProps({
  loading: { type: Boolean, default: false },
  mainThread: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  sending: { type: Boolean, default: false },
  thinking: { type: Boolean, default: false },
  mentionMembers: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
  activeTaskId: { type: [String, Number], default: '' },
  openFileIds: { type: Array, default: () => [] },
  teamId: { type: [String, Number], default: '' },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
})

const emit = defineEmits(['send', 'open-task', 'open-file', 'dissolved', 'load-more'])
const soloTeamStore = useSoloTeamStore()
const draft = ref('')

// ── 演示：模拟真人打字（录 demo 用）──
// director 在「该用户发言」时发 demoFill 信号 → 这里把消息逐字敲进输入框，
// 用户随后自己点发送。无演示按钮 / 提示条，看不出是脚本。
let typingTimer = null
function typeIntoDraft(text) {
  if (typingTimer) { clearInterval(typingTimer); typingTimer = null }
  draft.value = ''
  let i = 0
  typingTimer = setInterval(() => {
    i += 1
    draft.value = text.slice(0, i)
    if (i >= text.length) { clearInterval(typingTimer); typingTimer = null }
  }, 55)
}
// 监听当前会话的「待模拟输入」；有内容就逐字敲进输入框，然后消费掉（清空防重复）。
// immediate:true → 组件挂载时若已有待填内容（例如回复期间发出的信号）也能补上。
watch(
  () => demoPendingInput[String(props.teamId)],
  (text) => {
    if (!text) return
    typeIntoDraft(text)
    demoPendingInput[String(props.teamId)] = ''
  },
  { immediate: true },
)
onBeforeUnmount(() => { if (typingTimer) { clearInterval(typingTimer); typingTimer = null } })

// 会话形态：group(多人群) 才露出成员头像 / 👥N / 目标条；solo(我 ⇄ 分身) 露出「拉人组队」
const isGroup = computed(() => isTeamUpgraded(props.teamId))
const showInvite = ref(false)
function openInvite() { showInvite.value = true }

// 拍平后：这条会话「当前正在做的任务」= 剧本活跃任务（承载成员/目标/plan/围观 trace 数据）
const activeTask = computed(() => {
  if (!demoState.active || String(demoState.teamId) !== String(props.teamId)) return null
  // 直接读 director 挂的 task 对象（含 participants/goal），绕过 getOnePersonTasks 的加载态陷阱
  return demoState.taskObj || null
})

// 团队全体固定成员（标题栏常驻缩略展示，隐性但可见）
const allMembers = computed(() => {
  // 用团队全员（team.members，不截断）——getOnePersonDisplayMembers 默认 limit=6 会截到 6 个
  const team = (soloTeamStore.onePersonTeams || []).find((t) => String(t.id ?? t.teamId) === String(props.teamId))
  const raw = Array.isArray(team?.members) ? team.members : []
  return raw
    .map((m) => ({
      agentId: String(m.agent_id ?? m.id ?? m.agentId ?? ''),
      id: m.id ?? m.agent_id,
      agent_id: m.agent_id ?? m.id,
      name: m.name || m.display_name || '数字员工',
      avatar: m.avatar || m.avatar_url || defaultAgentAvatar,
    }))
    .filter((m) => m.agentId)
})
const MAX_HEADER_AVATARS = 6
const visibleMembers = computed(() => allMembers.value.slice(0, MAX_HEADER_AVATARS))
const overflowCount = computed(() => Math.max(0, allMembers.value.length - MAX_HEADER_AVATARS))
const showAllMembers = ref(false)

// 标题栏头像状态：只有正在跑的任务里的成员显示忙/完成，其余常态绿点（隐性待命）
function headerMemberStatus(m) {
  const t = getExecTrace(activeTask.value?.id, m?.id) || getExecTrace(activeTask.value?.id, m?.agent_id)
  if (t) {
    if (t.busy) return 'busy'
    if (t.done) return 'done'
    return 'pending'
  }
  return 'idle'
}
function onHeaderMemberClick(m) {
  // 围观已移到员工消息里的工作卡片；标题栏头像只做出场/忙闲展示，点击暂不下钻
  void m
}

// 活跃成员 = 任务参与者 ∪ 被 @ 出场的（员工平时隐性，出场才在标题栏浮现头像）
const activeMembers = computed(() => {
  const out = []
  const seen = new Set()
  const add = (m) => {
    const id = String(m.agentId ?? m.agent_id ?? m.id ?? '')
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push({
      agentId: id,
      id: m.id ?? m.agent_id,
      agent_id: m.agent_id ?? m.id,
      name: m.name || m.display_name || '数字员工',
      avatar: m.avatar || m.avatar_url || defaultAgentAvatar,
    })
  }
  ;(assignees.value || []).forEach(add)
  const byId = new Map(allMembers.value.map((m) => [m.agentId, m]))
  ;(emergedMembers[String(props.teamId)] || []).forEach((id) => { const m = byId.get(String(id)); if (m) add(m) })
  return out
})
const visibleActiveMembers = computed(() => activeMembers.value.slice(0, MAX_HEADER_AVATARS))
const activeOverflow = computed(() => Math.max(0, activeMembers.value.length - MAX_HEADER_AVATARS))

const sidePanelStore = useSidePanelStore()
// 作战室徽标：当前在岗干活（busy）的员工数
const busyCount = computed(() => activeMembers.value.filter((m) => headerMemberStatus(m) === 'busy').length)

// 群态默认展开专项作战室（升级成群那一刻 / 进入群会话时自动开），solo 态则收起；用户仍可手动收起
watch(
  () => [String(props.teamId), isGroup.value],
  ([, group]) => {
    if (group) sidePanelStore.open('office')
    else if (sidePanelStore.activePanel === 'office') sidePanelStore.close()
  },
  { immediate: true },
)
function openRoster() {
  sidePanelStore.open('manage')
}

const assignees = computed(() => (Array.isArray(activeTask.value?.participants) ? activeTask.value.participants : []))
const goal = computed(() => String(activeTask.value?.goal || '').trim())
// 执行计划卡：只在剧本正演这个任务时露出
const demoPlan = computed(() => (activeTask.value && String(demoState.taskId) === String(activeTask.value.id) ? demoState.plan : null))
// 目标契约条：plan 步骤常驻展示（不再藏螃蟹浮层）
const planSteps = computed(() => demoPlan.value?.steps || [])
const planProgress = computed(() => demoPlan.value?.progress || { completed: 0, total: 0 })
const progressPct = computed(() => {
  const total = Number(planProgress.value.total) || 0
  return total ? Math.round((Number(planProgress.value.completed) || 0) / total * 100) : 0
})
// 点步骤芯片 → 去专项作战室看该步成员的工作流
function onStepClick(s) {
  if (s?.assignee != null && s.assignee !== '') focusWorkMember(props.teamId, s.assignee)
  sidePanelStore.open('office')
}
// 点目标契约条 → 打开右侧作战室（进度 / 步骤 / 各员工 todolist 都在那看）
function openWarRoom() {
  sidePanelStore.open('office')
}
// 团队成员条头像：优先花名册；花名册还没同步到就用当前任务参与者兜底
const barMembers = computed(() => {
  if (allMembers.value.length) return allMembers.value
  return (assignees.value || []).map((p) => ({ agentId: String(p.agent_id ?? p.id ?? ''), agent_id: p.agent_id, name: p.name || '数字员工', avatar: p.avatar || defaultAgentAvatar }))
})
// 标题下方团队成员条：点＋进成员管理界面
function openManage() { showInvite.value = true }
// 无任务时右侧随机趣味文案（配小蟹）
const FUN_TEXTS = ['团队都在摸鱼，随时待命 🐟', '大伙儿正喝茶等你派活 ☕', '一群数字人围观等开工 👀', '闲着也是闲着，快给点活干 😏', '团队已就位，就等你一句话 🚀']
const funText = FUN_TEXTS[Math.floor(Math.random() * FUN_TEXTS.length)]
// 有任务时右侧：xxx 正在工作中（取当前在忙的员工名）
const busyText = computed(() => {
  const tid = activeTask.value?.id
  const busy = (assignees.value || []).find((p) => getExecTrace(tid, p.agent_id ?? p.id)?.busy)
  if (busy) return `${busy.name} 正在工作中…`
  const running = (planSteps.value || []).find((s) => s.status === 'running')
  return running ? `${running.title} 进行中…` : '团队协作推进中…'
})
// —— 标题 = 会话名称（不再写死「会话」）——
const conversationName = computed(() => {
  const team = (soloTeamStore.onePersonTeams || []).find((t) => String(t.id ?? t.teamId) === String(props.teamId))
  return team?.name || '会话'
})
// —— 数字人管理条：solo=单头像 / group=最多 5 + 溢出「…」；右侧三态文案（对齐设计稿）——
const STRIP_MAX = 5
const stripMembers = computed(() => {
  const list = barMembers.value.slice(0, STRIP_MAX)
  return list.length ? list : [{ agentId: '9001', name: '我的分身', avatar: crabIcon }]
})
const stripOverflow = computed(() => Math.max(0, barMembers.value.length - STRIP_MAX))
const stripOverflowNames = computed(() => barMembers.value.slice(STRIP_MAX).map((m) => m.name).join('、'))
const stripHint = computed(() => (isGroup.value ? '指令一到，立马开工~' : '复杂任务添加多个数字人组队完成更高效哦~'))

const demoMemberCards = computed(() => memberCardsFromDirector(assignees.value, memberStatus))

const membersExpanded = ref(false)
const planVisible = ref(false)

// 围观：点成员头像 → 右侧抽屉展开该成员只读执行轨迹
const activeTrace = ref(null)
const selectedMemberId = computed(() => (activeTrace.value ? String(activeTrace.value.agent_id ?? activeTrace.value.id) : ''))

function onOpenMember(card) {
  const m = assignees.value.find((x) => String(x.agent_id ?? x.id) === String(card?.agentId))
  if (m) toggleTrace(m)
}

function toggleTrace(member) {
  const key = (m) => String(m?.agent_id ?? m?.id ?? '')
  activeTrace.value = activeTrace.value && key(activeTrace.value) === key(member) ? null : member
}

const liveTrace = computed(() => {
  const m = activeTrace.value
  if (!m || !activeTask.value) return null
  const tid = activeTask.value.id
  return getExecTrace(tid, m.id) || getExecTrace(tid, m.agent_id) || getExecTrace(tid, m.agentId)
})

// 成员状态：优先读剧本 trace（busy=执行中 / done=已完成 / 其余=待执行），无则回退任务是否在执行
function memberStatus(member) {
  const t = getExecTrace(activeTask.value?.id, member?.id) || getExecTrace(activeTask.value?.id, member?.agent_id)
  if (t) {
    if (t.busy) return 'busy'
    if (t.done) return 'done'
    return 'pending'
  }
  return props.thinking || activeTask.value?.status === 'active' ? 'busy' : 'idle'
}

function send(payload) {
  emit('send', payload)
  draft.value = ''
}

// 新会话（无消息）显示引导页；点场景卡 = 把 prompt 发进会话
const isConversationEmpty = computed(() => !props.mainThread || !(props.messages || []).length)
function onPickScene(scene) {
  // 「做份 PRD」标了 solo → 分身单干模式（不组队不派人）
  if (scene?.solo) setSoloMode(props.teamId, true)
  // 点场景卡 = 选用预制 prompt，直接整段填入输入框（不流式打字——不是真人在敲，流式反而假），
  // 用户自己点发送才开始走剧本。（会话中途的澄清答复才用模拟打字）
  if (typingTimer) { clearInterval(typingTimer); typingTimer = null }
  draft.value = scene?.prompt || String(scene || '')
}
</script>

<style scoped>
.conversation-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 8px 8px, rgba(255, 183, 180, 0.24) 1.2px, transparent 1.4px) 0 0 / 22px 22px,
    #fff;
  border-radius: 12px;
}

.conversation-head {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #2f3547;
}

.conversation-title {
  margin: 0;
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  display: flex;
  align-items: center;
  color: #2f3547;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 顶部功能按钮：纯图标 28×28、圆角 8，hover/激活 #F5F6F9（对齐 MasterGo button-top） */
.head-icon-btn {
  position: relative;
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px; background: transparent; color: #2f3547;
  cursor: pointer; flex-shrink: 0; transition: background 0.15s ease, color 0.15s ease;
}
.head-icon-btn svg { width: 18px; height: 18px; }
.head-icon-btn:hover { background: #f5f6f9; }
.head-icon-btn.is-active { background: #f5f6f9; color: #2f3547; }
.head-icon-btn__badge {
  position: absolute; top: -3px; right: -3px;
  min-width: 15px; height: 15px; padding: 0 3px;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, #ff9a3d, #ff621f);
}

.main-member-strip {
  flex-shrink: 0;
}

/* 标题下方：团队成员条（可增删）+ 进度 */
/* 数字人管理条：底板 = 三色渐变 @8%，高 36，圆角 10（对齐 MasterGo 数字人管理条状态 frame） */
.team-bar {
  flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  height: 36px; box-sizing: border-box;
  margin: 0 0 8px; padding: 0 16px;
  border-radius: 0;
  /* 去掉原彩色渐变底 + 标题↔头像之间的线；头像+进度条下方保留一条区隔线，把 header 区域与正文分开（对齐设计稿 矩形149885）*/
  border-bottom: 1px solid #f0f1f5;
}
.team-bar__members { display: flex; align-items: center; flex-shrink: 0; }
.team-bar__av-wrap { position: relative; margin-left: -5px; flex-shrink: 0; }
.team-bar__av-wrap:first-child { margin-left: 0; }
.team-bar__av { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid #fff; background: #f0f1f4; display: block; }
/* 常态无小点；仅「正在工作」的头像挂蓝色执行中徽标 */
.team-bar__dot { display: none; position: absolute; right: -1px; bottom: -1px; width: 9px; height: 9px; border-radius: 50%; background: #3490f9; border: 1.5px solid #fff; }
.team-bar__av-wrap.is-busy .team-bar__dot { display: block; }
.team-bar__more {
  width: 24px; height: 24px; margin-left: 3px; flex-shrink: 0;
  border: none; border-radius: 50%; background: #fff; color: #91949e;
  font-size: 12px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.team-bar__add {
  width: 24px; height: 24px; margin-left: 6px; flex-shrink: 0;
  border: none; border-radius: 50%; background: #fff; color: #91949e; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.08); transition: color 0.15s ease;
}
.team-bar__add:hover { color: #ff6a2b; }
.team-bar__add svg { width: 13px; height: 13px; }

/* 右侧：有任务 = 状态 + 进度条(橙渐变) 紧凑成组（对齐设计稿 324px 右侧块，不甩到最右）；无任务 = 缺省文案 */
.team-bar__right { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; }
.team-bar__right--task { border: none; background: transparent; cursor: pointer; padding: 0; }
/* 状态文案靠左；进度条+计数靠右（margin-left:auto），中间自然留空（对齐设计稿 132:20706）*/
.team-bar__status { flex-shrink: 1; font-size: 11px; color: #91949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 进度条：轨道 100×10 灰底 #ECEEF3，填充橙色渐变（对齐设计稿 132:20705 新样式）*/
/* 轨道 100×10 灰底 #ECEEF3、右对齐；填充细条 6px 内缩 2px（药丸套药丸，露灰边）— 对齐设计稿 */
.team-bar__track { flex: 0 0 100px; margin-left: auto; min-width: 0; height: 10px; border-radius: 5px; background: #ECEEF3; box-sizing: border-box; padding: 2px; overflow: hidden; }
.team-bar__fill { height: 6px; border-radius: 999px; background: linear-gradient(270deg, #FF621F 0%, rgba(255, 98, 31, 0.5) 100%); transition: width 0.4s ease; }
.team-bar__count { flex-shrink: 0; font-size: 12px; font-weight: 600; color: #3d3d3d; }
/* 空态→有会话：横条从上方下滑淡入 */
.team-bar-drop-enter-active { transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease; }
.team-bar-drop-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.team-bar-drop-enter-from { transform: translateY(-12px); opacity: 0; }
.team-bar-drop-leave-to { transform: translateY(-8px); opacity: 0; }
.team-bar__idle { justify-content: flex-end; }
.team-bar__fun { font-size: 11px; color: #91949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 目标契约条：目标 + 进度 + 横排步骤芯片 */
.goal-bar {
  flex-shrink: 0;
  display: block;
  width: calc(100% - 32px);
  margin: 0 16px 8px;
  padding: 12px 14px;
  text-align: left;
  background: linear-gradient(180deg, #fff6f0, #fffdfc);
  border: 0.5px solid #ffe3d3;
  border-radius: 14px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.goal-bar:hover { border-color: #ffcaa8; box-shadow: 0 4px 14px rgba(255, 120, 60, 0.12); }
.goal-bar__top { display: flex; align-items: center; gap: 8px; }
.goal-bar__crab { width: 26px; height: 26px; flex-shrink: 0; }
.goal-bar__label { font-size: 12px; font-weight: 600; color: #ff621f; flex-shrink: 0; }
.goal-bar__text {
  flex: 1; min-width: 0; font-size: 13px; color: #2f3547;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* 头像轮播：参与员工头像叠排在目标右侧 + 轻微起伏，表示"他们正在干这件事" */
.goal-carousel__avatars { display: flex; align-items: center; flex-shrink: 0; margin-left: auto; padding-left: 10px; }
.goal-carousel__av {
  width: 24px; height: 24px; border-radius: 50%; object-fit: cover;
  border: 1.5px solid #fff; margin-left: -7px; background: #f0f1f4;
  animation: goal-wave 1.5s ease-in-out infinite;
}
.goal-carousel__av:first-child { margin-left: 0; }
@keyframes goal-wave {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(-3px); }
}
/* 和头像联动的总进度条（目标右侧） */
.goal-progress { flex-shrink: 0; display: flex; align-items: center; gap: 7px; margin-left: 10px; }
.goal-progress__track { width: 72px; height: 5px; border-radius: 999px; background: #ffe3d3; overflow: hidden; }
.goal-progress__fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ff9a3d, #ff621f); transition: width 0.4s ease; }
.goal-progress__count { font-size: 12px; font-weight: 600; color: #ff7d00; }

/* 标题栏群成员缩略头像堆 */
.team-avatars {
  position: relative;
  display: flex;
  align-items: center;
  margin-right: 6px;
}
.team-avatar {
  position: relative;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  margin-left: -6px;
  transition: transform 0.15s ease;
}
.team-avatar:first-child { margin-left: 0; }
.team-avatar:hover { transform: translateY(-1px); z-index: 5; }
.team-avatar__img {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #fff;
  background: #fff;
  box-sizing: border-box;
}
.team-avatar--selected .team-avatar__img { border-color: #ff621f; }
.team-avatar__dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: #c0c4cc;
}
.team-avatar__dot--busy { background: #ff621f; }
.team-avatar__dot--idle { background: #07c160; }
.team-avatar__dot--done { background: #c0c4cc; }
.team-avatar__dot--pending { background: #c0c4cc; }
.team-avatar-more {
  min-width: 26px;
  height: 26px;
  padding: 0 7px;
  margin-left: -6px;
  border: 1.5px solid #fff;
  border-radius: 999px;
  background: #eef0f4;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  z-index: 6;
}
.team-avatar-more:hover { background: #e3e6ec; }
.team-avatar-more--static {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.team-roster-entry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border: 0.5px solid #e5e7eb;
  border-radius: 999px;
  background: #f5f6f9;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.team-roster-entry:hover,
.team-roster-entry.is-open {
  background: #eceef3;
  color: #2f3547;
}

/* 全员抽屉浮窗 */
.team-roster-wrap { position: relative; display: inline-flex; }
.team-roster-drawer {
  position: absolute;
  top: 32px;
  left: 0;
  z-index: 120;
  width: 224px;
  max-height: 340px;
  overflow-y: auto;
  padding: 8px;
  background: #fff;
  border: 0.5px solid #eceef3;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(31, 35, 41, 0.14);
}
.trd-head {
  padding: 4px 8px 8px;
  font-size: 12px;
  color: #8c93a6;
  border-bottom: 0.5px solid #f0f1f5;
  margin-bottom: 4px;
}
.trd-list { display: flex; flex-direction: column; }
.trd-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
}
.trd-item:hover { background: #f5f6f9; }
.trd-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.trd-name {
  flex: 1; min-width: 0; font-size: 13px; color: #2f3547;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.trd-dot { position: static; border: none; flex-shrink: 0; }
.roster-drawer-enter-active, .roster-drawer-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.roster-drawer-enter-from, .roster-drawer-leave-to { opacity: 0; transform: translateY(-6px); }
.team-roster-pop {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 100;
  width: 210px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.12);
}
.team-roster-pop__title {
  padding: 4px 8px 6px;
  font-size: 12px;
  color: #8c93a6;
}
.team-roster-pop__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.team-roster-pop__item:hover { background: #f5f6f9; }
.team-roster-pop__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.team-roster-pop__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 13px;
  color: #2f3547;
}
.team-roster-pop__item .team-avatar__dot {
  position: static;
  border: none;
  flex-shrink: 0;
}

/* 成员条从顶部下滑出现 */
.member-strip-slide-enter-active,
.member-strip-slide-leave-active {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
}
.member-strip-slide-enter-from,
.member-strip-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* 主体：会话列 + 围观抽屉 */
.main-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.main-conv-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trace-drawer {
  flex-shrink: 0;
  width: 340px;
  max-width: 42%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #eceef3;
  box-shadow: -6px 0 20px rgba(31, 35, 41, 0.06);
}

/* 围观抽屉右侧滑入 */
.trace-drawer-slide-enter-active,
.trace-drawer-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease;
}
.trace-drawer-slide-enter-from,
.trace-drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.exec-trace-head {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #f0f1f5;
}

.exec-trace-title {
  font-size: 13px;
  font-weight: 500;
  color: #2f3547;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exec-trace-readonly {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #8b95a5;
  background: #f1f3f6;
}

.trace-close-btn {
  margin-left: auto;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #91949e;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.trace-close-btn:hover {
  background: rgba(47, 53, 71, 0.06);
  color: #2f3547;
}

.exec-trace-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exec-trace-hint {
  font-size: 12px;
  color: #a4aab8;
  padding: 4px 2px;
}
</style>
