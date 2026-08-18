import { defineStore } from 'pinia'

const STORAGE_KEY = 'kooky_collaboration_projects_v1'
const KOOKY_SPECIAL_GROUP_ID = 'mock-group-kooky-special-001'

function makeDemoProjects() {
  return {
    [KOOKY_SPECIAL_GROUP_ID]: {
      conversationId: KOOKY_SPECIAL_GROUP_ID,
      demoSeedVersion: 1,
      name: 'Kooky 协作能力升级',
      goal: '完成协作群项目化改造，保留群聊主场景，补齐项目看板、协作任务归档与引用历史工作流再次开启能力，并通过核心场景验收。',
      owner: '邓颖茹',
      stage: '进行中',
      progress: 65,
      progressSummary: '协作二级菜单、项目看板、会话文件和右侧工具栏已完成高保真改造；正在完善协作任务归档、逾期状态与引用历史工作流再次开启。',
      milestones: [
        { id: 'kooky-ms-ia', title: '协作信息架构与群聊主场景定稿', date: '8月8日', status: 'done', owner: '邓颖茹', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-08T09:20:00+08:00' },
        { id: 'kooky-ms-overview', title: '项目看板与会话侧区高保真完成', date: '8月12日', status: 'done', owner: '邓颖茹', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-12T16:30:00+08:00' },
        { id: 'kooky-ms-archive', title: '协作任务归档与再次开启', date: '8月15日', status: 'active', owner: '杨宇龙', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-13T10:15:00+08:00' },
        { id: 'kooky-ms-demo', title: '演示流程联调验收', date: '8月18日', status: 'pending', owner: '黄燕', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-13T10:15:00+08:00' },
      ],
      risks: [
        { id: 'kooky-risk-restart', title: '历史工作流再次开启时，需明确原流程与本次描述的差异', level: 'medium', status: 'open', owner: '杨宇龙', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-13T11:10:00+08:00' },
        { id: 'kooky-risk-auth', title: '数字人调用项目与协作任务接口的群级权限仍需联调', level: 'high', status: 'open', owner: '黄燕', source: '数字人维护', updatedBy: '云帆管家', updatedAt: '2026-08-11T17:40:00+08:00' },
      ],
      updates: [],
      createdAt: '2026-08-08T09:20:00+08:00',
      createdBy: '云帆管家',
      updatedAt: '2026-08-13T11:20:00+08:00',
      updatedBy: '云帆管家',
      maintenanceSource: '数字人维护',
    },
  }
}

function readProjects() {
  const demoProjects = makeDemoProjects()
  if (typeof localStorage === 'undefined') return demoProjects
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const storedProjects = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    const mergedProjects = { ...storedProjects }
    for (const [conversationId, demoProject] of Object.entries(demoProjects)) {
      if (Number(storedProjects[conversationId]?.demoSeedVersion || 0) < demoProject.demoSeedVersion) {
        mergedProjects[conversationId] = demoProject
      }
    }
    const normalized = Object.fromEntries(
      Object.entries(mergedProjects).map(([conversationId, project]) => [
        conversationId,
        normalizeProjectRecord(project, conversationId),
      ]),
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  } catch (_) {
    return demoProjects
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function maintenanceSource(value) {
  const source = String(value || '').trim()
  return /数字人|管家|agent|digital/i.test(source) ? '数字人维护' : '人维护'
}

function normalizeProjectRecord(value, conversationId) {
  const raw = value && typeof value === 'object' ? value : {}
  const legacyInitialSummary = raw.progressSummary === '项目协作已启用，正在确认首轮计划与负责人。'
  const project = {
    ...raw,
    conversationId: String(raw.conversationId || conversationId),
    progress: legacyInitialSummary ? 0 : Math.max(0, Math.min(100, Number(raw.progress) || 0)),
    progressSummary: legacyInitialSummary ? '' : String(raw.progressSummary || ''),
    milestones: (Array.isArray(raw.milestones) ? raw.milestones : [])
      .filter((item) => item?.source !== '启用项目协作')
      .map((item) => ({ ...item, source: maintenanceSource(item?.source) })),
    risks: (Array.isArray(raw.risks) ? raw.risks : [])
      .map((item) => ({ ...item, source: maintenanceSource(item?.source) })),
    updates: (Array.isArray(raw.updates) ? raw.updates : [])
      .filter((item) => (
        item?.text !== '启用了项目协作'
        && item?.source !== '启用项目协作'
        && !/^授权.+访问本群关联空间$/.test(String(item?.text || ''))
      ))
      .map((item) => ({ ...item, source: maintenanceSource(item?.source) })),
    maintenanceSource: maintenanceSource(raw.maintenanceSource || raw.updates?.[0]?.source),
  }
  delete project.enabled
  // V1 项目上下文不绑定任何数字人。历史 manager 仅用于旧原型，
  // 若对应数字人已经真实入群，会继续作为普通群成员存在。
  delete project.manager
  return project
}

export const useCollabProjectStore = defineStore('collabProject', {
  state: () => ({
    projectsByConversation: readProjects(),
  }),

  getters: {
    projectForGroup: (state) => (conversationId) => {
      if (!conversationId) return null
      return state.projectsByConversation[String(conversationId)] || null
    },
  },

  actions: {
    _persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projectsByConversation))
      } catch (_) {
        // Electron 禁用存储或达到配额时只退化为本次会话状态
      }
    },

    _record(project, { updatedBy = '群成员', source = '人维护', text = '更新了项目' } = {}) {
      const ts = nowIso()
      const normalizedSource = maintenanceSource(source)
      project.updatedAt = ts
      project.updatedBy = updatedBy
      project.maintenanceSource = normalizedSource
      project.updates = [
        {
          id: makeId('update'),
          text,
          source: normalizedSource,
          updatedBy,
          updatedAt: ts,
        },
        ...(Array.isArray(project.updates) ? project.updates : []),
      ].slice(0, 30)
    },

    createProject(conversationId, payload = {}) {
      if (!conversationId) return null
      const key = String(conversationId)
      const createdAt = nowIso()
      const updatedBy = payload.updatedBy || '群成员'
      const owner = payload.owner || updatedBy
      const project = {
        conversationId: key,
        name: payload.name || '未命名项目',
        goal: payload.goal || '',
        owner,
        stage: payload.stage || '规划中',
        progress: Math.max(0, Math.min(100, Number(payload.progress) || 0)),
        progressSummary: payload.progressSummary || '',
        milestones: Array.isArray(payload.milestones) ? payload.milestones : [],
        risks: Array.isArray(payload.risks) ? payload.risks : [],
        updates: [],
        createdAt,
        createdBy: updatedBy,
        updatedAt: createdAt,
        updatedBy,
      }
      this._record(project, {
        updatedBy,
        source: payload.source || '人维护',
        text: '添加了项目目标',
      })
      this.projectsByConversation[key] = project
      this._persist()
      return project
    },

    updateProject(conversationId, patch = {}, meta = {}) {
      const project = this.projectForGroup(conversationId)
      if (!project) return null
      const allowed = ['name', 'goal', 'owner', 'stage', 'progress', 'progressSummary']
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) project[key] = patch[key]
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'progress')) {
        project.progress = Math.max(0, Math.min(100, Number(patch.progress) || 0))
      }
      this._record(project, {
        ...meta,
        text: meta.text || '更新了项目看板',
      })
      this._persist()
      return project
    },

    addMilestone(conversationId, milestone = {}, meta = {}) {
      const project = this.projectForGroup(conversationId)
      if (!project || !String(milestone.title || '').trim()) return null
      const ts = nowIso()
      const item = {
        id: makeId('milestone'),
        title: String(milestone.title).trim(),
        date: String(milestone.date || '待确定').trim() || '待确定',
        status: milestone.status || 'pending',
        owner: milestone.owner || project.owner || '',
        source: maintenanceSource(meta.source),
        updatedBy: meta.updatedBy || '群成员',
        updatedAt: ts,
      }
      project.milestones = [...(project.milestones || []), item]
      this._record(project, {
        ...meta,
        text: meta.text || `新增里程碑：${item.title}`,
      })
      this._persist()
      return item
    },

    updateMilestoneStatus(conversationId, milestoneId, status, meta = {}) {
      const project = this.projectForGroup(conversationId)
      const item = project?.milestones?.find((milestone) => milestone.id === milestoneId)
      if (!project || !item) return null
      item.status = status
      item.updatedAt = nowIso()
      item.updatedBy = meta.updatedBy || '群成员'
      item.source = maintenanceSource(meta.source)
      this._record(project, {
        ...meta,
        text: meta.text || `更新里程碑：${item.title}`,
      })
      this._persist()
      return item
    },

    addRisk(conversationId, risk = {}, meta = {}) {
      const project = this.projectForGroup(conversationId)
      if (!project || !String(risk.title || risk.content || '').trim()) return null
      const item = {
        id: makeId('risk'),
        title: String(risk.title || risk.content).trim(),
        level: risk.level || 'medium',
        status: risk.status || 'open',
        owner: risk.owner || project.owner || '',
        source: maintenanceSource(meta.source),
        updatedBy: meta.updatedBy || '群成员',
        updatedAt: nowIso(),
      }
      project.risks = [item, ...(project.risks || [])]
      this._record(project, {
        ...meta,
        text: meta.text || `新增项目风险：${item.title}`,
      })
      this._persist()
      return item
    },

    resolveRisk(conversationId, riskId, meta = {}) {
      const project = this.projectForGroup(conversationId)
      const item = project?.risks?.find((risk) => risk.id === riskId)
      if (!project || !item) return null
      item.status = item.status === 'resolved' ? 'open' : 'resolved'
      item.updatedBy = meta.updatedBy || '群成员'
      item.updatedAt = nowIso()
      this._record(project, {
        ...meta,
        text: meta.text || `${item.status === 'resolved' ? '已解除' : '重新打开'}风险：${item.title}`,
      })
      this._persist()
      return item
    },

  },
})
