import { getActivePinia } from 'pinia'
import router from '@/app/router'
import { useUserStore } from '@/modules/auth/store'
import { useUIStore } from '@/modules/space/uiStore'

/**
 * 鉴权失效：清会话、复位 UI，router 回首页由 LoginDialog 承接登录。
 * 勿用 location.href='/'，子路径部署会白屏。
 * @param {{ notifyParent?: boolean }} [options]
 */
export function redirectToLogin(options = {}) {
  if (import.meta.env.MODE === 'devlocal') {
    console.warn('[devlocal] 鉴权失效，已跳过 redirectToLogin / logout（请检查 VITE_LOCAL_AUTH_TOKEN）')
    return
  }
  const { notifyParent = true } = options
  if (notifyParent && typeof window !== 'undefined' && window.self !== window.top) {
    window.parent.postMessage({ type: 'auth-expired' }, '*')
  }
  const pinia = getActivePinia()
  if (pinia) {
    useUserStore(pinia).logout()
    const ui = useUIStore(pinia)
    ui.setImConnecting(false)
    ui.setImReady(false)
  } else if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('super-assistant-userInfo')
  }
  router.replace({ name: 'Home' }).catch(() => {})
}
