<template>
  <Transition name="dialog-fade">
    <div
      v-if="visible"
      class="login-overlay"
    >
      <div class="login-dialog">
        <!-- 跳过按钮（最后一页不显示） -->
        <span v-if="step < totalSteps - 1" class="skip-btn" @click="skipToLogin">跳过</span>
        <!-- Carousel -->
        <div class="carousel">
          <TransitionGroup :name="transitionName">
            <!-- Page 1: 报告 -->
            <div v-if="step === 0" key="p0" class="page page-img">
              <div class="page-img-wrap">
                <img src="@/assets/login/page1.png" alt="小King" class="page-full-img" />
              </div>
            </div>

            <!-- Page 2: 个人辅助 -->
            <div v-if="step === 1" key="p1" class="page page-img">
              <div class="page-img-wrap">
                <img src="@/assets/login/page2.png" alt="个人辅助" class="page-full-img" />
              </div>
            </div>

            <!-- Page 3: 超级工作群 -->
            <div v-if="step === 2" key="p2" class="page page-img">
              <div class="page-img-wrap">
                <img src="@/assets/login/page3.png" alt="超级工作群" class="page-full-img" />
              </div>
            </div>

            <!-- Page 4: 登录 -->
            <div v-if="step === 3" key="p3" class="page page-login">
              <!-- 标题图片 -->
              <div class="login-title-img-wrap">
                <img src="@/assets/login/page4_tilte.png" alt="BOSS～，请下达任务吧" class="login-title-img" />
              </div>

              <!-- 登录主体区域 -->
              <div class="login-body">
              <!-- 圆形背景 -->
              <img src="@/assets/login/page_4bg.png" alt="" class="login-bg-circle" />

              <!-- 螃蟹装饰图 -->
              <div class="login-crab-area">
                <img src="@/assets/login/ewm_bg.png" alt="crab" class="login-crab-img" />
                <h3 class="form-title">扫码登录</h3>
                 <!-- 扫码登录卡片 -->
              <div class="login-card">
                <div class="qr-area">

                  <!-- Electron 环境：显示点击登录按钮 -->
                  <template v-if="isElectron">
                    <div class="electron-login-area">
                      <button class="electron-feishu-btn" :disabled="electronLoggingIn" @click="handleElectronFeishuLogin">
                        {{ electronLoggingIn ? '授权中...' : '点击进入i讯飞登录' }}
                      </button>
                      <p class="qr-hint" style="margin-top: 8px;">点击后将弹出i讯飞授权窗口</p>
                    </div>
                  </template>
                  <!-- Web 环境：保持 SDK 二维码 -->
                  <template v-else>
                    <p class="qr-hint">打开手机讯飞，在右上方打开扫一扫</p>
                    <div class="qr-code-box">
                      <div ref="qrContainer" id="xfchat_qr_container"></div>
                    </div>
                    <p class="qr-footer">
                      请扫描二维码登录
                      <a class="form-link" @click.prevent="refreshXfchatQr">刷新</a>
                    </p>
                  </template>
                </div>
              </div>
              </div>
              <div v-if="!isProductionDeployment()" class="env-switch-wrap">
                  <span class="env-switch-label">环境</span>
                  <el-select
                    v-model="selectedOneEnv"
                    class="env-select-el"
                    size="small"
                    popper-class="env-select-popper"
                    @change="onOneEnvChange"
                  >
                    <el-option
                      v-for="opt in ENV_OPTIONS"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>

              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- Navigation buttons -->
        <div class="nav-buttons" v-if="step !== 3">
         <div class="nav-btn-bg">
           <button v-if="step > 0 && step < 3" class="nav-btn nav-btn-plain" @click="prev"><el-icon><ArrowLeft /></el-icon> 上一页</button>
            <span v-else></span>
            <button v-if="step < 3" class="nav-btn" @click="next">下一页 <el-icon><ArrowRight /></el-icon></button>
         </div>
        </div>

        <!-- Dots -->
        <div class="dots" v-if="!userStore.hasLoggedInBefore">
          <span
            v-for="i in totalSteps"
            :key="i"
            class="dot"
            :class="{ active: step === i - 1 }"
            @click="transitionName = i - 1 > step ? 'slide-left' : 'slide-right'; step = i - 1; resetAutoPlay()"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useUserStore } from '@/modules/auth/store'
import { post, get } from '@/shared/utils/request'
import { ENV_OPTIONS, getOneBaseUrl, getOneEnv, setOneEnv, isProductionDeployment } from '@/shared/utils/oneEnv'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['login-success'])

const userStore = useUserStore()

const totalSteps = 4
const step = ref(0)
const transitionName = ref('slide-left')
const loginTab = ref('account')
const isQrMode = ref(false)
const showPassword = ref(false)
const codeCooldown = ref(0)
const qrContainer = ref(null)
const isElectron = !!(typeof window !== 'undefined' && window.electronAPI)
const electronLoggingIn = ref(false)
const selectedOneEnv = ref(getOneEnv())

function onOneEnvChange(val) {
  setOneEnv(val ?? selectedOneEnv.value)
  userStore.syncTokenToMainProcess()
  // 切换环境时立即清空云端文件树缓存，防止新环境看到旧环境数据
  import('@/modules/file/store').then(({ useFileStore }) => {
    const fileStore = useFileStore()
    fileStore.cloudTree.nodeCache = {}
    fileStore.cloudTree.expandedNodeIds = []
    fileStore.cloudTree.loadingNodeIds = []
    fileStore.quotaInfo = {}
  }).catch(() => {})
}
let xfchatQrLoginObj = null
let xfchatGotoUrl = ''
let autoPlayTimer = null

const accountForm = reactive({
  username: '',
  password: ''
})

const codeForm = reactive({
  phone: '',
  code: ''
})

let codeCooldownTimer = null

function startAutoPlay() {
  stopAutoPlay()
  autoPlayTimer = setInterval(() => {
    if (step.value < totalSteps - 1) {
      transitionName.value = 'slide-left'
      step.value++
    } else {
      stopAutoPlay()
    }
  }, 3000)
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

function resetAutoPlay() {
  if (step.value < totalSteps - 1) {
    startAutoPlay()
  } else {
    stopAutoPlay()
  }
}

function prev() {
  transitionName.value = 'slide-right'
  step.value--
  resetAutoPlay()
}

function next() {
  transitionName.value = 'slide-left'
  step.value++
  resetAutoPlay()
}

function skipToLogin() {
  transitionName.value = 'slide-left'
  step.value = totalSteps - 1
  stopAutoPlay()
}

function toggleLoginMode() {
  isQrMode.value = !isQrMode.value
  if (isQrMode.value) {
    nextTick(() => initXfchatQr())
  }
}

// 飞书/讯飞扫码登录（参考 open.xfchat.iflytek.com 文档）
// appId 缓存：Electron 环境从主进程获取，Web 环境不使用
let _cachedAppId = ''
async function getXfchatAppId() {
  if (_cachedAppId) return _cachedAppId
  if (isElectron && window.electronAPI?.auth?.getXfchatAppId) {
    _cachedAppId = await window.electronAPI.auth.getXfchatAppId()
  }
  return _cachedAppId
}

function getXfchatConfig() {
  const base = typeof window !== 'undefined' && window.BASEDB ? window.BASEDB : {}
  const authDomain = (base.VITE_XFCHAT_AUTH_DOMAIN || '').replace(/\/$/, '')
  const redirectUri = base.VITE_XFCHAT_REDIRECT_URI || (window.location?.origin + '/super-assistant/auth/callback')
  return { authDomain, redirectUri }
}

async function buildGotoUrl() {
  const appId = await getXfchatAppId()
  const { authDomain, redirectUri } = getXfchatConfig()
  if (!appId || !authDomain) return ''
  const state = Math.random().toString(36).slice(2)
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('xfchat_oauth_state', state)
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state
  })
  const gotoUrl = `${authDomain}/suite/passport/oauth/authorize?${params.toString()}`
  if (import.meta.env?.DEV && typeof console !== 'undefined') {
    console.log('[飞书扫码] redirect_uri(须与开放平台配置完全一致):', redirectUri)
    console.log('[飞书扫码] goto(授权地址):', gotoUrl)
  }
  return gotoUrl
}

async function initXfchatQr() {
  // Electron 环境不使用 SDK 渲染二维码，由按钮触发 OAuth 流程
  if (isElectron) return

  const container = qrContainer.value || document.getElementById('xfchat_qr_container')
  if (!container) {
    return
  }

  const QRLogin = typeof window !== 'undefined' && window.QRLogin
  if (!QRLogin) {
    console.warn('[Login] 飞书扫码 SDK 未加载，请检查 index.html 中的 script 引用')
    container.innerHTML = '<p class="qr-sdk-missing">二维码加载失败，请刷新页面</p>'
    return
  }

  xfchatGotoUrl = await buildGotoUrl()
  if (!xfchatGotoUrl) {
    container.innerHTML = '<p class="qr-sdk-missing">飞书登录配置加载失败</p>'
    return
  }

  container.innerHTML = ''
  xfchatQrLoginObj = QRLogin({
    id: 'xfchat_qr_container',
    goto: xfchatGotoUrl,
    width: '234',
    height: '234'
  })
}

function refreshXfchatQr() {
  initXfchatQr()
}

// Electron 环境：通过 BrowserWindow 打开 OAuth 授权页
async function handleElectronFeishuLogin() {
  if (electronLoggingIn.value) return
  electronLoggingIn.value = true
  try {
    const appId = await getXfchatAppId()
    const { authDomain, redirectUri } = getXfchatConfig()
    if (!appId || !authDomain) {
      console.error('[Login] 飞书登录配置缺失')
      return
    }
    const state = Math.random().toString(36).slice(2)
    sessionStorage.setItem('xfchat_oauth_state', state)
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state
    })
    const authUrl = `${authDomain}/suite/passport/oauth/authorize?${params.toString()}`
    const result = await window.electronAPI.auth.feishuLogin(authUrl, redirectUri)
    if (result && result.code) {
      await exchangeCodeAndLogin(result.code, result.state)
    }
  } catch (e) {
    console.error('[Login] Electron 飞书登录失败', e)
  } finally {
    electronLoggingIn.value = false
  }
}

// 弹窗授权：主窗口不跳转，在弹窗内完成授权后通过 postMessage 回传 code
const XFCHAT_OAUTH_MESSAGE_TYPE = 'xfchat-oauth-code'

function handleXfchatMessage(event) {
  // 1. 弹窗回调页回传的 code（仅接受同源）。Electron 下只走 IPC 回传，不收 postMessage，避免重复触发导致两次授权
  if (event.data?.type === XFCHAT_OAUTH_MESSAGE_TYPE && event.data?.code && event.origin === window.location.origin) {
    if (isElectron) return
    exchangeCodeAndLogin(event.data.code, event.data.state)
    return
  }
  // 2. 飞书 SDK 下发的 tmp_code：用弹窗打开授权页，主窗口不跳转
  if (!xfchatQrLoginObj || typeof xfchatQrLoginObj.matchOrigin !== 'function') return
  if (!xfchatQrLoginObj.matchOrigin(event.origin)) return
  const tmpCode = event.data
  if (tmpCode && xfchatGotoUrl) {
    const sep = xfchatGotoUrl.includes('?') ? '&' : '?'
    const authUrl = `${xfchatGotoUrl}${sep}tmp_code=${encodeURIComponent(tmpCode)}`
    const popup = window.open(authUrl, 'xfchat_oauth', 'width=500,height=600,scrollbars=yes,noreferrer=yes')
    if (!popup) {
      // 被拦截则降级为当前页跳转
      window.location.href = authUrl
    }
  }
}

/**
 * 通过 code 换 token，再请求 user_info 并登录。
 * 参考：open.xfchat.iflytek.com → 获取 user_access_token、authen-v1/user_info/get
 */
async function exchangeCodeAndLogin(code, state) {
  const base = typeof window !== 'undefined' && window.BASEDB ? window.BASEDB : {}
  const redirectUri = base.VITE_XFCHAT_REDIRECT_URI
  try {
    // Electron 环境使用绝对 URL（无 Vite/Nginx 代理），Web 端使用相对路径走代理
    const openDomain = base.VITE_XFCHAT_OPEN_DOMAIN || 'https://open.xfchat.iflytek.com'
    const tokenPath = '/open-apis/authen/v2/oauth/token'
    const userInfoPath = '/open-apis/authen/v1/user_info'
    const userInfoUrl = isElectron ? `${openDomain}${userInfoPath}` : userInfoPath

    // Electron 环境通过主进程 IPC 交换 token（密钥不暴露给渲染进程）
    // Web 端走 nginx 代理，仍使用相对路径
    let tokenData
    if (isElectron) {
      tokenData = await window.electronAPI.auth.xfchatExchangeToken({
        grantType: 'authorization_code',
        code,
        redirectUri,
        openDomain,
      })
    } else {
      const appId = await getXfchatAppId()
      const tokenRes = await post(tokenPath, {
        grant_type: 'authorization_code',
        client_id: appId,
        code,
        redirect_uri: redirectUri,
        state
      })
      tokenData = tokenRes?.data ?? tokenRes
    }
    const accessToken = tokenData?.data?.access_token ?? tokenData?.access_token
    if (!accessToken) throw new Error(tokenData?.msg ?? tokenData?.message ?? '获取 token 失败')

    // 用飞书 access_token 换 portal OAuth token，并存入 userStore（失败不影响后续登录）
    // 使用 fetch + redirect: 'manual'，避免服务端 302 跳转登录页时整页被重定向（导致“第二次授权”）
    let portalToken = null
    try {
      const oneBase = getOneBaseUrl()
      const portalOAuthScope = 'basic'
      // const portalOAuthScope =
      //   'wiki:wiki docx:document drive:drive bitable:app base:app:read base:field:read offline_access'
      const portalTokenRes = await post(
        `${oneBase}/cloudpro/api/user-login/oauth/token/`,
        {
          grant_type: 'feishu_token',
          feishu_access_token: accessToken,
          // client_id: clientId,
          client_id: 'bk_desktop_mac_client_id',
          client_secret: "bk_desktop_mac_secret_key_20260316",
          // client_secret: clientSecret,
          scope: portalOAuthScope,
        }
      )
      console.log(portalTokenRes)
      const portalPayload = portalTokenRes?.data ?? portalTokenRes
      if (portalPayload?.access_token) {
        portalToken = {
          access_token: portalPayload.access_token,
          refresh_token: portalPayload?.refresh_token,
          token_type: portalPayload?.token_type ?? 'Bearer',
          expires_in: portalPayload?.expires_in,
          scope: portalPayload?.scope ?? portalOAuthScope,
        }
      }
    } catch (portalErr) {
      console.warn('[Login] portal OAuth token 获取失败，继续登录', portalErr)
    }

    const userRes = await get(userInfoUrl, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const userData = userRes?.data ?? userRes
    const raw = userData?.data ?? userData
    const name = raw?.name ?? raw?.userName ?? ''
    const userId = raw?.user_id
    const userName = raw?.user_name ?? raw?.open_id ?? raw?.userName ?? name
    if (!name && !userName) throw new Error(raw?.msg ?? raw?.message ?? '获取用户信息失败')

    userStore.setUserInfo({
      name,
      userName,
      userId,
      avatar: raw?.avatar_url ?? raw?.avatar ?? raw?.head_url ?? '',
      role: 'user',
      feishu_access_token: accessToken,
      ...(raw?.open_id && { open_id: raw.open_id }),
      ...(raw?.union_id && { union_id: raw.union_id }),
      ...(portalToken && { ...portalToken })
    })

    // 登录成功，直接触发成功事件
    emit('login-success')
  } catch (e) {
    console.error('[Login] 扫码登录失败', e)
  }
}

function sendCode() {
  if (codeCooldown.value > 0) return
  codeCooldown.value = 60
  codeCooldownTimer = setInterval(() => {
    codeCooldown.value--
    if (codeCooldown.value <= 0) {
      clearInterval(codeCooldownTimer)
    }
  }, 1000)
}

function doLogin(name, userName) {
  userStore.setUserInfo({
    name,
    userName,
    avatar: '',
    role: 'user'
  })
  emit('login-success')
}

function handleAccountLogin() {
  const username = accountForm.username.trim()
  if (!username) return
  doLogin(username, username)
}

function handleCodeLogin() {
  const phone = codeForm.phone.trim()
  if (!phone) return
  doLogin(phone, phone)
}

// visible 变为 true 时重置状态；登出后再登录直接跳到登录页
watch(() => props.visible, (val) => {
  if (val) {
    if (userStore.hasLoggedInBefore) {
      step.value = 3
      stopAutoPlay()
    } else {
      step.value = 0
      startAutoPlay()
    }
    loginTab.value = 'account'
    isQrMode.value = false
    accountForm.username = ''
    accountForm.password = ''
    codeForm.phone = ''
    codeForm.code = ''
    showPassword.value = false
  } else {
    stopAutoPlay()
  }
}, { immediate: true })

// 进入登录页时自动生成二维码（当前页仅扫码登录，进入即初始化）
watch(step, (val) => {
  if (val === 3) {
    nextTick(() => {
      // 再等一帧确保 #xfchat_qr_container 已挂载并可测量
      requestAnimationFrame(() => initXfchatQr())
    })
  }
})

onMounted(() => {
  window.addEventListener('message', handleXfchatMessage, false)
})

onUnmounted(() => {
  window.removeEventListener('message', handleXfchatMessage, false)
  stopAutoPlay()
})
</script>

<style scoped>
/* Overlay */
.login-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

/* Dialog */
.login-dialog {
  position: relative;
  width: 900px;
  max-width: 90vw;
  min-height: 650px;
  border-radius: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dialog-enter 0.4s ease;
}

@keyframes dialog-enter {
  from { opacity: 0; transform: translateY(30px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 跳过按钮 */
.skip-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  font-size: 14px;
  color: #606572;
  cursor: pointer;
  user-select: none;
}

.skip-btn:hover {
  opacity: 0.7;
}

/* Carousel */
.carousel {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 420px;
}

.page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 48px 0;
  overflow-y: auto;
}


/* 整图页面通用样式 */
.page-img {
  padding: 0;
}

.page-img-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-full-img {
  width: 100%;
  height: auto;
  object-fit: contain;
}


/* ===== Page 4: Login ===== */
.page-login {
  align-items: center;
  padding: 0;
  margin-top: 115px;
}

.login-title-img-wrap {
  text-align: center;
  margin-bottom: 8px;
}

.login-title-img {
  height: 80px;
  width: auto;
  object-fit: contain;
}

.login-body {
  position: relative;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 为底部绝对定位的环境条留出空间，避免压住扫码区 */
  padding-bottom: clamp(48px, 8vw, 64px);
  box-sizing: border-box;
}

.login-bg-circle {
  position: absolute;
  top: -40px;
  left: 50%;
  width: auto;
  height: 417px;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 0;
}

.login-crab-area {
  position: relative;
  z-index: 1;
  width: 328px;
  height: auto;
  margin-bottom: -50px;
  margin-left: -75px;
  margin-top: -27px;
}

.login-crab-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center top;
}


/* Login card */
.login-card {
  position: absolute;
  left: 118px;
  top: 105px;
  z-index: 2;
  width: 200px;
  height: 200px;
}

/* Form area */


.form-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px;
  position: absolute;
  top: 118px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}


.form-link {
  font-size: 12px;
  color: #999;
  cursor: pointer;
  text-decoration: none;
}

.form-link:hover {
  color: #f97316;
}

/* QR code area */
.qr-area {
  text-align: center;
  padding-top: 30px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-hint {
  font-size: 8px;
  margin: 0 0 5px;
}

/* 二维码容器：通过 scale 缩小到约 120px 显示 */
.qr-code-box {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  margin: 6px auto;
  overflow: hidden;
  position: relative;
}

.qr-code-box #xfchat_qr_container {
  border: none;
  transform: scale(0.513); /* 234px -> ~120px */
  transform-origin: center center;
}

.qr-code-box .qr-sdk-missing {
  color: #999;
  font-size: 13px;
  padding: 24px 16px;
  margin: 0;
}

.qr-footer {
  font-size: 8px;
  margin: 0;
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
}

.qr-footer .form-link {
  margin-left: 6px;
  font-size: 8px;
  color: #1677ff;
}

/* Electron 飞书登录按钮 */
.electron-login-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.electron-feishu-btn {
  padding: 10px 28px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #3370ff 0%, #2b5fd9 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.electron-feishu-btn:hover {
  opacity: 0.9;
}

.electron-feishu-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
/* 环境切换 — 极简线框风（细线 + 白底 + 中性色） */
.env-switch-wrap {
  position: absolute;
  bottom: calc(clamp(10px, 2vw, 18px) + 30px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: clamp(6px, 1.2vw, 10px);
  white-space: nowrap;
  max-width: calc(100% - clamp(16px, 4vw, 32px));
  padding: clamp(6px, 1.2vw, 8px) clamp(10px, 2.5vw, 12px);
  box-sizing: border-box;
  border-radius: 8px;
  border: none;
  background: transparent;
  box-shadow: none;
  z-index: 2;
}

.env-switch-label {
  flex-shrink: 0;
  font-size: clamp(11px, 1.05vw, 12px);
  font-weight: 500;
  color: #909399;
  line-height: 1;
  white-space: nowrap;
}

/* Element Plus Select：线框样式（加长展示区域） */
.env-select-el.el-select {
  margin-right: 0;
  flex: 0 0 auto;
  width: 100px;
  min-width: 100px;
  max-width: 100px;
}

.env-select-el :deep(.el-select__wrapper) {
  min-height: clamp(28px, 4.2vw, 30px);
  padding: 0 8px 0 10px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 0 0 1px #e4e7ed inset;
  border: none;
  transition: box-shadow 0.15s ease;
}

.env-select-el :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

.env-select-el :deep(.el-select__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #909399 inset;
}

.env-select-el :deep(.el-select__selected-item),
.env-select-el :deep(.el-select__placeholder) {
  font-size: clamp(11px, 1.05vw, 12px);
  font-weight: 500;
  color: #303133;
}

.env-select-el :deep(.el-select__selected-item) {
  font-weight: 600;
}

.env-select-el :deep(.el-select__placeholder) {
  color: #a8abb2;
}

.env-select-el :deep(.el-select__caret) {
  color: #909399;
}

.env-select-el :deep(.el-select__selection) {
  flex-wrap: nowrap;
}
/* Navigation */
.nav-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 48px;
  margin-bottom: 38px;
}
.nav-btn-bg {
  border-radius: 16px;
  background: #F7F7F7;
  padding: 4px 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 232px;
 

}

.nav-btn {
 border-radius: 12px;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 1px solid #E3E3E3;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.03);
  padding: 6px 19px;
   display: flex;
  align-items: center;
}


.nav-btn:hover {
  color: #333;
}

.nav-btn-plain {
  border: none;
  background: none;
  box-shadow: none;
}

/* Dots */
.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 0 0 50px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: #ddd;
  cursor: pointer;
  transition: all 0.3s;
}

.dot.active {
  width: 24px;
  background: #555;
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.35s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(60px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-60px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-60px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(60px);
}

/* Dialog fade */
.dialog-fade-enter-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>

<style>
/* el-select 下拉 Teleport 到 body，popper 需非 scoped */
.env-select-popper {
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.env-select-popper .el-select-dropdown__item {
  font-size: 13px;
  font-weight: 400;
  color: #606266;
}

.env-select-popper .el-select-dropdown__item:hover {
  background-color: #f5f7fa;
}

.env-select-popper .el-select-dropdown__item.is-selected {
  font-weight: 500;
  color: #303133;
  background-color: #f0f2f5;
}
</style>
