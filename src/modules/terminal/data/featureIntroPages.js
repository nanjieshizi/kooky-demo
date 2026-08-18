// 功能介绍悬浮层的数据定义
//
// CLI_INTRO_VERSION 是独立的"宣传活动版本号"，**不**跟随 KC 客户端或 Claude CLI 版本。
// 只有当开发者确实想推广新功能时才手动 bump（并替换 FEATURE_INTRO_PAGES 为最新内容）。
// 平常的 bug 修复、性能优化都不动这个数字。

import statusBarImage from '@/assets/feature-intro/status-bar.svg'
import sessionPersistenceImage from '@/assets/feature-intro/session-persistence.svg'
import permissionModelSwitchImage from '@/assets/feature-intro/permission-model-switch.svg'
import workspaceHierarchyImage from '@/assets/feature-intro/workspace-hierarchy.svg'
import forkAndTeamsImage from '@/assets/feature-intro/fork-and-teams.svg'
import kcControlPlaneImage from '@/assets/feature-intro/kc-control-plane.svg'
import pluginsEcosystemImage from '@/assets/feature-intro/plugins-ecosystem.svg'

export const CLI_INTRO_VERSION = 1

// 调试模式：每次重启客户端都显示介绍页，跳过版本号检查。生产保持 false。
export const CLI_INTRO_DEBUG = false

// 首版 7 页按"静态感知 → 动态交互 → 高级功能"递进排序
export const FEATURE_INTRO_PAGES = [
  {
    id: 'status-bar',
    image: statusBarImage,
    title: '一屏掌控 Claude 状态',
    description: '底部信息栏实时显示模型、上下文百分比圆环、正在执行的工具和 todos 进度，一眼看清 AI 在干什么。',
    accent: '#58a6ff',
  },
  {
    id: 'session-persistence',
    image: sessionPersistenceImage,
    title: '关机不怕，随时回来',
    description: '关闭应用后，工作现场结构与 Claude 会话会自动恢复，下次打开就像从未离开。',
    accent: '#3fb950',
  },
  {
    id: 'permission-model-switch',
    image: permissionModelSwitchImage,
    title: '一键切换权限与模型',
    description: '点击底部权限模式或模型名，瞬间切换 Default/Accept/Plan/Bypass 和 OpusPlan/Opus/Sonnet，无需重启 Claude。',
    accent: '#FF6B35',
  },
  {
    id: 'workspace-hierarchy',
    image: workspaceHierarchyImage,
    title: '四级工作区，项目秒切',
    description: 'Workspace → Workbench → Tab → Pane 四级组织，左侧栏任意拖拽排序，右键重命名，多任务并行不混乱。',
    accent: '#d29922',
  },
  {
    id: 'fork-and-teams',
    image: forkAndTeamsImage,
    title: '会话 Fork 与 Agent Team',
    description: '从任意历史节点分叉新对话；ko teams 自动分屏 leader + teammates，多 Agent 协作一屏可见。',
    accent: '#a371f7',
  },
  {
    id: 'kc-control-plane',
    image: kcControlPlaneImage,
    title: 'kc 命令：让 AI 操控终端',
    description: '通过 kc CLI 让 Claude 远程控制其他终端：新开/分屏/读取内容/发送命令，AI 编排多终端工作流。',
    accent: '#f85149',
  },
  {
    id: 'plugins-ecosystem',
    image: pluginsEcosystemImage,
    title: '顶级插件，开箱即用',
    description: '预置 Superpowers、GitNexus 等社区 Top 级开源插件，调试、规划、代码审查等工作流即装即用，无需手动配置。',
    accent: '#79c0ff',
  },
]
