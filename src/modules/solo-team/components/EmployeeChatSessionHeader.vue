<template>
  <div class="solo-team-header">
    <div class="header-left">
      <div ref="employeeSessionSwitcherRef" class="employee-session-switcher">
        <button
          type="button"
          class="employee-session-trigger"
          @click="showEmployeeSessionMenu = !showEmployeeSessionMenu"
        >
          <span class="employee-session-prefix">会话：</span>
          <span class="employee-session-title">{{ currentEmployeeThread?.title || '新对话' }}</span>
          <span class="employee-session-arrow" :class="{ open: showEmployeeSessionMenu }"></span>
        </button>
        <div v-if="showEmployeeSessionMenu" class="employee-session-menu">
          <button
            v-if="sessionStore.employeeChatMode !== 'one_person_team'"
            type="button"
            class="employee-session-create"
            @click="handleEmployeeThreadCreate"
          >
            <img
              class="employee-session-create-icon"
              :src="threadAddIcon"
              alt=""
              aria-hidden="true"
            />
            <span>新增会话</span>
          </button>
          <div
            v-for="thread in currentEmployeeThreads"
            :key="thread.id"
            class="employee-session-row"
            :class="{ active: currentEmployeeThread?.id === thread.id }"
            role="button"
            tabindex="0"
            @click="handleEmployeeThreadSelect(thread)"
            @keydown.enter.prevent="handleEmployeeThreadSelect(thread)"
          >
            <img
              class="employee-session-thread-icon"
              :src="threadItemIcon"
              alt=""
              aria-hidden="true"
            />
            <span class="employee-session-item-title">{{ thread.title || '新对话' }}</span>
            <span class="employee-session-row-actions">
              <img
                v-if="currentEmployeeThread?.id === thread.id"
                class="employee-session-check"
                :src="threadSelectIcon"
                alt=""
                aria-hidden="true"
              />
              <button
                v-if="currentEmployeeThreads.length > 1"
                type="button"
                class="employee-session-remove"
                @click.stop="handleRemoveThread(thread)"
              >
                删除
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="header-right">
      <el-tooltip
        :content="managePanelLabel"
        placement="bottom"
        effect="dark"
        append-to="#app"
        strategy="fixed"
        :popper-options="workspaceHeaderTooltipPopperOptions"
      >
        <button
          type="button"
          class="icon-btn"
          :class="{ active: uiStore.digitalEmployeePanelVisible }"
          :aria-label="managePanelLabel"
          @click="uiStore.setActiveToolTab('digitalEmployee')"
        >
          <SvgIcon name="icon-tuanduiguanli" :size="18" color="#2f3547" />
          <span v-if="hasNewVersion" class="manage-update-dot" aria-hidden="true"></span>
        </button>
      </el-tooltip>
    </div>
  </div>
  <Teleport to="body">
    <!-- 与 DeerflowThreadList 分身侧栏「删除会话」确认弹框同结构、同样式 -->
    <div
      v-if="removeThreadDialog.visible"
      class="delete-dialog-mask"
      @click.self="cancelRemoveThreadDialog"
    >
      <div class="delete-dialog delete-dialog--remove-thread">
        <div class="delete-dialog-header">
          <div class="delete-dialog-header-main">
            <img src="@/assets/deerflowChat/warning.svg" alt="" class="delete-dialog-icon" />
            <span class="delete-dialog-title">确认删除该会话吗</span>
          </div>
          <button type="button" class="delete-dialog-close" @click="cancelRemoveThreadDialog">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <p class="delete-dialog-desc">删除后，该会话聊天记录不可恢复</p>
        <div class="delete-dialog-footer">
          <button type="button" class="delete-dialog-btn delete-dialog-btn--cancel" @click="cancelRemoveThreadDialog">
            取消
          </button>
          <button type="button" class="delete-dialog-btn delete-dialog-btn--confirm" @click="confirmRemoveThreadDialog">
            确认
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, reactive, watch, onBeforeUnmount, nextTick, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { useSoloTeamStore } from '../store'
import { useUIStore } from '@/modules/space/uiStore'
import { EMPLOYEE_CHAT_SESSION_STORE_KEY } from '@/shared/constants/injectionKeys'
import { soloTeamApiErrorMessage } from '@/modules/solo-team/utils/apiErrorMessage'

import threadAddIcon from '@/assets/soloTeam/thread_add.png'
import threadItemIcon from '@/assets/soloTeam/thread_1.png'
import threadSelectIcon from '@/assets/soloTeam/select.svg'

defineOptions({ name: 'EmployeeChatSessionHeader' })

const props = defineProps({
  /** solo-team：同步左侧导航；collaboration：仅更新 store，二级导航保持 digital-human-* */
  variant: {
    type: String,
    default: 'solo-team',
    validator: (v) => v === 'solo-team' || v === 'collaboration',
  },
})

const injectedSessionStore = inject(EMPLOYEE_CHAT_SESSION_STORE_KEY, null)
const sessionStore = injectedSessionStore ?? useSoloTeamStore()
const uiStore = useUIStore()

const showEmployeeSessionMenu = ref(false)
const employeeSessionSwitcherRef = ref(null)

const removeThreadDialog = reactive({ visible: false, thread: null })

const currentEmployee = computed(() => sessionStore.currentEmployee)
const currentEmployeeThread = computed(() => sessionStore.currentEmployeeThread)
const currentEmployeeThreads = computed(() => {
  const sid = sessionStore.currentEmployeeId
  if (!sid) return []
  return sessionStore.getEmployeeThreads(sid)
})

const workspaceHeaderTooltipPopperOptions = Object.freeze({
  modifiers: [{ name: 'preventOverflow', options: { padding: 10 } }],
})

const managePanelLabel = computed(() =>
  props.variant === 'collaboration' ? '数字人管理' : '数字员工管理',
)

/** 员工来自市场，市场有更新版本时管理按钮提示红点 */
const hasNewVersion = computed(() => {
  const emp = currentEmployee.value
  const latest = emp?.latestVersion ?? emp?.raw?.latestVersion
  const cur = emp?.version ?? emp?.raw?.version
  return !!latest && latest !== cur
})

function onEmployeeSessionDocumentClick(e) {
  if (!showEmployeeSessionMenu.value) return
  const root = employeeSessionSwitcherRef.value
  if (root && e.target instanceof Node && !root.contains(e.target)) {
    showEmployeeSessionMenu.value = false
  }
}

watch(showEmployeeSessionMenu, (open) => {
  if (open) {
    nextTick(() => {
      if (!showEmployeeSessionMenu.value) return
      document.addEventListener('click', onEmployeeSessionDocumentClick)
    })
  } else {
    document.removeEventListener('click', onEmployeeSessionDocumentClick)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onEmployeeSessionDocumentClick)
  cancelRemoveThreadDialog()
})

function syncNavAfterThread(employeeIdOrSid, threadId) {
  if (props.variant === 'solo-team') {
    if (String(employeeIdOrSid).startsWith('optTeam_')) {
      const teamId = String(employeeIdOrSid).slice('optTeam_'.length)
      uiStore.setActiveNavigation('solo-team', `one-person-team:${teamId}:${threadId}`)
      return
    }
    uiStore.setActiveNavigation('solo-team', `employee:${employeeIdOrSid}:${threadId}`)
    return
  }
  const agentId = currentEmployee.value?.id || employeeId
  if (agentId) {
    uiStore.setActiveNavigation('collaboration', `digital-human-${agentId}`)
  }
}

async function handleEmployeeThreadSelect(thread) {
  const sid = sessionStore.currentEmployeeId
  if (!sid || !thread?.id) return
  await sessionStore.selectEmployeeThread(sid, thread.id)
  syncNavAfterThread(sid, thread.id)
  showEmployeeSessionMenu.value = false
}

async function handleEmployeeThreadCreate() {
  const sid = sessionStore.currentEmployeeId
  if (!sid) return
  const thread = await sessionStore.createEmployeeThread(sid)
  if (!thread?.id) return
  syncNavAfterThread(sid, thread.id)
  showEmployeeSessionMenu.value = false
}

/** 移除会话：与「我的分身」侧栏一致走 DELETE /kooky-api/api/personal/threads/{id}（employeeThreadApi.deleteThread） */
function handleRemoveThread(thread) {
  if (!currentEmployee.value?.id || !thread?.id) return
  removeThreadDialog.thread = thread
  removeThreadDialog.visible = true
  showEmployeeSessionMenu.value = false
}

function cancelRemoveThreadDialog() {
  removeThreadDialog.visible = false
  removeThreadDialog.thread = null
}

async function confirmRemoveThreadDialog() {
  const thread = removeThreadDialog.thread
  cancelRemoveThreadDialog()
  if (!currentEmployee.value?.id || !thread?.id) return
  const eid = currentEmployee.value.id
  try {
    await sessionStore.deleteEmployeeThread(eid, thread.id)
    let tid = sessionStore.currentEmployeeThreadId
    if (!tid) {
      const created = await sessionStore.createEmployeeThread(eid)
      tid = created?.id ?? null
    }
    if (tid) {
      syncNavAfterThread(eid, tid)
    }
  } catch (err) {
    console.error('[EmployeeChatSessionHeader] deleteEmployeeThread failed:', err)
    ElMessage.error(soloTeamApiErrorMessage(err, '删除失败，请稍后重试'))
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/cancel-button.scss' as cancel-btn;
@use '@/shared/styles/delete-confirm-dialog.scss' as delete-confirm;

.solo-team-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 10px;
  height: 48px;
  flex-shrink: 0;
  background: #fff;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.employee-session-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 280px;
  z-index: 20;
}

.employee-session-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 280px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.employee-session-trigger:hover {
  background: rgba(47, 53, 71, 0.06);
}

.employee-session-prefix {
  flex-shrink: 0;
  color: #2f3547;
}

.employee-session-title,
.employee-session-item-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-session-arrow {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-right: 1px solid #8d93a6;
  border-bottom: 1px solid #8d93a6;
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.16s ease;
}

.employee-session-arrow.open {
  transform: rotate(-135deg) translateY(-1px);
}

.employee-session-menu {
  position: absolute;
  top: 34px;
  left: 0;
  width: 224px;
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(47, 53, 71, 0.12);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-session-create {
  width: 100%;
  min-height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 0 8px;
  text-align: left;
  color: #2f3547;
  font-size: 12px;
  justify-content: flex-start;
  margin-bottom: 2px;
}

.employee-session-create:hover {
  background: #F5F6F9;
}

.employee-session-create-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.employee-session-thread-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.employee-session-row {
  width: 100%;
  min-height: 36px;
  border-radius: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 0 8px;
  color: #2f3547;
  font-size: 12px;
  outline: none;
}

.employee-session-row:hover,
.employee-session-row.active {
  background: #F5F6F9;
}

.employee-session-row-actions {
  position: relative;
  width: 36px;
  min-width: 36px;
  height: 20px;
  flex-shrink: 0;
  margin-left: auto;
}

.employee-session-check {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

.employee-session-remove {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  padding: 2px 4px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: #f5f6f9;
  color: #ff4d4f;
  font-size: 12px;
  cursor: pointer;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.employee-session-row:hover .employee-session-remove,
.employee-session-row:focus-within .employee-session-remove {
  opacity: 1;
  pointer-events: auto;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: #2f3547;
  cursor: pointer;
  &:hover {
    background: rgba(47, 53, 71, 0.06);
    color: var(--text-primary);
  }
  &.active {
    background: rgba(47, 53, 71, 0.06);
    color: var(--accent);
  }
}

.manage-update-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff4d4f;
  border: 1.5px solid #fff;
}

/* 与 deerflow-chat/components/DeerflowThreadList.vue 删除确认弹框一致 */
.delete-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog {
  position: relative;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.delete-dialog--remove-thread {
  box-sizing: border-box;
  width: 480px;
  height: 172px;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 16px;

  @include delete-confirm.delete-dialog-header-row;

  .delete-dialog-desc {
    flex: 1;
    margin: 0 0 0 28px;
    line-height: 1.5;
  }

  .delete-dialog-footer {
    flex-shrink: 0;
    margin-top: auto;
  }
}

.delete-dialog-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.delete-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  word-break: break-word;
}

.delete-dialog-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 28px;
  line-height: 1.6;
}

.delete-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-dialog-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  &:hover {
    opacity: 0.85;
  }
}

.delete-dialog-btn--cancel {
  @include cancel-btn.solo-team-cancel-button;
}

.delete-dialog-btn--confirm {
  background: #1f2937;
  color: #fff;
}
</style>
