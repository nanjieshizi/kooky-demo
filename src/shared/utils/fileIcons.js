/**
 * 文件图标映射工具
 * 根据文件扩展名返回对应的 emoji 图标
 */

// 文件类型图标映射表
const FILE_ICON_MAP = {
  // 前端
  js: '📄',
  ts: '📄',
  jsx: '📄',
  tsx: '📄',
  vue: '💚',
  svelte: '🧡',
  // Python
  py: '🐍',
  // 配置
  json: '📋',
  yaml: '📋',
  yml: '📋',
  // 文档
  md: '📝',
  txt: '📝',
  readme: '📝',
  // Web
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  less: '🎨',
  // 图片
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  bmp: '🖼️',
  ico: '🖼️',
  // 文档
  pdf: '📕',
  docx: '📃',
  doc: '📃',
  // 压缩
  zip: '🗜',
  tar: '🗜',
  gz: '🗜',
  // 脚本
  sh: '💻',
  bash: '💻',
  zsh: '💻',
  // 其他语言
  go: '🔵',
  rs: '🦀',
  java: '☕',
  cpp: '⚙️',
  c: '⚙️',
}

/**
 * 根据文件名获取文件图标
 * @param {string} fileName - 文件名
 * @returns {string} emoji 图标
 */
export function getFileIcon(fileName) {
  if (!fileName) return '📄'
  const ext = fileName.split('.').pop()?.toLowerCase()
  return FILE_ICON_MAP[ext] || '📄'
}

/**
 * 根据文件类型获取文件夹图标
 * @param {boolean} isExpanded - 是否展开
 * @returns {string} emoji 图标
 */
export function getFolderIcon(isExpanded) {
  return isExpanded ? '📂' : '📁'
}
