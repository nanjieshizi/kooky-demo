/**
 * Vue Provide/Inject 依赖注入键名常量
 *
 * 注意：这些是 Vue 组件间通信的标识符，不是加密密钥或敏感信息
 * 用于 provide/inject API 的类型安全和代码可维护性
 *
 * @see https://vuejs.org/guide/components/provide-inject.html
 */

// ============ 聊天相关 ============

/**
 * 聊天输入框顶部锚点引用
 * 用于定位消息操作按钮（如"继续"、"重新生成"）的插入位置
 */
export const CHAT_COMPOSER_TOP_ANCHOR_KEY = 'chatComposerTopAnchorRef'

/**
 * 聊天输入框引用
 * 用于消息操作按钮触发输入框聚焦等交互
 */
export const CHAT_COMPOSER_INPUT_BOX_KEY = 'chatComposerInputBoxRef'

/**
 * 聊天面板根元素引用
 * 用于滚动控制和布局计算
 */
export const CHAT_PANEL_ROOT_REF_KEY = 'chatPanelRootRef'

/**
 * 聊天文件拖放状态
 * 用于跨组件共享文件拖放状态
 */
export const CHAT_FILE_DROP_KEY = 'chatFileDrop'

/**
 * 强制滚动到底部方法
 * 用于消息发送后自动滚动
 */
export const FORCE_SCROLL_TO_BOTTOM_KEY = 'forceScrollToBottom'

// ============ 文件相关 ============

/**
 * 文件树节点刷新注册
 * 用于文件操作后刷新特定节点
 */
export const REGISTER_NODE_REFRESH_KEY = 'registerNodeRefresh'

/**
 * 触发文件树节点刷新
 * 用于通知父组件刷新指定路径的节点
 */
export const TRIGGER_NODE_REFRESH_KEY = 'triggerNodeRefresh'

/**
 * 文件树展开路径集合
 * 用于跨组件共享展开状态
 */
export const EXPANDED_PATHS_KEY = 'expandedPaths'

/**
 * 文件树选中路径集合
 * 用于多选文件操作
 */
export const SELECTED_PATHS_KEY = 'selectedPaths'

/**
 * 文件树选中节点映射
 * 用于快速查找选中节点信息
 */
export const SELECTED_NODES_MAP_KEY = 'selectedNodesMap'

/**
 * 切换文件选中状态
 * 用于文件树节点的多选交互
 */
export const TOGGLE_SELECT_KEY = 'toggleSelect'

/**
 * 清除多选状态
 * 用于重置文件树选择
 */
export const CLEAR_MULTI_SELECT_KEY = 'clearMultiSelect'

// ============ 其他 ============

/**
 * Solo/Team 页面头部引用
 * 用于布局和滚动控制
 */
export const SOLO_TEAM_HEADER_REF_KEY = 'soloTeamHeaderRef'

/**
 * 我的员工 / 协作数字人对话：Pinia 会话 store。
 * 协作区由 DigitalHumanPanel provide collaboration-employee-chat；
 * 一人团队由 SoloTeamView provide solo-team；inject 缺失时回退 useSoloTeamStore（勿在协作子树依赖此回退）。
 */
export const EMPLOYEE_CHAT_SESSION_STORE_KEY = Symbol('employeeChatSessionStore')

/**
 * 通知锚点引用
 * 用于定位通知弹窗位置
 */
export const NOTIFICATION_ANCHOR_REF_KEY = 'notificationAnchorRef'

/**
 * Deerflow 文件拖放状态
 * 用于 Deerflow 聊天的文件拖放
 */
export const DEERFLOW_FILE_DROP_KEY = 'deerflowFileDrop'
