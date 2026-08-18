<template>
  <!-- 通讯录 B：员工在二级栏平铺，选中谁主区就是谁的整页管理 -->
  <section class="ed-page">
    <div v-if="!employee" class="ed-empty">员工不在了，左边再挑一个。</div>

    <template v-else>
      <header class="ed-head">
        <span class="ed-avatar-wrap" :class="{ 'ed-avatar-wrap--ring': employee.isAssistant }">
          <img v-if="employee.avatar" :src="employee.avatar" class="ed-avatar" alt="" />
          <span v-else class="ed-avatar ed-avatar--letter">{{ (employee.name || '?').slice(0, 1) }}</span>
        </span>
        <div class="ed-id">
          <div class="ed-name-row">
            <!-- 名称/描述就地改：这页是员工的主场，改名不该再跳去右边面板找入口 -->
            <input
              v-if="editing === 'name'"
              ref="nameInputRef"
              v-model="draft"
              class="ed-name-input"
              maxlength="64"
              @blur="commitEdit"
              @keyup.enter="commitEdit"
              @keydown.esc="cancelEdit"
            />
            <h2
              v-else
              class="ed-name ed-editable"
              :class="{ 'ed-name--assistant': employee.isAssistant }"
              title="点击改名"
              @click="startEdit('name')"
            >{{ employee.name }}</h2>
            <span v-if="employee.version" class="ed-ver">{{ employee.version }}</span>
            <button
              v-if="employee.hasUpdate"
              type="button"
              class="ed-update"
              :disabled="updating"
              :title="employee.changelog || '更新到最新版'"
              @click="onUpdate"
            >
              <span class="ed-update-dot" aria-hidden="true"></span>
              {{ updating ? '更新中…' : `更新到 ${employee.latestVersion}` }}
            </button>
          </div>
          <!-- 履历行：在岗多久 + 打哪来。原来这儿是职位，职位挪进右侧管理面板了。
               标签-值成对排，中间竖线分隔 —— 比一串点号更像"档案"，也压得住链接 -->
          <div class="ed-meta">
            <span class="ed-meta-item">
              <i class="ed-meta-k">在岗</i>
              <b class="ed-meta-v">{{ employee.onboardDays ? `${employee.onboardDays} 天` : '-' }}</b>
            </span>
            <i class="ed-meta-sep" aria-hidden="true"></i>
            <span class="ed-meta-item">
              <i class="ed-meta-k">来源</i>
              <!-- 市场聘来的才有得跳；自建/统配没有可去的地方，给「-」 -->
              <button
                v-if="employee.fromMarket"
                type="button"
                class="ed-meta-link"
                :title="`去市场看「${employee.sourceFrom}」`"
                @click="openMarketAgent(employee.marketAgentId, router)"
              >
                {{ employee.sourceFrom }}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                </svg>
              </button>
              <b v-else class="ed-meta-v ed-meta-v--empty">-</b>
            </span>
          </div>
          <textarea
            v-if="editing === 'desc'"
            ref="descInputRef"
            v-model="draft"
            class="ed-desc-input"
            rows="2"
            maxlength="1024"
            @blur="commitEdit"
            @keydown.esc="cancelEdit"
            @keydown.enter.meta="commitEdit"
            @keydown.enter.ctrl="commitEdit"
          />
          <p
            v-else
            class="ed-desc ed-editable"
            title="点击编辑描述"
            @click="startEdit('desc')"
          >{{ employee.description }}</p>
          <!-- 标签（label）：跟市场那排 tags 同源，纯标识不参与逻辑，用户自己加自己删。
               hover 标签才出 ✕，免得一排叉子晃眼 -->
          <div class="ed-tags">
            <span v-for="tag in employee.labels" :key="tag" class="ed-tag">
              {{ tag }}
              <button type="button" class="ed-tag-x" :title="`删掉「${tag}」`" @click="removeLabel(tag)">✕</button>
            </span>
            <input
              v-if="addingLabel"
              ref="labelInputRef"
              v-model="labelDraft"
              class="ed-tag-input"
              placeholder="标签名"
              maxlength="12"
              @blur="commitLabel"
              @keyup.enter="commitLabel"
              @keydown.esc="cancelLabel"
            />
            <button
              v-else-if="employee.labels.length < MAX_EMPLOYEE_LABELS"
              type="button"
              class="ed-tag-add"
              @click="startAddLabel"
            >＋ 标签</button>
          </div>
        </div>
        <!-- 右侧只放动作：统计交给下面的效能区，别让 hero 又是数字又是按钮 -->
        <div class="ed-actions">
          <button type="button" class="ed-chat" @click="onChat">💬 对话</button>
          <button
            v-if="!employee.isAssistant"
            type="button"
            class="ed-dismiss"
            @click="dismissVisible = true"
          >解聘</button>
        </div>
      </header>

      <!-- 解聘确认：与 PersonaManagePanel 里那个同性质，放这儿是因为按钮挪到了 hero -->
      <Teleport to="body">
        <div v-if="dismissVisible" class="ed-mask" @click.self="dismissVisible = false">
          <div class="ed-dialog">
            <h4 class="ed-dialog-title">解聘 {{ employee.name }}？</h4>
            <p class="ed-dialog-text">解聘后 TA 会从「我的员工」里移除，已有的会话记录还在。随时可以去市场重新聘。</p>
            <div class="ed-dialog-btns">
              <button type="button" class="ed-dialog-cancel" @click="dismissVisible = false">再想想</button>
              <button type="button" class="ed-dialog-ok" :disabled="dismissing" @click="onDismiss">
                {{ dismissing ? '处理中…' : '确认解聘' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 左主区「他干得怎么样」= 效能 + 工作记录；右区「他是怎么配的」= 生产的管理面板 -->
      <div class="ed-body">
        <div class="ed-main">
          <EmployeeEfficiencyPane :employee="employee" />
          <EmployeeWorkLogPane :employee="employee" />
        </div>
        <PersonaManagePanel
          :key="`contacts-b-persona-${employee.id}`"
          :agent-id="employee.id"
          context="employee"
          embedded
          class="ed-panel"
        />
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useSoloTeamStore } from '@/modules/solo-team/store'
import { useContactsStore, MAX_EMPLOYEE_LABELS } from '@/modules/contacts/store'
import { chatWithEmployee, openMarketAgent } from '@/modules/contacts/actions'
import PersonaManagePanel from '@/modules/space/components/PersonaManagePanel.vue'
import EmployeeWorkLogPane from '@/modules/contacts/components/EmployeeWorkLogPane.vue'
import EmployeeEfficiencyPane from '@/modules/contacts/components/EmployeeEfficiencyPane.vue'

defineOptions({ name: 'ContactsEmployeeDetailView' })

const route = useRoute()
const router = useRouter()
const store = useContactsStore()

const employee = computed(() => {
  const id = String(route.params.id || '')
  // 'assistant' 是稳定别名：路由不依赖助理的真实 agent_id
  if (id === 'assistant') return store.assistant
  if (store.assistant && String(store.assistant.id) === id) return store.assistant
  return store.employees.find((e) => String(e.id) === id) || null
})

function onChat() {
  if (employee.value) chatWithEmployee(employee.value)
}

/**
 * 页头名称 / 描述就地编辑 —— 走 solo-team 的 updateEmployeeDetails（与右侧面板同一条保存路径），
 * 它会顺手把 employeeChatEmployees 改掉，通讯录的 getter 挂在上面，所以不用手动刷新。
 */
const soloTeamStore = useSoloTeamStore()
const editing = ref('')
const draft = ref('')
const nameInputRef = ref(null)
const descInputRef = ref(null)

function startEdit(field) {
  if (!employee.value) return
  editing.value = field
  draft.value = field === 'name' ? employee.value.name : employee.value.description
  nextTick(() => {
    const el = field === 'name' ? nameInputRef.value : descInputRef.value
    el?.focus()
    el?.select?.()
  })
}

function cancelEdit() {
  editing.value = ''
}

async function commitEdit() {
  const field = editing.value
  if (!field || !employee.value) return
  editing.value = ''
  const value = draft.value.trim()
  const current = field === 'name' ? employee.value.name : employee.value.description
  // 名字空着等于把人抹了，直接当取消；没改动就不发请求
  if ((field === 'name' && !value) || value === current) return
  try {
    await soloTeamStore.updateEmployeeDetails(
      employee.value.id,
      field === 'name' ? { name: value } : { description: value },
    )
  } catch (err) {
    console.error('[Contacts] 保存失败:', err)
    ElMessage.error('保存失败，请重试')
  }
}

// 切到别的员工时别把上一个人的草稿留在输入框里
watch(() => route.params.id, () => {
  cancelEdit()
  cancelLabel()
})

/** 标签增删：纯标识，改完立刻存，不做「编辑态」 */
const addingLabel = ref(false)
const labelDraft = ref('')
const labelInputRef = ref(null)

function startAddLabel() {
  addingLabel.value = true
  labelDraft.value = ''
  nextTick(() => labelInputRef.value?.focus())
}

function cancelLabel() {
  addingLabel.value = false
  labelDraft.value = ''
}

async function saveLabels(next) {
  try {
    await store.updateEmployeeLabels(employee.value.id, next)
  } catch (err) {
    console.error('[Contacts] 标签保存失败:', err)
    ElMessage.error('保存失败，请重试')
  }
}

async function commitLabel() {
  const value = labelDraft.value.trim()
  const list = employee.value?.labels || []
  cancelLabel()
  // 重了就当没输，别悄悄塞两个一样的
  if (!value || list.includes(value) || list.length >= MAX_EMPLOYEE_LABELS) return
  await saveLabels([...list, value])
}

async function removeLabel(tag) {
  const list = employee.value?.labels || []
  await saveLabels(list.filter((t) => t !== tag))
}

const updating = ref(false)
const dismissVisible = ref(false)
const dismissing = ref(false)

async function onUpdate() {
  if (!employee.value || updating.value) return
  updating.value = true
  try {
    const ok = await store.applyEmployeeUpdate(employee.value.id)
    ElMessage[ok ? 'success' : 'error'](ok ? `已更新到 ${employee.value.version}` : '更新失败，稍后再试')
  } finally {
    updating.value = false
  }
}

async function onDismiss() {
  if (!employee.value || dismissing.value) return
  dismissing.value = true
  try {
    await store.dismissEmployee(employee.value.id)
    dismissVisible.value = false
    ElMessage.success('已解聘')
    // 人没了，页面别停在空详情上 —— 回到助理
    router.push('/contacts-b/employee/assistant').catch(() => {})
  } catch (err) {
    console.error('[Contacts] 解聘失败:', err)
    ElMessage.error('解聘失败，请重试')
  } finally {
    dismissing.value = false
  }
}

onMounted(() => {
  store.loadEmployees()
})

// 直接落地址栏进来时列表还没加载，补一次
watch(employee, (e) => {
  if (!e) store.loadEmployees()
})
</script>

<style lang="scss" scoped>
.ed-page {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f9fafa 0%, #ffffff 25%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 页内的响应式都按「主区实际剩多宽」算，不看视口 */
  container-type: inline-size;
}

.ed-empty {
  padding: 80px 0;
  text-align: center;
  font-size: 13px;
  color: #a8b0c0;
}

.ed-head {
  flex: none;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #eceef3;
  border-radius: 16px;
}

.ed-avatar-wrap {
  flex: none;
  display: flex;
  line-height: 0;
  border-radius: 18px;
}

/* 助理：渐变光环代替「本体」标签 —— 特殊感靠视觉，不靠文字 */
.ed-avatar-wrap--ring {
  padding: 2px;
  background: linear-gradient(135deg, #ffb35c, #ff7a59 55%, #7b61ff);
}

.ed-name--assistant {
  color: #6a5df0;
}

.ed-avatar {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 16px;
  object-fit: cover;
  background: #f2f3f6;
}

.ed-avatar--letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #8478fa, #5b7fff);
}

/* 挤窄时描述会被压成"一列一个字"，给个下限让 stats/按钮先换行 */
.ed-id {
  flex: 1;
  min-width: 220px;
}

.ed-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ed-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2f3547;
}

/* 可就地改的文本：平时看不出来，hover 才浮出一块底，暗示"这儿能点" */
.ed-editable {
  margin-left: -6px;
  padding: 1px 6px;
  border-radius: 7px;
  cursor: text;
  transition: background 0.15s;
}

.ed-editable:hover {
  background: #f4f5f9;
}

.ed-name-input {
  min-width: 0;
  width: 220px;
  padding: 0 6px;
  font-size: 18px;
  font-weight: 700;
  font-family: inherit;
  color: #2f3547;
  background: #fff;
  border: 1px solid #b9b2fb;
  border-radius: 7px;
  outline: none;
}

.ed-desc-input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 5px 7px;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 20px;
  font-family: inherit;
  color: #5b6272;
  background: #fff;
  border: 1px solid #b9b2fb;
  border-radius: 8px;
  outline: none;
  resize: vertical;
}

.ed-ver {
  padding: 1px 6px;
  font-size: 11px;
  color: #9aa0ad;
  background: #f4f5f9;
  border-radius: 5px;
}

/* 有新版才出现：说清「更新到哪一版」，别只写「可更新」 */
.ed-update {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  font-size: 11.5px;
  color: #b26a00;
  background: #fff6e5;
  border: 1px solid #ffe0a3;
  border-radius: 20px;
  cursor: pointer;
}

.ed-update:hover:not(:disabled) {
  background: #ffefd0;
}

.ed-update:disabled {
  cursor: default;
  opacity: 0.7;
}

.ed-update-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff9a2e;
}

.ed-badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #6a5df0;
  background: #f0eeff;
  border-radius: 6px;
}

.ed-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}

.ed-meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}

.ed-meta-k {
  font-style: normal;
  font-size: 11px;
  color: #a8b0c0;
}

.ed-meta-v {
  font-weight: 500;
  font-size: 12px;
  color: #5b6272;
}

.ed-meta-v--empty {
  color: #c2c7d0;
}

.ed-meta-sep {
  width: 1px;
  height: 11px;
  background: #e6e8ee;
}

/* 来源链接：紫 + 外链箭头，hover 才出下划线，静态时不喧宾夺主 */
.ed-meta-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: #6a5df0;
  background: none;
  border: none;
  cursor: pointer;
}

.ed-meta-link:hover {
  text-decoration: underline;
}

.ed-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: #91949e;
}

.ed-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
}

.ed-tags {
  align-items: center;
  min-height: 22px;
}

.ed-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  color: #6b7183;
  background: #f4f5f9;
  border-radius: 6px;
}

/* ✕ 平时不占位（width:0），hover 整枚标签才撑开 —— 一排叉子太吵 */
.ed-tag-x {
  width: 0;
  overflow: hidden;
  padding: 0;
  font-size: 10px;
  color: #a8b0c0;
  background: none;
  border: none;
  cursor: pointer;
  transition: width 0.12s;
}

.ed-tag:hover .ed-tag-x {
  width: 11px;
}

.ed-tag-x:hover {
  color: #e0603c;
}

.ed-tag-add {
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  color: #a8b0c0;
  background: none;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.ed-tag-add:hover {
  color: #6a5df0;
  border-color: #b9b2fb;
}

.ed-tag-input {
  width: 82px;
  padding: 1px 7px;
  font-size: 11px;
  line-height: 16px;
  font-family: inherit;
  color: #2f3547;
  background: #fff;
  border: 1px solid #b9b2fb;
  border-radius: 6px;
  outline: none;
}

/* 右侧只有动作按钮，跟头像顶对齐 —— 之前统计和按钮混在一起，高度对不上就显得乱 */
.ed-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.ed-chat {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #436ff6, #5b7fff);
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.ed-chat:hover {
  filter: brightness(1.06);
}

.ed-dismiss {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  color: #6b7183;
  background: #fff;
  border: 1px solid #e6e7ec;
  border-radius: 10px;
  cursor: pointer;
}

.ed-dismiss:hover {
  color: #e5484d;
  border-color: #f5c2c4;
  background: #fff7f7;
}

/* ── 解聘确认 ── */
.ed-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(23, 26, 35, 0.38);
}

.ed-dialog {
  width: 360px;
  padding: 22px 22px 18px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(23, 26, 35, 0.18);
}

.ed-dialog-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #2f3547;
}

.ed-dialog-text {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 20px;
  color: #6b7183;
}

.ed-dialog-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ed-dialog-cancel,
.ed-dialog-ok {
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: 9px;
  cursor: pointer;
}

.ed-dialog-cancel {
  color: #6b7183;
  background: #fff;
  border: 1px solid #e6e7ec;
}

.ed-dialog-ok {
  color: #fff;
  background: #e5484d;
  border: none;
}

.ed-dialog-ok:disabled {
  opacity: 0.7;
  cursor: default;
}

.ed-body {
  flex: 1;
  min-height: 0;
  margin-top: 14px;
  display: flex;
  gap: 14px;
  overflow: hidden;
}

/* 左主区：效能在上、工作记录在下，一起吃掉剩余宽度 */
.ed-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  /* 让 EmployeeWorkLogPane 里的两栏按「主区实际多宽」决定要不要堆叠 */
  container-type: inline-size;
}

/* PersonaManagePanel 原本是窄侧栏，这里固定成右侧一条，别跟主区抢宽度。
   选择器必须带上父级 —— 单 class 会和子组件自己的 .persona-manage-panel 特异性打平，
   后加载的子组件样式会赢 */
.ed-body > .ed-panel {
  flex: none;
  width: 380px;
  height: 100%;
}

/* 变窄优先保左主区（效能/工作记录才是这页的主角）：
   右侧配置栏先收窄，再窄就整条藏掉 —— 用容器查询而不是 @media，
   因为右边随时会弹出定时任务/文件/待办面板，视口没变、主区却被挤掉一半。 */
/* 阈值按「主区 content 宽」定：1440 视口下这里只有 842px（左侧 nav + 二级栏 + 工具栏吃掉一大半），
   再弹个面板就只剩 500 出头 —— 所以收窄点早、隐藏点更早 */
@container (max-width: 1000px) {
  .ed-body > .ed-panel {
    width: 320px;
  }
}

@container (max-width: 700px) {
  .ed-body > .ed-panel {
    display: none;
  }
}
</style>
