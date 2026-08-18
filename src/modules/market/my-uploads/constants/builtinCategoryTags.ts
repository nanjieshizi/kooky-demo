/**
 * 编辑页「分类标签 / 标签」可选项，与旧接口/历史数据无耦合；展示与提交仅使用本列表中项。多选，数量不限。
 */
export const BUILTIN_CATEGORY_TAGS: readonly string[] = [
  '资产管理',
  '运维监控',
  '成本优化',
  '效能研发',
  '自动化',
  '官方',
  '云计算',
  '产品经理',
  '文档',
  '效率',
  '质量保证',
  '数据分析',
]

const BUILTIN_SET = new Set(BUILTIN_CATEGORY_TAGS)

function parseTagsLoose(tags: unknown): string[] {
  if (tags == null || tags === '') return []
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean)
  }
  return String(tags)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * 从 query / 接口等恢复表单时，只保留仍存在于内置列表中的标签，避免脏数据进表单。
 */
export function sanitizeTagsToBuiltin(tags: unknown): string[] {
  return parseTagsLoose(tags)
    .filter((t) => BUILTIN_SET.has(t))
    .filter((t, i, a) => a.indexOf(t) === i)
}
