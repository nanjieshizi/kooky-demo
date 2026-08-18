/**
 * Skill 格式化辅助方法（独立实现，对齐 deerflow _buildSkillItems / _extractSkills）
 */

/**
 * 将 skill 数组转为后端 skill_id 字段格式。
 * 等价 deerflow store._buildSkillItems
 * @param {Array<{ slug: string, displayName?: string, name?: string, avatar?: string, image?: string }>} skills
 * @returns {object|Array|null} 单 skill 返回对象，多 skill 返回数组，空返回 null
 */
export function buildEmployeeSkillItems(skills) {
  if (!skills || skills.length === 0) return null
  const items = skills
    .map(s => ({
      slug: s.slug,
      name: s.displayName || s.name || s.slug,
      avatar: s.avatar || s.image || '',
    }))
    .filter(item => item.slug)
  if (items.length === 0) return null
  return items.length === 1 ? items[0] : items
}

/**
 * 从 LangGraph 消息的 additional_kwargs.skill_id 提取 skill 列表。
 * 等价 deerflow store._extractSkills
 * @param {object} msg LangGraph 原始消息
 * @returns {Array<{ slug: string, displayName: string, name?: string, avatar?: string }>}
 */
export function extractSkillsFromEmployeeMessage(msg) {
  const raw = msg?.additional_kwargs?.skill_id
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .map(item => {
      if (typeof item === 'string') {
        const slug = item.trim()
        return slug ? { slug, displayName: slug } : null
      }
      if (item && typeof item === 'object') {
        const slug = item.slug || item.id
        if (!slug) return null
        const name = item.name || item.displayName || slug
        return { slug, name, displayName: name, avatar: item.avatar || '' }
      }
      return null
    })
    .filter(Boolean)
}
