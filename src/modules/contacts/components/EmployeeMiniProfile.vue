<template>
  <div v-if="employee" class="emp-mini">
    <!-- 顶部装饰条 + 压在下沿的头像：跟生产那张真人名片同一个套路 -->
    <div class="emp-mini__banner" :class="{ 'is-assistant': employee.isAssistant }">
      <span class="emp-mini__status" :class="`is-${employee.busy}`">
        <i class="emp-mini__dot" />{{ employee.busyLabel }}
      </span>
    </div>

    <div class="emp-mini__body">
      <div class="emp-mini__head">
        <span class="emp-mini__ava-wrap" :class="{ 'is-assistant': employee.isAssistant }">
          <img v-if="employee.avatar" :src="employee.avatar" class="emp-mini__ava" alt="" />
          <span v-else class="emp-mini__ava emp-mini__ava--letter">{{ (employee.name || '?').slice(0, 1) }}</span>
        </span>
        <div class="emp-mini__id">
          <div class="emp-mini__name-row">
            <span class="emp-mini__name">{{ employee.name }}</span>
            <span v-if="employee.version" class="emp-mini__ver">{{ employee.version }}</span>
            <span v-if="employee.hasUpdate" class="emp-mini__upd" :title="`新版本 ${employee.latestVersion}`">可更新</span>
          </div>
          <!-- 履历行跟详情页页头一个口径：在岗多久 + 打哪来 -->
          <div class="emp-mini__meta">
            <span v-if="employee.onboardDays">在岗 {{ employee.onboardDays }} 天</span>
            <template v-if="employee.fromMarket">
              <i class="emp-mini__meta-dot" aria-hidden="true"></i>
              <button
                type="button"
                class="emp-mini__link"
                :title="`去市场看「${employee.sourceFrom}」`"
                @click="goMarket"
              >
                {{ employee.sourceFrom }}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
      <p class="emp-mini__desc">{{ employee.description }}</p>

      <!-- 只放员工自己有的东西：默认模型 + 已装技能。数字员工没有工号和岗位，别硬凑 -->
      <dl class="emp-mini__fields">
        <div class="emp-mini__field">
          <dt>模型</dt>
          <dd v-if="employee.model">{{ employee.model }}</dd>
          <dd v-else class="is-empty">-</dd>
        </div>
        <div class="emp-mini__field">
          <dt>Skill</dt>
          <dd v-if="employee.skillNames.length" class="emp-mini__skills">
            <span v-for="s in employee.skillNames" :key="s" class="emp-mini__skill">{{ s }}</span>
          </dd>
          <dd v-else class="is-empty">-</dd>
        </div>
      </dl>

      <div class="emp-mini__acts">
        <button type="button" class="emp-mini__btn emp-mini__btn--primary" @click="goManage">管理</button>
        <button type="button" class="emp-mini__btn" @click="onChat">新会话</button>
      </div>
    </div>
  </div>

  <div v-else class="emp-mini emp-mini--empty">这位不在「我的员工」里，看不到档案。</div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { useContactsStore } from '@/modules/contacts/store'
import { chatWithEmployee, openMarketAgent } from '@/modules/contacts/actions'
import { contactsBEmployeeNavKey } from '@/modules/navigation/config'

defineOptions({ name: 'EmployeeMiniProfile' })

const props = defineProps({
  /** 数字员工 agent_id；'assistant' 是助理的稳定别名 */
  agentId: { type: [String, Number], required: true },
})
const emit = defineEmits(['close'])

const router = useRouter()
const uiStore = useUIStore()
const store = useContactsStore()

const employee = computed(() => {
  const id = String(props.agentId ?? '')
  if (!id) return null
  // 'assistant' 是稳定别名（消息里分身常常不带 agentId）
  if (id === 'assistant') return store.assistant
  if (store.assistant && String(store.assistant.id) === id) return store.assistant
  return store.employees.find((e) => String(e.id) === id) || null
})

/** 来源链接：跳去市场看他那条原始数字人 */
function goMarket() {
  const e = employee.value
  if (!e?.marketAgentId) return
  emit('close')
  openMarketAgent(e.marketAgentId, router)
}

/** 跳去通讯录的整页管理（助理走 assistant 别名，不依赖真实 id） */
function goManage() {
  const e = employee.value
  if (!e) return
  const rid = e.isAssistant ? 'assistant' : e.id
  emit('close')
  uiStore.setActiveNavigation('contacts-b', contactsBEmployeeNavKey(rid))
  uiStore.expandSidebar()
  router.push(`/contacts-b/employee/${rid}`).catch(() => {})
}

function onChat() {
  if (!employee.value) return
  emit('close')
  chatWithEmployee(employee.value)
}

onMounted(() => {
  // 从个人模块点进来时通讯录可能还没被访问过，列表是空的
  store.loadEmployees()
})
</script>

<style lang="scss" scoped>
.emp-mini {
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}

.emp-mini--empty {
  padding: 14px;
  font-size: 12.5px;
  color: #a8b0c0;
}

/* 顶部装饰条：普通员工冷色、助理暖色（跟通讯录里那圈光环呼应） */
.emp-mini__banner {
  position: relative;
  height: 40px;
  background: linear-gradient(120deg, #dbe6ff 0%, #eae3ff 55%, #ffe6f0 100%);
}

.emp-mini__banner.is-assistant {
  background: linear-gradient(120deg, #ffe3c7 0%, #ffd9d0 45%, #e6ddff 100%);
}

.emp-mini__status {
  position: absolute;
  top: 9px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 21px;
  padding: 0 8px;
  font-size: 11px;
  color: #3d7a5a;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 999px;
}

.emp-mini__status.is-busy {
  color: #9a6210;
}

.emp-mini__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.emp-mini__status.is-busy .emp-mini__dot {
  background: #f59e0b;
}

/* 装饰条是 position:relative，会盖住没定位的 body —— 头像被压住就是这么来的。
   给 body 也定个位并抬一层，头像才压得回装饰条上面 */
.emp-mini__body {
  position: relative;
  z-index: 1;
  padding: 0 16px 14px;
}

/* 头像与名字同排，压在装饰条下沿 —— 别让头像独占一行把卡撑高 */
.emp-mini__head {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.emp-mini__ava-wrap {
  flex: none;
  display: inline-flex;
  margin-top: -22px;
  padding: 2.5px;
  border-radius: 14px;
  background: #fff;
  line-height: 0;
}

.emp-mini__id {
  flex: 1;
  min-width: 0;
  padding-bottom: 1px;
}

.emp-mini__ava-wrap.is-assistant {
  background: linear-gradient(135deg, #ffb35c, #ff7a59 55%, #7b61ff);
}

.emp-mini__ava {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  object-fit: cover;
  background: #f2f3f6;
}

.emp-mini__ava--letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #8478fa, #5b7fff);
}

.emp-mini__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.emp-mini__name {
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emp-mini__ver {
  flex: none;
  padding: 0 5px;
  font-size: 10px;
  line-height: 15px;
  color: #9aa0ad;
  background: #f4f5f9;
  border-radius: 5px;
}

.emp-mini__upd {
  flex: none;
  padding: 0 6px;
  font-size: 10px;
  line-height: 15px;
  color: #b26a00;
  background: #fff6e5;
  border: 1px solid #ffe0a3;
  border-radius: 5px;
}

.emp-mini__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 11.5px;
  color: #9aa0ad;
}

.emp-mini__meta-dot {
  width: 1px;
  height: 10px;
  background: #e6e8ee;
}

.emp-mini__link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  font-size: 11.5px;
  font-weight: 500;
  color: #6a5df0;
  background: none;
  border: none;
  cursor: pointer;
}

.emp-mini__link:hover {
  text-decoration: underline;
}

/* 档案字段：灰底一块，跟上面的文字拉开层次 */
.emp-mini__fields {
  margin: 11px 0 0;
  padding: 8px 10px;
  background: #f8f9fb;
  border-radius: 10px;
}

.emp-mini__field {
  display: flex;
  gap: 10px;
  padding: 3px 0;
}

.emp-mini__field dt {
  flex: none;
  width: 32px;
  font-size: 11.5px;
  color: #9aa0ad;
}

.emp-mini__field dd {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  color: #2f3547;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.emp-mini__field dd.is-empty {
  color: #c2c7d0;
}

/* 技能名做成小 chip，一行放不下就换行（值区不再限制单行） */
.emp-mini__field dd.emp-mini__skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  white-space: normal;
  overflow: visible;
}

.emp-mini__skill {
  padding: 1px 6px;
  font-size: 11px;
  line-height: 16px;
  color: #6a5df0;
  background: #f0eeff;
  border-radius: 5px;
}

.emp-mini__desc {
  margin: 9px 0 0;
  font-size: 12.5px;
  line-height: 19px;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.emp-mini__acts {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.emp-mini__btn {
  flex: 1;
  height: 32px;
  font-size: 12.5px;
  font-weight: 500;
  color: #2f3547;
  background: #f4f5f9;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.emp-mini__btn:hover {
  background: #eceef3;
}

.emp-mini__btn--primary {
  color: #fff;
  background: linear-gradient(135deg, #436ff6, #5b7fff);
  box-shadow: 0 3px 8px rgba(67, 111, 246, 0.24);
}

.emp-mini__btn--primary:hover {
  filter: brightness(1.06);
}
</style>

<!-- 非 scoped：popper 被 teleport 到 body，scoped 选择器打不到它。
     把它的内边距清零，装饰条才能真正顶满卡片（否则四周留一圈白）。 -->
<style>
.el-popover.emp-mini-popover {
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #eceef3;
  box-shadow: 0 10px 30px rgba(31, 36, 54, 0.12);
  min-width: 0;
}
</style>
