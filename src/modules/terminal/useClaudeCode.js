import { useClaudeCodeStore } from '@/modules/terminal/store'

/**
 * Claude Code 工具函数
 * env 状态检查、目录选择等
 */
export function useClaudeCode() {
  const store = useClaudeCodeStore()

  async function checkEnvReady() {
    const ready = await window.electronAPI?.claudeCode.isEnvReady()
    store.setEnvReady(!!ready)
    return !!ready
  }

  async function selectWorkingDir() {
    const dir = await window.electronAPI?.claudeCode.selectDirectory()
    if (dir) store.setDefaultWorkingDir(dir)
    return dir
  }

  return {
    store,
    checkEnvReady,
    selectWorkingDir,
  }
}
