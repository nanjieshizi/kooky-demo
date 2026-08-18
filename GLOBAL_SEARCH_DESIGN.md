# 全局搜索功能设计文档

**日期**：2026-04-29  
**状态**：已确认，待实现  
**模块**：`src/modules/search/`

---

## 背景与目标

全局搜索是 KC 的核心导航能力，让用户通过关键词快速定位任何内容——一人团队、协作、消息记录、联系人（数字人和真人）、文件库中的文件。

用户体验目标：输入关键词，立即看到结果，点击即达。

---

## 搜索范围

用户只能搜索到有权限访问的内容：

| 类别 | 范围 |
|------|------|
| 一人团队 | 自己创建的一人团队 |
| 协作 | 参与的协作 |
| 消息记录 | 可见的聊天记录 |
| 联系人 | 可见的数字人 + 真人用户 |
| 文件 | 我的分身、一人团队、协作里文件库中的文件 |

---

## 架构设计

### 模块结构

```
src/modules/search/
├── components/
│   ├── GlobalSearchDialog.vue      # 主搜索弹窗（全屏居中）
│   ├── SearchResultItem.vue        # 通用结果项组件
│   └── SearchTabBar.vue            # Tab 切换栏
├── store.js                        # 搜索状态管理（Pinia）
├── useGlobalSearch.js              # 搜索逻辑 composable
└── service.js                      # 搜索 API 封装（含 mock）
```

### 数据流

```
用户输入
  → 防抖 300ms
  → useGlobalSearch.search(keyword)
    → 并行调用 5 个搜索函数
      ├── searchSoloTeams(keyword)     # 本地 store 过滤
      ├── searchCollaborations(keyword) # 本地 store 过滤
      ├── searchContacts(keyword)       # API: searchUserDirectoryApi + searchProfiles
      ├── searchFiles(keyword)          # 本地 store 过滤（文件名）
      └── searchMessages(keyword)       # API: searchMessagesApi（mock）
  → 聚合结果 → 排序 → 更新 store
  → 组件响应式更新
```

### 快捷键注册

在 `src/app/App.vue` 中注册全局快捷键：

```javascript
// 捕获阶段，优先级高于其他监听器
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchStore.openDialog()
  }
}, true)
```

---

## 组件设计

### GlobalSearchDialog.vue

**布局**：全屏居中弹窗，宽度 640px，最大高度 70vh，背景半透明遮罩。

```
┌─────────────────────────────────────────────────────┐
│                   半透明遮罩层                        │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🔍  搜索团队、消息、文件...              [Esc] │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 综合(18) | 团队(3) | 协作(2) | 消息(8) | ...  │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 团队                                          │  │
│  │  👥 产品团队                    最近活跃 2h前  │  │
│  │  👥 设计团队                    最近活跃 1d前  │  │
│  │  查看更多 1 条 ›                              │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 消息记录                                      │  │
│  │  💬 用户增长策略 - 产品团队      2024-01-15   │  │
│  │     ...讨论了关于[用户增长策略]的方案...       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Tab 列表**：综合 | 一人团队 | 协作 | 消息记录 | 联系人 | 文件

**关键交互**：
- 点击搜索框或按 `Cmd/Ctrl+K` 打开弹窗，搜索框自动获焦
- 输入关键词后防抖 300ms 触发搜索
- 按 `Esc` 关闭弹窗
- 键盘 `↑↓` 移动焦点，`Enter` 跳转
- 点击遮罩层关闭弹窗

### SearchResultItem.vue

通用结果项，根据 `type` 渲染不同内容：

| type | 显示内容 |
|------|---------|
| `solo-team` | 图标 + 团队名 + 最近活跃时间 |
| `collaboration` | 图标 + 协作名 + 最近活跃时间 |
| `contact` | 头像 + 姓名 + 类型标签（数字人/真人）+ 「💬 单聊」按钮（hover 显示） |
| `file` | 文件图标 + 文件名 + 所在空间 + 上传时间 |
| `message` | 房间名 + 消息片段（关键词高亮）+ 时间 |

**关键词高亮**：使用 `<mark>` 标签包裹命中词，黄色背景。

---

## 数据搜索

### 各类别数据源

| 类别 | 数据来源 | 搜索字段 |
|------|---------|---------|
| 一人团队 | `useSoloTeamStore().soloTeamRooms` | `name` |
| 协作 | `useGroupStore().groupRooms`（过滤 `createRoomType === 'group'`） | `name` |
| 联系人 | `searchUserDirectoryApi(imToken, keyword)` + `searchProfiles(keyword)` | `displayName`, `name` |
| 文件 | `useFileStore().fileNodes` + `teamFileNodes`（递归展开） | `name`（仅文件名，不含文件夹） |
| 消息 | `searchMessagesApi(keyword)`（mock，后期替换为真实 API） | `content` |

### Mock 消息搜索 API

```javascript
// src/modules/search/service.js
export async function searchMessagesApi(keyword, options = {}) {
  await new Promise(resolve => setTimeout(resolve, 300))
  return {
    results: [
      {
        messageId: 'msg_001',
        roomId: 'room_123',
        roomName: '产品团队',
        content: '讨论了关于用户增长策略的方案，建议从以下几个方向入手...',
        snippet: '...关于[用户增长策略]的方案...',  // 前后各 20 字
        timestamp: 1705305600000,
        senderId: '@user:example.com'
      }
    ],
    total: 12
  }
}
```

后期替换：只需修改 `service.js` 中的 `searchMessagesApi` 实现，调用真实后端接口，其余代码无需改动。

---

## 排序规则

### 综合 Tab

1. **类别权重**（决定分组顺序）：
   - 一人团队 / 协作（权重 4）
   - 联系人（权重 3）
   - 文件（权重 2）
   - 消息记录（权重 1）

2. **类别内排序**：
   - 相关度得分 × 0.6 + 活跃时间得分 × 0.4
   - 相关度：完全匹配 > 前缀匹配 > 包含匹配

3. **展示限制**：每类别最多显示 3 条，超出显示「查看更多 N 条 ›」

### 单类别 Tab

- 仅按活跃时间倒序排列
- 活跃时间定义：
  - 一人团队/协作/联系人：最近一次聊天时间
  - 文件：上传时间
  - 无聊天记录的联系人：按名字字母排序

---

## 跳转行为

| 类别 | 跳转逻辑 |
|------|---------|
| 一人团队 | `uiStore.setActiveNavigation('solo-team', roomId)` |
| 协作 | `uiStore.setActiveNavigation('collaboration', roomId)` |
| 联系人 | 调用私聊创建逻辑，打开/新建 1v1 会话，左侧栏「私聊」分区同步更新 |
| 文件 | `uiStore.openFilePanel()` + 定位到对应文件节点 |
| 消息 | 跳转到对应房间 → 滚动到目标消息（通过 `eventId`）→ 高亮 3 秒后恢复 |

**跳转后**：搜索弹窗自动关闭。

---

## Store 设计

```javascript
// src/modules/search/store.js
export const useSearchStore = defineStore('search', () => {
  const visible = ref(false)
  const keyword = ref('')
  const activeTab = ref('all')  // 'all' | 'solo-team' | 'collaboration' | 'message' | 'contact' | 'file'
  const loading = ref(false)
  const results = ref({
    soloTeams: [],
    collaborations: [],
    contacts: [],
    files: [],
    messages: []
  })

  function openDialog() { visible.value = true }
  function closeDialog() {
    visible.value = false
    keyword.value = ''
    activeTab.value = 'all'
    results.value = { soloTeams: [], collaborations: [], contacts: [], files: [], messages: [] }
  }

  return { visible, keyword, activeTab, loading, results, openDialog, closeDialog }
})
```

---

## 修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `src/app/App.vue` | 注册全局 `Ctrl+K` / `Cmd+K` 快捷键；挂载 `GlobalSearchDialog` 组件 |
| `src/modules/space/components/TitleBar.vue` | 顶部搜索框点击事件触发 `searchStore.openDialog()` |

---

## 不在本期范围内

- 搜索历史记录
- 搜索建议/自动补全
- 文件内容全文搜索
- 搜索结果分页（消息类别超过 20 条时）
