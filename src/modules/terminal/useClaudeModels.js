/**
 * 从 settings.json 动态读取可用模型列表
 * 用于 ShortcutBar 模型下拉菜单，与 Claude CLI 实际配置保持同步
 */
import { ref, computed } from 'vue'

// 模块级缓存，多个组件共享同一份数据
const cachedEnv = ref(null)

const FALLBACK_OPTIONS = [
  { id: 'opusplan', label: 'Opus Plan (默认)' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
]

function formatModelLabel(modelId) {
  // claude-opus-4-6 → Claude Opus 4.6
  // claude-sonnet-4-6 → Claude Sonnet 4.6
  // claude-haiku-4-5-20251001 → Claude Haiku 4.5.20251001
  const match = modelId.match(/^claude-(\w+)-(.+)$/)
  if (match) {
    const family = match[1].charAt(0).toUpperCase() + match[1].slice(1)
    const version = match[2].replace(/-/g, '.')
    return `Claude ${family} ${version}`
  }
  return modelId
}

export function useClaudeModels() {
  async function loadSettings() {
    try {
      const result = await window.electronAPI?.claudeCode?.readSettings?.()
      if (result?.success && result.data) {
        cachedEnv.value = result.data
      }
    } catch (error) {
      console.warn('[useClaudeModels] 读取 settings.json 失败:', error)
    }
  }

  const modelOptions = computed(() => {
    const settings = cachedEnv.value
    if (!settings) return FALLBACK_OPTIONS

    const options = [{ id: 'opusplan', label: 'Opus Plan (默认)' }]
    const seen = new Set(['opusplan'])

    if (Array.isArray(settings.additionalModelOptionsCache)) {
      for (const opt of settings.additionalModelOptionsCache) {
        const modelId = String(opt?.value || '').trim()
        if (modelId && !seen.has(modelId)) {
          seen.add(modelId)
          options.push({ id: modelId, label: opt?.label || formatModelLabel(modelId) })
        }
      }
    }

    if (Array.isArray(settings.availableModels)) {
      for (const modelId of settings.availableModels) {
        const normalizedModelId = String(modelId || '').trim()
        if (normalizedModelId && !seen.has(normalizedModelId)) {
          seen.add(normalizedModelId)
          options.push({ id: normalizedModelId, label: formatModelLabel(normalizedModelId) })
        }
      }
    }

    const env = settings.env || {}
    // 按 opus → sonnet → haiku 顺序添加，去重
    for (const key of ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']) {
      const modelId = env[key]
      if (modelId && !seen.has(modelId)) {
        seen.add(modelId)
        options.push({ id: modelId, label: formatModelLabel(modelId) })
      }
    }

    return options.length > 1 ? options : FALLBACK_OPTIONS
  })

  function refreshSettings() {
    cachedEnv.value = null
    return loadSettings()
  }

  return { loadSettings, modelOptions, refreshSettings }
}
