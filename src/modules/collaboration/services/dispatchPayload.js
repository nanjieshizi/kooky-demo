/**
 * 协作任务"创建任务"分派 payload 构造
 *
 * 把协作任务的当前步骤 + 上下文打包成 prompt，
 * 跳转到一人团队/Kode 时作为初始消息送过去。
 */

/**
 * @param {object} task   完整任务对象
 * @param {object} step   要分派的步骤对象
 * @param {object} options
 * @param {boolean} options.includeTaskMeta     带任务标题 + 原始目标
 * @param {boolean} options.includeCurrentStep  带当前步骤描述
 * @param {boolean} options.includePrevSteps    带前序步骤摘要
 * @param {boolean} options.includeFiles        带前序产出文件元信息
 * @param {boolean} options.includeDiscussion   带群里近期讨论（暂未实装）
 * @param {string}  options.actor               操作人（"我"是谁）
 * @returns {{ summary: string, prompt: string, files: array }}
 */
export function buildDispatchPayload(task, step, options = {}) {
  const {
    includeTaskMeta = true,
    includeCurrentStep = true,
    includePrevSteps = true,
    includeFiles = true,
    includeDiscussion = false,
    actor = '',
  } = options

  const lines = []

  // 开场：员工/AI 视角的"收到任务"
  lines.push('收到一条来自于协作群聊的任务，具体信息如下：')
  lines.push('')

  // 任务来源：派活人 + 来源任务 + 原始目标（提到最前）
  if (includeTaskMeta && (task || actor)) {
    lines.push('━━━ 任务来源 ━━━')
    if (task) lines.push(`来源任务：「${task.emoji || ''}${task.title}」（${statusLabel(task.status)}）`)
    if (task?.goal) lines.push(`原始目标：${task.goal}`)
    if (actor) lines.push(`派活人：${actor}`)
    lines.push('')
  }

  // 核心：要做什么
  if (includeCurrentStep && step) {
    lines.push('━━━ 要做的事 ━━━')
    lines.push(`📌 ${step.name}`)
    if (step.desc) lines.push(`📝 ${step.desc}`)
    if (step.submit_type) lines.push(`🎯 产出形式：${submitTypeLabel(step.submit_type)}`)
    if (step.deadline) lines.push(`⏰ 截止时间：${step.deadline}`)
    if (step.submit_type === 'vote' && step.vote_options?.length) {
      lines.push(`🗳️ 候选选项：${step.vote_options.join(' / ')}`)
    }
    lines.push('')
  }


  const prevSteps = (task?.steps || []).filter(
    (s) => (s.status === 'done' || s.status === 'skipped') && s.id !== step?.id,
  )

  if (includePrevSteps && prevSteps.length > 0) {
    lines.push('━━━ 前序已完成的步骤（参考） ━━━')
    prevSteps.forEach((s, idx) => {
      const tag = s.status === 'done' ? '✅' : '⏭️'
      lines.push(`${idx + 1}. ${tag} ${s.name}（${statusLabel(s.status)}）`)
      ;(s.submissions || []).forEach((sub) => {
        const content = formatSubmissionContent(sub.content)
        lines.push(`   • ${sub.by}: ${content}`)
      })
      if (s.completed_by?.length && !(s.submissions || []).length) {
        lines.push(`   • 已确认：${s.completed_by.join('、')}`)
      }
    })
    lines.push('')
  }

  const files = collectFiles(prevSteps)
  if (includeFiles && files.length > 0) {
    lines.push('━━━ 随消息附带的文件 ━━━')
    files.forEach((f) => {
      lines.push(`📎 ${f.name}（${f.size || '?'}）- 来自 ${f.from} · ${f.stepName}`)
    })
    lines.push('（这些文件已经随消息一起送达，可以直接打开/引用）')
    lines.push('')
  }

  if (includeDiscussion) {
    lines.push('━━━ 群里近期讨论 ━━━')
    lines.push('（demo 阶段未接入群消息摘要）')
    lines.push('')
  }

  lines.push('请开始吧 🙌')

  const prompt = lines.join('\n').trim()
  const summary = `从协作任务「${task?.title || '?'}」· ${step?.name || '?'} 分派`

  return { summary, prompt, files }
}

function statusLabel(s) {
  switch (s) {
    case 'in_progress': return '进行中'
    case 'completed': return '已完成'
    case 'aborted': return '已取消'
    case 'pending': return '待开始'
    case 'active': return '进行中'
    case 'done': return '已完成'
    case 'skipped': return '已跳过'
    case 'overdue': return '逾期'
    case 'canceled': return '已取消'
    default: return s || '—'
  }
}

function submitTypeLabel(t) {
  switch (t) {
    case 'confirm': return '✅ 回复确认'
    case 'text': return '📝 提交文本'
    case 'file': return '📎 上传文件'
    case 'vote': return '🗳️ 投票'
    default: return t || '—'
  }
}

function formatSubmissionContent(content) {
  if (content == null) return '(空)'
  if (typeof content === 'string') return content
  if (typeof content === 'object') {
    if (content.filename) return `📎 ${content.filename}${content.size ? ` (${content.size})` : ''}`
    try { return JSON.stringify(content) } catch (_) { return String(content) }
  }
  return String(content)
}

function collectFiles(prevSteps) {
  const out = []
  for (const s of prevSteps) {
    for (const sub of s.submissions || []) {
      if (sub.content && typeof sub.content === 'object' && sub.content.filename) {
        out.push({
          name: sub.content.filename,
          size: sub.content.size || '',
          from: sub.by,
          stepName: s.name,
        })
      }
    }
  }
  return out
}
