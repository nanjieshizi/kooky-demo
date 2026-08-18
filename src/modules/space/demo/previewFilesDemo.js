/**
 * 会话侧区 · 文件预览槽 demo 文件（仅看样式）
 * category: 'artifact'(产物/生成) | 'upload'(用户上传)
 * 文件形状对齐 previewStore.openFile：
 *   { id, name, fileType: md|code|txt|image|html|web|other, content?, localUrl?, web?, placeholder? }
 */

export const PREVIEW_FILES_DEMO = [
  // —— 产物（生成）——
  {
    id: 'pf-prd',
    name: '在线调试需求.md',
    fileType: 'md',
    category: 'artifact',
    lines: 18,
    content:
      '# 工厂在线调试 · 需求文档\n\n## 目标\n让工厂支持**在线调试**，端到端跑通。\n\n## 范围\n- 调试面板 UI\n- 调试会话网关\n- 沙箱隔离（方案 A · 独立沙箱）\n\n## 非目标\n- 本期不做审批态\n\n> 结论：架构走**独立沙箱**，前后端并行开发。',
  },
  {
    id: 'pf-code',
    name: 'debugGateway.js',
    fileType: 'code',
    category: 'artifact',
    lines: 9,
    content:
      "import { createSandbox } from './sandbox'\n\nexport function openDebugSession(taskId) {\n  const box = createSandbox({ isolate: true })\n  return box.attach(taskId)\n}\n",
  },
  {
    id: 'pf-home',
    name: '首页原型（web）',
    fileType: 'web',
    category: 'artifact',
    web: { url: 'http://localhost:3939/preview/home' },
    placeholder: '首页原型 · 调试面板',
  },
  // —— 用户上传 ——
  {
    id: 'pf-shot',
    name: '视觉终稿.png',
    fileType: 'image',
    category: 'upload',
    placeholder: '视觉终稿（截图占位）',
  },
  {
    id: 'pf-notes',
    name: '评审纪要.txt',
    fileType: 'txt',
    category: 'upload',
    lines: 4,
    content: '评审纪要\n- 员清亮：demo 链接早上发群\n- 张月华：沙箱方案通过\n- 待办：补齐联调测试报告',
  },
]
