# 一人团队模块接力文档

更新时间：2026-05-19

本文档用于新开 Codex 对话时快速恢复一人团队模块上下文。后续每次修改一人团队相关代码，都要在本文档的「变更记录」中追加一条记录，并同步更新「当前实现状态」或「注意事项」。

## 使用方式

新开对话时优先让 Codex 阅读：

```text
src/modules/solo-team/ONE_PERSON_TEAM_README.md
```

如果要继续处理文件、消息列表、任务列表、主/子会话联动，再补充阅读：

```text
docs/specs/one-person-team-file-attachments.spec.md
docs/一人团队/2026-05-17-kooky-client-main-sub-conversation-integration-design.md
docs/一人团队/2026-05-12-kooky-client-complete-design.md
```

## 模块边界

一人团队属于 `solo-team` 模块，但需要和「我的员工」保持隔离。

主要代码目录：

```text
src/modules/solo-team/
```

一人团队专属组件：

```text
src/modules/solo-team/components/OnePersonTeamChatPanel.vue
src/modules/solo-team/components/one-person-team/
```

一人团队专属运行时和服务：

```text
src/modules/solo-team/store/onePersonTeamRuntime.js
src/modules/solo-team/services/onePersonTeamRuntimeApi.js
src/modules/solo-team/services/onePersonTeamStreamClient.js
src/modules/solo-team/services/onePersonTeamAttachmentApi.js
src/modules/solo-team/composables/useOnePersonFileDrop.js
src/modules/solo-team/composables/useOnePersonMessageTimestamp.js
```

原则：

- 不要再让一人团队依赖协作群聊 IM / Matrix 的群聊逻辑。
- 不要为一人团队改 `group` 模块来兜底。
- 新接口尽量放在一人团队专属 service 中，避免污染 `src/modules/solo-team/service.js` 里“我的员工”接口。
- UI 可以参考「我的分身」和协作模块，但业务状态要隔离。

## 当前实现状态

### 1. API 与响应格式

一人团队接口统一走：

```text
/kooky-api/api/v1/one-person-teams
```

响应 envelope：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

`code === 0` 表示业务成功，非 0 要作为业务失败处理。
接口错误提示统一走 `soloTeamApiErrorMessage()`：HTTP 非 2xx 或业务 `code !== 0` 时，优先展示后端响应体里的 `message/msg`，再兜底 `detail/error` 和本地 fallback。例如创建团队 409 返回 `{"code":409,"message":"团队名称已存在..."}` 时，页面应直接提示该 `message`。

注意：

- 路径里不要额外拼 `/kooky/`。
- 线上环境域名由项目通用 api/getOneEnv 链路处理，service 里只维护业务 path。
- 曾经临时连过后端本地 `10.43.9.41:2026`，现在不应该再硬编码这个地址。

核心接口：

```text
GET  /api/v1/one-person-teams/{team_id}/home
GET  /api/v1/one-person-teams/{team_id}/tasks
GET  /api/v1/one-person-teams/task-sidebar
GET  /api/v1/one-person-teams/{team_id}/threads/{thread_id}/messages
POST /api/v1/one-person-teams/{team_id}/threads/{thread_id}/messages
GET  /api/v1/one-person-teams/{team_id}/events/stream
GET  /api/v1/one-person-teams/{team_id}/runs/{run_id}/stream
```

消息分页/增量参数：

```text
limit
before_seq
after_seq
```

### 2. 首页和主/子会话

`/home` 是进入团队后的首屏快照，包含：

- `team`
- `members`
- `main_thread`
- `tasks`
- `pending_approvals`
- `event_cursor`

主会话：

- 使用 `home.main_thread.id` 作为消息接口 thread id。
- 标题/header/团队管理入口由外层已实现，一人团队会话组件不要重复实现顶部全局 header。
- 主会话面板包含团队管理入口。

子会话：

- 任务就是子会话。
- 点击主会话里的任务卡片或全局任务面板里的任务，才打开右侧子会话面板。
- 子会话面板不是常驻。
- 子会话面板不带团队管理入口。
- 子会话消息使用任务的 `execution_thread_id/threadId` 拉取。
- 主/子会话与一人团队团队管理面板在 `SoloTeamView` 内同层排列；宽度不足时由 `SoloTeamView` 统一横向滚动。
- 文件/任务/通知工具面板保持在 `HomeView` 右侧工具区，不参与一人团队会话区内部横向滚动；一人团队内部横向滚动只覆盖主会话、子会话和团队管理面板。
- 右侧全局任务面板打开时，`SoloTeamView` 会把主/子会话单列最小宽度从 360px 下调到 340px，主+子会话总最小宽度从 728px 下调到 688px，避免 1280x800 默认窗口下子会话关闭按钮贴到任务面板边界。

关键组件：

```text
OnePersonTeamChatPanel.vue
MainConversationPane.vue
TaskConversationPane.vue
OnePersonMessageList.vue
OnePersonMessageItem.vue
```

### 3. 全局任务面板

全局右侧任务 tab 使用：

```text
GET /api/v1/one-person-teams/task-sidebar
```

任务面板位置在全局右侧栏文件 tab 下方，由：

```text
src/modules/space/components/ToolPanel.vue
src/app/HomeView.vue
src/modules/solo-team/components/one-person-team/OnePersonTeamTaskPanel.vue
```

当前刷新规则：

- 点击右侧「任务」tab 展开任务面板时，强制刷新 `task-sidebar`。
- 主会话消息里出现 `taskCard/welcomeCard/task-card` 时，刷新全局任务列表。
- SSE 收到 `task.created/task.updated` 时，刷新全局任务列表。
- 强制刷新当前团队任务列表后，也会触发全局任务列表刷新。
- 刷新有 200ms 防抖，避免流式消息或事件连续推送时重复请求。

任务面板不应该和当前会话强绑定，它展示所有一人团队的任务。

### 4. SSE 和消息账本

当前端侧正式消息展示只依赖：

```text
team events: /events/stream
messages:    /threads/{thread_id}/messages
```

现状：

- `team events` 会打印日志，并消费稳定事件，如 `task.created/task.updated`、`message.created/message.updated`、成员状态更新等。
- 收到 `message.created` 后，不展示 SSE payload 正文，而是用当前 thread 的 `latestSeq` 通过 `after_seq` 补拉消息账本。
- 收到 `message.updated` 或终态 run 状态后，会先刷新对应 thread 的消息账本，账本合并完成或短轮询兜底结束后再清理内部思考状态。
- 消息账本接口 `/threads/{thread_id}/messages` 仍然是历史消息和最终状态的权威来源。
- `/runs/{run_id}/stream` 只保留兼容 helper，不再参与主/子会话 UI 展示。

### 5. 消息列表

一人团队消息列表已实现：

- 主会话和子会话共用 `OnePersonMessageList.vue`。
- 支持日期分割。
- 支持回到底部按钮，按钮位于消息面板底部居中。
- 支持 `before_seq` 分页加载更早消息。
- 顶部按钮和滚动到顶部附近都会触发加载。
- 加载更早消息后保持滚动位置。
- 不再渲染“正在思考...”loading；发送后或成员 busy/run active 产生的内部 thinking 状态只用于账本补拉和 settle，不参与 UI 展示。
- 消息 hover 时显示时间，时间逻辑对齐「我的分身」。
- 切换团队或主/子 thread 时会重置滚动状态并自动滑到最新消息。
- 消息合并优先使用服务端 `id` 和 `client_message_id`，不再把同一 `run_id` 下的多个成员回复合并成一条；最终排序按 `seq`，同 `seq` 时按 `id`。
- 欢迎卡片标题展示为“新人介绍”，左侧图标使用 `src/assets/soloTeam/tilte_left_icon.svg`，右侧“查看更多”图标使用 `src/assets/soloTeam/shou.svg`。

时间字段兼容：

```text
timestamp
created_at / createdAt
additional_kwargs.created_at
raw.additional_kwargs.created_at
```

如果后端这些字段都不返回，前端不会伪造当前时间，消息 hover 不会显示时间。

### 6. 消息动作

消息动作对齐「我的分身」的基础体验：

- 复制
- 点赞/点踩

临时关闭：

- 引用按钮本期不上，一人团队里 `show-quote` 保持 `false`。

### 7. @ 数字员工

主会话和子会话输入框都支持 @ 数字员工 UI：

```text
OnePersonMentionPicker.vue
OnePersonComposer.vue
```

发送主会话和子会话消息时，会在 `POST /api/v1/one-person-teams/{team_id}/threads/{thread_id}/messages` 请求体里携带 `mentions`，格式为：

```json
[
  { "agent_id": 484, "name": "产品经理" }
]
```

`@` 不要求前面有空格，输入 `文本@` 或 `文本@关键字` 也会弹出候选。

接入点：

```text
OnePersonComposer.buildMentionPayloads()
sendOnePersonThreadMessage()
sendKookyOnePersonTeamMessage()
```

### 8. 文件附件

一人团队文件能力对齐「我的分身」第一阶段：

- 输入框选择文件。
- 粘贴文件。
- 粘贴图片会在入队前追加时间戳到文件名，避免剪贴板默认同名图片上传后被后端存储覆盖。
- 从系统文件拖入输入框区域。
- 从端侧文件树拖拽。
- 从云端文件节点拖拽。
- 发送时先上传附件，再发送消息。
- 消息列表展示图片/文件卡片。
- 文件卡片支持预览和下载。
- 预览框中的保存到文件库逻辑本期不做。

相关文件：

```text
OnePersonComposer.vue
OnePersonAttachmentCards.vue
useOnePersonFileDrop.js
onePersonTeamAttachmentApi.js
onePersonTeamRuntime.js
```

上传接口复用：

```text
POST /kooky-api/api/threads/{langgraph_thread_id}/uploads
```

附件解析兼容：

- `attachments`
- `files`
- `artifacts`（消息账本直接返回的产物列表，支持 `download_url/open_url/path/title/filename/size_bytes/artifact_type`）
- `additional_kwargs.files`
- `additional_kwargs.artifacts`
- content 图片
- `present_files` tool
- `<uploaded_files>` 文本块

### 9. 团队管理

团队管理面板已按一人团队独立逻辑处理：

- 创建团队弹窗支持填写 `description`，提交 `POST /api/v1/one-person-teams` 时随团队名称一起传给后端。
- 团队管理面板支持查看和编辑团队描述，更新走 `PUT /api/v1/one-person-teams/{team_id}` 的 `description` 字段。
- 添加数字员工时，不传个人默认助理给后端。
- 创建团队和编辑/添加成员时，`/api/v1/agents/my` 单次请求携带 `page=1&pageSize=100`，避免默认只返回前 20 个导致聘用数字人缺失。
- 添加员工成功后刷新数字员工列表。
- 移除数字员工二次确认样式参考协作模块。
- 团队头像参考协作团队管理头像，多成员头像要按实际成员数量渲染。
- 数字员工头像右下角展示忙闲状态点：`busy` 为 #FF621F，`idle` 为 #07C160，状态来自 `/agents/my`、运行态成员或成员状态事件。
- 解散团队仍调用编辑接口：

```http
PUT /api/v1/one-person-teams/{team_id}

{
  "is_collaboration_dissolved": true
}
```

解散团队后要刷新任务列表，避免已解散团队的任务仍显示在全局任务面板中。

## 注意事项

1. 新建一人团队成功后，要自动跳到新团队 tab。
2. 一人团队 team list 如果创建失败，不应该把失败团队留在列表缓存里。
3. 添加/移除成员不要触发协作群聊逻辑。
4. 一人团队新增接口不要写回 `src/modules/solo-team/service.js`，优先使用一人团队专属 service。
5. UI 样式尽量贴近设计稿和「我的分身」输入框，不要引入黑色气泡、假头像、重复 header。
6. 主会话和子会话是两个独立面板，中间有间距，不要共用一个面板 header。
7. 全局任务面板展示所有团队任务，不要只展示当前会话任务。
8. 如果发现消息没有时间，先检查后端是否返回 `created_at/createdAt/additional_kwargs.created_at/timestamp`。

## 变更记录

### 2026-05-19

- 修复创建一人团队弹框小屏外层上下滚动：弹框高度改为随视口收缩，保留员工列表内部滚动；弹框外边距使用 `clamp + 7vh`，大屏保持原有下沉位置，小屏避免 `660px + 7vh + Element Plus 默认底部 margin` 超出视口。
- 新建一人团队增加团队名称重名校验：打开弹框时刷新一人团队列表，输入时命中重名展示红色边框和“团队名称已存在，请修改后再继续”，后端 409 也会回填到同样的输入框错误态。
- 修复一人团队会话粘贴图片同名覆盖：主/子会话输入框粘贴图片时在文件名中追加 `yyyyMMdd_HHmmss_SSS` 时间戳，拖拽和手动选择文件保持原名。
- 还原成员欢迎介绍卡片 UI：标题从“成员相互介绍”改为“新人介绍”，接入左侧标题图标和右侧“查看更多”手势图标，并按设计调整卡片、成员条目和文字样式。
- 移除一人团队主/子会话消息列表中的“正在思考...”loading 展示，内部 thinking 状态继续保留给消息账本补拉和终态 settle 使用。
- 调整全局任务面板展开逻辑：一人团队根目录会跟随左侧一级导航联动展开，切到其他模块时闭合；各团队目录默认闭合，点击后才展开；空团队任务在目录下显示“暂无任务”，对齐全局文件面板的空文件处理。
- 补齐一人团队主/子会话之间的拖拽器：子会话打开后中间显示 8px hover 拖拽区，复用全局面板拖拽图标和蓝色拖动线；拖动只调整主/子会话宽度比例，最小宽度保持 360px，并保留小屏横向滚动。
- 调整一人团队横向滚动归属：主会话、子会话和团队管理在 `SoloTeamView` 内同层滚动；全局任务列表保持工具区独立位置，不跟随滚动。
- 放开一人团队 @ 触发条件：主/子会话输入框里 `@` 紧贴普通文字时也会弹出数字员工候选。
- 取消一人团队团队管理与文件/任务工具面板的互斥：打开团队管理不再关闭文件/任务，打开文件或任务也不再收起团队管理。
- 收敛一人团队工具面板布局：移除 `HomeView` 中一人团队专属外层整体滚动和宽度变量；主/子会话与团队管理只在 `SoloTeamView` 内同层横向滚动，全局任务列表保持右侧工具区独立，不跟随滚动。
- 微调默认窗口下任务面板打开时的会话宽度：全局任务面板打开时，由 `SoloTeamView` 下发一人团队局部 CSS 变量，将主/子会话最小宽度调为 340px、总最小宽度调为 688px，避免子会话关闭按钮被右侧任务列表遮挡。
- 对齐全局任务面板底部间距：`task-panel-wrapper` 补齐 10px 底部外边距，使任务面板底边与中间内容区底边对齐。
- 统一一人团队任务面板展开动画宽度：`HomeView` 外层 wrapper 读取并同步 `OnePersonTeamTaskPanel` 的实际总宽度（内容宽度 + 拖拽条），避免打开任务面板时先变宽再回弹。
- 接入一人团队主/子会话消息发送 `mentions`：`OnePersonComposer` 生成 `{ agent_id, name }`，`sendOnePersonThreadMessage` 透传到 `/threads/{thread_id}/messages` 请求体。
- 修复一人团队消息气泡中带横线的 @ 名称高亮：通用 Markdown mention 正则把 `-` 视为名称字符，避免 `@test-agent` 只高亮横线前半段。
- 修复从 Kode 前台点击全局任务跳转后仍显示终端：`setActiveNavigation` 切到非 `cli` 一级导航时会自动收起 Kode 前台态，终端组件保留后台存活。
- 降低从市场/协作等模块点击全局任务跳入一人团队时的闪动：会话面板挂载不再强制重复刷新 runtime，打开任务和子会话线程 watcher 不再强制重拉已加载线程，避免内容反复切回 loading。
- 修复打开任务面板后会话区和团队管理没有纵向滚动条：保留主/子会话与团队管理的内部高度约束，纵向继续由消息列表和团队管理内容区内部滚动。

### 2026-05-18

- 创建团队、团队管理添加数字员工，以及端侧其他 `/api/v1/agents/my` 调用统一携带 `page=1&pageSize=100`；员工数量不会超过 100，不再循环分页拉取，避免默认只显示前 20 个员工和聘用数字人缺失。
- 调整一人团队接口错误提示：HTTP 非 2xx 或业务失败时优先展示后端 `message/msg`，再兜底 `detail/error`，避免 409 等场景只显示本地默认文案。
- 补齐一人团队描述：创建团队弹窗新增团队描述输入并随创建接口提交；团队详情归一化保存 `description`；团队管理面板新增描述查看和编辑能力。
- 补齐数字员工忙闲状态 UI：统一归一化 `busy/idle` 状态，团队管理面板和添加数字员工弹窗的头像右下角显示 7px 状态点，运行态成员状态事件会同步刷新缓存。
- 修复全局任务面板根节点折叠：点击“一人团队”可收起/展开其下所有团队与任务，根节点箭头随状态旋转。
- 对齐团队管理二次确认按钮：删除成员和解散团队确认按钮使用创建一人团队同款黑色 `#1c1a21`，hover 使用 `#2e323c`。
- 放开任务子会话发送限制：任务已完成、失败或取消后，子会话仍可继续发送消息；输入框只在发送中禁用。
- 兼容主/子会话消息账本的 `artifacts` 字段：文件和图片产物会归一化到消息附件卡片中渲染，并支持预览、保存到文件库和下载。

### 2026-05-17

- 新增本文档，作为一人团队模块接力说明和变更记录入口。
- 补充全局任务列表刷新规则：任务面板打开强刷；主会话出现任务卡片时刷新；`task.created/task.updated` 时刷新；当前团队任务强刷后同步刷新全局任务。
- 对齐「我的分身」消息时间逻辑：hover 显示相对时间，兼容 `additional_kwargs.created_at`，不再用前端当前时间伪造缺失时间。
- 补齐消息列表体验：日期分割、底部居中的回到底部按钮、`before_seq` 分页加载、正在思考状态。
- 补齐文件附件第一阶段：选择、粘贴、拖拽、上传、消息卡片展示、预览、下载；保存到文件库暂不做。
- 明确一人团队和协作/IM/Matrix 解耦，不再通过改 group 模块兜底一人团队添加员工问题。
- 重构主/子会话消息同步：发送消息后不再连接 `runs/{run_id}/stream` 渲染流式正文；通过 team events + messages `after_seq` 补拉权威账本，保留 run_id 仅用于“正在思考...”运行态。
- 修复主/子会话消息合并规则：同 `run_id` 的多个非 human 账本消息不再互相覆盖，避免多个成员回复被合成一条或子会话少消息。
- 修复消息列表滚动：切换团队/线程后自动滑到最新消息，最新消息内容或状态更新时在用户未上滑的情况下持续跟随底部。
- 兼容 `team_events` 批量事件帧，逐条应用消息、任务、成员状态事件并持久化最新事件游标。
- 对齐全局任务面板 UI：任务面板 header 标题/关闭按钮尺寸贴齐文件面板；任务 tab 激活时工具栏左侧圆角状态与文件 tab 一致。
- 调整“正在思考...”关闭时机：终态事件先触发账本补拉和短轮询 settle，避免 loading 先消失、消息稍后才渲染的空窗。
- 调整全局任务列表任务行：任务 emoji 使用固定候选集稳定随机展示，emoji 与标题列间距固定为 6px。
- 校准全局任务面板左侧层级缩进：一人团队根行 14px、一级目录 34px、任务 item 76px。
- 替换全局任务列表状态图标：未开始/阻塞使用 `weikaishi.svg`，进行中使用 `jinxingzhong.svg`，失败/取消使用 `shibai.svg`，完成状态不显示图标。
- 调整团队侧栏互斥：历史上曾让文件面板、任务面板、团队管理面板只能同时显示一个；后续已取消团队管理与文件/任务工具面板互斥。
- 调整任务面板为全局工具入口：所有一级导航都显示任务 tab；打开任务面板不再因离开一人团队而清空；点击团队或任务会自动跳转到对应一人团队二级菜单。
- 修复从全局任务列表首次跳转到一人团队时子会话空白：active task 已有 threadId 时立即补拉任务消息，并在 runtime 快照加载后兜底补拉当前任务线程。
- 补齐拖拽布局体验：一人团队团队管理面板和全局任务面板都增加与文件/我的分身一致的左侧 hover 拖拽器；主/子会话小屏不再上下堆叠，保持最小宽度并在会话工作区横向滚动。
- 修正拖拽和层级细节：任务/会话拖拽器拖动时保持 dragging 样式不被 hover 覆盖；团队管理、任务列表和会话面板按同层 flex 占位排列，不再用更高层级遮挡会话面板。
- 修复外层横向滚动误伤会话布局：一人团队外层恢复隐藏溢出和正常 flex 收缩，仅主/子会话工作区在小屏时横向滚动，避免输入框被整体撑到右侧。
- 对齐一人团队团队管理 UI 到协作团队管理：复用协作图标、头像宫格、文字/色值/hover/危险按钮风格，并同步添加数字员工弹框与确认弹框样式。
- 对齐一人团队主会话头部到协作会话头部：会话标题使用协作的 14px/normal 样式，团队管理入口复用 `icon-tuanduiguanli` 和 24px 图标按钮。
- 修正一人团队主会话团队管理入口背景叠加：按钮 class 和 hover/active 规则统一为协作头部的 `icon-btn`。
- 对齐一人团队团队管理二次确认框：删除成员和解散团队都只使用协作同款 `group-manage-confirm-dialog` class 与样式。

## 后续修改记录模板

以后每次改一人团队相关逻辑，在这里追加：

```md
### YYYY-MM-DD

- 改动摘要：
- 涉及文件：
- 接口/数据变化：
- 注意事项：
```
