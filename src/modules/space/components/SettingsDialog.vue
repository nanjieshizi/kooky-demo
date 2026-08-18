<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close, Delete, Check, EditPen, Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import * as providerConfigApi from '@/shared/services/providerConfigApi'
import { fetchClaudeApiKey } from '@/modules/terminal/claudeKeyService'
import chatMenuIcon from '@/assets/settings/chat_icon.svg'
import cliMenuIcon from '@/assets/settings/cli_icon.svg'
import aboutMenuIcon from '@/assets/settings/about_icon.svg'
import testLinkIcon from '@/assets/settings/test_icon.svg'
import defaultProviderIcon from '@/assets/settings/default_icon.svg'
import { resolveBundledImageFromApiPath, isLikelyInvalidSrcAssetPath } from '@/shared/utils/localApiAssetMap'
const cliKookyEnabled = ref(true)
const appVersion = ref('')

// 获取应用版本号
if (window.electronAPI?.updater?.getVersion) {
  window.electronAPI.updater.getVersion().then(v => { appVersion.value = v }).catch(() => {})
}
/** 统一错误处理 */
function handleApiError(error, defaultMsg = '操作失败') {
  console.error(defaultMsg, error)

  // 提取错误信息
  let errorMsg = defaultMsg
  if (error?.detail) {
    errorMsg = error.detail
  } else if (error?.response?.data?.detail) {
    errorMsg = error.response.data.detail
  } else if (error?.data?.detail) {
    errorMsg = error.data.detail
  } else if (error?.message) {
    errorMsg = error.message
  } else if (error?.msg) {
    errorMsg = error.msg
  } else if (error?.response?.data?.message) {
    errorMsg = error.response.data.message
  } else if (error?.data?.message) {
    errorMsg = error.data.message
  } else if (typeof error === 'string') {
    errorMsg = error
  }

  ElMessage.error(errorMsg)
}

/**
 * 重新获取 CLI 配置并更新 settings.json
 */
async function refreshClaudeCodeSettings() {
  try {
    const keyInfo = await fetchClaudeApiKey()
    if (keyInfo?.env && window.electronAPI?.claudeCode?.setupEnv) {
      await window.electronAPI.claudeCode.setupEnv(keyInfo.env, keyInfo.modelList)
    }
  } catch (error) {
    console.error('[SettingsDialog] 更新 Claude Code 配置失败:', error)
  }
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 左侧菜单（与稿一致）
const menuItems = ref([
  { id: 'conversation-model-config', label: '对话模型配置', icon: chatMenuIcon },
  { id: 'cli-model', label: 'CLI模型配置', icon: cliMenuIcon },
  { id: 'about-kooky', label: '关于Kooky', icon: aboutMenuIcon },
])

const activeMenu = ref('conversation-model-config')

/** 当前 channel：对话模式 kc-oc / CLI 模式 kc-cc */
const currentChannel = computed(() => {
  return activeMenu.value === 'conversation-model-config' ? 'kc-oc' : 'kc-cc'
})

function resolveProviderIcon(...icons) {
  return icons.find((icon) => String(icon ?? '').trim()) || defaultProviderIcon
}

function normalizeProviderMeta(provider, fallbackId = null) {
  if (!provider) {
    return {
      id: fallbackId,
      name: '',
      logo: defaultProviderIcon,
      modelCount: 0
    }
  }

  const iconUrl = resolveProviderIcon(provider.icon_url, provider.iconUrl)

  return {
    ...provider,
    id: provider.id ?? fallbackId,
    name: provider.display_name || provider.displayName || provider.name || provider.providerName || '',
    logo: resolveProviderIcon(provider.icon_url, provider.iconUrl, provider.logo, provider.icon),
    modelCount: provider.models?.length ?? 0,
    // 保留原始字段供其他地方使用
    displayName: provider.display_name || provider.displayName,
    iconUrl,
    isBuiltin: provider.is_builtin ?? provider.isBuiltin,
    isCustom: provider.is_custom ?? provider.isCustom,
    isSelected: provider.is_selected ?? provider.isSelected,
    templateCode: provider.template_code || provider.templateCode
  }
}

function normalizeModels(models = []) {
  if (!Array.isArray(models)) return []
  return models.map((m, idx) => ({
    ...m,
    id: m.id ?? `model-${idx}`,
    modelName: m.model_name || m.modelName || '',
    modelCode: m.model_code || m.modelCode || '',
    isSelected: m.is_selected ?? m.isSelected ?? false,
    sortOrder: m.sort_order ?? m.sortOrder ?? idx
  }))
}

function normalizeQuota(quota) {
  if (!quota) return quota
  return {
    ...quota,
    hasPendingTokenExpand: quota.has_pending_token_expand ?? quota.hasPendingTokenExpand ?? false
  }
}

function isKookyBuiltinProvider(provider) {
  if (!provider?.isBuiltin && !provider?.is_builtin) return false

  const fields = [
    provider.templateCode,
    provider.template_code,
    provider.providerCode,
    provider.code,
    provider.templateName,
    provider.name,
    provider.displayName,
    provider.display_name
  ]
  const text = fields
    .map((x) => String(x ?? '').toLowerCase())
    .join(' ')

  return text.includes('kooky')
}

/** 对话模式：固定在顶部的官方服务商（Kooky） */
const kookyProvider = ref({})

/** 对话模式：可滚动列表中的其它服务商（不含 Kooky） */
const providersScroll = ref([])

/** 当前选中的服务商 ID */
const activeProvider = ref(null)

/** 加载对话模式厂商列表 */
async function loadConversationProviders() {
  try {
    const list = await providerConfigApi.getProviderList('kc-oc')

    // 规范化字段（兼容 snake_case 和 camelCase）
    const normalizedList = list.map(p => ({
      ...p,
      isBuiltin: p.is_builtin ?? p.isBuiltin,
      isCustom: p.is_custom ?? p.isCustom,
      isSelected: p.is_selected ?? p.isSelected,
      displayName: p.display_name || p.displayName,
      iconUrl: resolveProviderIcon(p.icon_url, p.iconUrl),
      templateCode: p.template_code || p.templateCode,
      models: normalizeModels(p.models)
    }))

    // 分离 Kooky 和其他厂商
    const builtinProviders = normalizedList.filter((p) => p?.isBuiltin)
    const kookyRaw = builtinProviders.find(isKookyBuiltinProvider) || builtinProviders[0] || null
    const othersRaw = normalizedList.filter((p) => !p?.isBuiltin)
    const others = othersRaw.map((p) => normalizeProviderMeta(p))

    kookyProvider.value = normalizeProviderMeta(kookyRaw, 'kooky')
    providersScroll.value = others

    // 设置默认选中项（优先选中当前选择的厂商）
    const selected = normalizedList.find((p) => p.isSelected)
    const nextActiveProvider = selected ? (selected.isBuiltin ? 'kooky' : (selected.id || 'kooky')) : 'kooky'
    activeProvider.value = nextActiveProvider

    // 默认选中后立即加载详情，确保右侧表单有数据
    await loadProviderDetail(nextActiveProvider, 'kc-oc')
  } catch (error) {
    console.error('加载对话模式厂商列表失败:', error)
    handleApiError(error, '加载厂商列表失败')
  }
}

/** 加载 CLI 模式厂商列表（任务 8 实现） */
async function loadCliProviders() {
  try {
    const list = await providerConfigApi.getProviderList('kc-cc')

    // 规范化字段（兼容 snake_case 和 camelCase）
    const normalizedList = list.map(p => ({
      ...p,
      isBuiltin: p.is_builtin ?? p.isBuiltin,
      isCustom: p.is_custom ?? p.isCustom,
      isSelected: p.is_selected ?? p.isSelected,
      displayName: p.display_name || p.displayName,
      iconUrl: resolveProviderIcon(p.icon_url, p.iconUrl),
      templateCode: p.template_code || p.templateCode,
      models: normalizeModels(p.models)
    }))

    // 分离 Kooky 和其他厂商
    const builtinProviders = normalizedList.filter((p) => p?.isBuiltin)
    const kookyRaw = builtinProviders.find(isKookyBuiltinProvider) || builtinProviders[0] || null
    const others = normalizedList.filter((p) => !p?.isBuiltin)

    kookyProvider.value = normalizeProviderMeta(kookyRaw, 'kooky')

    // Kooky 启用状态（isSelected 表示启用）
    cliKookyEnabled.value = kookyRaw?.isSelected || false

    // 其他厂商（添加 enabled 字段）
    cliProvidersScroll.value = others.map(p => ({
      ...normalizeProviderMeta(p),
      id: p.id,
      enabled: p.isSelected || false
    }))

    // 设置默认选中项（CLI 模式下只有一个厂商 enabled=true）
    const enabled = normalizedList.find((p) => p.isSelected)
    const nextCliProvider = enabled ? (enabled.isBuiltin ? 'kooky' : (enabled.id || 'kooky')) : 'kooky'
    cliActiveProvider.value = nextCliProvider

    // 默认选中后立即加载详情，确保右侧表单有数据
    await loadCliProviderDetail(nextCliProvider)
  } catch (error) {
    console.error('加载 CLI 模式厂商列表失败:', error)
    handleApiError(error, '加载厂商列表失败')
  }
}

/** 加载 CLI 模式厂商详情 */
async function loadCliProviderDetail(providerId) {
  if (!providerId) return

  loadingCliProviderDetail.value = true
  try {
    const detail = await providerConfigApi.getProviderDetail(providerId, 'kc-cc')
    // 规范化字段名（兼容 snake_case 和 camelCase）
    const normalizedDetail = {
      ...detail,
      isBuiltin: detail.is_builtin ?? detail.isBuiltin,
      isCustom: detail.is_custom ?? detail.isCustom,
      displayName: detail.display_name || detail.displayName,
      iconUrl: resolveProviderIcon(detail.icon_url, detail.iconUrl),
      apiKey: detail.api_key || detail.apiKey,
      baseUrl: detail.base_url || detail.baseUrl,
      apiProtocol: detail.api_protocol || detail.apiProtocol,
      templateCode: detail.template_code || detail.templateCode,
      quota: normalizeQuota(detail.quota),
      models: normalizeModels(detail.models)
    }

    cliCurrentProviderDetail.value = normalizedDetail

    // 更新 CLI 表单
    if (normalizedDetail.isBuiltin) {
      cliForm.value = {
        configName: '官方配置',
        baseUrl: '',
        apiKey: '',
        apiProtocol: ''
      }
    } else {
      cliForm.value = {
        configName: normalizedDetail.displayName || '',
        baseUrl: normalizedDetail.baseUrl || '',
        apiKey: normalizedDetail.apiKey || '',
        apiProtocol: normalizedDetail.apiProtocol || ''
      }
    }

    // 更新 CLI 模型映射（CLI 模式下 modelName 是别名: opus/sonnet/haiku）
    cliModelMappings.value = normalizedDetail.models?.map((m, idx) => ({
      id: m.id || `cli-map-${idx}`,
      label: m.modelName, // opus/sonnet/haiku
      modelId: m.modelCode,
      _originLabel: m.modelName,
      _originModelId: m.modelCode
    })) || []
    activeCliMappingId.value = cliModelMappings.value[0]?.id || null
  } catch (error) {
    console.error('加载 CLI 厂商详情失败:', error)
    handleApiError(error, '加载厂商详情失败')
  } finally {
    loadingCliProviderDetail.value = false
  }
}

/** CLI 模式：更新厂商启用状态 */
async function updateCliProviderEnabled(providerId) {
  // 所有更新前都做“至少启用一个服务商”校验
  const hasEnabledAfterUpdate =
    cliKookyEnabled.value ||
    cliProvidersScroll.value.some((p) => p.id === providerId || p.enabled)
  if (!hasEnabledAfterUpdate) {
    ElMessage.warning('至少需要启用一个服务商')
    return
  }

  try {
    await providerConfigApi.updateSelection({
      channel: 'kc-cc',
      provider_config_id: providerId === 'kooky' ? null : providerId,
      model_config_id: null
    })

    ElMessage.success('已切换启用的服务商')

    // 刷新列表
    await loadCliProviders()
  } catch (error) {
    console.error('更新 CLI 启用状态失败:', error)
    handleApiError(error, '更新失败')
  }
}

async function handleCliKookySwitchChange(enabled) {
  if (enabled) {
    await updateCliProviderEnabled('kooky')
    await refreshClaudeCodeSettings()
  }
}

/** CLI 模式：其他厂商开关变化 */
async function handleCliProviderSwitchChange(providerId, enabled) {
  if (isTempProviderId(providerId)) return

  if (enabled) {
    // 启用该厂商（唯一约束会自动禁用其他厂商）
    await updateCliProviderEnabled(providerId)
    await refreshClaudeCodeSettings()
  }
}

function beforeCliProviderSwitchChange(currentEnabled) {
  const nextValue = !currentEnabled
  if (!nextValue) {
    ElMessage.warning('请启用其他服务商完成切换')
    return false
  }
  return true
}

const handleDeleteCliProvider = async () => {
  const providerId = cliActiveProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法删除官方服务商')
    return
  }

  if (isTempProviderId(providerId)) {
    cliProvidersScroll.value = cliProvidersScroll.value.filter((p) => p.id !== providerId)
    cliActiveProvider.value = 'kooky'
    await loadCliProviderDetail('kooky')
    return
  }

  try {
    await ElMessageBox.confirm(
      '删除服务商将同时删除其下的所有模型映射，是否继续?',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await providerConfigApi.deleteProvider(providerId)
    ElMessage.success('删除成功')

    // 刷新列表，选中 Kooky
    await loadCliProviders()
    cliActiveProvider.value = 'kooky'
    loadCliProviderDetail('kooky')
  } catch (error) {
    if (error === 'cancel') return
    console.error('删除 CLI 服务商失败:', error)
    handleApiError(error, '删除失败')
  }
}

/** 当前厂商详情（包含完整配置和模型列表） */
const currentProviderDetail = ref(null)

/** 加载中状态 */
const loadingProviderDetail = ref(false)

/** 加载厂商详情 */
async function loadProviderDetail(providerId, channel) {
  if (!providerId) return

  loadingProviderDetail.value = true
  try {
    const detail = await providerConfigApi.getProviderDetail(providerId, channel)

    // 规范化字段名（兼容 snake_case 和 camelCase）
    const normalizedDetail = {
      ...detail,
      isBuiltin: detail.is_builtin ?? detail.isBuiltin,
      isCustom: detail.is_custom ?? detail.isCustom,
      displayName: detail.display_name || detail.displayName,
      iconUrl: resolveProviderIcon(detail.icon_url, detail.iconUrl),
      apiKey: detail.api_key || detail.apiKey,
      baseUrl: detail.base_url || detail.baseUrl,
      apiProtocol: detail.api_protocol || detail.apiProtocol,
      templateCode: detail.template_code || detail.templateCode,
      quota: normalizeQuota(detail.quota),
      models: normalizeModels(detail.models)
    }

    currentProviderDetail.value = normalizedDetail

    // 如果是 Kooky，更新用量信息
    if (normalizedDetail.isBuiltin && normalizedDetail.quota) {
      kookyUsagePercent.value = Math.round((normalizedDetail.quota.used / normalizedDetail.quota.total) * 100)
    }

    // 更新模型列表（对话模式）
    if (channel === 'kc-oc') {
      modelList.value = normalizedDetail.models?.map((m, idx) => ({
        id: m.id || `m-${idx}`,
        modelId: m.modelCode,
        displayName: m.modelName
      })) || []
      activeConversationModelId.value = modelList.value[0]?.id || null
    }
  } catch (error) {
    console.error('加载厂商详情失败:', error)
    handleApiError(error, '加载厂商详情失败')
  } finally {
    loadingProviderDetail.value = false
  }
}

const currentProviderMeta = computed(() => {
  if (activeProvider.value === 'kooky') {
    return kookyProvider.value
  }
  return (
    providersScroll.value.find((p) => p.id === activeProvider.value) ||
    providersScroll.value[0]
  )
})

const providerFormSubtitle = computed(() => {
  const p = currentProviderMeta.value
  if (!p) return ''
  return `${p.modelCount} 个可用模型 · API 接入`
})

const isKookyProvider = computed(() => activeProvider.value === 'kooky')

const kookyUsagePercent = ref(90)

const kookyModelList = computed(() => {
  if (!currentProviderDetail.value?.isBuiltin) return []
  return currentProviderDetail.value.models?.map(m => m.modelName || m.model_code || m.modelCode) || []
})

const kookyUsageLevel = computed(() => {
  if (kookyUsagePercent.value > 90) return 'high'
  if (kookyUsagePercent.value >= 70) return 'medium'
  return 'low'
})

const kookyUsageMeta = computed(() => {
  if (kookyUsageLevel.value === 'high') {
    return {
      levelText: '超过90%',
      tip: '额度即将耗尽，请及时申请补充',
      progressColor: '#f56c6c'
    }
  }
  if (kookyUsageLevel.value === 'medium') {
    return {
      levelText: '超过70% 低于90%',
      tip: '额度剩余较少，建议提前申请补充',
      progressColor: '#ff9f43'
    }
  }
  return {
    levelText: '低于70%',
    tip: '额度充足，使用无忧',
    progressColor: '#11BB90'
  }
})

const kookyQuotaApplyRequested = ref(false)
const kookyQuotaApplying = ref(false)

const showKookyQuotaApplyButton = computed(() => kookyUsagePercent.value >= 70)
const kookyQuotaApplyPending = computed(() => Boolean(currentProviderDetail.value?.quota?.hasPendingTokenExpand))
const isKookyQuotaApplyDisabled = computed(() => (
  kookyQuotaApplyPending.value || kookyQuotaApplyRequested.value || kookyQuotaApplying.value
))

const TEMP_PROVIDER_PREFIX = 'temp-provider-'

function createTempProviderId(channel) {
  return `${TEMP_PROVIDER_PREFIX}${channel}-${Date.now()}`
}

function isTempProviderId(providerId) {
  return typeof providerId === 'string' && providerId.startsWith(TEMP_PROVIDER_PREFIX)
}

function getProviderLogoSrc(logo) {
  if (typeof logo !== 'string') return ''
  const val = logo.trim()
  if (!val) return ''
  
  const bundled = resolveBundledImageFromApiPath(val)
  if (bundled) return bundled
  if (isLikelyInvalidSrcAssetPath(val)) return defaultProviderIcon
  const isHttp = /^https?:\/\//i.test(val)
  const isDataImage = /^data:image\//i.test(val)
  const isLocalPath = val.startsWith('/') || val.startsWith('./')
  return (isHttp || isDataImage || isLocalPath) ? val : ''
}

const providerTemplates = ref([])

async function loadProviderTemplates() {
  try {
    const templates = await providerConfigApi.getProviderTemplates()
    // 规范化模板字段（兼容 snake_case 和 camelCase）
    providerTemplates.value = templates.map(tpl => ({
      ...tpl,
      id: tpl.id,
      code: tpl.code,
      name: tpl.name,
      iconUrl: resolveProviderIcon(tpl.icon_url, tpl.iconUrl),
      defaultBaseUrl: tpl.default_base_url || tpl.defaultBaseUrl,
      apiProtocol: tpl.api_protocol || tpl.apiProtocol,
      defaultModels: tpl.default_models || tpl.defaultModels || []
    }))
  } catch (error) {
    console.error('加载厂商模板失败:', error)
  }
}

function findTemplateByName(name) {
  const target = String(name ?? '').trim()
  if (!target) return null
  return providerTemplates.value.find((tpl) => String(tpl?.name ?? '').trim() === target) || null
}

function patchTempProviderMeta(providerId, patch) {
  const idx = providersScroll.value.findIndex((p) => p.id === providerId)
  if (idx < 0) return
  providersScroll.value[idx] = { ...providersScroll.value[idx], ...patch }
}

function patchTempCliProviderMeta(providerId, patch) {
  const idx = cliProvidersScroll.value.findIndex((p) => p.id === providerId)
  if (idx < 0) return
  cliProvidersScroll.value[idx] = { ...cliProvidersScroll.value[idx], ...patch }
}

function handleConversationProviderNameChange(value) {
  const providerId = activeProvider.value
  if (isTempProviderId(providerId)) {
    patchTempProviderMeta(providerId, {
      name: value || '未命名服务商'
    })
  }

  const template = findTemplateByName(value)
  if (!template) return

  configForm.value.baseUrl = template.defaultBaseUrl || ''
  configForm.value.apiProtocol = template.apiProtocol || ''
  if (isTempProviderId(providerId)) {
    patchTempProviderMeta(providerId, {
      logo: template.iconUrl || template.icon || ''
    })
  }
}

function handleCliProviderNameChange(value) {
  const providerId = cliActiveProvider.value
  if (isTempProviderId(providerId)) {
    patchTempCliProviderMeta(providerId, {
      name: value || '未命名服务商',
      modelCount: 0
    })
  }

  const template = findTemplateByName(value)
  if (!template) return

  cliForm.value.baseUrl = template.defaultBaseUrl || ''
  cliForm.value.apiProtocol = template.apiProtocol || ''
  if (isTempProviderId(providerId)) {
    patchTempCliProviderMeta(providerId, {
      logo: template.iconUrl || template.icon || ''
    })
  }
}

/** 打开新建厂商对话框 */
function openCreateProviderDialog() {
  loadProviderTemplates()

  const existingTemp = providersScroll.value.find((p) => isTempProviderId(p.id))
  if (existingTemp) {
    activeProvider.value = existingTemp.id
    currentProviderDetail.value = {
      isBuiltin: false,
      displayName: configForm.value.serviceName,
      apiKey: configForm.value.apiKey,
      baseUrl: configForm.value.baseUrl,
      apiProtocol: configForm.value.apiProtocol
    }
    ElMessage.warning('请先保存当前新建服务商')
    return
  }

  const tempId = createTempProviderId('kc-oc')
  providersScroll.value = [
    {
      id: tempId,
      name: '未命名服务商',
      modelCount: 0,
      logo: defaultProviderIcon,
      isTemp: true
    },
    ...providersScroll.value
  ]
  activeProvider.value = tempId
  currentProviderDetail.value = {
    isBuiltin: false,
    displayName: '',
    apiKey: '',
    baseUrl: '',
    apiProtocol: ''
  }
  modelList.value = []
  modelDraftRow.value = null
}



/** CLI 模式：其他服务商列表 */
const cliProvidersScroll = ref([])

/** CLI 模式：当前选中的服务商 ID */
const cliActiveProvider = ref(null)

/** CLI 模式：当前厂商详情 */
const cliCurrentProviderDetail = ref(null)

/** CLI 模式：加载中状态 */
const loadingCliProviderDetail = ref(false)

const cliCurrentProviderMeta = computed(() => {
  if (cliActiveProvider.value === 'kooky') {
    return { ...kookyProvider.value }
  }
  return (
    cliProvidersScroll.value.find((p) => p.id === cliActiveProvider.value) ||
    cliProvidersScroll.value[0]
  )
})

const cliProviderSubtitle = computed(() => {
  const p = cliCurrentProviderMeta.value
  if (!p) return ''
  return `${p.modelCount} 个可用模型`
})

const isCliKookyProvider = computed(() => cliActiveProvider.value === 'kooky')

const cliKookyModelList = computed(() => {
  if (!cliCurrentProviderDetail.value?.isBuiltin) return []
  return cliCurrentProviderDetail.value.models?.map((m) => m.modelName || m.model_code || m.modelCode) || []
})

const cliKookyUsagePercent = computed(() => {
  const quota = cliCurrentProviderDetail.value?.quota
  if (!quota) return 0
  if (typeof quota.used === 'number' && typeof quota.total === 'number' && quota.total > 0) {
    return Math.round((quota.used / quota.total) * 100)
  }
  if (typeof quota.balance === 'number' && typeof quota.total === 'number' && quota.total > 0) {
    return Math.round(((quota.total - quota.balance) / quota.total) * 100)
  }
  return 0
})

const cliKookyUsageLevel = computed(() => {
  if (cliKookyUsagePercent.value > 90) return 'high'
  if (cliKookyUsagePercent.value >= 70) return 'medium'
  return 'low'
})

const cliKookyUsageMeta = computed(() => {
  if (cliKookyUsageLevel.value === 'high') {
    return {
      tip: '额度即将耗尽，请及时申请补充',
      progressColor: '#f56c6c'
    }
  }
  if (cliKookyUsageLevel.value === 'medium') {
    return {
      tip: '额度剩余较少，建议提前申请补充',
      progressColor: '#ff9f43'
    }
  }
  return {
    tip: '额度充足，使用无忧',
    progressColor: '#19c4b4'
  }
})

const cliKookyQuotaApplyRequested = ref(false)
const cliKookyQuotaApplying = ref(false)

const showCliKookyQuotaApplyButton = computed(() => cliKookyUsagePercent.value >= 70)
const cliKookyQuotaApplyPending = computed(() => Boolean(cliCurrentProviderDetail.value?.quota?.hasPendingTokenExpand))
const isCliKookyQuotaApplyDisabled = computed(() => (
  cliKookyQuotaApplyPending.value || cliKookyQuotaApplyRequested.value || cliKookyQuotaApplying.value
))

async function handleApplyKookyQuota(type) {
  if (type === 'cli') {
    if (isCliKookyQuotaApplyDisabled.value) return
    cliKookyQuotaApplying.value = true
    try {
      await providerConfigApi.submitTokenExpand({
        tokenType: 'kc-cc',
        reason: '项目需要更多额度'
      })
      cliKookyQuotaApplyRequested.value = true
      ElMessage.success('已发送申请，我们会尽快处理')
    } catch (error) {
      handleApiError(error, '提交扩容申请失败')
    } finally {
      cliKookyQuotaApplying.value = false
    }
    return
  }

  if (isKookyQuotaApplyDisabled.value) return
  kookyQuotaApplying.value = true
  try {
    await providerConfigApi.submitTokenExpand({
      tokenType: 'kc-oc',
      reason: '项目需要更多额度'
    })
    kookyQuotaApplyRequested.value = true
    ElMessage.success('已发送申请，我们会尽快处理')
  } catch (error) {
    handleApiError(error, '提交扩容申请失败')
  } finally {
    kookyQuotaApplying.value = false
  }
}

const cliForm = ref({
  configName: '新的服务商',
  baseUrl: 'https://api.anthropic.com',
  apiKey: '2345678841¥.......',
  apiProtocol: '内容内容'
})

/** 配置表单（用于编辑） */
const configForm = ref({
  serviceName: '',
  apiKey: '',
  baseUrl: '',
  apiProtocol: ''
})

const testConnectionStatus = ref('idle')
const testConnectionStatusText = computed(() => {
  if (testConnectionStatus.value === 'loading') return '测试中'
  if (testConnectionStatus.value === 'success') return '连接成功'
  if (testConnectionStatus.value === 'error') return '连接失败'
  return ''
})

function resetTestConnectionStatus() {
  testConnectionStatus.value = 'idle'
}

/** 监听厂商详情变化，同步到表单 */
watch(currentProviderDetail, (detail) => {
  if (!detail || detail.isBuiltin) {
    // Kooky 不可编辑
    return
  }

  configForm.value = {
    serviceName: detail.displayName || '',
    apiKey: detail.apiKey || '',
    baseUrl: detail.baseUrl || '',
    apiProtocol: detail.apiProtocol || ''
  }
}, { immediate: true })

watch(
  () => [configForm.value.apiKey, configForm.value.baseUrl, configForm.value.apiProtocol],
  () => {
    if (activeMenu.value !== 'conversation-model-config') return
    if (isKookyProvider.value) return
    resetTestConnectionStatus()
  }
)

watch(
  () => [cliForm.value.apiKey, cliForm.value.baseUrl, cliForm.value.apiProtocol],
  () => {
    if (activeMenu.value !== 'cli-model') return
    if (isCliKookyProvider.value) return
    resetTestConnectionStatus()
  }
)

const cliModelMappings = ref([
  { id: 'cli-map-1', label: 'Opus', modelId: 'claude-opus-4-7' },
  { id: 'cli-map-2', label: 'Sonnet', modelId: 'claude-opus-4-6' },
  { id: 'cli-map-3', label: 'Haiku', modelId: 'claude-opus-4-5' }
])

const cliDraftMapping = ref(null)

const cliModelMapCount = computed(() => cliModelMappings.value.length)

const apiProtocolOptions = [
  { label: 'HTTPS', value: 'https' },
  { label: 'HTTP', value: 'http' }
]

/** 模型表格行：模型 ID + 展示名 */
const modelList = ref([])
const activeConversationModelId = ref(null)
const activeCliMappingId = ref(null)

/** 新增行草稿：null 表示未在编辑 */
const modelDraftRow = ref(null)
const modelEditRow = ref(null)

const modelListBadgeCount = computed(() => modelList.value.length)

const handleMenuClick = (menuId) => {
  activeMenu.value = menuId
}

const handleConversationModelRowClick = (rowId) => {
  activeConversationModelId.value = rowId
}

const handleCliMappingRowClick = (rowId) => {
  activeCliMappingId.value = rowId
}

const handleProviderClick = (providerId) => {
  resetTestConnectionStatus()
  activeProvider.value = providerId
  if (isTempProviderId(providerId)) {
    currentProviderDetail.value = {
      isBuiltin: false,
      displayName: configForm.value.serviceName,
      apiKey: configForm.value.apiKey,
      baseUrl: configForm.value.baseUrl,
      apiProtocol: configForm.value.apiProtocol
    }
    return
  }
  loadProviderDetail(providerId, 'kc-oc')
}

const handleCliProviderClick = (providerId) => {
  resetTestConnectionStatus()
  cliActiveProvider.value = providerId
  if (isTempProviderId(providerId)) return
  loadCliProviderDetail(providerId)
}

const handleDeleteProvider = async () => {
  const providerId = activeProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法删除官方服务商')
    return
  }

  if (isTempProviderId(providerId)) {
    providersScroll.value = providersScroll.value.filter((p) => p.id !== providerId)
    activeProvider.value = 'kooky'
    await loadProviderDetail('kooky', 'kc-oc')
    return
  }

  try {
    await ElMessageBox.confirm(
      '删除服务商将同时删除其下的所有模型配置，是否继续?',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await providerConfigApi.deleteProvider(providerId)
    ElMessage.success('删除成功')

    // 刷新列表，选中 Kooky
    await loadConversationProviders()
    activeProvider.value = 'kooky'
    loadProviderDetail('kooky', 'kc-oc')
  } catch (error) {
    if (error === 'cancel') return
    console.error('删除服务商失败:', error)
    handleApiError(error, '删除失败')
  }
}

const handleSave = async () => {
  // 对话模式保存
  if (activeMenu.value === 'conversation-model-config') {
    if (isKookyProvider.value) {
      dialogVisible.value = false
      return
    }

    const providerId = activeProvider.value
    if (!providerId) {
      ElMessage.warning('未选择服务商')
      return
    }

    if (!configForm.value.serviceName.trim()) {
      ElMessage.warning('请输入服务商名称')
      return
    }
    if (!configForm.value.apiKey.trim()) {
      ElMessage.warning('请输入 API Key')
      return
    }
    try {
      const isCreateMode = isTempProviderId(providerId)

      if (isCreateMode) {
        const template = findTemplateByName(configForm.value.serviceName)
        const baseUrl = configForm.value.baseUrl.trim() || template?.defaultBaseUrl || ''
        const apiProtocol = configForm.value.apiProtocol.trim() || template?.apiProtocol || ''
        const models = modelList.value
          .filter((m) => String(m?.modelId ?? '').trim() && !m?.isPlaceholder)
          .map((m) => ({
            model_name: String(m?.displayName ?? m?.modelId ?? '').trim(),
            model_code: String(m?.modelId ?? '').trim()
          }))

        if (!baseUrl) {
          ElMessage.warning('请输入 Base URL')
          return
        }
        if (!apiProtocol) {
          ElMessage.warning('请输入 API 协议')
          return
        }

        const result = await providerConfigApi.createProvider({
          channel: 'kc-oc',
          template_id: template?.id ?? null,
          display_name: configForm.value.serviceName,
          api_key: configForm.value.apiKey,
          base_url: baseUrl,
          api_protocol: apiProtocol,
          is_custom: template ? 0 : 1,
          models
        })

        ElMessage.success('新建服务商成功')
        await loadConversationProviders()
        activeProvider.value = result.id
        await loadProviderDetail(result.id, 'kc-oc')
      } else {
        if (!configForm.value.baseUrl.trim()) {
          ElMessage.warning('请输入 Base URL')
          return
        }
        if (!configForm.value.apiProtocol.trim()) {
          ElMessage.warning('请输入 API 协议')
          return
        }
        const updatePayload = {
          display_name: configForm.value.serviceName.trim(),
          base_url: configForm.value.baseUrl.trim(),
          api_protocol: configForm.value.apiProtocol.trim()
        }
        const currentApiKey = String(currentProviderDetail.value?.apiKey ?? '').trim()
        const nextApiKey = configForm.value.apiKey.trim()
        if (nextApiKey !== currentApiKey) {
          updatePayload.api_key = nextApiKey
        }
        await providerConfigApi.updateProvider(providerId, updatePayload)

        ElMessage.success('保存成功')
        await loadConversationProviders()
        await loadProviderDetail(providerId, 'kc-oc')
      }
    } catch (error) {
      console.error('保存服务商配置失败:', error)
      handleApiError(error, '保存失败')
    }
    return
  }

  // CLI 模式保存
  if (activeMenu.value === 'cli-model') {
    const providerId = cliActiveProvider.value
    if (!providerId || providerId === 'kooky') {
      ElMessage.warning('官方配置无需保存')
      return
    }

    if (!cliForm.value.configName.trim()) {
      ElMessage.warning('请输入配置名称')
      return
    }
    if (!cliForm.value.apiKey.trim()) {
      ElMessage.warning('请输入 API KEY')
      return
    }
    try {
      const isCreateMode = isTempProviderId(providerId)

      if (isCreateMode) {
        const template = findTemplateByName(cliForm.value.configName)
        const baseUrl = cliForm.value.baseUrl.trim() || template?.defaultBaseUrl || ''
        const apiProtocol = cliForm.value.apiProtocol.trim() || template?.apiProtocol || ''
        const models = cliModelMappings.value
          .filter((m) => String(m?.modelId ?? '').trim() && String(m?.label ?? '').trim() && !m?.isPlaceholder)
          .map((m) => ({
            model_name: String(m.label).trim().toLowerCase(),
            model_code: String(m.modelId).trim()
          }))

        if (!baseUrl) {
          ElMessage.warning('请输入 BASE_URL')
          return
        }
        if (!apiProtocol) {
          ElMessage.warning('请输入 API 协议')
          return
        }

        const result = await providerConfigApi.createProvider({
          channel: 'kc-cc',
          template_id: template?.id ?? null,
          display_name: cliForm.value.configName,
          api_key: cliForm.value.apiKey,
          base_url: baseUrl,
          api_protocol: apiProtocol,
          is_custom: template ? 0 : 1,
          models
        })

        ElMessage.success('新建 CLI 服务商成功')
        await loadCliProviders()
        cliActiveProvider.value = result.id
        await loadCliProviderDetail(result.id)
        await refreshClaudeCodeSettings()
      } else {
        if (!cliForm.value.baseUrl.trim()) {
          ElMessage.warning('请输入 BASE_URL')
          return
        }
        if (!cliForm.value.apiProtocol.trim()) {
          ElMessage.warning('请输入 API 协议')
          return
        }
        const updatePayload = {
          display_name: cliForm.value.configName.trim(),
          base_url: cliForm.value.baseUrl.trim(),
          api_protocol: cliForm.value.apiProtocol.trim()
        }
        const currentApiKey = String(cliCurrentProviderDetail.value?.apiKey ?? '').trim()
        const nextApiKey = cliForm.value.apiKey.trim()
        if (nextApiKey !== currentApiKey) {
          updatePayload.api_key = nextApiKey
        }
        await providerConfigApi.updateProvider(providerId, updatePayload)

        ElMessage.success('保存成功')
        await loadCliProviders()
        await loadCliProviderDetail(providerId)
        await refreshClaudeCodeSettings()
      }
    } catch (error) {
      console.error('保存 CLI 配置失败:', error)
      handleApiError(error, '保存失败')
    }
  }
}

const handleTestConnection = async () => {
  if (testConnectionStatus.value === 'loading') return
  const form = activeMenu.value === 'cli-model' ? cliForm.value : configForm.value

  // 表单验证
  if (!form.apiKey.trim()) {
    ElMessage.warning('请输入 API Key')
    return
  }
  if (!form.baseUrl.trim()) {
    ElMessage.warning('请输入 Base URL')
    return
  }
  if (!form.apiProtocol.trim()) {
    ElMessage.warning('请输入 API 协议')
    return
  }
  testConnectionStatus.value = 'loading'

  try {
    await providerConfigApi.testConnection({
      api_key: form.apiKey,
      base_url: form.baseUrl,
      api_protocol: form.apiProtocol
    })
    testConnectionStatus.value = 'success'
  } catch (error) {
    testConnectionStatus.value = 'error'
    console.error('连接测试失败:', error)
    handleApiError(error, '连接测试失败')
  }
}

const removeModelRow = async (modelRowId) => {
  const providerId = activeProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法删除 Kooky 模型')
    return
  }

  // 从当前模型列表中找到对应模型
  const model = modelList.value.find(m => m.id === modelRowId)
  if (!model) return

  // 如果 model.id 是临时 ID（以 'm-' 开头），表示尚未保存到后端，直接删除
  if (String(model.id).startsWith('m-')) {
    modelList.value = modelList.value.filter(m => m.id !== modelRowId)
    if (modelEditRow.value?.id === modelRowId) {
      modelEditRow.value = null
    }
    if (activeConversationModelId.value === modelRowId) {
      activeConversationModelId.value = modelList.value[0]?.id || null
    }
    return
  }

  try {
    await ElMessageBox.confirm('确认删除该模型?', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await providerConfigApi.deleteModel(providerId, model.id)
    ElMessage.success('删除成功')

    // 操作模型后同步刷新列表与详情
    await refreshConversationProviderAfterModelChange(providerId)
  } catch (error) {
    if (error === 'cancel') return
    console.error('删除模型失败:', error)
    handleApiError(error, '删除失败')
  }
}

const startAddModelRow = () => {
  if (modelEditRow.value) {
    ElMessage.warning('请先保存或取消当前编辑行')
    return
  }
  if (modelDraftRow.value) {
    ElMessage.warning('请先保存或取消当前新增行')
    return
  }
  modelDraftRow.value = { alias: '', modelId: '' }
}

const cancelModelDraft = () => {
  modelDraftRow.value = null
}

const startEditModelRow = (model) => {
  if (!model) return
  if (modelDraftRow.value) {
    ElMessage.warning('请先保存或取消当前新增行')
    return
  }
  if (modelEditRow.value) {
    ElMessage.warning('请先保存或取消当前编辑行')
    return
  }
  modelEditRow.value = {
    id: model.id,
    alias: model.displayName || '',
    modelId: model.modelId || ''
  }
}

const cancelModelEdit = () => {
  modelEditRow.value = null
}

async function refreshConversationProviderAfterModelChange(providerId) {
  await loadConversationProviders()
  activeProvider.value = providerId
  await loadProviderDetail(providerId, 'kc-oc')
}

async function refreshCliProviderAfterModelChange(providerId) {
  await loadCliProviders()
  cliActiveProvider.value = providerId
  await loadCliProviderDetail(providerId)
}

const confirmModelEdit = async () => {
  const editRow = modelEditRow.value
  if (!editRow) return

  if (!editRow.modelId?.trim()) {
    ElMessage.warning('请输入模型 ID')
    return
  }

  const providerId = activeProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法编辑 Kooky 模型')
    return
  }

  const payload = {
    model_name: editRow.alias?.trim() || editRow.modelId.trim(),
    model_code: editRow.modelId.trim()
  }

  // 新建服务商阶段，模型仅本地编辑，不调接口
  if (isTempProviderId(providerId) || String(editRow.id).startsWith('m-')) {
    modelList.value = modelList.value.map((m) => {
      if (m.id !== editRow.id) return m
      return {
        ...m,
        modelId: payload.model_code,
        displayName: payload.model_name
      }
    })
    modelEditRow.value = null
    return
  }

  try {
    await providerConfigApi.updateModel(providerId, editRow.id, payload)
    ElMessage.success('更新模型成功')
    modelEditRow.value = null
    await refreshConversationProviderAfterModelChange(providerId)
  } catch (error) {
    console.error('更新模型失败:', error)
    handleApiError(error, '更新模型失败')
  }
}

const confirmModelDraft = async () => {
  const d = modelDraftRow.value
  if (!d) return

  if (!d.modelId) {
    ElMessage.warning('请选择模型 ID')
    return
  }

  const providerId = activeProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法为 Kooky 添加模型')
    return
  }

  const displayName = d.alias?.trim() || d.modelId

  if (isTempProviderId(providerId)) {
    const newRow = {
      id: `m-${Date.now()}`,
      modelId: d.modelId,
      displayName
    }
    modelList.value.push(newRow)
    activeConversationModelId.value = newRow.id
    modelDraftRow.value = null
    return
  }

  try {
    await providerConfigApi.addModel(providerId, {
      model_name: displayName,
      model_code: d.modelId
    })

    ElMessage.success('添加模型成功')
    modelDraftRow.value = null

    // 操作模型后同步刷新列表与详情
    await refreshConversationProviderAfterModelChange(providerId)
  } catch (error) {
    console.error('添加模型失败:', error)
    handleApiError(error, '添加模型失败')
  }
}

const startAddCliMapping = () => {
  if (cliDraftMapping.value) {
    ElMessage.warning('请先保存或取消当前新增映射')
    return
  }
  cliDraftMapping.value = { label: '', modelId: '' }
}

const cancelCliMappingDraft = () => {
  cliDraftMapping.value = null
}

const confirmCliMappingDraft = async () => {
  const d = cliDraftMapping.value
  if (!d) return

  if (!d.label?.trim()) {
    ElMessage.warning('请输入模型映射名称')
    return
  }
  if (!d.modelId) {
    ElMessage.warning('请选择模型 ID')
    return
  }

  const providerId = cliActiveProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法为 Kooky 添加模型映射')
    return
  }

  // CLI 模式限制：modelName 只能是 opus/sonnet/haiku
  // const validNames = ['opus', 'sonnet', 'haiku']
  const normalizedName = d.label.trim();
  // if (!validNames.includes(normalizedName)) {
  //   ElMessage.warning('CLI 模式下模型名称只能是: opus、sonnet、haiku')
  //   return
  // }

  if (isTempProviderId(providerId)) {
    const normalizedModelCode = String(d.modelId).trim()
    const newRow = {
      id: `cli-map-${Date.now()}`,
      label: normalizedName,
      modelId: normalizedModelCode,
      _originLabel: normalizedName,
      _originModelId: normalizedModelCode
    }
    cliModelMappings.value.push(newRow)
    activeCliMappingId.value = newRow.id
    cliDraftMapping.value = null
    return
  }

  try {
    await providerConfigApi.addModel(providerId, {
      model_name: normalizedName,
      model_code: d.modelId
    })

    ElMessage.success('添加模型映射成功')
    cliDraftMapping.value = null

    // 操作模型后同步刷新列表与详情
    await refreshCliProviderAfterModelChange(providerId)
  } catch (error) {
    console.error('添加模型映射失败:', error)
    handleApiError(error, '添加模型映射失败')
  }
}

async function handleCliMappingInlineChange(row) {
  if (!row) return

  const providerId = cliActiveProvider.value
  if (!providerId || providerId === 'kooky') return

  const modelName = String(row.label ?? '').trim().toLowerCase()
  const modelCode = String(row.modelId ?? '').trim()
  if (!modelName || !modelCode) return

  const validNames = ['opus', 'sonnet', 'haiku']
  if (!validNames.includes(modelName)) {
    ElMessage.warning('CLI 模式下模型名称只能是: opus、sonnet、haiku')
    return
  }

  row.label = modelName
  row.modelId = modelCode

  // 新建服务商或本地临时映射，仅在本地维护，不调用接口
  if (isTempProviderId(providerId) || String(row.id).startsWith('cli-map-')) {
    row._originLabel = modelName
    row._originModelId = modelCode
    return
  }

  if (row._originLabel === modelName && row._originModelId === modelCode) {
    return
  }

  try {
    await providerConfigApi.updateModel(providerId, row.id, {
      model_name: modelName,
      model_code: modelCode
    })
    row._originLabel = modelName
    row._originModelId = modelCode
    await refreshCliProviderAfterModelChange(providerId)
  } catch (error) {
    console.error('更新模型映射失败:', error)
    handleApiError(error, '更新模型映射失败')
  }
}

/** CLI 模式：删除模型映射 */
async function removeCliMapping(mappingId) {
  const providerId = cliActiveProvider.value
  if (!providerId || providerId === 'kooky') {
    ElMessage.warning('无法删除 Kooky 模型映射')
    return
  }

  const mapping = cliModelMappings.value.find(m => m.id === mappingId)
  if (!mapping) return

  // 临时 ID 直接删除
  if (String(mapping.id).startsWith('cli-map-')) {
    cliModelMappings.value = cliModelMappings.value.filter(m => m.id !== mappingId)
    if (activeCliMappingId.value === mappingId) {
      activeCliMappingId.value = cliModelMappings.value[0]?.id || null
    }
    return
  }

  try {
    await ElMessageBox.confirm('确认删除该模型映射?', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await providerConfigApi.deleteModel(providerId, mapping.id)
    ElMessage.success('删除成功')

    // 操作模型后同步刷新列表与详情
    await refreshCliProviderAfterModelChange(providerId)
  } catch (error) {
    if (error === 'cancel') return
    console.error('删除模型映射失败:', error)
    handleApiError(error, '删除失败')
  }
}

/** 打开 CLI 新建厂商对话框 */
function openCreateCliProviderDialog() {
  loadProviderTemplates()

  const existingTemp = cliProvidersScroll.value.find((p) => isTempProviderId(p.id))
  if (existingTemp) {
    cliActiveProvider.value = existingTemp.id
    ElMessage.warning('请先保存当前新建服务商')
    return
  }

  const tempId = createTempProviderId('kc-cc')
  cliProvidersScroll.value = [
    {
      id: tempId,
      name: '未命名服务商',
      modelCount: 0,
      logo: defaultProviderIcon,
      enabled: false,
      isTemp: true
    },
    ...cliProvidersScroll.value
  ]
  cliActiveProvider.value = tempId
  cliCurrentProviderDetail.value = {
    isBuiltin: false,
    displayName: ''
  }
  cliForm.value = {
    configName: '',
    baseUrl: '',
    apiKey: '',
    apiProtocol: ''
  }
  cliModelMappings.value = []
  cliDraftMapping.value = null
}

/** 弹框打开时再加载列表数据 */
watch(dialogVisible, (visible) => {
  resetTestConnectionStatus()
  if (!visible) return

  loadProviderTemplates()

  if (activeMenu.value === 'conversation-model-config') {
    loadConversationProviders().then(() => {
      activeProvider.value = 'kooky'
      loadProviderDetail('kooky', 'kc-oc')
    })
  } else if (activeMenu.value === 'cli-model') {
    loadCliProviders().then(() => {
      cliActiveProvider.value = 'kooky'
      loadCliProviderDetail('kooky')
    })
  }
})

/** 监听菜单切换，重新加载数据 */
watch(activeMenu, (newMenu) => {
  if (!dialogVisible.value) return
  resetTestConnectionStatus()
  if (newMenu === 'conversation-model-config') {
    loadConversationProviders().then(() => {
      activeProvider.value = 'kooky'
      loadProviderDetail('kooky', 'kc-oc')
    })
  } else if (newMenu === 'cli-model') {
    loadCliProviders().then(() => {
      cliActiveProvider.value = 'kooky'
      loadCliProviderDetail('kooky')
    })
  }
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    :align-center="true"
    modal-class="settings-dialog-modal"
    :width="960"
    :close-on-click-modal="false"
    class="settings-dialog"
    destroy-on-close
  >
    <div class="settings-container">
      <!-- 左侧：顶到底 -->
      <aside class="settings-sidebar">
        <div class="sidebar-title">设置</div>
        <nav class="settings-menu">
          <div
            v-for="item in menuItems"
            :key="item.id"
            class="menu-item"
            :class="{ active: activeMenu === item.id }"
            @click="handleMenuClick(item.id)"
          >
            <span
              class="menu-icon"
              :style="{
                WebkitMaskImage: `url(${item.icon})`,
                maskImage: `url(${item.icon})`
              }"
            />
            <span class="menu-label">{{ item.label }}</span>
          </div>
        </nav>
      </aside>

      <!-- 右侧：主内容 + 底部操作栏 -->
      <div class="settings-main">
        <el-button class="settings-close-btn" circle @click="dialogVisible = false">
          <el-icon :size="18">
            <Close />
          </el-icon>
        </el-button>

        <div class="settings-main-body">
          <!-- 对话模型配置：三栏 -->
          <div
            v-if="activeMenu === 'conversation-model-config'"
            class="settings-content settings-content--model"
          >
          <div class="content-page-header">
            <h2 class="content-title">对话模型配置</h2>
            <p class="content-desc">管理服务商的 API Key 与可用模型列表</p>
          </div>

          <div class="config-area">
            <!-- 中间：服务商 -->
            <div class="provider-list-wrap">
              <div class="provider-list-header">
                <span class="provider-list-title">服务商</span>
                <!-- <el-button class="provider-add-btn" :icon="Plus" circle text @click="openCreateProviderDialog" /> -->
              </div>

              <!-- 固定在顶部：Kooky 官方 -->
              <div
                class="provider-item provider-item--kooky-fixed"
                :class="{ active: activeProvider === 'kooky' }"
                @click="handleProviderClick('kooky')"
              >
                <span class="provider-logo">
                  <span class="provider-logo__inner">
                    <img
                      v-if="getProviderLogoSrc(kookyProvider.logo)"
                      :src="getProviderLogoSrc(kookyProvider.logo)"
                      class="provider-logo__img"
                      alt="logo"
                    />
                    <span v-else>{{ kookyProvider.logo }}</span>
                  </span>
                </span>
                <div class="provider-text">
                  <div class="provider-name-row">
                    <span class="provider-name">{{ kookyProvider.name }}</span>
                    <span class="provider-official-tag">官方</span>
                  </div>
                  <span class="provider-meta">{{ kookyProvider.modelCount }}个模型</span>
                </div>
              </div>

              <div class="provider-list-divider"></div>

              <div class="provider-list-body">
                <div
                  v-for="provider in providersScroll"
                  :key="provider.id"
                  class="provider-item"
                  :class="{ active: activeProvider === provider.id }"
                  @click="handleProviderClick(provider.id)"
                >
                  <span class="provider-logo">
                    <span class="provider-logo__inner">
                      <img
                        v-if="getProviderLogoSrc(provider.logo)"
                        :src="getProviderLogoSrc(provider.logo)"
                        class="provider-logo__img"
                        alt="logo"
                      />
                      <span v-else>{{ provider.logo }}</span>
                    </span>
                  </span>
                  <div class="provider-text">
                    <span class="provider-name">{{ provider.name }}</span>
                    <span class="provider-meta">{{ provider.modelCount }}个模型</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧：表单 + 底部操作（仅占表单列宽，服务商列可直通 dialog 底部） -->
            <div class="config-form-column">
              <div class="config-form-wrap">
                <template v-if="isKookyProvider">
                  <div class="config-form-provider-header">
                    <div class="config-form-provider-header__left">
                      <div class="config-provider-avatar">
                        <span class="config-provider-avatar__inner">
                          <img
                            v-if="getProviderLogoSrc(kookyProvider.logo)"
                            :src="getProviderLogoSrc(kookyProvider.logo)"
                            class="config-provider-avatar__img"
                            alt="logo"
                          />
                          <span v-else class="config-provider-avatar__emoji">{{ kookyProvider.logo }}</span>
                        </span>
                      </div>
                      <div class="config-provider-header-text">
                        <h3 class="config-provider-title">Kooky</h3>
                        <p class="config-provider-desc">{{ kookyProvider.modelCount }} 个可用模型 · 官方服务</p>
                      </div>
                    </div>
                    <div class="kooky-header-actions">
                      <button
                        v-if="showKookyQuotaApplyButton"
                        class="quota-apply-btn"
                        :class="{ 'is-applied': isKookyQuotaApplyDisabled }"
                        :disabled="isKookyQuotaApplyDisabled"
                        @click="handleApplyKookyQuota('oc')"
                      >
                        {{ isKookyQuotaApplyDisabled ? '已申请，待运营处理' : '申请更多额度' }}
                      </button>
                    </div>
                  </div>

                  <div class="kooky-fixed-content">
                    <div class="kooky-usage-block">
                      <div class="kooky-usage-title">
                        <span>已使用额度 <span class="kooky-usage-percent">{{ kookyUsagePercent }}%</span></span>
                      </div>
                      <el-progress
                        class="kooky-usage-progress"
                        :percentage="kookyUsagePercent"
                        :show-text="false"
                        :stroke-width="8"
                        :color="kookyUsageMeta.progressColor"
                      />
                      <p class="kooky-usage-tip">{{ kookyUsageMeta.tip }}</p>
                    </div>

                    <div class="kooky-model-list-section">
                      <div class="model-list-toolbar">
                        <div class="model-list-label-wrap">
                          <span class="model-list-label">模型列表</span>
                          <span class="model-list-badge">{{ kookyModelList.length }}</span>
                        </div>
                      </div>
                      <div class="kooky-model-list">
                        <div
                          v-for="modelName in kookyModelList"
                          :key="modelName"
                          class="kooky-model-item"
                        >
                          {{ modelName }}
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <div class="config-form-provider-header">
                    <div class="config-form-provider-header__left">
                      <div class="config-provider-avatar">
                        <span class="config-provider-avatar__inner">
                          <img
                            v-if="getProviderLogoSrc(currentProviderMeta?.logo)"
                            :src="getProviderLogoSrc(currentProviderMeta?.logo)"
                            class="config-provider-avatar__img"
                            alt="logo"
                          />
                          <span v-else class="config-provider-avatar__emoji">{{ currentProviderMeta?.logo }}</span>
                        </span>
                      </div>
                      <div class="config-provider-header-text">
                        <h3 class="config-provider-title">{{ currentProviderMeta?.name }}</h3>
                        <p class="config-provider-desc">{{ providerFormSubtitle }}</p>
                      </div>
                    </div>
                    <el-button
                      class="config-provider-delete-btn"
                      text
                      circle
                      @click="handleDeleteProvider"
                    >
                      <el-icon :size="14" color="#91949E">
                        <Delete />
                      </el-icon>
                    </el-button>
                  </div>

                  <el-form :model="configForm" label-position="top" class="config-form-fields">
                    <el-form-item label="服务商名称">
                      <el-select
                        v-model="configForm.serviceName"
                        filterable
                        allow-create
                        default-first-option
                        :reserve-keyword="false"
                        placeholder="请选择或输入服务商名称"
                        style="width: 100%"
                        @change="handleConversationProviderNameChange"
                      >
                        <el-option
                          v-for="tpl in providerTemplates"
                          :key="`oc-tpl-${tpl.id}`"
                          :label="tpl.name"
                          :value="tpl.name"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="API Key">
                      <el-input
                        v-model="configForm.apiKey"
                        type="password"
                        placeholder="请输入 API Key"
                        show-password
                      />
                    </el-form-item>

                    <el-form-item label="Base URL">
                      <el-input v-model="configForm.baseUrl" placeholder="https://api.anthropic.com" />
                    </el-form-item>

                    <el-form-item label="API 协议">
                      <el-input v-model="configForm.apiProtocol" placeholder="请输入协议说明" />
                    </el-form-item>

                    <div class="model-list-section">
                      <div class="model-list-toolbar">
                        <div class="model-list-label-wrap">
                          <span class="model-list-label">模型列表</span>
                          <span class="model-list-badge">{{ modelListBadgeCount }}</span>
                        </div>
                        <div class="model-list-actions">
                          <el-button
                            class="model-list-btn-outline"
                            :icon="Plus"
                            @click="startAddModelRow"
                          >
                            新增
                          </el-button>
                        </div>
                      </div>

                      <div class="model-list-table-wrap">
                        <table class="model-list-table">
                          <tbody>
                            <tr v-if="modelDraftRow" class="model-list-row model-list-row--edit">
                              <td class="model-list-col-name">
                                <el-input
                                  v-model="modelDraftRow.alias"
                                  placeholder="显示名称"
                                  clearable
                                  class="model-list-edit-input"
                                />
                              </td>
                              <td class="model-list-col-id">
                                <el-input
                                  v-model="modelDraftRow.modelId"
                                  placeholder="请输入模型ID"
                                  clearable
                                  class="model-list-edit-input"
                                />
                              </td>
                              <td class="model-list-col-actions">
                                <div class="model-list-row-actions">
                                  <el-button
                                    text
                                    class="model-list-icon-btn model-list-icon-btn--danger"
                                    @click="cancelModelDraft"
                                  >
                                    <el-icon :size="18">
                                      <Close />
                                    </el-icon>
                                  </el-button>
                                  <el-button
                                    text
                                    class="model-list-icon-btn model-list-icon-btn--success"
                                    @click="confirmModelDraft"
                                  >
                                    <el-icon :size="18">
                                      <Check />
                                    </el-icon>
                                  </el-button>
                                </div>
                              </td>
                            </tr>
                            <tr
                              v-if="!modelDraftRow && modelList.length === 0"
                              class="model-list-row model-list-row--empty"
                            >
                              <td colspan="3">
                                <div class="empty-data-text">暂无数据</div>
                              </td>
                            </tr>
                            <tr
                              v-for="m in modelList"
                              :key="m.id"
                              class="model-list-row model-list-row--data"
                              :class="{
                                'is-editing': modelEditRow?.id === m.id,
                                'is-active': activeConversationModelId === m.id
                              }"
                              @click="handleConversationModelRowClick(m.id)"
                            >
                              <td colspan="3">
                                <div v-if="modelEditRow?.id === m.id" class="model-list-data-row model-list-data-row--edit">
                                  <el-input
                                    v-model="modelEditRow.alias"
                                    placeholder="显示名称"
                                    clearable
                                    class="model-list-edit-input"
                                  />
                                  <el-input
                                    v-model="modelEditRow.modelId"
                                    placeholder="请输入模型ID"
                                    clearable
                                    class="model-list-edit-input"
                                  />
                                  <div class="model-list-row-actions">
                                    <el-button
                                      text
                                      class="model-list-icon-btn model-list-icon-btn--danger"
                                      @click="cancelModelEdit"
                                    >
                                      <el-icon :size="18">
                                        <Close />
                                      </el-icon>
                                    </el-button>
                                    <el-button
                                      text
                                      class="model-list-icon-btn model-list-icon-btn--success"
                                      @click="confirmModelEdit"
                                    >
                                      <el-icon :size="18">
                                        <Check />
                                      </el-icon>
                                    </el-button>
                                  </div>
                                </div>
                                <div v-else class="model-list-data-row">
                                  <div class="model-list-cell-name">
                                    <div class="model-list-cell-name__primary">{{ m.modelId }}</div>
                                    <div class="model-list-cell-name__sub">{{ m.displayName }}</div>
                                  </div>
                                  <div class="model-list-row-actions model-list-row-actions--hover">
                                    <el-button
                                      text
                                      class="model-list-icon-btn"
                                      @click="startEditModelRow(m)"
                                    >
                                      <el-icon :size="16">
                                        <EditPen />
                                      </el-icon>
                                    </el-button>
                                    <el-button
                                      text
                                      class="model-list-icon-btn model-list-icon-btn--danger"
                                      @click="removeModelRow(m.id)"
                                    >
                                      <el-icon :size="16">
                                        <Delete />
                                      </el-icon>
                                    </el-button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </el-form>
                </template>
              </div>

              <!-- <div class="settings-main-footer settings-main-footer--in-column">
                <div class="dialog-footer">
                  <el-button
                    v-if="!isKookyProvider"
                    link
                    type="primary"
                    class="test-link"
                    :class="testConnectionStatus === 'idle' ? '' : `is-${testConnectionStatus}`"
                    :disabled="testConnectionStatus === 'loading'"
                    @click="handleTestConnection"
                  >
                    <template v-if="testConnectionStatus === 'idle'">
                      <img :src="testLinkIcon" alt="" class="test-link__prefix-icon" />
                      <span class="test-link__text">测试连接</span>
                    </template>
                    <template v-else>
                      <el-icon v-if="testConnectionStatus === 'loading'" class="test-link__icon is-rotating">
                        <Loading />
                      </el-icon>
                      <el-icon v-else-if="testConnectionStatus === 'success'" class="test-link__icon">
                        <SuccessFilled />
                      </el-icon>
                      <el-icon v-else class="test-link__icon">
                        <CircleCloseFilled />
                      </el-icon>
                      <span class="test-link__text">{{ testConnectionStatusText }}</span>
                    </template>
                  </el-button>
                  <div class="dialog-footer-right">
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button
                      v-if="!isKookyProvider"
                      class="btn-save-dark"
                      type="primary"
                      @click="handleSave"
                    >
                      保存
                    </el-button>
                  </div>
                </div>
              </div> -->
            </div>
          </div>
          </div>

          <div
            v-else-if="activeMenu === 'cli-model'"
            class="settings-content settings-content--model"
          >
            <div class="content-page-header">
              <h2 class="content-title">CLI 模型配置</h2>
              <p class="content-desc">管理智能体 API 配置，支持自定义模型映射</p>
            </div>

            <div class="config-area">
              <div class="provider-list-wrap">
                <div class="provider-list-header">
                  <span class="provider-list-title">服务商</span>
                  <!-- <el-button class="provider-add-btn" :icon="Plus" circle text @click="openCreateCliProviderDialog" /> -->
                </div>

                <div
                  class="provider-item provider-item--kooky-fixed provider-item--with-switch"
                  :class="{ active: cliActiveProvider === 'kooky' }"
                  @click="handleCliProviderClick('kooky')"
                >
                  <div class="provider-item__main">
                    <span class="provider-logo">
                      <span class="provider-logo__inner">
                        <img
                          v-if="getProviderLogoSrc(kookyProvider.logo)"
                          :src="getProviderLogoSrc(kookyProvider.logo)"
                          class="provider-logo__img"
                          alt="logo"
                        />
                        <span v-else>{{ kookyProvider.logo }}</span>
                      </span>
                    </span>
                    <div class="provider-text">
                      <div class="provider-name-row">
                        <span class="provider-name">{{ kookyProvider.name }}</span>
                        <span class="provider-official-tag">官方</span>
                      </div>
                      <span class="provider-meta">{{kookyProvider.modelCount}}个模型</span>
                    </div>
                  </div>
                  <!-- <el-switch
                    v-model="cliKookyEnabled"
                    size="small"
                    :before-change="() => beforeCliProviderSwitchChange(cliKookyEnabled)"
                    @click.stop
                    @change="handleCliKookySwitchChange"
                  /> -->
                </div>

                <div class="provider-list-divider"></div>

                <div class="provider-list-body">
                  <div
                    v-for="provider in cliProvidersScroll"
                    :key="provider.id"
                    class="provider-item provider-item--with-switch"
                    :class="{ active: cliActiveProvider === provider.id }"
                    @click="handleCliProviderClick(provider.id)"
                  >
                    <div class="provider-item__main">
                      <span class="provider-logo">
                        <span class="provider-logo__inner">
                          <img
                            v-if="getProviderLogoSrc(provider.logo)"
                            :src="getProviderLogoSrc(provider.logo)"
                            class="provider-logo__img"
                            alt="logo"
                          />
                          <span v-else>{{ provider.logo }}</span>
                        </span>
                      </span>
                      <div class="provider-text">
                        <span class="provider-name">{{ provider.name }}</span>
                        <span class="provider-meta">{{ provider.modelCount }}个模型</span>
                      </div>
                    </div>
                    <el-switch
                      v-model="provider.enabled"
                      size="small"
                      :disabled="provider.isTemp"
                      :before-change="() => beforeCliProviderSwitchChange(provider.enabled)"
                      @click.stop
                      @change="(val) => handleCliProviderSwitchChange(provider.id, val)"
                    />
                  </div>
                </div>
              </div>

              <div class="config-form-column">
                <div class="config-form-wrap">
                  <template v-if="isCliKookyProvider">
                    <div class="config-form-provider-header">
                      <div class="config-form-provider-header__left">
                        <div class="config-provider-avatar">
                          <span class="config-provider-avatar__inner">
                            <img
                              v-if="getProviderLogoSrc(cliCurrentProviderMeta?.logo)"
                              :src="getProviderLogoSrc(cliCurrentProviderMeta?.logo)"
                              class="config-provider-avatar__img"
                              alt="logo"
                            />
                            <span v-else class="config-provider-avatar__emoji">{{ cliCurrentProviderMeta?.logo }}</span>
                          </span>
                        </div>
                        <div class="config-provider-header-text">
                          <h3 class="config-provider-title">Kooky</h3>
                          <p class="config-provider-desc">{{ cliProviderSubtitle }} · 官方服务</p>
                        </div>
                      </div>
                      <div class="kooky-header-actions">
                        <button
                          v-if="showCliKookyQuotaApplyButton"
                          class="quota-apply-btn"
                          :class="{ 'is-applied': isCliKookyQuotaApplyDisabled }"
                          :disabled="isCliKookyQuotaApplyDisabled"
                          @click="handleApplyKookyQuota('cli')"
                        >
                          {{ isCliKookyQuotaApplyDisabled ? '已申请，待运营处理' : '申请更多额度' }}
                        </button>
                      </div>
                    </div>

                    <div class="kooky-fixed-content">
                      <div class="kooky-usage-block">
                        <div class="kooky-usage-title">
                          <span>已使用额度 <span class="kooky-usage-percent">{{ cliKookyUsagePercent }}%</span></span>
                        </div>
                        <el-progress
                          class="kooky-usage-progress"
                          :percentage="cliKookyUsagePercent"
                          :show-text="false"
                          :stroke-width="8"
                          :color="cliKookyUsageMeta.progressColor"
                        />
                        <p class="kooky-usage-tip">{{ cliKookyUsageMeta.tip }}</p>
                      </div>

                      <div class="kooky-model-list-section">
                        <div class="model-list-toolbar">
                          <div class="model-list-label-wrap">
                            <span class="model-list-label">模型映射</span>
                            <span class="model-list-badge">{{ cliKookyModelList.length }}</span>
                          </div>
                        </div>
                        <div class="kooky-model-list">
                          <div
                            v-for="modelName in cliKookyModelList"
                            :key="`cli-kooky-${modelName}`"
                            class="kooky-model-item"
                          >
                            {{ modelName }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="config-form-provider-header">
                      <div class="config-form-provider-header__left">
                        <div class="config-provider-avatar">
                          <span class="config-provider-avatar__inner">
                            <img
                              v-if="getProviderLogoSrc(cliCurrentProviderMeta?.logo)"
                              :src="getProviderLogoSrc(cliCurrentProviderMeta?.logo)"
                              class="config-provider-avatar__img"
                              alt="logo"
                            />
                            <span v-else class="config-provider-avatar__emoji">{{ cliCurrentProviderMeta?.logo }}</span>
                          </span>
                        </div>
                        <div class="config-provider-header-text">
                          <h3 class="config-provider-title">{{ cliCurrentProviderMeta?.name }}</h3>
                          <p class="config-provider-desc">{{ cliProviderSubtitle }}</p>
                        </div>
                      </div>
                      <el-button
                        class="config-provider-delete-btn"
                        text
                        circle
                        @click="handleDeleteCliProvider"
                      >
                        <el-icon :size="14" color="#91949E" >
                          <Delete />
                        </el-icon>
                      </el-button>
                    </div>

                    <el-form :model="cliForm" label-position="top" class="config-form-fields">
                      <el-form-item label="配置名称">
                        <el-select
                          v-model="cliForm.configName"
                          filterable
                          allow-create
                          default-first-option
                          :reserve-keyword="false"
                          placeholder="请选择或输入配置名称"
                          style="width: 100%"
                          @change="handleCliProviderNameChange"
                        >
                          <el-option
                            v-for="tpl in providerTemplates"
                            :key="`cli-tpl-${tpl.id}`"
                            :label="tpl.name"
                            :value="tpl.name"
                          />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="BASE_URL">
                        <el-input v-model="cliForm.baseUrl" placeholder="请输入 BASE_URL" />
                      </el-form-item>
                      <el-form-item label="API KEY">
                        <el-input v-model="cliForm.apiKey" placeholder="请输入 API KEY" show-password />
                      </el-form-item>
                      <el-form-item label="API 协议">
                        <el-input v-model="cliForm.apiProtocol" placeholder="请输入协议说明" />
                      </el-form-item>

                      <div class="model-list-section model-list-section--cli">
                        <div class="model-list-toolbar">
                          <div class="model-list-label-wrap">
                            <span class="model-list-label">模型映射</span>
                            <span class="model-list-badge">{{ cliModelMapCount }}</span>
                          </div>
                          <div class="model-list-actions">
                            <el-button
                              class="model-list-btn-outline"
                              :icon="Plus"
                              @click="startAddCliMapping"
                            >
                              新增
                            </el-button>
                          </div>
                        </div>

                        <div class="cli-map-list">
                          <div v-if="cliDraftMapping" class="cli-map-row cli-map-row--edit">
                            <div class="cli-map-meta">
                              <el-input
                                v-model="cliDraftMapping.label"
                                placeholder="映射名称"
                                class="cli-map-label-input"
                              />
                            </div>
                            <div class="cli-map-controls">
                              <el-input
                                v-model="cliDraftMapping.modelId"
                                placeholder="请输入模型 ID"
                                clearable
                                class="cli-map-select"
                              />
                              <div class="model-list-row-actions">
                                <el-button text class="model-list-icon-btn model-list-icon-btn--danger" @click="cancelCliMappingDraft">
                                  <el-icon :size="18"><Close /></el-icon>
                                </el-button>
                                <el-button text class="model-list-icon-btn model-list-icon-btn--success" @click="confirmCliMappingDraft">
                                  <el-icon :size="18"><Check /></el-icon>
                                </el-button>
                              </div>
                            </div>
                          </div>
                          <div
                            v-if="!cliDraftMapping && cliModelMappings.length === 0"
                            class="cli-map-row cli-map-row--empty"
                          >
                            <div class="empty-data-text">暂无数据</div>
                          </div>

                          <div
                            v-for="row in cliModelMappings"
                            :key="row.id"
                            class="cli-map-row cli-map-row--data"
                            :class="{ 'is-active': activeCliMappingId === row.id }"
                            @click="handleCliMappingRowClick(row.id)"
                          >
                            <div class="cli-map-meta">
                              <el-input
                                v-model="row.label"
                                placeholder="请输入映射名称(opus/sonnet/haiku)"
                                class="cli-map-label-input"
                                @blur="handleCliMappingInlineChange(row)"
                              />
                            </div>
                            <div class="cli-map-controls">
                              <el-input
                                v-model="row.modelId"
                                class="cli-map-select"
                                placeholder="请输入模型 ID"
                                @blur="handleCliMappingInlineChange(row)"
                              />
                              <div class="model-list-row-actions cli-map-row-actions--hover">
                                <el-button
                                  text
                                  class="model-list-icon-btn model-list-icon-btn--danger"
                                  @click="removeCliMapping(row.id)"
                                >
                                  <el-icon :size="16"><Delete /></el-icon>
                                </el-button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </el-form>
                  </template>
                </div>

                <!-- <div class="settings-main-footer settings-main-footer--in-column">
                  <div class="dialog-footer">
                    <el-button
                      v-if="!isCliKookyProvider"
                      link
                      type="primary"
                      class="test-link"
                      :class="testConnectionStatus === 'idle' ? '' : `is-${testConnectionStatus}`"
                      :disabled="testConnectionStatus === 'loading'"
                      @click="handleTestConnection"
                    >
                      <template v-if="testConnectionStatus === 'idle'">
                        <img :src="testLinkIcon" alt="" class="test-link__prefix-icon" />
                        <span class="test-link__text">测试连接</span>
                      </template>
                      <template v-else>
                        <el-icon v-if="testConnectionStatus === 'loading'" class="test-link__icon is-rotating">
                          <Loading />
                        </el-icon>
                        <el-icon v-else-if="testConnectionStatus === 'success'" class="test-link__icon">
                          <SuccessFilled />
                        </el-icon>
                        <el-icon v-else class="test-link__icon">
                          <CircleCloseFilled />
                        </el-icon>
                        <span class="test-link__text">{{ testConnectionStatusText }}</span>
                      </template>
                    </el-button>
                    <div class="dialog-footer-right">
                      <el-button @click="dialogVisible = false">取消</el-button>
                      <el-button
                        v-if="!isCliKookyProvider"
                        class="btn-save-dark"
                        type="primary"
                        @click="handleSave"
                      >
                        保存
                      </el-button>
                    </div>
                  </div>
                </div> -->
              </div>
            </div>
          </div>

          <div v-else-if="activeMenu === 'about-kooky'" class="settings-content settings-content--simple">
            <div class="about-kooky-header">关于Kooky</div>
            <div class="about-kooky-page">
              <div class="about-kooky-gif-wrap">
                <div class="about-kooky-gif-glow"></div>
                <img src="@/assets/settings/kooky_about.gif" alt="Kooky" class="about-kooky-gif" />
              </div>
              <h2 class="about-kooky-title">Kooky</h2>
              <p class="about-kooky-version">版本：{{ appVersion || '—' }}</p>
            </div>
          </div>
        </div>

        <!-- 非「对话模型配置」页：底部操作仍占满右侧主区域 -->
        <!-- <div v-if="activeMenu === 'about-kooky'" class="settings-main-footer">
          <div class="dialog-footer">
            <div class="dialog-footer-right dialog-footer-right--only">
              <el-button @click="dialogVisible = false">关闭</el-button>
            </div>
          </div>
        </div> -->
      </div>
    </div>
  </el-dialog>

</template>

<style lang="scss">
// 遮罩层上下各 40px，保证相对视口底部也有留白（与 modal-class 或 :has 双保险）
.el-overlay.settings-dialog-modal,
.el-overlay:has(.settings-dialog.el-dialog) {
  padding: 40px 24px;
  box-sizing: border-box;
}

// 自定义类在 el-dialog 根节点上与 .el-dialog 同源，使用 .settings-dialog.el-dialog
.settings-dialog.el-dialog {
  --el-dialog-padding-primary: 0;
  height: calc(100vh - 80px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border-radius: 12px;
  // 弹窗外壳浅灰，与中间/右侧白底区分
  background: #f5f6f7;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
    min-height: 0;
  }

  .el-dialog__footer {
    display: none;
  }
}

.settings-container {
  --settings-dialog-radius: 12px;
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  margin: 0;
  padding: 0;
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  min-height: 0;
  background: #f7f7f7;
  border-right: 1px solid #ebeef5;
  border-radius: var(--settings-dialog-radius, 12px) 0 0 var(--settings-dialog-radius, 12px);
  overflow: hidden;
}

.sidebar-title {
  flex-shrink: 0;
  padding: 20px 16px 12px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}

.settings-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 16px;

  .menu-item {
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 40px;
    line-height: 40px;
    margin: 0 8px 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    color: #606266;

    &:hover {
      background: #FFF1EA;
    }

    &.active {
      background: #FFF1EA;
      color: #FF621F;
    }

    .menu-icon {
      width: 13px;
      height: 13px;
      margin-right: 8px;
      flex-shrink: 0;
      background-color: #909399;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
      -webkit-mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
      mask-size: contain;
    }

    &.active .menu-icon {
      background-color: #FF621F;
    }

    .menu-label {
      font-size: 14px;
      line-height: 1.4;
    }
  }
}

.settings-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #fff;
  border-radius: 0 var(--settings-dialog-radius, 12px) var(--settings-dialog-radius, 12px) 0;
  overflow: hidden;
}

.settings-close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 100;
  width: 24px !important;
  height: 24px !important;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  background: transparent;
  border: none;
  border-radius: 6px !important;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #606266;
    background: rgba(0, 0, 0, 0.06);
  }

  &:active {
    background: rgba(0, 0, 0, 0.1);
  }
}

.settings-main-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.settings-main-footer {
  flex-shrink: 0;
  height: 80px;
  padding: 0 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  background: #fff;
  box-shadow: 0px -4px 6px 0px rgba(47, 53, 71, 0.1);
  z-index: 2;
}

.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  &--model {
    background: #fff;
  }

  &--simple {
    background: #fff;
    align-items: stretch;
    justify-content: center;
  }
}

.settings-placeholder {
  flex: 1;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  .placeholder-title {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }

  .placeholder-desc {
    margin: 0;
    font-size: 14px;
    color: #909399;
    max-width: 360px;
  }
}

.content-page-header {
  flex-shrink: 0;
  padding: 20px 44px 16px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;

  .content-title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: #2F3547;
  }

  .content-desc {
    margin: 0;
    font-size: 13px;
    color: #909399;
    line-height: 1.5;
  }
}

.config-area {
  flex: 1;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  min-height: 0;
}

.provider-list-wrap {
  flex: 0 0 260px;
  align-self: stretch;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #ebeef5;
  overflow: hidden;
}

.provider-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 12px;
  flex-shrink: 0;

  .provider-list-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .provider-add-btn {
    color: #606266;

    &:hover {
      color: #ff6b35;
      background: #f5f7fa;
    }
  }
}

.provider-list-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 16px;
}

.provider-list-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 4px 12px 8px;
  background: #ebeef5;
}

.provider-item--kooky-fixed {
  flex-shrink: 0;
  margin: 0 12px 0;
  padding: 12px;
  border-radius: 8px;

  .provider-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .provider-official-tag {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    height: 20px;
    font-size: 11px;
    font-weight: 500;
    color: #FF621F;
    background: #FFFFFF;
    border-radius: 4px;
    line-height: 1;
  }

  .provider-text {
    gap: 4px;
  }
}

.provider-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;

  &:hover {
    background: #FFF1EA;
  }

  &.active {
    background: #FFF1EA;
  }

  .provider-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .provider-name {
    font-size: 14px;
    font-weight: 500;
    color: #2F3547;
  }

  .provider-meta {
    font-size: 12px;
    color: #91949E;
  }
}

.provider-item--with-switch {
  justify-content: space-between;

  .provider-item__main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  :deep(.el-switch) {
    flex-shrink: 0;
    margin-left: 8px;
  }
}

.config-form-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.settings-main-footer--in-column {
  flex-shrink: 0;
  width: 100%;
}

.config-form-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.config-form-provider-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px;
  background: #fff;
}

.kooky-fixed-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 24px 20px;
  background: #fff;
}

.kooky-usage-block {
  margin-bottom: 18px;
}

.kooky-usage-alert {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
}

.kooky-usage-alert-index {
  font-size: 24px;
  line-height: 1;
}

.kooky-usage-alert.is-high {
  color: #ff4d9d;
}

.kooky-usage-alert.is-medium {
  color: #ff4d9d;
}

.kooky-usage-alert.is-low {
  color: #ff4d9d;
}

.kooky-usage-title {
  margin-bottom: 12px;
  font-size: 14px;
  color: #91949E;
  font-weight: 400;
  line-height: 1.4;
}

.kooky-header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.kooky-usage-percent {
  font-size: 14px;
  font-weight: 600;
  color: #2f3547;
  margin-left: 6px;
}

.kooky-usage-progress {
  :deep(.el-progress-bar__outer) {
    background: #eef1f6;
  }
}

.kooky-usage-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: #91949E;
}

.quota-apply-btn {
  border-radius: 8px;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 1px solid #FF5233;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  color: #FF684E;
  padding: 4px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.quota-apply-btn.is-applied {
  border-color: #D8DCE5;
  background: #F4F6FA;
  color: #91949E;
  cursor: default;
}

.kooky-model-list-section {
  margin-top: 6px;
}

.kooky-model-list {
  border: 1px solid #eceef3;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.kooky-model-item {
  padding: 10px 12px;
  font-size: 14px;
  color: #2f3547;
  line-height: 1.35;
  border-bottom: 1px solid #eceef3;

  &:last-child {
    border-bottom: none;
  }
}

.config-form-provider-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

// 服务商列表 & 配置顶栏：logo 外框与内层图形统一规格
.provider-logo,
.config-provider-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #fff;
  box-sizing: border-box;
  border: 1px solid #eceef3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.config-provider-avatar {
  width: 48px !important;
  height: 48px !important;
}
.provider-logo__inner,
.config-provider-avatar__inner {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  font-size: 20px;
  line-height: 1;
}

.config-provider-avatar__emoji {
  display: block;
  max-width: 26px;
  max-height: 26px;
  font-size: inherit;
  line-height: 1;
}

.provider-logo__img,
.config-provider-avatar__img {
  display: block;
  width: 100%;
  height: 100%;

}

.config-provider-header-text {
  min-width: 0;
}

.config-provider-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: #303133;
  line-height: 1.35;
}

.config-provider-desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.45;
}

.config-provider-delete-btn {
  flex-shrink: 0;
  color: #909399;
}

.config-form-fields {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: #303133;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select .el-input__wrapper) {
    border-radius: 8px;
  }
}

.model-list-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
  min-width: 0;

  :deep(.model-list-edit-input .el-input__wrapper),
  :deep(.model-list-edit-select .el-input__wrapper) {
    border-radius: 8px;
    max-width: 100%;
  }

  :deep(.model-list-edit-select),
  :deep(.model-list-edit-select .el-select__wrapper) {
    width: 100% !important;
    max-width: 100%;
    min-width: 0;
  }
}

.model-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.model-list-label-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-list-label {
  font-size: 14px;
  font-weight: 500;
  color: #2F3547;
}

.model-list-badge {
  min-width: 18px;
  height: 18px;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  background: #f0f2f5;
  border-radius: 11px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.model-list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.model-list-btn-outline {
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
  border-radius: 8px;
  font-weight: 500;

  &:hover {
    color: #409eff;
    border-color: #c6e2ff;
    background: #fff;
  }
}

.model-list-table-wrap {
  border-radius: 12px;
  background: #f5f6f8;
  border: 1px solid #eceef3;
  box-sizing: border-box;
  overflow-x: hidden;
  max-width: 100%;
}

.model-list-table {
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  tbody td {
    padding: 10px 8px;
    vertical-align: middle;
    border-bottom: 1px solid #eceef3;
    background: #fff;
    min-width: 0;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .model-list-row--edit {
    .model-list-col-name {
      width: 34%;
    }

    .model-list-col-id {
      width: auto;
    }

    .model-list-col-actions {
      width: 76px;
      max-width: 76px;
      padding-left: 4px;
      padding-right: 4px;
      text-align: right;
      white-space: nowrap;
    }
  }
}

.model-list-data-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-list-data-row--edit {
  display: grid;
  grid-template-columns: 34% 1fr auto;
  gap: 8px;
  align-items: center;
}

.model-list-data-row .model-list-cell-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.model-list-data-delete {
  flex-shrink: 0;
}

.model-list-row--edit td {
  background: #ECEEF3 !important;
}

.model-list-row--empty td {
  background: #fff;
}

.model-list-cell-name__primary {
  font-weight: 600;
  color: #2f3547;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-list-cell-name__sub {
  margin-top: 4px;
  font-size: 13px;
  color: #91949e;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-list-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.model-list-row-actions--hover {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.18s ease, visibility 0.18s ease;
}

.model-list-row--data:hover .model-list-row-actions--hover,
.model-list-row--data.is-editing .model-list-row-actions--hover {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.model-list-icon-btn {
  padding: 4px;

  &.model-list-icon-btn--danger {
    color: #f56c6c;

    &:hover {
      color: #f78989;
      background: rgba(245, 108, 108, 0.1);
    }
  }

  &.model-list-icon-btn--success {
    color: #67c23a;

    &:hover {
      color: #85ce61;
      background: rgba(103, 194, 58, 0.12);
    }
  }
}

.model-list-edit-input,
.model-list-edit-select {
  width: 100%;
  max-width: 100%;
}

.model-list-section--cli {
  margin-top: 4px;
}

.cli-map-list {
  border: 1px solid #eceef3;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.cli-map-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eceef3;

  &:last-child {
    border-bottom: none;
  }
}

.cli-map-row--edit {
  background: #fafbfc;
}

.cli-map-row--empty {
  justify-content: center;
}

.empty-data-text {
  width: 100%;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
  line-height: 44px;
}

.cli-map-meta {
  min-width: 0;
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cli-map-title {
  font-size: 16px;
  line-height: 1.3;
  font-weight: 600;
  color: #2f3547;
}

.cli-map-controls {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cli-map-row-actions--hover {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.18s ease, visibility 0.18s ease;
}

.cli-map-row--data:hover .cli-map-row-actions--hover {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.cli-map-select {
  flex: 1;
  min-width: 0;
}

.cli-map-label-input {
  width: 100%;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .test-link {
    padding: 0;
    color: #2F3547;
    --el-button-text-color: #2F3547;
    --el-button-hover-text-color: #2F3547;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    line-height: 14px;
    transition: color 0.2s ease;

    &.is-loading {
      color: #ff684e;
    }

    &.is-success {
      color: #14b8a6;
    }

    &.is-error {
      color: #ff5233;
    }

    &:hover:not(:disabled) {
      color: #4A5268;
      --el-button-hover-text-color: #4A5268;

      .test-link__prefix-icon,
      .test-link__icon,
      .test-link__text {
        opacity: 0.85;
      }
    }

    &.is-success:hover:not(:disabled) {
      color: #12A999;
      --el-button-hover-text-color: #12A999;
    }

    &.is-error:hover:not(:disabled) {
      color: #F25A3F;
      --el-button-hover-text-color: #F25A3F;
    }

    .test-link__prefix-icon {
      width: 14px;
      height: 14px;
      display: inline-block;
      margin-right: 8px;
      transition: opacity 0.2s ease;
    }

    .test-link__icon {
      font-size: 14px;
      line-height: 1;
      transition: opacity 0.2s ease;
    }

    .test-link__text {
      font-size: 14px;
      line-height: 14px;
      transition: opacity 0.2s ease;
    }

    .is-rotating {
      animation: test-connection-spin 1s linear infinite;
    }
  }

  .dialog-footer-right {
    margin-left: auto;

    &--only {
      width: 100%;
      display: flex;
      justify-content: flex-end;
    }
  }
}

@keyframes test-connection-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.btn-save-dark {
  --el-button-bg-color: #303133;
  --el-button-border-color: #303133;
  --el-button-hover-bg-color: #454545;
  --el-button-hover-border-color: #454545;
  --el-button-active-bg-color: #1d1d1d;
  --el-button-active-border-color: #1d1d1d;
  min-width: 88px;
  border-radius: 8px;
}

.about-kooky-header {
  flex-shrink: 0;
  padding: 20px 24px 16px;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: normal;
  color: #2F3547;
}

.about-kooky-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  text-align: center;
}

.about-kooky-gif-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-kooky-gif-glow {
  position: absolute;
  width: 214px;
  height: 214px;
  opacity: 0.4;
  background: #FF9E43;
  filter: blur(184px);
  border-radius: 50%;
}

.about-kooky-gif {
  position: relative;
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.about-kooky-title {
  margin: 0 0 8px;
  color: #2F3547;
  font-family: Alibaba PuHuiTi 2.0;
  font-size: 32px;
  font-weight: bold;
  color: #171B26;
}

.about-kooky-version {
  margin: 0 0 24px;
  font-size: 14px;
  color: #91949E;
  font-family: PingFang SC;
  font-size: 16px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: normal;
  /* 文本色&图标色/二级文本色 */
  color: #606572;
}

.about-kooky-copyright {
  margin: 0;
  font-size: 12px;
  color: #C2C3C9;
}
</style>
