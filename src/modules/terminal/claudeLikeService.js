import api, { getSsoToken } from '@/shared/services/api'
import { getOneBaseUrl } from '@/shared/utils/oneEnv'

/** Claude Code 点赞/点踩：与 one 环境一致，使用 getOneBaseUrl() 拼完整 URL（axios 绝对 URL 不叠加 api baseURL） */
const LIKE_API_PATH = '/assistant/llmFeedback/apis/like.kc.iflytek.com/v1/likes'

function getClaudeLikeApiUrl() {
  return `${getOneBaseUrl()}${LIKE_API_PATH}`
}

/** 获取用户 ID：从 localStorage 读取 */
function getStoredUserId() {
  try {
    const raw = localStorage.getItem('super-assistant-userInfo')
    if (raw) {
      const userInfo = JSON.parse(raw)
      return (
        userInfo?.userId ||
        userInfo?.portalToken?.userId ||
        ''
      )
    }
  } catch {
    // ignore
  }
  return ''
}

/**
 * @param {{ comment: string, rating: number, responseId: string, sessionId: string }} p
 * @returns {Promise<unknown>}
 */
export function submitClaudeCodeLike(p) {
  const { comment, rating, responseId, sessionId } = p
  const token = getSsoToken()
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return api.post(
    getClaudeLikeApiUrl(),
    {
      likeDetail: {
        comment: comment ?? '',
        rating: rating ?? 0,
      },
      response_id: String(responseId ?? ''),
      session_id: String(sessionId ?? ''),
      user_name: getStoredUserId(),
    },
    { headers }
  )
}
