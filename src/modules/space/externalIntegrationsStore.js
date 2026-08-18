import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'kooky-external-integrations'

const DEFAULTS = {
  feishuWebhookUrl: '',
  yunfanPersonalToken: '',
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function maskValue(value, { head = 12, tail = 4 } = {}) {
  const s = String(value || '').trim()
  if (!s) return '—'
  if (s.length <= head + tail + 3) return '••••••••'
  return `${s.slice(0, head)}···${s.slice(-tail)}`
}

export const useExternalIntegrationsStore = defineStore('externalIntegrations', () => {
  const saved = loadFromStorage()
  const feishuWebhookUrl = ref(saved.feishuWebhookUrl)
  const yunfanPersonalToken = ref(saved.yunfanPersonalToken)

  const feishuConfigured = computed(() => !!feishuWebhookUrl.value.trim())
  const yunfanConfigured = computed(() => !!yunfanPersonalToken.value.trim())

  const feishuWebhookMasked = computed(() => maskValue(feishuWebhookUrl.value, { head: 28, tail: 6 }))
  const yunfanTokenMasked = computed(() => maskValue(yunfanPersonalToken.value, { head: 4, tail: 4 }))

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        feishuWebhookUrl: feishuWebhookUrl.value,
        yunfanPersonalToken: yunfanPersonalToken.value,
      }))
    } catch { /* ignore */ }
  }

  function saveFeishuWebhook(url) {
    feishuWebhookUrl.value = String(url || '').trim()
    persist()
  }

  function saveYunfanToken(token) {
    yunfanPersonalToken.value = String(token || '').trim()
    persist()
  }

  function clearFeishu() {
    feishuWebhookUrl.value = ''
    persist()
  }

  function clearYunfan() {
    yunfanPersonalToken.value = ''
    persist()
  }

  /** 工厂「集成管理」只读：按集成 id 取配置状态 */
  function isConfigured(integrationId) {
    if (integrationId === 'feishu') return feishuConfigured.value
    if (integrationId === 'yunfan') return yunfanConfigured.value
    return false
  }

  function getMaskedConfig(integrationId) {
    if (integrationId === 'feishu') return feishuWebhookMasked.value
    if (integrationId === 'yunfan') return yunfanTokenMasked.value
    return '—'
  }

  function getFieldLabel(integrationId) {
    if (integrationId === 'feishu') return 'Webhook URL'
    if (integrationId === 'yunfan') return '个人 Token'
    return ''
  }

  return {
    feishuWebhookUrl,
    yunfanPersonalToken,
    feishuConfigured,
    yunfanConfigured,
    feishuWebhookMasked,
    yunfanTokenMasked,
    saveFeishuWebhook,
    saveYunfanToken,
    clearFeishu,
    clearYunfan,
    isConfigured,
    getMaskedConfig,
    getFieldLabel,
  }
})
