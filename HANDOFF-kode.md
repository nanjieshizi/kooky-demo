# Kode 工作交接文档

> 给新会话的 Boom 看。这是 Pata（产品负责人）跟你一起搭 Kode demo 的延续。
> 读完应能直接接手，不用从零摸索。

## ⚠️ 最高规则（CLAUDE.md rule #1）
**改前先对齐** —— 不要凭直觉改，先把方案/选项摆给 Pata，他拍板再动手。
Pata 是产品视角，技术话题讲架构、给选项对比，不要贴大段代码。

## 工程基础

- 项目：`/Users/pata/Agent/Claude/工作区/产品/Kooky/代码工程/kooky-pata`（Electron + Vue3 + Vite + Pinia）
- 起 electron：`npm run electron:dev`（普通）/ `npm run electron:dev:dom`（带 9222 调试端口，**自己验证时用这个**）
- **build 是底线但不充分**：`npm run build` 过 ≠ 运行没问题。Vue 模板引用未定义属性、运行时错误 build 抓不到，必须实测
- **自验证手段（重要）**：electron 改动看不了 web preview。用 CDP 直连 renderer：
  - 起 `electron:dev:dom` → `curl http://localhost:9222/json` 拿 Kooky page 的 webSocketDebuggerUrl
  - Node 25 有内置 WebSocket，写脚本连 CDP：`Runtime.evaluate` 查 DOM、`Input.dispatchMouseEvent` 模拟点击、`Page.captureScreenshot` 截图
  - 抽视频帧用 swift + AVAssetImageGenerator（无 ffmpeg）
  - 这套救过命：靠它精准定位过 `[Vue warn] statusIcon` 一行残留导致全局卡死
- 打 demo 包给别人：`npm run build:demo:mac`（出 Kooky-pata.dmg，独立 app + 屏蔽自动更新）

## Kode 当前架构（Kode A = 我们一起做的主方案）

入口：主壳 nav 'cli'（uiStore.claudeCodeActive）→ `src/modules/kode/KodeView.vue`

### 三种任务执行形态（由 task.type / task.mode 决定）
| 形态 | 触发 | 右半屏渲染 | 文件 |
|---|---|---|---|
| **任务模式** | mode='kode' | 编辑/处理 2 Tab + 右栏 todolist/产物 | DecomposeTab / ProcessTab / KodeRightPanel |
| **IDE 模式** | mode='ide' | VSCode 风格工作台 | `IdeWorkbench.vue` |
| **工厂模式** | type='Agent开发' | 嵌入工厂 | `FactoryEmbed.vue`（用 `@/modules/factory`） |

### 模式切换（已定稿，别再改架构）
- **统一固定顶部条**（KodeView 层）：任务标题 + **右上角切换按钮**（💻 IDE / 📝 任务）
- 切换按钮**位置固定**（Pata 强调多次），Agent开发任务时按钮置灰 + hover 提示"不支持 IDE"
- 顶部条不动、只下面内容区切换 → 用 `<Transition name="mode-fade">` **纯 opacity 交叉淡入**（0.26s）
- **关键教训**：clip-path 雨刮器 / 飞行 overlay（动 left/right）都会卡成 PPT，已废弃。只用 opacity（GPU 合成）才丝滑。Design 那版也是 opacity crossfade
- C 方案：同一任务 kode/ide 双模式**共存不丢数据**（currentMode + switchMode in useKodeState）

### IdeWorkbench 已实现（VSCode 高保真，浅色 Kooky 风，无黑色活动栏）
文件树(Git M/A 标记) + 编辑器(Tab/Breadcrumb/Minimap/行内问题波浪线) + 右栏 Kode 对话 ↔ 预览**切换**(非 tab，artifact 模式，iframe srcdoc 真 HTML 可交互) + 底部 CLI(折叠) + 状态栏(浅色非 VSCode 蓝)。⌘P 文件搜索 / ⌘⇧P 命令面板。预览触发：Kode 聊天文件卡 / 文件树右键 / 头部 🌐

### 任务状态机（已收敛，别加 ready/failed）
- **常规任务卡 = 无状态文字 + 勾选框**（待办，含 ide 模式）
- **只有走批量执行流程**才有 running/waiting/paused（status-pip 显示）
- done = ✓ 已完成
- 筛选只有「未完成 / 已完成」两个 tab
- **Agent开发任务不可批量**：leadType 返回 'agent' 显示 🏭 不显示勾选框，toggleCheck 也拒绝

### 左栏（KodeLeftList）
- 顶部「+新建任务」「+工作区」；筛选 未完成/已完成；ws 分组（agent workspace 已从左栏过滤掉）
- 任务卡可拖到 CLI 输入框（buildCliDragPrompt：只 briefing+附件，不含 todolist）

## Kode B（汇报对比用的第二套设计，刚合并进来）

- 来源：`/Users/pata/Agent/Claude/工作区/产品/Kooky/代码工程/fe-super-assistant-design_agent_creator_0601 2`（v0.0.89）
- **整个模块复制进 `src/modules/kode-b/`**（KodeHomePage + KodeAgentList + KodeFactoryWorkspace + **KodeModeFab** 浮动切换钮，跟 A 完全不同的设计）
- 它依赖的新版 factory 也复制成了 **`src/modules/factory-b/`**（避免动 Kode A 用的 factory）
- **隔离改造**（防串味，已做）：
  - kode-b 的 `KODE_STATE_KEY = 'kode-b-state'`（A 是 'kode-state'）
  - factory-b 的 `defineStore('factory-b')`（A 是 'factory'）
  - kode-b 里 `@/modules/factory/` 全改成 `@/modules/factory-b/`
- **接入主壳**（4 处）：
  - `navigation/config.js`：加 `{ key: 'cli-b', label: 'Kode B' }`
  - `uiStore.js`：加 `claudeCodeBVisible/Active` + `openClaudeCodeB()`
  - `WorkspaceSidebar.vue`：navIconMap['cli-b']、onPrimaryNavClick 'cli-b' 分支、isPrimaryItemActive 'cli-b'
  - `HomeView.vue`：加第二个 host `v-show="claudeCodeBActive"` 渲染 `KodeViewB`
- **A/B 必须互斥**（踩过坑）：两个 host 同位置 v-show，同时亮会叠加污染。所有切换入口都要清对面：
  - `toggleClaudeCode`（Kode A 点击入口！别漏）+ `openClaudeCode` → 清 B
  - `openClaudeCodeB` → 清 A
  - `backgroundClaudeCode`（切其他 nav）→ 清 A+B

## 关联模块：我的资产（市场 → my-uploads → 数字人）

- 文件：`src/modules/market/my-uploads/MyAssetsView.vue`
- 已做 **B2 方案**：数字人 tab 是 `[🏭 我开发的] ┃ [我的员工] [我的发布]`
  - 「我开发的」= 工厂源文件（linkType='factory'），橙色高亮主 tab，竖线分隔，默认落它
  - 概览显示：源文件数 / 工厂在建 / 已发布 / 已聘用
- **产品模型（Pata 拍板）**：工厂蓝图是"源/资产主体"，可持续迭代多版本，选任意版本**发布到市场**或**聘用为员工**。发布后数据解耦（市场是独立快照）

## 🔥 进行中 / 未决（新会话可能要接的）

1. **新建任务做"新数字人"怎么配** —— 当前 NewTaskModal 的 Agent开发类型只能"关联已有数字人"，没有"新建"入口。未拍板：数字人出生地在工厂(B) / Kode也能生(A/C)。**先对齐再做**
2. **Kode 架构的根本矛盾**（Pata 提的，重要）：任务模式=云端拆 todolist→本地 CC 执行，IDE 模式=本地 CC 直接对话。两边对话割裂；而且"云端拆解层"读不到本地代码、架空了 CC 自带的拆解能力。Pata 在质疑"云端拆解"这层到底为谁存在（A 给非技术者 / B 编排 / C 留痛 / D 没想清）。**这是产品级讨论，没结论前别动这块**

## 关联 memory（在 ~/.claude 的 memory 里）
- kode-demo.md / kooky-overview.md / kode-factory-cli-handoff.md（部分已过时，以本文档为准）

## 给新会话的开场建议
不要一上来就改代码。先读这份 + 问 Pata 现在要推进哪块。改任何 Kode 视觉/交互前，先把选项摆出来对齐。涉及"云端拆解层"或"数字人出生地"的，是产品决策，先聊清楚。
