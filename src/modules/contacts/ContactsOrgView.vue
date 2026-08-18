<template>
  <section class="co-page">
    <header class="co-head">
      <div class="co-head-main">
        <h2 class="co-title">组织目录</h2>
        <p class="co-sub">按组织架构找人 —— 企业数字人也按归属坐在各自部门里。点一行看档案。</p>
      </div>
      <input
        class="co-search"
        type="text"
        placeholder="搜索姓名、账号"
        :value="store.orgKeyword"
        @input="onSearch($event.target.value)"
      />
    </header>

    <div class="co-body">
      <!-- 左：部门树（B 版已把树搬进二级栏，这里就不重复出现） -->
      <aside v-if="!hideTree" class="co-tree">
        <div v-if="store.orgLoading && !store.departments.length" class="co-hint">正在加载组织架构…</div>
        <OrgDeptNode
          v-for="dept in store.departments"
          :key="dept.id"
          :dept="dept"
          :depth="0"
          :active-id="store.activeDeptId"
          :expanded-ids="store.expandedDeptIds"
          @toggle="store.expandDept($event)"
          @select="store.selectDept($event)"
        />
      </aside>

      <!-- 右：成员列表 -->
      <div class="co-list">
        <div class="co-list-head">
          <span class="co-list-title">{{ listTitle }}</span>
          <span v-if="!store.agentOnly" class="co-list-count">{{ humanCount }} 人</span>
          <!-- 数字同事胶囊 = 筛选视角（跨部门看全公司），不是组织节点 -->
          <button
            type="button"
            class="co-agent-chip"
            :class="{ active: store.agentOnly }"
            :title="store.agentOnly ? '回到当前部门' : '看全公司的企业数字人'"
            @click="store.toggleAgentOnly()"
          >
            <span class="co-chip-ico">🤖</span>
            <template v-if="store.agentOnly">全公司 {{ store.digitalColleagues.length }} 位 · 点此返回部门</template>
            <template v-else-if="store.deptAgentCount">企业数字人 {{ store.deptAgentCount }}</template>
            <template v-else>全公司企业数字人 {{ store.digitalColleagues.length }}</template>
          </button>
        </div>

        <div v-if="!store.orgMembers.length" class="co-hint">{{ emptyText }}</div>

        <!-- 单列列表：人多了以后双列小卡不好扫，改成带列的列表；点行开右侧档案卡 -->
        <div v-else class="co-rows">
          <div class="co-row co-row--header">
            <span class="co-col-name">姓名</span>
            <span class="co-col-title">职务</span>
            <span class="co-col-dept">部门</span>
            <span class="co-col-mail">邮箱</span>
            <span v-if="hideTree" class="co-col-no">工号</span>
            <span class="co-col-act" />
          </div>
          <div
            v-for="m in store.orgMembers"
            :key="`${m.kind}-${m.id}`"
            class="co-row"
            :class="{ active: isActive(m) }"
            @click="store.openProfile(m)"
          >
            <span class="co-col-name">
              <img v-if="m.avatar" :src="m.avatar" class="co-ava" alt="" />
              <span v-else class="co-ava co-ava--letter">{{ (m.name || '?').slice(0, 1) }}</span>
              <span class="co-name-text">{{ m.name }}</span>
              <span v-if="m.kind === 'agent'" class="co-tag">企业数字人</span>
              <span v-else-if="m.account" class="co-account">{{ m.account }}</span>
            </span>
            <span class="co-col-title">{{ m.title || (m.kind === 'agent' ? '企业数字人' : '—') }}</span>
            <span class="co-col-dept" :title="m.department">{{ deptOf(m) }}</span>
            <span class="co-col-mail" :title="m.email">{{ m.kind === 'agent' ? '—' : (m.email || '—') }}</span>
            <!-- 数字人也有工号（AI- 号段），不再一律给横杠 -->
            <span v-if="hideTree" class="co-col-no">{{ m.employeeId || '—' }}</span>
            <span class="co-col-act">
              <button
                v-if="m.kind !== 'agent' && m.email"
                type="button"
                class="co-row-chat"
                title="复制邮箱"
                @click.stop="copyMail(m)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                </svg>
              </button>
              <button type="button" class="co-row-chat" :title="m.kind === 'agent' ? '找他对话' : '私聊'" @click.stop="onChat(m)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.3-.5L3 21l1.7-4.4A8.2 8.2 0 0 1 3.6 11 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
                </svg>
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useContactsStore } from '@/modules/contacts/store'
import { useUIStore } from '@/modules/space/uiStore'
import OrgDeptNode from '@/modules/contacts/components/OrgDeptNode.vue'
import { chatWithDigitalColleague } from '@/modules/contacts/actions'
import { useStartPrivateChat } from '@/modules/private/composables/useStartPrivateChat'

defineOptions({ name: 'ContactsOrgView' })

const store = useContactsStore()
const uiStore = useUIStore()
const { startChat } = useStartPrivateChat()

/** A/B 版都把树提到了二级栏，页内不再重复；列表吃满整幅宽度、多摆一列工号 */
const hideTree = computed(() => ['contacts', 'contacts-b'].includes(uiStore.activePrimaryNav))

const listTitle = computed(() => {
  if (store.orgSearchResults) return `搜索「${store.orgKeyword}」`
  if (store.agentOnly) return '全公司 · 企业数字人'
  return store.findDept(store.activeDeptId)?.name || '组织目录'
})

const humanCount = computed(() => store.orgMembers.length - store.orgAgentCount)

const emptyText = computed(() => {
  if (store.orgSearchResults) return '没搜到人，换个关键词试试。'
  if (store.agentOnly) return '公司还没部署企业数字人。'
  const node = store.findDept(store.activeDeptId)
  if (node?.hasChildren) return '这个部门没有直属成员，人在下级部门里，左边点开看看。'
  return '这个部门下暂时没有人。'
})

/**
 * 部门列：部门内浏览时只显示末级组名（左树已经框定了）；
 * 搜索结果里显示后两级，用来定位人在哪。完整路径在右侧档案卡。
 */
function deptOf(m) {
  if (m.kind === 'agent') {
    // 混编在部门里时显示当前部门；全公司筛选/搜索时显示它自己的归属末级
    if (!store.orgSearchResults && !store.agentOnly) {
      return store.findDept(store.activeDeptId)?.name || '企业数字人'
    }
    return lastDeptSegment(m.department)
  }
  const path = m.departmentPath || []
  if (!path.length) return m.department || '—'
  if (store.orgSearchResults) return path.slice(-2).join(' / ')
  return path[path.length - 1]
}

/** 从全路径部门名里取末级（「…效率平台部前端开发组」→「前端开发组」） */
function lastDeptSegment(dept) {
  const text = String(dept || '').trim()
  if (!text || text === '企业数字人') return '企业数字人'
  const hit = text.match(/[^部组中心院]{2,}[部组]$/)
  return hit ? hit[0] : text
}

async function copyMail(m) {
  try {
    await navigator.clipboard.writeText(String(m.email))
    ElMessage.success('邮箱已复制')
  } catch {
    ElMessage.warning('复制失败，手动选一下吧')
  }
}

function isActive(m) {
  const cur = store.activeProfile
  return !!cur && cur.kind === m.kind && String(cur.id) === String(m.id)
}

/** 真人 → 协作私聊；数字同事 → 协作数字人单聊 */
function onChat(m) {
  if (m.kind === 'agent') {
    chatWithDigitalColleague(m)
    return
  }
  startChat({ account: m.account, userName: m.account })
}

function onSearch(value) {
  store.searchOrg(value)
}

onMounted(() => {
  store.loadOrgRoots()
})
</script>

<style lang="scss" scoped>
.co-page {
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

.co-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.co-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2f3547;
}

.co-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #91949e;
}

.co-search {
  width: 220px;
  height: 34px;
  flex: none;
  padding: 0 12px;
  font-size: 13px;
  color: #2f3547;
  background: #fff;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s ease;
}

.co-search:focus {
  border-color: #8478fa;
}

.co-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.co-tree {
  width: 210px;
  flex: none;
  padding: 10px 8px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 14px;
  overflow-y: auto;
}

.co-list {
  flex: 1;
  min-width: 0;
  padding: 12px 16px 16px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 14px;
  overflow-y: auto;
}

.co-list-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f2f3f6;
}

.co-list-title {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
}

.co-list-count {
  font-size: 12px;
  color: #a8b0c0;
}

/* 数字同事筛选胶囊：常驻可点，激活态高亮 */
.co-agent-chip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  color: #6a5df0;
  background: #f4f3ff;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.co-agent-chip:hover {
  border-color: #c9c2fb;
}

.co-agent-chip.active {
  color: #fff;
  background: linear-gradient(135deg, #7b61ff, #5b7fff);
}

.co-chip-ico {
  font-size: 12px;
  line-height: 1;
}

.co-rows {
  padding-top: 4px;
}

.co-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.co-row:hover {
  background: #f7f8fa;
}

.co-row.active {
  background: #f4f3ff;
}

/* 表头：只做列标，不可点 */
.co-row--header {
  padding-top: 10px;
  padding-bottom: 6px;
  font-size: 12px;
  color: #a8b0c0;
  cursor: default;
}

.co-row--header:hover {
  background: transparent;
}

.co-col-name {
  flex: 1.4;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #2f3547;
}

.co-row--header .co-col-name {
  font-size: 12px;
  color: #a8b0c0;
}

.co-col-title,
.co-col-dept,
.co-col-mail {
  min-width: 0;
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.co-col-title { flex: 1.5; }
.co-col-no {
  width: 96px;
  flex: none;
  font-size: 13px;
  color: #6b7280;
}
.co-row--header .co-col-no {
  font-size: 12px;
  color: #a8b0c0;
}
.co-col-dept { flex: 1.1; }
.co-col-mail { flex: 1.3; }

.co-row--header .co-col-title,
.co-row--header .co-col-dept,
.co-row--header .co-col-mail {
  font-size: 12px;
  color: #a8b0c0;
}

.co-col-act {
  width: 64px;
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.co-ava {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 9px;
  object-fit: cover;
  background: #f2f3f6;
}

.co-ava--letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #8478fa, #5b7fff);
}

.co-name-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.co-account {
  flex: none;
  font-size: 12px;
  color: #a8b0c0;
}

.co-row-chat {
  flex: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a8b0c0;
  background: transparent;
  border: none;
  border-radius: 8px;
  opacity: 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.co-row:hover .co-row-chat {
  opacity: 1;
}

.co-row-chat:hover {
  color: #8478fa;
  background: #f4f3ff;
}

.co-tag {
  flex: none;
  padding: 1px 6px;
  font-size: 11px;
  color: #8478fa;
  background: #f4f3ff;
  border-radius: 6px;
}

.co-hint {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #a8b0c0;
}
</style>
