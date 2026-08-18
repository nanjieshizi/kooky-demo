import api, { getSsoToken } from './api'

const BASE_PATH = '/kooky-api/api/client/v1/provider-config'

/**
 * 获取用户账号
 */
function getUserAccount() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return userInfo?.userId || userInfo?.username || userInfo?.name || ''
    }
  } catch (e) {
    // ignore
  }
  return ''
}

/**
 * 获取 Cp-Gw 头所需的用户信息
 */
function getCpGwUserInfo() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return {
        username: userInfo?.userId || userInfo?.username || userInfo?.name || '',
        chname: userInfo?.chname || userInfo?.name || userInfo?.realName || userInfo?.username || ''
      }
    }
  } catch (e) {
    // ignore
  }
  return { username: '', chname: '' }
}

/**
 * 生成认证请求头
 */
function authHeaders() {
  const token = getSsoToken()
  const account = getUserAccount()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(account ? { 'X-KC-Account': account } : {}),
  }
}

/** 解包 provider-config 接口响应（兼容 { code, data: {...} }） */
function unwrapProviderConfigPayload(res) {
  if (!res || typeof res !== 'object') return {}
  const inner = res.data
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    if (
      inner.id !== undefined
      || inner.provider_code !== undefined
      || inner.providerCode !== undefined
      || inner.display_name !== undefined
      || inner.displayName !== undefined
      || inner.channels !== undefined
      || inner.chat_models !== undefined
      || inner.chatModels !== undefined
      || inner.dialog_enabled !== undefined
      || inner.dialogEnabled !== undefined
      || inner.quota !== undefined
      || inner.items !== undefined
    ) {
      return inner
    }
  }
  return res
}

function unwrapProviderConfigList(res) {
  const body = unwrapProviderConfigPayload(res)
  if (Array.isArray(body)) return body
  const items = body?.items
    ?? body?.list
    ?? body?.records
    ?? body?.rows
    ?? body?.data?.items
    ?? body?.data?.list
    ?? body?.data?.records
    ?? body?.data?.rows
    ?? body?.data
    ?? []
  return Array.isArray(items) ? items : []
}

/**
 * 获取系统厂商模板列表(新建时下拉选择)
 * @returns {Promise<Array>}
 */
export function getProviderTemplates() {
  return api.get(`${BASE_PATH}/templates`, {
    headers: authHeaders()
  })
    .then(res => unwrapProviderConfigList(res))
}

/**
 * 获取用户厂商列表(含模型列表和选中标记)
 * @param {string} channel - 'kc-oc' 或 'kc-cc'
 * @returns {Promise<Array>}
 */
export function getProviderList(channel) {
  return api.get(`${BASE_PATH}/providers`, {
    params: channel ? { channel } : undefined,
    headers: authHeaders()
  }).then(res => unwrapProviderConfigList(res))
}

/**
 * 获取 provider 列表（新版，不传 channel）
 * @returns {Promise<Array>}
 */
export function getProviderListAll() {
  return getProviderList()
}

/**
 * 获取厂商详情
 * @param {string|number} id - 厂商 ID(Kooky 为 'kooky')
 * @param {string} channel - 'kc-oc' 或 'kc-cc'
 * @returns {Promise<Object>}
 */
export function getProviderDetail(id, channel) {
  return api.get(`${BASE_PATH}/providers/${id}`, {
    params: channel ? { channel } : undefined,
    headers: authHeaders()
  }).then(res => unwrapProviderConfigPayload(res) || {})
}

/**
 * 获取第三方 provider 详情（新版，不传 channel）
 */
export function getProviderDetailNew(id) {
  return getProviderDetail(id)
}

/**
 * 新建厂商配置
 * @param {Object} payload
 * @param {string} payload.channel - 'kc-oc' 或 'kc-cc'
 * @param {number|null} payload.templateId - 模板 ID,null 表示自定义
 * @param {string} payload.displayName - 显示名称
 * @param {string} payload.apiKey - API 密钥
 * @param {string} payload.baseUrl - Base URL(可选,基于模板时)
 * @param {string} payload.apiProtocol - API 协议(自定义时必填)
 * @param {number} payload.isCustom - 是否完全自定义(0 或 1)
 * @param {Array} payload.models - 模型列表 [{modelName, modelCode}]
 * @returns {Promise<Object>} - { id }
 */
export function createProvider(payload) {
  return api.post(`${BASE_PATH}/providers`, payload, {
    headers: authHeaders()
  })
    .then(res => res || {})
}

/**
 * 更新厂商配置
 * @param {number} id - 厂商配置 ID
 * @param {Object} payload
 * @param {string} payload.displayName
 * @param {string} payload.apiKey
 * @param {string} payload.baseUrl
 * @param {string} payload.apiProtocol
 * @returns {Promise<Object>}
 */
export function updateProvider(id, payload) {
  return api.put(`${BASE_PATH}/providers/${id}`, payload, {
    headers: authHeaders()
  })
    .then(res => res || {})
}

/**
 * 删除厂商配置(级联删除模型和选择记录)
 * @param {number} id - 厂商配置 ID
 * @returns {Promise<void>}
 */
export function deleteProvider(id) {
  return api.delete(`${BASE_PATH}/providers/${id}`, {
    headers: authHeaders()
  })
}

/**
 * 添加模型
 * @param {number} providerId - 厂商配置 ID
 * @param {Object} payload
 * @param {string} payload.modelName - 模型名称 / CLI 别名
 * @param {string} payload.modelCode - 实际调用的模型 ID
 * @returns {Promise<Object>}
 */
export function addModel(providerId, payload) {
  return api.post(`${BASE_PATH}/providers/${providerId}/models`, payload, {
    headers: authHeaders()
  })
    .then(res => res || {})
}

/**
 * 更新模型
 * @param {number} providerId - 厂商配置 ID
 * @param {number} modelId - 模型配置 ID
 * @param {Object} payload
 * @param {string} payload.modelName
 * @param {string} payload.modelCode
 * @returns {Promise<Object>}
 */
export function updateModel(providerId, modelId, payload) {
  return api.put(`${BASE_PATH}/providers/${providerId}/models/${modelId}`, payload, {
    headers: authHeaders()
  })
    .then(res => res || {})
}

/**
 * 删除模型
 * @param {number} providerId - 厂商配置 ID
 * @param {number} modelId - 模型配置 ID
 * @returns {Promise<void>}
 */
export function deleteModel(providerId, modelId) {
  return api.delete(`${BASE_PATH}/providers/${providerId}/models/${modelId}`, {
    headers: authHeaders()
  })
}

/**
 * 测试 API 连接
 * @param {Object} payload
 * @param {string} payload.apiKey
 * @param {string} payload.baseUrl
 * @param {string} payload.apiProtocol
 * @returns {Promise<Object>}
 */
export function testConnection(payload) {
  return api.post(`${BASE_PATH}/providers/test-connection`, payload, {
    headers: authHeaders()
  })
    .then(res => res || {})
}

/**
 * 从 API 获取上游模型列表
 */
export function fetchModels(payload) {
  return api.post(`${BASE_PATH}/providers/fetch-models`, payload, {
    headers: authHeaders()
  }).then(res => res || {})
}

/**
 * 创建第三方 provider 完整配置
 * @param {Object} payload - 含 kode_api_key / kode_default_base_url / kode_api_protocol
 */
export function createProviderFull(payload) {
  return api.post(`${BASE_PATH}/providers/full`, payload, {
    headers: authHeaders()
  }).then(res => res || {})
}

/**
 * 更新第三方 provider 完整配置
 * @param {Object} payload - 含 kode_api_key / kode_default_base_url / kode_api_protocol
 */
export function updateProviderFull(id, payload) {
  return api.put(`${BASE_PATH}/providers/${id}/full`, payload, {
    headers: authHeaders()
  }).then(res => res || {})
}

/**
 * 更新 Kooky 对话 / Kode 启用状态（即时生效，不走 full save）
 * @param {Object} payload
 * @param {boolean} payload.dialog_enabled
 * @param {boolean} payload.kode_enabled
 */
export function updateKookyEnablements(payload) {
  return api.put(`${BASE_PATH}/providers/kooky/enablements`, {
    dialog_enabled: payload.dialog_enabled ?? payload.dialogEnabled ?? false,
    kode_enabled: payload.kode_enabled ?? payload.kodeEnabled ?? false,
  }, {
    headers: authHeaders()
  }).then(res => res || {})
}

/**
 * 更新用户当前选择(对话模式切换模型 / CLI 模式启用厂商)
 * @param {Object} payload
 * @param {string} payload.channel - 'kc-oc' 或 'kc-cc'
 * @param {number} payload.providerConfigId - 厂商配置 ID
 * @param {number|null} payload.modelConfigId - 模型配置 ID(CLI 模式传 null)
 * @returns {Promise<void>}
 */
export function updateSelection(payload) {
  return api.put(`${BASE_PATH}/selection`, payload, {
    headers: authHeaders()
  })
}

/**
 * 模型真实连接测试 v2
 * @param {Object} payload
 * @param {string} payload.api_key
 * @param {string} payload.base_url
 * @param {string} payload.api_protocol
 * @param {string} payload.model - 模型 ID (model_code)
 * @returns {Promise<Object>} - { success, message, protocol, model, latency_ms }
 */
export function testModelHealth(payload) {
  return api.post(`${BASE_PATH}/providers/test-connection-v2`, {
    api_key: payload.api_key,
    base_url: payload.base_url,
    api_protocol: payload.api_protocol,
    model: payload.model || payload.model_code,
  }, {
    headers: authHeaders(),
    timeout: 18000,
  }).then(res => res || {})
}

/**
 * Kode 场景本地模型连接测试（走 Electron 主进程，绕过 CORS）
 * 非 Electron 环境 fallback 到后端 v2 接口
 */
export function testModelHealthLocal(payload) {
  if (window.electronAPI?.provider?.testModelLocal) {
    return window.electronAPI.provider.testModelLocal({
      api_key: payload.api_key,
      base_url: payload.base_url,
      api_protocol: payload.api_protocol,
      model: payload.model || payload.model_code,
    })
  }
  return testModelHealth(payload)
}

/**
 * 提交 Token 扩容申请 (API 3.2)
 * @param {Object} payload
 * @param {string} payload.tokenType - 令牌类型 (v3.0 统一为 kc-oc)
 * @param {string} [payload.reason] - 申请原因
 * @param {number} [payload.currentQuota] - 当前额度
 * @param {string} [payload.currentQuotaLevel] - 当前额度等级 (LOW/MEDIUM/HIGH)
 * @param {number} [payload.appliedQuota] - 申请的额度(美元)
 * @param {string} [payload.quotaApplyType] - 申请类型: fixed(固定)/temporary(临时)
 * @returns {Promise<Object>}
 */
export function submitTokenExpand(payload) {
  const { username, chname } = getCpGwUserInfo()
  return api.post('/kooky-api/api/client/v1/approval-orders/token-expand', payload, {
    headers: {
      ...authHeaders(),
    }
  }).then(res => res || {})
}

/** AI 工具平台：组织内全部部门（申请额度的「所属产线」下拉项）
 * 返回项含 is_current_line（是否本产线）、is_self（是否用户所在部门，用于默认选中） */
export function fetchQuotaDepartments() {
  return api.get('/kooky-api/api/client/v1/quota/departments', {
    headers: authHeaders(),
  }).then(res => unwrapProviderConfigList(res))
}

/** AI 工具平台：按关键词搜索可选「所属项目」 */
export function searchQuotaProjects(keyword) {
  return api.get('/kooky-api/api/client/v1/quota/projects', {
    params: { keyword: keyword || '' },
    headers: authHeaders(),
  }).then(res => unwrapProviderConfigList(res))
}
