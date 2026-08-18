import * as Sentry from '@sentry/vue'

/**
 * 从 localStorage 获取用户信息
 */
function getUserInfoFromStorage() {
  try {
    const stored = localStorage.getItem('super-assistant-userInfo')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[Sentry] 获取用户信息失败:', error)
  }
  return null
}

/**
 * 初始化 Sentry
 * @param {Object} app - Vue app 实例
 */
export function initSentry(app) {
  // 从环境变量获取 DSN，区分开发/生产环境
  const dsn = import.meta.env.VITE_SENTRY_DSN || 'http://20a08abb3dd40ae3351ee4fc7648bbb3@172.29.156.145:9000/6'
  // 从 package.json 读取版本号
  const version = __APP_VERSION__
  const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'production'
  Sentry.init({
    app,
    dsn,
    environment,
    release: `kooky@${version}`,

    // 性能监控采样率 (0.0 - 1.0)
    tracesSampleRate: 0.1,

    // Replay 采样率
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // 集成配置
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // 错误过滤和用户信息注入
    beforeSend(event, hint) {
      // 过滤掉一些不需要上报的错误
      const error = hint.originalException

      // 忽略网络错误
      if (error && error.message && error.message.includes('Network Error')) {
        return null
      }

      // 自动注入用户信息（域账号）
      const userInfo = getUserInfoFromStorage()
      if (userInfo) {
        event.user = {
          id: userInfo.userId || userInfo.user_id,
          username: userInfo.userName || userInfo.user_name || userInfo.name,
          email: userInfo.email,
          // 域账号信息
          domain_account: userInfo.userName || userInfo.user_name,
        }

        // 添加额外的用户上下文
        event.contexts = event.contexts || {}
        event.contexts.user_info = {
          name: userInfo.name,
          userId: userInfo.userId,
          userName: userInfo.userName,
          role: userInfo.role,
        }
      }

      return event
    },
  })

  // 初始化时设置用户信息
  const userInfo = getUserInfoFromStorage()
  if (userInfo) {
    updateSentryUser(userInfo)
  }
}

/**
 * 更新 Sentry 用户信息
 * @param {Object} userInfo - 用户信息对象
 */
export function updateSentryUser(userInfo) {
  if (!userInfo) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: userInfo.userId || userInfo.user_id,
    username: userInfo.userName || userInfo.user_name || userInfo.name,
    email: userInfo.email,
    // 域账号信息
    domain_account: userInfo.userName || userInfo.user_name,
  })

  // 设置额外的标签
  if (userInfo.userName) {
    Sentry.setTag('domain_account', userInfo.userName)
  }
  if (userInfo.role) {
    Sentry.setTag('user_role', userInfo.role)
  }
}

/**
 * 手动捕获异常
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * 手动发送消息
 * @param {String} message - 消息内容
 * @param {String} level - 日志级别 (info, warning, error)
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * 设置用户信息
 * @param {Object} user - 用户信息
 */
export function setUser(user) {
  Sentry.setUser(user)
}

/**
 * 设置标签
 * @param {String} key - 标签键
 * @param {String} value - 标签值
 */
export function setTag(key, value) {
  Sentry.setTag(key, value)
}

/**
 * 设置上下文
 * @param {String} name - 上下文名称
 * @param {Object} context - 上下文数据
 */
export function setContext(name, context) {
  Sentry.setContext(name, context)
}
