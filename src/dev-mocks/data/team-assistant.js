/**
 * 团队助手 · Kooky 协作模块的固定内置数字人
 *
 * 与 6 个普通数字人不同：
 *   - 不在数字人市场展示（fetchAgentList 会过滤掉）
 *   - 创建协作群时默认选中且不可取消
 *   - userId / botId 使用固定值 'team-assistant' / 1000
 *   - 是群里 @ 提及的唯一 AI 触发入口
 */

export const TEAM_ASSISTANT_AGENT_ID = 1000
export const TEAM_ASSISTANT_BOT_ID = 'team-assistant'

const TEAM_ASSISTANT_AVATAR = `https://api.dicebear.com/9.x/notionists/svg?seed=team-assistant&backgroundColor=ffb8d9`

export const TEAM_ASSISTANT = {
  agent_id: TEAM_ASSISTANT_AGENT_ID,
  agent_name: 'team-assistant',
  agent_display_name: '团队助手',
  agent_version: 'v1.0.0',
  agent_avatar_url: TEAM_ASSISTANT_AVATAR,
  agent_description: 'Kooky 协作模块的 AI 协作助手，理解自然语言目标、拆解工作流、驱动群聊里的任务推进。',
  agent_tags: ['协作', '内置', 'AI 助手'],
  agent_uploader: '讯飞云+平台',
  agent_uploader_account: 'kooky-internal',
  agent_uploaded_at: '2026-01-01',
  star_count: 0,
  download_count: 0,
  image_count: 0,
  pinned: true,
  pinned_at: 0,
  last_used_at: new Date().toISOString(),
  first_used_at: '2026-01-01T00:00:00.000Z',
  is_builtin: true,
  is_official: true,
  is_followed: false,
  is_team_assistant: true,            // 特殊标记
  is_mandatory: true,                 // 必须出现在协作群里
  cannot_uninstall: true,             // 不可解聘
  cannot_unselect_in_create: true,    // 创建协作群弹窗里不可取消选中
  risk_level: 'low',
  license: 'enterprise-internal',
  scope: '集团内',
  scenarios: '协作任务拆解 / 群聊意图识别 / 步骤推进通知',
  functions: '自然语言拆解工作流、识别完成/提交/跳过/回退/终止/编辑动作、流转卡片驱动',
  detailed_description: '团队助手是 Kooky 协作模块的内置 AI，所有协作群默认携带。她监听群里的 @团队助手 触发，把目标拆成结构化工作流并在群里驱动每一步的推进。',
  changelog: 'v1.0.0：初始版本',
  // —— UI 用的归一化字段（与 employeeChatEmployees 格式对齐）——
  id: TEAM_ASSISTANT_AGENT_ID,
  name: '团队助手',
  display_name: '团队助手',
  avatar: TEAM_ASSISTANT_AVATAR,
  participant_id: TEAM_ASSISTANT_BOT_ID,
  imBotId: TEAM_ASSISTANT_BOT_ID,
  username: 'team-assistant',
  slug: 'team-assistant',
  conversationScope: 'group-bot',
  raw: null, // 自引用占位，下面填
}

// 自引用：让 raw 指向自身（兼容部分组件读 raw.xxx）
TEAM_ASSISTANT.raw = { ...TEAM_ASSISTANT, raw: undefined }

export function isTeamAssistantId(id) {
  if (id == null) return false
  return Number(id) === TEAM_ASSISTANT_AGENT_ID
    || String(id) === TEAM_ASSISTANT_BOT_ID
    || String(id) === 'team-assistant'
}
