<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as providerConfigApi from '@/shared/services/providerConfigApi'
import aboutMenuIcon from '@/assets/settings/about_icon.svg'
import modelUseIcon from '@/assets/settings/model_use.svg'
import defaultProviderIcon from '@/assets/settings/default_icon.svg'
import SettingsProviderList from './settings/SettingsProviderList.vue'
import SettingsKookyPanel from './settings/SettingsKookyPanel.vue'
import SettingsThirdPartyPanel from './settings/SettingsThirdPartyPanel.vue'
import { emitProviderConfigChanged } from '@/shared/utils/providerConfigEvents'
import { refreshClaudeCodeSettings } from '@/modules/terminal/claudeKeyService'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialMenu: { type: String, default: 'model-usage' },
})
const emit = defineEmits(['update:modelValue'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const menuItems = [
  { id: 'model-usage', label: '模型与用量', icon: modelUseIcon },
  { id: 'about-kooky', label: '关于Kooky', icon: aboutMenuIcon },
]

const activeMenu = ref('model-usage')
const kookyProvider = ref({ name: 'Kooky', modelCount: 0, chatModelCount: 0, kodeModelCount: 0 })
const providersScroll = ref([])
const allProvidersList = ref([])
const activeProvider = ref('kooky')
const thirdPartyPanelRef = ref(null)
const tempProviderDrafts = ref({})

const TEMP_PROVIDER_PREFIX = 'temp-provider-'
/** 新建服务商时列表默认名称（PRD） */
const NEW_PROVIDER_DEFAULT_NAME = 'New Provider'

function createTempProviderId(channel) {
  return `${TEMP_PROVIDER_PREFIX}${channel}-${Date.now()}`
}

function isTempProviderId(providerId) {
  return typeof providerId === 'string' && providerId.startsWith(TEMP_PROVIDER_PREFIX)
}

function patchTempProviderDraft(providerId, draft) {
  if (!isTempProviderId(providerId)) return
  const next = { ...tempProviderDrafts.value }
  if (draft) next[providerId] = draft
  else delete next[providerId]
  tempProviderDrafts.value = next
}

function resolveProviderIcon(...icons) {
  return icons.find((icon) => String(icon ?? '').trim()) || defaultProviderIcon
}

function normalizeProviderMeta(provider, fallbackId = null) {
  if (!provider) {
    return {
      id: fallbackId,
      name: '',
      logo: defaultProviderIcon,
      modelCount: 0,
      chatModelCount: 0,
      kodeModelCount: 0,
      dialogEnabled: false,
      kodeEnabled: false,
    }
  }
  const chatCount = provider.chat_model_count ?? provider.chatModelCount ?? provider.models?.length ?? 0
  const kodeCount = provider.kode_model_count ?? provider.kodeModelCount ?? 0
  const isBuiltin = provider.is_builtin ?? provider.isBuiltin
  const rawId = provider.id ?? fallbackId
  return {
    ...provider,
    id: isBuiltin || rawId === 0 || rawId === 'kooky' ? 'kooky' : rawId,
    name: provider.display_name || provider.displayName || provider.name || '',
    logo: resolveProviderIcon(provider.icon_url, provider.iconUrl, provider.logo, provider.icon),
    modelCount: chatCount + kodeCount,
    chatModelCount: chatCount,
    kodeModelCount: kodeCount,
    dialogEnabled: provider.dialog_enabled ?? provider.dialogEnabled ?? false,
    kodeEnabled: provider.kode_enabled ?? provider.kodeEnabled ?? false,
  }
}

function isKookyProviderItem(provider) {
  if (!provider) return false
  if (provider.is_builtin ?? provider.isBuiltin) return isKookyBuiltinProvider(provider)
  if (provider.id === 0 || provider.id === 'kooky') return true
  const code = String(provider.provider_code ?? provider.providerCode ?? '').toLowerCase()
  return code === 'kooky'
}

function normalizeModels(models = []) {
  if (!Array.isArray(models)) return []
  return models.map((m, idx) => ({
    ...m,
    id: m.id ?? `model-${idx}`,
    modelName: m.model_name || m.modelName || '',
    modelCode: m.model_code || m.modelCode || '',
  }))
}

function isKookyBuiltinProvider(provider) {
  if (!provider?.isBuiltin && !provider?.is_builtin) return false
  const fields = [
    provider.templateCode, provider.template_code, provider.providerCode,
    provider.code, provider.templateName, provider.name,
    provider.displayName, provider.display_name,
  ]
  return fields.map((x) => String(x ?? '').toLowerCase()).join(' ').includes('kooky')
}

function extractModelCountsFromDetail(detail) {
  if (!detail) return { chat: 0, kode: 0, total: 0 }
  const ocModels = detail?.channels?.['kc-oc']?.models
  const ccModels = detail?.channels?.['kc-cc']?.models
  const chatFromChannels = Array.isArray(ocModels) ? ocModels.length : 0
  const kodeFromChannels = Array.isArray(ccModels) ? ccModels.length : 0
  const chatFromFlat = (detail?.chat_models || detail?.chatModels || []).length
  const kodeFromFlat = (detail?.kode_models || detail?.kodeModels || []).length
  const chat = Math.max(chatFromChannels, chatFromFlat, detail?.chat_model_count ?? detail?.chatModelCount ?? 0)
  const kode = Math.max(kodeFromChannels, kodeFromFlat, detail?.kode_model_count ?? detail?.kodeModelCount ?? 0)
  return { chat, kode, total: chat + kode }
}

function patchKookyProviderCounts(counts) {
  kookyProvider.value = {
    ...kookyProvider.value,
    modelCount: counts.total,
    chatModelCount: counts.chat,
    kodeModelCount: counts.kode,
  }
  const idx = allProvidersList.value.findIndex((p) => p.id === 'kooky')
  if (idx >= 0) {
    allProvidersList.value[idx] = { ...kookyProvider.value }
  }
}

async function syncKookyProviderModelCount() {
  try {
    const detail = await providerConfigApi.getProviderDetail('kooky', 'all')
    patchKookyProviderCounts(extractModelCountsFromDetail(detail))
  } catch (error) {
    console.error('同步 Kooky 模型数量失败:', error)
  }
}

function handleKookyModelCountUpdate(counts) {
  patchKookyProviderCounts({
    chat: counts.chatModelCount ?? 0,
    kode: counts.kodeModelCount ?? 0,
    total: counts.modelCount ?? 0,
  })
}

async function handleKookyEnablementUpdate({ dialogEnabled, kodeEnabled }) {
  kookyProvider.value = {
    ...kookyProvider.value,
    dialogEnabled: dialogEnabled ?? false,
    kodeEnabled: kodeEnabled ?? false,
  }
  const idx = allProvidersList.value.findIndex((p) => p.id === 'kooky')
  if (idx >= 0) {
    allProvidersList.value[idx] = {
      ...allProvidersList.value[idx],
      dialogEnabled: dialogEnabled ?? false,
      kodeEnabled: kodeEnabled ?? false,
    }
  }
  await loadConversationProviders()
  emitProviderConfigChanged()
  refreshClaudeCodeSettings().catch((err) => {
    console.warn('[SettingsDialogNew] 刷新 Kode 终端配置失败:', err)
  })
}

async function loadConversationProviders() {
  try {
    let list = await providerConfigApi.getProviderListAll()
    if (!list?.length) {
      list = await providerConfigApi.getProviderList('kc-oc')
    }

    const normalizedList = list.map((p) => ({
      ...p,
      isBuiltin: p.is_builtin ?? p.isBuiltin,
      displayName: p.display_name || p.displayName,
      chatModelCount: p.chat_model_count ?? p.chatModelCount ?? 0,
      kodeModelCount: p.kode_model_count ?? p.kodeModelCount ?? 0,
      dialogEnabled: p.dialog_enabled ?? p.dialogEnabled ?? false,
      kodeEnabled: p.kode_enabled ?? p.kodeEnabled ?? false,
      models: normalizeModels(p.models),
    }))

    const kookyRaw = normalizedList.find(isKookyProviderItem) || null
    const others = normalizedList.filter((p) => !isKookyProviderItem(p))

    kookyProvider.value = normalizeProviderMeta(kookyRaw, 'kooky')
    providersScroll.value = others.map((p) => normalizeProviderMeta(p))
    allProvidersList.value = [kookyProvider.value, ...providersScroll.value]

    // 列表接口可能不带 Kooky 模型数，统一从详情接口同步
    await syncKookyProviderModelCount()
  } catch (error) {
    console.error('加载厂商列表失败:', error)
    ElMessage.error('加载厂商列表失败')
  }
}

async function openCreateProviderDialog() {
  const existingTemp = providersScroll.value.find((p) => isTempProviderId(p.id))
  if (existingTemp) {
    activeProvider.value = existingTemp.id
    ElMessage.warning('请先保存当前新建服务商')
    await nextTick()
    thirdPartyPanelRef.value?.focusProviderNameInput?.()
    return
  }
  const tempId = createTempProviderId('kc-oc')
  providersScroll.value = [
    {
      id: tempId,
      name: NEW_PROVIDER_DEFAULT_NAME,
      modelCount: 0,
      chatModelCount: 0,
      kodeModelCount: 0,
      logo: defaultProviderIcon,
      isTemp: true,
    },
    ...providersScroll.value,
  ]
  activeProvider.value = tempId
  await nextTick()
  thirdPartyPanelRef.value?.resetFormForCreate?.()
}

function handleProviderSelect(id) {
  activeProvider.value = id
}

function handleUpdateTempName({ id, name, logo }) {
  const idx = providersScroll.value.findIndex((p) => p.id === id)
  if (idx < 0) return
  const next = { ...providersScroll.value[idx] }
  if (name !== undefined) next.name = name
  if (logo !== undefined) next.logo = logo
  providersScroll.value[idx] = next
}

function handleUpdateTempDraft({ id, draft }) {
  patchTempProviderDraft(id, draft)
}

async function handleDeleteProviderFromList(id) {
  if (activeProvider.value !== id) {
    activeProvider.value = id
    await nextTick()
  }
  thirdPartyPanelRef.value?.deleteProvider?.()
}

async function handleRefreshProviders(payload = {}) {
  if (payload.deletedId) {
    providersScroll.value = providersScroll.value.filter((p) => p.id !== payload.deletedId)
    patchTempProviderDraft(payload.deletedId, null)
  }
  await loadConversationProviders()
  if (payload.selectKooky) {
    activeProvider.value = 'kooky'
  } else if (payload.selectId) {
    activeProvider.value = payload.selectId
  }
  emitProviderConfigChanged()
  refreshClaudeCodeSettings().catch((err) => {
    console.warn('[SettingsDialogNew] 刷新 Kode 终端配置失败:', err)
  })
}

watch(dialogVisible, (val, wasVisible) => {
  if (val) {
    activeMenu.value = props.initialMenu
    activeProvider.value = 'kooky'
    loadConversationProviders()
  } else if (wasVisible) {
    emitProviderConfigChanged()
    refreshClaudeCodeSettings().catch((err) => {
      console.warn('[SettingsDialogNew] 关闭设置时刷新 Kode 配置失败:', err)
    })
  }
})

function handleMenuClick(id) {
  activeMenu.value = id
}

function handleClose() {
  dialogVisible.value = false
}

const appVersion = ref('1.0.0')
if (window.electronAPI?.updater?.getVersion) {
  window.electronAPI.updater.getVersion().then((v) => { appVersion.value = v }).catch(() => {})
}

function openUserAgreement() {
  const agreementUrl = 'http://ikooky.com/docs/legal/user-agreement.html'
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(agreementUrl)
    return
  }
  window.open(agreementUrl, '_blank', 'noopener,noreferrer')
}

function openUpdateLog() {
  const updateLogUrl = 'http://ikooky.com/docs/support/release-notes.html'
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(updateLogUrl)
    return
  }
  window.open(updateLogUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="sdn-root">
    <el-dialog
      v-model="dialogVisible"
      :show-close="false"
      :close-on-click-modal="false"
      :width="1120"
      align-center
      class="sdn-dialog"
      modal-class="sdn-dialog-modal"
      destroy-on-close
    >
      <div class="sdn-container">
        <aside class="sdn-sidebar">
          <div class="sdn-sidebar-title">设置</div>
          <nav class="sdn-menu">
            <div
              v-for="item in menuItems"
              :key="item.id"
              class="sdn-menu-item"
              :class="{ active: activeMenu === item.id }"
              @click="handleMenuClick(item.id)"
            >
              <span
                class="sdn-menu-icon sdn-menu-icon--mask"
                :style="{
                  WebkitMaskImage: `url(${item.icon})`,
                  maskImage: `url(${item.icon})`
                }"
              />
              <span class="sdn-menu-label">{{ item.label }}</span>
            </div>
          </nav>
        </aside>

        <div class="sdn-main">
          <div class="sdn-main-body">
          <!-- 模型与用量：三栏 -->
          <div v-if="activeMenu === 'model-usage'" class="sdn-content sdn-content--model">
            <div class="sdn-page-header">
              <div class="sdn-page-header__main">
                <h2 class="sdn-page-title">对话模型配置</h2>
                <p class="sdn-page-desc">管理服务商的 API Key 与可用模型列表</p>
              </div>
              <button type="button" class="sdn-close-btn" aria-label="关闭" @click="handleClose">
                <svgIcon name="icon-kuangjia-guanbi" />
              </button>
            </div>

            <div class="sdn-config-area">
              <SettingsProviderList
                :kooky-provider="kookyProvider"
                :providers="providersScroll"
                :active-provider-id="activeProvider"
                @select="handleProviderSelect"
                @create="openCreateProviderDialog"
                @delete="handleDeleteProviderFromList"
              />

              <div class="sdn-detail-column">
                <SettingsKookyPanel
                  v-if="activeProvider === 'kooky'"
                  :active="true"
                  :all-providers="allProvidersList"
                  @model-count-update="handleKookyModelCountUpdate"
                  @enablement-update="handleKookyEnablementUpdate"
                />
                <SettingsThirdPartyPanel
                  v-else
                  ref="thirdPartyPanelRef"
                  :provider-id="activeProvider"
                  :providers="providersScroll"
                  :all-providers="allProvidersList"
                  :temp-provider-draft="tempProviderDrafts[activeProvider] || null"
                  @refresh-providers="handleRefreshProviders"
                  @update-temp-name="handleUpdateTempName"
                  @update-temp-draft="handleUpdateTempDraft"
                />
              </div>
            </div>
          </div>

          <!-- 关于Kooky：完全保持原版 -->
          <div v-else-if="activeMenu === 'about-kooky'" class="sdn-content sdn-content--simple">
            <div class="sdn-about-header">
              <span class="sdn-about-header__title">关于Kooky</span>
              <button type="button" class="sdn-close-btn" aria-label="关闭" @click="handleClose">
                <svgIcon name="icon-kuangjia-guanbi" />
              </button>
            </div>
            <div class="sdn-about-page">
              <div class="sdn-about-visual">
                <div class="sdn-about-gif-wrap">
                  <img src="@/assets/settings/setting-color.png" alt="" class="sdn-about-gif-glow" />
                  <!-- <div class="sdn-about-gif-ring sdn-about-gif-ring--outer" aria-hidden="true"></div>
                  <div class="sdn-about-gif-ring sdn-about-gif-ring--inner" aria-hidden="true"></div> -->
                  <img src="@/assets/home/kooky_run.gif" alt="Kooky" class="sdn-about-gif" />
                </div>
                <h2 class="sdn-about-title">Kooky</h2>
              </div>
              <div class="sdn-about-version">
                <span>当前版本</span>
                <span>V{{ appVersion }}</span>
              </div>
              <div class="sdn-about-version sdn-about-user" @click.prevent="openUpdateLog">
                <span>更新日志</span>
                <img src="@/assets/settings/right.svg" alt="right" />
              </div>
              <div class="sdn-about-version sdn-about-user" @click.prevent="openUserAgreement">
                <span>用户协议</span>
                <img src="@/assets/settings/right.svg" alt="right" />
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/* teleport 到 body 的遮罩层需 :global，类名 sdn- 前缀保证不污染全局 */
:global(.sdn-dialog-modal) {
  padding: 40px 24px;
  box-sizing: border-box;
}

:global(.sdn-dialog.el-dialog) {
  --el-dialog-padding-primary: 0;
  height: calc(100vh - 80px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border-radius: 12px;
  background: #f5f6f7;
}

:global(.sdn-dialog.el-dialog .el-dialog__header) {
  display: none;
}

:global(.sdn-dialog.el-dialog .el-dialog__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden;
  min-height: 0;
}

:global(.sdn-dialog.el-dialog .el-dialog__footer) {
  display: none;
}

.sdn-container {
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
}

.sdn-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  min-height: 0;
  background: #F7F8FA;
  border-right: 1px solid #ebeef5;
  border-radius: 12px 0 0 12px;
  overflow: hidden;
}

.sdn-sidebar-title {
  flex-shrink: 0;
  padding: 16px 16px 12px 24px !important;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}

.sdn-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 16px;
}

.sdn-menu-item {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 40px;
  line-height: 40px;
  margin: 0 8px 4px 8px;
  color: #2F3547; 
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  &:hover { background: #FFF1EA; }
  &.active { background: #FFF1EA; color: #FF621F; }

  .sdn-menu-icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    flex-shrink: 0;
    display: inline-block;
    color: #606572;
  }
  &.active .sdn-menu-icon { color: #FF621F; }

  .sdn-menu-icon--mask {
    background-color: #606572;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
  }
  &.active .sdn-menu-icon--mask { background-color: #FF621F; }

  .sdn-menu-label { 
    font-size: 14px;
    line-height: 1.4;
  }
}

.sdn-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #fff;
  border-radius: 0 12px 12px 0;
  overflow: hidden;
}

.sdn-main-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 与删除确认弹框 delete-dialog-close 一致：标题行内静态定位，避免绝对定位与下层内容抢点击 */
.sdn-close-btn {
  position: static;
  top: auto;
  right: auto;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;

  &:hover {
    color: #606266;
    background: rgba(47, 53, 71, 0.06);
  }

  &:active {
    background: rgba(47, 53, 71, 0.1);
  }
}

.sdn-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &--model { background: #fff; }
}

.sdn-page-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 15px 0 20px !important;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.sdn-page-header__main {
  flex: 1;
  min-width: 0;
}

.sdn-page-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #2F3547;
  line-height: 1.4;
}

.sdn-page-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.sdn-config-area {
  flex: 1;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  min-height: 0;
}

.sdn-detail-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== About Kooky Page（原版不动） ===== */
.sdn-content--simple {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sdn-about-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 15px 16px 24px;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: normal;
  color: #2F3547;
}

.sdn-about-header__title {
  flex: 1;
  min-width: 0;
}

.sdn-about-page {
  flex: 1;
  display: flex;
  margin-top: -20px;
  flex-direction: column;
  align-items: center;
  padding: 0 40px 48px;
  text-align: center;
}

.sdn-about-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sdn-about-gif-wrap {
  position: relative;
  width: 280px;
  height: 280px;
}

.sdn-about-gif-glow,
.sdn-about-gif-ring,
.sdn-about-gif {
  position: absolute;
  top: calc(50% + 30px);
  left: 50%;
  transform: translate(-50%, -50%);
}

.sdn-about-gif-glow {
  width: 1000px;
  height: 1000px;
  object-fit: contain;
  pointer-events: none;
}

.sdn-about-gif-ring {
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
}

.sdn-about-gif-ring--inner {
  width: 136px;
  height: 136px;
  border: 1px solid rgba(255, 196, 158, 0.26);
}

.sdn-about-gif-ring--outer {
  width: 270px;
  height: 270px;
  border: 1px solid rgba(255, 196, 158, 0.22);
}

.sdn-about-gif {
  z-index: 1;
  width: 125px;
  height: 125px;
  margin-left: 4px;
  margin-top: 8px;
  object-fit: contain;
}

.sdn-about-title {
  position: relative;
  z-index: 2;
  margin: -40px 0 8px;
  font-family: Alibaba PuHuiTi 2.0;
  font-size: 32px;
  font-weight: bold;
  color: #171B26;
  line-height: 1;
}

.sdn-about-version {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  height: 56px;
  align-items: center;
  width: 100%;
  background: #F7F8FA;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: normal;
  color: #2F3547;
  padding: 0 24px;
  text-align: left;
  &:hover { background: #ECEEF3; }
}

.sdn-about-user {
  margin-top: 16px;
  cursor: pointer;
  img { width: 12px; height: 12px; }
}
</style>
