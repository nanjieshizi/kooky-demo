// src/modules/auth/useFeishuDocAuth.js
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/modules/auth/store'
import { registerClient, fetchMatrixInfo } from '@/shared/services/imApi'
import { getOneEnv } from '@/shared/utils/oneEnv'

// 模块级并发锁，防止多次粘贴同时触发授权弹窗
let _authInProgress = false

const DOC_TOKEN_KEY = 'feishu_doc_token'

/**
 * 检测文本中是否含有飞书云文档链接
 * @param {string} text
 * @returns {boolean}
 */
function hasFeishuDocLink(text) {
  return /(https?:\/\/[^\s]*\.xfchat\.iflytek\.com)/i.test(text)
}

/**
 * 从粘贴文本中提取第一个飞书云文档链接
 * @param {string} text
 * @returns {string|null}
 */
function extractFirstDocLink(text) {
  const match = text.match(/(https?:\/\/[^\s]*\.xfchat\.iflytek\.com[^\s]*)/i)
  return match ? match[1] : null
}

/**
 * 获取 xfchat 配置（与 LoginDialog 保持一致）
 */
function getXfchatConfig() {
  const base = typeof window !== 'undefined' && window.BASEDB ? window.BASEDB : {}
  return {
    redirectUri: base.VITE_XFCHAT_REDIRECT_URI || '',
    openDomain: base.VITE_XFCHAT_OPEN_DOMAIN || 'https://open.xfchat.iflytek.com',
  }
}

const DOC_TOKEN_SCOPE =
  'wiki:wiki docx:document drive:drive bitable:app base:app:read base:field:read offline_access'

/**
 * 尝试用当前 access_token 作为 refresh_token 刷新，成功则更新缓存并返回新 token，失败返回 null
 * @param {string} access_token
 * @returns {Promise<string|null>}
 */
async function refreshDocToken(access_token) {
  try {
    const { openDomain } = getXfchatConfig()
    const res = await window.electronAPI.auth.xfchatExchangeToken({
      grantType: 'refresh_token',
      refreshToken: access_token,
      scope: DOC_TOKEN_SCOPE,
      openDomain,
    })
    const payload = res?.data ?? res
    const newToken = payload?.data?.access_token ?? payload?.access_token
    if (!newToken) return null
    const refreshTokenExpiresIn = payload?.data?.refresh_token_expires_in ?? payload?.refresh_token_expires_in ?? 3600
    writeDocToken(newToken, refreshTokenExpiresIn)
    return newToken
  } catch (error) {
    console.warn('[useFeishuDocAuth] token 刷新失败:', error)
    return null
  }
}

/**
 * 读取本地缓存的文档授权 token，并通过刷新接口验证有效性
 * @returns {Promise<string|null>}
 */
async function readDocToken() {
  try {
    const raw = localStorage.getItem(DOC_TOKEN_KEY)
    if (!raw) return null
    const { access_token, expires_at } = JSON.parse(raw)
    if (!access_token || Date.now() >= expires_at) return null

    // 调用刷新接口验证 token 是否真的有效，成功则返回新 token
    const refreshed = await refreshDocToken(access_token)
    if (!refreshed) {
      localStorage.removeItem(DOC_TOKEN_KEY)
      return null
    }

    return refreshed
  } catch {
    return null
  }
}

/**
 * 写入文档授权 token 到本地缓存
 * @param {string} access_token
 * @param {number} [expires_in=3600] 秒
 */
function writeDocToken(access_token, expires_in = 3600) {
  localStorage.setItem(
    DOC_TOKEN_KEY,
    JSON.stringify({ access_token, expires_at: Date.now() + expires_in * 1000 }),
  )
}

/**
 * 通过 OAuth code 换取用户级文档 access_token
 * @param {string} code
 * @returns {Promise<string>} access_token
 */
async function fetchDocUserToken(code) {
  const { redirectUri, openDomain } = getXfchatConfig()
  const res = await window.electronAPI.auth.xfchatExchangeToken({
    grantType: 'authorization_code',
    code,
    redirectUri,
    openDomain,
  })
  const payload = res?.data ?? res
  const token = payload?.data?.access_token ?? payload?.access_token
  if (!token) throw new Error(payload?.msg ?? payload?.message ?? '获取文档授权 token 失败')
  const refreshTokenExpiresIn = payload?.data?.refresh_token_expires_in ?? payload?.refresh_token_expires_in ?? 3600
  writeDocToken(token, refreshTokenExpiresIn)
  return token
}

/**
 * 通过 Electron IPC 弹窗完成 OAuth 授权，返回文档 access_token
 * @returns {Promise<string>}
 */
async function authorizeDocViaElectron() {
  const { redirectUri } = getXfchatConfig()
  const appId = await window.electronAPI.auth.getXfchatAppId()
  if (!appId || !redirectUri) throw new Error('飞书文档授权配置缺失（appId / redirectUri）')

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DOC_TOKEN_SCOPE,
  })
  const authorizeUrl = `https://accounts.xfchat.iflytek.com/open-apis/authen/v1/authorize?${params.toString()}`

  const result = await window.electronAPI.auth.feishuLogin(authorizeUrl, redirectUri)
  if (!result?.code) throw new Error('未获取到授权 code')

  return fetchDocUserToken(result.code)
}

export function useFeishuDocAuth() {
  /**
   * 检测粘贴文本是否含飞书云文档链接，若有则确保持有有效的用户级文档 token 并调用 registerClient。
   * 不阻断正常粘贴行为，处理结果通过 ElMessage 提示。
   * @param {string} text - 粘贴的原始文本
   */
  async function checkAndAuthFeishu(text) {
    if (!hasFeishuDocLink(text)) return
    if (_authInProgress) return
    _authInProgress = true
    try {
      const userStore = useUserStore()

      // 1. 读缓存并验证，命中且有效则直接跳到注册步骤
      let docToken = await readDocToken()
      if (!docToken) {
        ElMessage.info('检测到飞书云文档链接，正在获取访问令牌...')
        docToken = await authorizeDocViaElectron()
      }

      // 2. 调用 registerClient 将文档 token 传给后端
      try {
        const accessToken = userStore.userInfo?.access_token
        const matrixInfoRes = await fetchMatrixInfo(accessToken)
        const bindImUserId = matrixInfoRes?.bindImUserId
        if (!accessToken || !bindImUserId) {
          console.warn('[useFeishuDocAuth] accessToken 或 bindImUserId 缺失，跳过 registerClient')
          return
        }

        // 准备注册参数
        const params = {
          bindImUserId,
          env: getOneEnv(),
          feishuToken: docToken,
          userAvatar: userStore.userInfo?.avatar || '',
        }

        await registerClient(accessToken, params)
        ElMessage.success('飞书云文档授权成功')
      } catch (e) {
        console.error('[useFeishuDocAuth] registerClient 失败:', e)
        ElMessage.error('飞书云文档授权注册失败，请稍后重试')
      }
    } catch (e) {
      console.error('[useFeishuDocAuth] 授权失败:', e)
      ElMessage.error('飞书云文档授权失败，请稍后重试')
    } finally {
      _authInProgress = false
    }
  }

  return { checkAndAuthFeishu, hasFeishuDocLink }
}
