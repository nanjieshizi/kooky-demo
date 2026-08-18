/** 助手工具块展示名与参数格式化（MessageItem / GroupMessageItem 共用） */

const TOOL_DISPLAY_NAMES = {
  search: '搜索',
  read_file: '读取文件',
  write_file: '写入文件',
  execute: '执行命令',
  web_search: '网页搜索',
  code_interpreter: '代码解释器',
  browser: '浏览器',
  terminal: '终端',
}

export function getAssistantToolDisplayName(toolName) {
  return TOOL_DISPLAY_NAMES[toolName] || toolName
}

export function formatAssistantToolInput(input) {
  if (typeof input === 'string') return input
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}
