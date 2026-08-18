# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 项目概述

**AgentOS Desktop (fe-super-assistant)** 是基于 Electron 的跨平台桌面应用，集成讯飞云+ AI 能力，提供智能对话、Agent 市场、团队协作等功能。

### 核心特性

- **AI 对话工作空间**：基于 Matrix 协议的 IM 系统，支持流式响应
- **Agent 数字员工市场**：技能市场、头像市场、文件上传管理
- **多空间管理**：个人空间与团队空间隔离
- **Claude Code 集成**：内置终端支持 Claude Code CLI
- **SSO 单点登录**：集成讯飞集团 SSO 认证

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面壳 | Electron | ^28.0.0 |
| 前端框架 | Vue 3 (Composition API) | ^3.4.0 |
| 开发语言 | JavaScript (ES2022+) | - |
| 构建工具 | Vite | ^5.0.0 |
| 状态管理 | Pinia | ^2.1.0 |
| 路由 | Vue Router (Hash 模式) | ^4.2.0 |
| UI 组件库 | Element Plus | ^2.5.0 |
| 原子化 CSS | UnoCSS | ^66.0.0 |
| CSS 预处理 | SCSS | ^1.98.0 |
| IM 协议 | matrix-js-sdk | ^41.2.0 |
| 终端 | xterm.js + node-pty | ^6.0.0 / ^1.1.0 |
| 打包工具 | electron-builder | ^24.9.0 |
| 错误监控 | Sentry | ^7.10.0 / ^10.46.0 |

---

## 开发命令

```bash
# 安装依赖（已配置国内 Electron 镜像）
npm install
# 或
yarn install

# 启动前端开发服务器（浏览器访问 http://localhost:5173）
npm run dev

# 启动 Electron 开发模式（桌面应用）
npm run electron:dev

# 启动 Electron 开发模式（带调试）
npm run electron:dev:inspect

# 运行测试
npm test

# 构建生产版本（所有平台）
npm run electron:build

# 构建 macOS 版本
npm run build:mac

# 构建 Windows 版本
npm run build:win

# 构建指定架构
npm run build:mac:arm64    # macOS Apple Silicon
npm run build:mac:x64      # macOS Intel
npm run build:win:prod     # Windows 生产版本

# 启动更新服务器（本地测试自动更新）
npm run update-server
```

---

## 目录结构

```
fe-super-assistant/
├── electron/                      # Electron 主进程
│   ├── main.js                    # 主进程入口（窗口管理、IPC、更新）
│   ├── preload.js                 # 主窗口预加载脚本
│   ├── preload-bubble.js          # 气泡窗口预加载脚本
│   ├── ipc/                       # IPC 通道处理
│   │   ├── index.js               # IPC 通道注册
│   │   └── handlers/
│   │       └── fileSystem.js      # 文件系统操作
│   ├── claude-code-manager.js     # Claude Code CLI 管理器
│   ├── hook-server.js             # Claude Code HTTP Hooks 服务
│   ├── updater.js                 # 自动更新逻辑
│   └── sentry.js                  # Sentry 错误追踪
├── src/
│   ├── app/                       # 应用入口
│   │   ├── main.js                # Vue 主应用入口
│   │   ├── bubble-main.js         # 气泡窗口入口
│   │   ├── terminal-main.js       # 终端窗口入口
│   │   ├── App.vue                # 根组件
│   │   ├── HomeView.vue           # 主布局
│   │   └── router/
│   │       └── index.js           # Vue Router 配置
│   ├── modules/                   # 功能模块（按业务领域组织）
│   │   ├── agent/                 # Agent 管理
│   │   │   ├── components/        # Agent 相关组件
│   │   │   └── store.js           # Agent 状态
│   │   ├── auth/                  # 认证与用户
│   │   │   ├── components/        # 登录、引导页
│   │   │   ├── store.js           # 用户状态
│   │   │   ├── service.js         # 认证服务
│   │   │   └── sso.js             # SSO 集成
│   │   ├── bubble/                # 气泡窗口
│   │   ├── chat/                  # IM 聊天（核心模块）
│   │   │   ├── components/        # 消息列表、输入框等
│   │   │   ├── store.js           # 聊天状态（分模块）
│   │   │   │   ├── connection.js  # Matrix 连接
│   │   │   │   ├── rooms.js       # 房间管理
│   │   │   │   ├── messages.js    # 消息管理
│   │   │   │   ├── members.js     # 成员管理
│   │   │   │   ├── sending.js     # 消息发送
│   │   │   │   └── history.js     # 历史加载
│   │   │   └── use*.js            # 聊天相关 Composables
│   │   ├── collaboration/         # 团队协作
│   │   ├── file/                  # 文件管理
│   │   ├── group/                 # 群组管理
│   │   ├── market/                # 市场（技能、头像、上传）
│   │   │   ├── myFiles/           # 我的文件
│   │   │   ├── skillMarket/       # 技能市场
│   │   │   └── avatarMarket/      # 头像市场
│   │   ├── navigation/            # 导航状态
│   │   ├── solo-team/             # 个人/团队切换
│   │   ├── space/                 # 空间管理
│   │   ├── terminal/              # Claude Code 终端集成
│   │   └── updater/               # 应用更新 UI
│   ├── shared/                    # 共享资源
│   │   ├── components/            # 通用组件
│   │   ├── hooks/                 # Vue Composables
│   │   ├── im/                    # Matrix IM 客户端封装
│   │   │   ├── client/            # Matrix SDK 实现
│   │   │   ├── matrixClient.js    # 客户端包装类（220+ 方法）
│   │   │   ├── matrixSession.js   # 会话管理
│   │   │   ├── matrixUtils.js     # 工具函数
│   │   │   └── eventTypes.js      # 事件类型定义
│   │   ├── services/              # API 服务
│   │   │   ├── api.js             # 通用 API 客户端
│   │   │   ├── imApi.js           # IM API
│   │   │   └── orgApi.js          # 组织 API
│   │   ├── styles/                # 全局样式
│   │   └── utils/                 # 工具函数
│   ├── assets/                    # 静态资源
│   └── composables/               # 全局 Composables
├── build/                         # 构建脚本
│   ├── afterPack.js               # 打包后处理
│   ├── claude-code/               # Claude Code 集成
│   └── open-code/                 # Open Code 集成
├── docs/                          # 文档
│   └── ARCHITECTURE.md            # 架构文档
├── public/                        # 静态资源
│   └── config.js                  # 运行时配置（环境变量）
├── scripts/                       # 脚本
│   ├── prepare-open-code.cjs      # Open Code 准备脚本
│   └── upload-sourcemaps.js       # Sentry Sourcemap 上传
├── vite.config.mjs                # Vite 配置
├── uno.config.mjs                 # UnoCSS 配置
├── electron-builder.json          # Electron Builder 配置
└── package.json
```

---

## 核心架构

### 模块化设计

项目采用 **模块化架构**，每个功能模块独立组织：

```
src/modules/<模块名>/
├── components/          # 模块专属组件
├── store.js 或 store/   # Pinia 状态管理
├── service.js           # API 服务（可选）
├── use*.js              # Composables（可选）
└── *View.vue            # 页面视图（可选）
```

### Matrix IM 集成

**核心路径**：`src/shared/im/`

- **matrixClient.js**：封装 matrix-js-sdk，提供 220+ 方法
- **matrixSession.js**：管理 Matrix 会话生命周期
- **matrixUtils.js**：消息转换、用户映射等工具
- **eventTypes.js**：Matrix 事件类型与应用事件类型映射

**使用方式**：

```javascript
import { matrixClient } from '@/shared/im'

// 初始化（应用启动时）
await matrixClient.initClient({
  baseUrl: 'https://matrix.example.com',
  accessToken: 'token',
  userId: '@user:example.com'
})

// 发送消息
await matrixClient.sendTextMessage(roomId, '你好')

// 获取房间列表
const rooms = matrixClient.getRooms()

// 加载历史消息
const messages = await matrixClient.getRoomMessages(roomId, 50)
```

### Pinia Store 架构

**聊天模块 Store**（`src/modules/chat/store.js`）采用 **分模块组合** 模式：

```javascript
// store.js 主入口
import { useConnectionStore } from './store/connection'
import { useRoomsStore } from './store/rooms'
import { useMessagesStore } from './store/messages'
// ...

export const useChatStore = defineStore('chat', () => {
  const connection = useConnectionStore()
  const rooms = useRoomsStore()
  const messages = useMessagesStore()
  // ...
  
  return { connection, rooms, messages, ... }
})
```

**其他主要 Store**：

- `src/modules/auth/store.js` - 用户认证与信息
- `src/modules/agent/store.js` - Agent 列表与选择
- `src/modules/file/store.js` - 文件树管理
- `src/modules/space/store.js` - 空间管理
- `src/modules/navigation/store.js` - 导航状态

### Electron IPC 通道

**通道命名规范**：`模块:操作`

**主要通道**（`electron/ipc/index.js`）：

```javascript
// 窗口控制
'window:minimize', 'window:maximize', 'window:close'

// 文件系统
'fs:readFile', 'fs:writeFile', 'fs:readDir'

// 应用信息
'app:getVersion', 'app:getPath'

// Claude Code
'claude-code:install', 'claude-code:start', 'claude-code:stop'

// 更新
'updater:check', 'updater:download', 'updater:install'
```

**使用方式**（渲染进程）：

```javascript
// preload.js 已通过 contextBridge 暴露 window.electronAPI
const result = await window.electronAPI.invoke('fs:readFile', filePath)
```

### Vite 多入口配置

项目支持 **3 个独立入口**（`vite.config.mjs`）：

1. **main.html** - 主应用窗口
2. **bubble.html** - 气泡窗口（快捷对话）
3. **terminal.html** - Claude Code 终端窗口

每个入口有独立的 JS 入口文件（`src/app/main.js`、`bubble-main.js`、`terminal-main.js`）。

---

## 代码规范

### 文件命名

- **组件**：PascalCase，如 `ChatPanel.vue`、`MessageItem.vue`
- **服务/工具**：camelCase，如 `imApi.js`、`useChat.js`
- **Store**：camelCase，如 `store.js`、`connection.js`

### Vue 组件结构

```vue
<script setup>
// 1. 导入（按顺序：Vue 核心 > 第三方库 > 内部模块）
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '@/modules/chat/store'

// 2. Props & Emits
const props = defineProps({
  roomId: { type: String, required: true }
})
const emit = defineEmits(['send', 'close'])

// 3. Store & Composables
const chatStore = useChatStore()
const { messages } = storeToRefs(chatStore)

// 4. 响应式状态
const loading = ref(false)

// 5. 计算属性
const sortedMessages = computed(() => [...messages.value].sort())

// 6. 方法
function handleSend() { /* ... */ }

// 7. 生命周期
onMounted(() => { /* ... */ })
</script>

<template>
  <!-- 使用 Element Plus 组件 + UnoCSS 原子类 -->
  <div class="flex flex-col h-full p-4">
    <el-button @click="handleSend">发送</el-button>
  </div>
</template>

<style lang="scss" scoped>
/* 复杂样式使用 SCSS，简单布局用 UnoCSS */
.custom-component {
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>
```

### 样式规范（UnoCSS + SCSS）

| 场景 | 使用方案 | 示例 |
|------|---------|------|
| 布局（Flex/Grid） | UnoCSS | `class="flex items-center gap-4"` |
| 间距、尺寸 | UnoCSS | `class="p-4 w-full h-screen"` |
| 颜色、字体 | UnoCSS | `class="text-gray-700 text-sm"` |
| 复杂样式、动画 | SCSS | `<style lang="scss" scoped>` |
| Element Plus 主题 | SCSS 变量 | 在全局样式中覆盖 |

**UnoCSS 配置**：`uno.config.mjs`
- 预设：`presetUno`（类 Tailwind）、`presetAttributify`、`presetIcons`
- 快捷方式：`flex-center`、`flex-between`

### Matrix IM 使用规范

**禁止直接使用 matrix-js-sdk**，必须通过 `src/shared/im/matrixClient.js` 封装层。

**正确示例**：

```javascript
import { matrixClient } from '@/shared/im'

// ✅ 通过封装层
await matrixClient.sendTextMessage(roomId, content)
```

**错误示例**：

```javascript
import * as sdk from 'matrix-js-sdk'

// ❌ 直接使用 SDK
const client = sdk.createClient({ ... })
```

### Electron 安全规范

- **nodeIntegration**: 必须为 `false`
- **contextIsolation**: 必须为 `true`
- **webSecurity**: 生产环境必须为 `true`
- 所有 Node.js API 调用必须通过 IPC 通道
- 敏感信息（Token、密钥）存储在主进程，不暴露给渲染进程

---

## Git 工作流

```
master (main)     ← 生产分支
  └── dev_*       ← 开发分支（按日期或功能命名）
```

### 提交规范

```
<type>(<scope>): <subject>

# type: feat|fix|docs|style|refactor|perf|test|chore
# scope: 模块名，如 chat|agent|market|electron

# 示例
feat(chat): 添加消息引用功能
fix(market): 修复技能市场筛选问题
refactor(im): 重构 Matrix 客户端封装
```

---

## 环境配置

### 环境变量文件

- `.env.electron` - Electron 构建目标标识
- `.env.electron.dev` - 开发环境配置（Sentry DSN、环境切换开关）
- `.env.electron.prod` - 生产环境配置

### 运行时配置

`public/config.js` 注入 `window.BASEDB`，包含：

- `SSO_URL` - SSO 登录地址
- `API_BASE_URL` - API 基础地址
- `MATRIX_BASE_URL` - Matrix 服务器地址

**多环境配置**：

| 环境 | SSO URL | API URL |
|------|---------|---------|
| dev | `one-dev.iflytek.com` | `one-dev.iflytek.com` |
| test | `one-test.iflytek.com` | `one-test.iflytek.com` |
| pre | `one-pre.iflytek.com` | `one-pre.iflytek.com` |
| prod | `one.iflytek.com` | `one.iflytek.com` |

---

## 关键设计决策

### 为什么使用 Matrix 协议？

- **开放标准**：去中心化、可扩展的 IM 协议
- **丰富功能**：支持房间、消息、文件、端到端加密
- **生态成熟**：matrix-js-sdk 提供完整的 JavaScript 实现

### 为什么采用模块化架构？

- **职责清晰**：每个模块独立管理自己的组件、状态、服务
- **易于维护**：模块间低耦合，修改影响范围小
- **团队协作**：不同开发者可并行开发不同模块

### 为什么选择 JavaScript 而非 TypeScript？

- 团队熟悉度高，开发效率优先
- Electron + Vue 生态 JS 支持成熟
- 可通过 JSDoc 提供类型提示
- 后续可渐进式迁移

---

## 协作提示

### Claude 应该

- 使用 Composition API + `<script setup>` 语法
- 遵循模块化架构，新功能放在对应模块下
- 所有 Matrix 操作通过 `matrixClient` 封装层
- 布局使用 UnoCSS，复杂样式用 SCSS
- 中文注释，英文代码
- 保持代码简洁，避免过度设计

### Claude 不应该

- 直接使用 matrix-js-sdk（必须通过封装层）
- 在渲染进程直接调用 Node.js API
- 引入未在 package.json 中声明的依赖
- 修改 Electron 安全配置（nodeIntegration、contextIsolation）
- 硬编码敏感信息（Token、密钥、API Key）
- 破坏模块边界（跨模块直接访问内部实现）

---

## 参考资料

- 内部文档：`docs/ARCHITECTURE.md`（详细架构设计）
- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vue 3 文档](https://vuejs.org/)
- [Element Plus 文档](https://element-plus.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Matrix 协议文档](https://matrix.org/docs/)
- [UnoCSS 文档](https://unocss.dev/)
