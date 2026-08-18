// 使用 Vite glob 导入 ava 目录下所有 PNG 头像
const avatarModules = import.meta.glob('../assets/ava/*.png', { eager: true })

/**
 * 生成默认头像列表，取 assets/ava 目录下所有 PNG 图片
 * @returns {string[]} 头像 URL 列表
 */
export function generateDefaultAvatars() {
  return Object.values(avatarModules).map((mod) => mod.default)
}
