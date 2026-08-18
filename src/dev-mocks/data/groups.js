/**
 * 内置协作群 + 历史对话
 *
 * 让用户 Cmd+R 后协作页面直接有"活动中"的群，避免每次都要重建。
 * 历史消息按员工岗位特征写（产品/架构/研发/测试/设计 各有口吻）。
 */

import { COLLEAGUES, CURRENT_USER } from './users'
import { TEAM_ASSISTANT_BOT_ID } from './team-assistant'
import { DIGITAL_HUMANS_RAW } from './digital-humans'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/**
 * @returns {Array} 内置群定义
 * 每条 message：{ sender: userName, body: 内容, t: 相对当前时间的毫秒偏移（负数=过去）}
 */
export function builtinGroups(nowMs = Date.now()) {
  return [
    // ────────────────────────────────────────
    // 群 1：KC 产研攻关团队（核心场景，主要任务都在这跑）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-kc-pcp-001',
      name: 'KC 产研攻关团队',
      accounts: ['symeng7', 'yhzhang2', 'ylyang21', 'qbhu', 'xyfang9', 'jbxu2', 'qlyun'],
      botIds: [TEAM_ASSISTANT_BOT_ID],
      createdAt: nowMs - 14 * DAY,
      lastMessageAt: nowMs - 1.5 * HOUR,
      messages: [
        { sender: 'yhzhang2', body: '本周迭代重点：「订单流程优化 v3」。PRD 已挂到协作文档，大家有空过一下', t: -1 * DAY - 2 * HOUR },
        { sender: 'qbhu', body: '看了下，订单状态机改动较大，建议先拉个架构评审，免得各端实现完了才发现兼容问题', t: -1 * DAY - 1 * HOUR },
        { sender: 'symeng7', body: '@胡勤彪 同意，今天下午 3 点先把架构方案过一遍。@张月华 评审议程麻烦同步给大家', t: -1 * DAY },
        { sender: 'qbhu', body: '好的，会议室 3F-A，到时候我带架构图 + 性能预估', t: -1 * DAY + 5 * MIN },
        { sender: 'yhzhang2', body: '议程已发，重点 3 项：状态机重构、降级策略、灰度方案', t: -1 * DAY + 12 * MIN },
        { sender: 'qlyun', body: '设计稿这两天交付。订单页新增 2 个状态过渡动画，评审时也想一起听下大家意见', t: -22 * HOUR },
        { sender: 'xyfang9', body: '后端接口先按 PRD 字段起脚手架了。状态机部分等架构方案稳了再 finalize', t: -20 * HOUR },
        { sender: 'jbxu2', body: '测试方案同步在写。重点覆盖状态机异常分支 + 并发场景', t: -8 * HOUR },
        { sender: 'ylyang21', body: '构建侧我已经盘过：状态机改了之后 schema 要小版本升级，老订单兼容跑过一遍 case', t: -4 * HOUR },
        { sender: 'symeng7', body: '收到，下午 3 点评审，大家准时到。带上各自的部分', t: -1.5 * HOUR },
      ],
    },

    // ────────────────────────────────────────
    // 群 2：产品改版设计组（设计 + 调研 + 产品视角）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-design-001',
      name: '产品改版设计组',
      accounts: ['symeng7', 'qlyun', 'yhzhang2', 'yrdeng2', 'minliu27'],
      botIds: [TEAM_ASSISTANT_BOT_ID],
      createdAt: nowMs - 6 * DAY,
      lastMessageAt: nowMs - 2.5 * HOUR,
      messages: [
        { sender: 'yhzhang2', body: '新版主改动方向：1) 首页信息架构精简 2) 任务流可视化升级 3) 配色微调向品牌靠拢', t: -3 * DAY },
        { sender: 'yrdeng2', body: '信息架构这块我整理了上轮用户调研的关键发现，等会儿同步到群', t: -3 * DAY + 30 * MIN },
        { sender: 'minliu27', body: '调研里有几个关于"任务可视化"的强反馈，建议这次重点改这块', t: -3 * DAY + 50 * MIN },
        { sender: 'qlyun', body: '可视化我准备了两个方向：横向时间线 vs 卡片网格。明天给大家看 demo', t: -2 * DAY },
        { sender: 'symeng7', body: '@员清亮 期待，最好能跑一下 PC + 移动两端的适配', t: -2 * DAY + 10 * MIN },
        { sender: 'qlyun', body: 'OK，两套适配都做。配色这次想把品牌主色用得更突出，强化识别度', t: -1.5 * DAY },
        { sender: 'yrdeng2', body: '调研报告 v2 已发到协作文档。摘要：用户对当前任务可视化反馈最强烈，57% 提到不知道任务进度', t: -1 * DAY },
        { sender: 'minliu27', body: '看到了，跟我们方向一致。我把竞品对比也加进去，明天评审一起看', t: -22 * HOUR },
        { sender: 'symeng7', body: '明天上午 10 点设计评审，参会：员清亮 / 邓颖茹 / 张月华 / 刘敏', t: -3 * HOUR },
        { sender: 'qlyun', body: '没问题，demo 链接早上前发群里', t: -2.5 * HOUR },
      ],
    },

    // ────────────────────────────────────────
    // 群 3：Kooky 520 发布会（发布前一天的技术攻坚）
    //   参与：5 真人 + 测试数字人(1003) + 研发数字人(1002)
    //   剧本来源：__playLaunchDemo 的业务对话（合并流式 chunks 后作为历史消息固化）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-launch-520-001',
      name: 'Kooky 520 发布会',
      accounts: ['symeng7', 'yrdeng2', 'ylyang21', 'yanhuang', 'jbxu2', 'jrnie', 'qbhu'],
      botIds: [TEAM_ASSISTANT_BOT_ID],
      createdAt: nowMs - 2 * HOUR,
      lastMessageAt: nowMs - 10 * MIN,
      messages: [
        { sender: 'yrdeng2', body: '@测试数字人 跑一遍核心场景回归，明天要 demo', t: -50 * MIN },
        { sender: 1003, body: '正在执行核心场景回归测试…\n\n✅ 协作任务创建 / 群聊消息 / 定时任务 全部通过\n⚠️ Skill 安装到 Kode 这步点击响应慢 ~500ms\n建议查一下接口耗时', t: -48 * MIN },
        { sender: 'jbxu2', body: '我刚也复现了，是接口慢', t: -45 * MIN },
        { sender: 'jrnie', body: '我看下，应该是 binding-status 接口', t: -43 * MIN },
        { sender: 'qbhu', body: '@研发数字人 跑下 fetchSkillBindingStatus 的耗时分布', t: -40 * MIN },
        { sender: 1002, body: '正在分析接口耗时…\n\nP95 = 1.2s，热点在 DB 查询 `skill_bindings` 全表扫描\n建议方案：加二级缓存 + 索引覆盖，预计提速 70%\npatch 已贴群里 ✅', t: -35 * MIN },
        { sender: 'symeng7', body: '速修！我去录介绍视频 ✊', t: -30 * MIN },
        { sender: 'yrdeng2', body: '冲！明天见 🚀', t: -10 * MIN },
      ],
    },

    // ────────────────────────────────────────
    // 群 4：Kooky 专项群（当前产品迭代主群）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-kooky-special-001',
      name: 'Kooky专项群',
      accounts: ['symeng7', 'yrdeng2', 'ylyang21', 'yanhuang', 'minliu27', 'yhzhang2', 'jrnie', 'jbxu2'],
      botIds: [TEAM_ASSISTANT_BOT_ID, 1007, 1008, 1009],
      createdAt: nowMs - 18 * DAY,
      lastMessageAt: nowMs - 3 * MIN,
      messages: [
        { sender: 'yrdeng2', body: '@PMO 把云帆「Kooky 专项」里的项目目标、当前进展、里程碑和风险写到本群项目看板。', t: -5 * DAY },
        { sender: 1007, body: '已写入本群项目看板：\n\n· 目标：完成协作群项目化改造并通过核心场景验收\n· 当前进展：完成度 50%\n· 里程碑：信息架构定稿、项目看板走查、协作任务归档与再次开启、演示流程验收\n· 风险：历史工作流重开差异、群级接口权限\n\n后续有人在群里 @我，我会按指令继续维护。', t: -5 * DAY + 3 * MIN },
        { sender: 'yrdeng2', body: '本周 Kooky 专项先收敛三件事：协作二级菜单、项目看板、协作任务归档与再次开启。今天把交互定稿。', t: -1 * DAY - 2 * HOUR },
        { sender: 'symeng7', body: '协作任务按群管理；一个群对应一个项目上下文，不再套 projectId，也不做任务关联。', t: -1 * DAY - 90 * MIN },
        { sender: 'ylyang21', body: '技术口径同步：任务状态仍保持 in_progress / completed / aborted，逾期只做运行中的展示态，不破坏状态机。', t: -1 * DAY - 55 * MIN },
        { sender: 'yanhuang', body: '生态方会通过数字人的 Skill 调项目和协作任务接口，不要求 Kooky 内置每一家第三方连接器。', t: -22 * HOUR },
        { sender: 'jrnie', body: '协作列表视觉和会话文件侧栏已经合进 demo，今天补归档分组和工作流引用输入框。', t: -8 * HOUR },
        { sender: 'jbxu2', body: '回归我会覆盖：正常进行中、逾期、完成、取消，以及归档任务再次开启后的原任务保留。', t: -6 * HOUR },
        { sender: 'symeng7', body: '@PMO 同步一下今天的协作任务进展，把项目完成度更新到 65%，归档与再次开启标成进行中。', t: -42 * MIN },
        { sender: 1007, body: '已更新本群项目看板：完成度 65%；“协作任务归档与再次开启”已进入进行中；新增“数字人调用项目与协作任务接口的群级权限待联调”风险。', t: -39 * MIN },
        { sender: 'yrdeng2', body: '今天先把列表和空态走查完，问题直接在群里开协作任务，别再用口头 TODO 养蛊了。', t: -3 * MIN },
      ],
    },

    // ────────────────────────────────────────
    // 群 5：Kooky 研发推进群（架构与实现细节）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-kooky-rd-001',
      name: 'Kooky 研发推进群',
      accounts: ['symeng7', 'ylyang21', 'qbhu', 'jrnie', 'xyfang9', 'jbxu2'],
      botIds: [TEAM_ASSISTANT_BOT_ID],
      createdAt: nowMs - 10 * DAY,
      lastMessageAt: nowMs - 6 * HOUR,
      messages: [
        { sender: 'ylyang21', body: '协作任务继续以 conversationId 做隔离，重开归档任务时复制定义、不复活旧实例。', t: -2 * DAY },
        { sender: 'jrnie', body: '收到。列表分成进行中和已归档，完成与取消都保留历史详情。', t: -2 * DAY + 20 * MIN },
        { sender: 'xyfang9', body: '重开接口先按 sourceTaskId + 用户补充描述设计，后端据此生成新 flow。', t: -1 * DAY },
        { sender: 'jbxu2', body: '我补边界用例：并发重开、原任务被删除、进行中任务达到上限。', t: -8 * HOUR },
        { sender: 'ylyang21', body: '可以，demo 先把视觉和前端交互做完整，生产契约后补。', t: -6 * HOUR },
      ],
    },

    // ────────────────────────────────────────
    // 群 6：Kooky 生态共创群（生态伙伴与数字人接入）
    // ────────────────────────────────────────
    {
      conversationId: 'mock-group-kooky-ecosystem-001',
      name: 'Kooky 生态共创群',
      accounts: ['symeng7', 'yanhuang', 'yrdeng2', 'minliu27', 'yhzhang2', 'xyfang9'],
      botIds: [TEAM_ASSISTANT_BOT_ID],
      createdAt: nowMs - 9 * DAY,
      lastMessageAt: nowMs - 18 * HOUR,
      messages: [
        { sender: 'yanhuang', body: '生态接入原则再确认一次：第三方能力放在企业数字人的 Skill 里，Kooky 只开放通用项目和协作任务能力。', t: -3 * DAY },
        { sender: 'symeng7', body: '对。数字人进群后就是普通成员，是否能调第三方由它自己的 Skill 和授权决定。', t: -3 * DAY + 25 * MIN },
        { sender: 'yrdeng2', body: '那交互上不做“项目管家”特殊身份，成员列表保留数字人标识就够了。', t: -2 * DAY },
        { sender: 'xyfang9', body: '通用能力先给项目看板读写、协作任务创建/更新、群上下文读取，权限边界后面补。', t: -1 * DAY },
        { sender: 'yanhuang', body: '收到，我按这个口径和首批生态方对齐，问题统一带回群里。', t: -18 * HOUR },
      ],
    },
  ]
}

/**
 * 根据 sender 字符串解析出发送方信息
 * sender 可以是：userName（匹配同事池）、'team-assistant'、或主用户的 userName
 */
export function lookupSenderForMessage(sender) {
  if (!sender) return null
  if (sender === CURRENT_USER.userName || sender === CURRENT_USER.userId) {
    return {
      userId: CURRENT_USER.userId,
      name: CURRENT_USER.name,
      type: 'user',
      role: 'user',
    }
  }
  if (sender === TEAM_ASSISTANT_BOT_ID || sender === 'team-assistant' || sender === '团队助手') {
    return {
      userId: TEAM_ASSISTANT_BOT_ID,
      name: '团队助手',
      type: 'agent',
      role: 'assistant',
    }
  }
  // 数字员工：sender 可以是 agent_id (1001-1006)、agent_name ('product-digital-human')、agent_display_name ('产品数字人')
  const dh = DIGITAL_HUMANS_RAW.find(
    (a) =>
      Number(a.agent_id) === Number(sender) ||
      a.agent_name === sender ||
      a.agent_display_name === sender,
  )
  if (dh) {
    return {
      userId: `agent-${dh.agent_id}`,
      name: dh.agent_display_name,
      type: 'agent',
      role: 'assistant',
      avatar: dh.agent_avatar_url || '',
    }
  }
  const u = COLLEAGUES.find((c) => c.userName === sender || c.userId === sender || c.name === sender)
  if (u) {
    return {
      userId: u.userId,
      name: u.name,
      type: 'user',
      role: 'member',
    }
  }
  return { userId: sender, name: sender, type: 'user', role: 'member' }
}
