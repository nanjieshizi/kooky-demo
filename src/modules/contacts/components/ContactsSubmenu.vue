<template>
  <div class="contacts-submenu">
    <div class="cs-scroll">
      <!-- A 版：我的员工 / 组织目录 两个页面入口；组织目录下面直接铺开部门树 -->
      <template v-if="!isB">
        <template v-for="item in navItems" :key="item.key">
          <div
            class="cs-item cs-item--major"
            :class="{ active: uiStore.activeSecondaryNav === item.key }"
            @click="onNavClick(item)"
          >
            <span class="cs-item-label">{{ item.label }}</span>
            <span v-if="countOf(item.key)" class="cs-item-count">{{ countOf(item.key) }}</span>
          </div>

          <div v-if="item.key === 'contacts-org'" class="cs-tree">
            <div v-if="contactsStore.orgLoading && !contactsStore.departments.length" class="cs-tree-hint">加载中…</div>
            <OrgDeptNode
              v-for="dept in contactsStore.departments"
              :key="dept.id"
              :dept="dept"
              :depth="0"
              :active-id="contactsStore.activeDeptId"
              :expanded-ids="contactsStore.expandedDeptIds"
              @toggle="contactsStore.expandDept($event)"
              @select="onDeptSelect"
            />
          </div>
        </template>
      </template>

      <!-- B 版：顶部切视图。左栏一次只装一种东西 ——
           要么是「具体的员工」（点了主区出详情），要么是「部门」（点了主区出成员列表），
           两种语义混在一根栏里，同样的点击会得到不同类型的结果，很别扭 -->
      <template v-if="isB">
        <div class="cs-seg" role="tablist">
          <button
            type="button"
            class="cs-seg-btn"
            :class="{ active: bView === 'employees' }"
            role="tab"
            :aria-selected="bView === 'employees'"
            @click="switchBView('employees')"
          >
            我的员工
          </button>
          <button
            type="button"
            class="cs-seg-btn"
            :class="{ active: bView === 'org' }"
            role="tab"
            :aria-selected="bView === 'org'"
            @click="switchBView('org')"
          >
            组织目录
          </button>
        </div>
      </template>

      <!-- B 版 · 组织目录视图：只有部门树 -->
      <template v-if="isB && bView === 'org'">
        <div class="cs-tree cs-tree--solo">
          <div v-if="contactsStore.orgLoading && !contactsStore.departments.length" class="cs-tree-hint">加载中…</div>
          <OrgDeptNode
            v-for="dept in contactsStore.departments"
            :key="dept.id"
            :dept="dept"
            :depth="0"
            :active-id="contactsStore.activeDeptId"
            :expanded-ids="contactsStore.expandedDeptIds"
            @toggle="contactsStore.expandDept($event)"
            @select="onDeptSelect"
          />
        </div>
      </template>

      <!-- B 版 · 我的员工视图：员工平铺成对象入口，点谁主区就是谁 -->
      <template v-if="isB && bView === 'employees'">
        <div class="cs-group-header cs-group-header--split cs-group-header--first">
          <span class="cs-group-title">我的员工 {{ contactsStore.employees.length }}</span>
          <button type="button" class="cs-group-add" title="新建数字员工" @click.stop="showCreateDialog = true">＋</button>
        </div>

        <div class="cs-search">
          <svg class="cs-search-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input v-model="empKeyword" type="text" class="cs-search-input" placeholder="搜员工、岗位" />
          <button v-if="empKeyword" type="button" class="cs-search-clear" title="清空" @click="empKeyword = ''">✕</button>
        </div>

        <div
          v-for="e in flatEmployees"
          :key="e.id"
          class="cs-contact"
          :class="{ active: isEmployeeActive(e), 'cs-contact--assistant': e.isAssistant }"
          @click="onEmployeeClick(e)"
        >
          <span class="cs-ava-wrap" :class="{ 'cs-ava-wrap--ring': e.isAssistant }">
            <img v-if="e.avatar" :src="e.avatar" class="cs-ava" alt="" />
            <span v-else class="cs-ava cs-ava--letter">{{ (e.name || '?').slice(0, 1) }}</span>
          </span>
          <span class="cs-contact-name">{{ e.name }}</span>
          <!-- 市场出了新版：点进去在页头一键更新 -->
          <span v-if="e.hasUpdate" class="cs-tag-update" :title="`新版本 ${e.latestVersion}`">可更新</span>
          <!-- 置顶：已置顶常显，未置顶 hover 才出，免得一排图钉 -->
          <button
            v-if="!e.isAssistant"
            type="button"
            class="cs-pin"
            :class="{ 'is-on': e.pinned }"
            :title="e.pinned ? '取消置顶' : '置顶'"
            @click.stop="contactsStore.toggleEmployeePin(e)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" :fill="e.pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 17v5" /><path d="M9 10.76V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4.76a2 2 0 0 0 .59 1.42l1.12 1.12a1 1 0 0 1-.71 1.7H7a1 1 0 0 1-.71-1.7l1.12-1.12A2 2 0 0 0 9 10.76z" />
            </svg>
          </button>
        </div>

        <p v-if="!flatEmployees.length" class="cs-empty">没搜到人，换个词试试。</p>

        <!-- 常驻：员工多也用得上的入口，员工少时顺便当引导 -->
        <button v-if="!empKeyword" type="button" class="cs-hire-row" @click="goMarket">
          <span class="cs-hire-plus">＋</span>雇个新同事
        </button>

        <!-- 员工不多时补一块市场推荐，把二级栏那片白填上，且填的是能一键聘的东西 -->
        <template v-if="showRecos">
          <div class="cs-group-header cs-group-header--split">
            <span>推荐给你</span>
            <button type="button" class="cs-group-add cs-group-more" title="去市场逛" @click.stop="goMarket">逛市场</button>
          </div>
          <div v-for="a in contactsStore.visibleMarketRecos" :key="`reco-${a.id}`" class="cs-reco">
            <img v-if="a.avatar" :src="a.avatar" class="cs-ava" alt="" />
            <span v-else class="cs-ava cs-ava--letter">{{ (a.name || '?').slice(0, 1) }}</span>
            <span class="cs-reco-main">
              <span class="cs-contact-name">{{ a.name }}</span>
              <span class="cs-reco-sub">{{ a.tags?.[0] || '数字人' }}</span>
            </span>
            <button
              type="button"
              class="cs-reco-hire"
              :disabled="contactsStore.hiringId === a.id"
              @click.stop="onHire(a)"
            >
              {{ contactsStore.hiringId === a.id ? '…' : '聘用' }}
            </button>
          </div>
        </template>
      </template>

    </div>

    <!-- 底部概览条：固定一行，装不下就省略号（hover 出全文） -->
    <footer class="cs-overview" :title="overviewText">{{ overviewText }}</footer>

    <Teleport to="body">
      <CreateDigitalEmployeeDialog :visible="showCreateDialog" @close="onCreateDialogClose" />
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/modules/space/uiStore'
import { getSecondaryNavItems, contactsBEmployeeNavKey } from '@/modules/navigation/config'
import { useContactsStore } from '@/modules/contacts/store'
import { ElMessage } from 'element-plus'
import CreateDigitalEmployeeDialog from '@/modules/solo-team/components/CreateDigitalEmployeeDialog.vue'
import OrgDeptNode from '@/modules/contacts/components/OrgDeptNode.vue'

const router = useRouter()
const route = useRoute()
const uiStore = useUIStore()
const contactsStore = useContactsStore()

/** 当前在通讯录 A 还是 B（B 是演示用的列表版），菜单项和跳转都跟着走 */
const navKey = computed(() => (uiStore.activePrimaryNav === 'contacts-b' ? 'contacts-b' : 'contacts'))
const navItems = computed(() => getSecondaryNavItems(navKey.value))
const isB = computed(() => navKey.value === 'contacts-b')
const showCreateDialog = ref(false)

/** 二级栏自己的搜索词（不共用 store.keyword —— 那个是 A 版卡片页的，串了会互相干扰） */
const empKeyword = ref('')

/**
 * B 版平铺：助理置顶，后面是雇来的员工（置顶的排前面 —— 顺序由
 * solo-team 的 sortEmployeesLikeAgentsMy 保证，这里不重排）。
 */
const flatEmployees = computed(() => {
  const list = contactsStore.assistant
    ? [contactsStore.assistant, ...contactsStore.employees]
    : [...contactsStore.employees]
  const kw = empKeyword.value.trim().toLowerCase()
  if (!kw) return list
  return list.filter((e) => `${e.name}${e.title}${e.description}`.toLowerCase().includes(kw))
})

const employeeNavKey = contactsBEmployeeNavKey

/**
 * B 版当前视图。事实源是路由 —— 直接落地址栏进来也能对上，
 * 不用另存一份 state 再操心同步。
 */
const bView = computed(() => (route.path.startsWith('/contacts-b/org') ? 'org' : 'employees'))

/** 切回「我的员工」时回到上次看的那个，没有就落助理 */
const lastEmployeeRouteId = ref('assistant')

/** 助理走 'assistant' 这个稳定别名，路由不依赖它的真实 agent_id */
function employeeRouteId(e) {
  return e.isAssistant ? 'assistant' : e.id
}

function isEmployeeActive(e) {
  return uiStore.activeSecondaryNav === employeeNavKey(employeeRouteId(e))
}

/** 点部门 → 主区切成组织目录（全宽成员列表），并选中该部门 */
async function onDeptSelect(deptId) {
  const orgRoute = isB.value ? '/contacts-b/org' : '/contacts/org'
  uiStore.setActiveNavigation(navKey.value, isB.value ? 'contacts-b-org' : 'contacts-org')
  if (route.path !== orgRoute) await router.push(orgRoute).catch(() => {})
  contactsStore.selectDept(deptId)
}

/**
 * 员工 ≤3 时才推荐（多了就不占地方了）。
 * ⚠️ demo 逃生门：控制台执行 `window.__kookyForceRecos = true` 可强制显示，
 *    否则 demo 预置了 11 个员工，这块永远演示不到。
 */
const forceRecos = ref(typeof window !== 'undefined' && !!window.__kookyForceRecos)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__kookyForceRecos', {
    configurable: true,
    get: () => forceRecos.value,
    set: (v) => { forceRecos.value = !!v },
  })
}

const showRecos = computed(() => isB.value
  && (forceRecos.value || contactsStore.employees.length <= 3)
  && contactsStore.visibleMarketRecos.length > 0)

function goMarket() {
  uiStore.setActiveNavigation('market', 'market-avatar')
  uiStore.expandSidebar()
  router.push('/market/avatar').catch(() => {})
}

async function onHire(a) {
  const ok = await contactsStore.hireRecommended(a)
  ElMessage[ok ? 'success' : 'error'](ok ? `已聘用「${a.name}」，去左边看看` : '聘用失败，重试一下')
}

/** 点员工 → 主区整页管理（不再开右侧那条窄面板） */
async function onEmployeeClick(e) {
  uiStore.digitalEmployeePanelVisible = false
  contactsStore.closeProfile()
  const rid = employeeRouteId(e)
  lastEmployeeRouteId.value = rid
  uiStore.setActiveNavigation('contacts-b', employeeNavKey(rid))
  await router.push(`/contacts-b/employee/${rid}`).catch(() => {})
}

/** 切视图：路由变了左栏内容也就跟着变（bView 是从路由推的） */
async function switchBView(view) {
  if (view === bView.value) return
  contactsStore.closeProfile()
  if (view === 'org') {
    uiStore.setActiveNavigation('contacts-b', 'contacts-b-org')
    await router.push('/contacts-b/org').catch(() => {})
    // 主区不留白：首次进来 loadOrgRoots 已经下钻选好了，这里兜住「树加载过但没选中」
    if (!contactsStore.activeDeptId) await contactsStore.drillToFirstLeafDept()
    return
  }
  const rid = lastEmployeeRouteId.value || 'assistant'
  uiStore.setActiveNavigation('contacts-b', employeeNavKey(rid))
  await router.push(`/contacts-b/employee/${rid}`).catch(() => {})
}

function onCreateDialogClose() {
  showCreateDialog.value = false
  contactsStore.loadEmployees({ force: true })
}

/** 概览条：一行，人数拿不到就少一段，不硬凑 */
const overviewText = computed(() => {
  const parts = []
  if (contactsStore.headcount) parts.push(`${contactsStore.headcount} 同事`)
  parts.push(`${contactsStore.digitalColleagues.length} 企业数字人`)
  parts.push(`${contactsStore.employees.length} 我的员工`)
  return parts.join(' · ')
})

function countOf(key) {
  if (key === 'contacts-employees' || key === 'contacts-b-employees') return contactsStore.employees.length
  if (key === 'contacts-org' || key === 'contacts-b-org') return contactsStore.orgTotal
  return 0
}

async function onNavClick(item) {
  if (!item.route) return
  uiStore.setActiveNavigation(navKey.value, item.key)
  await router.push(item.route)
}

// 二级栏要显示计数和概览，进来就先把数据备齐（各 store 内部都有守卫，不会重复请求）
onMounted(() => {
  contactsStore.loadEmployees()
  contactsStore.loadHeadcount()
  // 树进了二级栏（A/B 都是），进来就得先把根部门拉好
  contactsStore.loadOrgRoots()
  if (isB.value) contactsStore.loadMarketRecos()
})
</script>

<style lang="scss" scoped>
.contacts-submenu {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cs-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

/* B 版视图切换：分段控件，两格互斥 —— 明确表达「这是两个视图」而不是「两个页面」 */
.cs-seg {
  flex: none;
  display: flex;
  gap: 2px;
  margin-bottom: 6px;
  padding: 2px;
  background: #f1f2f6;
  border-radius: 9px;
}

.cs-seg-btn {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0;
  font-size: 12.5px;
  color: #6b7183;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cs-seg-btn:hover:not(.active) {
  color: #2f3547;
}

.cs-seg-btn.active {
  font-weight: 500;
  color: #6a5df0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(47, 53, 71, 0.06);
}

/* 有新版本：直接写「可更新」，比一个橙点让人知道该干嘛 */
.cs-tag-update {
  flex: none;
  padding: 1px 5px;
  font-size: 10px;
  line-height: 15px;
  color: #b26a00;
  background: #fff6e5;
  border: 1px solid #ffe0a3;
  border-radius: 5px;
}

/* 置顶：未置顶时藏起来，hover 行才出现 */
.cs-pin {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  color: #b9bfcb;
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s;
}

.cs-contact:hover .cs-pin {
  opacity: 1;
}

.cs-pin:hover {
  color: #6b7183;
  background: #eceef3;
}

.cs-pin.is-on {
  color: #ff8a3d;
}

.cs-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 6px;
  padding: 0 8px;
  height: 30px;
  background: #fff;
  border: 1px solid #e6e8ee;
  border-radius: 8px;
}

.cs-search:focus-within {
  border-color: #b9b2fb;
}

.cs-search-ico {
  flex: none;
  color: #a8b0c0;
}

.cs-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 12.5px;
  color: #2f3547;
  background: transparent;
  border: none;
  outline: none;
}

.cs-search-input::placeholder {
  color: #a8b0c0;
}

.cs-search-clear {
  flex: none;
  padding: 0 2px;
  font-size: 11px;
  color: #a8b0c0;
  background: transparent;
  border: none;
  cursor: pointer;
}

.cs-search-clear:hover {
  color: #6b7183;
}

.cs-empty {
  margin: 6px 8px;
  font-size: 12px;
  color: #a8b0c0;
}

/* 组织目录视图里树是唯一内容，不用再跟分组头挤间距 */
.cs-tree--solo {
  margin-top: 2px;
}

.cs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #2f3547;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cs-item:hover,
.cs-item.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.cs-item.active {
  font-weight: 600;
}

/* A 版两个主入口：做成标题级，跟下面的树/联系人拉开层级 */
.cs-item--major {
  position: relative;
  min-height: 40px;
}

.cs-item--major .cs-item-label {
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
}

.cs-item--major.active::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: linear-gradient(180deg, #436ff6, #7b61ff);
}

.cs-item--major.active .cs-item-label {
  color: #6a5df0;
}

.cs-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cs-item-count {
  font-size: 12px;
  color: #91949e;
  flex: none;
}

.cs-group-header {
  padding: 14px 14px 2px;
  font-size: 12px;
  line-height: 20px;
  color: #91949e;
}

/* B 版两段是并列的「标题」，不是弱化的小分组标签 */
.cs-group-header--split .cs-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.cs-group-header--split .cs-caret {
  font-size: 13px;
  color: #9aa0ad;
}

/* B 版分组头：左标题右「＋新建」，并用一条细线跟上面的组织目录隔开 */
.cs-group-header--first {
  margin-top: 2px;
  padding-top: 4px;
  border-top: none;
}

.cs-group-title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cs-caret {
  display: inline-block;
  font-style: normal;
  font-size: 12px;
  color: #c2c7d2;
  transition: transform 0.2s ease;
}

.cs-caret.open {
  transform: rotate(90deg);
}

.cs-tree {
  padding: 2px 0 4px;
}

.cs-tree-hint {
  padding: 8px 14px;
  font-size: 12px;
  color: #a8b0c0;
}

.cs-group-header--split {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(47, 53, 71, 0.08);
}

.cs-group-add {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #91949e;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.cs-group-add:hover {
  color: #6a5df0;
  background: #f0eeff;
}

.cs-contact {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.cs-contact:hover,
.cs-contact.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.cs-contact.active .cs-contact-name {
  font-weight: 600;
}

.cs-ava-wrap {
  flex: none;
  display: flex;
  line-height: 0;
  border-radius: 10px;
}

/* 助理：头像外圈渐变光环 —— 一眼看出它特殊，但不占文字 */
.cs-ava-wrap--ring {
  padding: 2px;
  background: linear-gradient(135deg, #ffb35c, #ff7a59 55%, #7b61ff);
}

.cs-contact--assistant .cs-contact-name {
  font-weight: 600;
  color: #6a5df0;
}

.cs-ava {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
  background: #f2f3f6;
}

.cs-ava--letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #8478fa, #5b7fff);
}

.cs-contact-name {
  min-width: 0;
  flex: 0 1 auto;
  font-size: 13px;
  color: #2f3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cs-contact-tag {
  flex: none;
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
  color: #8478fa;
  background: #f4f3ff;
  border-radius: 5px;
}

/* 常驻「雇个新同事」：虚线行，跟员工条区分开 */
.cs-hire-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  margin-top: 2px;
  padding: 0 14px;
  font-size: 13px;
  color: #a8b0c0;
  background: transparent;
  border: 1px dashed rgba(47, 53, 71, 0.14);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cs-hire-row:hover {
  color: #6a5df0;
  border-color: #c9c2fb;
  background: rgba(255, 255, 255, 0.6);
}

.cs-hire-plus {
  font-size: 14px;
  line-height: 1;
}

.cs-group-more {
  width: auto;
  padding: 0 6px;
  font-size: 11px;
}

/* 推荐条：头像 + 名字/标签 + 聘用按钮 */
.cs-reco {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  transition: background 0.2s ease;
}

.cs-reco:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 99%);
}

.cs-reco-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.cs-reco-sub {
  font-size: 11px;
  color: #a8b0c0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cs-reco-hire {
  flex: none;
  height: 22px;
  padding: 0 9px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(135deg, #7b61ff, #5b7fff);
  border: none;
  border-radius: 999px;
  cursor: pointer;
}

.cs-reco-hire:disabled {
  opacity: 0.6;
  cursor: default;
}

.cs-overview {
  flex: none;
  padding: 10px 14px;
  margin-top: 8px;
  border-top: 1px solid rgba(47, 53, 71, 0.06);
  font-size: 11px;
  line-height: 16px;
  color: #a8b0c0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
