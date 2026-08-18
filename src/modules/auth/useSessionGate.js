import { useUIStore } from '@/modules/space/uiStore'
import { useUserStore } from '@/modules/auth/store'
import { useImConnectionStore } from '@/modules/shared/store/imConnection'
import { fetchClaudeApiKey } from '@/modules/terminal/claudeKeyService'
import { registerClient } from '@/shared/services/imApi'
import { getOneEnv } from '@/shared/utils/oneEnv'

/**
 * 登录成功后初始化 Matrix IM
 */
export function useSessionGate() {
  const uiStore = useUIStore()
  const userStore = useUserStore()
  const connectionStore = useImConnectionStore()

  async function handleLoginSuccess() {
    if (!userStore.isLoggedIn) return

    uiStore.setImConnecting(true)
    uiStore.setImReady(false)

    try {
      console.log('handleLoginSuccess', userStore.userInfo)
      const accessToken = userStore.userInfo?.access_token

      // 注册 KC 客户端（确保后端分配 IM 实例）
      try {
        await registerClient(accessToken, {
          bindImUserId: userStore.userInfo?.userId,
          env: getOneEnv(),
          feishuToken: userStore.userInfo?.feishu_access_token || '',
          userAvatar: userStore.userInfo?.avatar || '',
        })
      } catch (e) {
        console.warn('[SessionGate] registerClient 失败，继续连接:', e?.message)
      }

      await connectionStore.connect({
        accessToken,
        userId: userStore.userInfo?.userId,
      })
    } catch (e) {
      console.error('[SessionGate] init IM 失败:', e?.code, e?.message)
    }

    uiStore.setImConnecting(false)
    // 兜底：onConnection 回调未触发时补充加载 agent
    const { useAgentStore } = await import('@/modules/agent/store')
    const agentStore = useAgentStore()
    await agentStore.loadAgents()
    setTimeout(() => { uiStore.setImReady(true) }, 300)
    try {
      const keyInfo = await fetchClaudeApiKey(userStore.userInfo)
      await window.electronAPI?.claudeCode.setupEnv(keyInfo.env, keyInfo.modelList)
    } catch (e) {
      console.error('[SessionGate] Claude Code env 注入失败:', e)
    }
  }

  return { handleLoginSuccess }
}
