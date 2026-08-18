import { usePrivateStore } from '@/modules/private/store'
import { useUIStore } from '@/modules/space/uiStore'
import { useUserStore } from '@/modules/auth/store'
import { ElMessage } from 'element-plus'

/**
 * 统一的"发起私聊"入口
 * 处理幂等、切换导航、高亮 tab 的完整流程
 */
export function useStartPrivateChat() {
  const privateStore = usePrivateStore()
  const uiStore = useUIStore()
  const userStore = useUserStore()

  /**
   * 发起私聊（幂等）
   * @param {object} member - 用户对象
   *   需要包含：userName | user_name | username | account（用作 target_user_name）
   */
  async function startChat(member) {
    const targetUserName =
      member.userName || member.user_name || member.username || member.account || ''
    if (!targetUserName) {
      ElMessage.warning('无法识别目标用户')
      return
    }

    const myUserName = userStore.userInfo?.account || userStore.userInfo?.username || ''
    if (myUserName && myUserName === targetUserName) {
      ElMessage.info('不能与自己开始私聊')
      return
    }

    try {
      const chat = await privateStore.startPrivateChat({ targetUserName })
      if (!chat) {
        console.warn('[useStartPrivateChat] startPrivateChat 返回空值')
        ElMessage.warning('无法创建私聊会话')
        return
      }

      const navKey = `private-${chat.conversationId}`
      uiStore.backgroundAllCli()
      uiStore.expandSidebar()
      uiStore.setActiveNavigation('collaboration', navKey)

      await privateStore.selectChat(chat.conversationId)
    } catch (error) {
      console.error('[useStartPrivateChat] 发起私聊失败:', error)
      ElMessage.error('发起私聊失败，请稍后重试')
    }
  }

  return { startChat }
}
