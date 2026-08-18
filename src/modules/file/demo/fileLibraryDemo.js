/**
 * 工具栏「文件」库 · demo 数据（用户自己的文件库，不分云端/本地）
 * type: md | pdf | xlsx | docx | png | ppt | txt | other
 */

export const FILE_LIBRARY_FOLDERS = [
  {
    id: 'fd-refactor',
    name: '文件功能重构',
    files: [
      { id: 'f-md-1', name: '文件功能重构方案.md', type: 'md', size: '18 KB', bytes: 18432 },
      { id: 'f-pdf-1', name: 'Kooky 产品体验周报.pdf', type: 'pdf', size: '2.4 MB', bytes: 2516582 },
    ],
  },
  {
    id: 'fd-research',
    name: '用户研究',
    files: [],
  },
]

export const FILE_LIBRARY_FILES = [
  { id: 'f-xlsx-1', name: '竞品功能对比.xlsx', type: 'xlsx', size: '846 KB', bytes: 866304 },
  { id: 'f-docx-1', name: '访谈记录.docx', type: 'docx', size: '126 KB', bytes: 129024 },
  { id: 'f-png-1', name: '文件信息架构.png', type: 'png', size: '1.8 MB', bytes: 1887436 },
]

/** 文件类型 → 角标色 + 短标 */
export const FILE_TYPE_META = {
  md: { label: 'MD', color: '#3370ff', bg: 'rgba(51,112,255,0.12)' },
  pdf: { label: 'PDF', color: '#e5484d', bg: 'rgba(229,72,77,0.12)' },
  xlsx: { label: 'XLS', color: '#1a9e75', bg: 'rgba(26,158,117,0.12)' },
  docx: { label: 'DOC', color: '#3370ff', bg: 'rgba(51,112,255,0.12)' },
  ppt: { label: 'PPT', color: '#d85a30', bg: 'rgba(216,90,48,0.12)' },
  png: { label: 'IMG', color: '#8478fa', bg: 'rgba(132,120,250,0.14)' },
  txt: { label: 'TXT', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  other: { label: '文件', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}
