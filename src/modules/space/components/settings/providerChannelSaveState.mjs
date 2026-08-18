function trimValue(value) {
  return String(value ?? '').trim()
}

function getModelCode(model) {
  return trimValue(model?.modelCode ?? model?.model_code)
}

function getDisplayName(model) {
  return trimValue(model?.displayName ?? model?.modelName ?? model?.model_name)
}

export function hasProviderModelInput(model) {
  return Boolean(getModelCode(model) || getDisplayName(model))
}

export function hasCompleteProviderModel(model) {
  return Boolean(getModelCode(model) && getDisplayName(model))
}

export function getProviderModelRowsWithInput(models) {
  return Array.isArray(models) ? models.filter(hasProviderModelInput) : []
}

export function getCompleteProviderModelRows(models) {
  return Array.isArray(models) ? models.filter(hasCompleteProviderModel) : []
}

export function getProviderChannelSaveState({ apiKey, models, enabled }) {
  const trimmedApiKey = trimValue(apiKey)
  const enteredModels = getProviderModelRowsWithInput(models)
  const completeModels = getCompleteProviderModelRows(models)
  const empty = !trimmedApiKey && enteredModels.length === 0

  return {
    apiKey: trimmedApiKey,
    enteredModels,
    completeModels,
    empty,
    enabled: !empty && Boolean(enabled),
  }
}
