<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, ArrowDown } from '@element-plus/icons-vue'
import Loading from '@/shared/components/Loading/index.vue'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import * as providerConfigApi from '@/shared/services/providerConfigApi'
import batchTest from '@/assets/settings/batchTest.svg'
import testLinkIcon from '@/assets/settings/test_icon.svg'
import apiLoadingIcon from '@/assets/settings/loading.png'
import defaultProviderIcon from '@/assets/settings/default_icon.svg'
import { resolveBundledImageFromApiPath, isLikelyInvalidSrcAssetPath } from '@/shared/utils/localApiAssetMap'
import { getProviderChannelSaveState } from './providerChannelSaveState.mjs'

const props = defineProps({
  providerId: { type: [String, Number], default: null },
  providers: { type: Array, default: () => [] },
  allProviders: { type: Array, default: () => [] },
  tempProviderDraft: { type: Object, default: null },
})

const emit = defineEmits(['refresh-providers', 'update-temp-name', 'update-temp-draft'])

const TEMP_PROVIDER_PREFIX = 'temp-provider-'
const NEW_PROVIDER_DEFAULT_NAME = 'New Provider'

const API_PROTOCOL_OPTIONS = [
  { label: 'OpenAI Chat Completions', value: 'openai_completions' },
  { label: 'OpenAI Responses (New)', value: 'openai_responses' },
  { label: 'Anthropic Messages', value: 'anthropic_messages' },
  // { label: 'Google Generative AI (Gemini API)', value: 'google_generative_ai' },
  // { label: 'AWS Bedrock', value: 'aws_bedrock' },
]

const KODE_API_PROTOCOL_OPTIONS = [
  { label: 'Anthropic Messages', value: 'anthropic_messages' },
]

const CONFIG_SCENE_TAB = {
  DIALOG: 'dialog',
  KODE: 'kode',
}

const KODE_ALIAS_OPTIONS = ['Opus', 'Sonnet', 'Haiku', 'Custom']

const PROVIDER_NAME_MAX_LEN = 50
// 允许中间空格；禁止首尾空格；禁止其它特殊符号
const PROVIDER_NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/

const API_KEY_MAX_LEN = 2048
/** 允许英文、数字及可见 ASCII 符号；禁止中文、空白与控制字符 */
const API_KEY_PATTERN = /^[\x21-\x7E]+$/

const BASE_URL_MAX_LEN = 500
/** PRD：HTTP/HTTPS，域名/端口/路径合法字符（RFC 3986 常用子集） */
const BASE_URL_SCHEME_PATTERN = /^https?:\/\//i
const BASE_URL_BODY_PATTERN = /^[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%\-]+$/

/** 对话模型：显示名称 */
const CHAT_MODEL_DISPLAY_NAME_MAX_LEN = 200
const CHAT_MODEL_DISPLAY_NAME_PATTERN = /^[\u4e00-\u9fa5a-zA-Z0-9\s.,，。、；;：:？！?!…·\-—_~@#%&*+=/\\|<>「」『』【】（）()《》\u201c\u201d\u2018\u2019\[\]{}]+$/

/** 对话模型：模型 ID（大小写英文、数字、. - _） */
const CHAT_MODEL_ID_MAX_LEN = 200
const CHAT_MODEL_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

/** Kode 模型：模型 ID（大小写英文、数字、. - _） */
const KODE_MODEL_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

function sanitizeChatModelDisplayNameInput(val) {
  return String(val ?? '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.,，。、；;：:？！?!…·\-—_~@#%&*+=/\\|<>「」『』【】（）()《》\u201c\u201d\u2018\u2019\[\]{}]/g, '')
    .slice(0, CHAT_MODEL_DISPLAY_NAME_MAX_LEN)
}

function sanitizeChatModelIdInput(val) {
  return String(val ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, CHAT_MODEL_ID_MAX_LEN)
}

function sanitizeKodeModelIdInput(val) {
  return String(val ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, CHAT_MODEL_ID_MAX_LEN)
}

function validateChatModelDisplayName(raw) {
  const val = String(raw ?? '')
  const trimmed = val.trim()
  if (!trimmed) {
    ElMessage.warning('请输入显示名称')
    return null
  }
  if (val !== trimmed) {
    ElMessage.warning('显示名称不能包含首尾空格')
    return null
  }
  if (trimmed.length > CHAT_MODEL_DISPLAY_NAME_MAX_LEN) {
    ElMessage.warning(`显示名称不能超过 ${CHAT_MODEL_DISPLAY_NAME_MAX_LEN} 个字符`)
    return null
  }
  if (!CHAT_MODEL_DISPLAY_NAME_PATTERN.test(trimmed)) {
    ElMessage.warning('显示名称仅支持中英文、数字、空格及常用标点')
    return null
  }
  return trimmed
}

function validateChatModelId(raw) {
  const val = String(raw ?? '')
  const trimmed = val.trim()
  if (!trimmed) {
    ElMessage.warning('请输入模型 ID')
    return null
  }
  if (/\s/.test(val)) {
    ElMessage.warning('模型 ID 不能包含空格')
    return null
  }
  if (trimmed.length > CHAT_MODEL_ID_MAX_LEN) {
    ElMessage.warning(`模型 ID 不能超过 ${CHAT_MODEL_ID_MAX_LEN} 个字符`)
    return null
  }
  if (!CHAT_MODEL_ID_PATTERN.test(trimmed)) {
    ElMessage.warning('模型 ID 仅支持英文、数字、点、连字符和下划线')
    return null
  }
  return trimmed
}

function validateKodeModelId(raw) {
  const val = String(raw ?? '')
  const trimmed = val.trim()
  if (!trimmed) {
    ElMessage.warning('请输入模型 ID')
    return null
  }
  if (/\s/.test(val)) {
    ElMessage.warning('模型 ID 不能包含空格')
    return null
  }
  if (trimmed.length > CHAT_MODEL_ID_MAX_LEN) {
    ElMessage.warning(`模型 ID 不能超过 ${CHAT_MODEL_ID_MAX_LEN} 个字符`)
    return null
  }
  if (!KODE_MODEL_ID_PATTERN.test(trimmed)) {
    ElMessage.warning('模型 ID 仅支持英文、数字、点、连字符和下划线')
    return null
  }
  return trimmed
}

function validateChatModelsList(models) {
  for (const m of models) {
    if (!validateChatModelDisplayName(m.displayName)) return false
    if (!validateChatModelId(m.modelCode)) return false
  }
  return true
}

function getAvailableKodeAliasOptions(excludeModelId = null) {
  const editingRow = excludeModelId
    ? kodeModels.value.find((m) => m.id === excludeModelId)
    : null
  const used = new Set(
    kodeModels.value
      .filter((m) => m.id !== excludeModelId)
      .map((m) => m.displayName)
  )
  const available = KODE_ALIAS_OPTIONS.filter((alias) => !used.has(alias))
  const current = editingRow?.displayName?.trim()
  if (current && !available.includes(current) && !used.has(current)) {
    return [current, ...available]
  }
  return available
}

function validateKodeModelDisplayName(raw, excludeModelId = null) {
  const val = String(raw ?? '').trim()
  if (!val) {
    ElMessage.warning('请选择显示名称')
    return null
  }
  const editingRow = excludeModelId
    ? kodeModels.value.find((m) => m.id === excludeModelId)
    : null
  const isLegacyKeep = editingRow?.displayName === val && !KODE_ALIAS_OPTIONS.includes(val)
  if (!KODE_ALIAS_OPTIONS.includes(val) && !isLegacyKeep) {
    ElMessage.warning('请选择有效的显示名称')
    return null
  }
  const duplicate = kodeModels.value.some(
    (m) => m.id !== excludeModelId && m.displayName === val
  )
  if (duplicate) {
    ElMessage.warning('该显示名称已被使用')
    return null
  }
  return val
}

function validateKodeModelsList(models) {
  for (const m of models) {
    if (!validateKodeModelDisplayName(m.displayName, m.id)) return false
    if (!validateKodeModelId(m.modelCode)) return false
  }
  const aliases = models.map((m) => m.displayName)
  if (new Set(aliases).size !== aliases.length) {
    ElMessage.warning('显示名称不能重复')
    return false
  }
  return true
}

function isMaskedApiKey(key) {
  const k = String(key ?? '').trim()
  if (!k) return false
  if (k.includes('*')) return true
  return /^[•·.]+$/.test(k)
}

function validateApiKey(rawKey, { required = true } = {}) {
  const key = String(rawKey ?? '')
  const trimmed = key.trim()
  if (!trimmed) {
    if (required) ElMessage.warning('请先填写 API Key')
    return required ? null : ''
  }
  if (isMaskedApiKey(trimmed)) return trimmed
  if (key !== trimmed) {
    ElMessage.warning('API Key 不能包含首尾空格')
    return null
  }
  if (trimmed.length > API_KEY_MAX_LEN) {
    ElMessage.warning(`API Key 不能超过 ${API_KEY_MAX_LEN} 个字符`)
    return null
  }
  if (!API_KEY_PATTERN.test(trimmed)) {
    ElMessage.warning('API Key 不能包含空格、中文或控制字符')
    return null
  }
  return trimmed
}

function handleApiKeyInput(val) {
  configForm.value.apiKey = String(val ?? '')
    .replace(/[^\x21-\x7E]/g, '')
    .slice(0, API_KEY_MAX_LEN)
  apiKeyTouched.value = true
}

function handleKodeApiKeyInput(val) {
  configForm.value.kodeApiKey = String(val ?? '')
    .replace(/[^\x21-\x7E]/g, '')
    .slice(0, API_KEY_MAX_LEN)
  kodeApiKeyTouched.value = true
}

/** 是否明文显示 API Key（对应眼睛睁开）；保存后设为 false 即隐藏 */
const apiKeyPlainVisible = ref(false)

function collapseApiKeyPasswordVisible() {
  apiKeyPlainVisible.value = false
}

function syncApiKeyStoredAfterSave(savedKey) {
  const raw = String(savedKey ?? '').trim()
  if (!raw) return
  storedApiKeyFromServer.value = raw
  hasExistingApiKey.value = true
  apiKeyTouched.value = false
}

function syncKodeApiKeyStoredAfterSave(savedKey) {
  const raw = String(savedKey ?? '').trim()
  if (!raw) return
  storedKodeApiKeyFromServer.value = raw
  hasExistingKodeApiKey.value = true
  kodeApiKeyTouched.value = false
}

function switchConfigSceneTab(tab) {
  if (configSceneTab.value === tab) return
  configSceneTab.value = tab
  resetTestConnectionStatus()
}

/** 输入时过滤：禁止空格、中文及 URL 不允许的特殊字符 */
function sanitizeBaseUrlInput(val) {
  return String(val ?? '')
    .replace(/[\s\u4e00-\u9fff]/g, '')
    .replace(/[^a-zA-Z0-9:/?#[\]@!$&'()*+,;=%.\-_~]/g, '')
    .slice(0, BASE_URL_MAX_LEN)
}

function handleBaseUrlInput(val) {
  configForm.value.baseUrl = sanitizeBaseUrlInput(val)
}

function handleKodeBaseUrlInput(val) {
  configForm.value.kodeDefaultBaseUrl = sanitizeBaseUrlInput(val)
}

function validateBaseUrl(rawUrl, { required = true } = {}) {
  const url = String(rawUrl ?? '')
  const trimmed = url.trim()
  if (!trimmed) {
    if (required) ElMessage.warning('请先填写 Base URL')
    return required ? null : ''
  }
  if (url !== trimmed || /\s/.test(trimmed)) {
    ElMessage.warning('Base URL 不能包含空格')
    return null
  }
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    ElMessage.warning('Base URL 不能包含中文')
    return null
  }
  if (trimmed.length > BASE_URL_MAX_LEN) {
    ElMessage.warning(`Base URL 不能超过 ${BASE_URL_MAX_LEN} 个字符`)
    return null
  }
  if (!BASE_URL_SCHEME_PATTERN.test(trimmed)) {
    ElMessage.warning('Base URL 须以 http:// 或 https:// 开头')
    return null
  }
  const body = trimmed.replace(BASE_URL_SCHEME_PATTERN, '')
  if (!body) {
    ElMessage.warning('Base URL 须包含域名或主机')
    return null
  }
  if (!BASE_URL_BODY_PATTERN.test(body)) {
    ElMessage.warning('Base URL 仅支持域名、端口与路径合法字符')
    return null
  }
  return trimmed
}

/** 编辑未改 Key 时回传服务端原值（含掩码 sk-***），避免 full 保存漏传 api_key */
function getEffectiveApiKey() {
  const typed = configForm.value.apiKey.trim()
  if (typed) return typed
  if (hasExistingApiKey.value && !apiKeyTouched.value) {
    return String(storedApiKeyFromServer.value ?? '').trim()
  }
  return ''
}

function getEffectiveKodeApiKey() {
  const typed = configForm.value.kodeApiKey.trim()
  if (typed) return typed
  if (hasExistingKodeApiKey.value && !kodeApiKeyTouched.value) {
    return String(storedKodeApiKeyFromServer.value ?? '').trim()
  }
  return ''
}

function validateApiProtocol(protocol, { required = true, label = 'API' } = {}) {
  if (String(protocol || '').trim()) return true
  if (!required) return true
  ElMessage.warning(`请选择 ${label} 协议`)
  return false
}

function isCustomProviderSelected() {
  return configForm.value.serviceName === '自定义'
}

function getDialogSaveState() {
  return getProviderChannelSaveState({
    apiKey: getEffectiveApiKey(),
    models: chatModels.value,
    enabled: dialogEnabled.value,
  })
}

function getKodeSaveState() {
  return getProviderChannelSaveState({
    apiKey: getEffectiveKodeApiKey(),
    models: kodeModels.value,
    enabled: kodeEnabled.value,
  })
}

/**
 * 保存前必填：对话 / Kode 至少配置一套；
 * API Key 与模型列表都为空的通道视为未配置，不参与必填校验。
 */
function validateApiCredentialSetsBeforeSave(dialogState = getDialogSaveState(), kodeState = getKodeSaveState()) {
  if (dialogState.empty && kodeState.empty) {
    ElMessage.warning('请至少配置对话或 Kode 其中一套模型服务')
    return false
  }

  const shouldValidateEndpointFields = isCustomProviderSelected()

  if (!dialogState.empty) {
    if (validateApiKey(getEffectiveApiKey(), { required: true }) == null) return false
    if (shouldValidateEndpointFields) {
      if (validateBaseUrl(configForm.value.baseUrl, { required: true }) == null) return false
      if (!validateApiProtocol(configForm.value.apiProtocol, { required: true, label: '对话 API' })) {
        return false
      }
    }
  }

  if (!kodeState.empty) {
    if (validateApiKey(getEffectiveKodeApiKey(), { required: true }) == null) return false
    if (shouldValidateEndpointFields) {
      if (validateBaseUrl(configForm.value.kodeDefaultBaseUrl, { required: true }) == null) return false
      if (!validateApiProtocol(configForm.value.kodeApiProtocol, { required: true, label: 'Kode API' })) {
        return false
      }
    }
  }

  return true
}

function validateProviderDisplayName(rawName) {
  const name = String(rawName ?? '')
  const trimmed = name.trim()
  if (!trimmed) {
    ElMessage.warning('请输入服务商名称')
    return null
  }
  if (name !== trimmed) {
    ElMessage.warning('服务商名称不能包含首尾空格')
    return null
  }
  if (trimmed.length > PROVIDER_NAME_MAX_LEN) {
    ElMessage.warning(`服务商名称不能超过 ${PROVIDER_NAME_MAX_LEN} 个字符`)
    return null
  }
  if (!PROVIDER_NAME_PATTERN.test(trimmed)) {
    ElMessage.warning('服务商名称仅支持英文、数字、空格、下划线和连字符')
    return null
  }
  return trimmed
}

function handleDisplayNameInput(val) {
  configForm.value.customName = String(val ?? '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .slice(0, PROVIDER_NAME_MAX_LEN)
}

function isTempProviderId(providerId) {
  return typeof providerId === 'string' && providerId.startsWith(TEMP_PROVIDER_PREFIX)
}

function handleApiError(error, defaultMsg = '操作失败') {
  console.error(defaultMsg, error)
  let errorMsg = defaultMsg
  if (error?.detail) errorMsg = error.detail
  else if (error?.response?.data?.detail) errorMsg = error.response.data.detail
  else if (error?.data?.detail) errorMsg = error.data.detail
  else if (error?.message) errorMsg = error.message
  else if (typeof error === 'string') errorMsg = error
  ElMessage.error(errorMsg)
}

function resolveProviderIcon(...icons) {
  return icons.find((icon) => String(icon ?? '').trim()) || defaultProviderIcon
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

function mapModelRow(m, idx, prefix = 'chat') {
  return {
    id: m.id ?? `${prefix}-${idx}`,
    displayName: m.model_name || m.modelName || '',
    modelCode: m.model_code || m.modelCode || '',
    sortOrder: m.sort_order ?? m.sortOrder ?? idx + 1,
    healthStatus: 'idle',
  }
}

const suppressedTempDraftProviderIds = new Set()

function cloneRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : []
}

function cloneNullableRow(row) {
  return row ? { ...row } : null
}

function createDefaultTempConfigForm(customName = NEW_PROVIDER_DEFAULT_NAME) {
  return {
    serviceName: '自定义',
    customName,
    apiKey: '',
    baseUrl: '',
    apiProtocol: '',
    kodeApiKey: '',
    kodeDefaultBaseUrl: '',
    kodeApiProtocol: 'anthropic_messages',
    templateId: null,
    isCustom: true,
  }
}

function createEmptyModelRow(prefix = 'chat') {
  return {
    id: `${prefix}-temp-${Date.now()}`,
    displayName: '',
    modelCode: '',
    healthStatus: 'idle',
  }
}

function createDefaultTempProviderDraft(customName = NEW_PROVIDER_DEFAULT_NAME) {
  return {
    configForm: createDefaultTempConfigForm(customName),
    configSceneTab: CONFIG_SCENE_TAB.DIALOG,
    dialogEnabled: true,
    kodeEnabled: true,
    persistedDialogEnabled: false,
    persistedKodeEnabled: false,
    chatModels: [createEmptyModelRow('chat')],
    kodeModels: [createEmptyModelRow('kode')],
    chatDraft: null,
    chatEdit: null,
    kodeDraft: null,
    kodeEdit: null,
    fetchedDialogModelOptions: [],
    fetchedKodeModelOptions: [],
    storedApiKeyFromServer: '',
    hasExistingApiKey: false,
    apiKeyTouched: false,
    storedKodeApiKeyFromServer: '',
    hasExistingKodeApiKey: false,
    kodeApiKeyTouched: false,
  }
}

function normalizeTempProviderDraft(draft, fallbackName = NEW_PROVIDER_DEFAULT_NAME) {
  const fallback = createDefaultTempProviderDraft(fallbackName)
  if (!draft || typeof draft !== 'object') return fallback
  const sceneTab = Object.values(CONFIG_SCENE_TAB).includes(draft.configSceneTab)
    ? draft.configSceneTab
    : fallback.configSceneTab
  return {
    ...fallback,
    configForm: {
      ...fallback.configForm,
      ...(draft.configForm || {}),
    },
    configSceneTab: sceneTab,
    dialogEnabled: Boolean(draft.dialogEnabled),
    kodeEnabled: Boolean(draft.kodeEnabled),
    persistedDialogEnabled: Boolean(draft.persistedDialogEnabled),
    persistedKodeEnabled: Boolean(draft.persistedKodeEnabled),
    chatModels: cloneRows(draft.chatModels),
    kodeModels: cloneRows(draft.kodeModels),
    fetchedDialogModelOptions: cloneRows(draft.fetchedDialogModelOptions),
    fetchedKodeModelOptions: cloneRows(draft.fetchedKodeModelOptions),
    storedApiKeyFromServer: String(draft.storedApiKeyFromServer ?? ''),
    hasExistingApiKey: Boolean(draft.hasExistingApiKey),
    apiKeyTouched: Boolean(draft.apiKeyTouched),
    storedKodeApiKeyFromServer: String(draft.storedKodeApiKeyFromServer ?? ''),
    hasExistingKodeApiKey: Boolean(draft.hasExistingKodeApiKey),
    kodeApiKeyTouched: Boolean(draft.kodeApiKeyTouched),
  }
}

function applyTempProviderDraft(draft, fallbackName = NEW_PROVIDER_DEFAULT_NAME) {
  suppressCredentialChangeReset.value = true
  const next = normalizeTempProviderDraft(draft, fallbackName)
  configForm.value = { ...next.configForm }
  configSceneTab.value = next.configSceneTab
  dialogEnabled.value = next.dialogEnabled
  kodeEnabled.value = next.kodeEnabled
  syncPersistedEnablements(next.persistedDialogEnabled, next.persistedKodeEnabled)
  chatModels.value = cloneRows(next.chatModels)
  kodeModels.value = cloneRows(next.kodeModels)
  fetchedDialogModelOptions.value = cloneRows(next.fetchedDialogModelOptions)
  fetchedKodeModelOptions.value = cloneRows(next.fetchedKodeModelOptions)
  storedApiKeyFromServer.value = next.storedApiKeyFromServer
  hasExistingApiKey.value = next.hasExistingApiKey
  apiKeyTouched.value = next.apiKeyTouched
  storedKodeApiKeyFromServer.value = next.storedKodeApiKeyFromServer
  hasExistingKodeApiKey.value = next.hasExistingKodeApiKey
  kodeApiKeyTouched.value = next.kodeApiKeyTouched
  resetTestConnectionStatus()
  dialogModelsLoading.value = false
  kodeModelsLoading.value = false
  apiKeyPlainVisible.value = false
  nextTick(() => {
    suppressCredentialChangeReset.value = false
  })
}

function snapshotTempProviderDraft() {
  return {
    configForm: { ...configForm.value },
    configSceneTab: configSceneTab.value,
    dialogEnabled: dialogEnabled.value,
    kodeEnabled: kodeEnabled.value,
    persistedDialogEnabled: persistedDialogEnabled.value,
    persistedKodeEnabled: persistedKodeEnabled.value,
    chatModels: cloneRows(chatModels.value),
    kodeModels: cloneRows(kodeModels.value),
    fetchedDialogModelOptions: cloneRows(fetchedDialogModelOptions.value),
    fetchedKodeModelOptions: cloneRows(fetchedKodeModelOptions.value),
    storedApiKeyFromServer: storedApiKeyFromServer.value,
    hasExistingApiKey: hasExistingApiKey.value,
    apiKeyTouched: apiKeyTouched.value,
    storedKodeApiKeyFromServer: storedKodeApiKeyFromServer.value,
    hasExistingKodeApiKey: hasExistingKodeApiKey.value,
    kodeApiKeyTouched: kodeApiKeyTouched.value,
  }
}

function emitTempProviderDraft(providerId) {
  if (!isTempProviderId(providerId)) return
  if (suppressedTempDraftProviderIds.has(providerId)) return
  emit('update-temp-draft', {
    id: providerId,
    draft: snapshotTempProviderDraft(),
  })
}

function clearTempProviderDraft(providerId) {
  if (!isTempProviderId(providerId)) return
  suppressedTempDraftProviderIds.add(providerId)
  emit('update-temp-draft', { id: providerId, draft: null })
}

const loading = ref(true)
const saving = ref(false)
const providerTemplates = ref([])
/** 模板列表加载 Promise，避免与详情接口竞态且防止重复请求 */
let providerTemplatesLoadPromise = null
const fetchedDialogModelOptions = ref([])
const fetchedKodeModelOptions = ref([])
const dialogModelsLoading = ref(false)
const kodeModelsLoading = ref(false)
const suppressCredentialChangeReset = ref(false)

const currentModelsLoading = computed(() => {
  return configSceneTab.value === CONFIG_SCENE_TAB.KODE ? kodeModelsLoading.value : dialogModelsLoading.value
})

const serviceSelectRef = ref(null)
const serviceSelectOpen = ref(false)
const serviceSelectKeyword = ref('')

const filteredServiceTemplates = computed(() => {
  const kw = serviceSelectKeyword.value.trim().toLowerCase()
  if (!kw) return providerTemplates.value
  return providerTemplates.value.filter((tpl) =>
    String(tpl?.name ?? '').toLowerCase().includes(kw),
  )
})

const configForm = ref({
  serviceName: '',
  customName: '',
  apiKey: '',
  baseUrl: '',
  apiProtocol: '',
  kodeApiKey: '',
  kodeDefaultBaseUrl: '',
  kodeApiProtocol: 'anthropic_messages',
  templateId: null,
  isCustom: true,
})

/** 配置区 Tab：对话 / Kode，切换展示对应 API 参数与模型列表 */
const configSceneTab = ref(CONFIG_SCENE_TAB.DIALOG)

const dialogEnabled = ref(false)
const kodeEnabled = ref(false)
/** 已保存到服务端的启用状态，删除校验仅依据此字段 */
const persistedDialogEnabled = ref(false)
const persistedKodeEnabled = ref(false)
const chatModels = ref([])
const kodeModels = ref([])

const customNameInputRef = ref(null)

const testConnectionStatus = ref('idle')
const storedApiKeyFromServer = ref('')
const hasExistingApiKey = ref(false)
const apiKeyTouched = ref(false)
const storedKodeApiKeyFromServer = ref('')
const hasExistingKodeApiKey = ref(false)
const kodeApiKeyTouched = ref(false)

const currentProviderMeta = computed(() => {
  if (!props.providerId || props.providerId === 'kooky') return null
  return props.providers.find((p) => p.id === props.providerId) || null
})

const displayTitle = computed(() => {
  const trimmed = configForm.value.customName?.trim()
  if (trimmed) return trimmed
  if (configForm.value.serviceName === '自定义') return NEW_PROVIDER_DEFAULT_NAME
  return currentProviderMeta.value?.name || NEW_PROVIDER_DEFAULT_NAME
})

const deleteProviderDialogLabel = computed(() => {
  const name = displayTitle.value
  const trimmed = name != null ? String(name).trim() : ''
  return trimmed || '该服务商'
})

/** 头部头像：自定义固定默认图，预置用模板图，避免列表缓存导致切回自定义仍显示其它服务商 logo */
const providerHeaderLogo = computed(() => {
  if (configForm.value.serviceName === '自定义') {
    return defaultProviderIcon
  }
  const template = findTemplateByName(configForm.value.serviceName)
  if (template?.iconUrl) {
    return template.iconUrl
  }
  return currentProviderMeta.value?.logo || defaultProviderIcon
})

const providerFormSubtitle = computed(() => {
  const total = chatModels.value.length + kodeModels.value.length
  return `${total} 个可用模型`
})

const deleteDisabled = computed(() => (
  persistedDialogEnabled.value || persistedKodeEnabled.value
))

const activeKodeProviderName = computed(() => {
  const fromApi = props.allProviders.find((p) => Boolean(p.kodeEnabled ?? p.kode_enabled))
  if (fromApi) {
    return fromApi.name || fromApi.displayName || fromApi.display_name || ''
  }
  if (kodeEnabled.value) {
    return configForm.value.customName?.trim() || currentProviderMeta.value?.name || ''
  }
  return ''
})

/** 无已保存模型、或正在新增/编辑时不可切换启用状态 */
const dialogEnabledProviderCount = computed(() => (
  props.allProviders.filter((p) => {
    const isCurrent = String(p.id) === String(props.providerId)
    if (isCurrent) return dialogEnabled.value
    return Boolean(p.dialogEnabled ?? p.dialog_enabled)
  }).length
))

/** 全局仅一个对话启用且为当前服务商时，不允许禁用 */
const isLastDialogEnabledProvider = computed(() => (
  dialogEnabled.value && dialogEnabledProviderCount.value === 1
))

const dialogSwitchDisabled = computed(() => (
  chatModels.value.filter((m) => m.modelCode?.trim()).length === 0
  || isLastDialogEnabledProvider.value
))
const showDialogSwitch = computed(() => true)

const currentSceneEnabled = computed({
  get: () => configSceneTab.value === CONFIG_SCENE_TAB.DIALOG ? dialogEnabled.value : kodeEnabled.value,
  set: (val) => {
    if (configSceneTab.value === CONFIG_SCENE_TAB.DIALOG) {
      dialogEnabled.value = val
    } else {
      kodeEnabled.value = val
    }
  },
})
const currentSceneSwitchDisabled = computed(() => (
  configSceneTab.value === CONFIG_SCENE_TAB.DIALOG ? dialogSwitchDisabled.value : kodeSwitchDisabled.value
))

/** 列表里是否有其他服务商已启用 Kode */
const isOtherProviderKodeEnabled = computed(() => (
  props.allProviders.some((p) => {
    if (String(p.id) === String(props.providerId)) return false
    return Boolean(p.kodeEnabled ?? p.kode_enabled)
  })
))

/** 当前为全局唯一启用的 Kode 服务商时，禁止关闭（其他服务商仍可开启，由后端互斥） */
const isCurrentGlobalKodeEnabledProvider = computed(() => (
  kodeEnabled.value && !isOtherProviderKodeEnabled.value
))

const kodeSwitchDisabled = computed(() => (
  kodeModels.value.filter((m) => m.modelCode?.trim()).length === 0
  || isCurrentGlobalKodeEnabledProvider.value
))
const showKodeSwitch = computed(() => true)

function syncPersistedEnablements(dialog, kode) {
  persistedDialogEnabled.value = Boolean(dialog)
  persistedKodeEnabled.value = Boolean(kode)
}

function resetTestConnectionStatus() {
  testConnectionStatus.value = 'idle'
}

async function loadProviderTemplates() {
  try {
    const templates = await providerConfigApi.getProviderTemplates()
    providerTemplates.value = templates.map((tpl) => ({
      ...tpl,
      id: tpl.id,
      name: tpl.display_name || tpl.displayName || tpl.name || '',
      iconUrl: resolveProviderIcon(tpl.icon_url, tpl.iconUrl),
      defaultBaseUrl: tpl.default_base_url || tpl.defaultBaseUrl || '',
      apiProtocol: tpl.api_protocol || tpl.apiProtocol || '',
      kodeDefaultBaseUrl: tpl.kode_default_base_url || tpl.kodeDefaultBaseUrl || '',
      kodeApiProtocol: tpl.kode_api_protocol || tpl.kodeApiProtocol || 'anthropic_messages',
    }))
  } catch (error) {
    console.error('加载厂商模板失败:', error)
    providerTemplatesLoadPromise = null
  }
}

async function ensureProviderTemplatesLoaded() {
  if (providerTemplates.value.length > 0) return
  if (!providerTemplatesLoadPromise) {
    providerTemplatesLoadPromise = loadProviderTemplates()
  }
  await providerTemplatesLoadPromise
}

function findTemplateById(templateId) {
  if (templateId == null || templateId === '') return null
  const id = String(templateId)
  return providerTemplates.value.find((tpl) => String(tpl.id) === id) || null
}

function findTemplateByName(name) {
  const target = String(name ?? '').trim()
  if (!target || target === '自定义') return null
  return providerTemplates.value.find((tpl) => String(tpl?.name ?? '').trim() === target) || null
}

/** 服务商类型下拉：选项左侧图标 */
function getServiceOptionIcon(serviceName) {
  const name = String(serviceName ?? '').trim()
  if (!name || name === '自定义') return defaultProviderIcon
  const tpl = findTemplateByName(name)
  return getProviderLogoSrc(tpl?.iconUrl) || defaultProviderIcon
}

function getTemplateOptionIcon(tpl) {
  return getProviderLogoSrc(tpl?.iconUrl) || defaultProviderIcon
}

function toggleServiceSelect() {
  serviceSelectOpen.value = !serviceSelectOpen.value
  if (serviceSelectOpen.value) {
    void ensureProviderTemplatesLoaded()
  }
  if (!serviceSelectOpen.value) serviceSelectKeyword.value = ''
}

function selectServiceName(name) {
  serviceSelectOpen.value = false
  serviceSelectKeyword.value = ''
  if (configForm.value.serviceName !== name) {
    handleServiceNameChange(name)
  }
}

function handleServiceSelectClickOutside(event) {
  if (!serviceSelectOpen.value) return
  if (serviceSelectRef.value?.contains(event.target)) return
  serviceSelectOpen.value = false
  serviceSelectKeyword.value = ''
}

onMounted(() => {
  document.addEventListener('click', handleServiceSelectClickOutside)
  void ensureProviderTemplatesLoaded()
})

onBeforeUnmount(() => {
  emitTempProviderDraft(props.providerId)
  document.removeEventListener('click', handleServiceSelectClickOutside)
})

/** 切换服务商类型时清空下方配置（不含下拉选中值） */
function resetFormFieldsForTypeChange(serviceName) {
  configForm.value.customName = serviceName === '自定义' ? NEW_PROVIDER_DEFAULT_NAME : ''
  configForm.value.apiKey = ''
  storedApiKeyFromServer.value = ''
  hasExistingApiKey.value = false
  apiKeyTouched.value = false
  configForm.value.baseUrl = ''
  configForm.value.apiProtocol = ''
  configForm.value.kodeApiKey = ''
  storedKodeApiKeyFromServer.value = ''
  hasExistingKodeApiKey.value = false
  kodeApiKeyTouched.value = false
  configForm.value.kodeDefaultBaseUrl = ''
  configForm.value.kodeApiProtocol = 'anthropic_messages'
  configForm.value.templateId = null
  configForm.value.isCustom = serviceName === '自定义'
  configForm.value.serviceName = serviceName

  dialogEnabled.value = true
  kodeEnabled.value = true
  if (isTempProviderId(props.providerId)) {
    syncPersistedEnablements(false, false)
  }
  chatModels.value = [createEmptyModelRow('chat')]
  kodeModels.value = [createEmptyModelRow('kode')]
  fetchedDialogModelOptions.value = []
  fetchedKodeModelOptions.value = []
  resetTestConnectionStatus()

  if (isTempProviderId(props.providerId)) {
    emit('update-temp-name', {
      id: props.providerId,
      name: serviceName === '自定义' ? NEW_PROVIDER_DEFAULT_NAME : '',
      ...(serviceName === '自定义' ? { logo: defaultProviderIcon } : {}),
    })
  }
}

function applyTemplate(template) {
  if (!template) return
  configForm.value.customName = template.name || ''
  configForm.value.baseUrl = template.defaultBaseUrl || ''
  configForm.value.apiProtocol = template.apiProtocol || ''
  configForm.value.kodeDefaultBaseUrl = template.kodeDefaultBaseUrl || ''
  configForm.value.kodeApiProtocol = template.kodeApiProtocol || 'anthropic_messages'
  configForm.value.templateId = template.id ?? null
  configForm.value.isCustom = false
  if (isTempProviderId(props.providerId)) {
    emit('update-temp-name', { id: props.providerId, name: configForm.value.customName || template.name, logo: template.iconUrl })
  }
}

function handleServiceNameChange(value) {
  resetFormFieldsForTypeChange(value)
  if (value === '自定义') {
    nextTick(() => focusProviderNameInput())
    return
  }
  const template = findTemplateByName(value)
  if (template) applyTemplate(template)
}

function buildSavePayload() {
  const isCustom = configForm.value.serviceName === '自定义'
  const displayName = configForm.value.customName.trim()
  const dialogState = getDialogSaveState()
  const kodeState = getKodeSaveState()
  const validChatModels = dialogState.empty ? [] : dialogState.completeModels
  const validKodeModels = kodeState.empty ? [] : kodeState.completeModels

  const payload = {
    template_id: isCustom ? null : (configForm.value.templateId ?? findTemplateByName(configForm.value.serviceName)?.id ?? null),
    is_custom: isCustom,
    display_name: displayName,
    api_key: dialogState.empty ? '' : getEffectiveApiKey(),
    base_url: dialogState.empty ? '' : configForm.value.baseUrl.trim(),
    api_protocol: dialogState.empty ? '' : configForm.value.apiProtocol,
    kode_api_key: kodeState.empty ? '' : getEffectiveKodeApiKey(),
    kode_default_base_url: kodeState.empty ? '' : configForm.value.kodeDefaultBaseUrl.trim(),
    kode_api_protocol: kodeState.empty ? '' : (configForm.value.kodeApiProtocol || 'anthropic_messages'),
    dialog_enabled: dialogState.enabled,
    kode_enabled: kodeState.enabled,
    chat_models: validChatModels.map((m, idx) => ({
      ...(String(m.id).match(/^\d+$/) ? { id: Number(m.id) } : {}),
      model_name: m.displayName.trim(),
      model_code: m.modelCode.trim(),
      sort_order: idx + 1,
    })),
    kode_models: validKodeModels.map((m, idx) => ({
      ...(String(m.id).match(/^\d+$/) ? { id: Number(m.id) } : {}),
      model_name: m.displayName.trim(),
      model_code: m.modelCode.trim(),
      sort_order: idx + 1,
    })),
  }
  return payload
}

function validateBeforeSave() {
  if (!validateProviderDisplayName(configForm.value.customName)) return false
  const dialogState = getDialogSaveState()
  const kodeState = getKodeSaveState()
  if (!validateApiCredentialSetsBeforeSave(dialogState, kodeState)) return false

  if (!dialogState.empty && dialogState.enteredModels.length === 0) {
    ElMessage.warning('请至少配置一个对话模型')
    return false
  }
  if (!dialogState.empty && !validateChatModelsList(dialogState.enteredModels)) return false

  if (!dialogState.enabled && persistedDialogEnabled.value) {
    const otherDialogEnabledCount = props.allProviders.filter((p) => {
      if (String(p.id) === String(props.providerId)) return false
      return Boolean(p.dialogEnabled ?? p.dialog_enabled)
    }).length
    if (otherDialogEnabledCount === 0) {
      ElMessage.warning('对话场景至少需保留一个启用的服务商')
      return false
    }
  }
  if (!kodeState.empty && kodeState.enteredModels.length === 0) {
    ElMessage.warning('请至少配置一个 Kode 模型')
    return false
  }
  if (!kodeState.empty && !validateKodeModelsList(kodeState.enteredModels)) return false
  return true
}

async function loadProviderDetail(providerId) {
  if (!providerId || providerId === 'kooky') {
    loading.value = false
    return
  }

  if (isTempProviderId(providerId)) {
    loading.value = false
    applyTempProviderDraft(
      props.tempProviderDraft,
      currentProviderMeta.value?.name || NEW_PROVIDER_DEFAULT_NAME,
    )
    void ensureProviderTemplatesLoaded()
    return
  }

  loading.value = true
  try {
    await ensureProviderTemplatesLoaded()
    const detail = await providerConfigApi.getProviderDetailNew(providerId)
    if (String(props.providerId) !== String(providerId)) return

    const template = findTemplateById(detail.template_id ?? detail.templateId)
    const displayName = detail.display_name || detail.displayName || ''
    const isCustom = detail.is_custom ?? detail.isCustom ?? !template
    const rawApiKey = String(detail.api_key || detail.apiKey || '').trim()
    const rawKodeApiKey = String(detail.kode_api_key || detail.kodeApiKey || '').trim()

    storedApiKeyFromServer.value = rawApiKey
    hasExistingApiKey.value = Boolean(rawApiKey)
    apiKeyTouched.value = false
    storedKodeApiKeyFromServer.value = rawKodeApiKey
    hasExistingKodeApiKey.value = Boolean(rawKodeApiKey)
    kodeApiKeyTouched.value = false

    configForm.value = {
      serviceName: isCustom ? '自定义' : (template?.name || '自定义'),
      customName: displayName,
      apiKey: isMaskedApiKey(rawApiKey) ? '' : rawApiKey,
      baseUrl: detail.base_url || detail.baseUrl || '',
      apiProtocol: detail.api_protocol || detail.apiProtocol || '',
      kodeApiKey: isMaskedApiKey(rawKodeApiKey) ? '' : rawKodeApiKey,
      kodeDefaultBaseUrl: detail.kode_default_base_url || detail.kodeDefaultBaseUrl || '',
      kodeApiProtocol: detail.kode_api_protocol || detail.kodeApiProtocol || 'anthropic_messages',
      templateId: detail.template_id ?? detail.templateId ?? null,
      isCustom,
    }
    configSceneTab.value = CONFIG_SCENE_TAB.DIALOG
    dialogEnabled.value = detail.dialog_enabled ?? detail.dialogEnabled ?? false
    kodeEnabled.value = detail.kode_enabled ?? detail.kodeEnabled ?? false
    syncPersistedEnablements(dialogEnabled.value, kodeEnabled.value)
    chatModels.value = (detail.chat_models || detail.chatModels || []).map((m, idx) => mapModelRow(m, idx, 'chat'))
    kodeModels.value = (detail.kode_models || detail.kodeModels || []).map((m, idx) => mapModelRow(m, idx, 'kode'))
    if (configForm.value.apiKey || configForm.value.kodeApiKey) collapseApiKeyPasswordVisible()
  } catch (error) {
    handleApiError(error, '加载厂商详情失败')
  } finally {
    loading.value = false
  }
}

async function openDeleteProviderDialog(providerId) {
  const label = deleteProviderDialogLabel.value
  try {
    await ElMessageBox.confirm(
      '删除后，数据不可恢复。',
      `确认删除服务商「${label}」吗？`,
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
  } catch { return }
  if (!providerId || providerId === 'kooky') return
  try {
    await providerConfigApi.deleteProvider(providerId)
    ElMessage.success('删除成功')
    emit('refresh-providers', { deletedId: providerId, selectKooky: true })
  } catch (error) {
    handleApiError(error, '删除失败')
  }
}

const handleDeleteProvider = async () => {
  const providerId = props.providerId
  if (!providerId || providerId === 'kooky') return
  if (deleteDisabled.value) {
    ElMessage.warning('存在已启用模型，请先禁用后再删除服务商')
    return
  }
  if (isTempProviderId(providerId)) {
    clearTempProviderDraft(providerId)
    emit('refresh-providers', { deletedId: providerId, selectKooky: true })
    return
  }
  openDeleteProviderDialog(providerId)
}

const handleSave = async () => {
  if (!validateBeforeSave()) return
  const providerId = props.providerId
  if (!providerId) return

  saving.value = true
  try {
    const payload = buildSavePayload()
    const savedApiKey = getEffectiveApiKey()
    if (isTempProviderId(providerId)) {
      const result = await providerConfigApi.createProviderFull(payload)
      ElMessage.success('保存成功')
      dialogEnabled.value = payload.dialog_enabled
      kodeEnabled.value = payload.kode_enabled
      syncPersistedEnablements(payload.dialog_enabled, payload.kode_enabled)
      const respKey = String(result?.api_key ?? result?.apiKey ?? '').trim()
      const respKodeKey = String(result?.kode_api_key ?? result?.kodeApiKey ?? '').trim()
      if (savedApiKey) syncApiKeyStoredAfterSave(respKey || savedApiKey)
      if (getEffectiveKodeApiKey()) syncKodeApiKeyStoredAfterSave(respKodeKey || getEffectiveKodeApiKey())
      if (configForm.value.apiKey || configForm.value.kodeApiKey) collapseApiKeyPasswordVisible()
      clearTempProviderDraft(providerId)
      emit('refresh-providers', { deletedId: providerId, selectId: result.provider_id ?? result.providerId ?? result.id })
    } else {
      await providerConfigApi.updateProviderFull(providerId, payload)
      ElMessage.success('保存成功')
      dialogEnabled.value = payload.dialog_enabled
      kodeEnabled.value = payload.kode_enabled
      syncPersistedEnablements(payload.dialog_enabled, payload.kode_enabled)
      if (savedApiKey) syncApiKeyStoredAfterSave(savedApiKey)
      if (getEffectiveKodeApiKey()) syncKodeApiKeyStoredAfterSave(getEffectiveKodeApiKey())
      if (configForm.value.apiKey || configForm.value.kodeApiKey) collapseApiKeyPasswordVisible()
      emit('refresh-providers', { selectId: providerId })
    }
  } catch (error) {
    handleApiError(error, '保存失败')
  } finally {
    saving.value = false
  }
}

const handleFetchModels = async () => {
  const isKodeTab = configSceneTab.value === CONFIG_SCENE_TAB.KODE
  const fetchBaseUrl = validateBaseUrl(
    isKodeTab ? configForm.value.kodeDefaultBaseUrl : configForm.value.baseUrl,
  )
  if (!fetchBaseUrl) return
  const fetchKey = isKodeTab ? getEffectiveKodeApiKey() : getEffectiveApiKey()
  if (!fetchKey) {
    ElMessage.warning('请先填写 API Key')
    return
  }
  if (isMaskedApiKey(fetchKey)) {
    ElMessage.warning('请重新输入 API Key 后再获取模型')
    return
  }
  const apiProtocol = isKodeTab
    ? (configForm.value.kodeApiProtocol || 'anthropic_messages')
    : configForm.value.apiProtocol
  if (!apiProtocol) {
    ElMessage.warning('请先选择 API 协议')
    return
  }

  if (isKodeTab) {
    kodeModelsLoading.value = true
  } else {
    dialogModelsLoading.value = true
  }

  try {
    const res = await providerConfigApi.fetchModels({
      api_key: fetchKey,
      base_url: fetchBaseUrl,
      api_protocol: apiProtocol,
    })
    const models = res?.models ?? []
    const options = models.map((m) => ({
      label: m.model_name || m.modelName || m.model_code || m.modelCode,
      value: m.model_code || m.modelCode || m.model_name || m.modelName,
    }))

    if (isKodeTab) {
      fetchedKodeModelOptions.value = options
    } else {
      fetchedDialogModelOptions.value = options
    }

    ElMessage.success(`已获取${models.length}个模型`)
  } catch (error) {
    ElMessage.error('获取失败')
    console.error('查询模型失败:', error)
  } finally {
    if (isKodeTab) {
      kodeModelsLoading.value = false
    } else {
      dialogModelsLoading.value = false
    }
  }
}

function startAddChatModel() {
  chatModels.value.push(createEmptyModelRow('chat'))
  if (!dialogEnabled.value) dialogEnabled.value = true
}

function startAddKodeModel() {
  const available = getAvailableKodeAliasOptions()
  if (!available.length) {
    ElMessage.warning('所有显示名称已被使用')
    return
  }
  kodeModels.value.push(createEmptyModelRow('kode'))
  if (!kodeEnabled.value) kodeEnabled.value = true
}

function handleChatModelCodeChange(model, newValue) {
  const oldCode = model.modelCode
  model.modelCode = sanitizeChatModelIdInput(newValue)
  if (!model.displayName || model.displayName === oldCode) {
    model.displayName = model.modelCode
  }
}

function handleKodeModelCodeChange(model, newValue) {
  model.modelCode = sanitizeKodeModelIdInput(newValue)
}

function removeChatModel(id) {
  chatModels.value = chatModels.value.filter((m) => m.id !== id)
  if (chatModels.value.length === 0) dialogEnabled.value = false
}

function removeKodeModel(id) {
  kodeModels.value = kodeModels.value.filter((m) => m.id !== id)
  if (kodeModels.value.length === 0) kodeEnabled.value = false
}

async function testSingleModelHealth(model) {
  if (!model.modelCode?.trim()) {
    ElMessage.warning('请先填写模型 ID')
    return
  }
  model.healthStatus = 'loading'
  const isKode = configSceneTab.value === CONFIG_SCENE_TAB.KODE
  const testPayload = {
    api_key: isKode ? getEffectiveKodeApiKey() : getEffectiveApiKey(),
    base_url: isKode ? configForm.value.kodeDefaultBaseUrl : configForm.value.baseUrl,
    api_protocol: isKode ? configForm.value.kodeApiProtocol : configForm.value.apiProtocol,
    model_code: model.modelCode.trim(),
  }
  try {
    if (isKode) {
      await providerConfigApi.testModelHealthLocal(testPayload)
    } else {
      await providerConfigApi.testModelHealth(testPayload)
    }
    model.healthStatus = 'success'
  } catch {
    model.healthStatus = 'error'
  }
}

async function handleBatchTest() {
  const models = configSceneTab.value === CONFIG_SCENE_TAB.DIALOG ? chatModels.value : kodeModels.value
  const validModels = models.filter((m) => m.modelCode?.trim())
  if (!validModels.length) {
    ElMessage.warning('暂无可测试的模型')
    return
  }
  await Promise.all(validModels.map((m) => testSingleModelHealth(m)))
}

watch(
  () => [
    configForm.value.apiKey,
    configForm.value.baseUrl,
    configForm.value.apiProtocol,
    configForm.value.kodeApiKey,
    configForm.value.kodeDefaultBaseUrl,
    configForm.value.kodeApiProtocol,
  ],
  () => {
    if (suppressCredentialChangeReset.value) return
    resetTestConnectionStatus()
    dialogModelsLoading.value = false
    kodeModelsLoading.value = false
    fetchedDialogModelOptions.value = []
    fetchedKodeModelOptions.value = []
  }
)

watch(
  () => configForm.value.customName,
  (name) => {
    if (!isTempProviderId(props.providerId)) return
    emit('update-temp-name', { id: props.providerId, name: name || '' })
  }
)

watch(
  () => props.providerId,
  (id, previousId) => {
    emitTempProviderDraft(previousId)
    apiKeyPlainVisible.value = false
    configSceneTab.value = CONFIG_SCENE_TAB.DIALOG
    serviceSelectOpen.value = false
    serviceSelectKeyword.value = ''
    resetTestConnectionStatus()
    dialogModelsLoading.value = false
    kodeModelsLoading.value = false
    fetchedDialogModelOptions.value = []
    fetchedKodeModelOptions.value = []
    if (!id || id === 'kooky') {
      loading.value = false
      return
    }
    loading.value = !isTempProviderId(id)
    loadProviderDetail(id)
  },
  { immediate: true }
)

async function focusProviderNameInput() {
  await nextTick()
  customNameInputRef.value?.focus?.()
}

async function applyDefaultTemplateForCreate() {
  await ensureProviderTemplatesLoaded()
  const deepseek = providerTemplates.value.find(
    (tpl) => String(tpl.name ?? '').toLowerCase().includes('deepseek'),
  )
  if (deepseek) {
    configForm.value.serviceName = deepseek.name
    applyTemplate(deepseek)
  }
}

defineExpose({
  resetFormForCreate: () => {
    loading.value = false
    applyTempProviderDraft(null, NEW_PROVIDER_DEFAULT_NAME)
    applyDefaultTemplateForCreate().then(() => {
      if (isTempProviderId(props.providerId)) {
        emitTempProviderDraft(props.providerId)
        emit('update-temp-name', {
          id: props.providerId,
          name: configForm.value.customName || NEW_PROVIDER_DEFAULT_NAME,
          logo: providerHeaderLogo.value,
        })
      }
    })
  },
  focusProviderNameInput,
  deleteProvider: handleDeleteProvider,
})
</script>

<template>
  <div class="stpp-root">
    <Loading :visible="loading" text="加载中..." :overlay="true" />

    <div class="stpp-scroll">
      <div class="stpp-provider-header">
        <div class="stpp-provider-header__left">
          <div class="stpp-provider-avatar">
            <img
              v-if="getProviderLogoSrc(providerHeaderLogo)"
              :src="getProviderLogoSrc(providerHeaderLogo)"
              alt="logo"
            />
            <span v-else class="stpp-provider-avatar__fallback">🤖</span>
          </div>
          <div>
            <h3 class="stpp-provider-title">{{ displayTitle }}</h3>
            <p class="stpp-provider-desc">{{ providerFormSubtitle }} · API 接入</p>
            <!-- <p class="stpp-provider-desc">{{ providerFormSubtitle }}</p> -->
          </div>
        </div>
        <!-- <el-tooltip v-if="deleteDisabled" content="存在已启用的模型，请先保存禁用后再删除" placement="top">
          <el-button class="stpp-delete-btn is-disabled" text circle disabled>
            <el-icon :size="14"><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <el-button v-else class="stpp-delete-btn" text circle @click="handleDeleteProvider">
          <el-icon :size="14" color="#91949E"><Delete /></el-icon>
        </el-button> -->
      </div>

      <el-form label-position="top" class="stpp-form">
        <el-form-item
          label="服务商名称"
          required
          require-asterisk-position="right"
          class="stpp-form-item--required-mark-right"
        >
          <div class="stpp-name-row">
            <div ref="serviceSelectRef" class="stpp-service-select stpp-name-select">
              <div
                class="stpp-service-select__trigger"
                :class="{ 'is-open': serviceSelectOpen }"
                @click.stop="toggleServiceSelect"
              >
                <span class="stpp-service-icon-box">
                  <img :src="getServiceOptionIcon(configForm.serviceName)" alt="" />
                </span>
                <span
                  class="stpp-service-select__text"
                  :class="{ 'is-placeholder': !configForm.serviceName }"
                >
                  {{ configForm.serviceName || '请选择' }}
                </span>
                <el-icon class="stpp-service-select__arrow" :class="{ 'is-open': serviceSelectOpen }">
                  <ArrowDown />
                </el-icon>
              </div>
              <div v-show="serviceSelectOpen" class="stpp-service-select__flyout">
                <!-- <div class="stpp-service-select__search">
                  <el-input
                    v-model="serviceSelectKeyword"
                    placeholder="搜索"
                    clearable
                    size="small"
                    @click.stop
                  />
                </div> -->
                <div class="stpp-service-select__dropdown">
                  <div class="stpp-service-select__list">
                    <div
                      v-for="tpl in filteredServiceTemplates"
                      :key="`tpl-${tpl.id}`"
                      class="stpp-service-select__option"
                      :class="{ 'is-active': configForm.serviceName === tpl.name }"
                      @click="selectServiceName(tpl.name)"
                    >
                      <span class="stpp-service-icon-box">
                        <img :src="getTemplateOptionIcon(tpl)" alt="" />
                      </span>
                      <span class="stpp-service-select__option-name">{{ tpl.name }}</span>
                    </div>
                    <div
                      class="stpp-service-select__option"
                      :class="{ 'is-active': configForm.serviceName === '自定义' }"
                      @click="selectServiceName('自定义')"
                    >
                      <span class="stpp-service-icon-box">
                        <img :src="defaultProviderIcon" alt="" />
                      </span>
                      <span class="stpp-service-select__option-name">自定义</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <el-input
              ref="customNameInputRef"
              :model-value="configForm.customName"
              placeholder="请输入"
              class="stpp-name-input"
              maxlength="50"
              @input="handleDisplayNameInput"
            />
          </div>
        </el-form-item>

        <div class="stpp-scene-tabs-row">
          <div class="stpp-scene-tabs" role="tablist" aria-label="配置类型">
            <button
              type="button"
              class="stpp-scene-tab"
              :class="{ 'is-active': configSceneTab === CONFIG_SCENE_TAB.DIALOG }"
              role="tab"
              :aria-selected="configSceneTab === CONFIG_SCENE_TAB.DIALOG"
              @click="switchConfigSceneTab(CONFIG_SCENE_TAB.DIALOG)"
            >
              对话
            </button>
            <button
              type="button"
              class="stpp-scene-tab"
              :class="{ 'is-active': configSceneTab === CONFIG_SCENE_TAB.KODE }"
              role="tab"
              :aria-selected="configSceneTab === CONFIG_SCENE_TAB.KODE"
              @click="switchConfigSceneTab(CONFIG_SCENE_TAB.KODE)"
            >
              Kode
            </button>
          </div>
          <div class="stpp-scene-tabs__right">
            <span class="stpp-switch-status">
              {{ currentSceneEnabled ? '已启用' : '未启用' }}
            </span>
            <el-switch
              v-model="currentSceneEnabled"
              size="small"
              :disabled="currentSceneSwitchDisabled"
            />
          </div>
        </div>

        <template v-if="configSceneTab === CONFIG_SCENE_TAB.DIALOG">
          <el-form-item
            label="API Key"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-input
              :model-value="configForm.apiKey"
              :type="apiKeyPlainVisible ? 'text' : 'password'"
              placeholder="请输入"
              maxlength="2048"
              autocomplete="new-password"
              class="stpp-api-key-input"
              @input="handleApiKeyInput"
            >
              <template #suffix>
                <span
                  class="stpp-api-key-eye"
                  role="button"
                  tabindex="0"
                  @click.stop="apiKeyPlainVisible = !apiKeyPlainVisible"
                  @keydown.enter.prevent="apiKeyPlainVisible = !apiKeyPlainVisible"
                >
                  <SvgIcon
                    v-if="apiKeyPlainVisible"
                    name="icon-zhengkaiyanjing"
                    :size="16"
                    color="currentColor"
                  />
                  <SvgIcon
                    v-else
                    name="icon-biyan"
                    :size="16"
                    color="currentColor"
                  />
                </span>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            v-if="configForm.isCustom"
            label="Base URL"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-input
              :model-value="configForm.baseUrl"
              placeholder="请输入"
              maxlength="500"
              @input="handleBaseUrlInput"
            />
          </el-form-item>

          <el-form-item
            v-if="configForm.isCustom"
            label="API 协议"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-select
              v-model="configForm.apiProtocol"
              placeholder="请选择"
              style="width: 100%"
              fit-input-width
              popper-class="stpp-select-popper"
            >
              <el-option
                v-for="opt in API_PROTOCOL_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item
            label="API Key"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-input
              :model-value="configForm.kodeApiKey"
              :type="apiKeyPlainVisible ? 'text' : 'password'"
              placeholder="请输入"
              maxlength="2048"
              autocomplete="new-password"
              class="stpp-api-key-input"
              @input="handleKodeApiKeyInput"
            >
              <template #suffix>
                <span
                  class="stpp-api-key-eye"
                  role="button"
                  tabindex="0"
                  @click.stop="apiKeyPlainVisible = !apiKeyPlainVisible"
                  @keydown.enter.prevent="apiKeyPlainVisible = !apiKeyPlainVisible"
                >
                  <SvgIcon
                    v-if="apiKeyPlainVisible"
                    name="icon-zhengkaiyanjing"
                    :size="16"
                    color="currentColor"
                  />
                  <SvgIcon
                    v-else
                    name="icon-biyan"
                    :size="16"
                    color="currentColor"
                  />
                </span>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            v-if="configForm.isCustom"
            label="Base URL"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-input
              :model-value="configForm.kodeDefaultBaseUrl"
              placeholder="请输入"
              maxlength="500"
              @input="handleKodeBaseUrlInput"
            />
          </el-form-item>

          <el-form-item
            v-if="configForm.isCustom"
            label="API 协议"
            required
            require-asterisk-position="right"
            class="stpp-form-item--required-mark-right"
          >
            <el-select
              v-model="configForm.kodeApiProtocol"
              placeholder="请选择"
              style="width: 100%"
              fit-input-width
              popper-class="stpp-select-popper"
            >
              <el-option
                v-for="opt in KODE_API_PROTOCOL_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </template>

        <div class="stpp-model-section">
          <div class="stpp-model-section__header">
            <div class="stpp-model-section__header-left">
              <div class="stpp-model-section__title">模型列表</div>
              <div class="stpp-model-section__desc">配置该供应商可用的模型，启用后可使用</div>
            </div>
            <div class="stpp-model-section__setting">
              <button
                
                type="button"
                class="stpp-fetch-btn"
                @click="handleFetchModels"
              >
                <SvgIcon v-if="!currentModelsLoading" name="icon-congAPIhuoqu" :size="14" color="#606572" />
                <img v-else :src="apiLoadingIcon" alt="" class="stpp-fetch-btn__loading-icon is-rotating" />
                <span class="stpp-fetch-btn__text">获取模型列表</span>
              </button>
              <!-- <button
                v-else
                type="button"
                class="stpp-fetch-btn stpp-fetch-btn--loading"
                disabled
              >
                
                <span>获取中</span>
              </button> -->
              <button
                type="button"
                class="stpp-fetch-btn stpp-batch-test-btn"
                @click="handleBatchTest"
              >
                <img :src="batchTest" alt="" class="stpp-batch-test-btn__icon" />
                <span class="stpp-fetch-btn__text">批量测试</span>
              </button>
            </div>
          </div>

          <!-- 对话 -->
          <div v-if="configSceneTab === CONFIG_SCENE_TAB.DIALOG" class="stpp-scene-block">
            <div class="stpp-model-table-header">
              <span class="stpp-model-table-header__col">模型ID</span>
              <span class="stpp-model-table-header__col" style="padding-left: 0px;">显示名称</span>
              <span class="stpp-model-table-header__col stpp-model-table-header__col--actions"></span>
            </div>

            <div v-if="chatModels.length === 0" class="stpp-model-empty">暂无模型</div>

            <div
              v-for="model in chatModels"
              :key="model.id"
              class="stpp-model-row stpp-model-row--editable"
            >
              <div class="stpp-model-input-wrap" :class="{ 'is-loading': currentModelsLoading }">
                <el-select
                  v-if="fetchedDialogModelOptions.length"
                  :model-value="model.modelCode"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="模型ID（例如 gpt-4）"
                  class="stpp-model-input"
                  fit-input-width
                  popper-class="stpp-select-popper"
                  @update:model-value="(v) => handleChatModelCodeChange(model, v)"
                >
                  <el-option v-for="opt in fetchedDialogModelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-input
                  v-else
                  :model-value="model.modelCode"
                  placeholder="模型ID（例如 gpt-4）"
                  class="stpp-model-input"
                  maxlength="200"
                  @input="(v) => handleChatModelCodeChange(model, v)"
                />
                <img v-if="currentModelsLoading" :src="apiLoadingIcon" alt="" class="stpp-input-loading-suffix is-rotating" />
              </div>
              <el-input
                :model-value="model.displayName"
                placeholder="显示名称"
                class="stpp-model-input"
                maxlength="200"
                @input="(v) => { model.displayName = sanitizeChatModelDisplayNameInput(v) }"
              />
              <div class="stpp-row-actions">
                <span
                  v-if="model.healthStatus === 'loading'"
                  class="stpp-health-status is-loading"
                >
                  <img :src="apiLoadingIcon" alt="" class="stpp-health-icon is-rotating" />
                </span>
                <span
                  v-else-if="model.healthStatus === 'success'"
                  class="stpp-health-status is-success"
                >
                  <SvgIcon name="icon-liucheng-chenggong-default" :size="14" color="currentColor" />
                  <span>正常</span>
                </span>
                <span
                  v-else-if="model.healthStatus === 'error'"
                  class="stpp-health-status is-error"
                >
                  <SvgIcon name="icon-liucheng-shibai-default" :size="14" color="currentColor" />
                  <span>异常</span>
                </span>
                <el-button text class="stpp-icon-btn" @click="testSingleModelHealth(model)">
                  <img :src="testLinkIcon" alt="测试" class="stpp-test-model-icon" />
                </el-button>
                <el-button text class="stpp-icon-btn stpp-icon-btn--danger" @click="removeChatModel(model.id)">
                  <svgIcon name="icon-shanchu2" :size="16" />
                </el-button>
              </div>
            </div>

            <div class="stpp-model-add-row" @click="startAddChatModel">
              <svgIcon name="icon-tianjia" style="font-size: 14px;margin-right: 4px;" />
              新增
            </div>
          </div>

          <!-- Kode -->
          <div v-if="configSceneTab === CONFIG_SCENE_TAB.KODE" class="stpp-scene-block">
            <div class="stpp-model-table-header">
              <span class="stpp-model-table-header__col">模型ID</span>
              <span class="stpp-model-table-header__col" style="padding-left: 0px;">显示名称</span>
              <span class="stpp-model-table-header__col stpp-model-table-header__col--actions"></span>
            </div>

            <div v-if="kodeModels.length === 0" class="stpp-model-empty">暂无模型</div>

            <div
              v-for="model in kodeModels"
              :key="model.id"
              class="stpp-model-row stpp-model-row--editable"
            >
              <div class="stpp-model-input-wrap" :class="{ 'is-loading': currentModelsLoading }">
                <el-select
                  v-if="fetchedKodeModelOptions.length"
                  :model-value="model.modelCode"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="模型ID"
                  class="stpp-model-input"
                  fit-input-width
                  popper-class="stpp-select-popper"
                  @update:model-value="(v) => handleKodeModelCodeChange(model, v)"
                >
                  <el-option v-for="opt in fetchedKodeModelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-input
                  v-else
                  :model-value="model.modelCode"
                  placeholder="模型ID"
                  class="stpp-model-input"
                  maxlength="200"
                  @input="(v) => handleKodeModelCodeChange(model, v)"
                />
                <img v-if="currentModelsLoading" :src="apiLoadingIcon" alt="" class="stpp-input-loading-suffix is-rotating" />
              </div>
              <el-select
                v-model="model.displayName"
                placeholder="显示名称"
                class="stpp-model-input"
                fit-input-width
                popper-class="stpp-select-popper"
              >
                <el-option
                  v-for="alias in getAvailableKodeAliasOptions(model.id)"
                  :key="alias"
                  :label="alias"
                  :value="alias"
                />
              </el-select>
              <div class="stpp-row-actions">
                <span
                  v-if="model.healthStatus === 'loading'"
                  class="stpp-health-status is-loading"
                >
                  <img :src="apiLoadingIcon" alt="" class="stpp-health-icon is-rotating" />
                </span>
                <span
                  v-else-if="model.healthStatus === 'success'"
                  class="stpp-health-status is-success"
                >
                  <SvgIcon name="icon-liucheng-chenggong-default" :size="14" color="currentColor" />
                  <span>正常</span>
                </span>
                <span
                  v-else-if="model.healthStatus === 'error'"
                  class="stpp-health-status is-error"
                >
                  <SvgIcon name="icon-liucheng-shibai-default" :size="14" color="currentColor" />
                  <span>异常</span>
                </span>
                <el-button text class="stpp-icon-btn" @click="testSingleModelHealth(model)">
                  <img :src="testLinkIcon" alt="测试" class="stpp-test-model-icon" />
                </el-button>
                <el-button text class="stpp-icon-btn stpp-icon-btn--danger" @click="removeKodeModel(model.id)">
                  <svgIcon name="icon-shanchu2" :size="16" />
                </el-button>
              </div>
            </div>

            <div class="stpp-model-add-row" @click="startAddKodeModel">
              <svgIcon name="icon-tianjia" style="font-size: 14px;margin-right: 4px;" />
              新增
            </div>
          </div>
        </div>
      </el-form>
    </div>

    <div class="stpp-footer">
      <div></div>
      <el-button class="stpp-save-btn" type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </div>

  </div>
</template>

<style lang="scss" scoped src="./settingsThirdPartyPanel.scss"></style>

<style lang="scss" scoped>
/* Element Plus 穿透：必须写在 SFC scoped 块内，@import 外链 scss 时 :deep 可能不生效 */
.stpp-form {
  --el-input-focus-border-color: #ff621f;
  --el-input-hover-border-color: #ff621f;
  --el-select-focus-border-color: #ff621f;
  --el-select-hover-border-color: #ff621f;

  :deep(.el-form-item) {
    margin-bottom: 24px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 4px;
    font-size: 14px;
    font-weight: 500;
    color: #2f3547;
    line-height: 22px;
    font-family: PingFang SC;
    color: #2F3547;
  }

  :deep(.el-select__wrapper) {
    border-radius: 8px;
    height: 36px;
    box-shadow: 0 0 0 1px #ebebeb inset;
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }

    &.is-focused,
    &.is-focus,
    &.is-hovering {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }
  }

  :deep(.stpp-form-item--required-mark-right.is-required:not(.is-no-asterisk).asterisk-right) {
    > .el-form-item__label::after,
    > .el-form-item__label-wrap > .el-form-item__label::after {
      color: #ff5233 !important;
      margin-left: 4px;
    }
  }

  :deep(.stpp-form-item--required-mark-right.is-required:not(.is-no-asterisk).asterisk-left) {
    > .el-form-item__label::before,
    > .el-form-item__label-wrap > .el-form-item__label::before {
      content: none !important;
      margin-right: 0 !important;
    }

    > .el-form-item__label::after,
    > .el-form-item__label-wrap > .el-form-item__label::after {
      content: '*' !important;
      color: #ff5233 !important;
      margin-left: 4px;
    }
  }

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    min-height: 36px;
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }
  }

  :deep(.el-input__wrapper input),
  :deep(.el-input__wrapper textarea) {
    caret-color: #ff621f;
  }

  :deep(.el-input__wrapper input::placeholder),
  :deep(.el-input__wrapper textarea::placeholder) {
    color: #c2c3c9;
  }

  :deep(.el-input__wrapper input::-webkit-input-placeholder),
  :deep(.el-input__wrapper textarea::-webkit-input-placeholder) {
    color: #c2c3c9;
  }

  :deep(.el-select__placeholder.is-transparent) {
    color: #c2c3c9 !important;
  }
  :deep(.el-select__selected-item) {
    color: #2f3547;
  }

  :deep(.el-select .el-input__wrapper) {
    border-radius: 8px;
    min-height: 36px;

    &:hover {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }
  }
}

.stpp-scene-tabs__right {
  :deep(.el-switch) {
    flex-shrink: 0;
  }
  :deep(.el-switch.is-checked .el-switch__core) {
    background-color: #C2C3C9 !important;
    border-color: #C2C3C9 !important;
  }
  :deep(.el-switch.is-disabled .el-switch__core) {
    background-color: #91949E !important;
    border-color: #91949E !important;
    opacity: 1 !important;
  }
}
.stpp-scene-tabs-row {
  display: flex;
}
.stpp-model-section__setting {
  right: 0px;
  display: flex;
  flex-direction: row;
  position: absolute;
  top: -5px;
}
.stpp-switch-status {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 22px;
  color: #91949E;
  white-space: nowrap;
}

.stpp-service-select__search {
  :deep(.el-input__wrapper) {
    width: 166px;
    border-radius: 6px;
    box-sizing: border-box;

    &:hover {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #ff621f inset !important;
    }
  }

  :deep(.el-input__wrapper input) {
    caret-color: #ff621f;
  }
}

.stpp-api-key-eye {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #c0c4cc;
  outline: none;

  &:hover {
    color: #909399;
  }

  :deep(svg) {
    display: block;
  }
}

.stpp-footer {
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.is-rotating {
  display: block;
  transform-origin: center;
  animation: stpp-spin 1s linear infinite;
}

@keyframes stpp-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
/* el-select 下拉 Teleport 到 body，需非 scoped */
.stpp-select-popper.el-popper {
  overflow: hidden;
  box-sizing: border-box;
}

.stpp-select-popper .el-select-dropdown {
  width: 100%;
  box-sizing: border-box;
}

.stpp-select-popper .el-select-dropdown__wrap,
.stpp-select-popper .el-scrollbar,
.stpp-select-popper .el-select-dropdown__list {
  max-width: 100%;
}

.stpp-select-popper .el-select-dropdown__list {
  padding: 4px 6px;
  box-sizing: border-box;
}

.stpp-select-popper .el-select-dropdown__item {
  box-sizing: border-box;
  max-width: 100%;
  margin: 0;
  padding-left: 10px;
  padding-right: 10px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stpp-select-popper .el-select-dropdown__item.is-hovering,
.stpp-select-popper .el-select-dropdown__item:hover {
  background-color: #f5f7fa;
}

.stpp-select-popper .el-select-dropdown__item.is-selected {
  border-radius: 6px;
}
</style>
