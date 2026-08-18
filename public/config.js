window.BASEDB = {
  VITE_SSO_URL: 'https://one.iflytek.com/login',
  VITE_SSO_OUT_URL: 'https://one.iflytek.com/login/logout/',
  VITE_BASE_URL: 'https://one.iflytek.com',
  VITE_BASE_SSO_LOGIN: 'https://sso.iflytek.com/login',
  VITE_BASE_SSO_SERVICE: 'https://one.iflytek.com/login/',
  // 飞书扫码登录（参考 open.xfchat.iflytek.com 文档）
  // APP_ID 和 APP_SECRET 已迁移至 Electron 主进程，渲染进程通过 IPC 获取
  VITE_XFCHAT_AUTH_DOMAIN: 'https://passport.xfchat.iflytek.com',
  VITE_XFCHAT_OPEN_DOMAIN: 'https://open.xfchat.iflytek.com',
  // 重定向 URL：须与 open.xfchat.iflytek.com 应用「安全设置」里配置的地址完全一致，否则会报 4401。
  // Web 端：origin + '/super-assistant/auth/callback'
  // Electron 端：使用固定回调地址（不会真正跳转，仅用于 OAuth 参数匹配）
  VITE_XFCHAT_REDIRECT_URI: (function () {
    // Electron 环境：origin 为 file:// 或 http://localhost，使用飞书开放平台注册的固定回调地址
    if (typeof window !== 'undefined' && window.electronAPI) {
      return 'https://one-dev.iflytek.com/super-assistant/auth/callback'
    }
    // Web 端：动态拼接当前 origin
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + '/super-assistant/auth/callback'
    }
    return ''
  })(),
  // 用 code 换用户信息：填相对路径，由 nginx 代理到后端，避免跨域。例：'/api/xfchat/exchange' 或 '/apis/auth/xfchat-exchange'
  VITE_XFCHAT_EXCHANGE_URL: '/open-apis/authen/v2/oauth/token',

  // ========== IM 配置（HTTP + WebSocket 实现） ==========
  // IM 地址自动使用 one 环境切换的 baseUrl（one-dev / one-test / one）
  // WebSocket 地址自动推导为 ws://host/kooky-api/api/ws

  // Matrix Homeserver 地址（保留用于 Matrix 实现）
  VITE_MATRIX_BASE_URL: 'https://one.iflytek.com',
}
