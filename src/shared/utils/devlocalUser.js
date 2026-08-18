/**
 * devlocal：内存注入登录态（不写 localStorage），配合 LoginDialog 不展示。
 */
export function isDevlocalMode() {
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'devlocal'
}

export function applyDevlocalMockUser(userStore) {
  if (!isDevlocalMode() || !userStore) return
  const token = String(import.meta.env.VITE_LOCAL_AUTH_TOKEN || '').trim()
  if (!token) {
    console.warn('[devlocal] 未设置 VITE_LOCAL_AUTH_TOKEN，IM/API 可能失败；可在 .env.devlocal.local 配置')
    return
  }
  userStore.$patch({
    userInfo: {
      name: 'Local Dev',
      userName: 'local-dev',
      userId: 'local-dev',
      access_token: token,
      role: 'user',
      avatar: '',
    },
    hasLoggedInBefore: true,
    onboardingCompleted: true,
  })
}
