/**
 * 定时任务（Routine）mock 数据
 *
 * 数据模型：
 *   ScheduledTask {
 *     id, name (≤20), instruction (≤200),
 *     executor: { agentId, agentName, agentAvatar, source: { type, label, conversationId? } },
 *     cycle: { type: 'daily' | 'interval' | 'once' | 'cron', ...config },
 *     status: 'running' | 'paused' | 'invalid',
 *     invalidReason?: string,
 *     createdAt, lastRunAt?, nextRunAt?,
 *     runHistory: [{ id, ts, replyContent, conversationId, anchorEventId }]
 *   }
 *
 * source.type 三类：
 *   - 'avatar'        我的分身（deerflow）
 *   - 'solo-employee' 一人团队 · 我的员工（单人）
 *   - 'solo-team'     一人团队 · 团队群下某员工
 *   - 'collab-1on1'   协作 · 数字人单聊
 *   - 'collab-group'  协作 · 群聊里某员工
 */

import { TEAM_ASSISTANT_BOT_ID } from './team-assistant'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/**
 * @returns {Array<ScheduledTask>}
 */
export function builtinScheduledTasks(nowMs = Date.now()) {
  return [
    // ────────────────────────────────────────
    // 1. 运行中 · 每日科技新闻摘要（一人团队·我的员工）
    // ────────────────────────────────────────
    {
      id: 'sched-news-daily-001',
      name: '每日科技新闻摘要',
      instruction: '为我推送当天最新的 10 条科技新闻，每条要精简（1-2 句话内）。重点关注 AI、芯片、SaaS 三个方向。',
      executor: {
        agentId: 1001, // 产品数字人
        agentName: '产品数字人',
        agentAvatar: '',
        source: {
          type: 'solo-employee',
          label: '一人团队 · 我的员工',
          conversationId: 'sched-conv-news-daily-001',
        },
      },
      cycle: {
        type: 'daily',
        time: '08:30',
        weekdays: [1, 2, 3, 4, 5], // 工作日
        description: '工作日 08:30',
      },
      status: 'running',
      createdAt: nowMs - 30 * DAY,
      lastRunAt: nowMs - 1 * DAY,
      nextRunAt: nowMs + 18 * HOUR,
      runHistory: [
        {
          id: 'run-news-001-1',
          ts: nowMs - 1 * DAY,
          replyContent: '今天的科技新闻摘要已整理为 10 条要点：\n1. AI agent 平台获得新一轮 5 亿融资\n2. 主流芯片厂商发布 5nm 制程突破\n3. 国内 SaaS 平台用户突破 1 亿\n4. 多家科技公司发布 Q3 财报，AI 业务占比提升\n5. 开源大模型社区新增 50+ 高质量项目\n...（点击展开看完整）',
          conversationId: 'sched-conv-news-daily-001',
          anchorEventId: 'evt-news-001-1',
        },
        {
          id: 'run-news-001-2',
          ts: nowMs - 2 * DAY,
          replyContent: '今天的科技新闻摘要已整理为 10 条要点：\n1. OpenAI 发布最新模型，推理能力大幅提升\n2. 谷歌量子计算取得新突破\n3. 国产芯片产能持续扩张\n...',
          conversationId: 'sched-conv-news-daily-001',
          anchorEventId: 'evt-news-001-2',
        },
        {
          id: 'run-news-001-3',
          ts: nowMs - 3 * DAY,
          replyContent: '今天的科技新闻摘要已整理为 10 条要点：\n1. Claude 系列模型迎来重磅更新\n2. 多家硬件厂商发布新一代 AI 加速卡\n...',
          conversationId: 'sched-conv-news-daily-001',
          anchorEventId: 'evt-news-001-3',
        },
      ],
    },

    // ────────────────────────────────────────
    // 2. 运行中 · 每周产品会议提醒（一人团队·一人团队群）
    // ────────────────────────────────────────
    {
      id: 'sched-prd-weekly-001',
      name: '每周产品会议提醒',
      instruction: '提醒大家本周产品会议的议程：\n1. 上周 OKR 复盘\n2. 本周新需求评审\n3. 风险事项 sync\n\n议程时间：周一 14:00，会议室 3F-A。',
      executor: {
        agentId: 1001,
        agentName: '产品数字人',
        agentAvatar: '',
        source: {
          type: 'solo-team',
          label: '一人团队 · 产品开发团队',
          conversationId: 'sched-conv-prd-weekly-001',
        },
      },
      cycle: {
        type: 'daily',
        time: '09:40',
        weekdays: [1],
        description: '周一 09:40',
      },
      status: 'running',
      createdAt: nowMs - 60 * DAY,
      lastRunAt: nowMs - 4 * DAY,
      nextRunAt: nowMs + 3 * DAY,
      runHistory: [
        {
          id: 'run-prd-001-1',
          ts: nowMs - 4 * DAY,
          replyContent: '@大家好！本周产品会议提醒：\n📅 时间：今天 14:00\n📍 地点：会议室 3F-A\n📋 议程：上周 OKR 复盘 / 本周新需求评审 / 风险事项 sync\n请大家提前准备好上周进展数据。',
          conversationId: 'sched-conv-prd-weekly-001',
          anchorEventId: 'evt-prd-001-1',
        },
        {
          id: 'run-prd-001-2',
          ts: nowMs - 11 * DAY,
          replyContent: '@大家好！本周产品会议提醒：\n📅 时间：今天 14:00\n📍 地点：会议室 3F-A\n本周重点议题：新模块上线灰度方案',
          conversationId: 'sched-conv-prd-weekly-001',
          anchorEventId: 'evt-prd-001-2',
        },
      ],
    },

    // ────────────────────────────────────────
    // 3. 已暂停 · 周报整理（一人团队·我的员工）
    // ────────────────────────────────────────
    {
      id: 'sched-weekly-report-001',
      name: '周报整理',
      instruction: '整理本周项目进展，按"完成/进行中/阻塞"三栏输出 Markdown 周报，发到群里。',
      executor: {
        agentId: 1001,
        agentName: '产品数字人',
        agentAvatar: '',
        source: {
          type: 'solo-employee',
          label: '一人团队 · 我的员工',
          conversationId: 'sched-conv-weekly-report-001',
        },
      },
      cycle: {
        type: 'daily',
        time: '17:00',
        weekdays: [5], // 周五
        description: '周五 17:00',
      },
      status: 'paused',
      createdAt: nowMs - 90 * DAY,
      lastRunAt: nowMs - 14 * DAY,
      nextRunAt: null,
      runHistory: [
        {
          id: 'run-wr-001-1',
          ts: nowMs - 14 * DAY,
          replyContent: '## 第 36 周周报\n\n**✅ 完成**\n- 订单模块 v2 上线\n- 接入 3 个新数字员工\n\n**🚧 进行中**\n- 用户中心改版（70%）\n- 数据大盘 v2（45%）\n\n**⚠️ 阻塞**\n- 风控接口对接进度滞后',
          conversationId: 'sched-conv-weekly-report-001',
          anchorEventId: 'evt-wr-001-1',
        },
      ],
    },

    // ────────────────────────────────────────
    // 4. 运行中 · 每日喝水提醒（我的分身）
    //   source.type='avatar' → 专属会话挂在「我的分身」下，会话名「定时任务：每日喝水提醒」
    // ────────────────────────────────────────
    {
      id: 'sched-water-001',
      name: '每日喝水提醒',
      instruction: '每天工作日提醒我按时喝水，每次播报当前累计杯数。语气轻松。',
      executor: {
        agentId: null,
        agentName: '我的分身',
        agentAvatar: '',
        source: {
          type: 'avatar',
          label: '我的分身',
          conversationId: 'sched-conv-water-001',
          threadId: 100208,
          langgraphThreadId: 'lg-sched-water-001',
        },
      },
      cycle: {
        type: 'daily',
        time: '10:00',
        weekdays: [1, 2, 3, 4, 5],
        description: '工作日 10:00 / 14:00 / 16:30',
      },
      status: 'running',
      createdAt: nowMs - 20 * DAY,
      lastRunAt: nowMs - 4 * HOUR,
      nextRunAt: nowMs + 2 * HOUR,
      runHistory: [
        {
          id: 'run-water-001-1',
          ts: nowMs - 4 * HOUR,
          replyContent: '💧 喝水时间到啦～\n今日已喝：3 杯（约 600ml）\n推荐目标：8 杯（1500ml）\n下次提醒：16:30',
          conversationId: 'sched-conv-water-001',
          anchorEventId: 'evt-water-001-1',
        },
        {
          id: 'run-water-001-2',
          ts: nowMs - 8 * HOUR,
          replyContent: '💧 喝水时间到啦～\n今日已喝：2 杯（约 400ml）\n推荐目标：8 杯（1500ml）\n下次提醒：14:00',
          conversationId: 'sched-conv-water-001',
          anchorEventId: 'evt-water-001-2',
        },
        {
          id: 'run-water-001-3',
          ts: nowMs - 1 * DAY - 2 * HOUR,
          replyContent: '💧 今日喝水复盘：总共喝了 7 杯（约 1400ml），距目标 1500ml 还差 100ml。继续保持 👍',
          conversationId: 'sched-conv-water-001',
          anchorEventId: 'evt-water-001-3',
        },
      ],
    },

    // ────────────────────────────────────────
    // 5. 已失效 · 季度复盘提醒（数据分析师 - 已从团队移除）
    // ────────────────────────────────────────
    {
      id: 'sched-quarter-review-001',
      name: '季度复盘提醒',
      instruction: '触发 Q2 季度复盘流程，整理三大维度数据：1) 产品核心指标 2) 用户增长 3) 财务收支。',
      executor: {
        agentId: 9999, // 不存在的 agent
        agentName: '数据分析师',
        agentAvatar: '',
        source: {
          type: 'solo-team',
          label: '一人团队 · 产品开发团队',
          conversationId: null,
        },
      },
      cycle: {
        type: 'once',
        runAt: nowMs + 30 * DAY,
        time: '09:00',
        description: '单次 09:00 2026-06-20',
      },
      status: 'invalid',
      invalidReason: '该数字员工已从「产品开发团队」中移除',
      createdAt: nowMs - 5 * DAY,
      lastRunAt: null,
      nextRunAt: null,
      runHistory: [],
    },
  ]
}

/**
 * 预制专属会话：定时任务的产出会落到这些会话里
 * 用户点击「在对话中查看」时，跳转到这些会话 + 滚动到 anchorEventId
 */
export function builtinScheduleConversations(nowMs = Date.now()) {
  return [
    {
      conversationId: 'sched-conv-news-daily-001',
      name: '定时任务：每日科技新闻摘要',
      type: 'sched-solo-1on1',
      executorAgentId: 1001,
      executorAgentName: '产品数字人',
      createdAt: nowMs - 30 * DAY,
    },
    {
      conversationId: 'sched-conv-prd-weekly-001',
      name: '定时任务：每周产品会议提醒',
      type: 'sched-solo-team',
      executorAgentId: 1001,
      executorAgentName: '产品数字人',
      teamName: '产品开发团队',
      createdAt: nowMs - 60 * DAY,
    },
    {
      conversationId: 'sched-conv-weekly-report-001',
      name: '定时任务：周报整理',
      type: 'sched-solo-1on1',
      executorAgentId: 1001,
      executorAgentName: '产品数字人',
      createdAt: nowMs - 90 * DAY,
    },
    {
      conversationId: 'sched-conv-water-001',
      name: '定时任务：每日喝水提醒',
      type: 'sched-avatar',
      // 我的分身（deerflow）会话锚定字段
      threadId: 100208,
      langgraphThreadId: 'lg-sched-water-001',
      executorAgentId: null,
      executorAgentName: '我的分身',
      createdAt: nowMs - 20 * DAY,
    },
  ]
}

/**
 * 内置 3 条预设示例（空态时随机展示）
 * 点击预设直接预填创建弹窗
 */
export function builtinSchedulePresets() {
  return [
    {
      id: 'preset-news',
      label: '设置[每天]推送当天最新[10条]科技新闻总结要精简。',
      taskName: '每日科技新闻摘要',
      instruction: '为我推送当天最新的 10 条科技新闻，每条要精简（1-2 句话内）。重点关注 AI、芯片、SaaS 方向。',
      cycle: { type: 'daily', time: '08:30', weekdays: [1, 2, 3, 4, 5] },
    },
    {
      id: 'preset-water',
      label: '提醒我喝水，在[每日 14:00]执行，任务创建后设置为「立即启用」。',
      taskName: '每日喝水提醒',
      instruction: '提醒我喝水，简短一句话，可以加个表情让人放松。',
      cycle: { type: 'daily', time: '14:00', weekdays: [1, 2, 3, 4, 5, 6, 7] },
    },
    {
      id: 'preset-action',
      label: '设置每日[14:00]的自动定时任务，把今日的行动注意指引发送给我。',
      taskName: '每日行动注意指引',
      instruction: '基于近期工作，给我今天最值得做的 3 件事 + 注意事项。',
      cycle: { type: 'daily', time: '14:00', weekdays: [1, 2, 3, 4, 5] },
    },
    {
      id: 'preset-standup',
      label: '每个工作日早上 9:30 帮我整理昨天的进展，准备站会发言。',
      taskName: '站会发言准备',
      instruction: '整理昨天我做了什么 / 今天计划做什么 / 阻塞是什么，输出 3 句话的站会发言稿。',
      cycle: { type: 'daily', time: '09:30', weekdays: [1, 2, 3, 4, 5] },
    },
    {
      id: 'preset-weekly',
      label: '每周五下午 5 点整理本周项目周报。',
      taskName: '周报整理',
      instruction: '整理本周完成 / 进行中 / 阻塞 三栏，输出 Markdown 周报。',
      cycle: { type: 'daily', time: '17:00', weekdays: [5] },
    },
  ]
}

/**
 * 随机抽 3 个预设
 */
export function pickRandomPresets(n = 3) {
  const all = builtinSchedulePresets()
  const shuffled = all.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}
