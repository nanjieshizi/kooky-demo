<template>
  <el-dialog
    :model-value="visible"
    title="添加数字员工"
    width="628px"
    align-center
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="add-digital-employee-dialog"
    @close="handleClose"
  >
    <div class="add-digital-employee__member-row">
      <label class="add-digital-employee__team-label">选择成员</label>
      <div class="add-digital-employee__layout">
        <section class="add-digital-employee__col add-digital-employee__col--left">
          <div class="add-digital-employee__picker">
            <div class="add-digital-employee__search">
              <el-icon :size="14" class="add-digital-employee__search-icon"><Search /></el-icon>
              <input
                v-model="searchQuery"
                class="add-digital-employee__search-input"
                placeholder="搜索数字员工"
              />
            </div>
            <div class="add-digital-employee__candidate-list">
              <div v-if="loading" class="add-digital-employee__empty">加载中…</div>
              <template v-else-if="filteredAgents.length">
                <button
                  v-for="agent in filteredAgents"
                  :key="agent.id"
                  type="button"
                  class="add-digital-employee__candidate"
                  :class="{ 'add-digital-employee__candidate--disabled': isExisting(agent) }"
                  @click="toggleAgent(agent)"
                >
                  <span
                    class="add-digital-employee__checkbox"
                    :class="{
                      'add-digital-employee__checkbox--checked': selectedMap.has(String(agent.id)),
                      'add-digital-employee__checkbox--disabled': isExisting(agent),
                    }"
                  >
                    <el-icon v-if="selectedMap.has(String(agent.id)) || isExisting(agent)"><Check /></el-icon>
                  </span>
                  <span class="add-digital-employee__avatar-wrap">
                    <img :src="agent.avatar || defaultAgentAvatar" alt="" class="add-digital-employee__avatar" @error="onAvatarError" />
                    <span
                      v-if="agent.presence"
                      class="add-digital-employee__presence"
                      :class="`add-digital-employee__presence--${agent.presence}`"
                    />
                  </span>
                  <span class="add-digital-employee__info">
                    <span class="add-digital-employee__name">{{ agent.name || `Agent ${agent.id}` }}</span>
                    <span class="add-digital-employee__sub">{{ subtitleOf(agent) }}</span>
                  </span>
                </button>
              </template>
              <div v-else class="add-digital-employee__empty">暂无可添加的数字员工</div>
            </div>
          </div>
        </section>

        <section class="add-digital-employee__col add-digital-employee__col--right">
          <div class="add-digital-employee__selected-header">
            已选 <span class="add-digital-employee__selected-count">{{ selectedList.length }}</span> 个
          </div>
          <div class="add-digital-employee__selected-list">
            <div v-for="item in selectedList" :key="item.id" class="add-digital-employee__selected-row">
              <span class="add-digital-employee__avatar-wrap">
                <img :src="item.avatar || defaultAgentAvatar" alt="" class="add-digital-employee__avatar" @error="onAvatarError" />
                <span
                  v-if="item.presence"
                  class="add-digital-employee__presence"
                  :class="`add-digital-employee__presence--${item.presence}`"
                />
              </span>
              <span class="add-digital-employee__info">
                <span class="add-digital-employee__name">{{ item.name }}</span>
                <span class="add-digital-employee__sub">{{ subtitleOf(item) }}</span>
              </span>
              <button type="button" class="add-digital-employee__remove" @click="removeSelected(item)">×</button>
            </div>
            <div v-if="!selectedList.length" class="add-digital-employee__empty">尚未选择</div>
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="add-digital-employee__btn add-digital-employee__btn--cancel"
        :disabled="confirmLoading"
        @click="handleClose"
      >取消</button>
      <button
        type="button"
        class="add-digital-employee__btn add-digital-employee__btn--confirm"
        :disabled="confirmLoading || !canConfirm"
        @click="handleConfirm"
      >{{ confirmLoading ? '处理中…' : '确定' }}</button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Check, Search } from '@element-plus/icons-vue'
import { useSoloTeamStore } from '../store'
import defaultAgentAvatar from '@/assets/default-agent-avatar.svg'
import { resolveEmployeePresence } from '../utils/employeePresence'

defineOptions({ name: 'AddDigitalEmployeeDialog' })

const props = defineProps({
  visible: { type: Boolean, default: false },
  existingAgentIds: { type: Array, default: () => [] },
  coordinatorId: { type: [String, Number, null], default: null },
  confirmLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirm'])

const soloTeamStore = useSoloTeamStore()

const searchQuery = ref('')
const selectedMap = ref(new Map())

const loading = computed(() => soloTeamStore.privateAgentsLoading)

const existingSet = computed(() => new Set((props.existingAgentIds || []).map(String)))

const availableAgents = computed(() => {
  const list = Array.isArray(soloTeamStore.privateAgents) ? soloTeamStore.privateAgents : []
  return list
    .filter((agent) => agent?.id != null)
    .filter((agent) => !isPersonalDefaultAssistant(agent))
    .map((agent) => ({
      id: String(agent.id),
      name: agent.name || '',
      avatar: agent.avatar || agent.icon || '',
      description: agent.description || '',
      job_title: agent.job_title || '',
      team_name: agent.team_name || '',
      stateful: agent.stateful !== false,
      presence: resolveEmployeePresence(agent, 'idle'),
      raw: agent.raw || agent,
    }))
})

const filteredAgents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return availableAgents.value
  return availableAgents.value.filter((agent) => {
    const name = (agent.name || '').toLowerCase()
    return name.includes(q)
  })
})

const selectedList = computed(() => [...selectedMap.value.values()])

const canConfirm = computed(() => selectedList.value.length > 0)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      searchQuery.value = ''
      selectedMap.value = new Map()
      void soloTeamStore.loadPrivateAgentsForTeam({ force: true })
    }
  },
)

function subtitleOf(agent) {
  return agent.job_title || agent.team_name || agent.description || '数字员工'
}

function isPersonalDefaultAssistant(agent) {
  const raw = agent?.raw || agent || {}
  return Boolean(
    agent?.isDefault
      ?? raw?.is_default
      ?? raw?.isDefault
      ?? false
  )
}

function isExisting(agent) {
  return existingSet.value.has(String(agent.id))
}

function toggleAgent(agent) {
  if (isExisting(agent)) return
  const id = String(agent.id)
  const next = new Map(selectedMap.value)
  if (next.has(id)) next.delete(id)
  else next.set(id, agent)
  selectedMap.value = next
}

function removeSelected(item) {
  const next = new Map(selectedMap.value)
  next.delete(String(item.id))
  selectedMap.value = next
}

function onAvatarError(e) {
  if (e?.target) e.target.src = defaultAgentAvatar
}

function handleClose() {
  if (props.confirmLoading) return
  emit('update:visible', false)
}

function handleConfirm() {
  if (props.confirmLoading || !canConfirm.value) return
  emit('confirm', selectedList.value.map((item) => ({ ...item, raw: item.raw })))
}
</script>

<style scoped>
.add-digital-employee__member-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: start;
  gap: 0;
}

.add-digital-employee__team-label {
  padding-top: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #2f3547;
  line-height: 20px;
}

.add-digital-employee__layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  height: min(404px, calc(100vh - 176px));
  min-height: 280px;
  border: 1px solid #E8ECEF;
  border-radius: 12px;
  overflow: hidden;
}

.add-digital-employee__col {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.add-digital-employee__col--left {
  border-right: 1px solid #E8ECEF;
}

.add-digital-employee__col--right {
  background: #F7F8FA;
}

.add-digital-employee__selected-header {
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 400;
  color: #91949E;
  line-height: 20px;
}

.add-digital-employee__selected-count {
  margin: 0 4px;
  color: #2F3547;
  font-weight: 600;
}

.add-digital-employee__picker {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 0 0 8px;
}

.add-digital-employee__search {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 8px 12px;
  padding: 0 10px;
  background: #F7F8FA;
  border-radius: 8px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.add-digital-employee__search-icon {
  color: #C2C3C9;
}

.add-digital-employee__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #2f3547;
  line-height: 20px;
}

.add-digital-employee__search-input::placeholder {
  color: #C2C3C9;
}

.add-digital-employee__candidate-list,
.add-digital-employee__selected-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

.add-digital-employee__candidate,
.add-digital-employee__selected-row {
  width: 100%;
  min-height: 52px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  box-sizing: border-box;
  overflow: hidden;
}

.add-digital-employee__candidate {
  width: calc(100% - 16px);
  margin: 0 8px;
  cursor: pointer;
}

.add-digital-employee__candidate:hover {
  background: rgba(47, 53, 71, 0.06);
}

.add-digital-employee__candidate--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.add-digital-employee__checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 1.5px solid #dcdfe6;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #fff;
  box-sizing: border-box;
}

.add-digital-employee__checkbox--checked {
  border-color: #ff5233;
  background: #ff5233;
}

.add-digital-employee__checkbox--disabled {
  border-color: #d8d8e2;
  background: #E9EBEE;
  color: #fff;
}

.add-digital-employee__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.add-digital-employee__avatar-wrap {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.add-digital-employee__presence {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 7px;
  height: 7px;
  border: 2px solid #FFFFFF;
  border-radius: 50%;
  box-sizing: content-box;
  pointer-events: none;
}

.add-digital-employee__presence--busy {
  background: #FF621F;
}

.add-digital-employee__presence--idle {
  background: #07C160;
}

.add-digital-employee__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.add-digital-employee__name,
.add-digital-employee__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-digital-employee__name {
  font-size: 14px;
  color: rgba(42, 42, 42, 0.9);
  font-weight: 400;
  line-height: 20px;
}

.add-digital-employee__sub {
  font-size: 12px;
  color: rgba(42, 42, 42, 0.4);
  line-height: 20px;
}

.add-digital-employee__selected-row {
  width: calc(100% - 16px);
  min-height: 42px;
  margin: 0 8px 8px;
  padding: 0 8px;
  border-radius: 12px;
}

.add-digital-employee__selected-row:hover {
  background: rgba(47, 53, 71, 0.06);
}

.add-digital-employee__empty {
  padding: 40px 16px;
  font-size: 13px;
  color: #bfc3cc;
  text-align: center;
}

.add-digital-employee__remove {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: #99a0ad;
  font-size: 18px;
  line-height: 18px;
}

.add-digital-employee__remove:hover {
  background: rgba(47, 53, 71, 0.06);
  color: #2f3547;
}

.add-digital-employee__btn {
  width: 60px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #e6e6e6;
  background: #fff;
  color: #2f3547;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-digital-employee__btn:hover {
  background: #e6e6e6;
}

.add-digital-employee__btn + .add-digital-employee__btn {
  margin-left: 8px;
}

.add-digital-employee__btn--cancel {
  border-color: #e6e6e6;
}

.add-digital-employee__btn--confirm {
  background: #1c1a21;
  border-color: #1c1a21;
  color: #fff;
}

.add-digital-employee__btn--confirm:hover {
  background: #3d3d3d;
}

.add-digital-employee__btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.add-digital-employee__btn:disabled:hover {
  background: inherit;
}

.add-digital-employee__btn--confirm:disabled:hover {
  background: #1c1a21;
}
</style>

<style>
.add-digital-employee-dialog.el-dialog {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  max-height: calc(100vh - 48px);
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.add-digital-employee-dialog.el-dialog .el-dialog__header {
  height: 56px;
  padding: 0 24px;
  margin-right: 0;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.add-digital-employee-dialog.el-dialog .el-dialog__title {
  padding: 0 !important;
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #2f3547 !important;
  line-height: 26px !important;
}

.add-digital-employee-dialog.el-dialog .el-dialog__headerbtn {
  top: 16px !important;
  right: 20px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: none !important;
  z-index: 2;
}

.add-digital-employee-dialog.el-dialog .el-dialog__headerbtn:hover {
  background: rgba(23, 27, 38, 0.06);
}

.add-digital-employee-dialog.el-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #91949E !important;
  font-size: 16px !important;
  font-weight: 700;
}

.add-digital-employee-dialog.el-dialog .el-dialog__headerbtn .el-dialog__close svg {
  width: 16px;
  height: 16px;
  transform: scale(1.12);
}

.add-digital-employee-dialog.el-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 24px 12px;
}

.add-digital-employee-dialog.el-dialog .el-dialog__footer {
  flex-shrink: 0;
  padding: 0 24px 16px;
}
</style>
