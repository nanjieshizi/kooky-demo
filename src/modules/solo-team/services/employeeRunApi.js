import api, { getSsoToken } from '@/shared/services/api'

function getAuthHeaders() {
  const token = getSsoToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Solo-team Run 生命周期 API（独立实现，不引用 deerflow 代码）。
 * 路径与 deerflow threadApi 中 Run 相关方法一致，均走 /kooky-api/api/langgraph/threads/${id}/runs。
 */
export const employeeRunApi = {
  /**
   * 创建后台运行（走 BFF 代理）
   */
  async createRun(langgraphThreadId, input, context = {}) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs`, {
      input,
      context,
      stream_mode: ['values'],
      on_disconnect: 'continue',
    }, { headers: getAuthHeaders() })
  },

  /**
   * 创建同步运行（等待完成，走 BFF 代理）
   */
  async createRunWait(langgraphThreadId, input, context = {}) {
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/wait`, {
      input,
      context,
    }, { headers: getAuthHeaders() })
  },

  /**
   * 获取运行列表（走 BFF 代理）
   */
  async getRuns(langgraphThreadId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs`, { headers: getAuthHeaders() })
  },

  /**
   * 获取运行详情（走 BFF 代理）
   */
  async getRun(langgraphThreadId, runId) {
    return api.get(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}`, { headers: getAuthHeaders() })
  },

  /**
   * 取消运行（走 BFF 代理）
   */
  async cancelRun(langgraphThreadId, runId, options = {}) {
    const { wait = false, action = 'interrupt' } = options
    return api.post(`/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}/cancel`, null, {
      headers: getAuthHeaders(),
      params: { wait, action },
    })
  },

  /**
   * 加入已有运行的 SSE 流（返回 URL，由 StreamManager 消费）
   */
  joinRun(langgraphThreadId, runId) {
    return `/kooky-api/api/langgraph/threads/${langgraphThreadId}/runs/${runId}/join`
  },
}
