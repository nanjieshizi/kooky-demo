/**
 * 协作任务 AI Bridge
 *
 * 前端 ↔ 本地 demo-server（http://localhost:3939）的桥接层。
 * demo-server 内部走 claude CLI 调真 Claude（Max 订阅），不需要 API Key。
 *
 * 两个核心接口：
 *   - decomposeGoal：把自然语言目标拆解成结构化工作流（System Prompt + JSON Schema）
 *   - interpretMessage：识别群聊发言对应的动作（done/submit/skip/back/abort/edit/...）
 */

const API_BASE = 'http://localhost:3939/api/collaboration'

/**
 * 拆解协作任务
 * @param {string} userGoal - 用户自然语言目标，如"帮我组织产品发布会"
 * @param {string[]} members - 群聊成员列表（中文名）
 * @returns {Promise<{title, emoji, steps}>}
 *
 * steps[i] = { id, name, desc, assignees, submit_type, vote_options?, deadline?, parallel_group? }
 */
export async function decomposeGoal(userGoal, members = []) {
  const res = await fetch(`${API_BASE}/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_goal: userGoal, members }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`decompose failed: ${res.status} ${body}`)
  }
  return res.json()
}

/**
 * 理解发言意图
 * @param {string} text - 用户发言原文（去掉 @团队助手 前缀更好）
 * @param {string} speaker - 发言人中文名
 * @param {object} context - 当前任务上下文 {task_title, current_step, all_steps, ...}
 * @returns {Promise<{action, target_step?, submit_content?, edit_params?, reply}>}
 *
 * action ∈ done | submit | skip_self | skip_step | back | abort | confirm_abort | edit | unrelated
 */
export async function interpretMessage(text, speaker, context = {}) {
  const res = await fetch(`${API_BASE}/interpret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker, context }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`interpret failed: ${res.status} ${body}`)
  }
  return res.json()
}

/**
 * 健康检查（demo-server 是否在跑）
 */
export async function pingDemoServer() {
  try {
    const res = await fetch('http://localhost:3939/', { method: 'GET' })
    return res.ok
  } catch (_) {
    return false
  }
}
