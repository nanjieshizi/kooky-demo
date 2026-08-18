// 把 demo 剧本（director ctx）投影成生产 OnePersonPlanCard 吃的 plan 快照。
// 纯函数，无 Vue / 无 IO —— 与生产 solo-team 的 *.mjs 内核范式一致。

// 剧本用 active，生产任务图契约用 running（契约取值：pending/running/completed/failed/skipped，无 in_progress）。
const PHASE_TO_STATUS = {
  pending: 'pending',
  active: 'running',
  completed: 'completed',
}

function agentIdOf(member) {
  return member?.agent_id ?? member?.id ?? null
}

/**
 * @param {object} ctx director 的剧本上下文（需含 steps[] 与 phase[]）
 * @returns {object|null} 生产 OnePersonPlanCard 的 plan 快照；无步骤时返回 null（卡片自动不渲染）
 */
export function planFromDirector(ctx) {
  const defs = ctx?.steps
  if (!Array.isArray(defs) || !defs.length) return null

  const steps = defs.map((def, i) => ({
    id: `demo-plan-step-${i}`,
    title: def.title || def.short || `步骤 ${i + 1}`,
    status: PHASE_TO_STATUS[ctx.phase?.[i]] || 'pending',
    assignee: agentIdOf(def.member),
    displayName: def.member?.name || '',
  }))

  return {
    steps,
    progress: {
      completed: steps.filter((s) => s.status === 'completed').length,
      total: steps.length,
    },
    // 生产的 revisionNote 语义是「重新规划说明」（replan_notice），
    // 与剧本的 nextHint（下一步提示）不是一回事，故留空不硬塞。
    revisionNote: '',
  }
}

// 剧本的成员状态 → 生产成员卡的字段。
// 生产 getCardStatus 的判定顺序：failed → running → 从 execLabel 文本兜底推断
// （含「完成」→ completed；含「等待/待命/摸鱼」→ idle；默认 idle）。
// 故 execLabel 必须给：卡片的状态行 v-if="card.execLabel"，不给就整行不渲染。
const STATUS_TO_CARD = {
  busy: { running: true, execLabel: '执行中' },
  done: { running: false, execLabel: '已完成' },
  pending: { running: false, execLabel: '等待中' },
}

/**
 * 任务参与成员 + 剧本状态 → 生产 OnePersonTaskMemberStrip 的 cards。
 * 同一份 cards 会被成员条透传给 PlanCard 查头像，无需再造第二份。
 *
 * @param {Array} assignees 任务参与者（{ agent_id|id, name, avatar }）
 * @param {(member:object)=>string} statusOf 返回 'busy' | 'done' | 'pending'
 */
export function memberCardsFromDirector(assignees, statusOf) {
  if (!Array.isArray(assignees)) return []
  return assignees
    .filter((m) => agentIdOf(m) != null)
    .map((m) => ({
      // 成员条的 summaryText 用严格相等比对 selectedMemberId(String)，故统一转字符串
      agentId: String(agentIdOf(m)),
      avatarUrl: m?.avatar_url || m?.avatar || '',
      displayName: m?.name || '',
      failed: false, // 剧本无失败态
      ...(STATUS_TO_CARD[statusOf?.(m)] || STATUS_TO_CARD.pending),
    }))
}
