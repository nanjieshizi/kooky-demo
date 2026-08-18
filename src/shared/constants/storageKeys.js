/**
 * localStorage 键名常量
 *
 * 注意：这些是浏览器本地存储的键名标识符，不是加密密钥或敏感信息
 * 用于在 localStorage 中存储和读取应用状态数据
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 */

/**
 * 用户信息缓存键
 * 存储用户基本信息（用户名、头像等）
 */
export const USER_INFO_STORAGE_KEY = 'super-assistant-userInfo'

/**
 * 飞书文档 Token 键
 * 存储飞书文档访问凭证
 */
export const FEISHU_DOC_TOKEN_KEY = 'feishu_doc_token'

/**
 * 引导页完成标记键
 * 标记用户是否已完成新手引导
 */
export const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted'

/**
 * 助手角色键
 * 存储用户选择的助手角色类型
 */
export const ASSISTANT_ROLE_KEY = 'assistantRole'

/**
 * 助手介绍显示标记键
 * 控制助手介绍弹窗的显示状态
 */
export const ASSISTANT_INTRO_KEY = 'assistantIntro'

/**
 * 环境配置键
 * 存储当前选择的环境（dev/test/pre/prod）
 */
export const ONE_ENV_KEY = 'one_env'

/**
 * 旧版用户信息键（兼容性保留）
 * 用于清理旧版本的用户信息缓存
 */
export const LEGACY_USER_INFO_KEY = 'userInfo'
