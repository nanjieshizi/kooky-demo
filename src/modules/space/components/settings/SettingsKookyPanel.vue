<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as providerConfigApi from '@/shared/services/providerConfigApi'
import { getUserLeader } from '@/shared/services/announcementsApi'
import Loading from '@/shared/components/Loading/index.vue'
import aboutMenuIcon from '@/assets/settings/about_icon.svg'
import inputWarnIcon from '@/assets/settings/input_warn.svg'
import sanjiaoIcon from '@/assets/settings/sanjiao.svg'
import kookyLogo from '@/assets/settings/kooky.png'
import submitLoadingIconUrl from '@/assets/skill/skill-one-click-install-loading.png'

// ==================== Props & Emits ====================
const props = defineProps({
  active: { type: Boolean, default: true },
  allProviders: { type: Array, default: () => [] },
})

const emit = defineEmits(['model-count-update', 'enablement-update'])
// ==================== API State ====================
const loading = ref(true)
const providerDetail = ref(null)

// ==================== UI State ====================
const quotaApplied = ref(false)
const showApplyForm = ref(false)
const applyQuotaType = ref('fixed')
const applySubmitting = ref(false)
const applyForm = ref({
  appliedQuota: '',
  departmentId: '',
  projectId: '',
})
const leaderName = ref('')
const dialogEnabled = ref(false)
const kodeEnabled = ref(false)
const enablementSaving = ref(false)

// ==================== 所属产线 / 所属项目（AI 工具平台接口） ====================
// 产线 = 组织内全部部门（接口返回）；is_current_line 标记本产线，is_self 为用户所在部门（默认选中）。
const departments = ref([])
const projectOptions = ref([])
const projectLoading = ref(false)
const projectNameCache = ref({}) // 缓存已加载项目名，供提交时回填（搜索会替换 projectOptions）

// 产线切换开关：'current' 当前产线（默认） / 'all' 全部产线
const deptScope = ref('current')
const visibleDepartments = computed(() =>
  deptScope.value === 'current' ? departments.value.filter((d) => d.is_current_line) : departments.value
)
function toggleDeptScope() {
  deptScope.value = deptScope.value === 'current' ? 'all' : 'current'
}

async function loadQuotaDepartments() {
  try {
    const list = await providerConfigApi.fetchQuotaDepartments()
    departments.value = Array.isArray(list) ? list : []
    // 默认选中用户所在部门（is_self），兜底取本产线第一个
    if (!applyForm.value.departmentId) {
      const self = departments.value.find((d) => d.is_self) || departments.value.find((d) => d.is_current_line)
      if (self) applyForm.value.departmentId = self.id
    }
  } catch (error) {
    console.error('获取产线列表失败:', error)
    departments.value = []
  }
}

async function searchProjects(keyword) {
  projectLoading.value = true
  try {
    const list = await providerConfigApi.searchQuotaProjects(keyword)
    projectOptions.value = Array.isArray(list) ? list : []
    projectOptions.value.forEach((p) => { projectNameCache.value[p.id] = p.name })
  } catch (error) {
    console.error('搜索项目失败:', error)
    projectOptions.value = []
  } finally {
    projectLoading.value = false
  }
}

function resolveDeptName(id) {
  return departments.value.find((d) => d.id === id)?.name || ''
}
function resolveProjectName(id) {
  return projectNameCache.value[id] || ''
}

// ==================== Data Normalization ====================
function formatPrice(priceInfo) {
  if (!priceInfo) return null
  const { input, output, unit } = priceInfo
  if (input != null && output != null) {
    return `$${input}/$${output} ${unit || ''}`.trim()
  }
  return null
}

function normalizeModels(models) {
  if (!Array.isArray(models)) return []
  return models.map(m => ({
    id: m.id,
    name: m.model_alias || m.model_name || '',
    modelName: m.model_name || '',
    price: m.price_info,
    priceInfo: m.price_info,
  }))
}

function hasPendingTokenExpand(quotaData) {
  return Boolean(quotaData?.has_pending_token_expand ?? quotaData?.hasPendingTokenExpand ?? false)
}

function readBooleanFlag(...candidates) {
  for (const value of candidates) {
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1') return true
      if (normalized === 'false' || normalized === '0') return false
    }
  }
  return undefined
}

function resolveKookyEnablements(detail, listProvider) {
  const root = detail && typeof detail === 'object' ? detail : {}
  const oc = root?.channels?.['kc-oc']
  const cc = root?.channels?.['kc-cc']
  return {
    dialogEnabled: readBooleanFlag(
      root.dialog_enabled,
      root.dialogEnabled,
      oc?.dialog_enabled,
      oc?.dialogEnabled,
      oc?.enabled,
      listProvider?.dialogEnabled,
      listProvider?.dialog_enabled,
    ) ?? false,
    kodeEnabled: readBooleanFlag(
      root.kode_enabled,
      root.kodeEnabled,
      cc?.kode_enabled,
      cc?.kodeEnabled,
      cc?.enabled,
      listProvider?.kodeEnabled,
      listProvider?.kode_enabled,
    ) ?? false,
  }
}

function syncKookyEnablementState() {
  if (enablementSaving.value) return
  const kookyFromList = props.allProviders.find((p) => p.id === 'kooky')
  const resolved = resolveKookyEnablements(providerDetail.value, kookyFromList)
  dialogEnabled.value = resolved.dialogEnabled
  kodeEnabled.value = resolved.kodeEnabled
}

// ==================== Derived Data ====================
const provider = computed(() => {
  const detail = providerDetail.value
  const ocModels = detail?.channels?.['kc-oc']?.models || []
  const ccModels = detail?.channels?.['kc-cc']?.models || []
  return {
    name: detail?.display_name || 'Kooky',
    modelCount: ocModels.length + ccModels.length,
  }
})

const quota = computed(() => {
  const q = providerDetail.value?.quota
  if (!q) return { totalAmount: '', resetDate: '', usedPercent: 0, fixedQuota: 0 }
  return {
    balance: q.balance ?? 0,
    used: q.used ?? 0,
    total: q.total ?? 0,
    usedPercent: q.used_percent ?? (q.total > 0 ? Math.round((q.used / q.total) * 100) : 0),
    unit: q.unit || '$',
    quotaType: q.quota_type || 'free',
    fixedQuota: q.fixed_quota ?? 0,
    resetDate: q.reset_date || '',
    hasPendingTokenExpand: hasPendingTokenExpand(q),
    totalAmount: `${q.total ?? 0}${q.unit || '$'}/月`,
  }
})

const conversationModels = computed(() => {
  return normalizeModels(providerDetail.value?.channels?.['kc-oc']?.models)
})

const kodeModels = computed(() => {
  return normalizeModels(providerDetail.value?.channels?.['kc-cc']?.models)
})

const dialogEnabledProviderCount = computed(() => (
  props.allProviders.filter((p) => {
    const isKooky = p.id === 'kooky'
    if (isKooky) return dialogEnabled.value
    return Boolean(p.dialogEnabled ?? p.dialog_enabled)
  }).length
))

/** 全局仅一个对话启用且为 Kooky 时，不允许禁用 */
const isLastDialogEnabledProvider = computed(() => (
  dialogEnabled.value && dialogEnabledProviderCount.value === 1
))

const dialogSwitchDisabled = computed(() => (
  conversationModels.value.length === 0
  || enablementSaving.value
  || isLastDialogEnabledProvider.value
))
const showDialogSwitch = computed(() => conversationModels.value.length > 0)

const isOtherProviderKodeEnabled = computed(() => (
  props.allProviders.some((p) => p.id !== 'kooky' && Boolean(p.kodeEnabled ?? p.kode_enabled))
))

/** Kooky 为全局唯一启用的 Kode 服务商时，禁止关闭 */
const isCurrentGlobalKodeEnabledProvider = computed(() => (
  kodeEnabled.value && !isOtherProviderKodeEnabled.value
))

const kodeSwitchDisabled = computed(() => (
  kodeModels.value.length === 0
  || enablementSaving.value
  || isCurrentGlobalKodeEnabledProvider.value
))
const showKodeSwitch = computed(() => kodeModels.value.length > 0)

const activeKodeProviderName = computed(() => {
  const fromApi = props.allProviders.find((p) => p.kodeEnabled)
  if (fromApi) {
    return fromApi.name || fromApi.displayName || fromApi.display_name || ''
  }
  if (kodeEnabled.value) {
    return provider.value.name || 'Kooky'
  }
  return ''
})

/** Kode 已启用时不展示提示；未启用且已有模型时展示 */
const showKodeTip = computed(() => !kodeEnabled.value && kodeModels.value.length > 0)

const usagePercent = computed(() => quota.value.usedPercent)

const usageMeta = computed(() => {
  if (usagePercent.value >= 90) return { tip: '额度即将耗尽，请及时申请补充', color: '#ED4543', barClass: 'sdn-progress-section--danger' }
  if (usagePercent.value >= 70) return { tip: '额度剩余较少，建议提前申请补充', color: '#FF984E', barClass: 'sdn-progress-section--warning' }
  if (quota.value?.fixedQuota === 0) return { tip: '点击「申请更多额度」申请每月固定额度', color: '#11BB90', barClass: 'sdn-progress-section--normal' }
  return { tip: '额度充足，使用无忧', color: '#11BB90', barClass: 'sdn-progress-section--normal' }
})

const fixedQuotaLabel = computed(() =>
  `固定额度(${quota.value.fixedQuota}${quota.value.unit})`
)

const fixedQuotaPercent = computed(() => {
  if (!quota.value.total || !quota.value.fixedQuota) return 0
  return Math.min((quota.value.fixedQuota / quota.value.total) * 100, 100)
})

const fixedQuotaIndicatorPercent = computed(() => (
  usagePercent.value >= 100 ? 100 : fixedQuotaPercent.value
))

const fixedQuotaIndicatorAlignEnd = computed(() => fixedQuotaIndicatorPercent.value >= 90)

const showApplyButton = computed(() => true)

const applyAmountNum = computed(() => parseInt(applyForm.value.appliedQuota, 10) || 0)

const showAmountWarning = computed(() => applyAmountNum.value >= 1000)

const quotaApplyDisabled = computed(() =>
  quota.value.hasPendingTokenExpand || quotaApplied.value
)

// 前缀文案（固定/每月额度显示「固定额度」，避免用户以为是申请额外的值）
const quotaPrefixText = computed(() =>
  applyQuotaType.value === 'fixed' ? '固定额度' : '临时增加'
)

// ==================== API Methods ====================
function emitModelCountFromDetail(detail) {
  if (!detail) return
  const ocModels = detail?.channels?.['kc-oc']?.models || detail?.chat_models || detail?.chatModels || []
  const ccModels = detail?.channels?.['kc-cc']?.models || detail?.kode_models || detail?.kodeModels || []
  const chatCount = Array.isArray(ocModels) ? ocModels.length : 0
  const kodeCount = Array.isArray(ccModels) ? ccModels.length : 0
  emit('model-count-update', {
    modelCount: chatCount + kodeCount,
    chatModelCount: chatCount,
    kodeModelCount: kodeCount,
  })
}

async function fetchProviderDetail() {
  loading.value = true
  try {
    const detail = await providerConfigApi.getProviderDetail('kooky', 'all')
    providerDetail.value = detail
    syncKookyEnablementState()
    emitModelCountFromDetail(detail)
    if (!hasPendingTokenExpand(detail?.quota)) {
      quotaApplied.value = false
    }
  } catch (error) {
    console.error('获取设置信息失败:', error)
    ElMessage.error('获取设置信息失败')
  } finally {
    loading.value = false
  }
}

async function persistKookyEnablements(nextDialogEnabled, nextKodeEnabled) {
  const prevDialog = dialogEnabled.value
  const prevKode = kodeEnabled.value
  dialogEnabled.value = nextDialogEnabled
  kodeEnabled.value = nextKodeEnabled
  enablementSaving.value = true
  try {
    await providerConfigApi.updateKookyEnablements({
      dialog_enabled: nextDialogEnabled,
      kode_enabled: nextKodeEnabled,
    })
    emit('enablement-update', {
      dialogEnabled: nextDialogEnabled,
      kodeEnabled: nextKodeEnabled,
    })
  } catch (error) {
    dialogEnabled.value = prevDialog
    kodeEnabled.value = prevKode
    console.error('更新 Kooky 启用状态失败:', error)
    ElMessage.error('更新启用状态失败')
    throw error
  } finally {
    enablementSaving.value = false
  }
}

async function handleDialogEnabledChange(val) {
  if (dialogSwitchDisabled.value) return
  if (!val && isLastDialogEnabledProvider.value) {
    ElMessage.warning('对话场景至少需保留一个启用的服务商')
    return
  }
  try {
    await persistKookyEnablements(val, kodeEnabled.value)
  } catch {
    // 错误提示已在 persistKookyEnablements 中处理
  }
}

async function handleKodeEnabledChange(val) {
  if (kodeSwitchDisabled.value) return
  try {
    await persistKookyEnablements(dialogEnabled.value, val)
  } catch {
    // 错误提示已在 persistKookyEnablements 中处理
  }
}

async function handleApplySubmit() {
  if (applySubmitting.value) return

  const amount = parseInt(applyForm.value.appliedQuota, 10)

  // 基础验证
  if (!amount || amount <= 0) {
    ElMessage.warning('请输入有效的申请额度')
    return
  }

  // 最大值限制
  if (amount > 9999999999) {
    ElMessage.warning('申请额度不能超过 9,999,999,999')
    return
  }

  // 固定额度：必须大于当前固定额度
  if (applyQuotaType.value === 'fixed') {
    if (amount <= quota.value.fixedQuota) {
      ElMessage.warning('申请的目标额度必须大于当前固定额度')
      return
    }
  }
  // 临时额度：必须大于0（已在上面验证）

  // 所属产线：必填
  if (!applyForm.value.departmentId) {
    ElMessage.warning('请选择所属产线')
    return
  }

  applySubmitting.value = true
  try {
    await providerConfigApi.submitTokenExpand({
      appliedQuota: amount,
      quotaApplyType: applyQuotaType.value,
      tokenType: "kc-oc",
      // 对接新平台：所属产线（部门，必填）+ 所属项目（选填）
      departmentId: applyForm.value.departmentId,
      departmentName: resolveDeptName(applyForm.value.departmentId),
      projectId: applyForm.value.projectId || '',
      projectName: resolveProjectName(applyForm.value.projectId),
    })
    quotaApplied.value = true
    showApplyForm.value = false
    ElMessage.success('已发送申请，我们会尽快处理')
  } catch (error) {
    console.error('提交扩容申请失败:', error)
    ElMessage.error('发送失败，请重试')
  } finally {
    applySubmitting.value = false
  }
}

// ==================== UI Methods ====================
function handleRefresh() {
  fetchProviderDetail()
}

function handleApplyQuota() {
  showApplyForm.value = true
  // 所属产线：默认「当前产线」视图 + 默认选中用户所在部门；项目默认空
  deptScope.value = 'current'
  if (!applyForm.value.departmentId) {
    const self = departments.value.find((d) => d.is_self) || departments.value.find((d) => d.is_current_line)
    if (self) applyForm.value.departmentId = self.id
  }
  // 根据额度类型设置默认值
  if (applyQuotaType.value === 'fixed') {
    // 固定额度：如果为0则默认100，否则为固定额度+1
    applyForm.value.appliedQuota = String(quota.value.fixedQuota === 0 ? 100 : quota.value.fixedQuota + 1)
  } else {
    // 临时额度：默认50
    applyForm.value.appliedQuota = '50'
  }
}

async function fetchLeaderInfo() {
  try {
    const res = await getUserLeader()
    leaderName.value = res?.data?.leader?.display_name || res?.data?.leader?.username || ''
  } catch (error) {
    console.error('获取上级信息失败:', error)
    leaderName.value = ''
  }
}

function handleApplyCancel() {
  showApplyForm.value = false
  applyQuotaType.value = 'fixed'
  applyForm.value = { appliedQuota: '', departmentId: '', projectId: '' }
}

// 监听额度类型变化，更新默认值
watch(applyQuotaType, (newType) => {
  if (showApplyForm.value) {
    if (newType === 'fixed') {
      applyForm.value.appliedQuota = String(quota.value.fixedQuota === 0 ? 100 : quota.value.fixedQuota + 1)
    } else {
      applyForm.value.appliedQuota = '50'
    }
  }
})

watch(() => props.active, (val) => {
  if (val) {
    quotaApplied.value = false
    fetchProviderDetail()
    fetchLeaderInfo()
    loadQuotaDepartments()
    searchProjects('')
  }
}, { immediate: true })

watch(
  () => props.allProviders,
  () => syncKookyEnablementState(),
  { deep: true },
)

defineExpose({ refresh: fetchProviderDetail })
</script>

<template>
  <div class="sdn-body">
            <!-- <Loading :visible="loading" text="加载中..." :overlay="true" /> -->

            <!-- Provider Card -->
            <div class="sdn-provider-card">
              <div class="sdn-provider-avatar">
                <img :src="kookyLogo" alt="Kooky" class="sdn-provider-avatar__img" />
              </div>
              <div class="sdn-provider-info">
                <div class="sdn-provider-name-row">
                  <span class="sdn-provider-name">{{ provider.name }}</span>
                  <span class="sdn-official-tag">官方</span>
                </div>
                <p class="sdn-provider-desc">{{ provider.modelCount }} 个可用模型 · 官方服务</p>
              </div>
            </div>

            <!-- 额度详情 -->
            <section class="sdn-section">
              <div class="sdn-section-header sdn-section-header-refresh">
                <span class="sdn-section-title">额度详情</span>
                <button class="sdn-refresh-btn" @click="handleRefresh">
                  <!-- <Refresh /> -->
                  <svgIcon name="icon-shuaxin" class="sdn-refresh-icon" />
                </button>
              </div>
              <div class="sdn-quota-card">
                <!-- Top row -->
                <div class="sdn-quota-row sdn-quota-row--top">
                  <div class="sdn-quota-row-left">
                    <span class="sdn-quota-label">当前额度</span>
                    <span
                      class="sdn-info-icon sdn-info-icon--mask"
                      :style="{
                        WebkitMaskImage: `url(${aboutMenuIcon})`,
                        maskImage: `url(${aboutMenuIcon})`
                      }"
                    />
                    <span class="sdn-quota-warning">{{ usageMeta.tip }}</span>
                  </div>
                  <span class="sdn-quota-amount">{{ quota.totalAmount }}</span>
                </div>

                <!-- Sub row -->
                <div class="sdn-quota-row sdn-quota-row--sub">
                  <span class="sdn-quota-reset">重置时间 {{ quota.resetDate }}</span>
                  <span class="sdn-quota-used">已使用额度 {{ usagePercent }}%</span>
                </div>

                <!-- Progress -->
                <div class="sdn-progress-section" :class="usageMeta.barClass">
                  <el-progress
                    :percentage="usagePercent"
                    :show-text="false"
                    :stroke-width="8"
                    :color="usageMeta.color"
                  />
                  <div
                    class="sdn-progress-indicator"
                    :class="{
                      'sdn-progress-indicator--start': fixedQuotaIndicatorPercent === 0,
                      'sdn-progress-indicator--end': fixedQuotaIndicatorAlignEnd,
                    }"
                    :style="{ left: fixedQuotaIndicatorPercent + '%' }"
                  >
                    <img class="sdn-indicator-arrow" :src="sanjiaoIcon" />
                    <span class="sdn-indicator-label">{{ fixedQuotaLabel }}</span>
                  </div>
                </div>

                <!-- Apply area: button or inline form -->
                <div v-if="showApplyButton" class="sdn-quota-apply-area">
                  <!-- :disabled="quotaApplyDisabled" -->
                  <button
                    v-if="!showApplyForm"
                    class="sdn-apply-btn"
                    :class="{ 'is-applied': quotaApplyDisabled }"
                    :disabled="quotaApplyDisabled"
                    @click="handleApplyQuota"
                  >
                    {{ quotaApplyDisabled ? '已申请，待审批' : '申请更多额度' }}
                  </button>

                  <div v-else class="sdn-quota-form">
                    <!-- 所属产线（必填）+ 所属项目（选填）：对接新平台参数 -->
                    <div class="sdn-quota-org-row">
                      <div class="sdn-quota-org-field">
                        <div class="sdn-quota-org-label">
                          <span class="sdn-quota-org-label-text">
                            所属产线<span class="sdn-quota-org-required">*</span>
                            <el-tooltip content="用户额度费用由所属产线承担" placement="top">
                              <span class="sdn-quota-help">?</span>
                            </el-tooltip>
                          </span>
                          <span class="sdn-quota-scope-toggle" @click="toggleDeptScope">
                            {{ deptScope === 'current' ? '当前产线' : '全部产线' }}
                            <span class="sdn-quota-scope-switch">切换</span>
                          </span>
                        </div>
                        <el-select
                          v-model="applyForm.departmentId"
                          class="sdn-quota-org-select"
                          placeholder="请选择所属产线"
                          filterable
                        >
                          <el-option
                            v-for="dept in visibleDepartments"
                            :key="dept.id"
                            :label="dept.name"
                            :value="dept.id"
                          />
                        </el-select>
                      </div>
                      <div class="sdn-quota-org-field">
                        <div class="sdn-quota-org-label">
                          <span>所属项目<span class="sdn-quota-org-optional">（选填）</span></span>
                        </div>
                        <el-select
                          v-model="applyForm.projectId"
                          class="sdn-quota-org-select"
                          placeholder="搜索选择项目"
                          filterable
                          remote
                          clearable
                          :remote-method="searchProjects"
                          :loading="projectLoading"
                        >
                          <el-option
                            v-for="proj in projectOptions"
                            :key="proj.id"
                            :label="proj.name"
                            :value="proj.id"
                          />
                        </el-select>
                      </div>
                    </div>

                    <!-- 第一行：单选组 横排 -->
                    <div class="sdn-quota-type-row">
                      <label
                        class="sdn-quota-type-option"
                        :class="{ active: applyQuotaType === 'fixed' }"
                        @click="applyQuotaType = 'fixed'"
                      >
                        <span class="sdn-quota-type-radio">
                          <span v-if="applyQuotaType === 'fixed'" class="sdn-quota-type-radio-dot" />
                        </span>
                        <span class="sdn-quota-type-label">每月额度<span class="sdn-quota-type-label-tip">（月底自动续费）</span></span>
                      </label>

                      <label
                        class="sdn-quota-type-option"
                        :class="{ active: applyQuotaType === 'temporary' }"
                        @click="applyQuotaType = 'temporary'"
                      >
                        <span class="sdn-quota-type-radio">
                          <span v-if="applyQuotaType === 'temporary'" class="sdn-quota-type-radio-dot" />
                        </span>
                        <span class="sdn-quota-type-label">临时额度<span class="sdn-quota-type-label-tip">（仅在本月生效）</span></span>
                      </label>
                    </div>

                    <!-- 第二行：输入框 + 按钮 -->
                    <div class="sdn-quota-action-row">
                      <el-input
                        v-model="applyForm.appliedQuota"
                        class="sdn-quota-action-input"
                        placeholder="请输入申请额度"
                        maxlength="10"
                        @input="val => { applyForm.appliedQuota = val.replace(/\D/g, '') }"
                      >
                        <template #prepend>
                          {{ quotaPrefixText }}
                          <div class="sdn-line"></div>
                        </template>
                        <template #append>$</template>
                      </el-input>
                      <div class="sdn-quota-action-btns">
                        <el-button class="sdn-quota-form-btn-cancel" @click="handleApplyCancel">取消</el-button>
                        <el-button
                          class="sdn-quota-form-btn-submit"
                          :class="{ 'is-submitting': applySubmitting }"
                          type="primary"
                          :disabled="applySubmitting"
                          @click="handleApplySubmit"
                        >
                          <span class="sdn-quota-form-btn-submit__inner">
                            <img
                              v-if="applySubmitting"
                              class="sdn-quota-form-btn-submit__spinner"
                              :src="submitLoadingIconUrl"
                              width="14"
                              height="14"
                              alt=""
                              aria-hidden="true"
                              draggable="false"
                            />
                            <span>提交申请</span>
                          </span>
                        </el-button>
                      </div>
                    </div>
                    <!-- 第三行：高额度提醒 -->
                    <div v-if="showAmountWarning" class="sdn-quota-warning-hint">
                      <img class="sdn-quota-warning-icon" :src="inputWarnIcon" />
                      <span>当前申请额度较高，请确认后再提交申请</span>
                    </div>
                  </div>
                  <div v-if="showApplyForm" class="sdn-quota-tip">
                  <span
                      class="sdn-info-icon sdn-info-icon--mask"
                      :style="{
                        WebkitMaskImage: `url(${aboutMenuIcon})`,
                        maskImage: `url(${aboutMenuIcon})`
                      }"
                    />提交申请后，审批将流转至上级 <span v-if="leaderName" class="highlight">{{ leaderName }}</span><span v-else class="highlight">上级</span> 处理，如有疑问请联系平台运营罗林汉、孙立张</div>
                </div>
              </div>
            </section>

            <!-- 对话 -->
            <section class="sdn-section">
              <div class="sdn-section-header sdn-section-header--switch">
                <div class="sdn-section-header__left">
                  <span class="sdn-section-title">对话</span>
                  <span class="sdn-section-badge">{{ conversationModels.length }}</span>
                </div>
                <div class="sdn-section-header__right">
                  <span
                    v-if="showDialogSwitch"
                    class="sdn-switch-status"
                  >{{ dialogEnabled ? '已启用' : '未启用' }}</span>
                  <el-switch
                    v-if="showDialogSwitch"
                    :model-value="dialogEnabled"
                    size="small"
                    :disabled="dialogSwitchDisabled"
                    @change="handleDialogEnabledChange"
                  />
                </div>
              </div>
              <div v-if="conversationModels.length" class="sdn-model-list">
                <div
                  v-for="model in conversationModels"
                  :key="model.id"
                  class="sdn-model-item"
                >
                  <span class="sdn-model-name">{{ model.name }}</span>
                  <div class="sdn-model-tags">
                    <template v-if="model.price">
                      <span class="sdn-price-text">{{ model.price }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <div v-else class="sdn-model-empty">暂无对话模型</div>
            </section>
            <!-- Kode -->
            <section class="sdn-section">
              <div class="sdn-section-header sdn-section-header--switch">
                <div class="sdn-section-header__left">
                  <span class="sdn-section-title">Kode</span>
                  <span class="sdn-section-badge">{{ kodeModels.length }}</span>
                </div>
                <div class="sdn-section-header__right">
                  <span
                    v-if="showKodeSwitch"
                    class="sdn-switch-status"
                  >{{ kodeEnabled ? '已启用' : '未启用' }}</span>
                  <el-switch
                    v-if="showKodeSwitch"
                    :model-value="kodeEnabled"
                    size="small"
                    :disabled="kodeSwitchDisabled"
                    @change="handleKodeEnabledChange"
                  />
                </div>
              </div>

              <div v-if="showKodeTip" class="sdn-kode-tip">
                <div>同一时段仅可启用一个 Kode 模型服务商，切换后原有服务商自动停用</div>
                <div v-if="activeKodeProviderName">
                  当前生效：<strong>{{ activeKodeProviderName }}</strong>
                </div>
                <div v-else>当前无生效Kode 模型服务商</div>
              </div>
              <div v-if="kodeModels.length" class="sdn-model-list">
                <div
                  v-for="model in kodeModels"
                  :key="model.id"
                  class="sdn-model-item"
                >
                  <span class="sdn-model-name">{{ model.name }}</span>
                  <div class="sdn-model-tags">
                    <template v-if="model.price">
                      <span class="sdn-price-text">{{ model.price }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <div v-else class="sdn-model-empty">暂无Kode模型</div>
            </section>
  </div>
</template>

<style lang="scss" scoped src="./settingsKookyPanel.scss"></style>

<style lang="scss" scoped>
/* Element Plus 穿透：写在 SFC scoped 块内 */
.sdn-progress-section {
  :deep(.el-progress-bar__outer) {
    height: 14px !important;
    border-radius: 10px;
    background: #FFFFFF;
    border: 2px solid #FFFFFF;
  }
}

.sdn-progress-section--normal {
  :deep(.el-progress-bar__inner) {
    background: linear-gradient(270deg, #11BB90 0%, #28B6C5 98%) !important;
  }
}

.sdn-progress-section--warning {
  :deep(.el-progress-bar__inner) {
    background: linear-gradient(270deg, #FF984E 0%, #FFCA7A 98%) !important;
  }
}

.sdn-progress-section--danger {
  :deep(.el-progress-bar__inner) {
    background: linear-gradient(270deg, #ED4543 1%, #FF8361 100%) !important;
  }
}

.sdn-quota-action-input {
  :deep(.el-input-group__prepend) {
    position: relative;
    background: #fff;
    color: #2F3547;
    font-weight: 500 !important;
    padding: 0 10px 0 12px;
    border-radius: 6px 0 0 6px;
    transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
  }

  :deep(.el-input__wrapper) {
    border-radius: 0;
    box-shadow: 0 1px 0 0 var(--el-input-border-color) inset, 0 -1px 0 0 var(--el-input-border-color) inset !important;
    transition: box-shadow 0.2s;
  }

  :deep(.el-input-group__append) {
    background: #fff;
    color: #606266;
    padding: 0 10px;
    border-radius: 0 6px 6px 0;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  :deep(.el-input__wrapper input) {
    caret-color: #FF621F;
  }

  &:focus-within {
    :deep(.el-input-group__prepend) {
      color: #FF621F;
      border-color: #FF621F;
      box-shadow:
        1px 0 0 0 #FF621F inset,
        0 1px 0 0 #FF621F inset,
        0 -1px 0 0 #FF621F inset;
    }

    :deep(.el-input__wrapper),
    :deep(.el-input__wrapper.is-focus) {
      box-shadow:
        0 1px 0 0 #FF621F inset,
        0 -1px 0 0 #FF621F inset !important;
    }

    :deep(.el-input-group__append) {
      border-color: #FF621F;
      box-shadow:
        -1px 0 0 0 #FF621F inset,
        0 1px 0 0 #FF621F inset,
        0 -1px 0 0 #FF621F inset;
    }
  }
}

.sdn-section-header__right {
  :deep(.el-switch) {
    flex-shrink: 0;
  }
}

.sdn-quota-action-btns {
  :deep(.el-button + .el-button) {
    margin-left: 10px;
  }
}
</style>
