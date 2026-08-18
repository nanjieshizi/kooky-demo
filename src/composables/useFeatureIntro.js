import { ref } from 'vue'
import {
  shouldShowFeatureIntro,
  readLastSeenVersion,
  writeLastSeenVersion,
} from '@/modules/terminal/utils/featureIntroTrigger.mjs'
import { CLI_INTRO_VERSION, CLI_INTRO_DEBUG, FEATURE_INTRO_PAGES } from '@/modules/terminal/data/featureIntroPages'

/**
 * 功能介绍悬浮层状态管理
 * - `visible`: 响应式 ref，控制 overlay 显示
 * - `checkAndShow()`: 在适合时机调用（例如 CLI view onMounted），决定是否弹出
 * - `dismiss()`: 关闭 overlay 并持久化已看版本号
 * - `pages`: 页面数据数组
 * - `version`: 当前 CLI_INTRO_VERSION（调试/测试用）
 */
export function useFeatureIntro() {
  const visible = ref(false)

  function getStorage() {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null
    } catch {
      return null
    }
  }

  function checkAndShow() {
    if (CLI_INTRO_DEBUG) {
      visible.value = true
      return
    }
    const storage = getStorage()
    const lastSeen = readLastSeenVersion(storage)
    if (shouldShowFeatureIntro(lastSeen, CLI_INTRO_VERSION)) {
      visible.value = true
    }
  }

  function dismiss() {
    const storage = getStorage()
    writeLastSeenVersion(storage, CLI_INTRO_VERSION)
    visible.value = false
  }

  return {
    visible,
    checkAndShow,
    dismiss,
    pages: FEATURE_INTRO_PAGES,
    version: CLI_INTRO_VERSION,
  }
}
