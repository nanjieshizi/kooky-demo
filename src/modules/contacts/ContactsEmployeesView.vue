<template>
  <section class="ce-page">
    <header class="ce-head">
      <div class="ce-head-main">
        <h2 class="ce-title">我的员工</h2>
        <p class="ce-sub">你的助理 + 雇来的 {{ store.employees.length }} 位员工，都归你调教。</p>
      </div>
      <div class="ce-head-right">
        <input
          class="ce-search"
          type="text"
          placeholder="搜索员工、技能"
          :value="store.keyword"
          @input="store.setKeyword($event.target.value)"
        />
        <button type="button" class="ce-create" @click="showCreateDialog = true">新建数字员工</button>
      </div>
    </header>

    <div class="ce-body">
      <div v-if="loading" class="ce-hint">正在拉花名册…</div>

      <!-- 助理本体：整条 hero，不进网格（样式 vendor 自「我的资产」的 twin-card）；搜索时也常驻 -->
      <template v-if="!loading && store.assistant">
        <div class="sec-label">
          <span class="sec-bar" />我的助理
          <span class="sec-note">本体 · 唯一</span>
        </div>
        <div class="twin-card" @click="onManage(store.assistant)">
          <div class="twin-glow" />
          <div class="twin-ava">
            <img v-if="store.assistant.avatar" :src="store.assistant.avatar" alt="" />
            <span v-else>{{ initial(store.assistant.name) }}</span>
          </div>
          <div class="twin-info">
            <div class="twin-name">
              {{ store.assistant.name }}
              <span class="twin-badge">本体 · 唯一</span>
            </div>
            <div class="twin-desc">{{ store.assistant.description }}</div>
            <div class="twin-meta">
              {{ store.assistant.memoryCount }} 条记忆 · 已开 {{ store.assistant.skillEnabled }}/{{ store.assistant.skillTotal }} 个技能 · 天生在岗，不可解聘
            </div>
          </div>
          <div class="twin-actions">
            <button type="button" class="act act-primary" @click.stop="onChat(store.assistant)">💬 对话</button>
            <button type="button" class="act act-ghost" @click.stop="onManage(store.assistant)">⚙ 配置</button>
          </div>
        </div>

        <div class="sec-label sec-label-2">
          <span class="sec-bar" />我雇来的员工
          <span class="sec-note">点开谁，就能改他的岗位、性格、记忆和技能</span>
        </div>
      </template>

      <div v-if="!loading && !store.visibleEmployees.length" class="ce-hint">
        {{ store.employees.length ? '没有符合条件的员工，换个关键词试试。' : '还没雇人。去市场挑一个，或者直接新建。' }}
      </div>

      <div v-else-if="!loading" class="ce-grid" :class="{ 'ce-grid--squeezed': manageOpen }">
        <article
          v-for="e in store.visibleEmployees"
          :key="e.id"
          class="emp-card"
          @click="onManage(e)"
        >
          <!-- 头像结构对齐市场 AvatarCard：80px、无圆角、上浮出卡片顶边 -->
          <div class="emp-top">
            <div class="emp-media">
              <img v-if="e.avatar" :src="e.avatar" class="emp-cover" alt="" />
              <span v-else class="emp-fallback" :style="fallbackStyle(e)">{{ initial(e.name) }}</span>
            </div>
            <div class="emp-id">
              <div class="emp-name"><span class="emp-name-text">{{ e.name }}</span></div>
              <div class="emp-title">{{ e.title }}</div>
            </div>
          </div>

          <p class="emp-desc">{{ e.description }}</p>

          <footer class="emp-foot">
            <div class="emp-stat">
              <b>{{ e.memoryCount }}</b><span>记忆条目</span>
            </div>
            <div class="emp-stat">
              <b>{{ e.skillEnabled }}/{{ e.skillTotal }}</b><span>已开技能</span>
            </div>
            <button type="button" class="emp-chat" title="找他聊" @click.stop="onChat(e)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.3-.5L3 21l1.7-4.4A8.2 8.2 0 0 1 3.6 11 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
              </svg>
            </button>
          </footer>
        </article>

        <button type="button" class="emp-card emp-card--add" @click="goMarket">
          <span class="add-plus">＋</span>
          <span class="add-text">再雇一个</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <CreateDigitalEmployeeDialog
        :visible="showCreateDialog"
        @close="onCreateDialogClose"
      />
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useContactsStore } from '@/modules/contacts/store'
import { chatWithEmployee, manageEmployee } from '@/modules/contacts/actions'
import CreateDigitalEmployeeDialog from '@/modules/solo-team/components/CreateDigitalEmployeeDialog.vue'

defineOptions({ name: 'ContactsEmployeesView' })

const router = useRouter()
const uiStore = useUIStore()
const store = useContactsStore()
const soloTeamStore = useSoloTeamStore()

const showCreateDialog = ref(false)
const loading = computed(() => soloTeamStore.employeeLoadingItems && !store.employees.length)
/** 右侧管理面板展开时，网格锁死 3 列（不靠 auto-fill 碰运气） */
const manageOpen = computed(() => uiStore.digitalEmployeePanelVisible)

/** 没有头像时的字母头像配色：按 id 稳定取一个暖色 */
const AVATAR_COLORS = ['#f97316', '#8478fa', '#0ea5e9', '#22c55e', '#ec4899', '#f59e0b']

function initial(name) {
  return String(name || '?').slice(0, 1)
}

function fallbackStyle(employee) {
  const idx = String(employee.id).split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return { background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }
}

function onManage(employee) {
  manageEmployee(employee)
}

function onChat(employee) {
  chatWithEmployee(employee)
}

/** 「再雇一个」= 去数字人市场聘（造新人走「新建数字员工」按钮） */
function goMarket() {
  uiStore.setActiveNavigation('market', 'market-avatar')
  uiStore.expandSidebar()
  router.push('/market/avatar').catch(() => {})
}

function onCreateDialogClose() {
  showCreateDialog.value = false
  store.loadEmployees({ force: true })
}

onMounted(() => {
  store.loadEmployees()
})
</script>

<style lang="scss" scoped>
.ce-page {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f9fafa 0%, #ffffff 25%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ce-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.ce-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2f3547;
}

.ce-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #91949e;
}

.ce-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.ce-search {
  width: 200px;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  color: #2f3547;
  background: #fff;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s ease;
}

.ce-search:focus {
  border-color: #8478fa;
}

.ce-create {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: #f97316;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.ce-create:hover {
  filter: brightness(1.06);
}

.ce-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.ce-hint {
  padding: 60px 0;
  text-align: center;
  font-size: 13px;
  color: #a8b0c0;
}

/* ── 分段标题 + 助理 hero：vendor 自 market/my-uploads/MyAssetsView.vue 的 sec-label / twin-card ── */
.sec-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #2f3547;
  margin-bottom: 12px;
}

.sec-label-2 {
  margin-top: 26px;
}

.sec-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #436ff6, #7b61ff);
}

.sec-note {
  font-size: 11px;
  font-weight: 500;
  color: #a8b0c0;
}

.twin-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 52%, #1e3a5f 100%);
  box-shadow: 0 6px 22px rgba(67, 111, 246, 0.22);
}

.twin-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 82% 50%, rgba(123, 97, 255, 0.32) 0%, transparent 60%),
    radial-gradient(ellipse at 18% 90%, rgba(67, 111, 246, 0.22) 0%, transparent 55%);
  pointer-events: none;
}

.twin-ava {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #ffd27a, #ff9f43);
  font-size: 25px;
  font-weight: 700;
  color: #fff;
}

.twin-ava img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.twin-info {
  flex: 1;
  min-width: 0;
  z-index: 1;
}

.twin-name {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
}

.twin-badge {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.18);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
}

.twin-desc {
  margin-top: 5px;
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
}

.twin-meta {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.twin-actions {
  display: flex;
  gap: 9px;
  flex-shrink: 0;
  z-index: 1;
}

.twin-actions .act {
  height: 32px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.twin-actions .act-primary {
  color: #fff;
  background: linear-gradient(135deg, #436ff6, #5b7fff);
  border: none;
}

.twin-actions .act-ghost {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.twin-actions .act:hover {
  filter: brightness(1.1);
}

/* 行距 32 给上浮的头像留位置（与市场 card-grid 同口径） */
.ce-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
  row-gap: 32px;
  column-gap: 16px;
  padding-top: 26px;
}

/* 管理面板展开：主区变窄也保证 3 列（卡片自适应缩，不掉列） */
.ce-grid--squeezed {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* 挤到 3 列时，头像和标题跟着收一号，别把卡撑破 */
.ce-grid--squeezed .emp-media {
  width: 62px;
  height: 62px;
  margin-top: -26px;
}

.ce-grid--squeezed .emp-name {
  font-size: 15px;
}

.ce-grid--squeezed .emp-desc {
  -webkit-line-clamp: 2;
}

.ce-grid--squeezed .emp-foot {
  gap: 12px;
}

.emp-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 160px;
  padding: 16px;
  box-sizing: border-box;
  text-align: left;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 16px;
  overflow: visible; /* 头像要浮出卡片顶边 */
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}

/* hover 渐变描边，与市场 AvatarCard 一致 */
.emp-card:hover {
  border: 1px solid transparent;
  background:
    linear-gradient(#ffffff, #ffffff) padding-box,
    linear-gradient(270deg, #81befc 23%, #c69fed 75%, #ff8670 100%) border-box;
  box-shadow: 0 4px 10px 0 rgba(0, 0, 0, 0.06);
}

.emp-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.emp-media {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  margin: -32px 0 0;
  position: relative;
  z-index: 1;
  overflow: visible;
}

.emp-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 没头像的兜底：圆形字母，仍然上浮 */
.emp-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.emp-id {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.emp-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #2f3547;
}

.emp-name-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emp-title {
  margin-top: 2px;
  font-size: 12px;
  color: #91949e;
}


.emp-desc {
  flex: 1;
  margin: 12px 0 10px;
  font-size: 13px;
  line-height: 20px;
  color: #5a6072;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.emp-foot {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding-top: 10px;
  border-top: 1px solid #f2f3f6;
}

.emp-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.emp-stat b {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.emp-stat span {
  font-size: 11px;
  color: #a8b0c0;
}

.emp-chat {
  margin-left: auto;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #91949e;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emp-chat:hover {
  color: #8478fa;
  background: #f4f3ff;
}

.emp-card--add {
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #a8b0c0;
  background: transparent;
  border: 1px dashed #d8dbe4;
}

.emp-card--add:hover {
  color: #8478fa;
  background: transparent;
  border: 1px dashed #b9b2fb;
  box-shadow: none;
}

.add-plus {
  font-size: 20px;
  line-height: 1;
}

.add-text {
  font-size: 13px;
}
</style>
