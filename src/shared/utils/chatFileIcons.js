/**
 * 聊天附件 / 上传预览用的文件类型图标（@/assets/file）
 */
import fileIconPdf from '@/assets/file/PDF@2x.png'
import fileIconWord from '@/assets/file/Word@2x.png'
import fileIconExcel from '@/assets/file/excel@2x.png'
import fileIconMd from '@/assets/file/md@2x.png'
import fileIconTxt from '@/assets/file/txt@2x.png'
import fileIconPy from '@/assets/file/py@2x.png'
import fileIconJs from '@/assets/file/js@2x.png'
import fileIconHtml from '@/assets/file/html@2x.png'
import fileIconCss from '@/assets/file/css@2x.png'
import fileIconJson from '@/assets/file/json@2x.png'
import fileIconSql from '@/assets/file/sql@2x.png'
import fileIconPic from '@/assets/file/img.svg'

const ICON_BY_TYPE = {
  pdf: fileIconPdf,
  word: fileIconWord,
  excel: fileIconExcel,
  md: fileIconMd,
  txt: fileIconTxt,
  py: fileIconPy,
  js: fileIconJs,
  html: fileIconHtml,
  css: fileIconCss,
  json: fileIconJson,
  sql: fileIconSql,
  image: fileIconPic,
  generic: fileIconTxt,
}

/**
 * @param {string} filename
 * @returns {keyof typeof ICON_BY_TYPE}
 */
export function getChatFileTypeFromName(filename) {
  const base = (filename || '').split(/[/\\]/).pop() || ''
  const i = base.lastIndexOf('.')
  const ext = i > 0 ? base.slice(i + 1).toLowerCase() : ''
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt'].includes(ext)) return 'word'
  if (['xls', 'xlsx'].includes(ext)) return 'excel'
  if (ext === 'md') return 'md'
  if (ext === 'txt') return 'txt'
  if (ext === 'py') return 'py'
  if (['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'vue', 'svelte'].includes(ext)) return 'js'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return 'css'
  if (ext === 'json') return 'json'
  if (ext === 'sql') return 'sql'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'generic'
  if (['ppt', 'pptx'].includes(ext)) return 'generic'
  if (['mp3', 'mp4', 'wav', 'mov', 'avi'].includes(ext)) return 'generic'
  return 'generic'
}

/**
 * @param {string} type - getChatFileTypeFromName 返回值，或历史数据中的 doc / image 等
 * @returns {string} 图标 URL（构建后）
 */
export function getChatFileIconSrc(type) {
  if (!type) return ICON_BY_TYPE.generic
  const normalized = type === 'doc' ? 'word' : type
  return ICON_BY_TYPE[normalized] ?? ICON_BY_TYPE.generic
}
